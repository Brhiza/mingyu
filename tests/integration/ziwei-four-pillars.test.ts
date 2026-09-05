import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildAstrolabeFromInput,
  buildBasicInfo,
  buildZiweiChartInput,
  calculateZiweiChart,
  calculateZiweiDisplayPayload,
} from '@core/ziwei/iztro';
import { buildZiweiTaskBookSnapshot } from '@core/ziwei/prompt/snapshot';
import { BaziCalculator } from '@core/bazi/baziCalculator';

const input = {
  name: '月柱核对',
  dateType: 'solar' as const,
  birthDate: '2000-07-03',
  birthTimeIndex: 5,
  gender: '男' as const,
};

test('合参案例四柱统一为节气月，紫微原始农历月及运限保持不变', async () => {
  const runtime = await calculateZiweiChart(input, {
    scopes: ['origin', 'monthly'],
    horoscopeContext: { dateStr: '2026-09-04', hourIndex: 5 },
  });
  const basic = runtime.payloadByScope.origin.basic_info;
  assert.deepEqual(basic.four_pillars, {
    year_pillar: '庚辰',
    month_pillar: '壬午',
    day_pillar: '壬戌',
    hour_pillar: '乙巳',
  });
  assert.equal(runtime.astrolabe.rawDates.chineseDate.monthly.join(''), '癸未');
  assert.equal(runtime.payloadByScope.origin.calculation_config.horoscope_divide, 'normal');
  assert.deepEqual(runtime.payloadByScope.monthly.basic_info.four_pillars, basic.four_pillars);
  const original = await buildAstrolabeFromInput(input);
  const serialize = (value: unknown) =>
    JSON.stringify(value, (key, item) => (key.startsWith('_') ? undefined : item));
  assert.equal(serialize(runtime.astrolabe), serialize(original));
  const display = await calculateZiweiDisplayPayload({
    input,
    dateStr: '2026-09-04',
    hourIndex: 5,
    scope: 'monthly',
  });
  assert.deepEqual(display.basic_info.four_pillars, basic.four_pillars);
  assert.deepEqual(display.active_scope, runtime.payloadByScope.monthly.active_scope);
  const snapshot = buildZiweiTaskBookSnapshot({
    payload: runtime.payloadByScope.origin,
    reportContext: { scope: 'origin', selectedTopic: 'chat' },
  });
  assert.match(JSON.stringify(snapshot), /庚辰 壬午 壬戌 乙巳/);
  assert.doesNotMatch(JSON.stringify(snapshot), /庚辰 癸未 壬戌 乙巳/);
});

test('节气四柱展示覆盖春节前、农历输入、闰月及晚子时，并保留紫微年干', async () => {
  for (const fixture of [
    { birthDate: '2000-06-02', dateType: 'lunar' as const, expected: '壬午' },
    { birthDate: '2025-06-01', dateType: 'lunar' as const, isLeapMonth: true, expected: '癸未' },
  ]) {
    const chart = await buildAstrolabeFromInput({ ...input, ...fixture });
    assert.equal(buildBasicInfo(chart).four_pillars?.month_pillar, fixture.expected);
  }
  const chart = await buildAstrolabeFromInput({ ...input, birthDate: '2024-02-05' });
  assert.equal(chart.rawDates.chineseDate.yearly.join(''), '癸卯');
  assert.equal(buildBasicInfo(chart).four_pillars?.year_pillar, '甲辰');
  const late = await buildAstrolabeFromInput({
    ...input,
    birthTimeIndex: 12,
    dayDivide: 'current',
  });
  assert.equal(late.rawDates.chineseDate.daily.join(''), '壬戌');
  assert.equal(buildBasicInfo(late).four_pillars?.day_pillar, '癸亥');
});

test('真太阳时交节前后展示保留准确分钟并与八字四柱相同', async () => {
  for (const minute of [10, 40]) {
    const draft = {
      name: '交节核对',
      gender: 'male' as const,
      dateType: 'solar' as const,
      year: 2024,
      month: 3,
      day: 5,
      timeIndex: 5,
      isLeapMonth: false,
      useTrueSolarTime: true,
      birthHour: 10,
      birthMinute: minute,
      birthLongitude: 120,
      timezone: 8,
    };
    const normalized = buildZiweiChartInput(draft);
    const ziwei = await calculateZiweiDisplayPayload({
      input: normalized,
      dateStr: '2026-09-04',
      hourIndex: 5,
      scope: 'origin',
    });
    const bazi = new BaziCalculator().calculateBazi({ ...draft, isLunar: false });
    const pillars = ziwei.basic_info.four_pillars!;
    assert.equal(pillars.month_pillar, minute === 10 ? '丙寅' : '丁卯');
    assert.equal(pillars.month_pillar, bazi.pillars.month.ganZhi);
    assert.ok(normalized.birthTime);
  }
});

test('出生展示时分与时辰不一致时拒绝计算', async () => {
  await assert.rejects(
    buildAstrolabeFromInput({ ...input, birthTime: { hour: 12, minute: 0 } }),
    /时分与出生时辰不一致/,
  );
});
