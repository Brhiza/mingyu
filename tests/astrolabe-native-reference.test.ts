import assert from 'node:assert/strict';
import test from 'node:test';

import { AspectType, calculateChart } from 'celestine';

import { generateAstrolabe } from 'mingyu-core/divination/astrolabe';
import type { AstrolabeAspect, AstrolabeBirthInput, AstrolabePoint } from 'mingyu-core/types';

const PLANET_LABELS: Record<string, string> = {
  Sun: '太阳',
  Moon: '月亮',
  Mercury: '水星',
  Venus: '金星',
  Mars: '火星',
  Jupiter: '木星',
  Saturn: '土星',
  Uranus: '天王星',
  Neptune: '海王星',
  Pluto: '冥王星',
  Chiron: '凯龙星',
  Ceres: '谷神星',
  Pallas: '智神星',
  Juno: '婚神星',
  Vesta: '灶神星',
  'North Node': '北交点',
  'True North Node': '北交点',
  'Mean North Node': '北交点',
  'South Node': '南交点',
  'True South Node': '南交点',
  'Mean South Node': '南交点',
  'True Lilith': '莉莉丝',
  'Mean Lilith': '莉莉丝',
  'Part of Fortune': '福点',
  'Part of Spirit': '精神点',
};

const SIGN_LABELS: Record<string, string> = {
  Aries: '白羊座',
  Taurus: '金牛座',
  Gemini: '双子座',
  Cancer: '巨蟹座',
  Leo: '狮子座',
  Virgo: '处女座',
  Libra: '天秤座',
  Scorpio: '天蝎座',
  Sagittarius: '射手座',
  Capricorn: '摩羯座',
  Aquarius: '水瓶座',
  Pisces: '双鱼座',
};

const ASPECT_LABELS: Record<string, string> = {
  conjunction: '合相',
  sextile: '六合',
  square: '刑相',
  trine: '拱相',
  opposition: '冲相',
  'semi-sextile': '半六合',
  semisextile: '半六合',
  'semi-square': '半刑',
  semisquare: '半刑',
  quintile: '五分相',
  sesquiquadrate: '补八分相',
  biquintile: '倍五分相',
};

function chineseBody(name: string): string {
  return PLANET_LABELS[name] ?? name;
}

function chineseSign(name: string): string {
  return SIGN_LABELS[name] ?? name;
}

function chineseAspect(type: string): string {
  return ASPECT_LABELS[type] ?? type;
}

function assertSamePoint(
  actual: AstrolabePoint,
  expected: {
    name: string;
    longitude: number;
    signName: string;
    degree: number;
    minute: number;
    house?: number;
    isRetrograde?: boolean;
  },
  label: string,
) {
  assert.equal(actual.name, expected.name, `${label}名称`);
  assert.ok(Math.abs(actual.longitude - expected.longitude) < 1e-9, `${label}黄经`);
  assert.equal(actual.sign, chineseSign(expected.signName), `${label}星座`);
  assert.equal(actual.degree, expected.degree, `${label}度`);
  assert.equal(actual.minute, expected.minute, `${label}分`);
  if (expected.house !== undefined) {
    assert.equal(actual.house, expected.house, `${label}宫位`);
  }
  if (expected.isRetrograde !== undefined) {
    assert.equal(actual.retrograde, expected.isRetrograde, `${label}逆行`);
  }
}

function assertSameAspect(
  actual: AstrolabeAspect,
  expected: {
    body1: string;
    body2: string;
    type: string;
    symbol: string;
    angle: number;
    separation: number;
    deviation: number;
    orb: number;
    isApplying: boolean | null;
    isOutOfSign: boolean;
  },
  label: string,
) {
  assert.equal(actual.body1, chineseBody(expected.body1), `${label}星体一`);
  assert.equal(actual.body2, chineseBody(expected.body2), `${label}星体二`);
  assert.equal(actual.type, chineseAspect(expected.type), `${label}相位类型`);
  assert.equal(actual.symbol, expected.symbol, `${label}符号`);
  assert.ok(
    Math.abs(actual.exactAngle - Number(expected.angle.toFixed(4))) < 1e-9,
    `${label}精确角`,
  );
  assert.ok(
    Math.abs(actual.actualAngle - Number(expected.separation.toFixed(4))) < 1e-9,
    `${label}实际夹角`,
  );
  assert.ok(
    Math.abs(actual.orb - Number(expected.deviation.toFixed(2))) < 1e-9,
    `${label}容许度偏差`,
  );
  assert.ok(
    Math.abs(actual.allowedOrb - Number(expected.orb.toFixed(4))) < 1e-9,
    `${label}允许容许度`,
  );
  assert.equal(actual.applying, expected.isApplying, `${label}入相位`);
  assert.equal(actual.isOutOfSign, expected.isOutOfSign, `${label}跨星座`);
}

const SAMPLES: Array<{
  input: AstrolabeBirthInput;
  scope: string;
}> = [
  {
    input: {
      name: '北京样本',
      gender: '男',
      year: '1900',
      month: '1',
      day: '15',
      hour: '12',
      minute: '0',
      latitude: '39.9042',
      longitude: '116.4074',
      timezone: '8',
      locationName: '北京',
    },
    scope: 'sample-1900-beijing',
  },
  {
    input: {
      name: '上海样本',
      gender: '女',
      year: '1990',
      month: '5',
      day: '20',
      hour: '12',
      minute: '30',
      latitude: '31.2304',
      longitude: '121.4737',
      timezone: '8',
      locationName: '上海',
    },
    scope: 'sample-1990-shanghai',
  },
  {
    input: {
      name: '纽约样本',
      gender: '男',
      year: '1950',
      month: '7',
      day: '15',
      hour: '12',
      minute: '0',
      latitude: '40.7128',
      longitude: '-74.006',
      timezone: '-5',
      locationName: '纽约',
    },
    scope: 'sample-1950-newyork',
  },
  {
    input: {
      name: '悉尼样本',
      gender: '女',
      year: '2000',
      month: '2',
      day: '29',
      hour: '23',
      minute: '45',
      latitude: '-33.8688',
      longitude: '151.2093',
      timezone: '10',
      locationName: '悉尼',
    },
    scope: 'sample-2000-sydney',
  },
  {
    input: {
      name: '伦敦样本',
      gender: '男',
      year: '2024',
      month: '6',
      day: '15',
      hour: '12',
      minute: '30',
      latitude: '51.5074',
      longitude: '-0.1278',
      timezone: '1',
      locationName: '伦敦',
    },
    scope: 'sample-2024-london',
  },
  {
    input: {
      name: '南极点附近',
      gender: '女',
      year: '2060',
      month: '6',
      day: '15',
      hour: '3',
      minute: '0',
      latitude: '-89.98',
      longitude: '139.27',
      timezone: '12',
      locationName: '南极点附近',
    },
    scope: 'sample-2060-southpole',
  },
  {
    input: {
      name: '世纪末',
      gender: '男',
      year: '2100',
      month: '12',
      day: '31',
      hour: '23',
      minute: '59',
      latitude: '31.2304',
      longitude: '121.4737',
      timezone: '8',
      locationName: '上海',
    },
    scope: 'sample-2100-shanghai',
  },
];

for (let year = 1900; year <= 2100; year += 20) {
  SAMPLES.push({
    input: {
      name: '遍历样本',
      gender: year % 2 === 0 ? '男' : '女',
      year: String(year),
      month: '3',
      day: '21',
      hour: '6',
      minute: '15',
      latitude: '22.5431',
      longitude: '114.0579',
      timezone: '8',
      locationName: '香港',
    },
    scope: `sample-${year}-hongkong`,
  });
}

test('西方星盘18张边界与跨世纪盘面应逐项复现 celestine 原生金标', () => {
  let checked = 0;
  let pointChecked = 0;
  let houseChecked = 0;
  let aspectChecked = 0;

  for (const sample of SAMPLES) {
    const result = generateAstrolabe(sample.input);
    const year = Number(sample.input.year);
    const month = Number(sample.input.month);
    const day = Number(sample.input.day);
    const hour = Number(sample.input.hour);
    const minute = Number(sample.input.minute);
    const timezone = Number(sample.input.timezone);
    const latitude = Number(sample.input.latitude);
    const longitude = Number(sample.input.longitude);

    const chart = calculateChart(
      { year, month, day, hour, minute, second: 0, timezone, latitude, longitude },
      {
        houseSystem: 'placidus',
        includeAsteroids: true,
        includeChiron: true,
        includeLilith: 'true' as const,
        includeNodes: 'true' as const,
        includeLots: true,
        aspectTypes: [
          AspectType.Conjunction,
          AspectType.Sextile,
          AspectType.Square,
          AspectType.Trine,
          AspectType.Opposition,
          AspectType.SemiSextile,
          AspectType.SemiSquare,
          AspectType.Quintile,
          AspectType.Sesquiquadrate,
          AspectType.Biquintile,
        ],
        minimumAspectStrength: 30,
      },
    );

    const expectedPoints: Array<{
      name: string;
      longitude: number;
      signName: string;
      degree: number;
      minute: number;
      house?: number;
      isRetrograde?: boolean;
    }> = [
      ...chart.planets.map((planet) => ({
        name: planet.name,
        longitude: planet.longitude,
        signName: planet.signName,
        degree: planet.degree,
        minute: planet.minute,
        house: planet.house,
        isRetrograde: planet.isRetrograde,
      })),
      ...chart.nodes.map((node) => ({
        name: node.name,
        longitude: node.longitude,
        signName: node.signName,
        degree: node.degree,
        minute: node.minute,
        house: node.house,
      })),
      ...chart.lilith.map((lilith) => ({
        name: lilith.name,
        longitude: lilith.longitude,
        signName: lilith.signName,
        degree: lilith.degree,
        minute: lilith.minute,
        house: lilith.house,
      })),
      ...chart.lots.map((lot) => ({
        name: lot.name,
        longitude: lot.longitude,
        signName: lot.signName,
        degree: lot.degree,
        minute: lot.minute,
        house: lot.house,
      })),
    ];

    assert.equal(result.planets.length, expectedPoints.length, `${sample.scope}星体数量`);
    for (let index = 0; index < expectedPoints.length; index += 1) {
      assertSamePoint(result.planets[index], expectedPoints[index], `${sample.scope}星体${index}`);
      pointChecked += 1;
    }

    const angleNames: Array<[string, string]> = [
      ['Ascendant', '上升'],
      ['Midheaven', '天顶'],
      ['Descendant', '下降'],
      ['Imum Coeli', '天底'],
    ];
    const nativeAngles = [
      chart.angles.ascendant,
      chart.angles.midheaven,
      chart.angles.descendant,
      chart.angles.imumCoeli,
    ];
    for (let index = 0; index < 4; index += 1) {
      const expectedAngle = nativeAngles[index];
      const actualAngle = result.angles.find((angle) => angle.label === angleNames[index][1]);
      assert.ok(actualAngle, `${sample.scope}${angleNames[index][1]}`);
      assertSamePoint(actualAngle, expectedAngle, `${sample.scope}${angleNames[index][1]}`);
      pointChecked += 1;
    }

    assert.equal(result.houses.length, chart.houses.cusps.length, `${sample.scope}宫位数`);
    for (let index = 0; index < chart.houses.cusps.length; index += 1) {
      const cusp = chart.houses.cusps[index];
      const actual = result.houses[index];
      assert.ok(Math.abs(actual.longitude - cusp.longitude) < 1e-9, `${sample.scope}宫头黄经`);
      assert.equal(actual.sign, chineseSign(cusp.signName), `${sample.scope}宫头星座`);
      assert.equal(actual.degree, cusp.degree, `${sample.scope}宫头度`);
      assert.equal(actual.minute, cusp.minute, `${sample.scope}宫头分`);
      assert.equal(actual.house, cusp.house, `${sample.scope}宫序号`);
      houseChecked += 1;
    }

    const actualAspectsByKey = new Map(
      result.aspects.map((aspect) => [
        `${aspect.body1}\u0000${aspect.body2}\u0000${aspect.type}`,
        aspect,
      ]),
    );
    const expectedAspectsByKey = new Map(
      chart.aspects.all.map((aspect) => [
        `${chineseBody(aspect.body1)}\u0000${chineseBody(aspect.body2)}\u0000${chineseAspect(aspect.type)}`,
        aspect,
      ]),
    );
    assert.equal(result.aspects.length, chart.aspects.all.length, `${sample.scope}相位数量`);
    for (const [key, expected] of expectedAspectsByKey) {
      const actual = actualAspectsByKey.get(key);
      assert.ok(actual, `${sample.scope}相位 ${expected.body1} ${expected.type} ${expected.body2}`);
      assertSameAspect(
        actual,
        expected,
        `${sample.scope}相位 ${expected.body1} ${expected.type} ${expected.body2}`,
      );
      aspectChecked += 1;
    }

    checked += 1;
  }

  assert.equal(checked, 18);
  assert.equal(pointChecked, 432);
  assert.equal(houseChecked, 216);
  assert.equal(aspectChecked, 551);
});
