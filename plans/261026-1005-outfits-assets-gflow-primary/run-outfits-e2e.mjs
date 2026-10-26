// End-to-end check of outfits per story stage through the running app's API: writes a short story, lets the costume
// director plan outfits and assets, draws the needed sheets and every frame, and saves the project so it can be opened
// in the app. Run from the repo root with the app running: node plans/261026-1005-outfits-assets-gflow-primary/run-outfits-e2e.mjs
import http from 'node:http';
import { applyOutfitPlan, confirmedCheck, frameSheets, isSlideConfirmed, missingSheets, outfitPlanRequest } from '../../src/lib/outfits.js';
import { buildFramePrompt, buildSheetNotes } from '../../src/lib/prompt-builder.js';
import { createFrame, fitFrames, frameEntries, layoutForFrameCount, migrateProject, uid } from '../../src/lib/story-model.js';

const BASE = 'http://127.0.0.1:5174';
const IDEA =
  process.env.E2E_IDEA ||
  'Sáng sớm Minh mặc đồng phục, đeo ba lô vội chạy đến trường thì trời đổ mưa. Chiều về nhà Minh thay đồ ở nhà, đeo tạp dề nấu cơm giúp mẹ nhưng làm cháy nồi cơm, cả nhà cười. Tối Minh mặc đồ ngủ, ngồi học bài, ba lô để cạnh bàn, rồi ngủ gục trên bàn.';
const SLIDES = Number(process.env.E2E_SLIDES) || 4;

// node:http instead of fetch: fetch gives up after 300 s without response headers, and a Flow draw can take longer.
const call = (method, url, body) =>
  new Promise((resolve, reject) => {
    const req = http.request(BASE + url, { method, headers: { 'content-type': 'application/json' } }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (text += c));
      res.on('end', () => {
        const data = JSON.parse(text);
        if (res.statusCode >= 400) reject(new Error(`${res.statusCode} ${url}: ${data.error}`));
        else resolve(data);
      });
    });
    req.on('error', reject);
    req.end(body && JSON.stringify(body));
  });
const t0 = Date.now();
const log = (...a) => console.log(`[${Math.round((Date.now() - t0) / 1000)}s]`, ...a);

const characters = await call('GET', '/api/characters');
// E2E_PROJECT=<id> resumes a project from an earlier run: only missing sheets and frames are drawn.
const RESUME = process.env.E2E_PROJECT;
let p = migrateProject(RESUME ? await call('GET', `/api/projects/${RESUME}`) : await call('POST', '/api/projects', { title: 'Thử trang phục theo giai đoạn' }));
p = { ...p, idea: IDEA, characterIds: characters.filter((c) => c.name === 'Minh').map((c) => c.id) };

// E2E_MANUAL=1 skips both agy text calls (story and costume director) and fills step 1 and 2 by hand, as a user would,
// so the gflow drawing path can be checked while agy has no quota.
const MANUAL = process.env.E2E_MANUAL === '1';
const minhId = p.characterIds[0];
const manualSlides = [
  ['Sáng sớm vội đi học', 'cổng nhà buổi sáng', 'Minh mặc đồng phục, đeo ba lô, chạy vội ra cổng', ['bag']],
  ['Trời đổ mưa trên đường', 'con đường gần trường, trời mưa', 'Minh lấy ba lô che đầu, chạy dưới mưa', ['bag']],
  ['Nấu cơm giúp mẹ', 'căn bếp nhỏ buổi chiều', 'Minh đeo tạp dề, mở nồi cơm cháy khói bốc lên', ['apron', 'kitchen']],
  ['Ngủ gục trên bàn học', 'bàn học buổi tối dưới đèn bàn', 'Minh ngủ gục trên vở, ba lô dựng cạnh bàn', ['bag']],
];
const stageOf = [0, 0, 1, 2];
if (RESUME) {
  log(`resume project ${p.id}`);
} else if (MANUAL) {
  const outfitIds = [uid(), uid(), uid()];
  const assetIds = { bag: uid(), apron: uid(), kitchen: uid() };
  p.outfits = [
    ['Đồng phục đi học', 'áo sơ mi trắng ngắn tay cài khuy, quần âu xanh đậm, giày thể thao trắng'],
    ['Đồ ở nhà', 'áo phông cotton xám nhạt, quần short kaki nâu, dép tổ ong xanh'],
    ['Đồ ngủ', 'bộ pijama cotton xanh nhạt kẻ sọc trắng, chân trần'],
  ].map(([name, description], i) => ({ id: outfitIds[i], characterId: minhId, name, description, image: null }));
  p.assets = [
    { id: assetIds.bag, kind: 'prop', name: 'Ba lô', description: 'ba lô vải màu đỏ cam, hai quai, có móc khoá hình con mèo', image: null },
    { id: assetIds.apron, kind: 'prop', name: 'Tạp dề', description: 'tạp dề vải kẻ ô vuông xanh lá trắng, dây buộc sau lưng', image: null },
    { id: assetIds.kitchen, kind: 'place', name: 'Căn bếp', description: 'căn bếp nhỏ gạch men trắng, bếp ga hai lò, nồi cơm điện trên bàn gỗ', image: null },
  ];
  p.slides = manualSlides.map(([idea, scene, action, assets], i) => {
    const layout = layoutForFrameCount(p.orientation, 1);
    const frames = fitFrames([createFrame({ characterIds: [minhId], scene, action, assetIds: assets.map((k) => assetIds[k]) })], layout);
    return { id: uid(), idea, layoutId: layout.id, frames, outfits: { [minhId]: outfitIds[stageOf[i]] }, outfitCheck: null };
  });
  p.outfitsPlannedAt = new Date().toISOString();
  p = migrateProject(p);
  p.slides = p.slides.map((s) => ({ ...s, outfitCheck: confirmedCheck(p, s) }));
  log('manual story and outfits:', p.slides.map((s, i) => `${i + 1}:${isSlideConfirmed(p, s) ? 'ok' : 'CHECK'}`).join(' '));
} else {
  const { slides } = await call('POST', `/api/projects/${p.id}/story/plan`, { storyIdea: IDEA, slideCount: SLIDES, framesPerSlide: 1, characterIds: p.characterIds });
  p.slides = slides.map((s) => {
    const layout = layoutForFrameCount(p.orientation, Math.max(1, s.frames.length));
    return { id: uid(), idea: s.idea, layoutId: layout.id, frames: fitFrames(s.frames, layout), outfits: {}, outfitCheck: null };
  });
  p = migrateProject(p);
  log(`story: ${p.slides.length} slides`);
}

for (let pass = 1; pass <= 2 && !MANUAL && !RESUME; pass++) {
  const plan = await call('POST', `/api/projects/${p.id}/outfits/plan`, outfitPlanRequest(p));
  p = applyOutfitPlan(p, plan, { auto: true });
  log(`outfit plan pass ${pass}:`, p.slides.map((s, i) => `${i + 1}:${isSlideConfirmed(p, s) ? 'ok' : `CHECK(${s.outfitCheck?.note})`}`).join(' '));
  if (p.slides.every((s) => isSlideConfirmed(p, s))) break;
}
for (const o of p.outfits) log(`outfit "${o.name}": ${o.description}`);
for (const a of p.assets) log(`asset ${a.kind} "${a.name}": ${a.description}`);
p.slides.forEach((s, i) => log(`slide ${i + 1}: ${s.idea} | wears ${Object.values(s.outfits).map((id) => p.outfits.find((o) => o.id === id)?.name).join(', ')} | assets ${s.frames.flatMap((f) => f.assetIds).map((id) => p.assets.find((a) => a.id === id)?.name).join(', ')}`));
await call('PUT', `/api/projects/${p.id}`, p);

const { outfits, assets } = missingSheets(p);
for (const [key, item, kind] of [...outfits.map((o) => ['outfits', o, 'outfit']), ...assets.map((a) => ['assets', a, a.kind])]) {
  const r = await call('POST', `/api/projects/${p.id}/sheets/generate`, { kind, name: item.name, description: item.description, characterId: item.characterId, style: p.style });
  p = { ...p, [key]: p[key].map((x) => (x.id === item.id ? { ...x, image: r.file, imageEngine: r.engine, imageDescription: x.description } : x)) };
  log(`sheet ${kind} "${item.name}" -> ${r.file} (${r.engine}${r.fallbackReason ? `: ${r.fallbackReason}` : ''})`);
  await call('PUT', `/api/projects/${p.id}`, p);
}

let prev = null;
for (const e of frameEntries(p)) {
  if (!isSlideConfirmed(p, e.slide)) {
    log(`skip slide ${e.s + 1}: not confirmed`);
    continue;
  }
  if (e.frame.selectedImage) {
    prev = e.frame.selectedImage;
    continue;
  }
  const { outfits: o, assets: a } = frameSheets(p, e.slide, e.frame);
  const notes = buildSheetNotes(p, e.slide, e.frame, characters);
  const prevSlide = p.slides[e.s - 1];
  const changed = prevSlide && e.frame.characterIds.some((id) => prevSlide.outfits[id] !== e.slide.outfits[id]);
  const r = await call('POST', `/api/projects/${p.id}/images/generate`, {
    prompt: `${buildFramePrompt(p, e.slide, e.frame, characters)}\n${notes}`,
    characterIds: e.frame.characterIds,
    aspectRatio: e.aspectRatio,
    styleRefImage: changed ? null : prev,
    outfits: o.map(({ characterId, name, image }) => ({ characterId, name, image })),
    assets: a.map(({ id, kind, name, image }) => ({ id, kind, name, image })),
  });
  prev = r.file;
  p.slides[e.s].frames[e.f] = { ...e.frame, images: [r.file], selectedImage: r.file };
  log(`frame ${e.s + 1}.${e.f + 1} -> ${r.file} (${r.engine}${r.fallbackReason ? `: ${r.fallbackReason}` : ''})`);
  await call('PUT', `/api/projects/${p.id}`, p);
}
log(`done: project ${p.id}`);
