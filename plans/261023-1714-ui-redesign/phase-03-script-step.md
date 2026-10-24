---
phase: 3
title: "Bước Kịch bản: khối tự động nổi bật, khung thu gọn được"
status: completed
depends_on: [1]
---

# Phase 3 — Bước Kịch bản

## Mục tiêu

- Khối "Tự động tạo truyện" nằm trên cùng, nút chính nổi bật.
- Mỗi ảnh hiện các khung dạng thẻ gọn: tóm tắt bối cảnh, người xuất hiện, câu thoại đầu.
- Bấm "Sửa chi tiết" thì mở đủ các ô (bối cảnh, hành động, biểu cảm, nhân vật, lời thoại).
- Trang truyện test cao không quá 1600px.

## File

- `src/components/script-step.jsx`
- `src/components/frame-fields.jsx`
- `src/styles.css`

## Tasks

### Task 3.1 — Đổi thứ tự và bố cục hai khối đầu

- **Target:** `src/components/script-step.jsx` (JSX trả về).
- **Steps:**
  1. Đặt `<section>` "🤖 Tự động tạo truyện" lên trước "Thiết lập truyện", và cho nó class `card stack hero`.
  2. Trong khối tự động:
     - textarea `Cốt truyện` vẫn nằm trong `<label>` có chữ `Cốt truyện`;
     - các ô `Số ảnh`, `Khung mỗi ảnh`, checkbox và `ImageModelSelect` nằm trên một hàng `row wrap`;
     - nút `Tự động tạo cả truyện` (hoặc `Viết kịch bản`) dùng class `primary large`.

     Giữ nguyên `progress-pill`, `automation.error` và đoạn giải thích.
  3. "Thiết lập truyện" thành một khối gọn: khổ ảnh, các chip nhân vật và ô phong cách vẽ nằm trên hai cột.
  4. CSS: `.hero` có viền trái 3px màu `--accent`; `button.large` có padding lớn hơn và cỡ chữ 1rem.
- **Verify:** no verification needed (Task 3.4 kiểm).

### Task 3.2 — Thẻ khung thu gọn được

- **Target:** `src/components/script-step.jsx` (vòng `slide.frames.map`), `src/components/frame-fields.jsx`.
- **Steps:**
  1. Trong `ScriptStep`, thêm state `const [expanded, setExpanded] = useState(() => new Set());` và hàm:

     ```js
     const toggleFrame = (id) =>
       setExpanded((s) => {
         const next = new Set(s);
         if (next.has(id)) next.delete(id);
         else next.add(id);
         return next;
       });
     ```

  2. Thay vòng render `FrameFields` bằng một lưới `<div className="frame-grid">`, với `grid-template-columns: repeat(auto-fill, minmax(320px, 1fr))`. Khung đang mở (`isOpen`) chiếm cả hàng (`grid-column: 1 / -1`). Một khung được coi là mở khi `expanded.has(frame.id) || !hasFrameContent(frame)`, nghĩa là khung trống luôn mở để gõ được ngay.
  3. Mỗi khung:

     ```jsx
     const isOpen = expanded.has(frame.id) || !hasFrameContent(frame);
     <div key={frame.id} className={`frame-card ${isOpen ? 'open' : ''}`}>
       <div className="row between">
         <strong className="small">{n > 1 ? `Khung ${j + 1}` : 'Khung'}</strong>
         {hasFrameContent(frame) && (
           <button data-expand aria-expanded={String(isOpen)} onClick={() => toggleFrame(frame.id)}>
             {isOpen ? 'Thu gọn' : 'Sửa chi tiết'}
           </button>
         )}
       </div>
       {isOpen ? (
         <FrameFields frame={frame} cast={cast} updateFrame={updateFrame} />
       ) : (
         <div className="frame-summary small">
           <p className="clamp-2">{frame.scene || frame.action || '—'}</p>
           <p className="muted">{frame.characterIds.map((id) => cast.find((c) => c.id === id)?.name).filter(Boolean).join(', ') || 'Không có nhân vật'}</p>
           {frame.dialogues[0]?.text && <p className="clamp-2">“{frame.dialogues[0].text}”</p>}
         </div>
       )}
     </div>
     ```

     Khi một khung trống được gõ nội dung, `hasFrameContent` thành `true`. Để khung đó không tự thu gọn khi đang gõ, thêm `frame.id` vào `expanded` ngay khi nó được render mở vì trống:

     ```js
     useEffect(() => {
       const empty = project.slides.flatMap((s) => s.frames).filter((f) => !hasFrameContent(f)).map((f) => f.id);
       if (empty.length) setExpanded((s) => (empty.every((id) => s.has(id)) ? s : new Set([...s, ...empty])));
     }, [project.slides]);
     ```

     Thêm `useEffect` vào import `react`.
  4. `FrameFields`: prop `title` vẫn được hỗ trợ nhưng không truyền nữa. Đổi class gốc từ `frame-box stack` thành `stack`, vì viền giờ do `.frame-card` vẽ.
  5. Hàng tiêu đề của mỗi ảnh: `Ảnh N`, select bố cục, ↑, ↓, `Xoá`. Lỗi `errors[slide.id]` vẫn hiện cạnh nút `AI viết N khung`. Textarea ý tưởng của ảnh đặt `rows={2}`.
  6. CSS:
     - `.frame-card` dùng nền `--surface-2`, bo góc `--radius`, padding 12px;
     - `.clamp-2` có `display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin: 0`;
     - textarea trong `.fields-grid` có `min-height: 4.5em`.
- **Verify:** no verification needed (Task 3.4 kiểm).

### Task 3.3 — Không đổi logic

- **Steps:** đọc lại diff, `git diff src/components/script-step.jsx`, và xác nhận các hàm sau không đổi thân hàm:
  - `startAutomation`
  - `resumeAutomation`
  - `writeFrames`
  - `writeAllEmpty`
  - `changeLayout`
  - `moveSlide`
- **Verify:** `git diff -U0 src/components/script-step.jsx | grep -E '^[-+].*(api\.generateFrames|automation\.runAll|automation\.writeStory|automation\.fillFrames|fitFrames\(frames)'` không in gì.

### Task 3.4 — Kiểm phase 3

- **Steps:**
  1. `npm run build`
  2. `node plans/261023-1714-ui-redesign/capture-screens.mjs plans/261023-1714-ui-redesign/screens/phase-3 --checks --auto-run > plans/261023-1714-ui-redesign/screens/phase-3.log` (mất khoảng 3–5 phút).
- **Verify:**
  - `npm run build` thoát mã 0.
  - `grep '^CHECK .* FAIL' plans/261023-1714-ui-redesign/screens/phase-3.log | grep -v '^CHECK height-frames FAIL'` không in gì.
  - `grep -c -E '^CHECK (height-script|auto-run|labels-script) PASS' plans/261023-1714-ui-redesign/screens/phase-3.log` in ra `3`.

### Task 3.5 — Commit

- **Steps:** `git add src/ && git commit -m "feat(ui): compact script step with collapsible frame cards"`
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
