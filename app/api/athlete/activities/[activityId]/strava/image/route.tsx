import { ImageResponse } from 'next/og';
import { NextResponse } from 'next/server';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';
import { stravaPostService } from '@/lib/strava-post-service';
import { POST_CHART_COLORS as C } from '@/lib/strava-post-chart';

const WIDTH = 1200;
const HEIGHT = 675;
const CHART = { width: WIDTH - 112, height: 360 };

function Swatch({ color, label, dashed = false }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginRight: 28 }}>
      <div style={{ width: 22, height: dashed ? 12 : 4, borderRadius: 2, backgroundColor: color, opacity: dashed ? 0.45 : 1, marginRight: 10 }} />
      <div style={{ fontSize: 20, color: C.ink2 }}>{label}</div>
    </div>
  );
}

export async function GET(request: Request, { params }: { params: Promise<{ activityId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in to see this image.' }, { status: 401 });
  if (!hasAppRole(user)) return NextResponse.json({ error: 'Finish setting up your account first.' }, { status: 403 });
  const image = await stravaPostService.imageForUser(user.id, Number((await params).activityId), CHART);
  if (!image) return NextResponse.json({ error: 'This activity has no recorded data to draw.' }, { status: 404 });

  const download = new URL(request.url).searchParams.get('download') === '1';
  const chartSrc = `data:image/svg+xml;base64,${Buffer.from(image.chart.svg).toString('base64')}`;
  const date = image.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: C.ground, padding: '48px 56px 40px', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 860 }}>
            <div style={{ fontSize: 50, fontWeight: 600, color: C.ink1, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{image.title}</div>
            <div style={{ fontSize: 26, color: C.ink2, marginTop: 14 }}>{image.statsLine}</div>
            {image.blockLine ? <div style={{ fontSize: 22, color: C.ink3, marginTop: 8 }}>{image.blockLine}</div> : null}
          </div>
          <div style={{ fontSize: 20, color: C.ink3, marginTop: 10 }}>{date}</div>
        </div>
        <div style={{ display: 'flex', flexGrow: 1, alignItems: 'flex-end', marginTop: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- rendered to PNG by next/og, not a page image */}
          <img src={chartSrc} width={CHART.width} height={CHART.height} alt="" style={{ borderTop: `1px solid ${C.rule}`, borderBottom: `1px solid ${C.rule}` }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 22 }}>
          <div style={{ display: 'flex' }}>
            {image.chart.summary.hasPower ? <Swatch color={C.ink1} label="Power" /> : null}
            {image.chart.summary.hasHeartRate ? <Swatch color={C.heartRate} label="Heart rate" /> : null}
            {image.chart.summary.hasPlan ? <Swatch color={C.zones[4]} label="Plan" dashed /> : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', fontSize: 20, color: C.ink3 }}>
            <div style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.trace, marginRight: 10 }} />
            Recorded with TempoBuilder
          </div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      headers: {
        'cache-control': 'private, no-store',
        ...(download ? { 'content-disposition': `attachment; filename="${image.filename}"` } : {}),
      },
    },
  );
}
