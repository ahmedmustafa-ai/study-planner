import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Subject, Topic, Unit } from './types';

export function useSubjects(includeArchived = false): Subject[] | undefined {
  return useLiveQuery(async () => {
    const all = (await db.subjects.toArray()).sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.id! - b.id!);
    return includeArchived ? all : all.filter((s) => !s.archived);
  }, [includeArchived]);
}

export function useSubjectMap(): Map<number, Subject> {
  const subjects = useLiveQuery(() => db.subjects.toArray(), []) ?? [];
  return new Map(subjects.map((s) => [s.id!, s]));
}

export function useTopicMap(): Map<number, Topic> {
  const topics = useLiveQuery(() => db.topics.toArray(), []) ?? [];
  return new Map(topics.map((t) => [t.id!, t]));
}

export function useUnitMap(): Map<number, Unit> {
  const units = useLiveQuery(() => db.units.toArray(), []) ?? [];
  return new Map(units.map((u) => [u.id!, u]));
}

export function useSetting<T>(key: string, fallback: T): T {
  const row = useLiveQuery(() => db.settings.get(key), [key]);
  return row === undefined ? fallback : (row.value as T);
}
