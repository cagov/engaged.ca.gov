/**
 * Ideas we heard: word cloud of the poll's policy ideas.
 *
 * One canvas. The top poll ideas fly in once when the chart scrolls into
 * view (sized by how many people raised each), then stay put. Ported from
 * the design team's ideas-we-heard-inline-v4 sketch (2026-09-17); the second
 * phase (the 27 discussion ideas) and its arrows were dropped on 9/21.
 *
 * Root contract (see mmmd-ai-impact-report.njk):
 *   [data-ideas-cloud][data-src]     root, JSON URL
 *   canvas[data-ideas-canvas]        the drawing surface
 *
 * Layout runs in the browser at load (same font measures and draws, so no
 * overlaps). Only the top KEEP ideas are laid out and the tail fades toward
 * transparent so it reads as "there are more" without cramming every label in.
 */
import { createLayoutEngine } from "./word-cloud-layout.js";

// Logical fields. w/h is the visible frame (wide is the design's 1400x820;
// narrow is a portrait frame for phones). Words are laid out in the larger
// lw/lh field centred on the frame, so the faded outer ideas run past the
// frame's edge and are clipped, reading as "there are more" (9/23).
const PRESETS = {
  wide: { w: 1400, h: 820, lw: 1660, lh: 980, keep: 185, fade: 100 },
  narrow: { w: 800, h: 1000, lw: 940, lh: 1180, keep: 85, fade: 45 },
};
const NARROW_BELOW = 700; // CSS px of available width
const FADE_FLOOR = 0.06; // alpha of the last kept idea
const FADE_CURVE = 1.6; // >1 keeps more of the fade band legible longer
const SEED = 20260826;
const ARRIVE_S = 4.5; // fly-in duration (was 2.6; slowed 9/24)

function mulberry32(a) {
  let s = a | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

async function fontsReady() {
  if (!document.fonts) return;
  try {
    await document.fonts.load("400 16px 'Noto Sans'");
    await document.fonts.ready;
  } catch {
    /* fall back to whatever font is available */
  }
}

export async function initIdeasCloud(root) {
  if (!root) return;
  const canvas = root.querySelector("canvas[data-ideas-canvas]");
  if (!canvas) return;

  let data;
  try {
    const res = await fetch(root.dataset.src);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    data = await res.json();
  } catch (err) {
    console.error("ideas cloud: could not load data", err);
    return;
  }
  await fontsReady();

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SUBTHEMES = data.subthemes;
  const ctx = canvas.getContext("2d");
  const fit = { scale: 1, dpr: 1 };
  const MAX_COUNT = Math.max(...data.poll.map((c) => c.count));
  const baseSize = (n) => 11 + 26 * (n / MAX_COUNT) ** 0.6;

  // ---- layout -------------------------------------------------------------
  let preset = null;
  let F = null; // current field {w, h}
  let words = [];
  let target = [];
  let home = [];
  let drawWord = null;

  function tailAlpha(rank, kept, fade) {
    const band = Math.min(fade, kept);
    const start = kept - band;
    if (band === 0 || rank < start) return 1;
    const t = (rank - start + 1) / band;
    return lerp(1, FADE_FLOOR, t ** FADE_CURVE);
  }

  function layout(name) {
    preset = PRESETS[name];
    F = { w: preset.w, h: preset.h };
    const rand = mulberry32(SEED);
    const WL = createLayoutEngine({ rand, measureCtx: ctx });
    const kept = data.poll.slice(0, preset.keep);

    const build = (scale) =>
      kept.map((c, i) => {
        const fontSize = baseSize(c.count) * scale;
        const lines = WL.wrapTwoLines(c.label, fontSize, 400, fontSize * 9.5);
        const w =
          Math.max(...lines.map((l) => WL.textWidth(l, fontSize, 400))) + 6;
        const h = lines.length * fontSize * 1.22 + 4;
        return {
          label: c.label,
          subtheme: c.subtheme,
          count: c.count,
          fontSize,
          lines,
          w,
          h,
          arrivalRand: rand(),
          tail: tailAlpha(i, kept.length, preset.fade),
        };
      });
    const L = { w: preset.lw, h: preset.lh }; // layout field, larger than the frame
    const opts = { width: L.w, height: L.h, padding: 2, weight: 400 };

    // Largest uniform font multiplier (stepping down 4%) at which every label
    // places. Two attempts per step: the spiral direction is random, so one
    // dropped label is often luck rather than a real limit.
    let scale =
      Math.sqrt((L.w * L.h) / (2307 * 1124 * (kept.length / 337))) * 1.08;
    let placed = null;
    for (let k = 0; k < 16 && !placed; k++, scale *= 0.96) {
      for (let attempt = 0; attempt < 2 && !placed; attempt++) {
        const ws = build(scale);
        const p = WL.layoutWithD3Cloud(ws, opts);
        if (p.length === ws.length) placed = p;
      }
    }
    if (!placed) placed = WL.layoutWithD3Cloud(build(scale), opts);
    words = placed;

    // d3-cloud positions are relative to the layout field's centre, which is
    // also the frame's centre, so the frame simply crops the outer words.
    target = words.map((w) => [w.x + F.w / 2, w.y + F.h / 2]);
    // Arrival scatter: heavier ideas start nearer the middle.
    home = words.map((w) => {
      const spread =
        (40 + 300 * (1 - Math.sqrt(w.count / MAX_COUNT))) * (F.w / 2400);
      const a = rand() * Math.PI * 2;
      const r = rand() * spread;
      return [F.w / 2 + Math.cos(a) * r, F.h / 2 + Math.sin(a) * r * 0.68];
    });
    drawWord = (lines, x, y, fontSize, color, alpha) =>
      WL.drawWord(ctx, lines, x, y, fontSize, 400, color, alpha, 1);
  }

  // ---- canvas sizing ------------------------------------------------------
  function resize() {
    const cssW = root.clientWidth || PRESETS.wide.w;
    const name = cssW < NARROW_BELOW ? "narrow" : "wide";
    if (!F || PRESETS[name] !== preset) layout(name);
    const cssH = (cssW * F.h) / F.w;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.height = `${cssH}px`;
    fit.scale = cssW / F.w;
    fit.dpr = dpr;
    render();
  }

  // ---- drawing ------------------------------------------------------------
  /** arrive: 0..1 progress of the fly-in (1 = settled). */
  function drawState(arrive) {
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(fit.scale * fit.dpr, 0, 0, fit.scale * fit.dpr, 0, 0);
    words.forEach((w, i) => {
      const a = ease(clamp01((arrive - w.arrivalRand * 0.45 - 0.02) / 0.5));
      if (a <= 0.01) return;
      const x = lerp(home[i][0], target[i][0], a);
      const y = lerp(home[i][1], target[i][1], a);
      drawWord(
        w.lines,
        x,
        y,
        w.fontSize,
        SUBTHEMES[w.subtheme].color,
        w.tail * a,
      );
    });
    ctx.restore();
  }

  // ---- the one-time arrival -----------------------------------------------
  let arrive = reduced ? 1 : 0;
  let visible = true;
  let last = performance.now();
  function render() {
    if (F) drawState(arrive);
  }
  function tick(now) {
    // rAF timestamps mark the frame's start, which can precede `last` after
    // the layout blocked the thread; never let the clock run backwards.
    const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
    last = now;
    if (visible && arrive < 1) {
      arrive = Math.min(1, arrive + dt / ARRIVE_S);
      render();
    }
    if (arrive < 1) requestAnimationFrame(tick);
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) => {
        visible = entries.some((e) => e.isIntersecting);
      },
      { threshold: 0 },
    ).observe(root);
  }
  window.addEventListener("resize", resize);

  // ---- boot ---------------------------------------------------------------
  resize();
  root.classList.add("ideas-cloud-ready");
  last = performance.now();
  if (arrive < 1) requestAnimationFrame(tick);
}
