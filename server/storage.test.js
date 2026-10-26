import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Point storage at a throwaway folder before importing it, so tests never touch real data.
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'storytools-storage-'));
const store = await import('./storage.js');
await store.ensureDataDirs();

test('concurrent saves of one project all succeed', async () => {
  await Promise.all(Array.from({ length: 20 }, (_, i) => store.saveProject({ id: 'abc123', title: `t${i}`, slides: [] })));
  const project = await store.getProject('abc123');
  assert.match(project.title, /^t\d+$/);
  const leftovers = fs.readdirSync(path.join(store.DATA_DIR, 'projects')).filter((f) => f.endsWith('.tmp'));
  assert.deepEqual(leftovers, []);
});

test('concurrent settings patches keep both keys', async () => {
  await Promise.all([
    store.saveSettings({ textModel: 'a' }),
    store.saveSettings({ imageModel: 'gflow:nano-pro' }),
    store.saveSettings({ fallbackImageModel: 'b' }),
  ]);
  const settings = await store.getSettings();
  assert.equal(settings.textModel, 'a');
  assert.equal(settings.imageModel, 'gflow:nano-pro');
  assert.equal(settings.fallbackImageModel, 'b');
});

test('a Flow model saved under the old single image key becomes the Flow model, not the agy fallback', async () => {
  const file = path.join(store.DATA_DIR, 'settings.json');
  fs.writeFileSync(file, JSON.stringify({ agyImageModel: 'gflow:nano2' }));
  assert.deepEqual(await store.getSettings(), { textModel: 'gemini-4-argon-medium', imageModel: 'gflow:nano2', fallbackImageModel: 'gemini-3.8-flash-low' });
  await store.saveSettings({ fallbackImageModel: 'gemini-x' });
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { flowImageModel: 'gflow:nano2', agyImageModel: 'gemini-x' });
});

test('startup drops the legacy key and stale job dirs', async () => {
  const file = path.join(store.DATA_DIR, 'settings.json');
  fs.writeFileSync(file, JSON.stringify({ apiKey: 'old', textModel: 'gemini-2.5-flash', agyTextModel: 'keep' }));
  fs.mkdirSync(path.join(store.DATA_DIR, 'tmp', 'stale'), { recursive: true });
  await store.ensureDataDirs();
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { agyTextModel: 'keep' });
  assert.equal(fs.existsSync(path.join(store.DATA_DIR, 'tmp')), false);
});
