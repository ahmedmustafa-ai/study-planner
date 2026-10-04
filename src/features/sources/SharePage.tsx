import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/common';
import { extractUrl } from '@/lib/utils';
import { SourceForm } from './SourceForm';
import { guessKind } from './queries';

/** Landing page for Android "Share → Study OS". */
export function SharePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const title = params.get('title') ?? '';
  const text = params.get('text') ?? '';
  // Android often puts the link inside `text` instead of `url`.
  const url = params.get('url') || extractUrl(text) || '';
  const note = text.replace(url, '').trim();

  return (
    <>
      <PageHeader title="Save to Study OS" subtitle="Tag it to a topic so you can find it when you need it" />
      <SourceForm
        initial={{ title: title || note.slice(0, 80), url, content: note && note !== title ? note : undefined, kind: guessKind(url) }}
        onSaved={() => navigate('/library', { replace: true })}
      />
    </>
  );
}
