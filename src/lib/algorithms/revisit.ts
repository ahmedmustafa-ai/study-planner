// "You're forgetting this" — spaced revisits for topics marked solid. Pure.
import type { Topic } from '@/lib/types';
import { addDaysISO } from './calendar';

/** Days until the next revisit. Grows each time you still remember the topic. */
export const REVISIT_STEPS = [3, 7, 14, 30, 60, 90];
/** A solid topic with no schedule yet (marked solid before this feature) is due this many days after it was last touched. */
export const UNSCHEDULED_AFTER_DAYS = 7;

export interface RevisitPlan {
  interval: number;
  nextReview: string;
}

/** Schedule for a topic that has just become solid. */
export function firstRevisit(todayIso: string): RevisitPlan {
  return { interval: REVISIT_STEPS[0], nextReview: addDaysISO(todayIso, REVISIT_STEPS[0]) };
}

/** After a recall check: still solid → longer wait; forgot it → back to shaky, no schedule. */
export function afterRevisit(
  prevInterval: number | undefined,
  stillSolid: boolean,
  todayIso: string,
): { status: 'solid'; interval: number; nextReview: string } | { status: 'shaky'; interval: undefined; nextReview: undefined } {
  if (!stillSolid) return { status: 'shaky', interval: undefined, nextReview: undefined };
  const next = REVISIT_STEPS.find((s) => s > (prevInterval ?? 0)) ?? REVISIT_STEPS[REVISIT_STEPS.length - 1];
  return { status: 'solid', interval: next, nextReview: addDaysISO(todayIso, next) };
}

export interface RevisitDue {
  topicId: number;
  subjectId: number;
  name: string;
  overdueDays: number;
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** Solid topics whose revisit date has come, most overdue first. */
export function dueRevisits(topics: Topic[], todayIso: string): RevisitDue[] {
  const out: RevisitDue[] = [];
  for (const t of topics) {
    if (t.status !== 'solid' || t.id == null) continue;
    const due = t.nextReview ?? (t.lastTouched ? addDaysISO(t.lastTouched, UNSCHEDULED_AFTER_DAYS) : undefined);
    if (!due || due > todayIso) continue;
    out.push({ topicId: t.id, subjectId: t.subjectId, name: t.name, overdueDays: daysBetween(due, todayIso) });
  }
  return out.sort((a, b) => b.overdueDays - a.overdueDays);
}
