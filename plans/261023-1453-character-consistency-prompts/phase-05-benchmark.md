---
phase: 5
title: "Đo trước/sau trên 6 khung nhiều người"
status: pending
depends_on: [4]
---

# Phase 5 — Bộ đo

## Mục tiêu

Cùng 6 khung kịch bản, cùng nhân vật, cùng ảnh mẫu: vẽ một lần bằng code cũ (commit gốc, chạy từ git worktree) và một lần bằng code mới, rồi đếm số khung bị lẫn và thời gian mỗi khung. Không đụng `data/` thật (chỉ đọc ảnh mẫu của Minh để chép sang).

## Thiết lập chung

Mọi lệnh chạy từ `D:\TQD\StoryTools` trong Git Bash. Biến shell KHÔNG giữ qua các lần gọi tool, nên ba dòng sau phải đứng đầu MỌI khối lệnh (kể cả lệnh khởi động server):
```bash
export BENCH_DIR=$(cygpath -m "$TEMP")/st-bench
PLAN=plans/261023-1453-character-consistency-prompts
WT=.bench-base
```
- Server luôn chạy cổng 5176 (tránh đụng app của người dùng ở 5174) với `DATA_DIR=$BENCH_DIR`; mỗi lúc chỉ một server. Khởi động bằng công cụ chạy nền của harness (run_in_background, không dùng `&`). Chờ sẵn sàng bằng `for i in $(seq 1 15); do curl -sf http://127.0.0.1:5176/api/settings >/dev/null && break; sleep 1; done`. Dừng bằng PID Windows lấy từ netstat: `MSYS_NO_PATHCONV=1 taskkill /T /F /PID $(netstat -ano | grep '127.0.0.1:5176 .*LISTENING' | awk '{print $5}' | head -1)`.
- Trước khi khởi động, `netstat -ano | grep '127.0.0.1:5176 .*LISTENING'` phải không in gì. Nếu có, chỉ dừng nó khi chắc chắn là server do mình khởi động; nếu không, dừng phase và hỏi người dùng.
- Bộ đo tốn khoảng 20 lượt vẽ (khoảng 25–30 phút).

## File

- Tạo `plans/261023-1453-character-consistency-prompts/bench/bench.mjs`.
- Sửa `.gitignore`: thêm `.bench-base/` và `plans/**/bench/results/`.
- Tạo `plans/reports/bench-261023-character-consistency.md`.

## Tasks

### Task 5.1 — Script đo

- **Steps:**
  1. Thêm hai dòng `.bench-base/` và `plans/**/bench/results/` vào cuối `.gitignore`.
  2. Tạo `$PLAN/bench/bench.mjs`:
     ```js
     // Character-mixing benchmark: draws the same multi-character frames with a given prompt builder and server.
     // Run from the repo root with BENCH_DIR set to the server's DATA_DIR:
     //   node <plan>/bench/bench.mjs setup
     //   node <plan>/bench/bench.mjs run <label> --builder <path to prompt-builder.js>
     import fs from 'node:fs/promises';
     import http from 'node:http';
     import path from 'node:path';
     import { pathToFileURL } from 'node:url';

     const args = process.argv.slice(2);
     const flag = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
     const BASE = flag('--base') || 'http://127.0.0.1:5176';
     const BENCH = process.env.BENCH_DIR;
     if (!BENCH) throw new Error('BENCH_DIR is not set');
     const STATE = path.join(BENCH, 'state.json');

     // node:http has no response timeout, unlike fetch (300 s), and one drawing can take longer.
     function call(method, url, body) {
       return new Promise((resolve, reject) => {
         const data = body === undefined ? null : Buffer.from(JSON.stringify(body));
         const headers = data ? { 'content-type': 'application/json', 'content-length': data.length } : {};
         const req = http.request(BASE + url, { method, headers }, (res) => {
           let text = '';
           res.setEncoding('utf8');
           res.on('data', (d) => (text += d));
           res.on('end', () => {
             let json = null;
             try { json = text ? JSON.parse(text) : null; } catch { /* plain-text error */ }
             if (res.statusCode >= 400) reject(new Error(`${method} ${url} -> ${res.statusCode}: ${json?.error || text}`));
             else resolve(json);
           });
         });
         req.on('error', reject);
         if (data) req.write(data);
         req.end();
       });
     }

     const CAST = [
       { id: 'chlan001', name: 'Lan', description: 'cô gái 20 tuổi, tóc đen dài buộc đuôi ngựa, áo dài đỏ, dáng mảnh' },
       { id: 'chhung01', name: 'Ông Hùng', description: 'ông lão 70 tuổi, tóc bạc cắt ngắn, râu bạc, kính gọng tròn, áo bà ba nâu, dáng gầy' },
     ];
     const STORY =
       'Minh, Lan và Ông Hùng cùng dọn dẹp quán phở nhỏ của Ông Hùng sau một ngày mưa rồi ngồi ăn tối với nhau. ' +
       'Mọi khung đều có ít nhất hai trong ba người, đứng ở các vị trí khác nhau và trò chuyện.';

     async function setup() {
       const real = JSON.parse(await fs.readFile('data/characters.json', 'utf8')).find((c) => c.name === 'Minh');
       if (!real?.images?.length) throw new Error('Minh has no reference image in data/characters.json');
       await fs.mkdir(path.join(BENCH, 'characters'), { recursive: true });
       await fs.copyFile(path.join('data', 'characters', real.images[0]), path.join(BENCH, 'characters', real.images[0]));
       const cast = [{ id: real.id, name: real.name, description: real.description || '', images: [real.images[0]] }];

       const refsProject = await call('POST', '/api/projects', { title: 'bench-refs' });
       for (const c of CAST) {
         const { file } = await call('POST', `/api/projects/${refsProject.id}/images/generate`, {
           prompt: `Character reference picture: one person only, full body, front view, plain light grey background, soft comic illustration. ${c.description}. Do NOT draw any text.`,
           aspectRatio: '1:1',
         });
         await fs.copyFile(path.join(BENCH, 'panels', refsProject.id, file), path.join(BENCH, 'characters', file));
         cast.push({ ...c, images: [file] });
       }
       for (const c of cast) c.traits = (await call('POST', '/api/characters/traits', c)).traits;
       await call('PUT', '/api/characters', cast);

       const project = await call('POST', '/api/projects', { title: 'bench-story' });
       project.characterIds = cast.map((c) => c.id);
       let slides = [];
       let multi = [];
       for (let attempt = 0; attempt < 2 && multi.length < 6; attempt++) {
         ({ slides } = await call('POST', `/api/projects/${project.id}/story/plan`, {
           storyIdea: STORY, slideCount: 4, framesPerSlide: 2, characterIds: project.characterIds,
         }));
         multi = slides.flatMap((s) => s.frames).filter((f) => f.characterIds.length >= 2);
       }
       if (multi.length < 6) throw new Error(`only ${multi.length} multi-character frames after 2 attempts`);
       project.idea = STORY;
       project.slides = slides.map((s, i) => ({ id: `benchslide${i}`, idea: s.idea, layoutId: 'p2', frames: s.frames }));
       await call('PUT', `/api/projects/${project.id}`, project);
       await fs.writeFile(STATE, JSON.stringify({ projectId: project.id, frameIds: multi.slice(0, 6).map((f) => f.id) }, null, 2));
       console.log(`setup ok project=${project.id} multi=${multi.length}`);
       for (const c of cast) console.log(`${c.name}: ${c.traits}`);
     }

     async function run(label) {
       const builder = flag('--builder');
       if (!builder) throw new Error('--builder is required');
       const { buildFramePrompt } = await import(pathToFileURL(path.resolve(builder)).href);
       const { projectId, frameIds } = JSON.parse(await fs.readFile(STATE, 'utf8'));
       const project = await call('GET', `/api/projects/${projectId}`);
       const characters = await call('GET', '/api/characters');
       const out = path.join(BENCH, 'results', label);
       await fs.mkdir(out, { recursive: true });
       const rows = [];
       let prev = null;
       for (const [i, frameId] of frameIds.entries()) {
         const slide = project.slides.find((s) => s.frames.some((f) => f.id === frameId));
         const frame = slide.frames.find((f) => f.id === frameId);
         const prompt = buildFramePrompt(project, slide, frame, characters);
         const started = Date.now();
         const { file } = await call('POST', `/api/projects/${projectId}/images/generate`, {
           prompt, characterIds: frame.characterIds, aspectRatio: '1:1', styleRefImage: prev,
         });
         const seconds = Math.round((Date.now() - started) / 1000);
         await fs.copyFile(path.join(BENCH, 'panels', projectId, file), path.join(out, `frame-${i + 1}${path.extname(file)}`));
         prev = file;
         const cast = frame.characterIds.map((id) => characters.find((c) => c.id === id)?.name);
         rows.push({ n: i + 1, frameId, cast, positions: frame.positions || {}, action: frame.action, seconds, prompt });
         console.log(`${label} frame ${i + 1}/${frameIds.length}: ${seconds}s`);
       }
       await fs.writeFile(path.join(out, 'results.json'), JSON.stringify(rows, null, 2));
     }

     const [command, label] = args;
     if (command === 'setup') await setup();
     else if (command === 'run' && label) await run(label);
     else throw new Error('usage: bench.mjs setup | run <label> --builder <path>');
     ```
- **Verify:** `node --check $PLAN/bench/bench.mjs` thoát mã 0.

### Task 5.2 — Dựng truyện mẫu bằng code mới

- **Steps:**
  1. `rm -rf "$BENCH_DIR"; mkdir -p "$BENCH_DIR"`
  2. Khởi động server mới (chạy nền): `DATA_DIR=$BENCH_DIR PORT=5176 node server/index.js`. Chờ sẵn sàng bằng vòng lặp curl ở Thiết lập chung.
  3. `node $PLAN/bench/bench.mjs setup` (khoảng 5 phút).
  4. Dừng server mới.
- **Success criteria:** `state.json` có 6 frame id; 3 nhân vật đều có đặc điểm.
- **Verify:** `node -e "const s=require(process.env.BENCH_DIR+'/state.json');console.log(s.frameIds.length)"` in ra `6`; và `node -e "const c=require(process.env.BENCH_DIR+'/characters.json');console.log(c.filter(x=>x.traits&&x.traits.length>5).length)"` in ra `3`. Nếu setup báo `only N multi-character frames`, áp dụng Failure Protocol.

### Task 5.3 — Vẽ "trước" bằng code gốc

- **Steps:**
  1. `git worktree add --detach $WT $(cat $PLAN/baseline-commit.txt)`. Worktree nằm trong thư mục dự án nên Node tìm thấy `node_modules` của dự án khi đi ngược lên thư mục cha; không cần tạo junction.
  2. Khởi động server gốc (chạy nền) TỪ THƯ MỤC DỰ ÁN, không `cd` vào worktree: `DATA_DIR=$BENCH_DIR PORT=5176 node $WT/server/index.js`. Lý do: `server/index.js` nạp `dotenv/config` từ thư mục hiện tại, mà `.env` (chứa `AGY_BIN` nếu có) bị gitignore nên không tồn tại trong worktree. Chờ sẵn sàng bằng vòng lặp curl.
  3. Kiểm đúng server gốc đang chạy: `curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:5176/api/characters/traits -H 'content-type: application/json' -d '{"images":[]}'` phải in `404` (code gốc chưa có route này; code mới trả `400`).
  4. `node $PLAN/bench/bench.mjs run before --builder $WT/src/lib/prompt-builder.js` (khoảng 8 phút).
  5. Dừng server gốc.
- **Verify:** `ls "$BENCH_DIR/results/before" | grep -c '^frame-'` in ra `6`, và `grep -c "reference image: char-" "$BENCH_DIR/results/before/results.json"` in ra `0` (prompt cũ không có tên file ảnh mẫu).

### Task 5.4 — Vẽ "sau" bằng code mới

- **Steps:**
  1. Khởi động server mới từ thư mục dự án (chạy nền), như Task 5.2 bước 2. Kiểm: route `/api/characters/traits` với `{"images":[]}` trả `400`.
  2. `node $PLAN/bench/bench.mjs run after --builder src/lib/prompt-builder.js`.
  3. Dừng server mới.
- **Verify:** `ls "$BENCH_DIR/results/after" | grep -c '^frame-'` in ra `6`, và `grep -c "reference image: char-" "$BENCH_DIR/results/after/results.json"` in ra `6` (mỗi prompt là một dòng JSON, nên đếm được một lần cho mỗi khung).

### Task 5.5 — Chấm khung bị lẫn

- **Goal:** mỗi ảnh có kết luận "lẫn" hoặc "đúng", theo cùng một tiêu chí.
- **Steps:**
  1. Mở bằng công cụ đọc ảnh (Read) 3 ảnh mẫu trong `$BENCH_DIR/characters/` và đọc đặc điểm của từng nhân vật trong `$BENCH_DIR/characters.json`.
  2. Với từng ảnh `results/before/frame-N.*` và `results/after/frame-N.*`, đối chiếu với `cast` trong `results.json` cùng thư mục. Một khung bị **lẫn** khi có ít nhất một điều sau:
     - một nhân vật mang đặc điểm dễ thấy của nhân vật khác (màu áo, kiểu áo, tóc bạc/đen, kính, tuổi);
     - hai nhân vật trông như cùng một người;
     - thiếu một nhân vật trong `cast`, hoặc có thêm một bản sao của một nhân vật.
     Không tính lỗi khác như sai bối cảnh, chữ trong ảnh, hay sai vị trí trái/phải.
  3. Ghi cho từng khung một dòng: `N | trước: đúng/lẫn (lý do ngắn) | sau: đúng/lẫn (lý do ngắn)`.
  4. Tính số khung lẫn mỗi bên, và thời gian trung bình (`seconds`) mỗi bên.
- **Verify:** đủ 12 kết luận (6 trước, 6 sau). Điều kiện dừng của người dùng: nếu bên **sau** có từ `2` khung lẫn trở lên, vẫn làm Task 5.6 và 5.7, rồi DỪNG ở cuối phase và hỏi người dùng (đây là điều kiện dừng của plan, không phải lỗi cần hỏi kongming).

### Task 5.6 — Báo cáo

- **Steps:**
  1. `mkdir -p $PLAN/bench/results && cp -r "$BENCH_DIR/results/before" "$BENCH_DIR/results/after" $PLAN/bench/results/ && cp -r "$BENCH_DIR/characters" $PLAN/bench/results/` (thư mục này đã gitignore; giữ lại để người dùng tự xem).
  2. Viết `plans/reports/bench-261023-character-consistency.md` gồm: cách đo (3 nhân vật, 6 khung, cùng kịch bản, cùng ảnh mẫu, tỉ lệ 1:1, ảnh khung trước nối tiếp); đặc điểm đã rút của 3 nhân vật; bảng 6 dòng từ Task 5.5; tổng số khung lẫn trước/sau; thời gian trung bình trước/sau; đường dẫn tới `$PLAN/bench/results/`; hạn chế: một lần chạy mỗi bên, chấm bằng mắt của executor, kịch bản do code mới viết nên câu "hành động" có thể đã nhắc vị trí ở cả hai bên; thời gian mỗi khung gồm cả lần vẽ lại khi `generateImage` thấy sai tỉ lệ, nên một khung lẻ có thể gấp đôi.
- **Verify:** `grep -c '^| ' plans/reports/bench-261023-character-consistency.md` in ra số ≥ `7` (dòng tiêu đề và 6 dòng khung).

### Task 5.7 — Dọn dẹp

- **Steps:**
  1. `git worktree remove --force $WT`
  2. `rm -rf "$BENCH_DIR"`
- **Verify:** `git worktree list | wc -l` in ra `1`; `test -d node_modules && echo ok` in ra `ok`; `netstat -ano | grep -c '127.0.0.1:5176 .*LISTENING'` in ra `0`.

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
