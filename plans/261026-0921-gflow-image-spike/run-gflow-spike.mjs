// Spike: redraw a few frames of the funny test story with gflow-cli (Google Flow) instead of agy, timing each call,
// so the two image paths can be compared side by side. Run from the repo root after `gflow auth login --profile storytools`:
//   node plans/261026-0921-gflow-image-spike/run-gflow-spike.mjs [frameLabels…]   e.g. 3.1 9.1 14.1
import { execFile } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import { CHARACTER_IMAGE_DIR, PANEL_IMAGE_DIR, getProject, listCharacters } from '../../server/storage.js';
import { frameEntries, migrateProject } from '../../src/lib/story-model.js';

const PROJECT_ID = process.env.SPIKE_PROJECT_ID || 'caba2bdbfde4';
const MODEL = process.env.SPIKE_MODEL || 'nano2';
const OUT = path.resolve(process.env.SPIKE_OUT || 'plans/261026-0921-gflow-image-spike/out');
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : ['3.1', '9.1', '14.1'];
const GFLOW_ASPECTS = ['9:16', '16:9', '1:1', '4:3', '3:4'];

// gflow only offers five aspects; pick the one closest to the frame's cell.
const ratio = (a) => a.split(':').map(Number).reduce((w, h) => w / h);
const nearestAspect = (a) => GFLOW_ASPECTS.reduce((best, x) => (Math.abs(Math.log(ratio(x) / ratio(a))) < Math.abs(Math.log(ratio(best) / ratio(a))) ? x : best));

function gflow(args) {
  return new Promise((resolve, reject) => {
    execFile('gflow', args, { maxBuffer: 64 * 1024 * 1024, timeout: 15 * 60 * 1000, windowsHide: true }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`${err.message}\n${stderr.slice(-1500)}`));
      resolve(stdout);
    });
  });
}

const project = migrateProject(await getProject(PROJECT_ID));
const characters = await listCharacters();
await fs.mkdir(OUT, { recursive: true });
const results = [];

for (const e of frameEntries(project)) {
  const label = `${e.s + 1}.${e.f + 1}`;
  if (!wanted.includes(label)) continue;
  const refs = characters.filter((c) => e.frame.characterIds.includes(c.id)).flatMap((c) => c.images.map((f) => path.join(CHARACTER_IMAGE_DIR, f)));
  // Same style anchor agy gets: the frame drawn just before this one.
  const prev = frameEntries(project).filter((x) => x.s < e.s || (x.s === e.s && x.f < e.f)).at(-1)?.frame.selectedImage;
  if (prev) refs.push(path.join(PANEL_IMAGE_DIR, PROJECT_ID, prev));
  const aspect = nearestAspect(e.aspectRatio);
  const prompt = `${e.frame.prompt}\n\nKeep the character exactly as in the reference photos and the art style of the last reference. No text, no speech bubbles.`;
  const t0 = Date.now();
  try {
    const stdout = await gflow(['image', 'i2i', prompt, ...refs.flatMap((r) => ['--ref', r]), '--aspect', aspect, '--model', MODEL, '--profile', 'storytools', ...(process.env.SPIKE_FLOW_PROJECT ? ['--project', process.env.SPIKE_FLOW_PROJECT] : []), '--out', path.join(OUT, label), '--json']);
    const files = await fs.readdir(path.join(OUT, label));
    results.push({ label, aspect, refs: refs.length, seconds: Math.round((Date.now() - t0) / 1000), files, ok: true });
    console.log(`OK ${label} (${aspect}, ${refs.length} refs): ${Math.round((Date.now() - t0) / 1000)}s -> ${files.join(', ')}`);
    await fs.writeFile(path.join(OUT, label, 'result.json'), stdout);
  } catch (err) {
    results.push({ label, aspect, refs: refs.length, seconds: Math.round((Date.now() - t0) / 1000), ok: false, error: err.message.slice(0, 600) });
    console.log(`FAIL ${label}: ${err.message.slice(0, 600)}`);
  }
}
await fs.writeFile(path.join(OUT, 'summary.json'), JSON.stringify(results, null, 2));
