import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ExternalLink, Paperclip, Plus, X } from 'lucide-react';
import { db } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/toast';
import { SOURCE_KINDS } from '@/config';
import { describeLink, mergeLinks, toggleId } from '@/lib/algorithms/links';

/**
 * Optional extras for a task: connect materials from the same course, and/or attach links.
 * Collapsed until you need it (and open when the task already has something attached).
 */
export function TaskAttachments({
  subjectId,
  materialIds,
  onMaterialIds,
  links,
  onLinks,
  classroomUrl,
}: {
  subjectId?: number;
  materialIds: number[];
  onMaterialIds: (ids: number[]) => void;
  links: string[];
  onLinks: (links: string[]) => void;
  classroomUrl?: string;
}) {
  const [open, setOpen] = useState(materialIds.length + links.length > 0 || !!classroomUrl);
  const [text, setText] = useState('');
  const materials =
    useLiveQuery(async () => (subjectId ? (await db.sources.where('subjectId').equals(subjectId).toArray()).sort((a, b) => b.dateAdded.localeCompare(a.dateAdded) || b.id! - a.id!) : []), [subjectId]) ?? [];

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <Paperclip className="h-4 w-4" /> Add materials or links (optional)
      </button>
    );
  }

  function addLinks() {
    const r = mergeLinks(links, text);
    if (r.added === 0) return toast(text.trim() ? 'No new link found in that text' : 'Paste a link first');
    onLinks(r.links);
    setText('');
  }

  return (
    <div className="space-y-4 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
        <Paperclip className="h-4 w-4" /> Attachments (optional)
      </div>

      {classroomUrl && (
        <a href={classroomUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm hover:bg-accent">
          <Badge variant="info">Classroom</Badge>
          <span className="flex-1 truncate">Assignment page</span>
          <ExternalLink className="h-4 w-4 text-brand" />
        </a>
      )}

      <div>
        <div className="mb-1.5 text-xs font-medium text-muted-foreground">Materials from this course</div>
        {!subjectId ? (
          <p className="text-xs text-muted-foreground">Choose a course first to pick from its materials.</p>
        ) : materials.length === 0 ? (
          <p className="text-xs text-muted-foreground">No materials in this course yet. Add some from the course's Materials tab, or attach a link below.</p>
        ) : (
          <ul className="max-h-44 divide-y overflow-y-auto rounded-md border bg-card">
            {materials.map((m) => (
              <li key={m.id}>
                <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-accent">
                  <input type="checkbox" className="h-4 w-4" checked={materialIds.includes(m.id!)} onChange={() => onMaterialIds(toggleId(materialIds, m.id!))} />
                  <span className="min-w-0 flex-1 truncate text-sm">{m.title}</span>
                  <Badge variant="outline">{(m.url && describeLink(m.url).google && describeLink(m.url).label) || SOURCE_KINDS.find((k) => k.value === m.kind)?.label}</Badge>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="mb-1.5 text-xs font-medium text-muted-foreground">Links</div>
        <div className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault(); // Enter adds the link; it does not save the task
                addLinks();
              }
            }}
            placeholder="Paste one or more links (Drive, Docs, YouTube…)"
          />
          <Button type="button" variant="outline" onClick={addLinks}>
            <Plus /> Add
          </Button>
        </div>
        {links.length > 0 && (
          <ul className="mt-2 divide-y rounded-md border bg-card">
            {links.map((u) => (
              <li key={u} className="flex items-center gap-2 px-3 py-2">
                <Badge variant="secondary">{describeLink(u).label}</Badge>
                <a href={u} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-xs text-brand hover:underline">
                  {u.replace(/^https?:\/\/(www\.)?/, '')}
                </a>
                <button type="button" aria-label="Remove link" onClick={() => onLinks(links.filter((x) => x !== u))} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
