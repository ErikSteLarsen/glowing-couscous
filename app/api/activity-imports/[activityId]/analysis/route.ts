import { after, NextResponse } from 'next/server';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';
import { activityAnalysisService } from '@/lib/activity-analysis-service';

export const runtime = 'nodejs';
export const maxDuration = 60;
type Context = { params: Promise<{ activityId: string }> };

async function context(params: Context['params']) {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Sign in to see this workout.' }, { status: 401 }) };
  if (!hasAppRole(user)) return { error: NextResponse.json({ error: 'Finish setting up your account first.' }, { status: 403 }) };
  const activityId = Number((await params).activityId);
  if (!Number.isSafeInteger(activityId) || activityId < 1) return { error: NextResponse.json({ error: 'Activity not found.' }, { status: 404 }) };
  return { user, activityId };
}
export async function GET(_request: Request, { params }: Context) {
  const ctx = await context(params);
  if (ctx.error) return ctx.error;
  const view = await activityAnalysisService.readForUser(ctx.user.id, ctx.activityId);
  if (!view) return NextResponse.json({ error: 'Activity not found.' }, { status: 404 });
  if (view.eligible && ['queued', 'processing', 'retry'].includes(view.status)) after(() => activityAnalysisService.processOne(ctx.activityId, ctx.user.id));
  return NextResponse.json(view, { headers: { 'Cache-Control': 'private, no-store' } });
}
export async function POST(request: Request, { params }: Context) {
  const ctx = await context(params);
  if (ctx.error) return ctx.error;
  const result = await activityAnalysisService.requestForUser(ctx.user.id, ctx.activityId);
  if (result.ok) after(() => activityAnalysisService.processOne(ctx.activityId, ctx.user.id));
  return NextResponse.json(result, { status: result.ok ? 202 : result.status });
}
export async function PATCH(request: Request, { params }: Context) {
  const ctx = await context(params);
  if (ctx.error) return ctx.error;
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: 'Could not read your changes. Try again.' }, { status: 400 }); }
  const result = await activityAnalysisService.correctForUser(ctx.user.id, ctx.activityId, input);
  return NextResponse.json(result, { status: result.ok ? 200 : result.status });
}
