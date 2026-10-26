import {
  analyzeBaziCompatibility,
  formatBaziForPrompt,
  formatBaziUsefulGodCoverageForPrompt,
  type BaziChartResult,
} from '../bazi/index';
import {
  formatPatternDecisionForPrompt,
  hasConfirmedPatternTarget,
} from '../bazi/baziAnalysisFormatter';
import type { FortuneSelectionContext } from '../bazi/fortuneSelection';
import { formatBaziFullFortune, formatBaziFortuneSelection } from './bazi-fortune';
import { formatPromptCurrentTime } from './current-time';
import { buildCustomQuestionTask, buildPromptGuidance, buildPromptTask } from './guidance';
import { buildPromptDocument, buildPromptSection, joinPromptSections } from './sections';
import type { PromptBuildOptions, PromptDocument } from './types';
import { appendClassicalReferences } from './classical-references';
import {
  formatBaziSchoolPrompt,
  formatBaziSchoolsPrompt,
  normalizeBaziPromptSchools,
  type BaziPromptSchool as SharedBaziPromptSchool,
} from './bazi-school';
import { formatPromptSchoolGuidance } from './schools';
import {
  buildPromptSelectionTask,
  getPromptSelectionSection,
  type PromptSelection,
} from './framework';

export const BAZI_PROMPT_TOPICS = [
  'general',
  'recent',
  'career',
  'job-change',
  'startup-partnership',
  'investment-partnership',
  'wealth',
  'marriage',
  'relationship',
  'relationship-push',
  'relationship-decision',
  'reconciliation-decision',
  'children',
  'family',
  'home-move',
  'settle-relocate',
  'social',
  'emotion',
  'health',
  'parents',
  'study',
  'study-advance',
  'exam-landing',
  'growth',
  'talent',
] as const;

export type BaziPromptTopic = (typeof BAZI_PROMPT_TOPICS)[number];
export type BaziPromptMode = 'framework' | 'custom';
export type BaziPromptSchool = SharedBaziPromptSchool;
export type BaziPromptFortuneScope = 'natal' | 'full' | 'dayun' | 'year' | 'month' | 'day';

const TOPIC_LABELS: Record<BaziPromptTopic, string> = {
  general: '通用',
  recent: '近期',
  career: '事业',
  'job-change': '换工作',
  'startup-partnership': '创业合作',
  'investment-partnership': '投资合作',
  wealth: '财运',
  marriage: '婚恋',
  relationship: '关系',
  'relationship-push': '关系推进',
  'relationship-decision': '关系去留',
  'reconciliation-decision': '复合判断',
  children: '子女',
  family: '家庭与六亲',
  'home-move': '搬家置业',
  'settle-relocate': '定居换城',
  social: '人际',
  emotion: '情绪',
  health: '健康',
  parents: '父母',
  study: '学业',
  'study-advance': '考证进修',
  'exam-landing': '考试上岸',
  growth: '成长',
  talent: '天赋',
};

const TOPIC_FACT_FOCUS: Partial<Record<BaziPromptTopic, string>> = {
  career: '月令、官杀、印星、财星与驿马',
  'job-change': '月令、官杀、印星、驿马与冲合关系',
  'startup-partnership': '财星、官杀、比劫、财库与合作关系',
  'investment-partnership': '财星、财库、比劫及合冲刑害',
  wealth: '财星、财库、比劫与身强身弱条件',
  marriage: '日支夫妻宫、配偶星及合冲刑害',
  relationship: '日支夫妻宫、配偶星与合冲刑害',
  'relationship-push': '日支夫妻宫、配偶星与合冲关系',
  'relationship-decision': '日支夫妻宫、配偶星与制约关系',
  'reconciliation-decision': '日支夫妻宫、配偶星与合冲刑害',
  children: '子女星、时柱与食伤',
  family: '年柱、月柱、六亲十神与原局干支关系',
  'home-move': '日支、财库与冲合刑害',
  'settle-relocate': '迁移取象、日支与驿马',
  social: '比劫、食伤与合冲刑害',
  emotion: '日主旺衰、印星食伤与五行偏枯',
  health: '五行偏枯、日主旺衰与地支刑冲',
  parents: '年柱月柱与印星财星',
  study: '印星、食伤与官星',
  'study-advance': '印星、食伤与官星',
  'exam-landing': '印星、食伤与官星',
  growth: '日主旺衰、格局取用与原局关系',
  talent: '日主、食伤、印星、格局与五行作用方向',
  recent: '本次分析资料所列层级的实际干支、关系与取用',
};

function formatFullFortune(result: BaziChartResult) {
  return result ? formatBaziFullFortune(result) : '';
}

export interface BaziPromptOptions extends PromptBuildOptions {
  result: BaziChartResult;
  topic?: BaziPromptTopic;
  mode?: BaziPromptMode;
  school?: BaziPromptSchool;
  schools?: readonly BaziPromptSchool[];
  fortuneScope?: BaziPromptFortuneScope;
  fortuneFocus?: string;
  /**
   * 页面、服务端或其他调用方已选中的具体岁运资料。
   * 传入后只把所选层级、必要上下层背景与主要触发写入提示词。
   */
  fortuneSelectionContext?: FortuneSelectionContext | null;
  selection?: PromptSelection;
}

function getBaziTopicTask(topic: BaziPromptTopic, topicLabel: string): string {
  switch (topic) {
    case 'job-change':
    case 'career':
      return `请依据八字排盘资料分析${topicLabel}：核对原局格局、官印食伤与取用，再结合已列岁运的干支作用说明当前时间窗口。将盘面线索与【问题】中的实际职业选择对应，给出需要核对的条件。`;
    case 'marriage':
    case 'relationship':
    case 'relationship-push':
    case 'relationship-decision':
    case 'reconciliation-decision':
      return `请依据八字排盘资料分析${topicLabel}：核对日支夫妻宫、配偶星与实际命中的合冲刑害，再结合已列岁运说明所选时间窗口的关系变化条件。将传统取义与【问题】中的相处事实对应。`;
    case 'wealth':
    case 'investment-partnership':
    case 'startup-partnership':
      return `请依据八字排盘资料分析${topicLabel}：核对日主旺衰、财星状态、食伤与比劫的实际作用，结合已列岁运说明所选时间窗口的条件变化。将盘面取象与【问题】中的收入、负债或合伙事实分开陈述。`;
    case 'study':
    case 'study-advance':
    case 'exam-landing':
      return `请依据八字排盘资料分析${topicLabel}：核对印星、食伤与实际形成的官印或伤官配印结构，结合已列岁运说明所选时间窗口的传统取象，并与【问题】中的备考条件对应。`;
    case 'health':
      return `请依据八字排盘资料分析${topicLabel}的传统五行取象：核对月令、根气、寒暖燥湿与实际成立的刑冲，结合已列岁运说明所选时间窗口，并与【问题】中的症状、检查结果及作息资料分别对应。`;
    default:
      return `请依据八字排盘资料${topicLabel === '通用' ? '完成整体解读' : `重点分析${topicLabel}`}，结合问题给出有依据的分析。`;
  }
}

export function formatBaziTopicFocus(topic: BaziPromptTopic, unknownTime = false) {
  const focus = TOPIC_FACT_FOCUS[topic];
  return focus
    ? unknownTime
      ? `优先核对${TOPIC_LABELS[topic]}相关的${focus}，结合所列时辰候选逐项分析。`
      : `优先核对${TOPIC_LABELS[topic]}相关的${focus}；其余已列四柱、取用和关系资料继续作为交叉依据。`
    : '';
}

export function buildBaziUnknownTimeTask(
  topicLabel: string,
  isBatch: boolean,
  custom: boolean,
): string {
  const subject = isBatch ? '本页所列出生时辰候选' : '已列出生时辰候选';
  const purpose = custom ? '回答【问题】' : `重点分析${topicLabel}，回答【问题】`;
  const comparison = isBatch
    ? '说明当前候选的旺衰、格局和取用依据，并列出与问题相关的出生时分核实要点。'
    : '比较各候选共有与有别的旺衰、格局和取用条件，并列出与问题相关的出生时分核实要点。';
  return `请依据${subject}，${purpose}；${comparison}`;
}

export function formatBaziPatternConditions(result: BaziChartResult): string {
  const fulfillment = result.analysis?.mingGe?.fulfillment;
  const specialAdjudication = result.analysis?.mingGe?.specialAdjudication;
  const facts: string[] = [];

  // 排盘正文已有所取格局、成败和判定理由，此处只补充影响结论的实际作用。
  if (specialAdjudication?.status === '成立') {
    if (!fulfillment) {
      const pattern = result.analysis.mingGe;
      const basis = pattern.basis ?? '';
      const routeAlreadySummarized =
        Boolean(specialAdjudication.route && basis.includes(specialAdjudication.route)) ||
        (specialAdjudication.kind === '曲直格' &&
          specialAdjudication.route === '亥卯未木局' &&
          basis.includes('亥卯未曲直法') &&
          basis.includes('木局')) ||
        (specialAdjudication.kind === '曲直格' &&
          specialAdjudication.route === '寅卯辰东方' &&
          basis.includes('春生寅卯辰法条件成立'));
      const decisionAlreadySummarized =
        specialAdjudication.status === '成立' &&
        pattern.pattern === specialAdjudication.kind &&
        basis.includes('成立') &&
        routeAlreadySummarized &&
        Boolean(specialAdjudication.method && basis.includes(specialAdjudication.method));
      const statedSpecialDetails = [specialAdjudication.route, specialAdjudication.method].filter(
        (detail) => detail && !basis.includes(detail),
      );
      if (!decisionAlreadySummarized) {
        facts.push(
          `特殊格裁决：${specialAdjudication.kind}${specialAdjudication.status}${statedSpecialDetails.length ? `；${statedSpecialDetails.join('；')}` : ''}`,
        );
      }
    }
    if (specialAdjudication.status === '成立' && specialAdjudication.kind === '从儿格') {
      const chartFacts = formatBaziForPrompt(result);
      const flowAlreadyShown =
        result.analysis.mingGe.basis?.includes('承接食伤所生') &&
        chartFacts.includes(
          `食伤${specialAdjudication.outputElement}生财星${specialAdjudication.wealthElement}`,
        );
      if (!flowAlreadyShown) {
        facts.push(
          `从儿五行流向：食伤${specialAdjudication.outputElement}生财${specialAdjudication.wealthElement}`,
        );
      }
      facts.push(
        ...specialAdjudication.functionalResolutions
          .filter((item) => !chartFacts.includes(item))
          .map((item) => `顺局作用：${item}`),
      );
    }
  }

  if (
    fulfillment &&
    (fulfillment.status === '破格' || fulfillment.status === '破而复成') &&
    hasConfirmedPatternTarget(result.analysis.mingGe)
  ) {
    const decisionDetail = fulfillment.decisionDetail || fulfillment.summary;
    const statedDecision = formatPatternDecisionForPrompt(result.analysis.mingGe);
    const statedBreakers =
      result.analysis.usefulGod?.decisionEvidence?.patternBreakerRestrictions ?? [];
    for (const breaker of fulfillment.activeBreakers ?? []) {
      const breakerInDecision =
        statedDecision.includes(breaker.label) &&
        breaker.stems.length > 0 &&
        breaker.stems.every((stem) => result.pillars[stem.pillar].gan === stem.stem);
      const breakerInUsefulGod =
        breaker.stems.length > 0 &&
        statedBreakers.some(
          (stated) =>
            stated.label === breaker.label &&
            breaker.stems.every((stem) =>
              stated.stems.some((item) => item.stem === stem.stem && item.pillar === stem.pillar),
            ),
        );
      const path =
        breaker.repairStatus === '满足'
          ? fulfillment.pathEvaluations?.find(
              (item) =>
                breaker.repairPathKeys.includes(item.key) && item.status === breaker.repairStatus,
            )
          : undefined;
      const pathAlreadyStated =
        path &&
        result.analysis.usefulGod?.decisionEvidence?.controlFunctions?.some(
          (item) =>
            item.status === '满足' &&
            item.sourceStems.length > 0 &&
            item.targetStems.length > 0 &&
            item.label === path.label &&
            item.sourceStems.length === path.sourceStems.length &&
            item.sourceStems.every((stem) => path.sourceStems.includes(stem)) &&
            item.targetStems.length === path.targetStems.length &&
            item.targetStems.every((stem) => path.targetStems.includes(stem)),
        );
      if (!breakerInDecision && !breakerInUsefulGod) {
        const stems = breaker.stems
          .map((item) => `${item.stem}${item.tenGod}（${item.pillarName}）`)
          .join('、');
        facts.push(`破格项：${breaker.label}${stems ? `（${stems}）` : ''}`);
      }
      if (breaker.repairStatus === '满足') {
        if (path && !decisionDetail.includes(path.detail) && !pathAlreadyStated) {
          facts.push(
            path.source.length && path.target.length
              ? `救应路径：${path.label}；${path.source.join('、')}作用于${path.target.join('、')}（${path.position}、根气可用）`
              : `救应路径：${path.label}；${path.detail}`,
          );
        }
      }
    }
  }

  return [...new Set(facts)].join('\n');
}

export function buildBaziPromptDocument(options: BaziPromptOptions): PromptDocument {
  const topic = options.topic ?? 'general';
  const topicLabel = TOPIC_LABELS[topic];
  const question = options.question?.trim() || `请围绕${topicLabel}解读这份八字资料。`;
  const hasFortuneData = Boolean(
    options.fortuneSelectionContext ||
    options.fortuneFocus?.trim() ||
    (options.fortuneScope === 'full' && options.result.luckInfo?.cycles?.length),
  );
  const taskMethod = hasFortuneData ? 'bazi' : 'bazi-natal';
  const hasKnownPillars = (['year', 'month', 'day'] as const).some((key) =>
    Boolean(options.result.pillars[key].ganZhi),
  );
  const task = options.result.isThreePillars
    ? buildBaziUnknownTimeTask(
        topicLabel,
        Boolean(options.result.unknownTimeAnalysis?.batch),
        options.mode === 'custom',
      )
    : options.mode === 'custom'
      ? buildCustomQuestionTask('八字排盘资料', taskMethod)
      : buildPromptTask(
          hasFortuneData
            ? getBaziTopicTask(topic, topicLabel)
            : `请依据四柱原局资料重点分析${topicLabel}，回答【问题】。`,
          taskMethod,
        );
  const selectedTask = options.selection ? buildPromptSelectionTask(task, options.selection) : task;
  const selectedSchools = normalizeBaziPromptSchools(options.schools);
  const chartScene =
    selectedSchools.length || options.school ? 'school' : hasFortuneData ? 'fortune' : 'general';
  const chart = formatBaziForPrompt(options.result, null, chartScene);
  const fortuneSelection = formatBaziFortuneSelection(options.fortuneSelectionContext);
  const fortuneFocus = [options.fortuneFocus?.trim(), fortuneSelection?.focus.trim()]
    .filter(Boolean)
    .join('\n');
  const scopeText = fortuneSelection
    ? fortuneSelection.analysisObject
    : hasFortuneData && options.fortuneScope && options.fortuneScope !== 'natal'
      ? `分析对象：${options.fortuneScope === 'full' ? '本命盘与完整大运流年' : options.fortuneScope}`
      : options.result.isThreePillars
        ? `分析对象：${options.result.unknownTimeAnalysis?.batch ? '本页' : '已列'}出生时辰候选${hasKnownPillars ? '与已确定的柱' : ''}`
        : '分析对象：本命盘';
  const patternConditions = formatBaziPatternConditions(options.result);
  const focusSection =
    !selectedSchools.length && !options.school && patternConditions
      ? buildPromptSection('格局条件', patternConditions)
      : '';

  const user = joinPromptSections([
    buildPromptGuidance('bazi'),
    buildPromptSection('当前时间', formatPromptCurrentTime(options.currentTime)),
    buildPromptSection('排盘信息', chart),
    formatBaziTopicFocus(topic, options.result.isThreePillars)
      ? buildPromptSection('主题取用', formatBaziTopicFocus(topic, options.result.isThreePillars))
      : '',
    focusSection,
    selectedSchools.length
      ? buildPromptSection(
          selectedSchools.length > 1 ? '多派合参' : '解读流派',
          formatBaziSchoolsPrompt(options.result, selectedSchools, true, true),
        )
      : options.school
        ? buildPromptSection(
            '流派',
            formatBaziSchoolPrompt(options.result, options.school, true, true),
          )
        : '',
    buildPromptSection('分析对象', scopeText),
    fortuneFocus ? buildPromptSection('岁运重点', fortuneFocus) : '',
    options.fortuneScope === 'full'
      ? buildPromptSection('命限资料', formatFullFortune(options.result))
      : '',
    options.selection
      ? buildPromptSection('解读选择', getPromptSelectionSection(options.selection))
      : '',
    buildPromptSection('任务', selectedTask),
    buildPromptSection('问题', question),
  ]);

  return buildPromptDocument(appendClassicalReferences(user, 'bazi', options.includeClassics));
}

export function buildBaziPrompt(options: BaziPromptOptions) {
  return buildBaziPromptDocument(options).text;
}

export const buildBaziPromptForResult = buildBaziPrompt;

export type BaziCompatibilityType =
  'marriage' | 'career' | 'friendship' | 'children' | 'parents' | 'siblings';

const COMPATIBILITY_LABELS: Record<BaziCompatibilityType, string> = {
  marriage: '合婚',
  career: '合伙',
  friendship: '友情',
  children: '子女',
  parents: '父母',
  siblings: '兄弟姐妹',
};

export interface BaziCompatibilityPromptOptions extends PromptBuildOptions {
  result1: BaziChartResult;
  result2: BaziChartResult;
  schools?: readonly BaziPromptSchool[];
  compatibilityType?: BaziCompatibilityType;
  person1Name?: string;
  person2Name?: string;
}

export function buildBaziCompatibilityPromptDocument(
  options: BaziCompatibilityPromptOptions,
): PromptDocument {
  const relation = analyzeBaziCompatibility(options.result1, options.result2, {
    person1Name: options.person1Name,
    person2Name: options.person2Name,
  });
  const question =
    options.question?.trim() || '请分析双方关系中的主要互动、互补、冲突与共同发展条件。';
  const relationLabel = options.compatibilityType
    ? COMPATIBILITY_LABELS[options.compatibilityType]
    : '';
  const evidence = [
    `日主关系：${relation.dayMasterRelation.promptText}`,
    `四柱关系：${relation.crossPillarRelations.map((item) => item.promptText).join('；') || '未见已列关系'}`,
    relation.crossBranchCombinations.length
      ? `跨盘组合：${relation.crossBranchCombinations.map((item) => item.promptText).join('；')}`
      : '',
    `双向十神：${relation.tenGodMappings.map((item) => item.promptText).join('；') || '未记录'}`,
    `喜忌覆盖：${
      relation.usefulGodCoverage
        .map((item) => formatBaziUsefulGodCoverageForPrompt(item))
        .join('；') || '资料不足'
    }`,
    relation.summaryFact.promptText,
  ]
    .filter(Boolean)
    .join('\n');
  const selectedSchools = normalizeBaziPromptSchools(options.schools);
  const schoolText = formatPromptSchoolGuidance('bazi', selectedSchools);
  const patternConditions1 = formatBaziPatternConditions(options.result1);
  const patternConditions2 = formatBaziPatternConditions(options.result2);

  const user = joinPromptSections([
    buildPromptGuidance('bazi-compatibility'),
    buildPromptSection('当前时间', formatPromptCurrentTime(options.currentTime)),
    buildPromptSection(
      '第一人排盘信息',
      formatBaziForPrompt(options.result1, null, 'compatibility'),
    ),
    buildPromptSection(
      '第二人排盘信息',
      formatBaziForPrompt(options.result2, null, 'compatibility'),
    ),
    patternConditions1 ? buildPromptSection('第一人格局条件', patternConditions1) : '',
    patternConditions2 ? buildPromptSection('第二人格局条件', patternConditions2) : '',
    schoolText
      ? buildPromptSection(selectedSchools.length > 1 ? '多派合参' : '解读流派', schoolText)
      : '',
    buildPromptSection('双盘关系资料', evidence),
    relationLabel ? buildPromptSection('关系范围', relationLabel) : '',
    buildPromptSection(
      '任务',
      buildPromptTask(
        '请依据双方盘面与双盘关系资料回答问题，分别列出共同证据、分歧证据和需要结合现实核对的部分。',
        'bazi-compatibility',
      ),
    ),
    buildPromptSection('问题', question),
  ]);
  return buildPromptDocument(appendClassicalReferences(user, 'bazi', options.includeClassics));
}

export function buildBaziCompatibilityPrompt(options: BaziCompatibilityPromptOptions) {
  return buildBaziCompatibilityPromptDocument(options).text;
}

export const getCompatibilityPrompt = buildBaziCompatibilityPrompt;
