import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { db } from '@/lib/db';
import type { Term } from '@/lib/types';
import { useSubjectMap } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/common';
import { MAX_REVIEW_PER_SESSION } from '@/config';
import { interleave } from '@/lib/algorithms/planning';
import type { Rating } from '@/lib/algorithms/sm2';
import { today } from '@/lib/utils';
import { reviewTerm } from './queries';

const RATINGS: { r: Rating; label: string; cls: string }[] = [
  { r: 'again', label: 'Again', cls: 'bg-tag-red text-tag-red-fg hover:brightness-95' },
  { r: 'hard', label: 'Hard', cls: 'bg-tag-yellow text-tag-yellow-fg hover:brightness-95' },
  { r: 'good', label: 'Good', cls: 'bg-tag-green text-tag-green-fg hover:brightness-95' },
  { r: 'easy', label: 'Easy', cls: 'bg-tag-blue text-tag-blue-fg hover:brightness-95' },
];

/** Recall-first review: see the definition → produce the term → reveal → rate. Interleaved across subjects. */
export function ReviewSession() {
  const [params] = useSearchParams();
  const subjectFilter = params.get('subject') ? Number(params.get('subject')) : undefined;
  const subjectMap = useSubjectMap();
  const [queue, setQueue] = useState<Term[] | null>(null);
  const [i, setI] = useState(0);
  const [attempt, setAttempt] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<Record<Rating, number>>({ again: 0, hard: 0, good: 0, easy: 0 });

  useEffect(() => {
    (async () => {
      let due = await db.terms.where('nextReview').belowOrEqual(today()).toArray();
      if (subjectFilter) due = due.filter((t) => t.subjectId === subjectFilter);
      due.sort((a, b) => a.nextReview.localeCompare(b.nextReview));
      setQueue(interleave(due, (t) => t.subjectId).slice(0, MAX_REVIEW_PER_SESSION));
    })();
  }, [subjectFilter]);

  if (!queue) return null;
  const card = queue[i];

  if (!card) {
    const total = Object.values(results).reduce((a, b) => a + b, 0);
    return (
      <>
        <PageHeader back title="Review done" />
        <Card className="p-6 text-center">
          {total === 0 ? (
            <p className="text-muted-foreground">Nothing due. Come back tomorrow.</p>
          ) : (
            <>
              <div className="text-3xl font-bold">{total}</div>
              <div className="mb-3 text-sm text-muted-foreground">terms reviewed</div>
              <div className="text-sm">
                {RATINGS.map((x) => `${x.label} ${results[x.r]}`).join(' · ')}
              </div>
            </>
          )}
          <Button className="mt-4" asChild>
            <Link to="/">Back to Today</Link>
          </Button>
        </Card>
      </>
    );
  }

  async function rate(r: Rating) {
    await reviewTerm(card.id!, r);
    setResults((x) => ({ ...x, [r]: x[r] + 1 }));
    // "Again" comes back at the end of this session too.
    if (r === 'again') setQueue((q) => (q ? [...q, card] : q));
    setI((n) => n + 1);
    setAttempt('');
    setRevealed(false);
  }

  const promptSide = card.definition || '(no definition — say what this term means)';
  const hasDefinition = !!card.definition;

  return (
    <>
      <PageHeader back title="Vocab review" subtitle={`${i + 1} / ${queue.length} · ${subjectMap.get(card.subjectId)?.name ?? ''}`} />
      <Card className="mb-4 p-5">
        <div className="mb-1 text-xs font-medium text-muted-foreground">{hasDefinition ? 'Which term means…' : 'Define'}</div>
        <div className="text-lg font-medium">{hasDefinition ? promptSide : card.term}</div>
      </Card>
      <Textarea
        rows={2}
        value={attempt}
        onChange={(e) => setAttempt(e.target.value)}
        placeholder="Type your answer first (spelling counts for exams)"
        disabled={revealed}
      />
      {!revealed ? (
        <Button className="mt-3 w-full" onClick={() => setRevealed(true)} disabled={!attempt.trim()}>
          Reveal
        </Button>
      ) : (
        <>
          <Card className="mt-3 p-4">
            <div className="text-xs font-medium text-muted-foreground">Answer</div>
            <div className="text-lg font-semibold">{hasDefinition ? card.term : card.definition || '—'}</div>
            {card.example && <div className="mt-1 text-sm italic text-muted-foreground">{card.example}</div>}
            {hasDefinition && attempt.trim().toLowerCase() === card.term.toLowerCase() && <div className="mt-1 text-sm text-tag-green-fg">Exact match ✓</div>}
          </Card>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {RATINGS.map((x) => (
              <button key={x.r} onClick={() => rate(x.r)} className={`rounded-md py-3 text-sm font-medium ${x.cls}`}>
                {x.label}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
