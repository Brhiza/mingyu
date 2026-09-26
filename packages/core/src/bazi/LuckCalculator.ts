import { SolarTime, SolarTerm, ChildLimit, SixtyCycleYear } from 'tyme4ts';
import { assertHeavenlyStem, getTenGod, getTenGodForBranch } from './baziUtils';
import type {
  BaziFortuneBatchMetadata,
  LuckInfo,
  LuckCycle,
  LiunianInfo,
  SolarDateTimeInfo,
  XiaoyunInfo,
} from './baziTypes';
import {
  formatSolarDateTime,
  shiftSolarDateTimeYears,
  toNativeDate,
  toSolarDateTimeInfo,
} from './luckTiming';
import { CHILD_LIMIT_METHOD, createChildLimit } from './childLimit';

type SolarTimeInstance = ReturnType<typeof SolarTime.fromYmdHms>;
type LuckGender = Parameters<typeof ChildLimit.fromSolarTime>[1];
type ChildLimitInstance = ReturnType<typeof ChildLimit.fromSolarTime>;
type FortuneInstance = ReturnType<ChildLimitInstance['getStartFortune']>;
type EightCharInstance = ReturnType<ReturnType<SolarTimeInstance['getLunarHour']>['getEightChar']>;

interface LuckCyclePlan {
  cycle: LuckCycle;
  startYear: number;
  yearCount: number;
}

interface LuckStartContext {
  childLimit: ChildLimitInstance;
  firstCycleStartTime: SolarDateTimeInfo;
  birthSolarTime: SolarDateTimeInfo;
  birthYear: number;
  startFortune: FortuneInstance;
  startInfo: string;
  handoverInfo: string;
}

interface LuckPlan {
  startInfo: string;
  handoverInfo: string;
  birthYear: number;
  startFortune: FortuneInstance;
  cycles: LuckCyclePlan[];
}

export interface LuckInfoBatchResult {
  luckInfo: LuckInfo;
  batch: BaziFortuneBatchMetadata;
}

/**
 * 专注于大运、小运、流年等运势计算的工具类
 *
 * 基于 tyme4ts 提供的 ChildLimit / DecadeFortune / Fortune 结果，
 * 统一生成起运时间、大运排布与逐年小运，避免手推公式与官方实现偏离。
 */
export class LuckCalculator {
  /**
   * 主计算函数：计算大运、小运和所有关联的流年信息
   */
  public calculateLuckInfo(
    solarTime: SolarTimeInstance,
    gender: LuckGender,
    dayMaster: string,
    termSolarTime: SolarTimeInstance = solarTime,
    eightChar: EightCharInstance = solarTime.getLunarHour().getEightChar(),
  ): LuckInfo {
    const plan = this.createLuckPlan(termSolarTime, gender, dayMaster, eightChar);
    const cycles = plan.cycles.map(({ cycle, startYear, yearCount }) => ({
      ...cycle,
      years: this.calculateLiunianForCycle(
        cycle.startSolarTime!,
        plan.birthYear,
        dayMaster,
        cycle.endSolarTime,
        plan.startFortune,
        { startYear, yearCount },
      ),
    }));
    this.attachResolvedYears(
      cycles,
      plan.cycles.map(({ startYear }) => startYear),
    );

    return {
      startInfo: plan.startInfo,
      handoverInfo: plan.handoverInfo,
      cycles,
    };
  }

  /** 仅计算本命批次仍需展示的起运资料，不构造任何大运流年。 */
  public calculateNatalLuckInfo(
    solarTime: SolarTimeInstance,
    gender: LuckGender,
    dayMaster: string,
    termSolarTime: SolarTimeInstance = solarTime,
    eightChar: EightCharInstance = solarTime.getLunarHour().getEightChar(),
  ): LuckInfo {
    const context = this.createLuckStartContext(termSolarTime, gender, dayMaster, eightChar);
    return {
      startInfo: context.startInfo,
      handoverInfo: context.handoverInfo,
      cycles: [],
    };
  }

  /** 按全局逐年游标仅构造本次所属周期及一个流年。 */
  public calculateLuckInfoBatch(
    solarTime: SolarTimeInstance,
    gender: LuckGender,
    dayMaster: string,
    startIndex: number,
    termSolarTime: SolarTimeInstance = solarTime,
    eightChar: EightCharInstance = solarTime.getLunarHour().getEightChar(),
  ): LuckInfoBatchResult {
    const plan = this.createLuckPlan(termSolarTime, gender, dayMaster, eightChar);
    const totalEntries = plan.cycles.reduce(
      (total, item) => total + Math.max(item.yearCount, 1),
      0,
    );
    if (
      !Number.isSafeInteger(startIndex) ||
      startIndex < 0 ||
      startIndex >= Math.max(totalEntries, 1)
    ) {
      throw new RangeError('八字命限续取位置超出资料范围。');
    }

    const batch: BaziFortuneBatchMetadata = {
      unit: 'cycle-year',
      startIndex,
      endIndexExclusive: Math.min(startIndex + 1, totalEntries),
      totalEntries,
      nextIndex: startIndex + 1 < totalEntries ? startIndex + 1 : null,
      cycleIndex: null,
      year: null,
    };
    let offset = startIndex;
    for (let cycleIndex = 0; cycleIndex < plan.cycles.length; cycleIndex++) {
      const { cycle, startYear, yearCount } = plan.cycles[cycleIndex];
      const entries = Math.max(yearCount, 1);
      if (offset >= entries) {
        offset -= entries;
        continue;
      }
      const years =
        yearCount > 0
          ? [
              this.calculateLiunianAtOffset(
                startYear,
                offset,
                plan.birthYear,
                dayMaster,
                plan.startFortune,
              ),
            ]
          : [];
      batch.cycleIndex = cycleIndex;
      batch.year = years[0]?.year ?? null;
      return {
        luckInfo: {
          startInfo: plan.startInfo,
          handoverInfo: plan.handoverInfo,
          cycles: [{ ...cycle, years, resolvedYears: years }],
        },
        batch,
      };
    }

    return {
      luckInfo: {
        startInfo: plan.startInfo,
        handoverInfo: plan.handoverInfo,
        cycles: [],
      },
      batch,
    };
  }

  private createLuckPlan(
    termSolarTime: SolarTimeInstance,
    gender: LuckGender,
    dayMaster: string,
    eightChar: EightCharInstance,
  ): LuckPlan {
    const context = this.createLuckStartContext(termSolarTime, gender, dayMaster, eightChar);
    const {
      childLimit,
      firstCycleStartTime,
      birthSolarTime,
      birthYear,
      startFortune,
      startInfo,
      handoverInfo,
    } = context;
    const cycles: LuckCyclePlan[] = [];
    const preDayunRange = this.getCycleCalendarYearRange(birthSolarTime, firstCycleStartTime);
    if (preDayunRange.yearCount > 0) {
      cycles.push({
        cycle: {
          age: 1,
          year: birthYear,
          ganZhi: '小运',
          isXiaoyun: true,
          type: '小运',
          startSolarTime: birthSolarTime,
          endSolarTime: firstCycleStartTime,
          years: [],
        },
        ...preDayunRange,
      });
    }

    let currentDecade = childLimit.getStartDecadeFortune();
    for (let index = 0; index < 12; index++) {
      const cycleStartTime = shiftSolarDateTimeYears(firstCycleStartTime, index * 10);
      const cycleEndTime = shiftSolarDateTimeYears(firstCycleStartTime, (index + 1) * 10);
      cycles.push({
        cycle: {
          age: currentDecade.getStartAge(),
          year: cycleStartTime.year,
          ganZhi: currentDecade.getName(),
          isXiaoyun: false,
          type: '大运',
          startSolarTime: cycleStartTime,
          endSolarTime: cycleEndTime,
          years: [],
        },
        ...this.getCycleCalendarYearRange(cycleStartTime, cycleEndTime),
      });
      currentDecade = currentDecade.next(1);
    }

    return { startInfo, handoverInfo, birthYear, startFortune, cycles };
  }

  private createLuckStartContext(
    termSolarTime: SolarTimeInstance,
    gender: LuckGender,
    dayMaster: string,
    eightChar: EightCharInstance,
  ): LuckStartContext {
    assertHeavenlyStem(dayMaster, '日主');
    const childLimit = createChildLimit(termSolarTime, gender, eightChar);
    const firstCycleStartTime = toSolarDateTimeInfo(childLimit.getEndTime());
    const birthSolarTime = toSolarDateTimeInfo(termSolarTime);
    const birthYear = termSolarTime.getYear();
    const startFortune = childLimit.getStartFortune();

    return {
      childLimit,
      firstCycleStartTime,
      birthSolarTime,
      birthYear,
      startFortune,
      startInfo: this.getStartInfoText(
        childLimit.getYearCount(),
        childLimit.getMonthCount(),
        childLimit.getDayCount(),
        childLimit.getHourCount(),
        childLimit.getMinuteCount(),
      ),
      handoverInfo: this.getHandoverInfo(firstCycleStartTime),
    };
  }

  private calculateLiunianAtOffset(
    startYear: number,
    offset: number,
    birthYear: number,
    dayMaster: string,
    startFortune: FortuneInstance,
  ): LiunianInfo {
    const currentYear = startYear + offset;
    const age = this.getLiunianAge(currentYear, birthYear);
    const liunian = this.calculateLiunian(currentYear, dayMaster);
    return {
      year: currentYear,
      age,
      ganZhi: liunian.ganZhi,
      tenGod: liunian.tenGod,
      tenGodZhi: liunian.tenGodZhi,
      xiaoyun: this.getXiaoyunForAge(startFortune, age, dayMaster),
    };
  }

  /**
   * 为单个大运周期（10年）计算所有流年信息
   */
  private calculateLiunianForCycle(
    cycleStartTime: SolarDateTimeInfo,
    birthYear: number,
    dayMaster: string,
    cycleEndTime?: SolarDateTimeInfo,
    startFortune?: FortuneInstance,
    plannedRange?: { startYear: number; yearCount: number },
  ): LiunianInfo[] {
    const liunianList: LiunianInfo[] = [];
    const { startYear, yearCount } =
      plannedRange ??
      (cycleEndTime
        ? this.getCycleCalendarYearRange(cycleStartTime, cycleEndTime)
        : { startYear: this.getBaziYearAt(cycleStartTime), yearCount: 10 });

    if (yearCount <= 0) {
      return liunianList;
    }

    for (let i = 0; i < yearCount; i++) {
      const currentYear = startYear + i;
      const age = this.getLiunianAge(currentYear, birthYear);
      const liunian = this.calculateLiunian(currentYear, dayMaster);
      const xiaoyun = startFortune
        ? this.getXiaoyunForAge(startFortune, age, dayMaster)
        : undefined;

      liunianList.push({
        year: currentYear,
        age,
        ganZhi: liunian.ganZhi,
        tenGod: liunian.tenGod,
        tenGodZhi: liunian.tenGodZhi,
        xiaoyun,
      });
    }
    return liunianList;
  }

  private getLiunianAge(currentYear: number, birthYear: number): number {
    // 沿用大运的公历年虚岁口径；立春前出生者的首段虽属上一干支年，仍从一岁起记。
    return Math.max(1, currentYear - birthYear + 1);
  }

  private getXiaoyunForAge(
    startFortune: FortuneInstance,
    age: number,
    dayMaster: string,
  ): XiaoyunInfo {
    const fortune = startFortune.next(age - startFortune.getAge());
    const ganZhi = fortune.getName();

    return {
      ganZhi,
      tenGod: getTenGod(ganZhi[0], dayMaster),
      tenGodZhi: getTenGodForBranch(ganZhi[1], dayMaster),
    };
  }

  private attachResolvedYears(cycles: LuckCycle[], startYears?: number[]) {
    cycles.forEach((cycle, index) => {
      const nextCycle = cycles[index + 1];
      const nextStartYear =
        startYears?.[index + 1] ??
        (nextCycle?.startSolarTime ? this.getBaziYearAt(nextCycle.startSolarTime) : undefined);

      cycle.resolvedYears =
        typeof nextStartYear === 'number'
          ? cycle.years.filter((item) => item.year < nextStartYear)
          : [...cycle.years];
    });
  }

  /**
   * 计算流年
   */
  private calculateLiunian(year: number, dayMaster: string) {
    const ganZhi = SixtyCycleYear.fromYear(year).getSixtyCycle().getName();
    const gan = ganZhi[0];
    const zhi = ganZhi[1];
    return {
      ganZhi,
      tenGod: getTenGod(gan, dayMaster),
      tenGodZhi: getTenGodForBranch(zhi, dayMaster),
    };
  }

  /**
   * 流年按立春换年，而大运的公开 year 字段仍保留交运时刻的公历年。
   * 交运落在立春前时，周期的第一段实际属于上一干支年，必须从该年生成
   * 流年，否则当前日期会落在大运时间范围内却没有可选流年。
   */
  private getBaziYearAt(time: SolarDateTimeInfo): number {
    const solarTime = SolarTime.fromYmdHms(
      time.year,
      time.month,
      time.day,
      time.hour,
      time.minute,
      time.second,
    );
    // SolarDateTimeInfo 精确到秒；将节气公开的整秒时刻视为交接边界，
    // 避免天文计算保留的亚秒数把“恰立春”误归到上一年。
    if (this.isLichunBoundary(time)) {
      return time.year;
    }
    const lichun = SolarTerm.fromIndex(time.year, 3).getJulianDay().getDay();
    return solarTime.getJulianDay().getDay() < lichun ? time.year - 1 : time.year;
  }

  /**
   * 获取交运信息
   * 根据起运月份推算交运时机
   */
  private getHandoverInfo(firstCycleStartTime: SolarDateTimeInfo): string {
    return `首运于公历 ${formatSolarDateTime(firstCycleStartTime, true)}（北京时间 UTC+8）交脱大运，此后每隔十年于该日前后换运`;
  }

  private hasPositiveSolarRange(
    cycleStartTime: SolarDateTimeInfo,
    cycleEndTime: SolarDateTimeInfo,
  ): boolean {
    return toNativeDate(cycleStartTime).getTime() < toNativeDate(cycleEndTime).getTime();
  }

  private getCycleCalendarYearRange(
    cycleStartTime: SolarDateTimeInfo,
    cycleEndTime: SolarDateTimeInfo,
  ): { startYear: number; yearCount: number } {
    const startYear = this.getBaziYearAt(cycleStartTime);
    if (!this.hasPositiveSolarRange(cycleStartTime, cycleEndTime)) {
      return { startYear, yearCount: 0 };
    }

    const endYear = this.getLastBaziYearInHalfOpenRange(cycleEndTime);
    return { startYear, yearCount: Math.max(endYear - startYear + 1, 0) };
  }

  private getLastBaziYearInHalfOpenRange(time: SolarDateTimeInfo): number {
    const endYear = this.getBaziYearAt(time);
    return this.isLichunBoundary(time) ? endYear - 1 : endYear;
  }

  private isLichunBoundary(time: SolarDateTimeInfo): boolean {
    const lichunTime = toSolarDateTimeInfo(
      SolarTerm.fromIndex(time.year, 3).getJulianDay().getSolarTime(),
    );
    return toNativeDate(time).getTime() === toNativeDate(lichunTime).getTime();
  }

  private getStartInfoText(
    startAge: number,
    startMonth: number,
    startDay: number,
    startHour: number,
    startMinute: number,
  ): string {
    const baseParts = [`出生后 ${startAge} 年 ${startMonth} 月 ${startDay} 天`];

    if (startHour > 0) {
      baseParts.push(`${startHour} 小时`);
    }

    if (startMinute > 0) {
      baseParts.push(`${startMinute} 分`);
    }

    baseParts.push(`起运（${CHILD_LIMIT_METHOD}）`);
    return baseParts.join(' ');
  }
}
