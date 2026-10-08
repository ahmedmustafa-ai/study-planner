import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import type { Priority, Subtask, Task, TaskStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/common';
import { SubjectTopicPicker, loadLastPick, saveLastPick, type PickerValue } from '@/components/SubjectTopicPicker';
import { toast } from '@/components/toast';
import { addDays, cn, today } from '@/lib/utils';
import { addTask } from './queries';
import { TaskAttachments } from './TaskAttachments';
import { TaskSubtasks } from './TaskSubtasks';

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'med', label: 'Medium' },
  { value: 'low', label: 'Low' },
];
const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To do' },
  { value: 'doing', label: 'Doing' },
  { value: 'done', label: 'Done' },
];

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-md bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded px-2 py-1.5 text-sm font-medium transition-colors',
            o.value === value ? 'bg-card text-foreground shadow-[0_0_0_1px_hsl(var(--border))]' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Create or edit a task. One form for Quick Add, the Tasks page and course pages. */
export function TaskForm({
  initial,
  defaults,
  onDone,
}: {
  initial?: Task;
  defaults?: { subjectId?: number; topicId?: number; dueDate?: string };
  onDone: () => void;
}) {
  const [pick, setPick] = useState<PickerValue>(
    initial ? { subjectId: initial.subjectId, topicId: initial.topicId } : { ...loadLastPick(), ...(defaults?.subjectId ? { subjectId: defaults.subjectId, topicId: defaults.topicId } : {}) },
  );
  const [title, setTitle] = useState(initial?.title ?? '');
  const [due, setDue] = useState(initial?.dueDate ?? defaults?.dueDate ?? '');
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? 'med');
  const [status, setStatus] = useState<TaskStatus>(initial?.status ?? 'todo');
  const [materialIds, setMaterialIds] = useState<number[]>(initial?.materialIds ?? []);
  const [links, setLinks] = useState<string[]>(initial?.links ?? []);
  const [subtasks, setSubtasks] = useState<Subtask[]>(initial?.subtasks ?? []);
  const t0 = today();

  // Materials belong to a course, so changing the course clears the picked ones.
  function changePick(v: PickerValue) {
    if (v.subjectId !== pick.subjectId) setMaterialIds([]);
    setPick(v);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pick.subjectId) return toast('Choose a course');
    if (!title.trim()) return toast('Add a title');
    if (initial?.id) {
      await db.tasks.put({
        ...initial,
        title: title.trim(),
        subjectId: pick.subjectId,
        topicId: pick.topicId,
        dueDate: due || undefined,
        priority,
        status,
        materialIds: materialIds.length ? materialIds : undefined,
        links: links.length ? links : undefined,
        subtasks: subtasks.length ? subtasks : undefined,
      });
      toast('Task updated');
    } else {
      await addTask({
        subjectId: pick.subjectId,
        topicId: pick.topicId,
        title,
        dueDate: due,
        priority,
        materialIds,
        links,
        subtasks,
      });
      saveLastPick(pick);
      toast('Task added');
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input autoFocus={!initial} placeholder="What needs doing?" value={title} onChange={(e) => setTitle(e.target.value)} className="h-11 text-base" />
      <SubjectTopicPicker value={pick} onChange={changePick} />
      <Field label="Due">
        <div className="space-y-2">
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          <div className="flex flex-wrap gap-1.5">
            {[
              ['Today', t0],
              ['Tomorrow', addDays(t0, 1)],
              ['Next week', addDays(t0, 7)],
              ['No date', ''],
            ].map(([label, v]) => (
              <button
                key={label}
                type="button"
                onClick={() => setDue(v)}
                className={cn('rounded-md border px-2.5 py-1 text-xs font-medium', due === v ? 'border-foreground/40 bg-accent' : 'text-muted-foreground hover:bg-accent')}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </Field>
      <Field label="Priority">
        <Segmented value={priority} options={PRIORITIES} onChange={setPriority} />
      </Field>
      <TaskAttachments subjectId={pick.subjectId} materialIds={materialIds} onMaterialIds={setMaterialIds} links={links} onLinks={setLinks} classroomUrl={initial?.url} />
      <TaskSubtasks subtasks={subtasks} onChange={setSubtasks} />
      {initial && (
        <Field label="Status">
          <Segmented value={status} options={STATUSES} onChange={setStatus} />
        </Field>
      )}
      <div className="flex gap-2">
        <Button type="submit" className="flex-1">
          {initial ? 'Save' : 'Add task'}
        </Button>
        {initial?.id && (
          <Button
            type="button"
            variant="destructive"
            aria-label="Delete task"
            onClick={async () => {
              await db.tasks.delete(initial.id!);
              toast('Task deleted');
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
