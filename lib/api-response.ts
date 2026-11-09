type CreatedSourceIdField = 'sessionId' | 'templateId';

function positiveSafeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
}

export function readApiErrorMessage(payload: unknown, fallback: string): string {
  if (
    typeof payload === 'object'
    && payload !== null
    && !Array.isArray(payload)
    && 'error' in payload
    && typeof payload.error === 'string'
    && payload.error.trim()
  ) {
    return payload.error;
  }

  return fallback;
}

export function readCreatedSourceId(payload: unknown, field: CreatedSourceIdField): number | null {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null;

  if (field === 'sessionId' && 'sessionId' in payload) return positiveSafeInteger(payload.sessionId);
  if (field === 'templateId' && 'templateId' in payload) return positiveSafeInteger(payload.templateId);
  return null;
}
