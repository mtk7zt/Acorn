# Acorn Product & UX Specification

### 1. Product Philosophy
Acorn is a living personal career intelligence companion—not a job board, not an ATS percentage calculator, and not a high-noise dashboard.
- **Signal, not search:** Users do not scroll paginated job feeds; Acorn curates a small Morning Briefing of timely signals.
- **Reasons before scores:** Every surfaced opportunity explains why it matters in natural language (`fitReasons`, `velocityReason`).
- **Preparation, not fabrication:** Fit Check helps candidates articulate real experience without ever inventing metrics.

### 2. OpportunitySignal Data Contract & Truthfulness Rules
All surfaced opportunities conform to the `OpportunitySignal` TypeScript interface (`apps/web/src/types/acorn.ts`):
- `applicantCount?: number` and `applicantCountObserved: boolean`: Applicant counts are rendered **if and only if** `applicantCountObserved === true` and `typeof applicantCount === 'number'`. When a job board (e.g., Job Bank Canada or a direct career portal) does not expose an applicant count, `applicantCountObserved` is `false` and the UI displays truthful freshness indicators (“Early signal”, “Posted 8 min ago”, “Discovered early”).
- `demo: boolean`: All synthetic demonstration postings set `demo: true`, use fictional company names (*Northstar Labs*, *Portage Cloud Systems*, *Kestrel Telemetry*), and render a clear `Demo signal` pill so users are never misled into thinking synthetic listings are live openings.

### 3. Fit Check & Absolute Resume Safety Rule
1. **In-Browser PII Scrubbing Preview:** Before running Fit Check in the web demo, users can inspect the exact regex sanitization (`[REDACTED_EMAIL]`, `[REDACTED_PHONE]`, `[REDACTED_POSTAL_CODE]`, `[REDACTED_IDENTIFIER]`, `[REDACTED_LINKEDIN_URL]`).
2. **Qualitative Alignment First:** Highlights `Strong alignment` (`skillsMatched`) and `Worth strengthening` (`skillsMissing`).
3. **Zero Fabrication Rule:** When helping a candidate prepare bullets for a skill in `skillsMissing` or `skillsMatched`, Acorn never invents percentages, uptime figures, ticket volumes, revenue, or unconfirmed tools. Suggested bullets use explicit user-supplied context and bracketed placeholders:

> “Improved `[measurable outcome you observed]` by using **Terraform** to `[specific action from your actual project or role]`.”

### 4. Activity & Explainable Autonomy
Autonomous background work is logged to the `Activity` timeline with human-readable explanations (`timestamp`, `action`, `reason`, `userVisibleSummary`, `channel`, `status`). Discovery is autonomous; job application submission always remains 100% user-controlled.
