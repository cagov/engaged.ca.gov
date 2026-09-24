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
  // Selection leaves the folds alone (head designer, 9/24, reversing 9/23):
  // only the "Show examples" control opens or closes a card's examples.
  for (const toggle of root.querySelectorAll(".top-theme-examples-toggle")) {
    const body = document.getElementById(toggle.getAttribute("aria-controls"));
    const text = toggle.querySelector(".top-theme-examples-toggle-text");
    const li = toggle.closest(".top-theme");
    const set = (open) => {
      toggle.setAttribute("aria-expanded", String(open));
      if (body) body.hidden = !open;
      if (text) text.textContent = open ? hideLabel : showLabel;
      drawConnector();
    };
    set(false);
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") !== "true";
      set(open);
      // Engaging with any part of a card selects its theme (feedback 9/22).
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
      // On phones the conversation control also selects its theme.
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
      // Panel goes above the card's "Show/Hide conversation" control so the
      // control reads as the fold's footer once open (design 9/22).
      const li = root.querySelector(`.top-theme[data-theme="${selected}"]`);
      const toggle = li?.querySelector("[data-conversation-toggle]");
      if (li && panel.parentElement !== li) li.insertBefore(panel, toggle);
    } else if (panel.parentElement !== layout) {
      layout.appendChild(panel);
    }
    root.classList.toggle("is-narrow", narrow);
    syncConversationToggles(narrow);
  }

  // ---- Panel offset: its top lines up with the selected card (design 9/24)
  function alignPanel() {
    const list = root.querySelector(".top-themes-list");
    const card = root.querySelector(`.top-theme[data-theme="${selected}"]`);
    if (!list || !card || window.innerWidth < NARROW) {
      panel.style.removeProperty("--panel-offset");
      return;
    }
    const offset =
      card.getBoundingClientRect().top - list.getBoundingClientRect().top;
    panel.style.setProperty("--panel-offset", `${Math.max(0, offset)}px`);
  }

  // ---- Connector line from the selected card's edge to the panel's hairline
  function drawConnector() {
    if (!connector) return;
    if (window.innerWidth < NARROW) {
      connector.innerHTML = "";
      return;
    }
    alignPanel();
    // From just outside the selected card's border, level with its title,
    // to the panel's hairline at the height of the "What people said"
    // heading, as an S-curve (design 9/24). Redrawn on every selection,
    // fold and resize because the panel moves with the selection.
    const card = root.querySelector(`.top-theme[data-theme="${selected}"]`);
    const title = card?.querySelector(".top-theme-select");
    const heading = panel.querySelector(".top-themes-quotes-title");
    if (!card || !title || !heading) return;
    const lr = layout.getBoundingClientRect();
    const cr = card.getBoundingClientRect();
    const tr = title.getBoundingClientRect();
    const pr = panel.getBoundingClientRect();
    // Overlay covers the whole layout so the path can run through the gap.
    connector.setAttribute("viewBox", `0 0 ${lr.width} ${lr.height}`);
    connector.style.width = `${lr.width}px`;
    connector.style.height = `${lr.height}px`;
    // Absolute offsets are measured from the panel's padding box, which sits
    // inside its border (the hairline), so subtract the border widths or the
    // whole drawing shifts by that much.
    const ps = getComputedStyle(panel);
    const bl = Number.parseFloat(ps.borderLeftWidth) || 0;
    const bt = Number.parseFloat(ps.borderTopWidth) || 0;
    connector.style.left = `${lr.left - pr.left - bl}px`;
    connector.style.top = `${lr.top - pr.top - bt}px`;
    // Right-to-left pages mirror the layout: the panel sits to the left of
    // the cards, so the line leaves the card's left edge for the heading's
    // right edge.
    const rtl = getComputedStyle(layout).direction === "rtl";
    // Ends overlap the card's border and the hairline by a pixel; the line
    // is painted beneath both, so the joins read as continuous.
    const x0 = rtl ? cr.left - lr.left + 1 : cr.right - lr.left - 1;
    const y0 = tr.top + tr.height / 2 - lr.top; // level with the theme title
    const hr = heading.getBoundingClientRect();
    // The hairline is the panel's 2px inline-start border; the curve ends
    // at its centre with a flat cap, so nothing shows past it.
    const x1 = rtl ? pr.right - lr.left - 1 : pr.left - lr.left + 1;
    const y1 = hr.top + hr.height / 2 - lr.top; // points at "What people said"
    const mx = (x0 + x1) / 2;
    connector.innerHTML = `<path d="M ${x0} ${y0} C ${mx} ${y0}, ${mx} ${y1}, ${x1} ${y1}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt"/>`;
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
  // The first theme is pre-selected; its examples stay folded (9/24).
  select(1);
  colorAttributions();
  // Fonts and images can shift the layout after first paint.
  window.addEventListener("load", drawConnector);
}

/** Colors each quote's attribution dot by the speaker's field of work,
 * using the same assignment the Who participated chart makes from the
 * funnel data (its default colouring since 9/24). */
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
  const names = (data.fieldOfWork || []).map((f) => f.name);
  const colors = assignCategoryColors(names);
  const colorOf = Object.fromEntries(names.map((n, i) => [n, colors[i]]));
  for (const att of document.querySelectorAll(
    ".top-themes .conversation-attribution",
  )) {
    const dot = att.querySelector(".conversation-attribution-dot");
    const color = colorOf[att.dataset.field];
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
