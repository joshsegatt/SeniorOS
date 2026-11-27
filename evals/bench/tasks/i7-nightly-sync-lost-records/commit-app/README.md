# crm-nightly-sync

Nightly job that copies every contact from the CRM API into our contacts store,
so the billing and support tools can read contacts without hitting the CRM.

- `src/sync.js`: `syncContacts({ remote, store })`, the sync itself.
- `src/job.js`: `runNightly(...)`, the cron entry point (records the run).
- `src/remote.js`: `InMemoryRemote`, a stand-in for the CRM API used in dev and tests.
- `src/store.js`: `MemoryStore`, same contract as the production document store.
- `src/contacts.js`: normalisation and "latest version wins" merge.

Behaviour and guarantees: see `docs/sync.md`.

```bash
npm test
```
