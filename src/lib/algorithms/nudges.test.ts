import { describe, expect, it } from 'vitest';
import { backupDue, backupIntervalDays } from './nudges';

describe('backup reminders', () => {
  it('every 2 days in the first 2 weeks, then weekly', () => {
    expect(backupIntervalDays('2026-09-24', '2026-09-30')).toBe(2);
    expect(backupIntervalDays('2026-09-24', '2026-10-07')).toBe(2); // day 13
    expect(backupIntervalDays('2026-09-24', '2026-10-08')).toBe(7); // day 14
    expect(backupIntervalDays(undefined, '2026-09-24')).toBe(2);
  });
  it('is due when the last backup is older than the interval, or missing', () => {
    expect(backupDue(undefined, '2026-09-24', '2026-09-25')).toBe(true);
    expect(backupDue('2026-09-24', '2026-09-24', '2026-09-25')).toBe(false); // 1 day, early period
    expect(backupDue('2026-09-24', '2026-09-24', '2026-09-26')).toBe(true); // 2 days, early period
    expect(backupDue('2026-10-10', '2026-09-24', '2026-10-16')).toBe(false); // 6 days, normal period
    expect(backupDue('2026-10-10', '2026-09-24', '2026-10-17')).toBe(true); // 7 days
  });
});
