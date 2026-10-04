import { migrateColor } from '@/config';
import { db, setSetting, TABLE_NAMES } from './db';
import { today } from './utils';

const APP_ID = 'study-os';
const BACKUP_FORMAT = 1;

export async function exportAll(): Promise<string> {
  const tables: Record<string, unknown[]> = {};
  for (const name of TABLE_NAMES) tables[name] = await db.table(name).toArray();
  return JSON.stringify({ app: APP_ID, format: BACKUP_FORMAT, dbVersion: db.verno, exportedAt: new Date().toISOString(), tables });
}

export async function markBackedUp() {
  await setSetting('lastBackup', today());
}

/** Replaces ALL local data with the backup's contents. */
export async function importAll(json: string): Promise<number> {
  const data = JSON.parse(json);
  if (data?.app !== APP_ID || typeof data.tables !== 'object') throw new Error('Not a Study OS backup file');
  if (data.dbVersion > db.verno) throw new Error('Backup is from a newer version of the app — update first');
  let rows = 0;
  await db.transaction('rw', db.tables, async () => {
    for (const name of TABLE_NAMES) {
      const t = db.table(name);
      await t.clear();
      let items = Array.isArray(data.tables[name]) ? data.tables[name] : [];
      // Backups made before the v2 recolor still carry the old palette.
      if (name === 'subjects') items = items.map((s: { color: string }) => ({ ...s, color: migrateColor(s.color) }));
      if (items.length) await t.bulkAdd(items);
      rows += items.length;
    }
  });
  return rows;
}
