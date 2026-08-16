import { buildPromptGuidanceSections } from '../../prompt/guidance';
import { formatPromptCurrentTime } from '../../prompt/current-time';
import { buildPromptSchoolSection, type PromptSchoolId } from '../../prompt/schools';
import type { AnalysisPayloadV1 } from '../../types/analysis';
import {
  analyzeZiweiCompatibility,
  type ZiweiCompatibilityOptions,
} from '../iztro/compatibility-evidence';
import type { ZiweiRuntime } from '../runtime';
import { buildZiweiTaskBookSnapshot } from './snapshot';
import type { ZiweiPromptContext } from './types';

type ZiweiTrueSolarEvidence = NonNullable<ZiweiRuntime['trueSolarEvidence']>;

const ZIWEI_REPORT_TOPICS: Record<
  string,
  { reportType: string; reportTitle: string; selectedTopic: string }
> = {
  destiny: {
    reportType: 'destiny-overview',
    reportTitle: '命局综述',
    selectedTopic: 'destiny',
  },
  relationship: {
    reportType: 'relationship',
    reportTitle: '婚姻感情报告',
    selectedTopic: 'relationship',
  },
  'relationship-push': {
    reportType: 'relationship-push',
    reportTitle: '关系推进报告',
    selectedTopic: 'relationship-push',
  },
  'relationship-decision': {
    reportType: 'relationship-decision',
    reportTitle: '关系去留报告',
    selectedTopic: 'relationship-decision',
  },
  children: {
    reportType: 'children',
    reportTitle: '子女亲缘报告',
    selectedTopic: 'children',
  },
  'career-wealth': {
    reportType: 'career-wealth',
    reportTitle: '事业财运报告',
    selectedTopic: 'career-wealth',
  },
  'job-change': {
    reportType: 'job-change',
    reportTitle: '工作变动报告',
    selectedTopic: 'job-change',
  },
  'startup-partnership': {
    reportType: 'startup-partnership',
    reportTitle: '创业合作报告',
    selectedTopic: 'startup-partnership',
  },
  'investment-partnership': {
    reportType: 'investment-partnership',
    reportTitle: '投资合作报告',
    selectedTopic: 'investment-partnership',
  },
  recent: {
    reportType: 'recent',
    reportTitle: '近期趋势报告',
    selectedTopic: 'recent',
  },
  family: {
    reportType: 'family',
    reportTitle: '六亲家庭报告',
    selectedTopic: 'family',
  },
  'home-move': {
    reportType: 'home-move',
    reportTitle: '搬家置业报告',
    selectedTopic: 'home-move',
  },
  'settle-relocate': {
    reportType: 'settle-relocate',
    reportTitle: '定居换城报告',
    selectedTopic: 'settle-relocate',
  },
  social: {
    reportType: 'social',
    reportTitle: '人际合作报告',
    selectedTopic: 'social',
  },
  emotion: {
    reportType: 'emotion',
    reportTitle: '情绪调节报告',
    selectedTopic: 'emotion',
  },
  health: {
    reportType: 'health',
    reportTitle: '健康养护报告',
    selectedTopic: 'health',
  },
  study: {
    reportType: 'study',
    reportTitle: '学业成长报告',
    selectedTopic: 'study',
  },
  'study-advance': {
    reportType: 'study-advance',
    reportTitle: '考证进修报告',
    selectedTopic: 'study-advance',
  },
  'exam-landing': {
    reportType: 'exam-landing',
    reportTitle: '考试上岸报告',
    selectedTopic: 'exam-landing',
  },
  'reconciliation-decision': {
    reportType: 'reconciliation-decision',
    reportTitle: '复合判断报告',
    selectedTopic: 'reconciliation-decision',
  },
  growth: {
    reportType: 'growth',
    reportTitle: '成长课题报告',
    selectedTopic: 'growth',
  },
  talent: {
    reportType: 'talent',
    reportTitle: '天赋优势报告',
    selectedTopic: 'talent',
  },
  life: {
    reportType: 'life',
    reportTitle: '人生解析报告',
    selectedTopic: 'life',
  },
  chat: {
    reportType: 'chat',
    reportTitle: '自由问答',
    selectedTopic: 'chat',
  },
};

function createZiweiReportContext(payload: AnalysisPayloadV1, topic: string): ZiweiPromptContext {
  const matched = ZIWEI_REPORT_TOPICS[topic] ?? ZIWEI_REPORT_TOPICS.chat;
  const isOriginDestiny = topic === 'destiny' && payload.active_scope.scope === 'origin';
  return {
    reportKey: `${matched.selectedTopic}:${payload.active_scope.scope}:${payload.active_scope.solar_date}`,
    reportTitle:
      topic === 'destiny' && !isOriginDestiny
        ? `${payload.active_scope.label}报告`
        : matched.reportTitle,
    reportType: topic === 'destiny' && !isOriginDestiny ? 'scope' : matched.reportType,
    selectedTopic: matched.selectedTopic,
    scope: payload.active_scope.scope,
    scopeLabel: payload.active_scope.label,
    focusNotes: [],
  };
}

function demoteEmbeddedPromptSections(content: string) {
  return content.replace(/^【([^】]+)】$/gm, '$1：');
}

function buildZiweiCompatibilityInfo(result: ReturnType<typeof analyzeZiweiCompatibility>) {
  const overlayLines = result.palaceOverlays
    .filter((item) =>
      ['命宫', '身宫', '夫妻', '官禄', '财帛', '福德', '迁移'].some(
        (name) => item.sourcePalace.includes(name) || item.targetPalace.includes(name),
      ),
    )
    .slice(0, 12)
    .map((item) => {
      const sourceStars = item.sourceMajorStars.length
        ? `，主星${item.sourceMajorStars.join('、')}`
        : '';
      const targetStars = item.targetMajorStars.length
        ? `；对方该宫主星${item.targetMajorStars.join('、')}`
        : '';
      return `- ${result.people[item.sourcePerson]}${item.sourcePalace}与${result.people[item.targetPerson]}${item.targetPalace}同在${item.earthlyBranch}轴${sourceStars}${targetStars}`;
    });
  const mutagenLines = result.crossMutagenPlacements
    .slice(0, 12)
    .map(
      (item) =>
        `- ${result.people[item.sourcePerson]}${item.sourcePalace}的${item.star}生年化${item.mutagen}，对应${result.people[item.targetPerson]}${item.targetPalace}`,
    );

  return [
    overlayLines.length ? '宫位对应：' : '',
    ...overlayLines,
    mutagenLines.length ? '跨盘四化：' : '',
    ...mutagenLines,
  ]
    .filter(Boolean)
    .join('\n');
}

/** 提取紫微真太阳时证据中适合提示词展示的校正时刻与时辰。 */
export function formatZiweiTrueSolarEvidence(evidence?: ZiweiTrueSolarEvidence): string {
  if (!evidence) return '';
  const corrected = evidence.correctionFacts
    .find((fact) => fact.type === '总校正')
    ?.promptText.match(/真太阳时为(.+)$/)?.[1];
  const shichen = evidence.correctionFacts
    .find((fact) => fact.type === '时辰结果')
    ?.promptText.match(/唯一时辰为(.+?)（/)?.[1];
  return [corrected ? `真太阳时：${corrected}` : '', shichen ? `时辰：${shichen}` : '']
    .filter(Boolean)
    .join('，');
}

export interface CombinedZiweiPromptOptions {
  isCustomQuestion?: boolean;
  trueSolarEvidence?: ZiweiTrueSolarEvidence;
  /** 固定提示词中的当前时间；省略时使用调用时刻。 */
  currentTime?: Date;
}

/** 将紫微结构化盘面、传统依据、问题与任务组合成可直接交给在线 AI 的任务书。 */
export function buildCombinedZiweiPrompt(
  payload: AnalysisPayloadV1,
  topic: string,
  question: string,
  options: CombinedZiweiPromptOptions = {},
) {
  const isCustomQuestion = Boolean(options.isCustomQuestion);
  const normalizedQuestion = question.trim() || '请先做整体解读。';
  const reportContext = createZiweiReportContext(payload, topic);
  const pack = buildZiweiTaskBookSnapshot({ payload, reportContext });
  const trueSolarText = formatZiweiTrueSolarEvidence(options.trueSolarEvidence);

  return [
    buildPromptGuidanceSections('ziwei'),
    `【当前时间】\n${formatPromptCurrentTime(options.currentTime)}`,
    trueSolarText ? `【出生时间校正】\n${trueSolarText}` : '',
    '',
    pack,
    '',
    ...(normalizedQuestion ? [`【问题】\n${normalizedQuestion}`] : []),
    '',
    ...(isCustomQuestion ? [] : ['【任务】\n请结合宫位、星曜、四化和三方四正直接回答【问题】。']),
  ].join('\n');
}

export interface CombinedZiweiCompatibilityPromptOptions {
  primaryPayload: AnalysisPayloadV1;
  partnerPayload: AnalysisPayloadV1;
  /** 可选的原生 iztro 星盘对象；必须双方同时提供。 */
  primaryAstrolabe?: object;
  /** 可选的原生 iztro 星盘对象；必须双方同时提供。 */
  partnerAstrolabe?: object;
  topic: string;
  question: string;
  isCustomQuestion?: boolean;
  primaryName?: string;
  partnerName?: string;
  primaryTrueSolarEvidence?: ZiweiTrueSolarEvidence;
  partnerTrueSolarEvidence?: ZiweiTrueSolarEvidence;
  /** 一至三个紫微解读流派；多个值会生成分派判断、共识与分歧任务。 */
  schools?: readonly PromptSchoolId<'ziwei'>[];
  /** 固定提示词中的当前时间；省略时使用调用时刻。 */
  currentTime?: Date;
}

/** 生成包含双方盘面、宫位叠盘与跨盘四化资料的紫微合盘任务书。 */
export function buildCombinedZiweiCompatibilityPrompt(
  params: CombinedZiweiCompatibilityPromptOptions,
) {
  const primaryContext = createZiweiReportContext(params.primaryPayload, params.topic);
  const partnerContext = createZiweiReportContext(params.partnerPayload, params.topic);
  const primaryPack = buildZiweiTaskBookSnapshot({
    payload: params.primaryPayload,
    reportContext: primaryContext,
  });
  const partnerPack = buildZiweiTaskBookSnapshot({
    payload: params.partnerPayload,
    reportContext: partnerContext,
  });
  const primaryEmbeddedPack = demoteEmbeddedPromptSections(primaryPack);
  const partnerEmbeddedPack = demoteEmbeddedPromptSections(partnerPack);
  const compatibilityResult = analyzeZiweiCompatibility(
    params.primaryPayload,
    params.partnerPayload,
    {
      person1Name: params.primaryName,
      person2Name: params.partnerName,
      astrolabe1: params.primaryAstrolabe as ZiweiCompatibilityOptions['astrolabe1'],
      astrolabe2: params.partnerAstrolabe as ZiweiCompatibilityOptions['astrolabe2'],
    },
  );
  const compatibilityInfo = buildZiweiCompatibilityInfo(compatibilityResult);
  const primaryName = params.primaryName?.trim() || '第一人';
  const partnerName = params.partnerName?.trim() || '第二人';
  const primaryTrueSolarText = formatZiweiTrueSolarEvidence(params.primaryTrueSolarEvidence);
  const partnerTrueSolarText = formatZiweiTrueSolarEvidence(params.partnerTrueSolarEvidence);
  const isCustomQuestion = Boolean(params.isCustomQuestion);
  const compatibilityQuestion =
    params.question.trim() || (isCustomQuestion ? '' : '请先做整体合盘解读。');
  const compatibilityInfoText = compatibilityInfo.trim();

  return [
    buildPromptGuidanceSections('ziwei-compatibility'),
    `【当前时间】\n${formatPromptCurrentTime(params.currentTime)}`,
    primaryTrueSolarText ? `【${primaryName}出生时间校正】\n${primaryTrueSolarText}` : '',
    partnerTrueSolarText ? `【${partnerName}出生时间校正】\n${partnerTrueSolarText}` : '',
    `【${primaryName}盘面】`,
    primaryEmbeddedPack,
    '',
    `【${partnerName}盘面】`,
    partnerEmbeddedPack,
    compatibilityInfoText ? ['', `【双盘关系资料】\n${compatibilityInfoText}`] : '',
    buildPromptSchoolSection('ziwei', params.schools),
    '',
    ...(compatibilityQuestion ? [`【问题】\n${compatibilityQuestion}`] : []),
    '',
    ...(isCustomQuestion ? [] : ['【任务】\n请依据双方紫微盘面和跨盘关系资料完成解读。']),
  ].join('\n');
}
