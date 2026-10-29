import React, { useCallback, useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import {
  DEMO_ACTIVITY_TIMELINE,
  DEMO_OPPORTUNITY_SIGNALS,
  INITIAL_WATCH_PREFERENCES,
} from "./data/demoData";
import {
  AccessRequestRecord,
  ActivityItem,
  AuditLogEntry,
  AuthenticatedUser,
  IncomingSignalBatchEvent,
  InvitationKeyRecord,
  LegalModalDocument,
  OpportunitySignal,
  WatchPreferencesModel,
} from "./types/acorn";
import {
  generateCryptographicToken,
  sha256HexBrowser,
} from "./services/apiClient";
import { Navbar } from "./components/ui/Primitives";
import { HeroExperience } from "./components/product/HeroExperience";
import { BriefingSection } from "./components/product/BriefingAndSignals";
import { HowAcornWorks } from "./components/product/HowAcornWorks";
import { FitCheckExperience } from "./components/product/FitCheckExperience";
import {
  EverywhereSection,
  PrivacySection,
  RequestAccessModal,
} from "./components/product/EverywhereAndPrivacy";
import { ProductPrototypeShell } from "./components/product/ProductPrototypeShell";
import { DesignSystemPage } from "./pages/DesignSystemPage";
import { AcornMascot } from "./components/mascot/AcornMascot";
import { AcornLogo } from "./components/mascot/AcornLogo";
import { FounderAuthModal } from "./components/auth/FounderAccessAndAdmin";
import { LegalAndPrivacyModals } from "./components/legal/LegalAndPrivacyModals";

const INITIAL_DEMO_ACCESS_REQUESTS: AccessRequestRecord[] = [
  {
    id: "req-101",
    email: "maya.patel@utoronto.ca",
    careerStage: "Student / Co-op / New Grad",
    roleInterest: "Junior Software Engineer, Backend Developer",
    preferredLocations: "Toronto, ON · Mississauga, ON",
    goalsContext: "Looking for early-window backend roles before applicant counts spike.",
    status: "pending",
    createdAt: "Today · 6:50 AM",
  },
  {
    id: "req-102",
    email: "devon.cloud@waterloo.ca",
    careerStage: "Junior Developer / Cloud / IT (0–2 yrs)",
    roleInterest: "Junior DevOps Engineer, AWS Cloud Developer",
    preferredLocations: "Core GTA & Remote Canada",
    goalsContext: "Want honest fit checks on Terraform and Kubernetes requirements.",
    status: "pending",
    createdAt: "Yesterday · 8:15 PM",
  },
];

export const App: React.FC = () => {
  const [activeView, setActiveView] = useState<
    "story" | "app" | "design-system"
  >(() => {
    if (
      window.location.pathname === "/design-system" ||
      window.location.hash === "#/design-system"
    ) {
      return "design-system";
    }
    if (window.location.hash === "#/app") {
      return "app";
    }
    return "story";
  });

  const [signals, setSignals] = useState<OpportunitySignal[]>(
    DEMO_OPPORTUNITY_SIGNALS
  );
  const [selectedFitSignal, setSelectedFitSignal] =
    useState<OpportunitySignal>(DEMO_OPPORTUNITY_SIGNALS[0]);
  const [activities, setActivities] = useState<ActivityItem[]>(
    DEMO_ACTIVITY_TIMELINE
  );
  const [preferences, setPreferences] = useState<WatchPreferencesModel>(
    INITIAL_WATCH_PREFERENCES
  );
  const [memoryWiped, setMemoryWiped] = useState(false);

  // Modals & Legal Document state
  const [requestAccessOpen, setRequestAccessOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [legalDoc, setLegalDoc] = useState<LegalModalDocument>(null);

  // Founder Auth, Invitations, Access Requests & Audit Log state
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(
    null
  );
  const [accessRequests, setAccessRequests] = useState<AccessRequestRecord[]>(
    INITIAL_DEMO_ACCESS_REQUESTS
  );
  const [invitations, setInvitations] = useState<InvitationKeyRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([
    {
      id: "aud-init",
      timestamp: "7:44 AM",
      actor: "system",
      action: "INVITE_CREATED",
      target: "Invitation subsystem initialized (SHA-256 hashed storage)",
    },
  ]);

  // Mini-Acorn Scouts ("The scouts return") incoming event state (null on hydration)
  const [incomingSignalBatch, setIncomingSignalBatch] =
    useState<IncomingSignalBatchEvent | null>(null);

  useEffect(() => {
    const onHashChange = () => {
      if (window.location.hash === "#/design-system") {
        setActiveView("design-system");
      } else if (window.location.hash === "#/app") {
        setActiveView("app");
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const handleNavigateView = (view: "story" | "app" | "design-system") => {
    setActiveView(view);
    if (view === "design-system") {
      window.history.replaceState(null, "", "#/design-system");
    } else if (view === "app") {
      window.history.replaceState(null, "", "#/app");
    } else {
      window.history.replaceState(null, "", "#");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDismissSignal = (signalId: string) => {
    setSignals((prev) =>
      prev.map((s) => (s.id === signalId ? { ...s, status: "dismissed" } : s))
    );
  };

  const handleToggleSaveSignal = (signalId: string) => {
    setSignals((prev) =>
      prev.map((s) =>
        s.id === signalId
          ? { ...s, status: s.status === "saved" ? "unread" : "saved" }
          : s
      )
    );
  };

  const handleRestoreSignals = () => {
    setSignals(DEMO_OPPORTUNITY_SIGNALS);
  };

  const handleAddRole = (role: string) => {
    setMemoryWiped(false);
    setPreferences((prev) =>
      prev.roles.includes(role)
        ? prev
        : { ...prev, roles: [...prev.roles, role] }
    );
  };

  const handleRemoveRole = (role: string) => {
    setPreferences((prev) => ({
      ...prev,
      roles: prev.roles.filter((r) => r !== role),
    }));
  };

  // Triggers a genuine new Signal arrival and dispatches "The scouts return" animation
  const handleTriggerIncomingSignal = useCallback(() => {
    const batchId = `batch-${Date.now()}`;
    const newSignal: OpportunitySignal = {
      id: `sig-vespera-${Date.now()}`,
      title: "Junior Cloud Infrastructure Developer",
      company: "Vespera Civic Tech",
      location: "Toronto, ON",
      workMode: "Hybrid",
      source: "Direct Employer Feed (Demo)",
      sourceUrl: "#demo-vespera",
      postedAt: "Posted just now",
      discoveredAt: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      applicantCount: 2,
      applicantCountObserved: true,
      applicantCountSource: "Observed on listing card (Demo)",
      velocitySignal: "Early signal",
      velocityReason: "Scouts spotted this opening within 3 minutes of publication.",
      freshnessConfidence: "observed",
      summary:
        "Early Toronto cloud role matching your AWS, Python, Docker, and CI/CD watch rules.",
      fitReasons: [
        "Observed <5 applicants in Core GTA (Toronto Hybrid).",
        "Direct overlap with your AWS, Python, Docker, and GitHub Actions experience.",
      ],
      skillsMatched: ["AWS", "Python", "Docker", "CI/CD", "Linux"],
      skillsMissing: ["Terraform"],
      isRepost: false,
      status: "unread",
      fingerprint: `fp_${Date.now().toString(16).slice(0, 16)}`,
      demo: true,
    };

    setSignals((prev) => [newSignal, ...prev]);
    setActivities((prev) => [
      {
        id: `act-${Date.now()}`,
        timestamp: "Just now",
        action: "SCOUTS_RETURNED",
        reason: "Matched Junior Cloud Developer watch rule in Toronto.",
        userVisibleSummary:
          "Acorn's scouts returned with 1 new early opportunity at Vespera Civic Tech.",
        channel: "Acorn Engine",
        status: "completed",
        demo: true,
      },
      ...prev,
    ]);
    setIncomingSignalBatch({
      batchId,
      count: 1,
      headline: `${newSignal.title} · ${newSignal.company}`,
      triggeredAt: Date.now(),
    });
  }, []);

  // Founder Invitation Creation (stores only SHA-256 hash in state)
  const handleCreateInvitation = async (
    recipientEmail: string,
    expiresHours: number
  ): Promise<string> => {
    const rawKey = generateCryptographicToken("acrn_inv");
    const tokenHash = await sha256HexBrowser(rawKey);
    const keyPreview = `${rawKey.slice(0, 13)}…${rawKey.slice(-4)}`;
    const expiresAt = new Date(
      Date.now() + expiresHours * 3600 * 1000
    ).toISOString();

    const record: InvitationKeyRecord = {
      id: `inv-${Date.now()}`,
      recipientEmail,
      role: "member",
      keyPreview,
      tokenHash,
      status: "active",
      expiresAt,
      createdAt: new Date().toLocaleTimeString(),
    };

    setInvitations((prev) => [record, ...prev]);
    setAuditLogs((prev) => [
      {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        actor: currentUser?.email || "founder",
        action: "INVITE_CREATED",
        target: `${recipientEmail} (${keyPreview}, sha256:${tokenHash.slice(0, 10)}…)`,
      },
      ...prev,
    ]);
    return rawKey;
  };

  const handleApproveAccessRequest = async (
    requestId: string
  ): Promise<string> => {
    const target = accessRequests.find((r) => r.id === requestId);
    const rawKey = await handleCreateInvitation(
      target?.email || "invitee@domain.ca",
      72
    );
    setAccessRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: "approved",
              reviewedAt: new Date().toLocaleTimeString(),
            }
          : r
      )
    );
    setAuditLogs((prev) => [
      {
        id: `aud-${Date.now() + 1}`,
        timestamp: new Date().toLocaleTimeString(),
        actor: currentUser?.email || "founder",
        action: "ACCESS_REQUEST_APPROVED",
        target: target?.email || requestId,
      },
      ...prev,
    ]);
    return rawKey;
  };

  const handleDeclineAccessRequest = (requestId: string) => {
    setAccessRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, status: "declined" } : r))
    );
    setAuditLogs((prev) => [
      {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        actor: currentUser?.email || "founder",
        action: "ACCESS_REQUEST_DECLINED",
        target: requestId,
      },
      ...prev,
    ]);
  };

  const handleRevokeInvitation = (inviteId: string) => {
    setInvitations((prev) =>
      prev.map((inv) =>
        inv.id === inviteId ? { ...inv, status: "revoked" } : inv
      )
    );
    setAuditLogs((prev) => [
      {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        actor: currentUser?.email || "founder",
        action: "INVITE_REVOKED",
        target: inviteId,
      },
      ...prev,
    ]);
  };

  return (
    <div className="min-h-screen bg-[#0B0A08] text-[#FFF7EA] relative">
      <div
        className="fixed inset-0 pointer-events-none z-30 film-grain"
        aria-hidden="true"
      />

      <Navbar
        activeView={activeView}
        onNavigateView={handleNavigateView}
        onOpenRequestAccess={() => setRequestAccessOpen(true)}
        currentUser={currentUser}
        onOpenAuthModal={() => setAuthModalOpen(true)}
      />

      {activeView === "design-system" ? (
        <DesignSystemPage
          incomingSignalBatch={incomingSignalBatch}
          onTriggerScoutDemo={handleTriggerIncomingSignal}
        />
      ) : activeView === "app" ? (
        <ProductPrototypeShell
          signals={signals}
          activities={activities}
          preferences={preferences}
          currentUser={currentUser}
          accessRequests={accessRequests}
          invitations={invitations}
          auditLogs={auditLogs}
          incomingSignalBatch={incomingSignalBatch}
          onTriggerIncomingSignal={handleTriggerIncomingSignal}
          onOpenAuthModal={() => setAuthModalOpen(true)}
          onApproveRequest={handleApproveAccessRequest}
          onDeclineRequest={handleDeclineAccessRequest}
          onCreateInvitation={handleCreateInvitation}
          onRevokeInvitation={handleRevokeInvitation}
          onUpdateUser={(updatedUser, audit) => {
            setCurrentUser(updatedUser);
            setAuditLogs((prev) => [audit, ...prev]);
          }}
          onLogout={() => setCurrentUser(null)}
          onCheckFitSignal={(sig) => {
            setSelectedFitSignal(sig);
            handleNavigateView("story");
            window.setTimeout(() => {
              document
                .getElementById("fit-check")
                ?.scrollIntoView({ behavior: "smooth" });
            }, 120);
          }}
          onDismissSignal={handleDismissSignal}
          onToggleSaveSignal={handleToggleSaveSignal}
          onAddRole={handleAddRole}
          onRemoveRole={handleRemoveRole}
          onWipeMemory={() => setMemoryWiped(true)}
        />
      ) : (
        <main>
          <HeroExperience
            onMeetAcorn={() => handleNavigateView("app")}
            onOpenRequestAccess={() => setRequestAccessOpen(true)}
          />

          <BriefingSection
            signals={signals}
            onCheckFit={(sig) => setSelectedFitSignal(sig)}
            onDismissSignal={handleDismissSignal}
            onRestoreSignals={handleRestoreSignals}
            onToggleSaveSignal={handleToggleSaveSignal}
          />

          <HowAcornWorks />

          <FitCheckExperience
            signals={signals}
            selectedSignal={selectedFitSignal}
            onSelectSignal={setSelectedFitSignal}
          />

          <EverywhereSection />

          <PrivacySection
            preferences={preferences}
            onRemoveRole={handleRemoveRole}
            onWipeMemory={() => setMemoryWiped(true)}
            onRestoreMemory={() => {
              setMemoryWiped(false);
              setPreferences(INITIAL_WATCH_PREFERENCES);
            }}
            memoryWiped={memoryWiped}
          />

          {/* Website Closing Section */}
          <section
            aria-labelledby="closing-heading"
            className="relative py-28 sm:py-36 px-6 bg-[#0B0A08] border-t border-[#E39A58]/15 overflow-hidden text-center"
            style={{
              background:
                "radial-gradient(circle at 50% 75%, rgba(217, 255, 122, 0.1) 0%, rgba(168, 95, 45, 0.14) 38%, #0B0A08 75%)",
            }}
          >
            <div className="max-w-2xl mx-auto flex flex-col items-center">
              <AcornMascot state="watching" size={128} />

              <h2
                id="closing-heading"
                className="font-serif-editorial text-5xl sm:text-6xl md:text-7xl text-[#FFF7EA] mt-6 leading-[0.98]"
              >
                Let Acorn keep watch.
              </h2>

              <p className="mt-5 text-base sm:text-lg text-[#DECDB5] font-light">
                Your next opportunity doesn't need another tab.
              </p>

              <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => setRequestAccessOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-[#FFF7EA] hover:bg-[#D9FF7A] text-[#0B0A08] px-7 py-3.5 text-sm sm:text-base font-semibold transition-colors cursor-pointer"
                >
                  <span>Request Access</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigateView("app")}
                  className="inline-flex items-center gap-2 rounded-full border border-[#E39A58]/35 bg-[#21170F]/80 hover:bg-[#2E2015] text-[#FFF7EA] px-6 py-3.5 text-sm sm:text-base font-medium transition-colors cursor-pointer"
                >
                  <span>See Acorn in action</span>
                </button>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* Footer with Discoverable Legal, Cookie & Support Links */}
      <footer className="bg-[#080705] border-t border-white/10 py-14 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <AcornLogo variant="wordmark" size={28} />
            <p className="text-xs sm:text-sm text-[#DECDB5] mt-2">
              Personal career intelligence for Canada's tech market.
              Invitation-based access.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-xs sm:text-sm text-[#DECDB5]">
            <button
              type="button"
              onClick={() => handleNavigateView("story")}
              className="hover:text-[#FFF7EA] cursor-pointer"
            >
              Story
            </button>
            <button
              type="button"
              onClick={() => handleNavigateView("app")}
              className="hover:text-[#FFF7EA] cursor-pointer"
            >
              Workspace
            </button>
            <button
              type="button"
              onClick={() => handleNavigateView("design-system")}
              className="hover:text-[#FFF7EA] cursor-pointer"
            >
              Design System
            </button>
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="hover:text-[#D9FF7A] cursor-pointer"
            >
              {currentUser ? "Account / Admin" : "Founder & Invite Login"}
            </button>
            <button
              type="button"
              onClick={() => setLegalDoc("privacy")}
              className="hover:text-[#FFF7EA] cursor-pointer"
            >
              Privacy Policy
            </button>
            <button
              type="button"
              onClick={() => setLegalDoc("terms")}
              className="hover:text-[#FFF7EA] cursor-pointer"
            >
              Terms of Use
            </button>
            <button
              type="button"
              onClick={() => setLegalDoc("cookies")}
              className="hover:text-[#FFF7EA] cursor-pointer"
            >
              Cookie Preferences
            </button>
            <button
              type="button"
              onClick={() => setLegalDoc("contact")}
              className="hover:text-[#FFF7EA] cursor-pointer"
            >
              Contact &amp; Support
            </button>
          </div>
        </div>
      </footer>

      <RequestAccessModal
        isOpen={requestAccessOpen}
        onClose={() => setRequestAccessOpen(false)}
        onRequestSubmitted={(record) => {
          setAccessRequests((previous) => [record, ...previous]);
        }}
      />

      <FounderAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        activeInvitations={invitations}
        onMarkInviteRedeemed={(tokenHash) => {
          setInvitations((prev) =>
            prev.map((inv) =>
              inv.tokenHash === tokenHash
                ? {
                    ...inv,
                    status: "redeemed",
                    redeemedAt: new Date().toLocaleTimeString(),
                  }
                : inv
            )
          );
        }}
        onAuthenticated={(user, audit) => {
          setCurrentUser(user);
          setAuditLogs((prev) => [audit, ...prev]);
          handleNavigateView("app");
        }}
      />

      <LegalAndPrivacyModals
        activeDocument={legalDoc}
        onClose={() => setLegalDoc(null)}
      />
    </div>
  );
};

export default App;
