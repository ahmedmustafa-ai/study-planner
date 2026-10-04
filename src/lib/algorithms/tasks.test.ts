import { describe, expect, it } from 'vitest';
import { countTasks, filterTasks, groupTasks } from './tasks';
import type { Subject, Task } from '@/lib/types';

const T = '2026-09-24';
const mk = (id: number, over: Partial<Task> = {}): Task => ({ id, subjectId: 1, title: `t${id}`, status: 'todo', priority: 'med', source: 'manual', ...over });
const tasks: Task[] = [
  mk(1, { dueDate: '2026-09-20' }), // overdue
  mk(2, { dueDate: T }), // today
  mk(3, { dueDate: '2026-09-25', priority: 'high' }), // tomorrow
  mk(4, { dueDate: '2026-09-29' }), // this week
  mk(5, { dueDate: '2026-11-01' }), // later
  mk(6), // no date
  mk(7, { dueDate: T, status: 'done' }),
];
const subjects: Subject[] = [
  { id: 1, academicYearId: 1, name: 'Calc', color: '#000', kind: 'course', level: 'AP', examStatus: 'none', languageLoad: false, order: 1 },
  { id: 2, academicYearId: 1, name: 'Chem', color: '#000', kind: 'course', level: 'regular', examStatus: 'none', languageLoad: false, order: 0 },
];

describe('filterTasks / countTasks', () => {
  it('filters', () => {
    expect(filterTasks(tasks, 'open', T)).toHaveLength(6);
    expect(filterTasks(tasks, 'today', T).map((t) => t.id)).toEqual([2]);
    expect(filterTasks(tasks, 'overdue', T).map((t) => t.id)).toEqual([1]);
    expect(filterTasks(tasks, 'done', T).map((t) => t.id)).toEqual([7]);
    expect(filterTasks(tasks, 'all', T)).toHaveLength(7);
  });
  it('counts', () => {
    expect(countTasks(tasks, T)).toEqual({ open: 6, today: 1, overdue: 1, done: 1, all: 7 });
  });
});

describe('groupTasks', () => {
  it('by date: overdue → today → tomorrow → week → later → none', () => {
    const g = groupTasks(filterTasks(tasks, 'open', T), 'date', T, subjects);
    expect(g.map((x) => x.label)).toEqual(['Overdue', 'Today', 'Tomorrow', 'This week', 'Later', 'No date']);
  });
  it('by priority puts high first', () => {
    const g = groupTasks(filterTasks(tasks, 'open', T), 'priority', T, subjects);
    expect(g[0].label).toBe('High priority');
    expect(g[0].tasks.map((t) => t.id)).toEqual([3]);
  });
  it('by course follows the course order', () => {
    const t = [mk(1, { subjectId: 1 }), mk(2, { subjectId: 2 })];
    expect(groupTasks(t, 'course', T, subjects).map((x) => x.label)).toEqual(['Chem', 'Calc']);
  });
  it('sorts inside a group by due date then priority', () => {
    const t = [mk(1, { dueDate: '2026-09-28' }), mk(2, { dueDate: '2026-09-26', priority: 'low' }), mk(3, { dueDate: '2026-09-26', priority: 'high' })];
    expect(groupTasks(t, 'date', T, subjects)[0].tasks.map((x) => x.id)).toEqual([3, 2, 1]);
  });
});
