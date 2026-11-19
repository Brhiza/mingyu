import { SolarTime } from 'tyme4ts';
import { getCivilDateTimeAtFixedOffset } from '../huangji/civil-time';
import { getDivinationTime, getMonthLeaderByZhongqi, getSolarTermName } from '../calendar';
import { correctBirthClock, resolveBirthClock } from '../birth-time';
import {
  type EarthRule,
  getBranchIndex,
  getBranchWuxing,
  getBranchYinYang,
  getHiddenStems,
  getLifeStage,
  getNayin,
  getSixtyCycleIndex,
  getSixtyCycleName,
  getStemIndex,
  getStemWuxing,
  getStemYinYang,
  getTenStar,
  getVoidBranches,
  getYearSixtyCycle,
  stepSixtyCycle,
} from '../ganzhi-foundation';
import { resolveBaziRules } from '../defaults';
import { civilDayHour } from './civil-day-hour';
import { getMonthCommanderAt, type BaziCommanderMode } from './season';
import { buildNatalFacts } from './natal-facts';
import { buildDayMasterStrength } from './strength';
import { buildOrdinaryPattern, summarizePattern, type BaziPatternMode } from './pattern';
import { buildTransformation } from './transformation';
import { buildQuzhi } from './quzhi';
import { buildCongEr } from './conger';
import { buildExtremePattern } from './extreme';
import { buildUsefulBaseline } from './useful-baseline';
import { buildClimateCandidates } from './climate';
import { resolveClimate } from './climate-decision';
import { buildUsefulStrategy } from './useful-strategy';
import { buildPatternEvidence } from './pattern-evidence';
import { calculateBaziShensha, type BaziYangRenMode } from './shensha';

export interface BaziBirth {
  year: number; month: number; day: number;
  calendar?: 'solar' | 'lunar';
  leapMonth?: boolean;
  clock: { kind: 'exact'; hour: number; minute: number; second: number } | { kind: 'shichen'; index: number };
  timezone?: number;
  timeZoneId?: string;
  timeStandard?: 'civil' | 'true-solar';
  longitude?: number;
}
export interface BaziPillar {
  ganZhi: string; gan: string; zhi: string;
  stemElement: string; branchElement: string;
  stemYinYang: string; branchYinYang: string;
  tenGod: string; hiddenStems: Array<{ stem: string; tenGod: string }>;
  naYin: string; voidBranches: string[]; lifeStage: string; selfLifeStage: string;
}
export type PillarName = 'year' | 'month' | 'day' | 'hour';
export type PillarNames = Record<PillarName, string>;
export interface BaziRules {
  yearBoundary?: 'lichun' | 'lunar-new-year' | 'dongzhi';
  ziHourMode?: '23:00' | 'split-zi';
  nightZiStemMode?: 'next-day' | 'current-day';
  solarTermMode?: 'exact-instant' | 'civil-day';
  patternMode?: BaziPatternMode;
  includeExtraPalaces?: boolean;
  mingGongMethod?: 'traditional' | 'solar-position';
  kongWangMode?: 'day' | 'day-and-year';
  fortuneRule?: 'exact-3days' | 'round-day';
  yangRenMode?: BaziYangRenMode;
  commanderMode?: BaziCommanderMode;
  earthRule?: EarthRule;
}
export interface BaziExtraPalaces {
  mingGong: BaziPillar;
  shenGong: BaziPillar;
  taiYuan: BaziPillar;
  taiXi: BaziPillar;
}
const keys: PillarName[] = ['year', 'month', 'day', 'hour'];
const timePeriods = [
  [0, 30], [2, 0], [4, 0], [6, 0], [8, 0], [10, 0], [12, 0],
  [14, 0], [16, 0], [18, 0], [20, 0], [22, 0], [23, 30],
] as const;
const liuheBranch: Record<string, string> = {
  子: '丑', 丑: '子', 寅: '亥', 卯: '戌', 辰: '酉', 巳: '申',
  午: '未', 未: '午', 申: '巳', 酉: '辰', 戌: '卯', 亥: '寅',
};

function toBeijingSolarTime(timestamp: number) {
  const d = new Date(timestamp + 8 * 3_600_000);
  return SolarTime.fromYmdHms(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
}

function resolveTermTimestamp(utcTimestamp: number, solarTermMode?: BaziRules['solarTermMode']) {
  if (solarTermMode !== 'civil-day') return utcTimestamp;
  const d = new Date(utcTimestamp + 8 * 3_600_000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23 - 8, 59, 59);
}

function resolveYearGanZhi(termTimestamp: number, defaultYear: string, yearBoundary?: BaziRules['yearBoundary']) {
  if (!yearBoundary || yearBoundary === 'lichun') return defaultYear;
  const st = toBeijingSolarTime(termTimestamp);
  if (yearBoundary === 'lunar-new-year') return getYearSixtyCycle(st.getSolarDay().getLunarDay().getYear());
  const termName = st.getTerm().getName();
  return termName === '冬至' || termName === '小寒' || termName === '大寒' ? stepSixtyCycle(defaultYear, 1) : defaultYear;
}

function resolveDayHourGanZhi(
  corrected: number,
  timezone: number,
  localGanzhi: { day: string; hour: string },
  ziHourMode?: BaziRules['ziHourMode'],
  nightZiStemMode?: BaziRules['nightZiStemMode'],
) {
  if (ziHourMode !== 'split-zi') return { day: localGanzhi.day, hour: localGanzhi.hour };
  const calcClock = getCivilDateTimeAtFixedOffset(new Date(corrected), timezone);
  if (calcClock.hour !== 23) return { day: localGanzhi.day, hour: localGanzhi.hour };
  const earlyZi = civilDayHour({ year: calcClock.year, month: calcClock.month, day: calcClock.day, hour: 0 });
  return {
    day: earlyZi.day,
    hour: nightZiStemMode === 'current-day' ? earlyZi.hour : localGanzhi.hour,
  };
}

function buildExtraPalaces(names: PillarNames, termTimestamp: number, dayMaster: string, mingGongMethod: BaziRules['mingGongMethod'] = 'traditional', earthRule?: EarthRule): BaziExtraPalaces {
  const yearStemIdx = getStemIndex(names.year[0]);
  const monthIdx = getSixtyCycleIndex(names.month);
  const monthStemIdx = monthIdx % 10;
  const monthBranchIdx = monthIdx % 12;
  const dayIdx = getSixtyCycleIndex(names.day);
  const dayStemIdx = dayIdx % 10;
  const dayBranchIdx = dayIdx % 12;
  const hourBranchIdx = getBranchIndex(names.hour[1]);

  const ownSignBranch = mingGongMethod === 'solar-position'
    ? getBranchIndex(liuheBranch[getMonthLeaderByZhongqi(termTimestamp)])
    : monthBranchIdx;
  const mingGongName = getSixtyCycleName(yearStemIdx * 12 + ((27 - ownSignBranch - hourBranchIdx) % 12) + 2);
  const shenGongName = getSixtyCycleName(yearStemIdx * 12 + ((11 + monthBranchIdx + hourBranchIdx) % 12) + 2);
  const taiYuanName = getSixtyCycleName(((monthStemIdx + 1) % 10) * 6 - ((monthBranchIdx + 3) % 12) * 5);
  const taiXiName = getSixtyCycleName(((dayStemIdx + 5) % 10) * 6 + dayBranchIdx * 5 - 65);

  return {
    mingGong: buildPillarFact(mingGongName, dayMaster, false, earthRule),
    shenGong: buildPillarFact(shenGongName, dayMaster, false, earthRule),
    taiYuan: buildPillarFact(taiYuanName, dayMaster, false, earthRule),
    taiXi: buildPillarFact(taiXiName, dayMaster, false, earthRule),
  };
}

/** 从四柱计算藏干、十神、纳音、旬空及十二长生；不包含旺衰或格局判断。 */
export function buildPillarFact(name: string, dayMasterName: string, isDayMaster = false, earthRule?: EarthRule): BaziPillar {
  getSixtyCycleIndex(name);
  const stem = name[0];
  const branch = name[1];
  return {
    ganZhi: name,
    gan: stem,
    zhi: branch,
    stemElement: getStemWuxing(stem),
    branchElement: getBranchWuxing(branch),
    stemYinYang: getStemYinYang(stem),
    branchYinYang: getBranchYinYang(branch),
    tenGod: isDayMaster ? '日主' : getTenStar(dayMasterName, stem),
    hiddenStems: getHiddenStems(branch).map((hidden) => ({ stem: hidden, tenGod: getTenStar(dayMasterName, hidden) })),
    naYin: getNayin(name),
    voidBranches: getVoidBranches(name),
    lifeStage: getLifeStage(dayMasterName, branch, earthRule ? { earthRule } : undefined),
    selfLifeStage: getLifeStage(stem, branch, earthRule ? { earthRule } : undefined),
  };
}

export function buildPillarFacts(names: PillarNames, earthRule?: EarthRule): Record<PillarName, BaziPillar> {
  getSixtyCycleIndex(names.day);
  const dayMaster = names.day[0];
  return Object.fromEntries(keys.map((key) => [key, buildPillarFact(names[key], dayMaster, key === 'day', earthRule)])) as Record<PillarName, BaziPillar>;
}

/** 年月由实际瞬时对应的东八区节气确定，日时由当地钟表或真太阳时确定；支持可选排盘口径。 */
export async function calculateBaziPillars(birth: BaziBirth, gender?: 'male' | 'female', rules?: BaziRules) {
  if (!Number.isInteger(birth.year) || birth.year < 1900 || birth.year > 2100) throw new Error('出生年份须在 1900 至 2100 之间。');
  if (!birth.clock || !['exact', 'shichen'].includes(birth.clock.kind)) throw new Error('须提供明确时分秒或时辰。');
  if (birth.clock.kind === 'shichen' && birth.timeStandard === 'true-solar') throw new Error('真太阳时须提供精确出生时分秒。');
  let hour: number, minute: number, second: number;
  if (birth.clock.kind === 'exact') ({ hour, minute, second } = birth.clock);
  else {
    if (!Number.isInteger(birth.clock.index) || !timePeriods[birth.clock.index]) throw new Error('出生时辰索引须在 0 至 12 之间。');
    [hour, minute] = timePeriods[birth.clock.index]; second = 0;
  }
  const clock = { year: birth.year, month: birth.month, day: birth.day, hour, minute, second, calendar: birth.calendar, leapMonth: birth.leapMonth, timezone: birth.timezone, timeZoneId: birth.timeZoneId, timeStandard: birth.timeStandard, longitude: birth.longitude };
  const resolved = resolveBirthClock(clock);
  const offsetMinutes = resolved.timezone * 60;
  const { timestamp: corrected, correction: trueSolar } = await correctBirthClock(clock, resolved);
  const resolvedRules = resolveBaziRules(rules);
  const termTimestamp = resolveTermTimestamp(resolved.utcTimestamp, resolvedRules.solarTermMode);
  const actual = getDivinationTime(new Date(termTimestamp));
  const local = getDivinationTime(new Date(corrected), offsetMinutes);
  const dayHour = resolveDayHourGanZhi(corrected, resolved.timezone, local.ganzhi, resolvedRules.ziHourMode, resolvedRules.nightZiStemMode);
  const names: PillarNames = {
    year: resolveYearGanZhi(termTimestamp, actual.ganzhi.year, resolvedRules.yearBoundary),
    month: actual.ganzhi.month,
    day: dayHour.day,
    hour: dayHour.hour,
  };
  const pillars = buildPillarFacts(names, resolvedRules.earthRule);
  const monthCommander = getMonthCommanderAt(termTimestamp, resolvedRules.commanderMode);
  const strength = buildDayMasterStrength(pillars, monthCommander.stem);
  const ordinaryPattern = buildOrdinaryPattern(pillars, monthCommander.stem);
  const transformation = buildTransformation(pillars, strength);
  const quzhi = buildQuzhi(pillars);
  const conger = buildCongEr(pillars, strength, monthCommander.stem);
  const extreme = buildExtremePattern(pillars, strength, monthCommander.stem, quzhi, conger);
  const patternOverview = summarizePattern(ordinaryPattern, transformation, quzhi, conger, extreme, resolvedRules.patternMode);
  const usefulBaseline = buildUsefulBaseline(pillars, strength, patternOverview, transformation);
  const climate = buildClimateCandidates(pillars, strength, patternOverview, getSolarTermName(termTimestamp));
  const climateDecision = resolveClimate(climate.candidates, usefulBaseline);
  const extraPalaces = !resolvedRules.includeExtraPalaces
    ? undefined
    : buildExtraPalaces(names, termTimestamp, pillars.day.gan, resolvedRules.mingGongMethod, resolvedRules.earthRule);
  return {
    input: birth,
    basis: { precision: birth.clock.kind, localDateTime: resolved.localDateTime, utcTimestamp: resolved.utcTimestamp, timezone: resolved.timezone,
      ...(birth.timeZoneId ? { timeZoneId: birth.timeZoneId } : {}), timeStandard: birth.timeStandard ?? 'civil',
      calculationClock: getCivilDateTimeAtFixedOffset(new Date(corrected), resolved.timezone), ...(trueSolar ? { trueSolar } : {}),
      ...(birth.clock.kind === 'shichen' ? { limitation: '时辰按区间中点作为示例；区间内可能跨节气、司权或换日，不能据此断言全部时刻相同。' } : {}) },
    pillars,
    ...(extraPalaces ? { extraPalaces } : {}),
    natalFacts: buildNatalFacts(pillars, monthCommander.stem),
    shensha: calculateBaziShensha(pillars, gender, undefined, rules?.yangRenMode ? { yangRenMode: rules.yangRenMode } : undefined),
    strength,
    ordinaryPattern, transformation, quzhi, conger, extreme, patternEvidence: buildPatternEvidence(pillars, patternOverview, monthCommander.stem, strength.status),
    patternOverview,
    usefulBaseline, climate, climateDecision, usefulStrategy: buildUsefulStrategy(pillars, strength, patternOverview, monthCommander.stem, climateDecision),
    monthCommander,
  };
}
