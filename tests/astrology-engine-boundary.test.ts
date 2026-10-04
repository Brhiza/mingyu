import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AspectType,
  CelestialBody,
  astrologyEngine,
  calculateAspects,
  calculateChart,
  calculatePlanets,
  calculateTransits,
  getApparentPosition,
  toJulianDate,
} from '../packages/core/src/astrology/engine';
import { generateAstrolabe } from '../packages/core/src/divination/algorithms/astrolabe';
import { formatAstrolabeForPrompt } from '../packages/core/src/prompt/astrolabe';

test('行运入口拒绝无效时间、黄经、强度及未知星体相位', () => {
  const points = [{ name: '本命点', longitude: 0, type: 'planet' as const }];
  const options = { aspectTypes: [AspectType.Conjunction], transitingBodies: [CelestialBody.Moon] };
  for (const jd of [NaN, Infinity, -Infinity]) {
    assert.throws(() => calculateTransits(points, jd, options), /儒略日/);
  }
  for (const longitude of [NaN, Infinity, -Infinity]) {
    assert.throws(() => calculateTransits([{ ...points[0], longitude }], 2451545, options), /黄经/);
  }
  for (const minimumStrength of [NaN, Infinity, -1, 101]) {
    assert.throws(
      () => calculateTransits(points, 2451545, { ...options, minimumStrength }),
      /强度/,
    );
  }
  assert.throws(
    () => calculateTransits(points, 2451545, { ...options, aspectTypes: ['未知' as AspectType] }),
    /相位/,
  );
  assert.throws(
    () =>
      calculateTransits(points, 2451545, {
        ...options,
        transitingBodies: ['未知' as CelestialBody],
      }),
    /星体/,
  );
});

test('行运速度为零时非精确相位保持未判定', (context) => {
  const jd = 2451545;
  const moon = astrologyEngine.position('moon', jd);
  context.mock.method(astrologyEngine, 'position', () => ({ ...moon, speed: 0 }));
  const result = calculateTransits(
    [{ name: '本命点', longitude: moon.lon + 60.5, type: 'planet' }],
    jd,
    { aspectTypes: [AspectType.Sextile], transitingBodies: [CelestialBody.Moon] },
  );
  assert.equal(result.transits.length, 1);
  assert.equal(result.transits[0].phase, 'unknown');
});

test('星历保留验证年代与古代时标差精度说明，现代日期无多余说明', () => {
  const input = {
    year: 150,
    month: 1,
    day: 1,
    hour: 12,
    minute: 0,
    timezone: 0,
    latitude: 39.9,
    longitude: 116.4,
  };
  const old = calculateChart(input);
  assert.ok(old.warnings.some((warning) => /太阳.*1000—3000/.test(warning)));
  assert.ok(old.warnings.some((warning) => /时标差.*230秒.*0.96度.*2.11角分/.test(warning)));
  const aspectTypes = Object.values(AspectType);
  const modern = calculateChart({ ...input, year: 2026 }, { aspectTypes });
  const completeModern = structuredClone(modern);
  assert.deepEqual(modern.warnings, []);
  try {
    modern.options.aspectOrbs[AspectType.Conjunction] = 0;
    modern.options.aspectTypes.length = 0;
    assert.deepEqual(aspectTypes, Object.values(AspectType));
    const conjunction = calculateAspects([
      { name: '甲', longitude: 0 },
      { name: '乙', longitude: 7 },
    ]).aspects.filter((aspect) => aspect.type === AspectType.Conjunction);
    assert.equal(conjunction.length, 1);
    assert.equal(conjunction[0].orb, 8);
    assert.equal(conjunction[0].deviation, 7);
    assert.deepEqual(calculateChart({ ...input, year: 2026 }), completeModern);
  } finally {
    Object.assign(modern.options.aspectOrbs, completeModern.options.aspectOrbs);
  }
});

test('请求的星体超出星历数据范围时明确报错，未请求的小行星不阻断主星盘', () => {
  const input = {
    year: 150,
    month: 1,
    day: 1,
    hour: 12,
    minute: 0,
    timezone: 0,
    latitude: 39.9,
    longitude: 116.4,
  };
  assert.equal(calculateChart(input).planets.length, 10);
  for (const calculate of [calculateChart, calculatePlanets]) {
    assert.throws(() => calculate(input, { includeChiron: true }), /星历数据.*凯龙星/);
    assert.throws(
      () => calculate(input, { includeAsteroids: true }),
      /星历数据.*谷神星.*智神星.*婚神星.*灶神星/,
    );
  }
  assert.equal(
    calculateChart({ ...input, year: 2026 }, { includeChiron: true, includeAsteroids: true })
      .planets.length,
    15,
  );
});

test('星历输入拒绝不存在的公历日期及越界时分秒时区', () => {
  const input = { year: 2026, month: 1, day: 1, hour: 12, minute: 0, timezone: 8 };
  for (const changed of [
    { year: NaN },
    { year: 1.5 },
    { month: 0 },
    { month: 13 },
    { month: 2, day: 29 },
    { month: 4, day: 31 },
    { day: 0 },
    { hour: 24 },
    { minute: 60 },
    { second: 60 },
    { second: -1 },
    { timezone: NaN },
    { timezone: Infinity },
    { timezone: 15 },
  ]) {
    assert.throws(() => toJulianDate({ ...input, ...changed }), undefined, JSON.stringify(changed));
  }
  assert.equal(
    toJulianDate({ ...input, year: 2000, month: 2, day: 29 }),
    Date.parse('2000-02-29T12:00:00+08:00') / 86_400_000 + 2440587.5,
  );
});

test('星盘底层入口拒绝无效地理坐标', () => {
  const input = {
    year: 2026,
    month: 1,
    day: 1,
    hour: 12,
    minute: 0,
    timezone: 8,
    latitude: 39.9,
    longitude: 116.4,
  };
  for (const changed of [
    { latitude: NaN },
    { latitude: 91 },
    { longitude: Infinity },
    { longitude: 181 },
  ]) {
    assert.throws(() => calculateChart({ ...input, ...changed }), /经度|纬度/);
  }
});

test('星盘入口拒绝无法兑现的宫位制和位置计算中的福点请求', () => {
  const input = {
    year: 2026,
    month: 1,
    day: 1,
    hour: 12,
    minute: 0,
    timezone: 8,
    latitude: 39.9,
    longitude: 116.4,
  };
  assert.throws(
    () => calculateChart(input, { houseSystem: 'whole_sign' as 'placidus' }),
    /宫位制不受支持/u,
  );
  assert.throws(() => calculatePlanets(input, { includeLots: true }), /福点与精神点/u);
  assert.equal(calculateChart(input, { includeLots: true }).lots.length, 2);
});

test('地理极点不生成任意上升点与宫位，高纬度仍可用整宫制', () => {
  const input = {
    year: 2026,
    month: 6,
    day: 21,
    hour: 12,
    minute: 0,
    timezone: 0,
    latitude: 90,
    longitude: 0,
  };
  for (const latitude of [90, -90]) {
    assert.throws(() => calculateChart({ ...input, latitude }), /极点无法确定上升点与宫位/);
  }
  assert.equal(calculateChart({ ...input, latitude: 89.9 }).houses.system, 'whole_sign');
  assert.equal(calculatePlanets(input).find((planet) => planet.name === 'Sun')?.house, 0);
});

test('本命盘拒绝未知相位类型，避免把无效筛选显示为无相位', () => {
  assert.throws(
    () =>
      calculateChart(
        {
          year: 1990,
          month: 7,
          day: 15,
          hour: 12,
          minute: 0,
          timezone: 8,
          latitude: 39.9042,
          longitude: 116.4074,
        },
        { aspectTypes: ['未知' as AspectType] },
      ),
    /本命相位类型不受支持/,
  );
});

test('相位拒绝非有限位置速度和非法容许度强度', () => {
  const bodies = [
    { name: '甲', longitude: 0 },
    { name: '乙', longitude: 60 },
  ];
  for (const value of [NaN, Infinity, -Infinity]) {
    assert.throws(() => calculateAspects([{ name: '甲', longitude: value }, bodies[1]]), /黄经/);
    assert.throws(
      () => calculateAspects([{ ...bodies[0], longitudeSpeed: value }, bodies[1]]),
      /速度/,
    );
  }
  for (const value of [NaN, Infinity, -1]) {
    assert.throws(
      () => calculateAspects(bodies, { orbs: { [AspectType.Sextile]: value } }),
      /容许度/,
    );
  }
  for (const value of [NaN, Infinity, -1, 101]) {
    assert.throws(() => calculateAspects(bodies, { minimumStrength: value }), /最低强度/);
  }
});

test('显式未指定相位容许度采用默认值并返回可核对的相位强度', () => {
  const bodies = [
    { name: '甲', longitude: 0 },
    { name: '乙', longitude: 61 },
  ];
  const sextile = calculateAspects(bodies, {
    orbs: { [AspectType.Sextile]: undefined },
  }).aspects.find((aspect) => aspect.type === AspectType.Sextile);

  assert.ok(sextile);
  assert.equal(sextile.angle, 60);
  assert.equal(sextile.deviation, 1);
  assert.equal(sextile.orb, 6);
  assert.equal(sextile.isApplying, null);
  assert.ok(Number.isFinite(sextile.strength));
  assert.ok(Math.abs(sextile.strength - 83.33333333333333) < 1e-10);
});

test('非整星座跨度的精确谐波相位不误标越星座相位', () => {
  const quintile = calculateAspects([
    { name: '甲', longitude: 29 },
    { name: '乙', longitude: 101 },
  ]).aspects.find((aspect) => aspect.type === AspectType.Quintile);
  assert.equal(quintile?.deviation, 0);
  assert.equal(quintile?.isOutOfSign, false);

  const sextile = calculateAspects([
    { name: '甲', longitude: 29 },
    { name: '乙', longitude: 90 },
  ]).aspects.find((aspect) => aspect.type === AspectType.Sextile);
  assert.equal(sextile?.isOutOfSign, true);
});

test('行运禁用越星座相位时仍保留精确五分相', (context) => {
  const jd = 2451545;
  const moon = astrologyEngine.position('moon', jd);
  context.mock.method(astrologyEngine, 'position', () => ({ ...moon, lon: 29 }));
  const result = calculateTransits([{ name: '本命点', longitude: 101, type: 'planet' }], jd, {
    aspectTypes: [AspectType.Quintile],
    transitingBodies: [CelestialBody.Moon],
    includeOutOfSign: false,
  });
  assert.equal(result.transits.length, 1);
  assert.equal(result.transits[0].isOutOfSign, false);
});

test('交点与真莉莉丝保留星历速度和逆行状态，南北交点运动一致', () => {
  // Swiss Ephemeris 2.10.03，OSCU_APOG + MOSEPH + SPEED，公历各年1月1日12:00 UT。
  // 独立模式交叉只保护黄纬与月球远地点距离量级，不将模型差异当作适配层误差。
  const apogeeReferences = [
    { year: 1990, latitude: -5.185640671821244, distance: 0.002644845712966344 },
    { year: 2008, latitude: -4.9886539866469946, distance: 0.0027100640231280146 },
    { year: 2026, latitude: -4.983067794418891, distance: 0.002740212752146899 },
  ];
  for (const { year, latitude, distance } of apogeeReferences) {
    const input = {
      year,
      month: 1,
      day: 1,
      hour: 12,
      minute: 0,
      timezone: 0,
      latitude: 39.9,
      longitude: 116.4,
    };
    const chart = calculateChart(input, { includeNodes: true, includeLilith: true });
    const jd = toJulianDate(input);
    for (const [point, bodyId] of [
      [chart.nodes[0], 'true_node'],
      [chart.nodes[1], 'true_node'],
      [chart.lilith[0], 'true_lilith'],
    ] as const) {
      const reference = getApparentPosition(bodyId, jd);
      assert.ok(Math.abs(reference.speed) > 0.00001);
      assert.equal(point.longitudeSpeed, reference.speed);
      assert.equal(point.isRetrograde, reference.speed < 0);
    }
    const lilith = chart.lilith[0];
    assert.equal(lilith.latitude, getApparentPosition('true_lilith', jd).latitude);
    assert.ok(Math.abs(lilith.latitude - latitude) < 0.01, '真远地点黄纬应符合独立同类模式');
    assert.ok(Math.abs(lilith.distance - distance) < 0.000005, '真远地点距离应符合月球轨道量级');
  }
});

test('仅行星位置入口允许缺坐标，完整星盘入口拒绝用默认坐标生成宫位', () => {
  const input = { year: 2026, month: 1, day: 1, hour: 12, minute: 0, timezone: 8 };
  const planets = calculatePlanets(input);
  assert.equal(planets.length, 10);
  assert.ok(planets.every((planet) => planet.house === 0));
  assert.throws(() => calculateChart(input), /完整星盘计算必须同时提供出生地纬度和经度/);

  const chart = calculateChart({ ...input, latitude: 39.9, longitude: 116.4 });
  assert.ok(chart.planets.every((planet) => planet.house >= 1 && planet.house <= 12));
  for (const name of ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars']) {
    assert.equal(
      planets.find((planet) => planet.name === name)!.longitude,
      chart.planets.find((planet) => planet.name === name)!.longitude,
      name,
    );
  }
});

test('完整星盘应将已计算宫位用于同宫星群检测', () => {
  const chart = calculateChart({
    year: 1990,
    month: 7,
    day: 15,
    hour: 12,
    minute: 0,
    timezone: 8,
    latitude: 39.9042,
    longitude: 116.4074,
  });
  const members = ['Sun', 'Mercury', 'Jupiter'].map((name) =>
    chart.planets.find((planet) => planet.name === name),
  );

  assert.ok(members.every((planet) => planet?.house === 10));
  assert.equal(new Set(members.map((planet) => planet?.sign)).size, 2);
  assert.ok(chart.summary.patterns.includes('同宫星群（木星、水星、太阳，第10宫）'));
});

test('交点与莉莉丝可参与相位但不将两颗行星误判为星群', () => {
  const chart = calculateChart(
    {
      year: 2026,
      month: 1,
      day: 1,
      hour: 12,
      minute: 0,
      timezone: 0,
      latitude: 70,
      longitude: 0,
    },
    { includeNodes: true, includeLilith: true },
  );
  assert.equal(chart.houses.system, 'whole_sign');
  assert.deepEqual(
    chart.planets.filter((planet) => planet.signName === 'Pisces').map((planet) => planet.name),
    ['Saturn', 'Neptune'],
  );
  assert.equal(chart.nodes[0].signName, 'Pisces');
  assert.ok(
    chart.aspects.all.some(
      (aspect) => aspect.body1 === 'True North Node' || aspect.body2 === 'True North Node',
    ),
  );
  assert.ok(chart.summary.patterns.includes('同星座星群（火星、太阳、金星，摩羯座）'));
  assert.ok(chart.summary.patterns.includes('同宫星群（火星、太阳、金星，第12宫）'));
  assert.ok(
    chart.summary.patterns
      .filter((pattern) => pattern.includes('星群'))
      .every((pattern) => !pattern.includes('北交点') && !pattern.includes('莉莉丝')),
  );
});

test('同一组星体同宫同星座时在线任务书只列一条完整格局', () => {
  const chart = generateAstrolabe({
    name: '星群样本',
    gender: '女',
    year: '2026',
    month: '1',
    day: '1',
    hour: '12',
    minute: '0',
    timezone: '0',
    latitude: '70',
    longitude: '0',
  });
  const sameSignPattern = '同星座星群（火星、太阳、金星，摩羯座）';
  const sameHousePattern = '同宫星群（火星、太阳、金星，第12宫）';
  const members = ['火星', '太阳', '金星'].map((label) =>
    chart.planets.find((planet) => planet.label === label),
  );
  assert.ok(chart.summary.patterns.includes(sameSignPattern));
  assert.ok(chart.summary.patterns.includes(sameHousePattern));
  assert.ok(members.every((planet) => planet?.sign === '摩羯座' && planet.house === 12));

  const patternLineFor = (patterns: string[], planets = chart.planets) => {
    const line = formatAstrolabeForPrompt({
      ...chart,
      planets,
      summary: { ...chart.summary, patterns },
    })
      .split('\n')
      .find((item) => item.startsWith('十大星体格局：'));
    assert.ok(line);
    return line;
  };

  assert.equal(patternLineFor([sameSignPattern]), '十大星体格局：同星座星群（火星、太阳、金星）');
  assert.equal(patternLineFor([sameHousePattern]), '十大星体格局：同宫星群（火星、太阳、金星）');
  const patternLine = patternLineFor([sameSignPattern, sameHousePattern]);
  assert.equal(patternLine.match(/火星、太阳、金星/g)?.length, 1);
  assert.equal(patternLine, '十大星体格局：同宫同星座星群（火星、太阳、金星）');

  const missingMember = '同宫星群（火星、太阳、缺席行星，第12宫）';
  assert.equal(patternLineFor([missingMember]), `十大星体格局：${missingMember}`);

  const duplicateLabelPlanets = structuredClone(chart.planets);
  duplicateLabelPlanets.find((planet) => planet.label === '水星')!.label = '火星';
  assert.equal(
    patternLineFor([sameHousePattern], duplicateLabelPlanets),
    `十大星体格局：${sameHousePattern}`,
  );

  const zeroHouse = '同宫星群（火星、太阳、金星，第0宫）';
  assert.equal(patternLineFor([zeroHouse]), `十大星体格局：${zeroHouse}`);

  const zeroHousePlanets = structuredClone(chart.planets);
  zeroHousePlanets.find((planet) => planet.label === '金星')!.house = 0;
  assert.equal(
    patternLineFor([sameHousePattern], zeroHousePlanets),
    `十大星体格局：${sameHousePattern}`,
  );

  const extraExplanation = '同宫星群（火星、太阳、金星，第12宫，另有独立说明）';
  assert.equal(patternLineFor([extraExplanation]), `十大星体格局：${extraExplanation}`);

  const mismatchedSign = '同星座星群（火星、太阳、金星，白羊座）';
  assert.equal(patternLineFor([mismatchedSign]), `十大星体格局：${mismatchedSign}`);
});

test('小行星与凯龙星不将一两颗行星凑成星群，真实行星星群仍保留', () => {
  const input = {
    year: 2026,
    day: 1,
    hour: 12,
    minute: 0,
    timezone: 0,
    latitude: 70,
    longitude: 0,
  };
  const options = { includeAsteroids: true, includeChiron: true };
  const february = calculateChart({ ...input, month: 2 }, options);
  assert.deepEqual(
    february.planets.filter((planet) => planet.signName === 'Aries').map((planet) => planet.name),
    ['Neptune', 'Chiron', 'Ceres'],
  );
  assert.ok(
    february.summary.patterns.every(
      (pattern) => !pattern.includes('同星座星群（谷神星、凯龙星、海王星'),
    ),
  );
  assert.ok(
    february.summary.patterns.includes('同星座星群（火星、水星、冥王星、太阳、金星，水瓶座）'),
  );
  const april = calculateChart({ ...input, month: 4 }, options);
  assert.deepEqual(
    april.planets.filter((planet) => planet.signName === 'Taurus').map((planet) => planet.name),
    ['Venus', 'Uranus', 'Ceres'],
  );
  assert.ok(
    april.summary.patterns.every((pattern) => !pattern.includes('星群（谷神星、天王星、金星')),
  );
  assert.ok(april.summary.patterns.includes('同星座星群（海王星、土星、太阳，白羊座）'));
  for (const chart of [february, april]) {
    assert.ok(
      chart.summary.patterns
        .filter((pattern) => pattern.includes('星群'))
        .every((pattern) => !/凯龙星|谷神星|智神星|婚神星|灶神星/u.test(pattern)),
    );
  }
});

test('仅位置入口保留南北交点且与完整星盘的交点和莉莉丝一致', () => {
  const input = { year: 2026, month: 1, day: 1, hour: 12, minute: 0, timezone: 8 };
  const options = { includeNodes: true, includeLilith: true };
  const positions = calculatePlanets(input, options);
  const chart = calculateChart({ ...input, latitude: 39.9, longitude: 116.4 }, options);
  assert.deepEqual(
    positions.slice(10).map((point) => point.name),
    ['North Node', 'South Node', 'True Lilith'],
  );
  for (const expected of [...chart.nodes, ...chart.lilith]) {
    const actual = positions.find((point) => point.name === expected.name)!;
    assert.equal(actual.longitude, expected.longitude, expected.name);
    assert.equal(actual.longitudeSpeed, expected.longitudeSpeed, expected.name);
    assert.equal(actual.house, 0);
    if (expected.name === 'True Lilith') {
      assert.equal(actual.latitude, expected.latitude);
      assert.equal(actual.distance, expected.distance);
    }
  }
});

test('星历日期转换保留公元1至99年且时区换算可以跨年', () => {
  for (const year of [1, 4, 99, 100, 2000]) {
    const expected =
      Date.parse(`${String(year).padStart(4, '0')}-01-01T00:00:00+08:00`) / 86_400_000 +
      2_440_587.5;
    assert.equal(
      toJulianDate({ year, month: 1, day: 1, hour: 0, minute: 0, timezone: 8 }),
      expected,
    );
  }
});

test('秒级小数时区换算后排盘、位置与儒略日使用同一瞬时', () => {
  const input = {
    year: 2026,
    month: 1,
    day: 1,
    hour: 12,
    minute: 0,
    timezone: 5.5001,
    latitude: 39.9,
    longitude: 116.4,
  };
  const jd = toJulianDate(input);
  const reference = getApparentPosition('moon', jd);
  const chart = calculateChart(input);
  const moon = chart.planets.find((planet) => planet.name === 'Moon');
  const position = calculatePlanets(input).find((planet) => planet.name === 'Moon');
  assert.equal(chart.calculated.julianDate, jd);
  assert.deepEqual(chart.calculated.utcDateTime, {
    year: 2026,
    month: 1,
    day: 1,
    hour: 6,
    minute: 29,
    second: 59,
    millisecond: 640,
  });
  assert.equal(moon?.longitude, reference.longitude);
  assert.equal(position?.longitude, reference.longitude);
});

test('相位入相按当前相对速度判定而非跨过精确相位后的一小时采样', () => {
  const cases = [
    [59.99, 12, true],
    [60.01, -12, true],
    [59.99, -12, false],
    [60.01, 12, false],
    [300.01, -12, true],
    [299.99, 12, true],
  ] as const;
  for (const [longitude, longitudeSpeed, expected] of cases) {
    const result = calculateAspects([
      { name: '甲', longitude: 0, longitudeSpeed: 0 },
      { name: '乙', longitude, longitudeSpeed },
    ]).aspects.find((aspect) => aspect.type === AspectType.Sextile)!;
    assert.equal(result.isApplying, expected, `${longitude}/${longitudeSpeed}`);
  }
});

test('零容许度的精确相位强度为100且相对静止无法区分入相出相', () => {
  const result = calculateAspects(
    [
      { name: '甲', longitude: 0, longitudeSpeed: 1 },
      { name: '乙', longitude: 60, longitudeSpeed: 1 },
    ],
    { orbs: { [AspectType.Sextile]: 0 } },
  ).aspects.find((aspect) => aspect.type === AspectType.Sextile)!;
  assert.equal(result.strength, 100);
  assert.equal(result.isApplying, null);
});

test('精确相位不应被误标为出相', () => {
  for (const angle of [0, 60, 180]) {
    const type =
      angle === 0
        ? AspectType.Conjunction
        : angle === 60
          ? AspectType.Sextile
          : AspectType.Opposition;
    const result = calculateAspects([
      { name: '甲', longitude: 0, longitudeSpeed: 0 },
      { name: '乙', longitude: angle, longitudeSpeed: 1 },
    ]).aspects.find((aspect) => aspect.type === type)!;
    assert.equal(result.deviation, 0);
    assert.equal(result.isApplying, null, type);
  }
});

test('合相跨零度与冲相两侧按趋近方向判断，速度缺失保持未定', () => {
  for (const [longitude, longitudeSpeed, type] of [
    [359.99, 12, AspectType.Conjunction],
    [0.01, -12, AspectType.Conjunction],
    [179.99, 12, AspectType.Opposition],
    [180.01, -12, AspectType.Opposition],
  ] as const) {
    const bodies = [
      { name: '甲', longitude: 0, longitudeSpeed: 0 },
      { name: '乙', longitude, longitudeSpeed },
    ];
    assert.equal(
      calculateAspects(bodies).aspects.find((aspect) => aspect.type === type)!.isApplying,
      true,
    );
    assert.equal(
      calculateAspects([{ name: '甲', longitude: 0 }, bodies[1]]).aspects.find(
        (aspect) => aspect.type === type,
      )!.isApplying,
      null,
    );
  }
});

test('月亮行运在精确相位附近仍按当前运动方向识别入相', () => {
  const jd = 2451545;
  const moon = getApparentPosition('moon', jd);
  assert.ok(moon.speed > 10);
  const result = calculateTransits(
    [
      { name: '入相点', longitude: moon.longitude + 60.15, type: 'planet' },
      { name: '出相点', longitude: moon.longitude + 59.85, type: 'planet' },
    ],
    jd,
    { aspectTypes: [AspectType.Sextile], transitingBodies: [CelestialBody.Moon] },
  );
  assert.equal(result.transits.find((item) => item.natalPoint === '入相点')!.phase, 'applying');
  assert.equal(result.transits.find((item) => item.natalPoint === '出相点')!.phase, 'separating');
});

test('行运距精确六合约三角分时按运动方向区分入相与出相', () => {
  // J2000 的月亮黄经 223.3237754384° 取自 Swiss Ephemeris 2.10.03 的地心回归坐标。
  const moonLongitude = 223.32377543840954;
  const result = calculateTransits(
    [
      { name: '前方本命点', longitude: moonLongitude + 60.05, type: 'planet' },
      { name: '后方本命点', longitude: moonLongitude + 59.95, type: 'planet' },
    ],
    2451545,
    { aspectTypes: [AspectType.Sextile], transitingBodies: [CelestialBody.Moon] },
  );
  assert.ok(Math.abs(result.transits[0].transitingPosition.longitude - moonLongitude) < 0.001);
  assert.ok(result.transits.every((transit) => transit.deviation > 0.049));
  assert.equal(
    result.transits.find((transit) => transit.natalPoint === '前方本命点')?.phase,
    'applying',
  );
  assert.equal(
    result.transits.find((transit) => transit.natalPoint === '后方本命点')?.phase,
    'separating',
  );
});

test('行运精准标签采用偏差百分位展示精度，边界外仍区分入相出相', () => {
  const moonLongitude = 223.32377543840954;
  const result = calculateTransits(
    [
      { name: '显示零偏差', longitude: moonLongitude + 60.004, type: 'planet' },
      { name: '显示非零偏差', longitude: moonLongitude + 60.006, type: 'planet' },
    ],
    2451545,
    { aspectTypes: [AspectType.Sextile], transitingBodies: [CelestialBody.Moon] },
  );
  const near = result.transits.find((transit) => transit.natalPoint === '显示零偏差')!;
  const outside = result.transits.find((transit) => transit.natalPoint === '显示非零偏差')!;
  assert.equal(near.deviation.toFixed(2), '0.00');
  assert.equal(near.phase, 'exact');
  assert.equal(outside.deviation.toFixed(2), '0.01');
  assert.equal(outside.phase, 'applying');
});

test('本命格局只由十大星体及已列出的组成相位支持', () => {
  const input = {
    year: 1995,
    month: 5,
    day: 20,
    hour: 12,
    minute: 30,
    timezone: 8,
    latitude: 39.9042,
    longitude: 116.4074,
  };
  const aspectTypes = [
    AspectType.Conjunction,
    AspectType.Sextile,
    AspectType.Square,
    AspectType.Trine,
    AspectType.Opposition,
  ];
  const options = { aspectTypes, minimumAspectStrength: 30 };
  const basic = calculateChart(input, options);
  const expanded = calculateChart(input, {
    ...options,
    includeAsteroids: true,
    includeChiron: true,
    includeNodes: true,
    includeLilith: true,
    includeLots: true,
  });
  assert.deepEqual(expanded.summary.patterns, basic.summary.patterns);
  assert.deepEqual(expanded.summary.patterns, ['T字刑（火星、冥王星、太阳，焦点火星）']);
  for (const [first, second, type] of [
    ['Sun', 'Pluto', AspectType.Opposition],
    ['Sun', 'Mars', AspectType.Square],
    ['Mars', 'Pluto', AspectType.Square],
  ] as const) {
    assert.ok(
      expanded.aspects.all.some(
        (aspect) =>
          aspect.type === type &&
          ((aspect.body1 === first && aspect.body2 === second) ||
            (aspect.body1 === second && aspect.body2 === first)),
      ),
    );
  }
  assert.deepEqual(
    calculateChart(input, { ...options, aspectTypes: [AspectType.Conjunction] }).summary.patterns,
    [],
  );
});

test('风筝的对冲端不标为焦点，合相替代星体仍分别保留构型', () => {
  const chart = calculateChart({
    year: 1993,
    month: 4,
    day: 8,
    hour: 23,
    minute: 34,
    timezone: 8,
    latitude: 1.3521,
    longitude: 103.8198,
  });
  assert.deepEqual(
    chart.summary.patterns.filter((pattern) => pattern.startsWith('风筝')),
    ['风筝（火星、水星、海王星、冥王星）', '风筝（火星、水星、冥王星、天王星）'],
  );
  assert.ok(chart.summary.patterns.includes('T字刑（火星、海王星、太阳，焦点太阳）'));
  assert.ok(chart.summary.patterns.includes('T字刑（火星、太阳、天王星，焦点太阳）'));
  assert.ok(
    chart.aspects.all.some(
      (aspect) =>
        aspect.type === AspectType.Conjunction &&
        new Set([aspect.body1, aspect.body2]).size === 2 &&
        ['Uranus', 'Neptune'].includes(aspect.body1) &&
        ['Uranus', 'Neptune'].includes(aspect.body2),
    ),
  );

  const prompt = formatAstrolabeForPrompt(
    generateAstrolabe({
      name: '星盘构型样本',
      gender: '男',
      year: '1993',
      month: '4',
      day: '8',
      hour: '23',
      minute: '34',
      timezone: '8',
      latitude: '1.3521',
      longitude: '103.8198',
    }),
  );
  const patternLine = prompt.split('\n').find((line) => line.startsWith('十大星体格局：'));
  assert.ok(patternLine);
  assert.match(patternLine, /风筝（火星、水星、海王星、冥王星）/);
  assert.match(patternLine, /风筝（火星、水星、冥王星、天王星）/);
  assert.match(patternLine, /T字刑（火星、海王星、太阳，焦点太阳）/);
  assert.doesNotMatch(patternLine, /风筝（[^）]*焦点/);
});

test('筛除风筝所需六合相位后保留仍成立的大三角', () => {
  const chart = calculateChart(
    {
      year: 1993,
      month: 4,
      day: 8,
      hour: 23,
      minute: 34,
      timezone: 8,
      latitude: 1.3521,
      longitude: 103.8198,
    },
    { aspectTypes: [AspectType.Trine] },
  );
  assert.ok(chart.summary.patterns.some((pattern) => pattern.startsWith('大三角（')));
  assert.ok(chart.summary.patterns.every((pattern) => !pattern.startsWith('风筝（')));
});
