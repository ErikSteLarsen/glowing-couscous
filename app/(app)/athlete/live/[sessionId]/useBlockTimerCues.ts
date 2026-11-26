'use client';

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';

type CuePreference = 'beeps' | 'voice';

const preferenceKeys: Record<CuePreference, string> = {
  beeps: 'tempo:block-timer:beeps:v1',
  voice: 'tempo:block-timer:voice:v1',
};
const defaults: Record<CuePreference, boolean> = { beeps: false, voice: false };
const PREFERENCE_EVENT = 'tempo:block-timer-preference';
const memoryPreferences = new Map<CuePreference, boolean>();

function readPreference(name: CuePreference): boolean {
  try {
    const value = localStorage.getItem(preferenceKeys[name]);
    if (value === 'on') return true;
    if (value === 'off') return false;
  } catch {
    // Storage can be blocked; this tab keeps its own choice.
  }
  return memoryPreferences.get(name) ?? defaults[name];
}

function subscribePreferences(callback: () => void) {
  window.addEventListener(PREFERENCE_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(PREFERENCE_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

/** A remembered on/off choice for one kind of cue. */
export function useCuePreference(name: CuePreference): [boolean, (on: boolean) => void] {
  const value = useSyncExternalStore(subscribePreferences, () => readPreference(name), () => defaults[name]);
  const set = useCallback((on: boolean) => {
    memoryPreferences.set(name, on);
    try { localStorage.setItem(preferenceKeys[name], on ? 'on' : 'off'); } catch { /* Keep the in-memory choice. */ }
    window.dispatchEvent(new Event(PREFERENCE_EVENT));
  }, [name]);
  return [value, set];
}

type AudioContextConstructor = typeof AudioContext;

function tone(context: AudioContext, { frequency, seconds, at = 0 }: { frequency: number; seconds: number; at?: number }) {
  const start = context.currentTime + at;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  // A soft sine with a gentle attack and fade, so it reads as a chime rather than a sharp beep.
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.18, start + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + seconds + 0.02);
}

export type BlockCue = { key: string; spoken: string };

/**
 * Soft beeps on the last three seconds of a timed block and a longer tone when
 * the next block starts, plus an optional spoken name. Both are off by default. Browsers only allow sound after a tap, so `unlock`
 * runs from the Start and Resume buttons.
 */
export function useBlockTimerCues({ active, remainingMs, block }: { active: boolean; remainingMs: number | null; block: BlockCue | null }) {
  const [beeps] = useCuePreference('beeps');
  const [voice] = useCuePreference('voice');
  const contextRef = useRef<AudioContext | null>(null);
  const lastCountdownRef = useRef<string | null>(null);
  const lastBlockRef = useRef<string | null>(block?.key ?? null);

  const unlock = useCallback(() => {
    if (typeof window === 'undefined') return;
    const Context: AudioContextConstructor | undefined = window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
    if (!contextRef.current && Context) {
      try { contextRef.current = new Context(); } catch { contextRef.current = null; }
    }
    void contextRef.current?.resume().catch(() => undefined);
    if (window.speechSynthesis) {
      // iOS speaks only after an utterance started from a tap.
      const primer = new SpeechSynthesisUtterance('');
      primer.volume = 0;
      window.speechSynthesis.speak(primer);
    }
  }, []);

  useEffect(() => () => { void contextRef.current?.close().catch(() => undefined); }, []);

  const second = remainingMs === null ? null : Math.ceil(remainingMs / 1000);
  useEffect(() => {
    if (!active || !beeps || second === null || second < 1 || second > 3 || !block) return;
    const key = `${block.key}:${second}`;
    if (lastCountdownRef.current === key) return;
    lastCountdownRef.current = key;
    if (contextRef.current?.state === 'running') tone(contextRef.current, { frequency: 587, seconds: 0.22 });
  }, [active, beeps, second, block]);

  const blockKey = block?.key ?? null;
  const spoken = block?.spoken ?? '';
  useEffect(() => {
    if (lastBlockRef.current === blockKey) return;
    lastBlockRef.current = blockKey;
    if (!active || blockKey === null) return;
    if (beeps && contextRef.current?.state === 'running') tone(contextRef.current, { frequency: 784, seconds: 0.6 });
    if (voice && window.speechSynthesis && spoken) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(spoken));
    }
  }, [active, beeps, voice, blockKey, spoken]);

  return { unlock };
}

/** Keeps the screen on while the workout clock runs, where the browser allows it. */
export function useScreenWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = () => {
      if (document.visibilityState !== 'visible') return;
      navigator.wakeLock.request('screen')
        .then((sentinel) => {
          if (cancelled) void sentinel.release();
          else lock = sentinel;
        })
        .catch(() => undefined);
    };
    request();
    // The browser drops the lock when the page is hidden; take it again on return.
    document.addEventListener('visibilitychange', request);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', request);
      void lock?.release().catch(() => undefined);
    };
  }, [active]);
}
