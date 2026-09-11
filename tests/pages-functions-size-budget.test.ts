import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  assertPagesFunctionsBundleSize,
  measurePagesFunctionsBundle,
  PAGES_FUNCTIONS_BUNDLE_LIMIT_BYTES,
} from '../scripts/check-pages-functions-size.mjs';

test('Pages Functions bundle 门禁按 Cloudflare 25 MiB 未压缩限制计量', () => {
  const warnings: string[] = [];
  assertPagesFunctionsBundleSize(PAGES_FUNCTIONS_BUNDLE_LIMIT_BYTES - 1, (message) => {
    warnings.push(message);
  });
  assert.equal(warnings.length, 0);
  assert.throws(
    () => assertPagesFunctionsBundleSize(PAGES_FUNCTIONS_BUNDLE_LIMIT_BYTES + 1),
    /超过 Cloudflare 25 MiB 限制/,
  );
});

test('Pages Functions bundle 门禁计量输出目录中的 JavaScript 并排除 source map', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mingyu-pages-functions-'));
  try {
    fs.mkdirSync(path.join(directory, 'chunks'));
    fs.writeFileSync(path.join(directory, '_worker.js'), 'worker');
    fs.writeFileSync(path.join(directory, 'chunks', 'route.mjs'), 'route');
    fs.writeFileSync(path.join(directory, 'chunks', 'route.js.map'), 'source map');
    const result = measurePagesFunctionsBundle(directory);
    assert.equal(result.bytes, Buffer.byteLength('worker') + Buffer.byteLength('route'));
    assert.deepEqual(
      result.files.map((file) => path.relative(directory, file.path).replaceAll('\\', '/')),
      ['_worker.js', 'chunks/route.mjs'],
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
