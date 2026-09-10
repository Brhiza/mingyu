import {
  READING_CLASSIC_TABLES as TABLES,
  READING_CALCULATION_ROUTES as ROUTES,
} from './reading-capabilities';
import type { ReadingAction, ReadingResource } from './reading-workflow';
import type { ReadingSubjectSnapshot } from './reading-subject';
import { getAiApiEndpoint } from './stream-client';

const LABELS: Record<string, string> = {
  sourceBook: '典籍',
  source: '典籍',
  verse: '原文',
  classicVerse: '原文',
  modernMeaning: '取义',
  modernExplanation: '释义',
  explanation: '释义',
  modernAdvice: '取义',
  careerAdvice: '事业取义',
  nature: '性质',
  dayMaster: '日主',
  monthBranch: '月令',
  primaryGods: '调候取用',
  seasonSummary: '月令概要',
  name: '名称',
  star: '星曜',
  pattern: '格局',
  auspice: '吉凶',
  guaCi: '卦辞',
  tuanCi: '彖辞',
  daXiang: '大象',
  wenYan: '文言',
  yaoCi: '爻辞',
  xiaoXiang: '小象',
  yongCi: '用辞',
  positionName: '爻位',
  yaos: '六爻',
  heavenStem: '天盘干',
  earthStem: '地盘干',
  wuxing: '五行',
  polarity: '阴阳',
  brightnessGeneral: '星性',
  upper: '上卦',
  lower: '下卦',
  palace: '宫位',
};

type CalculationParameterRule = {
  immutable: readonly string[];
  mutable: readonly string[];
};

const CALCULATION_PARAMETER_RULES: Record<string, CalculationParameterRule> = {
  bazi: {
    immutable: [
      'gender',
      'year',
      'month',
      'day',
      'dateType',
      'isLeapMonth',
      'timeIndex',
      'useTrueSolarTime',
      'birthHour',
      'birthMinute',
      'birthPlace',
      'birthLongitude',
      'birthLatitude',
      'timezone',
      'timeZoneId',
      'applyChinaDst',
      'shenShaScope',
      'shenShaVariants',
      'detailMode',
    ],
    mutable: [
      'baziFortuneScope',
      'baziFortuneCycleIndex',
      'baziFortuneYear',
      'baziFortuneMonth',
      'baziFortuneDay',
      'question',
      'topicId',
      'subtopicId',
      'scope',
      'promptTopic',
      'promptMode',
      'school',
      'schools',
    ],
  },
  ziwei: {
    immutable: [
      'name',
      'gender',
      'dateType',
      'year',
      'month',
      'day',
      'timeIndex',
      'isLeapMonth',
      'useTrueSolarTime',
      'birthHour',
      'birthMinute',
      'birthLongitude',
      'birthLatitude',
      'birthPlace',
      'timezone',
      'timeZoneId',
      'applyChinaDst',
      'algorithm',
      'detailMode',
    ],
    mutable: [
      'promptScope',
      'scopeDate',
      'scopeHourIndex',
      'question',
      'topicId',
      'subtopicId',
      'scope',
      'promptTopic',
      'promptMode',
      'school',
      'schools',
    ],
  },
  astrolabe: {
    immutable: [
      'name',
      'gender',
      'year',
      'month',
      'day',
      'hour',
      'minute',
      'latitude',
      'longitude',
      'timezone',
      'timeZoneId',
      'locationName',
      'useTrueSolarTime',
      'detailMode',
    ],
    mutable: [
      'astrolabeTopic',
      'astrolabeScope',
      'astrolabeScopeDate',
      'astrolabeScopeText',
      'question',
      'topicId',
      'subtopicId',
      'scope',
      'promptMode',
      'schools',
    ],
  },
  'qi-zheng': {
    immutable: [
      'gender',
      'year',
      'month',
      'day',
      'hour',
      'minute',
      'latitude',
      'longitude',
      'timezone',
      'timeZoneId',
      'useTrueSolarTime',
      'detailMode',
    ],
    mutable: [
      'flowYear',
      'flowMonth',
      'flowDay',
      'flowHour',
      'flowMinute',
      'question',
      'topicId',
      'subtopicId',
      'promptScope',
      'promptMode',
      'schools',
    ],
  },
};

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function textValues(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(textValues);
  if (record(value)) return Object.values(value).flatMap(textValues);
  return [];
}

const HEAVENLY_STEMS = '甲乙丙丁戊己庚辛壬癸';
const EARTHLY_BRANCHES = '子丑寅卯辰巳午未申酉戌亥';

function normalizeClassicQuery(query: string) {
  const compact = query.replace(/[\s，、,；;+＋。！？“”‘’（）()]/gu, '');
  const dayMaster = compact.match(
    new RegExp(`([${HEAVENLY_STEMS}])(?:[木火土金水])?(?:日主|日元|日干|木|火|土|金|水)`),
  )?.[1];
  const monthBranch = compact.match(new RegExp(`([${EARTHLY_BRANCHES}])(?:月令|月份|月)`))?.[1];
  const book = compact.includes('滴天髓')
    ? 'ditiansui'
    : compact.includes('穷通宝鉴') || compact.includes('穷通')
      ? 'qiongtong'
      : compact.includes('子平真诠') || compact.includes('子平')
        ? 'ziping'
        : undefined;
  const terms = compact
    .replace(
      /(?:滴天髓|穷通宝鉴|穷通|子平真诠|子平|日主|日元|日干|生于|出生于|月令|月份|月份|月)/gu,
      '',
    )
    .split(/[^\p{Script=Han}\p{Number}A-Za-z]+/u)
    .filter((term) => term.length > 0);
  return { compact, dayMaster, monthBranch, book, terms };
}

function tableBook(table: string): string | undefined {
  if (table === 'BAZI_DITIANSUI_TABLE') return 'ditiansui';
  if (table === 'BAZI_QIONGTONG_TABLE') return 'qiongtong';
  if (table === 'BAZI_ZIPING_PATTERNS') return 'ziping';
  return undefined;
}

function entryIdentity(table: string, index: number, entry: unknown): string {
  if (record(entry)) {
    if (typeof entry.dayMaster === 'string' && typeof entry.monthBranch === 'string')
      return `${table}:${entry.dayMaster}+${entry.monthBranch}`;
    for (const key of ['id', 'key', 'name', 'stem', 'dayMaster', 'monthBranch']) {
      if (typeof entry[key] === 'string' || typeof entry[key] === 'number')
        return `${table}:${String(entry[key])}`;
    }
  }
  return `${table}:${index}`;
}

export function formatClassicEntry(value: unknown): string {
  if (!record(value)) return textValues(value).join('；');
  return Object.entries(value)
    .flatMap(([key, item]) => {
      if (['id', 'key', 'score', 'type', 'category'].includes(key)) return [];
      if (key === 'yaos' && Array.isArray(item)) return item.map(formatClassicEntry);
      const text = textValues(item).join('；');
      return text ? [`${LABELS[key] ? `${LABELS[key]}：` : ''}${text}`] : [];
    })
    .join('\n');
}
export async function lookupReadingClassics(
  method: string,
  query: string,
): Promise<ReadingResource> {
  const library: Record<string, unknown> = await import('mingyu-core/classics');
  const normalized = normalizeClassicQuery(query);
  const matches = (TABLES[method] ?? []).flatMap((table) => {
    const requestedBook = normalized.book;
    const currentBook = tableBook(table);
    if (requestedBook && currentBook && currentBook !== requestedBook) return [];
    const entries = library[table];
    const values = Array.isArray(entries) ? entries : record(entries) ? Object.values(entries) : [];
    return values
      .map((entry, index) => {
        if (!record(entry) && normalized.dayMaster) return null;
        const entryText = textValues(entry).join('');
        let score = 0;
        if (normalized.dayMaster) {
          const matched =
            entry.dayMaster === normalized.dayMaster || entry.stem === normalized.dayMaster;
          if (!matched) return null;
          score += 20;
        }
        if (normalized.monthBranch) {
          if (entry.monthBranch !== normalized.monthBranch) return null;
          score += 20;
        }
        if (requestedBook && currentBook === requestedBook) score += 10;
        for (const term of normalized.terms) if (entryText.includes(term)) score += 2;
        if (!score && normalized.terms.length) return null;
        return {
          entry,
          index,
          table,
          score,
          identity: entryIdentity(table, index, entry),
          text: formatClassicEntry(entry),
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  });
  const unique = [...new Map(matches.map((item) => [item.text, item])).values()].sort(
    (a, b) => b.score - a.score,
  );
  const selected = unique.slice(0, 5);
  return {
    key: '',
    title: `传统条文：${query}`,
    usable: selected.length > 0,
    sourceIds: selected.map((item) => item.identity),
    text: selected.length
      ? `${selected.map((item) => item.text).join('\n\n')}${unique.length > 5 ? `\n另有${unique.length - 5}条相关条文，可使用更具体的名称查询。` : ''}`
      : '本次检索未找到对应条文，可依据已附盘面和传统资料继续解读。',
  };
}

export function resolveReadingSchema(
  value: unknown,
  document: Record<string, unknown>,
  depth = 0,
): unknown {
  if (depth > 12) throw new Error('补算参数层级过多。');
  if (Array.isArray(value))
    return value.map((item) => resolveReadingSchema(item, document, depth + 1));
  if (!record(value)) return value;
  if (typeof value.$ref === 'string') {
    if (!value.$ref.startsWith('#/components/schemas/')) throw new Error('补算参数引用无效。');
    let target: unknown = document;
    for (const part of value.$ref.slice(2).split('/'))
      target = record(target) ? target[part] : undefined;
    if (!target) throw new Error('补算参数定义缺失。');
    return resolveReadingSchema(target, document, depth + 1);
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      resolveReadingSchema(item, document, depth + 1),
    ]),
  );
}

function collectObjectSchemaParts(value: unknown) {
  const properties: Record<string, unknown> = {};
  const required = new Set<string>();

  const collect = (current: unknown) => {
    if (!record(current)) return;
    if (Array.isArray(current.allOf)) {
      for (const item of current.allOf) collect(item);
    }
    if (record(current.properties)) Object.assign(properties, current.properties);
    if (Array.isArray(current.required)) {
      for (const item of current.required) if (typeof item === 'string') required.add(item);
    }
  };

  collect(value);
  return { properties, required };
}

function filterCalculationSchema(method: string, value: unknown): Record<string, unknown> {
  const rule = CALCULATION_PARAMETER_RULES[method];
  if (!rule) throw new Error('此方法暂不支持安全补算。');

  const { properties, required } = collectObjectSchemaParts(value);
  const mutable = new Set(rule.mutable);
  const filteredProperties = Object.fromEntries(
    Object.entries(properties).filter(([key]) => mutable.has(key)),
  );
  const filteredRequired = [...required].filter((key) => Object.hasOwn(filteredProperties, key));

  return {
    type: 'object',
    properties: filteredProperties,
    ...(filteredRequired.length > 0 ? { required: filteredRequired } : {}),
    additionalProperties: false,
  };
}

async function fetchReadingData(
  path: string,
  signal?: AbortSignal,
  input?: Record<string, unknown>,
) {
  const timeout = new AbortController();
  const abort = () => timeout.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 45_000);
  try {
    if (signal?.aborted) throw new DOMException('已停止解读', 'AbortError');
    const response = await fetch(getAiApiEndpoint(`/api/v1${path}`), {
      method: input ? 'POST' : 'GET',
      ...(input
        ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }
        : {}),
      signal: timeout.signal,
    });
    const body: unknown = await response.json();
    if (!response.ok || !record(body) || body.success === false) {
      const error =
        record(body) && record(body.error) && typeof body.error.message === 'string'
          ? body.error.message
          : '补充资料请求失败。';
      throw new Error(error);
    }
    return record(body.data) ? body.data : body;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

function prepareCalculationInput(
  method: string,
  input: Record<string, unknown>,
  locked: Record<string, unknown>,
): Record<string, unknown> {
  const rule = CALCULATION_PARAMETER_RULES[method];
  if (!rule) throw new Error('此方法暂不支持安全补算。');
  const mutable = new Set(rule.mutable);
  const immutable = new Set(rule.immutable);
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (mutable.has(key)) {
      result[key] = value;
      continue;
    }
    if (!immutable.has(key)) throw new Error(`补算参数未声明或不可修改：${key}。`);
    if (!Object.hasOwn(locked, key)) throw new Error(`补算主体快照缺少不可变参数：${key}。`);
    if (stableComparable(value) !== stableComparable(locked[key]))
      throw new Error(`补算主体与当前命盘不一致：${key}。`);
  }

  return result;
}

export async function executeReadingAction(
  action: ReadingAction,
  signal?: AbortSignal,
  subject?: ReadingSubjectSnapshot,
): Promise<ReadingResource> {
  if (action.kind === 'classic') return lookupReadingClassics(action.method, action.query);
  const path = Object.hasOwn(ROUTES, action.method) ? ROUTES[action.method] : undefined;
  if (!path) throw new Error('此方法暂不支持自动补算。');
  let locked: Record<string, unknown> | undefined;
  let calculationInput: Record<string, unknown> | undefined;
  if (subject) {
    if (!subject.allowedMethods.includes(action.method))
      throw new Error('补算方法与当前命盘类型不一致。');
    locked = subject.lockedInputs[action.method];
    if (!locked) throw new Error('当前会话缺少该方法的主体快照。');
    if (action.kind === 'calculate') {
      calculationInput = prepareCalculationInput(action.method, action.input, locked);
    }
  }
  if (action.kind === 'schema') {
    const document = await fetchReadingData('/openapi.json', signal);
    const paths = document.paths as Record<
      string,
      { post?: { requestBody?: { content?: Record<string, { schema?: unknown }> } } }
    >;
    const schema = (
      paths?.[path] ??
      (action.method === 'astrolabe' ? paths?.['/divination/{method}/prompt'] : undefined)
    )?.post?.requestBody?.content?.['application/json']?.schema;
    if (!schema) throw new Error('暂未取得该方法的补算参数。');
    const filteredSchema = filterCalculationSchema(
      action.method,
      resolveReadingSchema(schema, document),
    );
    return {
      key: '',
      title: `${action.method}补算参数`,
      text: JSON.stringify(filteredSchema),
      usable: false,
    };
  }
  const data = await fetchReadingData(path, signal, {
    ...(locked ?? {}),
    ...(calculationInput ?? action.input),
    responseMode: 'prompt-only',
  });
  if (typeof data.prompt !== 'string' || !data.prompt.trim())
    throw new Error('补算未返回完整盘面。');
  return { key: '', title: '目标时段补充盘面', text: data.prompt, usable: true };
}

function stableComparable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableComparable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${key}:${stableComparable(item)}`)
      .join(',')}}`;
  }
  if (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return `number:${numeric}`;
  }
  return `${typeof value}:${String(value)}`;
}
