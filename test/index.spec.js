import { test, expect } from "@playwright/test";
import { injectAxe, checkA11y } from "axe-playwright";

const testLocation = "http://localhost:8080";

const pageUrls = ["/", "/about/"];

for (const pageUrl of pageUrls) {
  test(`a11y page tests ${pageUrl}`, async ({ page }) => {
    await page.goto(testLocation + pageUrl);
    await injectAxe(page);
    await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: { html: true },
    });
  });
}
