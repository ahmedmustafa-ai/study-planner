import { describe, expect, it } from 'vitest';
import { buildIcs, escapeText, foldLine, matchCourse, parseIcs, parseIcsDate, suggestKind, unescapeText } from './ics';
import type { CalEvent, Milestone, Subject, Task } from '@/lib/types';

const NOW = '2026-09-24T10:00:00.000Z';
const subject = (over: Partial<Subject> = {}): Subject => ({
  id: 1, academicYearId: 1, name: 'AP Calculus AB', color: '#000', kind: 'course', level: 'AP', examStatus: 'studying', languageLoad: false, ...over,
});

describe('text helpers', () => {
  it('escapes and unescapes', () => {
    const s = 'Room 4, floor 2; bring\nnotes \\ pens';
    expect(unescapeText(escapeText(s))).toBe(s);
    expect(escapeText('a,b;c')).toBe('a\\,b\\;c');
  });
  it('folds long lines at 75 characters and unfolds on parse', () => {
    const long = 'SUMMARY:' + 'x'.repeat(200);
    const folded = foldLine(long);
    expect(folded.split('\r\n').every((l) => l.length <= 75)).toBe(true);
    const ics = `BEGIN:VEVENT\r\nDTSTART:20260921\r\n${folded}\r\nEND:VEVENT`;
    expect(parseIcs(ics)[0].title).toBe('x'.repeat(200));
  });
});

describe('dates', () => {
  it('parses date, floating and UTC', () => {
    expect(parseIcsDate('20260921')).toEqual({ date: '2026-09-21' });
    expect(parseIcsDate('20260921T083000')).toEqual({ date: '2026-09-21', time: '08:30' });
    const utc = parseIcsDate('20260921T060000Z')!;
    const d = new Date(Date.UTC(2026, 8, 21, 6, 0));
    expect(utc.time).toBe(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
    expect(parseIcsDate('nonsense')).toBeNull();
  });
});

describe('export → import round trip', () => {
  const events: CalEvent[] = [
    { id: 1, subjectId: 1, title: 'Calc, period 3', kind: 'class', date: '2026-09-24', startTime: '08:30', endTime: '09:15', repeat: 'weekly', weekdays: [1, 3], until: '2026-12-18', location: 'Room 204' },
    { id: 2, title: 'Robotics meeting', kind: 'event', date: '2026-10-03', repeat: 'none' },
  ];
  const tasks: Task[] = [
    { id: 1, subjectId: 1, title: 'HW 2.3', dueDate: '2026-10-01', status: 'todo', priority: 'med', source: 'manual' },
    { id: 2, subjectId: 1, title: 'Done already', dueDate: '2026-10-02', status: 'done', priority: 'med', source: 'manual' },
    { id: 3, subjectId: 1, title: 'No date', status: 'todo', priority: 'med', source: 'manual' },
  ];
  const milestones: Milestone[] = [{ id: 1, subjectId: 1, title: 'Checkpoint', date: '2027-01-28', kind: 'checkpoint', done: false }];
  const ics = buildIcs({ events, tasks, milestones, subjects: [subject({ examDate: '2027-05-12' })] }, NOW);

  it('writes a valid calendar with CRLF endings', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(5); // 2 events + 1 open task + checkpoint + exam
    expect(ics).toContain('DTSTAMP:20260924T100000Z');
  });
  it('moves the first occurrence onto a chosen weekday and writes the repeat rule', () => {
    expect(ics).toContain('DTSTART:20260928T083000'); // 24 Sep is Thursday → first Mon/Wed on/after is Mon 28 Sep
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261218T235959');
    expect(ics).toContain('SUMMARY:Calc\\, period 3');
  });
  it('skips done and undated tasks', () => {
    expect(ics).toContain('SUMMARY:Due: HW 2.3');
    expect(ics).not.toContain('Done already');
    expect(ics).not.toContain('No date');
  });
  it('reads its own output back', () => {
    const back = parseIcs(ics);
    const cls = back.find((e) => e.title === 'Calc, period 3')!;
    expect(cls).toMatchObject({ date: '2026-09-28', startTime: '08:30', endTime: '09:15', repeat: 'weekly', weekdays: [1, 3], until: '2026-12-18', location: 'Room 204' });
    expect(back.find((e) => e.title === 'Robotics meeting')).toMatchObject({ date: '2026-10-03', repeat: 'none', startTime: undefined });
    expect(back.find((e) => e.title === 'AP Calculus AB exam')?.date).toBe('2027-05-12');
  });
});

describe('import edge cases', () => {
  const wrap = (body: string) => `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\n${body}\r\nEND:VEVENT\r\nEND:VCALENDAR`;
  it('ignores cancelled events and single edits inside a repeat', () => {
    expect(parseIcs(wrap('DTSTART:20260921\r\nSTATUS:CANCELLED\r\nSUMMARY:x'))).toEqual([]);
    expect(parseIcs(wrap('DTSTART:20260921\r\nRECURRENCE-ID:20260921\r\nSUMMARY:x'))).toEqual([]);
  });
  it('warns on rules it cannot repeat and imports the first date', () => {
    const [e] = parseIcs(wrap('DTSTART:20260921T090000\r\nRRULE:FREQ=DAILY\r\nSUMMARY:Standup'));
    expect(e.repeat).toBe('none');
    expect(e.warnings[0]).toMatch(/not supported/);
    const [b] = parseIcs(wrap('DTSTART:20260921T090000\r\nRRULE:FREQ=WEEKLY;INTERVAL=2\r\nSUMMARY:Biweekly'));
    expect(b.repeat).toBe('none');
  });
  it('turns COUNT into an end date', () => {
    const [e] = parseIcs(wrap('DTSTART:20260921T090000\r\nRRULE:FREQ=WEEKLY;COUNT=3;BYDAY=MO\r\nSUMMARY:Lab'));
    expect(e.until).toBe('2026-10-05');
  });
  it('handles TZID dates and multi-day all-day events', () => {
    const [t] = parseIcs(wrap('DTSTART;TZID=Asia/Dubai:20260921T083000\r\nDTEND;TZID=Asia/Dubai:20260921T093000\r\nSUMMARY:Class'));
    expect(t).toMatchObject({ startTime: '08:30', endTime: '09:30' });
    const [m] = parseIcs(wrap('DTSTART;VALUE=DATE:20261010\r\nDTEND;VALUE=DATE:20261014\r\nSUMMARY:Trip'));
    expect(m.warnings[0]).toMatch(/Multi-day/);
  });
  it('ignores entries with no start date', () => {
    expect(parseIcs(wrap('SUMMARY:No start'))).toEqual([]);
  });
});

describe('suggestKind / matchCourse', () => {
  it('guesses what an entry is', () => {
    expect(suggestKind({ title: 'Chemistry unit test', repeat: 'none' })).toBe('exam');
    expect(suggestKind({ title: 'Assignment: Limits worksheet', repeat: 'none' })).toBe('task');
    expect(suggestKind({ title: 'Physics', startTime: '09:00', repeat: 'weekly' })).toBe('class');
    expect(suggestKind({ title: 'Robotics meeting', startTime: '15:00', repeat: 'none' })).toBe('event');
  });
  it('matches a course by name or code, longest first', () => {
    const subs = [subject({ id: 1, name: 'Physics' }), subject({ id: 2, name: 'AP Physics 1', code: 'PHY-AP' })];
    expect(matchCourse('AP Physics 1 — lab', subs)).toBe(2);
    expect(matchCourse('physics homework', subs)).toBe(1);
    expect(matchCourse('Art', subs)).toBeUndefined();
  });
});
