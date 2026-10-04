import { describe, expect, it } from 'vitest';
import { describeLink, extractUrls } from './links';

describe('describeLink', () => {
  it.each([
    ['https://drive.google.com/file/d/1AbC/view?usp=sharing', 'drive-file', 'drive'],
    ['https://drive.google.com/open?id=1AbC', 'drive-file', 'drive'],
    ['https://drive.google.com/drive/folders/1Xyz?usp=sharing', 'drive-folder', 'drive'],
    ['https://drive.google.com/drive/u/0/folders/1Xyz', 'drive-folder', 'drive'],
    ['https://docs.google.com/document/d/1abc/edit', 'doc', 'drive'],
    ['https://docs.google.com/spreadsheets/d/1abc/edit#gid=0', 'sheet', 'drive'],
    ['https://docs.google.com/presentation/d/1abc/edit', 'slide', 'drive'],
    ['https://docs.google.com/forms/d/e/1abc/viewform', 'form', 'drive'],
    ['https://classroom.google.com/c/MTIzNDU2/a/NzY1/details', 'classroom', 'classroom'],
    ['https://notebooklm.google.com/notebook/abc', 'notebooklm', 'ai-chat'],
    ['https://www.youtube.com/watch?v=abc', 'youtube', 'video'],
    ['https://youtu.be/abc', 'youtube', 'video'],
    ['https://www.khanacademy.org/math', 'other', 'link'],
    ['not a link', 'other', 'link'],
  ])('%s', (url, svc, kind) => {
    const i = describeLink(url);
    expect(i.service).toBe(svc);
    expect(i.kind).toBe(kind);
  });
  it('flags links that need a Google sign-in', () => {
    expect(describeLink('https://docs.google.com/document/d/1/edit').google).toBe(true);
    expect(describeLink('https://youtu.be/abc').google).toBe(false);
    expect(describeLink(undefined).service).toBe('other');
  });
});

describe('extractUrls', () => {
  it('finds several links separated by lines, spaces or commas, and drops duplicates', () => {
    const text = 'Notes: https://drive.google.com/file/d/1/view\nhttps://docs.google.com/document/d/2/edit, https://youtu.be/x  https://drive.google.com/file/d/1/view';
    expect(extractUrls(text)).toEqual(['https://drive.google.com/file/d/1/view', 'https://docs.google.com/document/d/2/edit', 'https://youtu.be/x']);
  });
  it('strips trailing punctuation and returns nothing for plain text', () => {
    expect(extractUrls('see (https://youtu.be/x).')).toEqual(['https://youtu.be/x']);
    expect(extractUrls('no links here')).toEqual([]);
  });
});

import { mergeLinks, toggleId } from './links';

describe('mergeLinks / toggleId', () => {
  it('adds new links from pasted text and skips ones already attached', () => {
    const r = mergeLinks(['https://youtu.be/x'], 'https://youtu.be/x\nhttps://docs.google.com/document/d/1/edit https://drive.google.com/file/d/2/view');
    expect(r.links).toEqual(['https://youtu.be/x', 'https://docs.google.com/document/d/1/edit', 'https://drive.google.com/file/d/2/view']);
    expect(r.added).toBe(2);
    expect(mergeLinks(['https://a.com'], 'no link here')).toEqual({ links: ['https://a.com'], added: 0 });
  });
  it('toggles an id on and off without mutating', () => {
    const a = [1, 2];
    expect(toggleId(a, 3)).toEqual([1, 2, 3]);
    expect(toggleId(a, 2)).toEqual([1]);
    expect(a).toEqual([1, 2]);
  });
});
