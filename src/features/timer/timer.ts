import { useEffect, useState } from 'react';
import { db, getSetting, setSetting, touchTopic } from '@/lib/db';
import { useSetting } from '@/lib/hooks';
import { elapsedSeconds } from '@/lib/algorithms/timer';

export interface TimerState {
  subjectId: number;
  topicId?: number;
  startedAt: string; // ISO — the clock is computed from this, so it stays right if the phone sleeps or the app closes
}

/** Returns false if a timer is already running. */
export async function startTimer(subjectId: number, topicId?: number): Promise<boolean> {
  if (await getSetting<TimerState | null>('timer', null)) return false;
  await setSetting('timer', { subjectId, topicId, startedAt: new Date().toISOString() } satisfies TimerState);
  return true;
}

export const clearTimer = () => db.settings.delete('timer');

export async function saveSession(s: { subjectId: number; topicId?: number; minutes: number; date: string; note?: string }) {
  await db.studySessions.add({ subjectId: s.subjectId, topicId: s.topicId, minutes: Math.round(s.minutes), date: s.date, note: s.note?.trim() || undefined });
  await touchTopic(s.topicId);
}

/** The running timer, plus seconds elapsed (ticks once a second only while it runs). */
export function useTimer(): { state: TimerState | null; seconds: number } {
  const state = useSetting<TimerState | null>('timer', null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!state) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state]);
  return { state, seconds: state ? elapsedSeconds(state.startedAt, now) : 0 };
}
