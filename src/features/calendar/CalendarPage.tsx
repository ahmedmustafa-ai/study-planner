import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, SlidersHorizontal } from 'lucide-react';
import { useSubjectMap, useSubjects } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Empty, Field, SubjectDot } from '@/components/common';
import { openQuickAdd, setQuickContext } from '@/components/quickAddStore';
import { Segmented } from '@/features/tasks/TaskForm';
import {
  addDaysISO, addMonthsISO, buildCalendarItems, filterItems, groupByDate, monthGrid, weekDates, weekdayOf,
  type CalItem, type CalKind, type CalSources,
} from '@/lib/algorithms/calendar';
import { cn, relativeDays, today } from '@/lib/utils';
import { CalItemRow, ItemEditor, KIND_LABEL } from './CalItemRow';
import { Timetable } from './Timetable';
import { useCalSettings, useCalSources, type CalView } from './useCalendar';

const VIEWS: { value: CalView; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
  { value: 'agenda', label: 'Agenda' },
  { value: 'timetable', label: 'Timetable' },
];
const AGENDA_DAYS = 30;

const long = (iso: string, o: Intl.DateTimeFormatOptions) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, o);
};

export function CalendarPage() {
  const t0 = today();
  const settings = useCalSettings();
  const { view, weekStart, filter } = settings;
  const [cursor, setCursor] = useState(t0);
  const [editing, setEditing] = useState<CalItem | null>(null);
  const [customize, setCustomize] = useState(false);
  const subjectMap = useSubjectMap();
  const src = useCalSources();

  // "+" adds to the day you're looking at; on the timetable it defaults to a class.
  useEffect(() => {
    setQuickContext({ date: cursor, tab: 'event', eventKind: view === 'timetable' ? 'class' : undefined });
    return () => setQuickContext({});
  }, [cursor, view]);

  const range = useMemo(() => {
    if (view === 'month') {
      const g = monthGrid(cursor, weekStart);
      return { from: g[0], to: g[41], grid: g };
    }
    if (view === 'week') {
      const w = weekDates(cursor, weekStart);
      return { from: w[0], to: w[6], grid: w };
    }
    return { from: cursor, to: addDaysISO(cursor, AGENDA_DAYS - 1), grid: [] as string[] };
  }, [view, cursor, weekStart]);

  const items = useMemo(() => (src ? filterItems(buildCalendarItems(src as CalSources, range.from, range.to), filter) : []), [src, range, filter]);
  const byDate = useMemo(() => groupByDate(items), [items]);

  function step(dir: 1 | -1) {
    setCursor((c) => (view === 'month' ? addMonthsISO(c, dir) : view === 'week' ? addDaysISO(c, 7 * dir) : addDaysISO(c, AGENDA_DAYS * dir)));
  }

  const title =
    view === 'month'
      ? long(cursor, { month: 'long', year: 'numeric' })
      : view === 'week'
        ? `${long(range.from, { day: 'numeric', month: 'short' })} – ${long(range.to, { day: 'numeric', month: 'short', year: 'numeric' })}`
        : view === 'timetable'
          ? 'Weekly timetable'
          : 'Next 30 days';

  const rows = (date: string) =>
    (byDate.get(date) ?? []).map((i) => <CalItemRow key={i.key} item={i} subject={i.subjectId != null ? subjectMap.get(i.subjectId) : undefined} onOpen={setEditing} />);

  return (
    <>
      <header className="mb-4 flex items-center gap-2">
        <h1 className="min-w-0 flex-1 truncate text-2xl font-semibold tracking-tight">{title}</h1>
        {view !== 'timetable' && (
          <>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => step(-1)} aria-label="Previous">
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCursor(t0)}>
              Today
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => step(1)} aria-label="Next">
              <ChevronRight />
            </Button>
          </>
        )}
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setCustomize(true)} aria-label="Customize calendar">
          <SlidersHorizontal />
        </Button>
      </header>

      <div className="mb-4">
        <Segmented value={view} options={VIEWS} onChange={settings.setView} />
      </div>

      {view === 'month' && (
        <>
          <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground">
            {weekDates(cursor, weekStart).map((d) => (
              <div key={d}>{long(d, { weekday: 'short' })}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {range.grid.map((d) => {
              const inMonth = d.slice(0, 7) === cursor.slice(0, 7);
              const dots = (byDate.get(d) ?? []).slice(0, 4);
              return (
                <button
                  key={d}
                  onClick={() => setCursor(d)}
                  aria-label={long(d, { weekday: 'long', day: 'numeric', month: 'long' })}
                  className={cn('flex h-14 flex-col items-center rounded-lg pt-1.5 transition-colors', d === cursor ? 'bg-accent' : 'hover:bg-accent/60', !inMonth && 'opacity-40')}
                >
                  <span className={cn('tabular flex h-6 w-6 items-center justify-center rounded-full text-sm', d === t0 && 'bg-foreground font-semibold text-background')}>
                    {Number(d.slice(8))}
                  </span>
                  <span className="mt-1 flex h-1.5 gap-0.5">
                    {dots.map((i) => (
                      <SubjectDot key={i.key} className="h-1.5 w-1.5" color={i.subjectId != null ? subjectMap.get(i.subjectId)?.color : undefined} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-medium">
                {long(cursor, { weekday: 'long', day: 'numeric', month: 'long' })}
                {cursor !== t0 && <span className="ml-2 text-xs font-normal text-muted-foreground">{relativeDays(cursor)}</span>}
              </h2>
              <Button size="sm" variant="outline" onClick={() => openQuickAdd({ tab: 'event', date: cursor })}>
                <Plus /> Add
              </Button>
            </div>
            <div className="space-y-2">{(byDate.get(cursor)?.length ?? 0) === 0 ? <Empty>Nothing on this day.</Empty> : rows(cursor)}</div>
          </div>
        </>
      )}

      {view === 'week' && (
        <div className="space-y-5">
          {range.grid.map((d) => (
            <section key={d}>
              <div className="mb-1.5 flex items-center gap-2">
                <h2 className={cn('text-sm font-medium', d === t0 && 'text-brand')}>
                  {long(d, { weekday: 'long' })} <span className="font-normal text-muted-foreground">{long(d, { day: 'numeric', month: 'short' })}</span>
                </h2>
                {d === t0 && <span className="rounded bg-tag-blue px-1.5 text-[10px] font-medium text-tag-blue-fg">Today</span>}
                <button className="ml-auto rounded p-1 text-muted-foreground hover:bg-accent" onClick={() => openQuickAdd({ tab: 'event', date: d })} aria-label={`Add on ${d}`}>
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2">{(byDate.get(d)?.length ?? 0) === 0 ? <div className="h-px bg-border" /> : rows(d)}</div>
            </section>
          ))}
        </div>
      )}

      {view === 'agenda' && (
        <div className="space-y-5">
          {byDate.size === 0 && <Empty>Nothing coming up in the next {AGENDA_DAYS} days.</Empty>}
          {[...byDate.keys()].map((d) => (
            <section key={d}>
              <h2 className="mb-1.5 text-sm font-medium">
                {long(d, { weekday: 'long', day: 'numeric', month: 'short' })}
                <span className="ml-2 text-xs font-normal text-muted-foreground">{relativeDays(d)}</span>
              </h2>
              <div className="space-y-2">{rows(d)}</div>
            </section>
          ))}
        </div>
      )}

      {view === 'timetable' && (
        <>
          <Timetable
            events={(src?.events ?? []).filter((e) => !(e.subjectId != null && settings.hidden.includes(e.subjectId)))}
            subjectMap={subjectMap}
            weekStart={weekStart}
            today={weekdayOf(t0)}
            onOpen={(e) => setEditing({ key: `event-${e.id}-tt`, kind: e.kind, date: e.date, startTime: e.startTime, endTime: e.endTime, title: e.title, subjectId: e.subjectId, ref: { type: 'event', id: e.id! } })}
          />
          <Button size="sm" variant="outline" className="mt-4" onClick={() => openQuickAdd({ tab: 'event', eventKind: 'class', date: t0 })}>
            <Plus /> Add a class
          </Button>
        </>
      )}

      <ItemEditor item={editing} onClose={() => setEditing(null)} />
      <CalendarSettingsDialog open={customize} onOpenChange={setCustomize} settings={settings} />
    </>
  );
}

function CalendarSettingsDialog({
  open,
  onOpenChange,
  settings,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  settings: ReturnType<typeof useCalSettings>;
}) {
  const subjects = (useSubjects() ?? []).filter((s) => !s.archived);
  const kinds: CalKind[] = ['class', 'event', 'exam', 'deadline', 'task'];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Customize calendar</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <Field label="Week starts on">
            <Select value={settings.weekStart} onChange={(e) => settings.setWeekStart(Number(e.target.value))}>
              <option value={1}>Monday</option>
              <option value={0}>Sunday</option>
              <option value={6}>Saturday</option>
            </Select>
          </Field>
          <div>
            <div className="mb-2 text-[13px] font-medium text-muted-foreground">Show</div>
            <ul className="divide-y rounded-lg border">
              {kinds.map((k) => (
                <li key={k} className="flex items-center justify-between px-3 py-2.5 text-sm">
                  {KIND_LABEL[k]}s
                  <Switch on={settings.layers[k]} onChange={(v) => settings.setLayer(k, v)} label={`Show ${KIND_LABEL[k]}s`} />
                </li>
              ))}
            </ul>
          </div>
          <Button variant="outline" className="w-full" asChild>
            <Link to="/calendar/import">Import / export (.ics)</Link>
          </Button>
          <div>
            <div className="mb-2 text-[13px] font-medium text-muted-foreground">Courses</div>
            <ul className="divide-y rounded-lg border">
              {subjects.map((s) => (
                <li key={s.id} className="flex items-center gap-2 px-3 py-2.5 text-sm">
                  <SubjectDot color={s.color} />
                  <span className="flex-1 truncate">{s.name}</span>
                  <Switch on={!settings.hidden.includes(s.id!)} onChange={() => settings.toggleCourse(s.id!)} label={`Show ${s.name}`} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
