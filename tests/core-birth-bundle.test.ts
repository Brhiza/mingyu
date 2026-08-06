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
