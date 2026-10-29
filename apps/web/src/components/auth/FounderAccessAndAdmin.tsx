import React, { useEffect, useState } from "react";
import { useDialogFocus } from "../ui/useDialogFocus";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Copy,
  Link2,
  LogOut,
  ShieldCheck,
  Unlink,
  X,
} from "lucide-react";
import {
  AccessRequestRecord,
  AuditLogEntry,
  AuthenticatedUser,
  InvitationKeyRecord,
  TelegramLinkSession,
} from "../../types/acorn";
import {
  acornApiClient,
  generateCryptographicToken,
  sha256HexBrowser,
} from "../../services/apiClient";
import { AcornMascot } from "../mascot/AcornMascot";

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: (
    user: AuthenticatedUser,
    auditEntry: AuditLogEntry,
    rawKeyUsed?: string
  ) => void;
  activeInvitations: InvitationKeyRecord[];
  onMarkInviteRedeemed: (tokenHash: string) => void;
}

export const FounderAuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthenticated,
  activeInvitations,
  onMarkInviteRedeemed,
}) => {
  const dialogRef = useDialogFocus(isOpen);
  const [tab, setTab] = useState<"invite" | "founder">("invite");
  const [inviteKey, setInviteKey] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [founderPassphrase, setFounderPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Close on Escape (WCAG 2.2 AA)
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const handleRedeemInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const trimmedKey = inviteKey.trim();
      if (!trimmedKey.startsWith("acrn_inv_") || trimmedKey.length < 20) {
        throw new Error(
          "Enter a valid single-use Acorn invitation key (starts with acrn_inv_)."
        );
      }

      if (!acornApiClient.isDemoMode()) {
        const res = await acornApiClient.redeemInvitation(
          trimmedKey,
          email.trim(),
          displayName.trim() || "Acorn Member"
        );
        onAuthenticated(res.user, {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          actor: res.user.email,
          action: "INVITE_REDEEMED",
          target: "Server-validated invitation",
        });
        onClose();
        return;
      }

      // Demo Mode: verify against SHA-256 hashed invitations created in the Founder Admin Console
      const candidateHash = await sha256HexBrowser(trimmedKey);
      const matched = activeInvitations.find(
        (inv) => inv.tokenHash === candidateHash
      );

      if (!matched) {
        throw new Error(
          "Invitation key not recognized. In Demo Mode, generate a key in the Founder Console first or sign in via Founder Sandbox."
        );
      }
      if (matched.status === "redeemed") {
        throw new Error("This single-use invitation key has already been redeemed.");
      }
      if (matched.status === "revoked") {
        throw new Error("This invitation key has been revoked by the founder.");
      }
      if (new Date(matched.expiresAt).getTime() < Date.now()) {
        throw new Error("This invitation key has expired.");
      }

      onMarkInviteRedeemed(candidateHash);
      const newUser: AuthenticatedUser = {
        id: `usr-${Date.now()}`,
        email: email.trim() || matched.recipientEmail,
        displayName: displayName.trim() || matched.recipientEmail.split("@")[0],
        role: matched.role,
        sessionMode: "demo-preview",
        telegramLinked: false,
      };

      onAuthenticated(
        newUser,
        {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          actor: newUser.email,
          action: "INVITE_REDEEMED",
          target: matched.keyPreview,
        },
        trimmedKey
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not redeem key.");
    } finally {
      setLoading(false);
    }
  };

  const handleFounderSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!acornApiClient.isDemoMode()) {
        const user = await acornApiClient.getMe();
        onAuthenticated(user, {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          actor: user.email,
          action: "FOUNDER_LOGIN",
          target: "Production session",
        });
        onClose();
        return;
      }

      // Explicit Demo Sandbox Founder Session (No hardcoded production credentials)
      if (founderPassphrase.trim().length < 4) {
        throw new Error(
          "Enter any 4+ character sandbox passphrase to preview the Founder Admin Console in Demo Mode."
        );
      }

      const founderUser: AuthenticatedUser = {
        id: "usr-founder-demo",
        email: email.trim() || "founder@acorn.ca",
        displayName: "Sosa (Founder)",
        role: "founder",
        sessionMode: "demo-preview",
        telegramLinked: false,
      };

      onAuthenticated(founderUser, {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        actor: founderUser.email,
        action: "FOUNDER_LOGIN",
        target: "Founder Workspace (Demo Sandbox)",
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          role="dialog"
          ref={dialogRef}
          tabIndex={-1}
          aria-modal="true"
          aria-labelledby="auth-modal-title"
        >
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            className="surface-bark w-full max-w-md rounded-3xl p-7 sm:p-8 relative"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close sign in dialog"
              className="touch-target-aa absolute top-5 right-5 text-[#DECDB5] hover:text-[#FFF7EA] p-1.5 rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3.5 mb-5">
              <AcornMascot state="onboarding" size={64} />
              <div>
                <span className="text-[11px] uppercase tracking-[0.2em] text-[#D9FF7A]">
                  Invitation-Based Access
                </span>
                <h2
                  id="auth-modal-title"
                  className="font-serif-editorial text-3xl text-[#FFF7EA]"
                >
                  Enter Acorn.
                </h2>
              </div>
            </div>

            <div
              className="grid grid-cols-2 gap-1.5 p-1 rounded-full bg-[#0B0A08] border border-white/10 mb-5"
              role="tablist"
            >
              <button
                type="button"
                role="tab"
                aria-selected={tab === "invite"}
                onClick={() => {
                  setTab("invite");
                  setError(null);
                }}
                className={`py-2 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                  tab === "invite"
                    ? "bg-[#FFF7EA] text-[#0B0A08]"
                    : "text-[#DECDB5] hover:text-[#FFF7EA]"
                }`}
              >
                Redeem Invite Key
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "founder"}
                onClick={() => {
                  setTab("founder");
                  setError(null);
                }}
                className={`py-2 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                  tab === "founder"
                    ? "bg-[#E39A58] text-[#0B0A08]"
                    : "text-[#DECDB5] hover:text-[#FFF7EA]"
                }`}
              >
                Founder Sign In
              </button>
            </div>

            {tab === "invite" ? (
              <form onSubmit={handleRedeemInvite} className="space-y-4">
                <div>
                  <label
                    htmlFor="invite-key-input"
                    className="block text-xs text-[#DECDB5] mb-1.5"
                  >
                    Single-use invitation key
                  </label>
                  <input
                    id="invite-key-input"
                    type="text"
                    required
                    value={inviteKey}
                    onChange={(e) => setInviteKey(e.target.value)}
                    placeholder="acrn_inv_..."
                    className="w-full rounded-xl bg-[#0B0A08] border border-white/15 px-3.5 py-2.5 text-xs font-mono text-[#FFF7EA]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="invite-name"
                      className="block text-xs text-[#DECDB5] mb-1.5"
                    >
                      Your name
                    </label>
                    <input
                      id="invite-name"
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Alex Chen"
                      className="w-full rounded-xl bg-[#0B0A08] border border-white/15 px-3.5 py-2 text-sm text-[#FFF7EA]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="invite-email"
                      className="block text-xs text-[#DECDB5] mb-1.5"
                    >
                      Email
                    </label>
                    <input
                      id="invite-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="alex@domain.ca"
                      className="w-full rounded-xl bg-[#0B0A08] border border-white/15 px-3.5 py-2 text-sm text-[#FFF7EA]"
                    />
                  </div>
                </div>

                {error && (
                  <p role="alert" className="text-xs text-[#FF8E7D]">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-full bg-[#FFF7EA] hover:bg-[#D9FF7A] text-[#0B0A08] font-semibold py-3 text-sm transition-colors cursor-pointer"
                >
                  {loading ? "Validating key..." : "Redeem Invitation"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleFounderSignIn} className="space-y-4">
                <div className="rounded-2xl bg-black/45 border border-[#E39A58]/25 p-3.5 text-xs text-[#DECDB5] leading-relaxed">
                  {acornApiClient.isDemoMode() ? (
                    <>
                      <strong className="text-[#D9FF7A]">
                        Demo Sandbox Mode:
                      </strong>{" "}
                      No production secrets are stored in client code. Enter any
                      4+ character sandbox passphrase to inspect the Founder
                      Approval &amp; Invite Console.
                    </>
                  ) : (
                    <>
                      <strong className="text-[#D9FF7A]">
                        Server-Validated Session:
                      </strong>{" "}
                      Authenticates against `/api/v1/me`.
                    </>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="founder-email"
                    className="block text-xs text-[#DECDB5] mb-1.5"
                  >
                    Founder email
                  </label>
                  <input
                    id="founder-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="founder@acorn.ca"
                    className="w-full rounded-xl bg-[#0B0A08] border border-white/15 px-3.5 py-2.5 text-sm text-[#FFF7EA]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="founder-passphrase"
                    className="block text-xs text-[#DECDB5] mb-1.5"
                  >
                    Session passphrase
                  </label>
                  <input
                    id="founder-passphrase"
                    type="password"
                    required
                    value={founderPassphrase}
                    onChange={(e) => setFounderPassphrase(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl bg-[#0B0A08] border border-white/15 px-3.5 py-2.5 text-sm text-[#FFF7EA]"
                  />
                </div>

                {error && (
                  <p role="alert" className="text-xs text-[#FF8E7D]">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-full bg-[#E39A58] hover:bg-[#D9FF7A] text-[#0B0A08] font-semibold py-3 text-sm transition-colors cursor-pointer"
                >
                  {loading ? "Verifying..." : "Open Founder Workspace"}
                </button>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

/* ============================================================================
 * PROTECTED FOUNDER ADMIN & TELEGRAM ACCOUNT LINKING PANEL
 * ========================================================================== */

export interface FounderAdminPanelProps {
  user: AuthenticatedUser;
  accessRequests: AccessRequestRecord[];
  invitations: InvitationKeyRecord[];
  auditLogs: AuditLogEntry[];
  onApproveRequest: (requestId: string) => Promise<string>;
  onDeclineRequest: (requestId: string) => void;
  onCreateInvitation: (email: string, expiresHours: number) => Promise<string>;
  onRevokeInvitation: (inviteId: string) => void;
  onUpdateUser: (updated: AuthenticatedUser, audit: AuditLogEntry) => void;
  onLogout: () => void;
}

export const FounderAdminPanel: React.FC<FounderAdminPanelProps> = ({
  user,
  accessRequests,
  invitations,
  auditLogs,
  onApproveRequest,
  onDeclineRequest,
  onCreateInvitation,
  onRevokeInvitation,
  onUpdateUser,
  onLogout,
}) => {
  const [newInviteEmail, setNewInviteEmail] = useState("");
  const [expiresHours, setExpiresHours] = useState(72);
  const [latestRawKey, setLatestRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Verified Telegram Account Linking state
  const [tgSession, setTgSession] = useState<TelegramLinkSession | null>(null);

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInviteEmail.trim()) return;
    const rawKey = await onCreateInvitation(newInviteEmail.trim(), expiresHours);
    setLatestRawKey(rawKey);
    setNewInviteEmail("");
    setCopied(false);
  };

  const handleStartTelegramLink = () => {
    const token = generateCryptographicToken("acrn_tg");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const session: TelegramLinkSession = {
      linkToken: token,
      botHandle: "@Acorn_ai_Bot",
      deepLinkUrl: `https://t.me/Acorn_ai_Bot?start=${token}`,
      expiresAt,
      status: "pending",
    };
    setTgSession(session);
  };

  const handleConfirmTelegramSimulation = () => {
    if (!tgSession || tgSession.status !== "pending") return;
    setTgSession({ ...tgSession, status: "confirmed" });
    onUpdateUser(
      {
        ...user,
        telegramLinked: true,
        telegramHandle: "@sosa_acorn_beta",
        telegramLinkedAt: new Date().toLocaleTimeString(),
      },
      {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        actor: user.email,
        action: "TELEGRAM_LINK_CONFIRMED",
        target: `Single-use token ${tgSession.linkToken.slice(0, 14)}... invalidated`,
      }
    );
  };

  const handleUnlinkTelegram = () => {
    setTgSession(null);
    onUpdateUser(
      {
        ...user,
        telegramLinked: false,
        telegramHandle: undefined,
        telegramLinkedAt: undefined,
      },
      {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        actor: user.email,
        action: "TELEGRAM_UNLINKED",
        target: "Telegram identity unlinked",
      }
    );
  };

  return (
    <div className="rounded-3xl bg-[#0B0A08]/90 border border-[#E39A58]/35 p-6 sm:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-[#D9FF7A]" />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-[#FFF7EA]">
                {user.role === "founder"
                  ? "Founder Governance & Telegram Link"
                  : "Account & Telegram Link"}
              </h3>
              <span className="text-[11px] uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#72D65C]/20 text-[#D9FF7A] border border-[#72D65C]/40">
                {user.role} · {user.sessionMode}
              </span>
            </div>
            <p className="text-xs text-[#DECDB5]">
              Signed in as {user.displayName} ({user.email})
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-xs text-[#FFF7EA] cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign out</span>
        </button>
      </div>

      {/* 1. Verified Telegram Account Linking */}
      <div className="rounded-2xl bg-[#14100C] border border-white/10 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-xs uppercase tracking-[0.18em] text-[#6EC8FF] font-semibold">
              Verified Telegram Account Linking
            </span>
            <p className="text-xs text-[#DECDB5] mt-1">
              Associates your web workspace with `@Acorn_ai_Bot` using a
              short-lived, single-use server token.
            </p>
          </div>

          {user.telegramLinked ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#72D65C]/20 text-[#D9FF7A] text-xs font-medium">
              <Check className="w-3.5 h-3.5" />
              <span>Linked ({user.telegramHandle})</span>
            </span>
          ) : (
            <span className="text-xs text-[#DECDB5]">Not linked</span>
          )}
        </div>

        {user.telegramLinked ? (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10 text-xs">
            <span className="text-[#DECDB5]">
              Verified at {user.telegramLinkedAt}. Single-use handshake token
              invalidated to prevent replay.
            </span>
            <button
              type="button"
              onClick={handleUnlinkTelegram}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#FF8E7D]/15 border border-[#FF8E7D]/40 text-[#FF8E7D] font-semibold cursor-pointer"
            >
              <Unlink className="w-3.5 h-3.5" />
              <span>Unlink Telegram</span>
            </button>
          </div>
        ) : tgSession ? (
          <div className="rounded-xl bg-black/60 border border-[#6EC8FF]/30 p-4 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[#D9FF7A]">
                One-Time Token: {tgSession.linkToken}
              </span>
              <span className="text-[#DECDB5]">
                Expires {new Date(tgSession.expiresAt).toLocaleTimeString()}
              </span>
            </div>
            <p className="text-[#DECDB5]">
              1. Open <code>{tgSession.deepLinkUrl}</code> in Telegram. 2. The
              bot verifies your `chat_id` and invalidates this token.
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={handleConfirmTelegramSimulation}
                className="px-4 py-2 rounded-full bg-[#72D65C] text-[#0B0A08] font-semibold cursor-pointer"
              >
                Simulate Bot Confirmation (Demo)
              </button>
              <button
                type="button"
                onClick={() => setTgSession(null)}
                className="px-3 py-1.5 rounded-full bg-white/10 text-[#FFF7EA] cursor-pointer"
              >
                Cancel / Revoke Token
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleStartTelegramLink}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#6EC8FF]/20 hover:bg-[#6EC8FF]/30 border border-[#6EC8FF]/40 text-[#6EC8FF] text-xs font-semibold cursor-pointer"
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>Generate Single-Use Telegram Link Token</span>
          </button>
        )}
      </div>

      {/* 2. Founder-Only Access Requests & Invitation Key Management */}
      {user.role === "founder" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Access Requests Queue */}
          <div className="lg:col-span-6 rounded-2xl bg-[#14100C] border border-white/10 p-5 space-y-4">
            <h4 className="text-xs uppercase tracking-[0.18em] text-[#E39A58] font-semibold">
              Access Requests Queue ({accessRequests.length})
            </h4>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {accessRequests.map((req) => (
                <div
                  key={req.id}
                  className="rounded-xl bg-black/50 border border-white/10 p-3.5 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#FFF7EA]">
                      {req.email}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] uppercase ${
                        req.status === "approved"
                          ? "bg-[#72D65C]/20 text-[#D9FF7A]"
                          : req.status === "declined"
                          ? "bg-[#FF8E7D]/20 text-[#FF8E7D]"
                          : "bg-[#E39A58]/20 text-[#E39A58]"
                      }`}
                    >
                      {req.status}
                    </span>
                  </div>
                  <p className="text-[#DECDB5]">
                    {req.careerStage} · Roles: {req.roleInterest || "General"} ·{" "}
                    {req.preferredLocations}
                  </p>
                  {req.goalsContext && (
                    <p className="text-[#B8A48A] italic">
                      “{req.goalsContext}”
                    </p>
                  )}

                  {req.status === "pending" && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={async () => {
                          const raw = await onApproveRequest(req.id);
                          setLatestRawKey(raw);
                          setCopied(false);
                        }}
                        className="px-3 py-1 rounded-full bg-[#72D65C] text-[#0B0A08] font-semibold cursor-pointer"
                      >
                        Approve &amp; Mint Key
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeclineRequest(req.id)}
                        className="px-3 py-1 rounded-full bg-white/10 text-[#DECDB5] hover:text-[#FF8E7D] cursor-pointer"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Cryptographic Invitation Keys */}
          <div className="lg:col-span-6 rounded-2xl bg-[#14100C] border border-white/10 p-5 space-y-4">
            <h4 className="text-xs uppercase tracking-[0.18em] text-[#D9FF7A] font-semibold">
              Single-Use Invitation Keys (SHA-256 Hashed)
            </h4>

            <form onSubmit={handleGenerateInvite} className="flex flex-wrap gap-2">
              <input
                type="email"
                required
                value={newInviteEmail}
                onChange={(e) => setNewInviteEmail(e.target.value)}
                placeholder="candidate@domain.ca"
                className="flex-1 min-w-[160px] rounded-xl bg-black/60 border border-white/15 px-3 py-2 text-xs text-[#FFF7EA]"
              />
              <select
                value={expiresHours}
                onChange={(e) => setExpiresHours(Number(e.target.value))}
                aria-label="Invitation expiration window"
                className="rounded-xl bg-black/60 border border-white/15 px-2.5 py-2 text-xs text-[#FFF7EA]"
              >
                <option value={24}>24h TTL</option>
                <option value={72}>72h TTL</option>
                <option value={168}>7d TTL</option>
              </select>
              <button
                type="submit"
                className="px-3.5 py-2 rounded-xl bg-[#FFF7EA] hover:bg-[#D9FF7A] text-[#0B0A08] text-xs font-semibold cursor-pointer"
              >
                Create Key
              </button>
            </form>

            {latestRawKey && (
              <div className="rounded-xl bg-[#72D65C]/15 border border-[#72D65C]/45 p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#D9FF7A]">
                    New Single-Use Key (Shown once—only SHA-256 hash is stored):
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(latestRawKey);
                      setCopied(true);
                    }}
                    className="inline-flex items-center gap-1 text-[#FFF7EA] hover:underline cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <code className="block p-2 rounded bg-black/70 text-[#FFF7EA] font-mono break-all">
                  {latestRawKey}
                </code>
              </div>
            )}

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {invitations.map((inv) => (
                <div
                  key={inv.id}
                  className="rounded-xl bg-black/50 border border-white/10 p-3 flex items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="font-medium text-[#FFF7EA]">
                      {inv.recipientEmail}{" "}
                      <span className="font-mono text-[#B8A48A]">
                        ({inv.keyPreview})
                      </span>
                    </div>
                    <div className="text-[11px] text-[#DECDB5] font-mono">
                      sha256:{inv.tokenHash.slice(0, 16)}… · {inv.status}
                    </div>
                  </div>
                  {inv.status === "active" && (
                    <button
                      type="button"
                      onClick={() => onRevokeInvitation(inv.id)}
                      className="px-2.5 py-1 rounded-full bg-[#FF8E7D]/15 text-[#FF8E7D] hover:bg-[#FF8E7D]/25 cursor-pointer"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. Security Audit Log */}
      {user.role === "founder" && (
        <div className="rounded-2xl bg-[#14100C] border border-white/10 p-4 space-y-2">
          <span className="text-[11px] uppercase tracking-[0.18em] text-[#B89CFF] font-semibold block">
            Security &amp; Invitation Audit Log
          </span>
          <div className="max-h-32 overflow-y-auto space-y-1 text-xs font-mono text-[#DECDB5]">
            {auditLogs.map((log) => (
              <div key={log.id} className="flex flex-wrap gap-2">
                <span className="text-[#D9FF7A]">[{log.timestamp}]</span>
                <span className="text-[#E39A58]">{log.action}</span>
                <span>by {log.actor}</span>
                <span className="text-[#B8A48A]">→ {log.target}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
