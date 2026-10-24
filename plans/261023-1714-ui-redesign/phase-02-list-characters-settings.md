---
phase: 2
title: "Danh sách truyện dạng lưới thẻ, thẻ nhân vật, trang cài đặt"
status: completed
depends_on: [1]
---

# Phase 2 — Danh sách truyện, Nhân vật, Cài đặt

## Mục tiêu

- Danh sách truyện là lưới thẻ: ảnh bìa (khung đầu tiên đã có ảnh), tên, trạng thái, khổ ảnh, số ảnh, thanh tiến độ "x/y khung có ảnh", ngày sửa.
- Thẻ nhân vật rộng, ô chữ không bị cắt.
- Trang cài đặt gọn gàng.

## File

- `src/components/project-list.jsx`
- `src/components/characters-view.jsx`
- `src/components/settings-view.jsx`: chỉ khi cần đổi className.
- `src/styles.css`

## Tasks

### Task 2.1 — Lấy dữ liệu ảnh bìa và tiến độ ở client

- **Target:** `src/components/project-list.jsx`, hàm `load`.
- **Steps:**
  1. Thêm import `panelImageUrl` từ `../api.js`, và `frameEntries`, `migrateProject` từ `../lib/story-model.js`.
  2. Đổi `load` thành:

     ```js
     // The list endpoint only returns summaries; read each story once to show its cover and drawing progress.
     const load = () =>
       api
         .listProjects()
         .then((list) => Promise.all(list.map((p) => api.getProject(p.id).then((full) => ({ ...p, ...coverInfo(full) })).catch(() => p))))
         .then(setProjects)
         .catch((e) => setError(e.message));
     ```

  3. Thêm phía trên component:

     ```js
     // Old stories use an earlier shape; migrate first, exactly like the editor does when opening one.
     function coverInfo(raw) {
       const frames = frameEntries(migrateProject(raw)).map((e) => e.frame);
       return {
         cover: frames.find((f) => f.selectedImage)?.selectedImage || null,
         frameCount: frames.length,
         drawnCount: frames.filter((f) => f.selectedImage).length,
       };
     }
     ```

- **Verify:** no verification needed (Task 2.4 kiểm).

### Task 2.2 — Lưới thẻ truyện

- **Target:** `src/components/project-list.jsx` (JSX trả về), `src/styles.css`.
- **Steps:**
  1. Đầu trang có tiêu đề `<h2>Truyện của bạn</h2>` và form tạo truyện ngay bên cạnh. Giữ nguyên `placeholder="Tên truyện mới"`, select khổ ảnh và nút `+ Tạo truyện`.
  2. Thay `<div className="list">…</div>` bằng `<div className="project-grid">`. Mỗi truyện là:

     ```jsx
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
     ```

  3. CSS:
     - `.project-grid` dùng `grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))`.
     - `.project-cover` có `aspect-ratio: 9 / 16`; với `.landscape` thì `16 / 9`. Ảnh `object-fit: cover`.
     - `.project-open` không có nền nút, khi hover thì viền đổi màu `--accent`.
     - `.progress` cao 4px; thanh `span` bên trong màu `--success`.
  4. Giữ nguyên dòng chữ khi chưa có truyện nào.
- **Verify:** no verification needed (Task 2.4 kiểm).

### Task 2.3 — Thẻ nhân vật

- **Target:** `src/components/characters-view.jsx` (JSX trả về), `src/styles.css`.
- **Steps:**
  1. Đổi `<div className="grid">` thành `<div className="character-grid">`, với `grid-template-columns: repeat(auto-fill, minmax(520px, 1fr))`.
  2. Mỗi thẻ (`className="card character-card"`) chia hai cột:
     - Cột trái rộng 140px: khối `.thumbs`, ảnh 120×120.
     - Cột phải: ô tên kèm nút `Xoá`; nhãn `Mô tả` (thêm `<span className="label">Mô tả</span>` phía trên textarea mô tả, đặt `rows={5}`); khối "Đặc điểm nhận dạng" giữ nguyên chữ, đặt `rows={3}`.
  3. Không đổi logic: `upload`, `extractTraits`, `update`, `remove` và các handler giữ nguyên.
  4. `settings-view.jsx`: không đổi JSX. Chỉ cần CSS của `.card.narrow` dễ đọc trên nền tối.
- **Verify:** no verification needed (Task 2.4 kiểm).

### Task 2.4 — Kiểm phase 2

- **Steps:**
  1. `npm run build`
  2. `node plans/261023-1714-ui-redesign/capture-screens.mjs plans/261023-1714-ui-redesign/screens/phase-2 --checks > plans/261023-1714-ui-redesign/screens/phase-2.log`

- **Verify:**
  - `npm run build` thoát mã 0.
  - `grep '^CHECK .* FAIL' plans/261023-1714-ui-redesign/screens/phase-2.log | grep -v -E '^CHECK height-(script|frames) FAIL'` không in gì.
  - Ảnh `screens/phase-2/01-project-list.png` tồn tại. Lệnh `grep -c "project-card" src/components/project-list.jsx` in ra số ≥ `1`.

### Task 2.5 — Commit

- **Steps:** `git add src/ && git commit -m "feat(ui): story cover grid and roomier character cards"`
- **Verify:** `git log -1 --pretty=%s` in ra đúng tiêu đề trên.

## Rollback

`git revert HEAD` (hoàn tác commit của phase này).

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
