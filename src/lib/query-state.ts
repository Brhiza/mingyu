export type ResultTabKey = 'bazi' | 'ziwei' | 'prompt';
export type PromptSourceKey = 'bazi' | 'ziwei';
export type BaziFortuneScope = 'natal' | 'dayun' | 'year' | 'month' | 'day';
export type ZiweiScopeMode = 'origin' | 'decadal' | 'yearly' | 'monthly' | 'daily' | 'hourly';
export type AnalysisMode = 'single' | 'compatibility';

export type QueryInputState = {
  analysisMode: AnalysisMode;
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
};

export const UNKNOWN_TIME_INDEX = -1;

export const defaultInputState: QueryInputState = {
  analysisMode: 'single',
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
  ziweiTopic: 'destiny',
  ziweiShortcutMode: '自定义',
  ziweiQuickQuestion: '',
  ziweiScope: 'origin',
};

function appendInputStateParams(params: URLSearchParams, input: QueryInputState) {
  params.set('analysisMode', input.analysisMode);
  params.set('name', input.name);
  params.set('gender', input.gender);
  params.set('dateType', input.dateType);
  params.set('year', input.year);
  params.set('month', input.month);
  params.set('day', input.day);
  params.set('timeIndex', String(input.timeIndex));
  params.set('isLeapMonth', input.isLeapMonth ? '1' : '0');
  params.set('useTrueSolarTime', input.useTrueSolarTime ? '1' : '0');
  params.set('birthHour', input.birthHour);
  params.set('birthMinute', input.birthMinute);
  params.set('birthPlace', input.birthPlace);
  params.set('birthLongitude', input.birthLongitude);
  params.set('partnerName', input.partnerName);
  params.set('partnerGender', input.partnerGender);
  params.set('partnerDateType', input.partnerDateType);
  params.set('partnerYear', input.partnerYear);
  params.set('partnerMonth', input.partnerMonth);
  params.set('partnerDay', input.partnerDay);
  params.set('partnerTimeIndex', String(input.partnerTimeIndex));
  params.set('partnerIsLeapMonth', input.partnerIsLeapMonth ? '1' : '0');
  params.set('partnerUseTrueSolarTime', input.partnerUseTrueSolarTime ? '1' : '0');
  params.set('partnerBirthHour', input.partnerBirthHour);
  params.set('partnerBirthMinute', input.partnerBirthMinute);
  params.set('partnerBirthPlace', input.partnerBirthPlace);
  params.set('partnerBirthLongitude', input.partnerBirthLongitude);
}

function appendPromptStateParams(params: URLSearchParams, prompt: QueryPromptState) {
  params.set('tab', prompt.tab);
  params.set('promptSource', prompt.promptSource);
  params.set('baziPresetId', prompt.baziPresetId);
  params.set('baziShortcutMode', prompt.baziShortcutMode);
  params.set('baziFortuneScope', prompt.baziFortuneScope);
  params.set('baziFortuneCycleIndex', prompt.baziFortuneCycleIndex);
  params.set('baziFortuneYear', prompt.baziFortuneYear);
  params.set('baziFortuneMonth', prompt.baziFortuneMonth);
  params.set('baziFortuneDay', prompt.baziFortuneDay);
  params.set('ziweiTopic', prompt.ziweiTopic);
  params.set('ziweiShortcutMode', prompt.ziweiShortcutMode);
  params.set('ziweiScope', prompt.ziweiScope);
}

function getString(params: URLSearchParams, key: string, fallback: string) {
  return params.get(key) ?? fallback;
}

function parseTimeIndex(value: string) {
  if (value === '') {
    return '';
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= UNKNOWN_TIME_INDEX ? parsed : '';
}

export function buildBirthDate(year: string, month: string, day: string) {
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function parseInputState(params: URLSearchParams): QueryInputState {
  return {
    analysisMode:
      getString(params, 'analysisMode', defaultInputState.analysisMode) === 'compatibility'
        ? 'compatibility'
        : 'single',
    name: getString(params, 'name', defaultInputState.name),
    gender: getString(params, 'gender', defaultInputState.gender) === 'female' ? 'female' : 'male',
    dateType: getString(params, 'dateType', defaultInputState.dateType) === 'lunar' ? 'lunar' : 'solar',
    year: getString(params, 'year', defaultInputState.year),
    month: getString(params, 'month', defaultInputState.month),
    day: getString(params, 'day', defaultInputState.day),
    timeIndex: parseTimeIndex(getString(params, 'timeIndex', String(defaultInputState.timeIndex))),
    isLeapMonth: getString(params, 'isLeapMonth', '0') === '1',
    useTrueSolarTime: getString(params, 'useTrueSolarTime', '0') === '1',
    birthHour: getString(params, 'birthHour', defaultInputState.birthHour),
    birthMinute: getString(params, 'birthMinute', defaultInputState.birthMinute),
    birthPlace: getString(params, 'birthPlace', defaultInputState.birthPlace),
    birthLongitude: getString(params, 'birthLongitude', defaultInputState.birthLongitude),
    partnerName: getString(params, 'partnerName', defaultInputState.partnerName),
    partnerGender:
      getString(params, 'partnerGender', defaultInputState.partnerGender) === 'male'
        ? 'male'
        : 'female',
    partnerDateType:
      getString(params, 'partnerDateType', defaultInputState.partnerDateType) === 'lunar'
        ? 'lunar'
        : 'solar',
    partnerYear: getString(params, 'partnerYear', defaultInputState.partnerYear),
    partnerMonth: getString(params, 'partnerMonth', defaultInputState.partnerMonth),
    partnerDay: getString(params, 'partnerDay', defaultInputState.partnerDay),
    partnerTimeIndex: parseTimeIndex(
      getString(params, 'partnerTimeIndex', String(defaultInputState.partnerTimeIndex)),
    ),
    partnerIsLeapMonth: getString(params, 'partnerIsLeapMonth', '0') === '1',
    partnerUseTrueSolarTime: getString(params, 'partnerUseTrueSolarTime', '0') === '1',
    partnerBirthHour: getString(params, 'partnerBirthHour', defaultInputState.partnerBirthHour),
    partnerBirthMinute: getString(params, 'partnerBirthMinute', defaultInputState.partnerBirthMinute),
    partnerBirthPlace: getString(params, 'partnerBirthPlace', defaultInputState.partnerBirthPlace),
    partnerBirthLongitude: getString(
      params,
      'partnerBirthLongitude',
      defaultInputState.partnerBirthLongitude,
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
  const legacyYearMode = getString(params, 'baziYearMode', '');
  const legacySelectedYear = getString(params, 'baziSelectedYear', '');
  const legacyFortuneScope =
    legacyYearMode === 'current-luck'
      ? 'dayun'
      : legacyYearMode === 'yearly' && legacySelectedYear
        ? 'year'
        : 'natal';

  return {
    tab: (getString(params, 'tab', defaultPromptState.tab) as ResultTabKey) || defaultPromptState.tab,
    promptSource:
      getString(params, 'promptSource', defaultPromptState.promptSource) === 'ziwei'
        ? 'ziwei'
        : 'bazi',
    baziPresetId: getString(params, 'baziPresetId', defaultPromptState.baziPresetId),
    baziShortcutMode: getString(
      params,
      'baziShortcutMode',
      defaultPromptState.baziShortcutMode,
    ),
    baziQuickQuestion: getString(params, 'baziQuickQuestion', defaultPromptState.baziQuickQuestion),
    baziFortuneScope: getString(
      params,
      'baziFortuneScope',
      legacyFortuneScope || defaultPromptState.baziFortuneScope,
    ) as BaziFortuneScope,
    baziFortuneCycleIndex: getString(
      params,
      'baziFortuneCycleIndex',
      defaultPromptState.baziFortuneCycleIndex,
    ),
    baziFortuneYear: getString(params, 'baziFortuneYear', legacySelectedYear),
    baziFortuneMonth: getString(
      params,
      'baziFortuneMonth',
      defaultPromptState.baziFortuneMonth,
    ),
    baziFortuneDay: getString(params, 'baziFortuneDay', defaultPromptState.baziFortuneDay),
    ziweiTopic: getString(params, 'ziweiTopic', defaultPromptState.ziweiTopic),
    ziweiShortcutMode: getString(
      params,
      'ziweiShortcutMode',
      defaultPromptState.ziweiShortcutMode,
    ),
    ziweiQuickQuestion: getString(params, 'ziweiQuickQuestion', defaultPromptState.ziweiQuickQuestion),
    ziweiScope: (getString(params, 'ziweiScope', defaultPromptState.ziweiScope) as ZiweiScopeMode),
  };
}

export function buildResultSearch(
  input: QueryInputState,
  prompt: QueryPromptState = defaultPromptState,
) {
  const params = new URLSearchParams();
  appendInputStateParams(params, input);
  appendPromptStateParams(params, prompt);

  return params.toString();
}

export function buildInputStateSearch(input: QueryInputState) {
  const params = new URLSearchParams();
  appendInputStateParams(params, input);
  return params.toString();
}
