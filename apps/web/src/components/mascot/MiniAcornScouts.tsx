import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { AcornMascot } from "./AcornMascot";
import { AcornMascotState, IncomingSignalBatchEvent } from "../../types/acorn";

export interface MiniAcornScoutsProps {
  /** Event batch when genuinely new Signals arrive (null on initial hydration) */
  incomingEvent: IncomingSignalBatchEvent | null;
  baseState?: AcornMascotState;
  size?: number;
  forceReducedMotion?: boolean;
  onAcknowledge?: (batchId: string) => void;
}

interface ScoutTrajectory {
  id: string;
  startX: number;
  startY: number;
  midX: number;
  midY: number;
  settleX: number;
  settleY: number;
  delaySec: number;
  tiltDeg: number;
}

// 4 distinct curved trajectories so scouts never fall in identical vertical lines
const SCOUT_TRAJECTORIES: ScoutTrajectory[] = [
  { id: "scout-nw", startX: -72, startY: -68, midX: -54, midY: -24, settleX: -44, settleY: 16, delaySec: 0.25, tiltDeg: -12 },
  { id: "scout-ne", startX: 74, startY: -64, midX: 56, midY: -20, settleX: 46, settleY: 14, delaySec: 0.34, tiltDeg: 14 },
  { id: "scout-far-w", startX: -92, startY: -38, midX: -70, midY: -4, settleX: -56, settleY: 32, delaySec: 0.42, tiltDeg: -8 },
  { id: "scout-far-e", startX: 90, startY: -42, midX: 68, midY: -6, settleX: 54, settleY: 30, delaySec: 0.48, tiltDeg: 10 },
];

/**
 * Miniature Acorn Scout SVG — visually related to the main Acorn mascot
 * (oversized cap + warm seed body + glowing signal sprout bud).
 */
export const MiniAcornScoutSvg: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    {/* Glowing signal bud */}
    <circle cx="28" cy="7" r="4.5" fill="#D9FF7A" fillOpacity="0.45" />
    <path
      d="M24 14 C24 10, 26 8, 29 7"
      stroke="#72D65C"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
    <path
      d="M28 7 C30 4, 35 4, 36 8 C33 11, 29 10, 28 7 Z"
      fill="#D9FF7A"
      stroke="#21170F"
      strokeWidth="1"
    />
    {/* Seed body */}
    <path
      d="M14 23 C14 17, 34 17, 34 23 C34 33, 28 40, 24 43 C20 40, 14 33, 14 23 Z"
      fill="#E39A58"
      stroke="#21170F"
      strokeWidth="1.6"
    />
    {/* Expressive scout eyes */}
    <circle cx="20.5" cy="27" r="1.9" fill="#18110B" />
    <circle cx="27.5" cy="27" r="1.9" fill="#18110B" />
    <circle cx="21" cy="26.5" r="0.8" fill="#FFF7EA" />
    <circle cx="28" cy="26.5" r="0.8" fill="#FFF7EA" />
    {/* Protective cap */}
    <path
      d="M10 21 C10 12, 17 10, 24 10 C31 10, 38 12, 38 21 C33 24, 15 24, 10 21 Z"
      fill="#2B1D13"
      stroke="#140D08"
      strokeWidth="1.6"
    />
  </svg>
);

/**
 * Orchestrates "The scouts return" (0 - 1,800ms):
 * - 0–250ms: Main mascot notices incoming activity ('watching' -> 'found')
 * - 250–900ms: 3 to 4 mini-acorns descend along curved paths
 * - 900–1,400ms: Scouts settle briefly around the main mascot with soft bounce
 * - 1,400–1,800ms: Mascot acknowledges Signal & accessible notification banner reveals
 *
 * Strictly deduplicates batchId, never fires on initial hydration, pauses if document.hidden,
 * and provides a static reduced-motion equivalent.
 */
export const MiniAcornScouts: React.FC<MiniAcornScoutsProps> = ({
  incomingEvent,
  baseState = "watching",
  size = 110,
  forceReducedMotion = false,
  onAcknowledge,
}) => {
  const systemReducedMotion = useReducedMotion();
  const isReduced = Boolean(forceReducedMotion || systemReducedMotion);

  const processedBatchIdsRef = useRef<Set<string>>(new Set());
  const [phase, setPhase] = useState<"idle" | "noticing" | "descending" | "settled" | "acknowledged">("idle");
  const [activeAnnouncement, setActiveAnnouncement] = useState<string | null>(null);

  useEffect(() => {
    if (!incomingEvent) return;

    // Deduplicate: never replay for an already-seen batchId
    if (processedBatchIdsRef.current.has(incomingEvent.batchId)) {
      return;
    }

    // Do not run decorative animation if tab is hidden
    const isPageHidden = typeof document !== "undefined" && document.hidden;
    processedBatchIdsRef.current.add(incomingEvent.batchId);

    const summaryText =
      incomingEvent.count === 1
        ? `Acorn found 1 new opportunity: ${incomingEvent.headline}`
        : `Acorn found ${incomingEvent.count} new opportunities.`;

    setActiveAnnouncement(summaryText);

    if (isReduced || isPageHidden) {
      setPhase("acknowledged");
      onAcknowledge?.(incomingEvent.batchId);
      return;
    }

    // 0–250ms: Main mascot notices incoming activity
    setPhase("noticing");

    // 250–900ms: Scouts enter on curved trajectories
    const tDescend = window.setTimeout(() => {
      setPhase("descending");
    }, 250);

    // 900–1400ms: Scouts settle around main mascot
    const tSettle = window.setTimeout(() => {
      setPhase("settled");
    }, 900);

    // 1400–1800ms: Mascot acknowledges & notification reveals
    const tAck = window.setTimeout(() => {
      setPhase("acknowledged");
      onAcknowledge?.(incomingEvent.batchId);
    }, 1550);

    const tReset = window.setTimeout(() => {
      setPhase("idle");
    }, 3600);

    return () => {
      window.clearTimeout(tDescend);
      window.clearTimeout(tSettle);
      window.clearTimeout(tAck);
      window.clearTimeout(tReset);
    };
  }, [incomingEvent, isReduced, onAcknowledge]);

  const effectiveMascotState: AcornMascotState =
    phase === "noticing"
      ? "watching"
      : phase === "descending" || phase === "settled"
      ? "found"
      : phase === "acknowledged"
      ? "briefing"
      : baseState;

  // Cap scouts between 3 and 4 even if a larger batch arrives
  const scoutCount = incomingEvent
    ? Math.min(4, Math.max(3, incomingEvent.count))
    : 3;
  const activeScouts = SCOUT_TRAJECTORIES.slice(0, scoutCount);

  return (
    <div className="relative inline-flex flex-col items-center">
      {/* Screen-reader & visual live notification (WCAG 2.2 AA) */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {activeAnnouncement || ""}
      </div>

      <div className="relative inline-flex items-center justify-center">
        <AcornMascot
          state={effectiveMascotState}
          size={size}
          forceReducedMotion={isReduced}
        />

        {/* Animated Mini-Acorn Scouts (250ms – 1,800ms) */}
        <AnimatePresence>
          {!isReduced && (phase === "descending" || phase === "settled") && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {activeScouts.map((scout) => (
                <motion.div
                  key={scout.id}
                  initial={{
                    x: scout.startX,
                    y: scout.startY,
                    opacity: 0,
                    scale: 0.65,
                    rotate: scout.tiltDeg * 1.5,
                  }}
                  animate={{
                    x: [scout.startX, scout.midX, scout.settleX],
                    y: [scout.startY, scout.midY, scout.settleY],
                    opacity: [0, 1, 1],
                    scale: [0.7, 1.06, 1],
                    rotate: [scout.tiltDeg * 1.5, -scout.tiltDeg * 0.5, scout.tiltDeg * 0.4],
                  }}
                  exit={{
                    opacity: 0,
                    scale: 0.8,
                    y: scout.settleY - 8,
                    transition: { duration: 0.25 },
                  }}
                  transition={{
                    duration: 1.1,
                    delay: scout.delaySec - 0.25,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="absolute"
                >
                  <MiniAcornScoutSvg size={30} />
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Accessible Textual Notification Pill (Works in both animated & reduced-motion modes) */}
      <AnimatePresence>
        {activeAnnouncement && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mt-2 inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#21170F] border border-[#D9FF7A]/45 text-xs font-medium text-[#D9FF7A] shadow-lg"
          >
            <span className="w-2 h-2 rounded-full bg-[#D9FF7A]" aria-hidden="true" />
            <span>{activeAnnouncement}</span>
            <button
              type="button"
              onClick={() => setActiveAnnouncement(null)}
              className="ml-1 text-[#DECDB5] hover:text-[#FFF7EA] text-[11px] underline cursor-pointer"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
