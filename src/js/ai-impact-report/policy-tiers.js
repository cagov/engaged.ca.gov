/**
 * Policy idea tiers: three collapsible cards, each holding a list of
 * expandable policy ideas.
 *
 * The HTML is rendered fully expanded so the page works without JS.
 * On load we collapse to the default state:
 *   - tier 1 open, showing the first N ideas with a "Show X more" control
 *   - other tiers closed, showing only their header and a "Show" control
 *   - a footer "Show all N ideas" control that opens everything
 *
 * All visible labels come from data attributes on the root element so they
 * can be translated in the .mmmd file.
 */

function fill(template, count) {
  return (template || "").replace("{count}", count);
}

export function initPolicyTiers(root) {
  if (!root) return;

  const labels = {
    show: root.dataset.showLabel,
    showMore: root.dataset.showMoreLabel,
    close: root.dataset.closeLabel,
    showAll: root.dataset.showAllLabel,
    closeAll: root.dataset.closeAllLabel,
  };
  const initialVisible = Number.parseInt(root.dataset.initialVisible, 10) || 3;

  const tiers = [...root.querySelectorAll(".policy-tier")];
  const toggleAll = root.querySelector("#policy-tiers-toggle-all");
  const totalIdeas = toggleAll
    ? Number.parseInt(toggleAll.dataset.totalIdeas, 10) || 0
    : 0;

  root.classList.add("js-enabled");

  /* ---- Individual policy ideas (plus / minus) ---- */

  for (const button of root.querySelectorAll(".policy-idea-toggle")) {
    const body = document.getElementById(button.getAttribute("aria-controls"));
    button.addEventListener("click", () => {
      const open = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!open));
      if (body) body.hidden = open;
    });
  }

  /* ---- Tier state ---- */

  /**
   * A tier is in one of three states:
   *   "closed"  — header only (tiers 2 and 3 by default)
   *   "partial" — header + first `initialVisible` ideas (tier 1 by default)
   *   "open"    — header + all ideas
   */
  function setTierState(tier, state) {
    const ideas = [...tier.querySelectorAll(".policy-idea")];
    const toggle = tier.querySelector(".policy-tier-toggle");
    const text = toggle.querySelector(".policy-tier-toggle-text");
    const list = tier.querySelector(".policy-ideas");
    const nbrIdeas = ideas.length;

    tier.dataset.state = state;

    ideas.forEach((idea, index) => {
      const visible =
        state === "open" || (state === "partial" && index < initialVisible);
      idea.hidden = !visible;
    });

    if (state === "open") {
      list.hidden = false;
      toggle.setAttribute("aria-expanded", "true");
      text.textContent = labels.close;
      toggle.hidden = false;
    } else if (state === "partial") {
      list.hidden = false;
      toggle.setAttribute("aria-expanded", "false");
      const remaining = nbrIdeas - initialVisible;
      text.textContent = fill(labels.showMore, remaining);
      toggle.hidden = remaining <= 0;
    } else {
      list.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      text.textContent = labels.show;
      toggle.hidden = false;
    }

    updateToggleAll();
  }

  function tierDefaultState(tier, index) {
    return index === 0 ? "partial" : "closed";
  }

  function allOpen() {
    return tiers.every((tier) => tier.dataset.state === "open");
  }

  function updateToggleAll() {
    if (!toggleAll) return;
    const text = toggleAll.querySelector(".policy-tiers-toggle-all-text");
    const open = allOpen();
    toggleAll.setAttribute("aria-expanded", String(open));
    text.textContent = open
      ? labels.closeAll
      : fill(labels.showAll, totalIdeas);
  }

  tiers.forEach((tier, index) => {
    const toggle = tier.querySelector(".policy-tier-toggle");
    toggle.addEventListener("click", () => {
      if (tier.dataset.state === "open") {
        // Closing tier 1 returns it to the partial view; others fully close.
        setTierState(tier, tierDefaultState(tier, index));
        // Keep the tier header in view when a long list collapses.
        tier.scrollIntoView({ block: "nearest", behavior: "smooth" });
      } else {
        setTierState(tier, "open");
      }
    });
    setTierState(tier, tierDefaultState(tier, index));
  });

  if (toggleAll) {
    toggleAll.addEventListener("click", () => {
      const open = allOpen();
      tiers.forEach((tier, index) => {
        setTierState(tier, open ? tierDefaultState(tier, index) : "open");
      });
      if (open) {
        root.scrollIntoView({ block: "start", behavior: "smooth" });
      }
    });
  }
}
