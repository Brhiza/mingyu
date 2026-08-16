/**
 * 公开 HTTP API、MCP 与旧前端调用共同使用的紧凑提示词兼容层。
 *
 * 新的通用集成优先使用 `mingyu-core/prompt` 中返回完整任务书的构建器；本文件
 * 保留既有参数和输出结构，避免现有公开接口在迁移时改变提示词契约。
 */
import type { AnalysisPayloadV1, PalaceFact, ScopeType, StarFact } from '../types/analysis';
import { formatBaziForPrompt, type BaziChartResult, type FortuneSelectionContext } from '../bazi';
import type { ZiweiRuntime } from '../ziwei/runtime';
import { formatBaziFortuneSelection } from './bazi-fortune';
import { buildSerializableZiweiResult } from './ziwei';
import { formatPromptCurrentTime } from './current-time';
import { buildPromptGuidance } from './guidance';
import {
  BAZI_PROMPT_SCHOOLS,
  BAZI_PROMPT_MULTI_SCHOOLS,
  buildBaziSchoolPromptSection,
  buildBaziSchoolsPromptSection,
  getBaziSchoolGuidance,
  type BaziPromptSchool,
} from './bazi-school';
import { formatPromptSchoolGuidance } from './schools';

export const BAZI_PROMPT_TOPICS = [
  'general',
  'recent',
  'career',
  'job-change',
  'startup-partnership',
  'investment-partnership',
  'wealth',
  'marriage',
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

export const ZIWEI_PROMPT_TOPICS = [
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
  'growth',
  'talent',
  'reconciliation-decision',
  'life',
  'chat',
] as const;

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

export const PROMPT_MODES = ['framework', 'custom'] as const;
export const BAZI_FORTUNE_SCOPES = ['natal', 'full', 'dayun', 'year', 'month', 'day'] as const;
export const BAZI_SCHOOLS = BAZI_PROMPT_SCHOOLS;
export const BAZI_MULTI_SCHOOLS = BAZI_PROMPT_MULTI_SCHOOLS;
export const ZIWEI_SCHOOLS = ['sanhe', 'feixing', 'sihua'] as const;

export type BaziPromptTopic = (typeof BAZI_PROMPT_TOPICS)[number];
export type ZiweiPromptTopic = (typeof ZIWEI_PROMPT_TOPICS)[number];
export type ZiweiPromptScope = (typeof ZIWEI_PROMPT_SCOPES)[number];
export type PromptMode = (typeof PROMPT_MODES)[number];
export type PublicBaziFortuneScope = (typeof BAZI_FORTUNE_SCOPES)[number];
export type BaziSchool = BaziPromptSchool;
export type ZiweiSchool = (typeof ZIWEI_SCHOOLS)[number];

export { buildBaziSchoolPromptSection, buildBaziSchoolsPromptSection, getBaziSchoolGuidance };

const BAZI_TOPIC_LABELS: Record<BaziPromptTopic, string> = {
  general: '通用',
  recent: '近期',
  career: '事业',
  'job-change': '换工作',
  'startup-partnership': '创业合作',
  'investment-partnership': '投资合作',
  wealth: '财运',
  marriage: '婚恋',
  'relationship-push': '关系推进',
  'relationship-decision': '关系去留',
  'reconciliation-decision': '复合判断',
  children: '子女',
  family: '家庭',
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

const ZIWEI_TOPIC_LABELS: Record<ZiweiPromptTopic, string> = {
  destiny: '命局解读',
  relationship: '婚姻感情',
  'relationship-push': '关系推进',
  'relationship-decision': '关系去留',
  children: '子女亲缘',
  'career-wealth': '事业财运',
  'job-change': '工作变动',
  'startup-partnership': '创业合作',
  'investment-partnership': '投资合作',
  recent: '近期趋势',
  family: '六亲家庭',
  'home-move': '搬家置业',
  'settle-relocate': '定居换城',
  social: '人际合作',
  emotion: '情绪调节',
  health: '健康养护',
  study: '学业成长',
  'study-advance': '考证进修',
  'exam-landing': '考试上岸',
  growth: '成长课题',
  talent: '天赋优势',
  'reconciliation-decision': '复合判断',
  life: '人生解析',
  chat: '自由聊天',
};

const SCOPE_LABELS: Record<ScopeType, string> = {
  origin: '本命',
  decadal: '大限',
  yearly: '流年',
  monthly: '流月',
  daily: '流日',
  hourly: '流时',
  age: '小限',
};

const FULL_ZIWEI_SCOPE_ORDER: ScopeType[] = [
  'origin',
  'decadal',
  'yearly',
  'monthly',
  'daily',
  'hourly',
];

type SchoolProfile = { label: string; task: string; basis: string };

const ZIWEI_SCHOOL_PROFILES: Record<ZiweiSchool, SchoolProfile> = {
  sanhe: {
    label: '三合派',
    task: '以命宫、身宫为核心，先看本宫主星庙旺，再合看对宫与三方四正，辅煞杂曜和夹拱作为会照资料。',
    basis:
      '宫位、星曜与三方四正资料参照《紫微斗数全书》《紫微斗数全集》等通行典籍；“三合派”是后世流派称法。',
  },
  feixing: {
    label: '飞星派',
    task: '以生年四化、运限四化、自化和飞化落宫为主线，追踪四化从起点到落宫的宫位链，三方四正作为会照资料。',
    basis:
      '四化表与飞化落宫参照《紫微斗数全书》的通行四化资料及后世飞星派读法，四化表按盘面列出的十干对应关系解读。',
  },
  sihua: {
    label: '四化派',
    task: '以禄、权、科、忌落宫和宫位对应为主线，先定生年四化，再分层观察运限四化，星曜庙旺与三方四正补充四化条件。',
    basis:
      '十干四化与禄权科忌落宫参照《紫微斗数全书》的通行四化资料及四化派读法，四化表按盘面列出的十干对应关系解读。',
  },
};

export function getZiweiSchoolGuidance(school?: ZiweiSchool) {
  if (!school) return '';
  const profile = ZIWEI_SCHOOL_PROFILES[school];
  return `紫微流派：${profile.label}。${profile.task}\n依据：${profile.basis}`;
}

function section(title: string, content: string) {
  const normalized = content.trim();
  return normalized ? `【${title}】\n${normalized}` : '';
}

function joinSections(sections: Array<string | undefined | null>) {
  return sections
    .map((item) => item?.trim())
    .filter(Boolean)
    .join('\n\n');
}

function insertBeforeHeading(prompt: string, heading: string, content: string) {
  const marker = `\n\n${heading}`;
  return prompt.includes(marker)
    ? prompt.replace(marker, `\n\n${content}${marker}`)
    : `${prompt}\n\n${content}`;
}

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

function baziDefaultQuestion() {
  return '请先做整体解读。';
}

export function buildBaziPromptForResult(params: {
  result: BaziChartResult;
  question?: string;
  topic?: BaziPromptTopic;
  mode?: PromptMode;
  school?: BaziSchool;
  schools?: readonly BaziSchool[];
  fortuneSelectionContext?: FortuneSelectionContext | null;
  fortuneScope?: PublicBaziFortuneScope;
}) {
  const topic = params.topic ?? 'general';
  const question = params.question?.trim() || baziDefaultQuestion();
  const fortuneScope = params.fortuneScope ?? params.fortuneSelectionContext?.scope ?? 'natal';
  const fortuneSelection = formatBaziFortuneSelection(params.fortuneSelectionContext);
  const scopeText = fortuneSelection
    ? fortuneSelection.analysisObject
    : fortuneScope === 'full'
      ? '分析对象：本命盘与完整大运流年'
      : '分析对象：本命盘';
  const label = BAZI_TOPIC_LABELS[topic];
  const task =
    params.mode === 'custom'
      ? ''
      : label === '通用'
        ? '请依据八字排盘资料完成解读。'
        : `请重点分析${label}，并直接回答【问题】。`;
  const chart = [
    formatBaziForPrompt(params.result, null, fortuneScope === 'natal' ? 'general' : 'fortune'),
  ]
    .filter(Boolean)
    .join('\n');
  const prompt = joinSections([
    buildPromptGuidance('bazi'),
    section('当前时间', formatPromptCurrentTime()),
    section('排盘信息', chart),
    section('分析对象', scopeText),
    fortuneScope === 'full' ? section('命限资料', formatFullFortune(params.result)) : '',
    fortuneSelection ? section('岁运重点', fortuneSelection.focus) : '',
    section('问题', question),
    task ? section('任务', task) : '',
  ]);
  const schoolSection = params.schools?.length
    ? buildBaziSchoolsPromptSection(params.result, params.schools)
    : buildBaziSchoolPromptSection(params.result, params.school);
  return schoolSection ? insertBeforeHeading(prompt, '【问题】', schoolSection) : prompt;
}

export { buildSerializableZiweiResult };

export function getZiweiPromptCalculationScopes(scope: ZiweiPromptScope): ScopeType[] {
  return scope === 'full' ? FULL_ZIWEI_SCOPE_ORDER : [scope as ScopeType];
}

function scopeLabel(scope: ZiweiPromptScope | ScopeType) {
  return scope === 'full' ? '完整输出' : SCOPE_LABELS[scope as ScopeType];
}

function formatMutagenMap(payload: AnalysisPayloadV1) {
  const items = payload.active_scope.mutagen_map
    .map(
      (item) =>
        `${item.star ? `${item.star}化${item.mutagen}` : `化${item.mutagen}`}${item.palace_name ? `入本命${item.palace_name}` : ''}${item.dynamic_palace_name ? `（动态${item.dynamic_palace_name}）` : ''}`,
    )
    .filter(Boolean);
  return items.length ? items.join('；') : '未标出当前四化';
}

function formatScopeHits(payload: AnalysisPayloadV1) {
  const hits = payload.palaces
    .flatMap((palace) =>
      palace.scope_hits.map(
        (hit) =>
          `${hit}，本命${palace.name}宫${palace.major_stars.length ? `，主星${palace.major_stars.map((star) => star.name).join('、')}` : ''}`,
      ),
    )
    .filter(Boolean);
  return hits.length ? hits.slice(0, 8).join('；') : '未标出明显运限落宫';
}

export function formatPublicZiweiFullScopeText(result: ZiweiRuntime) {
  const lines = FULL_ZIWEI_SCOPE_ORDER.map((scope) => {
    const payload = result.payloadByScope[scope];
    if (!payload) return '';
    const activePalace = payload.palaces.find(
      (palace) => palace.index === payload.active_scope.palace_index,
    );
    const details =
      scope === 'origin'
        ? ''
        : `当前四化：${formatMutagenMap(payload)}。运限命中：${formatScopeHits(payload)}。`;
    return `${SCOPE_LABELS[scope]}：分析对象：${payload.active_scope.label || SCOPE_LABELS[scope]}。${activePalace ? `当前落宫：本命${activePalace.name}宫。` : ''}${details}`;
  }).filter(Boolean);
  return lines.length
    ? ['完整紫微运限资料：', ...lines.map((line, index) => `${index + 1}. ${line}`)].join('\n')
    : '';
}

function formatStar(star: StarFact) {
  return `${star.name}${star.brightness ? `(${star.brightness})` : ''}`;
}

function formatPalaceBrief(palace: PalaceFact) {
  const stars = [...palace.major_stars, ...palace.minor_stars]
    .map(formatStar)
    .filter(Boolean)
    .slice(0, 8);
  const details = [
    stars.length ? `星曜：${stars.join('、')}` : '',
    palace.changsheng12 ? `长生：${palace.changsheng12}` : '',
    palace.boshi12 ? `博士：${palace.boshi12}` : '',
  ].filter(Boolean);
  const tags = palace.summary_tags.length ? `；标记：${palace.summary_tags.join('、')}` : '';
  return `- ${palace.name}（${palace.heavenly_stem}${palace.earthly_branch}）：${details.join('；')}${tags}`;
}

function buildKeyPalaces(
  palaces: PalaceFact[],
  activePalace: PalaceFact | undefined,
  lifePalace: PalaceFact | undefined,
  bodyPalace: PalaceFact | undefined,
  isOriginScope: boolean,
) {
  const hitPalaces = isOriginScope
    ? []
    : [...palaces]
        .filter((palace) => palace.scope_hits.length)
        .sort((a, b) => b.scope_hits.length - a.scope_hits.length);
  const names = [
    activePalace?.name,
    lifePalace?.name,
    bodyPalace?.name,
    ...hitPalaces.map((palace) => palace.name),
    '福德宫',
    '迁移宫',
  ].filter(Boolean) as string[];
  const selected = Array.from(
    new Map(
      names
        .map((name) =>
          palaces.find((palace) => palace.name === name || palace.name === name.replace(/宫$/, '')),
        )
        .filter((palace): palace is PalaceFact => Boolean(palace))
        .map((palace) => [palace.index, palace]),
    ).values(),
  ).slice(0, 7);
  return selected.length ? `【重点宫位资料】\n${selected.map(formatPalaceBrief).join('\n')}` : '';
}

function formatZiweiEvidenceText(result: ZiweiRuntime, scope: ZiweiPromptScope = 'origin') {
  const payload =
    scope === 'full'
      ? result.payloadByScope.origin
      : (result.payloadByScope[scope as ScopeType] ?? result.payloadByScope.origin);
  if (!payload) return '';
  const activePalace = payload.palaces.find(
    (palace) => palace.index === payload.active_scope.palace_index,
  );
  const lifePalace = payload.palaces.find((palace) => palace.name === '命宫');
  const bodyPalace = payload.palaces.find((palace) => palace.is_body_palace);
  const stars = (palace: PalaceFact | undefined) =>
    [...(palace?.major_stars ?? []), ...(palace?.minor_stars ?? [])]
      .map((item) => item.name)
      .filter(Boolean)
      .slice(0, 8)
      .join('、');
  return [
    `分析对象：${scope === 'full' ? '本命盘与完整大限流年流月流日流时' : payload.active_scope.label || scopeLabel(scope)}`,
    `出生日期：${payload.basic_info.solar_date}；农历：${payload.basic_info.lunar_date}；时辰：${payload.basic_info.birth_time_label}`,
    payload.calculation_config.algorithm === 'zhongzhou'
      ? '安星口径：中州派安星法'
      : '安星口径：传统通行安星法',
    lifePalace
      ? `命宫：${lifePalace.name}${stars(lifePalace) ? `；星曜：${stars(lifePalace)}` : ''}`
      : '',
    bodyPalace
      ? `身宫：${bodyPalace.name}${stars(bodyPalace) ? `；星曜：${stars(bodyPalace)}` : ''}`
      : '',
    activePalace ? `当前落宫：${activePalace.name}` : '',
    payload.active_scope.mutagen_map.length ? `当前四化：${formatMutagenMap(payload)}` : '',
    buildKeyPalaces(
      payload.palaces,
      activePalace,
      lifePalace,
      bodyPalace,
      payload.active_scope.scope === 'origin',
    ),
    scope === 'full' ? formatPublicZiweiFullScopeText(result) : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function formatPublicTrueSolarEvidence(evidence?: ZiweiRuntime['trueSolarEvidence']) {
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

export function buildPublicZiweiPromptForRuntime(params: {
  result: ZiweiRuntime;
  question?: string;
  topic?: ZiweiPromptTopic;
  scope?: ZiweiPromptScope;
  mode?: PromptMode;
  school?: ZiweiSchool;
  schools?: readonly ZiweiSchool[];
}) {
  const scope = params.scope ?? 'origin';
  const mode = params.mode ?? 'framework';
  const topic = params.topic ?? (mode === 'custom' ? 'chat' : 'life');
  const payload =
    scope === 'full'
      ? params.result.payloadByScope.origin
      : (params.result.payloadByScope[scope as ScopeType] ?? params.result.payloadByScope.origin);
  const activePalace = payload?.palaces.find(
    (palace) => palace.index === payload.active_scope.palace_index,
  );
  const lifePalace = payload?.palaces.find((palace) => palace.name === '命宫');
  const bodyPalace = payload?.palaces.find((palace) => palace.is_body_palace);
  const stars = (palace: PalaceFact | undefined) =>
    [...(palace?.major_stars ?? []), ...(palace?.minor_stars ?? [])]
      .map((item) => item.name)
      .filter(Boolean)
      .slice(0, 8)
      .join('、');
  const chartLines = [
    `出生日期：${payload.basic_info.solar_date}；农历：${payload.basic_info.lunar_date}；时辰：${payload.basic_info.birth_time_label}`,
    payload.calculation_config.algorithm === 'zhongzhou'
      ? '安星口径：中州派安星法'
      : '安星口径：传统通行安星法',
    lifePalace
      ? `命宫：${lifePalace.name}${stars(lifePalace) ? `；星曜：${stars(lifePalace)}` : ''}`
      : '',
    bodyPalace
      ? `身宫：${bodyPalace.name}${stars(bodyPalace) ? `；星曜：${stars(bodyPalace)}` : ''}`
      : '',
    activePalace ? `当前落宫：${activePalace.name}` : '',
    payload.active_scope.mutagen_map.length ? `当前四化：${formatMutagenMap(payload)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const question = params.question?.trim() || baziDefaultQuestion();
  const prompt = joinSections([
    buildPromptGuidance('ziwei'),
    section('当前时间', formatPromptCurrentTime()),
    formatPublicTrueSolarEvidence(params.result.trueSolarEvidence)
      ? section('出生时间校正', formatPublicTrueSolarEvidence(params.result.trueSolarEvidence))
      : '',
    section('分析背景', `分析主题：${ZIWEI_TOPIC_LABELS[topic]}\n分析范围：${scopeLabel(scope)}`),
    section(
      '分析对象',
      scope === 'full'
        ? '本命盘与完整大限流年流月流日流时'
        : payload.active_scope.label || scopeLabel(scope),
    ),
    section('本命资料', chartLines),
    buildKeyPalaces(
      payload.palaces,
      activePalace,
      lifePalace,
      bodyPalace,
      payload.active_scope.scope === 'origin',
    ),
    scope === 'full' ? section('完整运限资料', formatPublicZiweiFullScopeText(params.result)) : '',
    section('问题', question),
    mode === 'custom' ? '' : section('任务', '请依据紫微盘面完成解读。'),
  ]);
  const selectedSchools = params.schools?.length ? params.schools : [];
  const schoolsText = formatPromptSchoolGuidance('ziwei', selectedSchools);
  if (schoolsText) {
    return insertBeforeHeading(
      prompt,
      '【问题】',
      `【${selectedSchools.length > 1 ? '多派合参' : '解读流派'}】\n${schoolsText}`,
    );
  }
  const legacySchool = params.school ? getZiweiSchoolGuidance(params.school) : '';
  return legacySchool
    ? insertBeforeHeading(prompt, '【问题】', `【流派】\n${legacySchool}`)
    : prompt;
}

export const buildZiweiPromptForRuntime = buildPublicZiweiPromptForRuntime;

export function buildBaziZiweiPromptForResults(params: {
  baziResult: BaziChartResult;
  ziweiResult: ZiweiRuntime;
  question: string;
  baziTopic?: BaziPromptTopic;
  ziweiTopic?: ZiweiPromptTopic;
  ziweiScope?: ZiweiPromptScope;
  mode?: PromptMode;
  baziSchool?: BaziSchool;
  baziSchools?: readonly BaziSchool[];
  ziweiSchool?: ZiweiSchool;
  ziweiSchools?: readonly ZiweiSchool[];
}) {
  const baziText = formatBaziForPrompt(params.baziResult, null, 'general');
  const ziweiText = formatZiweiEvidenceText(params.ziweiResult, params.ziweiScope ?? 'origin');
  const guidance = [
    params.baziSchools?.length
      ? buildBaziSchoolsPromptSection(params.baziResult, params.baziSchools)
      : buildBaziSchoolPromptSection(params.baziResult, params.baziSchool),
    params.ziweiSchools?.length
      ? `【紫微多派合参】\n${formatPromptSchoolGuidance('ziwei', params.ziweiSchools)}`
      : params.ziweiSchool
        ? `【紫微流派】\n${getZiweiSchoolGuidance(params.ziweiSchool)}`
        : '',
  ]
    .filter(Boolean)
    .join('\n\n');
  return joinSections([
    buildPromptGuidance('bazi-ziwei'),
    guidance,
    section('当前时间', formatPromptCurrentTime()),
    section('八字排盘信息', baziText),
    section('紫微盘面信息', ziweiText),
    params.question.trim() ? section('问题', params.question.trim()) : '',
    params.mode === 'custom' ? '' : section('任务', '请依据八字和紫微盘面完成解读。'),
  ]);
}

export function buildCombinedPromptText(system: string, user: string) {
  return [system, user].filter(Boolean).join('\n\n');
}
