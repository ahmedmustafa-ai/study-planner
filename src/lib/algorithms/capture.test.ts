import { describe, expect, it } from 'vitest';
import { captureCount, normalizeCause, parseCapture } from './capture';

describe('parseCapture', () => {
  it('parses a clean block and ignores text before it', () => {
    const r = parseCapture(`Here is the explanation...
TAKEAWAY: not this one
===STUDYOS===
TAKEAWAY: The derivative is the slope of the tangent line.
TERM: tangent line | a line that touches a curve at one point
MISTAKE: Forgot the chain rule on sin(2x) | concept
NEXT: Do 5 chain rule problems
===END===`);
    expect(r.foundBlock).toBe(true);
    expect(r.takeaways).toEqual(['The derivative is the slope of the tangent line.']);
    expect(r.terms).toEqual([{ term: 'tangent line', definition: 'a line that touches a curve at one point' }]);
    expect(r.mistakes).toEqual([{ text: 'Forgot the chain rule on sin(2x)', cause: 'concept' }]);
    expect(r.next).toEqual(['Do 5 chain rule problems']);
    expect(captureCount(r)).toBe(4);
  });
  it('tolerates markdown bullets, bold and missing END', () => {
    const r = parseCapture(`===STUDYOS===
- **TAKEAWAY:** Osmosis moves water
* **TERM**: solute - the substance that dissolves
1. MISTAKE: Confused hypotonic with hypertonic | English word`);
    expect(r.takeaways).toEqual(['Osmosis moves water']);
    expect(r.terms[0]).toEqual({ term: 'solute', definition: 'the substance that dissolves' });
    expect(r.mistakes[0].cause).toBe('vocab');
  });
  it('falls back to whole text when no block marker', () => {
    const r = parseCapture('TAKEAWAY: a\nNEXT: b');
    expect(r.foundBlock).toBe(false);
    expect(captureCount(r)).toBe(2);
  });
  it('skips unfilled template placeholders', () => {
    expect(captureCount(parseCapture('===STUDYOS===\nTAKEAWAY: <one key idea>\n===END==='))).toBe(0);
  });
  it('normalizes causes', () => {
    expect(normalizeCause('misread the question')).toBe('misread');
    expect(normalizeCause('sign error')).toBe('careless');
    expect(normalizeCause('ran out of time')).toBe('time');
    expect(normalizeCause(undefined)).toBe('concept');
  });
});
