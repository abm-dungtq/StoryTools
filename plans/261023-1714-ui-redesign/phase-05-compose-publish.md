---
phase: 5
title: "Bước Ghép và bước Duyệt & đăng"
status: completed
depends_on: [1]
---

# Phase 5 — Ghép thoại và Duyệt & đăng

## Mục tiêu

- **Bước Ghép:**
  - mỗi khung có một khối điều khiển riêng, tiêu đề `Khung N` hiện đủ;
  - khung vẽ nằm trên nền tối trung tính;
  - ô sửa bóng thoại vẫn hiện đúng chỗ.
- **Bước Duyệt & đăng:**
  - checklist dạng nhãn trạng thái;
  - form chia nhóm `Nội dung bài đăng` / `Đưa lên điện thoại` / `Tải về máy`.

## File

- `src/components/compose-step.jsx`
- `src/components/preview-step.jsx`
- `src/components/publish-panel.jsx`
- `src/styles.css`

## Ràng buộc riêng (đọc trước khi sửa)

- Không đổi phần tử `<canvas>`: giữ `ref`, `width`, `height`, `className`, mọi handler.
- Không đổi `<textarea className="bubble-editor">` hay các hàm `toCanvasPoint`, `onPointerDown`, `onPointerMove`, `onDoubleClick`, `commitEdit`, `aiPlace`, `exportCurrent`.
- `.compose-canvas` không được có padding, border, transform. Không phần tử cha nào của canvas có `transform`. `.compose-canvas-wrap` giữ `position: relative`; được đổi màu nền và padding.

## Tasks

### Task 5.1 — Thanh bên của bước Ghép

- **Target:** `src/components/compose-step.jsx` (khối `<aside>`).
- **Steps:**
  1. Khối "Chọn ảnh": các nút `.seg` (đã đổi ở phase 1) nằm trong `<div className="seg-group">`.
  2. Khối "Bóng thoại": giữ nguyên phần sửa bóng đang chọn và đoạn hướng dẫn. Thay vòng `slide.frames.map` bằng:

     ```jsx
     <div key={frame.id} className="frame-card stack tight">
       <strong className="small">{multi ? `Khung ${i + 1}` : 'Ảnh này'}</strong>
       <div className="row wrap">
         {/* giữ nguyên 3 nút: ✨ AI đặt thoại, + Bóng, Đặt lại — cùng props và onClick như hiện tại */}
       </div>
     </div>
     ```

     Chép nguyên 3 phần tử `<button>` hiện có vào trong `row wrap`, không đổi thuộc tính nào.
  3. Khối xuất: giữ nút `Tải PNG ảnh này` và dòng kích thước.
- **Verify:** `git diff -U0 src/components/compose-step.jsx | grep -E '^[-+].*(canvasRef|wrapRef|onPointer|onDoubleClick|bubble-editor|getBoundingClientRect)'` không in gì.

### Task 5.2 — CSS bước Ghép

- **Target:** `src/styles.css`.
- **Steps:**
  1. `.compose-canvas-wrap`: nền `--bg`, viền vẽ bằng `box-shadow: inset 0 0 0 1px var(--border)`. Không dùng `border`, vì border làm ô sửa bóng thoại lệch đúng bằng bề dày viền. Giữ `position: relative`, `display: flex`, `justify-content: center`.
  2. `.compose-canvas`: chỉ giữ `touch-action`, `box-shadow`, `cursor` và kích thước như cũ. Không thêm border hay padding.
  3. `.bubble-editor`: nền sáng (`#fffdf7`) và chữ tối (`#2b2118`), vì nó đè lên bóng thoại trắng trong tranh.
  4. `.seg-group` hiển thị các `.seg` liền nhau như một nút chuyển nhiều lựa chọn.
- **Verify:** no verification needed (Task 5.4 kiểm).

### Task 5.3 — Bước Duyệt & đăng

- **Target:** `src/components/publish-panel.jsx`, `src/components/preview-step.jsx`, `src/styles.css`.
- **Steps:**
  1. `publish-panel.jsx`:
     - Ba nút trạng thái (`.seg`) nằm trong `<div className="seg-group">`.
     - Checklist `<ul className="small checklist">` đổi thành `<ul className="status-list">`. Mỗi `<li>` có class `ok` hoặc `warning` theo điều kiện hiện có; giữ nguyên chữ của từng dòng.
     - Cột trái có `<h4>Nội dung bài đăng</h4>` ở đầu. Cột phải có `<h4>Đưa lên điện thoại</h4>` thay cho `<div className="label">Đưa ảnh sang điện thoại</div>`, và `<h4>Tải về máy</h4>` thay cho `<div className="label">Hoặc tải về máy</div>`.
     - Danh sách hướng dẫn `<ol>` cuối cùng đặt trong `<details><summary>Cách đăng lên TikTok</summary>…</details>`.
     - Không đổi các hàm `run`, `writeCaption`, `copy`, `setStatus`, `startShare`, `stopShare`, `exportFiles`.
  2. `preview-step.jsx`: không đổi logic. Chỉ được đổi className nếu cần cho CSS.
  3. CSS:
     - `.status-list` hiện các mục như nhãn bo tròn: `ok` màu `--success`, `warning` màu `--warning`, chữ đủ tương phản.
     - `.viewer` nền `--bg`.
     - `.strip-item.active` viền `--accent`.
     - `h4` có `margin: 0; font-size: 0.9rem`.
- **Verify:** `git diff -U0 src/components/publish-panel.jsx | grep -E '^[-+].*(api\.generateCaption|api\.startShare|api\.stopShare|pngBlobsToPdf|navigator\.clipboard)'` không in gì.

### Task 5.4 — Kiểm phase 5

- **Steps:**
  1. `npm run build`
  2. `node plans/261023-1714-ui-redesign/capture-screens.mjs plans/261023-1714-ui-redesign/screens/phase-5 --checks > plans/261023-1714-ui-redesign/screens/phase-5.log`
- **Verify:**
  - `npm run build` thoát mã 0.
  - `tail -1 plans/261023-1714-ui-redesign/screens/phase-5.log` in ra `CHECKS FAILED: 0`.
  - `grep -c -E '^CHECK (compose-canvas-geometry|bubble-editor-align) PASS' plans/261023-1714-ui-redesign/screens/phase-5.log` in ra `2`.

### Task 5.5 — Commit

- **Steps:** `git add src/ && git commit -m "feat(ui): tidy compose sidebar and grouped publish panel"`
- **Verify:** `git log -1 --pretty=%s` in ra đúng tiêu đề trên.

## Rollback

`git revert HEAD`.

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
