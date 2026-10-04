import { describe, expect, it } from 'vitest';
import { afterRevisit, dueRevisits, firstRevisit, REVISIT_STEPS } from './revisit';
import { rankPriorities } from './priorities';
import type { Topic } from '@/lib/types';

const T = '2026-09-24';
const topic = (id: number, over: Partial<Topic> = {}): Topic => ({ id, subjectId: 1, unitId: 1, name: `T${id}`, order: id, status: 'solid', focus: 'none', ...over });

describe('revisit schedule', () => {
  it('first revisit is 3 days out', () => {
    expect(firstRevisit(T)).toEqual({ interval: 3, nextReview: '2026-09-27' });
  });
  it('still solid → the wait grows step by step and stops at the last step', () => {
    let interval: number | undefined = undefined;
    const seen: number[] = [];
    for (let i = 0; i < 8; i++) {
      const r = afterRevisit(interval, true, T);
      if (r.status !== 'solid') throw new Error('unexpected');
      interval = r.interval;
      seen.push(r.interval);
    }
    expect(seen).toEqual([3, 7, 14, 30, 60, 90, 90, 90]);
    expect(REVISIT_STEPS[REVISIT_STEPS.length - 1]).toBe(90);
  });
  it('forgot it → shaky and unscheduled', () => {
    expect(afterRevisit(30, false, T)).toEqual({ status: 'shaky', interval: undefined, nextReview: undefined });
  });
});

describe('dueRevisits', () => {
  it('lists only solid topics that are due, most overdue first', () => {
    const list = dueRevisits(
      [
        topic(1, { nextReview: '2026-09-20' }), // 4 days overdue
        topic(2, { nextReview: T }), // due today
        topic(3, { nextReview: '2026-09-30' }), // later
        topic(4, { status: 'shaky', nextReview: '2026-09-01' }), // not solid
        topic(5, { lastTouched: '2026-09-10' }), // never scheduled, touched 14 days ago → due
        topic(6, { lastTouched: '2026-09-23' }), // never scheduled, touched yesterday → not yet
        topic(7), // no info at all
      ],
      T,
    );
    expect(list.map((x) => x.topicId)).toEqual([5, 1, 2]);
    expect(list.find((x) => x.topicId === 1)?.overdueDays).toBe(4);
  });
});

describe('priorities with revisits', () => {
  it('a due revisit outranks a weak spot but not an overdue task', () => {
    const r = rankPriorities(
      {
        tasks: [{ id: 1, subjectId: 1, title: 'overdue hw', dueDate: '2026-09-20', status: 'todo', priority: 'med', source: 'manual' }],
        milestones: [],
        subjects: [],
        weak: [{ topicId: 9, subjectId: 1, name: 'weak', score: 4, reasons: ['marked shaky'] }],
        revisit: [{ topicId: 1, subjectId: 1, name: 'Chain rule', overdueDays: 3 }],
      },
      T,
    );
    expect(r.map((x) => x.title)).toEqual(['overdue hw', 'Revisit: Chain rule', 'Review: weak']);
    expect(r[1].reason).toBe('Due for revisit · 3 days late');
    expect(r[1].to).toBe('/topics/1');
  });
});
