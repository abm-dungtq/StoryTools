---
phase: 4
title: "Client: huỷ thật, báo lỗi đặt thoại, UI không còn Gemini"
status: completed
depends_on: [2]
---

# Phase 4 — Client: huỷ thật, báo lỗi đặt thoại, UI không còn Gemini

## Mục tiêu

1. Bấm **Dừng** hoặc rời màn hình đang chạy sẽ huỷ ngay request đang chờ; server (phase 2) nhận `close` và diệt cây tiến trình agy.
2. Đặt bóng thoại thất bại thì được đánh dấu, hiện lỗi, và lần chạy tiếp thử lại.
3. UI không còn ô API key, giá USD, banner thiếu key, hay chữ "Gemini"; thay bằng model agy và thời gian ước tính.

## File

- Sửa `src/api.js`, `src/lib/frame-generation.js`, `src/hooks/use-story-automation.js`, `src/components/frames-step.jsx`, `src/components/script-step.jsx`, `src/components/settings-view.jsx`, `src/components/image-model-select.jsx`, `src/components/compose-step.jsx`, `src/components/publish-panel.jsx`, `src/app.jsx`, `src/lib/layouts.js` (chỉ comment).
- Xoá `src/lib/cost-estimate.js`. Tạo `src/lib/time-estimate.js`.

## Tasks

### Task 4.1 — `signal` trong lớp gọi API

- **Goal:** các lời gọi AI nhận `AbortSignal` tuỳ chọn.
- **Target:** `src/api.js` (`request`, `api.generateFrames`, `api.planStory`, `api.placeBubbles`, `api.generateImage`, `api.generateCaption`); `src/lib/frame-generation.js` (`generateFrameImage`, `placeBubblesFromImage`).
- **Steps:**
  1. `request(method, url, body, signal)` truyền `signal` vào `fetch`.
  2. Năm hàm AI trong `api` nhận tham số thứ ba `signal` và truyền tiếp, ví dụ `planStory: (id, body, signal) => request('POST', \`/api/projects/${id}/story/plan\`, body, signal)`.
  3. Thêm export `export const isAbort = (err) => err?.name === 'AbortError';` trong `src/api.js`.
  4. `generateFrameImage(project, entry, characters, styleRefImage, signal)` truyền `signal` vào `api.generateImage`.
  5. `placeBubblesFromImage(project, entry, characters, file = entry.frame.selectedImage, signal)` truyền `signal` vào `api.placeBubbles`; đối tượng trả về thêm `bubblePlacementFailed: false` (thành công thì xoá cờ lỗi). Đổi comment "Asks Gemini" thành "Asks the AI".
- **Success criteria:** mọi chỗ gọi cũ vẫn hợp lệ vì tham số mới là tuỳ chọn.
- **Verify:** `npm run build` exit 0.

### Task 4.2 — Automation huỷ được và không nuốt lỗi đặt thoại

- **Goal:** `useStoryAutomation` huỷ request khi Dừng hoặc unmount, và ghi nhận khung đặt thoại lỗi.
- **Target:** `src/hooks/use-story-automation.js` (`pendingFrames`, `useStoryAutomation`, `writeStory`, `fillFrames`, `run`).
- **Steps:**
  1. Import thêm `useEffect` và `isAbort`.
  2. Thêm `const needsBubbles = (frame) => hasDialogue(frame) && (frame.bubbles == null || frame.bubblePlacementFailed);` và đổi `pendingFrames` thành `frameEntries(project).filter((e) => !e.frame.selectedImage || needsBubbles(e.frame))`.
  3. Thêm `const controllerRef = useRef(null);` và effect `useEffect(() => () => controllerRef.current?.abort(), []);` (comment: `// Leaving the editor cancels the running agy call instead of paying for a result nobody saves.`).
  4. Trong `run(task)`: tạo `controllerRef.current = new AbortController()` trước `task()`. Trong `catch`, nếu `isAbort(err)` thì không `setError` mà `return false`. Trong `finally` đặt `controllerRef.current = null`.
  5. `writeStory`: truyền `controllerRef.current.signal` vào `api.planStory` (tham số thứ ba). Đổi nhãn tiến độ thành `'AI đang viết kịch bản…'`.
  6. `fillFrames`:
     - truyền `controllerRef.current.signal` vào `generateFrameImage` (tham số thứ năm) và `placeBubblesFromImage` (tham số thứ năm);
     - điều kiện đặt thoại đổi thành `if (needsBubbles(e.frame))`;
     - thay khối `catch {}` bằng:
       ```js
       } catch (err) {
         if (isAbort(err)) throw err;
         // Keep going with the other frames, but remember this one so the next run retries it.
         updateFrame(e.frame.id, { bubblePlacementFailed: true });
         failed.push(label);
       }
       ```
       với `const failed = [];` khai báo đầu hàm;
     - sau vòng lặp: nếu `failed.length` thì `setError(\`Chưa đặt được lời thoại tự động cho ${failed.join(', ')}. Bấm "Vẽ khung còn thiếu & đặt thoại" để thử lại, hoặc dùng ✨ AI đặt thoại ở bước 3.\`)`.
  7. `stop`: đặt `stopRef.current = true` và gọi `controllerRef.current?.abort()`.
  8. Viết cả hai lời huỷ (bước 3 và bước 7) đúng nguyên văn `controllerRef.current?.abort()` để lệnh Verify đếm được.
- **Success criteria:** không còn khối `catch {` rỗng trong file.
- **Verify:** `grep -c "catch {" src/hooks/use-story-automation.js` in ra `0` (grep -c in `0` thì exit code 1; chỉ xét stdout, exit 1 ở đây là bình thường), **và** `grep -c "controllerRef.current?.abort()" src/hooks/use-story-automation.js` in ra `2`, **và** `npm run build` exit 0.

### Task 4.3 — Bước Vẽ khung: huỷ và ghi nhận lỗi đặt thoại

- **Goal:** batch vẽ ở bước 2 huỷ được ngay và không nuốt lỗi đặt thoại.
- **Target:** `src/components/frames-step.jsx` (`generate`, `generateMissing`, nút Dừng).
- **Steps:**
  1. Thêm `const controllerRef = useRef(null);` và `useEffect(() => () => controllerRef.current?.abort(), []);` (import `useEffect`).
  2. Trong `generate`, lấy `const signal = controllerRef.current?.signal;` và truyền vào `generateFrameImage(..., signal)`. Với lời gọi `placeBubblesFromImage(p, entry, characters, file)` thay `.catch(() => {})` bằng `.catch((err) => !isAbort(err) && updateFrame(frameId, { bubblePlacementFailed: true }))`.
  3. Trong `catch (err)` của `generate`: nếu `isAbort(err)` thì `return null` mà không ghi lỗi.
  4. `generateMissing`: đầu hàm `controllerRef.current = new AbortController();`, cuối hàm (sau vòng lặp) `controllerRef.current = null;`; trong vòng lặp dừng khi `controllerRef.current?.signal.aborted`.
  5. Nút Dừng: đổi nhãn thành `Dừng` và `onClick={() => { stopRef.current = true; controllerRef.current?.abort(); }}`.
  6. Nút vẽ lẻ (`generate(frame.id)` từ nút trên từng khung): không cần huỷ; giữ nguyên (khi đó `signal` là `undefined`).
  7. Đổi comment "let Gemini place" thành "let the AI place".
  8. Thay `<ImageModelSelect … frames={missing} …>` giữ nguyên props (component được viết lại ở Task 4.5).
- **Success criteria:** không còn `.catch(() => {})` trong file.
- **Verify:** `grep -c "catch(() => {})" src/components/frames-step.jsx` in ra `0` (grep -c in `0` thì exit code 1; chỉ xét stdout, exit 1 ở đây là bình thường) và `npm run build` exit 0.

### Task 4.4 — Thời gian ước tính thay giá tiền

- **Goal:** bỏ giá USD, hiện thời gian.
- **Target:** xoá `src/lib/cost-estimate.js`; tạo `src/lib/time-estimate.js`.
- **Steps:**
  1. Nội dung `src/lib/time-estimate.js`:
     ```js
     // Rough wall-clock time per frame through agy (measured 2026-10: ~75 s drawing + ~15 s bubble placement).
     export const SECONDS_PER_FRAME = 90;

     /** "~12 phút" or "~1 giờ 45 phút" for drawing `frames` frames one after another. */
     export function formatDuration(frames) {
       const minutes = Math.max(1, Math.ceil((frames * SECONDS_PER_FRAME) / 60));
       return minutes < 60 ? `~${minutes} phút` : `~${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`;
     }
     ```
  2. Xoá `src/lib/cost-estimate.js`.
- **Verify:** no verification needed (Task 4.6 kiểm build và grep).

### Task 4.5 — Chọn model agy và Cài đặt

- **Goal:** dropdown và trang Cài đặt dùng danh sách `agy models`.
- **Target:** `src/components/image-model-select.jsx` (`ImageModelSelect`), `src/components/settings-view.jsx` (`SettingsView`).
- **Steps:**
  1. Viết lại `ImageModelSelect({ value, onChange, frames = 0, disabled = false, stacked = false })`:
     - lấy danh sách bằng một promise dùng chung cấp module: `let modelsPromise; const loadModels = () => (modelsPromise ??= api.listModels().catch(() => ({ image: [] })));` và `useEffect` gọi `loadModels().then((m) => setOptions(m.image))`;
     - nếu `value` không có trong danh sách thì thêm vào đầu danh sách;
     - nhãn `Model điều khiển vẽ ảnh (agy)`; mỗi option chỉ hiện id;
     - khi `frames > 0`: `≈ {formatDuration(frames)} cho {frames} khung (vẽ lần lượt, chưa tính vẽ lại)`.
  2. `SettingsView`:
     - bỏ state `apiKey`, ô nhập key, ghi chú key và "không có free tier";
     - `FALLBACK_MODELS = { text: ['gemini-4-argon-medium', 'gemini-3.8-flash-medium', 'gemini-3.8-flash-low'], image: ['gemini-3.8-flash-low'] }`;
     - luôn gọi `api.listModels()` (bỏ điều kiện `hasApiKey`), ghi chú `Danh sách lấy từ lệnh agy models (${list.text.length} model).`;
     - tiêu đề `Cài đặt AI (agy CLI)`;
     - nếu `settings?.agyVersion` có giá trị: hiện `Đang dùng agy {settings.agyVersion}, chạy bằng gói đăng ký đã đăng nhập trên máy, không cần API key.`; nếu không: hiện dòng lỗi `Không tìm thấy agy CLI. Cài agy và đăng nhập, hoặc đặt AGY_BIN trong file .env.`;
     - ghi chú dưới model ảnh: `agy tự chọn model vẽ ảnh; ô này chọn model điều khiển việc vẽ. Mỗi khung mất khoảng 70–90 giây.`;
     - `save` gửi `{ textModel, imageModel }`.
- **Verify:** no verification needed (Task 4.6 kiểm).

### Task 4.6 — Bỏ chữ Gemini và banner key

- **Goal:** không còn chuỗi Gemini, giá USD, key trong `src/`.
- **Target:** `src/app.jsx` (banner dòng 46–50), `src/components/script-step.jsx` (dòng 4, 35, 48, 54, 58, 167, 200, 241, 262), `src/components/compose-step.jsx` (dòng 289), `src/components/publish-panel.jsx` (dòng 127), `src/lib/layouts.js` (dòng 59).
- **Steps:**
  1. `src/app.jsx`: banner hiện khi `settings && !settings.agyVersion`, nội dung `Không tìm thấy agy CLI. Cài agy, đăng nhập, rồi khởi động lại server (hoặc đặt AGY_BIN trong .env).`
  2. `script-step.jsx`: import `formatDuration` từ `../lib/time-estimate.js` thay cho cost-estimate; bỏ `perImage`; thông điệp xác nhận chạy:
     `` `AI sẽ viết ${slideCount} ảnh rồi vẽ khoảng ${plannedFrames} khung, mất ${formatDuration(plannedFrames)} (model ${imageModel}).\nCó thể chuyển tab, nhưng đừng đóng trang.\n\nTiếp tục?` ``;
     thông điệp resume: `` `Vẽ ${missingImages} khung còn thiếu, mất ${formatDuration(missingImages)}. Tiếp tục?` ``;
     đổi mọi chữ "Gemini" thành "AI" (ví dụ `AI tự chọn (1–3)`, `AI đang viết…`, `✨ AI viết ${n} khung`).
  3. `compose-step.jsx` dòng 289: `title="AI xem ảnh để đặt bóng thoại vào vùng trống, đuôi chỉ về người nói"`.
  3b. `compose-step.jsx`: khi người dùng tự sửa bóng thoại thì xoá cờ lỗi, để lần chạy tự động sau không ghi đè chỉnh sửa tay. Thêm `bubblePlacementFailed: false` vào object trả về ở đúng bốn chỗ sau (không sửa dòng 38, vì đó là bóng mẫu tự động):
     - dòng 66 (`updateBubble`): `({ bubbles: f.bubbles.map(...), bubblePlacementFailed: false })`;
     - dòng 270 (Xoá bóng thoại): `({ bubbles: f.bubbles.filter(...), bubblePlacementFailed: false })`;
     - dòng 297 (+ Bóng): `({ bubbles: [...(f.bubbles || []), bubble], bubblePlacementFailed: false })`;
     - dòng 306 (Đặt lại theo mẫu): `{ bubbles: placeBubbles(frame, i), bubblePlacementFailed: false }`.
     Kiểm: `grep -c "bubblePlacementFailed: false" src/components/compose-step.jsx` in ra `4`.
  4. `publish-panel.jsx` dòng 127: `'AI đang viết…' : '✨ AI viết caption'`.
  5. `layouts.js` dòng 59: `// Aspect ratios we ask the image model for.`
- **Success criteria:** UI sạch chữ Gemini và giá tiền.
- **Verify:** `grep -rn "Gemini\|cost-estimate\|formatUsd\|imageCostPerAttempt\|apiKey\|hasApiKey" src` không in dòng nào (exit code 1), **và** `grep -c "bubblePlacementFailed: false" src/components/compose-step.jsx` in ra `4`, **và** `npm run build` exit 0.

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
