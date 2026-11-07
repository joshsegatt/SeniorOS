# SeniorOS Brand Kit

SeniorOS uses a restrained engineering identity: clear typography, dark neutral surfaces, signal blue for active system behavior, and evidence/status colors only when they have semantic meaning.

## Official assets

- `logo/senioros-mark.svg` — primary symbol, transparent.
- `logo/senioros-mark-on-dark.svg` — symbol on the official dark tile.
- `logo/senioros-wordmark-dark.svg` — primary horizontal lockup for dark surfaces.
- `logo/senioros-wordmark-light.svg` — primary horizontal lockup for light surfaces.
- `social/readme-hero.svg` — README hero: the promise, and the 15 held-out Opus runs per arm. Static on purpose, so
  it reads the same in every viewer.
- `social/results.svg` — README results chart, one panel per bench set; regenerate it when the README table changes.
- `social/social-preview.svg` and `social/social-preview.png` — the 1280×640 GitHub social preview, the hero at
  social-card size. Upload the PNG in the repository settings (Social preview).
- `social/demo-t6.gif` — README demo: two real Opus runs of bench task t6, replayed. Re-record with
  `vhs brand/demo/t6.tape` (needs [VHS](https://github.com/charmbracelet/vhs) and ttyd); the content is in
  `brand/demo/t6-replay.mjs`, quoted from the run transcripts.
- `social/proof.mp4` — the 60-second film: two recorded Sonnet 5.5 runs of bench task `o37-refund-report` (alone
  and with SeniorOS), their hidden tests, then the measured bench. Every line of agent text and every command on
  screen is quoted from the run transcripts (`none--2`, `senioros--2`); the hidden-test names and changed files were
  re-checked against both runs' code. `social/proof.gif` is its 25–45 s cut for the README and
  `social/proof-poster.png` its verdict frame. The source is `film/proof/` (the shot list and critique log are in
  its `docs/`); it renders with the motion-reel skill (`render.mjs --film proof`), Inter and JetBrains Mono.
- `social/demo-approval-boundary.svg` — the earlier animated demo (Claude Haiku runs), kept for reference.
- `brand-board.svg` — visual system reference.
- `skills/*.svg` — animated skill icons.
- `icons/favicon.svg` — product/app mark.

## Attribution

When a creator line is appropriate, use **Created by Josh Segatt**. Do not combine the name into the product name itself.

## Principles

1. Engineering, not science fiction.
2. Evidence, not magic.
3. One accent color at a time.
4. Animation must explain state or flow, never decorate empty space.
5. Preserve generous whitespace.
6. Use status colors semantically: green = proven/pass, amber = risk/attention, red = blocked/failure.
