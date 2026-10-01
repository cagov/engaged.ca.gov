// Usage: node dump-text.mjs <url> [width]
import { chromium } from "@playwright/test";
const [url, width = "1280"] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: Number(width), height: 900 },
});
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
// Toggle funnel to Field of work and cycle demographics dims so JS-built text appears.
const out = await page.evaluate(async () => {
  const lines = [];
  const grab = (label) => {
    const main = document.querySelector("main") || document.body;
    lines.push(`===== ${label}`);
    lines.push(main.innerText);
    for (const el of main.querySelectorAll(
      "[aria-label],[alt],[title],[aria-roledescription]",
    )) {
      for (const a of ["aria-label", "alt", "title", "aria-roledescription"]) {
        const v = el.getAttribute(a);
        if (v) lines.push(`[${a}] ${v}`);
      }
    }
    for (const t of main.querySelectorAll("svg title, table"))
      lines.push(
        `[svg/table] ${t.textContent.replace(/\s+/g, " ").slice(0, 400)}`,
      );
  };
  grab("initial");
  const field = document.querySelector(
    '.segmented-toggle-option[data-variant="field"]',
  );
  if (field) {
    field.click();
    await new Promise((r) => setTimeout(r, 300));
    lines.push("===== funnel legend (field)");
    lines.push(document.querySelector("[data-funnel-legend]")?.innerText);
  }
  const sel = document.querySelector("[data-demographics-select]");
  if (sel) {
    for (const o of [...sel.options]) {
      sel.value = o.value;
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 200));
      lines.push(`===== demographics ${o.value}`);
      lines.push(document.querySelector("[data-demographics-svg]")?.innerText);
      lines.push(
        document
          .querySelector("[data-demographics-svg] svg")
          ?.getAttribute("aria-label"),
      );
      lines.push(
        [...document.querySelectorAll("[data-demographics-svg] svg title")]
          .slice(0, 2)
          .map((t) => t.textContent)
          .join(" | "),
      );
      lines.push(
        document
          .querySelector("[data-demographics-table]")
          ?.innerText.slice(0, 300),
      );
    }
  }
  return lines.join("\n");
});
console.log(out);
await browser.close();
