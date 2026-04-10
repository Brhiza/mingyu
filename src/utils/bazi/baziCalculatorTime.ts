import { SolarTerm, SolarTime } from 'tyme4ts'
import { MONTH_COMMANDER } from './baziDefinitions'
import { getTenGod, getTenGodForBranch } from './baziUtils'
import type { BaziChartResult, SeasonInfo, ShenShaResult } from './baziTypes'

type SolarTermInstance = ReturnType<typeof SolarTerm.fromIndex>
type SolarTimeInstance = ReturnType<typeof SolarTime.fromYmdHms>

export interface LiuyueInfo {
  month: number;
  gan: string;
  zhi: string;
  ganZhi: string;
  tenGod: string;
  tenGodZhi: string;
  startDate: string;
  endDate: string;
  jieqi: { name: string; date: string }[];
}

export interface LiuriInfo {
  date: string;
  year: number;
  month: number;
  day: number;
  gan: string;
  zhi: string;
  ganZhi: string;
  tenGod: string;
  tenGodZhi: string;
}

function createUtcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day))
}

function formatUtcDate(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateKey(dateKey: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateKey.split('-').map(Number)
  return { year, month, day }
}

function subtractOneDay(dateKey: string): string {
  const { year, month, day } = parseDateKey(dateKey)
  const date = createUtcDate(year, month, day)
  date.setUTCDate(date.getUTCDate() - 1)
  return formatUtcDate(date)
}

function getNextMonth(year: number, month: number): { year: number; month: number } {
  if (month === 12) {
    return { year: year + 1, month: 1 }
  }

  return { year, month: month + 1 }
}

function collectSolarTermsInMonth(year: number, month: number): Array<{
  term: SolarTermInstance;
  solarTime: SolarTimeInstance;
  date: string;
}> {
  const terms: Array<{
    term: SolarTermInstance;
    solarTime: SolarTimeInstance;
    date: string;
  }> = []

  for (const scanYear of [year - 1, year, year + 1]) {
    for (let i = 0; i < 24; i++) {
      const term = SolarTerm.fromIndex(scanYear, i)
      const solarTime = term.getJulianDay().getSolarTime()
      const solarDay = solarTime.getSolarDay()

      if (solarDay.getYear() === year && solarDay.getMonth() === month) {
        terms.push({
          term,
          solarTime,
          date: `${solarDay.getYear()}-${solarDay.getMonth().toString().padStart(2, '0')}-${solarDay.getDay().toString().padStart(2, '0')}`
        })
      }
    }
  }

  return terms.sort((left, right) => left.solarTime.getJulianDay().getDay() - right.solarTime.getJulianDay().getDay())
}

export function calculateLiuyue(year: number, month: number, dayMaster: string): LiuyueInfo {
  const solarTermsInMonth = collectSolarTermsInMonth(year, month)
  const firstJie = solarTermsInMonth.find(({ term }) => term.isJie())
  const nextMonth = getNextMonth(year, month)
  const nextMonthTerms = collectSolarTermsInMonth(nextMonth.year, nextMonth.month)
  const nextJie = nextMonthTerms.find(({ term }) => term.isJie())
  const solarTime = firstJie?.solarTime ?? SolarTime.fromYmdHms(year, month, 15, 12, 0, 0)
  const monthColumn = solarTime.getLunarHour().getEightChar().getMonth()
  const gan = monthColumn.getHeavenStem().getName()
  const zhi = monthColumn.getEarthBranch().getName()
  const startDate = firstJie?.date ?? `${year}-${String(month).padStart(2, '0')}-01`
  const endDate = nextJie
    ? subtractOneDay(nextJie.date)
    : `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate().toString().padStart(2, '0')}`

  return {
    month,
    gan,
    zhi,
    ganZhi: `${gan}${zhi}`,
    tenGod: getTenGod(gan, dayMaster),
    tenGodZhi: getTenGodForBranch(zhi, dayMaster),
    startDate,
    endDate,
    jieqi: solarTermsInMonth.map(({ term, date }) => ({
      name: term.getName(),
      date
    }))
  }
}

export function calculateLiuri(year: number, month: number, day: number, dayMaster: string): LiuriInfo {
  const solarTime = SolarTime.fromYmdHms(year, month, day, 0, 0, 0)
  const dayPillar = solarTime.getLunarHour().getEightChar().getDay()
  const gan = dayPillar.getHeavenStem().getName()
  const zhi = dayPillar.getEarthBranch().getName()

  return {
    date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    year,
    month,
    day,
    gan,
    zhi,
    ganZhi: `${gan}${zhi}`,
    tenGod: getTenGod(gan, dayMaster),
    tenGodZhi: getTenGodForBranch(zhi, dayMaster)
  }
}

export function calculateLiuriRange(startDate: string, endDate: string, dayMaster: string): LiuriInfo[] {
  const start = parseDateKey(startDate)
  const end = parseDateKey(endDate)
  const currentDate = createUtcDate(start.year, start.month, start.day)
  const endDateUtc = createUtcDate(end.year, end.month, end.day)
  const result: LiuriInfo[] = []

  while (currentDate.getTime() <= endDateUtc.getTime()) {
    result.push(calculateLiuri(
      currentDate.getUTCFullYear(),
      currentDate.getUTCMonth() + 1,
      currentDate.getUTCDate(),
      dayMaster
    ))
    currentDate.setUTCDate(currentDate.getUTCDate() + 1)
  }

  return result
}

export function getMonthCommander(solarTime: SolarTimeInstance, monthBranch: string): string {
  const commanders = MONTH_COMMANDER[monthBranch]
  if (!commanders) return '未知'

  try {
    const birthYear = solarTime.getSolarDay().getYear()
    const birthTime = solarTime.getJulianDay()
    let jieBefore: SolarTermInstance | null = null
    const terms: SolarTermInstance[] = []

    for (let i = 0; i < 24; i++) {
      terms.push(SolarTerm.fromIndex(birthYear, i))
      terms.push(SolarTerm.fromIndex(birthYear - 1, i))
    }

    for (const term of terms) {
      if (term.isJie() && term.getJulianDay().getDay() <= birthTime.getDay()) {
        if (!jieBefore || term.getJulianDay().getDay() > jieBefore.getJulianDay().getDay()) {
          jieBefore = term
        }
      }
    }

    if (!jieBefore) {
      return '未知(节气未找到)'
    }

    const daysSinceJie = birthTime.getDay() - jieBefore.getJulianDay().getDay()
    let accumulatedDays = 0

    for (const commander of commanders) {
      accumulatedDays += commander[1]
      if (daysSinceJie < accumulatedDays) {
        return commander[0]
      }
    }

    return commanders[commanders.length - 1][0]
  } catch {
    return '计算出错'
  }
}

export function calculateSeasonInfo(solarTime: SolarTimeInstance): SeasonInfo {
  try {
    const solarTerms: { name: string; date: string; jd: number; index: number; isJie: boolean }[] = []
    const scanTerms: { name: string; date: string; jd: number; index: number; isJie: boolean }[] = []
    const currentYear = solarTime.getSolarDay().getYear()
    const birthJulianDay = solarTime.getJulianDay()

    for (let i = 0; i < 24; i++) {
      const term = SolarTerm.fromIndex(currentYear, i)
      const julianDay = term.getJulianDay()
      const solarDay = julianDay.getSolarDay()

      solarTerms.push({
        name: term.getName(),
        date: `${solarDay.getYear()}-${solarDay.getMonth().toString().padStart(2, '0')}-${solarDay.getDay().toString().padStart(2, '0')}`,
        jd: julianDay.getDay(),
        index: i,
        isJie: term.isJie()
      })
    }

    for (const scanYear of [currentYear - 1, currentYear, currentYear + 1]) {
      for (let i = 0; i < 24; i++) {
        const term = SolarTerm.fromIndex(scanYear, i)
        const julianDay = term.getJulianDay()
        const solarDay = julianDay.getSolarDay()

        scanTerms.push({
          name: term.getName(),
          date: `${solarDay.getYear()}-${solarDay.getMonth().toString().padStart(2, '0')}-${solarDay.getDay().toString().padStart(2, '0')}`,
          jd: julianDay.getDay(),
          index: i,
          isJie: term.isJie()
        })
      }
    }

    const orderedTerms = Array.from(
      new Map(
        scanTerms
          .sort((left, right) => left.jd - right.jd)
          .map(term => [`${term.name}-${term.date}`, term] as const)
      ).values()
    )

    let prevTerm: { name: string; date: string; jd: number; index: number; isJie: boolean } | null = null
    let nextTerm: { name: string; date: string; jd: number; index: number; isJie: boolean } | null = null

    for (const term of orderedTerms) {
      if (term.jd <= birthJulianDay.getDay()) {
        prevTerm = term
      } else {
        nextTerm = term
        break
      }
    }

    const daysSincePrev = prevTerm ? Math.floor(birthJulianDay.getDay() - prevTerm.jd) : 0
    const daysToNext = nextTerm ? Math.floor(nextTerm.jd - birthJulianDay.getDay()) : 0

    const seasonIndexMap: Record<number, string> = {
      0: '冬', 1: '冬',
      2: '春', 3: '春', 4: '春', 5: '春', 6: '春', 7: '春',
      8: '夏', 9: '夏', 10: '夏', 11: '夏', 12: '夏', 13: '夏',
      14: '秋', 15: '秋', 16: '秋', 17: '秋', 18: '秋', 19: '秋',
      20: '冬', 21: '冬', 22: '冬', 23: '冬'
    }

    return {
      currentJieqi: prevTerm ? prevTerm.name : '未知',
      nextJieqi: nextTerm ? nextTerm.name : '未知',
      daysSincePrev,
      daysToNext,
      currentSeason: prevTerm ? seasonIndexMap[prevTerm.index] : '未知',
      jieqiList: solarTerms.map(term => ({ name: term.name, date: term.date }))
    }
  } catch {
    return {
      currentJieqi: '计算错误',
      nextJieqi: '计算错误',
      daysSincePrev: 0,
      daysToNext: 0,
      currentSeason: '未知',
      jieqiList: []
    }
  }
}

export function getCategorizedYearShenSha(
  yearData: { ganZhi?: string },
  baziResult: BaziChartResult,
  calculateAllShenSha: (baziArray: [string, string][], gender: string) => ShenShaResult,
  getShenShaType: (shensha: string) => '吉' | '凶' | '中性'
): { lucky: string[]; unlucky: string[]; neutral: string[] } {
  if (!yearData?.ganZhi || !baziResult?.pillars) {
    return { lucky: [], unlucky: [], neutral: [] }
  }

  try {
    const baziArray: [string, string][] = [
      [yearData.ganZhi[0], yearData.ganZhi[1]],
      [baziResult.pillars.month.gan, baziResult.pillars.month.zhi],
      [baziResult.pillars.day.gan, baziResult.pillars.day.zhi],
      [baziResult.pillars.hour.gan, baziResult.pillars.hour.zhi]
    ]
    const shenShaResult = calculateAllShenSha(baziArray, baziResult.gender)
    const yearShenSha = [...(shenShaResult.global || []), ...(shenShaResult.year || [])]

    return {
      lucky: yearShenSha.filter((shensha) => getShenShaType(shensha) === '吉'),
      unlucky: yearShenSha.filter((shensha) => getShenShaType(shensha) === '凶'),
      neutral: yearShenSha.filter((shensha) => getShenShaType(shensha) === '中性')
    }
  } catch {
    return { lucky: [], unlucky: [], neutral: [] }
  }
}
