import { Bot, InlineKeyboard } from 'grammy';
import fs from 'node:fs';
import { config } from './config.js';
import { performSync } from './sync.js';
import { fetchAppSyncData, addTaskToSync, markTaskDoneInSync } from './app-bridge.js';
import { loadSyncState } from './storage.js';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function createTelegramBot(): Bot | null {
  if (!config.telegramToken) {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN is not configured.');
    return null;
  }

  const bot = new Bot(config.telegramToken);

  // Register persistent bot command menu with Telegram
  bot.api.setMyCommands([
    { command: 'menu', description: '📱 Open interactive dashboard' },
    { command: 'tasks', description: '📋 View pending tasks & assignments' },
    { command: 'today', description: '📅 Tasks due today & overdue' },
    { command: 'add', description: '➕ Add task (e.g. /add Math homework due tomorrow)' },
    { command: 'review', description: '📊 Weekly summary & announcements' },
    { command: 'sync', description: '🔄 Check Google Classroom now' },
    { command: 'status', description: '⚡ Check bot & sync health' },
  ]).catch((err) => console.warn('Could not set Telegram commands menu:', err.message));

  // /start: Welcome & pairing
  bot.command('start', async (ctx) => {
    const chatId = ctx.chat.id.toString();
    const username = ctx.from?.first_name || 'Student';

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

    const keyboard = new InlineKeyboard()
      .text('📋 Tasks', 'cmd_tasks')
      .text('📅 Today', 'cmd_today')
      .row()
      .text('📊 Review', 'cmd_review')
      .text('🔄 Sync Classroom', 'cmd_sync');

    await ctx.reply(
      `👋 <b>Welcome back, ${escapeHtml(username)}!</b>\n\n` +
      `Your <b>Study OS Assistant & Task Dashboard</b> is connected.\n` +
      `📱 <b>Chat ID:</b> <code>${chatId}</code>\n\n` +
      `<b>Quick Dashboard Controls:</b>\n` +
      `• Tap the buttons below to check your schedule.\n` +
      `• Use <code>/add &lt;task title&gt; [due YYYY-MM-DD]</code> to add tasks.\n` +
      `• Instant alerts will pop up when new Classroom work is posted.`,
      { parse_mode: 'HTML', reply_markup: keyboard }
    );
  });

  // /menu: Interactive dashboard
  bot.command('menu', async (ctx) => {
    const keyboard = new InlineKeyboard()
      .text('📋 View All Tasks', 'cmd_tasks')
      .text('📅 Due Today', 'cmd_today')
      .row()
      .text('📊 Weekly Review', 'cmd_review')
      .text('🔄 Sync Now', 'cmd_sync');

    await ctx.reply(
      `📱 <b>Study OS Control Hub</b>\n\n` +
      `Choose an option below to manage your tasks or trigger Classroom synchronization:`,
      { parse_mode: 'HTML', reply_markup: keyboard }
    );
  });

  // /tasks: List all pending tasks
  bot.command('tasks', async (ctx) => {
    await sendTaskList(ctx);
  });

  // /today: List tasks due today or overdue
  bot.command('today', async (ctx) => {
    await sendTodayList(ctx);
  });

  // /add: Quick task creation
  bot.command('add', async (ctx) => {
    const text = ctx.match?.trim();
    if (!text) {
      await ctx.reply(
        `✍️ <b>How to add a task:</b>\n\n` +
        `• <code>/add Read Physics Chapter 3</code>\n` +
        `• <code>/add Math worksheet due 2026-10-15</code>\n` +
        `• <code>/add Chemistry lab report due tomorrow</code>`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    let title = text;
    let dueDate: string | undefined;

    const dueMatch = text.match(/\bdue\s+([\w-]+)/i);
    if (dueMatch) {
      title = text.replace(dueMatch[0], '').trim();
      const rawDue = dueMatch[1].toLowerCase();
      if (rawDue === 'today') {
        dueDate = new Date().toISOString().slice(0, 10);
      } else if (rawDue === 'tomorrow') {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        dueDate = d.toISOString().slice(0, 10);
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(rawDue)) {
        dueDate = rawDue;
      }
    }

    await ctx.reply(`⏳ Adding task: <b>${escapeHtml(title)}</b>...`, { parse_mode: 'HTML' });
    const success = await addTaskToSync(title, dueDate);

    if (success) {
      await ctx.reply(
        `✅ <b>Task Added to Study OS!</b>\n\n` +
        `📌 <b>Title:</b> ${escapeHtml(title)}\n` +
        (dueDate ? `📅 <b>Due Date:</b> <code>${dueDate}</code>\n` : '') +
        `\n<i>This will automatically sync across all your devices.</i>`,
        { parse_mode: 'HTML' }
      );
    } else {
      await ctx.reply(
        `⚠️ Task recorded locally in bot session. Make sure Google Drive sync is active in your Study OS app.`,
        { parse_mode: 'HTML' }
      );
    }
  });

  // /done: Mark task completed
  bot.command('done', async (ctx) => {
    const input = ctx.match?.trim();
    if (!input) {
      await ctx.reply(`Usage: <code>/done &lt;task name or id&gt;</code>`, { parse_mode: 'HTML' });
      return;
    }

    const title = await markTaskDoneInSync(input);
    if (title) {
      await ctx.reply(`🎉 <b>Completed:</b> ${escapeHtml(title)}!`, { parse_mode: 'HTML' });
    } else {
      await ctx.reply(`❓ Could not find an active task matching "<code>${escapeHtml(input)}</code>".`, { parse_mode: 'HTML' });
    }
  });

  // /review: Weekly summary & Classroom announcements
  bot.command('review', async (ctx) => {
    await sendReviewSummary(ctx);
  });

  // /sync: Immediate Classroom fetch
  bot.command('sync', async (ctx) => {
    await ctx.reply('🔄 Checking Google Classroom for updates...');
    try {
      const summary = await performSync(bot);
      await ctx.reply(
        `✅ <b>Classroom Check Complete</b>\n\n` +
        `• New assignments: <b>${summary.newAssignments}</b>\n` +
        `• Updated assignments: <b>${summary.updatedAssignments}</b>\n` +
        `• New materials: <b>${summary.newMaterials}</b>\n` +
        `• New announcements: <b>${summary.newAnnouncements}</b>`,
        { parse_mode: 'HTML' }
      );
    } catch (err: any) {
      await ctx.reply(`❌ Sync failed: ${escapeHtml(err.message)}`, { parse_mode: 'HTML' });
    }
  });

  // /status: Bot health check
  bot.command('status', async (ctx) => {
    const state = loadSyncState();
    const assignmentCount = Object.keys(state.knownAssignments || {}).length;
    const annCount = Object.keys(state.knownAnnouncements || {}).length;

    await ctx.reply(
      `🤖 <b>Study OS Bot Status</b>\n\n` +
      `• <b>Classroom Monitoring:</b> Active (every ${config.syncIntervalMinutes}m)\n` +
      `• <b>Tracked Assignments:</b> ${assignmentCount}\n` +
      `• <b>Tracked Announcements:</b> ${annCount}\n` +
      `• <b>Last Classroom Sync:</b> ${state.lastSyncTime ? new Date(state.lastSyncTime).toLocaleString() : 'Never'}\n` +
      `• <b>Telegram Chat ID:</b> <code>${config.telegramChatId || 'Not Set'}</code>`,
      { parse_mode: 'HTML' }
    );
  });

  // Interactive inline button handlers
  bot.callbackQuery('cmd_tasks', async (ctx) => {
    await ctx.answerCallbackQuery();
    await sendTaskList(ctx);
  });

  bot.callbackQuery('cmd_today', async (ctx) => {
    await ctx.answerCallbackQuery();
    await sendTodayList(ctx);
  });

  bot.callbackQuery('cmd_review', async (ctx) => {
    await ctx.answerCallbackQuery();
    await sendReviewSummary(ctx);
  });

  bot.callbackQuery('cmd_sync', async (ctx) => {
    await ctx.answerCallbackQuery('Syncing Classroom...');
    try {
      const summary = await performSync(bot);
      await ctx.reply(
        `✅ <b>Classroom Sync Done</b>\n\n` +
        `• New: ${summary.newAssignments} assignments, ${summary.newAnnouncements} announcements.`,
        { parse_mode: 'HTML' }
      );
    } catch (err: any) {
      await ctx.reply(`❌ Sync failed: ${escapeHtml(err.message)}`, { parse_mode: 'HTML' });
    }
  });

  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;
    if (data.startsWith('done_')) {
      const taskId = data.slice(5);
      await ctx.answerCallbackQuery('Updating task...');
      const title = await markTaskDoneInSync(taskId);
      if (title) {
        await ctx.reply(`✅ Marked as done: <b>${escapeHtml(title)}</b>`, { parse_mode: 'HTML' });
      } else {
        await ctx.reply(`Task already updated or completed.`, { parse_mode: 'HTML' });
      }
    }
  });

  return bot;
}

async function sendTaskList(ctx: any) {
  const syncData = await fetchAppSyncData();
  const tasks = (syncData?.records?.tasks || []).filter((t: any) => !t.deleted && t.data?.status !== 'done');

  // Also include recent Classroom assignments
  const state = loadSyncState();
  const classroomItems = Object.values(state.knownAssignments || {}).slice(0, 5);

  if (tasks.length === 0 && classroomItems.length === 0) {
    await ctx.reply(
      `🎉 <b>No pending tasks!</b>\n\nAll clear. Use <code>/add &lt;title&gt;</code> to add a new task anytime.`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  const lines: string[] = ['📋 <b>Your Pending Tasks & Coursework:</b>\n'];
  const keyboard = new InlineKeyboard();

  let count = 0;
  for (const t of tasks.slice(0, 7)) {
    count++;
    const dueStr = t.data.dueDate ? ` (📅 ${t.data.dueDate})` : '';
    lines.push(`<b>${count}.</b> ${escapeHtml(t.data.title)}${dueStr}`);
    keyboard.text(`✅ Complete #${count}`, `done_${t.uuid.slice(0, 8)}`).row();
  }

  if (classroomItems.length > 0) {
    lines.push('\n<b>From Google Classroom:</b>');
    for (const c of classroomItems) {
      lines.push(`• <b>${escapeHtml(c.title)}</b> [${c.dueDate || 'No due date'}]`);
    }
  }

  keyboard.text('➕ Add Task', 'cmd_menu_add').text('🔄 Refresh', 'cmd_tasks');

  await ctx.reply(lines.join('\n'), {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}

async function sendTodayList(ctx: any) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const syncData = await fetchAppSyncData();
  const tasks = (syncData?.records?.tasks || []).filter(
    (t: any) => !t.deleted && t.data?.status !== 'done' && t.data?.dueDate && t.data.dueDate <= todayStr
  );

  if (tasks.length === 0) {
    await ctx.reply(
      `✨ <b>Nothing due today (${todayStr})!</b>\n\nEnjoy your study session or check <code>/tasks</code> for upcoming work.`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  const lines = [`📅 <b>Due Today & Overdue (${todayStr}):</b>\n`];
  const keyboard = new InlineKeyboard();

  let count = 0;
  for (const t of tasks) {
    count++;
    lines.push(`<b>${count}.</b> ${escapeHtml(t.data.title)} (📅 <code>${t.data.dueDate}</code>)`);
    keyboard.text(`✅ Mark #${count} Done`, `done_${t.uuid.slice(0, 8)}`).row();
  }

  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML', reply_markup: keyboard });
}

async function sendReviewSummary(ctx: any) {
  const state = loadSyncState();
  const syncData = await fetchAppSyncData();
  const allTasks = syncData?.records?.tasks || [];
  const activeTasks = allTasks.filter((t: any) => !t.deleted && t.data?.status !== 'done');
  const doneTasks = allTasks.filter((t: any) => !t.deleted && t.data?.status === 'done');

  const annCount = Object.keys(state.knownAnnouncements || {}).length;
  const assignCount = Object.keys(state.knownAssignments || {}).length;

  const lines = [
    `📊 <b>Study OS — Task & Classroom Review</b>\n`,
    `• <b>Active Tasks in App:</b> ${activeTasks.length}`,
    `• <b>Completed Tasks:</b> ${doneTasks.length}`,
    `• <b>Classroom Coursework Monitored:</b> ${assignCount}`,
    `• <b>Classroom Announcements Tracked:</b> ${annCount}`,
    `\n<i>Tip: Tap /today or /tasks to view actionable items.</i>`,
  ];

  await ctx.reply(lines.join('\n'), { parse_mode: 'HTML' });
}

export async function sendTelegramNotification(
  bot: Bot | null,
  message: string,
  extra?: { reply_markup?: InlineKeyboard }
): Promise<void> {
  const chatId = config.telegramChatId;
  if (!bot || !chatId) {
    console.log(`[Notification (Offline)]: \n${message}\n`);
    return;
  }

  try {
    await bot.api.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: false },
      reply_markup: extra?.reply_markup,
    });
  } catch (err: any) {
    console.error('Failed to send Telegram message:', err.message);
  }
}
