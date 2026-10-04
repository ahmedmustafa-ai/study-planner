import { useEffect, useState } from 'react';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { db } from '@/lib/db';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select } from './ui/select';
import { Field } from './common';
import { SubjectTopicPicker, loadLastPick, saveLastPick, type PickerValue } from './SubjectTopicPicker';
import { toast } from './toast';
import { getQuickContext, openQuickAdd, subscribeQuickAdd, type QuickOpts, type QuickTab } from './quickAddStore';
import { MISTAKE_CAUSES } from '@/config';
import type { MistakeCause } from '@/lib/types';
import { SourceForm } from '@/features/sources/SourceForm';
import { TaskForm } from '@/features/tasks/TaskForm';
import { EventForm } from '@/features/calendar/EventForm';
import { CourseForm } from '@/features/subjects/CourseForm';
import { addCard, addMistake } from '@/features/knowledge/queries';
import { addTerm } from '@/features/vocab/queries';

const TABS: { value: QuickTab; label: string }[] = [
  { value: 'task', label: 'Task' },
  { value: 'event', label: 'Event' },
  { value: 'material', label: 'Material' },
  { value: 'course', label: 'Course' },
  { value: 'note', label: 'Note' },
  { value: 'term', label: 'Term' },
  { value: 'mistake', label: 'Mistake' },
];

/** Which tab makes sense first on each screen. */
function defaultTab(pathname: string): QuickTab {
  if (pathname.startsWith('/calendar')) return 'event';
  if (pathname.startsWith('/library')) return 'material';
  if (pathname.startsWith('/vocab')) return 'term';
  if (pathname === '/subjects') return 'course';
  return 'task';
}

/** Route → what the user is looking at, so the sheet opens pre-filled (course/topic). */
async function contextFromRoute(pathname: string): Promise<QuickOpts> {
  const course = matchPath('/subjects/:id', pathname);
  if (course) return { subjectId: Number(course.params.id) };
  const topic = matchPath('/topics/:id', pathname);
  if (topic) {
    const t = await db.topics.get(Number(topic.params.id));
    if (t) return { subjectId: t.subjectId, topicId: t.id };
  }
  return {};
}

/** Floating "+" and the capture sheet. Any screen can open it via openQuickAdd(). */
export function QuickAdd() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<QuickTab>('task');
  const [opts, setOpts] = useState<QuickOpts>({});
  const [nonce, setNonce] = useState(0); // remount the form so pre-fill applies
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(
    () =>
      subscribeQuickAdd((o) => {
        setOpts(o);
        setTab(o.tab ?? defaultTab(pathname));
        setNonce((n) => n + 1);
        setOpen(true);
      }),
    [pathname],
  );

  async function fab() {
    const fromRoute = await contextFromRoute(pathname);
    openQuickAdd({ ...fromRoute, tab: defaultTab(pathname), ...getQuickContext() });
  }

  const done = () => setOpen(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        size="icon"
        className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-40 h-12 w-12 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.12)]"
        onClick={fab}
        aria-label="Quick add"
      >
        <Plus className="!size-5" strokeWidth={2} />
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as QuickTab)} className="mb-4">
          <TabsList>
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div key={`${tab}-${nonce}`}>
          {tab === 'task' && <TaskForm defaults={{ subjectId: opts.subjectId, topicId: opts.topicId, dueDate: opts.date }} onDone={done} />}
          {tab === 'event' && <EventForm defaults={{ subjectId: opts.subjectId, date: opts.date, kind: opts.eventKind }} onDone={done} />}
          {tab === 'material' && <SourceForm defaults={{ subjectId: opts.subjectId, topicId: opts.topicId }} onSaved={done} />}
          {tab === 'course' && (
            <CourseForm
              onCreated={(id) => {
                done();
                navigate(`/subjects/${id}`);
              }}
            />
          )}
          {(tab === 'note' || tab === 'term' || tab === 'mistake') && <NoteTermMistakeForm kind={tab} defaults={opts} done={done} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NoteTermMistakeForm({ kind, defaults, done }: { kind: 'note' | 'term' | 'mistake'; defaults: QuickOpts; done: () => void }) {
  const [pick, setPick] = useState<PickerValue>(defaults.subjectId ? { subjectId: defaults.subjectId, topicId: defaults.topicId } : loadLastPick());
  const [text, setText] = useState('');
  const [extra, setExtra] = useState('');
  const [cause, setCause] = useState<MistakeCause>('concept');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pick.subjectId) return toast('Choose a course');
    if (!text.trim()) return;
    const base = { subjectId: pick.subjectId, topicId: pick.topicId };
    if (kind === 'note') await addCard({ ...base, text });
    if (kind === 'term') {
      const isNew = await addTerm({ ...base, term: text, definition: extra });
      if (!isNew) toast('Term already existed — definition updated');
    }
    if (kind === 'mistake') await addMistake({ ...base, text, cause });
    saveLastPick(pick);
    toast('Saved');
    done();
  }

  const labels = {
    note: ['Knowledge card', 'One idea you want to keep, in your own words'],
    term: ['Term', 'e.g. osmosis'],
    mistake: ['What went wrong', 'e.g. Forgot to apply the chain rule on sin(2x)'],
  } as const;

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label={labels[kind][0]}>
        {kind === 'term' ? (
          <Input autoFocus placeholder={labels[kind][1]} value={text} onChange={(e) => setText(e.target.value)} />
        ) : (
          <Textarea autoFocus rows={3} placeholder={labels[kind][1]} value={text} onChange={(e) => setText(e.target.value)} />
        )}
      </Field>
      {kind === 'term' && (
        <Field label="Simple-English definition">
          <Input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Short, in your own words" />
        </Field>
      )}
      {kind === 'mistake' && (
        <Field label="Cause" hint={MISTAKE_CAUSES.find((c) => c.value === cause)?.hint}>
          <Select value={cause} onChange={(e) => setCause(e.target.value as MistakeCause)}>
            {MISTAKE_CAUSES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <SubjectTopicPicker value={pick} onChange={setPick} />
      <Button type="submit" className="w-full">
        Save
      </Button>
    </form>
  );
}
