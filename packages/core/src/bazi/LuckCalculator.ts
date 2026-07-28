import { SolarTime, ChildLimit } from 'tyme4ts';
import { assertHeavenlyStem, getTenGod, getTenGodForBranch } from './baziUtils';
import type { LuckInfo, LuckCycle, LiunianInfo, SolarDateTimeInfo, XiaoyunInfo } from './baziTypes';
import { formatSolarDateTime, shiftSolarDateTimeYears, toSolarDateTimeInfo } from './luckTiming';
import { CHILD_LIMIT_METHOD, createChildLimit } from './childLimit';

type SolarTimeInstance = ReturnType<typeof SolarTime.fromYmdHms>;
type LuckGender = Parameters<typeof ChildLimit.fromSolarTime>[1];
type FortuneInstance = ReturnType<ReturnType<typeof ChildLimit.fromSolarTime>['getStartFortune']>;

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
  ): LuckInfo {
    assertHeavenlyStem(dayMaster, '日主');

    // 1. 计算童限 (起运前)
    const childLimit = createChildLimit(solarTime, gender);
    const startAge = childLimit.getYearCount(); // 起运岁数
    const startMonth = childLimit.getMonthCount();
    const startDay = childLimit.getDayCount();
    const startHour = childLimit.getHourCount();
    const startMinute = childLimit.getMinuteCount();

    // 精确的起运时间 (公历)
    const limitSolarTime = childLimit.getEndTime();
    const birthSolarTime = toSolarDateTimeInfo(solarTime);
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
    const birthYear = solarTime.getYear();

    // 3. 处理起运前的童限年份
    if (startAge >= 1 || this.shouldIncludeBoundaryYear(firstCycleStartTime)) {
      const preDayunYears = this.calculateLiunianForCycle(
        birthYear,
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
          cycle.year, // 大运开始年份
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
    startYear: number,
    birthYear: number,
    dayMaster: string,
    cycleEndTime?: SolarDateTimeInfo,
    startFortune?: FortuneInstance,
  ): LiunianInfo[] {
    const liunianList: LiunianInfo[] = [];
    const yearCount = cycleEndTime ? this.getCycleCalendarYearCount(startYear, cycleEndTime) : 10;

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
      const nextStartYear = nextCycle?.year;

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
    // 使用年中(6月)计算该年干支，避免年初年末边界问题
    const solarTime = SolarTime.fromYmdHms(year, 6, 1, 0, 0, 0);
    const yearPillar = solarTime.getLunarHour().getEightChar().getYear();
    const gan = yearPillar.getHeavenStem().getName();
    const zhi = yearPillar.getEarthBranch().getName();
    return {
      ganZhi: `${gan}${zhi}`,
      tenGod: getTenGod(gan, dayMaster),
      tenGodZhi: getTenGodForBranch(zhi, dayMaster),
    };
  }

  /**
   * 获取交运信息
   * 根据起运月份推算交运时机
   */
  private getHandoverInfo(firstCycleStartTime: SolarDateTimeInfo): string {
    return `首运于公历 ${formatSolarDateTime(firstCycleStartTime, true)} 交脱大运，此后每隔十年于该日前后换运`;
  }

  private shouldIncludeBoundaryYear(cycleEndTime: SolarDateTimeInfo): boolean {
    return (
      cycleEndTime.month !== 1 ||
      cycleEndTime.day !== 1 ||
      cycleEndTime.hour !== 0 ||
      cycleEndTime.minute !== 0 ||
      cycleEndTime.second !== 0
    );
  }

  private getCycleCalendarYearCount(startYear: number, cycleEndTime: SolarDateTimeInfo): number {
    const baseCount = cycleEndTime.year - startYear;
    return Math.max(baseCount + (this.shouldIncludeBoundaryYear(cycleEndTime) ? 1 : 0), 1);
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
