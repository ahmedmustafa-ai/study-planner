import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check } from 'lucide-react';
import { db } from '@/lib/db';
import type { Subject } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { timeLabel, type CalItem, type CalKind } from '@/lib/algorithms/calendar';
import { cn } from '@/lib/utils';
import { EventForm } from './EventForm';
import { TaskForm } from '@/features/tasks/TaskForm';

export const KIND_LABEL: Record<CalKind, string> = { class: 'Class', event: 'Event', exam: 'Exam', deadline: 'Deadline', task: 'Task' };
export const KIND_VARIANT: Record<CalKind, 'info' | 'purple' | 'destructive' | 'warning' | 'secondary'> = {
  class: 'info',
  event: 'purple',
  exam: 'destructive',
  deadline: 'warning',
  task: 'secondary',
};

/** One calendar entry: colored by course, with a checkbox for tasks. */
export function CalItemRow({ item, subject, onOpen, showDate }: { item: CalItem; subject?: Subject; onOpen: (i: CalItem) => void; showDate?: boolean }) {
  const isTask = item.kind === 'task';
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item)}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(item)}
      className={cn('flex cursor-pointer items-stretch gap-3 rounded-lg border bg-card px-3 py-2.5 transition-colors hover:bg-accent', item.done && 'opacity-55')}
    >
      <span className="w-1 shrink-0 rounded-full" style={{ backgroundColor: subject?.color ?? '#9b9a97' }} />
      <div className="tabular w-[4.6rem] shrink-0 pt-0.5 text-xs text-muted-foreground">{isTask || item.kind === 'deadline' ? (showDate ? '' : 'Due') : timeLabel(item)}</div>
      <div className="min-w-0 flex-1">
        <div className={cn('text-sm font-medium', item.done && 'line-through')}>{item.title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Badge variant={KIND_VARIANT[item.kind]}>{KIND_LABEL[item.kind]}</Badge>
          {subject && <span className="truncate">{subject.name}</span>}
          {item.location && <span className="truncate">· {item.location}</span>}
        </div>
      </div>
      {isTask && (
        <button
          type="button"
          aria-label={item.done ? 'Mark not done' : 'Mark done'}
          onClick={(e) => {
            e.stopPropagation();
            db.tasks.update(item.ref.id, { status: item.done ? 'todo' : 'done' });
          }}
          className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center self-start rounded border', item.done && 'border-foreground bg-foreground text-background')}
        >
          {item.done && <Check className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  );
}

/** Opens the right editor for any calendar item (event / task in a sheet, course exam & deadlines by navigating). */
export function ItemEditor({ item, onClose }: { item: CalItem | null; onClose: () => void }) {
  const navigate = useNavigate();
  const type = item?.ref.type;
  const rec = useLiveQuery(async () => {
    if (!item) return null;
    if (item.ref.type === 'event') return db.events.get(item.ref.id);
    if (item.ref.type === 'task') return db.tasks.get(item.ref.id);
    return null;
  }, [item?.key]);

  useEffect(() => {
    if (!item) return;
    if (item.ref.type === 'milestone') navigate('/targets');
    if (item.ref.type === 'subject') navigate(`/subjects/${item.ref.id}`);
    if (item.ref.type === 'milestone' || item.ref.type === 'subject') onClose();
  }, [item, navigate, onClose]);

  const open = !!item && (type === 'event' || type === 'task') && !!rec;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{type === 'task' ? 'Edit task' : 'Edit'}</DialogTitle>
        </DialogHeader>
        {open && type === 'event' && <EventForm key={item!.key} initial={rec as never} onDone={onClose} />}
        {open && type === 'task' && <TaskForm key={item!.key} initial={rec as never} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
