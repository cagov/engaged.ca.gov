/**
 * AI impact report — page-specific JavaScript entry point.
 *
 * Bundled by esbuild to /js/ai-impact-report.js and only loaded by
 * site/_includes/mmmd-ai-impact-report.njk. Add new interactive modules
 * here as they are built. conversations-ring.js is kept but no longer
 * imported: The power of discussion section was removed 9/22.
 */
import { initDemographicsChart } from "./demographics-chart.js";
import { initIdeasCloud } from "./ideas-cloud.js";
import { initParticipantFunnel } from "./participant-funnel.js";
import { initPolicyTiers } from "./policy-tiers.js";
import { initTopThemes } from "./top-themes.js";

function init() {
  initTopThemes(document.getElementById("top-themes"));
  initPolicyTiers(document.getElementById("policy-tiers"));
  initIdeasCloud(document.getElementById("ideas-cloud"));
  initParticipantFunnel(document.getElementById("participants-stepper"));
  initDemographicsChart(document.getElementById("demographics-chart"));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
