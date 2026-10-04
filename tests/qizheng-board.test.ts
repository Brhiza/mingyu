import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  calculateQizhengMansionBoundaries,
  generateQizheng,
  getQizhengDignity,
  getQizhengMingZhu,
  getQizhengSignBranch,
  longitudeToQizhengMansion,
  QIZHENG_MANSION_MODEL,
  QIZHENG_POSITION_SOURCES,
  QIZHENG_SIGN_BRANCHES,
  ZIQI_MODEL_INFO,
} from '@core/qi_zheng';
import { QizhengBoard } from '../src/pages/ResultPage/components/QizhengBoard';

let beijingDefaultChart: ReturnType<typeof generateQizheng> | undefined;
function getBeijingDefaultChart() {
  if (!beijingDefaultChart) {
    beijingDefaultChart = generateQizheng({
      year: 1990,
      month: 6,
      day: 15,
      hour: 10,
      minute: 30,
      latitude: 39.9042,
      longitude: 116.4074,
      timezone: 8,
    });
  }
  return beijingDefaultChart;
}

test('七政四余页面应能直接渲染并显示典籍折叠区', () => {
  const data = getBeijingDefaultChart();

  const html = renderToStaticMarkup(
    createElement(QizhengBoard, { title: '七政四余', name: '测试命盘', data }),
  );
  assert.match(html, /七政四余十一曜/);
  assert.match(html, /果老星宗/);
  assert.match(html, /回归黄经/);
  assert.doesNotMatch(html, /恒星黄经/);
});

test('七政四余未定义恒星黄道零点时只输出目标日期黄经', () => {
  const result = generateQizheng({
    year: 2024,
    month: 3,
    day: 20,
    hour: 3,
    minute: 6,
    latitude: 0,
    longitude: 0,
    timezone: 0,
  });

  const sun = result.stars.find((star) => star.name === '太阳');
  assert.ok(sun);
  // JPL Horizons 地心 TT 2024-03-20T03:07:14 给出太阳黄经 359.9997646°。
  assert.ok(Math.abs(sun.longitude - 359.9997646) < 0.001);
  assert.equal(sun.signIndex, 11);
  const afterZero = generateQizheng({
    year: 2024,
    month: 3,
    day: 20,
    hour: 3,
    minute: 7,
    latitude: 0,
    longitude: 0,
    timezone: 0,
  }).stars.find((star) => star.name === '太阳');
  assert.ok(afterZero);
  assert.ok(afterZero.longitude < 0.001);
  assert.equal(afterZero.signIndex, 0);

  assert.equal(
    result.ziqi.tropicalLongitude,
    result.stars.find((star) => star.name.startsWith('紫炁'))?.longitude,
  );
  assert.equal('siderealLongitude' in result.ziqi, false);
  for (const fact of result.evidenceAnalysis.starFacts) {
    assert.equal(fact.longitude, result.stars.find((star) => star.name === fact.name)?.longitude);
    assert.equal('siderealLongitude' in fact, false);
  }
  assert.doesNotMatch(result.prompt, /恒星黄经/);
});

test('七政四余可选秒数应贯穿天文时间、光照证据与出生提示，省略时保持默认结果', () => {
  const withoutSecond = getBeijingDefaultChart();
  const withSecond = generateQizheng({
    year: 1990,
    month: 6,
    day: 15,
    hour: 10,
    minute: 30,
    second: 37,
    latitude: 39.9042,
    longitude: 116.4074,
    timezone: 8,
  });

  assert.equal(withoutSecond.calculationContext.localDateTime, '1990-06-15T10:30:00');
  assert.equal(withSecond.calculationContext.localDateTime, '1990-06-15T10:30:37');
  assert.equal(withSecond.calculationContext.astronomicalTime.localDateTime, '1990-06-15 10:30:37');
  assert.equal(
    withSecond.calculationContext.solarIllumination.referenceLocalDateTime,
    '1990-06-15 10:30:37',
  );
  assert.match(withSecond.prompt, /出生时间：1990年6月15日 10:30:37/);
  assert.notEqual(
    withSecond.stars.find((item) => item.name === '太阳')?.tropicalLongitude,
    withoutSecond.stars.find((item) => item.name === '太阳')?.tropicalLongitude,
  );
  assert.throws(
    () => generateQizheng({ year: 1990, month: 6, day: 15, hour: 10, second: 60 }),
    /秒需在 0-59 之间/,
  );
});

test('现代黄经宫序必须先换成传统宫支再查命主', () => {
  assert.deepEqual(QIZHENG_SIGN_BRANCHES, [
    '戌',
    '酉',
    '申',
    '未',
    '午',
    '巳',
    '辰',
    '卯',
    '寅',
    '丑',
    '子',
    '亥',
  ]);
  const expectedMingZhuByBranch = {
    子: '土',
    丑: '土',
    寅: '木',
    卯: '火',
    辰: '金',
    巳: '水',
    午: '日',
    未: '月',
    申: '水',
    酉: '金',
    戌: '火',
    亥: '木',
  } as const;

  for (let signIndex = 0; signIndex < 12; signIndex += 1) {
    const branch = getQizhengSignBranch(signIndex);
    assert.equal(getQizhengMingZhu(signIndex), expectedMingZhuByBranch[branch]);
  }
  assert.equal(getQizhengMingZhu(0), '火', '白羊黄经宫对应戌宫，不得误按子宫取土');
  assert.equal(getQizhengMingZhu(10), '土', '水瓶黄经宫才对应传统子宫');
});

test('七政庙旺喜乐应与星学大成第三章一致并保留重叠状态', () => {
  const expected = {
    日: { 戌: '庙', 巳: '旺', 寅: '喜', 午: '乐' },
    月: { 戌: '庙', 酉: '旺', 亥: '喜', 未: '乐' },
    水: { 午: '庙', 子: '旺', 巳: '旺/乐', 辰: '喜', 申: '乐' },
    金: { 辰: '庙/乐', 午: '旺', 亥: '旺', 酉: '乐' },
    火: { 卯: '庙/乐', 丑: '旺', 申: '喜', 戌: '乐' },
    木: { 亥: '庙/旺/乐', 未: '旺/喜', 寅: '乐' },
    土: { 丑: '庙/乐', 卯: '旺', 辰: '旺', 午: '喜', 子: '乐' },
  } as const;

  for (const [star, branchStatuses] of Object.entries(expected)) {
    for (const [branch, status] of Object.entries(branchStatuses)) {
      const signIndex = QIZHENG_SIGN_BRANCHES.indexOf(branch as never);
      assert.notEqual(signIndex, -1);
      assert.equal(getQizhengDignity(star, signIndex), status, `${star}在${branch}宫状态错误`);
    }
  }
  assert.equal(getQizhengDignity('金', QIZHENG_SIGN_BRANCHES.indexOf('子')), '平');
  assert.doesNotMatch(
    QIZHENG_SIGN_BRANCHES.map((_, index) => getQizhengDignity('金', index)).join('、'),
    /陷/,
  );
});

test('七政四余完整盘采用二十八宿真实距星边界并保持位置来源分层', () => {
  const result = getBeijingDefaultChart();

  assert.equal(result.stars.length, 11);
  assert.equal(result.stars.filter((star) => star.kind === '七政').length, 7);
  assert.equal(result.stars.filter((star) => star.kind === '四余').length, 4);
  assert.equal(result.mansionBoundaries.length, 28);
  assert.equal(new Set(result.mansionBoundaries.map((item) => item.mansion)).size, 28);
  assert.ok(
    Math.abs(
      result.mansionBoundaries.reduce((sum, boundary) => sum + boundary.widthDegrees, 0) - 360,
    ) < 1e-9,
  );
  for (const star of result.stars) {
    const boundary = result.mansionBoundaries.find((item) => item.mansion === star.xiu);
    assert.ok(boundary);
    assert.ok(star.xiuDegree >= 0 && star.xiuDegree < boundary.widthDegrees);
    assert.equal(star.signBranch, getQizhengSignBranch(star.signIndex));
    assert.match(result.prompt, new RegExp(`落${star.signBranch}宫${star.palace}`));
  }
  assert.ok(
    result.evidenceAnalysis.starFacts.every(
      (fact) =>
        fact.signBranch === getQizhengSignBranch(fact.signIndex) &&
        fact.promptText.includes(`落${fact.signBranch}宫${fact.palace}`),
    ),
  );
  assert.equal(
    result.stars.find((star) => star.name.startsWith('紫炁'))?.precisionClass,
    '传统均速模型',
  );
  assert.ok(
    result.stars
      .filter((star) => !star.name.startsWith('紫炁'))
      .every((star) => star.precisionClass === '现代天文计算'),
  );
  assert.doesNotMatch(result.prompt, /宿界模型/);
  assert.doesNotMatch(result.prompt, /366\.5|等比例换算/);

  const original = structuredClone(result);
  try {
    Reflect.set(result.mansionModel, 'id', '变造模型身份');
    Reflect.set(result.mansionModel, 'mappingSource', '变造星宿对应资料');
    Reflect.set(result.mansionModel, 'transformSource', '变造坐标变换资料');
    result.ziqiModel.name = '变造紫炁模型';
    result.ziqiModel.sources[0].title = '变造紫炁原文';
    result.positionSources[0].objects[0] = '变造星曜';
    result.positionSources[0].calculation = '变造位置计算';
    result.positionSources[0].limitations[0] = '变造模型限制';
    result.evidenceAnalysis.positionSourceFacts[0].promptLimitations[1] = '变造证据限制';

    assert.equal(QIZHENG_MANSION_MODEL.id, 'qizheng-mansion-stars-simbad-astronomy-engine');
    assert.equal(ZIQI_MODEL_INFO.name, '《七政算内篇》紫炁古法均速');
    assert.equal(ZIQI_MODEL_INFO.sources[0].title, '《七政算内篇》四余星第七·紫气');
    assert.equal(QIZHENG_POSITION_SOURCES[0].objects[0], '太阳');
    assert.deepEqual(QIZHENG_MANSION_MODEL, original.mansionModel);
    assert.deepEqual(ZIQI_MODEL_INFO, original.ziqiModel);
    assert.deepEqual(QIZHENG_POSITION_SOURCES, original.positionSources);
    const fresh = generateQizheng({
      year: 1990,
      month: 6,
      day: 15,
      hour: 10,
      minute: 30,
      latitude: 39.9042,
      longitude: 116.4074,
      timezone: 8,
    });
    assert.deepEqual(fresh, original);
  } finally {
    Object.assign(QIZHENG_MANSION_MODEL, original.mansionModel);
    Object.assign(ZIQI_MODEL_INFO, structuredClone(original.ziqiModel));
    QIZHENG_POSITION_SOURCES.splice(
      0,
      QIZHENG_POSITION_SOURCES.length,
      ...structuredClone(original.positionSources),
    );
    Object.assign(result, original);
  }
});

test('罗计真交点与月孛平均远地点与 Swiss Moshier 独立金标一致', () => {
  const result = generateQizheng({
    year: 2000,
    month: 1,
    day: 15,
    hour: 12,
    minute: 30,
    latitude: 39.9042,
    longitude: 116.4074,
    timezone: 8,
  });
  const luoHou = result.stars.find((star) => star.name === '罗睺(火余)');
  const jiDu = result.stars.find((star) => star.name === '计都(土余)');
  const yueBei = result.stars.find((star) => star.name === '月孛(水余)');
  assert.ok(luoHou && jiDu && yueBei);

  assert.ok(Math.abs(luoHou.tropicalLongitude - 123.74054939272715) < 0.02);
  assert.ok(Math.abs(jiDu.tropicalLongitude - 303.74054939272715) < 0.02);
  assert.ok(Math.abs(yueBei.tropicalLongitude - 264.98784404655476) < 0.02);
  assert.equal(luoHou.sourceId, 'astronomy-engine-true-node');
  assert.equal(jiDu.sourceId, 'astronomy-engine-true-node');
  assert.equal(yueBei.sourceId, 'moshier-mean-lilith');
});

test('月孛明确采用平均远地点模型，不得回退为瞬时真远地点口径', () => {
  const result = generateQizheng({
    year: 2004,
    month: 1,
    day: 15,
    hour: 12,
    minute: 30,
    latitude: 39.9042,
    longitude: 116.4074,
    timezone: 8,
  });
  const yueBei = result.stars.find((star) => star.name === '月孛(水余)');
  const source = result.positionSources.find((item) => item.id === 'moshier-mean-lilith');

  assert.ok(yueBei && source);
  assert.equal(yueBei.sourceId, 'moshier-mean-lilith');
  assert.equal(yueBei.precisionClass, '现代天文计算');
  assert.match(source.calculation, /平均远地点/);
  assert.match(source.limitations.join('；'), /平均远地点、瞬时真远地点等不同口径/);
  assert.ok(Math.abs(yueBei.tropicalLongitude - 67.5591396094347) < 0.02);
  assert.ok(
    Math.abs(yueBei.tropicalLongitude - 97.47136201100378) > 20,
    '月孛结果不应采用瞬时真远地点口径',
  );
});

test('二十八宿距星黄经与 Astropy ERFA 独立金标一致', () => {
  const boundaries = calculateQizhengMansionBoundaries(new Date('2000-01-01T12:00:00Z'));
  const astropyGold = new Map([
    ['壁', 9.15204207],
    ['角', 203.836144802],
    ['觜', 83.708661041],
    ['参', 84.683617688],
    ['轸', 190.721729542],
  ]);

  for (const [mansion, expected] of astropyGold) {
    const actual = boundaries.find((item) => item.mansion === mansion)?.longitude;
    assert.notEqual(actual, undefined);
    assert.ok(Math.abs(actual! - expected) < 0.01, `${mansion}宿距星黄经超出0.01°容差`);
  }
});

test('宿界前后必须落入相邻两宿，边界本身归入新宿', () => {
  const boundaries = calculateQizhengMansionBoundaries(new Date('2024-06-15T04:00:00Z'));
  for (const boundary of boundaries) {
    const exact = longitudeToQizhengMansion(boundary.longitude, boundaries);
    assert.equal(exact.xiu, boundary.mansion);
    assert.ok(Math.abs(exact.xiuDegree) < 1e-9);
  }
  const angle = boundaries.find((item) => item.mansion === '角');
  assert.ok(angle);
  assert.equal(longitudeToQizhengMansion(angle.longitude - 1e-6, boundaries).xiu, '轸');
  assert.equal(longitudeToQizhengMansion(angle.longitude - 5e-8, boundaries).xiu, '轸');
  assert.equal(longitudeToQizhengMansion(angle.longitude + 5e-8, boundaries).xiu, '角');
});

test('2200 年临界太阴宿宫与月相共用同一黄经和四正求根星历', () => {
  const boundaries = calculateQizhengMansionBoundaries(new Date('2200-06-15T12:00:00Z'));
  assert.equal(boundaries.length, 28);
  assert.ok(
    boundaries.every(
      (boundary) =>
        longitudeToQizhengMansion(boundary.longitude, boundaries).xiu === boundary.mansion,
    ),
  );

  const result = generateQizheng({
    year: 2200,
    month: 6,
    day: 15,
    hour: 18,
    minute: 27,
    timezone: 0,
    latitude: 0,
    longitude: 0,
  });
  const moon = result.stars.find((star) => star.name === '太阴');
  const sun = result.stars.find((star) => star.name === '太阳');
  assert.ok(moon && sun);
  // JPL Horizons 地心观测表在同一 TT 18:34:23 的太阴黄经为 120.0173364°。
  assert.ok(Math.abs(moon.longitude - 120.0173364) < 0.002);
  assert.equal(moon.xiu, '井');
  assert.equal(moon.signBranch, '午');
  assert.ok(
    Math.abs(result.calculationContext.moonPhase.moonLongitudeDegrees - moon.longitude) < 1e-7,
  );
  assert.ok(
    Math.abs(result.calculationContext.moonPhase.sunLongitudeDegrees - sun.longitude) < 1e-7,
  );
  assert.match(result.calculationContext.moonPhase.source, /Astronomy Engine/);
  // Swiss Moshier 同 TT 的朔时约为 2200-06-12T15:28:46Z。
  assert.ok(
    Math.abs(
      result.calculationContext.moonPhase.previousPrincipalPhase.utcTimestamp -
        Date.parse('2200-06-12T15:28:46Z'),
    ) <
      2 * 60_000,
  );
  assert.ok(result.calculationContext.moonPhase.previousPrincipalPhase.residualDegrees < 0.001);
  assert.ok(result.calculationContext.moonPhase.nextPrincipalPhase.residualDegrees < 0.001);

  const mansionSamples = [
    { minute: 13, swissLongitude: 98.09896055, xiu: '参' },
    { minute: 15, swissLongitude: 98.11607115, xiu: '井' },
  ];
  for (const sample of mansionSamples) {
    const chart = generateQizheng({
      year: 2200,
      month: 6,
      day: 13,
      hour: 23,
      minute: sample.minute,
      timezone: 0,
      latitude: 0,
      longitude: 0,
    });
    const sampleMoon = chart.stars.find((star) => star.name === '太阴');
    assert.ok(sampleMoon);
    // Swiss Moshier 在两处 Astronomy Engine TT 的太阴黄经均位于井宿真实距星界两侧。
    assert.ok(Math.abs(sampleMoon.longitude - sample.swissLongitude) < 0.002);
    assert.equal(sampleMoon.xiu, sample.xiu);
  }
});

test('当地支持年两端的七政星位、月相和光照保留相同实际UTC瞬时', () => {
  for (const input of [
    {
      year: 1900,
      month: 1,
      day: 1,
      hour: 0,
      minute: 0,
      second: 0,
      timezone: 14,
      utc: '1899-12-31T10:00:00.000Z',
      moonSwiss: 264.11900251,
      sunSwiss: 279.55844607,
    },
    {
      year: 2200,
      month: 12,
      day: 31,
      hour: 23,
      minute: 59,
      second: 59,
      timezone: -12,
      utc: '2201-01-01T11:59:59.000Z',
      moonSwiss: 224.21323371,
      sunSwiss: 280.58814828,
    },
  ]) {
    const { utc, moonSwiss, sunSwiss, ...clock } = input;
    const result = generateQizheng({ ...clock, latitude: 0, longitude: 180 });
    const context = result.calculationContext;
    assert.equal(context.utcDateTime, utc);
    assert.equal(context.moonPhase.utcDateTime, utc);
    assert.equal(context.solarIllumination.astronomicalTime.unixMilliseconds, Date.parse(utc));
    assert.equal(result.stars.length, 11);
    // Swiss Moshier 在 Astronomy Engine 相同 TT 的地心当日视黄经固定点。
    assert.ok(Math.abs(context.moonPhase.moonLongitudeDegrees - moonSwiss) < 0.002);
    assert.ok(Math.abs(context.moonPhase.sunLongitudeDegrees - sunSwiss) < 0.002);
    for (const [name, longitude] of [
      ['太阳', context.moonPhase.sunLongitudeDegrees],
      ['太阴', context.moonPhase.moonLongitudeDegrees],
    ] as const) {
      assert.ok(
        Math.abs(result.stars.find((star) => star.name === name)!.longitude - longitude) < 1e-7,
      );
    }
    assert.ok(context.moonPhase.previousPrincipalPhase.utcTimestamp < Date.parse(utc));
    assert.ok(context.moonPhase.nextPrincipalPhase.utcTimestamp > Date.parse(utc));
    assert.match(context.moonPhase.source, /Astronomy Engine/);
  }
});

test('宿界查询应接受乱序资料，并拒绝重复宿名、无效宿宽与不连续边界', () => {
  const boundaries = calculateQizhengMansionBoundaries(new Date('2024-06-15T04:00:00Z'));
  const target = boundaries[8];
  assert.equal(
    longitudeToQizhengMansion(target.longitude, [...boundaries].reverse()).xiu,
    target.mansion,
  );

  const duplicated = boundaries.map((item, index) =>
    index === 1 ? { ...item, mansion: boundaries[0].mansion } : item,
  );
  assert.throws(() => longitudeToQizhengMansion(target.longitude, duplicated), /重复或缺失宿名/);
  assert.throws(
    () =>
      longitudeToQizhengMansion(
        target.longitude,
        boundaries.map((item, index) => (index === 0 ? { ...item, widthDegrees: 0 } : item)),
      ),
    /黄经或宿宽无效/,
  );
  assert.throws(
    () =>
      longitudeToQizhengMansion(
        target.longitude,
        boundaries.map((item, index) =>
          index === 0 ? { ...item, widthDegrees: item.widthDegrees + 0.01 } : item,
        ),
      ),
    /宿界不连续/,
  );
});

test('七政四余恩难仇用与昼夜分金定性：根据生时判定昼夜并输出恩难定性', () => {
  const dayChart = generateQizheng({
    year: 1990,
    month: 6,
    day: 15,
    hour: 10,
    minute: 30,
  });
  assert.ok(dayChart.enNan);
  assert.equal(dayChart.enNan.sect, '昼生');
  assert.match(dayChart.enNan.sectSummary, /昼生以日为尊/);
  assert.ok(dayChart.prompt.includes('【七政恩难】'));

  const nightChart = generateQizheng({
    year: 1990,
    month: 6,
    day: 15,
    hour: 22,
    minute: 30,
  });
  assert.ok(nightChart.enNan);
  assert.equal(nightChart.enNan.sect, '夜生');
  assert.match(nightChart.enNan.sectSummary, /夜生以月为重/);
});
