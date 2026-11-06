# rowlark changelog

## 1.8.0

- `stringify` accepts `header: false` to leave out the header line.

## 1.7.0

- `parse` accepts `\r\n` line endings.

## 1.6.0

- `parse` casts numeric-looking values (`12`, `-3.5`) to numbers by default (`cast: true`).
