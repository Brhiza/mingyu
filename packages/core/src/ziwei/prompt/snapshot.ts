import type { AnalysisPayloadV1 } from '../../types/analysis';
import { selectVerifiedZiweiPatterns } from '../iztro/pattern-detection';
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
import { getPalaceByIndex } from '../iztro/palace-helpers';
import type { ZiweiPromptContext } from './types';

function buildTaskBookAnalysisObject(payload: AnalysisPayloadV1) {
  const currentPalace = getPalaceByIndex(payload, payload.active_scope.palace_index);
  const currentMutagens = payload.active_scope.mutagen_map ?? [];
  const isOrigin = payload.active_scope.scope === 'origin';
  if (isOrigin) return { 分析对象: `本命盘（${payload.active_scope.solar_date}）。` };

  return {
    分析对象: payload.active_scope.label || mapZiweiScopeLabel(payload.active_scope.scope),
    对象类型: mapZiweiScopeLabel(payload.active_scope.scope),
    当前落宫: currentPalace ? formatPalaceName(currentPalace.name) : undefined,
    当前四化: currentMutagens.length
      ? currentMutagens.map((item) =>
          item.palace_name
            ? `${item.star}化${item.mutagen}→${formatPalaceName(item.palace_name)}${item.dynamic_palace_name ? `（动态${formatPalaceName(item.dynamic_palace_name)}）` : ''}`
            : `${item.star}化${item.mutagen}`,
        )
      : undefined,
  };
}

function buildTaskBookBasicInfo(payload: AnalysisPayloadV1) {
  const fourPillars = payload.basic_info.four_pillars;
  const hiddenPalaces = payload.basic_info.hidden_palaces;
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
    身宫: hiddenPalaces?.body_palace_name
      ? formatPalaceName(hiddenPalaces.body_palace_name)
      : undefined,
    来因宫: hiddenPalaces?.original_palace_name
      ? formatPalaceName(hiddenPalaces.original_palace_name)
      : undefined,
  };
}

function buildPatternSummary(payload: AnalysisPayloadV1) {
  const patterns = selectVerifiedZiweiPatterns({
    patterns: payload.patterns ?? [],
    palaces: payload.palaces,
  });
  return patterns.map((pattern) => ({
    格局: pattern.name,
    传统分类:
      pattern.kind === 'auspicious'
        ? '传统吉格'
        : pattern.kind === 'inauspicious'
          ? '传统凶格'
          : '传统中性格',
    命中条件: pattern.matched_conditions?.join('；'),
    涉及宫位: pattern.palace_names.join('、'),
    涉及星曜: pattern.star_names.join('、'),
    古籍依据: pattern.sources?.[0],
  }));
}

export function buildPromptContextSnapshot(params: {
  payload: AnalysisPayloadV1;
  reportContext: ZiweiPromptContext;
}) {
  const { payload, reportContext } = params;
  const focusTaskBundle = buildFocusTaskBundle(payload, reportContext);
  const focusPalaces = focusTaskBundle.focusPalaces.slice(0, 4);
  const currentPalace = getPalaceByIndex(payload, payload.active_scope.palace_index);
  const currentMutagens = payload.active_scope.mutagen_map ?? [];
  const isOrigin = payload.active_scope.scope === 'origin';
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
    命盘格局: buildPatternSummary(payload),
    运限结构: buildScopeStructureSummary(payload).slice(0, 8),
    重点宫位摘要: focusPalaces.map((item) => buildPalaceSummary(payload, item)),
    全盘宫位索引: buildPalaceIndex(payload),
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
  ).focusPalaces.slice(0, 4);
  const patternSection = snapshot.命盘格局.length
    ? ['', '【命盘格局】', formatObjectList(snapshot.命盘格局)]
    : [];
  const yunxianBody = formatObjectList(snapshot.运限结构);
  const yunxianFocus = buildScopeHitSummary(params.payload);
  const evidenceBody = formatObjectList(
    buildEvidenceSummary(params.payload, focusPalaces, params.reportContext),
  );
  const focusBody = formatObjectList(snapshot.重点宫位摘要);
  const palaceBody = formatObjectList(snapshot.全盘宫位索引);

  return [
    '【分析背景】',
    `分析主题：${mapZiweiTopicLabel(params.reportContext.selectedTopic ?? 'chat')}`,
    `分析范围：${mapZiweiScopeLabel(params.reportContext.scope)}`,
    '',
    '【本命资料】',
    formatKeyValueBlock(snapshot.命主基础信息),
    '',
    '【分析对象】',
    formatKeyValueBlock(snapshot.当前运限信息),
    ...patternSection,
    ['', '【运限资料】', yunxianBody || '- 无'],
    ['', '【运限重点】', yunxianFocus.length ? yunxianFocus.join('\n') : '- 无'],
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
  const focusPalaces = focusTaskBundle.focusPalaces.slice(0, 4);
  const isOrigin = payload.active_scope.scope === 'origin';
  const patternSummary = buildPatternSummary(payload);
  const yunxianFocus = buildScopeHitSummary(payload);
  const focusBody = focusPalaces.map((item) => buildPalaceSummary(payload, item));
  const evidenceBody = formatObjectList(buildEvidenceSummary(payload, focusPalaces, reportContext));

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
    ...(isOrigin
      ? []
      : ['', '【运限重点】', yunxianFocus.length ? yunxianFocus.join('\n') : '- 无']),
    ...(patternSummary.length ? ['', '【命盘格局】', formatObjectList(patternSummary)] : []),
    ...(evidenceBody ? ['', '【关键判断线索】', evidenceBody] : []),
    ...(formatObjectList(focusBody) ? ['', '【重点宫位资料】', formatObjectList(focusBody)] : []),
  ];
  return sections
    .flat()
    .filter((line): line is string => typeof line === 'string')
    .join('\n');
}
