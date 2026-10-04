import type { AnalysisPayloadV1, PalaceFact } from '../../types/analysis';
import { selectVerifiedZiweiPatterns } from '../iztro/pattern-detection';
import { isZiweiConditionRestatedByPalaces } from './pattern-condition-visibility';
import { buildFocusTaskBundle } from './focus';
import {
  buildEvidenceSummary,
  buildPalaceIndex,
  buildPalaceSummary,
  buildScopeHitSummary,
  buildScopeStructureSummary,
} from './builders';
import { formatKeyValueBlock, formatObjectList } from './formatters';
import { formatPalaceName, mapZiweiScopeLabel, mapZiweiTopicLabel } from './labels';
import {
  getBodyPalace,
  getBodyPalaceAxisSummary,
  getOppositePalace,
  getPalaceByIndex,
  getPalaceByName,
} from '../iztro/palace-helpers';
import type { ZiweiPromptContext } from './types';

function conditionCoversZiweiPalace(palaceName: string, conditions: readonly string[]) {
  const normalizedName = palaceName.replace(/宫$/u, '');
  return conditions.some(
    (condition) => condition.includes(palaceName) || condition.includes(normalizedName),
  );
}

function conditionCoversZiweiStar(starName: string, conditions: readonly string[]) {
  const transformedStar = /^(.*?)(化[禄权科忌])$/u.exec(starName);
  return conditions.some(
    (condition) =>
      condition.includes(starName) ||
      (transformedStar !== null &&
        condition.includes(`${transformedStar[1]}生年${transformedStar[2]}`)),
  );
}

function buildTaskBookAnalysisObject(payload: AnalysisPayloadV1) {
  const currentMutagens = payload.active_scope.mutagen_map ?? [];
  const isOrigin = payload.active_scope.scope === 'origin';
  if (isOrigin) return { 分析对象: `本命盘（出生日期${payload.basic_info.solar_date}）。` };

  const scopeLabel = mapZiweiScopeLabel(payload.active_scope.scope);
  const objectLabel = payload.active_scope.label || scopeLabel;

  return {
    分析对象: objectLabel,
    对象类型: objectLabel.includes(scopeLabel) ? undefined : scopeLabel,
    对宫冲照: (() => {
      const jiItem = currentMutagens.find((item) => item.mutagen === '忌');
      if (!jiItem || !jiItem.palace_name) return undefined;
      const targetPalace = getPalaceByName(payload, jiItem.palace_name);
      if (!targetPalace) return undefined;
      const opposite = getOppositePalace(payload, targetPalace);
      return opposite
        ? `${jiItem.star}化忌入${formatPalaceName(targetPalace.name)}，直冲对宫${formatPalaceName(opposite.name)}`
        : undefined;
    })(),
  };
}

function buildTaskBookBasicInfo(payload: AnalysisPayloadV1) {
  const fourPillars = payload.basic_info.four_pillars;
  const hiddenPalaces = payload.basic_info.hidden_palaces;
  const bodyPalace = getBodyPalace(payload);
  const bodyPalaceName = hiddenPalaces?.body_palace_name || bodyPalace?.name;
  return {
    阳历生日: payload.basic_info.solar_date,
    农历生日: payload.basic_info.lunar_date,
    四柱八字: fourPillars
      ? `${fourPillars.year_pillar} ${fourPillars.month_pillar} ${fourPillars.day_pillar} ${fourPillars.hour_pillar}`
      : undefined,
    出生时辰: `${payload.basic_info.birth_time_label}（${payload.basic_info.birth_time_range}）`,
    命主: payload.basic_info.soul,
    身主: payload.basic_info.body,
    五行局: payload.basic_info.five_elements_class,
    身宫: bodyPalaceName ? formatPalaceName(bodyPalaceName) : undefined,
    命身主轴: getBodyPalaceAxisSummary(bodyPalaceName),
    来因宫: hiddenPalaces?.original_palace_name
      ? formatPalaceName(hiddenPalaces.original_palace_name)
      : undefined,
  };
}

export function buildZiweiMatchedPatternSummary(
  payload: AnalysisPayloadV1,
  options: { displayedPalaces?: readonly PalaceFact[] } = {},
) {
  const birthYearHeavenlyStem = /^[甲乙丙丁戊己庚辛壬癸]/u.exec(
    payload.basic_info.chinese_date,
  )?.[0];
  const patterns = selectVerifiedZiweiPatterns({
    patterns: payload.patterns ?? [],
    palaces: payload.palaces,
    birthYearHeavenlyStem,
  });
  return patterns.map((pattern) => {
    const conditions = [...new Set(pattern.matched_conditions ?? [])];
    const displayedConditions = options.displayedPalaces
      ? conditions.filter(
          (condition) =>
            !isZiweiConditionRestatedByPalaces(pattern, condition, options.displayedPalaces!),
        )
      : conditions;
    const uncoveredPalaces = pattern.palace_names.filter(
      (name) => !conditionCoversZiweiPalace(name, conditions),
    );
    const uncoveredStars = pattern.star_names.filter((name) => {
      if (conditionCoversZiweiStar(name, conditions)) return false;
      const transformedStar = /^(.*?)化([禄权科忌])$/u.exec(name);
      return !options.displayedPalaces?.some((palace) => {
        const palaceIndex = pattern.palace_indexes.indexOf(palace.index);
        const patternPalaceName = pattern.palace_names[palaceIndex];
        if (
          !patternPalaceName ||
          palace.name.replace(/宫$/u, '') !== patternPalaceName.replace(/宫$/u, '')
        ) {
          return false;
        }
        return [...palace.major_stars, ...palace.minor_stars, ...palace.other_stars].some((star) =>
          transformedStar
            ? star.name === transformedStar[1] && star.birth_mutagen === transformedStar[2]
            : star.name === name,
        );
      });
    });
    return {
      格局: pattern.name,
      传统分类:
        pattern.kind === 'auspicious'
          ? '传统吉格'
          : pattern.kind === 'inauspicious'
            ? '传统凶格'
            : '传统中性格',
      命中条件: displayedConditions.length ? displayedConditions.join('；') : undefined,
      涉及宫位: uncoveredPalaces.length ? uncoveredPalaces.join('、') : undefined,
      涉及星曜: uncoveredStars.length ? uncoveredStars.join('、') : undefined,
      古籍依据: pattern.sources?.[0],
    };
  });
}

export function buildPromptContextSnapshot(params: {
  payload: AnalysisPayloadV1;
  reportContext: ZiweiPromptContext;
}) {
  const { payload, reportContext } = params;
  const focusTaskBundle = buildFocusTaskBundle(payload, reportContext);
  const focusPalaces = focusTaskBundle.focusPalaces.slice(0, 8);
  const currentPalace = getPalaceByIndex(payload, payload.active_scope.palace_index);
  const currentMutagens = payload.active_scope.mutagen_map ?? [];
  const isOrigin = payload.active_scope.scope === 'origin';
  const displayedPalaceIndexes = new Set(focusPalaces.map((palace) => palace.index));
  const patternVisiblePalaces = payload.palaces.filter((palace) =>
    displayedPalaceIndexes.has(palace.index),
  );
  return {
    命主基础信息: buildTaskBookBasicInfo(payload),
    当前运限信息: {
      时限类型: mapZiweiScopeLabel(payload.active_scope.scope),
      时限标签: payload.active_scope.label,
      当前落宫: !isOrigin && currentPalace ? formatPalaceName(currentPalace.name) : undefined,
      当前四化:
        !isOrigin && currentMutagens.length
          ? currentMutagens.map((item) =>
              item.palace_name
                ? `${item.star}化${item.mutagen}→${formatPalaceName(item.palace_name)}${item.dynamic_palace_name ? `（动态${formatPalaceName(item.dynamic_palace_name)}）` : ''}`
                : `${item.star}化${item.mutagen}`,
            )
          : undefined,
    },
    命盘格局: buildZiweiMatchedPatternSummary(payload, {
      displayedPalaces: patternVisiblePalaces,
    }),
    运限结构: buildScopeStructureSummary(payload),
    重点宫位摘要: focusPalaces.map((item) => buildPalaceSummary(payload, item)),
    全盘宫位索引: buildPalaceIndex(payload),
  };
}

function filterRepeatedPalaceMutagens<
  T extends { 生年四化?: string[]; 流曜四化?: string[]; 当前运限四化?: string[] },
>(summary: T, palace: PalaceFact) {
  const classifiedStars = [...palace.major_stars, ...palace.minor_stars, ...palace.other_stars];
  const remainingMutagens = (
    items: string[] | undefined,
    field: 'birth_mutagen' | 'horoscope_mutagen' | 'active_scope_mutagen',
  ) =>
    items?.filter(
      (item) =>
        !classifiedStars.some((star) => star[field] && item === `${star.name}化${star[field]}`),
    );
  return {
    ...summary,
    生年四化: remainingMutagens(summary.生年四化, 'birth_mutagen'),
    流曜四化: remainingMutagens(summary.流曜四化, 'horoscope_mutagen'),
    当前运限四化: remainingMutagens(summary.当前运限四化, 'active_scope_mutagen'),
  };
}

export function buildZiweiReadableSnapshot(params: {
  payload: AnalysisPayloadV1;
  reportContext: ZiweiPromptContext;
}) {
  const snapshot = buildPromptContextSnapshot(params);
  const focusPalaces = buildFocusTaskBundle(
    params.payload,
    params.reportContext,
  ).focusPalaces.slice(0, 8);
  const patternSection = snapshot.命盘格局.length
    ? ['', '【命盘格局】', formatObjectList(snapshot.命盘格局)]
    : [];
  const yunxianFocus = buildScopeHitSummary(params.payload);
  const evidenceBody = formatObjectList(
    buildEvidenceSummary(params.payload, focusPalaces, params.reportContext),
  );
  const focusBody = formatObjectList(
    snapshot.重点宫位摘要.map((summary, index) =>
      filterRepeatedPalaceMutagens(summary, focusPalaces[index]),
    ),
  );
  const focusPalaceNames = new Set(focusPalaces.map((palace) => formatPalaceName(palace.name)));
  const palaceBody = formatObjectList(
    snapshot.全盘宫位索引.map((palace) =>
      focusPalaceNames.has(palace.宫位) ? { 宫位: palace.宫位 } : palace,
    ),
  );

  return [
    '【分析背景】',
    `分析主题：${mapZiweiTopicLabel(params.reportContext.selectedTopic ?? 'chat')}`,
    `分析范围：${mapZiweiScopeLabel(params.reportContext.scope)}`,
    '',
    '【本命资料】',
    formatKeyValueBlock(snapshot.命主基础信息),
    '',
    '【分析对象】',
    formatKeyValueBlock(buildTaskBookAnalysisObject(params.payload)),
    ...patternSection,
    yunxianFocus.length ? ['', '【运限重点】', yunxianFocus.join('\n')] : [],
    evidenceBody ? ['', '【关键判断线索】', evidenceBody] : '',
    focusBody ? ['', '【重点宫位资料】', focusBody] : '',
    palaceBody ? ['', '【十二宫资料】', palaceBody] : '',
  ]
    .flat()
    .filter((line): line is string => typeof line === 'string')
    .join('\n');
}

export function buildZiweiTaskBookSnapshot(params: {
  payload: AnalysisPayloadV1;
  reportContext: ZiweiPromptContext;
}) {
  const { payload, reportContext } = params;
  const focusTaskBundle = buildFocusTaskBundle(payload, reportContext);
  const focusPalaces = focusTaskBundle.focusPalaces;
  const isOrigin = payload.active_scope.scope === 'origin';
  const patternSummary = buildZiweiMatchedPatternSummary(payload, {
    displayedPalaces: payload.palaces,
  });
  const yunxianFocus = buildScopeHitSummary(payload);
  const focusBody = `宫位：${focusPalaces.map((item) => formatPalaceName(item.name)).join('、')}`;
  const palaceBody = payload.palaces
    .map((palace) => {
      const summary = filterRepeatedPalaceMutagens(buildPalaceSummary(payload, palace), palace);
      return Object.entries(summary)
        .filter(
          ([key, value]) =>
            !['对宫', '三方四正'].includes(key) &&
            value != null &&
            value !== '' &&
            (!Array.isArray(value) || value.length),
        )
        .map(([key, value]) => `${key}：${Array.isArray(value) ? value.join('、') : value}`)
        .join('｜');
    })
    .join('\n');
  const evidenceBody = buildEvidenceSummary(payload, focusPalaces, reportContext)
    .map((item) => `${item.适用范围}｜${item.判断线索}`)
    .join('\n');

  const sections = [
    '【分析背景】',
    `分析主题：${mapZiweiTopicLabel(reportContext.selectedTopic ?? 'chat')}`,
    `分析范围：${mapZiweiScopeLabel(reportContext.scope)}`,
    '',
    '【本命资料】',
    formatKeyValueBlock(buildTaskBookBasicInfo(payload)),
    '',
    '【分析对象】',
    formatKeyValueBlock(buildTaskBookAnalysisObject(payload)),
    ...(!isOrigin && yunxianFocus.length ? ['', '【运限重点】', yunxianFocus.join('\n')] : []),
    ...(patternSummary.length ? ['', '【命盘格局】', formatObjectList(patternSummary)] : []),
    ...(evidenceBody ? ['', '【关键判断线索】', evidenceBody] : []),
    ...['', '【重点宫位资料】', focusBody],
    ...['', '【全盘十二宫总览】', palaceBody],
  ];

  return sections
    .flat()
    .filter((line): line is string => typeof line === 'string')
    .join('\n');
}
