import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Search } from 'lucide-react';
import { db } from '@/lib/db';
import type { Source } from '@/lib/types';
import { useSubjectMap, useSubjects, useTopicMap } from '@/lib/hooks';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Empty, PageHeader, SubjectDot } from '@/components/common';
import { MISTAKE_CAUSES } from '@/config';
import { cn, formatDate } from '@/lib/utils';
import { SourceCard, SourceEditDialog } from './SourceCard';
import { useMaterialUse } from './useMaterialUse';

function matches(q: string, ...fields: (string | undefined)[]) {
  if (!q) return true;
  const hay = fields.filter(Boolean).join(' ').toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((w) => hay.includes(w));
}

/** One search across materials, knowledge cards, mistakes and terms. */
export function LibraryPage() {
  const [q, setQ] = useState('');
  const [subjectId, setSubjectId] = useState<number | ''>('');
  const [editing, setEditing] = useState<Source | null>(null);
  const subjects = useSubjects() ?? [];
  const subjectMap = useSubjectMap();
  const topicMap = useTopicMap();
  const use = useMaterialUse();

  const all = useLiveQuery(async () => {
    const [sources, cards, mistakes, terms] = await Promise.all([
      db.sources.toArray(),
      db.knowledgeCards.toArray(),
      db.mistakes.toArray(),
      db.terms.toArray(),
    ]);
    return { sources: sources.reverse(), cards: cards.reverse(), mistakes: mistakes.reverse(), terms };
  }, []);

  const f = useMemo(() => {
    if (!all) return null;
    const bySubject = <T extends { subjectId: number }>(x: T) => subjectId === '' || x.subjectId === subjectId;
    const topicName = (id?: number) => (id ? topicMap.get(id)?.name : undefined);
    return {
      sources: all.sources.filter((s) => bySubject(s) && matches(q, s.title, s.url, s.content, ...s.topicIds.map(topicName))),
      cards: all.cards.filter((c) => bySubject(c) && matches(q, c.text, topicName(c.topicId))),
      mistakes: all.mistakes.filter((m) => bySubject(m) && matches(q, m.text, m.cause, topicName(m.topicId))),
      terms: all.terms.filter((t) => bySubject(t) && matches(q, t.term, t.definition, t.example)),
    };
  }, [all, q, subjectId, topicMap]);

  const topicLabel = (id?: number) => {
    const t = id ? topicMap.get(id) : undefined;
    return t ? (
      <Link to={`/topics/${t.id}`} className="hover:underline">
        {t.name}
      </Link>
    ) : null;
  };

  return (
    <>
      <PageHeader title="Library" subtitle="Everything you've collected, searchable" />
      <div className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search everything…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select className="w-36" value={subjectId} onChange={(e) => setSubjectId(e.target.value ? Number(e.target.value) : '')}>
          <option value="">All courses</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>

      {f && (
        <Tabs defaultValue="sources">
          <TabsList>
            <TabsTrigger value="sources">Materials {f.sources.length}</TabsTrigger>
            <TabsTrigger value="cards">Cards {f.cards.length}</TabsTrigger>
            <TabsTrigger value="mistakes">Mistakes {f.mistakes.length}</TabsTrigger>
            <TabsTrigger value="terms">Terms {f.terms.length}</TabsTrigger>
          </TabsList>

          <TabsContent value="sources" className="space-y-2">
            {f.sources.length === 0 && <Empty>No materials yet. Use + or share a link from Chrome/YouTube into Study OS.</Empty>}
            {f.sources.map((s) => (
              <SourceCard key={s.id} source={s} subject={subjectMap.get(s.subjectId)} topicMap={topicMap} onEdit={setEditing} taskCount={use.get(s.id!)} />
            ))}
          </TabsContent>

          <TabsContent value="cards" className="space-y-2">
            {f.cards.length === 0 && <Empty>No knowledge cards yet. They come from + Note and from AI Capture Blocks.</Empty>}
            {f.cards.map((c) => (
              <div key={c.id} className="rounded-lg border p-3 text-sm">
                <p className="whitespace-pre-wrap">{c.text}</p>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <SubjectDot color={subjectMap.get(c.subjectId)?.color} />
                  {subjectMap.get(c.subjectId)?.name} {c.topicId && <>· {topicLabel(c.topicId)}</>} · {formatDate(c.createdAt)}
                  {c.origin === 'capture' && <Badge variant="outline">AI</Badge>}
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="mistakes" className="space-y-2">
            <CauseSummary mistakes={f.mistakes} />
            {f.mistakes.map((m) => (
              <div key={m.id} className={cn('flex items-start gap-2 rounded-lg border p-3 text-sm', m.fixed && 'opacity-60')}>
                <button
                  onClick={() => db.mistakes.update(m.id!, { fixed: !m.fixed })}
                  className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border', m.fixed && 'border-foreground bg-foreground text-background')}
                  aria-label="Toggle fixed"
                >
                  {m.fixed && <Check className="h-3 w-3" />}
                </button>
                <div className="flex-1">
                  <p className={cn(m.fixed && 'line-through')}>{m.text}</p>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {subjectMap.get(m.subjectId)?.name} {m.topicId && <>· {topicLabel(m.topicId)}</>} · {formatDate(m.date)}
                  </div>
                </div>
                <Badge variant={m.cause === 'vocab' ? 'warning' : 'secondary'}>{MISTAKE_CAUSES.find((c) => c.value === m.cause)?.label}</Badge>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="terms" className="space-y-2">
            {f.terms.length === 0 && <Empty>No terms yet.</Empty>}
            {f.terms.map((t) => (
              <div key={t.id} className="rounded-lg border p-3 text-sm">
                <span className="font-medium">{t.term}</span> — {t.definition}
                <div className="mt-1 text-xs text-muted-foreground">{subjectMap.get(t.subjectId)?.name}</div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      )}

      <SourceEditDialog source={editing} onClose={() => setEditing(null)} />
    </>
  );
}

/** Shows WHY you lose points — separates English gaps from understanding gaps. */
function CauseSummary({ mistakes }: { mistakes: { cause: string; fixed: boolean }[] }) {
  const open = mistakes.filter((m) => !m.fixed);
  if (!open.length) return <Empty>No open mistakes.</Empty>;
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <div className="mb-2 text-xs font-medium text-muted-foreground">Open mistakes by cause</div>
      <div className="flex flex-wrap gap-2">
        {MISTAKE_CAUSES.map((c) => {
          const n = open.filter((m) => m.cause === c.value).length;
          return n ? (
            <Badge key={c.value} variant={c.value === 'vocab' ? 'warning' : 'secondary'}>
              {c.label}: {n} ({Math.round((n / open.length) * 100)}%)
            </Badge>
          ) : null;
        })}
      </div>
    </div>
  );
}
