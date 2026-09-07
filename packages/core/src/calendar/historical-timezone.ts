/**
 * @file IANA 历史时区解析
 * @description 通过运行环境 Intl/IANA 数据库解析当地钟表时刻的历史 UTC 偏移，并识别 DST 歧义与缺失时刻。
 */

export interface HistoricalTimezoneInput {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  timeZoneId: string;
  fixedOffsetHours?: number;
}

export interface HistoricalTimezoneCalculationStep {
  key: string;
  stage: '时区规则加载' | '候选偏移采样' | '当地时刻匹配' | '偏移核验';
  status: '已解析' | '已匹配' | '存在歧义' | '已核验' | '未核验' | '存在冲突';
  dependsOnStepKeys: string[];
  inputs: Record<string, string | number | boolean>;
  result: Record<string, string | number | boolean>;
  promptText: string;
  sources: string[];
  limitation: '历史时区步骤只证明指定 IANA 时区规则下当地钟表时间如何映射为 UTC，并记录回拨歧义与固定偏移冲突；不得把数据库解析结果解释为出生记录本身已经无误';
}

export interface HistoricalTimezoneDiagnosticFact {
  key: string;
  type: '当地时刻映射' | '固定偏移核验';
  status: '唯一映射' | '存在回拨歧义' | '无冲突' | '存在冲突' | '未核验';
  ownerFactKeys: string[];
  ownerStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '诊断事实只记录 IANA 历史规则下的映射数量与偏移一致性；歧义或冲突需要结合原始时间记录复核，不得自动改写出生时间';
}

export interface HistoricalTimezoneDiagnosticSummaryFact {
  key: 'historical-timezone:diagnostic-summary';
  status:
    | '唯一且无冲突'
    | '唯一但偏移冲突'
    | '唯一映射且未核验固定偏移'
    | '存在回拨歧义'
    | '回拨歧义且偏移冲突'
    | '存在回拨歧义且未核验固定偏移';
  factKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '诊断汇总只整合当地时刻映射与固定偏移核验，不证明原始钟表记录、地点或时区标注必然正确';
}

export interface HistoricalTimezoneSummaryFact {
  key: 'historical-timezone:evidence-summary';
  status: HistoricalTimezoneDiagnosticSummaryFact['status'];
  factKeys: string[];
  calculationStepCount: number;
  diagnosticFactCount: number;
  limitationFactCount: number;
  promptText: string;
  sources: string[];
  limitation: '历史时区证据汇总只统计 IANA 规则加载、候选偏移、当地时刻映射、固定偏移核验、诊断与限制覆盖；不得按映射状态生成可信度百分比，也不证明原始钟表记录、出生地或时区标注必然正确';
}

export interface HistoricalTimezoneLimitationFact {
  key: string;
  type: '数据库版本边界' | '回拨选择边界' | '固定偏移边界';
  status: '适用';
  ownerFactKeys: string[];
  ownerStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '限制事实用于约束历史时区换算可支持的结论范围，不得被反向当作出生记录真实性、事件结果或观测精度证据';
}

export interface HistoricalTimezoneEvidence {
  key: string;
  timeZoneId: string;
  database: string;
  status: 'unique' | 'ambiguous';
  selectedUtcTimestamp: number;
  selectedUtcDateTime: string;
  resolvedOffsetHours: number;
  possibleUtcDateTimes: string[];
  possibleOffsetsHours: number[];
  fixedOffsetHours?: number;
  /** 重复当地时刻是否已由匹配的固定偏移明确消歧。 */
  ambiguityResolvedByFixedOffset: boolean;
  offsetConflict: boolean;
  diagnostics: string[];
  calculationSteps: HistoricalTimezoneCalculationStep[];
  calculationChain: string[];
  diagnosticFacts: HistoricalTimezoneDiagnosticFact[];
  diagnosticSummaryFact: HistoricalTimezoneDiagnosticSummaryFact;
  summaryFact: HistoricalTimezoneSummaryFact;
  limitations: string[];
  limitationFacts: HistoricalTimezoneLimitationFact[];
  source: string;
  promptText: string;
}

const CALCULATION_STEP_LIMITATION =
  '历史时区步骤只证明指定 IANA 时区规则下当地钟表时间如何映射为 UTC，并记录回拨歧义与固定偏移冲突；不得把数据库解析结果解释为出生记录本身已经无误' as const;
const DIAGNOSTIC_FACT_LIMITATION =
  '诊断事实只记录 IANA 历史规则下的映射数量与偏移一致性；歧义或冲突需要结合原始时间记录复核，不得自动改写出生时间' as const;
const DIAGNOSTIC_SUMMARY_LIMITATION =
  '诊断汇总只整合当地时刻映射与固定偏移核验，不证明原始钟表记录、地点或时区标注必然正确' as const;
const LIMITATION_FACT_LIMITATION =
  '限制事实用于约束历史时区换算可支持的结论范围，不得被反向当作出生记录真实性、事件结果或观测精度证据' as const;
const SUMMARY_FACT_LIMITATION =
  '历史时区证据汇总只统计 IANA 规则加载、候选偏移、当地时刻映射、固定偏移核验、诊断与限制覆盖；不得按映射状态生成可信度百分比，也不证明原始钟表记录、出生地或时区标注必然正确' as const;

type WallClockParts = Omit<HistoricalTimezoneInput, 'timeZoneId' | 'fixedOffsetHours'>;

function getFormatter(timeZoneId: string) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZoneId,
      calendar: 'gregory',
      numberingSystem: 'latn',
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    throw new Error(`无法识别 IANA 时区 ${timeZoneId}。`);
  }
}

function partsAt(formatter: Intl.DateTimeFormat, timestamp: number): WallClockParts {
  const values = Object.fromEntries(
    formatter
      .formatToParts(new Date(timestamp))
      .filter((item) => item.type !== 'literal')
      .map((item) => [item.type, Number(item.value)]),
  );
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

function sameParts(first: WallClockParts, second: WallClockParts) {
  return (
    first.year === second.year &&
    first.month === second.month &&
    first.day === second.day &&
    first.hour === second.hour &&
    first.minute === second.minute &&
    first.second === second.second
  );
}

function offsetHoursAt(formatter: Intl.DateTimeFormat, timestamp: number) {
  const parts = partsAt(formatter, timestamp);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return Number(((representedAsUtc - Math.floor(timestamp / 1000) * 1000) / 3600000).toFixed(6));
}

function toIso(timestamp: number) {
  return new Date(timestamp).toISOString();
}

export function resolveHistoricalTimezone(
  input: HistoricalTimezoneInput,
): HistoricalTimezoneEvidence {
  if (!input.timeZoneId?.trim()) throw new Error('IANA 时区名不能为空。');
  const timeZoneId = input.timeZoneId.trim();
  const formatter = getFormatter(timeZoneId);
  const target: WallClockParts = {
    year: input.year,
    month: input.month,
    day: input.day,
    hour: input.hour,
    minute: input.minute,
    second: input.second,
  };
  const wallTimestamp = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
    target.second,
  );
  const wallClockDateTime = `${String(target.year).padStart(4, '0')}-${String(target.month).padStart(2, '0')}-${String(target.day).padStart(2, '0')} ${String(target.hour).padStart(2, '0')}:${String(target.minute).padStart(2, '0')}:${String(target.second).padStart(2, '0')}`;

  // 在目标时刻前后取样所有可能偏移，再反推 UTC；可同时找到秋季回拨时的两个合法时刻。
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 1) {
    offsets.add(offsetHoursAt(formatter, wallTimestamp + hours * 3600000));
  }
  const matches = [...offsets]
    .map((offset) => ({ timestamp: wallTimestamp - offset * 3600000, offset }))
    .filter((candidate) => sameParts(partsAt(formatter, candidate.timestamp), target))
    .sort((first, second) => first.timestamp - second.timestamp);

  if (!matches.length) {
    throw new Error(
      `${timeZoneId} 的当地钟表时间 ${wallClockDateTime} 不存在，通常由夏令时跳时造成。`,
    );
  }

  const fixedOffsetHours = input.fixedOffsetHours;
  const fixedOffsetMatch =
    fixedOffsetHours === undefined
      ? undefined
      : matches.find((candidate) => Math.abs(fixedOffsetHours - candidate.offset) <= 1e-6);
  const selected = fixedOffsetMatch ?? matches[0];
  const offsetConflict = fixedOffsetHours !== undefined && !fixedOffsetMatch;
  const ambiguityResolvedByFixedOffset = matches.length > 1 && fixedOffsetMatch !== undefined;
  const diagnostics = [
    matches.length > 1
      ? ambiguityResolvedByFixedOffset
        ? `该当地时刻因夏令时回拨对应 ${matches.length} 个 UTC 时刻；已按固定偏移 UTC${fixedOffsetHours! >= 0 ? '+' : ''}${fixedOffsetHours} 选择 ${toIso(selected.timestamp)}。`
        : `该当地时刻因夏令时回拨对应 ${matches.length} 个 UTC 时刻；未提供可用于消歧的固定偏移，默认选择较早的 ${toIso(selected.timestamp)}，调用方应结合出生记录确认。`
      : '该当地时刻在当前 IANA 时区数据库中只有一个 UTC 对应时刻。',
  ];
  if (offsetConflict) {
    diagnostics.push(
      `输入固定偏移 UTC${fixedOffsetHours! >= 0 ? '+' : ''}${fixedOffsetHours} 与 IANA 历史偏移 UTC${selected.offset >= 0 ? '+' : ''}${selected.offset} 不一致。`,
    );
  }
  const source = 'IANA 时区规则由 Intl.DateTimeFormat 解析；不使用按当前时区反推历史的固定偏移假设';
  const calculationSteps: HistoricalTimezoneCalculationStep[] = [
    {
      key: 'historical-timezone:calculation:database',
      stage: '时区规则加载',
      status: '已解析',
      dependsOnStepKeys: [],
      inputs: { timeZoneId, wallClockDateTime },
      result: { database: 'Intl.DateTimeFormat 所带 IANA Time Zone Database' },
      promptText: `按 IANA 时区 ${timeZoneId} 加载${wallClockDateTime}对应的历史规则`,
      sources: ['IANA Time Zone Database', 'Intl.DateTimeFormat 时区解析'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'historical-timezone:calculation:candidate-offsets',
      stage: '候选偏移采样',
      status: '已解析',
      dependsOnStepKeys: ['historical-timezone:calculation:database'],
      inputs: { sampleWindowHours: 36, sampleStepHours: 1 },
      result: {
        candidateOffsetCount: offsets.size,
        candidateOffsetsHours: [...offsets].sort((first, second) => first - second).join('、'),
      },
      promptText: `在目标时刻前后36小时按1小时采样，取得${offsets.size}个候选历史偏移`,
      sources: ['IANA 历史偏移采样'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'historical-timezone:calculation:wall-clock-match',
      stage: '当地时刻匹配',
      status: matches.length > 1 ? '存在歧义' : '已匹配',
      dependsOnStepKeys: ['historical-timezone:calculation:candidate-offsets'],
      inputs: { wallClockDateTime, candidateOffsetCount: offsets.size },
      result: {
        matchCount: matches.length,
        selectedUtcDateTime: toIso(selected.timestamp),
        resolvedOffsetHours: selected.offset,
      },
      promptText:
        matches.length > 1
          ? ambiguityResolvedByFixedOffset
            ? `当地钟表时间${wallClockDateTime}匹配到${matches.length}个 UTC 时刻，按固定偏移 UTC${fixedOffsetHours! >= 0 ? '+' : ''}${fixedOffsetHours}选择${toIso(selected.timestamp)}`
            : `当地钟表时间${wallClockDateTime}匹配到${matches.length}个 UTC 时刻，未提供可用于消歧的固定偏移，暂取较早的${toIso(selected.timestamp)}`
          : `当地钟表时间${wallClockDateTime}唯一映射为 UTC ${toIso(selected.timestamp)}`,
      sources: ['IANA 当地钟表时间反向匹配'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'historical-timezone:calculation:fixed-offset-check',
      stage: '偏移核验',
      status: fixedOffsetHours === undefined ? '未核验' : offsetConflict ? '存在冲突' : '已核验',
      dependsOnStepKeys: ['historical-timezone:calculation:wall-clock-match'],
      inputs: {
        resolvedOffsetHours: selected.offset,
        ...(fixedOffsetHours === undefined ? {} : { fixedOffsetHours }),
      },
      result: { offsetConflict },
      promptText:
        fixedOffsetHours === undefined
          ? '未另给固定 UTC 偏移，仅保留 IANA 历史偏移结果'
          : offsetConflict
            ? `固定偏移 UTC${fixedOffsetHours >= 0 ? '+' : ''}${fixedOffsetHours} 与 IANA 历史偏移 UTC${selected.offset >= 0 ? '+' : ''}${selected.offset}不一致`
            : `固定偏移与 IANA 历史偏移一致，均为 UTC${selected.offset >= 0 ? '+' : ''}${selected.offset}`,
      sources: ['明确固定偏移与 IANA 历史偏移比较'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
  ];
  const diagnosticFacts: HistoricalTimezoneDiagnosticFact[] = [
    {
      key: 'historical-timezone:diagnostic:wall-clock-mapping',
      type: '当地时刻映射',
      status: matches.length > 1 ? '存在回拨歧义' : '唯一映射',
      ownerFactKeys: ['historical-timezone:calculation:wall-clock-match'],
      ownerStepKeys: ['historical-timezone:calculation:wall-clock-match'],
      promptText: diagnostics[0],
      sources: ['IANA 当地钟表时间反向匹配'],
      limitation: DIAGNOSTIC_FACT_LIMITATION,
    },
    {
      key: 'historical-timezone:diagnostic:fixed-offset',
      type: '固定偏移核验',
      status: fixedOffsetHours === undefined ? '未核验' : offsetConflict ? '存在冲突' : '无冲突',
      ownerFactKeys: ['historical-timezone:calculation:fixed-offset-check'],
      ownerStepKeys: ['historical-timezone:calculation:fixed-offset-check'],
      promptText:
        fixedOffsetHours === undefined
          ? '没有另列固定 UTC 偏移，无法进行偏移一致性比较'
          : offsetConflict
            ? diagnostics[1]
            : `固定偏移与 IANA 历史偏移一致，均为 UTC${selected.offset >= 0 ? '+' : ''}${selected.offset}。`,
      sources: ['明确固定偏移与 IANA 历史偏移比较'],
      limitation: DIAGNOSTIC_FACT_LIMITATION,
    },
  ];
  const summaryStatus: HistoricalTimezoneDiagnosticSummaryFact['status'] =
    matches.length > 1
      ? fixedOffsetHours === undefined
        ? '存在回拨歧义且未核验固定偏移'
        : offsetConflict
          ? '回拨歧义且偏移冲突'
          : '存在回拨歧义'
      : fixedOffsetHours === undefined
        ? '唯一映射且未核验固定偏移'
        : offsetConflict
          ? '唯一但偏移冲突'
          : '唯一且无冲突';
  const diagnosticSummaryFact: HistoricalTimezoneDiagnosticSummaryFact = {
    key: 'historical-timezone:diagnostic-summary',
    status: summaryStatus,
    factKeys: diagnosticFacts.map((item) => item.key),
    promptText: `历史时区诊断为${summaryStatus}；采用 UTC ${toIso(selected.timestamp)}、偏移 UTC${selected.offset >= 0 ? '+' : ''}${selected.offset}`,
    sources: ['当地时刻映射与固定偏移核验汇总'],
    limitation: DIAGNOSTIC_SUMMARY_LIMITATION,
  };
  const limitations = [
    'IANA 历史规则随所用时区数据库版本更新，极早期地方平太阳时或资料修订可能出现版本差异。',
    '回拨歧义在固定偏移匹配候选时按该偏移消歧；否则默认选择较早 UTC 时刻只用于保持计算确定性，仍应结合原始钟表记录确认。',
    '固定偏移冲突只表示两种时间口径不一致，不自动证明其中任一记录错误。',
  ];
  const limitationFacts: HistoricalTimezoneLimitationFact[] = [
    {
      key: 'historical-timezone:limitation:database-version',
      type: '数据库版本边界',
      status: '适用',
      ownerFactKeys: ['historical-timezone:calculation:database'],
      ownerStepKeys: ['historical-timezone:calculation:database'],
      promptText: limitations[0],
      sources: ['IANA Time Zone Database 更新机制'],
      limitation: LIMITATION_FACT_LIMITATION,
    },
    {
      key: 'historical-timezone:limitation:ambiguous-selection',
      type: '回拨选择边界',
      status: '适用',
      ownerFactKeys: ['historical-timezone:calculation:wall-clock-match'],
      ownerStepKeys: ['historical-timezone:calculation:wall-clock-match'],
      promptText: limitations[1],
      sources: ['夏令时回拨的重复当地时刻规则'],
      limitation: LIMITATION_FACT_LIMITATION,
    },
    {
      key: 'historical-timezone:limitation:fixed-offset',
      type: '固定偏移边界',
      status: '适用',
      ownerFactKeys: ['historical-timezone:calculation:fixed-offset-check'],
      ownerStepKeys: ['historical-timezone:calculation:fixed-offset-check'],
      promptText: limitations[2],
      sources: ['固定 UTC 偏移与历史时区规则的口径差异'],
      limitation: LIMITATION_FACT_LIMITATION,
    },
  ];
  const summaryFact: HistoricalTimezoneSummaryFact = {
    key: 'historical-timezone:evidence-summary',
    status: summaryStatus,
    factKeys: [
      ...calculationSteps.map((item) => item.key),
      ...diagnosticFacts.map((item) => item.key),
      diagnosticSummaryFact.key,
      ...limitationFacts.map((item) => item.key),
    ],
    calculationStepCount: calculationSteps.length,
    diagnosticFactCount: diagnosticFacts.length,
    limitationFactCount: limitationFacts.length,
    promptText: `历史时区证据状态为${summaryStatus}；记录计算步骤${calculationSteps.length}项、诊断事实${diagnosticFacts.length}项、限制${limitationFacts.length}项`,
    sources: ['IANA 历史时区计算链、当地时刻映射、偏移核验、诊断与限制事实汇总'],
    limitation: SUMMARY_FACT_LIMITATION,
  };

  return {
    key: `historical-timezone:${timeZoneId}:${wallClockDateTime}`,
    timeZoneId,
    database: 'Intl.DateTimeFormat 所带 IANA Time Zone Database',
    status: matches.length > 1 ? 'ambiguous' : 'unique',
    selectedUtcTimestamp: selected.timestamp,
    selectedUtcDateTime: toIso(selected.timestamp),
    resolvedOffsetHours: selected.offset,
    possibleUtcDateTimes: matches.map((item) => toIso(item.timestamp)),
    possibleOffsetsHours: matches.map((item) => item.offset),
    fixedOffsetHours,
    ambiguityResolvedByFixedOffset,
    offsetConflict,
    diagnostics,
    calculationSteps,
    calculationChain: calculationSteps.map((item) => item.promptText),
    diagnosticFacts,
    diagnosticSummaryFact,
    summaryFact,
    limitations,
    limitationFacts,
    source,
    promptText: `历史时区证据：${timeZoneId} 的当地钟表时间${wallClockDateTime}映射为 UTC ${toIso(selected.timestamp)}，历史偏移 UTC${selected.offset >= 0 ? '+' : ''}${selected.offset}。计算链：${calculationSteps.map((item) => item.promptText).join(' → ')}。诊断汇总：${diagnosticSummaryFact.promptText}。证据汇总：${summaryFact.promptText}。来源：${source}。限制：${limitations.join('；')}`,
  };
}
