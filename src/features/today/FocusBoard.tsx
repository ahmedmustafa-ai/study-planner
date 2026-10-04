import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { X } from 'lucide-react';
import { db } from '@/lib/db';
import type { Focus, Topic } from '@/lib/types';
import { useSubjectMap } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Empty, PageHeader, Section, SubjectDot } from '@/components/common';
import { SubjectTopicPicker, type PickerValue } from '@/components/SubjectTopicPicker';
import { toast } from '@/components/toast';
import { MAX_NOW_TOPICS } from '@/config';
import { cn } from '@/lib/utils';
import { StatusPill } from '@/features/subjects/StatusPill';
import { setTopicFocus, setTopicStatus } from '@/features/subjects/topicActions';

const LANES: { focus: Exclude<Focus, 'none'>; title: string; hint: string }[] = [
  { focus: 'now', title: 'Now', hint: `What you're actively working on (max ${MAX_NOW_TOPICS})` },
  { focus: 'next', title: 'Next', hint: 'Queued up for when a Now slot frees' },
  { focus: 'later', title: 'Later', hint: "Parked — you'll get to it" },
];

/** Now / Next / Later — flexible focus without a fixed schedule. */
export function FocusBoard() {
  const topics = useLiveQuery(() => db.topics.where('focus').anyOf('now', 'next', 'later').toArray(), []) ?? [];
  const subjectMap = useSubjectMap();
  const [pick, setPick] = useState<PickerValue>({});

  async function move(t: Topic, focus: Focus) {
    const ok = await setTopicFocus(t.id!, focus);
    if (!ok) toast(`Now is full (${MAX_NOW_TOPICS}). Finish or move one first — that's the point.`);
  }

  return (
    <>
      <PageHeader back title="Focus board" subtitle="Few things at a time, finished properly." />
      <Card className="mb-5 space-y-3 p-4">
        <SubjectTopicPicker value={pick} onChange={setPick} requireTopic />
        <Button
          className="w-full"
          variant="outline"
          disabled={!pick.topicId}
          onClick={async () => {
            await setTopicFocus(pick.topicId!, 'next');
            setPick({ subjectId: pick.subjectId });
          }}
        >
          Add to Next
        </Button>
      </Card>

      {LANES.map((lane) => {
        const items = topics.filter((t) => t.focus === lane.focus);
        return (
          <Section key={lane.focus} title={`${lane.title} · ${items.length}${lane.focus === 'now' ? `/${MAX_NOW_TOPICS}` : ''}`}>
            <p className="-mt-1 mb-2 text-xs text-muted-foreground">{lane.hint}</p>
            {items.length === 0 ? (
              <Empty>Empty</Empty>
            ) : (
              <ul className="space-y-1.5">
                {items.map((t) => (
                  <li key={t.id} className="rounded-md border p-2.5">
                    <div className="flex items-center gap-2">
                      <SubjectDot color={subjectMap.get(t.subjectId)?.color} />
                      <Link to={`/topics/${t.id}`} className="min-w-0 flex-1 truncate text-sm font-medium">
                        {t.name}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">{subjectMap.get(t.subjectId)?.name}</span>
                      </Link>
                      <StatusPill status={t.status} onChange={(s) => setTopicStatus(t.id!, s)} />
                      <button onClick={() => move(t, 'none')} aria-label="Remove from board">
                        <X className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                    <div className="mt-2 flex gap-1">
                      {LANES.filter((l) => l.focus !== lane.focus).map((l) => (
                        <button
                          key={l.focus}
                          onClick={() => move(t, l.focus)}
                          className={cn('rounded-md bg-muted px-2 py-1 text-xs', l.focus === 'now' && 'bg-tag-blue text-tag-blue-fg')}
                        >
                          → {l.title}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        );
      })}
    </>
  );
}
