'use client';

import {
  BLE_UUIDS,
  cadenceFromCrank,
  parseCscMeasurement,
  parseCyclingPowerMeasurement,
  parseHeartRateMeasurement,
  parseIndoorBikeData,
  speedFromWheel,
  type CrankData,
  type WheelData,
} from './ble-parsers.ts';
import {
  encodeRequestControl,
  encodeSetIndoorBikeSimulation,
  encodeSetTargetPower,
  encodeStartOrResume,
  parseControlPointResponse,
} from './ftms-control.ts';
import type { RideReading } from './recorder.ts';

export type RideDeviceRole = 'trainer' | 'heartRate' | 'cadence';
export type RideDeviceStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export type RideDeviceState = {
  status: RideDeviceStatus;
  name: string | null;
  /** 'ftms' trainers accept ERG targets; 'cycling-power' trainers only report power. */
  protocol: 'ftms' | 'cycling-power' | 'heart-rate' | 'csc' | null;
  message: string | null;
};

export type RideDevicesSnapshot = Record<RideDeviceRole, RideDeviceState> & { ergAvailable: boolean };

export type ErgCommand = { mode: 'erg'; watts: number } | { mode: 'free' };

const STALE_MS = 3000;
const WHEEL_CIRCUMFERENCE_M = 2.105;
const MAX_BACKOFF_MS = 30_000;
const WRITE_RETRY_LIMIT = 3;

const emptyDevice: RideDeviceState = { status: 'disconnected', name: null, protocol: null, message: null };

const REQUEST_OPTIONS: Record<RideDeviceRole, RequestDeviceOptions> = {
  trainer: {
    filters: [{ services: [BLE_UUIDS.fitnessMachineService] }, { services: [BLE_UUIDS.cyclingPowerService] }],
    optionalServices: [BLE_UUIDS.fitnessMachineService, BLE_UUIDS.cyclingPowerService, BLE_UUIDS.cyclingSpeedCadenceService, BLE_UUIDS.heartRateService],
  },
  heartRate: { filters: [{ services: [BLE_UUIDS.heartRateService] }] },
  cadence: {
    filters: [{ services: [BLE_UUIDS.cyclingSpeedCadenceService] }],
    optionalServices: [BLE_UUIDS.cyclingSpeedCadenceService],
  },
};

export function isWebBluetoothAvailable(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.bluetooth?.requestDevice === 'function';
}

type Timed = { value: number; at: number };

/**
 * Owns trainer, heart-rate and cadence connections. Disconnects never throw into the
 * ride: the manager reports status and keeps reconnecting with exponential backoff.
 */
export class RideDeviceManager {
  private devices: Partial<Record<RideDeviceRole, BluetoothDevice>> = {};
  private manualDisconnect = new Set<RideDeviceRole>();
  private reconnectTimers: Partial<Record<RideDeviceRole, ReturnType<typeof setTimeout>>> = {};
  private reconnectAttempts: Partial<Record<RideDeviceRole, number>> = {};
  private snapshot: RideDevicesSnapshot = { trainer: emptyDevice, heartRate: emptyDevice, cadence: emptyDevice, ergAvailable: false };
  private listeners = new Set<() => void>();
  private controlPoint: BluetoothRemoteGATTCharacteristic | null = null;
  private controlGranted = false;
  private writeQueue: Promise<void> = Promise.resolve();
  private desiredCommand: ErgCommand | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  private power: Timed | null = null;
  private trainerCadence: Timed | null = null;
  private sensorCadence: Timed | null = null;
  private trainerHeartRate: Timed | null = null;
  private strapHeartRate: Timed | null = null;
  private trainerSpeed: Timed | null = null;
  private wheelSpeed: Timed | null = null;
  private lastCrank: Partial<Record<'trainer' | 'cadence', { data: CrankData; changedAt: number }>> = {};
  private lastWheel: WheelData | null = null;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getSnapshot = () => this.snapshot;

  private update(role: RideDeviceRole, patch: Partial<RideDeviceState>, ergAvailable = this.snapshot.ergAvailable) {
    this.snapshot = { ...this.snapshot, [role]: { ...this.snapshot[role], ...patch }, ergAvailable };
    for (const listener of this.listeners) listener();
  }

  /** Latest fresh values. Strap heart rate and cadence sensors win over trainer-reported values. */
  getReading(now = Date.now()): RideReading {
    const fresh = (value: Timed | null) => value && now - value.at <= STALE_MS ? value.value : null;
    return {
      powerWatts: fresh(this.power),
      heartRateBpm: fresh(this.strapHeartRate) ?? fresh(this.trainerHeartRate),
      cadenceRpm: fresh(this.sensorCadence) ?? fresh(this.trainerCadence),
      speedMetersPerSecond: fresh(this.trainerSpeed) ?? fresh(this.wheelSpeed),
    };
  }

  /** Must be called from a user gesture (button click). */
  async connect(role: RideDeviceRole): Promise<void> {
    if (!isWebBluetoothAvailable()) {
      this.update(role, { status: 'error', message: 'Bluetooth is not available in this browser.' });
      return;
    }
    let device: BluetoothDevice;
    try {
      device = await navigator.bluetooth!.requestDevice(REQUEST_OPTIONS[role]);
    } catch (error) {
      // NotFoundError means the chooser was cancelled; keep the previous state.
      if (error instanceof DOMException && error.name === 'NotFoundError') return;
      this.update(role, { status: 'error', message: error instanceof Error ? error.message : 'Could not open the Bluetooth chooser.' });
      return;
    }
    const previous = this.devices[role];
    if (previous && previous !== device) this.disconnect(role);
    this.manualDisconnect.delete(role);
    this.devices[role] = device;
    device.addEventListener('gattserverdisconnected', () => this.handleDisconnect(role, device));
    this.update(role, { status: 'connecting', name: device.name ?? 'Unnamed device', message: null });
    try {
      await this.setup(role, device);
      this.reconnectAttempts[role] = 0;
      this.update(role, { status: 'connected', message: null });
    } catch (error) {
      this.update(role, { status: 'error', message: error instanceof Error ? error.message : 'Could not connect.' });
      device.gatt?.disconnect();
    }
  }

  disconnect(role: RideDeviceRole) {
    this.manualDisconnect.add(role);
    clearTimeout(this.reconnectTimers[role]);
    this.devices[role]?.gatt?.disconnect();
    delete this.devices[role];
    if (role === 'trainer') {
      this.controlPoint = null;
      this.controlGranted = false;
    }
    this.update(role, { ...emptyDevice }, role === 'trainer' ? false : this.snapshot.ergAvailable);
  }

  dispose() {
    this.disposed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    for (const role of Object.keys(this.devices) as RideDeviceRole[]) this.disconnect(role);
    this.listeners.clear();
  }

  /** Records the desired trainer mode and pushes it now, or after the next (re)connect. */
  setCommand(command: ErgCommand | null) {
    this.desiredCommand = command;
    this.pushCommand(0);
  }

  private handleDisconnect(role: RideDeviceRole, device: BluetoothDevice) {
    if (this.devices[role] !== device || this.manualDisconnect.has(role) || this.disposed) return;
    if (role === 'trainer') {
      this.controlPoint = null;
      this.controlGranted = false;
    }
    this.update(role, { status: 'reconnecting', message: 'Connection lost. Reconnecting…' });
    this.scheduleReconnect(role, device);
  }

  private scheduleReconnect(role: RideDeviceRole, device: BluetoothDevice) {
    const attempt = this.reconnectAttempts[role] ?? 0;
    const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt);
    this.reconnectAttempts[role] = attempt + 1;
    clearTimeout(this.reconnectTimers[role]);
    this.reconnectTimers[role] = setTimeout(async () => {
      if (this.devices[role] !== device || this.manualDisconnect.has(role) || this.disposed) return;
      try {
        await this.setup(role, device);
        this.reconnectAttempts[role] = 0;
        this.update(role, { status: 'connected', message: null });
        if (role === 'trainer') this.pushCommand(0);
      } catch {
        this.update(role, { status: 'reconnecting', message: `Reconnecting… next try in ${Math.round(Math.min(MAX_BACKOFF_MS, 1000 * 2 ** (attempt + 1)) / 1000)} s` });
        this.scheduleReconnect(role, device);
      }
    }, delay);
  }

  private async setup(role: RideDeviceRole, device: BluetoothDevice) {
    const server = await device.gatt?.connect();
    if (!server) throw new Error('This device does not support GATT connections.');
    if (role === 'heartRate') {
      const characteristic = await (await server.getPrimaryService(BLE_UUIDS.heartRateService)).getCharacteristic(BLE_UUIDS.heartRateMeasurement);
      this.listen(characteristic, (data) => { this.strapHeartRate = { value: parseHeartRateMeasurement(data), at: Date.now() }; });
      this.update(role, { protocol: 'heart-rate' });
      return;
    }
    if (role === 'cadence') {
      const characteristic = await (await server.getPrimaryService(BLE_UUIDS.cyclingSpeedCadenceService)).getCharacteristic(BLE_UUIDS.cscMeasurement);
      this.listen(characteristic, (data) => {
        const measurement = parseCscMeasurement(data);
        if (measurement.crank) this.handleCrank('cadence', measurement.crank);
        if (measurement.wheel) {
          const speed = speedFromWheel(this.lastWheel, measurement.wheel, WHEEL_CIRCUMFERENCE_M, 1024);
          this.lastWheel = measurement.wheel;
          if (speed !== null) this.wheelSpeed = { value: speed, at: Date.now() };
        }
      });
      this.update(role, { protocol: 'csc' });
      return;
    }

    const ftms = await server.getPrimaryService(BLE_UUIDS.fitnessMachineService).catch(() => null);
    if (ftms) {
      const data = await ftms.getCharacteristic(BLE_UUIDS.indoorBikeData);
      this.listen(data, (value) => {
        const parsed = parseIndoorBikeData(value);
        const now = Date.now();
        if (parsed.powerWatts !== null) this.power = { value: Math.max(0, parsed.powerWatts), at: now };
        if (parsed.cadenceRpm !== null) this.trainerCadence = { value: parsed.cadenceRpm, at: now };
        if (parsed.speedKmh !== null) this.trainerSpeed = { value: parsed.speedKmh / 3.6, at: now };
        if (parsed.heartRateBpm) this.trainerHeartRate = { value: parsed.heartRateBpm, at: now };
      });
      const control = await ftms.getCharacteristic(BLE_UUIDS.fitnessMachineControlPoint).catch(() => null);
      if (control) {
        this.listen(control, (value) => {
          const response = parseControlPointResponse(value);
          if (response?.result === 'control-not-permitted') this.controlGranted = false;
        });
        this.controlPoint = control;
        await this.requestControl();
      }
      this.update('trainer', { protocol: 'ftms' }, control !== null);
      return;
    }
    const power = await (await server.getPrimaryService(BLE_UUIDS.cyclingPowerService)).getCharacteristic(BLE_UUIDS.cyclingPowerMeasurement);
    this.listen(power, (value) => {
      const parsed = parseCyclingPowerMeasurement(value);
      this.power = { value: Math.max(0, parsed.powerWatts), at: Date.now() };
      if (parsed.crank) this.handleCrank('trainer', parsed.crank);
    });
    this.update('trainer', { protocol: 'cycling-power' }, false);
  }

  private handleCrank(source: 'trainer' | 'cadence', crank: CrankData) {
    const now = Date.now();
    const previous = this.lastCrank[source];
    const cadence = cadenceFromCrank(previous?.data ?? null, crank);
    const changed = !previous || previous.data.eventTime1024 !== crank.eventTime1024;
    this.lastCrank[source] = { data: crank, changedAt: changed ? now : previous.changedAt };
    // Sensors keep sending the last crank event while coasting; report 0 rpm after a pause.
    const value = cadence ?? (previous && now - previous.changedAt > 2500 ? 0 : null);
    if (value === null) return;
    if (source === 'cadence') this.sensorCadence = { value, at: now };
    else this.trainerCadence = { value, at: now };
  }

  private listen(characteristic: BluetoothRemoteGATTCharacteristic, onValue: (value: DataView) => void) {
    characteristic.addEventListener('characteristicvaluechanged', (event) => {
      const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
      if (!value) return;
      try {
        onValue(value);
      } catch {
        // A malformed packet is dropped; the next notification replaces it.
      }
    });
    return characteristic.startNotifications();
  }

  private write(bytes: Uint8Array) {
    const control = this.controlPoint;
    const task = this.writeQueue.then(async () => {
      if (!control) throw new Error('Trainer control is unavailable.');
      const buffer = bytes.slice().buffer;
      await (control.writeValueWithResponse ? control.writeValueWithResponse(buffer) : control.writeValue(buffer));
    });
    // GATT allows one operation at a time; keep the queue alive after failures.
    this.writeQueue = task.catch(() => undefined);
    return task;
  }

  private async requestControl() {
    await this.write(encodeRequestControl());
    await this.write(encodeStartOrResume());
    this.controlGranted = true;
  }

  private pushCommand(attempt: number) {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    const command = this.desiredCommand;
    if (!command || !this.controlPoint || this.disposed) return;
    const send = async () => {
      if (!this.controlGranted) await this.requestControl();
      await this.write(command.mode === 'erg' ? encodeSetTargetPower(command.watts) : encodeSetIndoorBikeSimulation());
    };
    send().catch(() => {
      if (attempt + 1 >= WRITE_RETRY_LIMIT || this.desiredCommand !== command) return;
      this.controlGranted = false;
      this.retryTimer = setTimeout(() => this.pushCommand(attempt + 1), 2000);
    });
  }
}
