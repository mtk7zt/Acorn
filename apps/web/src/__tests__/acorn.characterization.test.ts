/**
 * Characterization & Regression Tests for Acorn Web Experience
 * Verifies:
 * 1. Client-side PII redaction across all 5 identifier categories
 * 2. Absolute Resume Safety Rule (zero fabricated percentages or metrics)
 * 3. Natural language to Acorn Engine v1 command mapping
 */
import { redactPiiInBrowser, evaluateTruthfulFitCheck } from "../services/piiRedactor";
import { DEMO_OPPORTUNITY_SIGNALS, SAMPLE_CANDIDATE_RESUME } from "../data/demoData";
import { mapNaturalLanguageToAcornEngine } from "../channels/adapters";

export function runAcornFrontendCharacterizationSuite(): void {
  // 1. Verify all 5 PII categories are scrubbed
  const piiResult = redactPiiInBrowser(SAMPLE_CANDIDATE_RESUME);
  if (piiResult.totalRedacted < 5) {
    throw new Error(`Expected >= 5 redacted identifiers, got ${piiResult.totalRedacted}`);
  }
  if (
    piiResult.redactedText.includes("sosa.candidate@example.ca") ||
    piiResult.redactedText.includes("M5V 2T6") ||
    piiResult.redactedText.includes("123-456-789")
  ) {
    throw new Error("PII leak detected in redacted output!");
  }

  // 2. Verify Absolute Resume Safety Rule (Never invent percentages or metrics)
  const fitEval = evaluateTruthfulFitCheck(
    SAMPLE_CANDIDATE_RESUME,
    DEMO_OPPORTUNITY_SIGNALS[0]
  );
  for (const suggestion of fitEval.truthfulSuggestions) {
    if (/\d+%|\b99\.9%\b|\b35%\b|\b45\+\b/.test(suggestion.templateBullet)) {
      throw new Error(
        `Fabricated metric detected in resume suggestion: ${suggestion.templateBullet}`
      );
    }
    if (!suggestion.templateBullet.includes("[")) {
      throw new Error("Missing explicit user-confirmation placeholder in suggestion.");
    }
  }

  // 3. Verify natural language command mapping preserves Acorn Engine v1 compatibility
  const rolesIntent = mapNaturalLanguageToAcornEngine("What are you watching for me?");
  if (rolesIntent.mappedEngineCommand !== "/roles") {
    throw new Error("Expected 'What are you watching for me?' to map to /roles");
  }

  const wipeIntent = mapNaturalLanguageToAcornEngine("Forget my resume and delete my data");
  if (wipeIntent.mappedEngineCommand !== "/forget") {
    throw new Error("Expected forget prompt to map to /forget");
  }
}
