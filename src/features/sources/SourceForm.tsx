import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/common';
import { SubjectTopicPicker, loadLastPick, saveLastPick, type PickerValue } from '@/components/SubjectTopicPicker';
import { toast } from '@/components/toast';
import { AI_TOOLS, SOURCE_KINDS, SOURCE_ROLES } from '@/config';
import { describeLink, extractUrls } from '@/lib/algorithms/links';
import type { AiTool, Source, SourceKind, SourceRole } from '@/lib/types';
import { guessKind, saveSource } from './queries';

/** Add or edit a material. Paste one Google Drive / Docs / YouTube link — or several at once. */
export function SourceForm({
  initial,
  defaults,
  onSaved,
}: {
  initial?: Partial<Source>;
  defaults?: { subjectId?: number; topicId?: number };
  onSaved?: () => void;
}) {
  const last = loadLastPick();
  const [pick, setPick] = useState<PickerValue>({
    subjectId: initial?.subjectId ?? defaults?.subjectId ?? last.subjectId,
    topicId: initial?.topicIds?.[0] ?? (initial ? undefined : defaults?.subjectId ? defaults.topicId : last.topicId),
  });
  const [title, setTitle] = useState(initial?.title ?? '');
  const [url, setUrl] = useState(initial?.url ?? '');
  const [kind, setKind] = useState<SourceKind>(initial?.kind ?? guessKind(initial?.url));
  const [role, setRole] = useState<SourceRole>(initial?.role ?? 'learn');
  const [tool, setTool] = useState<AiTool | ''>(initial?.tool ?? '');
  const [content, setContent] = useState(initial?.content ?? '');

  const urls = extractUrls(url);
  const many = !initial?.id && urls.length > 1;
  const info = describeLink(urls[0] ?? url);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pick.subjectId) return toast('Choose a course');
    if (!title.trim() && !url.trim() && !content.trim()) return toast('Add a title, link or note');
    const base = { subjectId: pick.subjectId, topicIds: pick.topicId ? [pick.topicId] : [], role, content: content.trim() || undefined };

    if (many) {
      // One material per link. Each link gets its own type (Drive file, YouTube, …).
      for (const [i, u] of urls.entries()) {
        const label = describeLink(u).label;
        await saveSource({ ...base, kind: guessKind(u), title: title.trim() ? `${title.trim()} (${i + 1})` : `${label} ${i + 1}`, url: u });
      }
      saveLastPick(pick);
      toast(`Saved ${urls.length} materials`);
      onSaved?.();
      return;
    }

    await saveSource({
      ...base,
      id: initial?.id,
      dateAdded: initial?.dateAdded,
      kind,
      title: title || content.slice(0, 60),
      url: (urls[0] ?? url.trim()) || undefined,
      tool: kind === 'ai-chat' && tool ? tool : undefined,
    });
    saveLastPick(pick);
    toast(initial?.id ? 'Material updated' : 'Material saved');
    onSaved?.();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label={initial?.id ? 'Link' : 'Link (paste one or many)'}>
        <Textarea
          rows={url.includes('\n') ? 3 : 2}
          placeholder="https://drive.google.com/…  (Drive, Docs, Slides, YouTube…)"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (!initial?.kind) setKind(guessKind(extractUrls(e.target.value)[0] ?? e.target.value));
          }}
        />
        {many ? (
          <span className="block text-xs text-tag-blue-fg">{urls.length} links found. One material will be added for each.</span>
        ) : info.google ? (
          <span className="block text-xs text-muted-foreground">
            {info.label}. It opens when you are signed in to a Google account that can see it. Check the sharing in Drive.
            {info.service === 'drive-file' || info.service === 'doc' || info.service === 'slide' ? ' NotebookLM can also add this file from Drive as a source.' : ''}
          </span>
        ) : null}
      </Field>
      <Field label={many ? 'Title prefix (optional)' : 'Title'}>
        <Input placeholder={info.google ? `e.g. ${info.label} — chapter 3 notes` : 'e.g. Khan — chain rule video'} value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <SubjectTopicPicker value={pick} onChange={setPick} />
      <div className="grid grid-cols-2 gap-3">
        {!many && (
          <Field label="Type">
            <Select value={kind} onChange={(e) => setKind(e.target.value as SourceKind)}>
              {SOURCE_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Use it to">
          <Select value={role} onChange={(e) => setRole(e.target.value as SourceRole)}>
            {SOURCE_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {kind === 'ai-chat' && !many && (
        <Field label="AI tool">
          <Select value={tool} onChange={(e) => setTool(e.target.value as AiTool)}>
            <option value="">—</option>
            {AI_TOOLS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label={kind === 'book' ? 'Pages / chapter' : 'Note (optional)'}>
        <Textarea rows={3} value={content} onChange={(e) => setContent(e.target.value)} placeholder={kind === 'book' ? 'Textbook ch. 4, p. 112–120' : ''} />
      </Field>
      <Button type="submit" className="w-full">
        {many ? `Save ${urls.length} materials` : 'Save material'}
      </Button>
    </form>
  );
}
