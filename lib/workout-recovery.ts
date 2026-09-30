import { normalizeSessionEditorDraft } from './session-editor.ts';

export function parseWorkoutRecovery(payload: string) {
  try {
    const value = JSON.parse(payload);
    if (!value || !value.draft || typeof value.draft.title !== 'string' || typeof value.draft.sport !== 'string' || !Array.isArray(value.draft.blocks) || value.draft.blocks.length > 1000 || typeof value.requestKey !== 'string' || (value.requestKey !== '' && !/^[a-zA-Z0-9-]{16,80}$/.test(value.requestKey))) return null;
    return { draft: normalizeSessionEditorDraft(value.draft), requestKey: value.requestKey };
  } catch { return null; }
}
