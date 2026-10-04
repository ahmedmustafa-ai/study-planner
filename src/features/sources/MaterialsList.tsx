import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus } from 'lucide-react';
import { db } from '@/lib/db';
import type { Source, SourceRole } from '@/lib/types';
import { useTopicMap } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Empty } from '@/components/common';
import { openQuickAdd } from '@/components/quickAddStore';
import { SOURCE_ROLES } from '@/config';
import { cn } from '@/lib/utils';
import { SourceCard, SourceEditDialog } from './SourceCard';
import { useMaterialUse } from './useMaterialUse';

/** A course's materials, grouped by what you use them for. */
export function MaterialsList({ subjectId }: { subjectId: number }) {
  const sources = useLiveQuery(() => db.sources.where('subjectId').equals(subjectId).toArray(), [subjectId]) ?? [];
  const topicMap = useTopicMap();
  const use = useMaterialUse();
  const [role, setRole] = useState<SourceRole | 'all'>('all');
  const [editing, setEditing] = useState<Source | null>(null);

  const shown = sources.filter((s) => role === 'all' || s.role === role).sort((a, b) => b.dateAdded.localeCompare(a.dateAdded) || b.id! - a.id!);
  const chips: { value: SourceRole | 'all'; label: string }[] = [{ value: 'all', label: 'All' }, ...SOURCE_ROLES];

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="flex flex-1 gap-1.5 overflow-x-auto">
          {chips.map((c) => (
            <button
              key={c.value}
              onClick={() => setRole(c.value)}
              className={cn(
                'shrink-0 rounded-md border px-2.5 py-1 text-xs font-medium',
                role === c.value ? 'border-foreground/40 bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent',
              )}
            >
              {c.label}
              {c.value !== 'all' && <span className="tabular ml-1 text-muted-foreground">{sources.filter((s) => s.role === c.value).length}</span>}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => openQuickAdd({ tab: 'material', subjectId })}>
          <Plus /> Material
        </Button>
      </div>
      {shown.length === 0 ? (
        <Empty>
          {sources.length === 0
            ? 'No materials yet. Add links, PDFs, videos, textbook pages or AI chats for this course — or share a link from Chrome/YouTube.'
            : 'Nothing under this filter.'}
        </Empty>
      ) : (
        <div className="space-y-2">
          {shown.map((s) => (
            <SourceCard key={s.id} source={s} topicMap={topicMap} onEdit={setEditing} taskCount={use.get(s.id!)} />
          ))}
        </div>
      )}
      <SourceEditDialog source={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
