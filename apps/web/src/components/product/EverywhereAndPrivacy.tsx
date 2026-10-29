import React, { useState } from "react";
import { useDialogFocus } from "../ui/useDialogFocus";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { ACORN_PLATFORMS, PlatformSurfaceConfig } from "../../config/platforms";
import { WatchPreferencesModel } from "../../types/acorn";
import { submitAccessRequest } from "../../services/accessEndpoint";
import { AcornMascot } from "../mascot/AcornMascot";
import { EditorialHeading, SectionLabel } from "../ui/Primitives";

export const EverywhereSection: React.FC = () => {
  const [selectedPlatform, setSelectedPlatform] =
    useState<PlatformSurfaceConfig>(ACORN_PLATFORMS[0]);

  const badgeStyleByAvailability = (
    avail: PlatformSurfaceConfig["availability"]
  ) => {
    switch (avail) {
      case "live-infrastructure":
        return "bg-[#72D65C]/20 text-[#D9FF7A] border-[#72D65C]/40";
      case "prototype":
        return "bg-[#6EC8FF]/20 text-[#6EC8FF] border-[#6EC8FF]/40";
      case "platform-dependent":
        return "bg-[#FF8E7D]/15 text-[#FF8E7D] border-[#FF8E7D]/35";
      default:
        return "bg-white/[0.06] text-[#FFF7EA]/65 border-white/15";
    }
  };

  return (
    <section
      id="everywhere"
      aria-labelledby="everywhere-heading"
      className="relative py-24 sm:py-32 px-6 bg-[#0E0B08] border-t border-[#E39A58]/10"
    >
      <div className="max-w-5xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <SectionLabel accent="violet">ACORN EVERYWHERE</SectionLabel>

          <EditorialHeading id="everywhere-heading" className="mt-5">
            One Acorn.
            <br />
            Wherever you are.
          </EditorialHeading>

          <p className="mt-5 text-base sm:text-lg text-[#FFF7EA]/75 font-light leading-relaxed">
            Acorn is designed to stay with your career across the places you
            already communicate.
          </p>
        </div>

        <div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-10"
          role="tablist"
          aria-label="Communication surfaces"
        >
          {ACORN_PLATFORMS.map((plat) => {
            const isSelected = plat.id === selectedPlatform.id;
            return (
              <button
                key={plat.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedPlatform(plat)}
                className={`text-left rounded-2xl p-4 transition-all cursor-pointer border ${
                  isSelected
                    ? "surface-bark border-[#E39A58] shadow-lg"
                    : "bg-[#14100C]/60 border-white/10 hover:border-[#E39A58]/35"
                }`}
              >
                <span className="block text-sm font-semibold text-[#FFF7EA]">
                  {plat.name}
                </span>
                <span
                  className={`inline-block mt-2 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border ${badgeStyleByAvailability(
                    plat.availability
                  )}`}
                >
                  {plat.status}
                </span>
              </button>
            );
          })}
        </div>

        <div className="surface-bark rounded-3xl p-6 sm:p-10 relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-5 flex flex-col items-center lg:items-start text-center lg:text-left space-y-4">
              <div className="flex items-center gap-4">
                <AcornMascot state="travel" size={108} />
                <div>
                  <span
                    className={`inline-block text-[11px] uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${badgeStyleByAvailability(
                      selectedPlatform.availability
                    )}`}
                  >
                    {selectedPlatform.status}
                  </span>
                  <h3 className="text-2xl font-semibold text-[#FFF7EA] mt-1.5">
                    Acorn on {selectedPlatform.name}
                  </h3>
                </div>
              </div>

              <p className="text-sm text-[#FFF7EA]/80 leading-relaxed">
                {selectedPlatform.tagline}
              </p>

              <div className="rounded-2xl bg-black/40 border border-white/10 p-3.5 text-xs text-[#FFF7EA]/60 leading-relaxed">
                <strong className="text-[#E39A58]">Status &amp; Guardrail:</strong>{" "}
                {selectedPlatform.guardrailNote}
              </div>
            </div>

            <div className="lg:col-span-7">
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedPlatform.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.28 }}
                  className="rounded-2xl bg-[#0B0A08]/90 border border-[#E39A58]/25 p-5 sm:p-6 space-y-4"
                >
                  <div className="flex items-center justify-between text-xs text-[#FFF7EA]/50 border-b border-white/10 pb-3">
                    <span className="inline-flex items-center gap-1.5">
                      <MessageCircle className="w-3.5 h-3.5 text-[#72D65C]" />
                      <span>
                        {selectedPlatform.name} Surface Preview (Natural Language
                        UX)
                      </span>
                    </span>
                    <span>Demo conversation</span>
                  </div>

                  <div className="space-y-2.5">
                    <p className="text-xs font-medium text-[#D9FF7A]">
                      Acorn: “{selectedPlatform.sampleExchange.acornIntro}”
                    </p>

                    <div className="surface-cream rounded-2xl p-4">
                      <div className="flex items-center justify-between text-xs text-[#6B4223]">
                        <span className="font-semibold">
                          {selectedPlatform.sampleExchange.roleCard.company}
                        </span>
                        <span>
                          {selectedPlatform.sampleExchange.roleCard.postedAt}
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-[#14110D] mt-0.5">
                        {selectedPlatform.sampleExchange.roleCard.title} ·{" "}
                        {selectedPlatform.sampleExchange.roleCard.location}
                      </h4>
                      <p className="text-xs text-[#2B1E14] mt-2 leading-relaxed">
                        “{selectedPlatform.sampleExchange.roleCard.reason}”
                      </p>
                      <div className="mt-3 pt-2.5 border-t border-[#A85F2D]/20 flex flex-wrap gap-2">
                        {["View role", "Check my fit", "Not for me"].map(
                          (act) => (
                            <span
                              key={act}
                              className="px-3 py-1 rounded-full bg-[#21170F] text-[#FFF7EA] text-[11px] font-medium"
                            >
                              {act}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <div className="rounded-2xl rounded-tr-sm bg-[#E39A58]/20 border border-[#E39A58]/40 px-4 py-2.5 text-xs sm:text-sm text-[#FFF7EA] max-w-md">
                      “{selectedPlatform.sampleExchange.userReply}”
                    </div>
                  </div>

                  <div className="rounded-2xl rounded-tl-sm bg-[#21170F] border border-[#72D65C]/30 px-4 py-3 text-xs sm:text-sm text-[#FFF7EA]/90 leading-relaxed">
                    {selectedPlatform.sampleExchange.acornFollowUp}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export interface PrivacySectionProps {
  preferences: WatchPreferencesModel;
  onRemoveRole: (role: string) => void;
  onWipeMemory: () => void;
  onRestoreMemory: () => void;
  memoryWiped: boolean;
}

export const PrivacySection: React.FC<PrivacySectionProps> = ({
  preferences,
  onRemoveRole,
  onWipeMemory,
  onRestoreMemory,
  memoryWiped,
}) => {
  const [activeTab, setActiveTab] = useState<
    "knows" | "uses" | "remembers" | "channels"
  >("knows");
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  return (
    <section
      id="privacy"
      aria-labelledby="privacy-heading"
      className="relative py-24 sm:py-32 px-6 bg-[#0B0A08] border-t border-[#E39A58]/10"
    >
      <div className="max-w-5xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <SectionLabel accent="sprout">PRIVACY &amp; CONTROL</SectionLabel>

          <EditorialHeading id="privacy-heading" className="mt-5">
            Your career is personal.
          </EditorialHeading>

          <p className="mt-5 text-base sm:text-lg text-[#FFF7EA]/75 font-light leading-relaxed">
            Acorn is designed to learn only what it needs to help you move.
          </p>
        </div>

        <div className="surface-bark rounded-3xl p-6 sm:p-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-4 flex flex-col items-center text-center p-6 rounded-2xl bg-[#0B0A08]/60 border border-[#E39A58]/15">
              <AcornMascot state="privacy" size={132} />
              <h3 className="text-lg font-semibold text-[#FFF7EA] mt-3">
                Sheltered by design
              </h3>
              <p className="text-xs text-[#FFF7EA]/65 mt-1.5 leading-relaxed">
                Acorn lowers its cap over your personal identifiers—stripping
                emails, phone numbers, postal codes, SINs, and LinkedIn URLs
                before evaluating role fit.
              </p>
            </div>

            <div className="lg:col-span-8 space-y-6">
              <div className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
                {(
                  [
                    { id: "knows", label: "What Acorn knows" },
                    { id: "uses", label: "What Acorn uses" },
                    { id: "remembers", label: "What Acorn remembers" },
                    { id: "channels", label: "Connected channels" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                      activeTab === t.id
                        ? "bg-[#FFF7EA] text-[#0B0A08] font-semibold"
                        : "bg-white/[0.05] text-[#FFF7EA]/70 hover:text-[#FFF7EA]"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {memoryWiped ? (
                <div className="rounded-2xl bg-black/45 border border-[#FF8E7D]/30 p-6 text-center space-y-3">
                  <p className="text-base font-medium text-[#FFF7EA]">
                    Your Acorn memory has been cleared in this demo session.
                  </p>
                  <p className="text-xs text-[#FFF7EA]/60">
                    Tracked roles, skills context, and recent conversation turns
                    have been wiped.
                  </p>
                  <button
                    type="button"
                    onClick={onRestoreMemory}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#E39A58] text-[#0B0A08] text-xs font-semibold cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore demo profile</span>
                  </button>
                </div>
              ) : (
                <div className="min-h-[190px]">
                  {activeTab === "knows" && (
                    <div className="space-y-4">
                      <p className="text-sm text-[#FFF7EA]/80">
                        You control the exact roles and skills Acorn watches. Tap
                        any role below to make Acorn forget it immediately:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {preferences.roles.map((role) => (
                          <span
                            key={role}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 border border-[#E39A58]/30 text-xs text-[#FFF7EA]"
                          >
                            <span>{role}</span>
                            <button
                              type="button"
                              onClick={() => onRemoveRole(role)}
                              aria-label={`Forget ${role}`}
                              className="text-[#FFF7EA]/50 hover:text-[#FF8E7D] cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === "uses" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className="rounded-2xl bg-black/40 border border-[#72D65C]/25 p-4 space-y-2">
                        <span className="font-semibold text-[#72D65C] uppercase tracking-wider block">
                          Used for Signal Matching
                        </span>
                        <ul className="space-y-1.5 text-[#FFF7EA]/85">
                          <li>• Target role titles &amp; seniority level</li>
                          <li>• Preferred Canadian cities &amp; remote mode</li>
                          <li>• Technical skills you confirm</li>
                        </ul>
                      </div>
                      <div className="rounded-2xl bg-black/40 border border-[#FF8E7D]/25 p-4 space-y-2">
                        <span className="font-semibold text-[#FF8E7D] uppercase tracking-wider block">
                          Stripped before Fit Check
                        </span>
                        <ul className="space-y-1.5 text-[#FFF7EA]/75">
                          <li>— Email addresses &amp; phone numbers</li>
                          <li>— Canadian postal codes</li>
                          <li>— SIN-like identifiers &amp; LinkedIn URLs</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {activeTab === "remembers" && (
                    <div className="rounded-2xl bg-black/40 border border-white/10 p-4 space-y-2 text-xs text-[#FFF7EA]/80 leading-relaxed">
                      <p>
                        <strong>In this Web Demo:</strong> Preferences and Fit
                        Check edits live in browser memory only.
                      </p>
                      <p>
                        <strong>In the Private Beta Telegram Engine:</strong>{" "}
                        Acorn retains up to 50 conversational turns in Cloudflare
                        Workers KV so you don't have to repeat your career
                        context, and purges them immediately when you ask Acorn
                        to forget.
                      </p>
                    </div>
                  )}

                  {activeTab === "channels" && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="rounded-2xl bg-black/40 border border-[#72D65C]/30 p-4">
                        <span className="text-[#D9FF7A] font-semibold block">
                          Telegram (@Acorn_ai_Bot)
                        </span>
                        <span className="text-[#FFF7EA]/65 mt-1 block">
                          Private beta infrastructure · Guarded by zero-trust
                          allowlist (`ALLOWED_CHAT_IDS`).
                        </span>
                      </div>
                      <div className="rounded-2xl bg-black/40 border border-white/10 p-4">
                        <span className="text-[#6EC8FF] font-semibold block">
                          Web Product Experience
                        </span>
                        <span className="text-[#FFF7EA]/65 mt-1 block">
                          Active client-side prototype session (Demo Mode).
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={onWipeMemory}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#FF8E7D]/15 hover:bg-[#FF8E7D]/25 border border-[#FF8E7D]/35 text-[#FF8E7D] text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete my data</span>
                  </button>

                  <button
                    type="button"
                    onClick={onRestoreMemory}
                    className="text-xs text-[#FFF7EA]/55 hover:text-[#FFF7EA] cursor-pointer"
                  >
                    Reset demo defaults
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowTechnicalDetails((prev) => !prev)}
                  className="text-xs text-[#E39A58] hover:underline cursor-pointer"
                >
                  {showTechnicalDetails
                    ? "Hide technical privacy architecture −"
                    : "How privacy works under the hood +"}
                </button>
              </div>

              <AnimatePresence initial={false}>
                {showTechnicalDetails && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="rounded-2xl bg-black/60 border border-white/10 p-4 text-xs text-[#FFF7EA]/70 space-y-1.5 font-mono">
                      <div>
                        • Regex Sanitization: Mirrors src/acorn/domain/security.py
                        (redact_pii)
                      </div>
                      <div>
                        • State Persistence: Atomic POSIX replacement
                        (AtomicJsonStateStore)
                      </div>
                      <div>
                        • Edge Sovereignty: /forget command invokes KV delete on
                        CHAT_HISTORY namespace
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export interface RequestAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestSubmitted?: (record: import("../../types/acorn").AccessRequestRecord) => void;
}

export const RequestAccessModal: React.FC<RequestAccessModalProps> = ({
  isOpen,
  onClose,
  onRequestSubmitted,
}) => {
  const dialogRef = useDialogFocus(isOpen);
  const [email, setEmail] = useState("");
  const [careerStage, setCareerStage] = useState("Student / Co-op / New Grad");
  const [roleInterest, setRoleInterest] = useState("");
  const [preferredLocations, setPreferredLocations] = useState(
    "Toronto, Mississauga & Remote Canada"
  );
  const [goalsContext, setGoalsContext] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await submitAccessRequest({
        email,
        careerStage,
        roleInterest,
        preferredLocations,
        goalsContext,
      });
      onRequestSubmitted?.(res.record);
      setResultMessage(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          role="dialog"
          ref={dialogRef}
          tabIndex={-1}
          aria-modal="true"
          aria-labelledby="request-access-modal-title"
        >
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            className="surface-bark w-full max-w-md rounded-3xl p-7 sm:p-8 relative max-h-[90vh] overflow-y-auto"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="touch-target-aa absolute top-5 right-5 text-[#DECDB5] hover:text-[#FFF7EA] p-1.5 rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <AcornMascot
                state={resultMessage ? "celebrate" : "watching"}
                size={64}
              />
              <div>
                <span className="text-[11px] uppercase tracking-[0.2em] text-[#D9FF7A]">
                  Invitation-Based Access
                </span>
                <h2
                  id="request-access-modal-title"
                  className="font-serif-editorial text-3xl text-[#FFF7EA]"
                >
                  Let Acorn keep watch.
                </h2>
              </div>
            </div>

            {resultMessage ? (
              <div className="space-y-4 pt-2">
                <div className="rounded-2xl bg-[#72D65C]/15 border border-[#72D65C]/40 p-4 text-xs sm:text-sm text-[#FFF7EA] leading-relaxed">
                  {resultMessage}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setResultMessage(null);
                    setEmail("");
                    setRoleInterest("");
                    setGoalsContext("");
                    onClose();
                  }}
                  className="w-full py-3 rounded-full bg-[#FFF7EA] text-[#0B0A08] text-sm font-semibold cursor-pointer"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label
                    htmlFor="req-email"
                    className="block text-xs text-[#DECDB5] mb-1"
                  >
                    Email address
                  </label>
                  <input
                    id="req-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.ca"
                    className="w-full rounded-xl bg-[#0B0A08] border border-white/15 px-3.5 py-2 text-sm text-[#FFF7EA]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="req-stage"
                    className="block text-xs text-[#DECDB5] mb-1"
                  >
                    Current career stage
                  </label>
                  <select
                    id="req-stage"
                    value={careerStage}
                    onChange={(e) => setCareerStage(e.target.value)}
                    className="w-full rounded-xl bg-[#0B0A08] border border-white/15 px-3.5 py-2 text-sm text-[#FFF7EA]"
                  >
                    <option>Student / Co-op / New Grad</option>
                    <option>Junior Developer / Cloud / IT (0–2 yrs)</option>
                    <option>Intermediate Engineer (2–5 yrs)</option>
                    <option>Career Transition into Tech</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="req-role"
                    className="block text-xs text-[#DECDB5] mb-1"
                  >
                    Interested roles
                  </label>
                  <input
                    id="req-role"
                    type="text"
                    value={roleInterest}
                    onChange={(e) => setRoleInterest(e.target.value)}
                    placeholder="e.g., Junior Software Engineer, Cloud/DevOps, IT Support"
                    className="w-full rounded-xl bg-[#0B0A08] border border-white/15 px-3.5 py-2 text-sm text-[#FFF7EA]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="req-locations"
                    className="block text-xs text-[#DECDB5] mb-1"
                  >
                    Preferred Canadian locations
                  </label>
                  <input
                    id="req-locations"
                    type="text"
                    value={preferredLocations}
                    onChange={(e) => setPreferredLocations(e.target.value)}
                    placeholder="e.g., Toronto, Mississauga, GTA, Remote Canada"
                    className="w-full rounded-xl bg-[#0B0A08] border border-white/15 px-3.5 py-2 text-sm text-[#FFF7EA]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="req-goals"
                    className="block text-xs text-[#DECDB5] mb-1"
                  >
                    What do you hope Acorn can help you with? (Optional)
                  </label>
                  <textarea
                    id="req-goals"
                    rows={2}
                    value={goalsContext}
                    onChange={(e) => setGoalsContext(e.target.value)}
                    placeholder="e.g., Catching early Toronto backend postings before saturation..."
                    className="w-full rounded-xl bg-[#0B0A08] border border-white/15 px-3.5 py-2 text-xs text-[#FFF7EA]"
                  />
                </div>

                {error && (
                  <p role="alert" className="text-xs text-[#FF8E7D]">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-full bg-[#FFF7EA] hover:bg-[#D9FF7A] text-[#0B0A08] font-semibold py-3 text-sm transition-colors cursor-pointer"
                >
                  {submitting ? "Submitting..." : "Request Access ↗"}
                </button>

                <p className="text-[11px] text-[#DECDB5] text-center">
                  Running in client-side Demo Mode unless a production webhook
                  is configured.
                </p>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
