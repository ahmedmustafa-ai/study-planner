import { describe, expect, it } from 'vitest';
import { detectWeakSpots, readiness } from './weakSpots';
import type { Mistake, Score, Topic } from '@/lib/types';

const T = '2026-09-23';
const topic = (id: number, status: Topic['status']): Topic => ({
  id, subjectId: 1, unitId: 1, name: `T${id}`, order: id, status, focus: 'none',
});

describe('detectWeakSpots', () => {
  it('ranks shaky + open mistakes + low scores highest', () => {
    const topics = [topic(1, 'solid'), topic(2, 'shaky'), topic(3, 'learning'), topic(4, 'not_started')];
    const mistakes: Mistake[] = [
      { subjectId: 1, topicId: 3, text: 'x', cause: 'concept', date: T, fixed: false },
      { subjectId: 1, topicId: 3, text: 'y', cause: 'vocab', date: T, fixed: false },
    ];
    const scores: Score[] = [{ subjectId: 1, topicId: 2, label: 'Quiz', date: T, score: 4, max: 10 }];
    const r = detectWeakSpots(topics, mistakes, scores, T);
    expect(r.map((w) => w.topicId)).toEqual([2, 3]);
    expect(r[0].reasons).toContain('Quiz: 40%');
    expect(r[1].reasons).toContain('2 open mistakes');
  });
  it('old fixed mistakes barely count', () => {
    const r = detectWeakSpots(
      [topic(1, 'learning')],
      [{ subjectId: 1, topicId: 1, text: 'x', cause: 'concept', date: '2026-01-01', fixed: true }],
      [],
      T,
    );
    expect(r[0].score).toBeLessThan(1.1);
  });
  it('ignores untouched not-started topics', () => {
    expect(detectWeakSpots([topic(1, 'not_started')], [], [], T)).toEqual([]);
  });
  it('readiness', () => {
    expect(readiness([topic(1, 'solid'), topic(2, 'shaky')])).toEqual({ solid: 1, total: 2, percent: 50 });
  });
});
