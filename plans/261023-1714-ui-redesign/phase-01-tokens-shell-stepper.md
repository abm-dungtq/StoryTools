---
phase: 1
title: "Bảng màu tối, thanh trên cùng, thanh 4 bước có trạng thái"
status: completed
depends_on: []
---

# Phase 1 — Màu, khung app và thanh bước

## Mục tiêu

- Toàn app dùng bảng màu tối theo design brief trong `plan.md`.
- Thanh trên cùng và thanh 4 bước trông như điều hướng thật; bước nào đã xong có dấu ✓.
- Mọi chữ đạt độ tương phản yêu cầu.

## File

- `.gitignore`
- `src/styles.css`
- `src/app.jsx`
- `src/components/project-editor.jsx`
- `src/components/compose-step.jsx`: chỉ đổi className của nút chọn ảnh.
- `src/components/publish-panel.jsx`: chỉ đổi className của nút trạng thái.
- Tạo mới `src/lib/step-status.js` và `src/lib/step-status.test.js`.

## Chuẩn bị

1. Kiểm app đang chạy:

   ```bash
   curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5173/api/projects
   ```

   Lệnh phải in `200`. Nếu không, khởi động nền `npm run dev` từ thư mục gốc repo (dùng chế độ chạy nền của harness, timeout 7200000) và ghi lại PID của cổng 5173 và 5174 (`netstat -ano | grep -E '127.0.0.1:(5173|5174) .*LISTENING'`).
2. Vite tự áp thay đổi CSS/JSX (HMR), không cần khởi động lại app. `npm run build` chỉ để kiểm biên dịch.
3. Trước mỗi lần chạy `capture-screens.mjs`, chạy `netstat -ano | grep ':9333 .*LISTENING'`. Nếu có, đó là Chrome headless còn sót từ lần chạy trước của chính bạn: dừng nó bằng `MSYS_NO_PATHCONV=1 taskkill /T /F /PID <pid>`.
4. Trong mọi bước Verify của plan: `grep` thoát mã 1 khi không khớp dòng nào. Đó là kết quả mong đợi khi điều kiện là "không in gì" hoặc "in ra `0`". Chỉ dựa vào chữ được in ra để phán đoán.
5. Ghi lại commit hiện tại:

   ```bash
   git rev-parse HEAD > plans/261023-1714-ui-redesign/start-commit.txt
   ```

## Tasks

### Task 1.1 — Không đưa ảnh chụp vào git

- **Target:** `.gitignore`.
- **Steps:** thêm một dòng `plans/**/screens/` vào cuối file.
- **Verify:** `git check-ignore plans/261023-1714-ui-redesign/screens/baseline/01-project-list.png` in ra đúng đường dẫn đó và thoát mã 0.

### Task 1.2 — Đọc skill thiết kế

- **Steps:**
  1. Gọi skill `ak:frontend-design`.
  2. Theo route "Preserve or improve existing UI", đọc `references/product-ui-patterns.md` của skill.
  3. Dùng nguyên design brief trong `plan.md`. Không viết brief mới.
- **Verify:** no verification needed.

### Task 1.3 — Bảng màu và kiểu cơ bản

- **Target:** `src/styles.css`.
- **Steps:**
  1. Thay khối `:root` bằng các biến theo brief. Giữ các tên biến cũ vì CSS hiện có đang dùng chúng: `--bg`, `--card`, `--border`, `--text`, `--muted`, `--primary`, `--primary-hover`, `--danger`, `--accent`.
     - Gán `--card` bằng giá trị surface của brief.
     - `--primary` là màu accent của brief; `--accent: var(--primary)`; `--primary-hover: oklch(0.8 0.15 55)`.
     - Thêm `--surface-2`, `--on-primary` (giá trị "chữ trên accent" của brief), `--warning`, `--success`, `--info`, `--radius: 8px`.
     - Đặt `color-scheme: dark;` và `font-size: 15px`.
  2. Viết lại các màu đang gán cứng cho đủ các selector sau:
     - `.topbar`, `.topbar .tab`, `.topbar .tab.active`, `.tab.active`, `.chip.active`;
     - `.banner`, `.banner.error`, `.banner.warning`, `.warning`, `.badge`, `.badge.approved`, `.badge.posted`;
     - `.progress-pill`, `.overlay`, `.thumb-add`, `.preview`, `.viewer`, `.viewer .nav`, `.dot`, `.strip-item`, `.compose-canvas-wrap`, `.qr`;
     - nền `button`, `input`, `select`, `textarea` (hiện là `#fff` và `#f3ecdf`) đổi sang `var(--surface-2)` và `var(--card)`.

     Tất cả phải dùng biến. Riêng `.qr` giữ nền trắng để quét được mã. Đặt `.topbar { min-height: 52px; }` để phase 4 dùng được con số này.

     **Quy tắc tương phản (bắt buộc):**
     - Chữ đặt trên nền có màu (`--primary`, `--success`, `--warning`, `--danger`, `--info`) luôn dùng `color: var(--on-primary)`, không bao giờ dùng chữ trắng.
     - Nhãn trạng thái (`.badge.*`) dùng màu trạng thái làm màu chữ và viền, nền là `--surface-2`.
  3. `button.primary` dùng `background: var(--primary); color: var(--on-primary)`.
  4. `input`, `textarea`, `button` có `:focus-visible` với viền 2px màu `var(--accent)`.
  5. Thêm class `.seg` (nhóm nút chuyển kiểu segmented) và `.seg.active` có giao diện riêng, không phụ thuộc `.tab`.
  6. Không đổi các thuộc tính kích thước hay vị trí của `.compose-canvas` và `.compose-canvas-wrap`; chỉ được đổi màu nền của `.compose-canvas-wrap`.
- **Success criteria:** app hiện nền tối, chữ sáng.
- **Verify:** no verification needed (Task 1.7 kiểm).

### Task 1.4 — Hàm trạng thái từng bước

- **Target:** tạo `src/lib/step-status.js`.
- **Steps:** tạo file với đúng nội dung sau:

  ```js
  // Which editor steps a story has finished, derived only from its saved data (no extra fields).
  import { frameEntries, hasFrameContent } from './story-model.js';

  const hasDialogue = (frame) => frame.dialogues?.some((d) => d.text?.trim());

  export function stepStatus(project) {
    const frames = frameEntries(project).map((e) => e.frame);
    const script = frames.length > 0 && project.slides.every((s) => s.frames.some(hasFrameContent));
    const images = script && frames.every((f) => f.selectedImage);
    const compose = images && frames.every((f) => !hasDialogue(f) || (Array.isArray(f.bubbles) && !f.bubblePlacementFailed));
    return { script, frames: images, compose, preview: project.publish?.status === 'posted' };
  }
  ```

- **Verify:** no verification needed (Task 1.5 kiểm).

### Task 1.5 — Test hàm trạng thái

- **Target:** tạo `src/lib/step-status.test.js`.
- **Steps:** tạo file với đúng nội dung sau:

  ```js
  import { test } from 'node:test';
  import assert from 'node:assert/strict';
  import { stepStatus } from './step-status.js';

  const frame = (patch) => ({ id: 'f', characterIds: [], dialogues: [], scene: 'x', ...patch });
  const story = (frames, publish) => ({ orientation: 'portrait', slides: [{ id: 's', layoutId: 'p1', frames }], publish });

  test('empty story has nothing done', () => {
    assert.deepEqual(stepStatus({ orientation: 'portrait', slides: [] }), { script: false, frames: false, compose: false, preview: false });
  });

  test('script done but images missing', () => {
    assert.deepEqual(stepStatus(story([frame({})])), { script: true, frames: false, compose: false, preview: false });
  });

  test('frame with dialogue needs bubbles that did not fail', () => {
    const spoken = { dialogues: [{ text: 'Chào' }], selectedImage: 'a.png' };
    assert.equal(stepStatus(story([frame({ ...spoken, bubbles: null })])).compose, false);
    assert.equal(stepStatus(story([frame({ ...spoken, bubbles: [], bubblePlacementFailed: true })])).compose, false);
    assert.equal(stepStatus(story([frame({ ...spoken, bubbles: [{ id: 'b' }] })])).compose, true);
  });

  test('posted story finishes the last step', () => {
    assert.equal(stepStatus(story([frame({ selectedImage: 'a.png' })], { status: 'posted' })).preview, true);
  });
  ```

- **Verify:** `npm test 2>&1 | grep -E '^# (pass|fail)'` in ra `# pass 19` và `# fail 0`. Nếu `fail` là 0 nhưng `pass` khác 19, ghi lại con số thật và đi tiếp. Nếu `fail` khác 0, áp dụng Failure Protocol.

### Task 1.6 — Thanh trên cùng và thanh bước

- **Target:** `src/app.jsx` (`App`), `src/components/project-editor.jsx` (`ProjectEditor`, `STEPS`).
- **Steps:**
  1. Trong `app.jsx`, giữ nguyên các nút tab `Truyện`, `Nhân vật`, `Cài đặt`. Thêm `aria-current="page"` cho nút đang mở. Có thể đổi emoji ở brand.
  2. Trong `project-editor.jsx`:
     - thêm `import { stepStatus } from '../lib/step-status.js';`;
     - tính `const done = stepStatus(project);` sau dòng `if (!project) …`;
     - thay khối `<div className="steps">…</div>` bằng:

       ```jsx
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
       ```

       `s.label.slice(3)` bỏ phần "1. " nên nút vẫn có chữ `Kịch bản`, `Prompt & ảnh`, `Lời thoại & ghép`, `Duyệt & đăng`.
  3. Sắp lại phần đầu của trình sửa: hàng trên có nút `← Danh sách`, ô tiêu đề và trạng thái lưu; hàng dưới là `.stepper` trải hết chiều ngang. Giữ nguyên khối `progress-pill`.
  4. Trong `styles.css`, thêm `.stepper`, `.step`, `.step.active`, `.step.done`, `.step-mark` (vòng tròn chứa số hoặc ✓). Cụ thể:
     - `.step.done .step-mark { background: var(--success); color: var(--on-primary); }`
     - `.step.active .step-mark { background: var(--primary); color: var(--on-primary); }`
     - `.seg.active { background: var(--primary); color: var(--on-primary); }`
  5. Trong `compose-step.jsx`, đổi `className={`tab ${i === current ? 'active' : ''}`}` thành `className={`seg ${i === current ? 'active' : ''}`}`. Trong `publish-panel.jsx`, đổi `className={`tab ${publish.status === s.id ? 'active' : ''}`}` thành `className={`seg ${publish.status === s.id ? 'active' : ''}`}`. Không đổi gì khác trong hai file này.
- **Verify:** no verification needed (Task 1.7 kiểm).

### Task 1.7 — Kiểm phase 1

- **Steps:**
  1. `npm run build`
  2. `node plans/261023-1714-ui-redesign/capture-screens.mjs plans/261023-1714-ui-redesign/screens/phase-1 --checks > plans/261023-1714-ui-redesign/screens/phase-1.log`
- **Verify:**
  - `npm run build` thoát mã 0.
  - `grep FAIL plans/261023-1714-ui-redesign/screens/phase-1.log | grep -v -E 'height-(script|frames)'` không in gì.
  - `grep -c '^CHECK stepper PASS' plans/261023-1714-ui-redesign/screens/phase-1.log` in ra `1`.

### Task 1.8 — Commit

- **Steps:** `git add .gitignore src/ && git commit -m "feat(ui): dark studio theme and step progress bar"`
- **Verify:** `git log -1 --pretty=%s` in ra `feat(ui): dark studio theme and step progress bar`.

## Rollback

`git reset --hard $(cat plans/261023-1714-ui-redesign/start-commit.txt)`. Chỉ làm khi người dùng đồng ý.

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
