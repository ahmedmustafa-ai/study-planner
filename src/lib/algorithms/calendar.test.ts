import { describe, expect, it } from 'vitest';
import { buildCalendarItems, expandEvent, filterItems, groupByDate, monthGrid, timeLabel, weekDates, weekdayOf } from './calendar';
import { rankPriorities } from './priorities';
import type { CalEvent, Milestone, Subject, Task } from '@/lib/types';

// 2026-09-24 is a Thursday.
const subject = (over: Partial<Subject> = {}): Subject => ({
  id: 1, academicYearId: 1, name: 'Calc', color: '#000', kind: 'course', level: 'AP', examStatus: 'studying', languageLoad: false, ...over,
});

describe('dates', () => {
  it('weekday and week grid respect week start', () => {
    expect(weekdayOf('2026-09-24')).toBe(4);
    expect(weekDates('2026-09-24', 1)[0]).toBe('2026-09-21'); // Monday start
    expect(weekDates('2026-09-24', 0)[0]).toBe('2026-09-20'); // Sunday start
    expect(weekDates('2026-09-21', 1)).toHaveLength(7);
  });
  it('month grid is 42 days starting on the week start', () => {
    const g = monthGrid('2026-09-24', 1);
    expect(g).toHaveLength(42);
    expect(g[0]).toBe('2026-08-31');
    expect(g).toContain('2026-09-30');
  });
});

describe('expandEvent', () => {
  const cls: CalEvent = { id: 1, subjectId: 1, title: 'Calc class', kind: 'class', date: '2026-09-21', startTime: '09:00', endTime: '09:45', repeat: 'weekly', weekdays: [1, 3] };
  it('repeats weekly on chosen weekdays inside the range', () => {
    const out = expandEvent(cls, '2026-09-21', '2026-09-30').map((i) => i.date);
    expect(out).toEqual(['2026-09-21', '2026-09-23', '2026-09-28', '2026-09-30']);
  });
  it('does not start before the first date and stops at until', () => {
    expect(expandEvent(cls, '2026-09-01', '2026-09-20')).toEqual([]);
    const capped = expandEvent({ ...cls, until: '2026-09-23' }, '2026-09-21', '2026-10-30').map((i) => i.date);
    expect(capped).toEqual(['2026-09-21', '2026-09-23']);
  });
  it('weekly with no weekdays uses the start date weekday', () => {
    const e: CalEvent = { ...cls, weekdays: [] };
    expect(expandEvent(e, '2026-09-21', '2026-10-05').map((i) => i.date)).toEqual(['2026-09-21', '2026-09-28', '2026-10-05']);
  });
  it('one-off events only appear on their date', () => {
    const one: CalEvent = { id: 2, title: 'Robotics comp', kind: 'event', date: '2026-10-03', repeat: 'none' };
    expect(expandEvent(one, '2026-10-01', '2026-10-05')).toHaveLength(1);
    expect(expandEvent(one, '2026-10-04', '2026-10-05')).toHaveLength(0);
  });
});

describe('buildCalendarItems', () => {
  const tasks: Task[] = [
    { id: 1, subjectId: 1, title: 'HW', dueDate: '2026-09-24', status: 'todo', priority: 'med', source: 'manual' },
    { id: 2, subjectId: 1, title: 'No date', status: 'todo', priority: 'med', source: 'manual' },
  ];
  const milestones: Milestone[] = [{ id: 1, subjectId: 1, title: 'Checkpoint', date: '2026-09-24', kind: 'checkpoint', done: false }];
  const events: CalEvent[] = [{ id: 1, subjectId: 1, title: 'Class', kind: 'class', date: '2026-09-24', startTime: '08:00', repeat: 'none' }];

  it('merges sources, sorts all-day first then by time, skips undated tasks', () => {
    const items = buildCalendarItems({ events, tasks, milestones, subjects: [subject()] }, '2026-09-24', '2026-09-24');
    expect(items.map((i) => i.kind)).toEqual(['deadline', 'task', 'class']);
    const g = groupByDate(items);
    expect(g.get('2026-09-24')).toHaveLength(3);
  });
  it('adds a course exam date once (not when an exam event already exists)', () => {
    const s = subject({ examDate: '2026-09-24' });
    expect(buildCalendarItems({ events: [], tasks: [], milestones: [], subjects: [s] }, '2026-09-24', '2026-09-24').map((i) => i.kind)).toEqual(['exam']);
    const ex: CalEvent = { id: 9, subjectId: 1, title: 'Exam', kind: 'exam', date: '2026-09-24', repeat: 'none' };
    expect(buildCalendarItems({ events: [ex], tasks: [], milestones: [], subjects: [s] }, '2026-09-24', '2026-09-24')).toHaveLength(1);
  });
  it('filters by layer and hidden course', () => {
    const items = buildCalendarItems({ events, tasks, milestones, subjects: [subject()] }, '2026-09-24', '2026-09-24');
    const kinds = { class: true, event: true, exam: true, task: false, deadline: true };
    expect(filterItems(items, { kinds, hiddenSubjects: [] }).map((i) => i.kind)).toEqual(['deadline', 'class']);
    expect(filterItems(items, { kinds, hiddenSubjects: [1] })).toEqual([]);
  });
  it('time label', () => {
    expect(timeLabel({})).toBe('All day');
    expect(timeLabel({ startTime: '09:00', endTime: '09:45' })).toBe('09:00–09:45');
  });
});

describe('rankPriorities', () => {
  const T = '2026-09-24';
  const mk = (over: Partial<Task>): Task => ({ id: 1, subjectId: 1, title: 't', status: 'todo', priority: 'med', source: 'manual', ...over });
  it('overdue beats due-today beats later; high priority boosts; done is ignored', () => {
    const r = rankPriorities(
      {
        tasks: [
          mk({ id: 1, title: 'later', dueDate: '2026-10-20' }),
          mk({ id: 2, title: 'today', dueDate: T }),
          mk({ id: 3, title: 'overdue', dueDate: '2026-09-20' }),
          mk({ id: 4, title: 'done', dueDate: '2026-09-20', status: 'done' }),
          mk({ id: 5, title: 'soon+high', dueDate: '2026-09-26', priority: 'high' }),
        ],
        milestones: [],
        subjects: [],
        weak: [],
      },
      T,
    );
    expect(r.map((x) => x.title)).toEqual(['overdue', 'today', 'soon+high']);
    expect(r[0].reason).toBe('Overdue by 4 days');
  });
  it('includes near exams and weak spots, capped by limit', () => {
    const r = rankPriorities(
      {
        tasks: [],
        milestones: [],
        subjects: [subject({ examDate: '2026-10-01' })],
        weak: [{ topicId: 7, subjectId: 1, name: 'Chain rule', score: 4, reasons: ['marked shaky'] }],
      },
      T,
      1,
    );
    expect(r).toHaveLength(1);
    expect(r[0].title).toBe('Calc exam');
  });
});
