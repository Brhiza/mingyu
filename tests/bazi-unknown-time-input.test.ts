import assert from 'node:assert/strict';
import test from 'node:test';
import { getBirthTimeDropdownOptions } from '../src/lib/birth-time';
import { normalizeChartInputForSource } from '../src/lib/case-navigation';
import { buildPersonFromInput, calculateFullBaziChart } from '../src/lib/full-chart-engine/bazi';
import { buildInputStateSearch, defaultInputState, parseInputState } from '../src/lib/query-state';

const unknownTimeInput = {
  ...defaultInputState,
  gender: 'female' as const,
  year: '2024',
  month: '2',
  day: '4',
  timeIndex: -1,
};

test('八字单盘时辰下拉明确提供未知选项，其他入口沿用具体时辰列表', () => {
  assert.deepEqual(
    getBirthTimeDropdownOptions(true).filter((option) => option.value === '-1'),
    [{ value: '-1', label: '时辰未知（列出全天候选）' }],
  );
  assert.equal(
    getBirthTimeDropdownOptions(false).some((option) => option.value === '-1'),
    false,
  );
});

test('未知时辰经查询状态进入三柱排盘并保留交节具体时刻候选', () => {
  const search = buildInputStateSearch(unknownTimeInput);
  const restored = parseInputState(new URLSearchParams(search));
  const normalized = normalizeChartInputForSource(restored, 'bazi');
  const person = buildPersonFromInput(normalized);
  const result = calculateFullBaziChart(person);

  assert.equal(restored.timeIndex, -1);
  assert.equal(person.timeIndex, -1);
  assert.equal(person.isThreePillars, true);
  assert.equal(result.isThreePillars, true);
  assert.ok(
    result.unknownTimeAnalysis?.scenarios.some((scenario) =>
      /立春临界(?:前一秒|时刻)\d{2}:\d{2}:\d{2}候选/u.test(scenario.timeName),
    ),
  );
});

test('未知时辰不会进入紫微、合参或其他要求具体时辰的入口', () => {
  for (const source of ['ziwei', 'bazi-ziwei', 'qimen-lifetime', 'bazhai'] as const) {
    assert.equal(normalizeChartInputForSource(unknownTimeInput, source).timeIndex, '', source);
  }
  assert.equal(
    normalizeChartInputForSource(
      {
        ...unknownTimeInput,
        analysisMode: 'compatibility',
        partnerTimeIndex: -1,
      },
      'bazi',
    ).timeIndex,
    '',
  );
  assert.equal(
    normalizeChartInputForSource(
      {
        ...unknownTimeInput,
        analysisMode: 'compatibility',
        partnerTimeIndex: -1,
      },
      'bazi',
    ).partnerTimeIndex,
    '',
  );
});

test('精确标准时间与真太阳时继续优先于未知时辰标记', () => {
  const precise = buildPersonFromInput({
    ...unknownTimeInput,
    birthHour: '10',
    birthMinute: '30',
    birthSecond: '15',
  });
  assert.equal(precise.timeIndex, 5);
  assert.equal(precise.isThreePillars, undefined);

  const trueSolar = buildPersonFromInput({
    ...unknownTimeInput,
    useTrueSolarTime: true,
    birthHour: '10',
    birthMinute: '30',
    birthLongitude: '116.4',
  });
  assert.equal(trueSolar.timeIndex, 0);
  assert.equal(trueSolar.isThreePillars, undefined);
});

test('查询状态只接受未知标志与既有具体时辰范围', () => {
  assert.equal(parseInputState(new URLSearchParams('ti=-1')).timeIndex, -1);
  assert.equal(parseInputState(new URLSearchParams('ti=-2')).timeIndex, '');
  assert.equal(parseInputState(new URLSearchParams('ti=13')).timeIndex, '');
});
