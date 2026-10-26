// Which editor steps a story has finished, derived only from its saved data (no extra fields).
import { isOutfitPlanned, isSlideConfirmed, missingSheets } from './outfits.js';
import { frameEntries, hasFrameContent } from './story-model.js';

const hasDialogue = (frame) => frame.dialogues?.some((d) => d.text?.trim());

export function stepStatus(project) {
  const frames = frameEntries(project).map((e) => e.frame);
  const script = frames.length > 0 && project.slides.every((s) => s.frames.some(hasFrameContent));
  const images = script && frames.every((f) => f.selectedImage);
  const compose = images && frames.every((f) => !hasDialogue(f) || (Array.isArray(f.bubbles) && !f.bubblePlacementFailed));
  const sheets = missingSheets(project);
  const outfits = script && isOutfitPlanned(project) && project.slides.every((s) => isSlideConfirmed(project, s)) && !sheets.outfits.length && !sheets.assets.length;
  return { script, outfits, frames: images, compose, preview: project.publish?.status === 'posted' };
}
