// Screenshots every main screen of the running app through headless Chrome (CDP) and runs mechanical UI checks.
// Usage (from the repo root, app running on 5173/5174):
//   node plans/261023-1714-ui-redesign/capture-screens.mjs <outDir> [--checks] [--auto-run]
//        [--story "<title>"] [--width <px>] [--base <url>] [--empty]
// --checks   prints "CHECK <name> PASS|FAIL <detail>" lines and a final "CHECKS FAILED: <n>" line.
// --auto-run also creates a throwaway story through the UI, runs "Tự động tạo cả truyện" (1 image, 1 frame),
//            waits until it has an image and bubbles, prints "CHECK auto-run PASS|FAIL", then deletes that story.
// --story    title of the finished test story to open (default "[Test] Minh và chú mèo dưới mưa").
// --width    viewport width in px (default 1440); every screen also checks there is no horizontal page scroll.
// --base     app URL (default http://127.0.0.1:5173/).
// --empty    the app at --base has an empty data folder: only the list, characters and settings screens are
//            captured and checked (empty-state texts included); story-dependent checks are skipped.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeCells, getLayout } from '../../src/lib/layouts.js';

const args = process.argv.slice(2);
const VALUE_FLAGS = ['--story', '--width', '--base'];
/** Value of `--name <value>`, or `fallback` when the flag is absent. */
function argValue(name, fallback) {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  const value = args[i + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`${name} needs a value`);
  return value;
}
const outDir = args.find((a, i) => !a.startsWith('--') && !VALUE_FLAGS.includes(args[i - 1]));
if (!outDir) throw new Error('Usage: capture-screens.mjs <outDir> [--checks] [--story "<title>"] [--width <px>] [--base <url>] [--empty]');
const runChecks = args.includes('--checks');
const autoRun = args.includes('--auto-run');
const emptyMode = args.includes('--empty');
const BASE = new URL(argValue('--base', 'http://127.0.0.1:5173/')).href;
const TEST_TITLE = argValue('--story', '[Test] Minh và chú mèo dưới mưa');
const WIDTH = Number(argValue('--width', '1440'));
if (!Number.isInteger(WIDTH) || WIDTH < 320 || WIDTH > 3840) throw new Error(`--width must be an integer between 320 and 3840`);
if (emptyMode && autoRun) throw new Error('--auto-run cannot be combined with --empty');
mkdirSync(outDir, { recursive: true });

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9333;
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--window-size=${WIDTH},1000`, '--hide-scrollbars',
  `--user-data-dir=${join(tmpdir(), 'storytools-capture-profile')}`, 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 40 && !targets; i++) {
  await sleep(250);
  targets = await fetch(`http://127.0.0.1:${PORT}/json`).then((r) => r.json()).catch(() => null);
}
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let seq = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) pending.get(m.id)(m), pending.delete(m.id);
  // Accept every confirm()/alert() so flows that ask "Tiếp tục?" proceed.
  if (m.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: true });
});
function send(method, params = {}) {
  return new Promise((r) => { const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
}
const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
const api = (path, opts) => fetch(new URL(path, BASE), opts).then((r) => r.json());

let failed = 0;
const check = (name, ok, detail = '') => {
  if (!runChecks && name !== 'auto-run') return;
  if (!ok) failed++;
  console.log(`CHECK ${name} ${ok ? 'PASS' : 'FAIL'} ${detail}`.trim());
};

/** Clicks the first visible element of `selector` whose text includes `text`. */
async function click(text, selector = 'button') {
  const ok = await evaluate(`(() => {
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .find((b) => b.offsetParent !== null && b.textContent.trim().includes(${JSON.stringify(text)}));
    if (el) el.click();
    return !!el;
  })()`);
  if (!ok) console.log(`not found: ${text}`);
  await sleep(1500);
  return ok;
}

const shot = async (name, full = true) => {
  const { result } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full });
  writeFileSync(join(outDir, `${name}.png`), Buffer.from(result.data, 'base64'));
  console.log(`saved ${name}.png`);
};

/** Every label must be visible text on the current screen (innerText skips hidden elements). */
async function expectLabels(screen, labels) {
  const text = await evaluate('document.body.innerText');
  const missing = labels.filter((l) => !text.includes(l));
  check(`labels-${screen}`, missing.length === 0, missing.length ? `missing: ${missing.join(' | ')}` : '');
}

/** WCAG contrast of visible text against its nearest opaque background; reports the worst offenders. */
async function expectContrast(screen) {
  const bad = await evaluate(`(() => {
    const parse = (c) => (c.match(/[\\d.]+/g) || []).map(Number);
    const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c.length === 3 || (c.length === 4 && c[3] > 0.9)) return c; if (e.tagName === 'IMG' || e.tagName === 'CANVAS') return null; } return [255, 255, 255]; };
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set();
    while (walker.nextNode()) {
      const el = walker.currentNode.parentElement;
      if (!el || seen.has(el) || !walker.currentNode.textContent.trim() || el.offsetParent === null) continue;
      seen.add(el);
      if (el.closest('button:disabled, select:disabled, input:disabled, [aria-hidden="true"]')) continue;
      const bg = bgOf(el);
      if (!bg) continue;
      const fg = parse(getComputedStyle(el).color);
      const [a, b] = [lum(fg.slice(0, 3)), lum(bg.slice(0, 3))];
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      if (ratio < 4.5) out.push(ratio.toFixed(2) + ' "' + walker.currentNode.textContent.trim().slice(0, 30) + '"');
    }
    return out.slice(0, 5);
  })()`);
  check(`contrast-${screen}`, bad.length === 0, bad.join(' ; '));
}

const pageHeight = () => evaluate('document.documentElement.scrollHeight');

/** The page must never scroll sideways at the current viewport width. */
async function expectNoHScroll(screen) {
  const m = await evaluate('({ scroll: document.scrollingElement.scrollWidth, inner: innerWidth })');
  check(`no-hscroll-${screen}`, m.scroll <= m.inner, `scrollWidth=${m.scroll} innerWidth=${m.inner}`);
}

/**
 * Presses Tab through the screen with real key events. Every focused element must show a focus indicator
 * (outline or box-shadow) and sit outside hidden ancestors; the visiting order is only logged.
 */
async function checkFocus(screen, presses = 15) {
  await evaluate('(() => { document.activeElement?.blur(); window.scrollTo(0, 0); return true; })()');
  await sleep(200);
  const visited = [];
  const bad = [];
  for (let i = 0; i < presses; i++) {
    for (const type of ['rawKeyDown', 'keyUp']) {
      await send('Input.dispatchKeyEvent', { type, key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
    }
    await sleep(150);
    const f = await evaluate(`(() => {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) return null;
      const cs = getComputedStyle(el);
      const indicator = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none';
      const r = el.getBoundingClientRect();
      let hidden = r.width === 0 || r.height === 0;
      for (let e = el; e && !hidden; e = e.parentElement) {
        const s = getComputedStyle(e);
        hidden = e.hidden || s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0' || e.getAttribute('aria-hidden') === 'true';
      }
      const text = ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) ? el.value || el.placeholder : el.getAttribute('aria-label') || el.textContent;
      return { tag: el.tagName.toLowerCase(), label: (text || '').trim().replace(/\\s+/g, ' ').slice(0, 28), indicator, hidden, y: Math.round(r.top + scrollY), x: Math.round(r.left) };
    })()`);
    if (!f) continue;
    visited.push(f);
    if (!f.indicator || f.hidden) bad.push(`${f.tag} "${f.label}"${f.indicator ? '' : ' no-indicator'}${f.hidden ? ' hidden' : ''}`);
  }
  check(`focus-visible-${screen}`, visited.length > 0 && bad.length === 0, visited.length ? `${visited.length} stops; ${bad.slice(0, 5).join(' ; ')}` : 'Tab never focused an element');
  if (!runChecks) return;
  // Order is informational: a stop clearly above the previous one counts as a backward jump.
  const jumps = visited.filter((f, i) => i > 0 && f.y < visited[i - 1].y - 24).length;
  console.log(`FOCUS-ORDER ${screen} ${jumps ? `${jumps} backward jump(s)` : 'top-to-bottom'}: ${visited.map((f) => `${f.tag}"${f.label}"@${f.y}`).join(' > ')}`);
}

/** Opens every collapsed frame card / prompt so label checks see their content. */
const expandAll = () =>
  evaluate(`(() => { document.querySelectorAll('[data-expand]:not([aria-expanded="true"])').forEach((b) => b.click()); return true; })()`).then(() => sleep(800));

/** Compose step: the canvas geometry the bubble editor relies on, then a real double-click on the first bubble. */
async function checkCompose(project) {
  const geo = await evaluate(`(() => {
    const c = document.querySelector('canvas.compose-canvas');
    const wrap = document.querySelector('.compose-canvas-wrap');
    if (!c || !wrap) return null;
    const cs = getComputedStyle(c);
    let transformed = '';
    for (let e = c.parentElement; e; e = e.parentElement) if (getComputedStyle(e).transform !== 'none') transformed = e.className || e.tagName;
    const r = c.getBoundingClientRect();
    return { pad: cs.padding, border: cs.borderWidth, wrapPos: getComputedStyle(wrap).position, transformed, rect: { x: r.x, y: r.y, w: r.width, h: r.height } };
  })()`);
  check('compose-canvas-geometry', geo && geo.pad === '0px' && geo.border === '0px' && geo.wrapPos === 'relative' && !geo.transformed, JSON.stringify(geo && { pad: geo.pad, border: geo.border, wrapPos: geo.wrapPos, transformed: geo.transformed }));
  if (!geo) return;

  const slide = project.slides[0];
  const frameIndex = slide.frames.findIndex((f) => f.bubbles?.length);
  if (frameIndex < 0) return check('bubble-editor-align', false, 'test story has no bubble on image 1');
  const cell = computeCells(project.orientation, getLayout(project.orientation, slide.layoutId))[frameIndex];
  const bubble = slide.frames[frameIndex].bubbles[0];
  const pageW = project.orientation === 'landscape' ? 1920 : 1080;
  let rect = geo.rect;
  const pointIn = (r) => {
    const scale = r.w / pageW;
    return { x: r.x + (cell.x + bubble.cx * cell.w) * scale, y: r.y + (cell.y + bubble.cy * cell.h) * scale };
  };
  // A stacked (narrow) layout can push the bubble below the fold; mouse events only land inside the viewport.
  const viewH = await evaluate('innerHeight');
  if (pointIn(rect).y < 120 || pointIn(rect).y > viewH - 40) {
    await evaluate(`window.scrollBy(0, ${Math.round(pointIn(rect).y - viewH / 2)})`);
    await sleep(400);
    rect = await evaluate(`(() => { const r = document.querySelector('canvas.compose-canvas').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()`);
  }
  const { x, y } = pointIn(rect);
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
  }
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 2 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 2 });
  await sleep(600);
  const ed = await evaluate(`(() => { const t = document.querySelector('textarea.bubble-editor'); if (!t) return null; const r = t.getBoundingClientRect(); return { cx: r.x + r.width / 2, top: r.y }; })()`);
  const ok = ed && Math.abs(ed.cx - x) < 6 && ed.top <= y && ed.top > y - 200;
  check('bubble-editor-align', ok, ed ? `dx=${(ed.cx - x).toFixed(1)} top-above-center=${(y - ed.top).toFixed(1)}` : 'editor did not open');
  await evaluate(`document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  await sleep(300);
}

/** Stepper: four [data-step] items; for the finished test story steps script/frames/compose are data-done="true". */
async function checkStepper() {
  const steps = await evaluate(`[...document.querySelectorAll('[data-step]')].map((e) => e.dataset.step + '=' + e.dataset.done)`);
  const expected = ['script=true', 'frames=true', 'compose=true', 'preview=false'];
  check('stepper', JSON.stringify(steps) === JSON.stringify(expected), JSON.stringify(steps));
}

async function setField(labelText, tag, value) {
  return evaluate(`(() => {
    const label = [...document.querySelectorAll('label')].find((l) => l.textContent.includes(${JSON.stringify(labelText)}));
    const el = label?.querySelector(${JSON.stringify(tag)});
    if (!el) return false;
    const proto = { textarea: HTMLTextAreaElement, input: HTMLInputElement, select: HTMLSelectElement }[${JSON.stringify(tag)}].prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(String(value))});
    el.dispatchEvent(new Event(${JSON.stringify(tag === 'select' ? 'change' : 'input')}, { bubbles: true }));
    return true;
  })()`);
}

async function runAutomationThroughUi() {
  const title = `[Test UI] tự động ${Date.now()}`;
  await send('Page.navigate', { url: BASE });
  await sleep(2500);
  const typed = await evaluate(`(() => {
    const el = document.querySelector('input[placeholder="Tên truyện mới"]');
    if (!el) return false;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(title)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  const steps = [
    ['title input', typed],
    ['create', await click('Tạo truyện')],
    ['character chip', await click('Minh')],
    ['plot', await setField('Cốt truyện', 'textarea', 'Minh nhặt được một chiếc lá vàng và mỉm cười.')],
    ['slide count', await setField('Số ảnh', 'input', 1)],
    ['frames per slide', await setField('Khung mỗi ảnh', 'select', 1)],
    ['start', await click('Tự động tạo cả truyện')],
  ];
  const broken = steps.filter(([, ok]) => !ok).map(([n]) => n);
  if (broken.length) return check('auto-run', false, `UI step failed: ${broken.join(', ')}`);

  const deadline = Date.now() + 8 * 60 * 1000;
  let project;
  while (Date.now() < deadline) {
    await sleep(10000);
    const summary = (await api('/api/projects')).find((p) => p.title === title);
    if (!summary) continue;
    project = await api(`/api/projects/${summary.id}`);
    const frames = project.slides.flatMap((s) => s.frames);
    if (frames.length && frames.every((f) => f.selectedImage && Array.isArray(f.bubbles))) break;
  }
  const frames = project?.slides.flatMap((s) => s.frames) || [];
  const ok = frames.length > 0 && frames.every((f) => f.selectedImage && Array.isArray(f.bubbles));
  check('auto-run', ok, project ? `project=${project.id} frames=${frames.length}` : 'story was not created');
  if (project) await fetch(new URL(`/api/projects/${project.id}`, BASE), { method: 'DELETE' });
}

try {
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: 1000, deviceScaleFactor: 1, mobile: false });
  // Headless pages are not focused by default; keyboard focus (and :focus-visible) needs emulated focus.
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await send('Page.navigate', { url: BASE });
  await sleep(3000);
  let project = null;
  if (emptyMode) {
    const [stories, characters] = await Promise.all([api('/api/projects'), api('/api/characters')]);
    if (stories.length || characters.length) throw new Error(`--empty expects no stories and no characters at ${BASE} (found ${stories.length}/${characters.length})`);
  } else {
    const summary = (await api('/api/projects')).find((p) => p.title === TEST_TITLE);
    if (!summary) throw new Error(`Test story "${TEST_TITLE}" not found`);
    project = await api(`/api/projects/${summary.id}`);
  }

  await shot('01-project-list');
  await expectLabels('list', emptyMode ? ['Tạo truyện', 'Chưa có truyện nào'] : ['Tạo truyện', 'Xoá', TEST_TITLE]);
  await expectContrast('list');
  await expectNoHScroll('list');
  await checkFocus('list');

  await click('Nhân vật');
  await shot('02-characters');
  await expectLabels('characters', emptyMode ? ['Thêm nhân vật', 'Chưa có nhân vật nào'] : ['Thêm nhân vật', 'Rút lại', 'Đặc điểm nhận dạng']);
  await expectContrast('characters');
  await expectNoHScroll('characters');

  await click('Cài đặt');
  await shot('03-settings');
  await expectLabels('settings', ['Lưu', 'Model viết kịch bản']);
  await expectContrast('settings');
  await expectNoHScroll('settings');

  if (!emptyMode) {
    await click('Truyện');
    await click(TEST_TITLE, 'button, a, [role="button"], [data-project]');
    await shot('04-step-script');
    // The height budgets were set for a desktop window; narrower windows stack columns and grow taller by design.
    if (WIDTH >= 1200) check('height-script', (await pageHeight()) <= 1600, `${await pageHeight()}px (limit 1600)`);
    else console.log(`INFO height-script ${await pageHeight()}px (limit applies from 1200px wide)`);
    await checkStepper();
    await expectNoHScroll('script');
    await checkFocus('script');
    await expandAll();
    await expectLabels('script', ['Thiết lập truyện', 'Cốt truyện', 'Tự động tạo cả truyện', 'AI viết', 'Thêm ảnh thủ công', 'Bối cảnh', 'Hành động', 'Biểu cảm', 'Lời thoại']);
    await expectContrast('script');

    await click('Prompt & ảnh');
    await shot('05-step-frames');
    if (WIDTH >= 1200) check('height-frames', (await pageHeight()) <= 2000, `${await pageHeight()}px (limit 2000)`);
    else console.log(`INFO height-frames ${await pageHeight()}px (limit applies from 1200px wide)`);
    await expectLabels('frames-collapsed', ['Tạo prompt cho tất cả khung', 'Gửi kèm ảnh khung trước', 'Tạo lại', 'Tải ảnh lên']);
    await expandAll();
    await expectLabels('frames-expanded', ['Tạo lại prompt từ kịch bản']);
    await expectContrast('frames');
    await expectNoHScroll('frames');

    await click('Lời thoại & ghép');
    await shot('06-step-compose', false);
    await expectLabels('compose', ['AI đặt thoại', '+ Bóng', 'Đặt lại', 'Tải PNG ảnh này', 'Ảnh 2']);
    await expectContrast('compose');
    await expectNoHScroll('compose');
    await checkCompose(project);

    await click('Duyệt & đăng');
    await sleep(2500);
    await shot('07-step-preview');
    await expectLabels('preview', ['AI viết caption', 'Chia sẻ qua Wi-Fi', 'Tải PNG tất cả ảnh', 'Xuất PDF', 'Đã đăng']);
    await expectContrast('preview');
    await expectNoHScroll('preview');
  }

  if (autoRun) await runAutomationThroughUi();
  if (runChecks || autoRun) console.log(`CHECKS FAILED: ${failed}`);
} finally {
  ws.close();
  chrome.kill();
}
