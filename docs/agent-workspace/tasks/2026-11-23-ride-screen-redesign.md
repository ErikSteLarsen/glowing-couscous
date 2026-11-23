# Task: Refine the active indoor ride screen

- **Status:** `in-progress`
- **Owner:** Erik and Codex
- **Started / updated:** 2026-11-23 / 2026-11-23
- **Capabilities:** `RIDE-001`

## Goal and scope

Try the Focus concept in the active ride route locally. Prioritize live power,
cadence and current-interval averages, with the countdown, profile and controls
within reach. Keep Course and YouTube in the standalone concept preview.
Production and release workflows are out of scope.

## Next steps

- [x] Implement the Focus candidate in the active ride view.
- [x] Verify on a local test database and record the checks.
- [ ] Review the candidate with Erik before choosing a direction.

## Current evidence

Local checks and browser results are recorded in [Current status](../CURRENT-STATUS.md).
The candidate is ready for Erik to try at `http://localhost:3217/athlete/ride/4`
using the demo Athlete credentials. Physical Bluetooth testing is open.

## Revision 2 (2026-11-23)

The live view now shows live power, target (ERG target when on), heart rate
and cadence. Averages for the current interval and the whole workout sit in a
compact table. The More data toggle (remembered per browser) shows %FTP, NP,
max power, average cadence, max HR, work, TSS, IF and distance. The ERG toggle
is in the header and is disabled until a controllable trainer is connected. The
intensity stepper sits beside the target, and a shortcut legend replaces
Advanced options (hidden on touch screens). `pnpm test` (560 passed, 17
skipped), `pnpm lint` and `tsc` passed. Browser check at 1440×900 and 390×844
without devices. Finish auto-saved demo ride 3; ride 4 is a fresh copy.

## Revision 3 (2026-11-23)

Metrics are now one table: rows for power, heart rate and cadence; columns for
now, interval average and workout average. Target and the on/below/above-target
bar sit with live power. The header separates trainer control (ERG and intensity)
from Pause and Finish. Interval navigation (Previous and Next interval, keys B
and N) sits on the interval row. `previousStep` in the recorder closes the lap
and restarts the previous interval in a new lap. Letter shortcuts now work while
a button has focus; Space still activates a focused button. Checked in headless
Chromium with a simulated FTMS trainer (power, cadence, heart rate and ERG
control-point responses): ERG target delivery, ERG off by key, Previous
restoring the 180 W target, and desktop and 390 px layouts. `pnpm test` (561
passed, 17 skipped) and `pnpm lint` passed. The local demo rider has FTP 250 W.
Screenshots and the simulator are in `~/Downloads/tempo-ride-focus-screens/`.

## Revision 4 (2026-11-23): block wording and phone view

The ride screen says "block" instead of "interval", at Erik's request. This
differs from the DESIGN.md glossary, which prefers "step" and lists "block" to
avoid; the glossary decision is open. Under 640 px the active ride uses a
dedicated one-screen view: header with ERG and a More button; block name,
position, next block and countdown; power with target and deviation; live heart
rate and cadence; block and workout averages (power and heart rate); a profile
chart that fills the remaining height; and a bottom bar with Back/Next on the
left and Pause on the right. The More sheet holds intensity, all data,
Connections, full screen and Finish. Headless Chromium (touch, DPR 3) with the
simulated trainer: no scroll at 402×874, 402×760, 402×700, 375×600 and while
paused. Back, Next, ERG, Pause/Resume, intensity and the sheet worked.
Real iPhone Safari is not yet checked. `pnpm test` and `pnpm lint` passed.

## Revision 5 (2026-11-23): glossary and one workout concept

- Glossary (DESIGN.md): one part of a workout is a **block**; a repeated group
  is a **repeat**. This follows TrainingPeaks and Zwift (blocks) and Garmin
  (Repeat). App copy is swept (about 85 strings); code identifiers are unchanged.
- Saved workouts now work like public ones: the same card, toolbar (search,
  Filters, sort) and a detail page (`/athlete/workouts/<id>`) through the shared
  `components/library/WorkoutDetail.tsx`. Saved workouts add **Edit**, share
  link and Delete. Coach workouts are unchanged.
- Gates: tsc, `pnpm test` (567 passed, 17 skipped) and `pnpm lint` pass.
  Browser: card → detail → Edit → editor → Back works, with no page errors.
- Open: the catalog prose still uses "set"/"step" as coaching language. Zone 1
  is "Easy" in `lib/workout-profile.ts` but "Recovery" in `lib/tempo-blocks.ts`.
