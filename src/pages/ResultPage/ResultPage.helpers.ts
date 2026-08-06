import type { DecadalTimelineOption } from 'mingyu-core/ziwei';
import { formatPromptCurrentTime } from '@/lib/prompt-time';
import type { AstrolabeScopeMode, QueryPromptState, ZiweiScopeMode } from '@/lib/query-state';
import type { AstrolabePromptTopic } from '@/lib/astrolabe-prompts';
import { buildPortablePromptPack, type PromptContext } from '@/lib/ziwei-prompts';
import { getBaziDefaultQuestion } from '@/lib/prompt-default-questions';
import {
  formatBaziForPrompt,
  type BaziChartResult,
  type BaziFortuneSelectionValue,
} from 'mingyu-core/bazi';
import type { AnalysisPayloadV1, ScopeType } from '@/types/analysis';
import type { AstrolabeScopeContext } from '@/lib/astrolabe-scope';
import type { PalaceFact } from '@/types/analysis';
import { safeStorage } from '@/lib/safe-storage';
import { ASTROLABE_SHORTCUT_ACTIONS } from '@/lib/astrolabe-prompts';
import { buildPromptGuidanceSections } from '@/lib/prompt-guidance';
import {
  baziCompatibilityShortcutActions,
  baziSingleShortcutActions,
  ziweiCompatibilityShortcutActions,
  ziweiScopeLabelMap,
  ziweiSingleShortcutActions,
} from './ResultPage.constants';
import type { ZiweiDayOption, ZiweiMonthOption, ZiweiYearOption } from './ResultPage.types';

export type PromptDraftKind = 'custom' | 'inspiration';

function buildPromptDraftStorageKey(storageKey: string, kind: PromptDraftKind) {
  return kind === 'custom' ? storageKey : `${storageKey}:${kind}`;
}

export function readPromptDraft(storageKey: string, kind: PromptDraftKind = 'custom') {
  return safeStorage.get(buildPromptDraftStorageKey(storageKey, kind)) ?? '';
}

export function writePromptDraft(
  storageKey: string,
  value: string,
  kind: PromptDraftKind = 'custom',
) {
  const targetKey = buildPromptDraftStorageKey(storageKey, kind);
  if (value.trim()) {
    safeStorage.set(targetKey, value);
    return;
  }
  safeStorage.remove(targetKey);
}

export function getBaziShortcutActions(analysisMode: 'single' | 'compatibility') {
  return analysisMode === 'compatibility'
    ? baziCompatibilityShortcutActions
    : baziSingleShortcutActions;
}

export function getZiweiShortcutActions(analysisMode: 'single' | 'compatibility') {
  return analysisMode === 'compatibility'
    ? ziweiCompatibilityShortcutActions
    : ziweiSingleShortcutActions;
}

export function resolveAstrolabeTopicByShortcutMode(mode: string): AstrolabePromptTopic {
  return ASTROLABE_SHORTCUT_ACTIONS.find((item) => item.label === mode)?.topic ?? 'chat';
}

export function resolveZiweiTopicByBaziShortcutMode(mode: string) {
  if (mode === '自定义' || mode === '问题灵感') {
    return 'life';
  }

  return ziweiSingleShortcutActions.find((item) => item.label === mode)?.topic ?? 'life';
}

export function resolveCompatType(
  promptId: string,
): 'marriage' | 'career' | 'friendship' | 'children' | 'parents' | 'siblings' | undefined {
  if (promptId === 'ai-compat-marriage') return 'marriage';
  if (promptId === 'ai-compat-career') return 'career';
  if (promptId === 'ai-compat-friendship') return 'friendship';
  if (promptId === 'ai-compat-children') return 'children';
  if (promptId === 'ai-compat-parents') return 'parents';
  if (promptId === 'ai-compat-siblings') return 'siblings';
  return undefined;
}

export function findBaziShortcutByMode(mode: string, analysisMode: 'single' | 'compatibility') {
  return getBaziShortcutActions(analysisMode).find((item) => item.label === mode) ?? null;
}

export function findZiweiShortcutByMode(mode: string, analysisMode: 'single' | 'compatibility') {
  return getZiweiShortcutActions(analysisMode).find((item) => item.label === mode) ?? null;
}

export function findAstrolabeShortcutByMode(mode: string) {
  return ASTROLABE_SHORTCUT_ACTIONS.find((item) => item.label === mode) ?? null;
}

export function resolveBaziShortcutMode(
  promptState: Pick<QueryPromptState, 'baziPresetId' | 'baziShortcutMode'>,
  analysisMode: 'single' | 'compatibility',
) {
  if (promptState.baziShortcutMode === '自定义') {
    return '自定义';
  }

  if (promptState.baziShortcutMode === '问题灵感') {
    return '问题灵感';
  }

  if (findBaziShortcutByMode(promptState.baziShortcutMode, analysisMode)) {
    return promptState.baziShortcutMode;
  }

  if (analysisMode === 'compatibility') {
    return (
      baziCompatibilityShortcutActions.find((item) => item.promptId === promptState.baziPresetId)
        ?.label ?? '自定义'
    );
  }

  const matched = getBaziShortcutActions(analysisMode).find(
    (item) => item.promptId === promptState.baziPresetId,
  );
  return matched?.label ?? '自定义';
}

export function resolveZiweiShortcutMode(
  promptState: Pick<QueryPromptState, 'ziweiShortcutMode' | 'ziweiTopic'>,
  analysisMode: 'single' | 'compatibility',
) {
  if (promptState.ziweiShortcutMode === '自定义') {
    return '自定义';
  }

  if (promptState.ziweiShortcutMode === '问题灵感') {
    return '问题灵感';
  }

  if (findZiweiShortcutByMode(promptState.ziweiShortcutMode, analysisMode)) {
    return promptState.ziweiShortcutMode;
  }

  if (analysisMode === 'compatibility') {
    return (
      ziweiCompatibilityShortcutActions.find((item) => item.topic === promptState.ziweiTopic)
        ?.label ?? '自定义'
    );
  }

  const matched = getZiweiShortcutActions(analysisMode).find(
    (item) => item.topic === promptState.ziweiTopic,
  );
  return matched?.label ?? '自定义';
}

export function resolveAstrolabeShortcutMode(
  promptState: Pick<QueryPromptState, 'astrolabeShortcutMode' | 'astrolabeTopic'>,
) {
  if (promptState.astrolabeShortcutMode === '自定义') {
    return '自定义';
  }

  if (promptState.astrolabeShortcutMode === '问题灵感') {
    return '问题灵感';
  }

  if (findAstrolabeShortcutByMode(promptState.astrolabeShortcutMode)) {
    return promptState.astrolabeShortcutMode;
  }

  const matched = ASTROLABE_SHORTCUT_ACTIONS.find(
    (item) => item.topic === promptState.astrolabeTopic,
  );
  return matched?.label ?? '综合';
}

export function buildCombinedPromptText(system: string, user: string) {
  return [system, user].filter(Boolean).join('\n\n');
}

export function buildEnhancedZiweiPromptPack(payload: AnalysisPayloadV1, selectedTopic: string) {
  const reportContext: PromptContext = {
    report_key: `enhanced:${selectedTopic}:${payload.active_scope.scope}:${payload.active_scope.solar_date}`,
    report_title: '紫微交叉校验资料',
    report_type: 'enhanced',
    selected_topic: selectedTopic,
    scope_type: payload.active_scope.scope,
    scope_label: payload.active_scope.label,
    focus_notes: [],
  };

  return buildPortablePromptPack({
    payload,
    reportContext,
    mode: 'task-book',
  });
}

export function buildBaziZiweiEnhancedPrompt(params: {
  baziResult: BaziChartResult;
  baziText?: string;
  ziweiText: string;
  question: string;
  questionScopeLabel?: string;
  baziFortuneSummary?: string;
  ziweiScopeSummary?: string;
  isCustomQuestion?: boolean;
}) {
  const isCustomQuestion = Boolean(params.isCustomQuestion);
  const normalizedQuestion =
    params.question.trim() || getBaziDefaultQuestion(undefined, { isCustomQuestion });
  const baziText = params.baziText || formatBaziForPrompt(params.baziResult, null, 'general');
  const sourceLabels = [params.baziFortuneSummary, params.ziweiScopeSummary]
    .map((item) => item?.trim())
    .filter(Boolean);
  const questionScopeLabel = params.questionScopeLabel?.trim();

  return [
    buildPromptGuidanceSections('bazi-ziwei'),
    `【当前时间】\n${formatPromptCurrentTime()}`,
    sourceLabels.length > 0 ? `【分析对象】\n${sourceLabels.join('\n')}` : '',
    questionScopeLabel && questionScopeLabel !== '通用'
      ? `【问题范围】\n${questionScopeLabel}`
      : '',
    `【八字排盘信息】\n${baziText}`,
    `【紫微盘面信息】\n${params.ziweiText}`,
    ...(normalizedQuestion ? [`【问题】\n${normalizedQuestion}`] : []),
    ...(isCustomQuestion
      ? []
      : [
          '【任务】\n先用八字判断命局主线、结构强弱、喜忌取用与当前触发，再用紫微校验对应宫位主轴、四化牵动、三方四正和运限落点。',
        ]),
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function formatBaziFullFortuneText(result: BaziChartResult) {
  if (!result.luckInfo?.cycles?.length) {
    return '';
  }

  return [
    '完整大运流年：',
    ...result.luckInfo.cycles.flatMap((cycle, cycleIndex) => {
      const cycleType = cycle.isXiaoyun ? '童运' : cycle.type;
      return [
        `${cycleIndex + 1}. ${cycle.ganZhi}${cycleType}：${cycle.year}年起，约${cycle.age}岁交运`,
        ...cycle.years.map((year) => `  - ${year.year}年（${year.age}岁）${year.ganZhi}`),
      ];
    }),
  ].join('\n');
}

function formatZiweiMutagenMap(payload: AnalysisPayloadV1) {
  const items = payload.active_scope.mutagen_map
    .map((item) => {
      const base = [
        item.star ? `${item.star}化${item.mutagen}` : `化${item.mutagen}`,
        item.palace_name,
      ]
        .filter(Boolean)
        .join('入');
      return item.dynamic_palace_name ? `${base}（动态${item.dynamic_palace_name}宫）` : base;
    })
    .filter(Boolean);

  return items.length ? items.join('；') : '未标出当前四化';
}

function formatZiweiScopeHits(payload: AnalysisPayloadV1) {
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

  return hits.length ? hits.slice(0, 8).join('；') : '未标出明显运限落宫';
}

export function formatZiweiFullScopeText(
  payloadByScope: Partial<Record<ScopeType, AnalysisPayloadV1>>,
) {
  const scopeOrder: ScopeType[] = ['origin', 'decadal', 'yearly', 'monthly', 'daily', 'hourly'];
  const lines = scopeOrder
    .map((scope) => {
      const payload = payloadByScope[scope];
      if (!payload) return '';
      const scopeLabel = ziweiScopeLabelMap[scope as ZiweiScopeMode] || payload.active_scope.label;
      const activePalace = payload.palaces.find(
        (palace) => palace.index === payload.active_scope.palace_index,
      );
      const palaceText = activePalace ? `当前落宫：本命${activePalace.name}宫。` : '';
      const scopeDetails =
        scope === 'origin'
          ? ''
          : [
              `当前四化：${formatZiweiMutagenMap(payload)}。`,
              `运限命中：${formatZiweiScopeHits(payload)}。`,
            ].join('');

      return `${scopeLabel}：分析对象：${payload.active_scope.label || scopeLabel}。${palaceText}${scopeDetails}`;
    })
    .filter(Boolean);

  return lines.length
    ? ['完整紫微运限资料：', ...lines.map((line, index) => `${index + 1}. ${line}`)].join('\n')
    : '';
}

export function buildAstrolabeFullScopePromptText(
  contexts: Partial<Record<AstrolabeScopeMode, AstrolabeScopeContext>>,
) {
  const lines = [
    contexts.natal?.promptText,
    contexts.yearly?.promptText,
    contexts.monthly?.promptText,
    contexts.daily?.promptText,
  ]
    .filter(Boolean)
    .map((line, index) => `${index + 1}. ${line}`);

  return lines.length
    ? ['分析对象：本命盘与完整行运资料。', '完整星盘行运资料：', ...lines].join('\n')
    : '';
}

export function formatGender(value: string) {
  return value === 'male' ? '男' : value === 'female' ? '女' : value || '未知';
}

export function formatBaziDate(result: BaziChartResult) {
  return `${result.solarDate.year}-${String(result.solarDate.month).padStart(2, '0')}-${String(result.solarDate.day).padStart(2, '0')}`;
}

export function joinText(values: Array<string | undefined>, fallback = '暂无') {
  const list = values.filter(Boolean) as string[];
  return list.length > 0 ? list.join('、') : fallback;
}

export function getZiweiDisplaySurroundedPalaces(
  payload: AnalysisPayloadV1,
  selectedPalace: PalaceFact | null | undefined,
) {
  if (!selectedPalace) {
    return [];
  }

  const palaceMap = new Map(payload.palaces.map((palace) => [palace.index, palace]));
  const seen = new Set<number>();

  return selectedPalace.surrounded_palace_indexes
    .map((index) => palaceMap.get(index))
    .filter((palace): palace is PalaceFact => {
      if (!palace || palace.index === selectedPalace.index || seen.has(palace.index)) {
        return false;
      }

      seen.add(palace.index);
      return true;
    });
}

export function joinMultilineText(values: Array<string | undefined>, fallback = '暂无') {
  return joinText(values, fallback).replaceAll('、', '\n');
}

export function formatUsefulGodPrioritySummary(result: BaziChartResult) {
  const primary =
    result.analysis.usefulGod.primaryFavorableWuxing ||
    result.analysis.usefulGod.favorableWuxing?.[0] ||
    '暂无';
  const secondary = joinText(
    result.analysis.usefulGod.secondaryFavorableWuxing ||
      result.analysis.usefulGod.favorableWuxing?.slice(1) ||
      [],
    '暂无',
  );
  return `主用:${primary} / 辅助:${secondary}`;
}

export function formatAvoidGodPrioritySummary(result: BaziChartResult) {
  const primary =
    result.analysis.usefulGod.primaryUnfavorableWuxing ||
    result.analysis.usefulGod.unfavorableWuxing?.[0] ||
    '暂无';
  const secondary = joinText(
    result.analysis.usefulGod.secondaryUnfavorableWuxing ||
      result.analysis.usefulGod.unfavorableWuxing?.slice(1) ||
      [],
    '暂无',
  );
  return `主忌:${primary} / 次忌:${secondary}`;
}

export function formatZiweiPromptScopeSummary(
  scope: ZiweiScopeMode,
  dateStr: string,
  resolvedLabel?: string,
) {
  const label = resolvedLabel || ziweiScopeLabelMap[scope] || '本命';
  if (!dateStr || scope === 'origin') {
    return label;
  }

  return `${label} · ${dateStr}`;
}

export function mapBaziFortuneToZiweiScope(params: {
  scope: BaziFortuneSelectionValue['scope'];
  year?: number;
  month?: number;
  day?: number;
}) {
  switch (params.scope) {
    case 'natal':
      return { scope: 'origin' as const, dateStr: '' };
    case 'full':
      return { scope: 'full' as const, dateStr: '' };
    case 'dayun':
      return {
        scope: 'decadal' as const,
        dateStr: params.year ? `${params.year}-07-01` : '',
      };
    case 'year':
      return {
        scope: 'yearly' as const,
        dateStr: params.year ? `${params.year}-07-01` : '',
      };
    case 'month':
      return {
        scope: 'monthly' as const,
        dateStr:
          params.year && params.month
            ? `${params.year}-${String(params.month).padStart(2, '0')}-15`
            : '',
      };
    case 'day':
      return {
        scope: 'daily' as const,
        dateStr:
          params.year && params.month && params.day
            ? `${params.year}-${String(params.month).padStart(2, '0')}-${String(params.day).padStart(2, '0')}`
            : '',
      };
    default:
      return { scope: 'origin' as const, dateStr: '' };
  }
}

export function joinStarNames(stars: PalaceFact['major_stars'], fallback: string) {
  return stars.length > 0 ? stars.map((star) => star.name).join(' ') : fallback;
}

export function splitGanZhi(value: string) {
  return [value.charAt(0), value.charAt(1)];
}

export function formatMonthDayLabel(dateStr: string) {
  const [, month, day] = dateStr.split('-');
  return `${month}/${day}`;
}

export function parseZiweiDateParts(dateStr: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  try {
    const maxDay = daysInZiweiScopeMonth(year, month);
    if (day < 1 || day > maxDay) {
      return null;
    }
  } catch {
    return null;
  }

  return { year, month, day };
}

function daysInZiweiScopeMonth(year: number, month: number) {
  if (!Number.isInteger(year) || year < 1900 || year > 2200) {
    throw new Error('年份需在 1900-2200 之间。');
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('月份需在 1-12 之间。');
  }

  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function buildZiweiMonthAnchorDate(dateStr: string) {
  const parts = parseZiweiDateParts(dateStr);
  if (!parts) {
    return '';
  }

  return `${parts.year}-${String(parts.month).padStart(2, '0')}-15`;
}

export function findZiweiDecadalIndexByDate(
  decadalOptions: DecadalTimelineOption[],
  dateStr: string,
  fallbackIndex: number,
) {
  if (!dateStr || decadalOptions.length === 0) {
    return fallbackIndex;
  }

  for (let index = decadalOptions.length - 1; index >= 0; index -= 1) {
    const option = decadalOptions[index];
    if (dateStr >= option.dateStr && (!option.endDateStr || dateStr <= option.endDateStr)) {
      return index;
    }
  }

  return fallbackIndex;
}

export function findZiweiYearOptionDate(yearOptions: ZiweiYearOption[], dateStr: string) {
  const parts = parseZiweiDateParts(dateStr);
  if (!parts) {
    return yearOptions[0]?.dateStr ?? '';
  }

  return (
    yearOptions.find((item) => item.year === parts.year)?.dateStr ?? yearOptions[0]?.dateStr ?? ''
  );
}

export function findZiweiMonthOptionDate(monthOptions: ZiweiMonthOption[], dateStr: string) {
  const parts = parseZiweiDateParts(dateStr);
  if (!parts) {
    return monthOptions[0]?.dateStr ?? '';
  }

  return (
    monthOptions.find((item) => {
      const optionParts = parseZiweiDateParts(item.dateStr);
      return optionParts?.year === parts.year && optionParts?.month === parts.month;
    })?.dateStr ??
    monthOptions[0]?.dateStr ??
    ''
  );
}

export function findZiweiDayOptionDate(dayOptions: ZiweiDayOption[], dateStr: string) {
  const parts = parseZiweiDateParts(dateStr);
  if (!parts) {
    return dayOptions[0]?.dateStr ?? '';
  }

  return (
    dayOptions.find((item) => item.dateStr === dateStr)?.dateStr ?? dayOptions[0]?.dateStr ?? ''
  );
}

export function parseOptionalNumber(value: string) {
  const text = value.trim();
  if (!text) return undefined;
  if (!/^[-+]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function buildBaziFortuneSelectionValue(
  promptState: QueryPromptState,
): BaziFortuneSelectionValue {
  return {
    scope: promptState.baziFortuneScope,
    cycleIndex: parseOptionalNumber(promptState.baziFortuneCycleIndex),
    year: parseOptionalNumber(promptState.baziFortuneYear),
    month: parseOptionalNumber(promptState.baziFortuneMonth),
    day: parseOptionalNumber(promptState.baziFortuneDay),
  };
}
