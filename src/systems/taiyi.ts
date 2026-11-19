import type { z } from 'zod';
import type { taiyiInput } from '../schema';
import { generateTaiyi } from './taiyi/chart';
import { sameJsonValue } from '../json-value';
import { formatSchoolGuidance, resolvePromptSelection } from '../prompt-selection';
import { evaluateTaiyiSchoolAlgorithms, formatSchoolAlgorithmSection } from './school-algorithms';
import { formatClassicExcerpts, selectTaiyiClassics } from './classics';
import reference from './taiyi-reference.json';
import { assertRangePillars, parseDivinationRange, partitionDivinationRange } from './divination-range';
import { getDivinationTime } from './calendar';

type Input = z.infer<typeof taiyiInput>;
type Settings = Input['taiyi'];
const scopes = { year: 'yearly', month: 'monthly', day: 'daily', hour: 'hourly' } as const;

const TAIYI_16_GOD_MEANINGS: Record<string, string> = {
  子: '地主（阳气初生，主生发修德、根基始立）',
  丑: '阳德（二阳渐长，主施恩布德、宽和协济）',
  艮: '和德（东北维神，主阴阳交合、止守修筑）',
  寅: '吕申（三阳开泰，主发号施令、经营开拓）',
  卯: '高丛（万物丛生，主生机条达、显露外张）',
  辰: '太阳（阳气盛张，主声势显赫、威严兴动）',
  巽: '大炅（东南维神，主燥烈光明、文书迅疾）',
  巳: '大神（纯阳临盛，主威权显达、大事兴举）',
  午: '大威（阳极生阴，主威猛刚决、刑威震慑）',
  未: '天道（阴气渐生，主顺时收敛、暗中运筹）',
  坤: '大武（西南维神，主武备变动、严整防卫）',
  申: '武德（金气司权，主刚断整肃、改革裁断）',
  酉: '太簇（万物敛熟，主聚敛更易、赏罚严明）',
  戌: '阴主（群阴用事，主闭藏潜伏、困顿谨守）',
  乾: '阴德（西北天门，主尊贵权威、潜德暗扶）',
  亥: '大义（终始交接，主大义归结、收敛蓄藏）',
};

function describeCountDetail(label: string, count: number, nature?: string): string {
  const parity = count % 2 === 1 ? '单数阳算' : '偶数阴算';
  const lengthType = count >= 11 ? '长算（利缓图、深谋）' : '短算（利速决、浅攻）';
  const threePowers: string[] = [];
  if (count < 10) threePowers.push('少十无天（天时或上层助力偏弱）');
  if (count % 10 >= 1 && count % 10 < 5) threePowers.push('少五无地（地利或基层依托偏薄）');
  if (count % 10 === 0) threePowers.push('零数无人（人事或协同助力偏弱）');
  if (count >= 15 && count % 10 >= 5) threePowers.push('天地人三才俱足');
  return `${label}${count}：${parity}、${lengthType}${nature ? `、${nature}` : ''}${threePowers.length ? `，${threePowers.join('，')}` : ''}`;
}

function buildTaiyiExtendedAnalysis(result: ReturnType<typeof generateTaiyi>): string {
  const fourKeyGods = [
    `太乙临${result.taiyiPosition}宫${TAIYI_16_GOD_MEANINGS[result.taiyiPosition] ?? ''}`,
    `文昌（主目）临${result.wenChangPosition}宫${TAIYI_16_GOD_MEANINGS[result.wenChangPosition] ?? ''}`,
    `始击（客目）临${result.shiJiPosition}宫${TAIYI_16_GOD_MEANINGS[result.shiJiPosition] ?? ''}`,
    `计神临${result.jiShenPosition}宫${TAIYI_16_GOD_MEANINGS[result.jiShenPosition] ?? ''}`,
  ];
  const countDetails = [
    describeCountDetail('主算', result.lordCount, result.countNatures?.lord),
    describeCountDetail('客算', result.guestCount, result.countNatures?.guest),
    describeCountDetail('定算', result.setCount, result.countNatures?.set),
  ];
  return [
    `【四神所临十六神职司】\n- ${fourKeyGods.join('\n- ')}`,
    `【主客定算三才与单双长短】\n- ${countDetails.join('\n- ')}`,
  ].join('\n\n');
}

async function compute(settings: Settings, now: string) {
  const scope = settings.scope ?? 'year';
  const date = scope === 'year' ? undefined : new Date(settings.date ?? now);
  const correction = date && settings.timeStandard === 'true-solar' ? (await import('./astronomy/true-solar')).trueSolarTime(date, settings.longitude!) : undefined;
  const input = scope === 'year'
    ? { scope, year: settings.year!, ...(settings.ganZhi ? { ganZhi: settings.ganZhi } : {}) }
    : { scope, date: date!.toISOString(), ...(settings.ganZhi ? { ganZhi: settings.ganZhi } : {}), ...(settings.timeStandard ? { timeStandard: settings.timeStandard } : {}), ...(settings.longitude !== undefined ? { longitude: settings.longitude } : {}) };
  const result = scope === 'year'
    ? generateTaiyi({ scope, year: settings.year, ganZhi: settings.ganZhi })
    : generateTaiyi({ scope, date: correction ? new Date(correction.effectiveTimestamp) : date, ...(correction ? { termReferenceDate: date } : {}), ganZhi: settings.ganZhi });
  return { input, result, correction };
}

function buildPrompt(result: ReturnType<typeof generateTaiyi>, question: string, options: Input['prompt'], now: string, correction?: Awaited<ReturnType<typeof compute>>['correction']) {
  const scope = scopes[result.scope];
  if (options?.scope && options.scope !== scope) throw new Error('提示词时间范围与太乙计式不一致。');
  const selection = resolvePromptSelection('taiyi', { ...options, scope });
  const schoolText = formatSchoolGuidance(options?.schools, reference.schools);
  const classics = options?.includeClassics ? reference.classics.map((item) => `《${item.book}》·${item.chapter}：${item.summary}\n适用条件：${item.application}`).join('\n') : '';
  const evidence = result.evidenceAnalysis!;
  const counterSummary = evidence.counterEvidenceFacts.map((c) => c.promptText).join(' ');
  const activeTaiyiGenerals = [
    '太乙',
    '文昌',
    '始击',
    ...(result.lordGeneral ? ['主将'] : []),
    ...(result.guestGeneral ? ['客将'] : []),
    ...(counterSummary.includes('主参') ? ['主参'] : []),
    ...(counterSummary.includes('客参') ? ['客参'] : []),
    '计神',
  ];
  const classicExcerpts = options?.includeClassics
    ? formatClassicExcerpts(selectTaiyiClassics(activeTaiyiGenerals), '典籍片段')
    : '';
  const user = [
    correction ? `【时间】\n经度 ${correction.longitude}°；经度修正 ${correction.longitudeCorrectionMinutes.toFixed(3)} 分钟，均时差 ${correction.equationOfTimeMinutes.toFixed(3)} 分钟；日时按真太阳时钟表，节气、年月及阴阳遁按实际起局时刻。提示词时间：${now}。` : `【时间】\n提示词时间：${now}。`,
    result.prompt,
    buildTaiyiExtendedAnalysis(result),
    `【模型口径】\n${result.model.precision}`,
    `【计算与条件】\n${evidence.calculationSteps
      .filter((item) => !['taiyi:calculation:three-gates', 'taiyi:calculation:five-generals', 'taiyi:calculation:yinyang-harmony'].includes(item.key))
      .map((item) => item.promptText)
      .join('；')}`,
    ...(() => {
      const activeCounters = evidence.counterEvidenceFacts.filter(
        (item) => !/^未见(?:掩|囚|主将参中宫|客将参中宫)/u.test(item.promptText) && !/^三门条件已命中/u.test(item.promptText),
      );
      return activeCounters.length
        ? [`【反证】\n${activeCounters.map((item) => item.promptText).join('；')}`]
        : [];
    })(),
    selection ? `【解读选择】\n${selection.section}` : '',
    formatSchoolAlgorithmSection(evaluateTaiyiSchoolAlgorithms(result, options?.schools)),
    schoolText,
    classics ? `【经典依据】\n${classics}` : '',
    classicExcerpts,
    `【任务】\n依据本计积数、主客定算、宫位及门将条件回应问题，分别说明支持、反证、成立条件和资料不足。${selection ? `\n${selection.task}` : ''}\n传统模型和条件不能直接证明现实胜负、成功率或唯一应期。`,
    `【问题】\n${question}`,
  ].filter(Boolean).join('\n\n');
  return { text: user };
}

type Range = NonNullable<Input['range']>;
type Chart = Omit<ReturnType<typeof generateTaiyi>, 'prompt'>;
type TaiyiRange = { kind: 'range'; input: { range: Range; taiyi: Settings }; source: { startTimestamp: number; endTimestamp: number; endExclusive: true; timezone: 'UTC+08:00' }; status: 'stable' | 'conditional'; branches: Array<{ startTimestamp: number; endTimestamp: number; endExclusive: true; chart: Chart }> };

function chartFacts(chart: ReturnType<typeof generateTaiyi>) {
  const { dateTime: _date, termReferenceDateTime: _actual, prompt: _prompt, evidenceAnalysis: _evidence, ...facts } = chart;
  return JSON.stringify(facts);
}

export async function generateTaiyiRange(range: Range, settings: Settings): Promise<TaiyiRange> {
  const { start, end } = parseDivinationRange(range, '太乙');
  if ((settings.scope ?? 'year') === 'year' || settings.date || settings.year !== undefined) throw new Error('太乙范围起局仅支持不指定单一日期的月、日、时计。');
  const make = async (timestamp: number) => {
    const actual = new Date(timestamp), value = await compute({ ...settings, date: actual.toISOString() }, actual.toISOString());
    if (range.pillars) {
      const date = value.correction ? new Date(value.correction.effectiveTimestamp) : actual;
      const clock = getDivinationTime(date).ganzhi, term = getDivinationTime(actual).ganzhi;
      const pillars = { ...clock, year: term.year, month: term.month };
      assertRangePillars(range.pillars, pillars, '太乙');
    }
    return value;
  };
  const segments = await partitionDivinationRange({ start, end }, settings, { label: '太乙', calculate: make, fingerprint: (value) => chartFacts(value.result) });
  const branches = segments.map(({ startTimestamp, endTimestamp, endExclusive, first }) => {
    const { prompt: _prompt, ...chart } = first.result;
    return { startTimestamp, endTimestamp, endExclusive, chart };
  });
  return { kind: 'range', input: { range, taiyi: settings }, source: { startTimestamp: start, endTimestamp: end, endExclusive: true, timezone: 'UTC+08:00' }, status: branches.length === 1 ? 'stable' : 'conditional', branches };
}

async function rangePrompt(range: TaiyiRange, question: string, options: Input['prompt'], now: string) {
  const format = (timestamp: number) => `${new Date(timestamp + 8 * 3_600_000).toISOString().slice(0, 19).replace('T', ' ')}（北京时间）`;
  const sections = await Promise.all(range.branches.map(async (branch, index) => {
    const { result, correction } = await compute({ ...range.input.taiyi, date: new Date(branch.startTimestamp).toISOString() }, now);
    return `【分支 ${index + 1}】\n${format(branch.startTimestamp)} 至 ${format(branch.endTimestamp)}（起点含、终点不含）；以下盘面时间为该分支起点的代表时刻。\n${buildPrompt(result, question, options, now, correction).text}`;
  }));
  const standard = range.input.taiyi.timeStandard === 'true-solar' ? `真太阳时（经度 ${range.input.taiyi.longitude}°）` : '北京时间';
  const text = [`【时间范围】\n${format(range.source.startTimestamp)} 至 ${format(range.source.endTimestamp)}（起点含、终点不含）；按${standard}计算日时，节气与阴阳遁按实际起局时刻。`, ...sections,
    '【范围任务】\n分别比较各分支的共同点和差异，结论须标明适用时间段；不能把某一分支起点当作确定起局时刻。'].join('\n\n');
  return { text };
}

function withoutCachedEvidence(range: TaiyiRange) {
  return { ...range, branches: range.branches.map((branch) => { const { evidenceAnalysis: _evidence, ...chart } = branch.chart; return { ...branch, chart }; }) };
}

export async function promptForTaiyiRange(data: unknown, input: Input, now: string) {
  if (!data || typeof data !== 'object' || !input.range) throw new Error('太乙范围结果缺少有效区间。');
  const saved = data as TaiyiRange;
  if (saved.kind !== 'range' || !saved.input || !Array.isArray(saved.branches)) throw new Error('太乙范围结果缺少原始输入或分支。');
  const expected = await generateTaiyiRange(input.range, input.taiyi);
  if (!sameJsonValue(withoutCachedEvidence(saved), withoutCachedEvidence(expected))) throw new Error('太乙范围结果与原始输入不一致。');
  return rangePrompt(expected, input.question, input.prompt, now);
}

export async function taiyi(input: Input, now: string) {
  if (input.range) {
    const data = await generateTaiyiRange(input.range, input.taiyi);
    return { data, summary: { title: '太乙神数范围起局', tags: [data.status === 'stable' ? '盘面稳定' : '条件分支', `${data.branches.length} 段`], lines: data.branches.map((branch, index) => `分支 ${index + 1}：${new Date(branch.startTimestamp).toISOString()} 至 ${new Date(branch.endTimestamp).toISOString()}（终点不含）；${branch.chart.yinYang}${branch.chart.bureau}局`) },
      prompt: await rangePrompt(data, input.question, input.prompt, now) };
  }
  const { input: settings, result, correction } = await compute(input.taiyi, now);
  const { prompt: _prompt, ...chart } = result;
  return {
    data: { input: settings, chart },
    summary: { title: `太乙神数${{ year: '年计', month: '月计', day: '日计', hour: '时计' }[result.scope]}`, tags: [`${result.yinYang}${result.bureau}局`, `太乙：${result.taiyiPosition}`], lines: [`主算${result.lordCount}、客算${result.guestCount}、定算${result.setCount}`] },
    prompt: buildPrompt(result, input.question, input.prompt, now, correction),
  };
}

export async function promptForTaiyi(data: Record<string, unknown>, input: Input, now: string) {
  if ((input.taiyi.scope ?? 'year') !== 'year' && !input.taiyi.date) throw new Error('太乙结果缺少原始起局时刻。');
  const { result, correction } = await compute(input.taiyi, now);
  if (!data.chart || typeof data.chart !== 'object' || Array.isArray(data.chart)) throw new Error('太乙结果缺少盘面。');
  const { evidenceAnalysis: _cached, ...saved } = data.chart as Record<string, unknown>;
  const { evidenceAnalysis: _rebuilt, prompt: _prompt, ...expected } = result;
  if (!sameJsonValue(saved, expected)) throw new Error('太乙盘面与计式或起局资料不一致。');
  return buildPrompt(result, input.question, input.prompt, now, correction);
}
