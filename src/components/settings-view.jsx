import { useEffect, useState } from 'react';
import { api } from '../api.js';
import ImageModelSelect from './image-model-select.jsx';

// Fallback suggestions when `agy models` can't be run.
const FALLBACK_MODELS = {
  text: ['gemini-4-argon-medium', 'gemini-3.8-flash-medium', 'gemini-3.8-flash-low'],
  image: ['gemini-3.8-flash-low'],
};

export default function SettingsView({ settings, onSaved }) {
  const [textModel, setTextModel] = useState('');
  const [imageModel, setImageModel] = useState('');
  const [models, setModels] = useState(FALLBACK_MODELS);
  const [modelsNote, setModelsNote] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!settings) return;
    setTextModel(settings.textModel);
    setImageModel(settings.imageModel);
    api
      .listModels()
      .then((list) => {
        setModels(list);
        setModelsNote(`Danh sách model viết lấy từ lệnh agy models (${list.text.length} model).`);
      })
      .catch((err) => setModelsNote(`Không lấy được danh sách model: ${err.message}`));
  }, [settings]);

  async function save(e) {
    e.preventDefault();
    try {
      await api.saveSettings({ textModel, imageModel });
      setMessage('Đã lưu cài đặt.');
      onSaved();
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <form className="card narrow stack" onSubmit={save}>
      <h2>Cài đặt AI (agy CLI)</h2>
      {settings?.agyVersion ? (
        <p className="muted small">
          Đang dùng agy {settings.agyVersion}, chạy bằng gói đăng ký đã đăng nhập trên máy, không cần API key.
        </p>
      ) : (
        <p className="error small">Không tìm thấy agy CLI. Cài agy và đăng nhập, hoặc đặt AGY_BIN trong file .env.</p>
      )}
      <label>
        Model viết kịch bản, caption, đặt lời thoại
        <input list="text-models" value={textModel} onChange={(e) => setTextModel(e.target.value)} />
      </label>
      <ImageModelSelect value={imageModel} onChange={setImageModel} stacked />
      {settings?.gflowVersion ? (
        <p className="muted small">
          Đã cài gflow-cli {settings.gflowVersion}: chọn model "Google Flow" để vẽ thẳng qua Google Flow, dùng hạn mức ảnh riêng của Flow.
          Phiên đăng nhập Flow hết hạn thì chạy <code>gflow auth login</code> lại.
        </p>
      ) : (
        <p className="muted small">
          Muốn vẽ thẳng qua Google Flow: cài gflow-cli (<code>uv tool install gflow-cli</code>), chạy <code>gflow auth login</code> rồi khởi động lại server.
        </p>
      )}
      <datalist id="text-models">{models.text.map((m) => <option key={m} value={m} />)}</datalist>
      <p className="muted small">
        {modelsNote} Với model agy, agy tự chọn model vẽ thật; ô trên chọn model điều khiển việc vẽ. Mỗi khung mất khoảng 1–2 phút.
      </p>
      <div className="row">
        <button className="primary" type="submit">Lưu</button>
        {message && <span className="muted">{message}</span>}
      </div>
    </form>
  );
}
