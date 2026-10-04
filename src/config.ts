// Single source of truth for constants.
import type { AiTool, MistakeCause, SourceKind, SourceRole, TopicStatus } from '@/lib/types';

export const APP_NAME = 'Study OS';
export const DB_NAME = 'study-os';

// Focus board
export const MAX_NOW_TOPICS = 3;

// Two-Box: minimum length of your own attempt before AI help unlocks
export const MIN_ATTEMPT_CHARS = 20;

// Backup + review nudges
export const BACKUP_REMINDER_DAYS = 7;
export const WEEKLY_REVIEW_DAYS = 7;

// Today view horizons
export const TASK_HORIZON_DAYS = 7;
export const DEADLINE_HORIZON_DAYS = 60;

// SM-2 (vocab review)
export const SM2 = {
  initialEase: 2.5,
  minEase: 1.3,
  // Self-rating → SM-2 quality (0–5)
  quality: { again: 1, hard: 3, good: 4, easy: 5 } as const,
  firstInterval: 1,
  secondInterval: 6,
  easyBonus: 1.3,
  hardFactor: 1.2,
};
export const MAX_REVIEW_PER_SESSION = 30;

// Weak-spot scoring
export const WEAK_SPOTS = {
  topN: 3,
  statusWeight: { not_started: 0, learning: 1, shaky: 3, solid: -2 } as Record<TopicStatus, number>,
  openMistakeWeight: 2,
  fixedMistakeWeight: 0.3,
  mistakeHalfLifeDays: 21,
  scorePassPercent: 70,
  scorePointsPer10Percent: 1,
};

export const TOPIC_STATUS_LABEL: Record<TopicStatus, string> = {
  not_started: 'Not started',
  learning: 'Learning',
  shaky: 'Shaky',
  solid: 'Solid',
};
export const TOPIC_STATUS_ORDER: TopicStatus[] = ['not_started', 'learning', 'shaky', 'solid'];

export const MISTAKE_CAUSES: { value: MistakeCause; label: string; hint: string }[] = [
  { value: 'concept', label: 'Concept', hint: "Didn't understand the idea" },
  { value: 'vocab', label: 'Vocab / English', hint: "Didn't understand a word or the question's English" },
  { value: 'misread', label: 'Misread', hint: 'Understood, but read the question wrong' },
  { value: 'careless', label: 'Careless', hint: 'Arithmetic/sign slip' },
  { value: 'time', label: 'Time', hint: 'Ran out of time' },
];

export const SOURCE_KINDS: { value: SourceKind; label: string }[] = [
  { value: 'link', label: 'Link' },
  { value: 'video', label: 'Video' },
  { value: 'drive', label: 'Google Drive / Docs' },
  { value: 'pdf', label: 'PDF / file link' },
  { value: 'book', label: 'Book pages' },
  { value: 'note', label: 'Note' },
  { value: 'ai-chat', label: 'AI chat' },
  { value: 'classroom', label: 'Classroom post' },
];
export const SOURCE_ROLES: { value: SourceRole; label: string }[] = [
  { value: 'learn', label: 'Learn' },
  { value: 'practice', label: 'Practice' },
  { value: 'test', label: 'Test' },
];

export const AI_TOOLS: { value: AiTool; label: string; role: string; bestFor: string }[] = [
  {
    value: 'notebooklm',
    label: 'Gemini notebook / NotebookLM',
    role: 'Librarian',
    bestFor: 'Answers grounded ONLY in your uploaded textbook/slides, vocab lists from a chapter, audio overviews (listening practice).',
  },
  {
    value: 'chatgpt',
    label: 'ChatGPT Project',
    role: 'Coach',
    bestFor: 'Simple-English explanations, checking your attempt, planning. One Project per subject with standing instructions.',
  },
  {
    value: 'claude',
    label: 'Claude',
    role: 'Examiner',
    bestFor: 'Grading FRQs against a rubric, writing feedback toward C1, long-document review.',
  },
  { value: 'gemini', label: 'Gemini (chat)', role: 'Helper', bestFor: 'Quick questions, second opinion.' },
  { value: 'other', label: 'Other tool', role: 'Helper', bestFor: 'Anything else.' },
];

// Muted, Notion-like dot colors. Readable on both light and dark canvases.
export const SUBJECT_COLORS = ['#337ea9', '#448361', '#d9730d', '#9065b0', '#c14c8a', '#cb912f', '#d44c47', '#787774'];

/** Old saturated palette → new muted one (used by the v2 DB migration and backup restore). */
const LEGACY_COLORS: Record<string, string> = {
  '#4f46e5': '#337ea9',
  '#0891b2': '#337ea9',
  '#059669': '#448361',
  '#d97706': '#d9730d',
  '#dc2626': '#d44c47',
  '#9333ea': '#9065b0',
  '#db2777': '#c14c8a',
  '#475569': '#787774',
};
export const migrateColor = (hex: string): string => LEGACY_COLORS[hex.toLowerCase()] ?? hex;

// Status dot/bar colors for topic progress
export const STATUS_BAR_COLORS = { solid: '#448361', learning: '#337ea9', shaky: '#cb912f' } as const;

// Capture Block protocol — shared by prompts, setup kit and parser.
export const CAPTURE_START = '===STUDYOS===';
export const CAPTURE_END = '===END===';
export const CAPTURE_INSTRUCTION = `At the very END of your reply, add this block exactly (plain text, no markdown, one item per line, simple English):
${CAPTURE_START}
TAKEAWAY: <one key idea I should keep — repeat the line for each, max 5>
TERM: <term> | <simple-English definition>
MISTAKE: <what I got wrong> | <cause: concept, vocab, misread, careless, or time>
NEXT: <one concrete next step>
${CAPTURE_END}
Leave out any line type that doesn't apply.`;

/** One tap: send this to an AI that forgot to end with the block. */
export const CAPTURE_REASK = `Please give me ONLY the STUDYOS Capture Block for this chat, in exactly this format:
${CAPTURE_INSTRUCTION}`;

// Default student profile used in Setup Kit instructions (editable in Settings).
export const DEFAULT_PROFILE = `I am a 17-year-old Grade 11 student in Sharjah, UAE, in my first year of an American curriculum after Arabic-language schooling.
My English is around B1 and I'm working toward C1, so science terminology is harder for me than the ideas themselves.
Goals: MIT (primary), strong AP scores (4–5), SAT 1550+. Interested in bioengineering, AI, CS, robotics.`;
