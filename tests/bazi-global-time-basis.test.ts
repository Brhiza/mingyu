import assert from 'node:assert/strict';
import test from 'node:test';
import { baziCalculator } from '@core/bazi/baziCalculator';

type BaziInput = Parameters<typeof baziCalculator.calculateBazi>[0];
type Clock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function makeInput(overrides: Partial<BaziInput> = {}): BaziInput {
  return {
    year: 2024,
    month: 2,
    day: 4,
    timeIndex: 6,
    gender: 'male',
    useTrueSolarTime: true,
    birthHour: 12,
    birthMinute: 0,
    birthSecond: 0,
    birthLongitude: -74.006,
    timezone: -5,
    ...overrides,
  };
}

function getPillarNames(result: ReturnType<typeof baziCalculator.calculateBazi>) {
  return Object.fromEntries(
    (['year', 'month', 'day', 'hour'] as const).map((key) => [key, result.pillars[key].ganZhi]),
  );
}

function assertPublicTimeAxes(
  result: ReturnType<typeof baziCalculator.calculateBazi>,
  expected: {
    pillars: Record<'year' | 'month' | 'day' | 'hour', string>;
    currentJieqi: string;
    nextJieqi: string;
    monthCommander: string;
    startSolarTime: Clock;
  },
) {
  assert.ok(result.timing, '真太阳时排盘应保留校正时间');
  assert.match(result.luckInfo.handoverInfo, /北京时间 UTC\+8/);
  assert.deepEqual(getPillarNames(result), expected.pillars);
  assert.equal(result.seasonInfo.currentJieqi, expected.currentJieqi);
  assert.equal(result.seasonInfo.nextJieqi, expected.nextJieqi);
  assert.equal(result.monthCommander, expected.monthCommander);
  assert.deepEqual(result.luckInfo.cycles[0]?.startSolarTime, expected.startSolarTime);
}

test('纽约立春前后应按真实瞬时切换年月令，起运也沿真实瞬时轴', () => {
  const before = baziCalculator.calculateBazi(
    makeInput({ birthHour: 3, birthMinute: 20, timeIndex: 1 }),
  );
  const after = baziCalculator.calculateBazi(
    makeInput({ birthHour: 3, birthMinute: 40, timeIndex: 1 }),
  );

  assertPublicTimeAxes(before, {
    pillars: { year: '癸卯', month: '乙丑', day: '戊戌', hour: '甲寅' },
    currentJieqi: '大寒',
    nextJieqi: '立春',
    monthCommander: '己',
    startSolarTime: { year: 2024, month: 2, day: 4, hour: 16, minute: 20, second: 0 },
  });
  assertPublicTimeAxes(after, {
    pillars: { year: '甲辰', month: '丙寅', day: '戊戌', hour: '甲寅' },
    currentJieqi: '立春',
    nextJieqi: '雨水',
    monthCommander: '戊',
    startSolarTime: { year: 2024, month: 2, day: 4, hour: 16, minute: 40, second: 0 },
  });
});

test('纽约固定偏移与 IANA 夏令时应得到同一年月、司令和起运轴', () => {
  const fixed = baziCalculator.calculateBazi(
    makeInput({
      year: 2024,
      month: 7,
      day: 1,
      birthHour: 12,
      birthLongitude: -74.006,
      timezone: -4,
    }),
  );
  const iana = baziCalculator.calculateBazi(
    makeInput({
      year: 2024,
      month: 7,
      day: 1,
      birthHour: 12,
      birthLongitude: -74.006,
      timezone: -4,
      timeZoneId: 'America/New_York',
    }),
  );

  assert.deepEqual(
    {
      pillars: fixed.pillars,
      currentJieqi: fixed.seasonInfo.currentJieqi,
      nextJieqi: fixed.seasonInfo.nextJieqi,
      monthCommander: fixed.monthCommander,
      start: fixed.luckInfo.cycles[0]?.startSolarTime,
    },
    {
      pillars: iana.pillars,
      currentJieqi: iana.seasonInfo.currentJieqi,
      nextJieqi: iana.seasonInfo.nextJieqi,
      monthCommander: iana.monthCommander,
      start: iana.luckInfo.cycles[0]?.startSolarTime,
    },
  );
  assert.equal(iana.timing?.timezone, -4);
  assert.equal(iana.timing?.timeZoneId, 'America/New_York');
  assertPublicTimeAxes(iana, {
    pillars: { year: '甲辰', month: '庚午', day: '丙寅', hour: '甲午' },
    currentJieqi: '夏至',
    nextJieqi: '小暑',
    monthCommander: '丁',
    startSolarTime: { year: 2024, month: 7, day: 2, hour: 0, minute: 0, second: 0 },
  });
});

test('中国经度真太阳时跨立春而真实出生瞬时仍在立春前', () => {
  const result = baziCalculator.calculateBazi(
    makeInput({
      year: 2024,
      month: 2,
      day: 4,
      birthHour: 16,
      birthMinute: 20,
      birthLongitude: 180,
      timezone: 8,
      timeIndex: 8,
    }),
  );

  assert.equal(result.timing?.correctedTime.hour, 20);
  assertPublicTimeAxes(result, {
    pillars: { year: '癸卯', month: '乙丑', day: '戊戌', hour: '壬戌' },
    currentJieqi: '大寒',
    nextJieqi: '立春',
    monthCommander: '己',
    startSolarTime: { year: 2024, month: 2, day: 4, hour: 16, minute: 20, second: 0 },
  });
});

test('中国真太阳时跨午夜应拆分年月与日时，并让小运时柱沿合成盘', () => {
  const result = baziCalculator.calculateBazi(
    makeInput({
      year: 2024,
      month: 2,
      day: 4,
      birthHour: 23,
      birthMinute: 50,
      birthLongitude: 180,
      timezone: 8,
      timeIndex: 12,
    }),
  );

  assert.equal(result.timing?.correctedTime.day, 5);
  assert.equal(result.timing?.correctedTime.hour, 3);
  assertPublicTimeAxes(result, {
    pillars: { year: '甲辰', month: '丙寅', day: '己亥', hour: '丙寅' },
    currentJieqi: '立春',
    nextJieqi: '雨水',
    monthCommander: '戊',
    startSolarTime: { year: 2024, month: 2, day: 4, hour: 23, minute: 50, second: 0 },
  });

  // 命身宫、胎元、胎息与小运均从公开核心结果核对固定真值，
  // 测试不再直接依赖第三方排盘引擎重建期望值。
  assert.deepEqual(
    {
      mingGong: result.mingGong,
      shenGong: result.shenGong,
      taiYuan: result.taiYuan,
      taiXi: result.taiXi,
      xiaoyun: result.luckInfo.cycles[0]?.years[0]?.xiaoyun?.ganZhi,
    },
    {
      mingGong: '丁丑',
      shenGong: '己巳',
      taiYuan: '丁巳',
      taiXi: '甲寅',
      xiaoyun: '丁卯',
    },
  );
});

test('中国历史夏令时的 standardTime 只回拨一次，起运按还原后的真实瞬时', () => {
  const withDst = baziCalculator.calculateBazi(
    makeInput({
      year: 1988,
      month: 7,
      day: 1,
      birthHour: 12,
      birthLongitude: 120,
      timezone: 8,
      applyChinaDst: true,
    }),
  );
  const withoutDst = baziCalculator.calculateBazi(
    makeInput({
      year: 1988,
      month: 7,
      day: 1,
      birthHour: 12,
      birthLongitude: 120,
      timezone: 8,
      applyChinaDst: false,
    }),
  );

  assert.equal(withDst.timing?.standardTime.hour, 12);
  assert.equal(withDst.timing?.dstCorrectionMinutes, -60);
  assert.equal(withDst.luckInfo.cycles[0]?.startSolarTime?.hour, 11);
  assert.equal(withoutDst.timing?.standardTime.hour, 12);
  assert.equal(withoutDst.luckInfo.cycles[0]?.startSolarTime?.hour, 12);
  assertPublicTimeAxes(withDst, {
    pillars: { year: '戊辰', month: '戊午', day: '丁巳', hour: '乙巳' },
    currentJieqi: '夏至',
    nextJieqi: '小暑',
    monthCommander: '丁',
    startSolarTime: { year: 1988, month: 7, day: 1, hour: 11, minute: 0, second: 0 },
  });
});
