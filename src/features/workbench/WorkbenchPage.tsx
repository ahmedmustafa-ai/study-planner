import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { BookMarked, ClipboardPaste, Lock, Settings2, Sparkles, Unlock } from 'lucide-react';
import { db } from '@/lib/db';
import type { AiTool } from '@/lib/types';
import { useSubjectMap, useTopicMap } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Empty, Field, PageHeader, Section } from '@/components/common';
import { SubjectTopicPicker, loadLastPick, saveLastPick, type PickerValue } from '@/components/SubjectTopicPicker';
import { toast } from '@/components/toast';
import { AI_TOOLS, MIN_ATTEMPT_CHARS } from '@/config';
import { fillPrompt } from '@/lib/algorithms/contextPack';
import { cn, copyText, formatDate } from '@/lib/utils';
import { gatherContext } from './context';

export function WorkbenchPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [pick, setPick] = useState<PickerValue>(() => {
    const s = params.get('subject');
    const t = params.get('topic');
    return s ? { subjectId: Number(s), topicId: t ? Number(t) : undefined } : loadLastPick();
  });
  const prompts = useLiveQuery(() => db.prompts.toArray(), []) ?? [];
  const [promptId, setPromptId] = useState<number | ''>('');
  const [tool, setTool] = useState<AiTool>('chatgpt');
  const [attempt, setAttempt] = useState('');
  const subjectMap = useSubjectMap();
  const topicMap = useTopicMap();
  const sessions = useLiveQuery(() => db.aiSessions.orderBy('createdAt').reverse().limit(15).toArray(), []) ?? [];

  useEffect(() => {
    if (promptId === '' && prompts.length) setPromptId(prompts[0].id!);
  }, [prompts, promptId]);
  const prompt = prompts.find((p) => p.id === promptId);
  useEffect(() => {
    if (prompt) setTool(prompt.tool);
  }, [prompt]);

  const unlocked = attempt.trim().length >= MIN_ATTEMPT_CHARS;
  const pending = sessions.filter((s) => !s.returnRaw);

  async function unlock() {
    if (!pick.subjectId) return toast('Choose a subject');
    if (!prompt) return toast('Choose a prompt');
    const subject = subjectMap.get(pick.subjectId);
    const topic = pick.topicId ? topicMap.get(pick.topicId) : undefined;
    const context = await gatherContext(pick.subjectId, pick.topicId);
    const text = fillPrompt(prompt.body, { subject: subject?.name ?? '', topic: topic?.name ?? '', attempt, context });
    const id = await db.aiSessions.add({
      subjectId: pick.subjectId,
      topicId: pick.topicId,
      tool,
      promptId: prompt.id,
      attempt: attempt.trim(),
      prompt: text,
      createdAt: new Date().toISOString(),
    });
    saveLastPick(pick);
    const ok = await copyText(text);
    toast(ok ? 'Prompt copied — paste it into your AI' : 'Copy failed — use the Copy button');
    navigate(`/ai/session/${id}`);
  }

  async function copyContextOnly() {
    if (!pick.subjectId) return toast('Choose a subject');
    const ok = await copyText(await gatherContext(pick.subjectId, pick.topicId));
    toast(ok ? 'Context copied' : 'Copy failed');
  }

  return (
    <>
      <PageHeader
        title="AI Workbench"
        subtitle="You try first → AI helps → you keep what you learned"
        actions={
          <>
            <Button variant="ghost" size="icon" asChild aria-label="Paste an AI result">
              <Link to="/ai/paste">
                <ClipboardPaste />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" asChild aria-label="Setup Kit">
              <Link to={`/ai/setup${pick.subjectId ? `?subject=${pick.subjectId}` : ''}`}>
                <Settings2 />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" asChild aria-label="Prompt library">
              <Link to="/ai/prompts">
                <BookMarked />
              </Link>
            </Button>
          </>
        }
      />

      {pending.length > 0 && (
        <Card className="mb-4 border-transparent bg-tag-yellow p-3 text-tag-yellow-fg">
          <div className="mb-1 text-sm font-medium">Waiting for your AI result</div>
          <ul className="space-y-1 text-sm">
            {pending.slice(0, 3).map((s) => (
              <li key={s.id}>
                <Link to={`/ai/session/${s.id}`} className="text-brand hover:underline">
                  {topicMap.get(s.topicId ?? -1)?.name ?? subjectMap.get(s.subjectId)?.name} — paste the Capture Block →
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="mb-4 space-y-3 p-4">
        <SubjectTopicPicker value={pick} onChange={setPick} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="What do you need?">
            <Select value={promptId} onChange={(e) => setPromptId(Number(e.target.value))}>
              {prompts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tool">
            <Select value={tool} onChange={(e) => setTool(e.target.value as AiTool)}>
              {AI_TOOLS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {prompt && <p className="text-xs text-muted-foreground">{prompt.purpose}. Best tool: {AI_TOOLS.find((t) => t.value === prompt.tool)?.label}.</p>}
      </Card>

      {/* Box 1 */}
      <Card className="mb-3 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Badge>Box 1</Badge>
          <span className="text-sm font-medium">Your attempt — required first</span>
        </div>
        <Textarea
          rows={6}
          value={attempt}
          onChange={(e) => setAttempt(e.target.value)}
          placeholder="Write what you think, your working, your answer, or what confuses you. A wrong attempt is fine — it's what the AI needs to help you."
        />
        <div className="mt-1 text-right text-xs text-muted-foreground">
          {unlocked ? 'Unlocked' : `${Math.max(0, MIN_ATTEMPT_CHARS - attempt.trim().length)} more characters to unlock`}
        </div>
      </Card>

      {/* Box 2 */}
      <Card className={cn('mb-6 p-4 transition-opacity', !unlocked && 'opacity-60')}>
        <div className="mb-2 flex items-center gap-2">
          <Badge variant={unlocked ? 'default' : 'secondary'}>Box 2</Badge>
          <span className="text-sm font-medium">AI help</span>
          {unlocked ? <Unlock className="h-4 w-4 text-brand" /> : <Lock className="h-4 w-4" />}
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          Builds a prompt with your attempt + your notes, weak spots, terms and sources, and asks the AI to end with a Capture Block.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="flex-1" disabled={!unlocked} onClick={unlock}>
            <Sparkles /> Copy prompt & continue
          </Button>
          <Button variant="outline" disabled={!unlocked} onClick={copyContextOnly}>
            Copy AI Context only
          </Button>
        </div>
      </Card>

      <Section title="Recent sessions">
        {sessions.length === 0 ? (
          <Empty>No sessions yet.</Empty>
        ) : (
          <ul className="space-y-1.5">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link to={`/ai/session/${s.id}`} className="block rounded-md border p-2.5 text-sm hover:bg-accent/50">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {formatDate(s.createdAt)} · {AI_TOOLS.find((t) => t.value === s.tool)?.label} · {subjectMap.get(s.subjectId)?.name}
                    {s.topicId && ` · ${topicMap.get(s.topicId)?.name ?? ''}`}
                    {!s.returnRaw && <Badge variant="warning">pending</Badge>}
                  </div>
                  <div className="line-clamp-1">{s.attempt}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
