import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateQizhengMansionBoundaries,
  generateQizheng,
  getQizhengDignity,
  getQizhengMingZhu,
  getQizhengSignBranch,
  longitudeToQizhengMansion,
  QIZHENG_SIGN_BRANCHES,
} from '@core/qi_zheng';

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
  const result = generateQizheng({
    year: 1990,
    month: 6,
    day: 15,
    hour: 10,
    minute: 30,
    latitude: 39.9042,
    longitude: 116.4074,
    timezone: 8,
  });

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
});

test('二十八宿边界应覆盖公开年份上限 2200 年', () => {
  const boundaries = calculateQizhengMansionBoundaries(new Date('2200-06-15T12:00:00Z'));
  assert.equal(boundaries.length, 28);
  assert.ok(
    boundaries.every(
      (boundary) =>
        longitudeToQizhengMansion(boundary.longitude, boundaries).xiu === boundary.mansion,
    ),
  );
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
