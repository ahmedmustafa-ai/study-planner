import { useState } from 'react';
import { Play, Square } from 'lucide-react';
import { useSubjectMap, useSubjects } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/common';
import { toast } from '@/components/toast';
import { formatClock, formatDuration, suggestedMinutes } from '@/lib/algorithms/timer';
import { today } from '@/lib/utils';
import { clearTimer, saveSession, startTimer, useTimer } from './timer';

/** Start the timer for a course (and topic). Works from Home, course and topic pages. */
export function StartTimerButton({ subjectId, topicId, label = 'Timer', className, iconOnly, variant = 'outline' }: {
  subjectId: number;
  topicId?: number;
  label?: string;
  className?: string;
  iconOnly?: boolean;
  variant?: 'outline' | 'ghost' | 'default' | 'secondary';
}) {
  const { state } = useTimer();
  const running = !!state;
  return (
    <Button
      size={iconOnly ? 'icon' : 'sm'}
      variant={variant}
      className={className}
      aria-label="Start timer"
      onClick={async () => {
        if (running) return toast('A timer is already running. Stop it first.');
        await startTimer(subjectId, topicId);
        toast('Timer started');
      }}
    >
      <Play /> {!iconOnly && label}
    </Button>
  );
}

/** Small pill above the nav while the timer runs. Tap Stop to save the time. */
export function TimerBar() {
  const { state, seconds } = useTimer();
  const subjectMap = useSubjectMap();
  const [stopping, setStopping] = useState(false);
  if (!state) return null;
  const subject = subjectMap.get(state.subjectId);
  return (
    <>
      <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-4 z-40 flex max-w-[calc(100vw-6rem)] items-center gap-2 rounded-xl border bg-card py-1.5 pl-3 pr-1.5 shadow-[0_2px_10px_rgba(0,0,0,0.10)]">
        <span className="h-2 w-2 shrink-0 animate-pulse rounded-full" style={{ backgroundColor: subject?.color ?? '#9b9a97' }} />
        <span className="truncate text-xs text-muted-foreground">{subject?.name ?? 'Studying'}</span>
        <span className="tabular text-sm font-semibold">{formatClock(seconds)}</span>
        <Button size="sm" className="h-8 px-2.5" onClick={() => setStopping(true)} aria-label="Stop timer">
          <Square className="!size-3.5 fill-current" /> Stop
        </Button>
      </div>
      <Dialog open={stopping} onOpenChange={setStopping}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save study time</DialogTitle>
          </DialogHeader>
          {stopping && (
            <SessionForm
              key={state.startedAt}
              initial={{ subjectId: state.subjectId, topicId: state.topicId, minutes: suggestedMinutes(seconds), date: state.startedAt.slice(0, 10) }}
              longWarning={seconds > 3 * 3600}
              secondaryLabel="Discard"
              onSecondary={async () => {
                await clearTimer();
                setStopping(false);
                toast('Timer discarded');
              }}
              onSaved={async () => {
                await clearTimer();
                setStopping(false);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Course + minutes (+ note). Used when stopping the timer and for logging time by hand. */
export function SessionForm({ initial, onSaved, secondaryLabel, onSecondary, longWarning, showDate }: {
  initial: { subjectId?: number; topicId?: number; minutes?: number; date?: string };
  onSaved: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  longWarning?: boolean;
  showDate?: boolean;
}) {
  const subjects = useSubjects() ?? [];
  const [subjectId, setSubjectId] = useState<number | ''>(initial.subjectId ?? '');
  const [minutes, setMinutes] = useState(String(initial.minutes ?? 30));
  const [date, setDate] = useState(initial.date ?? today());
  const [note, setNote] = useState('');
  const mins = Number(minutes);

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!subjectId) return toast('Choose a course');
        if (!(mins >= 1 && mins <= 24 * 60)) return toast('Enter minutes between 1 and 1440');
        await saveSession({ subjectId, topicId: initial.topicId, minutes: mins, date, note });
        toast(`Saved ${formatDuration(mins)}`);
        onSaved();
      }}
    >
      <Field label="Course">
        <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value ? Number(e.target.value) : '')}>
          <option value="">Choose course…</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className={showDate ? 'grid grid-cols-2 gap-3' : ''}>
        <Field label="Minutes" hint={longWarning ? 'That is a long time. Edit it if you forgot to stop the timer.' : undefined}>
          <Input type="number" inputMode="numeric" min={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </Field>
        {showDate && (
          <Field label="Date">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        )}
      </div>
      <Field label="Note (optional)">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you work on?" />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" className="flex-1">
          Save
        </Button>
        {secondaryLabel && (
          <Button type="button" variant="ghost" onClick={onSecondary}>
            {secondaryLabel}
          </Button>
        )}
      </div>
    </form>
  );
}
