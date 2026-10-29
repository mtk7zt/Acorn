import React from "react";
import { AcornMascot } from "./AcornMascot";
import { AcornMascotState } from "../../types/acorn";

export type AcornLogoVariant =
  | "wordmark"
  | "mark"
  | "character"
  | "favicon"
  | "app-icon"
  | "monochrome";

export interface AcornLogoProps {
  variant?: AcornLogoVariant;
  theme?: "dark" | "light";
  size?: number;
  className?: string;
}

export const AcornLogo: React.FC<AcornLogoProps> = ({
  variant = "wordmark",
  theme = "dark",
  size = 36,
  className = "",
}) => {
  const isLight = theme === "light";
  const isMono = variant === "monochrome";

  const capColor = isMono
    ? isLight
      ? "#14110D"
      : "#FFF7EA"
    : isLight
    ? "#21170F"
    : "#3A2719";

  const bodyColor = isMono
    ? isLight
      ? "#21170F"
      : "#FFF7EA"
    : "#E39A58";

  const sproutColor = isMono
    ? isLight
      ? "#14110D"
      : "#FFF7EA"
    : "#72D65C";

  const textColor = isLight ? "text-[#14110D]" : "text-[#FFF7EA]";

  if (variant === "character") {
    return <AcornMascot state="idle" size={size} className={className} />;
  }

  const MarkSvg = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      {variant === "app-icon" && (
        <rect
          x="2"
          y="2"
          width="60"
          height="60"
          rx="16"
          fill={isLight ? "#FFF7EA" : "#18120C"}
          stroke="#A85F2D"
          strokeOpacity="0.4"
          strokeWidth="1.5"
        />
      )}

      <path
        d="M32 15 C32 9, 36 6, 42 5"
        stroke={sproutColor}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M39 6 C43 2, 51 3, 52 9 C48 13, 41 12, 39 6 Z"
        fill={sproutColor}
      />

      <path
        d="M17 30 C17 22, 47 22, 47 30 C47 44, 39 54, 32 58 C25 54, 17 44, 17 30 Z"
        fill={bodyColor}
        fillOpacity={isMono ? 0.85 : 1}
      />

      <path
        d="M11 28 C11 15, 21 13, 32 13 C43 13, 53 15, 53 28 C46 32, 18 32, 11 28 Z"
        fill={capColor}
      />
      <path
        d="M10 27 C19 31, 45 31, 54 27 C55 30, 53 32, 49 33 C38 35, 26 35, 15 33 C11 32, 9 30, 10 27 Z"
        fill={capColor}
      />
    </svg>
  );

  if (
    variant === "mark" ||
    variant === "favicon" ||
    variant === "app-icon" ||
    variant === "monochrome"
  ) {
    return (
      <span className={`inline-flex items-center ${className}`} aria-label="Acorn">
        {MarkSvg}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {MarkSvg}
      <span
        className={`font-serif-editorial text-2xl sm:text-[28px] tracking-tight leading-none ${textColor}`}
      >
        Acorn
      </span>
    </span>
  );
};

export interface AcornAvatarProps {
  state?: AcornMascotState;
  size?: number;
  badgeColor?: string;
}

export const AcornAvatar: React.FC<AcornAvatarProps> = ({
  state = "watching",
  size = 40,
  badgeColor = "#72D65C",
}) => {
  return (
    <div
      className="relative inline-flex items-center justify-center rounded-full bg-[#21170F] border border-[#E39A58]/30 shadow-inner shrink-0"
      style={{ width: size, height: size }}
    >
      <AcornMascot state={state} size={Math.round(size * 0.84)} />
      <span
        className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#0B0A08]"
        style={{ backgroundColor: badgeColor }}
        aria-hidden="true"
      />
    </div>
  );
};
