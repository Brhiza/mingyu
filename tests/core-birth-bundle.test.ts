import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateBirthChartBundle, type BirthProfile } from 'mingyu-core/birth';
import { generateQizheng } from 'mingyu-core/qizheng';
import { birthProfileToQizhengInput, normalizeBirthProfile } from 'mingyu-core/profile';

const profile: BirthProfile = {
  name: '统一档案样例',
  gender: 'male',
  calendarType: 'solar',
  year: 1990,
  month: 5,
  day: 15,
  hour: 10,
  minute: 30,
  location: {
    name: '北京',
    longitude: 116.4,
    latitude: 39.9,
    timezone: 8,
  },
  useTrueSolarTime: true,
};

test('统一出生档案 Bundle 应共享同一套真太阳时输入并生成多种盘面', async () => {
  const bundle = await calculateBirthChartBundle(profile, {
    systems: ['bazi', 'astrolabe', 'qizheng'],
  });

  assert.deepEqual(bundle.systems, ['bazi', 'astrolabe', 'qizheng']);
  assert.equal(bundle.bazi?.pillars.hour.ganZhi.length, 2);
  assert.equal(bundle.astrolabe?.birth.isTrueSolarTime, true);
  assert.equal(bundle.qizheng?.stars.length, 11);
  assert.equal(bundle.inputs.qizheng?.useTrueSolarTime, true);
  assert.deepEqual(bundle.normalized, normalizeBirthProfile(profile));
});

test('七政四余适配器应把原始民用时间交给引擎，避免真太阳时重复校正', () => {
  const normalized = normalizeBirthProfile(profile);
  const input = birthProfileToQizhengInput(profile);
  const direct = generateQizheng(input);

  assert.deepEqual(
    [input.year, input.month, input.day, input.hour, input.minute],
    [
      normalized.solarClockTime.year,
      normalized.solarClockTime.month,
      normalized.solarClockTime.day,
      normalized.solarClockTime.hour,
      normalized.solarClockTime.minute,
    ],
  );
  assert.deepEqual(direct.stars, generateQizheng(input).stars);
});

test('出生 Bundle 默认只计算八字，避免无意触发可选紫微依赖', async () => {
  const bundle = await calculateBirthChartBundle({ ...profile, useTrueSolarTime: false });

  assert.deepEqual(bundle.systems, ['bazi']);
  assert.ok(bundle.bazi);
  assert.equal(bundle.ziwei, undefined);
  assert.equal(bundle.astrolabe, undefined);
  assert.equal(bundle.qizheng, undefined);
});

test('统一出生档案应能只按行政区代码补全地点与坐标', () => {
  const normalized = normalizeBirthProfile({
    ...profile,
    location: { regionId: '110101' },
  });

  assert.equal(normalized.resolvedLocation?.name, '北京市 东城区');
  assert.equal(normalized.resolvedLocation?.longitude, 116.416334);
  assert.equal(normalized.resolvedLocation?.latitude, 39.928359);
  assert.equal(normalized.resolvedLocation?.timezone, 8);
  assert.equal(normalized.resolvedLocation?.coordinateAccuracy, 'administrative-center');
});

test('统一出生档案混用显式坐标与行政中心坐标时应保留精度来源', () => {
  const mixed = normalizeBirthProfile({
    ...profile,
    location: { regionId: '110101', longitude: 116.5 },
  });
  const provided = normalizeBirthProfile({
    ...profile,
    location: { regionId: '110101', longitude: 116.5, latitude: 40 },
  });

  assert.equal(mixed.resolvedLocation?.longitude, 116.5);
  assert.equal(mixed.resolvedLocation?.latitude, 39.928359);
  assert.equal(mixed.resolvedLocation?.coordinateAccuracy, 'mixed');
  assert.equal(provided.resolvedLocation?.coordinateAccuracy, 'user-provided');
});
