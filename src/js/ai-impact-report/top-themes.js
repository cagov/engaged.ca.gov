/**
 * Top 3 policy ideas: three theme cards and a "What people said" panel.
 *
 * Clicking a card selects it: its quotes show in the panel and a connector
 * line joins the card to the panel. Each card's examples fold with a
 * "Show examples" / "Hide examples" control. Without JS every card shows its
 * examples and every quote set is visible.
 *
 * Root contract (see mmmd-ai-impact-report.njk):
 *   [data-theme-select="n"]         card button, aria-pressed marks the selection
 *   [data-quotes-for="n"]           one quote block per theme inside [data-quotes-panel]
 *   [data-connector]                SVG overlay inside the panel for the connector line
 *   .top-theme-examples-toggle      per card; aria-controls its examples block
 *   data-show-examples-label / data-hide-examples-label on the root
 *
 * On narrow screens the panel is moved into the selected card's <li> so the
 * quotes read directly under the theme they belong to.
 */

import { assignCategoryColors } from "./funnel-layout.js";

const NARROW = 992;

export function initTopThemes(root) {
  if (!root) return;
  const selects = [...root.querySelectorAll("[data-theme-select]")];
  const panel = root.querySelector("[data-quotes-panel]");
  const blocks = [...root.querySelectorAll("[data-quotes-for]")];
  const connector = root.querySelector("[data-connector]");
  const layout = root.querySelector(".top-themes-layout");
  if (!selects.length || !panel) return;

  const showLabel = root.dataset.showExamplesLabel || "Show examples";
  const hideLabel = root.dataset.hideExamplesLabel || "Hide examples";
  root.classList.add("js-enabled");
  let selected = 1;

  // ---- Examples fold: collapsed by default -------------------------------
  for (const toggle of root.querySelectorAll(".top-theme-examples-toggle")) {
    const body = document.getElementById(toggle.getAttribute("aria-controls"));
    const text = toggle.querySelector(".top-theme-examples-toggle-text");
    const set = (open) => {
      toggle.setAttribute("aria-expanded", String(open));
      if (body) body.hidden = !open;
      if (text) text.textContent = open ? hideLabel : showLabel;
      drawConnector();
    };
    set(false);
    toggle.addEventListener("click", () => {
      set(toggle.getAttribute("aria-expanded") !== "true");
    });
  }

  // ---- Selection -----------------------------------------------------------
  function select(n) {
    selected = n;
    for (const b of selects)
      b.setAttribute(
        "aria-pressed",
        String(Number(b.dataset.themeSelect) === n),
      );
    for (const blk of blocks) blk.hidden = Number(blk.dataset.quotesFor) !== n;
    for (const li of root.querySelectorAll(".top-theme"))
      li.classList.toggle("is-selected", Number(li.dataset.theme) === n);
    placePanel();
    drawConnector();
  }
  for (const b of selects)
    b.addEventListener("click", () => select(Number(b.dataset.themeSelect)));

  // ---- Panel placement: beside the list on desktop, under the card on mobile
  function placePanel() {
    const narrow = window.innerWidth < NARROW;
    // The panel scrolls on desktop, so it must be reachable by keyboard.
    for (const blk of blocks) {
      if (narrow) blk.removeAttribute("tabindex");
      else blk.setAttribute("tabindex", "0");
    }
    if (narrow) {
      const li = root.querySelector(`.top-theme[data-theme="${selected}"]`);
      if (li && panel.parentElement !== li) li.appendChild(panel);
    } else if (panel.parentElement !== layout) {
      layout.appendChild(panel);
    }
    root.classList.toggle("is-narrow", narrow);
  }

  // ---- Connector line from the selected card's right edge to the panel ----
  function drawConnector() {
    if (!connector) return;
    if (window.innerWidth < NARROW) {
      connector.innerHTML = "";
      return;
    }
    // From just outside the selected card's border to just outside the
    // panel's border near its top, as an S-curve (design 9/22).
    const card = root.querySelector(`.top-theme[data-theme="${selected}"]`);
    const title = card?.querySelector(".top-theme-select");
    if (!card || !title) return;
    const lr = layout.getBoundingClientRect();
    const cr = card.getBoundingClientRect();
    const tr = title.getBoundingClientRect();
    const pr = panel.getBoundingClientRect();
    // Overlay covers the whole layout so the path can run through the gap.
    connector.setAttribute("viewBox", `0 0 ${lr.width} ${lr.height}`);
    connector.style.width = `${lr.width}px`;
    connector.style.height = `${lr.height}px`;
    connector.style.left = `${lr.left - pr.left}px`;
    connector.style.top = `${lr.top - pr.top}px`;
    const x0 = cr.right - lr.left + 2;
    const y0 = tr.top + tr.height / 2 - lr.top; // level with the theme title
    const x1 = pr.left - lr.left - 2;
    const y1 = pr.top - lr.top + 44; // enters beside "What people said"
    const mx = (x0 + x1) / 2;
    connector.innerHTML = `<path d="M ${x0} ${y0} C ${mx} ${y0}, ${mx} ${y1}, ${x1} ${y1}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`;
  }

  window.addEventListener("resize", () => {
    placePanel();
    drawConnector();
  });
  select(1);
  colorAttributions();
  // Fonts and images can shift the layout after first paint.
  window.addEventListener("load", drawConnector);
}

/** Colors each quote's attribution dot by the speaker's region, using the
 * same assignment the Who participated chart makes from the funnel data. */
async function colorAttributions() {
  const src = document.querySelector("[data-funnel-src]")?.dataset.funnelSrc;
  if (!src) return;
  let data;
  try {
    const res = await fetch(src);
    if (!res.ok) return;
    data = await res.json();
  } catch {
    return;
  }
  const names = data.regions.map((r) => r.name);
  const colors = assignCategoryColors(names);
  const colorOf = Object.fromEntries(names.map((n, i) => [n, colors[i]]));
  for (const att of document.querySelectorAll(
    ".top-themes .conversation-attribution",
  )) {
    const dot = att.querySelector(".conversation-attribution-dot");
    const color = colorOf[att.dataset.region];
    if (dot && color) dot.style.background = color;
  }
}
