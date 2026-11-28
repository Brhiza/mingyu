import type { z } from 'zod';
import { SolarTime } from 'tyme4ts';
import type { liuyaoInput } from '../schema';
import type { RuntimeContext } from '../runtime-context';
import { sameJsonValue } from '../json-value';
import { getSolarTermName } from './calendar';
import { getCivilDateTimeAtFixedOffset } from './huangji/civil-time';
import { lunarDateDiscrepancy } from './birth-time';
import { assertRangePillars, parseDivinationRange, partitionDivinationRange } from './divination-range';
import { castLiuyao } from './liuyao/cast';
import { generateLiuyaoChart } from './liuyao/chart';
import { analyzeLiuyaoEvidence } from './liuyao/evidence';
import { buildPrompt, reconstruct } from './liuyao';
import type { LiuyaoData } from './liuyao/types';

type Input = z.infer<typeof liuyaoInput>;
type Cast = ReturnType<typeof castLiuyao>;
type Settings = NonNullable<Input['liuyao']>;
type Range = NonNullable<Input['range']>;

function background(timestamp: number, offset: number) {
  const wall = getCivilDateTimeAtFixedOffset(new Date(timestamp), offset / 60);
  const lunar = SolarTime.fromYmdHms(wall.year, wall.month, wall.day, wall.hour, wall.minute, wall.second).getLunarHour().getLunarDay();
  const month = lunar.getLunarMonth();
  const lunarDateWarning = lunarDateDiscrepancy(wall);
  return { solar: { year: wall.year, month: wall.month, day: wall.day }, ...(lunarDateWarning ? { lunarDateWarning } : {}),
    lunar: { year: month.getYear(), month: Math.abs(month.getMonth()), day: lunar.getDay(), monthName: month.getName(), dayName: lunar.getName(), isLeapMonth: month.getMonth() < 0 },
    solarTerm: getSolarTermName(timestamp) };
}

function checkCast(start: number, settings: Settings, cast: Cast) {
  const method = settings.method ?? (settings.yaos !== undefined ? 'manual' : 'time');
  if (cast.generation.method !== method) throw new Error('六爻范围起卦方式与记录不一致。');
  if (method === 'coins') {
    const throws = cast.generation.coinThrows;
    if (!throws || (settings.coinThrows && !sameJsonValue(settings.coinThrows, throws))) throw new Error('六爻范围三钱记录与输入不一致。');
    const source = settings.coinThrows === undefined ? 'simulated' : 'user-record';
    if (cast.generation.coinSource !== source) throw new Error('六爻范围三钱来源与输入不一致。');
    const rebuilt = castLiuyao(start, { ...settings, coinThrows: throws });
    if (!sameJsonValue({ ...rebuilt, generation: { ...rebuilt.generation, coinSource: source } }, cast)) throw new Error('六爻范围三钱记录无效。');
  } else if (method === 'yarrow') {
    const yarrow = cast.generation.yarrow;
    if (!yarrow) throw new Error('六爻范围缺少蓍草记录。');
    const splits = yarrow.lines.flatMap((line) => line.changes.map((change) => change.left));
    if ((settings.yarrowSplits && !sameJsonValue(settings.yarrowSplits, splits)) || yarrow.samplingModel !== (settings.yarrowSplits ? '手工分堆' : '余数等概率，类内分堆等概率')) throw new Error('六爻范围蓍草记录与输入不一致。');
    const manual = castLiuyao(start, { ...settings, yarrowSplits: splits });
    if (!sameJsonValue(manual.yaos, cast.yaos) || !sameJsonValue(manual.generation.yarrow?.lines, yarrow.lines)) throw new Error('六爻范围蓍草记录无效。');
  } else if (!sameJsonValue(castLiuyao(start, settings), cast)) throw new Error('六爻范围起卦记录与输入不一致。');
}

async function generate(range: Range, settings: Settings, options: Input['prompt'], fixed?: Cast) {
  const bounds = parseDivinationRange(range, '六爻');
  const offset = settings.timezoneOffsetMinutes ?? 480;
  if (!Number.isInteger(offset) || offset < -720 || offset > 840) throw new Error('时区偏移必须是 -720 至 840 分钟的整数。');
  const cast = fixed ?? castLiuyao(bounds.start, settings);
  checkCast(bounds.start, settings, cast);
  const segments = await partitionDivinationRange(bounds, { timeStandard: 'civil', timezone: offset / 60 }, {
    label: '六爻',
    calculate: (timestamp) => ({ chart: generateLiuyaoChart(new Date(timestamp), cast, offset, settings.ziHourMode), background: background(timestamp, offset) }),
    fingerprint: ({ chart, background: facts }) => { const { timestamp: _timestamp, ...rest } = chart; return JSON.stringify({ chart: rest, background: facts }); },
    check: ({ chart }) => assertRangePillars(range.pillars, chart.ganzhi, '六爻'),
  });
  const branches = segments.map(({ startTimestamp, endTimestamp, first }) => ({ startTimestamp, endTimestamp, endExclusive: true as const,
    background: first.background, data: { ...first.chart, evidenceAnalysis: analyzeLiuyaoEvidence(first.chart, { topic: options?.liuyaoTemplate ?? 'general', ...(options?.schools?.length ? { schools: options.schools } : {}) }) } }));
  return { kind: 'range' as const, input: { range, liuyao: settings }, source: { startTimestamp: bounds.start, endTimestamp: bounds.end, endExclusive: true as const, timezoneOffsetMinutes: offset },
    status: branches.length === 1 ? 'stable' as const : 'conditional' as const, branches };
}
type Result = Awaited<ReturnType<typeof generate>>;

async function render(result: Result, question: string, options: Input['prompt'], now: string, context?: RuntimeContext) {
  const format = (time: number) => new Date(time).toISOString();
  const method = result.branches[0].data.generation?.method;
  const origin = method === 'time' ? '时间起卦以整个范围的起点取数一次；起点只是取数代表，不代表已确定实际起卦时刻。' : '本次只起一卦，所有时间分支共用同一卦象及起卦记录。';
  const sections = await Promise.all(result.branches.map(async (branch, index) => {
    const { solar, lunar, solarTerm } = branch.background;
    const evidence = branch.data.evidenceAnalysis;
    return `【分支 ${index + 1}】\n${format(branch.startTimestamp)} 至 ${format(branch.endTimestamp)}（起点含、终点不含）；盘面时间为该分支的代表时刻。\n历法背景：公历 ${solar.year}-${solar.month}-${solar.day}；农历 ${lunar.year} 年${lunar.monthName}${lunar.dayName}；节气 ${solarTerm}。${branch.background.lunarDateWarning ? `\n${branch.background.lunarDateWarning}` : ''}\n${(await buildPrompt(branch.data, evidence, question, options, now, '分支代表时刻', context)).text}`;
  }));
  const text = [`【起卦时间范围】\n${format(result.source.startTimestamp)} 至 ${format(result.source.endTimestamp)}（起点含、终点不含）；时区偏移 ${result.source.timezoneOffsetMinutes} 分钟。${origin}`, ...sections,
    '【范围解读要求】\n分别说明各分支的共同点与差异，不能假定具体时刻或给候选分支赋予概率。'].join('\n\n');
  return { text };
}

function withoutEvidence(result: Result) {
  return { ...result, branches: result.branches.map((branch) => { const { evidenceAnalysis: _evidence, ...data } = branch.data; return { ...branch, data }; }) };
}

export async function calculateLiuyaoRange(input: Input, now: string, context?: RuntimeContext) {
  if (!input.range) throw new Error('六爻范围缺少起止时间。');
  const data = await generate(input.range, input.liuyao ?? {}, input.prompt);
  const warnings = [...new Set(data.branches.map((branch) => branch.background.lunarDateWarning).filter((w): w is string => Boolean(w)))];
  return { data, summary: { title: '六爻范围起卦', tags: [`${data.branches.length} 个时间分支`, `主卦：${data.branches[0].data.originalName}`], lines: warnings },
    prompt: await render(data, input.question, input.prompt, now, context) };
}

export async function promptForLiuyaoRange(value: unknown, input: Input, now: string, context?: RuntimeContext) {
  if (!value || typeof value !== 'object' || !input.range) throw new Error('六爻范围结果缺少有效区间。');
  const saved = value as Result;
  if (saved.kind !== 'range' || !Array.isArray(saved.branches) || !saved.branches.length) throw new Error('六爻范围结果缺少分支。');
  const first = saved.branches[0].data as LiuyaoData & { evidenceAnalysis?: unknown };
  const { cast } = reconstruct(first);
  if (first.timestamp !== Date.parse(input.range.start)) throw new Error('六爻范围起卦代表时间与范围不一致。');
  const expected = await generate(input.range, input.liuyao ?? {}, input.prompt, cast);
  if (!sameJsonValue(withoutEvidence(saved), withoutEvidence(expected))) throw new Error('六爻范围结果与起卦记录或时间分支不一致。');
  return render(expected, input.question, input.prompt, now, context);
}
