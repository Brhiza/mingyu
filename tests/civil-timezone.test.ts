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
  const probe = resolve(testDir, 'fixtures/civil-timezone-probe.ts');
  const result = spawnSync(process.execPath, [tsxCli, '--tsconfig', tsconfig, probe], {
    cwd: root,
    env: { ...process.env, TZ: timeZone },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `${timeZone}\n${result.stderr}`);
  return JSON.parse(result.stdout.trim()) as Record<string, unknown>;
}

test('八字民用时间边界不受宿主时区和夏令时影响', () => {
  const baseline = runProbe('UTC');
  for (const timeZone of ['Asia/Shanghai', 'America/New_York', 'Pacific/Apia']) {
    assert.deepEqual(runProbe(timeZone), baseline, timeZone);
  }

  const calendar = baseline.calendar as {
    before: { jieQi: { prev: string; next: string } };
    after: { jieQi: { prev: string; next: string } };
  };
  assert.equal(calendar.before.jieQi.prev, '霜降 (2026-10-23)');
  assert.equal(calendar.before.jieQi.next, '立冬 (2026-11-07)');
  assert.equal(calendar.after.jieQi.prev, '立冬 (2026-11-07)');
  assert.equal(calendar.after.jieQi.next, '小雪 (2026-11-22)');

  assert.deepEqual(baseline.restored, {
    year: 2011,
    month: 12,
    day: 31,
    hour: 23,
    minute: 59,
    second: 58,
  });
  assert.deepEqual(baseline.solar, {
    year: 2026,
    month: 3,
    day: 8,
    hour: 2,
    minute: 30,
    second: 0,
  });
  assert.deepEqual(baseline.instant, {
    inputTimestamp: Date.parse('2026-03-08T02:30:00+08:00'),
    outputTimestamp: Date.parse('2026-03-08T02:30:00+08:00'),
    civil: {
      year: 2026,
      month: 3,
      day: 8,
      hour: 2,
      minute: 30,
      second: 0,
    },
  });
  assert.deepEqual(baseline.historicalStandardTime, {
    inputTimestamp: Date.parse('1990-07-01T04:00:00.000Z'),
    civil: {
      year: 1990,
      month: 7,
      day: 1,
      hour: 12,
      minute: 0,
      second: 0,
    },
    outputTimestamp: Date.parse('1990-07-01T04:00:00.000Z'),
    season: {
      currentJieqi: '夏至',
      nextJieqi: '小暑',
      currentSeason: '夏',
    },
  });
  assert.deepEqual(baseline.solarTermBoundary, {
    evidence: {
      name: '立春',
      index: 3,
      utcTimestamp: Date.parse('2024-02-04T08:27:07.000Z'),
      utcDateTime: '2024-02-04T08:27:07.000Z',
    },
    before: {
      currentJieqi: '大寒',
      nextJieqi: '立春',
      currentSeason: '冬',
      nextTermUtcTimestamp: Date.parse('2024-02-04T08:27:07.000Z'),
    },
    after: {
      currentJieqi: '立春',
      nextJieqi: '雨水',
      currentSeason: '春',
      previousTermUtcTimestamp: Date.parse('2024-02-04T08:27:07.000Z'),
    },
  });
  assert.deepEqual(baseline.range, {
    start: { year: 2024, month: 3, day: 5, hour: 10, minute: 22, second: 0 },
    end: { year: 2024, month: 3, day: 5, hour: 10, minute: 23, second: 0 },
    startTimestamp: Date.parse('2024-03-05T10:22:00+08:00'),
    endTimestamp: Date.parse('2024-03-05T10:23:00+08:00'),
  });
  assert.deepEqual(baseline.monthBoundary, { before: 1, after: 2, day: 7 });
  assert.deepEqual(baseline.luckBoundary, { before: null, at: 2008 });
  assert.deepEqual(baseline.currentSelection, {
    scope: 'day',
    cycleIndex: 0,
    year: 2008,
    month: 1,
    day: 5,
  });
});
