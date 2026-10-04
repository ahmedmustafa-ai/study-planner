import { describe, expect, it } from 'vitest';
import { DEFAULT_HOME_LAYOUT, moveSection, normalizeLayout, toggleSection } from './homeLayout';

describe('home layout', () => {
  it('defaults when nothing is saved', () => {
    expect(normalizeLayout(undefined)).toEqual(DEFAULT_HOME_LAYOUT);
    expect(normalizeLayout('junk')).toEqual(DEFAULT_HOME_LAYOUT);
  });
  it('keeps saved order and visibility, drops unknown/duplicate ids, appends new sections', () => {
    const saved = [
      { id: 'vocab', visible: false },
      { id: 'quick', visible: true },
      { id: 'quick', visible: false },
      { id: 'nope', visible: true },
    ];
    const out = normalizeLayout(saved);
    expect(out.slice(0, 2)).toEqual([{ id: 'vocab', visible: false }, { id: 'quick', visible: true }]);
    expect(out).toHaveLength(DEFAULT_HOME_LAYOUT.length);
    expect(new Set(out.map((s) => s.id)).size).toBe(DEFAULT_HOME_LAYOUT.length);
  });
  it('moves and toggles without mutating', () => {
    const base = DEFAULT_HOME_LAYOUT;
    const moved = moveSection(base, 1, -1);
    expect(moved[0].id).toBe(base[1].id);
    expect(base[0].id).toBe('quick');
    expect(moveSection(base, 0, -1)).toBe(base);
    expect(toggleSection(base, 'vocab', false).find((s) => s.id === 'vocab')?.visible).toBe(false);
  });
});
