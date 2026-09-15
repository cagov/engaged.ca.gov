/**
 * Who participated: horizontal stepper.
 *
 * Mockup stage. Each step is a static snapshot with two variants (Region /
 * Field of work). Left and right arrows move between steps; the segmented
 * toggle swaps the snapshot variant for the current step. The real chart will
 * replace the snapshots but should keep this navigation contract:
 *
 *   .participants-stepper[data-step]      current 1-based step index
 *   [data-last-step-only]                 shown only on the final step
 *   .participants-step[data-step]         one panel per step, hidden unless active
 *   [data-stepper-prev] / [data-stepper-next]
 *   .segmented-toggle-option[data-variant] "region" | "field"
 *   img[data-src-region][data-src-field]  swapped by variant
 */

function fill(template, values) {
  return (template || "").replace(/\{(\w+)\}/g, (_, key) =>
    key in values ? String(values[key]) : `{${key}}`,
  );
}

export function initParticipantsStepper(root) {
  if (!root) return;

  const steps = [...root.querySelectorAll(".participants-step")];
  const total = steps.length;
  if (total === 0) return;

  // The arrows, dots, and counter live in the section heading, outside `root`.
  const scope = root.closest("section") || document;
  const prev = scope.querySelector("[data-stepper-prev]");
  const next = scope.querySelector("[data-stepper-next]");
  const counter = scope.querySelector("[data-stepper-counter]");
  const counterTemplate = root.dataset.stepCounter || "{current} of {total}";
  const dots = [...scope.querySelectorAll(".stepper-dot")];

  let current = Number.parseInt(root.dataset.step, 10) || 1;
  let variant = root.dataset.variant || "region";

  root.classList.add("js-enabled");

  function render() {
    root.dataset.step = String(current);
    root.dataset.variant = variant;

    steps.forEach((step, index) => {
      const active = index + 1 === current;
      step.hidden = !active;
      step.setAttribute("aria-hidden", String(!active));
    });

    dots.forEach((dot, index) => {
      const active = index + 1 === current;
      dot.setAttribute("aria-current", active ? "step" : "false");
    });

    // Arrows disappear at either end rather than greying out, per the design.
    if (prev) prev.hidden = current <= 1;
    if (next) next.hidden = current >= total;

    for (const el of scope.querySelectorAll("[data-last-step-only]")) {
      el.hidden = current !== total;
    }
    if (counter)
      counter.textContent = fill(counterTemplate, { current, total });

    for (const button of root.querySelectorAll(".segmented-toggle-option")) {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.variant === variant),
      );
    }

    for (const img of root.querySelectorAll("img[data-src-region]")) {
      const src =
        variant === "field" ? img.dataset.srcField : img.dataset.srcRegion;
      if (src && img.getAttribute("src") !== src) img.setAttribute("src", src);
    }

    // The region legend only applies to the region variant. Field of work
    // categories are not yet defined.
    for (const legend of root.querySelectorAll(".region-legend")) {
      legend.hidden = variant !== "region";
    }
  }

  function go(delta) {
    const target = Math.min(total, Math.max(1, current + delta));
    if (target === current) return;
    current = target;
    render();
    // Keep focus on a usable control when the one just pressed disappears.
    if (delta > 0 && next?.hidden) prev?.focus();
    if (delta < 0 && prev?.hidden) next?.focus();
  }

  prev?.addEventListener("click", () => go(-1));
  next?.addEventListener("click", () => go(1));

  dots.forEach((dot, index) => {
    dot.addEventListener("click", () => {
      current = index + 1;
      render();
    });
  });

  for (const button of root.querySelectorAll(".segmented-toggle-option")) {
    button.disabled = false;
    button.addEventListener("click", () => {
      variant = button.dataset.variant === "field" ? "field" : "region";
      render();
    });
  }

  root.addEventListener("keydown", (event) => {
    if (event.target.closest(".segmented-toggle")) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      go(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(-1);
    }
  });

  render();
}
