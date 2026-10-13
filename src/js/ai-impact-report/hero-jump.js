/**
 * Jump bar under the hero: once the links no longer fit on one row they
 * stack, one per line, indented under the "Jump to:" label (9/29). CSS
 * cannot see a flex wrap, so this measures: drop the stacked class, check
 * whether every link shares the first link's top, and put it back if not.
 */
export function initHeroJump(nav) {
  if (!nav) return;
  const list = nav.querySelector("ul");
  if (!list) return;
  const items = [...list.children];
  if (items.length < 2) return;

  const update = () => {
    nav.classList.remove("is-stacked");
    const top = items[0].offsetTop;
    const wraps = items.some((li) => li.offsetTop !== top);
    nav.classList.toggle("is-stacked", wraps);
  };

  update();
  if ("ResizeObserver" in window) {
    let width = nav.clientWidth;
    new ResizeObserver(() => {
      // Width only: the stack itself changes the bar's height.
      if (nav.clientWidth === width) return;
      width = nav.clientWidth;
      update();
    }).observe(nav);
  } else {
    window.addEventListener("resize", update);
  }
  // Web fonts can widen the links after first paint.
  document.fonts?.ready.then(update);
}
