import type { BaziChartResult, Person } from 'mingyu-core/bazi';
import type { BirthProfile } from 'mingyu-core/profile';
import type { BaziRangePage, BaziRangePageSide } from '@/lib/full-chart-engine/bazi-range';
import type { ReadingSubjectSnapshot } from '@/lib/ai/reading-subject';

export interface BaziPromptSampleSelection {
  page: BaziRangePage | null;
  primary: BaziChartResult | null;
  partner: BaziChartResult | null;
  identity: string;
}

function setCurrentBaziField(target: Record<string, unknown>, key: string, value: unknown): void {
  if (value === undefined) {
    delete target[key];
  } else {
    target[key] = value;
  }
}

function buildCurrentBaziLockedInput(
  original: Record<string, unknown> | undefined,
  person: Person | undefined,
  profile?: BirthProfile,
  includeName = false,
): Record<string, unknown> | null {
  if (!original || !person) return null;
  const result = { ...original };
  Object.assign(result, {
    gender: person.gender,
    year: person.year,
    month: person.month,
    day: person.day,
    dateType: person.isLunar ? 'lunar' : 'solar',
    isLeapMonth: person.isLeapMonth ?? false,
    useTrueSolarTime: person.useTrueSolarTime ?? false,
    applyChinaDst: person.applyChinaDst ?? false,
  });
  setCurrentBaziField(result, 'timeIndex', person.timeIndex);
  setCurrentBaziField(result, 'birthHour', person.birthHour);
  setCurrentBaziField(result, 'birthMinute', person.birthMinute);
  setCurrentBaziField(result, 'birthSecond', person.birthSecond);
  if (person.birthPlace !== undefined) result.birthPlace = person.birthPlace;
  if (person.birthLongitude !== undefined) result.birthLongitude = person.birthLongitude;
  if (person.timezone !== undefined) {
    result.timezone = person.timezone;
    delete result.timeZoneId;
  } else if (person.timeZoneId !== undefined) {
    result.timeZoneId = person.timeZoneId;
    delete result.timezone;
  }
  if (profile?.location?.latitude !== undefined) result.birthLatitude = profile.location.latitude;
  if (includeName && profile?.name !== undefined) result.name = profile.name;
  return result;
}

type RangeReadingMethod = 'bazi' | 'ziwei';

function buildRangeReadingSubject(
  subject: ReadingSubjectSnapshot,
  requested: boolean,
  page: BaziRangePage | null,
  methods: readonly RangeReadingMethod[],
): ReadingSubjectSnapshot | undefined {
  if (!requested || !methods.length) return subject;
  if (!page) return undefined;

  const requiredKeys = methods.flatMap((method) => [
    method,
    ...(page.partner ? [`${method}Partner`] : []),
  ]);
  if (requiredKeys.some((key) => !subject.lockedInputs[key])) return undefined;

  const primaryPerson = page.primary.bundle.inputs.bazi;
  const partnerPerson = page.partner?.bundle.inputs.bazi;
  const primaryProfile = page.primary.profile;
  const partnerProfile = page.partner?.profile;
  const lockedInputs = Object.fromEntries(
    Object.entries(subject.lockedInputs).map(([key, value]) => [key, { ...value }]),
  );

  for (const method of methods) {
    const primary = buildCurrentBaziLockedInput(
      subject.lockedInputs[method],
      primaryPerson,
      primaryProfile,
      method === 'ziwei',
    );
    if (!primary) return undefined;
    lockedInputs[method] = primary;

    if (page.partner) {
      const partner = buildCurrentBaziLockedInput(
        subject.lockedInputs[`${method}Partner`],
        partnerPerson,
        partnerProfile,
        method === 'ziwei',
      );
      if (!partner) return undefined;
      lockedInputs[`${method}Partner`] = partner;
    }
  }

  const range = { ...subject.range };
  delete range.birthTimeRanges;
  return {
    ...subject,
    id: `${subject.id}:${getBaziPromptSampleIdentity(page)}`,
    lockedInputs,
    range,
  };
}

/**
 * 将 AI 自动补算主体锁定到当前八字 page。
 * 范围尚未返回当前 page 时返回 undefined，调用方必须阻止发起 AI 会话。
 */
export function buildBaziRangeReadingSubject(
  subject: ReadingSubjectSnapshot,
  requested: boolean,
  page: BaziRangePage | null,
): ReadingSubjectSnapshot | undefined {
  if (subject.source !== 'bazi') return subject;
  return buildRangeReadingSubject(subject, requested, page, ['bazi']);
}

/** 将独立紫微自动补算锁定到与当前八字 page 相同的精确出生样本。 */
export function buildZiweiRangeReadingSubject(
  subject: ReadingSubjectSnapshot,
  requested: boolean,
  page: BaziRangePage | null,
): ReadingSubjectSnapshot | undefined {
  if (subject.source !== 'ziwei') return subject;
  return buildRangeReadingSubject(subject, requested, page, ['ziwei']);
}

/** 八紫合参必须同时替换两套主体输入，防止八字当前页配上紫微起点盘。 */
export function buildBaziZiweiRangeReadingSubject(
  subject: ReadingSubjectSnapshot,
  requested: boolean,
  page: BaziRangePage | null,
): ReadingSubjectSnapshot | undefined {
  if (subject.source !== 'bazi-ziwei') return subject;
  return buildRangeReadingSubject(subject, requested, page, ['bazi', 'ziwei']);
}

/**
 * 选择提示词实际使用的八字样本。
 *
 * 范围请求未完成时明确返回空盘，禁止回落到区间起点的普通 baziResult。
 */
export function selectBaziPromptSample(
  requested: boolean,
  page: BaziRangePage | null,
  pointPrimary: BaziChartResult | null,
  pointPartner: BaziChartResult | null,
): BaziPromptSampleSelection {
  if (!requested) {
    return {
      page: null,
      primary: pointPrimary,
      partner: pointPartner,
      identity: 'bazi-point',
    };
  }

  if (!page) {
    return {
      page: null,
      primary: null,
      partner: null,
      identity: 'bazi-range:pending',
    };
  }

  return {
    page,
    primary: page.primary.result,
    partner: page.partner?.result ?? null,
    identity: getBaziPromptSampleIdentity(page),
  };
}

export function getBaziPromptSampleIdentity(page: BaziRangePage | null): string {
  if (!page) return 'bazi-range:pending';
  return [
    'bazi-range',
    page.inputKey,
    page.index,
    page.primary.index,
    page.primary.timestamp ?? 'fixed',
    page.partner?.index ?? 'single',
    page.partner?.timestamp ?? 'fixed',
  ].join(':');
}

function formatBaziSampleTimestamp(timestamp: number): string {
  return `${new Date(timestamp + 8 * 60 * 60 * 1_000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ')}（北京时间）`;
}

function formatProfileTimestamp(profile: BirthProfile): string {
  const calendar = profile.calendarType === 'lunar' ? '农历' : '公历';
  const date = `${calendar}${profile.year}年${profile.month}月${profile.day}日`;
  if (profile.hour === undefined || profile.minute === undefined) return `${date}（固定出生时辰）`;
  const clock = `${String(profile.hour).padStart(2, '0')}:${String(profile.minute).padStart(2, '0')}${profile.second === undefined ? '' : `:${String(profile.second).padStart(2, '0')}`}`;
  return `${date} ${clock}`;
}

function formatBaziSampleSide(side: BaziRangePageSide): string {
  const timestamp =
    side.timestamp === undefined
      ? `${formatProfileTimestamp(side.profile)}（固定单点）`
      : formatBaziSampleTimestamp(side.timestamp);
  return timestamp;
}

function formatCurrentRangeSampleContext(
  page: BaziRangePage | null,
  singleLabel: string,
  pairLabel: string,
): string {
  if (!page) return '';
  const sampleLabel = page.partner ? pairLabel : singleLabel;
  const lines = [
    `${sampleLabel}：第 ${page.index + 1}/${page.total} 条（本次仅解读当前样本）`,
    `第一人：${formatBaziSampleSide(page.primary)}`,
  ];
  if (page.partner) lines.push(`第二人：${formatBaziSampleSide(page.partner)}`);
  if (page.compatibility) lines.push(`当前组合关系证据：${page.compatibility.promptText}`);
  return lines.join('\n');
}

/** 只描述当前 page，供紫微提示词和预览显示；不描述整个出生范围的结论。 */
export function formatCurrentBirthSampleContext(page: BaziRangePage | null): string {
  return formatCurrentRangeSampleContext(page, '当前出生样本', '当前出生组合样本');
}

/** 只描述当前 page，供八字提示词和预览显示；不描述整个出生范围的结论。 */
export function formatBaziCurrentSampleContext(page: BaziRangePage | null): string {
  return formatCurrentRangeSampleContext(page, '当前八字样本', '当前八字组合样本');
}
