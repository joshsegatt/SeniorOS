# centwise changelog

## 3.0.0

### Fixed

- `fromDecimal` lost a cent on some amounts because of floating-point truncation (`fromDecimal(19.99)` returned
  `1998`, `fromDecimal(0.29)` returned `28`). It now rounds to the nearest cent.

### Breaking changes

- `percentOf` is renamed `percent`. Same arguments.
- `format` needs the `currency` option and throws a `TypeError` without it. There is no default currency any more.
- `parse` throws a `CentwiseParseError` when the input is not an amount, instead of returning `null`. Use the new
  `tryParse` to keep getting `null`.
- The default rounding of `multiply` and `percent` is now `'half-even'` (banker's rounding: `10.5` becomes `10`,
  `11.5` becomes `12`), as most accounting libraries do. Only results that land exactly on half a cent change. Pass
  `{ rounding: 'half-up' }` to keep the 2.x results. Calls that already pass a `rounding` option are not affected.

## 2.4.1

- `parse` accepts a leading `€` and spaces (`"€ 12.50"`).

## 2.4.0

- `multiply` and `percentOf` take a `rounding` option: `'half-up'` (default), `'half-even'` or `'down'`.

## 2.3.0

- `format` takes a `currency` option (`EUR` by default, `GBP`, `USD`).
