// Runs the agy CLI as a child process: isolated job dir, concurrency limit, timeout, process-tree cancel, defensive output parsing.
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR, assertSafeName, newId } from './storage.js';

export const JOB_ROOT = path.join(DATA_DIR, 'tmp');
export const AGY_BIN = process.env.AGY_BIN || 'agy';
const MAX_PARALLEL = Number(process.env.AGY_CONCURRENCY) || 2;
const MAX_PROMPT_CHARS = 28000;

export class AgyError extends Error {
  constructor(message, status = 502, tool = 'agy') {
    super(`${tool}: ${message}`);
    this.status = status;
  }
}

/** Parses `agy --output-format json` stdout; falls back to the last JSON line when logs precede it. */
export function parseAgyOutput(stdout) {
  const text = String(stdout || '').trim();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    const last = text.split(/\r?\n/).reverse().find((line) => line.trim().startsWith('{'));
    try {
      data = JSON.parse(last);
    } catch {
      throw new AgyError(`đầu ra không phải JSON: ${text.slice(-300)}`);
    }
  }
  if (!data || typeof data !== 'object') throw new AgyError(`đầu ra không phải JSON: ${text.slice(-300)}`);
  return {
    status: data.status,
    error: data.error ? String(data.error.message || data.error) : '',
    structured: data.structured_output ?? null,
    response: String(data.response || ''),
  };
}

const hasKeys = (value, keys) => value !== null && typeof value === 'object' && keys.every((k) => k in value);

/**
 * Returns the object carrying `requiredKeys`. agy sometimes double-encodes the answer as a JSON string
 * inside a field ({"t":"{\"t\":…}"}) or returns the whole answer as a string.
 */
export function unwrapStructured(value, requiredKeys) {
  if (typeof value === 'string') {
    try {
      return unwrapStructured(JSON.parse(value), requiredKeys);
    } catch (err) {
      if (err instanceof AgyError) throw err;
    }
  } else if (value !== null && typeof value === 'object') {
    for (const inner of Object.values(value)) {
      if (typeof inner !== 'string' || !inner.trim().startsWith('{')) continue;
      try {
        const parsed = JSON.parse(inner);
        if (hasKeys(parsed, requiredKeys)) return parsed;
      } catch {
        // Not JSON after all; the field is plain text.
      }
    }
    if (hasKeys(value, requiredKeys)) return value;
  }
  throw new AgyError(`trả về sai định dạng (thiếu ${requiredKeys.join(', ')})`);
}

/** Format and pixel size of a PNG or JPEG buffer, or null for anything else. */
export function imageInfo(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 24) return null;
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mimeType: 'image/png', width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) return null;
      const marker = buffer[offset + 1];
      const len = buffer.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xc2) {
        return { mimeType: 'image/jpeg', width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
      }
      offset += 2 + len;
    }
  }
  return null;
}

/** Wraps user-written text so the model treats it as story data; the text cannot close the block itself. */
export function dataBlock(label, text) {
  return `<<<DATA ${label}>>>\n${String(text ?? '').replaceAll('<<<', '‹‹‹')}\n<<<END DATA>>>`;
}

/** A queue allowing `max` jobs at once; a cancelled request leaves the queue without taking a slot. */
export function createLimiter(max, tool = 'agy') {
  let active = 0;
  const waiting = [];
  const acquire = (signal) => {
    if (active < max) {
      active++;
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const entry = {};
      const onAbort = () => {
        const i = waiting.indexOf(entry);
        if (i >= 0) waiting.splice(i, 1);
        reject(new AgyError('đã huỷ', 499, tool));
      };
      entry.resolve = () => {
        signal?.removeEventListener('abort', onAbort);
        active++;
        resolve();
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      waiting.push(entry);
    });
  };
  const release = () => {
    active--;
    waiting.shift()?.resolve();
  };
  return { acquire, release };
}

const { acquire, release } = createLimiter(MAX_PARALLEL);

// agy starts helper processes (e.g. the image subagent); on Windows killing the parent alone leaves them running.
function killTree(child) {
  if (!child.pid) return;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/T', '/F', '/PID', String(child.pid)], { windowsHide: true, stdio: 'ignore' }).on('error', () => {});
    } else {
      // Signal the whole process group (macOS/Linux); force it if anything in the group ignores SIGTERM.
      process.kill(-child.pid, 'SIGTERM');
      setTimeout(() => {
        try {
          process.kill(-child.pid, 'SIGKILL');
        } catch {
          // Group already exited.
        }
      }, 5000).unref();
    }
  } catch {
    // Already gone.
  }
}

/**
 * Spawns a CLI in `dir` and resolves with its stdout and exit code once it exits, is cancelled, or times out.
 * `tool` names the CLI in error messages; `bin` and `missing` say what to run and what to tell the user when it is not installed.
 */
export function runProcess(args, dir, timeoutSec, signal, { bin = AGY_BIN, tool = 'agy', missing = 'không tìm thấy lệnh agy. Cài agy CLI hoặc đặt biến AGY_BIN' } = {}) {
  return new Promise((resolve, reject) => {
    // detached gives the child its own process group on POSIX so the whole tree can be signalled.
    const child = spawn(bin, args, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, detached: process.platform !== 'win32' });
    let stdout = '';
    let stderr = '';
    let settled = false;
    let reason = null;
    let forceTimer = null;
    // Decode as a stream so a Vietnamese character split across two pipe chunks stays intact.
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr = (stderr + d).slice(-2000)));

    // 'close' waits for the pipes to drain; if a killed tree keeps them open, give up waiting after 10 s.
    const kill = (why) => {
      reason = why;
      killTree(child);
      forceTimer ??= setTimeout(() => finish(), 10000);
    };
    const timer = setTimeout(() => kill('timeout'), (timeoutSec + 30) * 1000);
    const onAbort = () => kill('aborted');
    // The client may have left while the job dir was being prepared; a listener added now would never fire.
    if (signal?.aborted) onAbort();
    else signal?.addEventListener('abort', onAbort, { once: true });

    const finish = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(forceTimer);
      signal?.removeEventListener('abort', onAbort);
      if (reason === 'aborted') reject(new AgyError('đã huỷ', 499, tool));
      else if (reason === 'timeout') reject(new AgyError(`quá ${timeoutSec}s không xong`, 504, tool));
      else if (err?.code === 'ENOENT') reject(new AgyError(missing, 500, tool));
      else if (err) reject(new AgyError(err.message, 502, tool));
      else resolve({ stdout, stderr, code: child.exitCode });
    };
    child.on('error', finish);
    child.on('close', () => finish());
  });
}

/**
 * Runs one agy turn in a fresh job directory and returns the validated result.
 * Exit code and agy's own status are not trusted: only parsed structured output and a real out.png count.
 * @param {{ prompt: string, model: string, schema?: object, requiredKeys?: string[],
 *   files?: {name: string, data: Buffer}[], expectImage?: boolean, needsFiles?: boolean,
 *   timeoutSec: number, signal?: AbortSignal }} opts
 * @returns {Promise<{ structured: object|null, image: {buffer: Buffer, mimeType: string, width: number, height: number}|null, response: string }>}
 */
export async function runAgy({ prompt, model, schema, requiredKeys, files = [], expectImage = false, needsFiles = false, timeoutSec, signal }) {
  if (signal?.aborted) throw new AgyError('đã huỷ', 499);
  // The prompt travels as a command-line argument; Windows caps the whole command line near 32K characters.
  if (prompt.length > MAX_PROMPT_CHARS) throw new AgyError(`nội dung quá dài (${prompt.length} ký tự). Hãy rút gọn cốt truyện hoặc lời thoại.`, 400);
  await acquire(signal);
  const dir = path.join(JOB_ROOT, newId());
  try {
    await fs.mkdir(dir, { recursive: true });
    for (const file of files) await fs.writeFile(path.join(dir, assertSafeName(file.name)), file.data);

    const args = ['-p', prompt, '--model', model, '--output-format', 'json', '--print-timeout', `${timeoutSec}s`, '--disable-slash-commands'];
    if (schema) {
      await fs.writeFile(path.join(dir, 'schema.json'), JSON.stringify(schema));
      args.push('--json-schema', path.join(dir, 'schema.json'));
    }
    // Reading reference files and saving out.png need tool permissions; the job dir is the agent's whole workspace.
    if (needsFiles || expectImage) args.push('--dangerously-skip-permissions');

    const { stdout, stderr } = await runProcess(args, dir, timeoutSec, signal);
    if (!stdout.trim()) throw new AgyError(`không có phản hồi. ${stderr.slice(-300)}`);
    const out = parseAgyOutput(stdout);
    // agy can report SUCCESS on failures, but a non-success status is always a real failure (quota, auth, timeout).
    if (out.status && out.status !== 'SUCCESS') throw new AgyError(`${out.status}: ${(out.error || out.response).slice(-300)}`);

    let structured = null;
    if (requiredKeys) {
      // The model sometimes leaves structured_output empty and answers with (fenced) JSON in the response text.
      const empty = out.structured === null || (typeof out.structured === 'object' && !Object.keys(out.structured).length);
      const raw = !empty ? out.structured : out.response.replace(/^```(json)?|```$/gm, '').trim();
      structured = unwrapStructured(raw, requiredKeys);
    }

    let image = null;
    if (expectImage) {
      const buffer = await fs.readFile(path.join(dir, 'out.png')).catch(() => null);
      const info = buffer && imageInfo(buffer);
      if (!info) throw new AgyError(`không tạo được ảnh (có thể hết quota hoặc nội dung bị chặn). ${out.response.slice(-300)}`);
      image = { buffer, ...info };
    }
    return { structured, image, response: out.response };
  } finally {
    release();
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
