/**
 * Ideas we heard: two-phase word cloud.
 *
 * One canvas that animates between the poll's policy ideas (Phase 1, sized by
 * how many people raised each) and the 27 ideas that came out of the
 * discussions (Phase 2, sized by votes). Ported from the design team's
 * ideas-we-heard-inline-v4 sketch (2026-09-17).
 *
 * Behaviour mirrors participant-funnel.js: the poll cloud arrives, then the
 * two phases alternate on a timer until the reader clicks an arrow; from then
 * on the arrows drive the phase and the timer stays off. Tweens always run.
 *
 * Root contract (see mmmd-ai-impact-report.njk):
 *   [data-ideas-cloud][data-src]     root, JSON URL
 *   canvas[data-ideas-canvas]        the drawing surface
 *   [data-cloud-prev] / [data-cloud-next]   margin arrows; hidden at the ends
 *   [data-cloud-counter]             live region; text from data-step-counter
 *   data-* on the root: step-counter ("Phase {current} of {total}"),
 *     phase-1-alt / phase-2-alt (canvas aria-label per phase)
 *
 * Layout runs in the browser at load (same font measures and draws, so no
 * overlaps). Phase 2 uses the kept arrangement shipped in the JSON when the
 * field and font match; otherwise it is computed. The poll cloud keeps only
 * the top ideas (KEEP per preset) and fades the tail toward transparent so it
 * reads as "there are more" without cramming every label in.
 */
import { createLayoutEngine } from "./word-cloud-layout.js";

// Logical fields. Wide is the design's 1400x820; narrow is a portrait field
// with fewer poll ideas so labels stay legible on a phone.
const PRESETS = {
  wide: { w: 1400, h: 820, keep: 135, fade: 45 },
  narrow: { w: 800, h: 1000, keep: 60, fade: 20 },
};
const NARROW_BELOW = 700; // CSS px of available width
const FADE_FLOOR = 0.06; // alpha of the last kept poll idea
const FADE_CURVE = 1.6; // >1 keeps more of the fade band legible longer
const SEED = 20260826;
// Timeline in seconds: one-time arrival, then a loop.
const T = {
  arrive: 2.6,
  hold1: 3.8,
  toP2: 3.0,
  hold2: 6.5,
  toP1: 3.0,
  hold1b: 3.8,
};
const LOOP = T.hold1 + T.toP2 + T.hold2 + T.toP1 + T.hold1b;

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
    await Promise.all([
      document.fonts.load("400 16px 'Noto Sans'"),
      document.fonts.load("700 16px 'Noto Sans'"),
    ]);
    await document.fonts.ready;
  } catch {
    /* fall back to whatever font is available */
  }
}

export async function initIdeasCloud(root) {
  if (!root) return;
  const canvas = root.querySelector("canvas[data-ideas-canvas]");
  const prevBtn = root.querySelector("[data-cloud-prev]");
  const nextBtn = root.querySelector("[data-cloud-next]");
  const counterEl = root.querySelector("[data-cloud-counter]");
  if (!canvas) return;
  const counterTemplate =
    root.dataset.stepCounter || "Phase {current} of {total}";
  // data-phase-1-alt does not camel-case in dataset (digit after a hyphen).
  const phaseAlt = [
    root.getAttribute("data-phase-1-alt"),
    root.getAttribute("data-phase-2-alt"),
  ];

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

  // ---- layout -------------------------------------------------------------
  let preset = null;
  let F = null; // current field {w, h}
  let poll = [];
  let ideas = [];
  let pollTarget = [];
  let pollHome = [];
  let ideaPos = [];
  let anchors = [];
  let ideaDelay = [];

  const MAX_COUNT = Math.max(...data.poll.map((c) => c.count));
  const MAX_VOTES = Math.max(...data.discussion.map((c) => c.votes));
  const pollBase = (n) => 11 + 26 * (n / MAX_COUNT) ** 0.6;
  const ideaBase = (v) => (17 + 29 * Math.sqrt(v / MAX_VOTES)) * 1.3;

  function tailAlpha(rank, kept, fade) {
    const band = Math.min(fade, kept);
    const start = kept - band;
    if (band === 0 || rank < start) return 1;
    const t = (rank - start + 1) / band;
    return lerp(1, FADE_FLOOR, t ** FADE_CURVE);
  }

  function layoutAll(name) {
    preset = PRESETS[name];
    F = { w: preset.w, h: preset.h };
    const rand = mulberry32(SEED);
    const WL = createLayoutEngine({ rand, measureCtx: ctx });

    const buildWords = (
      entries,
      baseFn,
      scale,
      weight,
      maxLineEm,
      padW,
      padH,
      extra,
    ) =>
      entries.map((c, i) => {
        const fontSize = baseFn(c) * scale;
        const lines = WL.wrapTwoLines(
          c.label,
          fontSize,
          weight,
          fontSize * maxLineEm,
        );
        const w =
          Math.max(...lines.map((l) => WL.textWidth(l, fontSize, weight))) +
          padW;
        const h = lines.length * fontSize * 1.22 + padH;
        return Object.assign(
          { i, label: c.label, subtheme: c.subtheme, fontSize, lines, w, h },
          extra ? extra(c, i) : {},
        );
      });
    // Largest uniform font multiplier (stepping down 4%) at which every label
    // places. Two attempts per step: the spiral direction is random, so one
    // dropped label is often luck rather than a real limit.
    const fitScale = (
      entries,
      baseFn,
      weight,
      maxLineEm,
      padW,
      padH,
      layoutFn,
      start,
      extra,
    ) => {
      let scale = start;
      for (let k = 0; k < 16; k++, scale *= 0.96) {
        for (let attempt = 0; attempt < 2; attempt++) {
          const words = buildWords(
            entries,
            baseFn,
            scale,
            weight,
            maxLineEm,
            padW,
            padH,
            extra,
          );
          const placed = layoutFn(words);
          if (placed.length === words.length) return { scale, words, placed };
        }
      }
      // Give up gracefully: lay out what fits at the smallest scale tried.
      const words = buildWords(
        entries,
        baseFn,
        scale,
        weight,
        maxLineEm,
        padW,
        padH,
        extra,
      );
      return { scale, words, placed: layoutFn(words) };
    };

    // Poll cloud: top `keep` ideas, tail faded by rank.
    const kept = data.poll.slice(0, preset.keep);
    const est = Math.sqrt((F.w * F.h) / (2307 * 1124 * (kept.length / 337)));
    const c = fitScale(
      kept,
      (e) => pollBase(e.count),
      400,
      9.5,
      6,
      4,
      (ws) =>
        WL.layoutWithD3Cloud(ws, {
          width: F.w,
          height: F.h,
          padding: 2,
          weight: 400,
        }),
      est * 1.08,
      (e, i) => ({
        count: e.count,
        arrivalRand: rand(),
        tail: tailAlpha(i, kept.length, preset.fade),
      }),
    );
    poll = c.placed;

    // Discussion ideas: kept layout if it matches, else best-of-N.
    const fOpts = { width: F.w, height: F.h, padding: 2, weight: 700 };
    const ideaExtra = (e) => ({ votes: e.votes });
    const saved = data.keptLayouts?.[`${F.w}x${F.h}`];
    let f = null;
    if (saved) {
      const words = buildWords(
        data.discussion,
        (e) => ideaBase(e.votes),
        saved.fontMultiplier,
        700,
        11,
        8,
        6,
        ideaExtra,
      );
      if (WL.applySavedFinale(saved, words, F.w, F.h))
        f = { scale: saved.fontMultiplier, words, placed: words };
    }
    if (!f) {
      f = fitScale(
        data.discussion,
        (e) => ideaBase(e.votes),
        700,
        11,
        8,
        6,
        (ws) => WL.layoutWithD3Cloud(ws, fOpts),
        Math.min(1, Math.sqrt((F.w * F.h) / (2340 * 1140)) * 1.1),
        ideaExtra,
      );
      for (let k = 0; k < 6; k++) {
        const words = buildWords(
          data.discussion,
          (e) => ideaBase(e.votes),
          f.scale,
          700,
          11,
          8,
          6,
          ideaExtra,
        );
        const placed = WL.layoutFinaleBalanced(words, fOpts);
        if (placed.length === words.length) {
          f = { scale: f.scale, words, placed };
          break;
        }
        f.scale *= 0.96;
      }
    }
    ideas = f.placed;

    pollTarget = poll.map((w) => [w.x + F.w / 2, w.y + F.h / 2]);
    ideaPos = ideas.map((w) => [w.x + F.w / 2, w.y + F.h / 2]);
    // Arrival scatter: heavier ideas start nearer the middle.
    pollHome = poll.map((w) => {
      const spread =
        (40 + 300 * (1 - Math.sqrt(w.count / MAX_COUNT))) * (F.w / 2400);
      const a = rand() * Math.PI * 2;
      const r = rand() * spread;
      return [F.w / 2 + Math.cos(a) * r, F.h / 2 + Math.sin(a) * r * 0.68];
    });
    // Dissolve targets: subtheme masses on a loose golden-angle ring.
    const GA = 2.399963229728653;
    anchors = SUBTHEMES.map((s, i) => [
      F.w / 2 + Math.cos(i * GA) * (F.w / 2) * 0.62,
      F.h / 2 + Math.sin(i * GA) * (F.h / 2) * 0.62,
    ]);
    ideaDelay = ideas.map((w, i) => (i / ideas.length) * 0.6 + rand() * 0.25);
    drawWord = (lines, x, y, fontSize, weight, color, alpha, scale) =>
      WL.drawWord(ctx, lines, x, y, fontSize, weight, color, alpha, scale);
  }
  let drawWord = null;

  // ---- canvas sizing ------------------------------------------------------
  function presetFor(cssW) {
    return cssW < NARROW_BELOW ? "narrow" : "wide";
  }
  function resize() {
    const cssW = root.clientWidth || PRESETS.wide.w;
    const name = presetFor(cssW);
    if (!F || PRESETS[name] !== preset) layoutAll(name);
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
  /** mix: 0 = poll cloud, 1 = discussion ideas; arrive: 0..1 poll fly-in. */
  function drawState(mix, arrive) {
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(fit.scale * fit.dpr, 0, 0, fit.scale * fit.dpr, 0, 0);
    const dEase = ease(clamp01(mix / 0.85));
    const cloudAlpha = 1 - clamp01(mix / 0.85) ** 2.4;
    if (cloudAlpha > 0.01) {
      poll.forEach((w, i) => {
        const a = ease(clamp01((arrive - w.arrivalRand * 0.45 - 0.02) / 0.5));
        if (a <= 0.01) return;
        const home = pollHome[i];
        const tgt = pollTarget[i];
        const anc = anchors[w.subtheme];
        const x0 = lerp(home[0], tgt[0], a);
        const y0 = lerp(home[1], tgt[1], a);
        const x = lerp(x0, anc[0], dEase);
        const y = lerp(y0, anc[1], dEase);
        const fadeIn = mix > 0 ? 0.85 + 0.15 * (1 - mix) : 1;
        drawWord(
          w.lines,
          x,
          y,
          w.fontSize,
          400,
          SUBTHEMES[w.subtheme].color,
          w.tail * a * cloudAlpha * fadeIn,
          lerp(1, 0.12, dEase),
        );
      });
    }
    const f = clamp01((mix - 0.55) / 0.45);
    if (f > 0) {
      ideas.forEach((w, i) => {
        const a = ease(clamp01((f - ideaDelay[i] * 0.5) / 0.5));
        if (a <= 0.01) return;
        drawWord(
          w.lines,
          ideaPos[i][0],
          ideaPos[i][1],
          w.fontSize,
          700,
          SUBTHEMES[w.subtheme].color,
          a,
          lerp(0.55, 1, a),
        );
      });
    }
    ctx.restore();
  }

  // ---- timeline -----------------------------------------------------------
  let clock = 0;
  let playing = !reduced;
  let last = performance.now();
  let manual = null; // { from, to, t0, dur } while an arrow jump tweens
  let mix = 0;
  let arrive = reduced ? 1 : 0;
  let visible = true;
  function stateAt(c) {
    if (c < T.arrive) return { mix: 0, arrive: c / T.arrive };
    let u = (c - T.arrive) % LOOP;
    if (u < T.hold1) return { mix: 0, arrive: 1 };
    u -= T.hold1;
    if (u < T.toP2) return { mix: u / T.toP2, arrive: 1 };
    u -= T.toP2;
    if (u < T.hold2) return { mix: 1, arrive: 1 };
    u -= T.hold2;
    if (u < T.toP1) return { mix: 1 - u / T.toP1, arrive: 1 };
    return { mix: 0, arrive: 1 };
  }
  function render() {
    if (F) drawState(mix, arrive);
  }
  function tick(now) {
    // rAF timestamps mark the frame's start, which can precede `last` after
    // the layout blocked the thread; never let the clock run backwards.
    const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
    last = now;
    if (visible) {
      if (manual) {
        const k = ease(clamp01((now - manual.t0) / manual.dur));
        mix = lerp(manual.from, manual.to, k);
        arrive = 1;
        if (k >= 1) manual = null;
        render();
      } else if (playing) {
        clock += dt;
        const s = stateAt(clock);
        mix = s.mix;
        arrive = s.arrive;
        render();
      }
      syncControls();
    }
    requestAnimationFrame(tick);
  }

  // ---- controls -----------------------------------------------------------
  let phase = 1; // where we are, or are heading
  let lastShown = null;
  function jumpTo(target) {
    phase = target;
    playing = false;
    manual = {
      from: mix,
      to: target - 1,
      t0: performance.now(),
      dur: reduced ? 300 : 2200,
    };
    arrive = 1;
    syncControls(true);
  }
  function syncControls(force) {
    // While auto-playing the arrows follow the phase on screen; once manual
    // they follow the phase we are heading to, so a click hides its arrow.
    const shown = playing ? (mix < 0.5 ? 1 : 2) : phase;
    if (!force && shown === lastShown) return;
    lastShown = shown;
    if (playing) phase = shown;
    if (prevBtn) prevBtn.hidden = shown <= 1;
    if (nextBtn) nextBtn.hidden = shown >= 2;
    if (counterEl)
      counterEl.textContent = counterTemplate
        .replace("{current}", String(shown))
        .replace("{total}", "2");
    if (phaseAlt[shown - 1])
      canvas.setAttribute("aria-label", phaseAlt[shown - 1]);
    root.dataset.phase = String(shown);
  }
  if (prevBtn) prevBtn.addEventListener("click", () => jumpTo(1));
  if (nextBtn) nextBtn.addEventListener("click", () => jumpTo(2));

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
  syncControls(true);
  last = performance.now();
  requestAnimationFrame(tick);
}
