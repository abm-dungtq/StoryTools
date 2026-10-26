import { useState } from 'react';
import { api, characterImageUrl } from '../api.js';
import { autosaveLabel, useAutosave } from '../hooks/use-autosave.js';

const uid = () => Math.random().toString(36).slice(2, 10);

export default function CharactersView({ characters, setCharacters }) {
  const status = useAutosave(characters, api.saveCharacters);
  const [error, setError] = useState('');
  const [extracting, setExtracting] = useState({});

  const update = (id, patch) => setCharacters((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const add = () =>
    setCharacters((list) => [...list, { id: uid(), name: `Nhân vật ${list.length + 1}`, description: '', traits: '', images: [] }]);
  const remove = (c) => {
    if (confirm(`Xoá nhân vật "${c.name}"?`)) setCharacters((list) => list.filter((x) => x.id !== c.id));
  };

  async function upload(id, fileList) {
    setError('');
    try {
      const files = [];
      for (const f of fileList) files.push((await api.uploadCharacterImage(f)).file);
      setCharacters((list) => list.map((c) => (c.id === id ? { ...c, images: [...(c.images || []), ...files] } : c)));
      // React may run the updater above later, so build the extraction input from the current props instead.
      const current = characters.find((c) => c.id === id);
      if (current && !current.traits?.trim()) extractTraits({ ...current, images: [...(current.images || []), ...files] }, { onlyIfEmpty: true });
    } catch (err) {
      setError(err.message);
    }
  }

  // One agy vision call per character, only when asked or when traits are still empty; never during frame drawing.
  async function extractTraits(character, { onlyIfEmpty = false } = {}) {
    if (!character.images?.length) return;
    setError('');
    setExtracting((m) => ({ ...m, [character.id]: true }));
    try {
      const { traits } = await api.extractCharacterTraits(character);
      // An automatic run must not overwrite traits the user typed while agy was reading the images.
      setCharacters((list) => list.map((c) => (c.id === character.id && (!onlyIfEmpty || !c.traits?.trim()) ? { ...c, traits } : c)));
    } catch (err) {
      setError(`Không rút được đặc điểm của ${character.name}: ${err.message}`);
    } finally {
      setExtracting((m) => ({ ...m, [character.id]: false }));
    }
  }

  return (
    <div className="stack">
      <div className="row between">
        <h2>Nhân vật</h2>
        <div className="row">
          <span className="muted small">{autosaveLabel(status)}</span>
          <button className="primary" onClick={add}>+ Thêm nhân vật</button>
        </div>
      </div>
      <p className="muted small">
        Mô tả cố định sẽ được chèn vào mọi prompt. Viết thật cụ thể những nét không đổi (tuổi, dáng người, tóc, mắt, màu da). Trang phục do từng
        truyện quy định theo giai đoạn ở bước 2 "Trang phục", nên không cần ghi ở đây. Ảnh tham chiếu: 1–3 ảnh rõ mặt, nền đơn giản.
      </p>
      {error && <p className="error">{error}</p>}
      {characters.length === 0 && <p className="muted">Chưa có nhân vật nào.</p>}

      <div className="character-grid">
        {characters.map((c) => (
          <div key={c.id} className="card character-card">
            <div className="thumbs">
              {(c.images || []).map((file) => (
                <div key={file} className="thumb-wrap">
                  <img src={characterImageUrl(file)} alt="" />
                  <button
                    className="thumb-remove"
                    title="Bỏ ảnh tham chiếu này"
                    aria-label={`Bỏ ảnh tham chiếu của ${c.name}`}
                    onClick={() => update(c.id, { images: c.images.filter((f) => f !== file) })}
                  >
                    ×
                  </button>
                </div>
              ))}
              <label className="thumb-add" title="Thêm ảnh tham chiếu">
                +
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  hidden
                  onChange={(e) => {
                    upload(c.id, [...e.target.files]);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            <div className="stack">
              <div className="row">
                <input className="grow" value={c.name} onChange={(e) => update(c.id, { name: e.target.value })} placeholder="Tên" />
                <button className="danger" onClick={() => remove(c)}>Xoá</button>
              </div>
              <div className="stack tight">
                <span className="label">Mô tả</span>
                <textarea
                  rows={5}
                  value={c.description}
                  onChange={(e) => update(c.id, { description: e.target.value })}
                  placeholder="VD: cậu bé 13 tuổi, dáng gầy, tóc đen rối xù, mắt to nâu, da ngăm"
                />
              </div>
              <div className="stack tight">
                <div className="row between">
                  <span className="label">Đặc điểm nhận dạng (AI rút từ ảnh mẫu, sửa được)</span>
                  <button disabled={!c.images?.length || extracting[c.id]} onClick={() => extractTraits(c)}>
                    {extracting[c.id] ? 'Đang rút…' : 'Rút lại'}
                  </button>
                </div>
                <textarea
                  rows={5}
                  value={c.traits || ''}
                  onChange={(e) => update(c.id, { traits: e.target.value })}
                  placeholder="VD: tóc đen rối xù, mắt to nâu, da ngăm, dáng gầy"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
