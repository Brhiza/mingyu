import { LunarYear, SolarTerm } from 'tyme4ts';
import { createUtcTimestamp, getCivilDateTimeAtFixedOffset, getHistoricalTimezoneOffsetAt, resolveCivilTime, type CivilDateTimeParts } from '../../huangji/civil-time';
import { getDunJiaStem } from '../layout';
import { branchPalaces, hasTianPanStar } from '../palace';
import type { QimenData } from '../types';

export type StageModel = 'pillarFourLimits' | 'palaceWalk' | 'fushiAlternating';
export interface StagePolicy {
  model: StageModel;
  anchorRule?: 'birthInstant' | 'solarTermBoundary' | 'lunarNewYear';
  ageSystem?: 'fullYears' | 'nominalAge';
  yearsPerStage?: number;
}
export interface LifetimeStage {
  stageIndex: number;
  title: string;
  ageStart: number;
  ageEnd: number;
  calendarStart: string;
  calendarEnd: string;
  dominantPalaces: Array<{ palace: number; name: string }>;
  associatedMarkers: string[];
  stageTheme: string;
  supportFacts: string[];
  constraintFacts: string[];
  limitations: string[];
}
export interface StageInput {
  birthCivilDate: CivilDateTimeParts;
  clockStandard?: 'civil' | 'true-solar';
  timezone?: number;
  timeZoneId?: string;
  gender?: 'male' | 'female';
  policy: StagePolicy;
}

const pad = (n: number) => String(n).padStart(2, '0');
const dateString = (year: number, month: number, day: number) => `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`;
function anniversary(date: CivilDateTimeParts, years: number) {
  const year = date.year + years;
  if (year < 1 || year > 9999) throw new RangeError('阶段日期超出支持的公历年份。');
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const last = date.month === 2 ? (leap ? 29 : 28) : [4, 6, 9, 11].includes(date.month) ? 30 : 31;
  return dateString(year, date.month, Math.min(date.day, last));
}
function dayBefore(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  const prior = new Date(createUtcTimestamp(year, month - 1, day) - 86_400_000);
  return dateString(prior.getUTCFullYear(), prior.getUTCMonth() + 1, prior.getUTCDate());
}
function anchor(input: StageInput): CivilDateTimeParts {
  const birth = input.birthCivilDate;
  // Validate the civil time and disambiguate IANA transitions even when only the date is used.
  resolveCivilTime({ ...birth, timeZoneId: input.clockStandard === 'true-solar' ? undefined : input.timeZoneId, timezone: input.timezone ?? (input.timeZoneId && input.clockStandard !== 'true-solar' ? undefined : 8) });
  if (input.policy.anchorRule === 'lunarNewYear') {
    const first = LunarYear.fromYear(birth.year).getFirstMonth().getFirstDay().getSolarDay();
    return { ...birth, year: first.getYear(), month: first.getMonth(), day: first.getDay() };
  }
  if (input.policy.anchorRule === 'solarTermBoundary') {
    const term = SolarTerm.fromName(birth.year, '立春').getJulianDay().getSolarTime();
    const instant = new Date(createUtcTimestamp(term.getYear(), term.getMonth() - 1, term.getDay(), term.getHour() - 8, term.getMinute(), term.getSecond()));
    const offset = input.timeZoneId ? getHistoricalTimezoneOffsetAt(instant, input.timeZoneId) : input.timezone ?? 8;
    const local = getCivilDateTimeAtFixedOffset(instant, offset);
    return { ...birth, year: local.year, month: local.month, day: local.day };
  }
  return birth;
}
function supportAndConstraints(chart: QimenData, number: number) {
  const palace = chart.jiuGongGe.find((p) => p.gong === number);
  if (!palace) throw new Error(`终身局缺少${number}宫。`);
  const support: string[] = [], constraints: string[] = [];
  const positiveDoors: Record<string, string> = { 开门: '对外事务与开通', 休门: '休养与交流', 生门: '生发与经营' };
  const difficultDoors: Record<string, string> = { 死门: '收束与停滞', 伤门: '冲突与损耗', 惊门: '突发变化与言语争议' };
  const door = palace.renPan.door, god = palace.shenPan.god;
  if (positiveDoors[door]) support.push(`临${door}，传统门象对应${positiveDoors[door]}`);
  else if (difficultDoors[door]) constraints.push(`临${door}，传统门象涉及${difficultDoors[door]}`);
  else if (door === '杜门') constraints.push('临杜门，传统门象涉及闭藏与专注');
  else if (door === '景门') support.push('临景门，传统门象涉及文书、呈现与声誉议题');
  if (['值符', '太阴', '六合', '九天', '九地'].includes(god)) support.push(`临${god}，传统神象对应助力与协同线索`);
  else if (['白虎', '螣蛇', '玄武'].includes(god)) constraints.push(`临${god}，传统神象涉及阻力或变动议题`);
  if (chart.voidPalaces?.some((p) => p.palace === number)) constraints.push('宫逢旬空，该宫议题须待出空、填实或冲实之期方能兑现');
  if (chart.horseStar?.palace === number) support.push('临驿马星，传统取象涉及移动与变化');
  for (const pattern of chart.classicPatterns ?? []) if (pattern.palaces.includes(number)) {
    if (pattern.type === 'good') support.push(`成吉格「${pattern.name}」：${pattern.summary}`);
    if (pattern.type === 'bad') constraints.push(`逢凶格「${pattern.name}」：${pattern.summary}`);
  }
  return { support, constraints };
}

/** 根据出生日期与选定口径生成阶段卡，日期范围两端均包含。 */
export function buildLifetimeStages(chart: QimenData, input: StageInput): LifetimeStage[] {
  const { policy } = input;
  if (!['pillarFourLimits', 'palaceWalk', 'fushiAlternating'].includes(policy.model)) throw new Error('未知终身局分运模型。');
  if (policy.anchorRule && !['birthInstant', 'solarTermBoundary', 'lunarNewYear'].includes(policy.anchorRule)) throw new Error('未知阶段日期锚点。');
  if (policy.ageSystem && !['fullYears', 'nominalAge'].includes(policy.ageSystem)) throw new Error('未知年龄口径。');
  if (policy.yearsPerStage !== undefined && policy.model !== 'palaceWalk') throw new Error('仅九宫巡行支持设置每阶段年数。');
  if (policy.model === 'palaceWalk' && !input.gender) throw new Error('九宫巡行顺逆须指定性别取法。');
  const span = policy.yearsPerStage ?? 10;
  if (policy.model === 'palaceWalk' && (!Number.isInteger(span) || span < 1 || span > 100)) throw new Error('九宫巡行每阶段年数须为 1 至 100 的整数。');
  const base = anchor(input), offset = policy.ageSystem === 'nominalAge' ? 1 : 0;
  const name = (n: number) => chart.jiuGongGe.find((p) => p.gong === n)?.name ?? `${n}宫`;
  type Definition = { title: string; start: number; end: number; palaces: number[]; markers: string[]; theme: string; limitation: string };
  const definitions: Definition[] = [];
  if (policy.model === 'pillarFourLimits') {
    const pillars = [chart.ganzhi.year, chart.ganzhi.month, chart.ganzhi.day, chart.ganzhi.hour];
    const stemPalaces = pillars.map((pillar) => {
      const stem = pillar[0] === '甲' ? getDunJiaStem(pillar) : pillar[0];
      return chart.jiuGongGe.filter((p) => p.tianPan.stem === stem || p.tianPan.companionStem === stem || p.diPan.stem === stem).map((p) => p.gong);
    });
    const append = (i: number, palace: number | undefined) => { if (palace && !stemPalaces[i].includes(palace)) stemPalaces[i].push(palace); };
    append(0, branchPalaces[pillars[0][1]]); append(1, branchPalaces[pillars[1][1]]);
    append(3, chart.jiuGongGe.find((p) => p.renPan.door === chart.zhiShi)?.gong);
    const titles = ['初限·早年阶段', '中前限·青年阶段', '中后限·中年阶段', '末限·晚年阶段'];
    const themes = ['年柱主限：以年干、年支落宫观察早年家庭与学习议题。', '月柱主限：以月干、月支落宫观察青年阶段的交往与事务发展。', '日柱主限：以日干落宫观察中年阶段的个人事务。', '时柱主限：以时干及值使门落宫观察晚年阶段议题。'];
    const marks = [[`年干${pillars[0][0]}`, `年支${pillars[0][1]}`], [`月干${pillars[1][0]}`, `月支${pillars[1][1]}`], [`日干${pillars[2][0]}`], [`时干${pillars[3][0]}`, `值使${chart.zhiShi}`]];
    const boundaries = [0, 17, 33, 49, 81];
    for (let i = 0; i < 4; i++) definitions.push({ title: titles[i], start: boundaries[i], end: boundaries[i + 1] - 1, palaces: stemPalaces[i], markers: marks[i], theme: themes[i], limitation: '四柱分限只反映人生不同年龄主干阶段的能量倾向与宏观节奏，不代表具体某一年的必然事件。' });
  } else if (policy.model === 'palaceWalk') {
    const yang = ['甲', '丙', '戊', '庚', '壬'].includes(chart.ganzhi.year[0]);
    const clockwise = input.gender === 'female' ? !yang : yang;
    const ring = clockwise ? [1, 8, 3, 4, 9, 2, 7, 6] : [1, 6, 7, 2, 9, 4, 3, 8];
    const first = ring.indexOf(branchPalaces[chart.ganzhi.year[1]]);
    if (first < 0) throw new Error('无法定位年支的九宫巡行起点。');
    for (let i = 0; i < 9; i++) {
      const palace = ring[(first + i) % ring.length];
      definitions.push({ title: `行限第${i + 1}步（${name(palace)}）`, start: i * span, end: (i + 1) * span - 1, palaces: [palace], markers: [`行限临${name(palace)}`], theme: `九宫巡行运限：当值${name(palace)}，能量由该宫门星神干及奇仪克应主导。`, limitation: '九宫巡行阶段卡依据洛书运限流布生成；外圈八宫循环，九个阶段中首宫会再次出现，需结合流年动态合参。' });
    }
  } else {
    const fu = chart.jiuGongGe.find((p) => hasTianPanStar(p, chart.zhiFu))?.gong;
    const shi = chart.jiuGongGe.find((p) => p.renPan.door === chart.zhiShi)?.gong;
    if (!fu || !shi) throw new Error('终身局无法定位值符星或值使门。');
    for (let i = 0; i < 8; i++) {
      const palace = i % 2 === 0 ? fu : shi, role = i % 2 === 0 ? '值符星' : '值使门';
      definitions.push({ title: `符使交替第${i + 1}段`, start: i * 10, end: (i + 1) * 10 - 1, palaces: [palace], markers: [`${role}${i % 2 === 0 ? chart.zhiFu : chart.zhiShi}`], theme: `符使交替十年分段：第${i + 1}段由${name(palace)}的${role}气机作为阶段观察入口。`, limitation: '本模型是值符宫与值使宫交替的十年分段；不等同于《奇门遁甲统宗》的六爻运限，也不表示真实卦爻推演。' });
    }
  }
  return definitions.map((definition, stageIndex) => {
    const facts = definition.palaces.map((p) => supportAndConstraints(chart, p));
    return { stageIndex, title: definition.title, ageStart: definition.start + offset, ageEnd: definition.end + offset,
      calendarStart: anniversary(base, definition.start), calendarEnd: dayBefore(anniversary(base, definition.end + 1)),
      dominantPalaces: definition.palaces.map((p) => ({ palace: p, name: name(p) })), associatedMarkers: definition.markers, stageTheme: definition.theme,
      supportFacts: [...new Set(facts.flatMap((f) => f.support))], constraintFacts: [...new Set(facts.flatMap((f) => f.constraints))], limitations: [definition.limitation] };
  });
}
