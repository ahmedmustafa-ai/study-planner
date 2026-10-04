// Calendar logic — pure, framework-free. Merges classes/events/exams, tasks, deadlines into one list of items.
import type { CalEvent, Milestone, Subject, Task } from '@/lib/types';

export type CalKind = 'class' | 'event' | 'exam' | 'task' | 'deadline';

export interface CalItem {
  key: string;
  kind: CalKind;
  date: string;
  startTime?: string;
  endTime?: string;
  title: string;
  subjectId?: number;
  done?: boolean;
  location?: string;
  ref: { type: 'event' | 'task' | 'milestone' | 'subject'; id: number };
}

// ---- date helpers (UTC-safe on 'YYYY-MM-DD' strings) ----
const toUTC = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const fromUTC = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDaysISO = (iso: string, n: number) => fromUTC(toUTC(iso) + n * 86_400_000);
export const weekdayOf = (iso: string) => new Date(toUTC(iso)).getUTCDay(); // 0 = Sunday
export const addMonthsISO = (iso: string, n: number) => {
  const [y, m] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 10);
};

/** The 7 dates of the week containing `iso`. weekStart: 0 = Sunday, 1 = Monday, 6 = Saturday. */
export function weekDates(iso: string, weekStart: number): string[] {
  const back = (weekdayOf(iso) - weekStart + 7) % 7;
  const first = addDaysISO(iso, -back);
  return Array.from({ length: 7 }, (_, i) => addDaysISO(first, i));
}

/** 6 rows × 7 days covering the month of `iso`. */
export function monthGrid(iso: string, weekStart: number): string[] {
  const first = iso.slice(0, 8) + '01';
  const start = weekDates(first, weekStart)[0];
  return Array.from({ length: 42 }, (_, i) => addDaysISO(start, i));
}

// ---- events ----
/** All occurrences of one event inside [from, to] (inclusive). */
export function expandEvent(e: CalEvent, from: string, to: string): CalItem[] {
  const make = (date: string): CalItem => ({
    key: `event-${e.id}-${date}`,
    kind: e.kind,
    date,
    startTime: e.startTime || undefined,
    endTime: e.endTime || undefined,
    title: e.title,
    subjectId: e.subjectId,
    location: e.location,
    ref: { type: 'event', id: e.id! },
  });

  if (e.repeat !== 'weekly') return e.date >= from && e.date <= to ? [make(e.date)] : [];

  const days = e.weekdays?.length ? e.weekdays : [weekdayOf(e.date)];
  const out: CalItem[] = [];
  const start = e.date > from ? e.date : from;
  const end = e.until && e.until < to ? e.until : to;
  for (let d = start; d <= end; d = addDaysISO(d, 1)) {
    if (days.includes(weekdayOf(d))) out.push(make(d));
  }
  return out;
}

export interface CalSources {
  events: CalEvent[];
  tasks: Task[];
  milestones: Milestone[];
  subjects: Subject[];
}

export function buildCalendarItems(src: CalSources, from: string, to: string): CalItem[] {
  const items: CalItem[] = [];
  for (const e of src.events) items.push(...expandEvent(e, from, to));
  for (const t of src.tasks) {
    if (!t.dueDate || t.dueDate < from || t.dueDate > to) continue;
    items.push({
      key: `task-${t.id}`,
      kind: 'task',
      date: t.dueDate,
      title: t.title,
      subjectId: t.subjectId,
      done: t.status === 'done',
      ref: { type: 'task', id: t.id! },
    });
  }
  for (const m of src.milestones) {
    if (m.date < from || m.date > to) continue;
    items.push({
      key: `milestone-${m.id}`,
      kind: 'deadline',
      date: m.date,
      title: m.title,
      subjectId: m.subjectId,
      done: m.kind === 'deadline' ? m.done : m.result != null,
      ref: { type: 'milestone', id: m.id! },
    });
  }
  // Exam dates set on a course — skip if an exam event already covers that day for that course.
  for (const s of src.subjects) {
    if (!s.examDate || s.examDate < from || s.examDate > to || s.archived) continue;
    const dup = src.events.some((e) => e.kind === 'exam' && e.subjectId === s.id && e.date === s.examDate);
    if (dup) continue;
    items.push({
      key: `subject-exam-${s.id}`,
      kind: 'exam',
      date: s.examDate,
      title: `${s.name} exam`,
      subjectId: s.id,
      done: s.examStatus === 'completed',
      ref: { type: 'subject', id: s.id! },
    });
  }
  return sortItems(items);
}

const KIND_RANK: Record<CalKind, number> = { exam: 0, class: 1, event: 2, deadline: 3, task: 4 };

/** Date, then all-day first, then time, then kind. */
export function sortItems(items: CalItem[]): CalItem[] {
  return items.slice().sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.startTime ? 1 : 0) - (b.startTime ? 1 : 0) ||
      (a.startTime ?? '').localeCompare(b.startTime ?? '') ||
      KIND_RANK[a.kind] - KIND_RANK[b.kind] ||
      a.title.localeCompare(b.title),
  );
}

export function groupByDate(items: CalItem[]): Map<string, CalItem[]> {
  const m = new Map<string, CalItem[]>();
  for (const it of items) {
    if (!m.has(it.date)) m.set(it.date, []);
    m.get(it.date)!.push(it);
  }
  return m;
}

export interface CalFilter {
  kinds: Record<CalKind, boolean>;
  hiddenSubjects: number[];
}

export function filterItems(items: CalItem[], f: CalFilter): CalItem[] {
  return items.filter((i) => f.kinds[i.kind] !== false && !(i.subjectId != null && f.hiddenSubjects.includes(i.subjectId)));
}

export function timeLabel(i: Pick<CalItem, 'startTime' | 'endTime'>): string {
  if (!i.startTime) return 'All day';
  return i.endTime ? `${i.startTime}–${i.endTime}` : i.startTime;
}
