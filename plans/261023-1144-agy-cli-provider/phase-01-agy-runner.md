---
phase: 1
title: "agy runner và bộ đọc đầu ra"
status: completed
depends_on: []
---

# Phase 1 — agy runner và bộ đọc đầu ra

## Mục tiêu

Một module duy nhất biết cách chạy `agy` như tiến trình con: tạo thư mục job riêng, giới hạn đồng thời, timeout, huỷ cả cây tiến trình, và đọc đầu ra một cách phòng thủ. Phase 2 chỉ gọi module này.

## File

- Tạo `server/agy-runner.js`.
- Tạo `server/agy-runner.test.js`.
- Sửa `package.json`: thêm script `"test": "node --test --test-reporter=tap \"server/*.test.js\""`.

## Tasks

### Task 1.1 — Hàm thuần: đọc đầu ra, gỡ JSON lồng, đọc kích thước ảnh, bọc dữ liệu

- **Goal:** bốn hàm thuần, export từ `server/agy-runner.js`, không spawn gì.
- **Target:** `server/agy-runner.js`, các export `parseAgyOutput`, `unwrapStructured`, `imageInfo`, `dataBlock`, class `AgyError`.
- **Steps:**
  1. Mở đầu file bằng comment một dòng theo phong cách repo, ví dụ `// Runs the agy CLI as a child process: isolated job dir, concurrency limit, timeout, process-tree cancel, defensive output parsing.`
  2. `export class AgyError extends Error { constructor(message, status = 502) { super(\`agy: ${message}\`); this.status = status; } }`.
  3. `parseAgyOutput(stdout)`: `JSON.parse(stdout.trim())`; nếu lỗi, thử lấy dòng cuối cùng bắt đầu bằng `{` rồi parse; nếu vẫn lỗi thì `throw new AgyError('đầu ra không phải JSON: ' + stdout.slice(-300))`. Trả về `{ status, structured: data.structured_output ?? null, response: String(data.response || '') }`.
  4. `unwrapStructured(value, requiredKeys)`, theo đúng thứ tự:
     - (a) nếu `value` là string: thử `JSON.parse`; parse được thì gọi đệ quy `unwrapStructured(parsed, requiredKeys)`; parse lỗi thì nhảy tới (d);
     - (b) nếu `value` là object: duyệt **mọi** giá trị riêng của nó (`Object.values`); với giá trị là string mà `trim()` bắt đầu bằng `{`, thử `JSON.parse`; nếu kết quả là object có đủ `requiredKeys` thì trả về kết quả đó (ca bọc hai lớp, kể cả khi key bọc ngoài khác tên như `{ result: '{"t":"d"}' }`);
     - (c) nếu `value` là object có đủ `requiredKeys` thì trả về `value`;
     - (d) còn lại `throw new AgyError('trả về sai định dạng (thiếu ' + requiredKeys.join(', ') + ')')`.
     - "Có đủ key" nghĩa là `value !== null && typeof value === 'object' && requiredKeys.every((k) => k in value)`.
  5. `imageInfo(buffer)`: trả về `{ mimeType, width, height }` hoặc `null`.
     - PNG: 8 byte đầu là `89 50 4E 47 0D 0A 1A 0A`; width = `buffer.readUInt32BE(16)`, height = `buffer.readUInt32BE(20)`.
     - JPEG: 2 byte đầu `FF D8`; duyệt marker từ offset 2: đọc `FF xx`, độ dài đoạn `readUInt16BE(offset + 2)`; nếu `xx` thuộc `C0, C1, C2` thì height = `readUInt16BE(offset + 5)`, width = `readUInt16BE(offset + 7)`; nếu không thì `offset += 2 + len`. Hết buffer thì `null`.
     - Định dạng khác thì `null`.
  6. `dataBlock(label, text)`: trả về chuỗi
     ```
     <<<DATA ${label}>>>
     ${String(text ?? '').replaceAll('<<<', '‹‹‹')}
     <<<END DATA>>>
     ```
     Thao tác thay `<<<` ngăn nội dung người dùng tự đóng khối.
- **Success criteria:** bốn hàm export được, không import gì ngoài `node:` modules và `./storage.js`.
- **Verify:** no verification needed (Task 1.3 kiểm).

### Task 1.2 — `runAgy`: thư mục job, hàng đợi, timeout, huỷ

- **Goal:** `export async function runAgy(opts)` chạy một lần agy và trả kết quả đã kiểm.
- **Target:** `server/agy-runner.js`, export `runAgy`, `JOB_ROOT`.
- **Chữ ký:**
  ```js
  /**
   * @param {{ prompt: string, model: string, schema?: object, requiredKeys?: string[],
   *   files?: {name: string, data: Buffer}[], expectImage?: boolean, needsFiles?: boolean,
   *   timeoutSec: number, signal?: AbortSignal }} opts
   * @returns {Promise<{ structured: object|null, image: {buffer: Buffer, mimeType: string, width: number, height: number}|null, response: string }>}
   */
  ```
- **Steps:**
  1. `import { spawn } from 'node:child_process'`, `fs from 'node:fs/promises'`, `path from 'node:path'`, `{ DATA_DIR, newId } from './storage.js'`.
  2. `export const JOB_ROOT = path.join(DATA_DIR, 'tmp');` và `const AGY_BIN = process.env.AGY_BIN || 'agy';` và `const MAX_PARALLEL = Number(process.env.AGY_CONCURRENCY) || 2;`.
  3. Semaphore — chép nguyên đoạn này, không tự viết lại:
     ```js
     let active = 0;
     const waiting = [];

     /** Waits for a free agy slot; a cancelled request leaves the queue without taking a slot. */
     function acquire(signal) {
       if (active < MAX_PARALLEL) {
         active++;
         return Promise.resolve();
       }
       return new Promise((resolve, reject) => {
         const entry = {};
         const onAbort = () => {
           waiting.splice(waiting.indexOf(entry), 1);
           reject(new AgyError('đã huỷ', 499));
         };
         entry.resolve = () => {
           signal?.removeEventListener('abort', onAbort);
           active++;
           resolve();
         };
         signal?.addEventListener('abort', onAbort, { once: true });
         waiting.push(entry);
       });
     }

     function release() {
       active--;
       waiting.shift()?.resolve();
     }
     ```
  4. `function killTree(child)`: đầu hàm `if (!child.pid) return;`. Sau đó nếu `process.platform === 'win32'` thì `spawn('taskkill', ['/T', '/F', '/PID', String(child.pid)], { windowsHide: true })`, ngược lại `child.kill('SIGTERM')`. Bọc trong try/catch, không ném lỗi.
  5. Trong `runAgy`:
     - Nếu `signal?.aborted` thì ném `AgyError('đã huỷ', 499)` ngay.
     - `await acquire(signal)`; ngay sau đó dùng `try { … } finally { release() }` (release chỉ khi acquire đã thành công).
     - `const dir = path.join(JOB_ROOT, newId()); await fs.mkdir(dir, { recursive: true });` rồi ghi từng `files[i]` vào `path.join(dir, assertSafeName(file.name))` (import `assertSafeName` từ `./storage.js`).
     - Nếu có `schema`, ghi `schema.json` vào `dir`.
     - Mảng args: `['-p', prompt, '--model', model, '--output-format', 'json', '--print-timeout', \`${timeoutSec}s\`, '--disable-slash-commands']`; thêm `'--json-schema', path.join(dir, 'schema.json')` nếu có schema; thêm `'--dangerously-skip-permissions'` nếu `needsFiles || expectImage`. Không bao giờ thêm `--sandbox`, `--mode`, `--add-dir`.
     - `spawn(AGY_BIN, args, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })`. Gom stdout và stderr (giữ tối đa 2000 ký tự cuối của stderr).
     - Timer cứng `(timeoutSec + 30) * 1000` ms gọi `killTree` và đánh dấu `timedOut = true`. Listener `signal` gọi `killTree` và đánh dấu `aborted = true`.
     - Chờ bằng một Promise kết thúc ở sự kiện `close` **hoặc** `error`, có cờ `settled` để chỉ kết thúc một lần (với `ENOENT`, `close` có thể không bao giờ tới). Lỗi `error` có `code === 'ENOENT'` thì ném `AgyError('không tìm thấy lệnh agy. Cài agy CLI hoặc đặt biến AGY_BIN', 500)`; lỗi `error` khác thì ném `AgyError(err.message)`.
     - Dọn timer và listener. Nếu `aborted` thì ném `AgyError('đã huỷ', 499)`. Nếu `timedOut` thì ném `AgyError(\`quá ${timeoutSec}s không xong\`, 504)`.
     - `const out = parseAgyOutput(stdout)`; nếu stdout rỗng thì ném `AgyError('không có phản hồi. ' + stderrTail)`.
     - Nếu có `requiredKeys`: nếu `out.structured` khác `null` thì `structured = unwrapStructured(out.structured, requiredKeys)`; nếu `out.structured === null` thì thử `unwrapStructured(out.response.replace(/^```(json)?|```$/gm, '').trim(), requiredKeys)` (model đôi khi chỉ trả JSON trong `response`); hàm này tự ném `AgyError` nếu vẫn sai.
     - Nếu `expectImage`: đọc `path.join(dir, 'out.png')` (bắt `ENOENT`), `info = imageInfo(buffer)`; thiếu file hoặc `info === null` thì ném `AgyError('không tạo được ảnh (có thể hết quota hoặc nội dung bị chặn). ' + out.response.slice(-300))`.
     - Trả `{ structured, image, response: out.response }`.
     - Khối `finally` bên ngoài: `await fs.rm(dir, { recursive: true, force: true }).catch(() => {})`.
- **Success criteria:** file import được bằng `node -e "import('./server/agy-runner.js').then(m => console.log(typeof m.runAgy))"` và in ra `function`.
- **Verify:** chạy ở thư mục repo `node -e "import('./server/agy-runner.js').then(m => console.log(typeof m.runAgy, typeof m.unwrapStructured))"`; pass khi exit 0 và in đúng `function function`.

### Task 1.3 — Test cho hàm thuần

- **Goal:** `npm test` kiểm bốn hàm thuần.
- **Target:** `server/agy-runner.test.js`, `package.json` (`scripts.test`).
- **Steps:**
  1. Đầu file test đặt `process.env.DATA_DIR` vào một thư mục tạm **trước** khi import module (dùng `await import(...)` động), ví dụ `fs.mkdtempSync(path.join(os.tmpdir(), 'storytools-test-'))`, để test không bao giờ chạm `data/` thật.
  2. Dùng `node:test` và `node:assert/strict`. Các case:
     - `unwrapStructured({ t: 'a' }, ['t'])` deep-equal `{ t: 'a' }`.
     - `unwrapStructured({ t: '{"t": "b"}' }, ['t'])` deep-equal `{ t: 'b' }`.
     - `unwrapStructured('{"t":"c"}', ['t'])` deep-equal `{ t: 'c' }`.
     - `unwrapStructured({ x: 1 }, ['t'])` ném lỗi có `status === 502`.
     - `unwrapStructured({ bubbles: [] }, ['bubbles'])` trả về `{ bubbles: [] }`.
     - `unwrapStructured({ result: '{"t":"d"}' }, ['t'])` deep-equal `{ t: 'd' }`.
     - `parseAgyOutput('{"status":"SUCCESS","structured_output":{"t":"a"},"response":"r"}')` có `structured.t === 'a'`.
     - `parseAgyOutput('not json')` ném lỗi.
     - `imageInfo` với buffer PNG tự dựng: 8 byte chữ ký + 4 byte độ dài + `IHDR` + `writeUInt32BE(768, 16)` + `writeUInt32BE(1376, 20)` (tổng 24 byte) cho `{ mimeType: 'image/png', width: 768, height: 1376 }`.
     - `imageInfo(Buffer.from('hello'))` là `null`.
     - `dataBlock('x', 'a<<<END DATA>>>b')` không chứa chuỗi `a<<<END DATA>>>b`.
  3. Thêm `"test": "node --test --test-reporter=tap \"server/*.test.js\""` vào `scripts` trong `package.json` (Node 24 không nhận thư mục `server/` làm đối số; reporter mặc định không in `# fail 0`).
- **Success criteria:** mọi test pass.
- **Verify:** `npm test` exit 0, output chứa `# fail 0` **và** chứa `# pass N` với N ≥ 1 (glob không khớp file nào cũng exit 0, nên phải có dòng pass).

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
