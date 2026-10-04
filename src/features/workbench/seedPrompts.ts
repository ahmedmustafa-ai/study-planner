import type { PromptTemplate } from '@/lib/types';

// Placeholders: {{subject}} {{topic}} {{attempt}} {{context}} {{capture}}
// {{capture}} is appended automatically if a prompt leaves it out.
export const SEED_PROMPTS: Omit<PromptTemplate, 'id'>[] = [
  {
    name: 'Check my attempt',
    purpose: 'Find exactly where my thinking went wrong',
    tool: 'chatgpt',
    body: `Topic: {{topic}} ({{subject}}).

Here is my own attempt:
"""
{{attempt}}
"""

Check it step by step. Tell me what is correct first, then the FIRST step where I went wrong and why.
Name the cause (concept, vocab, misread, careless, or time). Give me a hint to fix it — not the full solution yet.

My context:
{{context}}

{{capture}}`,
  },
  {
    name: 'Explain simply',
    purpose: 'Understand a topic in simple English',
    tool: 'chatgpt',
    body: `Explain {{topic}} ({{subject}}) to me in simple English (B1–B2).
This is what I think it means so far:
"""
{{attempt}}
"""
Correct my understanding, then explain with one everyday example and one exam-style example.
Bold every technical term and define it in one short line.

My context:
{{context}}

{{capture}}`,
  },
  {
    name: 'Ask my sources',
    purpose: 'Answer ONLY from my uploaded textbook/slides',
    tool: 'notebooklm',
    body: `Using ONLY my uploaded sources, answer this about {{topic}}:
"""
{{attempt}}
"""
Quote or cite the exact source section for each point. If my sources don't cover it, say so.

{{capture}}`,
  },
  {
    name: 'Chapter vocab list',
    purpose: 'Pull the key terms from a chapter before class',
    tool: 'notebooklm',
    body: `From my sources for {{topic}}, list the 10 most important technical terms.
For each: the term, a simple-English definition (max 15 words), and one example sentence.
Words I already think are important: {{attempt}}

Put each term in the block below as a TERM line.
{{capture}}`,
  },
  {
    name: 'Quiz me',
    purpose: 'Retrieval practice — questions one at a time',
    tool: 'chatgpt',
    body: `Quiz me on {{topic}} ({{subject}}). Ask ONE question at a time and wait for my answer.
Mix easy recall and exam-style questions. After each answer, tell me if I'm right and why.
What I remember before starting:
"""
{{attempt}}
"""

My context:
{{context}}

When I say "done", give a short summary.
{{capture}}`,
  },
  {
    name: 'Grade my FRQ',
    purpose: 'AP free-response grading like a reader',
    tool: 'claude',
    body: `Act as an AP {{subject}} exam reader. Grade my free-response answer on {{topic}} using the official scoring style (points per part).

My answer:
"""
{{attempt}}
"""

For each point: earned or not, and why. Then show what a full-credit answer must include (not a full model answer).
Point out any places where my English made the answer unclear.

{{capture}}`,
  },
  {
    name: 'SAT mistake analysis',
    purpose: 'Why I missed an SAT question',
    tool: 'claude',
    body: `I missed this SAT question in {{topic}}. Here is the question, my answer, and my reasoning:
"""
{{attempt}}
"""
Diagnose why I chose wrong: content gap, misread, trap answer, vocabulary, or time pressure.
Show the fastest correct method, and the pattern to recognize this question type next time.

{{capture}}`,
  },
  {
    name: 'What does this depend on?',
    purpose: 'Find earlier topics that break this one',
    tool: 'chatgpt',
    body: `For {{topic}} in {{subject}}: which earlier topics does it depend on?
Give me ONE quick check question for each prerequisite so I can find gaps. Wait for my answers.
My current understanding:
"""
{{attempt}}
"""

My context:
{{context}}

{{capture}}`,
  },
  {
    name: 'Improve my English writing',
    purpose: 'Move writing from B1 toward C1',
    tool: 'claude',
    body: `Here is something I wrote:
"""
{{attempt}}
"""
Improve it toward C1 academic English, but keep my ideas. Show:
1) the corrected version, 2) my 3 most important grammar/vocab patterns to fix, 3) 3 academic words I could use next time.

{{capture}}`,
  },
];
