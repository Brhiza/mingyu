import type { AnalysisPayloadV1 } from '../../types/analysis';
import {
  buildEvidenceSummary,
  buildPalaceIndex,
  buildPalaceSummary,
  buildScopeHitSummary,
  buildScopeStructureSummary,
} from './builders';
import { buildFocusTaskBundle } from './focus-bundle';
import { formatKeyValueBlock, formatObjectList } from './formatters';
import { formatPalaceName, mapScopeLabel, mapTopicLabel } from './labels';
import { getPalaceByIndex } from './palace-helpers';
import type { PromptContext } from './types';

function buildTaskBookAnalysisObject(payload: AnalysisPayloadV1) {
  const currentPalace = getPalaceByIndex(payload, payload.active_scope.palace_index);
  const currentMutagens = payload.active_scope.mutagen_map ?? [];
  const isOrigin = payload.active_scope.scope === 'origin';

  if (isOrigin) {
    return {
      分析对象: '本命盘',
      参考日期: payload.active_scope.solar_date,
    };
  }

  return {
    分析对象: payload.active_scope.label || mapScopeLabel(payload.active_scope.scope),
    对象类型: mapScopeLabel(payload.active_scope.scope),
    参考日期: payload.active_scope.solar_date,
    虚岁: payload.active_scope.nominal_age,
    当前落宫: currentPalace ? formatPalaceName(currentPalace.name) : undefined,
    当前四化:
      currentMutagens.length > 0
        ? currentMutagens.map((item) =>
            item.palace_name
              ? `${item.star}化${item.mutagen}→${formatPalaceName(item.palace_name)}${
                  item.dynamic_palace_name
                    ? `（动态${formatPalaceName(item.dynamic_palace_name)}）`
                    : ''
                }`
              : `${item.star}化${item.mutagen}`,
          )
        : undefined,
  };
}

function buildTaskBookBasicInfo(payload: AnalysisPayloadV1) {
  const fourPillars = payload.basic_info.four_pillars;
  const hiddenPalaces = payload.basic_info.hidden_palaces;

  return {
    性别: payload.basic_info.gender,
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

function buildCalculationConfigSummary(payload: AnalysisPayloadV1) {
  const config = payload.calculation_config;
  return {
    安星口径: config.algorithm_basis.replace(/^iztro\s*/i, ''),
    闰月口径: config.leap_month_rule,
    分年口径: config.year_divide_rule,
    运限月份: config.horoscope_divide_rule,
    小限年龄: config.age_divide_rule,
    晚子时: config.late_zi_rule,
  };
}

function buildPatternSummary(_payload: AnalysisPayloadV1) {
  // 自定义格局尚未逐条校勘；即使旧调用方注入 patterns，也不得进入提示词。
  return [];
}

export function buildPromptContextSnapshot(params: {
  payload: AnalysisPayloadV1;
  reportContext: PromptContext;
}) {
  const { payload, reportContext } = params;
  const focusTaskBundle = buildFocusTaskBundle(payload, reportContext);
  const currentPalace = getPalaceByIndex(payload, payload.active_scope.palace_index);
  const focusPalaces = focusTaskBundle.focusPalaces.slice(0, 4);
  const currentMutagens = payload.active_scope.mutagen_map ?? [];

  return {
    命主基础信息: buildTaskBookBasicInfo(payload),
    排盘口径: buildCalculationConfigSummary(payload),
    当前运限信息: {
      时限类型: mapScopeLabel(payload.active_scope.scope),
      时限标签: payload.active_scope.label,
      参考日期: payload.active_scope.solar_date,
      虚岁: payload.active_scope.nominal_age,
      当前落宫: currentPalace ? formatPalaceName(currentPalace.name) : undefined,
      当前四化:
        currentMutagens.length > 0
          ? currentMutagens.map((item) =>
              item.palace_name
                ? `${item.star}化${item.mutagen}→${formatPalaceName(item.palace_name)}${
                    item.dynamic_palace_name
                      ? `（动态${formatPalaceName(item.dynamic_palace_name)}）`
                      : ''
                  }`
                : `${item.star}化${item.mutagen}`,
            )
          : undefined,
    },
    命盘格局: buildPatternSummary(payload),
    运限命中摘要: buildScopeHitSummary(payload),
    运限结构: buildScopeStructureSummary(payload).slice(0, 8),
    重点宫位摘要: focusPalaces.map((item) => buildPalaceSummary(payload, item)),
    关键证据摘要: buildEvidenceSummary(payload, focusPalaces, reportContext).slice(0, 6),
    全盘宫位索引: buildPalaceIndex(payload),
  };
}

export function buildZiweiReadableSnapshot(params: {
  payload: AnalysisPayloadV1;
  reportContext: PromptContext;
}) {
  const snapshot = buildPromptContextSnapshot(params);
  const patternSection = snapshot.命盘格局.length
    ? ['', '【命盘格局】', formatObjectList(snapshot.命盘格局)]
    : [];

  return [
    '【分析背景】',
    formatKeyValueBlock({
      分析主题: mapTopicLabel(params.reportContext.selected_topic),
      分析范围: params.reportContext.scope_label,
      重点宫位: params.reportContext.palace_name
        ? formatPalaceName(params.reportContext.palace_name)
        : undefined,
    }),
    '',
    '【本命资料】',
    formatKeyValueBlock(snapshot.命主基础信息),
    '',
    '【排盘口径】',
    formatKeyValueBlock(snapshot.排盘口径),
    '',
    '【分析对象】',
    formatKeyValueBlock(snapshot.当前运限信息),
    '',
    '【运限重点】',
    formatObjectList(snapshot.运限命中摘要.map((line) => ({ 摘要: line }))),
    ...patternSection,
    '',
    '【运限资料】',
    formatObjectList(snapshot.运限结构),
    '',
    '【重点宫位资料】',
    formatObjectList(snapshot.重点宫位摘要),
    '',
    '【关键判断线索】',
    formatObjectList(snapshot.关键证据摘要),
    '',
    '【十二宫资料】',
    formatObjectList(snapshot.全盘宫位索引),
  ].join('\n');
}

export function buildZiweiTaskBookSnapshot(params: {
  payload: AnalysisPayloadV1;
  reportContext: PromptContext;
}) {
  const { payload, reportContext } = params;
  const focusTaskBundle = buildFocusTaskBundle(payload, reportContext);
  const focusPalaces = focusTaskBundle.focusPalaces.slice(0, 4);
  const isOrigin = params.payload.active_scope.scope === 'origin';
  const evidenceSummary = buildEvidenceSummary(payload, focusPalaces, reportContext).slice(0, 6);
  const patternSummary = buildPatternSummary(payload);

  const sections = [
    '【分析背景】',
    formatKeyValueBlock({
      分析主题: mapTopicLabel(reportContext.selected_topic),
      分析范围: reportContext.scope_label,
      重点宫位: reportContext.palace_name ? formatPalaceName(reportContext.palace_name) : undefined,
    }),
    '',
    '【本命资料】',
    formatKeyValueBlock(buildTaskBookBasicInfo(payload)),
    '',
    '【排盘口径】',
    formatKeyValueBlock(buildCalculationConfigSummary(payload)),
    '',
    '【分析对象】',
    formatKeyValueBlock(buildTaskBookAnalysisObject(payload)),
    ...(patternSummary.length ? ['', '【命盘格局】', formatObjectList(patternSummary)] : []),
    '',
    '【重点宫位资料】',
    formatObjectList(focusPalaces.map((item) => buildPalaceSummary(payload, item))),
    '',
    '【关键判断线索】',
    formatObjectList(evidenceSummary),
  ];

  if (!isOrigin) {
    sections.splice(
      9,
      0,
      '【运限重点】',
      formatObjectList(buildScopeHitSummary(payload).map((line) => ({ 摘要: line }))),
      '',
    );
  }

  return sections.join('\n');
}
