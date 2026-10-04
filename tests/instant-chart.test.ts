import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INSTANT_CHART_DEFINITIONS,
  INSTANT_CHART_TYPES,
  buildInstantChartContext,
  calculateInstantChart,
} from 'mingyu-core/instant';
import { calculateBaziChartFromInput } from '../packages/core/src/bazi';
import {
  buildZiweiChartInput,
  calculateZiweiChartForScopes,
} from '../packages/core/src/ziwei/runtime';

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
    second: 0,
    offsetHours: 8,
  });
  assert.equal(context.trueSolarTime, undefined);
});

test('北京时间即时盘应保留秒数并用于节气临界点排盘', async () => {
  // 2025-05-05 13:57:00 北京时间早于当日立夏的 13:57:13；
  // 若回退到未时代表值 14:00，会错误地把月柱切到巳月。
  const customDate = new Date('2025-05-05T05:57:00.000Z');
  const response = await calculateInstantChart({
    type: 'bazi',
    customDate,
    timeStandard: 'beijing',
  });
  const direct = calculateBaziChartFromInput({
    gender: 'male',
    year: 2025,
    month: 5,
    day: 5,
    timeIndex: 6,
    dateType: 'solar',
    isLeapMonth: false,
    birthHour: 13,
    birthMinute: 57,
    birthSecond: 0,
  });

  assert.equal(response.wallClock.second, 0);
  assert.equal(response.result.pillars.month.ganZhi, direct.pillars.month.ganZhi);
});

test('即时八字与紫微不暴露性别专属字段且盘面不随技术性性别改变', async () => {
  const bazi = await calculateInstantChart({ type: 'bazi', customDate: fixedInstant });
  const baziResult = bazi.result as unknown as Record<string, unknown>;

  assert.equal(bazi.generatedAt, fixedInstant.toISOString());
  assert.equal(bazi.timeStandard, 'beijing');
  assert.equal('gender' in baziResult, false);
  assert.equal('luckInfo' in baziResult, false);
  assert.equal('mingGua' in baziResult, false);
  assert.equal('liunian' in baziResult, false);
  assert.equal(typeof bazi.result.pillars.hour.ganZhi, 'string');

  const femaleBazi = calculateBaziChartFromInput({
    gender: 'female',
    year: 2026,
    month: 8,
    day: 24,
    timeIndex: 6,
    dateType: 'solar',
    isLeapMonth: false,
    birthHour: 12,
    birthMinute: 30,
    birthSecond: 0,
  }) as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(bazi.result)) {
    assert.deepEqual(value, femaleBazi[key], `八字即时盘字段 ${key} 不应依赖性别`);
  }

  const ziwei = await calculateInstantChart({ type: 'ziwei', customDate: fixedInstant });
  assert.equal('gender' in ziwei.result.basicInfo, false);
  assert.equal(ziwei.result.palaces.length, 12);
  assert.equal('changsheng12' in ziwei.result.palaces[0], false);
  assert.equal('boshi12' in ziwei.result.palaces[0], false);
  assert.equal('ages' in ziwei.result.palaces[0], false);

  const femaleInput = buildZiweiChartInput({
    name: '紫微即时盘',
    gender: 'female',
    dateType: 'solar',
    year: 2026,
    month: 8,
    day: 24,
    timeIndex: 6,
    isLeapMonth: false,
    useTrueSolarTime: false,
    birthHour: 12,
    birthMinute: 30,
    birthSecond: 0,
  });
  const femaleZiwei = (await calculateZiweiChartForScopes(femaleInput, ['origin'])).payloadByScope
    .origin;
  const compareFields = (actual: object, expected: object, label: string) => {
    const expectedRecord = expected as Record<string, unknown>;
    for (const [key, value] of Object.entries(actual)) {
      assert.deepEqual(value, expectedRecord[key], `${label}字段 ${key} 不应依赖性别`);
    }
  };
  compareFields(ziwei.result.basicInfo, femaleZiwei.basic_info, '紫微基础资料');
  compareFields(ziwei.result.activeScope, femaleZiwei.active_scope, '紫微当前范围');
  ziwei.result.palaces.forEach((palace, index) =>
    compareFields(palace, femaleZiwei.palaces[index], `紫微第 ${index + 1} 宫`),
  );
  assert.ok(
    ziwei.result.palaces
      .find((palace) => palace.name === '仆役')
      ?.other_stars.some((star) => star.name === '天伤'),
  );
  assert.ok(
    ziwei.result.palaces
      .find((palace) => palace.name === '疾厄')
      ?.other_stars.some((star) => star.name === '天使'),
  );

  const zhongzhouInput = {
    name: '紫微即时盘',
    dateType: 'solar' as const,
    year: 1995,
    month: 5,
    day: 20,
    timeIndex: 6,
    isLeapMonth: false,
    useTrueSolarTime: false,
    birthHour: 12,
    birthMinute: 30,
    birthSecond: 0,
    algorithm: 'zhongzhou' as const,
  };
  const maleZhongzhou = (
    await calculateZiweiChartForScopes(
      buildZiweiChartInput({ ...zhongzhouInput, gender: 'male' }),
      ['origin'],
    )
  ).payloadByScope.origin;
  const femaleZhongzhou = (
    await calculateZiweiChartForScopes(
      buildZiweiChartInput({ ...zhongzhouInput, gender: 'female' }),
      ['origin'],
    )
  ).payloadByScope.origin;
  assert.ok(
    maleZhongzhou.palaces
      .find((palace) => palace.name === '仆役')
      ?.other_stars.some((star) => star.name === '天使'),
  );
  assert.ok(
    maleZhongzhou.palaces
      .find((palace) => palace.name === '疾厄')
      ?.other_stars.some((star) => star.name === '天伤'),
  );
  assert.ok(
    femaleZhongzhou.palaces
      .find((palace) => palace.name === '仆役')
      ?.other_stars.some((star) => star.name === '天伤'),
  );
  assert.ok(
    femaleZhongzhou.palaces
      .find((palace) => palace.name === '疾厄')
      ?.other_stars.some((star) => star.name === '天使'),
  );
  const instantZhongzhou = await calculateInstantChart({
    type: 'ziwei',
    customDate: new Date('1995-05-20T12:30:00+08:00'),
    ziweiAlgorithm: 'zhongzhou',
  });
  assert.equal(instantZhongzhou.result.palaces.length, 12);
  assert.equal('gender' in instantZhongzhou.result.basicInfo, false);
  assert.ok(
    instantZhongzhou.result.palaces.every((palace) =>
      palace.other_stars.every((star) => star.name !== '天伤' && star.name !== '天使'),
    ),
  );
  for (const origin of [maleZhongzhou, femaleZhongzhou]) {
    compareFields(instantZhongzhou.result.calculationConfig, origin.calculation_config, '中州配置');
    compareFields(instantZhongzhou.result.basicInfo, origin.basic_info, '中州基础资料');
    compareFields(instantZhongzhou.result.activeScope, origin.active_scope, '中州当前范围');
    instantZhongzhou.result.palaces.forEach((palace, index) =>
      compareFields(
        palace,
        {
          ...origin.palaces[index],
          other_stars: origin.palaces[index].other_stars.filter(
            (star) => star.name !== '天伤' && star.name !== '天使',
          ),
        },
        `中州第 ${index + 1} 宫`,
      ),
    );
  }
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

test('即时盘保留 IANA 秒级历史偏移，按给定瞬时点生成真太阳时', () => {
  const customDate = new Date('1900-02-04T05:51:31.000Z');
  const context = buildInstantChartContext({
    type: 'bazi',
    customDate,
    timeStandard: 'true-solar',
    observer: { longitude: 2.35, timeZoneId: 'Europe/Paris' },
  });

  assert.equal(context.wallClock.offsetHours! * 3_600_000, 561_000);
  assert.deepEqual(
    [
      context.wallClock.year,
      context.wallClock.month,
      context.wallClock.day,
      context.wallClock.hour,
      context.wallClock.minute,
      context.wallClock.second,
    ],
    [1900, 2, 4, 6, 0, 52],
  );
  assert.equal(context.trueSolarTime?.timezoneEvidence?.offsetConflict, false);
  assert.equal(
    context.trueSolarTime?.timezoneEvidence?.selectedUtcDateTime,
    customDate.toISOString(),
  );
});

test('即时盘校验已提供的纬度，星盘和七政四余始终要求完整观测地点', async () => {
  for (const type of INSTANT_CHART_TYPES) {
    for (const timeStandard of ['beijing', 'true-solar'] as const) {
      for (const latitude of [91, -91, Number.NaN, Number.POSITIVE_INFINITY]) {
        assert.throws(
          () =>
            buildInstantChartContext({
              type,
              customDate: fixedInstant,
              timeStandard,
              observer: { ...beijingObserver, latitude },
            }),
          /观测地点纬度/,
          `${type} ${timeStandard} 纬度 ${latitude}`,
        );
      }
      for (const latitude of [-90, 0, 90]) {
        const context = buildInstantChartContext({
          type,
          customDate: fixedInstant,
          timeStandard,
          observer: { ...beijingObserver, latitude },
        });
        assert.equal(context.observer?.latitude, latitude);
      }
    }
  }
  const { latitude: _latitude, ...observerWithoutLatitude } = beijingObserver;
  for (const type of ['bazi', 'ziwei', 'bazi-ziwei'] as const) {
    for (const timeStandard of ['beijing', 'true-solar'] as const) {
      const context = buildInstantChartContext({
        type,
        customDate: fixedInstant,
        timeStandard,
        observer: observerWithoutLatitude,
      });
      assert.equal('latitude' in context.observer!, false);
    }
  }
  await assert.rejects(
    () =>
      calculateInstantChart({
        type: 'bazi',
        customDate: fixedInstant,
        observer: { ...beijingObserver, latitude: 91 },
      }),
    /观测地点纬度/,
  );
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
  assert.match(qizheng.result.prompt, /起盘地点：/);
  assert.match(qizheng.result.prompt, /按起盘时刻与当地太阳高度阈值/);
  assert.match(qizheng.result.prompt, /命宫主宰星/);
  assert.match(qizheng.result.prompt, /本盘记录起盘时刻的星曜位置、落宿、落宫和吊照/);
  assert.doesNotMatch(qizheng.result.prompt, /出生|昼生|夜生|命主|命宫主星/);
});
