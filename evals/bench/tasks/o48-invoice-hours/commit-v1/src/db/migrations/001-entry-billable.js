/** Time entries saved before the billable flag existed were all billed. */
export default {
  id: '001-entry-billable',
  /** @param {ReturnType<import('../store.js').createStore>} store */
  up(store) {
    for (const entry of store.all('entries')) {
      if (entry.billable === undefined) store.replace('entries', entry.id, { ...entry, billable: true });
    }
  },
};
