# rowlark changelog

## 2.0.0

### Security

- **Formula injection in `stringify` (advisory RLK-2026-03).** A cell starting with `=`, `+`, `-`, `@`, a tab or a
  carriage return was written as is, so a spreadsheet opening the file ran it as a formula. `stringify` now prefixes
  such cells with a single quote (`'=1+2`). Cells that are numbers (`-12.50`, `-12,50`, `+3`) are not changed.
  Pass `escapeFormulas: false` to turn this off.

### Breaking changes

- The default export is gone. Import the functions by name: `import { parse, stringify } from 'rowlark'`.
- The `delimiter` option of `parse` and `stringify` is renamed `separator`. `delimiter` is no longer read: a call
  that still passes it uses the default separator (`,`).
- `parse` no longer casts values by default: every value is returned as a string. Pass `cast: true` to get the 1.x
  behavior (numeric-looking values become numbers).

## 1.8.0

- `stringify` accepts `header: false` to leave out the header line.

## 1.7.0

- `parse` accepts `\r\n` line endings.

## 1.6.0

- `parse` casts numeric-looking values (`12`, `-3.5`) to numbers by default (`cast: true`).
