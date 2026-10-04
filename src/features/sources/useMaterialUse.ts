import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

/** material id → how many tasks use it */
export function useMaterialUse(): Map<number, number> {
  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];
  const use = new Map<number, number>();
  for (const t of tasks) for (const id of t.materialIds ?? []) use.set(id, (use.get(id) ?? 0) + 1);
  return use;
}
