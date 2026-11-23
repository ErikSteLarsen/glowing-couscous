'use client';

import { useEffect, useId, useState, useSyncExternalStore, type FormEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ChevronDown } from 'lucide-react';
import {
  buttonFocusClassName,
  dangerTextClassName,
  formFieldClassName,
  formLabelClassName,
  formSelectClassName,
  primaryButtonClassName,
  successTextClassName,
  Surface,
} from '@/components/ui';
import { validatePerformanceProfile, type PerformanceProfile } from '@/lib/performance-profile';
import { calculateOlympiatoppenHeartRateZones, formatPaceSecondsPerKm, getRunningPaceZones, OLYMPIATOPPEN_HEART_RATE_PERCENT_BANDS, parsePaceSecondsPerKm } from '@/lib/profile-training-zones';
import type { TempoZone } from '@/lib/tempo-blocks';
import { useDraftRecovery } from '@/components/useDraftRecovery';
import { DraftRecoveryNotice } from '@/components/DraftRecoveryNotice';
import type { RecoveryDraft } from '@/lib/draft-recovery';
import { parseProfileRecovery } from '@/lib/profile-recovery';

type Account = {
  id: number;
  name: string | null;
  email: string | null;
  performanceProfile: PerformanceProfile;
  updatedAt: Date | string;
};

type PaceDraft = { fastest: string; slowest: string };
type PaceDrafts = Record<TempoZone, PaceDraft>;
type CustomizedZones = Record<TempoZone, boolean>;

type TargetSection = 'heart-rate' | 'running' | 'cycling' | 'swimming';
type SportSection = Exclude<TargetSection, 'heart-rate'>;

const zones: TempoZone[] = [1, 2, 3, 4, 5];
const targetSections: TargetSection[] = ['heart-rate', 'running', 'cycling', 'swimming'];
const subscribePortalReady = () => () => {};
const getPortalClientSnapshot = () => true;
const getPortalServerSnapshot = () => false;
const zoneNames: Record<TempoZone, string> = { 1: 'Recovery', 2: 'Easy', 3: 'Steady', 4: 'Threshold', 5: 'Fast' };
const raceDistances = [
  { value: 3000, label: '3 km' },
  { value: 5000, label: '5 km' },
  { value: 10000, label: '10 km' },
  { value: 21097, label: 'Half marathon' },
  { value: 42195, label: 'Marathon' },
];

export function ProfileClient({ account }: { account: Account }) {
  const [name, setName] = useState(account.name ?? '');
  const [performanceProfile, setPerformanceProfile] = useState(account.performanceProfile);
  const [raceTimeDraft, setRaceTimeDraft] = useState(() => formatRaceTime(account.performanceProfile.running.raceTimeSec));
  const [customizedZones, setCustomizedZones] = useState<CustomizedZones>(() => Object.fromEntries(zones.map((zone) => [zone, account.performanceProfile.running.paceZoneOverrides[zone].fastestSecPerKm !== null])) as CustomizedZones);
  const [paceDrafts, setPaceDrafts] = useState(() => createPaceDrafts(account.performanceProfile));
  const [savedSnapshot, setSavedSnapshot] = useState(() => getDraftSnapshot(name, performanceProfile, raceTimeDraft, customizedZones, paceDrafts));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [openSections, setOpenSections] = useState<Set<TargetSection>>(() => new Set());
  const [openAdvanced, setOpenAdvanced] = useState<Set<SportSection>>(() => new Set());
  const savebarPortalReady = useSyncExternalStore(subscribePortalReady, getPortalClientSnapshot, getPortalServerSnapshot);
  const router = useRouter();
  const { update } = useSession();
  const [revision, setRevision] = useState(() => new Date(account.updatedAt).toISOString());
  const recoveryPayload = getDraftSnapshot(name, performanceProfile, raceTimeDraft, customizedZones, paceDrafts);
  const recovery = useDraftRecovery({ userId: account.id, surface: 'profile', resource: 'profile', baseline: revision, payload: recoveryPayload, dirty: recoveryPayload !== savedSnapshot });

  // Deep links such as /profile#cycling open that sport's targets.
  useEffect(() => {
    function openFromHash() {
      const section = window.location.hash.slice(1) as TargetSection;
      if (targetSections.includes(section)) setOpenSections((current) => new Set(current).add(section));
    }
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
    return () => window.removeEventListener('hashchange', openFromHash);
  }, []);

  function toggleSection(section: TargetSection) {
    setOpenSections((current) => {
      const next = new Set(current);
      if (next.has(section)) next.delete(section); else next.add(section);
      return next;
    });
  }

  function toggleAdvanced(section: SportSection) {
    setOpenAdvanced((current) => {
      const next = new Set(current);
      if (next.has(section)) next.delete(section); else next.add(section);
      return next;
    });
  }

  /** Validation and recovery must never hide the fields they refer to. */
  function reveal(sections: TargetSection[], advanced: SportSection[] = []) {
    if (sections.length) setOpenSections((current) => new Set([...current, ...sections]));
    if (advanced.length) setOpenAdvanced((current) => new Set([...current, ...advanced]));
  }

  function showError(message: string) {
    setError(message);
    const location = sectionForProfileError(message);
    if (location) reveal([location.section], location.advanced ? [location.section as SportSection] : []);
  }

  function restoreProfile(record: RecoveryDraft) {
    const recovered = parseProfileRecovery(record.payload);
    if (!recovered) { setError('This draft cannot be read. Discard it and start again.'); return; }
    if (recoveryPayload !== savedSnapshot && !window.confirm('Replace your current unsaved Profile changes with this recovered draft?')) return;
    if (record.baseline !== revision && !window.confirm('Your saved profile changed after this draft. Restore it for review? Nothing will be saved until you review and save the form.')) return;
    setName(recovered.name);
    setPerformanceProfile(recovered.profile);
    setRaceTimeDraft(recovered.raceTimeDraft);
    setCustomizedZones(recovered.customizedZones);
    setPaceDrafts(recovered.paceDrafts);
    const changed = changedTargetSections(savedSnapshot, recovered);
    reveal(changed.sections, changed.advanced);
    recovery.restored(record);
    setMessage('Profile draft restored. Review your changes, then save.');
  }

  function refreshCalculatedPaces(profile: PerformanceProfile) {
    const ranges = getRunningPaceZones(profile);
    setPaceDrafts((current) => Object.fromEntries(zones.map((zone) => {
      if (customizedZones[zone]) return [zone, current[zone]];
      const range = ranges[zone];
      return [zone, {
        fastest: range ? formatPaceSecondsPerKm(range.fastestSecPerKm) : '',
        slowest: range ? formatPaceSecondsPerKm(range.slowestSecPerKm) : '',
      }];
    })) as PaceDrafts);
  }

  function changeRaceDistance(value: string) {
    const distance = value ? Number(value) : null;
    const raceTimeSec = distance ? parseRaceTime(raceTimeDraft) : null;
    if (!distance) setRaceTimeDraft('');
    const next = { ...performanceProfile, running: { ...performanceProfile.running, raceDistanceMeters: distance, raceTimeSec } };
    setPerformanceProfile(next);
    refreshCalculatedPaces(next);
  }

  function changeRaceTime(value: string) {
    setRaceTimeDraft(value);
    const raceTimeSec = value.trim() ? parseRaceTime(value) : null;
    const next = {
      ...performanceProfile,
      running: {
        ...performanceProfile.running,
        raceDistanceMeters: value.trim() ? performanceProfile.running.raceDistanceMeters : null,
        raceTimeSec,
      },
    };
    setPerformanceProfile(next);
    refreshCalculatedPaces(next);
  }

  function changePaceBound(zone: TempoZone, bound: keyof PaceDraft, value: string) {
    setPaceDrafts((current) => ({ ...current, [zone]: { ...current[zone], [bound]: value } }));
    setCustomizedZones((current) => ({ ...current, [zone]: true }));
  }

  function resetPaceZones() {
    const resetZones = Object.fromEntries(zones.map((zone) => [zone, false])) as CustomizedZones;
    setCustomizedZones(resetZones);
    const nextProfile = {
      ...performanceProfile,
      running: {
        ...performanceProfile.running,
        paceZoneOverrides: createEmptyPaceOverrides(),
      },
    };
    setPerformanceProfile(nextProfile);
    const ranges = getRunningPaceZones(nextProfile);
    setPaceDrafts(Object.fromEntries(zones.map((zone) => {
      const range = ranges[zone];
      return [zone, {
        fastest: range ? formatPaceSecondsPerKm(range.fastestSecPerKm) : '',
        slowest: range ? formatPaceSecondsPerKm(range.slowestSecPerKm) : '',
      }];
    })) as PaceDrafts);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');

    const parsedRaceTime = raceTimeDraft.trim() ? parseRaceTime(raceTimeDraft) : null;
    if (raceTimeDraft.trim() && parsedRaceTime === null) {
      showError('Enter race time as mm:ss or h:mm:ss.');
      setSaving(false);
      return;
    }

    const overrides = Object.fromEntries(zones.map((zone) => {
      if (!customizedZones[zone]) return [zone, { fastestSecPerKm: null, slowestSecPerKm: null }];
      const fastestSecPerKm = parsePaceSecondsPerKm(paceDrafts[zone].fastest);
      const slowestSecPerKm = parsePaceSecondsPerKm(paceDrafts[zone].slowest);
      return [zone, { fastestSecPerKm, slowestSecPerKm }];
    })) as PerformanceProfile['running']['paceZoneOverrides'];
    const incompleteZone = zones.find((zone) => customizedZones[zone] && (overrides[zone].fastestSecPerKm === null || overrides[zone].slowestSecPerKm === null));
    if (incompleteZone) {
      showError(`Enter both Zone ${incompleteZone} paces as m:ss per kilometre, or reset the pace zones to their calculated defaults.`);
      setSaving(false);
      return;
    }

    const profileToSave: PerformanceProfile = {
      ...performanceProfile,
      running: {
        ...performanceProfile.running,
        raceTimeSec: parsedRaceTime,
        raceDistanceMeters: parsedRaceTime ? performanceProfile.running.raceDistanceMeters : null,
        paceZoneOverrides: overrides,
      },
    };
    const submittedSnapshot = getDraftSnapshot(name, profileToSave, raceTimeDraft, customizedZones, paceDrafts);
    const profileError = validatePerformanceProfile(profileToSave);
    if (profileError) {
      showError(profileError);
      setSaving(false);
      return;
    }

    let profileSaved = false;
    try {
      const res = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, performanceProfile: profileToSave, expectedUpdatedAt: revision }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({ error: 'Could not save profile' }));
        showError(payload.error ?? 'Could not save profile');
        setSaving(false);
        return;
      }

      const payload = await res.json() as { updatedAt: string };
      profileSaved = true;
      setRevision(payload.updatedAt);
      recovery.discard();
      setPerformanceProfile(profileToSave);
      setSavedSnapshot(submittedSnapshot);
      await update();
      router.refresh();
      setMessage('Profile updated. New workout blocks will use these zone defaults.');
    } catch {
      if (profileSaved) {
        setMessage('Your profile was saved. Reload if your account details do not refresh.');
      } else {
        setError('Could not reach Tempo. Your profile changes are still here; try saving again.');
      }
    }
    setSaving(false);
  }

  const heartRateZones = calculateOlympiatoppenHeartRateZones(performanceProfile.heartRateMaxBpm);
  const currentSnapshot = getDraftSnapshot(name, performanceProfile, raceTimeDraft, customizedZones, paceDrafts);
  const hasUnsavedChanges = currentSnapshot !== savedSnapshot;
  const thresholdZone = paceDrafts[4];
  const runningThresholdPace = thresholdZone.fastest && thresholdZone.slowest ? `${thresholdZone.fastest}–${thresholdZone.slowest}\u00A0/km` : null;
  const hasCustomPaces = zones.some((zone) => customizedZones[zone]);
  const raceDistanceLabel = raceDistances.find((distance) => distance.value === performanceProfile.running.raceDistanceMeters)?.label;
  const runningSource = hasCustomPaces ? 'Custom pace zones' : raceDistanceLabel && raceTimeDraft ? `From ${raceDistanceLabel} in ${raceTimeDraft}` : undefined;

  return (
    <div className="page-content--compact">
      <Surface>
        <DraftRecoveryNotice candidates={recovery.candidates} status={recovery.status} disabled={saving} onRestore={restoreProfile} onDiscard={recovery.discard} />
        <form id="profile-form" onSubmit={handleSubmit} onChangeCapture={() => { setError(''); setMessage(''); }} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className={formLabelClassName}>Display name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} disabled={saving} className={formFieldClassName} />
            </label>
            <div className="min-w-0 space-y-2">
              <p className={formLabelClassName}>Email</p>
              <p className="flex min-h-10 items-center rounded-lg border border-[var(--border)] bg-[var(--field-surface)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                <span className="min-w-0 wrap-anywhere">{account.email}</span>
              </p>
            </div>
          </div>

          <fieldset id="training-metrics" disabled={saving} className="scroll-mt-20 space-y-3 border-t border-[var(--border)] pt-5">
            <legend className="text-base font-semibold text-[var(--text)]">Training metrics</legend>
            <p className="max-w-[68ch] text-sm leading-6 text-[var(--text-secondary)]">Optional. New workout blocks use these for zone targets. Leave anything blank you don’t know.</p>
            <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
              <TargetRow id="heart-rate" title="Heart rate" metric="Maximum heart rate" value={performanceProfile.heartRateMaxBpm ? `${performanceProfile.heartRateMaxBpm}\u00A0bpm` : null} open={openSections.has('heart-rate')} onToggle={() => toggleSection('heart-rate')}>
                <div className="sm:max-w-xs">
                  <MetricInput label="Maximum heart rate (bpm)" value={performanceProfile.heartRateMaxBpm} min={100} max={250} onChange={(heartRateMaxBpm) => setPerformanceProfile((current) => ({ ...current, heartRateMaxBpm }))} />
                </div>
                {heartRateZones ? <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--text)]">Olympiatoppen heart-rate zones</h3>
                    <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">Calculated from your maximum heart rate. I-1 to I-5 are Olympiatoppen&apos;s effort levels; see the <a className="underline decoration-[var(--border)] underline-offset-4 hover:text-[var(--text)]" href="https://olt-skala.nif.no/" target="_blank" rel="noreferrer">Olympiatoppen calculator</a>.</p>
                  </div>
                  <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
                    {zones.map((zone) => {
                      const range = heartRateZones[zone];
                      const percentages = OLYMPIATOPPEN_HEART_RATE_PERCENT_BANDS[zone];
                      return <div key={zone} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 py-2 text-sm">
                        <span className="font-medium text-[var(--text)]">Zone {zone}&nbsp;· {zoneNames[zone]}</span>
                        <span className="tabular-nums text-[var(--text-secondary)]">I-{zone}&nbsp;· {percentages.low}–{percentages.high}%</span>
                        <span className="tabular-nums text-[var(--text-secondary)]">{range.low}–{range.high}&nbsp;bpm</span>
                      </div>;
                    })}
                  </div>
                </div> : <p className="text-sm text-[var(--text-secondary)]">Add maximum heart rate to calculate your Olympiatoppen heart-rate zones.</p>}
              </TargetRow>

              <TargetRow id="running" title="Running" metric="Threshold pace" value={runningThresholdPace} detail={runningSource} open={openSections.has('running')} onToggle={() => toggleSection('running')}>
                <p className="max-w-[68ch] text-sm leading-6 text-[var(--text-secondary)]">Enter a recent race result to estimate your pace for each zone.</p>
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,0.8fr)]">
                  <label className="block space-y-2">
                    <span className={formLabelClassName}>Race distance</span>
                    <select className={formSelectClassName} value={performanceProfile.running.raceDistanceMeters ?? ''} onChange={(event) => changeRaceDistance(event.target.value)}>
                      <option value="">Choose distance</option>
                      {raceDistances.map((distance) => <option key={distance.value} value={distance.value}>{distance.label}</option>)}
                    </select>
                  </label>
                  <label className="block space-y-2">
                    <span className={formLabelClassName}>Finish time</span>
                    <input className={formFieldClassName} inputMode="numeric" autoComplete="off" placeholder="45:00 or 1:45:00" aria-describedby="profile-race-time-help" value={raceTimeDraft} onChange={(event) => changeRaceTime(event.target.value)} />
                  </label>
                </div>
                <p id="profile-race-time-help" className="text-xs leading-5 text-[var(--text-secondary)]">Use mm:ss for races under an hour or h:mm:ss for longer races. You can also set pace ranges under Advanced targets.</p>
                <AdvancedTargets id="running" open={openAdvanced.has('running')} onToggle={() => toggleAdvanced('running')} note={hasCustomPaces ? 'Custom pace zones' : undefined}>
                  <div className="sm:max-w-xs">
                    <MetricInput label="Running threshold HR (bpm)" value={performanceProfile.running.thresholdHrBpm} onChange={(thresholdHrBpm) => setPerformanceProfile((current) => ({ ...current, running: { ...current.running, thresholdHrBpm } }))} />
                  </div>
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--text)]">Running pace zones</h3>
                      <p className="mt-1 max-w-[68ch] text-sm leading-6 text-[var(--text-secondary)]">Starting bands use 65–75%, 75–85%, 85–93%, 93–103%, and 103–115% of race speed. These are editable Tempo estimates, not Olympiatoppen pace bands.</p>
                    </div>
                    <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 border-b border-[var(--border)] pb-2 text-xs font-semibold text-[var(--text-secondary)] sm:gap-4">
                      <span>Zone</span><span>Fastest /km</span><span>Slowest /km</span>
                    </div>
                    <div className="space-y-3">
                      {zones.map((zone) => <div key={zone} className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 sm:gap-4">
                        <span className="text-sm font-medium text-[var(--text)]">Zone {zone}<span className="hidden text-[var(--text-secondary)] sm:inline"> · {zoneNames[zone]}</span></span>
                        <PaceInput label={`Zone ${zone} fastest pace per kilometre`} value={paceDrafts[zone].fastest} onChange={(value) => changePaceBound(zone, 'fastest', value)} />
                        <PaceInput label={`Zone ${zone} slowest pace per kilometre`} value={paceDrafts[zone].slowest} onChange={(value) => changePaceBound(zone, 'slowest', value)} />
                      </div>)}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
                      <p className="max-w-[52ch] text-xs leading-5 text-[var(--text-secondary)]">Race results fill the editable ranges; reset to return to those calculated values. Pace is stored as seconds per kilometre.</p>
                      <button type="button" disabled={saving} className="min-h-10 text-sm font-medium text-[var(--text-secondary)] underline max-md:min-h-11 decoration-[var(--border)] underline-offset-4 control-hover:text-[var(--text)] disabled:opacity-60" onClick={() => { resetPaceZones(); setError(''); setMessage(''); }}>{performanceProfile.running.raceDistanceMeters && performanceProfile.running.raceTimeSec ? 'Reset to calculated paces' : 'Clear pace overrides'}</button>
                    </div>
                  </div>
                </AdvancedTargets>
              </TargetRow>

              <TargetRow id="cycling" title="Cycling" metric="Threshold power (FTP)" value={performanceProfile.cycling.ftpWatts ? `${performanceProfile.cycling.ftpWatts}\u00A0W` : null} open={openSections.has('cycling')} onToggle={() => toggleSection('cycling')}>
                <div className="sm:max-w-xs">
                  <MetricInput label="Cycling threshold power (FTP, W)" value={performanceProfile.cycling.ftpWatts} onChange={(ftpWatts) => setPerformanceProfile((current) => ({ ...current, cycling: { ...current.cycling, ftpWatts } }))} />
                </div>
                <AdvancedTargets id="cycling" open={openAdvanced.has('cycling')} onToggle={() => toggleAdvanced('cycling')}>
                  <div className="sm:max-w-xs">
                    <MetricInput label="Cycling threshold HR (bpm)" value={performanceProfile.cycling.thresholdHrBpm} onChange={(thresholdHrBpm) => setPerformanceProfile((current) => ({ ...current, cycling: { ...current.cycling, thresholdHrBpm } }))} />
                  </div>
                </AdvancedTargets>
              </TargetRow>

              <TargetRow id="swimming" title="Swimming" metric="Threshold pace (CSS)" value={performanceProfile.swimming.cssSecPer100m ? `${formatSwimPace(performanceProfile.swimming.cssSecPer100m)}\u00A0/100 m` : null} open={openSections.has('swimming')} onToggle={() => toggleSection('swimming')}>
                <div className="sm:max-w-xs">
                  <MetricInput label="Swimming threshold pace (CSS, sec/100 m)" value={performanceProfile.swimming.cssSecPer100m} onChange={(cssSecPer100m) => setPerformanceProfile((current) => ({ ...current, swimming: { ...current.swimming, cssSecPer100m } }))} />
                </div>
                <AdvancedTargets id="swimming" open={openAdvanced.has('swimming')} onToggle={() => toggleAdvanced('swimming')}>
                  <div className="sm:max-w-xs">
                    <MetricInput label="Swimming threshold HR (bpm)" value={performanceProfile.swimming.thresholdHrBpm} onChange={(thresholdHrBpm) => setPerformanceProfile((current) => ({ ...current, swimming: { ...current.swimming, thresholdHrBpm } }))} />
                  </div>
                </AdvancedTargets>
              </TargetRow>
            </div>
            <p className="max-w-[68ch] text-xs leading-5 text-[var(--text-secondary)]">Saved workouts keep their settings; profile-based targets use your latest values.</p>
          </fieldset>
        </form>
      </Surface>

      {savebarPortalReady ? createPortal(<footer className="profile-savebar" aria-label="Profile save controls">
        <div className="profile-savebar__inner">
          <div className="profile-savebar__copy">
            {error ? (
              <p role="alert" className={`${dangerTextClassName} profile-savebar__status`}>
                <span className="profile-savebar__indicator profile-savebar__indicator--error" aria-hidden="true" />
                {error}
              </p>
            ) : (
              <>
                <p role="status" aria-live="polite" aria-atomic="true" className={`profile-savebar__status ${saving ? 'profile-savebar__status--saving' : hasUnsavedChanges ? 'profile-savebar__status--dirty' : 'profile-savebar__status--saved'}`}>
                  <span className={`profile-savebar__indicator ${saving ? 'profile-savebar__indicator--saving' : hasUnsavedChanges ? 'profile-savebar__indicator--dirty' : 'profile-savebar__indicator--saved'}`} aria-hidden="true" />
                  {saving ? 'Saving profile…' : hasUnsavedChanges ? 'Unsaved changes' : 'All changes saved'}
                </p>
                {!hasUnsavedChanges && !saving && message ? <p className={`profile-savebar__detail ${successTextClassName}`}>{message}</p> : null}
              </>
            )}
          </div>
          <button form="profile-form" type="submit" disabled={saving || !hasUnsavedChanges} className={`${primaryButtonClassName} profile-savebar__button max-md:min-h-11`}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </footer>, document.body) : null}
    </div>
  );
}

function getDraftSnapshot(name: string, profile: PerformanceProfile, raceTimeDraft: string, customizedZones: CustomizedZones, paceDrafts: PaceDrafts): string {
  return JSON.stringify({ name, profile, raceTimeDraft, customizedZones, paceDrafts });
}

/** One sport (or heart rate) with its key value; tapping the row opens its fields. */
function TargetRow({ id, title, metric, value, detail, open, onToggle, children }: { id: TargetSection; title: string; metric: string; value: string | null; detail?: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  const panelId = `${id}-targets`;
  return <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-20">
    <h3 id={`${id}-heading`} className="m-0">
      <button type="button" aria-expanded={open} aria-controls={panelId} onClick={onToggle} className={`flex min-h-14 w-full items-center gap-3 rounded-lg py-3 text-left transition-colors hover:bg-[var(--raised)] max-md:min-h-16 sm:-mx-2 sm:w-[calc(100%+1rem)] sm:px-2 ${buttonFocusClassName}`}>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-[var(--text)]">{title}</span>
          <span className="block text-xs text-[var(--text-muted)]">{metric}{detail ? `\u00A0· ${detail}` : ''}</span>
        </span>
        {value ? <span className="data shrink-0 text-sm text-[var(--text)]">{value}</span> : <span className="shrink-0 text-sm font-medium text-[var(--brand)]">Add</span>}
        <ChevronDown aria-hidden="true" size={16} strokeWidth={1.8} className={`shrink-0 text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
    </h3>
    {open ? <div id={panelId} className="space-y-4 pb-5 pt-1">{children}</div> : null}
  </section>;
}

function AdvancedTargets({ id, open, onToggle, note, children }: { id: SportSection; open: boolean; onToggle: () => void; note?: string; children: ReactNode }) {
  const panelId = `${id}-advanced-targets`;
  return <div className="border-t border-[var(--border)] pt-3">
    <button type="button" aria-expanded={open} aria-controls={panelId} onClick={onToggle} className={`-ml-2 inline-flex min-h-10 items-center max-md:min-h-11 gap-1.5 rounded-lg px-2 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--raised)] hover:text-[var(--text)] ${buttonFocusClassName}`}>
      <ChevronDown aria-hidden="true" size={16} strokeWidth={1.8} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      Advanced targets{note ? <span className="font-normal text-[var(--text-muted)]"> · {note}</span> : null}
    </button>
    {open ? <div id={panelId} className="mt-3 space-y-5">{children}</div> : null}
  </div>;
}

/** Maps a profile validation message to the section, and whether its Advanced targets, holding that field. */
function sectionForProfileError(message: string): { section: TargetSection; advanced: boolean } | null {
  if (/Maximum heart rate/.test(message)) return { section: 'heart-rate', advanced: false };
  if (/^Cycling/.test(message)) return { section: 'cycling', advanced: /heart rate/.test(message) };
  if (/^Swimming/.test(message)) return { section: 'swimming', advanced: /heart rate/.test(message) };
  if (/Zone \d|pace zones|^Running threshold/.test(message)) return { section: 'running', advanced: true };
  if (/race|Race/.test(message)) return { section: 'running', advanced: false };
  return null;
}

/** Sections a recovered draft changes relative to the saved profile, so restored values are visible. */
function changedTargetSections(savedSnapshot: string, recovered: { profile: PerformanceProfile; raceTimeDraft: string; customizedZones: CustomizedZones; paceDrafts: PaceDrafts }) {
  const saved = JSON.parse(savedSnapshot) as { profile: PerformanceProfile; raceTimeDraft: string; customizedZones: CustomizedZones; paceDrafts: PaceDrafts };
  const differs = (a: unknown, b: unknown) => JSON.stringify(a) !== JSON.stringify(b);
  const sections: TargetSection[] = [];
  const advanced: SportSection[] = [];
  if (differs(saved.profile.heartRateMaxBpm, recovered.profile.heartRateMaxBpm)) sections.push('heart-rate');
  const runningAdvanced = differs(saved.profile.running.thresholdHrBpm, recovered.profile.running.thresholdHrBpm) || differs(saved.customizedZones, recovered.customizedZones) || zones.some((zone) => recovered.customizedZones[zone] && differs(saved.paceDrafts[zone], recovered.paceDrafts[zone]));
  if (runningAdvanced || differs(saved.raceTimeDraft, recovered.raceTimeDraft) || differs(saved.profile.running.raceDistanceMeters, recovered.profile.running.raceDistanceMeters)) sections.push('running');
  if (runningAdvanced) advanced.push('running');
  for (const sport of ['cycling', 'swimming'] as const) {
    const before = saved.profile[sport] as Record<string, unknown>;
    const after = recovered.profile[sport] as Record<string, unknown>;
    const hrChanged = differs(before.thresholdHrBpm, after.thresholdHrBpm);
    if (hrChanged || differs({ ...before, thresholdHrBpm: null }, { ...after, thresholdHrBpm: null })) sections.push(sport);
    if (hrChanged) advanced.push(sport);
  }
  return { sections, advanced };
}

function formatSwimPace(secondsPer100m: number): string {
  const rounded = Math.round(secondsPer100m);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}

function MetricInput({ label, value, onChange, min = 1, max = 1000000 }: { label: string; value: number | null; onChange: (value: number | null) => void; min?: number; max?: number }) {
  const inputId = useId();
  return <div className="block space-y-2"><label htmlFor={inputId} className={formLabelClassName}>{label}</label><input id={inputId} className={formFieldClassName} type="number" min={min} max={max} step="1" value={value ?? ''} onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))} /></div>;
}

function PaceInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const inputId = useId();
  return <div><label htmlFor={inputId} className="sr-only">{label}</label><input id={inputId} className={formFieldClassName} inputMode="numeric" autoComplete="off" placeholder="m:ss" value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}

function createPaceDrafts(profile: PerformanceProfile): PaceDrafts {
  const ranges = getRunningPaceZones(profile);
  return Object.fromEntries(zones.map((zone) => {
    const override = profile.running.paceZoneOverrides[zone];
    const range = ranges[zone];
    return [zone, {
      fastest: override.fastestSecPerKm !== null ? formatPaceSecondsPerKm(override.fastestSecPerKm) : range ? formatPaceSecondsPerKm(range.fastestSecPerKm) : '',
      slowest: override.slowestSecPerKm !== null ? formatPaceSecondsPerKm(override.slowestSecPerKm) : range ? formatPaceSecondsPerKm(range.slowestSecPerKm) : '',
    }];
  })) as PaceDrafts;
}

function createEmptyPaceOverrides(): PerformanceProfile['running']['paceZoneOverrides'] {
  return Object.fromEntries(zones.map((zone) => [zone, { fastestSecPerKm: null, slowestSecPerKm: null }])) as PerformanceProfile['running']['paceZoneOverrides'];
}

function parseRaceTime(input: string): number | null {
  const parts = input.trim().split(':');
  if (parts.some((part) => !/^\d+$/.test(part))) return null;
  if (parts.length === 2) {
    const minutes = Number(parts[0]);
    const seconds = Number(parts[1]);
    if (seconds > 59) return null;
    const total = minutes * 60 + seconds;
    return total >= 180 && total <= 86400 ? total : null;
  }
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts.map(Number);
    if (minutes > 59 || seconds > 59 || hours > 24) return null;
    const total = hours * 3600 + minutes * 60 + seconds;
    return total >= 180 && total <= 86400 ? total : null;
  }
  return null;
}

function formatRaceTime(seconds: number | null): string {
  if (seconds === null) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}` : `${minutes}:${String(remainder).padStart(2, '0')}`;
}
