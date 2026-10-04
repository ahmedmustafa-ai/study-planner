import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Field } from '@/components/common';
import { toast } from '@/components/toast';
import { db } from '@/lib/db';
import { TEMPLATES } from './templates';
import { createSubjectFromTemplate, currentYearId } from './queries';

/** New course from a template (unit/topic names only) — or blank. Everything is editable afterwards. */
export function CourseForm({ onCreated }: { onCreated: (subjectId: number) => void }) {
  const [key, setKey] = useState(TEMPLATES[0].key);
  const [name, setName] = useState('');
  const tpl = TEMPLATES.find((t) => t.key === key)!;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const yearId = await currentYearId();
    const count = await db.subjects.count();
    const id = await createSubjectFromTemplate(tpl, yearId, { name: name.trim() || tpl.name, order: count });
    toast(`${name.trim() || tpl.name} added`);
    setName('');
    onCreated(id);
  }

  return (
    <form onSubmit={create} className="space-y-4">
      <Field label="Start from" hint="Unit and topic names only. Rename, reorder, add or delete anything afterwards.">
        <Select value={key} onChange={(e) => setKey(e.target.value)}>
          {TEMPLATES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.key === 'blank' ? 'Blank course' : t.name} ({t.units.reduce((n, u) => n + u.topics.length, 0)} topics)
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Name">
        <Input autoFocus placeholder={tpl.name} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Button type="submit" className="w-full">
        Create course
      </Button>
    </form>
  );
}
