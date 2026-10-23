import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFramePrompt } from './prompt-builder.js';
import { characterRefName } from './ref-names.js';

const project = { style: 'soft comic' };
const slide = { idea: '' };
const lan = { id: 'chlan001', name: 'Lan', description: 'cô gái 20 tuổi', traits: 'áo dài đỏ, tóc đuôi ngựa', images: ['1-a.png'] };
const hung = { id: 'chhung01', name: 'Hùng', description: 'ông lão', traits: 'kính tròn, áo bà ba nâu', images: ['2-b.jpg', '3-c.webp'] };
const frame = (patch) => ({ characterIds: [], dialogues: [], positions: {}, ...patch });

test('one line per character with position, traits and their own reference files', () => {
  const prompt = buildFramePrompt(project, slide, frame({ characterIds: ['chlan001', 'chhung01'], positions: { chlan001: 'left', chhung01: 'right' } }), [lan, hung]);
  assert.match(prompt, /^- LEFT: Lan \| distinguishing traits: áo dài đỏ, tóc đuôi ngựa \| description: cô gái 20 tuổi \| reference image: char-chlan001-1\.png$/m);
  assert.match(prompt, /^- RIGHT: Hùng \| .* \| reference image: char-chhung01-1\.jpg, char-chhung01-2\.webp$/m);
  assert.match(prompt, /DIFFERENT person/);
});

test('characters are listed left to right whatever the cast order', () => {
  const prompt = buildFramePrompt(project, slide, frame({ characterIds: ['chlan001', 'chhung01'], positions: { chlan001: 'right', chhung01: 'left' } }), [lan, hung]);
  assert.ok(prompt.indexOf('LEFT: Hùng') < prompt.indexOf('RIGHT: Lan'));
});

test('missing position, traits and images still produce a usable line', () => {
  const plain = { id: 'chx', name: 'X', description: '', images: [] };
  const prompt = buildFramePrompt(project, slide, frame({ characterIds: ['chx'] }), [plain]);
  assert.match(prompt, /^- ANY POSITION: X \| no reference image$/m);
  assert.doesNotMatch(prompt, /DIFFERENT person/);
});

test('panel without characters is an establishing shot', () => {
  assert.match(buildFramePrompt(project, slide, frame({}), [lan]), /No main characters/);
});

test('reference file names are lower-case and 1-based', () => {
  assert.equal(characterRefName('abc', 0, 'x.JPG'), 'char-abc-1.jpg');
});
