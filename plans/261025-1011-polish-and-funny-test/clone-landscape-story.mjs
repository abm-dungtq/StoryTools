// Creates "[Test] khổ ngang": a landscape copy of the portrait test story with its images re-uploaded,
// so UI checks can cover landscape layouts without drawing new images. Run from the repo root.
import { migrateProject, switchOrientation } from '../../src/lib/story-model.js';

const BASE = 'http://127.0.0.1:5173';
const SOURCE_TITLE = '[Test] Minh và chú mèo dưới mưa';
const TITLE = '[Test] khổ ngang';
const json = (path, opts) => fetch(BASE + path, opts).then(async (r) => (r.ok ? r.json() : Promise.reject(new Error(`${path} ${r.status}: ${await r.text()}`))));
const send = (method, path, body) => json(path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

const list = await json('/api/projects');
if (list.some((p) => p.title === TITLE)) {
  console.log(`exists: ${list.find((p) => p.title === TITLE).id}`);
  process.exit(0);
}
const source = migrateProject(await json(`/api/projects/${list.find((p) => p.title === SOURCE_TITLE).id}`));
let target = await send('POST', '/api/projects', { title: TITLE, orientation: 'landscape' });

// Re-upload every image the source uses and remember the new file names.
const renamed = new Map();
for (const file of new Set(source.slides.flatMap((s) => s.frames.flatMap((f) => f.images || [])))) {
  const blob = await fetch(`${BASE}/files/panels/${source.id}/${file}`).then((r) => r.blob());
  const form = new FormData();
  form.append('file', blob, file);
  renamed.set(file, (await json(`/api/projects/${target.id}/images/upload`, { method: 'POST', body: form })).file);
}
const slides = source.slides.map((s) => ({
  ...s,
  frames: s.frames.map((f) => ({
    ...f,
    images: (f.images || []).map((x) => renamed.get(x)),
    selectedImage: f.selectedImage ? renamed.get(f.selectedImage) : null,
  })),
}));
target = await send('PUT', `/api/projects/${target.id}`, {
  ...target,
  idea: source.idea,
  style: source.style,
  characterIds: source.characterIds,
  ...switchOrientation({ ...source, slides }, 'landscape'),
});
console.log(`created: ${target.id} (${target.slides.length} slides, ${renamed.size} images)`);
