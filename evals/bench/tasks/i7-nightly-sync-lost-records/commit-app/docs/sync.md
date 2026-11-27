# Nightly contact sync

## Interfaces

Remote (CRM API client):

- `listPages(): Promise<number[]>`: the page numbers to fetch for this run.
- `fetchPage(page): Promise<RawContact[]>`: one page of contacts.

Store (document store, one JSON document per key):

- `load(key): Promise<object | undefined>`
- `save(key, value): Promise<void>`: replaces the whole document.

In production every `load` and `save` is a network round trip (20 to 200 ms) and
pages come back from the CRM in any order. `MemoryStore` takes a `latency`
option so tests can simulate that: `new MemoryStore({ latency: (op, key) => promise })`.

All contacts live in a single document under the key `contacts`, an object
keyed by contact id.

## Guarantees (billing relies on these)

1. **No record is ever lost.** After `syncContacts` resolves, every contact
   returned by every page of the run is in the `contacts` document, whatever
   order pages and store I/O complete in.
2. **`syncContacts` resolves only when the run is persisted.** Callers (the
   cron job, the billing export that runs right after it) read the store as
   soon as the promise resolves.
3. **Latest version wins.** If a contact appears more than once (in the store
   already, or in two pages because it moved during pagination), the version
   with the greatest `updatedAt` is kept. On a tie the one from the remote wins.
4. **Nightly sync never deletes.** Contacts already in the store that the CRM
   no longer returns are kept.
5. The result is `{ pages, fetched }`: number of pages and number of contact
   records received from the remote in this run.
6. If fetching any page fails, `syncContacts` rejects (the scheduler retries
   the job).

## Known issue

CI has been flaky on the sync test (see `docs/ci-failure.log`), and support
reported a handful of customers missing from billing after some nightly runs.
