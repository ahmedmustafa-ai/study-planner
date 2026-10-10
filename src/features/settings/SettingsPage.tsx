import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { ShieldCheck, Cloud, RefreshCw, LogOut } from 'lucide-react';
import { db, getSetting, setSetting } from '@/lib/db';
import { useSetting } from '@/lib/hooks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Field, PageHeader, Section } from '@/components/common';
import { toast } from '@/components/toast';
import { DEFAULT_PROFILE } from '@/config';
import { getSession, runSync, signInWithEmail, signInWithPassword, signUpWithPassword, signOut, syncAvailable } from '@/lib/sync';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

export function SettingsPage() {
  const profile = useSetting('profile', DEFAULT_PROFILE);
  const year = useLiveQuery(async () => (await db.academicYears.toArray()).pop(), []);
  const [draft, setDraft] = useState(profile);
  useEffect(() => setDraft(profile), [profile]);

  return (
    <>
      <PageHeader back title="Settings" />

      <Section title="Authentication & Cloud Sync">
        <AccountSync />
      </Section>

      <Section title="Storage & Device Status">
        <DataSafety />
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
          In Chrome on Android: menu ⋮ → <b>Add to Home screen / Install app</b>. Then Study OS opens full-screen, works offline, and keeps in sync automatically.
        </Card>
      </Section>
    </>
  );
}

import {
  disconnectGoogle,
  getConnectedGoogleUser,
  getGoogleClientId,
  syncWithGoogleDrive,
  type GoogleUser,
} from '@/lib/gdrive';

/** Authenticated Cloud Sync: secure per-user storage via Google Drive AppData (or optional Supabase) */
function AccountSync() {
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(null);
  const [editingClientId, setEditingClientId] = useState(false);
  const [clientIdInput, setClientIdInput] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<'password' | 'otp'>('password');
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    void (async () => {
      const gUser = await getConnectedGoogleUser();
      const gId = await getGoogleClientId();
      const lastSync = await getSetting<string | null>('gdrive.lastSyncTime', null);
      setGoogleUser(gUser);
      setClientIdInput(gId);
      setLastSyncTime(lastSync);

      const s = await getSession();
      setSession(s);
      setLoaded(true);
    })();

    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  async function handleGoogleConnect() {
    setBusy(true);
    try {
      const res = await syncWithGoogleDrive({ silent: false });
      const user = await getConnectedGoogleUser();
      const last = await getSetting<string | null>('gdrive.lastSyncTime', null);
      setGoogleUser(user);
      setLastSyncTime(last);
      toast(res === 'ok' ? 'Connected & synced with Google Drive!' : 'Connected to Google account');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleSyncNow() {
    setSyncing(true);
    try {
      const res = await syncWithGoogleDrive({ silent: false });
      const last = await getSetting<string | null>('gdrive.lastSyncTime', null);
      setLastSyncTime(last);
      toast(res === 'ok' ? 'Synced with Google Drive!' : res === 'offline' ? "You're offline right now" : 'Everything is up to date');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  async function handleGoogleDisconnect() {
    await disconnectGoogle();
    setGoogleUser(null);
    setLastSyncTime(null);
    toast('Disconnected from Google Drive sync.');
  }

  async function handleSaveClientId() {
    const trimmed = clientIdInput.trim();
    await setSetting('google.clientId', trimmed);
    setEditingClientId(false);
    toast('Google Client ID updated');
  }

  if (!loaded) return null;

  return (
    <div className="space-y-4">
      {/* 1. Google Drive AppData Sync (Zero-cost, private, user-owned) */}
      <Card className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Cloud className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-2">
                Google Drive Cloud Sync
                {googleUser && <Badge variant="success">Active</Badge>}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Zero hosting cost. Syncs encrypted to your private Google Drive AppData space.
              </p>
            </div>
          </div>
        </div>

        {googleUser ? (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3 text-xs">
              <div className="flex items-center gap-2.5">
                {googleUser.picture ? (
                  <img src={googleUser.picture} alt="" className="h-7 w-7 rounded-full border" />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                    {googleUser.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-medium text-foreground">{googleUser.name}</p>
                  <p className="text-muted-foreground">{googleUser.email}</p>
                </div>
              </div>
              <div className="text-right text-[11px] text-muted-foreground">
                {lastSyncTime ? (
                  <span>Last sync: {new Date(lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                ) : (
                  <span>Sync ready</span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={syncing}
                onClick={handleGoogleSyncNow}
              >
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing Drive…' : 'Sync Drive Now'}
              </Button>
              <Button size="sm" variant="ghost" onClick={handleGoogleDisconnect}>
                <LogOut className="mr-1.5 h-3.5 w-3.5" /> Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Connect your Google Account to automatically sync study plans, assignments, and notes across all your devices without any server fees.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                disabled={busy}
                onClick={handleGoogleConnect}
                className="gap-2"
              >
                <ShieldCheck className="h-4 w-4" />
                {busy ? 'Connecting…' : 'Sign in with Google & Sync'}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => setEditingClientId(!editingClientId)}
              >
                {editingClientId ? 'Hide OAuth Settings' : 'OAuth Client Settings'}
              </Button>
            </div>

            {editingClientId && (
              <div className="rounded-md border p-3 space-y-2 bg-muted/20 text-xs">
                <p className="font-medium text-foreground">Google OAuth Client ID</p>
                <p className="text-muted-foreground">
                  Configured from Google Cloud Console (OAuth 2.0 Web Client ID):
                </p>
                <div className="flex gap-2">
                  <Input
                    value={clientIdInput}
                    onChange={(e) => setClientIdInput(e.target.value)}
                    placeholder="xxxxxxxxxxxx-xxxxxxxx.apps.googleusercontent.com"
                    className="font-mono text-xs"
                  />
                  <Button size="sm" onClick={handleSaveClientId}>
                    Save
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* 2. Optional Supabase Multi-user Postgres Sync (if configured) */}
      {syncAvailable && (
        <Card className="space-y-4 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="text-sm font-medium">Postgres Cloud Database</p>
                <p className="text-xs text-muted-foreground">{session?.user.email ?? 'Supabase integration ready'}</p>
              </div>
            </div>
            {session && <Badge variant="success">Online</Badge>}
          </div>

          {session ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                disabled={syncing}
                onClick={async () => {
                  setSyncing(true);
                  const r = await runSync();
                  setSyncing(false);
                  toast(r === 'ok' ? 'Synced successfully' : r === 'offline' ? "You're offline right now" : 'Everything is up to date');
                }}
              >
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing…' : 'Sync Now'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => signOut()}>
                <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign Out
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 border-b pb-2 text-xs">
                <button
                  type="button"
                  onClick={() => setMode('password')}
                  className={`pb-1 font-medium transition-colors ${mode === 'password' ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground'}`}
                >
                  Password
                </button>
                <button
                  type="button"
                  onClick={() => setMode('otp')}
                  className={`pb-1 font-medium transition-colors ${mode === 'otp' ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground'}`}
                >
                  Magic Link
                </button>
              </div>

              {mode === 'password' ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!email.trim() || !password) return;
                    setBusy(true);
                    (isRegister ? signUpWithPassword(email.trim(), password) : signInWithPassword(email.trim(), password))
                      .then(() => toast(isRegister ? 'Account created!' : 'Signed in!'))
                      .catch((err) => toast((err as Error).message))
                      .finally(() => setBusy(false));
                  }}
                  className="space-y-3"
                >
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    required
                    autoComplete="email"
                  />
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password (minimum 6 characters)"
                    required
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                  />
                  <div className="flex items-center justify-between pt-1">
                    <Button type="submit" disabled={busy || !email.trim() || password.length < 6}>
                      {busy ? 'Processing…' : isRegister ? 'Create Account' : 'Sign In'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsRegister(!isRegister)}
                    >
                      {isRegister ? 'Have an account? Sign in' : 'New here? Create account'}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-3">
                  {sentTo ? (
                    <div className="rounded-md bg-muted/60 p-3 text-xs">
                      Check <b>{sentTo}</b> for a login link.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="max-w-xs"
                      />
                      <Button
                        disabled={busy || !/^\S+@\S+\.\S+$/.test(email.trim())}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            await signInWithEmail(email.trim());
                            setSentTo(email.trim());
                            toast('Sign-in link dispatched.');
                          } catch (e) {
                            toast((e as Error).message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        {busy ? 'Sending…' : 'Send Link'}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>
      )}
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
        Your local offline cache is stored at <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{location.host}</span>
        {size && <> ({size})</>}. When signed into Cloud Sync, your changes sync automatically so you can safely switch devices or browsers at any time.
      </p>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Offline storage persistence:</span>
        {persisted === null ? <Badge>unknown</Badge> : persisted ? <Badge variant="success">protected</Badge> : <Badge variant="warning">standard</Badge>}
        {persisted === false && (
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              const ok = await navigator.storage.persist();
              setPersisted(ok);
              toast(ok ? 'Your browser agreed to protect local storage' : 'The browser kept standard storage rules.');
            }}
          >
            Persist storage
          </Button>
        )}
      </div>
    </Card>
  );
}
