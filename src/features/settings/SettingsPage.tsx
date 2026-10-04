import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { HardDriveDownload, HardDriveUpload } from 'lucide-react';
import { db, setSetting } from '@/lib/db';
import { useSetting } from '@/lib/hooks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, PageHeader, Section } from '@/components/common';
import { toast } from '@/components/toast';
import { DEFAULT_PROFILE } from '@/config';
import { exportAll, importAll, markBackedUp } from '@/lib/backup';
import { chooseBackupFolder, forgetBackupFolder, getBackupFolder, latestBackupInFolder, readBackupFile, reconfirmFolder, supportsFolderBackup } from '@/lib/autoBackup';
import { getSession, runSync, signInWithEmail, signOut, syncAvailable } from '@/lib/sync';
import { supabase } from '@/lib/supabase';
import { formatDate, relativeDays, shareOrDownload, today } from '@/lib/utils';
import type { Session } from '@supabase/supabase-js';

export function SettingsPage() {
  const profile = useSetting('profile', DEFAULT_PROFILE);
  const lastBackup = useSetting<string | null>('lastBackup', null);
  const year = useLiveQuery(async () => (await db.academicYears.toArray()).pop(), []);
  const [draft, setDraft] = useState(profile);
  useEffect(() => setDraft(profile), [profile]);

  async function backup() {
    const json = await exportAll();
    const how = await shareOrDownload(`study-os-backup-${today()}.json`, json, 'application/json');
    await markBackedUp();
    toast(how === 'shared' ? 'Backup shared — save it to Google Drive' : 'Backup downloaded');
  }

  async function restore(file: File) {
    if (!confirm('Restore will REPLACE everything in this app with the backup. Continue?')) return;
    try {
      const rows = await importAll(await file.text());
      toast(`Restored ${rows} records`);
    } catch (e) {
      toast((e as Error).message);
    }
  }

  return (
    <>
      <PageHeader back title="Settings" />

      <Section title="Account & sync">
        <AccountSync />
      </Section>

      <Section title="Data safety">
        <DataSafety />
      </Section>

      <Section title="Local backup (secondary — works even signed out)">
        <Card className="space-y-4 p-4">
          <p className="text-sm text-muted-foreground">
            Last backup: {lastBackup ? `${formatDate(lastBackup)} (${relativeDays(lastBackup)})` : 'never'}. Study OS always saves a dated backup once a day. <b>Link a folder below</b> and it also keeps a rolling backup updated roughly every minute while the app is open. If you're signed in above, this is a second safety net on top of sync — not the main one.
          </p>
          <AutoBackupFolder />
          <div className="flex flex-wrap gap-2 border-t pt-3">
            <Button onClick={backup}>
              <HardDriveDownload /> Back up now
            </Button>
            <Button variant="outline" asChild>
              <label className="cursor-pointer">
                <HardDriveUpload /> Restore from file…
                <input type="file" accept="application/json,.json" className="hidden" onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
              </label>
            </Button>
          </div>
        </Card>
      </Section>

      <Section title="Calendar sync">
        <Card className="space-y-3 p-4">
          <p className="text-sm text-muted-foreground">Bring in your school timetable and Classroom due dates from Google Calendar, or send your Study OS dates to your phone's calendar for reminders.</p>
          <Button variant="outline" asChild>
            <Link to="/calendar/import">Import / export (.ics)</Link>
          </Button>
        </Card>
      </Section>

      <Section title="About me (sent to every AI)">
        <Card className="space-y-3 p-4">
          <Textarea rows={7} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <div className="flex gap-2">
            <Button
              onClick={async () => {
                await setSetting('profile', draft.trim());
                toast('Profile saved — re-copy your Setup Kit instructions if you changed something important');
              }}
            >
              Save
            </Button>
            <Button variant="ghost" onClick={() => setDraft(DEFAULT_PROFILE)}>
              Reset to default
            </Button>
          </div>
        </Card>
      </Section>

      {year && (
        <Section title="Academic year">
          <Card className="p-4">
            <Field label="Label" hint="Next year: rename this, archive finished subjects, add new APs. Nothing needs a rebuild.">
              <Input defaultValue={year.label} onBlur={(e) => e.target.value.trim() && db.academicYears.update(year.id!, { label: e.target.value.trim() })} />
            </Field>
          </Card>
        </Section>
      )}

      <Section title="Install on your phone">
        <Card className="p-4 text-sm text-muted-foreground">
          In Chrome on Android: menu ⋮ → <b>Add to Home screen / Install app</b>. Then Study OS opens full-screen, works offline, and appears in the share menu of
          other apps.
        </Card>
      </Section>
    </>
  );
}

/** Sign in once per device (email magic link) to sync your data to your own free cloud database — the real source of truth, kept in sync across every device you sign into. */
function AccountSync() {
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    getSession().then((s) => {
      setSession(s);
      setLoaded(true);
    });
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!syncAvailable) {
    return (
      <Card className="p-4 text-sm text-muted-foreground">
        Sync isn't set up yet — it needs a free Supabase project connected via <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.local</code>. Until then, your data stays local-only (see Data safety and Local backup below).
      </Card>
    );
  }
  if (!loaded) return null;

  if (session) {
    return (
      <Card className="space-y-3 p-4">
        <p className="text-sm">
          Signed in as <b>{session.user.email}</b>. Your data syncs to your account automatically — sign into the same email on your phone to see the same data there.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={syncing}
            onClick={async () => {
              setSyncing(true);
              const r = await runSync();
              setSyncing(false);
              toast(r === 'ok' ? 'Synced' : r === 'offline' ? "Can't reach the server — you're offline" : 'Nothing to sync yet');
            }}
          >
            {syncing ? 'Syncing…' : 'Sync now'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => signOut()}>
            Sign out
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="space-y-3 p-4">
      <p className="text-sm text-muted-foreground">Sign in with your email to keep this data safe in the cloud and synced across your phone and computer. No password — you'll get a sign-in link by email.</p>
      {sentTo ? (
        <p className="text-sm">
          Check <b>{sentTo}</b> for a sign-in link, then open it on this device.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="max-w-xs" />
          <Button
            disabled={busy || !/^\S+@\S+\.\S+$/.test(email.trim())}
            onClick={async () => {
              setBusy(true);
              try {
                await signInWithEmail(email.trim());
                setSentTo(email.trim());
              } catch (e) {
                toast((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? 'Sending…' : 'Send sign-in link'}
          </Button>
        </div>
      )}
    </Card>
  );
}

/** Links a real folder on disk (e.g. a Google Drive or OneDrive desktop folder) so the daily auto-backup writes there directly, and offers recovery straight from it. */
function AutoBackupFolder() {
  const [folder, setFolder] = useState<{ name: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [handle, setHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const supported = supportsFolderBackup();

  useEffect(() => {
    getBackupFolder().then((f) => {
      setFolder(f ? { name: f.name } : null);
      setHandle(f?.handle ?? null);
      setLoaded(true);
    });
  }, []);

  if (!supported) {
    return <p className="text-xs text-muted-foreground">This browser can't link a folder directly, but the daily auto-backup still saves a dated file to your Downloads folder — move those into Drive or OneDrive when you can.</p>;
  }
  if (!loaded) return null;

  async function link() {
    try {
      const name = await chooseBackupFolder();
      const f = await getBackupFolder();
      setFolder({ name });
      setHandle(f?.handle ?? null);
      toast(`Linked "${name}" — today's backup will save there automatically`);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast((e as Error).message);
    }
  }

  async function restoreLatest() {
    if (!handle) return;
    const ok = await reconfirmFolder(handle);
    if (!ok) return toast('Permission for this folder was lost — link it again');
    const latest = await latestBackupInFolder(handle);
    if (!latest) return toast('No backup file found in this folder yet');
    if (!confirm(`Restore will REPLACE everything in this app with "${latest.name}". Continue?`)) return;
    try {
      const rows = await importAll(await readBackupFile(latest.fileHandle));
      toast(`Restored ${rows} records from "${latest.name}"`);
    } catch (e) {
      toast((e as Error).message);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <p className="text-sm">
        {folder ? (
          <>
            Auto-backup folder: <b>{folder.name}</b>
          </>
        ) : (
          'Link a folder and the daily auto-backup writes straight into it — no need to remember.'
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={link}>
          {folder ? 'Change folder' : 'Choose a folder'}
        </Button>
        {folder && (
          <>
            <Button size="sm" variant="outline" onClick={restoreLatest}>
              Restore latest from folder
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await forgetBackupFolder();
                setFolder(null);
                setHandle(null);
                toast('Folder unlinked');
              }}
            >
              Unlink
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/** Where the data lives, and whether the browser has promised not to clean it up. */
function DataSafety() {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [size, setSize] = useState('');

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
    navigator.storage
      ?.estimate?.()
      .then((e) => {
        if (e.usage == null) return;
        setSize(e.usage < 1024 * 1024 ? `${Math.max(1, Math.round(e.usage / 1024))} KB` : `${(e.usage / 1024 / 1024).toFixed(1)} MB`);
      })
      .catch(() => undefined);
  }, []);

  return (
    <Card className="space-y-3 p-4 text-sm">
      <p>
        Your data is stored <b>only in this browser</b>, at <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{location.host}</span>
        {size && <> ({size})</>}. Always open Study OS in the <b>same browser</b> at the <b>same address</b>. In a different browser or address the app looks empty, because your data is still in the first one.
      </p>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Protected from automatic cleanup:</span>
        {persisted === null ? <Badge>unknown</Badge> : persisted ? <Badge variant="success">yes</Badge> : <Badge variant="warning">not yet</Badge>}
        {persisted === false && (
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const ok = await navigator.storage.persist();
              setPersisted(ok);
              toast(ok ? 'Your browser agreed to protect the data' : 'The browser said no. Backups are your safety net.');
            }}
          >
            Ask browser
          </Button>
        )}
      </div>
      <p className="text-muted-foreground">Even when protected, clearing site data or resetting the browser deletes everything. Back up often, especially in the first two weeks.</p>
    </Card>
  );
}
