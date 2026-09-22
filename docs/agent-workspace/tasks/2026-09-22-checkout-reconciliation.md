# Checkout Reconciliation

## Goal

Reconcile the Windows and Ubuntu WSL checkouts, preserve changes unique to
both, push the combined result, and verify the Windows checkout matches the
pushed Git state.

## Scope

- Compare commit ancestry and working-tree changes in both checkouts.
- Preserve recoverable snapshots before modifying the Windows checkout.
- Integrate the newer committed Ubuntu work and both uncommitted change sets.
- Run the repository verification gates, update coordination status, push, and
  confirm the Windows checkout is clean and aligned with the remote branch.

## Completion

Remove this task after the reconciled result and verification evidence are
reflected in `CURRENT-STATUS.md` and `WORK-INDEX.md`.
