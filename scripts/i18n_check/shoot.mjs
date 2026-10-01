// Usage: node shoot.mjs <url> <outprefix> [width]  — full page + element screenshots
import { chromium } from "@playwright/test";
const [url, out, width = "1280"] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: Number(width), height: 900 },
});
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
for (const sel of [
  "#ai-report-hero",
  ".hero-jump",
  "#public-forum",
  "#top-themes",
  "#policy-tiers",
  "#who-participated",
  "#stay-informed",
  "#demographics-chart",
  "#download-data",
  "#intro",
]) {
  const el = page.locator(sel).first();
  if (await el.count()) {
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await el.screenshot({ path: `${out}-${sel.replace(/[#.]/g, "")}.png` });
  }
}
await browser.close();
