import { useEffect, useRef, useState } from 'react';
import { api, isAbort } from '../api.js';
import { ensureSheets, generateFrameImage, placeBubblesFromImage } from '../lib/frame-generation.js';
import { applyOutfitPlan, isSlideConfirmed, outfitPlanRequest, unconfirmedSlides } from '../lib/outfits.js';
import { fitFrames, frameEntries, frameLabel, layoutForFrameCount, uid } from '../lib/story-model.js';

const hasDialogue = (frame) => frame.dialogues.some((d) => d.text?.trim());
// A frame whose AI placement failed keeps template bubbles but stays pending until placement succeeds.
const needsBubbles = (frame) => hasDialogue(frame) && (frame.bubbles == null || frame.bubblePlacementFailed);

/**
 * Frames the automation still has to process: missing image (only in slides whose outfits are confirmed), or
 * dialogue without AI-placed bubbles.
 */
export const pendingFrames = (project) =>
  frameEntries(project).filter((e) => (!e.frame.selectedImage && isSlideConfirmed(project, e.slide)) || (e.frame.selectedImage && needsBubbles(e.frame)));

/** Frames without an image held back because their slide's outfits are not confirmed yet. */
export const blockedFrames = (project) => frameEntries(project).filter((e) => !e.frame.selectedImage && !isSlideConfirmed(project, e.slide));

const slideNumbers = (project, slides) => slides.map((s) => project.slides.indexOf(s) + 1).join(', ');

/**
 * Automated pipeline (plot -> story plan -> outfits and assets -> sheets and frame images -> AI bubble placement),
 * owned by the editor so it keeps running while the user switches steps. Every stage skips finished work, so a stopped
 * or failed run resumes.
 */
export function useStoryAutomation({ projectRef, characters, update, updateFrame }) {
  const [progress, setProgress] = useState(null); // { label, done?, total? }
  const [error, setError] = useState('');
  const stopRef = useRef(false);
  const controllerRef = useRef(null);

  // Leaving the editor cancels the running AI call instead of paying for a result nobody saves.
  useEffect(() => () => controllerRef.current?.abort(), []);

  async function writeStory({ slideCount, framesPerSlide }) {
    const p = projectRef.current;
    setProgress({ label: 'AI đang viết kịch bản…' });
    const { slides } = await api.planStory(p.id, {
      storyIdea: p.idea,
      slideCount,
      framesPerSlide,
      characterIds: p.characterIds,
    }, controllerRef.current.signal);
    const next = slides.map((s) => {
      const layout = layoutForFrameCount(p.orientation, Math.max(1, s.frames.length));
      return { id: uid(), idea: s.idea, layoutId: layout.id, frames: fitFrames(s.frames, layout), outfits: {}, outfitCheck: null };
    });
    // A new script starts a new costume plan; outfits and assets of the old one would not match it.
    const fresh = { slides: next, outfits: [], assets: [], outfitsPlannedAt: null };
    update(fresh);
    // State updates land on the next render; continue from a local snapshot instead.
    return { ...p, ...fresh };
  }

  /**
   * Costume director pass. With `auto` the AI confirms the slides it finds matching, and gets one more pass to fix the
   * rest using its own notes. Returns the project snapshot with the plan applied.
   */
  async function planOutfits(snapshot, { auto }) {
    const { signal } = controllerRef.current;
    let p = snapshot || projectRef.current;
    // Without a cast there is nothing to dress, so do not spend an agy call.
    if (!p.characterIds?.length) return p;
    for (let pass = 1; pass <= (auto ? 2 : 1); pass++) {
      setProgress({ label: pass === 1 ? 'AI đang lập trang phục & đồ vật theo từng giai đoạn…' : 'AI đang sửa trang phục chưa khớp kịch bản…' });
      const plan = await api.planOutfits(p.id, outfitPlanRequest(p), signal);
      p = applyOutfitPlan(p, plan, { auto });
      update((cur) => applyOutfitPlan(cur, plan, { auto }));
      if (!unconfirmedSlides(p).length) break;
    }
    return p;
  }

  /** Draws missing sheets and images and places bubbles, in story order. Returns false when stopped. */
  async function fillFrames(snapshot) {
    let p = snapshot || projectRef.current;
    const entries = frameEntries(p);
    const todo = pendingFrames(p);
    const blocked = unconfirmedSlides(p).filter((s) => blockedFrames(p).some((e) => e.slide.id === s.id));
    const drawn = new Map(); // frameId -> image generated during this run
    const failed = [];
    const fallbacks = new Set();
    const { signal } = controllerRef.current;
    const onSheet = (key, id, patch) => update((cur) => ({ [key]: cur[key].map((x) => (x.id === id ? { ...x, ...patch } : x)) }));

    for (const [n, e] of todo.entries()) {
      if (stopRef.current) return false;
      const label = frameLabel(e.s, e.f, e.frameCount);
      let file = e.frame.selectedImage;

      if (!file) {
        setProgress({ label: `Đang vẽ ảnh mẫu trang phục / đồ vật cho ${label}`, done: n, total: todo.length });
        p = await ensureSheets(p, e, onSheet, signal);
        setProgress({ label: `Đang vẽ ${label}`, done: n, total: todo.length });
        const prev = entries[entries.findIndex((x) => x.frame.id === e.frame.id) - 1]?.frame;
        const styleRef = prev ? drawn.get(prev.id) || prev.selectedImage : null;
        const result = await generateFrameImage(p, e, characters, styleRef, signal);
        file = result.file;
        if (result.fallbackReason) fallbacks.add(result.fallbackReason);
        drawn.set(e.frame.id, file);
        updateFrame(e.frame.id, (f) => ({ images: [...(f.images || []), file], selectedImage: file }));
      }

      if (needsBubbles(e.frame)) {
        setProgress({ label: `Đang đặt lời thoại ${label}`, done: n, total: todo.length });
        try {
          const placed = await placeBubblesFromImage(p, e, characters, file, signal);
          if (placed) updateFrame(e.frame.id, placed);
        } catch (err) {
          if (isAbort(err)) throw err;
          // Keep going with the other frames, but remember this one so the next run retries it.
          updateFrame(e.frame.id, { bubblePlacementFailed: true });
          failed.push(label);
        }
      }
    }
    const messages = [];
    if (blocked.length) messages.push(`Chưa vẽ Ảnh ${slideNumbers(p, blocked)} vì trang phục chưa được xác nhận khớp kịch bản. Vào bước 2 để sửa và xác nhận.`);
    if (fallbacks.size) messages.push(`Một số ảnh đã vẽ bằng agy dự phòng vì gflow lỗi: ${[...fallbacks].join(' / ')}`);
    if (failed.length) {
      messages.push(`Chưa đặt được lời thoại tự động cho ${failed.join(', ')}. Bấm "Vẽ khung còn thiếu & đặt thoại" để thử lại, hoặc dùng ✨ AI đặt thoại ở bước 4.`);
    }
    if (messages.length) setError(messages.join('\n'));
    return !blocked.length;
  }

  async function run(task) {
    stopRef.current = false;
    controllerRef.current = new AbortController();
    setError('');
    try {
      return await task();
    } catch (err) {
      if (!isAbort(err)) setError(err.message);
      return false;
    } finally {
      controllerRef.current = null;
      setProgress(null);
    }
  }

  return {
    progress,
    error,
    running: Boolean(progress),
    stop: () => {
      stopRef.current = true;
      controllerRef.current?.abort();
    },
    // Pausing for review: the AI plans outfits but the user confirms each slide in the outfits step.
    writeStory: (options) => run(async () => Boolean(await planOutfits(await writeStory(options), { auto: false }))),
    planOutfits: ({ auto = false } = {}) => run(async () => Boolean(await planOutfits(null, { auto }))),
    fillFrames: () => run(() => fillFrames()),
    runAll: (options) => run(async () => fillFrames(await planOutfits(await writeStory(options), { auto: true }))),
  };
}
