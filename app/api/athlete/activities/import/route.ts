import { NextRequest, NextResponse } from 'next/server';
import { requireAthlete } from '@/lib/api-auth';
import { athleteTcxImportService } from '@/lib/athlete-tcx-import-service';
import { athleteFitImportService } from '@/lib/athlete-fit-import-service';
import { athleteGpxImportService } from '@/lib/athlete-gpx-import-service';
import { readActivityUpload } from '@/lib/tcx-upload';

export async function POST(request: NextRequest) {
  const { user, error } = await requireAthlete();
  if (error) return error;
  const upload = await readActivityUpload(request);
  if (!upload.ok) return NextResponse.json({ error: upload.error }, { status: 400 });
  if (upload.upload.confirmed && upload.upload.pairingChoice === null) {
    return NextResponse.json({ error: 'Choose a planned session or keep this as a separate activity before saving.' }, { status: 400 });
  }
  const pairingSessionId = typeof upload.upload.pairingChoice === 'number' ? upload.upload.pairingChoice : null;
  const result = upload.upload.format === 'gpx'
    ? upload.upload.sport
      ? await athleteGpxImportService.import(user.id, upload.upload.bytes, upload.upload.sport, upload.upload.confirmed, pairingSessionId)
      : { ok: false as const, status: 400 as const, error: 'Choose Running, Cycling, or Swimming for this GPX activity.' }
    : upload.upload.format === 'fit'
      ? await athleteFitImportService.import(user.id, upload.upload.bytes, upload.upload.confirmed, pairingSessionId)
      : await athleteTcxImportService.import(user.id, upload.upload.bytes, upload.upload.confirmed, pairingSessionId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ...result, href: `/athlete/session/${result.sessionId}?from=activity` }, { status: result.duplicate ? 200 : 201 });
}
