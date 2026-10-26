import { useEffect, useRef, useState } from 'react';
import { api, isAbort, panelImageUrl } from '../api.js';
import { getLayout } from '../lib/layouts.js';
import { ensureSheets, generateFrameImage, placeBubblesFromImage } from '../lib/frame-generation.js';
import { isSlideConfirmed } from '../lib/outfits.js';
import { buildFramePrompt } from '../lib/prompt-builder.js';
import { frameEntries, frameLabel } from '../lib/story-model.js';
import ImageModelSelect from './image-model-select.jsx';

export default function FramesStep({ project, characters, settings, automation, changeImageModel, update, updateFrame }) {
  const [busyIds, setBusyIds] = useState(() => new Set());
  const [errors, setErrors] = useState({});
  const [notes, setNotes] = useState({});
  const [batch, setBatch] = useState(null);
  const [openPrompts, setOpenPrompts] = useState(() => new Set());
  const stopRef = useRef(false);
  const controllerRef = useRef(null);
  // Leaving this step cancels a running batch instead of drawing frames nobody saves.
  useEffect(() => () => controllerRef.current?.abort(), []);
  // Async loops read the latest project through this ref instead of a stale closure.
  const projectRef = useRef(project);
  projectRef.current = project;

  const onSheet = (key, id, patch) => update((cur) => ({ [key]: cur[key].map((x) => (x.id === id ? { ...x, ...patch } : x)) }));

  const setBusy = (id, on) =>
    setBusyIds((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const togglePrompt = (id) =>
    setOpenPrompts((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /**
   * Generates one frame image. `styleRef` overrides the previous frame's image (used by batch runs,
   * where the previous frame's new image may not be in state yet).
   */
  async function generate(frameId, styleRef) {
    const p = projectRef.current;
    const entries = frameEntries(p);
    const k = entries.findIndex((e) => e.frame.id === frameId);
    if (k < 0) return null;
    const entry = entries[k];

    const signal = controllerRef.current?.signal;
    setBusy(frameId, true);
    setErrors((e) => ({ ...e, [frameId]: '' }));
    setNotes((n) => ({ ...n, [frameId]: '' }));
    try {
      const ready = await ensureSheets(p, entry, onSheet, signal);
      const { file, fallbackReason } = await generateFrameImage(ready, entry, characters, styleRef ?? entries[k - 1]?.frame.selectedImage, signal);
      updateFrame(frameId, (f) => ({ images: [...(f.images || []), file], selectedImage: file }));
      if (fallbackReason) setNotes((n) => ({ ...n, [frameId]: `Vẽ bằng agy dự phòng: ${fallbackReason}` }));
      // First image of a frame: let the AI place the dialogue on it (kept only if the user hasn't placed bubbles meanwhile).
      if (entry.frame.bubbles == null) {
        placeBubblesFromImage(p, entry, characters, file, signal)
          .then((placed) => placed && updateFrame(frameId, (f) => (f.bubbles == null ? placed : {})))
          .catch((err) => !isAbort(err) && updateFrame(frameId, { bubblePlacementFailed: true }));
      }
      return file;
    } catch (err) {
      if (!isAbort(err)) setErrors((e) => ({ ...e, [frameId]: err.message }));
      return null;
    } finally {
      setBusy(frameId, false);
    }
  }

  async function generateMissing() {
    stopRef.current = false;
    controllerRef.current = new AbortController();
    const targets = frameEntries(project)
      .map((e, k) => ({ id: e.frame.id, k, has: Boolean(e.frame.selectedImage), ok: isSlideConfirmed(project, e.slide) }))
      .filter((t) => !t.has && t.ok);
    setBatch({ done: 0, total: targets.length });
    let lastFile;
    let lastK = -2;
    for (const [n, t] of targets.entries()) {
      if (stopRef.current || controllerRef.current?.signal.aborted) break;
      const file = await generate(t.id, lastK === t.k - 1 && lastFile ? lastFile : undefined);
      lastFile = file;
      lastK = t.k;
      setBatch({ done: n + 1, total: targets.length });
    }
    controllerRef.current = null;
    setBatch(null);
  }

  async function uploadImage(frameId, file) {
    try {
      const { file: saved } = await api.uploadPanelImage(project.id, file);
      updateFrame(frameId, (f) => ({ images: [...(f.images || []), saved], selectedImage: saved }));
    } catch (err) {
      setErrors((e) => ({ ...e, [frameId]: err.message }));
    }
  }

  function fillAllPrompts() {
    const entries = frameEntries(project);
    if (entries.some((e) => e.frame.prompt?.trim()) && !confirm('Ghi đè toàn bộ prompt đã sửa bằng prompt tạo từ kịch bản?')) return;
    update((p) => ({
      slides: p.slides.map((s) => ({ ...s, frames: s.frames.map((f) => ({ ...f, prompt: buildFramePrompt(p, s, f, characters) })) })),
    }));
  }

  const entries = frameEntries(project);
  if (!entries.length) return <p className="muted">Chưa có ảnh nào, quay lại bước Kịch bản.</p>;
  const missing = entries.filter((e) => !e.frame.selectedImage && isSlideConfirmed(project, e.slide)).length;
  const held = entries.filter((e) => !e.frame.selectedImage && !isSlideConfirmed(project, e.slide)).length;
  const nameOf = (id) => characters.find((c) => c.id === id)?.name || '?';
  const groups = project.slides.map((slide, s) => ({ slide, s, items: entries.filter((e) => e.s === s) })).filter((g) => g.items.length);

  return (
    <div className="stack">
      <section className="card row wrap between toolbar">
        <div className="row wrap">
          <button onClick={fillAllPrompts}>Tạo prompt cho tất cả khung</button>
          {batch ? (
            <>
              <span>Đang tạo {batch.done}/{batch.total}…</span>
              <button
                className="danger"
                onClick={() => {
                  stopRef.current = true;
                  controllerRef.current?.abort();
                }}
              >
                Dừng
              </button>
            </>
          ) : (
            <button className="primary" disabled={!missing || automation.running} onClick={generateMissing}>
              🎨 Tạo ảnh cho {missing} khung chưa có ảnh
            </button>
          )}
          {held > 0 && <span className="muted small">{held} khung đang chờ xác nhận trang phục ở bước 2</span>}
        </div>
        <label className="check">
          <input type="checkbox" checked={Boolean(project.usePrevFrameRef)} onChange={(e) => update({ usePrevFrameRef: e.target.checked })} />
          Gửi kèm ảnh khung trước để giữ phong cách
        </label>
        <ImageModelSelect
          value={settings?.imageModel || ''}
          frames={missing}
          disabled={Boolean(batch) || automation.running}
          onChange={changeImageModel}
        />
      </section>

      {groups.map(({ slide, s, items }) => {
        const confirmed = isSlideConfirmed(project, slide);
        return (
          <section key={slide.id} className="stack">
            <div className="slide-heading">
              <h2>Ảnh {s + 1}</h2>
              <span className="muted small">{getLayout(project.orientation, slide.layoutId).label}</span>
              {!confirmed && <span className="error small">Trang phục chưa xác nhận (bước 2)</span>}
              {slide.idea && <p className="small">{slide.idea}</p>}
            </div>
            <div className="frame-grid images">
              {items.map(({ frame, f, frameCount, aspectRatio }) => {
                const busy = busyIds.has(frame.id);
                const open = openPrompts.has(frame.id);
                return (
                  <div key={frame.id} className={`frame-card ${open ? 'prompt-open' : ''}`}>
                    <div className="preview" style={{ aspectRatio: aspectRatio.replace(':', ' / ') }}>
                      {frame.selectedImage ? (
                        <img src={panelImageUrl(project.id, frame.selectedImage)} alt="" />
                      ) : (
                        <span className="muted">Chưa có ảnh</span>
                      )}
                      {busy && <div className="overlay">Đang tạo ảnh…</div>}
                    </div>
                    <div className="frame-info">
                      <h3>
                        {frameLabel(s, f, frameCount)} <span className="muted small">tỉ lệ {aspectRatio}</span>
                      </h3>
                      <div className="row wrap">
                        <button
                          className="primary"
                          disabled={busy || automation.running || !confirmed}
                          title={confirmed ? undefined : 'Xác nhận trang phục của ảnh này ở bước 2 trước'}
                          onClick={() => generate(frame.id)}
                        >
                          {frame.selectedImage ? 'Tạo lại' : 'Tạo ảnh'}
                        </button>
                        <label className="button">
                          Tải ảnh lên
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            hidden
                            onChange={(e) => {
                              if (e.target.files[0]) uploadImage(frame.id, e.target.files[0]);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </div>
                      {errors[frame.id] && <p className="error small">{errors[frame.id]}</p>}
                      {notes[frame.id] && <p className="muted small">{notes[frame.id]}</p>}
                      {frame.images?.length > 1 && (
                        <div className="thumbs">
                          {frame.images.map((file) => (
                            <img
                              key={file}
                              className={file === frame.selectedImage ? 'active' : ''}
                              src={panelImageUrl(project.id, file)}
                              title="Chọn ảnh này"
                              alt=""
                              onClick={() => updateFrame(frame.id, { selectedImage: file })}
                            />
                          ))}
                        </div>
                      )}
                      <div className="frame-summary small">
                        <p className="clamp-2">{frame.scene || frame.action || '—'}</p>
                        <p className="muted">{frame.characterIds.map(nameOf).join(', ') || 'Không có nhân vật'}</p>
                        {frame.dialogues.map((d, k) => (
                          <p key={k}><b>{d.speakerId ? nameOf(d.speakerId) : '…'}:</b> {d.text}</p>
                        ))}
                      </div>
                      <div>
                        <button data-expand aria-expanded={String(open)} onClick={() => togglePrompt(frame.id)}>
                          {open ? 'Ẩn prompt' : 'Prompt'}
                        </button>
                      </div>
                      {open && (
                        <>
                          <textarea
                            rows={9}
                            className="mono"
                            aria-label="Prompt"
                            value={frame.prompt || ''}
                            placeholder={buildFramePrompt(project, slide, frame, characters)}
                            onChange={(e) => updateFrame(frame.id, { prompt: e.target.value })}
                          />
                          <div>
                            <button onClick={() => updateFrame(frame.id, { prompt: buildFramePrompt(project, slide, frame, characters) })}>
                              Tạo lại prompt từ kịch bản
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
