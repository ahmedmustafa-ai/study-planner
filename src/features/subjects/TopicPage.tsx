import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, ExternalLink, Pencil, Sparkles, Star, Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import type { Focus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Empty, PageHeader, Section } from '@/components/common';
import { toast } from '@/components/toast';
import { MAX_NOW_TOPICS, MISTAKE_CAUSES } from '@/config';
import { cn, formatDate, relativeDays, today } from '@/lib/utils';
import { dueRevisits } from '@/lib/algorithms/revisit';
import { StatusPicker } from './StatusPill';
import { completeRevisit, deleteTopic, setTopicFocus, setTopicStatus } from './topicActions';
import { addCard } from '@/features/knowledge/queries';
import { StartTimerButton } from '@/features/timer/TimerUI';

const FOCUS_OPTIONS: { value: Focus; label: string }[] = [
  { value: 'now', label: 'Now' },
  { value: 'next', label: 'Next' },
  { value: 'later', label: 'Later' },
  { value: 'none', label: '—' },
];

export function TopicPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const data = useLiveQuery(async () => {
    const topic = await db.topics.get(id);
    if (!topic) return { topic };
    const [subject, unit, sources, cards, mistakes, terms, tasks, scores, sessions] = await Promise.all([
      db.subjects.get(topic.subjectId),
      db.units.get(topic.unitId),
      db.sources.where('topicIds').equals(id).toArray(),
      db.knowledgeCards.where('topicId').equals(id).reverse().sortBy('createdAt'),
      db.mistakes.where('topicId').equals(id).reverse().sortBy('date'),
      db.terms.where('topicId').equals(id).toArray(),
      db.tasks.where('topicId').equals(id).toArray(),
      db.scores.where('topicId').equals(id).toArray(),
      db.aiSessions.where('topicId').equals(id).reverse().sortBy('createdAt'),
    ]);
    return { topic, subject, unit, sources, cards, mistakes, terms, tasks, scores, sessions };
  }, [id]);
  const [note, setNote] = useState('');
  const [renaming, setRenaming] = useState(false);

  if (!data) return null;
  if (!data.topic) return <PageHeader back title="Topic not found" />;
  const { topic, subject, unit, sources = [], cards = [], mistakes = [], terms = [], tasks = [], scores = [], sessions = [] } = data;

  return (
    <>
      <PageHeader
        back
        title={
          renaming ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const v = (new FormData(e.currentTarget).get('name') as string).trim();
                if (v) await db.topics.update(id, { name: v });
                setRenaming(false);
              }}
            >
              <Input name="name" defaultValue={topic.name} autoFocus className="h-8" onBlur={(e) => e.currentTarget.form?.requestSubmit()} />
            </form>
          ) : (
            topic.name
          )
        }
        subtitle={
          <Link to={`/subjects/${subject?.id}`} className="hover:underline">
            {subject?.name} · {unit?.name}
          </Link>
        }
        actions={
          <>
            <Button variant="ghost" size="icon" onClick={() => setRenaming(true)} aria-label="Rename">
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete topic"
              onClick={async () => {
                if (confirm(`Delete topic "${topic.name}"? Notes and mistakes stay in the subject.`)) {
                  await deleteTopic(id);
                  navigate(-1);
                }
              }}
            >
              <Trash2 />
            </Button>
          </>
        }
      />

      {dueRevisits([topic], today()).length > 0 && (
        <Card className="mb-4 border-transparent bg-tag-yellow p-4 text-tag-yellow-fg">
          <div className="text-sm font-medium">Time to revisit this topic</div>
          <p className="mt-1 text-sm">Close your notes. Recall it from memory first, then check yourself honestly.</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={async () => { await completeRevisit(id, true); toast("Nice. See you again later."); }}>
              Still solid
            </Button>
            <Button size="sm" variant="outline" onClick={async () => { await completeRevisit(id, false); toast("Marked shaky. It is on your list now."); }}>
              I forgot some
            </Button>
          </div>
        </Card>
      )}

      <Card className="mb-5 space-y-3 p-4">
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">How well do I know this?</div>
          <StatusPicker status={topic.status} onChange={(s) => setTopicStatus(id, s)} />
        </div>
        <div>
          <div className="mb-1.5 text-xs font-medium text-muted-foreground">Focus (max {MAX_NOW_TOPICS} in Now)</div>
          <div className="grid grid-cols-4 gap-1">
            {FOCUS_OPTIONS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={async () => {
                  const ok = await setTopicFocus(id, f.value);
                  if (!ok) toast(`Now is full (${MAX_NOW_TOPICS}). Move something to Next first.`);
                }}
                className={cn(
                  'rounded-md py-2 text-xs font-medium',
                  topic.focus === f.value ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <StartTimerButton subjectId={topic.subjectId} topicId={id} label="Start timer on this topic" className="w-full" />
        <Button className="w-full" asChild>
          <Link to={`/ai?subject=${topic.subjectId}&topic=${id}`}>
            <Sparkles /> Work on this with AI (you try first)
          </Link>
        </Button>
        {topic.lastTouched && (
          <div className="text-xs text-muted-foreground">
            Last touched {relativeDays(topic.lastTouched)}
            {topic.status === "solid" && topic.nextReview && ` · next revisit ${relativeDays(topic.nextReview)}`}
          </div>
        )}
      </Card>

      <Section title={`Knowledge cards (${cards.length})`}>
        <form
          className="mb-2 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            await addCard({ subjectId: topic.subjectId, topicId: id, text: note });
            setNote('');
          }}
        >
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="One idea, in your own words" />
          <Button type="submit" variant="outline">
            Add
          </Button>
        </form>
        <ul className="space-y-1.5">
          {cards.map((c) => (
            <li key={c.id} className="flex items-start gap-2 rounded-md border p-2.5 text-sm">
              <button onClick={() => db.knowledgeCards.update(c.id!, { starred: !c.starred })} aria-label="Star">
                <Star className={cn('mt-0.5 h-4 w-4', c.starred ? 'fill-tag-yellow-fg text-tag-yellow-fg' : 'text-muted-foreground')} />
              </button>
              <span className="flex-1 whitespace-pre-wrap">{c.text}</span>
              {c.origin === 'capture' && <Badge variant="outline">AI</Badge>}
              <button onClick={() => db.knowledgeCards.delete(c.id!)} aria-label="Delete card">
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={`Mistakes (${mistakes.filter((m) => !m.fixed).length} open)`}>
        {mistakes.length === 0 ? (
          <Empty>No mistakes logged. Log them with the + button — they drive your weak spots.</Empty>
        ) : (
          <ul className="space-y-1.5">
            {mistakes.map((m) => (
              <li key={m.id} className={cn('flex items-start gap-2 rounded-md border p-2.5 text-sm', m.fixed && 'opacity-60')}>
                <button
                  onClick={() => db.mistakes.update(m.id!, { fixed: !m.fixed })}
                  className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border', m.fixed && 'border-foreground bg-foreground text-background')}
                  aria-label="Toggle fixed"
                >
                  {m.fixed && <Check className="h-3 w-3" />}
                </button>
                <span className={cn('flex-1', m.fixed && 'line-through')}>{m.text}</span>
                <Badge variant={m.cause === 'vocab' ? 'warning' : 'secondary'}>{MISTAKE_CAUSES.find((c) => c.value === m.cause)?.label}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Materials (${sources.length})`}>
        {sources.length === 0 ? (
          <Empty>No materials tagged to this topic yet.</Empty>
        ) : (
          <ul className="space-y-1.5">
            {sources.map((s) => (
              <li key={s.id} className="flex items-center gap-2 rounded-md border p-2.5 text-sm">
                <Badge variant="outline">{s.role}</Badge>
                <span className="flex-1 truncate">{s.title}</span>
                {s.url && (
                  <a href={s.url} target="_blank" rel="noreferrer" aria-label="Open">
                    <ExternalLink className="h-4 w-4 text-brand" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {terms.length > 0 && (
        <Section title={`Terms (${terms.length})`}>
          <ul className="space-y-1 text-sm">
            {terms.map((t) => (
              <li key={t.id}>
                <span className="font-medium">{t.term}</span> — <span className="text-muted-foreground">{t.definition}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {tasks.length > 0 && (
        <Section title="Tasks">
          <ul className="space-y-1 text-sm">
            {tasks.map((t) => (
              <li key={t.id} className={cn(t.status === 'done' && 'text-muted-foreground line-through')}>
                {t.title} {t.dueDate && <span className="text-xs text-muted-foreground">· {formatDate(t.dueDate)}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {scores.length > 0 && (
        <Section title="Scores">
          <ul className="space-y-1 text-sm">
            {scores.map((s) => (
              <li key={s.id}>
                {s.label}: {s.score}/{s.max} ({Math.round((s.score / s.max) * 100)}%) · <span className="text-muted-foreground">{formatDate(s.date)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {sessions.length > 0 && (
        <Section title={`AI sessions (${sessions.length})`}>
          <ul className="space-y-1.5">
            {sessions.slice(0, 10).map((s) => (
              <li key={s.id}>
                <Link to={`/ai/session/${s.id}`} className="block rounded-md border p-2.5 text-sm hover:bg-accent/50">
                  <div className="text-xs text-muted-foreground">
                    {formatDate(s.createdAt)} · {s.tool}
                  </div>
                  <div className="line-clamp-2">{s.attempt}</div>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}
