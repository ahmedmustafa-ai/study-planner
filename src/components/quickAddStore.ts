// Lets any screen open the Quick Add sheet on a given tab, pre-filled — fewer taps everywhere.
import type { EventKind } from '@/lib/types';

export type QuickTab = 'task' | 'event' | 'material' | 'course' | 'note' | 'term' | 'mistake';

export interface QuickOpts {
  tab?: QuickTab;
  subjectId?: number;
  topicId?: number;
  date?: string;
  eventKind?: EventKind;
}

type Listener = (o: QuickOpts) => void;
const listeners = new Set<Listener>();
let context: QuickOpts = {};

/** Screens describe what they're showing (e.g. the calendar's selected day) so "+" can pre-fill it. */
export function setQuickContext(c: QuickOpts) {
  context = c;
}
export const getQuickContext = () => context;

export function openQuickAdd(o: QuickOpts = {}) {
  listeners.forEach((l) => l({ ...context, ...o }));
}

export function subscribeQuickAdd(l: Listener) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
