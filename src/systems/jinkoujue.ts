import type { z } from 'zod';
import type { jinkoujueInput } from '../schema';
import type { JinkoujueData } from './jinkoujue/types';
import { generateJinkoujue } from './jinkoujue/chart';
import { analyzeJinkoujueEvidence } from './jinkoujue/evidence';
import { EARTHLY_BRANCHES, getBranchIndex, isChong, isHe, isKe, isSheng, isXing } from './calendar';
import { sameJsonValue } from '../json-value';
import { formatSchoolGuidance, resolvePromptSelection } from '../prompt-selection';
import { evaluateJinkoujueSchoolAlgorithms, formatSchoolAlgorithmSection } from './school-algorithms';
import { formatClassicExcerpts, selectJinkoujueClassics } from './classics';
import reference from './jinkoujue-reference.json';
import { assertRangePillars, parseDivinationRange, partitionDivinationRange } from './divination-range';
import { buildLiurenLifeYearSection, buildMethodSituationDigest } from './situation-digest';

type Input = z.infer<typeof jinkoujueInput>;

const JINKOU_YIMA_MAP: Record<string, string> = {
  申: '寅', 子: '寅', 辰: '寅',
  寅: '申', 午: '申', 戌: '申',
  巳: '亥', 酉: '亥', 丑: '亥',
  亥: '巳', 卯: '巳', 未: '巳',
};
const JINKOU_TIANMA_MAP: Record<string, string> = {
  寅: '午', 申: '午',
  卯: '申', 酉: '申',
  辰: '戌', 戌: '戌',
  巳: '子', 亥: '子',
  午: '寅', 子: '寅',
  未: '辰', 丑: '辰',
};
const JINKOU_LUSHEN_MAP: Record<string, string> = {
  甲: '寅', 乙: '卯', 丙: '巳', 戊: '巳', 丁: '午', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子',
};

type VerticalLinkKind = '上生下' | '下生上' | '上克下' | '下克上' | '比和';

function classifyVerticalLink(upperElement: string, lowerElement: string): VerticalLinkKind {
  if (upperElement === lowerElement) return '比和';
  if (isSheng(upperElement, lowerElement)) return '上生下';
  if (isSheng(lowerElement, upperElement)) return '下生上';
  if (isKe(upperElement, lowerElement)) return '上克下';
  return '下克上';
}

export function analyzeJinkoujueRelations(data: JinkoujueData) {
  const { renYuan, guiShen, jiangShen, diFen } = data.positions;
  const verticalPairs = [
    { upper: renYuan, lower: guiShen },
    { upper: guiShen, lower: jiangShen },
    { upper: jiangShen, lower: diFen },
  ].map(({ upper, lower }) => {
    const kind = classifyVerticalLink(upper.element, lower.element);
    return {
      upper: upper.name,
      lower: lower.name,
      upperElement: upper.element,
      lowerElement: lower.element,
      kind,
      label: `${upper.name}（${upper.element}）↔${lower.name}（${lower.element}）：${kind}`,
    };
  });

  const shengCount = verticalPairs.filter((p) => p.kind === '上生下' || p.kind === '下生上').length;
  const keCount = verticalPairs.filter((p) => p.kind === '上克下' || p.kind === '下克上').length;
  const biCount = verticalPairs.filter((p) => p.kind === '比和').length;
  let chainPattern: string;
  if (verticalPairs.every((p) => p.kind === '上生下')) chainPattern = '上生下连环递生（外客气势直达内主）';
  else if (verticalPairs.every((p) => p.kind === '下生上')) chainPattern = '下生上连环递生（内主气势递推外客）';
  else if (biCount === 3) chainPattern = '四位同气比和';
  else if (keCount === 3) chainPattern = '三段连环克战';
  else if (keCount === 0) chainPattern = `顺生流通（生${shengCount}段、比和${biCount}段，无相邻克战）`;
  else if (shengCount === 0) chainPattern = `克战偏重（克${keCount}段${biCount ? `、比和${biCount}段` : ''}，无相邻相生）`;
  else chainPattern = `生克交错（生${shengCount}段、克${keCount}段${biCount ? `、比和${biCount}段` : ''}）`;

  const hostGuestRelation = classifyVerticalLink(renYuan.element, diFen.element);
  const hostGuestText =
    hostGuestRelation === '上克下'
      ? `人元（客，${renYuan.element}）克地分（主，${diFen.element}），客制主（妻动）`
      : hostGuestRelation === '下克上'
        ? `地分（主，${diFen.element}）克人元（客，${renYuan.element}），主制客（鬼动）`
        : hostGuestRelation === '上生下'
          ? `人元（客，${renYuan.element}）生地分（主，${diFen.element}），客生主（子孙动）`
          : hostGuestRelation === '下生上'
            ? `地分（主，${diFen.element}）生人元（客，${renYuan.element}），主生客（父母动）`
            : `人元（客，${renYuan.element}）与地分（主，${diFen.element}）比和（兄弟动）`;

  const middlePositions = [guiShen, jiangShen];
  const assistGuest = middlePositions
    .filter((p) => p.element === renYuan.element || isSheng(p.element, renYuan.element))
    .map((p) => `${p.name}（${p.element}${p.element === renYuan.element ? '比和' : '生'}）`);
  const restrainGuest = middlePositions
    .filter((p) => isKe(p.element, renYuan.element))
    .map((p) => `${p.name}（${p.element}克）`);
  const assistHost = middlePositions
    .filter((p) => p.element === diFen.element || isSheng(p.element, diFen.element))
    .map((p) => `${p.name}（${p.element}${p.element === diFen.element ? '比和' : '生'}）`);
  const restrainHost = middlePositions
    .filter((p) => isKe(p.element, diFen.element))
    .map((p) => `${p.name}（${p.element}克）`);

  const allPositions = [renYuan, guiShen, jiangShen, diFen];
  const usePos = allPositions.find((p) => p.name === data.yinYangUse.usePosition) ?? jiangShen;
  const others = allPositions.filter((p) => p.name !== usePos.name);
  const useSupporters = others
    .filter((p) => p.element === usePos.element || isSheng(p.element, usePos.element))
    .map((p) => `${p.name}（${p.element}${p.element === usePos.element ? '比和' : '生扶'}）`);
  const useRestrainers = others
    .filter((p) => isKe(p.element, usePos.element))
    .map((p) => `${p.name}（${p.element}克制）`);
  const useStrong = usePos.seasonState === '旺' || usePos.seasonState === '相';
  const voidCondition = usePos.isVoid
    ? useStrong
      ? `用爻${usePos.name}（${usePos.branch}）落日旬空，但月令${usePos.seasonState}（旺相假空，待出空填实）`
      : `用爻${usePos.name}（${usePos.branch}）落日旬空且月令${usePos.seasonState}（休囚落空，受制偏重）`
    : `用爻${usePos.name}不空，月令${usePos.seasonState}（${useStrong ? '得令旺相' : '失令休囚'}）`;
  const otherVoids = others.filter((p) => p.isVoid).map((p) => `${p.name}（${p.branch}）`);
  const useMovements = data.movements
    .filter((m) => m.from === usePos.name || m.to === usePos.name)
    .map((m) => `${m.name}（${m.trigger}）`);

  const lines = [
    `上下递生与克战链：${chainPattern}；逐段：${verticalPairs.map((p) => p.label).join('；')}。`,
    `主客体用制衡：${hostGuestText}；神将偏向——助客：${assistGuest.join('、') || '无'}，克客：${restrainGuest.join('、') || '无'}；助主：${assistHost.join('、') || '无'}，克主：${restrainHost.join('、') || '无'}。`,
    `用爻旺衰与空亡受制：${voidCondition}${otherVoids.length ? `；其余落空位：${otherVoids.join('、')}` : '；四位其余不空'}；课内生扶用爻：${useSupporters.join('、') || '无'}；克制用爻：${useRestrainers.join('、') || '无'}${useMovements.length ? `；涉入动爻：${useMovements.join('、')}` : ''}。`,
  ];

  return {
    verticalPairs,
    chainPattern,
    hostGuestRelation,
    assistGuest,
    restrainGuest,
    assistHost,
    restrainHost,
    usePosition: usePos.name,
    useStrong,
    useIsVoid: usePos.isVoid,
    useSupporters,
    useRestrainers,
    otherVoids,
    text: lines.join('\n'),
  };
}

function buildJinkoujueExtendedNotes(data: JinkoujueData): string {
  const { renYuan, guiShen, jiangShen, diFen } = data.positions;
  const branchPairs: Array<[string, string, string, string]> = [
    ['贵神', guiShen.branch, '将神', jiangShen.branch],
    ['将神', jiangShen.branch, '地分', diFen.branch],
    ['贵神', guiShen.branch, '地分', diFen.branch],
  ];
  const branchInteractions: string[] = [];
  for (const [nameA, branchA, nameB, branchB] of branchPairs) {
    if (branchA === branchB) branchInteractions.push(`${nameA}与${nameB}同支（${branchA}）`);
    if (isHe(branchA, branchB)) branchInteractions.push(`${nameA}${branchA}与${nameB}${branchB}六合（主和合牵连）`);
    if (isChong(branchA, branchB)) branchInteractions.push(`${nameA}${branchA}与${nameB}${branchB}六冲（主散动变迁）`);
    if (isXing(branchA, branchB)) branchInteractions.push(`${nameA}${branchA}与${nameB}${branchB}相刑（主阻滞拧巴）`);
  }

  const dayStem = data.ganzhi.day[0] ?? '';
  const dayBranch = data.ganzhi.day[1] ?? '';
  const monthBranch = data.ganzhi.month[1] ?? '';
  const monthIdx = getBranchIndex(monthBranch);
  const tianyiBranch = monthIdx >= 0 ? EARTHLY_BRANCHES[(monthIdx + 11) % 12] : '';

  const hitPositions = (branch: string | undefined) => {
    if (!branch) return '';
    const hits = [guiShen, jiangShen, diFen]
      .filter((pos) => pos.branch === branch)
      .map((pos) => pos.name);
    return hits.length ? `［入${hits.join('/')}］` : '';
  };

  const shenshaList = [
    JINKOU_LUSHEN_MAP[dayStem]
      ? `日禄${JINKOU_LUSHEN_MAP[dayStem]}${hitPositions(JINKOU_LUSHEN_MAP[dayStem])}`
      : '',
    JINKOU_YIMA_MAP[dayBranch]
      ? `日马${JINKOU_YIMA_MAP[dayBranch]}${hitPositions(JINKOU_YIMA_MAP[dayBranch])}`
      : '',
    JINKOU_TIANMA_MAP[monthBranch]
      ? `月天马${JINKOU_TIANMA_MAP[monthBranch]}${hitPositions(JINKOU_TIANMA_MAP[monthBranch])}`
      : '',
    tianyiBranch ? `天医${tianyiBranch}${hitPositions(tianyiBranch)}` : '',
  ].filter(Boolean);

  return [
    `主客体用：人元${renYuan.stem}（${renYuan.element}）为外为客，地分${diFen.branch}（${diFen.element}）为内为主，贵神${guiShen.god}（${guiShen.element}）居尊统摄，将神${jiangShen.branch}（${jiangShen.element}）主财官内事。`,
    data.bihePoem ? `五行比合：${data.bihePoem}（《入式歌》按同气多寡参详气势聚散）。` : '五行比合：四位五行各异，无同气重见。',
    branchInteractions.length ? `四位支系冲合刑：${branchInteractions.join('；')}。` : '',
    shenshaList.length ? `课内常用神煞：${shenshaList.join('、')}。` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function publicResult(chart: JinkoujueData) {
  return { ...chart, evidenceAnalysis: analyzeJinkoujueEvidence(chart) };
}

type Result = ReturnType<typeof publicResult>;
type Settings = NonNullable<Input['jinkoujue']>;

async function compute(date: Date, settings: Settings = {}, randomOutcome?: number): Promise<Result> {
  const method = settings.method ?? 'time';
  const correction = settings.timeStandard === 'true-solar' ? (await import('./astronomy/true-solar')).trueSolarTime(date, settings.longitude!) : undefined;
  const chart = generateJinkoujue({ method, customDate: correction ? new Date(correction.effectiveTimestamp) : date, ...(correction ? { termReferenceDate: date } : {}),
    ...(method === 'branch' ? { branch: settings.branch } : {}), ...(method === 'number' ? { number: settings.number } : {}),
    ...(method === 'random' && randomOutcome !== undefined ? { randomOutcome } : {}),
    ...(settings.guiRenTable ? { guiRenTable: settings.guiRenTable } : {}) });
  if (correction) chart.timeContext = { standard: 'true-solar', longitude: correction.longitude, referenceTimestamp: date.getTime(), longitudeCorrectionMinutes: correction.longitudeCorrectionMinutes, equationOfTimeMinutes: correction.equationOfTimeMinutes, totalCorrectionMinutes: correction.totalCorrectionMinutes };
  return publicResult(chart);
}

function buildPrompt(data: Result, question: string, options: Input['prompt'], now: string) {
  const evidence = data.evidenceAnalysis;
  const selection = resolvePromptSelection('jinkoujue', options);
  const schoolText = formatSchoolGuidance(options?.schools, reference.schools);
  const classics = options?.includeClassics ? reference.classics.map((item) => `《${item.book}》·${item.chapter}：${item.summary}\n适用条件：${item.application}`).join('\n') : '';
  const classicExcerpts = options?.includeClassics
    ? formatClassicExcerpts(
        selectJinkoujueClassics({ movements: data.movements.map((item) => item.name) }),
        '典籍片段',
      )
    : '';
  const lifeYearSection = buildLiurenLifeYearSection(
    question,
    data.timestamp,
    [
      { branch: data.positions.guiShen.branch, god: data.positions.guiShen.god },
      { branch: data.positions.jiangShen.branch, god: data.positions.jiangShen.god },
      { branch: data.positions.diFen.branch, god: '地分' },
    ],
    data.xunKong,
  );
  const digestLines = buildMethodSituationDigest('jinkoujue', data, question);
  const user = [
    '【传统依据】\n按地分、月将、贵神与五子元遁建立四位，依阴阳次第确定发用，再结合五动三动、月令与旬空辨析。',
    digestLines.length ? `【局势要点】\n${digestLines.join('\n')}` : '',
    lifeYearSection,
    data.timeContext
      ? `【时间】\n实际起课：${new Date(data.timeContext.referenceTimestamp).toISOString()}；真太阳时钟表：${new Date(data.timestamp + 8 * 3_600_000).toISOString().slice(0, 19)}（北京时间钟表口径）；经度 ${data.timeContext.longitude}°，经度修正 ${data.timeContext.longitudeCorrectionMinutes.toFixed(3)} 分钟，均时差 ${data.timeContext.equationOfTimeMinutes.toFixed(3)} 分钟。节气、年月及月将依据实际起课时刻，日时依据真太阳时；提示词时间：${now}。`
      : `【时间】\n起课：${new Date(data.timestamp).toISOString()}；历法时区 UTC+08:00；提示词时间：${now}。`,
    `【起课与发用】\n${evidence.calculationFact.promptText}`,
    `【四位】\n${evidence.positions.map((item) => item.promptText.replace(/（按[^）]+）/gu, '').replace(/；不空$/u, '')).join('｜')}`,
    `【四位关系】\n生克：${evidence.relations.map((item) => item.promptText).join('；')}\n${buildJinkoujueExtendedNotes(data)}`,
    `【四位生克与主客制衡关系】\n${analyzeJinkoujueRelations(data).text}`,
    `【五动三动】\n${evidence.movementFacts.map((item) => item.promptText).join('；') || '未触发已列五动或三动。'}`,
    evidence.focusFacts.length ? `【发用焦点】\n${evidence.focusFacts.filter((item) => item.level === '主证').map((item) => item.promptText).join('；')}` : '',
    evidence.counterEvidenceFacts.length ? `【反证】\n${evidence.counterEvidenceFacts.map((item) => item.promptText.replace('，力量条件偏弱', '')).join('；')}` : '',
    selection ? `【解读选择】\n${selection.section}` : '',
    formatSchoolAlgorithmSection(evaluateJinkoujueSchoolAlgorithms(data, options?.schools)),
    schoolText,
    classics ? `【经典依据】\n${classics}` : '',
    classicExcerpts,
    `【任务】\n围绕问题复核四位、阴阳发用和五动三动，结合生克、月令与空亡说明支持、反证及成立条件。${selection ? `\n${selection.task}` : ''}\n盘面关系与动名是传统取象，不单凭一项推断必然结果或唯一日期。`,
    `【问题】\n${question}`,
  ].filter(Boolean).join('\n\n');
  return { text: user };
}

type Range = NonNullable<Input['range']>;
type JinkouRange = { kind: 'range'; input: { range: Range; jinkoujue: Settings }; source: { startTimestamp: number; endTimestamp: number; endExclusive: true; timezone: 'UTC+08:00' }; status: 'stable' | 'conditional'; branches: Array<{ startTimestamp: number; endTimestamp: number; endExclusive: true; data: Result }> };

function chartFacts(data: Result) {
  const { timestamp: _timestamp, termReferenceTimestamp: _reference, timeContext: _context, evidenceAnalysis: _evidence, ...facts } = data;
  return JSON.stringify(facts);
}

/** 随机起课只取一次地分，所有时段及后续追问复用该结果。 */
export async function generateJinkouRange(range: Range, settings: Settings = {}, fixedOutcome?: number): Promise<JinkouRange> {
  const { start, end } = parseDivinationRange(range, '金口诀');
  const method = settings.method ?? 'time';
  const outcome = method === 'random' ? fixedOutcome ?? (await compute(new Date(start), settings)).calculation.inputBase : undefined;
  if (outcome !== undefined && (!Number.isInteger(outcome) || outcome < 1 || outcome > 12)) throw new Error('金口诀随机地分无效。');
  const segments = await partitionDivinationRange({ start, end }, settings, { label: '金口诀', calculate: (timestamp) => compute(new Date(timestamp), settings, outcome), fingerprint: chartFacts,
    check: (data) => assertRangePillars(range.pillars, data.ganzhi, '金口诀') });
  const branches = segments.map(({ startTimestamp, endTimestamp, endExclusive, first }) => ({ startTimestamp, endTimestamp, endExclusive, data: first }));
  return { kind: 'range', input: { range, jinkoujue: settings }, source: { startTimestamp: start, endTimestamp: end, endExclusive: true, timezone: 'UTC+08:00' }, status: branches.length === 1 ? 'stable' : 'conditional', branches };
}

function rangePrompt(range: JinkouRange, question: string, options: Input['prompt'], now: string) {
  const format = (timestamp: number) => `${new Date(timestamp + 8 * 3_600_000).toISOString().slice(0, 19).replace('T', ' ')}（北京时间）`;
  const branches = range.branches.map((branch, index) => `【分支 ${index + 1}】\n${format(branch.startTimestamp)} 至 ${format(branch.endTimestamp)}（起点含、终点不含）；以下课盘时间为该分支起点的代表时刻。\n${buildPrompt(branch.data, question, options, now).text}`);
  const standard = range.input.jinkoujue.timeStandard === 'true-solar' ? `真太阳时（经度 ${range.input.jinkoujue.longitude}°）` : '北京时间';
  const text = [`【时间范围】\n${format(range.source.startTimestamp)} 至 ${format(range.source.endTimestamp)}（起点含、终点不含）；按${standard}计算日时，按实际起课时刻计算节气与月将。${range.input.jinkoujue.method === 'random' ? '所有分支复用同一次选出的地分。' : ''}`, ...branches,
    '【范围任务】\n分别比较各分支的共同点和差异，结论须标明适用时间段；不能把某一分支起点当作确定起课时刻。'].join('\n\n');
  return { text };
}

function withoutCachedEvidence(range: JinkouRange) {
  return { ...range, branches: range.branches.map((branch) => { const { evidenceAnalysis: _evidence, ...data } = branch.data; return { ...branch, data }; }) };
}

export async function promptForJinkouRange(data: unknown, input: Input, now: string) {
  if (!data || typeof data !== 'object' || !input.range) throw new Error('金口诀范围结果缺少有效区间。');
  const saved = data as JinkouRange;
  if (saved.kind !== 'range' || !saved.input || !Array.isArray(saved.branches) || !saved.branches.length) throw new Error('金口诀范围结果缺少原始输入或分支。');
  const random = input.jinkoujue?.method === 'random' ? saved.branches[0]?.data?.calculation?.inputBase : undefined;
  if (input.jinkoujue?.method === 'random' && (!Number.isInteger(random) || random! < 1 || random! > 12)) throw new Error('金口诀范围结果缺少有效的随机地分。');
  const expected = await generateJinkouRange(input.range, input.jinkoujue, random);
  if (!sameJsonValue(withoutCachedEvidence(saved), withoutCachedEvidence(expected))) throw new Error('金口诀范围结果与原始输入不一致。');
  return rangePrompt(expected, input.question, input.prompt, now);
}

export async function jinkoujue(input: Input, now: string) {
  if (input.range) {
    const data = await generateJinkouRange(input.range, input.jinkoujue);
    return { data, summary: { title: '金口诀范围起课', tags: [data.status === 'stable' ? '课盘稳定' : '条件分支', `${data.branches.length} 段`], lines: data.branches.map((branch, index) => `分支 ${index + 1}：${new Date(branch.startTimestamp).toISOString()} 至 ${new Date(branch.endTimestamp).toISOString()}（终点不含）；地分${branch.data.diFenBranch}，月将${branch.data.monthLeader}`) },
      prompt: rangePrompt(data, input.question, input.prompt, now) };
  }
  const data = await compute(new Date(input.divinationTime ?? now), input.jinkoujue);
  return {
    data,
    summary: { title: '金口诀排盘', tags: [`地分：${data.diFenBranch}`, `月将：${data.monthLeader}`, `发用：${data.yinYangUse.usePosition}`], lines: [data.mainLine] },
    prompt: buildPrompt(data, input.question, input.prompt, now),
  };
}

export async function promptForJinkoujue(value: unknown, question: string, options: Input['prompt'], now: string) {
  const data = (value && typeof value === 'object' ? value : undefined) as Result | undefined;
  const context = data?.timeContext;
  if (!data || !Number.isSafeInteger(data.timestamp) || !Number.isFinite(new Date(data.timestamp).getTime()) || data.timezoneOffsetMinutes !== 480 ||
      !['time', 'branch', 'number', 'random'].includes(data.method) || !data.calculation || !Number.isSafeInteger(data.calculation.inputBase) || data.calculation.inputBase < 1 ||
      (context ? context.standard !== 'true-solar' || !Number.isSafeInteger(context.referenceTimestamp) || !Number.isFinite(new Date(context.referenceTimestamp).getTime()) || !Number.isFinite(context.longitude) || context.longitude < -180 || context.longitude > 180 || data.termReferenceTimestamp !== context.referenceTimestamp : data.termReferenceTimestamp !== undefined)) {
    throw new Error('金口诀结果缺少有效起课资料。');
  }
  if (data.method === 'random' && data.calculation.inputBase > 12) throw new Error('金口诀随机地分无效。');
  if (data.guiRenTable !== undefined && data.guiRenTable !== 'jia-wu-geng-chou-wei' && data.guiRenTable !== 'jia-yang-wu-geng-niu') {
    throw new Error('金口诀结果包含不支持的贵人起例。');
  }
  // Recalculate from the recorded ground branch, without reconstructing a random process.
  const settings: Settings = {
    method: data.method,
    ...(data.method === 'branch' ? { branch: data.diFenBranch as Settings['branch'] } : {}),
    ...(data.method === 'number' ? { number: data.calculation.inputBase } : {}),
    ...(data.guiRenTable ? { guiRenTable: data.guiRenTable } : {}),
    ...(context ? { timeStandard: 'true-solar', longitude: context.longitude } : {}),
  };
  const rebuilt = await compute(new Date(context?.referenceTimestamp ?? data.timestamp), settings, data.method === 'random' ? data.calculation.inputBase : undefined);
  const { evidenceAnalysis: _cached, ...saved } = data;
  const { evidenceAnalysis: _rebuilt, ...expected } = rebuilt;
  if (!sameJsonValue(saved, expected)) throw new Error('金口诀课盘与起课时间或地分不一致。');
  return buildPrompt(rebuilt, question, options, now);
}
