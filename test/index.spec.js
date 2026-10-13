import { test } from "@playwright/test";
import { checkA11y, injectAxe } from "axe-playwright";

const pageUrls = [
  "/",
  "/about/",
  "/ai-impact/report/",
  "/ai-impact/report-details/",
  "/es/ai-impact/report/",
  "/es/ai-impact/report-details/",
  "/fa/ai-impact/report/",
  "/fa/ai-impact/report-details/",
  "/ko/ai-impact/report/",
  "/ko/ai-impact/report-details/",
  "/tl/ai-impact/report/",
  "/tl/ai-impact/report-details/",
  "/vi/ai-impact/report/",
  "/vi/ai-impact/report-details/",
  "/zh-hans/ai-impact/report/",
  "/zh-hans/ai-impact/report-details/",
  "/zh-hant/ai-impact/report/",
  "/zh-hant/ai-impact/report-details/",
  "/hy/ai-impact/report/",
  "/hy/ai-impact/report-details/",
];

for (const pageUrl of pageUrls) {
  test(`a11y page tests ${pageUrl}`, async ({ page }) => {
    // Relative URL resolves against baseURL from playwright.config.js.
    await page.goto(pageUrl);
    await injectAxe(page);
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: { html: true },
    });
  });
}
