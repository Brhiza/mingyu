import type { BaziChartResult } from './baziTypes';
import { WUXING } from '../wuxing';

interface FormatBaziOptions {
  includeRules?: boolean;
  includeShensha?: boolean;
  includeShenShaAnalysis?: boolean;
  includeWuxing?: boolean;
  includeLuckOverview?: boolean;
}

export type PromptChartScene =
  'general' | 'fortune' | 'compatibility' | 'comprehensive' | 'concise';

function joinOrFallback(values: string[] | undefined, fallback = '无'): string {
  return values && values.length > 0 ? values.join('、') : fallback;
}

function formatLunarDate(baziResult: BaziChartResult): string {
  const lunarDate = baziResult.lunarDate;
  return `${lunarDate.year}年${lunarDate.monthName}${lunarDate.dayName}`;
}

function formatBirthSeason(baziResult: BaziChartResult): string {
  const seasonInfo = baziResult.seasonInfo;
  if (!seasonInfo || seasonInfo.currentJieqi === '未知') {
    return '';
  }

  return [
    `${seasonInfo.currentSeason}令`,
    `${seasonInfo.currentJieqi}后${seasonInfo.daysSincePrev}天`,
    seasonInfo.nextJieqi !== '未知' ? `距${seasonInfo.nextJieqi}${seasonInfo.daysToNext}天` : '',
  ]
    .filter(Boolean)
    .join(' | ');
}

function formatWuxingSeasonStatus(baziResult: BaziChartResult): string {
  const status = baziResult.wuxingSeasonStatus;
  if (!status || !Object.keys(status).length) return '';

  return WUXING.map((wuxing) => (status[wuxing] ? `${wuxing}${status[wuxing]}` : ''))
    .filter(Boolean)
    .join(' ');
}

function formatSolarDateTime(value: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}) {
  return `${value.year}年${value.month}月${value.day}日 ${value.hour}:${String(value.minute).padStart(2, '0')}`;
}

function formatPromptLuckOverview(baziResult: BaziChartResult): string {
  if (!baziResult.luckInfo?.cycles?.length) {
    return '';
  }

  const cycles = baziResult.luckInfo.cycles;

  const lines = [`起运: ${baziResult.luckInfo.startInfo}`];
  const cycleOverview = cycles.slice(0, 13).map((cycle, index) => {
    const years = cycle.years ?? [];
    const firstYear = years[0]?.year;
    const lastYear = years[years.length - 1]?.year;
    const yearRange = firstYear && lastYear ? `，含${firstYear}-${lastYear}年流年` : '';
    const cycleLabel = cycle.isXiaoyun ? `${cycle.ganZhi}童运` : `${cycle.ganZhi}${cycle.type}`;
    return `${index + 1}. ${cycleLabel}: ${cycle.year}年起，约${cycle.age}岁交运${yearRange}`;
  });

  if (cycleOverview.length) {
    lines.push('大运总览:');
    lines.push(...cycleOverview);
  }

  return lines.join('\n');
}

function buildBaziText(baziResult: BaziChartResult, options: FormatBaziOptions): string {
  if (!baziResult) return '无法获取八字数据。';

  const {
    solarDate,
    timeInfo,
    dayMaster,
    pillars,
    tenGods,
    hiddenStems,
    hiddenTenGods,
    shensha,
    shenShaAnalysis,
  } = baziResult;
  const {
    includeRules = true,
    includeShensha = true,
    includeShenShaAnalysis = false,
    includeWuxing = true,
    includeLuckOverview = true,
  } = options;

  let result = '【命盘】\n';
  const isMale = baziResult.gender === 'male';
  result += `基本信息: ${isMale ? '乾造' : '坤造'} | ${solarDate.year}年${solarDate.month}月${solarDate.day}日 ${timeInfo.name}\n`;
  result += `出生历法: 阳历${solarDate.year}年${solarDate.month}月${solarDate.day}日 | 农历${formatLunarDate(baziResult)} | 生肖:${baziResult.zodiac}\n`;
  if (baziResult.timing?.enabled && baziResult.timing.correctedTime) {
    result += `真太阳时: ${formatSolarDateTime(baziResult.timing.correctedTime)}`;
    if (baziResult.timing.birthPlace) {
      result += ` | 出生地:${baziResult.timing.birthPlace}`;
    }
    if (baziResult.timing.birthLongitude != null) {
      result += ` | 经度:${baziResult.timing.birthLongitude}`;
    }
    result += '\n';
  }
  if (baziResult.timing?.dstCorrectionMinutes != null) {
    result += `夏令时校正: ${baziResult.timing.dstCorrectionMinutes} 分钟\n`;
  }
  result += `日元本命: ${dayMaster.gan}${dayMaster.element} (${dayMaster.yinYang})\n`;
  if (baziResult.monthCommander) result += `月令司权: ${baziResult.monthCommander}\n`;
  const birthSeason = formatBirthSeason(baziResult);
  if (birthSeason) result += `节令: ${birthSeason}\n`;
  const wuxingSeasonStatus = formatWuxingSeasonStatus(baziResult);
  if (wuxingSeasonStatus) result += `月令旺相: ${wuxingSeasonStatus}\n`;

  result += '\n【核心判断】\n';
  const analysis = baziResult.analysis;
  result += `旺衰: ${analysis.dayMasterStrength.status}\n`;
  result += `格局: ${analysis.mingGe.pattern}\n`;
  if (analysis.usefulGod) {
    const primaryFavorableWuxing =
      analysis.usefulGod.primaryFavorableWuxing || analysis.usefulGod.favorableWuxing?.[0] || '无';
    const secondaryFavorableWuxing =
      analysis.usefulGod.secondaryFavorableWuxing ||
      analysis.usefulGod.favorableWuxing?.slice(1) ||
      [];
    const primaryUnfavorableWuxing =
      analysis.usefulGod.primaryUnfavorableWuxing ||
      analysis.usefulGod.unfavorableWuxing?.[0] ||
      '无';
    const secondaryUnfavorableWuxing =
      analysis.usefulGod.secondaryUnfavorableWuxing ||
      analysis.usefulGod.unfavorableWuxing?.slice(1) ||
      [];
    const primaryFavorableTenGods =
      analysis.usefulGod.primaryFavorable || analysis.usefulGod.primaryFavorableWuxing
        ? analysis.usefulGod.primaryFavorable || analysis.usefulGod.favorable?.slice(0, 2) || []
        : [];
    const primaryUnfavorableTenGods =
      analysis.usefulGod.primaryUnfavorable || analysis.usefulGod.primaryUnfavorableWuxing
        ? analysis.usefulGod.primaryUnfavorable || analysis.usefulGod.unfavorable?.slice(0, 2) || []
        : [];

    result += `取用: 主用${primaryFavorableWuxing}${secondaryFavorableWuxing.length ? '，辅' + secondaryFavorableWuxing.join('、') : ''}（${joinOrFallback(primaryFavorableTenGods)}）；忌${primaryUnfavorableWuxing}${secondaryUnfavorableWuxing.length ? '，次忌' + secondaryUnfavorableWuxing.join('、') : ''}（${joinOrFallback(primaryUnfavorableTenGods)}）\n`;
    if (includeRules && analysis.usefulGod.primaryReason) {
      result += `取用主线: ${analysis.usefulGod.primaryReason}\n`;
    }
  }

  result += '\n【四柱】\n';
  const pillarNames = ['年柱', '月柱', '日柱', '时柱'] as const;
  const keys: Array<keyof typeof pillars> = ['year', 'month', 'day', 'hour'];
  const dayKongWangBranches = baziResult.kongWang?.day || [];

  keys.forEach((key, index) => {
    const pillar = pillars[key];
    const tenGod = tenGods[key];
    const shenShaValue = shensha?.[key]?.join(',') || '';
    const kongWangFlag = dayKongWangBranches.includes(pillar.zhi) ? '(空亡)' : '';
    const hiddenStemValues = hiddenStems?.[key] || [];
    const hiddenTenGodValues = hiddenTenGods?.[key] || [];
    const dayMasterLifeStage = baziResult.lifeStages?.[key] || '';
    const hiddenStr = hiddenStemValues
      .map((stem, idx) => `${stem}${hiddenTenGodValues[idx] ? `[${hiddenTenGodValues[idx]}]` : ''}`)
      .join('');
    const shenShaExplain = shenShaAnalysis?.[key]?.join(' | ') || '';

    const pillarParts = [
      `${pillarNames[index]}: ${pillar.ganZhi}`,
      tenGod ? `[${tenGod}]` : '',
      kongWangFlag,
    ]
      .filter(Boolean)
      .join(' ');
    result += `${pillarParts}\n`;
    if (hiddenStr) result += `  藏干: ${hiddenStr}\n`;
    if (dayMasterLifeStage) result += `  十二运: ${dayMasterLifeStage}\n`;
    if (includeShensha && shenShaValue) result += `  神煞: ${shenShaValue}\n`;
    if (includeShensha && shenShaExplain) result += `  传统旁证: ${shenShaExplain}\n`;
    if (!includeShensha && includeShenShaAnalysis && shenShaExplain)
      result += `  传统旁证: ${shenShaExplain}\n`;
  });

  const globalShenShaValue = shensha?.global?.join(',') || '';
  const globalShenShaExplain = shenShaAnalysis?.global?.join(' | ') || '';
  if (includeShensha && globalShenShaValue) {
    result += `全局神煞: ${globalShenShaValue}\n`;
    if (globalShenShaExplain) {
      result += `  传统旁证: ${globalShenShaExplain}\n`;
    }
  }
  if (!includeShensha && includeShenShaAnalysis && globalShenShaExplain) {
    result += `全局传统旁证: ${globalShenShaExplain}\n`;
  }

  if (includeWuxing && baziResult.wuxingStrength) {
    result += '\n【五行】\n';
    result += `出现:${baziResult.wuxingStrength.present.join('、') || '无'} | 结构比较优先:${baziResult.wuxingStrength.dominantByRule.join('、') || '无'}`;
    if (baziResult.wuxingStrength.missing?.length) {
      result += ` | 缺失:${baziResult.wuxingStrength.missing.join(',')}`;
    }
    result += '\n';
  }

  if (includeLuckOverview && baziResult.luckInfo?.cycles) {
    result += '\n【大运】\n';
    result += `${formatPromptLuckOverview(baziResult)}\n`;
  }

  return result;
}

function getPromptSceneOptions(scene: PromptChartScene): FormatBaziOptions {
  if (scene === 'comprehensive') {
    return {
      includeRules: true,
      includeShensha: false,
      includeShenShaAnalysis: false,
      includeWuxing: false,
      includeLuckOverview: false,
    };
  }

  if (scene === 'fortune') {
    return {
      includeRules: true,
      includeShensha: false,
      includeShenShaAnalysis: false,
      includeWuxing: false,
      includeLuckOverview: false,
    };
  }

  if (scene === 'compatibility') {
    return {
      includeRules: true,
      includeShensha: false,
      includeShenShaAnalysis: false,
      includeWuxing: false,
      includeLuckOverview: false,
    };
  }

  if (scene === 'concise') {
    return {
      includeRules: true,
      includeShensha: false,
      includeShenShaAnalysis: false,
      includeWuxing: false,
      includeLuckOverview: false,
    };
  }

  return {
    includeRules: true,
    includeShensha: false,
    includeShenShaAnalysis: false,
    includeWuxing: false,
    includeLuckOverview: false,
  };
}

export function formatBaziForPrompt(
  baziResult: BaziChartResult,
  /** @deprecated 兼容旧调用签名，具体岁运应通过 FortuneSelectionContext 传入。 */
  _selectedOption: unknown = null,
  scene: PromptChartScene = 'general',
): string {
  if (!baziResult) return '无法获取八字数据。';

  return buildBaziText(baziResult, getPromptSceneOptions(scene));
}
