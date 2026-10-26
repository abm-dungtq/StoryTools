// Story outfits and assets: the outfit each character wears in a slide (one per story stage), the props and places
// each frame shows, and whether a slide's outfits were confirmed against its script.
//
// A slide counts as confirmed while its fingerprint (assigned outfits, cast, scene, action, assets) still equals the
// one stored when it was confirmed, so any later edit to those asks for a new confirmation by itself.

/** Outfit planning turns the confirmation gate on; older stories without it draw as before. */
export const isOutfitPlanned = (project) => Boolean(project.outfitsPlannedAt);

/** Story cast members on stage in `slide`; a character removed from the cast no longer needs an outfit. */
export const slideCharacterIds = (project, slide) =>
  [...new Set(slide.frames.flatMap((f) => f.characterIds || []))].filter((id) => !project.characterIds || project.characterIds.includes(id));

/** The outfit `characterId` wears in `slide`, or null when none (or a deleted one) is assigned. */
export function slideOutfitOf(project, slide, characterId) {
  const id = slide.outfits?.[characterId];
  return (project.outfits || []).find((o) => o.id === id && o.characterId === characterId) || null;
}

/** True when a sheet was drawn from an older description, so it must be redrawn before it is used again. */
export const isSheetStale = (item) => Boolean(item.image && item.imageDescription && item.imageDescription !== item.description);

export const assetsOf = (project, frame) => (frame.assetIds || []).map((id) => (project.assets || []).find((a) => a.id === id)).filter(Boolean);

function hashString(text) {
  let h = 5381;
  for (const ch of text) h = (Math.imul(h, 33) + ch.codePointAt(0)) | 0;
  return (h >>> 0).toString(36);
}

export function slideFingerprint(project, slide) {
  const ids = slideCharacterIds(project, slide).sort();
  return hashString(
    JSON.stringify({
      outfits: ids.map((id) => {
        const o = slideOutfitOf(project, slide, id);
        return [id, o ? [o.name, o.description] : null];
      }),
      frames: slide.frames.map((f) => [
        [...(f.characterIds || [])].sort(),
        f.scene || '',
        f.action || '',
        assetsOf(project, f).map((a) => [a.id, a.name, a.description]),
      ]),
    }),
  );
}

/**
 * Problems the code can see without the AI: a character without an outfit, an outfit or asset without a description
 * (its sheet cannot be drawn), or a frame pointing at a deleted asset.
 */
export function slideIssues(project, slide, characters) {
  const issues = [];
  for (const id of slideCharacterIds(project, slide)) {
    const outfit = slideOutfitOf(project, slide, id);
    const name = characters.find((c) => c.id === id)?.name || 'Một nhân vật';
    if (!outfit) issues.push(`${name} chưa có trang phục`);
    else if (!outfit.description?.trim()) issues.push(`Trang phục "${outfit.name}" của ${name} chưa có mô tả`);
  }
  slide.frames.forEach((f, i) => {
    const assets = assetsOf(project, f);
    if ((f.assetIds || []).length !== assets.length) issues.push(`Khung ${i + 1} gắn đồ vật/bối cảnh đã xoá`);
    assets.filter((a) => !a.description?.trim()).forEach((a) => issues.push(`"${a.name}" ở khung ${i + 1} chưa có mô tả`));
  });
  return issues;
}

/** True when the slide may be drawn: no planning yet, nobody on stage, or confirmed and unchanged since. */
export function isSlideConfirmed(project, slide) {
  if (!isOutfitPlanned(project) || !slideCharacterIds(project, slide).length) return true;
  return slide.outfitCheck?.confirmedHash === slideFingerprint(project, slide);
}

/** Outfit check to store when the slide is confirmed now. */
export const confirmedCheck = (project, slide) => ({ ...(slide.outfitCheck || {}), confirmedHash: slideFingerprint(project, slide) });

/** Outfits and assets a frame is drawn with, in the order the slide assigns them. */
export function frameSheets(project, slide, frame) {
  const cast = slideCharacterIds(project, slide);
  const outfits = (frame.characterIds || []).filter((id) => cast.includes(id)).map((id) => slideOutfitOf(project, slide, id)).filter(Boolean);
  return { outfits, assets: assetsOf(project, frame) };
}

/** Outfits and assets some slide uses that have no reference image yet, or one drawn from an older description. */
export function missingSheets(project) {
  const outfitIds = new Set();
  const assetIds = new Set();
  for (const slide of project.slides) {
    for (const frame of slide.frames) {
      const { outfits, assets } = frameSheets(project, slide, frame);
      outfits.filter((o) => !o.image || isSheetStale(o)).forEach((o) => outfitIds.add(o.id));
      assets.filter((a) => !a.image || isSheetStale(a)).forEach((a) => assetIds.add(a.id));
    }
  }
  return {
    outfits: (project.outfits || []).filter((o) => outfitIds.has(o.id)),
    assets: (project.assets || []).filter((a) => assetIds.has(a.id)),
  };
}

/** Costume director request for the project: confirmed slides go as locked so their outfits are kept. */
export function outfitPlanRequest(project) {
  return {
    storyIdea: project.idea,
    characterIds: project.characterIds,
    outfits: project.outfits || [],
    assets: project.assets || [],
    slides: project.slides.map((s) => ({
      id: s.id,
      idea: s.idea,
      locked: isOutfitPlanned(project) && slideCharacterIds(project, s).length > 0 && isSlideConfirmed(project, s),
      note: s.outfitCheck?.ok === false ? s.outfitCheck.note : '',
      outfits: s.outfits || {},
      frames: s.frames.map(({ id, characterIds, scene, action, assetIds }) => ({ id, characterIds, scene, action, assetIds })),
    })),
  };
}

/**
 * Plan items merged by id with the current ones: a sheet drawn while the AI ran is kept unless the AI changed the
 * description, and items added meanwhile stay.
 */
function mergeSheets(current = [], planned = []) {
  const merged = planned.map((item) => {
    const cur = current.find((x) => x.id === item.id);
    if (!cur || item.image || cur.description?.trim() !== item.description) return item;
    return { ...item, image: cur.image, imageEngine: cur.imageEngine, imageDescription: cur.imageDescription };
  });
  return [...merged, ...current.filter((x) => !planned.some((item) => item.id === x.id))];
}

/**
 * Merges a costume director answer into `project`, matched by slide and frame id.
 * With `auto`, slides the AI found matching and the code finds complete are confirmed right away.
 */
export function applyOutfitPlan(project, plan, { auto = false } = {}) {
  const answers = new Map(plan.slides.map((s) => [s.id, s]));
  const next = {
    ...project,
    outfits: mergeSheets(project.outfits, plan.outfits),
    assets: mergeSheets(project.assets, plan.assets),
    outfitsPlannedAt: project.outfitsPlannedAt || new Date().toISOString(),
  };
  next.slides = project.slides.map((s) => {
    const r = answers.get(s.id);
    if (!r) return s;
    return {
      ...s,
      outfits: r.outfits,
      outfitCheck: { ok: r.ok, note: r.note, confirmedHash: s.outfitCheck?.confirmedHash || null },
      frames: s.frames.map((f) => ({ ...f, assetIds: r.frameAssets[f.id] ?? f.assetIds ?? [] })),
    };
  });
  if (auto) {
    next.slides = next.slides.map((s) => (s.outfitCheck?.ok && !slideIssues(next, s, []).length ? { ...s, outfitCheck: confirmedCheck(next, s) } : s));
  }
  return next;
}

/** Slides that have people on stage but are not confirmed, so their frames may not be drawn yet. */
export const unconfirmedSlides = (project) => project.slides.filter((s) => !isSlideConfirmed(project, s));

/** True when an outfit is assigned in some slide, so deleting it would leave that slide without clothes. */
export const isOutfitUsed = (project, outfitId) => project.slides.some((s) => Object.values(s.outfits || {}).includes(outfitId));

export const isAssetUsed = (project, assetId) => project.slides.some((s) => s.frames.some((f) => (f.assetIds || []).includes(assetId)));
