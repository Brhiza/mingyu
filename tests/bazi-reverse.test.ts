import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateSolarTermEvidence } from '../packages/core/src/calendar/solar-term-evidence';
import {
  reverseBaziDates,
  type BaziReversePillars,
} from '../packages/core/src/calendar/bazi-reverse';
import { getGanZhiFromDate } from '../packages/core/src/ganzhi';
import { reverseBaziDates as reverseBaziDatesFromCalendar } from 'mingyu-core/calendar';
import { reverseBaziDates as reverseBaziDatesFromSubpath } from 'mingyu-core/calendar/bazi-reverse';

function at(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
  second = 0,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  return { year, month, day, hour, minute, second };
}

function pillarsAt(input: ReturnType<typeof at>): BaziReversePillars {
  return getGanZhiFromDate(
    new Date(input.year, input.month - 1, input.day, input.hour, input.minute, input.second),
  );
}

function textOf(time: ReturnType<typeof at>): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${time.year}-${pad(time.month)}-${pad(time.day)} ${pad(time.hour)}:${pad(time.minute)}:${pad(time.second)}`;
}

function chinaPartsFromUtcTimestamp(timestamp: number): ReturnType<typeof at> {
  const time = new Date(timestamp + 8 * 60 * 60 * 1000);
  return at(
    time.getUTCFullYear(),
    time.getUTCMonth() + 1,
    time.getUTCDate(),
    time.getUTCHours(),
    time.getUTCMinutes(),
    time.getUTCSeconds(),
  );
}

test('八字反推应同时从核心历法主入口和独立包子路径导出', () => {
  assert.equal(reverseBaziDatesFromCalendar, reverseBaziDatesFromSubpath);
  const result = reverseBaziDatesFromSubpath({
    pillars: { year: '甲辰', month: '丙寅', day: '己亥', hour: '甲子' },
    startYear: 2024,
    endYear: 2024,
  });
  assert.equal(result.candidates[0]?.start.text, '2024-02-04 23:00:00');
});

test('八字反推返回完整候选区间，并能在区间内正向复核', () => {
  const pillars = pillarsAt(at(2024, 2, 4, 23));
  const result = reverseBaziDates({ pillars, startYear: 2024, endYear: 2024 });

  assert.equal(result.policy.timezone, 'Asia/Shanghai');
  assert.equal(result.policy.month, '节气月');
  assert.equal(result.policy.dayChange, '子时23点换日');
  assert.equal(result.candidateCount, result.candidates.length);
  assert.ok(result.candidates.length >= 1);

  const candidate = result.candidates.find((item) => item.start.text === '2024-02-04 23:00:00');
  assert.ok(candidate);
  assert.equal(candidate.end.text, '2024-02-05 01:00:00');
  assert.equal(candidate.endExclusive, true);
  assert.deepEqual(pillarsAt(at(2024, 2, 4, 23)), pillars);
  assert.deepEqual(pillarsAt(at(2024, 2, 5, 0, 59, 59)), pillars);
  assert.notDeepEqual(pillarsAt(at(2024, 2, 5, 1)), pillars);
  assert.equal(candidate.startBoundary.reason, '子时换日');
  assert.equal(candidate.endBoundary.reason, '时辰交接');
});

test('八字反推支持按游标分批返回且候选总数保持稳定', () => {
  const pillars = pillarsAt(at(2024, 2, 4, 23));
  const first = reverseBaziDates({
    pillars,
    startYear: 1900,
    endYear: 2100,
    startIndex: 0,
    limit: 2,
  });
  assert.equal(first.candidates.length, 2);
  assert.equal(first.batch?.startIndex, 0);
  assert.equal(first.batch?.limit, 2);
  assert.equal(first.batch?.returned, 2);
  assert.equal(first.batch?.total, first.candidateCount);
  assert.ok(first.batch?.next);

  const second = reverseBaziDates({
    pillars,
    startYear: 1900,
    endYear: 2100,
    ...first.batch!.next!,
  });
  assert.equal(second.batch?.startIndex, 2);
  assert.equal(second.candidates.length, 1);
  assert.equal(second.batch?.returned, 1);
  assert.equal(second.batch?.next, undefined);
  assert.notEqual(first.candidates[0]?.startTimestamp, second.candidates[0]?.startTimestamp);
  assert.equal(second.candidateCount, first.candidateCount);
});

test('八字反推分批参数边界明确拒绝', () => {
  const pillars = pillarsAt(at(2024, 2, 4, 23));
  assert.throws(() => reverseBaziDates({ pillars, startIndex: 1 }), /startIndex.*limit/);
  assert.throws(() => reverseBaziDates({ pillars, limit: 101 }), /limit需为 1-100/);
});

test('节气交接秒级边界会切换月柱并返回真实起止时间', () => {
  const termEvidence = calculateSolarTermEvidence(2024, 3);
  const term = chinaPartsFromUtcTimestamp(termEvidence.utcTimestamp);
  const pillars = pillarsAt(term);
  const result = reverseBaziDates({ pillars, startYear: 2024, endYear: 2024 });
  const termText = textOf(term);
  const candidate = result.candidates.find((item) => item.start.text === termText);

  assert.ok(result.candidates.length > 0);
  assert.ok(result.candidates.some((item) => item.startBoundary.reason === '节气交接'));
  assert.ok(candidate);
  assert.deepEqual(pillarsAt(term), pillars);
  assert.notDeepEqual(
    pillarsAt(chinaPartsFromUtcTimestamp(termEvidence.utcTimestamp - 1000)),
    pillars,
  );
});

test('查询首年一月会保留上一年节气年，并正确裁剪前夜子时', () => {
  const pillars = pillarsAt(at(2024, 1, 1, 0));
  const result = reverseBaziDates({ pillars, startYear: 2024, endYear: 2024 });
  const candidate = result.candidates.find((item) => item.start.text === '2024-01-01 00:00:00');

  assert.ok(candidate);
  assert.equal(candidate.startBoundary.reason, '查询范围开始');
  assert.equal(candidate.end.text, '2024-01-01 01:00:00');
  assert.equal(candidate.pillars.year, pillars.year);
  assert.equal(candidate.pillars.month, pillars.month);
});

test('交节落在时辰前段时，交节前的短区间不会因只取时辰中点而漏掉', () => {
  const termEvidence = calculateSolarTermEvidence(2025, 9);
  const termTime = chinaPartsFromUtcTimestamp(termEvidence.utcTimestamp);
  const beforeTerm = chinaPartsFromUtcTimestamp(termEvidence.utcTimestamp - 1000);
  const pillars = pillarsAt(beforeTerm);
  const result = reverseBaziDates({ pillars, startYear: 2025, endYear: 2025 });
  const candidate = result.candidates.find((item) => item.start.text === '2025-05-05 13:00:00');

  assert.ok(candidate);
  assert.equal(candidate.end.text, textOf(termTime));
  assert.equal(candidate.endBoundary.reason, '节气交接');
  assert.deepEqual(pillarsAt(beforeTerm), pillars);
});

test('四柱格式和年份范围错误会明确拒绝', () => {
  assert.throws(
    () =>
      reverseBaziDates({
        pillars: { year: '甲子', month: '丙寅', day: '不存在', hour: '庚申' },
      }),
    /日柱.*六十甲子/,
  );
  assert.throws(
    () =>
      reverseBaziDates({
        pillars: { year: '甲子', month: '丙寅', day: '戊戌', hour: '庚申' },
        startYear: 2025,
        endYear: 2024,
      }),
    /开始年份不能晚于结束年份/,
  );
});
