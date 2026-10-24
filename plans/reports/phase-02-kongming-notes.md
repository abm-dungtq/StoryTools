# Phase 2 — ghi chú tư vấn kongming

**Task:** 2.4 (Kiểm phase 2). Lần chạy đầu `capture-screens.mjs` in `CHECKS FAILED: 10`, ảnh chụp trắng trơn.

**Nguyên nhân (kongming xác nhận):** Vite dev server đã cache bản rỗng của `src/components/project-list.jsx`. Lý do là file được ghi bằng heredoc `cat > file`: lệnh này xoá trắng file trước khi ghi, watcher bắt được lúc file rỗng, còn sự kiện ghi xong bị gộp mất trên Windows. Trong khi đó file trên đĩa vẫn đúng (`npm run build` thoát mã 0). Mọi FAIL đều bắt nguồn từ việc app không mount được.

**Cách xử lý đã áp dụng:**
1. `touch src/components/project-list.jsx` để watcher phát lại sự kiện `change`. Không khởi động lại server.
2. Dùng curl kiểm module được phục vụ: đã có `createHotContext`, không còn `sourcesContent:[""]`.
3. Chạy lại capture: chỉ còn `height-script` và `height-frames` FAIL. Đây là hai check được phép FAIL ở phase này.

**Lưu ý cho các phase sau:** Khi dev server đang chạy, đừng ghi đè file nguồn bằng heredoc `cat >`. Hãy ghi ra file tạm rồi `mv`/`cp` đè lên, hoặc dùng công cụ Edit/Write. Không thêm tuỳ chọn watch vào `vite.config.js`.
