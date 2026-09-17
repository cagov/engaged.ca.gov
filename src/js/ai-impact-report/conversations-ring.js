/**
 * The power of discussion: ring of 14 conversation clusters with a quote panel.
 *
 * Reuses the participant funnel's layout (same JSON, same clusters, same
 * per-attendee region / field of work) so the ring here matches the last
 * stage of the funnel above it. Each cluster is a facilitator hub with the
 * attendees orbiting slowly. Clusters that have quotes enlarge on hover and
 * select on click; the selected conversation's quotes show in the HTML panel.
 *
 * Desktop: canvas ring on the left, one quote card visible on the right.
 * Mobile (below the desktop breakpoint): the canvas is hidden and every
 * conversation with quotes is shown as a stacked card with its own small
 * static cluster drawing.
 *
 * Root contract (see mmmd-ai-impact-report.njk):
 *   #conversations-chart[data-funnel-src]         JSON data URL
 *   canvas[data-ring-canvas]
 *   .conversation-card[data-session="N"]          quote cards, 1-based session
 *     [data-conversation-title] / [data-conversation-meta]
 *     .conversation-attribution[data-region][data-field] > .conversation-attribution-dot
 *     [data-conversation-thumb]                   mobile cluster drawing goes here
 *   button[data-select-session="N"]               keyboard selection
 *   .segmented-toggle-option[data-variant]        "region" | "field"
 *   [data-ring-legend]                            category legend <ul>
 *   data-* on root: center-title, center-hint, title-template, meta-template,
 *     labels (JSON map of English category -> display label)
 */
import * as FL from "./funnel-layout.js";

const DESKTOP = "(min-width: 992px)";
const COLORS = {
  ink: "#1c2745",
  muted: "#444444",
  hub: "#3b3a48",
  badge: "#1c2745",
  badgeText: "#ffffff",
  outline: "#1c2745",
};

function fill(template, values) {
  return (template || "").replace(/\{(\w+)\}/g, (_, k) =>
    k in values ? String(values[k]) : `{${k}}`,
  );
}

function formatDate(iso, lang) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  try {
    return date.toLocaleDateString(lang || "en-US", {
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return iso;
  }
}

export async function initConversationsRing(root) {
  if (!root) return;
  const canvas = root.querySelector("canvas[data-ring-canvas]");
  if (!canvas || !canvas.getContext) return;

  let data;
  try {
    const res = await fetch(root.dataset.funnelSrc);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    data = await res.json();
  } catch (err) {
    console.error("conversations ring: could not load data", err);
    return;
  }

  // ---- DOM ---------------------------------------------------------------
  const lang = document.documentElement.lang || "en-US";
  const cards = [...root.querySelectorAll(".conversation-card")];
  const cardBySession = new Map(
    cards.map((c) => [Number(c.dataset.session), c]),
  );
  const selectButtons = [
    ...root.querySelectorAll("button[data-select-session]"),
  ];
  const toggleButtons = [
    ...root.querySelectorAll(".segmented-toggle-option[data-variant]"),
  ];
  const legendEl = root.querySelector("[data-ring-legend]");
  const labels = safeJSON(root.dataset.labels) || {};
  const centerTitle = root.dataset.centerTitle || "";
  const centerHint = root.dataset.centerHint || "";
  const titleTemplate = root.dataset.titleTemplate || "Conversation {n}";
  const metaTemplate = root.dataset.metaTemplate || "{count} people · {date}";
  const fontFamily = getComputedStyle(canvas).fontFamily || "sans-serif";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const desktop = matchMedia(DESKTOP);

  root.classList.add("js-enabled", "ring-ready");

  // ---- Layout (shared with the funnel) -----------------------------------
  const layout = FL.buildFunnelCloud(data);
  const clusters = layout.clusters.map((cl, i) => ({
    ...cl,
    session: i + 1,
    hasQuotes: cardBySession.has(i + 1),
    scale: 1,
    dots: [],
  }));
  for (const dot of layout.dots) {
    if (dot.kept && dot.group >= 0) clusters[dot.group].dots.push(dot);
  }
  const maxRc = Math.max(...clusters.map((c) => c.rc));
  const ringExtent = layout.ringRadius + maxRc + 22; // room for the number badge

  let dimension = "region";
  let colorOf = {};
  let categories = [];
  let categoryColors = [];

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
    recolorAttributions();
    drawThumbs();
  }

  function colorFor(name) {
    return colorOf[name] || FL.DATA_VIZ_NEUTRAL_LIGHT;
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

  // Per-dot eased colors so the Region / Field of work toggle recolors
  // smoothly instead of snapping.
  const COLOR_TAU_MS = 180;
  const dotColor = new Map(); // dot -> [r, g, b]
  function hexToRgb(hex) {
    return [
      Number.parseInt(hex.slice(1, 3), 16),
      Number.parseInt(hex.slice(3, 5), 16),
      Number.parseInt(hex.slice(5, 7), 16),
    ];
  }
  function easedColor(dot, dt) {
    const target = hexToRgb(colorFor(dot[dimension]));
    let cur = dotColor.get(dot);
    if (!cur || reduced) {
      cur = target;
    } else {
      const k = 1 - Math.exp(-dt / COLOR_TAU_MS);
      cur = [
        cur[0] + (target[0] - cur[0]) * k,
        cur[1] + (target[1] - cur[1]) * k,
        cur[2] + (target[2] - cur[2]) * k,
      ];
    }
    dotColor.set(dot, cur);
    return `rgb(${cur[0] | 0},${cur[1] | 0},${cur[2] | 0})`;
  }

  function renderLegend() {
    if (!legendEl) return;
    legendEl.textContent = "";
    categories.forEach((c, i) => {
      const li = document.createElement("li");
      li.className = "chart-legend-item";
      const sw = document.createElement("span");
      sw.className = "chart-legend-swatch";
      sw.setAttribute("aria-hidden", "true");
      sw.style.background = categoryColors[i];
      li.appendChild(sw);
      li.appendChild(document.createTextNode(labels[c.name] || c.name));
      legendEl.appendChild(li);
    });
  }

  function recolorAttributions() {
    for (const att of root.querySelectorAll(".conversation-attribution")) {
      // Quotes carry region and field keys only; other dimensions fall back to neutral.
      const datasetKey = { region: "region", fieldOfWork: "field" }[dimension];
      const key = datasetKey ? att.dataset[datasetKey] : undefined;
      const dot = att.querySelector(".conversation-attribution-dot");
      if (dot) dot.style.background = colorFor(key);
    }
  }

  // ---- Cards -------------------------------------------------------------
  for (const [session, card] of cardBySession) {
    const cl = clusters[session - 1];
    if (!cl) continue;
    const title = card.querySelector("[data-conversation-title]");
    const meta = card.querySelector("[data-conversation-meta]");
    if (title) title.textContent = fill(titleTemplate, { n: session });
    if (meta) {
      meta.textContent = fill(metaTemplate, {
        count: cl.n,
        date: formatDate(cl.date, lang),
      });
    }
  }

  const sessionsWithQuotes = clusters
    .filter((c) => c.hasQuotes)
    .map((c) => c.session);
  let selected = sessionsWithQuotes[0] || 0;
  let hovered = 0;

  function select(session) {
    if (!cardBySession.has(session)) return;
    selected = session;
    for (const [s, card] of cardBySession) {
      const on = s === session;
      card.classList.toggle("is-selected", on);
      card.hidden = desktop.matches ? !on : false;
    }
    for (const btn of selectButtons) {
      btn.setAttribute(
        "aria-pressed",
        String(Number(btn.dataset.selectSession) === session),
      );
    }
    root.dataset.selected = String(session);
  }

  function applyLayoutMode() {
    // Desktop: only the selected card shows (in the panel) and its quote list
    // scrolls, so it must be keyboard focusable. Mobile: all cards stack.
    for (const [s, card] of cardBySession) {
      card.hidden = desktop.matches ? s !== selected : false;
      const quotes = card.querySelector(".conversation-quotes-scroll");
      if (quotes) {
        if (desktop.matches) quotes.setAttribute("tabindex", "0");
        else quotes.removeAttribute("tabindex");
      }
    }
  }
  desktop.addEventListener("change", () => {
    applyLayoutMode();
    resize();
  });

  // ---- Mobile thumbnails (static SVG per card) ---------------------------
  function drawThumbs() {
    for (const [session, card] of cardBySession) {
      const host = card.querySelector("[data-conversation-thumb]");
      const cl = clusters[session - 1];
      if (!host || !cl) continue;
      // Already drawn: just update fills so the CSS transition can run.
      const existing = host.querySelectorAll("circle[data-dot]");
      if (existing.length === cl.dots.length) {
        existing.forEach((circle, i) => {
          circle.setAttribute("fill", colorFor(cl.dots[i][dimension]));
        });
        continue;
      }
      // One scale for every thumbnail (fit to the largest cluster) so dots
      // stay the same size and a bigger conversation reads as a wider ring.
      const size = 96;
      const k = (size / 2 - 6) / maxRc;
      const ns = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(ns, "svg");
      svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
      svg.setAttribute("width", String(size));
      svg.setAttribute("height", String(size));
      svg.setAttribute("aria-hidden", "true");
      const c = size / 2;
      for (const dot of cl.dots) {
        const [x, y] = FL.orbitPosition(dot, cl, 0, 0, "orbit");
        const circle = document.createElementNS(ns, "circle");
        circle.setAttribute("cx", String(c + (x - cl.x) * k));
        circle.setAttribute("cy", String(c + (y - cl.y) * k));
        circle.setAttribute("r", "5");
        circle.setAttribute("fill", colorFor(dot[dimension]));
        circle.setAttribute("data-dot", "");
        svg.appendChild(circle);
      }
      for (const [r, f] of [
        [7.5, COLORS.hub],
        [3, "#ffffff"],
      ]) {
        const hub = document.createElementNS(ns, "circle");
        hub.setAttribute("cx", String(c));
        hub.setAttribute("cy", String(c));
        hub.setAttribute("r", String(r));
        hub.setAttribute("fill", f);
        svg.appendChild(hub);
      }
      host.replaceChildren(svg);
    }
  }

  // ---- Canvas ------------------------------------------------------------
  let ctx = null;
  let size = 0;
  let dpr = 1;
  let k = 1; // layout units -> canvas px
  let clock = 0;
  let lastTime = 0;
  let visible = true;
  const ORBIT_SPEED = 0.12;

  function toCanvas(x, y) {
    return [size / 2 + (x - FL.CX) * k, size / 2 + (y - FL.CY) * k];
  }

  function resize() {
    size = Math.max(280, canvas.clientWidth || 600);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.height = `${size}px`;
    ctx = canvas.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    k = (size / 2 - 8) / ringExtent;
  }

  function clusterCenter(cl) {
    return toCanvas(cl.x, cl.y);
  }

  let frameDt = 16;

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);
    const dotR = Math.max(3, 6 * k);

    for (const cl of clusters) {
      const [cx, cy] = clusterCenter(cl);
      const s = cl.scale;

      if (cl.session === selected) {
        ctx.beginPath();
        ctx.arc(cx, cy, (cl.rc + 6) * k * s, 0, Math.PI * 2);
        ctx.strokeStyle = COLORS.outline;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      for (const dot of cl.dots) {
        const [x, y] = FL.orbitPosition(dot, cl, clock, ORBIT_SPEED, "orbit");
        const px = cx + (x - cl.x) * k * s;
        const py = cy + (y - cl.y) * k * s;
        ctx.beginPath();
        ctx.arc(px, py, dotR * s, 0, Math.PI * 2);
        ctx.fillStyle = easedColor(dot, frameDt);
        ctx.globalAlpha = cl.hasQuotes || !sessionsWithQuotes.length ? 1 : 0.85;
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Facilitator hub.
      ctx.beginPath();
      ctx.arc(cx, cy, 7.5 * s, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.hub;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, 3 * s, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();

      // Number badge at the cluster's top edge.
      const bx = cx + (cl.rc + 4) * k * s * 0.72;
      const by = cy - (cl.rc + 4) * k * s * 0.72;
      ctx.beginPath();
      ctx.arc(bx, by, 9, 0, Math.PI * 2);
      ctx.fillStyle = cl.hasQuotes ? COLORS.badge : "#ffffff";
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = COLORS.badge;
      ctx.stroke();
      ctx.fillStyle = cl.hasQuotes ? COLORS.badgeText : COLORS.badge;
      ctx.font = `700 10px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(cl.session), bx, by + 0.5);
    }

    // Center copy.
    if (centerTitle || centerHint) {
      const maxWidth = (layout.ringRadius - maxRc - 10) * k * 1.8;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const titleLines = FL.wrapLabel(centerTitle, maxWidth, 8.4).slice(0, 2);
      const hintLines = FL.wrapLabel(centerHint, maxWidth, 7).slice(0, 3);
      const lh = 20;
      const total = titleLines.length * lh + 6 + hintLines.length * (lh - 2);
      let y = size / 2 - total / 2 + lh / 2;
      ctx.fillStyle = COLORS.ink;
      ctx.font = `700 15px ${fontFamily}`;
      for (const line of titleLines) {
        ctx.fillText(line, size / 2, y);
        y += lh;
      }
      y += 6;
      ctx.fillStyle = COLORS.muted;
      ctx.font = `400 13px ${fontFamily}`;
      for (const line of hintLines) {
        ctx.fillText(line, size / 2, y);
        y += lh - 2;
      }
    }
    ctx.textBaseline = "alphabetic";
  }

  function frame(now) {
    const dt = Math.min(now - lastTime, 50);
    lastTime = now;
    frameDt = dt;
    if (visible && desktop.matches) {
      if (!reduced) clock += dt / 1000;
      for (const cl of clusters) {
        const target =
          cl.session === hovered && cl.hasQuotes
            ? 1.28
            : cl.session === selected
              ? 1.1
              : 1;
        cl.scale += (target - cl.scale) * Math.min(1, dt / 120);
      }
      draw();
    }
    requestAnimationFrame(frame);
  }

  // ---- Pointer -----------------------------------------------------------
  function hitTest(event) {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * size;
    const y = ((event.clientY - rect.top) / rect.height) * size;
    let best = 0;
    let bestD = Number.POSITIVE_INFINITY;
    for (const cl of clusters) {
      const [cx, cy] = clusterCenter(cl);
      const d = Math.hypot(x - cx, y - cy);
      if (d < (cl.rc + 8) * k * cl.scale && d < bestD) {
        best = cl.session;
        bestD = d;
      }
    }
    return best;
  }

  canvas.addEventListener("pointermove", (e) => {
    const hit = hitTest(e);
    hovered = hit && clusters[hit - 1].hasQuotes ? hit : 0;
    canvas.style.cursor = hovered ? "pointer" : "default";
  });
  canvas.addEventListener("pointerleave", () => {
    hovered = 0;
    canvas.style.cursor = "default";
  });
  canvas.addEventListener("click", (e) => {
    const hit = hitTest(e);
    if (hit && clusters[hit - 1].hasQuotes) select(hit);
  });
  canvas.addEventListener("keydown", (e) => {
    if (!sessionsWithQuotes.length) return;
    const i = sessionsWithQuotes.indexOf(selected);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      select(sessionsWithQuotes[(i + 1) % sessionsWithQuotes.length]);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      select(
        sessionsWithQuotes[
          (i - 1 + sessionsWithQuotes.length) % sessionsWithQuotes.length
        ],
      );
    }
  });

  for (const btn of selectButtons) {
    btn.addEventListener("click", () =>
      select(Number(btn.dataset.selectSession)),
    );
  }
  for (const btn of toggleButtons) {
    btn.disabled = false;
    btn.addEventListener("click", () => {
      dimension = FL.DIMENSION_BY_VARIANT[btn.dataset.variant] || "region";
      for (const b of toggleButtons) {
        b.setAttribute("aria-pressed", String(b === btn));
      }
      root.dataset.variant = btn.dataset.variant;
      recolor();
    });
  }

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
  select(selected);
  applyLayoutMode();
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
