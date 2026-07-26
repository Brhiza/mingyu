import { ASTROLABE_PROMPT_TOPICS, type AstrolabePromptTopic } from '@/lib/astrolabe-prompts';
import { BIRTH_TIME_OPTIONS } from '@/lib/birth-time';
import { getBirthDateValidationMessage } from '@/lib/date-validation';

export type ResultTabKey = 'bazi' | 'ziwei' | 'astrolabe' | 'qizheng' | 'bazhai' | 'prompt';
export type PromptSourceKey = 'bazi' | 'ziwei' | 'bazi-ziwei' | 'astrolabe' | 'qizheng' | 'bazhai';
export type BaziFortuneScope = 'natal' | 'full' | 'dayun' | 'year' | 'month' | 'day';
export type { AstrolabePromptTopic };
export type ZiweiScopeMode =
  'origin' | 'full' | 'decadal' | 'yearly' | 'monthly' | 'daily' | 'hourly';
export type AstrolabeScopeMode = 'natal' | 'full' | 'yearly' | 'monthly' | 'daily';
export type AnalysisMode = 'single' | 'compatibility';
export type ChartType = 'bazi' | 'ziwei' | 'astrolabe';

export type QueryInputState = {
  analysisMode: AnalysisMode;
  chartType: ChartType;
  name: string;
  gender: 'male' | 'female';
  dateType: 'solar' | 'lunar';
  year: string;
  month: string;
  day: string;
  timeIndex: number | '';
  isLeapMonth: boolean;
  useTrueSolarTime: boolean;
  birthHour: string;
  birthMinute: string;
  birthPlace: string;
  birthLongitude: string;
  birthLatitude: string;
  partnerName: string;
  partnerGender: 'male' | 'female';
  partnerDateType: 'solar' | 'lunar';
  partnerYear: string;
  partnerMonth: string;
  partnerDay: string;
  partnerTimeIndex: number | '';
  partnerIsLeapMonth: boolean;
  partnerUseTrueSolarTime: boolean;
  partnerBirthHour: string;
  partnerBirthMinute: string;
  partnerBirthPlace: string;
  partnerBirthLongitude: string;
  partnerBirthLatitude: string;
};

export type QueryPromptState = {
  tab: ResultTabKey;
  promptSource: PromptSourceKey;
  baziPresetId: string;
  baziShortcutMode: string;
  baziQuickQuestion: string;
  baziFortuneScope: BaziFortuneScope;
  baziFortuneCycleIndex: string;
  baziFortuneYear: string;
  baziFortuneMonth: string;
  baziFortuneDay: string;
  ziweiTopic: string;
  ziweiShortcutMode: string;
  ziweiQuickQuestion: string;
  ziweiScope: ZiweiScopeMode;
  ziweiScopeDate: string;
  astrolabeTopic: AstrolabePromptTopic;
  astrolabeShortcutMode: string;
  astrolabeQuickQuestion: string;
  astrolabeScope: AstrolabeScopeMode;
  astrolabeScopeDate: string;
  bazhaiFacingDegree: string;
  residentialHouseYear: string;
};

const BAZI_FORTUNE_SCOPES: readonly BaziFortuneScope[] = [
  'natal',
  'full',
  'dayun',
  'year',
  'month',
  'day',
];

const ZIWEI_PROMPT_TOPICS = [
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
  'life',
  'chat',
] as const;

const ZIWEI_PROMPT_SCOPES: readonly ZiweiScopeMode[] = [
  'origin',
  'full',
  'decadal',
  'yearly',
  'monthly',
  'daily',
  'hourly',
];

const ASTROLABE_PROMPT_SCOPES: readonly AstrolabeScopeMode[] = [
  'natal',
  'full',
  'yearly',
  'monthly',
  'daily',
];

const MAX_TIME_INDEX = BIRTH_TIME_OPTIONS.length - 1;

export const defaultInputState: QueryInputState = {
  analysisMode: 'single',
  chartType: 'bazi',
  name: '',
  gender: 'male',
  dateType: 'solar',
  year: '',
  month: '',
  day: '',
  timeIndex: '',
  isLeapMonth: false,
  useTrueSolarTime: false,
  birthHour: '',
  birthMinute: '',
  birthPlace: '',
  birthLongitude: '',
  birthLatitude: '',
  partnerName: '',
  partnerGender: 'female',
  partnerDateType: 'solar',
  partnerYear: '',
  partnerMonth: '',
  partnerDay: '',
  partnerTimeIndex: '',
  partnerIsLeapMonth: false,
  partnerUseTrueSolarTime: false,
  partnerBirthHour: '',
  partnerBirthMinute: '',
  partnerBirthPlace: '',
  partnerBirthLongitude: '',
  partnerBirthLatitude: '',
};

export const defaultPromptState: QueryPromptState = {
  tab: 'prompt',
  promptSource: 'bazi',
  baziPresetId: 'ai-mingge-zonglun',
  baziShortcutMode: '自定义',
  baziQuickQuestion: '',
  baziFortuneScope: 'natal',
  baziFortuneCycleIndex: '',
  baziFortuneYear: '',
  baziFortuneMonth: '',
  baziFortuneDay: '',
  ziweiTopic: 'chat',
  ziweiShortcutMode: '自定义',
  ziweiQuickQuestion: '',
  ziweiScope: 'origin',
  ziweiScopeDate: '',
  astrolabeTopic: 'life',
  astrolabeShortcutMode: '综合',
  astrolabeQuickQuestion: '',
  astrolabeScope: 'natal',
  astrolabeScopeDate: '',
  bazhaiFacingDegree: '',
  residentialHouseYear: '',
};

export function hasCompletePreciseBirthData(
  input: Pick<
    QueryInputState,
    | 'analysisMode'
    | 'useTrueSolarTime'
    | 'birthHour'
    | 'birthMinute'
    | 'birthPlace'
    | 'birthLongitude'
    | 'birthLatitude'
  >,
) {
  return (
    input.analysisMode === 'single' &&
    input.useTrueSolarTime &&
    input.birthHour !== '' &&
    input.birthMinute !== '' &&
    input.birthPlace.trim() !== '' &&
    input.birthLongitude !== '' &&
    input.birthLatitude !== ''
  );
}

const INPUT_PARAM_KEYS: Record<keyof QueryInputState, string> = {
  analysisMode: 'a',
  chartType: 'c',
  name: 'n',
  gender: 'g',
  dateType: 'dt',
  year: 'y',
  month: 'm',
  day: 'd',
  timeIndex: 'ti',
  isLeapMonth: 'lm',
  useTrueSolarTime: 'ts',
  birthHour: 'bh',
  birthMinute: 'bm',
  birthPlace: 'bp',
  birthLongitude: 'lo',
  birthLatitude: 'la',
  partnerName: 'pn',
  partnerGender: 'pg',
  partnerDateType: 'pdt',
  partnerYear: 'py',
  partnerMonth: 'pm',
  partnerDay: 'pd',
  partnerTimeIndex: 'pti',
  partnerIsLeapMonth: 'plm',
  partnerUseTrueSolarTime: 'pts',
  partnerBirthHour: 'pbh',
  partnerBirthMinute: 'pbm',
  partnerBirthPlace: 'pbp',
  partnerBirthLongitude: 'plo',
  partnerBirthLatitude: 'pla',
};

const PROMPT_PARAM_KEYS: Record<keyof QueryPromptState, string> = {
  tab: 't',
  promptSource: 'ps',
  baziPresetId: 'bid',
  baziShortcutMode: 'bsm',
  baziQuickQuestion: 'bq',
  baziFortuneScope: 'bfs',
  baziFortuneCycleIndex: 'bci',
  baziFortuneYear: 'bfy',
  baziFortuneMonth: 'bfm',
  baziFortuneDay: 'bfd',
  ziweiTopic: 'zt',
  ziweiShortcutMode: 'zsm',
  ziweiQuickQuestion: 'zq',
  ziweiScope: 'zs',
  ziweiScopeDate: 'zsd',
  astrolabeTopic: 'at',
  astrolabeShortcutMode: 'asm',
  astrolabeQuickQuestion: 'aq',
  astrolabeScope: 'as',
  astrolabeScopeDate: 'asd',
  bazhaiFacingDegree: 'bhd',
  residentialHouseYear: 'rhy',
};

const PARAM_KEY_ALIASES: Record<string, string> = {
  ...INPUT_PARAM_KEYS,
  ...PROMPT_PARAM_KEYS,
};

function toParamValue(value: string | number | boolean) {
  return typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
}

function setCompactParam(
  params: URLSearchParams,
  key: string,
  value: string | number | boolean,
  fallback: string | number | boolean,
) {
  const nextValue = toParamValue(value);
  if (!nextValue || nextValue === toParamValue(fallback)) {
    return;
  }

  params.set(PARAM_KEY_ALIASES[key] ?? key, nextValue);
}

function appendInputStateParams(params: URLSearchParams, input: QueryInputState) {
  setCompactParam(params, 'analysisMode', input.analysisMode, defaultInputState.analysisMode);
  setCompactParam(params, 'chartType', input.chartType, defaultInputState.chartType);
  setCompactParam(params, 'name', input.name, defaultInputState.name);
  setCompactParam(params, 'gender', input.gender, defaultInputState.gender);
  setCompactParam(params, 'dateType', input.dateType, defaultInputState.dateType);
  setCompactParam(params, 'year', input.year, defaultInputState.year);
  setCompactParam(params, 'month', input.month, defaultInputState.month);
  setCompactParam(params, 'day', input.day, defaultInputState.day);
  setCompactParam(params, 'timeIndex', input.timeIndex, defaultInputState.timeIndex);
  setCompactParam(params, 'isLeapMonth', input.isLeapMonth, defaultInputState.isLeapMonth);
  setCompactParam(
    params,
    'useTrueSolarTime',
    input.useTrueSolarTime,
    defaultInputState.useTrueSolarTime,
  );
  setCompactParam(params, 'birthHour', input.birthHour, defaultInputState.birthHour);
  setCompactParam(params, 'birthMinute', input.birthMinute, defaultInputState.birthMinute);
  setCompactParam(params, 'birthPlace', input.birthPlace, defaultInputState.birthPlace);
  setCompactParam(params, 'birthLongitude', input.birthLongitude, defaultInputState.birthLongitude);
  setCompactParam(params, 'birthLatitude', input.birthLatitude, defaultInputState.birthLatitude);
  setCompactParam(params, 'partnerName', input.partnerName, defaultInputState.partnerName);
  setCompactParam(params, 'partnerGender', input.partnerGender, defaultInputState.partnerGender);
  setCompactParam(
    params,
    'partnerDateType',
    input.partnerDateType,
    defaultInputState.partnerDateType,
  );
  setCompactParam(params, 'partnerYear', input.partnerYear, defaultInputState.partnerYear);
  setCompactParam(params, 'partnerMonth', input.partnerMonth, defaultInputState.partnerMonth);
  setCompactParam(params, 'partnerDay', input.partnerDay, defaultInputState.partnerDay);
  setCompactParam(
    params,
    'partnerTimeIndex',
    input.partnerTimeIndex,
    defaultInputState.partnerTimeIndex,
  );
  setCompactParam(
    params,
    'partnerIsLeapMonth',
    input.partnerIsLeapMonth,
    defaultInputState.partnerIsLeapMonth,
  );
  setCompactParam(
    params,
    'partnerUseTrueSolarTime',
    input.partnerUseTrueSolarTime,
    defaultInputState.partnerUseTrueSolarTime,
  );
  setCompactParam(
    params,
    'partnerBirthHour',
    input.partnerBirthHour,
    defaultInputState.partnerBirthHour,
  );
  setCompactParam(
    params,
    'partnerBirthMinute',
    input.partnerBirthMinute,
    defaultInputState.partnerBirthMinute,
  );
  setCompactParam(
    params,
    'partnerBirthPlace',
    input.partnerBirthPlace,
    defaultInputState.partnerBirthPlace,
  );
  setCompactParam(
    params,
    'partnerBirthLongitude',
    input.partnerBirthLongitude,
    defaultInputState.partnerBirthLongitude,
  );
  setCompactParam(
    params,
    'partnerBirthLatitude',
    input.partnerBirthLatitude,
    defaultInputState.partnerBirthLatitude,
  );
}

function appendPromptStateParams(params: URLSearchParams, prompt: QueryPromptState) {
  setCompactParam(params, 'tab', prompt.tab, defaultPromptState.tab);
  setCompactParam(params, 'promptSource', prompt.promptSource, defaultPromptState.promptSource);
  setCompactParam(params, 'baziPresetId', prompt.baziPresetId, defaultPromptState.baziPresetId);
  setCompactParam(
    params,
    'baziShortcutMode',
    prompt.baziShortcutMode,
    defaultPromptState.baziShortcutMode,
  );
  setCompactParam(
    params,
    'baziFortuneScope',
    prompt.baziFortuneScope,
    defaultPromptState.baziFortuneScope,
  );
  setCompactParam(
    params,
    'baziFortuneCycleIndex',
    prompt.baziFortuneCycleIndex,
    defaultPromptState.baziFortuneCycleIndex,
  );
  setCompactParam(
    params,
    'baziFortuneYear',
    prompt.baziFortuneYear,
    defaultPromptState.baziFortuneYear,
  );
  setCompactParam(
    params,
    'baziFortuneMonth',
    prompt.baziFortuneMonth,
    defaultPromptState.baziFortuneMonth,
  );
  setCompactParam(
    params,
    'baziFortuneDay',
    prompt.baziFortuneDay,
    defaultPromptState.baziFortuneDay,
  );
  setCompactParam(params, 'ziweiTopic', prompt.ziweiTopic, defaultPromptState.ziweiTopic);
  setCompactParam(
    params,
    'ziweiShortcutMode',
    prompt.ziweiShortcutMode,
    defaultPromptState.ziweiShortcutMode,
  );
  setCompactParam(params, 'ziweiScope', prompt.ziweiScope, defaultPromptState.ziweiScope);
  setCompactParam(
    params,
    'ziweiScopeDate',
    prompt.ziweiScopeDate,
    defaultPromptState.ziweiScopeDate,
  );
  setCompactParam(
    params,
    'astrolabeTopic',
    prompt.astrolabeTopic,
    defaultPromptState.astrolabeTopic,
  );
  setCompactParam(
    params,
    'astrolabeShortcutMode',
    prompt.astrolabeShortcutMode,
    defaultPromptState.astrolabeShortcutMode,
  );
  setCompactParam(
    params,
    'astrolabeScope',
    prompt.astrolabeScope,
    defaultPromptState.astrolabeScope,
  );
  setCompactParam(
    params,
    'astrolabeScopeDate',
    prompt.astrolabeScopeDate,
    defaultPromptState.astrolabeScopeDate,
  );
  setCompactParam(
    params,
    'bazhaiFacingDegree',
    prompt.bazhaiFacingDegree,
    defaultPromptState.bazhaiFacingDegree,
  );
  setCompactParam(
    params,
    'residentialHouseYear',
    prompt.residentialHouseYear,
    defaultPromptState.residentialHouseYear,
  );
}

function getString(params: URLSearchParams, key: string, fallback: string) {
  const shortKey = PARAM_KEY_ALIASES[key];
  return (shortKey ? params.get(shortKey) : null) ?? params.get(key) ?? fallback;
}

function parseTimeIndex(value: string) {
  if (value === '') {
    return '';
  }

  if (!/^-?\d+$/.test(value)) {
    return '';
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= MAX_TIME_INDEX ? parsed : '';
}

function parseIntegerText(value: string, min: number, max: number) {
  if (!/^\d+$/.test(value)) {
    return '';
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? value : '';
}

function parseDecimalText(value: string, min: number, max: number) {
  if (!/^-?(?:\d+|\d*\.\d+)$/.test(value)) {
    return '';
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? value : '';
}

function parseBirthDateFields(params: {
  year: string;
  month: string;
  day: string;
  dateType: 'solar' | 'lunar';
  isLeapMonth: boolean;
}) {
  const year = parseIntegerText(params.year, 1900, 2100);
  const month = parseIntegerText(params.month, 1, 12);
  const day = parseIntegerText(params.day, 1, params.dateType === 'lunar' ? 30 : 31);

  if (!year || !month || !day) {
    return { year, month, day };
  }

  const validationMessage = getBirthDateValidationMessage({
    year: Number(year),
    month: Number(month),
    day: Number(day),
    dateType: params.dateType,
    isLeapMonth: params.isLeapMonth,
  });

  if (!validationMessage) {
    return { year, month, day };
  }

  if (validationMessage.includes('年份')) {
    return { year: '', month, day };
  }
  if (validationMessage.includes('月份') || validationMessage.includes('农历日期不存在')) {
    return { year, month: '', day: '' };
  }
  return { year, month, day: '' };
}

function parseBirthHour(value: string) {
  return parseIntegerText(value, 0, 23);
}

function parseBirthMinute(value: string) {
  return parseIntegerText(value, 0, 59);
}

function parseLongitude(value: string) {
  return parseDecimalText(value, -180, 180);
}

function parseLatitude(value: string) {
  return parseDecimalText(value, -90, 90);
}

function parseBaziFortuneScope(value: string): BaziFortuneScope {
  if (BAZI_FORTUNE_SCOPES.includes(value as BaziFortuneScope)) {
    return value as BaziFortuneScope;
  }
  return defaultPromptState.baziFortuneScope;
}

function parseZiweiTopic(value: string) {
  if (ZIWEI_PROMPT_TOPICS.includes(value as (typeof ZIWEI_PROMPT_TOPICS)[number])) {
    return value;
  }
  return defaultPromptState.ziweiTopic;
}

function parseZiweiScope(value: string): ZiweiScopeMode {
  if (ZIWEI_PROMPT_SCOPES.includes(value as ZiweiScopeMode)) {
    return value as ZiweiScopeMode;
  }
  return defaultPromptState.ziweiScope;
}

function parseAstrolabeTopic(value: string): AstrolabePromptTopic {
  if (ASTROLABE_PROMPT_TOPICS.includes(value as AstrolabePromptTopic)) {
    return value as AstrolabePromptTopic;
  }
  return defaultPromptState.astrolabeTopic;
}

function parseAstrolabeScope(value: string): AstrolabeScopeMode {
  if (ASTROLABE_PROMPT_SCOPES.includes(value as AstrolabeScopeMode)) {
    return value as AstrolabeScopeMode;
  }
  return defaultPromptState.astrolabeScope;
}

function parseScopeDateParts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  try {
    const maxDay = daysInScopeMonth(year, month);
    if (day < 1 || day > maxDay) {
      return null;
    }
  } catch {
    return null;
  }

  return { year, month, day };
}

function isValidScopeYearText(value: string) {
  return /^\d{4}$/.test(value) && Number(value) >= 1900 && Number(value) <= 2200;
}

function isValidScopeMonthText(value: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }

  try {
    daysInScopeMonth(Number(match[1]), Number(match[2]));
    return true;
  } catch {
    return false;
  }
}

function daysInScopeMonth(year: number, month: number) {
  if (!Number.isInteger(year) || year < 1900 || year > 2200) {
    throw new Error('年份需在 1900-2200 之间。');
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('月份需在 1-12 之间。');
  }

  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function normalizeZiweiScopeDate(scope: ZiweiScopeMode, dateStr: string) {
  if (scope === 'origin' || scope === 'full' || !dateStr) {
    return '';
  }

  return parseScopeDateParts(dateStr) ? dateStr : '';
}

function normalizeAstrolabeScopeDate(scope: AstrolabeScopeMode, dateStr: string) {
  if (scope === 'natal' || !dateStr) {
    return '';
  }

  if (scope === 'full') {
    return parseScopeDateParts(dateStr) ? dateStr : '';
  }

  if (scope === 'yearly') {
    return isValidScopeYearText(dateStr) ? dateStr : '';
  }
  if (scope === 'monthly') {
    return isValidScopeMonthText(dateStr) ? dateStr : '';
  }

  return parseScopeDateParts(dateStr) ? dateStr : '';
}

function normalizePromptState(prompt: QueryPromptState): QueryPromptState {
  const normalized: QueryPromptState = { ...prompt };

  if (normalized.ziweiShortcutMode === '自定义') {
    normalized.ziweiTopic = 'chat';
  }

  normalized.ziweiScopeDate = normalizeZiweiScopeDate(
    normalized.ziweiScope,
    normalized.ziweiScopeDate,
  );

  if (normalized.astrolabeShortcutMode === '自定义') {
    normalized.astrolabeTopic = 'chat';
  }

  normalized.astrolabeScopeDate = normalizeAstrolabeScopeDate(
    normalized.astrolabeScope,
    normalized.astrolabeScopeDate,
  );
  if (normalized.astrolabeScope !== 'natal' && !normalized.astrolabeScopeDate) {
    normalized.astrolabeScope = 'natal';
  }

  if (normalized.baziFortuneScope === 'natal' || normalized.baziFortuneScope === 'full') {
    normalized.baziFortuneCycleIndex = '';
    normalized.baziFortuneYear = '';
    normalized.baziFortuneMonth = '';
    normalized.baziFortuneDay = '';
  }

  if (normalized.baziFortuneScope === 'dayun') {
    normalized.baziFortuneYear = '';
    normalized.baziFortuneMonth = '';
    normalized.baziFortuneDay = '';
  }

  if (normalized.baziFortuneScope === 'year') {
    normalized.baziFortuneMonth = '';
    normalized.baziFortuneDay = '';
  }

  if (normalized.baziFortuneScope === 'month') {
    normalized.baziFortuneDay = '';
  }

  return normalized;
}

export function parseInputState(params: URLSearchParams): QueryInputState {
  const dateType =
    getString(params, 'dateType', defaultInputState.dateType) === 'lunar' ? 'lunar' : 'solar';
  const isLeapMonth = getString(params, 'isLeapMonth', '0') === '1';
  const birthDate = parseBirthDateFields({
    year: getString(params, 'year', defaultInputState.year),
    month: getString(params, 'month', defaultInputState.month),
    day: getString(params, 'day', defaultInputState.day),
    dateType,
    isLeapMonth,
  });
  const partnerDateType =
    getString(params, 'partnerDateType', defaultInputState.partnerDateType) === 'lunar'
      ? 'lunar'
      : 'solar';
  const partnerIsLeapMonth = getString(params, 'partnerIsLeapMonth', '0') === '1';
  const partnerBirthDate = parseBirthDateFields({
    year: getString(params, 'partnerYear', defaultInputState.partnerYear),
    month: getString(params, 'partnerMonth', defaultInputState.partnerMonth),
    day: getString(params, 'partnerDay', defaultInputState.partnerDay),
    dateType: partnerDateType,
    isLeapMonth: partnerIsLeapMonth,
  });

  return {
    analysisMode:
      getString(params, 'analysisMode', defaultInputState.analysisMode) === 'compatibility'
        ? 'compatibility'
        : 'single',
    chartType:
      getString(params, 'chartType', defaultInputState.chartType) === 'ziwei'
        ? 'ziwei'
        : getString(params, 'chartType', defaultInputState.chartType) === 'astrolabe'
          ? 'astrolabe'
          : 'bazi',
    name: getString(params, 'name', defaultInputState.name),
    gender: getString(params, 'gender', defaultInputState.gender) === 'female' ? 'female' : 'male',
    dateType,
    year: birthDate.year,
    month: birthDate.month,
    day: birthDate.day,
    timeIndex: parseTimeIndex(getString(params, 'timeIndex', String(defaultInputState.timeIndex))),
    isLeapMonth,
    useTrueSolarTime: getString(params, 'useTrueSolarTime', '0') === '1',
    birthHour: parseBirthHour(getString(params, 'birthHour', defaultInputState.birthHour)),
    birthMinute: parseBirthMinute(getString(params, 'birthMinute', defaultInputState.birthMinute)),
    birthPlace: getString(params, 'birthPlace', defaultInputState.birthPlace),
    birthLongitude: parseLongitude(
      getString(params, 'birthLongitude', defaultInputState.birthLongitude),
    ),
    birthLatitude: parseLatitude(
      getString(params, 'birthLatitude', defaultInputState.birthLatitude),
    ),
    partnerName: getString(params, 'partnerName', defaultInputState.partnerName),
    partnerGender:
      getString(params, 'partnerGender', defaultInputState.partnerGender) === 'male'
        ? 'male'
        : 'female',
    partnerDateType,
    partnerYear: partnerBirthDate.year,
    partnerMonth: partnerBirthDate.month,
    partnerDay: partnerBirthDate.day,
    partnerTimeIndex: parseTimeIndex(
      getString(params, 'partnerTimeIndex', String(defaultInputState.partnerTimeIndex)),
    ),
    partnerIsLeapMonth,
    partnerUseTrueSolarTime: getString(params, 'partnerUseTrueSolarTime', '0') === '1',
    partnerBirthHour: parseBirthHour(
      getString(params, 'partnerBirthHour', defaultInputState.partnerBirthHour),
    ),
    partnerBirthMinute: parseBirthMinute(
      getString(params, 'partnerBirthMinute', defaultInputState.partnerBirthMinute),
    ),
    partnerBirthPlace: getString(params, 'partnerBirthPlace', defaultInputState.partnerBirthPlace),
    partnerBirthLongitude: parseLongitude(
      getString(params, 'partnerBirthLongitude', defaultInputState.partnerBirthLongitude),
    ),
    partnerBirthLatitude: parseLatitude(
      getString(params, 'partnerBirthLatitude', defaultInputState.partnerBirthLatitude),
    ),
  };
}

export function buildInputSearch(params: URLSearchParams) {
  const input = parseInputState(params);
  const snapshot = new URLSearchParams();

  appendInputStateParams(snapshot, input);

  return snapshot.toString();
}

export function parsePromptState(params: URLSearchParams): QueryPromptState {
  const rawTab = getString(params, 'tab', defaultPromptState.tab);
  const tab: ResultTabKey =
    rawTab === 'bazi' ||
    rawTab === 'ziwei' ||
    rawTab === 'astrolabe' ||
    rawTab === 'qizheng' ||
    rawTab === 'bazhai' ||
    rawTab === 'residential' ||
    rawTab === 'prompt'
      ? rawTab === 'residential'
        ? 'bazhai'
        : rawTab
      : defaultPromptState.tab;
  const rawPromptSource = getString(params, 'promptSource', defaultPromptState.promptSource);
  const promptSource: PromptSourceKey =
    rawPromptSource === 'ziwei' ||
    rawPromptSource === 'bazi-ziwei' ||
    rawPromptSource === 'astrolabe' ||
    rawPromptSource === 'qizheng' ||
    rawPromptSource === 'bazhai' ||
    rawPromptSource === 'residential'
      ? rawPromptSource === 'residential'
        ? 'bazhai'
        : rawPromptSource
      : 'bazi';

  return normalizePromptState({
    tab,
    promptSource,
    baziPresetId: getString(params, 'baziPresetId', defaultPromptState.baziPresetId),
    baziShortcutMode: getString(params, 'baziShortcutMode', defaultPromptState.baziShortcutMode),
    baziQuickQuestion: getString(params, 'baziQuickQuestion', defaultPromptState.baziQuickQuestion),
    baziFortuneScope: parseBaziFortuneScope(
      getString(params, 'baziFortuneScope', defaultPromptState.baziFortuneScope),
    ),
    baziFortuneCycleIndex: getString(
      params,
      'baziFortuneCycleIndex',
      defaultPromptState.baziFortuneCycleIndex,
    ),
    baziFortuneYear: getString(params, 'baziFortuneYear', defaultPromptState.baziFortuneYear),
    baziFortuneMonth: getString(params, 'baziFortuneMonth', defaultPromptState.baziFortuneMonth),
    baziFortuneDay: getString(params, 'baziFortuneDay', defaultPromptState.baziFortuneDay),
    ziweiTopic: parseZiweiTopic(getString(params, 'ziweiTopic', defaultPromptState.ziweiTopic)),
    ziweiShortcutMode: getString(params, 'ziweiShortcutMode', defaultPromptState.ziweiShortcutMode),
    ziweiQuickQuestion: getString(
      params,
      'ziweiQuickQuestion',
      defaultPromptState.ziweiQuickQuestion,
    ),
    ziweiScope: parseZiweiScope(getString(params, 'ziweiScope', defaultPromptState.ziweiScope)),
    ziweiScopeDate: getString(params, 'ziweiScopeDate', defaultPromptState.ziweiScopeDate),
    astrolabeTopic: parseAstrolabeTopic(
      getString(params, 'astrolabeTopic', defaultPromptState.astrolabeTopic),
    ),
    astrolabeShortcutMode: getString(
      params,
      'astrolabeShortcutMode',
      defaultPromptState.astrolabeShortcutMode,
    ),
    astrolabeQuickQuestion: getString(
      params,
      'astrolabeQuickQuestion',
      defaultPromptState.astrolabeQuickQuestion,
    ),
    astrolabeScope: parseAstrolabeScope(
      getString(params, 'astrolabeScope', defaultPromptState.astrolabeScope),
    ),
    astrolabeScopeDate: getString(
      params,
      'astrolabeScopeDate',
      defaultPromptState.astrolabeScopeDate,
    ),
    bazhaiFacingDegree: parseDecimalText(
      getString(params, 'bazhaiFacingDegree', defaultPromptState.bazhaiFacingDegree),
      0,
      360,
    ),
    residentialHouseYear: parseDecimalText(
      getString(params, 'residentialHouseYear', defaultPromptState.residentialHouseYear),
      1,
      9999,
    ),
  });
}

export function buildResultSearch(
  input: QueryInputState,
  prompt: QueryPromptState = defaultPromptState,
) {
  const params = new URLSearchParams();
  const normalizedPrompt = normalizePromptState(prompt);
  appendInputStateParams(params, input);
  appendPromptStateParams(params, normalizedPrompt);

  return params.toString();
}

export function buildInputStateSearch(input: QueryInputState) {
  const params = new URLSearchParams();
  appendInputStateParams(params, input);
  return params.toString();
}
