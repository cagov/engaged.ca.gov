/**
 * AI impact report — page-specific JavaScript entry point.
 *
 * Bundled by esbuild to /js/ai-impact-report.js and only loaded by
 * site/_includes/mmmd-ai-impact-report.njk. Add new interactive modules
 * here as they are built (dots chart, conversations chart, sortition chart).
 */
import { initParticipantsStepper } from "./participants-stepper.js";
import { initPolicyTiers } from "./policy-tiers.js";

function init() {
  initPolicyTiers(document.getElementById("policy-tiers"));
  initParticipantsStepper(document.getElementById("participants-stepper"));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
