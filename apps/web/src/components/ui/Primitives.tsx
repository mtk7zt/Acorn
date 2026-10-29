import React, { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { ArrowUpRight, Compass, KeyRound, Layers, ShieldCheck } from "lucide-react";
import { AcornLogo } from "../mascot/AcornLogo";
import { AuthenticatedUser } from "../../types/acorn";

export const SectionLabel: React.FC<{
  children: React.ReactNode;
  accent?: "sprout" | "signal" | "copper" | "violet" | "sky";
}> = ({ children, accent = "signal" }) => {
  const dotColors = {
    sprout: "bg-[#72D65C]",
    signal: "bg-[#D9FF7A]",
    copper: "bg-[#E39A58]",
    violet: "bg-[#B89CFF]",
    sky: "bg-[#6EC8FF]",
  };

  return (
    <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#21170F]/85 border border-[#E39A58]/20 text-[11px] uppercase tracking-[0.22em] text-[#FFF7EA]/90 font-medium">
      <span
        className={`w-1.5 h-1.5 rounded-full ${dotColors[accent]}`}
        aria-hidden="true"
      />
      <span>{children}</span>
    </div>
  );
};

export const EditorialHeading: React.FC<{
  children: React.ReactNode;
  id?: string;
  className?: string;
}> = ({ children, id, className = "" }) => (
  <h2
    id={id}
    className={`font-serif-editorial text-4xl sm:text-6xl md:text-[4.25rem] leading-[0.98] tracking-tight text-[#FFF7EA] ${className}`}
  >
    {children}
  </h2>
);

export const LiquidGlass: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = "" }) => (
  <div className={`liquid-glass ${className}`}>{children}</div>
);

export const ParticleField: React.FC<{ density?: number }> = ({
  density = 28,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let isPaused = false;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const colors = ["#D9FF7A", "#E39A58", "#72D65C", "#FFF7EA"];
    const particles = Array.from({ length: density }, (_, idx) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.16,
      vy: -Math.random() * 0.22 - 0.05,
      r: Math.random() * 1.6 + 0.6,
      alpha: Math.random() * 0.35 + 0.1,
      color: colors[idx % colors.length],
    }));

    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const onVisibilityChange = () => {
      isPaused = document.hidden;
    };

    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibilityChange);

    const draw = () => {
      if (!isPaused) {
        ctx.clearRect(0, 0, width, height);
        for (const p of particles) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.y < -10) p.y = height + 10;
          if (p.x < -10) p.x = width + 10;
          if (p.x > width + 10) p.x = -10;

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      animId = window.requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.cancelAnimationFrame(animId);
    };
  }, [prefersReducedMotion, density]);

  if (prefersReducedMotion) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-0"
      aria-hidden="true"
    />
  );
};

export interface NavbarProps {
  activeView: "story" | "app" | "design-system";
  onNavigateView: (view: "story" | "app" | "design-system") => void;
  onOpenRequestAccess: () => void;
  currentUser?: AuthenticatedUser | null;
  onOpenAuthModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeView,
  onNavigateView,
  onOpenRequestAccess,
  currentUser,
  onOpenAuthModal,
}) => {
  return (
    <header className="fixed top-4 left-0 right-0 z-40 px-4 sm:px-6 flex justify-center pointer-events-none">
      <nav
        aria-label="Primary navigation"
        className="liquid-glass pointer-events-auto rounded-full px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3 sm:gap-6 max-w-7xl w-full whitespace-nowrap"
      >
        <button
          type="button"
          onClick={() => {
            onNavigateView("story");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="cursor-pointer focus:outline-none shrink-0"
          aria-label="Acorn Home"
        >
          <span className="sm:hidden"><AcornLogo variant="mark" size={28} /></span>
          <span className="hidden sm:inline-flex"><AcornLogo variant="wordmark" size={28} /></span>
        </button>

        {activeView === "story" ? (
          <ul className="hidden xl:flex items-center gap-4 text-sm text-[#DECDB5]">
            <li>
              <a href="#product" className="hover:text-[#FFF7EA] transition-colors">
                Product
              </a>
            </li>
            <li>
              <a href="#how-it-works" className="hover:text-[#FFF7EA] transition-colors">
                How it works
              </a>
            </li>
            <li>
              <a href="#fit-check" className="hover:text-[#FFF7EA] transition-colors">
                Fit Check
              </a>
            </li>
            <li>
              <a href="#everywhere" className="hover:text-[#FFF7EA] transition-colors">
                Everywhere
              </a>
            </li>
            <li>
              <a href="#privacy" className="hover:text-[#FFF7EA] transition-colors">
                Privacy
              </a>
            </li>
          </ul>
        ) : (
          <div className="hidden xl:flex items-center gap-2 text-xs text-[#E39A58]">
            <span className="w-2 h-2 rounded-full bg-[#72D65C]" />
            <span>
              {activeView === "app"
                ? currentUser
                  ? `Workspace · ${currentUser.displayName}`
                  : "Acorn Product Prototype (Demo Mode)"
                : "Acorn Brand & Design System (/design-system)"}
            </span>
          </div>
        )}

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() =>
              onNavigateView(activeView === "app" ? "story" : "app")
            }
            aria-label={activeView === "app" ? "Back to Story" : "Workspace"}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 sm:px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer border ${
              activeView === "app"
                ? "bg-[#72D65C]/20 border-[#72D65C]/50 text-[#D9FF7A]"
                : "bg-[#21170F]/80 hover:bg-[#2E2015] border-[#E39A58]/25 text-[#FFF7EA]/90"
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-[#72D65C]" />
            <span className="hidden sm:inline">{activeView === "app" ? "Back to Story" : "Workspace"}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onNavigateView(
                activeView === "design-system" ? "story" : "design-system"
              )
            }
            aria-label="Design System"
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 sm:px-3 py-1.5 text-xs font-medium transition-all cursor-pointer border ${
              activeView === "design-system"
                ? "bg-[#E39A58]/25 border-[#E39A58] text-[#FFF7EA]"
                : "bg-white/[0.04] hover:bg-white/[0.09] border-white/10 text-[#DECDB5]"
            }`}
            title="View /design-system artifact"
          >
            <Layers className="w-3.5 h-3.5 text-[#E39A58]" />
            <span className="hidden sm:inline">Design System</span>
          </button>

          {onOpenAuthModal && (
            <button
              type="button"
              onClick={() =>
                currentUser ? onNavigateView("app") : onOpenAuthModal()
              }
              aria-label={currentUser ? "Account" : "Sign In"}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 sm:px-3 py-1.5 text-xs font-medium bg-white/[0.05] hover:bg-white/[0.1] border border-white/15 text-[#FFF7EA] cursor-pointer"
              title={
                currentUser
                  ? `Signed in as ${currentUser.displayName}`
                  : "Founder Sign In or Redeem Invite Key"
              }
            >
              {currentUser ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-[#D9FF7A]" />
                  <span className="hidden sm:inline">
                    {currentUser.role === "founder" ? "Founder" : "Member"}
                  </span>
                </>
              ) : (
                <>
                  <KeyRound className="w-3.5 h-3.5 text-[#E39A58]" />
                  <span className="hidden sm:inline">Sign In</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onOpenRequestAccess}
            aria-label="Request Access"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF7EA] hover:bg-[#D9FF7A] text-[#0B0A08] px-3.5 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
          >
            <span className="hidden sm:inline">Request Access</span>
            <span className="sm:hidden">Access</span>
            <ArrowUpRight className="hidden sm:block w-3.5 h-3.5" />
          </button>
        </div>
      </nav>
    </header>
  );
};
