import type { FortuneSource } from '../../systems/fortune';
import type { FortuneScope } from '../../systems/fortune/types';
import type { PersonalCase } from '../../v2-ui/cases-store';

export interface HomeFortunePreview {
  dateKey: string;
  label: string;
  lunarDate: string;
  solarTerm: string;
  score: number;
  tier: string;
  headline: string;
  luckyColorName: string;
  luckyColorHex: string;
}

export interface FortuneCalculatedData {
  scope: FortuneScope;
  scopeLabel: string;
  targetLabel: string;
  mode: 'personalized' | 'general';
  caseName: string | null;
  calendar: {
    targetDate: string;
    year: number;
    month: number;
    day: number;
    weekday: string;
    lunarDate: string;
    solarTerm: string;
    ganzhi: { year: string; month: string; day: string };
    nayin: { year: string; month: string; day: string };
    dayOfficer: string;
    twelveStar: string;
    twentyEightStar: string;
    nineStar: string;
    clash: string;
    recommends: string[];
    avoids: string[];
    dailyDirections: {
      joy: string;
      wealth: string;
      mascot: string;
      yangGui: string;
      yinGui: string;
    };
  };
  wuyunSummary: string | null;
  baziSummary: {
    dayMaster: string;
    dayMasterElement: string;
    strengthStatus: string;
    pattern: string;
    useful: string;
    favorableWuxing: string[];
    unfavorableWuxing: string[];
    natalPillars: { year: string; month: string; day: string; hour: string };
    dayunGanZhi: string | null;
    flowYearGanZhi: string;
    flowMonthGanZhi: string;
    flowDayGanZhi: string;
    flowTenGods: { dayun?: string; year: string; month: string; day: string };
    interactions: string[];
    shenshaHits: string[];
    precisionNote?: string;
  } | null;
  ziweiSummary: {
    yearlyPalace?: string;
    yearlyMutagens: Array<{ mutagen: string; star: string; targetPalace: string }>;
    monthlyPalace?: string;
    monthlyMutagens: Array<{ mutagen: string; star: string; targetPalace: string }>;
    dailyPalace?: string;
    dailyMutagens: Array<{ mutagen: string; star: string; targetPalace: string }>;
  } | null;
  astrolabeSummary: {
    sunSign: string;
    moonSign: string;
    ascSign: string;
    topAspects: Array<{
      movingName: string;
      aspectLabel: string;
      natalName: string;
      strength: number;
    }>;
  } | null;
  omitted: Array<{ system: string; reason: string }>;
  markdown?: string;
  overview: {
    overallScore: number;
    overallTier: string;
    headline: string;
    keywords: string[];
    scoreFactors: Array<{
      label: string;
      category: string;
      impact: number;
      sentiment: 'positive' | 'neutral' | 'caution';
      detail: string;
    }>;
    dimensions: Array<{
      id: string;
      label: string;
      score: number;
      trend: '旺' | '平' | '谨';
      summary: string;
    }>;
    actionGuide: {
      suitable: string[];
      caution: string[];
      luckyElements: {
        wuxing: string[];
        colors: string[];
        directions: string[];
        numbers: number[];
        hours?: string[];
        focusTip: string;
      };
    };
  };
  timeline: {
    hours?: Array<{
      name: string;
      range: string;
      ganzhi: string;
      twelveStar: string;
      tenGod?: string;
      rating: '吉' | '平' | '慎';
      note: string;
    }>;
    solarTerms?: Array<{ name: string; date: string; time: string }>;
    days?: Array<{
      date: string;
      day: number;
      weekday: string;
      weekdayIndex?: number;
      lunarDate: string;
      dayGanZhi: string;
      dayOfficer: string;
      twelveStar: string;
      tenGod?: string;
      score: number;
      rating: '优选' | '平稳' | '慎用';
      tag: string;
    }>;
    months?: Array<{
      monthIndex: number;
      jieName: string;
      startDate: string;
      endDate: string;
      monthGanZhi: string;
      tenGod?: string;
      ziweiPalace?: string;
      ziweiMutagens?: string[];
      score: number;
      trend: '旺' | '平' | '谨';
      note: string;
    }>;
  };
}

export interface FortuneCacheResult {
  data: FortuneCalculatedData;
  promptText: string;
  preview: HomeFortunePreview;
}

export interface FortuneQueryParams {
  scope: FortuneScope;
  year: number;
  month: number;
  day: number;
  selectedCase: PersonalCase | null;
}

const HOME_FORTUNE_PREVIEW_PREFIX = 'mingyu.home.fortune.v4:';
const GLOBAL_RULES_STORAGE_KEY = 'mingyu:global-rules:v1';
const MAX_FORTUNE_CACHE_ENTRIES = 20;

const resultCache = new Map<string, FortuneCacheResult>();
const inFlightDataRequests = new Map<string, Promise<FortuneCacheResult>>();
const inFlightPromptRequests = new Map<string, Promise<FortuneCacheResult>>();

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function toIsoRangeEndpoint(value: string): string {
  const trimmed = value.trim();
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/.exec(trimmed);
  return match ? `${match[1]}T${match[2]}+08:00` : trimmed;
}

function resolveLuckySwatchHex(colorName?: string, wuxing?: string): string {
  const sample = `${colorName ?? ''}${wuxing ?? ''}`;
  if (!sample) return '#c29347';
  if (/[青绿翠碧木]/u.test(sample)) return '#3d8b6c';
  if (/[红朱紫绯粉赤火]/u.test(sample)) return '#c44d3b';
  if (/[黄棕米驼杏金土]/u.test(sample) && !/银白|纯白/u.test(sample)) return '#c29347';
  if (/[白银金]/u.test(sample)) return '#b8b2a6';
  if (/[黑蓝灰青玄水]/u.test(sample)) return '#466c96';
  return '#8b62a8';
}

function readGlobalRulesSignature(): string {
  if (typeof window === 'undefined') return 'default';
  try {
    return window.localStorage.getItem(GLOBAL_RULES_STORAGE_KEY) || 'default';
  } catch {
    return 'default';
  }
}

function hashStringShort(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function formatTargetDateKey(scope: FortuneScope, year: number, month: number, day: number): string {
  if (scope === 'daily') return `${year}-${pad2(month)}-${pad2(day)}`;
  if (scope === 'monthly') return `${year}-${pad2(month)}`;
  return String(year);
}

export function buildFortuneCacheKey(params: FortuneQueryParams): string {
  const { scope, year, month, day, selectedCase } = params;
  const datePart = formatTargetDateKey(scope, year, month, day);
  const casePart = selectedCase
    ? `${selectedCase.id}:${selectedCase.updatedAt ?? ''}:${selectedCase.reverseSource ? 'rev' : 'std'}`
    : 'general';
  const rulesSig = hashStringShort(readGlobalRulesSignature());
  return `${scope}:${datePart}:${casePart}:${rulesSig}`;
}

export function deriveHomeFortunePreview(data: FortuneCalculatedData, dateKey: string): HomeFortunePreview {
  const ov = data.overview;
  const cal = data.calendar;
  const luckyColorName = ov.actionGuide?.luckyElements?.colors?.[0] ?? '';
  const luckyWuxing = ov.actionGuide?.luckyElements?.wuxing?.[0] ?? '';
  return {
    dateKey,
    label: data.mode === 'personalized' ? '个人日运' : '今日运势',
    lunarDate: cal?.lunarDate ?? '',
    solarTerm: cal?.solarTerm ?? '',
    score: ov.overallScore,
    tier: ov.overallTier ?? '平稳',
    headline: ov.headline ?? '',
    luckyColorName,
    luckyColorHex: resolveLuckySwatchHex(luckyColorName, luckyWuxing),
  };
}

function writePreviewToSession(cacheKey: string, preview: HomeFortunePreview): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(`${HOME_FORTUNE_PREVIEW_PREFIX}${cacheKey}`, JSON.stringify(preview));
  } catch {}
}

export function readCachedHomeFortunePreview(cacheKey: string): HomeFortunePreview | null {
  const mem = resultCache.get(cacheKey);
  if (mem) return mem.preview;
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`${HOME_FORTUNE_PREVIEW_PREFIX}${cacheKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as HomeFortunePreview;
    if (
      typeof parsed?.score === 'number' &&
      typeof parsed?.headline === 'string' &&
      typeof parsed?.luckyColorHex === 'string'
    ) {
      return parsed;
    }
  } catch {}
  return null;
}

export function getCachedFortuneResult(cacheKey: string): FortuneCacheResult | null {
  return resultCache.get(cacheKey) ?? null;
}

function setMemoryCache(cacheKey: string, entry: FortuneCacheResult): void {
  const prev = resultCache.get(cacheKey);
  const merged: FortuneCacheResult =
    prev && prev.promptText && !entry.promptText ? { ...entry, promptText: prev.promptText } : entry;
  if (resultCache.has(cacheKey)) {
    resultCache.delete(cacheKey);
  } else if (resultCache.size >= MAX_FORTUNE_CACHE_ENTRIES) {
    const oldestKey = resultCache.keys().next().value;
    if (oldestKey !== undefined) {
      resultCache.delete(oldestKey);
    }
  }
  resultCache.set(cacheKey, merged);
}

function cacheDailyPreviewIfToday(cacheKey: string, params: FortuneQueryParams, dateKey: string, preview: HomeFortunePreview) {
  if (params.scope !== 'daily') return;
  const now = new Date();
  const todayKey = formatTargetDateKey('daily', now.getFullYear(), now.getMonth() + 1, now.getDate());
  if (dateKey === todayKey) {
    writePreviewToSession(cacheKey, preview);
  }
}

export async function buildFortunePayload(params: FortuneQueryParams): Promise<Record<string, unknown>> {
  const { scope, year, month, day, selectedCase } = params;
  const target =
    scope === 'daily'
      ? { year, month, day }
      : scope === 'monthly'
        ? { year, month }
        : { year };

  const raw: Record<string, unknown> = {
    question: '请综合梳理这段时间的整体运势基调、重点机遇与注意事项。',
    scope,
    target,
    prompt: {
      topic: 'general',
      detailMode: 'compact',
      includeClassics: false,
    },
  };

  if (selectedCase) {
    if (selectedCase.reverseSource) {
      raw.birthRange = {
        start: toIsoRangeEndpoint(selectedCase.reverseSource.intervalStart),
        end: toIsoRangeEndpoint(selectedCase.reverseSource.intervalEnd),
        timezone: 8,
        pillars: selectedCase.reverseSource.pillars,
      };
    } else {
      const { toV2BirthPayload } = await import('../../v2-ui/case-birth');
      const hasKnownTime = selectedCase.timeIndex !== 'unknown';
      raw.birth = toV2BirthPayload(selectedCase, {
        method: 'bazi',
        forcePreciseBirthPlace: hasKnownTime,
      });
    }
    raw.gender = selectedCase.gender;
    if (selectedCase.name?.trim()) {
      raw.caseName = selectedCase.name.trim();
    }
    if (selectedCase.latitude !== undefined && selectedCase.longitude !== undefined) {
      raw.location = {
        latitude: selectedCase.latitude,
        longitude: selectedCase.longitude,
        ...(selectedCase.birthPlace?.trim()
          ? { locationName: selectedCase.birthPlace.trim() }
          : {}),
      };
    }
  }

  const { applyGlobalRulesToPayload } = await import('../../web-settings');
  return applyGlobalRulesToPayload('fortune', raw, true) as Record<string, unknown>;
}

/**
 * 轻量直算今日/当月/当年运势结构化盘面（跳过全量 Zod Schema 与大型 AI 提示词构建），
 * 首页与切换日期均优先走此通道实现首帧极速出数。
 */
export function loadFortuneDataOnly(params: FortuneQueryParams): Promise<FortuneCacheResult> {
  const cacheKey = buildFortuneCacheKey(params);
  const cached = resultCache.get(cacheKey);
  if (cached) {
    return Promise.resolve(cached);
  }

  const existing = inFlightDataRequests.get(cacheKey);
  if (existing) {
    return existing;
  }

  const dateKey = formatTargetDateKey(params.scope, params.year, params.month, params.day);
  const task = (async () => {
    const [payload, { fortuneDataOnly }] = await Promise.all([
      buildFortunePayload(params),
      import('../../systems/fortune'),
    ]);
    const { question, prompt: _prompt, currentTime, ...source } = payload as FortuneSource & {
      question: string;
      prompt?: unknown;
      currentTime?: string;
    };
    const data = (await fortuneDataOnly(source, question, currentTime)) as unknown as FortuneCalculatedData;
    const entry: FortuneCacheResult = {
      data,
      promptText: '',
      preview: deriveHomeFortunePreview(data, dateKey),
    };
    setMemoryCache(cacheKey, entry);
    cacheDailyPreviewIfToday(cacheKey, params, dateKey, entry.preview);
    return resultCache.get(cacheKey) ?? entry;
  })();

  inFlightDataRequests.set(cacheKey, task);
  void task.finally(() => {
    if (inFlightDataRequests.get(cacheKey) === task) {
      inFlightDataRequests.delete(cacheKey);
    }
  });
  return task;
}

/** 为运势页补充完整的 AI 提示词与追问签名（后台静默生成，不阻塞主盘面呈现）。 */
export function ensureFortunePrompt(params: FortuneQueryParams): Promise<FortuneCacheResult> {
  const cacheKey = buildFortuneCacheKey(params);
  const cached = resultCache.get(cacheKey);
  if (cached && cached.promptText) {
    return Promise.resolve(cached);
  }

  const existing = inFlightPromptRequests.get(cacheKey);
  if (existing) {
    return existing;
  }

  const dateKey = formatTargetDateKey(params.scope, params.year, params.month, params.day);
  const task = (async () => {
    const [
      payload,
      { runCalculateInBackground },
      { loadGlobalRules },
      { distillPromptForUser },
    ] = await Promise.all([
      buildFortunePayload(params),
      import('../../workers/calc-runner'),
      import('../../web-settings'),
      import('../../prompt-profile'),
    ]);

    const rules = loadGlobalRules();
    const res = (await runCalculateInBackground('fortune', payload, {
      promptGuidance: rules.prompt,
    })) as {
      data: FortuneCalculatedData;
      prompt?: { text: string };
    };

    const cleanPrompt =
      distillPromptForUser(res.prompt?.text ?? '', { includeClassics: rules.prompt.includeClassics }) ||
      res.prompt?.text ||
      '';

    const entry: FortuneCacheResult = {
      data: res.data,
      promptText: cleanPrompt,
      preview: deriveHomeFortunePreview(res.data, dateKey),
    };
    setMemoryCache(cacheKey, entry);
    cacheDailyPreviewIfToday(cacheKey, params, dateKey, entry.preview);
    return entry;
  })();

  inFlightPromptRequests.set(cacheKey, task);
  void task.finally(() => {
    if (inFlightPromptRequests.get(cacheKey) === task) {
      inFlightPromptRequests.delete(cacheKey);
    }
  });
  return task;
}
