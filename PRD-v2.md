# PRD v2 — Study OS: a command center for learning and AI tools

Supersedes prd.md where they conflict. The student context and goals in prd.md still apply.

## 1. What changed and why

- The app **organizes; it does not teach.** Content comes from your sources and AI tools.
  The app remembers what you learned, where it came from, what's weak and what's next.
- It is **built for the phone first** and costs nothing: no money, few accounts, little upkeep, and fast daily use.
- It is **flexible, not a fixed schedule.** There are no required hours. You choose what to focus on
  and the app shows it clearly.
- It **connects your AI tools; it doesn't replace them.** There are no API calls. Everything moves through the clipboard,
  using a shared "Capture Block" format (see §4).
- Everything can be adjusted. Subjects, units, topics, prompts and statuses are all editable.
  Templates are starting points only.

## 2. Cost principles (money, time and effort)

| Cost | Rule |
|---|---|
| Money | $0. Free static hosting (GitHub Pages or Cloudflare Pages). No APIs, no subscriptions. |
| Accounts | The only one needed is for free hosting, created once by the student. The app itself has no login. |
| Daily friction | Any capture takes 10 seconds or less (a quick-add button on every screen). |
| Weekly time | The weekly review takes 15 minutes or less and is guided. |
| Maintenance | No server and no database to run. Updating is a `git push`. |
| Data safety | A one-tap backup file sent to Drive through the phone's share sheet. A reminder shows if the last backup is older than 7 days. |

**Delivery: an installable PWA.** You add it to your home screen. It works offline, and data stays on the phone in IndexedDB.
On iPhone, it must be installed to the home screen, because Safari may clear data for sites that are only visited in a tab.

## 3. The AI tools and their jobs

| Tool | Job | Best used for |
|---|---|---|
| **Gemini notebook / NotebookLM** | The Librarian | Answers based only on *your* files (textbook chapters, class slides). One notebook per subject. Its audio overviews are also good listening practice for English. |
| **ChatGPT Projects** | The Coach | Explaining things in simple English, checking your attempts, study planning. One project per subject, with standing instructions. |
| **Claude** | The Examiner | Grading FRQs against a rubric, feedback on your writing (for the C1 goal and later essays), reviewing long documents. |
| **Study OS** | The Brain | Keeps a permanent index of what you learned from all of them. The AI tools forget; this doesn't. |

## 4. The core idea: the Knowledge Loop

```
  ┌────────────── Study OS ──────────────┐
  │ Topic → Context Pack + Prompt        │──copy──▶  ChatGPT / NotebookLM / Claude
  │                                      │
  │ Capture Block parsed → auto-filed:   │◀─paste──  AI reply ends with a
  │   takeaways → Knowledge Cards        │           ===STUDYOS=== block
  │   terms     → Vocab                  │
  │   mistakes  → Mistake Journal        │
  │   next      → Tasks                  │
  └──────────────────────────────────────┘
        │ export subject's Knowledge Cards as .md
        └──────▶ upload back into NotebookLM / ChatGPT Project as a source
                 (your distilled notes become the AI's grounding)
```

1. **Setup Kit** (done once per subject). The app writes the text for the standing instructions you paste into each
   ChatGPT Project, Claude Project and NotebookLM notebook. It covers your profile (B1→C1 English, you attempt first, your goals)
   and tells the AI to always end with a Capture Block.
2. **Two-Box.** Box 1 is your own attempt, which is required and saved. After that, Box 2 unlocks: it combines a prompt template,
   the topic's context, your attempt and the Capture Block instruction, ready to copy.
3. **Capture Block.** You paste the AI's closing block into the app. It is parsed and each part is filed automatically, with a preview
   before saving. The format is plain text, so it works in any AI tool:
   ```
   ===STUDYOS===
   TAKEAWAY: ...
   TERM: word | simple definition
   MISTAKE: what I got wrong | cause
   NEXT: follow-up action
   ===END===
   ```
4. **Knowledge export.** A subject's Knowledge Cards can be exported as a Markdown file and uploaded back into the AI tools.
   This closes the loop.

## 5. Features (build in this order)

1. **Structure.** Years → Subjects → Units → Topics. Each topic has a status (not started, learning, shaky, solid)
   and a focus flag. Editable templates are preloaded with official unit and topic names only (Calc AB, AP Physics 1
   as a default that can be swapped, SAT domains, generic Bio, Chem, Physics and English). There are subject kinds `course | test | skill`,
   so the SAT is a subject with kind `test`. This replaces the separate TestPrep entity.
2. **Source Hub.** Links, notes, PDFs (as links, since phone storage is limited), videos, book pages, AI chat links and Classroom posts.
   Each source is tagged to topics and has a role: learn, practice or test. Search covers all of them.
3. **AI Workbench.** Setup Kit, an editable prompt library (seeded with around 8 prompts), Context Pack, Two-Box
   (attempts saved) and the Capture Block parser. Each AI session is logged: tool, topic, purpose and outcome.
4. **Knowledge Cards + Mistake Journal.** Cards are short insights, each linked to a topic and source. Mistakes have a cause:
   concept, misread, vocab, careless or time. The "vocab" cause separates your English gap from gaps in understanding.
5. **Now board + Today + Tasks.** Now, Next and Later, with a limit of 3 topics in focus. Today shows what's in focus,
   what's due, weak topics and upcoming deadlines. Tasks can be added manually or imported with the CSV column mapper.
6. **Vocab.** Available for language-heavy subjects. Terms come from manual entry and Capture Blocks. Review uses a light SM-2
   (recall before reveal) and terms can be exported to Anki as CSV.
7. **Targets.** Milestones with a pass threshold and pass/fail branch, scores (grades and SAT diagnostics with section scores),
   deadline countdowns (AP registration, SAT dates, MIT Early Action), and an activity log for Robotics and projects.
8. **Weekly Review.** A guided 15-minute review: what moved, what's weak (based on a pure function over statuses, mistakes and scores),
   and next week's focus. Reviews are saved as history so you can see progress over time.
9. **PWA + Backup.** Install to home screen, work offline, export and import JSON, back up through the share sheet.

**Cut from v1:** GPA projection, a full SM-2 engine for every material, and file blobs stored in IndexedDB.

## 6. Data model (Dexie v1)

```
academicYears  { id, label }
subjects       { id, academicYearId, name, color, kind, level, examStatus, examDate?, languageLoad }
units          { id, subjectId, name, order }
topics         { id, subjectId, unitId, name, order, status, focus, lastTouched }
sources        { id, subjectId, topicIds[], kind, role, title, url?, content?, tool?, dateAdded }
knowledgeCards { id, subjectId, topicId, text, sourceId?, origin, createdAt, starred }
terms          { id, subjectId, topicId?, term, definition, example?, easeFactor, interval, repetitions, nextReview }
mistakes       { id, subjectId, topicId, text, cause, date, fixed }
tasks          { id, subjectId, topicId?, title, dueDate, status, priority, source }
milestones     { id, subjectId, title, date, target, result?, passThreshold?, onPass?, onFail?, status }
scores         { id, subjectId, topicId?, milestoneId?, label, date, score, max, sections? }
aiSessions     { id, subjectId, topicId?, tool, promptId?, attempt, returnRaw?, createdAt }
prompts        { id, name, purpose, tool, body }        // body uses {{placeholders}}
weeklyReviews  { id, weekStart, moved, stuck, focusTopicIds[], notes }
activities     { id, title, date, category, description, url? }
settings       { key, value }                            // lastBackup, profile text, etc.
```

## 7. Architecture (unchanged from prd.md)

- React 18, Vite, TypeScript, Tailwind, shadcn/ui, Dexie, vite-plugin-pwa.
- `/src/features/*` folders. Pure logic lives in `/src/lib/algorithms/` (SM-2, weak spots, Capture Block parser, context
  builder) and has unit tests. Constants go in `/src/config.ts`.
