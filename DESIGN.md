# SeniorOS design contract

Applies to every visual asset in this repository (README art, brand SVGs, social previews). The brand kit in
[`brand/`](brand/README.md) is the source; this file records the rules a new asset must follow.

## Design read

Developer-tool README and brand assets for engineers deciding in seconds whether to trust the project. Restrained
engineering language, close to Linear and Vercel docs: dark neutral surfaces, one signal accent, status colors only
when they mean something.

## Dials

| Dial | Value | Why |
|---|---|---|
| Design variance | 3 | Documentation art: aligned grids, predictable reading order |
| Motion intensity | 4 | Motion only to show a sequence or a state change, played once |
| Visual density | 5 | Real terminal and status content, with generous margins |

## Palette (8 functional colors)

| Token | Hex | Use |
|---|---|---|
| `background` | `#07101E` | Canvas |
| `border` | `#263853` | Panel outlines, dividers |
| `text` | `#F8FAFC` | Primary text |
| `muted` | `#94A3B8` | Secondary text, captions, prompts |
| `accent` | `#2F80FF` | SeniorOS, active system behavior (one accent per asset) |
| `success` | `#22C55E` | Proven, passed, intact |
| `warning` | `#F59E0B` | Risk, needs attention, stopped for confirmation |
| `danger` | `#EF4444` | Blocked, failed, data lost |

Status colors are semantic only: never decorative.

## Typography

- UI and labels: `Inter, Segoe UI, Arial, sans-serif` (the existing brand face).
- Commands and file paths: `JetBrains Mono, Consolas, Menlo, monospace`.
- Sizes in SVG units at 1000px width: titles 18, body 14, mono 13, captions 12. Weight 600 for titles, 400 otherwise.
- No em-dashes in any visible text.

## Spacing and shape

- 8-unit grid; outer margin 40, panel padding 24, line height 24 for mono lines.
- One radius: 12 for panels and badges. No shadows or glows.

## Motion

- Animate `opacity` (and small `transform` offsets) only, with CSS keyframes inside the SVG.
- A sequence plays once and holds its final state; no infinite loops.
- Every animated SVG includes `@media (prefers-reduced-motion: reduce)` that shows the final state at once.
- Content in demos comes from real runs (bench transcripts), never invented output.
