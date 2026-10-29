import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, ShieldCheck, Sparkles, Check, AlertCircle } from "lucide-react";
import { OpportunitySignal } from "../../types/acorn";
import { evaluateTruthfulFitCheck } from "../../services/piiRedactor";
import { SAMPLE_CANDIDATE_RESUME } from "../../data/demoData";
import { AcornMascot } from "../mascot/AcornMascot";
import { EditorialHeading, SectionLabel } from "../ui/Primitives";

export interface FitCheckExperienceProps {
  signals: OpportunitySignal[];
  selectedSignal: OpportunitySignal;
  onSelectSignal: (signal: OpportunitySignal) => void;
}

export const FitCheckExperience: React.FC<FitCheckExperienceProps> = ({
  signals,
  selectedSignal,
  onSelectSignal,
}) => {
  const [resumeText, setResumeText] = useState<string>(SAMPLE_CANDIDATE_RESUME);
  const [showRedactedPreview, setShowRedactedPreview] = useState<boolean>(true);
  const [showPrepareBullets, setShowPrepareBullets] = useState<boolean>(false);

  const evaluation = useMemo(
    () => evaluateTruthfulFitCheck(resumeText, selectedSignal),
    [resumeText, selectedSignal]
  );

  return (
    <section
      id="fit-check"
      aria-labelledby="fit-check-heading"
      className="relative py-24 sm:py-32 px-6 bg-[#0B0A08]"
    >
      <div className="max-w-5xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <SectionLabel accent="sky">FIT CHECK &amp; PREPARATION</SectionLabel>

          <EditorialHeading id="fit-check-heading" className="mt-5">
            Know before you spend the application.
          </EditorialHeading>

          <p className="mt-5 text-base sm:text-lg text-[#FFF7EA]/75 font-light leading-relaxed">
            Acorn compares your real experience against the role after stripping
            personal identifiers in-browser—giving you honest reasons and never
            inventing achievements.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
          <span className="text-xs uppercase tracking-wider text-[#FFF7EA]/50 mr-2">
            Checking fit for:
          </span>
          {signals.map((sig) => {
            const active = sig.id === selectedSignal.id;
            return (
              <button
                key={sig.id}
                type="button"
                onClick={() => onSelectSignal(sig)}
                className={`px-4 py-2 rounded-full text-xs sm:text-sm font-medium transition-all cursor-pointer border ${
                  active
                    ? "bg-[#E39A58] text-[#0B0A08] border-[#E39A58] font-semibold"
                    : "surface-bark text-[#FFF7EA]/75 border-white/10 hover:text-[#FFF7EA]"
                }`}
              >
                {sig.title} · {sig.company}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Resume Input + Client-Side PII Redaction Preview */}
          <div className="lg:col-span-6 surface-bark rounded-3xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#72D65C]" />
                <h3 className="text-sm uppercase tracking-[0.18em] font-semibold text-[#FFF7EA]">
                  1. Your Resume Notes (Client-Side Demo)
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setResumeText(SAMPLE_CANDIDATE_RESUME)}
                className="text-xs text-[#E39A58] hover:underline cursor-pointer"
              >
                Reset sample
              </button>
            </div>

            <p className="text-xs text-[#FFF7EA]/65 leading-relaxed">
              Personal identifiers are stripped before fit analysis. In this
              demo mode, scrubbing runs 100% inside your browser and nothing is
              transmitted.
            </p>

            <div>
              <label htmlFor="fit-check-resume-input" className="sr-only">
                Paste resume text for Fit Check
              </label>
              <textarea
                id="fit-check-resume-input"
                rows={7}
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                className="w-full rounded-2xl bg-[#0B0A08]/90 border border-[#E39A58]/25 p-4 text-xs sm:text-sm font-mono text-[#FFF7EA] focus:outline-none focus:border-[#D9FF7A]"
                placeholder="Paste your resume summary or project bullets..."
              />
            </div>

            <div className="rounded-2xl bg-[#0B0A08]/75 border border-white/10 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#72D65C]">
                  {evaluation.piiReport.totalRedacted} personal identifier
                  {evaluation.piiReport.totalRedacted === 1 ? "" : "s"} redacted
                  before analysis
                </span>

                <button
                  type="button"
                  onClick={() => setShowRedactedPreview((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 text-xs text-[#6EC8FF] hover:underline cursor-pointer"
                >
                  {showRedactedPreview ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>Hide redacted preview</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview what is redacted</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {evaluation.piiReport.matches.map((m) => (
                  <span
                    key={m.category}
                    className={`text-[11px] px-2.5 py-0.5 rounded-full border ${
                      m.count > 0
                        ? "bg-[#72D65C]/15 border-[#72D65C]/40 text-[#D9FF7A]"
                        : "bg-white/[0.03] border-white/10 text-[#FFF7EA]/40"
                    }`}
                  >
                    {m.category}: {m.count}
                  </span>
                ))}
              </div>

              <AnimatePresence initial={false}>
                {showRedactedPreview && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <pre className="mt-2 p-3 rounded-xl bg-black/60 border border-[#72D65C]/25 text-[11px] font-mono text-[#FFF7EA]/80 whitespace-pre-wrap leading-relaxed max-h-44 overflow-y-auto">
                      {evaluation.piiReport.redactedText}
                    </pre>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right Column: Reason-First Fit Verdict & Truthful Preparation */}
          <div className="lg:col-span-6 surface-cream rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="flex items-start justify-between gap-4 border-b border-[#A85F2D]/20 pb-5">
              <div>
                <span className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[#6B4223]">
                  Acorn Fit Assessment · {selectedSignal.company} (Demo)
                </span>
                <h3 className="font-serif-editorial text-3xl sm:text-4xl text-[#14110D] mt-1">
                  “{evaluation.headlineVerdict}”
                </h3>
                <p className="text-xs sm:text-sm text-[#3D2B1D] mt-2 leading-relaxed">
                  {evaluation.reasoningSummary}
                </p>
              </div>
              <AcornMascot
                state={
                  evaluation.worthStrengthening.length > 2
                    ? "concerned"
                    : "fitCheck"
                }
                size={76}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl bg-[#21170F]/6 border border-[#21170F]/12 p-4">
                <span className="text-xs uppercase tracking-wider font-semibold text-[#1F4718] block mb-2.5">
                  Strong alignment
                </span>
                {evaluation.strongAlignment.length > 0 ? (
                  <ul className="space-y-1.5">
                    {evaluation.strongAlignment.map((skill) => (
                      <li
                        key={skill}
                        className="flex items-center gap-2 text-sm font-medium text-[#14110D]"
                      >
                        <Check className="w-4 h-4 text-[#2E6F23]" />
                        <span>{skill}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-[#5A3E28]">
                    Add matching skills to your notes to see alignment.
                  </p>
                )}
              </div>

              <div className="rounded-2xl bg-[#A85F2D]/10 border border-[#A85F2D]/25 p-4">
                <span className="text-xs uppercase tracking-wider font-semibold text-[#7A3516] block mb-2.5">
                  Worth strengthening
                </span>
                {evaluation.worthStrengthening.length > 0 ? (
                  <ul className="space-y-1.5">
                    {evaluation.worthStrengthening.map((skill) => (
                      <li
                        key={skill}
                        className="flex items-center gap-2 text-sm font-medium text-[#2B180D]"
                      >
                        <AlertCircle className="w-4 h-4 text-[#A85F2D]" />
                        <span>{skill}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-[#2E5A23] font-medium">
                    Every core skill for this role is represented in your notes.
                  </p>
                )}
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowPrepareBullets((prev) => !prev)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#21170F] hover:bg-[#332216] text-[#FFF7EA] py-3.5 px-6 text-sm font-semibold transition-colors cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-[#D9FF7A]" />
                <span>
                  {showPrepareBullets
                    ? "Hide preparation templates"
                    : "Prepare for this role"}
                </span>
              </button>

              <AnimatePresence initial={false}>
                {showPrepareBullets && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-5 space-y-3 pt-4 border-t border-[#A85F2D]/20">
                      <div className="rounded-xl bg-[#21170F] text-[#FFF7EA] p-3.5 text-xs leading-relaxed">
                        <strong className="text-[#D9FF7A]">
                          Truthful Resume Principle:
                        </strong>{" "}
                        Acorn improves articulation and never fabricates
                        experience, percentages, uptime, or ticket volumes. Fill
                        in the bracketed placeholders only with outcomes you can
                        stand behind in an interview.
                      </div>

                      {evaluation.truthfulSuggestions.map((item) => (
                        <div
                          key={item.skill}
                          className="rounded-2xl bg-white/80 border border-[#A85F2D]/25 p-4 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-[#6B4223]">
                              {item.skill}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#A85F2D]/15 text-[#4A2B13] font-medium">
                              {item.status === "evidence-found"
                                ? "Found in your resume"
                                : "Requires your confirmation"}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-[#14110D] leading-relaxed">
                            “{item.templateBullet}”
                          </p>
                          <p className="text-xs text-[#5A3E28]">
                            {item.userGuidance}
                          </p>
                        </div>
                      ))}
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
