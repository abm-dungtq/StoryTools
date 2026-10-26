# StoryTools – Hướng dẫn sử dụng

Tool cá nhân chạy localhost: truyện → các ảnh (slide) → khung → trang phục theo giai đoạn → prompt → Google Flow vẽ ảnh (agy dự phòng) → lời thoại/ghép → xem truyện → PNG/PDF.

## Chạy

```bash
npm install
npm run dev            # mở http://127.0.0.1:5173
npm test               # test phía server
```

Bản build: `npm run build && npm start` → http://127.0.0.1:5174

Cần cài **agy CLI** và đăng nhập trước (`agy --version` chạy được): agy viết kịch bản, lập trang phục, đặt thoại, caption và vẽ dự phòng. Cài thêm **gflow-cli** và `gflow auth login` để vẽ ảnh bằng Google Flow (engine chính). Không cần khoá riêng. Nếu agy không nằm trong PATH, đặt `AGY_BIN` trong `.env` (xem `.env.example`).

## Khái niệm

- **Truyện**: khổ ảnh (Dọc 9:16 TikTok / Ngang 16:9 YouTube), phong cách vẽ, nhân vật, tóm tắt chung.
- **Ảnh**: 1 slide khi đăng. Mỗi ảnh có ý tưởng riêng và bố cục riêng (1 khung tràn ảnh, hoặc 2/3/4/6 khung).
- **Khung**: 1 lần tạo ảnh AI, có bối cảnh, hành động, biểu cảm, lời thoại và prompt riêng.
- **Trang phục**: bộ đồ cố định của một nhân vật trong một giai đoạn truyện, có ảnh mẫu riêng. Mỗi ảnh chọn trang phục cho từng nhân vật.
- **Asset**: đồ vật hoặc bối cảnh xuất hiện ở nhiều khung nhưng không liên tục (ba lô, tạp dề, căn bếp…), có ảnh mẫu và chỉ gắn vào khung có nó.

## Tự động tạo cả truyện

Ở bước **1. Kịch bản**, thẻ "🤖 Tự động tạo truyện":

1. Nhập **cốt truyện**, chọn **số ảnh** (1–35) và **khung mỗi ảnh** (1–4 cố định, hoặc "AI tự chọn 1–3").
2. Bấm **Tự động tạo cả truyện** → xác nhận thời gian ước tính (~110 giây mỗi khung, cộng ảnh mẫu):
   - AI viết cả truyện trong 1 lần gọi (ý tưởng từng ảnh + từng khung + lời thoại); bố cục tự chọn theo số khung;
   - AI lập trang phục theo giai đoạn và tách asset, tự xác nhận ảnh khớp kịch bản; ảnh chưa khớp được sửa thêm một lượt, vẫn chưa khớp thì không vẽ và chờ xác nhận ở bước 2;
   - vẽ ảnh mẫu trang phục/asset còn thiếu, rồi vẽ lần lượt từng khung bằng Google Flow (kèm ảnh mẫu và ảnh khung trước để giữ phong cách);
   - AI **xem ảnh vừa vẽ** để đặt bóng thoại vào vùng trống, đuôi chỉ về người nói, chỉnh câu thoại cho khớp biểu cảm.
3. Xong tự chuyển sang **bước 4**: nhấp đúp bóng thoại để sửa chữ, kéo để đổi vị trí; rồi **bước 5** để duyệt và đăng.

- Tick "Dừng lại để duyệt kịch bản và trang phục trước khi vẽ" nếu muốn sửa trước khi mất thời gian vẽ: viết xong tool chuyển sang bước 2.
- Có thể bấm **Dừng** bất cứ lúc nào: khung đang vẽ bị huỷ ngay. Nút **"Vẽ N khung còn thiếu & đặt thoại"** chạy tiếp phần chưa xong.
- Tiến trình vẫn chạy khi chuyển sang bước khác trong cùng truyện (thanh tiến trình hiện trên đầu); quay về danh sách truyện thì phần đang chạy bị huỷ.
- Khung nào không đặt được lời thoại tự động sẽ được liệt kê; lần chạy tiếp thử lại khung đó (trừ khi bạn đã tự sửa bóng thoại).
- Ở bước 4, nút **✨ AI đặt thoại** cho từng khung chạy lại việc đặt bóng thoại theo ảnh.

## Quy trình thủ công

Thanh bước phía trên đánh dấu ✓ cho bước đã xong.

1. **Nhân vật**: tên + mô tả cố định (tuổi, dáng, tóc, mắt, da; không ghi quần áo) + 1–3 ảnh tham chiếu rõ mặt. Sau khi thêm ảnh mẫu, AI đọc ảnh một lần và điền ô **Đặc điểm nhận dạng** (tóc, mắt, da, kính…, không gồm quần áo). Sửa tay được; bấm **Rút lại** để AI đọc lại. Đặc điểm này giúp AI vẽ không trộn người này với người kia trong khung có nhiều nhân vật.
2. **1. Kịch bản**: thiết lập truyện, "+ Thêm ảnh" cho từng ảnh, nhập ý tưởng, chọn bố cục, bấm "AI viết N khung" (hoặc viết cho tất cả ảnh chưa có nội dung). Sửa từng khung. Mỗi khung hiện dạng thẻ tóm tắt; bấm **Sửa chi tiết** để mở các ô bối cảnh, hành động, biểu cảm và lời thoại.
3. **2. Trang phục**: bấm **🧥 AI lập trang phục & đồ vật** (sau khi sửa kịch bản thì **🔍 AI kiểm tra lại trang phục**; ảnh đã xác nhận được giữ nguyên). Sửa tên/mô tả trang phục và asset, vẽ ảnh mẫu (Flow vẽ nhân vật chính diện, nghiêng, sau lưng trên nền trắng). Với từng ảnh: chọn trang phục cho mỗi nhân vật, gắn asset cho mỗi khung, đọc nhận xét AI rồi bấm **Xác nhận trang phục khớp kịch bản** (hoặc **✓ Xác nhận N ảnh AI báo khớp**). Sửa bối cảnh, hành động, dàn nhân vật, asset hay mô tả trang phục thì ảnh đó phải xác nhận lại; sửa lời thoại thì không. Ảnh mẫu vẽ bằng agy dự phòng hoặc có mô tả đã đổi có nhãn nhắc vẽ lại.
4. **3. Prompt & ảnh**: prompt tự ghép từ phong cách + ý tưởng ảnh + mô tả nhân vật + khung (sửa tay được). Tạo từng khung hoặc hàng loạt; lịch sử các lần tạo được giữ để chọn. Trang phục và asset của khung luôn được thêm vào lúc vẽ (không nằm trong prompt sửa được); ảnh chưa xác nhận trang phục thì chưa vẽ được. Có thể tải ảnh tự làm lên. Prompt của từng khung được thu gọn; bấm **Prompt** để xem hoặc sửa, và **Tạo lại prompt từ kịch bản** nằm ngay trong đó. Kịch bản AI viết ghi sẵn ai đứng trái, giữa, phải. Khung đã vẽ trước bản này vẫn giữ prompt cũ; bấm **Tạo lại prompt từ kịch bản** ở bước 3 để dùng cách ghép prompt mới.
5. **4. Lời thoại & ghép**: chọn ảnh; bóng thoại tự đặt từ lời thoại; kéo thân để di chuyển, chấm xanh để chỉnh đuôi, ô vuông để đổi độ rộng. Ảnh nhiều khung được ghép có viền; ảnh 1 khung giữ tràn ảnh.
6. **5. Duyệt & đăng**: lướt toàn bộ ảnh như carousel (phím ← →), rồi:
   - đặt trạng thái Nháp / Đã duyệt / Đã đăng (hiện ở danh sách truyện);
   - "AI viết caption": tiêu đề (≤ 90 ký tự), caption, hashtag, gợi ý mood nhạc + từ khoá tìm nhạc; có nút copy;
   - "Chia sẻ qua Wi-Fi": hiện mã QR, quét bằng điện thoại cùng Wi-Fi để mở trang có ảnh + tiêu đề + caption + gợi ý nhạc;
   - hoặc tải PNG tất cả ảnh / PDF.
7. Đăng tay trên TikTok: + → Tải lên → chọn ảnh theo thứ tự → thêm âm thanh → dán tiêu đề, caption → đăng → quay lại đánh dấu "Đã đăng".

## Chia sẻ qua Wi-Fi (mã QR)

- Chạy một server riêng ở cổng `SHARE_PORT` (mặc định 5175) trên mạng LAN, **chỉ** phục vụ trang `/s/<token>` chỉ đọc. Tool chính vẫn chỉ mở ở `127.0.0.1`.
- Link có token ngẫu nhiên, tự tắt sau 30 phút hoặc khi bấm "Dừng chia sẻ". Mỗi lúc chỉ chia sẻ 1 truyện.
- Ảnh gửi đi là bản tại thời điểm bấm chia sẻ; sửa truyện thì bấm "Chia sẻ lại".
- Lần đầu máy có thể hỏi quyền mạng cho Node.js: trên Windows cho phép **Private networks**, trên macOS chọn **Allow**. Nếu điện thoại không mở được, kiểm tra cùng Wi-Fi và thử địa chỉ khác trong danh sách (bỏ qua các adapter `vEthernet`/WSL trên Windows, `utun`/`bridge` trên macOS).
- TikTok cho tối đa 35 ảnh mỗi bài.

## Ghi chú

- Không có trường giờ đồng hồ riêng: muốn thể hiện thời gian (hoặc có đồng hồ) thì ghi thẳng vào bối cảnh hoặc prompt. Truyện cũ khi mở sẽ tự bỏ dòng "wall clock" khỏi prompt đã lưu.
- Lời thoại luôn chèn bằng code (font Be Vietnam Pro) để đúng dấu tiếng Việt.
- Sửa lời thoại ở bước 1 (Kịch bản) sẽ đặt lại bóng thoại của khung đó.
- Đổi bố cục sang ít khung hơn sẽ xoá các khung thừa (có hỏi xác nhận).
- Tỉ lệ ảnh yêu cầu AI = tỉ lệ gần nhất với ô khung; ảnh được crop vừa ô. Nếu agy trả ảnh sai hướng (lệch hơn ~15%), tool tự vẽ lại một lần.
- "Gửi kèm ảnh khung trước" giúp đồng nhất phong cách.
- Dữ liệu nằm trong `data/` (JSON + ảnh), đã gitignore.
- Mọi ảnh (khung, ảnh mẫu trang phục, asset) vẽ bằng [gflow-cli](https://github.com/ffroliva/gflow-cli) qua Google Flow, model **Nano Banana 2** (mặc định) hoặc **Nano Banana Pro**, hạn mức ảnh riêng của Flow. Chi tiết cài đặt ở README, mục "Vẽ ảnh qua Google Flow".
- Mỗi khung gửi tối đa 10 ảnh tham chiếu theo ưu tiên: ảnh mẫu trang phục, ảnh mặt nhân vật, bối cảnh, đồ vật, ảnh khung trước. Nhân vật vừa đổi đồ thì không gửi ảnh khung trước.
- agy vẽ dự phòng khi gflow chưa cài hoặc lỗi, và ghi lý do dưới khung: nội dung bị chặn → chỉ lần đó; lỗi chung (quá giờ, giới hạn tốc độ) → nghỉ Flow 10 phút; phiên hết hạn / hết hạn mức → dùng agy đến khi bấm **Thử lại Flow** ở tab Cài đặt.
- Model mặc định: viết kịch bản/trang phục/đặt thoại/caption `gemini-4-argon-medium` (gợi ý lấy từ `agy models`), vẽ dự phòng `gemini-3.8-flash-low`.
- Không tính tiền theo lượt. Vẽ ~110 giây/khung, ảnh mẫu ~1–1,5 phút, đặt thoại ~15 giây/khung: truyện 10 khung ~20–25 phút. Hết quota agy thì phần viết báo lỗi, chờ rồi chạy tiếp.
- Dropdown **Model vẽ ảnh** (tab Cài đặt, thẻ Tự động tạo truyện, bước 3) hiện thời gian ước tính. Đổi ở bước 1/3 là lưu ngay cho cả tool.
- Lỗi thường gặp: "Không tìm thấy agy CLI" (cài, đăng nhập, đặt `AGY_BIN`), "gflow: không tạo được ảnh" / "Vẽ bằng agy dự phòng: …" (đọc lý do; phiên hết hạn thì `gflow auth login --browser chrome` rồi **Thử lại Flow**), "Trang phục chưa xác nhận (bước 2)" (xác nhận ảnh đó ở bước 2), "agy: quá …s không xong" (vẽ lại khung đó).

## Cấu trúc

- `server/index.js` – API routes; `server/storage.js` – lưu file; `server/agy.js` – gọi AI qua agy CLI (kịch bản, trang phục, vẽ dự phòng, thoại, caption); `server/agy-runner.js` – chạy CLI agy/gflow (thư mục làm việc riêng, giới hạn song song, timeout, huỷ); `server/gflow.js` – vẽ qua Google Flow; `server/image-engine.js` – chọn gflow hay agy dự phòng; `server/frame-refs.js` – ảnh tham chiếu theo ưu tiên; `server/outfit-plan.js` – dữ liệu vào/ra lượt lập trang phục
- `src/lib/story-model.js` – cấu trúc truyện/ảnh/khung; `outfits.js` – trang phục, asset, xác nhận; `layouts.js` – khổ/bố cục; `render-slide.js` – vẽ ảnh (dùng chung editor, preview, export); `bubbles.js`; `prompt-builder.js`; `image-cache.js`; `export.js`
- `src/components/` – các màn hình
