import { getBranchWuxing, getStemWuxing } from '../ganzhi-foundation';
import type {
  DailyHourSlice,
  FortuneCalendarContext,
  FortuneDimension,
  FortuneOverview,
  FortuneScoreFactor,
  FortuneScope,
  FortuneTier,
  FortuneTrend,
  MonthlyDaySlice,
  PersonalAstrolabeSummary,
  PersonalBaziSummary,
  PersonalZiweiSummary,
  YearlyMonthSlice,
} from './types';

const WUXING_COLORS: Record<string, string[]> = {
  木: ['翠绿', '青色', '墨绿'],
  火: ['朱红', '暖橙', '绛紫'],
  土: ['米黄', '焦糖', '暖咖'],
  金: ['银白', '浅金', '珍珠灰'],
  水: ['海蓝', '玄黑', '烟青'],
};

const WUXING_DIRECTIONS: Record<string, string[]> = {
  木: ['正东', '东南'],
  火: ['正南'],
  土: ['西南', '东北'],
  金: ['正西', '西北'],
  水: ['正北'],
};

const WUXING_NUMBERS: Record<string, number[]> = {
  木: [3, 8],
  火: [2, 7],
  土: [5, 0],
  金: [4, 9],
  水: [1, 6],
};

const AUSPICIOUS_OFFICERS = new Set(['建', '除', '满', '定', '成', '开']);
const CAUTION_OFFICERS = new Set(['破', '危', '闭']);
const HUANGDAO_STARS = new Set(['青龙', '明堂', '金匮', '天德', '玉堂', '司命']);
const HEIDAO_STARS = new Set(['天刑', '朱雀', '白虎', '天牢', '玄武', '勾陈']);

const TEN_GOD_DIM_WEIGHTS: Record<
  string,
  { career: number; wealth: number; relationship: number; health: number; decision: number; tag: string; desc: string }
> = {
  比肩: { career: 4, wealth: -1, relationship: 2, health: 3, decision: 3, tag: '自主协力', desc: '自我行动力增强，适合独立推进或与同辈并肩协作' },
  劫财: { career: 2, wealth: -6, relationship: -2, health: 1, decision: -3, tag: '竞争防破财', desc: '社交活跃但易有竞争与意外开销，合作需明晰账目边界' },
  食神: { career: 4, wealth: 6, relationship: 5, health: 5, decision: 4, tag: '才华吐秀', desc: '思路从容舒展，利于创意产出、沟通洽谈与温和聚财' },
  伤官: { career: 3, wealth: 4, relationship: -3, health: -2, decision: -1, tag: '锋芒破局', desc: '灵感敏锐、行动力快，但言辞易偏锐利，注意情绪与人际分寸' },
  偏财: { career: 4, wealth: 9, relationship: 4, health: 0, decision: 3, tag: '机会流动', desc: '偏财与资源流动加快，适合拓展客户、副业或把握弹性商机' },
  正财: { career: 6, wealth: 8, relationship: 4, health: 2, decision: 5, tag: '务实收获', desc: '踏实稳健、正财入袋之象，适合按计划收尾与兑现回报' },
  七杀: { career: 5, wealth: 1, relationship: -3, health: -5, decision: 2, tag: '承压攻坚', desc: '责任与压力并重，适合啃硬骨头但需防操劳过度或急躁冲突' },
  正官: { career: 8, wealth: 3, relationship: 4, health: 2, decision: 6, tag: '秩序得助', desc: '利于按规则办事、向上沟通汇报、树立口碑与契约推进' },
  偏印: { career: 3, wealth: -1, relationship: -2, health: 0, decision: 2, tag: '深思洞察', desc: '专注力与直觉较强，适合研究复盘、独立规划，宜防思虑过重' },
  正印: { career: 7, wealth: 2, relationship: 5, health: 5, decision: 6, tag: '贵人涵养', desc: '易得长辈、前辈或平台支持，适合学习考证与休养生息' },
};

const ZIWEI_PALACE_DIM: Record<string, keyof Record<'career' | 'wealth' | 'relationship' | 'health' | 'decision', number>> = {
  官禄: 'career',
  财帛: 'wealth',
  夫妻: 'relationship',
  交友: 'relationship',
  迁移: 'decision',
  疾厄: 'health',
  福德: 'health',
  命宫: 'decision',
};

function clampScore(value: number): number {
  return Math.max(32, Math.min(96, Math.round(value)));
}

function toTrend(score: number): FortuneTrend {
  if (score >= 76) return '旺';
  if (score >= 60) return '平';
  return '谨';
}

function toTier(score: number): FortuneTier {
  if (score >= 86) return '大吉';
  if (score >= 75) return '顺遂';
  if (score >= 62) return '平稳';
  if (score >= 50) return '谨慎';
  return '波动';
}

function wuxingImpact(
  ganzhi: string,
  favorable: readonly string[],
  unfavorable: readonly string[],
): { stemMatch: 'fav' | 'unfav' | 'neutral'; branchMatch: 'fav' | 'unfav' | 'neutral'; delta: number } {
  const stemEl = getStemWuxing(ganzhi[0] ?? '甲');
  const branchEl = getBranchWuxing(ganzhi[1] ?? '子');
  const stemMatch = favorable.includes(stemEl) ? 'fav' : unfavorable.includes(stemEl) ? 'unfav' : 'neutral';
  const branchMatch = favorable.includes(branchEl) ? 'fav' : unfavorable.includes(branchEl) ? 'unfav' : 'neutral';
  const stemDelta = stemMatch === 'fav' ? 5 : stemMatch === 'unfav' ? -4 : 0;
  const branchDelta = branchMatch === 'fav' ? 6 : branchMatch === 'unfav' ? -5 : 0;
  return { stemMatch, branchMatch, delta: stemDelta + branchDelta };
}

export interface ScoringInput {
  scope: FortuneScope;
  calendar: FortuneCalendarContext;
  bazi?: PersonalBaziSummary | null;
  ziwei?: PersonalZiweiSummary | null;
  astrolabe?: PersonalAstrolabeSummary | null;
  wuyunSummary?: string | null;
  wuyunRelation?: string | null;
  hours?: readonly DailyHourSlice[];
  monthlyDays?: readonly MonthlyDaySlice[];
  yearlyMonths?: readonly YearlyMonthSlice[];
}

export function buildFortuneOverview(input: ScoringInput): FortuneOverview {
  const { scope, calendar, bazi, ziwei, astrolabe, wuyunSummary, wuyunRelation, hours, monthlyDays, yearlyMonths } = input;
  const factors: FortuneScoreFactor[] = [];
  const dimScores = { career: 68, wealth: 68, relationship: 68, health: 68, decision: 68 };
  const keywords = new Set<string>();

  let baseScore = 68;

  // 1. 周期适配的环境气场基础（日运看当日建除黄黑道与神煞；月运看全月吉凶日比例；年运看十二流月与五运六气）
  if (scope === 'daily') {
    const officerClean = calendar.dayOfficer.replace(/[日值神]/g, '').slice(0, 1);
    if (AUSPICIOUS_OFFICERS.has(officerClean)) {
      baseScore += 5;
      dimScores.decision += 5;
      dimScores.career += 3;
      factors.push({
        label: `建除「${calendar.dayOfficer}」值日`,
        category: 'almanac',
        impact: 5,
        sentiment: 'positive',
        detail: '黄历建除属偏吉之日，利于开展常规事务与推进计划。',
      });
    } else if (CAUTION_OFFICERS.has(officerClean)) {
      baseScore -= 5;
      dimScores.decision -= 5;
      factors.push({
        label: `建除「${calendar.dayOfficer}」提醒`,
        category: 'almanac',
        impact: -5,
        sentiment: 'caution',
        detail: '传统建除提示今日宜守成复盘、避免冒进折腾。',
      });
    }

    if (HUANGDAO_STARS.has(calendar.twelveStar)) {
      baseScore += 4;
      dimScores.career += 2;
      dimScores.relationship += 2;
      factors.push({
        label: `十二值神「${calendar.twelveStar}」黄道`,
        category: 'almanac',
        impact: 4,
        sentiment: 'positive',
        detail: '黄道值日气场通达，沟通接洽与出门办事更易顺手。',
      });
    } else if (HEIDAO_STARS.has(calendar.twelveStar)) {
      baseScore -= 3;
      dimScores.health -= 2;
      factors.push({
        label: `十二值神「${calendar.twelveStar}」黑道`,
        category: 'almanac',
        impact: -3,
        sentiment: 'caution',
        detail: '黑道值日主琐事偏多，重在留足缓冲、减少情绪摩擦。',
      });
    }

    const tabooGods = calendar.gods.filter(
      (g) => g.luck === '凶' && ['十恶大败', '杨公忌', '三娘煞', '四离', '四绝', '岁破', '月破'].includes(g.name),
    );
    if (tabooGods.length > 0) {
      const delta = -Math.min(8, tabooGods.length * 4);
      baseScore += delta;
      dimScores.decision += delta;
      factors.push({
        label: `民俗神煞提示（${tabooGods.map((g) => g.name).join('、')}）`,
        category: 'almanac',
        impact: delta,
        sentiment: 'caution',
        detail: '传统择日避忌临日，重大签约、大额支出或搬迁事宜建议谨慎或延后。',
      });
    }
  } else if (scope === 'monthly' && monthlyDays?.length) {
    const goodCount = monthlyDays.filter((d) => d.rating === '优选').length;
    const cautionCount = monthlyDays.filter((d) => d.rating === '慎用').length;
    if (goodCount >= 10) {
      baseScore += 4;
      dimScores.decision += 4;
      dimScores.career += 2;
      factors.push({
        label: `本月优选日充足（${goodCount} 天）`,
        category: 'almanac',
        impact: 4,
        sentiment: 'positive',
        detail: `全月共 ${monthlyDays.length} 天中占 ${goodCount} 个优选日，关键事务可挑优选日集中落地。`,
      });
    } else if (cautionCount >= 9) {
      baseScore -= 3;
      dimScores.decision -= 3;
      factors.push({
        label: `本月慎用留意日偏多（${cautionCount} 天）`,
        category: 'almanac',
        impact: -3,
        sentiment: 'caution',
        detail: `全月共有 ${cautionCount} 天存在冲克或避忌信号，重要安排建议对照下方月历错峰。`,
      });
    } else {
      factors.push({
        label: `本月吉凶分布均衡（优选 ${goodCount} 天 · 慎用 ${cautionCount} 天）`,
        category: 'almanac',
        impact: 0,
        sentiment: 'neutral',
        detail: `全月共 ${monthlyDays.length} 天，吉日与留意日错落分布，按常规节奏推进并挑优选日办大事即可。`,
      });
    }
  } else if (scope === 'yearly' && yearlyMonths?.length) {
    const strongCount = yearlyMonths.filter((m) => m.trend === '旺').length;
    const cautionCount = yearlyMonths.filter((m) => m.trend === '谨').length;
    if (strongCount >= 5) {
      baseScore += 4;
      dimScores.career += 4;
      dimScores.wealth += 3;
      factors.push({
        label: `全年旺月较多（${strongCount} 个月）`,
        category: 'bazi',
        impact: 4,
        sentiment: 'positive',
        detail: `十二流月中共有 ${strongCount} 个月趋势偏旺，推进主线计划的窗口期较为充裕。`,
      });
    } else if (cautionCount >= 5) {
      baseScore -= 3;
      dimScores.decision -= 3;
      factors.push({
        label: `全年波动转折月较多（${cautionCount} 个月）`,
        category: 'bazi',
        impact: -3,
        sentiment: 'caution',
        detail: `十二流月中共有 ${cautionCount} 个月提示谨慎，全年宜分阶段稳步推进、预留缓冲。`,
      });
    } else {
      factors.push({
        label: `全年流月分布均衡（旺 ${strongCount} 月 · 谨 ${cautionCount} 月）`,
        category: 'bazi',
        impact: 0,
        sentiment: 'neutral',
        detail: `十二流月强弱交替平和，顺势在旺月发力、谨月蓄力调整即可。`,
      });
    }
  }

  // 2. 个人八字流运分析（选定案例时核心驱动）
  if (bazi) {
    const activePillar =
      scope === 'daily'
        ? bazi.flowDayGanZhi
        : scope === 'monthly'
          ? bazi.flowMonthGanZhi
          : bazi.flowYearGanZhi;
    const activeTenGod =
      scope === 'daily'
        ? bazi.flowTenGods.day
        : scope === 'monthly'
          ? bazi.flowTenGods.month
          : bazi.flowTenGods.year;
    const scopeName = scope === 'daily' ? '流日' : scope === 'monthly' ? '流月' : '流年';

    const wx = wuxingImpact(activePillar, bazi.favorableWuxing, bazi.unfavorableWuxing);
    if (wx.delta !== 0) {
      baseScore += wx.delta;
      const pos = wx.delta > 0;
      const stemEl = getStemWuxing(activePillar[0] ?? '甲');
      const branchEl = getBranchWuxing(activePillar[1] ?? '子');
      if (pos) {
        dimScores.career += 5;
        dimScores.wealth += 4;
        dimScores.health += 4;
        dimScores.decision += 5;
        keywords.add('喜用助力');
      } else {
        dimScores.health -= 4;
        dimScores.decision -= 4;
        keywords.add('逆势蓄力');
      }
      factors.push({
        label: `${scopeName}「${activePillar}」五行${pos ? '契合喜用' : '触及忌神'}`,
        category: 'bazi',
        impact: wx.delta,
        sentiment: pos ? 'positive' : 'caution',
        detail: `${scopeName}天干属${stemEl}、地支属${branchEl}，对照日主「${bazi.dayMaster}${bazi.dayMasterElement}」（喜${bazi.favorableWuxing.join('、') || '调候平衡'}），${pos ? '能量顺畅加分' : '宜稳扎稳打、避免强求'}。`,
      });
    }

    // 兼顾流年/大运底盘背景
    if (scope !== 'yearly') {
      const yearWx = wuxingImpact(bazi.flowYearGanZhi, bazi.favorableWuxing, bazi.unfavorableWuxing);
      if (yearWx.delta !== 0) {
        const bgDelta = Math.round(yearWx.delta * 0.4);
        baseScore += bgDelta;
        factors.push({
          label: `流年「${bazi.flowYearGanZhi}」底盘气场`,
          category: 'bazi',
          impact: bgDelta,
          sentiment: bgDelta > 0 ? 'positive' : 'caution',
          detail: `当前流年十神「${bazi.flowTenGods.year}」为阶段底色，${bgDelta > 0 ? '托底有力' : '需留意大环境消耗'}。`,
        });
      }
    }

    const tgInfo = TEN_GOD_DIM_WEIGHTS[activeTenGod];
    if (tgInfo) {
      dimScores.career += tgInfo.career;
      dimScores.wealth += tgInfo.wealth;
      dimScores.relationship += tgInfo.relationship;
      dimScores.health += tgInfo.health;
      dimScores.decision += tgInfo.decision;
      keywords.add(`${activeTenGod} · ${tgInfo.tag}`);
      factors.push({
        label: `${scopeName}十神「${activeTenGod}」主事`,
        category: 'bazi',
        impact: Math.round((tgInfo.career + tgInfo.wealth + tgInfo.decision) / 3),
        sentiment: tgInfo.career + tgInfo.decision >= 6 ? 'positive' : 'neutral',
        detail: tgInfo.desc,
      });
    }

    // 冲合关系解析
    const clashHits = bazi.interactions.filter((item) => /冲|刑|害/.test(item));
    const harmonyHits = bazi.interactions.filter((item) => /合|会/.test(item) && !/冲/.test(item));
    if (harmonyHits.length > 0) {
      const delta = Math.min(7, harmonyHits.length * 3);
      baseScore += delta;
      dimScores.relationship += 5;
      dimScores.decision += 3;
      keywords.add('干支相合');
      factors.push({
        label: `命局触发相合（${harmonyHits.length}处）`,
        category: 'bazi',
        impact: delta,
        sentiment: 'positive',
        detail: `${harmonyHits.slice(0, 2).join('；')}，主合作沟通与人际协调相对顺畅。`,
      });
    }
    if (clashHits.length > 0) {
      const delta = -Math.min(9, clashHits.length * 4);
      baseScore += delta;
      const hitsSpouse = clashHits.some((h) => h.includes('日柱') || h.includes('夫妻'));
      if (hitsSpouse) dimScores.relationship -= 6;
      dimScores.health -= 3;
      dimScores.decision -= 3;
      keywords.add('防变动冲克');
      factors.push({
        label: `命局触发刑冲（${clashHits.length}处）`,
        category: 'bazi',
        impact: delta,
        sentiment: 'caution',
        detail: `${clashHits.slice(0, 2).join('；')}，变动感增强，重要决定建议多核对一遍。`,
      });
    }

    // 神煞亮点
    const goodShensha = bazi.shenshaHits.filter((s) => /天乙贵人|文昌|禄神|天德|月德|将星|太极/.test(s));
    if (goodShensha.length > 0) {
      const delta = Math.min(6, goodShensha.length * 3);
      baseScore += delta;
      dimScores.career += 4;
      dimScores.decision += 3;
      keywords.add(goodShensha[0]);
      factors.push({
        label: `岁运逢吉神（${goodShensha.slice(0, 2).join('、')}）`,
        category: 'bazi',
        impact: delta,
        sentiment: 'positive',
        detail: '遇事较易得贵人提醒、前辈助力或临门转机。',
      });
    }
  }

  // 3. 紫微流运四化分析
  if (ziwei) {
    const activeMutagens =
      scope === 'daily'
        ? ziwei.dailyMutagens
        : scope === 'monthly'
          ? ziwei.monthlyMutagens
          : ziwei.yearlyMutagens;
    const scopeName = scope === 'daily' ? '流日' : scope === 'monthly' ? '流月' : '流年';
    for (const m of activeMutagens) {
      const dimKey = ZIWEI_PALACE_DIM[m.targetPalace];
      if (m.mutagen === '禄') {
        baseScore += 4;
        dimScores.wealth += 5;
        if (dimKey) dimScores[dimKey] += 5;
        keywords.add(`${scopeName}化禄入${m.targetPalace}`);
        factors.push({
          label: `紫微${scopeName}${m.star}化禄入「${m.targetPalace}宫」`,
          category: 'ziwei',
          impact: 4,
          sentiment: 'positive',
          detail: `资源与顺遂感落入本命${m.targetPalace}宫，相关事务机会较多。`,
        });
      } else if (m.mutagen === '权') {
        baseScore += 3;
        dimScores.career += 5;
        if (dimKey) dimScores[dimKey] += 4;
        factors.push({
          label: `紫微${scopeName}${m.star}化权入「${m.targetPalace}宫」`,
          category: 'ziwei',
          impact: 3,
          sentiment: 'positive',
          detail: `掌控感与推动力集中于本命${m.targetPalace}宫，适合主动担当。`,
        });
      } else if (m.mutagen === '科') {
        baseScore += 2;
        dimScores.decision += 4;
        if (dimKey) dimScores[dimKey] += 3;
        factors.push({
          label: `紫微${scopeName}${m.star}化科入「${m.targetPalace}宫」`,
          category: 'ziwei',
          impact: 2,
          sentiment: 'positive',
          detail: `利于名声口碑、文书梳理与贵人点拨（本命${m.targetPalace}宫）。`,
        });
      } else if (m.mutagen === '忌') {
        baseScore -= 4;
        if (dimKey) dimScores[dimKey] -= 6;
        else dimScores.decision -= 3;
        keywords.add(`留意${m.targetPalace}宫`);
        factors.push({
          label: `紫微${scopeName}${m.star}化忌入「${m.targetPalace}宫」`,
          category: 'ziwei',
          impact: -4,
          sentiment: 'caution',
          detail: `本命${m.targetPalace}宫易有牵绊、反复或过度执着，宜提前留白化解。`,
        });
      }
    }
  }

  // 4. 西洋星盘行运相位
  if (astrolabe && astrolabe.topAspects.length > 0) {
    const harmonious = astrolabe.topAspects.filter((a) => a.aspectLabel === '拱相' || a.aspectLabel === '六合');
    const challenging = astrolabe.topAspects.filter((a) => a.aspectLabel === '刑相' || a.aspectLabel === '冲相');
    if (harmonious.length > 0) {
      const top = harmonious[0];
      baseScore += 3;
      dimScores.relationship += 3;
      dimScores.decision += 3;
      factors.push({
        label: `行运${top.movingName}${top.aspectLabel}本命${top.natalName}`,
        category: 'astrolabe',
        impact: 3,
        sentiment: 'positive',
        detail: `星盘流动呈和谐相位（匹配度 ${Math.round(top.strength)}%），心境与节奏更易顺畅对齐。`,
      });
    }
    if (challenging.length > 0) {
      const top = challenging[0];
      baseScore -= 3;
      dimScores.health -= 2;
      dimScores.relationship -= 2;
      factors.push({
        label: `行运${top.movingName}${top.aspectLabel}本命${top.natalName}`,
        category: 'astrolabe',
        impact: -3,
        sentiment: 'caution',
        detail: `存在张力相位（匹配度 ${Math.round(top.strength)}%），提示该议题需更多耐心与弹性处理。`,
      });
    }
  }

  // 5. 五运六气（年运背景与运气相生相克）
  if (scope === 'yearly' && wuyunSummary) {
    let wyDelta = 0;
    let wySentiment: 'positive' | 'neutral' | 'caution' = 'neutral';
    if (wuyunRelation === '顺化' || wuyunRelation === '同气') {
      wyDelta = 3;
      wySentiment = 'positive';
      baseScore += wyDelta;
      dimScores.health += 3;
    } else if (wuyunRelation === '天刑' || wuyunRelation === '不和') {
      wyDelta = -3;
      wySentiment = 'caution';
      baseScore += wyDelta;
      dimScores.health -= 3;
    }
    factors.push({
      label: `年度五运六气${wuyunRelation ? `（${wuyunRelation}）` : '节律'}`,
      category: 'wuyun',
      impact: wyDelta,
      sentiment: wySentiment,
      detail: wuyunSummary,
    });
  }

  if (keywords.size === 0) {
    if (scope === 'yearly') {
      keywords.add(`${calendar.ganzhi.year}年`);
      if (wuyunRelation) keywords.add(`运气${wuyunRelation}`);
      keywords.add(`${calendar.nayin.year}`);
    } else if (scope === 'monthly') {
      keywords.add(`${calendar.ganzhi.month}月`);
      keywords.add(calendar.solarTerm);
      if (monthlyDays?.length) {
        const goodCount = monthlyDays.filter((d) => d.rating === '优选').length;
        keywords.add(`优选${goodCount}天`);
      }
    } else {
      keywords.add(calendar.dayOfficer);
      keywords.add(calendar.twelveStar);
      keywords.add(`${calendar.ganzhi.day}日`);
    }
  }

  const overallScore = clampScore(baseScore);
  const overallTier = toTier(overallScore);

  // 构造 5 维详细解读
  const careerScore = clampScore(dimScores.career);
  const wealthScore = clampScore(dimScores.wealth);
  const relationshipScore = clampScore(dimScores.relationship);
  const healthScore = clampScore(dimScores.health);
  const decisionScore = clampScore(dimScores.decision);

  const activeTenGod = bazi
    ? scope === 'daily'
      ? bazi.flowTenGods.day
      : scope === 'monthly'
        ? bazi.flowTenGods.month
        : bazi.flowTenGods.year
    : null;

  const scopeZh = scope === 'daily' ? '今日' : scope === 'monthly' ? '本月' : '本年';
  const activeGz = scope === 'daily' ? calendar.ganzhi.day : scope === 'monthly' ? calendar.ganzhi.month : calendar.ganzhi.year;
  const generalScopeTag =
    scope === 'daily'
      ? `${calendar.dayOfficer} / ${calendar.twelveStar}`
      : scope === 'monthly'
        ? `${calendar.solarTerm}月令`
        : `${calendar.nayin.year}${wuyunRelation ? ` · 运气${wuyunRelation}` : ''}`;

  const dimensions: FortuneDimension[] = [
    {
      id: 'career',
      label: '事业学业',
      score: careerScore,
      trend: toTrend(careerScore),
      summary: bazi
        ? `十神「${activeTenGod}」主导${scopeZh}工作节奏，${careerScore >= 75 ? '推进顺畅、表现力与条理性佳' : careerScore >= 60 ? '稳步推进即可，宜做好手头交付' : '事务较杂或压力偏高，建议先抓重点'}。`
        : `${scope === 'daily' ? `${calendar.dayOfficer}值令，` : `${activeGz}气场下，`}${careerScore >= 72 ? '适合处理日常推进、协作沟通与按计划落地' : '建议保持节奏稳定，避免同时铺开太多战线'}。`,
    },
    {
      id: 'wealth',
      label: '财富资源',
      score: wealthScore,
      trend: toTrend(wealthScore),
      summary: bazi
        ? `${wealthScore >= 75 ? '财气与资源周转较顺，利于洽谈回报、梳理账目与稳健进账' : wealthScore >= 60 ? '正财平稳，大额消费与冲动投资宜按预算把控' : '易有计划外开销或竞争分流，守住现金流与合约细节'}。`
        : `${scope === 'daily' ? `财神方位在${calendar.dailyDirections.wealth}；` : ''}${wealthScore >= 70 ? '常规收支与资源周转较为顺遂' : '重要花销建议货比三家、避免盲目跟风'}。`,
    },
    {
      id: 'relationship',
      label: '感情人际',
      score: relationshipScore,
      trend: toTrend(relationshipScore),
      summary: bazi
        ? `${relationshipScore >= 75 ? '人缘亲和力上升，适合约见沟通、增进默契或修复误会' : relationshipScore >= 60 ? '相处以平常心和真诚倾听为主，少在细节上较真' : '存在支冲或情绪张力，沟通前先稳住语气，避免翻旧账'}。`
        : `${scope === 'daily' ? `喜神在${calendar.dailyDirections.joy}、阳贵在${calendar.dailyDirections.yangGui}；` : ''}${relationshipScore >= 70 ? '人际往来相对融洽' : '多换位思考，减少无谓争执'}。`,
    },
    {
      id: 'health',
      label: '身心节律',
      score: healthScore,
      trend: toTrend(healthScore),
      summary: `${healthScore >= 75 ? '精气神整体在线，适合规律运动与温和作息' : healthScore >= 60 ? '能量中等平稳，注意劳逸结合与按时休息' : '消耗感偏明显，务必减少熬夜与高负荷连轴转'}。`,
    },
    {
      id: 'decision',
      label: '决策行动',
      score: decisionScore,
      trend: toTrend(decisionScore),
      summary: `${decisionScore >= 75 ? '判断力与外部助力配合较好，适合拍板关键节点与推进正事' : decisionScore >= 60 ? '可按常规推进，重要事项做好二次复核更稳妥' : '变数信号偏多，重大签约或跨步决策宜暂缓观察'}。`,
    },
  ];

  // 开运与宜忌建议
  const defaultPeriodStem = activeGz[0] ?? '甲';
  const luckyWuxing = bazi?.favorableWuxing.length
    ? bazi.favorableWuxing.slice(0, 2)
    : [getStemWuxing(defaultPeriodStem)];
  const luckyColors = [...new Set(luckyWuxing.flatMap((w) => WUXING_COLORS[w] ?? []))].slice(0, 3);
  const luckyDirs = [
    ...new Set([
      ...luckyWuxing.flatMap((w) => WUXING_DIRECTIONS[w] ?? []),
      ...(scope === 'daily' ? [calendar.dailyDirections.wealth, calendar.dailyDirections.joy] : []),
    ]),
  ].slice(0, 3);
  const luckyNums = [...new Set(luckyWuxing.flatMap((w) => WUXING_NUMBERS[w] ?? []))].slice(0, 4);
  const luckyHours = hours
    ? hours.filter((h) => h.rating === '吉').slice(0, 3).map((h) => `${h.name}(${h.range})`)
    : undefined;

  const suitable = bazi
    ? [
        ...(overallScore >= 72 ? ['主动推进核心计划', '约见重要人物或合作洽谈'] : ['梳理手头待办与复盘优化', '稳妥完成既定任务']),
        ...(activeTenGod && /印|食/.test(activeTenGod) ? ['学习研究、文案梳理、调养身心'] : []),
        ...(activeTenGod && /财|官/.test(activeTenGod) ? ['客户跟进、财务对账、落实契约'] : []),
        ...(scope === 'daily' ? calendar.recommends.filter((x) => x !== '诸事不宜').slice(0, 2) : []),
      ].slice(0, 4)
    : scope === 'daily'
      ? calendar.recommends.slice(0, 4)
      : scope === 'monthly'
        ? ['对照本月优选吉日推进关键事项', '顺应节气交替调整作息节奏', '做好月度资源盘点与沟通协调']
        : ['顺应年度主旋律分阶段推进目标', '在旺月发力布局、在波动月守稳沉淀', '重视长期信用与身心续航'];

  const caution = bazi
    ? [
        ...(overallScore < 65 ? ['避免情绪化拍板或临时大额支出'] : ['保持节奏，不因顺遂而忽略核对细节']),
        ...(bazi.interactions.some((x) => /冲/.test(x)) ? ['留意人际沟通语气与出行安全缓冲'] : []),
        ...(scope === 'daily' ? calendar.avoids.filter((x) => x !== '余事勿取').slice(0, 2) : []),
      ].slice(0, 4)
    : scope === 'daily'
      ? calendar.avoids.slice(0, 4)
      : scope === 'monthly'
        ? ['避开慎用日敲定重大合同或大额开支', '注意节气前后作息与情绪波动']
        : ['忌盲目透支体力或高杠杆冒进', '留意转折流月做好预案留白'];

  const headline = bazi
    ? `「${activeGz}${scope === 'daily' ? '日' : scope === 'monthly' ? '月' : '年'} · ${activeTenGod}主事」${scopeZh}综合评级${overallTier}（${overallScore}分）— ${
        overallScore >= 75
          ? '契合个人喜用或吉神助力，适合把握节奏主动作为'
          : overallScore >= 60
            ? '走势整体平稳可控，稳扎稳打更容易出成果'
            : '存在冲克或忌神牵绊，重在守稳边界、留出余地'
      }`
    : `「${activeGz}${scope === 'daily' ? '日' : scope === 'monthly' ? '月' : '年'} · ${generalScopeTag}」${scopeZh}通用趋势${overallTier}（${overallScore}分）— 建议参考以下五维趋势与行动指引安排节奏`;

  return {
    overallScore,
    overallTier,
    headline,
    keywords: [...keywords].slice(0, 5),
    scoreFactors: factors,
    dimensions,
    actionGuide: {
      suitable: suitable.length ? suitable : ['按部就班推进日常事项'],
      caution: caution.length ? caution : ['忌急躁冒进、忌熬夜透支'],
      luckyElements: {
        wuxing: luckyWuxing,
        colors: luckyColors,
        directions: luckyDirs,
        numbers: luckyNums,
        ...(luckyHours?.length ? { hours: luckyHours } : {}),
        focusTip: bazi
          ? `个人喜用偏向「${luckyWuxing.join('、')}」，穿戴或办公环境可适度点缀${luckyColors.join('/')}，优先面向${luckyDirs.join('/')}展开专注工作。`
          : `当日财位在${calendar.dailyDirections.wealth}、喜神在${calendar.dailyDirections.joy}，宜结合自身实际节奏灵活安排。`,
      },
    },
  };
}
