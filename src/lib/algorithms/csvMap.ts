// Generic CSV → Task mapping (works with any Classroom/Sheets export). Pure.
import type { Priority, Task } from '@/lib/types';

export interface ColumnMapping {
  title: string;
  dueDate?: string;
  subject?: string;
  priority?: string;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** Accepts YYYY-MM-DD, M/D/YYYY, D.M.YYYY, "Sep 30, 2026", "30 Sep 2026", ISO timestamps. */
export function parseLooseDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  if (!s) return undefined;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); // US style M/D/Y (Google exports)
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return `${y}-${pad(+m[1])}-${pad(+m[2])}`;
  }
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/); // D.M.Y
  if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  m = s.match(/^([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})/);
  if (m) {
    const mi = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
    if (mi >= 0) return `${m[3]}-${pad(mi + 1)}-${pad(+m[2])}`;
  }
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,})\.?,?\s+(\d{4})/);
  if (m) {
    const mi = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    if (mi >= 0) return `${m[3]}-${pad(mi + 1)}-${pad(+m[1])}`;
  }
  return undefined;
}

export function parsePriority(raw: string | undefined): Priority {
  const s = (raw ?? '').toLowerCase();
  if (/high|urgent|important|^1$|^h$/.test(s)) return 'high';
  if (/low|^3$|^l$/.test(s)) return 'low';
  return 'med';
}

/** Guess which column is which from header names. */
export function guessMapping(headers: string[]): ColumnMapping {
  const find = (re: RegExp) => headers.find((h) => re.test(h.toLowerCase()));
  return {
    title: find(/title|assignment|name|task/) ?? headers[0] ?? '',
    dueDate: find(/due|deadline|date/),
    subject: find(/class|course|subject/),
    priority: find(/priority|importance/),
  };
}

export interface MappedTask {
  task: Omit<Task, 'id'>;
  warnings: string[];
}

export function mapRows(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
  subjects: { id?: number; name: string }[],
  defaultSubjectId: number,
): MappedTask[] {
  const out: MappedTask[] = [];
  for (const row of rows) {
    const title = (row[mapping.title] ?? '').trim();
    if (!title) continue;
    const warnings: string[] = [];
    const rawDate = mapping.dueDate ? row[mapping.dueDate] : undefined;
    const dueDate = parseLooseDate(rawDate);
    if (rawDate && rawDate.trim() && !dueDate) warnings.push(`Unreadable date "${rawDate}"`);

    let subjectId = defaultSubjectId;
    const rawSubject = mapping.subject ? (row[mapping.subject] ?? '').trim().toLowerCase() : '';
    if (rawSubject) {
      const hit = subjects.find((s) => {
        const n = s.name.toLowerCase();
        return n === rawSubject || n.includes(rawSubject) || rawSubject.includes(n);
      });
      if (hit?.id != null) subjectId = hit.id;
      else warnings.push(`No subject matches "${rawSubject}" — using default`);
    }
    out.push({
      task: {
        subjectId,
        title,
        dueDate,
        status: 'todo',
        priority: parsePriority(mapping.priority ? row[mapping.priority] : undefined),
        source: 'csv',
      },
      warnings,
    });
  }
  return out;
}
