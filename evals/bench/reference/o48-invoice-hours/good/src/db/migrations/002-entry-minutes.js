/** Entries saved before the minutes release (Oct 14, 2026) have float `hours`; every reader now uses integer `minutes`. */
export default {
  id: '002-entry-minutes',
  /** @param {ReturnType<import('../store.js').createStore>} store */
  up(store) {
    for (const entry of store.all('entries')) {
      if (entry.hours === undefined) continue;
      const { hours, ...rest } = entry;
      store.replace('entries', entry.id, { ...rest, minutes: rest.minutes ?? Math.round(hours * 60) });
    }
  },
};
