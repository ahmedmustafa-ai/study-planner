import { Bot } from 'grammy';
import fs from 'node:fs';
import { config } from './config.js';
import { performSync } from './sync.js';

export function createTelegramBot(): Bot | null {
  if (!config.telegramToken) {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN is not configured.');
    return null;
  }

  const bot = new Bot(config.telegramToken);

  // Command /start: Welcomes the student and displays/saves their chat ID
  bot.command('start', async (ctx) => {
    const chatId = ctx.chat.id.toString();
    const username = ctx.from?.first_name || 'Student';

    // Auto-update TELEGRAM_CHAT_ID in memory and .env if missing
    if (!config.telegramChatId) {
      config.telegramChatId = chatId;
      try {
        if (fs.existsSync(config.envPath)) {
          let envContent = fs.readFileSync(config.envPath, 'utf8');
          if (envContent.includes('TELEGRAM_CHAT_ID=')) {
            envContent = envContent.replace(/TELEGRAM_CHAT_ID=.*/, `TELEGRAM_CHAT_ID=${chatId}`);
          } else {
            envContent += `\nTELEGRAM_CHAT_ID=${chatId}\n`;
          }
          fs.writeFileSync(config.envPath, envContent, 'utf8');
        }
      } catch (err) {
        console.error('Failed to auto-write TELEGRAM_CHAT_ID to .env', err);
      }
    }

    await ctx.reply(
      `👋 *Hello ${username}!*\n\n` +
      `Your Study Planner Classroom Bot is active.\n` +
      `📱 *Your Chat ID:* \`${chatId}\`\n\n` +
      `You will receive immediate notifications whenever:\n` +
      `• A new assignment is published\n` +
      `• An assignment's due date is updated\n` +
      `• New class materials or announcements are posted\n\n` +
      `Type /sync to trigger a sync immediately.`,
      { parse_mode: 'Markdown' }
    );
  });

  // Command /sync: Triggers a manual sync on demand
  bot.command('sync', async (ctx) => {
    await ctx.reply('🔄 Checking Google Classroom for updates...');
    try {
      const summary = await performSync(bot);
      await ctx.reply(
        `✅ *Sync Complete!*\n\n` +
        `• New assignments: ${summary.newAssignments}\n` +
        `• Updated assignments: ${summary.updatedAssignments}\n` +
        `• New materials: ${summary.newMaterials}\n` +
        `• New announcements: ${summary.newAnnouncements}`,
        { parse_mode: 'Markdown' }
      );
    } catch (err: any) {
      await ctx.reply(`❌ Sync failed: ${err.message}`);
    }
  });

  // Command /status: Checks connection health
  bot.command('status', async (ctx) => {
    await ctx.reply(
      `🤖 *Study Planner Daemon Status*\n\n` +
      `• Sync Interval: Every ${config.syncIntervalMinutes} minutes\n` +
      `• Telegram Notifications: Active\n` +
      `• Mode: Background Monitoring`,
      { parse_mode: 'Markdown' }
    );
  });

  return bot;
}

/**
 * Sends a notification message to the configured Telegram chat ID.
 */
export async function sendTelegramNotification(bot: Bot | null, message: string): Promise<void> {
  const chatId = config.telegramChatId;
  if (!bot || !chatId) {
    console.log(`[Notification (Offline)]: \n${message}\n`);
    return;
  }

  try {
    await bot.api.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: false },
    });
  } catch (err: any) {
    console.error('Failed to send Telegram message:', err.message);
  }
}
