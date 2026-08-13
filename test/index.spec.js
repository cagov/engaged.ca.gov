import { test } from "@playwright/test";
import { checkA11y, injectAxe } from "axe-playwright";

const pageUrls = ["/", "/about/"];

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
