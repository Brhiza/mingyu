import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPromptFromConfig, getCompatibilityPrompt } from '../src/utils/ai/aiPrompts';
import { baziCalculator } from '@core/bazi/baziCalculator';
import { formatBaziForPrompt as formatBaziForPromptLocal } from '@core/bazi/baziAnalysisFormatter';
import { buildFortuneSelectionContext } from '@core/bazi/fortuneSelection';
import { generateAnalysisDimensionHints } from '@core/bazi/baziEnhancement';
import { formatBaziForPrompt as formatBaziForPromptCore } from '../packages/core/src/bazi/baziAnalysisFormatter';
import { identifyClassicPattern as identifyClassicPatternCore } from '../packages/core/src/bazi/baziEnhancement/classicPatterns';
import { identifyClassicPattern as identifyClassicPatternLocal } from '@core/bazi/baziEnhancement/classicPatterns';
import { generateEnhancedAnalysisSection } from '@core/bazi/baziPromptEnhancement';
import { PROMPT_GUIDANCE_TEXT as PROMPT_ROLE_TEXT } from '../src/lib/prompt-guidance';
import { assertPromptHasSingleRole } from './prompt-assertions';

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
  assert.match(prompt.user, /日主关系：/);
  assert.match(prompt.user, /【任务】\n关系范围：合伙。请依据双方盘面回答【问题】。/);
  assert.doesNotMatch(prompt.user, /结构化证据|证据边界|不得编造|只基于/);
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
  assert.match(prompt.user, /主要触发：/);
  assert.doesNotMatch(prompt.user, /所属大运包含的流年|该流年包含的流月|交下节/);
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
  assert.match(prompt.user, /\d+\. .+：\d{4}年起，约\d+岁交运/);
  assert.match(prompt.user, /  - \d{4}年（\d+岁）.+/);
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
  assert.doesNotMatch(prompt.user, /所属流年包含的流月|该流月包含的流日/);
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

  assert.match(prompt.user, /；忌火/);
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

  assert.match(prompt.user, /取用: 主用火，辅水、土、金.+；忌木/);
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

  assert.match(section, /【经典格局】福德秀气格（传统等级参考：中等，以成败条件裁定）/);
  assert.match(section, /专取乙、丁、己、辛、癸五阴干/);
  assert.match(section, /只识别共同结构，不统一强断/);
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

test('八字提示词不默认展开伏吟反吟段', () => {
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

  assert.doesNotMatch(withPrompt.user, /【伏吟反吟】|年柱与日柱地支同为卯|月柱与时柱地支同为子/);

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

test('八字提示词不展开可由四柱复核的刑冲合会破清单', () => {
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

  assert.doesNotMatch(prompt.user, /【刑冲合会破】|年柱丁与月柱壬合|年柱卯与月柱子刑/);
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

test('八字合盘自定义问题不应额外拼接框架任务书', () => {
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
  assert.doesNotMatch(prompt.user, /【任务】/);
  assert.doesNotMatch(prompt.user, /【输出要求】/);
});
