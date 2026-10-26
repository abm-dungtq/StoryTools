// Rough wall-clock time per frame through Google Flow (measured 2026-10: ~95 s drawing with references + ~15 s bubble placement).
export const SECONDS_PER_FRAME = 110;

/** "~12 phút" or "~1 giờ 45 phút" for drawing `frames` frames one after another. */
export function formatDuration(frames) {
  const minutes = Math.max(1, Math.ceil((frames * SECONDS_PER_FRAME) / 60));
  return minutes < 60 ? `~${minutes} phút` : `~${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`;
}
