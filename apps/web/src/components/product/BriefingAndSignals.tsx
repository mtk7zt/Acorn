import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { OpportunitySignal } from "../../types/acorn";
import { AcornMascot } from "../mascot/AcornMascot";
import { EditorialHeading, SectionLabel } from "../ui/Primitives";

export interface SignalCardProps {
  signal: OpportunitySignal;
  featured?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onCheckFit: (signal: OpportunitySignal) => void;
  onDismiss?: (signalId: string) => void;
  onToggleSave?: (signalId: string) => void;
}

export const SignalCard: React.FC<SignalCardProps> = ({
  signal,
  featured = false,
  isExpanded = false,
  onToggleExpand,
  onCheckFit,
  onDismiss,
  onToggleSave,
}) => {
  const isSaved = signal.status === "saved";

  return (
    <div
      className={`rounded-3xl transition-all overflow-hidden ${
        featured
          ? "surface-cream p-6 sm:p-8"
          : "surface-bark p-6 sm:p-7 text-[#FFF7EA]"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
              featured
                ? "bg-[#21170F] text-[#D9FF7A]"
                : "bg-[#D9FF7A]/15 text-[#D9FF7A] border border-[#D9FF7A]/30"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#D9FF7A]" />
            <span>{signal.velocitySignal}</span>
          </span>

          <span
            className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
              featured
                ? "bg-[#A85F2D]/12 text-[#21170F]/80"
                : "bg-white/[0.05] text-[#6EC8FF]"
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>{signal.postedAt}</span>
          </span>

          {/* CRITICAL TRUTHFULNESS RULE: Only display applicant count when genuinely observed */}
          {signal.applicantCountObserved &&
            typeof signal.applicantCount === "number" && (
              <span
                className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                  featured
                    ? "bg-[#72D65C]/20 text-[#1D3B16]"
                    : "bg-[#72D65C]/15 text-[#72D65C]"
                }`}
                title={signal.applicantCountSource || "Observed on listing"}
              >
                {signal.applicantCount} applicants observed
              </span>
            )}
        </div>

        {signal.demo && (
          <span
            className={`text-[11px] uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
              featured
                ? "border-[#A85F2D]/30 text-[#6B4223] bg-[#A85F2D]/8"
                : "border-white/15 text-[#FFF7EA]/50 bg-white/[0.03]"
            }`}
          >
            Demo signal
          </span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
        <div>
          <h3
            className={`text-2xl sm:text-3xl font-semibold tracking-tight ${
              featured ? "text-[#14110D]" : "text-[#FFF7EA]"
            }`}
          >
            {signal.title}
          </h3>
          <p
            className={`text-sm sm:text-base mt-0.5 font-medium ${
              featured ? "text-[#5A3E28]" : "text-[#E39A58]"
            }`}
          >
            {signal.company} · {signal.location} ({signal.workMode})
          </p>
        </div>

        {onToggleSave && (
          <button
            type="button"
            onClick={() => onToggleSave(signal.id)}
            aria-pressed={isSaved}
            className={`self-start sm:self-auto inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${
              featured
                ? isSaved
                  ? "bg-[#21170F] text-[#FFF7EA] border-[#21170F]"
                  : "border-[#21170F]/20 text-[#21170F]/75 hover:bg-[#21170F]/5"
                : isSaved
                ? "bg-[#E39A58]/20 text-[#E39A58] border-[#E39A58]/40"
                : "border-white/15 text-[#FFF7EA]/70 hover:bg-white/[0.06]"
            }`}
          >
            {isSaved ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Bookmark className="w-3.5 h-3.5" />
                <span>Save</span>
              </>
            )}
          </button>
        )}
      </div>

      <blockquote
        className={`mt-5 text-base sm:text-lg leading-relaxed pl-4 border-l-2 ${
          featured
            ? "text-[#1F1610] border-[#A85F2D]"
            : "text-[#FFF7EA]/90 border-[#E39A58]"
        }`}
      >
        “{signal.summary}”
      </blockquote>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div
              className={`mt-6 pt-5 border-t space-y-5 text-sm ${
                featured ? "border-[#A85F2D]/20" : "border-white/10"
              }`}
            >
              <div>
                <h4
                  className={`text-xs uppercase tracking-[0.18em] font-semibold mb-2.5 ${
                    featured ? "text-[#6B4223]" : "text-[#E39A58]"
                  }`}
                >
                  Why Acorn surfaced this
                </h4>
                <ul className="space-y-1.5">
                  {signal.fitReasons.map((reason, idx) => (
                    <li
                      key={idx}
                      className={`flex items-start gap-2 ${
                        featured ? "text-[#2B1E14]" : "text-[#FFF7EA]/80"
                      }`}
                    >
                      <span className="text-[#72D65C] font-bold mt-0.5">•</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span
                    className={`block text-xs uppercase tracking-wider font-semibold mb-2 ${
                      featured ? "text-[#2E5A23]" : "text-[#72D65C]"
                    }`}
                  >
                    Aligned with your profile
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {signal.skillsMatched.map((skill) => (
                      <span
                        key={skill}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                          featured
                            ? "bg-[#72D65C]/20 text-[#1B3A14]"
                            : "bg-[#72D65C]/15 text-[#D9FF7A] border border-[#72D65C]/30"
                        }`}
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                {signal.skillsMissing.length > 0 && (
                  <div>
                    <span
                      className={`block text-xs uppercase tracking-wider font-semibold mb-2 ${
                        featured ? "text-[#8A421A]" : "text-[#FF8E7D]"
                      }`}
                    >
                      Worth strengthening
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {signal.skillsMissing.map((skill) => (
                        <span
                          key={skill}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                            featured
                              ? "bg-[#FF8E7D]/25 text-[#5E2218]"
                              : "bg-[#FF8E7D]/15 text-[#FF8E7D] border border-[#FF8E7D]/30"
                          }`}
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div
                className={`rounded-2xl p-3.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                  featured
                    ? "bg-[#21170F]/8 text-[#3D2B1D]"
                    : "bg-black/35 text-[#FFF7EA]/65"
                }`}
              >
                <span>
                  <strong>Timing:</strong> {signal.velocityReason}
                </span>
                <span>
                  <strong>Source:</strong> {signal.source} · Discovered{" "}
                  {signal.discoveredAt}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={`mt-6 pt-4 border-t flex flex-wrap items-center justify-between gap-3 ${
          featured ? "border-[#A85F2D]/20" : "border-white/10"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onToggleExpand}
            aria-expanded={isExpanded}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
              featured
                ? "bg-[#21170F] hover:bg-[#362619] text-[#FFF7EA]"
                : "bg-[#FFF7EA] hover:bg-[#D9FF7A] text-[#0B0A08]"
            }`}
          >
            <span>{isExpanded ? "Hide role details" : "View role"}</span>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onCheckFit(signal)}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs sm:text-sm font-semibold border transition-colors cursor-pointer ${
              featured
                ? "border-[#21170F]/25 bg-white/60 hover:bg-white text-[#14110D]"
                : "border-[#E39A58]/40 bg-[#E39A58]/15 hover:bg-[#E39A58]/25 text-[#FFF7EA]"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#A85F2D]" />
            <span>Check my fit</span>
          </button>
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={() => onDismiss(signal.id)}
            className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full transition-colors cursor-pointer ${
              featured
                ? "text-[#6B4223] hover:bg-[#21170F]/10"
                : "text-[#FFF7EA]/50 hover:text-[#FFF7EA] hover:bg-white/[0.06]"
            }`}
          >
            <X className="w-3.5 h-3.5" />
            <span>Not for me</span>
          </button>
        )}
      </div>
    </div>
  );
};

export interface BriefingSectionProps {
  signals: OpportunitySignal[];
  onCheckFit: (signal: OpportunitySignal) => void;
  onDismissSignal: (signalId: string) => void;
  onRestoreSignals: () => void;
  onToggleSaveSignal: (signalId: string) => void;
}

export const BriefingSection: React.FC<BriefingSectionProps> = ({
  signals,
  onCheckFit,
  onDismissSignal,
  onRestoreSignals,
  onToggleSaveSignal,
}) => {
  const visibleSignals = signals.filter((s) => s.status !== "dismissed");
  const [expandedId, setExpandedId] = useState<string>(
    visibleSignals[0]?.id || "sig-northstar-se"
  );

  return (
    <section
      id="product"
      aria-labelledby="briefing-heading"
      className="relative py-24 sm:py-32 px-6 bg-[#0B0A08]"
    >
      <div className="max-w-5xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <SectionLabel accent="copper">ACORN BRIEFING</SectionLabel>

          <EditorialHeading id="briefing-heading" className="mt-5">
            Less searching.
            <br />
            Better timing.
          </EditorialHeading>

          <p className="mt-5 text-base sm:text-lg text-[#FFF7EA]/75 font-light leading-relaxed">
            Acorn keeps watch, filters the noise, and brings forward the
            opportunities worth making time for.
          </p>
        </div>

        <div className="surface-bark rounded-[2rem] p-6 sm:p-10 md:p-12 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-8 mb-8 border-b border-[#E39A58]/15">
            <div className="flex items-center gap-4">
              <AcornMascot state="briefing" size={84} />
              <div>
                <p className="font-serif-editorial text-3xl sm:text-4xl text-[#FFF7EA]">
                  Good morning.
                </p>
                <p className="text-sm sm:text-base text-[#FFF7EA]/75 mt-0.5">
                  I kept watch overnight.
                </p>
                <p className="text-xs sm:text-sm text-[#D9FF7A] font-medium mt-1">
                  {visibleSignals.length}{" "}
                  {visibleSignals.length === 1 ? "signal" : "signals"} worth
                  your attention.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-2">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs text-[#FFF7EA]/65">
                <span className="w-1.5 h-1.5 rounded-full bg-[#72D65C]" />
                <span>Interactive Product Demo · Synthetic Data</span>
              </span>
              {visibleSignals.length < signals.length && (
                <button
                  type="button"
                  onClick={onRestoreSignals}
                  className="inline-flex items-center gap-1.5 text-xs text-[#E39A58] hover:underline cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore dismissed demo signals</span>
                </button>
              )}
            </div>
          </div>

          {visibleSignals.length === 0 ? (
            <div className="py-12 text-center space-y-4">
              <AcornMascot state="sleepWatch" size={88} />
              <p className="text-lg text-[#FFF7EA]">
                You're all caught up for this morning.
              </p>
              <button
                type="button"
                onClick={onRestoreSignals}
                className="px-4 py-2 rounded-full bg-[#E39A58] text-[#0B0A08] text-xs font-semibold cursor-pointer"
              >
                Restore 3 Demo Signals
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {visibleSignals.map((sig, index) => (
                <SignalCard
                  key={sig.id}
                  signal={sig}
                  featured={index === 0}
                  isExpanded={expandedId === sig.id}
                  onToggleExpand={() =>
                    setExpandedId((prev) => (prev === sig.id ? "" : sig.id))
                  }
                  onCheckFit={(selected) => {
                    onCheckFit(selected);
                    const el = document.getElementById("fit-check");
                    el?.scrollIntoView({ behavior: "smooth" });
                  }}
                  onDismiss={onDismissSignal}
                  onToggleSave={onToggleSaveSignal}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
