// Read-only Google Classroom access, entirely in the browser (Google Identity Services token model).
// No client secret, no server. The access token lives in memory only and expires after about an hour.
import type { GAnnouncement, GCourse, GCourseWork, GCourseWorkMaterial, GSubmission } from '@/lib/algorithms/classroom';

export const CLASSROOM_SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
  'https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly',
  'https://www.googleapis.com/auth/classroom.announcements.readonly',
].join(' ');

const GSI_URL = 'https://accounts.google.com/gsi/client';
const API = 'https://classroom.googleapis.com/v1';



export type GoogleErrorKind = 'blocked' | 'closed' | 'network' | 'setup' | 'api';
export class GoogleError extends Error {
  constructor(
    message: string,
    public kind: GoogleErrorKind,
  ) {
    super(message);
  }
}

function loadGsi(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GSI_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new GoogleError('Could not load Google sign-in. Are you online?', 'network'));
    document.head.appendChild(s);
  });
}

/**
 * Gets an access token. Interactive by default — opens Google's own sign-in / permission popup,
 * so it must be called from a button click. With `silent: true` it instead asks Google for a
 * token quietly, reusing the session from an earlier interactive connect and never opening a
 * popup; if Google can't grant one without asking you again, it just rejects (used for the
 * automatic background sync, which then simply skips this run rather than nagging you).
 */
export async function requestAccessToken(clientId: string, opts: { silent?: boolean } = {}): Promise<string> {
  await loadGsi();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) throw new GoogleError('Google sign-in did not load.', 'network');
  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: CLASSROOM_SCOPES,
      callback: (r) => {
        if (r.access_token) return resolve(r.access_token);
        if (r.error === 'access_denied') return reject(new GoogleError('Google refused access. Your school may block apps like this, or this account is not listed as a test user.', 'blocked'));
        if (r.error === 'invalid_client' || r.error === 'redirect_uri_mismatch') return reject(new GoogleError('Google does not recognise this Client ID or address. Check the setup steps.', 'setup'));
        reject(new GoogleError(r.error_description || r.error || 'Sign-in failed.', 'blocked'));
      },
      error_callback: (e) => {
        if (e.type === 'popup_closed') return reject(new GoogleError('The sign-in window was closed.', 'closed'));
        if (e.type === 'popup_failed_to_open') return reject(new GoogleError('Your browser blocked the sign-in window. Allow pop-ups for this page and try again.', 'closed'));
        reject(new GoogleError(e.message || 'Sign-in failed.', 'blocked'));
      },
    });
    client.requestAccessToken({ prompt: opts.silent ? 'none' : '' });
  });
}

async function get<T>(token: string, path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new GoogleError('Could not reach Google Classroom. Are you online?', 'network');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    const msg = body?.error?.message ?? res.statusText;
    if (res.status === 403 && /has not been used|is disabled|not been enabled/i.test(msg)) {
      throw new GoogleError('The Google Classroom API is not switched on for your Cloud project. Enable it (setup step 2), wait a minute, and try again.', 'setup');
    }
    if (res.status === 401) throw new GoogleError('The sign-in expired. Fetch again.', 'closed');
    throw new GoogleError(`Classroom said: ${msg}`, 'api');
  }
  return res.json() as Promise<T>;
}

async function pages<T>(token: string, path: string, key: string): Promise<T[]> {
  const out: T[] = [];
  let pageToken = '';
  for (let i = 0; i < 20; i++) {
    const data = await get<Record<string, unknown>>(token, `${path}${path.includes('?') ? '&' : '?'}pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`);
    out.push(...((data[key] as T[] | undefined) ?? []));
    pageToken = (data.nextPageToken as string | undefined) ?? '';
    if (!pageToken) break;
  }
  return out;
}

export interface ClassroomData {
  courses: GCourse[];
  work: GCourseWork[];
  submissions: GSubmission[];
  materials: GCourseWorkMaterial[];
  announcements: GAnnouncement[];
  warnings: string[];
}

/** Your active classes, their assignments, posted materials, announcements, and whether you turned each assignment in. Read-only. */
export async function fetchClassroom(token: string): Promise<ClassroomData> {
  const courses = await pages<GCourse>(token, '/courses?studentId=me&courseStates=ACTIVE', 'courses');
  const warnings: string[] = [];
  const work: GCourseWork[] = [];
  const submissions: GSubmission[] = [];
  const materials: GCourseWorkMaterial[] = [];
  const announcements: GAnnouncement[] = [];
  // Assignments and posted materials/announcements are fetched independently per course: a scope or permission
  // problem with one (e.g. materials scope not yet granted) must not also wipe out the other's results.
  await Promise.all(
    courses.map(async (c) => {
      try {
        const [w, s] = await Promise.all([
          pages<GCourseWork>(token, `/courses/${c.id}/courseWork?courseWorkStates=PUBLISHED`, 'courseWork'),
          pages<GSubmission>(token, `/courses/${c.id}/courseWork/-/studentSubmissions?userId=me`, 'studentSubmissions'),
        ]);
        work.push(...w);
        submissions.push(...s);
      } catch (e) {
        if (e instanceof GoogleError && (e.kind === 'setup' || e.kind === 'closed' || e.kind === 'network')) throw e;
        warnings.push(`${c.name} (assignments): ${(e as Error).message}`);
      }
    }),
  );
  await Promise.all(
    courses.map(async (c) => {
      try {
        const [m, a] = await Promise.all([
          pages<GCourseWorkMaterial>(token, `/courses/${c.id}/courseWorkMaterials?courseWorkMaterialStates=PUBLISHED`, 'courseWorkMaterial'),
          pages<GAnnouncement>(token, `/courses/${c.id}/announcements?announcementStates=PUBLISHED`, 'announcements'),
        ]);
        materials.push(...m);
        announcements.push(...a);
      } catch (e) {
        if (e instanceof GoogleError && (e.kind === 'setup' || e.kind === 'closed' || e.kind === 'network')) throw e;
        warnings.push(`${c.name} (materials/announcements): ${(e as Error).message}`);
      }
    }),
  );
  return { courses, work, submissions, materials, announcements, warnings };
}
