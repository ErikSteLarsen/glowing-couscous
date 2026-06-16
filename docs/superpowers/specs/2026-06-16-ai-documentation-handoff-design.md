# AI Documentation Handoff Design

**Date:** 2026-06-16  
**Status:** Assumed approved for autonomous execution

## Goal

Restructure repository documentation so a new AI contributor can answer three questions quickly:

1. What is already shipped?
2. Where should new code go?
3. What is the most valuable next work?

## Problem

The current markdown set mixes product intent, historical implementation notes, and current architecture. That makes it harder for an AI agent to tell which statements describe today's system versus older plans.

## Recommended approach

Use a small documentation system with one clear owner per file:

- `README.md` for project overview, setup, and document navigation.
- `docs/AI-HANDOFF.md` as the primary entry point for future AI contributors.
- `ARCHITECTURE.md` for current implementation boundaries and extension rules.
- `SPEC.md` for product direction, current product scope, and near-term roadmap.

This is better than putting everything in `README.md`, because setup instructions and AI handoff guidance have different jobs. It is also better than a single giant spec, because agents need fast orientation more than long narrative history.

## Planned edits

### `README.md`

- Keep the project description and local setup short.
- Add a documentation map that explains which file answers which kind of question.

### `docs/AI-HANDOFF.md`

- Summarize the product state, route surface, data model, and service boundaries.
- Call out active inconsistencies or transitional areas such as `lib/demo-data.ts` still being used for some read paths.
- End with a ranked next-step list for an incoming AI agent.

### `ARCHITECTURE.md`

- Focus only on the implemented architecture.
- Document current route groups, data/service boundaries, and safe extension rules.
- Remove product-planning content that belongs in `SPEC.md`.

### `SPEC.md`

- Keep product intent and scope.
- Clearly distinguish current shipped behavior from next-state goals.
- Replace stale build-order or outdated demo-auth language with a current roadmap.

## Expected outcome

After these edits, an AI agent should be able to open one file, orient itself, and then branch into the right supporting document without guessing which statements are historical versus current.
