/** Pure decoders for Bluetooth SIG fitness characteristics. All values are little-endian. */

export const BLE_UUIDS = {
  fitnessMachineService: 0x1826,
  cyclingPowerService: 0x1818,
  cyclingSpeedCadenceService: 0x1816,
  heartRateService: 0x180d,
  indoorBikeData: 0x2ad2,
  fitnessMachineControlPoint: 0x2ad9,
  fitnessMachineFeature: 0x2acc,
  fitnessMachineStatus: 0x2ada,
  cyclingPowerMeasurement: 0x2a63,
  cscMeasurement: 0x2a5b,
  heartRateMeasurement: 0x2a37,
} as const;

export type IndoorBikeData = {
  speedKmh: number | null;
  averageSpeedKmh: number | null;
  cadenceRpm: number | null;
  averageCadenceRpm: number | null;
  totalDistanceMeters: number | null;
  resistanceLevel: number | null;
  powerWatts: number | null;
  averagePowerWatts: number | null;
  totalEnergyKcal: number | null;
  energyPerHourKcal: number | null;
  energyPerMinuteKcal: number | null;
  heartRateBpm: number | null;
  metabolicEquivalent: number | null;
  elapsedSec: number | null;
  remainingSec: number | null;
};

function view(input: DataView | ArrayBuffer | Uint8Array): DataView {
  if (input instanceof DataView) return input;
  if (input instanceof Uint8Array) return new DataView(input.buffer, input.byteOffset, input.byteLength);
  return new DataView(input);
}

/** Sequential reader that throws a RangeError on truncated packets. */
class Cursor {
  offset = 0;
  readonly data: DataView;
  constructor(data: DataView) { this.data = data; }
  private take(bytes: number) {
    if (this.offset + bytes > this.data.byteLength) throw new RangeError('Truncated BLE packet');
    const at = this.offset;
    this.offset += bytes;
    return at;
  }
  u8() { return this.data.getUint8(this.take(1)); }
  u16() { return this.data.getUint16(this.take(2), true); }
  s16() { return this.data.getInt16(this.take(2), true); }
  u24() { const at = this.take(3); return this.data.getUint16(at, true) + (this.data.getUint8(at + 2) << 16); }
  u32() { return this.data.getUint32(this.take(4), true); }
}

const FTMS_FIELD_WIDTHS_AFTER_RESISTANCE = [2, 2, 5, 1, 1, 2, 2];

/** FTMS Indoor Bike Data (0x2AD2). Bit 0 ("More Data") is inverted: instantaneous speed is present when it is 0. */
export function parseIndoorBikeData(input: DataView | ArrayBuffer | Uint8Array): IndoorBikeData {
  const c = new Cursor(view(input));
  const flags = c.u16();
  const has = (bit: number) => (flags & (1 << bit)) !== 0;
  const result: IndoorBikeData = {
    speedKmh: null, averageSpeedKmh: null, cadenceRpm: null, averageCadenceRpm: null, totalDistanceMeters: null,
    resistanceLevel: null, powerWatts: null, averagePowerWatts: null, totalEnergyKcal: null, energyPerHourKcal: null,
    energyPerMinuteKcal: null, heartRateBpm: null, metabolicEquivalent: null, elapsedSec: null, remainingSec: null,
  };
  if (!has(0)) result.speedKmh = c.u16() / 100;
  if (has(1)) result.averageSpeedKmh = c.u16() / 100;
  if (has(2)) result.cadenceRpm = c.u16() / 2;
  if (has(3)) result.averageCadenceRpm = c.u16() / 2;
  if (has(4)) result.totalDistanceMeters = c.u24();
  if (has(5)) {
    // GSS defines uint8. Older trainers use sint16, which adds one byte to the packet.
    const trailingBytes = FTMS_FIELD_WIDTHS_AFTER_RESISTANCE.reduce((total, width, index) => has(6 + index) ? total + width : total, 0);
    result.resistanceLevel = c.data.byteLength === c.offset + trailingBytes + 2 ? c.s16() : c.u8();
  }
  if (has(6)) result.powerWatts = c.s16();
  if (has(7)) result.averagePowerWatts = c.s16();
  if (has(8)) {
    const total = c.u16();
    const perHour = c.u16();
    const perMinute = c.u8();
    // 0xFFFF / 0xFF mean "not available" per the FTMS specification.
    result.totalEnergyKcal = total === 0xffff ? null : total;
    result.energyPerHourKcal = perHour === 0xffff ? null : perHour;
    result.energyPerMinuteKcal = perMinute === 0xff ? null : perMinute;
  }
  if (has(9)) result.heartRateBpm = c.u8();
  if (has(10)) result.metabolicEquivalent = c.u8() / 10;
  if (has(11)) result.elapsedSec = c.u16();
  if (has(12)) result.remainingSec = c.u16();
  return result;
}

export type CrankData = { revolutions: number; eventTime1024: number };
export type WheelData = { revolutions: number; eventTime: number };

export type CyclingPowerMeasurement = {
  powerWatts: number;
  wheel: WheelData | null;
  crank: CrankData | null;
};

/** Cycling Power Measurement (0x2A63). Wheel event time is 1/2048 s; crank event time is 1/1024 s. */
export function parseCyclingPowerMeasurement(input: DataView | ArrayBuffer | Uint8Array): CyclingPowerMeasurement {
  const c = new Cursor(view(input));
  const flags = c.u16();
  const has = (bit: number) => (flags & (1 << bit)) !== 0;
  const powerWatts = c.s16();
  if (has(0)) c.u8(); // pedal power balance
  if (has(2)) c.u16(); // accumulated torque
  const wheel = has(4) ? { revolutions: c.u32(), eventTime: c.u16() } : null;
  const crank = has(5) ? { revolutions: c.u16(), eventTime1024: c.u16() } : null;
  return { powerWatts, wheel, crank };
}

export type CscMeasurement = { wheel: WheelData | null; crank: CrankData | null };

/** CSC Measurement (0x2A5B). Both event times are 1/1024 s. */
export function parseCscMeasurement(input: DataView | ArrayBuffer | Uint8Array): CscMeasurement {
  const c = new Cursor(view(input));
  const flags = c.u8();
  const wheel = flags & 0x01 ? { revolutions: c.u32(), eventTime: c.u16() } : null;
  const crank = flags & 0x02 ? { revolutions: c.u16(), eventTime1024: c.u16() } : null;
  return { wheel, crank };
}

/** Heart Rate Measurement (0x2A37): uint8 or uint16 value selected by flag bit 0. */
export function parseHeartRateMeasurement(input: DataView | ArrayBuffer | Uint8Array): number | null {
  const c = new Cursor(view(input));
  const flags = c.u8();
  const bpm = flags & 0x01 ? c.u16() : c.u8();
  return (flags & 0x06) === 0x04 ? null : bpm;
}

/**
 * Cadence from two cumulative crank readings with uint16 rollover on both counters.
 * Returns null when no new crank event happened (same event time), so callers keep the last value.
 */
export function cadenceFromCrank(previous: CrankData | null, current: CrankData): number | null {
  if (!previous) return null;
  const revolutions = (current.revolutions - previous.revolutions + 0x10000) % 0x10000;
  const ticks = (current.eventTime1024 - previous.eventTime1024 + 0x10000) % 0x10000;
  if (ticks === 0) return null;
  const rpm = (revolutions * 60 * 1024) / ticks;
  // Discard implausible spikes from dropped packets or sensor resets.
  return rpm > 250 ? null : Math.round(rpm * 10) / 10;
}

/** Wheel speed in m/s from two cumulative wheel readings (uint32 revolutions, uint16 time). */
export function speedFromWheel(previous: WheelData | null, current: WheelData, circumferenceMeters: number, timeResolution: 1024 | 2048): number | null {
  if (!previous) return null;
  const revolutions = (current.revolutions - previous.revolutions + 0x100000000) % 0x100000000;
  const ticks = (current.eventTime - previous.eventTime + 0x10000) % 0x10000;
  if (ticks === 0) return null;
  const speed = (revolutions * circumferenceMeters * timeResolution) / ticks;
  return speed > 50 ? null : speed;
}
