---
phase: 2
title: "Đặc điểm nhận dạng nhân vật do agy rút từ ảnh mẫu"
status: pending
depends_on: [1]
---

# Phase 2 — Trường `traits`

## Mục tiêu

Mỗi nhân vật có chuỗi `traits`: các đặc điểm nhìn thấy được, phân biệt người này với người khác (ví dụ "tóc đen rối xù, áo polo vàng mù tạt, tạp dề xanh rêu"). agy đọc ảnh mẫu **một lần** khi thêm ảnh (nếu `traits` đang trống) hoặc khi bấm "Rút lại". Không gọi AI trong lúc vẽ khung.

## File

- Sửa `server/agy.js`: thêm `describeCharacter`.
- Sửa `server/index.js`: thêm route `POST /api/characters/traits`.
- Sửa `src/api.js`: thêm `extractCharacterTraits`.
- Sửa `src/components/characters-view.jsx`: ô "Đặc điểm nhận dạng", nút "Rút lại", tự rút sau khi tải ảnh.

## Tasks

### Task 2.1 — `describeCharacter` trong `server/agy.js`

- **Goal:** hàm export trả `{ traits: string }` từ 1–3 ảnh mẫu.
- **Target:** `server/agy.js`, đặt ngay trước khối comment `/**` mở đầu bằng `Looks at a generated frame` (khối JSDoc của `placeBubbles`, nằm sau dòng `const extOf = …`).
- **Steps:** thêm đoạn sau (giữ nguyên các hàm khác):
  ```js
  const TRAITS_SCHEMA = {
    type: 'object',
    properties: {
      traits: { type: 'string', description: 'Đặc điểm nhìn thấy được, ngăn cách bằng dấu phẩy' },
    },
    required: ['traits'],
  };

  /** Reads a character's reference images once and lists the visible traits that tell them apart from others. */
  export async function describeCharacter({ settings, name, description, images, signal }) {
    const files = images.slice(0, 3).map((img, i) => ({ name: `character-${i + 1}.${extOf(img.mimeType)}`, data: Buffer.from(img.data, 'base64') }));
    const prompt = `Mở và xem các file ảnh mẫu của một nhân vật truyện tranh: ${files.map((f) => f.name).join(', ')}.
  Tên nhân vật:
  ${dataBlock('tên', name || '(chưa đặt tên)')}
  Mô tả người dùng đã viết:
  ${dataBlock('mô tả', description || '(chưa có)')}

  Nhiệm vụ: liệt kê 5–8 đặc điểm NHÌN THẤY ĐƯỢC giúp phân biệt nhân vật này với người khác trong cùng khung: tuổi và dáng người, kiểu và màu tóc, màu da, kính hoặc phụ kiện, trang phục kèm màu cụ thể.
  Viết tiếng Việt, mỗi đặc điểm vài từ, ngăn cách bằng dấu phẩy, tổng tối đa khoảng 40 từ. Không mô tả biểu cảm, tư thế hay nền ảnh.`;
    const data = await generateJson(settings, prompt, TRAITS_SCHEMA, {
      files,
      allowRead: `Ngoại lệ duy nhất: được phép đọc các file ${files.map((f) => f.name).join(', ')}.`,
      timeoutSec: 180,
      signal,
    });
    return { traits: String(data.traits || '').trim() };
  }
  ```
  `extOf`, `dataBlock`, `generateJson` đã có sẵn trong file; không import thêm. Kiểm: `grep -n "const extOf\|function extOf" server/agy.js` phải in ra một dòng; nếu không có, áp dụng Failure Protocol.
- **Success criteria:** `server/agy.js` export `describeCharacter`.
- **Verify:** `node -e "import('./server/agy.js').then(m=>console.log(typeof m.describeCharacter))"` in ra `function`.

### Task 2.2 — Route `POST /api/characters/traits`

- **Goal:** client gửi tên, mô tả và danh sách file ảnh mẫu, nhận `{ traits }`.
- **Target:** `server/index.js`, ngay sau route `app.post('/api/characters/images', …)`.
- **Steps:**
  1. Thêm `describeCharacter` vào dòng import từ `./agy.js`.
  2. Thêm route:
     ```js
     // Reads the reference images once and returns visible traits. The client sends the list itself: autosave may lag behind.
     app.post('/api/characters/traits', async (req, res) => {
       const { name = '', description = '', images } = req.body || {};
       if (!Array.isArray(images) || !images.length) return res.status(400).json({ error: 'Nhân vật chưa có ảnh mẫu' });
       const inline = [];
       for (const file of images.slice(0, 3)) inline.push(await store.readImageAsInline(store.CHARACTER_IMAGE_DIR, String(file)));
       const { traits } = await describeCharacter({
         settings: await store.getSettings(),
         name: String(name),
         description: String(description),
         images: inline,
         signal: clientSignal(res),
       });
       res.json({ traits });
     });
     ```
     `readImageAsInline` đã gọi `assertSafeName`, nên tên file kiểu `../x` bị từ chối với 400.
- **Success criteria:** route trả 400 khi không có ảnh.
- **Verify:** chạy server tạm và gọi route với danh sách rỗng. Biến shell không giữ qua các lần gọi tool, nên mỗi khối lệnh phải đặt lại `T`.
  1. Khởi động server bằng công cụ chạy nền của harness (run_in_background), KHÔNG dùng `&` (tiến trình `&` có thể bị tắt khi lần gọi tool kết thúc, và `$!` là PID của MSYS, không dùng được cho `taskkill`):
     ```bash
     T=$(cygpath -m "$TEMP")/st-p2; mkdir -p "$T"; DATA_DIR="$T/data" PORT=5176 node server/index.js
     ```
  2. Trong một lần gọi tool khác, chờ server sẵn sàng rồi gọi route:
     ```bash
     for i in $(seq 1 15); do curl -sf http://127.0.0.1:5176/api/settings >/dev/null && break; sleep 1; done
     curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:5176/api/characters/traits -H 'content-type: application/json' -d '{"images":[]}'
     ```
  In ra `400`. Giữ server này cho Task 2.5.

### Task 2.3 — `src/api.js`

- **Goal:** client gọi được route.
- **Steps:** trong object `api`, ngay sau dòng `uploadCharacterImage: …`, thêm:
  ```js
  extractCharacterTraits: (character, signal) =>
    request('POST', '/api/characters/traits', { name: character.name, description: character.description, images: character.images || [] }, signal),
  ```
- **Verify:** no verification needed (Task 2.4 và build kiểm).

### Task 2.4 — UI trong `src/components/characters-view.jsx`

- **Goal:** ô sửa đặc điểm, nút "Rút lại", tự rút sau khi tải ảnh nếu `traits` trống.
- **Steps:**
  1. Thêm state theo dõi nhân vật đang rút: `const [extracting, setExtracting] = useState({});` ngay dưới `const [error, setError] = useState('');`.
  2. Thêm hàm (đặt sau `upload`):
     ```js
     // One agy vision call per character, only when asked or when traits are still empty; never during frame drawing.
     async function extractTraits(character, { onlyIfEmpty = false } = {}) {
       if (!character.images?.length) return;
       setError('');
       setExtracting((m) => ({ ...m, [character.id]: true }));
       try {
         const { traits } = await api.extractCharacterTraits(character);
         // An automatic run must not overwrite traits the user typed while agy was reading the images.
         setCharacters((list) => list.map((c) => (c.id === character.id && (!onlyIfEmpty || !c.traits?.trim()) ? { ...c, traits } : c)));
       } catch (err) {
         setError(`Không rút được đặc điểm của ${character.name}: ${err.message}`);
       } finally {
         setExtracting((m) => ({ ...m, [character.id]: false }));
       }
     }
     ```
  3. Trong `upload`, giữ nguyên dòng `setCharacters((list) => list.map((c) => (c.id === id ? { ...c, images: [...(c.images || []), ...files] } : c)));` và thêm ngay sau nó:
     ```js
     // React may run the updater above later, so build the extraction input from the current props instead.
     const current = characters.find((c) => c.id === id);
     if (current && !current.traits?.trim()) extractTraits({ ...current, images: [...(current.images || []), ...files] }, { onlyIfEmpty: true });
     ```
  4. Trong `add`, thêm `traits: ''` vào object nhân vật mới.
  5. Ngay sau `<textarea … />` mô tả (trước `<div className="thumbs">`), thêm:
     ```jsx
     <div className="stack tight">
       <div className="row between">
         <span className="small">Đặc điểm nhận dạng (AI rút từ ảnh mẫu, sửa được)</span>
         <button disabled={!c.images?.length || extracting[c.id]} onClick={() => extractTraits(c)}>
           {extracting[c.id] ? 'Đang rút…' : 'Rút lại'}
         </button>
       </div>
       <textarea
         rows={2}
         value={c.traits || ''}
         onChange={(e) => update(c.id, { traits: e.target.value })}
         placeholder="VD: tóc đen rối xù, áo polo vàng mù tạt, tạp dề xanh rêu, giày vải đỏ"
       />
     </div>
     ```
     Dùng `<div>`, không dùng `<label>`: một `<label>` bọc cả nút và textarea sẽ gắn với phần tử gán nhãn đầu tiên là `<button>`, nên bấm vào dòng chữ cũng kích hoạt "Rút lại".
- **Success criteria:** build qua, chuỗi "Rút lại" có trong file.
- **Verify:** `npm run build` thoát mã 0, và `grep -c "Rút lại" src/components/characters-view.jsx` in ra số ≥ `1`.

### Task 2.5 — Thử thật với agy (một lần gọi)

- **Goal:** route trả đặc điểm thật từ một ảnh.
- **Steps:**
  1. Chép ảnh mẫu của Minh vào thư mục tạm (chỉ đọc dữ liệu thật):
     ```bash
     T=$(cygpath -m "$TEMP")/st-p2; mkdir -p "$T/data/characters"
     F=$(node -e "const c=require('./data/characters.json').find(x=>x.name==='Minh');console.log(c.images[0])")
     cp "data/characters/$F" "$T/data/characters/"
     curl -s -X POST http://127.0.0.1:5176/api/characters/traits -H 'content-type: application/json' -d "{\"name\":\"Minh\",\"description\":\"\",\"images\":[\"$F\"]}"
     ```
  2. Dừng server tạm bằng PID Windows lấy từ netstat: `MSYS_NO_PATHCONV=1 taskkill /T /F /PID $(netstat -ano | grep '127.0.0.1:5176 .*LISTENING' | awk '{print $5}' | head -1)` rồi `rm -rf "$T"`.
- **Success criteria:** JSON có `traits` là chuỗi không rỗng.
- **Verify:** đầu ra curl khớp regex `"traits":"[^"]{10,}"`; sau khi dừng, `netstat -ano | grep -c '127.0.0.1:5176 .*LISTENING'` in ra `0`.

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
