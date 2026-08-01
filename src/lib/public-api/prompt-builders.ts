import type { AnalysisPayloadV1, PalaceFact, ScopeType, StarFact } from '../../types/analysis';
import type { BaziChartResult } from '@core/bazi/baziTypes';
import type { BaziFortuneSelectionValue } from '@core/bazi/fortuneSelection';
import { formatBaziForPrompt } from '@core/bazi/audited';
import {
  BAZI_AI_PROMPTS,
  buildPromptFromConfig,
  type AIPromptOption,
} from '../../utils/ai/aiPrompts';
import {
  buildCombinedZiweiPrompt,
  formatZiweiTrueSolarEvidence,
  rebuildAuditedZiweiRuntime,
  type ZiweiRuntime,
} from '../full-chart-engine/ziwei';
import { formatPalaceName, mapScopeLabel, mapTopicLabel } from '../ziwei-prompts/labels';
import { formatPromptCurrentTime } from '../prompt-time';
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
  traditional:
    '八字流派偏好：传统派。此标签不改变已校勘事实与失败关闭边界，不据此补算整体旺衰、自动用神、喜忌或调候。',
  mangpai:
    '八字流派偏好：盲派。此标签不改变已校勘事实与失败关闭边界，不据此补造未逐条校勘的象法、年限或现实结论。',
  xinpai:
    '八字流派偏好：新派。此标签不改变已校勘事实与失败关闭边界，不据此补算整体旺衰、自动用神、喜忌、调候或流通结论。',
};

const ZIWEI_SCHOOL_GUIDANCE: Record<ZiweiSchool, string> = {
  sanhe:
    '紫微资料口径标签：三合派。当前只核对盘面已列的命身宫位、星曜位置、庙旺记录、对宫与三方四正索引；该标签不提供完整解释规则，不能据此生成宫位主轴、吉凶、事件或建议。',
  feixing:
    '紫微资料口径标签：飞星派。当前只核对盘面已列的生年四化、运限四化及明确提供的飞化位置；该标签不提供起法版本与完整解释规则，不能补造宫干飞化、吉凶、事件、应期或建议。',
  sihua:
    '紫微资料口径标签：四化派。当前只核对盘面已列的生年四化、运限四化与禄权科忌位置；该标签不提供四化起法版本与完整解释规则，不能补造宫干四化、吉凶、事件、应期或建议。',
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
  fortuneSelection?: BaziFortuneSelectionValue | null;
}) {
  const topic = params.topic ?? 'general';
  const option = resolveBaziPromptOption(topic);
  const prompt = buildPromptFromConfig(
    params.question ?? '',
    option,
    params.result,
    params.fortuneSelection ?? null,
    BAZI_TOPIC_LABELS[topic],
    { isCustomQuestion: params.mode === 'custom' },
  );

  const baseText = buildCombinedPromptText(prompt.system, prompt.user);
  const schoolGuidance = getBaziSchoolGuidance(params.school);
  if (schoolGuidance) {
    return insertPromptSectionBeforeHeading(baseText, '【问题】', `【流派】\n${schoolGuidance}`);
  }
  return baseText;
}

export async function buildSerializableZiweiResult(result: ZiweiRuntime) {
  const audited = await rebuildAuditedZiweiRuntime(result);
  const originPayload = audited.payloadByScope.origin ?? Object.values(audited.payloadByScope)[0]!;
  const compatibility = buildZiweiCompatibilityFields(originPayload);

  return {
    generation: audited.generation,
    basicInfo: originPayload.basic_info,
    calculationConfig: originPayload.calculation_config,
    scopeNames: Object.keys(audited.payloadByScope),
    payloadByScope: audited.payloadByScope,
    trueSolarEvidence: audited.trueSolarEvidence,
    ...compatibility,
  };
}

function formatPublicZiweiCalculationConfig(payload: AnalysisPayloadV1) {
  const config = payload.calculation_config;
  return [
    `基础安星：${config.algorithm_basis.replace(/^iztro\s*/i, '')}`,
    `闰月：${config.leap_month_rule}`,
    `分年：${config.year_divide_rule}`,
    `运限月份：${config.horoscope_divide_rule}`,
    `小限年龄：${config.age_divide_rule}`,
    `晚子时：${config.late_zi_rule}`,
  ].join('；');
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

  return hits.length > 0 ? hits.join('；') : '未标出明显运限落宫';
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

export async function buildZiweiPromptForRuntime(params: {
  result: ZiweiRuntime;
  question?: string;
  topic?: ZiweiPromptTopic;
  scope?: ZiweiPromptScope;
  mode?: PromptMode;
  school?: ZiweiSchool;
}) {
  const result = await rebuildAuditedZiweiRuntime(params.result);
  const scope = params.scope ?? 'origin';
  const payload =
    scope === 'full'
      ? result.payloadByScope.origin
      : (result.payloadByScope[scope as ScopeType] ?? result.payloadByScope.origin);
  const fallbackTopic = params.mode === 'custom' ? 'chat' : 'life';
  const baseText = buildCombinedZiweiPrompt(
    payload,
    params.topic ?? fallbackTopic,
    params.question ?? '',
    {
      isCustomQuestion: params.mode === 'custom',
      trueSolarEvidence: result.trueSolarEvidence,
      generatedAt: result.generation.timestamp,
    },
  );
  const promptText =
    scope === 'full'
      ? insertZiweiFullScopeSection(baseText, formatPublicZiweiFullScopeText(result))
      : baseText;
  const schoolGuidance = getZiweiSchoolGuidance(params.school);
  if (schoolGuidance) {
    return insertPromptSectionBeforeHeading(promptText, '【问题】', `【流派】\n${schoolGuidance}`);
  }
  return promptText;
}

function buildPublicZiweiTaskText() {
  return '请核对完整十二宫、星曜、四化、三方四正、已校验格局与运限等已列事实，并标明资料缺口；解释前提不完整时停在事实层。';
}

function formatPublicZiweiStar(star: StarFact) {
  const tags = [
    star.brightness,
    star.birth_mutagen ? `生年化${star.birth_mutagen}` : '',
    star.horoscope_mutagen ? `流耀化${star.horoscope_mutagen}` : '',
    star.active_scope_mutagen ? `当前运限化${star.active_scope_mutagen}` : '',
  ].filter(Boolean);
  return tags.length > 0 ? `${star.name}(${tags.join('/')})` : star.name;
}

function getPublicZiweiStars(palace: PalaceFact | undefined) {
  if (!palace) return [];
  return [
    ...palace.major_stars,
    ...palace.minor_stars,
    ...palace.other_stars,
    ...palace.scope_stars,
  ];
}

function formatPublicZiweiStars(palace: PalaceFact | undefined) {
  return getPublicZiweiStars(palace).map(formatPublicZiweiStar).filter(Boolean).join('、');
}

function formatPublicZiweiPalaceBrief(palace: PalaceFact) {
  const stars = formatPublicZiweiStars(palace);
  const tags = palace.summary_tags.length > 0 ? `；标记：${palace.summary_tags.join('、')}` : '';
  const details = [
    stars ? `星曜：${stars}` : '',
    palace.changsheng12 ? `长生：${palace.changsheng12}` : '',
    palace.boshi12 ? `博士：${palace.boshi12}` : '',
  ].filter(Boolean);
  return `- ${palace.name}（${palace.heavenly_stem}${palace.earthly_branch}）：${details.join('；')}${tags}`;
}

function buildPublicZiweiTwelvePalaceSection(palaces: PalaceFact[]) {
  return palaces.length > 0
    ? `【十二宫事实】\n${palaces.map(formatPublicZiweiPalaceBrief).join('\n')}`
    : '';
}

export async function buildPublicZiweiPromptForRuntime(params: {
  result: ZiweiRuntime;
  question?: string;
  topic?: ZiweiPromptTopic;
  scope?: ZiweiPromptScope;
  mode?: PromptMode;
  school?: ZiweiSchool;
}) {
  const result = await rebuildAuditedZiweiRuntime(params.result);
  const scope = params.scope ?? 'origin';
  const mode = params.mode ?? 'framework';
  const topic = params.topic ?? (mode === 'custom' ? 'chat' : 'life');
  const payload =
    scope === 'full'
      ? result.payloadByScope.origin
      : (result.payloadByScope[scope as ScopeType] ?? result.payloadByScope.origin);
  const scopeLabel = mapZiweiPromptScopeLabel(scope);
  const topicLabel = mapTopicLabel(topic);
  const activePalace = payload.palaces.find(
    (palace) => palace.index === payload.active_scope.palace_index,
  );
  const lifePalace = payload.palaces.find((palace) => palace.name === '命宫');
  const bodyPalace = payload.palaces.find((palace) => palace.is_body_palace);
  const lifeStarsText = formatPublicZiweiStars(lifePalace);
  const bodyStarsText = formatPublicZiweiStars(bodyPalace);
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
  const trueSolarEvidenceText = formatZiweiTrueSolarEvidence(result.trueSolarEvidence);
  const chartLines = [
    `出生日期：${payload.basic_info.solar_date}；农历：${payload.basic_info.lunar_date}；时辰：${payload.basic_info.birth_time_label}`,
    lifePalace ? `命宫：${lifePalace.name}${lifeStarsText ? `；星曜：${lifeStarsText}` : ''}` : '',
    bodyPalace ? `身宫：${bodyPalace.name}${bodyStarsText ? `；星曜：${bodyStarsText}` : ''}` : '',
    activePalace ? `当前落宫：${activePalace.name}` : '',
    mutagenText ? `当前四化：${mutagenText}` : '',
    `排盘口径：${formatPublicZiweiCalculationConfig(payload)}`,
  ].filter(Boolean);
  const prompt = [
    buildPromptGuidanceSections('ziwei'),
    `【分析背景】\n分析主题：${topicLabel}\n分析范围：${scopeLabel}\n分析对象：${scope === 'full' ? '本命盘与完整大限流年流月流日流时' : payload.active_scope.label || scopeLabel}\n参考日期：${payload.active_scope.solar_date}\n虚岁：${payload.active_scope.nominal_age}`,
    `【排盘信息】\n${chartLines.join('\n')}`,
    buildPublicZiweiTwelvePalaceSection(payload.palaces),
    trueSolarEvidenceText ? `【出生时间校正】\n${trueSolarEvidenceText}` : '',
    scope === 'full' ? `【完整运限资料】\n${formatPublicZiweiFullScopeText(result)}` : '',
    `【问题】\n${params.question ?? ''}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const schoolGuidance = getZiweiSchoolGuidance(params.school);
  const promptWithSchool = schoolGuidance
    ? insertPromptSectionBeforeHeading(prompt, '【问题】', `【流派】\n${schoolGuidance}`)
    : prompt;

  if (mode === 'custom') {
    return promptWithSchool;
  }

  return [
    promptWithSchool,
    '',
    `【任务】\n${buildPublicZiweiTaskText()}`,
    '',
    '【输出要求】\n按“依据状态、十二宫可复算事实、已校验格局与运限事实、资料缺口、条件性后续推算”的顺序回答。',
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
  const lifeStarsText = formatPublicZiweiStars(lifePalace);
  const bodyStarsText = formatPublicZiweiStars(bodyPalace);
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
  const trueSolarEvidenceText = formatZiweiTrueSolarEvidence(params.result.trueSolarEvidence);

  return [
    `分析主题：${topicLabel}`,
    `分析范围：${scopeLabel}`,
    `分析对象：${scope === 'full' ? '本命盘与完整大限流年流月流日流时' : payload.active_scope.label || scopeLabel}`,
    `参考日期：${payload.active_scope.solar_date}`,
    `虚岁：${payload.active_scope.nominal_age}`,
    `出生日期：${payload.basic_info.solar_date}；农历：${payload.basic_info.lunar_date}；时辰：${payload.basic_info.birth_time_label}`,
    lifePalace ? `命宫：${lifePalace.name}${lifeStarsText ? `；星曜：${lifeStarsText}` : ''}` : '',
    bodyPalace ? `身宫：${bodyPalace.name}${bodyStarsText ? `；星曜：${bodyStarsText}` : ''}` : '',
    activePalace ? `当前落宫：${activePalace.name}` : '',
    mutagenText ? `当前四化：${mutagenText}` : '',
    `排盘口径：${formatPublicZiweiCalculationConfig(payload)}`,
    trueSolarEvidenceText ? `出生时间校正：\n${trueSolarEvidenceText}` : '',
    buildPublicZiweiTwelvePalaceSection(payload.palaces),
    scope === 'full' ? formatPublicZiweiFullScopeText(params.result) : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function buildBaziZiweiPromptForResults(params: {
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
  const ziweiResult = await rebuildAuditedZiweiRuntime(params.ziweiResult);
  const mode = params.mode ?? 'framework';
  const baziTopic = params.baziTopic ?? 'general';
  const ziweiTopic = params.ziweiTopic ?? 'life';
  const ziweiScope = params.ziweiScope ?? 'origin';
  const baziText = formatBaziForPrompt(params.baziResult, null, 'general');
  const ziweiText = formatPublicZiweiEvidenceText({
    result: ziweiResult,
    topic: ziweiTopic,
    scope: ziweiScope,
  });
  const guidance = [
    getBaziSchoolGuidance(params.baziSchool),
    getZiweiSchoolGuidance(params.ziweiSchool),
  ].filter(Boolean);

  const baseSections = [
    buildPromptGuidanceSections('bazi-ziwei'),
    guidance.length ? `【流派】\n${guidance.join('\n')}` : '',
    `【当前时间】\n${formatPromptCurrentTime(new Date(ziweiResult.generation.timestamp))}`,
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
    '【任务】\n分别核对八字可复算事实与紫微完整十二宫、星曜、四化、三方四正、已校验格局及运限事实；两套体系各自待定项保持待定，不建立跨体系因果映射或统一现实结论。',
    '【输出要求】\n按“依据状态、八字可复算事实、紫微可复算事实、两套体系各自待定项、资料缺口、条件性后续推算”的顺序回答。',
  ].join('\n\n');
}
