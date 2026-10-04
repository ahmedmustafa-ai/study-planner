// First-run seed: the student's real subjects, starter prompts, real next actions and deadlines.
import { db, getSetting, setSetting } from './db';
import { addDays, today } from './utils';
import { DEFAULT_PROFILE } from '@/config';
import { TEMPLATES } from '@/features/subjects/templates';
import { createSubjectFromTemplate } from '@/features/subjects/queries';
import { SEED_PROMPTS } from '@/features/workbench/seedPrompts';

const SEED_SUBJECTS = ['ap-calc-ab', 'ap-physics-1', 'sat', 'chemistry', 'biology', 'english-growth'];

let seeding: Promise<void> | null = null;

const EVER_SEEDED_KEY = 'study-os-ever-seeded';

function markEverSeededLocally() {
  try {
    localStorage.setItem(EVER_SEEDED_KEY, '1');
  } catch {
    // best effort — if localStorage is unavailable, we just lose this extra safety net
  }
}

function wasEverSeededLocally(): boolean {
  try {
    return localStorage.getItem(EVER_SEEDED_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * True when this browser was seeded before (per a marker kept OUTSIDE IndexedDB) but Dexie now
 * reports no seed — the signature of IndexedDB having been wiped (storage eviction, a "clear
 * site data," a different browser profile) rather than a genuine first run. Callers should show
 * a recovery choice instead of letting `ensureSeeded` silently refill the original demo data,
 * which would look exactly like "my edits are gone."
 */
export async function looksWiped(): Promise<boolean> {
  if (!wasEverSeededLocally()) return false;
  return !(await getSetting('seeded', false));
}

/** Call after a successful restore, or when the user explicitly chooses to start fresh. */
export function confirmSeededLocally() {
  markEverSeededLocally();
}

export function ensureSeeded(): Promise<void> {
  seeding ??= seed();
  return seeding;
}

async function seed() {
  if (await getSetting('seeded', false)) {
    // Already seeded from a prior run (including installs from before this marker existed) —
    // backfill the local marker so a future wipe is caught instead of silently reseeded.
    markEverSeededLocally();
    return;
  }
  // One transaction: a half-finished seed never leaves duplicate data behind.
  await db.transaction('rw', db.tables, seedAll);
  markEverSeededLocally();
}

async function seedAll() {
  const t = today();
  const yearId = await db.academicYears.add({ label: 'Grade 11 (2026–27)' });

  const ids: Record<string, number> = {};
  for (const key of SEED_SUBJECTS) {
    const tpl = TEMPLATES.find((x) => x.key === key)!;
    ids[key] = await createSubjectFromTemplate(tpl, yearId);
  }

  await db.prompts.bulkAdd(SEED_PROMPTS);

  await db.sources.bulkAdd([
    { subjectId: ids['ap-calc-ab'], topicIds: [], kind: 'link', role: 'learn', title: 'AP Calculus AB — course page (AP Central)', url: 'https://apcentral.collegeboard.org/courses/ap-calculus-ab', dateAdded: t },
    { subjectId: ids['ap-calc-ab'], topicIds: [], kind: 'video', role: 'learn', title: 'Khan Academy — AP Calculus AB', url: 'https://www.khanacademy.org/math/ap-calculus-ab', dateAdded: t },
    { subjectId: ids['ap-physics-1'], topicIds: [], kind: 'video', role: 'learn', title: 'Khan Academy — AP Physics 1', url: 'https://www.khanacademy.org/science/ap-physics-1', dateAdded: t },
    { subjectId: ids['sat'], topicIds: [], kind: 'link', role: 'test', title: 'Bluebook — official full-length practice tests', url: 'https://bluebook.collegeboard.org/', dateAdded: t },
    { subjectId: ids['sat'], topicIds: [], kind: 'link', role: 'practice', title: 'Khan Academy — Digital SAT', url: 'https://www.khanacademy.org/digital-sat', dateAdded: t },
  ]);

  // Real next actions from the planning conversation — not dummy data.
  await db.tasks.bulkAdd([
    { subjectId: ids['ap-physics-1'], title: 'Ask AP coordinator: which AP Physics course + exam registration deadline', dueDate: addDays(t, 7), status: 'todo', priority: 'high', source: 'manual' },
    { subjectId: ids['sat'], title: 'Take a full Bluebook practice test → log baseline score', dueDate: addDays(t, 17), status: 'todo', priority: 'high', source: 'manual' },
    { subjectId: ids['english-growth'], title: 'Check Germany Direktzulassung: which AP subjects count (uni-assist / anabin)', dueDate: addDays(t, 22), status: 'todo', priority: 'med', source: 'manual' },
    { subjectId: ids['ap-calc-ab'], title: 'AI Setup Kit: create ChatGPT Project + Gemini notebook for Calc AB', dueDate: addDays(t, 4), status: 'todo', priority: 'med', source: 'manual' },
  ]);

  await db.milestones.bulkAdd([
    { subjectId: ids['ap-calc-ab'], title: 'Calc AB — Foundation phase ends', date: '2026-10-31', kind: 'deadline', done: false, note: 'Units 1–2 should be learning/solid.' },
    { subjectId: ids['ap-physics-1'], title: 'AP exam registration — CONFIRM DATE', date: '2026-11-13', kind: 'deadline', done: false, note: 'Placeholder date. Ask your AP coordinator for the real deadline, then edit this. Also decide: take the AP Physics exam in May or not.' },
    {
      subjectId: ids['ap-calc-ab'], title: 'Calc AB — Proficiency checkpoint test', date: '2027-01-28', kind: 'checkpoint', target: 70, passThreshold: 60,
      onPass: 'Continue to Exam Prep phase in March.', onFail: 'Spend February re-doing weakest units before Exam Prep.', done: false,
    },
    { subjectId: ids['ap-calc-ab'], title: 'Calc AB — Proficiency phase ends', date: '2027-02-28', kind: 'deadline', done: false },
    { title: 'MIT Early Action deadline — CONFIRM DATE', date: '2027-11-01', kind: 'deadline', done: false, note: 'Placeholder date. Check the official MIT admissions site for the exact deadline for your year.' },
  ]);

  await setSetting('profile', DEFAULT_PROFILE);
  await setSetting('lastBackup', t); // don't nag on day one
  await setSetting('firstRun', t); // first weekly review is due after one week of use
  await setSetting('seeded', true);
}
