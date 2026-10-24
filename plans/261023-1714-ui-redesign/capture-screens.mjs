// Screenshots every main screen of the running app through headless Chrome (CDP) and runs mechanical UI checks.
// Usage (from the repo root, app running on 5173/5174):
//   node plans/261023-1714-ui-redesign/capture-screens.mjs <outDir> [--checks] [--auto-run]
// --checks   prints "CHECK <name> PASS|FAIL <detail>" lines and a final "CHECKS FAILED: <n>" line.
// --auto-run also creates a throwaway story through the UI, runs "Tự động tạo cả truyện" (1 image, 1 frame),
//            waits until it has an image and bubbles, prints "CHECK auto-run PASS|FAIL", then deletes that story.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeCells, getLayout } from '../../src/lib/layouts.js';

const args = process.argv.slice(2);
const outDir = args.find((a) => !a.startsWith('--'));
const runChecks = args.includes('--checks');
const autoRun = args.includes('--auto-run');
const BASE = 'http://127.0.0.1:5173/';
const TEST_TITLE = '[Test] Minh và chú mèo dưới mưa';
mkdirSync(outDir, { recursive: true });

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9333;
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--window-size=1440,1000', '--hide-scrollbars',
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
  const scale = geo.rect.w / pageW;
  const x = geo.rect.x + (cell.x + bubble.cx * cell.w) * scale;
  const y = geo.rect.y + (cell.y + bubble.cy * cell.h) * scale;
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: BASE });
  await sleep(3000);
  const summary = (await api('/api/projects')).find((p) => p.title === TEST_TITLE);
  if (!summary) throw new Error(`Test story "${TEST_TITLE}" not found`);
  const project = await api(`/api/projects/${summary.id}`);

  await shot('01-project-list');
  await expectLabels('list', ['Tạo truyện', 'Xoá', TEST_TITLE]);
  await expectContrast('list');

  await click('Nhân vật');
  await shot('02-characters');
  await expectLabels('characters', ['Thêm nhân vật', 'Rút lại', 'Đặc điểm nhận dạng']);
  await expectContrast('characters');

  await click('Cài đặt');
  await shot('03-settings');
  await expectLabels('settings', ['Lưu', 'Model viết kịch bản']);
  await expectContrast('settings');

  await click('Truyện');
  await click(TEST_TITLE, 'button, a, [role="button"], [data-project]');
  await shot('04-step-script');
  check('height-script', (await pageHeight()) <= 1600, `${await pageHeight()}px (limit 1600)`);
  await checkStepper();
  await expandAll();
  await expectLabels('script', ['Thiết lập truyện', 'Cốt truyện', 'Tự động tạo cả truyện', 'AI viết', 'Thêm ảnh thủ công', 'Bối cảnh', 'Hành động', 'Biểu cảm', 'Lời thoại']);
  await expectContrast('script');

  await click('Prompt & ảnh');
  await shot('05-step-frames');
  check('height-frames', (await pageHeight()) <= 2000, `${await pageHeight()}px (limit 2000)`);
  await expectLabels('frames-collapsed', ['Tạo prompt cho tất cả khung', 'Gửi kèm ảnh khung trước', 'Tạo lại', 'Tải ảnh lên']);
  await expandAll();
  await expectLabels('frames-expanded', ['Tạo lại prompt từ kịch bản']);
  await expectContrast('frames');

  await click('Lời thoại & ghép');
  await shot('06-step-compose', false);
  await expectLabels('compose', ['AI đặt thoại', '+ Bóng', 'Đặt lại', 'Tải PNG ảnh này', 'Ảnh 2']);
  await expectContrast('compose');
  await checkCompose(project);

  await click('Duyệt & đăng');
  await sleep(2500);
  await shot('07-step-preview');
  await expectLabels('preview', ['AI viết caption', 'Chia sẻ qua Wi-Fi', 'Tải PNG tất cả ảnh', 'Xuất PDF', 'Đã đăng']);
  await expectContrast('preview');

  if (autoRun) await runAutomationThroughUi();
  if (runChecks || autoRun) console.log(`CHECKS FAILED: ${failed}`);
} finally {
  ws.close();
  chrome.kill();
}
