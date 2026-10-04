// Builds the text you paste into an AI tool, and fills prompt templates. Pure.
import { CAPTURE_INSTRUCTION } from '@/config';
import type { KnowledgeCard, Mistake, Source, Subject, Term, Topic, Unit } from '@/lib/types';

export interface ContextInput {
  profile: string;
  subject: Subject;
  topic?: Topic;
  unit?: Unit;
  sources: Source[];
  cards: KnowledgeCard[];
  mistakes: Mistake[];
  terms: Term[];
  weakTopicNames: string[];
}

const MAX_ITEMS = 12;

export function buildContextPack(input: ContextInput): string {
  const { profile, subject, topic, unit, sources, cards, mistakes, terms, weakTopicNames } = input;
  const lines: string[] = [];
  lines.push('## About me', profile.trim(), '');
  lines.push(`## Subject: ${subject.name}${subject.level === 'AP' ? ' (AP)' : ''}`);
  if (topic) lines.push(`Topic: ${unit ? `${unit.name} → ` : ''}${topic.name} (my status: ${topic.status.replace('_', ' ')})`);
  lines.push('');

  if (weakTopicNames.length) {
    lines.push('## My weak spots right now', ...weakTopicNames.map((n) => `- ${n}`), '');
  }
  const openMistakes = mistakes.filter((m) => !m.fixed).slice(0, MAX_ITEMS);
  if (openMistakes.length) {
    lines.push('## Mistakes I have made (not fixed yet)', ...openMistakes.map((m) => `- ${m.text} [${m.cause}]`), '');
  }
  if (cards.length) {
    lines.push('## What I already know (my own notes)', ...cards.slice(0, MAX_ITEMS).map((c) => `- ${c.text}`), '');
  }
  if (subject.languageLoad && terms.length) {
    lines.push(
      '## Terms I am learning (use them, and explain them simply)',
      ...terms.slice(0, MAX_ITEMS).map((t) => `- ${t.term}: ${t.definition}`),
      '',
    );
  }
  if (sources.length) {
    lines.push(
      '## My sources for this',
      ...sources.slice(0, MAX_ITEMS).map((s) => `- ${s.title}${s.url ? ` — ${s.url}` : ''}${s.kind === 'note' && s.content ? `: ${s.content.slice(0, 200)}` : ''}`),
      '',
    );
  }
  return lines.join('\n').trim();
}

export interface PromptVars {
  subject: string;
  topic: string;
  attempt: string;
  context: string;
}

export function fillPrompt(body: string, vars: PromptVars): string {
  const withCapture = body.includes('{{capture}}') ? body : `${body}\n\n{{capture}}`;
  return withCapture
    .replace(/\{\{subject\}\}/g, vars.subject)
    .replace(/\{\{topic\}\}/g, vars.topic || vars.subject)
    .replace(/\{\{attempt\}\}/g, vars.attempt.trim())
    .replace(/\{\{context\}\}/g, vars.context)
    .replace(/\{\{capture\}\}/g, CAPTURE_INSTRUCTION)
    .trim();
}

/** Standing instructions to paste once into a ChatGPT Project / Claude Project / NotebookLM notebook. */
export function buildSetupInstructions(profile: string, subjectName: string, toolRole: string, languageLoad: boolean): string {
  return [
    `You are my ${toolRole.toLowerCase()} for ${subjectName}.`,
    '',
    profile.trim(),
    '',
    'Rules for every reply:',
    "1. I always try first. If I haven't shown my own attempt, ask for it before giving the full answer. Give hints before solutions.",
    '2. Use simple, clear English (B1–B2 level). Keep sentences short.',
    languageLoad
      ? '3. When you use a technical term, put it in bold and give a one-line simple definition the first time.'
      : '3. Show every step. Name the rule or theorem used at each step.',
    '4. When I make a mistake, tell me the cause: concept, vocab (English), misread, careless, or time.',
    '5. Point me back to my own sources (textbook, notes) when possible.',
    '',
    CAPTURE_INSTRUCTION,
  ].join('\n');
}
