export function normalizeEmailAddress(email: string): string {
  return email.trim().toLowerCase();
}

export function isPlausibleEmailAddress(email: string): boolean {
  const normalized = normalizeEmailAddress(email);
  return normalized.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}
