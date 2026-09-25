import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateQizheng,
  QIZHENG_SIGN_BRANCHES,
  TWELVE_PALACES,
  type QizhengAspect,
} from '../packages/core/src/qi_zheng/index.ts';
import { buildQizhengTimeLords } from '../packages/core/src/qi_zheng/time-lords.ts';
import { evaluateQizhengEnNan } from '../packages/core/src/qi_zheng/en-nan.ts';
import { formatQizhengTimeLordPrompt } from '../packages/core/src/qi_zheng/time-lords.ts';
import { extractQizhengFacts } from '../scripts/prompt-audit/natal-facts.ts';
import { auditPromptFacts } from '../scripts/prompt-audit/facts.ts';

const branches = '子丑寅卯辰巳午未申酉戌亥';

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
  for (const [mingZhu, star] of [
    ['火', '月孛'],
    ['金', '罗睺'],
    ['火', '紫炁'],
    ['水', '计都'],
  ] as const) {
    const base = { hour: 12, mingZhu };
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
});
