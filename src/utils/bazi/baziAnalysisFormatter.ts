import type { Person } from '@/composables/useFormState'
import type { BaziChartResult } from './baziTypes'
import { getCurrentTimeDescription } from './calendarTool'
import { pillarSummaries, tenGodAnalysis, monthAnalysis, shenShaAnalysis, combinedInfluence } from './baziAnalysisData'
import { getLuckCycleForDate } from './luckTiming'

export interface BaziData {
  year: number;
  month: number;
  day: number;
  timeIndex: number;
  gender: string;
  useTrueSolarTime?: boolean;
  birthHour?: number;
  birthMinute?: number;
  birthPlace?: string;
  birthLongitude?: number;
}

export function getPillarSummary(baziResult: BaziChartResult, pillarKey: keyof BaziChartResult['pillars'], tenGod: string): string {
  if (!baziResult) return ''
  return pillarSummaries[pillarKey][tenGod as keyof typeof pillarSummaries[keyof typeof pillarSummaries]] || pillarSummaries[pillarKey].default
}

export function getTenGodData(tenGod: string) {
  return tenGodAnalysis[tenGod as keyof typeof tenGodAnalysis] || tenGodAnalysis.default
}

export function getMonthWellness(season: string) {
  return monthAnalysis.season[season as keyof typeof monthAnalysis.season]?.wellness
}

export function getShenShaInfluence(shenShas: string[]): string {
  return shenShas.map(shenSha => shenShaAnalysis.influence[shenSha as keyof typeof shenShaAnalysis.influence] || '').join(' ')
}

export function getShenShaAdvice(shenSha: string): string {
  return shenShaAnalysis.advice[shenSha as keyof typeof shenShaAnalysis.advice] || shenShaAnalysis.advice.default
}

export function getCombinedInfluence(type: keyof typeof combinedInfluence, key1: string, key2: string): string | undefined {
  const section = combinedInfluence[type]
  const combinedKey = `${key1}-${key2}`
  if (section && combinedKey in section) {
    return section[combinedKey as keyof typeof section]
  }
  return undefined
}

export function getAnalysisLabel(key: string): string {
  const labels: Record<string, string> = {
    tianGan: '天干',
    diZhi: '地支',
    zhengZhu: '正柱'
  }
  return labels[key] || key
}

export function getCompatibilityAnalysisLabel(key: string): string {
  const labels: Record<string, string> = {
    tianGanRelation: '天干关系',
    diZhiRelation: '地支关系',
    wuxingBalance: '五行平衡',
    overallCompatibility: '综合匹配',
    ganHe: '天干五合',
    zhiChong: '地支相冲',
    zhiHe: '地支六合',
    zhiXing: '地支相刑',
    zhiHai: '地支相害',
    sync: '同步性',
    wuxingComp: '五行互补',
    shenShaComp: '神煞互补',
    summary: '总结'
  }
  return labels[key] || key
}

export function getMonthData(tenGod: string, season: string) {
  const tenGodData = monthAnalysis.tenGod[tenGod as keyof typeof monthAnalysis.tenGod] || monthAnalysis.tenGod.default
  const seasonData = monthAnalysis.season[season as keyof typeof monthAnalysis.season] || {}
  const healthCaution = tenGodData.caution?.health || '注意身体'
  return { ...tenGodData, ...seasonData, healthCaution }
}

export function getShenShaSpecialAdvice(shenShas: string[]): string {
  let advice = ''
  shenShas.forEach(shenSha => {
    const specialAdvice = shenShaAnalysis.advice[shenSha as keyof typeof shenShaAnalysis.advice]
    if (specialAdvice && specialAdvice !== shenShaAnalysis.advice.default) {
      advice += `${shenSha}: ${specialAdvice} `
    }
  })
  return advice || shenShaAnalysis.advice.default
}

export const createBaziDataFromPerson = (person: Person): BaziData => {
  return {
    ...person,
    year: Number(person.year),
    month: Number(person.month),
    day: Number(person.day),
    timeIndex: Number(person.timeIndex),
    useTrueSolarTime: Boolean(person.useTrueSolarTime),
    birthHour: person.birthHour,
    birthMinute: person.birthMinute,
    birthPlace: person.birthPlace || '',
    birthLongitude: person.birthLongitude
  }
}

interface FormatBaziOptions {
  includeRules?: boolean;
  includeShensha?: boolean;
  includeWuxing?: boolean;
  includeCurrentTiming?: boolean;
  includeSpecialPillars?: boolean;
  includeLuckOverview?: boolean;
  includeCurrentLiunian?: boolean;
}

export type PromptChartScene = 'general' | 'concise' | 'comprehensive' | 'fortune' | 'compatibility'

function buildBaziText(
  baziResult: BaziChartResult,
  options: FormatBaziOptions
): string {
  if (!baziResult) return '无法获取八字数据。'

  const { solarDate, timeInfo, dayMaster, pillars, tenGods, hiddenStems, hiddenTenGods, nayin, pillarLifeStages, kongWang, shensha, shenShaAnalysis } = baziResult
  const {
    includeRules = true,
    includeShensha = true,
    includeWuxing = true,
    includeCurrentTiming = true,
    includeSpecialPillars = true,
    includeLuckOverview = true,
    includeCurrentLiunian = true
  } = options

  let result = '【命盘】\n'
  const isMale = baziResult.gender === 'male'
  result += `基本信息: ${isMale ? '乾造' : '坤造'} | ${solarDate.year}年${solarDate.month}月${solarDate.day}日 ${timeInfo.name} | 生肖:${baziResult.zodiac}\n`
  if (baziResult.timing?.enabled) {
    result += `真太阳时: ${baziResult.timing.correctedTime.year}年${baziResult.timing.correctedTime.month}月${baziResult.timing.correctedTime.day}日 ${String(baziResult.timing.correctedTime.hour).padStart(2, '0')}:${String(baziResult.timing.correctedTime.minute).padStart(2, '0')} | 出生地:${baziResult.timing.birthPlace || '未填写'} | 经度:${baziResult.timing.birthLongitude}\n`
  }
  result += `日元本命: ${dayMaster.gan}${dayMaster.element} (${dayMaster.yinYang})\n`
  if (baziResult.monthCommander) result += `月令司权: ${baziResult.monthCommander}\n`

  const specialPillars = [
    baziResult.mingGong ? `命宫:${baziResult.mingGong}` : '',
    baziResult.shenGong ? `身宫:${baziResult.shenGong}` : '',
    baziResult.taiYuan ? `胎元:${baziResult.taiYuan}` : ''
  ].filter(Boolean).join(' | ')
  if (includeSpecialPillars && specialPillars) result += `特殊宫位: ${specialPillars}\n`

  result += '\n【核心判断依据】\n'
  const analysis = baziResult.analysis
  result += `旺衰: ${analysis.dayMasterStrength.status}（得分:${analysis.dayMasterStrength.score}）\n`
  result += `格局: ${analysis.mingGe.pattern}\n`
  if (analysis.usefulGod) {
    if (analysis.usefulGod.favorableWuxing?.length || analysis.usefulGod.unfavorableWuxing?.length) {
      result += `喜神五行: ${(analysis.usefulGod.favorableWuxing || []).join('、') || '暂无'} | 忌神五行: ${(analysis.usefulGod.unfavorableWuxing || []).join('、') || '暂无'}\n`
    }
    if (analysis.usefulGod.favorable?.length || analysis.usefulGod.unfavorable?.length) {
      result += `喜用十神: ${analysis.usefulGod.favorable.join('、') || '暂无'} | 忌神十神: ${analysis.usefulGod.unfavorable.join('、') || '暂无'}\n`
    }
    result += `喜用: ${analysis.usefulGod.useful} | 忌神: ${analysis.usefulGod.avoid}\n`
    if (includeRules && analysis.usefulGod.primaryReason) {
      result += `主导规则: ${analysis.usefulGod.primaryReason}\n`
    }
    if (includeRules && analysis.usefulGod.matchedRules?.length) {
      result += `命中规则: ${analysis.usefulGod.matchedRules.map(rule => rule.label).join(', ')}\n`
    }
    if (includeRules && analysis.usefulGod.strategyTrace?.length) {
      result += `取用路径: ${analysis.usefulGod.strategyTrace.join(' -> ')}\n`
    }
  }

  result += '\n【四柱】\n'
  const pillarNames = ['年柱', '月柱', '日柱', '时柱'] as const
  const keys: Array<keyof typeof pillars> = ['year', 'month', 'day', 'hour']

  keys.forEach((key, index) => {
    const pillar = pillars[key]
    const tenGod = tenGods[key]
    const nayinValue = nayin?.[key] || ''
    const lifeStage = pillarLifeStages?.[key] || ''
    const kongWangFlag = kongWang?.[key] ? '(空亡)' : ''
    const hiddenStemValues = hiddenStems?.[key] || []
    const hiddenTenGodValues = hiddenTenGods?.[key] || []
    const hiddenStr = hiddenStemValues.map((stem, idx) => `${stem}${hiddenTenGodValues[idx] ? `[${hiddenTenGodValues[idx]}]` : ''}`).join('')
    const shenShaValue = shensha?.[key]?.join(',') || ''
    const shenShaExplain = shenShaAnalysis?.[key]?.join(' | ') || ''

    const pillarParts = [
      `${pillarNames[index]}: ${pillar.ganZhi}`,
      tenGod ? `[${tenGod}]` : '',
      nayinValue,
      lifeStage,
      kongWangFlag
    ].filter(Boolean).join(' ')
    result += `${pillarParts}\n`
    if (hiddenStr) result += `  藏干: ${hiddenStr}\n`
    if (includeShensha && shenShaValue) result += `  神煞: ${shenShaValue}\n`
    if (includeShensha && shenShaExplain) result += `  提示: ${shenShaExplain}\n`
  })

  const globalShenShaValue = shensha?.global?.join(',') || ''
  const globalShenShaExplain = shenShaAnalysis?.global?.join(' | ') || ''
  if (includeShensha && globalShenShaValue) {
    result += `全局神煞: ${globalShenShaValue}\n`
    if (globalShenShaExplain) {
      result += `  提示: ${globalShenShaExplain}\n`
    }
  }

  if (includeWuxing && baziResult.wuxingStrength?.percentages) {
    result += '\n【五行】\n'
    const wuxingMap = baziResult.wuxingStrength.percentages
    result += Object.entries(wuxingMap).map(([key, value]) => `${key}:${value}%`).join('  ')
    if (baziResult.wuxingStrength.missing?.length) {
      result += ` | 缺失:${baziResult.wuxingStrength.missing.join(',')}`
    }
    result += '\n'
  }

  if (includeLuckOverview && baziResult.luckInfo?.cycles) {
    result += '\n【大运】\n'
    result += `起运: ${baziResult.luckInfo.startInfo}\n`
    const cycles = baziResult.luckInfo.cycles.slice(0, 8)
    result += `${cycles.map(cycle => `${cycle.ganZhi}(${cycle.age}岁)`).join(' -> ')}\n`
  }

  if (includeCurrentLiunian && baziResult.liunian?.length) {
    const now = new Date()
    const currentYear = now.getFullYear()
    let currentLuckStr = ''
    let currentLiunian = baziResult.liunian.find(year => year.year === currentYear)

    if (baziResult.luckInfo?.cycles) {
      const currentLuck = getLuckCycleForDate(baziResult.luckInfo.cycles, now)
      if (currentLuck?.isXiaoyun) {
        currentLuckStr = ' | 【当前大运】 未起运(行童运)'
        currentLiunian = currentLuck.years.find(year => year.year === currentYear) || currentLiunian
      } else if (currentLuck) {
        currentLuckStr = ` | 【当前大运】 ${currentLuck.ganZhi}运`
        currentLiunian = currentLuck.years.find(year => year.year === currentYear) || currentLiunian
      }
    }

    if (currentLiunian) {
      result += `\n【当前流年】 ${currentYear}年 ${currentLiunian.ganZhi}${currentLuckStr}\n`
      result += `十神: ${currentLiunian.tenGod}/${currentLiunian.tenGodZhi}\n`
    }
  }

  if (includeCurrentTiming) {
    result += `\n${getCurrentTimeDescription()}`
  }
  return result
}

function getPromptSceneOptions(scene: PromptChartScene): FormatBaziOptions {
  if (scene === 'comprehensive') {
    return {
      includeRules: true,
      includeShensha: false,
      includeWuxing: true,
      includeCurrentTiming: true,
      includeSpecialPillars: true,
      includeLuckOverview: true,
      includeCurrentLiunian: true
    }
  }

  if (scene === 'fortune') {
    return {
      includeRules: true,
      includeShensha: false,
      includeWuxing: false,
      includeCurrentTiming: true,
      includeSpecialPillars: false,
      includeLuckOverview: true,
      includeCurrentLiunian: true
    }
  }

  if (scene === 'compatibility') {
    return {
      includeRules: true,
      includeShensha: false,
      includeWuxing: false,
      includeCurrentTiming: false,
      includeSpecialPillars: false,
      includeLuckOverview: false,
      includeCurrentLiunian: false
    }
  }

  if (scene === 'concise') {
    return {
      includeRules: true,
      includeShensha: false,
      includeWuxing: false,
      includeCurrentTiming: true,
      includeSpecialPillars: false,
      includeLuckOverview: false,
      includeCurrentLiunian: false
    }
  }

  return {
    includeRules: true,
    includeShensha: false,
    includeWuxing: false,
    includeCurrentTiming: true,
    includeSpecialPillars: true,
    includeLuckOverview: true,
    includeCurrentLiunian: true
  }
}

export function formatBaziForPrompt(baziResult: BaziChartResult, _selectedOption: unknown = null, scene: PromptChartScene = 'general'): string {
  if (!baziResult) return '无法获取八字数据。'

  return buildBaziText(baziResult, getPromptSceneOptions(scene))
}

export function formatBaziForDisplay(baziResult: BaziChartResult): string {
  if (!baziResult) return '无法获取八字数据。'

  return buildBaziText(baziResult, {
    includeRules: true,
    includeShensha: true,
    includeWuxing: true,
    includeCurrentTiming: true
  })
}

export function formatBaziForAI(baziResult: BaziChartResult, selectedOption: unknown = null): string {
  return formatBaziForPrompt(baziResult, selectedOption)
}

export function formatHoroscopeSelectionForAI(horoscopeState: { selectedDate: Date; selectedTime: string; }): string {
  if (!horoscopeState || !horoscopeState.selectedDate) {
    return '未指定具体日期'
  }

  const { selectedDate, selectedTime } = horoscopeState
  let dateInfo = `${selectedDate.getFullYear()}年${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日`

  if (selectedTime) {
    dateInfo += ` ${selectedTime}`
  }

  return dateInfo
}
