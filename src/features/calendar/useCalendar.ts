import { useLiveQuery } from 'dexie-react-hooks';
import { db, setSetting } from '@/lib/db';
import { useSetting } from '@/lib/hooks';
import type { CalFilter, CalKind, CalSources } from '@/lib/algorithms/calendar';

/** Everything the calendar can show, live. */
export function useCalSources(): CalSources | undefined {
  return useLiveQuery(async () => {
    const [events, tasks, milestones, subjects] = await Promise.all([db.events.toArray(), db.tasks.toArray(), db.milestones.toArray(), db.subjects.toArray()]);
    return { events, tasks, milestones, subjects };
  }, []);
}

export type CalView = 'month' | 'week' | 'agenda' | 'timetable';

export const DEFAULT_LAYERS: Record<CalKind, boolean> = { class: true, event: true, exam: true, deadline: true, task: true };

/** Customizable calendar preferences, saved on this device. */
export function useCalSettings() {
  const view = useSetting<CalView>('cal.view', 'month');
  const weekStart = useSetting<number>('cal.weekStart', 1); // Monday
  const layers = { ...DEFAULT_LAYERS, ...useSetting<Partial<Record<CalKind, boolean>>>('cal.layers', {}) };
  const hidden = useSetting<number[]>('cal.hidden', []);
  const filter: CalFilter = { kinds: layers, hiddenSubjects: hidden };
  return {
    view,
    weekStart,
    layers,
    hidden,
    filter,
    setView: (v: CalView) => setSetting('cal.view', v),
    setWeekStart: (n: number) => setSetting('cal.weekStart', n),
    setLayer: (k: CalKind, on: boolean) => setSetting('cal.layers', { ...layers, [k]: on }),
    toggleCourse: (id: number) => setSetting('cal.hidden', hidden.includes(id) ? hidden.filter((x) => x !== id) : [...hidden, id]),
  };
}
