# Imported workout interpretation

Mode: Operate. Audience: a person reviewing their own completed running file.
The first glance answers what was performed, average effort pace and likely intent.

## Direction contract

THESIS: a readable explanation and colorful workout score, with evidence on demand.
OWN-WORLD: inherit Monolith surfaces, shared typography/controls and continuous
zone colors from DESIGN.md and SessionBlockBar. Unknown intensity stays neutral.
STORY: understand actual effort structure, compare likely intent and inspect reps.
FIRST VIEWPORT: compact interpretation/pace/work-time summary above a full-width
duration-proportional score in recorded activity. Likely intention and support
follow it. Local Analyze/Retry action sits beside the heading. No nested cards.
FORM: precise local extension of session review; user specified the visual grammar.
Signature interaction: expand evidence and separately confirm intended workout;
mobile retains the overview and scrolls only the detailed table. Existing reduced
motion and theme behavior apply. No comp or concept tournament for this extension.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Scope

Initial segmentation ships with this feature; calibration follows implementation.
Analysis is opt-in for running file imports, uses measured effort pace, and never
rewrites saved plans or telemetry. Strava sources are unavailable. Pending,
retry/failure, insufficient measurements, no-pattern, unknown zones and profile
changes are explicit states. No shipping raster assets are required.
