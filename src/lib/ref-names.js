// Names of reference image files inside an agy job dir. The prompt builder (client) and the image route (server)
// both use them, so a prompt line can point at exactly one character's picture.
export const characterRefName = (characterId, index, file) =>
  `char-${characterId}-${index + 1}.${String(file).split('.').pop().toLowerCase()}`;

export const styleRefName = (file) => `previous-panel.${String(file).split('.').pop().toLowerCase()}`;
