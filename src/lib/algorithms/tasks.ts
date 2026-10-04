// Task filtering and grouping for the Tasks page — pure.
import type { Priority, Subject, Task } from '@/lib/types';

export type TaskFilter = 'open' | 'today' | 'overdue' | 'done' | 'all';
export type TaskGroupBy = 'date' | 'course' | 'priority';

const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
const PRIORITY_RANK: Record<Priority, number> = { high: 0, med: 1, low: 2 };

export function filterTasks(tasks: Task[], filter: TaskFilter, todayIso: string): Task[] {
  switch (filter) {
    case 'open':
      return tasks.filter((t) => t.status !== 'done');
    case 'today':
      return tasks.filter((t) => t.status !== 'done' && t.dueDate === todayIso);
    case 'overdue':
      return tasks.filter((t) => t.status !== 'done' && !!t.dueDate && t.dueDate < todayIso);
    case 'done':
      return tasks.filter((t) => t.status === 'done');
    default:
      return tasks;
  }
}

export function countTasks(tasks: Task[], todayIso: string): Record<TaskFilter, number> {
  return {
    open: filterTasks(tasks, 'open', todayIso).length,
    today: filterTasks(tasks, 'today', todayIso).length,
    overdue: filterTasks(tasks, 'overdue', todayIso).length,
    done: filterTasks(tasks, 'done', todayIso).length,
    all: tasks.length,
  };
}

const byDueThenPriority = (a: Task, b: Task) =>
  (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.title.localeCompare(b.title);

export interface TaskGroup {
  key: string;
  label: string;
  tasks: Task[];
}

export function groupTasks(tasks: Task[], by: TaskGroupBy, todayIso: string, subjects: Subject[]): TaskGroup[] {
  const sorted = tasks.slice().sort(byDueThenPriority);
  const buckets = new Map<string, TaskGroup>();
  const push = (key: string, label: string, t: Task) => {
    if (!buckets.has(key)) buckets.set(key, { key, label, tasks: [] });
    buckets.get(key)!.tasks.push(t);
  };

  if (by === 'date') {
    for (const t of sorted) {
      if (!t.dueDate) push('9-none', 'No date', t);
      else {
        const d = days(todayIso, t.dueDate);
        if (d < 0) push('0-overdue', 'Overdue', t);
        else if (d === 0) push('1-today', 'Today', t);
        else if (d === 1) push('2-tomorrow', 'Tomorrow', t);
        else if (d <= 7) push('3-week', 'This week', t);
        else push('4-later', 'Later', t);
      }
    }
  } else if (by === 'priority') {
    for (const t of sorted) push(String(PRIORITY_RANK[t.priority]), { high: 'High priority', med: 'Medium', low: 'Low' }[t.priority], t);
  } else {
    const order = new Map(subjects.map((s, i) => [s.id!, s.order ?? i]));
    const name = new Map(subjects.map((s) => [s.id!, s.name]));
    for (const t of sorted) push(String(order.get(t.subjectId) ?? 999).padStart(4, '0') + t.subjectId, name.get(t.subjectId) ?? 'Course', t);
  }
  return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
}
