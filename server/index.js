// Local API server: storage for characters/projects, AI writing through agy, image drawing through gflow (agy fallback), static image files.
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import * as store from './storage.js';
import { characterRefName } from '../src/lib/ref-names.js';
import { agyVersion, describeCharacter, generateCaption, generateFrames, generateStoryPlan, listModels, placeBubbles, planOutfits } from './agy.js';
import { buildFrameRefs } from './frame-refs.js';
import { GFLOW_MODELS, gflowVersion } from './gflow.js';
import { drawImage, flowPause, resumeFlow } from './image-engine.js';
import { normalizeOutfitPlan, outfitPlanInput } from './outfit-plan.js';
import { shareStatus, startShare, stopShare } from './lan-share.js';

const PORT = Number(process.env.PORT) || 5174;
const DIST_DIR = path.resolve(store.DATA_DIR, '..', 'dist');
const DEFAULT_STYLE =
  'Warm hand-drawn anime illustration in the style of Studio Ghibli, soft watercolor textures, golden warm lighting, clean line art, cozy slice-of-life mood';

// Cast for an AI call. Prefer ids from the request: the client autosave may not have persisted the latest cast yet.
async function castFor(project, characterIds) {
  const ids = Array.isArray(characterIds) ? characterIds : project.characterIds;
  return (await store.listCharacters()).filter((c) => ids.includes(c.id));
}

/** Aborts the AI call when the browser cancels the request or goes away. */
function clientSignal(res) {
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });
  return controller.signal;
}

const POSITIONS = ['left', 'center', 'right'];

/** Converts model-written frames (character names) into stored frames (character ids). */
function toStoredFrames(frames, characters) {
  const byName = new Map(characters.map((c) => [c.name.trim().toLowerCase(), c.id]));
  const toId = (name) => byName.get(String(name || '').trim().toLowerCase()) || null;
  return frames.map((f) => ({
    id: store.newId(),
    scene: f.scene || '',
    action: f.action || '',
    expression: f.expression || '',
    characterIds: [...new Set((f.characters || []).map(toId).filter(Boolean))],
    positions: Object.fromEntries(
      (f.positions || [])
        .map((p) => [toId(p?.name), p?.position])
        .filter(([id, pos]) => id && POSITIONS.includes(pos)),
    ),
    dialogues: (f.dialogues || []).map((d) => ({ speakerId: toId(d.speaker), text: d.text || '' })),
    prompt: '',
    images: [],
    selectedImage: null,
    bubbles: null,
  }));
}

const app = express();
app.use(express.json({ limit: '10mb' }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// ---- settings ----
app.get('/api/settings', async (_req, res) => {
  const { textModel, imageModel, fallbackImageModel } = await store.getSettings();
  res.json({ textModel, imageModel, fallbackImageModel, agyVersion: await agyVersion(), gflowVersion: await gflowVersion(), flowPause: flowPause() });
});

app.put('/api/settings', async (req, res) => {
  const { textModel, imageModel, fallbackImageModel } = req.body || {};
  const patch = {};
  if (typeof textModel === 'string' && textModel.trim()) patch.textModel = textModel.trim();
  if (GFLOW_MODELS.some((m) => m.id === imageModel)) patch.imageModel = imageModel;
  if (typeof fallbackImageModel === 'string' && fallbackImageModel.trim()) patch.fallbackImageModel = fallbackImageModel.trim();
  await store.saveSettings(patch);
  res.json({ ok: true });
});

// Image models: Google Flow ones draw (listed even before gflow-cli is installed), agy ones are the fallback.
app.get('/api/models', async (_req, res) => {
  let agy = null;
  let agyError = '';
  try {
    agy = await listModels();
  } catch (err) {
    agyError = err.message;
  }
  res.json({
    text: agy?.text || [],
    image: GFLOW_MODELS.map((m) => m.id),
    fallback: agy?.image || [],
    labels: Object.fromEntries(GFLOW_MODELS.map((m) => [m.id, m.label])),
    agyError,
  });
});

// ---- characters ----
app.get('/api/characters', async (_req, res) => res.json(await store.listCharacters()));

app.put('/api/characters', async (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Dữ liệu nhân vật phải là mảng' });
  await store.saveCharacters(req.body);
  res.json({ ok: true });
});

app.post('/api/characters/images', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Thiếu file ảnh' });
  const file = await store.saveImage(store.CHARACTER_IMAGE_DIR, req.file.buffer, req.file.mimetype);
  res.json({ file });
});

// Reads the reference images once and returns visible traits. The client sends the list itself: autosave may lag behind.
app.post('/api/characters/traits', async (req, res) => {
  const { name = '', description = '', images } = req.body || {};
  if (!Array.isArray(images) || !images.length) return res.status(400).json({ error: 'Nhân vật chưa có ảnh mẫu' });
  const inline = [];
  for (const file of images.slice(0, 3)) inline.push(await store.readImageAsInline(store.CHARACTER_IMAGE_DIR, String(file)));
  const { traits } = await describeCharacter({
    settings: await store.getSettings(),
    name: String(name),
    description: String(description),
    images: inline,
    signal: clientSignal(res),
  });
  res.json({ traits });
});

// ---- projects ----
app.get('/api/projects', async (_req, res) => res.json(await store.listProjects()));

app.post('/api/projects', async (req, res) => {
  const project = await store.saveProject({
    id: store.newId(),
    title: req.body?.title?.trim() || 'Truyện mới',
    orientation: req.body?.orientation === 'landscape' ? 'landscape' : 'portrait',
    style: DEFAULT_STYLE,
    idea: '',
    characterIds: [],
    usePrevFrameRef: true,
    slides: [],
    createdAt: new Date().toISOString(),
  });
  res.json(project);
});

app.get('/api/projects/:id', async (req, res) => res.json(await store.getProject(req.params.id)));

app.put('/api/projects/:id', async (req, res) => {
  if (req.body?.id !== req.params.id) return res.status(400).json({ error: 'Sai id truyện' });
  res.json(await store.saveProject(req.body));
});

app.delete('/api/projects/:id', async (req, res) => {
  await store.deleteProject(req.params.id);
  res.json({ ok: true });
});

// Writes the frames for one story image. The client owns the project state and merges the result.
app.post('/api/projects/:id/slides/script', async (req, res) => {
  const project = await store.getProject(req.params.id);
  const { storyIdea = '', slideIdeas, slideIndex, frameCount, characterIds } = req.body || {};
  if (!Array.isArray(slideIdeas) || !slideIdeas[slideIndex]?.trim()) {
    return res.status(400).json({ error: 'Hãy nhập ý tưởng cho ảnh này' });
  }

  const characters = await castFor(project, characterIds);
  const frames = await generateFrames({
    settings: await store.getSettings(),
    storyIdea,
    slideIdeas,
    slideIndex,
    frameCount: Math.min(Math.max(Number(frameCount) || 1, 1), 6),
    characters,
    signal: clientSignal(res),
  });
  res.json({ frames: toStoredFrames(frames, characters) });
});

// Writes a whole story from the plot: slide ideas and all frames. The client decides layouts from frame counts.
app.post('/api/projects/:id/story/plan', async (req, res) => {
  const project = await store.getProject(req.params.id);
  const { storyIdea, slideCount, framesPerSlide, characterIds } = req.body || {};
  if (!storyIdea?.trim()) return res.status(400).json({ error: 'Hãy nhập cốt truyện' });

  const count = Math.min(Math.max(Number(slideCount) || 1, 1), 35);
  const perSlide = framesPerSlide === 'auto' ? 'auto' : Math.min(Math.max(Number(framesPerSlide) || 1, 1), 4);
  const characters = await castFor(project, characterIds);
  const slides = await generateStoryPlan({
    settings: await store.getSettings(),
    storyIdea: storyIdea.trim(),
    slideCount: count,
    framesPerSlide: perSlide,
    characters,
    signal: clientSignal(res),
  });
  res.json({
    slides: slides.slice(0, count).map((s) => ({
      idea: s.idea || '',
      frames: toStoredFrames((s.frames || []).slice(0, perSlide === 'auto' ? 3 : perSlide), characters),
    })),
  });
});

// Vision pass over a generated frame: where each speaker is and where each bubble fits.
app.post('/api/projects/:id/frames/bubbles', async (req, res) => {
  const project = await store.getProject(req.params.id);
  const { image, scene = '', action = '', dialogues, characters = [] } = req.body || {};
  if (!image || !Array.isArray(dialogues) || !dialogues.length) {
    return res.status(400).json({ error: 'Khung cần có ảnh và lời thoại' });
  }
  const frameDir = path.join(store.PANEL_IMAGE_DIR, store.assertSafeName(project.id));
  const bubbles = await placeBubbles({
    settings: await store.getSettings(),
    image: await store.readImageAsInline(frameDir, image),
    scene: String(scene),
    action: String(action),
    dialogues: dialogues.map((d) => ({ speaker: String(d?.speaker || ''), text: String(d?.text || '') })),
    characters: (Array.isArray(characters) ? characters : []).map((c) => ({ name: String(c?.name || ''), description: String(c?.description || '') })),
    signal: clientSignal(res),
  });
  res.json({ bubbles });
});

/**
 * Reads the files a frame refs list points at: character photos or this story's images (sheets, previous panel).
 * A file deleted from disk is skipped so the image can still be drawn; unsafe names still fail.
 */
async function loadRefs(refs, panelDir) {
  const loaded = await Promise.all(
    refs.map(async ({ from, file, ...ref }) => {
      try {
        return { ...ref, ...(await store.readImageAsInline(from === 'characters' ? store.CHARACTER_IMAGE_DIR : panelDir, String(file))) };
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
        console.warn(`Bỏ ảnh tham chiếu không còn trên đĩa: ${ref.name}`);
        return null;
      }
    }),
  );
  return loaded.filter(Boolean);
}

const listOf = (v) => (Array.isArray(v) ? v : []);

// Generates one frame image. References: outfit sheets, character photos, asset sheets and optionally the previous
// frame. Outfits and assets come from the request because the client autosave may lag behind.
app.post('/api/projects/:id/images/generate', async (req, res) => {
  const project = await store.getProject(req.params.id);
  const { prompt, characterIds = [], aspectRatio, styleRefImage, outfits, assets } = req.body || {};
  if (!prompt?.trim()) return res.status(400).json({ error: 'Prompt trống' });

  const characters = (await store.listCharacters()).filter((c) => characterIds.includes(c.id));
  const frameDir = path.join(store.PANEL_IMAGE_DIR, store.assertSafeName(project.id));
  const refs = await loadRefs(
    buildFrameRefs({
      characters,
      outfits: listOf(outfits).map((o) => ({ characterId: String(o?.characterId || ''), name: String(o?.name || ''), image: o?.image || null })),
      assets: listOf(assets).map((a) => ({ id: String(a?.id || ''), kind: a?.kind === 'place' ? 'place' : 'prop', name: String(a?.name || ''), image: a?.image || null })),
      styleRefImage,
    }),
    frameDir,
  );

  const image = await drawImage({ settings: await store.getSettings(), prompt, refs, aspectRatio, signal: clientSignal(res) });
  const file = await store.saveImage(frameDir, image.buffer, image.mimeType);
  res.json({ file, engine: image.engine, fallbackReason: image.fallbackReason || '' });
});

const SHEET_ASPECT = { outfit: '16:9', prop: '1:1', place: '16:9' };

// Draws the reference sheet of an outfit (the character wearing it, from their photos) or of a prop or place.
app.post('/api/projects/:id/sheets/generate', async (req, res) => {
  const project = await store.getProject(req.params.id);
  const { kind, name = '', description = '', characterId, style } = req.body || {};
  if (!SHEET_ASPECT[kind]) return res.status(400).json({ error: 'Loại ảnh mẫu không hợp lệ' });
  if (!String(description).trim()) return res.status(400).json({ error: 'Hãy mô tả trước khi vẽ ảnh mẫu' });

  const artStyle = `Art style: ${String(style || project.style || '').trim()}.`;
  let prompt;
  let refs = [];
  if (kind === 'outfit') {
    const character = (await store.listCharacters()).find((c) => c.id === characterId);
    if (!character) return res.status(400).json({ error: 'Không tìm thấy nhân vật của trang phục này' });
    const identity = [character.traits, character.description].map((t) => String(t || '').trim()).filter(Boolean).join('; ');
    refs = (character.images || []).slice(0, 3).map((file, i) => ({
      name: characterRefName(character.id, i, file),
      from: 'characters',
      file,
      priority: i,
      label: `Photo of "${character.name}": copy the face, hair, skin and build ONLY. Ignore the clothes in it.`,
    }));
    prompt = [
      `Character: ${character.name}.`,
      identity && `Fixed identity (face, hair, body; ignore any clothing mentioned here): ${identity}.`,
      `Outfit "${String(name).trim()}": ${String(description).trim()}. Draw exactly this outfit, nothing else worn or carried.`,
      artStyle,
    ]
      .filter(Boolean)
      .join('\n');
  } else {
    prompt = `${kind === 'place' ? 'Location' : 'Object'} "${String(name).trim()}": ${String(description).trim()}.\n${artStyle}`;
  }

  const frameDir = path.join(store.PANEL_IMAGE_DIR, store.assertSafeName(project.id));
  const image = await drawImage({
    settings: await store.getSettings(),
    kind,
    prompt,
    refs: await loadRefs(refs, frameDir),
    aspectRatio: SHEET_ASPECT[kind],
    signal: clientSignal(res),
  });
  const file = await store.saveImage(frameDir, image.buffer, image.mimeType);
  res.json({ file, engine: image.engine, fallbackReason: image.fallbackReason || '' });
});

// Costume director pass over the whole script: outfits per story stage, separate assets, assignment and check per slide.
app.post('/api/projects/:id/outfits/plan', async (req, res) => {
  await store.getProject(req.params.id);
  const { storyIdea = '', slides, outfits, assets, characterIds } = req.body || {};
  if (!Array.isArray(slides) || !slides.length) return res.status(400).json({ error: 'Truyện chưa có ảnh nào' });
  const characters = (await store.listCharacters()).filter((c) => listOf(characterIds).includes(c.id));
  const input = {
    storyIdea: String(storyIdea),
    slides: slides.map((s) => ({
      id: String(s?.id || ''),
      idea: String(s?.idea || ''),
      locked: Boolean(s?.locked),
      note: String(s?.note || ''),
      outfits: s?.outfits && typeof s.outfits === 'object' ? s.outfits : {},
      frames: listOf(s?.frames).map((f) => ({
        id: String(f?.id || ''),
        characterIds: listOf(f?.characterIds).map(String),
        scene: String(f?.scene || ''),
        action: String(f?.action || ''),
        assetIds: listOf(f?.assetIds).map(String),
      })),
    })),
    characters,
    outfits: listOf(outfits),
    assets: listOf(assets),
  };
  const raw = await planOutfits({ settings: await store.getSettings(), script: outfitPlanInput(input), signal: clientSignal(res) });
  res.json(normalizeOutfitPlan(raw, input, store.newId));
});

app.post('/api/flow/resume', (_req, res) => {
  resumeFlow();
  res.json({ ok: true });
});

app.post('/api/projects/:id/images/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Thiếu file ảnh' });
  const dir = path.join(store.PANEL_IMAGE_DIR, store.assertSafeName(req.params.id));
  res.json({ file: await store.saveImage(dir, req.file.buffer, req.file.mimetype) });
});

app.post('/api/projects/:id/caption', async (req, res) => {
  await store.getProject(req.params.id);
  const { title = '', storyIdea = '', slides } = req.body || {};
  if (!Array.isArray(slides) || !slides.length) return res.status(400).json({ error: 'Truyện chưa có ảnh nào' });

  const data = await generateCaption({
    settings: await store.getSettings(),
    title: String(title),
    storyIdea: String(storyIdea),
    slides: slides.map((s) => ({
      idea: String(s?.idea || ''),
      dialogues: Array.isArray(s?.dialogues) ? s.dialogues.map(String).filter(Boolean) : [],
    })),
    signal: clientSignal(res),
  });
  const hashtags = (data.hashtags || [])
    .map((h) => `#${String(h).replace(/^#+/, '').replace(/\s+/g, '')}`)
    .filter((h) => h.length > 1)
    .join(' ');
  res.json({
    title: String(data.title || '').slice(0, 90),
    caption: data.caption || '',
    hashtags,
    musicMood: data.musicMood || '',
    musicKeywords: (data.musicKeywords || []).join(', '),
  });
});

// ---- LAN share (phone download via QR) ----
app.get('/api/share', (_req, res) => res.json(shareStatus()));

app.post('/api/share', upload.array('files', 35), async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'Không có ảnh để chia sẻ' });
  if (req.files.some((f) => f.mimetype !== 'image/png')) return res.status(400).json({ error: 'Chỉ chia sẻ ảnh PNG' });
  const { projectId = '', title = '', text = '', music = '' } = req.body || {};
  res.json(await startShare({ projectId, title, text, music, files: req.files.map((f) => f.buffer) }));
});

app.delete('/api/share', async (_req, res) => {
  await stopShare();
  res.json(shareStatus());
});

// ---- static files ----
app.use('/files/characters', express.static(store.CHARACTER_IMAGE_DIR, { maxAge: '1d' }));
app.use('/files/panels', express.static(store.PANEL_IMAGE_DIR, { maxAge: '1d' }));
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get(/^\/(?!api|files).*/, (_req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')));
}

app.use((err, _req, res, _next) => {
  if (!err.status || err.status >= 500) console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Lỗi không xác định' });
});

await store.ensureDataDirs();
const server = app.listen(PORT, '127.0.0.1', () => console.log(`StoryTools API: http://127.0.0.1:${PORT}`));
// A frame can take minutes through agy; never let Node cut a long request short.
server.requestTimeout = 0;
