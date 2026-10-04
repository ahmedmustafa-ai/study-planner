// Automatic backups: saved once a day, no need to remember. Prefers writing straight into a
// folder you choose (e.g. your Google Drive or OneDrive desktop folder) via the File System
// Access API; falls back to a plain download when the browser doesn't support that, or the
// folder access was lost — that fallback needs no permission, so it always works.
import { getSetting, setSetting } from './db';
import { exportAll, markBackedUp } from './backup';
import { daysBetween, today } from './utils';

type DirHandle = FileSystemDirectoryHandle;
type FileHandle = FileSystemFileHandle;

const HANDLE_KEY = 'backupFolderHandle';
const NAME_KEY = 'backupFolderName';
const BACKUP_RE = /^study-os-backup-(\d{4}-\d{2}-\d{2})\.json$/;

export function supportsFolderBackup(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export async function getBackupFolder(): Promise<{ handle: DirHandle; name: string } | null> {
  const handle = await getSetting<DirHandle | null>(HANDLE_KEY, null);
  const name = await getSetting<string>(NAME_KEY, '');
  return handle ? { handle, name } : null;
}

/** Opens the browser's folder picker. Must be called from a click. */
export async function chooseBackupFolder(): Promise<string> {
  const w = window as Window & { showDirectoryPicker?: (o?: { id?: string; mode?: string }) => Promise<DirHandle> };
  if (!w.showDirectoryPicker) throw new Error("This browser can't link a folder directly.");
  const handle = await w.showDirectoryPicker({ id: 'study-os-backup', mode: 'readwrite' });
  await setSetting(HANDLE_KEY, handle);
  await setSetting(NAME_KEY, handle.name);
  return handle.name;
}

export async function forgetBackupFolder() {
  await setSetting(HANDLE_KEY, null);
  await setSetting(NAME_KEY, '');
}

interface Permissioned {
  queryPermission?: (o: { mode: string }) => Promise<PermissionState>;
  requestPermission?: (o: { mode: string }) => Promise<PermissionState>;
}

async function hasPermission(handle: DirHandle, request: boolean): Promise<boolean> {
  const h = handle as DirHandle & Permissioned;
  const opts = { mode: 'readwrite' };
  if ((await h.queryPermission?.(opts)) === 'granted') return true;
  if (!request) return false;
  return (await h.requestPermission?.(opts)) === 'granted';
}

/** Re-asks for permission on a previously chosen folder. Must be called from a click. */
export const reconfirmFolder = (handle: DirHandle) => hasPermission(handle, true);

async function writeToFolder(handle: DirHandle, filename: string, json: string) {
  const fileHandle = await handle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(json);
  await writable.close();
}

function downloadSilently(filename: string, json: string) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Writes the rolling "latest" snapshot into the linked folder right now, if one is linked and still permitted. A no-op otherwise — the once-a-day dated backup is the fallback for that case. */
async function writeLiveSnapshot() {
  try {
    const folder = await getBackupFolder();
    if (!folder || !(await hasPermission(folder.handle, false))) return;
    await writeToFolder(folder.handle, 'study-os-latest.json', await exportAll());
  } catch {
    // best effort — the daily dated backup still runs regardless
  }
}

/**
 * Keeps a near-live backup going while the app stays open: writes the rolling snapshot on an
 * interval, and again immediately whenever the tab is hidden or the page is about to unload —
 * the moments right before you'd otherwise lose whatever you just typed. Only meaningful once a
 * folder is linked (Settings → Backup); without one this is a no-op and you're on the once-a-day
 * download fallback from runAutoBackup.
 */
export function startLiveBackup(intervalMs = 60_000): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const timer = window.setInterval(writeLiveSnapshot, intervalMs);
  const onHide = () => {
    if (document.visibilityState === 'hidden') void writeLiveSnapshot();
  };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', writeLiveSnapshot);
  void writeLiveSnapshot();
  return () => {
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', writeLiveSnapshot);
  };
}

export type AutoBackupResult = { ran: false } | { ran: true; how: 'folder' | 'download'; folderName?: string };

/** Once a day: writes a dated backup into the linked folder, or downloads one if no folder is linked (or access to it was lost). Never asks for permission itself — a lost folder link just falls back to downloading until you re-link it in Settings. */
export async function runAutoBackup(): Promise<AutoBackupResult> {
  const last = await getSetting<string | null>('lastAutoBackup', null);
  if (last === today()) return { ran: false };
  const json = await exportAll();
  const filename = `study-os-backup-${today()}.json`;
  const folder = await getBackupFolder();
  if (folder && (await hasPermission(folder.handle, false))) {
    await writeToFolder(folder.handle, filename, json);
    await setSetting('lastAutoBackup', today());
    await markBackedUp();
    return { ran: true, how: 'folder', folderName: folder.name };
  }
  downloadSilently(filename, json);
  await setSetting('lastAutoBackup', today());
  await markBackedUp();
  return { ran: true, how: 'download' };
}

/** The most recent dated backup sitting in the linked folder, if any — so you can restore even if this device's database was wiped. */
export async function latestBackupInFolder(handle: DirHandle): Promise<{ name: string; date: string; fileHandle: FileHandle } | null> {
  const dir = handle as DirHandle & { values?: () => AsyncIterable<FileSystemHandle> };
  if (!dir.values) return null;
  let best: { name: string; date: string; fileHandle: FileHandle } | null = null;
  for await (const entry of dir.values()) {
    if (entry.kind !== 'file') continue;
    const m = BACKUP_RE.exec(entry.name);
    if (!m) continue;
    if (!best || m[1] > best.date) best = { name: entry.name, date: m[1], fileHandle: entry as FileHandle };
  }
  return best;
}

export async function readBackupFile(fileHandle: FileHandle): Promise<string> {
  const file = await fileHandle.getFile();
  return file.text();
}

/**
 * True (at most once a day, and never before day 3) when no backup folder is linked yet — the
 * only backup path that survives an IndexedDB wipe. Callers should nudge toward Settings →
 * Backup when this returns true.
 */
export async function maybeNudgeFolderLink(): Promise<boolean> {
  if (!supportsFolderBackup()) return false;
  if (await getBackupFolder()) return false;
  const firstRun = await getSetting<string | null>('firstRun', null);
  if (!firstRun || daysBetween(firstRun, today()) < 3) return false;
  const last = await getSetting<string | null>('lastFolderNudge', null);
  if (last === today()) return false;
  await setSetting('lastFolderNudge', today());
  return true;
}
