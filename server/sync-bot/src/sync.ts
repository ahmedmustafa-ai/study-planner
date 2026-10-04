import type { Bot } from 'grammy';
import { getAuthenticatedClient } from './auth.js';
import { loadSyncState, saveSyncState } from './storage.js';
import { sendTelegramNotification } from './telegram.js';

export interface SyncSummary {
  newAssignments: number;
  updatedAssignments: number;
  newMaterials: number;
  newAnnouncements: number;
}

const API_BASE = 'https://classroom.googleapis.com/v1';

async function fetchClassroom<T>(client: any, endpoint: string): Promise<T> {
  const res = await client.request({
    url: `${API_BASE}${endpoint}`,
    method: 'GET',
  });
  return res.data as T;
}

function formatDueDate(dueDate?: { year?: number; month?: number; day?: number }, dueTime?: { hours?: number; minutes?: number }): string {
  if (!dueDate || !dueDate.year || !dueDate.month || !dueDate.day) return 'No due date';
  const pad = (n: number) => String(n).padStart(2, '0');
  const dStr = `${dueDate.year}-${pad(dueDate.month)}-${pad(dueDate.day)}`;
  if (dueTime && dueTime.hours !== undefined && dueTime.hours !== null) {
    const tStr = `${pad(dueTime.hours)}:${pad(dueTime.minutes ?? 0)}`;
    return `${dStr} at ${tStr} (UTC)`;
  }
  return dStr;
}

export async function performSync(bot: Bot | null): Promise<SyncSummary> {
  const summary: SyncSummary = {
    newAssignments: 0,
    updatedAssignments: 0,
    newMaterials: 0,
    newAnnouncements: 0,
  };

  const client = await getAuthenticatedClient();

  // 1. Fetch active courses
  let courses: any[] = [];
  try {
    const coursesRes = await fetchClassroom<{ courses?: any[] }>(client, '/courses?courseStates=ACTIVE&pageSize=50');
    courses = coursesRes.courses || [];
  } catch (err: any) {
    console.error('Failed to list courses:', err.message);
    return summary;
  }

  if (!courses.length) {
    console.log('No active courses found.');
    return summary;
  }

  const state = loadSyncState();
  const isFirstRun = Object.keys(state.knownAssignments).length === 0 && Object.keys(state.knownAnnouncements).length === 0;

  for (const course of courses) {
    if (!course.id || !course.name) continue;
    const courseId = course.id;
    const courseName = course.name;

    // 2. Fetch CourseWork (Assignments)
    try {
      const workRes = await fetchClassroom<{ courseWork?: any[] }>(
        client,
        `/courses/${encodeURIComponent(courseId)}/courseWork?courseWorkStates=PUBLISHED&pageSize=100`
      );
      const workItems = workRes.courseWork || [];

      for (const item of workItems) {
        if (!item.id || item.workType === 'MATERIAL') continue;
        const key = `${courseId}:${item.id}`;
        const formattedDue = formatDueDate(item.dueDate, item.dueTime);
        const title = item.title || 'Untitled Assignment';
        const url = item.alternateLink || '';
        const updateTime = item.updateTime || '';

        const existing = state.knownAssignments[key];

        if (!existing) {
          state.knownAssignments[key] = {
            id: item.id,
            courseId,
            title,
            dueDate: formattedDue,
            updatedAt: updateTime,
          };
          summary.newAssignments++;

          if (!isFirstRun) {
            const msg = [
              `📝 <b>New Assignment Posted</b>`,
              `<b>Course:</b> ${escapeHtml(courseName)}`,
              `<b>Title:</b> ${escapeHtml(title)}`,
              `<b>Due:</b> 📅 <code>${escapeHtml(formattedDue)}</code>`,
              url ? `<a href="${url}">Open in Classroom</a>` : '',
            ].filter(Boolean).join('\n');

            await sendTelegramNotification(bot, msg);
          }
        } else if (existing.updatedAt !== updateTime || existing.dueDate !== formattedDue) {
          const dueChanged = existing.dueDate !== formattedDue;
          existing.updatedAt = updateTime;
          existing.dueDate = formattedDue;
          existing.title = title;
          summary.updatedAssignments++;

          if (!isFirstRun) {
            const msg = [
              `✏️ <b>Assignment Updated</b>`,
              `<b>Course:</b> ${escapeHtml(courseName)}`,
              `<b>Title:</b> ${escapeHtml(title)}`,
              dueChanged ? `<b>New Due Date:</b> ⚠️ <code>${escapeHtml(formattedDue)}</code>` : `<b>Due:</b> ${escapeHtml(formattedDue)}`,
              url ? `<a href="${url}">Open in Classroom</a>` : '',
            ].filter(Boolean).join('\n');

            await sendTelegramNotification(bot, msg);
          }
        }
      }
    } catch (err: any) {
      console.warn(`Could not fetch coursework for ${courseName}:`, err.message);
    }

    // 3. Fetch Course Work Materials
    try {
      const matRes = await fetchClassroom<{ courseWorkMaterial?: any[] }>(
        client,
        `/courses/${encodeURIComponent(courseId)}/courseWorkMaterials?materialStates=PUBLISHED&pageSize=50`
      );
      const materials = matRes.courseWorkMaterial || [];

      for (const mat of materials) {
        if (!mat.id) continue;
        const key = `${courseId}:${mat.id}`;
        const updateTime = mat.updateTime || '';
        const title = mat.title || 'Untitled Material';
        const url = mat.alternateLink || '';

        if (!state.knownMaterials[key]) {
          state.knownMaterials[key] = updateTime;
          summary.newMaterials++;

          if (!isFirstRun) {
            const msg = [
              `📁 <b>New Study Material</b>`,
              `<b>Course:</b> ${escapeHtml(courseName)}`,
              `<b>Title:</b> ${escapeHtml(title)}`,
              url ? `<a href="${url}">Open Material in Classroom</a>` : '',
            ].filter(Boolean).join('\n');

            await sendTelegramNotification(bot, msg);
          }
        }
      }
    } catch {
      // Ignored if permissions are restricted for materials
    }

    // 4. Fetch Announcements
    try {
      const annRes = await fetchClassroom<{ announcements?: any[] }>(
        client,
        `/courses/${encodeURIComponent(courseId)}/announcements?announcementStates=PUBLISHED&pageSize=50`
      );
      const announcements = annRes.announcements || [];

      for (const ann of announcements) {
        if (!ann.id) continue;
        const key = `${courseId}:${ann.id}`;
        const updateTime = ann.updateTime || '';
        const text = ann.text ? (ann.text.length > 280 ? `${ann.text.slice(0, 277)}...` : ann.text) : 'New announcement posted';
        const url = ann.alternateLink || '';

        if (!state.knownAnnouncements[key]) {
          state.knownAnnouncements[key] = updateTime;
          summary.newAnnouncements++;

          if (!isFirstRun) {
            const msg = [
              `📢 <b>New Announcement</b>`,
              `<b>Course:</b> ${escapeHtml(courseName)}`,
              `<blockquote>${escapeHtml(text)}</blockquote>`,
              url ? `<a href="${url}">View Post in Classroom</a>` : '',
            ].filter(Boolean).join('\n');

            await sendTelegramNotification(bot, msg);
          }
        }
      }
    } catch {
      // Ignored if announcements disabled
    }
  }

  state.lastSyncTime = new Date().toISOString();
  saveSyncState(state);

  return summary;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
