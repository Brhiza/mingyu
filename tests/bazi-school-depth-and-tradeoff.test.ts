import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { buildPillarFacts } from '../src/systems/bazi/pillars';
import { buildNatalFacts } from '../src/systems/bazi/natal-facts';
import { buildDayMasterStrength } from '../src/systems/bazi/strength';
import { buildOrdinaryPattern, summarizePattern } from '../src/systems/bazi/pattern';
import { buildTransformation } from '../src/systems/bazi/transformation';
import { buildQuzhi } from '../src/systems/bazi/quzhi';
import { buildCongEr } from '../src/systems/bazi/conger';
import { buildExtremePattern } from '../src/systems/bazi/extreme';
import { buildUsefulBaseline } from '../src/systems/bazi/useful-baseline';
import { buildClimateCandidates, ensureClimateRulesLoaded } from '../src/systems/bazi/climate';

await ensureClimateRulesLoaded();
import { resolveClimate } from '../src/systems/bazi/climate-decision';
import { buildPatternEvidence } from '../src/systems/bazi/pattern-evidence';
import { determineUsefulGod, formatUsefulGod } from '../src/systems/bazi/useful-god';
import { evaluateBaziSchoolAlgorithms } from '../src/systems/bazi/school-algorithms';

function buildTestChart(
  names: { year: string; month: string; day: string; hour: string },
  commanderStem: string,
  overrides?: {
    strengthStatus?: string;
    patternOverview?: ReturnType<typeof summarizePattern>;
    currentJieqi?: string;
  },
) {
  const pillars = buildPillarFacts(names);
  const natalFacts = buildNatalFacts(pillars, commanderStem);
  const strength = {
    ...buildDayMasterStrength(pillars, commanderStem),
    ...(overrides?.strengthStatus ? { status: overrides.strengthStatus } : {}),
  };
  const ordinaryPattern = buildOrdinaryPattern(pillars, commanderStem);
  const transformation = buildTransformation(pillars, strength);
  const quzhi = buildQuzhi(pillars);
  const conger = buildCongEr(pillars, strength, commanderStem);
  const extreme = buildExtremePattern(pillars, strength, commanderStem, quzhi, conger);
  const patternOverview = overrides?.patternOverview ?? summarizePattern(ordinaryPattern, transformation, quzhi, conger, extreme);
  const patternEvidence = buildPatternEvidence(pillars, patternOverview, commanderStem, strength.status);
  const usefulBaseline = buildUsefulBaseline(pillars, strength, patternOverview, transformation);
  const climate = buildClimateCandidates(pillars, strength, patternOverview, overrides?.currentJieqi);
  const climateDecision = resolveClimate(climate.candidates, usefulBaseline);
  const usefulGod = determineUsefulGod({
    pillars,
    strength,
    patternOverview,
    patternEvidence,
    transformation,
    climate,
    climateDecision,
    monthCommander: { stem: commanderStem },
  });
  return {
    pillars,
    monthCommander: { branch: pillars.month.zhi, stem: commanderStem },
    natalFacts,
    strength,
    ordinaryPattern,
    patternOverview,
    patternEvidence,
    climate,
    usefulGod,
  };
}

test('盲派深度推演：识别冲开墓库得财官、制用/合用/化用与主位得用断语', () => {
  // 甲日主，月支辰（财库）、日支戌（财库），辰戌冲开主宾财库；年干丙食神、月干戊偏财构成食伤生财化用
  const chart = buildTestChart({ year: '丙寅', month: '戊辰', day: '甲戌', hour: '丁卯' }, '戊');
  const [mangpai] = evaluateBaziSchoolAlgorithms(chart, ['mangpai']);
  const joined = mangpai.findings.join('\n');

  assert.equal(mangpai.school, 'mangpai');
  assert.match(joined, /做功方式与墓库/);
  assert.match(joined, /开库.*财库.*开库得财官/);
  assert.match(joined, /化用.*食伤生财/);
  assert.match(joined, /盲派断语要点：做功效率「(高|中)」；主位得用判断/);
});

test('新派深度推演：月令落日空改以年支论旺衰、紧贴三字喜忌与虚实反断提示', () => {
  // 甲子日旬空戌、亥；月柱乙亥（月支亥落日空），年柱丙寅（寅木助身），时干庚金无根虚浮
  const chart = buildTestChart({ year: '丙寅', month: '乙亥', day: '甲子', hour: '庚午' }, '壬');
  const [xinpai] = evaluateBaziSchoolAlgorithms(chart, ['xinpai']);
  const joined = xinpai.findings.join('\n');

  assert.equal(xinpai.school, 'xinpai');
  assert.match(joined, /紧贴三字喜忌：月干乙.*日支子.*时干庚/);
  assert.match(joined, /月支亥落日空：新派以月令空亡不决定旺衰，改以年支寅/);
  assert.match(joined, /反断提示/);
  assert.match(joined, /虚干.*时干庚/);
});

test('调候与扶抑冲突：本地权衡与子平/调候/格局三派同步给出冲突优先级说明', () => {
  // 庚金生于午月（夏燥），日主身弱（无强根），《穷通》夏金需壬癸水润局，而身弱扶抑忌食伤水泄身
  const chart = buildTestChart(
    { year: '丙午', month: '甲午', day: '庚寅', hour: '丁亥' },
    '丁',
    { strengthStatus: '身弱', currentJieqi: '芒种' },
  );
  const tradeoff = chart.usefulGod.tradeoffAnalysis;
  assert.ok(tradeoff);
  assert.equal(tradeoff.climateVsBalance.status, '冲突');
  assert.ok(tradeoff.scenarioTags.includes('调候与扶抑冲突'));
  assert.match(tradeoff.climateVsBalance.priorityAdvice, /冬夏急候先顾调候/);

  const evals = evaluateBaziSchoolAlgorithms(chart, ['ziping', 'tiaohou', 'geju']);
  const zipingText = evals.find((e) => e.school === 'ziping')!.findings.join('\n');
  const tiaohouText = evals.find((e) => e.school === 'tiaohou')!.findings.join('\n');
  const gejuText = evals.find((e) => e.school === 'geju')!.findings.join('\n');

  assert.match(zipingText, /扶抑·调候·格局三线权衡.*张力/);
  assert.match(tiaohouText, /调候与扶抑权衡.*\[冲突\]/);
  assert.match(gejuText, /格局与扶抑调候权衡/);
});

test('中和命局：给出明确一级主选方向（调候/流通），同时输出中和动态取用指南', () => {
  const chart = buildTestChart(
    { year: '甲寅', month: '丙寅', day: '甲寅', hour: '丁卯' },
    '甲',
    {
      strengthStatus: '中和',
      patternOverview: { pattern: '比肩格', source: '普通月令取格候选', limitation: '' },
    },
  );
  assert.ok(chart.usefulGod.favorableWuxing.length > 0);
  assert.equal(chart.usefulGod.incrementStatus, '部分判定');
  assert.notEqual(chart.usefulGod.useful, '待判');
  assert.ok(chart.usefulGod.tradeoffAnalysis?.neutralGuidance);
  assert.ok(chart.usefulGod.tradeoffAnalysis.scenarioTags.includes('中和动态取用'));
  assert.match(formatUsefulGod(chart.usefulGod), /中和动态取用：/);
});

test('真假从格边缘：区分假从杂气与扶抑近从边界，提示岁运切换风险', () => {
  // 假曲直格（带丙丁火等泄秀与异党杂气）
  const fakeFollow = buildTestChart(
    { year: '甲寅', month: '戊寅', day: '甲寅', hour: '丁卯' },
    '甲',
    {
      patternOverview: { pattern: '曲直格', source: '曲直条件模型', limitation: '' },
    },
  );
  assert.equal(fakeFollow.usefulGod.tradeoffAnalysis?.followEdgeAssessment?.kind, '假从/从格边缘');
  assert.ok(fakeFollow.usefulGod.tradeoffAnalysis?.scenarioTags.includes('真假从格边缘'));
  assert.match(formatUsefulGod(fakeFollow.usefulGod), /从格边界提示：/);

  // 普通身弱无根且印比极微：扶抑近从边界
  const nearFollow = buildTestChart(
    { year: '戊戌', month: '丙辰', day: '甲午', hour: '庚午' },
    '戊',
    { strengthStatus: '身弱' },
  );
  assert.equal(nearFollow.usefulGod.tradeoffAnalysis?.followEdgeAssessment?.kind, '扶抑近从边界');
});

test('病药通关路径：区分身强/身弱给出财印相战与官杀混杂的差异化化解方案', () => {
  // 甲日主，月干己（正财）与时干壬（偏印）显性明透财印相战，年干庚（七杀）与月支酉（正官）官杀混杂
  const weakChart = buildTestChart(
    { year: '庚申', month: '己酉', day: '甲午', hour: '壬申' },
    '辛',
    { strengthStatus: '身弱' },
  );
  const weakPaths = weakChart.usefulGod.tradeoffAnalysis?.mediationPaths ?? [];
  const weakWealthResource = weakPaths.find((p) => p.conflictType === '财印相战');
  const weakOfficerMix = weakPaths.find((p) => p.conflictType === '官杀混杂');
  assert.ok(weakWealthResource);
  assert.equal(weakWealthResource.severity, '显性明透');
  assert.match(weakWealthResource.primaryRemedy, /比劫.*制财护印/);
  assert.ok(weakOfficerMix);
  assert.match(weakOfficerMix.primaryRemedy, /印星.*化杀生身/);

  // 同样结构但在身强条件下：财印相战优先官杀通关，官杀混杂优先食伤制杀留官
  const strongChart = buildTestChart(
    { year: '庚申', month: '己酉', day: '甲午', hour: '壬申' },
    '辛',
    { strengthStatus: '身强' },
  );
  const strongPaths = strongChart.usefulGod.tradeoffAnalysis?.mediationPaths ?? [];
  const strongWealthResource = strongPaths.find((p) => p.conflictType === '财印相战');
  const strongOfficerMix = strongPaths.find((p) => p.conflictType === '官杀混杂');
  assert.ok(strongWealthResource);
  assert.match(strongWealthResource.primaryRemedy, /官杀.*通关/);
  assert.ok(strongOfficerMix);
  assert.match(strongOfficerMix.primaryRemedy, /食伤.*制杀留官/);
  assert.match(formatUsefulGod(strongChart.usefulGod), /病药通关路径：/);
});

test('端到端八字五流派排盘与追问校验通过且包含新增深度推演内容', async () => {
  const result = await calculate('bazi', {
    question: '综合看事业与财运做功',
    birth: { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 },
    gender: 'male',
    prompt: { schools: ['ziping', 'mangpai', 'xinpai', 'tiaohou', 'geju'] },
  });
  const text = result.prompt.text;
  assert.match(text, /权衡要点：/);
  assert.match(text, /做功方式与墓库：/);
  assert.match(text, /盲派断语要点：/);
  assert.match(text, /紧贴三字喜忌：/);
  assert.match(text, /扶抑·调候·格局三线权衡：/);
  assert.match(text, /调候与扶抑权衡：/);
  assert.match(text, /格局与扶抑调候权衡：/);

  const saved = JSON.parse(JSON.stringify(result));
  const followed = await reprompt({
    method: 'bazi',
    result: saved,
    question: '请重点展开盲派和新派断语',
    prompt: { schools: ['mangpai', 'xinpai'] },
  });
  assert.match(followed.prompt.text, /盲派断语要点：/);
  assert.match(followed.prompt.text, /紧贴三字喜忌：/);
});
