import { useEffect, useState } from 'react';
import { AlertTriangle, HardDriveUpload } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { ensureSeeded, confirmSeededLocally } from '@/lib/seed';
import { importAll } from '@/lib/backup';
import { getBackupFolder, latestBackupInFolder, readBackupFile, reconfirmFolder } from '@/lib/autoBackup';

/**
 * Shown instead of silently reseeding when this browser was set up before but its IndexedDB now
 * looks empty (storage eviction, "clear site data," a different browser/profile). Silently
 * refilling the original demo data here would look exactly like "my edits disappeared," so this
 * blocks until the user picks a recovery path or explicitly confirms a fresh start.
 */
export function DataRecoveryGate() {
  const [busy, setBusy] = useState(false);
  const [folder, setFolder] = useState<{ name: string } | null>(null);
  const [checkedFolder, setCheckedFolder] = useState(false);

  useEffect(() => {
    getBackupFolder().then((f) => {
      setFolder(f ? { name: f.name } : null);
      setCheckedFolder(true);
    });
  }, []);

  async function restoreFromFolder() {
    setBusy(true);
    try {
      const linked = await getBackupFolder();
      if (!linked) throw new Error('No folder linked.');
      const ok = await reconfirmFolder(linked.handle);
      if (!ok) throw new Error('Permission for the linked folder was lost — use "Restore from file" instead.');
      const latest = await latestBackupInFolder(linked.handle);
      if (!latest) throw new Error('No backup file found in that folder.');
      await importAll(await readBackupFile(latest.fileHandle));
      confirmSeededLocally();
      window.location.reload();
    } catch (e) {
      alert((e as Error).message);
      setBusy(false);
    }
  }

  async function restoreFromFile(file: File) {
    setBusy(true);
    try {
      await importAll(await file.text());
      confirmSeededLocally();
      window.location.reload();
    } catch (e) {
      alert((e as Error).message);
      setBusy(false);
    }
  }

  async function startFresh() {
    if (!confirm("This sets up Study OS as if this were a brand-new browser, with the starter subjects and tasks. Only do this if you're sure there's nothing to recover. Continue?")) return;
    setBusy(true);
    try {
      await ensureSeeded();
      window.location.reload();
    } catch (e) {
      alert((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md space-y-4 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-tag-red" />
          <div>
            <h1 className="text-lg font-semibold">Your data looks empty</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Study OS was set up in this browser before, but it can't find any of your subjects, tasks or notes now — most likely this browser's storage was cleared or reset. Restore from a backup below before doing anything else.
            </p>
          </div>
        </div>

        <div className="space-y-2 border-t pt-3">
          {checkedFolder && folder && (
            <Button className="w-full" disabled={busy} onClick={restoreFromFolder}>
              <HardDriveUpload /> Restore latest from &quot;{folder.name}&quot;
            </Button>
          )}
          <Button variant="outline" className="w-full" asChild>
            <label className="cursor-pointer">
              <HardDriveUpload /> Restore from a backup file…
              <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && restoreFromFile(e.target.files[0])} />
            </label>
          </Button>
        </div>

        <div className="border-t pt-3">
          <Button variant="ghost" size="sm" className="w-full text-muted-foreground" disabled={busy} onClick={startFresh}>
            I know — this is a new browser/profile. Start fresh instead.
          </Button>
        </div>
      </Card>
    </div>
  );
}
