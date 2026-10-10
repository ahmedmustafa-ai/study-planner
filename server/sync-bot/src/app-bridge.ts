import { google } from 'googleapis';
import { getAuthenticatedClient } from './auth.js';

const SYNC_FILE_NAME = 'study_os_sync_data.json';

export interface TaskRecord {
  uuid: string;
  data: {
    title: string;
    dueDate?: string;
    status: 'todo' | 'doing' | 'done';
    priority?: 'low' | 'med' | 'high';
    source?: string;
    subjectId?: string | number;
    url?: string;
  };
  updatedAt: string;
  deleted?: boolean;
}

export interface AppSyncData {
  version: number;
  app: string;
  deviceId?: string;
  lastUpdated: string;
  records: {
    tasks?: TaskRecord[];
    subjects?: Array<{ uuid: string; data: { name: string; color?: string }; updatedAt: string }>;
    [key: string]: any;
  };
}

/**
 * Gets or creates the study_os_sync_data.json file in the user's private Google Drive appDataFolder.
 */
async function getOrCreateDriveSyncFile(drive: any): Promise<string> {
  // Search in appDataFolder
  const query = `name = '${SYNC_FILE_NAME}' and 'appDataFolder' in parents and trashed = false`;
  const listRes = await drive.files.list({
    spaces: 'appDataFolder',
    q: query,
    fields: 'files(id, name)',
  });

  const files = listRes.data.files;
  if (files && files.length > 0) {
    return files[0].id;
  }

  // Create new file in appDataFolder
  const createRes = await drive.files.create({
    requestBody: {
      name: SYNC_FILE_NAME,
      parents: ['appDataFolder'],
      mimeType: 'application/json',
    },
    fields: 'id',
  });

  return createRes.data.id;
}

/**
 * Downloads the shared Study OS sync data payload from Google Drive.
 */
export async function fetchAppSyncData(): Promise<AppSyncData | null> {
  try {
    const auth = await getAuthenticatedClient();
    const drive = google.drive({ version: 'v3', auth: auth as any });
    const fileId = await getOrCreateDriveSyncFile(drive);

    const res = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'json' }
    );

    return res.data as unknown as AppSyncData;
  } catch (err: any) {
    console.warn('Could not read from Google Drive appDataFolder:', err.message);
    return null;
  }
}

/**
 * Saves updated Study OS sync data payload back to Google Drive appDataFolder.
 */
export async function saveAppSyncData(payload: AppSyncData): Promise<boolean> {
  try {
    const auth = await getAuthenticatedClient();
    const drive = google.drive({ version: 'v3', auth: auth as any });
    const fileId = await getOrCreateDriveSyncFile(drive);

    payload.lastUpdated = new Date().toISOString();

    await drive.files.update({
      fileId,
      media: {
        mimeType: 'application/json',
        body: JSON.stringify(payload, null, 2),
      },
    });

    return true;
  } catch (err: any) {
    console.error('Failed to save updated sync data to Google Drive:', err.message);
    return false;
  }
}

/**
 * Appends a new task to the shared Study OS sync storage.
 */
export async function addTaskToSync(title: string, dueDate?: string): Promise<boolean> {
  let syncData = await fetchAppSyncData();
  if (!syncData) {
    syncData = {
      version: 1,
      app: 'study-os',
      lastUpdated: new Date().toISOString(),
      records: { tasks: [] },
    };
  }

  if (!syncData.records) syncData.records = {};
  if (!syncData.records.tasks) syncData.records.tasks = [];

  const now = new Date().toISOString();
  const newTask: TaskRecord = {
    uuid: crypto.randomUUID(),
    data: {
      title,
      dueDate: dueDate || undefined,
      status: 'todo',
      priority: 'med',
      source: 'manual',
    },
    updatedAt: now,
    deleted: false,
  };

  syncData.records.tasks.push(newTask);
  return saveAppSyncData(syncData);
}

/**
 * Marks a task as done by its uuid or title substring.
 */
export async function markTaskDoneInSync(identifier: string): Promise<string | null> {
  const syncData = await fetchAppSyncData();
  if (!syncData?.records?.tasks) return null;

  const task = syncData.records.tasks.find(
    (t) =>
      !t.deleted &&
      (t.uuid.startsWith(identifier) || t.data.title.toLowerCase().includes(identifier.toLowerCase()))
  );

  if (!task) return null;

  task.data.status = 'done';
  task.updatedAt = new Date().toISOString();
  await saveAppSyncData(syncData);
  return task.data.title;
}
