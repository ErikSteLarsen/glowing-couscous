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
  type FtmsControlResponse,
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
const CRANK_IDLE_MS = 2500;
const CONTROL_RESPONSE_TIMEOUT_MS = 5000;
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
type Connection = {
  device: BluetoothDevice;
  lifetime: AbortController;
  notifications?: AbortController;
};
type TrainerControl = {
  characteristic: BluetoothRemoteGATTCharacteristic;
  signal: AbortSignal;
  granted: boolean;
  busy: boolean;
  onResponse?: (response: FtmsControlResponse) => void;
};

/**
 * Owns trainer, heart-rate and cadence connections. Disconnects never throw into the
 * ride: the manager reports status and keeps reconnecting with exponential backoff.
 */
export class RideDeviceManager {
  private connections: Partial<Record<RideDeviceRole, Connection>> = {};
  private chooser: symbol | null = null;
  private reconnectTimers: Partial<Record<RideDeviceRole, ReturnType<typeof setTimeout>>> = {};
  private reconnectAttempts: Partial<Record<RideDeviceRole, number>> = {};
  private snapshot: RideDevicesSnapshot = { trainer: emptyDevice, heartRate: emptyDevice, cadence: emptyDevice, ergAvailable: false };
  private listeners = new Set<() => void>();
  private control: TrainerControl | null = null;
  private readingListeners = new Set<(now: number) => void>();
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

  subscribeReadings(listener: (now: number) => void) {
    this.readingListeners.add(listener);
    return () => { this.readingListeners.delete(listener); };
  }

  private update(role: RideDeviceRole, patch: Partial<RideDeviceState>, ergAvailable = this.snapshot.ergAvailable) {
    this.snapshot = { ...this.snapshot, [role]: { ...this.snapshot[role], ...patch }, ergAvailable };
    for (const listener of this.listeners) listener();
  }

  /** Latest fresh values. Strap heart rate and cadence sensors win over trainer-reported values. */
  getReading(now = Date.now()): RideReading {
    const fresh = (value: Timed | null) => value && now - value.at <= STALE_MS ? value.value : null;
    const cadence = (source: 'trainer' | 'cadence', value: Timed | null) => {
      const crank = this.lastCrank[source];
      return crank && now - crank.changedAt >= CRANK_IDLE_MS ? 0 : fresh(value);
    };
    return {
      powerWatts: fresh(this.power),
      heartRateBpm: fresh(this.strapHeartRate) ?? fresh(this.trainerHeartRate),
      cadenceRpm: cadence('cadence', this.sensorCadence) ?? cadence('trainer', this.trainerCadence),
      speedMetersPerSecond: fresh(this.trainerSpeed) ?? fresh(this.wheelSpeed),
    };
  }

  /** Must be called from a user gesture (button click). */
  async connect(role: RideDeviceRole): Promise<void> {
    if (this.disposed || this.chooser || this.snapshot[role].status === 'connecting') return;
    if (!isWebBluetoothAvailable()) {
      this.update(role, { status: 'error', message: 'Bluetooth is not available in this browser.' });
      return;
    }
    const chooser = Symbol();
    this.chooser = chooser;
    let device: BluetoothDevice;
    try {
      device = await navigator.bluetooth!.requestDevice(REQUEST_OPTIONS[role]);
    } catch (error) {
      if (this.chooser !== chooser) return;
      this.chooser = null;
      if (error instanceof DOMException && error.name === 'NotFoundError') return;
      this.update(role, { status: 'error', message: error instanceof Error ? error.message : 'Could not open the Bluetooth chooser.' });
      return;
    }
    if (this.chooser !== chooser) return;
    this.chooser = null;
    this.disconnect(role);

    const connection: Connection = { device, lifetime: new AbortController() };
    const { signal } = connection.lifetime;
    this.connections[role] = connection;
    device.addEventListener('gattserverdisconnected', () => this.handleDisconnect(role, connection), { signal });
    this.update(role, { status: 'connecting', name: device.name ?? 'Unnamed device', message: null });
    try {
      await this.connectGatt(role, connection);
    } catch (error) {
      if (signal.aborted || this.snapshot[role].status === 'reconnecting') return;
      this.disconnect(role);
      this.update(role, { status: 'error', name: device.name ?? null, message: error instanceof Error ? error.message : 'Could not connect.' });
    }
  }

  disconnect(role: RideDeviceRole) {
    const connection = this.connections[role];
    delete this.connections[role];
    connection?.lifetime.abort();
    this.clearConnection(role, connection);
    this.reconnectAttempts[role] = 0;
    connection?.device.gatt?.disconnect();
    this.update(role, { ...emptyDevice }, role === 'trainer' ? false : this.snapshot.ergAvailable);
  }

  activate() {
    this.disposed = false;
  }

  dispose() {
    this.disposed = true;
    this.chooser = null;
    for (const role of Object.keys(this.connections) as RideDeviceRole[]) this.disconnect(role);
  }

  private clearConnection(role: RideDeviceRole, connection?: Connection) {
    connection?.notifications?.abort();
    clearTimeout(this.reconnectTimers[role]);
    if (role === 'trainer') {
      if (this.retryTimer) clearTimeout(this.retryTimer);
      this.retryTimer = null;
      this.control = null;
      this.power = this.trainerCadence = this.trainerSpeed = this.trainerHeartRate = null;
      delete this.lastCrank.trainer;
    } else if (role === 'cadence') {
      this.lastWheel = this.sensorCadence = this.wheelSpeed = null;
      delete this.lastCrank.cadence;
    } else {
      this.strapHeartRate = null;
    }
  }

  /** Records the desired trainer mode and pushes it now, or after the next (re)connect. */
  setCommand(command: ErgCommand | null) {
    this.desiredCommand = command;
    this.pushCommand(0);
  }

  private handleDisconnect(role: RideDeviceRole, connection: Connection) {
    this.clearConnection(role, connection);
    this.update(role, { status: 'reconnecting', message: 'Connection lost. Reconnecting…' }, role === 'trainer' ? false : this.snapshot.ergAvailable);
    this.scheduleReconnect(role, connection);
  }

  private scheduleReconnect(role: RideDeviceRole, connection: Connection) {
    const attempt = this.reconnectAttempts[role] ?? 0;
    const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt);
    this.reconnectAttempts[role] = attempt + 1;
    this.reconnectTimers[role] = setTimeout(async () => {
      if (connection.lifetime.signal.aborted) return;
      try {
        await this.connectGatt(role, connection);
      } catch {
        if (connection.lifetime.signal.aborted || connection.notifications?.signal.aborted) return;
        this.clearConnection(role, connection);
        this.update(role, { status: 'reconnecting', message: 'Could not reconnect. Retrying…' });
        this.scheduleReconnect(role, connection);
      }
    }, delay);
  }

  private async connectGatt(role: RideDeviceRole, connection: Connection) {
    const notifications = new AbortController();
    connection.notifications = notifications;
    const { signal } = notifications;
    const server = await connection.device.gatt?.connect();
    if (signal.aborted && !this.connections[role]) connection.device.gatt?.disconnect();
    signal.throwIfAborted();
    if (!server) throw new Error('This device does not support GATT connections.');
    const protocol = await this.setup(role, server, signal);
    signal.throwIfAborted();
    this.reconnectAttempts[role] = 0;
    this.update(role, { status: 'connected', protocol, message: null }, this.control !== null);
    if (role === 'trainer') this.pushCommand(0);
  }

  private async setup(role: RideDeviceRole, server: BluetoothRemoteGATTServer, signal: AbortSignal): Promise<RideDeviceState['protocol']> {
    if (role === 'heartRate') {
      const characteristic = await (await server.getPrimaryService(BLE_UUIDS.heartRateService)).getCharacteristic(BLE_UUIDS.heartRateMeasurement);
      await this.listen(characteristic, signal, (data) => {
        const value = parseHeartRateMeasurement(data);
        this.strapHeartRate = value ? { value, at: Date.now() } : null;
      });
      return 'heart-rate';
    }
    if (role === 'cadence') {
      const characteristic = await (await server.getPrimaryService(BLE_UUIDS.cyclingSpeedCadenceService)).getCharacteristic(BLE_UUIDS.cscMeasurement);
      await this.listen(characteristic, signal, (data) => {
        const measurement = parseCscMeasurement(data);
        if (measurement.crank) this.handleCrank('cadence', measurement.crank);
        if (measurement.wheel) {
          const speed = speedFromWheel(this.lastWheel, measurement.wheel, WHEEL_CIRCUMFERENCE_M, 1024);
          this.lastWheel = measurement.wheel;
          if (speed !== null) this.wheelSpeed = { value: speed, at: Date.now() };
        }
      });
      return 'csc';
    }

    const ftms = await server.getPrimaryService(BLE_UUIDS.fitnessMachineService).catch(() => null);
    if (ftms) {
      const data = await ftms.getCharacteristic(BLE_UUIDS.indoorBikeData);
      await this.listen(data, signal, (value) => {
        const parsed = parseIndoorBikeData(value);
        const now = Date.now();
        if (parsed.powerWatts !== null) this.power = { value: Math.max(0, parsed.powerWatts), at: now };
        if (parsed.cadenceRpm !== null) this.trainerCadence = { value: parsed.cadenceRpm, at: now };
        if (parsed.speedKmh !== null) this.trainerSpeed = { value: parsed.speedKmh / 3.6, at: now };
        if (parsed.heartRateBpm) this.trainerHeartRate = { value: parsed.heartRateBpm, at: now };
      });
      const control = await ftms.getCharacteristic(BLE_UUIDS.fitnessMachineControlPoint).catch(() => null);
      if (control) {
        const state: TrainerControl = { characteristic: control, signal, granted: false, busy: false };
        await this.listen(control, signal, (value) => {
          const response = parseControlPointResponse(value);
          if (response) state.onResponse?.(response);
        }, false);
        signal.throwIfAborted();
        this.control = state;
      }
      return 'ftms';
    }
    const power = await (await server.getPrimaryService(BLE_UUIDS.cyclingPowerService)).getCharacteristic(BLE_UUIDS.cyclingPowerMeasurement);
    await this.listen(power, signal, (value) => {
      const parsed = parseCyclingPowerMeasurement(value);
      this.power = { value: Math.max(0, parsed.powerWatts), at: Date.now() };
      if (parsed.crank) this.handleCrank('trainer', parsed.crank);
    });
    return 'cycling-power';
  }

  private handleCrank(source: 'trainer' | 'cadence', crank: CrankData) {
    const now = Date.now();
    const previous = this.lastCrank[source];
    const cadence = cadenceFromCrank(previous?.data ?? null, crank);
    if (!previous || previous.data.eventTime1024 !== crank.eventTime1024 || previous.data.revolutions !== crank.revolutions) {
      this.lastCrank[source] = { data: crank, changedAt: now };
    }
    if (cadence === null) return;
    if (source === 'cadence') this.sensorCadence = { value: cadence, at: now };
    else this.trainerCadence = { value: cadence, at: now };
  }

  private listen(characteristic: BluetoothRemoteGATTCharacteristic, signal: AbortSignal, onValue: (value: DataView) => void, telemetry = true) {
    signal.throwIfAborted();
    characteristic.addEventListener('characteristicvaluechanged', () => {
      if (!characteristic.value) return;
      try {
        onValue(characteristic.value);
      } catch {
        // A malformed packet is dropped; the next notification replaces it.
        return;
      }
      if (telemetry) {
        const now = Date.now();
        for (const listener of this.readingListeners) listener(now);
      }
    }, { signal });
    return characteristic.startNotifications();
  }

  private async procedure(control: TrainerControl, bytes: Uint8Array) {
    const { characteristic, signal } = control;
    signal.throwIfAborted();
    const { promise, resolve, reject } = Promise.withResolvers<FtmsControlResponse['result']>();
    const abort = () => reject(signal.reason);
    const timer = setTimeout(() => reject(new Error('Trainer did not acknowledge the FTMS command.')), CONTROL_RESPONSE_TIMEOUT_MS);
    signal.addEventListener('abort', abort, { once: true });
    control.onResponse = (response) => {
      if (response.requestOpcode === bytes[0]) resolve(response.result);
    };

    try {
      const write = Promise.resolve().then(() => {
        signal.throwIfAborted();
        const buffer = bytes.slice().buffer;
        return characteristic.writeValueWithResponse ? characteristic.writeValueWithResponse(buffer) : characteristic.writeValue(buffer);
      });
      const [, result] = await Promise.all([write, promise]);
      signal.throwIfAborted();
      return result;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      control.onResponse = undefined;
    }
  }

  private pushCommand(attempt: number) {
    const control = this.control;
    if (!control || control.busy || !this.desiredCommand) return;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    control.busy = true;

    const send = async () => {
      let command = this.desiredCommand;
      try {
        if (!control.granted) {
          const request = await this.procedure(control, encodeRequestControl());
          if (request !== 'success') throw new Error('Trainer did not grant FTMS control.');
          const start = await this.procedure(control, encodeStartOrResume());
          if (start === 'control-not-permitted') throw new Error('Trainer revoked FTMS control.');
          control.granted = true;
        }
        command = this.desiredCommand;
        if (!command) return;
        const result = await this.procedure(control, command.mode === 'erg' ? encodeSetTargetPower(command.watts) : encodeSetIndoorBikeSimulation());
        if (result !== 'success') throw new Error('Trainer rejected the FTMS target.');
      } catch {
        control.granted = false;
        if (this.control === control && this.desiredCommand === command && attempt + 1 < WRITE_RETRY_LIMIT) {
          this.retryTimer = setTimeout(() => this.pushCommand(attempt + 1), 2000);
        }
      } finally {
        control.busy = false;
        if (this.control === control && this.desiredCommand !== command) this.pushCommand(0);
      }
    };
    void send();
  }
}
