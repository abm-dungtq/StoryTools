// Which reference images a frame is drawn with, in priority order for the 10-image cap: each character's outfit sheet,
// each character's identity image, the place, the props, the previous panel, then further character images.
import { assetRefName, characterRefName, outfitRefName, styleRefName } from '../src/lib/ref-names.js';

/**
 * @param {{characters: object[], outfits: {characterId, name, image}[], assets: {id, kind, name, image}[], styleRefImage?: string}} args
 * @returns {{name: string, from: 'characters'|'panels', file: string, priority: number, label: string}[]}
 */
export function buildFrameRefs({ characters, outfits = [], assets = [], styleRefImage }) {
  const refs = [];
  for (const c of characters) {
    const outfit = outfits.find((o) => o.characterId === c.id && o.image);
    if (outfit) {
      refs.push({
        name: outfitRefName(c.id, outfit.image),
        from: 'panels',
        file: outfit.image,
        priority: 0,
        label: `Outfit sheet of "${c.name}" for this panel ("${outfit.name}"). Draw ${c.name} wearing EXACTLY these clothes, and only these.`,
      });
    }
    const traits = c.traits?.trim() ? ` (${c.traits.trim()})` : '';
    (c.images || []).forEach((file, i) => {
      // With an outfit sheet, further photos of the character mostly bring their other clothes along.
      if (outfit && i > 0) return;
      refs.push({
        name: characterRefName(c.id, i, file),
        from: 'characters',
        file,
        priority: i === 0 ? 1 : 6,
        label: outfit
          ? `Identity of "${c.name}": face, hair, skin and build ONLY. Ignore the clothes and accessories in this image.`
          : `Reference image of "${c.name}"${traits}. Shows only this character.`,
      });
    });
  }
  for (const a of assets) {
    if (!a.image) continue;
    refs.push({
      name: assetRefName(a.id, a.image),
      from: 'panels',
      file: a.image,
      priority: a.kind === 'place' ? 2 : 3,
      label:
        a.kind === 'place'
          ? `Place "${a.name}": the setting of this panel. Keep its layout, furniture and colors.`
          : `Prop "${a.name}" that appears in this panel. Draw it exactly like this.`,
    });
  }
  if (styleRefImage) {
    refs.push({
      name: styleRefName(styleRefImage),
      from: 'panels',
      file: styleRefImage,
      priority: 5,
      // With several people the previous panel is the main source of swapped outfits, so it may only lend its style.
      label:
        characters.length > 1 || outfits.length
          ? 'Previous panel of the same comic. Use it ONLY for art style, line work and color palette. Do NOT copy who stands where, who wears what, or any face from it.'
          : 'Previous panel of the same comic – match its art style, color palette and character design',
    });
  }
  return refs;
}
