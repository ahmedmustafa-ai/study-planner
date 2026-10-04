import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { BookOpen, CalendarDays, Compass, Home, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QuickAdd } from '../QuickAdd';
import { Toaster } from '../toast';
import { TimerBar } from '@/features/timer/TimerUI';

// Five daily destinations. Everything else (AI, vocab, library, targets, review, settings) lives under Study.
const STUDY_PATHS = ['/study', '/ai', '/vocab', '/library', '/targets', '/review', '/focus', '/settings', '/topics'];

const NAV = [
  { to: '/', label: 'Home', icon: Home, match: (p: string) => p === '/' },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, match: (p: string) => p.startsWith('/calendar') },
  { to: '/tasks', label: 'Tasks', icon: ListChecks, match: (p: string) => p.startsWith('/tasks') },
  { to: '/subjects', label: 'Courses', icon: BookOpen, match: (p: string) => p.startsWith('/subjects') },
  { to: '/study', label: 'Study', icon: Compass, match: (p: string) => STUDY_PATHS.some((s) => p.startsWith(s)) },
];

export function AppShell() {
  const { pathname } = useLocation();
  return (
    <div className="min-h-dvh">
      {/* key → a soft fade-in on every screen change */}
      <main key={pathname} className="mx-auto max-w-2xl animate-page-in px-5 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))]">
        <Outlet />
      </main>
      <QuickAdd />
      <TimerBar />
      <Toaster />
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm">
        <ul className="mx-auto flex max-w-2xl px-2">
          {NAV.map(({ to, label, icon: Icon, match }) => {
            const active = match(pathname);
            return (
              <li key={to} className="flex-1">
                <NavLink
                  to={to}
                  className={cn('flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors', active ? 'text-foreground' : 'text-muted-foreground/80 hover:text-foreground')}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.25 : 1.75} />
                  {label}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
