import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useSubjects } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Empty, Field, PageHeader } from '@/components/common';
import { toast } from '@/components/toast';
import { matchCourse, parseIcs, suggestKind, type ImportKind, type ParsedIcsEvent } from '@/lib/algorithms/ics';
import { cn, formatDate, today } from '@/lib/utils';
import { exportCalendarIcs } from './ics';

interface Row {
  ev: ParsedIcsEvent;
  include: boolean;
  kind: ImportKind;
  subjectId: number | '';
  note?: string; // why it is unchecked by default
}

const KINDS: { value: ImportKind; label: string }[] = [
  { value: 'class', label: 'Class' },
  { value: 'event', label: 'Event' },
  { value: 'exam', label: 'Exam' },
  { value: 'task', label: 'Task' },
];

/** Bring in a Google Calendar / school timetable / Classroom .ics file, with a preview. */
export function IcsImportPage() {
  const navigate = useNavigate();
  const subjects = useSubjects() ?? [];
  const existing = useLiveQuery(async () => ({ events: await db.events.toArray(), tasks: await db.tasks.toArray() }), []);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [taskCourse, setTaskCourse] = useState<number | ''>('');
  const t0 = today();
  const fallbackCourse = taskCourse || subjects[0]?.id;

  async function onFile(file: File) {
    setFileName(file.name);
    const parsed = parseIcs(await file.text());
    const uids = new Set((existing?.events ?? []).map((e) => e.uid).filter(Boolean));
    const taskKeys = new Set((existing?.tasks ?? []).map((t) => `${t.title.toLowerCase()}|${t.dueDate}`));
    setRows(
      parsed.map((ev) => {
        const kind = suggestKind(ev);
        const subjectId = matchCourse(`${ev.title} ${ev.note ?? ''} ${ev.location ?? ''}`, subjects) ?? '';
        let note: string | undefined;
        if (ev.uid && uids.has(ev.uid)) note = 'Already imported';
        else if (kind === 'task' && taskKeys.has(`${ev.title.toLowerCase()}|${ev.date}`)) note = 'Already in your tasks';
        else if (ev.repeat === 'none' && ev.date < t0) note = 'In the past';
        else if (ev.repeat === 'weekly' && ev.until && ev.until < t0) note = 'Repeat already ended';
        return { ev, include: !note, kind, subjectId, note };
      }),
    );
  }

  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs && rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const chosen = useMemo(() => (rows ?? []).filter((r) => r.include), [rows]);

  async function doImport() {
    let events = 0;
    let tasks = 0;
    await db.transaction('rw', db.events, db.tasks, async () => {
      for (const r of chosen) {
        const { ev } = r;
        if (r.kind === 'task') {
          const subjectId = r.subjectId || fallbackCourse;
          if (!subjectId) continue;
          await db.tasks.add({ subjectId, title: ev.title, dueDate: ev.date, status: 'todo', priority: 'med', source: 'manual' });
          tasks++;
        } else {
          await db.events.add({
            subjectId: r.subjectId || undefined,
            title: ev.title,
            kind: r.kind,
            date: ev.date,
            startTime: ev.startTime,
            endTime: ev.endTime,
            repeat: ev.repeat,
            weekdays: ev.weekdays,
            until: ev.until,
            location: ev.location,
            note: ev.note,
            uid: ev.uid,
          });
          events++;
        }
      }
    });
    toast(`Imported ${events} calendar item${events === 1 ? '' : 's'}${tasks ? ` and ${tasks} task${tasks === 1 ? '' : 's'}` : ''}`);
    navigate('/calendar');
  }

  return (
    <>
      <PageHeader back title="Calendar sync" subtitle="Bring in your timetable and Classroom dates, or send yours to your phone's calendar" />

      <Card className="mb-5 space-y-3 p-4">
        <div className="text-sm font-medium">Import from Google Calendar</div>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>On a computer: calendar.google.com → Settings → Import &amp; export → Export.</li>
          <li>Unzip it. Each calendar is one .ics file (Classroom due dates are in their own calendar).</li>
          <li>Send the file to your phone (Drive or email) and choose it here.</li>
        </ol>
        <Input type="file" accept=".ics,text/calendar" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </Card>

      {rows && (
        <>
          <div className="mb-2 flex items-baseline justify-between">
            <div className="text-sm font-medium">
              {fileName} · {rows.length} entries
            </div>
            <div className="text-xs text-muted-foreground">{chosen.length} selected</div>
          </div>
          {rows.length === 0 && <Empty>No events found in this file.</Empty>}
          <div className="mb-4 space-y-2">
            {rows.map((r, i) => (
              <div key={i} className={cn('rounded-lg border bg-card p-3', !r.include && 'opacity-60')}>
                <label className="flex items-start gap-2.5">
                  <input type="checkbox" className="mt-1 h-4 w-4" checked={r.include} onChange={(e) => set(i, { include: e.target.checked })} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{r.ev.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.ev.repeat === 'weekly' ? 'Repeats weekly from ' : ''}
                      {formatDate(r.ev.date)}
                      {r.ev.startTime && ` · ${r.ev.startTime}${r.ev.endTime ? '–' + r.ev.endTime : ''}`}
                      {r.note && <span className="ml-1.5 rounded bg-tag-gray px-1.5 text-[10px] font-medium text-tag-gray-fg">{r.note}</span>}
                    </div>
                    {r.ev.warnings.map((w) => (
                      <div key={w} className="mt-0.5 text-xs text-tag-yellow-fg">
                        {w}
                      </div>
                    ))}
                  </div>
                </label>
                {r.include && (
                  <div className="mt-2 grid grid-cols-2 gap-2 pl-6">
                    <Select className="h-9 text-sm" value={r.kind} onChange={(e) => set(i, { kind: e.target.value as ImportKind })}>
                      {KINDS.map((k) => (
                        <option key={k.value} value={k.value}>
                          {k.label}
                        </option>
                      ))}
                    </Select>
                    <Select className="h-9 text-sm" value={r.subjectId} onChange={(e) => set(i, { subjectId: e.target.value ? Number(e.target.value) : '' })}>
                      <option value="">{r.kind === 'task' ? 'Default course' : 'No course'}</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
              </div>
            ))}
          </div>
          {chosen.some((r) => r.kind === 'task' && !r.subjectId) && (
            <div className="mb-4">
              <Field label="Course for tasks without one">
                <Select value={taskCourse || fallbackCourse || ''} onChange={(e) => setTaskCourse(Number(e.target.value))}>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
          <Button className="mb-8 w-full" disabled={chosen.length === 0} onClick={doImport}>
            Import {chosen.length} selected
          </Button>
        </>
      )}

      <Card className="space-y-3 p-4">
        <div className="text-sm font-medium">Send to your phone's calendar</div>
        <p className="text-sm text-muted-foreground">
          Exports your classes, events, open tasks with due dates, deadlines and exams as one file. Open it in Google Calendar to get reminders. Google uses your calendar's
          normal reminder settings. Export again after big changes (importing the same file twice can duplicate items).
        </p>
        <Button variant="outline" onClick={async () => toast((await exportCalendarIcs()) === 'shared' ? 'Choose your Calendar app' : 'File downloaded')}>
          Export .ics
        </Button>
      </Card>
    </>
  );
}
