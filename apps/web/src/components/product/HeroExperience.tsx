import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Play } from "lucide-react";
import { AcornMascot } from "../mascot/AcornMascot";
import { AcornMascotState } from "../../types/acorn";
import { ParticleField, SectionLabel } from "../ui/Primitives";

interface HeroExperienceProps {
  onMeetAcorn: () => void;
  onOpenRequestAccess: () => void;
}

export const HeroExperience: React.FC<HeroExperienceProps> = ({
  onMeetAcorn,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [heroMascotState, setHeroMascotState] = useState<AcornMascotState>(
    prefersReducedMotion ? "watching" : "sleepWatch"
  );
  const [glance, setGlance] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [sequenceNote, setSequenceNote] = useState<string>(
    "Acorn is keeping watch across Canada's tech market."
  );

  useEffect(() => {
    if (prefersReducedMotion) {
      setHeroMascotState("watching");
      return;
    }

    const t1 = window.setTimeout(() => {
      setHeroMascotState("idle");
      setSequenceNote("Sprout stirs. Eyes open.");
    }, 650);

    const t2 = window.setTimeout(() => {
      setHeroMascotState("found");
      setSequenceNote("Signal spotted: Software Engineer · Toronto (8m ago)");
    }, 1500);

    const t3 = window.setTimeout(() => {
      setHeroMascotState("watching");
      setSequenceNote("Keeping watch across Toronto, GTA, and Remote Canada.");
    }, 2800);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [prefersReducedMotion]);

  const handleHeroMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (prefersReducedMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width - 0.5;
    const relY = (e.clientY - rect.top) / rect.height - 0.5;
    setGlance({ x: relX * 3.5, y: relY * 2.5 });
  };

  return (
    <section
      onMouseMove={handleHeroMouseMove}
      onMouseLeave={() => setGlance({ x: 0, y: 0 })}
      aria-label="Acorn Hero"
      className="relative min-h-[720px] lg:min-h-screen w-full flex items-center justify-center overflow-hidden pt-28 pb-20 px-6"
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 50% 24%, rgba(168, 95, 45, 0.22) 0%, rgba(33, 23, 15, 0.55) 45%, #0B0A08 85%)",
      }}
    >
      <ParticleField density={32} />

      {!prefersReducedMotion && (
        <motion.div
          initial={{ x: -240, y: -40, opacity: 0 }}
          animate={{
            x: [-220, 40, 140],
            y: [-30, -75, -55],
            opacity: [0, 1, 0],
          }}
          transition={{ duration: 2.2, ease: "easeInOut" }}
          className="absolute z-10 pointer-events-none flex items-center gap-2"
          aria-hidden="true"
        >
          <span className="w-3 h-3 rounded-full bg-[#D9FF7A] shadow-[0_0_24px_#D9FF7A]" />
          <span className="w-16 h-0.5 bg-gradient-to-l from-[#D9FF7A] to-transparent rounded-full" />
        </motion.div>
      )}

      <div className="relative z-20 max-w-4xl mx-auto text-center flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6"
        >
          <SectionLabel accent="sprout">
            PERSONAL CAREER INTELLIGENCE
          </SectionLabel>
        </motion.div>

        <motion.div
          initial={
            prefersReducedMotion
              ? { opacity: 1, scale: 1 }
              : { opacity: 0, y: -28, scale: 0.92 }
          }
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex flex-col items-center mb-4"
        >
          <button
            type="button"
            onClick={() =>
              setHeroMascotState((prev) =>
                prev === "watching"
                  ? "found"
                  : prev === "found"
                  ? "briefing"
                  : prev === "briefing"
                  ? "sleepWatch"
                  : "watching"
              )
            }
            className="group relative rounded-full p-2 cursor-pointer focus:outline-none"
            aria-label="Interact with Acorn mascot state"
          >
            <AcornMascot
              state={heroMascotState}
              size={148}
              glanceOffset={glance}
            />
          </button>

          <div className="mt-1 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#21170F]/90 border border-[#E39A58]/20 text-xs text-[#FFF7EA]/75">
            <span className="w-1.5 h-1.5 rounded-full bg-[#D9FF7A]" />
            <span>{sequenceNote}</span>
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="font-serif-editorial text-5xl sm:text-7xl md:text-[5.6rem] leading-[0.96] tracking-tight text-[#FFF7EA] mt-3"
        >
          Be first to what matters.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.32 }}
          className="mt-6 max-w-2xl text-base sm:text-lg md:text-xl text-[#FFF7EA]/80 font-light leading-relaxed"
        >
          Acorn keeps watch across Canada's tech market, finds the opportunities
          worth your attention, and brings them to you while there's still time
          to move.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.44 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          <button
            type="button"
            onClick={onMeetAcorn}
            className="inline-flex items-center gap-2.5 rounded-full bg-[#FFF7EA] hover:bg-[#D9FF7A] text-[#0B0A08] px-7 py-3.5 text-sm sm:text-base font-semibold shadow-lg transition-all cursor-pointer"
          >
            <span>Meet Acorn</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>

          <a
            href="#product"
            className="liquid-glass inline-flex items-center gap-2.5 rounded-full px-6 py-3.5 text-sm sm:text-base font-medium text-[#FFF7EA] hover:border-[#E39A58]/50 transition-all"
          >
            <span className="w-6 h-6 rounded-full bg-[#E39A58]/20 border border-[#E39A58]/40 flex items-center justify-center">
              <Play className="w-3 h-3 fill-current text-[#E39A58] ml-0.5" />
            </span>
            <span>See it work</span>
          </a>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.65 }}
          className="mt-12 text-xs sm:text-sm text-[#E39A58]/80 font-normal tracking-wide"
        >
          A job board gives you inventory. Acorn gives you judgment.
        </motion.p>
      </div>
    </section>
  );
};
