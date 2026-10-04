// Home dashboard layout — which sections show, in what order. Pure.
export type HomeSectionId = 'quick' | 'nudges' | 'schedule' | 'priorities' | 'studying' | 'vocab' | 'deadlines';

export interface HomeSection {
  id: HomeSectionId;
  visible: boolean;
}

export const HOME_SECTION_INFO: Record<HomeSectionId, { label: string; hint: string }> = {
  quick: { label: 'Quick actions', hint: 'Add task, event, material or course' },
  nudges: { label: 'Reminders', hint: 'Weekly review, AI results waiting, backup' },
  schedule: { label: "Today's schedule", hint: 'Classes, events, exams and tasks due today' },
  priorities: { label: 'Do first', hint: 'What matters most right now, ranked' },
  studying: { label: 'Studying now', hint: 'Your Now topics' },
  vocab: { label: 'Vocab due', hint: 'Terms to review today' },
  deadlines: { label: 'Coming up', hint: 'Exams and deadlines in the next weeks' },
};

export const DEFAULT_HOME_LAYOUT: HomeSection[] = (['quick', 'nudges', 'schedule', 'priorities', 'studying', 'vocab', 'deadlines'] as HomeSectionId[]).map((id) => ({
  id,
  visible: true,
}));

/** Merge a saved layout with the defaults: drops unknown ids, removes duplicates, appends sections added in newer versions. */
export function normalizeLayout(saved: unknown): HomeSection[] {
  const known = new Set<string>(DEFAULT_HOME_LAYOUT.map((s) => s.id));
  const seen = new Set<string>();
  const out: HomeSection[] = [];
  if (Array.isArray(saved)) {
    for (const s of saved) {
      if (s && typeof s === 'object' && known.has((s as HomeSection).id) && !seen.has((s as HomeSection).id)) {
        seen.add((s as HomeSection).id);
        out.push({ id: (s as HomeSection).id, visible: (s as HomeSection).visible !== false });
      }
    }
  }
  for (const d of DEFAULT_HOME_LAYOUT) if (!seen.has(d.id)) out.push({ ...d });
  return out;
}

export function moveSection(layout: HomeSection[], index: number, dir: -1 | 1): HomeSection[] {
  const j = index + dir;
  if (index < 0 || j < 0 || j >= layout.length) return layout;
  const next = layout.slice();
  [next[index], next[j]] = [next[j], next[index]];
  return next;
}

export function toggleSection(layout: HomeSection[], id: HomeSectionId, visible: boolean): HomeSection[] {
  return layout.map((s) => (s.id === id ? { ...s, visible } : s));
}
