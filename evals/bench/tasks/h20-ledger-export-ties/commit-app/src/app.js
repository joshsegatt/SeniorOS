import { listTransactions } from './api/transactions.js';
import { exportLedgerCsv } from './export/exportLedger.js';
import { importStatement } from './import/bankImport.js';
import { reconcile } from './jobs/reconcile.js';
import { createLedgerStore } from './store/ledgerStore.js';

export function createLedgerApp() {
  const store = createLedgerStore();
  return {
    store,
    importStatement: (text) => importStatement(store, text),
    exportCsv: (opts) => exportLedgerCsv(store, opts),
    list: (query) => listTransactions(store, query),
    reconcile: (opts) => reconcile(store, opts),
  };
}
