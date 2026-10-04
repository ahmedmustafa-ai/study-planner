import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useSubjectMap } from '@/lib/hooks';
import { Empty, SubjectDot } from '@/components/common';
import type { PriorityItem } from '@/lib/algorithms/priorities';
import { cn } from '@/lib/utils';

/** Ranked "do this first" list. Each line says why it's on the list. */
export function PriorityList({ items, empty }: { items: PriorityItem[]; empty?: string }) {
  const subjectMap = useSubjectMap();
  if (items.length === 0) return <Empty>{empty ?? 'Nothing urgent. Pick a topic to work on from Studying now.'}</Empty>;
  return (
    <ul className="divide-y rounded-lg border bg-card">
      {items.map((p, i) => {
        const s = p.subjectId != null ? subjectMap.get(p.subjectId) : undefined;
        const hot = /Overdue|today|Today/.test(p.reason);
        return (
          <li key={p.key}>
            <Link to={p.to} className="flex items-center gap-3 px-3 py-3 transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-accent">
              <span className="tabular w-4 shrink-0 text-center text-xs text-muted-foreground">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{p.title}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {s && <SubjectDot color={s.color} className="h-2 w-2" />}
                  {s && <span className="truncate">{s.name}</span>}
                  <span className={cn(hot && 'font-medium text-tag-red-fg')}>· {p.reason}</span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
