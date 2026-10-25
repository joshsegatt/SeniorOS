# Engineering decisions

Record only decisions that should constrain future work. Keep entries short and dated.

## 2026-10-25 — Separate reasoning from deterministic mechanics

**Decision:** Keep context-dependent judgment in Agent Skills and repeated mechanics in the CLI/runtime.

**Why:** This reduces prompt bloat, makes verification testable, and keeps the core portable across hosts.

## 2026-10-25 — Proof baseline is not universal ship readiness

**Decision:** The CLI reports deterministic proof results but does not claim the entire task is ready to ship.

**Why:** Acceptance criteria, runtime behavior, external approvals, and task-specific risk can exist beyond package scripts.
