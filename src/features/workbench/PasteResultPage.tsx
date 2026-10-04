import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { PageHeader } from '@/components/common';
import { CaptureFiler } from './CaptureFiler';

/** Fastest path from an AI chat back into Study OS: paste → preview → file. */
export function PasteResultPage() {
  const navigate = useNavigate();
  // If you have an AI session waiting for its result, start with that course and topic.
  const pending = useLiveQuery(async () => (await db.aiSessions.orderBy('createdAt').reverse().toArray()).find((s) => !s.returnRaw), []);
  return (
    <>
      <PageHeader back title="File an AI result" subtitle="Paste the reply. Cards, terms, mistakes and tasks go where they belong." />
      <CaptureFiler
        key={pending?.id ?? 'none'}
        subjectId={pending?.subjectId}
        topicId={pending?.topicId}
        sessionId={pending?.id}
        withPicker
        autoPaste
        onFiled={() => navigate(pending?.topicId ? `/topics/${pending.topicId}` : '/')}
      />
    </>
  );
}
