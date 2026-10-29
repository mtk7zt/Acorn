import React, { useState } from "react";
import {
  Activity,
  Compass,
  KeyRound,
  Plus,
  Send,
  Sparkles,
  Sun,
  User,
  X,
} from "lucide-react";
import {
  AccessRequestRecord,
  ActivityItem,
  AuditLogEntry,
  AuthenticatedUser,
  IncomingSignalBatchEvent,
  InvitationKeyRecord,
  OpportunitySignal,
  WatchPreferencesModel,
} from "../../types/acorn";
import { mapNaturalLanguageToAcornEngine } from "../../channels/adapters";
import { AcornMascot } from "../mascot/AcornMascot";
import { MiniAcornScouts } from "../mascot/MiniAcornScouts";
import { AcornAvatar } from "../mascot/AcornLogo";
import { SignalCard } from "./BriefingAndSignals";
import { FounderAdminPanel } from "../auth/FounderAccessAndAdmin";

export type PrototypeTab = "Briefing" | "Signals" | "Acorn" | "Activity" | "You";

export interface ProductPrototypeShellProps {
  signals: OpportunitySignal[];
  activities: ActivityItem[];
  preferences: WatchPreferencesModel;
  currentUser?: AuthenticatedUser | null;
  accessRequests?: AccessRequestRecord[];
  invitations?: InvitationKeyRecord[];
  auditLogs?: AuditLogEntry[];
  incomingSignalBatch?: IncomingSignalBatchEvent | null;
  onTriggerIncomingSignal?: () => void;
  onOpenAuthModal?: () => void;
  onApproveRequest?: (requestId: string) => Promise<string>;
  onDeclineRequest?: (requestId: string) => void;
  onCreateInvitation?: (email: string, expiresHours: number) => Promise<string>;
  onRevokeInvitation?: (inviteId: string) => void;
  onUpdateUser?: (updated: AuthenticatedUser, audit: AuditLogEntry) => void;
  onLogout?: () => void;
  onCheckFitSignal: (signal: OpportunitySignal) => void;
  onDismissSignal: (id: string) => void;
  onToggleSaveSignal: (id: string) => void;
  onAddRole: (role: string) => void;
  onRemoveRole: (role: string) => void;
  onWipeMemory: () => void;
}

export const ProductPrototypeShell: React.FC<ProductPrototypeShellProps> = ({
  signals,
  activities,
  preferences,
  currentUser,
  accessRequests = [],
  invitations = [],
  auditLogs = [],
  incomingSignalBatch = null,
  onTriggerIncomingSignal,
  onOpenAuthModal,
  onApproveRequest,
  onDeclineRequest,
  onCreateInvitation,
  onRevokeInvitation,
  onUpdateUser,
  onLogout,
  onCheckFitSignal,
  onDismissSignal,
  onToggleSaveSignal,
  onAddRole,
  onRemoveRole,
  onWipeMemory,
}) => {
  const [activeTab, setActiveTab] = useState<PrototypeTab>("Briefing");
  const [signalFilter, setSignalFilter] = useState<"all" | "early" | "saved">(
    "all"
  );
  const [expandedSignalId, setExpandedSignalId] = useState<string>(
    signals[0]?.id || ""
  );
  const [newRoleInput, setNewRoleInput] = useState("");

  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState<
    { id: string; sender: "acorn" | "user"; text: string }[]
  >([
    {
      id: "m-1",
      sender: "acorn",
      text: `Good morning, ${
        currentUser?.displayName || preferences.userName
      }. I kept watch overnight and found ${
        signals.filter((s) => s.status !== "dismissed").length
      } timely signals. Ask me what's worth your attention, change what I'm watching, or check your fit.`,
    },
  ]);

  const handleSendChat = (promptText?: string) => {
    const text = (promptText ?? chatInput).trim();
    if (!text) return;
    setChatInput("");

    const userMsg = {
      id: `u-${Date.now()}`,
      sender: "user" as const,
      text,
    };

    const engineResponse = mapNaturalLanguageToAcornEngine(text);
    if (
      engineResponse.mappedEngineCommand === "ADD_ROLE" &&
      text.toLowerCase().includes("devops")
    ) {
      onAddRole("Junior DevOps Engineer");
    }

    const acornMsg = {
      id: `a-${Date.now() + 1}`,
      sender: "acorn" as const,
      text: engineResponse.naturalReply,
    };

    setMessages((prev) => [...prev, userMsg, acornMsg]);
  };

  const filteredSignals = signals.filter((s) => {
    if (s.status === "dismissed") return false;
    if (signalFilter === "early") return s.velocitySignal === "Early signal";
    if (signalFilter === "saved") return s.status === "saved";
    return true;
  });

  const TABS: {
    id: PrototypeTab;
    label: string;
    icon: React.FC<{ className?: string }>;
  }[] = [
    { id: "Briefing", label: "Briefing", icon: Sun },
    { id: "Signals", label: "Signals", icon: Compass },
    { id: "Acorn", label: "Acorn", icon: Sparkles },
    { id: "Activity", label: "Activity", icon: Activity },
    { id: "You", label: "You", icon: User },
  ];

  return (
    <section
      aria-label="Acorn App Workspace"
      className="min-h-screen pt-24 pb-28 px-4 sm:px-6 bg-[#0B0A08]"
    >
      <div className="max-w-6xl mx-auto">
        <div className="surface-bark rounded-3xl p-5 sm:p-6 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <AcornAvatar state="watching" size={46} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-semibold text-[#FFF7EA]">
                  Acorn Workspace
                </h1>
                <span className="text-[11px] uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#D9FF7A]/15 text-[#D9FF7A] border border-[#D9FF7A]/30">
                  {currentUser
                    ? `${currentUser.role.toUpperCase()} · ${currentUser.sessionMode}`
                    : "Product Prototype · Demo"}
                </span>
              </div>
              <p className="text-xs text-[#DECDB5] mt-0.5">
                Watching {preferences.roles.length} roles across Core GTA, Outer
                GTA &amp; Remote Canada
              </p>
            </div>
          </div>

          <div
            className="hidden md:flex items-center gap-1.5 bg-[#0B0A08]/80 p-1.5 rounded-full border border-white/10"
            role="tablist"
          >
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(t.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? "bg-[#FFF7EA] text-[#0B0A08]"
                      : "text-[#DECDB5] hover:text-[#FFF7EA]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="surface-bark rounded-3xl p-6 sm:p-9 min-h-[540px]">
          {activeTab === "Briefing" && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
                <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                  <MiniAcornScouts
                    incomingEvent={incomingSignalBatch}
                    baseState="briefing"
                    size={84}
                  />
                  <div>
                    <h2 className="font-serif-editorial text-3xl sm:text-4xl text-[#FFF7EA]">
                      Good morning,{" "}
                      {currentUser?.displayName || preferences.userName}.
                    </h2>
                    <p className="text-sm text-[#D9FF7A] mt-0.5">
                      I kept watch. Here is what deserves your attention today.
                    </p>
                  </div>
                </div>

                {onTriggerIncomingSignal && (
                  <button
                    type="button"
                    onClick={onTriggerIncomingSignal}
                    className="self-start sm:self-center inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#21170F] hover:bg-[#2E2015] border border-[#D9FF7A]/40 text-xs font-semibold text-[#D9FF7A] transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Simulate New Signal (Scouts Return)</span>
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {signals
                  .filter((s) => s.status !== "dismissed")
                  .slice(0, 3)
                  .map((sig, i) => (
                    <SignalCard
                      key={sig.id}
                      signal={sig}
                      featured={i === 0}
                      isExpanded={expandedSignalId === sig.id}
                      onToggleExpand={() =>
                        setExpandedSignalId((prev) =>
                          prev === sig.id ? "" : sig.id
                        )
                      }
                      onCheckFit={onCheckFitSignal}
                      onDismiss={onDismissSignal}
                      onToggleSave={onToggleSaveSignal}
                    />
                  ))}
              </div>
            </div>
          )}

          {activeTab === "Signals" && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-white/10">
                <div>
                  <h2 className="font-serif-editorial text-3xl text-[#FFF7EA]">
                    Opportunity Signals
                  </h2>
                  <p className="text-xs text-[#DECDB5] mt-0.5">
                    Curated openings with transparent timing and fit reasons.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {(
                    [
                      { id: "all", label: "All Signals" },
                      { id: "early", label: "Early signals" },
                      { id: "saved", label: "Saved" },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setSignalFilter(f.id)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium cursor-pointer ${
                        signalFilter === f.id
                          ? "bg-[#E39A58] text-[#0B0A08] font-semibold"
                          : "bg-white/[0.05] text-[#DECDB5]"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredSignals.length === 0 ? (
                <div className="py-14 text-center space-y-3">
                  <AcornMascot state="empty" size={88} />
                  <p className="text-base text-[#FFF7EA]">
                    No signals in this filter right now.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredSignals.map((sig) => (
                    <SignalCard
                      key={sig.id}
                      signal={sig}
                      isExpanded={expandedSignalId === sig.id}
                      onToggleExpand={() =>
                        setExpandedSignalId((prev) =>
                          prev === sig.id ? "" : sig.id
                        )
                      }
                      onCheckFit={onCheckFitSignal}
                      onDismiss={onDismissSignal}
                      onToggleSave={onToggleSaveSignal}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "Acorn" && (
            <div className="flex flex-col h-[500px] justify-between">
              <div className="flex items-center gap-3 pb-4 border-b border-white/10">
                <AcornMascot state="thinking" size={58} />
                <div>
                  <h2 className="text-lg font-semibold text-[#FFF7EA]">
                    Talk with Acorn
                  </h2>
                  <p className="text-xs text-[#DECDB5]">
                    Natural conversation—no slash commands needed.
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${
                      m.sender === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-lg rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        m.sender === "user"
                          ? "bg-[#E39A58] text-[#0B0A08] font-medium rounded-tr-sm"
                          : "bg-[#0B0A08]/85 border border-[#E39A58]/25 text-[#FFF7EA] rounded-tl-sm"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-white/10 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {[
                    "What are you watching for me?",
                    "Add junior DevOps roles.",
                    "What did you do today?",
                    "Check my fit.",
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleSendChat(chip)}
                      className="px-3 py-1 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs text-[#D9FF7A] cursor-pointer"
                    >
                      “{chip}”
                    </button>
                  ))}
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendChat();
                  }}
                  className="flex items-center gap-2"
                >
                  <label htmlFor="acorn-chat-input" className="sr-only">
                    Ask Acorn anything about your roles or signals
                  </label>
                  <input
                    id="acorn-chat-input"
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask Acorn anything about your roles or signals..."
                    className="flex-1 rounded-full bg-[#0B0A08] border border-white/15 px-4 py-2.5 text-sm text-[#FFF7EA]"
                  />
                  <button
                    type="submit"
                    className="p-2.5 rounded-full bg-[#FFF7EA] hover:bg-[#D9FF7A] text-[#0B0A08] cursor-pointer"
                    aria-label="Send message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>
          )}

          {activeTab === "Activity" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <AcornMascot state="sleepWatch" size={64} />
                  <div>
                    <h2 className="font-serif-editorial text-3xl text-[#FFF7EA]">
                      Acorn Activity
                    </h2>
                    <p className="text-xs text-[#DECDB5]">
                      Explainable background work in plain human language (Demo
                      timeline).
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {activities.map((act) => (
                  <div
                    key={act.id}
                    className="rounded-2xl bg-[#0B0A08]/70 border border-white/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-mono text-[#D9FF7A]">
                          {act.timestamp}
                        </span>
                        <span className="text-sm font-medium text-[#FFF7EA]">
                          “{act.userVisibleSummary}”
                        </span>
                      </div>
                      <p className="text-xs text-[#DECDB5]">{act.reason}</p>
                    </div>
                    <span className="text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[#E39A58] self-start sm:self-center">
                      {act.channel} · Demo
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "You" && (
            <div className="space-y-8">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
                <div>
                  <h2 className="font-serif-editorial text-3xl text-[#FFF7EA]">
                    Your Watch, Account &amp; Privacy Preferences
                  </h2>
                  <p className="text-xs text-[#DECDB5] mt-0.5">
                    Configure what Acorn watches, link Telegram, or manage
                    invitations.
                  </p>
                </div>

                {!currentUser && onOpenAuthModal && (
                  <button
                    type="button"
                    onClick={onOpenAuthModal}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#E39A58] text-[#0B0A08] text-xs font-semibold cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Founder Sign In / Redeem Invite Key</span>
                  </button>
                )}
              </div>

              {currentUser &&
                onApproveRequest &&
                onDeclineRequest &&
                onCreateInvitation &&
                onRevokeInvitation &&
                onUpdateUser &&
                onLogout && (
                  <FounderAdminPanel
                    user={currentUser}
                    accessRequests={accessRequests}
                    invitations={invitations}
                    auditLogs={auditLogs}
                    onApproveRequest={onApproveRequest}
                    onDeclineRequest={onDeclineRequest}
                    onCreateInvitation={onCreateInvitation}
                    onRevokeInvitation={onRevokeInvitation}
                    onUpdateUser={onUpdateUser}
                    onLogout={onLogout}
                  />
                )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-2xl bg-[#0B0A08]/60 border border-white/10 p-5 space-y-4">
                  <h3 className="text-xs uppercase tracking-[0.18em] text-[#E39A58] font-semibold">
                    Roles Being Watched ({preferences.roles.length})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {preferences.roles.map((r) => (
                      <span
                        key={r}
                        className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-[#21170F] border border-[#E39A58]/30 text-xs text-[#FFF7EA]"
                      >
                        <span>{r}</span>
                        <button
                          type="button"
                          onClick={() => onRemoveRole(r)}
                          className="touch-target-aa text-[#DECDB5] hover:text-[#FF8E7D] cursor-pointer"
                          aria-label={`Remove ${r}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (newRoleInput.trim()) {
                        onAddRole(newRoleInput.trim());
                        setNewRoleInput("");
                      }
                    }}
                    className="flex gap-2 pt-2"
                  >
                    <label htmlFor="add-watch-role-input" className="sr-only">
                      Add role to watch list
                    </label>
                    <input
                      id="add-watch-role-input"
                      type="text"
                      value={newRoleInput}
                      onChange={(e) => setNewRoleInput(e.target.value)}
                      placeholder="Add role (e.g. Junior DevOps Engineer)"
                      className="flex-1 rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-[#FFF7EA]"
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-2 rounded-xl bg-[#E39A58] text-[#0B0A08] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </form>
                </div>

                <div className="rounded-2xl bg-[#0B0A08]/60 border border-white/10 p-5 space-y-3 text-xs">
                  <h3 className="text-xs uppercase tracking-[0.18em] text-[#72D65C] font-semibold">
                    Locations, Seniority &amp; Privacy
                  </h3>
                  <div>
                    <span className="text-[#DECDB5] block">Locations:</span>
                    <span className="text-[#FFF7EA] font-medium">
                      {preferences.locations.join(" · ")}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#DECDB5] block">Seniority:</span>
                    <span className="text-[#FFF7EA] font-medium">
                      {preferences.seniority}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#DECDB5] block">
                      Core Skills Context:
                    </span>
                    <span className="text-[#D9FF7A] font-medium">
                      {preferences.skillsContext.join(", ")}
                    </span>
                  </div>
                  <div className="pt-3 border-t border-white/10">
                    <button
                      type="button"
                      onClick={onWipeMemory}
                      className="px-4 py-2 rounded-full bg-[#FF8E7D]/15 border border-[#FF8E7D]/40 text-[#FF8E7D] font-semibold cursor-pointer"
                    >
                      Forget my data in this session
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Mobile App Prototype Navigation"
        className="md:hidden fixed bottom-4 inset-x-4 z-40 liquid-glass rounded-full px-3 py-2 grid grid-cols-5 gap-1"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex flex-col items-center justify-center py-1.5 rounded-full text-[11px] font-medium cursor-pointer ${
                active
                  ? "bg-[#FFF7EA] text-[#0B0A08] font-semibold"
                  : "text-[#DECDB5]"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="mt-0.5">{t.label}</span>
            </button>
          );
        })}
      </nav>
    </section>
  );
};
