---
phase: 3
title: "Ghi file an toàn và autosave tuần tự"
status: completed
depends_on: [2]
---

# Phase 3 — Ghi file an toàn và autosave tuần tự

## Mục tiêu

Lời gọi agy chậm (70 s mỗi ảnh) làm cửa sổ ghi chồng rộng hơn. Phase này bảo đảm: ghi cùng một file JSON luôn tuần tự, tên file tạm không bao giờ trùng, và autosave phía client không bao giờ để bản cũ ghi đè bản mới.

## File

- Sửa `server/storage.js`: `writeJson`, `saveSettings`.
- Tạo `server/storage.test.js`.
- Sửa `src/hooks/use-autosave.js`: `useAutosave`.

## Tasks

### Task 3.1 — Khoá theo file và tên tạm duy nhất

- **Goal:** mọi lần ghi cùng một file đi qua một hàng đợi; tên tạm có bộ đếm.
- **Target:** `server/storage.js`.
- **Steps:**
  1. Thay `writeJson` hiện tại (dòng 45–50) bằng:
     ```js
     const fileLocks = new Map();
     let tmpCounter = 0;

     /** Runs fn after every earlier write to the same file has finished, so writes never interleave. */
     function withFileLock(file, fn) {
       const run = (fileLocks.get(file) || Promise.resolve()).catch(() => {}).then(fn);
       fileLocks.set(file, run);
       return run.finally(() => {
         if (fileLocks.get(file) === run) fileLocks.delete(file);
       });
     }

     // Write to a unique temp file first so a crash never leaves half-written JSON.
     async function writeJsonNow(file, data) {
       const tmp = `${file}.${process.pid}.${++tmpCounter}.tmp`;
       await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
       for (let attempt = 0; ; attempt++) {
         try {
           await fs.rename(tmp, file);
           return;
         } catch (err) {
           // Windows refuses the rename while another handle (antivirus, indexer) has the file open.
           if (attempt >= 4 || !['EPERM', 'EBUSY', 'EACCES'].includes(err.code)) throw err;
           await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
         }
       }
     }

     const writeJson = (file, data) => withFileLock(file, () => writeJsonNow(file, data));
     ```
  2. `saveSettings(patch)`: bọc cả đọc và ghi trong `withFileLock(SETTINGS_FILE, async () => { const saved = await readJson(SETTINGS_FILE, {}); await writeJsonNow(SETTINGS_FILE, { ...saved, ...mapped }); })`, trong đó `mapped` là phần chuyển `textModel`/`imageModel` thành `agyTextModel`/`agyImageModel` đã làm ở phase 2. Nếu phase 2 chưa làm, giữ nguyên nội dung patch hiện có và chỉ thêm khoá.
- **Success criteria:** không còn chuỗi `${process.pid}.tmp` đứng một mình.
- **Verify:** no verification needed (Task 3.2 kiểm).

### Task 3.2 — Test ghi đồng thời

- **Goal:** chứng minh 20 lần lưu đồng thời cùng một truyện đều thành công.
- **Target:** `server/storage.test.js`.
- **Steps:**
  1. Đặt `process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'storytools-storage-'))` trước, rồi `const store = await import('./storage.js')`, rồi `await store.ensureDataDirs()`.
  2. Test "concurrent saves of one project all succeed": `await Promise.all(Array.from({ length: 20 }, (_, i) => store.saveProject({ id: 'abc123', title: \`t${i}\`, slides: [] })))`; sau đó `const p = await store.getProject('abc123')`, kiểm `p.title` khớp regex `/^t\d+$/`; liệt kê thư mục `projects` và kiểm không còn file nào kết thúc bằng `.tmp`.
  3. Test "concurrent settings patches keep both keys": `await Promise.all([store.saveSettings({ textModel: 'a' }), store.saveSettings({ imageModel: 'b' })])`; rồi `getSettings()` có `textModel === 'a'` và `imageModel === 'b'`.
- **Success criteria:** cả hai test pass.
- **Verify:** `npm test` exit 0, output chứa `# fail 0` **và** chứa `# pass N` với N ≥ 1 (glob không khớp file nào cũng exit 0, nên phải có dòng pass).

### Task 3.3 — Autosave tuần tự

- **Goal:** lần lưu sau luôn chạy sau khi lần lưu trước kết thúc, kể cả lần flush khi unmount.
- **Target:** `src/hooks/use-autosave.js`, hàm `useAutosave`.
- **Steps:**
  1. Thêm `const chainRef = useRef(Promise.resolve());` và hàm nội bộ
     ```js
     // Saves run one after another so an older, slower request can never overwrite a newer one.
     const enqueue = (v) => {
       chainRef.current = chainRef.current.catch(() => {}).then(() => saveRef.current(v));
       return chainRef.current;
     };
     ```
  2. Trong `setTimeout` thay `saveRef.current(value)` bằng `enqueue(value)`; giữ nguyên `.then(() => setStatus('saved')).catch(...)`.
  3. Trong effect cleanup khi unmount thay `saveRef.current(pendingRef.current)` bằng `enqueue(pendingRef.current)`.
  4. Cập nhật comment đầu hàm thêm ý "saves are serialized".
- **Success criteria:** mọi đường gọi lưu đều qua `enqueue`.
- **Verify:** `grep -c "saveRef.current(" src/hooks/use-autosave.js` in ra `1` (chỉ còn lời gọi bên trong `enqueue`) **và** `npm run build` exit 0.

## Failure Protocol
If any Verify step does not meet its stated pass condition, STOP this phase.
Do not improvise a fix, retry blindly, or reason around the failure.
Spawn the `kongming` subagent for next-step counsel and pass:
- the phase and task id,
- what you attempted (the steps you ran),
- the exact command and its full output,
- the pass condition it failed to meet.
Apply kongming's guidance, then re-run the Verify step.
If `kongming` cannot be spawned in this environment, STOP and report the same
failure evidence to the user. Never continue by self-reasoning.
