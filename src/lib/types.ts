// Entity types — mirrors PRD-v2 §6. Dates are local 'YYYY-MM-DD'; timestamps are ISO strings.

export type SubjectKind = 'course' | 'test' | 'skill';
export type Level = 'regular' | 'honors' | 'AP' | 'none';
export type ExamStatus = 'none' | 'studying' | 'registered' | 'completed';
export type TopicStatus = 'not_started' | 'learning' | 'shaky' | 'solid';
export type Focus = 'now' | 'next' | 'later' | 'none';
export type SourceKind = 'link' | 'note' | 'pdf' | 'video' | 'book' | 'ai-chat' | 'classroom' | 'drive';
export type SourceRole = 'learn' | 'practice' | 'test';
export type MistakeCause = 'concept' | 'misread' | 'vocab' | 'careless' | 'time';
export type TaskStatus = 'todo' | 'doing' | 'done';
export type Priority = 'low' | 'med' | 'high';
export type TaskSource = 'manual' | 'csv' | 'capture' | 'classroom';
export type MilestoneKind = 'checkpoint' | 'deadline';
export type AiTool = 'chatgpt' | 'notebooklm' | 'claude' | 'gemini' | 'other';

export interface AcademicYear { id?: number; label: string }

export interface Subject {
  id?: number;
  academicYearId: number;
  name: string;
  color: string;
  kind: SubjectKind;
  level: Level;
  examStatus: ExamStatus;
  examDate?: string;
  languageLoad: boolean;
  archived?: boolean;
  code?: string;
  instructor?: string;
  notes?: string;
  order?: number;     // manual course order (lower first)
  studying?: boolean; // shown in "What am I studying?" / Home; undefined = yes
}

/** Class, event or exam on the calendar. Weekly classes repeat on chosen weekdays. */
export type EventKind = 'class' | 'event' | 'exam';
export interface CalEvent {
  id?: number;
  subjectId?: number;
  title: string;
  kind: EventKind;
  date: string;          // first (or only) day, YYYY-MM-DD
  startTime?: string;    // 'HH:MM' — empty = all day
  endTime?: string;
  repeat: 'none' | 'weekly';
  weekdays?: number[];   // 0 = Sunday … 6 = Saturday, used when repeat = weekly
  until?: string;        // last day of the repeat
  location?: string;
  note?: string;
  uid?: string;          // from an imported .ics file, so re-importing does not duplicate
}

/** Time studied. Started with the timer (or logged by hand). */
export interface StudySession {
  id?: number;
  subjectId: number;
  topicId?: number;
  date: string;          // YYYY-MM-DD the session started
  minutes: number;
  note?: string;
}

export interface Unit { id?: number; subjectId: number; name: string; order: number }

export interface Topic {
  id?: number;
  subjectId: number;
  unitId: number;
  name: string;
  order: number;
  status: TopicStatus;
  focus: Focus;
  lastTouched?: string;
  nextReview?: string;   // revisit date once the topic is solid
  interval?: number;     // days between revisits (grows while it stays solid)
}

export interface Source {
  id?: number;
  subjectId: number;
  topicIds: number[];
  kind: SourceKind;
  role: SourceRole;
  title: string;
  url?: string;
  content?: string;
  tool?: AiTool;
  dateAdded: string;
  uid?: string; // stable id from an outside source (Classroom) so re-syncing updates instead of duplicating
}

/** A teacher's post in Google Classroom. Kept apart from Sources (materials) — it is news, not study material. */
export interface Announcement {
  id?: number;
  subjectId: number;
  courseName: string;
  uid: string;    // classroom:announcement:<courseId>:<id>, so re-syncing updates instead of duplicating
  text: string;
  url?: string;   // the post in Classroom
  links: string[];
  date: string;   // YYYY-MM-DD it was posted
}

export interface KnowledgeCard {
  id?: number;
  subjectId: number;
  topicId?: number;
  text: string;
  sourceId?: number;
  origin: 'manual' | 'capture';
  createdAt: string;
  starred: boolean;
}

export interface Term {
  id?: number;
  subjectId: number;
  topicId?: number;
  term: string;
  definition: string;
  example?: string;
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReview: string;
  dateAdded: string;
}

export interface Mistake {
  id?: number;
  subjectId: number;
  topicId?: number;
  text: string;
  cause: MistakeCause;
  date: string;
  fixed: boolean;
}

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id?: number;
  subjectId: number;
  topicId?: number;
  title: string;
  dueDate?: string;
  status: TaskStatus;
  priority: Priority;
  source: TaskSource;
  url?: string;   // e.g. the assignment page in Google Classroom
  materialIds?: number[]; // optional: materials from the same course connected to this task
  links?: string[];       // optional: extra links (Drive, Docs, YouTube…) attached to this task
  subtasks?: Subtask[];   // checklist of actionable breakdown steps
  uid?: string;   // stable id from an outside source (Classroom) so re-syncing updates instead of duplicating
}

export interface Milestone {
  id?: number;
  subjectId?: number;
  title: string;
  date: string;
  kind: MilestoneKind;
  target?: number;        // percent, checkpoints only
  result?: number;        // percent, checkpoints only
  passThreshold?: number; // percent
  onPass?: string;
  onFail?: string;
  done: boolean;          // deadlines: completed/handled
  note?: string;
}

export interface Score {
  id?: number;
  subjectId: number;
  topicId?: number;
  milestoneId?: number;
  label: string;
  date: string;
  score: number;
  max: number;
  sections?: Record<string, number>;
}

export interface AiSession {
  id?: number;
  subjectId: number;
  topicId?: number;
  tool: AiTool;
  promptId?: number;
  attempt: string;     // Box 1 — always saved
  prompt: string;      // what was copied to the AI
  returnRaw?: string;  // pasted Capture Block
  createdAt: string;
}

export interface PromptTemplate {
  id?: number;
  name: string;
  purpose: string;
  tool: AiTool;
  body: string; // placeholders: {{subject}} {{topic}} {{attempt}} {{context}} {{capture}}
}

export interface WeeklyReview {
  id?: number;
  weekStart: string;
  moved: string;
  stuck: string;
  focusTopicIds: number[];
  notes: string;
}

export interface Activity {
  id?: number;
  title: string;
  date: string;
  category: 'robotics' | 'project' | 'competition' | 'award' | 'volunteering' | 'other';
  description: string;
  url?: string;
}

export interface Setting { key: string; value: unknown }
