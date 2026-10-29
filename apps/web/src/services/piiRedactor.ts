/**
 * Client-Side TypeScript PII Redaction & Grounded Fit Check Engine
 * Mirrors src/acorn/domain/security.py from Acorn Engine v1 while strictly enforcing
 * the ABSOLUTE RESUME SAFETY RULE (Zero fabricated metrics or unconfirmed claims).
 */
import {
  FitCheckEvaluation,
  OpportunitySignal,
  PiiRedactionMatch,
  PiiRedactionResult,
  TruthfulBulletSuggestion,
} from "../types/acorn";

const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,7}\b/g;
const PHONE_REGEX = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g;
const POSTAL_CODE_REGEX =
  /\b[A-CEGHJ-NPRSTVXYa-ceghj-nprstvxy]\d[A-Za-z][ -]?\d[A-Za-z]\d\b/g;
const SIN_SSN_REGEX = /\b\d{3}[-\s]?\d{3}[-\s]?\d{3}\b/g;
const LINKEDIN_URL_REGEX =
  /https?:\/\/(?:www\.)?linkedin\.com\/(?:in|profile)\/[A-Za-z0-9_\-./]+/gi;

export const CANONICAL_TECH_KEYWORDS: string[] = [
  "TypeScript",
  "JavaScript",
  "Python",
  "Java",
  "SQL",
  "PostgreSQL",
  "AWS",
  "Azure",
  "GCP",
  "Docker",
  "Kubernetes",
  "Terraform",
  "CI/CD",
  "GitHub Actions",
  "REST APIs",
  "GraphQL",
  "Linux",
  "Git",
  "React",
  "Node.js",
  "Kafka",
  "Microservices",
];

export function redactPiiInBrowser(rawText: string): PiiRedactionResult {
  if (!rawText) {
    return {
      originalLength: 0,
      redactedText: "",
      totalRedacted: 0,
      matches: [],
    };
  }

  let emailCount = 0;
  let phoneCount = 0;
  let postalCount = 0;
  let sinCount = 0;
  let linkedinCount = 0;

  let sanitized = rawText.replace(EMAIL_REGEX, () => {
    emailCount += 1;
    return "[REDACTED_EMAIL]";
  });

  sanitized = sanitized.replace(LINKEDIN_URL_REGEX, () => {
    linkedinCount += 1;
    return "[REDACTED_LINKEDIN_URL]";
  });

  sanitized = sanitized.replace(POSTAL_CODE_REGEX, () => {
    postalCount += 1;
    return "[REDACTED_POSTAL_CODE]";
  });

  sanitized = sanitized.replace(SIN_SSN_REGEX, () => {
    sinCount += 1;
    return "[REDACTED_IDENTIFIER]";
  });

  sanitized = sanitized.replace(PHONE_REGEX, () => {
    phoneCount += 1;
    return "[REDACTED_PHONE]";
  });

  const matches: PiiRedactionMatch[] = [
    { category: "Email", placeholder: "[REDACTED_EMAIL]", count: emailCount },
    { category: "Phone", placeholder: "[REDACTED_PHONE]", count: phoneCount },
    {
      category: "Canadian Postal Code",
      placeholder: "[REDACTED_POSTAL_CODE]",
      count: postalCount,
    },
    {
      category: "SIN / Identifier",
      placeholder: "[REDACTED_IDENTIFIER]",
      count: sinCount,
    },
    {
      category: "LinkedIn URL",
      placeholder: "[REDACTED_LINKEDIN_URL]",
      count: linkedinCount,
    },
  ];

  const totalRedacted =
    emailCount + phoneCount + postalCount + sinCount + linkedinCount;

  return {
    originalLength: rawText.length,
    redactedText: sanitized,
    totalRedacted,
    matches,
  };
}

/**
 * Evaluates role fit using ONLY the PII-scrubbed resume text.
 * Enforces the Absolute Resume Safety Rule:
 * NEVER invents percentages, uptime, latency reductions, ticket volumes, or unconfirmed skills.
 */
export function evaluateTruthfulFitCheck(
  rawResumeText: string,
  targetSignal: OpportunitySignal
): FitCheckEvaluation {
  const piiReport = redactPiiInBrowser(rawResumeText);
  const cleanLower = piiReport.redactedText.toLowerCase();

  const targetSkills = Array.from(
    new Set([...targetSignal.skillsMatched, ...targetSignal.skillsMissing])
  );

  const strongAlignment: string[] = [];
  const worthStrengthening: string[] = [];

  for (const skill of targetSkills) {
    const normalized = skill.toLowerCase();
    const isPresent =
      cleanLower.includes(normalized) ||
      (normalized === "rest apis" &&
        (cleanLower.includes("rest api") || cleanLower.includes("restful"))) ||
      (normalized === "ci/cd" &&
        (cleanLower.includes("ci/cd") || cleanLower.includes("github actions")));

    if (isPresent) {
      strongAlignment.push(skill);
    } else {
      worthStrengthening.push(skill);
    }
  }

  const truthfulSuggestions: TruthfulBulletSuggestion[] = [];

  for (const missingSkill of worthStrengthening) {
    truthfulSuggestions.push({
      skill: missingSkill,
      status: "needs-confirmation",
      templateBullet: `Improved [measurable outcome you observed] by using ${missingSkill} to [specific action from your actual project or role].`,
      userGuidance: `Only include ${missingSkill} if you have genuinely used it in a project, lab, or role. Replace the bracketed placeholders with your real action and outcome—Acorn never invents metrics.`,
    });
  }

  for (const matchedSkill of strongAlignment.slice(0, 2)) {
    truthfulSuggestions.push({
      skill: matchedSkill,
      status: "evidence-found",
      templateBullet: `Built and maintained [component or service from your resume] using ${matchedSkill}, supporting [real team or project outcome you can verify].`,
      userGuidance: `${matchedSkill} is already present in your resume text. Tightening the phrasing around the concrete outcome makes it clearer to human reviewers.`,
    });
  }

  const headlineVerdict =
    strongAlignment.length >= Math.ceil(targetSkills.length / 2)
      ? "This role is worth a closer look."
      : "Some overlap, with a few core areas worth strengthening first.";

  const reasoningSummary =
    strongAlignment.length > 0
      ? `Your scrubbed resume text directly supports ${strongAlignment.join(", ")}. ${
          worthStrengthening.length > 0
            ? `${worthStrengthening.join(" and ")} ${
                worthStrengthening.length === 1 ? "is" : "are"
              } emphasized by ${targetSignal.company} but not explicit in the text above.`
            : "All primary technical areas for this posting are represented in your notes."
        }`
      : `Paste your current resume bullets above so Acorn can compare them against ${targetSignal.company}'s requirements after stripping personal identifiers.`;

  return {
    headlineVerdict,
    reasoningSummary,
    strongAlignment,
    worthStrengthening,
    piiReport,
    truthfulSuggestions,
  };
}
