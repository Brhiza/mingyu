import { SolarTime } from 'tyme4ts';
import { getSplitSolarPillars } from './calendar';
import type { z } from 'zod';
import { formatSchoolGuidance, resolvePromptSelection } from '../prompt-selection';
import { evaluateXiaoliurenSchoolAlgorithms, formatSchoolAlgorithmSection } from './school-algorithms';
import { buildMethodSituationDigest } from './situation-digest';
import { formatClassicExcerpts, selectXiaoliurenClassics } from './classics';
import { beijingLunarDateDiscrepancy } from './birth-time';
import { resolveXiaoliurenZiHourMode } from './defaults';
import { sameJsonValue } from '../json-value';
import type { xiaoliurenInput } from '../schema';

type Input = z.infer<typeof xiaoliurenInput>;
type Rule = 'common' | 'duoneng';
type Palace = { index: number; name: string; verse: string };
type PalaceName = '大安' | '留连' | '速喜' | '赤口' | '小吉' | '空亡';
type PalaceMetaEntry = {
  deity: string;
  element: string;
  direction: string;
  yinYang: string;
  numbers: [number, number];
  nature: string;
};
type Data = {
  rule: Rule; ruleLabel: string; method: 'time' | 'numbers'; methodLabel: string; timestamp: number;
  ziHourMode?: '00:00' | '23:00'; leapMonthMode?: 'same' | 'next' | 'split-15'; numbers?: [number, number, number];
  lunarMonth: number; lunarDay: number; isLeapMonth: boolean; hourIndex: number; hourLabel: string;
  ganzhi: { year: string; month: string; day: string; hour: string };
  calculation: { lunarMonth: number; lunarDay: number; hourNumber: number; monthCount: number; dayCount: number; hourCount: number; monthPalaceIndex: number; dayPalaceIndex: number; hourPalaceIndex: number; dayBoundary: string; leapMonthRule: string };
  sequence: { month: Palace; day: Palace; hour: Palace }; primary: Palace; palaceOrder: Palace[];
  evidenceAnalysis: {
    source: string; steps: { stage: string; count: number; index: number; palace: string; role: string }[];
    palaceDetails: {
      month: PalaceMetaEntry & { name: PalaceName };
      day: PalaceMetaEntry & { name: PalaceName };
      hour: PalaceMetaEntry & { name: PalaceName };
    };
    sanGongAnalysis: {
      monthToDay: string;
      dayToHour: string;
      hourBranchElement: string;
      tiYongRelation: string;
      combinationSummary: string;
    };
    limitations: string[]; interpretationOrder: string[];
  };
};
const names = ['大安', '留连', '速喜', '赤口', '小吉', '空亡'] as const;
const palaceMeta: Record<PalaceName, PalaceMetaEntry> = {
  大安: { deity: '青龙', element: '木', direction: '正东', yinYang: '阳', numbers: [1, 5], nature: '吉 · 稳安静止' },
  留连: { deity: '玄武', element: '土', direction: '西南/东北', yinYang: '阴', numbers: [2, 8], nature: '平迟 · 阻滞拖延' },
  速喜: { deity: '朱雀', element: '火', direction: '正南', yinYang: '阳', numbers: [3, 6], nature: '吉 · 迅速喜临' },
  赤口: { deity: '白虎', element: '金', direction: '正西', yinYang: '阴', numbers: [4, 7], nature: '凶 · 口舌争执' },
  小吉: { deity: '六合', element: '水', direction: '正北/西南', yinYang: '阳', numbers: [1, 6], nature: '吉 · 和合转畅' },
  空亡: { deity: '勾陈', element: '土', direction: '中央', yinYang: '阴', numbers: [5, 10], nature: '凶 · 落空无着' },
};
const branchElements: Record<string, string> = {
  子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火',
  午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
};
const wuxingSheng: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const wuxingKe: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
function describeWuxingRelation(aEl: string, bEl: string, aName: string, bName: string): string {
  if (aEl === bEl) return `${aName}（${aEl}）与${bName}（${bEl}）五行比和`;
  if (wuxingSheng[aEl] === bEl) return `${aName}（${aEl}）生${bName}（${bEl}）`;
  if (wuxingSheng[bEl] === aEl) return `${bName}（${bEl}）生助${aName}（${aEl}）`;
  if (wuxingKe[aEl] === bEl) return `${aName}（${aEl}）克${bName}（${bEl}）`;
  if (wuxingKe[bEl] === aEl) return `${bName}（${bEl}）克制${aName}（${aEl}）`;
  return `${aName}（${aEl}）与${bName}（${bEl}）相参`;
}
type XiaoliurenValence = '吉' | '迟滞' | '凶阻';

function palaceValence(name: PalaceName): XiaoliurenValence {
  if (name === '大安' || name === '速喜' || name === '小吉') return '吉';
  if (name === '留连') return '迟滞';
  return '凶阻';
}

function classifyDirectedElementRelation(fromEl: string, toEl: string): '生' | '被生' | '克' | '被克' | '比和' {
  if (fromEl === toEl) return '比和';
  if (wuxingSheng[fromEl] === toEl) return '生';
  if (wuxingSheng[toEl] === fromEl) return '被生';
  if (wuxingKe[fromEl] === toEl) return '克';
  return '被克';
}

export function analyzeXiaoliurenRelations(params: {
  month: PalaceName;
  day: PalaceName;
  hour: PalaceName;
  hourBranch: string;
}) {
  const mMeta = palaceMeta[params.month];
  const dMeta = palaceMeta[params.day];
  const hMeta = palaceMeta[params.hour];
  const hourBranchElement = branchElements[params.hourBranch] ?? '水';

  const mVal = palaceValence(params.month);
  const dVal = palaceValence(params.day);
  const hVal = palaceValence(params.hour);

  let trend: string;
  if (mVal === '吉' && dVal === '吉' && hVal === '吉') trend = '全程顺畅';
  else if (mVal === '吉' && dVal !== '吉' && hVal === '吉') trend = '中段波折、末宫复通';
  else if (mVal !== '吉' && hVal === '吉') trend = '先阻后通';
  else if (mVal === '吉' && hVal !== '吉') trend = '先顺后阻';
  else if (mVal !== '吉' && dVal === '吉' && hVal !== '吉') trend = '中段暂缓、末宫再阻';
  else trend = '全程偏阻';

  const repeats: string[] = [];
  if (params.month === params.day && params.day === params.hour) repeats.push(`三宫同落${params.month}（同象叠重）`);
  else {
    if (params.month === params.day) repeats.push(`初/中同落${params.month}`);
    if (params.day === params.hour) repeats.push(`中/末同落${params.day}`);
    if (params.month === params.hour) repeats.push(`初/末同落${params.month}`);
  }

  const yangCount = [mMeta, dMeta, hMeta].filter((m) => m.yinYang === '阳').length;
  const yinYangBalance =
    yangCount === 3 ? '三宫纯阳' : yangCount === 0 ? '三宫纯阴' : yangCount === 2 ? '两阳一阴' : '两阴一阳';

  const r1 = classifyDirectedElementRelation(mMeta.element, dMeta.element);
  const r2 = classifyDirectedElementRelation(dMeta.element, hMeta.element);
  const monthToDay = describeWuxingRelation(mMeta.element, dMeta.element, `初宫${params.month}`, `中宫${params.day}`);
  const dayToHour = describeWuxingRelation(dMeta.element, hMeta.element, `中宫${params.day}`, `末宫${params.hour}`);
  const monthToHour = describeWuxingRelation(mMeta.element, hMeta.element, `初宫${params.month}`, `末宫${params.hour}`);

  let chainFlow: string;
  if (r1 === '生' && r2 === '生') chainFlow = '连环递生（初生中、中生末，气势贯通）';
  else if (r1 === '被生' && r2 === '被生') chainFlow = '逆向递生（末生中、中生初，反哺回流）';
  else if (r1 === '比和' && r2 === '比和') chainFlow = '三宫五行同气比和';
  else if ((r1 === '克' || r1 === '被克') && (r2 === '克' || r2 === '被克')) chainFlow = '连环克战（初、中、末两段皆见相克）';
  else if ((r1 === '克' || r1 === '被克') && (r2 === '生' || r2 === '被生' || r2 === '比和')) chainFlow = '前克后和（中宫转化后趋于生扶/比和）';
  else if ((r1 === '生' || r1 === '被生' || r1 === '比和') && (r2 === '克' || r2 === '被克')) chainFlow = '前和后克（末段转入相克制衡）';
  else chainFlow = '生比交替（无直接相克）';

  const tiYongCode =
    hMeta.element === hourBranchElement
      ? '体用比和'
      : wuxingSheng[hourBranchElement] === hMeta.element
        ? '用生体'
        : wuxingSheng[hMeta.element] === hourBranchElement
          ? '体生用'
          : wuxingKe[hMeta.element] === hourBranchElement
            ? '体克用'
            : '用克体';
  const tiYongDetail = describeTiYong(hMeta.element, hourBranchElement, params.hour, params.hourBranch);

  const innerSupporters: string[] = [];
  const innerRestrainers: string[] = [];
  for (const [label, el] of [
    [`初宫${params.month}`, mMeta.element],
    [`中宫${params.day}`, dMeta.element],
  ] as const) {
    if (el === hMeta.element || wuxingSheng[el] === hMeta.element) {
      innerSupporters.push(`${label}（${el}${el === hMeta.element ? '比和' : '生'}）`);
    } else if (wuxingKe[el] === hMeta.element) {
      innerRestrainers.push(`${label}（${el}克）`);
    }
  }

  const lines = [
    `三宫递进走势：初宫${params.month}（${mVal}）→中宫${params.day}（${dVal}）→末宫${params.hour}（${hVal}），走势定性：${trend}；阴阳配比：${yinYangBalance}${repeats.length ? `；重宫：${repeats.join('、')}` : ''}。`,
    `三宫五行传递：${chainFlow}；初→中：${monthToDay}；中→末：${dayToHour}；初↔末照应：${monthToHour}。`,
    `体用制衡：${tiYongCode}（${tiYongDetail}）；初/中宫对末宫（体）生扶：${innerSupporters.join('、') || '无'}；克制：${innerRestrainers.join('、') || '无'}。`,
  ];

  return {
    trend,
    yinYangBalance,
    repeats,
    chainFlow,
    monthToHour,
    tiYongCode,
    innerSupporters,
    innerRestrainers,
    text: lines.join('\n'),
  };
}

function describeTiYong(tiEl: string, yongEl: string, tiName: string, hourBranch: string): string {
  const yongLabel = `时支${hourBranch}（${yongEl}）`;
  if (tiEl === yongEl) return `时宫${tiName}（${tiEl}）与${yongLabel}比和，气势相扶`;
  if (wuxingSheng[yongEl] === tiEl) return `${yongLabel}生时宫${tiName}（${tiEl}），外部时势相生为用`;
  if (wuxingSheng[tiEl] === yongEl) return `时宫${tiName}（${tiEl}）泄秀于${yongLabel}，主耗费心力而动`;
  if (wuxingKe[tiEl] === yongEl) return `时宫${tiName}（${tiEl}）克${yongLabel}，可成而需费力掌控`;
  if (wuxingKe[yongEl] === tiEl) return `${yongLabel}克时宫${tiName}（${tiEl}），受时势牵制须审慎`;
  return `时宫${tiName}（${tiEl}）与${yongLabel}互见`;
}
const hours = ['早子时', '丑时', '寅时', '卯时', '辰时', '巳时', '午时', '未时', '申时', '酉时', '戌时', '亥时', '晚子时'];
// Preserved traditional source material; provenance and variant are shown with each result.
const verses: Record<Rule, readonly string[]> = {
  common: [
    '大安事事昌，求财在坤方，失物去不远，宅舍保安康，行人身未动，病者主无妨，将军回田野，仔细更推详。',
    '留连事难成，求谋日未明，官事凡宜缓，去者未回程，失物南方见，急讨方心称，更须防口舌，人口且平平。',
    '速喜喜来临，求财向南行，失物申午未，逢人路上寻，官事有福德，病者无祸侵，田宅六畜吉，行人有信音。',
    '赤口主口舌，官非切宜防，失物急去寻，行人有惊慌，六畜多作怪，病者出西方，更须防咀咒，恐怕染瘟皇。',
    '小吉最吉昌，路上好商量，阴人来报喜，失物在坤方，行人立便至，交关甚是强，凡事皆和合，病者叩穷苍。',
    '空亡事不祥，阴人多乖张，求财无利益，行人有灾殃，失物寻不见，官事有刑伤，病人逢暗鬼，祈解保安康。',
  ],
  duoneng: [
    '大安时青龙主事，百事吉，失物在，行人未动。',
    '留连时玄武主事，凡事难成，求谋日未明，官事只可缓，去者未回程，失物巽上见，急讨方称情，更须防口舌，人口且平平。',
    '速喜时朱雀用事，有喜即至，行人来，公事了，失物离上可觅见。',
    '赤口时白虎用事，有口舌官灾，行人有惊，病者重，有咒咀，失物有争。',
    '小吉时六合主事，去行人至，失物坤方寻得，交关宜利。',
    '空亡时勾陈主事，求财无利，行人有灾，失物难觅，百事无成。',
  ],
};

function palace(index: number, rule: Rule) {
  return { index, name: names[index], verse: verses[rule][index] };
}

function createData(instant: Date, rule: Rule, settings?: NonNullable<Input['xiaoliuren']>): Data {
  if (!Number.isFinite(instant.getTime())) throw new Error('起课时间无效。');
  const ziHourMode = resolveXiaoliurenZiHourMode(settings?.ziHourMode);
  const leapMonthMode = settings?.leapMonthMode ?? 'same';
  const numbers = settings?.numbers;
  const wall = new Date(instant.getTime() + 8 * 60 * 60 * 1000);
  const hour = wall.getUTCHours();
  const lunarDateWall = ziHourMode === '23:00' && hour === 23 ? new Date(instant.getTime() + 9 * 60 * 60 * 1000) : wall;
  const solar = SolarTime.fromYmdHms(wall.getUTCFullYear(), wall.getUTCMonth() + 1, wall.getUTCDate(), hour, wall.getUTCMinutes(), 0);
  const lunarDateSolar = SolarTime.fromYmdHms(lunarDateWall.getUTCFullYear(), lunarDateWall.getUTCMonth() + 1, lunarDateWall.getUTCDate(), ziHourMode === '23:00' && hour === 23 ? 0 : hour, wall.getUTCMinutes(), 0);
  const termSolar = SolarTime.fromYmdHms(wall.getUTCFullYear(), wall.getUTCMonth() + 1, wall.getUTCDate(), hour, wall.getUTCMinutes(), wall.getUTCSeconds());
  const lunar = lunarDateSolar.getLunarHour().getLunarDay();
  const pillars = getSplitSolarPillars(
    {
      year: wall.getUTCFullYear(),
      month: wall.getUTCMonth() + 1,
      day: wall.getUTCDate(),
      hour,
      minute: wall.getUTCMinutes(),
      second: wall.getUTCSeconds(),
    },
    {
      year: wall.getUTCFullYear(),
      month: wall.getUTCMonth() + 1,
      day: wall.getUTCDate(),
      hour,
    },
  );
  const lunarMonth = Math.abs(lunar.getMonth());
  const lunarDay = lunar.getDay();
  const isLeapMonth = lunar.getMonth() < 0;
  const effectiveMonth = !isLeapMonth
    ? lunarMonth
    : leapMonthMode === 'next'
      ? lunarMonth + 1
      : leapMonthMode === 'split-15' && lunarDay > 15
        ? lunarMonth + 1
        : lunarMonth;
  const hourIndex = hour === 23 ? 12 : hour === 0 ? 0 : Math.floor((hour + 1) / 2);
  const hourNumber = (hourIndex % 12) + 1;
  const offset = rule === 'duoneng' ? 1 : 0;
  const monthCount = numbers ? numbers[0] : effectiveMonth;
  const dayCount = numbers ? numbers[0] + numbers[1] - 1 + offset : effectiveMonth + lunarDay - 1 + offset;
  const hourCount = numbers ? numbers[0] + numbers[1] + numbers[2] - 2 + offset : effectiveMonth + lunarDay + hourNumber - 2 + offset;
  const dayBoundary = ziHourMode === '23:00' ? '东八区晚子时（23:00）换日' : '东八区民用日零点换日';
  const leapMonthRule = leapMonthMode === 'next'
    ? '闰月按下一月序顺推'
    : leapMonthMode === 'split-15'
      ? '闰月前十五日按本月、十五日后按下月'
      : '闰月沿用同名月序';
  const calculation = {
    lunarMonth, lunarDay, hourNumber, monthCount, dayCount, hourCount,
    monthPalaceIndex: (monthCount - 1) % 6,
    dayPalaceIndex: (dayCount - 1) % 6,
    hourPalaceIndex: (hourCount - 1) % 6,
    dayBoundary, leapMonthRule,
  };
  return {
    rule, ruleLabel: rule === 'duoneng' ? '《多能鄙事》' : '通行掌诀',
    method: numbers ? ('numbers' as const) : ('time' as const),
    methodLabel: numbers ? '三数起课' : '时间起课',
    timestamp: instant.getTime(),
    ...(ziHourMode !== '00:00' ? { ziHourMode } : {}),
    ...(leapMonthMode !== 'same' ? { leapMonthMode } : {}),
    ...(numbers ? { numbers } : {}),
    lunarMonth, lunarDay, isLeapMonth, hourIndex, hourLabel: hours[hourIndex],
    ganzhi: pillars,
    calculation,
    sequence: {
      month: palace(calculation.monthPalaceIndex, rule),
      day: palace(calculation.dayPalaceIndex, rule),
      hour: palace(calculation.hourPalaceIndex, rule),
    },
    primary: palace(calculation.hourPalaceIndex, rule),
    palaceOrder: names.map((_, index) => palace(index, rule)),
    evidenceAnalysis: (() => {
      const mName = names[calculation.monthPalaceIndex];
      const dName = names[calculation.dayPalaceIndex];
      const hName = names[calculation.hourPalaceIndex];
      const mMeta = palaceMeta[mName], dMeta = palaceMeta[dName], hMeta = palaceMeta[hName];
      const hourBranch = pillars.hour.slice(-1);
      const hourBranchElement = branchElements[hourBranch] ?? '水';
      const monthToDay = describeWuxingRelation(mMeta.element, dMeta.element, `月宫${mName}`, `日宫${dName}`);
      const dayToHour = describeWuxingRelation(dMeta.element, hMeta.element, `日宫${dName}`, `时宫${hName}`);
      const tiYongRelation = describeTiYong(hMeta.element, hourBranchElement, hName, hourBranch);
      const combinationSummary = `三宫递推（月宫起因${mName}［${mMeta.nature}］→日宫过程${dName}［${dMeta.nature}］→时宫落点${hName}［${hMeta.nature}］）；${monthToDay}，${dayToHour}。`;
      return {
        source: rule === 'duoneng' ? '《多能鄙事》卷八·小六壬课时' : '通行俗传小六壬掌诀',
        steps: [
          { stage: '月宫', count: monthCount, index: calculation.monthPalaceIndex, palace: mName, role: '日数起点' },
          { stage: '日宫', count: dayCount, index: calculation.dayPalaceIndex, palace: dName, role: '时辰起点' },
          { stage: '时宫', count: hourCount, index: calculation.hourPalaceIndex, palace: hName, role: '本次占得宫' },
        ],
        palaceDetails: {
          month: { name: mName, ...mMeta },
          day: { name: dName, ...dMeta },
          hour: { name: hName, ...hMeta },
        },
        sanGongAnalysis: {
          monthToDay,
          dayToHour,
          hourBranchElement,
          tiYongRelation,
          combinationSummary,
        },
        limitations: [
          '月宫（初/起因）和日宫（中/过程）反映顺数轨迹，时宫（末/结果）是本次主占得宫。',
          `${dayBoundary}，${leapMonthRule}；此为本次采用的规则。`,
          '通行掌诀与《多能鄙事》起日口径不同，不能混用。',
          '歌诀与三宫体用生克为传统分类模型，应结合问题选取句义，不能直接当作现实必然事件。',
          ...(beijingLunarDateDiscrepancy(instant.getTime()) ? [beijingLunarDateDiscrepancy(instant.getTime())!] : []),
        ],
        interpretationOrder: ['确认问题和起课口径', '复核月日时三宫顺数与体用生克', '以时宫六神、方位、成数及歌诀对应问题', '列出条件与限制'],
      };
    })(),
  };
}

export function calculateXiaoliuren(input: Input, now: string) {
  const data = createData(new Date(input.divinationTime ?? now), input.xiaoliuren?.rule ?? 'common', input.xiaoliuren);
  const summary = {
    title: '小六壬起课结果',
    tags: [`起课口径：${data.ruleLabel}`, `占得宫：${data.primary.name}`, `时辰：${data.hourLabel}`],
    lines: [`顺数轨迹：月宫${data.sequence.month.name}；日宫${data.sequence.day.name}；时宫${data.primary.name}`, `${data.calculation.dayBoundary}；${data.calculation.leapMonthRule}`, ...(beijingLunarDateDiscrepancy(data.timestamp) ? [beijingLunarDateDiscrepancy(data.timestamp)!] : [])],
  };
  return { data, summary, prompt: buildPrompt(data, input.question, input.prompt, now) };
}

const schoolGuidance = {
  shunshu: '六宫顺数法：按本次口径复核农历月、日、时逐宫顺数，以所得时宫回答问题。依据：本次起课所列的六宫顺数规则。',
  gongjue: '六宫歌诀法：按所问事项选取占得时宫歌诀的对应句义，形成判断。依据：本次起课所列的时宫歌诀。',
  daoliu: '道家小六壬法：兼重三宫五行生克链与起课时柱地支引动。依据：本次起课所列五行体用与时干支。',
};

export function promptForXiaoliuren(value: unknown, question: string, options: Input['prompt'], now: string) {
  const data = (value && typeof value === 'object' ? value : undefined) as Data | undefined;
  if (!data || !['common', 'duoneng'].includes(data.rule) || typeof data.timestamp !== 'number' || !Number.isFinite(data.timestamp)) throw new Error('小六壬盘面缺少起课时间或口径。');
  const canonical = createData(new Date(data.timestamp), data.rule, {
    ...(data.ziHourMode ? { ziHourMode: data.ziHourMode } : {}),
    ...(data.leapMonthMode ? { leapMonthMode: data.leapMonthMode } : {}),
    ...(data.numbers ? { numbers: data.numbers } : {}),
  });
  const fields = ['ruleLabel', 'method', 'methodLabel', 'lunarMonth', 'lunarDay', 'isLeapMonth', 'hourIndex', 'hourLabel', 'ganzhi', 'calculation', 'sequence', 'primary', 'palaceOrder'] as const;
  for (const field of fields) if (!sameJsonValue(data[field], canonical[field])) throw new Error(`小六壬盘面 ${field} 与起课时间或口径不一致。`);
  return buildPrompt(canonical, question, options, now);
}

function buildPrompt(data: Data, question: string, options: Input['prompt'], now: string) {
  const selection = resolvePromptSelection('xiaoliuren', options);
  const schools = formatSchoolGuidance(options?.schools, schoolGuidance, {
    heading: '断法',
    multiNote: '多口径合参：分别依据各口径判断，再比较共同点、分歧与对应盘面依据。',
  });
  const classicExcerpts = options?.includeClassics
    ? formatClassicExcerpts(selectXiaoliurenClassics(data.primary.name), '典籍片段')
    : '';
  const hDetail = data.evidenceAnalysis.palaceDetails.hour;
  const sanGong = data.evidenceAnalysis.sanGongAnalysis;
  const relations = analyzeXiaoliurenRelations({
    month: data.evidenceAnalysis.palaceDetails.month.name,
    day: data.evidenceAnalysis.palaceDetails.day.name,
    hour: data.evidenceAnalysis.palaceDetails.hour.name,
    hourBranch: data.ganzhi.hour.slice(-1),
  });
  const methodNote = data.numbers ? `起课方式：三数起课（${data.numbers.join('、')}）；` : '';
  const digestLines = buildMethodSituationDigest('xiaoliuren', data, question);
  const sections = [
    `【传统依据】\n按${data.ruleLabel}的月、日、时逐宫顺数；时宫是本次主占得宫，兼看月日时三宫（起因→过程→落点）生克与时支体用关系。`,
    digestLines.length ? `【局势要点】\n${digestLines.join('\n')}` : '',
    `【时间】\n起课：${new Date(data.timestamp).toISOString()}；提示词时间：${now}；历法时区 UTC+08:00。`,
    `【占卜资料】\n${methodNote}农历${data.isLeapMonth ? '闰' : ''}${data.lunarMonth}月${data.lunarDay}日，${data.hourLabel}；干支：${Object.values(data.ganzhi).join(' ')}。\n月宫（初/起因）：${data.sequence.month.name}（${data.evidenceAnalysis.palaceDetails.month.deity}、${data.evidenceAnalysis.palaceDetails.month.element}）；日宫（中/过程）：${data.sequence.day.name}（${data.evidenceAnalysis.palaceDetails.day.deity}、${data.evidenceAnalysis.palaceDetails.day.element}）；时宫（末/主占）：${data.primary.name}（${hDetail.deity}、${hDetail.direction}、${hDetail.yinYang}${hDetail.element}、成数 ${hDetail.numbers.join('/')}）。\n占得宫歌诀：${data.primary.verse}\n历法口径：${data.calculation.dayBoundary}；${data.calculation.leapMonthRule}。`,
    `【三宫与体用生克】\n${sanGong.combinationSummary}\n体用关系：${sanGong.tiYongRelation}。`,
    `【三宫递进与体用制衡关系】\n${relations.text}`,
    beijingLunarDateDiscrepancy(data.timestamp) ? `【历法差异】\n${beijingLunarDateDiscrepancy(data.timestamp)}` : '',
    selection ? `【解读选择】\n${selection.section}` : '',
    formatSchoolAlgorithmSection(evaluateXiaoliurenSchoolAlgorithms(data, options?.schools)),
    schools,
    options?.includeClassics ? '【经典依据】\n《多能鄙事》卷八·小六壬课时记载了月下起日、日上起时的六宫递推；应结合本次选择的口径。' : '',
    classicExcerpts,
    `【任务】\n围绕问题，以时宫及其歌诀为主，结合顺数过程解释传统取象；区分现实事实、成立条件与适用边界，不把歌诀直接当作确定事件。${selection ? `\n${selection.task}` : ''}`,
    `【问题】\n${question}`,
  ].filter(Boolean);
  const user = sections.join('\n\n');
  return { text: user };
}
