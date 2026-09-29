# Local visual verification

The repository has a dedicated **Athlete** test account on the Neon branch
configured in this workspace's `.env`. Its email and password live in
`.opencode/visual-test-account.local.md`, which is gitignored. Never commit
that file or copy its password into tracked documentation. This account is
for checking the personal training journey, not for production content.

To repeat the review locally:

1. Start the application against the same configured Neon branch. Confirm the
   target is an appropriate verification environment before writing test data. Do not
   run `pnpm db:seed`: it deletes existing application data.
2. Read the local ignored credential file and sign in through `/login`. If it
   is absent on another machine, create a **new** disposable Athlete account
   through `/signup`; do not assume the account can be recovered from Git.
3. Verify Home, empty Workouts and Templates, Planner and Calendar, History,
   Import, Profile, and Settings. Then create a workout, schedule a copy,
   follow/complete the session, and confirm its persisted outcome in History.
4. Repeat in both themes at desktop and phone widths. Use the sidebar theme
   control; verify the choice survives a reload. Check keyboard focus and
   error/empty states rather than relying only on sample preview routes.
5. Record exactly which real routes and interactions were checked in
   `CURRENT-STATUS.md`. Public `/design/*` fixtures are illustrative and do
   not establish authenticated persistence or authorization behavior.

The account is not a secret authority: every protected action still uses the
normal role and ownership checks. Do not use its password outside local
verification and rotate or replace it if it is ever exposed.
