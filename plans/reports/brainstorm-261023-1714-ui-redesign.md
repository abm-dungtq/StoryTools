# Brainstorm: thiết kế lại giao diện StoryTools

Ngày: 2026-10-23. Chế độ: `--advice` (kongming đã duyệt: GO).

## Hiện trạng (ảnh chụp 1440px bằng `plans/261023-1714-ui-redesign/capture-screens.mjs`)

- Danh sách truyện chỉ là các dòng chữ, không có ảnh bìa hay tiến độ; nhiều truyện trùng tên "Truyện mới".
- Trang Nhân vật là một thẻ hẹp, ô mô tả và ô đặc điểm bị cắt chữ.
- Bước 1 Kịch bản dài khoảng 2500px: mỗi khung có ba ô chữ bị cắt, nút "Tự động tạo cả truyện" nằm lẫn giữa form.
- Bước 2 Prompt & ảnh dài khoảng 2800px: prompt thô chữ máy đặt cạnh từng ảnh.
- Bước 3 có nút "Khung" không đánh số; form đăng ở bước 4 dài.
- Tab trên cùng và tab bước trông như chữ thường; không thấy bước nào đã xong.

## Hợp đồng

**Kết quả:** mọi màn hình theo phong cách studio tối, bố cục rõ hơn:
- danh sách truyện dạng lưới thẻ có ảnh bìa và tiến độ;
- nhân vật dạng thẻ rộng;
- trình sửa truyện có thanh 4 bước cho thấy bước nào đã xong;
- bước Kịch bản là lưới khung gọn (bấm để mở chi tiết), nút tự động tạo đặt nổi bật;
- bước Ảnh là lưới ưu tiên ảnh, prompt thô thu gọn mặc định;
- bước Ghép và Đăng gọn lại (nút khung có số, form đăng chia nhóm).

**Ràng buộc:**
- Giữ 4 bước, mọi chức năng và nhãn tiếng Việt.
- Không sửa `server/`, `src/lib/`, `src/hooks/`, `src/api.js` hay cấu trúc dữ liệu.
- Dùng CSS thuần (không Tailwind). Lý do: `styles.css` đã là một lớp tiện ích nhỏ, đổi sang Tailwind phải sửa mọi `className` mà không thêm chức năng nào.
- Dùng skill `/ak:frontend-design` để thiết kế.
- `.compose-canvas` và các phần tử cha không được có border, padding hay transform; `.compose-canvas-wrap` vẫn là khung định vị (`position: relative`).
- `.tab` đang dùng chung cho thanh trên cùng và nút chọn ảnh ở bước 3, nên nút chọn ảnh cần class riêng.
- Trạng thái "đã xong" của thanh bước chỉ suy ra từ dữ liệu sẵn có: có khung, khung có ảnh, có bóng thoại, checklist đăng.

**Không làm:**
- tính năng mới;
- gộp 4 bước thành một trang storyboard;
- thiết kế ưu tiên di động;
- nút chuyển sáng/tối;
- đa ngôn ngữ.

**Tiêu chí nghiệm thu:**
- Có ảnh chụp trước và sau cho 7 màn hình.
- Mọi nút và thao tác cũ vẫn dùng được.
- `npm test` và `npm run build` đều qua.
- Chạy tay "Tự động tạo cả truyện" từ giao diện mới vẫn chạy được.
- Bấm vào bóng thoại thì ô sửa hiện đúng chỗ, ở cả khổ dọc lẫn ngang.
- Ảnh PNG/PDF xuất ra không đổi: `src/lib/render-slide.js` tự đặt cứng màu và font, không đọc CSS.

## Lựa chọn đã cân nhắc

- **Chỉ đổi giao diện:** nhanh, nhưng các trang dài và rối vẫn như cũ. Người dùng không chọn.
- **Làm lại bố cục và giao diện:** đã chọn. Cách này dựa trên giả định là mọi trạng thái (lỗi, tiến độ tự động) vẫn hiện được khi khung thu gọn. Nó hỏng trước tiên nếu thẻ thu gọn giấu mất lỗi hoặc tiến độ.
- **Làm lại luồng làm việc (một trang storyboard):** rủi ro lớn nhất vì đụng tới hành vi. Người dùng không chọn.

Không có hướng nào tốt hơn hướng đã chọn. Bằng chứng: người dùng thấy khó chịu ở cả 7 màn hình, và mọi lỗi nhìn thấy trên ảnh chụp đều là lỗi bố cục, không phải lỗi luồng.

## Rủi ro chính (theo kongming)

1. Ô sửa bóng thoại bị lệch vị trí. Bước 3 tính vị trí từ `canvas.getBoundingClientRect()` (`compose-step.jsx:71,130-143`).
2. Thẻ khung thu gọn giấu lỗi hoặc tiến độ. Ô chữ phải giữ giá trị khi mở lại.
3. Thu gọn prompt làm việc "sửa prompt rồi tạo ảnh" khó hơn. Nút tạo ảnh phải nằm ngoài vùng thu gọn.
4. Độ tương phản của chữ lỗi, cảnh báo, chữ mờ và màu nguy hiểm trên nền tối.

## Chia giai đoạn

Mỗi giai đoạn chụp màn hình rồi chạy `npm test && npm run build`:

1. Màu, font và khung app: thanh trên cùng, thanh 4 bước.
2. Danh sách truyện và Nhân vật.
3. Bước Kịch bản, rồi chạy tay tự động tạo truyện.
4. Bước Ảnh.
5. Bước Ghép và Đăng, rồi chạy tay tự động tạo truyện lần nữa và kiểm tra ô sửa bóng thoại.
