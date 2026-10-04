// Weak-spot detector — ranks topics by how much attention they need. Pure.
import { WEAK_SPOTS } from '@/config';
import type { Mistake, Score, Topic } from '@/lib/types';

export interface WeakSpot {
  topicId: number;
  subjectId: number;
  name: string;
  score: number;
  reasons: string[];
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

export function detectWeakSpots(
  topics: Topic[],
  mistakes: Mistake[],
  scores: Score[],
  todayIso: string,
  topN: number = WEAK_SPOTS.topN,
): WeakSpot[] {
  const byTopic = new Map<number, WeakSpot>();
  for (const t of topics) {
    if (t.id == null) continue;
    const w = WEAK_SPOTS.statusWeight[t.status];
    const reasons: string[] = [];
    if (t.status === 'shaky') reasons.push('marked shaky');
    byTopic.set(t.id, { topicId: t.id, subjectId: t.subjectId, name: t.name, score: w, reasons });
  }

  const mistakeCount = new Map<number, { open: number; fixed: number }>();
  for (const m of mistakes) {
    if (m.topicId == null) continue;
    const spot = byTopic.get(m.topicId);
    if (!spot) continue;
    const age = Math.max(0, daysBetween(m.date, todayIso));
    const decay = Math.pow(0.5, age / WEAK_SPOTS.mistakeHalfLifeDays);
    spot.score += (m.fixed ? WEAK_SPOTS.fixedMistakeWeight : WEAK_SPOTS.openMistakeWeight) * decay;
    const c = mistakeCount.get(m.topicId) ?? { open: 0, fixed: 0 };
    if (m.fixed) c.fixed++;
    else c.open++;
    mistakeCount.set(m.topicId, c);
  }
  for (const [id, c] of mistakeCount) {
    if (c.open) byTopic.get(id)!.reasons.push(`${c.open} open mistake${c.open > 1 ? 's' : ''}`);
  }

  for (const s of scores) {
    if (s.topicId == null || s.max <= 0) continue;
    const spot = byTopic.get(s.topicId);
    if (!spot) continue;
    const pct = (s.score / s.max) * 100;
    if (pct < WEAK_SPOTS.scorePassPercent) {
      spot.score += ((WEAK_SPOTS.scorePassPercent - pct) / 10) * WEAK_SPOTS.scorePointsPer10Percent;
      spot.reasons.push(`${s.label}: ${Math.round(pct)}%`);
    }
  }

  return [...byTopic.values()]
    .filter((s) => s.score > 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

/** Share of topics marked solid — a simple readiness signal for checkpoints. */
export function readiness(topics: Pick<Topic, 'status'>[]): { solid: number; total: number; percent: number } {
  const total = topics.length;
  const solid = topics.filter((t) => t.status === 'solid').length;
  return { solid, total, percent: total ? Math.round((solid / total) * 100) : 0 };
}
