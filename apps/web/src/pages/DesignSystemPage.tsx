import React, { useState } from "react";
import { Sparkles } from "lucide-react";
import { AcornMascot } from "../components/mascot/AcornMascot";
import { MiniAcornScouts, MiniAcornScoutSvg } from "../components/mascot/MiniAcornScouts";
import { AcornLogo } from "../components/mascot/AcornLogo";
import { AcornMascotState, IncomingSignalBatchEvent } from "../types/acorn";
import { EditorialHeading, SectionLabel } from "../components/ui/Primitives";

const ALL_MASCOT_STATES: AcornMascotState[] = [
  "idle",
  "watching",
  "searching",
  "thinking",
  "found",
  "briefing",
  "fitCheck",
  "privacy",
  "sleepWatch",
  "celebrate",
  "concerned",
  "empty",
  "error",
  "onboarding",
  "travel",
];

const COLOR_TOKENS = [
  { name: "--soil-950", hex: "#0B0A08", role: "Primary Nocturnal Canvas" },
  { name: "--bark-900", hex: "#21170F", role: "Warm Organic Bark Surface" },
  { name: "--acorn-600", hex: "#A85F2D", role: "Core Brand Copper / Shell" },
  { name: "--acorn-400", hex: "#E39A58", role: "Warm Amber Seed Highlight" },
  { name: "--cream-50", hex: "#FFF7EA", role: "Printed Editorial Card & Type" },
  { name: "--sprout-500", hex: "#72D65C", role: "Living Sprout & Active State" },
  { name: "--signal-300", hex: "#D9FF7A", role: "Timely Signal Lime" },
  { name: "--sky-400", hex: "#6EC8FF", role: "Contextual Info & Fit Scan" },
  { name: "--violet-400", hex: "#B89CFF", role: "Cognition & Intelligence" },
  { name: "--coral-400", hex: "#FF8E7D", role: "Human Warmth & Gap Callout" },
];

export interface DesignSystemPageProps {
  incomingSignalBatch?: IncomingSignalBatchEvent | null;
  onTriggerScoutDemo?: () => void;
}

export const DesignSystemPage: React.FC<DesignSystemPageProps> = ({
  incomingSignalBatch = null,
  onTriggerScoutDemo,
}) => {
  const [selectedState, setSelectedState] =
    useState<AcornMascotState>("watching");
  const [forceReducedMotion, setForceReducedMotion] = useState(false);
  const [localScoutEvent, setLocalScoutEvent] =
    useState<IncomingSignalBatchEvent | null>(null);

  const activeScoutEvent = localScoutEvent || incomingSignalBatch;

  return (
    <div className="min-h-screen pt-28 pb-24 px-6 bg-[#0B0A08] text-[#FFF7EA]">
      <div className="max-w-6xl mx-auto space-y-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#E39A58]/20 pb-10">
          <div>
            <SectionLabel accent="copper">
              SHOWABLE DESIGN SYSTEM · /design-system
            </SectionLabel>
            <EditorialHeading className="mt-4">
              Living Cinematic Intelligence.
            </EditorialHeading>
            <p className="mt-4 text-base text-[#DECDB5] max-w-2xl font-light">
              Complete brand architecture, WCAG 2.2 AA color tokens, typography,
              15-state mascot system, Mini-Acorn Scouts choreography, and
              component primitives.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setForceReducedMotion((prev) => !prev)}
            aria-pressed={forceReducedMotion}
            className={`px-4 py-2.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer self-start ${
              forceReducedMotion
                ? "bg-[#D9FF7A] text-[#0B0A08] border-[#D9FF7A]"
                : "surface-bark text-[#FFF7EA] border-[#E39A58]/30"
            }`}
          >
            {forceReducedMotion
              ? "Reduced-Motion Preview: ON (Static)"
              : "Toggle Reduced-Motion Preview"}
          </button>
        </div>

        {/* 1. Interactive Mascot State Machine (15 States) */}
        <section className="space-y-8">
          <div>
            <span className="text-xs uppercase tracking-[0.2em] text-[#D9FF7A]">
              01 · Character System
            </span>
            <h3 className="text-2xl sm:text-3xl font-semibold mt-1">
              Acorn Mascot State Machine (15 Typed States)
            </h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center surface-bark rounded-3xl p-8">
            <div className="lg:col-span-5 flex flex-col items-center justify-center text-center p-6 rounded-2xl bg-[#0B0A08]/70 border border-[#E39A58]/20">
              <AcornMascot
                state={selectedState}
                size={180}
                forceReducedMotion={forceReducedMotion}
              />
              <span className="mt-4 px-3.5 py-1 rounded-full bg-[#D9FF7A]/15 text-[#D9FF7A] font-mono text-xs">
                state="{selectedState}"
              </span>
            </div>

            <div className="lg:col-span-7 space-y-4">
              <p className="text-sm text-[#DECDB5]">
                Select any state below to inspect Acorn's pose, cap angle,
                sprout illumination, pupil direction, and interaction props:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {ALL_MASCOT_STATES.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setSelectedState(st)}
                    className={`px-3.5 py-2.5 rounded-xl text-xs font-mono text-left transition-all cursor-pointer border ${
                      selectedState === st
                        ? "bg-[#FFF7EA] text-[#0B0A08] font-bold border-[#FFF7EA]"
                        : "bg-black/40 text-[#DECDB5] border-white/10 hover:border-[#E39A58]/40"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 2. Mini-Acorn Scouts ("The scouts return") Storyboard & Live Trigger */}
        <section className="space-y-6">
          <div>
            <span className="text-xs uppercase tracking-[0.2em] text-[#72D65C]">
              02 · Mini-Acorn Signal Animation ("The Scouts Return")
            </span>
            <h3 className="text-2xl font-semibold mt-1">
              0–1,800ms Curved-Trajectory Scout Arrival &amp; Reduced-Motion
              Fallback
            </h3>
          </div>

          <div className="surface-bark rounded-3xl p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-5 flex flex-col items-center justify-center p-6 rounded-2xl bg-[#0B0A08]/75 border border-[#D9FF7A]/25 min-h-[240px]">
              <MiniAcornScouts
                incomingEvent={activeScoutEvent}
                baseState="watching"
                size={124}
                forceReducedMotion={forceReducedMotion}
              />
            </div>

            <div className="lg:col-span-7 space-y-4 text-xs sm:text-sm text-[#DECDB5]">
              <div className="flex items-center gap-3">
                <MiniAcornScoutSvg size={36} />
                <span className="font-semibold text-[#FFF7EA]">
                  Mini-Acorn Scout Reference Asset (visually derived from main
                  Acorn silhouette)
                </span>
              </div>
              <ul className="space-y-1.5 font-mono text-xs">
                <li>
                  • <strong className="text-[#D9FF7A]">0–250ms:</strong> Main
                  mascot notices activity (`watching` posture shift)
                </li>
                <li>
                  • <strong className="text-[#D9FF7A]">250–900ms:</strong> 3–4
                  mini-acorn scouts enter on distinct curved paths
                </li>
                <li>
                  • <strong className="text-[#D9FF7A]">900–1,400ms:</strong>{" "}
                  Scouts settle around main mascot with restrained easing
                </li>
                <li>
                  • <strong className="text-[#D9FF7A]">1,400–1,800ms:</strong>{" "}
                  Mascot acknowledges Signal (`briefing`) &amp; accessible
                  live-region reveals
                </li>
              </ul>
              <button
                type="button"
                onClick={() => {
                  setLocalScoutEvent({
                    batchId: `ds-batch-${Date.now()}`,
                    count: 3,
                    headline: "3 early Canadian tech signals",
                    triggeredAt: Date.now(),
                  });
                  onTriggerScoutDemo?.();
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#D9FF7A] text-[#0B0A08] font-semibold text-xs cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Trigger "The Scouts Return" Animation</span>
              </button>
            </div>
          </div>
        </section>

        {/* 3. Mascot Scale Tests */}
        <section className="space-y-6">
          <div>
            <span className="text-xs uppercase tracking-[0.2em] text-[#72D65C]">
              03 · Silhouette Scale Tests
            </span>
            <h3 className="text-2xl font-semibold mt-1">
              From 16px Favicon to Full Hero Scale
            </h3>
          </div>

          <div className="surface-bark rounded-3xl p-8 flex flex-wrap items-end justify-around gap-8">
            {[
              { size: 16, label: "16px Favicon" },
              { size: 24, label: "24px Notification" },
              { size: 40, label: "40px Avatar" },
              { size: 72, label: "72px Card Companion" },
              { size: 132, label: "132px Hero Scale" },
            ].map((item) => (
              <div key={item.size} className="flex flex-col items-center gap-3">
                <AcornMascot
                  state={selectedState}
                  size={item.size}
                  forceReducedMotion={forceReducedMotion}
                />
                <span className="text-xs font-mono text-[#DECDB5]">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* 4. Logo & Brand Mark Variants */}
        <section className="space-y-6">
          <div>
            <span className="text-xs uppercase tracking-[0.2em] text-[#E39A58]">
              04 · Identity Marks
            </span>
            <h3 className="text-2xl font-semibold mt-1">
              Wordmark, Simplified Mark, App Icon &amp; Monochrome
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="surface-bark rounded-2xl p-6 flex flex-col items-center justify-between gap-4">
              <AcornLogo variant="wordmark" theme="dark" size={34} />
              <span className="text-xs text-[#DECDB5]">Dark Wordmark</span>
            </div>
            <div className="surface-cream rounded-2xl p-6 flex flex-col items-center justify-between gap-4">
              <AcornLogo variant="wordmark" theme="light" size={34} />
              <span className="text-xs text-[#5A3E28]">Light Wordmark</span>
            </div>
            <div className="surface-bark rounded-2xl p-6 flex flex-col items-center justify-between gap-4">
              <AcornLogo variant="mark" size={44} />
              <span className="text-xs text-[#DECDB5]">Simplified Mark</span>
            </div>
            <div className="surface-bark rounded-2xl p-6 flex flex-col items-center justify-between gap-4">
              <AcornLogo variant="app-icon" size={48} />
              <span className="text-xs text-[#DECDB5]">App Icon</span>
            </div>
            <div className="surface-bark rounded-2xl p-6 flex flex-col items-center justify-between gap-4">
              <AcornLogo variant="monochrome" size={44} />
              <span className="text-xs text-[#DECDB5]">Monochrome</span>
            </div>
          </div>
        </section>

        {/* 5. Color Tokens */}
        <section className="space-y-6">
          <div>
            <span className="text-xs uppercase tracking-[0.2em] text-[#6EC8FF]">
              05 · Color Palette
            </span>
            <h3 className="text-2xl font-semibold mt-1">
              Biological Futurism &amp; Warm Earth Tokens
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {COLOR_TOKENS.map((t) => (
              <div
                key={t.name}
                className="rounded-2xl overflow-hidden border border-white/10 bg-[#14100C]"
              >
                <div
                  className="h-20 w-full border-b border-white/10"
                  style={{ backgroundColor: t.hex }}
                />
                <div className="p-3.5 space-y-1">
                  <div className="text-xs font-mono font-bold text-[#FFF7EA]">
                    {t.name}
                  </div>
                  <div className="text-[11px] font-mono text-[#E39A58]">
                    {t.hex}
                  </div>
                  <div className="text-[11px] text-[#DECDB5]">{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
