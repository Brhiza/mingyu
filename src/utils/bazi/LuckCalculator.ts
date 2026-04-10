import { SolarTime, Gender, ChildLimit } from 'tyme4ts'
import { BASIC_MAPPINGS } from './baziDefinitions'
import { getTenGod, getTenGodForBranch } from './baziUtils'
import type { LuckInfo, LuckCycle, LiunianInfo, SolarDateTimeInfo } from './baziTypes'
import { formatSolarDateTime, shiftSolarDateTimeYears, toSolarDateTimeInfo } from './luckTiming'

type SolarTimeInstance = ReturnType<typeof SolarTime.fromYmdHms>
type LuckGender = Parameters<typeof ChildLimit.fromSolarTime>[1]

/**
 * 专注于大运、小运、流年等运势计算的工具类
 *
 * 2023-12-02 更新：利用 tyme4ts 提供的 ChildLimit(童限)、DecadeFortune(大运) 类，
 * 并手动实现小运逻辑（tyme4ts未导出XiaoYun类），以获得精确的起运时间和运程排布。
 */
export class LuckCalculator {
  /**
   * 主计算函数：计算大运、小运和所有关联的流年信息
   */
  public calculateLuckInfo(solarTime: SolarTimeInstance, gender: LuckGender, hourGanZhi: string, yearGan: string, dayMaster: string): LuckInfo {
    try {
      // 1. 计算童限 (起运前)
      const childLimit = ChildLimit.fromSolarTime(solarTime, gender)
      const startAge = childLimit.getYearCount() // 起运岁数
      const startMonth = childLimit.getMonthCount()
      const startDay = childLimit.getDayCount()
      const startHour = childLimit.getHourCount()
      const startMinute = childLimit.getMinuteCount()

      // 精确的起运时间 (公历)
      const limitSolarTime = childLimit.getEndTime()
      const birthSolarTime = toSolarDateTimeInfo(solarTime)
      const firstCycleStartTime = toSolarDateTimeInfo(limitSolarTime)

      const startInfoText = this.getStartInfoText(startAge, startMonth, startDay, startHour, startMinute)

      // 2. 获取大运列表 (DecadeFortune)
      // tyme4ts 的 ChildLimit 提供了获取第一步大运的方法 getStartDecadeFortune()
      // 后续大运可以通过 next() 方法获取
      const decadeFortunes: Array<ReturnType<typeof childLimit.getStartDecadeFortune>> = []
      let currentDecade = childLimit.getStartDecadeFortune()

      // 获取 12 步大运
      for (let i = 0; i < 12; i++) {
        decadeFortunes.push(currentDecade)
        currentDecade = currentDecade.next(1)
      }

      const cycles: LuckCycle[] = []
      const birthYear = solarTime.getYear()

      // 3. 计算童限/小运 (起运前)
      // 手动计算小运：以时柱为基准
      // 阳男阴女顺推，阴男阳女逆推
      const sixtyCycle = BASIC_MAPPINGS.SIXTY_CYCLE
      const hourIndex = sixtyCycle.indexOf(hourGanZhi)

      // 判断年干阴阳
      const yearGanIndex = (BASIC_MAPPINGS.HEAVENLY_STEMS as readonly string[]).indexOf(yearGan)
      const isYangYear = yearGanIndex % 2 === 0
      const isMale = gender === Gender.MAN
      // 小运顺逆规则与大运相同：阳男阴女顺，阴男阳女逆
      const isForward = (isYangYear && isMale) || (!isYangYear && !isMale)

      // 处理起运前的小运
      if (startAge >= 1 || this.shouldIncludeBoundaryYear(firstCycleStartTime)) {
        const preDayunYears = this.calculateLiunianForCycle(
          birthYear,
          birthYear,
          isForward,
          hourIndex,
          dayMaster,
          firstCycleStartTime
        )

        if (preDayunYears.length > 0) {
          cycles.push({
            age: 1,
            year: birthYear,
            ganZhi: '小运', // 童限期统称
            isXiaoyun: true,
            type: '小运',
            startSolarTime: birthSolarTime,
            endSolarTime: firstCycleStartTime,
            years: preDayunYears
          })
        }
      }

      // 4. 处理大运
      decadeFortunes.forEach((df, index) => {
        // 大运起始年份需要根据推算：出生年 + 起运岁数 + 10 * index
        // 注意：DecadeFortune.getStartAge() 返回的是岁数
        const startAgeDaYun = df.getStartAge()
        const cycleStartTime = shiftSolarDateTimeYears(firstCycleStartTime, index * 10)
        const cycleEndTime = shiftSolarDateTimeYears(firstCycleStartTime, (index + 1) * 10)
        const startYear = cycleStartTime.year

        const ganZhi = df.getName()

        cycles.push({
          age: startAgeDaYun,
          year: startYear,
          ganZhi,
          isXiaoyun: false,
          type: '大运',
          startSolarTime: cycleStartTime,
          endSolarTime: cycleEndTime,
          years: [] // 稍后填充
        })
      })

      // 5. 填充大运流年
      cycles.forEach(cycle => {
        if (!cycle.isXiaoyun) {
          cycle.years = this.calculateLiunianForCycle(
            cycle.year, // 大运开始年份
            birthYear,
            isForward,
            hourIndex,
            dayMaster,
            cycle.endSolarTime
          )
        }
      })

      const handoverInfoText = this.getHandoverInfo(firstCycleStartTime)

      return {
        startInfo: startInfoText,
        handoverInfo: handoverInfoText,
        cycles
      }
    } catch {
      return { startInfo: '计算失败', handoverInfo: '计算失败', cycles: [] }
    }
  }

  /**
   * 为单个大运周期（10年）计算所有流年信息
   */
  private calculateLiunianForCycle(
    startYear: number,
    birthYear: number,
    isForward: boolean,
    hourIndex: number,
    dayMaster: string,
    cycleEndTime?: SolarDateTimeInfo
  ): LiunianInfo[] {
    const liunianList: LiunianInfo[] = []
    const sixtyCycle = BASIC_MAPPINGS.SIXTY_CYCLE
    const yearCount = cycleEndTime
      ? this.getCycleCalendarYearCount(startYear, cycleEndTime)
      : 10

    for (let i = 0; i < yearCount; i++) {
      const currentYear = startYear + i
      const age = currentYear - birthYear + 1

      // 计算小运
      let xiaoyunIndex
      if (isForward) {
        xiaoyunIndex = (hourIndex + age) % 60
      } else {
        xiaoyunIndex = (hourIndex - age) % 60
        if (xiaoyunIndex < 0) xiaoyunIndex += 60
      }
      const xiaoyunGanZhi = sixtyCycle[xiaoyunIndex]

      const liunian = this.calculateLiunian(currentYear, dayMaster)

      liunianList.push({
        year: currentYear,
        age,
        ganZhi: liunian.ganZhi,
        tenGod: liunian.tenGod,
        tenGodZhi: liunian.tenGodZhi,
        xiaoyun: {
          ganZhi: xiaoyunGanZhi,
          tenGod: getTenGod(xiaoyunGanZhi[0], dayMaster),
          tenGodZhi: getTenGodForBranch(xiaoyunGanZhi[1], dayMaster)
        }
      })
    }
    return liunianList
  }

  /**
   * 计算流年
   */
  private calculateLiunian(year: number, dayMaster: string) {
    try {
      // 使用年中(6月)计算该年干支，避免年初年末边界问题
      const solarTime = SolarTime.fromYmdHms(year, 6, 1, 0, 0, 0)
      const yearPillar = solarTime.getLunarHour().getEightChar().getYear()
      const gan = yearPillar.getHeavenStem().getName()
      const zhi = yearPillar.getEarthBranch().getName()
      return {
        ganZhi: `${gan}${zhi}`,
        tenGod: getTenGod(gan, dayMaster),
        tenGodZhi: getTenGodForBranch(zhi, dayMaster)
      }
    } catch (error) {
      const ganIndex = (year - 4) % 10
      const zhiIndex = (year - 4) % 12
      const gan = BASIC_MAPPINGS.HEAVENLY_STEMS[ganIndex]
      const zhi = BASIC_MAPPINGS.EARTHLY_BRANCHES[zhiIndex]
      return {
        ganZhi: `${gan}${zhi}`,
        tenGod: getTenGod(gan, dayMaster),
        tenGodZhi: getTenGodForBranch(zhi, dayMaster)
      }
    }
  }

  /**
   * 获取交运信息
   * 根据起运月份推算交运时机
   */
  private getHandoverInfo(firstCycleStartTime: SolarDateTimeInfo): string {
    return `首运于公历 ${formatSolarDateTime(firstCycleStartTime, true)} 交脱大运，此后每隔十年于该日前后换运`
  }

  private shouldIncludeBoundaryYear(cycleEndTime: SolarDateTimeInfo): boolean {
    return cycleEndTime.month !== 1 ||
      cycleEndTime.day !== 1 ||
      cycleEndTime.hour !== 0 ||
      cycleEndTime.minute !== 0 ||
      cycleEndTime.second !== 0
  }

  private getCycleCalendarYearCount(startYear: number, cycleEndTime: SolarDateTimeInfo): number {
    const baseCount = cycleEndTime.year - startYear
    return Math.max(baseCount + (this.shouldIncludeBoundaryYear(cycleEndTime) ? 1 : 0), 1)
  }

  private getStartInfoText(startAge: number, startMonth: number, startDay: number, startHour: number, startMinute: number): string {
    const baseParts = [`出生后 ${startAge} 年 ${startMonth} 月 ${startDay} 天`]

    if (startHour > 0) {
      baseParts.push(`${startHour} 小时`)
    }

    if (startMinute > 0) {
      baseParts.push(`${startMinute} 分`)
    }

    baseParts.push('起运')
    return baseParts.join(' ')
  }
}
