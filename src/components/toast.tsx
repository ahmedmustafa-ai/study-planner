import { useEffect, useState } from 'react';

type Listener = (msg: string | null) => void;
const listeners = new Set<Listener>();
let timer: ReturnType<typeof setTimeout> | undefined;

/** Fire-and-forget toast from anywhere. */
export function toast(msg: string) {
  listeners.forEach((l) => l(msg));
  clearTimeout(timer);
  timer = setTimeout(() => listeners.forEach((l) => l(null)), 2400);
}

export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    listeners.add(setMsg);
    return () => {
      listeners.delete(setMsg);
    };
  }, []);
  if (!msg) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4">
      <div className="rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background shadow-[0_4px_16px_rgba(0,0,0,0.15)]">{msg}</div>
    </div>
  );
}
