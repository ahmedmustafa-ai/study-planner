import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import type { AiTool, PromptTemplate } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, PageHeader } from '@/components/common';
import { toast } from '@/components/toast';
import { AI_TOOLS } from '@/config';
import { SEED_PROMPTS } from './seedPrompts';

const BLANK: PromptTemplate = { name: '', purpose: '', tool: 'chatgpt', body: 'About {{topic}} ({{subject}}):\n"""\n{{attempt}}\n"""\n\n{{context}}\n\n{{capture}}' };

export function PromptsPage() {
  const prompts = useLiveQuery(() => db.prompts.toArray(), []) ?? [];
  const [editing, setEditing] = useState<PromptTemplate | null>(null);

  async function restoreDefaults() {
    const names = new Set(prompts.map((p) => p.name));
    const missing = SEED_PROMPTS.filter((p) => !names.has(p.name));
    await db.prompts.bulkAdd(missing);
    toast(missing.length ? `Restored ${missing.length} prompt(s)` : 'All default prompts are present');
  }

  return (
    <>
      <PageHeader
        back
        title="Prompt library"
        subtitle="Reusable prompts. Edit them as you learn what works."
        actions={
          <Button size="sm" onClick={() => setEditing({ ...BLANK })}>
            <Plus /> New
          </Button>
        }
      />
      <div className="space-y-2">
        {prompts.map((p) => (
          <Card key={p.id} className="cursor-pointer p-3 hover:bg-accent/50" onClick={() => setEditing(p)}>
            <div className="flex items-center gap-2">
              <span className="flex-1 font-medium">{p.name}</span>
              <Badge variant="outline">{AI_TOOLS.find((t) => t.value === p.tool)?.role}</Badge>
            </div>
            <div className="text-sm text-muted-foreground">{p.purpose}</div>
          </Card>
        ))}
      </div>
      <Button variant="ghost" size="sm" className="mt-3" onClick={restoreDefaults}>
        Restore default prompts
      </Button>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Edit prompt' : 'New prompt'}</DialogTitle>
          </DialogHeader>
          {editing && <PromptForm initial={editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function PromptForm({ initial, onDone }: { initial: PromptTemplate; onDone: () => void }) {
  const [p, setP] = useState(initial);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!p.name.trim()) return toast('Name it');
        await db.prompts.put(p);
        onDone();
      }}
    >
      <Field label="Name">
        <Input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
      </Field>
      <Field label="Purpose">
        <Input value={p.purpose} onChange={(e) => setP({ ...p, purpose: e.target.value })} />
      </Field>
      <Field label="Best tool">
        <Select value={p.tool} onChange={(e) => setP({ ...p, tool: e.target.value as AiTool })}>
          {AI_TOOLS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Prompt" hint="Placeholders: {{subject}} {{topic}} {{attempt}} {{context}} {{capture}} — {{capture}} is added automatically if missing.">
        <Textarea rows={10} className="font-mono text-xs" value={p.body} onChange={(e) => setP({ ...p, body: e.target.value })} />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" className="flex-1">
          Save
        </Button>
        {p.id && (
          <Button
            type="button"
            variant="destructive"
            onClick={async () => {
              if (confirm('Delete this prompt?')) {
                await db.prompts.delete(p.id!);
                onDone();
              }
            }}
          >
            <Trash2 />
          </Button>
        )}
      </div>
    </form>
  );
}
