import { BASIC_MAPPINGS } from './baziDefinitions'
import type {
  DayMasterStrengthAnalysis,
  HiddenStems,
  Pillars,
  RootAnalysis,
  SupportAnalysis,
  Wuxing
} from './baziTypes'

export interface SeasonalStatusAnalysis {
  isTimely: boolean;
}

type GetWuxingFn = (ganOrZhi: string) => Wuxing
type GetSeasonStatusFn = (zhi: string) => Record<string, string>

export function analyzeRoot(dayMaster: string, pillars: Pillars, hiddenStems: HiddenStems, getWuxing: GetWuxingFn): RootAnalysis {
  const roots: { position: string; branch: string; strength: number }[] = []
  let totalStrength = 0
  const dayMasterWuxing = getWuxing(dayMaster)

  Object.entries(pillars).forEach(([position, pillar]) => {
    const branchWuxing = getWuxing(pillar.zhi)
    const hasMainQiRoot = branchWuxing === dayMasterWuxing
    if (branchWuxing === dayMasterWuxing) {
      roots.push({ position, branch: pillar.zhi, strength: 2 })
      totalStrength += 2
    }
    hiddenStems[position as keyof HiddenStems].forEach((stem, index) => {
      if (hasMainQiRoot && index === 0) {
        return
      }
      if (getWuxing(stem) === dayMasterWuxing) {
        roots.push({ position, branch: `${pillar.zhi}(${stem})`, strength: 1 })
        totalStrength += 1
      }
    })
  })

  return {
    roots,
    totalStrength,
    hasRoot: roots.length > 0,
    strongRoot: totalStrength >= 3
  }
}

export function analyzeSupport(dayMaster: string, pillars: Pillars, getWuxing: GetWuxingFn): SupportAnalysis {
  const supporters: { position: string; stem: string; strength: number }[] = []
  let totalStrength = 0
  const dayMasterWuxing = getWuxing(dayMaster)
  const generatingElement = Object.entries(BASIC_MAPPINGS.WUXING_SHENG)
    .find(([, target]) => target === dayMasterWuxing)?.[0] as Wuxing | undefined

  Object.entries(pillars).forEach(([position, pillar]) => {
    if (position === 'day') {
      return
    }

    const stemWuxing = getWuxing(pillar.gan)
    const isCompanion = stemWuxing === dayMasterWuxing
    const isResource = generatingElement ? stemWuxing === generatingElement : false

    if (isCompanion || isResource) {
      supporters.push({ position, stem: pillar.gan, strength: 1 })
      totalStrength += 1
    }
  })

  return {
    supporters,
    totalStrength,
    hasSupport: supporters.length > 0
  }
}

export function analyzeSeasonalStatus(dayMaster: string, monthBranch: string, getSeasonStatus: GetSeasonStatusFn, getWuxing: GetWuxingFn): SeasonalStatusAnalysis {
  const season = getSeasonStatus(monthBranch)
  const dayMasterWuxing = getWuxing(dayMaster)
  const seasonStatus = season[dayMasterWuxing as string]

  return {
    isTimely: seasonStatus === '旺' || seasonStatus === '相'
  }
}

export function analyzeDayMasterStrength(
  seasonalStatus: SeasonalStatusAnalysis,
  rootAnalysis: RootAnalysis,
  supportAnalysis: SupportAnalysis
): DayMasterStrengthAnalysis {
  let score = 0
  if (seasonalStatus.isTimely) score += 5
  score += rootAnalysis.totalStrength
  score += supportAnalysis.totalStrength

  let status = '中和'
  if (score >= 7) status = '身强'
  if (score <= 3) status = '身弱'
  if (rootAnalysis.strongRoot && seasonalStatus.isTimely) status = '极强'
  if (!rootAnalysis.hasRoot && !seasonalStatus.isTimely && supportAnalysis.totalStrength === 0) status = '极弱'

  return {
    score,
    status,
    details: {
      timely: seasonalStatus.isTimely,
      rootStrength: rootAnalysis.totalStrength,
      supportStrength: supportAnalysis.totalStrength
    }
  }
}
