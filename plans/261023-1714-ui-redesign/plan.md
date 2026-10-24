---
title: "Thiết kế lại giao diện StoryTools theo phong cách studio tối"
status: completed
created: 2026-10-23
mode: advice
source: plans/reports/brainstorm-261023-1714-ui-redesign.md
---

# Thiết kế lại giao diện StoryTools

Plan này viết cho executor chạy lần lượt từng phase. Mỗi phase có Failure Protocol riêng: khi một bước Verify không đạt, dừng lại và hỏi `kongming`, không tự đoán cách sửa.

## Mục tiêu

Mọi màn hình chuyển sang phong cách studio tối, bố cục gọn và dễ hiểu hơn. Bốn bước, mọi chức năng và mọi nhãn tiếng Việt được giữ nguyên.

Chi tiết, lựa chọn đã cân nhắc và rủi ro nằm ở [brainstorm-261023-1714-ui-redesign.md](../reports/brainstorm-261023-1714-ui-redesign.md).

## Design brief (cố định, mọi phase dùng chung)

Dùng skill `ak:frontend-design` theo route "Preserve or improve existing UI" (Product register) với brief này:

```text
Register:  Product
Scene:     một người làm truyện TikTok, máy bàn màn 1440px trở lên, buổi tối, chờ AI vẽ lâu và cần lướt nhanh qua nhiều khung.
Direction: studio tối, vì tranh màu nước ấm phải là thứ sáng nhất trên màn hình.
Color:     Restrained; bg oklch(0.17 0.008 60), surface oklch(0.21 0.008 60), surface-2 oklch(0.25 0.01 60),
           border oklch(0.32 0.01 60), text oklch(0.94 0.008 80), muted oklch(0.74 0.012 70),
           accent oklch(0.74 0.15 55) với chữ trên accent oklch(0.2 0.03 55),
           danger oklch(0.72 0.17 25), warning oklch(0.84 0.13 85), success oklch(0.78 0.13 150), info oklch(0.76 0.11 245).
Type:      chỉ Be Vietnam Pro (400/500/600/700, đã cài qua @fontsource); tỉ lệ 1.2; cỡ chữ gốc 15px.
Signature: thẻ khung có ảnh thật và dấu trạng thái, cùng thanh 4 bước có dấu ✓ cho bước đã xong.
Dials:     variance 3, motion 2, density 6.
```

## Ràng buộc chung (áp dụng cho mọi phase)

- **Chỉ sửa:**
  - `src/styles.css`, `src/app.jsx`, `src/components/*.jsx`;
  - file mới `src/lib/step-status.js` và `src/lib/step-status.test.js`;
  - `.gitignore`;
  - tài liệu ở phase 6;
  - file trong thư mục plan này.
- **Không sửa:** `server/`, `src/api.js`, `src/hooks/`, các file đã có trong `src/lib/`, cấu trúc dữ liệu.
- Không thêm thư viện, chỉ dùng CSS thuần.
- **Khung vẽ ở bước 3:**
  - `canvas.compose-canvas` không có padding, border, transform;
  - không phần tử cha nào có `transform`;
  - `.compose-canvas-wrap` giữ `position: relative`;
  - giữ nguyên `ref`, các handler pointer và double-click.
- **Các "móc" mà công cụ kiểm tra dùng phải còn nguyên:**
  - Nút ở thanh trên cùng có chữ `Truyện`, `Nhân vật`, `Cài đặt`.
  - Nút bước có chữ chứa `Kịch bản`, `Prompt & ảnh`, `Lời thoại & ghép`, `Duyệt & đăng`. Mỗi nút có `data-step="script|frames|compose|preview"` và `data-done="true|false"`; hai thuộc tính này thêm ở phase 1.
  - Ô tên truyện có `placeholder="Tên truyện mới"`, nút có chữ `Tạo truyện`.
  - Thẻ `<label>` bọc đúng control của `Cốt truyện` (textarea), `Số ảnh` (input) và `Khung mỗi ảnh` (select).
  - Nút thu gọn/mở rộng có `data-expand` và `aria-expanded="true|false"`.
- Không xoá dữ liệu thật. Công cụ `--auto-run` tự xoá đúng truyện `[Test UI] …` mà nó tạo.
- Commit theo conventional commits, không nhắc tới AI. Trả lời người dùng bằng tiếng Việt.
- Chỉ dừng tiến trình mình đã khởi động.

## Công cụ kiểm tra (đã viết và chạy thử trên giao diện cũ)

Lệnh: `node plans/261023-1714-ui-redesign/capture-screens.mjs <thư-mục-ảnh> --checks [--auto-run]`. Chạy từ thư mục gốc repo, app phải đang chạy ở cổng 5173 và 5174.

Công cụ chụp 7 màn hình và in các dòng `CHECK <tên> PASS|FAIL`, cuối cùng là `CHECKS FAILED: <n>`:

| Check | Nội dung |
| --- | --- |
| `labels-*` | Các nhãn và nút chính phải hiện trên màn hình |
| `contrast-*` | Chữ trên nền đạt tỉ lệ tương phản WCAG ≥ 4.5 |
| `stepper` | Truyện test đã xong cho kết quả `script/frames/compose = true`, `preview = false` |
| `height-script` | Trang bước Kịch bản cao không quá 1600px |
| `height-frames` | Trang bước Ảnh cao không quá 2000px |
| `compose-canvas-geometry` | Hình học của khung vẽ đúng ràng buộc |
| `bubble-editor-align` | Nhấp đúp thật vào bóng thoại và đo vị trí ô sửa |
| `auto-run` | Chạy "Tự động tạo cả truyện" qua giao diện, 1 ảnh 1 khung, khoảng 2–3 phút |

Kết quả trên giao diện cũ (`screens/baseline`), tức điểm xuất phát:
- PASS: mọi `labels-*`, `compose-canvas-geometry`, `bubble-editor-align`, `auto-run`.
- FAIL: mọi `contrast-*`, `height-script` (2479px), `height-frames` (2815px), `stepper`.

Truyện test bắt buộc phải có: `[Test] Minh và chú mèo dưới mưa` (id `bd58ad80dd3c`, đã có trong `data/`).

## Phase

| # | File | Nội dung | Phụ thuộc |
| --- | --- | --- | --- |
| 1 | [phase-01-tokens-shell-stepper.md](phase-01-tokens-shell-stepper.md) | Bảng màu tối, thanh trên cùng, thanh 4 bước có trạng thái, `step-status.js` kèm test | – |
| 2 | [phase-02-list-characters-settings.md](phase-02-list-characters-settings.md) | Danh sách truyện dạng lưới thẻ có ảnh bìa và tiến độ, thẻ nhân vật, cài đặt | 1 |
| 3 | [phase-03-script-step.md](phase-03-script-step.md) | Bước Kịch bản: khối tự động đặt nổi bật, khung thu gọn được | 1 |
| 4 | [phase-04-frames-step.md](phase-04-frames-step.md) | Bước Ảnh: lưới ưu tiên ảnh, prompt thu gọn | 1 |
| 5 | [phase-05-compose-publish.md](phase-05-compose-publish.md) | Bước Ghép (giữ hình học khung vẽ) và bước Duyệt & đăng | 1 |
| 6 | [phase-06-audit-docs-commit.md](phase-06-audit-docs-commit.md) | Rà UX bằng `ak:frontend-design`, cập nhật tài liệu, kiểm cuối | 2–5 |

## Tiêu chí hoàn thành

1. Lệnh `capture-screens.mjs … --checks --auto-run` in `CHECKS FAILED: 0`.
2. `npm test` in `# fail 0` và `npm run build` thoát mã 0.
3. Có ảnh chụp 7 màn hình trước (`screens/baseline`) và sau (`screens/final`).
4. Ảnh PNG/PDF xuất ra không đổi, vì không file nào trong `src/lib/` cũ bị sửa: `git diff --name-only <commit đầu> HEAD -- src/lib server src/api.js src/hooks` chỉ liệt kê `src/lib/step-status*.js`.
5. Mỗi phase có một commit riêng.

## Ngoài phạm vi

- Tính năng mới.
- Gộp 4 bước thành một trang.
- Giao diện ưu tiên di động.
- Nút chuyển sáng/tối.
- Đa ngôn ngữ.
- Sửa lỗi mô tả và ảnh mẫu của Minh không khớp nhau.

## Điều kiện dừng và hỏi người dùng

- Một bước Verify không đạt và kongming không đưa ra được cách xử lý trong phạm vi plan.
- Cần sửa file nằm ngoài danh sách "Chỉ sửa".
- `auto-run` thất bại vì lỗi agy, không phải vì giao diện.
