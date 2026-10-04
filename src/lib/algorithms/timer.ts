// Study-time maths — pure.
import type { StudySession } from '@/lib/types';

export function elapsedSeconds(startedAtIso: string, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - Date.parse(startedAtIso)) / 1000));
}

/** 754 → "12:34", 3725 → "1:02:05" */
export function formatClock(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** 95 → "1h 35m", 60 → "1h", 45 → "45m" */
export function formatDuration(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

export const suggestedMinutes = (seconds: number) => Math.max(1, Math.round(seconds / 60));

export interface TimeSummary {
  total: number; // minutes
  bySubject: { subjectId: number; minutes: number }[]; // biggest first
  days: number; // distinct days with study time
  topShare: number; // share (0–1) of the biggest course; 0 when there is no time
}

export function summarizeSessions(sessions: StudySession[], from: string, to: string): TimeSummary {
  const inRange = sessions.filter((s) => s.date >= from && s.date <= to);
  const by = new Map<number, number>();
  for (const s of inRange) by.set(s.subjectId, (by.get(s.subjectId) ?? 0) + s.minutes);
  const bySubject = [...by.entries()].map(([subjectId, minutes]) => ({ subjectId, minutes })).sort((a, b) => b.minutes - a.minutes);
  const total = bySubject.reduce((n, x) => n + x.minutes, 0);
  return {
    total,
    bySubject,
    days: new Set(inRange.map((s) => s.date)).size,
    topShare: total ? bySubject[0].minutes / total : 0,
  };
}
