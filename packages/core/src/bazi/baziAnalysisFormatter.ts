import type { BaziChartResult } from './baziTypes';
import { getCurrentTimeDescription } from './calendarTool';
import { getLuckCycleForDate } from './luckTiming';

interface FormatBaziOptions {
  includeRules?: boolean;
  includeShensha?: boolean;
  includeShenShaAnalysis?: boolean;
  includeWuxing?: boolean;
  includeCurrentTiming?: boolean;
  includeSpecialPillars?: boolean;
  includeLuckOverview?: boolean;
  includeCurrentLiunian?: boolean;
}

export type PromptChartScene =
  | 'general'
  | 'fortune'
  | 'compatibility'
  | 'comprehensive'
  | 'concise';

function formatSignedScore(value: number): string {
  const rounded = Number(value.toFixed(1));
  return `${rounded >= 0 ? '+' : ''}${rounded}`;
}

function joinOrFallback(values: string[] | undefined, fallback = '暂无'): string {
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

  return ['木', '火', '土', '金', '水']
    .map((wuxing) => (status[wuxing] ? `${wuxing}${status[wuxing]}` : ''))
    .filter(Boolean)
    .join(' ');
}

function filterPromptStrategyTrace(strategyTrace: string[] | undefined): string[] {
  if (!strategyTrace?.length) return [];

  return strategyTrace.filter((trace) => {
    const normalized = trace.trim();
    if (!normalized) return false;

    return !['成格层次:', '成格转轻:', '病药提示:', '运势警语:'].some((prefix) =>
      normalized.startsWith(prefix),
    );
  });
}

function formatPromptLuckOverview(baziResult: BaziChartResult): string {
  if (!baziResult.luckInfo?.cycles?.length) {
    return '';
  }

  const cycles = baziResult.luckInfo.cycles;
  const now = new Date();
  const currentLuck = getLuckCycleForDate(cycles, now);

  const lines = [`起运: ${baziResult.luckInfo.startInfo}`];

  if (!currentLuck) {
    const preview = cycles
      .slice(0, 3)
      .map((cycle) => `${cycle.ganZhi}(${cycle.age}岁)`)
      .join(' -> ');
    lines.push(`运程摘要: ${preview}`);
    return lines.join('\n');
  }

  if (currentLuck.isXiaoyun) {
    lines.push('当前阶段: 未起运（行童运）');
    const preview = currentLuck.years
      .slice(0, 3)
      .map((year) => `${year.year}年${year.ganZhi}`)
      .join(' -> ');
    if (preview) {
      lines.push(`近期流年: ${preview}`);
    }
    return lines.join('\n');
  }

  const currentIndex = cycles.findIndex(
    (cycle) => cycle.ganZhi === currentLuck.ganZhi && cycle.age === currentLuck.age,
  );
  const relatedCycles = [
    currentIndex > 0
      ? `前运: ${cycles[currentIndex - 1].ganZhi}(${cycles[currentIndex - 1].age}岁)`
      : '',
    `当前大运: ${currentLuck.ganZhi}(${currentLuck.age}岁)`,
    currentIndex >= 0 && currentIndex < cycles.length - 1
      ? `后运: ${cycles[currentIndex + 1].ganZhi}(${cycles[currentIndex + 1].age}岁)`
      : '',
  ].filter(Boolean);

  lines.push(...relatedCycles);
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
    nayin,
    pillarLifeStages,
    shensha,
    shenShaAnalysis,
  } = baziResult;
  const {
    includeRules = true,
    includeShensha = true,
    includeShenShaAnalysis = false,
    includeWuxing = true,
    includeCurrentTiming = true,
    includeSpecialPillars = true,
    includeLuckOverview = true,
    includeCurrentLiunian = true,
  } = options;

  let result = '【命盘】\n';
  const isMale = baziResult.gender === 'male';
  result += `基本信息: ${isMale ? '乾造' : '坤造'} | ${solarDate.year}年${solarDate.month}月${solarDate.day}日 ${timeInfo.name}\n`;
  result += `出生历法: 阳历${solarDate.year}年${solarDate.month}月${solarDate.day}日 | 农历${formatLunarDate(baziResult)} | 生肖:${baziResult.zodiac}\n`;
  if (baziResult.timing?.enabled) {
    result += `真太阳时: ${baziResult.timing.correctedTime.year}年${baziResult.timing.correctedTime.month}月${baziResult.timing.correctedTime.day}日 ${String(baziResult.timing.correctedTime.hour).padStart(2, '0')}:${String(baziResult.timing.correctedTime.minute).padStart(2, '0')} | 出生地:${baziResult.timing.birthPlace || '未填写'} | 经度:${baziResult.timing.birthLongitude}\n`;
  }
  result += `日元本命: ${dayMaster.gan}${dayMaster.element} (${dayMaster.yinYang})\n`;
  if (baziResult.monthCommander) result += `月令司权: ${baziResult.monthCommander}\n`;
  const birthSeason = formatBirthSeason(baziResult);
  if (birthSeason) result += `节令: ${birthSeason}\n`;
  const wuxingSeasonStatus = formatWuxingSeasonStatus(baziResult);
  if (wuxingSeasonStatus) result += `月令旺相: ${wuxingSeasonStatus}\n`;

  const specialPillars = [
    baziResult.mingGong ? `命宫:${baziResult.mingGong}` : '',
    baziResult.shenGong ? `身宫:${baziResult.shenGong}` : '',
    baziResult.taiYuan ? `胎元:${baziResult.taiYuan}` : '',
    baziResult.taiXi ? `胎息:${baziResult.taiXi}` : '',
  ]
    .filter(Boolean)
    .join(' | ');
  if (includeSpecialPillars && specialPillars) result += `特殊宫位: ${specialPillars}\n`;

  result += '\n【核心判断依据】\n';
  const analysis = baziResult.analysis;
  result += `旺衰: ${analysis.dayMasterStrength.status}（得分:${analysis.dayMasterStrength.score}）\n`;
  result += `旺衰拆分: 月令:${formatSignedScore(analysis.dayMasterStrength.details.seasonalScore)} | 成局:${formatSignedScore(analysis.dayMasterStrength.details.formationStrength)} | 通根:${formatSignedScore(analysis.dayMasterStrength.details.rootStrength)} | 帮扶:${formatSignedScore(analysis.dayMasterStrength.details.supportStrength)} | 克泄耗:${formatSignedScore(-analysis.dayMasterStrength.details.constraintStrength)}\n`;
  result += `格局: ${analysis.mingGe.pattern}\n`;
  if (analysis.mingGe.basis) {
    result += `格局依据: ${analysis.mingGe.basis}\n`;
  }
  if (analysis.usefulGod) {
    const primaryFavorableWuxing =
      analysis.usefulGod.primaryFavorableWuxing ||
      analysis.usefulGod.favorableWuxing?.[0] ||
      '暂无';
    const secondaryFavorableWuxing =
      analysis.usefulGod.secondaryFavorableWuxing ||
      analysis.usefulGod.favorableWuxing?.slice(1) ||
      [];
    const primaryUnfavorableWuxing =
      analysis.usefulGod.primaryUnfavorableWuxing ||
      analysis.usefulGod.unfavorableWuxing?.[0] ||
      '暂无';
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

    result += `用神: 主用${primaryFavorableWuxing}${secondaryFavorableWuxing.length ? '+辅' + secondaryFavorableWuxing.join('、') : ''}(${joinOrFallback(primaryFavorableTenGods)}) | 主忌${primaryUnfavorableWuxing}${secondaryUnfavorableWuxing.length ? '+次' + secondaryUnfavorableWuxing.join('、') : ''}(${joinOrFallback(primaryUnfavorableTenGods)})\n`;
    result += `喜忌五行: ${joinOrFallback(analysis.usefulGod.favorableWuxing)} | ${joinOrFallback(analysis.usefulGod.unfavorableWuxing)}\n`;
    result += `喜忌十神: ${joinOrFallback(analysis.usefulGod.favorable)} | ${joinOrFallback(analysis.usefulGod.unfavorable)}\n`;
    result += `十神归类: 喜${analysis.usefulGod.useful} 忌${analysis.usefulGod.avoid}\n`;
    if (includeRules && analysis.usefulGod.primaryReason) {
      result += `取用主线: ${analysis.usefulGod.primaryReason}\n`;
    }
    const promptStrategyTrace = filterPromptStrategyTrace(analysis.usefulGod.strategyTrace);
    if (includeRules && promptStrategyTrace.length) {
      result += `取用脉络: ${promptStrategyTrace.join(' -> ')}\n`;
    }
  }

  result += '\n【四柱】\n';
  const pillarNames = ['年柱', '月柱', '日柱', '时柱'] as const;
  const keys: Array<keyof typeof pillars> = ['year', 'month', 'day', 'hour'];
  const dayKongWangBranches = baziResult.kongWang?.day || [];

  keys.forEach((key, index) => {
    const pillar = pillars[key];
    const tenGod = tenGods[key];
    const nayinValue = nayin?.[key] || '';
    const lifeStage = pillarLifeStages?.[key] || '';
    const shenShaValue = shensha?.[key]?.join(',') || '';
    const kongWangFlag = dayKongWangBranches.includes(pillar.zhi) ? '(空亡)' : '';
    const hiddenStemValues = hiddenStems?.[key] || [];
    const hiddenTenGodValues = hiddenTenGods?.[key] || [];
    const dayMasterLifeStage = baziResult.lifeStages?.[key] || '';
    const kongWangValue = baziResult.kongWang?.[key]?.join('') || '';
    const hiddenStr = hiddenStemValues
      .map((stem, idx) => `${stem}${hiddenTenGodValues[idx] ? `[${hiddenTenGodValues[idx]}]` : ''}`)
      .join('');
    const shenShaExplain = shenShaAnalysis?.[key]?.join(' | ') || '';

    const pillarParts = [
      `${pillarNames[index]}: ${pillar.ganZhi}`,
      tenGod ? `[${tenGod}]` : '',
      nayinValue,
      lifeStage,
      kongWangFlag,
    ]
      .filter(Boolean)
      .join(' ');
    result += `${pillarParts}\n`;
    if (hiddenStr) result += `  藏干: ${hiddenStr}\n`;
    if (dayMasterLifeStage || kongWangValue) {
      result += `  日主十二运: ${dayMasterLifeStage || '暂无'} | 旬空: ${kongWangValue || '暂无'}\n`;
    }
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

  if (includeWuxing && baziResult.wuxingStrength?.percentages) {
    result += '\n【五行】\n';
    const wuxingMap = baziResult.wuxingStrength.percentages;
    result += Object.entries(wuxingMap)
      .map(([key, value]) => `${key}:${value}%`)
      .join('  ');
    if (baziResult.wuxingStrength.missing?.length) {
      result += ` | 缺失:${baziResult.wuxingStrength.missing.join(',')}`;
    }
    result += '\n';
  }

  if (includeLuckOverview && baziResult.luckInfo?.cycles) {
    result += '\n【大运】\n';
    result += `${formatPromptLuckOverview(baziResult)}\n`;
  }

  if (includeCurrentLiunian && baziResult.liunian?.length) {
    const now = new Date();
    const currentYear = now.getFullYear();
    let currentLuckStr = '';
    let currentLiunian = baziResult.liunian.find((year) => year.year === currentYear);

    if (baziResult.luckInfo?.cycles) {
      const currentLuck = getLuckCycleForDate(baziResult.luckInfo.cycles, now);
      if (currentLuck?.isXiaoyun) {
        currentLuckStr = ' | 【当前大运】 未起运(行童运)';
        currentLiunian =
          currentLuck.years.find((year) => year.year === currentYear) || currentLiunian;
      } else if (currentLuck) {
        currentLuckStr = ` | 【当前大运】 ${currentLuck.ganZhi}运`;
        currentLiunian =
          currentLuck.years.find((year) => year.year === currentYear) || currentLiunian;
      }
    }

    if (currentLiunian) {
      result += `\n【当前流年】 ${currentYear}年 ${currentLiunian.ganZhi}${currentLuckStr}\n`;
      result += `十神: ${currentLiunian.tenGod}/${currentLiunian.tenGodZhi}\n`;
    }
  }

  if (includeCurrentTiming) {
    result += `\n${getCurrentTimeDescription()}`;
  }
  return result;
}

function getPromptSceneOptions(scene: PromptChartScene): FormatBaziOptions {
  if (scene === 'comprehensive') {
    return {
      includeRules: true,
      includeShensha: false,
      includeShenShaAnalysis: true,
      includeWuxing: true,
      includeCurrentTiming: false,
      includeSpecialPillars: true,
      includeLuckOverview: true,
      includeCurrentLiunian: true,
    };
  }

  if (scene === 'fortune') {
    return {
      includeRules: true,
      includeShensha: false,
      includeShenShaAnalysis: true,
      includeWuxing: true,
      includeCurrentTiming: false,
      includeSpecialPillars: true,
      includeLuckOverview: true,
      includeCurrentLiunian: true,
    };
  }

  if (scene === 'compatibility') {
    return {
      includeRules: true,
      includeShensha: false,
      includeShenShaAnalysis: false,
      includeWuxing: false,
      includeCurrentTiming: false,
      includeSpecialPillars: false,
      includeLuckOverview: false,
      includeCurrentLiunian: false,
    };
  }

  if (scene === 'concise') {
    return {
      includeRules: true,
      includeShensha: false,
      includeShenShaAnalysis: false,
      includeWuxing: false,
      includeCurrentTiming: false,
      includeSpecialPillars: false,
      includeLuckOverview: false,
      includeCurrentLiunian: false,
    };
  }

  return {
    includeRules: true,
    includeShensha: false,
    includeShenShaAnalysis: true,
    includeWuxing: true,
    includeCurrentTiming: false,
    includeSpecialPillars: true,
    includeLuckOverview: true,
    includeCurrentLiunian: true,
  };
}

export function formatBaziForPrompt(
  baziResult: BaziChartResult,
  _selectedOption: unknown = null,
  scene: PromptChartScene = 'general',
): string {
  if (!baziResult) return '无法获取八字数据。';

  return buildBaziText(baziResult, getPromptSceneOptions(scene));
}
