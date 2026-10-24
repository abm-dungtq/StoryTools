import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { autosaveLabel, useAutosave } from '../hooks/use-autosave.js';
import { useStoryAutomation } from '../hooks/use-story-automation.js';
import { migrateProject } from '../lib/story-model.js';
import { stepStatus } from '../lib/step-status.js';
import ComposeStep from './compose-step.jsx';
import FramesStep from './frames-step.jsx';
import PreviewStep from './preview-step.jsx';
import ScriptStep from './script-step.jsx';

const STEPS = [
  { id: 'script', label: '1. Kịch bản' },
  { id: 'frames', label: '2. Prompt & ảnh' },
  { id: 'compose', label: '3. Lời thoại & ghép' },
  { id: 'preview', label: '4. Duyệt & đăng' },
];

// Accepts either a partial object or a function (current) => partial.
const resolvePatch = (patch, current) => (typeof patch === 'function' ? patch(current) : patch);

export default function ProjectEditor({ projectId, characters, settings, onSettingsChange, onBack }) {
  const [project, setProject] = useState(null);
  const [step, setStep] = useState('script');
  const [error, setError] = useState('');
  const projectRef = useRef(project);
  projectRef.current = project;

  useEffect(() => {
    api
      .getProject(projectId)
      .then((p) => setProject(migrateProject(p)))
      .catch((e) => setError(e.message));
  }, [projectId]);

  const status = useAutosave(project, api.saveProject);
  const update = useCallback((patch) => setProject((p) => ({ ...p, ...resolvePatch(patch, p) })), []);
  const updateSlide = useCallback(
    (slideId, patch) =>
      setProject((p) => ({
        ...p,
        slides: p.slides.map((s) => (s.id === slideId ? { ...s, ...resolvePatch(patch, s) } : s)),
      })),
    [],
  );
  const updateFrame = useCallback(
    (frameId, patch) =>
      setProject((p) => ({
        ...p,
        slides: p.slides.map((s) =>
          s.frames.some((f) => f.id === frameId)
            ? { ...s, frames: s.frames.map((f) => (f.id === frameId ? { ...f, ...resolvePatch(patch, f) } : f)) }
            : s,
        ),
      })),
    [],
  );
  const automation = useStoryAutomation({ projectRef, characters, update, updateFrame });

  // Model dropdowns inside the editor save immediately (settings are global, not per story).
  const changeImageModel = async (imageModel) => {
    try {
      await api.saveSettings({ imageModel });
      await onSettingsChange();
    } catch (err) {
      alert(err.message);
    }
  };

  if (error) return <p className="error">{error}</p>;
  if (!project) return <p className="muted">Đang tải truyện…</p>;
  const done = stepStatus(project);

  const stepProps = { project, characters, settings, automation, changeImageModel, update, updateSlide, updateFrame };
  const { progress } = automation;

  return (
    <div className="stack">
      <div className="row">
        <button onClick={onBack}>← Danh sách</button>
        <input className="title-input grow" value={project.title} onChange={(e) => update({ title: e.target.value })} />
        <span className="muted small nowrap">{autosaveLabel(status)}</span>
      </div>
      <nav className="stepper" aria-label="Các bước">
        {STEPS.map((s) => (
          <button
            key={s.id}
            data-step={s.id}
            data-done={String(done[s.id])}
            aria-current={step === s.id ? 'step' : undefined}
            className={`step ${step === s.id ? 'active' : ''} ${done[s.id] ? 'done' : ''}`}
            onClick={() => setStep(s.id)}
          >
            <span className="step-mark">{done[s.id] ? '✓' : s.label[0]}</span>
            {s.label.slice(3)}
          </button>
        ))}
      </nav>

      {progress && step !== 'script' && (
        <div className="progress-pill row wrap">
          <span>
            ⏳ {progress.label}
            {progress.total ? ` (${progress.done + 1}/${progress.total})` : ''}
          </span>
          <button className="danger" onClick={automation.stop}>Dừng</button>
        </div>
      )}

      {step === 'script' && <ScriptStep {...stepProps} onAutomationDone={() => setStep('compose')} />}
      {step === 'frames' && <FramesStep {...stepProps} />}
      {step === 'compose' && <ComposeStep {...stepProps} />}
      {step === 'preview' && <PreviewStep project={project} update={update} />}
    </div>
  );
}
