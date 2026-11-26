'use client';

import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@ui-sdk/react/dialog';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { centeredDialogClassName, Surface, dangerButtonClassName, dangerTextClassName, primaryButtonClassName, secondaryButtonClassName, sectionHeadingClassName, successTextClassName } from '@/components/ui';
import { withBackOrigin } from '@/lib/app-navigation';
import type { StravaConnectionSummary } from '@/lib/strava-service';

const oauthNotices: ReadonlyMap<string, string> = new Map([
  ['connected', 'Strava is connected. Your recent activities are ready to review.'],
  ['connected:sync-error', 'Strava is connected, but TempoBuilder couldn’t check for activities yet. Open the Strava inbox and choose Check Strava now.'],
  ['connected:revoke-error', 'Strava is connected. TempoBuilder couldn’t confirm that your previous Strava account was unlinked.'],
  ['connected:sync-revoke-error', 'Strava is connected, but TempoBuilder couldn’t check for activities yet or confirm that your previous Strava account was unlinked. Open the Strava inbox and choose Check Strava now.'],
  ['cancelled', 'You cancelled connecting Strava.'],
  ['error:state', 'The Strava sign-in timed out. Try connecting again.'],
  ['error:account-linked', 'That Strava account is already linked to another TempoBuilder account.'],
  ['error:connect', 'Could not connect Strava. Try again.'],
  ['error:authorization', 'Could not connect Strava. Try again.'],
]);

type DisconnectFeedback =
  | { error: string }
  | { notice: string; providerRevoked: boolean };

export function StravaConnectionSettings({
  connected,
  canConnect,
  athleteName,
  webhookConfigured,
  oauthResult,
}: Omit<StravaConnectionSummary, 'activities'> & { oauthResult?: string }) {
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState(false);
  const [feedback, setFeedback] = useState<DisconnectFeedback | null>(null);
  const disconnected = feedback && 'notice' in feedback;
  const isConnected = connected && !disconnected;
  const status = isConnected
    ? athleteName ? `Connected as ${athleteName}` : 'Connected'
    : canConnect ? 'Not connected' : 'Not available right now';
  const oauthNotice = oauthNotices.get(oauthResult ?? '');
  const previousRevocationFailed = oauthResult === 'connected:revoke-error' || oauthResult === 'connected:sync-revoke-error';

  async function disconnect() {
    if (!window.confirm('Disconnect Strava? Activities you imported from Strava are removed from TempoBuilder, and planned workouts they were matched to go back to how they were.')) return;
    setDisconnecting(true);
    setFeedback(null);
    try {
      const response = await fetch('/api/strava/connection', { method: 'DELETE' });
      const result: { error?: string; removedActivities?: number; providerRevoked?: boolean } = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not disconnect Strava.');
      const count = result.removedActivities ?? 0;
      setFeedback({
        notice: `Strava disconnected. Removed ${count} Strava ${count === 1 ? 'activity' : 'activities'} from TempoBuilder.`,
        providerRevoked: result.providerRevoked !== false,
      });
      router.refresh();
    } catch (error) {
      setFeedback({ error: error instanceof Error ? error.message : 'Could not disconnect Strava. Try again.' });
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <Surface id="connections" className="scroll-mt-20 space-y-3">
      <h2 className={sectionHeadingClassName}>Connections</h2>
      <Dialog defaultOpen={Boolean(oauthNotice)} onOpenChange={(_, details) => {
        if (disconnecting) details.cancel();
      }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[var(--text)]">Strava</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{status}</p>
          </div>
          <DialogTrigger className={`${secondaryButtonClassName} max-md:min-h-11`}>Manage Strava</DialogTrigger>
        </div>
        <DialogContent className={`${centeredDialogClassName} max-w-md space-y-4`}>
          <div>
            <DialogTitle className={sectionHeadingClassName}>Strava connection</DialogTitle>
            <DialogDescription className="mt-1 text-sm text-[var(--text-secondary)]">{status}</DialogDescription>
          </div>
          {oauthNotice && !disconnected ? <p role="status" className="text-sm">{oauthNotice}</p> : null}
          {feedback && 'error' in feedback ? <p role="alert" className={dangerTextClassName}>{feedback.error}</p> : null}
          {feedback && 'notice' in feedback ? <p role="status" className={successTextClassName}>{feedback.notice}</p> : null}
          {previousRevocationFailed || (feedback && 'providerRevoked' in feedback && !feedback.providerRevoked) ? (
            <p className="text-sm text-[var(--text-secondary)]">
              TempoBuilder couldn’t confirm that Strava removed its access. <a href="https://www.strava.com/settings/apps" target="_blank" rel="noreferrer" className="text-[var(--brand)] underline underline-offset-2 hover:text-[var(--text)]">Remove TempoBuilder in your Strava settings</a>.
            </p>
          ) : null}
          {isConnected ? (
            <>
              <p className="text-sm text-[var(--text-secondary)]">
                New Strava activities wait in your inbox until you import them.
                {webhookConfigured ? null : ' Choose Check Strava now in the inbox to look for new ones.'}
              </p>
              <Link href={withBackOrigin('/athlete/import#strava', 'settings')} className={`${primaryButtonClassName} max-md:min-h-11`}>Review Strava activities</Link>
              <div className="space-y-3 border-t border-[var(--border)] pt-4">
                <p className="text-sm text-[var(--text-secondary)]">Disconnecting removes the activities you imported from Strava. Planned workouts they were matched to go back to how they were. Activities from files stay.</p>
                <button type="button" className={`${dangerButtonClassName} max-md:min-h-11`} disabled={disconnecting} onClick={() => void disconnect()}>
                  {disconnecting ? 'Disconnecting…' : 'Disconnect Strava'}
                </button>
              </div>
            </>
          ) : canConnect ? (
            <a href="/api/strava/connect" className={`${primaryButtonClassName} max-md:min-h-11`}>Connect Strava</a>
          ) : null}
          <div className="flex justify-end">
            <DialogClose className={`${secondaryButtonClassName} max-md:min-h-11`} disabled={disconnecting}>Close</DialogClose>
          </div>
        </DialogContent>
      </Dialog>
    </Surface>
  );
}
