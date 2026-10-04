import { db } from '@/lib/db';
import { MAX_NOW_TOPICS } from '@/config';
import type { Focus, Topic, TopicStatus } from '@/lib/types';
import { today } from '@/lib/utils';
import { afterRevisit, firstRevisit } from '@/lib/algorithms/revisit';

export async function setTopicStatus(topicId: number, status: TopicStatus) {
  const t = await db.topics.get(topicId);
  const patch: Partial<Topic> = { status, lastTouched: today() };
  if (status === "solid") {
    // Becoming solid starts the revisit schedule; staying solid keeps it.
    if (t?.status !== "solid" || !t.nextReview) Object.assign(patch, firstRevisit(today()));
  } else {
    patch.nextReview = undefined;
    patch.interval = undefined;
  }
  await db.topics.update(topicId, patch);
}

/** Result of a recall check on a solid topic. */
export async function completeRevisit(topicId: number, stillSolid: boolean) {
  const t = await db.topics.get(topicId);
  if (!t) return;
  await db.topics.update(topicId, { ...afterRevisit(t.interval, stillSolid, today()), lastTouched: today() });
}

/** Returns false (and changes nothing) if Now is already full. */
export async function setTopicFocus(topicId: number, focus: Focus): Promise<boolean> {
  if (focus === 'now') {
    const nowCount = await db.topics.where('focus').equals('now').count();
    const current = await db.topics.get(topicId);
    if (current?.focus !== 'now' && nowCount >= MAX_NOW_TOPICS) return false;
  }
  await db.topics.update(topicId, { focus });
  return true;
}

export async function addTopic(subjectId: number, unitId: number, name: string) {
  const n = name.trim();
  if (!n) return;
  const siblings = await db.topics.where('unitId').equals(unitId).toArray();
  const order = siblings.reduce((m, t) => Math.max(m, t.order), -1) + 1;
  await db.topics.add({ subjectId, unitId, name: n, order, status: 'not_started', focus: 'none' });
}

export async function renameTopic(topicId: number, name: string) {
  const n = name.trim();
  if (n) await db.topics.update(topicId, { name: n });
}

export async function renameUnit(unitId: number, name: string) {
  const n = name.trim();
  if (n) await db.units.update(unitId, { name: n });
}

/** Move a topic up (-1) or down (+1) inside its unit. Renumbers the whole unit so orders stay unique. */
export async function moveTopic(topicId: number, dir: -1 | 1) {
  const t = await db.topics.get(topicId);
  if (!t) return;
  const list = (await db.topics.where('unitId').equals(t.unitId).toArray()).sort((a, b) => a.order - b.order || a.id! - b.id!);
  const i = list.findIndex((x) => x.id === topicId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await db.transaction('rw', db.topics, async () => {
    for (const [idx, x] of list.entries()) await db.topics.update(x.id!, { order: idx });
  });
}

export async function moveUnit(unitId: number, dir: -1 | 1) {
  const u = await db.units.get(unitId);
  if (!u) return;
  const list = (await db.units.where('subjectId').equals(u.subjectId).toArray()).sort((a, b) => a.order - b.order || a.id! - b.id!);
  const i = list.findIndex((x) => x.id === unitId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await db.transaction('rw', db.units, async () => {
    for (const [idx, x] of list.entries()) await db.units.update(x.id!, { order: idx });
  });
}

/** Delete a topic; its notes, mistakes, terms, tasks and scores stay on the subject. */
export async function deleteTopic(topicId: number) {
  await db.transaction('rw', [db.topics, db.knowledgeCards, db.mistakes, db.terms, db.tasks, db.scores, db.aiSessions, db.sources], async () => {
    for (const t of [db.knowledgeCards, db.mistakes, db.terms, db.tasks, db.scores, db.aiSessions]) {
      await (t as typeof db.mistakes).where('topicId').equals(topicId).modify({ topicId: undefined });
    }
    await db.sources.where('topicIds').equals(topicId).modify((s) => {
      s.topicIds = s.topicIds.filter((x) => x !== topicId);
    });
    await db.topics.delete(topicId);
  });
}

export async function addUnit(subjectId: number, name: string) {
  const n = name.trim();
  if (!n) return;
  const siblings = await db.units.where('subjectId').equals(subjectId).toArray();
  const order = siblings.reduce((m, u) => Math.max(m, u.order), -1) + 1;
  await db.units.add({ subjectId, name: n, order });
}
