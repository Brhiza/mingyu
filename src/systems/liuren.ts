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
  甲: '寅', 乙: '申', 丙: '巳', 戊: '巳', 丁: '亥', 己: '寅', 庚: '申', 辛: '巳', 壬: '亥', 癸: '巳',
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

function describeLiurenElementPair(fromElem: string, toElem: string): '生' | '被生' | '克' | '被克' | '比和' {
  if (fromElem === toElem) return '比和';
  if (isSheng(fromElem, toElem)) return '生';
  if (isSheng(toElem, fromElem)) return '被生';
  if (isKe(fromElem, toElem)) return '克';
  return '被克';
}

function isLiurenSeasonStrong(state: string | undefined): boolean {
  return state === '旺' || state === '相';
}

export function buildLiurenPatternRelations(data: LiurenData): string {
  const dayStem = data.ganzhi.day[0] ?? '';
  const dayBranch = data.ganzhi.day[1] ?? '';
  const monthBranch = data.ganzhi.month[1] ?? '';
  const stemElem = getStemWuxing(dayStem);
  const branchElem = getBranchWuxing(dayBranch);

  // 1. 课体与干支体用格局
  const ganZhiPattern =
    stemElem === branchElem
      ? '干支比和'
      : isSheng(stemElem, branchElem)
        ? '干生支'
        : isSheng(branchElem, stemElem)
          ? '支生干'
          : isKe(stemElem, branchElem)
            ? '干克支'
            : '支克干';
  const l1 = data.fourLessons[0];
  const l3 = data.fourLessons[2];
  let upperPattern = '';
  if (l1 && l3) {
    const u1 = getBranchWuxing(l1.upper);
    const u3 = getBranchWuxing(l3.upper);
    const rel =
      u1 === u3
        ? '干上支上比和'
        : isSheng(u1, u3)
          ? '干上生支上'
          : isSheng(u3, u1)
            ? '支上生干上'
            : isKe(u1, u3)
              ? '干上克支上'
              : '支上克干上';
    const extra = [
      isHe(l1.upper, l3.upper) ? '六合' : '',
      isChong(l1.upper, l3.upper) ? '六冲' : '',
      isXing(l1.upper, l3.upper) ? '相刑' : '',
    ].filter(Boolean);
    upperPattern = `；干上${l1.upper}与支上${l3.upper}呈${rel}${extra.length ? `兼${extra.join('、')}` : ''}`;
  }
  const guaTiText = data.guaTi?.length ? `，兼见课体：${data.guaTi.join('、')}` : '';
  const patternLine = `- 课体与干支体用格局：${data.transmissionRule}（传式：${data.transmissionPattern}）${guaTiText}；日干支呈${ganZhiPattern}${upperPattern}。`;

  // 2. 三传阶段演变与生克链
  const [chu, zhong, mo] = data.threeTransmissions;
  const elemOf = (t: LiurenData['threeTransmissions'][number] | undefined) =>
    t ? (t.wuxing ?? getBranchWuxing(t.branch)) : '';
  const chuElem = elemOf(chu);
  const zhongElem = elemOf(zhong);
  const moElem = elemOf(mo);

  const stageTokens = data.threeTransmissions.map(
    (t) => `${t.stage}${t.branch}${elemOf(t)}（月令${t.seasonState ?? '未知'}${t.isVoid ? '、旬空' : ''}，乘${t.god}）`,
  );
  const chuToZhong = chuElem && zhongElem ? describeLiurenElementPair(chuElem, zhongElem) : '比和';
  const zhongToMo = zhongElem && moElem ? describeLiurenElementPair(zhongElem, moElem) : '比和';

  const formatStepRel = (a: string, b: string, rel: ReturnType<typeof describeLiurenElementPair>) => {
    if (rel === '生') return `${a}生${b}`;
    if (rel === '被生') return `${b}生${a}`;
    if (rel === '克') return `${a}克${b}`;
    if (rel === '被克') return `${b}克${a}`;
    return `${a}${b}比和`;
  };
  const chainRelText =
    chu && zhong && mo
      ? `${formatStepRel('初传', '中传', chuToZhong)}、${formatStepRel('中传', '末传', zhongToMo)}`
      : '';

  const chuStrong = isLiurenSeasonStrong(chu?.seasonState) && !chu?.isVoid;
  const zhongStrong = isLiurenSeasonStrong(zhong?.seasonState) && !zhong?.isVoid;
  const moStrong = isLiurenSeasonStrong(mo?.seasonState) && !mo?.isVoid;
  const chuHelpsGan = chuElem ? isSheng(chuElem, stemElem) || chuElem === stemElem : false;
  const chuHarmsGan = chuElem ? isKe(chuElem, stemElem) : false;
  const moHelpsGan = moElem ? isSheng(moElem, stemElem) || moElem === stemElem : false;
  const moHarmsGan = moElem ? isKe(moElem, stemElem) : false;

  const isForwardFlow =
    (chuToZhong === '生' || chuToZhong === '比和') &&
    (zhongToMo === '生' || zhongToMo === '比和');

  let evolutionLabel: string;
  if (chu?.isVoid && mo?.isVoid) {
    evolutionLabel = '空亡待填（初末俱空，发端与归宿均待出空填实）';
  } else if (chu?.isVoid && (zhongStrong || moStrong)) {
    evolutionLabel = '空亡待填兼先阻后通（初传落空，中末传旺相不空接续）';
  } else if (mo?.isVoid && chuStrong) {
    evolutionLabel = '先顺后折兼空亡待填（初传旺实而末传落空，尾段虚浮待填）';
  } else if (chu?.isVoid || zhong?.isVoid || mo?.isVoid) {
    const voidStages = data.threeTransmissions.filter((t) => t.isVoid).map((t) => t.stage).join('、');
    evolutionLabel = `空亡待填（${voidStages}逢旬空，须待出空或冲实）`;
  } else if (isForwardFlow && chuStrong && moStrong && !moHarmsGan) {
    evolutionLabel = '顺生递进（三传生比相续且月令旺相不空）';
  } else if ((!chuStrong || chuHarmsGan) && (moStrong || moHelpsGan || zhongToMo === '生')) {
    evolutionLabel = '先阻后通（初段受制或休囚，中末段转旺或得生扶归结）';
  } else if ((chuStrong || chuHelpsGan) && (!moStrong || moHarmsGan || zhongToMo === '被克')) {
    evolutionLabel = '先顺后折（初段起势有力，末段转休囚、受克或克干）';
  } else if (data.transmissionPattern === '伏吟') {
    evolutionLabel = '伏吟滞缓（天地盘同位，三传以刑冲推进，节奏迟滞）';
  } else if (data.transmissionPattern === '反吟') {
    evolutionLabel = '反吟往复（天地盘对冲，进退反复）';
  } else {
    evolutionLabel = '递传互制（三传旺衰与生克交错，须按阶段分段核验）';
  }

  const evolutionLine = `- 三传阶段演变与生克链：${stageTokens.join(' → ')}；生克走向：${chainRelText}；阶段定性：${evolutionLabel}。`;

  // 3. 关键制衡因子（三传空衰救应 + 日禄/日德/驿马受冲克空破）
  const factors: string[] = [];

  if (chu && (chu.isVoid || !isLiurenSeasonStrong(chu.seasonState))) {
    const rescuers = [zhong, mo]
      .filter((t): t is NonNullable<typeof t> => Boolean(t))
      .filter((t) => {
        const te = elemOf(t);
        return (
          !t.isVoid &&
          isLiurenSeasonStrong(t.seasonState) &&
          (isSheng(te, chuElem) || isSheng(te, stemElem) || te === stemElem)
        );
      });
    if (rescuers.length) {
      factors.push(
        `初传${chu.branch}${chu.isVoid ? '落空' : `月令${chu.seasonState}`}，但${rescuers.map((t) => `${t.stage}${t.branch}（月令${t.seasonState}）`).join('、')}旺相不空形成救应`,
      );
    } else if (!moStrong) {
      factors.push(
        `初传${chu.branch}${chu.isVoid ? '落空' : `月令${chu.seasonState}`}且末传${mo?.branch ?? ''}亦无旺相实气救应，推进阻力偏重`,
      );
    }
  }

  const anchorSpecs: Array<{ label: string; branch: string | undefined }> = [
    { label: '日禄', branch: LIUREN_LU_MAP[dayStem] },
    { label: '日德', branch: LIUREN_DE_MAP[dayStem] },
    { label: '驿马', branch: LIUREN_YIMA_MAP[dayBranch] },
  ];
  for (const spec of anchorSpecs) {
    if (!spec.branch) continue;
    const plateItem = data.heavenlyPlate.find((p) => p.branch === spec.branch);
    const inLessons = data.fourLessons.filter((l) => l.upper === spec.branch).map((l) => l.name);
    const inTrans = data.threeTransmissions.filter((t) => t.branch === spec.branch).map((t) => t.stage);
    const placements = [...inLessons, ...inTrans];
    const issues: string[] = [];
    if (data.xunKong?.includes(spec.branch)) issues.push('落旬空');
    if (monthBranch && isChong(spec.branch, monthBranch)) issues.push('逢月破');
    if (dayBranch && isChong(spec.branch, dayBranch)) issues.push('受日冲');
    if (plateItem) {
      const upperElem = getBranchWuxing(plateItem.branch);
      const underElem = getBranchWuxing(plateItem.under);
      if (isKe(underElem, upperElem)) issues.push(`临地盘${plateItem.under}受下贼克`);
    }
    if (placements.length || issues.length) {
      const posText = placements.length ? `入${placements.join('/')}` : '未入课传';
      const statusText = issues.length ? `见${issues.join('、')}` : '不空不破且无下贼';
      factors.push(`${spec.label}${spec.branch}（${posText}，${statusText}）`);
    }
  }

  const factorsLine = `- 关键制衡因子：${factors.length ? factors.join('；') : '三传无空亡破损，禄德马未见明显冲克空亡'}。`;

  return [patternLine, evolutionLine, factorsLine].join('\n');
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
    `【课传组合与干支制衡关系】\n${buildLiurenPatternRelations(data)}`,
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
