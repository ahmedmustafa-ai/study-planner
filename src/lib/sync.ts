// Push/pull orchestration: I/O glue around the pure logic in algorithms/sync.ts. Runs on boot (if
// signed in), on an interval, and on focus/online — never blocks the UI, which always reads and
// writes Dexie directly exactly as before.
import { db, getSetting, setSetting } from './db';
import { supabase, supabaseConfigured } from './supabase';
import { FK_FIELDS, SYNCED_TABLES, fkIdsToUuids, fkUuidsToIds, incomingWins, type Row, type SyncedTable } from './algorithms/sync';

export const syncAvailable = supabaseConfigured;

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signInWithEmail(email: string): Promise<void> {
  if (!supabase) throw new Error('Sync is not set up yet.');
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href } });
  if (error) throw error;
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  if (!supabase) throw new Error('Sync is not set up yet.');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUpWithPassword(email: string, password: string): Promise<void> {
  if (!supabase) throw new Error('Sync is not set up yet.');
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
}

export async function signInWithOAuth(provider: 'google' | 'github'): Promise<void> {
  if (!supabase) throw new Error('Sync is not set up yet.');
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: location.origin + location.pathname },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

function nowIso() {
  return new Date().toISOString();
}

/** All current rows of a table, each guaranteed to carry a uuid (stamped by the Dexie hooks). */
async function rowsOf(table: SyncedTable): Promise<(Row & { id: number; uuid: string; updatedAt: string })[]> {
  return (await db.table(table).toArray()) as (Row & { id: number; uuid: string; updatedAt: string })[];
}

async function idToUuidMap(table: SyncedTable): Promise<Map<number, string>> {
  return new Map((await rowsOf(table)).map((r) => [r.id, r.uuid]));
}

/** Pushes local changes for one table: anything newer than the last push, plus deletions detected by diffing the current uuid set against the last-known one. */
async function pushTable(table: SyncedTable, userId: string) {
  if (!supabase) return;
  const rows = await rowsOf(table);
  const currentUuids = new Set(rows.map((r) => r.uuid));
  const known = new Set(await getSetting<string[]>(`sync.known.${table}`, []));
  const lastPushed = await getSetting<string>(`sync.lastPushed.${table}`, '');

  const dirty = rows.filter((r) => r.updatedAt > lastPushed);
  const deletedUuids = [...known].filter((u) => !currentUuids.has(u));

  if (dirty.length || deletedUuids.length) {
    const fkCache = new Map<SyncedTable, Map<number, string>>();
    const refTables = new Set((FK_FIELDS[table] ?? []).map((f) => f.table));
    for (const t of refTables) fkCache.set(t, await idToUuidMap(t));
    const lookup = (t: SyncedTable, id: number) => fkCache.get(t)?.get(id);

    const upserts = dirty.map((r) => {
      const { id: _id, ...rest } = fkIdsToUuids(table, r, lookup);
      return { user_id: userId, table_name: table, uuid: r.uuid, data: rest, updated_at: r.updatedAt, deleted: false };
    });
    const deletes = deletedUuids.map((uuid) => ({ user_id: userId, table_name: table, uuid, data: {}, updated_at: nowIso(), deleted: true }));

    const { error } = await supabase.from('records').upsert([...upserts, ...deletes], { onConflict: 'user_id,table_name,uuid' });
    if (error) throw error;
  }

  await setSetting(`sync.known.${table}`, [...currentUuids]);
  await setSetting(`sync.lastPushed.${table}`, nowIso());
}

/** Pulls remote changes for every table, then resolves any FK fields that still point at a uuid (two-pass: a referenced row may arrive in the same batch, in either table order). */
async function pullAll(userId: string) {
  if (!supabase) return;
  const touched: { table: SyncedTable; id: number }[] = [];

  for (const table of SYNCED_TABLES) {
    const watermark = await getSetting<string>(`sync.lastPulled.${table}`, '1970-01-01T00:00:00.000Z');
    const { data: remoteRows, error } = await supabase.from('records').select('uuid,data,updated_at,deleted').eq('user_id', userId).eq('table_name', table).gt('updated_at', watermark);
    if (error) throw error;
    if (!remoteRows?.length) continue;

    let maxSeen = watermark;
    for (const r of remoteRows) {
      if (r.updated_at > maxSeen) maxSeen = r.updated_at;
      const existing = await db.table(table).where('uuid').equals(r.uuid).first();

      if (r.deleted) {
        if (existing) await db.table(table).delete(existing.id);
        continue;
      }
      if (existing && !incomingWins(existing.updatedAt, r.updated_at)) continue; // local is newer — keep it, it'll be pushed

      const merged = { ...(existing ?? {}), ...(r.data as Row), uuid: r.uuid, updatedAt: r.updated_at };
      if (existing) {
        await db.table(table).put({ ...merged, id: existing.id });
        touched.push({ table, id: existing.id });
      } else {
        delete (merged as Row).id;
        const newId = (await db.table(table).add(merged)) as number;
        touched.push({ table, id: newId });
      }
    }
    await setSetting(`sync.lastPulled.${table}`, maxSeen);
  }

  // Pass 2: resolve any FK fields on touched rows that are still raw uuids (their target may have
  // just arrived in this same pull, in any table order) back into this device's local ids.
  if (touched.length) {
    const uuidCache = new Map<SyncedTable, Map<string, number>>();
    for (const table of SYNCED_TABLES) {
      const m = new Map((await rowsOf(table)).map((r) => [r.uuid, r.id]));
      uuidCache.set(table, m);
    }
    const lookup = (t: SyncedTable, uuid: string) => uuidCache.get(t)?.get(uuid);

    for (const { table, id } of touched) {
      if (!FK_FIELDS[table]) continue;
      const row = await db.table(table).get(id);
      if (!row) continue;
      const resolved = fkUuidsToIds(table, row, lookup);
      const changedFields: Row = {};
      for (const f of FK_FIELDS[table]!) {
        if (JSON.stringify(resolved[f.field]) !== JSON.stringify(row[f.field])) changedFields[f.field] = resolved[f.field];
      }
      if (Object.keys(changedFields).length) await db.table(table).update(id, changedFields);
    }
  }
}

let syncing = false;

export async function runSync(): Promise<'ok' | 'skipped' | 'offline'> {
  if (!supabase || !navigator.onLine) return 'offline';
  const session = await getSession();
  if (!session) return 'skipped';
  if (syncing) return 'skipped';
  syncing = true;
  try {
    for (const table of SYNCED_TABLES) await pushTable(table, session.user.id);
    await pullAll(session.user.id);
    await setSetting('sync.lastRun', nowIso());
    return 'ok';
  } finally {
    syncing = false;
  }
}

/** Runs sync now, then on an interval and whenever the tab comes back online/focused. Returns a stop function. */
export function startSync(intervalMs = 30_000): () => void {
  if (!supabase) return () => undefined;
  void runSync();
  const timer = window.setInterval(() => void runSync(), intervalMs);
  const onFocusOrOnline = () => void runSync();
  window.addEventListener('online', onFocusOrOnline);
  window.addEventListener('focus', onFocusOrOnline);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener('online', onFocusOrOnline);
    window.removeEventListener('focus', onFocusOrOnline);
  };
}
