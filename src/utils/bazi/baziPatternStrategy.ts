import { HIDDEN_STEMS } from './baziDefinitions'
import type { PatternAnalysis, Pillars } from './baziTypes'

type GetTenGodFn = (gan: string, dayMaster: string) => string

export function determinePattern(pillars: Pillars, strengthStatus: string, getTenGod: GetTenGodFn): PatternAnalysis {
  const monthBranch = pillars.month.zhi
  const dayMaster = pillars.day.gan
  const monthStems = HIDDEN_STEMS[monthBranch] || []
  const exposedStems = [pillars.year.gan, pillars.month.gan, pillars.hour.gan]

  let patternName = ''

  const samePartyGods = new Set(['比肩', '劫财', '正印', '偏印'])
  const observedGods = [
    pillars.year.gan,
    pillars.month.gan,
    pillars.hour.gan,
    ...Object.values(pillars).map(pillar => (HIDDEN_STEMS[pillar.zhi] || [])[0]).filter(Boolean)
  ].map((stem) => getTenGod(stem, dayMaster))

  const isPureSameParty = observedGods.length > 0 && observedGods.every(god => samePartyGods.has(god))
  const isPureOppositeParty = observedGods.length > 0 && observedGods.every(god => !samePartyGods.has(god))

  if (strengthStatus === '极强' && isPureSameParty) {
    return { pattern: '专旺格', isSpecial: true }
  }
  if (strengthStatus === '极弱' && isPureOppositeParty) {
    return { pattern: '从格', isSpecial: true }
  }

  const monthMainQi = monthStems[0]
  const monthMainGod = getTenGod(monthMainQi, dayMaster)

  if (monthMainGod === '比肩') {
    patternName = '建禄格'
  } else if (monthMainGod === '劫财') {
    patternName = '月刃格'
  } else {
    let foundPattern = false

    for (const stem of monthStems) {
      if (exposedStems.includes(stem)) {
        const tenGod = getTenGod(stem, dayMaster)
        if (tenGod !== '比肩' && tenGod !== '劫财') {
          patternName = `${tenGod}格`
          foundPattern = true
          break
        }
      }
    }

    if (!foundPattern) {
      if (monthMainGod !== '比肩' && monthMainGod !== '劫财') {
        patternName = `${monthMainGod}格`
      } else {
        patternName = monthMainGod === '比肩' ? '建禄格' : '月刃格'
      }
    }
  }

  return {
    pattern: patternName || '杂气格',
    isSpecial: false
  }
}
