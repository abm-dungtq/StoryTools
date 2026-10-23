---
phase: 5
title: "Cập nhật tài liệu"
status: completed
depends_on: [2, 4]
---

# Phase 5 — Cập nhật tài liệu

## Mục tiêu

Ba bản hướng dẫn mô tả đúng hành vi mới: chạy bằng agy CLI, không API key, không giá tiền, có thời gian ước tính, Dừng là huỷ ngay, đặt thoại lỗi được báo và thử lại.

## File

- `README.md`
- `docs/usage-guide.md`
- `docs/huong-dan-su-dung.html` (bản HTML của README; sửa đúng các đoạn tương ứng, giữ nguyên CSS và cấu trúc)

## Nội dung chung cần viết (dùng cho cả ba file)

- **Khởi động:** cần Node.js 20+ và **agy CLI đã cài và đăng nhập** (`agy --version` chạy được trong terminal). Không cần API key. Nếu `agy` không nằm trong PATH thì đặt `AGY_BIN` trong `.env` (xem `.env.example`).
- **Model:** tab Cài đặt có hai ô. "Model viết kịch bản, đặt lời thoại, caption" mặc định `gemini-4-argon-medium`. "Model điều khiển vẽ ảnh" mặc định `gemini-3.8-flash-low`; agy tự chọn model vẽ thật. Danh sách lấy từ lệnh `agy models`.
- **Chi phí và thời gian** (thay mục "Chi phí và model"): không tính tiền theo lượt; dùng quota của gói agy. Mỗi khung mất khoảng 70–90 giây (vẽ ~75 s, đặt thoại ~15 s), truyện 10 khung khoảng 15 phút, 35 ảnh × 2 khung khoảng 1 giờ 45 phút. Hết quota thì agy báo lỗi và phải chờ quota hồi.
- **Dừng:** bấm Dừng sẽ huỷ ngay khung đang vẽ (không chờ xong). Rời màn hình chỉnh truyện cũng huỷ phần đang chạy. Chạy tiếp bằng nút "Vẽ N khung còn thiếu & đặt thoại".
- **Đặt thoại lỗi:** tool hiện tên các khung chưa đặt được thoại; lần chạy tiếp sẽ thử lại, hoặc bấm ✨ AI đặt thoại ở bước 3. Lần thử lại sẽ thay bóng thoại mẫu của khung đó.
- **Xử lý sự cố** (thay ba dòng Gemini): "Không tìm thấy agy CLI" → cài agy, đăng nhập, đặt `AGY_BIN` nếu cần, khởi động lại server; "agy: không tạo được ảnh" → có thể hết quota hoặc nội dung bị chặn, sửa mô tả khung hoặc chờ rồi vẽ lại; "agy: quá …s không xong" → bấm vẽ lại khung đó.
- **Dữ liệu:** `settings.json` giờ chỉ chứa tên model. File cũ có thể còn trường `apiKey` từ bản trước; tool không dùng nữa, có thể xoá dòng đó.
- **Cấu trúc dự án:** thay dòng `gemini.js` bằng `agy.js` (kịch bản, vẽ ảnh, đặt lời thoại, caption qua agy CLI) và `agy-runner.js` (chạy agy: thư mục job riêng, giới hạn song song, timeout, huỷ). Thêm dòng `npm test` (test server bằng `node:test`).
- Mọi chỗ ghi "Gemini viết/vẽ/xem/gợi ý" đổi thành "AI".

## Tasks

### Task 5.1 — `README.md`

- **Goal:** README đúng với hành vi mới.
- **Steps:** sửa các mục `## Khởi động` (dòng 29–47), `## Nhân vật` (câu nhắc Gemini), `## Tạo truyện tự động` (bước 2 về giá, bước 3 về xác nhận chi phí, đoạn Dừng), `## Chi phí và model` (đổi tiêu đề thành `## Thời gian và model`, cập nhật mục lục dòng 21 và anchor), `## Xử lý sự cố`, `## Dữ liệu và sao lưu`, `## Cấu trúc dự án` theo "Nội dung chung".
- **Verify:** `grep -n "Gemini\|API key\|GEMINI_\|\\$0\." README.md` không in dòng nào (exit code 1), **và** `grep -c "agy" README.md` in ra số lớn hơn hoặc bằng `5`.

### Task 5.2 — `docs/usage-guide.md`

- **Goal:** bản ngắn đúng với hành vi mới.
- **Steps:** sửa dòng 3, 9 (bỏ `GEMINI_API_KEY`, ghi yêu cầu agy), 25–34 (bỏ "chi phí ước tính", đổi Dừng thành huỷ ngay, thêm câu về đặt thoại lỗi), 40, 45, 64, 67–69 (thay bằng hai model agy và thời gian), 73 (đổi `gemini.js` thành `agy.js`, `agy-runner.js`).
- **Verify:** `grep -n "Gemini\|GEMINI_\|\\$0\." docs/usage-guide.md` không in dòng nào (exit code 1).

### Task 5.3 — `docs/huong-dan-su-dung.html`

- **Goal:** bản HTML khớp README.
- **Steps:** sửa các dòng 264, 285 (mục lục, đổi anchor `#chi-phi` thành `#thoi-gian` và id của section tương ứng), 301–303, 346, 359–367, 418, 431, 444, 455–472 (thay bảng giá bằng bảng thời gian: "Vẽ một khung ~75 s", "Đặt thoại một khung ~15 s", "Truyện 10 khung ~15 phút"), 497–504, 528, 533. Giữ nguyên class CSS đang dùng (`num`, bảng, `<code>`).
- **Verify:** `grep -n "Gemini\|API key\|GEMINI_\|\\$0\." docs/huong-dan-su-dung.html` không in dòng nào (exit code 1), **và** `grep -c 'href="#chi-phi"' docs/huong-dan-su-dung.html` in ra `0` (grep -c in `0` thì exit code 1; chỉ xét stdout, exit 1 ở đây là bình thường).

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
