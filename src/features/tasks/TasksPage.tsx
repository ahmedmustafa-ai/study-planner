import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, CheckSquare, ChevronDown, ChevronRight, ExternalLink, Paperclip, Plus, Upload } from 'lucide-react';
import { db, setSetting } from '@/lib/db';
import type { Subject, Task } from '@/lib/types';
import { useSetting, useSubjectMap, useSubjects, useTopicMap } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Empty, SubjectDot } from '@/components/common';
import { openQuickAdd, setQuickContext } from '@/components/quickAddStore';
import { countTasks, filterTasks, groupTasks, type TaskFilter, type TaskGroupBy } from '@/lib/algorithms/tasks';
import { cn, formatDate, relativeDays, today } from '@/lib/utils';
import { addTask } from './queries';
import { TaskForm } from './TaskForm';
import { useEffect } from 'react';

const FILTERS: { value: TaskFilter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'today', label: 'Today' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'done', label: 'Done' },
  { value: 'all', label: 'All' },
];

export function TasksPage() {
  const t0 = today();
  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];
  const subjects = (useSubjects() ?? []).slice().sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.id! - b.id!);
  const subjectMap = useSubjectMap();
  const topicMap = useTopicMap();
  const groupBy = useSetting<TaskGroupBy>('tasks.group', 'date');
  const [filter, setFilter] = useState<TaskFilter>('open');
  const [course, setCourse] = useState<number | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [title, setTitle] = useState('');
  const [focused, setFocused] = useState(false);
  const [target, setTarget] = useState<number | ''>('');

  // "+" on this screen adds a task to the course you're filtering by.
  useEffect(() => {
    setQuickContext({ tab: 'task', subjectId: course ?? undefined });
    return () => setQuickContext({});
  }, [course]);

  const inCourse = useMemo(() => tasks.filter((t) => course == null || t.subjectId === course), [tasks, course]);
  const counts = countTasks(inCourse, t0);
  const groups = useMemo(() => groupTasks(filterTasks(inCourse, filter, t0), groupBy, t0, subjects), [inCourse, filter, groupBy, t0, subjects]);
  const addTo = course ?? (target || subjects[0]?.id);

  return (
    <>
      <header className="mb-5 flex items-center gap-2">
        <h1 className="flex-1 text-2xl font-semibold tracking-tight">Tasks</h1>
        <Button size="sm" variant="ghost" asChild>
          <Link to="/classroom" aria-label="Import from Google Classroom">Classroom</Link>
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <Link to="/tasks/import" aria-label="Import tasks from CSV">
            <Upload /> Import
          </Link>
        </Button>
        <Button size="sm" onClick={() => openQuickAdd({ tab: 'task', subjectId: course ?? undefined })}>
          <Plus /> New
        </Button>
      </header>

      {/* Fast capture: type, Enter. Course picker appears only while typing. */}
      <form
        className="mb-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!addTo || !title.trim()) return;
          await addTask({ subjectId: addTo, title });
          setTitle('');
        }}
      >
        <div className="flex gap-2">
          <Input value={title} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task and press Enter…" />
          {(focused || title) && !course && (
            <Select className="w-36 shrink-0" value={target || addTo || ''} onMouseDown={(e) => e.stopPropagation()} onChange={(e) => setTarget(Number(e.target.value))}>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
        </div>
      </form>

      <div className="-mx-5 mb-3 flex gap-1.5 overflow-x-auto px-5 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              'shrink-0 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
              filter === f.value ? 'border-foreground bg-foreground text-background' : 'text-muted-foreground hover:bg-accent',
            )}
          >
            {f.label}
            {f.value !== 'all' && counts[f.value] > 0 && (
              <span className={cn('tabular ml-1.5 text-xs', filter === f.value ? 'opacity-70' : f.value === 'overdue' ? 'text-tag-red-fg' : 'text-muted-foreground')}>{counts[f.value]}</span>
            )}
          </button>
        ))}
      </div>

      <div className="-mx-5 mb-5 flex items-center gap-1.5 overflow-x-auto px-5 pb-1">
        <CourseChip active={course == null} onClick={() => setCourse(null)} label="All courses" />
        {subjects.map((s) => (
          <CourseChip key={s.id} active={course === s.id} onClick={() => setCourse(course === s.id ? null : s.id!)} label={s.name} color={s.color} />
        ))}
        <span className="ml-auto flex shrink-0 items-center gap-1.5 pl-2 text-xs text-muted-foreground">
          Group
          <Select className="h-8 w-[5.5rem] px-2 text-xs" value={groupBy} onChange={(e) => setSetting('tasks.group', e.target.value)}>
            <option value="date">By date</option>
            <option value="course">By course</option>
            <option value="priority">By priority</option>
          </Select>
        </span>
      </div>

      {groups.length === 0 && (
        <Empty>
          {filter === 'done' ? 'Nothing completed yet.' : filter === 'overdue' ? 'Nothing overdue. Nice.' : filter === 'today' ? 'Nothing due today.' : 'No tasks here. Type one above.'}
        </Empty>
      )}
      {groups.map((g) => (
        <section key={g.key} className="mb-6">
          <h2 className={cn('mb-2 text-[13px] font-medium', g.label === 'Overdue' ? 'text-tag-red-fg' : 'text-muted-foreground')}>
            {g.label} <span className="tabular font-normal">· {g.tasks.length}</span>
          </h2>
          <ul className="divide-y rounded-lg border bg-card">
            {g.tasks.map((t) => (
              <TaskRow key={t.id} task={t} subject={subjectMap.get(t.subjectId)} topicName={t.topicId ? topicMap.get(t.topicId)?.name : undefined} onOpen={setEditing} showCourse={groupBy !== 'course'} />
            ))}
          </ul>
        </section>
      ))}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit task</DialogTitle>
          </DialogHeader>
          {editing && <TaskForm key={editing.id} initial={editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function CourseChip({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
        active ? 'border-foreground/40 bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent',
      )}
    >
      {color && <SubjectDot color={color} className="h-2 w-2" />}
      {label}
    </button>
  );
}

/** A task line: tap the box to complete, tap the row to edit. */
export function TaskRow({
  task: t,
  subject,
  topicName,
  onOpen,
  showCourse = true,
}: {
  task: Task;
  subject?: Subject;
  topicName?: string;
  onOpen: (t: Task) => void;
  showCourse?: boolean;
}) {
  const t0 = today();
  const overdue = !!t.dueDate && t.dueDate < t0 && t.status !== 'done';
  const subtasks = t.subtasks ?? [];
  const doneSubtasks = subtasks.filter((st) => st.done).length;
  const [expanded, setExpanded] = useState(false);

  function toggleSubtask(subtaskId: string, e: React.MouseEvent) {
    e.stopPropagation();
    const updated = subtasks.map((st) => (st.id === subtaskId ? { ...st, done: !st.done } : st));
    const allDone = updated.length > 0 && updated.every((st) => st.done);
    // If all subtasks are finished, offer smart progression: mark task done if previously todo/doing
    db.tasks.update(t.id!, {
      subtasks: updated,
      status: allDone && t.status !== 'done' ? 'done' : (!allDone && t.status === 'done' ? 'todo' : t.status),
    });
  }

  return (
    <li
      role="button"
      tabIndex={0}
      onClick={() => onOpen(t)}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(t)}
      className={cn('group block cursor-pointer px-3 py-3 transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-accent', t.status === 'done' && 'opacity-55')}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          aria-label={t.status === 'done' ? 'Mark not done' : 'Mark done'}
          onClick={(e) => {
            e.stopPropagation();
            db.tasks.update(t.id!, { status: t.status === 'done' ? 'todo' : 'done' });
          }}
          className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors', t.status === 'done' ? 'border-foreground bg-foreground text-background' : 'border-input hover:border-foreground/60')}
        >
          {t.status === 'done' && <Check className="h-3 w-3" strokeWidth={3} />}
        </button>
        <div className="min-w-0 flex-1">
          <div className={cn('text-sm', t.status === 'done' && 'line-through')}>{t.title}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {showCourse && subject && (
              <span className="flex items-center gap-1">
                <SubjectDot color={subject.color} className="h-2 w-2" />
                {subject.name}
              </span>
            )}
            {topicName && <span>· {topicName}</span>}
            {t.dueDate && (
              <span className={cn(overdue && 'font-medium text-tag-red-fg')}>
                · {formatDate(t.dueDate)} ({relativeDays(t.dueDate)})
              </span>
            )}
            {subtasks.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded((v) => !v);
                }}
                className="flex items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 font-medium text-foreground hover:bg-muted"
                title={`${doneSubtasks}/${subtasks.length} subtasks completed`}
              >
                <CheckSquare className="h-3 w-3" />
                <span className="tabular-nums">{doneSubtasks}/{subtasks.length}</span>
                {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>
            )}
            {(t.materialIds?.length ?? 0) + (t.links?.length ?? 0) > 0 && (
              <span className="flex items-center gap-0.5" title="Attached materials and links">
                <Paperclip className="h-3 w-3" />
                {(t.materialIds?.length ?? 0) + (t.links?.length ?? 0)}
              </span>
            )}
          </div>
        </div>
        {t.url && (
          <a href={t.url} target="_blank" rel="noreferrer" aria-label="Open assignment" onClick={(e) => e.stopPropagation()} className="rounded p-1 hover:bg-accent">
            <ExternalLink className="h-4 w-4 text-brand" />
          </a>
        )}
        {t.status === 'doing' && <Badge variant="info">In progress</Badge>}
        {t.priority === 'high' && t.status !== 'done' && <Badge variant="destructive">High</Badge>}
      </div>

      {subtasks.length > 0 && expanded && (
        <div className="mt-2.5 ml-8 space-y-1.5 border-l-2 border-muted pl-3 pt-1" onClick={(e) => e.stopPropagation()}>
          {subtasks.map((st) => (
            <div key={st.id} className="flex items-center gap-2 py-0.5 text-xs">
              <button
                type="button"
                aria-label={st.done ? 'Mark subtask incomplete' : 'Mark subtask complete'}
                onClick={(e) => toggleSubtask(st.id, e)}
                className={cn(
                  'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition-colors',
                  st.done
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-input hover:border-foreground/60'
                )}
              >
                {st.done && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
              </button>
              <span className={cn('text-foreground/90', st.done && 'line-through text-muted-foreground')}>
                {st.title}
              </span>
            </div>
          ))}
        </div>
      )}
    </li>
  );
}
