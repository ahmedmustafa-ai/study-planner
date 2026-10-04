// "What should I do first?" — ranks work across courses. Pure.
import type { Milestone, Subject, Task } from '@/lib/types';
import type { WeakSpot } from './weakSpots';
import type { RevisitDue } from './revisit';

export interface PriorityItem {
  key: string;
  score: number;
  title: string;
  reason: string;
  subjectId?: number;
  to: string; // in-app link
}

const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

export function rankPriorities(
  input: { tasks: Task[]; milestones: Milestone[]; subjects: Subject[]; weak: WeakSpot[]; revisit?: RevisitDue[] },
  todayIso: string,
  limit = 5,
): PriorityItem[] {
  const items: PriorityItem[] = [];

  for (const t of input.tasks) {
    if (t.status === 'done') continue;
    let score = 0;
    let reason = 'To do';
    if (t.dueDate) {
      const d = days(todayIso, t.dueDate);
      if (d < 0) (score += 100 + Math.min(-d, 10), (reason = `Overdue by ${-d} day${-d > 1 ? 's' : ''}`));
      else if (d === 0) (score += 80, (reason = 'Due today'));
      else if (d <= 3) (score += 50 - d * 5, (reason = d === 1 ? 'Due tomorrow' : `Due in ${d} days`));
      else if (d <= 7) (score += 20, (reason = `Due in ${d} days`));
      else (score += 2, (reason = `Due in ${d} days`));
    } else {
      score += 1;
    }
    if (t.priority === 'high') score += 30;
    if (t.priority === 'low') score -= 5;
    if (t.status === 'doing') score += 10;
    if (score > 8) items.push({ key: `task-${t.id}`, score, title: t.title, reason, subjectId: t.subjectId, to: '/tasks' });
  }

  for (const m of input.milestones) {
    if (m.done || (m.kind === 'checkpoint' && m.result != null)) continue;
    const d = days(todayIso, m.date);
    if (d < -3 || d > 21) continue;
    const score = d < 0 ? 90 : 70 - d * 2;
    items.push({
      key: `ms-${m.id}`,
      score,
      title: m.title,
      reason: d < 0 ? `${-d} days ago` : d === 0 ? 'Today' : `In ${d} days`,
      subjectId: m.subjectId,
      to: '/targets',
    });
  }

  for (const s of input.subjects) {
    if (!s.examDate || s.archived || s.examStatus === 'completed') continue;
    const d = days(todayIso, s.examDate);
    if (d < 0 || d > 45) continue;
    items.push({ key: `exam-${s.id}`, score: 65 - d, title: `${s.name} exam`, reason: `In ${d} days`, subjectId: s.id, to: `/subjects/${s.id}` });
  }

  for (const r of input.revisit ?? []) {
    items.push({
      key: `revisit-${r.topicId}`,
      score: 40 + Math.min(r.overdueDays, 10),
      title: `Revisit: ${r.name}`,
      reason: r.overdueDays > 0 ? `Due for revisit · ${r.overdueDays} day${r.overdueDays > 1 ? "s" : ""} late` : "Due for revisit today",
      subjectId: r.subjectId,
      to: `/topics/${r.topicId}`,
    });
  }

  for (const w of input.weak) {
    items.push({
      key: `weak-${w.topicId}`,
      score: 15 + Math.min(w.score, 10),
      title: `Review: ${w.name}`,
      reason: w.reasons.join(', ') || 'Needs work',
      subjectId: w.subjectId,
      to: `/topics/${w.topicId}`,
    });
  }

  return items.sort((a, b) => b.score - a.score).slice(0, limit);
}
