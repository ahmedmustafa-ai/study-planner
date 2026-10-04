import { Link } from 'react-router-dom';
import { ExternalLink, Pencil, Trash2 } from 'lucide-react';
import type { Source, Subject, Topic } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SubjectDot } from '@/components/common';
import { SOURCE_KINDS } from '@/config';
import { describeLink } from '@/lib/algorithms/links';
import { SourceForm } from './SourceForm';
import { deleteSource } from './queries';

/** One material (link, PDF, video, book pages, AI chat…). Used in the global Library and on each course. */
export function SourceCard({
  source: s,
  subject,
  topicMap,
  onEdit,
  taskCount,
}: {
  source: Source;
  subject?: Subject; // pass to show the course name + color (Library); omit inside a course
  topicMap: Map<number, Topic>;
  onEdit: (s: Source) => void;
  taskCount?: number; // how many tasks use this material
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-start gap-2">
        {subject && <SubjectDot color={subject.color} className="mt-1.5" />}
        <div className="min-w-0 flex-1">
          <div className="font-medium">{s.title}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Badge variant="outline">{(s.url && describeLink(s.url).google && describeLink(s.url).label) || SOURCE_KINDS.find((k) => k.value === s.kind)?.label}</Badge>
            <Badge>{s.role}</Badge>
            {subject?.name}
            {s.topicIds.map((id) => {
              const t = topicMap.get(id);
              return t ? (
                <Link key={id} to={`/topics/${id}`} className="hover:underline">
                  · {t.name}
                </Link>
              ) : null;
            })}
          </div>
          {!!taskCount && <p className="mt-1 text-xs text-muted-foreground">Used in {taskCount} task{taskCount > 1 ? 's' : ''}</p>}
          {s.content && <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{s.content}</p>}
        </div>
        <div className="flex shrink-0 gap-0.5">
          {s.url && (
            <a href={s.url} target="_blank" rel="noreferrer" className="rounded p-1.5 hover:bg-accent" aria-label="Open">
              <ExternalLink className="h-4 w-4 text-brand" />
            </a>
          )}
          <button className="rounded p-1.5 hover:bg-accent" onClick={() => onEdit(s)} aria-label="Edit">
            <Pencil className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            className="rounded p-1.5 hover:bg-accent"
            aria-label="Delete"
            onClick={() => confirm(`Delete "${s.title}"?${taskCount ? ` It will also be removed from ${taskCount} task${taskCount > 1 ? 's' : ''}.` : ''}`) && deleteSource(s.id!)}
          >
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function SourceEditDialog({ source, onClose }: { source: Source | null; onClose: () => void }) {
  return (
    <Dialog open={!!source} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit material</DialogTitle>
        </DialogHeader>
        {source && <SourceForm initial={source} onSaved={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
