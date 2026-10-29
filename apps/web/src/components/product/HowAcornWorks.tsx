import React, { useState } from "react";
import { motion } from "framer-motion";
import { AcornMascot } from "../mascot/AcornMascot";
import { AcornMascotState } from "../../types/acorn";
import { DEMO_FILTERED_NOISE_EXAMPLES } from "../../data/demoData";
import { EditorialHeading, SectionLabel } from "../ui/Primitives";

interface StageStep {
  id: "watch" | "understand" | "bring";
  stepNumber: string;
  label: string;
  copy: string;
  mascotState: AcornMascotState;
  sceneCaption: string;
}

const STAGES: StageStep[] = [
  {
    id: "watch",
    stepNumber: "01",
    label: "WATCH",
    copy: "Acorn keeps an eye on the market around your goals.",
    mascotState: "sleepWatch",
    sceneCaption:
      "While you sleep or focus on your work, Acorn quietly watches new openings across Canada's tech market.",
  },
  {
    id: "understand",
    stepNumber: "02",
    label: "UNDERSTAND",
    copy: "It considers timing, fit, location and the career context you choose to share.",
    mascotState: "thinking",
    sceneCaption:
      "Noisy, reposted, senior-only, and out-of-country listings drift past. Acorn only locks onto genuine matches.",
  },
  {
    id: "bring",
    stepNumber: "03",
    label: "BRING",
    copy: "The opportunities worth your attention come to you with a clear reason to care.",
    mascotState: "briefing",
    sceneCaption:
      "Acorn carries the timely signal directly to your Briefing with clear, human reasons why it fits.",
  },
];

export const HowAcornWorks: React.FC = () => {
  const [activeStageIndex, setActiveStageIndex] = useState<number>(1);
  const currentStage = STAGES[activeStageIndex];

  return (
    <section
      id="how-it-works"
      aria-labelledby="how-heading"
      className="relative py-24 sm:py-32 px-6 bg-[#0E0B08] border-y border-[#E39A58]/10"
    >
      <div className="max-w-5xl mx-auto">
        <div className="max-w-2xl mb-14">
          <SectionLabel accent="sprout">HOW ACORN WORKS</SectionLabel>

          <EditorialHeading id="how-heading" className="mt-5">
            It works while you don't.
          </EditorialHeading>

          <p className="mt-5 text-base sm:text-lg text-[#FFF7EA]/75 font-light leading-relaxed">
            Tell Acorn what you're moving toward. It keeps watch, understands
            what matters, and brings the right moments to you.
          </p>
        </div>

        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10"
          role="tablist"
          aria-label="How Acorn Works stages"
        >
          {STAGES.map((stage, idx) => {
            const isActive = idx === activeStageIndex;
            return (
              <button
                key={stage.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveStageIndex(idx)}
                className={`text-left rounded-2xl p-6 transition-all cursor-pointer border ${
                  isActive
                    ? "surface-bark border-[#D9FF7A]/45 shadow-lg"
                    : "bg-[#14100C]/60 border-white/10 hover:border-[#E39A58]/30"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-mono text-[#E39A58]">
                    {stage.stepNumber}
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isActive ? "bg-[#D9FF7A]" : "bg-white/20"
                    }`}
                  />
                </div>
                <h3 className="text-sm uppercase tracking-[0.22em] font-semibold text-[#FFF7EA]">
                  {stage.label}
                </h3>
                <p className="text-sm text-[#FFF7EA]/70 font-light mt-2 leading-relaxed">
                  {stage.copy}
                </p>
              </button>
            );
          })}
        </div>

        <div className="surface-bark rounded-3xl p-6 sm:p-10 relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-5 space-y-2.5">
              <span className="text-[11px] uppercase tracking-[0.2em] text-[#FFF7EA]/45 block mb-3">
                Incoming Market Stream (Demo)
              </span>
              {DEMO_FILTERED_NOISE_EXAMPLES.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl bg-black/35 border border-white/[0.06] px-3.5 py-2.5 opacity-50 flex items-center justify-between gap-2"
                >
                  <span className="text-xs text-[#FFF7EA]/60 line-through truncate">
                    {item.title}
                  </span>
                  <span className="text-[10px] text-[#FF8E7D] shrink-0">
                    {item.reason}
                  </span>
                </div>
              ))}

              <motion.div
                layout
                className="rounded-xl bg-[#D9FF7A]/12 border border-[#D9FF7A]/45 px-4 py-3 flex items-center justify-between gap-2"
              >
                <div>
                  <span className="text-xs font-semibold text-[#FFF7EA] block">
                    Software Engineer · Northstar Labs
                  </span>
                  <span className="text-[11px] text-[#D9FF7A]">
                    Toronto, ON · Posted 8 min ago · Strong fit
                  </span>
                </div>
                <span className="w-2.5 h-2.5 rounded-full bg-[#D9FF7A] shadow-[0_0_12px_#D9FF7A]" />
              </motion.div>
            </div>

            <div className="lg:col-span-3 flex flex-col items-center justify-center text-center py-4">
              <AcornMascot state={currentStage.mascotState} size={118} />
              <span className="mt-2 text-xs uppercase tracking-[0.2em] text-[#D9FF7A] font-medium">
                {currentStage.label}
              </span>
            </div>

            <div className="lg:col-span-4">
              <div className="surface-cream rounded-2xl p-5">
                <div className="flex items-center justify-between text-xs text-[#6B4223] mb-2">
                  <span className="font-semibold uppercase tracking-wider">
                    Your Morning Signal
                  </span>
                  <span>Early signal</span>
                </div>
                <h4 className="text-lg font-semibold text-[#14110D]">
                  Software Engineer
                </h4>
                <p className="text-xs text-[#5A3E28]">
                  Northstar Labs (Demo) · Toronto, ON
                </p>
                <p className="mt-3 text-xs text-[#1F1610] leading-relaxed border-l-2 border-[#A85F2D] pl-3">
                  “Strong alignment with the TypeScript, AWS and product
                  engineering work you're targeting.”
                </p>
              </div>
              <p className="text-xs text-[#FFF7EA]/65 mt-3 leading-relaxed">
                {currentStage.sceneCaption}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
