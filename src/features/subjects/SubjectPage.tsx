import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Check, ChevronDown, ChevronRight, ChevronUp, Download, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import type { CalEvent, ExamStatus, Level, Subject, SubjectKind, Task, Topic, Unit } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Empty, Section } from '@/components/common';
import { openQuickAdd, setQuickContext } from '@/components/quickAddStore';
import { toast } from '@/components/toast';
import { SUBJECT_COLORS } from '@/config';
import { cn, formatDate, shareOrDownload, today } from '@/lib/utils';
import { knowledgeMarkdown } from '@/lib/algorithms/planning';
import { MaterialsList } from '@/features/sources/MaterialsList';
import { EventForm } from '@/features/calendar/EventForm';
import { KIND_LABEL, KIND_VARIANT } from '@/features/calendar/CalItemRow';
import { TaskRow } from '@/features/tasks/TasksPage';
import { TaskForm } from '@/features/tasks/TaskForm';
import { StartTimerButton } from '@/features/timer/TimerUI';
import { addTask } from '@/features/tasks/queries';
import { StatusPill, ProgressBar, countStatuses } from './StatusPill';
import { addTopic, addUnit, deleteTopic, moveTopic, moveUnit, renameTopic, renameUnit, setTopicStatus } from './topicActions';
import { deleteSubjectCascade, deleteUnitCascade } from './queries';

// "Ghost" controls: look like plain text until hovered/focused (Notion property style).
const ghost = 'h-8 border-transparent bg-transparent px-2 text-sm hover:bg-accent focus-visible:border-ring focus-visible:bg-card';

export function SubjectPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'topics';
  const [editMode, setEditMode] = useState(false);
  const data = useLiveQuery(async () => {
    const [subject, units, topics, materials, tasks] = await Promise.all([
      db.subjects.get(id),
      db.units.where('subjectId').equals(id).toArray(),
      db.topics.where('subjectId').equals(id).toArray(),
      db.sources.where('subjectId').equals(id).count(),
      db.tasks.where('subjectId').equals(id).toArray(),
    ]);
    units.sort((a, b) => a.order - b.order || a.id! - b.id!);
    topics.sort((a, b) => a.order - b.order || a.id! - b.id!);
    return { subject, units, topics, materials, tasks };
  }, [id]);

  // "+" inside a course pre-fills this course.
  useEffect(() => {
    setQuickContext({ subjectId: id, tab: tab === 'materials' ? 'material' : 'task' });
    return () => setQuickContext({});
  }, [id, tab]);

  if (!data) return null;
  const { subject, units, topics, materials, tasks } = data;
  if (!subject) {
    return (
      <>
        <BackBar />
        <p className="text-muted-foreground">Course not found.</p>
      </>
    );
  }
  const update = (patch: Partial<Subject>) => db.subjects.update(id, patch);
  const counts = countStatuses(topics);
  const openTasks = tasks.filter((t) => t.status !== 'done').length;
  const meta = [subject.code, subject.instructor, subject.examDate && `Exam ${formatDate(subject.examDate)}`].filter(Boolean).join(' · ');

  return (
    <>
      <BackBar
        actions={
          <Button size="sm" variant="outline" asChild>
            <Link to={`/ai?subject=${id}`}>
              <Sparkles /> Work with AI
            </Link>
          </Button>
        }
      />

      {/* Title — edit in place */}
      <input
        key={subject.name}
        defaultValue={subject.name}
        aria-label="Course name"
        placeholder="Untitled course"
        className="mb-1 w-full bg-transparent text-3xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50"
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v && v !== subject.name) update({ name: v });
          else e.target.value = subject.name;
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: subject.color }} />
        {meta || 'Add code, instructor and exam date under About'}
      </div>
      <ProgressBar counts={counts} />
      <div className="mt-1.5 text-xs text-muted-foreground">
        {counts.solid}/{topics.length} topics solid · {openTasks} open task{openTasks === 1 ? '' : 's'}
      </div>

      {/* Fast actions for this course */}
      <div className="mt-4 grid grid-cols-4 gap-2">
        <Button variant="outline" size="sm" onClick={() => openQuickAdd({ tab: 'task', subjectId: id })}>
          <Plus /> Task
        </Button>
        <Button variant="outline" size="sm" onClick={() => openQuickAdd({ tab: 'material', subjectId: id })}>
          <Plus /> Material
        </Button>
        <Button variant="outline" size="sm" onClick={() => openQuickAdd({ tab: 'event', subjectId: id, eventKind: 'class' })}>
          <Plus /> Class
        </Button>
        <StartTimerButton subjectId={id} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })} className="mt-5">
        <TabsList>
          <TabsTrigger value="topics">Topics</TabsTrigger>
          <TabsTrigger value="materials">
            Materials<span className="tabular ml-1.5 text-xs text-muted-foreground">{materials}</span>
          </TabsTrigger>
          <TabsTrigger value="tasks">
            Tasks<span className="tabular ml-1.5 text-xs text-muted-foreground">{openTasks}</span>
          </TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
        </TabsList>

        <TabsContent value="topics">
          <div className="mb-3 flex items-center justify-end">
            <Button size="sm" variant={editMode ? 'default' : 'ghost'} onClick={() => setEditMode((v) => !v)}>
              {editMode ? 'Done' : 'Edit structure'}
            </Button>
          </div>
          {units.length === 0 && <Empty>No units yet. Tap "Edit structure" to add some.</Empty>}
          {units.map((u, i) => (
            <UnitBlock key={u.id} unit={u} topics={topics.filter((t) => t.unitId === u.id)} editMode={editMode} isFirst={i === 0} isLast={i === units.length - 1} />
          ))}
          {editMode && <AddInline placeholder="New unit name" label="Add unit" onAdd={(n) => addUnit(id, n)} />}
        </TabsContent>

        <TabsContent value="materials">
          <MaterialsList subjectId={id} />
        </TabsContent>

        <TabsContent value="tasks">
          <CourseTasks subject={subject} tasks={tasks} topics={topics} />
        </TabsContent>

        <TabsContent value="about">
          <About subject={subject} units={units} topics={topics} update={update} onDeleted={() => navigate('/subjects')} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function BackBar({ actions }: { actions?: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="mb-3 flex items-center justify-between">
      <Button variant="ghost" size="icon" className="-ml-2 h-9 w-9" onClick={() => navigate(-1)} aria-label="Back">
        <ArrowLeft />
      </Button>
      {actions}
    </div>
  );
}

// ---------- Tasks tab ----------
function CourseTasks({ subject, tasks, topics }: { subject: Subject; tasks: Task[]; topics: Topic[] }) {
  const [title, setTitle] = useState('');
  const [editing, setEditing] = useState<Task | null>(null);
  const [showDone, setShowDone] = useState(false);
  const topicName = new Map(topics.map((t) => [t.id!, t.name]));
  const byDue = (a: Task, b: Task) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999');
  const open = tasks.filter((t) => t.status !== 'done').sort(byDue);
  const done = tasks.filter((t) => t.status === 'done').sort(byDue);

  return (
    <div>
      <form
        className="mb-4"
        onSubmit={async (e) => {
          e.preventDefault();
          await addTask({ subjectId: subject.id!, title });
          setTitle('');
        }}
      >
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Add a task for ${subject.name} and press Enter…`} />
      </form>
      {open.length === 0 ? (
        <Empty>No open tasks for this course.</Empty>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {open.map((t) => (
            <TaskRow key={t.id} task={t} topicName={t.topicId ? topicName.get(t.topicId) : undefined} onOpen={setEditing} showCourse={false} />
          ))}
        </ul>
      )}
      {done.length > 0 && (
        <div className="mt-5">
          <button className="mb-2 text-[13px] font-medium text-muted-foreground hover:text-foreground" onClick={() => setShowDone((v) => !v)}>
            {showDone ? 'Hide' : 'Show'} completed ({done.length})
          </button>
          {showDone && (
            <ul className="divide-y rounded-lg border bg-card">
              {done.map((t) => (
                <TaskRow key={t.id} task={t} topicName={t.topicId ? topicName.get(t.topicId) : undefined} onOpen={setEditing} showCourse={false} />
              ))}
            </ul>
          )}
        </div>
      )}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit task</DialogTitle>
          </DialogHeader>
          {editing && <TaskForm key={editing.id} initial={editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- About tab ----------
function describeEvent(e: CalEvent): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const when =
    e.repeat === 'weekly'
      ? [...(e.weekdays ?? [])].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => days[d]).join(', ')
      : formatDate(e.date);
  const time = e.startTime ? ` ${e.startTime}${e.endTime ? '–' + e.endTime : ''}` : '';
  return `${when}${time}${e.location ? ` · ${e.location}` : ''}`;
}

function About({ subject, units, topics, update, onDeleted }: { subject: Subject; units: Unit[]; topics: Topic[]; update: (p: Partial<Subject>) => void; onDeleted: () => void }) {
  const id = subject.id!;
  const events = useLiveQuery(() => db.events.where('subjectId').equals(id).toArray(), [id]) ?? [];
  const [editingEvent, setEditingEvent] = useState<CalEvent | null>(null);

  async function exportKnowledge() {
    const [cards, terms] = await Promise.all([db.knowledgeCards.where('subjectId').equals(id).toArray(), db.terms.where('subjectId').equals(id).toArray()]);
    if (!cards.length && !terms.length) return toast('No knowledge cards or terms yet');
    const md = knowledgeMarkdown(subject.name, units, topics, cards, terms, today());
    await shareOrDownload(`${subject.name.replace(/[^\w]+/g, '-')}-notes-${today()}.md`, md, 'text/markdown');
  }

  return (
    <div>
      <div className="mb-6 divide-y rounded-lg border bg-card px-3 py-1">
        <Prop label="Color">
          <div className="flex flex-wrap gap-2 py-1.5">
            {SUBJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => update({ color: c })}
                aria-label={`Color ${c}`}
                className="flex h-6 w-6 items-center justify-center rounded-full transition-transform active:scale-90"
                style={{ backgroundColor: c }}
              >
                {subject.color === c && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </Prop>
        <Prop label="Course code">
          <TextProp value={subject.code} placeholder="e.g. MATH-AB" onSave={(v) => update({ code: v || undefined })} />
        </Prop>
        <Prop label="Instructor">
          <TextProp value={subject.instructor} placeholder="Teacher name" onSave={(v) => update({ instructor: v || undefined })} />
        </Prop>
        <Prop label="Level">
          <Select className={ghost} value={subject.level} onChange={(e) => update({ level: e.target.value as Level })}>
            <option value="regular">Regular</option>
            <option value="honors">Honors</option>
            <option value="AP">AP</option>
            <option value="none">None</option>
          </Select>
        </Prop>
        <Prop label="Type">
          <Select className={ghost} value={subject.kind} onChange={(e) => update({ kind: e.target.value as SubjectKind })}>
            <option value="course">Course</option>
            <option value="test">Test (e.g. SAT)</option>
            <option value="skill">Skill (e.g. English)</option>
          </Select>
        </Prop>
        <Prop label="Exam">
          <Select className={ghost} value={subject.examStatus} onChange={(e) => update({ examStatus: e.target.value as ExamStatus })}>
            <option value="none">No exam</option>
            <option value="studying">Studying, not booked</option>
            <option value="registered">Registered</option>
            <option value="completed">Completed</option>
          </Select>
        </Prop>
        <Prop label="Exam date">
          <Input type="date" className={ghost} value={subject.examDate ?? ''} onChange={(e) => update({ examDate: e.target.value || undefined })} />
        </Prop>
        <Prop label="Studying now">
          <div className="flex items-center gap-3 py-1.5">
            <Switch on={subject.studying !== false} onChange={(v) => update({ studying: v })} label="Currently studying" />
            <span className="text-xs text-muted-foreground">Shows in "What am I studying?" and on Home</span>
          </div>
        </Prop>
        <Prop label="Terminology">
          <div className="flex items-center gap-3 py-1.5">
            <Switch on={subject.languageLoad} onChange={(v) => update({ languageLoad: v })} label="Terminology-heavy" />
            <span className="text-xs text-muted-foreground">Vocab list + term hints in AI prompts</span>
          </div>
        </Prop>
      </div>

      <Section
        title="Classes & events"
        action={
          <Button size="sm" variant="ghost" onClick={() => openQuickAdd({ tab: 'event', subjectId: id, eventKind: 'class' })}>
            <Plus /> Add class
          </Button>
        }
      >
        {events.length === 0 ? (
          <Empty>No classes or events yet. Add your timetable so it shows on the calendar.</Empty>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {events.map((e) => (
              <li key={e.id}>
                <button onClick={() => setEditingEvent(e)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-accent">
                  <Badge variant={KIND_VARIANT[e.kind]}>{KIND_LABEL[e.kind]}</Badge>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{e.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{describeEvent(e)}</div>
                  </div>
                  <Pencil className="h-4 w-4 text-muted-foreground/60" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Notes">
        <Textarea
          key={subject.notes ?? ''}
          defaultValue={subject.notes ?? ''}
          placeholder="Syllabus link, textbook, teacher email, exam format, anything about this course…"
          className="min-h-[96px] border-transparent bg-transparent hover:bg-accent focus-visible:bg-card"
          onBlur={(e) => e.target.value !== (subject.notes ?? '') && update({ notes: e.target.value })}
        />
      </Section>

      <Section title="Manage">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportKnowledge}>
            <Download /> Export notes
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to={`/ai/setup?subject=${id}`}>AI Setup Kit</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => update({ archived: !subject.archived })}>
            {subject.archived ? 'Unarchive' : 'Archive'}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={async () => {
              if (confirm(`Permanently delete ${subject.name} and ALL its topics, materials, notes, terms, tasks and classes?`)) {
                await deleteSubjectCascade(id);
                onDeleted();
              }
            }}
          >
            <Trash2 /> Delete course
          </Button>
        </div>
      </Section>

      <Dialog open={!!editingEvent} onOpenChange={(o) => !o && setEditingEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editingEvent?.kind}</DialogTitle>
          </DialogHeader>
          {editingEvent && <EventForm key={editingEvent.id} initial={editingEvent} onDone={() => setEditingEvent(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-10 grid-cols-[6.5rem_1fr] items-center gap-2">
      <div className="text-[13px] text-muted-foreground">{label}</div>
      <div className="-ml-2 min-w-0">{children}</div>
    </div>
  );
}

function TextProp({ value, placeholder, onSave }: { value?: string; placeholder: string; onSave: (v: string) => void }) {
  return (
    <Input
      key={value ?? ''}
      defaultValue={value ?? ''}
      placeholder={placeholder}
      className={ghost}
      onBlur={(e) => e.target.value.trim() !== (value ?? '') && onSave(e.target.value.trim())}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  );
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-25 disabled:hover:bg-transparent [&_svg]:size-4"
    >
      {children}
    </button>
  );
}

function UnitBlock({ unit, topics, editMode, isFirst, isLast }: { unit: Unit; topics: Topic[]; editMode: boolean; isFirst: boolean; isLast: boolean }) {
  const solid = topics.filter((t) => t.status === 'solid').length;
  return (
    <div className="mb-6">
      <div className="flex items-center gap-1 border-b pb-1.5">
        {editMode ? (
          <>
            <input
              key={unit.name}
              defaultValue={unit.name}
              aria-label="Unit name"
              className="h-8 min-w-0 flex-1 rounded-md bg-transparent px-2 text-sm font-medium outline-none hover:bg-accent focus:bg-card focus:ring-2 focus:ring-ring/25"
              onBlur={(e) => renameUnit(unit.id!, e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
            <IconBtn label="Move unit up" disabled={isFirst} onClick={() => moveUnit(unit.id!, -1)}>
              <ChevronUp />
            </IconBtn>
            <IconBtn label="Move unit down" disabled={isLast} onClick={() => moveUnit(unit.id!, 1)}>
              <ChevronDown />
            </IconBtn>
            <IconBtn
              label="Delete unit"
              onClick={async () => {
                if (confirm(`Delete "${unit.name}" and its ${topics.length} topics? Notes, mistakes and terms stay in the course.`)) await deleteUnitCascade(unit.id!);
              }}
            >
              <Trash2 />
            </IconBtn>
          </>
        ) : (
          <>
            <h3 className="flex-1 text-sm font-medium">{unit.name}</h3>
            <span className="tabular text-xs text-muted-foreground">
              {solid}/{topics.length}
            </span>
          </>
        )}
      </div>

      <ul>
        {topics.map((t, i) => (
          <li key={t.id} className="border-b border-border/60 last:border-b-0">
            {editMode ? (
              <div className="flex items-center gap-1 py-1">
                <input
                  key={t.name}
                  defaultValue={t.name}
                  aria-label="Topic name"
                  className="h-8 min-w-0 flex-1 rounded-md bg-transparent px-2 text-sm outline-none hover:bg-accent focus:bg-card focus:ring-2 focus:ring-ring/25"
                  onBlur={(e) => renameTopic(t.id!, e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                />
                <IconBtn label="Move topic up" disabled={i === 0} onClick={() => moveTopic(t.id!, -1)}>
                  <ChevronUp />
                </IconBtn>
                <IconBtn label="Move topic down" disabled={i === topics.length - 1} onClick={() => moveTopic(t.id!, 1)}>
                  <ChevronDown />
                </IconBtn>
                <IconBtn
                  label="Delete topic"
                  onClick={async () => {
                    if (confirm(`Delete topic "${t.name}"? Its notes and mistakes stay in the course.`)) await deleteTopic(t.id!);
                  }}
                >
                  <Trash2 />
                </IconBtn>
              </div>
            ) : (
              <Link to={`/topics/${t.id}`} className="-mx-2 flex items-center gap-2 rounded-md px-2 py-2.5 transition-colors hover:bg-accent">
                <span className="flex-1 text-sm">{t.name}</span>
                {t.focus !== 'none' && <span className="text-[11px] font-medium capitalize text-brand">{t.focus}</span>}
                <StatusPill status={t.status} onChange={(s) => setTopicStatus(t.id!, s)} />
                <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
              </Link>
            )}
          </li>
        ))}
        {topics.length === 0 && !editMode && <li className="py-2 text-sm text-muted-foreground">No topics.</li>}
      </ul>

      {editMode && (
        <div className="mt-2">
          <AddInline placeholder="New topic" label="Add" compact onAdd={(n) => addTopic(unit.subjectId, unit.id!, n)} />
        </div>
      )}
    </div>
  );
}

function AddInline({ placeholder, label, onAdd, compact }: { placeholder: string; label: string; onAdd: (name: string) => Promise<void>; compact?: boolean }) {
  const [v, setV] = useState('');
  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!v.trim()) return;
        await onAdd(v);
        setV('');
      }}
    >
      <Input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} className={cn(compact && 'h-9')} />
      <Button type="submit" size={compact ? 'sm' : 'default'} variant="outline" className={cn(compact && 'h-9')}>
        <Plus /> {label}
      </Button>
    </form>
  );
}
