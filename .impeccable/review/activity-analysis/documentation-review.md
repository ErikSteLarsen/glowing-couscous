# Imported workout interpretation documentation review

Reviewed 2026-10-01. Ordinary extension of Wattonaut's incumbent system; no new
visual world, tokens, or shipping raster assets. Preserve `DESIGN.md` and
`.impeccable/design.json`. The finish review's **ship** disposition remains
limited to its supplied actual-component screenshots and source review.

## Evidence checked

- Product purpose and truthful outcome-data constraints in `PRODUCT.md`;
  component, theme, typography and session language in `DESIGN.md`.
- Theme aliases and zone tokens in `app/globals.css`, shared fields/actions in
  `components/ui.tsx`, and the existing sidecar's identity metadata.
- Finished `components/ImportedWorkoutAnalysis.tsx`,
  `lib/activity-analysis-view.ts`, `components/wattonaut/SessionBlockBar.tsx`,
  and `lib/intensity-color.ts`; direction contract and finish-review report.
- Opened `desktop-light.jpg`, `desktop-dark.jpg`, `mobile-dark-focused.jpg`,
  and `mobile-correction.jpg` from this directory individually. The mobile
  evidence establishes focused result/form views, not the whole narrow page.
- Impeccable `document.md` and `new-work.md` section 7. No browser was run.

## Comparison with the incumbent system

The finished interpretation uses open separated reading rows within the existing
activity-data surface, shared heading/field/secondary-action owners, semantic
theme colors, tabular metric text, and the existing proportional workout score.
The adapter passes actual segment durations and a nullable intensity zone;
SessionBlockBar preserves neutral unknown intensity and low neutral pauses.
Calculated structure is distinguished from recorded measurements and separately
saved intended-workout confirmation. The evidence table has its own horizontal
overflow boundary. The screenshots show the same visual grammar in both themes
and wrapping metrics/fields in focused mobile views. No system regeneration is
needed.

## Recommended durable component guidance

The primary agent can append this paragraph within `DESIGN.md`'s existing
**Workout / Session Language** guidance, without altering its tokens or sidecar:

> Imported running-file interpretation reuses `SessionBlockBar` for detected
> effort structure: width represents actual duration, height and color represent
> estimated intensity, and unknown intensity remains neutral. Keep the intensity
> basis and actual-duration label visible. Present likely intent separately from
> recorded measurements and user-confirmed intent; supporting repetitions belong
> in a disclosure with a locally scrolling table on narrow screens. Reuse shared
> actions and fields for confirmation.

This captures reusable meaning and component ownership; the exact summary
composition remains in the surface contract.

## Pre-existing drift preserved

- The sidecar calls Signal “Indigo Action” and records canonical `#102F51`;
  current DESIGN frontmatter and light runtime action tokens use `#111412`.
- DESIGN's depth prose describes the dark canvas as `#080909`, while runtime
  `--background` is `#0E1010`; `#080909` is the dark paper token.
- Incumbent documentation's typography/control entries are not a complete
  verbatim representation of runtime shared utility values. This extension
  appropriately follows the shared owners rather than introducing replacements.

These findings are reported, not repaired. No claim is made about runtime
keyboard/screen-reader acceptance, computed contrast, expanded evidence-table
rendering, full mobile-page coverage, segmentation calibration, providers,
authenticated persistence, physical devices or production.
