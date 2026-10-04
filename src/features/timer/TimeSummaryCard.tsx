import { useState } from 'react';
import { Clock, Plus } from 'lucide-react';
import { useSubjectMap } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SubjectDot } from '@/components/common';
import { formatDuration, summarizeSessions } from '@/lib/algorithms/timer';
import type { StudySession } from '@/lib/types';
import { SessionForm } from './TimerUI';

/** Study time by course for a date range, with a one-line balance hint. */
export function TimeSummaryCard({ sessions, from, to, allowLog }: { sessions: StudySession[]; from: string; to: string; allowLog?: boolean }) {
  const subjectMap = useSubjectMap();
  const [logging, setLogging] = useState(false);
  const sum = summarizeSessions(sessions, from, to);
  const max = sum.bySubject[0]?.minutes ?? 1;
  const topName = sum.bySubject[0] ? subjectMap.get(sum.bySubject[0].subjectId)?.name : undefined;

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          {sum.total === 0 ? (
            <div className="text-sm text-muted-foreground">No study time logged yet. Tap Timer on a course or topic when you start.</div>
          ) : (
            <>
              <div className="text-2xl font-semibold tracking-tight">{formatDuration(sum.total)}</div>
              <div className="text-xs text-muted-foreground">
                across {sum.days} day{sum.days === 1 ? '' : 's'}
              </div>
            </>
          )}
        </div>
        {allowLog && (
          <Button size="sm" variant="outline" onClick={() => setLogging(true)}>
            <Plus /> Log time
          </Button>
        )}
      </div>

      {sum.bySubject.length > 0 && (
        <ul className="mt-4 space-y-2">
          {sum.bySubject.map((b) => {
            const s = subjectMap.get(b.subjectId);
            return (
              <li key={b.subjectId} className="flex items-center gap-2 text-xs">
                <SubjectDot color={s?.color} className="h-2 w-2" />
                <span className="w-28 shrink-0 truncate">{s?.name ?? 'Course'}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${(b.minutes / max) * 100}%`, backgroundColor: s?.color ?? '#9b9a97' }} />
                </div>
                <span className="tabular w-12 shrink-0 text-right text-muted-foreground">{formatDuration(b.minutes)}</span>
              </li>
            );
          })}
        </ul>
      )}
      {sum.bySubject.length > 1 && sum.topShare > 0.6 && topName && (
        <p className="mt-3 text-xs text-muted-foreground">Most of your time went to {topName}. Mixing courses across the week helps you remember more.</p>
      )}

      <Dialog open={logging} onOpenChange={setLogging}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log study time</DialogTitle>
          </DialogHeader>
          {logging && <SessionForm initial={{ minutes: 30 }} showDate onSaved={() => setLogging(false)} />}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
