import { db, touchTopic } from '@/lib/db';
import { initialSm2, reviewSm2, type Rating } from '@/lib/algorithms/sm2';
import { today } from '@/lib/utils';

/** Adds a term, or updates the definition if the subject already has it. Returns true if new. */
export async function addTerm(p: { subjectId: number; topicId?: number; term: string; definition: string; example?: string }): Promise<boolean> {
  const term = p.term.trim();
  if (!term) return false;
  const existing = (await db.terms.where('subjectId').equals(p.subjectId).toArray()).find(
    (t) => t.term.toLowerCase() === term.toLowerCase(),
  );
  if (existing) {
    if (p.definition.trim()) await db.terms.update(existing.id!, { definition: p.definition.trim() });
    return false;
  }
  const t = today();
  await db.terms.add({
    subjectId: p.subjectId,
    topicId: p.topicId,
    term,
    definition: p.definition.trim(),
    example: p.example?.trim() || undefined,
    ...initialSm2(t),
    dateAdded: t,
  });
  await touchTopic(p.topicId);
  return true;
}

export async function reviewTerm(id: number, rating: Rating) {
  const term = await db.terms.get(id);
  if (!term) return;
  const next = reviewSm2(term, rating, today());
  await db.terms.update(id, next);
}
