import type { DecadalTimelineOption } from '@core/ziwei/iztro';
import { formatPromptCurrentTime } from '@/lib/prompt-time';
import type { AstrolabeScopeMode, QueryPromptState, ZiweiScopeMode } from '@/lib/query-state';
import type { AstrolabePromptTopic } from '@/lib/astrolabe-prompts';
import { buildPortablePromptPack, type PromptContext } from '@/lib/ziwei-prompts';
import { getBaziDefaultQuestion } from '@/lib/prompt-default-questions';
import { formatBaziForPrompt } from '@core/bazi/baziAnalysisFormatter';
import type { AnalysisPayloadV1, ScopeType } from '@/types/analysis';
import type { AstrolabeScopeContext } from '@/lib/astrolabe-scope';
import type { PalaceFact } from '@/types/analysis';
import type { BaziChartResult } from '@core/bazi/baziTypes';
import type { BaziFortuneSelectionValue } from '@core/bazi/fortuneSelection';
import { buildBaziQuestionGuidanceSection } from '@/utils/ai/baziPromptGuidance';
import { safeStorage } from '@/lib/safe-storage';
import { ASTROLABE_SHORTCUT_ACTIONS } from '@/lib/astrolabe-prompts';
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
  return [system, '', user].join('\n');
}

export function buildEnhancedZiweiPromptPack(payload: AnalysisPayloadV1, selectedTopic: string) {
  const reportContext: PromptContext = {
    report_key: `enhanced:${selectedTopic}:${payload.active_scope.scope}:${payload.active_scope.solar_date}`,
    report_title: '紫微交叉校验资料',
    report_type: 'enhanced',
    selected_topic: selectedTopic,
    scope_type: payload.active_scope.scope,
    scope_label: payload.active_scope.label,
    focus_notes: ['本资料用于与八字结论交叉校验，不单独脱离问题做空泛总论。'],
  };

  return buildPortablePromptPack({
    payload,
    reportContext,
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
    '你是一位同时熟悉八字与紫微斗数的资深命理分析师，擅长先用八字判断命局结构与岁运主线，再用紫微斗数校验宫位主轴、四化触发与运限落点。',
    '【要求】',
    '- 只基于提供的八字排盘、紫微盘面和问题作答。',
    '- 先用八字判断长期底色、用神喜忌、结构强弱和当前触发，再用紫微校验对应宫位、四化、三方四正和运限呼应。',
    '- 两套体系结论一致时可以增强结论；出现分歧时必须指出哪一侧证据更强、另一侧对应的条件与待核验点。',
    '- 不得编造已提供资料没有给出的新盘面事实；允许基于已提供资料做传统命理推理，但必须标明来自八字原局、岁运、紫微宫位、四化、运限或现实补充信息。',
    '- 年份、月份、日期或年龄只有出现在【分析对象】或已提供资料中，才可作为当前年限运限依据。',
    '- 不要平均复述两套盘面资料，优先提炼最能回答【问题】的核心证据。',
    '- 使用简体中文，不写空话；证据不足处直接说明。',
    '',
    `【当前时间】\n${formatPromptCurrentTime()}`,
    sourceLabels.length > 0 ? `【分析对象】\n${sourceLabels.join('\n')}` : '',
    questionScopeLabel && questionScopeLabel !== '通用'
      ? `【问题范围】\n${questionScopeLabel}`
      : '',
    `【八字排盘信息】\n${baziText}`,
    `【紫微盘面信息】\n${params.ziweiText}`,
    `【问题】\n${normalizedQuestion}`,
    ...(isCustomQuestion
      ? []
      : [
          `【断盘要点】\n${buildBaziQuestionGuidanceSection(Boolean(params.baziFortuneSummary))}`,
          '【解读范围】\n如果【分析对象】已经给出八字年限或紫微范围，必须优先围绕该对象分析；如果【问题】中的时间与分析对象不一致，开头先提醒不一致，再以分析对象为准；应期判断必须说明来自本命底色、阶段运限、年度触发、月度窗口还是日时短期触发。',
          '【任务】\n先用八字判断命局主线、结构强弱、喜忌取用与当前触发，再用紫微校验对应宫位主轴、四化牵动、三方四正和运限落点，最后整合成一致结论、冲突点与现实建议。',
          '【输出要求】\n先直接回答【问题】，再按“八字主线”“紫微校验”“综合结论与建议”展开；每部分都要写明主证、辅证、反证或限制、触发条件与建议；若两套体系存在冲突，单列“冲突点与待核验项”。',
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
    .map((item) =>
      [item.star ? `${item.star}化${item.mutagen}` : `化${item.mutagen}`, item.palace_name]
        .filter(Boolean)
        .join('入'),
    )
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
              `当前四化：${formatZiweiMutagenMap(payload)}。`,
              `运限命中：${formatZiweiScopeHits(payload)}。`,
            ].join('');

      return `${scopeLabel}：分析对象：${payload.active_scope.label || scopeLabel}。${dateText}${ageText}${palaceText}${scopeDetails}`;
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

export function buildCompatibilityPromptWithUnknownTime(params: {
  firstName: string;
  firstText: string;
  secondName: string;
  secondText: string;
  question: string;
  isCustomQuestion?: boolean;
}) {
  const isCustomQuestion = Boolean(params.isCustomQuestion);
  return [
    '你是资深八字命理师，当前合盘信息里至少有一方出生时辰未知，请只做保守分析。',
    '【要求】',
    '- 只基于提供的双方信息作答。',
    '- 其中带“时辰未知”的一方只能按三柱理解，不得自行补足时柱。',
    '- 不得编造资料里没有给出的新盘面事实；允许基于三柱和已知资料做保守推理，但必须标明证据来源。',
    '- 凡是明显依赖时柱、子女宫或更细时限的判断，都要标记为待确认。',
    ...(isCustomQuestion
      ? []
      : [
          '- 先直接回答【问题】，并区分当前能确认的主线与因时辰未知而待确认的部分。',
          '- 最后补充最值得继续核验的时辰线索。',
        ]),
    '',
    `【当前时间】\n${formatPromptCurrentTime()}`,
    `【第一人排盘信息】\n姓名：${params.firstName}\n${params.firstText}`,
    '',
    `【第二人排盘信息】\n姓名：${params.secondName}\n${params.secondText}`,
    '',
    `【问题】\n${params.question.trim() || '请先做整体合盘解读。'}`,
    ...(isCustomQuestion
      ? []
      : [
          '【任务】\n请结合双方已知信息，先做保守分析，并明确哪些部分需要等时辰确认后再细化。',
          '【输出要求】\n先直接回答【问题】，再分成“可确认部分”“待确认部分”“建议继续核验的线索”三段；每段尽量写明对应依据、触发条件与建议；证据不足时直接说明；用简体中文。',
        ]),
  ].join('\n');
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
    if (dateStr >= decadalOptions[index].dateStr) {
      return index;
    }
  }

  return 0;
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
