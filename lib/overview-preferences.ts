export const OVERVIEW_CARD_IDS = ['coachNote', 'lastActivity', 'weekLoad', 'trend'] as const;

export type OverviewCardId = (typeof OVERVIEW_CARD_IDS)[number];

export function normalizeOverviewCards(input: unknown): OverviewCardId[] {
  const cards = Array.isArray(input) ? input : [];

  return cards.filter((card): card is OverviewCardId =>
    OVERVIEW_CARD_IDS.includes(card as OverviewCardId),
  );
}

export function parsePrefsJson(input: string | null | undefined): Record<string, unknown> {
  if (!input || !input.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(input) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** Every card shows until the athlete has chosen otherwise in Settings. */
export function readOverviewCardsFromPrefsJson(input: string | null | undefined): OverviewCardId[] {
  const stored = parsePrefsJson(input).overviewCards;
  return Array.isArray(stored) ? normalizeOverviewCards(stored) : [...OVERVIEW_CARD_IDS];
}
