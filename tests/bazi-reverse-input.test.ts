import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateBaziChartFromInput } from '../packages/core/src/bazi';
import {
  calculateSolarTermEvidence,
  reverseBaziDates,
  type BaziReversePillars,
} from '../packages/core/src/calendar';
import { getGanZhiFromDate } from '../packages/core/src/ganzhi';
import { birthProfileToBaziPerson, calculateBaziFromBirthProfile } from 'mingyu-core/profile';
import {
  getBaziReverseSearchEndYear,
  isValidBaziReverseSource,
  parseBaziReverseSource,
  resolveBaziReverseCandidate,
  serializeBaziReverseSource,
} from '../src/lib/bazi-reverse-input';
import { buildPersonFromInput, calculateFullBaziChart } from '../src/lib/full-chart-engine/bazi';
import { buildInputStateSearch, defaultInputState, parseInputState } from '../src/lib/query-state';

function beijingDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute = 0,
  second = 0,
): Date {
  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, second));
}

test('反推候选半开终点在 2101 年时仍可重开 2100 年查询', () => {
  assert.equal(
    getBaziReverseSearchEndYear({
      pillars: { year: '庚申', month: '戊子', day: '甲午', hour: '甲子' },
      intervalStart: '2100-12-31 23:00:00',
      intervalEnd: '2101-01-01 00:00:00',
    }),
    2100,
  );
});

test('精准出生表单未选时辰且未填秒时仍可生成共享出生资料', () => {
  for (const year of ['1900', '2000']) {
    const input = {
      ...defaultInputState,
      year,
      month: '6',
      day: '15',
      timeIndex: '' as const,
      birthHour: '13',
      birthMinute: '00',
      birthSecond: '',
    };
    const person = buildPersonFromInput(input);
    assert.equal(person.timeIndex, 7);
    assert.equal(person.birthSecond, 0);
    assert.deepEqual(calculateFullBaziChart(person).solarDate, {
      year: Number(year),
      month: 6,
      day: 15,
    });
    const withOldIndex = buildPersonFromInput({ ...input, timeIndex: 3 });
    assert.equal(withOldIndex.timeIndex, 7);
    assert.equal(withOldIndex.birthSecond, 0);
    const traditional = buildPersonFromInput({
      ...input,
      timeIndex: 3,
      birthHour: '',
      birthMinute: '',
    });
    assert.equal(traditional.timeIndex, 3);
    assert.equal(traditional.birthSecond, undefined);
  }
});

test('四柱反推回填保留秒级标准北京时间，并逐候选复核四柱', () => {
  const source = getGanZhiFromDate(beijingDate(2024, 2, 4, 23));
  const target: BaziReversePillars = source;
  const reversed = reverseBaziDates({ pillars: target, startYear: 2024, endYear: 2024 });
  assert.ok(reversed.candidates.length > 0);

  for (const candidate of reversed.candidates) {
    const selection = resolveBaziReverseCandidate(candidate);
    assert.ok(selection, `候选 ${candidate.start.text} 应可回填`);
    const chart = calculateBaziChartFromInput({
      gender: 'male',
      year: selection.year,
      month: selection.month,
      day: selection.day,
      dateType: 'solar',
      isLeapMonth: false,
      useTrueSolarTime: false,
      timeIndex: '',
      birthHour: selection.representativeHour,
      birthMinute: selection.representativeMinute,
      birthSecond: selection.representativeSecond,
    });

    assert.deepEqual(
      {
        year: chart.pillars.year.ganZhi,
        month: chart.pillars.month.ganZhi,
        day: chart.pillars.day.ganZhi,
        hour: chart.pillars.hour.ganZhi,
      },
      target,
      `候选 ${candidate.start.text} 回填后四柱应保持一致`,
    );
  }
});

test('1960 年历史日期可经反推和完整输入链路复核', () => {
  const target = getGanZhiFromDate(beijingDate(1960, 1, 7, 9));
  const reversed = reverseBaziDates({ pillars: target, startYear: 1960, endYear: 1960 });
  const candidate = reversed.candidates.find((item) => item.start.text.startsWith('1960-01-07'));
  assert.ok(candidate, '1960-01-07 应有对应候选时段');
  const selection = resolveBaziReverseCandidate(candidate);
  assert.ok(selection);
  const chart = calculateBaziChartFromInput({
    gender: 'male',
    year: selection.year,
    month: selection.month,
    day: selection.day,
    dateType: 'solar',
    isLeapMonth: false,
    useTrueSolarTime: false,
    timeIndex: '',
    birthHour: selection.representativeHour,
    birthMinute: selection.representativeMinute,
    birthSecond: selection.representativeSecond,
  });
  assert.deepEqual(
    {
      year: chart.pillars.year.ganZhi,
      month: chart.pillars.month.ganZhi,
      day: chart.pillars.day.ganZhi,
      hour: chart.pillars.hour.ganZhi,
    },
    target,
  );
});

test('历史夏令时年份的合成候选仍按固定东八区解释', () => {
  const target = getGanZhiFromDate(beijingDate(1988, 7, 18, 9, 0, 37));
  const reversed = reverseBaziDates({ pillars: target, startYear: 1988, endYear: 1988 });
  const candidate = reversed.candidates.find((item) => item.start.text === '1988-07-18 09:00:00');
  assert.ok(candidate);
  assert.equal(candidate.end.text, '1988-07-18 11:00:00');

  const selection = resolveBaziReverseCandidate(candidate);
  assert.ok(selection);
  assert.equal(selection.representativeHour, 9);
  assert.equal(selection.representativeMinute, 0);
  assert.equal(selection.representativeSecond, 0);
  const chart = calculateBaziChartFromInput({
    gender: 'male',
    year: selection.year,
    month: selection.month,
    day: selection.day,
    dateType: 'solar',
    isLeapMonth: false,
    useTrueSolarTime: false,
    timeIndex: '',
    birthHour: selection.representativeHour,
    birthMinute: selection.representativeMinute,
    birthSecond: selection.representativeSecond,
  });
  assert.deepEqual(
    {
      year: chart.pillars.year.ganZhi,
      month: chart.pillars.month.ganZhi,
      day: chart.pillars.day.ganZhi,
      hour: chart.pillars.hour.ganZhi,
    },
    target,
  );
});

test('候选回填经查询状态和前端排盘链路仍保持四柱', () => {
  const target = getGanZhiFromDate(beijingDate(2000, 1, 7, 9));
  const candidate = reverseBaziDates({ pillars: target, startYear: 2000, endYear: 2000 })
    .candidates[0];
  assert.ok(candidate);
  const selection = resolveBaziReverseCandidate(candidate);
  assert.ok(selection);
  const input = {
    ...defaultInputState,
    year: selection.year,
    month: selection.month,
    day: selection.day,
    timeIndex: selection.timeIndex,
    birthHour: String(selection.representativeHour),
    birthMinute: String(selection.representativeMinute),
    birthSecond: String(selection.representativeSecond),
    birthReverseSource: serializeBaziReverseSource(selection.source),
  };
  const restored = parseInputState(new URLSearchParams(buildInputStateSearch(input)));
  const chart = calculateFullBaziChart(buildPersonFromInput(restored));

  assert.equal(restored.birthSecond, input.birthSecond);
  assert.deepEqual(parseBaziReverseSource(restored.birthReverseSource), selection.source);
  assert.equal(selection.source.startTimestamp, candidate.startTimestamp);
  assert.equal(selection.source.endTimestamp, candidate.endTimestamp);
  assert.equal(selection.source.endExclusive, true);
  assert.equal(selection.source.timezone, 'Asia/Shanghai');
  assert.equal(selection.source.offsetHours, 8);
  assert.deepEqual(
    {
      year: chart.pillars.year.ganZhi,
      month: chart.pillars.month.ganZhi,
      day: chart.pillars.day.ganZhi,
      hour: chart.pillars.hour.ganZhi,
    },
    target,
  );
});

test('节气秒级候选经查询状态和前端排盘链路仍保持四柱', () => {
  const termEvidence = calculateSolarTermEvidence(2025, 9);
  const term = new Date(termEvidence.utcTimestamp + 8 * 60 * 60 * 1000);
  const termParts = {
    year: term.getUTCFullYear(),
    month: term.getUTCMonth() + 1,
    day: term.getUTCDate(),
    hour: term.getUTCHours(),
    minute: term.getUTCMinutes(),
    second: term.getUTCSeconds(),
  };
  const target = getGanZhiFromDate(new Date(termEvidence.utcTimestamp));
  const candidate = reverseBaziDates({
    pillars: target,
    startYear: termParts.year,
    endYear: termParts.year,
  }).candidates.find(
    (item) =>
      item.start.text ===
      `${termParts.year}-${String(termParts.month).padStart(2, '0')}-${String(termParts.day).padStart(2, '0')} ${String(termParts.hour).padStart(2, '0')}:${String(termParts.minute).padStart(2, '0')}:${String(termParts.second).padStart(2, '0')}`,
  );
  assert.ok(candidate, '节气交接时刻应返回以真实秒数开始的候选区间');
  assert.notEqual(candidate.start.second, 0);
  const selection = resolveBaziReverseCandidate(candidate);
  assert.ok(selection);
  const input = {
    ...defaultInputState,
    year: selection.year,
    month: selection.month,
    day: selection.day,
    timeIndex: selection.timeIndex,
    birthHour: String(selection.representativeHour),
    birthMinute: String(selection.representativeMinute),
    birthSecond: String(selection.representativeSecond),
  };
  const restored = parseInputState(new URLSearchParams(buildInputStateSearch(input)));
  const chart = calculateFullBaziChart(buildPersonFromInput(restored));

  assert.equal(restored.birthSecond, String(candidate.start.second));
  assert.deepEqual(
    {
      year: chart.pillars.year.ganZhi,
      month: chart.pillars.month.ganZhi,
      day: chart.pillars.day.ganZhi,
      hour: chart.pillars.hour.ganZhi,
    },
    target,
  );
});

test('统一出生档案的秒数会进入八字标准北京时间计算', () => {
  const profile = {
    gender: 'male' as const,
    calendarType: 'solar' as const,
    year: 2000,
    month: 1,
    day: 7,
    hour: 9,
    minute: 0,
    second: 37,
  };
  const person = birthProfileToBaziPerson(profile);
  const chart = calculateBaziFromBirthProfile(profile);
  assert.equal(person.birthSecond, 37);
  assert.equal(person.useTrueSolarTime, false);
  assert.equal(chart.pillars.hour.ganZhi, '己巳');
});

test('旧版仅文本来源仍可读取，不被补字段策略淘汰', () => {
  const source = {
    pillars: { year: '甲子', month: '丙寅', day: '丁卯', hour: '戊辰' },
    intervalStart: '2000-01-07 09:00:00',
    intervalEnd: '2000-01-07 11:00:00',
  };
  assert.deepEqual(parseBaziReverseSource(JSON.stringify(source)), source);
  assert.equal(
    isValidBaziReverseSource({
      ...source,
      startTimestamp: undefined,
      endTimestamp: undefined,
      endExclusive: undefined,
      timezone: undefined,
      offsetHours: undefined,
    }),
    true,
  );
});

test('机器区间字段与文本或固定政策不一致时拒绝来源', () => {
  const pillars = getGanZhiFromDate(beijingDate(2000, 1, 7, 9));
  const source = {
    pillars,
    intervalStart: '2000-01-07 09:00:00',
    intervalEnd: '2000-01-07 11:00:00',
    startTimestamp: Date.UTC(2000, 0, 7, 1),
    endTimestamp: Date.UTC(2000, 0, 7, 3),
    endExclusive: true as const,
    timezone: 'Asia/Shanghai' as const,
    offsetHours: 8 as const,
  };
  assert.ok(parseBaziReverseSource(JSON.stringify(source)));

  assert.equal(
    parseBaziReverseSource(JSON.stringify({ ...source, endTimestamp: source.endTimestamp + 1000 })),
    null,
  );
  assert.equal(parseBaziReverseSource(JSON.stringify({ ...source, endExclusive: false })), null);
  assert.equal(parseBaziReverseSource(JSON.stringify({ ...source, offsetHours: 9 })), null);
});

test('候选边界文本与时间戳不一致时不回填代表时刻', () => {
  const pillars = getGanZhiFromDate(beijingDate(2000, 1, 7, 9));
  const candidate = reverseBaziDates({ pillars, startYear: 2000, endYear: 2000 }).candidates[0];
  assert.ok(candidate);
  const invalidCandidate = {
    ...candidate,
    start: {
      ...candidate.start,
      text: candidate.start.text.replace(/:\d{2}$/, ':01'),
    },
  };
  assert.equal(resolveBaziReverseCandidate(invalidCandidate), null);
});
