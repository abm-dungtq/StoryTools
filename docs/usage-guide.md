# StoryTools – Hướng dẫn sử dụng

Tool cá nhân chạy localhost: truyện → các ảnh (slide) → khung → prompt → AI (agy CLI) tạo ảnh → lời thoại/ghép → xem truyện → PNG/PDF.

## Chạy

```bash
npm install
npm run dev            # mở http://127.0.0.1:5173
npm test               # test phía server
```

Bản build: `npm run build && npm start` → http://127.0.0.1:5174

Cần cài **agy CLI** và đăng nhập trước (`agy --version` chạy được). Không cần khoá riêng: mọi tác vụ AI dùng gói đăng ký agy. Nếu agy không nằm trong PATH, đặt `AGY_BIN` trong `.env` (xem `.env.example`).

## Khái niệm

- **Truyện**: khổ ảnh (Dọc 9:16 TikTok / Ngang 16:9 YouTube), phong cách vẽ, nhân vật, tóm tắt chung.
- **Ảnh**: 1 slide khi đăng. Mỗi ảnh có ý tưởng riêng và bố cục riêng (1 khung tràn ảnh, hoặc 2/3/4/6 khung).
- **Khung**: 1 lần tạo ảnh AI, có bối cảnh, hành động, biểu cảm, lời thoại và prompt riêng.

## Tự động tạo cả truyện

Ở bước **1. Kịch bản**, thẻ "🤖 Tự động tạo truyện":

1. Nhập **cốt truyện**, chọn **số ảnh** (1–35) và **khung mỗi ảnh** (1–4 cố định, hoặc "AI tự chọn 1–3").
2. Bấm **Tự động tạo cả truyện** → xác nhận thời gian ước tính (~90 giây mỗi khung):
   - AI viết cả truyện trong 1 lần gọi (ý tưởng từng ảnh + từng khung + lời thoại); bố cục tự chọn theo số khung;
   - vẽ lần lượt từng khung (kèm ảnh khung trước để giữ phong cách);
   - AI **xem ảnh vừa vẽ** để đặt bóng thoại vào vùng trống, đuôi chỉ về người nói, chỉnh câu thoại cho khớp biểu cảm.
3. Xong tự chuyển sang **bước 3**: nhấp đúp bóng thoại để sửa chữ, kéo để đổi vị trí; rồi **bước 4** để duyệt và đăng.

- Tick "Dừng lại để duyệt kịch bản trước khi vẽ" nếu muốn sửa kịch bản trước khi mất thời gian vẽ.
- Có thể bấm **Dừng** bất cứ lúc nào: khung đang vẽ bị huỷ ngay. Nút **"Vẽ N khung còn thiếu & đặt thoại"** chạy tiếp phần chưa xong.
- Tiến trình vẫn chạy khi chuyển sang bước khác trong cùng truyện (thanh tiến trình hiện trên đầu); quay về danh sách truyện thì phần đang chạy bị huỷ.
- Khung nào không đặt được lời thoại tự động sẽ được liệt kê; lần chạy tiếp thử lại khung đó (trừ khi bạn đã tự sửa bóng thoại).
- Ở bước 3, nút **✨ AI đặt thoại** cho từng khung chạy lại việc đặt bóng thoại theo ảnh.

## Quy trình thủ công

Thanh bước phía trên đánh dấu ✓ cho bước đã xong.

1. **Nhân vật**: tên + mô tả cố định (tóc, áo, màu sắc…) + 1–3 ảnh tham chiếu rõ mặt. Sau khi thêm ảnh mẫu, AI đọc ảnh một lần và điền ô **Đặc điểm nhận dạng** (tóc, kính, trang phục kèm màu…). Sửa tay được; bấm **Rút lại** để AI đọc lại. Đặc điểm này giúp AI vẽ không trộn người này với người kia trong khung có nhiều nhân vật.
2. **1. Kịch bản**: thiết lập truyện, "+ Thêm ảnh" cho từng ảnh, nhập ý tưởng, chọn bố cục, bấm "AI viết N khung" (hoặc viết cho tất cả ảnh chưa có nội dung). Sửa từng khung. Mỗi khung hiện dạng thẻ tóm tắt; bấm **Sửa chi tiết** để mở các ô bối cảnh, hành động, biểu cảm và lời thoại.
3. **2. Prompt & ảnh**: prompt tự ghép từ phong cách + ý tưởng ảnh + mô tả nhân vật + khung (sửa tay được). Tạo từng khung hoặc hàng loạt; lịch sử các lần tạo được giữ để chọn. Có thể tải ảnh tự làm lên. Prompt của từng khung được thu gọn; bấm **Prompt** để xem hoặc sửa, và **Tạo lại prompt từ kịch bản** nằm ngay trong đó. Kịch bản AI viết ghi sẵn ai đứng trái, giữa, phải. Khung đã vẽ trước bản này vẫn giữ prompt cũ; bấm **Tạo lại prompt từ kịch bản** ở bước 2 để dùng cách ghép prompt mới.
4. **3. Lời thoại & ghép**: chọn ảnh; bóng thoại tự đặt từ lời thoại; kéo thân để di chuyển, chấm xanh để chỉnh đuôi, ô vuông để đổi độ rộng. Ảnh nhiều khung được ghép có viền; ảnh 1 khung giữ tràn ảnh.
5. **4. Duyệt & đăng**: lướt toàn bộ ảnh như carousel (phím ← →), rồi:
   - đặt trạng thái Nháp / Đã duyệt / Đã đăng (hiện ở danh sách truyện);
   - "AI viết caption": tiêu đề (≤ 90 ký tự), caption, hashtag, gợi ý mood nhạc + từ khoá tìm nhạc; có nút copy;
   - "Chia sẻ qua Wi-Fi": hiện mã QR, quét bằng điện thoại cùng Wi-Fi để mở trang có ảnh + tiêu đề + caption + gợi ý nhạc;
   - hoặc tải PNG tất cả ảnh / PDF.
6. Đăng tay trên TikTok: + → Tải lên → chọn ảnh theo thứ tự → thêm âm thanh → dán tiêu đề, caption → đăng → quay lại đánh dấu "Đã đăng".

## Chia sẻ qua Wi-Fi (mã QR)

- Chạy một server riêng ở cổng `SHARE_PORT` (mặc định 5175) trên mạng LAN, **chỉ** phục vụ trang `/s/<token>` chỉ đọc. Tool chính vẫn chỉ mở ở `127.0.0.1`.
- Link có token ngẫu nhiên, tự tắt sau 30 phút hoặc khi bấm "Dừng chia sẻ". Mỗi lúc chỉ chia sẻ 1 truyện.
- Ảnh gửi đi là bản tại thời điểm bấm chia sẻ; sửa truyện thì bấm "Chia sẻ lại".
- Lần đầu máy có thể hỏi quyền mạng cho Node.js: trên Windows cho phép **Private networks**, trên macOS chọn **Allow**. Nếu điện thoại không mở được, kiểm tra cùng Wi-Fi và thử địa chỉ khác trong danh sách (bỏ qua các adapter `vEthernet`/WSL trên Windows, `utun`/`bridge` trên macOS).
- TikTok cho tối đa 35 ảnh mỗi bài.

## Ghi chú

- Không có trường giờ đồng hồ riêng: muốn thể hiện thời gian (hoặc có đồng hồ) thì ghi thẳng vào bối cảnh hoặc prompt. Truyện cũ khi mở sẽ tự bỏ dòng "wall clock" khỏi prompt đã lưu.
- Lời thoại luôn chèn bằng code (font Be Vietnam Pro) để đúng dấu tiếng Việt.
- Sửa lời thoại ở bước 1 sẽ đặt lại bóng thoại của khung đó.
- Đổi bố cục sang ít khung hơn sẽ xoá các khung thừa (có hỏi xác nhận).
- Tỉ lệ ảnh yêu cầu AI = tỉ lệ gần nhất với ô khung; ảnh được crop vừa ô. Nếu agy trả ảnh sai hướng (lệch hơn ~15%), tool tự vẽ lại một lần.
- "Gửi kèm ảnh khung trước" giúp đồng nhất phong cách.
- Dữ liệu nằm trong `data/` (JSON + ảnh), đã gitignore.
- Model mặc định: viết kịch bản/đặt thoại/caption `gemini-4-argon-medium`, vẽ ảnh `agy · gemini-3.8-flash-low` (agy tự chọn model vẽ thật). Gợi ý lấy từ lệnh `agy models`.
- Đã cài [gflow-cli](https://github.com/ffroliva/gflow-cli) và `gflow auth login` thì danh sách model vẽ có thêm **Google Flow · Nano Banana 2/Pro**: vẽ thẳng qua Google Flow bằng hạn mức ảnh riêng của Flow, khoảng 1,5–2 phút/khung. Chi tiết cài đặt ở README, mục "Vẽ ảnh qua Google Flow".
- Không tính tiền theo lượt; dùng quota gói agy. Vẽ ~75 giây/khung, đặt thoại ~15 giây/khung: truyện 10 khung ~15 phút. Hết quota thì agy báo lỗi, chờ rồi chạy tiếp.
- Dropdown **Model vẽ ảnh** (tab Cài đặt, thẻ Tự động tạo truyện, bước 2) hiện thời gian ước tính. Đổi ở bước 1/2 là lưu ngay cho cả tool.
- Lỗi thường gặp: "Không tìm thấy agy CLI" (cài, đăng nhập, đặt `AGY_BIN`), "agy: không tạo được ảnh" (hết quota hoặc nội dung bị chặn), "agy: quá …s không xong" (vẽ lại khung đó).

## Cấu trúc

- `server/index.js` – API routes; `server/storage.js` – lưu file; `server/agy.js` – gọi AI qua agy CLI; `server/agy-runner.js` – chạy agy (thư mục làm việc riêng, giới hạn song song, timeout, huỷ)
- `src/lib/story-model.js` – cấu trúc truyện/ảnh/khung; `layouts.js` – khổ/bố cục; `render-slide.js` – vẽ ảnh (dùng chung editor, preview, export); `bubbles.js`; `prompt-builder.js`; `image-cache.js`; `export.js`
- `src/components/` – các màn hình
