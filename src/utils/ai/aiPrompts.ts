import { formatBaziForPrompt, type PromptChartScene } from '@core/bazi/baziAnalysisFormatter';
import type { BaziChartResult } from '@core/bazi/baziTypes';
import type { FortuneSelectionContext } from '@core/bazi/fortuneSelection';
import {
  getBaziCompatibilityDefaultQuestion,
  getBaziDefaultQuestion,
} from '../../lib/prompt-default-questions';
import { formatPromptCurrentTime } from '../../lib/prompt-time';
import { generateEnhancedAnalysisSection } from '@core/bazi/baziPromptEnhancement';
import { buildBaziQuestionGuidanceSection } from './baziPromptGuidance';

export interface AIPromptOption {
  id: string;
  prompt: string;
  scopeLabel?: string;
}

export type BaziFortunePromptScope = 'natal' | 'full' | 'dayun' | 'year' | 'month' | 'day';

export { buildBaziQuestionGuidanceSection };

const BASE_SYSTEM_ROLE = '你是资深八字命理师，熟悉《渊海子平》《滴天髓》《三命通会》《穷通宝鉴》。';

const BASE_SYSTEM_RULES = [
  '只基于提供的命盘、岁运和问题作答',
  '不得编造已提供资料没有给出的新盘面事实；允许基于已提供资料做传统八字推理，但必须标明来自原局、岁运、十神、合冲刑害、神煞旁证或现实补充信息',
  '判断喜忌：先旺衰月令→格局调候→取用十神→神煞；普通格局按扶抑，专旺从格按顺势；神煞不得单独推翻主体判断',
  '标注为“传统旁证”的内容只作辅助验证，不得盖过核心判断依据',
  '说清核心用神、辅助喜用与主忌，结论与推理不一致时必须指出冲突点',
  '涉及年份、月份、日期或年龄时，只有【分析对象】中提供的大运、流年、流月、流日才可作为当前岁运证据',
  '优先使用命盘中的核心判断依据组织推理，不要平均复述四柱资料',
  '回答先给明确倾向，再说明主证、辅证、限制条件和现实建议',
  '信息不足时说明证据不足，不得强行给确定结论',
  '用通俗中文，不写套话，不复述无关背景',
  '取用顺序：扶抑法为基础，病药法找突出问题，通关法调两神相战，调候法调寒热燥湿，专旺从势法顺势',
];

const COMPAT_SYSTEM_RULES = [
  '只基于提供的双方命盘、岁运和问题作答',
  '不得编造已提供资料没有给出的新盘面事实；允许基于双方已提供资料做传统八字推理，但必须标明来自原局、岁运、十神、合冲刑害、神煞旁证或现实补充信息',
  '双盘先分别判断旺衰、格局、调候和用忌，再汇总双方互动主线、互补点、冲突点、现实压力和建议',
  '判断喜忌仍按旺衰月令→格局调候→取用十神→神煞；普通格局按扶抑，专旺从格按顺势；神煞不得单独推翻主体判断',
  '标注为“传统旁证”的内容只作辅助验证，不得盖过核心判断依据',
  '双盘分析先看命局主线、喜忌互补与岁运节奏，再看十神、宫位、合冲刑害和神煞旁证',
  '优先提炼双方互动主线，不要平均复述两张命盘资料',
  '回答先给关系倾向，再说明双方主证、互补点、冲突点、限制条件和相处建议',
  '关系结论若与双方命局主线或岁运节奏不一致，必须指出冲突点',
  '信息不足时说明证据不足，不得强行给确定结论',
  '用通俗中文，不写套话，不复述无关背景',
];

function buildSystemText(rules: readonly string[] = BASE_SYSTEM_RULES): string {
  const normalizedRules = Array.from(new Set(rules.map((line) => line.trim()).filter(Boolean)));
  return [BASE_SYSTEM_ROLE, '要求：', ...normalizedRules.map((line) => `- ${line}`)].join('\n');
}

const SYSTEM_PROMPT = buildSystemText();
const COMPATIBILITY_SYSTEM_PROMPT = buildSystemText(COMPAT_SYSTEM_RULES);

function buildPromptSection(title: string, content: string): string {
  return `【${title}】\n${content}`;
}

function demoteEmbeddedPromptSections(content: string): string {
  return content.replace(/^【([^】]+)】$/gm, '$1：');
}

function joinPromptSections(sections: Array<string | null | undefined>): string {
  return sections.filter(Boolean).join('\n\n');
}

function resolvePromptScene(promptId: string): PromptChartScene {
  if (
    promptId.startsWith('ai-fortune-') ||
    promptId === 'ai-current-luck' ||
    promptId === 'ai-this-year'
  ) {
    return 'fortune';
  }
  return 'general';
}

function removePromptLabel(value: string, label: string) {
  return value.startsWith(label) ? value.slice(label.length).trim() : value;
}

function findFortuneSummaryLine(ctx: FortuneSelectionContext, prefixes: string[]) {
  return ctx.promptPayload.summaryLines.find((line) =>
    prefixes.some((prefix) => line.startsWith(prefix)),
  );
}

function buildFortuneSelectedObjectText(ctx: FortuneSelectionContext) {
  return removePromptLabel(ctx.promptPayload.scopeLabel, '分析对象：');
}

function buildFortuneTimingText(ctx: FortuneSelectionContext) {
  if (ctx.scope === 'dayun') {
    return `选择日期：${ctx.cycleStartYear}年起，约${ctx.cycleAge}岁交运`;
  }

  if (ctx.scope === 'year') {
    return `选择日期：${ctx.year ?? '未标注'}年${ctx.yearAge ? `（${ctx.yearAge}岁）` : ''}`;
  }

  if (ctx.scope === 'month') {
    const month = ctx.monthBreakdown?.[0];
    if (!month) return '';
    const start = [month.startTermName, month.startDateTime].filter(Boolean).join(' ');
    const end = [month.endTermName, month.endDateTime].filter(Boolean).join(' ');
    const jieqiText =
      start || end
        ? `（节气月：${start || month.startDate} 起，${end || month.endDate} 交下节）`
        : '';
    return `选择日期：${month.startDate} 至 ${month.endDate}${jieqiText}`;
  }

  const day = ctx.dayBreakdown?.[0];
  const ziChuText = findFortuneSummaryLine(ctx, ['按子初换日：']);
  return ['选择日期：', day?.date ?? ctx.displayLabel, ziChuText ? `（${ziChuText}）` : ''].join(
    '',
  );
}

function buildFortuneHierarchyText(ctx: FortuneSelectionContext) {
  const parents = ctx.promptPayload.summaryLines
    .filter(
      (line) =>
        line.startsWith('所属大运：') ||
        line.startsWith('所属流年：') ||
        line.startsWith('所属流月：'),
    )
    .map((line) =>
      line
        .replace(/^所属大运：/, '')
        .replace(/^所属流年：/, '')
        .replace(/^所属流月：/, '')
        .replace(/\s+/g, ''),
    );

  return parents.length ? `上层岁运：${parents.join(' > ')}` : '';
}

function buildFortuneGanZhiText(ctx: FortuneSelectionContext) {
  const ganZhiLine = findFortuneSummaryLine(ctx, ['大运干支：', '流年干支：', '流月：', '流日：']);
  const tenGodLine = findFortuneSummaryLine(ctx, [
    '大运十神：',
    '流年十神：',
    '流月十神：',
    '流日十神：',
  ]);

  if (!ganZhiLine && !tenGodLine) return '';
  return [
    '当前干支：',
    ganZhiLine ? removePromptLabel(ganZhiLine, ganZhiLine.split('：')[0] + '：') : '',
    tenGodLine ? `；${removePromptLabel(tenGodLine, tenGodLine.split('：')[0] + '：')}` : '',
  ].join('');
}

function buildFortuneTriggerText(ctx: FortuneSelectionContext) {
  const triggerLine = ctx.promptPayload.summaryLines.find((line) => line.includes('触发：'));
  return triggerLine ? `核心触发：${triggerLine.replace(/^[^：]+触发：/, '')}` : '';
}

function buildFortuneUsageBoundaryText(scope: FortuneSelectionContext['scope']) {
  const boundaryMap: Record<FortuneSelectionContext['scope'], string> = {
    dayun: '解读范围：重点判断这步大运的十年阶段主题；未提供流年时不指定某一年。',
    year: '解读范围：重点判断这一年的年度触发；未提供流月或流日时不指定具体月日。',
    month: '解读范围：重点判断这个节气月窗口；未提供流日时不指定具体日期。',
    day: '解读范围：重点判断这个流日的执行、沟通、触发和避险，不改写长期趋势。',
  };

  return boundaryMap[scope];
}

function formatFortuneSelectionSection(
  ctx: FortuneSelectionContext | null | undefined,
  _options: { includeBreakdown?: boolean } = {},
): string {
  if (!ctx) return '';
  const { promptPayload } = ctx;
  const scopeBoundaryMap: Record<FortuneSelectionContext['scope'], string> = {
    dayun: '解读范围：大运看十年阶段主题、环境压力与机会方向；当前不展开具体年份应期。',
    year: '解读范围：流年看年度触发；可以参考下列流月窗口，但不要把未被问题或证据指向的流月、流日说成确定应期。',
    month: '解读范围：流月看月份窗口、推进节奏和短期触发；不宜反推一生命局层面的定论。',
    day: '解读范围：流日只看当日执行、沟通、触发和避险；不能把一天的波动说成长期命运。',
  };
  const lines = [
    promptPayload.scopeLabel,
    buildFortuneTimingText(ctx),
    scopeBoundaryMap[ctx.scope],
    '推断顺序：先看本命底色，再看大运阶段，再看流年年度触发，最后用流月、流日细化窗口。',
    '范围说明：下面列出的上层与下级岁运，只用于交代年限层级；本次仍以上面分析对象为主。',
  ];
  const detailGroups =
    promptPayload.detailGroups?.filter((group) => group.title && group.lines.length > 0) ?? [];
  if (detailGroups.length) {
    detailGroups.forEach((group) => {
      lines.push(group.title);
      lines.push(...group.lines.map((line, i) => `${i + 1}. ${line}`));
    });
  } else if (promptPayload.breakdownTitle && promptPayload.breakdownLines?.length) {
    lines.push(promptPayload.breakdownTitle);
    lines.push(...promptPayload.breakdownLines.map((line, i) => `${i + 1}. ${line}`));
  }
  return lines.join('\n');
}

function formatFullFortuneOutputSection(result: BaziChartResult | null): string {
  if (!result?.luckInfo?.cycles?.length) return '';

  const lines = [
    '完整大运流年：',
    ...result.luckInfo.cycles.flatMap((cycle, cycleIndex) => {
      const cycleType = cycle.isXiaoyun ? '童运' : cycle.type;
      return [
        `${cycleIndex + 1}. ${cycle.ganZhi}${cycleType}：${cycle.year}年起，约${cycle.age}岁交运`,
        ...cycle.years.map((year) => `  - ${year.year}年（${year.age}岁）${year.ganZhi}`),
      ];
    }),
  ];

  return lines.join('\n');
}

function formatFortuneEvidenceSection(ctx: FortuneSelectionContext | null | undefined): string {
  if (!ctx) return '';

  return [
    `分析对象：${buildFortuneSelectedObjectText(ctx)}`,
    buildFortuneTimingText(ctx),
    buildFortuneHierarchyText(ctx),
    buildFortuneGanZhiText(ctx).replace(/^当前干支：/, '所选干支：'),
    buildFortuneTriggerText(ctx).replace(/^核心触发：/, '主要触发：'),
    buildFortuneUsageBoundaryText(ctx.scope),
  ]
    .filter(Boolean)
    .join('\n');
}

function buildBaziNatalAnalysisObjectSection(): string {
  return [
    '分析对象：本命盘',
    '解读范围：以命局长期结构、性格底色、能力资源、关系模式、长期风险与可调整方向为主。',
    '资料说明：本次未指定某个大运、流年、流月或流日为分析对象；可参考【排盘信息】中的大运总览、当前大运与近年流年作阶段背景。',
    '应期边界：问题涉及年份、月份、日期或年龄时，只能给阶段倾向和触发条件，不把未指定的月份或日期硬断成唯一应期。',
    '推断顺序：先看日主旺衰、月令、格局调候、用神喜忌，再看十神、宫位、合冲刑害与神煞旁证。',
  ].join('\n');
}

function buildBaziFullAnalysisObjectSection(): string {
  return [
    '分析对象：本命盘与完整大运流年',
    '解读范围：先以命局长期结构定底色，再结合完整大运与逐年流年判断阶段起伏。',
    '资料说明：本次提供完整大运和逐年流年；未指定流月或流日时，不把具体月份或日期说成确定应期。',
    '应期边界：问题涉及年份时，可在完整流年列表中找重点年份；问题涉及月份或日期时，只能说明触发条件，不硬断唯一月日。',
    '推断顺序：先看本命格局、旺衰、调候和用忌，再看大运阶段，最后用流年寻找更明显的年度触发。',
  ].join('\n');
}

function buildBaziScopePrioritySection(hasFortuneSelection: boolean, hasFullFortuneOutput = false): string {
  if (hasFullFortuneOutput) {
    return [
      '本次提供完整大运与逐年流年。',
      '回答以命局长期结构为根，再按大运阶段和流年触发筛出最关键的时间段。',
      '如果【问题】没有限定年份，先讲整体阶段，再点出最值得关注的几个大运或流年。',
      '未提供流月或流日时，不得把具体月份或日期说成唯一应期。',
    ].join('\n');
  }

  if (!hasFortuneSelection) {
    return [
      '本次未指定某个大运、流年、流月或流日为分析对象。',
      '回答以命局长期结构、长期倾向和现实调整方向为主，同时可参考【排盘信息】中的大运总览、当前大运与近年流年作阶段背景。',
      '如果【问题】询问具体年份、月份、日期或年龄，开头先说明当前资料只能判断阶段倾向，本次不展开精确应期窗口。',
      '写应期时只能说明“具备哪类触发条件时更容易出现”，不得把未指定的月份或日期说成唯一应期。',
    ].join('\n');
  }

  return [
    '只有【分析对象】中已经提供的大运、流年、流月、流日，才作为本次岁运依据。',
    '本次已经提供具体年限，回答要围绕该大运、流年、流月或流日展开。',
    '如果【问题】中的时间与【分析对象】不一致，开头先提醒不一致，再以【分析对象】为准。',
    '写应期时请说明依据来自本命底色、大运阶段、流年触发、流月窗口还是流日短期触发。',
  ].join('\n');
}

function buildBaziFortuneInterpretationRules(scope: FortuneSelectionContext['scope']): string {
  const selectedScopeRule: Record<FortuneSelectionContext['scope'], string> = {
    dayun:
      '当前指定大运：回答以十年阶段主题为主，只能在已提供的逐年列表中提示重点年份，不得把大运本身说成某个确定年份已经发生。',
    year: '当前指定流年：回答以该年年度触发为主，必须承接所属大运背景；可引用已提供的流月列表判断月份窗口，但未被问题或证据指向的月份不能硬断为唯一应期。',
    month:
      '当前指定流月：回答以该月节气范围内的推进窗口、短期触发和风险控制为主；必须说明它如何承接大运与流年，不得用一个月推翻本命和整年主线。',
    day: '当前指定流日：回答以当天执行、沟通、决策、避险和即时触发为主；必须服从所属流月、流年与大运，不得把一天的波动说成长期命运。',
  };

  return [
    selectedScopeRule[scope],
    '本命层：只定格局、旺衰、用忌、性格底色、长期能力与长期问题，不能单独推出具体年份。',
    '大运层：看十年阶段的环境、身份、资源、压力和机会方向；大运能定阶段强弱，不能替代流年给出精确应期。',
    '流年层：看年度触发、事件类别和该年更容易被引动的宫位/十神/合冲刑害；流年结论必须承接大运，不能脱离大运单独断吉凶。',
    '流月层：看月份窗口、推进节奏、临门一脚和短期反复；流月只能细化年度主题，不能覆盖整年趋势。',
    '流日层：看当日执行、沟通、签约、出行、冲突和避险；流日只作短期触发，不改写长期格局。',
    '写应期时，先说明上层背景，再说明当前层级的触发证据；如果下层资料未提供，只能说“更容易在某类窗口出现”，不得给绝对日期。',
  ].join('\n');
}

function buildBaziOutputRequirementText(kind: 'single' | 'fallback' = 'single') {
  const firstLine =
    kind === 'fallback'
      ? '先直接回答【问题】，再补关键依据、触发条件与建议。'
      : '先直接回答【问题】，再展开最关键的 2 到 4 个重点。';

  return [
    firstLine,
    '每个重点都要写明主证、辅证、反证或限制，以及应期条件；有【分析对象】时必须说明对应年限如何触发，没有年限资料时不得强断具体年份。',
    '证据不足处单独说明，不要为了给结论而编造盘面事实。',
    '最后给一条最值得立刻执行或避免的现实建议。',
  ].join('\n');
}

function buildFortunePromptAddon(promptId: string, ctx: FortuneSelectionContext | null): string {
  if (!ctx) return '';
  if (promptId === 'ai-fortune-detail') {
    if (ctx.scope === 'dayun') return '按逐年列表依次分析这一步大运，先总后分。';
    if (ctx.scope === 'year') return '按流月列表依次分析这一年，先总后分。';
    if (ctx.scope === 'month') return '按流日列表依次分析这个流月，先总后分。';
    return '聚焦这个流日的主题、机会风险和建议。';
  }
  if (promptId === 'ai-fortune-overview') return '聚焦整体节奏、机会、风险和应对。';
  return '';
}

const BAZI_SINGLE_TASK_PROMPT =
  '请围绕【问题】直接判断重点；若【问题】未限定具体事项，按通用八字口径做整体分析。';
const BAZI_COMPATIBILITY_TASK_PROMPT =
  '请围绕【问题】和关系范围直接判断重点；若【问题】未限定具体事项，按通用合盘口径做整体分析。';

function normalizeBaziScopeLabel(scopeLabel: string | undefined) {
  const normalized = scopeLabel?.trim();
  return normalized && normalized !== '综合' ? normalized : '通用';
}

function buildBaziTaskText(scopeLabel: string | undefined, fallbackTask: string) {
  const normalizedScopeLabel = normalizeBaziScopeLabel(scopeLabel);
  if (normalizedScopeLabel === '通用') {
    return fallbackTask;
  }

  return `主题范围：${normalizedScopeLabel}。请围绕【问题】和该主题范围直接判断重点；若【问题】未限定具体事项，按通用八字口径先做整体分析，再结合该主题提示重点。`;
}

function createBaziPromptOption(id: string, scopeLabel: string): AIPromptOption {
  return { id, prompt: BAZI_SINGLE_TASK_PROMPT, scopeLabel };
}

function createBaziCompatibilityPromptOption(id: string, scopeLabel: string): AIPromptOption {
  return { id, prompt: BAZI_COMPATIBILITY_TASK_PROMPT, scopeLabel };
}

export const BAZI_AI_PROMPTS = {
  single: [
    createBaziPromptOption('ai-mingge-zonglun', '通用'),
    createBaziPromptOption('ai-recent', '近期'),
    createBaziPromptOption('ai-career', '事业'),
    createBaziPromptOption('ai-job-change', '换工作'),
    createBaziPromptOption('ai-startup-partnership', '创业合作'),
    createBaziPromptOption('ai-investment-partnership', '投资合作'),
    createBaziPromptOption('ai-wealth-timing', '财运'),
    createBaziPromptOption('ai-marriage', '婚恋'),
    createBaziPromptOption('ai-relationship-push', '关系推进'),
    createBaziPromptOption('ai-relationship-decision', '关系去留'),
    createBaziPromptOption('ai-reconciliation-decision', '复合判断'),
    createBaziPromptOption('ai-children-fate', '子女'),
    createBaziPromptOption('ai-health', '健康'),
    createBaziPromptOption('ai-family', '六亲'),
    createBaziPromptOption('ai-home', '家庭'),
    createBaziPromptOption('ai-home-move', '搬家置业'),
    createBaziPromptOption('ai-settle-relocate', '定居换城'),
    createBaziPromptOption('ai-social', '人际'),
    createBaziPromptOption('ai-emotion', '情绪'),
    createBaziPromptOption('ai-study', '学业'),
    createBaziPromptOption('ai-study-advance', '考证进修'),
    createBaziPromptOption('ai-exam-landing', '考试上岸'),
    createBaziPromptOption('ai-growth', '成长'),
    createBaziPromptOption('ai-talent', '天赋'),
  ] as AIPromptOption[],
  combined: [
    createBaziCompatibilityPromptOption('ai-compat-marriage', '合婚'),
    createBaziCompatibilityPromptOption('ai-compat-career', '合伙'),
    createBaziCompatibilityPromptOption('ai-compat-friendship', '友情'),
    createBaziCompatibilityPromptOption('ai-compat-children', '子女'),
    createBaziCompatibilityPromptOption('ai-compat-parents', '父母'),
    createBaziCompatibilityPromptOption('ai-compat-siblings', '兄弟'),
  ] as AIPromptOption[],
};

type SinglePromptConfig = (typeof BAZI_AI_PROMPTS.single)[number];

export function buildPromptFromConfig(
  questionText: string,
  selectedOption: AIPromptOption,
  chartResult: BaziChartResult | null,
  fortuneSelectionContext: FortuneSelectionContext | null = null,
  questionScopeLabel?: string,
  options: { isCustomQuestion?: boolean; fortuneScope?: BaziFortunePromptScope } = {},
): { system: string; user: string } {
  const isCustomQuestion = Boolean(options.isCustomQuestion);
  const fortuneScope = options.fortuneScope ?? fortuneSelectionContext?.scope ?? 'natal';
  const hasFullFortuneOutput = fortuneScope === 'full';
  const promptConfig: SinglePromptConfig | null = chartResult?.pillars
    ? (BAZI_AI_PROMPTS.single.find((c) => c.id === selectedOption.id) ?? null)
    : null;
  const scopeLabel =
    questionScopeLabel ?? selectedOption.scopeLabel ?? promptConfig?.scopeLabel ?? '通用';
  const normalizedQuestion =
    questionText.trim() || getBaziDefaultQuestion(undefined, { isCustomQuestion });

  if (promptConfig) {
    const chartData = chartResult
      ? formatBaziForPrompt(chartResult, selectedOption, resolvePromptScene(promptConfig.id))
      : '无法获取命盘数据。';
    const fortuneSection = formatFortuneSelectionSection(fortuneSelectionContext, {
      includeBreakdown: promptConfig.id === 'ai-fortune-detail',
    });
    const fullFortuneSection = hasFullFortuneOutput ? formatFullFortuneOutputSection(chartResult) : '';
    const fortuneEvidenceSection = formatFortuneEvidenceSection(fortuneSelectionContext);
    const fortuneAddon = buildFortunePromptAddon(promptConfig.id, fortuneSelectionContext);
    const task = [buildBaziTaskText(scopeLabel, promptConfig.prompt), fortuneAddon]
      .filter(Boolean)
      .join(' ');

    let enhancedSection = '';
    if (chartResult && !isCustomQuestion) {
      enhancedSection = generateEnhancedAnalysisSection(chartResult);
    }

    return {
      system: SYSTEM_PROMPT,
      user: joinPromptSections([
        buildPromptSection('当前时间', formatPromptCurrentTime()),
        buildPromptSection('排盘信息', [chartData, enhancedSection].filter(Boolean).join('\n')),
        hasFullFortuneOutput ? buildPromptSection('分析对象', buildBaziFullAnalysisObjectSection()) : '',
        !isCustomQuestion && !fortuneSection && !hasFullFortuneOutput
          ? buildPromptSection('分析对象', buildBaziNatalAnalysisObjectSection())
          : '',
        fortuneSection ? buildPromptSection('分析对象', fortuneSection) : '',
        fullFortuneSection ? buildPromptSection('命限资料', fullFortuneSection) : '',
        fortuneEvidenceSection ? buildPromptSection('岁运重点', fortuneEvidenceSection) : '',
        !isCustomQuestion && fortuneSelectionContext
          ? buildPromptSection(
              '解读方法',
              buildBaziFortuneInterpretationRules(fortuneSelectionContext.scope),
            )
          : '',
        isCustomQuestion
          ? ''
          : buildPromptSection(
              '解读范围',
              buildBaziScopePrioritySection(Boolean(fortuneSection), hasFullFortuneOutput),
            ),
        buildPromptSection('问题', normalizedQuestion),
        isCustomQuestion
          ? ''
          : buildPromptSection(
              '断盘要点',
              buildBaziQuestionGuidanceSection(Boolean(fortuneSection)),
            ),
        isCustomQuestion ? '' : buildPromptSection('任务', task || '请直接判断重点。'),
        isCustomQuestion
          ? ''
          : buildPromptSection('输出要求', buildBaziOutputRequirementText('single')),
      ]),
    };
  }

  const chartData = chartResult?.pillars
    ? formatBaziForPrompt(chartResult, selectedOption, 'general')
    : '命盘数据格式不支持。';
  const fullFortuneSection = hasFullFortuneOutput ? formatFullFortuneOutputSection(chartResult) : '';

  return {
    system: SYSTEM_PROMPT,
    user: joinPromptSections([
      buildPromptSection('当前时间', formatPromptCurrentTime()),
      buildPromptSection('排盘信息', chartData),
      hasFullFortuneOutput ? buildPromptSection('分析对象', buildBaziFullAnalysisObjectSection()) : '',
      !isCustomQuestion && !hasFullFortuneOutput
        ? buildPromptSection('分析对象', buildBaziNatalAnalysisObjectSection())
        : '',
      fullFortuneSection ? buildPromptSection('命限资料', fullFortuneSection) : '',
      isCustomQuestion
        ? ''
        : buildPromptSection('解读范围', buildBaziScopePrioritySection(false, hasFullFortuneOutput)),
      buildPromptSection('问题', normalizedQuestion),
      isCustomQuestion
        ? ''
        : buildPromptSection('断盘要点', buildBaziQuestionGuidanceSection(false)),
      isCustomQuestion ? '' : buildPromptSection('任务', '请直接判断重点。'),
      isCustomQuestion
        ? ''
        : buildPromptSection('输出要求', buildBaziOutputRequirementText('fallback')),
    ]),
  };
}

export type CompatType = 'marriage' | 'career' | 'friendship' | 'children' | 'parents' | 'siblings';

function getCompatibilityTask(compatType?: CompatType): string {
  const labelMap: Record<CompatType, string> = {
    marriage: '合婚',
    career: '合伙',
    friendship: '友情',
    children: '子女',
    parents: '父母',
    siblings: '兄弟',
  };
  const label = compatType ? labelMap[compatType] : '';
  const prefix = label ? `关系范围：${label}。` : '';
  return `${prefix}请先判断关系主轴，再说明相处模式、互补点、冲突点和建议。`;
}

function getCompatibilityOutputRequirement(compatType?: CompatType): string {
  void compatType;
  return [
    '先直接回答【问题】，再展开最关键的 2 到 4 个重点。',
    '每个重点都要写明双方盘面主证、辅证、反证或限制、触发条件与现实建议；证据不足处单独说明。',
    '最后补一条相处、合作或边界管理建议，说明适合推进、观察还是暂缓。',
  ].join('\n');
}

export function getCompatibilityPrompt(
  questionText: string,
  baziResult1: BaziChartResult | null,
  baziResult2: BaziChartResult | null,
  compatType?: CompatType,
  options: { isCustomQuestion?: boolean } = {},
): { system: string; user: string } {
  const isCustomQuestion = Boolean(options.isCustomQuestion);
  const data1 = baziResult1
    ? demoteEmbeddedPromptSections(formatBaziForPrompt(baziResult1, null, 'compatibility'))
    : '无法获取第一人命盘数据。';
  const data2 = baziResult2
    ? demoteEmbeddedPromptSections(formatBaziForPrompt(baziResult2, null, 'compatibility'))
    : '无法获取第二人命盘数据。';

  return {
    system: COMPATIBILITY_SYSTEM_PROMPT,
    user: joinPromptSections([
      buildPromptSection('当前时间', formatPromptCurrentTime()),
      buildPromptSection('第一人排盘信息', data1),
      buildPromptSection('第二人排盘信息', data2),
      buildPromptSection(
        '问题',
        questionText.trim() || getBaziCompatibilityDefaultQuestion(compatType),
      ),
      isCustomQuestion ? '' : buildPromptSection('任务', getCompatibilityTask(compatType)),
      isCustomQuestion
        ? ''
        : buildPromptSection('输出要求', getCompatibilityOutputRequirement(compatType)),
    ]),
  };
}
