// Pure sync logic: which tables sync, which of their fields are foreign keys to another synced
// table, and the last-write-wins decision. Framework-free and unit-tested — this is the one part
// of the sync design that must not have bugs, since a wrong FK translation silently scrambles
// which topic belongs to which subject, which task belongs to which topic, etc.
//
// Local Dexie ids are per-device (auto-increment), so they can't be sent across devices as-is.
// Every synced row also carries a stable `uuid`. Foreign key fields (e.g. Task.subjectId) are
// translated to the referenced row's `uuid` before sending, and back to this device's local id
// after receiving — see fkIdsToUuids / fkUuidsToIds below.

export const SYNCED_TABLES = [
  'academicYears', 'subjects', 'units', 'topics', 'sources', 'knowledgeCards', 'terms', 'mistakes',
  'tasks', 'milestones', 'scores', 'aiSessions', 'prompts', 'weeklyReviews', 'activities', 'events', 'studySessions',
] as const;

export type SyncedTable = (typeof SYNCED_TABLES)[number];

interface FkField {
  field: string;
  table: SyncedTable;
  array?: boolean;
}

/** One entry per foreign-key relationship declared in src/lib/types.ts. */
export const FK_FIELDS: Partial<Record<SyncedTable, FkField[]>> = {
  subjects: [{ field: 'academicYearId', table: 'academicYears' }],
  units: [{ field: 'subjectId', table: 'subjects' }],
  topics: [
    { field: 'subjectId', table: 'subjects' },
    { field: 'unitId', table: 'units' },
  ],
  sources: [
    { field: 'subjectId', table: 'subjects' },
    { field: 'topicIds', table: 'topics', array: true },
  ],
  knowledgeCards: [
    { field: 'subjectId', table: 'subjects' },
    { field: 'topicId', table: 'topics' },
    { field: 'sourceId', table: 'sources' },
  ],
  terms: [
    { field: 'subjectId', table: 'subjects' },
    { field: 'topicId', table: 'topics' },
  ],
  mistakes: [
    { field: 'subjectId', table: 'subjects' },
    { field: 'topicId', table: 'topics' },
  ],
  tasks: [
    { field: 'subjectId', table: 'subjects' },
    { field: 'topicId', table: 'topics' },
    { field: 'materialIds', table: 'sources', array: true },
  ],
  milestones: [{ field: 'subjectId', table: 'subjects' }],
  scores: [
    { field: 'subjectId', table: 'subjects' },
    { field: 'topicId', table: 'topics' },
    { field: 'milestoneId', table: 'milestones' },
  ],
  aiSessions: [
    { field: 'subjectId', table: 'subjects' },
    { field: 'topicId', table: 'topics' },
    { field: 'promptId', table: 'prompts' },
  ],
  weeklyReviews: [{ field: 'focusTopicIds', table: 'topics', array: true }],
  events: [{ field: 'subjectId', table: 'subjects' }],
  studySessions: [
    { field: 'subjectId', table: 'subjects' },
    { field: 'topicId', table: 'topics' },
  ],
};

export type Row = Record<string, unknown>;

/**
 * Replaces this row's local numeric FK ids with the referenced row's uuid, for sending out.
 * `lookup` resolves a table+localId to that row's uuid. A reference that can't be resolved
 * (shouldn't normally happen — every local FK points at a local row) is dropped rather than
 * sent as a dangling number.
 */
export function fkIdsToUuids(table: SyncedTable, row: Row, lookup: (table: SyncedTable, localId: number) => string | undefined): Row {
  const fields = FK_FIELDS[table];
  if (!fields) return row;
  const out = { ...row };
  for (const f of fields) {
    const v = out[f.field];
    if (v == null) continue;
    if (f.array) {
      out[f.field] = (v as number[]).map((id) => lookup(f.table, id)).filter((x): x is string => x != null);
    } else {
      const uuid = lookup(f.table, v as number);
      if (uuid != null) out[f.field] = uuid;
      else delete out[f.field];
    }
  }
  return out;
}

/**
 * Replaces this incoming row's uuid FK references with this device's local ids, once every uuid
 * involved has been given a local row. A uuid this device has never seen (e.g. the referenced row
 * hasn't synced yet) is dropped rather than left as a dangling uuid string in a numeric field.
 */
export function fkUuidsToIds(table: SyncedTable, row: Row, lookup: (table: SyncedTable, uuid: string) => number | undefined): Row {
  const fields = FK_FIELDS[table];
  if (!fields) return row;
  const out = { ...row };
  for (const f of fields) {
    const v = out[f.field];
    if (v == null) continue;
    if (f.array) {
      out[f.field] = (v as string[]).map((u) => lookup(f.table, u)).filter((x): x is number => x != null);
    } else {
      const id = lookup(f.table, v as string);
      if (id != null) out[f.field] = id;
      else delete out[f.field];
    }
  }
  return out;
}

/** Last-write-wins: should an incoming row (with this updatedAt) replace what's stored locally? */
export function incomingWins(localUpdatedAt: string | undefined, incomingUpdatedAt: string): boolean {
  return !localUpdatedAt || incomingUpdatedAt > localUpdatedAt;
}
