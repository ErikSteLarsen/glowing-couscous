/** FTMS Control Point (0x2AD9) request encoders and response parsing. */

export const FTMS_OPCODES = {
  requestControl: 0x00,
  reset: 0x01,
  setTargetResistance: 0x04,
  setTargetPower: 0x05,
  startOrResume: 0x07,
  stopOrPause: 0x08,
  setIndoorBikeSimulation: 0x11,
  responseCode: 0x80,
} as const;

export type FtmsResultCode = 'success' | 'not-supported' | 'invalid-parameter' | 'operation-failed' | 'control-not-permitted' | 'unknown';

const RESULT_CODES: Record<number, FtmsResultCode> = {
  0x01: 'success',
  0x02: 'not-supported',
  0x03: 'invalid-parameter',
  0x04: 'operation-failed',
  0x05: 'control-not-permitted',
};

function clampInt(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function encodeRequestControl(): Uint8Array {
  return Uint8Array.of(FTMS_OPCODES.requestControl);
}

export function encodeReset(): Uint8Array {
  return Uint8Array.of(FTMS_OPCODES.reset);
}

export function encodeStartOrResume(): Uint8Array {
  return Uint8Array.of(FTMS_OPCODES.startOrResume);
}

/** Stop (1) or pause (2). */
export function encodeStopOrPause(mode: 'stop' | 'pause'): Uint8Array {
  return Uint8Array.of(FTMS_OPCODES.stopOrPause, mode === 'stop' ? 0x01 : 0x02);
}

/** ERG target in watts as uint16. */
export function encodeSetTargetPower(watts: number): Uint8Array {
  const value = clampInt(watts, 0, 0xffff);
  return Uint8Array.of(FTMS_OPCODES.setTargetPower, value & 0xff, value >> 8);
}

/** Target resistance level, uint8 with 0.1 resolution (unitless). */
export function encodeSetTargetResistance(level: number): Uint8Array {
  return Uint8Array.of(FTMS_OPCODES.setTargetResistance, clampInt(level * 10, 0, 0xff));
}

export type IndoorBikeSimulation = {
  windSpeedMps?: number;
  gradePercent?: number;
  rollingResistance?: number;
  windResistanceKgPerM?: number;
};

/** Indoor bike simulation parameters used for free ride (flat road) or slope mode. */
export function encodeSetIndoorBikeSimulation({ windSpeedMps = 0, gradePercent = 0, rollingResistance = 0.004, windResistanceKgPerM = 0.51 }: IndoorBikeSimulation = {}): Uint8Array {
  const bytes = new Uint8Array(7);
  const data = new DataView(bytes.buffer);
  data.setUint8(0, FTMS_OPCODES.setIndoorBikeSimulation);
  data.setInt16(1, clampInt(windSpeedMps * 1000, -32768, 32767), true);
  data.setInt16(3, clampInt(gradePercent * 100, -32768, 32767), true);
  data.setUint8(5, clampInt(rollingResistance * 10000, 0, 0xff));
  data.setUint8(6, clampInt(windResistanceKgPerM * 100, 0, 0xff));
  return bytes;
}

export type FtmsControlResponse = { requestOpcode: number; result: FtmsResultCode };

/** Parses a control point indication; returns null for anything that is not a 0x80 response. */
export function parseControlPointResponse(input: DataView | ArrayBuffer | Uint8Array): FtmsControlResponse | null {
  const bytes = input instanceof Uint8Array ? input : input instanceof DataView ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength) : new Uint8Array(input);
  if (bytes.length < 3 || bytes[0] !== FTMS_OPCODES.responseCode) return null;
  return { requestOpcode: bytes[1], result: RESULT_CODES[bytes[2]] ?? 'unknown' };
}
