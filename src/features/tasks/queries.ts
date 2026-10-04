import { db, touchTopic } from '@/lib/db';
import type { Priority, TaskSource } from '@/lib/types';

export async function addTask(p: {
  subjectId: number;
  topicId?: number;
  title: string;
  dueDate?: string;
  priority?: Priority;
  source?: TaskSource;
  materialIds?: number[];
  links?: string[];
}) {
  const title = p.title.trim();
  if (!title) return;
  await db.tasks.add({
    subjectId: p.subjectId,
    topicId: p.topicId,
    title,
    dueDate: p.dueDate || undefined,
    status: 'todo',
    priority: p.priority ?? 'med',
    source: p.source ?? 'manual',
    materialIds: p.materialIds?.length ? p.materialIds : undefined,
    links: p.links?.length ? p.links : undefined,
  });
  await touchTopic(p.topicId);
}
