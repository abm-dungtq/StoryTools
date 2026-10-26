import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { formatDuration } from '../lib/time-estimate.js';

// One model-list call shared by every dropdown on the page: Google Flow models (gflow-cli) and agy fallback models.
let modelsPromise;
export const loadModels = () =>
  (modelsPromise ??= api.listModels().catch(() => {
    // Let the next dropdown retry instead of caching the failure for the whole page.
    modelsPromise = undefined;
    return { text: [], image: [], fallback: [], labels: {} };
  }));

/** Dropdown for the Google Flow model that draws every image, plus the expected time for `frames` frames when given. */
export default function ImageModelSelect({ value, onChange, frames = 0, disabled = false, stacked = false }) {
  const [models, setModels] = useState([]);
  const [labels, setLabels] = useState({});
  useEffect(() => {
    loadModels().then((m) => {
      setModels(m.image || []);
      setLabels(m.labels || {});
    });
  }, []);
  // Keep a configured model selectable even when the list doesn't have it, instead of silently switching it.
  const options = !value || models.includes(value) ? models : [value, ...models];

  return (
    <span className={stacked ? 'stack tight' : 'row wrap'}>
      <label className={stacked ? '' : 'inline'}>
        Model vẽ ảnh
        <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} style={stacked ? { width: '100%' } : undefined}>
          {options.map((id) => (
            <option key={id} value={id}>{labels[id] || id}</option>
          ))}
        </select>
      </label>
      {frames > 0 && (
        <span className="muted small">
          ≈ {formatDuration(frames)} cho {frames} khung (vẽ lần lượt, chưa tính vẽ lại)
        </span>
      )}
    </span>
  );
}
