import assert from 'node:assert/strict';
import test from 'node:test';
import { baziCalculator } from '../packages/core/src/bazi/baziCalculator';
import {
  identifyClassicPattern,
  identifyClassicPatternCandidates,
} from '../packages/core/src/bazi/baziEnhancement/classicPatterns';
import { HIDDEN_STEMS } from '../packages/core/src/bazi/baziMappingsData';
import { generateEnhancedAnalysisSection } from '../packages/core/src/bazi/baziPromptEnhancement';

type Pillars = Parameters<typeof identifyClassicPattern>[2];
type HiddenStems = Parameters<typeof identifyClassicPattern>[3];

function makePillars(values: [string, string, string, string]): Pillars {
  return Object.fromEntries(
    ['year', 'month', 'day', 'hour'].map((key, index) => [
      key,
      { gan: values[index][0], zhi: values[index][1], ganZhi: values[index] },
    ]),
  ) as Pillars;
}

function getCandidates(values: [string, string, string, string]) {
  const pillars = makePillars(values);
  const hidden = Object.fromEntries(
    (['year', 'month', 'day', 'hour'] as const).map((key) => [key, HIDDEN_STEMS[pillars[key].zhi]]),
  ) as HiddenStems;
  return identifyClassicPatternCandidates(
    pillars.day.gan,
    pillars.month.zhi,
    pillars,
    hidden,
    '普通格局',
  );
}

test('旧经典格局入口仍返回目录顺序首项，全量入口保留并列候选', () => {
  const pillars = makePillars(['戊子', '庚申', '庚申', '庚辰']);
  const hidden = Object.fromEntries(
    (['year', 'month', 'day', 'hour'] as const).map((key) => [key, HIDDEN_STEMS[pillars[key].zhi]]),
  ) as HiddenStems;
  const first = identifyClassicPattern(
    pillars.day.gan,
    pillars.month.zhi,
    pillars,
    hidden,
    '普通格局',
  );
  const all = identifyClassicPatternCandidates(
    pillars.day.gan,
    pillars.month.zhi,
    pillars,
    hidden,
    '普通格局',
  );

  assert.equal(first?.id, 'lu-ren-lu');
  assert.deepEqual(
    all.map((candidate) => candidate.pattern.id),
    ['lu-ren-lu', 'jing-lan-cha'],
  );
  assert.ok(all.every((candidate) => candidate.matchedConditions.length > 0));
});

test('化气候选记录根气、冲破与甲己见乙妒合反证', () => {
  const rooted = getCandidates(['戊辰', '己未', '甲子', '丙寅']).find(
    (candidate) => candidate.pattern.id === 'hua-qi-tu',
  );
  assert.equal(rooted?.status, '存在反证');
  assert.match(rooted?.verificationFacts.join('；') ?? '', /天干五合核验：合而不化/);
  assert.match(rooted?.counterEvidence.join('；') ?? '', /阻化|制化反证/);

  const jealousy = getCandidates(['乙巳', '己丑', '甲子', '丙寅']).find(
    (candidate) => candidate.pattern.id === 'hua-qi-tu',
  );
  assert.equal(jealousy?.status, '存在反证');
  assert.match(jealousy?.counterEvidence.join('；') ?? '', /乙透干.*妒合/);

  const clash = getCandidates(['庚申', '己丑', '甲子', '丁卯']).find(
    (candidate) => candidate.pattern.id === 'hua-qi-tu',
  );
  assert.equal(clash?.status, '存在反证');
  assert.match(clash?.counterEvidence.join('；') ?? '', /冲破/);
});

test('金神、倒冲和井栏候选记录各自的成败缺口', () => {
  const jinShen = getCandidates(['壬子', '癸丑', '甲子', '乙丑']).find(
    (candidate) => candidate.pattern.id === 'jin-shen-jia',
  );
  assert.equal(jinShen?.status, '存在反证');
  assert.match(jinShen?.verificationFacts.join('；') ?? '', /火制事实：未透丙丁/);
  assert.match(jinShen?.counterEvidence.join('；') ?? '', /见水干或水根/);

  const daoChong = getCandidates(['壬子', '甲辰', '丙午', '甲午']).find(
    (candidate) => candidate.pattern.id === 'dao-chong-bing',
  );
  assert.equal(daoChong?.status, '存在反证');
  assert.match(daoChong?.counterEvidence.join('；') ?? '', /壬癸亥子填实/);

  const jingLan = getCandidates(['甲子', '戊辰', '庚辰', '甲申']).find(
    (candidate) => candidate.pattern.id === 'jing-lan-cha',
  );
  assert.equal(jingLan?.status, '待核验');
  assert.match(jingLan?.verificationFacts.join('；') ?? '', /未形成得月令且无局外支冲破/);
  assert.match(jingLan?.pendingConditions.join('；') ?? '', /庚金乘旺/);
});

test('专旺候选把势旺盛保留为结构条件，不冒充主链旺衰结论', () => {
  const runXia = getCandidates(['戊子', '庚申', '壬辰', '庚子']).find(
    (candidate) => candidate.pattern.id === 'run-xia',
  );
  const matched = runXia?.matchedConditions.join('；') ?? '';

  assert.match(matched, /结构出现条件“水势旺盛”\（旺衰仍需结合整盘核对\）/);
  assert.doesNotMatch(matched, /结构命中：水势旺盛/);
});

test('增强提示词显示结构候选与反证，不把静态等级当本盘等级', () => {
  const pillars = makePillars(['戊辰', '己未', '甲子', '丙寅']);
  const hidden = Object.fromEntries(
    (['year', 'month', 'day', 'hour'] as const).map((key) => [key, HIDDEN_STEMS[pillars[key].zhi]]),
  );
  const section = generateEnhancedAnalysisSection({
    pillars,
    hiddenStems: hidden,
    analysis: { mingGe: { pattern: '普通格局', isSpecial: false } },
  } as any);

  assert.match(section, /【经典结构候选】甲己化土格（存在反证；传统等级参考：极品/);
  assert.match(section, /天干五合核验：合而不化/);
  assert.match(section, /反证：/);
  assert.doesNotMatch(section, /【经典格局】甲己化土格（极品）/);
});

test('经典候选提示词只使用中文柱位和盘面条件文本', () => {
  for (const values of [
    ['壬子', '甲辰', '丙午', '甲午'],
    ['甲子', '戊辰', '庚辰', '甲申'],
  ] as const) {
    const pillars = makePillars(values);
    const hidden = Object.fromEntries(
      (['year', 'month', 'day', 'hour'] as const).map((key) => [
        key,
        HIDDEN_STEMS[pillars[key].zhi],
      ]),
    );
    const section = generateEnhancedAnalysisSection({
      pillars,
      hiddenStems: hidden,
      analysis: { mingGe: { pattern: '普通格局', isSpecial: false } },
    } as any);

    assert.doesNotMatch(section, /year支|month支|day支|hour支|项目/);
  }
});

test('未知时辰增强入口直接返回待补时，不读取空时柱', () => {
  const result = baziCalculator.calculateBazi({ year: 2000, month: 1, day: 7, gender: 'male' });
  const section = generateEnhancedAnalysisSection(result);

  assert.equal(section, '【待补时】出生时辰未知，经典结构候选与相合成化需补齐出生时分后核验。');
  assert.doesNotMatch(section, /undefined|NaN|经典格局/);
});
