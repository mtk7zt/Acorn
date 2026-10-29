import {
  ActivityItem,
  OpportunitySignal,
  WatchPreferencesModel,
} from "../types/acorn";

export const DEMO_OPPORTUNITY_SIGNALS: OpportunitySignal[] = [
  {
    id: "sig-northstar-se",
    title: "Software Engineer",
    company: "Northstar Labs",
    location: "Toronto, ON",
    workMode: "Hybrid",
    source: "Direct Career Portal (Demo)",
    sourceUrl: "#demo-signal-northstar",
    postedAt: "Posted 8 min ago",
    discoveredAt: "7:44 AM EDT",
    // Applicant count is NOT observed on this source — never invent a number
    applicantCount: undefined,
    applicantCountObserved: false,
    velocitySignal: "Early signal",
    velocityReason: "Detected within 10 minutes of publication on a Canadian product engineering team.",
    freshnessConfidence: "high",
    summary:
      "Strong alignment with the TypeScript, AWS and product engineering work you're targeting.",
    fitReasons: [
      "Core stack centres on TypeScript, Node.js, REST APIs, and AWS microservices.",
      "Explicitly scoped for early-career / junior-to-intermediate engineers without senior management bloat.",
      "Hybrid team based in downtown Toronto (Priority 1 Core GTA match).",
    ],
    skillsMatched: ["TypeScript", "AWS", "REST APIs", "CI/CD", "Docker"],
    skillsMissing: ["Terraform", "Kubernetes"],
    isRepost: false,
    status: "unread",
    fingerprint: "fp_9a4d2c8e11047b31",
    demo: true,
  },
  {
    id: "sig-portage-cloud",
    title: "Junior Cloud & Platform Developer",
    company: "Portage Cloud Systems",
    location: "Mississauga, ON",
    workMode: "Hybrid",
    source: "LinkedIn Guest Feed (Demo)",
    sourceUrl: "#demo-signal-portage",
    postedAt: "Posted 6 min ago",
    discoveredAt: "7:44 AM EDT",
    // Applicant count IS explicitly observed in this synthetic demo example
    applicantCount: 3,
    applicantCountObserved: true,
    applicantCountSource: "Observed on listing metadata (Demo)",
    velocitySignal: "Early signal",
    velocityReason: "Observed early window (<5 applicants) shortly after initial publication.",
    freshnessConfidence: "observed",
    summary:
      "Direct match for your AWS Cloud Junior Developer watch rule in Mississauga.",
    fitReasons: [
      "Focuses on Python automation, Docker containers, and AWS IAM/EC2 workflows.",
      "Located in Mississauga (Core GTA Priority 1) with 2 days on-site.",
      "Includes mentorship structure for entry-level cloud developers.",
    ],
    skillsMatched: ["Python", "AWS", "Docker", "Linux", "Git"],
    skillsMissing: ["Terraform"],
    isRepost: false,
    status: "unread",
    fingerprint: "fp_3c7f81a290d4e512",
    demo: true,
  },
  {
    id: "sig-kestrel-backend",
    title: "Backend Application Developer",
    company: "Kestrel Telemetry",
    location: "Remote, Canada",
    workMode: "Remote",
    source: "Job Bank Canada Format (Demo)",
    sourceUrl: "#demo-signal-kestrel",
    postedAt: "Discovered early",
    discoveredAt: "7:18 AM EDT",
    applicantCount: undefined,
    applicantCountObserved: false,
    velocitySignal: "Timely window",
    velocityReason: "Published this morning with verified Canada-wide remote eligibility.",
    freshnessConfidence: "high",
    summary:
      "True-remote Canadian backend role working with Python, PostgreSQL, and event pipelines.",
    fitReasons: [
      "Confirmed Canada-wide remote role (passes True-Remote jurisdiction check).",
      "Strong overlap with your Python, SQL, and API design experience.",
      "Zero repost history detected across tracked boards.",
    ],
    skillsMatched: ["Python", "PostgreSQL", "SQL", "REST APIs", "GitHub Actions"],
    skillsMissing: ["Kafka", "Kubernetes"],
    isRepost: false,
    status: "saved",
    fingerprint: "fp_7e12b904c8a3119f",
    demo: true,
  },
];

export const DEMO_FILTERED_NOISE_EXAMPLES = [
  {
    id: "noise-1",
    title: "Staff Principal Distributed Architect (10+ yrs)",
    reason: "Ignored: Seniority mismatch",
  },
  {
    id: "noise-2",
    title: "Software Engineer — San Francisco, CA (On-site)",
    reason: "Ignored: Outside Canadian jurisdiction (California suffix)",
  },
  {
    id: "noise-3",
    title: "Full Stack Developer (Reposted 4 times)",
    reason: "Ignored: Reposted / saturated listing",
  },
  {
    id: "noise-4",
    title: "Enterprise Account Executive — SaaS",
    reason: "Ignored: Non-technical occupational role",
  },
];

export const DEMO_ACTIVITY_TIMELINE: ActivityItem[] = [
  {
    id: "act-1",
    timestamp: "7:44 AM",
    action: "SURFACED_SIGNALS",
    reason: "Matched TypeScript/AWS and Cloud watch rules with early publication timing.",
    userVisibleSummary: "Brought you two early opportunities in Toronto and Mississauga.",
    channel: "Acorn Engine",
    status: "completed",
    demo: true,
  },
  {
    id: "act-2",
    timestamp: "7:43 AM",
    action: "FILTERED_NOISE",
    reason: "Excluded senior-only titles, reposted listings, and non-Canadian locations.",
    userVisibleSummary: "Filtered opportunities that didn't match your goals or location.",
    channel: "Acorn Engine",
    status: "filtered",
    demo: true,
  },
  {
    id: "act-3",
    timestamp: "7:42 AM",
    action: "OVERNIGHT_WATCH",
    reason: "Scheduled background watch across tracked Canadian tech sources.",
    userVisibleSummary: "Looked across your tracked roles while you were offline.",
    channel: "Acorn Engine",
    status: "completed",
    demo: true,
  },
  {
    id: "act-4",
    timestamp: "Yesterday",
    action: "PREFERENCE_UPDATED",
    reason: "User conversational instruction via Acorn.",
    userVisibleSummary: "You asked me to stop watching Help Desk roles and focus on Cloud & Backend.",
    channel: "Telegram",
    status: "user-approved",
    demo: true,
  },
];

export const INITIAL_WATCH_PREFERENCES: WatchPreferencesModel = {
  userName: "Sosa",
  roles: [
    "Junior Software Engineer",
    "Software Engineer Intern",
    "AWS Cloud Junior Developer",
    "Junior Cloud Developer",
    "Java Developer",
    "Application Support Analyst",
  ],
  locations: [
    "Toronto, ON (Core GTA)",
    "Mississauga, ON (Core GTA)",
    "Surrounding GTA (Oakville, Brampton, Markham, Vaughan)",
    "Remote Canada",
  ],
  remotePreference: "Hybrid & Remote Canada",
  seniority: "Intern / New Grad / Junior",
  skillsContext: [
    "TypeScript",
    "Python",
    "AWS",
    "REST APIs",
    "Docker",
    "PostgreSQL",
    "CI/CD",
    "Git",
  ],
  excludedKeywords: ["Senior", "Staff", "Principal", "Director", "Manager"],
  notificationCadence: "Immediate early signals + Morning Briefing",
  personality: "calm",
};

export const SAMPLE_CANDIDATE_RESUME = `Sosa Emokpae
Email: sosa.candidate@example.ca | Phone: +1 (416) 555-0192
Location: Mississauga, ON M5V 2T6 | SIN: 123-456-789
LinkedIn: https://www.linkedin.com/in/sosa-demo-profile

EXPERIENCE & PROJECTS
Software & Cloud Engineering Projects
- Built backend REST APIs using TypeScript, Node.js, and Python with PostgreSQL data models.
- Configured Docker containers and automated CI/CD test workflows using GitHub Actions.
- Deployed cloud services on AWS and maintained Linux server configurations.
- Collaborated in Agile sprints using Git for version control and code reviews.`;
