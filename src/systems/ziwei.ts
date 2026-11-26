import type { z } from 'zod';
import type { ziweiIndependentInput } from '../schema';
import { sameJsonValue } from '../json-value';
import { chinaDstAdvisory, resolveBirthClock, correctBirthClock, lunarDateDiscrepancy } from './birth-time';
import { createTimezoneOffsetReader, getCivilDateTimeAtFixedOffset, createUtcTimestamp } from './huangji/civil-time';
import { buildScopePalaceFlying, buildThreeTierMutagenOverlay, buildZiweiStructureHighlights, formatFeixingHighlights, formatNatalFlying, formatScopeFlying, formatScopeFlyingHighlights, formatScopeMutagens, formatThreeTierMutagenOverlay, locateScopeMutagens } from './ziwei-flying';
import { buildMethodSituationDigest } from './situation-digest';
import { detectZiweiPatterns, formatZiweiPatternRelations, formatZiweiPatterns } from './ziwei-patterns';
import { dedupeExcerpts, formatClassicExcerpts, selectZiweiClassics } from './classics';
import { evaluateZiweiSchoolAlgorithms, formatSchoolAlgorithmSection } from './school-algorithms';
import { EARTHLY_BRANCHES, HEAVENLY_STEMS, getSixtyCycleName, getYearMonthGanZhi, getYearSixtyCycle } from './ganzhi-foundation';
import { inferFortuneScope } from '../router-model/fortune-scope';
import { formatZiweiDailyRangeBlock, resolveDailyRange } from './daily-range';
import {
  buildZiweiAstrolabe,
  buildZiweiHoroscope,
  getMutagensByStem,
  getPalaceNames,
  normalizeZiweiRules,
  resolveLeapMonthOffset,
  type HeavenlyStem,
  type ZiweiEngineRules,
  type ZiweiStar,
} from './ziwei/index';

export function formatZiweiStarLabel(
  star: { name: string; brightness?: string; mutagen?: string },
  opts?: { parenBrightness?: boolean },
): string {
  const rawBright = star.brightness ?? '';
  const bright = rawBright === '不' ? '不得' : rawBright;
  const brightPart = bright ? (opts?.parenBrightness ? `(${bright})` : bright) : '';
  return `${star.name}${brightPart}${star.mutagen ? `·化${star.mutagen}` : ''}`;
}

/** Collect major star names from 命宫/身宫, falling back to all natal palaces if empty. */
export function collectZiweiMajorStars(
  palaces: ReadonlyArray<{ name: string; isBodyPalace?: boolean; majorStars: ReadonlyArray<{ name: string }> }>,
): string[] {
  const focus = palaces
    .filter((p) => p.name === '命宫' || p.isBodyPalace)
    .flatMap((p) => p.majorStars.map((s) => s.name));
  return focus.length ? focus : palaces.flatMap((p) => p.majorStars.map((s) => s.name));
}

type Input = z.infer<typeof ziweiIndependentInput>;
type Source = Pick<Input, 'birth' | 'gender' | 'referenceTime' | 'includeTimeline' | 'dailyRange' | 'rules' | 'prompt'>;
type Options = Input['prompt'];
const dateString = (parts: { year: number; month: number; day: number }) => `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
const timeIndex = (hour: number) => hour === 23 ? 12 : Math.floor((hour + 1) / 2);
const topicLabels: Record<NonNullable<NonNullable<Options>['topic']>, string> = {
  life: '整体人生', destiny: '命局综述', relationship: '婚恋关系', 'relationship-push': '关系推进', 'relationship-decision': '关系去留', children: '子女亲缘',
  'career-wealth': '事业财运', 'job-change': '工作变动', 'startup-partnership': '创业合作', 'investment-partnership': '投资合作', recent: '近期趋势', family: '家庭六亲',
  'home-move': '搬家置业', 'settle-relocate': '定居换城', social: '人际合作', emotion: '情绪调节', health: '健康养护', study: '学业成长', 'study-advance': '考证进修',
  'exam-landing': '考试准备', 'reconciliation-decision': '复合判断', growth: '成长课题', talent: '天赋优势', chat: '自由问答',
};
const topicFocus: Record<NonNullable<NonNullable<Options>['topic']>, string> = {
  life: '命宫、身宫、福德宫及十二宫关系', destiny: '命身宫、主辅星和实际列出的四化',
  relationship: '夫妻宫、命身宫及相关四化', 'relationship-push': '夫妻宫、福德宫、迁移宫，结合双方意愿与沟通',
  'relationship-decision': '夫妻宫、福德宫及双方已知相处条件', 'reconciliation-decision': '夫妻宫、福德宫、迁移宫及实际分歧，不预设对方意愿',
  children: '子女宫及其相关星曜', 'career-wealth': '官禄宫、财帛宫、迁移宫及命身宫', 'job-change': '官禄宫、迁移宫、福德宫及实际工作选择',
  'startup-partnership': '官禄宫、财帛宫、迁移宫及合作职责', 'investment-partnership': '财帛宫、田宅宫、福德宫及出资和风险承担',
  recent: '已选运限层级及其与本命的对应', family: '父母宫、兄弟宫、子女宫和田宅宫', 'home-move': '田宅宫、迁移宫及居住成本',
  'settle-relocate': '迁移宫、田宅宫、官禄宫及现实地点选择', social: '迁移宫、兄弟宫、夫妻宫及合作边界', emotion: '福德宫、命宫、疾厄宫及用户描述的压力',
  health: '疾厄宫、父母宫、福德宫及用户已知情况；传统取象不作为医学诊断', study: '官禄宫、父母宫、福德宫及实际学习计划',
  'study-advance': '官禄宫、父母宫、福德宫及学习目标', 'exam-landing': '官禄宫、父母宫、迁移宫及备考条件，不断言考试结果',
  growth: '命宫、身宫、福德宫及现实成长目标', talent: '命宫、身宫、官禄宫及实际训练经历', chat: '与问题相关且实际列出的宫位与星曜',
};
const scopes = ['decadal', 'yearly', 'monthly', 'daily', 'hourly', 'age'] as const;
const scopeLabels = { decadal: '大限', yearly: '流年', monthly: '流月', daily: '流日', hourly: '流时', age: '小限' } as const;
const schoolTasks = {
  sanhe: '三合：核对相关宫位、对宫及三方的星曜组合。',
  feixing: '飞星：核对本命宫干四化及所列运限四化落点；若列出运限宫名映射，须按说明沿用本命宫干，不把它当作另起运限宫干或流曜飞化。',
  sihua: '四化：区分生年与各运限四化，逐项核对化星及所在宫。',
  zhongzhou: '中州：核对安星对宫借星、双星同宫、邻宫夹辅与各层流曜叠冲。',
};

const algorithmLabels: Record<ZiweiEngineRules['algorithm'], string> = {
  default: '默认',
  zhongzhou: '中州',
  beipai: '北派',
};
const mutagenLabels: Record<ZiweiEngineRules['mutagenSchool'], string> = {
  default: '通行四化',
  zhongzhou: '中州四化',
  quanshu: '全书四化',
  tianfu: '天府科四化',
};
const plateLabels: Record<ZiweiEngineRules['plateType'], string> = {
  heaven: '天盘',
  earth: '地盘（身宫立极）',
  human: '人盘（福德立极）',
};
const leapLabels: Record<ZiweiEngineRules['leapMonthMode'], string> = {
  'split-15': '闰月修正启用（十五日分界）',
  same: '闰月修正关闭（沿用本月）',
  next: '闰月按次月处理',
};

const yearDivideLabels: Record<ZiweiEngineRules['yearDivide'], string> = {
  normal: '农历年',
  exact: '立春',
};
const horoscopeDivideLabels: Record<ZiweiEngineRules['horoscopeDivide'], string> = {
  normal: '农历年',
  exact: '立春',
};
const dayDivideLabels: Record<ZiweiEngineRules['dayDivide'], string> = {
  forward: '归次日',
  current: '归当日',
};

function formatZiweiRulesSummary(rules: ZiweiEngineRules): string {
  return [
    `${algorithmLabels[rules.algorithm]}安星`,
    ...(rules.mutagenSchool !== 'default' ? [mutagenLabels[rules.mutagenSchool]] : []),
    ...(rules.plateType !== 'heaven' ? [plateLabels[rules.plateType]] : []),
    ...(rules.tianmaMode !== 'year' ? ['月马'] : []),
    leapLabels[rules.leapMonthMode],
    `年分界=${yearDivideLabels[rules.yearDivide] ?? rules.yearDivide}，运限分界=${horoscopeDivideLabels[rules.horoscopeDivide] ?? rules.horoscopeDivide}，晚子日界=${dayDivideLabels[rules.dayDivide] ?? rules.dayDivide}${rules.ageDivide === 'birthday' ? '，年龄分界=按生辰' : ''}`,
  ].join('；');
}

async function calculateExactData(source: Source) {
  const { birth } = source;
  if (birth.clock.kind !== 'exact') throw new Error('独立紫微预览需要精确出生时分秒。');
  const clock = { year: birth.year, month: birth.month, day: birth.day, ...birth.clock, calendar: birth.calendar, leapMonth: birth.leapMonth,
    timezone: birth.timezone, timeZoneId: birth.timeZoneId, applyChinaDst: birth.applyChinaDst, timeStandard: birth.timeStandard, longitude: birth.longitude };
  const resolved = resolveBirthClock(clock), corrected = await correctBirthClock(clock, resolved);
  const chinaDstWarning = chinaDstAdvisory(clock);
  const wall = getCivilDateTimeAtFixedOffset(new Date(corrected.timestamp), resolved.timezone);
  const rules = normalizeZiweiRules(source.rules);
  const originalIndex = timeIndex(wall.hour);
  const effectiveDate = rules.dayDivide === 'forward' && originalIndex === 12 ? getCivilDateTimeAtFixedOffset(new Date(createUtcTimestamp(wall.year, wall.month - 1, wall.day + 1)), 0) : wall;
  const effectiveIndex = rules.dayDivide === 'forward' && originalIndex === 12 ? 0 : originalIndex;
  if (effectiveDate.year < 1 || effectiveDate.year > 2500) throw new Error('独立紫微排盘日期须在公元 1 至 2500 年。');
  const chart = buildZiweiAstrolabe({
    solarDate: { year: effectiveDate.year, month: effectiveDate.month, day: effectiveDate.day },
    timeIndex: effectiveIndex,
    gender: source.gender,
    rules,
    solarTermMoment: { year: wall.year, month: wall.month, day: wall.day, hour: wall.hour, minute: wall.minute, second: wall.second },
  });
  const star = (value: ZiweiStar) => ({ name: value.name, type: value.type, scope: value.scope, ...(value.brightness ? { brightness: value.brightness } : {}), ...(value.mutagen ? { mutagen: value.mutagen } : {}) });
  const palaces = chart.palaces.map((palace) => {
    const stars = getMutagensByStem(palace.heavenlyStem, rules.mutagenSchool);
    if (stars.length !== 4) throw new Error(`紫微${palace.name}宫干四化数据不完整。`);
    const flyingTransformations = (['禄', '权', '科', '忌'] as const).map((mutagen, index) => {
      const targets = chart.palaces.filter((item) => [...item.majorStars, ...item.minorStars].some((starItem) => starItem.name === stars[index]));
      if (targets.length !== 1) {
        throw new Error(`紫微${palace.name}化${mutagen}落宫无法确认。`);
      }
      const target = targets[0];
      return { mutagen, star: stars[index], targetIndex: target.index, targetName: target.name, targetBranch: target.earthlyBranch,
        relation: target.index === palace.index ? 'self' as const : (target.index + 6) % 12 === palace.index ? 'opposite' as const : 'other' as const };
    });
    return { index: palace.index, name: palace.name, isBodyPalace: palace.isBodyPalace, isOriginalPalace: palace.isOriginalPalace,
    heavenlyStem: palace.heavenlyStem, earthlyBranch: palace.earthlyBranch, majorStars: palace.majorStars.map(star), minorStars: palace.minorStars.map(star), adjectiveStars: palace.adjectiveStars.map(star),
    changsheng12: palace.changsheng12, boshi12: palace.boshi12, jiangqian12: palace.jiangqian12, suiqian12: palace.suiqian12, decadal: palace.decadal, ages: palace.ages, flyingTransformations };
  });
  const birthYearHeavenlyStem = chart.chineseDate?.match(/^[甲乙丙丁戊己庚辛壬癸]/)?.[0];
  const patterns = detectZiweiPatterns(palaces, birthYearHeavenlyStem);
  const natal = { solarDate: chart.solarDate, lunarDate: chart.lunarDate, chineseDate: chart.chineseDate, time: chart.time, timeRange: chart.timeRange,
    sign: chart.sign, zodiac: chart.zodiac, soulBranch: chart.earthlyBranchOfSoulPalace, bodyBranch: chart.earthlyBranchOfBodyPalace,
    soul: chart.soul, body: chart.body, fiveElementsClass: chart.fiveElementsClass, palaces, patterns };
  const reference = source.referenceTime ? (() => {
    const timestamp = Date.parse(source.referenceTime!);
    if (timestamp < resolved.utcTimestamp) throw new Error('运限参考时刻不得早于出生瞬时。');
    const offset = birth.timeZoneId ? createTimezoneOffsetReader(birth.timeZoneId)(timestamp) : resolved.timezone;
    const local = getCivilDateTimeAtFixedOffset(new Date(timestamp), offset);
    if (local.year < 1 || local.year > 2500) throw new Error('运限当地年份须在公元 1 至 2500 年。');
    const index = timeIndex(local.hour), calculationIndex = rules.dayDivide === 'current' && index === 12 ? 0 : index;
    const horoscope = buildZiweiHoroscope(chart, { year: local.year, month: local.month, day: local.day }, calculationIndex, {
      solarTermMoment: { year: local.year, month: local.month, day: local.day, hour: local.hour, minute: local.minute, second: local.second },
      birthBirthdayMonthDay: { month: wall.month, day: wall.day },
    });
    const includePalaceFlying = !!source.includeTimeline;
    const layers = Object.fromEntries(scopes.map((scope) => {
      const item = horoscope[scope];
      return [scope, { index: item.index, name: item.name, heavenlyStem: item.heavenlyStem, earthlyBranch: item.earthlyBranch, palaceNames: item.palaceNames,
        mutagen: item.mutagen, mutagenPlacements: locateScopeMutagens(palaces, item), ...(includePalaceFlying ? { palaceFlying: buildScopePalaceFlying(palaces, item.palaceNames) } : {}), ...('nominalAge' in item ? { nominalAge: item.nominalAge } : {}), ...('stars' in item && item.stars ? { stars: item.stars.map((group) => group.map(star)) } : {}) }];
    })) as Record<typeof scopes[number], { index: number; name: string; heavenlyStem: string; earthlyBranch: string; palaceNames: string[]; mutagen: string[]; mutagenPlacements: ReturnType<typeof locateScopeMutagens>; palaceFlying?: ReturnType<typeof buildScopePalaceFlying>; nominalAge?: number; stars?: Array<Array<ReturnType<typeof star>>> }>;
    const BRANCHES = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];
    const yearStemIdx = Math.max(0, HEAVENLY_STEMS.indexOf(layers.yearly.heavenlyStem as (typeof HEAVENLY_STEMS)[number]));
    const janStemIdx = ((yearStemIdx % 5) * 2 + 2) % 10;
    const birthMonth = chart.rawDates.lunarDate.lunarMonth + resolveLeapMonthOffset(chart.rawDates.lunarDate, 0, rules.leapMonthMode);
    const birthHourZhi = chart.rawDates.chineseDate.hourly[1];
    const birthHourZhiIdx = EARTHLY_BRANCHES.indexOf(birthHourZhi as (typeof EARTHLY_BRANCHES)[number]);
    const janPalaceIdx = birthHourZhiIdx >= 0
      ? (layers.yearly.index - birthMonth + birthHourZhiIdx + 1 + 24) % 12
      : (layers.monthly.index - Math.max(0, BRANCHES.indexOf(layers.monthly.earthlyBranch)) + 12) % 12;
    const monthlyTimeline = source.includeTimeline ? Array.from({ length: 12 }, (_, m) => {
      const palaceIndex = (janPalaceIdx + m) % 12;
      const stem = HEAVENLY_STEMS[(janStemIdx + m) % 10] as HeavenlyStem;
      const branch = BRANCHES[m];
      const natalPalace = palaces[palaceIndex];
      const mutagen = getMutagensByStem(stem, rules.mutagenSchool);
      const palaceNames = getPalaceNames(palaceIndex);
      return {
        lunarMonth: m + 1,
        index: palaceIndex,
        heavenlyStem: stem,
        earthlyBranch: branch,
        natalPalaceName: natalPalace.name,
        mutagen,
        mutagenPlacements: locateScopeMutagens(palaces, { name: `流月${m + 1}月`, heavenlyStem: stem, mutagen, palaceNames }),
      };
    }) : undefined;
    const decadalRange = palaces[horoscope.decadal.index]?.decadal?.range;
    const decadalStartAge = decadalRange?.[0];
    const decadalEndAge = decadalRange?.[1];
    const birthSolarYear = effectiveDate.year;
    const refNominalAge = horoscope.age.nominalAge;
    const yearlyTimeline = source.includeTimeline && typeof decadalStartAge === 'number' && typeof decadalEndAge === 'number'
      ? Array.from({ length: Math.max(0, decadalEndAge - decadalStartAge + 1) }, (_, idx) => {
          const age = decadalStartAge + idx;
          const solarYear = birthSolarYear + age - 1;
          const sampleDay = Math.min(28, wall.day);
          const sample = buildZiweiHoroscope(chart, { year: solarYear, month: wall.month, day: sampleDay }, calculationIndex, {
            birthBirthdayMonthDay: { month: wall.month, day: sampleDay },
          });
          const yr = sample.yearly;
          return {
            age,
            solarYear,
            isReferenceAge: age === refNominalAge,
            index: yr.index,
            heavenlyStem: yr.heavenlyStem,
            earthlyBranch: yr.earthlyBranch,
            ganZhi: `${yr.heavenlyStem}${yr.earthlyBranch}`,
            natalPalaceName: palaces[yr.index]?.name ?? '',
            mutagen: yr.mutagen,
          };
        })
      : undefined;
    return { utcTimestamp: timestamp, localDateTime: `${dateString(local)}T${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}:${String(local.second).padStart(2, '0')}`, timezone: offset, timeIndex: index, calculationIndex, lunarDate: horoscope.lunarDate, layers,
      ...(monthlyTimeline ? { monthlyTimeline } : {}),
      ...(yearlyTimeline ? { yearlyTimeline } : {}),
      ...(lunarDateDiscrepancy(local) ? { lunarDateWarning: lunarDateDiscrepancy(local) } : {}) };
  })() : null;
  const decadalTimeline = source.includeTimeline ? [...palaces]
    .sort((a, b) => a.decadal.range[0] - b.decadal.range[0])
    .map((palace) => ({
      index: palace.index,
      startAge: palace.decadal.range[0],
      endAge: palace.decadal.range[1],
      heavenlyStem: palace.heavenlyStem,
      earthlyBranch: palace.earthlyBranch,
      palaceName: palace.name,
      mutagens: getMutagensByStem(palace.heavenlyStem as HeavenlyStem, rules.mutagenSchool),
    })) : undefined;
  const dailyRange = source.dailyRange
    ? resolveDailyRange(source.dailyRange, source.referenceTime ? Date.parse(source.referenceTime) : undefined)
    : undefined;
  return { input: { birth, gender: source.gender, ...(source.referenceTime ? { referenceTime: source.referenceTime } : {}), ...(source.includeTimeline !== undefined ? { includeTimeline: source.includeTimeline } : {}), ...(source.dailyRange ? { dailyRange: source.dailyRange } : {}), ...(source.rules ? { rules: source.rules } : {}), ...(source.prompt ? { prompt: source.prompt } : {}) },
    basis: { utcDateTime: resolved.utcDateTime, localDateTime: resolved.localDateTime, timezone: resolved.timezone, ...('usedChinaDstCorrection' in resolved && resolved.usedChinaDstCorrection ? { usedChinaDstCorrection: true } : {}), ...(chinaDstWarning ? { chinaDstWarning } : {}), correctedLocalDateTime: `${dateString(wall)}T${String(wall.hour).padStart(2, '0')}:${String(wall.minute).padStart(2, '0')}:${String(wall.second).padStart(2, '0')}`, timeIndex: originalIndex, effectiveDate: dateString(effectiveDate), effectiveTimeIndex: effectiveIndex, trueSolarCorrection: corrected.correction ?? null, rules }, natal, reference,
    ...(decadalTimeline ? { decadalTimeline } : {}),
    ...(dailyRange ? { dailyRange } : {}),
    limitations: [
      ...(source.includeTimeline
        ? ['已开启十二大限、当前大限十年流年、流年十二流月时间线与运限十二宫逐宫飞化结构。']
        : ['默认仅展开指定参考瞬时运限四化定位；如需十二大限、十年流年与十二流月时间线，可传入 includeTimeline: true。']),
      '运限四化仅定位该层化星的本命与动态宫位，不直接证明现实事件应期。',
      rules.ageDivide === 'birthday' ? '运限年龄按公历出生日换岁（按生辰换岁口径），超过 120 岁按小限 12 岁、大限 120 岁循环续行；排盘与飞化结果按自研紫微引擎与本命宫干规则计算。' : '运限年龄使用农历自然年换岁（农历年换岁口径），超过 120 岁按小限 12 岁、大限 120 岁循环续行；排盘与飞化结果按自研紫微引擎与本命宫干规则计算。',
      rules.yearDivide === 'exact' || rules.horoscopeDivide === 'exact' ? '农历与干支历法基于统一历法引擎计算，按精确交节瞬时分界；重大边界仍建议核对出生记录。' : '农历与干支历法基于统一历法引擎计算，按农历正月初一换年换月分界。',
      ...new Set([lunarDateDiscrepancy(effectiveDate), reference?.lunarDateWarning, chinaDstWarning].filter((item): item is string => !!item))], };
}
export type ZiweiExactData = Awaited<ReturnType<typeof calculateExactData>>;
type ExactData = ZiweiExactData;
export async function calculateZiweiIndependentData(source: Source) {
  if (source.birth.clock.kind === 'exact') return calculateExactData(source);
  const { ziweiBirthSegments } = await import('./ziwei-birth-range');
  const range = await ziweiBirthSegments(source.birth);
  if (source.referenceTime && Date.parse(source.referenceTime) < range.segments.at(-1)!.endTimestamp - 1000) throw new Error('运限参考时刻不得早于任一出生候选瞬时。');
  const { clock: _clock, calendar: _calendar, leapMonth: _leapMonth, ...base } = source.birth;
  const candidates = [];
  for (const segment of range.segments) {
    const local = segment.localStart;
    const birth = { ...base, year: local.year, month: local.month, day: local.day, calendar: 'solar' as const, timezone: segment.timezone,
      clock: { kind: 'exact' as const, hour: local.hour, minute: local.minute, second: local.second } };
    const chart = await calculateExactData({ ...source, birth, prompt: undefined });
    candidates.push({ ...segment, chart });
  }
  const possible = {
    soulBranch: [...new Set(candidates.map((item) => item.chart.natal.soulBranch))],
    bodyBranch: [...new Set(candidates.map((item) => item.chart.natal.bodyBranch))],
    fiveElementsClass: [...new Set(candidates.map((item) => item.chart.natal.fiveElementsClass))],
  };
  return { input: { birth: source.birth, gender: source.gender, ...(source.referenceTime ? { referenceTime: source.referenceTime } : {}), ...(source.includeTimeline !== undefined ? { includeTimeline: source.includeTimeline } : {}), ...(source.dailyRange ? { dailyRange: source.dailyRange } : {}), ...(source.rules ? { rules: source.rules } : {}), ...(source.prompt ? { prompt: source.prompt } : {}) },
    unknown: { source: range.source, possible, candidates, limitation: '每段首秒为计算样本，不能视为确定出生瞬时；全部候选应结合出生记录核定。' } };
}
const BEIJING_OFFSET_MS = 8 * 3_600_000;
const BASE_DAY_UTC = Date.UTC(2000, 0, 1); // 2000-01-01 = 戊午 (index 54)

function getGregorianDayGanZhi(year: number, month: number, day: number): string {
  const diffDays = Math.round((Date.UTC(year, month - 1, day) - BASE_DAY_UTC) / 86_400_000);
  return getSixtyCycleName(54 + diffDays);
}

function getGregorianMidMonthGanZhi(year: number, month: number): string {
  return month === 1 ? getYearMonthGanZhi(year - 1, 11) : getYearMonthGanZhi(year, month - 2);
}

function buildCompactZiweiFortuneBlock(data: ExactData, question: string, includeDecadal: boolean): string {
  const palaces = data.natal.palaces;
  if (!palaces.length || !palaces.every((p) => Array.isArray(p.decadal?.range) && p.decadal.range.length === 2)) {
    return '';
  }
  const refTs = data.reference ? data.reference.utcTimestamp : Date.now();
  const parsedRefYear = data.reference ? Number(data.reference.localDateTime.slice(0, 4)) : NaN;
  const rawRefYear = Number.isInteger(parsedRefYear) && parsedRefYear >= 1900 && parsedRefYear <= 2100
    ? parsedRefYear
    : new Date(refTs + BEIJING_OFFSET_MS).getUTCFullYear();
  const refYearlyGz = data.reference ? `${data.reference.layers.yearly.heavenlyStem}${data.reference.layers.yearly.earthlyBranch}` : '';
  const refYear = refYearlyGz && getYearSixtyCycle(rawRefYear) !== refYearlyGz && getYearSixtyCycle(rawRefYear - 1) === refYearlyGz
    ? rawRefYear - 1
    : rawRefYear;
  const birthYear = Number(data.basis.effectiveDate.slice(0, 4));
  const currentNominalAge = typeof data.reference?.layers.age.nominalAge === 'number'
    ? data.reference.layers.age.nominalAge
    : Number.isFinite(birthYear)
      ? refYear - birthYear + 1
      : NaN;

  const lines: string[] = [];
  if (includeDecadal) {
    const decadalLine = [...palaces]
      .sort((a, b) => a.decadal.range[0] - b.decadal.range[0])
      .slice(0, 8)
      .map((p) => {
        const [start, end] = p.decadal.range;
        const isCurrent = Number.isFinite(currentNominalAge) && currentNominalAge >= start && currentNominalAge <= end;
        return `${p.name}${p.heavenlyStem}${p.earthlyBranch}(${start}-${end}${isCurrent ? '·当前' : ''})`;
      })
      .join('｜');
    lines.push(`大限：${decadalLine}`);
  }

  const fortuneScope = inferFortuneScope(question, refYear, refTs, Number.isFinite(birthYear) ? birthYear : undefined);
  const yearlyLine = fortuneScope.years.map((year) => {
    const ganZhi = getYearSixtyCycle(year);
    const stem = ganZhi[0] as HeavenlyStem;
    const branch = ganZhi[1];
    const targetPalace = palaces.find((p) => p.earthlyBranch === branch);
    const mutagens = getMutagensByStem(stem, data.basis.rules.mutagenSchool);
    const lu = mutagens[0] ?? '';
    const ji = mutagens[3] ?? '';
    const sihua = lu && ji ? `·禄${lu}/忌${ji}` : '';
    const palacePart = targetPalace ? `落${targetPalace.name}${branch}` : `落${branch}宫`;
    return `${year}${ganZhi}(${palacePart}${sihua})`;
  }).join('｜');
  lines.push(`流年：${yearlyLine}`);

  const subParts: string[] = [];
  if (fortuneScope.months.length > 0) {
    subParts.push(
      `参考流月：${fortuneScope.months.map((m) => `${m.year}/${m.month}月${getGregorianMidMonthGanZhi(m.year, m.month)}`).join('｜')}`,
    );
  }
  if (fortuneScope.dates.length > 0) {
    const dayTokens = fortuneScope.dates.map((d) => `${d.month}/${d.day}${getGregorianDayGanZhi(d.year, d.month, d.day)}`);
    if (dayTokens.length > 8) {
      if (subParts.length > 0) {
        lines.push(subParts.join('；'));
        subParts.length = 0;
      }
      const rows: string[] = [];
      for (let i = 0; i < dayTokens.length; i += 8) {
        rows.push(dayTokens.slice(i, i + 8).join('｜'));
      }
      lines.push(`参考流日（共${dayTokens.length}天）：\n${rows.join('\n')}`);
    } else {
      subParts.push(`参考流日：${dayTokens.join('｜')}`);
    }
  }
  if (subParts.length > 0) {
    lines.push(subParts.join('；'));
  }

  return `【运限动态与流年四化（压平精要）】\n${lines.join('\n')}`;
}

type Data = Awaited<ReturnType<typeof calculateZiweiIndependentData>>;
function renderExact(data: ExactData, question: string, options?: Options) {
  const scope = options?.scope ?? (data.reference ? 'full' : 'origin');
  if (scope !== 'origin' && !data.reference) throw new Error('选择运限层级必须提供参考时刻。');
  const selected = scope === 'origin' ? [] : scope === 'full' ? scopes : [scope];
  const palaces = data.natal.palaces;
  const palaceText = palaces.map((p) => {
    const opposite = palaces[(p.index + 6) % 12];
    const majorStr = p.majorStars.length
      ? p.majorStars.map((s) => formatZiweiStarLabel(s)).join('、')
      : `无（空宫，借对宫${opposite.name}${opposite.earthlyBranch}：${opposite.majorStars.map((s) => formatZiweiStarLabel(s)).join('、') || '无主星'}）`;
    const rings = [p.changsheng12 ? `长生${p.changsheng12}` : '', p.boshi12 ? `博士${p.boshi12}` : '', p.suiqian12 ? `岁前${p.suiqian12}` : '', p.jiangqian12 ? `将前${p.jiangqian12}` : ''].filter(Boolean).join('、');
    return `${p.name}（${p.heavenlyStem}${p.earthlyBranch}${p.isBodyPalace ? '，身宫' : ''}）：主星${majorStr}；辅星${p.minorStars.map((s) => `${s.name}${s.mutagen ? `·化${s.mutagen}` : ''}`).join('、') || '无'}；杂曜${p.adjectiveStars.map((s) => s.name).join('、') || '无'}${rings ? `；四圈［${rings}］` : ''}；大限${p.decadal.range.join('–')}岁`;
  }).join('\n');
  const mingPalace = palaces.find((p) => p.name === '命宫')!;
  const sanFangIndices = [mingPalace.index, (mingPalace.index + 4) % 12, (mingPalace.index + 8) % 12, (mingPalace.index + 6) % 12];
  const sanFangSummary = sanFangIndices.map((idx) => {
    const p = palaces[idx];
    const opp = palaces[(idx + 6) % 12];
    const majors = p.majorStars.length ? p.majorStars : opp.majorStars;
    const tag = p.majorStars.length ? '' : '（借对宫）';
    return `${p.name}${p.earthlyBranch}${tag}［${majors.map((s) => formatZiweiStarLabel(s)).join('、') || '无'}］`;
  }).join(' + ');
  const flyingText = formatNatalFlying(data.natal.palaces);
  const feixingHighlights = options?.schools?.includes('feixing') ? formatFeixingHighlights(data.natal.palaces) : '';
  const flowText = selected.map((key) => { const layer = data.reference!.layers[key];
    return `${scopeLabels[key]}：${layer.heavenlyStem}${layer.earthlyBranch}，宫位索引${layer.index}${layer.nominalAge === undefined ? '' : `，虚岁${layer.nominalAge}`}；四化禄权科忌依序为${layer.mutagen.join('、')}；${formatScopeMutagens(layer.mutagenPlacements)}；十二宫序${layer.palaceNames.join('、')}；流曜${layer.stars?.map((stars, index) => stars.length ? `${data.natal.palaces[index].earthlyBranch}宫${stars.map((s) => s.name).join('、')}` : '').filter(Boolean).join('；') || '未列'}。`;
  }).join('\n');
  const threeTierOverlayText = data.reference?.layers
    ? formatThreeTierMutagenOverlay(
        buildThreeTierMutagenOverlay(
          data.natal.palaces,
          selected.includes('decadal') ? data.reference.layers.decadal.mutagenPlacements : undefined,
          selected.includes('yearly') ? data.reference.layers.yearly.mutagenPlacements : undefined,
        ),
      )
    : '';
  const flyingByScope = options?.schools?.includes('feixing') ? selected.map((key) => {
    const layer = data.reference!.layers[key];
    const keyCollisions = formatScopeFlyingHighlights(data.natal.palaces, scopeLabels[key], layer.palaceNames);
    return `【${scopeLabels[key]}宫名对应的本命宫干飞化】\n${scopeLabels[key]}重点引动（三方命财官迁→本命重点宫禄忌）：${keyCollisions}\n${formatScopeFlying(data.natal.palaces, layer.palaceNames)}`;
  }).join('\n\n') : '';
  const timelineText = [
    data.decadalTimeline
      ? `【十二大限】\n${data.decadalTimeline.map((step) => `${step.startAge}–${step.endAge}岁：${step.palaceName}（${step.heavenlyStem}${step.earthlyBranch}，宫位索引${step.index}），四化禄权科忌依序为${step.mutagens.join('、')}`).join('\n')}`
      : '',
    data.reference?.yearlyTimeline
      ? `【当前大限十年流年时间线】\n${data.reference.yearlyTimeline.map((y) => `${y.solarYear}年（虚岁${y.age}${y.isReferenceAge ? '，当前' : ''}）${y.ganZhi}：流年命宫叠本命${y.natalPalaceName}（索引${y.index}），四化${y.mutagen.join('、')}`).join('\n')}`
      : '',
    data.reference?.monthlyTimeline
      ? `【流年十二流月时间线】\n${data.reference.monthlyTimeline.map((m) => `农历${m.lunarMonth}月（${m.heavenlyStem}${m.earthlyBranch}）：流月命宫叠本命${m.natalPalaceName}（索引${m.index}）；${formatScopeMutagens(m.mutagenPlacements)}`).join('\n')}`
      : '',
  ].filter(Boolean).join('\n\n');
  const topic = options?.topic ?? 'life';
  const genderLabel = data.input.gender === 'male' ? '男' : data.input.gender === 'female' ? '女' : '';
  const digestLines = buildMethodSituationDigest('ziwei', data, question);
  const structureHighlights = buildZiweiStructureHighlights(data.natal.palaces);
  const text = [`【紫微斗数】\n${genderLabel ? `性别：${genderLabel}；` : ''}出生瞬时 ${data.basis.utcDateTime}，出生地钟表 ${data.basis.localDateTime}，排盘钟表 ${data.basis.correctedLocalDateTime}；安星日 ${data.basis.effectiveDate}、时辰索引 ${data.basis.effectiveTimeIndex}。\n命宫${data.natal.soulBranch}，身宫${data.natal.bodyBranch}，命主${data.natal.soul}，身主${data.natal.body}，${data.natal.fiveElementsClass}；${data.natal.chineseDate}。\n命宫三方四正（命/财/官/迁）：${sanFangSummary}。`,
    digestLines.length ? `【局势要点】\n${digestLines.join('\n')}` : '',
    `【计算口径】\n${formatZiweiRulesSummary(data.basis.rules)}。`,
    `【本命十二宫】\n${palaceText}`, `【本命宫干四化】\n${flyingText}`,
    structureHighlights ? `【空宫借星、夹宫与核心自化核验】\n${structureHighlights}` : '',
    feixingHighlights ? `【飞星关键脉络（离心自化/对宫/集禄集忌）】\n${feixingHighlights}` : '',
    `【本命格局】\n${formatZiweiPatterns(data.natal.patterns)}`,
    `【格局叠合与成败制衡关系】\n${formatZiweiPatternRelations(data.natal.palaces, data.natal.patterns)}`,
    buildCompactZiweiFortuneBlock(data, question, scope === 'origin' || scope === 'full' || scope === 'decadal'),
    data.dailyRange ? formatZiweiDailyRangeBlock(data.dailyRange, data.natal.palaces) : '',
    timelineText, flowText ? `【运限】\n参考当地 ${data.reference!.localDateTime}（UTC${data.reference!.timezone >= 0 ? '+' : ''}${data.reference!.timezone}）；${flowText}` : '',
    threeTierOverlayText ? `【三代四化叠宫引动（本命×大限×流年）】\n${threeTierOverlayText}` : '',
    flyingByScope ? `【运限宫名映射说明】\n以下将本命物理宫的宫干四化按所选运限宫名重新标注；沿用本命宫干及本命化星，未另起运限宫干，也不计算流曜或跨层飞化。\n\n${flyingByScope}` : '',
    `【主题】\n${topicLabels[topic]}；优先核对${topicFocus[topic]}。根据盘中列出的实际宫位和星曜回答，列出依据、不同解释及需要现实核验的条件，不虚构未计算的格局或飞化。`,
    formatSchoolAlgorithmSection(evaluateZiweiSchoolAlgorithms(data, options?.schools)),
    options?.schools?.length ? `【解读口径】\n${options.schools.map((school) => schoolTasks[school]).join('\n')}` : '',
    options?.includeClassics ? formatClassicExcerpts(selectZiweiClassics(collectZiweiMajorStars(data.natal.palaces)), '典籍片段') : '',
    `【限制】\n${data.limitations.join('\n')}`, `【问题】\n${question}`].filter(Boolean).join('\n\n');
  return { text };
}
function render(data: Data, question: string, options?: Options) {
  if (!('unknown' in data)) {
    if (options?.candidateIndex !== undefined) throw new Error('精确出生不接受候选索引。');
    return renderExact(data, question, options);
  }
  const { unknown } = data, selected = options?.candidateIndex;
  if (selected !== undefined) {
    const candidate = unknown.candidates[selected];
    if (!candidate) throw new Error('紫微出生候选索引超出范围。');
    const details = renderExact(candidate.chart, question, options);
    const text = `【出生候选 ${selected}】\n范围 UTC ${new Date(candidate.startTimestamp).toISOString()} 至 ${new Date(candidate.endTimestamp).toISOString()}（终点不含）。以下出生时刻是该候选首秒的计算样本，不是已核实的出生瞬时。\n\n${details.text}`;
    return { text };
  }
  const scope = options?.scope ?? (data.input.referenceTime ? 'full' : 'origin');
  if (scope !== 'origin' && !data.input.referenceTime) throw new Error('选择运限层级必须提供参考时刻。');
  const levels = scope === 'origin' ? [] : scope === 'full' ? scopes : [scope];
  const rows = unknown.candidates.map((candidate, index) => {
    const chart = candidate.chart, natal = chart.natal;
    const palaces = natal.palaces.map((p) => `${p.name}${p.earthlyBranch}：${p.majorStars.map((star) => `${star.name}${star.mutagen ? `化${star.mutagen}` : ''}`).join('、') || '无主星'}`).join('；');
    const flows = levels.map((level) => { const item = chart.reference!.layers[level]; return `${scopeLabels[level]}${item.heavenlyStem}${item.earthlyBranch}，${natal.palaces[item.index]?.name ?? `第${item.index + 1}宫`}，${formatScopeMutagens(item.mutagenPlacements)}`; }).join('；');
    return `候选 ${index}：UTC ${new Date(candidate.startTimestamp).toISOString()} 至 ${new Date(candidate.endTimestamp).toISOString()}（不含终点），当地 UTC${candidate.timezone >= 0 ? '+' : ''}${candidate.timezone}；命宫${natal.soulBranch}、身宫${natal.bodyBranch}、${natal.fiveElementsClass}。\n${palaces}${flows ? `\n运限：${flows}` : ''}`;
  });
  const topic = options?.topic ?? 'life', schoolText = options?.schools?.map((school) => schoolTasks[school]).join('\n');
  const rules = unknown.candidates[0].chart.basis.rules;
  const genderLabel = data.input.gender === 'male' ? '男' : data.input.gender === 'female' ? '女' : '';
  const text = [`【紫微出生时段候选】\n${genderLabel ? `性别：${genderLabel}；` : ''}当地日 ${unknown.source.solarDate}；${unknown.source.shichen ? `指定民用时辰索引 ${unknown.source.shichen.index}（${unknown.source.shichen.startHour}:00 至 ${unknown.source.shichen.endHour}:00，不含终点）` : '出生时辰未知'}；${'timeZoneId' in unknown.source ? `时区 ${unknown.source.timeZoneId}` : `时区 UTC${unknown.source.timezone}`}；${'requiredTimezone' in unknown.source ? `只保留 UTC${unknown.source.requiredTimezone}；` : ''}排除 ${unknown.source.excludedSeconds} 秒；共 ${unknown.candidates.length} 个连续候选。${unknown.limitation}`,
    `【计算口径】\n${formatZiweiRulesSummary(rules)}；${data.input.birth.timeStandard === 'true-solar' ? `按经度 ${data.input.birth.longitude}° 校正真太阳时` : '采用当地民用时间'}。`,
    `【候选取值】\n命宫：${unknown.possible.soulBranch.join('、')}；身宫：${unknown.possible.bodyBranch.join('、')}；五行局：${unknown.possible.fiveElementsClass.join('、')}。`,
    `【候选盘】\n${rows.join('\n\n')}\n主星以外的完整星曜与各层运限见结构化结果；可按 candidateIndex 选择一个候选生成详细提示词。`,
    `【主题】\n${topicLabels[topic]}；优先核对${topicFocus[topic]}。分别指出各候选的共同点、差异和现实核验条件，不把任一候选当作已确定命盘。`,
    schoolText ? `【解读口径】\n${schoolText}${options?.schools?.includes('feixing') && levels.length ? '\n各候选的运限宫名与本命宫干飞化映射未在比较摘要展开；可通过 candidateIndex 选择候选查看。' : ''}` : '',
    options?.includeClassics ? formatClassicExcerpts(dedupeExcerpts(unknown.candidates.flatMap((candidate) => selectZiweiClassics(collectZiweiMajorStars(candidate.chart.natal.palaces)))), '典籍片段') : '',
    `【限制】\n${[...new Set(unknown.candidates.flatMap((candidate) => candidate.chart.limitations))].join('\n')}`, `【问题】\n${question}`].filter(Boolean).join('\n\n');
  return { text };
}
export async function ziweiIndependent(input: Input) {
  const data = await calculateZiweiIndependentData(input);
  const lines = 'unknown' in data ? [`候选时段：${data.unknown.candidates.length}`, `命宫候选：${data.unknown.possible.soulBranch.join('、')}`] : [`命宫：${data.natal.soulBranch}`, `身宫：${data.natal.bodyBranch}`, data.natal.fiveElementsClass];
  return { data, summary: { title: '紫微斗数', lines }, prompt: render(data, input.question, input.prompt) };
}
export async function promptForSavedZiweiIndependent(data: unknown, source: Source, question: string, options?: Options) {
  const expected = await calculateZiweiIndependentData(source);
  if (!sameJsonValue(data, expected)) throw new Error('紫微盘面与出生资料或运限时刻不一致。');
  return render(expected, question, options ?? source.prompt);
}
