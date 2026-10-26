// Frame image generation and AI bubble placement, shared by the manual steps and the story automation.
import { api, panelImageUrl } from '../api.js';
import { autoPlaceBubbles, imageToCell } from './bubbles.js';
import { loadImage } from './image-cache.js';
import { computeCells, getLayout } from './layouts.js';
import { frameSheets, isSheetStale } from './outfits.js';
import { buildFramePrompt, buildSheetNotes } from './prompt-builder.js';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** True when someone in `frame` wears a different outfit than in the slide before, so that slide's picture would drag in old clothes. */
function outfitChanged(project, entry) {
  const prev = entry.f === 0 ? project.slides[entry.s - 1] : null;
  if (!prev) return false;
  return entry.frame.characterIds.some((id) => (prev.outfits?.[id] || null) !== (entry.slide.outfits?.[id] || null) && prev.frames.some((f) => f.characterIds.includes(id)));
}

/**
 * Generates one frame image. `entry` comes from frameEntries(); `styleRefImage` is the previous frame's image,
 * only sent when the project enables it and nobody changed clothes since. The slide's outfits and the frame's assets
 * travel with the request (autosave may lag), and their notes are appended to the prompt at send time.
 * @returns {Promise<{file: string, prompt: string, fallbackReason: string}>}
 */
export async function generateFrameImage(project, entry, characters, styleRefImage, signal) {
  const { slide, frame, aspectRatio } = entry;
  const prompt = frame.prompt?.trim() || buildFramePrompt(project, slide, frame, characters);
  const notes = buildSheetNotes(project, slide, frame, characters);
  const { outfits, assets } = frameSheets(project, slide, frame);
  const { file, fallbackReason } = await api.generateImage(project.id, {
    prompt: notes ? `${prompt}\n${notes}` : prompt,
    characterIds: frame.characterIds,
    aspectRatio,
    styleRefImage: project.usePrevFrameRef && !outfitChanged(project, entry) ? styleRefImage || null : null,
    outfits: outfits.map(({ characterId, name, image }) => ({ characterId, name, image })),
    assets: assets.map(({ id, kind, name, image }) => ({ id, kind, name, image })),
  }, signal);
  return { file, prompt, fallbackReason };
}

/**
 * Draws the outfit and asset sheets `entry`'s frame needs that have no image yet (or one drawn from an older description), reporting each one through
 * `onSheet(listKey, id, patch)`. Returns the project with them filled in, ready for generateFrameImage.
 */
export async function ensureSheets(project, entry, onSheet, signal) {
  const { outfits, assets } = frameSheets(project, entry.slide, entry.frame);
  const todo = [
    ...outfits.filter((o) => !o.image || isSheetStale(o)).map((o) => ['outfits', 'outfit', o]),
    ...assets.filter((a) => !a.image || isSheetStale(a)).map((a) => ['assets', a.kind, a]),
  ];
  let p = project;
  for (const [key, kind, item] of todo) {
    const { file, engine } = await generateSheet(p, item, kind, signal);
    const patch = { image: file, imageEngine: engine, imageDescription: item.description };
    p = { ...p, [key]: p[key].map((x) => (x.id === item.id ? { ...x, ...patch } : x)) };
    onSheet(key, item.id, patch);
  }
  return p;
}

/** Draws the reference sheet of one outfit or asset. @returns {Promise<{file: string, engine: string, fallbackReason: string}>} */
export function generateSheet(project, item, kind, signal) {
  return api.generateSheet(project.id, {
    kind,
    name: item.name,
    description: item.description,
    characterId: item.characterId,
    style: project.style,
  }, signal);
}

/**
 * Asks the AI to look at the frame image and place a bubble per dialogue line (and reword it to fit the picture).
 * Returns { bubbles, dialogues } ready for updateFrame, or null when the frame has no image or no dialogue.
 */
export async function placeBubblesFromImage(project, entry, characters, file = entry.frame.selectedImage, signal) {
  const { slide, frame, f } = entry;
  const spoken = frame.dialogues.filter((d) => d.text?.trim());
  if (!file || !spoken.length) return null;

  const cells = computeCells(project.orientation, getLayout(project.orientation, slide.layoutId));
  const cell = cells[f];
  const nameOf = (id) => characters.find((c) => c.id === id)?.name || '';
  const [img, result] = await Promise.all([
    loadImage(panelImageUrl(project.id, file)),
    api.placeBubbles(project.id, {
      image: file,
      scene: frame.scene,
      action: frame.action,
      dialogues: spoken.map((d) => ({ speaker: nameOf(d.speakerId), text: d.text.trim() })),
      characters: characters.filter((c) => frame.characterIds.includes(c.id)).map((c) => ({ name: c.name, description: c.description })),
    }, signal),
  ]);

  // Template placement supplies size/font defaults and covers any line the model skipped.
  const defaults = autoPlaceBubbles(frame, { cellAspect: cell.w / cell.h, frameCount: cells.length });
  const bubbles = defaults.map((base, i) => {
    const r = result.bubbles.find((b) => b.index === i);
    if (!r) return base;
    const center = imageToCell(r.bubbleX, r.bubbleY, img, cell);
    const speaker = imageToCell(r.speakerX, r.speakerY, img, cell);
    const cx = clamp(center.x, base.w / 2 + 0.02, 1 - base.w / 2 - 0.02);
    const cy = clamp(center.y, 0.06, 0.94);
    // Tail points toward the speaker but stops short of the face, capped so it never spans the whole frame.
    const dx = (speaker.x - cx) * cell.w;
    const dy = (speaker.y - cy) * cell.h;
    const dist = Math.hypot(dx, dy) || 1;
    const len = Math.min(dist * 0.7, Math.min(cell.w, cell.h) * 0.3);
    return {
      ...base,
      text: r.text.trim() || base.text,
      cx,
      cy,
      tx: clamp(cx + ((dx / dist) * len) / cell.w, 0, 1),
      ty: clamp(cy + ((dy / dist) * len) / cell.h, 0, 1),
    };
  });

  // Keep the script in sync with the wording adjusted for the picture.
  let k = 0;
  const dialogues = frame.dialogues.map((d) => (d.text?.trim() ? { ...d, text: bubbles[k++].text } : d));
  return { bubbles, dialogues, bubblePlacementFailed: false };
}
