import type { QueryInputState, QueryPromptState } from '@/lib/query-state';
import { BIRTH_TIME_OPTIONS } from '@/lib/birth-time';
import { FRONTEND_DEFAULT_TIME_ZONE_ID } from '@/lib/time-policy';
import type { QimenLifetimeInput } from 'mingyu-core/types';
import { buildResidentialCoreInput } from '@/lib/residential-fengshui-chart';

/**
 * AI 自动补算时锁定的主体快照。模型只能改变目标时段、问题和解读范围，
 * 不能借补算机会更换出生资料或计算口径。
 */
export type ReadingSubjectSnapshot = {
  id: string;
  source: QueryPromptState['promptSource'];
  lockedInputs: Record<string, Record<string, unknown>>;
  allowedMethods: string[];
  range: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function numberOrString(value: string) {
  return value === '' ? '' : Number(value);
}

function addIfPresent(target: Record<string, unknown>, key: string, value: unknown) {
  if (value !== '' && value !== undefined && value !== null) target[key] = value;
}

function buildBirthInputs(input: QueryInputState, includeName = false) {
  const result: Record<string, unknown> = {
    gender: input.gender,
    year: numberOrString(input.year),
    month: numberOrString(input.month),
    day: numberOrString(input.day),
    dateType: input.dateType,
    isLeapMonth: input.isLeapMonth,
    useTrueSolarTime: input.useTrueSolarTime,
    timeZoneId: FRONTEND_DEFAULT_TIME_ZONE_ID,
    birthPlace: input.birthPlace,
  };
  if (includeName) result.name = input.name;
  if (input.timeIndex !== '') result.timeIndex = input.timeIndex;
  addIfPresent(result, 'birthHour', numberOrString(input.birthHour));
  addIfPresent(result, 'birthMinute', numberOrString(input.birthMinute));
  addIfPresent(result, 'birthLongitude', numberOrString(input.birthLongitude));
  addIfPresent(result, 'birthLatitude', numberOrString(input.birthLatitude));
  return result;
}

function buildPartnerBirthInputs(input: QueryInputState, includeName = false) {
  const result: Record<string, unknown> = {
    gender: input.partnerGender,
    year: numberOrString(input.partnerYear),
    month: numberOrString(input.partnerMonth),
    day: numberOrString(input.partnerDay),
    dateType: input.partnerDateType,
    isLeapMonth: input.partnerIsLeapMonth,
    useTrueSolarTime: input.partnerUseTrueSolarTime,
    timeZoneId: FRONTEND_DEFAULT_TIME_ZONE_ID,
    birthPlace: input.partnerBirthPlace,
  };
  if (includeName) result.name = input.partnerName;
  if (input.partnerTimeIndex !== '') result.timeIndex = input.partnerTimeIndex;
  addIfPresent(result, 'birthHour', numberOrString(input.partnerBirthHour));
  addIfPresent(result, 'birthMinute', numberOrString(input.partnerBirthMinute));
  addIfPresent(result, 'birthLongitude', numberOrString(input.partnerBirthLongitude));
  addIfPresent(result, 'birthLatitude', numberOrString(input.partnerBirthLatitude));
  return result;
}

function buildAstrolabeInputs(input: QueryInputState) {
  const result: Record<string, unknown> = {
    name: input.name,
    gender: input.gender,
    year: numberOrString(input.year),
    month: numberOrString(input.month),
    day: numberOrString(input.day),
    useTrueSolarTime: input.useTrueSolarTime,
    timeZoneId: FRONTEND_DEFAULT_TIME_ZONE_ID,
    locationName: input.birthPlace,
  };
  if (input.birthHour !== '') result.hour = Number(input.birthHour);
  if (input.birthMinute !== '') result.minute = Number(input.birthMinute);
  addIfPresent(result, 'latitude', numberOrString(input.birthLatitude));
  addIfPresent(result, 'longitude', numberOrString(input.birthLongitude));
  return result;
}

function buildPartnerAstrolabeInputs(input: QueryInputState) {
  const result: Record<string, unknown> = {
    name: input.partnerName,
    gender: input.partnerGender,
    year: numberOrString(input.partnerYear),
    month: numberOrString(input.partnerMonth),
    day: numberOrString(input.partnerDay),
    useTrueSolarTime: input.partnerUseTrueSolarTime,
    timeZoneId: FRONTEND_DEFAULT_TIME_ZONE_ID,
    locationName: input.partnerBirthPlace,
  };
  if (input.partnerBirthHour !== '') result.hour = Number(input.partnerBirthHour);
  if (input.partnerBirthMinute !== '') result.minute = Number(input.partnerBirthMinute);
  addIfPresent(result, 'latitude', numberOrString(input.partnerBirthLatitude));
  addIfPresent(result, 'longitude', numberOrString(input.partnerBirthLongitude));
  return result;
}

function buildQizhengInputs(input: QueryInputState) {
  const result: Record<string, unknown> = {
    gender: input.gender,
    year: numberOrString(input.year),
    month: numberOrString(input.month),
    day: numberOrString(input.day),
    timeZoneId: FRONTEND_DEFAULT_TIME_ZONE_ID,
    useTrueSolarTime: input.useTrueSolarTime,
  };
  addIfPresent(result, 'hour', numberOrString(input.birthHour));
  addIfPresent(result, 'minute', numberOrString(input.birthMinute));
  addIfPresent(result, 'latitude', numberOrString(input.birthLatitude));
  addIfPresent(result, 'longitude', numberOrString(input.birthLongitude));
  return result;
}

function buildResidentialInputs(input: QueryInputState, prompt: QueryPromptState) {
  const birthYear = numberOrString(input.year);
  const birthMonth = numberOrString(input.month);
  const birthDay = numberOrString(input.day);
  const hasBirth =
    typeof birthYear === 'number' &&
    typeof birthMonth === 'number' &&
    typeof birthDay === 'number' &&
    Number.isInteger(birthYear) &&
    Number.isInteger(birthMonth) &&
    Number.isInteger(birthDay);
  const houseYear = numberOrString(prompt.residentialHouseYear);
  const doorToInteriorDegree = numberOrString(prompt.bazhaiFacingDegree);
  return buildResidentialCoreInput({
    birthData: hasBirth
      ? {
          year: Number(birthYear),
          month: Number(birthMonth),
          day: Number(birthDay),
          gender: input.gender,
        }
      : undefined,
    ...(typeof houseYear === 'number' && Number.isInteger(houseYear) ? { houseYear } : {}),
    ...(typeof doorToInteriorDegree === 'number' && Number.isFinite(doorToInteriorDegree)
      ? { doorToInteriorDegree }
      : {}),
  });
}

export function buildQimenLifetimeInputs(input: QueryInputState): QimenLifetimeInput {
  let hour = 12;
  let minute = 0;
  if (input.useTrueSolarTime && input.birthHour !== '') {
    hour = Number(input.birthHour);
    minute = input.birthMinute === '' ? 0 : Number(input.birthMinute);
  } else if (input.timeIndex !== '') {
    const option = BIRTH_TIME_OPTIONS[Number(input.timeIndex)];
    if (option) {
      hour = option.hour;
      minute = option.minute;
    }
  }

  const result: QimenLifetimeInput = {
    birthDateTime: `${String(Number(input.year)).padStart(4, '0')}-${String(Number(input.month)).padStart(2, '0')}-${String(Number(input.day)).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`,
    timeZoneId: FRONTEND_DEFAULT_TIME_ZONE_ID,
    calendarType: input.dateType,
    isLeapMonth: input.isLeapMonth,
    timeStandard: input.useTrueSolarTime ? 'trueSolar' : 'civil',
    applyChinaDst: false,
    method: 'zhuanpan',
    juMethod: 'chaibu',
    stagePolicy: {
      model: 'pillarFourLimits',
      anchorRule: 'birthInstant',
      ageSystem: 'fullYears',
      yearsPerStage: 15,
    },
    name: input.name,
    gender: input.gender,
  };
  if (input.useTrueSolarTime && input.birthLongitude !== '') {
    result.location = {
      longitude: Number(input.birthLongitude),
      ...(input.birthLatitude === '' ? {} : { latitude: Number(input.birthLatitude) }),
      ...(input.birthPlace ? { locationName: input.birthPlace } : {}),
    };
  }
  return result;
}

export function buildReadingSubject(
  input: QueryInputState,
  prompt: QueryPromptState,
): ReadingSubjectSnapshot {
  const lockedInputs: Record<string, Record<string, unknown>> = {};
  const allowedMethods: string[] = [];
  if (prompt.promptSource === 'bazi' || prompt.promptSource === 'bazi-ziwei') {
    lockedInputs.bazi = buildBirthInputs(input);
    if (input.analysisMode === 'compatibility') {
      lockedInputs.baziPartner = buildPartnerBirthInputs(input);
    }
    allowedMethods.push('bazi');
  }
  if (prompt.promptSource === 'ziwei' || prompt.promptSource === 'bazi-ziwei') {
    lockedInputs.ziwei = buildBirthInputs(input, true);
    if (input.analysisMode === 'compatibility') {
      lockedInputs.ziweiPartner = buildPartnerBirthInputs(input, true);
    }
    allowedMethods.push('ziwei');
  }
  if (prompt.promptSource === 'astrolabe') {
    lockedInputs.astrolabe = buildAstrolabeInputs(input);
    if (input.analysisMode === 'compatibility') {
      lockedInputs.astrolabePartner = buildPartnerAstrolabeInputs(input);
    }
    allowedMethods.push('astrolabe');
  }
  if (prompt.promptSource === 'qizheng') {
    lockedInputs['qi-zheng'] = buildQizhengInputs(input);
    allowedMethods.push('qi-zheng');
  }
  if (prompt.promptSource === 'qimen-lifetime') {
    lockedInputs['qimen-lifetime'] = { ...buildQimenLifetimeInputs(input) };
    allowedMethods.push('qimen-lifetime');
  }
  if (prompt.promptSource === 'bazhai') {
    lockedInputs.fengshui = buildResidentialInputs(input, prompt);
    allowedMethods.push('fengshui');
  }

  const range = {
    source: prompt.promptSource,
    baziFortuneScope: prompt.baziFortuneScope,
    baziFortuneCycleIndex: prompt.baziFortuneCycleIndex,
    baziFortuneYear: prompt.baziFortuneYear,
    baziFortuneMonth: prompt.baziFortuneMonth,
    baziFortuneDay: prompt.baziFortuneDay,
    ziweiScope: prompt.ziweiScope,
    ziweiScopeDate: prompt.ziweiScopeDate,
    astrolabeScope: prompt.astrolabeScope,
    astrolabeScopeDate: prompt.astrolabeScopeDate,
    residentialFlowYear: prompt.residentialFlowYear,
    residentialFlowMonth: prompt.residentialFlowMonth,
    residentialFlowDay: prompt.residentialFlowDay,
  };
  const fingerprint = stableStringify({ source: prompt.promptSource, lockedInputs, range });
  return {
    id: `subject-${hashText(fingerprint)}`,
    source: prompt.promptSource,
    lockedInputs,
    allowedMethods,
    range,
  };
}

export function normalizeReadingSubject(value: unknown): ReadingSubjectSnapshot | undefined {
  if (!isRecord(value)) return undefined;
  if (
    typeof value.id !== 'string' ||
    typeof value.source !== 'string' ||
    !isRecord(value.lockedInputs) ||
    !Array.isArray(value.allowedMethods) ||
    !isRecord(value.range)
  )
    return undefined;
  if (
    !['bazi', 'ziwei', 'bazi-ziwei', 'qimen-lifetime', 'astrolabe', 'qizheng', 'bazhai'].includes(
      value.source,
    )
  )
    return undefined;
  const lockedInputs = Object.fromEntries(
    Object.entries(value.lockedInputs).filter(([, item]) => isRecord(item)),
  ) as Record<string, Record<string, unknown>>;
  const allowedMethods = value.allowedMethods.filter(
    (item): item is string => typeof item === 'string',
  );
  if (!allowedMethods.length) return undefined;
  if (value.source === 'qimen-lifetime' && !allowedMethods.includes('qimen-lifetime')) {
    return undefined;
  }
  return {
    id: value.id,
    source: value.source as ReadingSubjectSnapshot['source'],
    lockedInputs,
    allowedMethods,
    range: { ...value.range },
  };
}
