// Input and output of the costume director pass. The model only sees slide/frame numbers, character names and the
// keys of existing outfits and assets; this module maps its answer back to ids so it can never invent or swap one.

const KINDS = ['prop', 'place'];
const clean = (v) => String(v ?? '').trim();

/**
 * The script the model reads from a file. Locked slides were already confirmed: the model may comment on them but
 * their outfits are kept.
 * @param {{storyIdea, slides: {id, idea, locked, note, outfits, frames: {id, characterIds, scene, action, assetIds}[]}[], characters, outfits, assets}} input
 */
export function outfitPlanInput({ storyIdea, slides, characters, outfits, assets }) {
  const nameOf = (id) => characters.find((c) => c.id === id)?.name;
  return {
    story: clean(storyIdea),
    characters: characters.map((c) => ({ name: c.name, identity: [c.traits, c.description].map(clean).filter(Boolean).join('; ') })),
    outfits: outfits.filter((o) => nameOf(o.characterId)).map((o) => ({ key: o.id, character: nameOf(o.characterId), name: o.name, description: o.description })),
    assets: assets.map((a) => ({ key: a.id, kind: a.kind, name: a.name, description: a.description })),
    slides: slides.map((s, i) => ({
      slide: i + 1,
      idea: clean(s.idea),
      locked: Boolean(s.locked),
      ...(s.note ? { previousNote: s.note } : {}),
      outfits: Object.entries(s.outfits || {})
        .filter(([cid]) => nameOf(cid))
        .map(([cid, key]) => ({ character: nameOf(cid), outfit: key })),
      frames: s.frames.map((f, j) => ({
        frame: j + 1,
        characters: (f.characterIds || []).map(nameOf).filter(Boolean),
        scene: clean(f.scene),
        action: clean(f.action),
        assets: f.assetIds || [],
      })),
    })),
  };
}

/**
 * Maps the model's answer onto the story. Existing outfits/assets keep their id (and image unless the description
 * changed); those a locked slide uses are kept as they are, so a reworded description cannot undo a confirmation.
 * New ones get `makeId()`; unknown names, keys and numbers are dropped, and a key already taken is not reassigned.
 * Slides, frames and characters the model left out keep their current assignment and are reported as not checked.
 * @returns {{outfits: object[], assets: object[], slides: {id, outfits: object, frameAssets: object, ok: boolean, note: string}[]}}
 */
export function normalizeOutfitPlan(raw, { slides, characters, outfits, assets }, makeId) {
  const byName = new Map(characters.map((c) => [clean(c.name).toLowerCase(), c.id]));
  const charId = (name) => byName.get(clean(name).toLowerCase()) || null;
  const lockedOutfits = new Set(slides.filter((s) => s.locked).flatMap((s) => Object.values(s.outfits || {})));
  const lockedAssets = new Set(slides.filter((s) => s.locked).flatMap((s) => s.frames.flatMap((f) => f.assetIds || [])));
  const update = (existing, description, patch, frozen) => {
    if (frozen) return;
    if (clean(existing.description) !== description) Object.assign(existing, { description, image: null, imageEngine: null });
    Object.assign(existing, patch);
  };

  const outfitList = outfits.map((o) => ({ ...o }));
  const outfitKey = new Map(outfitList.map((o) => [o.id, o.id]));
  for (const o of raw?.outfits || []) {
    const characterId = charId(o?.character);
    const name = clean(o?.name);
    const description = clean(o?.description);
    const key = clean(o?.key);
    if (!characterId || !name || !description) continue;
    const existing = outfitList.find((x) => x.id === key && x.characterId === characterId);
    if (existing) update(existing, description, { name }, lockedOutfits.has(existing.id));
    else if (!outfitKey.has(key)) {
      const id = makeId();
      outfitList.push({ id, characterId, name, description, image: null });
      outfitKey.set(key, id);
    }
  }

  const assetList = assets.map((a) => ({ ...a }));
  const assetKey = new Map(assetList.map((a) => [a.id, a.id]));
  for (const a of raw?.assets || []) {
    const name = clean(a?.name);
    const description = clean(a?.description);
    const key = clean(a?.key);
    if (!name || !description) continue;
    const kind = KINDS.includes(a.kind) ? a.kind : 'prop';
    const existing = assetList.find((x) => x.id === key);
    if (existing) update(existing, description, { name, kind }, lockedAssets.has(existing.id));
    else if (!assetKey.has(key)) {
      const id = makeId();
      assetList.push({ id, kind, name, description, image: null });
      assetKey.set(key, id);
    }
  }
  const ownOutfit = (cid, oid) => outfitList.find((o) => o.id === oid)?.characterId === cid;
  const knownAssets = (ids) => (ids || []).filter((id) => assetList.some((a) => a.id === id));

  const answers = new Map((raw?.slides || []).map((s) => [Number(s?.slide), s]));
  const result = slides.map((slide, i) => {
    const answer = answers.get(i + 1);
    const onStage = [...new Set(slide.frames.flatMap((f) => f.characterIds || []))].filter((cid) => characters.some((c) => c.id === cid));
    const kept = Object.fromEntries(Object.entries(slide.outfits || {}).filter(([cid, oid]) => ownOutfit(cid, oid)));
    const keptAssets = Object.fromEntries(slide.frames.map((f) => [f.id, knownAssets(f.assetIds)]));
    if (slide.locked || !answer) {
      return {
        id: slide.id,
        outfits: slide.locked ? { ...(slide.outfits || {}) } : kept,
        frameAssets: slide.locked ? Object.fromEntries(slide.frames.map((f) => [f.id, f.assetIds || []])) : keptAssets,
        ok: Boolean(slide.locked && answer?.ok),
        note: answer ? clean(answer.note) : 'AI không trả lời ảnh này, hãy kiểm tra tay.',
      };
    }
    const assigned = {};
    for (const pick of answer.outfits || []) {
      const cid = charId(pick?.character);
      const oid = outfitKey.get(clean(pick?.outfit));
      if (cid && oid && ownOutfit(cid, oid)) assigned[cid] = oid;
    }
    // A character the model skipped keeps the outfit it had.
    for (const cid of onStage) if (!assigned[cid] && kept[cid]) assigned[cid] = kept[cid];
    const frameAnswers = new Map((answer.frames || []).map((f) => [Number(f?.frame), f]));
    const frameAssets = Object.fromEntries(
      slide.frames.map((f, j) => {
        const fa = frameAnswers.get(j + 1);
        return [f.id, fa ? [...new Set((fa.assets || []).map((k) => assetKey.get(clean(k))).filter(Boolean))] : keptAssets[f.id]];
      }),
    );
    // The model's "ok" only counts when every character on stage really got an outfit.
    const complete = onStage.every((cid) => assigned[cid]);
    return {
      id: slide.id,
      outfits: assigned,
      frameAssets,
      ok: Boolean(answer.ok) && complete,
      note: clean(answer.note) || (complete ? '' : 'Còn nhân vật chưa được gán trang phục.'),
    };
  });

  return { outfits: outfitList, assets: assetList, slides: result };
}
