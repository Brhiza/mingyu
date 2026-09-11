import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface TimezoneProbe {
  timestamp: number;
  solar: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
  };
  stageStart: string;
  dynamicClusters: Array<{
    key: string;
    stageIndex: number;
    supportEvidence: string[];
    counterEvidence: string[];
  }>;
  ianaDynamicClusters: Array<{
    key: string;
    stageIndex: number;
    supportEvidence: string[];
    counterEvidence: string[];
  }>;
}

function runProbe(timeZone: string) {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const root = resolve(testDir, '..');
  const tsxCli = resolve(root, 'node_modules/tsx/dist/cli.mjs');
  const tsconfig = resolve(root, 'tsconfig.app.json');
  const probe = resolve(testDir, 'fixtures/qimen-lifetime-timezone-probe.ts');
  const result = spawnSync(process.execPath, [tsxCli, '--tsconfig', tsconfig, probe], {
    cwd: root,
    env: { ...process.env, TZ: timeZone },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `${timeZone}\n${result.stderr}`);
  return JSON.parse(result.stdout.trim()) as TimezoneProbe;
}

test('奇门终身局显式出生时区不受宿主时区影响', () => {
  const baseline = runProbe('UTC');
  for (const timeZone of ['Asia/Shanghai', 'America/New_York', 'Pacific/Apia']) {
    assert.deepEqual(runProbe(timeZone), baseline, timeZone);
  }

  assert.equal(baseline.timestamp, Date.parse('2024-01-01T10:30:00.000Z'));
  assert.deepEqual(baseline.solar, {
    year: 2024,
    month: 1,
    day: 2,
    hour: 0,
    minute: 30,
  });
  assert.equal(baseline.stageStart, '2024-01-02');
  assert.ok(
    baseline.dynamicClusters.some((cluster) => cluster.key.startsWith('cluster:2024:')),
    '动态年盘应保留年度事件簇',
  );
  assert.ok(
    baseline.ianaDynamicClusters.some((cluster) => cluster.key.startsWith('cluster:2024:')),
    'IANA 时区动态年盘应保留年度事件簇',
  );
});
