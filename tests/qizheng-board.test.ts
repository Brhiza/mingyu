import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildQizhengTwelvePalaces,
  calculateQizhengMingGong,
  calculateQizhengMansionBoundaries,
  calculateQizhengShenGong,
  generateQizheng,
  getQizhengMingZhu,
  longitudeToQizhengBranch,
  longitudeToQizhengMansion,
  QIZHENG_EARTHLY_BRANCHES,
  QIZHENG_MING_ZHU_BY_BRANCH,
  QIZHENG_SHENSHA_RULE_CATALOG,
  QIZHENG_TRADITIONAL_CHART_RULE_CATALOG,
  QIZHENG_TROPICAL_ZODIAC_BRANCHES,
  QIZHENG_TROPICAL_ZODIAC_SIGNS,
} from '@core/qi_zheng';

test('七政四余五项传统盘规则均有固定旧籍原文、入口与解释边界', () => {
  assert.deepEqual(
    QIZHENG_TRADITIONAL_CHART_RULE_CATALOG.map((rule) => rule.id),
    ['zodiac-branch-mapping', 'ming-gong', 'shen-gong', 'twelve-palaces', 'ming-zhu'],
  );
  for (const rule of QIZHENG_TRADITIONAL_CHART_RULE_CATALOG) {
    assert.equal(rule.status, '已校勘');
    assert.ok(rule.rule.length > 0);
    assert.ok(rule.sources.length > 0);
    assert.ok(
      rule.sources.every(
        (source) =>
          source.title.length > 0 &&
          source.section.length > 0 &&
          source.quote.length > 0 &&
          source.url.startsWith('https://zh.wikisource.org/wiki/'),
      ),
    );
    assert.match(rule.limitation, /不.*吉凶|不得扩张为吉凶/);
  }
});

test('七政四余黄道十二星座到十二支宫应完整穷举并锁定全部边界', () => {
  const expectedBranches = ['戌', '酉', '申', '未', '午', '巳', '辰', '卯', '寅', '丑', '子', '亥'];
  assert.deepEqual(QIZHENG_TROPICAL_ZODIAC_BRANCHES, expectedBranches);
  assert.equal(QIZHENG_TROPICAL_ZODIAC_SIGNS.length, 12);

  for (let zodiacIndex = 0; zodiacIndex < 12; zodiacIndex += 1) {
    for (const longitude of [
      zodiacIndex * 30,
      zodiacIndex * 30 + 15,
      (zodiacIndex + 1) * 30 - 1e-9,
    ]) {
      const actual = longitudeToQizhengBranch(longitude);
      assert.equal(actual.tropicalZodiacIndex, zodiacIndex, `黄经${longitude}°星座序错误`);
      assert.equal(actual.tropicalZodiac, QIZHENG_TROPICAL_ZODIAC_SIGNS[zodiacIndex]);
      assert.equal(actual.branch, expectedBranches[zodiacIndex]);
      assert.equal(actual.branchIndex, QIZHENG_EARTHLY_BRANCHES.indexOf(actual.branch));
    }
  }

  assert.deepEqual(longitudeToQizhengBranch(360), longitudeToQizhengBranch(0));
  assert.equal(longitudeToQizhengBranch(-1e-9).branch, '亥');
  assert.throws(() => longitudeToQizhengBranch(Number.NaN), /有限黄经/);
});

test('七政四余安命宫应穷举太阳十二宫乘十二生时并符合原典例', () => {
  for (let sunBranch = 0; sunBranch < 12; sunBranch += 1) {
    for (let hourBranch = 0; hourBranch < 12; hourBranch += 1) {
      assert.equal(
        calculateQizhengMingGong(sunBranch, hourBranch),
        (sunBranch + 3 - hourBranch + 12) % 12,
      );
    }
  }
  assert.equal(calculateQizhengMingGong(0, 9), 6, '太阳子宫、酉时应安命于午宫');
});

test('七政四余身宫应逐宫取太阴所在宫且不引入生时分支', () => {
  for (let moonBranch = 0; moonBranch < 12; moonBranch += 1) {
    const resultsAcrossAllHours = Array.from({ length: 12 }, () =>
      calculateQizhengShenGong(moonBranch),
    );
    assert.deepEqual(resultsAcrossAllHours, Array(12).fill(moonBranch));
  }
});

test('七政四余十二职宫应对十二命宫完整逆布并覆盖全部十二支', () => {
  for (let mingGong = 0; mingGong < 12; mingGong += 1) {
    const palaces = buildQizhengTwelvePalaces(mingGong);
    assert.equal(palaces.length, 12);
    assert.equal(new Set(palaces.map((item) => item.branchIndex)).size, 12);
    assert.deepEqual(
      palaces.map((item) => item.branchIndex),
      Array.from({ length: 12 }, (_, index) => (mingGong - index + 12) % 12),
    );
  }

  assert.deepEqual(
    buildQizhengTwelvePalaces(2)
      .slice(0, 8)
      .map((item) => `${item.palace}${item.branch}`),
    ['命宫寅', '财帛丑', '兄弟子', '田宅亥', '男女戌', '奴仆酉', '妻妾申', '疾厄未'],
  );
});

test('七政四余命主应穷举十二宫支固定映射', () => {
  const expected = ['土', '土', '木', '火', '金', '水', '日', '月', '水', '金', '火', '木'];
  assert.deepEqual(Object.values(QIZHENG_MING_ZHU_BY_BRANCH), expected);
  assert.deepEqual(
    QIZHENG_EARTHLY_BRANCHES.map((_, branchIndex) => getQizhengMingZhu(branchIndex)),
    expected,
  );
});

test('七政四余八项传统神煞目录完整覆盖十干或十二支', () => {
  const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const branches = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

  assert.equal(QIZHENG_SHENSHA_RULE_CATALOG.length, 8);
  for (const [index, rule] of QIZHENG_SHENSHA_RULE_CATALOG.entries()) {
    const expectedBasis = index < 2 ? stems : branches;
    assert.deepEqual(Object.keys(rule.targetByBasis), expectedBasis, `${rule.name}起例表缺项`);
    assert.ok(
      Object.values(rule.targetByBasis).every((target) => branches.includes(target)),
      `${rule.name}目标支存在非法值`,
    );
    assert.match(rule.sourceUrl, /第568卷/);
    assert.ok(rule.sourceQuote.length > 0);
    assert.match(rule.limitation, /不得据此直接生成吉凶/);
  }
});

test('七政四余可用盘面采用二十八宿真实距星边界并保持位置来源分层', () => {
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
  }
  assert.equal(
    result.stars.find((star) => star.name.startsWith('紫炁'))?.precisionClass,
    '传统均速模型',
  );
  assert.ok(
    result.stars
      .filter((star) => !star.name.startsWith('紫炁'))
      .every((star) => star.precisionClass === '现代天文计算'),
  );
  assert.match(result.prompt, /宿界模型.*28颗距星/);
  assert.doesNotMatch(result.prompt, /366\.5|等比例换算/);
  assert.equal(result.pairwiseAngles.length, 55);
  assert.deepEqual(
    result.stars.map((star) => [star.name, star.tropicalZodiac, star.branch, star.palace]),
    [
      ['太阳', '双子', '申', '福德'],
      ['太阴', '双鱼', '亥', '疾厄'],
      ['辰星(水)', '双子', '申', '福德'],
      ['太白(金)', '金牛', '酉', '官禄'],
      ['荧惑(火)', '白羊', '戌', '迁移'],
      ['岁星(木)', '巨蟹', '未', '相貌'],
      ['镇星(土)', '磨羯', '丑', '奴仆'],
      ['罗睺(火余)', '宝瓶', '子', '妻妾'],
      ['计都(土余)', '狮子', '午', '命宫'],
      ['月孛(水余)', '天蝎', '卯', '田宅'],
      ['紫炁(木余)', '双女', '巳', '财帛'],
    ],
  );
  assert.deepEqual(
    {
      mingGong: result.mingGongBranch,
      shenGong: result.shenGongBranch,
      mingZhu: result.mingZhu,
    },
    { mingGong: '午', shenGong: '亥', mingZhu: '日' },
  );
  assert.deepEqual(result.geometryCalculation, {
    starCount: 11,
    starOrder: result.stars.map((star) => star.name),
    expectedPairCount: 55,
    actualPairCount: 55,
    enumeration: '全部无序星对',
    angleFormula: 'min(abs(longitude1-longitude2), 360-abs(longitude1-longitude2))',
    complete: true,
  });
  assert.deepEqual(
    result.pairwiseAngles.map((pair) => [pair.star1, pair.star2]),
    result.stars.flatMap((first, firstIndex) =>
      result.stars.slice(firstIndex + 1).map((second) => [first.name, second.name]),
    ),
  );
  assert.deepEqual(result.aspects, []);
  assert.equal(result.traditionalRuleAudit.dignity.status, '未采用');
  assert.equal(result.traditionalRuleAudit.aspects.status, '未采用');
  assert.equal(result.traditionalRuleAudit.chart.status, '已校勘');
  assert.equal(result.traditionalRuleAudit.shensha.status, '已校勘起例');
  assert.equal(result.traditionalChartRuleCatalog.length, 5);
  assert.equal(result.traditionalChartFacts.length, 5);
  assert.equal(result.evidenceAnalysis.traditionalChartFacts.length, 5);
  assert.equal(result.evidenceAnalysis.summaryFact.traditionalChartFactCount, 5);
  assert.ok(
    result.traditionalChartFacts.every(
      (fact) =>
        fact.status === '已计算' &&
        fact.sources.some((source) => source.includes('zh.wikisource.org')),
    ),
  );
  assert.equal(result.traditionalYearBasis.status, '年干支口径一致');
  assert.equal(result.traditionalYearBasis.adoptedYearGanZhi, '庚午');
  assert.equal(result.shenshaRuleCatalog.length, 8);
  assert.deepEqual(
    result.shenshaFacts.map((fact) => [fact.name, fact.basis, fact.basisValue, fact.targetBranch]),
    [
      ['天乙（昼贵）', '年干', '庚', '丑'],
      ['玉堂（夜贵）', '年干', '庚', '未'],
      ['驿马', '年支', '午', '申'],
      ['华盖', '年支', '午', '戌'],
      ['劫煞', '年支', '午', '亥'],
      ['咸池', '年支', '午', '卯'],
      ['孤辰', '年支', '午', '申'],
      ['寡宿', '年支', '午', '辰'],
    ],
  );
  assert.ok(
    result.shenshaFacts.every(
      (fact) =>
        fact.status === '已校勘起例' &&
        fact.sourceQuote.length > 0 &&
        fact.sources.some((source) => source.includes('第568卷')) &&
        fact.limitation.includes('目标支不等于已经落入'),
    ),
  );
  assert.deepEqual(
    result.shensha,
    result.shenshaFacts.map((fact) => ({ name: fact.name, value: fact.targetBranch })),
  );
  assert.ok(result.stars.every((star) => !Object.hasOwn(star, 'dignity')));
  assert.ok(
    result.pairwiseAngles.every(
      (pair) =>
        !Object.hasOwn(pair, 'type') &&
        !Object.hasOwn(pair, 'orb') &&
        !Object.hasOwn(pair, 'allowedOrb') &&
        !Object.hasOwn(pair, 'orbRatio') &&
        !Object.hasOwn(pair, 'closeness') &&
        !Object.hasOwn(pair, 'strength'),
    ),
  );
  assert.equal(result.evidenceAnalysis.pairGeometryFacts.length, 55);
  assert.equal(result.evidenceAnalysis.summaryFact.pairGeometryFactCount, 55);
  const lastPair = result.pairwiseAngles.at(-1);
  assert.ok(lastPair);
  assert.ok(result.prompt.includes(`${lastPair.star1}与${lastPair.star2}实际最小夹角`));
  assert.ok(
    result.evidenceAnalysis.evidence.items.some(
      (item) => item.title === `${lastPair.star1}与${lastPair.star2}实际夹角`,
    ),
  );
  assert.match(result.prompt, /庙旺未采用[\s\S]*吊照未采用/);
  assert.match(result.prompt, /白羊戌/);
  assert.match(result.prompt, /太阳宫，顺数遇卯/);
  assert.match(result.prompt, /太阴所在十二支宫即为身宫/);
  assert.match(result.prompt, /十二职宫自午宫起逆布/);
  assert.match(result.prompt, /《五行精纪》[\s\S]*《灵台经》/);
  assert.match(result.prompt, /传统年界核验[\s\S]*传统神煞起例目标支/);
  assert.doesNotMatch(result.prompt, /黄道第\s*\d+宫|生时加太阴|逆数见酉/);
  assert.doesNotMatch(result.prompt, /天乙贵人.*日干|神煞定位/);
  assert.doesNotMatch(result.prompt, /紧密等级|中等等级|宽松等级|归一化容许度位置/);
});

test('七政四余传统神煞在春节与立春年界分歧时不自动选边', () => {
  const result = generateQizheng({
    year: 2024,
    month: 2,
    day: 5,
    hour: 10,
    minute: 30,
    latitude: 39.9042,
    longitude: 116.4074,
    timezone: 8,
  });

  assert.deepEqual(
    {
      status: result.traditionalYearBasis.status,
      lunar: result.traditionalYearBasis.lunarYearGanZhi,
      liChun: result.traditionalYearBasis.liChunYearGanZhi,
      adopted: result.traditionalYearBasis.adoptedYearGanZhi,
    },
    {
      status: '年界口径分歧',
      lunar: '癸卯',
      liChun: '甲辰',
      adopted: undefined,
    },
  );
  assert.deepEqual(result.shenshaFacts, []);
  assert.deepEqual(result.shensha, []);
  assert.equal(result.shenshaRuleCatalog.length, 8);
  assert.equal(result.evidenceAnalysis.summaryFact.status, '可用事实链有缺口');
  assert.ok(
    result.evidenceAnalysis.counterEvidenceFacts.some(
      (fact) => fact.type === '传统年界口径' && fact.status === '年界口径分歧',
    ),
  );
  assert.match(result.prompt, /农历年干支为癸卯、八字立春年柱为甲辰/);
  assert.match(result.prompt, /不自动生成个人目标支/);
});

test('七政四余传统年干支按明确当地日期计算并跟随真太阳时跨日', () => {
  const east = generateQizheng({
    year: 1990,
    month: 6,
    day: 15,
    hour: 10,
    minute: 30,
    latitude: 39.9042,
    longitude: 116.4074,
    timezone: 8,
  });
  const west = generateQizheng({
    year: 1990,
    month: 6,
    day: 15,
    hour: 10,
    minute: 30,
    latitude: 40.7128,
    longitude: -74.006,
    timezone: -5,
  });
  assert.equal(east.traditionalYearBasis.adoptedYearGanZhi, '庚午');
  assert.equal(west.traditionalYearBasis.adoptedYearGanZhi, '庚午');
  assert.deepEqual(
    east.shenshaFacts.map((fact) => [fact.id, fact.targetBranch]),
    west.shenshaFacts.map((fact) => [fact.id, fact.targetBranch]),
  );

  const crossed = generateQizheng({
    year: 1990,
    month: 1,
    day: 1,
    hour: 0,
    minute: 15,
    latitude: 30,
    longitude: 105,
    timezone: 8,
    useTrueSolarTime: true,
  });
  assert.equal(crossed.traditionalYearBasis.timeMode, '真太阳时');
  assert.match(crossed.traditionalYearBasis.traditionalDateTime, /^1989-12-31T23:/);
  assert.equal(crossed.traditionalYearBasis.adoptedYearGanZhi, '己巳');
});

test('七政四余真太阳时不得把历史夏令时偏移冒充标准经线', () => {
  const input = {
    year: 1990,
    month: 6,
    day: 15,
    hour: 10,
    minute: 30,
    latitude: 39.9042,
    longitude: 116.4074,
    timeZoneId: 'Asia/Shanghai',
    useTrueSolarTime: true,
  } as const;

  assert.throws(() => generateQizheng(input), /不能可靠推定真太阳时标准经线.*standardMeridian/);

  const result = generateQizheng({ ...input, standardMeridian: 120 });
  assert.equal(result.calculationContext.timezone, 9);
  assert.equal(result.calculationContext.standardMeridian, 120);
  assert.equal(result.calculationContext.standardMeridianSource, '用户提供');
  assert.match(result.calculationContext.palaceTimeNote ?? '', /标准经线120°，来源用户提供/);
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
  const angle = boundaries.find((item) => item.mansion === '角');
  assert.ok(angle);
  assert.equal(longitudeToQizhengMansion(angle.longitude, boundaries).xiu, '角');
  assert.equal(longitudeToQizhengMansion(angle.longitude - 1e-6, boundaries).xiu, '轸');
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
