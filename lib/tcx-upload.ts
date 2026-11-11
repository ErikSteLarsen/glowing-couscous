import Busboy from 'busboy';
import { Readable } from 'node:stream';
import { MAX_ACTIVITY_IMPORT_BYTES } from './activity-import-limits.ts';

const MAX_MULTIPART_OVERHEAD = 64 * 1024;

export type ActivityUpload = {
  bytes: Uint8Array;
  confirmed: boolean;
  pairingChoice: 'separate' | number | null;
  format: 'tcx' | 'fit' | 'gpx';
  sport: 'RUNNING' | 'BIKING' | 'SWIMMING' | null;
};

export async function readActivityUpload(request: Request): Promise<{ ok: true; upload: ActivityUpload } | { ok: false; error: string }> {
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_ACTIVITY_IMPORT_BYTES + MAX_MULTIPART_OVERHEAD) {
    return { ok: false, error: 'Activity files must be 5 MB or smaller.' };
  }
  if (!request.body) return { ok: false, error: 'Choose a valid .tcx, .fit, or .gpx activity file.' };

  let parser: ReturnType<typeof Busboy>;
  try {
    parser = Busboy({ headers: Object.fromEntries(request.headers), limits: { files: 2, fields: 4, parts: 5, fileSize: MAX_ACTIVITY_IMPORT_BYTES, fieldSize: 32 } });
  } catch {
    return { ok: false, error: 'Choose a valid .tcx, .fit, or .gpx activity file.' };
  }

  return new Promise((resolve) => {
    const body = Readable.fromWeb(request.body as never);
    const chunks: Buffer[] = [];
    let bytesRead = 0;
    let fileBytesRead = 0;
    let sawFile = false;
    let validFile = false;
    let format: ActivityUpload['format'] | null = null;
    let confirmed = false;
    let pairingChoice: ActivityUpload['pairingChoice'] = null;
    let sport: ActivityUpload['sport'] = null;
    let sawSport = false;
    let rejected = false;
    const fail = (error: string) => {
      if (rejected) return;
      rejected = true;
      body.destroy();
      parser.destroy();
      resolve({ ok: false, error });
    };

    body.on('data', (chunk: Buffer) => {
      bytesRead += chunk.length;
      if (bytesRead > MAX_ACTIVITY_IMPORT_BYTES + MAX_MULTIPART_OVERHEAD) fail('Activity files must be 5 MB or smaller.');
    });
    body.on('error', () => fail('Could not read the uploaded file.'));
    parser.on('file', (name, stream, info) => {
      if (sawFile) {
        fail('Choose one activity file at a time.');
        stream.on('error', () => undefined);
        stream.resume();
        return;
      }
      sawFile = true;
      const filename = info.filename?.toLowerCase() ?? '';
      format = filename.endsWith('.tcx') ? 'tcx' : filename.endsWith('.fit') ? 'fit' : filename.endsWith('.gpx') ? 'gpx' : null;
      validFile = name === 'file' && format !== null;
      if (!validFile) fail('Choose a .tcx, .fit, or .gpx activity file.');
      stream.on('limit', () => fail('Activity files must be 5 MB or smaller.'));
      stream.on('data', (chunk: Buffer) => {
        fileBytesRead += chunk.length;
        if (fileBytesRead > MAX_ACTIVITY_IMPORT_BYTES) return fail('Activity files must be 5 MB or smaller.');
        if (!rejected) chunks.push(chunk);
      });
      stream.on('error', () => fail('Could not read the uploaded file.'));
    });
    parser.on('field', (name, value) => {
      if (name === 'confirmed') confirmed = value === 'true';
      else if (name === 'pairingChoice') {
        if (value === 'separate') pairingChoice = 'separate';
        else if (/^session:[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value.slice('session:'.length)))) pairingChoice = Number(value.slice('session:'.length));
        else fail('Choose whether to save this as a separate activity or attach it to a planned session.');
      }
      else if (name === 'sport') {
        if (sawSport) return fail('Choose one activity type for the GPX file.');
        sawSport = true;
        if (value === 'RUNNING' || value === 'BIKING' || value === 'SWIMMING') sport = value;
        else fail('Choose Running, Cycling, or Swimming for this GPX activity.');
      }
      else fail('Unexpected upload field.');
    });
    parser.on('filesLimit', () => fail('Choose one activity file at a time.'));
    parser.on('fieldsLimit', () => fail('Invalid upload form.'));
    parser.on('partsLimit', () => fail('Invalid upload form.'));
    parser.on('error', () => fail('Choose a valid .tcx, .fit, or .gpx activity file.'));
    parser.on('finish', () => {
      if (rejected) return;
      if (!sawFile || !validFile || !format) return fail('Choose a .tcx, .fit, or .gpx activity file.');
      if (format === 'gpx' && sport === null) return fail('Choose Running, Cycling, or Swimming for this GPX activity.');
      if (format !== 'gpx' && sawSport) return fail('Choose an activity type only for GPX files.');
      if (!chunks.length) return fail(`The selected ${format.toUpperCase()} file is empty.`);
      resolve({ ok: true, upload: { bytes: new Uint8Array(Buffer.concat(chunks)), confirmed, pairingChoice, format, sport } });
    });
    body.pipe(parser);
  });
}

/** @deprecated Use readActivityUpload for TCX, FIT, and GPX imports. */
export async function readTcxUpload(request: Request) {
  const result = await readActivityUpload(request);
  if (result.ok && result.upload.format !== 'tcx') return { ok: false as const, error: 'Choose a .tcx activity file.' };
  return result;
}
