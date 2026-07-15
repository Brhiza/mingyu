import type { AnalysisPayloadV1, PalaceFact, ScopeType, StarFact } from '../../types/analysis';
import type { BaziChartResult } from '@core/bazi/baziTypes';
import type { FortuneSelectionContext } from '@core/bazi/fortuneSelection';
import { formatBaziForPrompt } from '@core/bazi/baziAnalysisFormatter';
import {
  BAZI_AI_PROMPTS,
  buildBaziQuestionGuidanceSection,
  buildPromptFromConfig,
  type AIPromptOption,
  type BaziFortunePromptScope,
} from '../../utils/ai/aiPrompts';
import {
  buildCombinedZiweiPrompt,
  formatZiweiTrueSolarEvidence,
  type ZiweiRuntime,
} from '../full-chart-engine/ziwei';
import { buildEvidenceChainSummary } from '../ziwei-prompts/builders';
import { mapScopeLabel, mapTopicLabel } from '../ziwei-prompts/labels';
import { formatPromptCurrentTime } from '../prompt-time';

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
  traditional:
    '【流派指引】传统派：以子平正法为本，先看月令旺衰、格局成败、调候用神，再看十神生克、宫位关系、神煞旁证；用神取扶抑、调候、通关、病药四法之一作为主线。',
  mangpai:
    '【流派指引】盲派：以日干为我，重柱位、阴阳、十神象法、六亲实战；不强调旺衰格局，而以十神配位、生克制化、合冲刑害的"动作"为断验主线；可结合"年限分段"看大运岁数对应实事。',
  xinpai:
    '【流派指引】新派（新派子平）：以日干旺衰为根，强调"调候 + 流通"，重五行平衡与气候配合；用神取流通生扶之神，忌神为破坏流通之神；不拘泥固定格局名相。',
};

const ZIWEI_SCHOOL_GUIDANCE: Record<ZiweiSchool, string> = {
  sanhe:
    '【流派指引】三合派：以本命十二宫为根基，重三方四正（命迁财官的对、合、夹）、星曜庙旺平陷、星情组合、本命格局；运限按大限十年看，重点是星曜与宫位的稳定结构。',
  feixing:
    '【流派指引】飞星派：以四化飞星为核心，关注生年四化、命宫四化、宫干自化、运限四化飞入飞出的链路；化禄/化权/化科为引动主证，化忌为牵动暗证；强调"飞入哪宫触发哪事"。',
  sihua:
    '【流派指引】四化派：以生年四化定先天命局主轴，结合宫干四化看后天事象；化禄主财喜机会、化权主权柄掌控、化科主名声贵人、化忌主牵挂阻滞；以四化飞入飞出的"宫职链"判断主线。',
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
    return `${schoolGuidance}\n\n${baseText}`;
  }
  return baseText;
}

export function buildSerializableZiweiResult(result: ZiweiRuntime) {
  const originPayload = result.payloadByScope.origin ?? Object.values(result.payloadByScope)[0]!;
  const compatibility = buildZiweiCompatibilityFields(originPayload);

  return {
    basicInfo: originPayload.basic_info,
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
    .map((item) =>
      [item.star ? `${item.star}化${item.mutagen}` : `化${item.mutagen}`, item.palace_name]
        .filter(Boolean)
        .join('入'),
    )
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
    const dateText = payload.active_scope.solar_date
      ? `参考日期：${payload.active_scope.solar_date}。`
      : '';
    const ageText = payload.active_scope.nominal_age
      ? `虚岁：${payload.active_scope.nominal_age}。`
      : '';
    const scopeDetails =
      scope === 'origin'
        ? ''
        : [
            `当前四化：${formatPublicZiweiMutagenMap(payload)}。`,
            `运限命中：${formatPublicZiweiScopeHits(payload)}。`,
          ].join('');

    return `${scopeLabel}：分析对象：${payload.active_scope.label || scopeLabel}。${dateText}${ageText}${palaceText}${scopeDetails}`;
  }).filter(Boolean);

  return lines.length > 0
    ? ['完整紫微运限资料：', ...lines.map((line, index) => `${index + 1}. ${line}`)].join('\n')
    : '';
}

function insertZiweiFullScopeSection(prompt: string, fullScopeText: string) {
  if (!fullScopeText) return prompt;
  const section = `【完整运限资料】\n${fullScopeText}`;
  return prompt.includes('\n\n【问题】')
    ? prompt.replace('\n\n【问题】', `\n\n${section}\n\n【问题】`)
    : `${prompt}\n\n${section}`;
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
  const scope = params.scope ?? 'origin';
  const payload =
    scope === 'full'
      ? params.result.payloadByScope.origin
      : (params.result.payloadByScope[scope as ScopeType] ?? params.result.payloadByScope.origin);
  const fallbackTopic = params.mode === 'custom' ? 'chat' : 'life';
  const baseText = buildCombinedZiweiPrompt(
    payload,
    params.topic ?? fallbackTopic,
    params.question ?? '',
    {
      isCustomQuestion: params.mode === 'custom',
      trueSolarEvidence: params.result.trueSolarEvidence,
    },
  );
  const promptText =
    scope === 'full'
      ? insertZiweiFullScopeSection(baseText, formatPublicZiweiFullScopeText(params.result))
      : baseText;
  const schoolGuidance = getZiweiSchoolGuidance(params.school);
  if (schoolGuidance) {
    return `${schoolGuidance}\n\n${promptText}`;
  }
  return promptText;
}

function buildPublicZiweiTaskText() {
  return '先围绕【问题】判断对应宫位范围，再从已给出的命宫、身宫、当前落宫、三方四正、四化和分析对象中选取主要证据；若【问题】未限定主题，按通用口径处理；若【问题】已限定主题，只把主题作为问题范围。';
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
  return `- ${palace.name}（${palace.heavenly_stem}${palace.earthly_branch}）：星曜：${stars.length > 0 ? stars.join('、') : '未提供主星资料'}；长生：${palace.changsheng12 || '未提供'}；博士：${palace.boshi12 || '未提供'}${tags}`;
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
    ? `【重点宫位】\n${selected.map(formatPublicZiweiPalaceBrief).join('\n')}`
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
  const payload =
    scope === 'full'
      ? params.result.payloadByScope.origin
      : (params.result.payloadByScope[scope as ScopeType] ?? params.result.payloadByScope.origin);
  const scopeLabel = mapZiweiPromptScopeLabel(scope);
  const topicLabel = mapTopicLabel(topic);
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

    return stars.length > 0 ? stars.join('、') : '未提供主星资料';
  };
  const mutagenText =
    payload.active_scope.mutagen_map.length > 0
      ? payload.active_scope.mutagen_map
          .map((item) =>
            [item.star ? `${item.star}化${item.mutagen}` : `化${item.mutagen}`, item.palace_name]
              .filter(Boolean)
              .join('入'),
          )
          .join('；')
      : '未提供当前范围四化';
  const evidenceSummaryText = Object.entries(buildEvidenceChainSummary(payload))
    .map(([key, value]) => `${key}：${value}`)
    .join('\n');
  const trueSolarEvidenceText = formatZiweiTrueSolarEvidence(params.result.trueSolarEvidence);
  const prompt = [
    `【分析背景】\n分析主题：${topicLabel}\n分析范围：${scopeLabel}\n分析对象：${scope === 'full' ? '本命盘与完整大限流年流月流日流时' : payload.active_scope.label || scopeLabel}\n参考日期：${payload.active_scope.solar_date}\n虚岁：${payload.active_scope.nominal_age}`,
    `【排盘信息】\n出生日期：${payload.basic_info.solar_date}；农历：${payload.basic_info.lunar_date}；时辰：${payload.basic_info.birth_time_label}\n命宫：${lifePalace?.name ?? '命宫'}；星曜：${formatStars(lifePalace)}\n身宫：${bodyPalace?.name ?? '未标出'}；星曜：${formatStars(bodyPalace)}\n当前落宫：${activePalace?.name ?? '本命范围'}\n当前四化：${mutagenText}`,
    buildPublicZiweiKeyPalaceSection({
      palaces: payload.palaces,
      activePalace,
      lifePalace,
      bodyPalace,
      isOriginScope: payload.active_scope.scope === 'origin',
    }),
    trueSolarEvidenceText ? `【出生时间校正证据】\n${trueSolarEvidenceText}` : '',
    `【证据汇总】\n${evidenceSummaryText}`,
    scope === 'full' ? `【完整运限资料】\n${formatPublicZiweiFullScopeText(params.result)}` : '',
    `【问题】\n${params.question ?? ''}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const schoolGuidance = getZiweiSchoolGuidance(params.school);
  const promptWithSchool = schoolGuidance ? `${schoolGuidance}\n\n${prompt}` : prompt;

  if (mode === 'custom') {
    return promptWithSchool;
  }

  return [
    promptWithSchool,
    '',
    `【任务】\n${buildPublicZiweiTaskText()}请结合【问题】直接给出判断、关键依据和可执行建议。`,
    '',
    '【输出要求】\n先直接回答【问题】，再按“结论总览、宫位主线、四化触发、格局与三方四正、反证限制、应期与建议”展开；每部分都要写明主证、辅证、反证或限制；证据不足时要明确说明，不要编造盘面没有提供的信息；最后给出当下建议、避免事项和观察信号。',
  ].join('\n');
}

function formatPublicZiweiEvidenceText(params: {
  result: ZiweiRuntime;
  scope?: ZiweiPromptScope;
  topic?: ZiweiPromptTopic;
}) {
  const scope = params.scope ?? 'origin';
  const topic = params.topic ?? 'life';
  const payload =
    scope === 'full'
      ? params.result.payloadByScope.origin
      : (params.result.payloadByScope[scope as ScopeType] ?? params.result.payloadByScope.origin);
  const scopeLabel = mapZiweiPromptScopeLabel(scope);
  const topicLabel = mapTopicLabel(topic);
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

    return stars.length > 0 ? stars.join('、') : '未提供主星资料';
  };
  const mutagenText =
    payload.active_scope.mutagen_map.length > 0
      ? payload.active_scope.mutagen_map
          .map((item) =>
            [item.star ? `${item.star}化${item.mutagen}` : `化${item.mutagen}`, item.palace_name]
              .filter(Boolean)
              .join('入'),
          )
          .join('；')
      : '未提供当前范围四化';
  const evidenceSummaryText = Object.entries(buildEvidenceChainSummary(payload))
    .map(([key, value]) => `${key}：${value}`)
    .join('\n');
  const trueSolarEvidenceText = formatZiweiTrueSolarEvidence(params.result.trueSolarEvidence);

  return [
    `分析主题：${topicLabel}`,
    `分析范围：${scopeLabel}`,
    `分析对象：${scope === 'full' ? '本命盘与完整大限流年流月流日流时' : payload.active_scope.label || scopeLabel}`,
    `参考日期：${payload.active_scope.solar_date}`,
    `虚岁：${payload.active_scope.nominal_age}`,
    `出生日期：${payload.basic_info.solar_date}；农历：${payload.basic_info.lunar_date}；时辰：${payload.basic_info.birth_time_label}`,
    `命宫：${lifePalace?.name ?? '命宫'}；星曜：${formatStars(lifePalace)}`,
    `身宫：${bodyPalace?.name ?? '未标出'}；星曜：${formatStars(bodyPalace)}`,
    `当前落宫：${activePalace?.name ?? '本命范围'}`,
    `当前四化：${mutagenText}`,
    trueSolarEvidenceText ? `出生时间校正证据：\n${trueSolarEvidenceText}` : '',
    `证据汇总：\n${evidenceSummaryText}`,
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
  const mode = params.mode ?? 'framework';
  const baziTopic = params.baziTopic ?? 'general';
  const ziweiTopic = params.ziweiTopic ?? 'life';
  const ziweiScope = params.ziweiScope ?? 'origin';
  const baziText = formatBaziForPrompt(params.baziResult, null, 'general');
  const ziweiText = formatPublicZiweiEvidenceText({
    result: params.ziweiResult,
    topic: ziweiTopic,
    scope: ziweiScope,
  });
  const guidance = [
    getBaziSchoolGuidance(params.baziSchool),
    getZiweiSchoolGuidance(params.ziweiSchool),
  ].filter(Boolean);

  const baseSections = [
    '你是一位同时熟悉八字与紫微斗数的资深命理分析师，擅长先用八字判断命局结构、用神喜忌与岁运主线，再用紫微斗数校验对应宫位主轴、四化触发、三方四正和运限落点。',
    guidance.join('\n'),
    '【要求】\n- 只基于提供的八字排盘、紫微盘面和问题作答。\n- 八字用于判断长期底色、格局强弱、喜忌取用和岁运触发；紫微用于校验宫位主轴、四化牵动、三方四正与运限落点。\n- 两套体系结论一致时可以增强结论；出现分歧时必须说明哪一侧证据更强、另一侧对应的条件与待核验点。\n- 不得编造已提供资料没有给出的新盘面事实；允许基于已提供资料做传统命理推理，但必须标明证据来源。\n- 不要平均复述两套盘面资料，优先提炼最能回答【问题】的核心证据。',
    `【当前时间】\n${formatPromptCurrentTime()}`,
    `【分析对象】\n八字主题：${BAZI_TOPIC_LABELS[baziTopic]}\n紫微主题：${mapTopicLabel(ziweiTopic)}\n紫微范围：${mapZiweiPromptScopeLabel(ziweiScope)}`,
    `【八字排盘信息】\n${baziText}`,
    `【紫微盘面信息】\n${ziweiText}`,
    `【问题】\n${params.question.trim()}`,
  ].filter(Boolean);

  if (mode === 'custom') {
    return baseSections.join('\n\n');
  }

  return [
    ...baseSections,
    `【断盘要点】\n${buildBaziQuestionGuidanceSection(false)}`,
    '【任务】\n先用八字判断命局主线、结构强弱、喜忌取用与当前触发，再用紫微校验对应宫位主轴、四化牵动、三方四正和运限落点，最后整合成一致结论、冲突点、应期触发与现实建议。',
    '【输出要求】\n先直接回答【问题】，再按“结论总览”“八字主线”“紫微校验”“交叉验证”“冲突点与待核验项”“应期触发”“现实建议”展开；每部分都要写明主证、辅证、反证或限制、触发条件与建议；若两套体系存在冲突，必须说明哪一侧证据更强、另一侧在什么条件下才成立。',
  ].join('\n\n');
}
