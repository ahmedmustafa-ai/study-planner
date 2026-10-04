import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Brain, Download, Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import { useSubjectMap, useSubjects } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Empty, PageHeader } from '@/components/common';
import { toast } from '@/components/toast';
import { formatDate, relativeDays, shareOrDownload, today } from '@/lib/utils';
import { addTerm } from './queries';

export function VocabPage() {
  const terms = useLiveQuery(() => db.terms.toArray(), []) ?? [];
  const subjects = (useSubjects() ?? []).filter((s) => s.languageLoad);
  const subjectMap = useSubjectMap();
  const [subjectId, setSubjectId] = useState<number | ''>('');
  const [term, setTerm] = useState('');
  const [def, setDef] = useState('');
  const t0 = today();

  const list = useMemo(
    () => terms.filter((t) => subjectId === '' || t.subjectId === subjectId).sort((a, b) => a.nextReview.localeCompare(b.nextReview)),
    [terms, subjectId],
  );
  const due = list.filter((t) => t.nextReview <= t0).length;

  function exportAnki() {
    // Anki: File → Import → semicolon-separated, fields Front;Back;Tags
    const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const csv = list.map((t) => [esc(t.term), esc(t.definition + (t.example ? `<br><i>${t.example}</i>` : '')), esc((subjectMap.get(t.subjectId)?.name ?? '').replace(/\s+/g, '_'))].join(';')).join('\n');
    shareOrDownload(`study-os-vocab-${t0}.txt`, csv, 'text/plain');
  }

  return (
    <>
      <PageHeader
        back
        title="Vocab"
        subtitle="Terms for terminology-heavy subjects. Recall first, then reveal."
        actions={
          list.length > 0 && (
            <Button size="sm" variant="ghost" onClick={exportAnki} title="Export for Anki">
              <Download /> Anki
            </Button>
          )
        }
      />
      <Card className="mb-4 flex items-center gap-3 p-4">
        <Brain className="h-6 w-6 text-muted-foreground" />
        <div className="flex-1">
          <div className="text-2xl font-bold">{due}</div>
          <div className="text-xs text-muted-foreground">terms due{subjectId ? ` in ${subjectMap.get(subjectId)?.name}` : ''}</div>
        </div>
        <Button asChild disabled={!due}>
          <Link to={`/vocab/review${subjectId ? `?subject=${subjectId}` : ''}`}>Review now</Link>
        </Button>
      </Card>

      <form
        className="mb-4 space-y-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const sid = subjectId || subjects[0]?.id;
          if (!sid) return toast('Mark a subject as terminology-heavy first (Subject → Settings)');
          if (!term.trim()) return;
          const isNew = await addTerm({ subjectId: sid, term, definition: def });
          toast(isNew ? 'Term added' : 'Already existed — definition updated');
          setTerm('');
          setDef('');
        }}
      >
        <div className="grid grid-cols-2 gap-2">
          <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">All subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Term" />
        </div>
        <div className="flex gap-2">
          <Input value={def} onChange={(e) => setDef(e.target.value)} placeholder="Simple-English definition" />
          <Button type="submit">Add</Button>
        </div>
      </form>

      {list.length === 0 && (
        <Empty>No terms yet. Add them here, with + → Term, or let the AI Capture Block add them. Tip: use the "Chapter vocab list" prompt with your Gemini notebook the night before class.</Empty>
      )}
      <ul className="space-y-1.5">
        {list.map((t) => (
          <li key={t.id} className="flex items-start gap-2 rounded-md border p-2.5 text-sm">
            <div className="flex-1">
              <span className="font-medium">{t.term}</span> — {t.definition || <i className="text-muted-foreground">no definition</i>}
              <div className="text-xs text-muted-foreground">
                {subjectMap.get(t.subjectId)?.name} · next {t.nextReview <= t0 ? 'now' : relativeDays(t.nextReview)} · added {formatDate(t.dateAdded)}
              </div>
            </div>
            <button onClick={() => db.terms.delete(t.id!)} aria-label="Delete term">
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
