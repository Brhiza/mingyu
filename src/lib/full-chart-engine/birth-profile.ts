import {
  parseBaziReverseSource,
  resolveBaziReverseTimeRange,
  type BaziReverseSource,
} from '@/lib/bazi-reverse-input';
import { FRONTEND_DEFAULT_TIME_ZONE_ID } from '@/lib/time-policy';
import type { QueryInputState } from '@/lib/query-state';
import { buildPersonFromInput } from './bazi';
import type {
  BirthProfile,
  BirthProfileLocation,
  BirthProfileTimeRange,
} from 'mingyu-core/profile';

export type FrontendBirthSubject = 'primary' | 'partner';

type FrontendBirthFields = {
  name: string;
  gender: QueryInputState['gender'];
  dateType: QueryInputState['dateType'];
  year: string;
  month: string;
  day: string;
  timeIndex: QueryInputState['timeIndex'];
  isLeapMonth: boolean;
  useTrueSolarTime: boolean;
  birthHour: string;
  birthMinute: string;
  birthSecond: string;
  birthReverseSource: string;
  birthPlace: string;
  birthLongitude: string;
  birthLatitude: string;
};

const RANGE_OFFSET_HOURS = 8 as const;

function getBirthFields(
  input: QueryInputState,
  subject: FrontendBirthSubject,
): FrontendBirthFields {
  if (subject === 'primary') {
    return {
      name: input.name,
      gender: input.gender,
      dateType: input.dateType,
      year: input.year,
      month: input.month,
      day: input.day,
      timeIndex: input.timeIndex,
      isLeapMonth: input.isLeapMonth,
      useTrueSolarTime: input.useTrueSolarTime,
      birthHour: input.birthHour,
      birthMinute: input.birthMinute,
      birthSecond: input.birthSecond,
      birthReverseSource: input.birthReverseSource,
      birthPlace: input.birthPlace,
      birthLongitude: input.birthLongitude,
      birthLatitude: input.birthLatitude,
    };
  }

  return {
    name: input.partnerName,
    gender: input.partnerGender,
    dateType: input.partnerDateType,
    year: input.partnerYear,
    month: input.partnerMonth,
    day: input.partnerDay,
    timeIndex: input.partnerTimeIndex,
    isLeapMonth: input.partnerIsLeapMonth,
    useTrueSolarTime: input.partnerUseTrueSolarTime,
    birthHour: input.partnerBirthHour,
    birthMinute: input.partnerBirthMinute,
    birthSecond: input.partnerBirthSecond,
    birthReverseSource: input.partnerBirthReverseSource,
    birthPlace: input.partnerBirthPlace,
    birthLongitude: input.partnerBirthLongitude,
    birthLatitude: input.partnerBirthLatitude,
  };
}

function parseOptionalCoordinate(value: string, label: string, min: number, max: number) {
  const text = value.trim();
  if (!text) return undefined;
  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new RangeError(`${label}需在 ${min} 到 ${max} 之间。`);
  }
  return parsed;
}

function buildLocation(
  fields: FrontendBirthFields,
  fixedBeijing: boolean,
): BirthProfileLocation | undefined {
  const name = fields.birthPlace.trim();
  const longitude = parseOptionalCoordinate(fields.birthLongitude, '出生经度', -180, 180);
  const latitude = parseOptionalCoordinate(fields.birthLatitude, '出生纬度', -90, 90);

  // 仅有地点名称时不创建会被核心地点校验拒绝的半成品 location。
  if (longitude === undefined && latitude === undefined) return undefined;
  if (longitude === undefined) throw new RangeError('出生地点提供纬度时必须同时提供经度。');

  return {
    ...(name ? { name } : {}),
    longitude,
    ...(latitude === undefined ? {} : { latitude }),
    ...(fixedBeijing
      ? { timezone: RANGE_OFFSET_HOURS }
      : { timeZoneId: FRONTEND_DEFAULT_TIME_ZONE_ID }),
  };
}

function getRangeSource(
  rawValue: string,
  subject: FrontendBirthSubject,
): BirthProfileTimeRange | null {
  const raw = rawValue.trim();
  if (!raw) return null;

  const source = parseBaziReverseSource(raw);
  if (!source) {
    throw new Error(
      `${subject === 'primary' ? '本人' : '对方'}四柱反推来源无效，无法建立出生档案。`,
    );
  }
  try {
    return resolveBaziReverseTimeRange(raw);
  } catch (error) {
    throw new Error(
      `${subject === 'primary' ? '本人' : '对方'}四柱反推来源无法恢复为完整的北京时间半开区间：${
        error instanceof Error ? error.message : '来源边界无效。'
      }`,
      { cause: error },
    );
  }
}

function buildPointDraft(fields: FrontendBirthFields) {
  return {
    gender: fields.gender,
    year: fields.year,
    month: fields.month,
    day: fields.day,
    timeIndex: fields.timeIndex,
    dateType: fields.dateType,
    isLeapMonth: fields.isLeapMonth,
    useTrueSolarTime: fields.useTrueSolarTime,
    birthHour: fields.birthHour,
    birthMinute: fields.birthMinute,
    birthSecond: fields.birthSecond,
    birthPlace: fields.birthPlace,
    birthLongitude: fields.birthLongitude,
  };
}

function buildProfileFromPerson(
  fields: FrontendBirthFields,
  person: ReturnType<typeof buildPersonFromInput>,
  fixedBeijing: boolean,
): BirthProfile {
  const preciseTime =
    person.birthHour !== undefined && person.birthMinute !== undefined
      ? {
          hour: person.birthHour,
          minute: person.birthMinute,
          ...(person.birthSecond === undefined ? {} : { second: person.birthSecond }),
        }
      : undefined;
  const location = buildLocation(fields, fixedBeijing);
  const profile: BirthProfile = {
    ...(fields.name.trim() ? { name: fields.name.trim() } : {}),
    gender: fields.gender,
    calendarType: fixedBeijing ? 'solar' : fields.dateType,
    year: person.year,
    month: person.month,
    day: person.day,
    ...(preciseTime ? preciseTime : {}),
    ...(!fields.useTrueSolarTime && person.timeIndex !== undefined
      ? { timeIndex: person.timeIndex }
      : {}),
    ...(fixedBeijing ? { isLeapMonth: false } : { isLeapMonth: person.isLeapMonth }),
    ...(location ? { location } : {}),
    useTrueSolarTime: fixedBeijing ? false : person.useTrueSolarTime === true,
    applyChinaDst: false,
  };
  return profile;
}

/** 判断当前结果输入是否携带有效参与人的四柱反推来源；单人状态忽略残留对方字段。 */
export function hasFrontendBirthRangeInput(input: QueryInputState): boolean {
  return Boolean(
    input.birthReverseSource.trim() ||
    (input.analysisMode === 'compatibility' && input.partnerBirthReverseSource.trim()),
  );
}

/** 将页面本人/对方输入转换为统一出生档案；机器区间来源不会退回代表时刻。 */
export function buildFrontendBirthProfile(
  input: QueryInputState,
  subject: FrontendBirthSubject,
): BirthProfile {
  const fields = getBirthFields(input, subject);
  const range = getRangeSource(fields.birthReverseSource, subject);
  if (range) {
    if (fields.dateType !== 'solar' || fields.isLeapMonth || fields.useTrueSolarTime) {
      throw new Error('四柱反推出生区间必须使用公历、非闰月和标准北京时间。');
    }
    const person = buildPersonFromInput({
      ...buildPointDraft(fields),
      dateType: 'solar',
      isLeapMonth: false,
      useTrueSolarTime: false,
    });
    return {
      ...buildProfileFromPerson(fields, person, true),
      birthTimeRange: range,
    };
  }

  const person = buildPersonFromInput(buildPointDraft(fields));
  return buildProfileFromPerson(fields, person, false);
}

export type { BaziReverseSource };
