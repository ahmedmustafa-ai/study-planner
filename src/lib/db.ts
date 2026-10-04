import Dexie, { type Table } from 'dexie';
import { DB_NAME, migrateColor } from '@/config';
import type {
  AcademicYear, Activity, AiSession, Announcement, KnowledgeCard, Milestone, Mistake, PromptTemplate,
  CalEvent, StudySession, Score, Setting, Source, Subject, Task, Term, Topic, Unit, WeeklyReview,
} from './types';
import { today } from './utils';
import { SYNCED_TABLES } from './algorithms/sync';

export class StudyDB extends Dexie {
  academicYears!: Table<AcademicYear, number>;
  subjects!: Table<Subject, number>;
  units!: Table<Unit, number>;
  topics!: Table<Topic, number>;
  sources!: Table<Source, number>;
  knowledgeCards!: Table<KnowledgeCard, number>;
  terms!: Table<Term, number>;
  mistakes!: Table<Mistake, number>;
  tasks!: Table<Task, number>;
  milestones!: Table<Milestone, number>;
  scores!: Table<Score, number>;
  aiSessions!: Table<AiSession, number>;
  prompts!: Table<PromptTemplate, number>;
  weeklyReviews!: Table<WeeklyReview, number>;
  activities!: Table<Activity, number>;
  events!: Table<CalEvent, number>;
  studySessions!: Table<StudySession, number>;
  announcements!: Table<Announcement, number>;
  settings!: Table<Setting, string>;

  constructor() {
    super(DB_NAME);
    // v1 — never edit. Schema changes go in a new db.version(2).stores({...}).upgrade(...)
    this.version(1).stores({
      academicYears: '++id, label',
      subjects: '++id, academicYearId, name, kind, examStatus, languageLoad',
      units: '++id, subjectId, order',
      topics: '++id, subjectId, unitId, status, focus, lastTouched',
      sources: '++id, subjectId, *topicIds, kind, role, dateAdded',
      knowledgeCards: '++id, subjectId, topicId, sourceId, createdAt',
      terms: '++id, subjectId, topicId, nextReview, dateAdded',
      mistakes: '++id, subjectId, topicId, cause, date, fixed',
      tasks: '++id, subjectId, topicId, dueDate, status, priority, source',
      milestones: '++id, subjectId, date, kind',
      scores: '++id, subjectId, topicId, milestoneId, date',
      aiSessions: '++id, subjectId, topicId, tool, createdAt',
      prompts: '++id, name, tool',
      weeklyReviews: '++id, weekStart',
      activities: '++id, date, category',
      settings: 'key',
    });
    // v2 — same tables; recolors existing subjects to the muted palette (data-only change).
    this.version(2)
      .stores({})
      .upgrade((tx) =>
        tx
          .table('subjects')
          .toCollection()
          .modify((s: Subject) => {
            s.color = migrateColor(s.color);
          }),
      );
    // v3 — calendar events (classes, events, exams). Added as a new version; v1/v2 are never edited.
    this.version(3).stores({ events: '++id, subjectId, date, kind' });
    // v4 — study time (timer sessions).
    this.version(4).stores({ studySessions: '++id, subjectId, topicId, date' });
    // v5 — a stable uuid on every synced table (local `id` stays as-is; uuid is what cross-device
    // sync uses as identity, since auto-increment ids are only meaningful on one device). The
    // upgrade backfills a uuid for every row that predates this version.
    this.version(5)
      .stores({
        academicYears: '++id, label, uuid',
        subjects: '++id, academicYearId, name, kind, examStatus, languageLoad, uuid',
        units: '++id, subjectId, order, uuid',
        topics: '++id, subjectId, unitId, status, focus, lastTouched, uuid',
        sources: '++id, subjectId, *topicIds, kind, role, dateAdded, uuid',
        knowledgeCards: '++id, subjectId, topicId, sourceId, createdAt, uuid',
        terms: '++id, subjectId, topicId, nextReview, dateAdded, uuid',
        mistakes: '++id, subjectId, topicId, cause, date, fixed, uuid',
        tasks: '++id, subjectId, topicId, dueDate, status, priority, source, uuid',
        milestones: '++id, subjectId, date, kind, uuid',
        scores: '++id, subjectId, topicId, milestoneId, date, uuid',
        aiSessions: '++id, subjectId, topicId, tool, createdAt, uuid',
        prompts: '++id, name, tool, uuid',
        weeklyReviews: '++id, weekStart, uuid',
        activities: '++id, date, category, uuid',
        events: '++id, subjectId, date, kind, uuid',
        studySessions: '++id, subjectId, topicId, date, uuid',
      })
      .upgrade(async (tx) => {
        for (const name of SYNCED_TABLES) {
          await tx
            .table(name)
            .toCollection()
            .modify((row: { uuid?: string; updatedAt?: string }) => {
              row.uuid ??= crypto.randomUUID();
              row.updatedAt ??= new Date().toISOString();
            });
        }
      });
    // v6 — Classroom announcements get their own table (they used to be saved as Library sources).
    // Existing announcement sources move over so nothing is lost. Not cross-device synced: they are re-fetched from Classroom.
    this.version(6)
      .stores({ announcements: '++id, subjectId, uid, date' })
      .upgrade(async (tx) => {
        const legacy: Source[] = await tx.table('sources').filter((s: Source) => !!s.uid?.startsWith('classroom:announcement:')).toArray();
        for (const s of legacy) {
          await tx.table('announcements').add({
            subjectId: s.subjectId,
            courseName: '',
            uid: s.uid!,
            text: s.content ?? s.title,
            url: s.url,
            links: [],
            date: s.dateAdded,
          } satisfies Announcement);
        }
        await tx.table('sources').bulkDelete(legacy.map((s) => s.id!));
      });
  }
}

/**
 * Stamps `uuid` + `updatedAt` on every create/update to every synced table, so the sync engine
 * can identify rows across devices and resolve conflicts — without any feature code needing to
 * change. Registered once, here, rather than at each of the dozens of call sites across features.
 */
function registerSyncHooks(db: StudyDB) {
  for (const name of SYNCED_TABLES) {
    const table = db.table(name);
    table.hook('creating', (_primKey, obj: { uuid?: string; updatedAt?: string }) => {
      obj.uuid ??= crypto.randomUUID();
      obj.updatedAt = new Date().toISOString();
    });
    table.hook('updating', () => ({ updatedAt: new Date().toISOString() }));
  }
}

export const db = new StudyDB();
registerSyncHooks(db);

export const TABLE_NAMES = [
  'academicYears', 'subjects', 'units', 'topics', 'sources', 'knowledgeCards', 'terms', 'mistakes',
  'tasks', 'milestones', 'scores', 'aiSessions', 'prompts', 'weeklyReviews', 'activities', 'events', 'studySessions', 'announcements', 'settings',
] as const;

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row === undefined ? fallback : (row.value as T);
}

export function setSetting(key: string, value: unknown) {
  return db.settings.put({ key, value });
}

/** Mark a topic as touched today (feeds "what moved" in weekly review). */
export async function touchTopic(topicId?: number) {
  if (!topicId) return;
  await db.topics.update(topicId, { lastTouched: today() });
}
