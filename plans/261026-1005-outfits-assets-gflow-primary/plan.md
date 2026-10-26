---
status: in-progress
created: 2026-10-26
---

# Google Flow là engine vẽ chính, trang phục theo giai đoạn và asset riêng

## Outcome
- Mọi ảnh (khung truyện, ảnh mẫu trang phục, ảnh asset) vẽ bằng gflow. agy chỉ vẽ khi gflow chưa cài hoặc vừa lỗi (dự phòng tự động, có báo lý do).
- Mỗi truyện có danh sách **trang phục theo giai đoạn** cho từng nhân vật, mỗi bộ có ảnh mẫu nhân vật mặc bộ đó (vẽ bằng gflow từ ảnh gốc của nhân vật).
- Đồ vật / địa điểm **không xuất hiện liên tục** được tách thành **asset** riêng có ảnh mẫu, gắn vào đúng khung có nó.
- Mỗi ảnh (slide) có phân công trang phục cho từng nhân vật và phải được **xác nhận khớp kịch bản** trước khi vẽ: AI kiểm tra, người dùng xác nhận (chế độ tự động: AI xác nhận).
- Push lên GitHub khi xong.

## Constraints
- Không đổi hợp đồng dữ liệu cũ: project cũ không có trang phục vẫn vẽ được như trước (không chặn).
- gflow: tối đa 10 ảnh tham chiếu (nano2/nano-pro); một profile chỉ chạy 1 lệnh một lúc.
- Text AI (kịch bản, kiểm tra trang phục, đặt thoại) vẫn chạy bằng agy.
- Không đọc `.env` / `data/settings.json`; sao lưu dữ liệu trước khi thay đổi.

## Non-goals
- Không dùng entity Character của Flow (không chạy trên host flow.google.com).
- Không kiểm tra trang phục bằng thị giác trên ảnh đã vẽ (chỉ kiểm tra ở mức kịch bản).
- Không upscale 2K.

## Design
Data (theo truyện, vì trang phục phụ thuộc cốt truyện):
```
project.outfits: [{ id, characterId, name, description, image|null }]
project.assets:  [{ id, kind: 'prop'|'place', name, description, image|null }]
slide.outfits:   { [characterId]: outfitId }
slide.outfitCheck: { ok: bool, note, confirmed: bool } | null
frame.assetIds:  [assetId]
```
- **Đạo diễn trang phục** (agy, 1 lượt cho cả truyện): đọc kịch bản + trang phục/asset đang có → trả về danh sách trang phục (giữ id cũ), asset, phân công từng ảnh kèm `ok/note`, asset từng khung. Dùng cả cho lần đầu và cho "kiểm tra lại".
- **Ảnh mẫu**: trang phục = i2i từ ảnh gốc nhân vật, bảng nhân vật chính diện/nghiêng/sau nền trắng 16:9; đạo cụ = vật thể nền trắng; địa điểm = cảnh nền không người.
- **Ảnh tham chiếu khi vẽ khung** (ưu tiên, cắt ở 10): ảnh trang phục của từng nhân vật → ảnh gốc #1 của từng nhân vật → địa điểm → đạo cụ → khung trước → ảnh gốc còn lại.
- **Engine**: `drawImage()` thử gflow; lỗi (trừ huỷ / 400) → agy với model dự phòng, nghỉ gflow 10 phút để không chờ lỗi lặp lại.
- **Cổng vẽ**: truyện có trang phục thì ảnh chưa xác nhận trang phục không được vẽ; tự động tạo ảnh mẫu còn thiếu ngay trước khung cần nó.

## Phases
1. Engine gflow chính + agy dự phòng; cài đặt "model Flow" + "model agy dự phòng"; ước lượng thời gian.
2. Mô hình dữ liệu + migrate; endpoint đạo diễn trang phục.
3. Endpoint vẽ ảnh mẫu; ảnh tham chiếu và prompt khung theo trang phục/asset.
4. Giao diện: bước "2. Trang phục & đồ vật"; chọn asset trong khung; cổng vẽ; tự động hoá (lập trang phục sau khi viết truyện, vẽ ảnh mẫu khi cần).
5. Test, chạy thật qua API, tài liệu, commit, push.

## Acceptance
- `npm test` và `npm run build` qua.
- Chạy thật: truyện ngắn có ≥2 giai đoạn trang phục → AI lập trang phục + asset, vẽ ảnh mẫu bằng gflow, vẽ khung dùng đúng ảnh mẫu; xem ảnh thấy trang phục đúng giai đoạn.
- gflow lỗi giả lập (GFLOW_BIN sai) → khung vẫn vẽ bằng agy và báo "dự phòng".
- Project cũ (`caba2bdbfde4`) mở được, vẽ được.

## Status (2026-10-26)
- Phase 1–5 xong; review đã sửa: plan không ghi đè ảnh mẫu vẽ trong lúc AI chạy (khoá bước 2 + merge theo id), slide khoá giữ nguyên mô tả trang phục, AI bỏ sót slide/khung/nhân vật thì giữ gán cũ, key trùng không ánh xạ lại, nhân vật bị bỏ khỏi dàn không chặn slide, ảnh mẫu cũ được vẽ lại, mô tả trống là lỗi, ảnh tham chiếu mất trên đĩa được bỏ qua.
- `npm test` 44/44, `npm run build` OK. Project cũ mở được, không bị chặn.
- Chạy thật `E2E_MANUAL=1 node plans/261026-1005-outfits-assets-gflow-primary/run-outfits-e2e.mjs`: ảnh mẫu trang phục, asset và khung đều vẽ bằng gflow, đúng trang phục từng giai đoạn.
- **Còn mở:** lượt AI lập trang phục (`/outfits/plan`) và dự phòng agy chưa chạy thật vì agy hết quota (hồi sau ~148 giờ tính từ 2026-10-26). Khi có quota: chạy script trên không có `E2E_MANUAL`, và thử dự phòng bằng cách đặt biến GFLOW_BIN sai.
