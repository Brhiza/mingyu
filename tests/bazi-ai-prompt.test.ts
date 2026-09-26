import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPromptFromConfig, getCompatibilityPrompt } from '../src/utils/ai/aiPrompts';
import { formatBaziCompatibilityFacts } from '../src/lib/bazi-compatibility-facts';
import { baziCalculator } from '@core/bazi/baziCalculator';
import { formatBaziForPrompt as formatBaziForPromptLocal } from '@core/bazi/baziAnalysisFormatter';
import { buildFortuneSelectionContext } from '@core/bazi/fortuneSelection';
import { generateAnalysisDimensionHints } from '@core/bazi/baziEnhancement';
import { formatBaziForPrompt as formatBaziForPromptCore } from '../packages/core/src/bazi/baziAnalysisFormatter';
import { identifyClassicPattern as identifyClassicPatternCore } from '../packages/core/src/bazi/baziEnhancement/classicPatterns';
import { identifyClassicPattern as identifyClassicPatternLocal } from '@core/bazi/baziEnhancement/classicPatterns';
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

function createCompatibilityBaziResults() {
  return {
    result1: createBaziResult({
      year: 1988,
      month: 1,
      day: 1,
      timeIndex: 0,
      gender: 'female',
    }),
    result2: createBaziResult({
      year: 1990,
      month: 6,
      day: 15,
      timeIndex: 5,
      gender: 'male',
    }),
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
});

test('八字合盘喜忌覆盖不复述已在个人盘面呈现的功能事实', () => {
  const result1 = createBaziResult({ year: 1990, month: 9, day: 5, timeIndex: 6 });
  const result2 = createBaziResult({ year: 2013, month: 9, day: 25, timeIndex: 3 });
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

test('八字紫微合参只复用双方关系事实，不嵌套整份八字合盘任务书', () => {
  const { result1, result2 } = createCompatibilityBaziResults();
  const facts = formatBaziCompatibilityFacts(result1, result2);
  const prompt = getCompatibilityPrompt('双方如何协作？', result1, result2, 'career');

  assert.match(facts, /日主关系：|四柱关系：/);
  assert.ok(prompt.user.includes(`【双盘关系资料】\n${facts}`));
  assert.doesNotMatch(facts, /【第一人排盘信息】|【第二人排盘信息】|【任务】|【问题】/);
});

test('八字输出提示词应是可复制给在线 AI 的独立任务书，不暴露工程提示词', () => {
  const result = createBaziResult({
    year: 1990,
    month: 6,
    day: 15,
    timeIndex: 5,
    gender: 'male',
  });
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

test('普通成格提示词保留结论并省略重复的格局条件', () => {
  const result = createBaziResult({ year: 1990, month: 9, day: 5, timeIndex: 6 });
  assert.equal(result.analysis.mingGe.fulfillment?.status, '成格');
  assert.equal(formatBaziPatternConditions(result), '');

  const prompt = buildBaziPrompt({ result, fortuneScope: 'natal' });
  assert.match(prompt, /格局: 正印格/);
  assert.match(prompt, /^当前成败判定：成格/m);
  assert.doesNotMatch(prompt, /所取格局：/);
  assert.doesNotMatch(prompt, /【格局条件】|取格分层候选：正印格|候选取用：/);
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
  const result = createBaziResult({
    year: 1993,
    month: 4,
    day: 8,
    timeIndex: 12,
    birthPlace: '新加坡',
  });
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

test('独立流派资料中的选中取格依据和其他候选各出现一次', () => {
  const result = createBaziResult({
    year: 1993,
    month: 4,
    day: 8,
    timeIndex: 12,
    birthPlace: '新加坡',
  });
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
});

test('已成化格保留结论与取用，省略重复的逐项核验', () => {
  const result = createBaziResult({ year: 1994, month: 3, day: 17, timeIndex: 4 });
  assert.equal(result.analysis.mingGe.transformation?.status, '成化');

  for (const school of [undefined, 'ziping' as const]) {
    const prompt = buildBaziPrompt({ result, fortuneScope: 'natal', school });
    assert.match(prompt, /格局: 丁壬化木格[^\n]*化气判定：成化/);
    assert.match(prompt, /化神取用：[^\n]*化神木/);
    assert.doesNotMatch(prompt, /【格局条件】|取用条件：|化气证据：/);
  }
});

test('成化状态在合盘与多派提示词只呈现一次', () => {
  const formed = createBaziResult({ year: 1994, month: 3, day: 17, timeIndex: 4 });
  const other = createBaziResult({ year: 1990, month: 9, day: 5, timeIndex: 6 });

  for (const prompt of [
    getCompatibilityPrompt('请分析双方关系。', formed, other).user,
    buildBaziCompatibilityPrompt({ result1: formed, result2: other }),
  ]) {
    assert.equal(prompt.match(/化气判定：成化/g)?.length, 1);
    assert.match(prompt, /化神取用：[^\n]*化神木/);
    assert.match(prompt, /喜忌(?:覆盖|五行对应)：第二人盘面命中第一人喜用五行木、水/);
    const relationFacts = prompt.split('【双盘关系资料】')[1] ?? '';
    assert.doesNotMatch(relationFacts, /化气判定：成化|取用主体：化神木/);
  }
  assert.match(
    buildBaziCompatibilityPrompt({ result1: formed, result2: other }),
    /化气判定：存在反证/,
  );

  for (const build of [buildBaziPrompt, buildBaziPromptForResult]) {
    const prompt = build({ result: formed, schools: ['ziping', 'mangpai'] });
    assert.equal(prompt.match(/化气判定：成化/g)?.length, 1);
    assert.match(prompt, /共同格局事实：\n化神木；依据《子平真诠/);
  }
});

test('流派格局资料只保留本盘成败理由与实际旺衰事实', () => {
  const formed = createBaziResult({ year: 1990, month: 9, day: 5, timeIndex: 6 });
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
  const result = createBaziResult({ year: 2013, month: 9, day: 25, timeIndex: 3 });
  assert.equal(result.analysis.mingGe.fulfillment?.status, '破格');

  const conditions = formatBaziPatternConditions(result);
  assert.equal(conditions, '');
  const prompt = buildBaziPrompt({ result, fortuneScope: 'natal' });
  assert.match(prompt, /当前成败判定：破格/);
  assert.match(prompt, /格局破格所忌：丁伤官（时柱）；伤官见官的救应明确不成立/);
  assert.doesNotMatch(prompt, /【格局条件】/);

  result.analysis.usefulGod.decisionEvidence!.patternBreakerRestrictions = [];
  assert.match(formatBaziPatternConditions(result), /破格项：伤官见官/);
});

test('格神前提未满足时不附加救应条件，从儿格只写已成立的五行流向', () => {
  const uncertain = createBaziResult({ year: 1980, month: 1, day: 3, timeIndex: 0 });
  const uncertainConditions = formatBaziPatternConditions(uncertain);
  assert.equal(uncertainConditions, '');

  const conger = createBaziResult({ year: 1980, month: 5, day: 3, timeIndex: 0 });
  for (const prompt of [
    buildBaziPrompt({ result: conger }),
    buildBaziPrompt({ result: conger, schools: ['ziping', 'mangpai'] }),
  ]) {
    assert.doesNotMatch(prompt, /支藏印官未构成从儿格的实际反证/);
    assert.match(prompt, /从儿五行流向：/);
    assert.doesNotMatch(prompt, /原支藏印官事实：/);
    assert.match(prompt, /年柱: 庚申[^\n]*[\s\S]*藏干: [^\n]*壬\[七杀\]/);
  }
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

test('格神已成立时保留实际破格干和已成立的救应作用', () => {
  const repaired = createBaziResult({ year: 2016, month: 3, day: 17, timeIndex: 3 });
  assert.equal(repaired.analysis.mingGe.fulfillment?.status, '破而复成');
  const conditions = formatBaziPatternConditions(repaired);
  assert.ok(conditions.includes('破格项：伤官见官（辛伤官（月柱））'));
  assert.doesNotMatch(conditions, /救应路径：印星制伤官护官/);
  assert.doesNotMatch(conditions, /资料不足|不满足|仅见隔位/);
  const prompt = buildBaziPrompt({ result: repaired });
  assert.ok(prompt.includes(`【格局条件】\n${conditions}`));
  assert.equal(prompt.match(/印星制伤官护官；丙作用于辛/g)?.length, 1);
  assert.doesNotMatch(prompt, /救应路径：印星制伤官护官/);

  repaired.analysis.usefulGod.decisionEvidence!.controlFunctions = [];
  assert.match(formatBaziPatternConditions(repaired), /救应路径：印星制伤官护官/);

  const broken = createBaziResult({ year: 2013, month: 9, day: 25, timeIndex: 3 });
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
  const result = createBaziResult({ year: 2013, month: 9, day: 25, timeIndex: 3 });
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
});

test('时辰未知的多派提示词保留候选资料', () => {
  const result = createBaziResult({ timeIndex: undefined, isThreePillars: true });
  const prompt = buildBaziPromptForResult({ result, schools: ['ziping', 'mangpai'] });
  assert.match(prompt, /出生时辰未知/);
  assert.match(prompt, /时辰候选/);
});

test('八字单盘空问题补通用问题，分类不再塞本地固定问题', () => {
  const result = createBaziResult();

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
  const result = createBaziResult();
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
  const result = createBaziResult();

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
  const result = createBaziResult();
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
  assert.match(fortuneSection, /选择日期：\d{4}-\d{2}-\d{2} 至 \d{4}-\d{2}-\d{2}/);
  assert.match(fortuneSection, /节气月：/);
  assert.match(fortuneSection, /上层岁运：/);
  assert.doesNotMatch(prompt.user, /该流月包含的流日/);
  assert.ok(prompt.user.includes(`结合当前所选岁运（${fortuneContext.promptPayload.scopeLabel}）`));
  assert.doesNotMatch(prompt.user, /undefined|NaN/);
  assert.doesNotMatch(prompt.user, /所属流年包含的流月/);
  assert.doesNotMatch(fortuneSection, /结构化证据|来源：|解释边界|断事层级限制/);
});

test('八字提示词未选择年限时输出本命资料且不输出岁运重点', () => {
  const result = createBaziResult();

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
  assert.match(prompt.user, /取用依据:/);
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

test('合盘提示词不应误要求使用单盘核心用神句式', () => {
  const { result1, result2 } = createCompatibilityBaziResults();

  const prompt = getCompatibilityPrompt('请分析我们适不适合长期合伙。', result1, result2, 'career');

  assert.doesNotMatch(prompt.system, /核心用神：……，辅助喜用：……，主忌：……/);
});

test('八字合盘内嵌命盘资料不应重复使用顶层 section 标题', () => {
  const { result1, result2 } = createCompatibilityBaziResults();

  const prompt = getCompatibilityPrompt('请分析我们适不适合长期合伙。', result1, result2, 'career');

  assert.equal((prompt.user.match(/^【第一人排盘信息】$/gm) ?? []).length, 1);
  assert.equal((prompt.user.match(/^【第二人排盘信息】$/gm) ?? []).length, 1);
  assert.doesNotMatch(prompt.user, /^【命盘】$/m);
  assert.doesNotMatch(prompt.user, /^【核心判断】$/m);
  assert.doesNotMatch(prompt.user, /^【四柱】$/m);
  assert.match(prompt.user, /命盘：\n/);
  assert.match(prompt.user, /核心判断：\n/);
  assert.match(prompt.user, /四柱：\n/);
});

test('八字提示词不应由五行百分比阈值自动生成病药结论', () => {
  const result = baziCalculator.calculateBazi({
    year: 1995,
    month: 5,
    day: 20,
    timeIndex: 5,
    gender: 'male',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

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

test('八字提示词不再附加经典格局长段', () => {
  const result = baziCalculator.calculateBazi({
    year: 1990,
    month: 1,
    day: 1,
    timeIndex: 3,
    gender: 'female',
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

  assert.doesNotMatch(prompt.user, /【经典格局】/);
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

  assert.equal(
    identifyClassicPatternLocal('丁', '寅', pillars, hiddenStems, '正印格')?.name,
    '日贵格',
  );
  assert.equal(
    identifyClassicPatternCore('丁', '寅', pillars, hiddenStems, '正印格')?.name,
    '日贵格',
  );
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

  for (const identifyClassicPattern of [identifyClassicPatternLocal, identifyClassicPatternCore]) {
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
  }
});

test('八字经典外格应按古籍口径限制关键成格条件', () => {
  const emptyHiddenStems = {
    year: [],
    month: [],
    day: [],
    hour: [],
  };

  for (const identifyClassicPattern of [identifyClassicPatternLocal, identifyClassicPatternCore]) {
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
  }
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

  assert.match(
    section,
    /【经典结构候选】福德秀气格（结构命中；传统等级参考：中等，以成败条件裁定）/,
  );
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

  const localFormatted = formatBaziForPromptLocal(result);
  const coreFormatted = formatBaziForPromptCore(result as any);
  assert.doesNotMatch(localFormatted, /运势警语:|逢金水运反败/);
  assert.doesNotMatch(coreFormatted, /运势警语:|逢金水运反败/);
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

test('八字提示词不默认展开桃花神煞详解', () => {
  const result = baziCalculator.calculateBazi({
    year: 1988,
    month: 1,
    day: 1,
    timeIndex: 0,
    gender: 'female',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  assert.equal(result.shensha.global?.some((name) => name.includes('桃花')) ?? false, false);
  assert.ok(result.shensha.month.includes('桃花'));
  assert.ok(result.shensha.hour.includes('桃花'));

  const prompt = buildPromptFromConfig(
    '请分析我的婚恋。',
    { id: 'ai-marriage', prompt: '测试', scopeLabel: '婚恋' },
    result,
    null,
    '婚恋',
    { isCustomQuestion: false },
  );

  assert.doesNotMatch(prompt.user, /【桃花详解】|墙外桃花/);
});

test('八字提示词只在柱位标记空亡，不另起详解段', () => {
  const withKongWang = baziCalculator.calculateBazi({
    year: 1988,
    month: 1,
    day: 1,
    timeIndex: 0,
    gender: 'female',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  const withPrompt = buildPromptFromConfig(
    '请分析我的婚恋。',
    { id: 'ai-marriage', prompt: '测试', scopeLabel: '婚恋' },
    withKongWang,
    null,
    '婚恋',
    { isCustomQuestion: false },
  );

  assert.match(withPrompt.user, /月柱:[^\n]*\(空亡\)/);
  assert.match(withPrompt.user, /时柱:[^\n]*\(空亡\)/);
  assert.doesNotMatch(withPrompt.user, /【空亡详解】/);

  const withoutKongWang = baziCalculator.calculateBazi({
    year: 1995,
    month: 5,
    day: 20,
    timeIndex: 5,
    gender: 'male',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

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

  const localFormatted = formatBaziForPromptLocal(result);
  const coreFormatted = formatBaziForPromptCore(result as any);
  assert.doesNotMatch(localFormatted, /月柱:[^\n]*\(空亡\)|时柱:[^\n]*\(空亡\)/);
  assert.doesNotMatch(coreFormatted, /月柱:[^\n]*\(空亡\)|时柱:[^\n]*\(空亡\)/);
});

test('八字提示词保留原局同支关系且不重复展开段落', () => {
  const withFuxin = baziCalculator.calculateBazi({
    year: 1988,
    month: 1,
    day: 1,
    timeIndex: 0,
    gender: 'female',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  const withPrompt = buildPromptFromConfig(
    '请分析我的婚恋。',
    { id: 'ai-marriage', prompt: '测试', scopeLabel: '婚恋' },
    withFuxin,
    null,
    '婚恋',
    { isCustomQuestion: false },
  );

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

test('八字提示词保留原局刑冲合会破事实', () => {
  const result = baziCalculator.calculateBazi({
    year: 1988,
    month: 1,
    day: 1,
    timeIndex: 0,
    gender: 'female',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  const prompt = buildPromptFromConfig(
    '请分析我的婚恋。',
    { id: 'ai-marriage', prompt: '测试', scopeLabel: '婚恋' },
    result,
    null,
    '婚恋',
    { isCustomQuestion: false },
  );

  assert.match(prompt.user, /年柱丁与月柱壬合/);
  assert.match(prompt.user, /年柱卯与月柱子刑/);
});

test('八字提示词不展开内部相合成化判定过程', () => {
  const result = baziCalculator.calculateBazi({
    year: 1988,
    month: 1,
    day: 1,
    timeIndex: 0,
    gender: 'female',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  const prompt = buildPromptFromConfig(
    '请分析我的婚恋。',
    { id: 'ai-marriage', prompt: '测试', scopeLabel: '婚恋' },
    result,
    null,
    '婚恋',
    { isCustomQuestion: false },
  );

  assert.doesNotMatch(
    prompt.user,
    /【干支相合条件】|逢冲破合，作用破合|非日干配合，只记相合，不作化气|合化评分/,
  );
});

test('八字增强资料包不再按用户分类切换本地模板', () => {
  const result = baziCalculator.calculateBazi({
    year: 1988,
    month: 1,
    day: 1,
    timeIndex: 0,
    gender: 'female',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

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
