// Builds the image prompt for a frame. Fixed character descriptions are injected every time so frames stay consistent.
import { characterRefName } from './ref-names.js';

const POSITION_LABEL = { left: 'LEFT', center: 'CENTER', right: 'RIGHT' };
const POSITION_ORDER = { left: 0, center: 1, right: 2 };

/** One line per character: where they stand, who they are, what tells them apart, and which file shows them. */
function castLine(character, position) {
  const parts = [`${POSITION_LABEL[position] || 'ANY POSITION'}: ${character.name}`];
  if (character.traits?.trim()) parts.push(`distinguishing traits: ${character.traits.trim()}`);
  if (character.description?.trim()) parts.push(`description: ${character.description.trim()}`);
  const refs = (character.images || []).map((file, i) => characterRefName(character.id, i, file));
  parts.push(refs.length ? `reference image: ${refs.join(', ')}` : 'no reference image');
  return `- ${parts.join(' | ')}`;
}

export function buildFramePrompt(project, slide, frame, characters) {
  const cast = characters.filter((c) => frame.characterIds?.includes(c.id));
  const speakers = [...new Set((frame.dialogues || []).map((d) => d.speakerId))]
    .map((id) => cast.find((c) => c.id === id)?.name)
    .filter(Boolean);

  const lines = ['A single comic panel illustration.', `Art style: ${project.style}.`];
  if (slide.idea?.trim()) lines.push(`Story moment: ${slide.idea.trim()}`);
  if (cast.length) {
    const positions = frame.positions || {};
    lines.push(
      cast.length > 1
        ? 'Characters, listed left to right. Each is a DIFFERENT person: never swap or blend faces, hair, skin, clothes or accessories between them; each one matches only their own traits and their own reference image:'
        : 'Character (keep the appearance EXACTLY as described and as in the reference image):',
    );
    [...cast]
      .sort((a, b) => (POSITION_ORDER[positions[a.id]] ?? 1) - (POSITION_ORDER[positions[b.id]] ?? 1))
      .forEach((c) => lines.push(castLine(c, positions[c.id])));
  } else {
    lines.push('No main characters in this panel (establishing shot).');
  }
  if (frame.scene) lines.push(`Setting: ${frame.scene}`);
  if (frame.action) lines.push(`Action: ${frame.action}`);
  if (frame.expression) lines.push(`Facial expressions / emotion: ${frame.expression}`);
  if (speakers.length) lines.push(`${speakers.join(' and ')} ${speakers.length > 1 ? 'are' : 'is'} talking.`);
  lines.push(
    'Composition: cinematic framing, characters clearly visible, leave calm empty space near the top for speech bubbles added later.',
    'IMPORTANT: do NOT draw any text, letters, numbers, speech bubbles, captions, signatures or watermarks.',
  );
  return lines.join('\n');
}
