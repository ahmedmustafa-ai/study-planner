// When to remind the student to back up. Pure.

/** Days between backup reminders: every 2 days during the first 2 weeks of use, then weekly. */
export const BACKUP_EARLY_DAYS = 2;
export const BACKUP_NORMAL_DAYS = 7;
export const EARLY_PERIOD_DAYS = 14;

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

export function backupIntervalDays(firstRunIso: string | undefined, todayIso: string): number {
  if (!firstRunIso) return BACKUP_EARLY_DAYS;
  return daysBetween(firstRunIso, todayIso) < EARLY_PERIOD_DAYS ? BACKUP_EARLY_DAYS : BACKUP_NORMAL_DAYS;
}

/** True when the last backup is older than the current interval (or there has never been one). */
export function backupDue(lastBackupIso: string | undefined, firstRunIso: string | undefined, todayIso: string): boolean {
  if (!lastBackupIso) return true;
  return daysBetween(lastBackupIso, todayIso) >= backupIntervalDays(firstRunIso, todayIso);
}
