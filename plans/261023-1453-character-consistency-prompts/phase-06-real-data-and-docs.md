---
phase: 6
title: "Điền đặc điểm cho nhân vật thật, cập nhật tài liệu, commit"
status: pending
depends_on: [5]
---

# Phase 6 — Dữ liệu thật và tài liệu

## Mục tiêu

Nhân vật thật (hiện chỉ có Minh) có đặc điểm nhận dạng; tài liệu nói về ô mới và cách làm mới prompt cho khung cũ; toàn bộ thay đổi nằm trong một commit.

## File

- `data/characters.json` (dữ liệu thật; chỉ sửa sau khi sao lưu và người dùng đồng ý).
- `README.md` (mục "Nhân vật" và "Mẹo giữ nhân vật").
- `docs/usage-guide.md` (bước "2. Prompt & ảnh" và phần nhân vật).
- `docs/huong-dan-su-dung.html` (`<section id="nhan-vat">` và mục "Mẹo giữ nhân vật").

## Tasks

### Task 6.1 — Sao lưu và hỏi người dùng

- **Steps:**
  1. `cp data/characters.json data/characters.backup-261023.json` (nằm trong `data/` nên đã gitignore).
  2. Hỏi người dùng bằng tiếng Việt, một câu: "Tôi sẽ gọi agy rút đặc điểm nhận dạng cho các nhân vật thật và ghi thêm trường `traits` vào `data/characters.json` (đã sao lưu ở `data/characters.backup-261023.json`). Đồng ý không?"
  3. Nếu người dùng không đồng ý, bỏ qua Task 6.2 và ghi điều đó vào báo cáo cuối.
- **Verify:** `cmp data/characters.json data/characters.backup-261023.json && echo same` in ra `same`.

### Task 6.2 — Rút đặc điểm cho nhân vật thật

- **Steps:**
  1. `netstat -ano | grep '127.0.0.1:5174 .*LISTENING'` phải không in gì; nếu có, hỏi người dùng có phải app của họ đang chạy không, và dùng luôn server đó thay vì khởi động mới.
  2. Nếu chưa có server: khởi động nền `PORT=5174 node server/index.js` (không đặt `DATA_DIR`, tức là dùng dữ liệu thật). Ghi lại PID.
  3. Chạy:
     ```bash
     node -e "
     const http=require('http');
     const call=(m,u,b)=>new Promise((ok,no)=>{const d=b?Buffer.from(JSON.stringify(b)):null;const r=http.request('http://127.0.0.1:5174'+u,{method:m,headers:d?{'content-type':'application/json','content-length':d.length}:{}},res=>{let t='';res.setEncoding('utf8');res.on('data',x=>t+=x);res.on('end',()=>res.statusCode<400?ok(JSON.parse(t)):no(new Error(t)))});r.on('error',no);if(d)r.write(d);r.end();});
     (async()=>{const list=await call('GET','/api/characters');
     for(const c of list){if(c.images&&c.images.length&&!(c.traits||'').trim()){c.traits=(await call('POST','/api/characters/traits',c)).traits;console.log(c.name+': '+c.traits);}}
     await call('PUT','/api/characters',list);console.log('saved',list.length);})().catch(e=>{console.error(e.message);process.exit(1)});
     "
     ```
  4. Nếu đã khởi động server ở bước 2, dừng nó bằng `MSYS_NO_PATHCONV=1 taskkill /T /F /PID <pid>`.
- **Success criteria:** mọi nhân vật có ảnh mẫu đều có `traits` không rỗng; số nhân vật không đổi.
- **Verify:** `node -e "const a=require('./data/characters.json'),b=require('./data/characters.backup-261023.json');console.log(a.length===b.length, a.filter(c=>c.images?.length).every(c=>(c.traits||'').trim().length>5))"` in ra `true true`.

### Task 6.3 — Tài liệu

- **Steps:** thêm nội dung sau, giữ giọng văn hiện có (câu đầy đủ, tiếng Việt):
  1. `README.md`, mục `## Nhân vật`: một đoạn: "Sau khi thêm ảnh mẫu, AI đọc ảnh một lần và điền ô **Đặc điểm nhận dạng** (tóc, kính, trang phục kèm màu…). Sửa tay được; bấm **Rút lại** để AI đọc lại. Đặc điểm này giúp AI vẽ không trộn người này với người kia trong khung có nhiều nhân vật."
  2. `README.md`, mục `## Mẹo giữ nhân vật`: thêm gạch đầu dòng: "Kịch bản AI viết ghi sẵn ai đứng trái, giữa, phải. Khung đã vẽ trước bản này vẫn giữ prompt cũ; bấm **Tạo lại prompt từ kịch bản** ở bước 2 để dùng cách ghép prompt mới."
  3. `docs/usage-guide.md`: thêm hai ý tương tự vào chỗ nói về nhân vật và vào bước "**2. Prompt & ảnh**".
  4. `docs/huong-dan-su-dung.html`: thêm một `<p>` trong `<section id="nhan-vat">` và một `<li>` trong danh sách của mục "Mẹo giữ nhân vật", cùng nội dung.
- **Verify:** `grep -c "Đặc điểm nhận dạng" README.md docs/usage-guide.md docs/huong-dan-su-dung.html` cho mỗi file số ≥ `1`, và `grep -c "Tạo lại prompt từ kịch bản" README.md` in ra số ≥ `1`.

### Task 6.4 — Kiểm cuối và commit

- **Steps:**
  1. `npm test` và `npm run build`.
  2. `git status --porcelain | grep -E 'data/|settings\.json|bench/results'` phải không in gì.
  3. `git add -A && git commit -m "feat: keep characters distinct in multi-character frames"` (không thêm dòng nhắc tới AI).
  4. Cập nhật `status: completed` trong `plan.md` và frontmatter từng phase đã xong.
- **Verify:** `npm test 2>&1 | grep '^# fail'` in ra `# fail 0`; `npm run build` thoát mã 0; `git log --oneline | wc -l` in ra `2`.

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
