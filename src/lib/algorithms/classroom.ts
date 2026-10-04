// Google Classroom → Study OS tasks and materials. Pure: turns API responses into an import plan.
// Shapes follow the Classroom REST API v1 (courses, courseWork, courseWorkMaterials, announcements, studentSubmissions).
import type { Announcement, Source, Subject, Task } from '@/lib/types';
import { describeLink } from './links';
import { matchCourse } from './ics';

export interface GCourse {
  id: string;
  name: string;
  section?: string;
  courseState?: string;
  alternateLink?: string;
}
export interface GCourseWork {
  id: string;
  courseId: string;
  title: string;
  description?: string;
  state?: string; // PUBLISHED | DRAFT | DELETED
  alternateLink?: string;
  dueDate?: { year: number; month: number; day: number };
  dueTime?: { hours?: number; minutes?: number };
  workType?: string; // ASSIGNMENT | SHORT_ANSWER_QUESTION | MULTIPLE_CHOICE_QUESTION | MATERIAL
}
export interface GSubmission {
  courseWorkId: string;
  state?: string; // NEW | CREATED | TURNED_IN | RETURNED | RECLAIMED_BY_STUDENT
  late?: boolean;
}
export interface GAttachment {
  driveFile?: { driveFile?: { id?: string; title?: string; alternateLink?: string } };
  link?: { url?: string };
  youTubeVideo?: { alternateLink?: string };
  form?: { formUrl?: string };
}
export interface GCourseWorkMaterial {
  id: string;
  courseId: string;
  title: string;
  state?: string; // PUBLISHED | DRAFT | DELETED
  alternateLink?: string;
  materials?: GAttachment[];
}
export interface GAnnouncement {
  id: string;
  courseId: string;
  text?: string;
  state?: string;
  alternateLink?: string;
  creationTime?: string; // ISO timestamp
  materials?: GAttachment[];
}

/** Titles that differ only by letter case or spaces are the same title. */
const sameTitle = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

const pad = (n: number) => String(n).padStart(2, '0');

/** Classroom gives the due date AND time in UTC. Convert to this device's local date so "11:59 PM" lands on the right day. */
export function dueLocal(dueDate?: GCourseWork['dueDate'], dueTime?: GCourseWork['dueTime']): { date?: string; time?: string } {
  if (!dueDate) return {};
  if (!dueTime) return { date: `${dueDate.year}-${pad(dueDate.month)}-${pad(dueDate.day)}` };
  const dt = new Date(Date.UTC(dueDate.year, dueDate.month - 1, dueDate.day, dueTime.hours ?? 0, dueTime.minutes ?? 0));
  return { date: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`, time: `${pad(dt.getHours())}:${pad(dt.getMinutes())}` };
}

export interface ClassroomItem {
  uid: string; // classroom:<courseId>:<courseWorkId>
  courseId: string;
  courseName: string;
  title: string;
  dueDate?: string; // local YYYY-MM-DD
  dueTime?: string; // local HH:MM
  url?: string;
  done: boolean; // turned in or returned
  late: boolean;
}

export const classroomUid = (courseId: string, workId: string) => `classroom:${courseId}:${workId}`;
const fileUid = (courseId: string, materialId: string, fileId: string) => `classroom:file:${courseId}:${materialId}:${fileId}`;
const announcementUid = (courseId: string, id: string) => `classroom:announcement:${courseId}:${id}`;

/** Assignments and questions only (not "material" posts, drafts or deleted work). Sorted by due date, undated last. */
export function buildItems(courses: GCourse[], work: GCourseWork[], submissions: GSubmission[]): ClassroomItem[] {
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const subByWork = new Map(submissions.map((s) => [s.courseWorkId, s]));
  const items: ClassroomItem[] = [];
  for (const w of work) {
    if (w.state && w.state !== 'PUBLISHED') continue;
    if (w.workType === 'MATERIAL') continue;
    const c = courseById.get(w.courseId);
    if (!c) continue;
    const sub = subByWork.get(w.id);
    const due = dueLocal(w.dueDate, w.dueTime);
    items.push({
      uid: classroomUid(w.courseId, w.id),
      courseId: w.courseId,
      courseName: c.name,
      title: w.title.trim() || 'Untitled assignment',
      dueDate: due.date,
      dueTime: due.time,
      url: w.alternateLink,
      done: sub?.state === 'TURNED_IN' || sub?.state === 'RETURNED',
      late: !!sub?.late,
    });
  }
  return items.sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.title.localeCompare(b.title));
}

export type CourseMap = Record<string, number | null | undefined>; // Classroom course id → Study OS course id, null = skip

/** Saved choices first, then a name match against your courses. */
export function autoMapCourses(courses: GCourse[], subjects: Pick<Subject, 'id' | 'name' | 'code'>[], saved: CourseMap): CourseMap {
  const out: CourseMap = {};
  for (const c of courses) {
    if (saved[c.id] !== undefined) out[c.id] = saved[c.id];
    else out[c.id] = matchCourse(`${c.name} ${c.section ?? ''}`, subjects);
  }
  return out;
}

export type PlanAction = 'new' | 'update' | 'unchanged';
export interface PlanRow {
  item: ClassroomItem;
  subjectId?: number; // undefined until the class is matched to one of your courses
  existingTaskId?: number;
  action: PlanAction;
  changes: string[]; // what an update changes, in plain words
}

export interface PlanOptions {
  includeDone: boolean;
  sinceDate?: string; // hide items due before this date (unless already in Study OS)
}

/** What importing would do. Anything already in Study OS is matched by its Classroom id, or by same title + due date (manual entries). */
export function planImport(items: ClassroomItem[], existing: Task[], courseMap: CourseMap, opts: PlanOptions): PlanRow[] {
  const byUid = new Map(existing.filter((t) => t.uid).map((t) => [t.uid!, t]));
  const rows: PlanRow[] = [];
  for (const item of items) {
    const mapped = courseMap[item.courseId];
    if (mapped === null) continue; // "skip this class"
    const subjectId = mapped ?? undefined;
    let task = byUid.get(item.uid);
    if (!task && subjectId != null) {
      task = existing.find((t) => !t.uid && t.subjectId === subjectId && t.dueDate === item.dueDate && t.title.trim().toLowerCase() === item.title.toLowerCase());
    }

    if (task) {
      const changes: string[] = [];
      if (!task.uid) changes.push('link to Classroom');
      if (item.done && task.status !== 'done') changes.push('mark done');
      if (item.dueDate && task.dueDate !== item.dueDate) changes.push(`due date → ${item.dueDate}`);
      if (task.uid && !sameTitle(task.title, item.title)) changes.push('new title');
      if (item.url && task.url !== item.url) changes.push('add link');
      rows.push({ item, subjectId: task.subjectId, existingTaskId: task.id, action: changes.length ? 'update' : 'unchanged', changes });
      continue;
    }
    if (item.done && !opts.includeDone) continue;
    if (opts.sinceDate && item.dueDate && item.dueDate < opts.sinceDate && !item.done) continue;
    if (opts.sinceDate && item.dueDate && item.dueDate < opts.sinceDate && item.done) continue;
    rows.push({ item, subjectId, action: 'new', changes: [] });
  }
  return rows;
}

export function taskFromItem(item: ClassroomItem, subjectId: number): Omit<Task, 'id'> {
  return { subjectId, title: item.title, dueDate: item.dueDate, status: item.done ? 'done' : 'todo', priority: 'med', source: 'classroom', url: item.url, uid: item.uid };
}

/** Changes to apply to an existing task for an "update" row. */
export function patchFromItem(item: ClassroomItem, task: Task): Partial<Task> {
  const patch: Partial<Task> = { uid: item.uid };
  if (item.url) patch.url = item.url;
  if (item.dueDate) patch.dueDate = item.dueDate;
  if (item.done && task.status !== 'done') patch.status = 'done';
  if (task.uid && !sameTitle(task.title, item.title)) patch.title = item.title;
  return patch;
}

// ---- Materials (only the attached files, named by the file's own name → Study OS Library) ----

const attachmentUrl = (a: GAttachment): string | undefined => a.driveFile?.driveFile?.alternateLink || a.link?.url || a.youTubeVideo?.alternateLink || a.form?.formUrl;

export interface ClassroomMaterialItem {
  uid: string; // classroom:file:<courseId>:<materialId>:<driveFileId>
  courseId: string;
  courseName: string;
  title: string; // the file's name in Drive
  url: string;
}

/** One item per Drive file attached to a published material post. The post's own title, text and any plain links are ignored. */
export function buildMaterialItems(courses: GCourse[], materials: GCourseWorkMaterial[]): ClassroomMaterialItem[] {
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const items: ClassroomMaterialItem[] = [];
  for (const m of materials) {
    if (m.state && m.state !== 'PUBLISHED') continue;
    const c = courseById.get(m.courseId);
    if (!c) continue;
    (m.materials ?? []).forEach((a, i) => {
      const f = a.driveFile?.driveFile;
      if (!f?.alternateLink) return;
      items.push({ uid: fileUid(m.courseId, m.id, f.id ?? String(i)), courseId: m.courseId, courseName: c.name, title: f.title?.trim() || 'Untitled file', url: f.alternateLink });
    });
  }
  return items;
}

export interface MaterialPlanRow {
  item: ClassroomMaterialItem;
  subjectId?: number;
  existingSourceId?: number;
  action: PlanAction;
  changes: string[];
}

/** What importing files would do. Matched by Classroom uid, or (for items imported before files were split out) by same course + link. */
export function planMaterialImport(items: ClassroomMaterialItem[], existing: Source[], courseMap: CourseMap): MaterialPlanRow[] {
  const byUid = new Map(existing.filter((s) => s.uid).map((s) => [s.uid!, s]));
  const rows: MaterialPlanRow[] = [];
  for (const item of items) {
    const mapped = courseMap[item.courseId];
    if (mapped === null) continue;
    const subjectId = mapped ?? undefined;
    let source = byUid.get(item.uid);
    if (!source && subjectId != null) source = existing.find((s) => s.uid?.startsWith('classroom:material:') && s.subjectId === subjectId && s.url === item.url);
    if (source) {
      const changes: string[] = [];
      if (source.uid !== item.uid) changes.push('use file name');
      else if (!sameTitle(source.title, item.title)) changes.push('new title');
      if (source.url !== item.url) changes.push('link changed');
      rows.push({ item, subjectId: source.subjectId, existingSourceId: source.id, action: changes.length ? 'update' : 'unchanged', changes });
      continue;
    }
    rows.push({ item, subjectId, action: 'new', changes: [] });
  }
  return rows;
}

export function sourceFromItem(item: ClassroomMaterialItem, subjectId: number): Omit<Source, 'id'> {
  return { subjectId, topicIds: [], kind: describeLink(item.url).kind, role: 'learn', title: item.title, url: item.url, dateAdded: new Date().toISOString().slice(0, 10), uid: item.uid };
}

/** Changes to apply to an existing material for an "update" row. Never touches topics, role or notes the student may have added. */
export function patchFromMaterialItem(item: ClassroomMaterialItem, source: Source): Partial<Source> {
  const patch: Partial<Source> = {};
  if (source.uid !== item.uid) patch.uid = item.uid;
  if (source.url !== item.url) patch.url = item.url;
  if (source.uid !== item.uid || !sameTitle(source.title, item.title)) patch.title = item.title;
  return patch;
}

// ---- Announcements (their own thing, kept apart from materials) ----

export interface ClassroomAnnouncementItem {
  uid: string; // classroom:announcement:<courseId>:<id>
  courseId: string;
  courseName: string;
  text: string;
  url?: string; // the announcement's page in Classroom
  links: string[]; // anything attached to it
  date: string; // local YYYY-MM-DD it was posted
}

const localDate = (iso?: string) => {
  const d = iso ? new Date(iso) : undefined;
  if (!d || Number.isNaN(d.getTime())) return undefined;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Published announcements with something in them, newest first. */
export function buildAnnouncementItems(courses: GCourse[], announcements: GAnnouncement[]): ClassroomAnnouncementItem[] {
  const courseById = new Map(courses.map((c) => [c.id, c]));
  const items: ClassroomAnnouncementItem[] = [];
  for (const a of announcements) {
    if (a.state && a.state !== 'PUBLISHED') continue;
    const c = courseById.get(a.courseId);
    if (!c) continue;
    const text = (a.text ?? '').trim();
    const links = (a.materials ?? []).map(attachmentUrl).filter((u): u is string => !!u);
    if (!text && links.length === 0) continue;
    items.push({ uid: announcementUid(a.courseId, a.id), courseId: a.courseId, courseName: c.name, text, url: a.alternateLink, links, date: localDate(a.creationTime) ?? new Date().toISOString().slice(0, 10) });
  }
  return items.sort((x, y) => y.date.localeCompare(x.date));
}

export interface AnnouncementPlanRow {
  item: ClassroomAnnouncementItem;
  subjectId?: number;
  existingId?: number;
  action: PlanAction;
}

/** Matched to an already-saved announcement by Classroom uid. A saved announcement is refreshed only when its text changed. */
export function planAnnouncementImport(items: ClassroomAnnouncementItem[], existing: Announcement[], courseMap: CourseMap): AnnouncementPlanRow[] {
  const byUid = new Map(existing.map((x) => [x.uid, x]));
  const rows: AnnouncementPlanRow[] = [];
  for (const item of items) {
    const mapped = courseMap[item.courseId];
    if (mapped === null) continue;
    const saved = byUid.get(item.uid);
    if (saved) rows.push({ item, subjectId: saved.subjectId, existingId: saved.id, action: saved.text === item.text && saved.links.join('\n') === item.links.join('\n') ? 'unchanged' : 'update' });
    else rows.push({ item, subjectId: mapped ?? undefined, action: 'new' });
  }
  return rows;
}

export function announcementFromItem(item: ClassroomAnnouncementItem, subjectId: number): Omit<Announcement, 'id'> {
  return { subjectId, courseName: item.courseName, uid: item.uid, text: item.text, url: item.url, links: item.links, date: item.date };
}
