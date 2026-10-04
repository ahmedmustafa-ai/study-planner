// DB-facing wrappers around the pure context/capture functions.
import { db, getSetting, touchTopic } from '@/lib/db';
import { DEFAULT_PROFILE } from '@/config';
import { buildContextPack } from '@/lib/algorithms/contextPack';
import { detectWeakSpots } from '@/lib/algorithms/weakSpots';
import type { CaptureResult } from '@/lib/algorithms/capture';
import { today } from '@/lib/utils';
import { addCard, addMistake } from '@/features/knowledge/queries';
import { addTerm } from '@/features/vocab/queries';
import { addTask } from '@/features/tasks/queries';

export async function gatherContext(subjectId: number, topicId?: number): Promise<string> {
  const subject = await db.subjects.get(subjectId);
  if (!subject) return '';
  const [profile, topics, allMistakes, scores, allSources, allCards, allTerms] = await Promise.all([
    getSetting('profile', DEFAULT_PROFILE),
    db.topics.where('subjectId').equals(subjectId).toArray(),
    db.mistakes.where('subjectId').equals(subjectId).toArray(),
    db.scores.where('subjectId').equals(subjectId).toArray(),
    db.sources.where('subjectId').equals(subjectId).toArray(),
    db.knowledgeCards.where('subjectId').equals(subjectId).toArray(),
    db.terms.where('subjectId').equals(subjectId).toArray(),
  ]);
  const topic = topics.find((t) => t.id === topicId);
  const unit = topic ? await db.units.get(topic.unitId) : undefined;
  const weak = detectWeakSpots(topics, allMistakes, scores, today());

  // Topic-level items first; fall back to subject-wide when a topic has little.
  const scoped = <T extends { topicId?: number }>(xs: T[]) => (topicId ? [...xs.filter((x) => x.topicId === topicId), ...xs.filter((x) => x.topicId !== topicId)] : xs);
  const sources = topicId ? [...allSources.filter((s) => s.topicIds.includes(topicId)), ...allSources.filter((s) => !s.topicIds.includes(topicId))] : allSources;

  return buildContextPack({
    profile,
    subject,
    topic,
    unit,
    sources,
    cards: scoped(allCards.slice().reverse()),
    mistakes: scoped(allMistakes.slice().reverse()),
    terms: scoped(allTerms),
    weakTopicNames: weak.map((w) => `${w.name} (${w.reasons.join(', ') || 'needs work'})`),
  });
}

export interface CaptureSelection {
  takeaways: boolean[];
  terms: boolean[];
  mistakes: boolean[];
  next: boolean[];
}

export async function fileCapture(r: CaptureResult, sel: CaptureSelection, subjectId: number, topicId: number | undefined) {
  let n = 0;
  for (const [i, t] of r.takeaways.entries()) if (sel.takeaways[i]) (await addCard({ subjectId, topicId, text: t, origin: 'capture' }), n++);
  for (const [i, t] of r.terms.entries()) if (sel.terms[i]) (await addTerm({ subjectId, topicId, term: t.term, definition: t.definition }), n++);
  for (const [i, m] of r.mistakes.entries()) if (sel.mistakes[i]) (await addMistake({ subjectId, topicId, text: m.text, cause: m.cause }), n++);
  for (const [i, t] of r.next.entries()) if (sel.next[i]) (await addTask({ subjectId, topicId, title: t, source: 'capture' }), n++);
  await touchTopic(topicId);
  return n;
}

export const TOOL_URLS: Record<string, string> = {
  chatgpt: 'https://chatgpt.com/',
  notebooklm: 'https://notebooklm.google.com/',
  claude: 'https://claude.ai/',
  gemini: 'https://gemini.google.com/',
};
