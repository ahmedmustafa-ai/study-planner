\# PROJECT\_BRIEF.md — Study OS



\## Student Context

\- 17, Grade 11, Sharjah UAE. First year in American curriculum after entirely

&#x20; Arabic-curriculum schooling through Grade 10. Zero AP foundation entering Grade 11.

\- English: B1 (EF SET 46/100), target C1. German frozen — full focus on English

&#x20; academic terminology. Terminology lag is real in Bio/Chem/Physics, NOT in Calc

&#x20; (numerical, language-light).

\- Current load: AP Calculus AB (exam-bound) + AP Physics (studying only, no exam

&#x20; booked yet) + regular Physics, Chemistry, Biology, Environmental Science,

&#x20; English 11, Robotics.



\## Goals

\- Universities: MIT primary (need-blind, full aid). Backups: Germany

&#x20; (Direktzulassung, AP-based, no German coursework), Japan, Singapore. No UAE options.

\- Intent: double major (Bioengineering/Biomedical, AI Engineering, CS, Robotics —

&#x20; exact pair undecided, don't force a choice in the app).

\- SAT: 1550+ (whole test, not just Math).

\- APs: 3–5 total across Grade 11–12, prioritizing score quality (4–5) over count.

&#x20; More APs will be added next year — architecture must scale without rebuild.

\- AP Calc AB: 3-phase plan already set — Foundation (Sept–Oct) → Proficiency

&#x20; (Nov–Feb, checkpoint test late Jan, 60% pass/fail branch) → Exam Prep (Mar–May).



\## Why This App Exists

Not visibility into tasks — higher retention with less wasted time:

1\. Terminology lag in Bio/Chem/Physics compounds if untracked.

2\. Calc AB is cumulative — early weak topics silently break later ones.

3\. SAT needs targeted drilling on weak sub-skills, not generic "time logged."

4\. Multiple AP courses will stack next year — needs to scale now, not later.



\## Non-Negotiable Design Principles

\- Every study action is retrieval-based (recall before reveal), never passive rereading.

\- AI-assist requires the user's own attempt FIRST (two-box pattern: your answer →

&#x20; then AI help unlocks).

\- Interleaving over block-studying — scheduler resists single-subject marathons.

\- Local-only. No paid APIs. IndexedDB persistence. No Google OAuth for v1 — Classroom

&#x20; CSV import is the only external bridge.



\## Architecture Rules

\- Feature-folder structure: /src/features/subjects, /tasks, /review, /vault,

&#x20; /test-prep — each owns its own components, hooks, DB queries.

\- /src/lib/algorithms/ — pure, framework-free functions only (SM-2, weak-spot

&#x20; scoring, GPA projection). No React imports, fully unit-testable.

\- /src/lib/db.ts — dexie with versioned migrations from v1. Never mutate an

&#x20; existing version; add db.version(2) for future changes.

\- /src/config.ts — single source of truth for constants.



\## Data Model

Subject {

&#x20; id, name, code, instructor, color,

&#x20; examStatus: 'studying' | 'registered' | 'completed',

&#x20; languageLoad: boolean  // true for Bio/Chem/Physics-type terminology-heavy subjects

}

Material { id, subjectId, type (link/file/note), title, url/content, chapter/topic tag, dateAdded }

Task { id, subjectId, title, dueDate, status, priority, source (manual/classroom-csv), estimatedHours }

Grade { id, subjectId, taskId, score, maxScore, weight, type, date }

ReviewItem {

&#x20; id, subjectId, materialId, easeFactor, interval, repetitions, nextReviewDate,

&#x20; subQuestionType?: string  // for SAT granular tagging (e.g. "algebra word problems")

}

VocabTerm { id, subjectId, term, simpleDefinition, dateAdded }  // pre-load system, reviewed via SM-2

Milestone { id, subjectId, date, target, actualResult, status }  // e.g. Jan checkpoint test

TestPrep { id, testName ("SAT"), targetScore, currentDiagnostic, weakSubSkills: \[] }  // separate from Subject

AcademicYear { id, label ("Grade 11"), subjectIds: \[] }  // container, scales to next year



\## Features (build in this order)



1\. \*\*Subject Knowledge Vault\*\*

&#x20;  - CRUD for subjects/materials, tagged by chapter/topic. Client-side full-text search.

&#x20;  - "Copy AI Context" per subject: materials + notes + weak topics + (if languageLoad)

&#x20;    pending vocab terms → clipboard, for pasting into external AI chat.



2\. \*\*Vocabulary Pre-Load Module\*\* (for languageLoad subjects only)

&#x20;  - Add term + simple-English definition, tagged to subject/chapter.

&#x20;  - Reviewed via SM-2 the night before class — same recall engine as #3.



3\. \*\*Spaced Repetition Engine (SM-2)\*\*

&#x20;  - Any material or vocab term → review item. Daily due queue.

&#x20;  - Recall-first UI: show prompt, user attempts, THEN reveal answer, then self-rate

&#x20;    (again/hard/good/easy) → drives interval calc.



4\. \*\*Task Manager\*\*

&#x20;  - Manual CRUD + Google Classroom CSV import (Papaparse, column mapping + preview).

&#x20;  - Sort/filter by due date, priority, subject.



5\. \*\*Weak-Spot Detector\*\*

&#x20;  - Pure function: Grade\[] → ranked weak topics per subject. Surfaces top 3,

&#x20;    feeds into AI Context export.



6\. \*\*Milestone Tracker\*\*

&#x20;  - Track Calc AB phase checkpoints (e.g. Jan practice test) — date, target, actual,

&#x20;    pass/fail branch. Surface "behind pace" warning from logged hours vs. plan.



7\. \*\*Test Prep Module (SAT)\*\*

&#x20;  - Separate from Subject. Target score, diagnostic history, weak sub-skills,

&#x20;    drilling cadence (Math weekly vs. R\&W more frequent).



8\. \*\*GPA Projection\*\*

&#x20;  - Pure function: current grades → weighted/unweighted GPA estimate, live-updated.



9\. \*\*Two-Box AI-Assist Pattern\*\* (applies wherever AI help is offered)

&#x20;  - Box 1: your answer, required first. Box 2: AI help — unlocks only after Box 1

&#x20;    has content, then surfaces "Copy AI Context."



\## Deliverable

\- Full working project, `npm run dev` works immediately.

\- No placeholder/stub code — every listed feature functional end to end.

\- Seed with 2–3 example subjects (incl. one languageLoad=true) so UI isn't empty.

\- Do not build beyond this list for v1.

