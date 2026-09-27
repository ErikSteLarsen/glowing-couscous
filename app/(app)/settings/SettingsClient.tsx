'use client';

import { useState, useTransition } from 'react';
import { OVERVIEW_CARD_IDS, type OverviewCardId } from '@/lib/overview-preferences';
import { Toggle } from '@/components/tempo/Toggle';

const personalOverviewCardIds = ['lastActivity', 'weekLoad', 'trend'] as const satisfies readonly OverviewCardId[];

const overviewLabels: Record<(typeof personalOverviewCardIds)[number], { title: string; description: string }> = {
  lastActivity: {
    title: 'Last activity',
    description: 'Keep the most recent completed session visible on Home.',
  },
  weekLoad: {
    title: 'Weekly load',
    description: 'Show planned training time and load for the current week.',
  },
  trend: {
    title: 'Fitness trend',
    description: 'Show a recent training-load chart on Home. Load is estimated from session effort and duration.',
  },
};

export function SettingsClient({
  initialOverviewCards,
}: {
  initialOverviewCards: OverviewCardId[];
}) {
  const [overviewCards, setOverviewCards] = useState(initialOverviewCards);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'danger'>('success');
  const [isPending, startTransition] = useTransition();

  function updateCard(cardId: OverviewCardId, enabled: boolean) {
    const nextCards = enabled
      ? OVERVIEW_CARD_IDS.filter((id) => id === cardId || overviewCards.includes(id))
      : overviewCards.filter((id) => id !== cardId);

    setOverviewCards(nextCards);
    setMessage('');
    startTransition(async () => {
      const response = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ overviewCards: nextCards }),
      });

      if (!response.ok) {
        setOverviewCards(overviewCards);
        setMessageTone('danger');
        setMessage('Could not save overview settings.');
        return;
      }

      setMessageTone('success');
      setMessage('Overview settings updated.');
    });
  }

  return (
    <div className="page-content--compact grid gap-6 xl:max-w-[640px]">
      <section className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-raised)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            Overview
          </p>
          <div className="mt-4 space-y-3">
            {personalOverviewCardIds.map((cardId) => {
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
                    onChange={(enabled) => updateCard(cardId, enabled)}
                    disabled={isPending}
                  />
                </div>
              );
            })}
          </div>
        </section>
      {message ? (
        <p className={`text-sm ${messageTone === 'success' ? 'text-[var(--status-success)]' : 'text-[var(--status-danger)]'}`} role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
