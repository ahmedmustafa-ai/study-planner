import { config } from './config.js';
import { loadTokens } from './storage.js';
import { performSync } from './sync.js';
import { createTelegramBot } from './telegram.js';

async function main() {
  console.log('====================================================');
  console.log('🚀 Study Planner Classroom Sync & Telegram Daemon');
  console.log('====================================================\n');

  // Verify Google Tokens
  const tokens = loadTokens();
  if (!tokens || !tokens.refresh_token) {
    console.error('❌ Google Classroom is not authenticated yet!');
    console.log('👉 Run "npm run auth" to complete the one-time Google authorization.\n');
    process.exit(1);
  }

  // Initialize Telegram Bot
  const bot = createTelegramBot();
  if (bot) {
    bot.start({
      onStart: (info) => {
        console.log(`🤖 Telegram Bot started as @${info.username}`);
        if (!config.telegramChatId) {
          console.log(`💬 Send /start to @${info.username} on Telegram to connect your account.`);
        } else {
          console.log(`📱 Sending notifications to chat ID: ${config.telegramChatId}`);
        }
      },
    }).catch((err) => {
      console.error('Failed to start Telegram Bot long polling:', err);
    });
  } else {
    console.warn('⚠️ Running in headless mode without active Telegram bot.');
  }

  // Run initial sync cycle
  console.log('🔄 Performing initial sync...');
  try {
    const summary = await performSync(bot);
    console.log(`✅ Initial sync complete:`, summary);
  } catch (err: any) {
    console.error('⚠️ Initial sync failed:', err.message);
  }

  // Schedule background intervals
  const intervalMs = config.syncIntervalMinutes * 60 * 1000;
  console.log(`⏳ Auto-sync scheduled every ${config.syncIntervalMinutes} minute(s).\n`);

  setInterval(async () => {
    console.log(`[${new Date().toLocaleTimeString()}] 🔄 Checking Google Classroom for updates...`);
    try {
      const summary = await performSync(bot);
      if (summary.newAssignments || summary.updatedAssignments || summary.newMaterials || summary.newAnnouncements) {
        console.log(`📢 Updates found and dispatched:`, summary);
      } else {
        console.log(`✨ All courses up to date.`);
      }
    } catch (err: any) {
      console.error(`❌ Background sync error:`, err.message);
    }
  }, intervalMs);
}

main().catch((err) => {
  console.error('Fatal daemon error:', err);
  process.exit(1);
});
