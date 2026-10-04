import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { db, setSetting } from '@/lib/db';
import { useSetting, useSubjects } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Field, PageHeader, Section } from '@/components/common';
import { toast } from '@/components/toast';
import { AI_TOOLS, DEFAULT_PROFILE } from '@/config';
import { buildSetupInstructions } from '@/lib/algorithms/contextPack';
import { knowledgeMarkdown } from '@/lib/algorithms/planning';
import { cn, copyText, shareOrDownload, today } from '@/lib/utils';
import { TOOL_URLS } from './context';

const KIT = [
  {
    tool: 'chatgpt',
    steps: ['Open ChatGPT → Projects → New project, name it after the subject.', 'Open project settings → Instructions → paste the text below.', 'Add your exported notes file (.md) to the project files.'],
  },
  {
    tool: 'notebooklm',
    steps: [
      'Create a new notebook named after the subject.',
      'Add sources: your textbook chapters / slides (PDF or Google Drive) + your exported notes file (.md).',
      'In the chat, open the configure/customize option and paste the text below as the custom instructions (or paste it as your first message).',
    ],
  },
  {
    tool: 'claude',
    steps: ['Create a Project for the subject (or start a chat).', 'Paste the text below as project instructions (or as your first message).', 'Use it for FRQ grading and writing feedback.'],
  },
] as const;

export function SetupKitPage() {
  const [params] = useSearchParams();
  const subjects = useSubjects() ?? [];
  const [subjectId, setSubjectId] = useState<number | ''>(params.get('subject') ? Number(params.get('subject')) : '');
  const subject = subjects.find((s) => s.id === subjectId) ?? subjects[0];
  const profile = useSetting('profile', DEFAULT_PROFILE);
  const done = useLiveQuery(async () => {
    if (!subject) return {} as Record<string, boolean>;
    const rows = await db.settings.where('key').startsWith(`setup.${subject.id}.`).toArray();
    return Object.fromEntries(rows.map((r) => [r.key.split('.')[2], !!r.value]));
  }, [subject?.id]) ?? {};

  if (!subject) return <PageHeader back title="AI Setup Kit" subtitle="Add a subject first" />;

  async function exportNotes() {
    const [units, topics, cards, terms] = await Promise.all([
      db.units.where('subjectId').equals(subject.id!).toArray(),
      db.topics.where('subjectId').equals(subject.id!).toArray(),
      db.knowledgeCards.where('subjectId').equals(subject.id!).toArray(),
      db.terms.where('subjectId').equals(subject.id!).toArray(),
    ]);
    const md = knowledgeMarkdown(subject.name, units, topics, cards, terms, today());
    await shareOrDownload(`${subject.name.replace(/[^\w]+/g, '-')}-notes-${today()}.md`, md, 'text/markdown');
  }

  return (
    <>
      <PageHeader back title="AI Setup Kit" subtitle="Do once per subject. Every AI then knows you and speaks the Capture Block format." />
      <Field label="Subject">
        <Select value={subject.id} onChange={(e) => setSubjectId(Number(e.target.value))}>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>

      <Card className="my-4 p-4 text-sm">
        <div className="mb-1 font-medium">Who does what</div>
        <ul className="space-y-1 text-muted-foreground">
          {AI_TOOLS.slice(0, 3).map((t) => (
            <li key={t.value}>
              <span className="font-medium text-foreground">{t.role}</span> — {t.label}: {t.bestFor}
            </li>
          ))}
          <li>
            <span className="font-medium text-foreground">Brain</span> — Study OS: remembers what all of them taught you.
          </li>
        </ul>
        <Button variant="outline" size="sm" className="mt-3" onClick={exportNotes}>
          Export {subject.name} notes (.md) to upload
        </Button>
      </Card>

      {KIT.map((k) => {
        const info = AI_TOOLS.find((t) => t.value === k.tool)!;
        const text = buildSetupInstructions(profile, subject.name, info.role, subject.languageLoad);
        const isDone = !!done[k.tool];
        return (
          <Section
            key={k.tool}
            title={`${info.role}: ${info.label}`}
            action={
              <button
                onClick={() => setSetting(`setup.${subject.id}.${k.tool}`, !isDone)}
                className={cn('flex items-center gap-1 rounded-full px-2 py-0.5 text-xs', isDone ? 'bg-tag-green text-tag-green-fg' : 'bg-muted text-muted-foreground')}
              >
                <Check className="h-3 w-3" /> {isDone ? 'Set up' : 'Mark done'}
              </button>
            }
          >
            <Card className="space-y-3 p-4">
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {k.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{text}</pre>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={async () => toast((await copyText(text)) ? 'Instructions copied' : 'Copy failed')}>
                  <Copy /> Copy instructions
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={TOOL_URLS[k.tool]} target="_blank" rel="noreferrer">
                    <ExternalLink /> Open
                  </a>
                </Button>
              </div>
            </Card>
          </Section>
        );
      })}
    </>
  );
}
