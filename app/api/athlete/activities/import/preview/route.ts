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
  const result = upload.upload.format === 'gpx'
    ? upload.upload.sport
      ? await athleteGpxImportService.preview(user.id, upload.upload.bytes, upload.upload.sport)
      : { ok: false as const, status: 400 as const, error: 'Choose Running, Cycling, or Swimming for this GPX activity.' }
    : upload.upload.format === 'fit'
      ? await athleteFitImportService.preview(user.id, upload.upload.bytes)
      : await athleteTcxImportService.preview(user.id, upload.upload.bytes);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ...result, candidates: result.candidates ?? [], sourceFormat: upload.upload.format });
}
