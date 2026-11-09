'use client';

import { useRef, useState } from 'react';
import { OVERVIEW_CARD_IDS, type OverviewCardId } from '@/lib/overview-preferences';
import { Toggle } from '@/components/tempo/Toggle';

const overviewLabels: Record<OverviewCardId, { title: string; description: string }> = {
  coachNote: {
    title: 'Coach notes',
    description: "Show your coach's note for today's session on Home.",
  },
  lastActivity: {
    title: 'Last activity',
    description: 'Keep the most recent completed session visible on Home.',
  },
  weekLoad: {
    title: 'Weekly volume',
    description: 'Compare planned and completed work this week and over recent weeks.',
  },
  trend: {
    title: 'Fitness and form',
    description: 'Chart fitness, fatigue, and form with a two-week projection from your plan.',
  },
};

export function SettingsClient({
  role,
  initialOverviewCards,
}: {
  role: string | null;
  initialOverviewCards: OverviewCardId[];
}) {
  const [overviewCards, setOverviewCards] = useState(initialOverviewCards);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'danger'>('success');
  const [isPending, setIsPending] = useState(false);
  const saving = useRef(false);

  async function updateCard(cardId: OverviewCardId, enabled: boolean) {
    if (saving.current) return;
    saving.current = true;
    const previousCards = overviewCards;
    const nextCards = enabled
      ? OVERVIEW_CARD_IDS.filter((id) => id === cardId || overviewCards.includes(id))
      : overviewCards.filter((id) => id !== cardId);

    setOverviewCards(nextCards);
    setIsPending(true);
    setMessage('');
    try {
      const response = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overviewCards: nextCards }),
      });
      if (!response.ok) {
        setOverviewCards(previousCards);
        setMessageTone('danger');
        setMessage('Could not save overview settings. Try again.');
        return;
      }
      setMessageTone('success');
      setMessage('Overview settings updated.');
    } catch {
      setOverviewCards(previousCards);
      setMessageTone('danger');
      setMessage('Could not save overview settings. Check your connection and try again.');
    } finally {
      saving.current = false;
      setIsPending(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      {role === 'ATHLETE' ? (
        <section className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-raised)]">
          <p className="text-xs font-medium text-[var(--text-muted)]">
            Overview
          </p>
          <div className="mt-4 space-y-3">
            {OVERVIEW_CARD_IDS.map((cardId) => {
              const meta = overviewLabels[cardId];
              const checked = overviewCards.includes(cardId);

              return (
                <div
                  key={cardId}
                  className="flex min-h-11 items-center justify-between gap-4 rounded-[10px] border border-[var(--border)] bg-[var(--field-surface)] px-4 py-2.5"
                >
                  <div>
                    <p className="text-[13.5px] font-semibold text-[var(--text)]">{meta.title}</p>
                    <p className="mt-1 text-[13px] leading-[1.5] text-[var(--text-secondary)]">
                      {meta.description}
                    </p>
                  </div>
                  <Toggle
                    checked={checked}
                    label={`${meta.title} on Home`}
                    onChange={(enabled) => void updateCard(cardId, enabled)}
                    disabled={isPending}
                  />
                </div>
              );
            })}
          </div>
          {message ? (
            <p className={`mt-4 text-sm ${messageTone === 'success' ? 'text-[var(--status-success)]' : 'text-[var(--status-danger)]'}`} role={messageTone === 'success' ? 'status' : 'alert'}>
              {message}
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="space-y-6">
        <section className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-raised)]">
          <p className="text-[15px] font-semibold text-[var(--text)]">Units</p>
          <p className="mt-2 text-[13px] leading-[1.55] text-[var(--text-secondary)]">
            Metric remains the active default for distance and pace across Tempo screens.
          </p>
        </section>
        <section className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-raised)]">
          <p className="text-[15px] font-semibold text-[var(--text)]">Notifications</p>
          <p className="mt-2 text-[13px] leading-[1.55] text-[var(--text-secondary)]">
            Email and push notifications are not available yet.
          </p>
        </section>

      </div>
    </div>
  );
}
