/**
 * Acorn Founder Administration Controller
 * Implements Telegram bot administrative commands restricted to the verified Founder.
 * Commands: /admin, /newkey, /keys, /keyinfo, /revoke_key, /revoke_user, /testers, /grant_access
 */

import { ActivationService } from "./service.js";
import { isFounder } from "./auth.js";

export class FounderAdminController {
  constructor(env, messenger) {
    this.env = env;
    this.messenger = messenger; // { sendMessage, sendTyping }
    this.service = new ActivationService(env);
  }

  /**
   * Routes administrative commands and callbacks.
   */
  async handleAdminCommand(chatId, text, env) {
    if (!isFounder(chatId, env)) {
      return false;
    }

    const trimmed = text.trim();
    const [cmd, ...args] = trimmed.split(/\s+/);

    if (cmd === "/admin") {
      await this.showAdminMenu(chatId);
      return true;
    }

    if (cmd === "/newkey") {
      await this.handleNewKey(chatId, args);
      return true;
    }

    if (cmd === "/keys") {
      await this.handleListKeys(chatId);
      return true;
    }

    if (cmd === "/keyinfo") {
      await this.handleKeyInfo(chatId, args[0]);
      return true;
    }

    if (cmd === "/revoke_key") {
      await this.handleRevokeKey(chatId, args[0]);
      return true;
    }

    if (cmd === "/revoke_user") {
      await this.handleRevokeUser(chatId, args[0]);
      return true;
    }

    if (cmd === "/testers") {
      await this.handleTesterStats(chatId);
      return true;
    }

    if (cmd === "/grant_access") {
      await this.handleGrantAccess(chatId, args[0]);
      return true;
    }

    return false;
  }

  async showAdminMenu(chatId) {
    const text = (
      "👑 <b>Acorn Founder Administration Hub</b>\n\n" +
      "Manage controlled beta access and tester admission:\n\n" +
      "• <code>/newkey [label] [capacity]</code> — Issue single-use or multi-user key\n" +
      "• <code>/keys</code> — View recent activation keys & usage\n" +
      "• <code>/testers</code> — View tester quotas & active counts\n" +
      "• <code>/grant_access &lt;telegram_id&gt;</code> — Whitelist a tester directly\n" +
      "• <code>/revoke_key &lt;key_id&gt;</code> — Close an activation key\n" +
      "• <code>/revoke_user &lt;telegram_id&gt;</code> — Deactivate a tester\n\n" +
      "<i>All admin actions are audited with cryptographic verification.</i>"
    );

    await this.messenger.sendMessage(chatId, text, this.env, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🔑 Generate Single-Use Key", callback_data: "admin_newkey_1" },
            { text: "👥 Generate 5-User Key", callback_data: "admin_newkey_5" },
          ],
          [
            { text: "📊 Tester Statistics", callback_data: "admin_testers" },
            { text: "📋 Active Keys", callback_data: "admin_list_keys" },
          ],
        ],
      },
    });
  }

  async handleNewKey(chatId, args) {
    const label = args[0] || "Acorn Beta Tester";
    const capacity = parseInt(args[1], 10) || 1;

    const result = await this.service.createKey({
      label,
      capacity,
      createdBy: String(chatId),
    });

    const reply = (
      `🔑 <b>Activation Key Generated Successfully!</b>\n\n` +
      `<b>Label:</b> ${result.label}\n` +
      `<b>Capacity:</b> ${result.capacity} user${result.capacity > 1 ? "s" : ""}\n` +
      `<b>Redemption Expires:</b> ${result.redeemExpiresAt ? result.redeemExpiresAt.slice(0, 10) : "Never"}\n` +
      `<b>Key ID:</b> <code>${result.keyId}</code>\n\n` +
      `📋 <b>One-Time Secret Key:</b>\n<code>${result.rawKey}</code>\n\n` +
      `⚠️ <i>Send this key directly to your tester in private. It is never stored in plaintext and cannot be recovered!</i>`
    );

    await this.messenger.sendMessage(chatId, reply, this.env);
  }

  async handleListKeys(chatId) {
    const keys = await this.service.listKeys(10);
    if (!keys || keys.length === 0) {
      await this.messenger.sendMessage(
        chatId,
        "📋 <b>Activation Keys:</b>\n\nNo activation keys have been created yet. Use <code>/newkey</code> to issue one.",
        this.env
      );
      return;
    }

    let msg = `📋 <b>Recent Activation Keys (${keys.length}):</b>\n\n`;
    for (const k of keys) {
      const statusIcon = k.revoked_at ? "🚫 Revoked" : k.redemption_count >= k.max_redemptions ? "🔒 Full" : "🟢 Active";
      msg += `• <b>${k.label}</b> (${statusIcon})\n`;
      msg += `  ID: <code>${k.id}</code>\n`;
      msg += `  Redemptions: <b>${k.redemption_count} / ${k.max_redemptions}</b>\n\n`;
    }

    await this.messenger.sendMessage(chatId, msg, this.env);
  }

  async handleTesterStats(chatId) {
    const stats = await this.service.getTesterStats();
    const reply = (
      "📊 <b>Acorn Beta Tester Quotas & Activity:</b>\n\n" +
      `• 🟢 <b>Active Testers:</b> ${stats.activeTesters}\n` +
      `• 🚫 <b>Revoked Testers:</b> ${stats.revokedTesters}\n` +
      `• ⏳ <b>Expired Grants:</b> ${stats.expiredTesters}\n` +
      `• 🔑 <b>Total Key Capacity:</b> ${stats.totalCapacity}\n` +
      `• 🎟️ <b>Redeemed Capacity:</b> ${stats.redeemedCapacity}\n` +
      `• 📦 <b>Remaining Key Slots:</b> ${Math.max(0, stats.totalCapacity - stats.redeemedCapacity)}`
    );

    await this.messenger.sendMessage(chatId, reply, this.env);
  }

  async handleRevokeKey(chatId, keyId) {
    if (!keyId) {
      await this.messenger.sendMessage(chatId, "⚠️ Usage: <code>/revoke_key &lt;key_id&gt;</code>", this.env);
      return;
    }
    await this.service.revokeKey(keyId, String(chatId));
    await this.messenger.sendMessage(chatId, `🚫 Key <code>${keyId}</code> has been revoked from future redemptions.`, this.env);
  }

  async handleRevokeUser(chatId, targetTelegramId) {
    if (!targetTelegramId) {
      await this.messenger.sendMessage(chatId, "⚠️ Usage: <code>/revoke_user &lt;telegram_id&gt;</code>", this.env);
      return;
    }
    await this.service.revokeUser(targetTelegramId, String(chatId));
    await this.messenger.sendMessage(
      chatId,
      `🚫 Access grant for Telegram ID <code>${targetTelegramId}</code> has been revoked immediately.`,
      this.env
    );
  }

  async handleGrantAccess(chatId, targetTelegramId) {
    if (!targetTelegramId) {
      await this.messenger.sendMessage(chatId, "⚠️ Usage: <code>/grant_access &lt;telegram_id&gt;</code>", this.env);
      return;
    }
    await this.service.grantAccessDirect(targetTelegramId, String(chatId));
    await this.messenger.sendMessage(
      chatId,
      `✅ Direct access granted for Telegram ID <code>${targetTelegramId}</code>.`,
      this.env
    );
  }
}
