import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import type { Activity, Milestone, Score } from '@/lib/types';
import { useSubjects } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/common';
import { SubjectTopicPicker } from '@/components/SubjectTopicPicker';
import { toast } from '@/components/toast';
import { today } from '@/lib/utils';

const num = (v: string) => (v === '' ? undefined : Number(v));

function DeleteButton({ onDelete }: { onDelete: () => Promise<unknown> }) {
  return (
    <Button type="button" variant="destructive" onClick={async () => confirm('Delete?') && (await onDelete())}>
      <Trash2 />
    </Button>
  );
}

export function MilestoneForm({ initial, onDone }: { initial?: Milestone; onDone: () => void }) {
  const subjects = useSubjects() ?? [];
  const [m, setM] = useState<Milestone>(initial ?? { title: '', date: today(), kind: 'deadline', done: false });
  const set = (patch: Partial<Milestone>) => setM({ ...m, ...patch });
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!m.title.trim()) return toast('Add a title');
        await db.milestones.put(m);
        onDone();
      }}
    >
      <Field label="Title">
        <Input value={m.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. SAT test day, Calc checkpoint" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <Select value={m.kind} onChange={(e) => set({ kind: e.target.value as Milestone['kind'] })}>
            <option value="deadline">Deadline</option>
            <option value="checkpoint">Checkpoint (scored)</option>
          </Select>
        </Field>
        <Field label="Date">
          <Input type="date" value={m.date} onChange={(e) => set({ date: e.target.value })} />
        </Field>
      </div>
      <Field label="Subject (optional)">
        <Select value={m.subjectId ?? ''} onChange={(e) => set({ subjectId: num(e.target.value) })}>
          <option value="">— none —</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      {m.kind === 'checkpoint' && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Target %">
              <Input type="number" inputMode="numeric" value={m.target ?? ''} onChange={(e) => set({ target: num(e.target.value) })} />
            </Field>
            <Field label="Pass line %">
              <Input type="number" inputMode="numeric" value={m.passThreshold ?? ''} onChange={(e) => set({ passThreshold: num(e.target.value) })} />
            </Field>
            <Field label="Result %">
              <Input type="number" inputMode="numeric" value={m.result ?? ''} onChange={(e) => set({ result: num(e.target.value) })} />
            </Field>
          </div>
          <Field label="If passed, then…">
            <Input value={m.onPass ?? ''} onChange={(e) => set({ onPass: e.target.value })} />
          </Field>
          <Field label="If below the line, then…">
            <Input value={m.onFail ?? ''} onChange={(e) => set({ onFail: e.target.value })} />
          </Field>
        </>
      )}
      <Field label="Note">
        <Textarea rows={2} value={m.note ?? ''} onChange={(e) => set({ note: e.target.value })} />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" className="flex-1">
          Save
        </Button>
        {m.id && <DeleteButton onDelete={async () => (await db.milestones.delete(m.id!), onDone())} />}
      </div>
    </form>
  );
}

export function ScoreForm({ initial, onDone }: { initial?: Score; onDone: () => void }) {
  const subjects = useSubjects() ?? [];
  const [s, setS] = useState<Score>(initial ?? { subjectId: subjects[0]?.id ?? 0, label: '', date: today(), score: 0, max: 100 });
  const subject = subjects.find((x) => x.id === s.subjectId);
  const isSat = subject?.kind === 'test' && /sat/i.test(subject.name);
  const set = (patch: Partial<Score>) => setS({ ...s, ...patch });
  const rw = s.sections?.['R&W'];
  const math = s.sections?.['Math'];

  function setSection(k: 'R&W' | 'Math', v: string) {
    const sections = { ...(s.sections ?? {}), [k]: Number(v) || 0 };
    set({ sections, score: (sections['R&W'] ?? 0) + (sections['Math'] ?? 0), max: 1600 });
  }

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!s.subjectId) return toast('Choose a subject');
        if (!s.label.trim()) return toast('Add a label, e.g. "Quiz 2.1" or "Bluebook Test 1"');
        if (!(s.max > 0)) return toast('Max must be > 0');
        await db.scores.put(s);
        onDone();
      }}
    >
      <SubjectTopicPicker value={{ subjectId: s.subjectId, topicId: s.topicId }} onChange={(v) => set({ subjectId: v.subjectId ?? 0, topicId: v.topicId })} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Label">
          <Input value={s.label} onChange={(e) => set({ label: e.target.value })} placeholder={isSat ? 'Bluebook Practice Test 1' : 'Unit 1 quiz'} />
        </Field>
        <Field label="Date">
          <Input type="date" value={s.date} onChange={(e) => set({ date: e.target.value })} />
        </Field>
      </div>
      {isSat ? (
        <div className="grid grid-cols-3 gap-3">
          <Field label="R&W (200–800)">
            <Input type="number" inputMode="numeric" value={rw ?? ''} onChange={(e) => setSection('R&W', e.target.value)} />
          </Field>
          <Field label="Math (200–800)">
            <Input type="number" inputMode="numeric" value={math ?? ''} onChange={(e) => setSection('Math', e.target.value)} />
          </Field>
          <Field label="Total">
            <Input value={s.score || ''} readOnly />
          </Field>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Score">
            <Input type="number" inputMode="decimal" value={s.score} onChange={(e) => set({ score: Number(e.target.value) })} />
          </Field>
          <Field label="Out of">
            <Input type="number" inputMode="decimal" value={s.max} onChange={(e) => set({ max: Number(e.target.value) })} />
          </Field>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Pick a topic when the score is about one topic — scores under 70% then show up in weak spots.</p>
      <div className="flex gap-2">
        <Button type="submit" className="flex-1">
          Save
        </Button>
        {s.id && <DeleteButton onDelete={async () => (await db.scores.delete(s.id!), onDone())} />}
      </div>
    </form>
  );
}

export function ActivityForm({ initial, onDone }: { initial?: Activity; onDone: () => void }) {
  const [a, setA] = useState<Activity>(initial ?? { title: '', date: today(), category: 'robotics', description: '' });
  const set = (patch: Partial<Activity>) => setA({ ...a, ...patch });
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!a.title.trim()) return toast('Add a title');
        await db.activities.put(a);
        onDone();
      }}
    >
      <Field label="What happened">
        <Input value={a.title} onChange={(e) => set({ title: e.target.value })} placeholder="e.g. Built line-following robot for regional comp" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <Select value={a.category} onChange={(e) => set({ category: e.target.value as Activity['category'] })}>
            <option value="robotics">Robotics</option>
            <option value="project">Project</option>
            <option value="competition">Competition</option>
            <option value="award">Award</option>
            <option value="volunteering">Volunteering</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Date">
          <Input type="date" value={a.date} onChange={(e) => set({ date: e.target.value })} />
        </Field>
      </div>
      <Field label="Details" hint="Your role, what you built/learned, results. Numbers help (team size, placement, hours).">
        <Textarea rows={4} value={a.description} onChange={(e) => set({ description: e.target.value })} />
      </Field>
      <Field label="Link / evidence (optional)">
        <Input type="url" value={a.url ?? ''} onChange={(e) => set({ url: e.target.value || undefined })} placeholder="Photo album, video, GitHub…" />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" className="flex-1">
          Save
        </Button>
        {a.id && <DeleteButton onDelete={async () => (await db.activities.delete(a.id!), onDone())} />}
      </div>
    </form>
  );
}
