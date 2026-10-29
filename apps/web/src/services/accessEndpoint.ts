import { ACCESS_WEBHOOK_URL, ACORN_API_BASE_URL, DEMO_MODE } from "../config/env";
import { AccessRequestRecord } from "../types/acorn";

export interface AccessRequestInput {
  email: string;
  careerStage: string;
  roleInterest?: string;
  preferredLocations?: string;
  goalsContext?: string;
}

export interface AccessRequestResult {
  ok: boolean;
  mode: "demo" | "live-endpoint";
  message: string;
  timestamp: string;
  record: AccessRequestRecord;
}

/**
 * Server-side endpoint abstraction for Request Access.
 * Validates inputs, never embeds service keys in client code, and clearly
 * distinguishes demo mode from durable server persistence.
 */
export async function submitAccessRequest(
  input: AccessRequestInput
): Promise<AccessRequestResult> {
  const email = input.email.trim();
  if (!email || !email.includes("@")) {
    throw new Error("Please enter a valid email address.");
  }

  const nowIso = new Date().toISOString();
  const record: AccessRequestRecord = {
    id: `req-${Date.now()}`,
    email,
    careerStage: input.careerStage,
    roleInterest: input.roleInterest?.trim() || "Software / Cloud / Tech",
    preferredLocations: input.preferredLocations?.trim() || "Toronto / GTA / Remote Canada",
    goalsContext: input.goalsContext?.trim() || "",
    status: "pending",
    createdAt: "Just now",
  };

  const targetUrl =
    ACCESS_WEBHOOK_URL ||
    (ACORN_API_BASE_URL
      ? `${ACORN_API_BASE_URL.replace(/\/$/, "")}/api/v1/access-requests`
      : undefined);

  if (!DEMO_MODE && targetUrl) {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: record.email,
        careerStage: record.careerStage,
        roleInterest: record.roleInterest,
        preferredLocations: record.preferredLocations,
        goalsContext: record.goalsContext,
        requestedAt: nowIso,
      }),
    });

    if (!response.ok) {
      throw new Error("Could not reach the access request service.");
    }

    return {
      ok: true,
      mode: "live-endpoint",
      message:
        "Your request has been recorded. Acorn will reach out with a single-use invitation key as private beta spots open.",
      timestamp: nowIso,
      record,
    };
  }

  await new Promise((resolve) => setTimeout(resolve, 350));
  return {
    ok: true,
    mode: "demo",
    message:
      "Demo Mode Acknowledgement: Your request was added to the local Founder Review Queue in this browser session. Sign in to the Founder Workspace to approve it and mint a single-use invitation key.",
    timestamp: nowIso,
    record,
  };
}
