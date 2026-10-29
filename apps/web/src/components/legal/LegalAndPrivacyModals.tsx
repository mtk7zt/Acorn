import React, { useEffect, useState } from "react";
import { useDialogFocus } from "../ui/useDialogFocus";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X } from "lucide-react";
import { LegalModalDocument } from "../../types/acorn";
import { AcornMascot } from "../mascot/AcornMascot";

export interface LegalAndPrivacyModalsProps {
  activeDocument: LegalModalDocument;
  onClose: () => void;
}

export const LegalAndPrivacyModals: React.FC<LegalAndPrivacyModalsProps> = ({
  activeDocument,
  onClose,
}) => {
  const dialogRef = useDialogFocus(Boolean(activeDocument));
  const [optionalPreferencesStorage, setOptionalPreferencesStorage] =
    useState<boolean>(() => {
      try {
        return localStorage.getItem("acorn_optional_storage") === "true";
      } catch {
        return false;
      }
    });
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (!activeDocument) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeDocument, onClose]);

  const handleSaveCookiePrefs = (allowOptional: boolean) => {
    setOptionalPreferencesStorage(allowOptional);
    try {
      if (allowOptional) {
        localStorage.setItem("acorn_optional_storage", "true");
      } else {
        localStorage.removeItem("acorn_optional_storage");
      }
    } catch {
      // Ignore storage errors in private browsing
    }
    setSavedNotice(true);
    window.setTimeout(() => setSavedNotice(false), 2500);
  };

  return (
    <AnimatePresence>
      {activeDocument && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          role="dialog"
          ref={dialogRef}
          tabIndex={-1}
          aria-modal="true"
          aria-labelledby="legal-modal-title"
        >
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            className="surface-bark w-full max-w-2xl rounded-3xl p-6 sm:p-8 relative max-h-[85vh] overflow-y-auto"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close policy dialog"
              className="touch-target-aa absolute top-5 right-5 text-[#DECDB5] hover:text-[#FFF7EA] p-1.5 rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {activeDocument === "privacy" && (
              <div className="space-y-4 text-sm text-[#DECDB5] leading-relaxed">
                <div className="flex items-center gap-3">
                  <AcornMascot state="privacy" size={56} />
                  <div>
                    <span className="text-[11px] uppercase tracking-[0.2em] text-[#72D65C]">
                      Draft for Legal Review · Actual Platform Practices
                    </span>
                    <h2
                      id="legal-modal-title"
                      className="font-serif-editorial text-3xl text-[#FFF7EA]"
                    >
                      Privacy Policy
                    </h2>
                  </div>
                </div>

                <p>
                  <strong className="text-[#FFF7EA]">1. Data Minimization:</strong>{" "}
                  Acorn collects only the career preferences you explicitly
                  configure (target role titles, preferred Canadian locations,
                  seniority, and technical skills) and, if you request access,
                  your email address and career stage.
                </p>
                <p>
                  <strong className="text-[#FFF7EA]">
                    2. Resume Fit Check &amp; PII Redaction:
                  </strong>{" "}
                  In the web product experience (Demo Mode), resume text pasted
                  into Fit Check is scrubbed of email addresses, phone numbers,
                  Canadian postal codes, SIN patterns, and LinkedIn profile URLs
                  100% locally in your browser JavaScript runtime. In the
                  private beta Telegram edge worker, PII redaction occurs in
                  transient Cloudflare V8 isolate RAM prior to keyword matching,
                  and raw resume text is never written to disk or Cloudflare KV.
                </p>
                <p>
                  <strong className="text-[#FFF7EA]">
                    3. Third-Party Processors:
                  </strong>{" "}
                  Acorn uses Cloudflare Workers &amp; Workers KV (edge session
                  and up to 50 conversational turns), GitHub Actions (scheduled
                  Canadian job board harvesting), Telegram Bot API (optional
                  linked notifications), and Google Gemini Flash (conversational
                  intent parsing on sanitized inputs).
                </p>
                <p>
                  <strong className="text-[#FFF7EA]">
                    4. Data Deletion &amp; Sovereignty:
                  </strong>{" "}
                  You may purge your session memory at any time using{" "}
                  <em>Delete my data</em> on the web or <code>/forget</code> in
                  Telegram.
                </p>
              </div>
            )}

            {activeDocument === "terms" && (
              <div className="space-y-4 text-sm text-[#DECDB5] leading-relaxed">
                <span className="text-[11px] uppercase tracking-[0.2em] text-[#E39A58]">
                  Draft for Legal Review
                </span>
                <h2
                  id="legal-modal-title"
                  className="font-serif-editorial text-3xl text-[#FFF7EA]"
                >
                  Terms of Use
                </h2>
                <p>
                  <strong className="text-[#FFF7EA]">
                    1. Invitation-Based Service:
                  </strong>{" "}
                  Acorn AI is an invitation-based career intelligence companion
                  for the Canadian technology market. Invitations are
                  single-use, time-limited, and revocable.
                </p>
                <p>
                  <strong className="text-[#FFF7EA]">
                    2. User-Controlled Applications:
                  </strong>{" "}
                  Acorn discovers and evaluates job opportunities autonomously,
                  but never submits job applications on your behalf without your
                  direct action, and never fabricates resume metrics.
                </p>
                <p>
                  <strong className="text-[#FFF7EA]">
                    3. No Warranty on External Listings:
                  </strong>{" "}
                  External job postings originate from third-party employers and
                  job boards. Demonstration signals in Demo Mode are synthetic
                  and clearly labeled with <code>Demo signal</code>.
                </p>
              </div>
            )}

            {activeDocument === "cookies" && (
              <div className="space-y-4 text-sm text-[#DECDB5] leading-relaxed">
                <span className="text-[11px] uppercase tracking-[0.2em] text-[#D9FF7A]">
                  Storage &amp; Cookie Audit
                </span>
                <h2
                  id="legal-modal-title"
                  className="font-serif-editorial text-3xl text-[#FFF7EA]"
                >
                  Cookie &amp; Browser Storage Preferences
                </h2>
                <p>
                  Acorn does <strong>not</strong> use third-party advertising
                  cookies, cross-site tracking pixels, or behavioral ad
                  networks. Consequently, we do not interrupt your visit with a
                  manipulative cookie wall.
                </p>

                <div className="rounded-2xl bg-black/50 border border-white/10 p-4 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <strong className="text-[#FFF7EA] block">
                        Strictly Necessary Session Storage
                      </strong>
                      <span>
                        Used only when you sign in with an invitation key or
                        founder session.
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-white/10 text-[#D9FF7A]">
                      Always Active
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-white/10">
                    <div>
                      <strong className="text-[#FFF7EA] block">
                        Optional Local Preference Persistence
                      </strong>
                      <span>
                        Remembers your watched roles and reduced-motion toggle
                        in browser <code>localStorage</code> between visits.
                      </span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={optionalPreferencesStorage}
                      onClick={() =>
                        handleSaveCookiePrefs(!optionalPreferencesStorage)
                      }
                      className={`px-3.5 py-1.5 rounded-full font-semibold cursor-pointer ${
                        optionalPreferencesStorage
                          ? "bg-[#72D65C] text-[#0B0A08]"
                          : "bg-white/10 text-[#FFF7EA]"
                      }`}
                    >
                      {optionalPreferencesStorage ? "Enabled" : "Off (Memory Only)"}
                    </button>
                  </div>
                </div>

                {savedNotice && (
                  <p className="text-xs text-[#72D65C] flex items-center gap-1.5">
                    <Check className="w-4 h-4" />
                    <span>Storage preference updated.</span>
                  </p>
                )}
              </div>
            )}

            {activeDocument === "contact" && (
              <div className="space-y-4 text-sm text-[#DECDB5] leading-relaxed">
                <span className="text-[11px] uppercase tracking-[0.2em] text-[#6EC8FF]">
                  Support &amp; Security Disclosure
                </span>
                <h2
                  id="legal-modal-title"
                  className="font-serif-editorial text-3xl text-[#FFF7EA]"
                >
                  Contact &amp; Support
                </h2>
                <p>
                  For private beta invitation inquiries, data deletion requests,
                  or security disclosures:
                </p>
                <div className="rounded-2xl bg-black/50 border border-white/10 p-4 space-y-2 text-xs font-mono">
                  <div>
                    • Security &amp; Privacy:{" "}
                    <span className="text-[#D9FF7A]">security@mtk7zt.dev</span>
                  </div>
                  <div>
                    • Repository &amp; Issues:{" "}
                    <a
                      href="https://github.com/mtk7zt/Acorn"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#6EC8FF] underline"
                    >
                      github.com/mtk7zt/Acorn
                    </a>
                  </div>
                  <div>
                    • Private Beta Bot:{" "}
                    <span className="text-[#E39A58]">
                      @Acorn_ai_Bot (Authorized Invitees Only)
                    </span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
