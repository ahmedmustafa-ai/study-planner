import { useEffect, useMemo, useState } from 'react';
import { ClipboardPaste, Copy } from 'lucide-react';
import { db } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { SubjectTopicPicker, loadLastPick, saveLastPick, type PickerValue } from '@/components/SubjectTopicPicker';
import { toast } from '@/components/toast';
import { CAPTURE_REASK, CAPTURE_START, MISTAKE_CAUSES } from '@/config';
import { captureCount, parseCapture, type CaptureResult } from '@/lib/algorithms/capture';
import { copyText } from '@/lib/utils';
import { fileCapture, type CaptureSelection } from './context';

const LOOKS_LIKE_CAPTURE = /TAKEAWAY\s*:|TERM\s*:|MISTAKE\s*:|NEXT\s*:/i;

/**
 * Paste an AI reply → preview → file the parts (cards, terms, mistakes, tasks).
 * Used inside an AI session (course/topic known) and on the standalone "paste a result" page (pick them here).
 */
export function CaptureFiler({
  subjectId,
  topicId,
  sessionId,
  alreadyFiled,
  withPicker,
  autoPaste,
  onFiled,
}: {
  subjectId?: number;
  topicId?: number;
  sessionId?: number;
  alreadyFiled?: boolean;
  withPicker?: boolean;
  autoPaste?: boolean;
  onFiled?: (n: number) => void;
}) {
  const [pick, setPick] = useState<PickerValue>(subjectId ? { subjectId, topicId } : loadLastPick());
  const [raw, setRaw] = useState('');
  const [sel, setSel] = useState<CaptureSelection | null>(null);
  const [saving, setSaving] = useState(false);
  const parsed = useMemo<CaptureResult | null>(() => (raw.trim() ? parseCapture(raw) : null), [raw]);
  const targetSubject = withPicker ? pick.subjectId : subjectId;
  const targetTopic = withPicker ? pick.topicId : topicId;

  // On the paste page, try the clipboard straight away (Android may ask permission or refuse — then use the button).
  useEffect(() => {
    if (!autoPaste) return;
    navigator.clipboard
      ?.readText()
      .then((t) => LOOKS_LIKE_CAPTURE.test(t) && setRaw(t))
      .catch(() => undefined);
  }, [autoPaste]);

  const selection: CaptureSelection | null = parsed
    ? (sel ?? {
        takeaways: parsed.takeaways.map(() => true),
        terms: parsed.terms.map(() => true),
        mistakes: parsed.mistakes.map(() => true),
        next: parsed.next.map(() => true),
      })
    : null;

  function toggle(k: keyof CaptureSelection, i: number) {
    if (selection) setSel({ ...selection, [k]: selection[k].map((v, j) => (j === i ? !v : v)) });
  }

  async function paste() {
    try {
      setRaw(await navigator.clipboard.readText());
      setSel(null);
    } catch {
      toast('Paste blocked — long-press the box and paste');
    }
  }

  async function save() {
    if (!parsed || !selection) return;
    if (!targetSubject) return toast('Choose a course first');
    setSaving(true);
    const n = await fileCapture(parsed, selection, targetSubject, targetTopic);
    if (sessionId) {
      const prev = (await db.aiSessions.get(sessionId))?.returnRaw;
      await db.aiSessions.update(sessionId, { returnRaw: prev ? `${prev}\n\n${raw}` : raw });
    }
    if (withPicker) saveLastPick(pick);
    toast(`Filed ${n} item${n === 1 ? '' : 's'}`);
    setRaw('');
    setSel(null);
    setSaving(false);
    onFiled?.(n);
  }

  const rows: { key: keyof CaptureSelection; label: string; items: string[] }[] = parsed
    ? [
        { key: 'takeaways', label: 'Takeaways → knowledge cards', items: parsed.takeaways },
        { key: 'terms', label: 'Terms → vocab', items: parsed.terms.map((t) => `${t.term} — ${t.definition}`) },
        { key: 'mistakes', label: 'Mistakes → mistake journal', items: parsed.mistakes.map((m) => `${m.text} [${MISTAKE_CAUSES.find((c) => c.value === m.cause)?.label}]`) },
        { key: 'next', label: 'Next steps → tasks', items: parsed.next },
      ]
    : [];

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">{withPicker ? 'Paste the AI reply' : 'Capture what you learned'}</div>
        {alreadyFiled && <Badge variant="success">filed</Badge>}
      </div>
      {withPicker && <SubjectTopicPicker value={pick} onChange={setPick} />}
      <Textarea rows={5} value={raw} onChange={(e) => (setRaw(e.target.value), setSel(null))} placeholder={`Paste the AI's reply (or just its ${CAPTURE_START} block)`} />
      <div className="flex flex-wrap gap-2">
        <Button variant={withPicker && !raw ? 'default' : 'outline'} size="sm" onClick={paste}>
          <ClipboardPaste /> Paste from clipboard
        </Button>
        <Button variant="ghost" size="sm" onClick={async () => toast((await copyText(CAPTURE_REASK)) ? 'Copied — send it to the AI, then paste its answer here' : 'Copy failed')}>
          <Copy /> AI forgot the block?
        </Button>
      </div>

      {parsed && (
        <div className="space-y-3">
          {!parsed.foundBlock && <p className="text-xs text-tag-yellow-fg">No {CAPTURE_START} block found — reading TAKEAWAY/TERM/MISTAKE/NEXT lines from the whole text.</p>}
          {captureCount(parsed) === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing to file yet. Tap "AI forgot the block?", send that message to the AI, then paste its answer.</p>
          ) : (
            rows
              .filter((r) => r.items.length)
              .map((r) => (
                <div key={r.key}>
                  <div className="mb-1 text-xs font-medium text-muted-foreground">{r.label}</div>
                  <ul className="space-y-1">
                    {r.items.map((it, i) => (
                      <li key={i}>
                        <label className="flex items-start gap-2 text-sm">
                          <input type="checkbox" className="mt-0.5 h-4 w-4" checked={selection![r.key][i]} onChange={() => toggle(r.key, i)} />
                          <span>{it}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
          )}
          {captureCount(parsed) > 0 && (
            <Button className="w-full" disabled={saving} onClick={save}>
              File selected items
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
