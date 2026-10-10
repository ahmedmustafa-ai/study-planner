import { useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { DataRecoveryGate } from '@/components/DataRecoveryGate';
import { ensureSeeded, looksWiped } from '@/lib/seed';
import { startSync } from '@/lib/sync';
import { autoClassroomSync } from '@/features/classroom/autoSync';
import { toast } from '@/components/toast';
import { TodayPage } from '@/features/today/TodayPage';
import { FocusBoard } from '@/features/today/FocusBoard';
import { SubjectsPage } from '@/features/subjects/SubjectsPage';
import { SubjectPage } from '@/features/subjects/SubjectPage';
import { TopicPage } from '@/features/subjects/TopicPage';
import { LibraryPage } from '@/features/sources/LibraryPage';
import { SharePage } from '@/features/sources/SharePage';
import { WorkbenchPage } from '@/features/workbench/WorkbenchPage';
import { SessionPage } from '@/features/workbench/SessionPage';
import { SetupKitPage } from '@/features/workbench/SetupKitPage';
import { PasteResultPage } from '@/features/workbench/PasteResultPage';
import { PromptsPage } from '@/features/workbench/PromptsPage';
import { TasksPage } from '@/features/tasks/TasksPage';
import { ImportPage } from '@/features/tasks/ImportPage';
import { VocabPage } from '@/features/vocab/VocabPage';
import { ReviewSession } from '@/features/vocab/ReviewSession';
import { TargetsPage } from '@/features/targets/TargetsPage';
import { WeeklyReviewPage } from '@/features/review/WeeklyReviewPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { CalendarPage } from '@/features/calendar/CalendarPage';
import { IcsImportPage } from '@/features/calendar/IcsImportPage';
import { StudyPage } from '@/features/study/StudyPage';
import { ClassroomPage } from '@/features/classroom/ClassroomPage';

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsRecovery, setNeedsRecovery] = useState(false);

  useEffect(() => {
    let stopSync: (() => void) | undefined;
    (async () => {
      try {
        // This browser was seeded before but IndexedDB now looks empty — likely wiped. Don't
        // silently refill it with the original demo data; let the user pick a recovery path.
        if (await looksWiped()) {
          setNeedsRecovery(true);
          return;
        }
        await ensureSeeded();
        setReady(true);
        // Ask the browser not to evict this site's storage under disk pressure — best effort, silent either way.
        navigator.storage?.persist?.().catch(() => undefined);

        autoClassroomSync()
          .then((r) => {
            if (!r.ran) return;
            const parts: string[] = [];
            if (r.addedTasks) parts.push(`${r.addedTasks} new task${r.addedTasks > 1 ? 's' : ''}`);
            if (r.addedMaterials) parts.push(`${r.addedMaterials} new file${r.addedMaterials > 1 ? 's' : ''}`);
            if (r.addedAnnouncements) parts.push(`${r.addedAnnouncements} new announcement${r.addedAnnouncements > 1 ? 's' : ''}`);
            if (r.updatedTasks || r.updatedMaterials) parts.push('some updated');
            if (parts.length) toast(`Classroom synced automatically: ${parts.join(', ')}`);
          })
          .catch(() => undefined);

        stopSync = startSync();
      } catch (e) {
        setError((e as Error).message);
      }
    })();
    return () => {
      stopSync?.();
    };
  }, []);

  if (needsRecovery) return <DataRecoveryGate />;
  if (error) return <div className="p-6 text-sm text-destructive">Could not open local database: {error}</div>;
  if (!ready) return null;

  return (
    // Hash routing: works on any static host (GitHub Pages) with no server rewrites.
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<TodayPage />} />
          <Route path="focus" element={<FocusBoard />} />
          <Route path="subjects" element={<SubjectsPage />} />
          <Route path="subjects/:id" element={<SubjectPage />} />
          <Route path="topics/:id" element={<TopicPage />} />
          <Route path="library" element={<LibraryPage />} />
          <Route path="share" element={<SharePage />} />
          <Route path="ai" element={<WorkbenchPage />} />
          <Route path="ai/session/:id" element={<SessionPage />} />
          <Route path="ai/setup" element={<SetupKitPage />} />
          <Route path="ai/paste" element={<PasteResultPage />} />
          <Route path="ai/prompts" element={<PromptsPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="tasks/import" element={<ImportPage />} />
          <Route path="classroom" element={<ClassroomPage />} />
          <Route path="vocab" element={<VocabPage />} />
          <Route path="vocab/review" element={<ReviewSession />} />
          <Route path="targets" element={<TargetsPage />} />
          <Route path="review" element={<WeeklyReviewPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="calendar/import" element={<IcsImportPage />} />
          <Route path="study" element={<StudyPage />} />
          <Route path="more" element={<Navigate to="/study" replace />} />
          <Route path="*" element={<TodayPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
