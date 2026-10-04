import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ExternalLink } from 'lucide-react';
import { db, setSetting } from '@/lib/db';
import { useSetting, useSubjects } from '@/lib/hooks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Empty, Field, PageHeader } from '@/components/common';
import { toast } from '@/components/toast';
import {
  announcementFromItem, autoMapCourses, buildAnnouncementItems, buildItems, buildMaterialItems, patchFromItem, patchFromMaterialItem, planAnnouncementImport, planImport, planMaterialImport, sourceFromItem, taskFromItem,
  type AnnouncementPlanRow, type CourseMap, type MaterialPlanRow, type PlanRow,
} from '@/lib/algorithms/classroom';
import { addDays, cn, formatDate, relativeDays, today } from '@/lib/utils';
import { autoClassroomSync } from './autoSync';
import { GoogleError, fetchClassroom, requestAccessToken, type ClassroomData } from './google';

type Range = '30' | '90' | 'all';

const LINKS = {
  project: 'https://console.cloud.google.com/projectcreate',
  api: 'https://console.cloud.google.com/apis/library/classroom.googleapis.com',
  consent: 'https://console.cloud.google.com/apis/credentials/consent',
  credentials: 'https://console.cloud.google.com/apis/credentials',
};

/** Read-only sync of your Google Classroom assignments into Study OS tasks. */
export function ClassroomPage() {
  const navigate = useNavigate();
  const subjects = useSubjects() ?? [];
  const savedClientId = useSetting<string>('google.clientId', '');
  const savedMap = useSetting<CourseMap>('classroom.courseMap', {});
  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];
  const sources = useLiveQuery(() => db.sources.toArray(), []) ?? [];
  const savedAnnouncements = useLiveQuery(() => db.announcements.orderBy('date').reverse().toArray(), []) ?? [];

  const [clientInput, setClientInput] = useState('');
  const [editingId, setEditingId] = useState(false);
  const [data, setData] = useState<ClassroomData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [map, setMap] = useState<CourseMap>({});
  const [includeDone, setIncludeDone] = useState(false);
  const [range, setRange] = useState<Range>('30');
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [materialExcluded, setMaterialExcluded] = useState<Set<string>>(new Set());
  const [announcementExcluded, setAnnouncementExcluded] = useState<Set<string>>(new Set());
  const lastAutoSync = useSetting<string | null>('classroom.lastAutoSync', null);
  const [syncingNow, setSyncingNow] = useState(false);

  useEffect(() => setClientInput(savedClientId), [savedClientId]);

  const items = useMemo(() => (data ? buildItems(data.courses, data.work, data.submissions) : []), [data]);
  const rows = useMemo(
    () => planImport(items, tasks, map, { includeDone, sinceDate: range === 'all' ? undefined : addDays(today(), -Number(range)) }),
    [items, tasks, map, includeDone, range],
  );
  const isChecked = (r: PlanRow) => r.action !== 'unchanged' && r.subjectId != null && !excluded.has(r.item.uid);
  const chosen = rows.filter(isChecked);
  const counts = { fresh: chosen.filter((r) => r.action === 'new').length, updates: chosen.filter((r) => r.action === 'update').length, same: rows.filter((r) => r.action === 'unchanged').length };
  const unmatched = data ? data.courses.filter((c) => map[c.id] === undefined && items.some((i) => i.courseId === c.id)) : [];

  const announcementItems = useMemo(() => (data ? buildAnnouncementItems(data.courses, data.announcements) : []), [data]);
  const announcementRows = useMemo(() => planAnnouncementImport(announcementItems, savedAnnouncements, map), [announcementItems, savedAnnouncements, map]);
  const isAnnouncementChecked = (r: AnnouncementPlanRow) => r.action !== 'unchanged' && r.subjectId != null && !announcementExcluded.has(r.item.uid);
  const chosenAnnouncements = announcementRows.filter(isAnnouncementChecked);
  const announcementCounts = { fresh: chosenAnnouncements.filter((r) => r.action === 'new').length, updates: chosenAnnouncements.filter((r) => r.action === 'update').length, same: announcementRows.filter((r) => r.action === 'unchanged').length };

  const materialItems = useMemo(() => (data ? buildMaterialItems(data.courses, data.materials) : []), [data]);
  const materialRows = useMemo(() => planMaterialImport(materialItems, sources, map), [materialItems, sources, map]);
  const isMaterialChecked = (r: MaterialPlanRow) => r.action !== 'unchanged' && r.subjectId != null && !materialExcluded.has(r.item.uid);
  const chosenMaterials = materialRows.filter(isMaterialChecked);
  const materialCounts = { fresh: chosenMaterials.filter((r) => r.action === 'new').length, updates: chosenMaterials.filter((r) => r.action === 'update').length, same: materialRows.filter((r) => r.action === 'unchanged').length };

  async function fetchNow() {
    setError(null);
    setBusy(true);
    try {
      const token = await requestAccessToken(savedClientId);
      const d = await fetchClassroom(token);
      setData(d);
      setMap(autoMapCourses(d.courses, subjects, savedMap));
      setExcluded(new Set());
      setMaterialExcluded(new Set());
      setAnnouncementExcluded(new Set());
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }

  async function doImport() {
    let added = 0;
    let updated = 0;
    await db.transaction('rw', db.tasks, async () => {
      for (const r of chosen) {
        if (r.existingTaskId != null) {
          const task = await db.tasks.get(r.existingTaskId);
          if (task) {
            await db.tasks.update(task.id!, patchFromItem(r.item, task));
            updated++;
          }
        } else if (r.subjectId != null) {
          await db.tasks.add(taskFromItem(r.item, r.subjectId));
          added++;
        }
      }
    });
    await setSetting('classroom.courseMap', Object.fromEntries(Object.entries(map).filter(([, v]) => v !== undefined)));
    toast(`Added ${added} task${added === 1 ? '' : 's'}${updated ? `, updated ${updated}` : ''}`);
    navigate('/tasks');
  }

  async function doImportMaterials() {
    let added = 0;
    let updated = 0;
    await db.transaction('rw', db.sources, async () => {
      for (const r of chosenMaterials) {
        if (r.existingSourceId != null) {
          const source = await db.sources.get(r.existingSourceId);
          if (source) {
            await db.sources.update(source.id!, patchFromMaterialItem(r.item, source));
            updated++;
          }
        } else if (r.subjectId != null) {
          await db.sources.add(sourceFromItem(r.item, r.subjectId) as never);
          added++;
        }
      }
    });
    await setSetting('classroom.courseMap', Object.fromEntries(Object.entries(map).filter(([, v]) => v !== undefined)));
    toast(`Added ${added} file${added === 1 ? '' : 's'}${updated ? `, updated ${updated}` : ''}`);
    navigate('/library');
  }

  async function doImportAnnouncements() {
    let added = 0;
    let updated = 0;
    await db.transaction('rw', db.announcements, async () => {
      for (const r of chosenAnnouncements) {
        if (r.existingId != null) {
          await db.announcements.update(r.existingId, announcementFromItem(r.item, r.subjectId!));
          updated++;
        } else if (r.subjectId != null) {
          await db.announcements.add(announcementFromItem(r.item, r.subjectId));
          added++;
        }
      }
    });
    await setSetting('classroom.courseMap', Object.fromEntries(Object.entries(map).filter(([, v]) => v !== undefined)));
    toast(`Saved ${added} announcement${added === 1 ? '' : 's'}${updated ? `, updated ${updated}` : ''}`);
  }

  const hasClientId = !!savedClientId && !editingId;

  async function syncNow() {
    setSyncingNow(true);
    try {
      const r = await autoClassroomSync();
      if (!r.ran) return toast("Couldn't sync silently — use \"Connect and fetch\" below to reconnect");
      const parts = [`${r.addedTasks} new task${r.addedTasks === 1 ? '' : 's'}`, `${r.addedMaterials} new file${r.addedMaterials === 1 ? '' : 's'}`, `${r.addedAnnouncements} new announcement${r.addedAnnouncements === 1 ? '' : 's'}`];
      if (r.updatedTasks || r.updatedMaterials) parts.push('some updated');
      toast(parts.join(', '));
    } finally {
      setSyncingNow(false);
    }
  }

  return (
    <>
      <PageHeader back title="Google Classroom" subtitle="Read-only. Study OS never changes anything in Classroom." />

      {hasClientId && (
        <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
          <p className="flex-1 text-sm text-muted-foreground">
            Syncs automatically, quietly, every time you open Study OS — new assignments, files and announcements just appear. Last automatic sync: {lastAutoSync ? relativeDays(lastAutoSync.slice(0, 10)) : 'not yet'}.
          </p>
          <Button size="sm" variant="outline" onClick={syncNow} disabled={syncingNow}>
            {syncingNow ? 'Syncing…' : 'Sync now'}
          </Button>
        </Card>
      )}

      {!hasClientId ? (
        <SetupCard
          value={clientInput}
          onChange={setClientInput}
          canCancel={!!savedClientId}
          onCancel={() => setEditingId(false)}
          onSave={async () => {
            await setSetting('google.clientId', clientInput.trim());
            setEditingId(false);
            toast('Client ID saved');
          }}
        />
      ) : (
        <Card className="mb-4 space-y-3 p-4">
          <p className="text-sm text-muted-foreground">
            Study OS asks Google for permission to <b>read</b> your classes, assignments and whether you turned them in. Nothing is stored on any server. You sign in each time (Google's own window).
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={fetchNow} disabled={busy}>
              {busy ? 'Talking to Google…' : data ? 'Fetch again' : 'Connect and fetch assignments'}
            </Button>
            <Button variant="ghost" onClick={() => setEditingId(true)}>
              Change Client ID
            </Button>
          </div>
        </Card>
      )}

      {error && <ErrorCard error={error} />}
      {data?.warnings.map((w) => (
        <p key={w} className="mb-2 text-xs text-tag-yellow-fg">
          {w}
        </p>
      ))}

      {data && (
        <>
          <Card className="mb-4 p-4">
            <div className="mb-2 text-sm font-medium">Your Classroom classes ({data.courses.length})</div>
            <p className="mb-3 text-xs text-muted-foreground">Match each class to one of your Study OS courses. Your choices are remembered for next time.</p>
            <ul className="space-y-2">
              {data.courses.map((c) => (
                <li key={c.id} className="grid grid-cols-[1fr_auto] items-center gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{c.name}</div>
                    {c.section && <div className="truncate text-xs text-muted-foreground">{c.section}</div>}
                  </div>
                  <Select
                    className="h-9 w-44 text-sm"
                    value={map[c.id] === null ? 'skip' : (map[c.id] ?? '')}
                    onChange={(e) => {
                      const v = e.target.value;
                      setMap({ ...map, [c.id]: v === 'skip' ? null : v === '' ? undefined : Number(v) });
                    }}
                  >
                    <option value="">Choose course…</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                    <option value="skip">Skip this class</option>
                  </Select>
                </li>
              ))}
            </ul>
            {unmatched.length > 0 && <p className="mt-3 text-xs text-tag-yellow-fg">Choose a course for {unmatched.map((c) => c.name).join(', ')} to import its assignments.</p>}
          </Card>

          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4" checked={includeDone} onChange={(e) => setIncludeDone(e.target.checked)} />
              Include work I already turned in
            </label>
            <label className="flex items-center gap-2">
              Due in the last
              <Select className="h-8 w-28 text-sm" value={range} onChange={(e) => setRange(e.target.value as Range)}>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="all">Any time</option>
              </Select>
            </label>
          </div>

          <div className="mb-2 text-sm font-medium">
            {counts.fresh} new{counts.updates ? `, ${counts.updates} to update` : ''}
            {counts.same ? <span className="font-normal text-muted-foreground"> · {counts.same} already up to date</span> : null}
          </div>
          {rows.length === 0 && <Empty>Nothing to import with these settings.</Empty>}
          <ul className="mb-4 divide-y rounded-lg border bg-card">
            {rows.map((r) => {
              const checked = isChecked(r);
              const disabled = r.action === 'unchanged' || r.subjectId == null;
              return (
                <li key={r.item.uid} className={cn('flex items-start gap-3 px-3 py-3', disabled && 'opacity-60')}>
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    disabled={disabled}
                    checked={checked}
                    onChange={(e) => setExcluded((prev) => { const n = new Set(prev); e.target.checked ? n.delete(r.item.uid) : n.add(r.item.uid); return n; })}
                    aria-label={`Import ${r.item.title}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{r.item.title}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span>{r.item.courseName}</span>
                      <span>{r.item.dueDate ? `Due ${formatDate(r.item.dueDate)}${r.item.dueTime ? ` ${r.item.dueTime}` : ''}` : 'No due date'}</span>
                      {r.item.late && <Badge variant="destructive">late</Badge>}
                      {r.item.done && <Badge variant="success">turned in</Badge>}
                      {r.action === 'new' && r.subjectId != null && <Badge variant="info">new</Badge>}
                      {r.action === 'update' && <Badge variant="warning">update: {r.changes.join(', ')}</Badge>}
                      {r.action === 'unchanged' && <Badge>up to date</Badge>}
                      {r.subjectId == null && <Badge variant="outline">choose a course above</Badge>}
                    </div>
                  </div>
                  {r.item.url && (
                    <a href={r.item.url} target="_blank" rel="noreferrer" aria-label="Open in Classroom" className="rounded p-1.5 hover:bg-accent">
                      <ExternalLink className="h-4 w-4 text-brand" />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
          <Button className="mb-8 w-full" disabled={chosen.length === 0} onClick={doImport}>
            Import {chosen.length} selected
          </Button>

          <div className="mb-2 text-sm font-medium">
            Posted files — {materialCounts.fresh} new{materialCounts.updates ? `, ${materialCounts.updates} to update` : ''}
            {materialCounts.same ? <span className="font-normal text-muted-foreground"> · {materialCounts.same} already up to date</span> : null}
          </div>
          <p className="mb-2 text-xs text-muted-foreground">Only the files your teachers attached to material posts, named by the file's own name. They go to your Library.</p>
          {materialRows.length === 0 && <Empty>No posted files, or nothing to import with these settings.</Empty>}
          {materialRows.length > 0 && (
            <ul className="mb-4 divide-y rounded-lg border bg-card">
              {materialRows.map((r) => {
                const checked = isMaterialChecked(r);
                const disabled = r.action === 'unchanged' || r.subjectId == null;
                return (
                  <li key={r.item.uid} className={cn('flex items-start gap-3 px-3 py-3', disabled && 'opacity-60')}>
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      disabled={disabled}
                      checked={checked}
                      onChange={(e) => setMaterialExcluded((prev) => { const n = new Set(prev); e.target.checked ? n.delete(r.item.uid) : n.add(r.item.uid); return n; })}
                      aria-label={`Import ${r.item.title}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{r.item.title}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span>{r.item.courseName}</span>
                        {r.action === 'new' && r.subjectId != null && <Badge variant="info">new</Badge>}
                        {r.action === 'update' && <Badge variant="warning">update: {r.changes.join(', ')}</Badge>}
                        {r.action === 'unchanged' && <Badge>up to date</Badge>}
                        {r.subjectId == null && <Badge variant="outline">choose a course above</Badge>}
                      </div>
                    </div>
                    <a href={r.item.url} target="_blank" rel="noreferrer" aria-label="Open" className="rounded p-1.5 hover:bg-accent">
                      <ExternalLink className="h-4 w-4 text-brand" />
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
          <Button className="mb-8 w-full" variant="outline" disabled={chosenMaterials.length === 0} onClick={doImportMaterials}>
            Import {chosenMaterials.length} selected
          </Button>

          <div className="mb-2 text-sm font-medium">
            Announcements — {announcementCounts.fresh} new{announcementCounts.updates ? `, ${announcementCounts.updates} to update` : ''}
            {announcementCounts.same ? <span className="font-normal text-muted-foreground"> · {announcementCounts.same} already saved</span> : null}
          </div>
          <p className="mb-2 text-xs text-muted-foreground">Kept separate from your Library — announcements are news from your teachers, not study material.</p>
          {announcementRows.length === 0 && <Empty>No announcements.</Empty>}
          {announcementRows.length > 0 && (
            <ul className="mb-4 divide-y rounded-lg border bg-card">
              {announcementRows.map((r) => {
                const checked = isAnnouncementChecked(r);
                const disabled = r.action === 'unchanged' || r.subjectId == null;
                return (
                  <li key={r.item.uid} className={cn('flex items-start gap-3 px-3 py-3', disabled && 'opacity-60')}>
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      disabled={disabled}
                      checked={checked}
                      onChange={(e) => setAnnouncementExcluded((prev) => { const n = new Set(prev); e.target.checked ? n.delete(r.item.uid) : n.add(r.item.uid); return n; })}
                      aria-label={`Save announcement from ${r.item.courseName}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 whitespace-pre-line text-sm">{r.item.text || 'Announcement with attachments'}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        <span>{r.item.courseName}</span>
                        <span>{formatDate(r.item.date)}</span>
                        {r.action === 'new' && r.subjectId != null && <Badge variant="info">new</Badge>}
                        {r.action === 'update' && <Badge variant="warning">edited</Badge>}
                        {r.action === 'unchanged' && <Badge>saved</Badge>}
                        {r.subjectId == null && <Badge variant="outline">choose a course above</Badge>}
                      </div>
                    </div>
                    {r.item.url && (
                      <a href={r.item.url} target="_blank" rel="noreferrer" aria-label="Open in Classroom" className="rounded p-1.5 hover:bg-accent">
                        <ExternalLink className="h-4 w-4 text-brand" />
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <Button className="mb-8 w-full" variant="outline" disabled={chosenAnnouncements.length === 0} onClick={doImportAnnouncements}>
            Save {chosenAnnouncements.length} selected
          </Button>
        </>
      )}

      {savedAnnouncements.length > 0 && (
        <>
          <div className="mb-2 text-sm font-medium">Saved announcements ({savedAnnouncements.length})</div>
          <ul className="mb-8 divide-y rounded-lg border bg-card">
            {savedAnnouncements.map((a) => (
              <li key={a.id} className="px-3 py-3">
                <details>
                  <summary className="cursor-pointer list-none">
                    <div className="line-clamp-2 whitespace-pre-line text-sm">{a.text || 'Announcement with attachments'}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span>{subjects.find((s) => s.id === a.subjectId)?.name ?? a.courseName}</span>
                      <span>{formatDate(a.date)}</span>
                    </div>
                  </summary>
                  <div className="mt-2 space-y-1.5 text-sm">
                    <p className="whitespace-pre-line">{a.text}</p>
                    {a.links.map((l) => (
                      <a key={l} href={l} target="_blank" rel="noreferrer" className="block truncate text-xs text-brand underline">{l}</a>
                    ))}
                    {a.url && (
                      <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-brand">
                        Open in Classroom <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function SetupCard({ value, onChange, onSave, onCancel, canCancel }: { value: string; onChange: (v: string) => void; onSave: () => void; onCancel: () => void; canCancel: boolean }) {
  return (
    <Card className="mb-4 space-y-4 p-4">
      <div>
        <div className="text-sm font-medium">One-time setup (about 15 minutes, free)</div>
        <p className="mt-1 text-sm text-muted-foreground">
          Google needs you to register this app once. It stays private to you. You need a Google account to do this (your personal one is fine).
        </p>
      </div>
      <ol className="list-decimal space-y-2.5 pl-5 text-sm">
        <li>
          <a className="text-brand underline" href={LINKS.project} target="_blank" rel="noreferrer">
            Create a Google Cloud project
          </a>{' '}
          (any name, e.g. "Study OS").
        </li>
        <li>
          <a className="text-brand underline" href={LINKS.api} target="_blank" rel="noreferrer">
            Enable the Google Classroom API
          </a>{' '}
          in that project (blue Enable button).
        </li>
        <li>
          <a className="text-brand underline" href={LINKS.consent} target="_blank" rel="noreferrer">
            OAuth consent screen
          </a>
          : choose <b>External</b>, fill in an app name and your email. Under <b>Test users</b> add the Google account you use for Classroom. Then open <b>Data access → Add or remove scopes</b>, search "classroom" and tick all four: courses (read-only), coursework (read-only), course work materials (read-only), announcements (read-only). Google blocks a scope silently if it isn't listed here, even though the API is enabled — this is the most common reason materials or assignments don't come through.
        </li>
        <li>
          <a className="text-brand underline" href={LINKS.credentials} target="_blank" rel="noreferrer">
            Credentials
          </a>{' '}
          → Create credentials → <b>OAuth client ID</b> → Web application. Under <b>Authorized JavaScript origins</b> add exactly:
          <div className="mt-1 rounded bg-muted px-2 py-1 font-mono text-xs">{location.origin}</div>
        </li>
        <li>Copy the <b>Client ID</b> (ends with .apps.googleusercontent.com) and paste it below. It is not a password.</li>
      </ol>
      <p className="text-xs text-muted-foreground">When you connect, Google will warn "unverified app". That is normal for your own app: choose Advanced → continue.</p>
      <Field label="Client ID">
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="1234567890-abc….apps.googleusercontent.com" autoComplete="off" spellCheck={false} />
      </Field>
      <div className="flex gap-2">
        <Button disabled={!/\.apps\.googleusercontent\.com$/.test(value.trim())} onClick={onSave}>
          Save
        </Button>
        {canCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </Card>
  );
}

function ErrorCard({ error }: { error: Error }) {
  const kind = error instanceof GoogleError ? error.kind : 'api';
  return (
    <Card className="mb-4 space-y-2 border-transparent bg-tag-red p-4 text-tag-red-fg">
      <div className="text-sm font-medium">{error.message}</div>
      {kind === 'blocked' && (
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>If you use a <b>school</b> Google account, your school admin may block outside apps. You can ask your IT teacher to allow it, or use a personal account.</li>
          <li>Check that the account is listed under <b>Test users</b> on the consent screen.</li>
          <li>Meanwhile you can still add Classroom tasks by hand or with the CSV import in Tasks.</li>
        </ul>
      )}
      {kind === 'setup' && <p className="text-sm">Open "Change Client ID" and re-check the setup steps. The address must match exactly.</p>}
    </Card>
  );
}
