// Recognize what a pasted link points to (Google Drive, Docs, Classroom, YouTube…). Pure.
import type { SourceKind } from '@/lib/types';

export type LinkService =
  | 'drive-file'
  | 'drive-folder'
  | 'doc'
  | 'sheet'
  | 'slide'
  | 'form'
  | 'classroom'
  | 'notebooklm'
  | 'youtube'
  | 'other';

export interface LinkInfo {
  service: LinkService;
  label: string; // e.g. "Google Doc"
  kind: SourceKind; // best material type
  google: boolean; // needs a Google sign-in / sharing to open
}

const INFO: Record<LinkService, Omit<LinkInfo, 'service'>> = {
  'drive-file': { label: 'Google Drive file', kind: 'drive', google: true },
  'drive-folder': { label: 'Google Drive folder', kind: 'drive', google: true },
  doc: { label: 'Google Doc', kind: 'drive', google: true },
  sheet: { label: 'Google Sheet', kind: 'drive', google: true },
  slide: { label: 'Google Slides', kind: 'drive', google: true },
  form: { label: 'Google Form', kind: 'drive', google: true },
  classroom: { label: 'Classroom', kind: 'classroom', google: true },
  notebooklm: { label: 'NotebookLM notebook', kind: 'ai-chat', google: true },
  youtube: { label: 'YouTube video', kind: 'video', google: false },
  other: { label: 'Link', kind: 'link', google: false },
};

function service(url: string): LinkService {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return 'other';
  }
  const host = u.hostname.replace(/^www\./, '');
  const path = u.pathname;
  if (host === 'drive.google.com' || host === 'drive.usercontent.google.com') {
    if (path.startsWith('/drive/folders') || path.includes('/folders/')) return 'drive-folder';
    return 'drive-file'; // /file/d/…, /open?id=…, /uc?id=…
  }
  if (host === 'docs.google.com') {
    if (path.startsWith('/document')) return 'doc';
    if (path.startsWith('/spreadsheets')) return 'sheet';
    if (path.startsWith('/presentation')) return 'slide';
    if (path.startsWith('/forms')) return 'form';
    return 'drive-file';
  }
  if (host === 'classroom.google.com') return 'classroom';
  if (host === 'notebooklm.google.com' || host === 'notebooklm.google') return 'notebooklm';
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be') return 'youtube';
  return 'other';
}

export function describeLink(url: string | undefined): LinkInfo {
  const s = service(url ?? '');
  return { service: s, ...INFO[s] };
}

/** Add the links found in some pasted text to an existing list (no duplicates, order kept). "added" is how many were new. */
export function mergeLinks(existing: string[], text: string): { links: string[]; added: number } {
  const seen = new Set(existing);
  const fresh = extractUrls(text).filter((u) => !seen.has(u));
  return { links: [...existing, ...fresh], added: fresh.length };
}

/** Add or remove one id (used for picking materials). */
export function toggleId(list: number[], id: number): number[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/** Every http(s) link in a block of text (one per line, or separated by spaces/commas). No duplicates, order kept. */
export function extractUrls(text: string): string[] {
  const found = text.match(/https?:\/\/[^\s<>"',]+/gi) ?? [];
  const clean = found.map((u) => u.replace(/[)\].;:!?]+$/, ''));
  return [...new Set(clean)];
}
