import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Brain, CalendarClock, ClipboardPaste, CalendarPlus, ChevronDown, ChevronRight, ChevronUp, FilePlus2, FolderPlus, HardDriveDownload, ListPlus, Settings, SlidersHorizontal, Sparkles } from 'lucide-react';
import { setSetting } from '@/lib/db';
import { useSetting, useSubjectMap } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Empty, Section, SubjectDot, linkClass } from '@/components/common';
import { openQuickAdd, type QuickTab } from '@/components/quickAddStore';
import { DEADLINE_HORIZON_DAYS, MAX_NOW_TOPICS } from '@/config';
import { addDaysISO, buildCalendarItems, filterItems, type CalItem } from '@/lib/algorithms/calendar';
import { DEFAULT_HOME_LAYOUT, HOME_SECTION_INFO, moveSection, normalizeLayout, toggleSection, type HomeSection, type HomeSectionId } from '@/lib/algorithms/homeLayout';
import { daysBetween, relativeDays } from '@/lib/utils';
import { StatusPill } from '@/features/subjects/StatusPill';
import { setTopicStatus } from '@/features/subjects/topicActions';
import { CalItemRow, ItemEditor } from '@/features/calendar/CalItemRow';
import { useCalSettings, useCalSources } from '@/features/calendar/useCalendar';
import { PriorityList } from '@/features/study/PriorityList';
import { StartTimerButton } from '@/features/timer/TimerUI';
import { useDashboard } from '@/features/study/useDashboard';

const QUICK: { tab: QuickTab; label: string; icon: typeof ListPlus }[] = [
  { tab: 'task', label: 'Task', icon: ListPlus },
  { tab: 'event', label: 'Event', icon: CalendarPlus },
  { tab: 'material', label: 'Material', icon: FilePlus2 },
  { tab: 'course', label: 'Course', icon: FolderPlus },
];

/** Home: a study dashboard. Sections can be hidden and reordered (sliders icon). */
export function TodayPage() {
  const d = useDashboard();
  const subjectMap = useSubjectMap();
  const calSrc = useCalSources();
  const cal = useCalSettings();
  const saved = useSetting<unknown>('home.layout', undefined);
  const layout = useMemo(() => normalizeLayout(saved), [saved]);
  const [customize, setCustomize] = useState(false);
  const [editing, setEditing] = useState<CalItem | null>(null);

  const t0 = d?.t0 ?? '';
  const todayItems = useMemo(() => (calSrc && t0 ? filterItems(buildCalendarItems(calSrc, t0, t0), cal.filter) : []), [calSrc, t0, cal.filter]);
  const upcoming = useMemo(
    () =>
      calSrc && t0
        ? filterItems(buildCalendarItems(calSrc, t0, addDaysISO(t0, DEADLINE_HORIZON_DAYS)), cal.filter).filter((i) => (i.kind === 'exam' || i.kind === 'deadline') && !i.done)
        : [],
    [calSrc, t0, cal.filter],
  );

  if (!d) return null;
  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  const nowTopics = d.topics.filter((t) => t.focus === 'now');

  const render: Record<HomeSectionId, () => React.ReactNode> = {
    quick: () => (
      <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2">
        {QUICK.map(({ tab, label, icon: Icon }) => (
          <button
            key={tab}
            onClick={() => openQuickAdd({ tab, subjectId: undefined, topicId: undefined, date: undefined })}
            className="flex flex-col items-center gap-1.5 rounded-lg border bg-card py-3 text-xs font-medium transition-colors hover:bg-accent active:scale-[0.98]"
          >
            <Icon className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
            {label}
          </button>
        ))}
      </div>
        <Link to="/ai/paste" className="flex items-center justify-center gap-2 rounded-lg border border-dashed py-2.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
          <ClipboardPaste className="h-4 w-4" /> Paste an AI result
        </Link>
      </div>
    ),

    nudges: () => {
      const rows = [
        d.reviewDue && { to: '/review', icon: <CalendarClock />, text: 'Weekly review is due — 15 minutes to see progress and pick next focus.' },
        d.pending > 0 && { to: '/ai', icon: <Sparkles />, text: `${d.pending} AI session${d.pending > 1 ? 's' : ''} waiting for you to paste the Capture Block.` },
        d.backupDue && { to: '/settings', icon: <HardDriveDownload />, text: 'Back up your data (one tap → Google Drive).' },
      ].filter(Boolean) as { to: string; icon: React.ReactNode; text: string }[];
      if (!rows.length) return null;
      return (
        <div className="space-y-2">
          {rows.map((r) => (
            <Link
              key={r.to}
              to={r.to}
              className="flex items-center gap-3 rounded-lg border bg-card p-3 text-sm transition-colors hover:bg-accent [&_svg]:h-[18px] [&_svg]:w-[18px] [&_svg]:shrink-0 [&_svg]:text-muted-foreground"
            >
              {r.icon}
              <span className="flex-1">{r.text}</span>
              <ChevronRight className="!h-4 !w-4" />
            </Link>
          ))}
        </div>
      );
    },

    schedule: () => (
      <Section title="Today" action={<Link to="/calendar" className={linkClass}>Calendar →</Link>}>
        {todayItems.length === 0 ? (
          <Empty>
            Nothing scheduled today.{' '}
            <button className="text-brand underline" onClick={() => openQuickAdd({ tab: 'event', date: t0 })}>
              Add an event
            </button>
          </Empty>
        ) : (
          <div className="space-y-2">
            {todayItems.map((i) => (
              <CalItemRow key={i.key} item={i} subject={i.subjectId != null ? subjectMap.get(i.subjectId) : undefined} onOpen={setEditing} />
            ))}
          </div>
        )}
      </Section>
    ),

    priorities: () => (
      <Section title="Do first" action={<Link to="/study" className={linkClass}>Study →</Link>}>
        <PriorityList items={d.priorities.slice(0, 5)} />
      </Section>
    ),

    studying: () => (
      <Section title={`Studying now · ${nowTopics.length}/${MAX_NOW_TOPICS}`} action={<Link to="/focus" className={linkClass}>Focus board →</Link>}>
        {nowTopics.length === 0 ? (
          <Empty>
            Nothing in focus. <Link to="/focus" className="text-brand underline">Pick up to {MAX_NOW_TOPICS} topics</Link> you're working on this week.
          </Empty>
        ) : (
          <div className="space-y-2">
            {nowTopics.map((t) => {
              const s = subjectMap.get(t.subjectId);
              const open = d.openMistakes.filter((m) => m.topicId === t.id).length;
              return (
                <Card key={t.id} className="p-3">
                  <div className="flex items-center gap-2">
                    <SubjectDot color={s?.color} />
                    <Link to={`/topics/${t.id}`} className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{t.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {s?.name}
                        {open > 0 && ` · ${open} open mistake${open > 1 ? 's' : ''}`}
                        {t.lastTouched && ` · touched ${relativeDays(t.lastTouched)}`}
                      </div>
                    </Link>
                    <StatusPill status={t.status} onChange={(st) => setTopicStatus(t.id!, st)} />
                    <StartTimerButton subjectId={t.subjectId} topicId={t.id} iconOnly variant="ghost" />
                    <Button size="icon" variant="ghost" asChild aria-label="Work with AI">
                      <Link to={`/ai?subject=${t.subjectId}&topic=${t.id}`}>
                        <Sparkles />
                      </Link>
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Section>
    ),

    vocab: () =>
      d.dueTerms > 0 ? (
        <Card className="flex items-center gap-3 p-3">
          <Brain className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1 text-sm">
            <b>{d.dueTerms}</b> vocab term{d.dueTerms > 1 ? 's' : ''} due
          </div>
          <Button size="sm" asChild>
            <Link to="/vocab/review">Review</Link>
          </Button>
        </Card>
      ) : null,

    deadlines: () => (
      <Section title="Coming up" action={<Link to="/targets" className={linkClass}>Targets →</Link>}>
        {upcoming.length === 0 ? (
          <Empty>No exams or deadlines in the next {DEADLINE_HORIZON_DAYS} days.</Empty>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {upcoming.slice(0, 6).map((m) => {
              const days = daysBetween(t0, m.date);
              return (
                <li key={m.key}>
                  <button onClick={() => setEditing(m)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent">
                    <div className={`tabular w-11 shrink-0 text-center ${days <= 7 ? 'text-tag-red-fg' : days <= 14 ? 'text-tag-yellow-fg' : ''}`}>
                      <div className="text-lg font-semibold leading-none">{days}</div>
                      <div className="text-[10px] text-muted-foreground">{days === 1 ? 'day' : 'days'}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{m.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{m.subjectId != null ? subjectMap.get(m.subjectId)?.name : 'General'}</div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    ),
  };

  return (
    <>
      <header className="mb-6 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm text-muted-foreground">{dateLabel}</div>
          <h1 className="text-2xl font-semibold tracking-tight">Home</h1>
        </div>
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setCustomize(true)} aria-label="Customize Home">
          <SlidersHorizontal />
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9" asChild aria-label="Settings">
          <Link to="/settings">
            <Settings />
          </Link>
        </Button>
      </header>

      <div className="space-y-7">
        {layout.filter((s) => s.visible).map((s) => {
          const node = render[s.id]();
          return node ? <div key={s.id}>{node}</div> : null;
        })}
      </div>

      <ItemEditor item={editing} onClose={() => setEditing(null)} />
      <HomeCustomize open={customize} onOpenChange={setCustomize} layout={layout} />
    </>
  );
}

function HomeCustomize({ open, onOpenChange, layout }: { open: boolean; onOpenChange: (o: boolean) => void; layout: HomeSection[] }) {
  const save = (next: HomeSection[]) => setSetting('home.layout', next);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Customize Home</DialogTitle>
        </DialogHeader>
        <p className="mb-3 text-sm text-muted-foreground">Show, hide and reorder what appears on Home.</p>
        <ul className="divide-y rounded-lg border">
          {layout.map((s, i) => (
            <li key={s.id} className="flex items-center gap-2 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{HOME_SECTION_INFO[s.id].label}</div>
                <div className="truncate text-xs text-muted-foreground">{HOME_SECTION_INFO[s.id].hint}</div>
              </div>
              <button aria-label="Move up" disabled={i === 0} onClick={() => save(moveSection(layout, i, -1))} className="rounded p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-25">
                <ChevronUp className="h-4 w-4" />
              </button>
              <button aria-label="Move down" disabled={i === layout.length - 1} onClick={() => save(moveSection(layout, i, 1))} className="rounded p-1.5 text-muted-foreground hover:bg-accent disabled:opacity-25">
                <ChevronDown className="h-4 w-4" />
              </button>
              <Switch on={s.visible} onChange={(v) => save(toggleSection(layout, s.id, v))} label={`Show ${HOME_SECTION_INFO[s.id].label}`} />
            </li>
          ))}
        </ul>
        <Button variant="ghost" size="sm" className="mt-3" onClick={() => save(DEFAULT_HOME_LAYOUT)}>
          Reset to default
        </Button>
      </DialogContent>
    </Dialog>
  );
}
