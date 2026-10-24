// Which editor steps a story has finished, derived only from its saved data (no extra fields).
import { frameEntries, hasFrameContent } from './story-model.js';

const hasDialogue = (frame) => frame.dialogues?.some((d) => d.text?.trim());

export function stepStatus(project) {
  const frames = frameEntries(project).map((e) => e.frame);
  const script = frames.length > 0 && project.slides.every((s) => s.frames.some(hasFrameContent));
  const images = script && frames.every((f) => f.selectedImage);
  const compose = images && frames.every((f) => !hasDialogue(f) || (Array.isArray(f.bubbles) && !f.bubblePlacementFailed));
  return { script, frames: images, compose, preview: project.publish?.status === 'posted' };
}
