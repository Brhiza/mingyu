import { formatBaziForPrompt, type PromptChartScene } from '@core/bazi/baziAnalysisFormatter';
import type { BaziChartResult } from '@core/bazi/baziTypes';
import type { FortuneSelectionContext } from '@core/bazi/fortuneSelection';
import {
  getBaziCompatibilityDefaultQuestion,
  getBaziDefaultQuestion,
} from '../../lib/prompt-default-questions';
import { formatPromptCurrentTime } from '../../lib/prompt-time';
import { generateEnhancedAnalysisSection } from '@core/bazi/baziPromptEnhancement';
import { analyzeBaziCompatibility } from '@core/bazi/compatibilityEvidence';
import { buildPromptGuidanceSections } from '../../lib/prompt-guidance';

export interface AIPromptOption {
  id: string;
  prompt: string;
  scopeLabel?: string;
}

export type BaziFortunePromptScope = 'natal' | 'full' | 'dayun' | 'year' | 'month' | 'day';

const SYSTEM_PROMPT = '';
const COMPATIBILITY_SYSTEM_PROMPT = '';

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

function formatFortuneSelectionSection(
  ctx: FortuneSelectionContext | null | undefined,
  _options: { includeBreakdown?: boolean } = {},
): string {
  if (!ctx) return '';
  const { promptPayload } = ctx;
  const lines = [promptPayload.scopeLabel, buildFortuneTimingText(ctx)];
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

  const summary = [
    `分析对象：${buildFortuneSelectedObjectText(ctx)}`,
    buildFortuneTimingText(ctx),
    buildFortuneHierarchyText(ctx),
    buildFortuneGanZhiText(ctx).replace(/^当前干支：/, '所选干支：'),
    buildFortuneTriggerText(ctx).replace(/^核心触发：/, '主要触发：'),
  ]
    .filter(Boolean)
    .join('\n');
  return summary;
}

function buildBaziNatalAnalysisObjectSection(): string {
  return '分析对象：本命盘';
}

function buildBaziFullAnalysisObjectSection(): string {
  return '分析对象：本命盘与完整大运流年';
}

function buildBaziOutputRequirementText() {
  return '先回答【问题】，再说明主要命盘依据和时机条件。';
}

function buildFortunePromptAddon(promptId: string, ctx: FortuneSelectionContext | null): string {
  if (!ctx) return '';
  if (promptId === 'ai-fortune-detail') {
    if (ctx.scope === 'dayun') return '按逐年列表依次分析这一步大运，先总后分。';
    if (ctx.scope === 'year') return '按流月列表依次分析这一年，先总后分。';
    if (ctx.scope === 'month') return '按流日列表依次分析这个流月，先总后分。';
    return '聚焦这个流日的主题与阶段趋势。';
  }
  if (promptId === 'ai-fortune-overview') return '聚焦整体节奏与阶段趋势。';
  return '';
}

const BAZI_SINGLE_TASK_PROMPT = '请围绕【问题】完成八字分析。';
const BAZI_COMPATIBILITY_TASK_PROMPT = '请围绕【问题】完成双方八字合盘分析。';

function normalizeBaziScopeLabel(scopeLabel: string | undefined) {
  const normalized = scopeLabel?.trim();
  return normalized && normalized !== '综合' ? normalized : '通用';
}

function buildBaziTaskText(scopeLabel: string | undefined, fallbackTask: string) {
  const normalizedScopeLabel = normalizeBaziScopeLabel(scopeLabel);
  if (normalizedScopeLabel === '通用') {
    return fallbackTask;
  }

  return `请重点分析${normalizedScopeLabel}，并直接回答【问题】。`;
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
    const fullFortuneSection = hasFullFortuneOutput
      ? formatFullFortuneOutputSection(chartResult)
      : '';
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
        buildPromptGuidanceSections('bazi'),
        buildPromptSection('当前时间', formatPromptCurrentTime()),
        buildPromptSection('排盘信息', [chartData, enhancedSection].filter(Boolean).join('\n')),
        hasFullFortuneOutput
          ? buildPromptSection('分析对象', buildBaziFullAnalysisObjectSection())
          : '',
        !isCustomQuestion && !fortuneSection && !hasFullFortuneOutput
          ? buildPromptSection('分析对象', buildBaziNatalAnalysisObjectSection())
          : '',
        fortuneSection ? buildPromptSection('分析对象', fortuneSection) : '',
        fullFortuneSection ? buildPromptSection('命限资料', fullFortuneSection) : '',
        fortuneEvidenceSection ? buildPromptSection('岁运重点', fortuneEvidenceSection) : '',
        buildPromptSection('问题', normalizedQuestion),
        isCustomQuestion
          ? ''
          : buildPromptSection('任务', task || '请依据已给出的命盘字段直接裁定重点。'),
        isCustomQuestion ? '' : buildPromptSection('输出要求', buildBaziOutputRequirementText()),
      ]),
    };
  }

  const chartData = chartResult?.pillars
    ? formatBaziForPrompt(chartResult, selectedOption, 'general')
    : '命盘数据格式不支持。';
  const fullFortuneSection = hasFullFortuneOutput
    ? formatFullFortuneOutputSection(chartResult)
    : '';

  return {
    system: SYSTEM_PROMPT,
    user: joinPromptSections([
      buildPromptGuidanceSections('bazi'),
      buildPromptSection('当前时间', formatPromptCurrentTime()),
      buildPromptSection('排盘信息', chartData),
      hasFullFortuneOutput
        ? buildPromptSection('分析对象', buildBaziFullAnalysisObjectSection())
        : '',
      !isCustomQuestion && !hasFullFortuneOutput
        ? buildPromptSection('分析对象', buildBaziNatalAnalysisObjectSection())
        : '',
      fullFortuneSection ? buildPromptSection('命限资料', fullFortuneSection) : '',
      buildPromptSection('问题', normalizedQuestion),
      isCustomQuestion ? '' : buildPromptSection('任务', '请依据已给出的命盘字段直接裁定重点。'),
      isCustomQuestion ? '' : buildPromptSection('输出要求', buildBaziOutputRequirementText()),
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
  return `${prefix}请先判断关系主轴，再说明相处模式、互补点、冲突点和阶段趋势。`;
}

function getCompatibilityOutputRequirement(compatType?: CompatType): string {
  void compatType;
  return '先直接回答【问题】，再说明关系主轴、互补点、冲突点、触发条件和阶段趋势，并结合双方盘面资料说明。';
}

function formatCompatibilityFacts(result: ReturnType<typeof analyzeBaziCompatibility>): string {
  const relationLines = result.crossPillarRelations.map((item) => item.promptText);
  const combinationLines = result.crossBranchCombinations.map((item) => item.promptText);
  const tenGodLines = result.tenGodMappings.map((item) => item.promptText);
  const coverageLines = result.usefulGodCoverage
    .filter((item) => item.status === '已计算')
    .map((item) => item.promptText);

  return [
    `日主关系：${result.dayMasterRelation.promptText}。`,
    `四柱关系：${relationLines.length ? relationLines.join('；') : '双方四柱未见列出的合冲刑害破关系'}。`,
    combinationLines.length ? `跨盘组合：${combinationLines.join('；')}。` : '',
    `双向十神：${tenGodLines.join('；')}。`,
    coverageLines.length ? `喜忌五行对应：${coverageLines.join('；')}。` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function getCompatibilityPrompt(
  questionText: string,
  baziResult1: BaziChartResult | null,
  baziResult2: BaziChartResult | null,
  compatType?: CompatType,
  options: { isCustomQuestion?: boolean; person1Name?: string; person2Name?: string } = {},
): { system: string; user: string } {
  const isCustomQuestion = Boolean(options.isCustomQuestion);
  const data1 = baziResult1
    ? demoteEmbeddedPromptSections(formatBaziForPrompt(baziResult1, null, 'compatibility'))
    : '无法获取第一人命盘数据。';
  const data2 = baziResult2
    ? demoteEmbeddedPromptSections(formatBaziForPrompt(baziResult2, null, 'compatibility'))
    : '无法获取第二人命盘数据。';
  const compatibilityEvidence =
    baziResult1 && baziResult2
      ? formatCompatibilityFacts(
          analyzeBaziCompatibility(baziResult1, baziResult2, {
            person1Name: options.person1Name,
            person2Name: options.person2Name,
          }),
        )
      : '双方命盘不完整，无法生成双盘关系资料。';

  return {
    system: COMPATIBILITY_SYSTEM_PROMPT,
    user: joinPromptSections([
      buildPromptGuidanceSections('bazi-compatibility'),
      buildPromptSection('当前时间', formatPromptCurrentTime()),
      buildPromptSection('第一人排盘信息', data1),
      buildPromptSection('第二人排盘信息', data2),
      buildPromptSection('双盘关系资料', compatibilityEvidence),
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
