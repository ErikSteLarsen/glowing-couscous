'use client';

import { useEffect, useRef, useState } from 'react';
import { signIn, signOut } from 'next-auth/react';
import { clearClientRecovery } from '@/lib/client-recovery-cleanup';
import { dangerButtonClassName, formFieldClassName, secondaryButtonClassName, sectionHeadingClassName } from '@/components/ui';

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
      if (!response.ok) throw new Error(body.error ?? 'Could not load deletion details.');
      setSharedLinks(body.sharedLinks);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load deletion details.'); }
    finally { setPending(false); }
  }

  async function unshare() {
    if (!window.confirm('Remove all public links you created or links to your workouts? Saved copies belonging to other users will remain.')) return;
    setPending(true); setError('');
    try {
      const response = await fetch('/api/account/shares', { method: 'DELETE' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Could not remove your public links.');
      setSharedLinks(0); setMessage(`${body.removed} public ${body.removed === 1 ? 'link removed' : 'links removed'}.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not remove your public links.'); }
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
      if (!response.ok) throw new Error(body.error ?? 'Deletion could not be confirmed. Try again.');
      deleted = true;
      if (body.providerRevoked === false) destination += '?strava=manual';
      clearClientRecovery(userId);
      await signOut({ redirect: false });
      window.location.assign(destination);
    } catch (reason) {
      if (deleted) { window.location.assign(destination); return; }
      setPassword(''); setError(reason instanceof Error ? reason.message : 'Deletion could not be confirmed. Try again.'); setPending(false);
    }
  }

  function cancel() {
    setOpen(false); setPassword(''); setConfirmation(''); setError(''); setSharedLinks(null);
    window.requestAnimationFrame(() => trigger.current?.focus());
  }

  return <div className="space-y-4 border-t border-[var(--border)] pt-6">
    <div><h3 className={sectionHeadingClassName}>Delete account</h3><p className="mt-2 text-sm text-[var(--text-secondary)]">Permanently remove your account and personal training data.</p></div>
    {!open ? <button ref={trigger} type="button" className={secondaryButtonClassName} onClick={prepare}>Review account deletion</button> : <form onSubmit={deleteAccount} className="space-y-4" aria-label="Delete account confirmation">
      <p ref={accountIdentity} tabIndex={-1} className="break-all text-sm">Account: <strong>{email}</strong></p>
      <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--text-secondary)]">
        <li>Your profile, preferences, private workouts, outcomes, sign-in credentials and connected service tokens will be erased from Tempo’s active database. All devices lose access.</li>
        <li>Shared workouts remain available with owner <strong>[deleted]</strong>. Their titles, descriptions and notes are removed; workout structure remains.</li>
        <li>Unshare first to remove public access. Copies already saved by other users and their training history remain theirs.</li>
        <li>Drafts in this browser will be cleared. Drafts stored on other devices and existing backups cannot be erased by this action.</li>
      </ul>
      <div className="space-y-2">
        <p className="text-sm">{sharedLinks === null ? 'Checking public links…' : `${sharedLinks} public ${sharedLinks === 1 ? 'link' : 'links'} will remain unless you unshare first.`}</p>
        {sharedLinks !== null && sharedLinks > 0 ? <button type="button" className={secondaryButtonClassName} disabled={pending} onClick={unshare}>Unshare all my public links</button> : null}
        {message ? <p role="status" className="text-sm">{message}</p> : null}
      </div>
      {hasPassword ? <label className="block space-y-2 text-sm"><span>Current password</span><input autoComplete="current-password" type="password" required disabled={pending} value={password} onChange={(event) => setPassword(event.target.value)} className={formFieldClassName} /></label> : hasGoogle ? <div className="space-y-2"><p className="text-sm text-[var(--text-secondary)]">Confirm your identity with Google within five minutes of deletion. Choose this account, then return here and open account deletion again.</p><button type="button" className={secondaryButtonClassName} disabled={pending} onClick={confirmGoogle}>Confirm identity with Google</button></div> : <p role="alert">No supported identity confirmation method is available for this account.</p>}
      <label className="block space-y-2 text-sm"><span>Type DELETE to confirm permanent deletion</span><input autoComplete="off" spellCheck={false} required disabled={pending} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className={formFieldClassName} /></label>
      {error ? <p role="alert" className="text-sm text-[var(--status-danger)]">{error}</p> : null}
      <div className="flex flex-wrap gap-3"><button type="submit" disabled={pending || sharedLinks === null || confirmation !== 'DELETE' || (!hasPassword && !hasGoogle)} className={dangerButtonClassName}>{pending ? 'Working…' : 'Permanently delete my account'}</button><button type="button" disabled={pending} onClick={cancel} className={secondaryButtonClassName}>Cancel</button></div>
    </form>}
  </div>;
}
