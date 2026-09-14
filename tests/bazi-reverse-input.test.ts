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
import { resolveBaziReverseCandidate } from '../src/lib/bazi-reverse-input';
import { buildPersonFromInput, calculateFullBaziChart } from '../src/lib/full-chart-engine/bazi';
import { buildInputStateSearch, defaultInputState, parseInputState } from '../src/lib/query-state';

test('四柱反推回填保留秒级标准北京时间，并逐候选复核四柱', () => {
  const source = getGanZhiFromDate(new Date(2024, 1, 4, 23));
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

test('历史候选 1946 与 2006 年巳时可经完整输入链路复核', () => {
  const target: BaziReversePillars = {
    year: '丙戌',
    month: '乙未',
    day: '甲辰',
    hour: '己巳',
  };
  const examples = [
    { year: 1946, date: '1946-07-29' },
    { year: 2006, date: '2006-07-14' },
  ];

  for (const example of examples) {
    const reversed = reverseBaziDates({
      pillars: target,
      startYear: example.year,
      endYear: example.year,
    });
    const candidate = reversed.candidates.find((item) => item.start.text.startsWith(example.date));
    assert.ok(candidate, `${example.date} 应有己巳候选时段`);
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
  }
});

test('候选回填经查询状态和前端排盘链路仍保持四柱', () => {
  const target: BaziReversePillars = {
    year: '丙戌',
    month: '乙未',
    day: '甲辰',
    hour: '己巳',
  };
  const candidate = reverseBaziDates({ pillars: target, startYear: 2006, endYear: 2006 })
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
  };
  const restored = parseInputState(new URLSearchParams(buildInputStateSearch(input)));
  const chart = calculateFullBaziChart(buildPersonFromInput(restored));

  assert.equal(restored.birthSecond, input.birthSecond);
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
  const target = getGanZhiFromDate(
    new Date(
      termParts.year,
      termParts.month - 1,
      termParts.day,
      termParts.hour,
      termParts.minute,
      termParts.second,
    ),
  );
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
    year: 2006,
    month: 7,
    day: 14,
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
