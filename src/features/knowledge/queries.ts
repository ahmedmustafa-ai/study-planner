import { db, touchTopic } from '@/lib/db';
import type { MistakeCause } from '@/lib/types';
import { today } from '@/lib/utils';

export async function addCard(p: { subjectId: number; topicId?: number; text: string; origin?: 'manual' | 'capture'; sourceId?: number }) {
  const text = p.text.trim();
  if (!text) return;
  await db.knowledgeCards.add({
    subjectId: p.subjectId,
    topicId: p.topicId,
    text,
    sourceId: p.sourceId,
    origin: p.origin ?? 'manual',
    createdAt: new Date().toISOString(),
    starred: false,
  });
  await touchTopic(p.topicId);
}

export async function addMistake(p: { subjectId: number; topicId?: number; text: string; cause: MistakeCause }) {
  const text = p.text.trim();
  if (!text) return;
  await db.mistakes.add({ subjectId: p.subjectId, topicId: p.topicId, text, cause: p.cause, date: today(), fixed: false });
  // An open mistake means the topic isn't solid any more.
  if (p.topicId) {
    const t = await db.topics.get(p.topicId);
    if (t && t.status === 'solid') await db.topics.update(p.topicId, { status: 'shaky' });
  }
  await touchTopic(p.topicId);
}
