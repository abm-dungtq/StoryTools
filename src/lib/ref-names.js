// Names of reference image files inside an agy job dir. The prompt builder (client) and the image route (server)
// both use them, so a prompt line can point at exactly one character's picture.
export const characterRefName = (characterId, index, file) =>
  `char-${characterId}-${index + 1}.${String(file).split('.').pop().toLowerCase()}`;

export const styleRefName = (file) => `previous-panel.${String(file).split('.').pop().toLowerCase()}`;

// Outfit sheet of one character for the slide being drawn, and the sheet of one prop or place asset.
export const outfitRefName = (characterId, file) => `outfit-${characterId}.${String(file).split('.').pop().toLowerCase()}`;

export const assetRefName = (assetId, file) => `asset-${assetId}.${String(file).split('.').pop().toLowerCase()}`;
