import {
  baziCalculator,
  buildBaziFortuneSelectionForDate,
  buildBaziPersonInput,
  buildCurrentBaziFortuneSelectionForScope,
  buildFortuneSelectionContext,
  type BaziChartInputDraft,
  type BaziChartResult,
  type BaziFortuneSelectionValue,
  type FortuneSelectionContext,
  type Person,
  type ShenShaScope,
  type ShenShaVariantConfig,
} from 'mingyu-core/bazi';
import {
  BAZI_FORTUNE_SCOPES,
  BAZI_MULTI_SCHOOLS,
  BAZI_PROMPT_TOPICS,
  BAZI_SCHOOLS,
  PROMPT_MODES,
  buildBaziPromptForResult,
  resolvePromptSelection,
  type BaziPromptTopic,
  type BaziSchool,
  type PromptMode,
  type PromptSelection,
  type PublicBaziFortuneScope,
} from 'mingyu-core/prompt/public-api';

type JsonRecord = Record<string, unknown>;

const SHENSHA_KONG_WANG_BASIS = ['day', 'day-and-year'] as const;
const SHENSHA_YANG_REN_MODE = ['yang-stems-only', 'include-yin-ren'] as const;
const SHENSHA_TONG_ZI_SCOPE = ['day-hour', 'all-pillars'] as const;
const SHENSHA_REFERENCE_PROFILES = ['wenzhen', 'classical'] as const;
const SHENSHA_SCOPES = ['common', 'all'] as const;
const MAX_TEXT_LENGTH = 5000;

export type BaziReadingProgress = (completed: number, total: number) => void;

export type BaziCalculationIdentity = {
  method: 'bazi';
  birth: JsonRecord;
  target: JsonRecord;
};

export type BaziReadingResult = BaziChartResult & {
  calculationIdentity: BaziCalculationIdentity;
  fortuneSelection?: FortuneSelectionContext;
};

/** 本地八字补算的返回值，与 /bazi/prompt 的 full 响应保持相同的核心字段。 */
export type BaziReadingCalculationResult = {
  prompt: string;
  result: BaziReadingResult;
};

export type BaziReadingCalculationOptions = {
  signal?: AbortSignal;
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function readEnum<const T extends readonly string[]>(
  input: JsonRecord,
  key: string,
  values: T,
  fallback?: T[number],
): T[number] {
  const value = input[key];
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value === 'string' && values.includes(value)) return value as T[number];
  throw new Error(`${key} 必须是以下值之一：${values.join('、')}。`);
}

function readBoolean(input: JsonRecord, key: string, fallback: boolean): boolean {
  const value = input[key];
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') throw new Error(`${key} 必须是布尔值。`);
  return value;
}

function readText(input: JsonRecord, key: string, fallback = ''): string {
  const value = input[key];
  if (value === undefined) return fallback;
  if (typeof value !== 'string') throw new Error(`${key} 必须是字符串。`);
  if (value.length > MAX_TEXT_LENGTH) {
    throw new Error(`${key} 不能超过 ${MAX_TEXT_LENGTH} 个字符。`);
  }
  return value;
}

function readRequiredText(input: JsonRecord, key: string): string {
  const value = readText(input, key);
  if (!value.trim()) throw new Error(`${key} 不能为空。`);
  return value;
}

function readNumberLike(input: JsonRecord, key: string, min: number, max: number) {
  const value = input[key];
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^[-+]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value.trim())
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${key} 必须是 ${min} 至 ${max} 之间的数字。`);
  }
  return parsed;
}

function readOptionalNumberLike(input: JsonRecord, key: string, min: number, max: number) {
  if (input[key] === undefined) return undefined;
  return readNumberLike(input, key, min, max);
}

function readOptionalIdentityNumber(input: JsonRecord, key: string) {
  const value = input[key];
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string' && /^[-+]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value.trim())) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function readShenShaVariants(input: JsonRecord): Partial<ShenShaVariantConfig> | undefined {
  const value = input.shenShaVariants;
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error('shenShaVariants 必须是对象。');

  const variants: Partial<ShenShaVariantConfig> = {};
  const readOptional = <const T extends readonly string[]>(key: string, values: T) => {
    const item = value[key];
    if (item === undefined) return undefined;
    if (typeof item === 'string' && values.includes(item)) return item as T[number];
    throw new Error(`${key} 必须是以下值之一：${values.join('、')}。`);
  };
  const referenceProfile = readOptional('referenceProfile', SHENSHA_REFERENCE_PROFILES);
  const kongWangBasis = readOptional('kongWangBasis', SHENSHA_KONG_WANG_BASIS);
  const yangRenMode = readOptional('yangRenMode', SHENSHA_YANG_REN_MODE);
  const tongZiScope = readOptional('tongZiScope', SHENSHA_TONG_ZI_SCOPE);
  if (referenceProfile) variants.referenceProfile = referenceProfile;
  if (kongWangBasis) variants.kongWangBasis = kongWangBasis;
  if (yangRenMode) variants.yangRenMode = yangRenMode;
  if (tongZiScope) variants.tongZiScope = tongZiScope;
  return variants;
}

function toBaziPerson(input: JsonRecord): Person {
  const gender = readEnum(input, 'gender', ['male', 'female'] as const);
  const dateType = readEnum(input, 'dateType', ['solar', 'lunar'] as const);
  const useTrueSolarTime = readBoolean(input, 'useTrueSolarTime', false);
  const timeIndex = useTrueSolarTime
    ? ''
    : input.timeIndex === undefined
      ? ''
      : (input.timeIndex as BaziChartInputDraft['timeIndex']);
  const timezone = readOptionalNumberLike(input, 'timezone', -12, 14);
  const birthPlace = input.birthPlace === undefined ? undefined : readText(input, 'birthPlace');
  const timeZoneId =
    input.timeZoneId === undefined ? undefined : readRequiredText(input, 'timeZoneId');
  const shenShaScope = readEnum(input, 'shenShaScope', SHENSHA_SCOPES, 'common') as ShenShaScope;
  const draft: BaziChartInputDraft = {
    gender,
    year: input.year as BaziChartInputDraft['year'],
    month: input.month as BaziChartInputDraft['month'],
    day: input.day as BaziChartInputDraft['day'],
    timeIndex,
    dateType,
    isLeapMonth: readBoolean(input, 'isLeapMonth', false),
    useTrueSolarTime,
    birthHour: input.birthHour as BaziChartInputDraft['birthHour'],
    birthMinute: input.birthMinute as BaziChartInputDraft['birthMinute'],
    birthSecond: input.birthSecond as BaziChartInputDraft['birthSecond'],
    birthPlace,
    birthLongitude: input.birthLongitude as BaziChartInputDraft['birthLongitude'],
    timezone,
    timeZoneId,
    applyChinaDst:
      input.applyChinaDst === undefined ? undefined : readBoolean(input, 'applyChinaDst', false),
    shenShaScope,
  };
  const person = buildBaziPersonInput(draft);
  const shenShaVariants = readShenShaVariants(input);
  if (shenShaVariants) person.shenShaVariants = shenShaVariants;
  return person;
}

function readPromptSelection(input: JsonRecord): PromptSelection | undefined {
  if (input.topicId === undefined && input.subtopicId === undefined && input.scope === undefined) {
    return undefined;
  }
  const resolution = resolvePromptSelection({
    methodId: 'bazi',
    topicId: input.topicId === undefined ? undefined : readText(input, 'topicId'),
    subtopicId: input.subtopicId === undefined ? undefined : readText(input, 'subtopicId'),
    scope: input.scope === undefined ? undefined : readText(input, 'scope'),
  });
  if (!resolution.ok) throw new Error(resolution.message);
  return resolution.selection;
}

function toBaziFortuneScope(scope: string | undefined): PublicBaziFortuneScope | undefined {
  const mapped: Record<string, PublicBaziFortuneScope> = {
    natal: 'natal',
    full: 'full',
    decadal: 'dayun',
    yearly: 'year',
    monthly: 'month',
    daily: 'day',
  };
  return scope ? mapped[scope] : undefined;
}

function readInteger(input: JsonRecord, key: string, min: number, max: number): number {
  const value = input[key];
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${key} 必须是 ${min}-${max} 之间的整数。`);
  }
  return value;
}

function buildBaziFortuneContext(
  result: BaziChartResult,
  input: JsonRecord,
  scope: PublicBaziFortuneScope,
): FortuneSelectionContext | null {
  const fortuneDate = readBaziFortuneDateValue(input, scope);
  const selection: BaziFortuneSelectionValue = fortuneDate
    ? buildBaziFortuneSelectionForDate(
        result,
        scope as Exclude<BaziFortuneSelectionValue['scope'], 'natal' | 'full'>,
        fortuneDate,
      )
    : {
        scope,
        cycleIndex:
          scope === 'natal' || scope === 'full'
            ? undefined
            : scope === 'dayun' || input.baziFortuneCycleIndex !== undefined
              ? readInteger(input, 'baziFortuneCycleIndex', 0, 99)
              : undefined,
        year:
          scope === 'year' || scope === 'month' || scope === 'day'
            ? readInteger(input, 'baziFortuneYear', 1900, 2200)
            : undefined,
        month:
          scope === 'month' || scope === 'day'
            ? readInteger(input, 'baziFortuneMonth', 1, 12)
            : undefined,
        day: scope === 'day' ? readInteger(input, 'baziFortuneDay', 1, 33) : undefined,
      };
  return buildFortuneSelectionContext(result, selection);
}

function readBaziFortuneDateValue(input: JsonRecord, scope: PublicBaziFortuneScope) {
  if (input.baziFortuneDate === undefined) return undefined;
  if (!['dayun', 'year', 'month', 'day'].includes(scope)) {
    throw new Error('baziFortuneDate 仅适用于 dayun、year、month 或 day 八字命限范围。');
  }
  const conflictingField = [
    'baziFortuneCycleIndex',
    'baziFortuneYear',
    'baziFortuneMonth',
    'baziFortuneDay',
  ].find((key) => input[key] !== undefined);
  if (conflictingField) {
    throw new Error(`baziFortuneDate 不能与 ${conflictingField} 同时使用。`);
  }
  return readRequiredText(input, 'baziFortuneDate');
}

function buildCalculationIdentity(
  input: JsonRecord,
  person: Person,
  fortuneScope: PublicBaziFortuneScope,
  fortuneSelection: FortuneSelectionContext | null,
): BaziCalculationIdentity {
  const birth: JsonRecord = {
    gender: person.gender,
    year: person.year,
    month: person.month,
    day: person.day,
    dateType: person.isLunar ? 'lunar' : 'solar',
    isLeapMonth: Boolean(person.isLeapMonth),
    useTrueSolarTime: Boolean(person.useTrueSolarTime),
    birthPlace: person.birthPlace ?? '',
  };
  if (person.useTrueSolarTime) {
    birth.birthHour = person.birthHour;
    birth.birthMinute = person.birthMinute;
    birth.birthLongitude = person.birthLongitude;
    if (person.birthSecond !== undefined) birth.birthSecond = person.birthSecond;
  } else if (person.birthSecond !== undefined) {
    birth.birthHour = person.birthHour;
    birth.birthMinute = person.birthMinute;
    birth.birthSecond = person.birthSecond;
  } else {
    birth.timeIndex = person.timeIndex;
  }
  if (person.timezone !== undefined) birth.timezone = person.timezone;
  if (person.timeZoneId !== undefined) birth.timeZoneId = person.timeZoneId;
  if (person.applyChinaDst !== undefined) birth.applyChinaDst = person.applyChinaDst;
  const birthLatitude = readOptionalIdentityNumber(input, 'birthLatitude');
  if (birthLatitude !== undefined) birth.birthLatitude = birthLatitude;

  const target: JsonRecord = { baziFortuneScope: fortuneScope };
  if (fortuneSelection) {
    const fields: Record<string, unknown> = {
      baziFortuneCycleIndex: fortuneSelection.cycleIndex,
      baziFortuneYear: fortuneSelection.year,
      baziFortuneMonth: fortuneSelection.month,
      baziFortuneDay: fortuneSelection.day,
    };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) target[key] = value;
    }
  }
  if (input.baziFortuneDate !== undefined) {
    target.baziFortuneDate = readRequiredText(input, 'baziFortuneDate');
  }
  return { method: 'bazi', birth, target };
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('已停止解读', 'AbortError');
}

/** 在浏览器 Worker 或测试中生成与 /bazi/prompt full 响应相同的八字盘面与提示词。 */
export function calculateBaziReading(
  calculationRequest: JsonRecord,
  options: BaziReadingCalculationOptions = {},
): BaziReadingCalculationResult {
  assertNotAborted(options.signal);
  const person = toBaziPerson(calculationRequest);
  const result = baziCalculator.calculateBazi(person);
  assertNotAborted(options.signal);

  const selection = readPromptSelection(calculationRequest);
  const selectedFortuneScope =
    calculationRequest.baziFortuneScope === undefined
      ? toBaziFortuneScope(selection?.scope)
      : undefined;
  const requestedFortuneScope = readEnum(
    calculationRequest,
    'baziFortuneScope',
    BAZI_FORTUNE_SCOPES,
    selectedFortuneScope ?? 'dayun',
  );
  const useCurrentFortuneDefaults =
    calculationRequest.baziFortuneScope === undefined &&
    calculationRequest.baziFortuneDate === undefined &&
    requestedFortuneScope !== 'natal' &&
    requestedFortuneScope !== 'full';
  const currentSelection = useCurrentFortuneDefaults
    ? buildCurrentBaziFortuneSelectionForScope(result, requestedFortuneScope)
    : null;
  const fortuneScope =
    useCurrentFortuneDefaults && !currentSelection ? 'natal' : requestedFortuneScope;
  const fortuneSelection = currentSelection
    ? buildFortuneSelectionContext(result, currentSelection)
    : buildBaziFortuneContext(result, calculationRequest, fortuneScope);

  const schoolValue = calculationRequest.school;
  const school =
    typeof schoolValue === 'string' && (BAZI_SCHOOLS as readonly string[]).includes(schoolValue)
      ? (schoolValue as BaziSchool)
      : undefined;
  const schoolsValue = calculationRequest.schools;
  let schools: BaziSchool[] | undefined;
  if (schoolsValue !== undefined) {
    if (!Array.isArray(schoolsValue) || schoolsValue.length < 1 || schoolsValue.length > 3) {
      throw new Error('schools 必须包含一至三个解读口径。');
    }
    const selected = schoolsValue.map((value, index) => {
      if (typeof value !== 'string' || !(BAZI_MULTI_SCHOOLS as readonly string[]).includes(value)) {
        throw new Error(`schools[${index}] 必须是有效解读口径。`);
      }
      return value as BaziSchool;
    });
    if (new Set(selected).size !== selected.length)
      throw new Error('schools 不能包含重复解读口径。');
    schools = selected;
  }

  assertNotAborted(options.signal);
  const fortuneSelectionContext = fortuneSelection;
  const fortuneScopeForPrompt = fortuneScope;
  const prompt = buildBaziPromptForResult({
    result,
    question: readRequiredText(calculationRequest, 'question'),
    topic: readEnum(
      calculationRequest,
      'promptTopic',
      BAZI_PROMPT_TOPICS,
      'general',
    ) as BaziPromptTopic,
    mode: readEnum(calculationRequest, 'promptMode', PROMPT_MODES, 'framework') as PromptMode,
    fortuneSelectionContext,
    fortuneScope: fortuneScopeForPrompt,
    school,
    schools,
    selection,
  });
  assertNotAborted(options.signal);

  const calculationIdentity = buildCalculationIdentity(
    calculationRequest,
    person,
    fortuneScope,
    fortuneSelectionContext,
  );
  return {
    prompt,
    result: {
      ...result,
      calculationIdentity,
      ...(fortuneSelectionContext ? { fortuneSelection: fortuneSelectionContext } : {}),
    },
  };
}
