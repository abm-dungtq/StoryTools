---
title: "Giảm lẫn nhân vật trong khung nhiều người bằng prompt và nhãn ảnh mẫu"
status: completed
created: 2026-10-23
mode: advice
---

# Giảm lẫn nhân vật trong khung nhiều người

Plan này viết cho executor chạy lần lượt từng phase. Mỗi phase có Failure Protocol riêng: khi một bước Verify không đạt, dừng lại và hỏi `kongming`, không tự đoán cách sửa.

## Mục tiêu

Khung có 2–3 nhân vật hay bị trộn mặt, tóc, áo giữa các nhân vật. Plan sửa chỉ bằng prompt và nhãn ảnh mẫu, không thêm lượt gọi AI nào trong lúc vẽ, nên thời gian vẽ mỗi khung không tăng.

## Nguyên nhân (đã đọc code)

- `src/lib/prompt-builder.js` chỉ in `- Tên: mô tả`, không có vị trí, không nối nhân vật với ảnh mẫu của họ.
- `server/index.js` (route `images/generate`) gắn nhãn ảnh mẫu chỉ bằng tên; `server/agy.js` `generateImage` đặt tên file `ref-1`, `ref-2`… nên prompt không trỏ được "ảnh nào là ai".
- Ảnh khung trước được gắn nhãn "match … character designs", tức là xui model chép lại cả việc ai mặc gì.

## Dữ kiện đã kiểm

- Dữ liệu thật: 1 nhân vật (Minh, id `ch225c1n`, 1 ảnh mẫu), 2 truyện, không khung nào có từ 2 nhân vật. Vì vậy bộ đo dùng truyện mẫu tạo trong thư mục tạm (người dùng đã chọn).
- Thư mục dự án chưa là repo git; `.gitignore` đã loại `data/`, `.env`, `node_modules/`, `dist/`. Git đã có `user.name` và `user.email`.
- `npm test` chỉ chạy `server/*.test.js`.

## Phase

| # | File | Nội dung | Phụ thuộc |
| --- | --- | --- | --- |
| 1 | [phase-01-git-baseline.md](phase-01-git-baseline.md) | `git init`, commit trạng thái hiện tại | – |
| 2 | [phase-02-character-traits.md](phase-02-character-traits.md) | Trường `traits`, agy rút đặc điểm từ ảnh mẫu, UI sửa và nút "Rút lại" | 1 |
| 3 | [phase-03-frame-positions.md](phase-03-frame-positions.md) | Kịch bản AI ghi vị trí trái/giữa/phải cho từng nhân vật | 1 |
| 4 | [phase-04-prompt-and-ref-labels.md](phase-04-prompt-and-ref-labels.md) | `buildFramePrompt` mới, tên file ảnh mẫu theo nhân vật, nhãn ảnh mẫu kèm đặc điểm, nhãn ảnh khung trước chỉ lấy phong cách, test | 2, 3 |
| 5 | [phase-05-benchmark.md](phase-05-benchmark.md) | Truyện mẫu 6 khung nhiều người, vẽ bằng code cũ (git worktree) và code mới, báo cáo | 4 |
| 6 | [phase-06-real-data-and-docs.md](phase-06-real-data-and-docs.md) | Điền đặc điểm cho nhân vật thật (sao lưu, hỏi người dùng), cập nhật tài liệu, commit | 5 |

## Tiêu chí hoàn thành

1. Repo git có commit đầu tiên chứa trạng thái trước khi sửa.
2. Nhân vật có trường `traits`; agy tự điền khi thêm ảnh mẫu (nếu đang trống); sửa tay được; nút "Rút lại" chạy lại.
3. Kịch bản AI trả `positions` và frame lưu `positions: { [characterId]: 'left'|'center'|'right' }`.
4. `buildFramePrompt` in mỗi nhân vật một dòng gồm vị trí, tên, đặc điểm, tên file ảnh mẫu (`char-<id>-<n>.<ext>`), và server đặt đúng tên file đó trong thư mục job.
5. Nhãn ảnh mẫu kèm đặc điểm; với khung từ 2 nhân vật, nhãn ảnh khung trước nói rõ chỉ lấy phong cách.
6. Có `src/lib/prompt-builder.test.js`; `npm test` và `npm run build` đều qua.
7. `plans/reports/bench-261023-character-consistency.md` có bảng trước/sau trên 6 khung: số khung bị lẫn, thời gian mỗi khung.
8. Nhân vật thật đã có đặc điểm (sau khi người dùng đồng ý), tài liệu cập nhật.

## Ngoài phạm vi

AI tự kiểm và vẽ lại; job runner; retry khi hết quota; đổi model vẽ; các lỗi đã hoãn (DIST_DIR, lan-share, listProjects, npm audit); UI chỉnh vị trí từng nhân vật.

## Ràng buộc

- Chỉ dùng agy CLI. Không đọc `.env` hay `data/settings.json`.
- Kiểm thử dùng `DATA_DIR` tạm. Chỉ phase 6 được ghi vào `data/` thật, và chỉ sau khi sao lưu và người dùng đồng ý.
- Không ghi đè prompt đã lưu trong frame (`frame.prompt`): code mới chỉ dùng khi prompt trống hoặc người dùng bấm tạo lại prompt.
- Commit theo conventional commits, không nhắc tới AI. Trả lời người dùng bằng tiếng Việt.
- Chỉ dừng các tiến trình mình đã khởi động.

## Điều kiện dừng và hỏi người dùng

- Sau khi sửa, bộ đo vẫn còn từ 2/6 khung bị lẫn trở lên.
- Cần xoá hoặc sửa dữ liệu thật trong `data/`.
- Lỗi agy không giải thích được.
