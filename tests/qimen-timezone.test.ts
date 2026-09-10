import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function runProbe(timeZone: string) {
  const testDir = dirname(fileURLToPath(import.meta.url));
  const root = resolve(testDir, '..');
  const tsxCli = resolve(root, 'node_modules/tsx/dist/cli.mjs');
  const tsconfig = resolve(root, 'tsconfig.app.json');
  const probe = resolve(testDir, 'fixtures/qimen-timezone-probe.ts');
  const result = spawnSync(process.execPath, [tsxCli, '--tsconfig', tsconfig, probe], {
    cwd: root,
    env: { ...process.env, TZ: timeZone },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `${timeZone}\n${result.stderr}`);
  return JSON.parse(result.stdout.trim()) as Record<string, unknown>;
}

test('奇门节令背景按统一时区读取且保留真实瞬时点', () => {
  const baseline = runProbe('UTC');
  for (const timeZone of ['Asia/Shanghai', 'America/New_York', 'Pacific/Apia']) {
    assert.deepEqual(runProbe(timeZone), baseline, timeZone);
  }

  assert.deepEqual(baseline, {
    inputTimestamp: Date.parse('2024-02-10T04:00:30.000Z'),
    chartTimestamp: Date.parse('2024-02-10T04:00:30.000Z'),
    civil: {
      year: 2024,
      month: 2,
      day: 10,
      hour: 12,
      minute: 0,
      second: 30,
    },
    chartSolarTerm: '立春',
    seasonality: {
      currentJieQi: '立春',
      jieQi: '立春',
      solarTermEvidenceUtcDateTime: '2024-02-04T08:27:07.000Z',
      moonPhaseUtcTimestamp: Date.parse('2024-02-10T04:00:30.000Z'),
      moonPhaseUtcDateTime: '2024-02-10T04:00:30.000Z',
    },
    termBoundary: {
      jieQi: '立春',
      solarTermEvidenceUtcDateTime: '2024-02-04T08:27:07.000Z',
    },
  });
});
