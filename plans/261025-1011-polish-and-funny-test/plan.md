---
title: "Xử lý các vấn đề còn tồn sau đợt thiết kế lại giao diện, rồi chạy thử truyện hài 15 ảnh"
status: in-progress
created: 2026-10-25
mode: advice (kongming opus/high)
---

# Polish UI + chạy thử truyện hài 15 ảnh

## Mục tiêu

1. Sửa 4 lỗi nhỏ trong `plans/reports/ux-audit-261023-ui-redesign.md`.
2. Kiểm cả những trường hợp chưa được kiểm: khổ ngang, màn hẹp dưới 1000px, trạng thái trống và di chuyển bằng phím Tab.
3. Commit journal còn chưa được theo dõi.
4. Chạy thử trọn một truyện hài 15 ảnh với Minh: khổ dọc, `framesPerSlide: 'auto'`.

## Đã xong

- Đã sửa mô tả của Minh cho khớp ảnh mẫu. Bản sao lưu ở `data/characters.backup-261025.json`.
- Đã tạo truyện test khổ ngang `[Test] khổ ngang` bằng [clone-landscape-story.mjs](clone-landscape-story.mjs).

## Phase

| # | Nội dung | Trạng thái |
| --- | --- | --- |
| 1 | Sửa lỗi UI và mở rộng `capture-screens.mjs`: `--story`, `--width`, `--base`, `--empty`, kiểm focus và cuộn ngang | completed |
| 2 | Chạy truyện hài 15 ảnh bằng `run-test-job.mjs` (xem dưới) | in-progress |

## Tiêu chí hoàn thành

- `capture-screens.mjs --checks` in `CHECKS FAILED: 0` cho cả 4 trường hợp:
  - truyện dọc ở 1440px;
  - truyện ngang ở 1440px;
  - truyện dọc ở 900px;
  - dữ liệu trống.
- `npm test` báo 0 test hỏng, `npm run build` thoát mã 0.
- Truyện hài có đủ 15 ảnh. Mọi khung đều có ảnh đã chọn và bóng thoại; nếu thiếu, phải ghi rõ khung nào và vì sao.

## Cách chạy truyện hài

Lần chạy đầu dừng ở Ảnh 7 vì agy hết hạn mức vẽ ảnh. Lần chạy thứ hai tiếp tục trên cùng project và tự chờ cho tới khi quota hồi.

```bash
TEST_TITLE='[Test] Minh làm đầu bếp (hài, 15 ảnh)' TEST_IDEA='<cốt truyện hài>' TEST_SLIDES=15 TEST_FRAMES=auto   node plans/261023-1613-test-job/run-test-job.mjs > plans/261025-1011-polish-and-funny-test/funny-run.log
TEST_PROJECT_ID=caba2bdbfde4 TEST_ATTEMPTS=30 TEST_RETRY_WAIT=600   node plans/261023-1613-test-job/run-test-job.mjs > plans/261025-1011-polish-and-funny-test/funny-run-2.log
```

## Ghi chú kiểm tra

- Giới hạn chiều cao trang (`height-script`, `height-frames`) chỉ áp từ 1200px trở lên. Ở 900px, cột xếp chồng nên trang cao hơn là đúng thiết kế; công cụ in dòng `INFO` thay vì `CHECK`.
- Ngoài phạm vi, ghi lại để làm sau: nút "Tải ảnh lên" là `<label>` bọc input `hidden` nên không Tab tới được; dưới khoảng 600px thẻ khung ở bước Ảnh bị ép cột chữ.
