import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { ShieldCheck, Cloud, LogIn, UserPlus, RefreshCw, LogOut } from 'lucide-react';
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
import { getSession, runSync, signInWithEmail, signInWithPassword, signUpWithPassword, signInWithOAuth, signOut, syncAvailable } from '@/lib/sync';
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

/** Authenticated Cloud Sync: secure per-user storage with Row-Level Security */
function AccountSync() {
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
      <Card className="space-y-3 p-4 text-sm">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <Cloud className="h-4 w-4 text-primary" />
          <span>Cloud Sync Configuration</span>
        </div>
        <p className="text-muted-foreground">
          To enable authenticated cloud sync, configure your free Supabase project keys in <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">.env.local</code> (or environment secrets):
        </p>
        <div className="rounded-md bg-muted/50 p-2 font-mono text-xs">
          VITE_SUPABASE_URL=https://your-project.supabase.co<br />
          VITE_SUPABASE_ANON_KEY=your-anon-public-key
        </div>
        <p className="text-xs text-muted-foreground">
          Your data is encrypted in transit and isolated to your user account via Postgres Row-Level Security (RLS).
        </p>
      </Card>
    );
  }
  if (!loaded) return null;

  if (session) {
    return (
      <Card className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            <div>
              <p className="text-sm font-medium">Authenticated & Encrypted</p>
              <p className="text-xs text-muted-foreground">{session.user.email}</p>
            </div>
          </div>
          <Badge variant="success">Online Sync Active</Badge>
        </div>

        <p className="text-xs text-muted-foreground">
          Your study records sync seamlessly in the background. Changes made on any device automatically propagate here.
        </p>

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
      </Card>
    );
  }

  async function handlePasswordAuth() {
    if (!email.trim() || !password) return;
    setBusy(true);
    try {
      if (isRegister) {
        await signUpWithPassword(email.trim(), password);
        toast('Account created! If confirmation is required, check your email.');
      } else {
        await signInWithPassword(email.trim(), password);
        toast('Signed in successfully!');
      }
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleOtpAuth() {
    if (!email.trim()) return;
    setBusy(true);
    try {
      await signInWithEmail(email.trim());
      setSentTo(email.trim());
      toast('Sign-in link dispatched to your email.');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4 p-4">
      <div>
        <h4 className="text-sm font-semibold">Sign in to your Study Account</h4>
        <p className="text-xs text-muted-foreground mt-0.5">
          Eliminate manual backups. Your tasks, flashcards, notes, and progress stay authenticated and continuously synchronized.
        </p>
      </div>

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
          Magic Link (Passwordless)
        </button>
      </div>

      {mode === 'password' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handlePasswordAuth();
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
              {busy ? (
                'Processing…'
              ) : isRegister ? (
                <>
                  <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Create Account
                </>
              ) : (
                <>
                  <LogIn className="mr-1.5 h-3.5 w-3.5" /> Sign In
                </>
              )}
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
              Check <b>{sentTo}</b> for a login link, then open it in this browser.
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
                onClick={handleOtpAuth}
              >
                {busy ? 'Sending…' : 'Send Link'}
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="border-t pt-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={() => signInWithOAuth('google').catch((e) => toast((e as Error).message))}
        >
          Continue with Google
        </Button>
      </div>
    </Card>
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
