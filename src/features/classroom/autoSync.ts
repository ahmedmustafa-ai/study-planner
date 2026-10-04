// Silent, background Classroom sync — no popup, no review screen. Runs once each time the app
// opens (after you've connected at least once from the Classroom page). It only acts on classes
// you've already mapped to a course; a brand-new class you haven't mapped yet just waits for you
// to visit Tasks → Classroom once, the same as before.
import { db, getSetting, setSetting } from '@/lib/db';
import {
  announcementFromItem, autoMapCourses, buildAnnouncementItems, buildItems, buildMaterialItems, patchFromItem, patchFromMaterialItem, planAnnouncementImport, planImport, planMaterialImport, sourceFromItem, taskFromItem,
  type CourseMap,
} from '@/lib/algorithms/classroom';
import { addDays, today } from '@/lib/utils';
import { fetchClassroom, requestAccessToken } from './google';

export interface AutoSyncResult {
  ran: boolean;
  addedTasks: number;
  updatedTasks: number;
  addedMaterials: number;
  updatedMaterials: number;
  addedAnnouncements: number;
}

const EMPTY: AutoSyncResult = { ran: false, addedTasks: 0, updatedTasks: 0, addedMaterials: 0, updatedMaterials: 0, addedAnnouncements: 0 };
const SINCE_DAYS = 30; // background sync only pulls recent work; old undone items would just be noise

export async function autoClassroomSync(): Promise<AutoSyncResult> {
  const clientId = await getSetting<string>('google.clientId', '');
  if (!clientId) return EMPTY;

  let token: string;
  try {
    token = await requestAccessToken(clientId, { silent: true });
  } catch {
    return EMPTY; // needs an interactive reconnect — only surfaced if you visit the Classroom page
  }

  const data = await fetchClassroom(token);
  const savedMap = await getSetting<CourseMap>('classroom.courseMap', {});
  const subjects = await db.subjects.toArray();
  const map = autoMapCourses(data.courses, subjects, savedMap);

  const tasks = await db.tasks.toArray();
  const items = buildItems(data.courses, data.work, data.submissions);
  const taskRows = planImport(items, tasks, map, { includeDone: false, sinceDate: addDays(today(), -SINCE_DAYS) });

  let addedTasks = 0;
  let updatedTasks = 0;
  await db.transaction('rw', db.tasks, async () => {
    for (const r of taskRows) {
      if (r.action === 'update' && r.existingTaskId != null) {
        const task = await db.tasks.get(r.existingTaskId);
        if (task) {
          await db.tasks.update(task.id!, patchFromItem(r.item, task));
          updatedTasks++;
        }
      } else if (r.action === 'new' && r.subjectId != null) {
        await db.tasks.add(taskFromItem(r.item, r.subjectId));
        addedTasks++;
      }
    }
  });

  const sources = await db.sources.toArray();
  const materialItems = buildMaterialItems(data.courses, data.materials);
  const materialRows = planMaterialImport(materialItems, sources, map);

  let addedMaterials = 0;
  let updatedMaterials = 0;
  await db.transaction('rw', db.sources, async () => {
    for (const r of materialRows) {
      if (r.action === 'update' && r.existingSourceId != null) {
        const source = await db.sources.get(r.existingSourceId);
        if (source) {
          await db.sources.update(source.id!, patchFromMaterialItem(r.item, source));
          updatedMaterials++;
        }
      } else if (r.action === 'new' && r.subjectId != null) {
        await db.sources.add(sourceFromItem(r.item, r.subjectId) as never);
        addedMaterials++;
      }
    }
  });

  const saved = await db.announcements.toArray();
  const announcementRows = planAnnouncementImport(buildAnnouncementItems(data.courses, data.announcements), saved, map);

  let addedAnnouncements = 0;
  await db.transaction('rw', db.announcements, async () => {
    for (const r of announcementRows) {
      if (r.action === 'update' && r.existingId != null) {
        await db.announcements.update(r.existingId, announcementFromItem(r.item, r.subjectId!));
      } else if (r.action === 'new' && r.subjectId != null) {
        await db.announcements.add(announcementFromItem(r.item, r.subjectId));
        addedAnnouncements++;
      }
    }
  });

  await setSetting('classroom.courseMap', Object.fromEntries(Object.entries(map).filter(([, v]) => v !== undefined)));
  await setSetting('classroom.lastAutoSync', new Date().toISOString());
  return { ran: true, addedTasks, updatedTasks, addedMaterials, updatedMaterials, addedAnnouncements };
}
