import { SolarTime, Gender, LunarHour } from 'tyme4ts';
import { TIME_MAP } from './baziDefinitions';
import { resolveTrueSolarBirthTime } from '../calendar/true-solar-time';
import { isDateInChinaDstRange } from '../calendar/china-dst';
import { buildBaziWarningEvidence, collectBoundaryWarnings } from './paipanWarnings';
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
  assertBaziGender,
  assertEarthlyBranch,
  assertHeavenlyStem,
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
import { calculateMingGua } from './mingGua';
import { analyzePillarRelations } from './baziPromptEnhancement';
import { analyzeBaziNatalEvidence } from './natalEvidence';

type SolarTimeInstance = ReturnType<typeof SolarTime.fromYmdHms>;
type LunarHourInstance = ReturnType<SolarTimeInstance['getLunarHour']>;

function getMidYearPillarName(year: number): string {
  return SolarTime.fromYmdHms(year, 6, 1, 12, 0, 0)
    .getLunarHour()
    .getEightChar()
    .getYear()
    .getName();
}

function resolveMingGuaYear(solarTime: SolarTimeInstance, baziYearPillarName: string): number {
  const solarYear = solarTime.getSolarDay().getYear();
  return getMidYearPillarName(solarYear) === baziYearPillarName ? solarYear : solarYear - 1;
}

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
    assertHeavenlyStem(gan, '目标天干');
    assertHeavenlyStem(dayMaster, '日主');
    return getTenGod(gan, dayMaster);
  }

  /**
   * 获取地支的十神 (基于藏干主气)
   * @param zhi 地支
   * @param dayMaster 日主
   */
  public getTenGodForBranch(zhi: string, dayMaster: string): string {
    assertEarthlyBranch(zhi, '目标地支');
    assertHeavenlyStem(dayMaster, '日主');
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
    if (typeof isLunar !== 'undefined' && typeof isLunar !== 'boolean') {
      throw new Error('isLunar 必须是布尔值。');
    }
    if (typeof isLeapMonth !== 'undefined' && typeof isLeapMonth !== 'boolean') {
      throw new Error('isLeapMonth 必须是布尔值。');
    }
    if (typeof useTrueSolarTime !== 'undefined' && typeof useTrueSolarTime !== 'boolean') {
      throw new Error('useTrueSolarTime 必须是布尔值。');
    }
    if (typeof person.applyChinaDst !== 'undefined' && typeof person.applyChinaDst !== 'boolean') {
      throw new Error('applyChinaDst 必须是布尔值。');
    }

    assertBaziGender(gender);

    const useTrueSolarTimeEnabled = useTrueSolarTime === true;
    const isLunarEnabled = isLunar === true;
    const isLeapMonthEnabled = isLeapMonth === true;
    const selectedTimeInfo = this.timeMap[timeIndex];
    if (!useTrueSolarTimeEnabled && !Number.isInteger(timeIndex)) {
      throw new Error('无效的时辰索引');
    }
    if (!useTrueSolarTimeEnabled && !selectedTimeInfo) {
      throw new Error('无效的时辰索引');
    }
    if (
      useTrueSolarTimeEnabled &&
      (typeof birthHour !== 'number' ||
        typeof birthMinute !== 'number' ||
        typeof birthLongitude !== 'number')
    ) {
      throw new Error('真太阳时缺少精准时间或经度');
    }
    if (
      useTrueSolarTimeEnabled &&
      (!Number.isInteger(birthHour) || birthHour! < 0 || birthHour! > 23)
    ) {
      throw new Error('出生小时需在 0-23 之间。');
    }
    if (
      useTrueSolarTimeEnabled &&
      (!Number.isInteger(birthMinute) || birthMinute! < 0 || birthMinute! > 59)
    ) {
      throw new Error('出生分钟需在 0-59 之间。');
    }
    if (
      useTrueSolarTimeEnabled &&
      (!Number.isFinite(birthLongitude) || birthLongitude! < -180 || birthLongitude! > 180)
    ) {
      throw new Error('出生经度需在 -180 到 180 之间。');
    }
    const timezone = person.timezone ?? (person.timeZoneId ? undefined : 8);
    if (
      useTrueSolarTimeEnabled &&
      timezone !== undefined &&
      (!Number.isFinite(timezone) || timezone < -12 || timezone > 14)
    ) {
      throw new Error('时区需在 UTC-12 到 UTC+14 之间。');
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
      dateType: isLunarEnabled ? 'lunar' : 'solar',
      isLeapMonth: isLeapMonthEnabled,
    });
    if (validationMessage) {
      throw new Error(validationMessage);
    }

    // 根据用户选择的日历类型创建时间对象
    let solarTime: SolarTimeInstance;
    let lunarHour: LunarHourInstance;
    let timing: TimingInfo | undefined;
    const baseHour = useTrueSolarTimeEnabled ? birthHour! : selectedTimeInfo!.hour;
    const baseMinute = useTrueSolarTimeEnabled ? birthMinute! : selectedTimeInfo!.minute;

    if (isLunarEnabled) {
      // 如果选择农历，使用 LunarHour.fromYmdHms() 创建，然后转换为 SolarTime
      const lunarMonth = isLeapMonthEnabled ? -Math.abs(month) : month;
      lunarHour = LunarHour.fromYmdHms(year, lunarMonth, day, baseHour, baseMinute, 0);
      solarTime = lunarHour.getSolarTime();
    } else {
      // 如果选择公历，直接使用 SolarTime.fromYmdHms()
      solarTime = SolarTime.fromYmdHms(year, month, day, baseHour, baseMinute, 0);
      lunarHour = solarTime.getLunarHour();
    }

    const applyChinaDst = person.applyChinaDst === true;
    const warnings: string[] = [];

    if (useTrueSolarTimeEnabled) {
      const standardTime = {
        year: solarTime.getYear(),
        month: solarTime.getMonth(),
        day: solarTime.getDay(),
        hour: solarTime.getHour(),
        minute: solarTime.getMinute(),
        second: solarTime.getSecond(),
      };

      const trueSolarResult = resolveTrueSolarBirthTime({
        dateType: isLunarEnabled ? 'lunar' : 'solar',
        year,
        month,
        day,
        hour: baseHour,
        minute: baseMinute,
        second: 0,
        isLeapMonth: isLeapMonthEnabled,
        longitude: birthLongitude!,
        timezone,
        timeZoneId: person.timeZoneId,
        applyChinaDst,
      });
      const dstCorrectionMinutes = trueSolarResult.chinaDst.applied
        ? trueSolarResult.chinaDst.offsetMinutes
        : 0;
      if (trueSolarResult.chinaDst.applied) {
        warnings.push(
          '出生时刻处于中国夏令时期间（1986-1991），钟表时间比北京标准时间快 1 小时，已自动回拨 60 分钟后排盘。如所记时间已折算为标准时间，请关闭自动夏令时校正选项。',
        );
        if (trueSolarResult.chinaDst.ambiguous) {
          warnings.push(
            '出生时刻落在夏令时结束日 01:00-02:00 的重复时段：该钟表时刻当天会出现两次，本次排盘无法在缺少原始记录标注时唯一定时。',
          );
        }
        if (trueSolarResult.chinaDst.nonexistent) {
          warnings.push(
            '出生时刻落在夏令时开始日 02:00-03:00 的跳变时段：该钟表时刻当天并不存在，本次输入不能作为有效出生时刻。',
          );
        }
      }

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
        timezone: trueSolarResult.timezone,
        ...(trueSolarResult.timeZoneId ? { timeZoneId: trueSolarResult.timeZoneId } : {}),
        standardMeridian: trueSolarResult.standardMeridian,
        longitudeCorrectionMinutes: trueSolarResult.longitudeCorrectionMinutes,
        equationOfTimeMinutes: trueSolarResult.equationOfTimeMinutes,
        totalCorrectionMinutes: trueSolarResult.totalCorrectionMinutes,
        evidence: {
          key: trueSolarResult.key,
          status: trueSolarResult.status,
          calculationSteps: trueSolarResult.calculationSteps,
          calculationChain: trueSolarResult.calculationChain,
          correctionFacts: trueSolarResult.correctionFacts,
          summaryFact: trueSolarResult.summaryFact,
          limitations: trueSolarResult.limitations,
          limitationFacts: trueSolarResult.limitationFacts,
          timezoneEvidence: trueSolarResult.timezoneEvidence,
          source: trueSolarResult.source,
          promptText: trueSolarResult.promptText,
        },
        ...(dstCorrectionMinutes !== 0 ? { dstCorrectionMinutes } : {}),
      };

      // 边界预警：基于校正后的最终时刻检查节气交接/时辰边界/换日线
      warnings.push(
        ...collectBoundaryWarnings({
          year: solarTime.getYear(),
          month: solarTime.getMonth(),
          day: solarTime.getDay(),
          hour: solarTime.getHour(),
          minute: solarTime.getMinute(),
          second: solarTime.getSecond(),
        }),
      );
    } else if (
      applyChinaDst &&
      isDateInChinaDstRange(solarTime.getYear(), solarTime.getMonth(), solarTime.getDay())
    ) {
      // 仅时辰精度：无法安全做 -1 小时校正，只提示
      warnings.push(
        '出生日期位于中国夏令时期间（1986-1991），钟表时间比北京标准时间快 1 小时，时辰可能需前移。建议改用真太阳时模式并提供精确出生时间。',
      );
    }

    const eightChar = lunarHour.getEightChar();
    const { warningFacts, warningSummaryFact } = buildBaziWarningEvidence(warnings);

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
    const mingGuaYear = resolveMingGuaYear(solarTime, pillars.year.ganZhi);
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
      pillarRelations: { fuxin: [], fanyin: [], xingChong: [] },
      warnings,
      warningFacts,
      warningSummaryFact,
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
      mingGua: calculateMingGua(mingGuaYear, gender),
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
        missing: [],
        present: [],
        dominantByRule: [],
        ruleBasis: [],
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
          status: '未知',
          details: {
            timely: false,
            seasonalEffect: '中性',
            commanderEffect: '中性',
            formationEffect: '中性',
            hasRoot: false,
            hasStrongRoot: false,
            hasSupport: false,
            hasConstraint: false,
            ruleBasis: [],
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
      pillarRelations: analyzePillarRelations(coreResult),
    };
    finalResult.evidenceAnalysis = analyzeBaziNatalEvidence(finalResult);

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
    const shenShaCalculator =
      person.shenShaVariants || person.shenShaScope
        ? new ShenShaCalculator({ variants: person.shenShaVariants, scope: person.shenShaScope })
        : this.shenShaCalculator;

    const tenGods = calculateTenGods(pillars, dayMasterGan);
    const shensha = shenShaCalculator.calculateAllShenSha(baziArray, gender);

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

    return getCategorizedYearShenSha(
      yearData,
      baziResult,
      (baziArray, gender) => this.shenShaCalculator.calculateAllShenSha(baziArray, gender),
      getShenShaType,
    );
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
