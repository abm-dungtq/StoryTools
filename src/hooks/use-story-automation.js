import { useEffect, useRef, useState } from 'react';
import { api, isAbort } from '../api.js';
import { generateFrameImage, placeBubblesFromImage } from '../lib/frame-generation.js';
import { fitFrames, frameEntries, frameLabel, layoutForFrameCount, uid } from '../lib/story-model.js';

const hasDialogue = (frame) => frame.dialogues.some((d) => d.text?.trim());
// A frame whose AI placement failed keeps template bubbles but stays pending until placement succeeds.
const needsBubbles = (frame) => hasDialogue(frame) && (frame.bubbles == null || frame.bubblePlacementFailed);

/** Frames the automation still has to process: missing image, or dialogue without AI-placed bubbles. */
export const pendingFrames = (project) => frameEntries(project).filter((e) => !e.frame.selectedImage || needsBubbles(e.frame));

/**
 * Automated pipeline (plot -> story plan -> frame images -> AI bubble placement), owned by the editor so it
 * keeps running while the user switches steps. Every stage skips finished work, so a stopped or failed run resumes.
 */
export function useStoryAutomation({ projectRef, characters, update, updateFrame }) {
  const [progress, setProgress] = useState(null); // { label, done?, total? }
  const [error, setError] = useState('');
  const stopRef = useRef(false);
  const controllerRef = useRef(null);

  // Leaving the editor cancels the running agy call instead of paying for a result nobody saves.
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
      return { id: uid(), idea: s.idea, layoutId: layout.id, frames: fitFrames(s.frames, layout) };
    });
    update({ slides: next });
    // State updates land on the next render; continue from a local snapshot instead.
    return { ...p, slides: next };
  }

  /** Draws missing images and places bubbles, in story order. Returns false when stopped. */
  async function fillFrames(snapshot) {
    const p = snapshot || projectRef.current;
    const entries = frameEntries(p);
    const todo = pendingFrames(p);
    const drawn = new Map(); // frameId -> image generated during this run
    const failed = [];
    const { signal } = controllerRef.current;

    for (const [n, e] of todo.entries()) {
      if (stopRef.current) return false;
      const label = frameLabel(e.s, e.f, e.frameCount);
      let file = e.frame.selectedImage;

      if (!file) {
        setProgress({ label: `Đang vẽ ${label}`, done: n, total: todo.length });
        const prev = entries[entries.findIndex((x) => x.frame.id === e.frame.id) - 1]?.frame;
        const styleRef = prev ? drawn.get(prev.id) || prev.selectedImage : null;
        const result = await generateFrameImage(p, e, characters, styleRef, signal);
        file = result.file;
        drawn.set(e.frame.id, file);
        updateFrame(e.frame.id, (f) => ({ prompt: f.prompt || result.prompt, images: [...(f.images || []), file], selectedImage: file }));
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
    if (failed.length) {
      setError(
        `Chưa đặt được lời thoại tự động cho ${failed.join(', ')}. Bấm "Vẽ khung còn thiếu & đặt thoại" để thử lại, hoặc dùng ✨ AI đặt thoại ở bước 3.`,
      );
    }
    return true;
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
    writeStory: (options) => run(async () => Boolean(await writeStory(options))),
    fillFrames: () => run(() => fillFrames()),
    runAll: (options) => run(async () => fillFrames(await writeStory(options))),
  };
}
