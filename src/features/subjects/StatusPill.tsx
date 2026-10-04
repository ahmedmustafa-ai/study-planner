import { STATUS_BAR_COLORS, TOPIC_STATUS_LABEL, TOPIC_STATUS_ORDER } from '@/config';
import type { TopicStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const STYLES: Record<TopicStatus, string> = {
  not_started: 'bg-tag-gray text-tag-gray-fg',
  learning: 'bg-tag-blue text-tag-blue-fg',
  shaky: 'bg-tag-yellow text-tag-yellow-fg',
  solid: 'bg-tag-green text-tag-green-fg',
};

export function statusClass(s: TopicStatus) {
  return STYLES[s];
}

/** Tap to cycle status. */
export function StatusPill({ status, onChange, className }: { status: TopicStatus; onChange?: (s: TopicStatus) => void; className?: string }) {
  const next = TOPIC_STATUS_ORDER[(TOPIC_STATUS_ORDER.indexOf(status) + 1) % TOPIC_STATUS_ORDER.length];
  if (!onChange) {
    return <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', STYLES[status], className)}>{TOPIC_STATUS_LABEL[status]}</span>;
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onChange(next);
      }}
      className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', STYLES[status], className)}
      title={`Tap → ${TOPIC_STATUS_LABEL[next]}`}
    >
      {TOPIC_STATUS_LABEL[status]}
    </button>
  );
}

export function StatusPicker({ status, onChange }: { status: TopicStatus; onChange: (s: TopicStatus) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1">
      {TOPIC_STATUS_ORDER.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={cn(
            'rounded-md px-1 py-2 text-xs font-medium',
            s === status ? cn(STYLES[s], 'ring-1 ring-foreground/25') : 'bg-muted/60 text-muted-foreground hover:bg-accent',
          )}
        >
          {TOPIC_STATUS_LABEL[s]}
        </button>
      ))}
    </div>
  );
}

/** Stacked bar of topic statuses. */
export function ProgressBar({ counts }: { counts: Record<TopicStatus, number> }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted">
      {(['solid', 'learning', 'shaky'] as const).map((s) => (
        <div key={s} className="transition-[width] duration-300" style={{ width: `${(counts[s] / total) * 100}%`, backgroundColor: STATUS_BAR_COLORS[s] }} />
      ))}
    </div>
  );
}

export function countStatuses(topics: { status: TopicStatus }[]): Record<TopicStatus, number> {
  const c: Record<TopicStatus, number> = { not_started: 0, learning: 0, shaky: 0, solid: 0 };
  for (const t of topics) c[t.status]++;
  return c;
}
