import assert from 'node:assert/strict';
import test from 'node:test';

import { buildBaziPersonInput, calculateBaziChartFromInput } from 'mingyu-core/bazi';
import { createBirthPlaceIndex } from 'mingyu-core/location';
import { clampNumericField, validateBirthInput } from 'mingyu-core/profile';

test('npm 八字输入适配器应接受普通 JSON 和表单文本', () => {
  const input = buildBaziPersonInput({
    gender: 'female',
    year: '1990',
    month: '5',
    day: '15',
    timeIndex: '5',
    dateType: 'solar',
  });

  assert.deepEqual(input, {
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 5,
    gender: 'female',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
    birthHour: undefined,
    birthMinute: undefined,
    birthPlace: undefined,
    birthLongitude: undefined,
    timezone: undefined,
    applyChinaDst: undefined,
    age: undefined,
  });

  const result = calculateBaziChartFromInput({
    gender: 'female',
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 5,
  });
  assert.equal(result.pillars.hour.ganZhi.length, 2);
});

test('npm 八字输入适配器应支持真太阳时精确时分和经度', () => {
  const input = buildBaziPersonInput({
    gender: 'male',
    year: '1990',
    month: '5',
    day: '15',
    timeIndex: '',
    useTrueSolarTime: true,
    birthHour: '0',
    birthMinute: '5',
    birthLongitude: '75',
    timezone: 8,
    timeZoneId: 'Asia/Shanghai',
  });

  assert.equal(input.useTrueSolarTime, true);
  assert.equal(input.timeIndex, 0);
  assert.equal(input.birthHour, 0);
  assert.equal(input.birthMinute, 5);
  assert.equal(input.birthLongitude, 75);
  assert.equal(input.timezone, 8);
  assert.equal(input.timeZoneId, 'Asia/Shanghai');
});

test('npm 地点索引应支持级联查询、路径反查和经度读取', () => {
  const index = createBirthPlaceIndex([
    {
      id: 'bj',
      label: '北京市',
      longitude: 116.4,
      cities: [
        {
          id: 'bj-city',
          label: '北京市',
          displayName: '北京市',
          longitude: 116.4,
          districts: [
            {
              id: 'dc',
              label: '东城区',
              displayName: '东城区',
              longitude: 116.42,
            },
          ],
        },
      ],
    },
  ]);

  assert.equal(index.getProvinceOptions().length, 1);
  assert.equal(index.getCityOptions('BJ').length, 1);
  assert.equal(index.getDistrictOptions('bj-city')[0]?.id, 'dc');
  assert.equal(index.findByRegionId('DC')?.province.id, 'bj');
  assert.equal(index.findByDisplayName('东城区')?.district?.id, 'dc');
  assert.equal(index.resolveLongitude('dc'), 116.42);
  assert.equal(index.resolveLongitude('不存在'), null);
  assert.equal(index.resolve('dc')?.latitude, undefined);
  assert.equal(index.resolve('dc')?.coordinateAccuracy, undefined);
});

test('自定义地点索引应拒绝把重名简称静默解析为其中一项', () => {
  const index = createBirthPlaceIndex([
    {
      id: 'p1',
      label: '甲省',
      longitude: 110,
      cities: [
        {
          id: 'c1',
          label: '甲市',
          displayName: '甲省 甲市',
          longitude: 110,
          districts: [
            {
              id: 'd1',
              label: '中心区',
              displayName: '甲省 甲市 中心区',
              longitude: 110,
            },
          ],
        },
      ],
    },
    {
      id: 'p2',
      label: '乙省',
      longitude: 120,
      cities: [
        {
          id: 'c2',
          label: '乙市',
          displayName: '乙省 乙市',
          longitude: 120,
          districts: [
            {
              id: 'd2',
              label: '中心区',
              displayName: '乙省 乙市 中心区',
              longitude: 120,
            },
          ],
        },
      ],
    },
  ]);

  assert.equal(index.findByDisplayName('中心区'), null);
  assert.equal(index.resolve('中心区'), null);
  assert.equal(index.resolveLongitude('中心区'), null);
  assert.equal(index.resolve('甲省 甲市 中心区')?.regionId, 'd1');
  assert.deepEqual(
    index.search('中心区').map((item) => item.regionId),
    ['d1', 'd2'],
  );
});

test('npm 出生输入校验应返回字段级错误并复用真太阳时边界', () => {
  assert.deepEqual(
    validateBirthInput(
      {
        year: '2024',
        month: '2',
        day: '30',
        useTrueSolarTime: true,
        birthHour: '12',
        birthMinute: '0',
        birthLongitude: '116.4',
      },
      '本人',
    ),
    { ok: false, field: 'day', message: '本人日期需在 1-29 之间' },
  );
  assert.deepEqual(validateBirthInput({ year: '1990', month: '5', day: '15' }), { ok: true });
  assert.deepEqual(
    validateBirthInput({
      year: '1990',
      month: '5',
      day: '15',
      useTrueSolarTime: true,
      birthHour: '24',
    }),
    { ok: false, field: 'birthHour', message: '出生资料小时需在 0-23 之间' },
  );
  assert.deepEqual(
    validateBirthInput({
      year: '1990',
      month: '5',
      day: '15',
      useTrueSolarTime: true,
      birthMinute: '60',
    }),
    { ok: false, field: 'birthMinute', message: '出生资料分钟需在 0-59 之间' },
  );
  assert.equal(clampNumericField('birthHour', '123'), '12');
  assert.equal(clampNumericField('birthHour', '1a'), '1a');
});
