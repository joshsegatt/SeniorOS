// In-memory store. Lines are kept in insertion order, which is NOT the
// packing order: `position` is the authoritative sequence.
export function createStore({ shipments = [], lines = [] } = {}) {
  const byId = new Map(shipments.map((s) => [s.id, { ...s }]));
  const allLines = lines.map((l) => ({ ...l }));

  return {
    getShipment(id) {
      const s = byId.get(id);
      return s ? { ...s } : null;
    },
    linesFor(shipmentId) {
      return allLines.filter((l) => l.shipmentId === shipmentId).map((l) => ({ ...l }));
    },
    addLine(line) {
      allLines.push({ ...line });
    },
  };
}
