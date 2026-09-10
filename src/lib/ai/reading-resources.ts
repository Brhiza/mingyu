import {
  READING_CLASSIC_TABLES as TABLES,
  READING_CALCULATION_ROUTES as ROUTES,
} from './reading-capabilities';
import type { ReadingAction, ReadingResource, ReadingTarget } from './reading-workflow';
import type { ReadingSubjectSnapshot } from './reading-subject';
import { getDefaultAstrolabeScopeDate } from '../astrolabe-scope';
import { getAiApiEndpoint } from './stream-client';
import {
  DEFAULT_CHINA_TIMEZONE_HOURS,
  getTimeIndexFromClock,
  resolveCivilTime,
} from 'mingyu-core/calendar';

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
    description:
      '这是补算 input。calculate 动作另带 target，取值为 primary 或 partner；partner 只在当前会话存在伴侣主体快照时使用。',
    properties: filteredProperties,
    ...(filteredRequired.length > 0 ? { required: filteredRequired } : {}),
    additionalProperties: false,
  };
}

function resolveReadingTarget(action: ReadingAction): ReadingTarget {
  return action.kind === 'calculate' && action.target === 'partner' ? 'partner' : 'primary';
}

function resolveLockedInputKey(method: string, target: ReadingTarget) {
  return target === 'partner' ? `${method}Partner` : method;
}

function assertStructuredField(
  label: string,
  expected: unknown,
  actual: unknown,
  options: { allowMissing?: boolean } = {},
) {
  if (expected === undefined) return;
  if (actual === undefined && options.allowMissing) return;
  if (actual === undefined || stableComparable(expected) !== stableComparable(actual)) {
    throw new Error(`补算身份核验失败：${label}。`);
  }
}

function assertIdentityBirth(
  method: string,
  identity: Record<string, unknown>,
  locked: Record<string, unknown>,
) {
  const birth = identity.birth;
  if (!record(birth)) throw new Error('补算返回缺少结构化出生主体身份。');

  const fields = [
    'gender',
    'year',
    'month',
    'day',
    'dateType',
    'isLeapMonth',
    'useTrueSolarTime',
    'timeZoneId',
    'timezone',
    'birthPlace',
    'birthLatitude',
    'applyChinaDst',
  ];
  for (const field of fields) {
    assertStructuredField(`${method}.${field}`, locked[field], birth[field]);
  }

  const useTrueSolarTime = locked.useTrueSolarTime === true;
  if (useTrueSolarTime) {
    for (const field of ['birthHour', 'birthMinute', 'birthLongitude']) {
      assertStructuredField(`${method}.${field}`, locked[field], birth[field]);
    }
  } else {
    assertStructuredField(`${method}.timeIndex`, locked.timeIndex, birth.timeIndex);
  }

  if (method === 'ziwei') {
    assertStructuredField(`${method}.name`, locked.name, birth.name);
    assertStructuredField(`${method}.algorithm`, locked.algorithm, birth.algorithm);
  }
}

function assertBaziTarget(
  identity: Record<string, unknown>,
  result: Record<string, unknown>,
  calculationInput: Record<string, unknown>,
) {
  const target = identity.target;
  if (!record(target)) throw new Error('补算返回缺少结构化目标时段身份。');
  const fields = [
    'baziFortuneScope',
    'baziFortuneCycleIndex',
    'baziFortuneYear',
    'baziFortuneMonth',
    'baziFortuneDay',
  ];
  for (const field of fields) {
    assertStructuredField(`bazi.${field}`, calculationInput[field], target[field]);
  }

  const selection = result.fortuneSelection;
  const requestedScope = calculationInput.baziFortuneScope;
  if (requestedScope !== undefined && requestedScope !== 'natal' && requestedScope !== 'full') {
    if (!record(selection)) throw new Error('补算返回缺少结构化八字目标运限。');
    assertStructuredField('bazi.fortuneSelection.scope', target.baziFortuneScope, selection.scope);
    for (const field of [
      'baziFortuneCycleIndex',
      'baziFortuneYear',
      'baziFortuneMonth',
      'baziFortuneDay',
    ]) {
      const selectionField =
        field === 'baziFortuneCycleIndex'
          ? 'cycleIndex'
          : field.replace('baziFortune', '').replace(/^./u, (value) => value.toLowerCase());
      assertStructuredField(
        `bazi.fortuneSelection.${selectionField}`,
        target[field],
        selection[selectionField],
        { allowMissing: field === 'baziFortuneYear' && requestedScope === 'dayun' },
      );
    }
  }
}

function assertDateParts(label: string, expected: Record<string, unknown>, actual: unknown) {
  if (!record(actual)) throw new Error(`补算返回缺少结构化${label}。`);
  for (const field of ['year', 'month', 'day']) {
    assertStructuredField(`${label}.${field}`, expected[field], actual[field]);
  }
}

function assertTrueSolarEvidence(
  label: string,
  timing: Record<string, unknown> | undefined,
): {
  standardTime: Record<string, unknown>;
  correctedTime: Record<string, unknown>;
} {
  if (!timing || timing.enabled !== true) {
    throw new Error(`补算返回缺少${label}真太阳时证据。`);
  }
  const standardTime = timing.standardTime;
  if (
    !record(standardTime) ||
    ['year', 'month', 'day', 'hour', 'minute'].some(
      (field) => typeof standardTime[field] !== 'number',
    )
  ) {
    throw new Error(`补算返回缺少${label}真太阳时标准时间。`);
  }
  const correctedTime = timing.correctedTime;
  if (
    !record(correctedTime) ||
    ['year', 'month', 'day', 'hour', 'minute'].some(
      (field) => typeof correctedTime[field] !== 'number',
    )
  ) {
    throw new Error(`补算返回缺少${label}真太阳时校正结果。`);
  }
  const evidence = timing.evidence;
  if (!record(evidence) || typeof evidence.key !== 'string' || !evidence.key.trim()) {
    throw new Error(`补算返回缺少${label}真太阳时计算证据。`);
  }
  return { standardTime, correctedTime };
}

function assertBaziResultFacts(
  result: Record<string, unknown>,
  identity: Record<string, unknown>,
  locked: Record<string, unknown>,
) {
  assertStructuredField('bazi.result.gender', locked.gender, result.gender);
  const birth = identity.birth;
  if (!record(birth)) throw new Error('补算返回缺少结构化出生主体身份。');
  const dateType = birth.dateType;
  const useTrueSolarTime = locked.useTrueSolarTime === true;
  const timeInfo = result.timeInfo;
  if (!record(timeInfo)) throw new Error('补算返回缺少八字实际出生时辰。');
  if (!useTrueSolarTime) {
    if (dateType === 'lunar') {
      assertDateParts('八字实际农历出生日期', birth, result.lunarDate);
    } else {
      assertDateParts('八字实际公历出生日期', birth, result.solarDate);
    }
    assertStructuredField('bazi.result.timeInfo.index', locked.timeIndex, timeInfo.index);
    return;
  }

  const timing = record(result.timing) ? result.timing : undefined;
  const { standardTime, correctedTime } = assertTrueSolarEvidence('八字', timing);
  assertDateParts('八字实际校正公历出生日期', correctedTime, result.solarDate);
  assertStructuredField(
    'bazi.result.timeInfo.index',
    getTimeIndexFromClock(Number(correctedTime.hour), Number(correctedTime.minute)),
    timeInfo.index,
  );
  if (dateType === 'solar') {
    for (const field of ['year', 'month', 'day']) {
      assertStructuredField(`bazi.timing.standardTime.${field}`, birth[field], standardTime[field]);
    }
    assertStructuredField('bazi.timing.standardTime.hour', locked.birthHour, standardTime.hour);
    assertStructuredField(
      'bazi.timing.standardTime.minute',
      locked.birthMinute,
      standardTime.minute,
    );
  }
}

function normalizeDateKey(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const match = value.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/u);
  if (!match) return undefined;
  return [match[1], match[2].padStart(2, '0'), match[3].padStart(2, '0')].join('-');
}

function assertZiweiResultFacts(
  result: Record<string, unknown>,
  identity: Record<string, unknown>,
  locked: Record<string, unknown>,
) {
  const basicInfo = result.basicInfo;
  if (!record(basicInfo)) throw new Error('补算返回缺少紫微实际本命资料。');
  const expectedGender =
    locked.gender === 'male' ? '男' : locked.gender === 'female' ? '女' : locked.gender;
  assertStructuredField('ziwei.result.basicInfo.gender', expectedGender, basicInfo.gender);

  const birth = identity.birth;
  if (!record(birth)) throw new Error('补算返回缺少结构化出生主体身份。');
  if (birth.dateType === 'solar' && locked.useTrueSolarTime !== true) {
    const actualDate = normalizeDateKey(basicInfo.solar_date);
    const expectedDate = [birth.year, birth.month, birth.day]
      .map((value, index) => (index === 0 ? String(value) : String(value).padStart(2, '0')))
      .join('-');
    assertStructuredField('ziwei.result.basicInfo.solar_date', expectedDate, actualDate);
  }

  if (locked.useTrueSolarTime === true) {
    const evidence = result.trueSolarEvidence;
    if (!record(evidence) || typeof evidence.key !== 'string' || !evidence.key.trim()) {
      throw new Error('补算返回缺少紫微真太阳时计算证据。');
    }
  }
}

function assertZiweiTarget(
  identity: Record<string, unknown>,
  result: Record<string, unknown>,
  calculationInput: Record<string, unknown>,
) {
  const target = identity.target;
  if (!record(target)) throw new Error('补算返回缺少结构化目标时段身份。');
  assertStructuredField('ziwei.promptScope', calculationInput.promptScope, target.promptScope);
  assertStructuredField('ziwei.scopeDate', calculationInput.scopeDate, target.scopeDate);
  assertStructuredField(
    'ziwei.scopeHourIndex',
    calculationInput.scopeHourIndex,
    target.scopeHourIndex,
  );

  const timeline = result.fortuneTimeline;
  if (record(timeline)) {
    assertStructuredField(
      'ziwei.fortuneTimeline.targetDateStr',
      target.scopeDate,
      timeline.targetDateStr,
    );
    assertStructuredField(
      'ziwei.fortuneTimeline.targetHourIndex',
      target.scopeHourIndex,
      timeline.targetHourIndex,
    );
  }

  const scope = target.promptScope;
  if (typeof scope === 'string' && scope !== 'full') {
    const payloadByScope = result.payloadByScope;
    const payload = record(payloadByScope) ? payloadByScope[scope] : undefined;
    if (!record(payload) || !record(payload.active_scope)) {
      throw new Error('补算返回缺少紫微实际目标宫限资料。');
    }
    assertStructuredField('ziwei.result.active_scope.scope', scope, payload.active_scope.scope);
    if (scope !== 'origin' && target.scopeDate !== undefined) {
      const actualDate = normalizeDateKey(payload.active_scope.solar_date);
      assertStructuredField('ziwei.result.active_scope.solar_date', target.scopeDate, actualDate);
    }
  }
}

function assertBaziOrZiweiResult(
  method: 'bazi' | 'ziwei',
  data: Record<string, unknown>,
  locked: Record<string, unknown>,
  calculationInput: Record<string, unknown>,
) {
  const result = data.result;
  if (!record(result)) throw new Error('补算未返回结构化盘面结果。');
  const identity = result.calculationIdentity;
  if (!record(identity)) throw new Error('补算未返回结构化身份，无法确认目标主体。');
  assertStructuredField('calculationIdentity.method', method, identity.method);
  assertIdentityBirth(method, identity, locked);
  if (method === 'bazi') {
    assertBaziResultFacts(result, identity, locked);
    assertBaziTarget(identity, result, calculationInput);
  } else {
    assertZiweiResultFacts(result, identity, locked);
    assertZiweiTarget(identity, result, calculationInput);
  }
}

function toAstrolabeGender(value: unknown) {
  return value === 'male' ? '男' : value === 'female' ? '女' : value;
}

function assertAstrolabeResult(
  data: Record<string, unknown>,
  locked: Record<string, unknown>,
  calculationInput: Record<string, unknown>,
) {
  const result = data.result;
  if (!record(result) || !record(result.birth)) throw new Error('补算未返回结构化星盘主体身份。');
  const birth = result.birth;
  for (const field of ['name', 'gender']) {
    const expected = field === 'gender' ? toAstrolabeGender(locked[field]) : locked[field];
    assertStructuredField(`astrolabe.${field}`, expected || undefined, birth[field]);
  }
  for (const field of ['latitude', 'longitude', 'timezone', 'timeZoneId']) {
    assertStructuredField(`astrolabe.${field}`, locked[field], birth[field], {
      allowMissing: field === 'timezone' && locked.timeZoneId !== undefined,
    });
  }
  assertStructuredField(
    'astrolabe.isTrueSolarTime',
    locked.useTrueSolarTime,
    birth.isTrueSolarTime,
  );

  if (locked.year !== undefined && locked.month !== undefined && locked.day !== undefined) {
    const dateTime = birth.standardDateTime ?? birth.dateTime;
    if (typeof dateTime !== 'string') throw new Error('补算返回缺少标准出生时间。');
    const expectedDateTime = [locked.year, locked.month, locked.day]
      .map((value, index) => (index === 0 ? String(value) : String(value).padStart(2, '0')))
      .join('-');
    const expectedClock =
      locked.hour === undefined
        ? undefined
        : `${String(locked.hour).padStart(2, '0')}:${String(locked.minute ?? 0).padStart(2, '0')}`;
    if (expectedClock) {
      assertStructuredField(
        'astrolabe.standardDateTime',
        `${expectedDateTime} ${expectedClock}`,
        dateTime,
      );
    }
  }

  const evidence = result.scopeEvidence;
  const scope =
    typeof calculationInput.astrolabeScopeText === 'string' &&
    calculationInput.astrolabeScopeText.trim()
      ? 'custom'
      : (calculationInput.astrolabeScope ?? 'natal');
  if (record(evidence)) {
    assertStructuredField('astrolabe.scopeEvidence.scope', scope, evidence.scope);
    const expectedDate = calculationInput.astrolabeScopeDate;
    if (expectedDate !== undefined && scope !== 'custom') {
      const actualDate = evidence.referenceDate ?? evidence.dateStr;
      assertStructuredField('astrolabe.scopeEvidence.date', expectedDate, actualDate);
    }
  } else if (scope !== 'natal') {
    throw new Error('补算返回缺少结构化目标时段身份。');
  }
}

function assertQizhengResult(
  data: Record<string, unknown>,
  locked: Record<string, unknown>,
  calculationInput: Record<string, unknown>,
) {
  const result = data.result;
  if (!record(result) || !record(result.calculationContext))
    throw new Error('补算未返回结构化七政计算口径。');
  const context = result.calculationContext;
  for (const field of ['latitude', 'longitude']) {
    assertStructuredField(`qi-zheng.${field}`, locked[field], context[field]);
  }
  const birthFields = ['year', 'month', 'day', 'hour'];
  if (birthFields.some((field) => locked[field] === undefined)) {
    throw new Error('当前会话缺少七政出生日期或时刻。');
  }
  const birthTime = resolveCivilTime(
    {
      year: Number(locked.year),
      month: Number(locked.month),
      day: Number(locked.day),
      hour: Number(locked.hour),
      minute: Number(locked.minute ?? 0),
      second: 0,
      timezone: locked.timezone === undefined ? undefined : Number(locked.timezone),
      timeZoneId: typeof locked.timeZoneId === 'string' ? locked.timeZoneId : undefined,
    },
    { defaultTimezone: DEFAULT_CHINA_TIMEZONE_HOURS },
  );
  assertStructuredField('qi-zheng.localDateTime', birthTime.localDateTime, context.localDateTime);
  assertStructuredField('qi-zheng.utcDateTime', birthTime.utcDateTime, context.utcDateTime);
  assertStructuredField('qi-zheng.timezone', birthTime.timezone, context.timezone);
  const astronomicalTime = context.astronomicalTime;
  if (!record(astronomicalTime)) throw new Error('补算返回缺少七政出生时间证据。');
  assertStructuredField('qi-zheng.timeZoneId', locked.timeZoneId, astronomicalTime.timeZoneId);
  assertStructuredField(
    'qi-zheng.astronomicalTime.localDateTime',
    birthTime.localDateTime.replace('T', ' '),
    astronomicalTime.localDateTime,
  );
  if (typeof context.utcDateTime !== 'string' || typeof context.timezone !== 'number') {
    throw new Error('补算返回缺少七政 UTC 时刻或有效时区。');
  }
  assertStructuredField(
    'qi-zheng.astronomicalTime.utcDateTime',
    birthTime.utcDateTime.replace('T', ' ').replace('.000Z', 'Z'),
    astronomicalTime.utcDateTime,
  );
  assertStructuredField(
    'qi-zheng.astronomicalTime.timezone',
    context.timezone,
    astronomicalTime.timezone,
  );
  assertStructuredField(
    'qi-zheng.palaceTimeMode',
    locked.useTrueSolarTime === true ? '真太阳时混合口径' : '民用时间',
    context.palaceTimeMode,
  );
  if (locked.gender !== undefined && calculationInput.flowYear !== undefined) {
    if (!record(result.timeLords)) throw new Error('补算返回缺少七政行限主体资料。');
    assertStructuredField('qi-zheng.timeLords.gender', locked.gender, result.timeLords.gender);
  }
  const flow = result.flowingStars;
  const flowFields = ['flowYear', 'flowMonth', 'flowDay', 'flowHour', 'flowMinute'];
  if (flowFields.some((field) => calculationInput[field] !== undefined)) {
    if (!record(flow)) throw new Error('补算返回缺少结构化七政目标时段身份。');
    for (const field of flowFields) {
      const resultField = field.replace('flow', '').toLowerCase();
      assertStructuredField(`qi-zheng.${field}`, calculationInput[field], flow[resultField]);
    }
  }
}

function verifyStructuredCalculation(
  method: string,
  data: Record<string, unknown>,
  locked: Record<string, unknown>,
  calculationInput: Record<string, unknown>,
) {
  if (method === 'bazi' || method === 'ziwei') {
    assertBaziOrZiweiResult(method, data, locked, calculationInput);
  } else if (method === 'astrolabe') {
    assertAstrolabeResult(data, locked, calculationInput);
  } else if (method === 'qi-zheng') {
    assertQizhengResult(data, locked, calculationInput);
  }
}

function buildCalculationResourceTitle(
  method: string,
  target: ReadingTarget,
  locked: Record<string, unknown> | undefined,
  calculationInput: Record<string, unknown>,
  data: Record<string, unknown>,
) {
  const subjectName =
    typeof locked?.name === 'string' && locked.name.trim()
      ? locked.name.trim()
      : target === 'partner'
        ? '第二人'
        : '第一人';
  const methodName: Record<string, string> = {
    bazi: '八字',
    ziwei: '紫微',
    astrolabe: '星盘',
    'qi-zheng': '七政',
  };
  let range = '';
  const result = record(data.result) ? data.result : undefined;
  const identity = record(result?.calculationIdentity) ? result.calculationIdentity : undefined;
  const identityTarget = record(identity?.target) ? identity.target : undefined;
  if (method === 'bazi') {
    const year = identityTarget?.baziFortuneYear ?? calculationInput.baziFortuneYear;
    range = typeof year === 'number' || typeof year === 'string' ? `${year}年` : '';
  } else if (method === 'ziwei') {
    const date = identityTarget?.scopeDate ?? calculationInput.scopeDate;
    const hour = identityTarget?.scopeHourIndex ?? calculationInput.scopeHourIndex;
    range = typeof date === 'string' ? date : '';
    if (typeof hour === 'number') range += `${range ? ' ' : ''}时辰${hour}`;
  } else if (method === 'astrolabe') {
    range =
      typeof calculationInput.astrolabeScopeDate === 'string'
        ? calculationInput.astrolabeScopeDate
        : '';
  } else if (method === 'qi-zheng') {
    const year = calculationInput.flowYear;
    range = typeof year === 'number' || typeof year === 'string' ? `${year}年` : '';
  }
  return `${subjectName}·${methodName[method] ?? method}${range}`;
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
  const target = resolveReadingTarget(action);
  if (subject) {
    if (!subject.allowedMethods.includes(action.method))
      throw new Error('补算方法与当前命盘类型不一致。');
    locked = subject.lockedInputs[resolveLockedInputKey(action.method, target)];
    if (!locked) {
      throw new Error(
        target === 'partner'
          ? '当前会话没有第二人主体快照，已拒绝使用主主体替代。'
          : '当前会话缺少该方法的主体快照。',
      );
    }
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
  const requestInput = { ...(calculationInput ?? action.input) };
  if (action.method === 'astrolabe' && requestInput.astrolabeScope === undefined) {
    requestInput.astrolabeScope = 'yearly';
    requestInput.astrolabeScopeDate ??= getDefaultAstrolabeScopeDate('yearly');
  }
  const calculationRequest: Record<string, unknown> = {
    ...(locked ?? {}),
    ...requestInput,
    responseMode: 'full',
  };
  if (action.method === 'astrolabe' && calculationRequest.gender !== undefined) {
    calculationRequest.gender = toAstrolabeGender(calculationRequest.gender);
  }
  if (
    (action.method === 'bazi' || action.method === 'ziwei') &&
    calculationRequest.useTrueSolarTime === true
  ) {
    delete calculationRequest.timeIndex;
  }
  const data = await fetchReadingData(path, signal, calculationRequest);
  if (locked) verifyStructuredCalculation(action.method, data, locked, requestInput);
  if (typeof data.prompt !== 'string' || !data.prompt.trim())
    throw new Error('补算未返回完整盘面。');
  return {
    key: '',
    title: buildCalculationResourceTitle(action.method, target, locked, requestInput, data),
    text: data.prompt,
    usable: true,
    structured: record(data.result) ? data.result : undefined,
  };
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
