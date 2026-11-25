/**
 * 生产级「风格 A · 纯内核命理小模型」超浓缩纯事实输入卡与真值提取器
 *
 * 将本地引擎完整排盘结果无损浓缩为 ~480 字纯事实输入卡（含当日四层基准锚点），
 * 同时生成供本地护栏 1 毫秒真值核验使用的 GroundTruthFacts。
 */
import { calculate } from '../core';
import { buildPatternRelations } from '../systems/bazi/pattern-relations';
import { buildCompactFortuneDynamics } from '../systems/bazi/fortune-compact';
import { inferFortuneScope } from '../router-model/fortune-scope';
import { getSixtyCycleName, getYearSixtyCycle } from '../systems/ganzhi-foundation';
import { getMutagensByStem, type HeavenlyStem } from '../systems/ziwei/index';

const STEM_META: Record<string, { el: number; yang: boolean }> = {
  甲: { el: 0, yang: true }, 乙: { el: 0, yang: false },
  丙: { el: 1, yang: true }, 丁: { el: 1, yang: false },
  戊: { el: 2, yang: true }, 己: { el: 2, yang: false },
  庚: { el: 3, yang: true }, 辛: { el: 3, yang: false },
  壬: { el: 4, yang: true }, 癸: { el: 4, yang: false },
};

export function computeTenGod(dayMaster: string, targetStem: string): string {
  const dm = STEM_META[dayMaster];
  const tg = STEM_META[targetStem];
  if (!dm || !tg) return '';
  const samePol = dm.yang === tg.yang;
  const diff = (tg.el - dm.el + 5) % 5;
  if (diff === 0) return samePol ? '比肩' : '劫财';
  if (diff === 1) return samePol ? '食神' : '伤官';
  if (diff === 2) return samePol ? '偏财' : '正财';
  if (diff === 3) return samePol ? '七杀' : '正官';
  return samePol ? '偏印' : '正印';
}
import { formatFeixingHighlights } from '../systems/ziwei-flying';

export type StyleASystem = 'bazi' | 'ziwei';
export type StyleATopic = 'career' | 'wealth' | 'relationship' | 'health' | 'timing' | 'overall';

export const STYLE_A_SECTIONS = [
  '【定格与强弱】',
  '【病药与喜忌】',
  '【核心象义】',
  '【岁运引动】',
  '【边界核验】',
] as const;

export const STYLE_A_SYSTEM_PROMPT = [
  '你是命理内核推演引擎，只输出供下游大模型消费的“风格 A 极简硬核断语”。',
  '严格遵守以下契约：',
  '1. 必须按顺序且仅输出以下 5 个固定分段：【定格与强弱】【病药与喜忌】【核心象义】【岁运引动】【边界核验】。',
  '2. 总字数控制在 160–340 字，信息密度拉满，直击格局成败、病药轻重、十神/星曜象义与岁运触发点。',
  '3. 严禁写给普通人看的通俗铺垫、共情安抚、鸡汤建议或套话。',
  '4. 严禁编造输入盘面中不存在的四柱、星曜、宫位；可基于当日四层基准锚点按 60 甲子严密顺推后续流年/流月/流日与紫微十干四化。',
].join('\n');

export interface AnchorFourLayers {
  referenceDate: string;
  dayun: string | null;
  dayunDirection?: 'forward' | 'backward';
  yearGanZhi: string;
  monthGanZhi: string | null;
  dayGanZhi: string;
}

export interface BaziGuardrailFacts {
  system: 'bazi';
  gender: 'male' | 'female';
  pillars: { year: string; month: string; day: string; hour: string };
  dayMaster: string;
  monthBranch: string;
  strengthStatus: string;
  pattern: string;
  favorableWuxing: string[];
  unfavorableWuxing: string[];
  usefulGod: string;
  avoidGod: string;
  currentDayun: string | null;
  anchor: AnchorFourLayers;
  targetYears: Array<{ year: number; ganZhi: string }>;
  allAllowedGanZhi: string[];
}

export interface ZiweiGuardrailFacts {
  system: 'ziwei';
  gender: 'male' | 'female';
  mingBranch: string;
  bodyBranch: string;
  fiveElementsClass: string;
  mutagenSchool?: 'default' | 'zhongzhou' | 'quanshu' | 'tianfu';
  mingMajorStars: string[];
  palaceMajorStars: Record<string, string[]>;
  palaceBranches: Record<string, string>;
  patterns: string[];
  currentDecadal: string | null;
  anchor: AnchorFourLayers;
  targetYears: Array<{ year: number; ganZhi: string; palace: string }>;
  allAllowedStars: string[];
  allAllowedGanZhi: string[];
}

export type GuardrailFacts = BaziGuardrailFacts | ZiweiGuardrailFacts;

export interface CompactModelCardResult {
  system: StyleASystem;
  topic: StyleATopic;
  systemPrompt: string;
  userPrompt: string;
  facts: GuardrailFacts;
}

const SHA_STARS = new Set(['擎羊', '陀罗', '火星', '铃星', '地空', '地劫']);
const BASE_DAY_UTC = Date.UTC(2000, 0, 1); // 2000-01-01 = 戊午 (54)

function getExactDayGanZhiByTs(ts: number): { dateStr: string; gz: string; year: number } {
  const d = new Date(ts + 8 * 3_600_000);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const diffDays = Math.round((Date.UTC(year, month - 1, day) - BASE_DAY_UTC) / 86_400_000);
  return {
    dateStr: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    gz: getSixtyCycleName(54 + diffDays),
    year,
  };
}

export function inferStyleATopic(question: string): StyleATopic {
  if (/事业|工作|职场|跳槽|晋升|仕途|创业|体制/.test(question)) return 'career';
  if (/财|赚钱|投资|合伙|破财|买房|资产|收入|资金/.test(question)) return 'wealth';
  if (/感情|婚|恋|桃花|伴侣|对象|复合|分手|夫妻/.test(question)) return 'relationship';
  if (/健康|身体|体质|气血|病|睡眠|劳损/.test(question)) return 'health';
  if (/哪年|哪月|哪天|流年|流月|流日|顺推|节点|应期|转折|明年|下个月|这周/.test(question)) return 'timing';
  return 'overall';
}

function buildYearJiaziAnchorLine(centerYear: number, question: string): string {
  const yrs = new Set<number>();
  for (let y = centerYear - 2; y <= centerYear + 4; y++) yrs.add(y);
  for (const m of question.matchAll(/(19\d{2}|20\d{2})/g)) {
    const y = Number(m[1]);
    if (y >= 1950 && y <= 2060) yrs.add(y);
  }
  const sorted = [...yrs].sort((a, b) => a - b);
  return `流年干支速查：${sorted.map((y) => `${y}${getYearSixtyCycle(y)}`).join('｜')}`;
}

export async function buildStyleACompactCard(params: {
  system: StyleASystem;
  birth: {
    calendar: 'solar' | 'lunar';
    year: number;
    month: number;
    day: number;
    leapMonth?: boolean;
    timezone: number;
    timeZoneId?: string;
    timeStandard: 'civil' | 'true-solar';
    longitude?: number;
    clock: { kind: 'exact'; hour: number; minute: number; second: number };
  };
  gender: 'male' | 'female';
  question: string;
  referenceTime?: string;
  /** 仅给当日四层锚点，不展开未来多年列表（让模型自主按60甲子顺推） */
  anchorOnly?: boolean;
}): Promise<CompactModelCardResult> {
  const refIso = params.referenceTime ?? new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const refTs = Date.parse(refIso);
  const { dateStr, gz: todayDayGz, year: rawRefYear } = getExactDayGanZhiByTs(refTs);
  const refYear = rawRefYear;
  const topic = inferStyleATopic(params.question);

  if (params.system === 'bazi') {
    const res = await calculate('bazi', {
      birth: params.birth,
      gender: params.gender,
      referenceTime: refIso,
      question: params.question,
    });
    const data: any = res.data;
    if (!data.chart || !data.fortune) {
      throw new Error('生成八字风格A输入卡需要精确出生时分秒与性别。');
    }
    const chart = data.chart;
    const fortune = data.fortune;
    const pr = buildPatternRelations({
      pillars: chart.pillars,
      strength: chart.strength,
      patternOverview: chart.patternOverview,
      ordinaryPattern: chart.ordinaryPattern,
      usefulGod: chart.usefulGod,
    });
    const compact = buildCompactFortuneDynamics({
      chart,
      fortune,
      patternRelations: pr,
      question: params.question,
      referenceTime: refTs,
      referenceYear: refYear,
    });
    const p = chart.pillars;
    const ug = chart.usefulGod;
    const rels = (chart.natalFacts?.relations ?? [])
      .filter((r: any) => !r.name.includes('天干') && !r.name.includes('同支'))
      .slice(0, 6)
      .map((r: any) => `${r.values.join('')}${r.name}`)
      .join('、') || '无明显刑冲合害';
    const roots = (chart.strength?.roots ?? [])
      .map((r: any) => `${r.branch}藏${r.stem}(${r.actionable ? '有效' : '受冲'})`)
      .join('、') || '无同气根';
    const chains = (pr.conflictChains ?? [])
      .slice(0, 2)
      .map((c: any) => `${c.conflict}(损${c.target}→需${c.remedyNeeded},${c.rescueStatus})`)
      .join('；') || '无明显破格冲突链';
    const dayunStr = (compact.dayun ?? [])
      .map((d: any) => {
        const stemGod = d.ganZhi?.[0] ? computeTenGod(p.day.gan, d.ganZhi[0]) : '';
        const extra = [stemGod ? `${d.ganZhi[0]}${stemGod}` : '', d.wuxingTag, ...(d.clashTags ?? []), d.remedyTag, d.pathogenTag].filter(Boolean).join('·');
        return `${d.ganZhi}(${d.startYear}-${d.endYear}${d.isCurrent ? '·当前' : ''}${extra ? `·${extra}` : ''})`;
      })
      .join('｜');
    const visGods = (chart.natalFacts?.tenGodDistribution ?? [])
      .filter((t: any) => t.visible.length > 0)
      .map((t: any) => `${t.tenGod}(透)`)
      .join('、') || '无';
    const missingWx = (['木', '火', '土', '金', '水'] as const).filter(
      (el) => ![p.year, p.month, p.day, p.hour].some((x: any) => x.stemElement === el || x.branchElement === el),
    );
    const missingText = missingWx.length ? `原局明字缺${missingWx.join('、')}` : '五行明字俱全';

    const curCycle = data.located?.inChildhood
      ? null
      : (compact.dayun?.find((c: any) => c.isCurrent) ?? null);
    const anchor: AnchorFourLayers = {
      referenceDate: dateStr,
      dayun: curCycle?.ganZhi ?? null,
      dayunDirection: fortune.direction,
      yearGanZhi: data.located?.year?.ganZhi ?? getYearSixtyCycle(refYear),
      monthGanZhi: data.located?.month?.ganZhi ?? null,
      dayGanZhi: data.located?.day?.ganZhi ?? todayDayGz,
    };

    const anchorLine = `当日四层基准（${anchor.referenceDate}）：大运${anchor.dayun ?? '童限'}(${fortune.direction === 'forward' ? '顺行' : '逆行'})｜流年${anchor.yearGanZhi}｜流月${anchor.monthGanZhi ?? '按节令'}｜流日${anchor.dayGanZhi}`;
    const jiaziAnchorLine = buildYearJiaziAnchorLine(refYear, params.question);
    const yearLine = params.anchorOnly
      ? `${anchorLine}\n${jiaziAnchorLine}（后续大运/流年/流月/流日请按60甲子自行顺推）`
      : `${anchorLine}\n${jiaziAnchorLine}\n流年：${(compact.years ?? []).map((y: any) => {
          const stemGod = y.ganZhi?.[0] ? computeTenGod(p.day.gan, y.ganZhi[0]) : '';
          const tags = [stemGod ? `${y.ganZhi[0]}${stemGod}` : '', y.wuxingTag, ...(y.clashTags ?? []), y.remedyTag, y.pathogenTag].filter(Boolean).join('·');
          return `${y.year}${y.ganZhi}(${tags || '平'})`;
        }).join('｜')}`;

    const userPrompt = [
      `【八字核心事实】`,
      `性别：${params.gender === 'female' ? '女' : '男'}；四柱：年${p.year.ganZhi}(${p.year.tenGod}) 月${p.month.ganZhi}(${p.month.tenGod}) 日${p.day.ganZhi}(日主${p.day.gan}，支藏${p.day.hiddenStems?.[0]?.tenGod ?? ''}) 时${p.hour.ganZhi}(${p.hour.tenGod})；${missingText}`,
      `月令与旺衰：${p.month.zhi}月（${chart.strength?.month?.season ?? ''}，司权${chart.monthCommander?.stem ?? ''}）；日主根气：${roots}；旺衰：${chart.strength?.status ?? '中和'}`,
      `格局与互制：立${chart.patternOverview?.pattern ?? chart.ordinaryPattern?.candidate ?? '普通格'}；冲突救应：${chains}`,
      `用神与调候：主用${ug.useful}、喜五行[${(ug.favorableWuxing ?? []).join('、')}]；主忌${ug.avoid}、忌五行[${(ug.unfavorableWuxing ?? []).join('、')}]；调候与扶抑：${ug.tradeoffAnalysis?.climateVsBalance?.status ?? '一致'}`,
      `透干与地支关系：透干十神[${visGods}]；地支关系[${rels}]`,
      `大运：${dayunStr}`,
      yearLine,
      `【用户问题】${params.question}`,
    ].join('\n');

    const allowedGz = new Set<string>([
      p.year.ganZhi, p.month.ganZhi, p.day.ganZhi, p.hour.ganZhi,
      anchor.yearGanZhi, anchor.dayGanZhi,
      ...(anchor.monthGanZhi ? [anchor.monthGanZhi] : []),
    ]);
    for (const c of fortune.cycles ?? []) allowedGz.add(c.ganZhi);
    for (const y of compact.years ?? []) allowedGz.add(y.ganZhi);
    for (const m of compact.months ?? []) allowedGz.add(m.ganZhi);
    for (const d of compact.days ?? []) allowedGz.add(d.ganZhi);

    return {
      system: 'bazi',
      topic,
      systemPrompt: STYLE_A_SYSTEM_PROMPT,
      userPrompt,
      facts: {
        system: 'bazi',
        gender: params.gender,
        pillars: { year: p.year.ganZhi, month: p.month.ganZhi, day: p.day.ganZhi, hour: p.hour.ganZhi },
        dayMaster: p.day.gan,
        monthBranch: p.month.zhi,
        strengthStatus: String(chart.strength?.status ?? '中和'),
        pattern: String(chart.patternOverview?.pattern ?? chart.ordinaryPattern?.candidate ?? '普通格'),
        favorableWuxing: ug.favorableWuxing ?? [],
        unfavorableWuxing: ug.unfavorableWuxing ?? [],
        usefulGod: ug.useful ?? '',
        avoidGod: ug.avoid ?? '',
        currentDayun: curCycle ? curCycle.ganZhi : null,
        anchor,
        targetYears: (compact.years ?? []).map((y: any) => ({ year: y.year, ganZhi: y.ganZhi })),
        allAllowedGanZhi: [...allowedGz],
      },
    };
  }

  // 紫微斗数
  const res = await calculate('ziwei', {
    birth: params.birth,
    gender: params.gender,
    referenceTime: refIso,
    question: params.question,
  });
  const data: any = res.data;
  if (!data.natal) throw new Error('生成紫微风格A输入卡需要精确出生时分秒。');
  const natal = data.natal;
  const palaces: any[] = natal.palaces;
  const birthYear = Number(data.basis.effectiveDate.slice(0, 4));
  const layers = data.reference?.layers;
  const refYearlyGz = layers?.yearly ? `${layers.yearly.heavenlyStem}${layers.yearly.earthlyBranch}` : '';
  const effectiveRefYear =
    refYearlyGz && getYearSixtyCycle(refYear) !== refYearlyGz && getYearSixtyCycle(refYear - 1) === refYearlyGz
      ? refYear - 1
      : refYear;
  const currentNominalAge =
    typeof layers?.age?.nominalAge === 'number'
      ? layers.age.nominalAge
      : effectiveRefYear - birthYear + 1;
  const fortuneScope = inferFortuneScope(params.question, effectiveRefYear, refTs, birthYear);

  const palaceLines = palaces.map((p: any) => {
    const opp = palaces[(p.index + 6) % 12];
    const majors = p.majorStars.length
      ? p.majorStars.map((s: any) => `${s.name}${s.brightness ?? ''}${s.mutagen ? `化${s.mutagen}` : ''}`).join('、')
      : `空宫(借${opp.name}:${opp.majorStars.map((s: any) => s.name).join('、') || '无'})`;
    const minors = p.minorStars
      .filter((s: any) => s.mutagen || SHA_STARS.has(s.name) || ['左辅', '右弼', '文昌', '文曲', '天魁', '天钺', '禄存'].includes(s.name))
      .map((s: any) => `${s.name}${s.mutagen ? `化${s.mutagen}` : ''}`)
      .join('、');
    return `${p.name}(${p.heavenlyStem}${p.earthlyBranch}${p.isBodyPalace ? '·身' : ''}):${majors}${minors ? `｜${minors}` : ''}`;
  });

  const sortedDec = [...palaces].sort((a, b) => a.decadal.range[0] - b.decadal.range[0]);
  const engineDecadal = layers?.decadal;
  const curDec = engineDecadal
    ? (palaces[engineDecadal.index] ?? sortedDec.find((p) => currentNominalAge >= p.decadal.range[0] && currentNominalAge <= p.decadal.range[1]) ?? null)
    : (sortedDec.find((p) => currentNominalAge >= p.decadal.range[0] && currentNominalAge <= p.decadal.range[1]) ?? null);
  const decadalLine = sortedDec.slice(0, 8).map((p) => {
    const [s, e] = p.decadal.range;
    const isCur = engineDecadal ? p.index === engineDecadal.index && currentNominalAge >= s && currentNominalAge <= e : currentNominalAge >= s && currentNominalAge <= e;
    return `${p.name}${p.heavenlyStem}${p.earthlyBranch}(${s}-${e}${isCur ? '·当前' : ''})`;
  }).join('｜');

  const targetYears = fortuneScope.years.slice(0, 5).map((year) => {
    const gz = getYearSixtyCycle(year);
    const stem = gz[0] as HeavenlyStem;
    const branch = gz[1];
    const tp = palaces.find((p) => p.earthlyBranch === branch);
    const mut = getMutagensByStem(stem, data.basis.rules.mutagenSchool);
    return { year, ganZhi: gz, palace: tp?.name ?? branch, lu: mut[0] ?? '', ji: mut[3] ?? '' };
  });

  const decadalGz = engineDecadal
    ? `${engineDecadal.heavenlyStem}${engineDecadal.earthlyBranch}`
    : curDec
      ? `${curDec.heavenlyStem}${curDec.earthlyBranch}`
      : null;
  const decadalName = engineDecadal ? (palaces[engineDecadal.index]?.name ?? engineDecadal.name) : (curDec?.name ?? '童限');
  const anchor: AnchorFourLayers = {
    referenceDate: dateStr,
    dayun: decadalGz,
    yearGanZhi: refYearlyGz || getYearSixtyCycle(effectiveRefYear),
    monthGanZhi: layers?.monthly ? `${layers.monthly.heavenlyStem}${layers.monthly.earthlyBranch}` : null,
    dayGanZhi: layers?.daily ? `${layers.daily.heavenlyStem}${layers.daily.earthlyBranch}` : todayDayGz,
  };
  const anchorLine = `当日四层基准（${anchor.referenceDate}）：大限${decadalName}${anchor.dayun ?? ''}｜流年${anchor.yearGanZhi}｜流月${anchor.monthGanZhi ?? '按农历月'}｜流日${anchor.dayGanZhi}`;
  const zwJiaziAnchorLine = buildYearJiaziAnchorLine(effectiveRefYear, params.question);
  const yearLine = params.anchorOnly
    ? `${anchorLine}\n${zwJiaziAnchorLine}（后续流年/流月/流日干支、落宫与十干四化请自行按60甲子顺推）`
    : `${anchorLine}\n${zwJiaziAnchorLine}\n流年：${targetYears.map((y) => `${y.year}${y.ganZhi}(叠${y.palace}·禄${y.lu}/忌${y.ji})`).join('｜')}`;

  const pats = (natal.patterns ?? []).slice(0, 5).map((p: any) => `${p.name}(${p.kind === 'auspicious' ? '吉' : '凶'})`).join('、') || '无特格';
  const feixing = formatFeixingHighlights(palaces).split('\n').slice(0, 2).join('；');

  const userPrompt = [
    `【紫微核心事实】`,
    `性别：${params.gender === 'female' ? '女' : '男'}；命宫${natal.soulBranch}、身宫${natal.bodyBranch}、${natal.fiveElementsClass}；格局：${pats}`,
    `飞星重点：${feixing || '无明显自化'}`,
    `十二宫：\n${palaceLines.join('\n')}`,
    `大限：${decadalLine}`,
    yearLine,
    `【用户问题】${params.question}`,
  ].join('\n');

  const allowedGz = new Set<string>([
    ...palaces.map((p) => `${p.heavenlyStem}${p.earthlyBranch}`),
    anchor.yearGanZhi,
    anchor.dayGanZhi,
    ...(anchor.monthGanZhi ? [anchor.monthGanZhi] : []),
  ]);
  for (const y of targetYears) allowedGz.add(y.ganZhi);
  const allowedStars = new Set<string>();
  const palaceMajorStars: Record<string, string[]> = {};
  const palaceBranches: Record<string, string> = {};
  for (const p of palaces) {
    palaceMajorStars[p.name] = p.majorStars.map((s: any) => s.name);
    palaceBranches[p.name] = p.earthlyBranch;
    for (const s of [...p.majorStars, ...p.minorStars, ...p.adjectiveStars]) allowedStars.add(s.name);
  }
  const ming = palaces.find((p) => p.name === '命宫')!;
  const oppMing = palaces[(ming.index + 6) % 12];
  const mingStars = (ming.majorStars.length ? ming.majorStars : oppMing.majorStars).map((s: any) => s.name);

  return {
    system: 'ziwei',
    topic,
    systemPrompt: STYLE_A_SYSTEM_PROMPT,
    userPrompt,
    facts: {
      system: 'ziwei',
      gender: params.gender,
      mingBranch: natal.soulBranch,
      bodyBranch: natal.bodyBranch,
      fiveElementsClass: natal.fiveElementsClass,
      mutagenSchool: data.basis.rules.mutagenSchool,
      mingMajorStars: mingStars,
      palaceMajorStars,
      palaceBranches,
      patterns: (natal.patterns ?? []).slice(0, 3).map((p: any) => p.name),
      currentDecadal: decadalGz,
      anchor,
      targetYears: targetYears.map((y) => ({ year: y.year, ganZhi: y.ganZhi, palace: y.palace })),
      allAllowedStars: [...allowedStars],
      allAllowedGanZhi: [...allowedGz],
    },
  };
}
