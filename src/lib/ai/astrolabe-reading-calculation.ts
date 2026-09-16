import {
  buildAstrolabeFullScopeContexts,
  buildAstrolabePeriodBatchResult,
  buildAstrolabePeriodContext,
  buildAstrolabeScopeContext,
  type AstrolabeFullScopeContexts,
  type AstrolabePeriodBatchInput,
  type AstrolabePeriodScopeMode,
  type AstrolabeScopeContext,
} from 'mingyu-core/divination/astrolabe-scope';
import { generateAstrolabe } from 'mingyu-core/divination/astrolabe';
import { getDivinationSummaryBlocks, type DivinationSummaryBlocks } from 'mingyu-core/prompt';
import type {
  AstrolabeBirthInput,
  AstrolabeData,
  DivinationData,
  SupplementaryInfo,
} from 'mingyu-core/types';
import { ASTROLABE_PROMPT_TOPICS } from '../astrolabe-prompts';
import { buildDivinationPrompt } from '../divination/engine';
import { buildAstrolabeFullScopePromptText } from '../astrolabe-scope';
import {
  fetchAstrolabePeriodCollection,
  injectAstrolabePeriodPrompt,
} from './astrolabe-batch-resources';
import { PROMPT_MODES } from '../public-api/prompt-builders';
import { getPromptSchoolIds, normalizePromptSchoolIds } from 'mingyu-core/prompt';

const MAX_TEXT_LENGTH = 5000;

type JsonRecord = Record<string, unknown>;

export type AstrolabeReadingCalculationResult = {
  prompt: string;
  result: AstrolabeData & {
    scopeEvidence: AstrolabeScopeEvidence;
  };
  summary: DivinationSummaryBlocks;
};

type AstrolabeScopeEvidence =
  | { scope: 'custom'; promptText: string }
  | { scope: 'full'; referenceDate: string; contexts: AstrolabeFullScopeContexts }
  | AstrolabeScopeContext;

type AstrolabePeriodTarget = {
  scope: AstrolabePeriodScopeMode;
  dateStr: string;
};

export type AstrolabeReadingProgress = (completed: number, total: number) => void;

function record(value: unknown): value is JsonRecord {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function textValue(input: JsonRecord, key: string, fallback = '') {
  const value = input[key];
  if (value === undefined) return fallback;
  if (typeof value !== 'string') throw new Error(`${key} 必须是字符串。`);
  if (value.length > MAX_TEXT_LENGTH)
    throw new Error(`${key} 不能超过 ${MAX_TEXT_LENGTH} 个字符。`);
  return value;
}

function requiredText(input: JsonRecord, key: string) {
  const value = textValue(input, key);
  if (!value.trim()) throw new Error(`${key} 不能为空。`);
  return value;
}

function enumValue<const T extends readonly string[]>(
  input: JsonRecord,
  key: string,
  values: T,
  fallback: T[number],
) {
  const value = input[key];
  if (value === undefined) return fallback;
  if (typeof value === 'string' && values.includes(value)) return value as T[number];
  throw new Error(`${key} 必须是以下值之一：${values.join('、')}。`);
}

export function toAstrolabeInput(input: JsonRecord): AstrolabeBirthInput {
  const requiredNumber = (key: string, min: number, max: number) => {
    const value = input[key];
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
      throw new Error(`${key} 必须是 ${min}-${max} 之间的整数。`);
    }
    return value;
  };
  const number = (key: string, min: number, max: number) => {
    const value = input[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
      throw new Error(`${key} 必须是 ${min} 至 ${max} 之间的数字。`);
    }
    return value;
  };
  const name = textValue(input, 'name');
  const gender = enumValue(input, 'gender', ['男', '女', ''] as const, '');
  const timeZoneId = input.timeZoneId === undefined ? undefined : textValue(input, 'timeZoneId');
  const timezone = input.timezone === undefined ? undefined : number('timezone', -12, 14);
  const useTrueSolarTime = input.useTrueSolarTime;
  if (useTrueSolarTime !== undefined && typeof useTrueSolarTime !== 'boolean') {
    throw new Error('useTrueSolarTime 必须是布尔值。');
  }
  return {
    name,
    gender: gender as AstrolabeBirthInput['gender'],
    year: String(requiredNumber('year', 1900, 2100)),
    month: String(requiredNumber('month', 1, 12)),
    day: String(requiredNumber('day', 1, 31)),
    hour: String(requiredNumber('hour', 0, 23)),
    minute: String(requiredNumber('minute', 0, 59)),
    second: String(input.second === undefined ? 0 : requiredNumber('second', 0, 59)),
    latitude: String(number('latitude', -90, 90)),
    longitude: String(number('longitude', -180, 180)),
    ...(timezone === undefined ? {} : { timezone: String(timezone) }),
    ...(timeZoneId === undefined ? {} : { timeZoneId }),
    locationName: textValue(input, 'locationName'),
    useTrueSolarTime: useTrueSolarTime ?? false,
  };
}

function parseCivilDate(value: string, label: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`${label} 必须使用 YYYY-MM-DD 格式。`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`${label} 不是有效日期。`);
  }
  return { year, month, day };
}

function parseBatchDate(value: unknown, label: string) {
  if (!record(value) || typeof value.startDate !== 'string' || typeof value.endDate !== 'string') {
    throw new Error(`${label} 必须包含 startDate 和 endDate。`);
  }
  return {
    start: parseCivilDate(value.startDate, `${label}.startDate`),
    endExclusive: parseCivilDate(value.endDate, `${label}.endDate`),
  } satisfies AstrolabePeriodBatchInput;
}

function resolvePeriodTarget(scope: AstrolabePeriodScopeMode, dateStr: string) {
  if (scope === 'yearly') {
    const match = /^(\d{4})$/.exec(dateStr);
    if (!match) throw new Error('流年周期日期必须使用 YYYY 格式。');
    return { year: Number(match[1]), month: 7, day: 1 };
  }
  if (scope === 'monthly') {
    const match = /^(\d{4})-(\d{2})$/.exec(dateStr);
    if (!match) throw new Error('流月周期日期必须使用 YYYY-MM 格式。');
    return { year: Number(match[1]), month: Number(match[2]), day: 15 };
  }
  return parseCivilDate(dateStr, '流日周期日期');
}

function buildPeriodTargets(input: JsonRecord): AstrolabePeriodTarget[] {
  if (textValue(input, 'astrolabeScopeText').trim()) return [];
  const scope = input.astrolabeScope;
  const dateStr = input.astrolabeScopeDate;
  if (typeof scope !== 'string') throw new Error('星盘行运缺少目标范围。');
  if (scope === 'natal') return [];
  if (typeof dateStr !== 'string') throw new Error('星盘行运缺少目标日期。');
  if (scope === 'full') {
    const reference = parseCivilDate(dateStr, '完整星盘参考日期');
    const normalizedDate = `${reference.year}-${String(reference.month).padStart(2, '0')}-${String(reference.day).padStart(2, '0')}`;
    return [
      { scope: 'yearly' as const, dateStr: String(reference.year) },
      {
        scope: 'monthly' as const,
        dateStr: `${reference.year}-${String(reference.month).padStart(2, '0')}`,
      },
      { scope: 'daily' as const, dateStr: normalizedDate },
    ];
  }
  if (scope !== 'yearly' && scope !== 'monthly' && scope !== 'daily') {
    throw new Error('当前本地 Worker 只处理流年、流月、流日或完整行运。');
  }
  return [{ scope, dateStr }];
}

function readSupplementaryInfo(input: JsonRecord): SupplementaryInfo | undefined {
  const value = input.supplementaryInfo;
  if (value === undefined) return undefined;
  if (!record(value)) throw new Error('supplementaryInfo 必须是对象。');
  const info: SupplementaryInfo = {};
  if (value.gender !== undefined) {
    if (value.gender !== '男' && value.gender !== '女' && value.gender !== '') {
      throw new Error('supplementaryInfo.gender 必须是男、女或空值。');
    }
    if (value.gender) info.gender = value.gender;
  }
  if (value.birthYear !== undefined) {
    if (
      typeof value.birthYear !== 'number' ||
      !Number.isSafeInteger(value.birthYear) ||
      value.birthYear < 1 ||
      value.birthYear > 9999
    ) {
      throw new Error('supplementaryInfo.birthYear 必须是有效年份。');
    }
    info.birthYear = value.birthYear;
  }
  for (const key of [
    'userSupplement',
    'currentSituation',
    'currentState',
    'knownFacts',
    'desiredOutcome',
    'constraints',
  ] as const) {
    if (value[key] === undefined) continue;
    const text = value[key];
    if (typeof text !== 'string') throw new Error(`supplementaryInfo.${key} 必须是字符串。`);
    if (text.length > MAX_TEXT_LENGTH) {
      throw new Error(`supplementaryInfo.${key} 不能超过 ${MAX_TEXT_LENGTH} 个字符。`);
    }
    if (text) info[key] = text;
  }
  if (value.meihuaSettings !== undefined && !record(value.meihuaSettings)) {
    throw new Error('supplementaryInfo.meihuaSettings 必须是对象。');
  }
  return Object.keys(info).length ? info : undefined;
}

function readPromptSchools(input: JsonRecord) {
  const value = input.schools;
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length < 1 || value.length > 3) {
    throw new Error('schools 必须包含一至三个解读口径。');
  }
  const ids = value.map((item, index) => {
    if (typeof item !== 'string') throw new Error(`schools[${index}] 必须是有效解读口径。`);
    return item;
  });
  if (new Set(ids).size !== ids.length) throw new Error('schools 不能包含重复解读口径。');
  const allowed = getPromptSchoolIds('astrolabe');
  if (ids.some((id) => !allowed.includes(id))) {
    throw new Error(`schools 必须是以下值之一：${allowed.join('、')}。`);
  }
  return normalizePromptSchoolIds('astrolabe', ids);
}

function buildPrompt(data: AstrolabeData, input: JsonRecord, scopeText: string) {
  const question = requiredText(input, 'question');
  const promptMode = enumValue(input, 'promptMode', PROMPT_MODES, 'framework');
  const astrolabeTopic = enumValue(input, 'astrolabeTopic', ASTROLABE_PROMPT_TOPICS, 'life');
  const topicId = input.topicId === undefined ? undefined : textValue(input, 'topicId').trim();
  const subtopicId =
    input.subtopicId === undefined ? undefined : textValue(input, 'subtopicId').trim();
  const scope = input.scope === undefined ? undefined : textValue(input, 'scope').trim();
  return buildDivinationPrompt(
    'astrolabe',
    question,
    data as DivinationData,
    readSupplementaryInfo(input),
    {
      isCustomQuestion: promptMode === 'custom',
      astrolabeTopic,
      astrolabeScopeText: scopeText,
      schools: readPromptSchools(input),
      topicId,
      subtopicId,
      scope,
    },
  );
}

async function buildLocalPeriodCollection(
  data: AstrolabeData,
  target: { scope: AstrolabePeriodScopeMode; dateStr: string },
  signal: AbortSignal | undefined,
  onProgress: AstrolabeReadingProgress | undefined,
) {
  const periodContext = buildAstrolabePeriodContext(data);
  return fetchAstrolabePeriodCollection({
    scope: target.scope,
    dateStr: target.dateStr,
    periodContext,
    signal,
    onProgress,
    fetchBatch: async (request) => {
      const range = parseBatchDate(request.astrolabePeriodRange, 'astrolabePeriodRange');
      return buildAstrolabePeriodBatchResult(
        periodContext,
        target.scope,
        resolvePeriodTarget(target.scope, target.dateStr),
        target.dateStr,
        range,
      );
    },
  });
}

function attachPeriodCollection(
  context: AstrolabeScopeContext,
  collection: Awaited<ReturnType<typeof buildLocalPeriodCollection>>,
) {
  const previousText = context.promptText;
  context.periodEvents = collection;
  context.promptText = injectAstrolabePeriodPrompt(previousText, collection.promptText);
}

function buildCoreScopeArtifacts(
  data: AstrolabeData,
  input: JsonRecord,
): { promptText: string; scopeEvidence: AstrolabeScopeEvidence } {
  const customText = textValue(input, 'astrolabeScopeText').trim();
  if (customText) {
    return {
      promptText: customText,
      scopeEvidence: { scope: 'custom' as const, promptText: customText },
    };
  }
  const scope = input.astrolabeScope;
  const dateStr = scope === 'natal' ? '' : input.astrolabeScopeDate;
  if (typeof scope !== 'string') throw new Error('星盘行运缺少目标范围。');
  if (scope !== 'natal' && typeof dateStr !== 'string') {
    throw new Error('星盘行运缺少目标日期。');
  }
  const resolvedDateStr = typeof dateStr === 'string' ? dateStr : '';
  if (scope === 'full') {
    const contexts = buildAstrolabeFullScopeContexts(data, resolvedDateStr, {
      includePeriodEvents: false,
    });
    return {
      promptText: buildAstrolabeFullScopePromptText(contexts),
      scopeEvidence: { scope: 'full' as const, referenceDate: resolvedDateStr, contexts },
    };
  }
  if (scope !== 'natal' && scope !== 'yearly' && scope !== 'monthly' && scope !== 'daily') {
    throw new Error('星盘分析范围无效。');
  }
  const context = buildAstrolabeScopeContext(data, scope, resolvedDateStr, {
    includePeriodEvents: false,
  });
  return { promptText: context.promptText, scopeEvidence: context };
}

/** 在浏览器 Worker 或测试中生成与公开接口相同的星盘 prompt/result。 */
export async function generateAstrolabeReadingLocally(
  calculationRequest: JsonRecord,
  options: { signal?: AbortSignal; onProgress?: AstrolabeReadingProgress } = {},
): Promise<AstrolabeReadingCalculationResult> {
  if (options.signal?.aborted) throw new DOMException('已停止解读', 'AbortError');
  const data = generateAstrolabe(toAstrolabeInput(calculationRequest));
  const artifacts = buildCoreScopeArtifacts(data, calculationRequest);
  const targets = buildPeriodTargets(calculationRequest);
  for (const target of targets) {
    if (options.signal?.aborted) throw new DOMException('已停止解读', 'AbortError');
    const context =
      'contexts' in artifacts.scopeEvidence
        ? artifacts.scopeEvidence.contexts[target.scope]
        : artifacts.scopeEvidence;
    if (
      !context ||
      context.scope === 'natal' ||
      context.scope === 'full' ||
      context.scope === 'custom'
    ) {
      throw new Error(`星盘补算缺少${target.scope}范围资料。`);
    }
    const collection = await buildLocalPeriodCollection(
      data,
      target,
      options.signal,
      options.onProgress,
    );
    attachPeriodCollection(context, collection);
  }
  const scopeText =
    'contexts' in artifacts.scopeEvidence
      ? buildAstrolabeFullScopePromptText(artifacts.scopeEvidence.contexts)
      : artifacts.scopeEvidence.promptText;
  const result = { ...data, scopeEvidence: artifacts.scopeEvidence };
  return {
    prompt: buildPrompt(data, calculationRequest, scopeText),
    result,
    summary: getDivinationSummaryBlocks('astrolabe', data as DivinationData),
  };
}
