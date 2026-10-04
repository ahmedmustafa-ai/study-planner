import { db } from '@/lib/db';
import type { Subject } from '@/lib/types';
import { SUBJECT_COLORS } from '@/config';
import type { SubjectTemplate } from './templates';
import { deleteTopic } from './topicActions';

export async function createSubjectFromTemplate(
  tpl: SubjectTemplate,
  academicYearId: number,
  overrides: Partial<Subject> = {},
): Promise<number> {
  return db.transaction('rw', db.subjects, db.units, db.topics, async () => {
    const count = await db.subjects.count();
    const subjectId = await db.subjects.add({
      academicYearId,
      name: tpl.name,
      color: SUBJECT_COLORS[count % SUBJECT_COLORS.length],
      kind: tpl.kind,
      level: tpl.level,
      examStatus: tpl.level === 'AP' ? 'studying' : 'none',
      languageLoad: tpl.languageLoad,
      ...overrides,
    });
    for (const [ui, u] of tpl.units.entries()) {
      const unitId = await db.units.add({ subjectId, name: u.name, order: ui });
      await db.topics.bulkAdd(
        u.topics.map((name, ti) => ({ subjectId, unitId, name, order: ti, status: 'not_started' as const, focus: 'none' as const })),
      );
    }
    return subjectId;
  });
}

/** Deletes a subject and everything attached to it. */
export async function deleteSubjectCascade(subjectId: number) {
  const tables = [db.units, db.topics, db.sources, db.knowledgeCards, db.terms, db.mistakes, db.tasks, db.scores, db.aiSessions, db.events, db.studySessions];
  await db.transaction('rw', [db.subjects, db.milestones, ...tables], async () => {
    for (const t of tables) await (t as typeof db.units).where('subjectId').equals(subjectId).delete();
    await db.milestones.where('subjectId').equals(subjectId).delete();
    await db.subjects.delete(subjectId);
  });
}

export async function deleteUnitCascade(unitId: number) {
  const topics = await db.topics.where('unitId').equals(unitId).primaryKeys();
  for (const t of topics) await deleteTopic(t);
  await db.units.delete(unitId);
}

export async function currentYearId(): Promise<number> {
  const years = await db.academicYears.toArray();
  if (years.length) return years[years.length - 1].id!;
  return db.academicYears.add({ label: 'Grade 11 (2026–27)' });
}

/** Move a course up (-1) or down (+1) in the manual order. Renumbers all courses so orders stay unique. */
export async function moveSubject(subjectId: number, dir: -1 | 1) {
  const all = (await db.subjects.toArray()).sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.id! - b.id!);
  const i = all.findIndex((s) => s.id === subjectId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= all.length) return;
  [all[i], all[j]] = [all[j], all[i]];
  await db.transaction('rw', db.subjects, async () => {
    for (const [idx, s] of all.entries()) await db.subjects.update(s.id!, { order: idx });
  });
}
