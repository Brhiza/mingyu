import type { AnalysisPayloadV1, PalaceFact, ScopeType, StarFact } from '../../types/analysis';
import type { BaziChartResult } from '@core/bazi/baziTypes';
import type { FortuneSelectionContext } from '@core/bazi/fortuneSelection';
import { formatBaziForPrompt } from '@core/bazi/baziAnalysisFormatter';
import {
  BAZI_AI_PROMPTS,
  buildPromptFromConfig,
  type AIPromptOption,
  type BaziFortunePromptScope,
} from '../../utils/ai/aiPrompts';
import { formatZiweiTrueSolarEvidence, type ZiweiRuntime } from '../full-chart-engine/ziwei';
import { formatPalaceName, mapScopeLabel, mapTopicLabel } from '../ziwei-prompts/labels';
import { formatPromptCurrentTime } from '../prompt-time';
import { getZiweiDefaultQuestion } from '../prompt-default-questions';
import { buildPromptGuidanceSections, insertPromptSectionBeforeHeading } from '../prompt-guidance';

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

export const BAZI_SCHOOLS = ['traditional', 'mangpai', 'xinpai'] as const;
export const ZIWEI_SCHOOLS = ['sanhe', 'feixing', 'sihua'] as const;

export type BaziPromptTopic = (typeof BAZI_PROMPT_TOPICS)[number];
export type ZiweiPromptTopic = (typeof ZIWEI_PROMPT_TOPICS)[number];
export type ZiweiPromptScope = (typeof ZIWEI_PROMPT_SCOPES)[number];
export type PromptMode = (typeof PROMPT_MODES)[number];
export type PublicBaziFortuneScope = (typeof BAZI_FORTUNE_SCOPES)[number];
export type BaziSchool = (typeof BAZI_SCHOOLS)[number];
export type ZiweiSchool = (typeof ZIWEI_SCHOOLS)[number];

const FULL_ZIWEI_SCOPE_ORDER: ScopeType[] = [
  'origin',
  'decadal',
  'yearly',
  'monthly',
  'daily',
  'hourly',
];

const BAZI_SCHOOL_GUIDANCE: Record<BaziSchool, string> = {
  traditional: '八字流派：传统派。以子平格局与调候论命。',
  mangpai: '八字流派：盲派。以十神象法与年限分段论命。',
  xinpai: '八字流派：新派。以旺衰、调候与流通论命。',
};

const ZIWEI_SCHOOL_GUIDANCE: Record<ZiweiSchool, string> = {
  sanhe: '紫微流派：三合派。命身宫位、主星庙旺、对宫与三方四正构成盘面资料，四化作牵引。',
  feixing: '紫微流派：飞星派。盘面提供生年四化、当前运限四化、自化与飞化落宫，三方四正作会照资料。',
  sihua:
    '紫微流派：四化派。生年四化、运限四化与禄权科忌落宫构成盘面资料，星曜庙旺与三方构成四化条件资料。',
};

export function getBaziSchoolGuidance(school?: BaziSchool) {
  if (!school || !BAZI_SCHOOL_GUIDANCE[school]) {
    return '';
  }
  return BAZI_SCHOOL_GUIDANCE[school];
}

export function getZiweiSchoolGuidance(school?: ZiweiSchool) {
  if (!school || !ZIWEI_SCHOOL_GUIDANCE[school]) {
    return '';
  }
  return ZIWEI_SCHOOL_GUIDANCE[school];
}

const BAZI_TOPIC_TO_PROMPT_ID: Record<BaziPromptTopic, string> = {
  general: 'ai-mingge-zonglun',
  recent: 'ai-recent',
  career: 'ai-career',
  'job-change': 'ai-job-change',
  'startup-partnership': 'ai-startup-partnership',
  'investment-partnership': 'ai-investment-partnership',
  wealth: 'ai-wealth-timing',
  marriage: 'ai-marriage',
  'relationship-push': 'ai-relationship-push',
  'relationship-decision': 'ai-relationship-decision',
  'reconciliation-decision': 'ai-reconciliation-decision',
  children: 'ai-children-fate',
  family: 'ai-home',
  'home-move': 'ai-home-move',
  'settle-relocate': 'ai-settle-relocate',
  social: 'ai-social',
  emotion: 'ai-emotion',
  health: 'ai-health',
  parents: 'ai-family',
  study: 'ai-study',
  'study-advance': 'ai-study-advance',
  'exam-landing': 'ai-exam-landing',
  growth: 'ai-growth',
  talent: 'ai-talent',
};

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

export function buildCombinedPromptText(system: string, user: string) {
  return [system, user].filter(Boolean).join('\n\n');
}

function resolveBaziPromptOption(topic: BaziPromptTopic): AIPromptOption {
  const promptId = BAZI_TOPIC_TO_PROMPT_ID[topic] ?? BAZI_TOPIC_TO_PROMPT_ID.general;
  return BAZI_AI_PROMPTS.single.find((item) => item.id === promptId) ?? BAZI_AI_PROMPTS.single[0];
}

export function buildBaziPromptForResult(params: {
  result: BaziChartResult;
  question?: string;
  topic?: BaziPromptTopic;
  mode?: PromptMode;
  school?: BaziSchool;
  fortuneSelectionContext?: FortuneSelectionContext | null;
  fortuneScope?: PublicBaziFortuneScope;
}) {
  const topic = params.topic ?? 'general';
  const option = resolveBaziPromptOption(topic);
  const prompt = buildPromptFromConfig(
    params.question ?? '',
    option,
    params.result,
    params.fortuneSelectionContext ?? null,
    BAZI_TOPIC_LABELS[topic],
    {
      isCustomQuestion: params.mode === 'custom',
      fortuneScope: params.fortuneScope as BaziFortunePromptScope | undefined,
    },
  );

  const baseText = buildCombinedPromptText(prompt.system, prompt.user);
  const schoolGuidance = getBaziSchoolGuidance(params.school);
  if (schoolGuidance) {
    return insertPromptSectionBeforeHeading(baseText, '【问题】', `【流派】\n${schoolGuidance}`);
  }
  return baseText;
}

export function buildSerializableZiweiResult(result: ZiweiRuntime) {
  const originPayload = result.payloadByScope.origin ?? Object.values(result.payloadByScope)[0]!;
  const compatibility = buildZiweiCompatibilityFields(originPayload);

  return {
    basicInfo: originPayload.basic_info,
    calculationConfig: originPayload.calculation_config,
    scopeNames: Object.keys(result.payloadByScope),
    payloadByScope: result.payloadByScope,
    trueSolarEvidence: result.trueSolarEvidence,
    ...compatibility,
  };
}

export function getZiweiPromptCalculationScopes(scope: ZiweiPromptScope): ScopeType[] {
  if (scope === 'full') {
    return FULL_ZIWEI_SCOPE_ORDER;
  }
  return [scope as ScopeType];
}

function mapZiweiPromptScopeLabel(scope: ZiweiPromptScope | ScopeType) {
  return scope === 'full' ? '完整输出' : mapScopeLabel(scope as ScopeType);
}

function formatPublicZiweiMutagenMap(payload: AnalysisPayloadV1) {
  const items = payload.active_scope.mutagen_map
    .map((item) => {
      const star = item.star ? `${item.star}化${item.mutagen}` : `化${item.mutagen}`;
      const natalPalace = item.palace_name ? `入本命${formatPalaceName(item.palace_name)}` : '';
      const dynamicPalace = item.dynamic_palace_name
        ? `（动态${formatPalaceName(item.dynamic_palace_name)}）`
        : '';
      return `${star}${natalPalace}${dynamicPalace}`;
    })
    .filter(Boolean);

  return items.length > 0 ? items.join('；') : '未标出当前四化';
}

function formatPublicZiweiScopeHits(payload: AnalysisPayloadV1) {
  const hits = payload.palaces
    .flatMap((palace) =>
      palace.scope_hits.map((hit) =>
        [
          hit,
          `本命${palace.name}宫`,
          palace.dynamic_scope_name ? `动态宫名${palace.dynamic_scope_name}` : '',
          palace.major_stars.length
            ? `主星${palace.major_stars.map((star) => star.name).join('、')}`
            : '',
        ]
          .filter(Boolean)
          .join('，'),
      ),
    )
    .filter(Boolean);

  return hits.length > 0 ? hits.slice(0, 8).join('；') : '未标出明显运限落宫';
}

export function formatPublicZiweiFullScopeText(result: ZiweiRuntime) {
  const lines = FULL_ZIWEI_SCOPE_ORDER.map((scope) => {
    const payload = result.payloadByScope[scope];
    if (!payload) return '';
    const scopeLabel = mapScopeLabel(scope);
    const activePalace = payload.palaces.find(
      (palace) => palace.index === payload.active_scope.palace_index,
    );
    const palaceText = activePalace ? `当前落宫：本命${activePalace.name}宫。` : '';
    const scopeDetails =
      scope === 'origin'
        ? ''
        : [
            `当前四化：${formatPublicZiweiMutagenMap(payload)}。`,
            `运限命中：${formatPublicZiweiScopeHits(payload)}。`,
          ].join('');

    return `${scopeLabel}：分析对象：${payload.active_scope.label || scopeLabel}。${palaceText}${scopeDetails}`;
  }).filter(Boolean);

  return lines.length > 0
    ? ['完整紫微运限资料：', ...lines.map((line, index) => `${index + 1}. ${line}`)].join('\n')
    : '';
}

function buildZiweiCompatibilityFields(payload: ZiweiRuntime['payloadByScope']['origin']) {
  const mutagens: Record<string, string> = {};
  const gongList = payload.palaces.map((palace) => {
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
  const lifePalace = payload.palaces.find((palace) => palace.name === '命宫');
  const bodyPalace = payload.palaces.find((palace) => palace.is_body_palace);

  return {
    fourMutagens: mutagens,
    birthMutagens: mutagens,
    gongList,
    命宫: lifePalace?.earthly_branch ?? '',
    身宫: bodyPalace?.name ?? '',
    五行局: payload.basic_info.five_elements_class,
    四化: mutagens,
  };
}

export function buildZiweiPromptForRuntime(params: {
  result: ZiweiRuntime;
  question?: string;
  topic?: ZiweiPromptTopic;
  scope?: ZiweiPromptScope;
  mode?: PromptMode;
  school?: ZiweiSchool;
}) {
  return buildPublicZiweiPromptForRuntime(params);
}

function buildPublicZiweiTaskText() {
  return '请依据紫微盘面完成解读。';
}

function formatPublicZiweiStar(star: StarFact) {
  return [star.name, star.brightness ? `(${star.brightness})` : ''].join('');
}

function formatPublicZiweiPalaceBrief(palace: PalaceFact) {
  const stars = [...palace.major_stars, ...palace.minor_stars]
    .map(formatPublicZiweiStar)
    .filter(Boolean)
    .slice(0, 8);
  const tags = palace.summary_tags.length > 0 ? `；标记：${palace.summary_tags.join('、')}` : '';
  const details = [
    stars.length > 0 ? `星曜：${stars.join('、')}` : '',
    palace.changsheng12 ? `长生：${palace.changsheng12}` : '',
    palace.boshi12 ? `博士：${palace.boshi12}` : '',
  ].filter(Boolean);
  return `- ${palace.name}（${palace.heavenly_stem}${palace.earthly_branch}）：${details.join('；')}${tags}`;
}

function findPublicZiweiPalaceByName(palaces: PalaceFact[], name: string) {
  const normalizedName = name.endsWith('宫') ? name.slice(0, -1) : name;
  return palaces.find((palace) => palace.name === name || palace.name === normalizedName);
}

function buildPublicZiweiKeyPalaceSection(params: {
  palaces: PalaceFact[];
  activePalace?: PalaceFact;
  lifePalace?: PalaceFact;
  bodyPalace?: PalaceFact;
  isOriginScope: boolean;
}) {
  const scopeHitPalaces = params.isOriginScope
    ? []
    : [...params.palaces]
        .filter((palace) => palace.scope_hits.length > 0)
        .sort((left, right) => right.scope_hits.length - left.scope_hits.length);
  const palaceNames = [
    params.activePalace?.name,
    params.lifePalace?.name,
    params.bodyPalace?.name,
    ...scopeHitPalaces.map((palace) => palace.name),
    '福德宫',
    '迁移宫',
  ].filter(Boolean) as string[];
  const selected = Array.from(
    new Map(
      palaceNames
        .map((name) => findPublicZiweiPalaceByName(params.palaces, name))
        .filter((palace): palace is PalaceFact => Boolean(palace))
        .map((palace) => [palace.index, palace]),
    ).values(),
  ).slice(0, 7);

  return selected.length > 0
    ? `【重点宫位资料】\n${selected.map(formatPublicZiweiPalaceBrief).join('\n')}`
    : '';
}

export function buildPublicZiweiPromptForRuntime(params: {
  result: ZiweiRuntime;
  question?: string;
  topic?: ZiweiPromptTopic;
  scope?: ZiweiPromptScope;
  mode?: PromptMode;
  school?: ZiweiSchool;
}) {
  const scope = params.scope ?? 'origin';
  const mode = params.mode ?? 'framework';
  const topic = params.topic ?? (mode === 'custom' ? 'chat' : 'life');
  const topicLabel = mapTopicLabel(topic);
  const payload =
    scope === 'full'
      ? params.result.payloadByScope.origin
      : (params.result.payloadByScope[scope as ScopeType] ?? params.result.payloadByScope.origin);
  const scopeLabel = mapZiweiPromptScopeLabel(scope);
  const trueSolarText = formatZiweiTrueSolarEvidence(params.result.trueSolarEvidence);
  const activePalace = payload.palaces.find(
    (palace) => palace.index === payload.active_scope.palace_index,
  );
  const lifePalace = payload.palaces.find((palace) => palace.name === '命宫');
  const bodyPalace = payload.palaces.find((palace) => palace.is_body_palace);
  const formatStars = (palace: (typeof payload.palaces)[number] | undefined) => {
    const stars = [...(palace?.major_stars ?? []), ...(palace?.minor_stars ?? [])]
      .map((star) => star.name)
      .filter(Boolean)
      .slice(0, 8);

    return stars.join('、');
  };
  const mutagenText =
    payload.active_scope.mutagen_map.length > 0
      ? payload.active_scope.mutagen_map
          .map((item) => {
            const star = item.star ? `${item.star}化${item.mutagen}` : `化${item.mutagen}`;
            const natalPalace = item.palace_name
              ? `入本命${formatPalaceName(item.palace_name)}`
              : '';
            const dynamicPalace = item.dynamic_palace_name
              ? `（动态${formatPalaceName(item.dynamic_palace_name)}）`
              : '';
            return `${star}${natalPalace}${dynamicPalace}`;
          })
          .join('；')
      : '';
  const chartLines = [
    `出生日期：${payload.basic_info.solar_date}；农历：${payload.basic_info.lunar_date}；时辰：${payload.basic_info.birth_time_label}`,
    lifePalace
      ? `命宫：${lifePalace.name}${formatStars(lifePalace) ? `；星曜：${formatStars(lifePalace)}` : ''}`
      : '',
    bodyPalace
      ? `身宫：${bodyPalace.name}${formatStars(bodyPalace) ? `；星曜：${formatStars(bodyPalace)}` : ''}`
      : '',
    activePalace ? `当前落宫：${activePalace.name}` : '',
    mutagenText ? `当前四化：${mutagenText}` : '',
  ].filter(Boolean);
  const prompt = [
    buildPromptGuidanceSections('ziwei'),
    `【当前时间】\n${formatPromptCurrentTime()}`,
    trueSolarText ? `【出生时间校正】\n${trueSolarText}` : '',
    `【分析背景】\n分析主题：${topicLabel}\n分析范围：${scopeLabel}`,
    `【分析对象】\n${scope === 'full' ? '本命盘与完整大限流年流月流日流时' : payload.active_scope.label || scopeLabel}`,
    `【本命资料】\n${chartLines.join('\n')}`,
    buildPublicZiweiKeyPalaceSection({
      palaces: payload.palaces,
      activePalace,
      lifePalace,
      bodyPalace,
      isOriginScope: payload.active_scope.scope === 'origin',
    }),
    scope === 'full' ? `【完整运限资料】\n${formatPublicZiweiFullScopeText(params.result)}` : '',
    ...(params.question?.trim() ||
    getZiweiDefaultQuestion(topic, { isCustomQuestion: mode === 'custom' })
      ? [
          `【问题】\n${params.question?.trim() || getZiweiDefaultQuestion(topic, { isCustomQuestion: mode === 'custom' })}`,
        ]
      : []),
    mode === 'custom' ? '' : `【任务】\n${buildPublicZiweiTaskText()}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const schoolGuidance = getZiweiSchoolGuidance(params.school);
  const promptWithSchool = schoolGuidance
    ? insertPromptSectionBeforeHeading(prompt, '【问题】', `【流派】\n${schoolGuidance}`)
    : prompt;

  return promptWithSchool;
}

function formatPublicZiweiEvidenceText(params: { result: ZiweiRuntime; scope?: ZiweiPromptScope }) {
  const scope = params.scope ?? 'origin';
  const payload =
    scope === 'full'
      ? params.result.payloadByScope.origin
      : (params.result.payloadByScope[scope as ScopeType] ?? params.result.payloadByScope.origin);
  const scopeLabel = mapZiweiPromptScopeLabel(scope);
  const activePalace = payload.palaces.find(
    (palace) => palace.index === payload.active_scope.palace_index,
  );
  const lifePalace = payload.palaces.find((palace) => palace.name === '命宫');
  const bodyPalace = payload.palaces.find((palace) => palace.is_body_palace);
  const formatStars = (palace: (typeof payload.palaces)[number] | undefined) => {
    const stars = [...(palace?.major_stars ?? []), ...(palace?.minor_stars ?? [])]
      .map((star) => star.name)
      .filter(Boolean)
      .slice(0, 8);

    return stars.join('、');
  };
  const mutagenText =
    payload.active_scope.mutagen_map.length > 0
      ? payload.active_scope.mutagen_map
          .map((item) => {
            const star = item.star ? `${item.star}化${item.mutagen}` : `化${item.mutagen}`;
            const natalPalace = item.palace_name
              ? `入本命${formatPalaceName(item.palace_name)}`
              : '';
            const dynamicPalace = item.dynamic_palace_name
              ? `（动态${formatPalaceName(item.dynamic_palace_name)}）`
              : '';
            return `${star}${natalPalace}${dynamicPalace}`;
          })
          .join('；')
      : '';
  return [
    `分析对象：${scope === 'full' ? '本命盘与完整大限流年流月流日流时' : payload.active_scope.label || scopeLabel}`,
    `出生日期：${payload.basic_info.solar_date}；农历：${payload.basic_info.lunar_date}；时辰：${payload.basic_info.birth_time_label}`,
    lifePalace
      ? `命宫：${lifePalace.name}${formatStars(lifePalace) ? `；星曜：${formatStars(lifePalace)}` : ''}`
      : '',
    bodyPalace
      ? `身宫：${bodyPalace.name}${formatStars(bodyPalace) ? `；星曜：${formatStars(bodyPalace)}` : ''}`
      : '',
    activePalace ? `当前落宫：${activePalace.name}` : '',
    mutagenText ? `当前四化：${mutagenText}` : '',
    buildPublicZiweiKeyPalaceSection({
      palaces: payload.palaces,
      activePalace,
      lifePalace,
      bodyPalace,
      isOriginScope: payload.active_scope.scope === 'origin',
    }),
    scope === 'full' ? formatPublicZiweiFullScopeText(params.result) : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildBaziZiweiPromptForResults(params: {
  baziResult: BaziChartResult;
  ziweiResult: ZiweiRuntime;
  question: string;
  baziTopic?: BaziPromptTopic;
  ziweiTopic?: ZiweiPromptTopic;
  ziweiScope?: ZiweiPromptScope;
  mode?: PromptMode;
  baziSchool?: BaziSchool;
  ziweiSchool?: ZiweiSchool;
}) {
  const ziweiScope = params.ziweiScope ?? 'origin';
  const baziText = formatBaziForPrompt(params.baziResult, null, 'general');
  const ziweiText = formatPublicZiweiEvidenceText({
    result: params.ziweiResult,
    scope: ziweiScope,
  });
  const guidance = [
    getBaziSchoolGuidance(params.baziSchool),
    getZiweiSchoolGuidance(params.ziweiSchool),
  ].filter(Boolean);

  const baseSections = [
    buildPromptGuidanceSections('bazi-ziwei'),
    guidance.length ? `【流派】\n${guidance.join('\n')}` : '',
    `【当前时间】\n${formatPromptCurrentTime()}`,
    `【八字排盘信息】\n${baziText}`,
    `【紫微盘面信息】\n${ziweiText}`,
    ...(params.question.trim() ? [`【问题】\n${params.question.trim()}`] : []),
    params.mode === 'custom' ? '' : '【任务】\n请依据八字和紫微盘面完成解读。',
  ].filter(Boolean);

  return baseSections.join('\n\n');
}
