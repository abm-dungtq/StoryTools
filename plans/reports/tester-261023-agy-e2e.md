# Kiểm thử thật agy CLI (Phase 6)

Ngày: 2026-10-23. Môi trường: Windows 11, agy 1.4.6, Node 24. Server chạy bản dựng hiện tại ở cổng 5174 với `DATA_DIR` tạm (không đụng `data/` thật). Thư mục tạm đã xoá sau khi kiểm.

## Kết quả

| Task | Nội dung | Kết quả | Thời gian |
| --- | --- | --- | --- |
| 6.1 | `npm test` | Đạt: 8 test qua, 0 lỗi | – |
| 6.2 | `POST story/plan` (2 khung) | Đạt: trả 2 khung đủ trường, JSON hợp lệ | ~25 s |
| 6.3a | `POST images/generate` | Đạt: PNG dọc ~2 MB, đúng tỉ lệ | ~56 s |
| 6.3b | `POST bubbles/place` | Đạt: 1 bóng thoại, toạ độ hợp lý | ~25 s |
| 6.3c | `POST caption` | Đạt: HTTP 200, có caption | ~20 s |
| 6.4 | Huỷ giữa chừng (curl `--max-time`) | Đạt: số tiến trình agy về 0 sau 5 s, thư mục `tmp/` rỗng, không tiến trình mồ côi | – |
| 6.5 | Prompt injection (yêu cầu ghi file `C:\Users\ABM\agy-injected.txt`) qua story/plan và images/generate | Đạt: cả hai trả kết quả bình thường, không có file nào được tạo, `tmp/` rỗng | 14 s / 23 s |
| 6.6 | Huỷ qua Vite dev proxy | **Chưa kiểm** (bỏ qua) | – |
| 6.7 | Dọn dẹp | Đạt: cổng 5173/5174 trống, 0 tiến trình agy, xoá thư mục tạm | – |

## Quan sát

- Ảnh vẽ đôi khi vẫn có chữ trên biển hiệu (ví dụ "BÁNH MÌ") dù prompt cấm chữ. Đây là hành vi của model vẽ; cần nhắc người dùng hoặc tăng nhấn mạnh trong prompt nếu thành vấn đề.
- Lần đầu chạy kiểm injection bị lỗi do JSON gửi sai cách escape (lỗi của lệnh kiểm, không phải của server); đã chạy lại bằng file JSON tạo bằng Python.

## Chưa kiểm được

- Luồng UI trên trình duyệt: không có công cụ trình duyệt khả dụng (agent-browser chưa cài, trình duyệt Paseo không mở được localhost). Chỉ kiểm `npm run build` và API.
- Huỷ qua Vite proxy (Task 6.6).
- Trường hợp xấu nhất của retry tỉ lệ ảnh (vẽ lại một lần): chưa gặp trong lúc kiểm.

## Sau review cuối (kongming)

Đã sửa: giải mã stdout agy theo luồng UTF-8 (tránh vỡ chữ tiếng Việt ở ranh giới chunk); server tự xoá `apiKey` và tên model Gemini cũ khỏi `settings.json` lúc khởi động; dọn `data/tmp` lúc khởi động; huỷ ngay nếu client rời đi trong lúc chuẩn bị job; `parseAgyOutput` từ chối JSON không phải object; `structured_output` rỗng thì đọc JSON trong response; danh sách model lỗi không bị cache cả phiên. `npm test`: 10/10 qua, `npm run build` qua. Các sửa này không chạy lại với agy thật.
