import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFrameRefs } from './frame-refs.js';
import { fallbackPolicy } from './image-engine.js';
import { normalizeOutfitPlan, outfitPlanInput } from './outfit-plan.js';

const characters = [
  { id: 'minh', name: 'Minh', traits: 'tóc rối', images: ['m1.png', 'm2.png', 'm3.png'] },
  { id: 'lan', name: 'Lan', images: ['l1.jpg'] },
];
const slide = (id, patch) => ({ id, idea: '', locked: false, outfits: {}, frames: [{ id: `${id}-f1`, characterIds: ['minh', 'lan'], scene: '', action: '', assetIds: [] }], ...patch });

test('the script for the model uses names, numbers and keys, never stored ids of slides or frames', () => {
  const script = outfitPlanInput({
    storyIdea: ' đi học ',
    slides: [slide('s1', { outfits: { minh: 'o1' } })],
    characters,
    outfits: [{ id: 'o1', characterId: 'minh', name: 'Đồng phục', description: 'áo trắng' }],
    assets: [],
  });
  assert.equal(script.story, 'đi học');
  assert.deepEqual(script.slides[0].outfits, [{ character: 'Minh', outfit: 'o1' }]);
  assert.deepEqual(script.slides[0].frames[0], { frame: 1, characters: ['Minh', 'Lan'], scene: '', action: '', assets: [] });
  assert.ok(!JSON.stringify(script).includes('s1-f1'));
});

test('normalizeOutfitPlan maps names and keys to ids, mints new ids and rejects foreign outfits', () => {
  let n = 0;
  const makeId = () => `new${++n}`;
  const existing = [{ id: 'o1', characterId: 'minh', name: 'Đồng phục', description: 'áo trắng', image: 'o1.jpg' }];
  const raw = {
    outfits: [
      { key: 'o1', character: 'minh', name: 'Đồng phục', description: 'áo trắng' },
      { key: 'new-1', character: 'Lan', name: 'Váy hoa', description: 'váy hoa vàng' },
      { key: 'new-2', character: 'Ai đó', name: 'X', description: 'y' },
    ],
    assets: [{ key: 'new-a1', kind: 'weird', name: 'Ba lô', description: 'ba lô xanh' }],
    slides: [
      { slide: 1, outfits: [{ character: 'Minh', outfit: 'o1' }, { character: 'Lan', outfit: 'new-1' }], frames: [{ frame: 1, assets: ['new-a1', 'nope'] }], ok: true, note: '' },
      { slide: 2, outfits: [{ character: 'Minh', outfit: 'new-1' }], frames: [], ok: true, note: '' },
    ],
  };
  const out = normalizeOutfitPlan(raw, { slides: [slide('s1'), slide('s2')], characters, outfits: existing, assets: [] }, makeId);
  assert.deepEqual(out.outfits.map((o) => [o.id, o.characterId, o.image]), [['o1', 'minh', 'o1.jpg'], ['new1', 'lan', null]]);
  assert.deepEqual(out.assets, [{ id: 'new2', kind: 'prop', name: 'Ba lô', description: 'ba lô xanh', image: null }]);
  assert.deepEqual(out.slides[0], { id: 's1', outfits: { minh: 'o1', lan: 'new1' }, frameAssets: { 's1-f1': ['new2'] }, ok: true, note: '' });
  assert.equal(out.slides[1].ok, false, "Lan's outfit given to Minh is dropped, so slide 2 is incomplete");
  assert.deepEqual(out.slides[1].outfits, {});
});

test('a changed description drops the old sheet, and locked slides keep their outfits', () => {
  const existing = [{ id: 'o1', characterId: 'minh', name: 'A', description: 'áo trắng', image: 'o1.jpg' }];
  const raw = { outfits: [{ key: 'o1', character: 'Minh', name: 'A', description: 'áo xanh' }], assets: [], slides: [{ slide: 1, outfits: [], frames: [], ok: true, note: 'ổn' }] };
  const locked = slide('s1', { locked: true, outfits: { minh: 'o0', lan: 'l' }, frames: [{ id: 'f', characterIds: ['minh'], assetIds: ['a'] }] });
  const out = normalizeOutfitPlan(raw, { slides: [locked], characters, outfits: existing, assets: [] }, () => 'x');
  assert.equal(out.outfits[0].image, null);
  assert.deepEqual(out.slides[0].outfits, { minh: 'o0', lan: 'l' });
  assert.deepEqual(out.slides[0].frameAssets, { f: ['a'] });
});

test('frame refs rank outfit sheets, identity photos, place, props and previous panel, and drop extra photos under an outfit', () => {
  const refs = buildFrameRefs({
    characters,
    outfits: [{ characterId: 'minh', name: 'Đồng phục', image: 'om.jpg' }],
    assets: [{ id: 'a1', kind: 'prop', name: 'Ba lô', image: 'a1.jpg' }, { id: 'a2', kind: 'place', name: 'Bếp', image: 'a2.jpg' }, { id: 'a3', kind: 'prop', name: 'Ô', image: null }],
    styleRefImage: 'prev.jpg',
  });
  assert.deepEqual(
    refs.map((r) => [r.name, r.priority]),
    [['outfit-minh.jpg', 0], ['char-minh-1.png', 1], ['char-lan-1.jpg', 1], ['asset-a1.jpg', 3], ['asset-a2.jpg', 2], ['previous-panel.jpg', 5]],
  );
  assert.match(refs[1].label, /Ignore the clothes/);
  assert.match(refs.at(-1).label, /ONLY for art style/);
});

test('fallback policy: cancel and bad requests rethrow, prompt-specific errors fall back once, login and credits pause Flow', () => {
  assert.equal(fallbackPolicy({ status: 499 }), 'throw');
  assert.equal(fallbackPolicy({ status: 400 }), 'throw');
  assert.equal(fallbackPolicy({ status: 502, flowClass: 'ContentPolicyError' }), 'once');
  assert.equal(fallbackPolicy({ status: 502, flowClass: 'AuthExpiredError' }), 'sticky');
  assert.equal(fallbackPolicy({ status: 502, flowClass: 'InsufficientCreditsError' }), 'sticky');
  assert.equal(fallbackPolicy({ status: 504 }), 'cooldown');
});

test('outfits a locked slide wears keep their description and sheet even when the model rewords them', () => {
  const existing = [{ id: 'o1', characterId: 'minh', name: 'Đồng phục', description: 'áo sơ mi trắng ngắn tay', image: 'o1.jpg' }];
  const raw = { outfits: [{ key: 'o1', character: 'Minh', name: 'Đồng phục', description: 'áo sơ mi trắng' }], assets: [], slides: [{ slide: 1, ok: true }] };
  const locked = slide('s1', { locked: true, outfits: { minh: 'o1' }, frames: [{ id: 'f', characterIds: ['minh'], assetIds: [] }] });
  const out = normalizeOutfitPlan(raw, { slides: [locked], characters, outfits: existing, assets: [] }, () => 'x');
  assert.deepEqual(out.outfits[0], existing[0]);
});

test('slides, frames and characters the model skipped keep their assignment and are not marked ok', () => {
  const existing = [
    { id: 'o1', characterId: 'minh', name: 'A', description: 'áo trắng' },
    { id: 'o2', characterId: 'lan', name: 'B', description: 'váy hoa' },
  ];
  const assets = [{ id: 'a1', kind: 'prop', name: 'Ba lô', description: 'ba lô' }];
  const s1 = slide('s1', { outfits: { minh: 'o1', lan: 'o2' }, frames: [{ id: 'f1', characterIds: ['minh', 'lan'], assetIds: ['a1'] }] });
  const s2 = slide('s2', { outfits: { minh: 'o1' }, frames: [{ id: 'f2', characterIds: ['minh'], assetIds: ['a1'] }] });
  const raw = { outfits: [], assets: [], slides: [{ slide: 1, outfits: [{ character: 'Minh', outfit: 'o1' }], frames: [], ok: true, note: '' }] };
  const out = normalizeOutfitPlan(raw, { slides: [s1, s2], characters, outfits: existing, assets }, () => 'x');
  assert.deepEqual(out.slides[0].outfits, { minh: 'o1', lan: 'o2' }, 'Lan was skipped and keeps her outfit');
  assert.deepEqual(out.slides[0].frameAssets, { f1: ['a1'] }, 'frame 1 was skipped and keeps its assets');
  assert.deepEqual(out.slides[1], { id: 's2', outfits: { minh: 'o1' }, frameAssets: { f2: ['a1'] }, ok: false, note: 'AI không trả lời ảnh này, hãy kiểm tra tay.' });
});

test('a key the model reuses never remaps an existing outfit or a new one', () => {
  let n = 0;
  const existing = [{ id: 'o1', characterId: 'minh', name: 'A', description: 'áo trắng' }];
  const raw = {
    outfits: [
      { key: 'o1', character: 'Lan', name: 'Váy', description: 'váy' },
      { key: 'new-1', character: 'Lan', name: 'Đầm', description: 'đầm' },
      { key: 'new-1', character: 'Lan', name: 'Áo', description: 'áo' },
    ],
    assets: [],
    slides: [{ slide: 1, outfits: [{ character: 'Minh', outfit: 'o1' }, { character: 'Lan', outfit: 'new-1' }], frames: [], ok: true }],
  };
  const out = normalizeOutfitPlan(raw, { slides: [slide('s1')], characters, outfits: existing, assets: [] }, () => `n${++n}`);
  assert.deepEqual(out.outfits.map((o) => o.name), ['A', 'Đầm']);
  assert.deepEqual(out.slides[0].outfits, { minh: 'o1', lan: 'n1' });
});
