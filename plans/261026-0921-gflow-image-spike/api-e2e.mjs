// Draws two frames of the funny test story through the app's own API with the configured image model, timing each call.
// The project is not changed: the API only stores the new image files. Run from the repo root with the app running.
import { buildFramePrompt } from '../../src/lib/prompt-builder.js';
import { frameEntries, migrateProject } from '../../src/lib/story-model.js';

const BASE = 'http://127.0.0.1:5174';
const call = async (method, url, body) => {
  const r = await fetch(BASE + url, { method, headers: { 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
  const data = await r.json();
  if (!r.ok) throw new Error(`${r.status}: ${data.error}`);
  return data;
};
const project = migrateProject(await call('GET', '/api/projects/caba2bdbfde4'));
const characters = await call('GET', '/api/characters');
const entries = frameEntries(project);
for (const label of process.argv.slice(2)) {
  const i = entries.findIndex((e) => `${e.s + 1}.${e.f + 1}` === label);
  const e = entries[i];
  const t0 = Date.now();
  try {
    const { file } = await call('POST', `/api/projects/${project.id}/images/generate`, {
      prompt: e.frame.prompt || buildFramePrompt(project, e.slide, e.frame, characters),
      characterIds: e.frame.characterIds,
      aspectRatio: e.aspectRatio,
      styleRefImage: entries[i - 1]?.frame.selectedImage || null,
    });
    console.log(`OK ${label} (${e.aspectRatio}): ${Math.round((Date.now() - t0) / 1000)}s -> ${file}`);
  } catch (err) {
    console.log(`FAIL ${label}: ${Math.round((Date.now() - t0) / 1000)}s ${err.message}`);
  }
}
