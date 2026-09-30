import { NextResponse } from 'next/server';
import { requireSignedInUser } from '@/lib/api-auth';
import { accountExportService } from '@/lib/account-export-service';

export async function GET() {
  const { user, error } = await requireSignedInUser();
  if (error || !user) return error;
  const result = await accountExportService.exportForUser(user.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status, headers: { 'Cache-Control': 'no-store' } });
  return new Response(result.json, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="tempo-training-data.json"', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
