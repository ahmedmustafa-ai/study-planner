// SM-2 spaced repetition — pure, framework-free.
import { SM2 } from '@/config';

export type Rating = keyof typeof SM2.quality; // 'again' | 'hard' | 'good' | 'easy'

export interface Sm2State {
  easeFactor: number;
  interval: number; // days
  repetitions: number;
  nextReview: string; // YYYY-MM-DD
}

export function initialSm2(todayIso: string): Sm2State {
  return { easeFactor: SM2.initialEase, interval: 0, repetitions: 0, nextReview: todayIso };
}

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function reviewSm2(state: Sm2State, rating: Rating, todayIso: string): Sm2State {
  const q = SM2.quality[rating];
  // Standard SM-2 ease update, clamped.
  const ease = Math.max(SM2.minEase, state.easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  if (q < 3) {
    // Lapse: start over, see it again tomorrow.
    return { easeFactor: ease, interval: SM2.firstInterval, repetitions: 0, nextReview: addDaysIso(todayIso, SM2.firstInterval) };
  }

  const repetitions = state.repetitions + 1;
  let interval: number;
  if (repetitions === 1) interval = SM2.firstInterval;
  else if (repetitions === 2) interval = SM2.secondInterval;
  else interval = Math.round(state.interval * ease);

  if (rating === 'hard') interval = Math.max(1, Math.round((repetitions <= 2 ? interval : state.interval * SM2.hardFactor)));
  if (rating === 'easy') interval = Math.round(interval * SM2.easyBonus);
  interval = Math.max(1, interval);

  return { easeFactor: ease, interval, repetitions, nextReview: addDaysIso(todayIso, interval) };
}

export function isDue(state: Pick<Sm2State, 'nextReview'>, todayIso: string): boolean {
  return state.nextReview <= todayIso;
}
