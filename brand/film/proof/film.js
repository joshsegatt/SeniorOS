// SeniorOS: same model, same bug. A pure function of time: window.seek(t) paints frame t (lib/motion.js).
// Timing is in beats (u) on the measured grid (96 bpm, 0.625 s a beat); docs/shotlist.md is the approved plan.
// Every line of agent text and every command below is quoted from two recorded bench runs of o37-refund-report on
// Sonnet 5.5 (6 Nov 2026): none--2 (Sonnet alone) and senioros--2 (Sonnet + SeniorOS). Commands are cut to their
// first words; nothing is added. The hidden-test names and file lists were re-checked against both runs' code.
import * as M from './lib/motion.js';

const { W, H, FORMAT, E, prog, clamp, springU, SPRING, font, layout, glyph, text, fill, rrect, mix, bump } = M;

// Brand tokens (brand/docs/visual-style.md). One accent: Signal Blue. Pass/Blocked only on verdicts.
const C = {
  bg: '#0B1220', surface: '#111827', blue: '#2F80FF', sky: '#6BB6FF', slate: '#94A3B8',
  pass: '#22C55E', fail: '#EF4444', ink: '#E7ECF3',
};
const D = 'Display', UI = 'UI';
const SQ = FORMAT.square;
const S = FORMAT.safe;
const px = (n) => n * FORMAT.pick({ '16x9': 1, '1x1': 0.78 });

const HITS = [
  [0, 'number lands', 'impact'],
  [4, 'two runs line', 'pop', { pitch: 'A5' }],
  [5.5, 'both said fixed', 'pop', { pitch: 'D6' }],
  [7.5, 'into the report', 'whoosh', { len: 0.5 }],
  [8, 'prompt line 1', 'type', { n: 6, len: 0.5 }],
  [9, 'prompt line 2', 'type', { n: 6, len: 0.5 }],
  [10, 'prompt line 3', 'type', { n: 6, len: 0.5 }],
  [11, 'prompt line 4', 'type', { n: 6, len: 0.5 }],
  [12, 'one file underlined', 'swell'],
  [13, 'names one file', 'click'],
  [16, 'split opens', 'impact'],
  [34, 'alone ends', 'bell', { pitch: 'A5', gain: 0.18 }],
  [40, 'map', 'whoosh', { len: 0.5, from: 500, to: 2200 }],
  [42, 'alone lights reports.js', 'thud'],
  [43.5, 'writer lights', 'thud', { pitch: 70 }],
  [44.5, 'reader 1', 'blip', { pitch: 'D5' }],
  [45.25, 'reader 2', 'blip', { pitch: 'F5' }],
  [46, 'reader 3', 'blip', { pitch: 'A5' }],
  [46.75, 'reader 4', 'blip', { pitch: 'D6' }],
  [49, 'test fails first', 'click'],
  [51, 'test passes', 'bell', { pitch: 'D6', gain: 0.2 }],
  [56, 'the quote', 'sub', { len: 0.8 }],
  [60, 'then it stopped', 'thud', { pitch: 55 }],
  [64, 'hidden tests', 'impact'],
  [66, 'fail 1', 'tick'], [67, 'fail 2', 'tick'], [68, 'fail 3', 'tick'], [69, 'fail 4', 'tick'],
  [70, 'six of six', 'bell', { pitch: 'A5' }],
  [72, 'measured', 'whoosh', { len: 0.4 }],
  [73, 'bar 1', 'tick'], [73.75, 'bar 2', 'tick'], [74.5, 'bar 3', 'pop', { pitch: 'D6' }],
  [78, 'opus', 'click'],
  [79, 'opus bar 1', 'tick'], [79.75, 'opus bar 2', 'tick'], [80.5, 'opus bar 3', 'pop', { pitch: 'A5' }],
  [84, 'measure yours', 'type', { n: 10, len: 1.4 }],
  [90, 'end card', 'impact'],
  [90.5, 'logo', 'bell', { pitch: 'D6' }],
];

// ------------------------------------------------------------------ helpers

const sizeOf = (f) => parseInt(f.split(' ')[1], 10);

/** Per-glyph text that rises in from below a clip line, glyph by glyph. */
function riseText(ctx, str, x, y, f, color, u, u0, { stagger = 0.02, track = 0, cfg = SPRING.snappy } = {}) {
  const L = layout(ctx, str, f, track);
  const size = sizeOf(f);
  ctx.save(); ctx.beginPath(); ctx.rect(x - 40, y - size * 1.2, L.width + 80, size * 1.5); ctx.clip();
  L.glyphs.forEach((g, j) => {
    const k = springU(u, u0 + j * stagger, cfg);
    if (k <= 0) return;
    glyph(ctx, g.ch, x + g.cx, y + (1 - k) * size * 1.1, f, color);
  });
  ctx.restore();
  return L.width;
}

/** A left-to-right reveal of a whole line (mask wipe), with a small lift. */
function wipeText(ctx, str, x, y, f, color, p, track = 0) {
  if (p <= 0) return 0;
  ctx.font = f; ctx.letterSpacing = `${track}px`;
  const w = ctx.measureText(str).width; ctx.letterSpacing = '0px';
  const size = sizeOf(f);
  ctx.save(); ctx.beginPath(); ctx.rect(x - 4, y - size * 1.2, (w + 8) * E.outCubic(p), size * 1.6); ctx.clip();
  text(ctx, str, x, y + (1 - E.outCubic(p)) * size * 0.25, f, color, 'left', track);
  ctx.restore();
  return w;
}

/** A line whose `backticked` parts are set in the UI face. Returns its width. */
function richLine(ctx, str, x, y, size, weight, color, codeColor) {
  let cx = x;
  str.split('`').forEach((p, i) => {
    if (!p) return;
    const code = i % 2 === 1;
    const f = code ? font(size * 0.9, 500, UI) : font(size, weight, D);
    text(ctx, p, cx, y, f, code ? codeColor : color);
    ctx.font = f; cx += ctx.measureText(p).width;
  });
  return cx - x;
}

/** Width of a line as richLine sets it (code spans in the UI face). */
function richWidth(ctx, str, size, weight) {
  let w = 0;
  str.split('`').forEach((p, i) => { ctx.font = i % 2 ? font(size * 0.9, 500, UI) : font(size, weight, D); w += ctx.measureText(p).width; });
  return w;
}
const ticks = (l) => (l.match(/`/g) ?? []).length;
/** Greedy wrap by the width richLine will draw; a code span split across lines is closed and reopened. */
function wrap(ctx, str, size, weight, maxW) {
  const lines = []; let cur = '';
  const close = (l) => (ticks(l) % 2 ? `${l}\`` : l);
  for (const w of str.split(' ')) {
    const t = cur ? `${cur} ${w}` : w;
    if (cur && richWidth(ctx, close(t), size, weight) > maxW) {
      const open = ticks(cur) % 2 === 1;
      lines.push(close(cur));
      cur = open ? `\`${w}` : w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

// ------------------------------------------------------------------ S1 hook (u 0..8)
function sceneHook(ctx, u) {
  fill(ctx, C.bg);
  const size = FORMAT.pick({ '16x9': 300, '1x1': 210 });
  const f = font(size, 800, D);
  const L = layout(ctx, '€1,618.50', f, -0.045 * size);
  const x0 = S.x + FORMAT.pick({ '16x9': 30, '1x1': 0 });
  const base = FORMAT.pick({ '16x9': 520, '1x1': 560 });
  const out = E.inBack(prog(u, 7.15, 7.9), 1.3);
  // a slow dolly in while the number holds (log-space scale reads as constant speed)
  const z = 1.06 ** prog(u, 0, 7.4);
  ctx.save(); ctx.translate(0, -out * H * 0.9); M.zoomAbout(ctx, z, x0, base);
  ctx.save(); ctx.beginPath(); ctx.rect(0, base - size, W, size * 1.25); ctx.clip();
  L.glyphs.forEach((g, j) => {
    const k = springU(u, -0.12 + j * 0.15, SPRING.snappy);
    if (k <= 0) return;
    glyph(ctx, g.ch, x0 + g.cx, base + (1 - k) * size, f, C.ink);
  });
  ctx.restore();
  const rp = E.outCubic(prog(u, 1.4, 3.2));
  ctx.fillStyle = C.blue; ctx.fillRect(x0 + 6, base + px(86), (L.width - 12) * rp, px(4));
  const ly = base + px(176);
  wipeText(ctx, 'Two runs of Sonnet 5.5 reached this number.', x0 + 6, ly, font(px(50), 500, D), C.slate, prog(u, 4, 5.2));
  wipeText(ctx, 'Both said the bug was fixed.', x0 + 6, ly + px(74), font(px(50), 700, D), C.ink, prog(u, 5.5, 6.5));
  ctx.restore();
}

// ------------------------------------------------------------------ S2 the bug report (u 8..16)
const PROMPT = [
  'The October refunds report shows €1,240.00 refunded,',
  "but the payment provider's statement for October shows €1,618.50.",
  "There's an export of our October refunds in data/refunds-2026-10.json.",
  'Please fix refundsTotal in src/finance/reports.js.',
];
const PROMPT_SQ = [
  'The October refunds report shows €1,240.00',
  "refunded, but the payment provider's",
  'statement for October shows €1,618.50.',
  "There's an export of our October refunds in",
  'data/refunds-2026-10.json. Please fix',
  'refundsTotal in src/finance/reports.js.',
];
function sceneReport(ctx, u) {
  fill(ctx, C.bg);
  const lines = SQ ? PROMPT_SQ : PROMPT;
  const size = FORMAT.pick({ '16x9': 48, '1x1': 42 });
  const lh = size * 1.42;
  const x = S.x + FORMAT.pick({ '16x9': 30, '1x1': 0 });
  const top = FORMAT.pick({ '16x9': 380, '1x1': 360 });
  const enter = springU(u, 7.6, SPRING.gentle);
  const leave = E.inCubic(prog(u, 15.1, 16));
  ctx.save(); ctx.translate(0, (1 - enter) * 220 - leave * 160); ctx.globalAlpha = 1 - leave;
  text(ctx, 'THE BUG REPORT', x, top - size * 1.6, font(px(26), 600, UI), C.slate, 'left', 3);
  text(ctx, 'bench task o37-refund-report', x + px(300), top - size * 1.6, font(px(26), 400, UI), mix(C.slate, C.bg, 0.4));
  const per = 4 / lines.length;
  lines.forEach((ln, i) => {
    wipeText(ctx, ln, x, top + i * lh, font(size, 500, D), C.ink, prog(u, 8 + i * per, 8 + i * per + per * 0.95));
  });
  // Underline the one file the report names.
  ctx.font = font(size, 500, D);
  const ux = x + ctx.measureText(SQ ? 'refundsTotal in ' : 'Please fix refundsTotal in ').width;
  const uw = ctx.measureText('src/finance/reports.js').width;
  const ly = top + (lines.length - 1) * lh;
  const up = E.inOutCubic(prog(u, 12, 12.8));
  if (up > 0) {
    ctx.fillStyle = C.bg; ctx.fillRect(ux - 2, ly - size, uw + 4, size * 1.3);
    text(ctx, 'src/finance/reports.js', ux, ly, font(size, 500, D), mix(C.ink, C.blue, up));
    ctx.fillStyle = C.blue; ctx.fillRect(ux, ly + size * 0.28, uw * up, px(5));
  }
  riseText(ctx, 'The report names one file.', x, top + lines.length * lh + size * 1.2, font(px(64), 750, D), C.ink, u, 13, { stagger: 0.012 });
  ctx.restore();
}

// ------------------------------------------------------------------ the two runs (S3/S4)
// [beat, kind, text]. kind: tool (a tool call), say (the agent's own words), out (what a tool printed), end.
const ALONE = [
  [17, 'tool', 'Read  src/finance/reports.js'],
  [19, 'tool', '$ head -c 1500 data/refunds-2026-10.json'],
  [21, 'say', 'Some records use `amount` (euro string) instead of `amountCents`.'],
  [23, 'tool', '$ node -e \'const d=require("./data/refunds-2026-10.json")…\''],
  [24, 'out', "11  [ 'amountCents', 'amount' ]"],
  [26, 'tool', '$ sed -i "1s/.*/import { formatEuros, toCents }…" src/finance/reports.js'],
  [29, 'say', 'I fixed `refundsTotal` in `src/finance/reports.js`. On the October export it now returns 161850 cents, which is €1,618.50.'],
  [32, 'end', 'run ended  ·  4 tool calls  ·  $0.07'],
];
const WITH = [
  [17, 'tool', 'Skill  senioros:senior-debugging'],
  [18.25, 'tool', 'Read  src/finance/reports.js'],
  [19.5, 'tool', '$ head -c 1500 data/refunds-2026-10.json; cat src/finance/store.js'],
  [21, 'tool', '$ cat src/support/refunds.js src/finance/money.js'],
  [22, 'out', ' * The agent types the amount in euros, e.g. "37.85" or "37,85".'],
  [23.5, 'tool', '$ grep -rn "amount\\b" src test'],
  [25, 'tool', '$ grep -rn "refunds()\\|refundsFor\\|amountCents" src'],
  [26.5, 'tool', "$ cat >> src/finance/money.js <<'EOF'"],
  [27.5, 'out', '==> src/finance/ledger.js <==   ==> src/finance/payouts.js <=='],
  [29, 'say', "Those three files have no imports yet, so I'll add them, switch support to write `amountCents`, and add the test."],
  [31, 'tool', '$ sed -i "1i import { refundCents } from \'./money.js\';" src/finance/…'],
  [32.5, 'tool', "$ cat >> test/finance.test.js <<'EOF'"],
  [33.5, 'out', 'pass 18  fail 0  ·  pass 17  fail 1  ·  pass 18  fail 0'],
  [35, 'say', 'Risk 1: another reader of refunds still sums only `amountCents`.'],
  [36.5, 'tool', '$ grep -rn "amountCents ?? 0\\|\\.amount\\b" src README.md'],
  [38, 'end', 'run ended  ·  10 tool calls  ·  $0.17'],
];
const turnsAt = (log, u) => log.filter(([b, k]) => k === 'tool' && b <= u).length;

function paneRects() {
  const gap = px(32);
  const top = FORMAT.pick({ '16x9': 196, '1x1': 150 });
  if (SQ) {
    const h = (S.y + S.h - top - gap) / 2;
    return [{ x: S.x, y: top, w: S.w, h }, { x: S.x, y: top + h + gap, w: S.w, h }];
  }
  const w = (S.w - gap) / 2, h = S.y + S.h - top;
  return [{ x: S.x, y: top, w, h }, { x: S.x + w + gap, y: top, w, h }];
}

function header(ctx, u) {
  // The report's last sentence stays as the shared header over both runs.
  const p = springU(u, 15.4, SPRING.gentle);
  const leave = E.inCubic(prog(u, 55, 56));
  if (p <= 0) return;
  ctx.save(); ctx.globalAlpha = clamp(p) * (1 - leave);
  const y = FORMAT.pick({ '16x9': 128, '1x1': 108 }) + (1 - p) * 40;
  richLine(ctx, 'Same prompt: "…Please fix `refundsTotal` in `src/finance/reports.js`."', S.x, y, px(34), 500, C.slate, C.ink);
  ctx.restore();
}

function drawLog(ctx, u, r, log, dimFrom) {
  const pad = px(34);
  const line = px(28), say = px(33);
  const maxW = r.w - pad * 2;
  const items = log.map(([b, kind, str]) => {
    if (kind === 'say') {
      const ls = wrap(ctx, str, say, 500, maxW - px(20));
      return { b, kind, lines: ls, h: ls.length * say * 1.38 + px(22) };
    }
    return { b, kind, lines: [str], h: line * 1.75 };
  });
  const bodyTop = r.y + px(150);
  const bodyH = r.h - px(150) - pad;
  // Scroll so the newest entry stays in view: each entry is a spring step on the scroll offset.
  let total = 0; const ys = [];
  items.forEach((it) => { ys.push(total); total += it.h; });
  let scroll = 0, prev = 0;
  items.forEach((it, i) => {
    const want = Math.max(0, ys[i] + it.h - bodyH);
    scroll += (want - prev) * springU(u, it.b, SPRING.snappy); prev = want;
  });
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y + px(122), r.w, r.h - px(124)); ctx.clip();
  items.forEach((it, i) => {
    if (it.b > u + 0.001) return;
    const k = springU(u, it.b, SPRING.snappy);
    const y = bodyTop + ys[i] - scroll + (1 - k) * px(26);
    const fresh = 1 - prog(u, it.b + 0.5, it.b + 2.5);
    ctx.save(); ctx.globalAlpha *= clamp(k * 1.4);
    if (it.kind === 'tool' || it.kind === 'out') {
      ctx.save(); ctx.beginPath(); ctx.rect(r.x + pad, y - line * 1.1, maxW, line * 1.7); ctx.clip();
      if (it.kind === 'tool') {
        const str = it.lines[0];
        const isTool = !str.startsWith('$');
        const head = isTool ? str.split('  ')[0] : '$';
        const rest = isTool ? str.slice(head.length + 2) : str.slice(2);
        const hf = font(line, 600, UI);
        text(ctx, head, r.x + pad, y, hf, isTool ? C.blue : C.slate);
        ctx.font = hf; const hw = ctx.measureText(`${head}  `).width;
        text(ctx, rest, r.x + pad + hw, y, font(line, 400, UI), mix(C.ink, C.slate, 0.15 + 0.55 * (1 - fresh)));
      } else {
        text(ctx, it.lines[0], r.x + pad + px(26), y, font(line * 0.92, 400, UI), C.slate);
      }
      ctx.restore();
    } else if (it.kind === 'say') {
      ctx.fillStyle = mix(C.slate, C.surface, 0.5); ctx.fillRect(r.x + pad, y - say * 0.85, px(3), it.lines.length * say * 1.38 - say * 0.25);
      it.lines.forEach((ln, j) => richLine(ctx, ln, r.x + pad + px(20), y + j * say * 1.38, say, 500, C.ink, C.sky));
    } else {
      text(ctx, it.lines[0], r.x + pad, y + px(4), font(line, 500, UI), C.slate, 'left', 1);
    }
    ctx.restore();
  });
  ctx.restore();
  // Dim the pane once its run has ended.
  const d = E.inOutCubic(prog(u, dimFrom, dimFrom + 1.5)) * 0.5;
  if (d > 0) { ctx.save(); ctx.globalAlpha = d; rrect(ctx, r.x, r.y + px(118), r.w, r.h - px(118), px(22)); ctx.fillStyle = C.surface; ctx.fill(); ctx.restore(); }
}

function paneChrome(ctx, u, r, title, sub, log, accent) {
  rrect(ctx, r.x, r.y, r.w, r.h, px(22)); ctx.fillStyle = C.surface; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = accent ? mix(C.blue, C.surface, 0.35) : mix(C.slate, C.surface, 0.78); ctx.stroke();
  const pad = px(34);
  text(ctx, title, r.x + pad, r.y + px(62), font(px(36), 700, D), C.ink);
  text(ctx, sub, r.x + pad, r.y + px(96), font(px(21), 400, UI), C.slate);
  const n = turnsAt(log, u);
  const last = log.filter(([b, k]) => k === 'tool' && b <= u).at(-1);
  const pop = last ? bump(u, last[0] + 0.15, 0.5) : 0;
  text(ctx, String(n), r.x + r.w - pad, r.y + px(70), font(px(54) * (1 + 0.12 * pop), 700, UI), accent ? C.blue : C.ink, 'right');
  text(ctx, 'TOOL CALLS', r.x + r.w - pad, r.y + px(98), font(px(16), 600, UI), C.slate, 'right', 2);
  ctx.fillStyle = mix(C.slate, C.surface, 0.85); ctx.fillRect(r.x + pad, r.y + px(118), r.w - pad * 2, 1.5);
}

// The real files of the task. The writer saved the refund as a euro string; four readers sum it.
const READERS = ['finance/reports.js', 'finance/ledger.js', 'finance/payouts.js', 'finance/checkout.js'];
function drawMap(ctx, u, r, lit, accent) {
  const appear = springU(u, 40.2, SPRING.gentle);
  if (appear <= 0) return;
  ctx.save(); ctx.globalAlpha = clamp(appear);
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y + px(120), r.w, r.h - px(120)); ctx.clip();
  rrect(ctx, r.x, r.y, r.w, r.h, px(22)); ctx.fillStyle = C.surface; ctx.fill();
  ctx.restore();
  const pad = px(34);
  const top = r.y + px(150), bottom = r.y + r.h - pad - px(SQ ? 40 : 120);
  const wy = (top + bottom) / 2 + px(10);
  const wx = r.x + pad;
  const rx = r.x + r.w * (SQ ? 0.46 : 0.5);
  const nodeH = px(60), gapY = Math.min(px(96), (bottom - top - nodeH) / (READERS.length - 1));
  const ry0 = wy - ((READERS.length - 1) * gapY) / 2;
  const nf = font(px(27), 500, UI);
  const node = (x, y, label, on, sub) => {
    ctx.font = nf; const w = ctx.measureText(label).width + px(40);
    rrect(ctx, x, y - nodeH / 2, w, nodeH, px(12));
    ctx.fillStyle = mix(C.surface, C.blue, 0.16 * on); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = mix(mix(C.slate, C.surface, 0.65), C.blue, on); ctx.stroke();
    text(ctx, label, x + px(20), y + px(8), nf, mix(C.slate, C.ink, on));
    if (sub) text(ctx, sub, x + px(4), y - nodeH / 2 - px(14), font(px(16), 600, UI), C.slate, 'left', 2);
    return w;
  };
  const writerOn = lit.writer === undefined ? 0 : E.outCubic(prog(u, lit.writer, lit.writer + 0.6));
  ctx.font = nf; const ww = ctx.measureText('support/refunds.js').width + px(40);
  READERS.forEach((name, i) => {
    const y = ry0 + i * gapY;
    const at = lit.readers[i];
    const on = at === undefined ? 0 : E.outCubic(prog(u, at, at + 0.6));
    const draw = E.inOutCubic(prog(u, 40.6 + i * 0.25, 41.6 + i * 0.25));
    const x1 = wx + ww, x2 = rx, cx = (x1 + x2) / 2;
    ctx.save(); ctx.strokeStyle = mix(mix(C.slate, C.surface, 0.72), C.blue, Math.min(on, writerOn)); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x1, wy);
    const steps = 32;
    for (let s = 1; s <= Math.floor(steps * draw); s++) {
      const t = s / steps;
      const bx = (1 - t) ** 3 * x1 + 3 * (1 - t) ** 2 * t * cx + 3 * (1 - t) * t * t * cx + t ** 3 * x2;
      const by = (1 - t) ** 3 * wy + 3 * (1 - t) ** 2 * t * wy + 3 * (1 - t) * t * t * y + t ** 3 * y;
      ctx.lineTo(bx, by);
    }
    ctx.stroke(); ctx.restore();
    if (draw > 0.85) node(rx, y, name, on, i === 0 ? 'READ IT' : null);
  });
  node(wx, wy, 'support/refunds.js', writerOn, 'WRITES THE REFUND');
  // what the run changed (from git status of the run's repository)
  const cy = r.y + r.h - pad - px(SQ ? 4 : 64);
  wipeText(ctx, lit.changed, r.x + pad, cy, font(px(SQ ? 26 : 30), 700, D), accent ? C.ink : C.slate, prog(u, lit.caption, lit.caption + 0.8));
  if (lit.test && !SQ) {
    const y = cy + px(46);
    const f1 = prog(u, 49, 49.4), f2 = prog(u, 51, 51.4);
    const tf = font(px(22), 600, UI);
    if (f1 > 0) {
      ctx.save(); ctx.globalAlpha *= f1;
      text(ctx, 'its new test, before the fix:', r.x + pad, y, font(px(22), 400, UI), C.slate);
      ctx.font = font(px(22), 400, UI); let x = r.x + pad + ctx.measureText('its new test, before the fix:  ').width;
      text(ctx, 'fail 1', x, y, tf, C.fail);
      ctx.font = tf; x += ctx.measureText('fail 1   ').width;
      ctx.restore();
      if (f2 > 0) {
        ctx.save(); ctx.globalAlpha *= f2;
        text(ctx, 'after:', x, y, font(px(22), 400, UI), C.slate);
        ctx.font = font(px(22), 400, UI); x += ctx.measureText('after:  ').width;
        text(ctx, 'pass 18', x, y, tf, C.pass);
        ctx.restore();
      }
    }
  }
  ctx.restore();
}

function sceneRuns(ctx, u) {
  fill(ctx, C.bg);
  const [a, b] = paneRects();
  const slide = 1 - springU(u, 15.6, SPRING.gentle);
  header(ctx, u);
  const leave = E.inCubic(prog(u, 55.2, 56));
  ctx.save(); ctx.globalAlpha = 1 - leave; ctx.translate(0, -leave * 60);
  ctx.save(); ctx.translate(SQ ? 0 : -slide * W * 0.55, SQ ? -slide * H * 0.5 : 0);
  paneChrome(ctx, u, a, 'Sonnet 5.5 alone', 'recorded run none--2', ALONE, false);
  if (u < 41) drawLog(ctx, u, a, ALONE, 33);
  drawMap(ctx, u, a, { readers: [42], caption: 42.6, changed: 'Changed 1 file: the one the report named.' }, false);
  ctx.restore();
  ctx.save(); ctx.translate(SQ ? 0 : slide * W * 0.55, SQ ? slide * H * 0.5 : 0);
  paneChrome(ctx, u, b, 'Sonnet 5.5 + SeniorOS', 'recorded run senioros--2', WITH, true);
  if (u < 41) drawLog(ctx, u, b, WITH, 39);
  drawMap(ctx, u, b, { writer: 43.5, readers: [44.5, 45.25, 46, 46.75], caption: 47.5, changed: 'Changed the writer, its 4 readers, a helper, a test.', test: true }, true);
  ctx.restore();
  ctx.restore();
}

// ------------------------------------------------------------------ S5 the quote (u 56..64)
const QUOTE = '"If anything else sums refunds directly, it may have the same problem."';
function sceneQuote(ctx, u) {
  fill(ctx, C.bg);
  const x = S.x + FORMAT.pick({ '16x9': 30, '1x1': 0 });
  const size = FORMAT.pick({ '16x9': 84, '1x1': 60 });
  const lines = wrap(ctx, QUOTE, size, 600, S.w - 120);
  const top = FORMAT.pick({ '16x9': 470, '1x1': 500 }) - (lines.length - 1) * size * 0.6;
  const leave = E.inCubic(prog(u, 63.3, 64));
  ctx.save(); ctx.globalAlpha = 1 - leave;
  text(ctx, 'SONNET 5.5 ALONE, IN ITS FINAL REPORT', x, top - size * 1.35, font(px(26), 600, UI), C.slate, 'left', 3);
  let wi = 0;
  const f = font(size, 600, D);
  lines.forEach((ln, i) => {
    let cx = x;
    ln.split(' ').forEach((w) => {
      const k = springU(u, 56.1 + wi * 0.28, SPRING.snappy);
      ctx.font = f; const ww = ctx.measureText(`${w} `).width;
      if (k > 0) { ctx.save(); ctx.globalAlpha *= clamp(k); text(ctx, w, cx, top + i * size * 1.2 + (1 - k) * 18, f, C.ink); ctx.restore(); }
      cx += ww; wi++;
    });
  });
  const y2 = top + lines.length * size * 1.2 + size * 0.9;
  riseText(ctx, 'It said so. Then it stopped.', x, y2, font(size * 1.05, 800, D), C.blue, u, 60, { stagger: 0.015 });
  ctx.restore();
}

// ------------------------------------------------------------------ S6 hidden tests (u 64..72)
const FAILED = [
  'the customer balance includes support refunds',
  'payout reconciliation includes support refunds',
  'cancelling an order after a support refund only refunds what is left',
  'support cannot refund more than what is left after earlier support refunds',
];
function sceneVerdict(ctx, u) {
  fill(ctx, C.bg);
  const [a, b] = paneRects();
  const leave = E.inCubic(prog(u, 71.3, 72));
  ctx.save(); ctx.globalAlpha = 1 - leave;
  riseText(ctx, 'Then the hidden tests ran.', S.x, FORMAT.pick({ '16x9': 142, '1x1': 118 }), font(px(56), 750, D), C.ink, u, 64, { stagger: 0.012 });
  const big = px(SQ ? 120 : 200);
  const count = (k, u0) => Math.round(k * clamp(prog(u, u0, u0 + 1.2)));
  const ly = a.y + (SQ ? big * 0.95 : px(220));
  ctx.save(); ctx.globalAlpha *= clamp(springU(u, 64.4, SPRING.gentle));
  text(ctx, `${count(2, 64.5)} of 6`, a.x, ly, font(big, 800, D), C.fail, 'left', -0.03 * big);
  text(ctx, 'hidden tests passed: Sonnet 5.5 alone', a.x + px(6), ly + px(60), font(px(30), 500, UI), C.slate);
  FAILED.forEach((name, i) => {
    const p = prog(u, 66 + i, 66.6 + i);
    if (p <= 0) return;
    const y = ly + px(SQ ? 92 : 150) + i * px(SQ ? 32 : 62);
    ctx.save(); ctx.globalAlpha *= E.outCubic(p);
    text(ctx, 'fail', a.x + px(6), y, font(px(26), 700, UI), C.fail);
    text(ctx, name, a.x + px(86), y, font(px(SQ ? 20 : 27), 400, UI), C.ink);
    ctx.restore();
  });
  ctx.restore();
  const ry = b.y + (SQ ? big * 0.95 : px(220));
  ctx.save(); ctx.globalAlpha *= clamp(springU(u, 64.8, SPRING.gentle));
  text(ctx, `${count(6, 64.8)} of 6`, b.x, ry, font(big * (1 + 0.03 * bump(u, 70, 0.8)), 800, D), C.pass, 'left', -0.03 * big);
  text(ctx, 'hidden tests passed: Sonnet 5.5 + SeniorOS', b.x + px(6), ry + px(60), font(px(30), 500, UI), C.slate);
  if (!SQ) wipeText(ctx, 'Same model. The difference is what it checked.', S.x + px(6), S.y + S.h - px(40), font(px(46), 700, D), C.ink, prog(u, 70, 70.8));
  ctx.restore();
  ctx.restore();
}

// ------------------------------------------------------------------ S7 measured (u 72..84)
function bars(ctx, u, x, y, w, title, sub, rows, u0) {
  const tp = prog(u, u0, u0 + 0.8);
  wipeText(ctx, title, x, y, font(px(56), 800, D), C.ink, tp);
  wipeText(ctx, sub, x, y + px(54), font(px(26), 400, UI), C.slate, tp);
  const labW = px(270), trackW = w - labW - px(150);
  rows.forEach(([label, k, n, mine], i) => {
    const ry = y + px(150) + i * px(96);
    const p = E.outCubic(prog(u, u0 + 1 + i * 0.75, u0 + 2.2 + i * 0.75));
    if (p <= 0) return;
    ctx.save(); ctx.globalAlpha *= clamp(p * 2);
    text(ctx, label, x, ry + px(12), font(px(32), mine ? 700 : 500, D), mine ? C.ink : C.slate);
    rrect(ctx, x + labW, ry - px(16), trackW, px(34), px(4)); ctx.fillStyle = mix(C.surface, C.slate, 0.08); ctx.fill();
    const bw = Math.max(px(6), trackW * (k / n) * p);
    rrect(ctx, x + labW, ry - px(16), bw, px(34), px(4)); ctx.fillStyle = mine ? C.blue : mix(C.slate, C.bg, 0.35); ctx.fill();
    text(ctx, `${k}/${n}`, x + labW + trackW + px(24), ry + px(13), font(px(34), 700, UI), mine ? C.ink : C.slate);
    ctx.restore();
  });
}
function sceneMeasured(ctx, u) {
  fill(ctx, C.bg);
  const enter = springU(u, 71.6, SPRING.gentle);
  const leave = E.inCubic(prog(u, 83.3, 84));
  ctx.save(); ctx.translate(0, (1 - enter) * 120 - leave * 200); ctx.globalAlpha = clamp(enter) * (1 - leave);
  text(ctx, 'NOT ONE RUN: THE WHOLE BENCH', S.x, FORMAT.pick({ '16x9': 128, '1x1': 112 }), font(px(26), 600, UI), C.slate, 'left', 3);
  const colW = SQ ? S.w : (S.w - px(100)) / 2;
  const y1 = FORMAT.pick({ '16x9': 330, '1x1': 210 });
  bars(ctx, u, S.x, y1, colW, 'Sonnet 5.5', '4 tasks x 5 runs, cause in another module', [
    ['model alone', 0, 20, false], ['Superpowers', 0, 20, false], ['SeniorOS', 12, 20, true],
  ], 72);
  wipeText(ctx, 'p < 0.001 against the model alone', S.x, y1 + px(470), font(px(30), 500, UI), C.blue, prog(u, 75.5, 76.3));
  const x2 = SQ ? S.x : S.x + colW + px(100);
  const y2 = SQ ? y1 + px(500) : y1;
  bars(ctx, u, x2, y2, colW, 'Opus 5.5', '3 tasks x 5 runs, fifth blind round', [
    ['model alone', 2, 15, false], ['best other pack', 6, 15, false], ['SeniorOS', 10, 15, true],
  ], 78);
  wipeText(ctx, 'p < 0.001 against the model alone', x2, y2 + px(470), font(px(30), 500, UI), C.blue, prog(u, 81.5, 82.3));
  ctx.restore();
}

// ------------------------------------------------------------------ S8 measure yours (u 84..90)
const CMD = 'node evals/bench/bench.mjs run --packs mine=you/your-pack@<commit>';
function sceneYours(ctx, u) {
  fill(ctx, C.bg);
  const x = S.x + FORMAT.pick({ '16x9': 30, '1x1': 0 });
  const y = FORMAT.pick({ '16x9': 500, '1x1': 470 });
  const leave = E.inCubic(prog(u, 89.4, 90));
  ctx.save(); ctx.globalAlpha = 1 - leave;
  riseText(ctx, 'Measure your own pack.', x, y - px(120), font(px(84), 800, D), C.ink, u, 84, { stagger: 0.012 });
  const f = font(px(SQ ? 28 : 34), 500, UI);
  const n = Math.floor(CMD.length * E.outCubic(prog(u, 84.6, 86.8)));
  const shown = CMD.slice(0, n);
  const cut = CMD.indexOf(' --packs');
  const rows = SQ ? [shown.slice(0, cut), n > cut ? shown.slice(cut + 1) : ''] : [shown];
  ctx.font = f; const dw = ctx.measureText('$ ').width;
  text(ctx, '$', x, y, f, C.slate);
  rows.forEach((s, i) => text(ctx, s, x + dw, y + i * px(46), f, C.ink));
  const li = rows.length - 1 - (rows.at(-1) === '' ? 1 : 0);
  if (Math.floor(u * 2) % 2 === 0 || n < CMD.length) {
    ctx.font = f; const cw = ctx.measureText(rows[li]).width;
    ctx.fillStyle = C.blue; ctx.fillRect(x + dw + cw + 6, y + li * px(46) - px(28), px(14), px(34));
  }
  wipeText(ctx, "Every table, with each pack's commit: evals/bench/LEADERBOARD.md", x, y + px(SQ ? 150 : 110), font(px(30), 500, D), C.slate, prog(u, 87, 88));
  ctx.restore();
}

// ------------------------------------------------------------------ S9 end card (u 90..96)
function sceneEnd(ctx, u, IMG) {
  fill(ctx, C.bg);
  const x = S.x + FORMAT.pick({ '16x9': 30, '1x1': 0 });
  const y = 520;
  const ms = px(150);
  const k = springU(u, 89.85, SPRING.bouncy);
  if (IMG.mark && k > 0) {
    ctx.save(); ctx.translate(x + ms / 2, y - px(70)); ctx.scale(k, k); ctx.drawImage(IMG.mark, -ms / 2, -ms / 2, ms, ms); ctx.restore();
  }
  riseText(ctx, 'SeniorOS', x + ms + px(36), y - px(22), font(px(140), 800, D), C.ink, u, 90.2, { stagger: 0.03, track: -4 });
  wipeText(ctx, 'Measured, not claimed.', x + px(4), y + px(110), font(px(52), 600, D), C.slate, prog(u, 91, 92));
  wipeText(ctx, 'github.com/joshsegatt/SeniorOS', x + px(4), y + px(184), font(px(32), 500, UI), C.blue, prog(u, 91.6, 92.6));
}

M.film({
  fonts: [font(100, 800, D), font(100, 500, D), font(40, 400, UI), font(40, 600, UI)],
  images: { mark: 'assets/senioros-mark.svg' },
  hits: HITS,
  draw(ctx, u, t, IMG) {
    if (u < 8) sceneHook(ctx, u);
    else if (u < 16) sceneReport(ctx, u);
    else if (u < 56) sceneRuns(ctx, u);
    else if (u < 64) sceneQuote(ctx, u);
    else if (u < 72) sceneVerdict(ctx, u);
    else if (u < 84) sceneMeasured(ctx, u);
    else if (u < 90) sceneYours(ctx, u);
    else sceneEnd(ctx, u, IMG);
  },
});
