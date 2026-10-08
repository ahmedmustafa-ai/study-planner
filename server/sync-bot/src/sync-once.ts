import { Bot } from 'grammy';
import { config } from './config.js';
import { loadTokens } from './storage.js';
import { performSync } from './sync.js';

async function runOnce() {
  // Hard safety timeout of 45 seconds to guarantee process exits cleanly
  const timeout = setTimeout(() => {
    console.error('⏱️ Sync cycle timed out after 45 seconds.');
    process.exit(1);
  }, 45000);
  timeout.unref?.();

  console.log('🔄 Study Planner — Executing scheduled Classroom sync...');

  const tokens = loadTokens();
  if (!tokens || !tokens.refresh_token) {
    console.error('❌ Google Classroom is not authenticated or missing GOOGLE_REFRESH_TOKEN.');
    process.exit(1);
  }

  // Optional bot instance to send message via bot.api
  const bot = config.telegramToken ? new Bot(config.telegramToken) : null;

  try {
    const summary = await performSync(bot);
    console.log('✅ Sync completed successfully:');
    console.log(`   - New assignments: ${summary.newAssignments}`);
    console.log(`   - Updated assignments: ${summary.updatedAssignments}`);
    console.log(`   - New materials: ${summary.newMaterials}`);
    console.log(`   - New announcements: ${summary.newAnnouncements}`);
    clearTimeout(timeout);
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Sync cycle error:', err.message || err);
    clearTimeout(timeout);
    process.exit(1);
  }
}

runOnce();
