// Thin fetch wrapper for the local API. Errors surface the server's Vietnamese message.

async function request(method, url, body, signal) {
  const res = await fetch(url, {
    method,
    signal,
    headers: body instanceof FormData || body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Lỗi ${res.status}`);
  return data;
}

const uploadFile = (url, file) => {
  const form = new FormData();
  form.append('file', file);
  return request('POST', url, form);
};

export const api = {
  getSettings: () => request('GET', '/api/settings'),
  saveSettings: (s) => request('PUT', '/api/settings', s),
  listModels: () => request('GET', '/api/models'),

  listCharacters: () => request('GET', '/api/characters'),
  saveCharacters: (list) => request('PUT', '/api/characters', list),
  uploadCharacterImage: (file) => uploadFile('/api/characters/images', file),

  listProjects: () => request('GET', '/api/projects'),
  createProject: (data) => request('POST', '/api/projects', data),
  getProject: (id) => request('GET', `/api/projects/${id}`),
  saveProject: (p) => request('PUT', `/api/projects/${p.id}`, p),
  deleteProject: (id) => request('DELETE', `/api/projects/${id}`),

  // AI calls take an optional AbortSignal: aborting closes the request and the server kills the agy process.
  generateFrames: (id, body, signal) => request('POST', `/api/projects/${id}/slides/script`, body, signal),
  planStory: (id, body, signal) => request('POST', `/api/projects/${id}/story/plan`, body, signal),
  placeBubbles: (id, body, signal) => request('POST', `/api/projects/${id}/frames/bubbles`, body, signal),
  generateImage: (id, body, signal) => request('POST', `/api/projects/${id}/images/generate`, body, signal),
  uploadPanelImage: (id, file) => uploadFile(`/api/projects/${id}/images/upload`, file),
  generateCaption: (id, body, signal) => request('POST', `/api/projects/${id}/caption`, body, signal),

  getShare: () => request('GET', '/api/share'),
  startShare: (form) => request('POST', '/api/share', form),
  stopShare: () => request('DELETE', '/api/share'),
};

export const isAbort = (err) => err?.name === 'AbortError';

export const characterImageUrl = (file) => `/files/characters/${file}`;
export const panelImageUrl = (projectId, file) => `/files/panels/${projectId}/${file}`;
