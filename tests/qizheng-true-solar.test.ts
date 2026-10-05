import test from 'node:test';
import assert from 'node:assert/strict';
import { generateQizheng } from '../packages/core/src/qi_zheng/index.ts';
import { isQizhengDaylightAtBirth } from '../packages/core/src/qi_zheng/en-nan.ts';
import { buildMetaphysicsPrompt } from '../src/lib/metaphysics-prompt';

test('七政真太阳时只校正传统命身宫，天体位置保持同一时刻', () => {
  const input = {
    year: 1990,
    month: 5,
    day: 12,
    hour: 8,
    minute: 30,
    latitude: 31.2,
    longitude: 121.5,
    timezone: 8,
  } as const;
  const civil = generateQizheng(input);
  const trueSolar = generateQizheng({ ...input, useTrueSolarTime: true });

  assert.equal(trueSolar.calculationContext.palaceTimeMode, '真太阳时混合口径');
  assert.match(trueSolar.calculationContext.palaceTimeNote ?? '', /真太阳时校正/);
  assert.match(trueSolar.calculationContext.palaceTimeNote ?? '', /紫炁古法模型/);
  assert.doesNotMatch(
    trueSolar.calculationContext.palaceTimeNote ?? '',
    /七政四余位置仍用现代星历/,
  );
  assert.deepEqual(
    trueSolar.stars.map((star) => [star.name, star.longitude, star.xiu]),
    civil.stars.map((star) => [star.name, star.longitude, star.xiu]),
  );
  assert.equal(trueSolar.enNan?.sect, civil.enNan?.sect);
});

test('七政昼夜分金按出生地日出日落状态划分极昼极夜，并让提示词保留依据', () => {
  const location = { latitude: 69.65, longitude: 18.96, timezone: 2 };
  const summer = generateQizheng({
    ...location,
    year: 2024,
    month: 6,
    day: 21,
    hour: 2,
    minute: 0,
  });
  const winter = generateQizheng({
    ...location,
    year: 2024,
    month: 12,
    day: 21,
    hour: 12,
    minute: 0,
    timezone: 1,
  });

  assert.equal(summer.calculationContext.solarIllumination.sunriseSunset.status, '全天高于阈值');
  assert.equal(winter.calculationContext.solarIllumination.sunriseSunset.status, '全天低于阈值');
  assert.equal(summer.enNan?.sect, '昼生');
  assert.equal(winter.enNan?.sect, '夜生');
  assert.match(summer.prompt, /昼生.*当地太阳高度阈值.*-0\.833°/);
  assert.match(winter.prompt, /夜生.*当地太阳高度阈值.*-0\.833°/);
  for (const chart of [summer, winter]) {
    const prompt = buildMetaphysicsPrompt(chart.prompt, '按盘面说明昼夜与命主恩难。', {
      method: 'qizheng',
      currentTime: new Date('2024-06-21T00:00:00Z'),
    });
    assert.equal(
      chart.calculationContext.solarIllumination.sunriseSunset.solarAltitudeDegrees,
      -0.833,
    );
    // USNO 日出日落定义以太阳中心天顶距 90.8333°，计入半径与近地平折射。
    assert.match(prompt, /太阳中心名义高度-0\.833°，含标准太阳半径与近地平折射近似/);
    assert.doesNotMatch(prompt, /太阳上缘-0\.833°/);
    assert.match(prompt, /【任务】/u);
    assert.match(prompt, /【传统依据】/u);
  }
  assert.doesNotMatch(`${summer.prompt}\n${winter.prompt}`, /全天高于阈值|全天低于阈值|正常交点/);
  assert.doesNotMatch(
    `${summer.prompt}\n${winter.prompt}`,
    /太阳高朗为贵|太阴清辉为吉|逢险有救应|须防动荡受挫/,
  );
});

test('七政重历民用日按第二组升落交点判昼夜', () => {
  const input = {
    year: 1969,
    month: 9,
    day: 30,
    hour: 12,
    latitude: 8.7167,
    longitude: 167.7333,
    timeZoneId: 'Pacific/Kwajalein',
  } as const;
  const first = generateQizheng({ ...input, timezone: 11 });
  const second = generateQizheng({ ...input, timezone: -12 });
  const crossings = second.calculationContext.solarIllumination.sunriseSunset.crossings;

  assert.equal(first.enNan?.sect, '昼生');
  assert.equal(second.enNan?.sect, '昼生');
  assert.deepEqual(first.calculationContext.solarIllumination.sunriseSunset.crossings, crossings);
  assert.deepEqual(
    crossings.map((event) => event.direction),
    ['上行', '下行', '上行', '下行'],
  );
  assert.deepEqual(
    crossings.map((event) => event.utcOffset),
    ['+11:00', '+11:00', '-12:00', '-12:00'],
  );
  assert.equal(
    isQizhengDaylightAtBirth(
      crossings[2].utcTimestamp - 1,
      second.calculationContext.solarIllumination.sunriseSunset,
    ),
    false,
  );
  assert.equal(
    isQizhengDaylightAtBirth(
      crossings[2].utcTimestamp,
      second.calculationContext.solarIllumination.sunriseSunset,
    ),
    true,
  );
  assert.equal(
    isQizhengDaylightAtBirth(
      crossings[3].utcTimestamp,
      second.calculationContext.solarIllumination.sunriseSunset,
    ),
    false,
  );
  assert.ok(
    crossings[2].utcTimestamp <
      Date.parse(second.calculationContext.solarIllumination.referenceUtcDateTime),
  );
  assert.ok(
    crossings[3].utcTimestamp >
      Date.parse(second.calculationContext.solarIllumination.referenceUtcDateTime),
  );
  assert.match(
    second.calculationContext.solarIllumination.sunriseSunset.promptText,
    /UTC\+11:00.*UTC-12:00/,
  );
});
