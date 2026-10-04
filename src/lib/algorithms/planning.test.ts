import { describe, expect, it } from 'vitest';
import { interleave, knowledgeMarkdown, milestoneBranch, milestoneState } from './planning';
import type { Milestone } from '@/lib/types';

const T = '2026-09-23';
const base: Milestone = {
  title: 'Checkpoint', date: '2027-01-28', kind: 'checkpoint', passThreshold: 60, onPass: 'go', onFail: 'redo', done: false,
};

describe('milestones', () => {
  it('states by date', () => {
    expect(milestoneState(base, T)).toBe('upcoming');
    expect(milestoneState({ ...base, date: '2026-09-30' }, T)).toBe('due-soon');
    expect(milestoneState({ ...base, date: '2026-09-01' }, T)).toBe('overdue');
    expect(milestoneState({ ...base, kind: 'deadline', done: true }, T)).toBe('done');
  });
  it('pass/fail branch at threshold', () => {
    expect(milestoneState({ ...base, result: 60 }, T)).toBe('passed');
    expect(milestoneBranch({ ...base, result: 60 })).toBe('go');
    expect(milestoneBranch({ ...base, result: 59 })).toBe('redo');
    expect(milestoneBranch(base)).toBeUndefined();
  });
});

describe('interleave', () => {
  it('round-robins groups', () => {
    const items = ['a1', 'a2', 'a3', 'b1', 'c1', 'c2'];
    expect(interleave(items, (s) => s[0])).toEqual(['a1', 'b1', 'c1', 'a2', 'c2', 'a3']);
  });
});

describe('knowledgeMarkdown', () => {
  it('groups cards by unit/topic and adds glossary', () => {
    const md = knowledgeMarkdown(
      'Calc',
      [{ id: 1, subjectId: 1, name: 'Limits', order: 1 }],
      [{ id: 5, subjectId: 1, unitId: 1, name: 'IVT', order: 1, status: 'learning', focus: 'none' }],
      [{ subjectId: 1, topicId: 5, text: 'Needs continuity', origin: 'manual', createdAt: T, starred: true }],
      [{ term: 'limit', definition: 'value approached' }],
      T,
    );
    expect(md).toContain('## Limits');
    expect(md).toContain('### IVT');
    expect(md).toContain('- ⭐ Needs continuity');
    expect(md).toContain('**limit**: value approached');
  });
});
