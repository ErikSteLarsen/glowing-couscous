'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { listRecoveryDrafts, recoveryKey, removeRecoveryDraftIfUnchanged, saveRecoveryDraft, type RecoveryDraft } from '@/lib/draft-recovery';

export function useDraftRecovery({ userId, surface, resource, baseline, payload, dirty, isRedundant }: {
  userId: number | null; surface: RecoveryDraft['surface']; resource: string;
  baseline: string; payload: string; dirty: boolean;
  /** Drafts that match what is already saved are removed instead of offered. */
  isRedundant?: (draft: RecoveryDraft) => boolean;
}) {
  const [candidates, setCandidates] = useState<RecoveryDraft[]>([]);
  const [checkedAt, setCheckedAt] = useState(0);
  const redundant = useRef(isRedundant);
  useEffect(() => { redundant.current = isRedundant; });
  const [status, setStatus] = useState<'idle' | 'kept' | 'unavailable'>('idle');
  const writer = useRef('');
  const latest = useRef({ userId, surface, resource, baseline, payload, dirty });
  const activeKey = useRef<string | null>(null);
  const restoredRecord = useRef<RecoveryDraft | null>(null);
  const mounted = useRef(false);
  useEffect(() => { latest.current = { userId, surface, resource, baseline, payload, dirty }; });

  const refresh = useCallback(() => {
    if (userId === null) return;
    try {
      const storage = window.localStorage;
      const offered = listRecoveryDrafts(storage, userId, surface).filter((draft) => {
        if (draft.writer === writer.current) return false;
        return !(redundant.current?.(draft) && removeRecoveryDraftIfUnchanged(storage, draft));
      });
      setCandidates(offered);
      setCheckedAt(Date.now());
    } catch { setStatus('unavailable'); }
  }, [userId, surface]);

  useEffect(() => {
    writer.current = crypto.randomUUID();
    activeKey.current = null;
    restoredRecord.current = null;
    mounted.current = true;
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) refresh(); });
    window.addEventListener('storage', refresh);
    const cleared = (event: Event) => {
      let clearedUser: unknown;
      if (event instanceof CustomEvent) clearedUser = event.detail;
      if (event instanceof StorageEvent && event.key === 'tempo-recovery-cleared') {
        try { clearedUser = JSON.parse(event.newValue ?? '{}').userId; } catch { return; }
      }
      if (clearedUser === userId) {
        latest.current = { ...latest.current, dirty: false }; writer.current = '';
        activeKey.current = null; restoredRecord.current = null;
        setCandidates([]); setStatus('idle');
      }
    };
    window.addEventListener('tempo-recovery-cleared', cleared);
    window.addEventListener('storage', cleared);
    return () => { cancelled = true; mounted.current = false; window.removeEventListener('storage', refresh); window.removeEventListener('tempo-recovery-cleared', cleared); window.removeEventListener('storage', cleared); };
  }, [refresh, userId]);

  const flush = useCallback(() => {
    const value = latest.current;
    if (value.userId === null || !value.dirty || !writer.current) return;
    try {
      const draft: RecoveryDraft = { version: 1, userId: value.userId, surface: value.surface, resource: value.resource, baseline: value.baseline, payload: value.payload, writer: writer.current, savedAt: Date.now() };
      saveRecoveryDraft(window.localStorage, draft);
      activeKey.current = recoveryKey(draft);
      if (restoredRecord.current && recoveryKey(restoredRecord.current) !== activeKey.current) { removeRecoveryDraftIfUnchanged(window.localStorage, restoredRecord.current); restoredRecord.current = null; }
      if (mounted.current) setStatus('kept');
    } catch { if (mounted.current) setStatus('unavailable'); }
  }, []);

  useEffect(() => {
    if (!dirty || userId === null) return;
    const timeout = window.setTimeout(flush, 250);
    const onVisibility = () => { if (document.hidden) flush(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      window.clearTimeout(timeout);
      // Flush the departing resource before a route or draft transition.
      flush();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
    };
  }, [userId, resource, surface, payload, baseline, dirty, flush]);

  useEffect(() => {
    if (!dirty || status !== 'unavailable') return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const guard = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (link && !window.confirm('Tempo can’t back up your changes on this device. Leave and lose them?')) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', guard, true);
    return () => { window.removeEventListener('beforeunload', warn); document.removeEventListener('click', guard, true); };
  }, [dirty, status]);

  const discard = useCallback((draft?: RecoveryDraft) => {
    try {
      if (draft) removeRecoveryDraftIfUnchanged(window.localStorage, draft);
      else if (activeKey.current) window.localStorage.removeItem(activeKey.current);
      if (!draft && restoredRecord.current) { removeRecoveryDraftIfUnchanged(window.localStorage, restoredRecord.current); restoredRecord.current = null; }
      if (!draft) { activeKey.current = null; latest.current = { ...latest.current, dirty: false }; setStatus('idle'); }
      refresh();
    } catch { setStatus('unavailable'); }
  }, [refresh]);

  const restored = useCallback((draft: RecoveryDraft) => {
    restoredRecord.current = draft;
    setCandidates((current) => current.filter((entry) => recoveryKey(entry) !== recoveryKey(draft)));
  }, []);
  return { candidates, checkedAt, status, discard, flush, restored };
}
