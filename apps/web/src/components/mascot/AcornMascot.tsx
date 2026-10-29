import React, { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AcornMascotState } from "../../types/acorn";

export interface AcornMascotProps {
  state?: AcornMascotState;
  size?: number;
  className?: string;
  forceReducedMotion?: boolean;
  glanceOffset?: { x: number; y: number };
  label?: string;
}

const STATE_DESCRIPTIONS: Record<AcornMascotState, string> = {
  idle: "Acorn companion standing calmly with a gentle sprout sway",
  watching: "Acorn keeping watch across the horizon for timely opportunities",
  thinking: "Acorn evaluating career alignment and role context",
  found: "Acorn illuminating its sprout after spotting a timely opportunity",
  briefing: "Acorn presenting your curated morning briefing card",
  fitCheck: "Acorn scanning a resume sheet for skill alignment",
  privacy: "Acorn lowering its protective cap to shelter your personal document",
  sleepWatch: "Acorn resting peacefully while its luminous sprout keeps watch overnight",
  celebrate: "Acorn giving a small celebratory hop with organic seed confetti",
  concerned: "Acorn looking thoughtfully at a skill gap worth strengthening",
  travel: "Acorn moving through a luminous cross-platform portal",
  searching: "Acorn actively sweeping the horizon as its scouts search for matching roles",
  empty: "Acorn resting calmly while the market is quiet—no noisy filler roles",
  error: "Acorn pausing calmly with an amber status sprout while a connection is retried",
  onboarding: "Acorn waving warmly to welcome you into your workspace",
};

export const AcornMascot: React.FC<AcornMascotProps> = ({
  state = "idle",
  size = 120,
  className = "",
  forceReducedMotion = false,
  glanceOffset = { x: 0, y: 0 },
  label,
}) => {
  const uid = useId().replace(/:/g, "");
  const systemReducedMotion = useReducedMotion();
  const isReduced = Boolean(forceReducedMotion || systemReducedMotion);
  const isTiny = size <= 28;

  // Map extended semantic states onto cohesive anatomical poses
  const bodyRotation =
    state === "watching" || state === "searching"
      ? 4
      : state === "thinking"
      ? -4
      : state === "concerned" || state === "error"
      ? -2
      : state === "onboarding"
      ? 2
      : 0;

  const capYOffset =
    state === "privacy"
      ? 11
      : state === "found" || state === "onboarding"
      ? -3
      : state === "sleepWatch" || state === "empty"
      ? 3
      : 0;

  const capRotation =
    state === "privacy"
      ? -3
      : state === "thinking"
      ? -5
      : state === "watching" || state === "searching"
      ? 3
      : 0;

  const pupilShiftX =
    (state === "watching" || state === "searching"
      ? 3.2
      : state === "thinking"
      ? -2.2
      : state === "briefing"
      ? 2
      : 0) + Math.max(-2.5, Math.min(2.5, glanceOffset.x));

  const pupilShiftY =
    (state === "thinking"
      ? -2.8
      : state === "fitCheck"
      ? 3.2
      : state === "privacy"
      ? 2.2
      : 0) + Math.max(-2, Math.min(2, glanceOffset.y));

  const sproutGlowActive =
    state === "found" ||
    state === "sleepWatch" ||
    state === "watching" ||
    state === "searching" ||
    state === "celebrate" ||
    state === "onboarding";

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={label || STATE_DESCRIPTIONS[state]}
    >
      <svg
        viewBox="0 0 160 160"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        <defs>
          <linearGradient id={`seed-body-${uid}`} x1="50" y1="62" x2="112" y2="136" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#E39A58" />
            <stop offset="55%" stopColor="#C67B42" />
            <stop offset="100%" stopColor="#A85F2D" />
          </linearGradient>

          <radialGradient id={`seed-highlight-${uid}`} cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(73 88) rotate(65) scale(34 28)">
            <stop offset="0%" stopColor="#FFF7EA" stopOpacity="0.42" />
            <stop offset="100%" stopColor="#E39A58" stopOpacity="0" />
          </radialGradient>

          <linearGradient id={`cap-dome-${uid}`} x1="36" y1="30" x2="122" y2="82" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#422E1E" />
            <stop offset="50%" stopColor="#2B1D13" />
            <stop offset="100%" stopColor="#1B120B" />
          </linearGradient>

          <linearGradient id={`sprout-leaf-${uid}`} x1="78" y1="10" x2="116" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={state === "error" ? "#FF8E7D" : "#D9FF7A"} />
            <stop offset="100%" stopColor={state === "error" ? "#E39A58" : "#72D65C"} />
          </linearGradient>

          <linearGradient id={`portal-ring-${uid}`} x1="20" y1="20" x2="140" y2="140" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6EC8FF" />
            <stop offset="50%" stopColor="#B89CFF" />
            <stop offset="100%" stopColor="#D9FF7A" />
          </linearGradient>
        </defs>

        {/* Watching / Searching concentric radar rings */}
        {(state === "watching" || state === "searching") && !isTiny && (
          <g>
            <motion.circle
              cx="80"
              cy="82"
              r="54"
              stroke="#D9FF7A"
              strokeWidth="1.2"
              strokeOpacity="0.28"
              strokeDasharray="4 6"
              animate={
                isReduced
                  ? { opacity: 0.25 }
                  : { scale: [0.94, 1.12, 0.94], opacity: [0.32, 0.08, 0.32] }
              }
              transition={{
                duration: state === "searching" ? 2.2 : 3.8,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <motion.circle
              cx="80"
              cy="82"
              r="68"
              stroke="#72D65C"
              strokeWidth="1"
              strokeOpacity="0.18"
              animate={
                isReduced
                  ? { opacity: 0.15 }
                  : { scale: [0.9, 1.16, 0.9], opacity: [0.2, 0.04, 0.2] }
              }
              transition={{
                duration: state === "searching" ? 2.8 : 4.6,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.4,
              }}
            />
          </g>
        )}

        {/* Travel Portal Ring */}
        {state === "travel" && (
          <motion.ellipse
            cx="80"
            cy="88"
            rx="56"
            ry="62"
            stroke={`url(#portal-ring-${uid})`}
            strokeWidth="3"
            strokeDasharray="10 6"
            animate={
              isReduced
                ? { opacity: 0.85 }
                : { rotate: [0, 360], scale: [0.96, 1.03, 0.96] }
            }
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          />
        )}

        {/* Ground Shadow */}
        <motion.ellipse
          cx="80"
          cy="144"
          rx="30"
          ry="6"
          fill="#050403"
          fillOpacity="0.65"
          animate={
            isReduced
              ? {}
              : state === "found" || state === "celebrate"
              ? { rx: [30, 22, 30], opacity: [0.65, 0.35, 0.65] }
              : { rx: [30, 32, 30] }
          }
          transition={{
            duration: state === "found" || state === "celebrate" ? 0.9 : 4.2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Main Character Body */}
        <motion.g
          animate={
            isReduced
              ? { rotate: bodyRotation, y: 0 }
              : state === "found" || state === "celebrate"
              ? { y: [0, -9, 0], rotate: [0, -2, 2, 0] }
              : state === "sleepWatch" || state === "empty"
              ? { y: [0, 1.5, 0], rotate: 0 }
              : state === "travel"
              ? { y: [-3, 3, -3], scale: [0.97, 1.02, 0.97] }
              : { y: [0, -2.5, 0], rotate: bodyRotation }
          }
          transition={{
            duration:
              state === "found" || state === "celebrate"
                ? 0.85
                : state === "sleepWatch" || state === "empty"
                ? 5
                : 3.8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          style={{ originX: "80px", originY: "110px" }}
        >
          {/* Subtle Root-Like Feet */}
          <path
            d="M64 130 C62 138, 57 141, 54 141 C59 143, 68 141, 70 132 Z"
            fill="#87481F"
          />
          <path
            d="M96 130 C98 138, 103 141, 106 141 C101 143, 92 141, 90 132 Z"
            fill="#87481F"
          />

          {/* Tiny Rounded Left Arm */}
          <motion.ellipse
            cx={state === "privacy" ? 53 : state === "celebrate" ? 42 : 44}
            cy={state === "privacy" ? 96 : state === "celebrate" ? 80 : 94}
            rx="8.5"
            ry="6"
            transform={
              state === "celebrate"
                ? "rotate(-35 42 80)"
                : state === "privacy"
                ? "rotate(20 53 96)"
                : "rotate(-18 44 94)"
            }
            fill="#C67B42"
            stroke="#21170F"
            strokeWidth="1.5"
          />

          {/* Tiny Rounded Right Arm */}
          <motion.ellipse
            cx={
              state === "briefing"
                ? 118
                : state === "thinking"
                ? 106
                : state === "privacy"
                ? 107
                : state === "celebrate" || state === "onboarding"
                ? 118
                : 116
            }
            cy={
              state === "briefing"
                ? 88
                : state === "thinking"
                ? 96
                : state === "privacy"
                ? 96
                : state === "celebrate" || state === "onboarding"
                ? 78
                : 94
            }
            rx="8.5"
            ry="6"
            transform={
              state === "celebrate" || state === "onboarding"
                ? "rotate(35 118 78)"
                : state === "briefing"
                ? "rotate(-12 118 88)"
                : "rotate(18 116 94)"
            }
            fill="#C67B42"
            stroke="#21170F"
            strokeWidth="1.5"
          />

          {/* Warm Tapered Seed-Shaped Body */}
          <path
            d="M46 74 C46 56, 114 56, 114 74 C114 103, 98 126, 80 135 C62 126, 46 103, 46 74 Z"
            fill={`url(#seed-body-${uid})`}
            stroke="#21170F"
            strokeWidth="2.2"
          />

          {/* Belly Cream Highlight */}
          <path
            d="M53 76 C53 62, 107 62, 107 76 C107 100, 94 119, 80 127 C66 119, 53 100, 53 76 Z"
            fill={`url(#seed-highlight-${uid})`}
          />

          {/* Expressive Geometric Eyes Under the Cap */}
          {state === "sleepWatch" ? (
            <g stroke="#21170F" strokeWidth="2.8" strokeLinecap="round">
              <path d="M62 84 Q68 89 74 84" />
              <path d="M86 84 Q92 89 98 84" />
            </g>
          ) : state === "celebrate" ? (
            <g stroke="#21170F" strokeWidth="2.8" strokeLinecap="round">
              <path d="M62 85 Q68 78 74 85" />
              <path d="M86 85 Q92 78 98 85" />
            </g>
          ) : (
            <g>
              <ellipse cx="68" cy="84" rx="6.2" ry="7.5" fill="#18110B" />
              <ellipse cx="92" cy="84" rx="6.2" ry="7.5" fill="#18110B" />

              <circle
                cx={68 + pupilShiftX}
                cy={83.5 + pupilShiftY}
                r={state === "found" || state === "onboarding" ? "3.1" : "2.5"}
                fill="#FFF7EA"
              />
              <circle
                cx={92 + pupilShiftX}
                cy={83.5 + pupilShiftY}
                r={state === "found" || state === "onboarding" ? "3.1" : "2.5"}
                fill="#FFF7EA"
              />

              {(state === "found" || state === "watching" || state === "searching" || state === "onboarding") && (
                <>
                  <circle cx={66 + pupilShiftX} cy={86 + pupilShiftY} r="1.1" fill="#D9FF7A" />
                  <circle cx={90 + pupilShiftX} cy={86 + pupilShiftY} r="1.1" fill="#D9FF7A" />
                </>
              )}

              {(state === "concerned" || state === "error") && (
                <g stroke="#21170F" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M61 75 L73 77" />
                  <path d="M99 75 L87 77" />
                </g>
              )}
            </g>
          )}

          {(state === "found" || state === "celebrate" || state === "briefing" || state === "onboarding") && (
            <path
              d="M76 96 Q80 100 84 96"
              stroke="#21170F"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          )}
          {(state === "thinking" || state === "empty" || state === "error") && (
            <line
              x1="77"
              y1="97"
              x2="83"
              y2="96"
              stroke="#21170F"
              strokeWidth="2"
              strokeLinecap="round"
            />
          )}

          {/* State Props */}
          {state === "briefing" && !isTiny && (
            <motion.g
              initial={{ x: 0, y: 0 }}
              animate={isReduced ? {} : { x: [0, 4, 0], y: [0, -2, 0] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
            >
              <rect
                x="108"
                y="72"
                width="34"
                height="24"
                rx="5"
                fill="#FFF7EA"
                stroke="#A85F2D"
                strokeWidth="1.8"
              />
              <circle cx="115" cy="80" r="2.5" fill="#72D65C" />
              <line x1="121" y1="80" x2="135" y2="80" stroke="#21170F" strokeWidth="2" strokeLinecap="round" />
              <line x1="114" y1="87" x2="132" y2="87" stroke="#A85F2D" strokeWidth="1.6" strokeLinecap="round" />
            </motion.g>
          )}

          {state === "fitCheck" && !isTiny && (
            <g>
              <rect
                x="58"
                y="95"
                width="44"
                height="32"
                rx="5"
                fill="#FFF7EA"
                stroke="#6EC8FF"
                strokeWidth="1.6"
              />
              <line x1="65" y1="103" x2="94" y2="103" stroke="#21170F" strokeWidth="1.8" strokeLinecap="round" />
              <line x1="65" y1="110" x2="88" y2="110" stroke="#A85F2D" strokeWidth="1.6" strokeLinecap="round" />
              <line x1="65" y1="117" x2="92" y2="117" stroke="#72D65C" strokeWidth="1.6" strokeLinecap="round" />
              <motion.line
                x1="56"
                y1="100"
                x2="104"
                y2="100"
                stroke="#6EC8FF"
                strokeWidth="2.4"
                strokeLinecap="round"
                animate={isReduced ? { y: 10 } : { y: [0, 22, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              />
            </g>
          )}

          {state === "privacy" && !isTiny && (
            <g>
              <rect
                x="60"
                y="92"
                width="40"
                height="28"
                rx="5"
                fill="#FFF7EA"
                stroke="#A85F2D"
                strokeWidth="1.6"
              />
              <rect x="66" y="99" width="18" height="4" rx="2" fill="#A85F2D" opacity="0.45" />
              <rect x="66" y="106" width="26" height="4" rx="2" fill="#72D65C" opacity="0.65" />
            </g>
          )}

          {/* Oversized Protective Acorn Cap + Asymmetrical Sprout */}
          <motion.g
            animate={{
              y: capYOffset,
              rotate: capRotation,
            }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            style={{ originX: "80px", originY: "64px" }}
          >
            <motion.g
              animate={
                isReduced
                  ? {}
                  : state === "found" || state === "searching"
                  ? { rotate: [0, 8, -4, 0], scale: [1, 1.08, 1] }
                  : { rotate: [-2, 3, -2] }
              }
              transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
              style={{ originX: "82px", originY: "36px" }}
            >
              {sproutGlowActive && (
                <motion.circle
                  cx="98"
                  cy="20"
                  r="13"
                  fill="#D9FF7A"
                  fillOpacity="0.28"
                  animate={
                    isReduced
                      ? { opacity: 0.3 }
                      : { scale: [0.85, 1.25, 0.85], opacity: [0.2, 0.48, 0.2] }
                  }
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                />
              )}

              <path
                d="M80 38 C80 26, 86 19, 95 16"
                stroke={state === "error" ? "#FF8E7D" : "#72D65C"}
                strokeWidth="4.2"
                strokeLinecap="round"
              />

              <path
                d="M92 17 C98 8, 114 9, 117 20 C111 28, 97 27, 92 17 Z"
                fill={`url(#sprout-leaf-${uid})`}
                stroke="#21170F"
                strokeWidth="1.6"
              />

              <path
                d="M83 25 C76 20, 71 22, 72 28 C76 31, 81 29, 83 25 Z"
                fill={state === "error" ? "#E39A58" : "#72D65C"}
                stroke="#21170F"
                strokeWidth="1.4"
              />
            </motion.g>

            <path
              d="M34 68 C34 38, 56 32, 80 32 C104 32, 126 38, 126 68 C112 75, 48 75, 34 68 Z"
              fill={`url(#cap-dome-${uid})`}
              stroke="#140D08"
              strokeWidth="2.4"
            />

            {!isTiny && (
              <g stroke="#A85F2D" strokeOpacity="0.28" strokeWidth="1.4" strokeLinecap="round">
                <path d="M52 46 Q64 56 74 64" />
                <path d="M68 39 Q82 52 94 64" />
                <path d="M88 40 Q100 50 110 62" />
                <path d="M106 46 Q94 56 84 64" />
                <path d="M90 39 Q76 52 64 64" />
                <path d="M70 40 Q58 50 48 62" />
              </g>
            )}

            <path
              d="M31 66 C48 75, 112 75, 129 66 C131 72, 127 77, 121 78 C98 83, 62 83, 39 78 C33 77, 29 72, 31 66 Z"
              fill="#332216"
              stroke="#140D08"
              strokeWidth="2.2"
            />
          </motion.g>
        </motion.g>

        {/* Ambient Cognitive / Celebration Particles */}
        {state === "thinking" && !isTiny && (
          <g>
            {[
              { cx: 34, cy: 52, r: 3.2, color: "#B89CFF", delay: 0 },
              { cx: 128, cy: 48, r: 2.8, color: "#6EC8FF", delay: 0.4 },
              { cx: 122, cy: 76, r: 2.2, color: "#D9FF7A", delay: 0.8 },
            ].map((dot, idx) => (
              <motion.circle
                key={idx}
                cx={dot.cx}
                cy={dot.cy}
                r={dot.r}
                fill={dot.color}
                animate={
                  isReduced
                    ? {}
                    : { y: [-4, 4, -4], opacity: [0.45, 1, 0.45] }
                }
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                  delay: dot.delay,
                  ease: "easeInOut",
                }}
              />
            ))}
          </g>
        )}

        {(state === "found" || state === "celebrate") && !isTiny && (
          <g>
            {[
              { x: 32, y: 38, color: "#D9FF7A" },
              { x: 128, y: 36, color: "#72D65C" },
              { x: 26, y: 68, color: "#FF8E7D" },
              { x: 134, y: 66, color: "#6EC8FF" },
            ].map((spark, i) => (
              <motion.circle
                key={i}
                cx={spark.x}
                cy={spark.y}
                r="3"
                fill={spark.color}
                animate={
                  isReduced
                    ? {}
                    : { scale: [0.7, 1.3, 0.7], opacity: [0.3, 1, 0.3] }
                }
                transition={{
                  duration: 1.4,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              />
            ))}
          </g>
        )}
      </svg>
    </div>
  );
};
