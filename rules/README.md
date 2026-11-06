# Rules

`core.md` is the one source of the routing rules each host loads. `hosts.json` gives each generated file its first
line, how skills load on that host. After editing either, run `npm run gen:rules`; `npm test` fails while a generated
file is out of date. Do not edit the generated files (`senioros.md` and `adapters/*/rules.md`) by hand.

Antigravity's rules (`adapters/antigravity/rules.md`) are written by hand: they were measured with their own wording,
and `tests/rules-sync.test.ts` checks that they route the same surfaces and cases.
