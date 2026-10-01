# Imported workout interpretation

Implemented first version, 2026-10-01. Deployment and live-provider gates are
recorded in [current status](agent-workspace/CURRENT-STATUS.md).

## Product contract

An accepted, independently supplied running file can be interpreted in the
background after explicit opt-in. Session review shows a readable explanation,
detected efforts and recoveries, pooled interval pace, estimated intensity,
likely intended structure and a colorful duration-proportional workout timeline.
People can confirm their intended repetitions, duration, recovery and target pace.
That confirmation is separate from recorded measurements and existing plans.

Initial segmentation is deliberately straightforward. Reliable segmentation,
calibration and benchmarking follow this complete pipeline; uncertain or missing
data must already remain visible. A zone estimate describes recorded intensity,
not a measured physiological adaptation or energy-system percentage.

Strava API data is excluded from analysis and model history. Its current API
policy restricts AI use and analytics; independent file import must not be used
to relabel API-derived data. Source permission remains a gate for any future
Strava extension. [Strava API policy](https://www.strava.com/legal/api_policy).

## Implemented architecture

```text
Explicit running file import + opt-in
  -> Activity and ActivityAnalysis committed together
  -> bounded worker claims a leased job
  -> pure measured evidence and candidate structures
  -> optional bounded model explanation/candidate selection
  -> validation and lease/input-hash publication checks
  -> owned session review
```

| Owner | Responsibility |
|---|---|
| lib/activity-file-parser.ts, lib/activity-laps.ts | TCX/FIT lap boundaries, elapsed and timer durations, validated ordered laps |
| lib/activity-metrics.ts | Backward-compatible telemetry v1/v2 parsing; v2 carries laps |
| lib/activity-import-service.ts | Validated opt-in and transactional nested analysis creation after accepted import |
| lib/activity-analysis.ts | Pure segmentation, measured spans, pooled pace, profile zones, candidate structure and cautious emphasis |
| lib/activity-analysis-job.ts | Source eligibility, analyzer version and stable input identity |
| lib/activity-analysis-llm.ts, lib/workout-llm.ts | Compact evidence, shared bounded provider transport, response validation and code fallback |
| lib/activity-analysis-service.ts | Ownership, manual requests, leases/retries, current result and separate correction persistence |
| /api/activity-imports/[activityId]/analysis | Thin authenticated read/request/correction API |
| /api/activity-analysis/worker | Secret-authenticated worker; browser-independent queue delivery |
| lib/activity-analysis-view.ts, components/ImportedWorkoutAnalysis.tsx | Timeline adapter and review using shared SessionBlockBar |

One ActivityAnalysis row owns the current job and result for each Activity,
avoiding separate duplicate job/result state. Activity deletion cascades to the
row. Reanalysis replaces the current result while preserving user confirmation;
it does not keep a result history. Profile values are snapshotted with the job.

Claims use short PostgreSQL transactions and a global advisory lock. At most four
live leases process concurrently; each worker invocation considers at most two
jobs. Leases last two minutes and attempts are bounded at three. Publication
checks source, input hash, row existence and the unexpired lease token. A deleted
activity or superseded worker cannot recreate or publish a result. Manual
requests are duplicate-safe, capped at ten active jobs per owner and subject to
a one-minute reanalysis cooldown. Initial import enqueue is atomic and does not
apply that manual queue cap. There is no daily provider budget in this version.

Import and authenticated pending reads use Next.js after() for prompt delivery.
A scheduled worker request is required for durable delivery and retry recovery
without a browser visit; no scheduler is automatically provisioned.

## Evidence and inference

The analyzer uses valid adjacent measurement spans up to fifteen seconds apart,
with cumulative distance or integrated speed. It never fills long gaps with a
last known value. Five-second speed ranges identify sustained contrasts, merge
brief excursions and group repeated efforts. Consistent laps refine boundaries.
Unknown lap origin stays unknown; a distance split is not automatically a rep.

Average interval pace is calculated in code:

`secondsPerKm = 1000 * sum(coveredEffortSeconds) / sum(coveredEffortDistanceMeters)`

Warm-up, recovery, cool-down and unknown ranges are excluded. Observed effort
boundaries, rather than rounded intentions, define work time. Measurable stops
count as time. Partial recordings show coverage and a covered-spans estimate;
missing distance produces an unavailable pace. Clipped spans integrate only their overlapping speed and HR portion. The evidence table exposes
per-segment duration, pace, heart rate, separate pace/HR zones and coverage. Substantial zone disagreement adds an explicit limitation.

Repeated efforts around 238, 241 and 239 seconds may suggest four minutes.
Consistent fifty-three-second efforts remain fifty-three seconds. Common human
durations have a small tolerance, not forced rounding. Observed, common-duration
and distance candidates are retained where supported. Continuous and
insufficient-data recordings remain explicit. The estimated steady target uses
middle portions of comparable efforts. Pace and HR zones are calculated
separately from Profile; unknown profile values yield unknown zones. Timeline
color uses pace when available, otherwise HR, and states that basis.

The optional model receives at most one hundred compact segments, calculated
metrics, candidates and limitations. It receives no identity, location, private
notes, raw streams or unrelated history. Its schema limits selection to the supplied candidate IDs, preserves the preferred candidate on ties and warns against claiming within-effort variation from averages alone. It selects a supplied candidate ID and
adds a short explanation. The server validates candidate, output shape and
length, rejects numeric/unsupported claim content and retains code-owned
measurements. Invalid output, missing configuration or provider failure returns
the calculated interpretation. Structured prompts include time, irregular and
distance examples and warn against rounding genuine short repetitions.

Training emphasis is a cautious code-derived description with qualitative
support, not calibrated probability. Recorded HR lag and disagreement with pace
remain limitations; the result does not prescribe future training.

## Review and future optimization

The recorded-activity section places explanation and pooled metrics above an
actual-duration colorful score. Shared workout colors and neutral unknown blocks
preserve Monolith. Evidence and intended-workout correction expand beneath it;
the detailed table scrolls independently on small screens. Import opt-in is per
file; existing eligible activities have an explicit Analyze action.

Deferred: timer-event streams, richer split provenance, terrain/power-aware
segmentation, mixed sets, calibrated grades per inference, labelled real-file
benchmarks, saved-plan-aware model context, historical result versions, global
preferences and daily provider quotas. Saved plans already remain independent.
Live model output and production scheduler delivery require acceptance before
claiming production readiness. Strava eligibility requires a separately resolved
permission gate.
