import type { BaziChartResult } from './baziTypes';
import { WUXING } from '../wuxing';

interface FormatBaziOptions {
  includeRules?: boolean;
  includeShensha?: boolean;
  includeWuxing?: boolean;
  includeSpecialPillars?: boolean;
}

export type PromptChartScene =
  'general' | 'fortune' | 'compatibility' | 'comprehensive' | 'concise';

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

function formatKinshipSection(baziResult: BaziChartResult): string {
  const facts = baziResult.evidenceAnalysis?.kinshipFacts ?? [];
  if (!facts.length) return '';

  const palaceFacts = facts.filter((item) => item.kind === '宫位');
  const tenGodFacts = facts.filter((item) => item.kind === '十神');
  const lines = ['【六亲宫星取象】'];
  if (palaceFacts.length) {
    lines.push(`宫分: ${palaceFacts.map((item) => item.promptText).join(' | ')}`);
  }
  tenGodFacts.forEach((item) => lines.push(`十神: ${item.promptText}`));
  lines.push(`边界: ${facts[0].limitation}`);
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
  } = baziResult;
  const {
    includeShensha = true,
    includeWuxing = true,
    includeSpecialPillars = true,
  } = options;

  let result = '【命盘】\n';
  const isMale = baziResult.gender === 'male';
  result += `基本信息: ${isMale ? '乾造' : '坤造'} | ${solarDate.year}年${solarDate.month}月${solarDate.day}日 ${timeInfo.name}\n`;
  result += `出生历法: 阳历${solarDate.year}年${solarDate.month}月${solarDate.day}日 | 农历${formatLunarDate(baziResult)} | 生肖:${baziResult.zodiac}\n`;
  if (baziResult.timing?.enabled) {
    result += `真太阳时: ${baziResult.timing.correctedTime.year}年${baziResult.timing.correctedTime.month}月${baziResult.timing.correctedTime.day}日 ${String(baziResult.timing.correctedTime.hour).padStart(2, '0')}:${String(baziResult.timing.correctedTime.minute).padStart(2, '0')} | 出生地:${baziResult.timing.birthPlace || '经度定点'} | 经度:${baziResult.timing.birthLongitude}\n`;
    if (baziResult.timing.dstCorrectionMinutes) {
      result += `夏令时校正: ${baziResult.timing.dstCorrectionMinutes} 分钟（中国夏令时 1986-1991）\n`;
    }
  }
  if (baziResult.warnings?.length) {
    result += `【定盘说明】\n${baziResult.warnings.map((w) => `- ${w}`).join('\n')}\n`;
  }
  result += `日元本命: ${dayMaster.gan}${dayMaster.element} (${dayMaster.yinYang})\n`;
  if (baziResult.monthCommander) result += `月令司权: ${baziResult.monthCommander}\n`;
  const birthSeason = formatBirthSeason(baziResult);
  if (birthSeason) result += `节令: ${birthSeason}\n`;
  const wuxingSeasonStatus = formatWuxingSeasonStatus(baziResult);
  if (wuxingSeasonStatus) result += `月令旺相: ${wuxingSeasonStatus}\n`;

  const specialPillars = [
    baziResult.mingGua
      ? `命卦:${baziResult.mingGua.gua}${baziResult.mingGua.number}(${baziResult.mingGua.eastWest})`
      : '',
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
  const strengthDetails = analysis.dayMasterStrength.details;
  result += `旺衰: ${analysis.dayMasterStrength.status}\n`;
  result += `旺衰依据: 月令${strengthDetails.seasonalEffect} | 司令${strengthDetails.commanderEffect} | 成局${strengthDetails.formationEffect} | 通根${strengthDetails.hasRoot ? '有根' : '无根'} | 帮扶${strengthDetails.hasSupport ? '可见' : '不明显'} | 克泄耗${strengthDetails.hasConstraint ? '可见' : '不明显'}\n`;
  result += `格局: ${analysis.mingGe.pattern}\n`;
  if (analysis.mingGe.basis) {
    result += `格局依据: ${analysis.mingGe.basis}\n`;
  }
  result += '用神: 自动规则尚未完成逐条校勘，取用待定\n';

  result += '\n【定盘口径】\n';
  result += '换日口径: 晚子时换日（23:00 起换日柱）\n';
  result += '节气口径: 以节气历表交接时刻换年、换月\n';
  if (baziResult.timing?.enabled) {
    result += '时间口径: 已按出生地经度与历史夏令时规则完成真太阳时校正，并采用唯一校正时刻\n';
  } else {
    result += '时间口径: 采用明确传统时辰排盘\n';
  }
  result += '解读口径: 按本次盘面逐项记录旺衰、格局与取用条件；证据未闭合者保留待定\n';

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
      result += `  日主十二运: ${dayMasterLifeStage || '无'} | 旬空: ${kongWangValue || '无'}\n`;
    }
    if (includeShensha && shenShaValue) result += `  神煞: ${shenShaValue}\n`;
  });

  const globalShenShaValue = shensha?.global?.join(',') || '';
  if (includeShensha && globalShenShaValue) {
    result += `全局神煞: ${globalShenShaValue}\n`;
  }

  const kinshipSection = formatKinshipSection(baziResult);
  if (kinshipSection) result += `\n${kinshipSection}\n`;

  if (includeWuxing && baziResult.wuxingStrength) {
    result += '\n【五行】\n';
    result += `出现:${baziResult.wuxingStrength.present.join('、') || '无'}`;
    if (baziResult.wuxingStrength.missing?.length) {
      result += ` | 缺失:${baziResult.wuxingStrength.missing.join(',')}`;
    }
    result += '\n';
  }

  return result;
}

function getPromptSceneOptions(scene: PromptChartScene): FormatBaziOptions {
  if (scene === 'comprehensive') {
    return {
      includeRules: true,
      includeShensha: false,
      includeWuxing: true,
      includeSpecialPillars: true,
    };
  }

  if (scene === 'fortune') {
    return {
      includeRules: true,
      includeShensha: false,
      includeWuxing: true,
      includeSpecialPillars: true,
    };
  }

  if (scene === 'compatibility') {
    return {
      includeRules: true,
      includeShensha: false,
      includeWuxing: false,
      includeSpecialPillars: false,
    };
  }

  if (scene === 'concise') {
    return {
      includeRules: true,
      includeShensha: false,
      includeWuxing: false,
      includeSpecialPillars: false,
    };
  }

  return {
    includeRules: true,
    includeShensha: false,
    includeWuxing: true,
    includeSpecialPillars: true,
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
