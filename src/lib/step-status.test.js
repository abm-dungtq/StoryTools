import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepStatus } from './step-status.js';

const frame = (patch) => ({ id: 'f', characterIds: [], dialogues: [], scene: 'x', ...patch });
const story = (frames, publish) => ({ orientation: 'portrait', slides: [{ id: 's', layoutId: 'p1', frames }], publish });

test('empty story has nothing done', () => {
  assert.deepEqual(stepStatus({ orientation: 'portrait', slides: [] }), { script: false, frames: false, compose: false, preview: false });
});

test('script done but images missing', () => {
  assert.deepEqual(stepStatus(story([frame({})])), { script: true, frames: false, compose: false, preview: false });
});

test('frame with dialogue needs bubbles that did not fail', () => {
  const spoken = { dialogues: [{ text: 'Chào' }], selectedImage: 'a.png' };
  assert.equal(stepStatus(story([frame({ ...spoken, bubbles: null })])).compose, false);
  assert.equal(stepStatus(story([frame({ ...spoken, bubbles: [], bubblePlacementFailed: true })])).compose, false);
  assert.equal(stepStatus(story([frame({ ...spoken, bubbles: [{ id: 'b' }] })])).compose, true);
});

test('posted story finishes the last step', () => {
  assert.equal(stepStatus(story([frame({ selectedImage: 'a.png' })], { status: 'posted' })).preview, true);
});
