import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { detectWeakSpots } from '@/lib/algorithms/weakSpots';
import { rankPriorities } from '@/lib/algorithms/priorities';
import { dueRevisits } from '@/lib/algorithms/revisit';
import { WEEKLY_REVIEW_DAYS } from '@/config';
import { addDays, daysBetween, today } from '@/lib/utils';
import type { Subject, Task, Topic } from '@/lib/types';

const byOrder = (a: Subject, b: Subject) => (a.order ?? 999) - (b.order ?? 999) || a.id! - b.id!;

/** One live snapshot that Home and the Study view both draw from. */
export function useDashboard() {
  const t0 = today();
  return useLiveQuery(async () => {
    const [subjects, topics, mistakes, scores, tasks, milestones, dueTerms, pending, lastReview, firstRun, materials, sessions] = await Promise.all([
      db.subjects.toArray(),
      db.topics.toArray(),
      db.mistakes.toArray(),
      db.scores.toArray(),
      db.tasks.toArray(),
      db.milestones.toArray(),
      db.terms.where('nextReview').belowOrEqual(t0).count(),
      db.aiSessions.filter((s) => !s.returnRaw).count(),
      db.weeklyReviews.orderBy('weekStart').last(),
      db.settings.get('firstRun'),
      db.sources.toArray(),
      db.studySessions.where("date").aboveOrEqual(addDays(t0, -6)).toArray(),
    ]);
    // "Studying" = not archived and not switched off. Everything below is limited to these courses.
    const studying = subjects.filter((s) => !s.archived && s.studying !== false).sort(byOrder);
    const ids = new Set(studying.map((s) => s.id!));
    const liveTopics: Topic[] = topics.filter((t) => ids.has(t.subjectId));
    const liveTasks: Task[] = tasks.filter((t) => ids.has(t.subjectId));
    const weak = detectWeakSpots(liveTopics, mistakes, scores, t0, 5);
    const revisit = dueRevisits(liveTopics, t0);
    const reviewAnchor = lastReview?.weekStart ?? (firstRun ? String(firstRun.value) : undefined);
    return {
      t0,
      studying,
      subjects,
      topics: liveTopics,
      tasks: liveTasks,
      milestones,
      weak,
      revisit,
      sessions,
      priorities: rankPriorities(
        { tasks: liveTasks, milestones: milestones.filter((m) => m.subjectId == null || ids.has(m.subjectId)), subjects: studying, weak, revisit },
        t0,
        8,
      ),
      materialsBySubject: materials.reduce<Record<number, number>>((m, s) => ((m[s.subjectId] = (m[s.subjectId] ?? 0) + 1), m), {}),
      openMistakes: mistakes.filter((m) => !m.fixed),
      dueTerms,
      pending,
      reviewDue: !reviewAnchor || daysBetween(reviewAnchor, t0) >= WEEKLY_REVIEW_DAYS,
    };
  }, [t0]);
}
