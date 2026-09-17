import { SolarTime, SolarTerm, ChildLimit, SixtyCycleYear } from 'tyme4ts';
import { assertHeavenlyStem, getTenGod, getTenGodForBranch } from './baziUtils';
import type { LuckInfo, LuckCycle, LiunianInfo, SolarDateTimeInfo, XiaoyunInfo } from './baziTypes';
import {
  formatSolarDateTime,
  shiftSolarDateTimeYears,
  toNativeDate,
  toSolarDateTimeInfo,
} from './luckTiming';
import { CHILD_LIMIT_METHOD, createChildLimit } from './childLimit';

type SolarTimeInstance = ReturnType<typeof SolarTime.fromYmdHms>;
type LuckGender = Parameters<typeof ChildLimit.fromSolarTime>[1];
type FortuneInstance = ReturnType<ReturnType<typeof ChildLimit.fromSolarTime>['getStartFortune']>;
type EightCharInstance = ReturnType<ReturnType<SolarTimeInstance['getLunarHour']>['getEightChar']>;

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
    assertHeavenlyStem(dayMaster, '日主');

    // 1. 计算童限 (起运前)
    const childLimit = createChildLimit(termSolarTime, gender, eightChar);
    const startAge = childLimit.getYearCount(); // 起运岁数
    const startMonth = childLimit.getMonthCount();
    const startDay = childLimit.getDayCount();
    const startHour = childLimit.getHourCount();
    const startMinute = childLimit.getMinuteCount();

    // 精确的起运时间 (公历)
    const limitSolarTime = childLimit.getEndTime();
    const birthSolarTime = toSolarDateTimeInfo(termSolarTime);
    const firstCycleStartTime = toSolarDateTimeInfo(limitSolarTime);

    const startInfoText = this.getStartInfoText(
      startAge,
      startMonth,
      startDay,
      startHour,
      startMinute,
    );
    const startFortune = childLimit.getStartFortune();

    // 2. 获取大运列表 (DecadeFortune)
    // tyme4ts 的 ChildLimit 提供了获取第一步大运的方法 getStartDecadeFortune()
    // 后续大运可以通过 next() 方法获取
    const decadeFortunes: Array<ReturnType<typeof childLimit.getStartDecadeFortune>> = [];
    let currentDecade = childLimit.getStartDecadeFortune();

    // 获取 12 步大运
    for (let i = 0; i < 12; i++) {
      decadeFortunes.push(currentDecade);
      currentDecade = currentDecade.next(1);
    }

    const cycles: LuckCycle[] = [];
    const birthYear = termSolarTime.getYear();

    // 3. 处理起运前的童限年份
    if (this.hasPositiveSolarRange(birthSolarTime, firstCycleStartTime)) {
      const preDayunYears = this.calculateLiunianForCycle(
        birthSolarTime,
        birthYear,
        dayMaster,
        firstCycleStartTime,
        startFortune,
      );

      if (preDayunYears.length > 0) {
        cycles.push({
          age: 1,
          year: birthYear,
          ganZhi: '小运', // 童限期统称
          isXiaoyun: true,
          type: '小运',
          startSolarTime: birthSolarTime,
          endSolarTime: firstCycleStartTime,
          years: preDayunYears,
        });
      }
    }

    // 4. 处理大运
    decadeFortunes.forEach((df, index) => {
      // 大运起始年份需要根据推算：出生年 + 起运岁数 + 10 * index
      // 注意：DecadeFortune.getStartAge() 返回的是岁数
      const startAgeDaYun = df.getStartAge();
      const cycleStartTime = shiftSolarDateTimeYears(firstCycleStartTime, index * 10);
      const cycleEndTime = shiftSolarDateTimeYears(firstCycleStartTime, (index + 1) * 10);
      const startYear = cycleStartTime.year;

      const ganZhi = df.getName();

      cycles.push({
        age: startAgeDaYun,
        year: startYear,
        ganZhi,
        isXiaoyun: false,
        type: '大运',
        startSolarTime: cycleStartTime,
        endSolarTime: cycleEndTime,
        years: [], // 稍后填充
      });
    });

    // 5. 填充大运流年
    cycles.forEach((cycle) => {
      if (!cycle.isXiaoyun) {
        cycle.years = this.calculateLiunianForCycle(
          cycle.startSolarTime ?? birthSolarTime,
          birthYear,
          dayMaster,
          cycle.endSolarTime,
          startFortune,
        );
      }
    });
    this.attachResolvedYears(cycles);

    const handoverInfoText = this.getHandoverInfo(firstCycleStartTime);

    return {
      startInfo: startInfoText,
      handoverInfo: handoverInfoText,
      cycles,
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
  ): LiunianInfo[] {
    const liunianList: LiunianInfo[] = [];
    const startYear = this.getBaziYearAt(cycleStartTime);
    const yearCount = cycleEndTime
      ? this.getCycleCalendarYearCount(cycleStartTime, cycleEndTime)
      : 10;

    if (yearCount <= 0) {
      return liunianList;
    }

    for (let i = 0; i < yearCount; i++) {
      const currentYear = startYear + i;
      const age = currentYear - birthYear + 1;
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

  private attachResolvedYears(cycles: LuckCycle[]) {
    cycles.forEach((cycle, index) => {
      const nextCycle = cycles[index + 1];
      const nextStartYear = nextCycle?.startSolarTime
        ? this.getBaziYearAt(nextCycle.startSolarTime)
        : undefined;

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

  private getCycleCalendarYearCount(
    cycleStartTime: SolarDateTimeInfo,
    cycleEndTime: SolarDateTimeInfo,
  ): number {
    if (!this.hasPositiveSolarRange(cycleStartTime, cycleEndTime)) {
      return 0;
    }

    const startYear = this.getBaziYearAt(cycleStartTime);
    const endYear = this.getLastBaziYearInHalfOpenRange(cycleEndTime);
    return Math.max(endYear - startYear + 1, 0);
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
