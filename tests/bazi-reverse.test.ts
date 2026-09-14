import assert from 'node:assert/strict';
import test from 'node:test';
import { SolarTerm, SolarTime } from 'tyme4ts';
import {
  reverseBaziDates,
  type BaziReversePillars,
} from '../packages/core/src/calendar/bazi-reverse';

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
  const eightChar = SolarTime.fromYmdHms(
    input.year,
    input.month,
    input.day,
    input.hour,
    input.minute,
    input.second,
  )
    .getSixtyCycleHour()
    .getEightChar();
  return {
    year: eightChar.getYear().getName(),
    month: eightChar.getMonth().getName(),
    day: eightChar.getDay().getName(),
    hour: eightChar.getHour().getName(),
  };
}

function textOf(time: {
  getYear(): number;
  getMonth(): number;
  getDay(): number;
  getHour(): number;
  getMinute(): number;
  getSecond(): number;
}): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${time.getYear()}-${pad(time.getMonth())}-${pad(time.getDay())} ${pad(time.getHour())}:${pad(time.getMinute())}:${pad(time.getSecond())}`;
}

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

test('节气交接秒级边界会切换月柱并返回真实起止时间', () => {
  const termTime = SolarTerm.fromIndex(2024, 3).getJulianDay().getSolarTime();
  const term = at(
    termTime.getYear(),
    termTime.getMonth(),
    termTime.getDay(),
    termTime.getHour(),
    termTime.getMinute(),
    termTime.getSecond(),
  );
  const pillars = pillarsAt(term);
  const result = reverseBaziDates({ pillars, startYear: 2024, endYear: 2024 });
  const termText = textOf(termTime);
  const candidate = result.candidates.find((item) => item.start.text === termText);

  assert.ok(result.candidates.length > 0);
  assert.ok(result.candidates.some((item) => item.startBoundary.reason === '节气交接'));
  assert.ok(candidate);
  assert.deepEqual(pillarsAt(term), pillars);
  assert.notDeepEqual(
    pillarsAt(
      at(
        termTime.getYear(),
        termTime.getMonth(),
        termTime.getDay(),
        termTime.getHour(),
        termTime.getMinute(),
        Math.max(0, termTime.getSecond() - 1),
      ),
    ),
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
  const termTime = SolarTerm.fromIndex(2025, 9).getJulianDay().getSolarTime();
  const beforeTerm = termTime.next(-1);
  const pillars = pillarsAt(
    at(
      beforeTerm.getYear(),
      beforeTerm.getMonth(),
      beforeTerm.getDay(),
      beforeTerm.getHour(),
      beforeTerm.getMinute(),
      beforeTerm.getSecond(),
    ),
  );
  const result = reverseBaziDates({ pillars, startYear: 2025, endYear: 2025 });
  const candidate = result.candidates.find((item) => item.start.text === '2025-05-05 13:00:00');

  assert.ok(candidate);
  assert.equal(candidate.end.text, textOf(termTime));
  assert.equal(candidate.endBoundary.reason, '节气交接');
  assert.deepEqual(
    pillarsAt(
      at(
        beforeTerm.getYear(),
        beforeTerm.getMonth(),
        beforeTerm.getDay(),
        beforeTerm.getHour(),
        beforeTerm.getMinute(),
        beforeTerm.getSecond(),
      ),
    ),
    pillars,
  );
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
