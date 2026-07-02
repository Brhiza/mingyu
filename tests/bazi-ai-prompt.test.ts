import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPromptFromConfig,
  getCompatibilityPrompt,
  resolveBaziQuestionScene,
} from '../src/utils/ai/aiPrompts';
import { baziCalculator } from '../src/utils/bazi/baziCalculator';
import { formatBaziForPrompt as formatBaziForPromptLocal } from '../src/utils/bazi/baziAnalysisFormatter';
import { buildFortuneSelectionContext } from '../src/utils/bazi/fortuneSelection';
import {
  generateAnalysisDimensionHints,
  generateCareerPartnershipHints,
  generateChildrenFateHints,
  generateFriendshipHints,
  generateMarriageMatchHints,
  generateParentsAnalysisHints,
  generateSiblingsAnalysisHints,
} from '../src/utils/bazi/baziEnhancement';
import { formatBaziForPrompt as formatBaziForPromptCore } from '../packages/core/src/bazi/baziAnalysisFormatter';
import { identifyClassicPattern as identifyClassicPatternCore } from '../packages/core/src/bazi/baziEnhancement/classicPatterns';
import { identifyClassicPattern as identifyClassicPatternLocal } from '../src/utils/bazi/baziEnhancement/classicPatterns';
import { generateEnhancedAnalysisSection } from '../src/utils/bazi/baziPromptEnhancement';

function assertNoEngineeringPromptText(prompt: string) {
  assert.doesNotMatch(prompt, /当前项目|本地算法|技术限制|未计算|资料包|提示词规则/);
  assert.doesNotMatch(prompt, /当前已写入|当前未写入|未写入/);
}

test('八字合盘系统提示词应使用专门的双盘规则，不混入单盘要求', () => {
  const result1 = baziCalculator.calculateBazi({
    year: 1988,
    month: 1,
    day: 1,
    timeIndex: 0,
    gender: 'female',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });
  const result2 = baziCalculator.calculateBazi({
    year: 1990,
    month: 6,
    day: 15,
    timeIndex: 5,
    gender: 'male',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  const prompt = getCompatibilityPrompt('请分析我们适不适合长期合伙。', result1, result2, 'career');

  assert.match(prompt.system, /只基于提供的双方命盘、岁运和问题作答/);
  assert.match(
    prompt.system,
    /双盘先分别判断旺衰、格局、调候和用忌，再汇总双方互动主线、互补点、冲突点、现实压力和建议/,
  );
  assert.match(prompt.system, /关系结论若与双方命局主线或岁运节奏不一致，必须指出冲突点/);
  assert.match(prompt.system, /不得编造已提供资料没有给出的新盘面事实/);
  assert.match(prompt.system, /允许基于双方已提供资料做传统八字推理/);
  assert.doesNotMatch(prompt.system, /说清核心用神、辅助喜用与主忌/);
  assert.equal((prompt.system.match(/信息不足时说明证据不足/g) || []).length, 1);
});

test('八字输出提示词应是可复制给在线 AI 的独立任务书，不暴露工程提示词', () => {
  const result = baziCalculator.calculateBazi({
    year: 1990,
    month: 6,
    day: 15,
    timeIndex: 5,
    gender: 'male',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });
  const prompt = buildPromptFromConfig(
    '请分析事业方向。',
    { id: 'ai-career', prompt: '测试', scene: 'career' },
    result,
  );
  const combinedPrompt = `${prompt.system}\n\n${prompt.user}`;

  assertNoEngineeringPromptText(combinedPrompt);
});

test('八字问题场景只由内置快捷配置提供，不再根据问题文本自动猜测', () => {
  assert.equal(resolveBaziQuestionScene('general'), 'general');
  assert.equal(resolveBaziQuestionScene('recent'), 'recent');
  assert.equal(resolveBaziQuestionScene('marriage'), 'marriage');
  assert.equal(resolveBaziQuestionScene(undefined), 'general');
  assert.equal(resolveBaziQuestionScene('未知类型'), 'general');
});

test('八字单盘空问题会按所选方向补默认问题，不把内置任务塞进问题栏', () => {
  const result = baziCalculator.calculateBazi({
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 1,
    gender: 'male',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  const prompt = buildPromptFromConfig(
    '',
    {
      id: 'ai-career',
      prompt:
        '判断命局更适合守成、开拓、技术、管理还是经营，再说明当前阶段的赚钱方式、职业方向和风险点。',
      scene: 'career',
    },
    result,
    null,
    'career',
    { isCustomQuestion: false },
  );

  assert.match(prompt.user, /【问题】\n请先从事业方向、工作模式和当前风险开始分析。/);
  assert.match(
    prompt.user,
    /【任务】\n判断命局更适合守成、开拓、技术、管理还是经营，再说明当前阶段的赚钱方式、职业方向和风险点。/,
  );
  assert.doesNotMatch(prompt.user, /【问题】\n判断命局更适合守成、开拓、技术、管理还是经营/);
});

test('八字提示词写入年限选择后应补充完整岁运任务书', () => {
  const result = baziCalculator.calculateBazi({
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 1,
    gender: 'male',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });
  const fortuneContext = buildFortuneSelectionContext(result, {
    scope: 'year',
    cycleIndex: 0,
  });

  assert.ok(fortuneContext);

  const prompt = buildPromptFromConfig(
    '今年适合换工作吗？',
    {
      id: 'ai-job-change',
      prompt:
        '结合当前大运、流年、流月与命局主线，判断现在更适合留在原岗位、试探新机会、直接跳槽还是先蓄力转方向，并说明平台、收入、成长空间和短期风险的取舍重点。',
      scene: 'job-change',
    },
    result,
    fortuneContext,
    'job-change',
    { isCustomQuestion: false },
  );

  assert.match(prompt.user, /【分析对象】/);
  assert.match(prompt.user, /【岁运重点】/);
  assert.match(prompt.user, /已选对象：\d{4}年流年/);
  assert.match(prompt.user, /选择日期：\d{4}年/);
  assert.match(prompt.user, /上层岁运：/);
  assert.match(prompt.user, /所选干支：/);
  assert.match(prompt.user, /主要触发：/);
  assert.match(prompt.user, /解读范围：重点判断这一年的年度触发/);
  assert.doesNotMatch(prompt.user, /【主证】|【辅证】|【限制】|来源：|标签：/);
  assert.match(prompt.user, /所属大运包含的流年/);
  assert.match(prompt.user, /该流年包含的流月/);
  assert.match(prompt.user, /交下节/);
  assert.match(prompt.user, /【解读方法】/);
  assert.match(prompt.user, /当前已选流年：回答以该年年度触发为主，必须承接所属大运背景/);
  assert.match(prompt.user, /大运层：看十年阶段的环境、身份、资源、压力和机会方向/);
  assert.match(prompt.user, /流月层：看月份窗口、推进节奏、临门一脚和短期反复/);
  assert.match(prompt.user, /流日层：看当日执行、沟通、签约、出行、冲突和避险/);
  assert.ok(prompt.user.indexOf('【分析对象】') < prompt.user.indexOf('【岁运重点】'));
  assert.ok(prompt.user.indexOf('【岁运重点】') < prompt.user.indexOf('【解读方法】'));
  assert.ok(prompt.user.indexOf('【解读方法】') < prompt.user.indexOf('【解读范围】'));
});

test('八字流月提示词应突出所选日期范围且不输出证据调试字段', () => {
  const result = baziCalculator.calculateBazi({
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 1,
    gender: 'male',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });
  const fortuneContext = buildFortuneSelectionContext(result, {
    scope: 'month',
    cycleIndex: 0,
    year: 1990,
    month: 1,
  });

  assert.ok(fortuneContext);

  const prompt = buildPromptFromConfig(
    '这个月适合推进工作变化吗？',
    {
      id: 'ai-job-change',
      prompt: '测试',
      scene: 'job-change',
    },
    result,
    fortuneContext,
    'job-change',
    { isCustomQuestion: false },
  );
  const fortuneSection = prompt.user.match(/【岁运重点】([\s\S]*?)\n\n【解读方法】/)?.[1] || '';

  assert.match(fortuneSection, /已选对象：\d{4}年.+流月/);
  assert.match(fortuneSection, /选择日期：\d{4}-\d{2}-\d{2} 至 \d{4}-\d{2}-\d{2}/);
  assert.match(fortuneSection, /节气月：/);
  assert.match(fortuneSection, /上层岁运：/);
  assert.match(fortuneSection, /解读范围：重点判断这个节气月窗口/);
  assert.match(prompt.user, /所属流年包含的流月/);
  assert.match(prompt.user, /该流月包含的流日/);
  assert.match(prompt.user, /\d{4}-\d{2}-\d{2} .+｜十神/);
  assert.doesNotMatch(fortuneSection, /【主证】|来源：|标签：|断事层级限制/);
});

test('八字提示词未选择年限时输出本命独立任务书且不输出岁运重点', () => {
  const result = baziCalculator.calculateBazi({
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 1,
    gender: 'male',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  const prompt = buildPromptFromConfig(
    '请分析事业方向。',
    {
      id: 'ai-career',
      prompt:
        '判断命局更适合守成、开拓、技术、管理还是经营，再说明当前阶段的赚钱方式、职业方向和风险点。',
      scene: 'career',
    },
    result,
    null,
    'career',
    { isCustomQuestion: false },
  );

  assert.match(prompt.user, /【分析对象】/);
  assert.match(prompt.user, /分析对象：本命盘/);
  assert.match(prompt.user, /资料说明：本次没有提供具体大运、流年、流月、流日/);
  assert.match(prompt.user, /本次只提供本命盘，没有提供具体大运、流年、流月、流日/);
  assert.match(prompt.user, /问题.*具体年份、月份、日期或年龄/);
  assert.doesNotMatch(prompt.user, /【岁运重点】/);
  assert.doesNotMatch(prompt.user, /【解读方法】/);
});

test('合盘提示词不应误要求使用单盘核心用神句式', () => {
  const result1 = baziCalculator.calculateBazi({
    year: 1988,
    month: 1,
    day: 1,
    timeIndex: 0,
    gender: 'female',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });
  const result2 = baziCalculator.calculateBazi({
    year: 1990,
    month: 6,
    day: 15,
    timeIndex: 5,
    gender: 'male',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  const prompt = getCompatibilityPrompt('请分析我们适不适合长期合伙。', result1, result2, 'career');

  assert.doesNotMatch(prompt.system, /核心用神：……，辅助喜用：……，主忌：……/);
});

test('八字合盘内嵌命盘资料不应重复使用顶层 section 标题', () => {
  const result1 = baziCalculator.calculateBazi({
    year: 1988,
    month: 1,
    day: 1,
    timeIndex: 0,
    gender: 'female',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });
  const result2 = baziCalculator.calculateBazi({
    year: 1990,
    month: 6,
    day: 15,
    timeIndex: 5,
    gender: 'male',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  const prompt = getCompatibilityPrompt('请分析我们适不适合长期合伙。', result1, result2, 'career');

  assert.equal((prompt.user.match(/^【第一人排盘信息】$/gm) ?? []).length, 1);
  assert.equal((prompt.user.match(/^【第二人排盘信息】$/gm) ?? []).length, 1);
  assert.doesNotMatch(prompt.user, /^【命盘】$/m);
  assert.doesNotMatch(prompt.user, /^【核心判断依据】$/m);
  assert.doesNotMatch(prompt.user, /^【四柱】$/m);
  assert.match(prompt.user, /命盘：\n/);
  assert.match(prompt.user, /核心判断依据：\n/);
  assert.match(prompt.user, /四柱：\n/);
});

test('八字提示词在病药结论与正式主忌一致时应保留病药法片段（不冲突不隐藏）', () => {
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
    { id: 'ai-career', prompt: '测试', scene: 'career' },
    result,
    null,
    'career',
    { isCustomQuestion: false },
  );

  assert.match(prompt.user, /主忌火/);
  // 病药法与主忌不冲突（药=水 克 病=火=主忌火），应保留
  assert.match(prompt.user, /【病药法】/);
});

test('八字提示词在病药结论与正式喜忌一致时仍可保留病药法片段', () => {
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
    { id: 'ai-mingge-zonglun', prompt: '测试', scene: 'general' },
    result,
    null,
    'general',
    { isCustomQuestion: false },
  );

  assert.match(prompt.user, /喜忌五行: 火、水、土、金 \| 木/);
  assert.match(prompt.user, /【病药法】病:金过弱为病 \| 药:土/);
});

test('八字提示词中的经典格局片段不应再单列独立喜忌，避免与正式主线冲突', () => {
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
    { id: 'ai-mingge-zonglun', prompt: '测试', scene: 'general' },
    result,
    null,
    'general',
    { isCustomQuestion: false },
  );

  assert.match(
    prompt.user,
    /【经典格局】丙辛化水格（传统等级参考：极品，需复核成败） \| 丙辛合化水/,
  );
  assert.doesNotMatch(prompt.user, /【经典格局】[^\n]* \| 喜:/);
  assert.doesNotMatch(prompt.user, /【经典格局】[^\n]* 忌:/);
});

test('八字提示词中的经典格局片段应收起传统强断语，避免直接带偏在线 AI', () => {
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
    { id: 'ai-mingge-zonglun', prompt: '测试', scene: 'general' },
    result,
    null,
    'general',
    { isCustomQuestion: false },
  );

  assert.match(prompt.user, /【经典格局】壬骑龙背格（传统等级参考：极品，需复核成败）/);
  assert.match(prompt.user, /传统多视为层次较高，仍需结合原局成败与岁运同看/);
  assert.doesNotMatch(prompt.user, /主大富大贵/);
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

test('八字经典格局应识别子午双包格的两子与子午各二条件', () => {
  const twoZiPillars = {
    year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    month: { gan: '丙', zhi: '申', ganZhi: '丙申' },
    day: { gan: '甲', zhi: '未', ganZhi: '甲未' },
    hour: { gan: '壬', zhi: '子', ganZhi: '壬子' },
  };
  const ziWuBothPillars = {
    year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    month: { gan: '丙', zhi: '午', ganZhi: '丙午' },
    day: { gan: '甲', zhi: '午', ganZhi: '甲午' },
    hour: { gan: '壬', zhi: '子', ganZhi: '壬子' },
  };
  const hiddenStems = {
    year: ['癸'],
    month: ['庚', '壬', '戊'],
    day: ['己', '丁', '乙'],
    hour: ['癸'],
  };
  const ziWuHiddenStems = {
    ...hiddenStems,
    month: ['丁', '己'],
    day: ['丁', '己'],
  };

  for (const identifyClassicPattern of [identifyClassicPatternLocal, identifyClassicPatternCore]) {
    assert.equal(
      identifyClassicPattern('甲', '申', twoZiPillars, hiddenStems, '正印格')?.name,
      '子午双包格',
    );
    assert.equal(
      identifyClassicPattern('甲', '午', ziWuBothPillars, ziWuHiddenStems, '偏财格')?.name,
      '子午双包格',
    );
  }
});

test('八字经典格局提示词应统一收敛剩余主字类断语', () => {
  const chartResult = {
    pillars: {
      year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
      month: { gan: '丙', zhi: '子', ganZhi: '丙子' },
      day: { gan: '甲', zhi: '申', ganZhi: '甲申' },
      hour: { gan: '己', zhi: '丑', ganZhi: '己丑' },
    },
    hiddenStems: {
      year: ['癸'],
      month: ['癸'],
      day: ['庚', '壬', '戊'],
      hour: ['己', '癸', '辛'],
    },
    analysis: {
      mingGe: { pattern: '正印格', isSpecial: false },
    },
  };

  const section = generateEnhancedAnalysisSection(chartResult as any, 'general');

  assert.match(section, /【经典格局】福德格（传统等级参考：中等，需复核成败）/);
  assert.match(section, /传统多取象为一生福禄厚重，仍需结合原局成败与岁运同看/);
  assert.doesNotMatch(section, /主一生福禄厚重|主人聪明智慧|多主武贵|主辛苦创业|主艺术才华/);
});

test('八字提示词资料包中的取用脉络应保留判断依据，不直出内部成格强断语', () => {
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
    { id: 'ai-mingge-zonglun', prompt: '测试', scene: 'general' },
    result,
    null,
    'general',
    { isCustomQuestion: false },
  );

  assert.match(prompt.user, /取用脉络:/);
  assert.match(prompt.user, /调候优先:火 -> 水/);
  assert.match(prompt.user, /最终取用:火 -> 水 -> 土 -> 金/);
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
    { id: 'ai-mingge-zonglun', prompt: '测试', scene: 'general' },
    result,
    null,
    'general',
    { isCustomQuestion: false },
  );

  assert.match(prompt.user, /主忌木\+次土/);
  assert.doesNotMatch(prompt.user, /【通关法】/);
});

test('八字提示词在通关结论不与正式主忌冲突时仍可保留通关法片段', () => {
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
    { id: 'ai-mingge-zonglun', prompt: '测试', scene: 'general' },
    result,
    null,
    'general',
    { isCustomQuestion: false },
  );

  assert.match(prompt.user, /主忌土\+次水/);
  assert.match(prompt.user, /【通关法】水与火相战，以木通关调和/);
});

test('柱位出现桃花时即使全局神煞没有桃花也应生成桃花详解', () => {
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

  assert.equal(result.shensha.global?.length ?? 0, 0);
  assert.ok(result.shensha.month.includes('桃花'));
  assert.ok(result.shensha.hour.includes('桃花'));

  const prompt = buildPromptFromConfig(
    '请分析我的婚恋。',
    { id: 'ai-marriage', prompt: '测试', scene: 'marriage' },
    result,
    null,
    'marriage',
    { isCustomQuestion: false },
  );

  assert.match(prompt.user, /【桃花详解】命盘见桃花：月柱、时柱/);
  assert.match(prompt.user, /月柱:墙外桃花/);
  assert.match(prompt.user, /时柱:墙外桃花/);
  assert.doesNotMatch(prompt.user, /【桃花详解】[\s\S]*利:/);
  assert.doesNotMatch(prompt.user, /【桃花详解】[\s\S]*忌:/);
  assert.match(prompt.user, /【桃花详解】[\s\S]*提示:/);
  assert.match(prompt.user, /【桃花详解】[\s\S]*留意:/);
});

test('八字提示词的空亡详解应按实际空亡柱位显隐并写明证据', () => {
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
    { id: 'ai-marriage', prompt: '测试', scene: 'marriage' },
    withKongWang,
    null,
    'marriage',
    { isCustomQuestion: false },
  );

  assert.match(withPrompt.user, /【空亡详解】命盘见空亡：月柱、时柱。/);

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
    { id: 'ai-marriage', prompt: '测试', scene: 'marriage' },
    withoutKongWang,
    null,
    'marriage',
    { isCustomQuestion: false },
  );

  assert.doesNotMatch(withoutPrompt.user, /【空亡详解】/);
});

test('八字提示词空亡详解不应把年柱旬空宽松口径当作日柱空亡证据', () => {
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
  assert.ok(!result.shensha.month.includes('空亡'));
  assert.ok(!result.shensha.hour.includes('空亡'));

  const prompt = buildPromptFromConfig(
    '请分析我的婚恋。',
    { id: 'ai-marriage', prompt: '测试', scene: 'marriage' },
    result,
    null,
    'marriage',
    { isCustomQuestion: false },
  );

  assert.doesNotMatch(prompt.user, /【空亡详解】/);
  assert.doesNotMatch(prompt.user, /月柱:[^\n]*\(空亡\)|时柱:[^\n]*\(空亡\)/);

  const localFormatted = formatBaziForPromptLocal(result);
  const coreFormatted = formatBaziForPromptCore(result as any);
  assert.doesNotMatch(localFormatted, /月柱:[^\n]*\(空亡\)|时柱:[^\n]*\(空亡\)/);
  assert.doesNotMatch(coreFormatted, /月柱:[^\n]*\(空亡\)|时柱:[^\n]*\(空亡\)/);
});

test('八字提示词的伏吟反吟段应按实际证据显隐', () => {
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
    { id: 'ai-marriage', prompt: '测试', scene: 'marriage' },
    withFuxin,
    null,
    'marriage',
    { isCustomQuestion: false },
  );

  assert.match(withPrompt.user, /【伏吟反吟】命盘见伏吟：/);
  assert.match(withPrompt.user, /年柱与日柱地支同为卯/);
  assert.match(withPrompt.user, /月柱与时柱地支同为子/);

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
    { id: 'ai-marriage', prompt: '测试', scene: 'marriage' },
    withoutFuxin,
    null,
    'marriage',
    { isCustomQuestion: false },
  );

  assert.doesNotMatch(withoutPrompt.user, /【伏吟反吟】/);
});

test('八字提示词的刑冲合会破段应直接写入盘面证据', () => {
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
    { id: 'ai-marriage', prompt: '测试', scene: 'marriage' },
    result,
    null,
    'marriage',
    { isCustomQuestion: false },
  );

  assert.match(prompt.user, /【刑冲合会破】命盘见：/);
  assert.match(prompt.user, /年柱丁与月柱壬合/);
  assert.match(prompt.user, /年柱卯与月柱子刑/);
});

test('八字提示词会节选合化评分，避免把合化候选直接当成成化', () => {
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
    { id: 'ai-marriage', prompt: '测试', scene: 'marriage' },
    result,
    null,
    'marriage',
    { isCustomQuestion: false },
  );

  assert.match(prompt.user, /【合化程度】命盘见合化候选：/);
  assert.match(prompt.user, /天干五合年柱丁与月柱壬化木：合而不化50分，方向合绊/);
  assert.match(prompt.user, /80分以下不得直接按成化处理/);
  assert.doesNotMatch(prompt.user, /原组合可按化神木参与后续结构判断/);
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

test('婚姻子女父母兄弟专项提示改为传统框架加证据约束', () => {
  assert.match(generateMarriageMatchHints(), /先定关系主轴/);
  assert.doesNotMatch(generateMarriageMatchHints(), /配偶缘浅/);

  assert.match(generateCareerPartnershipHints(), /先看双方命局重心与合作分工是否顺手/);
  assert.match(generateCareerPartnershipHints(), /不可只凭表面投缘就判断适合长期合伙/);

  assert.match(generateFriendshipHints(), /先看双方气势是否投契/);
  assert.match(generateFriendshipHints(), /不可把一时投缘直接当成长期稳定/);

  assert.match(generateChildrenFateHints(), /不可只凭单一符号判断/);
  assert.match(generateChildrenFateHints(), /分开说明证据强弱/);
  assert.doesNotMatch(generateChildrenFateHints(), /子女缘薄/);

  assert.match(generateParentsAnalysisHints(), /神煞与刑冲只作旁证/);
  assert.match(generateParentsAnalysisHints(), /不可单凭一星定应/);
  assert.doesNotMatch(generateParentsAnalysisHints(), /祖上无缘/);

  assert.match(generateSiblingsAnalysisHints(), /避免只按比劫多少直接下结论/);
});

test('合盘提示词会按不同主题使用对应专项框架与任务口径', () => {
  const result1 = baziCalculator.calculateBazi({
    year: 1988,
    month: 1,
    day: 1,
    timeIndex: 0,
    gender: 'female',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });
  const result2 = baziCalculator.calculateBazi({
    year: 1990,
    month: 6,
    day: 15,
    timeIndex: 5,
    gender: 'male',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  const careerPrompt = getCompatibilityPrompt(
    '请分析我们适不适合长期合伙。',
    result1,
    result2,
    'career',
  );
  assert.match(careerPrompt.user, /【合盘分析思路】\n【合作合伙】/);
  assert.match(careerPrompt.user, /先判断合作主轴，再说明分工互补、利益风险、沟通成本和长期建议。/);
  assert.match(
    careerPrompt.user,
    /【输出要求】\n先直接回答【问题】，再展开最关键的 2 到 4 个重点。/,
  );
  assert.doesNotMatch(careerPrompt.user, /关系主基调/);

  const friendshipPrompt = getCompatibilityPrompt(
    '请分析我们两人的朋友相处模式。',
    result1,
    result2,
    'friendship',
  );
  assert.match(friendshipPrompt.user, /【合盘分析思路】\n【友情往来】/);
  assert.match(friendshipPrompt.user, /先判断相处主轴，再说明投缘点、边界风险、相处节奏和建议。/);
  assert.doesNotMatch(friendshipPrompt.user, /关系主基调/);

  const childrenPrompt = getCompatibilityPrompt(
    '请分析我们的子女缘。',
    result1,
    result2,
    'children',
  );
  assert.match(childrenPrompt.user, /【合盘分析思路】\n【子女缘分】/);
  assert.match(childrenPrompt.user, /先说明子女议题的主线，再分证据强弱展开重点。/);
  assert.match(
    childrenPrompt.user,
    /【输出要求】\n先直接回答【问题】，再展开最关键的 2 到 4 个重点，并分清证据强弱。/,
  );

  const parentsPrompt = getCompatibilityPrompt('请分析双方父母情况。', result1, result2, 'parents');
  assert.match(parentsPrompt.user, /【合盘分析思路】\n【父母研判】/);
  assert.match(
    parentsPrompt.user,
    /先说明父母议题主线，再分健康风险、照护压力、关系边界与建议展开。/,
  );
});

test('八字合盘自定义问题不应额外拼接框架任务书', () => {
  const result1 = baziCalculator.calculateBazi({
    year: 1988,
    month: 1,
    day: 1,
    timeIndex: 0,
    gender: 'female',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });
  const result2 = baziCalculator.calculateBazi({
    year: 1990,
    month: 6,
    day: 15,
    timeIndex: 5,
    gender: 'male',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  const prompt = getCompatibilityPrompt(
    '我们现在更适合继续推进合作，还是先保持距离？',
    result1,
    result2,
    'career',
    { isCustomQuestion: true },
  );

  assert.match(prompt.user, /【问题】\n我们现在更适合继续推进合作，还是先保持距离？/);
  assert.doesNotMatch(prompt.user, /【合盘分析思路】/);
  assert.doesNotMatch(prompt.user, /【任务】/);
  assert.doesNotMatch(prompt.user, /【输出要求】/);
});
