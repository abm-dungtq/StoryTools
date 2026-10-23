# Đo trước/sau: lẫn nhân vật trong khung nhiều người

Ngày: 2026-10-23. Code "trước" là commit gốc `4ee0dd7` chạy từ git worktree; code "sau" là bản đã sửa ở phase 2–4.

## Kết luận

- Số khung bị lẫn nhân vật: **trước 0/6, sau 0/6**. Truyện mẫu này không tái hiện được lỗi lẫn nhân vật, nên bộ đo không chứng minh được bản sửa giảm lẫn; nó chỉ cho thấy bản sửa không làm tệ hơn.
- Khác biệt rõ nhất là độ khớp với **ảnh mẫu**. Mô tả chữ của Minh trong dữ liệu (áo sơ mi vàng, quần xanh, túi vải mặt trời) mâu thuẫn với ảnh mẫu của Minh (sơ mi trắng, quần short rêu, ba lô đen). Bản "trước" vẽ Minh theo mô tả chữ ở cả 4 khung có Minh. Bản "sau" vẽ Minh theo ảnh mẫu ở cả 4 khung, vì đặc điểm nhận dạng được rút từ ảnh; khung 1 vẫn còn túi mặt trời do kịch bản nhắc tới.
- Thời gian mỗi khung **tăng**: trung bình 131 s lên 148 s, trung vị 110,5 s lên 160,5 s. Bản sửa không thêm lần gọi AI nào khi vẽ, nên phần tăng đến từ agy xử lý prompt dài hơn hoặc từ dao động của agy; một lần chạy mỗi bên chưa đủ để tách hai nguyên nhân.
- Lần chạy "sau" đầu tiên hỏng ngay khung 1: agy trả lời "đang tiến hành tạo ảnh" rồi kết thúc mà không có `out.png`. Theo tư vấn của kongming, chạy lại một lần không đổi gì thì qua 6/6.

## Cách đo

- 3 nhân vật: Minh (chép từ dữ liệu thật, 1 ảnh mẫu), Lan và Ông Hùng (hư cấu, ảnh mẫu do agy vẽ).
- Truyện mẫu do code mới viết (có `positions`), lấy 6 khung đầu có từ 2 nhân vật trở lên: 3 khung 2 người, 3 khung 3 người.
- Cả hai bên dùng cùng thư mục dữ liệu, cùng kịch bản, cùng ảnh mẫu, tỉ lệ 1:1, ảnh khung trước nối tiếp trong cùng lần chạy.
- Tiêu chí "lẫn": một nhân vật mang đặc điểm dễ thấy của nhân vật khác, hai nhân vật giống nhau, hoặc thiếu hay thừa nhân vật. Không tính sai bối cảnh, chữ trong ảnh, hay sai vị trí.

Đặc điểm agy rút từ ảnh mẫu:

- **Minh:** cậu bé dáng mảnh khảnh, tóc ngắn hơi xù màu nâu đen, da sáng ấm, áo thun trắng trong sơ mi trắng ngắn tay mở cúc, quần đùi nâu rêu, đeo ba lô đen xám, giày thể thao trắng xám kèm tất trắng.
- **Lan:** cô gái 20 tuổi dáng mảnh, da sáng hồng, mắt nâu đen, tóc đen dài buộc đuôi ngựa cao, áo dài đỏ thêu hoa sen vàng trắng, quần lụa trắng ống rộng, giày bệt đỏ.
- **Ông Hùng:** ông lão 70 tuổi dáng gầy, da vàng sáng có nếp nhăn, tóc bạc trắng cắt ngắn chải gọn, râu cằm và ria mép bạc trắng, kính gọng tròn màu đen, bộ bà ba dài tay màu nâu đất, dép lê quai ngang màu nâu đen.

## Từng khung

| Khung | Nhân vật (vị trí) | Trước | Sau | Thời gian trước / sau |
| --- | --- | --- | --- | --- |
| 1 | Ông Hùng (trái), Minh (phải) | Đúng, không lẫn. Minh mặc áo vàng, quần jean theo mô tả chữ | Đúng, không lẫn. Minh sơ mi trắng, quần short rêu theo ảnh mẫu, còn túi mặt trời | 100 s / 89 s |
| 2 | Minh (trái), Lan (giữa) | Đúng, không lẫn. Minh áo vàng | Đúng, không lẫn. Minh sơ mi trắng | 103 s / 110 s |
| 3 | Lan (trái), Ông Hùng (phải) | Đúng, không lẫn | Đúng, không lẫn | 109 s / 160 s |
| 4 | Minh (trái), Ông Hùng (giữa), Lan (phải) | Đúng, không lẫn. Minh áo vàng | Đúng, không lẫn. Minh sơ mi trắng, ba lô | 112 s / 204 s |
| 5 | Minh (trái), Lan (giữa), Ông Hùng (phải) | Đúng, không lẫn. Minh áo vàng | Đúng, không lẫn. Đúng thứ tự trái, giữa, phải | 238 s / 162 s |
| 6 | Minh (trái), Ông Hùng (giữa), Lan (phải) | Đúng, không lẫn | Đúng, không lẫn | 122 s / 161 s |

Ảnh gốc ở `plans/261023-1453-character-consistency-prompts/bench/results/` (`before/`, `after/`, `characters/`; đã gitignore).

## Hạn chế

- Mỗi bên chỉ chạy một lần; executor tự chấm bằng mắt.
- Kịch bản do code mới viết, nên câu "hành động" đã nhắc vị trí ở cả hai bên; bản "trước" vì thế được lợi một phần từ thay đổi ở phase 3.
- Thời gian mỗi khung gồm cả lần vẽ lại khi ảnh sai tỉ lệ (khung 5 bản trước, 238 s, nhiều khả năng là trường hợp này).
- Ba nhân vật trong bộ đo khác nhau rất rõ (cậu bé, cô gái áo dài đỏ, ông lão). Lỗi lẫn mà người dùng gặp có thể xảy ra với các nhân vật giống nhau hơn (cùng giới, cùng tuổi), là trường hợp bộ đo này chưa thử.

## Câu hỏi còn mở

- Truyện nào đã bị lẫn nhân vật trong thực tế, và các nhân vật đó giống nhau ở điểm nào? Cần một truyện như vậy để đo lại.
- Thời gian tăng là do prompt dài hơn hay do agy dao động? Cần chạy lại mỗi bên thêm vài lần để biết.
