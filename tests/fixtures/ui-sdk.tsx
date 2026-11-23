import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SessionComparisonDialog } from '../../components/SessionComparisonDialog';
import { createEmptySessionEditorDraft } from '../../lib/session-editor';
import { Toggle } from '../../components/tempo/Toggle';
import { SessionDeleteAction } from '../../components/SessionDeleteAction';
import { RideClient } from '../../app/(app)/athlete/ride/[sessionId]/RideClient';
import { LiveSessionClient } from '../../app/(app)/athlete/live/[sessionId]/LiveSessionClient';
import type { ExecutionStep } from '../../lib/athlete-execution';
import { resolveBackTarget } from '../../lib/app-navigation';
import { buildWorkoutProfile } from '../../lib/workout-profile';

window.fetch = async () => new Response(JSON.stringify({
  baseline: createEmptySessionEditorDraft({ title: 'Planned run', mode: 'planned' }),
  actual: createEmptySessionEditorDraft({ title: 'Actual run', mode: 'actual' }),
}));

function Fixture() {
  const [checked, setChecked] = useState(false);
  const [deleted, setDeleted] = useState('');
  return <>
    <Toggle checked={checked} onChange={setChecked} label="Weekly summary" />
    <Toggle checked disabled onChange={setChecked} label="Disabled setting" />
    <SessionDeleteAction sessionId={1} title="Morning run" onDeleted={setDeleted} />
    <SessionComparisonDialog sessionId={1} endpoint="/comparison" />
    <output>{deleted}</output>
    <button>Outside control</button>
  </>;
}
const root = document.getElementById('root');
const params = new URLSearchParams(location.search);
const liveSteps: ExecutionStep[] = [
  { id: 'warmup', label: 'Warm-up', durationSec: 60, targetLabel: '50% FTP', prescribedTarget: '50% FTP', note: 'Spin smoothly.' },
  { id: 'untimed', label: 'Cool-down', durationSec: 0, targetLabel: null, prescribedTarget: null, note: '' },
];
if (root) createRoot(root).render(params.has('ride') ? (
  <RideClient
    userId={1}
    sessionId={1}
    sessionTitle="Indoor ride"
    plan={{ steps: [], totalSec: 0, ftpWatts: null }}
    plannedTss={0}
    steps={[]}
    back={resolveBackTarget({ route: 'session-ride', sessionId: 1 })}
    heartRateMaxBpm={null}
  />
) : params.has('live') ? <LiveSessionClient sessionId={2} blocks={liveSteps} isDone={false} title="Live ride" profile={buildWorkoutProfile([{ id: 'warmup', kind: 'warmup', zone: 1, durationSec: 60, reps: null, target: { metric: 'power', mode: 'relative', reference: 'ftp', low: 50, high: 50 } }])} /> : <Fixture />);
