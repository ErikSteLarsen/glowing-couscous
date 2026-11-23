'use client';

import { useEffect, useRef, useState } from 'react';
import { signIn, signOut } from 'next-auth/react';
import { clearClientRecovery, loadSignedOutDocument } from '@/lib/client-recovery-cleanup';
import { dangerTextClassName, dangerButtonClassName, formFieldClassName, secondaryButtonClassName, sectionHeadingClassName } from '@/components/ui';

export function AccountDeletionControls({ userId, email, hasPassword, hasGoogle }: { userId: number; email: string; hasPassword: boolean; hasGoogle: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [sharedLinks, setSharedLinks] = useState<number | null>(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const accountIdentity = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (open) accountIdentity.current?.focus(); }, [open]);

  async function prepare() {
    setOpen(true); setPending(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/account/deletion', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Could not load your account details. Try again.');
      setSharedLinks(body.sharedLinks);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load your account details. Try again.'); }
    finally { setPending(false); }
  }

  async function unshare() {
    if (!window.confirm('Turn off every share link you created, and every link to your workouts? People who already saved a copy keep it.')) return;
    setPending(true); setError('');
    try {
      const response = await fetch('/api/account/shares', { method: 'DELETE' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Could not turn off your share links. Try again.');
      setSharedLinks(0); setMessage(`${body.removed} share ${body.removed === 1 ? 'link' : 'links'} turned off.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not turn off your share links. Try again.'); }
    finally { setPending(false); }
  }

  async function confirmGoogle() {
    setPending(true); setError('');
    try {
      await signOut({ redirect: false });
      await signIn('google', { redirectTo: '/profile' }, { prompt: 'select_account' });
    } catch { setError('Could not start Google sign-in. Sign in again before deleting your account.'); setPending(false); }
  }

  async function deleteAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError('');
    let deleted = false;
    let destination = '/account-deleted';
    try {
      const response = await fetch('/api/account/deletion', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password, confirmation }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Could not delete your account. Try again.');
      deleted = true;
      if (body.providerRevoked === false) destination += '?strava=manual';
      clearClientRecovery(userId);
      await signOut({ redirect: false });
      loadSignedOutDocument(destination);
    } catch (reason) {
      if (deleted) { loadSignedOutDocument(destination); return; }
      setPassword(''); setError(reason instanceof Error ? reason.message : 'Could not delete your account. Try again.'); setPending(false);
    }
  }

  function cancel() {
    setOpen(false); setPassword(''); setConfirmation(''); setError(''); setSharedLinks(null);
    window.requestAnimationFrame(() => trigger.current?.focus());
  }

  return <div className="space-y-4 border-t border-[var(--border)] pt-6">
    <div><h3 className={sectionHeadingClassName}>Delete account</h3><p className="mt-2 text-sm text-[var(--text-secondary)]">Permanently delete your account and your training data.</p></div>
    {!open ? <button ref={trigger} type="button" className={secondaryButtonClassName} onClick={prepare}>Delete account…</button> : <form onSubmit={deleteAccount} className="space-y-4" aria-label="Delete account confirmation">
      <p ref={accountIdentity} tabIndex={-1} className="break-all text-sm">Account: <strong>{email}</strong></p>
      <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--text-secondary)]">
        <li>Tempo deletes your profile, settings, workouts, results, sign-in details and connections to apps such as Strava. You’re signed out on all devices.</li>
        <li>Workouts you shared keep working through their links, shown as owned by <strong>[deleted]</strong>. Their names, descriptions and notes are removed. Only the steps remain.</li>
        <li>To stop that, turn off your share links first. Copies other people already saved, and their training history, stay theirs.</li>
        <li>Unsaved changes on this device are deleted. Unsaved changes on your other devices, and existing backups, can’t be deleted from here.</li>
      </ul>
      <div className="space-y-2">
        <p className="text-sm">{sharedLinks === null ? 'Checking share links…' : `${sharedLinks} share ${sharedLinks === 1 ? 'link' : 'links'} will keep working unless you turn them off first.`}</p>
        {sharedLinks !== null && sharedLinks > 0 ? <button type="button" className={secondaryButtonClassName} disabled={pending} onClick={unshare}>Turn off all my share links</button> : null}
        {message ? <p role="status" className="text-sm">{message}</p> : null}
      </div>
      {hasPassword ? <label className="block space-y-2 text-sm"><span>Current password</span><input autoComplete="current-password" type="password" required disabled={pending} value={password} onChange={(event) => setPassword(event.target.value)} className={formFieldClassName} /></label> : hasGoogle ? <div className="space-y-2"><p className="text-sm text-[var(--text-secondary)]">To confirm it’s you, sign in with Google again. You then have five minutes to delete your account. Choose this account, then come back here and choose Delete account again.</p><button type="button" className={secondaryButtonClassName} disabled={pending} onClick={confirmGoogle}>Sign in with Google</button></div> : <p role="alert">There’s no way to confirm it’s you for this account.</p>}
      <label className="block space-y-2 text-sm"><span>Type DELETE to confirm</span><input autoComplete="off" spellCheck={false} required disabled={pending} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className={formFieldClassName} /></label>
      {error ? <p role="alert" className={dangerTextClassName}>{error}</p> : null}
      <div className="flex flex-wrap gap-3"><button type="submit" disabled={pending || sharedLinks === null || confirmation !== 'DELETE' || (!hasPassword && !hasGoogle)} className={dangerButtonClassName}>{pending ? 'Deleting…' : 'Permanently delete my account'}</button><button type="button" disabled={pending} onClick={cancel} className={secondaryButtonClassName}>Cancel</button></div>
    </form>}
  </div>;
}
