import {
  BOSHI_12_STARS,
  BRANCH_META,
  CHANGSHENG_12_STARS,
  EARTHLY_BRANCHES,
  FIVE_ELEMENTS_CLASS_BY_SUM,
  FIVE_ELEMENTS_CLASS_VALUE,
  HEAVENLY_STEMS,
  HOROSCOPE_STAR_META,
  JIANGQIAN_12_STARS,
  MUTAGEN_LABELS,
  PALACE_NAMES,
  STAR_BRIGHTNESS,
  STEM_MUTAGENS_BY_SCHOOL,
  SUIQIAN_12_STARS_DEFAULT,
  SUIQIAN_12_STARS_ZHONGZHOU,
  TIGER_RULE,
  type HoroscopeStarKey,
} from './constants';
import {
  earthlyBranchToPalaceIndex,
  fixIndex,
  fixLunarMonthIndex,
  solarToLunarInfo,
  type SimpleSolarDate,
} from './calendar';
import type {
  DayDivideMode,
  EarthlyBranch,
  FiveElementsClass,
  GenderLabel,
  HeavenlyStem,
  LeapMonthMode,
  Mutagen,
  MutagenSchool,
  ScopeName,
  StarType,
  TianmaMode,
  ZiweiAlgorithm,
  ZiweiStar,
} from './types';

function createEmptyStarBuckets(): ZiweiStar[][] {
  return Array.from({ length: 12 }, () => []);
}

function makeStar(
  name: string,
  type: StarType,
  scope: ScopeName,
  palaceIndex?: number,
  yearStem?: HeavenlyStem,
  withMutagen = false,
  mutagenSchool: MutagenSchool = 'default',
): ZiweiStar {
  const star: ZiweiStar = { name, type, scope };
  if (palaceIndex !== undefined) {
    const brightness = getStarBrightness(name, palaceIndex);
    if (brightness) star.brightness = brightness;
  }
  if (withMutagen && yearStem) {
    const mutagen = getStarMutagen(name, yearStem, mutagenSchool);
    if (mutagen) star.mutagen = mutagen;
  }
  return star;
}

export function getStarBrightness(starName: string, palaceIndex: number): string {
  const table = STAR_BRIGHTNESS[starName];
  if (!table) return '';
  return table[fixIndex(palaceIndex)] ?? '';
}

export function getMutagensByStem(stem: HeavenlyStem, mutagenSchool: MutagenSchool = 'default'): string[] {
  return [...STEM_MUTAGENS_BY_SCHOOL[mutagenSchool][stem]];
}

export function getStarMutagen(
  starName: string,
  stem: HeavenlyStem,
  mutagenSchool: MutagenSchool = 'default',
): Mutagen | undefined {
  const idx = STEM_MUTAGENS_BY_SCHOOL[mutagenSchool][stem].indexOf(starName);
  return idx >= 0 ? MUTAGEN_LABELS[idx] : undefined;
}

export function getPalaceNames(soulIndex: number): string[] {
  return Array.from({ length: 12 }, (_, i) => PALACE_NAMES[fixIndex(i - soulIndex)]);
}

export function getFiveElementsClass(stem: HeavenlyStem, branch: EarthlyBranch): FiveElementsClass {
  const stemNumber = Math.floor(HEAVENLY_STEMS.indexOf(stem) / 2) + 1;
  const branchNumber = Math.floor(fixIndex(EARTHLY_BRANCHES.indexOf(branch), 6) / 2) + 1;
  let sum = stemNumber + branchNumber;
  if (sum > 5) sum -= 5;
  return FIVE_ELEMENTS_CLASS_BY_SUM[sum - 1];
}

export function getSoulAndBody(params: {
  solarDate: SimpleSolarDate;
  timeIndex: number;
  leapMonthMode: LeapMonthMode | boolean;
  yearStem: HeavenlyStem;
  hourBranch: EarthlyBranch;
}) {
  const monthIndex = fixLunarMonthIndex(params.solarDate, params.timeIndex, params.leapMonthMode);
  const hourBranchOffset = EARTHLY_BRANCHES.indexOf(params.hourBranch);
  const soulIndex = fixIndex(monthIndex - hourBranchOffset);
  const bodyIndex = fixIndex(monthIndex + hourBranchOffset);
  const startStem = TIGER_RULE[params.yearStem];
  const heavenlyStemOfSoul = HEAVENLY_STEMS[fixIndex(HEAVENLY_STEMS.indexOf(startStem) + soulIndex, 10)];
  const earthlyBranchOfSoul = EARTHLY_BRANCHES[fixIndex(soulIndex + 2)];
  return { soulIndex, bodyIndex, heavenlyStemOfSoul, earthlyBranchOfSoul };
}

export function getMajorStarStartIndices(params: {
  solarDate: SimpleSolarDate;
  timeIndex: number;
  dayDivide: DayDivideMode;
  fiveElementsClass: FiveElementsClass;
}) {
  const lunar = solarToLunarInfo(params.solarDate);
  const classVal = FIVE_ELEMENTS_CLASS_VALUE[params.fiveElementsClass];
  let day = params.timeIndex === 12 && params.dayDivide !== 'current' ? lunar.lunarDay + 1 : lunar.lunarDay;
  if (day > lunar.maxDaysInMonth) {
    day -= lunar.maxDaysInMonth;
  }

  let offset = -1;
  let quotient = 0;
  let remainder = -1;
  do {
    offset++;
    const divisor = day + offset;
    quotient = Math.floor(divisor / classVal);
    remainder = divisor % classVal;
  } while (remainder !== 0);

  quotient %= 12;
  let ziweiIndex = quotient - 1;
  if (offset % 2 === 0) {
    ziweiIndex += offset;
  } else {
    ziweiIndex -= offset;
  }
  ziweiIndex = fixIndex(ziweiIndex);
  const tianfuIndex = fixIndex(12 - ziweiIndex);
  return { ziweiIndex, tianfuIndex };
}

export function getMajorStars(params: {
  ziweiIndex: number;
  tianfuIndex: number;
  yearStem: HeavenlyStem;
  mutagenSchool?: MutagenSchool;
}): ZiweiStar[][] {
  const stars = createEmptyStarBuckets();
  const mutagenSchool = params.mutagenSchool ?? 'default';
  const ziweiGroup = ['紫微', '天机', '', '太阳', '武曲', '天同', '', '', '廉贞'] as const;
  const tianfuGroup = ['天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '', '', '', '破军'] as const;

  ziweiGroup.forEach((name, i) => {
    if (!name) return;
    const idx = fixIndex(params.ziweiIndex - i);
    stars[idx].push(makeStar(name, 'major', 'origin', idx, params.yearStem, true, mutagenSchool));
  });
  tianfuGroup.forEach((name, i) => {
    if (!name) return;
    const idx = fixIndex(params.tianfuIndex + i);
    stars[idx].push(makeStar(name, 'major', 'origin', idx, params.yearStem, true, mutagenSchool));
  });
  return stars;
}

export function getLuYangTuoMaIndex(stem: HeavenlyStem, branch: EarthlyBranch) {
  let maIndex = 0;
  switch (branch) {
    case '寅':
    case '午':
    case '戌':
      maIndex = earthlyBranchToPalaceIndex('申');
      break;
    case '申':
    case '子':
    case '辰':
      maIndex = earthlyBranchToPalaceIndex('寅');
      break;
    case '巳':
    case '酉':
    case '丑':
      maIndex = earthlyBranchToPalaceIndex('亥');
      break;
    case '亥':
    case '卯':
    case '未':
      maIndex = earthlyBranchToPalaceIndex('巳');
      break;
  }

  let luBranch: EarthlyBranch = '寅';
  switch (stem) {
    case '甲': luBranch = '寅'; break;
    case '乙': luBranch = '卯'; break;
    case '丙':
    case '戊': luBranch = '巳'; break;
    case '丁':
    case '己': luBranch = '午'; break;
    case '庚': luBranch = '申'; break;
    case '辛': luBranch = '酉'; break;
    case '壬': luBranch = '亥'; break;
    case '癸': luBranch = '子'; break;
  }
  const luIndex = earthlyBranchToPalaceIndex(luBranch);
  return {
    luIndex,
    maIndex,
    yangIndex: fixIndex(luIndex + 1),
    tuoIndex: fixIndex(luIndex - 1),
  };
}

export function getKuiYueIndex(stem: HeavenlyStem) {
  switch (stem) {
    case '甲':
    case '戊':
    case '庚':
      return { kuiIndex: earthlyBranchToPalaceIndex('丑'), yueIndex: earthlyBranchToPalaceIndex('未') };
    case '乙':
    case '己':
      return { kuiIndex: earthlyBranchToPalaceIndex('子'), yueIndex: earthlyBranchToPalaceIndex('申') };
    case '辛':
      return { kuiIndex: earthlyBranchToPalaceIndex('午'), yueIndex: earthlyBranchToPalaceIndex('寅') };
    case '丙':
    case '丁':
      return { kuiIndex: earthlyBranchToPalaceIndex('亥'), yueIndex: earthlyBranchToPalaceIndex('酉') };
    case '壬':
    case '癸':
      return { kuiIndex: earthlyBranchToPalaceIndex('卯'), yueIndex: earthlyBranchToPalaceIndex('巳') };
  }
}

export function getZuoYouIndex(lunarMonth: number) {
  return {
    zuoIndex: fixIndex(earthlyBranchToPalaceIndex('辰') + (lunarMonth - 1)),
    youIndex: fixIndex(earthlyBranchToPalaceIndex('戌') - (lunarMonth - 1)),
  };
}

export function getChangQuIndex(timeIndex: number) {
  const fixed = fixIndex(timeIndex);
  return {
    changIndex: fixIndex(earthlyBranchToPalaceIndex('戌') - fixed),
    quIndex: fixIndex(earthlyBranchToPalaceIndex('辰') + fixed),
  };
}

export function getChangQuIndexByStem(stem: HeavenlyStem) {
  switch (stem) {
    case '甲': return { changIndex: earthlyBranchToPalaceIndex('巳'), quIndex: earthlyBranchToPalaceIndex('酉') };
    case '乙': return { changIndex: earthlyBranchToPalaceIndex('午'), quIndex: earthlyBranchToPalaceIndex('申') };
    case '丙':
    case '戊': return { changIndex: earthlyBranchToPalaceIndex('申'), quIndex: earthlyBranchToPalaceIndex('午') };
    case '丁':
    case '己': return { changIndex: earthlyBranchToPalaceIndex('酉'), quIndex: earthlyBranchToPalaceIndex('巳') };
    case '庚': return { changIndex: earthlyBranchToPalaceIndex('亥'), quIndex: earthlyBranchToPalaceIndex('卯') };
    case '辛': return { changIndex: earthlyBranchToPalaceIndex('子'), quIndex: earthlyBranchToPalaceIndex('寅') };
    case '壬': return { changIndex: earthlyBranchToPalaceIndex('寅'), quIndex: earthlyBranchToPalaceIndex('子') };
    case '癸': return { changIndex: earthlyBranchToPalaceIndex('卯'), quIndex: earthlyBranchToPalaceIndex('亥') };
  }
}

export function getKongJieIndex(timeIndex: number) {
  const fixed = fixIndex(timeIndex);
  const haiIndex = earthlyBranchToPalaceIndex('亥');
  return {
    kongIndex: fixIndex(haiIndex - fixed),
    jieIndex: fixIndex(haiIndex + fixed),
  };
}

export function getHuoLingIndex(yearBranch: EarthlyBranch, timeIndex: number) {
  const fixed = fixIndex(timeIndex);
  let huoStart: EarthlyBranch;
  let lingStart: EarthlyBranch;
  switch (yearBranch) {
    case '寅':
    case '午':
    case '戌':
      huoStart = '丑';
      lingStart = '卯';
      break;
    case '申':
    case '子':
    case '辰':
      huoStart = '寅';
      lingStart = '戌';
      break;
    case '巳':
    case '酉':
    case '丑':
      huoStart = '卯';
      lingStart = '戌';
      break;
    case '亥':
    case '卯':
    case '未':
      huoStart = '酉';
      lingStart = '戌';
      break;
  }
  return {
    huoIndex: fixIndex(earthlyBranchToPalaceIndex(huoStart) + fixed),
    lingIndex: fixIndex(earthlyBranchToPalaceIndex(lingStart) + fixed),
  };
}

export function getMinorStars(params: {
  solarDate: SimpleSolarDate;
  timeIndex: number;
  leapMonthMode: LeapMonthMode | boolean;
  yearStem: HeavenlyStem;
  yearBranch: EarthlyBranch;
  mutagenSchool?: MutagenSchool;
  tianmaMode?: TianmaMode;
}): ZiweiStar[][] {
  const stars = createEmptyStarBuckets();
  const mutagenSchool = params.mutagenSchool ?? 'default';
  const monthIndex = fixLunarMonthIndex(params.solarDate, params.timeIndex, params.leapMonthMode);
  const { zuoIndex, youIndex } = getZuoYouIndex(monthIndex + 1);
  const { changIndex, quIndex } = getChangQuIndex(params.timeIndex);
  const { kuiIndex, yueIndex } = getKuiYueIndex(params.yearStem);
  const { huoIndex, lingIndex } = getHuoLingIndex(params.yearBranch, params.timeIndex);
  const { kongIndex, jieIndex } = getKongJieIndex(params.timeIndex);
  const maBranch = params.tianmaMode === 'month' ? EARTHLY_BRANCHES[fixIndex(2 + monthIndex)] : params.yearBranch;
  const { luIndex, yangIndex, tuoIndex } = getLuYangTuoMaIndex(params.yearStem, params.yearBranch);
  const { maIndex } = getLuYangTuoMaIndex(params.yearStem, maBranch);

  stars[zuoIndex].push(makeStar('左辅', 'soft', 'origin', zuoIndex, params.yearStem, true, mutagenSchool));
  stars[youIndex].push(makeStar('右弼', 'soft', 'origin', youIndex, params.yearStem, true, mutagenSchool));
  stars[changIndex].push(makeStar('文昌', 'soft', 'origin', changIndex, params.yearStem, true, mutagenSchool));
  stars[quIndex].push(makeStar('文曲', 'soft', 'origin', quIndex, params.yearStem, true, mutagenSchool));
  stars[kuiIndex].push(makeStar('天魁', 'soft', 'origin', kuiIndex));
  stars[yueIndex].push(makeStar('天钺', 'soft', 'origin', yueIndex));
  stars[luIndex].push(makeStar('禄存', 'lucun', 'origin', luIndex));
  stars[maIndex].push(makeStar('天马', 'tianma', 'origin', maIndex));
  stars[kongIndex].push(makeStar('地空', 'tough', 'origin', kongIndex));
  stars[jieIndex].push(makeStar('地劫', 'tough', 'origin', jieIndex));
  stars[huoIndex].push(makeStar('火星', 'tough', 'origin', huoIndex));
  stars[lingIndex].push(makeStar('铃星', 'tough', 'origin', lingIndex));
  stars[yangIndex].push(makeStar('擎羊', 'tough', 'origin', yangIndex));
  stars[tuoIndex].push(makeStar('陀罗', 'tough', 'origin', tuoIndex));

  return stars;
}

export function getLuanXiIndex(yearBranch: EarthlyBranch) {
  const hongluanIndex = fixIndex(earthlyBranchToPalaceIndex('卯') - EARTHLY_BRANCHES.indexOf(yearBranch));
  const tianxiIndex = fixIndex(hongluanIndex + 6);
  return { hongluanIndex, tianxiIndex };
}

export function getNianjieIndex(yearBranch: EarthlyBranch): number {
  const table: readonly EarthlyBranch[] = ['戌', '酉', '申', '未', '午', '巳', '辰', '卯', '寅', '丑', '子', '亥'];
  return earthlyBranchToPalaceIndex(table[EARTHLY_BRANCHES.indexOf(yearBranch)]);
}

function getHuagaiXianchiIndex(yearBranch: EarthlyBranch) {
  switch (yearBranch) {
    case '寅':
    case '午':
    case '戌':
      return { huagaiIndex: earthlyBranchToPalaceIndex('戌'), xianchiIndex: earthlyBranchToPalaceIndex('卯') };
    case '申':
    case '子':
    case '辰':
      return { huagaiIndex: earthlyBranchToPalaceIndex('辰'), xianchiIndex: earthlyBranchToPalaceIndex('酉') };
    case '巳':
    case '酉':
    case '丑':
      return { huagaiIndex: earthlyBranchToPalaceIndex('丑'), xianchiIndex: earthlyBranchToPalaceIndex('午') };
    case '亥':
    case '未':
    case '卯':
      return { huagaiIndex: earthlyBranchToPalaceIndex('未'), xianchiIndex: earthlyBranchToPalaceIndex('子') };
  }
}

function getGuGuaIndex(yearBranch: EarthlyBranch) {
  switch (yearBranch) {
    case '寅':
    case '卯':
    case '辰':
      return { guchenIndex: earthlyBranchToPalaceIndex('巳'), guasuIndex: earthlyBranchToPalaceIndex('丑') };
    case '巳':
    case '午':
    case '未':
      return { guchenIndex: earthlyBranchToPalaceIndex('申'), guasuIndex: earthlyBranchToPalaceIndex('辰') };
    case '申':
    case '酉':
    case '戌':
      return { guchenIndex: earthlyBranchToPalaceIndex('亥'), guasuIndex: earthlyBranchToPalaceIndex('未') };
    case '亥':
    case '子':
    case '丑':
      return { guchenIndex: earthlyBranchToPalaceIndex('寅'), guasuIndex: earthlyBranchToPalaceIndex('戌') };
  }
}

function getJieshaAdjIndex(yearBranch: EarthlyBranch): number {
  switch (yearBranch) {
    case '申':
    case '子':
    case '辰':
      return 3;
    case '亥':
    case '卯':
    case '未':
      return 6;
    case '寅':
    case '午':
    case '戌':
      return 9;
    case '巳':
    case '酉':
    case '丑':
      return 0;
  }
}

function getDahaoIndex(yearBranch: EarthlyBranch): number {
  const matched: readonly EarthlyBranch[] = ['未', '午', '酉', '申', '亥', '戌', '丑', '子', '卯', '寅', '巳', '辰'];
  return earthlyBranchToPalaceIndex(matched[EARTHLY_BRANCHES.indexOf(yearBranch)]);
}

export function getTianshiTianshangIndex(gender: GenderLabel, yearBranch: EarthlyBranch, soulIndex: number, algorithm: ZiweiAlgorithm) {
  const branchYinYang = EARTHLY_BRANCHES.indexOf(yearBranch) % 2; // 0 = 阳, 1 = 阴
  const genderYinYang = gender === '男' ? 0 : 1;
  const sameYinYang = branchYinYang === genderYinYang;
  let tianshangIndex = fixIndex(5 + soulIndex); // 仆役宫 (index 5 in PALACE_NAMES)
  let tianshiIndex = fixIndex(7 + soulIndex); // 疾厄宫 (index 7 in PALACE_NAMES)
  if (algorithm === 'zhongzhou' && !sameYinYang) {
    [tianshiIndex, tianshangIndex] = [tianshangIndex, tianshiIndex];
  }
  return { tianshangIndex, tianshiIndex };
}

export function getYearly12(yearBranch: EarthlyBranch, algorithm: ZiweiAlgorithm) {
  const suiqianNames = algorithm === 'zhongzhou' ? SUIQIAN_12_STARS_ZHONGZHOU : SUIQIAN_12_STARS_DEFAULT;
  const suiqian12: string[] = Array(12).fill('');
  const yearStart = earthlyBranchToPalaceIndex(yearBranch);
  for (let i = 0; i < 12; i++) {
    suiqian12[fixIndex(yearStart + i)] = suiqianNames[i];
  }

  let jqStartBranch: EarthlyBranch;
  switch (yearBranch) {
    case '寅':
    case '午':
    case '戌':
      jqStartBranch = '午';
      break;
    case '申':
    case '子':
    case '辰':
      jqStartBranch = '子';
      break;
    case '巳':
    case '酉':
    case '丑':
      jqStartBranch = '酉';
      break;
    case '亥':
    case '卯':
    case '未':
      jqStartBranch = '卯';
      break;
  }
  const jqStart = earthlyBranchToPalaceIndex(jqStartBranch);
  const jiangqian12: string[] = Array(12).fill('');
  for (let i = 0; i < 12; i++) {
    jiangqian12[fixIndex(jqStart + i)] = JIANGQIAN_12_STARS[i];
  }

  return { suiqian12, jiangqian12 };
}

export function getChangsheng12(params: {
  fiveElementsClass: FiveElementsClass;
  gender: GenderLabel;
  yearBranch: EarthlyBranch;
}): string[] {
  const startBranches: Record<number, EarthlyBranch> = {
    2: '申',
    3: '亥',
    4: '巳',
    5: '申',
    6: '寅',
  };
  const startIdx = earthlyBranchToPalaceIndex(startBranches[FIVE_ELEMENTS_CLASS_VALUE[params.fiveElementsClass]]);
  const genderYinYang = params.gender === '男' ? '阳' : '阴';
  const sameYinYang = genderYinYang === BRANCH_META[params.yearBranch].yinYang;
  const result: string[] = Array(12).fill('');
  for (let i = 0; i < 12; i++) {
    const idx = sameYinYang ? fixIndex(startIdx + i) : fixIndex(startIdx - i);
    result[idx] = CHANGSHENG_12_STARS[i];
  }
  return result;
}

export function getBoshi12(params: {
  yearStem: HeavenlyStem;
  yearBranch: EarthlyBranch;
  gender: GenderLabel;
}): string[] {
  const { luIndex } = getLuYangTuoMaIndex(params.yearStem, params.yearBranch);
  const genderYinYang = params.gender === '男' ? '阳' : '阴';
  const sameYinYang = genderYinYang === BRANCH_META[params.yearBranch].yinYang;
  const result: string[] = Array(12).fill('');
  for (let i = 0; i < 12; i++) {
    const idx = sameYinYang ? fixIndex(luIndex + i) : fixIndex(luIndex - i);
    result[idx] = BOSHI_12_STARS[i];
  }
  return result;
}

export function getAdjectiveStars(params: {
  solarDate: SimpleSolarDate;
  timeIndex: number;
  leapMonthMode: LeapMonthMode | boolean;
  gender: GenderLabel;
  algorithm: ZiweiAlgorithm;
  soulIndex: number;
  bodyIndex: number;
  natalYearBranch: EarthlyBranch;
  horoscopeYearStem: HeavenlyStem;
  horoscopeYearBranch: EarthlyBranch;
  suiqian12: string[];
}): ZiweiStar[][] {
  const stars = createEmptyStarBuckets();
  const lunar = solarToLunarInfo(params.solarDate);
  const monthIndex = fixLunarMonthIndex(params.solarDate, params.timeIndex, params.leapMonthMode);

  const { hongluanIndex, tianxiIndex } = getLuanXiIndex(params.natalYearBranch);

  const stemIdx = HEAVENLY_STEMS.indexOf(params.horoscopeYearStem);
  const branchIdx = EARTHLY_BRANCHES.indexOf(params.horoscopeYearBranch);
  const { huagaiIndex, xianchiIndex } = getHuagaiXianchiIndex(params.horoscopeYearBranch);
  const { guchenIndex, guasuIndex } = getGuGuaIndex(params.horoscopeYearBranch);

  const tiancaiIndex = fixIndex(params.soulIndex + branchIdx);
  const tianshouIndex = fixIndex(params.bodyIndex + branchIdx);
  const tianchuIndex = earthlyBranchToPalaceIndex((['巳', '午', '子', '巳', '午', '申', '寅', '午', '酉', '亥'] as const)[stemIdx]);
  const posuiIndex = earthlyBranchToPalaceIndex((['巳', '丑', '酉'] as const)[branchIdx % 3]);
  const feilianIndex = earthlyBranchToPalaceIndex((['申', '酉', '戌', '巳', '午', '未', '寅', '卯', '辰', '亥', '子', '丑'] as const)[branchIdx]);
  const longchiIndex = fixIndex(earthlyBranchToPalaceIndex('辰') + branchIdx);
  const fenggeIndex = fixIndex(earthlyBranchToPalaceIndex('戌') - branchIdx);
  const tiankuIndex = fixIndex(earthlyBranchToPalaceIndex('午') - branchIdx);
  const tianxuIndex = fixIndex(earthlyBranchToPalaceIndex('午') + branchIdx);
  const tianguanIndex = earthlyBranchToPalaceIndex((['未', '辰', '巳', '寅', '卯', '酉', '亥', '酉', '戌', '午'] as const)[stemIdx]);
  const tianfuIndex = earthlyBranchToPalaceIndex((['酉', '申', '子', '亥', '卯', '寅', '午', '巳', '午', '巳'] as const)[stemIdx]);
  const tiandeIndex = fixIndex(earthlyBranchToPalaceIndex('酉') + branchIdx);
  const yuedeIndex = fixIndex(earthlyBranchToPalaceIndex('巳') + branchIdx);
  const tiankongIndex = fixIndex(earthlyBranchToPalaceIndex(params.horoscopeYearBranch) + 1);
  const jieluIndex = earthlyBranchToPalaceIndex((['申', '午', '辰', '寅', '子'] as const)[stemIdx % 5]);
  const kongwangIndex = earthlyBranchToPalaceIndex((['酉', '未', '巳', '卯', '丑'] as const)[stemIdx % 5]);

  let xunkongIndex = fixIndex(earthlyBranchToPalaceIndex(params.horoscopeYearBranch) + (9 - stemIdx) + 1);
  const branchYinYang = branchIdx % 2;
  if (branchYinYang !== xunkongIndex % 2) {
    xunkongIndex = fixIndex(xunkongIndex + 1);
  }
  const jiekongIndex = branchYinYang === 0 ? jieluIndex : kongwangIndex;
  const jieshaAdjIndex = getJieshaAdjIndex(params.horoscopeYearBranch);
  const nianjieIndex = getNianjieIndex(params.horoscopeYearBranch);
  const dahaoAdjIndex = getDahaoIndex(params.horoscopeYearBranch);
  const { tianshiIndex, tianshangIndex } = getTianshiTianshangIndex(
    params.gender,
    params.horoscopeYearBranch,
    params.soulIndex,
    params.algorithm,
  );

  // 月系杂曜
  const yuejieIndex = earthlyBranchToPalaceIndex((['申', '戌', '子', '寅', '辰', '午'] as const)[Math.floor(monthIndex / 2)]);
  const tianyaoIndex = fixIndex(earthlyBranchToPalaceIndex('丑') + monthIndex);
  const tianxingIndex = fixIndex(earthlyBranchToPalaceIndex('酉') + monthIndex);
  const yinshaIndex = earthlyBranchToPalaceIndex((['寅', '子', '戌', '申', '午', '辰'] as const)[monthIndex % 6]);
  const tianyueIndex = earthlyBranchToPalaceIndex((['戌', '巳', '辰', '寅', '未', '卯', '亥', '未', '寅', '午', '戌', '寅'] as const)[monthIndex]);
  const tianwuIndex = earthlyBranchToPalaceIndex((['巳', '申', '寅', '亥'] as const)[monthIndex % 4]);

  // 日系杂曜
  const { zuoIndex, youIndex } = getZuoYouIndex(monthIndex + 1);
  const { changIndex, quIndex } = getChangQuIndex(params.timeIndex);
  const dayIndex = params.timeIndex >= 12 ? lunar.lunarDay : lunar.lunarDay - 1;
  const santaiIndex = fixIndex((zuoIndex + dayIndex) % 12);
  const bazuoIndex = fixIndex((youIndex - dayIndex) % 12);
  const enguangIndex = fixIndex(((changIndex + dayIndex) % 12) - 1);
  const tianguiIndex = fixIndex(((quIndex + dayIndex) % 12) - 1);

  // 时系杂曜
  const fixedTime = fixIndex(params.timeIndex);
  const taifuIndex = fixIndex(earthlyBranchToPalaceIndex('午') + fixedTime);
  const fenggaoIndex = fixIndex(earthlyBranchToPalaceIndex('寅') + fixedTime);

  stars[hongluanIndex].push({ name: '红鸾', type: 'flower', scope: 'origin' });
  stars[tianxiIndex].push({ name: '天喜', type: 'flower', scope: 'origin' });
  stars[tianyaoIndex].push({ name: '天姚', type: 'flower', scope: 'origin' });
  stars[xianchiIndex].push({ name: '咸池', type: 'flower', scope: 'origin' });
  stars[yuejieIndex].push({ name: '解神', type: 'helper', scope: 'origin' });
  stars[santaiIndex].push({ name: '三台', type: 'adjective', scope: 'origin' });
  stars[bazuoIndex].push({ name: '八座', type: 'adjective', scope: 'origin' });
  stars[enguangIndex].push({ name: '恩光', type: 'adjective', scope: 'origin' });
  stars[tianguiIndex].push({ name: '天贵', type: 'adjective', scope: 'origin' });
  stars[longchiIndex].push({ name: '龙池', type: 'adjective', scope: 'origin' });
  stars[fenggeIndex].push({ name: '凤阁', type: 'adjective', scope: 'origin' });
  stars[tiancaiIndex].push({ name: '天才', type: 'adjective', scope: 'origin' });
  stars[tianshouIndex].push({ name: '天寿', type: 'adjective', scope: 'origin' });
  stars[taifuIndex].push({ name: '台辅', type: 'adjective', scope: 'origin' });
  stars[fenggaoIndex].push({ name: '封诰', type: 'adjective', scope: 'origin' });
  stars[tianwuIndex].push({ name: '天巫', type: 'adjective', scope: 'origin' });
  stars[huagaiIndex].push({ name: '华盖', type: 'adjective', scope: 'origin' });
  stars[tianguanIndex].push({ name: '天官', type: 'adjective', scope: 'origin' });
  stars[tianfuIndex].push({ name: '天福', type: 'adjective', scope: 'origin' });
  stars[tianchuIndex].push({ name: '天厨', type: 'adjective', scope: 'origin' });
  stars[tianyueIndex].push({ name: '天月', type: 'adjective', scope: 'origin' });
  stars[tiandeIndex].push({ name: '天德', type: 'adjective', scope: 'origin' });
  stars[yuedeIndex].push({ name: '月德', type: 'adjective', scope: 'origin' });
  stars[tiankongIndex].push({ name: '天空', type: 'adjective', scope: 'origin' });
  stars[xunkongIndex].push({ name: '旬空', type: 'adjective', scope: 'origin' });

  if (params.algorithm === 'default') {
    stars[jieluIndex].push({ name: '截路', type: 'adjective', scope: 'origin' });
    stars[kongwangIndex].push({ name: '空亡', type: 'adjective', scope: 'origin' });
  } else if (params.algorithm === 'beipai') {
    stars[jiekongIndex].push({ name: '截空', type: 'adjective', scope: 'origin' });
  } else {
    stars[params.suiqian12.indexOf('龙德')].push({ name: '龙德', type: 'adjective', scope: 'origin' });
    stars[jiekongIndex].push({ name: '截空', type: 'adjective', scope: 'origin' });
    stars[jieshaAdjIndex].push({ name: '劫杀', type: 'adjective', scope: 'origin' });
    stars[dahaoAdjIndex].push({ name: '大耗', type: 'adjective', scope: 'origin' });
  }

  stars[guchenIndex].push({ name: '孤辰', type: 'adjective', scope: 'origin' });
  stars[guasuIndex].push({ name: '寡宿', type: 'adjective', scope: 'origin' });
  stars[feilianIndex].push({ name: '蜚廉', type: 'adjective', scope: 'origin' });
  stars[posuiIndex].push({ name: '破碎', type: 'adjective', scope: 'origin' });
  stars[tianxingIndex].push({ name: '天刑', type: 'adjective', scope: 'origin' });
  stars[yinshaIndex].push({ name: '阴煞', type: 'adjective', scope: 'origin' });
  stars[tiankuIndex].push({ name: '天哭', type: 'adjective', scope: 'origin' });
  stars[tianxuIndex].push({ name: '天虚', type: 'adjective', scope: 'origin' });
  if (!(params.gender === '中性' && params.algorithm === 'zhongzhou')) {
    stars[tianshiIndex].push({ name: '天使', type: 'adjective', scope: 'origin' });
    stars[tianshangIndex].push({ name: '天伤', type: 'adjective', scope: 'origin' });
  }
  stars[nianjieIndex].push({ name: '年解', type: 'helper', scope: 'origin' });

  return stars;
}

export function getHoroscopeStars(
  stem: HeavenlyStem,
  branch: EarthlyBranch,
  scope: Exclude<ScopeName, 'origin'>,
): ZiweiStar[][] {
  const stars = createEmptyStarBuckets();
  const meta = HOROSCOPE_STAR_META[scope];
  const { kuiIndex, yueIndex } = getKuiYueIndex(stem);
  const { changIndex, quIndex } = getChangQuIndexByStem(stem);
  const { luIndex, yangIndex, tuoIndex, maIndex } = getLuYangTuoMaIndex(stem, branch);
  const { hongluanIndex, tianxiIndex } = getLuanXiIndex(branch);

  if (scope === 'yearly') {
    stars[getNianjieIndex(branch)].push({ name: '年解', type: 'helper', scope: 'yearly' });
  }

  const indices: Record<HoroscopeStarKey, number> = {
    tiankui: kuiIndex,
    tianyue: yueIndex,
    wenchang: changIndex,
    wenqu: quIndex,
    lucun: luIndex,
    qingyang: yangIndex,
    tuoluo: tuoIndex,
    tianma: maIndex,
    hongluan: hongluanIndex,
    tianxi: tianxiIndex,
  };

  for (const key of [
    'tiankui', 'tianyue', 'wenchang', 'wenqu', 'lucun',
    'qingyang', 'tuoluo', 'tianma', 'hongluan', 'tianxi',
  ] as const) {
    stars[indices[key]].push({ name: meta[key].name, type: meta[key].type, scope });
  }
  return stars;
}
