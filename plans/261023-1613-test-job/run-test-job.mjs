// One end-to-end test job against a running API: new project -> AI story plan -> draw every frame -> AI bubble placement.
// Mirrors runAll() in src/hooks/use-story-automation.js, using the app's own pure helpers; saves after each step
// like the editor's autosave. Run from the repo root: node plans/261023-1613-test-job/run-test-job.mjs
import http from 'node:http';
import { buildFramePrompt } from '../../src/lib/prompt-builder.js';
import { autoPlaceBubbles, imageToCell } from '../../src/lib/bubbles.js';
import { computeCells, getLayout } from '../../src/lib/layouts.js';
import { fitFrames, frameEntries, frameLabel, layoutForFrameCount, uid } from '../../src/lib/story-model.js';
import { imageInfo } from '../../server/agy-runner.js';

const BASE = process.env.API_BASE || 'http://127.0.0.1:5174';
const IDEA =
  'Minh đi học về dưới cơn mưa, thấy một chú mèo con ướt sũng trú dưới mái hiên tiệm tạp hoá. ' +
  'Cậu lấy áo khoác che cho mèo, mang về nhà lau khô và cho ăn. Kết thúc: mèo cuộn tròn ngủ trên ba lô của Minh.';

function call(method, url, body, raw = false) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const headers = data ? { 'content-type': 'application/json', 'content-length': data.length } : {};
    const req = http.request(BASE + url, { method, headers }, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (res.statusCode >= 400) return reject(new Error(`${method} ${url} -> ${res.statusCode}: ${buf.toString('utf8').slice(0, 400)}`));
        resolve(raw ? buf : JSON.parse(buf.toString('utf8')));
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const started = Date.now();
const log = (msg) => console.log(`[${Math.round((Date.now() - started) / 1000)}s] ${msg}`);

const characters = await call('GET', '/api/characters');
const minh = characters.find((c) => c.name === 'Minh');
if (!minh) throw new Error('Không thấy nhân vật Minh');

let project = await call('POST', '/api/projects', { title: '[Test] Minh và chú mèo dưới mưa', orientation: 'portrait' });
project = await call('PUT', `/api/projects/${project.id}`, { ...project, idea: IDEA, characterIds: [minh.id] });
log(`project ${project.id}`);

// 1. Story plan (writeStory)
const { slides } = await call('POST', `/api/projects/${project.id}/story/plan`, {
  storyIdea: IDEA, slideCount: 2, framesPerSlide: 2, characterIds: project.characterIds,
});
project.slides = slides.map((s) => {
  const layout = layoutForFrameCount(project.orientation, Math.max(1, s.frames.length));
  return { id: uid(), idea: s.idea, layoutId: layout.id, frames: fitFrames(s.frames, layout) };
});
project = await call('PUT', `/api/projects/${project.id}`, project);
log(`kịch bản: ${project.slides.length} ảnh, ${frameEntries(project).length} khung`);

const updateFrame = (id, patch) => {
  for (const s of project.slides) s.frames = s.frames.map((f) => (f.id === id ? { ...f, ...patch } : f));
};

// 2. Draw frames and place bubbles (fillFrames)
const failed = [];
let prevFile = null;
for (const e of frameEntries(project)) {
  const label = frameLabel(e.s, e.f, e.frameCount);
  const prompt = e.frame.prompt?.trim() || buildFramePrompt(project, e.slide, e.frame, characters);
  const t0 = Date.now();
  const { file } = await call('POST', `/api/projects/${project.id}/images/generate`, {
    prompt, characterIds: e.frame.characterIds, aspectRatio: e.aspectRatio,
    styleRefImage: project.usePrevFrameRef ? prevFile : null,
  });
  prevFile = file;
  updateFrame(e.frame.id, { prompt, images: [file], selectedImage: file });
  project = await call('PUT', `/api/projects/${project.id}`, project);
  log(`vẽ ${label} (${e.aspectRatio}): ${Math.round((Date.now() - t0) / 1000)}s`);

  const frame = frameEntries(project).find((x) => x.frame.id === e.frame.id).frame;
  const spoken = frame.dialogues.filter((d) => d.text?.trim());
  if (!spoken.length) continue;
  try {
    const t1 = Date.now();
    const cells = computeCells(project.orientation, getLayout(project.orientation, e.slide.layoutId));
    const cell = cells[e.f];
    const img = imageInfo(await call('GET', `/files/panels/${project.id}/${file}`, undefined, true));
    const nameOf = (id) => characters.find((c) => c.id === id)?.name || '';
    const result = await call('POST', `/api/projects/${project.id}/frames/bubbles`, {
      image: file, scene: frame.scene, action: frame.action,
      dialogues: spoken.map((d) => ({ speaker: nameOf(d.speakerId), text: d.text.trim() })),
      characters: characters.filter((c) => frame.characterIds.includes(c.id)).map((c) => ({ name: c.name, description: c.description })),
    });
    // Same mapping as placeBubblesFromImage in src/lib/frame-generation.js.
    const bubbles = autoPlaceBubbles(frame, { cellAspect: cell.w / cell.h, frameCount: cells.length }).map((base, i) => {
      const r = result.bubbles.find((b) => b.index === i);
      if (!r) return base;
      const center = imageToCell(r.bubbleX, r.bubbleY, img, cell);
      const speaker = imageToCell(r.speakerX, r.speakerY, img, cell);
      const cx = clamp(center.x, base.w / 2 + 0.02, 1 - base.w / 2 - 0.02);
      const cy = clamp(center.y, 0.06, 0.94);
      const dx = (speaker.x - cx) * cell.w;
      const dy = (speaker.y - cy) * cell.h;
      const dist = Math.hypot(dx, dy) || 1;
      const len = Math.min(dist * 0.7, Math.min(cell.w, cell.h) * 0.3);
      return { ...base, text: r.text.trim() || base.text, cx, cy,
        tx: clamp(cx + ((dx / dist) * len) / cell.w, 0, 1), ty: clamp(cy + ((dy / dist) * len) / cell.h, 0, 1) };
    });
    let k = 0;
    const dialogues = frame.dialogues.map((d) => (d.text?.trim() ? { ...d, text: bubbles[k++].text } : d));
    updateFrame(e.frame.id, { bubbles, dialogues, bubblePlacementFailed: false });
    log(`đặt thoại ${label}: ${bubbles.length} bóng, ${Math.round((Date.now() - t1) / 1000)}s`);
  } catch (err) {
    updateFrame(e.frame.id, { bubblePlacementFailed: true });
    failed.push(label);
    log(`đặt thoại ${label} LỖI: ${err.message}`);
  }
  project = await call('PUT', `/api/projects/${project.id}`, project);
}

log(`xong. project=${project.id}, khung lỗi đặt thoại: ${failed.length ? failed.join(', ') : 'không'}`);
