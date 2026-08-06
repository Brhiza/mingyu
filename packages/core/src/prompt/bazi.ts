import { analyzeBaziCompatibility, formatBaziForPrompt, type BaziChartResult } from '../bazi/index';
import type { FortuneSelectionContext } from '../bazi/fortuneSelection';
import { formatPromptCurrentTime } from './current-time';
import { buildPromptGuidance } from './guidance';
import { buildPromptDocument, buildPromptSection, joinPromptSections } from './sections';
import type { PromptBuildOptions, PromptDocument } from './types';

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
export type BaziPromptSchool = 'traditional' | 'ziping' | 'mangpai' | 'xinpai';
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

const SCHOOL_TEXT: Record<BaziPromptSchool, { label: string; task: string; basis: string }> = {
  traditional: {
    label: '子平派（传统）',
    task: '先以月令定格，结合日主得令、通根、透干与全局制化判断旺衰，再以调候、格局成败和岁运引动回答问题。',
    basis: '参考《渊海子平》《子平真诠》《三命通会》《滴天髓》《穷通宝鉴》。',
  },
  ziping: {
    label: '子平派',
    task: '以月令、旺衰、格局、调候和岁运为主线，先建立原局，再观察岁运引动。',
    basis: '参考《渊海子平》《子平真诠》《三命通会》《滴天髓》《穷通宝鉴》。',
  },
  mangpai: {
    label: '盲派',
    task: '以四柱宫位、十神落柱、藏干和组合取象为骨架，结合大运流年分段观察应期。',
    basis: '基础参照《渊海子平》《三命通会》《滴天髓》，组合取象按近现代盲派整理口径。',
  },
  xinpai: {
    label: '新派',
    task: '以日主旺衰为起点，观察五行流通、调候和生克制化，把大运、流年与原局作用叠加。',
    basis: '基础参照《子平真诠》《滴天髓》《穷通宝鉴》《三命通会》，五行流通按近现代新派整理口径。',
  },
};

function formatFullFortune(result: BaziChartResult) {
  const cycles = result.luckInfo?.cycles ?? [];
  if (!cycles.length) return '';
  return [
    '完整大运流年：',
    ...cycles.flatMap((cycle, index) => [
      `${index + 1}. ${cycle.ganZhi}${cycle.isXiaoyun ? '童运' : cycle.type}：${cycle.year}年起，约${cycle.age}岁交运`,
      ...(cycle.years ?? []).map((year) => `  - ${year.year}年（${year.age}岁）${year.ganZhi}`),
    ]),
  ].join('\n');
}

function formatSchoolSection(result: BaziChartResult, school: BaziPromptSchool) {
  const profile = SCHOOL_TEXT[school];
  const pillars = (['year', 'month', 'day', 'hour'] as const)
    .map(
      (key) =>
        `${{ year: '年柱', month: '月柱', day: '日柱', hour: '时柱' }[key]}${result.pillars[key].ganZhi}`,
    )
    .join('、');
  return [
    `八字流派：${profile.label}`,
    `流派任务：${profile.task}`,
    `流派依据：${profile.basis}`,
    `流派盘面资料：${pillars}；日主${result.dayMaster.gan}${result.dayMaster.element}，${result.analysis.dayMasterStrength.status}；格局${result.analysis.mingGe.pattern}`,
  ].join('\n');
}

export interface BaziPromptOptions extends PromptBuildOptions {
  result: BaziChartResult;
  topic?: BaziPromptTopic;
  mode?: BaziPromptMode;
  school?: BaziPromptSchool;
  fortuneScope?: BaziPromptFortuneScope;
  fortuneFocus?: string;
  /**
   * 页面、服务端或其他调用方已选中的具体岁运资料。
   * 传入后会把大运、流年、流月或流日的上下层背景、触发事实和边界资料
   * 一并写入提示词，避免调用方自行拼接而遗漏层级关系。
   */
  fortuneSelectionContext?: FortuneSelectionContext | null;
}

function formatFortuneSelectionContext(context: FortuneSelectionContext) {
  const payload = context.promptPayload;
  const detailGroups = (payload.detailGroups ?? [])
    .filter((group) => group.lines.length > 0)
    .map((group) => [group.title, ...group.lines].join('\n'));

  return [
    context.displayLabel ? `选定范围：${context.displayLabel}` : '',
    context.displayText ? `选定资料：${context.displayText}` : '',
    payload.scopeLabel,
    ...payload.summaryLines,
    ...detailGroups,
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildBaziPromptDocument(options: BaziPromptOptions): PromptDocument {
  const topic = options.topic ?? 'general';
  const topicLabel = TOPIC_LABELS[topic];
  const question = options.question?.trim() || `请围绕${topicLabel}解读这份八字资料。`;
  const task = `请依据八字排盘资料${topicLabel === '通用' ? '完成整体解读' : `重点分析${topicLabel}`}，结合问题给出有依据的分析。`;
  const chart = formatBaziForPrompt(
    options.result,
    null,
    options.fortuneScope === 'natal' ? 'general' : 'fortune',
  );
  const scopeText =
    options.fortuneScope && options.fortuneScope !== 'natal'
      ? `分析对象：${options.fortuneScope === 'full' ? '本命盘与完整大运流年' : options.fortuneScope}`
      : '分析对象：本命盘';

  const user = joinPromptSections([
    buildPromptGuidance('bazi'),
    buildPromptSection('当前时间', formatPromptCurrentTime(options.currentTime)),
    buildPromptSection('排盘信息', chart),
    options.school
      ? buildPromptSection('流派', formatSchoolSection(options.result, options.school))
      : '',
    buildPromptSection('分析对象', scopeText),
    options.fortuneFocus ? buildPromptSection('岁运重点', options.fortuneFocus) : '',
    options.fortuneSelectionContext
      ? buildPromptSection(
          '指定岁运资料',
          formatFortuneSelectionContext(options.fortuneSelectionContext),
        )
      : '',
    options.fortuneScope === 'full'
      ? buildPromptSection('命限资料', formatFullFortune(options.result))
      : '',
    buildPromptSection('问题', question),
    buildPromptSection('任务', task),
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
    `喜忌覆盖：${relation.usefulGodCoverage.map((item) => item.promptText).join('；') || '资料不足'}`,
    relation.summaryFact.promptText,
  ].join('\n');

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
    buildPromptSection('双盘关系资料', evidence),
    relationLabel ? buildPromptSection('关系范围', relationLabel) : '',
    buildPromptSection('问题', question),
    buildPromptSection(
      '任务',
      '请依据双方盘面与双盘关系资料回答问题，分别列出共同证据、分歧证据和需要结合现实核对的部分。',
    ),
  ]);
  return buildPromptDocument(user);
}

export function buildBaziCompatibilityPrompt(options: BaziCompatibilityPromptOptions) {
  return buildBaziCompatibilityPromptDocument(options).text;
}

export const getCompatibilityPrompt = buildBaziCompatibilityPrompt;
