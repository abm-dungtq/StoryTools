---
phase: 6
title: "Rà UX, cập nhật tài liệu, kiểm cuối"
status: completed
depends_on: [2, 3, 4, 5]
---

# Phase 6 — Rà UX, tài liệu, kiểm cuối

## Mục tiêu

- Rà lại giao diện mới bằng `ak:frontend-design` và chỉ sửa lỗi nằm trong phạm vi plan.
- Tài liệu nói đúng cách dùng mới: khung thu gọn, prompt thu gọn.
- Mọi check đạt.

## File

- `src/styles.css`, `src/components/*.jsx`: chỉ để sửa lỗi phát hiện khi rà.
- `docs/usage-guide.md`
- `docs/huong-dan-su-dung.html`
- `README.md`: chỉ khi có câu mô tả giao diện cũ.
- `plans/261023-1714-ui-redesign/plan.md` và các phase: cập nhật `status`.

## Tasks

### Task 6.1 — Rà UX

- **Steps:**
  1. Gọi skill `ak:frontend-design`, route "Audit UI/UX of a running product" (`references/workflow-ux-audit.md`).
  2. Đầu vào là 7 ảnh trong `plans/261023-1714-ui-redesign/screens/phase-5/`. Trước khi đọc, thu nhỏ thành JPG rộng 1000px:

     ```bash
     python -I -c "
     import sys,os
     from PIL import Image
     d=sys.argv[1]; v=os.path.join(d,'view'); os.makedirs(v,exist_ok=True)
     for f in sorted(os.listdir(d)):
       if f.endswith('.png'):
         im=Image.open(os.path.join(d,f)).convert('RGB'); im=im.resize((1000,int(im.height*1000/im.width))); im.save(os.path.join(v,f[:-4]+'.jpg'),quality=80)
     " plans/261023-1714-ui-redesign/screens/phase-5
     ```

     Đọc các file trong `screens/phase-5/view/` bằng công cụ Read. Nếu một ảnh không đọc được, bỏ qua và ghi chú điều đó vào báo cáo.
  3. Ghi kết quả rà vào `plans/reports/ux-audit-261023-ui-redesign.md`, mỗi lỗi một dòng: màn hình, lỗi, mức độ.
  4. Chỉ sửa lỗi về khoảng cách, căn lề, độ tương phản, thứ bậc chữ, trạng thái hover/focus/disabled. Không thêm tính năng; không sửa file ngoài danh sách "Chỉ sửa" của `plan.md`.
- **Verify:** file `plans/reports/ux-audit-261023-ui-redesign.md` tồn tại: `test -f plans/reports/ux-audit-261023-ui-redesign.md && echo ok` in ra `ok`.

### Task 6.2 — Tài liệu

- **Target:** `docs/usage-guide.md`, `docs/huong-dan-su-dung.html`, `README.md`.
- **Steps:**
  1. Đọc từng file trước khi sửa.
  2. Ở phần bước "1. Kịch bản", thêm một câu: "Mỗi khung hiện dạng thẻ tóm tắt; bấm **Sửa chi tiết** để mở các ô bối cảnh, hành động, biểu cảm và lời thoại."
  3. Ở phần bước "2. Prompt & ảnh", thêm một câu: "Prompt của từng khung được thu gọn; bấm **Prompt** để xem hoặc sửa, và **Tạo lại prompt từ kịch bản** nằm ngay trong đó."
  4. Thêm một câu: "Thanh bước phía trên đánh dấu ✓ cho bước đã xong."
  5. Trong `docs/huong-dan-su-dung.html`, thêm nội dung tương tự bằng `<p>` hoặc `<li>` theo cấu trúc sẵn có.
  6. Chỉ sửa `README.md` nếu nó tả giao diện cũ (ví dụ "nền kem"). Nếu không, để nguyên.
- **Verify:**
  - `grep -c "Sửa chi tiết" docs/usage-guide.md docs/huong-dan-su-dung.html` cho mỗi file số ≥ `1`.
  - `grep -c "Tạo lại prompt từ kịch bản" docs/usage-guide.md` in ra số ≥ `1`.

### Task 6.3 — Kiểm cuối

- **Steps:**
  1. `npm test`
  2. `npm run build`
  3. `node plans/261023-1714-ui-redesign/capture-screens.mjs plans/261023-1714-ui-redesign/screens/final --checks --auto-run > plans/261023-1714-ui-redesign/screens/final.log`
  4. `git diff --name-only $(cat plans/261023-1714-ui-redesign/start-commit.txt) HEAD -- server src/api.js src/hooks src/lib`
- **Verify:**
  - `npm test 2>&1 | grep '^# fail'` in ra `# fail 0`.
  - `npm run build` thoát mã 0.
  - `tail -1 plans/261023-1714-ui-redesign/screens/final.log` in ra `CHECKS FAILED: 0`.
  - Lệnh ở bước 4 chỉ liệt kê `src/lib/step-status.js` và `src/lib/step-status.test.js`.

### Task 6.4 — Commit và đóng plan

- **Steps:**
  1. Đặt `status: completed` trong frontmatter của `plan.md` và của từng phase.
  2. `git status --porcelain | grep -E 'data/|settings\.json|screens/'` phải không in gì.
  3. `git add -A && git commit -m "docs: describe collapsible frame cards and step progress"`
- **Verify:**
  - `git log -1 --pretty=%s` in ra đúng tiêu đề trên.
  - `git status --porcelain` không in gì.

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
