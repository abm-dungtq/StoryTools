// File-based storage: everything lives under <project root>/data as JSON + image files.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// DATA_DIR lets tests and demos run against a separate folder without touching real data.
export const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
export const CHARACTER_IMAGE_DIR = path.join(DATA_DIR, 'characters');
export const PANEL_IMAGE_DIR = path.join(DATA_DIR, 'panels');
const PROJECT_DIR = path.join(DATA_DIR, 'projects');
const CHARACTERS_FILE = path.join(DATA_DIR, 'characters.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

const SAFE_NAME = /^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9]+)?$/;

/** Rejects ids/filenames that could escape the data directory. */
export function assertSafeName(name) {
  if (typeof name !== 'string' || !SAFE_NAME.test(name)) {
    const err = new Error(`Tên không hợp lệ: ${name}`);
    err.status = 400;
    throw err;
  }
  return name;
}

export const newId = () => crypto.randomBytes(6).toString('hex');

export async function ensureDataDirs() {
  // Job dirs left by a crash still hold copies of reference images.
  await fs.rm(path.join(DATA_DIR, 'tmp'), { recursive: true, force: true });
  await Promise.all(
    [PROJECT_DIR, CHARACTER_IMAGE_DIR, PANEL_IMAGE_DIR].map((d) => fs.mkdir(d, { recursive: true })),
  );
  // The Gemini key and model names saved by older versions are no longer used; drop them from disk.
  const saved = await readJson(SETTINGS_FILE, {});
  if (LEGACY_SETTINGS.some((k) => k in saved)) await saveSettings({});
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

const fileLocks = new Map();
let tmpCounter = 0;

/** Runs fn after every earlier write to the same file has finished, so writes never interleave. */
function withFileLock(file, fn) {
  const run = (fileLocks.get(file) || Promise.resolve()).catch(() => {}).then(fn);
  fileLocks.set(file, run);
  return run.finally(() => {
    if (fileLocks.get(file) === run) fileLocks.delete(file);
  });
}

// Write to a unique temp file first so a crash never leaves half-written JSON.
async function writeJsonNow(file, data) {
  const tmp = `${file}.${process.pid}.${++tmpCounter}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  for (let attempt = 0; ; attempt++) {
    try {
      await fs.rename(tmp, file);
      return;
    } catch (err) {
      // Windows refuses the rename while another handle (antivirus, indexer) has the file open.
      if (attempt >= 4 || !['EPERM', 'EBUSY', 'EACCES'].includes(err.code)) {
        await fs.rm(tmp, { force: true }).catch(() => {});
        throw err;
      }
      await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
    }
  }
}

const writeJson = (file, data) => withFileLock(file, () => writeJsonNow(file, data));

// ---- settings ----
const LEGACY_SETTINGS = ['apiKey', 'textModel', 'imageModel'];

const isFlowModel = (model) => String(model || '').startsWith('gflow:');

/**
 * Images are drawn with a Google Flow model (`imageModel`, through gflow-cli); `fallbackImageModel` is the agy model
 * used when gflow is missing or failing. Earlier versions kept the one image model under agyImageModel.
 */
export async function getSettings() {
  // agy models live under their own keys so model names saved by older versions are never sent to agy.
  const saved = await readJson(SETTINGS_FILE, {});
  const legacyFlow = isFlowModel(saved.agyImageModel);
  return {
    textModel: saved.agyTextModel || 'gemini-4-argon-medium',
    imageModel: saved.flowImageModel || (legacyFlow ? saved.agyImageModel : 'gflow:nano2'),
    fallbackImageModel: (!legacyFlow && saved.agyImageModel) || 'gemini-3.8-flash-low',
  };
}

export async function saveSettings({ textModel, imageModel, fallbackImageModel }) {
  const patch = {};
  if (textModel) patch.agyTextModel = textModel;
  if (isFlowModel(imageModel)) patch.flowImageModel = imageModel;
  if (fallbackImageModel && !isFlowModel(fallbackImageModel)) patch.agyImageModel = fallbackImageModel;
  // Read and write under one lock so two concurrent patches both survive.
  await withFileLock(SETTINGS_FILE, async () => {
    const saved = await readJson(SETTINGS_FILE, {});
    for (const key of LEGACY_SETTINGS) delete saved[key];
    if (isFlowModel(saved.agyImageModel)) {
      saved.flowImageModel ??= saved.agyImageModel;
      delete saved.agyImageModel;
    }
    await writeJsonNow(SETTINGS_FILE, { ...saved, ...patch });
  });
}

/** The Google Flow project gflow draws frames in, so each call can skip creating one. */
export const getGflowProjectId = async () => (await readJson(SETTINGS_FILE, {})).gflowProjectId || null;

export async function saveGflowProjectId(id) {
  await withFileLock(SETTINGS_FILE, async () => {
    const saved = await readJson(SETTINGS_FILE, {});
    await writeJsonNow(SETTINGS_FILE, { ...saved, gflowProjectId: id || undefined });
  });
}

// ---- characters ----
export const listCharacters = () => readJson(CHARACTERS_FILE, []);
export const saveCharacters = (characters) => writeJson(CHARACTERS_FILE, characters);

// ---- projects ----
const projectFile = (id) => path.join(PROJECT_DIR, `${assertSafeName(id)}.json`);

export async function listProjects() {
  const files = (await fs.readdir(PROJECT_DIR)).filter((f) => f.endsWith('.json'));
  const projects = await Promise.all(files.map((f) => readJson(path.join(PROJECT_DIR, f), null)));
  return projects
    .filter(Boolean)
    .map(({ id, title, orientation, updatedAt, slides, publish }) => ({
      id,
      title,
      orientation,
      updatedAt,
      slideCount: slides?.length || 0,
      publishStatus: publish?.status || 'draft',
    }))
    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

export async function getProject(id) {
  const project = await readJson(projectFile(id), null);
  if (!project) {
    const err = new Error('Không tìm thấy truyện');
    err.status = 404;
    throw err;
  }
  return project;
}

export async function saveProject(project) {
  const data = { ...project, updatedAt: new Date().toISOString() };
  await writeJson(projectFile(project.id), data);
  return data;
}

export async function deleteProject(id) {
  await fs.rm(projectFile(id), { force: true });
  await fs.rm(path.join(PANEL_IMAGE_DIR, assertSafeName(id)), { recursive: true, force: true });
}

// ---- images ----
const EXT_BY_MIME = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
export const MIME_BY_EXT = Object.fromEntries(Object.entries(EXT_BY_MIME).map(([m, e]) => [e, m]));

/** Saves an image buffer into dir and returns the generated filename. */
export async function saveImage(dir, buffer, mimeType) {
  const ext = EXT_BY_MIME[mimeType];
  if (!ext) {
    const err = new Error(`Định dạng ảnh không hỗ trợ: ${mimeType}`);
    err.status = 400;
    throw err;
  }
  await fs.mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${newId()}.${ext}`;
  await fs.writeFile(path.join(dir, filename), buffer);
  return filename;
}

export async function readImageAsInline(dir, filename) {
  const ext = path.extname(assertSafeName(filename)).slice(1).toLowerCase();
  const data = await fs.readFile(path.join(dir, filename));
  return { mimeType: MIME_BY_EXT[ext] || 'image/png', data: data.toString('base64') };
}
