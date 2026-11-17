import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SessionComparisonDialog } from '../../components/SessionComparisonDialog';
import { createEmptySessionEditorDraft } from '../../lib/session-editor';
import { Toggle } from '../../components/tempo/Toggle';
import { SessionDeleteAction } from '../../components/SessionDeleteAction';

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
if (root) createRoot(root).render(<Fixture />);
