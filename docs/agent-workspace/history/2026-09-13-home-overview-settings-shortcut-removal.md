# Home overview Settings shortcut removal

- **Date:** 2026-09-13
- **Agent:** OpenCode subagent (`ses_f6489b9c3ffeJKlTxKmJlIj4fY`)
- **Feature:** `ATHLETE-001`

## Change

Removed the `Customise overview in Settings` shortcut beneath the athlete Home
overview cards. Overview preferences remain available on `/settings`; Home no
longer repeats that navigation prompt.

## Files

- `app/(app)/athlete/page.tsx`
- `docs/agent-workspace/features/athlete.md`
- `docs/agent-workspace/WORK-INDEX.md`

## Verification

- `pnpm lint` — pass
- `git diff --check` — pass
- `/home/forsvaret/.config/opencode/skills/impeccable/scripts/impeccable detect --json 'app/(app)/athlete/page.tsx'` — pass (`[]`)

## Follow-up

No follow-up required for this copy removal. Existing broader athlete-surface
browser and mutation verification gaps remain tracked under `ATHLETE-001`.
