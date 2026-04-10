import { SolarTime, SolarTerm } from 'tyme4ts'

type SolarTermInstance = ReturnType<typeof SolarTerm.fromIndex>

export interface CalendarInfo {
  solarDate: string;
  lunarDate: string;
  ganZhi: {
    year: string;
    month: string;
    day: string;
    hour: string;
  };
  jieQi: {
    prev: string;
    next: string;
  };
  festival: string;
}

/**
 * 获取指定日期的日历信息（公历、农历、干支、节气）
 * @param date Date对象
 * @returns 详细日历信息
 */
export function getCalendarInfo(date: Date = new Date()): CalendarInfo {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()

  // 使用 SolarTime 作为入口
  const solarTime = SolarTime.fromYmdHms(year, month, day, hour, 0, 0)
  const lunarHour = solarTime.getLunarHour()
  const lunarDay = lunarHour.getLunarDay()
  const lunarMonth = lunarDay.getLunarMonth()
  const lunarYear = lunarMonth.getLunarYear()

  // 获取四柱
  const eightChar = lunarHour.getEightChar()
  const yearPillar = eightChar.getYear().getName()
  const monthPillar = eightChar.getMonth().getName()
  const dayPillar = eightChar.getDay().getName()
  const hourPillar = eightChar.getHour().getName()

  // 获取节气 (通过遍历查找最近的)
  // tyme4ts 的 SolarTerm.fromIndex 可以遍历节气
  let prevJieQiName = '未知'
  let nextJieQiName = '未知'
  let prevJieQiDate = ''
  let nextJieQiDate = ''

  const currentYear = year
  const terms: SolarTermInstance[] = []
  // 扫描当年所有节气
  for (let i = 0; i < 24; i++) {
    terms.push(SolarTerm.fromIndex(currentYear, i))
  }

  // 简单的查找逻辑
  const currentJd = solarTime.getJulianDay().getDay()
  let minDiffPrev = 999
  let minDiffNext = 999

  for (const term of terms) {
    const termJd = term.getJulianDay().getDay()
    const diff = termJd - currentJd

    if (diff <= 0) { // 之前的节气
      if (Math.abs(diff) < minDiffPrev) {
        minDiffPrev = Math.abs(diff)
        prevJieQiName = term.getName()
        const sd = term.getJulianDay().getSolarDay()
        prevJieQiDate = `${sd.getYear()}-${sd.getMonth()}-${sd.getDay()}`
      }
    } else { // 之后的节气
      if (diff < minDiffNext) {
        minDiffNext = diff
        nextJieQiName = term.getName()
        const sd = term.getJulianDay().getSolarDay()
        nextJieQiDate = `${sd.getYear()}-${sd.getMonth()}-${sd.getDay()}`
      }
    }
  }

  return {
    solarDate: `${year}年${month}月${day}日 ${hour}时`,
    lunarDate: `${lunarYear.getYear()}年${lunarMonth.getName()}月${lunarDay.getName()}`,
    ganZhi: {
      year: yearPillar,
      month: monthPillar,
      day: dayPillar,
      hour: hourPillar
    },
    jieQi: {
      prev: `${prevJieQiName} (${prevJieQiDate})`,
      next: `${nextJieQiName} (${nextJieQiDate})`
    },
    festival: ''
  }
}

/**
 * 获取当前时间的“天时”描述，供AI参考
 */
export function getCurrentTimeDescription(): string {
  const info = getCalendarInfo()
  return [
    '【当前时令】',
    `公历：${info.solarDate}`,
    `农历：${info.lunarDate}`,
    `四柱：${info.ganZhi.year}年 ${info.ganZhi.month}月 ${info.ganZhi.day}日 ${info.ganZhi.hour}时`,
    `节气：${info.jieQi.prev} 至 ${info.jieQi.next}`
  ].join('\n')
}

/**
 * 获取指定年份的12个节气月干支
 * @param year 公历年份
 * @returns 12个月的列表，包含月份名称（如"寅月"）和干支（如"丙寅"）
 */
export function getYearMonthsGanZhi(year: number): { month: string; ganZhi: string }[] {
  const list: { month: string; ganZhi: string }[] = []

  // 八字月份从立春开始。
  // tyme4ts SolarTerm 索引：3=立春, 5=惊蛰 ... 25=次年小寒
  // 我们依次获取这12个节令，代表12个八字月份的开始
  for (let i = 3; i <= 25; i += 2) {
    const term = SolarTerm.fromIndex(year, i)

    // 获取节气交接时刻的“第二天中午12点”，以确保稳定进入该月
    // 避免因为交节在深夜导致的临界点计算差异
    const jd = term.getJulianDay()
    const solarDay = jd.getSolarDay()

    // 简单处理：构造一个新的 Date 对象，日期设为节气日+2天
    const safeDate = new Date(solarDay.getYear(), solarDay.getMonth() - 1, solarDay.getDay() + 2, 12, 0, 0)

    const solarTime = SolarTime.fromYmdHms(
      safeDate.getFullYear(),
      safeDate.getMonth() + 1,
      safeDate.getDate(),
      12, 0, 0
    )

    const eightChar = solarTime.getLunarHour().getEightChar()
    const monthGZ = eightChar.getMonth().getName()
    const zhi = eightChar.getMonth().getEarthBranch().getName()

    // 修正月份名称，使用地支名更直观 (寅月、卯月...)
    list.push({
      month: `${zhi}月`,
      ganZhi: monthGZ
    })
  }
  return list
}

/**
 * 获取指定年份的详细信息
 * @param year 公历年份
 * @returns 包含年柱、生肖、流月列表
 */
export function getYearInfo(year: number): { year: number; yearGanZhi: string; zodiac: string; months: { month: string; ganZhi: string }[] } {
  // 获取该年年中某一天（如6月15日）来确定年柱，确保在立春之后
  const midYear = SolarTime.fromYmdHms(year, 6, 15, 12, 0, 0)
  const eightChar = midYear.getLunarHour().getEightChar()
  const yearGanZhi = eightChar.getYear().getName()

  // 通过年支推算生肖
  const yearZhi = eightChar.getYear().getEarthBranch().getName()
  const zodiacMap: Record<string, string> = {
    '子': '鼠', '丑': '牛', '寅': '虎', '卯': '兔',
    '辰': '龙', '巳': '蛇', '午': '马', '未': '羊',
    '申': '猴', '酉': '鸡', '戌': '狗', '亥': '猪'
  }
  const zodiac = zodiacMap[yearZhi] || ''

  // 获取流月
  const months = getYearMonthsGanZhi(year)

  return {
    year,
    yearGanZhi,
    zodiac,
    months
  }
}

/**
 * 获取指定公历月份的每日详细信息
 * @param year 公历年
 * @param month 公历月 (1-12)
 * @returns 每日信息列表
 */
export function getMonthDaysInfo(year: number, month: number): { day: number; ganZhi: string; lunar: string; term?: string }[] {
  const list: { day: number; ganZhi: string; lunar: string; term?: string }[] = []

  // 获取当月天数
  const daysInMonth = new Date(year, month, 0).getDate()

  for (let d = 1; d <= daysInMonth; d++) {
    const solarTime = SolarTime.fromYmdHms(year, month, d, 12, 0, 0)
    const lunarHour = solarTime.getLunarHour()
    const lunarDay = lunarHour.getLunarDay()

    // 获取流日干支
    const dayGZ = lunarHour.getEightChar().getDay().getName()

    // 检查是否有节气
    let termName = ''
    // 简单检查当天是否是节气日
    // 这里使用简化的逻辑：遍历全年的节气看是否命中当天
    // 优化：实际项目中应该有更高效的查找方式，但在客户端计算量可接受
    const terms = []
    for(let i=0; i<24; i++) terms.push(SolarTerm.fromIndex(year, i))

    const currentJd = solarTime.getJulianDay().getDay()
    // 允许一定的误差范围，或者只匹配整数部分
    const todayTerm = terms.find(t => Math.floor(t.getJulianDay().getDay()) === Math.floor(currentJd))
    if (todayTerm) {
      termName = todayTerm.getName()
    }

    list.push({
      day: d,
      ganZhi: dayGZ,
      lunar: `${lunarDay.getLunarMonth().getMonth()}月${lunarDay.getName()}`,
      term: termName
    })
  }

  return list
}
