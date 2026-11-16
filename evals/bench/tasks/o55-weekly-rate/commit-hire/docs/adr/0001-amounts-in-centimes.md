# 1. Amounts in centimes

Date: 2025-04-02

## Decision

Every amount (rates, deposits, fees, invoice lines) is an integer number of Swiss centimes. Formatting to
`CHF 1'440.00` happens only in `src/hire/invoice.js`.

## Why

The old spreadsheet summed francs as floats and the yard kept finding invoices off by a centime.
