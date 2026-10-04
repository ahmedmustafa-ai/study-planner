import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { useSubjectMap, useTopicMap } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Empty, PageHeader, Section, SubjectDot } from '@/components/common';
import { toast } from '@/components/toast';
import { MAX_NOW_TOPICS, MISTAKE_CAUSES } from '@/config';
import { detectWeakSpots } from '@/lib/algorithms/weakSpots';
import { addDays, cn, formatDate, today, weekStart } from '@/lib/utils';
import { StatusPill } from '@/features/subjects/StatusPill';
import { TimeSummaryCard } from '@/features/timer/TimeSummaryCard';

/** Guided ~15-minute weekly review: what moved → what's stuck → next focus. */
export function WeeklyReviewPage() {
  const t0 = today();
  const since = addDays(t0, -7);
  const subjectMap = useSubjectMap();
  const topicMap = useTopicMap();
  const d = useLiveQuery(async () => {
    const [topics, mistakes, scores, cards, sessions, terms, tasks, history, studyTime] = await Promise.all([
      db.topics.toArray(),
      db.mistakes.toArray(),
      db.scores.toArray(),
      db.knowledgeCards.where('createdAt').aboveOrEqual(since).count(),
      db.aiSessions.where('createdAt').aboveOrEqual(since).count(),
      db.terms.where('dateAdded').aboveOrEqual(since).count(),
      db.tasks.toArray(),
      db.weeklyReviews.orderBy('weekStart').reverse().toArray(),
      db.studySessions.where('date').aboveOrEqual(addDays(t0, -6)).toArray(),
    ]);
    const weekMistakes = mistakes.filter((m) => m.date >= since);
    return {
      touched: topics.filter((t) => t.lastTouched && t.lastTouched >= since),
      weak: detectWeakSpots(topics, mistakes, scores, t0, 6),
      candidates: topics.filter((t) => t.focus === 'now' || t.focus === 'next'),
      weekMistakes,
      cards,
      sessions,
      terms,
      studyTime,
      overdue: tasks.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate < t0).length,
      history,
    };
  }, [since, t0]);

  const [moved, setMoved] = useState('');
  const [stuck, setStuck] = useState('');
  const [notes, setNotes] = useState('');
  const [focus, setFocus] = useState<number[] | null>(null);

  useEffect(() => {
    if (d && focus === null) setFocus(d.candidates.filter((t) => t.focus === 'now').map((t) => t.id!));
  }, [d, focus]);

  if (!d || focus === null) return null;

  const options = [...new Map([...d.candidates, ...d.weak.map((w) => topicMap.get(w.topicId)!).filter(Boolean)].map((t) => [t.id!, t])).values()];

  function toggle(id: number) {
    setFocus((f) => {
      if (!f) return f;
      if (f.includes(id)) return f.filter((x) => x !== id);
      if (f.length >= MAX_NOW_TOPICS) {
        toast(`Max ${MAX_NOW_TOPICS} — choose what matters most`);
        return f;
      }
      return [...f, id];
    });
  }

  async function save() {
    await db.transaction('rw', db.topics, db.weeklyReviews, async () => {
      const currentNow = await db.topics.where('focus').equals('now').toArray();
      for (const t of currentNow) if (!focus!.includes(t.id!)) await db.topics.update(t.id!, { focus: 'next' });
      for (const id of focus!) await db.topics.update(id, { focus: 'now' });
      await db.weeklyReviews.add({ weekStart: weekStart(t0), moved, stuck, focusTopicIds: focus!, notes });
    });
    toast('Weekly review saved. Have a good week!');
    setMoved('');
    setStuck('');
    setNotes('');
  }

  const causeCounts = MISTAKE_CAUSES.map((c) => ({ ...c, n: d.weekMistakes.filter((m) => m.cause === c.value).length })).filter((c) => c.n);

  return (
    <>
      <PageHeader back title="Weekly review" subtitle={`Week of ${formatDate(weekStart(t0))} · about 15 minutes`} />

      <Section title="1 · What moved (last 7 days)">
        <Card className="mb-2 grid grid-cols-4 gap-2 p-3 text-center">
          <Stat n={d.touched.length} label="topics" />
          <Stat n={d.cards} label="cards" />
          <Stat n={d.sessions} label="AI sessions" />
          <Stat n={d.terms} label="new terms" />
        </Card>
        <div className="mb-2">
          <TimeSummaryCard sessions={d.studyTime} from={addDays(t0, -6)} to={t0} />
        </div>
        {d.touched.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {d.touched.map((t) => (
              <Link key={t.id} to={`/topics/${t.id}`} className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
                <SubjectDot color={subjectMap.get(t.subjectId)?.color} className="h-2 w-2" />
                {t.name}
                <StatusPill status={t.status} className="ml-1 px-1.5 py-0 text-[10px]" />
              </Link>
            ))}
          </div>
        )}
        <Textarea rows={3} value={moved} onChange={(e) => setMoved(e.target.value)} placeholder="What went well? What did you finally understand?" />
      </Section>

      <Section title="2 · What's stuck">
        {d.overdue > 0 && (
          <p className="mb-2 text-sm text-destructive">
            {d.overdue} overdue task{d.overdue > 1 ? 's' : ''} — <Link to="/tasks" className="underline">decide: do, reschedule, or delete</Link>.
          </p>
        )}
        {causeCounts.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5 text-xs">
            <span className="text-muted-foreground">Mistakes this week:</span>
            {causeCounts.map((c) => (
              <Badge key={c.value} variant={c.value === 'vocab' ? 'warning' : 'secondary'}>
                {c.label} {c.n}
              </Badge>
            ))}
          </div>
        )}
        {d.weak.length === 0 ? (
          <Empty className="mb-2">No weak spots detected.</Empty>
        ) : (
          <ul className="mb-2 space-y-1 text-sm">
            {d.weak.map((w) => (
              <li key={w.topicId}>
                <Link to={`/topics/${w.topicId}`} className="hover:underline">
                  <b>{w.name}</b>
                </Link>{' '}
                <span className="text-muted-foreground">
                  ({subjectMap.get(w.subjectId)?.name}) — {w.reasons.join(', ') || 'in progress'}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Textarea rows={3} value={stuck} onChange={(e) => setStuck(e.target.value)} placeholder="What's blocking you? Is it the idea, the English, or time?" />
      </Section>

      <Section title={`3 · Next week's Now (pick up to ${MAX_NOW_TOPICS})`}>
        {options.length === 0 ? (
          <Empty className="mb-2">
            Nothing in Now/Next and no weak spots. <Link to="/focus" className="text-brand underline">Add topics to the focus board</Link>.
          </Empty>
        ) : (
          <div className="mb-2 space-y-1.5">
            {options.map((t) => (
              <button
                key={t.id}
                onClick={() => toggle(t.id!)}
                className={cn('flex w-full items-center gap-2 rounded-md border p-2.5 text-left text-sm', focus.includes(t.id!) && 'border-foreground/40 bg-accent')}
              >
                <input type="checkbox" readOnly checked={focus.includes(t.id!)} className="h-4 w-4" />
                <SubjectDot color={subjectMap.get(t.subjectId)?.color} />
                <span className="flex-1">{t.name}</span>
                <StatusPill status={t.status} />
              </button>
            ))}
          </div>
        )}
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything else for next week (tests, events, energy)?" />
      </Section>

      <Button className="mb-8 w-full" onClick={save}>
        Save review & set focus
      </Button>

      <Section title="Past reviews">
        {d.history.length === 0 ? (
          <Empty>Your first review will appear here. Over weeks, this becomes your progress story.</Empty>
        ) : (
          <div className="space-y-2">
            {d.history.map((r) => (
              <Card key={r.id} className="space-y-1 p-3 text-sm">
                <div className="font-medium">Week of {formatDate(r.weekStart)}</div>
                {r.moved && <p><span className="text-muted-foreground">Moved:</span> {r.moved}</p>}
                {r.stuck && <p><span className="text-muted-foreground">Stuck:</span> {r.stuck}</p>}
                {r.focusTopicIds.length > 0 && (
                  <p>
                    <span className="text-muted-foreground">Focus:</span> {r.focusTopicIds.map((id) => topicMap.get(id)?.name ?? '(deleted)').join(', ')}
                  </p>
                )}
                {r.notes && <p className="text-muted-foreground">{r.notes}</p>}
              </Card>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <div className="text-xl font-bold">{n}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
