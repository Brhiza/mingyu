import type { SolarDateTimeParts, TrueSolarTimeEvidenceFields } from '../calendar/true-solar-time';
import type { ShichenPeriod } from '../calendar/dateUtils';
import type { BirthCalendarType, BirthProfileDiagnostic } from './index';

export type BirthTimeInputMode = 'traditional-shichen' | 'precise-clock-time';
export type BirthTimePrecision = 'shichen' | 'minute';

export interface BirthTimeCalculationStep {
  key: string;
  stage: '时间输入核验' | '历法日期换算' | '真太阳时校正' | '时辰确定';
  status: '已核验' | '已换算' | '已采用' | '未请求' | '存在阻断诊断';
  dependsOnStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '出生时间步骤只证明当前明确输入如何换算为唯一日期与时辰口径；不得把传统时辰代表值当作精确分钟，不生成候选时辰、出生时间敏感性、缺时柱命盘或现实事件结论';
}

export interface BirthTimeInputFact {
  key: 'birth-profile:time-input';
  status: '明确传统时辰' | '明确精准时分';
  inputMode: BirthTimeInputMode;
  precision: BirthTimePrecision;
  timeIndex: number;
  shichenName: string;
  shichenRange: string;
  clockTime?: string;
  promptText: string;
  sources: string[];
  limitation: '出生时间输入事实只记录明确输入的是传统时辰还是精准时分；传统时辰是八字、紫微等时辰级排盘的完整输入，但不能冒充分钟级出生记录';
}

export interface BirthTimeLimitationFact {
  key: string;
  type: '时辰适用范围' | '代表时刻边界' | '真太阳时前提' | '唯一输入边界';
  status: '适用';
  ownerFactKeys: string[];
  ownerStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '出生时间限制事实用于约束传统时辰、精准时分、真太阳时与代表时刻可以支持的计算范围；不得反向生成候选盘、敏感性结果、事件概率或必然结论';
}

export interface BirthTimeSummaryFact {
  key: 'birth-profile:time-evidence-summary';
  status: '已按明确传统时辰确定' | '已按精准时分确定' | '已按真太阳时确定' | '存在阻断诊断';
  factKeys: string[];
  inputMode: BirthTimeInputMode;
  precision: BirthTimePrecision;
  usedTrueSolarTime: boolean;
  diagnosticCount: number;
  promptText: string;
  sources: string[];
  limitation: '出生时间证据汇总只说明当前唯一排盘口径和输入精度是否满足目标算法；不得把分钟精度、时辰精度或校正步骤数量解释为命盘可信度、预测准确率或现实事件概率';
}

export interface BirthTimeEvidence {
  key: string;
  status: '已确定' | '存在阻断诊断';
  inputMode: BirthTimeInputMode;
  precision: BirthTimePrecision;
  inputFact: BirthTimeInputFact;
  selectedShichen: ShichenPeriod;
  solarClockTime: SolarDateTimeParts;
  effectiveTime: SolarDateTimeParts;
  usedTrueSolarTime: boolean;
  calculationSteps: BirthTimeCalculationStep[];
  calculationChain: string[];
  summaryFact: BirthTimeSummaryFact;
  diagnostics: BirthProfileDiagnostic[];
  limitations: string[];
  limitationFacts: BirthTimeLimitationFact[];
  source: string;
  promptText: string;
}

export interface BirthTimeEvidenceInput {
  inputMode: BirthTimeInputMode;
  calendarType: BirthCalendarType;
  originalDate: { year: number; month: number; day: number; isLeapMonth: boolean };
  inputHour: number;
  inputMinute: number;
  selectedShichen: ShichenPeriod;
  solarClockTime: SolarDateTimeParts;
  effectiveTime: SolarDateTimeParts;
  usedTrueSolarTime: boolean;
  requestedTrueSolarTime: boolean;
  trueSolarEvidence?: TrueSolarTimeEvidenceFields;
  diagnostics: BirthProfileDiagnostic[];
}

const STEP_LIMITATION =
  '出生时间步骤只证明当前明确输入如何换算为唯一日期与时辰口径；不得把传统时辰代表值当作精确分钟，不生成候选时辰、出生时间敏感性、缺时柱命盘或现实事件结论' as const;
const INPUT_FACT_LIMITATION =
  '出生时间输入事实只记录明确输入的是传统时辰还是精准时分；传统时辰是八字、紫微等时辰级排盘的完整输入，但不能冒充分钟级出生记录' as const;
const LIMITATION_FACT_LIMITATION =
  '出生时间限制事实用于约束传统时辰、精准时分、真太阳时与代表时刻可以支持的计算范围；不得反向生成候选盘、敏感性结果、事件概率或必然结论' as const;
const SUMMARY_LIMITATION =
  '出生时间证据汇总只说明当前唯一排盘口径和输入精度是否满足目标算法；不得把分钟精度、时辰精度或校正步骤数量解释为命盘可信度、预测准确率或现实事件概率' as const;

function formatDateTime(time: SolarDateTimeParts): string {
  return `${time.year}-${String(time.month).padStart(2, '0')}-${String(time.day).padStart(2, '0')} ${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}:${String(time.second).padStart(2, '0')}`;
}

export function buildBirthTimeEvidence(input: BirthTimeEvidenceInput): BirthTimeEvidence {
  const precision: BirthTimePrecision =
    input.inputMode === 'traditional-shichen' ? 'shichen' : 'minute';
  const inputStepKey = 'birth-profile:time-calculation:input';
  const calendarStepKey = 'birth-profile:time-calculation:calendar';
  const trueSolarStepKey = 'birth-profile:time-calculation:true-solar-time';
  const shichenStepKey = 'birth-profile:time-calculation:shichen';
  const hasBlockingDiagnostic = input.diagnostics.some((item) => item.level === 'error');
  const inputFact: BirthTimeInputFact = {
    key: 'birth-profile:time-input',
    status: input.inputMode === 'traditional-shichen' ? '明确传统时辰' : '明确精准时分',
    inputMode: input.inputMode,
    precision,
    timeIndex: input.selectedShichen.index,
    shichenName: input.selectedShichen.name,
    shichenRange: input.selectedShichen.range,
    ...(input.inputMode === 'precise-clock-time'
      ? {
          clockTime: `${String(input.inputHour).padStart(2, '0')}:${String(input.inputMinute).padStart(2, '0')}`,
        }
      : {}),
    promptText:
      input.inputMode === 'traditional-shichen'
        ? `出生时间明确选择${input.selectedShichen.name}（${input.selectedShichen.range}），按时辰级精度定盘`
        : `出生钟表时间明确为${String(input.inputHour).padStart(2, '0')}:${String(input.inputMinute).padStart(2, '0')}，对应${input.selectedShichen.name}`,
    sources: ['明确出生时间输入', '早子时至晚子时统一时辰目录'],
    limitation: INPUT_FACT_LIMITATION,
  };
  const calculationSteps: BirthTimeCalculationStep[] = [
    {
      key: inputStepKey,
      stage: '时间输入核验',
      status: '已核验',
      dependsOnStepKeys: [],
      promptText: inputFact.promptText,
      sources: [...inputFact.sources],
      limitation: STEP_LIMITATION,
    },
    {
      key: calendarStepKey,
      stage: '历法日期换算',
      status: input.calendarType === 'lunar' ? '已换算' : '已核验',
      dependsOnStepKeys: [inputStepKey],
      promptText:
        input.calendarType === 'lunar'
          ? `农历${input.originalDate.year}年${input.originalDate.isLeapMonth ? '闰' : ''}${input.originalDate.month}月${input.originalDate.day}日换算为公历${input.solarClockTime.year}年${input.solarClockTime.month}月${input.solarClockTime.day}日`
          : `已核验公历${input.solarClockTime.year}年${input.solarClockTime.month}月${input.solarClockTime.day}日`,
      sources: ['tyme4ts 公历农历换算与日期合法性核验'],
      limitation: STEP_LIMITATION,
    },
  ];

  if (input.requestedTrueSolarTime) {
    calculationSteps.push({
      key: trueSolarStepKey,
      stage: '真太阳时校正',
      status: input.usedTrueSolarTime
        ? '已采用'
        : hasBlockingDiagnostic
          ? '存在阻断诊断'
          : '未请求',
      dependsOnStepKeys: [calendarStepKey],
      promptText: input.usedTrueSolarTime
        ? `出生钟表时间已按经度、时区、均时差与历史夏令时口径校正为${formatDateTime(input.effectiveTime)}`
        : `已请求真太阳时，但当前资料存在阻断诊断：${input.diagnostics.map((item) => item.message).join('；')}`,
      sources: input.trueSolarEvidence
        ? [input.trueSolarEvidence.source]
        : ['真太阳时需要精准时分、出生地经度与法定时区'],
      limitation: STEP_LIMITATION,
    });
  }

  calculationSteps.push({
    key: shichenStepKey,
    stage: '时辰确定',
    status: hasBlockingDiagnostic ? '存在阻断诊断' : '已采用',
    dependsOnStepKeys: [input.requestedTrueSolarTime ? trueSolarStepKey : calendarStepKey],
    promptText: hasBlockingDiagnostic
      ? `当前资料未满足所请求时间口径，不能进入排盘：${input.diagnostics.map((item) => item.message).join('；')}`
      : input.inputMode === 'traditional-shichen'
        ? `直接采用已确认的${input.selectedShichen.name}，时辰索引为${input.selectedShichen.index}；日期换算所用${String(input.inputHour).padStart(2, '0')}:${String(input.inputMinute).padStart(2, '0')}只是该时辰的代表时刻，不表示精确出生分钟`
        : `按${formatDateTime(input.effectiveTime)}确定为${input.selectedShichen.name}，时辰索引为${input.selectedShichen.index}`,
    sources: ['统一时辰目录与早晚子时拆分口径'],
    limitation: STEP_LIMITATION,
  });

  const limitations = [
    '明确传统时辰可直接用于八字、紫微等时辰级排盘并生成完整时柱，不属于出生时间缺失。',
    '传统时辰模式为完成历法日期换算会使用该时辰的代表时刻；代表时刻不等于精确出生分钟记录，不能用于星盘、七政四余或真太阳时校正。',
    '只有明确提供小时、分钟和出生地资料时才可采用真太阳时；资料不全时应拒绝进入该计算，不生成候选时辰。',
    '当前结果只采用明确输入形成的唯一时间口径，不生成出生时间敏感性、候选时辰或缺时柱命盘。',
  ];
  const ownerStepKeys = calculationSteps.map((item) => item.key);
  const limitationFacts: BirthTimeLimitationFact[] = [
    {
      key: 'birth-profile:time-limitation:shichen-scope',
      type: '时辰适用范围',
      status: '适用',
      ownerFactKeys: [inputFact.key],
      ownerStepKeys,
      promptText: limitations[0],
      sources: ['八字与紫微按传统时辰确定时柱的输入规则'],
      limitation: LIMITATION_FACT_LIMITATION,
    },
    {
      key: 'birth-profile:time-limitation:representative-time',
      type: '代表时刻边界',
      status: '适用',
      ownerFactKeys: [inputFact.key],
      ownerStepKeys: [calendarStepKey, shichenStepKey],
      promptText: limitations[1],
      sources: ['传统时辰到日期时间对象的适配边界'],
      limitation: LIMITATION_FACT_LIMITATION,
    },
    {
      key: 'birth-profile:time-limitation:true-solar-time',
      type: '真太阳时前提',
      status: '适用',
      ownerFactKeys: [inputFact.key],
      ownerStepKeys,
      promptText: limitations[2],
      sources: ['真太阳时输入完整性规则'],
      limitation: LIMITATION_FACT_LIMITATION,
    },
    {
      key: 'birth-profile:time-limitation:single-input',
      type: '唯一输入边界',
      status: '适用',
      ownerFactKeys: [inputFact.key],
      ownerStepKeys,
      promptText: limitations[3],
      sources: ['唯一明确出生时间口径'],
      limitation: LIMITATION_FACT_LIMITATION,
    },
  ];
  const summaryStatus: BirthTimeSummaryFact['status'] = hasBlockingDiagnostic
    ? '存在阻断诊断'
    : input.usedTrueSolarTime
      ? '已按真太阳时确定'
      : input.inputMode === 'traditional-shichen'
        ? '已按明确传统时辰确定'
        : '已按精准时分确定';
  const summaryFact: BirthTimeSummaryFact = {
    key: 'birth-profile:time-evidence-summary',
    status: summaryStatus,
    factKeys: [
      inputFact.key,
      ...calculationSteps.map((item) => item.key),
      ...(input.trueSolarEvidence ? [input.trueSolarEvidence.summaryFact.key] : []),
      ...limitationFacts.map((item) => item.key),
    ],
    inputMode: input.inputMode,
    precision,
    usedTrueSolarTime: input.usedTrueSolarTime,
    diagnosticCount: input.diagnostics.length,
    promptText: `${summaryStatus}：采用${input.selectedShichen.name}，输入精度为${precision === 'shichen' ? '传统时辰' : '分钟'}，真太阳时${input.usedTrueSolarTime ? '已采用' : input.requestedTrueSolarTime ? '未完成' : '未请求'}，阻断诊断${input.diagnostics.filter((item) => item.level === 'error').length}项`,
    sources: ['出生时间输入、历法换算、时辰映射与真太阳时状态逐项汇总'],
    limitation: SUMMARY_LIMITATION,
  };
  const source = Array.from(
    new Set([
      ...inputFact.sources,
      ...calculationSteps.flatMap((item) => item.sources),
      ...(input.trueSolarEvidence ? [input.trueSolarEvidence.source] : []),
    ]),
  ).join('、');
  const promptText = [
    '【出生时间口径结构化证据】',
    `【时间输入】${inputFact.promptText}。`,
    `【计算链】${calculationSteps.map((item) => item.promptText).join(' → ')}。`,
    `【证据汇总】${summaryFact.promptText}。`,
    `【来源】${source}。`,
    `【解释限制】${limitations.join('；')}。`,
  ].join('\n');

  return {
    key: `birth-profile:time:${input.calendarType}:${input.originalDate.year}-${input.originalDate.month}-${input.originalDate.day}:${input.inputMode}:${input.selectedShichen.index}`,
    status: hasBlockingDiagnostic ? '存在阻断诊断' : '已确定',
    inputMode: input.inputMode,
    precision,
    inputFact,
    selectedShichen: { ...input.selectedShichen },
    solarClockTime: { ...input.solarClockTime },
    effectiveTime: { ...input.effectiveTime },
    usedTrueSolarTime: input.usedTrueSolarTime,
    calculationSteps,
    calculationChain: calculationSteps.map((item) => item.promptText),
    summaryFact,
    diagnostics: input.diagnostics.map((item) => ({ ...item })),
    limitations,
    limitationFacts,
    source,
    promptText,
  };
}
