// Milestone status, review interleaving, knowledge export. Pure.
import type { KnowledgeCard, Milestone, Topic, Unit } from '@/lib/types';

export type MilestoneState = 'upcoming' | 'due-soon' | 'overdue' | 'passed' | 'failed' | 'done';

export function milestoneState(m: Milestone, todayIso: string, soonDays = 14): MilestoneState {
  if (m.kind === 'checkpoint' && m.result != null) {
    return m.passThreshold == null || m.result >= m.passThreshold ? 'passed' : 'failed';
  }
  if (m.done) return 'done';
  const days = Math.round((Date.parse(m.date) - Date.parse(todayIso)) / 86_400_000);
  if (days < 0) return 'overdue';
  if (days <= soonDays) return 'due-soon';
  return 'upcoming';
}

/** Which branch applies after a checkpoint result is logged. */
export function milestoneBranch(m: Milestone): string | undefined {
  const s = m.kind === 'checkpoint' && m.result != null ? milestoneState(m, m.date) : undefined;
  if (s === 'passed') return m.onPass;
  if (s === 'failed') return m.onFail;
  return undefined;
}

/**
 * Interleave items round-robin by group so a review session mixes subjects
 * instead of one subject marathon. Keeps each group's internal order.
 */
export function interleave<T>(items: T[], groupOf: (t: T) => string | number): T[] {
  const groups = new Map<string | number, T[]>();
  for (const it of items) {
    const k = groupOf(it);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(it);
  }
  const queues = [...groups.values()];
  const out: T[] = [];
  let added = true;
  for (let i = 0; added; i++) {
    added = false;
    for (const q of queues) {
      if (i < q.length) {
        out.push(q[i]);
        added = true;
      }
    }
  }
  return out;
}

/** Markdown export of a subject's knowledge — upload back into NotebookLM / ChatGPT Project. */
export function knowledgeMarkdown(
  subjectName: string,
  units: Unit[],
  topics: Topic[],
  cards: KnowledgeCard[],
  terms: { term: string; definition: string }[],
  exportedOn: string,
): string {
  const lines = [`# ${subjectName} — my knowledge notes`, `_Exported ${exportedOn} from Study OS. These are my own distilled notes._`, ''];
  const byTopic = new Map<number | undefined, KnowledgeCard[]>();
  for (const c of cards) {
    const k = c.topicId;
    if (!byTopic.has(k)) byTopic.set(k, []);
    byTopic.get(k)!.push(c);
  }
  for (const u of [...units].sort((a, b) => a.order - b.order)) {
    const uTopics = topics.filter((t) => t.unitId === u.id).sort((a, b) => a.order - b.order);
    const withCards = uTopics.filter((t) => byTopic.has(t.id));
    if (!withCards.length) continue;
    lines.push(`## ${u.name}`);
    for (const t of withCards) {
      lines.push(`### ${t.name} (status: ${t.status.replace('_', ' ')})`);
      for (const c of byTopic.get(t.id)!) lines.push(`- ${c.starred ? '⭐ ' : ''}${c.text}`);
      lines.push('');
    }
  }
  const loose = byTopic.get(undefined);
  if (loose?.length) {
    lines.push('## General');
    for (const c of loose) lines.push(`- ${c.text}`);
    lines.push('');
  }
  if (terms.length) {
    lines.push('## Glossary');
    for (const t of terms) lines.push(`- **${t.term}**: ${t.definition}`);
  }
  return lines.join('\n');
}
