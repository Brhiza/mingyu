/**
 * 轻量级智能岁运时间窗推断（纯同步正则/规则，0 权重依赖，< 0.5ms）
 *
 * 全面覆盖野生自然语言时间表达，自动决定附带的流日 / 流月 / 流年 / 大运粒度：
 * - 整月流日（如“12月整月流日”“下个月每天”）→ 自动展开整月 28–31 天
 * - 整周流日（如“下周每天”“本周每日”“接下来7天”）→ 自动展开 7 天
 * - 精确日期/星期（如“12月8日”“2026-12-08”“下周三”“本周末”“明天/后天/昨天”）→ 精确锚定公历日期
 * - 季节/季度/节庆/月份（如“最近几个月”“年底前”“过年前”“明年上半年”“Q2”“明年3月”“金九银十”）→ 精准映射目标流月
 * - 年龄换算（如“35岁那年”“30到35岁”，传入 birthYear 时）→ 自动换算对应公历年份
 * - 简写/汉字年份（如“二零二六年”“26年”“2028-2030年”）→ 自动提取并扩窗
 */

export type FortuneScopeFocus =
  | 'full-month-days'
  | 'full-week-days'
  | 'explicit-dates'
  | 'day-term'
  | 'month-term'
  | 'explicit-years'
  | 'short-term'
  | 'medium-term'
  | 'lifetime'
  | 'default';

export type FortuneGranularity = 'day' | 'month' | 'year' | 'lifetime';

export interface TargetMonth {
  year: number;
  month: number; // 1..12
}

export interface TargetDate {
  year: number;
  month: number; // 1..12
  day: number; // 1..31
}

export interface FortuneScope {
  focus: FortuneScopeFocus;
  granularity: FortuneGranularity;
  referenceYear: number;
  years: number[];
  explicitYears: number[];
  months: TargetMonth[];
  dates: TargetDate[];
  reason: string;
}

const MIN_YEAR = 1900;
const MAX_YEAR = 2100;
const MAX_RETURNED_YEARS = 6;
const BEIJING_OFFSET_MS = 8 * 3_600_000;

const FULL_MONTH_DAILY_RE =
  /(?:整月|全月|整个月).{0,4}(?:流日|每天|每日|运势)|(?:这个月|本月|下个月|下月|\d{1,2}月).{0,3}(?:每天|每日|所有流日|全部流日)/;

const FULL_WEEK_DAILY_RE =
  /(?:这周|本周|下周|未来一周|这一周|下一周|接下来[7七]天|未来[7七]天).{0,4}(?:每天|每日|所有流日|全部流日|流日|安排|运势)?|(?:一周|7天|七天)(?:所有|全部)?流日/;

const WEEKDAY_RE = /(这周|本周|下周|下个星期|这个星期|星期|周)(一|二|三|四|五|六|日|天|末)/;

const DAY_TERM_RE =
  /(大前天|前天|昨天|昨日|今天|今日|明天|明日|后天|大后天|这几天|近几天|最近几天|未来几天|过几天|十天半个月|半个月|哪一天|哪天|挑个日子|选个日子|哪日|几号|具体日期)/;

const MONTH_TERM_RE =
  /(最近几个月|近几个月|未来几个月|这几个月|接下来几个月|未来[二两三四五六2-6]个月|近[二两三四五六2-6]个月|这[二两三四五六2-6]个月|下个月|下月|这个月|本月|当月|年底前|今年底|过年前|春节前|明年初|明年开春|开春|上半年|下半年|明年上半年|明年下半年|Q[1-4]|第[一二三四1-4]季度|金九银十|流月|哪个月|几月|今年[春夏秋冬]天|明年[春夏秋冬]天)/i;

const LIFETIME_RE =
  /(这辈子|一辈子|一生|终身|终生|什么时候发财|何时发财|什么时候结婚|何时结婚|什么时候转运|何时转运|哪步大运|哪一步大运|大运最好|人生转折|人生高峰|晚年运|中年运|大运走势|十年大运|整体命运|一生运势)/;

const MEDIUM_TERM_RE =
  /(未来[几二两三四五六七八九十2-9]|未来10年|未来[二两三四五2-5]年|近[几二两三四五2-5]年|这[几二两三四五2-5]年|今后[几三四五3-5]年|往后[几三四五3-5]年|接下来[几三四五3-5]年|两三年|三五年|3[-~到至]5年|五年内|三年内|中长期)/;

const SHORT_TERM_RE =
  /(今年|明年|后年|一两年|近期|最近|眼下|当下|这半年|半年内|跳槽|换工作|辞职|离职|签约|签合同|求职|面试|升职|加薪|考试|考研|考公|上岸|表白|求婚|领证|复合|分手|搬家|买房|买车|开业|投资|理财)/;

const CN_DIGIT_MAP: Record<string, string> = {
  零: '0', 〇: '0', 一: '1', 二: '2', 三: '3', 四: '4', 五: '5', 六: '6', 七: '7', 八: '8', 九: '9',
};

function normalizeChineseYears(text: string): string {
  // 二零二六年 / 二〇二七年 -> 2026年 / 2027年
  let out = text.replace(/([一二][零〇一二三四五六七八九]{3})\s*年/g, (_, cn: string) => {
    const digits = [...cn].map((ch) => CN_DIGIT_MAP[ch] ?? ch).join('');
    return `${digits}年`;
  });
  // 26年 / 27年（排除 26岁/1926年/2026年） -> 2026年 / 2027年
  out = out.replace(/(?<!\d)([23]\d)\s*年(?!龄|纪)/g, (_, yy: string) => `20${yy}年`);
  return out;
}

function clampYear(y: number): number {
  return Math.min(MAX_YEAR, Math.max(MIN_YEAR, y));
}

function getBeijingYMD(refTimestamp?: number): TargetDate {
  const ts = typeof refTimestamp === 'number' && Number.isFinite(refTimestamp) ? refTimestamp : Date.now();
  const d = new Date(ts + BEIJING_OFFSET_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function addDays(base: TargetDate, delta: number): TargetDate {
  const d = new Date(Date.UTC(base.year, base.month - 1, base.day + delta));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function addMonths(year: number, month: number, delta: number): TargetMonth {
  const total = year * 12 + (month - 1) + delta;
  const y = Math.floor(total / 12);
  const m = ((total % 12) + 12) % 12 + 1;
  return { year: clampYear(y), month: m };
}

function daysInMonth(year: number, month: number): TargetDate[] {
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: lastDay }, (_, i) => ({ year, month, day: i + 1 }));
}

function stripBirthYearMentions(text: string, refYear: number): string {
  let cleaned = text;
  cleaned = cleaned.replace(
    /(?:出生[于在]?|生于|公历|阳历|农历|阴历)\s*(?:19\d{2}|20\d{2})\s*年?(?:\s*\d{1,2}\s*月(?:\s*\d{1,2}\s*[日号])?)?/g,
    ' ',
  );
  cleaned = cleaned.replace(
    /(?:19\d{2}|20\d{2})\s*年?\s*(?:出生|生人|生的|生(?=[，。,\s]|$)|[男女](?=[，。,\s]|$))/g,
    ' ',
  );
  cleaned = cleaned.replace(
    /(19\d{2}|20\d{2})\s*(?:年|[-/.])\s*\d{1,2}\s*(?:月|[-/.])\s*\d{1,2}\s*[日号]?/g,
    (match, yStr: string) => {
      const y = Number(yStr);
      return y < refYear - 12 ? ' ' : match;
    },
  );
  return cleaned;
}

function extractExplicitDates(text: string, ref: TargetDate): TargetDate[] {
  const cleaned = stripBirthYearMentions(text, ref.year);
  const found: TargetDate[] = [];
  const seen = new Set<string>();
  const pushDate = (y: number, m: number, d: number) => {
    if (y < MIN_YEAR || y > MAX_YEAR || m < 1 || m > 12 || d < 1 || d > 31) return;
    const key = `${y}-${m}-${d}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ year: y, month: m, day: d });
  };

  const fullRe = /(19\d{2}|20\d{2})\s*(?:年|[-/.])\s*(\d{1,2})\s*(?:月|[-/.])\s*(\d{1,2})\s*[日号]?/g;
  for (const m of cleaned.matchAll(fullRe)) {
    pushDate(Number(m[1]), Number(m[2]), Number(m[3]));
  }

  const mdRe = /(明年|后年|今年)?\s*(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/g;
  for (const m of cleaned.matchAll(mdRe)) {
    const prefix = m[1] || '';
    const month = Number(m[2]);
    const day = Number(m[3]);
    let year = ref.year;
    if (prefix === '明年') year = ref.year + 1;
    else if (prefix === '后年') year = ref.year + 2;
    else if (!prefix && (month < ref.month || (month === ref.month && day < ref.day - 7))) {
      year = ref.year + 1;
    }
    pushDate(year, month, day);
  }

  return found.slice(0, 5);
}

function extractExplicitMonths(text: string, ref: TargetDate): TargetMonth[] {
  const cleaned = stripBirthYearMentions(text, ref.year);
  const found: TargetMonth[] = [];
  const seen = new Set<string>();
  const pushM = (y: number, m: number) => {
    if (y < MIN_YEAR || y > MAX_YEAR || m < 1 || m > 12) return;
    const key = `${y}-${m}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ year: y, month: m });
  };

  const re = /(?:(19\d{2}|20\d{2})\s*年|(明年|后年|今年))?\s*(\d{1,2})\s*月(?!\s*\d{1,2}\s*[日号])/g;
  for (const m of cleaned.matchAll(re)) {
    const month = Number(m[3]);
    if (month < 1 || month > 12) continue;
    let year = ref.year;
    if (m[1]) year = Number(m[1]);
    else if (m[2] === '明年') year = ref.year + 1;
    else if (m[2] === '后年') year = ref.year + 2;
    else if (!m[1] && !m[2] && month < ref.month) year = ref.year + 1;
    pushM(year, month);
  }
  return found.slice(0, 6);
}

function extractSeasonalOrQuarterMonths(text: string, ref: TargetDate): TargetMonth[] {
  const targetYear = /明年/.test(text) ? ref.year + 1 : ref.year;
  if (/Q1|第一季度|第1季度/i.test(text)) return [1, 2, 3].map((m) => ({ year: targetYear, month: m }));
  if (/Q2|第二季度|第2季度/i.test(text)) return [4, 5, 6].map((m) => ({ year: targetYear, month: m }));
  if (/Q3|第三季度|第3季度/i.test(text)) return [7, 8, 9].map((m) => ({ year: targetYear, month: m }));
  if (/Q4|第四季度|第4季度/i.test(text)) return [10, 11, 12].map((m) => ({ year: targetYear, month: m }));
  if (/明年上半年/.test(text)) return [1, 2, 3, 4, 5, 6].map((m) => ({ year: ref.year + 1, month: m }));
  if (/明年下半年/.test(text)) return [7, 8, 9, 10, 11, 12].map((m) => ({ year: ref.year + 1, month: m }));
  if (/上半年/.test(text)) return [1, 2, 3, 4, 5, 6].map((m) => ({ year: targetYear, month: m }));
  if (/下半年/.test(text)) return [7, 8, 9, 10, 11, 12].map((m) => ({ year: targetYear, month: m }));
  if (/明年初|明年开春|开春/.test(text)) return [2, 3, 4].map((m) => ({ year: ref.year + 1, month: m }));
  if (/年底前|今年底|过年前|春节前/.test(text)) {
    return [0, 1, 2].map((i) => addMonths(ref.year, ref.month, i));
  }
  if (/金九银十/.test(text)) return [{ year: targetYear, month: 9 }, { year: targetYear, month: 10 }];
  if (/春天/.test(text)) return [2, 3, 4].map((m) => ({ year: targetYear, month: m }));
  if (/夏天/.test(text)) return [5, 6, 7].map((m) => ({ year: targetYear, month: m }));
  if (/秋天/.test(text)) return [8, 9, 10].map((m) => ({ year: targetYear, month: m }));
  if (/冬天/.test(text)) return [{ year: targetYear, month: 11 }, { year: targetYear, month: 12 }, { year: targetYear + 1, month: 1 }];
  return [];
}

function resolveWeekdayDates(text: string, ref: TargetDate): TargetDate[] {
  const m = text.match(WEEKDAY_RE);
  if (!m) return [];
  const prefix = m[1];
  const dayChar = m[2];
  const curDow = new Date(Date.UTC(ref.year, ref.month - 1, ref.day)).getUTCDay(); // 0=Sun..6=Sat
  const curMonBased = curDow === 0 ? 7 : curDow; // 1=Mon..7=Sun
  const isNextWeek = prefix.startsWith('下');

  if (dayChar === '末') {
    const satDelta = (6 - curMonBased) + (isNextWeek ? 7 : curMonBased > 6 ? 7 : 0);
    return [addDays(ref, satDelta), addDays(ref, satDelta + 1)];
  }
  const map: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7 };
  const targetDow = map[dayChar];
  if (!targetDow) return [];
  let delta = targetDow - curMonBased;
  if (isNextWeek) delta += 7;
  else if (delta < 0 && !prefix.startsWith('这') && !prefix.startsWith('本')) delta += 7;
  const anchor = addDays(ref, delta);
  return [addDays(anchor, -1), anchor, addDays(anchor, 1)];
}

function extractAgeYears(text: string, birthYear?: number): number[] {
  if (!birthYear || birthYear < 1900 || birthYear > 2050) return [];
  const found = new Set<number>();
  const rangeRe = /(\d{1,2})\s*岁?\s*(?:-|~|～|到|至)\s*(\d{1,2})\s*岁/g;
  for (const m of text.matchAll(rangeRe)) {
    const a1 = Number(m[1]);
    const a2 = Number(m[2]);
    if (a1 >= 1 && a2 <= 100 && a2 >= a1 && a2 - a1 <= 8) {
      for (let a = a1; a <= a2; a++) found.add(clampYear(birthYear + a));
    }
  }
  const singleRe = /(\d{1,2})\s*岁(?:那年|的时候|左右|前后|运势|怎么样|好不好|适合)?/g;
  for (const m of text.matchAll(singleRe)) {
    const a = Number(m[1]);
    if (a >= 1 && a <= 100) found.add(clampYear(birthYear + a));
  }
  return [...found].sort((a, b) => a - b);
}

function extractExplicitYears(text: string, refYear: number): number[] {
  const cleaned = stripBirthYearMentions(text, refYear);
  const found = new Set<number>();

  const rangeRe = /(19\d{2}|20\d{2})\s*年?\s*(?:-|~|～|到|至)\s*(19\d{2}|20\d{2})\s*年?/g;
  for (const m of cleaned.matchAll(rangeRe)) {
    const start = Number(m[1]);
    const end = Number(m[2]);
    if (start >= MIN_YEAR && end <= MAX_YEAR && end >= start && end - start <= 10) {
      for (let y = start; y <= end; y++) found.add(y);
    }
  }

  const singleRe = /(?<!\d)(19\d{2}|20\d{2})(?!\d)/g;
  for (const m of cleaned.matchAll(singleRe)) {
    const y = Number(m[1]);
    if (y >= MIN_YEAR && y <= MAX_YEAR) found.add(y);
  }

  return [...found].sort((a, b) => a - b);
}

function expandExplicitYears(explicitYears: number[]): number[] {
  const expanded = new Set<number>();
  for (const y of explicitYears) {
    expanded.add(clampYear(y - 1));
    expanded.add(clampYear(y));
    expanded.add(clampYear(y + 1));
  }
  const sorted = [...expanded].sort((a, b) => a - b);
  if (sorted.length <= MAX_RETURNED_YEARS) return sorted;

  const kept = new Set<number>(explicitYears.slice(0, MAX_RETURNED_YEARS));
  for (const y of explicitYears) {
    for (const neighbor of [y - 1, y + 1]) {
      if (kept.size >= MAX_RETURNED_YEARS) break;
      kept.add(clampYear(neighbor));
    }
  }
  return [...kept].sort((a, b) => a - b);
}

/**
 * 根据用户自然语言问题自动推断岁运流日/流月/流年/大运时间窗。
 */
export function inferFortuneScope(
  question: string,
  referenceYear?: number,
  referenceTimestamp?: number,
  birthYear?: number,
): FortuneScope {
  const refDate = getBeijingYMD(referenceTimestamp);
  const refYear =
    typeof referenceYear === 'number' && Number.isInteger(referenceYear) && referenceYear >= MIN_YEAR && referenceYear <= MAX_YEAR
      ? referenceYear
      : refDate.year;
  const effectiveRef: TargetDate = { year: refYear, month: refDate.month, day: refDate.day };

  const q = normalizeChineseYears((question || '').trim());

  // 1. 整月流日请求（如“12月整月流日”“下个月每天运势”）
  if (FULL_MONTH_DAILY_RE.test(q)) {
    const explicitM = extractExplicitMonths(q, effectiveRef);
    const targetM =
      explicitM[0] ??
      (/下个月|下月/.test(q) ? addMonths(effectiveRef.year, effectiveRef.month, 1) : { year: effectiveRef.year, month: effectiveRef.month });
    const dates = daysInMonth(targetM.year, targetM.month);
    const months = [targetM, addMonths(targetM.year, targetM.month, 1)];
    return {
      focus: 'full-month-days',
      granularity: 'day',
      referenceYear: refYear,
      years: [...new Set([targetM.year, targetM.year + 1].map(clampYear))],
      explicitYears: [targetM.year],
      months,
      dates,
      reason: `整月流日窗（${targetM.year}年${targetM.month}月共${dates.length}天）`,
    };
  }

  // 2. 整周 7 天流日请求（如“下周每天”“本周每日”“未来一周每天”）
  if (FULL_WEEK_DAILY_RE.test(q)) {
    const curDow = new Date(Date.UTC(effectiveRef.year, effectiveRef.month - 1, effectiveRef.day)).getUTCDay();
    const curMonBased = curDow === 0 ? 7 : curDow;
    const startOffset = /下周|下一周/.test(q) ? 8 - curMonBased : 0;
    const dates = Array.from({ length: 7 }, (_, i) => addDays(effectiveRef, startOffset + i));
    const months = [0, 1].map((i) => addMonths(effectiveRef.year, effectiveRef.month, i));
    return {
      focus: 'full-week-days',
      granularity: 'day',
      referenceYear: refYear,
      years: [refYear, refYear + 1].map(clampYear),
      explicitYears: [],
      months,
      dates,
      reason: '整周流日窗（7天）',
    };
  }

  // 3. 明确具体日期（如“12月8日”“2026-12-08”）
  const explicitDates = extractExplicitDates(q, effectiveRef);
  if (explicitDates.length > 0) {
    const anchor = explicitDates[0];
    const dates =
      explicitDates.length === 1
        ? [addDays(anchor, -1), anchor, addDays(anchor, 1)]
        : explicitDates;
    const months = [0, 1, 2].map((i) => addMonths(anchor.year, anchor.month, i));
    const years = [...new Set([anchor.year, anchor.year + 1].map(clampYear))];
    return {
      focus: 'explicit-dates',
      granularity: 'day',
      referenceYear: refYear,
      years,
      explicitYears: [anchor.year],
      months,
      dates,
      reason: `指定日期流日窗（${explicitDates.map((d) => `${d.month}月${d.day}日`).join('、')}）`,
    };
  }

  // 4. 明确星期/周末（如“下周三”“本周末”“这周五”）
  const weekdayDates = resolveWeekdayDates(q, effectiveRef);
  if (weekdayDates.length > 0) {
    const months = [0, 1].map((i) => addMonths(effectiveRef.year, effectiveRef.month, i));
    return {
      focus: 'day-term',
      granularity: 'day',
      referenceYear: refYear,
      years: [refYear, refYear + 1].map(clampYear),
      explicitYears: [],
      months,
      dates: weekdayDates,
      reason: `指定星期流日窗（${weekdayDates.length}天）`,
    };
  }

  // 5. 相对日期/挑日子（昨天/今天/明天/后天/这几天/哪一天/十天半个月）
  if (DAY_TERM_RE.test(q)) {
    let startOffset = 0;
    let count = 5;
    if (/大前天/.test(q)) { startOffset = -3; count = 4; }
    else if (/前天/.test(q)) { startOffset = -2; count = 4; }
    else if (/昨天|昨日/.test(q)) { startOffset = -1; count = 4; }
    else if (/大后天/.test(q)) { startOffset = 2; count = 4; }
    else if (/后天/.test(q)) { startOffset = 1; count = 4; }
    else if (/明天|明日/.test(q)) { startOffset = 1; count = 5; }
    else if (/十天半个月|半个月/.test(q)) { startOffset = 0; count = 10; }
    const dates = Array.from({ length: count }, (_, i) => addDays(effectiveRef, startOffset + i));
    const months = [0, 1, 2].map((i) => addMonths(effectiveRef.year, effectiveRef.month, i));
    return {
      focus: 'day-term',
      granularity: 'day',
      referenceYear: refYear,
      years: [refYear, refYear + 1].map(clampYear),
      explicitYears: [],
      months,
      dates,
      reason: `近日/择日流日窗（${count}天+3月）`,
    };
  }

  // 6. 明确月份 / 季节 / 季度 / 最近几个月
  const explicitMonths = extractExplicitMonths(q, effectiveRef);
  const seasonalMonths = extractSeasonalOrQuarterMonths(q, effectiveRef);
  if (explicitMonths.length > 0 || seasonalMonths.length > 0 || MONTH_TERM_RE.test(q)) {
    let months: TargetMonth[];
    if (explicitMonths.length >= 2) {
      months = explicitMonths.slice(0, 6);
    } else if (explicitMonths.length === 1) {
      const m0 = explicitMonths[0];
      months = [-1, 0, 1, 2].map((i) => addMonths(m0.year, m0.month, i));
    } else if (seasonalMonths.length > 0) {
      months = seasonalMonths.slice(0, 6);
    } else {
      const count = /未来[五六56]个月|半年/.test(q) ? 6 : 4;
      const startOff = /下个月|下月/.test(q) ? 1 : 0;
      months = Array.from({ length: count }, (_, i) => addMonths(effectiveRef.year, effectiveRef.month, startOff + i));
    }
    const years = [...new Set([refYear, refYear + 1, ...months.map((m) => m.year)].map(clampYear))].sort((a, b) => a - b).slice(0, 3);
    return {
      focus: 'month-term',
      granularity: 'month',
      referenceYear: refYear,
      years,
      explicitYears: [],
      months,
      dates: [],
      reason: `近期流月窗（${months.length}个月）`,
    };
  }

  // 7. 年龄换算年份（如“35岁那年”“30到35岁”）
  const ageYears = extractAgeYears(q, birthYear);
  if (ageYears.length > 0) {
    const years = expandExplicitYears(ageYears);
    return {
      focus: 'explicit-years',
      granularity: 'year',
      referenceYear: refYear,
      years,
      explicitYears: ageYears,
      months: [],
      dates: [],
      reason: `指定年龄换算流年（${ageYears.join('、')}）`,
    };
  }

  // 8. 明确年份
  const explicitYears = extractExplicitYears(q, refYear);
  if (explicitYears.length > 0) {
    const years = expandExplicitYears(explicitYears);
    return {
      focus: 'explicit-years',
      granularity: 'year',
      referenceYear: refYear,
      years,
      explicitYears,
      months: [],
      dates: [],
      reason: `指定年份（${explicitYears.join('、')}）前后扩窗`,
    };
  }

  // 9. 长期大运
  if (LIFETIME_RE.test(q)) {
    return {
      focus: 'lifetime',
      granularity: 'lifetime',
      referenceYear: refYear,
      years: [refYear, refYear + 1, refYear + 2].map(clampYear),
      explicitYears: [],
      months: [],
      dates: [],
      reason: '长期大运走势（附近期3年流年）',
    };
  }

  // 10. 中期多年
  if (MEDIUM_TERM_RE.test(q)) {
    return {
      focus: 'medium-term',
      granularity: 'year',
      referenceYear: refYear,
      years: [refYear, refYear + 1, refYear + 2, refYear + 3, refYear + 4].map(clampYear),
      explicitYears: [],
      months: [],
      dates: [],
      reason: '中期多年流年（5年窗）',
    };
  }

  // 11. 近期行动节点（3年流年 + 3个月流月）
  if (SHORT_TERM_RE.test(q)) {
    const months = [0, 1, 2].map((i) => addMonths(effectiveRef.year, effectiveRef.month, i));
    return {
      focus: 'short-term',
      granularity: 'month',
      referenceYear: refYear,
      years: [refYear, refYear + 1, refYear + 2].map(clampYear),
      explicitYears: [],
      months,
      dates: [],
      reason: '近期流月与今明流年（3月+3年窗）',
    };
  }

  return {
    focus: 'default',
    granularity: 'year',
    referenceYear: refYear,
    years: [refYear, refYear + 1, refYear + 2].map(clampYear),
    explicitYears: [],
    months: [],
    dates: [],
    reason: '常规默认近期流年（3年窗）',
  };
}
