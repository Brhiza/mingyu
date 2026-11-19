import type { z } from 'zod';
import type { liurenInput } from '../schema';
import type { LiurenData } from './liuren/types';
import type { LiurenGuiRenTable } from './liuren/plate';
import { analyzeLiurenEvidence, type LiurenEvidenceAnalysis } from './liuren/evidence';
import { generateLiurenChart } from './liuren/chart';
import { buildLiurenTemplateText } from './liuren-template';
import { getBranchWuxing, getStemWuxing, isChong, isHe, isKe, isSheng, isXing } from './calendar';
import { sameJsonValue } from '../json-value';
import { formatSchoolGuidance, resolvePromptSelection } from '../prompt-selection';
import { evaluateLiurenSchoolAlgorithms, formatSchoolAlgorithmSection } from './school-algorithms';
import { formatClassicExcerpts, selectLiurenClassics } from './classics';
import reference from './liuren-reference.json';
import { buildLiurenLifeYearSection, buildMethodSituationDigest } from './situation-digest';
import { assertRangePillars, parseDivinationRange, partitionDivinationRange } from './divination-range';

type Input = z.infer<typeof liurenInput>;
type LiurenResult = LiurenData & { evidenceAnalysis: LiurenEvidenceAnalysis }; 

const LIUREN_LU_MAP: Record<string, string> = {
  甲: '寅', 乙: '卯', 丙: '巳', 戊: '巳', 丁: '午', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子',
};
const LIUREN_DE_MAP: Record<string, string> = {
  甲: '寅', 乙: '申', 丙: '巳', 戊: '巳', 丁: '亥', 己: '亥', 庚: '申', 辛: '巳', 壬: '亥', 癸: '巳',
};
const LIUREN_YIMA_MAP: Record<string, string> = {
  申: '寅', 子: '寅', 辰: '寅',
  寅: '申', 午: '申', 戌: '申',
  巳: '亥', 酉: '亥', 丑: '亥',
  亥: '巳', 卯: '巳', 未: '巳',
};

function buildLiurenGanZhiAndKeyAnchors(data: LiurenData): string {
  const dayStem = data.ganzhi.day[0] ?? '';
  const dayBranch = data.ganzhi.day[1] ?? '';
  const stemElem = getStemWuxing(dayStem);
  const branchElem = getBranchWuxing(dayBranch);
  const ganZhiRel =
    stemElem === branchElem
      ? '干支比和（人宅同气、主客相应）'
      : isSheng(stemElem, branchElem)
        ? '干生支（我生事/人生宅，主我方主动投入或耗力就事）'
        : isSheng(branchElem, stemElem)
          ? '支生干（事生我/宅生人，主得环境或事项生扶助益）'
          : isKe(stemElem, branchElem)
            ? '干克支（我克事/人克宅，主我方主动进取掌控）'
            : '支克干（事克我/宅克人，主受客观境遇或对方牵制）';

  const l1 = data.fourLessons[0];
  const l3 = data.fourLessons[2];
  let upperRelLine = '';
  if (l1 && l3) {
    const u1Elem = getBranchWuxing(l1.upper);
    const u3Elem = getBranchWuxing(l3.upper);
    const uRel =
      u1Elem === u3Elem
        ? '干上支上比和'
        : isSheng(u1Elem, u3Elem)
          ? '干上生支上'
          : isSheng(u3Elem, u1Elem)
            ? '支上生干上'
            : isKe(u1Elem, u3Elem)
              ? '干上克支上'
              : '支上克干上';
    const uTags: string[] = [uRel];
    if (isHe(l1.upper, l3.upper)) uTags.push('干支上神六合');
    if (isChong(l1.upper, l3.upper)) uTags.push('干支上神六冲');
    if (isXing(l1.upper, l3.upper)) uTags.push('干支上神相刑');
    upperRelLine = `干支四课交涉：${ganZhiRel}；干上${l1.upper}（乘${l1.god}）与支上${l3.upper}（乘${l3.god}）为${uTags.join('、')}。`;
  }

  const describeAnchor = (label: string, branch: string | undefined) => {
    if (!branch) return '';
    const asHeaven = data.heavenlyPlate.find((p) => p.branch === branch);
    const inLessons = data.fourLessons.filter((l) => l.upper === branch).map((l) => l.name);
    const inTrans = data.threeTransmissions.filter((t) => t.branch === branch).map((t) => t.stage);
    const isVoid = data.xunKong?.includes(branch) ? '，旬空' : '';
    const hits = [...inLessons, ...inTrans];
    return `${label}${branch}（天盘临地盘${asHeaven?.under ?? '?'}乘${asHeaven?.god ?? '?'}${hits.length ? `，入${hits.join('/')}` : ''}${isVoid}）`;
  };

  const anchors = [
    describeAnchor('日禄', LIUREN_LU_MAP[dayStem]),
    describeAnchor('日德', LIUREN_DE_MAP[dayStem]),
    describeAnchor('驿马', LIUREN_YIMA_MAP[dayBranch]),
  ].filter(Boolean);

  return [
    upperRelLine,
    anchors.length ? `禄德马落位：${anchors.join('；')}。` : '',
  ]
    .filter(Boolean)
    .join('\n');
} 

async function generateLiuren(date: Date, longitude?: number, guiRenTable?: LiurenGuiRenTable): Promise<LiurenResult> {
  const correction = longitude === undefined ? undefined : (await import('./astronomy/true-solar')).trueSolarTime(date, longitude);
  const chart = generateLiurenChart(correction ? new Date(correction.effectiveTimestamp) : date, correction ? date : undefined, { guiRenTable });
  if (correction) chart.timeContext = { standard: 'true-solar', longitude: correction.longitude, referenceTimestamp: date.getTime(), longitudeCorrectionMinutes: correction.longitudeCorrectionMinutes, equationOfTimeMinutes: correction.equationOfTimeMinutes, totalCorrectionMinutes: correction.totalCorrectionMinutes };
  return { ...chart, evidenceAnalysis: analyzeLiurenEvidence(chart) };
}

function buildPrompt(data: LiurenResult, question: string, options: Input['prompt'], now: string) {
  const evidence = data.evidenceAnalysis!;
  const selection = resolvePromptSelection('liuren', options);
  const schoolText = formatSchoolGuidance(options?.schools, reference.schools);
  const schoolAlgorithmsText = formatSchoolAlgorithmSection(evaluateLiurenSchoolAlgorithms(data, options?.schools));
  const classics = options?.includeClassics ? reference.classics.map((item) => `《${item.book}》·${item.chapter}：${item.summary}\n适用条件：${item.application}`).join('\n') : '';
  const classicExcerpts = options?.includeClassics
    ? formatClassicExcerpts(
        selectLiurenClassics({
          transmissionRule: data.transmissionRule,
          generals: [
            ...data.threeTransmissions.map((item) => item.god),
            ...data.fourLessons.map((item) => item.god),
          ],
          lessonPatterns: [
            ...(data.guaTi ?? []),
            ...(data.patternTags ?? []),
            ...(data.transmissionPattern ? [data.transmissionPattern] : []),
          ],
        }),
        '典籍片段',
      )
    : '';
  const traditional = evidence.traditionalFacts.filter((item) => item.kind !== '神煞');
  const shensha = evidence.traditionalFacts.filter((item) => item.kind === '神煞');
  const formatFact = (item: typeof traditional[number]) => `${item.promptText}${item.originalText && !item.promptText.includes(item.originalText) ? `；参考资料：${item.originalText}` : ''}`;
  const formatTraditionalSection = () => {
    if (!traditional.length) return '';
    const patternTagHits: string[] = [];
    const restLines: string[] = [];
    for (const item of traditional) {
      if (!options?.includeClassics && item.kind === '天将乘神') continue;
      const m = /^盘面命中“([^”]+)”结构标签。$/u.exec(item.promptText);
      if (m) {
        patternTagHits.push(m[1]);
      } else if (item.kind === '天将属性' && item.name && !item.promptText.startsWith(item.name)) {
        restLines.push(`${item.name}：${item.promptText}`);
      } else {
        restLines.push(options?.includeClassics ? formatFact(item) : item.promptText);
      }
    }
    return [
      patternTagHits.length ? `结构标签：${patternTagHits.join('、')}。` : '',
      ...restLines,
    ]
      .filter(Boolean)
      .join('\n');
  };
  const showAdjudicationTrace =
    Boolean(options?.includeClassics) ||
    !/^(?:元首|重审)/u.test(data.transmissionRule ?? '');
  const plateCompact = [
    evidence.plateFacts.slice(0, 6).join('；'),
    evidence.plateFacts.slice(6, 12).join('；'),
  ]
    .filter(Boolean)
    .join('\n');
  const timingCompact = evidence.timingFacts
    .filter((item) => item.type !== '期限边界')
    .map((item) => item.promptText);
  const lifeYearSection = buildLiurenLifeYearSection(
    question,
    data.timestamp,
    data.heavenlyPlate,
    data.xunKong ?? [],
  );
  const digestLines = buildMethodSituationDigest('liuren', data, question);
  const user = [
    '【传统依据】\n按月将加时排天地盘，以四课定取传规则、三传和类神；课体、天将、神煞与应期只结合实际课盘使用。',
    digestLines.length ? `【局势要点】\n${digestLines.join('\n')}` : '',
    lifeYearSection,
    data.timeContext
      ? `【时间】\n实际起课：${new Date(data.timeContext.referenceTimestamp).toISOString()}；真太阳时钟表：${new Date(data.timestamp + 8 * 3_600_000).toISOString().slice(0, 19)}（北京时间钟表口径）；经度 ${data.timeContext.longitude}°，经度修正 ${data.timeContext.longitudeCorrectionMinutes.toFixed(3)} 分钟，均时差 ${data.timeContext.equationOfTimeMinutes.toFixed(3)} 分钟。节气、年月及月将依据实际起课时刻，日时依据真太阳时；提示词时间：${now}。`
      : `【时间】\n起课：${new Date(data.timestamp).toISOString()}；历法时区 UTC+08:00；提示词时间：${now}。`,
    `【起课】\n${evidence.calculationFacts.join('；')}`,
    `【天地盘】\n${plateCompact}`,
    `【四课取传】\n${evidence.lessons.map((item) => item.promptText).join('；')}\n${buildLiurenGanZhiAndKeyAnchors(data)}\n${evidence.transmissionRuleFact.promptText}${showAdjudicationTrace ? `\n${evidence.ordinaryTransmissionAdjudicationFact.promptText}` : ''}`,
    `【三传与推进】\n${evidence.transmissions.map((item) => item.promptText).join('\n')}`,
    evidence.counterEvidenceFacts.length ? `【反证】\n${evidence.counterEvidenceFacts.map((item) => item.promptText).join('；')}` : '',
    timingCompact.length ? `【应期条件】\n${timingCompact.join('；')}` : '',
    evidence.focusFacts.length ? `【类神焦点】\n${evidence.focusFacts.map((item) => item.promptText).join('\n')}` : '',
    shensha.length ? `【神煞】\n${options?.includeClassics ? shensha.map(formatFact).join('\n') : shensha.map((item) => item.originalText || item.promptText).join('、')}` : '',
    traditional.length ? `【课体及传统规则】\n${formatTraditionalSection()}` : '',
    `【断课模板】\n${buildLiurenTemplateText(options?.liurenTemplate ?? 'general', data)}`,
    selection ? `【解读选择】\n${selection.section}` : '',
    schoolText,
    schoolAlgorithmsText,
    classics ? `【经典依据】\n${classics}` : '',
    classicExcerpts,
    `【任务】\n围绕问题核对天地盘、四课发用和三传推进，依据选定模板定位事项类神；列出支持、反证、成立条件与资料不足。${selection ? `\n${selection.task}` : ''}\n应期、课体及神煞只作条件性传统取象，不换算唯一日期或事件保证。`,
    `【问题】\n${question}`,
  ].filter(Boolean).join('\n\n');
  return { text: user };
}

type RangeInput = NonNullable<Input['range']>;
type Settings = NonNullable<Input['liuren']>;
type LiurenRange = {
  kind: 'range'; input: { range: RangeInput; liuren: Settings };
  source: { startTimestamp: number; endTimestamp: number; endExclusive: true; timezone: 'UTC+08:00' };
  status: 'stable' | 'conditional';
  branches: Array<{ startTimestamp: number; endTimestamp: number; endExclusive: true; data: LiurenResult }>;
};

function chartFacts(data: LiurenResult) {
  const { timestamp: _timestamp, termReferenceTimestamp: _reference, timeContext: _context, evidenceAnalysis: _evidence, ...facts } = data;
  return JSON.stringify(facts);
}

/** 范围只对离散课盘分段；每段保留起点对应的完整课盘。 */
export async function generateLiurenRange(range: RangeInput, liuren: Settings = {}): Promise<LiurenRange> {
  const { start, end } = parseDivinationRange(range, '大六壬');
  const longitude = liuren.timeStandard === 'true-solar' ? liuren.longitude : undefined;
  const guiRenTable = liuren.guiRenTable;
  const segments = await partitionDivinationRange({ start, end }, liuren, { label: '大六壬', calculate: (timestamp) => generateLiuren(new Date(timestamp), longitude, guiRenTable), fingerprint: chartFacts,
    check: (data) => assertRangePillars(range.pillars, data.ganzhi, '大六壬') });
  const branches = segments.map(({ startTimestamp, endTimestamp, endExclusive, first }) => ({ startTimestamp, endTimestamp, endExclusive, data: first }));
  return { kind: 'range', input: { range, liuren }, source: { startTimestamp: start, endTimestamp: end, endExclusive: true, timezone: 'UTC+08:00' }, status: branches.length === 1 ? 'stable' : 'conditional', branches };
}

function rangePrompt(range: LiurenRange, question: string, options: Input['prompt'], now: string) {
  const format = (timestamp: number) => `${new Date(timestamp + 8 * 3_600_000).toISOString().slice(0, 19).replace('T', ' ')}（北京时间）`;
  const branches = range.branches.map((branch, index) => `【分支 ${index + 1}】\n${format(branch.startTimestamp)} 至 ${format(branch.endTimestamp)}（起点含、终点不含）；以下课盘时间为该分支起点的代表时刻。\n${buildPrompt(branch.data, question, options, now).text}`);
  const standard = range.input.liuren.timeStandard === 'true-solar' ? `真太阳时（经度 ${range.input.liuren.longitude}°）` : '北京时间';
  const text = [`【时间范围】\n${format(range.source.startTimestamp)} 至 ${format(range.source.endTimestamp)}（起点含、终点不含）；按${standard}计算日时，按实际起课时刻计算节气与月将。`, ...branches,
    '【范围任务】\n分别比较各分支的共同点和差异，结论须标明适用时间段；不能把某一分支起点当作确定起课时刻。'].join('\n\n');
  return { text };
}

function withoutCachedEvidence(range: LiurenRange) {
  return { ...range, branches: range.branches.map((branch) => { const { evidenceAnalysis: _evidence, ...data } = branch.data; return { ...branch, data }; }) };
}

export async function promptForLiurenRange(data: unknown, input: Input, now: string) {
  if (!data || typeof data !== 'object' || !input.range) throw new Error('大六壬范围结果缺少有效区间。');
  const saved = data as LiurenRange;
  if (saved.kind !== 'range' || !saved.input || !Array.isArray(saved.branches)) throw new Error('大六壬范围结果缺少原始输入或分支。');
  const expected = await generateLiurenRange(input.range, input.liuren);
  if (!sameJsonValue(withoutCachedEvidence(saved), withoutCachedEvidence(expected))) throw new Error('大六壬范围结果与原始输入不一致。');
  return rangePrompt(expected, input.question, input.prompt, now);
}

export async function liuren(input: Input, now: string) {
  if (input.range) {
    const data = await generateLiurenRange(input.range, input.liuren);
    return { data, summary: { title: '大六壬范围起课', tags: [data.status === 'stable' ? '课盘稳定' : '条件分支', `${data.branches.length} 段`], lines: data.branches.map((branch, index) => `分支 ${index + 1}：${new Date(branch.startTimestamp).toISOString()} 至 ${new Date(branch.endTimestamp).toISOString()}（终点不含）；月将${branch.data.monthLeader}，发用${branch.data.transmissionRule}`) },
      prompt: rangePrompt(data, input.question, input.prompt, now) };
  }
  const data = await generateLiuren(new Date(input.divinationTime ?? now), input.liuren?.timeStandard === 'true-solar' ? input.liuren.longitude : undefined, input.liuren?.guiRenTable);
  const evidence = data.evidenceAnalysis!;
  return {
    data,
    summary: { title: '大六壬排盘', tags: [`月将：${data.monthLeader}`, `发用：${data.transmissionRule}`, `三传：${data.threeTransmissions.map((item) => item.branch).join('→')}`], lines: evidence.calculationFacts },
    prompt: buildPrompt(data, input.question, input.prompt, now),
  };
}

export async function promptForLiuren(value: unknown, question: string, options: Input['prompt'], now: string) {
  const data = (value && typeof value === 'object' ? value : undefined) as LiurenResult | undefined;
  const context = data?.timeContext;
  if (!data || !Number.isSafeInteger(data.timestamp) || !Number.isFinite(new Date(data.timestamp).getTime()) || data.timezoneOffsetMinutes !== 480 ||
    (context ? context.standard !== 'true-solar' || !Number.isSafeInteger(context.referenceTimestamp) || !Number.isFinite(new Date(context.referenceTimestamp).getTime()) || !Number.isFinite(context.longitude) || context.longitude < -180 || context.longitude > 180 || data.termReferenceTimestamp !== context.referenceTimestamp : data.termReferenceTimestamp !== undefined)) {
    throw new Error('大六壬结果缺少有效的起课时间或经度。');
  }
  if (data.guiRenTable !== undefined && data.guiRenTable !== 'jia-wu-geng-chou-wei' && data.guiRenTable !== 'jia-yang-wu-geng-niu') {
    throw new Error('大六壬结果的贵人起例口诀无效。');
  }
  const rebuilt = await generateLiuren(new Date(context?.referenceTimestamp ?? data.timestamp), context?.longitude, data.guiRenTable);
  const { evidenceAnalysis: _cached, ...saved } = data;
  const { evidenceAnalysis: _rebuilt, ...expected } = rebuilt;
  if (!sameJsonValue(saved, expected)) throw new Error('大六壬课盘与起课时间不一致。');
  return buildPrompt(rebuilt, question, options, now);
}
