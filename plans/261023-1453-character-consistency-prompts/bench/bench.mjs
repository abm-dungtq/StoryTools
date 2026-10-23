// Character-mixing benchmark: draws the same multi-character frames with a given prompt builder and server.
// Run from the repo root with BENCH_DIR set to the server's DATA_DIR:
//   node <plan>/bench/bench.mjs setup
//   node <plan>/bench/bench.mjs run <label> --builder <path to prompt-builder.js>
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const BASE = flag('--base') || 'http://127.0.0.1:5176';
const BENCH = process.env.BENCH_DIR;
if (!BENCH) throw new Error('BENCH_DIR is not set');
const STATE = path.join(BENCH, 'state.json');

// node:http has no response timeout, unlike fetch (300 s), and one drawing can take longer.
function call(method, url, body) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : Buffer.from(JSON.stringify(body));
    const headers = data ? { 'content-type': 'application/json', 'content-length': data.length } : {};
    const req = http.request(BASE + url, { method, headers }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (d) => (text += d));
      res.on('end', () => {
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch { /* plain-text error */ }
        if (res.statusCode >= 400) reject(new Error(`${method} ${url} -> ${res.statusCode}: ${json?.error || text}`));
        else resolve(json);
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const CAST = [
  { id: 'chlan001', name: 'Lan', description: 'cô gái 20 tuổi, tóc đen dài buộc đuôi ngựa, áo dài đỏ, dáng mảnh' },
  { id: 'chhung01', name: 'Ông Hùng', description: 'ông lão 70 tuổi, tóc bạc cắt ngắn, râu bạc, kính gọng tròn, áo bà ba nâu, dáng gầy' },
];
const STORY =
  'Minh, Lan và Ông Hùng cùng dọn dẹp quán phở nhỏ của Ông Hùng sau một ngày mưa rồi ngồi ăn tối với nhau. ' +
  'Mọi khung đều có ít nhất hai trong ba người, đứng ở các vị trí khác nhau và trò chuyện.';

async function setup() {
  const real = JSON.parse(await fs.readFile('data/characters.json', 'utf8')).find((c) => c.name === 'Minh');
  if (!real?.images?.length) throw new Error('Minh has no reference image in data/characters.json');
  await fs.mkdir(path.join(BENCH, 'characters'), { recursive: true });
  await fs.copyFile(path.join('data', 'characters', real.images[0]), path.join(BENCH, 'characters', real.images[0]));
  const cast = [{ id: real.id, name: real.name, description: real.description || '', images: [real.images[0]] }];

  const refsProject = await call('POST', '/api/projects', { title: 'bench-refs' });
  for (const c of CAST) {
    const { file } = await call('POST', `/api/projects/${refsProject.id}/images/generate`, {
      prompt: `Character reference picture: one person only, full body, front view, plain light grey background, soft comic illustration. ${c.description}. Do NOT draw any text.`,
      aspectRatio: '1:1',
    });
    await fs.copyFile(path.join(BENCH, 'panels', refsProject.id, file), path.join(BENCH, 'characters', file));
    cast.push({ ...c, images: [file] });
  }
  for (const c of cast) c.traits = (await call('POST', '/api/characters/traits', c)).traits;
  await call('PUT', '/api/characters', cast);

  const project = await call('POST', '/api/projects', { title: 'bench-story' });
  project.characterIds = cast.map((c) => c.id);
  let slides = [];
  let multi = [];
  for (let attempt = 0; attempt < 2 && multi.length < 6; attempt++) {
    ({ slides } = await call('POST', `/api/projects/${project.id}/story/plan`, {
      storyIdea: STORY, slideCount: 4, framesPerSlide: 2, characterIds: project.characterIds,
    }));
    multi = slides.flatMap((s) => s.frames).filter((f) => f.characterIds.length >= 2);
  }
  if (multi.length < 6) throw new Error(`only ${multi.length} multi-character frames after 2 attempts`);
  project.idea = STORY;
  project.slides = slides.map((s, i) => ({ id: `benchslide${i}`, idea: s.idea, layoutId: 'p2', frames: s.frames }));
  await call('PUT', `/api/projects/${project.id}`, project);
  await fs.writeFile(STATE, JSON.stringify({ projectId: project.id, frameIds: multi.slice(0, 6).map((f) => f.id) }, null, 2));
  console.log(`setup ok project=${project.id} multi=${multi.length}`);
  for (const c of cast) console.log(`${c.name}: ${c.traits}`);
}

async function run(label) {
  const builder = flag('--builder');
  if (!builder) throw new Error('--builder is required');
  const { buildFramePrompt } = await import(pathToFileURL(path.resolve(builder)).href);
  const { projectId, frameIds } = JSON.parse(await fs.readFile(STATE, 'utf8'));
  const project = await call('GET', `/api/projects/${projectId}`);
  const characters = await call('GET', '/api/characters');
  const out = path.join(BENCH, 'results', label);
  await fs.mkdir(out, { recursive: true });
  const rows = [];
  let prev = null;
  for (const [i, frameId] of frameIds.entries()) {
    const slide = project.slides.find((s) => s.frames.some((f) => f.id === frameId));
    const frame = slide.frames.find((f) => f.id === frameId);
    const prompt = buildFramePrompt(project, slide, frame, characters);
    const started = Date.now();
    const { file } = await call('POST', `/api/projects/${projectId}/images/generate`, {
      prompt, characterIds: frame.characterIds, aspectRatio: '1:1', styleRefImage: prev,
    });
    const seconds = Math.round((Date.now() - started) / 1000);
    await fs.copyFile(path.join(BENCH, 'panels', projectId, file), path.join(out, `frame-${i + 1}${path.extname(file)}`));
    prev = file;
    const cast = frame.characterIds.map((id) => characters.find((c) => c.id === id)?.name);
    rows.push({ n: i + 1, frameId, cast, positions: frame.positions || {}, action: frame.action, seconds, prompt });
    console.log(`${label} frame ${i + 1}/${frameIds.length}: ${seconds}s`);
  }
  await fs.writeFile(path.join(out, 'results.json'), JSON.stringify(rows, null, 2));
}

const [command, label] = args;
if (command === 'setup') await setup();
else if (command === 'run' && label) await run(label);
else throw new Error('usage: bench.mjs setup | run <label> --builder <path>');
