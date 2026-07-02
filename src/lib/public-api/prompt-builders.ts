import type { PalaceFact, ScopeType, StarFact } from '../../types/analysis';
import type { BaziChartResult } from '../../utils/bazi/baziTypes';
import type { FortuneSelectionContext } from '../../utils/bazi/fortuneSelection';
import {
  BAZI_AI_PROMPTS,
  buildPromptFromConfig,
  type AIPromptOption,
} from '../../utils/ai/aiPrompts';
import { buildCombinedZiweiPrompt, type ZiweiRuntime } from '../full-chart-engine/ziwei';
import { mapScopeLabel, mapTopicLabel } from '../ziwei-prompts/labels';

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
  'decadal',
  'yearly',
  'monthly',
  'daily',
  'hourly',
  'age',
] as const;

export const PROMPT_MODES = ['framework', 'custom'] as const;

export const BAZI_SCHOOLS = ['traditional', 'mangpai', 'xinpai'] as const;
export const ZIWEI_SCHOOLS = ['sanhe', 'feixing', 'sihua'] as const;

export type BaziPromptTopic = (typeof BAZI_PROMPT_TOPICS)[number];
export type ZiweiPromptTopic = (typeof ZIWEI_PROMPT_TOPICS)[number];
export type ZiweiPromptScope = (typeof ZIWEI_PROMPT_SCOPES)[number];
export type PromptMode = (typeof PROMPT_MODES)[number];
export type BaziSchool = (typeof BAZI_SCHOOLS)[number];
export type ZiweiSchool = (typeof ZIWEI_SCHOOLS)[number];

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
}) {
  const option = resolveBaziPromptOption(params.topic ?? 'general');
  const prompt = buildPromptFromConfig(
    params.question ?? '',
    option,
    params.result,
    params.fortuneSelectionContext ?? null,
    params.topic ?? 'general',
    { isCustomQuestion: params.mode === 'custom' },
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
    ...compatibility,
  };
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
    params.result.payloadByScope[scope as ScopeType] ?? params.result.payloadByScope.origin;
  const fallbackTopic = params.mode === 'custom' ? 'chat' : 'life';
  const baseText = buildCombinedZiweiPrompt(
    payload,
    params.topic ?? fallbackTopic,
    params.question ?? '',
    {
      isCustomQuestion: params.mode === 'custom',
    },
  );
  const schoolGuidance = getZiweiSchoolGuidance(params.school);
  if (schoolGuidance) {
    return `${schoolGuidance}\n\n${baseText}`;
  }
  return baseText;
}

function buildPublicZiweiTaskText(topic: ZiweiPromptTopic) {
  const topicTextMap: Partial<Record<ZiweiPromptTopic, string>> = {
    relationship:
      '围绕感情关系，优先看夫妻宫、命宫、福德宫、迁移宫、三方四正与四化牵动，判断关系模式、风险点和经营建议。',
    'career-wealth':
      '围绕事业财运，优先看官禄宫、财帛宫、命宫、迁移宫、福德宫与四化牵动，判断发展方向、资源优势和风险边界。',
    'job-change':
      '围绕工作变动，优先看官禄宫、迁移宫、财帛宫、命宫与当前分析对象，判断留任、跳槽或转方向的条件。',
    recent:
      '围绕近期趋势，优先看当前分析对象、本命底色、重点宫位和四化触发，判断阶段主线、机会与风险。',
    life: '围绕人生解析，优先看命身定位、长期课题、能力资源、关系模式、关键转折和当前阶段策略。',
    destiny: '围绕命局综述，优先看命身格局、核心宫位、生年四化、三方四正与长期人生主线。',
    chat: '先判断问题落在哪些宫位，再选取对应宫位、三方四正、四化和分析对象作为主要证据。',
  };

  return topicTextMap[topic] ?? topicTextMap.chat!;
}

const ZIWEI_TOPIC_PALACE_NAMES: Partial<Record<ZiweiPromptTopic, string[]>> = {
  relationship: ['夫妻宫', '命宫', '福德宫', '迁移宫'],
  'relationship-push': ['夫妻宫', '命宫', '福德宫', '迁移宫'],
  'relationship-decision': ['夫妻宫', '命宫', '福德宫', '迁移宫'],
  'reconciliation-decision': ['夫妻宫', '命宫', '福德宫', '迁移宫', '子女宫'],
  children: ['子女宫', '夫妻宫', '命宫', '福德宫', '田宅宫'],
  'career-wealth': ['官禄宫', '财帛宫', '命宫', '迁移宫', '福德宫'],
  'job-change': ['官禄宫', '迁移宫', '财帛宫', '命宫', '田宅宫', '福德宫'],
  'startup-partnership': ['官禄宫', '财帛宫', '迁移宫', '命宫', '福德宫', '兄弟宫'],
  'investment-partnership': ['财帛宫', '官禄宫', '福德宫', '兄弟宫', '迁移宫', '命宫'],
  recent: ['命宫', '身宫', '官禄宫', '财帛宫', '迁移宫', '福德宫'],
  family: ['父母宫', '兄弟宫', '田宅宫', '命宫', '福德宫'],
  'home-move': ['田宅宫', '迁移宫', '财帛宫', '福德宫', '命宫', '父母宫'],
  'settle-relocate': ['田宅宫', '迁移宫', '官禄宫', '财帛宫', '福德宫', '命宫', '父母宫'],
  social: ['兄弟宫', '迁移宫', '福德宫', '命宫', '官禄宫', '财帛宫'],
  emotion: ['福德宫', '命宫', '疾厄宫', '夫妻宫', '迁移宫'],
  health: ['疾厄宫', '福德宫', '命宫', '身宫', '迁移宫'],
  study: ['命宫', '福德宫', '官禄宫', '父母宫', '迁移宫'],
  'study-advance': ['命宫', '福德宫', '官禄宫', '父母宫', '迁移宫'],
  'exam-landing': ['命宫', '福德宫', '官禄宫', '父母宫', '迁移宫'],
  growth: ['命宫', '福德宫', '迁移宫', '官禄宫'],
  talent: ['命宫', '福德宫', '官禄宫', '财帛宫'],
  life: ['命宫', '身宫', '福德宫', '官禄宫', '财帛宫', '迁移宫'],
  destiny: ['命宫', '身宫', '福德宫', '官禄宫', '财帛宫', '迁移宫'],
};

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
  topic: ZiweiPromptTopic;
  palaces: PalaceFact[];
  activePalace?: PalaceFact;
  bodyPalace?: PalaceFact;
}) {
  const palaceNames = [
    ...(ZIWEI_TOPIC_PALACE_NAMES[params.topic] ?? ['命宫', '身宫', '福德宫', '迁移宫']),
    params.activePalace?.name,
    params.bodyPalace?.name,
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
    params.result.payloadByScope[scope as ScopeType] ?? params.result.payloadByScope.origin;
  const scopeLabel = mapScopeLabel(payload.active_scope.scope);
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
  const prompt = [
    `【分析背景】\n分析主题：${topicLabel}\n分析范围：${scopeLabel}\n分析对象：${payload.active_scope.label || scopeLabel}\n参考日期：${payload.active_scope.solar_date}\n虚岁：${payload.active_scope.nominal_age}`,
    `【排盘信息】\n出生日期：${payload.basic_info.solar_date}；农历：${payload.basic_info.lunar_date}；时辰：${payload.basic_info.birth_time_label}\n命宫：${lifePalace?.name ?? '命宫'}；星曜：${formatStars(lifePalace)}\n身宫：${bodyPalace?.name ?? '未标出'}；星曜：${formatStars(bodyPalace)}\n当前落宫：${activePalace?.name ?? '本命范围'}\n当前四化：${mutagenText}`,
    buildPublicZiweiKeyPalaceSection({
      topic,
      palaces: payload.palaces,
      activePalace,
      bodyPalace,
    }),
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
    `【任务】\n${buildPublicZiweiTaskText(topic)}请结合【问题】直接给出判断、关键依据和可执行建议。`,
    '',
    '【输出要求】\n先直接回答【问题】，再展开最关键的 2 到 4 个重点；每个重点都要写明主证、辅证、反证或限制；证据不足时要明确说明，不要编造盘面没有提供的信息。',
  ].join('\n');
}
