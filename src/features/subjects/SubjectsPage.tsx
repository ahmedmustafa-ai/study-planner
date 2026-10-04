import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Archive, ArchiveRestore, ChevronDown, ChevronRight, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import type { Subject, Topic } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Empty, SubjectDot } from '@/components/common';
import { toast } from '@/components/toast';
import { cn, formatDate } from '@/lib/utils';
import { CourseForm } from './CourseForm';
import { deleteSubjectCascade, moveSubject } from './queries';
import { ProgressBar, countStatuses } from './StatusPill';

const byOrder = (a: Subject, b: Subject) => (a.order ?? 999) - (b.order ?? 999) || a.id! - b.id!;

export function SubjectsPage() {
  const navigate = useNavigate();
  const data = useLiveQuery(async () => {
    const [subjects, topics, years] = await Promise.all([db.subjects.toArray(), db.topics.toArray(), db.academicYears.toArray()]);
    return { subjects: subjects.sort(byOrder), topics, year: years[years.length - 1] };
  }, []);
  const [open, setOpen] = useState(false);
  const [reorder, setReorder] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const active = data?.subjects.filter((s) => !s.archived) ?? [];
  const archived = data?.subjects.filter((s) => s.archived) ?? [];

  return (
    <>
      <header className="mb-6 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">Courses</h1>
          {data?.year && <div className="text-sm text-muted-foreground">{data.year.label}</div>}
        </div>
        {active.length > 0 && (
          <Button size="sm" variant={reorder ? 'default' : 'ghost'} onClick={() => setReorder((v) => !v)}>
            {reorder ? 'Done' : 'Manage'}
          </Button>
        )}
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus /> New
        </Button>
      </header>

      {data && active.length === 0 && <Empty>No courses yet. Add one from a template.</Empty>}
      <div className="divide-y rounded-lg border bg-card">
        {active.map((s, i) => (
          <CourseRow key={s.id} subject={s} topics={data!.topics.filter((t) => t.subjectId === s.id)} reorder={reorder} isFirst={i === 0} isLast={i === active.length - 1} />
        ))}
      </div>

      {archived.length > 0 && (
        <div className="mt-6">
          <button className="mb-2 text-[13px] font-medium text-muted-foreground hover:text-foreground" onClick={() => setShowArchived((v) => !v)}>
            {showArchived ? 'Hide' : 'Show'} archived ({archived.length})
          </button>
          {showArchived && (
            <div className="divide-y rounded-lg border bg-card opacity-80">
              {archived.map((s) => (
                <CourseRow key={s.id} subject={s} topics={data!.topics.filter((t) => t.subjectId === s.id)} reorder={reorder} showMove={false} />
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New course</DialogTitle>
          </DialogHeader>
          <CourseForm
            onCreated={(id) => {
              setOpen(false);
              navigate(`/subjects/${id}`);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function CourseRow({
  subject: s,
  topics,
  reorder,
  showMove = true,
  isFirst,
  isLast,
}: {
  subject: Subject;
  topics: Topic[];
  reorder?: boolean;
  showMove?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
}) {
  const counts = countStatuses(topics);
  const meta = [s.code, s.instructor, s.examDate && `Exam ${formatDate(s.examDate)}`].filter(Boolean).join(' · ');
  const body = (
    <>
      <SubjectDot color={s.color} className="h-3 w-3" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{s.name}</span>
          {s.level === 'AP' && <Badge variant="info">AP</Badge>}
          {s.kind === 'test' && <Badge>Test</Badge>}
          {s.kind === 'skill' && <Badge>Skill</Badge>}
          {s.studying === false && !s.archived && <Badge variant="outline">Paused</Badge>}
        </div>
        {meta && <div className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</div>}
        <div className="mt-2 flex items-center gap-3">
          <div className="flex-1">
            <ProgressBar counts={counts} />
          </div>
          <span className="tabular w-16 text-right text-xs text-muted-foreground">
            {counts.solid}/{topics.length} solid
          </span>
        </div>
      </div>
    </>
  );

  if (reorder) {
    return (
      <div className="flex items-center gap-3 px-4 py-3.5">
        {body}
        <div className="flex shrink-0 items-center gap-1">
          {showMove && (
            <div className="flex flex-col">
              <button aria-label="Move up" disabled={isFirst} onClick={() => moveSubject(s.id!, -1)} className={cn('rounded p-1 text-muted-foreground hover:bg-accent', isFirst && 'opacity-25')}>
                <ChevronUp className="h-4 w-4" />
              </button>
              <button aria-label="Move down" disabled={isLast} onClick={() => moveSubject(s.id!, 1)} className={cn('rounded p-1 text-muted-foreground hover:bg-accent', isLast && 'opacity-25')}>
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          )}
          <button
            aria-label={s.archived ? `Unarchive ${s.name}` : `Archive ${s.name}`}
            onClick={() => db.subjects.update(s.id!, { archived: !s.archived })}
            className="rounded p-1.5 text-muted-foreground hover:bg-accent"
          >
            {s.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          </button>
          <button
            aria-label={`Delete ${s.name}`}
            onClick={async () => {
              if (!confirm(`Permanently delete "${s.name}" and ALL its topics, materials, notes, terms, tasks and classes? This can't be undone.`)) return;
              await deleteSubjectCascade(s.id!);
              toast(`${s.name} deleted`);
            }}
            className="rounded p-1.5 text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }
  return (
    <Link to={`/subjects/${s.id}`} className={cn('flex items-center gap-3 px-4 py-3.5 transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-accent', s.studying === false && 'opacity-70')}>
      {body}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
    </Link>
  );
}
