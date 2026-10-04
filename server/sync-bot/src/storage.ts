import fs from 'node:fs';
import { config } from './config.js';

export interface StoredTokens {
  access_token?: string | null;
  refresh_token?: string | null;
  scope?: string | null;
  token_type?: string | null;
  expiry_date?: number | null;
  id_token?: string | null;
}

export interface StoredItem {
  id: string;
  courseId: string;
  title: string;
  dueDate?: string;
  updatedAt?: string;
  materialsCount?: number;
}

export interface SyncState {
  lastSyncTime: string;
  knownAssignments: Record<string, StoredItem>; // key: `${courseId}:${workId}`
  knownAnnouncements: Record<string, string>;   // key: `${courseId}:${announcementId}`, value: updateTime
  knownMaterials: Record<string, string>;       // key: `${courseId}:${materialId}`, value: updateTime
}

export function loadTokens(): StoredTokens | null {
  if (fs.existsSync(config.tokensPath)) {
    try {
      const raw = fs.readFileSync(config.tokensPath, 'utf8');
      return JSON.parse(raw);
    } catch {
      // fallback below
    }
  }

  // Fallback to environment variable if running in CI/GitHub Actions
  if (config.googleRefreshToken) {
    return {
      refresh_token: config.googleRefreshToken,
      token_type: 'Bearer',
    };
  }

  return null;
}

export function saveTokens(tokens: StoredTokens): void {
  fs.writeFileSync(config.tokensPath, JSON.stringify(tokens, null, 2), { mode: 0o600 });
}

export function loadSyncState(): SyncState {
  if (!fs.existsSync(config.statePath)) {
    return {
      lastSyncTime: '',
      knownAssignments: {},
      knownAnnouncements: {},
      knownMaterials: {},
    };
  }
  try {
    const raw = fs.readFileSync(config.statePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {
      lastSyncTime: '',
      knownAssignments: {},
      knownAnnouncements: {},
      knownMaterials: {},
    };
  }
}

export function saveSyncState(state: SyncState): void {
  fs.writeFileSync(config.statePath, JSON.stringify(state, null, 2), 'utf8');
}
