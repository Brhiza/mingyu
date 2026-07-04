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

function dedupeAndTrim(values: string[] | undefined, limit: number) {
  if (!values?.length) {
    return [];
  }

  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean))).slice(0, limit);
}

function sortByPriority<T extends { priority?: number }>(items: T[]) {
  return [...items].sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0));
}

function buildPromptTaskSummary(params: {
  focusSummary: string;
  focusPalaces: string[];
  avoid: string[];
}) {
  return {
    解读目标: params.focusSummary,
    重点参考宫位: dedupeAndTrim(params.focusPalaces, 4),
    严格边界: dedupeAndTrim(params.avoid, 2),
  };
}

function buildTaskBookAnalysisObject(payload: AnalysisPayloadV1) {
  const currentPalace = getPalaceByIndex(payload, payload.active_scope.palace_index);
  const currentMutagens = payload.active_scope.mutagen_map ?? [];
  const isOrigin = payload.active_scope.scope === 'origin';

  if (isOrigin) {
    return {
      分析对象: '本命盘',
      参考日期: payload.active_scope.solar_date,
      解读范围: '只判断命盘长期结构、宫位主轴、星曜组合、四化底色、格局层次与人生长期倾向。',
      资料说明:
        '本次没有提供大限、流年、流月、流日或流时；问题涉及具体年份、月份、日期或年龄时，只能给本命倾向，并提醒需要补充对应运限后再判断应期。',
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
              ? `${item.star}化${item.mutagen}→${formatPalaceName(item.palace_name)}`
              : `${item.star}化${item.mutagen}`,
          )
        : undefined,
    解读范围:
      '以上面提供的分析对象为主，先承接本命底色，再判断当前运限如何触发；未提供下级运限时，不指定更细的月日时应期。',
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
    暗合宫: hiddenPalaces?.anhe_palace_name
      ? formatPalaceName(hiddenPalaces.anhe_palace_name)
      : undefined,
  };
}

function buildPatternSummary(payload: AnalysisPayloadV1) {
  return sortByPriority(payload.patterns ?? [])
    .slice(0, 4)
    .map((item) => ({
      格局: item.name,
      性质: item.kind === 'auspicious' ? '吉格' : item.kind === 'inauspicious' ? '凶格' : '中性',
      关联宫位: item.palace_names.map((name) => formatPalaceName(name)),
      关联星曜: item.star_names,
      说明: item.description,
    }));
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
    当前报告任务: buildPromptTaskSummary({
      focusSummary: focusTaskBundle.focusSummary,
      focusPalaces: focusTaskBundle.focusPalaces.map((item) => formatPalaceName(item.name)),
      avoid: focusTaskBundle.avoid,
    }),
    命主基础信息: buildTaskBookBasicInfo(payload),
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
                ? `${item.star}化${item.mutagen}→${formatPalaceName(item.palace_name)}`
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
    '【解读目标】',
    formatKeyValueBlock(snapshot.当前报告任务),
    '',
    '【本命资料】',
    formatKeyValueBlock(snapshot.命主基础信息),
    '',
    '【分析对象】',
    formatKeyValueBlock(snapshot.当前运限信息),
    '',
    '【运限重点】',
    formatObjectList(snapshot.运限命中摘要.map((line) => ({ 摘要: line }))),
    '',
    '【命盘格局】',
    formatObjectList(snapshot.命盘格局),
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
  const taskSummary = buildPromptTaskSummary({
    focusSummary: focusTaskBundle.focusSummary,
    focusPalaces: focusTaskBundle.focusPalaces.map((item) => formatPalaceName(item.name)),
    avoid: focusTaskBundle.avoid,
  });
  const evidenceSummary = buildEvidenceSummary(payload, focusPalaces, reportContext).slice(0, 6);

  const sections = [
    '【分析背景】',
    formatKeyValueBlock({
      分析主题: mapTopicLabel(reportContext.selected_topic),
      分析范围: reportContext.scope_label,
      重点宫位: reportContext.palace_name ? formatPalaceName(reportContext.palace_name) : undefined,
    }),
    '',
    '【解读目标】',
    formatKeyValueBlock(taskSummary),
    '',
    '【本命资料】',
    formatKeyValueBlock(buildTaskBookBasicInfo(payload)),
    '',
    '【分析对象】',
    formatKeyValueBlock(buildTaskBookAnalysisObject(payload)),
    '',
    '【命盘格局】',
    formatObjectList(buildPatternSummary(payload)),
    '',
    '【重点宫位资料】',
    formatObjectList(focusPalaces.map((item) => buildPalaceSummary(payload, item))),
    '',
    '【关键判断线索】',
    formatObjectList(evidenceSummary),
  ];

  if (!isOrigin) {
    sections.splice(
      12,
      0,
      '【运限重点】',
      formatObjectList(buildScopeHitSummary(payload).map((line) => ({ 摘要: line }))),
      '',
    );
  }

  return sections.join('\n');
}
