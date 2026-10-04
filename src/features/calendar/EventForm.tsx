import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import type { CalEvent, EventKind } from '@/lib/types';
import { useSubjects } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/common';
import { toast } from '@/components/toast';
import { weekdayOf } from '@/lib/algorithms/calendar';
import { cn, today } from '@/lib/utils';
import { Segmented } from '@/features/tasks/TaskForm';

const KINDS: { value: EventKind; label: string }[] = [
  { value: 'class', label: 'Class' },
  { value: 'event', label: 'Event' },
  { value: 'exam', label: 'Exam' },
];
// Shown Monday → Sunday; values are JS weekdays (0 = Sunday).
const DAYS: { value: number; label: string }[] = [
  { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' }, { value: 3, label: 'Wed' }, { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' }, { value: 6, label: 'Sat' }, { value: 0, label: 'Sun' },
];

/** Create or edit a class / event / exam. Classes repeat weekly on the days you pick. */
export function EventForm({
  initial,
  defaults,
  onDone,
}: {
  initial?: CalEvent;
  defaults?: { subjectId?: number; date?: string; kind?: EventKind };
  onDone: () => void;
}) {
  const subjects = useSubjects() ?? [];
  const startDate = initial?.date ?? defaults?.date ?? today();
  const startKind = initial?.kind ?? defaults?.kind ?? 'event';
  const [e, setE] = useState<CalEvent>(
    initial ?? {
      title: '',
      kind: startKind,
      subjectId: defaults?.subjectId,
      date: startDate,
      repeat: startKind === 'class' ? 'weekly' : 'none',
      weekdays: [weekdayOf(startDate)],
    },
  );
  const set = (patch: Partial<CalEvent>) => setE((cur) => ({ ...cur, ...patch }));
  const allDay = !e.startTime;
  const weekdays = e.weekdays?.length ? e.weekdays : [weekdayOf(e.date)];

  function setKind(kind: EventKind) {
    // Classes are weekly by default; switching away from class turns repeat off (unless the user set it on an existing event).
    if (!initial) set({ kind, repeat: kind === 'class' ? 'weekly' : 'none' });
    else set({ kind });
  }
  function setDate(date: string) {
    // While only one weekday is picked, keep it in sync with the date.
    if (date) set({ date, weekdays: weekdays.length <= 1 ? [weekdayOf(date)] : weekdays });
  }
  function toggleDay(d: number) {
    setE((cur) => {
      const days = cur.weekdays?.length ? cur.weekdays : [weekdayOf(cur.date)];
      const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d];
      return next.length ? { ...cur, weekdays: next } : cur; // keep at least one day
    });
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!e.title.trim()) return toast('Add a title');
    if (e.startTime && e.endTime && e.endTime < e.startTime) return toast('End time is before start time');
    const record: CalEvent = {
      ...e,
      title: e.title.trim(),
      startTime: e.startTime || undefined,
      endTime: e.startTime ? e.endTime || undefined : undefined,
      until: e.repeat === 'weekly' ? e.until || undefined : undefined,
      weekdays: e.repeat === 'weekly' ? weekdays : undefined,
      location: e.location?.trim() || undefined,
      note: e.note?.trim() || undefined,
    };
    await db.events.put(record);
    toast(initial ? 'Saved' : e.kind === 'class' ? 'Class added' : e.kind === 'exam' ? 'Exam added' : 'Event added');
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input
        autoFocus={!initial}
        placeholder={e.kind === 'class' ? 'e.g. AP Calculus — Period 3' : e.kind === 'exam' ? 'e.g. Chemistry unit test' : 'e.g. Robotics meeting'}
        value={e.title}
        onChange={(x) => set({ title: x.target.value })}
        className="h-11 text-base"
      />
      <Segmented value={e.kind} options={KINDS} onChange={setKind} />
      <Field label="Course (optional)">
        <Select value={e.subjectId ?? ''} onChange={(x) => set({ subjectId: x.target.value ? Number(x.target.value) : undefined })}>
          <option value="">No course</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={e.repeat === 'weekly' ? 'Starts on' : 'Date'}>
          <Input type="date" value={e.date} onChange={(x) => setDate(x.target.value)} />
        </Field>
        <Field label="All day">
          <label className="flex h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={allDay}
              onChange={(x) => set(x.target.checked ? { startTime: undefined, endTime: undefined } : { startTime: '09:00', endTime: '10:00' })}
            />
            No set time
          </label>
        </Field>
      </div>
      {!allDay && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start">
            <Input type="time" value={e.startTime ?? ''} onChange={(x) => set({ startTime: x.target.value })} />
          </Field>
          <Field label="End">
            <Input type="time" value={e.endTime ?? ''} onChange={(x) => set({ endTime: x.target.value })} />
          </Field>
        </div>
      )}

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" className="h-4 w-4" checked={e.repeat === 'weekly'} onChange={(x) => set({ repeat: x.target.checked ? 'weekly' : 'none' })} />
          Repeats every week
        </label>
        {e.repeat === 'weekly' && (
          <>
            <div className="flex gap-1">
              {DAYS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleDay(d.value)}
                  className={cn(
                    'flex-1 rounded-md border py-1.5 text-xs font-medium',
                    weekdays.includes(d.value) ? 'border-foreground bg-foreground text-background' : 'text-muted-foreground hover:bg-accent',
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <Field label="Until (optional)">
              <Input type="date" value={e.until ?? ''} onChange={(x) => set({ until: x.target.value || undefined })} />
            </Field>
          </>
        )}
      </div>

      <Field label="Location (optional)">
        <Input value={e.location ?? ''} onChange={(x) => set({ location: x.target.value })} placeholder="Room, lab, link…" />
      </Field>
      <Field label="Note (optional)">
        <Input value={e.note ?? ''} onChange={(x) => set({ note: x.target.value })} />
      </Field>

      <div className="flex gap-2">
        <Button type="submit" className="flex-1">
          {initial ? 'Save' : `Add ${e.kind}`}
        </Button>
        {initial?.id && (
          <Button
            type="button"
            variant="destructive"
            aria-label="Delete"
            onClick={async () => {
              const msg = initial.repeat === 'weekly' ? 'Delete this repeating class/event (all weeks)?' : 'Delete this event?';
              if (!confirm(msg)) return;
              await db.events.delete(initial.id!);
              toast('Deleted');
              onDone();
            }}
          >
            <Trash2 />
          </Button>
        )}
      </div>
    </form>
  );
}
