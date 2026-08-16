import type { AnalysisPayloadV1, PalaceFact, ScopeType, StarFact } from '../types/analysis';
import type { ZiweiRuntime } from '../ziwei/runtime';
import { analyzeZiweiCompatibility } from '../ziwei/iztro/index';
import { formatBaziForPrompt, type BaziChartResult } from '../bazi/index';
import { formatPromptCurrentTime } from './current-time';
import { buildPromptGuidance } from './guidance';
import { formatPromptSchoolGuidance } from './schools';
import { formatBaziSchoolsPrompt, normalizeBaziPromptSchools } from './bazi-school';
import {
  buildPromptDocument,
  buildPromptSection,
  formatStringList,
  joinPromptSections,
} from './sections';
import type { PromptBuildOptions, PromptDocument } from './types';

export const ZIWEI_PROMPT_SCOPES = [
  'origin',
  'full',
  'decadal',
  'yearly',
  'monthly',
  'daily',
  'hourly',
  'age',
] as const;

export type ZiweiPromptScope = (typeof ZIWEI_PROMPT_SCOPES)[number];
export type ZiweiPromptSchool = 'sanhe' | 'feixing' | 'sihua';

export const ZIWEI_PROMPT_TOPICS = [
  'life',
  'destiny',
  'relationship',
  'relationship-push',
  'relationship-decision',
  'children',
  'career-wealth',
  'job-change',
  'startup-partnership',
  'investment-partnership',
  'recent',
  'family',
  'home-move',
  'settle-relocate',
  'social',
  'emotion',
  'health',
  'study',
  'study-advance',
  'exam-landing',
  'reconciliation-decision',
  'growth',
  'talent',
  'chat',
] as const;

export type ZiweiPromptTopic = (typeof ZIWEI_PROMPT_TOPICS)[number];

const TOPIC_LABELS: Record<ZiweiPromptTopic, string> = {
  life: '整体人生',
  destiny: '命局综述',
  relationship: '婚恋关系',
  'relationship-push': '关系推进',
  'relationship-decision': '关系去留',
  children: '子女亲缘',
  'career-wealth': '事业财运',
  'job-change': '工作变动',
  'startup-partnership': '创业合作',
  'investment-partnership': '投资合作',
  recent: '近期趋势',
  family: '家庭六亲',
  'home-move': '搬家置业',
  'settle-relocate': '定居换城',
  social: '人际合作',
  emotion: '情绪调节',
  health: '健康养护',
  study: '学业成长',
  'study-advance': '考证进修',
  'exam-landing': '考试上岸',
  'reconciliation-decision': '复合判断',
  growth: '成长课题',
  talent: '天赋优势',
  chat: '自由问答',
};

const SCOPE_ORDER: ScopeType[] = [
  'origin',
  'decadal',
  'yearly',
  'monthly',
  'daily',
  'hourly',
  'age',
];
const SCOPE_LABELS: Record<ScopeType, string> = {
  origin: '本命',
  decadal: '大限',
  yearly: '流年',
  monthly: '流月',
  daily: '流日',
  hourly: '流时',
  age: '小限年龄',
};

const SCHOOL_TEXT: Record<ZiweiPromptSchool, { label: string; task: string; basis: string }> = {
  sanhe: {
    label: '三合派',
    task: '以命宫、身宫为核心，先看本宫主星庙旺，再合看对宫与三方四正，辅煞杂曜和夹拱作为会照资料。',
    basis: '参考《紫微斗数全书》《紫微斗数全集》等通行宫位、星曜与三方四正资料。',
  },
  feixing: {
    label: '飞星派',
    task: '以生年四化、运限四化、自化和飞化落宫为主线，追踪四化从起点到落宫的宫位链。',
    basis: '参考《紫微斗数全书》的通行四化资料及后世飞星派读法。',
  },
  sihua: {
    label: '四化派',
    task: '以禄、权、科、忌落宫和宫位对应为主线，先定生年四化，再分层观察运限四化。',
    basis: '参考《紫微斗数全书》的通行十干四化资料及四化派读法。',
  },
};

function formatStar(star: StarFact) {
  return [
    star.name,
    star.brightness ? `庙旺${star.brightness}` : '',
    star.birth_mutagen ? `生年化${star.birth_mutagen}` : '',
    star.horoscope_mutagen ? `运限化${star.horoscope_mutagen}` : '',
    star.active_scope_mutagen ? `当前化${star.active_scope_mutagen}` : '',
  ]
    .filter(Boolean)
    .join('，');
}

function formatPalace(palace: PalaceFact) {
  const stars = [
    ...palace.major_stars,
    ...palace.minor_stars,
    ...palace.other_stars,
    ...palace.scope_stars,
  ].map(formatStar);
  const ranges =
    palace.decadal_range?.length === 2
      ? `大限${palace.decadal_range[0]}-${palace.decadal_range[1]}岁`
      : '';
  return [
    `${palace.name}宫${palace.is_body_palace ? '（身宫）' : ''}${palace.is_original_palace ? '（命宫）' : ''}`,
    `宫干支${palace.heavenly_stem}${palace.earthly_branch}`,
    ranges,
    `星曜：${formatStringList(stars)}`,
    palace.scope_hits.length ? `运限命中：${palace.scope_hits.join('、')}` : '',
    palace.dynamic_scope_name ? `动态宫名：${palace.dynamic_scope_name}` : '',
    palace.summary_tags.length ? `标签：${palace.summary_tags.join('、')}` : '',
  ]
    .filter(Boolean)
    .join('；');
}

function formatMutagenMap(payload: AnalysisPayloadV1) {
  const values = payload.active_scope.mutagen_map.map((item) => {
    const palace = item.palace_name ? `入${item.palace_name}宫` : '';
    const dynamic = item.dynamic_palace_name ? `（动态${item.dynamic_palace_name}）` : '';
    return `${item.star || ''}化${item.mutagen}${palace}${dynamic}`;
  });
  return values.length ? values.join('；') : '未记录当前四化';
}

export function formatZiweiPayloadForPrompt(
  payload: AnalysisPayloadV1,
  options: { focusPalaceNames?: readonly string[]; maxEvidence?: number } = {},
) {
  const basic = payload.basic_info;
  const active = payload.active_scope;
  const evidence = payload.evidence_pool.slice(0, options.maxEvidence ?? 30).map((item) => {
    const level = item.level ? `【${item.level}】` : '';
    const detail = item.promptText || item.description;
    return `${level}${item.title}：${detail}`;
  });

  const focusNames = new Set(options.focusPalaceNames ?? []);
  const palaces = focusNames.size
    ? payload.palaces.filter((palace) => focusNames.has(palace.name))
    : payload.palaces;
  const selectedPalaces = palaces.length ? palaces : payload.palaces;

  return [
    `分析范围：${active.label || SCOPE_LABELS[active.scope]}`,
    `基本资料：${basic.gender}；公历${basic.solar_date}；农历${basic.lunar_date}；${basic.birth_time_label}；生肖${basic.zodiac}`,
    `命身资料：命宫${basic.soul_palace_branch}；身宫${basic.body_palace_branch}；命主${basic.soul}；身主${basic.body}`,
    basic.four_pillars
      ? `四柱：年${basic.four_pillars.year_pillar}、月${basic.four_pillars.month_pillar}、日${basic.four_pillars.day_pillar}、时${basic.four_pillars.hour_pillar}`
      : '',
    `当前运限：${active.label || SCOPE_LABELS[active.scope]}；${active.solar_date}；${active.lunar_date}；名义年龄${active.nominal_age}；${active.palace_name ? `落${active.palace_name}宫` : '落宫未记录'}`,
    `当前四化：${formatMutagenMap(payload)}`,
    '十二宫资料：',
    ...selectedPalaces.map((palace) => `- ${formatPalace(palace)}`),
    evidence.length ? '证据资料：' : '',
    ...evidence.map((item) => `- ${item}`),
    payload.evidence_analysis?.promptText
      ? `证据汇总：${payload.evidence_analysis.promptText}`
      : '',
    payload.pattern_analysis?.promptText ? `格局资料：${payload.pattern_analysis.promptText}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function getZiweiPromptCalculationScopes(scope: ZiweiPromptScope): ScopeType[] {
  return scope === 'full' ? SCOPE_ORDER : [scope];
}

export function formatZiweiFullScopeText(runtime: ZiweiRuntime) {
  return SCOPE_ORDER.map((scope) => runtime.payloadByScope[scope])
    .filter((payload): payload is AnalysisPayloadV1 => Boolean(payload))
    .map(
      (payload) =>
        `${SCOPE_LABELS[payload.active_scope.scope]}：\n${formatZiweiPayloadForPrompt(payload)}`,
    )
    .join('\n\n');
}

function formatTrueSolarEvidence(runtime: ZiweiRuntime) {
  return runtime.trueSolarEvidence?.promptText
    ? `出生时间校正：${runtime.trueSolarEvidence.promptText}`
    : '';
}

export interface ZiweiPromptOptions extends PromptBuildOptions {
  runtime: ZiweiRuntime;
  scope?: ZiweiPromptScope;
  school?: ZiweiPromptSchool;
  schools?: readonly ZiweiPromptSchool[];
  topic?: ZiweiPromptTopic;
  focusPalaceNames?: readonly string[];
}

export function buildZiweiPromptDocument(options: ZiweiPromptOptions): PromptDocument {
  const scope = options.scope ?? 'full';
  const scopes = getZiweiPromptCalculationScopes(scope);
  const payloads = scopes
    .map((item) => options.runtime.payloadByScope[item])
    .filter((payload): payload is AnalysisPayloadV1 => Boolean(payload));
  const chartText =
    scope === 'full'
      ? formatZiweiFullScopeText(options.runtime)
      : payloads
          .map((payload) =>
            formatZiweiPayloadForPrompt(payload, {
              focusPalaceNames: options.focusPalaceNames,
            }),
          )
          .join('\n\n');
  const topicLabel = options.topic ? TOPIC_LABELS[options.topic] : '';
  const question =
    options.question?.trim() ||
    (topicLabel ? `请围绕${topicLabel}解读紫微盘面资料。` : '请结合盘面资料完成紫微斗数解读。');
  const selectedSchools = options.schools?.length ? options.schools : [];
  const school =
    !selectedSchools.length && options.school ? SCHOOL_TEXT[options.school] : undefined;
  const schoolText = selectedSchools.length
    ? formatPromptSchoolGuidance('ziwei', selectedSchools)
    : school
      ? [`紫微流派：${school.label}`, `流派任务：${school.task}`, `流派依据：${school.basis}`].join(
          '\n',
        )
      : '';

  const user = joinPromptSections([
    buildPromptGuidance('ziwei'),
    buildPromptSection('当前时间', formatPromptCurrentTime(options.currentTime)),
    formatTrueSolarEvidence(options.runtime)
      ? buildPromptSection('出生时间校正', formatTrueSolarEvidence(options.runtime))
      : '',
    buildPromptSection('紫微盘面资料', chartText),
    schoolText
      ? buildPromptSection(selectedSchools.length > 1 ? '多派合参' : '流派', schoolText)
      : '',
    buildPromptSection('问题', question),
    buildPromptSection(
      '任务',
      `请依据${scope === 'full' ? '本命与所列完整运限' : SCOPE_LABELS[scopes[0] ?? 'origin']}资料，${topicLabel ? `重点分析${topicLabel}，` : ''}先列出主要宫位、星曜、四化和运限证据，再回答问题。`,
    ),
  ]);
  return buildPromptDocument(user);
}

export function buildZiweiPrompt(options: ZiweiPromptOptions) {
  return buildZiweiPromptDocument(options).text;
}

export const buildZiweiPromptForRuntime = buildZiweiPrompt;
export const buildPublicZiweiPromptForRuntime = buildZiweiPrompt;

/** 生成更适合直接交给在线 AI 的紫微主题任务书。 */
export function buildZiweiTaskBookPrompt(options: ZiweiPromptOptions) {
  return buildZiweiPromptDocument(options).text;
}

function formatZiweiCompatibilityFacts(result: ReturnType<typeof analyzeZiweiCompatibility>) {
  const overlays = result.palaceOverlays.slice(0, 24).map((item) => `- ${item.promptText}`);
  const mutagens = result.crossMutagenPlacements.slice(0, 24).map((item) => `- ${item.promptText}`);
  return [
    `证据汇总：${result.summaryFact.promptText}`,
    overlays.length ? '宫位叠盘：' : '',
    ...overlays,
    mutagens.length ? '跨盘四化：' : '',
    ...mutagens,
  ]
    .filter(Boolean)
    .join('\n');
}

export interface ZiweiCompatibilityPromptOptions extends PromptBuildOptions {
  payload1: AnalysisPayloadV1;
  payload2: AnalysisPayloadV1;
  schools?: readonly ZiweiPromptSchool[];
  compatibility?: ReturnType<typeof analyzeZiweiCompatibility>;
  person1Name?: string;
  person2Name?: string;
  topic?: ZiweiPromptTopic;
}

export function buildZiweiCompatibilityPromptDocument(
  options: ZiweiCompatibilityPromptOptions,
): PromptDocument {
  const person1 = options.person1Name?.trim() || '第一人';
  const person2 = options.person2Name?.trim() || '第二人';
  const compatibility =
    options.compatibility ??
    analyzeZiweiCompatibility(options.payload1, options.payload2, {
      person1Name: person1,
      person2Name: person2,
    });
  const topicLabel = options.topic ? TOPIC_LABELS[options.topic] : '';
  const question =
    options.question?.trim() ||
    (topicLabel ? `请分析双方在${topicLabel}方面的互动。` : '请分析双方互动主轴、互补点与张力点。');
  const schoolText = formatPromptSchoolGuidance('ziwei', options.schools);
  const user = joinPromptSections([
    buildPromptGuidance('ziwei-compatibility'),
    buildPromptSection('当前时间', formatPromptCurrentTime(options.currentTime)),
    buildPromptSection(`${person1}盘面`, formatZiweiPayloadForPrompt(options.payload1)),
    buildPromptSection(`${person2}盘面`, formatZiweiPayloadForPrompt(options.payload2)),
    schoolText
      ? buildPromptSection(
          options.schools && options.schools.length > 1 ? '多派合参' : '解读流派',
          schoolText,
        )
      : '',
    buildPromptSection('双盘关系资料', formatZiweiCompatibilityFacts(compatibility)),
    buildPromptSection('问题', question),
    buildPromptSection(
      '任务',
      `请依据双方紫微盘面和双盘关系资料${topicLabel ? `重点分析${topicLabel}` : ''}，分别列出互动主轴、互补点、张力点及其对应宫位、星曜或四化证据，再回答问题。`,
    ),
  ]);
  return buildPromptDocument(user);
}

export function buildZiweiCompatibilityPrompt(options: ZiweiCompatibilityPromptOptions) {
  return buildZiweiCompatibilityPromptDocument(options).text;
}

export interface BaziZiweiPromptOptions extends PromptBuildOptions {
  bazi: BaziChartResult;
  ziwei: ZiweiRuntime | AnalysisPayloadV1;
  topic?: string;
  /** 旧版八字单派兼容字段。 */
  school?: import('./bazi').BaziPromptSchool;
  baziSchool?: import('./bazi').BaziPromptSchool;
  baziSchools?: readonly import('./bazi').BaziPromptSchool[];
  ziweiSchool?: ZiweiPromptSchool;
  ziweiSchools?: readonly ZiweiPromptSchool[];
}

function resolveZiweiPayload(ziwei: ZiweiRuntime | AnalysisPayloadV1) {
  return 'payload_version' in ziwei ? ziwei : ziwei.payloadByScope.origin;
}

/** 组合八字和紫微资料，供需要同时比较两套命理结构的场景使用。 */
export function buildBaziZiweiPromptDocument(options: BaziZiweiPromptOptions): PromptDocument {
  const payload = resolveZiweiPayload(options.ziwei);
  const topic = options.topic?.trim() || '整体人生';
  const question = options.question?.trim() || `请结合八字与紫微资料分析${topic}。`;
  const selectedBaziSchools = normalizeBaziPromptSchools(
    options.baziSchools?.length
      ? options.baziSchools
      : options.baziSchool || options.school
        ? [options.baziSchool ?? options.school!]
        : [],
  );
  const selectedZiweiSchools = options.ziweiSchools?.length
    ? options.ziweiSchools
    : options.ziweiSchool
      ? [options.ziweiSchool]
      : [];
  const user = joinPromptSections([
    buildPromptGuidance('bazi'),
    buildPromptGuidance('ziwei'),
    buildPromptSection('当前时间', formatPromptCurrentTime(options.currentTime)),
    buildPromptSection('八字盘面资料', formatBaziForPrompt(options.bazi, null, 'general')),
    selectedBaziSchools.length
      ? buildPromptSection(
          selectedBaziSchools.length > 1 ? '八字多派合参' : '八字解读流派',
          formatBaziSchoolsPrompt(options.bazi, selectedBaziSchools),
        )
      : '',
    buildPromptSection('紫微盘面资料', formatZiweiPayloadForPrompt(payload)),
    selectedZiweiSchools.length
      ? buildPromptSection(
          selectedZiweiSchools.length > 1 ? '紫微多派合参' : '紫微解读流派',
          formatPromptSchoolGuidance('ziwei', selectedZiweiSchools),
        )
      : '',
    buildPromptSection('分析对象', topic),
    buildPromptSection('问题', question),
    buildPromptSection(
      '任务',
      `请先分别依据八字和紫微各自盘面资料建立证据，再比较两套体系对${topic}的共同指向、差异和需要结合现实核对的部分。`,
    ),
  ]);
  return buildPromptDocument(user);
}

export function buildBaziZiweiPrompt(options: BaziZiweiPromptOptions) {
  return buildBaziZiweiPromptDocument(options).text;
}

export interface SerializableZiweiResult {
  basicInfo: AnalysisPayloadV1['basic_info'];
  calculationConfig: AnalysisPayloadV1['calculation_config'];
  scopeNames: string[];
  payloadByScope: Record<ScopeType, AnalysisPayloadV1>;
  trueSolarEvidence?: ZiweiRuntime['trueSolarEvidence'];
  fourMutagens: Record<string, string>;
  birthMutagens: Record<string, string>;
  gongList: Array<{
    index: number;
    name: string;
    heavenlyStem: string;
    earthlyBranch: string;
    isLifePalace: boolean;
    isBodyPalace: boolean;
    stars: string[];
    majorStars: string[];
    minorStars: string[];
    otherStars: string[];
  }>;
  命宫: string;
  身宫: string;
  五行局: string;
  四化: Record<string, string>;
}

/** 将完整运行结果转换为稳定的 API 兼容结构。 */
export function buildSerializableZiweiResult(runtime: ZiweiRuntime): SerializableZiweiResult {
  const origin = runtime.payloadByScope.origin ?? Object.values(runtime.payloadByScope)[0];
  if (!origin) {
    throw new Error('紫微运行结果缺少可序列化的盘面资料。');
  }

  const mutagens: Record<string, string> = {};
  const gongList = origin.palaces.map((palace) => {
    const allStars = [
      ...palace.major_stars,
      ...palace.minor_stars,
      ...palace.other_stars,
      ...palace.scope_stars,
    ];
    allStars.forEach((star) => {
      if (star.birth_mutagen) {
        mutagens[star.birth_mutagen] = star.name;
      }
    });
    return {
      index: palace.index,
      name: palace.name,
      heavenlyStem: palace.heavenly_stem,
      earthlyBranch: palace.earthly_branch,
      isLifePalace: palace.name === '命宫',
      isBodyPalace: palace.is_body_palace,
      stars: allStars.map((star) => star.name).filter(Boolean),
      majorStars: palace.major_stars.map((star) => star.name).filter(Boolean),
      minorStars: palace.minor_stars.map((star) => star.name).filter(Boolean),
      otherStars: palace.other_stars.map((star) => star.name).filter(Boolean),
    };
  });
  const lifePalace = origin.palaces.find((palace) => palace.name === '命宫');
  const bodyPalace = origin.palaces.find((palace) => palace.is_body_palace);

  return {
    basicInfo: origin.basic_info,
    calculationConfig: origin.calculation_config,
    scopeNames: Object.keys(runtime.payloadByScope),
    payloadByScope: runtime.payloadByScope,
    trueSolarEvidence: runtime.trueSolarEvidence,
    fourMutagens: mutagens,
    birthMutagens: mutagens,
    gongList,
    命宫: lifePalace?.earthly_branch ?? '',
    身宫: bodyPalace?.name ?? '',
    五行局: origin.basic_info.five_elements_class,
    四化: mutagens,
  };
}
