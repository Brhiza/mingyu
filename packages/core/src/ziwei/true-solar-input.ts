import {
  resolveTrueSolarBirthTime,
  type TrueSolarTimeEvidenceFields,
} from '../calendar/true-solar-time';

export interface ZiweiTrueSolarInput {
  dateType: 'solar' | 'lunar';
  year: string;
  month: string;
  day: string;
  isLeapMonth: boolean;
  birthHour: string;
  birthMinute: string;
  birthLongitude: string;
  timezone?: number;
  timeZoneId?: string;
  applyChinaDst?: boolean;
}

export interface ZiweiTrueSolarBirth {
  /** 真太阳时校正后的公历日期，格式 YYYY-MM-DD。 */
  birthDate: string;
  /** 紫微排盘使用的时辰索引，范围 0-12。 */
  birthTimeIndex: number;
  birthTime: { hour: number; minute: number };
  /** 历法换算、夏令时、经度时差、均时差、跨日与时辰映射的统一证据。 */
  trueSolarEvidence: TrueSolarTimeEvidenceFields;
}

function readIntegerText(value: string, label: string) {
  const text = value.trim();
  if (!text || !/^\d+$/.test(text)) throw new Error(`${label}必须是整数。`);
  return Number(text);
}

function readNumberText(value: string, label: string) {
  const text = value.trim();
  if (!text || !/^[-+]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) {
    throw new Error(`${label}必须是数字。`);
  }
  return Number(text);
}

/** 将紫微出生资料按经度校正为真太阳时日期和时辰索引。 */
export function resolveZiweiTrueSolarBirth(input: ZiweiTrueSolarInput): ZiweiTrueSolarBirth {
  if (
    !input.year.trim() ||
    !input.month.trim() ||
    !input.day.trim() ||
    !input.birthHour.trim() ||
    !input.birthMinute.trim() ||
    !input.birthLongitude.trim()
  ) {
    throw new Error('真太阳时缺少精准时间或经度。');
  }
  const year = readIntegerText(input.year, '出生年份');
  const month = readIntegerText(input.month, '出生月份');
  const day = readIntegerText(input.day, '出生日期');
  const birthHour = readIntegerText(input.birthHour, '出生小时');
  const birthMinute = readIntegerText(input.birthMinute, '出生分钟');
  const birthLongitude = readNumberText(input.birthLongitude, '出生经度');
  const resolved = resolveTrueSolarBirthTime({
    dateType: input.dateType,
    year,
    month,
    day,
    hour: birthHour,
    minute: birthMinute,
    isLeapMonth: input.isLeapMonth,
    longitude: birthLongitude,
    timezone: input.timezone,
    timeZoneId: input.timeZoneId,
    applyChinaDst: input.applyChinaDst,
  });
  const corrected = resolved.correctedTime;
  return {
    birthDate: `${corrected.year}-${String(corrected.month).padStart(2, '0')}-${String(corrected.day).padStart(2, '0')}`,
    birthTimeIndex: resolved.timeIndex,
    birthTime: { hour: corrected.hour, minute: corrected.minute },
    trueSolarEvidence: {
      key: resolved.key,
      status: resolved.status,
      calculationSteps: resolved.calculationSteps,
      calculationChain: resolved.calculationChain,
      correctionFacts: resolved.correctionFacts,
      summaryFact: resolved.summaryFact,
      limitations: resolved.limitations,
      limitationFacts: resolved.limitationFacts,
      timezoneEvidence: resolved.timezoneEvidence,
      source: resolved.source,
      promptText: resolved.promptText,
    },
  };
}
