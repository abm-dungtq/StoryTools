import { useEffect, useState } from 'react';
import { api } from '../api.js';
import ImageModelSelect, { loadModels } from './image-model-select.jsx';

// Fallback suggestions when `agy models` can't be run.
const FALLBACK_MODELS = {
  text: ['gemini-4-argon-medium', 'gemini-3.8-flash-medium', 'gemini-3.8-flash-low'],
  fallback: ['gemini-3.8-flash-low'],
};

export default function SettingsView({ settings, onSaved }) {
  const [textModel, setTextModel] = useState('');
  const [imageModel, setImageModel] = useState('');
  const [fallbackImageModel, setFallbackImageModel] = useState('');
  const [models, setModels] = useState(FALLBACK_MODELS);
  const [modelsNote, setModelsNote] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!settings) return;
    setTextModel(settings.textModel);
    setImageModel(settings.imageModel);
    setFallbackImageModel(settings.fallbackImageModel);
    loadModels().then((list) => {
      if (list.text?.length) setModels(list);
      setModelsNote(
        list.agyError ? `Không lấy được danh sách model agy: ${list.agyError}` : `Danh sách model agy lấy từ lệnh agy models (${list.text?.length || 0} model).`,
      );
    });
  }, [settings]);

  async function save(e) {
    e.preventDefault();
    try {
      await api.saveSettings({ textModel, imageModel, fallbackImageModel });
      setMessage('Đã lưu cài đặt.');
      onSaved();
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function retryFlow() {
    await api.resumeFlow();
    onSaved();
  }

  return (
    <form className="card narrow stack" onSubmit={save}>
      <h2>Cài đặt AI</h2>
      <h3>Vẽ ảnh: Google Flow (gflow-cli)</h3>
      {settings?.gflowVersion ? (
        <p className="muted small">
          Đã cài gflow-cli {settings.gflowVersion}. Mọi ảnh (khung truyện, ảnh mẫu trang phục, đồ vật, bối cảnh) vẽ qua Google Flow bằng hạn mức ảnh
          của Flow. Phiên đăng nhập Flow hết hạn thì chạy <code>gflow auth login --browser chrome</code> lại. Đừng đóng cửa sổ Chrome khi đang vẽ.
        </p>
      ) : (
        <p className="error small">
          Chưa cài gflow-cli nên ảnh đang vẽ bằng agy dự phòng. Cài bằng <code>uv tool install gflow-cli</code>, chạy{' '}
          <code>gflow auth login --browser chrome</code> rồi khởi động lại server.
        </p>
      )}
      {settings?.flowPause && (
        <div className="row wrap">
          <p className="error small">
            gflow đang tạm nghỉ{settings.flowPause.until ? ` đến ${new Date(settings.flowPause.until).toLocaleTimeString('vi-VN')}` : ''}, ảnh vẽ bằng
            agy: {settings.flowPause.reason}
          </p>
          <button type="button" onClick={retryFlow}>Thử lại Flow</button>
        </div>
      )}
      <ImageModelSelect value={imageModel} onChange={setImageModel} stacked />

      <h3>Viết và dự phòng: agy CLI</h3>
      {settings?.agyVersion ? (
        <p className="muted small">Đang dùng agy {settings.agyVersion}, chạy bằng gói đăng ký đã đăng nhập trên máy, không cần API key.</p>
      ) : (
        <p className="error small">Không tìm thấy agy CLI. Cài agy và đăng nhập, hoặc đặt biến AGY_BIN.</p>
      )}
      <label>
        Model viết kịch bản, trang phục, caption, đặt lời thoại
        <input list="text-models" value={textModel} onChange={(e) => setTextModel(e.target.value)} />
      </label>
      <label>
        Model agy vẽ dự phòng (khi gflow chưa cài hoặc lỗi)
        <input list="fallback-models" value={fallbackImageModel} onChange={(e) => setFallbackImageModel(e.target.value)} />
      </label>
      <datalist id="text-models">{models.text.map((m) => <option key={m} value={m} />)}</datalist>
      <datalist id="fallback-models">{(models.fallback || []).map((m) => <option key={m} value={m} />)}</datalist>
      <p className="muted small">{modelsNote} Mỗi khung mất khoảng 1,5–2 phút.</p>
      <div className="row">
        <button className="primary" type="submit">Lưu</button>
        {message && <span className="muted">{message}</span>}
      </div>
    </form>
  );
}
