import { db, touchTopic } from '@/lib/db';
import type { Source } from '@/lib/types';
import { today } from '@/lib/utils';
import { describeLink } from '@/lib/algorithms/links';

export function guessKind(url?: string): Source['kind'] {
  if (!url) return 'note';
  const info = describeLink(url);
  if (info.service !== 'other') return info.kind; // Google Drive / Docs / Classroom / NotebookLM / YouTube
  const u = url.toLowerCase();
  if (/vimeo\.com/.test(u)) return 'video';
  if (/\.pdf($|\?)/.test(u)) return 'pdf';
  if (/chatgpt\.com|chat\.openai\.com|claude\.ai|gemini\.google\.com/.test(u)) return 'ai-chat';
  return 'link';
}

/** Delete a material and disconnect it from any task that used it. */
export async function deleteSource(id: number) {
  await db.transaction('rw', db.sources, db.tasks, async () => {
    await db.sources.delete(id);
    for (const t of await db.tasks.filter((t) => !!t.materialIds?.includes(id)).toArray()) {
      const rest = t.materialIds!.filter((x) => x !== id);
      await db.tasks.update(t.id!, { materialIds: rest.length ? rest : undefined });
    }
  });
}

export async function saveSource(s: Omit<Source, 'id' | 'dateAdded'> & { id?: number; dateAdded?: string }) {
  const record = { ...s, title: s.title.trim() || (s.url ? describeLink(s.url).label : '') || 'Untitled', dateAdded: s.dateAdded ?? today() };
  if (s.id) await db.sources.put(record as Source);
  else await db.sources.add(record as Source);
  for (const t of s.topicIds) await touchTopic(t);
}
