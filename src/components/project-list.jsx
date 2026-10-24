import { useEffect, useState } from 'react';
import { api, panelImageUrl } from '../api.js';
import { PAGE_SIZES } from '../lib/layouts.js';
import { statusLabel } from '../lib/publish.js';
import { frameEntries, migrateProject } from '../lib/story-model.js';

// Old stories use an earlier shape; migrate first, exactly like the editor does when opening one.
function coverInfo(raw) {
  const frames = frameEntries(migrateProject(raw)).map((e) => e.frame);
  return {
    cover: frames.find((f) => f.selectedImage)?.selectedImage || null,
    frameCount: frames.length,
    drawnCount: frames.filter((f) => f.selectedImage).length,
  };
}

export default function ProjectList({ onOpen }) {
  const [projects, setProjects] = useState([]);
  const [title, setTitle] = useState('');
  const [orientation, setOrientation] = useState('portrait');
  const [error, setError] = useState('');

  // The list endpoint only returns summaries; read each story once to show its cover and drawing progress.
  const load = () =>
    api
      .listProjects()
      .then((list) => Promise.all(list.map((p) => api.getProject(p.id).then((full) => ({ ...p, ...coverInfo(full) })).catch(() => p))))
      .then(setProjects)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  async function create(e) {
    e.preventDefault();
    try {
      const project = await api.createProject({ title, orientation });
      onOpen(project.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(p) {
    if (!confirm(`Xoá truyện "${p.title}" và toàn bộ ảnh đã tạo?`)) return;
    await api.deleteProject(p.id).catch((e) => setError(e.message));
    load();
  }

  return (
    <div className="stack">
      <div className="list-header">
        <h2>Truyện của bạn</h2>
        <form className="row wrap create-form" onSubmit={create}>
          <input className="grow" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tên truyện mới" />
          <select value={orientation} onChange={(e) => setOrientation(e.target.value)}>
            {Object.entries(PAGE_SIZES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <button className="primary" type="submit">+ Tạo truyện</button>
        </form>
      </div>
      {error && <p className="error">{error}</p>}

      {projects.length === 0 ? (
        <p className="muted">Chưa có truyện nào. Hãy tạo nhân vật trước, rồi tạo truyện mới.</p>
      ) : (
        <div className="project-grid">
          {projects.map((p) => (
            <article key={p.id} className="project-card">
              <button className="project-open" data-project onClick={() => onOpen(p.id)}>
                <div className={`project-cover ${p.orientation}`}>
                  {p.cover ? <img src={panelImageUrl(p.id, p.cover)} alt="" loading="lazy" /> : <span className="muted small">Chưa có ảnh</span>}
                </div>
                <strong className="project-title">{p.title}</strong>
              </button>
              <div className="project-meta">
                <span className={`badge ${p.publishStatus}`}>{statusLabel(p.publishStatus)}</span>
                <span className="muted small">{PAGE_SIZES[p.orientation]?.label} · {p.slideCount} ảnh</span>
              </div>
              {p.frameCount > 0 && (
                <div className="progress" title={`${p.drawnCount}/${p.frameCount} khung có ảnh`}>
                  <span style={{ width: `${(100 * p.drawnCount) / p.frameCount}%` }} />
                </div>
              )}
              <div className="row between">
                <span className="muted small">{new Date(p.updatedAt).toLocaleString('vi-VN')}</span>
                <button className="danger" onClick={() => remove(p)}>Xoá</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
