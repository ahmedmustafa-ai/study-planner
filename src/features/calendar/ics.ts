import { db } from '@/lib/db';
import { buildIcs } from '@/lib/algorithms/ics';
import { shareOrDownload } from '@/lib/utils';

/** Everything dated in Study OS → one .ics file (share sheet on Android, download elsewhere). */
export async function exportCalendarIcs() {
  const [events, tasks, milestones, subjects] = await Promise.all([db.events.toArray(), db.tasks.toArray(), db.milestones.toArray(), db.subjects.toArray()]);
  const ics = buildIcs({ events, tasks, milestones, subjects }, new Date().toISOString());
  return shareOrDownload('study-os-calendar.ics', ics, 'text/calendar');
}
