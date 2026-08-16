import type { AstrolabeData, AstrolabeSynastryData } from '../types/divination';
import { formatPromptCurrentTime } from './current-time';
import { buildPromptGuidance } from './guidance';
import { buildPromptSchoolSection } from './schools';
import {
  buildPromptDocument,
  buildPromptSection,
  formatStringList,
  joinPromptSections,
} from './sections';
import type { PromptBuildOptions, PromptDocument } from './types';

export const ASTROLABE_PROMPT_TOPICS = [
  'life',
  'career',
  'job-change',
  'startup-partnership',
  'investment-partnership',
  'wealth',
  'relationship',
  'relationship-push',
  'relationship-decision',
  'reconciliation-decision',
  'marriage',
  'children',
  'family',
  'home-move',
  'settle-relocate',
  'social',
  'emotion',
  'growth',
  'talent',
  'health',
  'study',
  'study-advance',
  'exam-landing',
  'recent',
  'chat',
] as const;

export type AstrolabePromptTopic = (typeof ASTROLABE_PROMPT_TOPICS)[number];

const TOPIC_LABELS: Record<AstrolabePromptTopic, string> = {
  life: '整体人生',
  career: '事业',
  'job-change': '换工作',
  'startup-partnership': '创业合作',
  'investment-partnership': '投资合作',
  wealth: '财富',
  relationship: '关系',
  'relationship-push': '关系推进',
  'relationship-decision': '关系去留',
  'reconciliation-decision': '复合判断',
  marriage: '婚恋',
  children: '子女',
  family: '家庭',
  'home-move': '搬家置业',
  'settle-relocate': '定居换城',
  social: '人际',
  emotion: '情绪',
  growth: '成长',
  talent: '天赋',
  health: '健康',
  study: '学业',
  'study-advance': '考证进修',
  'exam-landing': '考试上岸',
  recent: '近期',
  chat: '自由问答',
};

function formatPoint(point: AstrolabeData['planets'][number]) {
  return `${point.label}${point.formatted}，第${point.house}宫${point.retrograde ? '，逆行' : ''}`;
}

export function formatAstrolabeForPrompt(data: AstrolabeData) {
  const sun = data.planets.find((item) => item.name === 'Sun');
  const moon = data.planets.find((item) => item.name === 'Moon');
  const ascendant = data.angles.find((item) => item.name === 'Ascendant');
  const aspects = data.aspects
    .slice(0, 6)
    .map(
      (item) =>
        `${item.body1}${item.symbol}${item.body2}（${item.type}，容许度${item.orb.toFixed(2)}°，${item.closeness ?? '未分级'}）`,
    );
  return [
    `出生信息：${data.birth.name}；${data.birth.gender || '性别未填'}；${data.birth.dateTime}；位置${data.birth.location}；时区UTC${data.birth.timezone >= 0 ? '+' : ''}${data.birth.timezone}`,
    data.birth.isTrueSolarTime
      ? `出生时间校正：当地钟表时间${data.birth.standardDateTime || '未记录'}；真太阳时${data.birth.trueSolarDateTime || data.birth.dateTime}`
      : '',
    `核心位置：太阳${sun?.formatted || '未列'}；月亮${moon?.formatted || '未列'}；上升${ascendant?.formatted || '未列'}`,
    `元素分布：${
      Object.entries(data.summary.elements)
        .map(([key, values]) => `${key}${values.join('、')}`)
        .join('；') || '未记录'
    }`,
    `模式分布：${
      Object.entries(data.summary.modalities)
        .map(([key, values]) => `${key}${values.join('、')}`)
        .join('；') || '未记录'
    }`,
    `逆行：${formatStringList(data.summary.retrograde, '无')}`,
    `格局：${formatStringList(data.summary.patterns, '未列明显格局')}`,
    '星体位置：',
    ...data.planets.map((item) => `- ${formatPoint(item)}`),
    aspects.length ? '相位明细：' : '',
    ...aspects.map((item) => `- ${item}`),
  ]
    .filter(Boolean)
    .join('\n');
}

export interface AstrolabePromptOptions extends PromptBuildOptions {
  chart: AstrolabeData;
  schools?: readonly string[];
  topic?: AstrolabePromptTopic;
}

export function buildAstrolabePromptDocument(options: AstrolabePromptOptions): PromptDocument {
  const topic = options.topic ?? 'life';
  const question = options.question?.trim() || `请围绕${TOPIC_LABELS[topic]}解读这份星盘。`;
  const user = joinPromptSections([
    buildPromptGuidance('astrolabe'),
    buildPromptSection('当前时间', formatPromptCurrentTime(options.currentTime)),
    buildPromptSection('星盘资料', formatAstrolabeForPrompt(options.chart)),
    buildPromptSchoolSection('astrolabe', options.schools),
    buildPromptSection('问题', question),
    buildPromptSection(
      '任务',
      `请依据星体、宫位、相位和盘面证据，重点分析${TOPIC_LABELS[topic]}并回答问题。`,
    ),
  ]);
  return buildPromptDocument(user);
}

export function buildAstrolabePrompt(options: AstrolabePromptOptions) {
  return buildAstrolabePromptDocument(options).text;
}

function formatSynastryFacts(data: AstrolabeSynastryData) {
  const aspects = data.aspects.map(
    (item) =>
      `- ${item.person1}${item.point1Name}与${item.person2}${item.point2Name}：${item.type}，实际夹角${item.actualAngle.toFixed(2)}°，容许度${item.orb.toFixed(2)}°，${item.closeness}。`,
  );
  const overlays = data.houseOverlays.map(
    (item) => `- ${item.visitor}${item.pointName}落入${item.owner}本命盘第${item.house}宫。`,
  );
  return [
    aspects.length ? `【跨盘相位】\n${aspects.join('\n')}` : '',
    overlays.length ? `【跨盘落宫】\n${overlays.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export interface AstrolabeSynastryPromptOptions extends PromptBuildOptions {
  chart1: AstrolabeData;
  chart2: AstrolabeData;
  synastry: AstrolabeSynastryData;
  schools?: readonly string[];
}

export function buildAstrolabeSynastryPromptDocument(
  options: AstrolabeSynastryPromptOptions,
): PromptDocument {
  const question =
    options.question?.trim() || '请分析双方互动主轴、互补点、张力点与需要结合现实核对的部分。';
  const user = joinPromptSections([
    buildPromptGuidance('astrolabe-synastry'),
    buildPromptSection('当前时间', formatPromptCurrentTime(options.currentTime)),
    buildPromptSection('第一人本命盘', formatAstrolabeForPrompt(options.chart1)),
    buildPromptSection('第二人本命盘', formatAstrolabeForPrompt(options.chart2)),
    buildPromptSection('跨盘资料', formatSynastryFacts(options.synastry)),
    buildPromptSchoolSection('astrolabe', options.schools),
    buildPromptSection('问题', question),
    buildPromptSection(
      '任务',
      '请依据双方本命盘、跨盘相位和跨盘落宫，分析互动主轴、互补点与张力点，并列出各自对应证据，再回答问题。',
    ),
  ]);
  return buildPromptDocument(user);
}

export function buildAstrolabeSynastryPrompt(options: AstrolabeSynastryPromptOptions) {
  return buildAstrolabeSynastryPromptDocument(options).text;
}
