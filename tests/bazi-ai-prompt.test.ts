import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPromptFromConfig, getCompatibilityPrompt } from '../src/utils/ai/aiPrompts';
import {
  formatBaziCompatibilityFacts,
  formatCalculatedBaziCompatibilityFacts,
} from '../src/lib/bazi-compatibility-facts';
import { analyzeBaziCompatibility } from '@core/bazi';
import { baziCalculator } from '@core/bazi/baziCalculator';
import { formatBaziForPrompt, formatPatternBasisForPrompt } from '@core/bazi/baziAnalysisFormatter';
import { buildFortuneSelectionContext } from '@core/bazi/fortuneSelection';
import { generateAnalysisDimensionHints, getPeachBlossomDetail } from '@core/bazi/baziEnhancement';
import { identifyClassicPattern } from '@core/bazi/baziEnhancement/classicPatterns';
import { analyzeBaziNatalEvidence } from '@core/bazi/natalEvidence';
import { generateEnhancedAnalysisSection } from '@core/bazi/baziPromptEnhancement';
import { PROMPT_GUIDANCE_TEXT as PROMPT_ROLE_TEXT } from '../src/lib/prompt-guidance';
import { assertPromptHasAnswerFramework, assertPromptHasSingleRole } from './prompt-assertions';
import {
  buildBaziCompatibilityPrompt,
  buildBaziPrompt,
  formatBaziPatternConditions,
} from '../packages/core/src/prompt/bazi';
import { buildBaziPromptForResult } from '../packages/core/src/prompt/public-api';
import {
  formatBaziSchoolPrompt,
  formatBaziSchoolsPrompt,
} from '../packages/core/src/prompt/bazi-school';

function assertNoEngineeringPromptText(prompt: string) {
  assert.doesNotMatch(
    prompt,
    /本项目|当前项目|项目统一|本地|技术限制|未计算|资料包|提示词规则|系统提示词|在线\s*AI|工程|算法(?:结果|返回|生成|实际)|本模块|当前数据|实际返回|用户补充：/,
  );
  assert.doesNotMatch(prompt, /当前已写入|当前未写入|已写入|未写入/);
  assert.doesNotMatch(prompt, /用户(?:未|没有|选择|所选|已选|填写|提供|补充|问题)/);
  assert.doesNotMatch(prompt, /需要补充|请补充|再选择/);
  assert.doesNotMatch(prompt, /预设|模板|接口|API|MCP|调试/);
}

type BaziInput = Parameters<typeof baziCalculator.calculateBazi>[0];

function createBaziResult(overrides: Partial<BaziInput> = {}) {
  const base: BaziInput = {
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 1,
    gender: 'male',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  };

  return baziCalculator.calculateBazi({ ...base, ...overrides });
}

type BaziResult = ReturnType<typeof baziCalculator.calculateBazi>;

let cached1995MayMaleBaziResult: BaziResult | undefined;

function get1995MayMaleBaziResult() {
  return structuredClone(
    (cached1995MayMaleBaziResult ??= createBaziResult({
      year: 1995,
      month: 5,
      day: 20,
      timeIndex: 5,
      gender: 'male',
    })),
  );
}

let cachedDefaultBaziResult: BaziResult | undefined;

function getDefaultBaziResult() {
  return structuredClone((cachedDefaultBaziResult ??= createBaziResult()));
}

let cachedOrdinaryZhengyinResult: ReturnType<typeof baziCalculator.calculateBazi> | undefined;

function getOrdinaryZhengyinResult() {
  const result = (cachedOrdinaryZhengyinResult ??= createBaziResult({
    year: 1990,
    month: 9,
    day: 5,
    timeIndex: 6,
  }));
  return structuredClone(result);
}

let cached2013SeptemberBaziResult: BaziResult | undefined;

function get2013SeptemberBaziResult() {
  return structuredClone(
    (cached2013SeptemberBaziResult ??= createBaziResult({
      year: 2013,
      month: 9,
      day: 25,
      timeIndex: 3,
    })),
  );
}

let cached2023DecemberBaziResult: BaziResult | undefined;

function get2023DecemberBaziResult() {
  return structuredClone(
    (cached2023DecemberBaziResult ??= createBaziResult({
      year: 2023,
      month: 12,
      day: 3,
      timeIndex: 6,
    })),
  );
}

let cached1980MayBaziResult: BaziResult | undefined;

function get1980MayBaziResult() {
  return structuredClone(
    (cached1980MayBaziResult ??= createBaziResult({
      year: 1980,
      month: 5,
      day: 3,
      timeIndex: 0,
    })),
  );
}

let cached1988JanuaryFemaleBaziResult: BaziResult | undefined;

function get1988JanuaryFemaleBaziBase() {
  return (cached1988JanuaryFemaleBaziResult ??= createBaziResult({
    year: 1988,
    month: 1,
    day: 1,
    timeIndex: 0,
    gender: 'female',
  }));
}

function clone1988JanuaryFemaleBaziResult() {
  return structuredClone(get1988JanuaryFemaleBaziBase());
}

let cached1990JuneBaziResult: BaziResult | undefined;

function get1990JuneBaziResult() {
  return structuredClone(
    (cached1990JuneBaziResult ??= createBaziResult({
      year: 1990,
      month: 6,
      day: 15,
      timeIndex: 5,
      gender: 'male',
    })),
  );
}

let cached1993AprilSingaporeBaziResult: BaziResult | undefined;

function get1993AprilSingaporeBaziResult() {
  return structuredClone(
    (cached1993AprilSingaporeBaziResult ??= createBaziResult({
      year: 1993,
      month: 4,
      day: 8,
      timeIndex: 12,
      birthPlace: '新加坡',
    })),
  );
}

let cached1994MarchBaziResult: BaziResult | undefined;

function get1994MarchBaziResult() {
  return structuredClone(
    (cached1994MarchBaziResult ??= createBaziResult({
      year: 1994,
      month: 3,
      day: 17,
      timeIndex: 4,
    })),
  );
}

let cached1994FebruaryBaziResult: BaziResult | undefined;

function get1994FebruaryBaziResult() {
  return structuredClone(
    (cached1994FebruaryBaziResult ??= createBaziResult({
      year: 1994,
      month: 2,
      day: 15,
      timeIndex: 6,
    })),
  );
}

let cachedMarriagePrompt: ReturnType<typeof buildPromptFromConfig> | undefined;

function getMarriagePromptFixture() {
  const baseResult = get1988JanuaryFemaleBaziBase();
  const prompt = (cachedMarriagePrompt ??= buildPromptFromConfig(
    '请分析我的婚恋。',
    { id: 'ai-marriage', prompt: '测试', scopeLabel: '婚恋' },
    structuredClone(baseResult),
    null,
    '婚恋',
    { isCustomQuestion: false },
  ));
  return { result: structuredClone(baseResult), prompt };
}

test('夏令时跨日任务书分别列原始出生钟表与排盘历法，时辰盘不虚构精确时刻', () => {
  for (const mode of [{ applyChinaDst: true }, { timeZoneId: 'Asia/Shanghai' }]) {
    const result = baziCalculator.calculateBazi({
      year: 1988,
      month: 6,
      day: 1,
      birthHour: 0,
      birthMinute: 30,
      birthSecond: 42,
      gender: 'male',
      ...mode,
    });
    for (const prompt of [
      buildBaziPrompt({ result, fortuneScope: 'natal' }),
      buildBaziPromptForResult({ result, fortuneScope: 'natal' }),
    ]) {
      assert.match(prompt, /出生钟表时间: 1988年6月1日 0:30:42/);
      assert.match(prompt, /排盘历法: 阳历1988年5月31日/);
      assert.doesNotMatch(prompt, /出生历法: 阳历1988年5月31日/);
      assert.equal(prompt.split('出生钟表时间:').length - 1, 1);
      assertNoEngineeringPromptText(prompt);
    }
  }

  const shichen = buildBaziPrompt({ result: getDefaultBaziResult(), fortuneScope: 'natal' });
  assert.doesNotMatch(shichen, /出生钟表时间:/);
  const unknown = baziCalculator.calculateBazi({ year: 2024, month: 5, day: 19, gender: 'male' });
  assert.doesNotMatch(buildBaziPrompt({ result: unknown, fortuneScope: 'natal' }), /出生钟表时间:/);
});

function createCompatibilityBaziResults() {
  return {
    result1: clone1988JanuaryFemaleBaziResult(),
    result2: get1990JuneBaziResult(),
  };
}

test('八字合盘不再附加系统提示词，并保留双盘资料与简明任务', () => {
  const { result1, result2 } = createCompatibilityBaziResults();

  const prompt = getCompatibilityPrompt('请分析我们适不适合长期合伙。', result1, result2, 'career');

  assert.equal(prompt.system, '');
  assertPromptHasSingleRole(prompt.user, PROMPT_ROLE_TEXT['bazi-compatibility']);
  assert.match(prompt.user, /【双盘关系资料】/);
  assert.match(prompt.user, /当前成败判定：/);
  assert.doesNotMatch(prompt.user, /【第一人格局条件】|【第二人格局条件】/);
  assert.match(prompt.user, /日主关系：/);
  assert.match(prompt.user, /【任务】\n关系范围：合伙。请依据双方盘面回答【问题】。/);
  assert.doesNotMatch(prompt.user, /结构化证据|证据边界|不得编造|只基于/);
  assert.equal((prompt.user.match(/^【第一人排盘信息】$/gm) ?? []).length, 1);
  assert.equal((prompt.user.match(/^【第二人排盘信息】$/gm) ?? []).length, 1);
  assert.doesNotMatch(prompt.user, /^【命盘】$/m);
  assert.doesNotMatch(prompt.user, /^【核心判断】$/m);
  assert.doesNotMatch(prompt.user, /^【四柱】$/m);
  assert.match(prompt.user, /命盘：\n/);
  assert.match(prompt.user, /核心判断：\n/);
  assert.match(prompt.user, /四柱：\n/);
});

test('八字合盘喜忌覆盖不复述已在个人盘面呈现的功能事实', () => {
  const result1 = getOrdinaryZhengyinResult();
  const result2 = get2013SeptemberBaziResult();
  const prompts = [
    getCompatibilityPrompt('请分析双方关系。', result1, result2).user,
    buildBaziCompatibilityPrompt({ result1, result2 }),
  ];

  for (const prompt of prompts) {
    const coverageLine =
      prompt.split('\n').find((line) => /喜忌(?:五行对应|覆盖)：/.test(line)) ?? '';
    assert.equal(prompt.match(/原局格神作用：庚正印（年柱）已参与成格/g)?.length, 1);
    assert.equal(
      prompt.match(/格局破格所忌：丁伤官（时柱）；伤官见官的救应明确不成立/g)?.length,
      1,
    );
    assert.match(coverageLine, /第一人盘面命中第二人喜用五行/);
    assert.doesNotMatch(coverageLine, /原局格神作用|格局破格所忌/);
  }
});

test('合参任务书保留喜忌待判方向及另一人的已核覆盖', () => {
  const result1 = getOrdinaryZhengyinResult();
  const result2 = get2013SeptemberBaziResult();
  const facts = formatBaziCompatibilityFacts(result1, result2);
  const prompt = getCompatibilityPrompt('请分析双方关系。', result1, result2).user;

  assert.equal(result1.analysis.usefulGod.incrementStatus, '待判');
  assert.match(facts, /喜忌五行对应：第一人增补喜忌五行待判/);
  assert.match(facts, /无法核验第二人盘面的增补喜忌覆盖/);
  assert.match(facts, /第一人盘面命中第二人喜用五行水、木/);
  assert.ok(prompt.includes(`【双盘关系资料】\n${facts}`));
  assertNoEngineeringPromptText(prompt);
});

test('八字紫微合参只复用双方关系事实，不嵌套整份八字合盘任务书', () => {
  const { result1, result2 } = createCompatibilityBaziResults();
  const compatibility = analyzeBaziCompatibility(result1, result2, {
    person1Name: '甲方',
    person2Name: '乙方',
  });
  const facts = formatCalculatedBaziCompatibilityFacts(compatibility);
  const prompt = getCompatibilityPrompt('双方如何协作？', result1, result2, 'career', {
    compatibility,
  });

  assert.match(facts, /日主关系：|四柱关系：/);
  assert.ok(prompt.user.includes(`【双盘关系资料】\n${facts}`));
  assert.deepEqual(compatibility.people, { person1: '甲方', person2: '乙方' });
  assert.doesNotMatch(facts, /【第一人排盘信息】|【第二人排盘信息】|【任务】|【问题】/);
});

test('八字输出提示词应是可复制给在线 AI 的独立任务书，不暴露工程提示词', () => {
  const result = get1990JuneBaziResult();
  const prompt = buildPromptFromConfig(
    '请分析事业方向。',
    { id: 'ai-career', prompt: '测试', scopeLabel: '事业' },
    result,
  );
  assert.equal(prompt.system, '');
  const combinedPrompt = prompt.user;

  assertPromptHasSingleRole(combinedPrompt, PROMPT_ROLE_TEXT.bazi);
  assertNoEngineeringPromptText(combinedPrompt);
  const conditions = formatBaziPatternConditions(result);
  assert.doesNotMatch(conditions, /(?:pattern|path)\.[a-z.-]+/);
  assert.doesNotMatch(conditions, /候选取用：|取格分层候选：|格局条件：/);
  for (const text of [
    combinedPrompt,
    buildBaziPrompt({ result, topic: 'career', fortuneScope: 'natal' }),
    buildBaziPromptForResult({ result, topic: 'career', fortuneScope: 'natal' }),
  ]) {
    assert.match(text, /当前成败判定：/);
    if (conditions) assert.ok(text.includes(conditions));
    const task = text.split('【任务】\n')[1]?.split('【问题】')[0] ?? '';
    assert.ok(task.length > 0);
    assert.doesNotMatch(task, /大运|流年|岁运/);
  }
});

test('普通格任务书保留成败与一次取格依据，命限仅在所选完整范围出现', () => {
  const result = getOrdinaryZhengyinResult();
  assert.equal(result.analysis.mingGe.fulfillment?.status, '成格');
  assert.equal(formatBaziPatternConditions(result), '');

  const prompt = buildBaziPrompt({ result, fortuneScope: 'natal' });
  assert.match(prompt, /格局: 正印格/);
  assert.match(prompt, /^当前成败判定：成格/m);
  assert.doesNotMatch(prompt, /所取格局：/);
  assert.doesNotMatch(prompt, /【格局条件】|取格分层候选：正印格|候选取用：/);

  for (const text of [
    prompt,
    buildBaziPrompt({ result, fortuneScope: 'full' }),
    buildBaziPromptForResult({ result, fortuneScope: 'natal' }),
  ]) {
    assert.match(text, /格局: 正印格/);
    assert.match(text, /当前成败判定：成格/);
    assert.match(text, /已列取格依据与格局成败/);
    assert.doesNotMatch(text, /候选格局(?:逐核|分别核对)/);
  }

  const basis = '月支申本气为庚（正印）；分日司权同为庚，且已透于年干，按该司令十神取正印格';

  for (const options of [
    { school: 'ziping' as const },
    { school: 'mangpai' as const },
    { school: 'xinpai' as const },
    { schools: ['ziping'] as const },
    { schools: ['ziping', 'mangpai'] as const },
    { schools: ['ziping', 'mangpai', 'xinpai'] as const },
  ]) {
    const prompt = buildBaziPrompt({ result, fortuneScope: 'natal', ...options });
    assert.equal(prompt.split(basis).length - 1, 1);
    assert.ok(
      prompt
        .split('\n')
        .find((line) => line.startsWith('格局: '))
        ?.includes(basis),
    );
    assert.doesNotMatch(prompt, /^取格依据：/m);
    assert.doesNotMatch(prompt, /【格局条件】|所取格局：|格局条件：/);
    if ('school' in options) {
      assert.doesNotMatch(prompt, /出生后\s*\d+\s*年.*起运|大运\w+（\d{4}年起/);
      assert.doesNotMatch(prompt, /【命限资料】/);
      const full = buildBaziPrompt({ result, school: options.school, fortuneScope: 'full' });
      assert.match(full, /【命限资料】/);
      assert.match(full, /完整大运流年：/);
    }
  }
});

test('新派流派任务引用格局成败，不预设额外格局条件段', () => {
  for (const result of [getOrdinaryZhengyinResult(), get2023DecemberBaziResult()]) {
    for (const prompt of [
      formatBaziSchoolPrompt(result, 'xinpai'),
      buildBaziPrompt({ result, school: 'xinpai' }),
      buildBaziPrompt({ result, schools: ['ziping', 'xinpai'] }),
    ]) {
      assert.match(prompt, /流派任务：结合已给出的日主旺衰、扶抑取用、调候及格局成败/);
      assert.doesNotMatch(prompt, /格局条件/);
    }
  }
});

test('财格身承财条件已在成败理由和旺衰事实呈现时不另起条件段', () => {
  const result = createBaziResult({ year: 1990, month: 7, day: 7, timeIndex: 6 });
  const conditions = formatBaziPatternConditions(result);
  const prompt = buildBaziPrompt({ result, fortuneScope: 'natal' });

  assert.match(prompt, /旺衰: 身弱/);
  assert.doesNotMatch(conditions, /财格的身承财条件/);
  assert.match(prompt, /当前成败判定：/);
});

test('多候选格局提示词只在格局行列选中依据，另列未选候选', () => {
  const result = get1993AprilSingaporeBaziResult();
  const selected = result.analysis.mingGe.patternCandidates?.find(
    (candidate) => candidate.selected,
  );
  const alternative = result.analysis.mingGe.patternCandidates?.find(
    (candidate) => !candidate.selected && candidate.pattern !== result.analysis.mingGe.pattern,
  );
  assert.ok(selected);
  assert.ok(alternative);

  assert.ok(result.analysis.mingGe.basis);
  for (const options of [
    {},
    { school: 'ziping' as const },
    { schools: ['ziping', 'mangpai'] as const },
  ]) {
    const prompt = buildBaziPrompt({ result, fortuneScope: 'natal', ...options });
    assert.equal(prompt.split(`其他取格候选：${alternative.pattern}`).length - 1, 1);
    assert.equal(prompt.split(result.analysis.mingGe.basis).length - 1, 1);
    assert.doesNotMatch(prompt, /取格分层候选：|所取格局：/);
    assert.match(prompt, /^当前成败判定：/m);
  }
});

test('同名取格路径不作为其他格局重复列示', () => {
  const result = getOrdinaryZhengyinResult();
  const pattern = result.analysis.mingGe.pattern;
  result.analysis.mingGe.patternCandidates = [
    { pattern, source: '月令本气', basis: '月令本气取格', selected: true },
    { pattern, source: '分日司令透干', basis: '司令透干同名取格', selected: false },
    { pattern: '偏印格', source: '月令藏干透干', basis: '月令藏干取偏印格', selected: false },
  ];

  for (const prompt of [buildBaziPrompt({ result }), formatBaziSchoolPrompt(result, 'ziping')]) {
    assert.match(prompt, /其他取格候选：偏印格/);
    assert.doesNotMatch(prompt, /其他取格候选：[^\n]*司令透干同名取格/);
  }

  result.analysis.mingGe.patternCandidates.pop();
  assert.doesNotMatch(buildBaziPrompt({ result }), /其他取格候选：/);
});

test('独立流派资料中的选中取格依据和其他候选各出现一次', () => {
  const result = get1993AprilSingaporeBaziResult();
  const basis = result.analysis.mingGe.basis;
  const alternative = result.analysis.mingGe.patternCandidates?.find(
    (candidate) => !candidate.selected && candidate.pattern !== result.analysis.mingGe.pattern,
  );
  assert.ok(basis);
  assert.ok(alternative);

  for (const prompt of [
    formatBaziSchoolPrompt(result, 'ziping'),
    formatBaziSchoolPrompt(result, 'mangpai'),
    formatBaziSchoolPrompt(result, 'xinpai'),
    formatBaziSchoolsPrompt(result, ['ziping', 'mangpai']),
  ]) {
    assert.equal(prompt.split(basis).length - 1, 1);
    assert.equal(prompt.split(`其他取格候选：${alternative.pattern}`).length - 1, 1);
    assert.doesNotMatch(prompt, /取格分层候选：|所取格局：/);
    assert.match(prompt, /当前成败判定：/);
  }

  for (const schools of [
    ['ziping', 'mangpai', 'xinpai'],
    ['xinpai', 'mangpai', 'ziping'],
    ['mangpai', 'xinpai'],
  ] as const) {
    const prompt = formatBaziSchoolsPrompt(result, schools);
    assert.equal(prompt.match(/^格局与取用：/gm)?.length, 1);
    assert.equal(prompt.match(/^透干通根：/gm)?.length, 1);
    assert.equal(prompt.match(/原局格神作用：/g)?.length, 1);
    assert.equal(prompt.split(basis).length - 1, 1);
    assert.equal(prompt.split(`其他取格候选：${alternative.pattern}`).length - 1, 1);
    if (schools.some((school) => school === 'ziping')) assert.match(prompt, /^五行季节状态：/m);
  }
});

test('已成化格保留结论与取用，省略重复的逐项核验', () => {
  const result = get1994MarchBaziResult();
  const patternBefore = structuredClone(result.analysis.mingGe);
  assert.equal(result.analysis.mingGe.transformation?.status, '成化');

  for (const school of [undefined, 'ziping' as const]) {
    const prompt = buildBaziPrompt({ result, fortuneScope: 'natal', school });
    assert.match(prompt, /格局: 丁壬化木格[^\n]*化气判定：成化/);
    assert.match(prompt, /化神取用：[^\n]*化神木/);
    assert.doesNotMatch(prompt, /【格局条件】|取用条件：|化气证据：/);
  }
  const fact = analyzeBaziNatalEvidence(result).analysisFacts.find((item) => item.type === '格局');
  assert.ok(fact);
  assert.ok(fact.basis.includes(patternBefore.basis!));
  assert.deepEqual(fact.transformation, patternBefore.transformation);
  assert.deepEqual(fact.patternFulfillment, patternBefore.fulfillment);
  assert.deepEqual(result.analysis.mingGe, patternBefore);
});

test('成化状态在合盘与多派提示词只呈现一次', () => {
  const formed = get1994MarchBaziResult();
  const other = getOrdinaryZhengyinResult();
  const compatibilityPrompt = buildBaziCompatibilityPrompt({ result1: formed, result2: other });

  for (const prompt of [
    getCompatibilityPrompt('请分析双方关系。', formed, other).user,
    compatibilityPrompt,
  ]) {
    assert.equal(prompt.match(/化气判定：成化/g)?.length, 1);
    assert.match(prompt, /化神取用：[^\n]*化神木/);
    const relationFacts = prompt.split('【双盘关系资料】')[1] ?? '';
    assert.doesNotMatch(relationFacts, /化气判定：成化|取用主体：化神木/);
  }
  assert.doesNotMatch(compatibilityPrompt, /化气判定：存在反证/);

  for (const build of [buildBaziPrompt, buildBaziPromptForResult]) {
    const prompt = build({ result: formed, schools: ['ziping', 'mangpai'] });
    assert.equal(prompt.match(/化气判定：成化/g)?.length, 1);
    assert.match(prompt, /共同格局事实：\n透干通根：[^\n]+/);
    assert.equal(
      prompt.split(formatPatternBasisForPrompt(formed.analysis.mingGe.basis!)).length - 1,
      1,
    );
    assert.doesNotMatch(prompt, /^化神木；依据《子平真诠/m);
  }
});

test('流派格局资料只保留本盘成败理由与实际旺衰事实', () => {
  const formed = getOrdinaryZhengyinResult();
  const schoolPrompt = buildBaziPrompt({ result: formed, school: 'ziping' });
  assert.match(schoolPrompt, /当前成败判定：成格/);
  assert.doesNotMatch(schoolPrompt, /^条件核验：满足；/m);

  const broken = createBaziResult({ year: 2000, month: 1, day: 7, timeIndex: 5 });
  const prompt = buildBaziPrompt({ result: broken });
  const basis = broken.analysis.mingGe.fulfillment!.basis;
  assert.ok(basis);
  assert.doesNotMatch(prompt, /先看得令，再看地支明根|不把旺相休囚死/);
  assert.doesNotMatch(prompt, /此处要求正官月令、透干/);
  assert.match(prompt, /旺衰: [^\n]+月令[^\n]+司令[^\n]+成局/);
  assert.match(prompt, /当前成败判定：破格；判定理由：/);
});

test('破格救应已在核心判断列明时省略重复格局条件', () => {
  const result = get2013SeptemberBaziResult();
  assert.equal(result.analysis.mingGe.fulfillment?.status, '破格');

  const conditions = formatBaziPatternConditions(result);
  assert.equal(conditions, '');
  const prompt = buildBaziPrompt({ result, fortuneScope: 'natal' });
  assert.match(prompt, /当前成败判定：破格/);
  assert.match(prompt, /格局破格所忌：丁伤官（时柱）；伤官见官的救应明确不成立/);
  assert.doesNotMatch(prompt, /【格局条件】/);

  result.analysis.usefulGod.decisionEvidence!.patternBreakerRestrictions = [];
  assert.equal(formatBaziPatternConditions(result), '');
  for (const text of [
    buildBaziPrompt({ result }),
    buildPromptFromConfig(
      '分析当前格局。',
      { id: 'ai-career', prompt: '分析事业。', scopeLabel: '事业' },
      result,
    ).user,
  ]) {
    assert.doesNotMatch(text, /【格局条件】|破格项：伤官见官/);
    assert.match(text, /干级所忌：丁/);
  }
  result.analysis.mingGe.fulfillment!.decisionDetail =
    result.analysis.mingGe.fulfillment!.decisionDetail!.replace('伤官见官', '原局受损');
  assert.match(formatBaziPatternConditions(result), /破格项：伤官见官（丁伤官（时柱））/);
});

test('救应资料不足时已列明的破格项不重复写入格局条件', () => {
  const result = createBaziResult({ year: 2012, month: 9, day: 3, timeIndex: 3 });
  assert.equal(result.analysis.mingGe.fulfillment?.status, '破格');
  assert.match(result.analysis.mingGe.fulfillment?.decisionDetail ?? '', /伤官见官/);
  assert.equal(result.pillars.month.gan, '戊');
  assert.equal(result.analysis.mingGe.fulfillment?.activeBreakers?.[0]?.repairStatus, '资料不足');
  assert.equal(formatBaziPatternConditions(result), '');

  for (const prompt of [
    buildBaziPrompt({ result, fortuneScope: 'natal' }),
    buildPromptFromConfig(
      '分析当前格局。',
      { id: 'ai-career', prompt: '分析事业。', scopeLabel: '事业' },
      result,
    ).user,
  ]) {
    assert.match(prompt, /判定理由：原局见伤官见官、官杀混杂/);
    assert.match(prompt, /月柱: 戊申 \[伤官\]/);
    assert.doesNotMatch(prompt, /【格局条件】|破格项：伤官见官/);
  }
});

test('格神前提未满足时不附加救应条件，从儿格不重复已有的财气承接与五行流向', () => {
  const uncertain = createBaziResult({ year: 1980, month: 1, day: 3, timeIndex: 0 });
  const uncertainConditions = formatBaziPatternConditions(uncertain);
  assert.equal(uncertainConditions, '');

  const conger = get1980MayBaziResult();
  assert.equal(formatBaziPatternConditions(conger), '');
  for (const prompt of [
    buildBaziPrompt({ result: conger }),
    buildBaziPrompt({ result: conger, schools: ['ziping', 'mangpai'] }),
  ]) {
    assert.doesNotMatch(prompt, /支藏印官未构成从儿格的实际反证/);
    assert.match(prompt, /承接食伤所生/);
    assert.match(prompt, /食伤土生财星金/);
    assert.doesNotMatch(prompt, /原支藏印官事实：/);
    assert.match(prompt, /年柱: 庚申[^\n]*[\s\S]*藏干: [^\n]*壬\[七杀\]/);
  }
  assert.doesNotMatch(buildBaziPrompt({ result: conger }), /从儿五行流向：/);
});

test('从儿格缺少明确财气承接依据时仍保留本盘五行流向', () => {
  const result = get1980MayBaziResult();
  result.analysis.mingGe.basis = result.analysis.mingGe.basis?.replace('承接食伤所生', '财星明透');
  assert.match(formatBaziPatternConditions(result), /从儿五行流向：食伤土生财金/);
});

test('从儿格月建条件在页面、公开提示词与合盘中只列一次', () => {
  const result = get1980MayBaziResult();
  const other = getOrdinaryZhengyinResult();
  const prompts = [
    buildBaziPrompt({ result }),
    buildBaziPromptForResult({ result }),
    buildPromptFromConfig(
      '分析原局格局。',
      { id: 'ai-career', prompt: '分析事业。', scopeLabel: '事业' },
      result,
    ).user,
    buildBaziCompatibilityPrompt({ result1: result, result2: other }),
    getCompatibilityPrompt('分析双方关系。', result, other).user,
  ];
  for (const prompt of prompts) {
    assert.match(prompt, /《滴天髓阐微·顺局》从儿法成立：月支辰本气戊为食神/);
    assert.equal(prompt.match(/月建食伤当权/g)?.length ?? 0, 0);
    assert.equal(prompt.match(/食伤在月建当权/g)?.length, 1);
    assert.doesNotMatch(prompt, /【(?:第一人)?格局条件】/);
  }
});

test('从儿格流派资料不重复五行流向与已列的财星明透条件', () => {
  const result = get1980MayBaziResult();
  assert.equal(result.analysis.mingGe.specialAdjudication?.kind, '从儿格');
  const basis = result.analysis.mingGe.basis!;
  const satisfied = result.analysis.mingGe.specialAdjudication!.satisfied;
  const prompts = [
    buildBaziPrompt({ result, schools: ['ziping', 'mangpai'] }),
    buildBaziPromptForResult({ result, schools: ['ziping', 'mangpai'] }),
  ];
  for (const prompt of prompts) {
    assert.equal(prompt.match(/食伤土生财星金/g)?.length, 1);
    assert.doesNotMatch(prompt, /从儿五行流向：|^财星明透：/m);
    assert.match(prompt, /庚财星明透，承接食伤所生/);
    assert.match(prompt, /格局: 从儿格（《滴天髓阐微·顺局》从儿法成立：/);
    assert.equal(prompt.split(formatPatternBasisForPrompt(basis)).length - 1, 1);
    assert.doesNotMatch(prompt, /特殊格裁决：从儿格成立/);
    assert.doesNotMatch(prompt, /从儿法成立：月建食伤当权；月支|路径：月建食伤当权/);
    assertNoEngineeringPromptText(prompt);
  }
  const independentSchoolFacts = formatBaziSchoolPrompt(result, 'ziping');
  assert.match(independentSchoolFacts, /从儿五行流向：食伤土生财金/);
  assert.doesNotMatch(independentSchoolFacts, /^财星明透：/m);
  assert.equal(independentSchoolFacts.split(formatPatternBasisForPrompt(basis)).length - 1, 1);
  assert.doesNotMatch(independentSchoolFacts, /特殊格条件：|特殊格裁决：从儿格成立/);
  for (const condition of satisfied) {
    assert.equal(
      independentSchoolFacts.split(formatPatternBasisForPrompt(condition)).length - 1,
      1,
    );
  }

  const multiSchoolFacts = formatBaziSchoolsPrompt(result, ['ziping', 'mangpai']);
  assert.equal(multiSchoolFacts.split(formatPatternBasisForPrompt(basis)).length - 1, 1);
  assert.doesNotMatch(multiSchoolFacts, /特殊格条件：|特殊格裁决：从儿格成立/);
  for (const condition of satisfied) {
    assert.equal(multiSchoolFacts.split(formatPatternBasisForPrompt(condition)).length - 1, 1);
  }

  const partiallySummarized = get1980MayBaziResult();
  const omittedCondition = partiallySummarized.analysis.mingGe.specialAdjudication!.satisfied[1];
  partiallySummarized.analysis.mingGe.basis = partiallySummarized.analysis.mingGe.basis!.replace(
    omittedCondition,
    '',
  );
  const partialFacts = formatBaziSchoolPrompt(partiallySummarized, 'ziping');
  assert.equal(partialFacts.match(/特殊格条件：/g)?.length, 1);
  assert.match(partialFacts, new RegExp(omittedCondition));
  assert.equal(partialFacts.split(formatPatternBasisForPrompt(satisfied[0])).length - 1, 1);
});

test('从儿格已列顺局作用时不在特殊格条件重复财星制印', () => {
  const result = get1994FebruaryBaziResult();
  const action = '月干丙财星有可用根，制日柱申藏庚偏印，印夺食有救';
  assert.equal(result.analysis.mingGe.specialAdjudication?.status, '成立');
  assert.ok(result.analysis.mingGe.specialAdjudication?.satisfied.includes(action));
  assert.ok(result.analysis.mingGe.specialAdjudication?.functionalResolutions.includes(action));

  for (const prompt of [
    formatBaziSchoolPrompt(result, 'ziping'),
    buildBaziPrompt({ result, school: 'ziping' }),
    buildBaziPrompt({ result, schools: ['ziping', 'mangpai'] }),
  ]) {
    assert.equal(prompt.split(action).length - 1, 1);
    assert.doesNotMatch(prompt, new RegExp(`特殊格条件：[^\\n]*${action}`));
  }
});

test('从儿格顺局作用已列于取用配合时不另列格局条件', () => {
  const result = get1994FebruaryBaziResult();
  const action = result.analysis.mingGe.specialAdjudication?.functionalResolutions[0];
  const evidence = result.analysis.usefulGod.decisionEvidence;
  assert.ok(action);
  assert.ok(evidence);
  result.analysis.mingGe.basis = result.analysis.mingGe.basis?.replace(action, '');
  evidence.balanceAdjustment = { reason: action, favorableOrder: [] };

  assert.ok(!formatBaziPatternConditions(result).includes(`顺局作用：${action}`));
  for (const [index, prompt] of [
    buildBaziPrompt({ result }),
    buildPromptFromConfig(
      '分析原局格局。',
      { id: 'ai-career', prompt: '分析事业。', scopeLabel: '事业' },
      result,
    ).user,
  ].entries()) {
    assert.ok(prompt.includes(`取用配合：${action}`));
    assert.ok(!prompt.includes(`顺局作用：${action}`), `第${index + 1}个入口重复`);
  }
});

test('从儿格提示词保留成格依据而省略分日司权旁注', () => {
  const result = createBaziResult({ year: 1980, month: 10, day: 3, timeIndex: 6 });
  assert.equal(result.analysis.mingGe.specialAdjudication?.status, '成立');
  assert.match(result.analysis.mingGe.basis ?? '', /分日司权辛为食神仅作当日月气事实/);

  for (const prompt of [
    buildBaziPrompt({ result }),
    buildBaziPrompt({ result, school: 'ziping' }),
    buildBaziPrompt({ result, schools: ['ziping', 'mangpai'] }),
    formatBaziSchoolPrompt(result, 'ziping'),
  ]) {
    assert.match(prompt, /月支酉本气辛为食神，食伤在月建当权/);
    assert.match(prompt, /年支申藏壬生禄为可用结构财气，承接食伤所生/);
    assert.doesNotMatch(prompt, /仅作当日月气事实/);
  }
});

test('普通格提示词只保留所取格局依据，不展开从儿或曲直候选的多条反证', () => {
  for (const input of [
    { year: 1980, month: 1, day: 15, timeIndex: 6 },
    { year: 1980, month: 2, day: 3, timeIndex: 6 },
    { year: 1981, month: 6, day: 15, timeIndex: 6 },
    { year: 2000, month: 2, day: 27, timeIndex: 6 },
  ]) {
    const result = createBaziResult(input);
    const basis = result.analysis.mingGe.basis ?? '';
    assert.match(basis, /(?:从儿|曲直)结构未立：/);
    assert.ok(
      buildBaziPrompt({ result }).includes(
        `格局: ${result.analysis.mingGe.pattern}（${formatPatternBasisForPrompt(basis)}）`,
      ),
    );
    for (const prompt of [
      buildBaziPrompt({ result }),
      buildBaziPrompt({ result, school: 'ziping' }),
      formatBaziSchoolPrompt(result, 'ziping'),
    ]) {
      assert.match(prompt, /(?:格局: |格局与成败：)[^\n]*格/u);
      assert.doesNotMatch(prompt, /从儿结构未立：|曲直结构未立：/);
    }
  }
});

test('曲直格提示词保留成立依据，省略本盘重复藏干与内部核验长规则', () => {
  const result = get2023DecemberBaziResult();
  assert.equal(result.analysis.mingGe.specialAdjudication?.status, '成立');
  assert.match(result.analysis.mingGe.basis ?? '', /无半分庚辛之气/);
  for (const prompt of [
    buildBaziPrompt({ result }),
    buildBaziPrompt({ result, school: 'ziping' }),
    buildBaziPrompt({ result, schools: ['ziping', 'mangpai'] }),
    formatBaziSchoolPrompt(result, 'ziping'),
  ]) {
    assert.match(prompt, /《三命通会》卷六亥卯未曲直法/);
    assert.match(prompt, /未见庚辛金及局外支冲破/);
    assert.doesNotMatch(prompt, /木局成员藏干如实保留：|无半分庚辛之气|按张楠按语核局外支/);
  }
});

test('曲直格依据已包含亥卯未木局与成立事实时不再另列格局条件', () => {
  for (const input of [
    { year: 1980, month: 1, day: 3, timeIndex: 3 },
    { year: 2026, month: 11, day: 17, timeIndex: 3 },
  ]) {
    const result = createBaziResult(input);
    assert.equal(result.analysis.mingGe.specialAdjudication?.kind, '曲直格');
    assert.equal(result.analysis.mingGe.specialAdjudication?.status, '成立');
    assert.equal(formatBaziPatternConditions(result), '');
    const other = getOrdinaryZhengyinResult();
    for (const prompt of [
      buildBaziPrompt({ result }),
      buildBaziPromptForResult({ result }),
      buildPromptFromConfig(
        '请分析事业方向。',
        { id: 'ai-career', prompt: '测试', scopeLabel: '事业' },
        result,
      ).user,
      buildBaziCompatibilityPrompt({ result1: result, result2: other }),
      getCompatibilityPrompt('请分析双方关系。', result, other).user,
    ]) {
      assert.match(prompt, /格局: 曲直格（《三命通会》卷六亥卯未曲直法条件成立/);
      assert.doesNotMatch(prompt, /【(?:第一人)?格局条件】|特殊格裁决：曲直格成立/);
      assert.doesNotMatch(prompt, /取用依据:/);
    }
    for (const prompt of [
      buildBaziPrompt({ result, school: 'ziping' }),
      buildBaziPrompt({ result, schools: ['ziping', 'mangpai'] }),
    ]) {
      assert.match(prompt, /格局: 曲直格（《三命通会》卷六亥卯未曲直法条件成立/);
      assert.equal(
        prompt.split(formatPatternBasisForPrompt(result.analysis.mingGe.basis!)).length - 1,
        1,
      );
      assert.doesNotMatch(prompt, /特殊格裁决：曲直格成立/);
      assert.doesNotMatch(prompt, /特殊格路径：亥卯未木局/);
      assert.doesNotMatch(prompt, /【格局条件】|取用依据:/);
    }
  }
});

test('寅卯辰曲直格只保留成格依据，不重复列路线裁决和藏干长段', () => {
  const result = createBaziResult({ year: 1988, month: 3, day: 1, timeIndex: 0 });
  assert.equal(result.analysis.mingGe.specialAdjudication?.route, '寅卯辰东方');
  assert.equal(result.analysis.mingGe.specialAdjudication?.status, '成立');
  assert.equal(formatBaziPatternConditions(result), '');
  const other = getOrdinaryZhengyinResult();
  for (const prompt of [
    buildBaziPrompt({ result }),
    buildBaziPromptForResult({ result }),
    buildPromptFromConfig(
      '请分析事业方向。',
      { id: 'ai-career', prompt: '测试', scopeLabel: '事业' },
      result,
    ).user,
    buildBaziCompatibilityPrompt({ result1: result, result2: other }),
    getCompatibilityPrompt('请分析双方关系。', result, other).user,
    buildBaziPrompt({ result, school: 'ziping' }),
    buildBaziPrompt({ result, schools: ['ziping', 'mangpai'] }),
  ]) {
    assert.match(prompt, /《渊海子平·神趣八法·类象》春生寅卯辰法条件成立/);
    assert.match(prompt, /未见庚辛金及局外支冲破/);
    assert.match(prompt, /火土分别按泄秀与财星论/);
    assert.doesNotMatch(prompt, /【(?:第一人)?格局条件】|特殊格裁决：曲直格成立/);
    assert.doesNotMatch(prompt, /特殊格路径：寅卯辰东方/);
    assert.doesNotMatch(prompt, /木局成员藏干如实保留：|无半分庚辛之气|按张楠按语核局外支/);
  }
  const independent = formatBaziSchoolPrompt(result, 'ziping');
  assert.match(independent, /《渊海子平·神趣八法·类象》春生寅卯辰法条件成立/);
  assert.equal(
    independent.split(formatPatternBasisForPrompt(result.analysis.mingGe.basis!)).length - 1,
    1,
  );
  assert.doesNotMatch(independent, /特殊格路径：寅卯辰东方/);
});

test('从儿格在线流派资料只补充成格关系，不复述四柱中的透干与藏根', () => {
  const result = get1980MayBaziResult();
  for (const prompt of [
    buildBaziPrompt({ result, school: 'ziping' }),
    buildBaziPrompt({ result, schools: ['ziping', 'mangpai'] }),
    buildPromptFromConfig(
      '分析格局。',
      { id: 'ai-career', prompt: '分析事业。', scopeLabel: '事业' },
      result,
    ).user,
  ]) {
    assert.match(prompt, /月支辰本气戊为食神，食伤在月建当权/);
    assert.match(prompt, /庚财星明透，承接食伤所生/);
    assert.doesNotMatch(prompt, /^(?:食伤明透|财星明透|食伤结构根|财星结构根)：/m);
  }
});

test('流派提示词不重复曲直格依据中的成立条件、透干和成员藏干', () => {
  const result = createBaziResult({ year: 1980, month: 1, day: 3, timeIndex: 3 });
  const patternBefore = structuredClone(result.analysis.mingGe);
  const independent = formatBaziSchoolPrompt(result, 'ziping');
  assert.match(independent, /《三命通会》卷六亥卯未曲直法条件成立/);
  assert.equal(
    independent.split(formatPatternBasisForPrompt(result.analysis.mingGe.basis!)).length - 1,
    1,
  );
  assert.doesNotMatch(independent, /特殊格路径：亥卯未木局/);
  assert.doesNotMatch(independent, /亥藏壬、甲；卯藏乙；未藏己、丁、乙/);
  assert.doesNotMatch(independent, /^成员支藏干保留：/m);
  assert.doesNotMatch(independent, /^特殊格条件：/m);
  for (const prompt of [
    buildBaziPrompt({ result, school: 'ziping' }),
    buildBaziPrompt({ result, schools: ['ziping', 'mangpai'] }),
    buildBaziPromptForResult({ result, schools: ['ziping', 'mangpai'] }),
  ]) {
    assert.match(prompt, /格局: 曲直格/);
    assert.match(prompt, /格局: 曲直格（《三命通会》卷六亥卯未曲直法条件成立/);
    assert.equal(
      prompt.split(formatPatternBasisForPrompt(result.analysis.mingGe.basis!)).length - 1,
      1,
    );
    assert.doesNotMatch(prompt, /特殊格裁决：曲直格成立/);
    assert.doesNotMatch(prompt, /特殊格路径：亥卯未木局/);
    assert.match(prompt, /年柱: [^\n]+[\s\S]*藏干: [^\n]+/);
    assert.doesNotMatch(prompt, /特殊格条件：|^食伤明透：|^财星明透：|^成员支藏干保留：/m);
  }
  const routeNotShown = structuredClone(result);
  routeNotShown.analysis.mingGe.basis = routeNotShown.analysis.mingGe.basis!.replace(
    '亥卯未曲直法',
    '曲直法',
  );
  assert.match(
    formatBaziSchoolPrompt(routeNotShown, 'ziping'),
    /^特殊格裁决：曲直格成立；路径：亥卯未木局；方法：/m,
  );
  assert.deepEqual(result.analysis.mingGe, patternBefore);
});

test('格神未成立的真实命盘不把破格候选和救应路径当作提示词结论', () => {
  for (const input of [
    { year: 1980, month: 3, day: 15, timeIndex: 3 },
    { year: 1988, month: 12, day: 15, timeIndex: 0 },
  ]) {
    const result = createBaziResult(input);
    const target = result.analysis.mingGe.fulfillment?.conditionFacts?.find(
      (item) => item.key === 'pattern.target',
    );
    assert.notEqual(target?.status, '满足');
    assert.equal(formatBaziPatternConditions(result), '');
    const prompt = buildBaziPrompt({ result });
    assert.match(prompt, /当前成败判定：/);
    assert.doesNotMatch(prompt, /【格局条件】|破格项：|救应路径：|^相互制约：/m);
  }
});

test('成败未判定时不把候选破格项写成已发生的格局条件', () => {
  const result = createBaziResult({ year: 1992, month: 6, day: 15, timeIndex: 6 });
  assert.equal(result.analysis.mingGe.fulfillment?.status, '未判定');
  assert.ok(result.analysis.mingGe.fulfillment?.activeBreakers?.length);
  assert.equal(formatBaziPatternConditions(result), '');
  const prompt = buildBaziPrompt({ result });
  assert.match(prompt, /当前成败判定：未判定/);
  assert.doesNotMatch(prompt, /【格局条件】|破格项：|相互制约：/);
});

test('破而复成的破格与救应已见于核心判断和取用时不重复列格局条件', () => {
  const repaired = createBaziResult({ year: 2016, month: 3, day: 17, timeIndex: 3 });
  assert.equal(repaired.analysis.mingGe.fulfillment?.status, '破而复成');
  assert.equal(formatBaziPatternConditions(repaired), '');
  const other = getOrdinaryZhengyinResult();
  for (const prompt of [
    buildBaziPrompt({ result: repaired }),
    buildBaziPrompt({ result: repaired, school: 'ziping' }),
    buildBaziPrompt({ result: repaired, schools: ['ziping', 'mangpai'] }),
    buildBaziPromptForResult({ result: repaired }),
    buildPromptFromConfig(
      '请分析事业方向。',
      { id: 'ai-career', prompt: '测试', scopeLabel: '事业' },
      repaired,
    ).user,
    buildBaziCompatibilityPrompt({ result1: repaired, result2: other }),
    getCompatibilityPrompt('请分析双方关系。', repaired, other).user,
  ]) {
    assert.doesNotMatch(prompt, /【(?:第一人)?格局条件】|破格项：|救应路径：/);
    assert.equal(prompt.match(/伤官见官/g)?.length, 1);
    assert.equal(prompt.match(/印星制伤官护官；丙作用于辛/g)?.length, 1);
    assert.match(prompt, /月柱: 辛卯 \[伤官\]/);
  }

  repaired.analysis.usefulGod.decisionEvidence!.controlFunctions = [];
  const remainingConditions = formatBaziPatternConditions(repaired);
  assert.doesNotMatch(remainingConditions, /破格项：伤官见官/);
  assert.match(remainingConditions, /救应路径：印星制伤官护官/);
  for (const prompt of [
    buildBaziPrompt({ result: repaired }),
    buildPromptFromConfig(
      '分析当前格局。',
      { id: 'ai-career', prompt: '分析事业。', scopeLabel: '事业' },
      repaired,
    ).user,
    buildBaziCompatibilityPrompt({ result1: repaired, result2: other }),
    getCompatibilityPrompt('请分析双方关系。', repaired, other).user,
  ]) {
    assert.doesNotMatch(prompt, /破格项：伤官见官/);
    assert.match(prompt, /救应路径：印星制伤官护官/);
  }

  const broken = get2013SeptemberBaziResult();
  assert.equal(broken.analysis.mingGe.fulfillment?.status, '破格');
  assert.match(buildBaziPrompt({ result: broken }), /格局破格所忌：丁伤官（时柱）/);
});

test('中和正印格只列本盘旺衰依据和成格事实', () => {
  const result = createBaziResult({ year: 1990, month: 1, day: 25, timeIndex: 6 });
  assert.equal(result.analysis.dayMasterStrength.status, '中和');
  const prompt = buildBaziPrompt({ result });
  assert.ok(prompt.includes('旺衰: 中和（月令支持；司令生身；有根；成局中性）'));
  assert.match(prompt, /当前成败判定：成格；判定理由：格神已透干且有可用根气/);
  assert.doesNotMatch(prompt, /先看得令|不把旺相休囚死|此处按印星位置|【格局条件】/);
});

test('破格候选未判定时移除夹在事实与结论之间的通用规则', () => {
  const result = createBaziResult({ year: 1986, month: 3, day: 15, timeIndex: 3 });
  const fulfillment = result.analysis.mingGe.fulfillment!;
  assert.equal(fulfillment.status, '未判定');
  assert.ok(fulfillment.decisionDetail?.includes(fulfillment.basis));
  assert.ok(!fulfillment.decisionDetail?.endsWith(fulfillment.basis));
  for (const prompt of [
    buildBaziPrompt({ result }),
    buildBaziPrompt({ result, school: 'ziping' }),
  ]) {
    assert.ok(prompt.includes('伤官见官虽透，但月柱透干辛（伤官）无同类藏根'));
    assert.match(prompt, /存在破格候选，但救应条件尚未完备/);
    assert.ok(!prompt.includes(fulfillment.basis));
  }
});

test('流派提示词只补充格局的盘面证据，不复述共同判定和未激活破格候选', () => {
  const result = get2013SeptemberBaziResult();
  for (const build of [buildBaziPrompt, buildBaziPromptForResult]) {
    for (const options of [
      { school: 'ziping' as const },
      { schools: ['ziping', 'mangpai', 'xinpai'] as const },
    ]) {
      const prompt = build({ result, ...options });
      assert.doesNotMatch(prompt, /所取格局：/);
      assert.equal(prompt.match(/格局破格所忌：/g)?.length, 1);
      assert.doesNotMatch(prompt, /^条件核验：[^\n]*官杀混杂未透干/gm);
      assert.match(prompt, /透干通根：/);
      assert.match(prompt, /当前成败判定：破格/);
      const conditionLines = prompt
        .split('\n')
        .filter((line) => /^(?:条件核验|制化路径)：/.test(line));
      assert.equal(conditionLines.length, new Set(conditionLines).size);
    }
  }

  for (const schools of [
    ['ziping', 'mangpai', 'xinpai'],
    ['xinpai', 'mangpai', 'ziping'],
    ['mangpai', 'xinpai'],
  ] as const) {
    const prompt = formatBaziSchoolsPrompt(result, schools);
    assert.equal(
      prompt.match(/格局破格所忌：丁伤官（时柱）；伤官见官的救应明确不成立/g)?.length,
      1,
    );
    assert.equal(prompt.match(/当前成败判定：破格/g)?.length, 1);
    assert.equal(prompt.match(/^透干通根：/gm)?.length, 1);
    assert.doesNotMatch(prompt, /【格局条件】|取格分层候选：/);
  }
});

test('内嵌多派提示词共用通根事实，并省略排盘信息已有的月令、四柱和五行明细', () => {
  const result = getOrdinaryZhengyinResult();
  const prompt = buildBaziPrompt({ result, schools: ['ziping', 'mangpai', 'xinpai'] });

  assert.equal(prompt.match(/^透干通根：/gm)?.length, 1);
  assert.doesNotMatch(prompt, /^月令与节候：|^五行结构：|^天干十神/u);
  assert.doesNotMatch(prompt, /五行季节状态/u);
  assert.match(prompt, /月令司权:/);
  assert.match(prompt, /【四柱】/);
  assert.match(prompt, /【五行】/);
  assert.match(prompt, /四柱宫位参照：/);
  assert.match(prompt, /当前成败判定：成格/);
  for (const current of [
    prompt,
    buildBaziPrompt({ result, schools: ['xinpai', 'mangpai', 'ziping'] }),
    buildBaziPrompt({ result, schools: ['ziping', 'xinpai'] }),
    buildBaziPrompt({ result, schools: ['mangpai', 'xinpai'] }),
  ]) {
    assert.equal(current.match(/^(?:日主旺衰|旺衰判定)：/gm)?.length, 1);
    assert.equal(current.match(/得令是，通根有，强根无，帮扶可见，克泄耗可见/g)?.length, 1);
    assert.equal(current.match(/月令作用支持，司令作用生身，成局作用中性/g)?.length, 1);
    const tenGodLines = current
      .split('\n')
      .filter((line) => /^(?:十神显隐|十神结构)：/u.test(line));
    assert.deepEqual(
      tenGodLines.map((line) => line.slice(line.indexOf('：') + 1)),
      [
        '已见正官透藏并见（透1、藏1）、正印透藏并见（透1、藏1）、偏财仅藏（透0、藏2）、七杀仅藏（透0、藏2）、伤官透出（透1、藏0）、劫财仅藏（透0、藏1）、偏印仅藏（透0、藏1）；原局未见比肩、食神、正财',
      ],
    );
    assert.match(current, /喜忌落位：/);
    if (current.includes('八字流派：盲派') || current.includes('：盲派\n')) {
      assert.match(current, /主宾定位：主位为日柱癸酉与时柱戊午/);
    }
  }

  for (const schools of [
    ['ziping', 'mangpai', 'xinpai'],
    ['xinpai', 'mangpai', 'ziping'],
    ['mangpai', 'xinpai'],
  ] as const) {
    const standalone = formatBaziSchoolsPrompt(result, schools);
    assert.equal(standalone.match(/^格局与取用：/gm)?.length, 1);
    assert.equal(standalone.match(/^透干通根：/gm)?.length, 1);
    assert.equal(standalone.match(/原局格神作用：庚正印（年柱）/g)?.length, 1);
    assert.equal(standalone.match(/当前成败判定：成格/g)?.length, 1);
    assert.equal(standalone.match(/^取格依据：/gm)?.length, 1);
    if (schools.some((school) => school === 'ziping')) {
      assert.match(standalone, /^五行季节状态：/m);
      assert.match(standalone, /月令与节候：/);
    }
    if (schools.some((school) => school === 'mangpai'))
      assert.match(standalone, /主宾定位：主位为日柱癸酉/);
    if (schools.some((school) => school === 'xinpai')) assert.match(standalone, /旺衰判定：/);
  }
});

test('子平内嵌流派资料不重复核心判断已列的喜忌取用', () => {
  const result = createBaziResult({ year: 1993, month: 4, day: 8, timeIndex: 12 });
  for (const schools of [['ziping'] as const, ['ziping', 'mangpai', 'xinpai'] as const]) {
    const prompt = buildBaziPromptForResult({ result, schools });
    assert.match(prompt, /^取用: 主用木，辅水、火（正财、偏财）；忌土，次忌金/m);
    assert.equal(prompt.match(/^取用:/gm)?.length, 1);
    assert.equal(prompt.match(/^月令旺相:/gm)?.length, 1);
    assert.match(prompt, /^取用主线: 司令$/m);
    assert.doesNotMatch(prompt, /调候与取用：|取用理由司令/);
  }
  assert.match(formatBaziSchoolPrompt(result, 'ziping'), /调候与取用：/);

  const climateResult = createBaziResult({ year: 2012, month: 11, day: 15, timeIndex: 3 });
  for (const schools of [['ziping'] as const, ['ziping', 'mangpai', 'xinpai'] as const]) {
    const prompt = buildBaziPromptForResult({ result: climateResult, schools });
    assert.equal(prompt.match(/^取用主线: 调候$/gm)?.length, 1);
    assert.equal(prompt.match(/^取用:/gm)?.length, 1);
    assert.equal(prompt.match(/^月令旺相:/gm)?.length, 1);
  }
});

test('时辰未知的嵌入式单派和多派提示词共用一份候选资料', () => {
  const result = createBaziResult({ timeIndex: undefined, isThreePillars: true });
  const prompts = [
    { prompt: buildBaziPromptForResult({ result, school: 'ziping' }), schoolCount: 1 },
    { prompt: buildBaziPromptForResult({ result, schools: ['ziping'] }), schoolCount: 1 },
    {
      prompt: buildBaziPromptForResult({ result, schools: ['ziping', 'mangpai'] }),
      schoolCount: 2,
    },
  ];
  for (const { prompt, schoolCount } of prompts) {
    assert.equal(prompt.match(/出生时辰未知/g)?.length, 1);
    assert.equal(prompt.match(/^【时辰候选比较】$/gm)?.length, 1);
    assert.equal(prompt.match(/^出生时辰资料：/gm)?.length ?? 0, 0);
    assert.equal(prompt.match(/^已确定的柱作为基础资料/gm)?.length ?? 0, 0);
    assert.equal(prompt.match(/^本派盘面资料：/gm)?.length ?? 0, 0);
    assert.equal(
      prompt.match(/候选喜用/g)?.length,
      result.unknownTimeAnalysis?.scenarios.length ?? 0,
    );
    assert.equal(prompt.match(/^流派任务：/gm)?.length, schoolCount);
  }
  const standalonePrompt = formatBaziSchoolPrompt(result, 'ziping');
  assert.match(standalonePrompt, /出生时辰资料：/);
  assert.match(standalonePrompt, /候选场景（补时后复核）/);
  assert.doesNotMatch(formatBaziSchoolPrompt(result, 'ziping', true), /^流派盘面资料：$/m);
});

test('未知时辰完整盘与单页候选任务只依据已列候选及稳定干支', () => {
  for (const input of [
    { year: 2024, month: 2, day: 4, gender: 'female' as const },
    { year: 2000, month: 1, day: 7, gender: 'male' as const },
  ]) {
    const full = baziCalculator.calculateBazi(input);
    const page = baziCalculator.calculateBaziUnknownTimeBatch(input, { startIndex: 0 }).result;
    for (const [result, isPage] of [
      [full, false],
      [page, true],
    ] as const) {
      for (const prompt of [
        buildBaziPrompt({ result, topic: 'wealth' }),
        buildBaziPromptForResult({ result, topic: 'wealth' }),
      ]) {
        assert.equal(prompt.match(/^【时辰候选比较】$/gm)?.length ?? 0, isPage ? 0 : 1);
        assert.equal(prompt.match(/^【当前时辰候选：/gm)?.length ?? 0, isPage ? 1 : 0);
        assert.equal(
          prompt.match(/候选喜用/g)?.length,
          result.unknownTimeAnalysis?.scenarios.length,
        );
        assert.match(prompt, /【主题取用】\n[^\n]*结合所列时辰候选逐项分析/);
        assert.match(
          prompt,
          isPage
            ? /【任务】\n请依据本页所列出生时辰候选[^\n]*说明当前候选的旺衰、格局和取用依据/
            : /【任务】\n请依据已列出生时辰候选[^\n]*比较各候选共有与有别的旺衰、格局和取用条件/,
        );
        assert.doesNotMatch(prompt, /其余已列四柱|说明四柱原局|已列取格依据与格局成败/);
        assert.doesNotMatch(prompt, /【格局条件】/);
        if (input.year === 2024) {
          assert.doesNotMatch(prompt, /【已确定的柱】|^年柱：|^月柱：|^日柱：/m);
        } else {
          assert.match(prompt, /【已确定的柱】\n年柱：己卯\n月柱：丁丑/);
          assert.doesNotMatch(prompt, /^日柱：/m);
        }
      }
    }
  }
});

test('八字单盘空问题补通用问题，分类不再塞本地固定问题', () => {
  const result = getDefaultBaziResult();

  const prompt = buildPromptFromConfig(
    '',
    {
      id: 'ai-career',
      prompt: '测试',
      scopeLabel: '事业',
    },
    result,
    null,
    '事业',
    { isCustomQuestion: false },
  );

  assert.match(prompt.user, /【问题】\n请先做整体解读。/);
  assert.match(prompt.user, /【任务】\n请重点分析事业，并直接回答【问题】。/);
  assert.doesNotMatch(prompt.user, /若【问题】|按通用.*口径|问题未限定/);
  assert.doesNotMatch(prompt.user, /【问题】\n判断命局更适合守成/);
  assert.doesNotMatch(prompt.user, /【任务】\n判断命局更适合守成/);
});

test('八字提示词写入年限选择后应保留岁运资料并省略控制话术', () => {
  const result = getDefaultBaziResult();
  const fortuneContext = buildFortuneSelectionContext(result, {
    scope: 'year',
    cycleIndex: 0,
    year: 1990,
  });

  assert.ok(fortuneContext);

  const prompt = buildPromptFromConfig(
    '今年适合换工作吗？',
    {
      id: 'ai-job-change',
      prompt:
        '结合当前大运、流年、流月与命局主线，判断现在更适合留在原岗位、试探新机会、直接跳槽还是先蓄力转方向，并说明平台、收入、成长空间和短期风险的取舍重点。',
      scopeLabel: '换工作',
    },
    result,
    fortuneContext,
    '换工作',
    { isCustomQuestion: false },
  );

  assert.match(prompt.user, /【分析对象】/);
  assert.match(prompt.user, /【岁运重点】/);
  assert.match(prompt.user, /分析对象：\d{4}年流年/);
  assert.match(prompt.user, /选择日期：\d{4}年/);
  assert.match(prompt.user, /上层岁运：/);
  assert.match(prompt.user, /所选干支：/);
  assert.match(prompt.user, /岁运干支关系：/);
  assert.doesNotMatch(prompt.user, /该流年包含的流月/);
  assert.ok(prompt.user.includes(`结合当前所选岁运（${fortuneContext.promptPayload.scopeLabel}）`));
  assert.doesNotMatch(prompt.user, /undefined|NaN/);
  assert.doesNotMatch(prompt.user, /所属大运包含的流年/);
  assert.doesNotMatch(prompt.user, /结构化证据|【主证】|【辅证】|【限制】|【解读方法】|解读范围：/);
  assert.ok(prompt.user.indexOf('【分析对象】') < prompt.user.indexOf('【岁运重点】'));
  assert.ok(prompt.user.indexOf('【岁运重点】') < prompt.user.indexOf('【问题】'));
});

test('八字完整输出版会附加完整大运流年资料', () => {
  const result = getDefaultBaziResult();

  const prompt = buildPromptFromConfig(
    '整体事业阶段怎么判断？',
    { id: 'ai-job-change', prompt: '测试', scopeLabel: '换工作' },
    result,
    null,
    '换工作',
    { isCustomQuestion: false, fortuneScope: 'full' },
  );

  assert.match(prompt.user, /【分析对象】\n分析对象：本命盘与完整大运流年/);
  assert.match(prompt.user, /【命限资料】/);
  assert.match(prompt.user, /完整大运流年：/);
  assert.match(prompt.user, /大运｜\d+岁起｜/);
  assert.match(prompt.user, /\d{4}年\(\d+岁\).+/);
  assert.doesNotMatch(prompt.user, /详细命限资料|资料量|聚焦当前分析对象/);
});

test('八字流月提示词应突出所选日期范围并保留必要触发资料', () => {
  const result = getDefaultBaziResult();
  let fortuneContext = null;

  for (const [cycleIndex, cycle] of result.luckInfo.cycles.entries()) {
    for (const { year } of cycle.years) {
      for (let month = 1; month <= 12; month += 1) {
        fortuneContext = buildFortuneSelectionContext(result, {
          scope: 'month',
          cycleIndex,
          year,
          month,
        });
        if (fortuneContext) break;
      }
      if (fortuneContext) break;
    }
    if (fortuneContext) break;
  }

  assert.ok(fortuneContext);

  const prompt = buildPromptFromConfig(
    '这个月适合推进工作变化吗？',
    {
      id: 'ai-job-change',
      prompt: '测试',
      scopeLabel: '换工作',
    },
    result,
    fortuneContext,
    '换工作',
    { isCustomQuestion: false },
  );
  const fortuneSection = prompt.user.match(/【岁运重点】([\s\S]*?)\n\n【问题】/)?.[1] || '';

  assert.match(prompt.user, /【分析对象】\n分析对象：\d{4}年.+流月/);
  if (fortuneContext.promptPayload.summaryLines.some((line) => line.startsWith('本运有效时段：'))) {
    assert.match(fortuneSection, /本运有效时段：\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}至/);
  } else {
    assert.match(fortuneSection, /选择日期：\d{4}-\d{2}-\d{2} 至 \d{4}-\d{2}-\d{2}/);
  }
  assert.match(fortuneSection, /节气月：/);
  assert.match(fortuneSection, /上层岁运：/);
  assert.doesNotMatch(prompt.user, /该流月包含的流日/);
  assert.ok(prompt.user.includes(`结合当前所选岁运（${fortuneContext.promptPayload.scopeLabel}）`));
  assert.doesNotMatch(prompt.user, /undefined|NaN/);
  assert.doesNotMatch(prompt.user, /所属流年包含的流月/);
  assert.doesNotMatch(fortuneSection, /结构化证据|来源：|解释边界|断事层级限制/);
});

test('八字提示词未选择年限时输出本命资料且不输出岁运重点', () => {
  const result = getDefaultBaziResult();

  const prompt = buildPromptFromConfig(
    '请分析事业方向。',
    {
      id: 'ai-career',
      prompt:
        '判断命局更适合守成、开拓、技术、管理还是经营，再说明当前阶段的赚钱方式、职业方向和风险点。',
      scopeLabel: '事业',
    },
    result,
    null,
    '事业',
    { isCustomQuestion: false },
  );

  assert.match(prompt.user, /【分析对象】/);
  assert.match(prompt.user, /分析对象：本命盘/);
  assert.match(prompt.user, /旺衰: [^\n]+（[^\n]+）/);
  assert.match(prompt.user, /格局: [^\n]+（[^\n]+）/);
  assert.match(prompt.user, /取用主线:/);
  assert.doesNotMatch(prompt.user, /取用依据:/);
  assert.match(prompt.user, /【本命辅助】/);
  assert.match(prompt.user, /命宫:.+\| 身宫:.+\| 胎元:.+\| 胎息:/);
  assert.match(prompt.user, /十神构成（天干与藏干）:/);
  assert.match(prompt.user, /纳音:.+\| 自坐:.+\| 十二运:.+\| 旬空:/);
  assert.match(prompt.user, /神煞:/);
  assert.match(prompt.user, /【五行】/);
  assert.match(prompt.user, /司令五行:/);
  assert.doesNotMatch(prompt.user, /大运总览:|含\d{4}-\d{4}年流年|当前大运:|近年流年:/);
  assert.doesNotMatch(prompt.user, /【岁运重点】/);
  assert.doesNotMatch(prompt.user, /【解读方法】/);
  assert.doesNotMatch(prompt.user, /资料说明：|本次未指定|不得自行指定/);
});

test('八字提示词不应由五行百分比阈值自动生成病药结论', () => {
  const result = get1995MayMaleBaziResult();

  const prompt = buildPromptFromConfig(
    '请分析我的事业发展方向和风险。',
    { id: 'ai-career', prompt: '测试', scopeLabel: '事业' },
    result,
    null,
    '事业',
    { isCustomQuestion: false },
  );

  assert.match(prompt.user, /；忌水/);
  assert.doesNotMatch(prompt.user, /【五行结构】/);
  assert.doesNotMatch(prompt.user, /【病药法】/);
});

test('八字提示词不应把五行构成阈值包装为过强过弱病药断语', () => {
  const result = baziCalculator.calculateBazi({
    year: 1988,
    month: 1,
    day: 1,
    timeIndex: 0,
    gender: 'male',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  const prompt = buildPromptFromConfig(
    '请分析整体命局。',
    { id: 'ai-mingge-zonglun', prompt: '测试', scopeLabel: '通用' },
    result,
    null,
    '通用',
    { isCustomQuestion: false },
  );

  assert.match(prompt.user, /取用: 主用火，辅土、金.+；忌水/);
  assert.doesNotMatch(prompt.user, /【病药法】|过弱为病|过旺为病/);
});

test('八字提示词不写入经典格局强断语', () => {
  const result = baziCalculator.calculateBazi({
    year: 1988,
    month: 2,
    day: 7,
    timeIndex: 0,
    gender: 'male',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  const prompt = buildPromptFromConfig(
    '请分析整体命局。',
    { id: 'ai-mingge-zonglun', prompt: '测试', scopeLabel: '通用' },
    result,
    null,
    '通用',
    { isCustomQuestion: false },
  );

  assert.doesNotMatch(prompt.user, /【经典格局】|壬骑龙背格|主大富大贵/);
});

test('八字经典格局多选一条件应任一命中，不应要求全部同时成立', () => {
  const pillars = {
    year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    month: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
    day: { gan: '丁', zhi: '酉', ganZhi: '丁酉' },
    hour: { gan: '己', zhi: '丑', ganZhi: '己丑' },
  };
  const hiddenStems = {
    year: ['癸'],
    month: ['甲', '丙', '戊'],
    day: ['辛'],
    hour: ['己', '癸', '辛'],
  };

  assert.equal(identifyClassicPattern('丁', '寅', pillars, hiddenStems, '正印格')?.name, '日贵格');
});

test('八字经典格局应按古籍识别子午双包，并排除只有两个子的误报', () => {
  const twoZiOneWuPillars = {
    year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    month: { gan: '丙', zhi: '午', ganZhi: '丙午' },
    day: { gan: '甲', zhi: '辰', ganZhi: '甲辰' },
    hour: { gan: '壬', zhi: '子', ganZhi: '壬子' },
  };
  const onlyTwoZiPillars = {
    ...twoZiOneWuPillars,
    month: { gan: '丙', zhi: '申', ganZhi: '丙申' },
  };
  const ziWuBothPillars = {
    year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    month: { gan: '丙', zhi: '午', ganZhi: '丙午' },
    day: { gan: '甲', zhi: '午', ganZhi: '甲午' },
    hour: { gan: '壬', zhi: '子', ganZhi: '壬子' },
  };
  const hiddenStems = {
    year: ['癸'],
    month: ['丁', '己'],
    day: ['戊', '乙', '癸'],
    hour: ['癸'],
  };
  const ziWuHiddenStems = {
    ...hiddenStems,
    month: ['丁', '己'],
    day: ['丁', '己'],
  };

  assert.equal(
    identifyClassicPattern('甲', '午', twoZiOneWuPillars, hiddenStems, '正印格')?.name,
    '子午双包格',
  );
  assert.equal(
    identifyClassicPattern('甲', '午', ziWuBothPillars, ziWuHiddenStems, '偏财格')?.name,
    '子午双包格',
  );
  assert.notEqual(
    identifyClassicPattern('甲', '申', onlyTwoZiPillars, hiddenStems, '正印格')?.name,
    '子午双包格',
  );
});

test('八字经典外格应按古籍口径限制关键成格条件', () => {
  const emptyHiddenStems = {
    year: [],
    month: [],
    day: [],
    hour: [],
  };

  const jingLanCha = identifyClassicPattern(
    '庚',
    '子',
    {
      year: { gan: '甲', zhi: '申', ganZhi: '甲申' },
      month: { gan: '甲', zhi: '子', ganZhi: '甲子' },
      day: { gan: '庚', zhi: '辰', ganZhi: '庚辰' },
      hour: { gan: '辛', zhi: '卯', ganZhi: '辛卯' },
    },
    emptyHiddenStems,
    '正印格',
  );
  const renQiLong = identifyClassicPattern(
    '壬',
    '寅',
    {
      year: { gan: '甲', zhi: '辰', ganZhi: '甲辰' },
      month: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
      day: { gan: '壬', zhi: '辰', ganZhi: '壬辰' },
      hour: { gan: '庚', zhi: '申', ganZhi: '庚申' },
    },
    emptyHiddenStems,
    '正印格',
  );
  const feiTianLuMa = identifyClassicPattern(
    '庚',
    '寅',
    {
      year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
      month: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
      day: { gan: '庚', zhi: '子', ganZhi: '庚子' },
      hour: { gan: '甲', zhi: '辰', ganZhi: '甲辰' },
    },
    emptyHiddenStems,
    '正印格',
  );
  const oldFeiTianFalsePositive = identifyClassicPattern(
    '庚',
    '寅',
    {
      year: { gan: '甲', zhi: '申', ganZhi: '甲申' },
      month: { gan: '乙', zhi: '卯', ganZhi: '乙卯' },
      day: { gan: '庚', zhi: '寅', ganZhi: '庚寅' },
      hour: { gan: '丙', zhi: '子', ganZhi: '丙子' },
    },
    emptyHiddenStems,
    '正印格',
  );
  const singleChenRenFalsePositive = identifyClassicPattern(
    '壬',
    '寅',
    {
      year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
      month: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
      day: { gan: '壬', zhi: '辰', ganZhi: '壬辰' },
      hour: { gan: '庚', zhi: '申', ganZhi: '庚申' },
    },
    emptyHiddenStems,
    '正印格',
  );

  assert.equal(jingLanCha?.name, '井栏叉格');
  assert.equal(renQiLong?.name, '壬骑龙背格');
  assert.equal(feiTianLuMa?.name, '飞天禄马格');
  assert.notEqual(oldFeiTianFalsePositive?.name, '飞天禄马格');
  assert.notEqual(singleChenRenFalsePositive?.name, '壬骑龙背格');
});

test('八字经典格局提示词应保留福德秀气的成格边界，不输出统一强断', () => {
  const chartResult = {
    pillars: {
      year: { gan: '辛', zhi: '酉', ganZhi: '辛酉' },
      month: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
      day: { gan: '乙', zhi: '巳', ganZhi: '乙巳' },
      hour: { gan: '己', zhi: '丑', ganZhi: '己丑' },
    },
    hiddenStems: {
      year: ['辛'],
      month: ['甲', '丙', '戊'],
      day: ['丙', '戊', '庚'],
      hour: ['己', '癸', '辛'],
    },
    analysis: {
      mingGe: { pattern: '正印格', isSpecial: false },
    },
  };

  const section = generateEnhancedAnalysisSection(chartResult as any, 'general');

  assert.match(section, /【经典结构候选】福德秀气格（待核验；传统等级参考：中等，以成败条件裁定）/);
  assert.match(section, /巳酉丑三合金局仅三支齐全，未形成得令且无局外冲破的成势条件/);
  assert.match(section, /专取乙、丁、己、辛、癸五阴干/);
  assert.match(section, /各日干的成败与喜忌，仍按对应原局与岁运核定/);
  assert.doesNotMatch(section, /主一生福禄厚重|主人聪明智慧/);
});

test('八字提示词不展开内部取用脉络', () => {
  const result = baziCalculator.calculateBazi({
    year: 1988,
    month: 1,
    day: 7,
    timeIndex: 4,
    gender: 'male',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });
  assert.ok(result.analysis.usefulGod.strategyTrace);
  result.analysis.usefulGod.strategyTrace.push('运势警语:逢金水运反败');

  const prompt = buildPromptFromConfig(
    '请分析整体命局。',
    { id: 'ai-mingge-zonglun', prompt: '测试', scopeLabel: '通用' },
    result,
    null,
    '通用',
    { isCustomQuestion: false },
  );

  assert.doesNotMatch(prompt.user, /取用脉络:|调候优先:火 -> 水/);
  const finalUsefulGodTrace = result.analysis.usefulGod.strategyTrace.find((item) =>
    item.startsWith('最终取用:'),
  );
  assert.ok(finalUsefulGodTrace);
  assert.ok(!prompt.user.includes(finalUsefulGodTrace));
  assert.doesNotMatch(prompt.user, /成格层次:/);
  assert.doesNotMatch(prompt.user, /病药提示:/);
  assert.doesNotMatch(prompt.user, /运势警语:|逢金水运反败/);
  assert.doesNotMatch(prompt.user, /命中规则:/);
  assert.doesNotMatch(prompt.user, /贱而且贫/);

  assert.doesNotMatch(formatBaziForPrompt(result), /运势警语:|逢金水运反败/);
});

test('八字提示词在通关结论落入正式主忌时应隐藏通关法片段', () => {
  const result = baziCalculator.calculateBazi({
    year: 1988,
    month: 1,
    day: 8,
    timeIndex: 0,
    gender: 'male',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  const prompt = buildPromptFromConfig(
    '请分析整体命局。',
    { id: 'ai-mingge-zonglun', prompt: '测试', scopeLabel: '通用' },
    result,
    null,
    '通用',
    { isCustomQuestion: false },
  );

  assert.doesNotMatch(prompt.user, /【通关法】/);
  assert.doesNotMatch(prompt.user, /传统旁证:|传统互参:|因色生灾|因妻致富|因色破财/);
});

test('八字提示词不应由五行百分比阈值自动生成通关结论', () => {
  const result = baziCalculator.calculateBazi({
    year: 1988,
    month: 1,
    day: 3,
    timeIndex: 6,
    gender: 'male',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  const prompt = buildPromptFromConfig(
    '请分析整体命局。',
    { id: 'ai-mingge-zonglun', prompt: '测试', scopeLabel: '通用' },
    result,
    null,
    '通用',
    { isCustomQuestion: false },
  );

  assert.doesNotMatch(prompt.user, /【通关法】/);
});

test('婚恋提示词保留原局事实并省略重复详解', () => {
  const { result, prompt } = getMarriagePromptFixture();

  assert.equal(result.shensha.global?.some((name) => name.includes('桃花')) ?? false, false);
  assert.ok(result.shensha.month.includes('桃花'));
  assert.ok(result.shensha.hour.includes('桃花'));
  assert.doesNotMatch(prompt.user, /【桃花详解】|墙外桃花/);

  assert.match(prompt.user, /年柱丁与月柱壬合/);
  assert.match(prompt.user, /年柱卯与月柱子刑/);
  assert.doesNotMatch(
    prompt.user,
    /【干支相合条件】|逢冲破合，作用破合|非日干配合，只记相合，不作化气|合化评分/,
  );
});

test('八字提示词只在柱位标记空亡，不另起详解段', () => {
  const { result: withKongWang, prompt: withPrompt } = getMarriagePromptFixture();

  assert.match(withPrompt.user, /月柱:[^\n]*\(空亡\)/);
  assert.match(withPrompt.user, /时柱:[^\n]*\(空亡\)/);
  assert.doesNotMatch(withPrompt.user, /【空亡详解】/);

  const withoutKongWang = get1995MayMaleBaziResult();

  const withoutPrompt = buildPromptFromConfig(
    '请分析我的婚恋。',
    { id: 'ai-marriage', prompt: '测试', scopeLabel: '婚恋' },
    withoutKongWang,
    null,
    '婚恋',
    { isCustomQuestion: false },
  );

  assert.doesNotMatch(withoutPrompt.user, /【空亡详解】/);
});

test('八字提示词不应把问真年柱旬空口径展开为空亡详解', () => {
  const result = baziCalculator.calculateBazi({
    year: 1980,
    month: 1,
    day: 1,
    timeIndex: 0,
    gender: 'male',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  assert.deepEqual(result.kongWang.year, ['子', '丑']);
  assert.deepEqual(result.kongWang.day, ['戌', '亥']);
  assert.ok(result.shensha.month.includes('空亡'));
  assert.ok(result.shensha.hour.includes('空亡'));

  const prompt = buildPromptFromConfig(
    '请分析我的婚恋。',
    { id: 'ai-marriage', prompt: '测试', scopeLabel: '婚恋' },
    result,
    null,
    '婚恋',
    { isCustomQuestion: false },
  );

  assert.doesNotMatch(prompt.user, /【空亡详解】/);
  assert.doesNotMatch(prompt.user, /月柱:[^\n]*\(空亡\)|时柱:[^\n]*\(空亡\)/);

  assert.doesNotMatch(formatBaziForPrompt(result), /月柱:[^\n]*\(空亡\)|时柱:[^\n]*\(空亡\)/);
});

test('八字提示词保留原局同支关系且不重复展开段落', () => {
  const { result: withFuxin, prompt: withPrompt } = getMarriagePromptFixture();

  assert.match(withPrompt.user, /年柱与日柱地支同为卯/);
  assert.match(withPrompt.user, /月柱与时柱地支同为子/);
  assert.equal(withFuxin.pillarRelations.fuxin.length, 0);
  assert.ok(withFuxin.pillarRelations.sameBranch.length >= 2);
  assert.doesNotMatch(withPrompt.user, /【伏吟反吟】/);

  const withoutFuxin = baziCalculator.calculateBazi({
    year: 1988,
    month: 1,
    day: 7,
    timeIndex: 0,
    gender: 'male',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  const withoutPrompt = buildPromptFromConfig(
    '请分析我的婚恋。',
    { id: 'ai-marriage', prompt: '测试', scopeLabel: '婚恋' },
    withoutFuxin,
    null,
    '婚恋',
    { isCustomQuestion: false },
  );

  assert.doesNotMatch(withoutPrompt.user, /【伏吟反吟】/);
});

test('八字增强资料包不再按用户分类切换本地模板', () => {
  const { result } = getMarriagePromptFixture();

  const generalSection = generateEnhancedAnalysisSection(result, 'general');
  const healthSection = generateEnhancedAnalysisSection(result, 'health');
  const careerSection = generateEnhancedAnalysisSection(result, 'career');

  assert.equal(healthSection, generalSection);
  assert.equal(careerSection, generalSection);
  assert.match(generalSection, /【五行结构】出现：/);
  assert.match(generalSection, /结构比较优先：/);
  assert.doesNotMatch(generalSection, /月令旺衰权重|不代表概率|规则输入/);
  assert.doesNotMatch(healthSection, /【寿元分析】/);
  assert.doesNotMatch(careerSection, /【限运分析】/);

  const expectedDetails = {
    year: ['墙内桃花', '年柱、月柱', '年、月支桃花取园中之花之象。'],
    month: ['墙内桃花', '年柱、月柱', '年、月支桃花取园中之花之象。'],
    day: ['普通桃花', '日支（夫妻宫）', '日支桃花位于夫妻宫。'],
    hour: ['墙外桃花', '时柱', '时支桃花取墙外之花之象。'],
  } as const;
  for (const pillar of ['year', 'month', 'day', 'hour'] as const) {
    const detail = getPeachBlossomDetail(pillar);
    assert.deepEqual([detail.type, detail.position, detail.description], expectedDetails[pillar]);
    const original = { ...detail };
    try {
      detail.type = '普通桃花';
      detail.position = '变造位置';
      detail.description = '变造桃花依据';
      detail.favorable = '变造有利依据';
      detail.unfavorable = '变造不利依据';
      assert.deepEqual(getPeachBlossomDetail(pillar), original);
      assert.equal(generateEnhancedAnalysisSection(result, 'general'), generalSection);
    } finally {
      Object.assign(detail, original);
    }
  }
  assert.ok(generalSection.includes('月柱:墙内桃花 | 年、月支桃花取园中之花之象。'));
  assert.ok(generalSection.includes('时柱:墙外桃花 | 时支桃花取墙外之花之象。'));

  const allPillarPeach = {
    ...result,
    shensha: {
      ...structuredClone(result.shensha),
      year: ['桃花'],
      month: ['桃花'],
      day: ['桃花'],
      hour: ['桃花'],
    },
  };
  const allPillarSection = generateEnhancedAnalysisSection(allPillarPeach, 'general');
  assert.equal(
    allPillarSection.split('\n\n').find((section) => section.startsWith('【桃花详解】')),
    [
      '【桃花详解】命盘见桃花：年柱、月柱、日柱、时柱',
      '年柱:墙内桃花 | 年、月支桃花取园中之花之象。',
      '月柱:墙内桃花',
      '日柱:普通桃花 | 日支桃花位于夫妻宫。',
      '时柱:墙外桃花 | 时支桃花取墙外之花之象。',
    ].join('\n'),
  );
  assert.equal(generateEnhancedAnalysisSection(result, 'general'), generalSection);

  assert.equal(result.pillars.month.ganZhi, '壬子');
  assert.equal(result.pillars.hour.ganZhi, '丙子');
  assert.deepEqual(result.hiddenStems.month, ['癸']);
  assert.deepEqual(result.hiddenStems.hour, ['癸']);
  assert.notStrictEqual(result.hiddenStems.month, result.hiddenStems.hour);
  result.hiddenStems.month[0] = '甲';
  assert.deepEqual(result.hiddenStems.hour, ['癸']);
});

test('高风险旁证提示改为辅助研判框架，避免直接断语', () => {
  assert.match(generateAnalysisDimensionHints('fuxin'), /辅助观察/);
  assert.match(generateAnalysisDimensionHints('fuxin'), /不可脱离原局主线单独定吉凶/);

  assert.match(generateAnalysisDimensionHints('kongwang'), /只作旁证/);
  assert.match(generateAnalysisDimensionHints('kongwang'), /不可单凭空亡直接定吉凶/);
  assert.doesNotMatch(generateAnalysisDimensionHints('kongwang'), /祖上无缘/);

  assert.match(generateAnalysisDimensionHints('xingchong'), /不可见一项就直接下吉凶结论/);
  assert.doesNotMatch(generateAnalysisDimensionHints('xingchong'), /主变动拖延/);

  assert.match(generateAnalysisDimensionHints('lifespan'), /不得直接推断寿数/);
  assert.doesNotMatch(generateAnalysisDimensionHints('lifespan'), /晚年孤寂/);
});

test('合盘分类只作为关系范围，不再插入本地专项框架', () => {
  const { result1, result2 } = createCompatibilityBaziResults();

  const careerPrompt = getCompatibilityPrompt(
    '请分析我们适不适合长期合伙。',
    result1,
    result2,
    'career',
  );
  assert.doesNotMatch(careerPrompt.user, /【合盘分析思路】/);
  assert.match(careerPrompt.user, /【任务】\n关系范围：合伙。请依据双方盘面回答【问题】。/);
  assert.doesNotMatch(careerPrompt.user, /【输出要求】|现实建议/);

  const friendshipPrompt = getCompatibilityPrompt(
    '请分析我们两人的朋友相处模式。',
    result1,
    result2,
    'friendship',
  );
  assert.doesNotMatch(friendshipPrompt.user, /【合盘分析思路】|【友情往来】/);

  const childrenPrompt = getCompatibilityPrompt(
    '请分析我们的子女缘。',
    result1,
    result2,
    'children',
  );
  assert.doesNotMatch(childrenPrompt.user, /【合盘分析思路】|【子女缘分】/);
  assert.doesNotMatch(childrenPrompt.user, /【输出要求】|现实建议/);

  const parentsPrompt = getCompatibilityPrompt('请分析双方父母情况。', result1, result2, 'parents');
  assert.doesNotMatch(parentsPrompt.user, /【合盘分析思路】|【父母研判】/);
});

test('八字合盘自定义问题不拼接关系预设，只保留通用短框架', () => {
  const { result1, result2 } = createCompatibilityBaziResults();

  const prompt = getCompatibilityPrompt(
    '我们现在更适合继续推进合作，还是先保持距离？',
    result1,
    result2,
    'career',
    { isCustomQuestion: true },
  );

  assertPromptHasSingleRole(prompt.user, PROMPT_ROLE_TEXT['bazi-compatibility']);
  assert.match(prompt.user, /【问题】\n我们现在更适合继续推进合作，还是先保持距离？/);
  assert.doesNotMatch(prompt.user, /【合盘分析思路】/);
  assert.match(prompt.user, /【任务】\n请依据双方盘面和双盘关系资料回答【问题】。/);
  assertPromptHasAnswerFramework(prompt.user);
  assert.doesNotMatch(prompt.user, /【输出要求】/);
});
