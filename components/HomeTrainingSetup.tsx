'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Check, HeartPulse } from 'lucide-react';
import { formFieldClassName, formLabelClassName, formSelectClassName, primaryButtonClassName, secondaryButtonClassName } from '@/components/ui';
import { validatePerformanceProfile, type PerformanceProfile } from '@/lib/performance-profile';
import { calculateOlympiatoppenHeartRateZones, formatPaceSecondsPerKm, getRunningPaceZones, parsePaceSecondsPerKm } from '@/lib/profile-training-zones';
import { formatTrainingTime, hasTrainingSportTargets, parseTrainingTime, trainingSetupComplete, trainingSports, type TrainingSport } from '@/lib/training-setup';

type Props = { profile: PerformanceProfile; sports: TrainingSport[] | null; revision: string };
const names = { running: 'Running', cycling: 'Cycling', swimming: 'Swimming' };
const zones = [1, 2, 3, 4, 5] as const;

export function HomeTrainingSetup({ profile: initialProfile, sports: initialSports, revision: initialRevision }: Props) {
  const router = useRouter();
  const heading = useRef<HTMLHeadingElement>(null);
  const [profile, setProfile] = useState(initialProfile);
  const [sports, setSports] = useState<TrainingSport[]>(initialSports ?? []);
  const [savedSports, setSavedSports] = useState(initialSports);
  const [revision, setRevision] = useState(initialRevision);
  const [step, setStep] = useState('sports');
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [raceTime, setRaceTime] = useState(formatTrainingTime(initialProfile.running.raceTimeSec));
  const [swimPace, setSwimPace] = useState(formatTrainingTime(initialProfile.swimming.cssSecPer100m));
  const [manualPaces, setManualPaces] = useState<Record<number, { fastest: string; slowest: string }>>({});
  const [saved, setSaved] = useState(JSON.stringify({ profile: initialProfile, sports: initialSports ?? [], raceTime: formatTrainingTime(initialProfile.running.raceTimeSec), swimPace: formatTrainingTime(initialProfile.swimming.cssSecPer100m) }));
  const snapshot = JSON.stringify({ profile, sports, raceTime, swimPace });
  const dirty = snapshot !== saved || Object.keys(manualPaces).length > 0;
  const complete = savedSports !== null && trainingSetupComplete(JSON.parse(saved).profile, savedSports);
  const alreadyComplete = initialSports === null && trainingSetupComplete(initialProfile, [...trainingSports]);
  const steps = ['sports', 'heart', ...sports];
  const position = steps.indexOf(step);
  const hrZones = calculateOlympiatoppenHeartRateZones(profile.heartRateMaxBpm);
  const paceZones = getRunningPaceZones(profile);
  const savedProfile: PerformanceProfile = JSON.parse(saved).profile;
  const missing = [
    ...(savedProfile.heartRateMaxBpm === null ? ['maximum heart rate'] : []),
    ...(savedSports ?? []).filter((sport) => !hasTrainingSportTargets(savedProfile, sport)).map((sport) => `${names[sport].toLowerCase()} targets`),
  ];
  const resumeStep = savedProfile.heartRateMaxBpm === null ? 'heart' : (savedSports ?? []).find((sport) => !trainingSetupComplete(savedProfile, [sport])) ?? 'sports';

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const guard = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest('a[href]') && !window.confirm('Leave Home and lose unsaved training settings?')) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', guard, true);
    return () => { window.removeEventListener('beforeunload', warn); document.removeEventListener('click', guard, true); };
  }, [dirty]);

  function move(next: string) {
    setStep(next); setError('');
    requestAnimationFrame(() => heading.current?.focus());
  }

  async function save(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage('');
    if (!sports.length) { setError('Choose the sports you train so we can show the right settings.'); return; }
    const next = structuredClone(profile);
    if (raceTime !== formatTrainingTime(profile.running.raceTimeSec) || step === 'running') {
      const time = raceTime.trim() ? parseTrainingTime(raceTime) : null;
      if (raceTime.trim() && time === null) { setError('Enter your race time as mm:ss or h:mm:ss.'); return; }
      next.running.raceTimeSec = time;
    }
    if (swimPace !== formatTrainingTime(profile.swimming.cssSecPer100m) || step === 'swimming') {
      const pace = swimPace.trim() ? parseTrainingTime(swimPace) : null;
      if (swimPace.trim() && (pace === null || pace < 20 || pace > 1800)) { setError('Enter a swimming pace from 0:20 to 30:00 per 100 m.'); return; }
      next.swimming.cssSecPer100m = pace;
    }
    for (const zone of zones) {
      const draft = manualPaces[zone];
      if (!draft) continue;
      const fastest = draft.fastest.trim() ? parsePaceSecondsPerKm(draft.fastest) : null;
      const slowest = draft.slowest.trim() ? parsePaceSecondsPerKm(draft.slowest) : null;
      if ((draft.fastest.trim() || draft.slowest.trim()) && (fastest === null || slowest === null)) { setError(`Enter both Zone ${zone} pace bounds as m:ss per kilometre (2:00 to 30:00).`); return; }
      next.running.paceZoneOverrides[zone] = { fastestSecPerKm: fastest, slowestSecPerKm: slowest };
    }
    const validation = validatePerformanceProfile(next);
    if (validation) { setError(validation); return; }
    setSaving(true);
    try {
      const response = await fetch('/api/account/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ performanceProfile: next, trainingSports: sports, expectedUpdatedAt: revision }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Settings could not be saved. Try again.');
      setRevision(result.updatedAt); setProfile(next); setSavedSports([...sports]);
      setManualPaces({});
      setSaved(JSON.stringify({ profile: next, sports, raceTime, swimPace }));
      setMessage('Training settings saved.');
      if (position < steps.length - 1) move(steps[position + 1]);
      else { setExpanded(false); router.refresh(); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Connection lost. Your entries are still here. Try saving again.'); }
    finally { setSaving(false); }
  }

  if (alreadyComplete) return null;
  if (complete && !expanded) return message ? <p className="training-setup__success" role="status"><Check size={18} aria-hidden="true" /> Your training targets are ready. You can update them anytime in Profile.</p> : null;

  return <section className="training-setup" aria-labelledby="training-setup-title">
    <div className="training-setup__intro">
      <HeartPulse size={24} aria-hidden="true" className="training-setup__icon" />
      <div><h2 id="training-setup-title">Set up your training targets</h2><p>Make your workouts personal. Add your maximum heart rate and sport settings to turn workout intensity into BPM, pace and power targets that fit you.</p></div>
      {!expanded && <button type="button" className={primaryButtonClassName} onClick={() => { setExpanded(true); move(savedSports ? resumeStep : 'sports'); }}>{savedSports ? 'Continue setup' : 'Set up my targets'}</button>}
    </div>
    {!expanded && <p className="training-setup__note">Only set up the sports you train. No need to guess unknown values.</p>}
    {!expanded && savedSports && missing.length > 0 && <p className="training-setup__note">Still to set: {missing.join(', ')}.</p>}
    {expanded && <form onSubmit={save} className="training-setup__form">
      <fieldset disabled={saving} className="training-setup__fieldset">
        <nav aria-label="Training setup steps" className="training-setup__steps">{steps.map((item, index) => <button key={item} type="button" aria-current={step === item ? 'step' : undefined} onClick={() => move(item)}><span>{index + 1}</span>{item === 'sports' ? 'Your sports' : item === 'heart' ? 'Heart rate' : names[item as TrainingSport]}</button>)}</nav>
        <div className="training-setup__body">
          <h3 ref={heading} tabIndex={-1}>{step === 'sports' ? 'Which sports do you train?' : step === 'heart' ? 'Start with your maximum heart rate' : `${names[step as TrainingSport]} targets`}</h3>
          {step === 'sports' && <><p>Choose what matters to you. You can change this selection here while setup is incomplete.</p><div className="training-setup__sports">{trainingSports.map((sport) => <label key={sport}><input type="checkbox" checked={sports.includes(sport)} onChange={(event) => setSports((current) => event.target.checked ? trainingSports.filter((item) => current.includes(item) || item === sport) : current.filter((item) => item !== sport))} />{names[sport]}</label>)}</div></>}
          {step === 'heart' && <><p>Your maximum heart rate sets the BPM ranges for your five intensity zones. Use a value you know from your training or a test; leave it blank if you do not know it yet.</p><NumberField label="Maximum heart rate (bpm)" min={100} max={250} value={profile.heartRateMaxBpm} onChange={(value) => setProfile({ ...profile, heartRateMaxBpm: value })} />{hrZones && <div className="training-setup__zones" aria-label="Heart-rate zone preview">{zones.map((zone) => <div key={zone}><span>Zone {zone}</span><strong>{hrZones[zone].low}–{hrZones[zone].high} bpm</strong></div>)}</div>}</>}
          {step === 'running' && <><p>A recent race result gives you starting pace ranges for all five zones. Tempo estimates these ranges; review and fine-tune them in Profile.</p><div className="training-setup__fields"><label className={formLabelClassName}>Race distance<select className={formSelectClassName} value={profile.running.raceDistanceMeters ?? ''} onChange={(event) => { const distance = event.target.value ? Number(event.target.value) : null; setProfile({ ...profile, running: { ...profile.running, raceDistanceMeters: distance, raceTimeSec: distance ? parseTrainingTime(raceTime) : null } }); if (!distance) setRaceTime(''); }}><option value="">Choose a distance</option>{[[3000, '3 km'], [5000, '5 km'], [10000, '10 km'], [21097, 'Half marathon'], [42195, 'Marathon']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><TextField label="Finish time (mm:ss or h:mm:ss)" value={raceTime} placeholder="45:00" onChange={(value) => { setRaceTime(value); setProfile({ ...profile, running: { ...profile.running, raceTimeSec: parseTrainingTime(value) } }); }} /></div>{Object.keys(paceZones).length > 0 && <div className="training-setup__zones" aria-label="Running pace zone preview">{zones.map((zone) => paceZones[zone] && <div key={zone}><span>Zone {zone}</span><strong>{formatPaceSecondsPerKm(paceZones[zone]!.fastestSecPerKm)}–{formatPaceSecondsPerKm(paceZones[zone]!.slowestSecPerKm)} /km</strong></div>)}</div>}<PaceZoneFields profile={profile} drafts={manualPaces} onChange={(zone, draft) => setManualPaces((current) => ({ ...current, [zone]: draft }))} /><NumberField label="Running threshold heart rate (bpm, optional)" value={profile.running.thresholdHrBpm} min={1} max={250} onChange={(value) => setProfile({ ...profile, running: { ...profile.running, thresholdHrBpm: value } })} /></>}
          {step === 'cycling' && <><p>FTP is your cycling threshold power in watts. Enter your current test or device value to personalise power targets. Leave it blank if unknown.</p><NumberField label="Cycling threshold power / FTP (watts)" value={profile.cycling.ftpWatts} min={1} max={2000} onChange={(value) => setProfile({ ...profile, cycling: { ...profile.cycling, ftpWatts: value } })} /><NumberField label="Cycling threshold heart rate (bpm, optional)" value={profile.cycling.thresholdHrBpm} min={1} max={250} onChange={(value) => setProfile({ ...profile, cycling: { ...profile.cycling, thresholdHrBpm: value } })} /></>}
          {step === 'swimming' && <><p>Critical swim speed (CSS) is your threshold pace per 100 metres. Enter a pace from your swim test to personalise swimming targets. Leave it blank if unknown.</p><TextField label="Swimming threshold pace / CSS (m:ss per 100 m)" value={swimPace} placeholder="1:45" onChange={setSwimPace} /><NumberField label="Swimming threshold heart rate (bpm, optional)" value={profile.swimming.thresholdHrBpm} min={1} max={250} onChange={(value) => setProfile({ ...profile, swimming: { ...profile.swimming, thresholdHrBpm: value } })} /></>}
        </div>
        <div className="training-setup__actions"><button className={primaryButtonClassName} type="submit">{saving ? 'Saving…' : position === steps.length - 1 ? 'Save and finish' : 'Save and continue'}</button>{position > 0 && <button type="button" className={secondaryButtonClassName} onClick={() => move(steps[position - 1])}>Back</button>}<button type="button" className={secondaryButtonClassName} onClick={() => { if (!dirty || window.confirm('Close setup and discard unsaved changes?')) { const previous = JSON.parse(saved); setProfile(previous.profile); setSports(previous.sports); setRaceTime(previous.raceTime); setSwimPace(previous.swimPace); setManualPaces({}); setExpanded(false); setError(''); } }}>Continue later</button></div>
      </fieldset>
      {error && <p role="alert" className="training-setup__error">{error}</p>}
      {message && !dirty && <p role="status" className="training-setup__note">{message}</p>}
      {dirty && <p role="status" className="training-setup__note">Unsaved changes. Save this step to keep them.</p>}
      <p className="training-setup__note">Each step saves to your Profile. Blank settings stay incomplete so you can return later.</p>
    </form>}
  </section>;
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number | null; min: number; max: number; onChange: (value: number | null) => void }) {
  const id = useId();
  return <div className="training-setup__field"><label htmlFor={id} className={formLabelClassName}>{label}</label><input id={id} className={formFieldClassName} type="number" min={min} max={max} step="1" value={value ?? ''} onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))} /></div>;
}
function TextField({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  const id = useId();
  return <div className="training-setup__field"><label htmlFor={id} className={formLabelClassName}>{label}</label><input id={id} className={formFieldClassName} inputMode="text" autoComplete="off" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /></div>;
}

function PaceZoneFields({ profile, drafts, onChange }: { profile: PerformanceProfile; drafts: Record<number, { fastest: string; slowest: string }>; onChange: (zone: number, draft: { fastest: string; slowest: string }) => void }) {
  const ranges = getRunningPaceZones(profile);
  return <details className="training-setup__manual"><summary>Set or adjust running paces manually</summary><p className="training-setup__note">Already know your zones? Enter both bounds for each zone, from faster to slower. Without a race result, set all five zones. Clear both bounds to use the race estimate. Existing custom ranges are preserved.</p><div className="training-setup__body">{zones.map((zone) => {
    const range = ranges[zone];
    const draft = drafts[zone] ?? { fastest: range ? formatPaceSecondsPerKm(range.fastestSecPerKm) : '', slowest: range ? formatPaceSecondsPerKm(range.slowestSecPerKm) : '' };
    return <div key={zone} className="training-setup__fields"><TextField label={`Zone ${zone} faster pace (m:ss /km)`} value={draft.fastest} placeholder="m:ss" onChange={(fastest) => onChange(zone, { ...draft, fastest })} /><TextField label={`Zone ${zone} slower pace (m:ss /km)`} value={draft.slowest} placeholder="m:ss" onChange={(slowest) => onChange(zone, { ...draft, slowest })} /></div>;
  })}</div></details>;
}
