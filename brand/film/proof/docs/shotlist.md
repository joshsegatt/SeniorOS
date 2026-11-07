# SeniorOS: same model, same bug: shot list
60 s · 96 bpm · 96 beats (0.625 s each) · formats: 16x9 (primary), 1x1 (social)
Music: synthesized lofi, D minor, intro 0-16, main 16-92, end 92-96 · VO: none (kinetic type)
Look: Midnight `#0B1220` ground, Inter (display) + JetBrains Mono (UI), one accent: Signal Blue `#2F80FF`.
Pass `#22C55E` / Blocked `#EF4444` appear only on the test verdicts and the chart, never as decoration.

Every line of agent text and every command on screen is quoted from two recorded runs of the bench task
`o37-refund-report` (Sonnet 5.5, 6 Nov 2026): `none--2` (Sonnet alone) and `senioros--2` (Sonnet + SeniorOS).
Commands are shortened to their first meaningful words; nothing is added.

| # | beats | time | shot | on screen (asset) | motion | out (transition) | sound (hits) |
|---|-------|------|------|-------------------|--------|------------------|--------------|
| 1 | 0-8 | 0.0-5.0 | Hook: the number | `€1,618.50` huge, digits drop in on frame 0. Under it, beat 4: "Two runs of Sonnet 5.5 reached this number. Both said the bug was fixed." | digits spring up per glyph, staggered; line wipes in left to right | the number shrinks and splits in two, flying to the top of each half | impact @0, ticks per digit, pop @4 |
| 2 | 8-16 | 5.0-10.0 | The bug report | The task prompt (quoted) in mono; `src/finance/reports.js` underlines in blue on beat 12. Caption: "The report names one file." | prompt types line by line on beats; underline draws | camera pulls back; the prompt becomes the shared header over two panes | type ticks, swell @12 |
| 3 | 16-40 | 10.0-25.0 | Split replay | Left pane "Sonnet 5.5 alone", right pane "Sonnet 5.5 + SeniorOS". Each tool call lands as a line on its own beat, in the order it happened: left `Read reports.js` > `head data/refunds-2026-10.json` > "Some records use `amount` (euro string) instead of `amountCents`." > `sed -i ... reports.js` > "I fixed `refundsTotal`". Right: `Skill senior-debugging` > `Read reports.js` > `cat src/support/refunds.js` ("The agent types the amount in euros") > `grep -rn "refunds()\|amountCents" src` | lines slide up like a live log; a turn counter ticks in each pane's corner (left stops at 5, right keeps going) | left pane dims at beat 34 when its run ends | soft tick per line, left "done" chime @34 |
| 4 | 40-56 | 25.0-35.0 | The map | Over the split: the five real files as a small graph. Writer `support/refunds.js` on one side; readers `reports.js`, `ledger.js`, `payouts.js`, `checkout.js`. Left lights only `reports.js`. Right lights the writer, then every reader, in the order the run touched them. Then its test: "17 pass, 1 fail" turns into "18 pass, 0 fail". | nodes spring in, edges draw from the writer outward; left's single node pulses once | the graph collapses into two verdict cards | thud per lit node, rising pitch; resolve @54 |
| 5 | 56-64 | 35.0-40.0 | The quote | Left's own last words, quoted: "If anything else sums refunds directly, it may have the same problem." Beat 60: "It said so. Then it stopped." | quote sets word by word; second line punches in | hard cut on the downbeat | low hit @60 |
| 6 | 64-72 | 40.0-45.0 | Hidden tests | Two verdicts, side by side. Left: "2 of 6 hidden tests" (red); under it, the four that failed: customer balance, payout reconciliation, cancel after a support refund, over-refund limit. Right: "6 of 6" (green). | counters roll to their totals; failed names strike in one per beat | the green "6 of 6" slides left and becomes the first bar of the chart | impact @64, four ticks, bell @68 |
| 7 | 72-84 | 45.0-52.5 | Measured | Thin horizontal bars, real counts: Sonnet 5.5, 4 tasks x 5 runs: model alone 0/20, Superpowers 0/20, SeniorOS 12/20, "p < 0.001". Beat 78: Opus 5.5, 3 tasks x 5: 2/15, 6/15 (best other pack), 10/15. | bars grow from the baseline on beats, labels set beside them | the chart slides up and out as the command line slides in | whoosh @72, tick per bar |
| 8 | 84-90 | 52.5-56.25 | Measure yours | `node evals/bench/bench.mjs run --packs mine=you/your-pack@<commit>` and "Every table, every commit: evals/bench/LEADERBOARD.md" | command types on beats, caret blinks on the beat | the caret becomes the logo's mark | type ticks |
| 9 | 90-96 | 56.25-60.0 | End card | SeniorOS mark + wordmark (`brand/logo/senioros-mark-on-dark.svg`), "Measured, not claimed.", `github.com/joshsegatt/SeniorOS` | logo springs in; tagline wipes; holds 2.5 s | end | impact @90, bell @90.5 |

Formats:
- 1x1: the split stacks top/bottom instead of left/right (same order: alone on top); the map sits between the panes; type 15% smaller.
- GIF for the README: shots 3-6 only (beats 16-72, 35 s), 960 px, no sound; the MP4 is linked under it.

Longest gap without a new event: shot 9 hold, beats 92-96 (2.5 s, the end card).
