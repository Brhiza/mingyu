import { SolarTime, Gender, LunarHour } from 'tyme4ts';
import { TIME_MAP } from './baziDefinitions';
import { calculateTrueSolarTime } from './trueSolarTime';
import { ShenShaCalculator } from './baziShenSha';
import { BaziAnalyzer } from './baziAnalysis';
import { LuckCalculator } from './LuckCalculator';
import { WuxingCalculator } from './WuxingCalculator';
import {
  getWuxing as getWuxingUtil,
  getGanYinYang,
  getTenGod,
  getTenGodForBranch,
  getSeasonStatus,
  getShenShaType,
} from './baziUtils';
import {
  calculateHiddenStems,
  calculateHiddenTenGods,
  calculateKongWang,
  calculateLifeStages,
  calculateNayin,
  calculatePillarLifeStages,
  calculateTenGods,
  calculateZiZuo,
} from './baziCalculatorHelpers';
import {
  calculateLiuri,
  calculateLiuriRange,
  calculateLiuyue,
  calculateSeasonInfo,
  getCategorizedYearShenSha,
  getMonthCommander,
} from './baziCalculatorTime';
import {
  Person,
  TimeInfo,
  Pillars,
  BaziChartResult,
  InternalBaziChartResult,
  LiunianInfo,
  TimingInfo,
  Wuxing,
} from './baziTypes';
import { getTimeIndexFromClock } from '../calendar/dateUtils';
import { getBirthDateValidationMessage } from '../calendar/date-validation';

type SolarTimeInstance = ReturnType<typeof SolarTime.fromYmdHms>;
type LunarHourInstance = ReturnType<SolarTimeInstance['getLunarHour']>;

/**
 * 八字计算工具类
 * 整合了所有计算逻辑
 */
export class BaziCalculator {
  private timeMap: TimeInfo[] = TIME_MAP;
  private shenShaCalculator: ShenShaCalculator;
  private analyzer: BaziAnalyzer;
  private luckCalculator: LuckCalculator;
  private wuxingCalculator: WuxingCalculator;

  constructor() {
    this.shenShaCalculator = new ShenShaCalculator();
    this.luckCalculator = new LuckCalculator();
    this.wuxingCalculator = new WuxingCalculator();
    const getWuxing = (ganOrZhi: string): Wuxing => {
      const wuxing = getWuxingUtil(ganOrZhi);
      if (wuxing === '未知') {
        throw new Error(`无法确定 '${ganOrZhi}' 的五行`);
      }
      return wuxing;
    };
    this.analyzer = new BaziAnalyzer(getWuxing, getTenGod, getSeasonStatus);
  }

  /**
   * 获取天干的十神
   * @param gan 天干
   * @param dayMaster 日主
   */
  public getTenGod(gan: string, dayMaster: string): string {
    return getTenGod(gan, dayMaster);
  }

  /**
   * 获取地支的十神 (基于藏干主气)
   * @param zhi 地支
   * @param dayMaster 日主
   */
  public getTenGodForBranch(zhi: string, dayMaster: string): string {
    return getTenGodForBranch(zhi, dayMaster);
  }

  /**
   * 计算核心八字数据（同步）
   */
  public calculateCoreBazi(person: Person): InternalBaziChartResult {
    const {
      year,
      month,
      day,
      timeIndex,
      gender,
      age,
      isLunar,
      isLeapMonth,
      useTrueSolarTime,
      birthHour,
      birthMinute,
      birthPlace,
      birthLongitude,
    } = person;
    const selectedTimeInfo = this.timeMap[timeIndex];
    if (!useTrueSolarTime && !selectedTimeInfo) {
      throw new Error('无效的时辰索引');
    }
    if (
      useTrueSolarTime &&
      (typeof birthHour !== 'number' ||
        typeof birthMinute !== 'number' ||
        typeof birthLongitude !== 'number')
    ) {
      throw new Error('真太阳时缺少精准时间或经度');
    }
    if (useTrueSolarTime && (birthHour! < 0 || birthHour! > 23)) {
      throw new Error('出生小时需在 0-23 之间。');
    }
    if (useTrueSolarTime && (birthMinute! < 0 || birthMinute! > 59)) {
      throw new Error('出生分钟需在 0-59 之间。');
    }
    if (useTrueSolarTime && (birthLongitude! < -180 || birthLongitude! > 180)) {
      throw new Error('出生经度需在 -180 到 180 之间。');
    }
    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
      throw new Error('出生年份需在 1900-2100 之间。');
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new Error('出生月份需在 1-12 之间。');
    }
    if (!Number.isInteger(day) || day < 1) {
      throw new Error('出生日期不能小于 1。');
    }

    const validationMessage = getBirthDateValidationMessage({
      year,
      month,
      day,
      dateType: isLunar ? 'lunar' : 'solar',
      isLeapMonth,
    });
    if (validationMessage) {
      throw new Error(validationMessage);
    }

    // 根据用户选择的日历类型创建时间对象
    let solarTime: SolarTimeInstance;
    let lunarHour: LunarHourInstance;
    let timing: TimingInfo | undefined;
    const baseHour = useTrueSolarTime ? birthHour! : selectedTimeInfo!.hour;
    const baseMinute = useTrueSolarTime ? birthMinute! : 0;

    if (isLunar) {
      // 如果选择农历，使用 LunarHour.fromYmdHms() 创建，然后转换为 SolarTime
      const lunarMonth = isLeapMonth ? -Math.abs(month) : month;
      lunarHour = LunarHour.fromYmdHms(year, lunarMonth, day, baseHour, baseMinute, 0);
      solarTime = lunarHour.getSolarTime();
    } else {
      // 如果选择公历，直接使用 SolarTime.fromYmdHms()
      solarTime = SolarTime.fromYmdHms(year, month, day, baseHour, baseMinute, 0);
      lunarHour = solarTime.getLunarHour();
    }

    if (useTrueSolarTime) {
      const standardTime = {
        year: solarTime.getYear(),
        month: solarTime.getMonth(),
        day: solarTime.getDay(),
        hour: solarTime.getHour(),
        minute: solarTime.getMinute(),
        second: solarTime.getSecond(),
      };
      const trueSolarResult = calculateTrueSolarTime(standardTime, birthLongitude!);

      solarTime = SolarTime.fromYmdHms(
        trueSolarResult.correctedTime.year,
        trueSolarResult.correctedTime.month,
        trueSolarResult.correctedTime.day,
        trueSolarResult.correctedTime.hour,
        trueSolarResult.correctedTime.minute,
        trueSolarResult.correctedTime.second,
      );
      lunarHour = solarTime.getLunarHour();
      timing = {
        enabled: true,
        standardTime,
        correctedTime: trueSolarResult.correctedTime,
        birthPlace: birthPlace?.trim() || '',
        birthLongitude,
        longitudeCorrectionMinutes: trueSolarResult.longitudeCorrectionMinutes,
        equationOfTimeMinutes: trueSolarResult.equationOfTimeMinutes,
        totalCorrectionMinutes: trueSolarResult.totalCorrectionMinutes,
      };
    }

    const eightChar = lunarHour.getEightChar();

    const yearColumn = eightChar.getYear();
    const monthColumn = eightChar.getMonth();
    const dayColumn = eightChar.getDay();
    const hourColumn = eightChar.getHour();

    const pillars: Pillars = {
      year: {
        gan: yearColumn.getHeavenStem().getName(),
        zhi: yearColumn.getEarthBranch().getName(),
        ganZhi: yearColumn.getName(),
      },
      month: {
        gan: monthColumn.getHeavenStem().getName(),
        zhi: monthColumn.getEarthBranch().getName(),
        ganZhi: monthColumn.getName(),
      },
      day: {
        gan: dayColumn.getHeavenStem().getName(),
        zhi: dayColumn.getEarthBranch().getName(),
        ganZhi: dayColumn.getName(),
      },
      hour: {
        gan: hourColumn.getHeavenStem().getName(),
        zhi: hourColumn.getEarthBranch().getName(),
        ganZhi: hourColumn.getName(),
      },
    };
    const finalTimeInfo = timing
      ? this.getTimeInfoFromClock(timing.correctedTime.hour, timing.correctedTime.minute)
      : selectedTimeInfo!;

    const dayMasterGan = pillars.day.gan;
    const genderEnum = gender === 'male' ? Gender.MAN : Gender.WOMAN;
    const luckInfo = this.luckCalculator.calculateLuckInfo(solarTime, genderEnum, dayMasterGan);
    const liunian = this.flattenLiunian(luckInfo);

    return {
      gender, // 保持原始值 'male' | 'female'，仅在展示层转换
      age,
      solarDate: {
        year: solarTime.getSolarDay().getYear(),
        month: solarTime.getSolarDay().getMonth(),
        day: solarTime.getSolarDay().getDay(),
      },
      lunarDate: {
        year: lunarHour.getLunarDay().getLunarMonth().getLunarYear().getYear(),
        month: lunarHour.getLunarDay().getLunarMonth().getMonth(),
        day: lunarHour.getLunarDay().getDay(),
        monthName: lunarHour.getLunarDay().getLunarMonth().getName(),
        dayName: lunarHour.getLunarDay().getName(),
      },
      timeInfo: finalTimeInfo,
      pillars,
      dayMaster: {
        gan: dayMasterGan,
        element: getWuxingUtil(dayMasterGan),
        yinYang: getGanYinYang(dayMasterGan),
      },
      zodiac: lunarHour
        .getLunarDay()
        .getLunarMonth()
        .getLunarYear()
        .getSixtyCycle()
        .getEarthBranch()
        .getZodiac()
        .getName(),
      constellation: solarTime.getSolarDay().getConstellation().getName(),
      luckInfo,
      liunian,
      timing,
      // 传递给扩展计算，避免重复创建
      solarTime,
      eightChar,
      tenGods: {},
      hiddenStems: { year: [], month: [], day: [], hour: [] },
      hiddenTenGods: {},
      wuxingStrength: {
        percentages: { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 },
        scores: { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 },
        missing: [],
      },
      mingGong: '',
      shenGong: '',
      taiYuan: '',
      taiXi: '',
      lifeStages: {},
      pillarLifeStages: { year: '', month: '', day: '', hour: '' },
      nayin: { year: '', month: '', day: '', hour: '' },
      shensha: { year: [], month: [], day: [], hour: [], global: [] },
      ziZuo: { year: '', month: '', day: '', hour: '' },
      kongWang: { year: [], month: [], day: [], hour: [] },
      wuxingSeasonStatus: {},
      monthCommander: '',
      seasonInfo: {
        currentJieqi: '',
        nextJieqi: '',
        daysSincePrev: 0,
        daysToNext: 0,
        currentSeason: '',
        jieqiList: [],
      },
      analysis: {
        dayMasterStrength: {
          score: 0,
          status: '未知',
          details: {
            seasonalScore: 0,
            timely: false,
            formationStrength: 0,
            rootStrength: 0,
            supportStrength: 0,
            constraintStrength: 0,
          },
        },
        mingGe: { pattern: '未知', isSpecial: false },
        usefulGod: { favorable: [], unfavorable: [], useful: '', avoid: '' },
      },
      shenShaAnalysis: { year: [], month: [], day: [], hour: [], global: [] },
    };
  }

  /**
   * 统一计算八字所有数据
   */
  public calculateBazi(person: Person): BaziChartResult {
    const coreResult = this.calculateCoreBazi(person);
    const extendedResult = this.calculateExtendedBazi(person, coreResult);

    const finalResult: InternalBaziChartResult = {
      ...coreResult,
      ...extendedResult,
    };

    delete finalResult.solarTime;
    delete finalResult.eightChar;

    return finalResult as BaziChartResult;
  }

  /**
   * 计算扩展八字数据（异步）
   */
  private calculateExtendedBazi(
    person: Person,
    coreResult: InternalBaziChartResult,
  ): Pick<
    BaziChartResult,
    | 'analysis'
    | 'shensha'
    | 'shenShaAnalysis'
    | 'tenGods'
    | 'hiddenStems'
    | 'hiddenTenGods'
    | 'wuxingStrength'
    | 'mingGong'
    | 'shenGong'
    | 'taiYuan'
    | 'taiXi'
    | 'lifeStages'
    | 'pillarLifeStages'
    | 'nayin'
    | 'ziZuo'
    | 'kongWang'
    | 'wuxingSeasonStatus'
    | 'monthCommander'
    | 'seasonInfo'
  > {
    const { gender } = person;
    const { pillars, dayMaster, solarTime, eightChar } = coreResult;

    if (!solarTime || !eightChar) {
      throw new Error(
        'Internal error: solarTime or eightChar is missing for extended Bazi calculation.',
      );
    }

    const dayMasterGan = dayMaster.gan;

    const baziArray: [string, string][] = [
      [pillars.year.gan, pillars.year.zhi],
      [pillars.month.gan, pillars.month.zhi],
      [pillars.day.gan, pillars.day.zhi],
      [pillars.hour.gan, pillars.hour.zhi],
    ];

    const hiddenStems = calculateHiddenStems(pillars);
    const seasonInfo = calculateSeasonInfo(solarTime);
    const monthCommander = getMonthCommander(solarTime, pillars.month.zhi);
    const wuxingStrengthDetails = this.wuxingCalculator.calculateWuxingStrength(
      pillars,
      monthCommander,
    );
    const shenShaCalculator = person.shenShaVariants
      ? new ShenShaCalculator({ variants: person.shenShaVariants })
      : this.shenShaCalculator;

    // Calculate basic data first
    const tenGods = calculateTenGods(pillars, dayMasterGan);
    const shensha = shenShaCalculator.calculateAllShenSha(baziArray, gender);

    // Calculate ShenSha interactions
    const shenShaAnalysis = {
      year: [] as string[],
      month: [] as string[],
      day: [] as string[],
      hour: [] as string[],
      global: shensha.global ? shenShaCalculator.analyzeGlobalShenSha(shensha.global) : [],
    };
    const pillarKeys = ['year', 'month', 'day', 'hour'] as const;
    pillarKeys.forEach((key) => {
      const ssList = shensha[key] || [];
      const tg = tenGods[key] || '';
      shenShaAnalysis[key] = shenShaCalculator.analyzeShenShaWithTenGod(ssList, tg);
    });

    return {
      tenGods,
      hiddenStems,
      hiddenTenGods: calculateHiddenTenGods(hiddenStems, dayMasterGan),
      wuxingStrength: wuxingStrengthDetails,
      mingGong: eightChar.getOwnSign().getName(),
      shenGong: eightChar.getBodySign().getName(),
      taiYuan: eightChar.getFetalOrigin().getName(),
      taiXi: eightChar.getFetalBreath().getName(),
      lifeStages: calculateLifeStages(pillars, dayMasterGan),
      pillarLifeStages: calculatePillarLifeStages(pillars),
      nayin: calculateNayin(pillars),
      shensha,
      shenShaAnalysis,
      ziZuo: calculateZiZuo(pillars),
      kongWang: calculateKongWang(pillars),
      wuxingSeasonStatus: getSeasonStatus(pillars.month.zhi),
      monthCommander,
      seasonInfo,
      analysis: this.analyzer.analyzeBaziChart(pillars, hiddenStems, monthCommander, {
        currentJieqi: seasonInfo.currentJieqi,
      }),
    };
  }

  public calculateLiuyue(year: number, month: number, dayMaster: string) {
    return calculateLiuyue(year, month, dayMaster);
  }

  public calculateLiuri(year: number, month: number, day: number, dayMaster: string) {
    return calculateLiuri(year, month, day, dayMaster);
  }

  public calculateLiuriRange(startDate: string, endDate: string, dayMaster: string) {
    return calculateLiuriRange(startDate, endDate, dayMaster);
  }

  public calculateSeasonInfo(solarTime: SolarTimeInstance) {
    return calculateSeasonInfo(solarTime);
  }

  /**
   * 计算并分类流年神煞
   */
  public getCategorizedYearShenSha(
    yearData: Pick<LiunianInfo, 'ganZhi'> | null | undefined,
    baziResult: BaziChartResult,
  ): { lucky: string[]; unlucky: string[]; neutral: string[] } {
    if (!yearData?.ganZhi || !baziResult?.pillars) {
      return { lucky: [], unlucky: [], neutral: [] };
    }
    try {
      return getCategorizedYearShenSha(
        yearData,
        baziResult,
        (baziArray, gender) => this.shenShaCalculator.calculateAllShenSha(baziArray, gender),
        getShenShaType,
      );
    } catch (_error) {
      return { lucky: [], unlucky: [], neutral: [] };
    }
  }

  private getTimeInfoFromClock(hour: number, minute: number): TimeInfo {
    const timeIndex = getTimeIndexFromClock(hour, minute);
    const timeInfo = this.timeMap[timeIndex];

    if (!timeInfo) {
      throw new Error('无法根据真太阳时确定时辰');
    }

    return timeInfo;
  }

  private flattenLiunian(luckInfo: Pick<BaziChartResult, 'luckInfo'>['luckInfo']): LiunianInfo[] {
    const liunianMap = new Map<number, LiunianInfo>();

    luckInfo.cycles.forEach((cycle) => {
      const sourceYears = cycle.resolvedYears ?? cycle.years;
      sourceYears.forEach((yearInfo) => {
        // 交运年份若同时落在前后两步运中，默认以后一步大运为准
        liunianMap.set(yearInfo.year, yearInfo);
      });
    });

    return Array.from(liunianMap.values()).sort((a, b) => a.year - b.year);
  }
}

export const baziCalculator = new BaziCalculator();
export default baziCalculator;
