/**
 * AI impact report — page-specific JavaScript entry point.
 *
 * Bundled by esbuild to /js/ai-impact-report.js and only loaded by
 * site/_includes/mmmd-ai-impact-report.njk. Add new interactive modules
 * here as they are built.
 */
import { initConversationsRing } from "./conversations-ring.js";
import { initDemographicsChart } from "./demographics-chart.js";
import { initIdeasCloud } from "./ideas-cloud.js";
import { initParticipantFunnel } from "./participant-funnel.js";
import { initPolicyTiers } from "./policy-tiers.js";

function init() {
  initPolicyTiers(document.getElementById("policy-tiers"));
  initIdeasCloud(document.getElementById("ideas-cloud"));
  initParticipantFunnel(document.getElementById("participants-stepper"));
  initDemographicsChart(document.getElementById("demographics-chart"));
  initConversationsRing(document.getElementById("conversations-chart"));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
