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

/**
 * 八字提示词流派入口。
 *
 * traditional 是历史兼容名，语义与 ziping（子平派）相同；保留它可以避免
 * 已有 API 调用失效，同时让新调用方能明确表达所采用的子平口径。
 */
export const BAZI_SCHOOLS = ['traditional', 'ziping', 'mangpai', 'xinpai'] as const;
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

type BaziSchoolProfile = {
  label: string;
  task: string;
  basis: string;
  formatFacts: (result: BaziChartResult) => string;
};

type BaziPillarKey = 'year' | 'month' | 'day' | 'hour';

const BAZI_PILLAR_KEYS: BaziPillarKey[] = ['year', 'month', 'day', 'hour'];
const BAZI_PILLAR_LABELS: Record<BaziPillarKey, string> = {
  year: '年柱',
  month: '月柱',
  day: '日柱',
  hour: '时柱',
};

function joinBaziFacts(values: Array<string | undefined | null>, fallback = '未记录') {
  const text = values.filter((value): value is string => Boolean(value && value.trim())).join('；');
  return text || fallback;
}

function formatBaziPillarsForSchool(result: BaziChartResult, includeLifeStage = false) {
  return BAZI_PILLAR_KEYS.map((key) => {
    const pillar = result.pillars[key];
    const hiddenStems = result.hiddenStems[key]?.join('、') || '无';
    const hiddenTenGods = result.hiddenTenGods[key]?.join('、') || '无';
    const lifeStage = includeLifeStage
      ? result.lifeStages[key]
        ? `；日主十二长生${result.lifeStages[key]}`
        : ''
      : '';
    return `${BAZI_PILLAR_LABELS[key]}${pillar.ganZhi}，天干十神${result.tenGods[key] || '未记录'}，藏干${hiddenStems}，藏干十神${hiddenTenGods}${lifeStage}`;
  }).join('\n');
}

function formatBaziFortuneForSchool(result: BaziChartResult) {
  const cycles = result.luckInfo?.cycles ?? [];
  const cycleText = cycles
    .filter((cycle) => !cycle.isXiaoyun)
    .slice(0, 8)
    .map((cycle) => `${cycle.ganZhi}（${cycle.year}年起，约${cycle.age}岁）`)
    .join('、');
  const currentYear = new Date().getFullYear();
  const currentYears = cycles
    .flatMap((cycle) => cycle.years ?? [])
    .filter((item) => item.year >= currentYear - 1 && item.year <= currentYear + 2)
    .map((item) => `${item.year}${item.ganZhi}`)
    .join('、');
  return joinBaziFacts([
    result.luckInfo?.startInfo ? `起运${result.luckInfo.startInfo}` : undefined,
    cycleText ? `大运${cycleText}` : undefined,
    currentYears ? `近年流年${currentYears}` : undefined,
  ]);
}

function formatBaziRelationsForSchool(result: BaziChartResult) {
  const relations = result.pillarRelations;
  return joinBaziFacts([
    relations.fuxin.length ? `同柱与伏吟${relations.fuxin.join('、')}` : undefined,
    relations.fanyin.length ? `反吟与天克地冲${relations.fanyin.join('、')}` : undefined,
    relations.xingChong.length
      ? `合冲刑害破与三合三会${relations.xingChong.join('、')}`
      : undefined,
  ]);
}

function formatBaziUsefulGodForSchool(result: BaziChartResult) {
  const useful = result.analysis.usefulGod;
  return joinBaziFacts([
    useful.primaryFavorableWuxing ? `主用${useful.primaryFavorableWuxing}` : undefined,
    useful.secondaryFavorableWuxing?.length
      ? `辅用${useful.secondaryFavorableWuxing.join('、')}`
      : undefined,
    useful.primaryUnfavorableWuxing ? `主忌${useful.primaryUnfavorableWuxing}` : undefined,
    useful.secondaryUnfavorableWuxing?.length
      ? `次忌${useful.secondaryUnfavorableWuxing.join('、')}`
      : undefined,
    useful.primaryReason ? `取用理由${useful.primaryReason}` : undefined,
  ]);
}

function formatZipingFacts(result: BaziChartResult) {
  const strength = result.analysis.dayMasterStrength;
  const details = strength.details;
  return [
    `月令与节候：月柱${result.pillars.month.ganZhi}，月令司权${result.monthCommander || '未记录'}，${result.seasonInfo.currentSeason || '当前'}令，节气${result.seasonInfo.currentJieqi || '未记录'}`,
    `日主旺衰：${result.dayMaster.gan}${result.dayMaster.element}${result.dayMaster.yinYang}，${strength.status}；得令${details.timely ? '是' : '否'}，通根${details.hasRoot ? '有' : '无'}，强根${details.hasStrongRoot ? '有' : '无'}，帮扶${details.hasSupport ? '可见' : '不显'}，克泄耗${details.hasConstraint ? '可见' : '不显'}`,
    `格局与成败：${result.analysis.mingGe.pattern}${result.analysis.mingGe.basis ? `；${result.analysis.mingGe.basis}` : ''}`,
    `调候与取用：${formatBaziUsefulGodForSchool(result)}；五行季节状态${
      Object.entries(result.wuxingSeasonStatus)
        .map(([element, status]) => `${element}${status}`)
        .join('、') || '未记录'
    }`,
    `岁运：${formatBaziFortuneForSchool(result)}`,
  ].join('\n');
}

function formatMangpaiFacts(result: BaziChartResult) {
  const dayPillar = result.pillars.day;
  return [
    '四柱宫位与十神：',
    formatBaziPillarsForSchool(result, true),
    `日主与夫妻宫资料：日主${result.dayMaster.gan}；日柱${dayPillar.ganZhi}；日支${dayPillar.zhi}`,
    `四柱组合资料：${formatBaziRelationsForSchool(result)}`,
    `象法取用资料：${formatBaziUsefulGodForSchool(result)}；纳音${BAZI_PILLAR_KEYS.map((key) => `${BAZI_PILLAR_LABELS[key]}${result.nayin[key] || '未记录'}`).join('、')}`,
    `年限应期资料：${formatBaziFortuneForSchool(result)}`,
  ].join('\n');
}

function formatXinpaiFacts(result: BaziChartResult) {
  const strength = result.analysis.dayMasterStrength;
  return [
    `旺衰起点：日主${result.dayMaster.gan}${result.dayMaster.element}${result.dayMaster.yinYang}，${strength.status}；月令${strength.details.seasonalEffect}，司令${strength.details.commanderEffect}，成局${strength.details.formationEffect}`,
    `五行流通：已见${result.wuxingStrength.present.join('、') || '未记录'}；偏重${result.wuxingStrength.dominantByRule.join('、') || '未记录'}；缺项${result.wuxingStrength.missing.join('、') || '无'}；月令状态${
      Object.entries(result.wuxingSeasonStatus)
        .map(([element, status]) => `${element}${status}`)
        .join('、') || '未记录'
    }`,
    `调候与用神：${formatBaziUsefulGodForSchool(result)}；格局${result.analysis.mingGe.pattern}`,
    `原局作用：${formatBaziRelationsForSchool(result)}`,
    `动态岁运：${formatBaziFortuneForSchool(result)}`,
  ].join('\n');
}

const BAZI_SCHOOL_PROFILES: Record<'ziping' | 'mangpai' | 'xinpai', BaziSchoolProfile> = {
  ziping: {
    label: '子平派（传统）',
    task: '先以月令定格，结合日主得令、通根、透干与全局制化判断旺衰，再以调候、格局成败和岁运引动回答问题。',
    basis:
      '《渊海子平》《子平真诠》《三命通会》《滴天髓》《穷通宝鉴》的子平法月令、格局、旺衰、调候与行运资料。',
    formatFacts: formatZipingFacts,
  },
  mangpai: {
    label: '盲派',
    task: '以年、月、日、时四柱宫位为骨架，按十神落柱、藏干、宾主体用与组合取象，结合大运流年分段观察应期。',
    basis:
      '十神、藏干和四柱宫位的基础参照《渊海子平》《三命通会》《滴天髓》；宾主体用、组合取象与年限分段属于近现代盲派传承的整理口径，按盘面结构取证。',
    formatFacts: formatMangpaiFacts,
  },
  xinpai: {
    label: '新派',
    task: '以日主旺衰为起点，观察五行流通、调候和生克制化，把大运、流年与原局作用叠加，定位动态触发。',
    basis:
      '以《子平真诠》《滴天髓》《穷通宝鉴》《三命通会》的月令、旺衰与调候资料为基础；五行流通与岁运动态属于近现代新派整理口径。',
    formatFacts: formatXinpaiFacts,
  },
};

function normalizeBaziSchool(school: BaziSchool): keyof typeof BAZI_SCHOOL_PROFILES {
  return school === 'traditional' ? 'ziping' : school;
}

const BAZI_SCHOOL_GUIDANCE: Record<BaziSchool, string> = {
  traditional: `${BAZI_SCHOOL_PROFILES.ziping.label}：${BAZI_SCHOOL_PROFILES.ziping.task}\n依据：${BAZI_SCHOOL_PROFILES.ziping.basis}`,
  ziping: `${BAZI_SCHOOL_PROFILES.ziping.label}：${BAZI_SCHOOL_PROFILES.ziping.task}\n依据：${BAZI_SCHOOL_PROFILES.ziping.basis}`,
  mangpai: `${BAZI_SCHOOL_PROFILES.mangpai.label}：${BAZI_SCHOOL_PROFILES.mangpai.task}\n依据：${BAZI_SCHOOL_PROFILES.mangpai.basis}`,
  xinpai: `${BAZI_SCHOOL_PROFILES.xinpai.label}：${BAZI_SCHOOL_PROFILES.xinpai.task}\n依据：${BAZI_SCHOOL_PROFILES.xinpai.basis}`,
};

const ZIWEI_SCHOOL_PROFILES: Record<ZiweiSchool, { label: string; task: string; basis: string }> = {
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

const ZIWEI_SCHOOL_GUIDANCE: Record<ZiweiSchool, string> = Object.fromEntries(
  Object.entries(ZIWEI_SCHOOL_PROFILES).map(([school, profile]) => [
    school,
    `紫微流派：${profile.label}。${profile.task}\n依据：${profile.basis}`,
  ]),
) as Record<ZiweiSchool, string>;

export function getBaziSchoolGuidance(school?: BaziSchool) {
  if (!school || !BAZI_SCHOOL_GUIDANCE[school]) {
    return '';
  }
  return BAZI_SCHOOL_GUIDANCE[school];
}

export function buildBaziSchoolPromptSection(result: BaziChartResult, school?: BaziSchool) {
  if (!school) return '';
  const profile = BAZI_SCHOOL_PROFILES[normalizeBaziSchool(school)];
  return [
    '【流派】',
    `八字流派：${profile.label}`,
    `流派任务：${profile.task}`,
    `流派依据：${profile.basis}`,
    '流派盘面资料：',
    profile.formatFacts(result),
  ].join('\n');
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
  const schoolSection = buildBaziSchoolPromptSection(params.result, params.school);
  if (schoolSection) {
    return insertPromptSectionBeforeHeading(baseText, '【问题】', schoolSection);
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
  const algorithmText =
    payload.calculation_config.algorithm === 'zhongzhou'
      ? '安星口径：中州派安星法'
      : '安星口径：传统通行安星法';
  const chartLines = [
    `出生日期：${payload.basic_info.solar_date}；农历：${payload.basic_info.lunar_date}；时辰：${payload.basic_info.birth_time_label}`,
    algorithmText,
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
    payload.calculation_config.algorithm === 'zhongzhou'
      ? '安星口径：中州派安星法'
      : '安星口径：传统通行安星法',
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
    buildBaziSchoolPromptSection(params.baziResult, params.baziSchool),
    params.ziweiSchool ? `【紫微流派】\n${getZiweiSchoolGuidance(params.ziweiSchool)}` : '',
  ].filter(Boolean);

  const baseSections = [
    buildPromptGuidanceSections('bazi-ziwei'),
    guidance.join('\n\n'),
    `【当前时间】\n${formatPromptCurrentTime()}`,
    `【八字排盘信息】\n${baziText}`,
    `【紫微盘面信息】\n${ziweiText}`,
    ...(params.question.trim() ? [`【问题】\n${params.question.trim()}`] : []),
    params.mode === 'custom' ? '' : '【任务】\n请依据八字和紫微盘面完成解读。',
  ].filter(Boolean);

  return baseSections.join('\n\n');
}
