import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import type { Activity, Milestone, Score } from '@/lib/types';
import { useSubjectMap, useTopicMap } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Empty, PageHeader, SubjectDot } from '@/components/common';
import { milestoneBranch, milestoneState, type MilestoneState } from '@/lib/algorithms/planning';
import { readiness } from '@/lib/algorithms/weakSpots';
import { cn, formatDate, relativeDays, today } from '@/lib/utils';
import { ActivityForm, MilestoneForm, ScoreForm } from './forms';

const STATE_BADGE: Record<MilestoneState, { label: string; variant: 'secondary' | 'warning' | 'destructive' | 'success' | 'outline' }> = {
  upcoming: { label: 'upcoming', variant: 'outline' },
  'due-soon': { label: 'soon', variant: 'warning' },
  overdue: { label: 'overdue', variant: 'destructive' },
  passed: { label: 'passed', variant: 'success' },
  failed: { label: 'below target', variant: 'destructive' },
  done: { label: 'done', variant: 'success' },
};

type Editing = { kind: 'milestone'; value?: Milestone } | { kind: 'score'; value?: Score } | { kind: 'activity'; value?: Activity } | null;

export function TargetsPage() {
  const [tab, setTab] = useState('deadlines');
  const [editing, setEditing] = useState<Editing>(null);
  const subjectMap = useSubjectMap();
  const topicMap = useTopicMap();
  const data = useLiveQuery(async () => {
    const [milestones, scores, activities, topics] = await Promise.all([
      db.milestones.orderBy('date').toArray(),
      db.scores.orderBy('date').reverse().toArray(),
      db.activities.orderBy('date').reverse().toArray(),
      db.topics.toArray(),
    ]);
    return { milestones, scores, activities, topics };
  }, []);
  const t0 = today();

  const add = () => setEditing({ kind: tab === 'scores' ? 'score' : tab === 'activities' ? 'activity' : 'milestone' });

  return (
    <>
      <PageHeader
        back
        title="Targets"
        subtitle="Deadlines, checkpoints, scores and your activity record"
        actions={
          <Button size="sm" onClick={add}>
            <Plus /> Add
          </Button>
        }
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="deadlines">Deadlines</TabsTrigger>
          <TabsTrigger value="scores">Scores</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
        </TabsList>

        <TabsContent value="deadlines" className="space-y-2">
          {data?.milestones.length === 0 && <Empty>No deadlines or checkpoints yet.</Empty>}
          {data?.milestones.map((m) => {
            const state = milestoneState(m, t0);
            const branch = milestoneBranch(m);
            const subject = m.subjectId ? subjectMap.get(m.subjectId) : undefined;
            const ready = m.kind === 'checkpoint' && m.subjectId ? readiness(data.topics.filter((t) => t.subjectId === m.subjectId)) : null;
            return (
              <Card key={m.id} className={cn('p-3', (state === 'done' || state === 'passed') && 'opacity-70')}>
                <div className="flex items-start gap-2">
                  {m.kind === 'deadline' ? (
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={m.done}
                      onChange={(e) => db.milestones.update(m.id!, { done: e.target.checked })}
                      aria-label="Done"
                    />
                  ) : (
                    <span className="mt-1 text-xs font-bold text-brand">CP</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{m.title}</div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      {subject && (
                        <>
                          <SubjectDot color={subject.color} /> {subject.name} ·
                        </>
                      )}
                      {formatDate(m.date)} ({relativeDays(m.date)})
                      <Badge variant={STATE_BADGE[state].variant}>{STATE_BADGE[state].label}</Badge>
                    </div>
                    {m.note && <p className="mt-1 text-sm text-muted-foreground">{m.note}</p>}
                    {m.kind === 'checkpoint' && (
                      <div className="mt-2 space-y-1 text-sm">
                        <div>
                          Target {m.target ?? '—'}% · pass line {m.passThreshold ?? '—'}%{m.result != null && <> · <b>result {m.result}%</b></>}
                        </div>
                        {ready && m.result == null && (
                          <div className="text-xs text-muted-foreground">
                            Readiness now: {ready.solid}/{ready.total} topics solid ({ready.percent}%)
                          </div>
                        )}
                        {branch ? (
                          <div className={cn('rounded-md p-2 text-sm', state === 'passed' ? 'bg-tag-green text-tag-green-fg' : 'bg-tag-red text-tag-red-fg')}>
                            Next: {branch}
                          </div>
                        ) : (
                          (m.onPass || m.onFail) && (
                            <div className="text-xs text-muted-foreground">
                              Pass → {m.onPass} · Fail → {m.onFail}
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setEditing({ kind: 'milestone', value: m })} aria-label="Edit">
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="scores" className="space-y-2">
          {data?.scores.length === 0 && <Empty>No scores yet. Log quizzes, tests and SAT practice tests here — low scores feed weak spots.</Empty>}
          <SatTrend scores={data?.scores ?? []} subjectMap={subjectMap} />
          {data?.scores.map((s) => (
            <Card key={s.id} className="flex items-center gap-2 p-3">
              <SubjectDot color={subjectMap.get(s.subjectId)?.color} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">
                  {s.label} — {s.score}/{s.max} ({Math.round((s.score / s.max) * 100)}%)
                </div>
                <div className="text-xs text-muted-foreground">
                  {subjectMap.get(s.subjectId)?.name}
                  {s.topicId && ` · ${topicMap.get(s.topicId)?.name ?? ''}`} · {formatDate(s.date)}
                  {s.sections && ' · ' + Object.entries(s.sections).map(([k, v]) => `${k} ${v}`).join(' · ')}
                </div>
              </div>
              <button onClick={() => setEditing({ kind: 'score', value: s })} aria-label="Edit">
                <Pencil className="h-4 w-4 text-muted-foreground" />
              </button>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="activities" className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Your record for MIT and other applications: robotics builds, competitions, projects, awards. Log it when it happens — not in a panic in 2027.
          </p>
          {data?.activities.length === 0 && <Empty>No activities yet.</Empty>}
          {data?.activities.map((a) => (
            <Card key={a.id} className="p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{a.title}</div>
                  <div className="text-xs text-muted-foreground">
                    <Badge variant="secondary">{a.category}</Badge> {formatDate(a.date)}
                  </div>
                  {a.description && <p className="mt-1 whitespace-pre-wrap text-sm">{a.description}</p>}
                </div>
                {a.url && (
                  <a href={a.url} target="_blank" rel="noreferrer" aria-label="Open">
                    <ExternalLink className="h-4 w-4 text-brand" />
                  </a>
                )}
                <button onClick={() => setEditing({ kind: 'activity', value: a })} aria-label="Edit">
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                </button>
                <button onClick={() => confirm('Delete activity?') && db.activities.delete(a.id!)} aria-label="Delete">
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing?.value ? 'Edit' : 'Add'} {editing?.kind === 'milestone' ? 'deadline / checkpoint' : editing?.kind}
            </DialogTitle>
          </DialogHeader>
          {editing?.kind === 'milestone' && <MilestoneForm initial={editing.value} onDone={() => setEditing(null)} />}
          {editing?.kind === 'score' && <ScoreForm initial={editing.value} onDone={() => setEditing(null)} />}
          {editing?.kind === 'activity' && <ActivityForm initial={editing.value} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** SAT score history with change vs previous, per section. */
function SatTrend({ scores, subjectMap }: { scores: Score[]; subjectMap: Map<number, { kind: string; name: string }> }) {
  const sat = scores.filter((s) => subjectMap.get(s.subjectId)?.kind === 'test' && s.sections).slice().reverse();
  if (sat.length === 0) return null;
  const last = sat[sat.length - 1];
  const prev = sat[sat.length - 2];
  const delta = (a?: number, b?: number) => (a != null && b != null ? (a - b >= 0 ? `+${a - b}` : `${a - b}`) : '');
  return (
    <Card className="p-4">
      <div className="mb-1 text-xs font-medium text-muted-foreground">Latest {subjectMap.get(last.subjectId)?.name}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold">{last.score}</span>
        {prev && <span className="text-sm text-muted-foreground">{delta(last.score, prev.score)} vs previous</span>}
      </div>
      <div className="mt-1 text-sm">
        {Object.entries(last.sections ?? {}).map(([k, v]) => (
          <span key={k} className="mr-3">
            {k}: <b>{v}</b> {prev?.sections && <span className="text-xs text-muted-foreground">{delta(v, prev.sections[k])}</span>}
          </span>
        ))}
      </div>
      {sat.length > 1 && <div className="mt-2 text-xs text-muted-foreground">History: {sat.map((s) => s.score).join(' → ')}</div>}
    </Card>
  );
}
