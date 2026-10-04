import { describe, expect, it } from 'vitest';
import { initialSm2, isDue, reviewSm2 } from './sm2';

const T = '2026-09-23';

describe('sm2', () => {
  it('starts due today', () => {
    expect(isDue(initialSm2(T), T)).toBe(true);
  });
  it('good → 1 day, then 6 days, then grows by ease', () => {
    let s = reviewSm2(initialSm2(T), 'good', T);
    expect(s.interval).toBe(1);
    expect(s.nextReview).toBe('2026-09-24');
    s = reviewSm2(s, 'good', s.nextReview);
    expect(s.interval).toBe(6);
    s = reviewSm2(s, 'good', s.nextReview);
    expect(s.interval).toBe(Math.round(6 * s.easeFactor));
  });
  it('again resets repetitions and lowers ease', () => {
    let s = reviewSm2(initialSm2(T), 'good', T);
    s = reviewSm2(s, 'good', T);
    const lapsed = reviewSm2(s, 'again', T);
    expect(lapsed.repetitions).toBe(0);
    expect(lapsed.interval).toBe(1);
    expect(lapsed.easeFactor).toBeLessThan(s.easeFactor);
  });
  it('ease never drops below 1.3', () => {
    let s = initialSm2(T);
    for (let i = 0; i < 20; i++) s = reviewSm2(s, 'again', T);
    expect(s.easeFactor).toBeGreaterThanOrEqual(1.3);
  });
  it('easy gives a longer interval than good', () => {
    const base = reviewSm2(reviewSm2(initialSm2(T), 'good', T), 'good', T);
    expect(reviewSm2(base, 'easy', T).interval).toBeGreaterThan(reviewSm2(base, 'good', T).interval);
  });
});
