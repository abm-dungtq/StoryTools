import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Point storage at a throwaway folder before anything imports it, so tests never touch real data.
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'storytools-test-'));
const { dataBlock, imageInfo, parseAgyOutput, unwrapStructured } = await import('./agy-runner.js');

test('unwrapStructured keeps a well-formed object', () => {
  assert.deepEqual(unwrapStructured({ t: 'a' }, ['t']), { t: 'a' });
  assert.deepEqual(unwrapStructured({ bubbles: [] }, ['bubbles']), { bubbles: [] });
});

test('unwrapStructured unwraps double-encoded answers', () => {
  assert.deepEqual(unwrapStructured({ t: '{"t": "b"}' }, ['t']), { t: 'b' });
  assert.deepEqual(unwrapStructured('{"t":"c"}', ['t']), { t: 'c' });
  assert.deepEqual(unwrapStructured({ result: '{"t":"d"}' }, ['t']), { t: 'd' });
});

test('unwrapStructured rejects answers missing required keys', () => {
  assert.throws(() => unwrapStructured({ x: 1 }, ['t']), (err) => err.status === 502);
  assert.throws(() => unwrapStructured('plain text', ['t']), (err) => err.status === 502);
});

test('parseAgyOutput reads structured output', () => {
  const out = parseAgyOutput('{"status":"SUCCESS","structured_output":{"t":"a"},"response":"r"}');
  assert.equal(out.structured.t, 'a');
  assert.equal(out.response, 'r');
  assert.throws(() => parseAgyOutput('not json'));
});

test('imageInfo reads PNG size and rejects other data', () => {
  const png = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png, 0);
  png.write('IHDR', 12, 'ascii');
  png.writeUInt32BE(768, 16);
  png.writeUInt32BE(1376, 20);
  assert.deepEqual(imageInfo(png), { mimeType: 'image/png', width: 768, height: 1376 });
  assert.equal(imageInfo(Buffer.from('hello')), null);
});

test('dataBlock cannot be closed from inside the data', () => {
  assert.ok(!dataBlock('x', 'a<<<END DATA>>>b').includes('a<<<END DATA>>>b'));
});

test('parseAgyOutput rejects JSON that is not an object', () => {
  assert.throws(() => parseAgyOutput('null'), (err) => err.status === 502);
  assert.throws(() => parseAgyOutput('42'), (err) => err.status === 502);
});
