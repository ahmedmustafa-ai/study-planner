import { describe, expect, it } from 'vitest';
import { fkIdsToUuids, fkUuidsToIds, incomingWins } from './sync';

describe('fkIdsToUuids', () => {
  it('translates a scalar FK to its uuid', () => {
    const out = fkIdsToUuids('units', { id: 1, subjectId: 7, name: 'Unit 1' }, (table, id) => (table === 'subjects' && id === 7 ? 'subj-uuid' : undefined));
    expect(out.subjectId).toBe('subj-uuid');
  });

  it('translates an array FK field element by element', () => {
    const out = fkIdsToUuids('sources', { id: 1, subjectId: 7, topicIds: [1, 2] }, (table, id) => {
      if (table === 'subjects' && id === 7) return 'subj-uuid';
      if (table === 'topics' && id === 1) return 'topic-1-uuid';
      if (table === 'topics' && id === 2) return 'topic-2-uuid';
      return undefined;
    });
    expect(out.subjectId).toBe('subj-uuid');
    expect(out.topicIds).toEqual(['topic-1-uuid', 'topic-2-uuid']);
  });

  it('drops an unresolvable scalar reference instead of sending a dangling number', () => {
    const out = fkIdsToUuids('units', { id: 1, subjectId: 999 }, () => undefined);
    expect(out.subjectId).toBeUndefined();
    expect('subjectId' in out).toBe(false);
  });

  it('drops unresolvable elements out of an array reference', () => {
    const out = fkIdsToUuids('sources', { id: 1, topicIds: [1, 2] }, (table, id) => (table === 'topics' && id === 1 ? 'topic-1-uuid' : undefined));
    expect(out.topicIds).toEqual(['topic-1-uuid']);
  });

  it('leaves tables with no declared FKs unchanged', () => {
    const row = { id: 1, label: 'Grade 11' };
    expect(fkIdsToUuids('academicYears', row, () => 'x')).toEqual(row);
  });

  it('leaves a null/undefined FK field alone', () => {
    const out = fkIdsToUuids('topics', { id: 1, subjectId: 7, unitId: undefined }, () => 'subj-uuid');
    expect(out.unitId).toBeUndefined();
  });
});

describe('fkUuidsToIds', () => {
  it('translates a scalar uuid FK back to a local id', () => {
    const out = fkUuidsToIds('units', { subjectId: 'subj-uuid' }, (table, uuid) => (table === 'subjects' && uuid === 'subj-uuid' ? 7 : undefined));
    expect(out.subjectId).toBe(7);
  });

  it('translates an array of uuids back to local ids', () => {
    const out = fkUuidsToIds('sources', { topicIds: ['topic-1-uuid', 'topic-2-uuid'] }, (table, uuid) => {
      if (table === 'topics' && uuid === 'topic-1-uuid') return 1;
      if (table === 'topics' && uuid === 'topic-2-uuid') return 2;
      return undefined;
    });
    expect(out.topicIds).toEqual([1, 2]);
  });

  it('drops a uuid this device has never seen, rather than keeping a dangling string', () => {
    const out = fkUuidsToIds('units', { subjectId: 'unknown-uuid' }, () => undefined);
    expect('subjectId' in out).toBe(false);
  });
});

describe('incomingWins', () => {
  it('wins when there is no local row yet', () => {
    expect(incomingWins(undefined, '2026-01-01T00:00:00.000Z')).toBe(true);
  });

  it('wins when the incoming row is newer', () => {
    expect(incomingWins('2026-01-01T00:00:00.000Z', '2026-01-02T00:00:00.000Z')).toBe(true);
  });

  it('loses when the local row is newer', () => {
    expect(incomingWins('2026-01-02T00:00:00.000Z', '2026-01-01T00:00:00.000Z')).toBe(false);
  });

  it('loses on an exact tie (local already reflects this write)', () => {
    expect(incomingWins('2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')).toBe(false);
  });
});
