import { describe, expect, it } from 'vitest';
import {
  announcementFromItem, autoMapCourses, buildAnnouncementItems, buildItems, buildMaterialItems, dueLocal, patchFromItem, patchFromMaterialItem, planAnnouncementImport, planImport, planMaterialImport, sourceFromItem, taskFromItem,
  type GAnnouncement, type GCourse, type GCourseWork, type GCourseWorkMaterial, type GSubmission,
} from './classroom';
import type { Announcement, Source, Subject, Task } from '@/lib/types';

const local = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return { date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, time: `${p(d.getHours())}:${p(d.getMinutes())}` };
};

describe('dueLocal (Classroom due times are UTC)', () => {
  it('converts date + time to this device\'s local date and time', () => {
    const expected = local(new Date(Date.UTC(2026, 8, 28, 19, 59)));
    expect(dueLocal({ year: 2026, month: 9, day: 28 }, { hours: 19, minutes: 59 })).toEqual(expected);
  });
  it('a late-evening UTC time can be the next local day in the UAE (UTC+4)', () => {
    // Only meaningful when the machine is ahead of UTC; otherwise it just proves the conversion is consistent.
    const d = new Date(Date.UTC(2026, 8, 28, 22, 0));
    expect(dueLocal({ year: 2026, month: 9, day: 28 }, { hours: 22 })).toEqual(local(d));
  });
  it('date only stays as given; no date means no due date', () => {
    expect(dueLocal({ year: 2026, month: 9, day: 5 })).toEqual({ date: '2026-09-05' });
    expect(dueLocal(undefined, { hours: 5 })).toEqual({});
  });
  it('missing hours or minutes count as zero', () => {
    expect(dueLocal({ year: 2026, month: 9, day: 28 }, {})).toEqual(local(new Date(Date.UTC(2026, 8, 28, 0, 0))));
  });
});

const courses: GCourse[] = [
  { id: 'c1', name: 'AP Calculus AB', section: 'Period 3' },
  { id: 'c2', name: 'Chemistry 11' },
];
const work: GCourseWork[] = [
  { id: 'w1', courseId: 'c1', title: 'Limits worksheet', state: 'PUBLISHED', workType: 'ASSIGNMENT', alternateLink: 'https://classroom.google.com/c/c1/a/w1', dueDate: { year: 2026, month: 10, day: 2 } },
  { id: 'w2', courseId: 'c1', title: 'Quiz 1', state: 'PUBLISHED', workType: 'MULTIPLE_CHOICE_QUESTION', dueDate: { year: 2026, month: 9, day: 20 } },
  { id: 'w3', courseId: 'c1', title: 'Course notes', state: 'PUBLISHED', workType: 'MATERIAL' },
  { id: 'w4', courseId: 'c2', title: 'Lab report', state: 'PUBLISHED', workType: 'ASSIGNMENT' },
  { id: 'w5', courseId: 'c2', title: 'Old draft', state: 'DRAFT', workType: 'ASSIGNMENT' },
  { id: 'w6', courseId: 'gone', title: 'Unknown course', state: 'PUBLISHED', workType: 'ASSIGNMENT' },
];
const subs: GSubmission[] = [
  { courseWorkId: 'w2', state: 'TURNED_IN' },
  { courseWorkId: 'w1', state: 'CREATED' },
  { courseWorkId: 'w4', state: 'RETURNED', late: true },
];

describe('buildItems', () => {
  const items = buildItems(courses, work, subs);
  it('keeps assignments and questions only, sorted by due date with undated last', () => {
    expect(items.map((i) => i.title)).toEqual(['Quiz 1', 'Limits worksheet', 'Lab report']);
  });
  it('reads submission state', () => {
    expect(items.find((i) => i.title === 'Quiz 1')?.done).toBe(true);
    expect(items.find((i) => i.title === 'Limits worksheet')?.done).toBe(false);
    expect(items.find((i) => i.title === 'Lab report')).toMatchObject({ done: true, late: true });
  });
  it('makes a stable uid and keeps the assignment link', () => {
    const w = items.find((i) => i.title === 'Limits worksheet')!;
    expect(w.uid).toBe('classroom:c1:w1');
    expect(w.url).toBe('https://classroom.google.com/c/c1/a/w1');
  });
});

describe('autoMapCourses', () => {
  const subjects: Pick<Subject, 'id' | 'name' | 'code'>[] = [
    { id: 10, name: 'AP Calculus AB' },
    { id: 11, name: 'Chemistry' },
  ];
  it('matches by name, prefers saved choices (including "skip")', () => {
    expect(autoMapCourses(courses, subjects, {})).toEqual({ c1: 10, c2: 11 });
    expect(autoMapCourses(courses, subjects, { c1: 99, c2: null })).toEqual({ c1: 99, c2: null });
    expect(autoMapCourses([{ id: 'x', name: 'Art' }], subjects, {})).toEqual({ x: undefined });
  });
});

describe('planImport', () => {
  const items = buildItems(courses, work, subs);
  const map = { c1: 10, c2: 11 };
  const T = (over: Partial<Task>): Task => ({ id: 1, subjectId: 10, title: 'x', status: 'todo', priority: 'med', source: 'manual', ...over });

  it('new items; done ones are hidden unless asked for', () => {
    const rows = planImport(items, [], map, { includeDone: false });
    expect(rows.map((r) => [r.item.title, r.action])).toEqual([['Limits worksheet', 'new']]);
    const all = planImport(items, [], map, { includeDone: true });
    expect(all.map((r) => r.item.title)).toEqual(['Quiz 1', 'Limits worksheet', 'Lab report']);
  });
  it('skipped classes and unmatched classes', () => {
    expect(planImport(items, [], { c1: null, c2: 11 }, { includeDone: true }).map((r) => r.item.title)).toEqual(['Lab report']);
    const unmatched = planImport(items, [], {}, { includeDone: false });
    expect(unmatched[0].subjectId).toBeUndefined(); // shown, but cannot be imported until matched
  });
  it('recognises a task already imported (by uid) and reports what changed', () => {
    const existing = [T({ id: 5, uid: 'classroom:c1:w1', title: 'Limits worksheet', dueDate: '2026-10-01', url: 'https://classroom.google.com/c/c1/a/w1' })];
    const rows = planImport(items, existing, map, { includeDone: false });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: 'update', existingTaskId: 5 });
    expect(rows[0].changes).toEqual(['due date → 2026-10-02']);
  });
  it('unchanged when nothing differs', () => {
    const existing = [T({ id: 5, uid: 'classroom:c1:w1', title: 'Limits worksheet', dueDate: '2026-10-02', url: 'https://classroom.google.com/c/c1/a/w1' })];
    expect(planImport(items, existing, map, { includeDone: false })[0].action).toBe('unchanged');
  });
  it('links a manually typed task with the same title and date instead of duplicating it', () => {
    const existing = [T({ id: 6, title: 'limits WORKSHEET', dueDate: '2026-10-02' })];
    const rows = planImport(items, existing, map, { includeDone: false });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: 'update', existingTaskId: 6 });
    expect(rows[0].changes).toContain('link to Classroom');
  });
  it('a title that differs only by letter case is not a rename', () => {
    const existing = [T({ id: 8, uid: 'classroom:c1:w1', title: 'limits WORKSHEET', dueDate: '2026-10-02', url: 'https://classroom.google.com/c/c1/a/w1' })];
    expect(planImport(items, existing, map, { includeDone: false })[0].action).toBe('unchanged');
    const renamed = [T({ id: 9, uid: 'classroom:c1:w1', title: 'Old name', dueDate: '2026-10-02', url: 'https://classroom.google.com/c/c1/a/w1' })];
    expect(planImport(items, renamed, map, { includeDone: false })[0].changes).toEqual(['new title']);
  });
  it('marks a task done when Classroom says it was turned in', () => {
    const existing = [T({ id: 7, uid: 'classroom:c1:w2', title: 'Quiz 1', dueDate: '2026-09-20' })];
    const row = planImport(items, existing, map, { includeDone: false }).find((r) => r.item.title === 'Quiz 1')!;
    expect(row.changes).toContain('mark done');
  });
  it('hides old items before the cut-off date', () => {
    const rows = planImport(items, [], map, { includeDone: true, sinceDate: '2026-10-01' });
    expect(rows.map((r) => r.item.title)).toEqual(['Limits worksheet', 'Lab report']); // Quiz 1 (Sep 20) dropped; undated Lab report kept
  });
});

describe('taskFromItem / patchFromItem', () => {
  const item = buildItems(courses, work, subs).find((i) => i.title === 'Limits worksheet')!;
  it('builds a task with source, link and uid', () => {
    expect(taskFromItem(item, 10)).toEqual({
      subjectId: 10, title: 'Limits worksheet', dueDate: '2026-10-02', status: 'todo', priority: 'med', source: 'classroom',
      url: 'https://classroom.google.com/c/c1/a/w1', uid: 'classroom:c1:w1',
    });
  });
  it('a patch never lowers a status the student set themselves', () => {
    const task: Task = { id: 1, subjectId: 10, title: 'Limits worksheet', status: 'doing', priority: 'high', source: 'classroom', uid: item.uid };
    const p = patchFromItem(item, task);
    expect(p.status).toBeUndefined();
    expect(p.priority).toBeUndefined();
    expect(p.dueDate).toBe('2026-10-02');
  });
});

const drive = (id: string, title: string) => ({ driveFile: { driveFile: { id, title, alternateLink: `https://drive.google.com/file/d/${id}/view` } } });
const gMaterials: GCourseWorkMaterial[] = [
  { id: 'm1', courseId: 'c1', title: 'Unit 1 stuff', state: 'PUBLISHED', materials: [drive('abc', 'Unit 1 slides.pdf'), { link: { url: 'https://example.com/extra' } }, drive('def', 'Notes.docx')] },
  { id: 'm2', courseId: 'c1', title: 'Draft handout', state: 'DRAFT', materials: [drive('zzz', 'Draft.pdf')] },
  { id: 'm3', courseId: 'gone', title: 'Unknown course material', state: 'PUBLISHED', materials: [drive('yyy', 'X.pdf')] },
  { id: 'm4', courseId: 'c1', title: 'Only a link', state: 'PUBLISHED', materials: [{ youTubeVideo: { alternateLink: 'https://youtube.com/watch?v=xyz' } }] },
];
const gAnnouncements: GAnnouncement[] = [
  { id: 'a1', courseId: 'c2', text: 'Test moved to Friday.\nBring a calculator.', state: 'PUBLISHED', alternateLink: 'https://classroom.google.com/c/c2/p/a1', creationTime: '2026-09-20T12:00:00Z' },
  { id: 'a2', courseId: 'c2', text: '', state: 'PUBLISHED', materials: [{ youTubeVideo: { alternateLink: 'https://youtube.com/watch?v=xyz' } }], creationTime: '2026-09-25T12:00:00Z' },
  { id: 'a3', courseId: 'c2', text: '', state: 'PUBLISHED' },
  { id: 'a4', courseId: 'c2', text: 'Draft', state: 'DRAFT' },
];

describe('buildMaterialItems', () => {
  const items = buildMaterialItems(courses, gMaterials);
  it('extracts only Drive files from published posts, one per file, named by the file name', () => {
    expect(items.map((i) => [i.uid, i.title])).toEqual([
      ['classroom:file:c1:m1:abc', 'Unit 1 slides.pdf'],
      ['classroom:file:c1:m1:def', 'Notes.docx'],
    ]);
    expect(items[0].url).toBe('https://drive.google.com/file/d/abc/view');
  });
});

describe('planMaterialImport / sourceFromItem / patchFromMaterialItem', () => {
  const items = buildMaterialItems(courses, gMaterials);
  const map = { c1: 10, c2: 11 };
  it('new files, and skipped classes', () => {
    expect(planMaterialImport(items, [], map).map((r) => r.action)).toEqual(['new', 'new']);
    expect(planMaterialImport(items, [], { c1: null }).length).toBe(0);
  });
  it('builds a plain Source: file name and link, nothing else', () => {
    const s = sourceFromItem(items[0], 10);
    expect(s).toMatchObject({ subjectId: 10, title: 'Unit 1 slides.pdf', url: 'https://drive.google.com/file/d/abc/view', kind: 'drive', uid: 'classroom:file:c1:m1:abc' });
    expect(s.content).toBeUndefined();
  });
  it('matches an existing file by uid and reports what changed, or unchanged when nothing differs', () => {
    const existing: Source[] = [{ id: 1, subjectId: 10, topicIds: [], kind: 'drive', role: 'learn', title: 'Unit 1 slides.pdf', url: items[0].url, dateAdded: '2026-01-01', uid: items[0].uid }];
    expect(planMaterialImport(items, existing, map).find((r) => r.item.uid === items[0].uid)).toMatchObject({ action: 'unchanged', existingSourceId: 1 });
    const renamed: Source[] = [{ ...existing[0], title: 'Old title' }];
    const row = planMaterialImport(items, renamed, map).find((r) => r.item.uid === items[0].uid)!;
    expect(row.action).toBe('update');
    expect(row.changes).toEqual(['new title']);
    expect(patchFromMaterialItem(items[0], renamed[0])).toEqual({ title: 'Unit 1 slides.pdf' });
  });
  it('adopts a legacy post-titled source with the same link instead of duplicating it, keeping its topics', () => {
    const legacy: Source[] = [{ id: 7, subjectId: 10, topicIds: [3], kind: 'drive', role: 'learn', title: 'Unit 1 stuff', url: items[0].url, dateAdded: '2026-01-01', uid: 'classroom:material:c1:m1' }];
    const row = planMaterialImport(items, legacy, map).find((r) => r.item.uid === items[0].uid)!;
    expect(row).toMatchObject({ action: 'update', existingSourceId: 7 });
    expect(patchFromMaterialItem(items[0], legacy[0])).toEqual({ uid: items[0].uid, title: 'Unit 1 slides.pdf' });
  });
});

describe('announcements', () => {
  const items = buildAnnouncementItems(courses, gAnnouncements);
  const map = { c1: 10, c2: 11 };
  it('keeps published announcements that have text or attachments, newest first', () => {
    expect(items.map((i) => i.uid)).toEqual(['classroom:announcement:c2:a2', 'classroom:announcement:c2:a1']);
    expect(items[1]).toMatchObject({ text: 'Test moved to Friday.\nBring a calculator.', url: 'https://classroom.google.com/c/c2/p/a1' });
    expect(items[0].links).toEqual(['https://youtube.com/watch?v=xyz']);
  });
  it('plans new, skipped and unchanged/edited announcements', () => {
    expect(planAnnouncementImport(items, [], map).map((r) => r.action)).toEqual(['new', 'new']);
    expect(planAnnouncementImport(items, [], { c2: null })).toEqual([]);
    const saved: Announcement[] = [{ id: 5, ...announcementFromItem(items[1], 11) }];
    expect(planAnnouncementImport(items, saved, map).find((r) => r.item.uid === items[1].uid)).toMatchObject({ action: 'unchanged', existingId: 5 });
    expect(planAnnouncementImport(items, [{ ...saved[0], text: 'old text' }], map).find((r) => r.item.uid === items[1].uid)?.action).toBe('update');
  });
});
