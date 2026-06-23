# Tempo — Design & Build Package

An endurance training platform (run / bike / swim / row) for **athletes** and **coaches**.
Calm Scandinavian aesthetic; the one saturated colour in the product is **training intensity** (5 zones).

This package is everything an implementer needs to build the UI. Start with the **Handoff Spec**, then build screen-by-screen from the matching reference file.

---

## What's in here

| File | What it is |
|------|------------|
| **Tempo Handoff Spec.dc.html** | ⭐ Start here. Tokens, components, screens, interactions, data model, build notes — the single source of truth. |
| **Tempo Design System.dc.html** | Visual reference: palette, intensity zones, type scale, spacing/elevation, components. |
| **Tempo App.dc.html** | Athlete desktop app — Home, Calendar (week/month), Session + live adjustment, Activity, Settings. |
| **Tempo Mobile.dc.html** | Phone screens — Home, Calendar, Session, and the interactive **Live execution** view. |
| **Tempo Coach.dc.html** | Coach side — roster, athlete detail, plan builder + assign, templates. |
| **Tempo Wireframes.dc.html** | Early low-fi exploration (context only — superseded by the screens above). |
| `support.js` | Runtime that renders the `.dc.html` reference files in a browser. Keep it alongside them. |

> **Open any `.dc.html` in a browser** (with `support.js` next to it) to view that screen live. Most screens are interactive — step through the live workout, adjust a session, toggle assignees.

---

## How to read the reference files

The `.dc.html` files are **design references, not production code**. Each contains the screen's full markup with **inline styles** (exact colours, sizes, spacing) plus a small logic class for interactions. Reimplement them in your own stack (React/Vue/Tailwind/etc.) using the tokens below — the inline values map 1:1 to your theme.

**Build order:** tokens → shared components (block bar, stepper, badge, calendar chip) → app shell (sidebar + topbar) → screens.

---

## Token quick-reference

### Neutrals & brand
```
paper        #F3F2EE   app background
surface      #FFFFFF   cards
sunken       #ECEAE4   tracks / insets / segmented bg
border       #E6E2DB   hairline borders
ink-3        #9C968B   muted text, labels, icons
ink-2        #6A655C   secondary text
ink          #232220   primary text + primary button
sage         #6E7E63   brand accent · active nav · highlight
sage-tint    #E9ECE3   selected backgrounds, coach note
```

### Status
```
completed  text #1B7A3D  bg #E3F7EC
adjusted   text #B45516  bg #FEEDE0   (also "warning")
missed     text #2B6CB0  bg #E8F0FE   (also "info")
planned    text #57654E  bg #E9ECE3
```

### Intensity zones  (solid = bars/dots/accents · tint = backgrounds)
```
Z1 Recovery   <55%  · RPE 1–2   solid #3B82F6  tint #E8F0FE
Z2 Endurance  56–75% · RPE 3–4   solid #22C55E  tint #E3F7EC
Z3 Tempo      76–90% · RPE 5–6   solid #EAB308  tint #FBF1D5
Z4 Threshold  91–105% · RPE 7–8  solid #F97316  tint #FEEDE0
Z5 VO2 max    >106% · RPE 9–10   solid #EF4444  tint #FCE8E7
```
Zones map to % of threshold (FTP for power, LTHR for HR) or RPE. 5-zone model is default; extends to 7. **Always pair zone colour with a Z-label or name — never colour alone.**

### Type — Schibsted Grotesk (Google Fonts), tabular figures on all metrics
```
display  30–44 / 700 / -3%      title  22–26 / 600 / -2%
heading  17–18 / 600            body   14–15 / 400 / 1.55
small    12.5–13 / 500          label  11 / 600 / +10% UPPER
```

### Spacing / radius / elevation
```
spacing  4 · 8 · 12 · 16 · 24 · 32 · 48      (card padding 16–20, gutter 28–32)
radius   8 input · 12 card · 16 modal · 999 pill
raised   0 6px 20px -8px rgba(35,34,32,.14)
overlay  0 24px 50px -18px rgba(35,34,32,.22)
```

---

## Data model (see the Handoff Spec for full shapes)

```
User       { id, name, role:'athlete'|'coach', selfCoached, coachId?, prefs:{ overviewCards[] } }
Plan       { id, athleteId, name, startDate, endDate, goalRace? }
Session    { id, athleteId, date, time, sport, status, source:'self'|'coach', adjusted, blocks[] }
Block      { id, kind:'warmup'|'work'|'recovery'|'cooldown', zone:1..5, durationSec, reps?, target? }
Template   { id, ownerId, name, sport, blocks[] }     // Session without a date
Activity   { id, sessionId, athleteId, completedAt, durationSec, tss, compliancePct, zoneDistribution[5] }
Assignment { sessionId, athleteIds[], date, assignedBy }
```
Total duration, TSS and the block-bar geometry are **derived from `blocks`** — don't store them.

---

## Signature component: the session block bar
A horizontal flex row where each **Block** is a segment: `flex-grow` = duration, `background` = zone solid colour, 2px gaps, ~9px container radius. It appears on the Home card, Session detail, Plan builder and Templates. Build it once; everything reuses it.
