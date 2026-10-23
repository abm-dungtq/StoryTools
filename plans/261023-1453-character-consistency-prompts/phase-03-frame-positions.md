---
phase: 3
title: "Kịch bản AI ghi vị trí từng nhân vật trong khung"
status: completed
depends_on: [1]
---

# Phase 3 — `positions` cho từng khung

## Mục tiêu

Khi AI viết kịch bản, mỗi khung có thêm danh sách `positions` (tên nhân vật và vị trí `left`, `center` hoặc `right`). Server đổi tên thành id và lưu `frame.positions = { [characterId]: 'left'|'center'|'right' }`. Frame cũ không có trường này vẫn chạy bình thường.

## File

- Sửa `server/agy.js`: `FRAME_ITEM`, `FRAME_RULES`.
- Sửa `server/index.js`: `toStoredFrames`.
- Sửa `src/lib/story-model.js`: `createFrame`.

## Tasks

### Task 3.1 — Schema và luật viết

- **Goal:** model text phải trả `positions` cho mọi khung.
- **Target:** `server/agy.js`, hằng `FRAME_ITEM` và `FRAME_RULES`.
- **Steps:**
  1. Trong `FRAME_ITEM.properties`, ngay sau khoá `characters`, thêm:
     ```js
     positions: {
       type: 'array',
       description: 'Vị trí của từng nhân vật xuất hiện, nhìn từ người xem',
       items: {
         type: 'object',
         properties: {
           name: { type: 'string', description: 'Tên nhân vật, đúng tên đã cho' },
           position: { type: 'string', enum: ['left', 'center', 'right'] },
         },
         required: ['name', 'position'],
       },
     },
     ```
  2. Đổi `required` của `FRAME_ITEM` thành `['scene', 'action', 'expression', 'characters', 'positions', 'dialogues']`.
  3. Thêm dòng cuối vào chuỗi `FRAME_RULES`: `- positions: mỗi nhân vật xuất hiện có đúng một vị trí left, center hoặc right; khung có từ 2 nhân vật thì không xếp hai người cùng vị trí, và hành động phải khớp vị trí đó.`
- **Verify:** `node -e "import('./server/agy.js').then(()=>console.log('ok'))"` in ra `ok`.

### Task 3.2 — Lưu vị trí theo id

- **Goal:** `toStoredFrames` chuyển `positions` thành map theo id, bỏ giá trị lạ.
- **Target:** `server/index.js`, hàm `toStoredFrames`.
- **Steps:**
  1. Phía trên hàm, thêm `const POSITIONS = ['left', 'center', 'right'];`.
  2. Trong object trả về, ngay sau dòng `characterIds: …`, thêm:
     ```js
     positions: Object.fromEntries(
       (f.positions || [])
         .map((p) => [toId(p?.name), p?.position])
         .filter(([id, pos]) => id && POSITIONS.includes(pos)),
     ),
     ```
- **Verify:** no verification needed (Task 3.4 kiểm thật).

### Task 3.3 — Giá trị mặc định cho frame mới

- **Target:** `src/lib/story-model.js`, `createFrame`.
- **Steps:** thêm `positions: {},` ngay sau `characterIds: [],`.
- **Verify:** `npm run build` thoát mã 0.

### Task 3.4 — Thử thật một kịch bản

- **Goal:** route `story/plan` trả khung có `positions` theo id.
- **Steps:** biến shell không giữ qua các lần gọi tool, nên mỗi khối đặt lại `T` và `B`.
  1. Khởi động server bằng công cụ chạy nền của harness (run_in_background, không dùng `&`):
     ```bash
     T=$(cygpath -m "$TEMP")/st-p3; mkdir -p "$T"; DATA_DIR="$T/data" PORT=5176 node server/index.js
     ```
  2. Trong một lần gọi tool khác:
  ```bash
  T=$(cygpath -m "$TEMP")/st-p3; B=http://127.0.0.1:5176
  for i in $(seq 1 15); do curl -sf $B/api/settings >/dev/null && break; sleep 1; done
  curl -s -X PUT $B/api/characters -H 'content-type: application/json' -d '[{"id":"chlan001","name":"Lan","description":"cô gái 20 tuổi, áo dài đỏ","traits":"","images":[]},{"id":"chhung01","name":"Hùng","description":"ông lão 70 tuổi, áo bà ba nâu","traits":"","images":[]}]'
  PID=$(curl -s -X POST $B/api/projects -H 'content-type: application/json' -d '{"title":"p3"}' | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).id))")
  curl -s -X POST $B/api/projects/$PID/story/plan -H 'content-type: application/json' -d '{"storyIdea":"Lan mang cơm cho ông Hùng ở chợ, hai người cùng ăn và trò chuyện.","slideCount":1,"framesPerSlide":2,"characterIds":["chlan001","chhung01"]}' > "$T/plan.json"
  node -e "const s=require('$T/plan.json');console.log(JSON.stringify(s.slides[0].frames.map(f=>f.positions)))"
  MSYS_NO_PATHCONV=1 taskkill /T /F /PID $(netstat -ano | grep '127.0.0.1:5176 .*LISTENING' | awk '{print $5}' | head -1); rm -rf "$T"
  ```
  Nếu đầu ra là `[{},{}]` hãy xem `$T/plan.json`: model có thể viết tên khác tên đã cho (ví dụ "ông Hùng" thay cho "Hùng") nên `toId` bỏ qua; đó là hạn chế đã biết, không phải lỗi code, miễn là ít nhất một khoá khớp regex bên dưới.
- **Success criteria:** ít nhất một khung có map với khoá `chlan001` hoặc `chhung01`.
- **Verify:** dòng in ra khớp regex `"ch(lan001|hung01)":"(left|center|right)"`; cổng 5176 trống sau đó (`netstat -ano | grep -c '127.0.0.1:5176 .*LISTENING'` in ra `0`).

## Failure Protocol
If any Verify step does not meet its stated pass condition, STOP this phase.
Do not improvise a fix, retry blindly, or reason around the failure.
Spawn the `kongming` subagent for next-step counsel and pass:
- the phase and task id,
- what you attempted (the steps you ran),
- the exact command and its full output,
- the pass condition it failed to meet.
Apply kongming's guidance, then re-run the Verify step.
If `kongming` cannot be spawned in this environment, STOP and report the same
failure evidence to the user. Never continue by self-reasoning.
