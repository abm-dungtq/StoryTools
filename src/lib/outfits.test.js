import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyOutfitPlan, confirmedCheck, isSheetStale, isSlideConfirmed, missingSheets, outfitPlanRequest, slideIssues } from './outfits.js';
import { buildSheetNotes } from './prompt-builder.js';

const minh = { id: 'minh', name: 'Minh' };
const frame = (patch) => ({ id: 'f1', characterIds: ['minh'], scene: 'lớp học', action: 'đọc sách', dialogues: [], assetIds: [], ...patch });
const base = () => ({
  idea: 'truyện',
  characterIds: ['minh'],
  outfitsPlannedAt: '2026-10-26T00:00:00Z',
  outfits: [
    { id: 'o1', characterId: 'minh', name: 'Đồng phục', description: 'áo trắng, quần xanh', image: 'o1.jpg' },
    { id: 'o2', characterId: 'minh', name: 'Đồ ở nhà', description: 'áo phông xám', image: null },
  ],
  assets: [{ id: 'a1', kind: 'prop', name: 'Ba lô', description: 'ba lô xanh', image: null }],
  slides: [{ id: 's1', idea: 'đi học', outfits: { minh: 'o1' }, outfitCheck: null, frames: [frame({ assetIds: ['a1'] })] }],
});

test('a slide is drawable only once confirmed, and any later edit of outfit, scene or asset asks again', () => {
  const p = base();
  assert.equal(isSlideConfirmed(p, p.slides[0]), false);
  p.slides[0].outfitCheck = confirmedCheck(p, p.slides[0]);
  assert.equal(isSlideConfirmed(p, p.slides[0]), true);

  const dialogueEdit = structuredClone(p);
  dialogueEdit.slides[0].frames[0].dialogues = [{ text: 'chào' }];
  assert.equal(isSlideConfirmed(dialogueEdit, dialogueEdit.slides[0]), true, 'dialogue does not touch clothes');

  for (const edit of [
    (q) => (q.slides[0].frames[0].scene = 'trong bếp'),
    (q) => (q.outfits[0].description = 'áo dài'),
    (q) => (q.slides[0].outfits.minh = 'o2'),
    (q) => (q.assets[0].description = 'ba lô đỏ'),
  ]) {
    const q = structuredClone(p);
    edit(q);
    assert.equal(isSlideConfirmed(q, q.slides[0]), false);
  }
});

test('stories without outfit planning and slides without people are never held back', () => {
  const p = base();
  assert.equal(isSlideConfirmed({ ...p, outfitsPlannedAt: null }, p.slides[0]), true);
  const empty = { ...p.slides[0], frames: [frame({ characterIds: [] })] };
  assert.equal(isSlideConfirmed(p, empty), true);
});

test('slideIssues names characters without an outfit and frames with deleted assets', () => {
  const p = base();
  p.slides[0].outfits = {};
  p.slides[0].frames[0].assetIds = ['gone'];
  assert.deepEqual(slideIssues(p, p.slides[0], [minh]), ['Minh chưa có trang phục', 'Khung 1 gắn đồ vật/bối cảnh đã xoá']);
});

test('applyOutfitPlan merges by id and only auto-confirms slides the AI and the code both accept', () => {
  const p = base();
  p.slides.push({ id: 's2', idea: 'về nhà', outfits: {}, outfitCheck: null, frames: [frame({ id: 'f2', scene: 'bếp' })] });
  const plan = {
    outfits: p.outfits,
    assets: p.assets,
    slides: [
      { id: 's1', outfits: { minh: 'o1' }, frameAssets: { f1: ['a1'] }, ok: true, note: '' },
      { id: 's2', outfits: {}, frameAssets: { f2: [] }, ok: true, note: '' },
    ],
  };
  const next = applyOutfitPlan(p, plan, { auto: true });
  assert.equal(isSlideConfirmed(next, next.slides[0]), true);
  assert.equal(isSlideConfirmed(next, next.slides[1]), false, 'Minh has no outfit in slide 2, whatever the AI said');
  assert.equal(isSlideConfirmed(applyOutfitPlan(p, plan), applyOutfitPlan(p, plan).slides[0]), false, 'manual mode waits for the user');
});

test('confirmed slides go to the costume director as locked', () => {
  const p = base();
  p.slides[0].outfitCheck = confirmedCheck(p, p.slides[0]);
  assert.equal(outfitPlanRequest(p).slides[0].locked, true);
  p.slides[0].frames[0].scene = 'sân trường';
  assert.equal(outfitPlanRequest(p).slides[0].locked, false);
});

test('missing sheets only list outfits and assets some frame uses', () => {
  const p = base();
  assert.deepEqual(missingSheets(p).outfits, []);
  assert.deepEqual(missingSheets(p).assets.map((a) => a.id), ['a1']);
  p.slides[0].outfits.minh = 'o2';
  assert.deepEqual(missingSheets(p).outfits.map((o) => o.id), ['o2']);
});

test('sheet notes state the stage outfit over the traits and list the frame assets', () => {
  const p = base();
  const notes = buildSheetNotes(p, p.slides[0], p.slides[0].frames[0], [minh]);
  assert.match(notes, /replaces any clothing/);
  assert.match(notes, /- Minh wears "Đồng phục": áo trắng, quần xanh/);
  assert.match(notes, /- Prop "Ba lô": ba lô xanh/);
  assert.equal(buildSheetNotes({ ...p, outfits: [], assets: [] }, p.slides[0], p.slides[0].frames[0], [minh]), '');
});

test('a plan keeps sheets drawn while it ran and items added meanwhile, unless it changed the description', () => {
  const p = base();
  const sent = structuredClone(p);
  p.outfits[1] = { ...p.outfits[1], image: 'o2.jpg', imageDescription: 'áo phông xám' };
  p.assets.push({ id: 'a2', kind: 'place', name: 'Bếp', description: 'bếp', image: null });
  const plan = { outfits: sent.outfits, assets: [{ ...sent.assets[0], description: 'ba lô đỏ' }], slides: [] };
  const next = applyOutfitPlan(p, plan);
  assert.equal(next.outfits[1].image, 'o2.jpg');
  assert.deepEqual(next.assets.map((a) => [a.id, a.description]), [['a1', 'ba lô đỏ'], ['a2', 'bếp']]);
});

test('a character removed from the cast no longer holds a slide back', () => {
  const p = base();
  p.slides[0].frames[0].characterIds = ['minh', 'lan'];
  p.slides[0].outfitCheck = confirmedCheck(p, p.slides[0]);
  assert.equal(isSlideConfirmed(p, p.slides[0]), true, 'lan is not in the cast');
  assert.deepEqual(slideIssues(p, p.slides[0], [minh]), []);
});

test('an outfit or asset without a description is an issue, and a sheet drawn from an old description is redrawn', () => {
  const p = base();
  p.outfits[0].description = ' ';
  assert.deepEqual(slideIssues(p, p.slides[0], [minh]), ['Trang phục "Đồng phục" của Minh chưa có mô tả']);
  const q = base();
  q.outfits[0].imageDescription = 'áo cũ';
  assert.equal(isSheetStale(q.outfits[0]), true);
  assert.deepEqual(missingSheets(q).outfits.map((o) => o.id), ['o1']);
});
