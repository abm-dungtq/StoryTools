# StoryTools

Tool chạy trên máy bạn, biến một cốt truyện thành bộ ảnh truyện tranh có lời thoại tiếng Việt, sẵn sàng đăng TikTok hoặc YouTube. AI (qua agy CLI) viết kịch bản và vẽ ảnh; chữ được chèn bằng code nên không bao giờ sai dấu.

- Giao diện: `http://127.0.0.1:5173`
- Khổ ảnh: dọc 9:16 (TikTok/Shorts) và ngang 16:9 (YouTube)
- Tối đa 35 ảnh mỗi bài TikTok
- Dữ liệu nằm trong `data/` (không đẩy lên git)

Bản hướng dẫn có giao diện đẹp hơn: [`docs/huong-dan-su-dung.html`](docs/huong-dan-su-dung.html) (mở trực tiếp bằng trình duyệt).

## Mục lục

- [Khởi động](#khởi-động)
- [Truyện, Ảnh, Khung](#truyện-ảnh-khung)
- [Nhân vật](#nhân-vật)
- [Tạo truyện tự động](#tạo-truyện-tự-động)
- [Bốn bước thủ công](#bốn-bước-thủ-công)
- [Chỉnh bóng thoại](#chỉnh-bóng-thoại)
- [Duyệt và đăng TikTok](#duyệt-và-đăng-tiktok)
- [Thời gian và model](#thời-gian-và-model)
- [Mẹo giữ nhân vật](#mẹo-giữ-nhân-vật)
- [Xử lý sự cố](#xử-lý-sự-cố)
- [Dữ liệu và sao lưu](#dữ-liệu-và-sao-lưu)
- [Cấu trúc dự án](#cấu-trúc-dự-án)
- [Ủng hộ tác giả](#ủng-hộ-tác-giả)
- [Cộng đồng](#cộng-đồng)

## Khởi động

Yêu cầu:

- Node.js 22 trở lên. Chạy được trên Windows và macOS.
- **agy CLI** (Google Antigravity) đã cài và đăng nhập: gõ `agy --version` trong terminal phải in ra phiên bản. Tool dùng gói đăng ký của bạn, không cần khoá riêng hay bật thanh toán theo lượt.

```bash
npm install
npm run dev     # mở http://127.0.0.1:5173
npm test        # test phía server (node:test)
```

Nếu `agy` không nằm trong PATH, chép `.env.example` thành `.env` và đặt `AGY_BIN` trỏ tới file agy: trên Windows là `agy.exe`, trên macOS là đường dẫn mà lệnh `which agy` in ra. Khi server không tìm thấy agy, đầu trang hiện cảnh báo.

Muốn chạy bản build thay vì bản dev:

```bash
npm run build
npm start       # mở http://127.0.0.1:5174
```

> Tool chỉ lắng nghe ở `127.0.0.1`, máy khác trong mạng không vào được. Riêng tính năng chia sẻ qua Wi-Fi mở tạm một cổng khác, chỉ khi bạn bấm và tự tắt sau 30 phút.

## Truyện, Ảnh, Khung

Ba mức này quyết định mọi thao tác còn lại, nên nắm trước khi bắt đầu.

| Mức | Là gì | Nội dung |
| --- | --- | --- |
| **Truyện** | Một bài đăng | Khổ ảnh, phong cách vẽ, dàn nhân vật, cốt truyện |
| **Ảnh** | Một slide người xem lướt qua | Ý tưởng riêng và bố cục riêng: 1 khung tràn ảnh, hoặc 2, 3, 4, 6 khung |
| **Khung** | Một lần gọi AI vẽ | Bối cảnh, hành động, biểu cảm, lời thoại và prompt riêng. Tiền chủ yếu tốn ở đây |

Ảnh 1 khung được in tràn toàn khổ, không viền. Ảnh nhiều khung mới được ghép lại thành lưới có viền. Truyện 5 ảnh, mỗi ảnh 2 khung nghĩa là 10 lần gọi AI vẽ.

## Nhân vật

Đây là phần quyết định truyện có đồng nhất hay không, nên làm kỹ trước khi tạo truyện. Vào tab **Nhân vật**, bấm **+ Thêm nhân vật** và điền:

- **Tên**: dùng đúng tên này khi viết cốt truyện để AI gán vai chính xác.
- **Mô tả cố định**: tuổi, kiểu tóc, màu mắt, trang phục, phụ kiện. Càng cụ thể càng ổn định. Ví dụ: *cậu bé 13 tuổi, tóc đen rối xù, áo polo vàng mù tạt, tạp dề xanh rêu, giày vải đỏ*.
- **Ảnh tham chiếu**: 1–3 ảnh rõ mặt, nền đơn giản. Mọi lần vẽ đều gửi kèm các ảnh này.

Sau khi thêm ảnh mẫu, AI đọc ảnh một lần và điền ô **Đặc điểm nhận dạng** (tóc, kính, trang phục kèm màu…). Sửa tay được; bấm **Rút lại** để AI đọc lại. Đặc điểm này giúp AI vẽ không trộn người này với người kia trong khung có nhiều nhân vật.

Mô tả được chèn tự động vào prompt của mọi khung có nhân vật đó, nên không cần nhắc lại khi viết kịch bản.

## Tạo truyện tự động

Cách nhanh nhất: chỉ nhập cốt truyện, phần còn lại tool tự chạy. Vào **Truyện → tạo truyện mới → bước 1. Kịch bản**, thẻ **🤖 Tự động tạo truyện**.

1. **Nhập cốt truyện.** Viết vài câu về diễn biến và cái kết, gọi nhân vật đúng tên. Chọn **số ảnh** (1–35) và **khung mỗi ảnh**: cố định 1–4, hoặc để AI tự chọn 1–3 tuỳ cảnh.
2. **Xem thời gian ước tính.** Bên cạnh dropdown **Model vẽ ảnh** là thời gian cho cả truyện, ví dụ *≈ ~15 phút cho 10 khung*. Đổi model ở đây là lưu luôn cho cả tool.
3. **Bấm Tự động tạo cả truyện.** Tool hỏi xác nhận kèm thời gian ước tính, rồi chạy tuần tự: AI viết toàn bộ kịch bản trong một lần gọi, vẽ từng khung (gửi kèm ảnh khung trước để giữ phong cách), sau đó nhìn ảnh vừa vẽ để đặt bóng thoại vào vùng trống và chỉnh câu thoại cho khớp biểu cảm. Muốn đọc kịch bản trước khi mất thời gian vẽ thì tick **Dừng lại để duyệt kịch bản trước khi vẽ**.
4. **Duyệt kết quả.** Chạy xong tool tự chuyển sang bước 3 để bạn sửa lời thoại và vị trí bóng, rồi sang bước 4 để đăng.

Đang chạy có thể bấm **Dừng**: tool huỷ ngay khung đang vẽ, không chờ xong. Phần dở dang chạy tiếp bằng nút **Vẽ N khung còn thiếu & đặt thoại**. Chuyển giữa các bước trong cùng truyện thì tiến trình vẫn chạy, thanh tiến trình hiện trên đầu trang; còn quay về danh sách truyện thì phần đang chạy bị huỷ.

Nếu có khung không đặt được lời thoại tự động, tool ghi tên các khung đó dưới nút chạy. Lần chạy tiếp sẽ thử lại (thay bóng thoại mẫu của khung đó), hoặc bấm **✨ AI đặt thoại** ở bước 3. Khung nào bạn đã tự sửa bóng thoại thì không bị thử lại nữa.

## Bốn bước thủ công

Khi muốn kiểm soát từng ảnh, làm lần lượt bốn bước trong trang soạn truyện.

1. **Kịch bản.** Chọn khổ ảnh, phong cách vẽ và dàn nhân vật. Bấm **+ Thêm ảnh thủ công** cho từng ảnh, nhập ý tưởng, chọn bố cục rồi bấm **✨ AI viết N khung**. Sửa lại bối cảnh, hành động, biểu cảm, lời thoại của từng khung nếu cần.
2. **Prompt & ảnh.** Prompt tự ghép từ phong cách, ý tưởng ảnh, mô tả nhân vật và nội dung khung; sửa tay được. Vẽ từng khung bằng **Tạo ảnh** hoặc vẽ hàng loạt các khung còn thiếu. Mỗi lần vẽ lại đều được giữ, bấm thumbnail để chọn bản ưng ý. Có sẵn nút tải ảnh ngoài lên nếu bạn tự vẽ.
3. **Lời thoại & ghép.** Chọn từng ảnh để xem bản ghép thật. Bóng thoại tự đặt từ lời thoại trong kịch bản; chỉnh bằng chuột theo bảng bên dưới. Ảnh nhiều khung được ghép có viền, ảnh 1 khung giữ tràn ảnh.
4. **Duyệt & đăng.** Lướt toàn bộ truyện như carousel, viết caption, rồi chuyển ảnh sang điện thoại để đăng.

## Chỉnh bóng thoại

Toàn bộ thao tác nằm trên khung tranh ở bước 3.

| Thao tác | Kết quả |
| --- | --- |
| Bấm vào bóng thoại | Chọn bóng, cột phải hiện ô sửa chữ và thanh chỉnh cỡ chữ |
| **Nhấp đúp** vào bóng thoại | Sửa chữ ngay trên ảnh. `Enter` lưu, `Esc` huỷ |
| Kéo thân bóng | Di chuyển bóng, đuôi vẫn chỉ về chỗ cũ |
| Kéo chấm xanh | Đổi hướng và độ dài đuôi bóng, trỏ về người đang nói |
| Kéo ô vuông bên phải | Đổi độ rộng bóng, chữ tự xuống dòng theo |
| Nút **✨ AI đặt thoại** | AI nhìn lại ảnh và đặt bóng vào vùng trống, có thể chỉnh nhẹ câu chữ |
| Nút **+ Bóng** / **Đặt lại** | Thêm bóng trống, hoặc đặt lại theo mẫu từ lời thoại trong kịch bản |

Sửa lời thoại ở bước 1 sẽ đặt lại bóng thoại của khung đó, nên hãy chốt lời thoại trước rồi mới tinh chỉnh vị trí.

## Duyệt và đăng TikTok

Bước 4 gom mọi thứ cần cho một bài đăng. Phía trên là carousel xem lại cả truyện, dùng phím `←` `→` để lướt.

**Caption và nhạc.** Bấm **✨ AI viết caption** để có tiêu đề (tối đa 90 ký tự), caption, hashtag, gợi ý mood nhạc và từ khoá tìm nhạc. Có nút copy riêng cho tiêu đề và cho caption kèm hashtag. Trạng thái **Nháp / Đã duyệt / Đã đăng** hiện luôn ở danh sách truyện.

**Chuyển ảnh sang điện thoại.** Hai cách:

- **📱 Chia sẻ qua Wi-Fi**: hiện mã QR, quét bằng camera điện thoại cùng mạng Wi-Fi. Trang mở ra có ảnh theo thứ tự, nút tải ảnh, và nút copy tiêu đề, caption, gợi ý nhạc ngay trên điện thoại. Link tự tắt sau 30 phút.
- **Tải PNG tất cả ảnh** hoặc **Xuất PDF** về máy rồi tự chuyển.

**Các bước đăng:**

1. Lưu ảnh vào điện thoại theo đúng thứ tự 1, 2, 3…
2. TikTok → nút **+** → Tải lên → chọn ảnh theo đúng thứ tự đó.
3. Thêm âm thanh: tìm trong thư viện TikTok theo từ khoá mà AI gợi ý.
4. Dán tiêu đề và caption, rồi đăng.
5. Quay lại tool đánh dấu **Đã đăng**.

> **Vì sao phải đăng tay:** API của TikTok không cho chọn một bài nhạc cụ thể trong thư viện, và app chưa qua kiểm duyệt chỉ đăng được bài ở chế độ riêng tư. Đăng tay nhanh hơn và được chọn đúng nhạc đang trend.

Lần đầu bấm chia sẻ Wi-Fi, máy sẽ hỏi quyền mạng cho Node.js. Trên Windows, chọn cho phép **Private networks**. Trên macOS, chọn **Allow** khi được hỏi có cho "node" nhận kết nối đến không.

## Thời gian và model

Tool không tính tiền theo lượt gọi: mọi tác vụ AI chạy qua agy CLI bằng quota của gói đăng ký đang đăng nhập. Đổi lại, vẽ ảnh chậm hơn gọi API trực tiếp.

| Việc | Thời gian một lần |
| --- | --- |
| Vẽ một khung | ~75 giây |
| Đặt lời thoại cho một khung | ~15 giây |
| Viết kịch bản cả truyện, viết caption | 15–60 giây |

Truyện 10 khung mất khoảng 15 phút; 35 ảnh × 2 khung mất khoảng 1 giờ 45 phút. Các khung được vẽ lần lượt vì mỗi khung gửi kèm ảnh khung trước để giữ phong cách.

Tab **Cài đặt** có hai ô, danh sách gợi ý lấy từ lệnh `agy models`:

- **Model viết kịch bản, caption, đặt lời thoại**: mặc định `gemini-4-argon-medium`. Chọn `gemini-3.8-flash-low` nếu muốn nhanh hơn.
- **Model vẽ ảnh**: mặc định `agy · gemini-3.8-flash-low`. Với model agy, agy tự chọn model vẽ thật; ô này chỉ chọn model điều khiển việc vẽ. Khi đã cài gflow-cli, danh sách có thêm **Google Flow · Nano Banana 2** và **Google Flow · Nano Banana Pro** (xem dưới).

Hết quota thì agy báo lỗi; chờ quota hồi rồi bấm vẽ tiếp phần còn thiếu.

### Vẽ ảnh qua Google Flow (tuỳ chọn)

[gflow-cli](https://github.com/ffroliva/gflow-cli) gửi prompt và ảnh mẫu thẳng tới Google Flow (model Nano Banana) bằng tài khoản Google của bạn, không qua vòng tác tử của agy. Ảnh dùng hạn mức ảnh riêng của Flow, tách khỏi quota của agy. Viết kịch bản, đặt lời thoại và caption vẫn chạy bằng agy.

```bash
uv tool install gflow-cli                                    # cần uv: https://docs.astral.sh/uv/
uv tool run --from gflow-cli playwright install chromium     # một lần, khoảng 150 MB
gflow auth login --browser chrome                            # đăng nhập Google trong cửa sổ Chrome hiện ra
```

Khởi động lại server, rồi chọn model **Google Flow · …** ở tab Cài đặt hoặc ngay ở bước 1/2. Mỗi khung mất khoảng 1,5–2 phút; lần đầu tool tạo sẵn một project "StoryTools" trên Flow và dùng lại cho các lần sau. Biến `GFLOW_BIN` (đường dẫn lệnh gflow) và `GFLOW_PROFILE` (tên profile đăng nhập) đặt trong `.env` nếu cần; đặt `GFLOW_PROFILE` thì đăng nhập bằng `gflow auth login --browser chrome --profile <tên>`. Mỗi khung gflow mở một cửa sổ Chrome: đừng đóng nó khi đang vẽ. Mỗi khung nhận tối đa 10 ảnh mẫu; nhiều hơn thì tool giữ ảnh đầu của từng nhân vật và khung trước.

gflow-cli không phải công cụ chính thức của Google: nó điều khiển một cửa sổ Chrome thật bằng tài khoản của bạn, có thể hỏng khi Google đổi giao diện Flow, và việc tự động hoá thuộc trách nhiệm của chủ tài khoản theo điều khoản của Google.

## Mẹo giữ nhân vật

- Ảnh tham chiếu nên chụp rõ mặt, đủ sáng, nền đơn giản, và cùng một phong cách vẽ với truyện.
- Giữ bật tuỳ chọn **Gửi kèm ảnh khung trước** ở bước 2: khung sau bám theo màu sắc và nét vẽ của khung trước.
- Mô tả nhân vật nên nói về đặc điểm không đổi (tóc, dáng người, trang phục thường ngày), còn cảm xúc và tư thế để phần biểu cảm và hành động của từng khung lo.
- Kịch bản AI viết ghi sẵn ai đứng trái, giữa, phải. Khung đã vẽ trước bản này vẫn giữ prompt cũ; bấm **Tạo lại prompt từ kịch bản** ở bước 2 để dùng cách ghép prompt mới.
- Khung nào lệch nhân vật thì bấm **Tạo lại** riêng khung đó, lịch sử ảnh cũ vẫn được giữ để quay về.
- Muốn có đồng hồ hay mốc thời gian thì ghi thẳng vào bối cảnh hoặc prompt; tool không còn trường giờ riêng vì AI hay vẽ đồng hồ thừa.

## Xử lý sự cố

| Hiện tượng | Cách xử lý |
| --- | --- |
| Cảnh báo *"Không tìm thấy agy CLI"* | Cài agy và đăng nhập, đặt `AGY_BIN` trong `.env` nếu agy không nằm trong PATH, rồi khởi động lại server |
| *"agy: không tạo được ảnh"* | Có thể đã hết quota hoặc nội dung bị chặn. Sửa câu mô tả ở bước 2, hoặc chờ quota hồi rồi tạo lại khung đó |
| *"agy: quá …s không xong"* | agy treo hoặc quá chậm. Bấm vẽ lại khung đó |
| *"gflow: không tạo được ảnh"* | Chạy `gflow auth status`; nếu phiên hết hạn thì `gflow auth login` lại. Có thể đã hết hạn mức ảnh của Flow: đổi sang model agy hoặc chờ |
| *"gflow: không tìm thấy lệnh gflow"* | Cài gflow-cli như hướng dẫn ở trên, hoặc đặt `GFLOW_BIN` trong `.env`, rồi khởi động lại server |
| *"agy: trả về sai định dạng"* | Model trả lời không đúng JSON. Bấm lại; nếu lặp lại nhiều lần, đổi model viết kịch bản trong Cài đặt |
| Điện thoại không mở được mã QR | Kiểm tra hai máy cùng Wi-Fi, cho phép Node.js qua tường lửa ở mạng Private, và thử địa chỉ khác trong danh sách (bỏ qua các adapter vEthernet, WSL) |
| Trình duyệt chặn khi tải nhiều PNG | Cho phép trang tải nhiều file, hoặc dùng Xuất PDF rồi tách ảnh sau |
| Chữ trong bóng thoại bị tràn | Kéo ô vuông bên phải để nới rộng bóng, hoặc giảm cỡ chữ ở thanh trượt cột phải |

## Dữ liệu và sao lưu

Mọi thứ nằm trong thư mục `data/` của dự án: `characters.json`, `projects/` (mỗi truyện một file JSON), `characters/` và `panels/` chứa ảnh, `settings.json` chứa tên model đã chọn, `tmp/` là thư mục làm việc tạm của agy (tự dọn sau mỗi lần gọi). Thư mục này đã được gitignore.

- Sao lưu bằng cách copy nguyên thư mục `data/`.
- Xoá một truyện trong tool sẽ xoá luôn các ảnh đã vẽ của truyện đó.
- Nếu `settings.json` còn trường khoá cũ (`apiKey`) từ phiên bản trước thì server tự xoá khi khởi động. Nên thu hồi khoá đó trong Google AI Studio.
- Khi vẽ ảnh và đặt lời thoại, agy chạy với quyền đọc/ghi file không cần hỏi. Tool cho agy làm việc trong thư mục tạm riêng và bọc nội dung người dùng để chống prompt injection, nhưng đó không phải sandbox: chỉ dùng cốt truyện, ảnh do chính bạn đưa vào.

## Cấu trúc dự án

Node + Express ở backend, React (Vite) ở frontend, không cần Python.

```
server/
  index.js        API routes
  storage.js      đọc ghi file trong data/
  agy.js          gọi AI qua agy CLI: kịch bản, vẽ ảnh, đặt lời thoại, caption
  agy-runner.js   chạy agy: thư mục làm việc riêng, giới hạn song song, timeout, huỷ
  *.test.js       test chạy bằng npm test
  lan-share.js    trang chia sẻ qua Wi-Fi kèm mã QR
src/
  lib/            story-model, layouts, render-slide, bubbles, prompt-builder, export
  components/     các màn hình: nhân vật, kịch bản, prompt & ảnh, ghép, duyệt & đăng
  hooks/          autosave, pipeline tự động tạo truyện
docs/             hướng dẫn sử dụng
```

## Ủng hộ tác giả

Tool này miễn phí. Nếu nó giúp bạn tiết kiệm thời gian, bạn có thể mời mình một ly cà phê qua VietQR. Quét bằng app ngân hàng bất kỳ:

<img src="docs/images/donate-techcombank-qr.png" alt="Mã VietQR ủng hộ qua Techcombank" width="280" />

Cảm ơn bạn. Mọi ủng hộ đều được dùng để tiếp tục phát triển tool.

## Cộng đồng

Tham gia nhóm học AI **Cộng đồng AZ Builder** để trao đổi về cách dùng AI làm nội dung:

[facebook.com/groups/1078217401795712](https://web.facebook.com/groups/1078217401795712)
