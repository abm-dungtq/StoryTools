import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { formatDuration } from '../lib/time-estimate.js';

// One `agy models` call shared by every dropdown on the page.
let modelsPromise;
const loadModels = () =>
  (modelsPromise ??= api.listModels().catch(() => {
    // Let the next dropdown retry instead of caching the failure for the whole page.
    modelsPromise = undefined;
    return { image: [] };
  }));

/** Dropdown for the agy model that drives image generation, plus the expected time for `frames` frames when given. */
export default function ImageModelSelect({ value, onChange, frames = 0, disabled = false, stacked = false }) {
  const [models, setModels] = useState([]);
  useEffect(() => {
    loadModels().then((m) => setModels(m.image || []));
  }, []);
  // Keep a configured model selectable even when the list doesn't have it, instead of silently switching it.
  const options = !value || models.includes(value) ? models : [value, ...models];

  return (
    <span className={stacked ? 'stack tight' : 'row wrap'}>
      <label className={stacked ? '' : 'inline'}>
        Model điều khiển vẽ ảnh (agy)
        <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} style={stacked ? { width: '100%' } : undefined}>
          {options.map((id) => (
            <option key={id} value={id}>{id}</option>
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
