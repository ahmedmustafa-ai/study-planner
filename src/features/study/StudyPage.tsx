import { Link } from 'react-router-dom';
import { AlertTriangle, BookA, CalendarCheck, ChevronRight, Compass, KanbanSquare, Library, Settings, Sparkles, Target } from 'lucide-react';
import { useSubjectMap } from '@/lib/hooks';
import { Badge } from '@/components/ui/badge';
import { Empty, Section, SubjectDot, linkClass } from '@/components/common';
import { MAX_NOW_TOPICS } from '@/config';
import { daysBetween, formatDate, relativeDays } from '@/lib/utils';
import { ProgressBar, StatusPill, countStatuses } from '@/features/subjects/StatusPill';
import { setTopicStatus } from '@/features/subjects/topicActions';
import { PriorityList } from './PriorityList';
import { TimeSummaryCard } from '@/features/timer/TimeSummaryCard';
import { addDays } from '@/lib/utils';
import { useDashboard } from './useDashboard';

const TOOLS = [
  { to: '/ai', icon: Sparkles, label: 'AI Workbench', hint: 'Try first, then get AI help — and keep what you learn' },
  { to: '/vocab', icon: BookA, label: 'Vocab', hint: 'Terms, recall review, Anki export' },
  { to: '/library', icon: Library, label: 'Library', hint: 'Search materials, notes, mistakes and terms' },
  { to: '/targets', icon: Target, label: 'Targets', hint: 'Deadlines, checkpoints, scores, activities' },
  { to: '/review', icon: CalendarCheck, label: 'Weekly review', hint: '15 minutes: moved → stuck → next focus' },
  { to: '/focus', icon: KanbanSquare, label: 'Focus board', hint: 'Now / Next / Later topics' },
  { to: '/settings', icon: Settings, label: 'Settings', hint: 'Backup, profile, install' },
];

/** "What am I studying?" — relevant courses, focus, priorities and needs-attention, then the study tools. */
export function StudyPage() {
  const d = useDashboard();
  const subjectMap = useSubjectMap();
  if (!d) return null;

  const nowTopics = d.topics.filter((t) => t.focus === 'now');
  const nextCount = d.topics.filter((t) => t.focus === 'next').length;
  const laterCount = d.topics.filter((t) => t.focus === 'later').length;

  return (
    <>
      <header className="mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Compass className="h-4 w-4" /> Study
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">What am I studying?</h1>
      </header>

      <Section title={`Courses · ${d.studying.length}`} action={<Link to="/subjects" className={linkClass}>All courses →</Link>}>
        {d.studying.length === 0 ? (
          <Empty>
            No courses marked as studying. <Link to="/subjects" className="text-brand underline">Add or switch on a course</Link>.
          </Empty>
        ) : (
          <div className="space-y-2">
            {d.studying.map((s) => {
              const topics = d.topics.filter((t) => t.subjectId === s.id);
              const counts = countStatuses(topics);
              const tasks = d.tasks.filter((t) => t.subjectId === s.id && t.status !== 'done').sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
              const next = tasks[0];
              const overdue = tasks.filter((t) => t.dueDate && t.dueDate < d.t0).length;
              const examIn = s.examDate && s.examStatus !== 'completed' ? daysBetween(d.t0, s.examDate) : null;
              const focus = topics.filter((t) => t.focus === 'now');
              return (
                <Link key={s.id} to={`/subjects/${s.id}`} className="block rounded-lg border bg-card p-3.5 transition-colors hover:bg-accent">
                  <div className="flex items-center gap-2">
                    <SubjectDot color={s.color} className="h-3 w-3" />
                    <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                    {examIn != null && examIn >= 0 && <Badge variant={examIn <= 30 ? 'warning' : 'secondary'}>Exam in {examIn}d</Badge>}
                    {overdue > 0 && <Badge variant="destructive">{overdue} overdue</Badge>}
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                  </div>
                  <div className="mt-2.5">
                    <ProgressBar counts={counts} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="tabular">
                      {counts.solid}/{topics.length} solid
                    </span>
                    <span>{d.materialsBySubject[s.id!] ?? 0} materials</span>
                    <span>{tasks.length} open task{tasks.length === 1 ? '' : 's'}</span>
                  </div>
                  {next && (
                    <div className="mt-2 truncate text-xs">
                      <span className="text-muted-foreground">Next: </span>
                      {next.title}
                      {next.dueDate && <span className="text-muted-foreground"> · {formatDate(next.dueDate)}</span>}
                    </div>
                  )}
                  {focus.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {focus.map((t) => (
                        <Badge key={t.id} variant="info">
                          {t.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </Section>

      <Section title={`Priorities`} action={<Link to="/tasks" className={linkClass}>All tasks →</Link>}>
        <PriorityList items={d.priorities} />
      </Section>

      <Section title="Study time · last 7 days">
        <TimeSummaryCard sessions={d.sessions} from={addDays(d.t0, -6)} to={d.t0} allowLog />
      </Section>

      <Section
        title={`Focus · Now ${nowTopics.length}/${MAX_NOW_TOPICS}`}
        action={
          <Link to="/focus" className={linkClass}>
            Next {nextCount} · Later {laterCount} — manage →
          </Link>
        }
      >
        {nowTopics.length === 0 ? (
          <Empty>
            Pick up to {MAX_NOW_TOPICS} topics to focus on this week. <Link to="/focus" className="text-brand underline">Open the focus board</Link>.
          </Empty>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {nowTopics.map((t) => (
              <li key={t.id} className="flex items-center gap-2 px-3 py-2.5">
                <SubjectDot color={subjectMap.get(t.subjectId)?.color} />
                <Link to={`/topics/${t.id}`} className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{t.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {subjectMap.get(t.subjectId)?.name}
                    {t.lastTouched && ` · touched ${relativeDays(t.lastTouched)}`}
                  </div>
                </Link>
                <StatusPill status={t.status} onChange={(s) => setTopicStatus(t.id!, s)} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {d.revisit.length > 0 && (
        <Section title={`Due for revisit · ${d.revisit.length}`}>
          <ul className="divide-y rounded-lg border bg-card">
            {d.revisit.slice(0, 5).map((r) => (
              <li key={r.topicId}>
                <Link to={`/topics/${r.topicId}`} className="flex items-center gap-2.5 px-3 py-2.5 transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-accent">
                  <SubjectDot color={subjectMap.get(r.subjectId)?.color} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{r.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {subjectMap.get(r.subjectId)?.name} · {r.overdueDays > 0 ? `${r.overdueDays} day${r.overdueDays > 1 ? 's' : ''} late` : 'due today'}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">Topics you marked solid. Recall them from memory before they fade.</p>
        </Section>
      )}

      {d.weak.length > 0 && (
        <Section title="Needs attention">
          <ul className="divide-y rounded-lg border bg-card">
            {d.weak.slice(0, 4).map((w) => (
              <li key={w.topicId}>
                <Link to={`/topics/${w.topicId}`} className="flex items-center gap-2.5 px-3 py-2.5 transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-accent">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-tag-yellow-fg" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{w.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {subjectMap.get(w.subjectId)?.name} · {w.reasons.join(' · ') || 'in progress'}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Tools">
        <ul className="divide-y rounded-lg border bg-card">
          {TOOLS.map(({ to, icon: Icon, label, hint }) => (
            <li key={to}>
              <Link to={to} className="flex items-center gap-3 px-3 py-3 transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-accent">
                <Icon className="h-[18px] w-[18px] shrink-0 text-muted-foreground" strokeWidth={1.75} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{label}</div>
                  <div className="truncate text-xs text-muted-foreground">{hint}</div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
