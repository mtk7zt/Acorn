/**
 * Acorn Profile & Onboarding Controller
 * =====================================
 * Handles personalized Telegram commands:
 *   /profile, /setroles, /setlocations, /preferences, /exportprofile, /uploadresume, /deleteresume
 */

import { IdentityService } from "./identity.js";
import { ProfileRepository } from "./repository.js";

export class ProfileController {
  constructor(env, messenger) {
    this.env = env;
    this.messenger = messenger; // { sendMessage, sendTyping }
    this.identityService = new IdentityService(env);
    this.repo = new ProfileRepository(env);
  }

  async handleProfileCommand(chatId, text, env) {
    const trimmed = text.trim();
    const [cmd, ...args] = trimmed.split(/\s+/);
    const { acornUserId } = await this.identityService.getOrCreateUserByTelegram(chatId);

    if (cmd === "/profile") {
      await this.showProfile(chatId, acornUserId);
      return true;
    }

    if (cmd === "/setroles") {
      const rolesInput = args.join(" ").trim();
      if (!rolesInput) {
        await this.promptRoles(chatId);
      } else {
        const roles = rolesInput.split(",").map((s) => s.trim()).filter(Boolean);
        await this.repo.setUserRoles(acornUserId, roles);
        await this.messenger.sendMessage(
          chatId,
          `✅ <b>Target Roles Updated!</b>\n\nAcorn is now watching for:\n${roles.map((r, i) => `${i + 1}. <b>${r}</b>`).join("\n")}\n\n<i>Type /scan to run a personalized job search!</i>`,
          this.env
        );
      }
      return true;
    }

    if (cmd === "/setlocations") {
      const locsInput = args.join(" ").trim();
      if (!locsInput) {
        await this.messenger.sendMessage(
          chatId,
          "📍 <b>Set Preferred Search Locations:</b>\n\nUsage: <code>/setlocations Toronto, Mississauga, Remote</code>",
          this.env
        );
      } else {
        const locations = locsInput.split(",").map((s) => s.trim()).filter(Boolean);
        await this.repo.updateSearchPreferences(acornUserId, { preferred_locations: locations });
        await this.messenger.sendMessage(
          chatId,
          `✅ <b>Locations Updated:</b>\n\nSearching in: <b>${locations.join(", ")}</b>`,
          this.env
        );
      }
      return true;
    }

    if (cmd === "/preferences") {
      await this.showPreferences(chatId, acornUserId);
      return true;
    }

    if (cmd === "/exportprofile") {
      const data = await this.repo.exportProfile(acornUserId);
      const jsonStr = JSON.stringify(data, null, 2);
      await this.messenger.sendMessage(
        chatId,
        `📦 <b>Your Portable Acorn Profile (v1.0):</b>\n\n<pre><code>${jsonStr}</code></pre>\n\n<i>Zero-PII. Your career data belongs to you.</i>`,
        this.env
      );
      return true;
    }

    if (cmd === "/uploadresume") {
      await this.messenger.sendMessage(
        chatId,
        "📄 <b>Optional Resume Handling:</b>\n\n" +
          "You can use Acorn completely without uploading a resume!\n\n" +
          "• If you wish to check ATS fit, use <code>/ats</code> and paste your resume text in-memory.\n" +
          "• Persistent resume file uploads are quarantined with file-signature verification.\n" +
          "• To clear any cached resume state, use <code>/deleteresume</code> or <code>/forget</code>.",
        this.env
      );
      return true;
    }

    if (cmd === "/deleteresume") {
      await this.repo.deleteResume(acornUserId);
      await this.messenger.sendMessage(
        chatId,
        "🗑️ <b>Resume Purged:</b> Any stored resume assets have been securely deleted from your profile.",
        this.env
      );
      return true;
    }

    return false;
  }

  async showProfile(chatId, acornUserId) {
    const profile = await this.repo.getProfile(acornUserId);
    const roles = await this.repo.getUserRoles(acornUserId);
    const prefs = await this.repo.getSearchPreferences(acornUserId);
    const resume = await this.repo.getResumeMetadata(acornUserId);

    let rolesText = "<i>None set yet! Use /setroles to add roles.</i>";
    if (roles && roles.length > 0) {
      rolesText = roles.map((r, i) => `${i + 1}. <b>${r.role_title}</b>`).join("\n");
    }

    const locsText = prefs?.preferred_locations?.join(", ") || "Toronto, Remote";
    const resumeText = resume ? `✅ Attached (${resume.content_type}, ${Math.round(resume.file_size / 1024)} KB)` : "⚪ None attached (Optional)";

    const msg = (
      `👤 <b>Your Acorn Career Profile:</b>\n\n` +
      `<b>Acorn ID:</b> <code>${acornUserId}</code>\n` +
      `<b>Onboarding Status:</b> ${profile?.onboarding_status === "completed" ? "🟢 Complete" : "🟡 Pending"}\n\n` +
      `🎯 <b>Target Roles:</b>\n${rolesText}\n\n` +
      `📍 <b>Locations:</b> ${locsText}\n` +
      `💼 <b>Arrangement:</b> ${prefs?.work_arrangement || "Any"}\n` +
      `📄 <b>Resume:</b> ${resumeText}\n\n` +
      `<i>Commands to adjust your profile:</i>\n` +
      `• <code>/setroles &lt;role1, role2&gt;</code>\n` +
      `• <code>/setlocations &lt;city1, Remote&gt;</code>\n` +
      `• <code>/preferences</code>\n` +
      `• <code>/exportprofile</code>`
    );

    await this.messenger.sendMessage(chatId, msg, this.env, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🎯 Set Roles", callback_data: "prof_set_roles" },
            { text: "📍 Set Locations", callback_data: "prof_set_locs" },
          ],
          [
            { text: "📦 Export Profile (JSON)", callback_data: "prof_export" },
            { text: "🔍 Run Scan", callback_data: "scan_roles" },
          ],
        ],
      },
    });
  }

  async promptRoles(chatId) {
    await this.messenger.sendMessage(
      chatId,
      "🎯 <b>What kind of roles would you like Acorn to keep an eye on?</b>\n\n" +
        "Reply with <code>/setroles</code> followed by comma-separated titles. For example:\n\n" +
        "<code>/setroles Junior Software Engineer, Cloud Support, Data Analyst</code>",
      this.env
    );
  }

  async showPreferences(chatId, acornUserId) {
    const prefs = await this.repo.getSearchPreferences(acornUserId);
    const msg = (
      `⚙️ <b>Your Job Search Preferences:</b>\n\n` +
      `• <b>Locations:</b> ${prefs?.preferred_locations?.join(", ") || "Toronto, Remote"}\n` +
      `• <b>Arrangement:</b> ${prefs?.work_arrangement || "any"}\n` +
      `• <b>Seniority:</b> ${prefs?.seniority || "any"}\n` +
      `• <b>Notification Cadence:</b> ${prefs?.notification_cadence || "instant"}\n` +
      `• <b>Timezone:</b> ${prefs?.timezone || "America/Toronto"}\n\n` +
      `<i>Update locations with: <code>/setlocations &lt;locations&gt;</code></i>`
    );
    await this.messenger.sendMessage(chatId, msg, this.env);
  }
}
