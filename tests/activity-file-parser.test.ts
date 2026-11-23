import assert from 'node:assert/strict';
import test from 'node:test';
import { parseActivityFile } from '../lib/activity-file-parser.ts';

test('parses TCX activity metadata and sensor samples with namespaces', () => {
  const tcx = `<?xml version="1.0"?><TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" xmlns:ns3="urn:sample"><Activities><Activity Sport="Running"><Id>2026-09-25T10:00:00Z</Id><Lap StartTime="2026-09-25T10:00:00Z"><TotalTimeSeconds>120</TotalTimeSeconds><DistanceMeters>400</DistanceMeters><Track><Trackpoint><Time>2026-09-25T10:00:00Z</Time><Position><LatitudeDegrees>59.9</LatitudeDegrees><LongitudeDegrees>10.7</LongitudeDegrees></Position><AltitudeMeters>82</AltitudeMeters><DistanceMeters>0</DistanceMeters><HeartRateBpm><Value>130</Value></HeartRateBpm><Cadence>82</Cadence><Extensions><ns3:Speed>3.2</ns3:Speed><ns3:Watts>210</ns3:Watts></Extensions></Trackpoint><Trackpoint><Time>2026-09-25T10:02:00Z</Time><Position><LatitudeDegrees>59.901</LatitudeDegrees><LongitudeDegrees>10.701</LongitudeDegrees></Position><AltitudeMeters>86</AltitudeMeters><DistanceMeters>400</DistanceMeters><HeartRateBpm><Value>150</Value></HeartRateBpm><Cadence>84</Cadence><Extensions><ns3:Speed>3.4</ns3:Speed><ns3:Watts>240</ns3:Watts></Extensions></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
  const parsed = parseActivityFile('morning.tcx', tcx);

  assert.equal(parsed.title, 'morning');
  assert.equal(parsed.sport, 'RUNNING');
  assert.equal(parsed.durationSec, 120);
  assert.equal(parsed.distanceMeters, 400);
  assert.equal(parsed.points[0].heartRateBpm, 130);
  assert.equal(parsed.points[1].speedMetersPerSecond, 3.4);
  assert.equal(parsed.points[1].powerWatts, 240);
  assert.equal(parsed.elevationGainMeters, 4);
  assert.deepEqual(parsed.laps, [{ startSec: 0, endSec: 120, timerSec: null, origin: 'device' }]);
  assert.equal('latitude' in parsed.points[0], false);
  assert.equal('longitude' in parsed.points[0], false);
});

test('parses GPX positions, extensions, elapsed time, and distance', () => {
  const gpx = `<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="urn:sample"><trk><name>Lunch &amp; loop</name><type>cycling</type><trkseg><trkpt lat="59.9" lon="10.7"><ele>80</ele><time>2026-09-25T10:00:00Z</time><extensions><gpxtpx:hr>125</gpxtpx:hr><gpxtpx:cad>90</gpxtpx:cad><gpxtpx:power>200</gpxtpx:power></extensions></trkpt><trkpt lat="59.901" lon="10.701"><ele>84</ele><time>2026-09-25T10:01:30Z</time><extensions><gpxtpx:hr>140</gpxtpx:hr></extensions></trkpt></trkseg></trk></gpx>`;
  const parsed = parseActivityFile('loop.gpx', gpx);

  assert.equal(parsed.title, 'Lunch & loop');
  assert.equal(parsed.sport, 'BIKING');
  assert.equal(parsed.durationSec, 90);
  assert.ok((parsed.distanceMeters ?? 0) > 100);
  assert.equal(parsed.points[1].elapsedSec, 90);
  assert.ok((parsed.points[1].speedMetersPerSecond ?? 0) > 0);
  assert.ok((parsed.points[1].gradePercent ?? 0) > 0);
  assert.equal(parsed.points[0].powerWatts, 200);
  assert.equal(parsed.elevationGainMeters, 4);
  assert.equal('latitude' in parsed.points[0], false);
  assert.equal('longitude' in parsed.points[0], false);
});

test('does not count the first elevation sample as climb when earlier data is missing', () => {
  const tcx = `<TrainingCenterDatabase><Activities><Activity Sport="Running"><Id>2026-09-25T10:00:00Z</Id><Lap><TotalTimeSeconds>60</TotalTimeSeconds><Track><Trackpoint><Time>2026-09-25T10:00:00Z</Time></Trackpoint><Trackpoint><Time>2026-09-25T10:00:30Z</Time><AltitudeMeters>86</AltitudeMeters></Trackpoint><Trackpoint><Time>2026-09-25T10:01:00Z</Time><AltitudeMeters>90</AltitudeMeters></Trackpoint></Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
  const parsed = parseActivityFile('partial-elevation.tcx', tcx);

  assert.equal(parsed.elevationGainMeters, 4);
});

test('decodes standard FIT session and record fields', () => {
  const bytes = buildFit([
    definition(1, 18, [[253, 4, 0x86], [5, 1, 0x00], [8, 4, 0x86], [9, 4, 0x86], [22, 2, 0x84]]),
    data(1, [1_000_000, 0, 120_000, 10_000, 15], [4, 1, 4, 4, 2]),
    definition(0, 20, [[253, 4, 0x86], [3, 1, 0x02], [5, 4, 0x86], [6, 2, 0x84], [2, 2, 0x84], [7, 2, 0x84]]),
    data(0, [1_000_000, 135, 0, 0, 2900, 220], [4, 1, 4, 2, 2, 2]),
    compressedData(0, 145, 10_000, 3000, 2920, 240),
  ]);
  const parsed = parseActivityFile('activity.fit', bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));

  assert.equal(parsed.sport, 'RUNNING');
  assert.equal(parsed.durationSec, 120);
  assert.equal(parsed.distanceMeters, 100);
  assert.equal(parsed.elevationGainMeters, 15);
  assert.equal(parsed.points.length, 2);
  assert.equal(parsed.points[0].heartRateBpm, 135);
  assert.equal(parsed.points[1].speedMetersPerSecond, 3);
  assert.equal(parsed.points[0].elevationMeters, 80);
  assert.equal(parsed.points[1].powerWatts, 240);
  assert.equal(parsed.points[1].elapsedSec, 32);
});

test('rejects unsupported and damaged activity files', () => {
  assert.throws(() => parseActivityFile('activity.csv', 'date,distance'), /Choose a \.FIT/);
  const damaged = new Uint8Array(14);
  assert.throws(() => parseActivityFile('activity.fit', damaged.buffer), /isn’t a FIT activity file/);
  const invalidChecksum = buildFit([definition(0, 20, [[253, 4, 0x86], [3, 1, 0x02]]), data(0, [100, 140], [4, 1])]);
  invalidChecksum[20] ^= 0xff;
  assert.throws(() => parseActivityFile('activity.fit', invalidChecksum.buffer), /FIT file is damaged/);
  assert.throws(() => parseActivityFile('activity.tcx', '<TrainingCenterDatabase/>'), /no recorded data/);
});

function definition(local: number, global: number, fields: Array<[number, number, number]>) {
  return [0x40 | local, 0, 0, global & 0xff, global >> 8, fields.length, ...fields.flat()];
}

function data(local: number, values: number[], widths: number[]) {
  return [local, ...values.flatMap((value, index) => Array.from({ length: widths[index] }, (_, byte) => (value >> (byte * 8)) & 0xff))];
}

function compressedData(offset: number, heartRate: number, distance: number, speed: number, altitude: number, power: number) {
  return [0x80 | offset, heartRate, ...[distance, speed, altitude, power].flatMap((value, index) => {
    const width = index === 0 ? 4 : 2;
    return Array.from({ length: width }, (_, byte) => (value >> (byte * 8)) & 0xff);
  })];
}

function buildFit(messages: number[][]) {
  const dataBytes = messages.flat();
  const bytes = new Uint8Array(14 + dataBytes.length + 2);
  bytes[0] = 14;
  bytes[1] = 0x20;
  bytes[2] = 0x20;
  bytes[3] = 0;
  new DataView(bytes.buffer).setUint32(4, dataBytes.length, true);
  bytes.set([0x2e, 0x46, 0x49, 0x54], 8);
  bytes.set(dataBytes, 14);
  const view = new DataView(bytes.buffer);
  view.setUint16(12, fitCrc(bytes, 0, 12), true);
  view.setUint16(14 + dataBytes.length, fitCrc(bytes, 0, 14 + dataBytes.length), true);
  return bytes;
}

function fitCrc(bytes: Uint8Array, start: number, end: number) {
  const table = [0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401, 0xa001, 0x6c00, 0x7800, 0xb401, 0x5000, 0x9c01, 0x8801, 0x4400];
  let crc = 0;
  for (let offset = start; offset < end; offset += 1) {
    const byte = bytes[offset];
    let value = table[crc & 0x0f];
    crc = ((crc >> 4) & 0x0fff) ^ value ^ table[byte & 0x0f];
    value = table[crc & 0x0f];
    crc = ((crc >> 4) & 0x0fff) ^ value ^ table[(byte >> 4) & 0x0f];
  }
  return crc;
}
