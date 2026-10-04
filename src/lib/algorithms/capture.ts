// Capture Block parser — turns an AI reply into structured items. Pure, tolerant of markdown noise.
import { CAPTURE_END, CAPTURE_START } from '@/config';
import type { MistakeCause } from '@/lib/types';

export interface CaptureResult {
  takeaways: string[];
  terms: { term: string; definition: string }[];
  mistakes: { text: string; cause: MistakeCause }[];
  next: string[];
  foundBlock: boolean;
}

const CAUSES: MistakeCause[] = ['concept', 'vocab', 'misread', 'careless', 'time'];

export function normalizeCause(raw: string | undefined): MistakeCause {
  const s = (raw ?? '').toLowerCase();
  if (/vocab|word|english|language|term/.test(s)) return 'vocab';
  if (/misread|read/.test(s)) return 'misread';
  if (/careless|slip|arithmetic|sign/.test(s)) return 'careless';
  if (/time|slow/.test(s)) return 'time';
  const exact = CAUSES.find((c) => s.includes(c));
  return exact ?? 'concept';
}

function splitPair(s: string): [string, string] {
  for (const sep of ['|', ' – ', ' — ', ' - ', ': ']) {
    const i = s.indexOf(sep);
    if (i > 0) return [s.slice(0, i).trim(), s.slice(i + sep.length).trim()];
  }
  return [s.trim(), ''];
}

function clean(line: string): string {
  return line
    .replace(/^\s*(?:[-*•>]|\d+[.)])\s*/, '') // bullets / numbering
    .replace(/\*\*|__|`/g, '') // bold / code marks
    .trim();
}

export function parseCapture(text: string): CaptureResult {
  let body = text;
  const start = text.lastIndexOf(CAPTURE_START);
  const foundBlock = start !== -1;
  if (foundBlock) {
    body = text.slice(start + CAPTURE_START.length);
    const end = body.indexOf(CAPTURE_END);
    if (end !== -1) body = body.slice(0, end);
  }

  const result: CaptureResult = { takeaways: [], terms: [], mistakes: [], next: [], foundBlock };
  for (const rawLine of body.split(/\r?\n/)) {
    const line = clean(rawLine);
    const m = line.match(/^(TAKEAWAYS?|TERMS?|MISTAKES?|NEXT(?:\s*STEPS?)?)\s*[:：]\s*(.+)$/i);
    if (!m) continue;
    const key = m[1].toUpperCase();
    const value = m[2].trim();
    if (!value || /^<.*>$/.test(value)) continue; // skip unfilled template lines
    if (key.startsWith('TAKEAWAY')) result.takeaways.push(value);
    else if (key.startsWith('TERM')) {
      const [term, definition] = splitPair(value);
      if (term) result.terms.push({ term, definition });
    } else if (key.startsWith('MISTAKE')) {
      const bar = value.lastIndexOf('|');
      const textPart = bar === -1 ? value : value.slice(0, bar).trim();
      const causePart = bar === -1 ? undefined : value.slice(bar + 1);
      result.mistakes.push({ text: textPart, cause: normalizeCause(causePart) });
    } else if (key.startsWith('NEXT')) result.next.push(value);
  }
  return result;
}

export function captureCount(r: CaptureResult): number {
  return r.takeaways.length + r.terms.length + r.mistakes.length + r.next.length;
}
