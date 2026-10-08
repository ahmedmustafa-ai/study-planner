import { useState } from 'react';
import { Check, CheckSquare, Plus, Trash2 } from 'lucide-react';
import type { Subtask } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function TaskSubtasks({
  subtasks,
  onChange,
}: {
  subtasks: Subtask[];
  onChange: (subtasks: Subtask[]) => void;
}) {
  const [newTitle, setNewTitle] = useState('');
  const [open, setOpen] = useState(subtasks.length > 0);

  function addSubtask() {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    const newItem: Subtask = {
      id: crypto.randomUUID(),
      title: trimmed,
      done: false,
    };
    onChange([...subtasks, newItem]);
    setNewTitle('');
  }

  function toggleSubtask(id: string) {
    onChange(
      subtasks.map((st) => (st.id === id ? { ...st, done: !st.done } : st))
    );
  }

  function updateTitle(id: string, title: string) {
    onChange(
      subtasks.map((st) => (st.id === id ? { ...st, title } : st))
    );
  }

  function removeSubtask(id: string) {
    onChange(subtasks.filter((st) => st.id !== id));
  }

  const doneCount = subtasks.filter((st) => st.done).length;

  if (!open && subtasks.length === 0) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <CheckSquare className="h-4 w-4" /> Add subtasks (optional)
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center justify-between text-[13px] font-medium text-muted-foreground">
        <span className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4" /> Subtasks
        </span>
        {subtasks.length > 0 && (
          <span className="text-xs font-normal tabular-nums">
            {doneCount} of {subtasks.length} done
          </span>
        )}
      </div>

      {subtasks.length > 0 && (
        <ul className="space-y-1.5">
          {subtasks.map((st) => (
            <li
              key={st.id}
              className="flex items-center gap-2 rounded-md bg-card px-2.5 py-1.5 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.05)] border"
            >
              <button
                type="button"
                aria-label={st.done ? 'Mark incomplete' : 'Mark complete'}
                onClick={() => toggleSubtask(st.id)}
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                  st.done
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-input hover:border-foreground/60'
                )}
              >
                {st.done && <Check className="h-3 w-3" strokeWidth={3} />}
              </button>
              <input
                type="text"
                value={st.title}
                onChange={(e) => updateTitle(st.id, e.target.value)}
                className={cn(
                  'flex-1 bg-transparent text-sm outline-none',
                  st.done && 'line-through text-muted-foreground'
                )}
                placeholder="Subtask description"
              />
              <button
                type="button"
                aria-label="Remove subtask"
                onClick={() => removeSubtask(st.id)}
                className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addSubtask();
            }
          }}
          placeholder="Add a step and press Enter…"
          className="h-9 text-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={addSubtask}
          disabled={!newTitle.trim()}
          className="shrink-0"
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Add
        </Button>
      </div>
    </div>
  );
}
