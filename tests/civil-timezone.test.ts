import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface GanzhiDateProbeResult {
  defaultResult: {
    helper: { year: string; month: string; day: string; hour: string };
    lunarUtil: { year: string; month: string; day: string; hour: string };
    lunarHour: string;
    afterMidnight: {
      helper: { year: string; month: string; day: string; hour: string };
      lunarUtil: { year: string; month: string; day: string; hour: string };
    };
    before: { year: string; month: string };
    at: { year: string; month: string };
  };
  customResult: {
    clock: {
      year: number;
      month: number;
      day: number;
      hour: number;
      minute: number;
      second: number;
    };
    helper: { year: string; month: string; day: string; hour: string };
    managed: { year: string; month: string; day: string; hour: string };
    lunarHour: string;
  };
}

interface ProbeResult extends Record<string, unknown> {
  dateContract?: GanzhiDateProbeResult;
}

const probeResults = new Map<string, ProbeResult>();

function runProbe(timeZone: string): ProbeResult {
  const cached = probeResults.get(timeZone);
  if (cached) return cached;

  const testDir = dirname(fileURLToPath(import.meta.url));
  const root = resolve(testDir, '..');
  const tsxCli = resolve(root, 'node_modules/tsx/dist/cli.mjs');
  const tsconfig = resolve(root, 'tsconfig.app.json');
  const probe = resolve(testDir, 'fixtures/civil-timezone-probe.ts');
  const result = spawnSync(process.execPath, [tsxCli, '--tsconfig', tsconfig, probe], {
    cwd: root,
    env: {
      ...process.env,
      TZ: timeZone,
      MINGYU_INCLUDE_GANZHI_CONTRACT:
        timeZone === 'UTC' || timeZone === 'Asia/Shanghai' ? '1' : '0',
    },
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `${timeZone}\n${result.stderr}`);
  const parsed = JSON.parse(result.stdout.trim()) as ProbeResult;
  probeResults.set(timeZone, parsed);
  return parsed;
}

function withoutDateContract(result: ProbeResult): Record<string, unknown> {
  const civilResult = { ...result };
  delete civilResult.dateContract;
  return civilResult;
}

test('八字民用时间边界不受宿主时区和夏令时影响', () => {
  const baseline = runProbe('UTC');
  for (const timeZone of ['Asia/Shanghai', 'America/New_York', 'Pacific/Apia']) {
    assert.deepEqual(
      withoutDateContract(runProbe(timeZone)),
      withoutDateContract(baseline),
      timeZone,
    );
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
  assert.deepEqual(baseline.fortuneDateResolution, {
    date: '2022-09-07',
    referenceTimestamp: Date.parse('2022-09-07T12:00:00+08:00'),
    year: 2022,
    month: 7,
    day: 32,
  });
  assert.deepEqual(baseline.currentSelection, {
    scope: 'day',
    cycleIndex: 0,
    year: 2008,
    month: 1,
    day: 5,
  });
});

test('公共 Date 干支入口在不同宿主时区和显式配置时区均按真实瞬时取四柱与交节', () => {
  const utc = runProbe('UTC').dateContract;
  const shanghai = runProbe('Asia/Shanghai').dateContract;
  assert.ok(utc);
  assert.ok(shanghai);
  assert.deepEqual(shanghai, utc);

  assert.deepEqual(utc.defaultResult.helper, {
    year: '甲辰',
    month: '丙寅',
    day: '戊戌',
    hour: '庚申',
  });
  assert.deepEqual(utc.defaultResult.helper, utc.defaultResult.lunarUtil);
  assert.equal(utc.defaultResult.lunarHour, utc.defaultResult.helper.hour);
  assert.deepEqual(
    utc.defaultResult.afterMidnight.helper,
    utc.defaultResult.afterMidnight.lunarUtil,
  );
  assert.notEqual(utc.defaultResult.afterMidnight.helper.day, utc.defaultResult.helper.day);
  assert.deepEqual(
    [utc.defaultResult.before.year, utc.defaultResult.before.month],
    ['癸卯', '乙丑'],
  );
  assert.deepEqual([utc.defaultResult.at.year, utc.defaultResult.at.month], ['甲辰', '丙寅']);

  assert.deepEqual(utc.customResult.helper, utc.customResult.managed);
  assert.deepEqual(utc.customResult.clock, {
    year: 2024,
    month: 2,
    day: 4,
    hour: 3,
    minute: 30,
    second: 0,
  });
  assert.equal(utc.customResult.helper.year, '甲辰');
  assert.equal(utc.customResult.helper.month, '丙寅');
  assert.equal(utc.customResult.lunarHour, utc.customResult.helper.hour);
});
