import { cn } from '@/lib/utils';

export function Switch({ on, onChange, label, className }: { on: boolean; onChange: (v: boolean) => void; label: string; className?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors', on ? 'bg-foreground' : 'bg-input', className)}
    >
      <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-background transition-transform', on ? 'translate-x-[18px]' : 'translate-x-0.5')} />
    </button>
  );
}
