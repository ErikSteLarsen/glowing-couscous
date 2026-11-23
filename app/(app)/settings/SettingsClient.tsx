'use client';

import { useState, useTransition } from 'react';
import { OVERVIEW_CARD_IDS, type OverviewCardId } from '@/lib/overview-preferences';
import { Toggle } from '@/components/tempo/Toggle';
import Link from 'next/link';
import { Surface, buttonFocusClassName, compactSecondaryButtonClassName, sectionHeadingClassName } from '@/components/ui';

const personalOverviewCardIds = ['lastActivity', 'weekLoad', 'trend'] as const satisfies readonly OverviewCardId[];

const overviewLabels: Record<(typeof personalOverviewCardIds)[number], { title: string; description: string }> = {
  lastActivity: {
    title: 'Last activity',
    description: 'Keep the most recent completed session visible on Home.',
  },
  weekLoad: {
    title: 'Training this week',
    description: 'Show scheduled training and completed outcomes separately for the current week.',
  },
  trend: {
    title: 'Training trends',
    description: 'Show estimated fitness, fatigue, form, and ramp rate with the training load chart.',
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
      try {
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
      } catch {
        setOverviewCards(overviewCards);
        setMessageTone('danger');
        setMessage('Could not reach Tempo. Your saved preferences are unchanged; try again.');
      }
    });
  }

  return (
    <Surface>
      <h2 className={sectionHeadingClassName}>
        Home display
      </h2>
      <div className="mt-4 divide-y divide-[var(--border)]">
        {personalOverviewCardIds.map((cardId) => {
          const meta = overviewLabels[cardId];
          const checked = overviewCards.includes(cardId);

          return (
            <div
              key={cardId}
              className="flex min-h-11 items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
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
      {message ? (
        <p className={`mt-4 text-sm ${messageTone === 'success' ? 'text-[var(--status-success)]' : 'text-[var(--status-danger)]'}`} role="status">
          {message}
        </p>
      ) : null}
    </Surface>
  );
}

export function DesktopAppSettings() {
  return (
    <Surface>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className={sectionHeadingClassName}>Tempo Ride desktop app</h2>
          <p className="mt-1 text-[13px] leading-[1.5] text-[var(--text-secondary)]">
            Ride indoor bike workouts with your Bluetooth trainer on Windows, macOS or Linux.
          </p>
        </div>
        <Link href="/download" className={compactSecondaryButtonClassName}>Get the app</Link>
      </div>
    </Surface>
  );
}

export function AboutSettings() {
  return (
    <details className="rounded-2xl border border-[var(--border)] px-5">
      <summary className={`min-h-11 cursor-pointer rounded-lg py-3 text-sm font-medium text-[var(--text)] ${buttonFocusClassName}`}>
        About these settings
      </summary>
      <div className="space-y-2 pb-4 text-sm text-[var(--text-secondary)]">
        <p>Tempo uses metric units for distance and pace.</p>
        <p>Email and push notifications are not available yet.</p>
      </div>
    </details>
  );
}
