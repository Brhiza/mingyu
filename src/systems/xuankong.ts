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
  return { input, periodYears: uniqueYears, periodBoundary: uniqueYears.length > 1 ? '待核' as const : '已核定' as const, measurement, flow, charts,
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
function starTimeliness(star: number, yun: number): string {
  if (star === yun) return '旺';
  const next1 = (yun % 9) + 1;
  const prev1 = ((yun - 2 + 9) % 9) + 1;
  if (star === next1 || (yun === 8 && star === 9) || (yun === 9 && star === 2)) return '生';
  if (star === prev1) return '退';
  if (star === 5) return '五黄煞';
  if (star === 2) return '二黑病';
  return '失令';
}
function analyzeSpecialXuanKong(chart: Data['charts'][number]): string[] {
  const notes: string[] = [];
  const yun = chart.period.yun;
  const centerPalace = chart.palaces.find((p) => p.earth === 5);
  if (centerPalace && centerPalace.water === yun) {
    notes.push(`向首当令${yun}星入中「令星入囚」（财气受困，宜于向首或零神方见动水引通）`);
  }
  if (centerPalace && centerPalace.mountain === yun) {
    notes.push(`坐山当令${yun}星入中「山方令星入囚」（丁气受制）`);
  }
  const shanHeShi = chart.palaces.every((p) => p.period + p.mountain === 10);
  const xiangHeShi = chart.palaces.every((p) => p.period + p.water === 10);
  const shanXiangHeShi = chart.palaces.every((p) => p.mountain + p.water === 10);
  if (shanHeShi) notes.push('全盘「运山合十」（丁星通气）');
  if (xiangHeShi) notes.push('全盘「运向合十」（财星通气）');
  if (shanXiangHeShi) notes.push('全盘「山向合十」（山水通气）');
  const isParentSanBan = chart.palaces.every((p) => {
    const s = [p.period, p.mountain, p.water].sort((a, b) => a - b).join('');
    return s === '147' || s === '258' || s === '369';
  });
  const isLianZhuSanBan = chart.palaces.every((p) => {
    const s = [p.period, p.mountain, p.water].sort((a, b) => a - b).join('');
    return ['123', '234', '345', '456', '567', '678', '789', '189', '129'].includes(s);
  });
  if (isParentSanBan) notes.push('全盘「父母三般卦」（一四七、二五八、三六九三元通气）');
  if (isLianZhuSanBan) notes.push('全盘「连珠三般卦」（宫宫三数连珠）');
  const shanFuYin = chart.palaces.every((p) => p.mountain === p.earth);
  const xiangFuYin = chart.palaces.every((p) => p.water === p.earth);
  const shanFanYin = chart.palaces.every((p) => p.mountain + p.earth === 10);
  const xiangFanYin = chart.palaces.every((p) => p.water + p.earth === 10);
  if (shanFuYin || xiangFuYin) notes.push(`「${shanFuYin ? '山盘' : ''}${xiangFuYin ? '向盘' : ''}伏吟」`);
  if (shanFanYin || xiangFanYin) notes.push(`「${shanFanYin ? '山盘' : ''}${xiangFanYin ? '向盘' : ''}反吟」（忌形峦冲射）`);
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
  9: '九紫当旺',
};

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
  const text = [`【玄空飞星】\n${measurement}\n运期${data.periodBoundary === '待核' ? '跨立春交运边界，保留多个候选' : '按所给精度确定'}；共${data.charts.length}盘。`,
    data.flow
      ? `【流年流月${data.flow.day ? '流日' : ''}${data.flow.hour ? '流时' : ''}】\n年${data.flow.year.year}，中宫${data.flow.year.centerStar}${data.flow.month ? `；${data.flow.month.rule} 月支${data.flow.month.monthBranch}，中宫${data.flow.month.centerStar}` : '；年星以所指定立春节气年计算。'}${data.flow.day ? `；流日${data.flow.day.direction}，中宫${data.flow.day.centerStar}` : ''}${data.flow.hour ? `；流时（${data.flow.hour.date.hour}时）${data.flow.hour.direction}，中宫${data.flow.hour.centerStar}` : ''}`
      : '【流年流月】\n未指定流年或日期，不附加流年飞星。',
    `【候选盘】\n${charts.join('\n\n')}`,
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
