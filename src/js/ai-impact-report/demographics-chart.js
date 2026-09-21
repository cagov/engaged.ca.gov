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
    phase1: "#7ec3e8",
    phase2: "#e79450",
    axis: "rgba(255, 244, 235, 0.85)",
    grid: "rgba(255, 244, 235, 0.22)",
    text: "#fff4eb",
    muted: "rgba(255, 244, 235, 0.75)",
  },
  // On white (details page, design 9/21). Root carries data-theme="light".
  light: {
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
const PAD = { top: 36, right: 24, bottom: 96, left: 80 };

function el(name, attrs, text) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs || {}))
    node.setAttribute(k, String(v));
  if (text !== undefined) node.textContent = text;
  return node;
}

function fmtDiff(v) {
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}${Math.abs(v).toFixed(1)}`;
}

/** Symmetric axis limit: a round number a little above the largest |value|. */
function axisMax(values) {
  const peak = Math.max(1, ...values.map((v) => Math.abs(v)));
  const step = peak <= 10 ? 4 : peak <= 20 ? 5 : 10;
  return Math.ceil((peak * 1.15) / step) * step;
}

/** Wrap a label into at most two lines by word count. */
function splitLabel(label, maxChars) {
  if (label.length <= maxChars) return [label];
  const words = label.split(" ");
  let first = "";
  while (words.length && `${first} ${words[0]}`.trim().length <= maxChars) {
    first = `${first} ${words.shift()}`.trim();
  }
  if (!first) first = words.shift();
  return [first, words.join(" ")].filter(Boolean);
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
    points: root.dataset.pointsLabel || "{value} points",
    tableCaption: root.dataset.tableCaption || "{dimension}",
  };
  const dimensionLabel = (id) => {
    const opt = [...select.options].find((o) => o.value === id);
    return opt ? opt.textContent.trim() : id;
  };

  const byId = Object.fromEntries(data.dimensions.map((d) => [d.id, d]));
  COLORS = PALETTES[root.dataset.theme] || PALETTES.dark;
  root.classList.add("js-enabled");

  function render(id) {
    const dim = byId[id];
    if (!dim) return;
    drawSvg(dim, id);
    drawTable(dim, id);
    for (const s of sources) s.hidden = s.dataset.sourceFor !== id;
    root.dataset.dimension = id;
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
    const barW = Math.min(26, groupW * 0.22);
    const gap = Math.min(6, barW * 0.25);
    const dense = cats.length > 10;
    // Design asks for nothing under 14px; the SVG renders at or above 1:1 on desktop.
    const valueFont = dense ? 13 : 14;

    const svg = el("svg", {
      viewBox: `0 0 ${W} ${H}`,
      role: "img",
      "aria-label": `${dimensionLabel(id)}: ${labels.phase1} and ${labels.phase2}, percentage points from target`,
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
          tv === 0 ? labels.onTarget : fmtDiff(tv).replace(".0", ""),
        ),
      );
    }

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
          `${c.name}, ${s.label}: ${fmtDiff(s.v)} points from target (${c[s.key]}% vs ${c.target}% target)`,
        );
        bar.appendChild(title);
        svg.appendChild(bar);
        // Value label outside the bar end.
        const labelY = s.v >= 0 ? top - 6 : top + height + 14;
        svg.appendChild(
          el(
            "text",
            {
              x: s.x + barW / 2,
              y: labelY,
              "text-anchor": "middle",
              fill: COLORS.text,
              "font-size": valueFont,
              "font-weight": 700,
            },
            fmtDiff(s.v),
          ),
        );
      }

      // Category label under the group, wrapped to two lines if long.
      const maxChars = Math.max(10, Math.floor(groupW / 7.8));
      const lines = splitLabel(c.short || c.name, maxChars);
      const text = el("text", {
        x: cx,
        y: H - PAD.bottom + 34,
        "text-anchor": "middle",
        fill: COLORS.muted,
        "font-size": 14,
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
    const table = document.createElement("table");
    table.className = "visually-hidden";
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
      "Target %",
      `${labels.phase1} %`,
      `${labels.phase2} %`,
      `${labels.phase1} points from target`,
      `${labels.phase2} points from target`,
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
      th.textContent = c.name;
      tr.appendChild(th);
      for (const v of [
        c.target,
        c.phase1,
        c.phase2,
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
  render(select.value in byId ? select.value : data.dimensions[0].id);
}
