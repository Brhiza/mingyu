import assert from 'node:assert/strict';
import test from 'node:test';

import { buildBaziPersonInput, calculateBaziChartFromInput } from 'mingyu-core/bazi';
import { createBirthPlaceIndex, type BirthPlaceProvinceOption } from 'mingyu-core/location';
import { clampNumericField, validateBirthInput, type BirthInputFields } from 'mingyu-core/profile';

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

test('npm 八字完整标准时分优先于旧时辰，缺省秒为零', () => {
  const base = { gender: 'male' as const, year: 2024, month: 6, day: 1 };
  for (const [birthHour, birthMinute] of [
    [0, 5],
    ['0', '5'],
  ] as const) {
    for (const timeIndex of [6, ''] as const) {
      const person = buildBaziPersonInput({
        ...base,
        timeIndex,
        birthHour,
        birthMinute,
      });
      assert.equal(person.timeIndex, 0);
      assert.equal(person.birthHour, 0);
      assert.equal(person.birthMinute, 5);
      assert.equal(person.birthSecond, 0);
      assert.equal(
        calculateBaziChartFromInput({ ...base, timeIndex, birthHour, birthMinute }).timeInfo.index,
        0,
      );
    }
  }
  const traditional = buildBaziPersonInput({ ...base, timeIndex: 6 });
  assert.equal(traditional.timeIndex, 6);
  assert.equal(traditional.birthSecond, undefined);
});

test('npm 八字拒绝部分标准钟表与无效时分秒', () => {
  const base = { gender: 'male' as const, year: 2024, month: 6, day: 1, timeIndex: 6 };
  assert.throws(() => buildBaziPersonInput({ ...base, birthHour: 0 }), /同时提供出生小时和分钟/u);
  assert.throws(() => buildBaziPersonInput({ ...base, birthMinute: 5 }), /同时提供出生小时和分钟/u);
  assert.throws(() => buildBaziPersonInput({ ...base, birthSecond: 0 }), /同时提供出生小时和分钟/u);
  assert.throws(
    () => buildBaziPersonInput({ ...base, birthHour: 24, birthMinute: 5 }),
    /出生小时需在 0-23/u,
  );
  assert.throws(
    () => buildBaziPersonInput({ ...base, birthHour: '0', birthMinute: '坏值' }),
    /出生分钟必须是整数/u,
  );
  assert.throws(
    () => buildBaziPersonInput({ ...base, birthHour: 0, birthMinute: 5, birthSecond: 60 }),
    /出生秒数需在 0-59/u,
  );
});

test('npm 地点索引应支持级联查询、路径反查和经度读取', () => {
  const tree: BirthPlaceProvinceOption[] = [
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
  ];
  const index = createBirthPlaceIndex(tree);

  assert.equal(index.getProvinceOptions().length, 1);
  assert.equal(index.getCityOptions('BJ').length, 1);
  assert.equal(index.getDistrictOptions('bj-city')[0]?.id, 'dc');
  assert.equal(index.findByRegionId('DC')?.province.id, 'bj');
  assert.equal(index.findByDisplayName('东城区')?.district?.id, 'dc');
  assert.equal(index.resolveLongitude('dc'), 116.42);
  assert.equal(index.resolveLongitude('不存在'), null);
  const district = index.resolve('dc');
  assert.equal(district?.latitude, undefined);
  assert.equal(district?.coordinateAccuracy, undefined);

  for (const level of ['province', 'city', 'district'] as const) {
    for (const [field, value] of [
      ['longitude', NaN],
      ['longitude', Infinity],
      ['longitude', -181],
      ['longitude', 181],
      ['latitude', NaN],
      ['latitude', Infinity],
      ['latitude', -91],
      ['latitude', 91],
    ] as const) {
      const invalid = structuredClone(tree);
      const province = invalid[0];
      const city = province.cities[0];
      const node = level === 'province' ? province : level === 'city' ? city : city.districts[0];
      node[field] = value;
      assert.throws(
        () => createBirthPlaceIndex(invalid),
        new RegExp(`出生地点“${node.id}”的${field === 'longitude' ? '经度' : '纬度'}必须`),
      );
    }
  }
  for (const [longitude, latitude] of [
    [0, 0],
    [-180, -90],
    [180, 90],
  ] as const) {
    const valid = structuredClone(tree);
    Object.assign(valid[0].cities[0].districts[0], { longitude, latitude });
    const coordinates = createBirthPlaceIndex(valid);
    const resolved = coordinates.resolve('dc');
    assert.equal(resolved?.longitude, longitude);
    assert.equal(resolved?.latitude, latitude);
    assert.equal(resolved?.coordinateAccuracy, 'administrative-center');
    assert.equal(resolved?.path.district, valid[0].cities[0].districts[0]);
    assert.deepEqual(coordinates.search('东城区'), [resolved]);
    assert.equal(coordinates.resolveLongitude('dc'), longitude);
  }
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

test('自定义地点树的代码即使与内置行政区重合也不借用省级纬度', () => {
  const index = createBirthPlaceIndex([
    {
      id: '71',
      label: '自定义省',
      longitude: 100,
      cities: [
        {
          id: '7102',
          label: '自定义市',
          displayName: '自定义省 自定义市',
          longitude: 100,
          districts: [
            {
              id: '710246',
              label: '自定义区',
              displayName: '自定义省 自定义市 自定义区',
              longitude: 100.25,
            },
          ],
        },
      ],
    },
  ]);

  const resolved = index.resolve('710246');
  assert.equal(resolved?.longitude, 100.25);
  assert.equal(resolved?.latitude, undefined);
  assert.equal(resolved?.coordinateAccuracy, undefined);
  assert.equal(index.search('自定义区')[0]?.latitude, undefined);
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
      year: '2023',
      month: '2',
      day: '1',
      dateType: 'lunar',
      isLeapMonth: true,
    }),
    { ok: true },
  );
  assert.deepEqual(
    validateBirthInput({
      year: '2024',
      month: '2',
      day: '1',
      dateType: 'lunar',
      isLeapMonth: true,
    }),
    {
      ok: false,
      field: 'day',
      message: '出生资料农历日期不存在，请检查月份、日期和闰月设置',
    },
  );
  assert.deepEqual(
    validateBirthInput({
      year: '2024',
      month: '2',
      day: '1',
      dateType: 'solar',
      isLeapMonth: true,
    }),
    {
      ok: false,
      field: 'isLeapMonth',
      message: '出生资料公历日期不能设置农历闰月',
    },
  );
  const commonFields = { year: '2024', month: '2', day: '1' };
  assert.deepEqual(
    validateBirthInput({ ...commonFields, dateType: 'gregorian' } as BirthInputFields),
    { ok: false, field: 'dateType', message: '出生资料日期类型必须是 solar 或 lunar' },
  );
  assert.deepEqual(
    validateBirthInput({ ...commonFields, isLeapMonth: 'true' } as BirthInputFields),
    { ok: false, field: 'isLeapMonth', message: '出生资料闰月标志必须是布尔值' },
  );
  assert.deepEqual(
    validateBirthInput({ ...commonFields, useTrueSolarTime: 'true' } as BirthInputFields),
    { ok: false, field: 'useTrueSolarTime', message: '出生资料真太阳时标志必须是布尔值' },
  );
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
