import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

test('Vite 构建脚本在子进程被信号终止时返回失败', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'mingyu-vite-build-'));
  try {
    const viteBin = join(fixture, 'node_modules', 'vite', 'bin');
    mkdirSync(viteBin, { recursive: true });
    writeFileSync(join(viteBin, 'vite.js'), "process.kill(process.pid, 'SIGTERM');\n", 'utf8');

    const wrapper = resolve('scripts/run-vite-build.mjs');
    const result = spawnSync(process.execPath, [wrapper], {
      cwd: fixture,
      encoding: 'utf8',
    });

    assert.notEqual(result.status, 0);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
