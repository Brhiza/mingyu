import type { z } from 'zod';
import type { xuankongInput } from '../schema';
import { sameJsonValue } from '../json-value';
import { formatSchoolGuidance, type SchoolGuidanceEntry } from '../prompt-selection';
import { formatClassicExcerpts, selectXuankongClassics } from './classics';
import { evaluateXuankongSchoolAlgorithms, formatSchoolAlgorithmSection } from './school-algorithms';
import { measureSitDirection, mountainTrigram } from './compass';
import { birthYearCandidates } from './bazhai/foundation';
import { resolveXuankongMode } from './defaults';
import { calculateXuanKongPlate, resolvePeriod } from './xuankong/foundation';
import { dayFlyingStar, hourFlyingStar, monthFlyingStar, yearFlyingStar } from './xuankong/flow';
import { castleGate } from './xuankong/castle-gate';

type Input = z.infer<typeof xuankongInput>;
type Source = Pick<Input, 'construction' | 'orientation' | 'mode' | 'confirmJianXiang' | 'flow'>;
const schoolGuidance: Record<'shenshi' | 'wuchang', SchoolGuidanceEntry> = {
  shenshi: { label: '沈氏玄空', task: '重挨星排盘、令星入囚、三般卦与合十等星盘格局，结合实地门路纳气核验。', basis: '《沈氏玄空学》九星生克与格局' },
  wuchang: { label: '无常派玄空', task: '重向首、城门一诀与流年太岁飞星引动，辨别当令旺星与衰死之气的实地受气。', basis: '《玄空秘旨》《紫白诀》城门与引动' },
};
function calculateData(source: Source) {
  const input = { construction: source.construction, orientation: source.orientation, ...(source.mode ? { mode: source.mode } : {}), ...(source.confirmJianXiang !== undefined ? { confirmJianXiang: source.confirmJianXiang } : {}), ...(source.flow ? { flow: source.flow } : {}) };
  const mode = resolveXuankongMode(input.mode);
  if (mode === '替卦' ? input.confirmJianXiang !== true : input.confirmJianXiang === true) throw new Error('替卦须显式确认已核定兼向；下卦不接受兼向确认。');
  const { year, month, day } = input.construction;
  if ((month === undefined) !== (day === undefined)) throw new Error('建造或起运月日须同时提供。');
  const birth = month !== undefined && day !== undefined ? birthYearCandidates({ year, month, day, timezone: 8 }) : null;
  const periodYears = birth ? birth.years : resolvePeriod(year).boundaryUncertain ? [year - 1, year] : [year];
  const uniqueYears = periodYears.filter((value, index, all) => all.findIndex((other) => resolvePeriod(other).startYear === resolvePeriod(value).startYear) === index);
  const orientation = input.orientation;
  const measurement = orientation.kind === 'degree' ? measureSitDirection({ ...orientation, degree: orientation.reading === 'facing' ? (orientation.degree + 180) % 360 : orientation.degree }) : null;
  if (mode === '替卦' && measurement) {
    const delta = Math.abs(((measurement.correctedDegree - measurement.primary.centerDegree + 540) % 360) - 180);
    if (measurement.input.northReference === 'unspecified' || measurement.candidates.length !== 1 || delta - measurement.input.uncertaintyDegrees <= 4.5 || delta + measurement.input.uncertaintyDegrees >= 7.5) {
      throw new Error('替卦须确认北向基准，且测量误差范围完整位于同一山的兼向外侧三度。');
    }
  }
  const sits = orientation.kind === 'mountain' ? [orientation.sitMountain] : measurement!.candidates.map((item) => item.sitMountain);
  for (const sit of sits) mountainTrigram(sit);
  const flow = input.flow?.kind === 'year'
    ? { year: yearFlyingStar(input.flow.year), month: null, day: null, hour: null }
    : input.flow?.kind === 'date'
      ? (() => {
          const monthPlate = monthFlyingStar(input.flow.year, input.flow.month, input.flow.day);
          const dayPlate = dayFlyingStar(input.flow.year, input.flow.month, input.flow.day);
          const hourPlate = input.flow.hour !== undefined
            ? hourFlyingStar(input.flow.year, input.flow.month, input.flow.day, input.flow.hour)
            : null;
          return { year: monthPlate.yearPlate, month: monthPlate, day: dayPlate, hour: hourPlate };
        })()
      : null;
  const charts = uniqueYears.flatMap((effectiveYear) => sits.map((sit) => {
    const chart = calculateXuanKongPlate(effectiveYear, sit, mode);
    return {
      ...chart,
      castleGate: castleGate(chart.period.yun, chart.facingMountain),
      palaces: chart.palaces.map((palace) => ({
        ...palace,
        ...(flow ? { yearStar: flow.year.plate[palace.earth - 1] } : {}),
        ...(flow?.month ? { monthStar: flow.month.plate[palace.earth - 1] } : {}),
        ...(flow?.day ? { dayStar: flow.day.plate[palace.earth - 1] } : {}),
        ...(flow?.hour ? { hourStar: flow.hour.plate[palace.earth - 1] } : {}),
      })),
    };
  }));
  return { input, periodYears: uniqueYears, periodBoundary: uniqueYears.length > 1 ? '交界双候选' as const : '已核定' as const, measurement, flow, charts,
    limitation: '本预览按所列运期与山向排盘；城门只计算盘面旺星到位，未核实实地可用性；不包含形峦或住宅合参。传统格局不单独证明现实结果。' };
}
type Data = ReturnType<typeof calculateData>;
const zhengLingTable: Record<number, { zheng: string; ling: string; zhao: string }> = {
  1: { zheng: '坎（正北，宜收山忌见水）', ling: '离（正南，宜见水见门）', zhao: '坤（西南，照神催官辅水）' },
  2: { zheng: '坤（西南，宜收山忌见水）', ling: '艮（东北，宜见水见门）', zhao: '巽（东南，照神辅水）' },
  3: { zheng: '震（正东，宜收山忌见水）', ling: '兑（正西，宜见水见门）', zhao: '乾（西北，照神辅水）' },
  4: { zheng: '巽（东南，宜收山忌见水）', ling: '乾（西北，宜见水见门）', zhao: '震（正东，照神辅水）' },
  5: { zheng: '中五寄坤艮（前十年艮、后十年坤）', ling: '前十年坤、后十年艮', zhao: '坎离互参' },
  6: { zheng: '乾（西北，宜收山忌见水）', ling: '巽（东南，宜见水见门）', zhao: '兑（正西，照神辅水）' },
  7: { zheng: '兑（正西，宜收山忌见水）', ling: '震（正东，宜见水见门）', zhao: '离（正南，照神辅水）' },
  8: { zheng: '艮（东北，宜收山忌见水）', ling: '坤（西南，宜见水见门）', zhao: '坎（正北，照神辅水）' },
  9: { zheng: '离（正南，宜收山忌见水）', ling: '坎（正北，宜见水见门）', zhao: '艮（东北，照神辅水）' },
};
const doubleStarNotes: Record<string, string> = {
  '14': '一四同宫（文昌科名）', '41': '四一同宫（文昌显达）',
  '16': '一六共宗（水天官贵）', '61': '六一官星（文武皆利）',
  '23': '二三斗牛煞（口舌争执）', '32': '三二斗牛煞（是非兴讼）',
  '25': '二五交加（病符重煞）', '52': '五二交加（灾病损耗）',
  '37': '三七穿途（劫盗争端）', '73': '七三穿途（口舌官非）',
  '67': '六七交剑煞（金刃争斗）', '76': '七六交剑煞（竞争伤损）',
  '68': '六八同宫（武科富贵）', '86': '八六同宫（地产功名）',
  '79': '七九穿途（回禄火患）', '97': '九七合辙（祝融火煞）',
  '89': '八九相生（婚喜庆典）', '98': '九八辅弼（添丁进财）',
  '59': '五九相聚（火生五黄毒煞）', '95': '九五相聚（廉贞烈火顽疾）',
};
const auspiciousDoubleKeys = new Set(['14', '41', '16', '61', '68', '86', '89', '98']);
const inauspiciousDoubleKeys = new Set(['23', '32', '25', '52', '37', '73', '67', '76', '79', '97', '59', '95']);
function starTimeliness(star: number, yun: number): string {
  if (star === yun) return '旺';
  const next1 = (yun % 9) + 1;
  const next2 = ((yun + 1) % 9) + 1;
  const prev1 = ((yun - 2 + 9) % 9) + 1;
  if (star === next1 && star !== 5) return '生';
  if (star === next2 && star !== 5) return '进气';
  if (star === prev1 && star !== 5) return '退';
  if (star === 5) return '五黄煞';
  if (star === 2) return '二黑病';
  return '失令';
}
function analyzeSpecialXuanKong(chart: Data['charts'][number]): string[] {
  const notes: string[] = [];
  const shanXiangHeShi = chart.palaces.every((p) => p.mountain + p.water === 10);
  if (shanXiangHeShi) notes.push('山向合十（夫妇合十·山水通气）');
  return notes;
}
const YEAR_STAR_TAGS: Record<number, string> = {
  1: '一白文昌桃花',
  2: '二黑病符',
  3: '三碧是非',
  4: '四绿文曲',
  5: '五黄煞',
  6: '六白武曲',
  7: '七赤破军',
  8: '八白财星',
  9: '九紫喜庆',
};

function buildXuankongPatternRelations(data: Data): string {
  const lines: string[] = [];
  for (const [index, chart] of data.charts.entries()) {
    const yun = chart.period.yun;
    const prefix = data.charts.length > 1 ? `候选盘${index + 1}（${chart.period.yun}运${chart.sitMountain}山${chart.facingMountain}向）` : `${chart.period.yun}运${chart.sitMountain}山${chart.facingMountain}向`;
    const activeGates = chart.castleGate.candidates.filter((c) => c.status === '旺星到位').map((c) => `${c.role}${c.mountain}方（${c.gongName}宫，到星${c.arrivalStar}）`);
    const formationRule: Record<string, string> = {
      旺山旺向: '当令山星到坐、向星到向，丁财双旺，忌坐空向实',
      上山下水: '当令山星到向、向星到坐，丁财失位，须借形峦倒骑龙或合十/三般卦/城门救应',
      双星到向: '当令山向双星齐聚向首，旺财而坐山丁气偏弱，宜向首见水背后有靠',
      双星到坐: '当令山向双星齐聚坐山，旺丁而向首财气偏弱，宜借零神方或城门引水催财',
    };
    lines.push(
      `${prefix}格局定位：${chart.formation}（${formationRule[chart.formation] ?? '替卦变局，按各宫当令星核验'}）；可用城门：${activeGates.join('、') || '盘面无可用城门'}。`,
    );

    const thriving: string[] = [];
    const shaZones: string[] = [];
    const remedyHints = new Set<string>();
    for (const p of chart.palaces) {
      const mTime = starTimeliness(p.mountain, yun);
      const wTime = starTimeliness(p.water, yun);
      const pairKey = `${p.mountain}${p.water}`;
      const hasFive = p.mountain === 5 || p.water === 5 || p.yearStar === 5;
      const hasTwo = p.mountain === 2 || p.water === 2 || p.yearStar === 2;
      const isGoodTime = (t: string) => t === '旺' || t === '生' || t === '进气';

      if ((isGoodTime(mTime) || isGoodTime(wTime) || auspiciousDoubleKeys.has(pairKey)) && !hasFive && !(hasTwo && yun !== 9)) {
        const tags: string[] = [];
        if (isGoodTime(mTime)) tags.push(`山${p.mountain}${mTime}`);
        if (isGoodTime(wTime)) tags.push(`向${p.water}${wTime}`);
        if (auspiciousDoubleKeys.has(pairKey)) tags.push(doubleStarNotes[pairKey]);
        thriving.push(`${p.direction}${p.name}宫（${tags.join('、')}）`);
      }

      const risks: string[] = [];
      if (p.mountain === 5 && yun !== 5) risks.push('山星五黄');
      if (p.water === 5 && yun !== 5) risks.push('向星五黄');
      if (p.yearStar === 5) risks.push('流年五黄叠临');
      if (p.mountain === 2 && yun !== 2) risks.push(yun === 9 ? '山星二黑（九运进气仍防病符余气）' : '山星二黑');
      if (p.water === 2 && yun !== 2) risks.push(yun === 9 ? '向星二黑（九运进气仍防病符余气）' : '向星二黑');
      if (p.yearStar === 2) risks.push('流年二黑叠临');
      if (inauspiciousDoubleKeys.has(pairKey)) risks.push(doubleStarNotes[pairKey]);

      if (risks.length) {
        shaZones.push(`${p.direction}${p.name}宫（${risks.join('、')}）`);
        if (hasFive || hasTwo) remedyHints.add('五黄/二黑属土煞：宜金泄耗（金属器物/铜铃/白色静置），忌红黄火土与动土修造');
        if (pairKey === '23' || pairKey === '32') remedyHints.add('二三斗牛煞（木克土）：宜火通关（暖光/红色点缀泄木生土）');
        if (pairKey === '37' || pairKey === '73' || pairKey === '67' || pairKey === '76') remedyHints.add('三七穿途/六七交剑（金木相战或金刃相交）：宜水通关（静水/黑蓝色泄金生木）');
        if (pairKey === '79' || pairKey === '97') remedyHints.add('七九火煞（火克金）：宜土通关（陶瓷/米黄色泄火生金）');
      }
    }

    lines.push(`${prefix}旺生吉位：${thriving.join('、') || '无纯净旺生吉位'}。`);
    lines.push(`${prefix}五黄二黑与凶煞位：${shaZones.join('、') || '无显著五黄二黑及凶双星'}。`);
    if (remedyHints.size) {
      lines.push(`${prefix}五行通关化解路径：${[...remedyHints].join('；')}。`);
    }

    const comboNames = [...chart.combinations.map((c) => c.name), ...analyzeSpecialXuanKong(chart)];
    if (comboNames.length) {
      const rescues = comboNames.filter((n) => /合十|三般卦|打劫/.test(n));
      const constraints = comboNames.filter((n) => /伏吟|反吟|入囚/.test(n));
      if (rescues.length || constraints.length) {
        lines.push(
          `${prefix}特殊格局制衡：${rescues.length ? `解救增益格局［${rescues.join('、')}］` : ''}${rescues.length && constraints.length ? '；' : ''}${constraints.length ? `受制风险格局［${constraints.join('、')}］` : ''}。`,
        );
      }
    }
  }
  return lines.join('\n');
}

function render(data: Data, question: string, options?: Input['prompt']) {
  const charts = data.charts.map((chart) => {
    const yun = chart.period.yun;
    const zl = zhengLingTable[yun];
    const specialNotes = analyzeSpecialXuanKong(chart);
    return [`${chart.period.yuan}${yun}运（${chart.period.startYear}–${chart.period.endYear}），${chart.sitMountain}山${chart.facingMountain}向，${chart.mode}，${chart.formation}。`,
      `到山：${chart.arrival.shanToMountain ? '是' : '否'}；到向：${chart.arrival.xiangToFacing ? '是' : '否'}。`,
      `元运水神（正零照）：正神${zl.zheng}；零神${zl.ling}；照神${zl.zhao}。`,
      ...(chart.replacement ? [`替星：山${chart.replacement.mountain.originalCenterStar}→${chart.replacement.mountain.replacementStar}（${chart.replacement.mountain.referenceMountain}、${chart.replacement.mountain.direction}）；向${chart.replacement.facing.originalCenterStar}→${chart.replacement.facing.replacementStar}（${chart.replacement.facing.referenceMountain}、${chart.replacement.facing.direction}）。`] : []),
      `城门盘面：${chart.castleGate.candidates.map((c) => `${c.role}${c.mountain}方（${c.gongName}宫），运星${c.yunStar}${c.flyDirection}，到星${c.arrivalStar}，${c.status}`).join('；')}。${chart.castleGate.limitation}`,
      ...chart.palaces.map((p) => {
        const pairKey = `${p.mountain}${p.water}`;
        const note = doubleStarNotes[pairKey] ? `［${doubleStarNotes[pairKey]}］` : '';
        const yearLabel = p.yearStar
          ? `、年${p.yearStar}${YEAR_STAR_TAGS[p.yearStar] ? `(${YEAR_STAR_TAGS[p.yearStar]})` : ''}`
          : '';
        return `${p.direction}${p.name}（${p.earth}宫）：运${p.period}、山${p.mountain}（${starTimeliness(p.mountain, yun)}）、向${p.water}（${starTimeliness(p.water, yun)}）${yearLabel}${p.monthStar ? `、月${p.monthStar}` : ''}${p.dayStar ? `、日${p.dayStar}` : ''}${p.hourStar ? `、时${p.hourStar}` : ''}${note}`;
      }),
      `组合：${[...chart.combinations.map((item) => item.name), ...specialNotes].join('、') || '未命中已列组合'}。`].join('\n');
  });
  const measurement = data.measurement ? `修正后坐山${data.measurement.correctedDegree}°；${data.measurement.stability}；${data.measurement.warnings.join('；') || '未跨二十四山边界'}。` : '按用户给定坐山排盘。';
  const schools = formatSchoolGuidance(options?.schools, schoolGuidance);
  const classics = options?.includeClassics
    ? formatClassicExcerpts(selectXuankongClassics(data.charts.flatMap((chart) =>
      chart.palaces.flatMap((p) => [p.period, p.mountain, p.water, p.yearStar, p.monthStar, p.dayStar, p.hourStar].filter((n): n is number => typeof n === 'number')),
    )))
    : '';
  const text = [`【玄空飞星】\n${measurement}\n运期${data.periodBoundary === '交界双候选' ? '跨立春交运边界，保留多个候选' : '按所给精度确定'}；共${data.charts.length}盘。`,
    data.flow
      ? `【流年流月${data.flow.day ? '流日' : ''}${data.flow.hour ? '流时' : ''}】\n年${data.flow.year.year}，中宫${data.flow.year.centerStar}${data.flow.month ? `；${data.flow.month.rule} 月支${data.flow.month.monthBranch}，中宫${data.flow.month.centerStar}` : '；年星以所指定立春节气年计算。'}${data.flow.day ? `；流日${data.flow.day.direction}，中宫${data.flow.day.centerStar}` : ''}${data.flow.hour ? `；流时（${data.flow.hour.date.hour}时）${data.flow.hour.direction}，中宫${data.flow.hour.centerStar}` : ''}`
      : '【流年流月】\n未指定流年或日期，不附加流年飞星。',
    `【候选盘】\n${charts.join('\n\n')}`,
    `【方位格局与理气制衡关系】\n${buildXuankongPatternRelations(data)}`,
    formatSchoolAlgorithmSection(evaluateXuankongSchoolAlgorithms(data, options?.schools)),
    schools,
    classics,
    `【限制与任务】\n${data.limitation} 如存在多个运期或坐山，应逐盘比较，不能把某一候选当作已经确定。`,
    `【问题】\n${question}`].filter(Boolean).join('\n\n');
  return { text };
}
export function xuankong(input: Input) {
  const data = calculateData(input);
  return { data, summary: { title: '玄空飞星', lines: [`候选盘：${data.charts.length}`, `起法：${input.mode ?? '下卦'}`] }, prompt: render(data, input.question, input.prompt) };
}
export function promptForSavedXuankong(data: unknown, source: Source, question: string, options?: Input['prompt']) {
  const expected = calculateData(source);
  if (!sameJsonValue(data, expected)) throw new Error('玄空盘面与输入资料不一致。');
  return render(expected, question, options);
}
