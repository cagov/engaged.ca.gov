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
  const showConv = root.dataset.showConversationLabel || "Show conversation";
  const hideConv = root.dataset.hideConversationLabel || "Hide conversation";
  const convToggles = [...root.querySelectorAll("[data-conversation-toggle]")];
  // Phones: the quotes are folded until "Show conversation" is tapped.
  let conversationOpen = false;
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
      // Engaging with any part of a card selects its theme (feedback 9/22).
      const li = toggle.closest(".top-theme");
      if (li) select(Number(li.dataset.theme));
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
    placePanel();
    drawConnector();
    fitAttributions();
  }
  for (const b of selects)
    b.addEventListener("click", () => select(Number(b.dataset.themeSelect)));
  for (const t of convToggles) {
    t.addEventListener("click", () => {
      const n = Number(t.dataset.conversationToggle);
      conversationOpen = !(conversationOpen && n === selected);
      select(n);
    });
  }
  function syncConversationToggles(narrow) {
    for (const t of convToggles) {
      const n = Number(t.dataset.conversationToggle);
      const open = narrow && conversationOpen && n === selected;
      t.hidden = !narrow;
      t.setAttribute("aria-expanded", String(open));
      const text = t.querySelector(".top-theme-conversation-toggle-text");
      if (text) text.textContent = open ? hideConv : showConv;
    }
    // On phones the panel shows only when its card's conversation is open;
    // on desktop it is always visible beside the cards.
    panel.hidden = narrow && !conversationOpen;
    for (const li of root.querySelectorAll(".top-theme"))
      li.classList.toggle(
        "is-selected",
        Number(li.dataset.theme) === selected && (!narrow || conversationOpen),
      );
  }

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
    syncConversationToggles(narrow);
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
    fitAttributions();
  });
  window.addEventListener("load", fitAttributions);
  // The panel is sticky on desktop, so its position relative to the cards
  // changes as the page scrolls; keep the connector attached.
  let scrollQueued = false;
  window.addEventListener(
    "scroll",
    () => {
      if (scrollQueued) return;
      scrollQueued = true;
      requestAnimationFrame(() => {
        scrollQueued = false;
        drawConnector();
      });
    },
    { passive: true },
  );
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

/** Right-aligned (mirrored) attributions that wrap: pick the word break
 * that makes the two lines as even as possible while keeping the first
 * line the longer one, then shrink the name block to that first line so
 * the dot sits right beside it. Falls back to the browser's own wrapping
 * when the name needs more than two lines. */
function fitAttributions() {
  const spans = document.querySelectorAll(
    ".top-themes .conversation-quote:nth-child(even) .conversation-attribution-text",
  );
  for (const span of spans) {
    span.style.width = "";
    if (!span.offsetParent) continue; // hidden quote set
    const available = span.getBoundingClientRect().width;
    const range = document.createRange();
    range.selectNodeContents(span);
    if (range.getClientRects().length < 2) continue; // fits on one line

    // Measure candidate splits with a nowrap clone in the same font.
    const words = span.textContent.trim().split(/\s+/);
    const probe = document.createElement("span");
    probe.style.cssText =
      "position:absolute;visibility:hidden;white-space:nowrap;pointer-events:none";
    span.parentElement.appendChild(probe);
    const measure = (text) => {
      probe.textContent = text;
      return probe.getBoundingClientRect().width;
    };
    let best = null;
    for (let k = 1; k < words.length; k++) {
      const w1 = measure(words.slice(0, k).join(" "));
      const w2 = measure(words.slice(k).join(" "));
      if (w1 > available || w2 > w1) continue;
      const diff = w1 - w2;
      if (!best || diff < best.diff) best = { w1, diff };
    }
    probe.remove();
    if (best) span.style.width = `${Math.ceil(best.w1) + 1}px`;
  }
}
