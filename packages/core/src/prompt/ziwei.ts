import type { AnalysisPayloadV1, PalaceFact, ScopeType, StarFact } from '../types/analysis';
import type { ZiweiNatalSnapshot, ZiweiRuntimeFacts } from '../ziwei/runtime';
import {
  formatZiweiFortuneTimeline,
  formatZiweiFortuneTimelinePhase,
  type ZiweiFortuneTimeline,
  type ZiweiFortuneTimelinePhaseSelection,
} from '../ziwei/fortune-timeline';
import { analyzeZiweiCompatibility } from '../ziwei/iztro/index';
import { formatBaziForPrompt, type BaziChartResult } from '../bazi/index';
import { formatBaziPatternConditions } from './bazi';
import { formatPromptCurrentTime } from './current-time';
import { buildPromptGuidance, buildPromptTask } from './guidance';
import { formatPromptSchoolGuidance } from './schools';
import { formatBaziSchoolsPrompt, normalizeBaziPromptSchools } from './bazi-school';
import { getThematicTopicConfig } from './thematic';
import { getPromptMutagenItems } from '../ziwei/prompt/mutagen';
import { formatPalaceRelations } from '../ziwei/prompt/builders';
import { formatObjectList } from '../ziwei/prompt/formatters';
import { getSelectedScopeHits } from '../ziwei/prompt/scope-selection';
import { buildZiweiMatchedPatternSummary } from '../ziwei/prompt/snapshot';
import { formatZiweiTrueSolarEvidence } from '../ziwei/prompt/combined';
import {
  buildPromptDocument,
  buildPromptSection,
  formatStringList,
  joinPromptSections,
} from './sections';
import type { PromptBuildOptions, PromptDocument } from './types';
import { appendClassicalReferences, formatClassicalReferences } from './classical-references';
import {
  buildPromptSelectionTask,
  getPromptSelectionSection,
  type PromptSelection,
} from './framework';

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

const TOPIC_FACT_FOCUS: Partial<Record<ZiweiPromptTopic, string>> = {
  relationship: '夫妻宫及其对宫、三方四正，命身宫，相关星曜与四化落点',
  'relationship-push': '夫妻宫、福德宫、迁移宫，命身宫及四化关系',
  'relationship-decision': '夫妻宫、福德宫、官禄宫及四化关系',
  'reconciliation-decision': '夫妻宫、福德宫、迁移宫，双方关系宫位与四化承接',
  children: '子女宫及其三方四正、命身宫与相关四化',
  'career-wealth': '官禄宫、财帛宫、迁移宫及命身宫',
  'job-change': '官禄宫、迁移宫、福德宫与四化关系',
  'startup-partnership': '官禄宫、财帛宫、迁移宫、兄弟宫与关系四化',
  'investment-partnership': '财帛宫、田宅宫、福德宫、官禄宫与四化落点',
  recent: '本次分析资料所列层级的落宫、四化及其与本命命身轴的关系',
  family: '父母宫、兄弟宫、子女宫、田宅宫及相关四化',
  'home-move': '田宅宫、迁移宫及福德宫',
  'settle-relocate': '迁移宫、田宅宫及官禄宫',
  social: '迁移宫、兄弟宫、夫妻宫及相关星曜和四化',
  emotion: '福德宫、命宫、疾厄宫及相关四化',
  health: '疾厄宫、父母宫、福德宫与命身宫',
  study: '官禄宫、父母宫、福德宫及相关星曜四化',
  'study-advance': '官禄宫、父母宫、福德宫与四化关系',
  'exam-landing': '官禄宫、父母宫、迁移宫与四化关系',
  growth: '命宫、身宫与福德宫',
  talent: '命宫、身宫、官禄宫及本命主辅星',
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

function formatStar(star: StarFact, isOriginScope: boolean) {
  return [
    star.name,
    star.brightness ? `亮度：${star.brightness}` : '',
    star.birth_mutagen ? `生年化${star.birth_mutagen}` : '',
    !isOriginScope && star.horoscope_mutagen ? `运限化${star.horoscope_mutagen}` : '',
    !isOriginScope && star.active_scope_mutagen ? `当前化${star.active_scope_mutagen}` : '',
  ]
    .filter(Boolean)
    .join('，');
}

function formatDynamicMutagenStar(star: StarFact) {
  return formatStar({ ...star, brightness: undefined, birth_mutagen: undefined }, false);
}

function getDynamicMutagenStarKey(star: StarFact) {
  return `${star.name}|${star.horoscope_mutagen ?? ''}|${star.active_scope_mutagen ?? ''}`;
}

function natalTags(tags: string[]) {
  return tags.filter((tag) => !/大限|小限|流年|流月|流日|流时|运限/.test(tag));
}

function formatPalace(
  palace: PalaceFact,
  isOriginScope: boolean,
  selectedScopeHits = palace.scope_hits,
) {
  const majorStars = palace.major_stars.map((star) => formatStar(star, isOriginScope));
  const minorStars = palace.minor_stars.map((star) => formatStar(star, isOriginScope));
  const otherStars = palace.other_stars.map((star) => formatStar(star, isOriginScope));
  const scopeStars = (!isOriginScope ? palace.scope_stars : []).map((star) => {
    const scopeLabel = star.scope ? SCOPE_LABELS[star.scope as ScopeType] : undefined;
    return `${formatStar(star, isOriginScope)}${scopeLabel ? `（${scopeLabel}）` : ''}`;
  });

  let majorText: string;
  if (majorStars.length > 0) {
    majorText = `主星：${formatStringList(majorStars)}`;
  } else if (palace.empty_state) {
    majorText = '主星：无十四主星（空宫）';
  } else {
    majorText = '主星：无';
  }

  const allSecondary = [...minorStars, ...otherStars];
  const secondaryText = allSecondary.length > 0 ? `辅曜：${formatStringList(allSecondary)}` : '';
  const scopeText = scopeStars.length ? `运限曜：${formatStringList(scopeStars)}` : '';

  const selfMutagens = (palace.self_mutagens ?? []).map((m) => `自化${m}`).join('、');
  const selfText = selfMutagens ? `自化：${selfMutagens}` : '';

  const flyMutagens = (palace.mutaged_palaces ?? [])
    .filter((item) => item.palace_name)
    .map((item) => `化${item.mutagen}入${item.palace_name}`)
    .join('、');
  const flyText = flyMutagens ? `宫干飞化：${flyMutagens}` : '';

  const ranges =
    !isOriginScope && palace.decadal_range?.length === 2
      ? `大限${palace.decadal_range[0]}-${palace.decadal_range[1]}岁`
      : '';
  const displayedTags = new Set([
    ...(palace.name === '命' || palace.name === '命宫' ? ['命宫'] : []),
    ...(palace.is_body_palace ? ['身宫'] : []),
    ...(palace.is_original_palace ? ['来因宫'] : []),
    ...(!majorStars.length && palace.empty_state ? ['空宫'] : []),
    ...(palace.self_mutagens ?? []).map((mutagen) => `自化${mutagen}`),
    ...(!isOriginScope ? selectedScopeHits : []),
  ]);
  const displayedStars = [
    ...palace.major_stars,
    ...palace.minor_stars,
    ...palace.other_stars,
    ...(!isOriginScope ? palace.scope_stars : []),
  ];
  if (displayedStars.some((star) => star.birth_mutagen)) displayedTags.add('有生年四化');
  if (!isOriginScope && displayedStars.some((star) => star.active_scope_mutagen)) {
    displayedTags.add('有当前运限四化');
  }
  const tags = (
    isOriginScope
      ? natalTags(palace.summary_tags)
      : palace.summary_tags.filter(
          (tag) => !tag.endsWith('落宫') || selectedScopeHits.includes(tag),
        )
  ).filter((tag) => !displayedTags.has(tag));
  return [
    `${palace.name}${palace.name.endsWith('宫') ? '' : '宫'}${palace.is_body_palace ? '（身宫）' : ''}${palace.is_original_palace ? '（来因宫）' : ''}`,
    `宫干支${palace.heavenly_stem}${palace.earthly_branch}`,
    ranges,
    majorText,
    secondaryText,
    scopeText,
    palace.changsheng12 ? `长生：${palace.changsheng12}` : '',
    palace.boshi12 ? `博士：${palace.boshi12}` : '',
    selfText,
    flyText,
    !isOriginScope && selectedScopeHits.length ? `运限命中：${selectedScopeHits.join('、')}` : '',
    !isOriginScope && palace.dynamic_scope_name ? `动态宫名：${palace.dynamic_scope_name}` : '',
    tags.length ? `标签：${tags.join('、')}` : '',
  ]
    .filter(Boolean)
    .join('；');
}

export function formatZiweiNatalSnapshotForPrompt(snapshot: ZiweiNatalSnapshot) {
  const basic = snapshot.basicInfo;
  const relationPayload = { palaces: snapshot.palaces } as AnalysisPayloadV1;
  return [
    `基本资料：${basic.gender}；公历${basic.solar_date}；农历${basic.lunar_date}；${basic.birth_time_label}；生肖${basic.zodiac}`,
    `命身资料：命宫${basic.soul_palace_branch}；身宫${basic.body_palace_branch}；命主${basic.soul}；身主${basic.body}`,
    basic.four_pillars
      ? `四柱：年${basic.four_pillars.year_pillar}、月${basic.four_pillars.month_pillar}、日${basic.four_pillars.day_pillar}、时${basic.four_pillars.hour_pillar}`
      : '',
    '十二宫本命资料：',
    ...snapshot.palaces.map(
      (palace) =>
        `  ${formatPalace(palace, true)}\n  宫位关系：${formatPalaceRelations(relationPayload, palace)}`,
    ),
  ]
    .filter(Boolean)
    .join('\n');
}

export function getUnshownZiweiMutagenItems(
  payload: AnalysisPayloadV1,
  isOriginScope = false,
  displayedPalaces: readonly PalaceFact[] = [],
) {
  return getPromptMutagenItems(payload, isOriginScope).filter(
    (item) =>
      !displayedPalaces.some((palace) => {
        const samePalace =
          (item.palace_index !== undefined || Boolean(item.palace_name)) &&
          (item.palace_index === undefined || item.palace_index === palace.index) &&
          (!item.palace_name ||
            item.palace_name.replace(/宫$/u, '') === palace.name.replace(/宫$/u, ''));
        if (!samePalace) return false;
        if (
          !isOriginScope &&
          item.dynamic_palace_name &&
          item.dynamic_palace_name !== palace.dynamic_scope_name
        ) {
          return false;
        }
        return [
          ...palace.major_stars,
          ...palace.minor_stars,
          ...palace.other_stars,
          ...(!isOriginScope ? palace.scope_stars : []),
        ].some(
          (star) =>
            star.name === item.star &&
            (isOriginScope ? star.birth_mutagen : star.active_scope_mutagen) === item.mutagen,
        );
      }),
  );
}

function formatMutagenMap(
  payload: AnalysisPayloadV1,
  isOriginScope = false,
  displayedPalaces: readonly PalaceFact[] = [],
) {
  const values = getUnshownZiweiMutagenItems(payload, isOriginScope, displayedPalaces).map(
    (item) => {
      const palace = item.palace_name
        ? `入${item.palace_name}${item.palace_name.endsWith('宫') ? '' : '宫'}`
        : '';
      const dynamic =
        !isOriginScope && item.dynamic_palace_name ? `（动态${item.dynamic_palace_name}）` : '';
      return `${item.star || ''}化${item.mutagen}${palace}${dynamic}`;
    },
  );
  return values.join('；');
}

function isRestatedZiweiEvidence(title: string, detail: string) {
  const text = detail.startsWith(`${title}：`) ? detail.slice(title.length + 1) : detail;
  const majorStar = /^(.+?)主星为(.+)$/u.exec(title);
  if (majorStar && text === `${majorStar[1]}登记主星${majorStar[2]}。`) return true;

  const trine = /^(.+?)三方四正见化([禄权科忌])$/u.exec(title);
  if (trine && text === `${trine[1]}及其三方四正宫位中可见化${trine[2]}信息。`) {
    return true;
  }

  const flying = /^(.+?)化([禄权科忌])入(.+)$/u.exec(title);
  if (flying) {
    const target = flying[3];
    return (
      text === `${flying[1]}化${flying[2]}落${target}宫。` ||
      (flying[1] === target && text === `${flying[1]}化${flying[2]}回入本宫。`)
    );
  }
  return false;
}

function isShownInZiweiPalaces(
  item: AnalysisPayloadV1['evidence_pool'][number],
  palaces: PalaceFact[],
  isOriginScope: boolean,
  payload: AnalysisPayloadV1,
) {
  const active = payload.active_scope;
  if (
    item.status === '资料缺口' ||
    (item.promptText && item.promptText !== `${item.title}：${item.description}`)
  ) {
    return false;
  }
  if (item.type === 'surrounded_mutagen') {
    return palaces.some((palace) =>
      palace.summary_tags.some(
        (tag) =>
          tag.startsWith('三方四正见化') &&
          item.title === `${palace.name}${tag}` &&
          item.description === `${palace.name}及其三方四正宫位中可见化${tag.slice(-1)}信息。`,
      ),
    );
  }
  if (item.type === 'scope_mutagen_destination') {
    if (isOriginScope || item.scope !== active.scope) return false;
    const landing = palaces.find((palace) => palace.index === active.palace_index);
    if (!landing || landing.name !== active.palace_name) return false;
    const scopeLabel = active.label || SCOPE_LABELS[active.scope];
    const landingName = landing.name.endsWith('宫') ? landing.name : `${landing.name}宫`;
    return active.mutagen_map.some((mapping) => {
      const target = palaces.find((palace) => palace.index === mapping.palace_index);
      if (
        !target ||
        target.name !== mapping.palace_name ||
        !mapping.dynamic_palace_name ||
        target.dynamic_scope_name !== mapping.dynamic_palace_name ||
        item.star_names.length !== 1 ||
        item.star_names[0] !== mapping.star ||
        item.mutagens.length !== 1 ||
        item.mutagens[0] !== mapping.mutagen ||
        !item.palace_indexes.includes(landing.index) ||
        !item.palace_indexes.includes(target.index)
      ) {
        return false;
      }
      const stars = [...target.major_stars, ...target.minor_stars, ...target.other_stars];
      if (
        !stars.some(
          (star) => star.name === mapping.star && star.active_scope_mutagen === mapping.mutagen,
        )
      ) {
        return false;
      }
      const targetName = target.name.endsWith('宫') ? target.name : `${target.name}宫`;
      const dynamicName = mapping.dynamic_palace_name.endsWith('宫')
        ? mapping.dynamic_palace_name
        : `${mapping.dynamic_palace_name}宫`;
      // 只省略宫位已完整表达的标准映射，额外条件与说明继续展示。
      return (
        item.title ===
          `${scopeLabel}${mapping.star}化${mapping.mutagen}入本命${targetName}（当前${scopeLabel}${dynamicName}）` &&
        item.description ===
          `${scopeLabel}四化序列中的${mapping.star}对应化${mapping.mutagen}；该星的本命物理落宫为${targetName}，当前对应${scopeLabel}${dynamicName}，运限命宫落于本命${landingName}。`
      );
    });
  }
  const palace = palaces.find((value) => value.index === item.palace_indexes[0]);
  if (!palace) return false;
  const stars = [...palace.major_stars, ...palace.minor_stars, ...palace.other_stars];
  switch (item.type) {
    case 'palace_major_stars':
      return (
        item.title ===
          `${palace.name}主星为${palace.major_stars.map((star) => star.name).join('、')}` &&
        item.description ===
          `${palace.name}登记主星${palace.major_stars.map((star) => star.name).join('、')}。`
      );
    case 'palace_empty':
      return (
        palace.empty_state &&
        item.title === `${palace.name}为空宫` &&
        item.description ===
          `${palace.name}的主星列表为空；对宫及三方四正索引另行保留，供传统空宫合参。`
      );
    case 'palace_birth_mutagen':
      return stars.some(
        (star) =>
          item.title === `${palace.name}见生年化${star.birth_mutagen}` &&
          item.star_names.includes(star.name) &&
          item.description === `${star.name}在${palace.name}带有生年化${star.birth_mutagen}。`,
      );
    case 'palace_scope_mutagen':
      return (
        !isOriginScope &&
        stars.some(
          (star) =>
            item.title ===
              `${palace.name}见${active.label || SCOPE_LABELS[active.scope]}化${star.active_scope_mutagen}` &&
            item.star_names.includes(star.name) &&
            item.description === `${star.name}在当前运限下带有化${star.active_scope_mutagen}。`,
        )
      );
    case 'palace_self_mutaged':
      return (palace.self_mutagens ?? []).some(
        (mutagen) =>
          item.title === `${palace.name}出现自化${mutagen}` &&
          item.description === `${palace.name}的自化列表包含化${mutagen}。`,
      );
    case 'palace_mutaged_place':
      return (palace.mutaged_palaces ?? []).some(
        (target) =>
          item.title === `${palace.name}化${target.mutagen}入${target.palace_name}` &&
          item.description ===
            (target.palace_index === palace.index
              ? `${palace.name}化${target.mutagen}回入本宫。`
              : `${palace.name}化${target.mutagen}落${target.palace_name}宫。`),
      );
    case 'palace_scope_hit':
      return (
        !isOriginScope &&
        getSelectedScopeHits(payload, palace).some(
          (hit) => item.title === `${hit}位于${palace.name}`,
        ) &&
        item.description ===
          `本命${palace.name}${palace.name.endsWith('宫') ? '' : '宫'}的宫干支为${palace.heavenly_stem}${palace.earthly_branch}。`
      );
    case 'scope_dynamic_name':
      return (
        !isOriginScope &&
        Boolean(palace.dynamic_scope_name) &&
        item.title ===
          `${active.label || SCOPE_LABELS[active.scope]}视角下${palace.name}转为${palace.dynamic_scope_name}` &&
        item.description ===
          `在${active.label || SCOPE_LABELS[active.scope]}视角下，${palace.name}对应的动态宫名为${palace.dynamic_scope_name}。`
      );
    default:
      return false;
  }
}

export function formatZiweiPayloadForPrompt(
  payload: AnalysisPayloadV1,
  options: {
    focusPalaceNames?: readonly string[];
    maxEvidence?: number;
    /** 完整运限中首段已给出主体资料和宫位关系，后续层保留运限盘面。 */
    includeBasicInfo?: boolean;
  } = {},
) {
  const basic = payload.basic_info;
  const active = payload.active_scope;
  const focusNames = new Set(
    (options.focusPalaceNames ?? []).map((name) => name.replace(/宫$/, '').trim()),
  );
  const palaces = focusNames.size
    ? payload.palaces.filter((palace) => focusNames.has(palace.name.replace(/宫$/, '').trim()))
    : payload.palaces;
  const selectedPalaces = palaces.length ? palaces : payload.palaces;
  const isOriginScope = active.scope === 'origin';
  const evidenceItems = payload.evidence_pool
    .filter((item) => item.scope === 'origin' || item.scope === active.scope)
    .filter((item) => !isShownInZiweiPalaces(item, selectedPalaces, isOriginScope, payload))
    .map((item) => {
      const level = item.level ? `【${item.level}】` : '';
      const detail = item.promptText || item.description;
      const title = `${item.title}：`;
      const evidence = detail.startsWith(title) ? detail : `${title}${detail}`;
      return `${level}${isRestatedZiweiEvidence(item.title, detail) ? item.title : evidence}`;
    });
  const evidenceLimit = options.maxEvidence ?? 30;
  const evidencePrimary = evidenceItems.slice(0, evidenceLimit);
  const evidenceAppendix = evidenceItems.slice(evidenceLimit);
  const includeBasicInfo = options.includeBasicInfo ?? true;
  const matchedPatterns = includeBasicInfo
    ? formatObjectList(
        buildZiweiMatchedPatternSummary(payload, { displayedPalaces: selectedPalaces }),
      )
    : '';
  const bodyPalace = payload.palaces.find((p) => p.is_body_palace);
  const bodyPalaceName = payload.basic_info.hidden_palaces?.body_palace_name || bodyPalace?.name;
  const birthMutagens = formatMutagenMap(payload, true, selectedPalaces);
  const currentMutagens = formatMutagenMap(payload, false, selectedPalaces);

  return [
    `分析范围：${active.label || SCOPE_LABELS[active.scope]}`,
    includeBasicInfo
      ? `基本资料：${basic.gender}；公历${basic.solar_date}；农历${basic.lunar_date}；${basic.birth_time_label}；生肖${basic.zodiac}`
      : '',
    includeBasicInfo
      ? `命身资料：命宫${basic.soul_palace_branch}；身宫${basic.body_palace_branch}；命主${basic.soul}；身主${basic.body}${bodyPalaceName ? `；身宫落宫：${bodyPalaceName}${bodyPalaceName.endsWith('宫') ? '' : '宫'}` : ''}`
      : '',
    includeBasicInfo && basic.four_pillars
      ? `四柱：年${basic.four_pillars.year_pillar}、月${basic.four_pillars.month_pillar}、日${basic.four_pillars.day_pillar}、时${basic.four_pillars.hour_pillar}`
      : '',
    isOriginScope
      ? '本命盘：生年四化与十二宫本命星曜。'
      : `当前运限：${active.label || SCOPE_LABELS[active.scope]}；${active.solar_date}；${active.lunar_date}；名义年龄${active.nominal_age}；${active.palace_name ? `落${active.palace_name}${active.palace_name.endsWith('宫') ? '' : '宫'}` : '落宫未记录'}`,
    isOriginScope
      ? birthMutagens
        ? `生年四化：${birthMutagens}`
        : ''
      : currentMutagens
        ? `当前四化：${currentMutagens}`
        : '',
    '十二宫资料：',
    ...selectedPalaces.map(
      (palace) =>
        `  ${formatPalace(palace, isOriginScope, getSelectedScopeHits(payload, palace))}${includeBasicInfo ? `\n  宫位关系：${formatPalaceRelations(payload, palace)}` : ''}`,
    ),
    matchedPatterns ? `命盘格局：\n${matchedPatterns}` : '',
    evidencePrimary.length ? '证据资料：' : '',
    ...evidencePrimary.map((item) => `  ${item}`),
    evidenceAppendix.length ? '证据附录：' : '',
    ...evidenceAppendix.map((item) => `  ${item}`),
  ]
    .filter(Boolean)
    .join('\n');
}

export function getZiweiPromptCalculationScopes(scope: ZiweiPromptScope): ScopeType[] {
  return scope === 'full' ? [...SCOPE_ORDER] : [scope];
}

export function formatZiweiTopicFocus(topic?: ZiweiPromptTopic) {
  if (!topic) return '';
  const focus = TOPIC_FACT_FOCUS[topic];
  return focus
    ? `优先核对${TOPIC_LABELS[topic]}相关的${focus}；其余已列宫位资料作为交叉核验。`
    : '';
}

/**
 * 把完整运限压缩为当前请求的连续阶段，避免选定流年或流月时把其他
 * 十年运和年度资料一并带入；阶段内的干支、宫位、星曜和下层事实仍完整保留。
 */
export function formatZiweiSelectedTimeline(
  timeline: ZiweiFortuneTimeline,
  scope: ZiweiPromptScope,
) {
  const periodEnd = (period: ZiweiFortuneTimeline['periods'][number]) =>
    period.endDateStr ?? period.years.at(-1)?.endDateStr ?? period.dateStr;
  const periodIndex = timeline.periods.findIndex(
    (period) =>
      period.dateStr <= timeline.targetDateStr && periodEnd(period) >= timeline.targetDateStr,
  );
  const fallbackPeriodIndex = timeline.periods.findIndex(
    (period) => timeline.targetAge >= period.startAge && timeline.targetAge <= period.endAge,
  );
  const selectedPeriodIndex = periodIndex >= 0 ? periodIndex : fallbackPeriodIndex;
  if (selectedPeriodIndex < 0) return '';

  if (scope === 'decadal') {
    const period = timeline.periods[selectedPeriodIndex];
    if (!period?.years.length) return '';
    return formatZiweiFortuneTimelinePhase(
      timeline,
      [
        {
          periodIndex: selectedPeriodIndex,
          startYearIndex: 0,
          endYearIndex: period.years.length - 1,
        },
      ],
      1,
      1,
    );
  }

  // 指定流年/流月可能跨生日或大限边界。生成器已将真实目标流年的
  // 起止日写入 actualStart/actualEnd，按日期相交保留两侧连续年龄段，
  // 同时只让目标日期所在的那一段携带流月、流日和流时资料。
  const hasTargetWindow = ['year', 'month', 'day', 'hour'].includes(timeline.scope);
  const windowStart = hasTargetWindow ? timeline.actualStartDateStr : timeline.targetDateStr;
  const windowEnd = hasTargetWindow ? timeline.actualEndDateStr : timeline.targetDateStr;
  const selections: ZiweiFortuneTimelinePhaseSelection[] = [];
  for (const [index, period] of timeline.periods.entries()) {
    const yearIndexes = period.years
      .map((year, yearIndex) => ({ year, yearIndex }))
      .filter(({ year }) => {
        const end = year.endDateStr ?? year.dateStr;
        return year.dateStr <= windowEnd && end >= windowStart;
      })
      .map(({ yearIndex }) => yearIndex);
    if (!yearIndexes.length) continue;
    selections.push({
      periodIndex: index,
      startYearIndex: Math.min(...yearIndexes),
      endYearIndex: Math.max(...yearIndexes),
    });
  }
  if (!selections.length) {
    const period = timeline.periods[selectedPeriodIndex];
    const selectedYearIndex =
      period?.years.findIndex(
        (year) =>
          year.dateStr <= timeline.targetDateStr &&
          (year.endDateStr ?? year.dateStr) >= timeline.targetDateStr,
      ) ?? -1;
    if (selectedYearIndex < 0) return '';
    selections.push({
      periodIndex: selectedPeriodIndex,
      startYearIndex: selectedYearIndex,
      endYearIndex: selectedYearIndex,
    });
  }
  return formatZiweiFortuneTimelinePhase(timeline, selections, 1, 1);
}

export function formatZiweiTargetLowerScopeFacts(
  runtime: Pick<ZiweiRuntimeFacts, 'payloadByScope'>,
) {
  const scopes: ScopeType[] = ['monthly', 'daily', 'hourly'];
  const lines = scopes.flatMap((scope) => {
    const payload = runtime.payloadByScope[scope];
    if (!payload) return [];
    const active = payload.active_scope;
    const mutagens = formatMutagenMap(payload, false);
    const header = `${SCOPE_LABELS[scope]}：${active.solar_date}；${active.heavenly_stem ?? ''}${active.earthly_branch ?? ''}；农历${active.lunar_date}；虚岁${active.nominal_age}；落${active.palace_name ?? ''}${mutagens ? `；四化：${mutagens}` : ''}`;
    const palaces = payload.palaces.map((palace) => {
      const seenMutagenStars = new Set(palace.scope_stars.map(getDynamicMutagenStarKey));
      const stars = palace.scope_stars.map((star) => formatStar(star, false)).filter(Boolean);
      const staticMutagenStars = [
        ...palace.major_stars,
        ...palace.minor_stars,
        ...palace.other_stars,
      ]
        .filter((star) => star.horoscope_mutagen || star.active_scope_mutagen)
        .filter((star) => {
          const key = getDynamicMutagenStarKey(star);
          if (seenMutagenStars.has(key)) return false;
          seenMutagenStars.add(key);
          return true;
        })
        .map(formatDynamicMutagenStar)
        .filter(Boolean);
      return [
        `${palace.name}${palace.dynamic_scope_name ? `→${palace.dynamic_scope_name}` : ''}`,
        stars.length ? `流曜${stars.join('、')}` : '',
        staticMutagenStars.length ? `星曜四化${staticMutagenStars.join('、')}` : '',
        palace.scope_hits.length ? palace.scope_hits.join('、') : '',
      ]
        .filter(Boolean)
        .join('：');
    });
    return [header, `  十二宫（本命宫→动态宫）：${palaces.join('；')}`];
  });
  return lines.length ? `目标日期下层资料：\n${lines.join('\n')}` : '';
}

export {
  formatZiweiFortuneTimelinePhase,
  type ZiweiFortuneTimeline,
  type ZiweiFortuneTimelinePhaseSelection,
};

export function formatZiweiFullScopeText(runtime: ZiweiRuntimeFacts) {
  if (runtime.fortuneTimeline) {
    if (runtime.fortuneTimeline.batch) {
      let firstPayload = true;
      const selectedScopeText = SCOPE_ORDER.map((scope) => runtime.payloadByScope[scope])
        .map((payload) => {
          if (!payload) return '';
          const text = formatZiweiPayloadForPrompt(payload, { includeBasicInfo: firstPayload });
          firstPayload = false;
          return `${SCOPE_LABELS[payload.active_scope.scope]}：\n${text}`;
        })
        .filter(Boolean)
        .join('\n\n');
      return [
        runtime.natalSnapshot
          ? `本命基础资料：\n${formatZiweiNatalSnapshotForPrompt(runtime.natalSnapshot)}`
          : '',
        selectedScopeText,
        `本次所列运限资料：\n${formatZiweiFortuneTimeline(runtime.fortuneTimeline)}`,
        formatZiweiTargetLowerScopeFacts(runtime),
      ]
        .filter(Boolean)
        .join('\n\n');
    }
    const origin = runtime.payloadByScope.origin;
    const originText = origin
      ? formatZiweiPayloadForPrompt(origin, { includeBasicInfo: true })
      : '';
    return [
      originText ? `本命：\n${originText}` : '',
      `完整运限范围：\n${formatZiweiFortuneTimeline(runtime.fortuneTimeline)}`,
      formatZiweiTargetLowerScopeFacts(runtime),
    ]
      .filter(Boolean)
      .join('\n\n');
  }
  let firstPayload = true;
  return SCOPE_ORDER.map((scope) => runtime.payloadByScope[scope])
    .map((payload) => {
      if (!payload) return '';
      const text = formatZiweiPayloadForPrompt(payload, { includeBasicInfo: firstPayload });
      firstPayload = false;
      return `${SCOPE_LABELS[payload.active_scope.scope]}：\n${text}`;
    })
    .filter(Boolean)
    .join('\n\n');
}

export interface ZiweiPromptOptions extends PromptBuildOptions {
  runtime: ZiweiRuntimeFacts;
  scope?: ZiweiPromptScope;
  school?: ZiweiPromptSchool;
  schools?: readonly ZiweiPromptSchool[];
  topic?: ZiweiPromptTopic;
  focusPalaceNames?: readonly string[];
  selection?: PromptSelection;
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
      : [
          options.runtime.natalSnapshot
            ? formatZiweiNatalSnapshotForPrompt(options.runtime.natalSnapshot)
            : '',
          payloads
            .map((payload) =>
              formatZiweiPayloadForPrompt(payload, {
                focusPalaceNames: options.focusPalaceNames,
              }),
            )
            .join('\n\n'),
          options.runtime.fortuneTimeline
            ? formatZiweiSelectedTimeline(options.runtime.fortuneTimeline, scope)
            : '',
        ]
          .filter(Boolean)
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

  const isBatchedFullScope =
    scope === 'full' &&
    Boolean(options.runtime.calculationBatch || options.runtime.fortuneTimeline?.batch);
  const task = buildPromptTask(
    scope === 'origin'
      ? `请依据命身十二宫、星曜庙旺和生年四化解读本命结构${topicLabel ? `，重点分析${topicLabel}` : ''}，再回答问题。`
      : `请依据${
          scope === 'full'
            ? isBatchedFullScope
              ? '本次所列紫微'
              : '本命与所列完整运限'
            : SCOPE_LABELS[scopes[0] ?? 'origin']
        }资料，${topicLabel ? `重点分析${topicLabel}，` : ''}先列出主要宫位、星曜、四化和运限证据，再回答问题。`,
    scope === 'origin' ? 'ziwei-natal' : 'ziwei',
  );
  const selectedTask = options.selection ? buildPromptSelectionTask(task, options.selection) : task;
  const trueSolarText = formatZiweiTrueSolarEvidence(options.runtime.trueSolarEvidence);
  const user = joinPromptSections([
    buildPromptGuidance('ziwei'),
    buildPromptSection('当前时间', formatPromptCurrentTime(options.currentTime)),
    trueSolarText ? buildPromptSection('出生时间校正', trueSolarText) : '',
    formatZiweiTopicFocus(options.topic)
      ? buildPromptSection('主题取用', formatZiweiTopicFocus(options.topic))
      : '',
    buildPromptSection('紫微盘面资料', chartText),
    schoolText
      ? buildPromptSection(selectedSchools.length > 1 ? '多派合参' : '流派', schoolText)
      : '',
    options.selection
      ? buildPromptSection('解读选择', getPromptSelectionSection(options.selection))
      : '',
    buildPromptSection('任务', selectedTask),
    buildPromptSection('问题', question),
  ]);
  return buildPromptDocument(appendClassicalReferences(user, 'ziwei', options.includeClassics));
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
  const overlays = result.palaceOverlays.map((item) => `  ${item.promptText}`);
  const mutagens = result.crossMutagenPlacements.map((item) => `  ${item.promptText}`);
  return [
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
    buildPromptSection(
      '任务',
      buildPromptTask(
        `请依据双方紫微盘面和双盘关系资料${topicLabel ? `重点分析${topicLabel}` : ''}，分别列出互动主轴、互补点、张力点及其对应宫位、星曜或四化证据，再回答问题。`,
        'ziwei-compatibility',
      ),
    ),
    buildPromptSection('问题', question),
  ]);
  return buildPromptDocument(appendClassicalReferences(user, 'ziwei', options.includeClassics));
}

export function buildZiweiCompatibilityPrompt(options: ZiweiCompatibilityPromptOptions) {
  return buildZiweiCompatibilityPromptDocument(options).text;
}

export interface BaziZiweiPromptOptions extends PromptBuildOptions {
  bazi: BaziChartResult;
  ziwei: ZiweiRuntimeFacts | AnalysisPayloadV1;
  topic?: string;
  /** 旧版八字单派兼容字段。 */
  school?: import('./bazi').BaziPromptSchool;
  baziSchool?: import('./bazi').BaziPromptSchool;
  baziSchools?: readonly import('./bazi').BaziPromptSchool[];
  ziweiSchool?: ZiweiPromptSchool;
  ziweiSchools?: readonly ZiweiPromptSchool[];
  selection?: PromptSelection;
}

function resolveZiweiPayload(ziwei: ZiweiRuntimeFacts | AnalysisPayloadV1) {
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
  const thematicConfig = getThematicTopicConfig(topic);
  const ziweiFocusPalaces = thematicConfig?.ziweiFocusPalaces;
  const baziPatternConditions = selectedBaziSchools.length
    ? ''
    : formatBaziPatternConditions(options.bazi);
  const task = buildPromptTask(
    `${thematicConfig.combinedTask} 请先分别依据八字和紫微各自盘面资料建立证据，再比较两套体系对${topic}的共同指向、差异和需要结合现实核对的部分。`,
    'bazi-ziwei',
  );
  const selectedTask = options.selection ? buildPromptSelectionTask(task, options.selection) : task;
  return buildPromptDocument(
    joinPromptSections([
      buildPromptGuidance('bazi-ziwei'),
      buildPromptSection('分析主题', `${thematicConfig.name}合参`),
      buildPromptSection(
        '当前时间',
        formatPromptCurrentTime(
          typeof options.currentTime === 'string'
            ? new Date(options.currentTime)
            : options.currentTime,
        ),
      ),
      buildPromptSection('八字盘面资料', formatBaziForPrompt(options.bazi)),
      baziPatternConditions ? buildPromptSection('八字格局条件', baziPatternConditions) : '',
      selectedBaziSchools.length
        ? buildPromptSection(
            selectedBaziSchools.length > 1 ? '八字多派合参' : '八字解读流派',
            formatBaziSchoolsPrompt(options.bazi, selectedBaziSchools, true, true),
          )
        : '',
      buildPromptSection(
        '紫微盘面资料',
        formatZiweiPayloadForPrompt(payload, {
          focusPalaceNames: ziweiFocusPalaces,
        }),
      ),
      selectedZiweiSchools.length
        ? buildPromptSection(
            selectedZiweiSchools.length > 1 ? '紫微多派合参' : '紫微解读流派',
            formatPromptSchoolGuidance('ziwei', selectedZiweiSchools),
          )
        : '',
      buildPromptSection('分析对象', topic),
      options.selection
        ? buildPromptSection('解读选择', getPromptSelectionSection(options.selection))
        : '',
      options.includeClassics ? formatClassicalReferences('bazi-ziwei') : '',
      buildPromptSection('任务', selectedTask),
      buildPromptSection('问题', question),
    ]),
  );
}

export function buildBaziZiweiPrompt(options: BaziZiweiPromptOptions) {
  return buildBaziZiweiPromptDocument(options).text;
}

export interface SerializableZiweiResult {
  basicInfo: AnalysisPayloadV1['basic_info'];
  calculationConfig: AnalysisPayloadV1['calculation_config'];
  scopeNames: string[];
  payloadByScope: Record<ScopeType, AnalysisPayloadV1>;
  /** 年龄年独立批次的本命基础事实；不表示已经生成 origin 证据与格局分析。 */
  natalFacts?: ZiweiNatalSnapshot;
  fortuneTimeline?: ZiweiFortuneTimeline;
  trueSolarEvidence?: ZiweiRuntimeFacts['trueSolarEvidence'];
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
export function buildSerializableZiweiResult(runtime: ZiweiRuntimeFacts): SerializableZiweiResult {
  const payload = runtime.payloadByScope.origin ?? Object.values(runtime.payloadByScope)[0];
  const natalFacts = runtime.natalSnapshot;
  if (!payload && !natalFacts) {
    throw new Error('紫微运行结果缺少可序列化的盘面资料。');
  }

  const basicInfo = payload?.basic_info ?? natalFacts!.basicInfo;
  const calculationConfig = payload?.calculation_config ?? natalFacts!.calculationConfig;
  const palaces = payload?.palaces ?? natalFacts!.palaces;

  const mutagens: Record<string, string> = {};
  const gongList = palaces.map((palace) => {
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
  const lifePalace = palaces.find((palace) => palace.name === '命宫');
  const bodyPalace = palaces.find((palace) => palace.is_body_palace);

  return {
    basicInfo,
    calculationConfig,
    scopeNames: Object.keys(runtime.payloadByScope),
    payloadByScope: runtime.payloadByScope,
    ...(natalFacts ? { natalFacts } : {}),
    ...(runtime.fortuneTimeline ? { fortuneTimeline: runtime.fortuneTimeline } : {}),
    trueSolarEvidence: runtime.trueSolarEvidence,
    fourMutagens: mutagens,
    birthMutagens: mutagens,
    gongList,
    命宫: lifePalace?.earthly_branch ?? '',
    身宫: bodyPalace?.name ?? '',
    五行局: basicInfo.five_elements_class,
    四化: mutagens,
  };
}
