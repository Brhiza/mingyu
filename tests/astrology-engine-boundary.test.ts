import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AspectType,
  CelestialBody,
  calculateAspects,
  calculateChart,
  calculatePlanets,
  calculateTransits,
  getApparentPosition,
  toJulianDate,
} from '../packages/core/src/astrology/engine';

test('请求的星体超出星历数据范围时明确报错，未请求的小行星不阻断主星盘', () => {
  const input = { year: 150, month: 1, day: 1, hour: 12, minute: 0, timezone: 0 };
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
  const input = { year: 2026, month: 1, day: 1, hour: 12, minute: 0, timezone: 8 };
  for (const changed of [
    { latitude: NaN },
    { latitude: 91 },
    { longitude: Infinity },
    { longitude: 181 },
  ]) {
    assert.throws(() => calculateChart({ ...input, ...changed }), /经度|纬度/);
  }
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

test('显式未指定相位容许度沿用默认值并保持有限强度', () => {
  const bodies = [
    { name: '甲', longitude: 0 },
    { name: '乙', longitude: 61 },
  ];
  assert.deepEqual(
    calculateAspects(bodies, { orbs: { [AspectType.Sextile]: undefined } }),
    calculateAspects(bodies),
  );
});

test('交点与真莉莉丝保留星历速度和逆行状态，南北交点运动一致', () => {
  for (const year of [1990, 2008, 2026]) {
    const input = { year, month: 1, day: 1, hour: 12, minute: 0, timezone: 0 };
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
