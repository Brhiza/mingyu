import { resolveZiweiRules } from '../defaults';
import {
  BRANCH_META,
  CHINESE_TIME,
  EARTHLY_BRANCHES,
  HEAVENLY_STEMS,
  TIGER_RULE,
  TIME_RANGE,
  ZODIAC_BY_BRANCH,
} from './constants';
import {
  earthlyBranchToPalaceIndex,
  fixIndex,
  formatSolarDate,
  getSolarSign,
  getStemBranchSet,
  parseSolarDate,
  resolveLeapMonthOffset,
  solarToLunarInfo,
  type SimpleClockTime,
  type SimpleSolarDate,
} from './calendar';
import {
  getAdjectiveStars,
  getBoshi12,
  getChangsheng12,
  getFiveElementsClass,
  getHoroscopeStars,
  getMajorStarStartIndices,
  getMajorStars,
  getMinorStars,
  getMutagensByStem,
  getPalaceNames,
  getSoulAndBody,
  getYearly12,
} from './stars';
import type {
  EarthlyBranch,
  GenderLabel,
  ZiweiAstrolabe,
  ZiweiEngineRules,
  ZiweiHoroscope,
  ZiweiPalaceRaw,
} from './types';

export interface BuildZiweiAstrolabeInput {
  solarDate: SimpleSolarDate | string;
  timeIndex: number;
  gender: 'male' | 'female' | 'neutral' | GenderLabel;
  rules?: Partial<ZiweiEngineRules>;
  /** 可选精确时刻（用于 yearDivide / horoscopeDivide 为 exact 时按真实交节瞬时判定）。 */
  solarTermMoment?: SimpleSolarDate & SimpleClockTime;
}

export interface BuildZiweiHoroscopeOptions {
  /** 可选精确参考时刻（用于 horoscopeDivide 为 exact 时按真实交节瞬时判定）。 */
  solarTermMoment?: SimpleSolarDate & SimpleClockTime;
  /** 公历出生月日（用于 ageDivide === 'birthday' 按公历出生日换岁）。 */
  birthBirthdayMonthDay?: { month: number; day: number };
}

export function normalizeZiweiRules(rules?: Partial<ZiweiEngineRules>): ZiweiEngineRules {
  return resolveZiweiRules(rules);
}

function normalizeGender(gender: 'male' | 'female' | 'neutral' | GenderLabel): GenderLabel {
  if (gender === 'male' || gender === '男') return '男';
  if (gender === 'female' || gender === '女') return '女';
  return '中性';
}

function getAgeStartIndex(yearBranch: EarthlyBranch): number {
  switch (yearBranch) {
    case '寅':
    case '午':
    case '戌':
      return earthlyBranchToPalaceIndex('辰');
    case '申':
    case '子':
    case '辰':
      return earthlyBranchToPalaceIndex('戌');
    case '巳':
    case '酉':
    case '丑':
      return earthlyBranchToPalaceIndex('未');
    case '亥':
    case '卯':
    case '未':
      return earthlyBranchToPalaceIndex('丑');
  }
}

export function buildZiweiAstrolabe(input: BuildZiweiAstrolabeInput): ZiweiAstrolabe {
  const date = typeof input.solarDate === 'string' ? parseSolarDate(input.solarDate) : input.solarDate;
  const solarDateStr = formatSolarDate(date);
  const rules = normalizeZiweiRules(input.rules);
  const gender = normalizeGender(input.gender);
  const rawTimeIndex = Math.max(0, Math.min(12, Math.trunc(input.timeIndex)));
  const effectiveTimeIndex = rules.dayDivide === 'current' && rawTimeIndex >= 12 ? 0 : rawTimeIndex;

  const natalPillars = getStemBranchSet(date, effectiveTimeIndex, {
    yearDivide: rules.yearDivide,
    monthDivide: rules.horoscopeDivide,
    leapMonthMode: rules.leapMonthMode,
    solarTermMoment: input.solarTermMoment,
  });
  const horoscopeYearPillars = rules.horoscopeDivide === rules.yearDivide
    ? natalPillars
    : getStemBranchSet(date, effectiveTimeIndex, {
        yearDivide: rules.horoscopeDivide,
        monthDivide: rules.horoscopeDivide,
        leapMonthMode: rules.leapMonthMode,
        solarTermMoment: input.solarTermMoment,
      });

  const lunarDateParts = solarToLunarInfo(date);
  const yearStem = natalPillars.yearly[0];
  const yearBranch = natalPillars.yearly[1];
  const hourBranch = natalPillars.hourly[1];

  const baseSoulAndBody = getSoulAndBody({
    solarDate: date,
    timeIndex: effectiveTimeIndex,
    leapMonthMode: rules.leapMonthMode,
    yearStem,
    hourBranch,
  });

  const activeSoulIndex = rules.plateType === 'earth'
    ? baseSoulAndBody.bodyIndex
    : rules.plateType === 'human'
      ? fixIndex(baseSoulAndBody.soulIndex + 2)
      : baseSoulAndBody.soulIndex;
  const tigerStartStemIdx = HEAVENLY_STEMS.indexOf(TIGER_RULE[yearStem]);
  const activeSoulStem = HEAVENLY_STEMS[fixIndex(tigerStartStemIdx + activeSoulIndex, 10)];
  const activeSoulBranch = EARTHLY_BRANCHES[fixIndex(activeSoulIndex + 2)];

  const fiveElementsClass = getFiveElementsClass(activeSoulStem, activeSoulBranch);
  const palaceNames = getPalaceNames(activeSoulIndex);
  const { ziweiIndex, tianfuIndex } = getMajorStarStartIndices({
    solarDate: date,
    timeIndex: effectiveTimeIndex,
    dayDivide: rules.dayDivide,
    fiveElementsClass,
  });

  const majorStars = getMajorStars({
    ziweiIndex,
    tianfuIndex,
    yearStem,
    mutagenSchool: rules.mutagenSchool,
  });
  const minorStars = getMinorStars({
    solarDate: date,
    timeIndex: effectiveTimeIndex,
    leapMonthMode: rules.leapMonthMode,
    yearStem,
    yearBranch,
    mutagenSchool: rules.mutagenSchool,
    tianmaMode: rules.tianmaMode,
  });
  const yearly12 = getYearly12(horoscopeYearPillars.yearly[1], rules.algorithm);
  const adjectiveStars = getAdjectiveStars({
    solarDate: date,
    timeIndex: effectiveTimeIndex,
    leapMonthMode: rules.leapMonthMode,
    gender,
    algorithm: rules.algorithm,
    soulIndex: activeSoulIndex,
    bodyIndex: baseSoulAndBody.bodyIndex,
    natalYearBranch: yearBranch,
    horoscopeYearStem: horoscopeYearPillars.yearly[0],
    horoscopeYearBranch: horoscopeYearPillars.yearly[1],
    suiqian12: yearly12.suiqian12,
  });

  const isNeutral = gender === '中性';
  const changsheng12 = isNeutral ? Array(12).fill('') : getChangsheng12({ fiveElementsClass, gender, yearBranch });
  const boshi12 = isNeutral ? Array(12).fill('') : getBoshi12({ yearStem, yearBranch, gender });

  const decadals: Array<ZiweiPalaceRaw['decadal']> = Array.from({ length: 12 }, (_, idx) => ({
    range: [0, 0],
    heavenlyStem: HEAVENLY_STEMS[fixIndex(tigerStartStemIdx + idx, 10)],
    earthlyBranch: EARTHLY_BRANCHES[fixIndex(2 + idx)],
  }));
  const ages: number[][] = Array.from({ length: 12 }, () => []);

  if (!isNeutral) {
    const classNumber = { 水二局: 2, 木三局: 3, 金四局: 4, 土五局: 5, 火六局: 6 }[fiveElementsClass];
    const genderYinYang = gender === '男' ? '阳' : '阴';
    const sameYinYang = genderYinYang === BRANCH_META[yearBranch].yinYang;

    for (let i = 0; i < 12; i++) {
      const idx = sameYinYang ? fixIndex(activeSoulIndex + i) : fixIndex(activeSoulIndex - i);
      const start = classNumber + 10 * i;
      const stemIdx = fixIndex(tigerStartStemIdx + idx, 10);
      const branchIdx = fixIndex(2 + idx);
      decadals[idx] = {
        range: [start, start + 9],
        heavenlyStem: HEAVENLY_STEMS[stemIdx],
        earthlyBranch: EARTHLY_BRANCHES[branchIdx],
      };
    }

    const ageStartIdx = getAgeStartIndex(yearBranch);
    for (let i = 0; i < 12; i++) {
      const ageList = Array.from({ length: 10 }, (_, j) => 12 * j + i + 1);
      const idx = gender === '男' ? fixIndex(ageStartIdx + i) : fixIndex(ageStartIdx - i);
      ages[idx] = ageList;
    }
  }

  const omittedGenderStars: Array<{ palace: string; stars: string[] }> = [];
  if (isNeutral && rules.algorithm === 'zhongzhou') {
    omittedGenderStars.push(
      { palace: palaceNames[fixIndex(5 + activeSoulIndex)], stars: ['天伤'] },
      { palace: palaceNames[fixIndex(7 + activeSoulIndex)], stars: ['天使'] },
    );
  }

  const palaces: ZiweiPalaceRaw[] = Array.from({ length: 12 }, (_, i) => {
    const heavenlyStem = HEAVENLY_STEMS[fixIndex(tigerStartStemIdx + i, 10)];
    const earthlyBranch = EARTHLY_BRANCHES[fixIndex(2 + i)];
    return {
      index: i,
      name: palaceNames[i],
      isBodyPalace: baseSoulAndBody.bodyIndex === i,
      isOriginalPalace: earthlyBranch !== '子' && earthlyBranch !== '丑' && heavenlyStem === yearStem,
      heavenlyStem,
      earthlyBranch,
      majorStars: majorStars[i],
      minorStars: minorStars[i],
      adjectiveStars: adjectiveStars[i],
      changsheng12: changsheng12[i],
      boshi12: boshi12[i],
      jiangqian12: yearly12.jiangqian12[i],
      suiqian12: yearly12.suiqian12[i],
      decadal: decadals[i],
      ages: ages[i],
    };
  });

  const soul = rules.algorithm === 'zhongzhou'
    ? BRANCH_META[yearBranch].soul
    : BRANCH_META[activeSoulBranch].soul;

  return {
    gender,
    solarDate: solarDateStr,
    lunarDate: lunarDateParts.toString(true),
    chineseDate: `${natalPillars.yearly.join('')} ${natalPillars.monthly.join('')} ${natalPillars.daily.join('')} ${natalPillars.hourly.join('')}`,
    rawDates: {
      lunarDate: lunarDateParts,
      chineseDate: natalPillars,
    },
    time: CHINESE_TIME[rawTimeIndex],
    timeRange: TIME_RANGE[rawTimeIndex],
    sign: getSolarSign(date),
    zodiac: ZODIAC_BY_BRANCH[yearBranch],
    earthlyBranchOfSoulPalace: activeSoulBranch,
    earthlyBranchOfBodyPalace: EARTHLY_BRANCHES[fixIndex(baseSoulAndBody.bodyIndex + 2)],
    soul,
    body: BRANCH_META[yearBranch].body,
    fiveElementsClass,
    palaces,
    rules,
    ...(omittedGenderStars.length ? { omittedGenderStars } : {}),
  };
}

export function buildZiweiHoroscope(
  astrolabe: ZiweiAstrolabe,
  targetSolarDate: SimpleSolarDate | string,
  targetTimeIndex: number,
  options?: BuildZiweiHoroscopeOptions,
): ZiweiHoroscope {
  const date = typeof targetSolarDate === 'string' ? parseSolarDate(targetSolarDate) : targetSolarDate;
  const solarDateStr = formatSolarDate(date);
  const timeIdx = Math.max(0, Math.min(12, Math.trunc(targetTimeIndex)));
  const birthLunar = astrolabe.rawDates.lunarDate;
  const targetLunar = solarToLunarInfo(date);

  if (astrolabe.gender === '中性') {
    throw new Error('中性无性别盘不计算大限、小限及个人运限。');
  }
  const pillars = getStemBranchSet(date, timeIdx, {
    yearDivide: astrolabe.rules.horoscopeDivide,
    monthDivide: astrolabe.rules.horoscopeDivide,
    leapMonthMode: astrolabe.rules.leapMonthMode,
    solarTermMoment: options?.solarTermMoment,
  });

  let nominalAge = targetLunar.lunarYear - birthLunar.lunarYear + 1;
  if (astrolabe.rules.ageDivide === 'birthday') {
    const birthday = options?.birthBirthdayMonthDay ?? parseSolarDate(astrolabe.solarDate);
    if (date.month < birthday.month || (date.month === birthday.month && date.day < birthday.day)) {
      nominalAge -= 1;
    }
  }
  if (nominalAge < 1) {
    throw new Error('独立紫微预览仅支持 1 岁及以上的有效运限。');
  }

  // 小限每 12 岁同宫
  const ageInFirstCycle = ((nominalAge - 1) % 12) + 1;
  const agePalace = astrolabe.palaces.find((palace) => palace.ages.includes(ageInFirstCycle));

  // 大限起限前按童限；起限后每 10 年一宫、120 年循环续行
  const decadalStartAge = Math.min(...astrolabe.palaces.map((palace) => palace.decadal.range[0]));
  const ageInDecadalCycle = nominalAge < decadalStartAge
    ? nominalAge
    : decadalStartAge + ((nominalAge - decadalStartAge) % 120);
  const regularDecadalPalace = astrolabe.palaces.find(
    (palace) => ageInDecadalCycle >= palace.decadal.range[0] && ageInDecadalCycle <= palace.decadal.range[1],
  );
  const childhoodPalaceName = ['命宫', '财帛', '疾厄', '夫妻', '福德', '官禄'][nominalAge - 1];
  const childhoodPalace = childhoodPalaceName
    ? astrolabe.palaces.find((palace) => palace.name === childhoodPalaceName)
    : undefined;
  const decadalPalace = regularDecadalPalace ?? childhoodPalace;
  if (!agePalace || !decadalPalace) {
    throw new Error('独立紫微预览无法定位运限宫位。');
  }
  const isChildhood = !regularDecadalPalace && !!childhoodPalace;

  const yearlyIndex = earthlyBranchToPalaceIndex(pillars.yearly[1]);
  const birthLeapAddition = resolveLeapMonthOffset(
    birthLunar,
    0,
    astrolabe.rules.leapMonthMode,
  );
  const targetLeapAddition = resolveLeapMonthOffset(
    targetLunar,
    timeIdx,
    astrolabe.rules.leapMonthMode,
  );
  const birthHourBranchIdx = EARTHLY_BRANCHES.indexOf(astrolabe.rawDates.chineseDate.hourly[1]);
  const monthlyIndex = fixIndex(
    yearlyIndex - (birthLunar.lunarMonth + birthLeapAddition) + birthHourBranchIdx + (targetLunar.lunarMonth + targetLeapAddition),
  );
  const dailyIndex = fixIndex(monthlyIndex + targetLunar.lunarDay - 1);
  const hourlyIndex = fixIndex(dailyIndex + EARTHLY_BRANCHES.indexOf(pillars.hourly[1]));

  const buildLayer = (
    index: number,
    name: string,
    stem: ZiweiAstrolabe['palaces'][number]['heavenlyStem'],
    branch: ZiweiAstrolabe['palaces'][number]['earthlyBranch'],
    scope?: 'decadal' | 'yearly' | 'monthly' | 'daily' | 'hourly',
  ) => ({
    index,
    name,
    heavenlyStem: stem,
    earthlyBranch: branch,
    palaceNames: getPalaceNames(index),
    mutagen: getMutagensByStem(stem, astrolabe.rules.mutagenSchool),
    ...(scope ? { stars: getHoroscopeStars(stem, branch, scope) } : {}),
  });

  return {
    solarDate: solarDateStr,
    lunarDate: targetLunar.toString(true),
    decadal: buildLayer(
      decadalPalace.index,
      isChildhood ? '童限' : '大限',
      decadalPalace.heavenlyStem,
      decadalPalace.earthlyBranch,
      'decadal',
    ),
    age: {
      ...buildLayer(agePalace.index, '小限', agePalace.heavenlyStem, agePalace.earthlyBranch),
      nominalAge,
    },
    yearly: {
      ...buildLayer(yearlyIndex, '流年', pillars.yearly[0], pillars.yearly[1], 'yearly'),
      yearlyDecStar: getYearly12(pillars.yearly[1], astrolabe.rules.algorithm),
    },
    monthly: buildLayer(monthlyIndex, '流月', pillars.monthly[0], pillars.monthly[1], 'monthly'),
    daily: buildLayer(dailyIndex, '流日', pillars.daily[0], pillars.daily[1], 'daily'),
    hourly: buildLayer(hourlyIndex, '流时', pillars.hourly[0], pillars.hourly[1], 'hourly'),
  };
}
