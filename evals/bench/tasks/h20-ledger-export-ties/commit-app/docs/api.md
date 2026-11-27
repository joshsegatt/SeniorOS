# Transactions API

`GET /transactions?limit=25&order=desc&account=CH-OPS&cursor=<token>`

| param   | default | notes                                  |
|---------|---------|----------------------------------------|
| limit   | 25      | 1..500                                 |
| order   | desc    | `asc` or `desc` by booking time        |
| account | (all)   | filter by account id                   |
| cursor  | (none)  | `next` from the previous response      |

Response: `{ "data": [...], "next": "<token>" | null }`. `next` is `null` on the
last page.

## Cursor tokens

Tokens are opaque to clients, but clients **persist** them: the mobile app
saves the last `next` token and resumes its sync from it, sometimes days later
and across our deploys. A token issued by an earlier release must therefore
keep working after an upgrade: it must not be rejected, and resuming from it
must not hand the client rows it already received.

Tokens issued so far are base64url JSON of the form `{"t": <bookedAt epoch seconds>}`.

The CSV export and the nightly reconciliation job walk the same pagination
helper (`src/lib/paginate.js`) internally.
