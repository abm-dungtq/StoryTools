---
phase: 4
title: "Prompt theo từng nhân vật, tên file ảnh mẫu theo nhân vật, nhãn ảnh khung trước"
status: pending
depends_on: [2, 3]
---

# Phase 4 — Prompt và nhãn ảnh mẫu

## Mục tiêu

Prompt vẽ có một dòng cho mỗi nhân vật: vị trí, tên, đặc điểm, mô tả, tên file ảnh mẫu của **chính người đó**. Server đặt đúng tên file đó trong thư mục job của agy, gắn nhãn ảnh mẫu kèm đặc điểm, và với khung từ 2 nhân vật thì nói rõ ảnh khung trước chỉ dùng để lấy phong cách.

## File

- Tạo `src/lib/ref-names.js` (dùng chung client và server).
- Sửa `src/lib/prompt-builder.js`: `buildFramePrompt`.
- Tạo `src/lib/prompt-builder.test.js`.
- Sửa `server/index.js`: route `images/generate`.
- Sửa `server/agy.js`: `generateImage` (tên file job).
- Sửa `package.json`: script `test`.

## Tasks

### Task 4.1 — `src/lib/ref-names.js`

- **Steps:** tạo file với nội dung:
  ```js
  // Names of reference image files inside an agy job dir. The prompt builder (client) and the image route (server)
  // both use them, so a prompt line can point at exactly one character's picture.
  export const characterRefName = (characterId, index, file) =>
    `char-${characterId}-${index + 1}.${String(file).split('.').pop().toLowerCase()}`;

  export const styleRefName = (file) => `previous-panel.${String(file).split('.').pop().toLowerCase()}`;
  ```
- **Verify:** no verification needed (Task 4.4 kiểm).

### Task 4.2 — `buildFramePrompt` mới

- **Target:** `src/lib/prompt-builder.js`.
- **Steps:**
  1. Thêm ở đầu file (sau comment dòng 1): `import { characterRefName } from './ref-names.js';`
  2. Thêm phía trên `export function buildFramePrompt`:
     ```js
     const POSITION_LABEL = { left: 'LEFT', center: 'CENTER', right: 'RIGHT' };
     const POSITION_ORDER = { left: 0, center: 1, right: 2 };

     /** One line per character: where they stand, who they are, what tells them apart, and which file shows them. */
     function castLine(character, position) {
       const parts = [`${POSITION_LABEL[position] || 'ANY POSITION'}: ${character.name}`];
       if (character.traits?.trim()) parts.push(`distinguishing traits: ${character.traits.trim()}`);
       if (character.description?.trim()) parts.push(`description: ${character.description.trim()}`);
       const refs = (character.images || []).map((file, i) => characterRefName(character.id, i, file));
       parts.push(refs.length ? `reference image: ${refs.join(', ')}` : 'no reference image');
       return `- ${parts.join(' | ')}`;
     }
     ```
  3. Trong `buildFramePrompt`, thay khối:
     ```js
       if (cast.length) {
         lines.push('Characters (keep their appearance EXACTLY as described and as in the reference images):');
         cast.forEach((c) => lines.push(`- ${c.name}: ${c.description}`));
       } else {
     ```
     bằng:
     ```js
       if (cast.length) {
         const positions = frame.positions || {};
         lines.push(
           cast.length > 1
             ? 'Characters, listed left to right. Each is a DIFFERENT person: never swap or blend faces, hair, skin, clothes or accessories between them; each one matches only their own traits and their own reference image:'
             : 'Character (keep the appearance EXACTLY as described and as in the reference image):',
         );
         [...cast]
           .sort((a, b) => (POSITION_ORDER[positions[a.id]] ?? 1) - (POSITION_ORDER[positions[b.id]] ?? 1))
           .forEach((c) => lines.push(castLine(c, positions[c.id])));
       } else {
     ```
     Giữ nguyên mọi dòng khác của hàm.
- **Verify:** no verification needed (Task 4.4 kiểm).

### Task 4.3 — Server đặt tên file và nhãn

- **Target:** `server/index.js` route `app.post('/api/projects/:id/images/generate', …)`; `server/agy.js` `generateImage`.
- **Steps:**
  1. `server/index.js`: thêm import `import { characterRefName, styleRefName } from '../src/lib/ref-names.js';` cạnh các import khác.
  2. Thay vòng lặp tạo `refs` cho nhân vật bằng:
     ```js
     for (const c of characters) {
       for (const [i, file] of (c.images || []).entries()) {
         refs.push({
           name: characterRefName(c.id, i, file),
           label: `Reference image of "${c.name}"${c.traits?.trim() ? ` (${c.traits.trim()})` : ''}. Shows only this character.`,
           ...(await store.readImageAsInline(store.CHARACTER_IMAGE_DIR, file)),
         });
       }
     }
     ```
  3. Thay khối `if (styleRefImage) { refs.push({ … }); }` bằng:
     ```js
     if (styleRefImage) {
       refs.push({
         name: styleRefName(styleRefImage),
         // With several people the previous panel is the main source of swapped outfits, so it may only lend its style.
         label:
           characters.length > 1
             ? 'Previous panel of the same comic. Use it ONLY for art style, line work and color palette. Do NOT copy who stands where, who wears what, or any face from it.'
             : 'Previous panel of the same comic – match its art style, color palette and character design',
         ...(await store.readImageAsInline(frameDir, styleRefImage)),
       });
     }
     ```
  4. `server/agy.js` trong `generateImage`, đổi dòng tạo `files` thành:
     ```js
     const files = refs.map((ref, i) => ({ name: ref.name || `ref-${i + 1}.${extOf(ref.mimeType)}`, data: Buffer.from(ref.data, 'base64') }));
     ```
     và cập nhật JSDoc `refs: {label, mimeType, data}[]` thành `refs: {name?, label, mimeType, data}[]`.
- **Verify:** `node -e "import('./server/agy.js').then(()=>import('./src/lib/ref-names.js')).then(m=>console.log(m.characterRefName('ch225c1n',0,'a.PNG')))"` in ra `char-ch225c1n-1.png`.

### Task 4.4 — Test `buildFramePrompt`

- **Target:** tạo `src/lib/prompt-builder.test.js`; sửa `package.json`.
- **Steps:**
  1. Nội dung test:
     ```js
     import { test } from 'node:test';
     import assert from 'node:assert/strict';
     import { buildFramePrompt } from './prompt-builder.js';
     import { characterRefName } from './ref-names.js';

     const project = { style: 'soft comic' };
     const slide = { idea: '' };
     const lan = { id: 'chlan001', name: 'Lan', description: 'cô gái 20 tuổi', traits: 'áo dài đỏ, tóc đuôi ngựa', images: ['1-a.png'] };
     const hung = { id: 'chhung01', name: 'Hùng', description: 'ông lão', traits: 'kính tròn, áo bà ba nâu', images: ['2-b.jpg', '3-c.webp'] };
     const frame = (patch) => ({ characterIds: [], dialogues: [], positions: {}, ...patch });

     test('one line per character with position, traits and their own reference files', () => {
       const prompt = buildFramePrompt(project, slide, frame({ characterIds: ['chlan001', 'chhung01'], positions: { chlan001: 'left', chhung01: 'right' } }), [lan, hung]);
       assert.match(prompt, /^- LEFT: Lan \| distinguishing traits: áo dài đỏ, tóc đuôi ngựa \| description: cô gái 20 tuổi \| reference image: char-chlan001-1\.png$/m);
       assert.match(prompt, /^- RIGHT: Hùng \| .* \| reference image: char-chhung01-1\.jpg, char-chhung01-2\.webp$/m);
       assert.match(prompt, /DIFFERENT person/);
     });

     test('characters are listed left to right whatever the cast order', () => {
       const prompt = buildFramePrompt(project, slide, frame({ characterIds: ['chlan001', 'chhung01'], positions: { chlan001: 'right', chhung01: 'left' } }), [lan, hung]);
       assert.ok(prompt.indexOf('LEFT: Hùng') < prompt.indexOf('RIGHT: Lan'));
     });

     test('missing position, traits and images still produce a usable line', () => {
       const plain = { id: 'chx', name: 'X', description: '', images: [] };
       const prompt = buildFramePrompt(project, slide, frame({ characterIds: ['chx'] }), [plain]);
       assert.match(prompt, /^- ANY POSITION: X \| no reference image$/m);
       assert.doesNotMatch(prompt, /DIFFERENT person/);
     });

     test('panel without characters is an establishing shot', () => {
       assert.match(buildFramePrompt(project, slide, frame({}), [lan]), /No main characters/);
     });

     test('reference file names are lower-case and 1-based', () => {
       assert.equal(characterRefName('abc', 0, 'x.JPG'), 'char-abc-1.jpg');
     });
     ```
  2. Trong `package.json`, đổi script `test` thành:
     `"test": "node --test --test-reporter=tap \"server/*.test.js\" \"src/lib/*.test.js\""`
- **Success criteria:** mọi test qua, build qua.
- **Verify:** `npm test 2>&1 | grep -E '^# (pass|fail)'` in ra `# pass 15` và `# fail 0`; `npm run build` thoát mã 0. Nếu số `pass` khác 15 nhưng `fail` là 0, ghi lại con số thật và tiếp tục; nếu `fail` khác 0, áp dụng Failure Protocol.

### Task 4.5 — Kiểm thư mục job chứa đúng tên file

- **Goal:** khi vẽ, job dir của agy có `char-<id>-1.<ext>`, không còn `ref-1.*` cho ảnh nhân vật.
- **Steps:** không gọi agy. Chạy kiểm tĩnh:
  ```bash
  grep -n "characterRefName(c.id, i, file)" server/index.js
  grep -n "ref.name ||" server/agy.js
  ```
- **Verify:** mỗi lệnh in ra đúng một dòng.

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
