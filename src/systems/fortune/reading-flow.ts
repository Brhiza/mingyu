import { SolarDay } from 'tyme4ts';
import { getDayDuty, getDayTwelveStar } from '../almanac/rules';
import { getSolarYmdHmsPillars } from '../calendar';
import { getBranchWuxing, getStemWuxing } from '../ganzhi-foundation';
import type { FortuneScope } from './types';

export interface FortuneFlowInput {
  scope: FortuneScope;
  mode?: 'personalized' | 'general';
  calendar: {
    year: number;
    month: number;
    day: number;
    ganzhi: { year: string; month: string; day: string };
  };
  baziSummary?: {
    dayMaster?: string;
    favorableWuxing?: string[];
    unfavorableWuxing?: string[];
  } | null;
  overview: {
    overallScore: number;
    overallTier: string;
    headline: string;
    scoreFactors: Array<{
      label: string;
      category: string;
      impact: number;
      sentiment: 'positive' | 'neutral' | 'caution';
      detail: string;
    }>;
    dimensions: Array<{
      id: string;
      label: string;
      score: number;
      trend: '旺' | '平' | '谨';
      summary: string;
    }>;
    actionGuide: {
      suitable: string[];
      caution: string[];
      luckyElements: {
        wuxing: string[];
        colors: string[];
        directions: string[];
        hours?: string[];
      };
    };
  };
  timeline: {
    hours?: Array<{
      name: string;
      range: string;
      ganzhi: string;
      twelveStar: string;
      rating: '吉' | '平' | '慎';
      note: string;
    }>;
    days?: Array<{
      date: string;
      day: number;
      weekday: string;
      lunarDate: string;
      dayGanZhi: string;
      score: number;
      rating: '优选' | '平稳' | '慎用';
      tag: string;
    }>;
    months?: Array<{
      monthIndex: number;
      jieName: string;
      startDate: string;
      endDate: string;
      monthGanZhi: string;
      score: number;
      trend: '旺' | '平' | '谨';
      note: string;
    }>;
  };
}

export interface FortuneActionItem {
  key: string;
  badge: '先' | '辅' | '查';
  tone: 'good' | 'accent' | 'caution';
  title: string;
  detail: string;
}

export interface FortuneKeyWindow {
  key: string;
  label: string;
  range: string;
  tone: 'good' | 'caution';
  usage: string;
}

export interface FortuneRhythmCard {
  key: string;
  dateKey?: string;
  title: string;
  subLabel: string;
  status: string;
  tone: 'good' | 'neutral' | 'caution';
  focus: string;
}

export interface FortuneDecisionFlow {
  actionTitle: string;
  actions: FortuneActionItem[];
  windowsTitle: string;
  keyWindows: FortuneKeyWindow[];
  rhythmTitle: string;
  rhythmCards: FortuneRhythmCard[];
  evidenceGroups: {
    support: Array<{ label: string; detail: string }>;
    caution: Array<{ label: string; detail: string }>;
  };
}

const HUANGDAO_SET = new Set(['青龙', '明堂', '金匮', '天德', '玉堂', '司命']);
const GOOD_DUTIES = new Set(['成', '开', '满', '定', '除']);
const CAUTION_DUTIES = new Set(['破', '闭', '危']);
const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

function dedupePhrase(text: string, blocked: string[]): string {
  const cleaned = text.trim();
  if (!cleaned) return '';
  for (const b of blocked) {
    const ref = b.trim();
    if (ref && ref.length >= 6 && (cleaned === ref || cleaned.includes(ref))) {
      return '';
    }
  }
  return cleaned;
}

function buildDailyWindows(
  hours: NonNullable<FortuneFlowInput['timeline']['hours']>,
): FortuneKeyWindow[] {
  const windows: FortuneKeyWindow[] = [];
  let startIdx = -1;

  for (let i = 0; i <= hours.length; i += 1) {
    const h = hours[i];
    if (h && h.rating === '吉') {
      if (startIdx === -1) startIdx = i;
    } else if (startIdx !== -1) {
      const first = hours[startIdx]!;
      const last = hours[i - 1]!;
      const label = startIdx === i - 1 ? first.name : `${first.name}–${last.name}`;
      const startTime = first.range.split('-')[0] ?? '';
      const endTime = last.range.split('-')[1] ?? '';
      const range = startTime && endTime ? `${startTime}–${endTime}` : first.range;
      const usage =
        windows.length === 0
          ? `推进核心事项、沟通对接与决策落实（${first.twelveStar}临位）`
          : `处理收尾复盘、日常协作与轻负荷安排（${first.note || '气场顺畅'}）`;
      windows.push({
        key: `good-${first.name}-${last.name}`,
        label,
        range,
        tone: 'good',
        usage,
      });
      startIdx = -1;
    }
  }

  const topGood = windows.slice(0, 2);
  const cautionHour = hours.find((h) => h.rating === '慎');
  if (cautionHour) {
    topGood.push({
      key: `caution-${cautionHour.name}`,
      label: `留意 ${cautionHour.name}`,
      range: cautionHour.range,
      tone: 'caution',
      usage: cautionHour.note || `${cautionHour.twelveStar}值时，重要决定先缓一拍`,
    });
  }
  return topGood;
}

function buildMonthlyWindows(
  days: NonNullable<FortuneFlowInput['timeline']['days']>,
): FortuneKeyWindow[] {
  const result: FortuneKeyWindow[] = [];
  const goodDays = [...days].filter((d) => d.rating === '优选').sort((a, b) => b.score - a.score);
  if (goodDays.length > 0) {
    const primary = goodDays[0]!;
    result.push({
      key: `m-good-1`,
      label: `${primary.day}日（${primary.weekday}）`,
      range: `${primary.lunarDate} · ${primary.score}分`,
      tone: 'good',
      usage: primary.tag ? `适宜 ${primary.tag} 及主动推进计划` : '全月较顺窗口，可安排签约、出行或重点启动',
    });
    if (goodDays.length > 1) {
      const secondary = goodDays[1]!;
      result.push({
        key: `m-good-2`,
        label: `${secondary.day}日（${secondary.weekday}）`,
        range: `${secondary.lunarDate} · ${secondary.score}分`,
        tone: 'good',
        usage: '可安排协作洽谈、整理财务或落实待办',
      });
    }
  }
  const cautionDay = [...days]
    .filter((d) => d.rating === '慎用')
    .sort((a, b) => a.score - b.score)[0];
  if (cautionDay) {
    result.push({
      key: `m-caution`,
      label: `留意 ${cautionDay.day}日（${cautionDay.weekday}）`,
      range: `${cautionDay.lunarDate} · ${cautionDay.score}分`,
      tone: 'caution',
      usage: '重要承诺宜反复核对条件，避免情绪化拍板',
    });
  }
  return result;
}

function buildYearlyWindows(
  months: NonNullable<FortuneFlowInput['timeline']['months']>,
): FortuneKeyWindow[] {
  const result: FortuneKeyWindow[] = [];
  const strongMonths = [...months]
    .filter((m) => m.trend === '旺')
    .sort((a, b) => b.score - a.score);
  for (const m of strongMonths.slice(0, 2)) {
    result.push({
      key: `y-good-${m.monthIndex}`,
      label: `${m.jieName} · ${m.monthGanZhi}月`,
      range: `${m.startDate.slice(5)} ~ ${m.endDate.slice(5)}`,
      tone: 'good',
      usage: m.note || '气势走高，适合主动争取突破与阶段落地',
    });
  }
  const cautionMonth = [...months]
    .filter((m) => m.trend === '谨')
    .sort((a, b) => a.score - b.score)[0];
  if (cautionMonth) {
    result.push({
      key: `y-caution-${cautionMonth.monthIndex}`,
      label: `留意 ${cautionMonth.jieName} · ${cautionMonth.monthGanZhi}月`,
      range: `${cautionMonth.startDate.slice(5)} ~ ${cautionMonth.endDate.slice(5)}`,
      tone: 'caution',
      usage: cautionMonth.note || '守稳控险为主，重大改动预留缓冲时间',
    });
  }
  return result;
}

/**
 * 同步推算自基准日次日起未来 7 天的逐日节律（毫秒级计算，不阻塞主线程）。
 */
export function computeSevenDayRhythm(
  year: number,
  month: number,
  day: number,
  baziSummary?: FortuneFlowInput['baziSummary'],
): FortuneRhythmCard[] {
  const favorable = new Set(baziSummary?.favorableWuxing ?? []);
  const unfavorable = new Set(baziSummary?.unfavorableWuxing ?? []);
  const cards: FortuneRhythmCard[] = [];

  for (let offset = 1; offset <= 7; offset += 1) {
    const dt = new Date(Date.UTC(year, month - 1, day + offset));
    const y = dt.getUTCFullYear();
    const m = dt.getUTCMonth() + 1;
    const d = dt.getUTCDate();
    if (y < 1900 || y > 2100) continue;

    const dateKey = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const weekday = WEEKDAY_NAMES[dt.getUTCDay()] ?? '';
    const title = offset === 1 ? '明天' : offset === 2 ? '后天' : weekday;
    const subLabel = `${m}/${d} · ${weekday}`;

    try {
      const solar = SolarDay.fromYmd(y, m, d);
      const lunar = solar.getLunarDay().getName();
      const pillars = getSolarYmdHmsPillars(y, m, d, 12, 0, 0);
      const monthBranch = pillars.month[1]!;
      const dayGanzhi = pillars.day;
      const dayGan = dayGanzhi[0]!;
      const dayBranch = dayGanzhi[1]!;
      const star = getDayTwelveStar(monthBranch, dayBranch);
      const duty = getDayDuty(monthBranch, dayBranch);

      let score = 0;
      if (HUANGDAO_SET.has(star)) score += 2;
      else score -= 1;

      if (GOOD_DUTIES.has(duty)) score += 1;
      else if (CAUTION_DUTIES.has(duty)) score -= 2;

      const stemWx = getStemWuxing(dayGan);
      const branchWx = getBranchWuxing(dayBranch);
      if (favorable.has(stemWx)) score += 2;
      if (favorable.has(branchWx)) score += 2;
      if (unfavorable.has(stemWx)) score -= 2;
      if (unfavorable.has(branchWx)) score -= 2;

      const tone: FortuneRhythmCard['tone'] =
        score >= 2 ? 'good' : score <= -2 ? 'caution' : 'neutral';
      const status = tone === 'good' ? '偏顺' : tone === 'caution' ? '宜稳' : '平稳';
      const focus =
        tone === 'good'
          ? `${dayGanzhi} · ${star}${duty}日，适合推进重点或沟通`
          : tone === 'caution'
            ? `${dayGanzhi} · ${duty}日值事，先确认边界少冒进`
            : `${dayGanzhi} · ${lunar}，按既定节奏有序处理`;

      cards.push({
        key: dateKey,
        dateKey,
        title,
        subLabel,
        status,
        tone,
        focus,
      });
    } catch {
      cards.push({
        key: dateKey,
        dateKey,
        title,
        subLabel,
        status: '平稳',
        tone: 'neutral',
        focus: '按日常节奏稳步推进',
      });
    }
  }

  return cards;
}

function buildWeeklyRhythm(
  days: NonNullable<FortuneFlowInput['timeline']['days']>,
): FortuneRhythmCard[] {
  const cards: FortuneRhythmCard[] = [];
  for (let start = 0; start < days.length; start += 7) {
    const chunk = days.slice(start, start + 7);
    if (!chunk.length) continue;
    const weekNum = Math.floor(start / 7) + 1;
    const first = chunk[0]!;
    const last = chunk[chunk.length - 1]!;
    const avg = Math.round(chunk.reduce((s, d) => s + d.score, 0) / chunk.length);
    const goodCount = chunk.filter((d) => d.rating === '优选').length;
    const cautionCount = chunk.filter((d) => d.rating === '慎用').length;
    const tone: FortuneRhythmCard['tone'] =
      avg >= 76 || (goodCount >= 2 && cautionCount === 0)
        ? 'good'
        : avg < 66 || cautionCount >= 2
          ? 'caution'
          : 'neutral';
    const status = tone === 'good' ? '偏顺' : tone === 'caution' ? '宜稳' : '平稳';
    cards.push({
      key: `week-${weekNum}`,
      title: `第 ${weekNum} 周`,
      subLabel: `${first.day}日–${last.day}日 · 均分${avg}`,
      status,
      tone,
      focus:
        goodCount > 0
          ? `含 ${goodCount} 个优选日，适合集中安排重点`
          : cautionCount > 0
            ? `有 ${cautionCount} 个慎用日，节奏放平优先核对`
            : '整体走势平缓，照常推进既有计划',
    });
  }
  return cards;
}

function buildSeasonalRhythm(
  months: NonNullable<FortuneFlowInput['timeline']['months']>,
): FortuneRhythmCard[] {
  const buckets = [
    { title: '春令（1–3月）', slice: months.slice(0, 3) },
    { title: '夏令（4–6月）', slice: months.slice(3, 6) },
    { title: '秋令（7–9月）', slice: months.slice(6, 9) },
    { title: '冬令（10–12月）', slice: months.slice(9, 12) },
  ];
  return buckets
    .filter((b) => b.slice.length > 0)
    .map((b, idx) => {
      const avg = Math.round(b.slice.reduce((s, m) => s + m.score, 0) / b.slice.length);
      const peak = [...b.slice].sort((a, bItem) => bItem.score - a.score)[0]!;
      const tone: FortuneRhythmCard['tone'] = avg >= 76 ? 'good' : avg < 66 ? 'caution' : 'neutral';
      const status = tone === 'good' ? '偏顺' : tone === 'caution' ? '宜稳' : '平稳';
      return {
        key: `season-${idx}`,
        title: b.title,
        subLabel: `${b.slice.map((m) => m.jieName).join('·')} · 均分${avg}`,
        status,
        tone,
        focus: `${peak.jieName}月（${peak.monthGanZhi}）相对突出：${peak.note}`,
      };
    });
}

export function buildFortuneDecisionFlow(
  data: FortuneFlowInput,
  options: { isCurrentTarget: boolean },
): FortuneDecisionFlow {
  const { scope, overview, timeline, calendar, baziSummary } = data;
  const isCurrent = options.isCurrentTarget;

  const actionTitle =
    scope === 'daily'
      ? isCurrent
        ? '今天先做什么'
        : '当天先做什么'
      : scope === 'monthly'
        ? isCurrent
          ? '本月先做什么'
          : '该月先做什么'
        : isCurrent
          ? '今年先做什么'
          : '该年先做什么';

  const dimsSorted = [...overview.dimensions].sort((a, b) => b.score - a.score);
  const topDim = dimsSorted[0];
  const secondDim = dimsSorted[1];
  const lowDim = dimsSorted[dimsSorted.length - 1];
  const blockedPhrases = [overview.headline];

  // 1. 先做什么
  const goodHourNames =
    timeline.hours?.filter((h) => h.rating === '吉').slice(0, 2).map((h) => h.name).join('、') ??
    '';
  const suitableText = overview.actionGuide.suitable.slice(0, 3).join('、');
  const joinPhrases = (parts: string[]): string =>
    parts
      .map((s) => s.trim().replace(/[。；;]+$/u, ''))
      .filter(Boolean)
      .join('；');

  const firstSummary = topDim ? dedupePhrase(topDim.summary, blockedPhrases) : '';
  const firstDetailParts = [
    firstSummary,
    goodHourNames ? `优先利用 ${goodHourNames}` : '',
    suitableText ? `适合安排：${suitableText}` : '',
  ].filter(Boolean);
  const firstItem: FortuneActionItem = {
    key: 'action-first',
    badge: '先',
    tone: 'good',
    title: topDim ? `抓紧「${topDim.label}」优势先落地` : '先处理当前最明确的重点',
    detail:
      joinPhrases(firstDetailParts) ||
      `顺着${overview.overallTier}基调，先解决一件最关键的事。`,
  };
  blockedPhrases.push(firstItem.detail);

  // 2. 辅助配置
  const colors = overview.actionGuide.luckyElements.colors.slice(0, 2).join('/');
  const dirs = overview.actionGuide.luckyElements.directions.slice(0, 2).join('/');
  const secondSummary = secondDim ? dedupePhrase(secondDim.summary, blockedPhrases) : '';
  const secondItem: FortuneActionItem = {
    key: 'action-support',
    badge: '辅',
    tone: 'accent',
    title: secondDim ? `用环境与节奏托稳「${secondDim.label}」` : '借环境参考整理执行节奏',
    detail: joinPhrases([
      secondSummary,
      colors ? `穿搭或随身可选 ${colors}` : '',
      dirs ? `办公会谈参考 ${dirs} 方` : '',
    ]) || '保持分段专注，重要沟通提前写清要点。',
  };
  blockedPhrases.push(secondItem.detail);

  // 3. 核查边界
  const cautionFactor = overview.scoreFactors.find((f) => f.sentiment === 'caution');
  const lowSummary = lowDim ? dedupePhrase(lowDim.summary, blockedPhrases) : '';
  const cautionList = overview.actionGuide.caution.slice(0, 2).join('、');
  const checkItem: FortuneActionItem = {
    key: 'action-check',
    badge: '查',
    tone: 'caution',
    title: lowDim ? `「${lowDim.label}」先核清条件再拍板` : '留意易耗损环节，确认边界',
    detail: joinPhrases([
      cautionFactor?.detail ? dedupePhrase(cautionFactor.detail, blockedPhrases) : '',
      lowSummary,
      cautionList ? `暂缓或慎选：${cautionList}` : '',
    ]) || '合同条款、开支预算与精力分配多留一道复核。',
  };

  // 关键窗口
  const windowsTitle =
    scope === 'daily' ? '今日关键时段' : scope === 'monthly' ? '本月重点日期' : '今年关键流月';
  const keyWindows =
    scope === 'daily' && timeline.hours
      ? buildDailyWindows(timeline.hours)
      : scope === 'monthly' && timeline.days
        ? buildMonthlyWindows(timeline.days)
        : scope === 'yearly' && timeline.months
          ? buildYearlyWindows(timeline.months)
          : [];

  // 后续节奏
  const rhythmTitle =
    scope === 'daily'
      ? '未来 7 天节奏'
      : scope === 'monthly'
        ? isCurrent
          ? '本月分周节奏'
          : '该月分周节奏'
        : isCurrent
          ? '今年四季节奏'
          : '该年四季节奏';
  const rhythmCards =
    scope === 'daily'
      ? computeSevenDayRhythm(calendar.year, calendar.month, calendar.day, baziSummary)
      : scope === 'monthly' && timeline.days
        ? buildWeeklyRhythm(timeline.days)
        : scope === 'yearly' && timeline.months
          ? buildSeasonalRhythm(timeline.months)
          : [];

  // 判断依据
  const support = overview.scoreFactors
    .filter((f) => f.sentiment !== 'caution')
    .slice(0, 3)
    .map((f) => ({ label: f.label, detail: f.detail }));
  const caution = overview.scoreFactors
    .filter((f) => f.sentiment === 'caution')
    .slice(0, 3)
    .map((f) => ({ label: f.label, detail: f.detail }));

  return {
    actionTitle,
    actions: [firstItem, secondItem, checkItem],
    windowsTitle,
    keyWindows,
    rhythmTitle,
    rhythmCards,
    evidenceGroups: {
      support:
        support.length > 0
          ? support
          : [{ label: `${calendar.ganzhi.day}岁时底色`, detail: '当日干支气势平稳，无明显偏倚。' }],
      caution:
        caution.length > 0
          ? caution
          : [{ label: '冲克压力较轻', detail: '未见突出损耗信号，按现实规划稳步推进即可。' }],
    },
  };
}
