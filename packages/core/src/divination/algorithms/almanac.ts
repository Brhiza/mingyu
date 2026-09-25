/**
 * @file 黄历择日算法
 * @传统依据 《钦定协纪辨方书》《选择要略》等择日资料；日历属性由当前历法数据提供。
 */
import { NineStar, SolarDay, SolarTime, TwentyEightStar } from 'tyme4ts';
import { baziCalculator } from '../../bazi/baziCalculator';
import { MONTH_COMMANDER } from '../../bazi/baziDefinitions';
import { calculateSolarTermsForYear } from '../../calendar/solar-term-evidence';
import { getCivilDateTimeAtFixedOffset } from '../../calendar/civil-time';
import { createUtcTimestamp, getBirthDateValidationMessage } from '../../calendar/date-validation';
import { SHICHEN_PERIODS } from '../../calendar/dateUtils';
import { calculateMoonPhaseEvidence } from '../../calendar/moon-phase-evidence';
import { getHuangliSolarDayGods } from '../../shensha';
import { EARTHLY_BRANCHES, HEAVENLY_STEMS } from '../../ganzhi/data';
import {
  getBranchWuxing,
  getOppositeBranch,
  getSanxingType,
  getStemWuxing,
  isLiuhai,
  isLiupo,
  isSanxing,
} from '../../ganzhi';
import type {
  AlmanacAnnualDirectionGod,
  AlmanacData,
  AlmanacDayCandidate,
  AlmanacGodFact,
  AlmanacHourCandidate,
  AlmanacParticipantInput,
  AlmanacParticipantRelationFact,
  AlmanacParticipantProfile,
  AlmanacParticipantProfileSnapshot,
  AlmanacTopic,
  AlmanacTopicMatchFact,
  BaseGanZhi,
} from '../../types/divination';
import {
  birthProfileAtRangeTimestamp,
  validateBirthProfileTimeRange,
} from '../../profile/time-range';
import { birthProfileToBaziPerson, type BirthProfile } from '../../profile';

interface AlmanacLunarHourSource {
  getSixtyCycle(): { getName(): string };
  getTwelveStar(): { getName(): string };
  getRecommends(): Array<{ getName(): string }>;
  getAvoids(): Array<{ getName(): string }>;
}

interface AlmanacLunarDaySource {
  getHours(): AlmanacLunarHourSource[];
}
interface AlmanacGodSource {
  getName(): string;
  getLuck(): { getName(): string };
}
import { analyzeAlmanacEvidence, classifyAlmanacCandidate } from '../almanac-evidence';

export const ALMANAC_TOPIC_LABELS: Record<AlmanacTopic, string> = {
  move: '搬家入宅',
  marriage: '订婚结婚',
  opening: '开业启动',
  contract: '签约合作',
  travel: '出行赴任',
  medical: '就医手术',
  study: '考试学习',
  burial: '安葬修坟',
  renovation: '修造动土',
  custom: '自定义事项',
};

const TOPIC_RECOMMEND_KEYWORDS: Record<AlmanacTopic, string[]> = {
  move: ['入宅', '移徙'],
  marriage: ['嫁娶', '纳采', '订盟'],
  opening: ['开市'],
  contract: ['交易', '立券'],
  travel: ['出行', '赴任'],
  medical: ['求医', '治病'],
  study: ['入学'],
  burial: ['安葬', '修坟', '启钻', '立碑', '入殓', '移柩', '成服', '除服'],
  renovation: ['修造', '动土', '竖柱', '上梁', '盖屋', '起基'],
  custom: [],
};

const TOPIC_AVOID_KEYWORDS: Record<AlmanacTopic, string[]> = {
  move: ['入宅', '移徙'],
  marriage: ['嫁娶', '纳采', '订盟'],
  opening: ['开市'],
  contract: ['交易', '立券'],
  travel: ['出行', '赴任'],
  medical: ['求医', '治病'],
  study: ['入学'],
  burial: ['安葬', '修坟', '启钻'],
  renovation: ['修造', '动土', '竖柱', '上梁'],
  custom: [],
};

function getGeneralRestriction(
  recommends: string[],
  avoids: string[],
  recommendMatches: string[],
): string | null {
  const items = [...recommends, ...avoids];
  if (items.includes('诸事不宜')) return '原始宜忌明列诸事不宜';
  if (items.some((item) => /[馀余]事勿取/.test(item)) && recommendMatches.length === 0)
    return '原始宜忌列余事勿取，本次事项未列在明确宜项中';
  return null;
}

function assertAlmanacTopic(topic: AlmanacTopic): void {
  if (!Object.prototype.hasOwnProperty.call(ALMANAC_TOPIC_LABELS, topic)) {
    throw new Error(`未知的黄历择日事项类型: ${String(topic)}`);
  }
}

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const MAX_ALMANAC_PARTICIPANTS = 30;
type ParticipantBranchConflictType = '冲' | '刑' | '害' | '破';

const BRANCH_DIRECTIONS: Record<string, string> = {
  子: '正北',
  丑: '东北偏北',
  寅: '东北偏东',
  卯: '正东',
  辰: '东南偏东',
  巳: '东南偏南',
  午: '正南',
  未: '西南偏南',
  申: '西南偏西',
  酉: '正西',
  戌: '西北偏西',
  亥: '西北偏北',
};

const ANNUAL_DIRECTION_GOD_SEQUENCE: Array<
  Omit<AlmanacAnnualDirectionGod, 'branch' | 'direction'>
> = [
  { god: '太岁' },
  { god: '太阳' },
  { god: '丧门' },
  { god: '太阴' },
  { god: '官符' },
  { god: '死符' },
  { god: '岁破' },
  { god: '龙德' },
  { god: '白虎' },
  { god: '福德' },
  { god: '吊客' },
  { god: '病符' },
];

function parseDateText(value: string, fieldName: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`${fieldName}需要使用 YYYY-MM-DD 格式`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || year > 2100) {
    throw new Error(`${fieldName}年份需在 1900-2100 之间`);
  }
  const date = new Date(createUtcTimestamp(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`${fieldName}不是有效日期`);
  }

  return { year, month, day, date };
}

function formatDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function findKeywordMatches(values: string[], keywords: string[]) {
  if (keywords.length === 0) return [];
  return values.filter((value) => keywords.some((keyword) => value.includes(keyword)));
}

const TOPIC_MATCH_LIMITATION =
  '事项命中事实只说明当前事项关键词是否出现在原始宜忌、建除值日或十二神规则中，不证明事项必然成功，也不得替代现实条件核验';
const GOD_FACT_LIMITATION =
  '值日神煞分类只作为传统择日辅助证据，不单独证明现实吉凶、成功率或具体事件结果';
const PARTICIPANT_FACT_LIMITATION =
  '参与人关系只核验候选日支或时支与参与人年支、日支的刑冲破害，以及已有喜忌五行是否命中；不证明个人结果，也不得替代完整命盘研判';

function buildTopicMatchFact(params: {
  key: string;
  scope: AlmanacTopicMatchFact['scope'];
  topic: AlmanacTopic;
  sourceType: AlmanacTopicMatchFact['sourceType'];
  status: AlmanacTopicMatchFact['status'];
  inputItems: string[];
  keywords: string[];
  matchedItems: string[];
  promptText: string;
  sources: string[];
}): AlmanacTopicMatchFact {
  return {
    ...params,
    topicLabel: ALMANAC_TOPIC_LABELS[params.topic],
    limitation: TOPIC_MATCH_LIMITATION,
  };
}

const GOD_RULE_SOURCES: Record<string, string> = {
  天符: '《御定星历考原》天符正月戌顺行六阳辰起例',
  三丧: '《时俗丧祭便览》三丧四季起例，以交节分季',
  孤辰: '《钦定协纪辨方书》行狠了戾孤辰起例',
  灾煞: '《钦定协纪辨方书》灾煞正月子逆行四仲起例',
  天德: '《钦定协纪辨方书》四德日干起例',
  天德合: '《钦定协纪辨方书》四德日干起例',
  月德: '《钦定协纪辨方书》四德日干起例',
  月德合: '《钦定协纪辨方书》四德日干起例',
  天恩: '《大清时宪历笺释》天恩十五日起例',
  母仓: '《钦定协纪辨方书》母仓起例、《历事明原》四立前十八日土王用事',
  月恩: '《钦定协纪辨方书》月恩起例',
  月空: '《三命通会》所载大统历月空起例',
  月厌: '《三命通会》所载大统历月厌起例',
  六合: '月建与日支六合关系',
  月刑: '《选择天镜》逐月月刑起例',
  时德: '《钦定大清会典》四季时德起例',
  守日: '《钦定协纪辨方书》守日与牢日校正起例',
  相日: '《钦定协纪辨方书》四季相日起例',
  四击: '《钦定协纪辨方书》四季四击起例',
  九空: '《钦定协纪辨方书》九空逆行四季起例',
  五富: '《钦定大清会典》逐月五富起例',
  生气: '《御定星历考原》生气起例',
  普护: '《御定星历考原》逐月普护起例',
  福生: '《御定星历考原》逐月福生起例',
  玉宇: '《历事明原》逐月玉宇起例',
  金堂: '《御定星历考原》逐月金堂起例',
  天仓: '《御定星历考原》天仓正月寅逆行起例',
  天巫: '《御定星历考原》天巫月建前二辰起例',
  福德: '《御定星历考原》福德月建前二辰起例',
  阳德: '《御定星历考原》阳德正月戌顺行六阳起例',
  阴德: '《御定星历考原》阴德正月酉逆行六阴起例',
  解神: '《御定星历考原》解神逐月起例',
  时阳: '《御定星历考原》时阳月建后二辰起例',
  时阴: '《御定星历考原》时阴月建前四辰起例',
  玉堂: '《万年书》逐月玉堂起例',
  金匮: '《万年书》逐月金匮起例',
  五合: '《万年书》五合寅卯日起例',
  除神: '《万年书》除神申酉日起例',
  五虚: '《钦定协纪辨方书》四季五虚起例',
  血支: '《历事明原》血支正月丑顺行起例',
  血忌: '《历事明原》血忌逐月相冲起例',
  天刑: '《历事明原》天刑逐月起例',
  白虎: '《历事明原》白虎逐月起例',
  天牢: '《历事明原》天牢逐月起例',
  朱雀: '《历事明原》朱雀逐月起例',
  勾陈: '《历事明原》勾陈逐月起例',
  天贼: '《历事明原》天贼正月丑逆行起例',
  致死: '《历事明原》致死正月酉逆行四仲起例',
  月虚: '《历事明原》月虚正月丑逆行四季起例',
  小耗: '《历事明原》小耗月建前五辰起例',
  归忌: '《历事明原》归忌孟月丑、仲月寅、季月子起例',
  土符: '《历事明原》土符逐月起例',
  土府: '《历事明原》土府与月建同行起例',
  地火: '《历事明原》地火正月戌逆行十二辰起例',
  天吏: '《历事明原》天吏正月酉逆行四仲起例',
  小时: '《历事明原》小时与月建同行起例',
  大煞: '《历事明原》大煞逐月起例',
  劫煞: '《历事明原》劫煞正月亥逆行四孟起例',
  死神: '《历事明原》死神月建前三辰起例',
  游祸: '《历事明原》游祸正月巳逆行四孟起例',
  天火: '《协纪辨方书》天火三合对冲校正起例',
  不将: '《协纪辨方书》阴阳不将逐月干支起例',
  大会: '《协纪辨方书》阴阳大会八日立成起例',
  阳破阴冲: '《协纪辨方书》六月癸丑、十二月丁未起例',
  八专: '《协纪辨方书》八专五日起例',
  河魁: '《协纪辨方书》河魁阳月建后三辰、阴月建前三辰起例',
  重日: '《选择历书》重日巳日、亥日起例',
  四离: '《协纪辨方书》春分、夏至、秋分、冬至各前一日',
  鸣吠: '《钦定协纪辨方书》鸣吠十三日校正起例',
  鸣吠对: '《钦定协纪辨方书》鸣吠对十一日校正起例',
};

function buildGodFacts(dateKey: string, gods: AlmanacGodSource[]): AlmanacGodFact[] {
  return gods.map((god) => {
    const name = god.getName();
    const luck = god.getLuck().getName();
    const classification = luck === '吉' ? '吉神' : luck === '凶' ? '凶神' : '未分级';
    return {
      key: `${dateKey}:god:${name}`,
      name,
      classification,
      status: '已读取',
      promptText: `${name}列为${classification}`,
      sources: [GOD_RULE_SOURCES[name] ?? 'tyme4ts 值日神煞', 'tyme4ts God.getLuck() 原生吉凶属性'],
      limitation: GOD_FACT_LIMITATION,
    };
  });
}

function normalizeTaboos(items: Array<{ getName(): string }>) {
  return items.map((item) => item.getName()).filter(Boolean);
}

function getNoonEightChar(date: Date) {
  return SolarTime.fromYmdHms(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
    12,
    0,
    0,
  )
    .getLunarHour()
    .getEightChar();
}

function shouldBuildParticipantProfile(item: AlmanacParticipantInput) {
  return [
    item.year,
    item.month,
    item.day,
    item.timeIndex,
    item.birthHour,
    item.birthMinute,
    item.birthSecond,
  ].some((value) => typeof value === 'string' && value.trim() !== '');
}

function readParticipantInteger(value: string, label: string, min: number, max: number) {
  if (typeof value !== 'string') {
    throw new Error(`参与人${label}必须是 ${min}-${max} 的整数`);
  }
  const text = value.trim();
  if (!/^\d+$/.test(text)) {
    throw new Error(`参与人${label}必须是 ${min}-${max} 的整数`);
  }

  const number = Number(text);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(`参与人${label}必须是 ${min}-${max} 的整数`);
  }
  return number;
}

function readOptionalParticipantInteger(
  value: string | undefined,
  label: string,
  min: number,
  max: number,
) {
  if (value === undefined || value.trim() === '') return undefined;
  return readParticipantInteger(value, label, min, max);
}

function readOptionalParticipantNumber(value: string | undefined, label: string) {
  if (value === undefined || value.trim() === '') return undefined;
  const number = Number(value.trim());
  if (!Number.isFinite(number) || number < -180 || number > 180) {
    throw new Error(`参与人${label}必须是 -180 到 180 之间的数字`);
  }
  return number;
}

function readParticipantBirthInput(item: AlmanacParticipantInput) {
  if (item.gender !== '男' && item.gender !== '女' && item.gender !== '') {
    throw new Error('参与人性别必须是 男、女 或留空。');
  }
  if (item.dateType !== 'solar' && item.dateType !== 'lunar') {
    throw new Error('参与人日历类型必须是 solar 或 lunar。');
  }
  if (item.isLeapMonth !== undefined && typeof item.isLeapMonth !== 'boolean') {
    throw new Error('参与人isLeapMonth必须是布尔值。');
  }

  const year = readParticipantInteger(item.year, '出生年份', 1900, 2100);
  const month = readParticipantInteger(item.month, '出生月份', 1, 12);
  const day = readParticipantInteger(item.day, '出生日期', 1, item.dateType === 'lunar' ? 30 : 31);
  if (item.useTrueSolarTime !== undefined && typeof item.useTrueSolarTime !== 'boolean') {
    throw new Error('参与人useTrueSolarTime必须是布尔值。');
  }
  const birthHour = readOptionalParticipantInteger(item.birthHour, '出生小时', 0, 23);
  const birthMinute = readOptionalParticipantInteger(item.birthMinute, '出生分钟', 0, 59);
  const birthSecond = readOptionalParticipantInteger(item.birthSecond, '出生秒数', 0, 59);
  const hasPreciseClock =
    birthHour !== undefined || birthMinute !== undefined || birthSecond !== undefined;
  if (hasPreciseClock && (birthHour === undefined || birthMinute === undefined)) {
    throw new Error('参与人精准出生时间需要同时提供小时和分钟。');
  }
  const hasBlankTimeIndex = typeof item.timeIndex === 'string' && item.timeIndex.trim() === '';
  const timeIndex =
    typeof item.timeIndex !== 'string' || hasBlankTimeIndex
      ? undefined
      : readParticipantInteger(item.timeIndex, '出生时辰', 0, 12);
  if (timeIndex === undefined && !hasPreciseClock) {
    if (hasBlankTimeIndex) {
      readParticipantInteger(item.timeIndex, '出生时辰', 0, 12);
    }
    throw new Error('参与人需要提供出生时辰或精准出生时间。');
  }
  const birthLongitude = readOptionalParticipantNumber(item.birthLongitude, '出生经度');
  if (item.useTrueSolarTime === true && (birthHour === undefined || birthMinute === undefined)) {
    throw new Error('参与人真太阳时需要精准出生小时和分钟。');
  }
  if (item.useTrueSolarTime === true && birthLongitude === undefined) {
    throw new Error('参与人真太阳时需要出生经度。');
  }
  const validationMessage = getBirthDateValidationMessage({
    year,
    month,
    day,
    dateType: item.dateType,
    isLeapMonth: Boolean(item.isLeapMonth),
  });

  if (validationMessage) {
    throw new Error(`参与人出生${validationMessage}`);
  }

  return {
    year,
    month,
    day,
    timeIndex,
    birthHour,
    birthMinute,
    birthSecond,
    birthPlace: item.birthPlace?.trim() || undefined,
    birthLongitude,
    useTrueSolarTime: item.useTrueSolarTime === true,
  };
}

function readParticipantText(value: unknown, label: string, fallback: string) {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== 'string') {
    throw new Error(`参与人${label}必须是文本。`);
  }
  return value.trim() || fallback;
}

const BEIJING_OFFSET_HOURS = 8;
const DAY_MILLISECONDS = 86_400_000;
const JIE_MONTH_BRANCH: Readonly<Record<string, string>> = {
  小寒: '丑',
  立春: '寅',
  惊蛰: '卯',
  清明: '辰',
  立夏: '巳',
  芒种: '午',
  小暑: '未',
  立秋: '申',
  白露: '酉',
  寒露: '戌',
  立冬: '亥',
  大雪: '子',
};

function buildParticipantBirthProfile(
  item: AlmanacParticipantInput,
  birthInput: ReturnType<typeof readParticipantBirthInput>,
): BirthProfile {
  if (birthInput.birthHour === undefined || birthInput.birthMinute === undefined) {
    throw new Error('四柱反推参与人必须提供区间起点的精准出生时间。');
  }
  return {
    id: item.id,
    name: item.name,
    gender: item.gender === '女' ? 'female' : 'male',
    calendarType: 'solar',
    year: birthInput.year,
    month: birthInput.month,
    day: birthInput.day,
    hour: birthInput.birthHour,
    minute: birthInput.birthMinute,
    second: birthInput.birthSecond ?? 0,
    useTrueSolarTime: false,
    applyChinaDst: false,
    birthTimeRange: item.birthTimeRange,
  };
}

function buildParticipantProfileSnapshot(
  item: AlmanacParticipantInput,
  id: string,
  name: string,
  chart: ReturnType<typeof baziCalculator.calculateBazi>,
): AlmanacParticipantProfileSnapshot {
  return {
    id,
    name,
    gender: item.gender,
    solarDate: `${chart.solarDate.year}-${String(chart.solarDate.month).padStart(2, '0')}-${String(chart.solarDate.day).padStart(2, '0')}`,
    lunarDate: `${chart.lunarDate.monthName}${chart.lunarDate.dayName}`,
    zodiac: chart.zodiac,
    constellation: chart.constellation,
    dayMaster: chart.dayMaster.gan,
    dayMasterElement: chart.dayMaster.element,
    pillars: {
      year: chart.pillars.year.ganZhi,
      month: chart.pillars.month.ganZhi,
      day: chart.pillars.day.ganZhi,
      hour: chart.pillars.hour.ganZhi,
    },
    monthCommander: chart.monthCommander,
    usefulGods: chart.analysis.usefulGod.favorableWuxing ?? chart.analysis.usefulGod.favorable,
    avoidGods: chart.analysis.usefulGod.unfavorableWuxing ?? chart.analysis.usefulGod.unfavorable,
    incrementStatus: chart.analysis.usefulGod.incrementStatus,
  };
}

function assertParticipantRangePillars(
  profile: AlmanacParticipantProfileSnapshot,
  expected: BaseGanZhi,
) {
  const labels = { year: '年', month: '月', day: '日', hour: '时' } as const;
  for (const key of ['year', 'month', 'day', 'hour'] as const) {
    if (profile.pillars[key] !== expected[key]) {
      throw new Error(`参与人出生区间${labels[key]}柱与四柱反推来源不一致。`);
    }
  }
}

function collectParticipantRangeBoundaries(startTimestamp: number, endTimestamp: number) {
  const boundaries = new Set<number>([startTimestamp, endTimestamp]);
  const start = getCivilDateTimeAtFixedOffset(new Date(startTimestamp), BEIJING_OFFSET_HOURS);
  const end = getCivilDateTimeAtFixedOffset(new Date(endTimestamp - 1_000), BEIJING_OFFSET_HOURS);
  const midnight =
    Date.UTC(start.year, start.month - 1, start.day + 1) - BEIJING_OFFSET_HOURS * 60 * 60 * 1_000;
  if (midnight > startTimestamp && midnight < endTimestamp) boundaries.add(midnight);

  for (let year = start.year - 1; year <= end.year; year += 1) {
    if (year < 1900 || year > 2199) continue;
    for (const term of calculateSolarTermsForYear(year)) {
      if (term.utcTimestamp > startTimestamp && term.utcTimestamp < endTimestamp) {
        boundaries.add(term.utcTimestamp);
      }
      const monthBranch = JIE_MONTH_BRANCH[term.name];
      if (!monthBranch) continue;
      const commanders = MONTH_COMMANDER[monthBranch];
      let elapsedDays = 0;
      for (let index = 0; index < commanders.length - 1; index += 1) {
        elapsedDays += commanders[index]![1];
        const boundary = term.utcTimestamp + elapsedDays * DAY_MILLISECONDS;
        if (boundary > startTimestamp && boundary < endTimestamp) boundaries.add(boundary);
      }
    }
  }
  return [...boundaries].sort((left, right) => left - right);
}

function profileFingerprint(profile: AlmanacParticipantProfileSnapshot) {
  return JSON.stringify(profile);
}

function calculateParticipantProfileSnapshot(
  item: AlmanacParticipantInput,
  id: string,
  name: string,
  person: ReturnType<typeof birthProfileToBaziPerson>,
) {
  const snapshot = buildParticipantProfileSnapshot(
    item,
    id,
    name,
    baziCalculator.calculateBazi(person),
  );
  if (item.gender !== '') return snapshot;

  const alternate = buildParticipantProfileSnapshot(
    item,
    id,
    name,
    baziCalculator.calculateBazi({
      ...person,
      gender: person.gender === 'male' ? 'female' : 'male',
    }),
  );
  if (profileFingerprint(snapshot) !== profileFingerprint(alternate)) {
    throw new Error('参与人性别未指定时无法得到唯一择日画像。');
  }
  return snapshot;
}

function createRangeParticipantProfile(
  item: AlmanacParticipantInput,
  birthInput: ReturnType<typeof readParticipantBirthInput>,
  id: string,
  name: string,
): AlmanacParticipantProfile {
  const rawSource = item.birthTimeRange!;
  if (
    !rawSource.pillars ||
    (['year', 'month', 'day', 'hour'] as const).some(
      (key) => typeof rawSource.pillars[key] !== 'string' || !rawSource.pillars[key].trim(),
    )
  ) {
    throw new Error('四柱反推参与人必须提供完整来源四柱。');
  }
  const profile = buildParticipantBirthProfile(item, birthInput);
  const source = validateBirthProfileTimeRange(profile, rawSource);
  const boundaries = collectParticipantRangeBoundaries(source.startTimestamp, source.endTimestamp);
  const branches: NonNullable<AlmanacParticipantProfile['birthTimeRange']>['branches'] = [];

  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const startTimestamp = boundaries[index]!;
    const endTimestamp = boundaries[index + 1]!;
    const point = birthProfileAtRangeTimestamp(profile, source, startTimestamp);
    const snapshot = calculateParticipantProfileSnapshot(
      item,
      id,
      name,
      birthProfileToBaziPerson(point),
    );
    const lastPoint = birthProfileAtRangeTimestamp(profile, source, endTimestamp - 1_000);
    const lastSnapshot = calculateParticipantProfileSnapshot(
      item,
      id,
      name,
      birthProfileToBaziPerson(lastPoint),
    );
    assertParticipantRangePillars(snapshot, rawSource.pillars);
    assertParticipantRangePillars(lastSnapshot, rawSource.pillars);
    if (profileFingerprint(snapshot) !== profileFingerprint(lastSnapshot)) {
      throw new Error('参与人出生区间存在未纳入裁决的画像变化边界。');
    }
    const previous = branches.at(-1);
    if (previous && profileFingerprint(previous.profile) === profileFingerprint(snapshot)) {
      previous.endTimestamp = endTimestamp;
    } else {
      branches.push({
        startTimestamp,
        endTimestamp,
        endExclusive: true,
        profile: snapshot,
      });
    }
  }

  const representative = branches[0]?.profile;
  if (!representative) throw new Error('参与人出生区间没有可用画像。');
  return {
    ...representative,
    birthTimeRange: {
      source: { ...source, pillars: { ...rawSource.pillars } },
      status: branches.length === 1 ? 'stable' : 'conditional',
      branches,
    },
  };
}

function createParticipantProfiles(
  participants: AlmanacParticipantInput[],
): AlmanacParticipantProfile[] {
  if (!Array.isArray(participants)) {
    throw new Error('参与人信息必须是数组。');
  }
  if (participants.length > MAX_ALMANAC_PARTICIPANTS) {
    throw new Error(`黄历择日一次最多分析 ${MAX_ALMANAC_PARTICIPANTS} 位参与人，请拆分请求。`);
  }

  return participants
    .filter((item, index) => {
      if (!item || typeof item !== 'object') {
        throw new Error(`参与人${index + 1}信息必须是对象。`);
      }
      return shouldBuildParticipantProfile(item);
    })
    .map((item, index) => {
      const birthInput = readParticipantBirthInput(item);
      const id = readParticipantText(item.id, 'id', `participant-${index + 1}`);
      const name = readParticipantText(item.name, '姓名', '未命名参与人');
      if (item.birthTimeRange) {
        if (item.dateType !== 'solar' || item.isLeapMonth || item.useTrueSolarTime) {
          throw new Error('四柱反推参与人必须使用公历、非闰月和标准北京时间。');
        }
        return createRangeParticipantProfile(item, birthInput, id, name);
      }
      const person: ReturnType<typeof birthProfileToBaziPerson> = {
        year: birthInput.year,
        month: birthInput.month,
        day: birthInput.day,
        ...(birthInput.timeIndex === undefined ? {} : { timeIndex: birthInput.timeIndex }),
        gender: item.gender === '女' ? 'female' : 'male',
        isLunar: item.dateType === 'lunar',
        isLeapMonth: Boolean(item.isLeapMonth),
        ...(birthInput.birthHour === undefined
          ? {}
          : {
              birthHour: birthInput.birthHour,
              birthMinute: birthInput.birthMinute,
              ...(birthInput.birthSecond === undefined
                ? {}
                : { birthSecond: birthInput.birthSecond }),
            }),
        ...(birthInput.birthPlace === undefined ? {} : { birthPlace: birthInput.birthPlace }),
        ...(birthInput.birthLongitude === undefined
          ? {}
          : { birthLongitude: birthInput.birthLongitude }),
        useTrueSolarTime: birthInput.useTrueSolarTime,
      };

      return calculateParticipantProfileSnapshot(item, id, name, person);
    });
}

function requireReferenceValue<T>(record: Record<string, T>, key: string, label: string): T {
  if (!key || !Object.prototype.hasOwnProperty.call(record, key)) {
    throw new Error(`黄历${label}资料缺失：${key || '空值'}`);
  }
  return record[key];
}

export function getAlmanacTwentyEightStarDetail(name: string) {
  try {
    const star = TwentyEightStar.fromName(name);
    const sevenStar = star.getSevenStar().getName();
    return {
      fullName: `${name}${sevenStar}${requireReferenceValue(
        TWENTY_EIGHT_STAR_ANIMALS,
        name,
        '二十八宿动物',
      )}`,
      sevenStar,
      animal: requireReferenceValue(TWENTY_EIGHT_STAR_ANIMALS, name, '二十八宿动物'),
      zone: star.getZone().getName(),
      fortune: star.getLuck().getName(),
      source: 'tyme4ts TwentyEightStar 原生属性；二十八宿动物按本地校勘表',
    };
  } catch {
    throw new Error(`黄历二十八宿资料缺失：${name || '空值'}`);
  }
}

export function getAlmanacNineStarDetail(name: string) {
  const normalizedName = name.slice(0, 1);
  try {
    const star = NineStar.fromName(normalizedName);
    return {
      fullName: star.toString(),
      color: star.getColor(),
      wuxing: star.getElement().getName(),
      dipper: star.getDipper().getName(),
      direction: star.getDirection().getName(),
      source: 'tyme4ts NineStar 原生属性',
    };
  } catch {
    throw new Error(`黄历九星资料缺失：${name || '空值'}`);
  }
}

export function getAlmanacAnnualDirectionGods(yearBranch: string): AlmanacAnnualDirectionGod[] {
  const startIndex = (EARTHLY_BRANCHES as readonly string[]).indexOf(yearBranch);
  if (startIndex < 0) {
    throw new Error(`黄历年支无效：${yearBranch || '空值'}`);
  }

  return ANNUAL_DIRECTION_GOD_SEQUENCE.map((item, index) => {
    const branch = EARTHLY_BRANCHES[(startIndex + index) % EARTHLY_BRANCHES.length];
    return {
      ...item,
      branch,
      direction: requireReferenceValue(BRANCH_DIRECTIONS, branch, '地支方位'),
    };
  });
}

/**
 * 六曜历注（备查，tyme4ts 未直接提供六曜数据）：
 * 先胜(吉)、友引(吉)、先负(凶)、佛灭(凶)、大安(吉)、赤口(凶)
 */

/**
 * 彭祖百忌（每日天干地支对应的禁忌）：
 */
const PENGZU_DAY_GAN: Record<string, string> = {
  甲: '甲不开仓财物耗散',
  乙: '乙不栽植千株不长',
  丙: '丙不修灶必见灾殃',
  丁: '丁不剃头头必生疮',
  戊: '戊不受田田主不祥',
  己: '己不破券二比并亡',
  庚: '庚不经络织机虚张',
  辛: '辛不合酱主人不尝',
  壬: '壬不泱水更难提防',
  癸: '癸不词讼理弱敌强',
};

const PENGZU_DAY_ZHI: Record<string, string> = {
  子: '子不问卜自惹祸殃',
  丑: '丑不冠带主不还乡',
  寅: '寅不祭祀神鬼不尝',
  卯: '卯不穿井水泉不香',
  辰: '辰不哭泣必主重丧',
  巳: '巳不远行财物伏藏',
  午: '午不苫盖屋主更张',
  未: '未不服药毒气入肠',
  申: '申不安床鬼祟入房',
  酉: '酉不会客醉坐颠狂',
  戌: '戌不吃犬作怪上床',
  亥: '亥不嫁娶不利新郎',
};

const TWENTY_EIGHT_STAR_ANIMALS: Record<string, string> = {
  角: '蛟',
  亢: '龙',
  氐: '貉',
  房: '兔',
  心: '狐',
  尾: '虎',
  箕: '豹',
  斗: '獬',
  牛: '牛',
  女: '蝠',
  虚: '鼠',
  危: '燕',
  室: '猪',
  壁: '貐',
  奎: '狼',
  娄: '狗',
  胃: '雉',
  昴: '鸡',
  毕: '乌',
  觜: '猴',
  参: '猿',
  井: '犴',
  鬼: '羊',
  柳: '獐',
  星: '马',
  张: '鹿',
  翼: '蛇',
  轸: '蚓',
};

function assertExactReferenceKeys(
  label: string,
  record: Record<string, unknown>,
  expectedKeys: readonly string[],
): void {
  const actualKeys = Object.keys(record);
  const missingKeys = expectedKeys.filter(
    (key) => !Object.prototype.hasOwnProperty.call(record, key),
  );
  const unexpectedKeys = actualKeys.filter((key) => !expectedKeys.includes(key));
  if (missingKeys.length || unexpectedKeys.length) {
    throw new Error(
      `黄历${label}资料表不完整：缺少${missingKeys.join('、') || '无'}；多出${unexpectedKeys.join('、') || '无'}`,
    );
  }
}

export function validateAlmanacReferenceData(): void {
  assertExactReferenceKeys('彭祖天干百忌', PENGZU_DAY_GAN, HEAVENLY_STEMS);
  assertExactReferenceKeys('彭祖地支百忌', PENGZU_DAY_ZHI, EARTHLY_BRANCHES);
  assertExactReferenceKeys(
    '二十八宿动物',
    TWENTY_EIGHT_STAR_ANIMALS,
    TWENTY_EIGHT_STAR_ANIMALS_KEYS,
  );
  assertExactReferenceKeys('地支方位', BRANCH_DIRECTIONS, EARTHLY_BRANCHES);
  if (
    ANNUAL_DIRECTION_GOD_SEQUENCE.length !== EARTHLY_BRANCHES.length ||
    new Set(ANNUAL_DIRECTION_GOD_SEQUENCE.map((item) => item.god)).size !== EARTHLY_BRANCHES.length
  ) {
    throw new Error('黄历岁支十二神资料表必须恰好包含 12 个不重复神名');
  }
}

const TWENTY_EIGHT_STAR_ANIMALS_KEYS = [
  '角',
  '亢',
  '氐',
  '房',
  '心',
  '尾',
  '箕',
  '斗',
  '牛',
  '女',
  '虚',
  '危',
  '室',
  '壁',
  '奎',
  '娄',
  '胃',
  '昴',
  '毕',
  '觜',
  '参',
  '井',
  '鬼',
  '柳',
  '星',
  '张',
  '翼',
  '轸',
];

export function getAlmanacPengZuDetails(dayStem: string, dayBranch: string) {
  return {
    gan: requireReferenceValue(PENGZU_DAY_GAN, dayStem, '彭祖天干百忌'),
    zhi: requireReferenceValue(PENGZU_DAY_ZHI, dayBranch, '彭祖地支百忌'),
  };
}

validateAlmanacReferenceData();

function getParticipantBranchConflict(
  candidateBranch: string,
  targetBranch: string,
): { type: ParticipantBranchConflictType; detail?: string } | null {
  if (!candidateBranch || !targetBranch) return null;

  if (candidateBranch === getOppositeBranch(targetBranch)) {
    return { type: '冲' };
  }

  if (isSanxing(candidateBranch, targetBranch)) {
    const sanxingType = getSanxingType(candidateBranch) || getSanxingType(targetBranch);
    return { type: '刑', detail: sanxingType || undefined };
  }

  if (isLiuhai(candidateBranch, targetBranch)) {
    return { type: '害' };
  }

  if (isLiupo(candidateBranch, targetBranch)) {
    return { type: '破' };
  }

  return null;
}

function getParticipantBranchConflictSummary(
  candidateBranch: string,
  participant: AlmanacParticipantProfileSnapshot,
) {
  const targets: Array<{
    branch: string;
    label: string;
    scope: 'year' | 'day';
  }> = [
    { branch: participant.pillars.year.slice(-1), label: '生肖/年支', scope: 'year' },
    { branch: participant.pillars.day.slice(-1), label: '日支', scope: 'day' },
  ];

  const texts: string[] = [];
  const relations: Array<{
    scope: 'year' | 'day';
    targetBranch: string;
    type: ParticipantBranchConflictType;
    detail?: string;
  }> = [];
  targets.forEach((target) => {
    const conflict = getParticipantBranchConflict(candidateBranch, target.branch);
    if (!conflict) return;

    const detail = conflict.detail ? `（${conflict.detail}）` : '';
    texts.push(`${conflict.type}${target.label}${target.branch}${detail}`);
    relations.push({
      scope: target.scope,
      targetBranch: target.branch,
      type: conflict.type,
      detail: conflict.detail,
    });
  });

  return {
    text: texts.length ? `候选日地支${candidateBranch}${texts.join('、')}，需谨慎` : '',
    relations,
  };
}

function buildParticipantConflictFacts(params: {
  keyPrefix: string;
  scope: AlmanacParticipantRelationFact['scope'];
  candidateBranch: string;
  participant: AlmanacParticipantProfileSnapshot;
  relations: ReturnType<typeof getParticipantBranchConflictSummary>['relations'];
}): AlmanacParticipantRelationFact[] {
  if (!params.relations.length) {
    return [
      {
        key: `${params.keyPrefix}:participant:${params.participant.id}:branch-clear`,
        participantId: params.participant.id,
        participantName: params.participant.name,
        scope: params.scope,
        basis: '整体',
        candidateValue: params.candidateBranch,
        participantValues: [
          params.participant.pillars.year.slice(-1),
          params.participant.pillars.day.slice(-1),
        ],
        relation: '未见直接冲突',
        status: '中性',
        promptText: `${params.participant.name}：${params.scope === '候选日' ? '日支' : '时支'}${params.candidateBranch}与其年支、日支未见直接刑冲破害`,
        sources: ['地支六冲、三刑、六害、六破公共规则', '参与人年支与日支'],
        limitation: PARTICIPANT_FACT_LIMITATION,
      },
    ];
  }

  return params.relations.map((relation) => ({
    key: `${params.keyPrefix}:participant:${params.participant.id}:${relation.scope}:${relation.type}`,
    participantId: params.participant.id,
    participantName: params.participant.name,
    scope: params.scope,
    basis: relation.scope === 'year' ? '年支' : '日支',
    candidateValue: params.candidateBranch,
    participantValues: [relation.targetBranch],
    relation: relation.type,
    status: '限制',
    detail: relation.detail,
    promptText: `${params.participant.name}：${params.scope === '候选日' ? '日支' : '时支'}${params.candidateBranch}与其${relation.scope === 'year' ? '年支' : '日支'}${relation.targetBranch}${relation.type}${relation.detail ? `（${relation.detail}）` : ''}`,
    sources: ['地支六冲、三刑、六害、六破公共规则', '参与人年支或日支'],
    limitation: PARTICIPANT_FACT_LIMITATION,
  }));
}

type ParticipantProfileVariant = {
  profile: AlmanacParticipantProfileSnapshot;
  startTimestamp?: number;
  endTimestamp?: number;
};

function getParticipantProfileVariants(
  participant: AlmanacParticipantProfile,
): ParticipantProfileVariant[] {
  return (
    participant.birthTimeRange?.branches.map((branch) => ({
      profile: branch.profile,
      startTimestamp: branch.startTimestamp,
      endTimestamp: branch.endTimestamp,
    })) ?? [{ profile: participant }]
  );
}

function formatBeijingTimestamp(timestamp: number) {
  const parts = getCivilDateTimeAtFixedOffset(new Date(timestamp), BEIJING_OFFSET_HOURS);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}

function relationFactFingerprint(fact: AlmanacParticipantRelationFact) {
  const { key: _key, promptText: _promptText, birthTimeRange: _birthTimeRange, ...content } = fact;
  return JSON.stringify(content);
}

function mergeParticipantRangeFacts(
  participant: AlmanacParticipantProfile,
  branchFacts: Array<{
    facts: AlmanacParticipantRelationFact[];
    startTimestamp?: number;
    endTimestamp?: number;
  }>,
) {
  if (!participant.birthTimeRange) return branchFacts.flatMap((item) => item.facts);
  const groups = new Map<
    string,
    { fact: AlmanacParticipantRelationFact; intervals: Array<[number, number]> }
  >();
  for (const branch of branchFacts) {
    if (branch.startTimestamp === undefined || branch.endTimestamp === undefined) {
      throw new Error('参与人条件画像缺少完整时间边界。');
    }
    for (const fact of branch.facts) {
      const fingerprint = relationFactFingerprint(fact);
      const current = groups.get(fingerprint);
      if (current && current.intervals.at(-1)?.[1] === branch.startTimestamp) {
        current.intervals[current.intervals.length - 1]![1] = branch.endTimestamp;
      } else if (current) {
        current.intervals.push([branch.startTimestamp, branch.endTimestamp]);
      } else {
        groups.set(fingerprint, {
          fact,
          intervals: [[branch.startTimestamp, branch.endTimestamp]],
        });
      }
    }
  }

  return [...groups.values()].map(({ fact, intervals }, index) => {
    const source = participant.birthTimeRange!.source;
    const stable =
      intervals.length === 1 &&
      intervals[0]![0] === source.startTimestamp &&
      intervals[0]![1] === source.endTimestamp;
    const intervalText = intervals
      .map(
        ([startTimestamp, endTimestamp]) =>
          `${formatBeijingTimestamp(startTimestamp)} 至 ${formatBeijingTimestamp(endTimestamp)}（终点不含）`,
      )
      .join('、');
    return {
      ...fact,
      key: `${fact.key}:birth-range:${index + 1}`,
      promptText: stable ? fact.promptText : `${intervalText}：${fact.promptText}`,
      birthTimeRange: {
        status: stable ? ('stable' as const) : ('conditional' as const),
        intervals: intervals.map(([startTimestamp, endTimestamp]) => ({
          startTimestamp,
          endTimestamp,
          endExclusive: true as const,
        })),
      },
    };
  });
}

function buildDayFacts(params: {
  dateKey: string;
  topic: AlmanacTopic;
  dayStem: string;
  dayBranch: string;
  recommends: string[];
  avoids: string[];
  gods: AlmanacGodSource[];
  participants: AlmanacParticipantProfile[];
}) {
  const highlights: string[] = [];
  const cautions: string[] = [];
  const participantNotes: string[] = [];
  const topicMatchFacts: AlmanacTopicMatchFact[] = [];
  const participantRelationFacts: AlmanacParticipantRelationFact[] = [];
  const recommendKeywords = TOPIC_RECOMMEND_KEYWORDS[params.topic];
  const avoidKeywords = TOPIC_AVOID_KEYWORDS[params.topic];
  const recommendMatches = findKeywordMatches(params.recommends, recommendKeywords);
  const avoidMatches = findKeywordMatches(params.avoids, avoidKeywords);
  const generalRestriction = getGeneralRestriction(
    params.recommends,
    params.avoids,
    recommendMatches,
  );
  if (generalRestriction) {
    cautions.push(generalRestriction);
    topicMatchFacts.push(
      buildTopicMatchFact({
        key: `${params.dateKey}:topic:day-general-constraint`,
        scope: '候选日',
        topic: params.topic,
        sourceType: params.avoids.some((item) => /诸事不宜|[余馀]事勿取/u.test(item))
          ? '原始忌项'
          : '原始宜项',
        status: '限制',
        inputItems: [...params.recommends, ...params.avoids],
        keywords: [],
        matchedItems: [...params.recommends, ...params.avoids].filter((item) =>
          /诸事不宜|[余馀]事勿取/u.test(item),
        ),
        promptText: generalRestriction,
        sources: ['tyme4ts 当日宜忌'],
      }),
    );
  }

  topicMatchFacts.push(
    buildTopicMatchFact({
      key: `${params.dateKey}:topic:day-recommends`,
      scope: '候选日',
      topic: params.topic,
      sourceType: '原始宜项',
      status: recommendMatches.length ? '支持' : '中性',
      inputItems: [...params.recommends],
      keywords: [...recommendKeywords],
      matchedItems: recommendMatches,
      promptText: recommendMatches.length
        ? `原始宜项命中${ALMANAC_TOPIC_LABELS[params.topic]}：${recommendMatches.join('、')}`
        : `原始宜项未命中${ALMANAC_TOPIC_LABELS[params.topic]}关键词`,
      sources: ['tyme4ts 当日宜项', '当前事项宜用关键词表'],
    }),
    buildTopicMatchFact({
      key: `${params.dateKey}:topic:day-avoids`,
      scope: '候选日',
      topic: params.topic,
      sourceType: '原始忌项',
      status: avoidMatches.length ? '限制' : '中性',
      inputItems: [...params.avoids],
      keywords: [...avoidKeywords],
      matchedItems: avoidMatches,
      promptText: avoidMatches.length
        ? `原始忌项触及${ALMANAC_TOPIC_LABELS[params.topic]}：${avoidMatches.join('、')}`
        : `原始忌项未触及${ALMANAC_TOPIC_LABELS[params.topic]}关键词`,
      sources: ['tyme4ts 当日忌项', '当前事项避忌关键词表'],
    }),
  );

  if (recommendMatches.length) {
    highlights.push(`黄历宜项命中${ALMANAC_TOPIC_LABELS[params.topic]}`);
  }
  if (avoidMatches.length) {
    cautions.push(`黄历忌项触及${ALMANAC_TOPIC_LABELS[params.topic]}`);
  }

  const godFacts = buildGodFacts(params.dateKey, params.gods);

  params.participants.forEach((participant) => {
    const variants = getParticipantProfileVariants(participant);
    const conflictTexts = new Set<string>();
    const branchFacts = variants.map((variant) => {
      const branchConflict = getParticipantBranchConflictSummary(params.dayBranch, variant.profile);
      if (branchConflict.text) conflictTexts.add(branchConflict.text);
      const usefulGods = [...new Set(variant.profile.usefulGods)].filter(Boolean);
      const avoidGods = [...new Set(variant.profile.avoidGods)].filter(Boolean);
      const candidateElements = [getStemWuxing(params.dayStem), getBranchWuxing(params.dayBranch)];
      return {
        startTimestamp: variant.startTimestamp,
        endTimestamp: variant.endTimestamp,
        facts: [
          ...buildParticipantConflictFacts({
            keyPrefix: params.dateKey,
            scope: '候选日' as const,
            candidateBranch: params.dayBranch,
            participant: variant.profile,
            relations: branchConflict.relations,
          }),
          {
            key: `${params.dateKey}:participant:${participant.id}:elements-not-adopted`,
            participantId: participant.id,
            participantName: participant.name,
            scope: '候选日' as const,
            basis: '整体' as const,
            candidateValue: candidateElements.join('、'),
            participantValues: [...usefulGods, ...avoidGods],
            relation: '未采用' as const,
            status: '未采用' as const,
            detail: '仅凭候选日干支五行是否命中喜忌，不能替代完整择日合参',
            promptText: `${participant.name}：不采用候选日干支五行简单命中喜忌作为排序或限制依据`,
            sources: ['参与人八字资料', '候选日干支五行', '择日合参适用边界'],
            limitation: PARTICIPANT_FACT_LIMITATION,
          },
        ],
      };
    });
    participantRelationFacts.push(...mergeParticipantRangeFacts(participant, branchFacts));

    for (const conflictText of conflictTexts) {
      participantNotes.push(`${participant.name}：${conflictText}`);
    }
    if (!conflictTexts.size) {
      participantNotes.push(
        `${participant.name}：日主${participant.dayMaster}${participant.dayMasterElement}，生肖${participant.zodiac}，未见候选日与年支、日支直接刑冲破害`,
      );
    }
  });

  return {
    highlights,
    cautions,
    participantNotes,
    topicMatchFacts,
    godFacts,
    participantRelationFacts,
  };
}

function buildHourCandidates(
  dateKey: string,
  lunarDay: AlmanacLunarDaySource,
  participants: AlmanacParticipantProfile[],
  topic: AlmanacTopic,
): AlmanacHourCandidate[] {
  const lunarHours = lunarDay.getHours();
  if (lunarHours.length !== SHICHEN_PERIODS.length) {
    throw new Error(
      `黄历时辰资料数量异常：应为${SHICHEN_PERIODS.length}项，实际${lunarHours.length}项`,
    );
  }
  return lunarHours.map((hour, index) => {
    const ganzhi = hour.getSixtyCycle().getName();
    const branch = ganzhi.slice(-1);
    const period = SHICHEN_PERIODS[index];
    if (!period) {
      throw new Error(`黄历第${index + 1}个时辰缺少时段定义`);
    }
    if (branch !== period.branch) {
      throw new Error(`黄历第${index + 1}个时辰地支与时段不一致：${ganzhi}对应${period.name}`);
    }
    const twelveStar = hour.getTwelveStar().getName();
    const highlights: string[] = [];
    const cautions: string[] = [];
    const participantNotes: string[] = [];
    const participantRelationFacts: AlmanacParticipantRelationFact[] = [];
    const hourName = period.name;
    const hourKey = `${dateKey}:hour:${ganzhi}:${hourName}`;
    const recommends = normalizeTaboos(hour.getRecommends());
    const avoids = normalizeTaboos(hour.getAvoids());
    const topicMatchFacts = (['recommends', 'avoids'] as const).map((kind) => {
      const inputItems = kind === 'recommends' ? recommends : avoids;
      const keywords =
        kind === 'recommends' ? TOPIC_RECOMMEND_KEYWORDS[topic] : TOPIC_AVOID_KEYWORDS[topic];
      const matchedItems = findKeywordMatches(inputItems, keywords);
      const status = matchedItems.length ? (kind === 'recommends' ? '支持' : '限制') : '中性';
      const promptText = `${hourName}原始${kind === 'recommends' ? '宜' : '忌'}项${matchedItems.length ? `命中${ALMANAC_TOPIC_LABELS[topic]}：${matchedItems.join('、')}` : `未命中${ALMANAC_TOPIC_LABELS[topic]}`}`;
      if (status === '支持') highlights.push(promptText);
      if (status === '限制') cautions.push(promptText);
      return buildTopicMatchFact({
        key: `${hourKey}:topic:hour-${kind}`,
        scope: '时辰',
        topic,
        sourceType: kind === 'recommends' ? '原始宜项' : '原始忌项',
        status,
        inputItems,
        keywords,
        matchedItems,
        promptText,
        sources: ['tyme4ts 逐时宜忌', '当前事项关键词表'],
      });
    });
    const generalRestriction = getGeneralRestriction(
      recommends,
      avoids,
      topicMatchFacts[0].matchedItems,
    );
    if (generalRestriction) {
      cautions.push(generalRestriction);
      topicMatchFacts.push(
        buildTopicMatchFact({
          key: `${hourKey}:topic:hour-general-constraint`,
          scope: '时辰',
          topic,
          sourceType: avoids.some((item) => /诸事不宜|[余馀]事勿取/u.test(item))
            ? '原始忌项'
            : '原始宜项',
          status: '限制',
          inputItems: [...recommends, ...avoids],
          keywords: [],
          matchedItems: [...recommends, ...avoids].filter((item) =>
            /诸事不宜|[余馀]事勿取/u.test(item),
          ),
          promptText: generalRestriction,
          sources: ['tyme4ts 逐时宜忌'],
        }),
      );
    }
    participants.forEach((participant) => {
      const conflictTexts = new Set<string>();
      const branchFacts = getParticipantProfileVariants(participant).map((variant) => {
        const conflict = getParticipantBranchConflictSummary(branch, variant.profile);
        if (conflict.text) conflictTexts.add(conflict.text);
        return {
          startTimestamp: variant.startTimestamp,
          endTimestamp: variant.endTimestamp,
          facts: buildParticipantConflictFacts({
            keyPrefix: hourKey,
            scope: '时辰',
            candidateBranch: branch,
            participant: variant.profile,
            relations: conflict.relations,
          }),
        };
      });
      participantRelationFacts.push(...mergeParticipantRangeFacts(participant, branchFacts));
      for (const conflictText of conflictTexts) {
        participantNotes.push(`${participant.name}：时支${conflictText.replace('候选日地支', '')}`);
      }
    });
    return {
      name: hourName,
      range: period.range,
      ganzhi,
      branch,
      twelveStar,
      recommends,
      avoids,
      topicMatchFacts,
      highlights,
      cautions,
      participantNotes,
      participantRelationFacts,
    };
  });
}

// 地支刑冲破害判断已委托公共干支模块。

function buildDayCandidate(
  date: Date,
  topic: AlmanacTopic,
  participants: AlmanacParticipantProfile[],
): AlmanacDayCandidate {
  const dateKey = formatDate(date);
  // 黄历当前没有地点和时区入参，因此用中国标准时间正午作为整日月相的统一参照点。
  // 这项天文事实不参与传统宜忌评分，避免时区假设被包装成择日结论。
  const moonPhaseEvidence = calculateMoonPhaseEvidence(
    createUtcTimestamp(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 4),
  );
  const solarDay = SolarDay.fromYmd(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
  const lunarDay = solarDay.getLunarDay();
  const noonEightChar = getNoonEightChar(date);
  const dayCycle = lunarDay.getSixtyCycle();
  const dayBranch = dayCycle.getEarthBranch();
  const recommends = normalizeTaboos(lunarDay.getRecommends());
  const avoids = normalizeTaboos(lunarDay.getAvoids());
  const godSources = getHuangliSolarDayGods(solarDay);
  const gods = godSources.map((item) => item.getName());
  const scoring = buildDayFacts({
    dateKey,
    topic,
    dayStem: dayCycle.getHeavenStem().getName(),
    dayBranch: dayBranch.getName(),
    recommends,
    avoids,
    gods: godSources,
    participants,
  });

  // 彭祖百忌完整：天干+地支
  const dayStemName = dayCycle.getHeavenStem().getName();
  const dayZhiName = dayCycle.getEarthBranch().getName();
  const twentyEightStar = lunarDay.getTwentyEightStar().getName();
  const nineStar = lunarDay.getNineStar().getName();
  const pengZuDetails = getAlmanacPengZuDetails(dayStemName, dayZhiName);
  const hours = buildHourCandidates(dateKey, lunarDay, participants, topic);

  return {
    date: dateKey,
    moonPhaseEvidence,
    weekday: WEEKDAYS[date.getUTCDay()],
    lunarDate: lunarDay.toString(),
    ganzhi: {
      year: noonEightChar.getYear().getName(),
      month: noonEightChar.getMonth().getName(),
      day: noonEightChar.getDay().getName(),
    },
    zodiac: dayBranch.getZodiac().getName(),
    dayOfficer: lunarDay.getDuty().getName(),
    twelveStar: lunarDay.getTwelveStar().getName(),
    twentyEightStar,
    twentyEightStarDetail: getAlmanacTwentyEightStarDetail(twentyEightStar),
    nineStar,
    nineStarDetail: getAlmanacNineStarDetail(nineStar),
    gods,
    recommends,
    avoids,
    pengZu: `${pengZuDetails.gan} ${pengZuDetails.zhi}`,
    // 彭祖百忌完整：天干+地支
    pengZuGan: pengZuDetails.gan,
    pengZuZhi: pengZuDetails.zhi,
    clash: `冲${dayBranch.getOpposite().getName()}，煞${dayBranch.getOminous().getName()}`,
    annualDirectionGods: getAlmanacAnnualDirectionGods(
      noonEightChar.getYear().getEarthBranch().getName(),
    ),
    highlights: scoring.highlights,
    cautions: scoring.cautions,
    participantNotes: scoring.participantNotes,
    topicMatchFacts: scoring.topicMatchFacts,
    godFacts: scoring.godFacts,
    participantRelationFacts: scoring.participantRelationFacts,
    hours,
  };
}

/**
 * 生成黄历择日结果
 *
 * 对指定日期范围内逐日分析宜忌、神煞、冲煞、建除十二值、
 * 二十八宿、彭祖百忌等，并基于参与人八字进行刑冲破害校验。
 *
 * @param params 择日参数：
 *   - topic: 事项类型（marriage/move/opening/…）
 *   - startDate: 开始日期 (YYYY-MM-DD)
 *   - endDate: 结束日期 (YYYY-MM-DD)，最多比较 180 天
 *   - participants: 参与人信息（可选），含八字用于刑冲破害校验
 * @returns 黄历择日数据对象 AlmanacData。
 *
 * @example
 * ```ts
 * const result = generateAlmanacSelection({
 *   topic: 'marriage',
 *   startDate: '2025-06-01',
 *   endDate: '2025-06-30',
 * });
 * // result 包含按透明候选分组排列的逐日资料与证据链
 * ```
 */
export function generateAlmanacSelection(params: {
  topic: AlmanacTopic;
  startDate: string;
  endDate: string;
  participants?: AlmanacParticipantInput[];
  weekendPreference?: 'any' | 'prefer' | 'avoid';
  timePreferences?: Array<'work-hours' | 'morning' | 'afternoon'>;
}): AlmanacData {
  assertAlmanacTopic(params.topic);
  const start = parseDateText(params.startDate, '开始日期');
  const end = parseDateText(params.endDate, '结束日期');
  const diffDays = Math.round((end.date.getTime() - start.date.getTime()) / 86400000);

  if (diffDays < 0) {
    throw new Error('结束日期不能早于开始日期');
  }
  if (diffDays > 179) {
    throw new Error('黄历择日一次最多比较 180 天，请缩小日期范围');
  }

  const participants = createParticipantProfiles(params.participants ?? []);
  const weekendPreference = params.timePreferences?.includes('work-hours')
    ? 'avoid'
    : (params.weekendPreference ?? 'any');
  const statusPriority = { 可用候选: 0, 条件候选: 1, 慎用候选: 2 } as const;
  const days = Array.from({ length: diffDays + 1 }, (_, index) => {
    const current = new Date(start.date);
    current.setUTCDate(start.date.getUTCDate() + index);
    return buildDayCandidate(current, params.topic, participants);
  }).sort((a, b) => {
    const statusDifference =
      statusPriority[classifyAlmanacCandidate(a, params.timePreferences).status] -
      statusPriority[classifyAlmanacCandidate(b, params.timePreferences).status];
    const aWeekend = a.weekday === '星期六' || a.weekday === '星期日' ? 1 : 0;
    const bWeekend = b.weekday === '星期六' || b.weekday === '星期日' ? 1 : 0;
    const weekendDifference =
      weekendPreference === 'prefer'
        ? bWeekend - aWeekend
        : weekendPreference === 'avoid'
          ? aWeekend - bWeekend
          : 0;
    const supportDifference =
      (b.topicMatchFacts ?? []).filter((fact) => fact.status === '支持').length -
      (a.topicMatchFacts ?? []).filter((fact) => fact.status === '支持').length;
    return (
      statusDifference || weekendDifference || supportDifference || a.date.localeCompare(b.date)
    );
  });

  const result: AlmanacData = {
    topic: params.topic,
    topicLabel: ALMANAC_TOPIC_LABELS[params.topic],
    startDate: params.startDate,
    endDate: params.endDate,
    weekendPreference,
    timePreferences: [...(params.timePreferences ?? [])],
    days,
    participants,
    timestamp: Date.now(),
  };
  const evidenceAnalysis = analyzeAlmanacEvidence(result);
  return { ...result, evidenceAnalysis };
}

export {
  analyzeAlmanacEvidence,
  conditionAlmanacTraditionalText,
  formatAlmanacGods,
} from '../almanac-evidence';
export type {
  AlmanacCandidateEvidence,
  AlmanacCandidateDecisionFact,
  AlmanacCandidateStatus,
  AlmanacDecisionStep,
  AlmanacEvidenceAnalysis,
  AlmanacHourEvidence,
  AlmanacRawTabooFact,
  AlmanacTraditionalFact,
} from '../almanac-evidence';
