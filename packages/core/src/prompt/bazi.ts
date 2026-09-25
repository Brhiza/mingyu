import {
  analyzeBaziCompatibility,
  formatBaziForPrompt,
  formatBaziUsefulGodCoverageForPrompt,
  type BaziChartResult,
} from '../bazi/index';
import type { FortuneSelectionContext } from '../bazi/fortuneSelection';
import { formatBaziFullFortune, formatBaziFortuneSelection } from './bazi-fortune';
import { formatPromptCurrentTime } from './current-time';
import { buildCustomQuestionTask, buildPromptGuidance, buildPromptTask } from './guidance';
import { buildPromptDocument, buildPromptSection, joinPromptSections } from './sections';
import type { PromptBuildOptions, PromptDocument } from './types';
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
  recent: '【分析对象】所列层级的实际干支、关系与取用',
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
      return `请依据八字排盘资料重点分析${topicLabel}，按正统子平法推演：一辨原局格局成破与官印喜忌，二析大运当前十年气机是助身还是克身，三察岁运冲合是否引动官杀职位、印星单位或驿马提纲，四权衡动静利弊给出宜动或宜守之应期时序，五给出契合喜用的行业五行与发展方位建议。`;
    case 'marriage':
    case 'relationship':
    case 'relationship-push':
    case 'relationship-decision':
    case 'reconciliation-decision':
      return `请依据八字排盘资料重点分析${topicLabel}，按正统子平法推演：一辨配偶星与夫妻宫日支之生克安宁，二察原局是否存在刑冲破害或比劫争夺，三审岁运引动逢合逢冲之转折契机，四推断感情转机或关键节点时序，五给出相处磨合之趋避建议。`;
    case 'wealth':
    case 'investment-partnership':
    case 'startup-partnership':
      return `请依据八字排盘资料重点分析${topicLabel}，按正统子平法推演：一辨身强身弱与财星真伪（身旺任财还是身弱财多），二察局中财库开闭与比劫争夺之病药，三审岁运是否引动财星或冲开财库，四指出财帛丰盈与谨防破耗借贷风险之关键节点，五给出求财合伙之趋避策略。`;
    case 'study':
    case 'study-advance':
    case 'exam-landing':
      return `请依据八字排盘资料重点分析${topicLabel}，按正统子平法推演：一辨印星与食伤之清纯得力程度，二察文星气象，三推演岁运是否官印相生吐秀或逢财破印阻滞，四指出发挥最佳之应考时段与调节要点。`;
    case 'health':
      return `请依据八字排盘资料重点分析${topicLabel}，依五行生克与藏象学说推演：一辨原局五行偏枯与强弱，二察地支刑冲对相应脏腑经络之冲击，三结合岁运引动指出需要防范之时段，四给出五行调候与生活起居之趋避建议。`;
    default:
      return `请依据八字排盘资料${topicLabel === '通用' ? '完成整体解读' : `重点分析${topicLabel}`}，结合问题给出有依据的分析。`;
  }
}

export function formatBaziTopicFocus(topic: BaziPromptTopic) {
  const focus = TOPIC_FACT_FOCUS[topic];
  return focus
    ? `优先核对${TOPIC_LABELS[topic]}相关的${focus}；其余已列四柱、取用和关系资料继续作为交叉依据。`
    : '';
}

export function formatBaziPatternConditions(result: BaziChartResult): string {
  const transformation = result.analysis?.mingGe?.transformation;
  const fulfillment = result.analysis?.mingGe?.fulfillment;
  const specialAdjudication = result.analysis?.mingGe?.specialAdjudication;
  const facts: string[] = [];

  // 排盘正文已有所取格局、成败和判定理由，此处只补充影响结论的实际作用。
  if (transformation && transformation.status !== '成化' && !fulfillment && !specialAdjudication) {
    facts.push(
      `化气判定：${transformation.status}；化神${transformation.element}；${transformation.basis}`,
    );
  }

  if (specialAdjudication && (specialAdjudication.status === '成立' || !fulfillment)) {
    if (!fulfillment) {
      const pattern = result.analysis.mingGe;
      const basis = pattern.basis ?? '';
      const decisionAlreadySummarized =
        specialAdjudication.status === '成立' &&
        pattern.pattern === specialAdjudication.kind &&
        basis.includes('成立') &&
        Boolean(specialAdjudication.route && basis.includes(specialAdjudication.route)) &&
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
      facts.push(
        `从儿五行流向：食伤${specialAdjudication.outputElement}生财${specialAdjudication.wealthElement}`,
      );
      facts.push(
        ...specialAdjudication.functionalResolutions
          .filter((item) => !result.analysis.mingGe.basis?.includes(item))
          .map((item) => `顺局作用：${item}`),
      );
      if (specialAdjudication.retainedHiddenFacts.length) {
        facts.push('支藏印官未构成从儿格的实际反证');
      }
    }
    if (specialAdjudication.status === '不成立' && specialAdjudication.blockers.length) {
      facts.push(`特殊格反证：${specialAdjudication.blockers.join('；')}`);
    }
  }

  if (fulfillment && fulfillment.status !== '成格') {
    const decisionDetail = fulfillment.decisionDetail || fulfillment.summary;
    const statedBreakers =
      result.analysis.usefulGod?.decisionEvidence?.patternBreakerRestrictions ?? [];
    const repeatedStrength = `日主旺衰为${result.analysis.dayMasterStrength.status}；`;
    facts.push(
      ...(fulfillment.conditionFacts ?? [])
        .filter(
          (item) =>
            item.status !== '满足' &&
            item.key !== 'bazi.day-master-strength' &&
            !item.key.startsWith('path.') &&
            !item.key.startsWith('pattern.breaker.') &&
            !decisionDetail.includes(item.detail),
        )
        .map((item) => {
          const detail = item.detail.startsWith(repeatedStrength)
            ? item.detail.slice(repeatedStrength.length)
            : item.detail;
          return `条件核验：${item.status}；${detail}`;
        }),
    );
    for (const breaker of fulfillment.activeBreakers ?? []) {
      if (
        breaker.repairStatus === '不满足' &&
        breaker.stems.length > 0 &&
        statedBreakers.some(
          (stated) =>
            stated.label === breaker.label &&
            breaker.stems.every((stem) =>
              stated.stems.some((item) => item.stem === stem.stem && item.pillar === stem.pillar),
            ),
        )
      ) {
        continue;
      }
      const stems = breaker.stems
        .map((item) => `${item.stem}${item.tenGod}（${item.pillarName}）`)
        .join('、');
      facts.push(
        `破格项：${breaker.label}${stems ? `（${stems}）` : ''}；救应${breaker.repairStatus}`,
      );
      if (breaker.repairStatus === '满足' || breaker.repairStatus === '资料不足') {
        const path = fulfillment.pathEvaluations?.find(
          (item) =>
            breaker.repairPathKeys.includes(item.key) && item.status === breaker.repairStatus,
        );
        if (path && !decisionDetail.includes(path.detail)) {
          const detail = path.detail.startsWith(`${path.label}的`)
            ? path.detail.slice(path.label.length + 1)
            : path.detail.startsWith(path.label)
              ? path.detail.slice(path.label.length)
              : path.detail;
          facts.push(`救应路径：${path.label}（${path.position}）；${detail}`);
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
  const task =
    options.mode === 'custom'
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
    formatBaziTopicFocus(topic) ? buildPromptSection('主题取用', formatBaziTopicFocus(topic)) : '',
    focusSection,
    selectedSchools.length
      ? buildPromptSection(
          selectedSchools.length > 1 ? '多派合参' : '解读流派',
          formatBaziSchoolsPrompt(options.result, selectedSchools, true),
        )
      : options.school
        ? buildPromptSection('流派', formatBaziSchoolPrompt(options.result, options.school, true))
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

  return buildPromptDocument(user);
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
    `跨盘组合：${relation.crossBranchCombinations.map((item) => item.promptText).join('；') || '未见已列组合'}`,
    `双向十神：${relation.tenGodMappings.map((item) => item.promptText).join('；') || '未记录'}`,
    `喜忌覆盖：${
      relation.usefulGodCoverage
        .map((item) => formatBaziUsefulGodCoverageForPrompt(item))
        .join('；') || '资料不足'
    }`,
    relation.summaryFact.promptText,
  ].join('\n');
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
  return buildPromptDocument(user);
}

export function buildBaziCompatibilityPrompt(options: BaziCompatibilityPromptOptions) {
  return buildBaziCompatibilityPromptDocument(options).text;
}

export const getCompatibilityPrompt = buildBaziCompatibilityPrompt;
