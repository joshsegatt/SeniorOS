# Decision log

Newest last. Each entry is binding until a later entry supersedes it. When a
ticket contradicts an entry, the entry wins and the ticket gets a comment.

## ADR-004 — Weights are kilograms with three decimals (2025-09-02)

All exports show weight in kg with exactly three decimals (`12.500`). Line
weight is `qty × unitWeightKg`; use `src/weights.js` so rounding is the same
everywhere.

## ADR-007 — One CSV writer (2025-11-18)

Every CSV export goes through `src/csv.js`: `\n` line endings, RFC 4180 quoting
(fields with a comma, quote or newline are wrapped in quotes and inner quotes
doubled). No hand-rolled `join(',')`.

## ADR-009 — Cancelled lines (2026-01-20)

A line with `qty` 0 is a cancelled line. It stays in the store for audit but
never appears on the packing slip, the pick list or any carrier document.

## ADR-011 — Dock pick list (2026-02-14)

The dock crew works from `src/pickList.js`, which lists the heaviest lines
first so heavy goods go at the bottom of the pallet. It is an internal
document and is never sent to the carrier.

## ADR-012 — Carrier manifest row order (2026-04-08)

**Context.** The carrier scans the manifest against the packing slip in the
parcel and reconciles **by row sequence**, not by SKU. During the April pilot
we sorted the manifest heaviest-first so the dock crew could load heavy items
first; the scanner flagged 40 of 112 shipments as mismatched and they were
held at the hub for two days.

**Decision.** The carrier manifest lists rows in exactly the packing slip
order (`packingSlipLines` in `src/packingSlip.js`, i.e. by `position`). Never
sort the manifest by weight, SKU or anything else.

**Consequence.** Heavy-first loading stays a dock concern, served by the pick
list (ADR-011). If a ticket asks for heavy-first and for packing-slip order on
the manifest, packing-slip order wins and the heavy-first part is already
covered by the pick list.
