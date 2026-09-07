import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INSTANT_CHART_DEFINITIONS,
  INSTANT_CHART_TYPES,
  buildInstantChartContext,
  calculateInstantChart,
} from 'mingyu-core/instant';

const fixedInstant = new Date('2026-08-24T12:30:00+08:00');
const beijingObserver = {
  locationName: '北京市东城区',
  longitude: 116.416,
  latitude: 39.929,
  timezone: 8,
  timeZoneId: 'Asia/Shanghai',
};

test('即时盘目录只包含可按当前时刻生成的排盘，不混入占卜', () => {
  assert.deepEqual(INSTANT_CHART_TYPES, ['bazi', 'ziwei', 'bazi-ziwei', 'astrolabe', 'qizheng']);
  assert.equal(INSTANT_CHART_DEFINITIONS.length, 5);
  assert.equal(
    INSTANT_CHART_DEFINITIONS.some((item) => item.type === ('liuyao' as never)),
    false,
  );
});

test('北京时间即时盘固定按东八区提取当前墙上时间', () => {
  const context = buildInstantChartContext({
    type: 'bazi',
    customDate: fixedInstant,
    timeStandard: 'beijing',
  });

  assert.deepEqual(context.wallClock, {
    year: 2026,
    month: 8,
    day: 24,
    hour: 12,
    minute: 30,
    offsetHours: 8,
  });
  assert.equal(context.trueSolarTime, undefined);
});

test('八字即时盘不返回性别、大运和命卦等个人字段', async () => {
  const response = await calculateInstantChart({
    type: 'bazi',
    customDate: fixedInstant,
    timeStandard: 'beijing',
  });
  const result = response.result as unknown as Record<string, unknown>;

  assert.equal(response.generatedAt, fixedInstant.toISOString());
  assert.equal(response.timeStandard, 'beijing');
  assert.equal('gender' in result, false);
  assert.equal('luckInfo' in result, false);
  assert.equal('mingGua' in result, false);
  assert.equal('liunian' in result, false);
  assert.equal(typeof response.result.pillars.hour.ganZhi, 'string');
});

test('紫微即时盘只返回无性别的共通宫位资料', async () => {
  const response = await calculateInstantChart({
    type: 'ziwei',
    customDate: fixedInstant,
  });

  assert.equal('gender' in response.result.basicInfo, false);
  assert.equal(response.result.palaces.length, 12);
  assert.equal('changsheng12' in response.result.palaces[0], false);
  assert.equal('boshi12' in response.result.palaces[0], false);
  assert.equal('ages' in response.result.palaces[0], false);
});

test('真太阳时即时盘必须提供地点并返回校正结果', async () => {
  await assert.rejects(
    () =>
      calculateInstantChart({
        type: 'bazi',
        customDate: fixedInstant,
        timeStandard: 'true-solar',
      }),
    /观测地点/,
  );

  const response = await calculateInstantChart({
    type: 'bazi',
    customDate: fixedInstant,
    timeStandard: 'true-solar',
    observer: beijingObserver,
  });
  assert.equal(response.timeStandard, 'true-solar');
  assert.equal(response.observer?.locationName, '北京市东城区');
  assert.ok(response.trueSolarTime?.correctedDateTime);
});

test('星盘和七政四余即时盘始终要求完整观测地点', async () => {
  await assert.rejects(
    () =>
      calculateInstantChart({
        type: 'astrolabe',
        customDate: fixedInstant,
      }),
    /观测地点/,
  );

  const astrolabe = await calculateInstantChart({
    type: 'astrolabe',
    customDate: fixedInstant,
    observer: beijingObserver,
  });
  assert.equal('gender' in astrolabe.result.birth, false);
  assert.match(astrolabe.result.birth.location, /北京市东城区/);

  const qizheng = await calculateInstantChart({
    type: 'qizheng',
    customDate: fixedInstant,
    observer: beijingObserver,
  });
  assert.equal(qizheng.result.stars.length >= 11, true);
  assert.equal(qizheng.result.calculationContext.longitude, beijingObserver.longitude);
  assert.match(qizheng.result.prompt, /起盘时间/);
  assert.doesNotMatch(qizheng.result.prompt, /出生时间|命主/);
});
