import assert from 'node:assert/strict';
import test from 'node:test';

import { BaziAnalyzer } from '../packages/core/src/bazi/baziAnalysis';
import { formatPatternFulfillmentFacts } from '../packages/core/src/bazi/baziAnalysisFormatter';
import { HIDDEN_STEMS, SIXTY_CYCLE } from '../packages/core/src/bazi/baziDefinitions';
import {
  identifyClassicPatternCandidates,
  type ClassicPatternCandidate,
} from '../packages/core/src/bazi/baziEnhancement/classicPatterns';
import { generateEnhancedAnalysisSection } from '../packages/core/src/bazi/baziPromptEnhancement';
import { determinePattern } from '../packages/core/src/bazi/baziPatternStrategy';
import type {
  BaziChartResult,
  HiddenStems,
  Pillars,
  Wuxing,
} from '../packages/core/src/bazi/baziTypes';
import { getSeasonStatus, getTenGod, getWuxing } from '../packages/core/src/bazi/baziUtils';
import { buildEnhancedPatternUsefulGodSection } from '../packages/core/src/minglu/bazi-enhancer';

const POSITIONS = ['year', 'month', 'day', 'hour'] as const;

function makePillars(values: [string, string, string, string]): Pillars {
  values.forEach((ganZhi) => assert.ok(SIXTY_CYCLE.includes(ganZhi), `${ganZhi}须为六十甲子`));
  return Object.fromEntries(
    POSITIONS.map((position, index) => [
      position,
      { gan: values[index][0], zhi: values[index][1], ganZhi: values[index] },
    ]),
  ) as Pillars;
}

function makeHiddenStems(pillars: Pillars): HiddenStems {
  return Object.fromEntries(
    POSITIONS.map((position) => [position, [...HIDDEN_STEMS[pillars[position].zhi]]]),
  ) as HiddenStems;
}

function resolveWuxing(value: string): Wuxing {
  const wuxing = getWuxing(value);
  assert.notEqual(wuxing, '未知');
  return wuxing as Wuxing;
}

const analyzer = new BaziAnalyzer(resolveWuxing, getTenGod, getSeasonStatus);

function analyze(values: [string, string, string, string], monthCommander?: string) {
  const pillars = makePillars(values);
  const hiddenStems = makeHiddenStems(pillars);
  return {
    pillars,
    hiddenStems,
    analysis: analyzer.analyzeBaziChart(pillars, hiddenStems, monthCommander),
  };
}

function findQuzhiCandidate(
  pillars: Pillars,
  hiddenStems: HiddenStems,
  currentPattern: string,
): ClassicPatternCandidate | undefined {
  return identifyClassicPatternCandidates(
    pillars.day.gan,
    pillars.month.zhi,
    pillars,
    hiddenStems,
    currentPattern,
  ).find((candidate) => candidate.pattern.id === 'qu-zhi');
}

test('亥卯未曲直不以普通旺衰先判为极强，成员藏干与曲直取用均保留', () => {
  const result = analyze(['癸亥', '乙卯', '乙卯', '癸未'], '乙');

  assert.equal(result.analysis.dayMasterStrength.status, '身强');
  assert.equal(result.analysis.mingGe.pattern, '曲直格');
  assert.equal(result.analysis.mingGe.isSpecial, true);
  assert.match(result.analysis.mingGe.basis || '', /亥卯未曲直法条件成立/);
  assert.match(result.analysis.mingGe.basis || '', /未藏己、丁、乙/);
  assert.equal(result.analysis.mingGe.specialAdjudication?.status, '成立');
  assert.deepEqual(result.analysis.mingGe.specialAdjudication?.visibleOutputStems, []);
  assert.deepEqual(result.hiddenStems.hour, ['己', '丁', '乙']);
  assert.deepEqual(result.analysis.usefulGod.favorableWuxing, ['水', '木', '火']);
  assert.deepEqual(result.analysis.usefulGod.unfavorableWuxing, ['金']);
  assert.doesNotMatch(result.analysis.usefulGod.strategyTrace?.join('；') || '', /土.*忌/);
  assert.equal(result.analysis.usefulGod.decisionEvidence?.base.ruleId, 'quzhi-follow-wood');
});

test('曲直两条具名口径覆盖亥卯未非春月与寅卯辰辰月，不引入月令计数门槛', () => {
  const summerSanhe = analyze(['癸亥', '戊午', '乙卯', '癸未']);
  const chenMonthEastern = analyze(['甲寅', '戊辰', '乙卯', '癸亥']);

  assert.equal(summerSanhe.analysis.mingGe.pattern, '曲直格');
  assert.match(summerSanhe.analysis.mingGe.basis || '', /三命通会.*亥卯未/);
  assert.equal(chenMonthEastern.analysis.mingGe.pattern, '曲直格');
  assert.match(chenMonthEastern.analysis.mingGe.basis || '', /渊海子平.*春生寅卯辰/);
});

test('火泄秀与土财只记录明透事实而不粗算破格，寅卯辰仍覆盖普通月令格', () => {
  const fireOutput = analyze(['癸亥', '乙卯', '乙卯', '丁未'], '乙');
  const earthWealth = analyze(['甲寅', '乙卯', '甲子', '戊辰'], '乙');

  assert.equal(fireOutput.analysis.mingGe.pattern, '曲直格');
  assert.match(fireOutput.analysis.mingGe.basis || '', /火.*泄秀事实另论/);
  assert.deepEqual(fireOutput.analysis.mingGe.specialAdjudication?.visibleOutputStems, ['丁']);
  assert.equal(earthWealth.analysis.mingGe.pattern, '曲直格');
  assert.match(earthWealth.analysis.mingGe.basis || '', /土.*财星事实另论/);
  assert.deepEqual(earthWealth.analysis.mingGe.specialAdjudication?.visibleWealthStems, ['戊']);
  const formattedFacts = [
    ...formatPatternFulfillmentFacts(fireOutput.analysis.mingGe),
    ...formatPatternFulfillmentFacts(earthWealth.analysis.mingGe),
  ].join('；');
  assert.match(formattedFacts, /食伤明透：丁/);
  assert.match(formattedFacts, /财星明透：戊/);
  assert.doesNotMatch(formattedFacts, /共享事实|另按.*核验|承载.*核验/);
});

test('庚辛明透、支藏与局外冲均阻断曲直，并回落普通格而保留反证', () => {
  const visibleMetal = analyze(['辛亥', '乙卯', '乙卯', '癸未'], '乙');
  const hiddenMetal = analyze(['甲戌', '乙卯', '乙亥', '癸未'], '乙');
  const externalClash = analyze(['己酉', '乙卯', '乙亥', '癸未'], '乙');

  assert.notEqual(visibleMetal.analysis.mingGe.pattern, '曲直格');
  assert.equal(visibleMetal.analysis.mingGe.isSpecial, false);
  assert.match(visibleMetal.analysis.mingGe.basis || '', /曲直结构未立：庚辛透干/);
  assert.equal(visibleMetal.analysis.mingGe.specialAdjudication?.status, '不成立');
  assert.notEqual(hiddenMetal.analysis.mingGe.pattern, '曲直格');
  assert.match(hiddenMetal.analysis.mingGe.basis || '', /戌藏辛/);
  assert.notEqual(externalClash.analysis.mingGe.pattern, '曲直格');
  assert.match(externalClash.analysis.mingGe.basis || '', /局外支冲：年柱酉冲卯/);

  const candidate = findQuzhiCandidate(
    externalClash.pillars,
    externalClash.hiddenStems,
    externalClash.analysis.mingGe.pattern,
  );
  assert.equal(candidate?.status, '存在反证');
  assert.match(candidate?.counterEvidence.join('；') || '', /庚辛藏支.*局外支冲/);

  const forcedExtreme = determinePattern(visibleMetal.pillars, '极强', getTenGod, '乙');
  assert.equal(forcedExtreme.isSpecial, false);
  assert.notEqual(forcedExtreme.pattern, '专旺格');
  assert.equal(forcedExtreme.specialAdjudication?.status, '不成立');
  assert.match(forcedExtreme.basis || '', /曲直结构未立：庚辛透干/);
});

test('经典目录、提示词与命录读取正式曲直主格和同一取用结果', () => {
  const result = analyze(['癸亥', '乙卯', '乙卯', '癸未'], '乙');
  const candidate = findQuzhiCandidate(
    result.pillars,
    result.hiddenStems,
    result.analysis.mingGe.pattern,
  );
  assert.equal(candidate?.status, '结构命中');
  assert.match(candidate?.pattern.source?.title || '', /三命通会.*卷六/);
  assert.match(candidate?.pattern.description || '', /神峰通考.*严格口径/);
  assert.match(candidate?.matchedConditions.join('；') || '', /亥卯未三支齐全/);

  const chart = {
    pillars: result.pillars,
    hiddenStems: result.hiddenStems,
    analysis: result.analysis,
    dayMaster: { gan: '乙', wuxing: '木' },
    shensha: { global: [], year: [], month: [], day: [], hour: [] },
  } as unknown as BaziChartResult;
  const prompt = generateEnhancedAnalysisSection(chart);
  const minglu = buildEnhancedPatternUsefulGodSection(chart);

  assert.match(prompt, /【经典格局】曲直格；《三命通会》卷六亥卯未曲直法条件成立/);
  assert.doesNotMatch(prompt, /曲直格（结构命中/);
  assert.equal(minglu.pattern.name, '曲直格');
  assert.equal(minglu.pattern.basis, result.analysis.mingGe.basis);
  assert.deepEqual(minglu.pattern.specialAdjudication, result.analysis.mingGe.specialAdjudication);
  assert.equal(minglu.usefulGods.usefulGodCategory, '曲直顺势泄秀');
  assert.match(minglu.usefulGods.reasoning, /水 -> 木 -> 火/);
});
