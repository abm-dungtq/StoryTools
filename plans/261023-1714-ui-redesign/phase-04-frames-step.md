---
phase: 4
title: "Bước Ảnh: lưới ưu tiên ảnh, prompt thu gọn"
status: completed
depends_on: [1]
---

# Phase 4 — Bước Prompt & ảnh

## Mục tiêu

- Mỗi khung là một thẻ, ảnh ở trên, nút `Tạo ảnh/Tạo lại` và `Tải ảnh lên` ngay dưới ảnh.
- Tóm tắt kịch bản ngắn gọn.
- Prompt thô thu gọn mặc định; bấm `Prompt` mới mở ô sửa và nút `Tạo lại prompt từ kịch bản`.
- Trang truyện test cao không quá 2000px.

## File

- `src/components/frames-step.jsx`
- `src/styles.css`

## Tasks

### Task 4.1 — Thanh công cụ dính trên cùng

- **Target:** `src/components/frames-step.jsx`, `<section className="card row wrap between">` đầu tiên.
- **Steps:**
  1. Thêm class `toolbar`. CSS `.toolbar` gồm `position: sticky; top: 52px; z-index: 5`, nền `--card`, có bóng nhẹ. Phase 1 đã đặt `.topbar { min-height: 52px }`.
  2. Giữ nguyên các nút và nội dung: `Tạo prompt cho tất cả khung`, nút tạo ảnh hàng loạt hoặc trạng thái `Đang tạo…` kèm `Dừng`, checkbox `Gửi kèm ảnh khung trước để giữ phong cách`, `ImageModelSelect`.
- **Verify:** no verification needed (Task 4.4 kiểm).

### Task 4.2 — Lưới thẻ khung

- **Target:** `src/components/frames-step.jsx` (vòng `entries.map`).
- **Steps:**
  1. Thêm state `const [openPrompts, setOpenPrompts] = useState(() => new Set());` và hàm `togglePrompt(id)`, viết giống `toggleFrame` ở phase 3.
  2. Nhóm theo ảnh: mỗi ảnh có tiêu đề `slide-heading` như hiện tại (`Ảnh N`, nhãn bố cục, ý tưởng), rồi một `<div className="frame-grid images">`. CSS: `.frame-grid.images` dùng `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))`. Không dùng `auto-fit` và không tăng 280px: với 2 khung mỗi ảnh, `auto-fit` kéo mỗi thẻ rộng khoảng 730px và trang sẽ vượt giới hạn 2000px.

     Vì `entries` là danh sách phẳng, dựng nhóm như sau:

     ```js
     const groups = project.slides.map((slide, s) => ({ slide, s, items: entries.filter((e) => e.s === s) })).filter((g) => g.items.length);
     ```

  3. Mỗi thẻ khung theo thứ tự:
     1. `.preview` (giữ nguyên `style={{ aspectRatio }}`, ảnh và lớp phủ `Đang tạo ảnh…`);
     2. hàng tiêu đề `frameLabel(...)` kèm `tỉ lệ {aspectRatio}`;
     3. hàng nút `Tạo ảnh`/`Tạo lại` (primary) và `Tải ảnh lên`;
     4. lỗi `errors[frame.id]`;
     5. `.thumbs` ảnh thay thế, chỉ khi có hơn 1 ảnh;
     6. tóm tắt `.frame-summary small`: bối cảnh (clamp 2 dòng), nhân vật, các câu thoại;
     7. nút `<button data-expand aria-expanded={String(open)} onClick={() => togglePrompt(frame.id)}>{open ? 'Ẩn prompt' : 'Prompt'}</button>`;
     8. khi `open`: textarea prompt (giữ `className="mono"`, `placeholder`, `onChange`, `rows={9}`) và nút `Tạo lại prompt từ kịch bản`.
  4. Không đổi các hàm `generate`, `generateMissing`, `uploadImage`, `fillAllPrompts` và các `useRef`.
- **Verify:** `git diff -U0 src/components/frames-step.jsx | grep -E '^[-+].*(generateFrameImage|placeBubblesFromImage|api\.uploadPanelImage|controllerRef\.current = )'` không in gì.

### Task 4.3 — CSS

- **Target:** `src/styles.css`.
- **Steps:**
  1. `.preview` bỏ `max-height: 520px` và dùng chiều rộng thẻ; nền `--surface-2`.
  2. Thêm `.frame-card` nếu phase 3 chưa có.
  3. `.mono` textarea có nền `--bg` và cỡ chữ 0.8rem.
- **Verify:** no verification needed (Task 4.4 kiểm).

### Task 4.4 — Kiểm phase 4

- **Steps:**
  1. `npm run build`
  2. `node plans/261023-1714-ui-redesign/capture-screens.mjs plans/261023-1714-ui-redesign/screens/phase-4 --checks > plans/261023-1714-ui-redesign/screens/phase-4.log`
- **Verify:**
  - `npm run build` thoát mã 0.
  - `grep -c '^CHECK .* FAIL' plans/261023-1714-ui-redesign/screens/phase-4.log` in ra `0`.
  - `grep -c -E '^CHECK (height-frames|labels-frames-collapsed|labels-frames-expanded) PASS' plans/261023-1714-ui-redesign/screens/phase-4.log` in ra `3`.

### Task 4.5 — Commit

- **Steps:** `git add src/ && git commit -m "feat(ui): image-first frame grid with collapsible prompts"`
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
