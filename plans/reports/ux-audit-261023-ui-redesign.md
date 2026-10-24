# Rà UX giao diện studio tối (sau phase 5)

Ngày rà: 24/10/2026. Cách rà: skill `ak:frontend-design`, route "Audit UI/UX of a running product" (`workflow-ux-audit.md` và `ux-polish-standards.md`), đối chiếu với design brief trong `plans/261023-1714-ui-redesign/plan.md`.

## Phạm vi

- Đầu vào là 7 ảnh chụp ở 1440px trong `plans/261023-1714-ui-redesign/screens/phase-5/` (thu nhỏ còn 1000px trong `view/`). Cả 7 ảnh đều đọc được.
- Plan chỉ nhắm máy bàn từ 1440px, nên không rà ở khổ tablet và di động; giao diện cho di động nằm ngoài phạm vi.
- Theo plan, chỉ sửa lỗi về khoảng cách, căn lề, độ tương phản, thứ bậc chữ và trạng thái hover/focus/disabled. Các lỗi khác chỉ được ghi lại.
- Sau khi sửa, đã chạy lại `capture-screens.mjs --checks` vào `screens/audit-fix/`: `CHECKS FAILED: 0`.

## Kết luận chung

Giao diện mới đạt mục tiêu của brief: tranh là thứ sáng nhất trên màn hình, màu cam chỉ dùng cho nút chính, mục đang chọn và tiêu điểm, thanh 4 bước cho biết ngay bước nào đã xong. Mọi chữ đạt tỉ lệ tương phản 4.5. Phần còn lại chủ yếu là lỗi nhỏ về độ hoàn thiện.

## Lỗi tìm thấy

Mức độ theo thang của skill: Blocker, Major, Minor, Polish.

| # | Màn hình | Lỗi | Mức độ | Xử lý |
| --- | --- | --- | --- | --- |
| 1 | Nhân vật | Ô "Đặc điểm nhận dạng" chỉ cao 3 dòng nên đặc điểm dài bị cắt giữa dòng; phải cuộn trong ô mới đọc hết. | Major | Đã sửa: ô cao 5 dòng, bằng ô "Mô tả". |
| 2 | Nhân vật | Nhãn "Đặc điểm nhận dạng" dùng chữ thường cỡ nhỏ, trong khi nhãn "Mô tả" ngay trên dùng chữ đậm; hai ô ngang hàng mà thứ bậc chữ khác nhau. | Minor | Đã sửa: dùng chung kiểu nhãn `.label`. |
| 3 | Prompt & ảnh | Nút chính bị tắt ("Tạo ảnh cho 0 khung chưa có ảnh") chỉ mờ đi 50%, nên nền cam thành màu nâu đục và chữ khó đọc; trông như một nút hỏng hơn là nút đang tắt. | Minor | Đã sửa: nút chính khi tắt dùng nền xám trung tính và chữ màu phụ, không mờ đi. |
| 4 | Danh sách truyện | Thẻ truyện rộng 220px nên dòng "Dọc 9:16 (TikTok/Shorts) · 2 ảnh" xuống dòng, chữ "ảnh" đứng lẻ một mình. | Minor | Đã sửa: thẻ rộng tối thiểu 240px, dòng thông tin nằm gọn trên một dòng. |
| 5 | Nhân vật | Nút "×" xoá ảnh tham chiếu rất nhỏ (khoảng 20px), khó bấm trúng. | Polish | Ghi lại. Plan chỉ nhắm máy bàn có chuột; đổi kích cỡ sẽ đổi bố cục thẻ ảnh. |
| 6 | Ghép | Đoạn hướng dẫn dùng bóng thoại ở cột phải khá dài (4 dòng) và đứng trước các nút. | Polish | Ghi lại. Đây là nội dung chữ, không thuộc nhóm lỗi được sửa trong plan. |
| 7 | Prompt & ảnh, Kịch bản | Mỗi ảnh chỉ có 2 khung nên lưới khung để trống nửa phải màn hình 1440px. | Polish | Ghi lại. Lưới tự lấp khi có 3 khung trở lên; kéo giãn thẻ sẽ làm ảnh to quá mức. |
| 8 | Duyệt & đăng | Hai nút "Copy tiêu đề" và "Copy caption + hashtag" bị tắt khi chưa có caption nhưng không nói lý do. | Polish | Ghi lại. Thêm gợi ý là thay đổi nội dung, không thuộc phạm vi sửa. |

## Những điểm đã đạt

- Trạng thái hover, focus-visible và disabled có ở mọi nút, ô nhập, thẻ truyện và nút bước. Viền tiêu điểm màu cam, dày 2px.
- Ô sửa bóng thoại khớp đúng vị trí bóng (`bubble-editor-align` PASS) và hình học khung vẽ không đổi (`compose-canvas-geometry` PASS).
- Trang Kịch bản cao 1530px (giới hạn 1600px), trang Ảnh cao 1501px (giới hạn 2000px).

## File đã sửa

- `src/styles.css`: kiểu cho nút chính khi tắt; độ rộng tối thiểu của thẻ truyện.
- `src/components/characters-view.jsx`: ô đặc điểm cao 5 dòng; nhãn dùng `.label`.
