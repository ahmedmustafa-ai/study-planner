import { describe, expect, it } from 'vitest';
import { elapsedSeconds, formatClock, formatDuration, suggestedMinutes, summarizeSessions } from './timer';
import type { StudySession } from '@/lib/types';

describe('clock and duration', () => {
  it('formats', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(754)).toBe('12:34');
    expect(formatClock(3725)).toBe('1:02:05');
    expect(formatDuration(45)).toBe('45m');
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(95)).toBe('1h 35m');
  });
  it('elapsed never goes negative and uses the saved start time', () => {
    const start = '2026-09-24T10:00:00.000Z';
    expect(elapsedSeconds(start, Date.parse(start) + 754_000)).toBe(754);
    expect(elapsedSeconds(start, Date.parse(start) - 5_000)).toBe(0);
  });
  it('suggests at least one minute, rounded', () => {
    expect(suggestedMinutes(10)).toBe(1);
    expect(suggestedMinutes(89)).toBe(1);
    expect(suggestedMinutes(91)).toBe(2);
    expect(suggestedMinutes(3600)).toBe(60);
  });
});

describe('summarizeSessions', () => {
  const s = (subjectId: number, date: string, minutes: number): StudySession => ({ subjectId, date, minutes });
  const sessions = [s(1, '2026-09-20', 60), s(1, '2026-09-21', 30), s(2, '2026-09-21', 30), s(3, '2026-08-01', 500)];
  it('sums per course inside the range, biggest first', () => {
    const r = summarizeSessions(sessions, '2026-09-18', '2026-09-24');
    expect(r.total).toBe(120);
    expect(r.bySubject).toEqual([{ subjectId: 1, minutes: 90 }, { subjectId: 2, minutes: 30 }]);
    expect(r.days).toBe(2);
    expect(r.topShare).toBeCloseTo(0.75);
  });
  it('handles no sessions', () => {
    expect(summarizeSessions([], '2026-09-18', '2026-09-24')).toEqual({ total: 0, bySubject: [], days: 0, topShare: 0 });
  });
});
