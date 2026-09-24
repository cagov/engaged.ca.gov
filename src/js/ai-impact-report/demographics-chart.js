/**
 * Demographics chart: Phase 1 and Phase 2 participant shares, plotted as
 * percentage points from the statewide target, one dimension at a time.
 *
 * Renders an SVG grouped bar chart from
 * /public/data/ai-report-demographics.json (built by
 * scripts/ai_report_data/build_demographics.py). A native <select> picks the
 * dimension; the "Source for targets" note below the chart swaps to match.
 *
 * Root contract (see mmmd-ai-impact-report.njk):
 *   [data-demographics-chart][data-src]        root, JSON URL
 *   select[data-demographics-select]          options carry value = dimension id
 *   [data-demographics-svg]                   container the SVG is drawn into
 *   [data-demographics-table]                 container for the visually hidden data table
 *   [data-source-for="<id>"]                  one per dimension; hidden unless selected
 *   data-* labels on the root: phase1-label, phase2-label, on-target-label,
 *     points-label ("{value} points"), table-caption ("{dimension}")
 */

const SVG_NS = "http://www.w3.org/2000/svg";

const PALETTES = {
  // On the navy band.
  dark: {
    background: "#1c2745",
    phase1: "#7ec3e8",
    phase2: "#e79450",
    axis: "rgba(255, 244, 235, 0.85)",
    grid: "rgba(255, 244, 235, 0.22)",
    text: "#fff4eb",
    muted: "rgba(255, 244, 235, 0.75)",
  },
  // On white (details page, design 9/21). Root carries data-theme="light".
  light: {
    background: "#fff",
    phase1: "#7ec3e8",
    phase2: "#e79450",
    axis: "rgba(15, 21, 47, 0.85)",
    grid: "rgba(15, 21, 47, 0.18)",
    text: "#0f152f",
    muted: "rgba(15, 21, 47, 0.7)",
  },
};
let COLORS = PALETTES.dark;

const W = 1040;
const H = 460;
// Bottom holds up to three lines of category label (9/24: trimmed so the
// chart sits closer to its source note).
const PAD = { top: 36, right: 24, bottom: 80, left: 128 };

function el(name, attrs, text) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs || {}))
    node.setAttribute(k, String(v));
  if (text !== undefined) node.textContent = text;
  return node;
}

// Numbers follow the page's language (decimal comma in Spanish, Persian
// digits in Farsi, ...). Falls back to plain digits on an unknown locale.
const LANG = document.documentElement.lang || "en";
function fmtNum(v, digits) {
  try {
    return Number(v).toLocaleString(LANG, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  } catch {
    return Number(v).toFixed(digits);
  }
}
function fmtDiff(v) {
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}${fmtNum(Math.abs(v), 1)}`;
}
/** Axis ticks: whole numbers unless the step is fractional (e.g. ±12.5). */
function fmtTick(v) {
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  const a = Math.abs(v);
  return `${sign}${fmtNum(a, Number.isInteger(a) ? 0 : 1)}`;
}

/** Symmetric axis limit: a round number a little above the largest |value|. */
function axisMax(values) {
  const peak = Math.max(1, ...values.map((v) => Math.abs(v)));
  const step = peak <= 10 ? 4 : peak <= 20 ? 5 : 10;
  return Math.ceil((peak * 1.15) / step) * step;
}

/** Greedy wrap into as many lines as needed, each at most maxChars. */
/** Wrap into at most two lines that each fit maxWidth (measured with
 * `width`), splitting at the word boundary that leaves the two lines
 * closest in width. Falls back to greedy wrapping when even the best
 * two-line split is too wide. */
function balancedWrap(text, maxWidth, width) {
  if (width(text) <= maxWidth) return [text];
  const words = text.split(" ");
  let best = null;
  for (let k = 1; k < words.length; k++) {
    const a = words.slice(0, k).join(" ");
    const b = words.slice(k).join(" ");
    const wa = width(a);
    const wb = width(b);
    if (Math.max(wa, wb) > maxWidth) continue;
    const diff = Math.abs(wa - wb);
    if (!best || diff < best.diff) best = { lines: [a, b], diff };
  }
  if (best) return best.lines;
  // Greedy, by measured width.
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && width(next) > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Text width in CSS px for a given font shorthand, via an offscreen canvas. */
const measureCtx = document.createElement("canvas").getContext("2d");
function textWidth(text, font) {
  if (!measureCtx) return text.length * 7;
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}

function wrapWords(text, maxChars) {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && `${line} ${word}`.length > maxChars) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

export async function initDemographicsChart(root) {
  if (!root) return;
  const select = root.querySelector("select[data-demographics-select]");
  const svgHost = root.querySelector("[data-demographics-svg]");
  const tableHost = root.querySelector("[data-demographics-table]");
  const sources = [...root.querySelectorAll("[data-source-for]")];
  if (!select || !svgHost) return;

  let data;
  try {
    const res = await fetch(root.dataset.src);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    data = await res.json();
  } catch (err) {
    console.error("demographics chart: could not load data", err);
    return;
  }

  const labels = {
    phase1: root.dataset.phase1Label || "Phase 1",
    phase2: root.dataset.phase2Label || "Phase 2",
    onTarget: root.dataset.onTargetLabel || "On target",
    axisAbove: root.dataset.axisAboveLabel || "",
    axisBelow: root.dataset.axisBelowLabel || "",
    points: root.dataset.pointsLabel || "{value} points",
    tableCaption: root.dataset.tableCaption || "{dimension}",
    chartAria:
      root.dataset.chartAriaLabel ||
      "{dimension}: {phase1} and {phase2}, percentage points from target",
    barTitle:
      root.dataset.barTitle ||
      "{category}, {phase}: {value} points from target ({share}% vs {target}% target)",
    targetHeader: root.dataset.tableTargetHeader || "Target %",
    pointsHeader:
      root.dataset.tablePointsHeader || "{phase} points from target",
  };
  // Category names as they appear in the data, mapped to the page's language.
  let categoryLabels = {};
  try {
    categoryLabels = JSON.parse(root.dataset.categoryLabels || "{}") || {};
  } catch {
    categoryLabels = {};
  }
  const nameOf = (c) => categoryLabels[c.name] || c.name;
  const tpl = (template, vars) =>
    template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  const dimensionLabel = (id) => {
    const opt = [...select.options].find((o) => o.value === id);
    return opt ? opt.textContent.trim() : id;
  };

  const byId = Object.fromEntries(data.dimensions.map((d) => [d.id, d]));
  COLORS = PALETTES[root.dataset.theme] || PALETTES.dark;
  root.classList.add("js-enabled");

  // Below NARROW_BELOW CSS px the chart turns horizontal: one row per
  // category, bars left (below target) and right (above) of a centre line,
  // so labels keep their real size instead of scaling down with the drawing.
  const NARROW_BELOW = 700;
  const isNarrow = () => (svgHost.clientWidth || W) < NARROW_BELOW;
  let lastNarrow = null;
  let current = null;

  function render(id) {
    const dim = byId[id];
    if (!dim) return;
    current = id;
    lastNarrow = isNarrow();
    if (lastNarrow) drawSvgHorizontal(dim, id);
    else drawSvg(dim, id);
    drawTable(dim, id);
    for (const s of sources) s.hidden = s.dataset.sourceFor !== id;
    root.dataset.dimension = id;
    root.dataset.layout = lastNarrow ? "horizontal" : "vertical";
  }
  window.addEventListener("resize", () => {
    if (current && isNarrow() !== lastNarrow) render(current);
  });

  /** Phone layout: horizontal bars, real-size text, height grows with rows.
   * Category names sit in a column on the left, wrapped to a balanced two
   * lines where needed so the column stays narrow; the bars take the rest
   * of the width (design 9/24). */
  function drawSvgHorizontal(dim, id) {
    const cats = dim.categories;
    const values = cats.flatMap((c) => [c.phase1Diff, c.phase2Diff]);
    const max = axisMax(values);
    const width = Math.max(300, svgHost.clientWidth || 360);
    const font = 13;
    const lineH = 16;
    const pad = { top: 62, right: 8, bottom: 30, left: 0 };
    const barH = 12;
    const barGap = 3;
    const rowGap = 14;
    // Label column: about a third of the width, capped so the bars keep room.
    const labelW = Math.round(Math.min(150, Math.max(104, width * 0.36)));
    const labelInset = 4; // keep the longest line off the SVG's left edge
    const labelGap = 10;
    const labelFont = `600 ${font}px ${getComputedStyle(svgHost).fontFamily}`;
    const rows = cats.map((c) =>
      balancedWrap(nameOf(c), labelW - labelInset, (t) =>
        textWidth(t, labelFont),
      ),
    );
    const barsH = barH * 2 + barGap;
    const rowHeights = rows.map(
      (lines) => Math.max(barsH, lines.length * lineH) + rowGap,
    );
    const plotL = pad.left + labelW + labelGap;
    const plotW = width - plotL - pad.right;
    const zeroX = plotL + plotW / 2;
    const xFor = (v) => zeroX + (v / max) * (plotW / 2);
    const height = pad.top + rowHeights.reduce((a, b) => a + b, 0) + pad.bottom;
    const valueFontM = 11;
    const valueW = (v) => fmtDiff(v).length * valueFontM * 0.62 + 6;

    const svg = el("svg", {
      viewBox: `0 0 ${width} ${height}`,
      width,
      height,
      role: "img",
      "aria-label": tpl(labels.chartAria, {
        dimension: dimensionLabel(id),
        phase1: labels.phase1,
        phase2: labels.phase2,
      }),
      class: "demographics-svg demographics-svg-horizontal",
    });

    // Legend, centred over the bars.
    const legend = el("g", { transform: `translate(${zeroX - 84}, 12)` });
    legend.appendChild(
      el("rect", {
        x: 0,
        y: -8,
        width: 11,
        height: 11,
        rx: 2,
        fill: COLORS.phase1,
      }),
    );
    legend.appendChild(
      el(
        "text",
        { x: 16, y: 1, fill: COLORS.muted, "font-size": 12 },
        labels.phase1,
      ),
    );
    legend.appendChild(
      el("rect", {
        x: 78,
        y: -8,
        width: 11,
        height: 11,
        rx: 2,
        fill: COLORS.phase2,
      }),
    );
    legend.appendChild(
      el(
        "text",
        { x: 94, y: 1, fill: COLORS.muted, "font-size": 12 },
        labels.phase2,
      ),
    );
    svg.appendChild(legend);

    // Axis captions: below target at the left end of the bars, above at the right.
    // Captions are 12px when both fit in two lines within half the plot
    // (the usual case), 10px on very narrow screens. "On target" below
    // uses the same size (9/24).
    const captionFit = (size) => {
      const maxChars = Math.floor(plotW / 2 / (size * 0.52));
      const l1 = wrapWords(labels.axisBelow || "", maxChars);
      const l2 = wrapWords(labels.axisAbove || "", maxChars);
      return Math.max(l1.length, l2.length) <= 2;
    };
    const captionFont = captionFit(12) ? 12 : 10;
    const caption = (text, x, anchor) => {
      if (!text) return;
      const maxChars = Math.floor(plotW / 2 / (captionFont * 0.52));
      const lines = wrapWords(text, maxChars).slice(0, 2);
      const t = el("text", {
        x,
        y: 36,
        "text-anchor": anchor,
        fill: COLORS.text,
        "font-size": captionFont,
        "font-weight": 700,
      });
      lines.forEach((ln, i) => {
        t.appendChild(
          el("tspan", { x, dy: i === 0 ? 0 : captionFont + 2 }, ln),
        );
      });
      svg.appendChild(t);
    };
    caption(labels.axisBelow, plotL, "start");
    caption(labels.axisAbove, width - pad.right, "end");

    // Gridlines and the zero line, with tick values along the bottom.
    for (const tv of [-max, -max / 2, 0, max / 2, max]) {
      const x = xFor(tv);
      svg.appendChild(
        el("line", {
          x1: x,
          x2: x,
          y1: pad.top - 4,
          y2: height - pad.bottom + 4,
          stroke: tv === 0 ? COLORS.axis : COLORS.grid,
          "stroke-width": tv === 0 ? 1.5 : 1,
          "stroke-dasharray": tv === 0 ? "" : "3 4",
        }),
      );
      svg.appendChild(
        el(
          "text",
          {
            x,
            y: height - pad.bottom + 18,
            "text-anchor":
              tv === -max ? "start" : tv === max ? "end" : "middle",
            fill: tv === 0 ? COLORS.text : COLORS.muted,
            "font-size": tv === 0 ? captionFont : 11,
            "font-weight": tv === 0 ? 700 : 400,
          },
          tv === 0 ? labels.onTarget : fmtTick(tv),
        ),
      );
    }

    let rowTop = pad.top;
    cats.forEach((c, i) => {
      const lines = rows[i];
      const rowH = rowHeights[i] - rowGap;
      // Name in the left column, right-aligned against the bars and
      // vertically centred on the row.
      const textH = lines.length * lineH;
      const textTop = rowTop + (rowH - textH) / 2;
      const text = el("text", {
        x: plotL - labelGap,
        y: textTop + font - 1,
        "text-anchor": "end",
        fill: COLORS.text,
        "font-size": font,
        "font-weight": 600,
      });
      lines.forEach((ln, li) => {
        text.appendChild(
          el("tspan", { x: plotL - labelGap, dy: li === 0 ? 0 : lineH }, ln),
        );
      });
      svg.appendChild(text);

      const barsTop = rowTop + (rowH - barsH) / 2;
      const series = [
        {
          key: "phase1",
          v: c.phase1Diff,
          y: barsTop,
          color: COLORS.phase1,
          label: labels.phase1,
        },
        {
          key: "phase2",
          v: c.phase2Diff,
          y: barsTop + barH + barGap,
          color: COLORS.phase2,
          label: labels.phase2,
        },
      ];
      for (const s of series) {
        const x0 = xFor(0);
        const x1 = xFor(s.v);
        const left = Math.min(x0, x1);
        const w = Math.max(1.5, Math.abs(x1 - x0));
        const bar = el("rect", {
          x: left,
          y: s.y,
          width: w,
          height: barH,
          rx: 2,
          fill: s.color,
          class: `demographics-bar demographics-bar-${s.key}`,
        });
        bar.appendChild(
          el(
            "title",
            {},
            tpl(labels.barTitle, {
              category: nameOf(c),
              phase: s.label,
              value: fmtDiff(s.v),
              share: fmtNum(c[s.key], 1),
              target: fmtNum(c.target, 1),
            }),
          ),
        );
        svg.appendChild(bar);
        // Value label just past the bar end; if it would run off the edge,
        // it sits inside the bar end instead.
        const outward = s.v >= 0 ? 1 : -1;
        let lx = x1 + outward * 4;
        let anchor = s.v >= 0 ? "start" : "end";
        let fill = COLORS.text;
        const overflows =
          s.v >= 0
            ? lx + valueW(s.v) > width - pad.right
            : lx - valueW(s.v) < plotL;
        if (overflows && w > valueW(s.v) + 6) {
          lx = x1 - outward * 4;
          anchor = s.v >= 0 ? "end" : "start";
          fill = "#fff";
        }
        svg.appendChild(
          el(
            "text",
            {
              x: lx,
              y: s.y + barH - 2,
              "text-anchor": anchor,
              fill,
              "font-size": valueFontM,
              "font-weight": 700,
            },
            fmtDiff(s.v),
          ),
        );
      }
      rowTop += rowHeights[i];
    });

    svgHost.replaceChildren(svg);
  }

  function drawSvg(dim, id) {
    const cats = dim.categories;
    const values = cats.flatMap((c) => [c.phase1Diff, c.phase2Diff]);
    const max = axisMax(values);
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const zeroY = PAD.top + plotH / 2;
    const yFor = (v) => zeroY - (v / max) * (plotH / 2);
    const groupW = plotW / cats.length;
    // Wide enough that two value labels usually sit side by side.
    const barW = Math.min(34, groupW * 0.3);
    const gap = Math.min(6, barW * 0.25);
    const dense = cats.length > 10;
    // Design asks for nothing under 14px; the SVG renders at or above 1:1 on desktop.
    const valueFont = dense ? 13 : 14;

    const svg = el("svg", {
      viewBox: `0 0 ${W} ${H}`,
      role: "img",
      "aria-label": tpl(labels.chartAria, {
        dimension: dimensionLabel(id),
        phase1: labels.phase1,
        phase2: labels.phase2,
      }),
      class: "demographics-svg",
    });

    // Gridlines and y labels at 0, ±half, ±max.
    const ticks = [-max, -max / 2, 0, max / 2, max];
    for (const tv of ticks) {
      const y = yFor(tv);
      svg.appendChild(
        el("line", {
          x1: PAD.left,
          x2: W - PAD.right,
          y1: y,
          y2: y,
          stroke: tv === 0 ? COLORS.axis : COLORS.grid,
          "stroke-width": tv === 0 ? 1.5 : 1,
          "stroke-dasharray": tv === 0 ? "" : "3 4",
        }),
      );
      svg.appendChild(
        el(
          "text",
          {
            x: PAD.left - 10,
            y: y + 4,
            "text-anchor": "end",
            fill: tv === 0 ? COLORS.text : COLORS.muted,
            "font-size": 14,
            "font-weight": tv === 0 ? 700 : 400,
          },
          tv === 0 ? labels.onTarget : fmtTick(tv),
        ),
      );
    }

    // Axis titles beside the top and bottom ticks: what the numbers are.
    const axisTitle = (text, y) => {
      if (!text) return;
      // Greedy wrap to short lines ("Percentage / points above / target").
      const lines = [];
      let line = "";
      for (const word of text.split(" ")) {
        if (line && `${line} ${word}`.length > 12) {
          lines.push(line);
          line = word;
        } else line = line ? `${line} ${word}` : word;
      }
      if (line) lines.push(line);
      const x = PAD.left - 42;
      const t = el("text", {
        x,
        y: y - ((lines.length - 1) * 16) / 2 + 4,
        "text-anchor": "end",
        fill: COLORS.text,
        "font-size": 14, // same as the "On target" tick beside it (9/24)
        "font-weight": 700,
      });
      lines.forEach((ln, i) => {
        t.appendChild(el("tspan", { x, dy: i === 0 ? 0 : 16 }, ln));
      });
      svg.appendChild(t);
    };
    axisTitle(labels.axisAbove, yFor(max));
    axisTitle(labels.axisBelow, yFor(-max));

    // Legend, centered above the plot.
    const legend = el("g", {
      transform: `translate(${W / 2 - 80}, ${PAD.top - 20})`,
    });
    legend.appendChild(
      el("rect", {
        x: 0,
        y: -8,
        width: 12,
        height: 12,
        rx: 2,
        fill: COLORS.phase1,
      }),
    );
    legend.appendChild(
      el(
        "text",
        { x: 18, y: 2, fill: COLORS.muted, "font-size": 14 },
        labels.phase1,
      ),
    );
    legend.appendChild(
      el("rect", {
        x: 90,
        y: -8,
        width: 12,
        height: 12,
        rx: 2,
        fill: COLORS.phase2,
      }),
    );
    legend.appendChild(
      el(
        "text",
        { x: 108, y: 2, fill: COLORS.muted, "font-size": 14 },
        labels.phase2,
      ),
    );
    svg.appendChild(legend);

    cats.forEach((c, i) => {
      const cx = PAD.left + groupW * (i + 0.5);
      const series = [
        {
          key: "phase1",
          v: c.phase1Diff,
          x: cx - gap / 2 - barW,
          color: COLORS.phase1,
          label: labels.phase1,
        },
        {
          key: "phase2",
          v: c.phase2Diff,
          x: cx + gap / 2,
          color: COLORS.phase2,
          label: labels.phase2,
        },
      ];
      for (const s of series) {
        const y0 = yFor(0);
        const y1 = yFor(s.v);
        const top = Math.min(y0, y1);
        const height = Math.max(1.5, Math.abs(y1 - y0));
        const bar = el("rect", {
          x: s.x,
          y: top,
          width: barW,
          height,
          rx: 2,
          fill: s.color,
          class: `demographics-bar demographics-bar-${s.key}`,
        });
        const title = el(
          "title",
          {},
          tpl(labels.barTitle, {
            category: nameOf(c),
            phase: s.label,
            value: fmtDiff(s.v),
            share: fmtNum(c[s.key], 1),
            target: fmtNum(c.target, 1),
          }),
        );
        bar.appendChild(title);
        svg.appendChild(bar);
      }

      // Value labels sit right at the bar ends. When two bars end at nearly
      // the same height on the same side and the pair is narrower than the
      // two labels, the labels slide apart horizontally (left one left,
      // right one right) rather than one dropping away from its bar.
      const labelYFor = (v) => {
        const yEnd = yFor(v);
        return v >= 0 ? yEnd - 6 : yEnd + 14;
      };
      const [a, b2] = series;
      const ys = [labelYFor(a.v), labelYFor(b2.v)];
      const xs = series.map((s) => s.x + barW / 2);
      const labelWidth = (v) => fmtDiff(v).length * valueFont * 0.62;
      const needed = (labelWidth(a.v) + labelWidth(b2.v)) / 2 + 4;
      const collide =
        a.v >= 0 === b2.v >= 0 &&
        Math.abs(ys[0] - ys[1]) < valueFont * 1.35 &&
        gap + barW < needed;
      if (collide) {
        const shift = (needed - (gap + barW)) / 2;
        xs[0] -= shift;
        xs[1] += shift;
      }
      series.forEach((s, si) => {
        svg.appendChild(
          el(
            "text",
            {
              x: xs[si],
              y: ys[si],
              "text-anchor": "middle",
              fill: COLORS.text,
              "font-size": valueFont,
              "font-weight": 700,
            },
            fmtDiff(s.v),
          ),
        );
      });

      // Category label under the group, wrapped to up to three lines if long
      // (translations run longer than the English names).
      const maxChars = Math.max(10, Math.floor(groupW / 7.8));
      // Translated name when the page has one (a label equal to its key is
      // just the English map); otherwise the data's short English form
      // ("Info tech") keeps the row of labels compact.
      const translated = categoryLabels[c.name];
      const barLabel =
        translated && translated !== c.name ? translated : c.short || c.name;
      const wrapped = wrapWords(barLabel, maxChars);
      const lines =
        wrapped.length <= 3
          ? wrapped
          : [...wrapped.slice(0, 2), wrapped.slice(2).join(" ")];
      const text = el("text", {
        x: cx,
        y: H - PAD.bottom + 34,
        "text-anchor": "middle",
        fill: COLORS.muted,
        "font-size": dense ? 12 : 14,
      });
      lines.forEach((line, li) => {
        text.appendChild(el("tspan", { x: cx, dy: li === 0 ? 0 : 17 }, line));
      });
      svg.appendChild(text);
    });

    svgHost.replaceChildren(svg);
  }

  function drawTable(dim, id) {
    if (!tableHost) return;
    // The wrapper is the visually-hidden box: a <table> ignores width and
    // overflow, so hiding the table itself let it widen the page on phones.
    tableHost.classList.add("visually-hidden");
    const table = document.createElement("table");
    const caption = document.createElement("caption");
    caption.textContent = labels.tableCaption.replace(
      "{dimension}",
      dimensionLabel(id),
    );
    table.appendChild(caption);
    const thead = document.createElement("thead");
    const hr = document.createElement("tr");
    for (const h of [
      dimensionLabel(id),
      labels.targetHeader,
      `${labels.phase1} %`,
      `${labels.phase2} %`,
      tpl(labels.pointsHeader, { phase: labels.phase1 }),
      tpl(labels.pointsHeader, { phase: labels.phase2 }),
    ]) {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = h;
      hr.appendChild(th);
    }
    thead.appendChild(hr);
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    for (const c of dim.categories) {
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      th.scope = "row";
      th.textContent = nameOf(c);
      tr.appendChild(th);
      for (const v of [
        fmtNum(c.target, 1),
        fmtNum(c.phase1, 1),
        fmtNum(c.phase2, 1),
        fmtDiff(c.phase1Diff),
        fmtDiff(c.phase2Diff),
      ]) {
        const td = document.createElement("td");
        td.textContent = String(v);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    tableHost.replaceChildren(table);
  }

  select.disabled = false;
  select.addEventListener("change", () => render(select.value));
  // Start from the template's dimension, not the select's current value:
  // browsers restore a select's last choice on reload, which made the chart
  // reopen on whatever was picked before (9/24).
  const initial =
    root.dataset.dimension in byId
      ? root.dataset.dimension
      : data.dimensions[0].id;
  select.value = initial;
  render(initial);
  buildDropdown(select, (id) => {
    select.value = id;
    render(id);
  });
}

/**
 * Replaces the native <select> with a styled listbox (design 9/23): white
 * field with a chevron that flips when open, options listed alphabetically
 * with the current one in bold. The <select> stays in the DOM, hidden, so
 * the label and no-JS path keep working. Keyboard: arrows move, Home/End
 * jump, Enter/Space choose, Escape closes.
 */
function buildDropdown(select, onChange) {
  const wrap = select.parentElement;
  const label = document.querySelector(`label[for="${select.id}"]`);
  const options = [...select.options]
    .map((o) => ({ id: o.value, text: o.textContent.trim() }))
    .sort((a, b) => a.text.localeCompare(b.text));
  let current = select.value;
  let open = false;

  const root = document.createElement("div");
  root.className = "demo-dropdown";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "demo-dropdown-button";
  button.id = `${select.id}-button`;
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-expanded", "false");
  if (label) {
    label.id = label.id || `${select.id}-label`;
    button.setAttribute("aria-labelledby", `${label.id} ${button.id}`);
  }
  const text = document.createElement("span");
  text.className = "demo-dropdown-text";
  const chevron = document.createElement("span");
  chevron.className = "demo-dropdown-chevron";
  chevron.setAttribute("aria-hidden", "true");
  button.append(text, chevron);

  const list = document.createElement("ul");
  list.className = "demo-dropdown-list";
  list.id = `${select.id}-listbox`;
  list.setAttribute("role", "listbox");
  list.tabIndex = -1;
  list.hidden = true;
  if (label) list.setAttribute("aria-labelledby", label.id);
  button.setAttribute("aria-controls", list.id);
  const items = options.map((o) => {
    const li = document.createElement("li");
    li.className = "demo-dropdown-option";
    li.id = `${select.id}-option-${o.id}`;
    li.setAttribute("role", "option");
    li.dataset.value = o.id;
    li.textContent = o.text;
    li.addEventListener("click", () => choose(o.id));
    list.appendChild(li);
    return li;
  });

  root.append(button, list);
  select.hidden = true;
  wrap.classList.add("demo-dropdown-host");
  wrap.appendChild(root);

  function sync() {
    const cur = options.find((o) => o.id === current) || options[0];
    text.textContent = cur.text;
    for (const li of items) {
      const on = li.dataset.value === current;
      li.setAttribute("aria-selected", String(on));
      li.classList.toggle("is-selected", on);
    }
    list.setAttribute(
      "aria-activedescendant",
      `${select.id}-option-${current}`,
    );
  }
  function setOpen(next) {
    open = next;
    list.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    root.classList.toggle("is-open", open);
    if (open) list.focus();
  }
  function choose(id) {
    if (id !== current) {
      current = id;
      sync();
      onChange(id);
    }
    setOpen(false);
    button.focus();
  }
  function move(delta) {
    const i = options.findIndex((o) => o.id === current);
    const j = Math.max(0, Math.min(options.length - 1, i + delta));
    current = options[j].id;
    sync();
    onChange(current);
  }

  button.addEventListener("click", () => setOpen(!open));
  button.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) setOpen(true);
      else move(e.key === "ArrowDown" ? 1 : -1);
    }
  });
  list.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      move(-options.length);
    } else if (e.key === "End") {
      e.preventDefault();
      move(options.length);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(current);
    } else if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
      if (e.key === "Escape") button.focus();
    }
  });
  document.addEventListener("click", (e) => {
    if (open && !root.contains(e.target)) setOpen(false);
  });
  sync();
}
