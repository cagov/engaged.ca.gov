/**
 * Who participated: animated participant funnel.
 *
 * Canvas draw loop plus control wiring, adapted from the design team's
 * standalone sketch (participant-funnel/funnel.js). funnel-layout.js decides
 * every position and color; this file only draws and animates.
 *
 * What lives where:
 *   - Stage copy (phase, title, subtitle, stat) is HTML from the .mmmd,
 *     one `.participants-step` block per stage. This module crossfades
 *     between them in step with the dots.
 *   - Category legend is HTML, rebuilt from the data whenever the
 *     Region / Field of work toggle changes. Labels can be overridden per
 *     English category name via `data-labels` on the root (for translation).
 *   - Participant / Facilitator key is HTML, shown only on the last stage.
 *   - Controls: the section's left/right margin arrows (auto-advance stops
 *     once the reader steps manually). Optional Pause/Restart and stage
 *     pills are supported if present in the markup. Arrow keys step.
 *   - `prefers-reduced-motion` snaps between stages instead of animating.
 *
 * Root element contract (see mmmd-ai-impact-report.njk):
 *   #participants-stepper[data-funnel-src]    JSON data URL
 *   .participants-step[data-step]             stage copy blocks, 1-based
 *   canvas[data-funnel-canvas]
 *   [data-stepper-prev] / [data-stepper-next] margin arrows (in the section)
 *   [data-funnel-play] / [data-funnel-restart]
 *   [data-funnel-stage="N"]                    stage pills, 1-based
 *   .segmented-toggle-option[data-variant]    "region" | "field"
 *   [data-funnel-legend]                      category legend <ul>
 *   [data-last-step-only]                     shown on the final stage only
 *   [data-funnel-center-title] / [data-funnel-center-hint] ring center copy
 */
import * as FL from "./funnel-layout.js";

export async function initParticipantFunnel(root) {
  if (!root) return;
  const canvas = root.querySelector("canvas[data-funnel-canvas]");
  if (!canvas || !canvas.getContext) return;

  let data;
  try {
    const res = await fetch(root.dataset.funnelSrc);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    data = await res.json();
  } catch (err) {
    console.error("participant funnel: could not load data", err);
    return;
  }

  // ---- DOM ---------------------------------------------------------------
  const section = root.closest("section") || document;
  const steps = [...root.querySelectorAll(".participants-step")];
  const stageCount = Math.min(steps.length, FL.STAGE_COUNT);
  const LAST_STAGE = stageCount - 1;
  const prevBtn = section.querySelector("[data-stepper-prev]");
  const nextBtn = section.querySelector("[data-stepper-next]");
  const playBtn = section.querySelector("[data-funnel-play]");
  const restartBtn = section.querySelector("[data-funnel-restart]");
  const pills = [...section.querySelectorAll("[data-funnel-stage]")];
  const toggleButtons = [
    ...section.querySelectorAll(".segmented-toggle-option[data-variant]"),
  ];
  const legendEl = section.querySelector("[data-funnel-legend]");
  const lastStepOnly = [...section.querySelectorAll("[data-last-step-only]")];
  const counterEl = section.querySelector("[data-stepper-counter]");
  const counterTemplate = root.dataset.stepCounter || "{current} of {total}";
  const labels = safeJSON(root.dataset.labels) || {};
  const playLabel = root.dataset.playLabel || "Play";
  const pauseLabel = root.dataset.pauseLabel || "Pause";
  const centerTitle = root.dataset.centerTitle || "";
  const centerHint = root.dataset.centerHint || "";
  const centerCopyEl = root.querySelector("[data-funnel-center]");
  // Below this canvas scale the ring's center is too small for readable text;
  // the copy moves to the HTML block under the canvas instead.
  const MIN_CENTER_TEXT_SCALE = 0.62;
  let canvasScale = 1;

  root.classList.add("js-enabled", "funnel-ready");

  // ---- Layout ------------------------------------------------------------
  const layout = FL.buildFunnelCloud(data);

  let dimension = "region";
  const motion = "orbit";
  let categories = [];
  let categoryColors = [];
  let colorOf = {};

  // Dimensions offered by the toggle (the data may carry more, e.g. AI response,
  // which stays available in code but has no button for now).
  const dimensions = FL.availableDimensions(data).filter((key) =>
    toggleButtons.some(
      (b) => FL.DIMENSION_BY_VARIANT[b.dataset.variant] === key,
    ),
  );

  function recolor() {
    categories = data[FL.DATA_KEY_FOR[dimension]] || [];
    categoryColors = FL.assignCategoryColors(categories.map((c) => c.name));
    colorOf = {};
    categories.forEach((c, i) => {
      colorOf[c.name] = categoryColors[i];
    });
    renderLegend();
  }

  // Pin the legend to its tallest variant so toggling never shifts layout.
  function reserveLegend() {
    const keep = dimension;
    FL.reserveLegendHeight(
      legendEl,
      dimensions,
      (d) => {
        dimension = d;
        recolor();
      },
      keep,
    );
    dimension = keep;
  }

  function renderLegend() {
    if (!legendEl) return;
    legendEl.textContent = "";
    categories.forEach((c, i) => {
      const li = document.createElement("li");
      li.className = "chart-legend-item";
      const swatch = document.createElement("span");
      swatch.className = "chart-legend-swatch";
      swatch.setAttribute("aria-hidden", "true");
      swatch.style.background = categoryColors[i];
      li.appendChild(swatch);
      li.appendChild(document.createTextNode(labels[c.name] || c.name));
      legendEl.appendChild(li);
    });
  }

  // Page colors. The section background is read once so the canvas can be
  // left transparent and the facilitator donuts still match it.
  const sectionBg = getComputedStyle(section).backgroundColor;
  const tokens = {
    surface:
      sectionBg && sectionBg !== "rgba(0, 0, 0, 0)" ? sectionBg : "#ffffff",
    onSurface: "#1c2745",
    onSurfaceMuted: "#444444",
    nondata: "#3b3a48",
    dropped: "#d3d3d3",
  };
  const fontFamily = getComputedStyle(canvas).fontFamily || "sans-serif";

  // ---- Viewport ----------------------------------------------------------
  // Header copy and legends are HTML, so the canvas is trimmed to the dot
  // content: exactly as tall as the tallest stage plus a hair for
  // anti-aliasing, with every stage centred in it. Draw coordinates stay in
  // the original canvas space; resize() shifts the visible window instead.
  const bands = FL.stageBands(layout);
  const VIEW_PAD = 2;
  const tallestBand = Math.max(...bands.map((b) => b.bottom - b.top));
  const VIEW_H = Math.ceil(tallestBand + 2 * VIEW_PAD);
  const VIEW_TOP = Math.round(FL.CY - VIEW_H / 2);
  const VIEW_BOTTOM = VIEW_TOP + VIEW_H;
  const yShift = FL.stageYShift(
    bands,
    VIEW_TOP + VIEW_PAD,
    VIEW_BOTTOM - VIEW_PAD,
  );

  const DWELL_MS = 1900;
  const TRANSITION_MS = 2600;
  const ORBIT_SPEED = 0.2;
  const DRIFT_SPEED = 0.3;
  const TITLE_EASE_MS = 900;
  const COLOR_TAU_MS = 180; // time constant for color easing (toggle recolor)

  let ctx = null;
  let renders = [];
  let clock = 0;
  let stage = 0;
  let prevStage = 0;
  let t = 1;
  let playing = true;
  let ringReady = false;
  let dwellLeft = DWELL_MS;
  let lastTime = 0;
  let titleK = 0;
  let headerStageIndex = -1;
  let visible = true;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const PERSON = new Path2D(FL.PERSON_PATH);

  // ---- Color helpers -----------------------------------------------------
  const rgbCache = {};
  function toRGB(color) {
    if (color.charAt(0) === "#") {
      return [
        Number.parseInt(color.slice(1, 3), 16),
        Number.parseInt(color.slice(3, 5), 16),
        Number.parseInt(color.slice(5, 7), 16),
      ];
    }
    const m = color.match(/[\d.]+/g);
    return m ? [Number(m[0]), Number(m[1]), Number(m[2])] : [0, 0, 0];
  }
  function rgb(color) {
    let v = rgbCache[color];
    if (!v) {
      v = toRGB(color);
      rgbCache[color] = v;
    }
    return v;
  }
  const lerp = (a, b, k) => a + (b - a) * k;
  const mixColor = (a, b, k) => [
    lerp(a[0], b[0], k),
    lerp(a[1], b[1], k),
    lerp(a[2], b[2], k),
  ];
  const css = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

  function colorFor(categoryKey) {
    if (categoryKey === "__dropped") return rgb(tokens.dropped);
    return rgb(colorOf[categoryKey] || FL.DATA_VIZ_NEUTRAL_LIGHT);
  }

  // ---- Drawing -----------------------------------------------------------
  function stampPerson(cx, cy, height) {
    const s = height / FL.PERSON_BOX.h;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.translate(-FL.PERSON_BOX.cx, -FL.PERSON_BOX.cy);
    ctx.fill(PERSON);
    ctx.restore();
  }

  function targetFor(dot, s) {
    const g = FL.dotTarget(
      dot,
      s,
      dimension,
      layout.clusters,
      clock,
      DRIFT_SPEED,
      ORBIT_SPEED,
      motion,
    );
    const dy = yShift[s] || 0;
    if (!dy) return g;
    const shifted = { ...g, y: g.y + dy };
    if (g.viaY !== undefined) shifted.viaY = g.viaY + dy;
    return shifted;
  }

  function resetRenders() {
    renders = layout.dots.map((dot) => {
      const g = targetFor(dot, stage);
      const c = colorFor(g.categoryKey);
      const p = g.person ? 1 : 0;
      return {
        pos: [g.x, g.y],
        from: [g.x, g.y],
        alpha: g.alpha,
        aFrom: g.alpha,
        r: g.r,
        rFrom: g.r,
        cNow: c,
        cTarget: c,
        delay: 0,
        person: p,
        pFrom: p,
      };
    });
  }

  function place(render, g, lt) {
    if (g.viaX !== undefined && g.viaY !== undefined) {
      const u = 1 - lt;
      render.pos[0] =
        u * u * render.from[0] + 2 * u * lt * g.viaX + lt * lt * g.x;
      render.pos[1] =
        u * u * render.from[1] + 2 * u * lt * g.viaY + lt * lt * g.y;
    } else {
      render.pos[0] = lerp(render.from[0], g.x, lt);
      render.pos[1] = lerp(render.from[1], g.y, lt);
    }
  }

  function snapValues() {
    layout.dots.forEach((dot, i) => {
      const g = targetFor(dot, stage);
      const r = renders[i];
      r.pos = [g.x, g.y];
      r.alpha = g.alpha;
      r.r = g.r;
      r.cNow = colorFor(g.categoryKey);
      r.cTarget = r.cNow;
      r.person = g.person ? 1 : 0;
    });
  }

  function facilitators() {
    const vis =
      stage === LAST_STAGE ? FL.easeInOut(Math.max(0, (t - 0.45) / 0.55)) : 0;
    if (vis <= 0.01) return;
    const ringShift = yShift[LAST_STAGE] || 0;
    for (const cl of layout.clusters) {
      const cy = cl.y + ringShift;
      ctx.globalAlpha = vis;
      ctx.beginPath();
      ctx.arc(cl.x, cy, 11, 0, Math.PI * 2);
      ctx.fillStyle = tokens.surface;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cl.x, cy, 7.5, 0, Math.PI * 2);
      ctx.fillStyle = tokens.nondata;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cl.x, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = tokens.surface;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function centerLabel() {
    if (canvasScale < MIN_CENTER_TEXT_SCALE) return;
    if (titleK <= 0.01 || (!centerTitle && !centerHint)) return;
    const maxClusterRc = Math.max(0, ...layout.clusters.map((c) => c.rc));
    const freeRadius = Math.max(60, layout.ringRadius - maxClusterRc - 10);
    const maxWidth = freeRadius * 1.7;
    const lineHeight = 22;
    const gap = 6;

    const countLines = FL.wrapLabel(centerTitle, maxWidth, 8.9).slice(0, 2);
    const promptLines = FL.wrapLabel(centerHint, maxWidth, 7.8).slice(0, 2);
    const totalHeight =
      countLines.length * lineHeight + gap + promptLines.length * lineHeight;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const ringCenterY = FL.CY + (yShift[LAST_STAGE] || 0);
    let y = ringCenterY - totalHeight / 2 + lineHeight / 2;

    ctx.globalAlpha = titleK;
    ctx.font = `700 16px ${fontFamily}`;
    ctx.fillStyle = tokens.onSurface;
    for (const line of countLines) {
      ctx.fillText(line, FL.CX, y);
      y += lineHeight;
    }
    y += gap;
    ctx.font = `400 14px ${fontFamily}`;
    ctx.fillStyle = tokens.onSurfaceMuted;
    for (const line of promptLines) {
      ctx.fillText(line, FL.CX, y);
      y += lineHeight;
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, VIEW_TOP, FL.CANVAS.W, VIEW_H);

    for (let i = 0; i < layout.dots.length; i++) {
      const r = renders[i];
      if (!r || r.alpha <= 0.008) continue;
      ctx.fillStyle = css(r.cNow);
      const p = r.person;
      if (p < 0.999) {
        ctx.globalAlpha = r.alpha * (1 - p);
        ctx.beginPath();
        ctx.arc(r.pos[0], r.pos[1], r.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (p > 0.001) {
        ctx.globalAlpha = r.alpha * p;
        stampPerson(
          r.pos[0],
          r.pos[1],
          lerp(2 * r.r, FL.personHeightFor(r.r), p),
        );
      }
    }
    ctx.globalAlpha = 1;

    facilitators();
    centerLabel();
  }

  // ---- Stage machine -----------------------------------------------------
  function dwellFor(s) {
    return s === LAST_STAGE ? Number.POSITIVE_INFINITY : DWELL_MS;
  }

  function goTo(nextStage) {
    if (nextStage === stage && t >= 1) return;
    prevStage = stage;
    stage = nextStage;
    t = reduced ? 1 : 0;
    ringReady = nextStage === LAST_STAGE && reduced;
    layout.dots.forEach((dot, i) => {
      const r = renders[i];
      r.from = [r.pos[0], r.pos[1]];
      r.aFrom = r.alpha;
      r.rFrom = r.r;
      r.pFrom = r.person;
      r.delay = (dot.kept ? 0 : 0.1) + Math.random() * (dot.kept ? 0.22 : 0.3);
    });
    if (reduced) snapValues();
    syncControls();
  }

  function jumpTo(s) {
    const target = Math.min(LAST_STAGE, Math.max(0, s));
    // Once the reader steps manually, stop auto-advancing.
    playing = false;
    goTo(target);
    dwellLeft = dwellFor(stage);
  }

  function restart() {
    clock = 0;
    stage = 0;
    prevStage = 0;
    t = 1;
    ringReady = false;
    resetRenders();
    dwellLeft = DWELL_MS;
    playing = true;
    syncControls();
  }

  function togglePlay() {
    playing = !playing;
    if (playing && t >= 1 && stage === LAST_STAGE) restart();
    syncControls();
  }

  // ---- Header crossfade --------------------------------------------------
  function updateHeader() {
    const cross = FL.headerCrossfade(t);
    const nextIndex = cross.useTo ? stage : prevStage;
    for (const step of steps) step.style.opacity = "";
    const active = steps[nextIndex];
    if (active) active.style.opacity = String(cross.opacity);
    if (nextIndex === headerStageIndex) return;
    headerStageIndex = nextIndex;
    steps.forEach((step, i) => {
      const on = i === headerStageIndex;
      step.hidden = !on;
      step.setAttribute("aria-hidden", String(!on));
    });
  }

  // HTML center copy shows on the last stage only when the canvas is too
  // small to draw it legibly.
  function syncCenterCopy() {
    if (!centerCopyEl) return;
    centerCopyEl.hidden = !(
      canvasScale < MIN_CENTER_TEXT_SCALE && stage === LAST_STAGE
    );
  }

  function syncControls() {
    syncCenterCopy();
    if (prevBtn) prevBtn.hidden = stage <= 0;
    if (nextBtn) nextBtn.hidden = stage >= LAST_STAGE;
    if (playBtn) {
      playBtn.textContent = playing ? pauseLabel : playLabel;
      playBtn.setAttribute("aria-pressed", String(!playing));
    }
    for (const pill of pills) {
      pill.setAttribute(
        "aria-pressed",
        String(Number(pill.dataset.funnelStage) - 1 === stage),
      );
    }
    for (const el of lastStepOnly) el.hidden = stage !== LAST_STAGE;
    if (counterEl) {
      counterEl.textContent = counterTemplate
        .replace("{current}", String(stage + 1))
        .replace("{total}", String(stageCount));
    }
    for (const btn of toggleButtons) {
      btn.setAttribute(
        "aria-pressed",
        String(FL.DIMENSION_BY_VARIANT[btn.dataset.variant] === dimension),
      );
    }
    root.dataset.step = String(stage + 1);
    root.dataset.variant =
      Object.keys(FL.DIMENSION_BY_VARIANT).find(
        (v) => FL.DIMENSION_BY_VARIANT[v] === dimension,
      ) || "region";
  }

  // ---- Frame loop --------------------------------------------------------
  function frame(now) {
    const dt = Math.min(now - lastTime, 50);
    lastTime = now;

    updateHeader();

    const titleTarget = stage === LAST_STAGE && ringReady ? 1 : 0;
    titleK += (titleTarget - titleK) * Math.min(1, dt / TITLE_EASE_MS);

    // The clock and any in-flight stage transition always run while the
    // section is on screen. `playing` only gates the automatic advance to
    // the next stage, so a manual step still animates.
    if (visible) {
      clock += dt / 1000;
      if (t < 1) {
        t = Math.min(1, t + dt / TRANSITION_MS);
        const span = 0.7;
        layout.dots.forEach((dot, i) => {
          const g = targetFor(dot, stage);
          const r = renders[i];
          const lt = FL.easeInOut(
            Math.max(0, Math.min(1, (t - r.delay) / span)),
          );
          place(r, g, lt);
          r.alpha = lerp(r.aFrom, g.alpha, lt);
          r.r = lerp(r.rFrom, g.r, lt);
          r.cTarget = colorFor(g.categoryKey);
          r.person = lerp(r.pFrom, g.person ? 1 : 0, lt);
        });
        if (t >= 1) {
          dwellLeft = dwellFor(stage);
          if (stage === LAST_STAGE) ringReady = true;
        }
      } else if (playing) {
        dwellLeft -= dt;
        if (dwellLeft <= 0) {
          if (stage < LAST_STAGE) goTo(stage + 1);
          else {
            playing = false;
            syncControls();
          }
        }
      }
    }

    // Idle re-read so toggling Region / Field of work recolors immediately
    // and the cloud keeps drifting.
    if (t >= 1) {
      layout.dots.forEach((dot, i) => {
        if (stage === LAST_STAGE && !dot.kept) return;
        const g = targetFor(dot, stage);
        renders[i].pos[0] = g.x;
        renders[i].pos[1] = g.y;
        renders[i].cTarget = colorFor(g.categoryKey);
      });
    }

    // Ease every dot's color toward its target. This is what makes the
    // Region / Field of work toggle read as a recolor rather than a snap,
    // and it also smooths the grey-out of dropped dots during transitions.
    if (visible) {
      const k = reduced ? 1 : 1 - Math.exp(-dt / COLOR_TAU_MS);
      for (const r of renders) {
        if (r.cNow !== r.cTarget) {
          r.cNow = mixColor(r.cNow, r.cTarget, k);
          if (
            Math.abs(r.cNow[0] - r.cTarget[0]) +
              Math.abs(r.cNow[1] - r.cTarget[1]) +
              Math.abs(r.cNow[2] - r.cTarget[2]) <
            1.5
          ) {
            r.cNow = r.cTarget;
          }
        }
      }
    }

    draw();
    requestAnimationFrame(frame);
  }

  function resize() {
    const cssWidth = canvas.clientWidth || FL.CANVAS.W;
    const scale = cssWidth / FL.CANVAS.W;
    canvasScale = scale;
    syncCenterCopy();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = FL.CANVAS.W * scale * dpr;
    canvas.height = VIEW_H * scale * dpr;
    canvas.style.height = `${VIEW_H * scale}px`;
    ctx = canvas.getContext("2d");
    if (ctx)
      ctx.setTransform(
        scale * dpr,
        0,
        0,
        scale * dpr,
        0,
        -VIEW_TOP * scale * dpr,
      );
  }

  // ---- Wiring ------------------------------------------------------------
  prevBtn?.addEventListener("click", () => jumpTo(stage - 1));
  nextBtn?.addEventListener("click", () => jumpTo(stage + 1));
  playBtn?.addEventListener("click", togglePlay);
  restartBtn?.addEventListener("click", restart);
  for (const pill of pills) {
    pill.addEventListener("click", () =>
      jumpTo(Number(pill.dataset.funnelStage) - 1),
    );
  }
  for (const btn of toggleButtons) {
    btn.disabled = false;
    btn.addEventListener("click", () => {
      dimension = FL.DIMENSION_BY_VARIANT[btn.dataset.variant] || "region";
      recolor();
      syncControls();
    });
  }
  root.addEventListener("keydown", (event) => {
    if (event.target.closest("button")) return;
    if (event.key === " ") {
      event.preventDefault();
      togglePlay();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      jumpTo(stage + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      jumpTo(stage - 1);
    }
  });

  // Pause the clock while the section is off screen.
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      (entries) => {
        visible = entries.some((e) => e.isIntersecting);
      },
      { threshold: 0 },
    ).observe(root);
  }

  window.addEventListener("resize", () => {
    resize();
    reserveLegend();
  });

  // ---- Boot --------------------------------------------------------------
  recolor();
  reserveLegend();
  resize();
  restart();
  lastTime = performance.now();
  requestAnimationFrame(frame);
}

function safeJSON(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
