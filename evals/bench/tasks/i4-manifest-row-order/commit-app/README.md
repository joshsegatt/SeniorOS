# dockside

Outbound shipping for the Lausanne warehouse: packing slips, dock pick lists
and (soon) the carrier manifest.

- `src/store.js` – in-memory store of shipments and their lines
- `src/packingSlip.js` – the packing slip that travels in the parcel; a copy goes to the carrier
- `src/pickList.js` – the dock crew's pick list
- `src/csv.js` – RFC 4180 CSV helpers, used by every export
- `src/weights.js` – line weights and kg formatting
- `src/manifest.js` – carrier manifest CSV (not implemented yet, ticket SHIP-214)

Product and architecture decisions live in `docs/decisions.md`. Read the
relevant entry before changing an export: carriers depend on its exact shape.

Run the tests with `npm test`.
