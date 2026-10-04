import type { CalEvent, Subject } from '@/lib/types';
import { SubjectDot } from '@/components/common';
import { timeLabel } from '@/lib/algorithms/calendar';
import { cn } from '@/lib/utils';

const DAY_NAME = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Your weekly class schedule as a grid, one column per day — not tied to any particular week, since classes repeat every week. */
export function Timetable({
  events,
  subjectMap,
  weekStart,
  today,
  onOpen,
}: {
  events: CalEvent[];
  subjectMap: Map<number, Subject>;
  weekStart: number;
  today: number; // this weekday, 0 = Sunday
  onOpen: (e: CalEvent) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => (weekStart + i) % 7);
  const classes = events.filter((e) => e.kind === 'class' && e.repeat === 'weekly' && e.weekdays?.length);
  const byDay = new Map<number, CalEvent[]>(days.map((d) => [d, []]));
  for (const e of classes) for (const d of e.weekdays!) byDay.get(d)?.push(e);
  for (const list of byDay.values()) list.sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? '') || a.title.localeCompare(b.title));

  if (classes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No weekly classes yet. Add one below — pick "Class" and the days it repeats on.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-7">
      {days.map((d) => (
        <div key={d}>
          <div className={cn('mb-1.5 text-sm font-medium', d === today && 'text-brand')}>{DAY_NAME[d]}</div>
          <div className="space-y-1.5">
            {(byDay.get(d) ?? []).length === 0 ? (
              <div className="rounded-lg border border-dashed px-2 py-3 text-center text-xs text-muted-foreground">No classes</div>
            ) : (
              byDay.get(d)!.map((e) => {
                const s = e.subjectId != null ? subjectMap.get(e.subjectId) : undefined;
                return (
                  <button key={e.id} onClick={() => onOpen(e)} className="flex w-full items-start gap-2 rounded-lg border bg-card px-2.5 py-2 text-left transition-colors hover:bg-accent">
                    <SubjectDot color={s?.color} className="mt-1 h-2 w-2 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">{e.title}</div>
                      <div className="tabular text-[11px] text-muted-foreground">{timeLabel(e)}</div>
                      {e.location && <div className="truncate text-[11px] text-muted-foreground">{e.location}</div>}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
