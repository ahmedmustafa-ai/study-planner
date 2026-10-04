import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Copy, ExternalLink } from 'lucide-react';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/common';
import { toast } from '@/components/toast';
import { AI_TOOLS } from '@/config';
import { copyText, formatDate } from '@/lib/utils';
import { StatusPicker } from '@/features/subjects/StatusPill';
import { setTopicStatus } from '@/features/subjects/topicActions';
import { TOOL_URLS } from './context';
import { CaptureFiler } from './CaptureFiler';

export function SessionPage() {
  const id = Number(useParams().id);
  const data = useLiveQuery(async () => {
    const session = await db.aiSessions.get(id);
    if (!session) return { session };
    const [subject, topic] = await Promise.all([db.subjects.get(session.subjectId), session.topicId ? db.topics.get(session.topicId) : undefined]);
    return { session, subject, topic };
  }, [id]);
  const [showPrompt, setShowPrompt] = useState(false);

  if (!data) return null;
  if (!data.session) return <PageHeader back title="Session not found" />;
  const { session, subject, topic } = data;
  const toolInfo = AI_TOOLS.find((t) => t.value === session.tool);
  const toolUrl = TOOL_URLS[session.tool];

  return (
    <>
      <PageHeader
        back
        title={topic?.name ?? subject?.name ?? 'AI session'}
        subtitle={`${formatDate(session.createdAt)} · ${toolInfo?.label}`}
      />

      <Card className="mb-3 p-4">
        <div className="mb-1 flex items-center gap-2">
          <Badge>Box 1</Badge>
          <span className="text-sm font-medium">Your attempt (saved)</span>
        </div>
        <p className="whitespace-pre-wrap text-sm">{session.attempt}</p>
      </Card>

      <Card className="mb-3 space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Badge>Box 2</Badge>
          <span className="text-sm font-medium">Send to {toolInfo?.label}</span>
        </div>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Copy the prompt.</li>
          <li>Open {toolInfo?.label}{subject ? ` (use your "${subject.name}" project/notebook)` : ''} and paste.</li>
          <li>Talk with the AI as long as you need.</li>
          <li>Copy its final Capture Block and paste it below.</li>
        </ol>
        <div className="flex flex-wrap gap-2">
          <Button onClick={async () => toast((await copyText(session.prompt)) ? 'Prompt copied' : 'Copy failed')}>
            <Copy /> Copy prompt
          </Button>
          {toolUrl && (
            <Button variant="outline" asChild>
              <a href={toolUrl} target="_blank" rel="noreferrer">
                <ExternalLink /> Open {toolInfo?.role}
              </a>
            </Button>
          )}
          <Button variant="ghost" onClick={() => setShowPrompt((v) => !v)}>
            {showPrompt ? 'Hide' : 'Show'} prompt
          </Button>
        </div>
        {showPrompt && <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{session.prompt}</pre>}
      </Card>

      <CaptureFiler sessionId={id} subjectId={session.subjectId} topicId={session.topicId} alreadyFiled={!!session.returnRaw} />

      {topic && session.returnRaw && (
        <Card className="mt-3 space-y-2 p-4">
          <div className="text-sm font-medium">After this session, how well do you know "{topic.name}"?</div>
          <StatusPicker status={topic.status} onChange={(s) => setTopicStatus(topic.id!, s)} />
          <Link to={`/topics/${topic.id}`} className="block text-sm text-brand hover:underline">
            Open topic →
          </Link>
        </Card>
      )}
    </>
  );
}
