# Authentication & Role-Based Access Design

**Date:** 2026-05-06  
**Status:** Approved  

## Overview

Replace the demo-only session system with real authentication using Auth.js (NextAuth v5). Users sign up as either a coach or athlete, authenticate via email + password or Google OAuth, and are restricted to their own role's routes. Coaches can manage a roster of athletes; athletes request to join a coach and see limited functionality until accepted.

---

## Schema Changes

### `User` model
Add `passwordHash String?` — nullable because OAuth-only users won't have one.

### New: `Account` model (Auth.js standard)
Links a `User` to an OAuth provider. One user can have multiple accounts (e.g. credentials + Google).

> **Note:** Auth.js's Prisma adapter requires `Account.id` to be a `String` (cuid). This is intentional and the only model in the schema that deviates from the `Int @id @default(autoincrement())` convention. The adapter must be configured with `{ userIdType: "number" }` (Auth.js v5 option) so it knows `User.id` is an integer.

```prisma
model Account {
  id                String  @id @default(cuid())
  userId            Int
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}
```

### New: `CoachRequest` model
Tracks an athlete's request to join a coach.

```prisma
model CoachRequest {
  id         Int      @id @default(autoincrement())
  athleteId  Int
  coachId    Int
  status     String   @default("PENDING")  // PENDING | ACCEPTED | REJECTED
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  athlete    User     @relation("AthleteRequests", fields: [athleteId], references: [id], onDelete: Cascade)
  coach      User     @relation("CoachRequests", fields: [coachId], references: [id], onDelete: Cascade)

  @@unique([athleteId, coachId])
}
```

`CoachRequest.status` is a constrained string (same convention as role/sportType/blockType in this codebase).

The `User` model also gains two back-relation fields:
```prisma
coachRequests    CoachRequest[] @relation("CoachRequests")
athleteRequests  CoachRequest[] @relation("AthleteRequests")
```

---

## Auth Library

**Auth.js (NextAuth v5)** with the Prisma adapter.  
**Session strategy:** JWT — stateless, no session table, role and userId embedded in the token.  
**JWT expiry:** 30 days (Auth.js default).  
**Providers:** Credentials (email + password with bcrypt) + Google OAuth.

---

## Authentication Flows

### Sign up (`/signup`)
1. User selects role (Coach or Athlete), enters name, email, password.
2. Server hashes password with bcrypt and creates `User`.
3. User is signed in immediately after creation.
4. Redirect based on role: coaches → `/coach`, athletes → `/athlete`.

### Sign in (`/login`)
1. Email + password, or "Continue with Google."
2. Auth.js validates credentials / OAuth token.
3. Role is read from the `User` record and embedded in the JWT.
4. Redirect based on role.

### Google OAuth — first visit
If a Google user has no role yet, a `needsRoleSetup: true` flag is embedded in the JWT. Middleware intercepts and redirects to `/setup` (role selection, one step) before any protected route is accessible.

### Account conflict handling
- Credentials sign-up with an existing email → "Email already in use — sign in instead."
- Google sign-in with an email already tied to a credentials account → Auth.js merges via the `Account` table automatically.

---

## Route Protection (Middleware)

A single `middleware.ts` at the project root enforces all access rules:

| Condition | Action |
|---|---|
| Unauthenticated → `/coach/*` or `/athlete/*` | Redirect to `/login` |
| Coach → `/athlete/*` | Redirect to `/coach` |
| Athlete → `/coach/*` | Redirect to `/athlete` |
| Any role → `/setup` but `needsRoleSetup` is false | Redirect to role home |
| Authenticated → `/login` or `/signup` | Redirect to role home |

The landing page `/` is replaced by `/login` (or redirects to it). The demo role-switcher is removed entirely. "Switch role" links are removed from coach and athlete pages.

---

## Session Access Layer

`lib/demo-session.ts` is deleted and replaced with `lib/auth-session.ts`, which exports:

```ts
getCurrentUser(): Promise<SessionUser | null>
```

`SessionUser` is a typed object containing `id`, `name`, `email`, and `role`. All server components and route handlers call this function instead of the old `getCurrentCoach()` / `getCurrentAthleteUser()`.

---

## Coach-Athlete Connection Flow

### Athlete with no coach (`/athlete`)
Athletes without an accepted coach connection land on a read-only profile page with a "Find a coach" prompt. No planning UI is shown.

### Find a coach (`/athlete/find-coach`)
- Search field — queries `User` by name or email where `role = 'COACH'`.
- Results list coach name.
- "Request to join" creates a `CoachRequest` record with status `PENDING`.
- If a request already exists for that coach, the button shows "Request sent" and the API returns 409 on duplicate.

### Coach request management (`/coach/requests`)
- New section on the coach dashboard lists pending `CoachRequest` records.
- Coach sees athlete name and email. Actions: Accept or Reject.
- **Accept:** `CoachRequest.status` → `ACCEPTED`, create `AthleteProfile` linking athlete to coach.
- **Reject:** `CoachRequest.status` → `REJECTED`. Athlete can request again or request a different coach.

### Athlete state after acceptance
On next load of `/athlete`, the athlete now has a coach and sees the full planning view.

### Constraints
- One `AthleteProfile` per athlete (`userId` is unique on `AthleteProfile`), so an athlete can only belong to one coach at a time.
- Unique constraint on `(athleteId, coachId)` prevents duplicate requests to the same coach.

---

## New API Routes

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/athlete/coach-requests` | Athlete creates a join request |
| `GET` | `/api/coach/requests` | Coach lists pending requests |
| `PATCH` | `/api/coach/requests/[requestId]` | Coach accepts or rejects a request |

All route handlers validate the caller's role via `getCurrentUser()` and reject unauthorized access with 403.

---

## What Is Removed

- `lib/demo-session.ts` — deleted
- `app/page.tsx` demo landing (role-switcher) — replaced with redirect to `/login`
- "Switch role" links in coach and athlete `TopBar` actions
- "Open coach demo" / "Open athlete view" buttons
