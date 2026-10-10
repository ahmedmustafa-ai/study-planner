// Google Drive AppData Sync Engine & OAuth Client (Browser-native GIS)
// Uses Google Drive appDataFolder (hidden, dedicated to this app, inaccessible by other apps).
// Preserves full user data ownership and provides zero-server sync across user devices.

import { db, getSetting, setSetting } from './db';
import {
  FK_FIELDS,
  SYNCED_TABLES,
  fkIdsToUuids,
  fkUuidsToIds,
  incomingWins,
  type Row,
  type SyncedTable,
} from './algorithms/sync';

export const GDRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

const GSI_URL = 'https://accounts.google.com/gsi/client';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const USERINFO_API = 'https://www.googleapis.com/oauth2/v3/userinfo';
const SYNC_FILE_NAME = 'study_os_sync_data.json';

export interface GoogleUser {
  id: string;
  name: string;
  email: string;
  picture?: string;
}

export interface RemoteSyncPayload {
  version: number;
  app: string;
  deviceId: string;
  lastUpdated: string;
  records: Record<SyncedTable, Array<{
    uuid: string;
    data: Row;
    updatedAt: string;
    deleted?: boolean;
  }>>;
}

let activeToken: string | null = null;
let tokenExpiresAt = 0;

function nowIso(): string {
  return new Date().toISOString();
}

export function loadGsi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GSI_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Sign-In script')));
      return;
    }
    const s = document.createElement('script');
    s.src = GSI_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Google Sign-In script. Are you online?'));
    document.head.appendChild(s);
  });
}

/** Returns the configured Google Client ID from environment or DB settings. */
export async function getGoogleClientId(): Promise<string> {
  const envId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '';
  if (envId.trim()) return envId.trim();
  const dbId = await getSetting<string>('google.clientId', '');
  return dbId.trim();
}

/** Retrieves or creates a stable per-device identifier for diffing sync sources. */
export async function getDeviceId(): Promise<string> {
  let id = await getSetting<string>('sync.deviceId', '');
  if (!id) {
    id = crypto.randomUUID();
    await setSetting('sync.deviceId', id);
  }
  return id;
}

export function getCachedToken(): string | null {
  if (activeToken && Date.now() < tokenExpiresAt - 60_000) {
    return activeToken;
  }
  return null;
}

/** Requests an access token with Google Drive appDataFolder and Profile scopes. */
export async function requestGoogleDriveToken(opts: { silent?: boolean } = {}): Promise<string> {
  const valid = getCachedToken();
  if (valid) return valid;

  const clientId = await getGoogleClientId();
  if (!clientId) {
    throw new Error('Google Client ID is not configured. Add it in Settings.');
  }

  await loadGsi();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) throw new Error('Google Identity Services library failed to load.');

  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: GDRIVE_SCOPES,
      callback: (r) => {
        if (r.access_token) {
          activeToken = r.access_token;
          const expiresIn = r.expires_in ? Number(r.expires_in) : 3600;
          tokenExpiresAt = Date.now() + expiresIn * 1000;
          resolve(r.access_token);
          return;
        }
        if (r.error === 'access_denied') {
          reject(new Error('Google access denied or cancelled by user.'));
          return;
        }
        reject(new Error(r.error_description || r.error || 'Google authorization failed.'));
      },
      error_callback: (e) => {
        if (e.type === 'popup_closed') reject(new Error('The Google sign-in window was closed.'));
        else if (e.type === 'popup_failed_to_open') reject(new Error('Browser blocked pop-up window. Please allow popups.'));
        else reject(new Error(e.message || 'Google Sign-in error.'));
      },
    });

    client.requestAccessToken({ prompt: opts.silent ? 'none' : '' });
  });
}

/** Fetches Google User Profile information using the access token. */
export async function fetchGoogleUser(token: string): Promise<GoogleUser> {
  const res = await fetch(USERINFO_API, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch Google user profile.');
  const data = await res.json();
  const user: GoogleUser = {
    id: data.sub,
    name: data.name || data.email,
    email: data.email,
    picture: data.picture,
  };
  await setSetting('gdrive.user', user);
  return user;
}

export async function getConnectedGoogleUser(): Promise<GoogleUser | null> {
  return getSetting<GoogleUser | null>('gdrive.user', null);
}

export async function disconnectGoogle(): Promise<void> {
  if (activeToken) {
    try {
      if (typeof google !== 'undefined' && google.accounts?.oauth2?.revoke) {
        google.accounts.oauth2.revoke(activeToken, () => {});
      }
    } catch {
      // Ignore revoke errors
    }
  }
  activeToken = null;
  tokenExpiresAt = 0;
  await setSetting('gdrive.user', null);
  await setSetting('gdrive.fileId', null);
  await setSetting('gdrive.lastSyncTime', null);
}

/** Finds or creates the dedicated study planner file in the user's private Google Drive appDataFolder. */
async function getOrCreateSyncFileId(token: string): Promise<string> {
  const cachedFileId = await getSetting<string | null>('gdrive.fileId', null);
  if (cachedFileId) {
    // Verify file still exists
    try {
      const checkRes = await fetch(`${DRIVE_API}/files/${cachedFileId}?fields=id,trashed`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (checkRes.ok) {
        const fileInfo = await checkRes.json();
        if (!fileInfo.trashed) return cachedFileId;
      }
    } catch {
      // re-query below
    }
  }

  // Search in appDataFolder
  const query = encodeURIComponent(`name = '${SYNC_FILE_NAME}' and 'appDataFolder' in parents and trashed = false`);
  const listRes = await fetch(`${DRIVE_API}/files?spaces=appDataFolder&q=${query}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!listRes.ok) throw new Error(`Failed to list files in Google Drive: ${listRes.statusText}`);
  const listData = await listRes.json();

  if (listData.files && listData.files.length > 0) {
    const fileId = listData.files[0].id as string;
    await setSetting('gdrive.fileId', fileId);
    return fileId;
  }

  // Create file in appDataFolder
  const metadata = {
    name: SYNC_FILE_NAME,
    parents: ['appDataFolder'],
    mimeType: 'application/json',
  };

  const createRes = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!createRes.ok) throw new Error('Failed to create sync container in Google Drive appDataFolder.');
  const created = await createRes.json();
  await setSetting('gdrive.fileId', created.id);
  return created.id as string;
}

/** Reads the current sync payload from Google Drive. */
export async function downloadSyncData(token: string, fileId: string): Promise<RemoteSyncPayload | null> {
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    // Empty newly created file has 0 content or 204
    if (res.status === 204 || !text.trim()) return null;
    throw new Error(`Failed to download data from Google Drive (${res.status}): ${text}`);
  }
  const text = await res.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as RemoteSyncPayload;
  } catch {
    return null;
  }
}

/** Uploads updated sync payload to Google Drive appDataFolder. */
export async function uploadSyncData(token: string, fileId: string, payload: RemoteSyncPayload): Promise<void> {
  const content = JSON.stringify(payload);
  const res = await fetch(`${DRIVE_UPLOAD_API}/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: content,
  });
  if (!res.ok) {
    throw new Error(`Failed to upload sync data to Google Drive: ${res.statusText}`);
  }
}

/** Helper: returns all current rows of a Dexie table */
async function rowsOf(table: SyncedTable): Promise<(Row & { id: number; uuid: string; updatedAt: string })[]> {
  return (await db.table(table).toArray()) as (Row & { id: number; uuid: string; updatedAt: string })[];
}

async function idToUuidMap(table: SyncedTable): Promise<Map<number, string>> {
  return new Map((await rowsOf(table)).map((r) => [r.id, r.uuid]));
}

let syncInProgress = false;

/**
 * Executes a full 2-way sync with Google Drive appDataFolder:
 * 1. Downloads remote state from user's Drive.
 * 2. Merges remote updates into local Dexie (last-write-wins + resolves FKs).
 * 3. Incorporates local changes and saves back to Google Drive.
 */
export async function syncWithGoogleDrive(opts: { silent?: boolean } = {}): Promise<'ok' | 'skipped' | 'offline'> {
  if (!navigator.onLine) return 'offline';
  const user = await getConnectedGoogleUser();
  if (!user && opts.silent) return 'skipped';

  if (syncInProgress) return 'skipped';
  syncInProgress = true;

  try {
    const token = await requestGoogleDriveToken({ silent: opts.silent });
    if (!token) return 'skipped';

    // Refresh profile in background
    fetchGoogleUser(token).catch(() => {});

    const fileId = await getOrCreateSyncFileId(token);
    const remote = await downloadSyncData(token, fileId);
    const deviceId = await getDeviceId();

    // Prepare structure
    const mergedRecords: RemoteSyncPayload['records'] = (remote?.records ?? {}) as RemoteSyncPayload['records'];
    for (const t of SYNCED_TABLES) {
      if (!mergedRecords[t]) mergedRecords[t] = [];
    }

    const touched: { table: SyncedTable; id: number }[] = [];

    // Phase 1: Ingest remote records into local Dexie
    for (const table of SYNCED_TABLES) {
      const remoteList = mergedRecords[table] ?? [];
      for (const r of remoteList) {
        const existing = await db.table(table).where('uuid').equals(r.uuid).first();

        if (r.deleted) {
          if (existing) await db.table(table).delete(existing.id);
          continue;
        }

        if (existing && !incomingWins(existing.updatedAt, r.updatedAt)) {
          // Local is newer: will be pushed back to remote
          continue;
        }

        const merged = { ...(existing ?? {}), ...(r.data as Row), uuid: r.uuid, updatedAt: r.updatedAt };
        if (existing) {
          await db.table(table).put({ ...merged, id: existing.id });
          touched.push({ table, id: existing.id });
        } else {
          delete (merged as Row).id;
          const newId = (await db.table(table).add(merged)) as number;
          touched.push({ table, id: newId });
        }
      }
    }

    // Phase 2: Resolve FK references on updated records
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
          if (JSON.stringify(resolved[f.field]) !== JSON.stringify(row[f.field])) {
            changedFields[f.field] = resolved[f.field];
          }
        }
        if (Object.keys(changedFields).length) {
          await db.table(table).update(id, changedFields);
        }
      }
    }

    // Phase 3: Export local state to Remote records map
    for (const table of SYNCED_TABLES) {
      const localRows = await rowsOf(table);
      const currentLocalUuids = new Set(localRows.map((r) => r.uuid));
      const known = new Set(await getSetting<string[]>(`sync.known.${table}`, []));

      const fkCache = new Map<SyncedTable, Map<number, string>>();
      const refTables = new Set((FK_FIELDS[table] ?? []).map((f) => f.table));
      for (const t of refTables) fkCache.set(t, await idToUuidMap(t));
      const lookup = (t: SyncedTable, id: number) => fkCache.get(t)?.get(id);

      // Existing remote map for quick indexing
      const remoteMap = new Map((mergedRecords[table] ?? []).map((r) => [r.uuid, r]));

      // Add or update active local rows
      for (const localRow of localRows) {
        const existingRemote = remoteMap.get(localRow.uuid);
        if (!existingRemote || incomingWins(existingRemote.updatedAt, localRow.updatedAt)) {
          const { id: _id, ...cleanData } = fkIdsToUuids(table, localRow, lookup);
          remoteMap.set(localRow.uuid, {
            uuid: localRow.uuid,
            data: cleanData,
            updatedAt: localRow.updatedAt,
            deleted: false,
          });
        }
      }

      // Mark deletions
      for (const u of known) {
        if (!currentLocalUuids.has(u)) {
          const item = remoteMap.get(u);
          if (item) {
            item.deleted = true;
            item.updatedAt = nowIso();
          } else {
            remoteMap.set(u, {
              uuid: u,
              data: {},
              updatedAt: nowIso(),
              deleted: true,
            });
          }
        }
      }

      mergedRecords[table] = Array.from(remoteMap.values());
      await setSetting(`sync.known.${table}`, [...currentLocalUuids]);
    }

    // Phase 4: Save consolidated state back to Google Drive
    const now = nowIso();
    const payload: RemoteSyncPayload = {
      version: 1,
      app: 'study-os',
      deviceId,
      lastUpdated: now,
      records: mergedRecords,
    };

    await uploadSyncData(token, fileId, payload);
    await setSetting('gdrive.lastSyncTime', now);
    return 'ok';
  } finally {
    syncInProgress = false;
  }
}
