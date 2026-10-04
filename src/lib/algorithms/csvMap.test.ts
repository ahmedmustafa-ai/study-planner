import { describe, expect, it } from 'vitest';
import { guessMapping, mapRows, parseLooseDate, parsePriority } from './csvMap';

describe('parseLooseDate', () => {
  it.each([
    ['2026-10-05', '2026-10-05'],
    ['2026-10-05T23:59:00Z', '2026-10-05'],
    ['10/5/2026', '2026-10-05'],
    ['5.10.2026', '2026-10-05'],
    ['Oct 5, 2026', '2026-10-05'],
    ['5 October 2026', '2026-10-05'],
    ['', undefined],
    ['soon', undefined],
  ])('%s', (input, out) => expect(parseLooseDate(input)).toBe(out));
});

describe('mapping', () => {
  it('guesses columns', () => {
    expect(guessMapping(['Class', 'Assignment Title', 'Due Date'])).toEqual({
      title: 'Assignment Title', dueDate: 'Due Date', subject: 'Class', priority: undefined,
    });
  });
  it('maps rows, matches subjects, warns on bad data', () => {
    const subjects = [{ id: 1, name: 'AP Calculus AB' }, { id: 2, name: 'Chemistry' }];
    const r = mapRows(
      [
        { T: 'HW 2.3', D: '10/1/2026', S: 'chemistry', P: 'High' },
        { T: 'Lab', D: 'someday', S: 'Art', P: '' },
        { T: '', D: '', S: '', P: '' },
      ],
      { title: 'T', dueDate: 'D', subject: 'S', priority: 'P' },
      subjects,
      1,
    );
    expect(r).toHaveLength(2);
    expect(r[0].task).toMatchObject({ title: 'HW 2.3', dueDate: '2026-10-01', subjectId: 2, priority: 'high', source: 'csv' });
    expect(r[1].task.subjectId).toBe(1);
    expect(r[1].warnings).toHaveLength(2);
    expect(parsePriority('low')).toBe('low');
  });
});
