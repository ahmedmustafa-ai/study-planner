// iCalendar (.ics) export + import — pure. Lets Google Calendar / phone calendars show Study OS items and vice versa.
import type { CalEvent, Milestone, Subject, Task } from '@/lib/types';
import { addDaysISO, weekdayOf } from './calendar';

const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

// ---------- text helpers ----------
export function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}
export function unescapeText(s: string): string {
  return s.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}
/** Lines longer than 75 characters continue on the next line, which starts with a space. */
export function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts = [line.slice(0, 75)];
  for (let i = 75; i < line.length; i += 74) parts.push(' ' + line.slice(i, i + 74));
  return parts.join('\r\n');
}

const dateC = (iso: string) => iso.replace(/-/g, '');
const timeC = (t: string) => t.replace(':', '') + '00';
const stamp = (nowIso: string) => nowIso.replace(/[-:]/g, '').replace(/\.\d+/, '').replace(/Z?$/, 'Z').slice(0, 16);

function addMinutes(t: string, mins: number): string {
  const [h, m] = t.split(':').map(Number);
  const total = Math.min(23 * 60 + 59, h * 60 + m + mins);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** First day on or after `date` that falls on one of the weekdays. */
function firstOccurrence(e: CalEvent): string {
  if (e.repeat !== 'weekly') return e.date;
  const days = e.weekdays?.length ? e.weekdays : [weekdayOf(e.date)];
  for (let i = 0; i < 7; i++) {
    const d = addDaysISO(e.date, i);
    if (days.includes(weekdayOf(d))) return d;
  }
  return e.date;
}

// ---------- export ----------
export interface IcsSource {
  events: CalEvent[];
  tasks: Task[];
  milestones: Milestone[];
  subjects: Subject[];
}

export function buildIcs(src: IcsSource, nowIso: string): string {
  const subjectName = new Map(src.subjects.map((s) => [s.id!, s.name]));
  const lines: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Study OS//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Study OS'];
  const dtstamp = stamp(nowIso);

  const allDayEvent = (uid: string, date: string, summary: string, description?: string) => {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${dateC(date)}`,
      `DTEND;VALUE=DATE:${dateC(addDaysISO(date, 1))}`,
      `SUMMARY:${escapeText(summary)}`,
    );
    if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
    lines.push('END:VEVENT');
  };

  for (const e of src.events) {
    const start = firstOccurrence(e);
    const course = e.subjectId != null ? subjectName.get(e.subjectId) : undefined;
    lines.push('BEGIN:VEVENT', `UID:${e.uid ?? `event-${e.id}@studyos`}`, `DTSTAMP:${dtstamp}`);
    if (e.startTime) {
      lines.push(`DTSTART:${dateC(start)}T${timeC(e.startTime)}`, `DTEND:${dateC(start)}T${timeC(e.endTime && e.endTime > e.startTime ? e.endTime : addMinutes(e.startTime, 60))}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${dateC(start)}`, `DTEND;VALUE=DATE:${dateC(addDaysISO(start, 1))}`);
    }
    if (e.repeat === 'weekly') {
      const days = (e.weekdays?.length ? e.weekdays : [weekdayOf(e.date)]).map((d) => BYDAY[d]).join(',');
      const until = e.until ? `;UNTIL=${dateC(e.until)}${e.startTime ? 'T235959' : ''}` : '';
      lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${days}${until}`);
    }
    lines.push(`SUMMARY:${escapeText(e.title)}`);
    if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
    const desc = [course, e.note].filter(Boolean).join(' — ');
    if (desc) lines.push(`DESCRIPTION:${escapeText(desc)}`);
    lines.push(`CATEGORIES:${e.kind}`, 'END:VEVENT');
  }

  for (const t of src.tasks) {
    if (!t.dueDate || t.status === 'done') continue;
    const course = subjectName.get(t.subjectId);
    allDayEvent(`task-${t.id}@studyos`, t.dueDate, `Due: ${t.title}`, course);
  }
  for (const m of src.milestones) {
    if (m.done || (m.kind === 'checkpoint' && m.result != null)) continue;
    allDayEvent(`milestone-${m.id}@studyos`, m.date, m.title, m.subjectId != null ? subjectName.get(m.subjectId) : undefined);
  }
  for (const s of src.subjects) {
    if (!s.examDate || s.archived || s.examStatus === 'completed') continue;
    if (src.events.some((e) => e.kind === 'exam' && e.subjectId === s.id && e.date === s.examDate)) continue;
    allDayEvent(`exam-${s.id}@studyos`, s.examDate, `${s.name} exam`);
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

// ---------- import ----------
export interface ParsedIcsEvent {
  uid?: string;
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  repeat: 'none' | 'weekly';
  weekdays?: number[];
  until?: string;
  location?: string;
  note?: string;
  warnings: string[];
}

interface Stamp {
  date: string;
  time?: string;
}

/** 20260921 · 20260921T083000 · 20260921T083000Z (UTC → converted to this device's local time). */
export function parseIcsDate(value: string): Stamp | null {
  const m = value.trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, , z] = m;
  if (h == null) return { date: `${y}-${mo}-${d}` };
  if (z) {
    const dt = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi));
    const pad = (n: number) => String(n).padStart(2, '0');
    return { date: `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`, time: `${pad(dt.getHours())}:${pad(dt.getMinutes())}` };
  }
  return { date: `${y}-${mo}-${d}`, time: `${h}:${mi}` };
}

function parseRule(rule: string, start: string): { repeat: 'none' | 'weekly'; weekdays?: number[]; until?: string; warning?: string } {
  const parts = Object.fromEntries(rule.split(';').map((p) => p.split('=') as [string, string]));
  const interval = Number(parts.INTERVAL ?? 1);
  if (parts.FREQ !== 'WEEKLY' || interval !== 1) return { repeat: 'none', warning: 'Repeat rule not supported — imported as a single event' };
  const weekdays = parts.BYDAY ? parts.BYDAY.split(',').map((d) => BYDAY.indexOf(d.replace(/[^A-Z]/g, ''))).filter((n) => n >= 0) : [weekdayOf(start)];
  let until: string | undefined;
  if (parts.UNTIL) until = parseIcsDate(parts.UNTIL)?.date;
  else if (parts.COUNT) {
    let seen = 0;
    let d = start;
    for (let i = 0; i < 366 * 3 && seen < Number(parts.COUNT); i++, d = addDaysISO(d, 1)) if (weekdays.includes(weekdayOf(d))) (seen++, (until = d));
  }
  return { repeat: 'weekly', weekdays: weekdays.length ? weekdays : [weekdayOf(start)], until };
}

export function parseIcs(text: string): ParsedIcsEvent[] {
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const out: ParsedIcsEvent[] = [];
  let cur: Record<string, { params: string; value: string }> | null = null;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line === 'BEGIN:VEVENT') {
      cur = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (cur) {
        const ev = finish(cur);
        if (ev) out.push(ev);
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const head = line.slice(0, colon);
    const semi = head.indexOf(';');
    const name = (semi < 0 ? head : head.slice(0, semi)).toUpperCase();
    cur[name] = { params: semi < 0 ? '' : head.slice(semi + 1), value: line.slice(colon + 1) };
  }
  return out;
}

function finish(p: Record<string, { params: string; value: string }>): ParsedIcsEvent | null {
  if (p.STATUS?.value.toUpperCase() === 'CANCELLED' || p['RECURRENCE-ID']) return null; // cancelled, or a one-off change to a repeat
  const start = p.DTSTART ? parseIcsDate(p.DTSTART.value) : null;
  if (!start) return null;
  const warnings: string[] = [];
  const end = p.DTEND ? parseIcsDate(p.DTEND.value) : null;

  let endTime: string | undefined;
  if (start.time && end?.time && end.date === start.date && end.time > start.time) endTime = end.time;
  if (!start.time && end && end.date > addDaysISO(start.date, 1)) warnings.push('Multi-day event — only the first day is imported');
  if (start.time && end && end.date !== start.date) warnings.push('Runs past midnight — end time skipped');

  let repeat: ParsedIcsEvent['repeat'] = 'none';
  let weekdays: number[] | undefined;
  let until: string | undefined;
  if (p.RRULE) {
    const r = parseRule(p.RRULE.value, start.date);
    repeat = r.repeat;
    weekdays = r.weekdays;
    until = r.until;
    if (r.warning) warnings.push(r.warning);
  }

  return {
    uid: p.UID?.value,
    title: unescapeText(p.SUMMARY?.value ?? '').trim() || 'Untitled',
    date: start.date,
    startTime: start.time,
    endTime,
    repeat,
    weekdays,
    until,
    location: p.LOCATION ? unescapeText(p.LOCATION.value).trim() || undefined : undefined,
    note: p.DESCRIPTION ? unescapeText(p.DESCRIPTION.value).trim().slice(0, 500) || undefined : undefined,
    warnings,
  };
}

// ---------- import helpers ----------
export type ImportKind = 'class' | 'event' | 'exam' | 'task';

/** Best guess for what an imported entry is. The student can change it in the preview. */
export function suggestKind(e: Pick<ParsedIcsEvent, 'title' | 'startTime' | 'repeat'>): ImportKind {
  const t = e.title.toLowerCase();
  if (/\b(exam|midterm|final|test|quiz)\b/.test(t)) return 'exam';
  if (!e.startTime && e.repeat === 'none' && (/\b(assignment|homework|hw|due|submit|project|worksheet|essay|lab report)\b/.test(t) || t.startsWith('due'))) return 'task';
  if (e.repeat === 'weekly' && e.startTime) return 'class';
  return 'event';
}

/** Course whose name (or code) appears in the text. Longest match wins. */
export function matchCourse(text: string, subjects: Pick<Subject, 'id' | 'name' | 'code'>[]): number | undefined {
  const hay = text.toLowerCase();
  const hit = subjects
    .flatMap((s) => [s.name, s.code].filter((x): x is string => !!x && x.length > 2).map((n) => ({ id: s.id!, n: n.toLowerCase() })))
    .filter((c) => hay.includes(c.n))
    .sort((a, b) => b.n.length - a.n.length)[0];
  return hit?.id;
}
