# Changelog

## 1.4.0
- Per-attempt timeout (`attemptTimeoutMs`, default 30 s) so a hung gateway call no longer blocks a worker slot forever.

## 1.3.0
- chargeOrder: idempotency key now includes the attempt number. Retries were
  failing with `idempotency_in_progress` when the gateway was slow.

## 1.2.0
- Receipts emailed after a successful charge.

## 1.0.0
- First version: queue, retries with exponential backoff, chargeOrder job.
