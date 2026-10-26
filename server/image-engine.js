// Every image (frames, outfit sheets, asset sheets) is drawn with Google Flow through gflow-cli. agy only draws when
// gflow is not installed or has just failed, so a broken Flow login or an empty Flow quota never stops a story.
import { AgyError } from './agy-runner.js';
import { generateImage } from './agy.js';
import { generateImageWithGflow, gflowVersion, pickRefs } from './gflow.js';

// After a gflow failure the next calls go straight to agy for a while instead of each waiting for the same error.
const COOLDOWN_MS = 10 * 60 * 1000;
let flowDown = null; // { until, reason }; until is Infinity for failures that never fix themselves

// gflow error classes (from its --json error envelope) that only the user can fix: login, credits, account access.
const STICKY = new Set([
  'AuthExpiredError',
  'AisandboxAuthError',
  'AuthMissingError',
  'AuthBrowserRejectedError',
  'InsufficientCreditsError',
  'FlowAccessUnavailableError',
]);
// Failures tied to this one prompt: the next call may well work on Flow.
const ONE_OFF = new Set(['ContentPolicyError', 'WafRejectionError']);

/** What a gflow failure means for the next calls: rethrow it, fall back once, pause Flow for a while, or until resumed. */
export function fallbackPolicy(err) {
  // A cancelled request or a bad request would fail the same way on agy.
  if (err.status === 499 || err.status === 400) return 'throw';
  if (ONE_OFF.has(err.flowClass)) return 'once';
  if (STICKY.has(err.flowClass)) return 'sticky';
  return 'cooldown';
}

/** Lets gflow draw again right away (after the user logged in again or the quota came back). */
export function resumeFlow() {
  flowDown = null;
}

// What to draw, in the wording each engine is prompted in.
const TASKS = {
  panel: { flow: 'Draw exactly ONE comic panel.', agy: 'Tạo đúng MỘT ảnh khung truyện tranh' },
  outfit: {
    flow: 'Draw ONE character reference sheet for a comic: the same character shown three times side by side (front, side, back view), full body, neutral standing pose, plain pure white background.',
    agy: 'Tạo MỘT ảnh bảng thiết kế nhân vật: cùng một nhân vật vẽ ba lần cạnh nhau (chính diện, nghiêng, sau lưng), toàn thân, đứng thẳng, nền trắng trơn',
  },
  prop: {
    flow: 'Draw ONE reference image of a single object for a comic, centered, plain pure white background, no people.',
    agy: 'Tạo MỘT ảnh mẫu của một đồ vật trong truyện tranh, đặt giữa ảnh, nền trắng trơn, không có người',
  },
  place: {
    flow: 'Draw ONE background reference image of a location for a comic, wide establishing view, no people.',
    agy: 'Tạo MỘT ảnh mẫu bối cảnh trong truyện tranh, góc rộng, không có người',
  },
};

/** Why gflow is being skipped right now, or null when it will be tried. */
export function flowPause() {
  if (!flowDown || Date.now() >= flowDown.until) return null;
  return { reason: flowDown.reason, until: Number.isFinite(flowDown.until) ? new Date(flowDown.until).toISOString() : null };
}

/**
 * Draws one image: gflow first, agy as the fallback.
 * @param {{settings, kind?: keyof TASKS, prompt: string, refs: object[], aspectRatio?: string, signal?: AbortSignal}} args
 * @returns {Promise<{buffer: Buffer, mimeType: string, engine: 'gflow'|'agy', fallbackReason?: string}>}
 */
export async function drawImage({ settings, kind = 'panel', prompt, refs, aspectRatio, signal }) {
  const task = TASKS[kind] || TASKS.panel;
  let fallbackReason;
  if (!(await gflowVersion())) fallbackReason = 'chưa cài gflow-cli';
  else if (flowPause()) fallbackReason = `gflow vừa lỗi, tạm dùng agy: ${flowDown.reason}`;
  else {
    try {
      const image = await generateImageWithGflow({ model: settings.imageModel, prompt, refs, aspectRatio, task: task.flow, signal });
      flowDown = null;
      return { ...image, engine: 'gflow' };
    } catch (err) {
      const policy = fallbackPolicy(err);
      if (policy === 'throw') throw err;
      if (policy !== 'once') flowDown = { until: policy === 'sticky' ? Infinity : Date.now() + COOLDOWN_MS, reason: err.message };
      fallbackReason = err.message;
    }
  }
  try {
    const image = await generateImage({ model: settings.fallbackImageModel, prompt, refs: pickRefs(refs), aspectRatio, task: task.agy, signal });
    return { ...image, engine: 'agy', fallbackReason };
  } catch (err) {
    if (err.status === 499) throw err;
    throw new AgyError(`${err.message.replace(/^agy: /, '')} (dự phòng sau khi ${fallbackReason})`, err.status || 502);
  }
}
