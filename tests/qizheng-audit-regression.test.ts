import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateQizheng,
  QIZHENG_SIGN_BRANCHES,
  TWELVE_PALACES,
  type QizhengAspect,
} from '../packages/core/src/qi_zheng/index.ts';
import { buildQizhengTimeLords } from '../packages/core/src/qi_zheng/time-lords.ts';
import { evaluateQizhengEnNan, STAR_WUXING } from '../packages/core/src/qi_zheng/en-nan.ts';
import { QIZHENG_ASPECTS } from '../packages/core/src/qi_zheng/aspect-rules.ts';
import { buildMetaphysicsPrompt } from '../src/lib/metaphysics-prompt.ts';
import { formatQizhengTimeLordPrompt } from '../packages/core/src/qi_zheng/time-lords.ts';
import { extractQizhengFacts } from '../scripts/prompt-audit/natal-facts.ts';
import { auditPromptFacts } from '../scripts/prompt-audit/facts.ts';

const branches = '子丑寅卯辰巳午未申酉戌亥';

test('真实七政相位审查绑定本命与流曜两端及本条数值，其他吊照不能补足', () => {
  const chart = generateQizheng({
    year: 2024,
    month: 6,
    day: 20,
    hour: 12,
    timezone: 8,
    flowYear: 2024,
    flowMonth: 6,
    flowDay: 20,
    flowHour: 12,
  });
  const flowing = chart.flowingStars;
  assert.ok(flowing);
  const facts = extractQizhengFacts(chart);
  const natalFacts = facts.filter((item) => item.id.includes('.natal.aspect.'));
  const flowFacts = facts.filter((item) => item.id.includes('.flow.transit.'));
  const publishedAspects = chart.aspects.filter(
    (item) =>
      !(
        (item.star1 === '罗睺(火余)' && item.star2 === '计都(土余)') ||
        (item.star1 === '计都(土余)' && item.star2 === '罗睺(火余)')
      ),
  );
  assert.equal(natalFacts.length, publishedAspects.length);
  assert.equal(flowFacts.length, flowing.transits.length);
  assert.equal(
    facts.length,
    chart.stars.length +
      publishedAspects.length +
      1 +
      flowing.stars.length +
      flowing.transits.length +
      (flowing.periodEvents?.events.length ?? 0),
  );
  assert.deepEqual(auditPromptFacts(chart.prompt, facts).missing, []);

  const natalLine = chart.prompt.split('\n').find((line) => line.startsWith('七政四余吊照：'));
  const flowLine = chart.prompt.split('\n').find((line) => line.startsWith('流曜与本命吊照：'));
  assert.ok(natalLine && flowLine);
  const withoutNatal = chart.prompt.replace(natalLine, '');
  assert.ok(withoutNatal.includes(flowLine));
  const removedNatal = auditPromptFacts(withoutNatal, facts);
  assert.deepEqual(
    removedNatal.missing.filter((id) => id.includes('.natal.aspect.')),
    natalFacts.map((item) => item.id),
  );
  assert.ok(flowFacts.every((item) => !removedNatal.missing.includes(item.id)));
  const removedFlow = auditPromptFacts(chart.prompt.replace(flowLine, ''), facts);
  assert.deepEqual(
    removedFlow.missing.filter((id) => id.includes('.flow.transit.')),
    flowFacts.map((item) => item.id),
  );

  const sunIndex = flowing.transits.findIndex(
    (item) => item.star1 === '流曜太阳' && item.star2 === '本命太阳',
  );
  assert.ok(sunIndex >= 0);
  assert.equal(flowing.transits[sunIndex].actualAngle, 0);
  const sun = '流曜太阳与本命太阳：合相；目标角0°，实际角距0.00°，偏差0.00°，容许偏差上限8°，紧密';
  assert.ok(flowLine.includes(sun));
  for (const corrupted of [
    '',
    sun.replace('流曜太阳与本命太阳', '本命太阳与流曜太阳'),
    sun.replace('与本命太阳', '与本命太阴'),
    sun.replace('：合相', '：六合'),
    sun.replace('目标角0°', '目标角60°'),
    sun.replace('实际角距0.00°', '实际角距0.01°'),
    sun.replace('偏差0.00°', '偏差0.01°'),
    sun.replace('容许偏差上限8°', '容许偏差上限9°'),
    sun.replace('紧密', '宽松'),
  ]) {
    const changed = chart.prompt.replace(sun, corrupted);
    assert.ok(
      auditPromptFacts(changed, facts).missing.includes(`qizheng.flow.transit.${sunIndex}`),
      corrupted || '删除本条相位',
    );
  }
});

test('同一瞬时异地地心曜度与宿界一致，位置计算证据不列出生坐标', () => {
  const input = { year: 2026, month: 5, day: 19, hour: 10, minute: 30, timezone: 8 };
  const beijing = generateQizheng({ ...input, latitude: 39.9, longitude: 116.4 });
  const greenwich = generateQizheng({ ...input, latitude: 0, longitude: 0 });
  assert.deepEqual(
    beijing.stars.map((star) => [star.name, star.longitude, star.xiu, star.xiuDegree]),
    greenwich.stars.map((star) => [star.name, star.longitude, star.xiu, star.xiuDegree]),
  );
  assert.deepEqual(beijing.mansionBoundaries, greenwich.mansionBoundaries);
  assert.notEqual(beijing.enNan?.sect, greenwich.enNan?.sect);
  const positionStep = beijing.evidenceAnalysis.calculationFact.steps.find(
    (step) => step.key === 'qizheng:calculation:modern-positions',
  );
  assert.deepEqual(positionStep?.inputs, { utcDateTime: beijing.calculationContext.utcDateTime });
  assert.match(beijing.calculationContext.coordinatePipeline.join('；'), /出生坐标用于光照/);
});

test('同一瞬时点采用不同民用时区时，七政立春年干和年支神煞保持一致', () => {
  const common = {
    year: 2025,
    month: 2,
    day: 3,
    latitude: 40.7,
    longitude: -74,
    gender: 'male' as const,
    flowYear: 2026,
    flowMonth: 6,
    flowDay: 1,
  };
  const west = generateQizheng({ ...common, hour: 10, timezone: -5 });
  const east = generateQizheng({ ...common, hour: 23, timezone: 8 });
  assert.equal(west.timeLords?.yearStem, '乙');
  assert.equal(east.timeLords?.yearStem, '乙');
  assert.deepEqual(
    west.shensha.filter((x) => x.name !== '天乙贵人'),
    east.shensha.filter((x) => x.name !== '天乙贵人'),
  );
});

test('七政完整提示词逐类写明四余位置口径', () => {
  const chart = generateQizheng({ year: 2024, month: 6, day: 20, hour: 12, timezone: 8 });
  assert.match(chart.prompt, /罗睺、计都取月球真交点/);
  assert.match(chart.prompt, /月孛取月球平均远地点模型/);
  assert.match(chart.prompt, /紫炁按古法均速/);
  assert.doesNotMatch(chart.prompt, /月孛按星历位置/);
});

test('七政证据标题将零度吊照写成合相，避免暗示实际同宫', () => {
  const chart = generateQizheng({ year: 2024, month: 6, day: 20, hour: 12, timezone: 8 });
  const conjunctions = chart.aspects.filter((aspect) => aspect.type === '同宫');
  assert.ok(conjunctions.length > 0);
  for (const aspect of conjunctions) {
    const item = chart.evidenceAnalysis.evidence.items.find(
      (candidate) => candidate.title === `${aspect.star1}与${aspect.star2}合相`,
    );
    assert.ok(item, `${aspect.star1}与${aspect.star2}证据标题应明确为合相`);
  }
});

test('宫支按太阳宫顺数见卯安命，十二宫地支逆布', () => {
  // 《张果星宗》例：太阳子宫，酉时生，午宫安命。
  const chart = generateQizheng({ year: 2025, month: 2, day: 3, hour: 18, timezone: 8 });
  assert.equal(chart.stars.find((x) => x.name === '太阳')?.signBranch, '子');
  assert.equal(QIZHENG_SIGN_BRANCHES[chart.mingGong], '午');
  assert.equal(chart.twelvePalaces[1].signBranch, '巳');
  assert.equal(chart.twelvePalaces[11].signBranch, '未');
  const moonBranch = branches.indexOf(chart.stars.find((x) => x.name === '太阴')!.signBranch);
  assert.equal(QIZHENG_SIGN_BRANCHES[chart.shenGong], branches[(moonBranch + 9 - 9 + 12) % 12]);
  // 午时不与酉抵消，验证身宫逆数见酉的方向。
  const noon = generateQizheng({ year: 2025, month: 2, day: 3, hour: 12, timezone: 8 });
  const noonMoon = branches.indexOf(noon.stars.find((x) => x.name === '太阴')!.signBranch);
  assert.equal(QIZHENG_SIGN_BRANCHES[noon.shenGong], branches[(noonMoon + 6 - 9 + 12) % 12]);
});

test('七政提示词事实核验覆盖未核定大限状态', () => {
  for (const flowYear of [2030, 2200]) {
    const chart = generateQizheng({
      year: 2000,
      month: 6,
      day: 15,
      hour: 12,
      timezone: 8,
      gender: 'male',
      flowYear,
    });
    assert.ok(chart.timeLords);
    assert.equal(chart.timeLords.majorLimitStatus, '命度与交限待核定');
    assert.equal(chart.timeLords.childLimitEndNominalAge, null);
    assert.equal(chart.timeLords.currentMajorLimit, null);
    assert.equal(chart.timeLords.majorLimits.length, 0);
    assert.doesNotMatch(chart.prompt, /宫内命度\d|虚岁\d+至未满\d+.*大限/);
    const facts = extractQizhengFacts(chart).filter((item) => item.id.includes('.limits.'));
    assert.ok(facts.length > 0);
    const audit = auditPromptFacts(formatQizhengTimeLordPrompt(chart.timeLords).join('\n'), facts);
    assert.deepEqual(audit.missing, []);
  }
});

test('洞微年分只列原典各宫年数，不用回归宫度推定童限与当前大限', () => {
  const twelvePalaces = TWELVE_PALACES.map((palace, index) => ({
    palace,
    signIndex: index,
    signBranch: QIZHENG_SIGN_BRANCHES[index],
  }));
  const params = {
    gender: 'male' as const,
    yearStem: '甲',
    yearStemYinYang: '阳' as const,
    birthYear: 2000,
    flowYear: 2030,
    birthYearBranch: '辰',
    flowYearBranch: '戌',
    twelvePalaces,
  };
  const result = buildQizhengTimeLords(params);
  assert.equal(result.childLimitEndNominalAge, null);
  assert.equal(result.mingDegree, null);
  assert.equal(result.majorLimitStatus, '命度与交限待核定');
  assert.deepEqual(
    result.majorPalaceYears.map((x) => x.palace),
    [
      '命宫',
      '相貌',
      '福德',
      '官禄',
      '迁移',
      '疾厄',
      '妻妾',
      '奴仆',
      '男女',
      '田宅',
      '兄弟',
      '财帛',
    ],
  );
  assert.deepEqual(
    result.majorPalaceYears.map((x) => x.years),
    [null, 10, 11, 15, 8, 7, 11, 4.5, 4.5, 4.5, 5, 5],
  );
  assert.deepEqual(result.majorLimits, []);
  assert.equal(result.currentMajorLimit, null);
  assert.equal(buildQizhengTimeLords({ ...params, flowYear: 2014 }).currentMajorLimit, null);
  assert.equal(buildQizhengTimeLords({ ...params, flowYear: 2200 }).currentMajorLimit, null);
  assert.deepEqual(
    buildQizhengTimeLords({ ...params, gender: 'female' }).majorPalaceYears,
    result.majorPalaceYears,
  );
  assert.equal(result.currentMinorLimit.palace, '妻妾');
});

test('张果星宗小限盘例：甲子生、壬辰太岁、寅宫坐命，小限落戌', () => {
  const mingSignIndex = QIZHENG_SIGN_BRANCHES.indexOf('寅');
  const twelvePalaces = TWELVE_PALACES.map((palace, step) => {
    const signIndex = (mingSignIndex + step) % 12;
    return { palace, signIndex, signBranch: QIZHENG_SIGN_BRANCHES[signIndex] };
  });
  const result = buildQizhengTimeLords({
    gender: 'male',
    yearStem: '甲',
    yearStemYinYang: '阳',
    birthYear: 1984,
    flowYear: 2012,
    birthYearBranch: '子',
    flowYearBranch: '辰',
    twelvePalaces,
  });
  assert.equal(result.currentMinorLimit.signBranch, '戌');
  assert.equal(result.currentMinorLimit.palace, '男女');
  assert.equal(result.currentMajorLimit, null);
});

test('恩难相位中的四余加括注不改变星曜身份', () => {
  const daylight = {
    birthUtcTimestamp: Date.parse('2024-06-21T12:00:00Z'),
    sunriseSunset: {
      status: '全天高于阈值' as const,
      crossings: [],
    },
  };
  for (const [mingZhu, star] of [
    ['火', '月孛'],
    ['金', '罗睺'],
    ['火', '紫炁'],
    ['水', '计都'],
  ] as const) {
    const base = {
      ...daylight,
      mingZhu,
      stars: [
        { name: mingZhu, longitude: 0 },
        { name: star, longitude: 90 },
      ],
    };
    const aspect: QizhengAspect = {
      star1: mingZhu,
      star2: star,
      type: '四正',
      exactAngle: 90,
      actualAngle: 90,
      orb: 0,
      allowedOrb: 6,
      orbRatio: 0,
      closeness: '紧密',
      precisionClass: '混合模型',
      source: '固定几何反例',
    };
    const plain = evaluateQizhengEnNan({ ...base, aspects: [aspect] });
    const annotated = evaluateQizhengEnNan({
      ...base,
      aspects: [{ ...aspect, star2: `${star}(余)` }],
    });
    assert.equal(plain.aspectInteraction.length, 1);
    assert.deepEqual(
      annotated.aspectInteraction.map((x) => x.replace('(余)', '')),
      plain.aspectInteraction,
    );
  }
  for (const mingZhu of ['未知星', 'constructor', 'toString', '__proto__', 'constructor(木)']) {
    assert.throws(
      () => evaluateQizhengEnNan({ ...daylight, mingZhu, stars: [], aspects: [] }),
      /命主名称无法识别/,
    );
  }
});

test('恩难相位以合相描述零度吊照，不把跨宫关系写成同宫', () => {
  const result = evaluateQizhengEnNan({
    birthUtcTimestamp: Date.parse('2024-06-21T12:00:00Z'),
    sunriseSunset: {
      status: '全天高于阈值',
      crossings: [],
    },
    mingZhu: '火',
    stars: [
      { name: '荧惑(火)', longitude: 0 },
      { name: '月孛(水余)', longitude: 2 },
    ],
    aspects: [
      {
        star1: '荧惑(火)',
        star2: '月孛(水余)',
        type: '同宫',
        exactAngle: 0,
        actualAngle: 2,
        orb: 2,
        allowedOrb: 8,
        orbRatio: 0.25,
        closeness: '紧密',
        precisionClass: '同层现代天文',
        source: '固定几何样本',
      },
    ],
  });
  assert.ok(result.aspectInteraction.some((item) => item.includes('合相吊照')));
  assert.ok(result.aspectInteraction.every((item) => !item.includes('同宫吊照')));
});

test('实际七政盘三项恩难交会在完整任务书中保留全部角色', () => {
  const input = {
    year: 2020,
    month: 8,
    day: 15,
    hour: 12,
    timezone: 8,
    latitude: 39.9,
    longitude: 116.4,
  };
  const chart = generateQizheng(input);
  assert.equal(chart.mingZhu, '火');
  assert.deepEqual(chart.enNan?.aspectInteraction, [
    '难星月孛(水余)与命主形成合相吊照',
    '难星辰星(水)与命主形成三方吊照',
    '恩星岁星(木)与命主形成四正吊照',
  ]);
  const jupiterAspect = chart.aspects.find(
    (item) => item.star1 === '荧惑(火)' && item.star2 === '岁星(木)',
  );
  assert.equal(jupiterAspect?.type, '四正');
  assert.ok(jupiterAspect && Math.abs(jupiterAspect.actualAngle - 90) <= jupiterAspect.allowedOrb);
  for (const role of ['命主难星：月孛(水余)', '命主难星：辰星(水)', '命主恩星：岁星(木)']) {
    assert.ok(chart.enNan?.summary.includes(role));
    assert.ok(chart.prompt.includes(role));
    assert.equal(chart.prompt.split(role).length - 1, 1);
  }
  assert.equal(chart.enNan?.mingElement, '火');
  assert.equal(chart.aspects.length, 18);
  assert.equal(STAR_WUXING.火星, '火');
  const fourRight = QIZHENG_ASPECTS.find((aspect) => aspect.type === '四正')!;
  assert.equal(fourRight.angle, 90);
  const question = '请解读本次盘面。';
  const options = { method: 'qizheng' as const, currentTime: new Date('2026-01-01T00:00:00Z') };
  const fullTask = buildMetaphysicsPrompt(chart.prompt, question, options);
  const original = { element: STAR_WUXING.火星, angle: fourRight.angle };
  try {
    STAR_WUXING.火星 = '水';
    assert.equal(STAR_WUXING.火星, '水');
    assert.equal(Reflect.set(fourRight, 'angle', 180), true);
    assert.equal(fourRight.angle, 180);
    const changed = generateQizheng(input);
    assert.deepEqual(changed, chart);
    assert.equal(buildMetaphysicsPrompt(changed.prompt, question, options), fullTask);
  } finally {
    STAR_WUXING.火星 = original.element;
    Reflect.set(fourRight, 'angle', original.angle);
  }
  assert.equal(STAR_WUXING.火星, '火');
  assert.equal(fourRight.angle, 90);
  const fresh = generateQizheng(input);
  assert.deepEqual(fresh, chart);
  assert.equal(buildMetaphysicsPrompt(fresh.prompt, question, options), fullTask);
  const restored = JSON.parse(JSON.stringify(chart)) as typeof chart;
  assert.equal(JSON.stringify(restored), JSON.stringify(chart));
  assert.equal(buildMetaphysicsPrompt(restored.prompt, question, options), fullTask);
});

test('恩难只采用本命当前黄经支持的吊照，不沿用旧角距或缺位星曜', () => {
  const base = {
    birthUtcTimestamp: Date.parse('2024-06-21T12:00:00Z'),
    sunriseSunset: {
      status: '全天高于阈值' as const,
      crossings: [],
    },
    mingZhu: '火',
    aspects: [
      {
        star1: '荧惑(火)',
        star2: '月孛(水余)',
        type: '四正' as const,
        exactAngle: 90,
        actualAngle: 90,
        orb: 0,
        allowedOrb: 6,
        orbRatio: 0,
        closeness: '紧密' as const,
        precisionClass: '混合模型' as const,
        source: '旧盘相位',
      },
    ],
  };
  const current = evaluateQizhengEnNan({
    ...base,
    stars: [
      { name: '荧惑(火)', longitude: 5 },
      { name: '月孛(水余)', longitude: 95 },
    ],
  });
  assert.equal(current.aspectInteraction.length, 1);

  for (const stars of [
    [
      { name: '荧惑(火)', longitude: 5 },
      { name: '月孛(水余)', longitude: 150 },
    ],
    [{ name: '荧惑(火)', longitude: 5 }],
  ]) {
    const stale = evaluateQizhengEnNan({ ...base, stars });
    assert.deepEqual(stale.aspectInteraction, []);
    assert.doesNotMatch(stale.summary, /命主难星：月孛/u);
  }
  const wrongType = evaluateQizhengEnNan({
    ...base,
    stars: [
      { name: '荧惑(火)', longitude: 5 },
      { name: '月孛(水余)', longitude: 95 },
    ],
    aspects: [{ ...base.aspects[0], type: '三方' }],
  });
  assert.deepEqual(wrongType.aspectInteraction, []);
});
