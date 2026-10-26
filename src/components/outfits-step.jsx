import { useEffect, useRef, useState } from 'react';
import { isAbort, panelImageUrl } from '../api.js';
import { generateSheet } from '../lib/frame-generation.js';
import {
  confirmedCheck,
  isAssetUsed,
  isOutfitPlanned,
  isOutfitUsed,
  isSheetStale,
  isSlideConfirmed,
  missingSheets,
  slideCharacterIds,
  slideIssues,
  slideOutfitOf,
} from '../lib/outfits.js';
import { uid } from '../lib/story-model.js';
import { formatDuration } from '../lib/time-estimate.js';

const KIND_LABEL = { outfit: 'trang phục', prop: 'đồ vật', place: 'bối cảnh' };

/** Badge telling why a reference sheet should be redrawn, or null. */
function staleNote(item) {
  if (!item.image) return null;
  if (isSheetStale(item)) return 'Mô tả đã đổi, sẽ vẽ lại trước khi vẽ khung';
  if (item.imageEngine === 'agy') return 'Vẽ bằng agy dự phòng, nên vẽ lại bằng Flow';
  return null;
}

/** One outfit or asset: its reference sheet, name and description, with draw and delete buttons. */
function SheetCard({ project, item, kind, busy, locked, error, used, onChange, onDraw, onDelete, children }) {
  const note = staleNote(item);
  return (
    <div className="card sheet-card">
      <div className="sheet-image">
        {item.image ? <img src={panelImageUrl(project.id, item.image)} alt="" /> : <span className="muted small">Chưa có ảnh mẫu</span>}
        {busy && <div className="overlay">Đang vẽ…</div>}
      </div>
      <div className="stack tight">
        <div className="row">
          <input className="grow" disabled={locked} value={item.name} onChange={(e) => onChange({ name: e.target.value })} placeholder={`Tên ${KIND_LABEL[kind]}`} />
          {children}
        </div>
        <textarea rows={3} disabled={locked} value={item.description} onChange={(e) => onChange({ description: e.target.value })} placeholder="Mô tả để vẽ giống nhau mọi lần" />
        <div className="row wrap">
          <button className="primary" disabled={busy || locked || !item.description?.trim()} onClick={onDraw}>
            {item.image ? 'Vẽ lại ảnh mẫu' : 'Vẽ ảnh mẫu'}
          </button>
          <button className="danger" disabled={busy || locked || used} title={used ? 'Đang được dùng trong truyện' : undefined} onClick={onDelete}>
            Xoá
          </button>
          {note && <span className="badge">{note}</span>}
        </div>
        {error && <p className="error small">{error}</p>}
      </div>
    </div>
  );
}

/**
 * Step 2: outfits per story stage for every character, separate props and places, and the per-slide confirmation that
 * each character's outfit matches the script. Frames of a slide are only drawn once it is confirmed.
 */
export default function OutfitsStep({ project, characters, automation, update, updateSlide, updateFrame }) {
  const [busyIds, setBusyIds] = useState(() => new Set());
  const [errors, setErrors] = useState({});
  const [batch, setBatch] = useState(null);
  const controllerRef = useRef(null);
  const projectRef = useRef(project);
  projectRef.current = project;

  const cast = characters.filter((c) => project.characterIds.includes(c.id));
  const nameOf = (id) => characters.find((c) => c.id === id)?.name || '?';
  const planned = isOutfitPlanned(project);
  const missing = missingSheets(project);
  const missingCount = missing.outfits.length + missing.assets.length;
  const busyAny = automation.running || Boolean(batch) || busyIds.size > 0;
  // While the AI plans or the automation draws, edits here would be overwritten by its result.
  const locked = automation.running;

  useEffect(() => () => controllerRef.current?.abort(), []);

  const setBusy = (id, on) =>
    setBusyIds((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const patchItem = (key, id, patch) => update((p) => ({ [key]: p[key].map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  const markPlanned = (p) => p.outfitsPlannedAt || new Date().toISOString();

  async function draw(key, item, kind, signal) {
    setBusy(item.id, true);
    setErrors((e) => ({ ...e, [item.id]: '' }));
    try {
      const { file, engine, fallbackReason } = await generateSheet(projectRef.current, item, kind, signal);
      patchItem(key, item.id, { image: file, imageEngine: engine, imageDescription: item.description });
      if (fallbackReason) setErrors((e) => ({ ...e, [item.id]: `Vẽ bằng agy dự phòng: ${fallbackReason}` }));
      return true;
    } catch (err) {
      if (!isAbort(err)) setErrors((e) => ({ ...e, [item.id]: err.message }));
      return !isAbort(err);
    } finally {
      setBusy(item.id, false);
    }
  }

  async function drawMissing() {
    controllerRef.current = new AbortController();
    const todo = [...missing.outfits.map((o) => ['outfits', o, 'outfit']), ...missing.assets.map((a) => ['assets', a, a.kind])];
    for (const [n, [key, item, kind]] of todo.entries()) {
      setBatch({ done: n, total: todo.length });
      if (!(await draw(key, item, kind, controllerRef.current.signal))) break;
    }
    controllerRef.current = null;
    setBatch(null);
  }

  const addOutfit = (characterId) =>
    update((p) => ({
      outfitsPlannedAt: markPlanned(p),
      outfits: [...p.outfits, { id: uid(), characterId, name: `Trang phục ${p.outfits.filter((o) => o.characterId === characterId).length + 1}`, description: '', image: null }],
    }));
  const addAsset = () =>
    update((p) => ({ outfitsPlannedAt: markPlanned(p), assets: [...p.assets, { id: uid(), kind: 'prop', name: `Đồ vật ${p.assets.length + 1}`, description: '', image: null }] }));
  const removeItem = (key, item) => confirm(`Xoá "${item.name}"?`) && update((p) => ({ [key]: p[key].filter((x) => x.id !== item.id) }));

  const confirmSlide = (slideId) =>
    update((p) => ({ slides: p.slides.map((s) => (s.id === slideId ? { ...s, outfitCheck: confirmedCheck(p, s) } : s)) }));
  const confirmAllMatching = () =>
    update((p) => ({
      slides: p.slides.map((s) =>
        s.outfitCheck?.ok && !isSlideConfirmed(p, s) && !slideIssues(p, s, characters).length ? { ...s, outfitCheck: confirmedCheck(p, s) } : s,
      ),
    }));

  const toggleAsset = (frameId, assetId) =>
    updateFrame(frameId, (f) => ({ assetIds: (f.assetIds || []).includes(assetId) ? f.assetIds.filter((x) => x !== assetId) : [...(f.assetIds || []), assetId] }));

  if (!project.slides.length) return <p className="muted">Chưa có kịch bản, quay lại bước 1.</p>;
  const pendingSlides = project.slides.filter((s) => !isSlideConfirmed(project, s));
  const matchingUnconfirmed = pendingSlides.filter((s) => s.outfitCheck?.ok && !slideIssues(project, s, characters).length).length;

  return (
    <div className="stack">
      <section className="card stack">
        <h3>🧥 Trang phục theo giai đoạn & đồ vật</h3>
        <p className="muted small">
          AI đọc kịch bản, chia truyện thành các giai đoạn và cho mỗi nhân vật một bộ trang phục cố định trong từng giai đoạn. Đồ vật hoặc bối cảnh
          lúc có lúc không (ba lô, tạp dề, căn bếp…) được tách thành ảnh mẫu riêng và chỉ gắn vào khung có nó. Mỗi ảnh phải được xác nhận trang
          phục khớp kịch bản thì mới vẽ.
        </p>
        <div className="row wrap">
          <button className="primary" disabled={busyAny || !cast.length} onClick={() => automation.planOutfits()}>
            {planned ? '🔍 AI kiểm tra lại trang phục' : '🧥 AI lập trang phục & đồ vật'}
          </button>
          {batch ? (
            <>
              <span>Đang vẽ ảnh mẫu {batch.done + 1}/{batch.total}…</span>
              <button className="danger" onClick={() => controllerRef.current?.abort()}>Dừng</button>
            </>
          ) : (
            missingCount > 0 && (
              <button disabled={busyAny} onClick={drawMissing}>
                🎨 Vẽ {missingCount} ảnh mẫu còn thiếu ({formatDuration(missingCount)})
              </button>
            )
          )}
          {matchingUnconfirmed > 0 && (
            <button disabled={busyAny} onClick={confirmAllMatching}>✓ Xác nhận {matchingUnconfirmed} ảnh AI báo khớp</button>
          )}
        </div>
        {!cast.length && <p className="muted small">Chọn nhân vật trong phần Thiết lập truyện ở bước 1.</p>}
        {automation.error && <p className="error small">{automation.error}</p>}
        {planned && (
          <p className={pendingSlides.length ? 'error small' : 'muted small'}>
            {pendingSlides.length
              ? `Còn ${pendingSlides.length}/${project.slides.length} ảnh chưa xác nhận trang phục: Ảnh ${pendingSlides.map((s) => project.slides.indexOf(s) + 1).join(', ')}`
              : `Đã xác nhận trang phục cả ${project.slides.length} ảnh.`}
          </p>
        )}
      </section>

      {cast.map((c) => {
        const list = project.outfits.filter((o) => o.characterId === c.id);
        return (
          <section key={c.id} className="stack">
            <div className="slide-heading">
              <h2>{c.name}</h2>
              <span className="muted small">{list.length} bộ trang phục</span>
            </div>
            <div className="sheet-grid">
              {list.map((o) => (
                <SheetCard
                  key={o.id}
                  project={project}
                  item={o}
                  kind="outfit"
                  busy={busyIds.has(o.id)}
                  locked={locked}
                  error={errors[o.id]}
                  used={isOutfitUsed(project, o.id)}
                  onChange={(patch) => patchItem('outfits', o.id, patch)}
                  onDraw={() => draw('outfits', o, 'outfit')}
                  onDelete={() => removeItem('outfits', o)}
                />
              ))}
            </div>
            <div>
              <button disabled={busyAny} onClick={() => addOutfit(c.id)}>+ Thêm trang phục cho {c.name}</button>
            </div>
          </section>
        );
      })}

      <section className="stack">
        <div className="slide-heading">
          <h2>Đồ vật & bối cảnh</h2>
          <span className="muted small">Xuất hiện ở nhiều khung nhưng không liên tục</span>
        </div>
        <div className="sheet-grid">
          {project.assets.map((a) => (
            <SheetCard
              key={a.id}
              project={project}
              item={a}
              kind={a.kind}
              busy={busyIds.has(a.id)}
              locked={locked}
              error={errors[a.id]}
              used={isAssetUsed(project, a.id)}
              onChange={(patch) => patchItem('assets', a.id, patch)}
              onDraw={() => draw('assets', a, a.kind)}
              onDelete={() => removeItem('assets', a)}
            >
              <select aria-label="Loại" disabled={locked} value={a.kind} onChange={(e) => patchItem('assets', a.id, { kind: e.target.value })}>
                <option value="prop">Đồ vật</option>
                <option value="place">Bối cảnh</option>
              </select>
            </SheetCard>
          ))}
        </div>
        <div>
          <button disabled={busyAny} onClick={addAsset}>+ Thêm đồ vật / bối cảnh</button>
        </div>
      </section>

      <section className="stack">
        <div className="slide-heading">
          <h2>Xác nhận từng ảnh</h2>
          <span className="muted small">Trang phục của từng nhân vật phải khớp bối cảnh và hành động của mọi khung</span>
        </div>
        {project.slides.map((slide, i) => {
          const onStage = slideCharacterIds(project, slide);
          const confirmed = isSlideConfirmed(project, slide);
          const issues = slideIssues(project, slide, characters);
          const check = slide.outfitCheck;
          return (
            <div key={slide.id} className={`card stack confirm-card ${confirmed ? 'confirmed' : ''}`}>
              <div className="row wrap between">
                <h3>Ảnh {i + 1}</h3>
                {onStage.length === 0 ? (
                  <span className="muted small">Không có nhân vật</span>
                ) : confirmed ? (
                  <span className="badge posted">✓ Đã xác nhận</span>
                ) : (
                  <button className="primary" disabled={busyAny || issues.length > 0} onClick={() => confirmSlide(slide.id)}>
                    Xác nhận trang phục khớp kịch bản
                  </button>
                )}
              </div>
              {slide.idea && <p className="small">{slide.idea}</p>}
              <div className="outfit-picks">
                {onStage.map((cid) => {
                  const outfit = slideOutfitOf(project, slide, cid);
                  return (
                    <label key={cid} className="outfit-pick">
                      {outfit?.image ? <img src={panelImageUrl(project.id, outfit.image)} alt="" /> : <span className="outfit-thumb muted small">—</span>}
                      <span className="stack tight">
                        <span className="label">{nameOf(cid)}</span>
                        <select
                          disabled={locked}
                          value={outfit?.id || ''}
                          onChange={(e) => updateSlide(slide.id, (s) => ({ outfits: { ...(s.outfits || {}), [cid]: e.target.value } }))}
                        >
                          <option value="">(Chưa chọn)</option>
                          {project.outfits
                            .filter((o) => o.characterId === cid)
                            .map((o) => (
                              <option key={o.id} value={o.id}>{o.name}</option>
                            ))}
                        </select>
                      </span>
                    </label>
                  );
                })}
              </div>
              {slide.frames.map((f, j) => (
                <div key={f.id} className="row wrap small">
                  <strong>Khung {j + 1}:</strong>
                  <span className="clamp-2 grow">{f.scene || f.action || '—'}</span>
                  {project.assets.length > 0 && (
                    <span className="chips">
                      {project.assets.map((a) => (
                        <button
                          key={a.id}
                          className={`chip ${(f.assetIds || []).includes(a.id) ? 'active' : ''}`}
                          aria-pressed={(f.assetIds || []).includes(a.id)}
                          disabled={locked}
                          onClick={() => toggleAsset(f.id, a.id)}
                        >
                          {a.name}
                        </button>
                      ))}
                    </span>
                  )}
                </div>
              ))}
              {issues.map((t) => (
                <p key={t} className="error small">{t}</p>
              ))}
              {check?.note && <p className={check.ok ? 'muted small' : 'error small'}>AI: {check.note}</p>}
              {check?.ok && !check.note && !confirmed && <p className="muted small">AI: trang phục khớp kịch bản.</p>}
            </div>
          );
        })}
      </section>
    </div>
  );
}
