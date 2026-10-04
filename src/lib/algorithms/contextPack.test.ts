import { describe, expect, it } from 'vitest';
import { buildContextPack, buildSetupInstructions, fillPrompt } from './contextPack';
import { CAPTURE_START } from '@/config';
import type { Subject } from '@/lib/types';

const subject: Subject = {
  id: 1, academicYearId: 1, name: 'Chemistry', color: '#000', kind: 'course', level: 'regular', examStatus: 'none', languageLoad: true,
};

describe('context pack', () => {
  it('includes profile, weak spots, open mistakes only, and terms for languageLoad', () => {
    const txt = buildContextPack({
      profile: 'I am a student.',
      subject,
      sources: [{ subjectId: 1, topicIds: [], kind: 'link', role: 'learn', title: 'Khan', url: 'https://k', dateAdded: '' }],
      cards: [{ subjectId: 1, text: 'Moles count particles', origin: 'manual', createdAt: '', starred: false }],
      mistakes: [
        { subjectId: 1, text: 'open one', cause: 'vocab', date: '', fixed: false },
        { subjectId: 1, text: 'fixed one', cause: 'concept', date: '', fixed: true },
      ],
      terms: [{ subjectId: 1, term: 'mole', definition: '6.02e23 things', easeFactor: 2.5, interval: 0, repetitions: 0, nextReview: '', dateAdded: '' }],
      weakTopicNames: ['Stoichiometry'],
    });
    expect(txt).toContain('I am a student.');
    expect(txt).toContain('- Stoichiometry');
    expect(txt).toContain('open one [vocab]');
    expect(txt).not.toContain('fixed one');
    expect(txt).toContain('mole: 6.02e23 things');
    expect(txt).toContain('Khan — https://k');
  });
  it('fills placeholders and always appends the capture instruction', () => {
    const p = fillPrompt('Explain {{topic}} in {{subject}}. My try: {{attempt}}', {
      subject: 'Chem', topic: 'Moles', attempt: ' guess ', context: '',
    });
    expect(p).toContain('Explain Moles in Chem. My try: guess');
    expect(p).toContain(CAPTURE_START);
  });
  it('setup instructions mention attempt-first and the capture block', () => {
    const s = buildSetupInstructions('profile', 'Chemistry', 'Coach', true);
    expect(s).toContain('I always try first');
    expect(s).toContain('bold');
    expect(s).toContain(CAPTURE_START);
  });
});
