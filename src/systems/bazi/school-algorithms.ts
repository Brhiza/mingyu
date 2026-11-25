import type { PillarName } from './pillars';
import type { baziSchoolIds } from './prompt-options';
import type { SchoolAlgorithmEvaluation, SchoolStructuredVerdict } from '../school-algorithms';
import type { UsefulGodTradeoffAnalysis } from './useful-god';

type BaziSchoolId = (typeof baziSchoolIds)[number];

const pillarLabels: Record<PillarName, string> = { year: '年', month: '月', day: '日', hour: '时' };
const hostPositions = new Set<PillarName>(['day', 'hour']);
const guestPositions = new Set<PillarName>(['year', 'month']);
const bodyTenGods = new Set(['日主', '比肩', '劫财', '正印', '偏印', '食神', '伤官']);
const targetTenGods = new Set(['正财', '偏财', '正官', '七杀']);
const supportTenGods = new Set(['日主', '比肩', '劫财', '正印', '偏印']);
const peerTenGods = new Set(['比肩', '劫财']);
const wealthTenGods = new Set(['正财', '偏财']);
const officerTenGods = new Set(['正官', '七杀']);
const outputTenGods = new Set(['食神', '伤官']);
const resourceTenGods = new Set(['正印', '偏印']);
const tombBranches = new Set(['辰', '戌', '丑', '未']);
const tombElementLabel: Record<string, string> = { 辰: '水库', 戌: '火库', 丑: '金库', 未: '木库' };
const tombClashPartner: Record<string, string> = { 辰: '戌', 戌: '辰', 丑: '未', 未: '丑' };

const STEM_ELEMENT: Record<string, string> = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土',
  己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
};
const BRANCH_ELEMENT: Record<string, string> = {
  子: '水', 丑: '土', 寅: '木', 卯: '木', 辰: '土', 巳: '火',
  午: '火', 未: '土', 申: '金', 酉: '金', 戌: '土', 亥: '水',
};
const WUXING_GENERATE: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const WUXING_GENERATED_BY: Record<string, string> = { 木: '水', 火: '木', 土: '火', 金: '土', 水: '金' };
const WUXING_CONTROL: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
const WUXING_CONTROLLED_BY: Record<string, string> = { 木: '金', 火: '水', 土: '木', 金: '火', 水: '土' };

function clampScore(value: number, min = 10, max = 98): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function getDayMasterElement(chart: BaziChartForSchoolEval): string {
  return chart.strength.element || chart.pillars.day.stemElement || STEM_ELEMENT[chart.pillars.day.gan] || '木';
}

function getElementGroups(dayElement: string): { support: string[]; drain: string[] } {
  const support = [WUXING_GENERATED_BY[dayElement], dayElement].filter(Boolean);
  const drain = [WUXING_GENERATE[dayElement], WUXING_CONTROL[dayElement], WUXING_CONTROLLED_BY[dayElement]].filter(Boolean);
  return { support, drain };
}

function collectChartElements(chart: BaziChartForSchoolEval): Set<string> {
  const elems = new Set<string>();
  for (const pos of ['year', 'month', 'day', 'hour'] as const) {
    const p = chart.pillars[pos];
    const sElem = p.stemElement || STEM_ELEMENT[p.gan];
    const bElem = p.branchElement || BRANCH_ELEMENT[p.zhi];
    if (sElem) elems.add(sElem);
    if (bElem) elems.add(bElem);
  }
  return elems;
}

function collectVisibleAndMainTenGods(chart: BaziChartForSchoolEval): {
  stems: Set<string>;
  all: Set<string>;
  counts: Record<string, number>;
} {
  const stems = new Set<string>();
  const all = new Set<string>();
  const counts: Record<string, number> = {};
  const add = (g: string | undefined) => {
    if (!g || g === '日主') return;
    all.add(g);
    counts[g] = (counts[g] ?? 0) + 1;
  };
  for (const pos of ['year', 'month', 'day', 'hour'] as const) {
    const p = chart.pillars[pos];
    if (pos !== 'day' && p.tenGod) {
      stems.add(p.tenGod);
      add(p.tenGod);
    }
    const main = p.hiddenStems[0]?.tenGod;
    if (main) add(main);
  }
  return { stems, all, counts };
}

interface BaziChartForSchoolEval {
  pillars: Record<
    PillarName,
    {
      ganZhi: string;
      gan: string;
      zhi: string;
      stemElement?: string;
      branchElement?: string;
      tenGod: string;
      hiddenStems: Array<{ stem: string; tenGod: string }>;
      voidBranches: string[];
    }
  >;
  monthCommander: { branch: string; stem: string };
  natalFacts: {
    relations: Array<{ name: string; positions: PillarName[]; values: string[]; element?: string; subtype?: string }>;
    roots: Array<{ position: PillarName; stem: string; status: string }>;
  };
  strength: {
    status: string;
    element?: string;
    hasRoot?: boolean;
    strongRoot?: boolean;
    month: { season: string; commanderStem: string; commanderEffect: string };
  };
  ordinaryPattern: { candidate: string; source: string; selectedStem: string };
  patternOverview: { pattern: string; source: string };
  patternEvidence?: {
    decision?: {
      status: string;
      reason: string;
      breakers?: Array<{ label: string; effective: boolean; repairStatus: string }>;
    } | null;
  };
  climate: {
    currentJieqi?: string | null;
    candidates: Array<{ label: string; status: string; mode: string; usefulElement?: string; favorableOrder?: string[] }>;
  };
  usefulGod: {
    useful: string;
    avoid?: string;
    primaryReason?: string;
    favorableWuxing: string[];
    unfavorableWuxing: string[];
    incrementStatus: string;
    tradeoffAnalysis?: UsefulGodTradeoffAnalysis;
  };
}

function classifyRole(tenGod: string): '体' | '用' | '未知' {
  if (bodyTenGods.has(tenGod)) return '体';
  if (targetTenGods.has(tenGod)) return '用';
  return '未知';
}

function classifyTombTenGods(hiddenStems: Array<{ stem: string; tenGod: string }>): string {
  const tags: string[] = [];
  if (hiddenStems.some((h) => wealthTenGods.has(h.tenGod))) tags.push('财库');
  if (hiddenStems.some((h) => officerTenGods.has(h.tenGod))) tags.push('官杀库');
  if (hiddenStems.some((h) => resourceTenGods.has(h.tenGod))) tags.push('印库');
  if (hiddenStems.some((h) => outputTenGods.has(h.tenGod))) tags.push('食伤库');
  return tags.length ? tags.join('/') : '比劫土库';
}

// ==================== 1. 盲派：做功量化评分引擎 ====================

function evaluateMangpaiWorkPaths(chart: BaziChartForSchoolEval): {
  findings: string[];
  structuredVerdict: SchoolStructuredVerdict;
} {
  const hostItems: string[] = [];
  const guestItems: string[] = [];
  const tiList: string[] = [];
  const yongList: string[] = [];
  const hostTargets: string[] = [];

  for (const pos of ['year', 'month', 'day', 'hour'] as const) {
    const p = chart.pillars[pos];
    const mainGod = p.hiddenStems[0]?.tenGod ?? '';
    const desc = `${pillarLabels[pos]}柱${p.ganZhi}(${p.tenGod}${mainGod ? `/支${mainGod}` : ''})`;
    if (hostPositions.has(pos)) {
      hostItems.push(desc);
      if (pos !== 'day' && targetTenGods.has(p.tenGod)) hostTargets.push(`${pillarLabels[pos]}干${p.tenGod}`);
      if (targetTenGods.has(mainGod)) hostTargets.push(`${pillarLabels[pos]}支${mainGod}`);
    } else {
      guestItems.push(desc);
    }

    if (pos !== 'day' && bodyTenGods.has(p.tenGod)) tiList.push(`${pillarLabels[pos]}干${p.tenGod}`);
    if (pos !== 'day' && targetTenGods.has(p.tenGod)) yongList.push(`${pillarLabels[pos]}干${p.tenGod}`);
    if (bodyTenGods.has(mainGod)) tiList.push(`${pillarLabels[pos]}支${mainGod}`);
    if (targetTenGods.has(mainGod)) yongList.push(`${pillarLabels[pos]}支${mainGod}`);
  }

  const workRelations: string[] = [];
  const zhiYongList: string[] = [];
  const heYongList: string[] = [];
  const chuanZhiList: string[] = [];
  const tombWorkList: string[] = [];
  const antiWorkWarnings: string[] = [];
  let hostGuestLinkCount = 0;
  let hostCapturesGuestTarget = false;
  let workScore = 30; // 基础分

  for (const rel of chart.natalFacts.relations) {
    if (
      ![
        '六合',
        '六冲',
        '六害',
        '相刑',
        '天干五合',
        '天干相冲',
        '生地半合',
        '墓地半合',
        '三合局',
        '三会局',
      ].includes(rel.name)
    ) {
      continue;
    }
    const hasHost = rel.positions.some((p) => hostPositions.has(p));
    const hasGuest = rel.positions.some((p) => guestPositions.has(p));
    const scopeTag = hasHost && hasGuest ? '主宾联动' : hasHost ? '主位内做功' : '宾位互作用';
    if (hasHost && hasGuest) hostGuestLinkCount += 1;

    const isStemRel = rel.name === '天干五合' || rel.name === '天干相冲';
    const posGods = rel.positions.map((pos) => {
      const p = chart.pillars[pos];
      const god = isStemRel ? p.tenGod : (p.hiddenStems[0]?.tenGod ?? '');
      return { pos, isHost: hostPositions.has(pos), god, role: classifyRole(god), val: isStemRel ? p.gan : p.zhi };
    });

    const tombTag = rel.name === '六冲' && rel.values.some((v) => tombBranches.has(v)) ? '·冲开墓库' : '';
    const posText = rel.positions.map((p) => pillarLabels[p]).join('');
    workRelations.push(`${posText}${rel.values.join('')}${rel.name}(${scopeTag}${tombTag})`);

    const hasTi = posGods.some((g) => g.role === '体');
    const hasYong = posGods.some((g) => g.role === '用');

    // 合用做功
    if (['六合', '天干五合', '生地半合', '墓地半合', '三合局', '三会局'].includes(rel.name)) {
      if (hasHost && hasGuest) {
        const guestYong = posGods.filter((g) => !g.isHost && g.role === '用');
        const hostYong = posGods.filter((g) => g.isHost && g.role === '用');
        if (guestYong.length > 0) {
          hostCapturesGuestTarget = true;
          workScore += 15;
          heYongList.push(`主位合取宾位${guestYong.map((g) => g.god).join('、')}(${posText}${rel.values.join('')}${rel.name})`);
        } else if (hostYong.length > 0) {
          workScore -= 10;
          antiWorkWarnings.push(`宾位合分主位${hostYong.map((g) => g.god).join('、')}(${posText}${rel.values.join('')}${rel.name})`);
          heYongList.push(`宾位合动主位${hostYong.map((g) => g.god).join('、')}(${posText}${rel.values.join('')}${rel.name}，防分夺外流)`);
        } else {
          workScore += 6;
          heYongList.push(`主宾合气(${posText}${rel.values.join('')}${rel.name})`);
        }
      } else if (hasHost && hasYong) {
        workScore += 12;
        heYongList.push(`主位自合得用(${posText}${rel.values.join('')}${rel.name})`);
      }
    }

    // 穿制做功（六害）
    if (rel.name === '六害') {
      const hostTi = posGods.filter((g) => g.isHost && g.role === '体');
      const guestYong = posGods.filter((g) => !g.isHost && g.role === '用');
      if (hasHost && hasGuest && hostTi.length > 0 && guestYong.length > 0) {
        hostCapturesGuestTarget = true;
        workScore += 16;
        chuanZhiList.push(`主位体神穿制宾位${guestYong.map((g) => g.god).join('、')}(${posText}${rel.values.join('')}穿，制用快而带折损)`);
      } else if (hasHost && hasGuest && hostTi.length > 0) {
        workScore -= 15;
        antiWorkWarnings.push(`宾位${posText}${rel.values.join('')}相穿伤及主位体神，防反制`);
      } else if (hasTi && hasYong) {
        workScore += 8;
        chuanZhiList.push(`${scopeTag}穿制(${posText}${rel.values.join('')}害)`);
      }
    }

    // 制用做功（冲/刑）
    if (['六冲', '相刑', '天干相冲'].includes(rel.name)) {
      if (hasTi && hasYong) {
        const hostYong = posGods.filter((g) => g.isHost && g.role === '用');
        const guestYong = posGods.filter((g) => !g.isHost && g.role === '用');
        if (hasHost && guestYong.length > 0) {
          hostCapturesGuestTarget = true;
          workScore += 18;
          zhiYongList.push(`主位冲刑制宾位${guestYong.map((g) => g.god).join('、')}(${posText}${rel.values.join('')}${rel.name})`);
        } else if (hasHost && hostYong.length > 0 && hasGuest) {
          workScore -= 15;
          antiWorkWarnings.push(`宾位${posText}${rel.values.join('')}${rel.name}冲动主位财官，须防动摇`);
        } else {
          workScore += 10;
          zhiYongList.push(`${scopeTag}制用(${posText}${rel.values.join('')}${rel.name})`);
        }
      }
      // 墓库冲刑开库
      if (rel.name === '六冲' || rel.name === '相刑') {
        for (const pos of rel.positions) {
          const zhi = chart.pillars[pos].zhi;
          if (!tombBranches.has(zhi)) continue;
          const tombType = classifyTombTenGods(chart.pillars[pos].hiddenStems);
          const ownerTag = hostPositions.has(pos) ? '主位' : '宾位';
          if (tombType.includes('财库') || tombType.includes('官杀库')) {
            if (hostPositions.has(pos) || hasHost) {
              hostCapturesGuestTarget = true;
              workScore += 20;
            } else {
              workScore += 10;
            }
            tombWorkList.push(`${pillarLabels[pos]}支${zhi}(${ownerTag}${tombElementLabel[zhi]}/${tombType})逢${rel.name}开库得财官`);
          } else {
            workScore += 8;
            tombWorkList.push(`${pillarLabels[pos]}支${zhi}(${ownerTag}${tombElementLabel[zhi]}/${tombType})逢${rel.name}开库引动`);
          }
        }
      }
    }
  }

  // 检查闭藏墓库（未逢冲刑）
  const closedTombs: string[] = [];
  for (const pos of ['year', 'month', 'day', 'hour'] as const) {
    const zhi = chart.pillars[pos].zhi;
    if (!tombBranches.has(zhi)) continue;
    const isOpened = chart.natalFacts.relations.some(
      (r) => (r.name === '六冲' || r.name === '相刑') && r.positions.includes(pos),
    );
    if (!isOpened) {
      const tombType = classifyTombTenGods(chart.pillars[pos].hiddenStems);
      const ownerTag = hostPositions.has(pos) ? '主位' : '宾位';
      workScore += 3;
      closedTombs.push(
        `${pillarLabels[pos]}支${zhi}(${ownerTag}${tombType}闭藏，待岁运见${tombClashPartner[zhi]}冲开)`,
      );
    }
  }

  // 化用做功检测（连续相生链）
  const { all: allGods } = collectVisibleAndMainTenGods(chart);
  const huaYongList: string[] = [];
  if (
    ([...officerTenGods].some((g) => allGods.has(g))) &&
    ([...resourceTenGods].some((g) => allGods.has(g)))
  ) {
    workScore += 12;
    huaYongList.push('官杀生印→印生身（化官杀归主，温和持久）');
  }
  if (
    ([...outputTenGods].some((g) => allGods.has(g))) &&
    ([...wealthTenGods].some((g) => allGods.has(g)))
  ) {
    workScore += 12;
    huaYongList.push('食伤生财（以体生用，主技艺/经营求财）');
  }

  if (hostTargets.length > 0) workScore += 8;
  const finalScore = clampScore(workScore, 10, 98);

  // 做功方式汇总
  const methodSummaries: string[] = [];
  if (zhiYongList.length) methodSummaries.push(`制用：${zhiYongList.slice(0, 3).join('、')}`);
  if (chuanZhiList.length) methodSummaries.push(`穿制：${chuanZhiList.slice(0, 2).join('、')}`);
  if (heYongList.length) methodSummaries.push(`合用：${heYongList.slice(0, 3).join('、')}`);
  if (huaYongList.length) methodSummaries.push(`化用：${huaYongList.join('、')}`);
  if (tombWorkList.length) methodSummaries.push(`开库：${[...new Set(tombWorkList)].slice(0, 3).join('、')}`);
  if (closedTombs.length) methodSummaries.push(`闭库待开：${closedTombs.slice(0, 2).join('、')}`);

  // 做功主轴类型判定
  const hasWealthOfficerTomb = tombWorkList.some((t) => t.includes('财官'));
  const workAxisType = (() => {
    if (antiWorkWarnings.length >= 2 && !hostCapturesGuestTarget) return '宾反制主（防损耗）';
    if (hasWealthOfficerTomb) return '主位开财官库做功';
    if (zhiYongList.length > 0 || chuanZhiList.length > 0) return '以体冲穿制用做功';
    if (heYongList.some((h) => h.includes('主位合取') || h.includes('自合得用'))) return '以体合用做功';
    if (huaYongList.length > 0) return '化用流通做功';
    if (antiWorkWarnings.length > 0) return '宾反制主（局部受扰）';
    return '平缓流通/待岁运引动';
  })();

  // 做功效率与层次定性
  const activeWorkTypes =
    (zhiYongList.length > 0 ? 1 : 0) +
    (chuanZhiList.length > 0 ? 1 : 0) +
    (heYongList.length > 0 ? 1 : 0) +
    (huaYongList.length > 0 ? 1 : 0) +
    (tombWorkList.length > 0 ? 1 : 0);

  let efficiency = '偏低';
  if ((hostCapturesGuestTarget || hasWealthOfficerTomb) && activeWorkTypes >= 2 && antiWorkWarnings.length === 0) {
    efficiency = '高';
  } else if (hostCapturesGuestTarget || hostTargets.length > 0 || activeWorkTypes >= 2 || hostGuestLinkCount > 0) {
    efficiency = '中';
  }

  const tierLabel = finalScore >= 80
    ? '高效率做功（主位强收宾用，富贵层次偏高）'
    : finalScore >= 60
      ? '中上效率做功（路径清晰，实干累积成势）'
      : finalScore >= 42
        ? '中等做功（局部得用，须借大运流年加力）'
        : '做功偏弱或见反制（宜守成避险、待岁运开库合冲）';

  const hostGainText = hostTargets.length
    ? `主位自坐${hostTargets.slice(0, 3).join('、')}${hostCapturesGuestTarget ? '且主宾联动取宾位财官' : ''}`
    : hostCapturesGuestTarget
      ? '主位虽未自坐财官，但通过合冲穿开库将宾位财官收归主位'
      : '主位暂未直接占财官，亦乏强力收宾路径，须借大运流年合冲引动做功';

  const warningText = antiWorkWarnings.length ? `；反制警示：${antiWorkWarnings.slice(0, 2).join('、')}` : '';

  const favorableSignals: string[] = [];
  if (hasWealthOfficerTomb) favorableSignals.push('冲刑开财官墓库做功');
  if (zhiYongList.length) favorableSignals.push(`制用路径${zhiYongList.length}条`);
  if (chuanZhiList.length) favorableSignals.push(`穿制路径${chuanZhiList.length}条`);
  if (heYongList.some((h) => !h.includes('防分夺'))) favorableSignals.push('合用收宾/自合得用');
  if (huaYongList.length) favorableSignals.push(huaYongList.join('、'));
  if (hostTargets.length) favorableSignals.push(`主位坐${hostTargets.slice(0, 2).join('、')}`);

  return {
    findings: [
      `宾位[年月]：${guestItems.join('、')}；主位[日时]：${hostItems.join('、')}`,
      `体用归属：体（日主/印/比/食伤）=${tiList.slice(0, 6).join('、') || '无显'}；用（财/官杀）=${yongList.slice(0, 6).join('、') || '无显'}`,
      `做功路径候选：${workRelations.slice(0, 8).join('；') || '未见典型合冲穿刑做功，宜察生克流通'}`,
      `做功方式与墓库：${methodSummaries.join('；') || '未见明显制化合穿开库，属平缓流通结构'}`,
      `盲派断语要点：做功效率「${efficiency}」；主位得用判断：${hostGainText}${warningText}；做功量化：${finalScore}/100（主轴：${workAxisType}）`,
    ],
    structuredVerdict: {
      stance: `盲派做功·${workAxisType}（效率${efficiency}）`,
      primaryFocus: '宾主宫位、体用制化合穿与墓库开合效率',
      favorableSignals: favorableSignals.length ? favorableSignals : ['原局做功平缓，待岁运合冲引动'],
      riskSignals: antiWorkWarnings.length ? antiWorkWarnings : (closedTombs.length ? [`墓库闭藏待冲：${closedTombs[0]}`] : []),
      score: finalScore,
      keyConclusion: `做功分${finalScore}/100，主轴「${workAxisType}」，层次定性：${tierLabel}。`,
    },
  };
}

// ==================== 2. 新派：月令空亡反断重算算法 ====================

function evaluateXinpaiFacts(chart: BaziChartForSchoolEval): {
  findings: string[];
  structuredVerdict: SchoolStructuredVerdict;
} {
  const dayVoids = new Set(chart.pillars.day.voidBranches);
  const yearVoids = new Set(chart.pillars.year.voidBranches);
  const voidHits: string[] = [];
  const monthVoidByDay = dayVoids.has(chart.pillars.month.zhi);
  const yearVoidByDay = dayVoids.has(chart.pillars.year.zhi);
  const hourVoidByDay = dayVoids.has(chart.pillars.hour.zhi);

  for (const pos of ['year', 'month', 'day', 'hour'] as const) {
    const zhi = chart.pillars[pos].zhi;
    if (dayVoids.has(zhi)) voidHits.push(`${pillarLabels[pos]}支${zhi}(日空)`);
    else if (yearVoids.has(zhi)) voidHits.push(`${pillarLabels[pos]}支${zhi}(年空)`);
  }

  const rootStatusByPos = new Map(chart.natalFacts.roots.map((r) => [r.position, r.status]));
  const floatingStems = chart.natalFacts.roots
    .filter((r) => r.status.includes('无根') || r.status.includes('虚浮'))
    .map((r) => `${pillarLabels[r.position]}干${r.stem}(${r.status})`);

  const dayElement = getDayMasterElement(chart);
  const { support: supportElems, drain: drainElems } = getElementGroups(dayElement);
  const tradStrong = ['身强', '偏强', '极强'].includes(chart.strength.status);
  const tradWeak = ['身弱', '偏弱', '极弱'].includes(chart.strength.status);

  const monthStemFloat = (rootStatusByPos.get('month') ?? '').includes('无根');
  const hourStemFloat = (rootStatusByPos.get('hour') ?? '').includes('无根');
  const dayBranchVoid = dayVoids.has(chart.pillars.day.zhi) || yearVoids.has(chart.pillars.day.zhi);

  // 1. 新派独立旺衰重算（月令落日空时，真正切换以年支替代月令重算旺衰！）
  const yearMainGod = chart.pillars.year.hiddenStems[0]?.tenGod ?? '';
  const dayMainGod = chart.pillars.day.hiddenStems[0]?.tenGod ?? '';
  const monthMainGod = chart.pillars.month.hiddenStems[0]?.tenGod ?? '';

  let xinpaiStrengthStatus: '新派身旺' | '新派身弱' | '新派中和';
  let xinpaiRecomputedReversed = false;
  const voidImpactNotes: string[] = [];

  if (monthVoidByDay) {
    // 月令空亡不决定旺衰，改以年支为第一权重 + 紧贴三字重算
    const yearSupport = supportTenGods.has(yearMainGod);
    const daySupport = supportTenGods.has(dayMainGod);
    const monthStemSupport = supportTenGods.has(chart.pillars.month.tenGod);
    const hourStemSupport = supportTenGods.has(chart.pillars.hour.tenGod);

    let power = 0;
    power += yearSupport ? 2.2 : -2.2;
    power += dayBranchVoid ? (daySupport ? 0.5 : -0.5) : (daySupport ? 1.4 : -1.4);
    power += monthStemSupport ? 0.5 : -0.5;
    power += hourVoidByDay ? (hourStemSupport ? 0.5 : -0.5) : (hourStemSupport ? 1.0 : -1.0);

    xinpaiStrengthStatus = power >= 0.8 ? '新派身旺' : power <= -0.8 ? '新派身弱' : '新派中和';
    xinpaiRecomputedReversed = (tradStrong && xinpaiStrengthStatus === '新派身弱')
      || (tradWeak && xinpaiStrengthStatus === '新派身旺');

    const yearRole = yearSupport ? '生扶日主（增旺倾向）' : '克泄耗日主（减力倾向）';
    voidImpactNotes.push(
      `月支${chart.pillars.month.zhi}落日空：新派以月令空亡不决定旺衰，改以年支${chart.pillars.year.zhi}(${yearMainGod})论旺衰，年支表现为${yearRole}→新派重算旺衰为「${xinpaiStrengthStatus}」${xinpaiRecomputedReversed ? `（较传统「${chart.strength.status}」发生旺衰反转！）` : ''}`,
    );
  } else {
    // 月令未空，仍以月令为主、辅以紧贴三字确认新派旺衰
    const monthSupport = supportTenGods.has(monthMainGod) || chart.strength.month.commanderEffect.includes('生') || chart.strength.month.commanderEffect.includes('比');
    if (tradStrong) xinpaiStrengthStatus = '新派身旺';
    else if (tradWeak) xinpaiStrengthStatus = '新派身弱';
    else xinpaiStrengthStatus = monthSupport ? '新派身旺' : '新派中和';
    voidImpactNotes.push(
      `月支${chart.pillars.month.zhi}未落日空，旺衰仍以月令（${chart.strength.month.season}）为第一权重→新派定性为「${xinpaiStrengthStatus}」`,
    );
  }

  if (yearVoidByDay) {
    voidImpactNotes.push(`年支${chart.pillars.year.zhi}落日空：祖业/外缘根基减力，年干实效打折`);
  }
  if (hourVoidByDay) {
    voidImpactNotes.push(`时支${chart.pillars.hour.zhi}落日空：时干虚实易变，晚运与成果落位须待岁运填实`);
  }
  if (yearVoids.has(chart.pillars.day.zhi)) {
    voidImpactNotes.push(`日支${chart.pillars.day.zhi}落年空（互换空亡）：配偶宫与日主坐下之气带虚象，易触发反断`);
  }

  // 2. 使用新派重算后的旺衰，逐一判定紧贴三字（月干、日支、时干）的独立用忌与虚实反断状态
  const isXinpaiStrong = xinpaiStrengthStatus === '新派身旺';
  const isXinpaiWeak = xinpaiStrengthStatus === '新派身弱';

  const adjacentUsefulList: string[] = [];
  const adjacentAvoidList: string[] = [];
  const adjacentReverseList: string[] = [];

  const judgeAdjacent = (label: string, tenGod: string, isVoidBranch: boolean, isFloating: boolean) => {
    const isSupport = supportTenGods.has(tenGod);
    const effect = isSupport ? '生扶日主' : '克泄耗日主';
    let role = '中性待岁运定喜忌';
    let baseTag: '用神' | '忌神' | '中性' = '中性';
    if (isXinpaiStrong) {
      baseTag = isSupport ? '忌神' : '用神';
      role = isSupport ? '紧贴为忌神（增旺助身）' : '紧贴为用神（泄耗克身）';
    } else if (isXinpaiWeak) {
      baseTag = isSupport ? '用神' : '忌神';
      role = isSupport ? '紧贴为用神（直接助身）' : '紧贴为忌神（直接耗克）';
    }
    const modifier: string[] = [];
    if (isVoidBranch) modifier.push('坐空减力/防反断');
    if (isFloating) modifier.push('虚浮无根/待岁运变实');

    if (isVoidBranch || isFloating) {
      adjacentReverseList.push(`${label}(${tenGod}·原判${baseTag}，因${isVoidBranch ? '坐空' : '虚浮'}带反断倾向)`);
    } else if (baseTag === '用神') {
      adjacentUsefulList.push(`${label}(${tenGod}·紧贴实用)`);
    } else if (baseTag === '忌神') {
      adjacentAvoidList.push(`${label}(${tenGod}·紧贴实忌)`);
    }
    return `${label}[${tenGod}·${effect}→${role}${modifier.length ? `；${modifier.join('，')}` : ''}]`;
  };

  const adjacentJudgments = [
    judgeAdjacent(`月干${chart.pillars.month.gan}`, chart.pillars.month.tenGod, monthVoidByDay, monthStemFloat),
    judgeAdjacent(`日支${chart.pillars.day.zhi}`, dayMainGod, dayBranchVoid, false),
    judgeAdjacent(`时干${chart.pillars.hour.gan}`, chart.pillars.hour.tenGod, hourVoidByDay, hourStemFloat),
  ];

  // 3. 虚实天干与反断提示
  const reverseHints: string[] = [];
  if (floatingStems.length > 0) {
    reverseHints.push(`虚干（${floatingStems.join('、')}）在原局力弱，须待大运流年见同气实神时方显吉凶`);
  }
  if (monthVoidByDay || dayBranchVoid || hourVoidByDay) {
    reverseHints.push('空亡宫位易触发新派反断（原局忌神受制反作吉论，用神受制反作凶论）');
  }
  if (!reverseHints.length) {
    reverseHints.push('天干皆有根且紧贴宫位未落空亡，以正断生克为主，岁运再察干支虚实转换');
  }

  const xinpaiFavElements = isXinpaiStrong ? drainElems : isXinpaiWeak ? supportElems : [...supportElems.slice(0, 1), ...drainElems.slice(0, 1)];
  const xinpaiScore = clampScore(
    56 + adjacentUsefulList.length * 10 - adjacentAvoidList.length * 9 - adjacentReverseList.length * 4 + (xinpaiRecomputedReversed ? -3 : 3),
  );

  const stance = `${xinpaiStrengthStatus}·喜${xinpaiFavElements.join('、')}${monthVoidByDay ? '（月空改看年支）' : ''}`;

  return {
    findings: [
      `紧贴作用链：月干${chart.pillars.month.gan}(${chart.pillars.month.tenGod})、日支${chart.pillars.day.zhi}(${dayMainGod})、时干${chart.pillars.hour.gan}(${chart.pillars.hour.tenGod})直接紧贴日主`,
      `紧贴三字喜忌：${adjacentJudgments.join('；')}`,
      `旬空落支：${voidHits.join('、') || '四柱地支未落入日/年旬空'}（${voidImpactNotes.join('；')}）`,
      `天干虚实（百神论参考）：${floatingStems.join('、') || '所透天干均见同气藏干'}；反断提示：${reverseHints.join('；')}`,
    ],
    structuredVerdict: {
      stance,
      primaryFocus: monthVoidByDay ? '月令空亡改看年支重算与紧贴三字反断' : '紧贴三字用忌与天干虚实转换',
      favorableSignals: [
        `新派喜用五行：${xinpaiFavElements.join('、')}`,
        ...adjacentUsefulList,
      ],
      riskSignals: [
        ...adjacentAvoidList,
        ...adjacentReverseList,
        ...(xinpaiRecomputedReversed ? [`月空改看年支导致旺衰与传统「${chart.strength.status}」反转`] : []),
      ],
      score: xinpaiScore,
      keyConclusion: `${stance}；紧贴实用${adjacentUsefulList.length}字、实忌${adjacentAvoidList.length}字、虚空反断${adjacentReverseList.length}字（评分${xinpaiScore}/100）。`,
    },
  };
}

// ==================== 3. 《子平真诠》格局派：独立相神/破格/成败等级 ====================

interface GejuRuleSpec {
  mode: '顺用' | '逆用' | '月外取用' | '顺势特殊格';
  xiangshen: string[];
  breakers: string[];
  rescues: string[];
}

function resolveGejuRule(patternName: string, isSpecial: boolean): GejuRuleSpec {
  if (isSpecial) {
    return { mode: '顺势特殊格', xiangshen: ['顺势五行'], breakers: ['逆势冲克五行'], rescues: ['通关转化之神'] };
  }
  if (patternName.includes('正官')) {
    return { mode: '顺用', xiangshen: ['正财', '偏财', '正印', '偏印'], breakers: ['伤官', '七杀'], rescues: ['正印', '偏印', '食神'] };
  }
  if (patternName.includes('七杀') || patternName.includes('偏官')) {
    return { mode: '逆用', xiangshen: ['食神', '正印', '偏印'], breakers: ['正财', '偏财'], rescues: ['正印', '偏印', '比肩', '劫财'] };
  }
  if (patternName.includes('正财') || patternName.includes('偏财')) {
    return { mode: '顺用', xiangshen: ['食神', '伤官', '正官'], breakers: ['比肩', '劫财'], rescues: ['正官', '食神', '伤官'] };
  }
  if (patternName.includes('正印')) {
    return { mode: '顺用', xiangshen: ['正官', '七杀', '比肩', '劫财'], breakers: ['正财', '偏财'], rescues: ['正官', '比肩', '劫财'] };
  }
  if (patternName.includes('偏印') || patternName.includes('枭')) {
    return { mode: '逆用', xiangshen: ['偏财', '正财', '正官'], breakers: ['食神'], rescues: ['偏财', '正财'] };
  }
  if (patternName.includes('食神')) {
    return { mode: '顺用', xiangshen: ['正财', '偏财', '比肩'], breakers: ['偏印'], rescues: ['偏财', '正财'] };
  }
  if (patternName.includes('伤官')) {
    return { mode: '逆用', xiangshen: ['正印', '偏印', '正财', '偏财'], breakers: ['正官'], rescues: ['正财', '偏财', '正印'] };
  }
  if (patternName.includes('刃') || patternName.includes('劫财')) {
    return { mode: '月外取用', xiangshen: ['七杀', '正官'], breakers: ['比肩', '劫财'], rescues: ['七杀', '正官', '食神'] };
  }
  // 建禄/比肩格
  return { mode: '月外取用', xiangshen: ['正官', '七杀', '正财', '偏财', '食神', '伤官'], breakers: ['比肩', '劫财'], rescues: ['正官', '七杀', '食神'] };
}

function evaluateGejuAlgorithm(
  chart: BaziChartForSchoolEval,
  triad: ReturnType<typeof buildTraditionalTriadSynthesis>,
): { findings: string[]; structuredVerdict: SchoolStructuredVerdict } {
  const isSpecial = chart.patternOverview.source !== '普通月令取格候选';
  const targetPattern = isSpecial ? chart.patternOverview.pattern : chart.ordinaryPattern.candidate;
  const spec = resolveGejuRule(targetPattern, isSpecial);
  const { stems, all } = collectVisibleAndMainTenGods(chart);

  const presentXiangshen = isSpecial
    ? (chart.usefulGod.favorableWuxing.length ? chart.usefulGod.favorableWuxing.map((w) => `顺势${w}`) : ['顺势流通'])
    : spec.xiangshen.filter((g) => all.has(g));
  const exposedXiangshen = isSpecial ? presentXiangshen : spec.xiangshen.filter((g) => stems.has(g));

  // 破格忌神检测（结合独立规则与 patternEvidence）
  const evidenceBreakers = chart.patternEvidence?.decision?.breakers?.filter((b) => b.effective) ?? [];
  const ruleBreakersHit = isSpecial
    ? []
    : spec.breakers.filter((g) => {
        if (!all.has(g)) return false;
        // 建禄/月刃格只有在缺少财官食伤护格时才将比劫视为破格
        if (spec.mode === '月外取用' && presentXiangshen.length > 0) return false;
        // 七杀格见财：若同时见印化杀则财不算直接破格
        if ((targetPattern.includes('七杀') || targetPattern.includes('偏官')) && wealthTenGods.has(g) && (all.has('正印') || all.has('偏印'))) {
          return false;
        }
        return true;
      });

  const rescueHit = isSpecial
    ? []
    : [...new Set(
        ruleBreakersHit.flatMap((breaker) => {
          // 精准匹配破格忌神对应的专属救应相神
          if (targetPattern.includes('正官') && breaker === '伤官') {
            return ['正印', '偏印'].filter((g) => all.has(g));
          }
          if (targetPattern.includes('正官') && breaker === '七杀') {
            return ['食神'].filter((g) => all.has(g));
          }
          return spec.rescues.filter((g) => all.has(g) && !ruleBreakersHit.includes(g));
        }),
      )];

  const hasUnrepairedEvidenceBreaker = evidenceBreakers.some((b) => b.repairStatus.includes('未救') || b.repairStatus.includes('无救'));
  const hasRepairedEvidenceBreaker = evidenceBreakers.length > 0 && !hasUnrepairedEvidenceBreaker;

  let grade: '上格清纯' | '成格微瑕' | '破格有救' | '破格待救';
  let score: number;
  if (hasUnrepairedEvidenceBreaker || (ruleBreakersHit.length > 0 && rescueHit.length === 0)) {
    grade = '破格待救';
    score = clampScore(38 - ruleBreakersHit.length * 5 - evidenceBreakers.length * 4 + (exposedXiangshen.length > 0 ? 6 : 0));
  } else if (hasRepairedEvidenceBreaker || (ruleBreakersHit.length > 0 && rescueHit.length > 0)) {
    grade = '破格有救';
    score = clampScore(62 + rescueHit.length * 4 - ruleBreakersHit.length * 3);
  } else if (exposedXiangshen.length > 0 || (isSpecial && chart.usefulGod.tradeoffAnalysis?.followEdgeAssessment?.kind !== '假从/从格边缘')) {
    grade = '上格清纯';
    score = clampScore(84 + Math.min(10, exposedXiangshen.length * 4));
  } else {
    grade = '成格微瑕';
    score = clampScore(68 + presentXiangshen.length * 3);
  }

  const breakerText = evidenceBreakers.length
    ? `有效破格项：${evidenceBreakers.map((b) => `${b.label}(救应${b.repairStatus})`).join('、')}`
    : ruleBreakersHit.length
      ? `格局破忌：见${ruleBreakersHit.join('、')}${rescueHit.length ? `（幸有${rescueHit.join('、')}救应）` : '（缺显性救应）'}`
      : '未见明透有效破格项';

  const xiangshenText = presentXiangshen.length
    ? `相神护格：${presentXiangshen.join('、')}${exposedXiangshen.length ? `（明透${exposedXiangshen.join('、')}）` : '（藏支待透）'}`
    : `相神（需${spec.xiangshen.slice(0, 3).join('/')}）原局未显，待岁运引出`;

  return {
    findings: [
      `月令取格：${chart.ordinaryPattern.candidate}（${chart.ordinaryPattern.source}·${chart.ordinaryPattern.selectedStem}；${spec.mode}）`,
      `路线总序：${chart.patternOverview.pattern}（${chart.patternOverview.source}）；${breakerText}`,
      `格局成败等级「${grade}」（${score}/100）：${xiangshenText}`,
      `格局与扶抑调候权衡：${triad.patternView}；${triad.priorityRule}`,
    ],
    structuredVerdict: {
      stance: `${targetPattern}（${spec.mode}）·${grade}`,
      primaryFocus: '月令立格、相神护格与破格救应成败',
      favorableSignals: [
        ...(presentXiangshen.length ? [`格局相神：${presentXiangshen.join('、')}`] : []),
        ...(rescueHit.length && ruleBreakersHit.length ? [`救应之神：${rescueHit.join('、')}`] : []),
      ],
      riskSignals: [
        ...(ruleBreakersHit.length ? [`破格忌神：${ruleBreakersHit.join('、')}`] : []),
        ...evidenceBreakers.map((b) => `${b.label}(${b.repairStatus})`),
      ],
      score,
      keyConclusion: `立「${targetPattern}」按${spec.mode}定为「${grade}」（${score}/100）；${xiangshenText}。`,
    },
  };
}

// ==================== 4. 《穷通宝鉴》调候派：寒暖燥湿急缓引擎 ====================

function evaluateTiaohouAlgorithm(
  chart: BaziChartForSchoolEval,
  triad: ReturnType<typeof buildTraditionalTriadSynthesis>,
): { findings: string[]; structuredVerdict: SchoolStructuredVerdict } {
  const monthBranch = chart.monthCommander.branch || chart.pillars.month.zhi;
  const chartElems = collectChartElements(chart);

  let climateNature: string;
  let urgency: '极急' | '中等' | '从缓';
  let preferredElements: string[];
  let climateRiskTag: string;

  if (['亥', '子', '丑'].includes(monthBranch)) {
    climateNature = '冬令极寒';
    urgency = '极急';
    preferredElements = ['火', '木'];
    climateRiskTag = '水冷金寒/湿冻失温';
  } else if (['巳', '午', '未'].includes(monthBranch)) {
    climateNature = '夏令极燥';
    urgency = '极急';
    preferredElements = ['水', '金'];
    climateRiskTag = '火炎土燥/枯焦失润';
  } else if (monthBranch === '戌') {
    climateNature = '季秋燥土';
    urgency = '中等';
    preferredElements = ['水', '木'];
    climateRiskTag = '秋末燥土脆金耗水';
  } else if (monthBranch === '辰') {
    climateNature = '季春湿土';
    urgency = '中等';
    preferredElements = ['火', '木'];
    climateRiskTag = '暮春湿重易晦火';
  } else if (monthBranch === '寅') {
    climateNature = '初春余寒';
    urgency = '中等';
    preferredElements = ['火', '水'];
    climateRiskTag = '初春余寒未尽需暖';
  } else if (['申', '酉'].includes(monthBranch)) {
    climateNature = '秋令微凉偏燥';
    urgency = '从缓';
    preferredElements = ['水', '火'];
    climateRiskTag = '秋肃微燥需淘洗或炼制';
  } else {
    climateNature = '仲春平和';
    urgency = '从缓';
    preferredElements = ['火', '水'];
    climateRiskTag = '气候平和，寒暖冲突轻';
  }

  // 若本地气候候选已有显性 usefulElement，排在最前
  const candidateElem = chart.climate.candidates.find((c) => c.usefulElement)?.usefulElement;
  if (candidateElem && !preferredElements.includes(candidateElem)) {
    preferredElements = [candidateElem, ...preferredElements];
  } else if (candidateElem && preferredElements[0] !== candidateElem) {
    preferredElements = [candidateElem, ...preferredElements.filter((e) => e !== candidateElem)];
  }

  const primaryElem = preferredElements[0];
  const hasPrimaryInChart = chartElems.has(primaryElem);
  const hasSecondaryInChart = preferredElements[1] ? chartElems.has(preferredElements[1]) : false;

  let score = urgency === '极急' ? 48 : urgency === '中等' ? 62 : 74;
  if (hasPrimaryInChart) score += 26;
  else if (hasSecondaryInChart) score += 10;
  else if (urgency === '极急') score -= 14;
  score = clampScore(score);

  const climateHits = chart.climate.candidates
    .slice(0, 4)
    .map((c) => `${c.label}(${c.status})`)
    .join('、');
  const climateTradeoff = chart.usefulGod.tradeoffAnalysis?.climateVsBalance;
  const presenceLabel = hasPrimaryInChart ? `原局已见调候首选「${primaryElem}」` : `原局缺调候首选「${primaryElem}」，须待岁运补足`;

  const stance = `调候${urgency}·${climateNature}（首选${primaryElem}）`;
  return {
    findings: [
      `节气${chart.climate.currentJieqi ?? '按月令当季论'}，月令${chart.strength.month.season}（月支${monthBranch}·${climateNature}；调候急缓：「${urgency}」，专属首选五行：${preferredElements.join('、')}，${presenceLabel}）`,
      `调候候选：${climateHits || '未命中显性调候条目'}`,
      `调候与扶抑权衡：${climateTradeoff ? `[${climateTradeoff.status}] ${climateTradeoff.summary}；优先级建议：${climateTradeoff.priorityAdvice}` : triad.priorityRule}`,
    ],
    structuredVerdict: {
      stance,
      primaryFocus: '月令寒暖燥湿急缓与调候首选五行得失',
      favorableSignals: [
        `调候首选五行：${preferredElements.join('、')}`,
        ...(hasPrimaryInChart ? [`原局已得${primaryElem}调候`] : []),
      ],
      riskSignals: [
        ...(urgency !== '从缓' ? [`${climateNature}（${climateRiskTag}）`] : []),
        ...(!hasPrimaryInChart ? [`原局缺调候主药${primaryElem}`] : []),
        ...(climateTradeoff?.status === '冲突' ? ['调候与扶抑存在冲突张力'] : []),
      ],
      score,
      keyConclusion: `月支${monthBranch}属${climateNature}（急缓=${urgency}），首选${primaryElem}，${presenceLabel}（调候分${score}/100）。`,
    },
  };
}

// ==================== 5. 子平扶抑派：独立扶抑算法 ====================

function evaluateZipingAlgorithm(
  chart: BaziChartForSchoolEval,
  triad: ReturnType<typeof buildTraditionalTriadSynthesis>,
): { findings: string[]; structuredVerdict: SchoolStructuredVerdict } {
  const isSpecial = chart.patternOverview.source !== '普通月令取格候选';
  const dayElement = getDayMasterElement(chart);
  const { support, drain } = getElementGroups(dayElement);
  const isStrong = ['身强', '偏强', '极强'].includes(chart.strength.status);
  const isWeak = ['身弱', '偏弱', '极弱'].includes(chart.strength.status);

  const favElems = chart.usefulGod.favorableWuxing.length
    ? chart.usefulGod.favorableWuxing
    : isStrong
      ? drain
      : isWeak
        ? support
        : [WUXING_GENERATE[dayElement], WUXING_CONTROL[dayElement]].filter(Boolean);
  const avoidElems = chart.usefulGod.unfavorableWuxing.length
    ? chart.usefulGod.unfavorableWuxing
    : isStrong
      ? support
      : isWeak
        ? drain
        : [];

  const chartElems = collectChartElements(chart);
  const hasFavInChart = favElems.some((e) => chartElems.has(e));
  const mediationPaths = chart.usefulGod.tradeoffAnalysis?.mediationPaths ?? [];
  const climateConflict = chart.usefulGod.tradeoffAnalysis?.climateVsBalance.status === '冲突';

  let score = chart.strength.status === '中和' ? 78 : isSpecial ? 74 : 62;
  if (hasFavInChart) score += 10;
  if (chart.strength.strongRoot && isWeak) score += 6;
  if (climateConflict) score -= 8;
  score -= Math.min(12, mediationPaths.length * 4);
  score = clampScore(score);

  const stance = isSpecial
    ? `特殊格顺势（${chart.patternOverview.pattern}·喜${favElems.join('、')}）`
    : isStrong
      ? `扶抑抑强·喜${favElems.join('、')}`
      : isWeak
        ? `扶抑扶弱·喜${favElems.join('、')}`
        : `中和动态平衡·顺${favElems.join('、')}`;

  const mediationNote = mediationPaths.length
    ? `病药通关：${mediationPaths.map((m) => `${m.conflictType}→${m.primaryRemedy}`).join('；')}`
    : '';

  return {
    findings: [
      `月支${chart.monthCommander.branch}司权${chart.monthCommander.stem}；日主旺衰模型为「${chart.strength.status}」`,
      `取格候选「${chart.ordinaryPattern.candidate}」（${chart.ordinaryPattern.source}）；用神主用「${chart.usefulGod.useful}」（喜${favElems.join('、') || '随运平衡'}）`,
      `扶抑·调候·格局三线权衡：${triad.priorityRule}（${triad.conflictSummary}）`,
      ...(mediationNote ? [mediationNote] : []),
    ],
    structuredVerdict: {
      stance,
      primaryFocus: '月令司权、日主根气与五行扶抑平衡',
      favorableSignals: [
        `扶抑喜用五行：${favElems.join('、')}`,
        ...(hasFavInChart ? ['原局已见喜用五行呼应'] : []),
        ...(chart.strength.hasRoot ? ['日主地支有根可承'] : []),
      ],
      riskSignals: [
        ...(avoidElems.length ? [`扶抑忌神五行：${avoidElems.join('、')}`] : []),
        ...(climateConflict ? ['与寒暖调候存在张力'] : []),
        ...mediationPaths.slice(0, 2).map((m) => `${m.conflictType}需${m.primaryRemedy}`),
      ],
      score,
      keyConclusion: `${stance}；忌${avoidElems.join('、') || '偏枯'}（扶抑平衡分${score}/100）。`,
    },
  };
}

// ==================== 传统三线权衡辅助 ====================

function buildTraditionalTriadSynthesis(chart: BaziChartForSchoolEval): {
  balanceView: string;
  climateView: string;
  patternView: string;
  priorityRule: string;
  conflictSummary: string;
} {
  const isSpecial = chart.patternOverview.source !== '普通月令取格候选';
  const tradeoff = chart.usefulGod.tradeoffAnalysis;

  const balanceView = isSpecial
    ? `特殊格（${chart.patternOverview.pattern}）按顺势取用（喜${chart.usefulGod.favorableWuxing.join('、') || '顺势流通'}）`
    : `日主「${chart.strength.status}」，扶抑方向喜${chart.usefulGod.favorableWuxing.join('、') || '随运平衡'}、忌${chart.usefulGod.unfavorableWuxing.join('、') || '随运避偏'}`;

  const satisfiedClimate = chart.climate.candidates.filter((c) => c.status === '满足' || c.mode === 'reference');
  const climateView = satisfiedClimate.length
    ? `节气${chart.climate.currentJieqi ?? '当令'}，调候关注${satisfiedClimate.slice(0, 2).map((c) => c.label).join('、')}`
    : `月令${chart.strength.month.season}未命中显性急迫调候条目`;

  const patternStatus = chart.patternEvidence?.decision?.status;
  const patternReason = chart.patternEvidence?.decision?.reason;
  const patternView = isSpecial
    ? `特殊成格路线「${chart.patternOverview.pattern}」（${chart.patternOverview.source}）`
    : `月令立格「${chart.ordinaryPattern.candidate}」${patternStatus ? `（当前条件：${patternStatus}${patternReason ? `，${patternReason}` : ''}）` : ''}`;

  let priorityRule: string;
  let conflictSummary: string;

  if (isSpecial) {
    priorityRule = '特殊格顺势优先于常规扶抑；调候仅在顺从大势前提下兼顾';
    conflictSummary = tradeoff?.followEdgeAssessment?.kind === '假从/从格边缘'
      ? `注意存在假从边缘特征（${tradeoff.followEdgeAssessment.summary}），岁运须辨真假切换`
      : '以维持特殊格纯粹气势为核心，忌逆势冲破';
  } else if (tradeoff?.climateVsBalance.status === '冲突') {
    priorityRule = `调候与扶抑存在张力：${tradeoff.climateVsBalance.priorityAdvice}`;
    conflictSummary = `${tradeoff.climateVsBalance.summary}${patternStatus === '破格' ? '；且格局见破格，须兼顾相神救应' : ''}`;
  } else if (patternStatus === '破格') {
    priorityRule = '格局救应优先于单纯五行扶抑（先去破格之病、护住月令格神，再以扶抑与调候润色）';
    conflictSummary = `月令格神有破损风险，不宜只按旺衰增减五行而忽略破格救应`;
  } else if (chart.strength.status === '中和') {
    priorityRule = '中和命局不强分五行喜忌，优先顺序为：调候寒暖 > 护持格局清纯 > 随岁运偏向动态扶抑';
    conflictSummary = tradeoff?.neutralGuidance?.tendencyNote ?? '原局气势平衡，重点观格局与岁运引动方向';
  } else if (tradeoff?.climateVsBalance.status === '一致') {
    priorityRule = '扶抑、调候与格局三线同向协同，用神清纯有力，可直接以主用神为核心展开岁运推演';
    conflictSummary = tradeoff.climateVsBalance.summary;
  } else {
    priorityRule = '无急迫调候冲突时，按「格局成败定层次 → 扶抑强弱定喜忌 → 病药通关解冲突」顺序综合权衡';
    conflictSummary = tradeoff?.mediationPaths.length
      ? `原局存在${tradeoff.mediationPaths.map((m) => m.conflictType).join('、')}，宜结合病药通关化解`
      : '三线未见明显背离，以扶抑用神与月令格神配合为主';
  }

  return { balanceView, climateView, patternView, priorityRule, conflictSummary };
}

// ==================== 6. 主入口：八字五流派算法核验 ====================

export function evaluateBaziSchoolAlgorithms(
  chart: BaziChartForSchoolEval,
  schools: readonly BaziSchoolId[] | undefined,
): SchoolAlgorithmEvaluation[] {
  const unique = [...new Set(schools ?? [])];
  const triad = buildTraditionalTriadSynthesis(chart);

  return unique.map((school) => {
    if (school === 'ziping') {
      const res = evaluateZipingAlgorithm(chart, triad);
      return {
        school,
        label: '子平派口径',
        ruleFocus: '以月令司权、透干根气、格局成败与扶抑调候综合权衡为本',
        findings: res.findings,
        structuredVerdict: res.structuredVerdict,
      };
    }
    if (school === 'mangpai') {
      const res = evaluateMangpaiWorkPaths(chart);
      return {
        school,
        label: '盲派做功口径',
        ruleFocus: '分宾主宫位、定体用十神、察制用/化用/合用/穿制与墓库开合之做功效率',
        findings: res.findings,
        structuredVerdict: res.structuredVerdict,
      };
    }
    if (school === 'xinpai') {
      const res = evaluateXinpaiFacts(chart);
      return {
        school,
        label: '新派口径',
        ruleFocus: '重紧贴三字喜忌、月令及年日空亡对旺衰影响、天干虚实与百神反断',
        findings: res.findings,
        structuredVerdict: res.structuredVerdict,
      };
    }
    if (school === 'tiaohou') {
      const res = evaluateTiaohouAlgorithm(chart, triad);
      return {
        school,
        label: '《穷通》调候派口径',
        ruleFocus: '以节气寒暖燥湿为第一要义，权衡调候与扶抑/格局之轻重缓急',
        findings: res.findings,
        structuredVerdict: res.structuredVerdict,
      };
    }
    const res = evaluateGejuAlgorithm(chart, triad);
    return {
      school,
      label: '《子平真诠》格局派口径',
      ruleFocus: '专重月令立格、相神辅格与顺用逆用破格救应，兼衡扶抑调候',
      findings: res.findings,
      structuredVerdict: res.structuredVerdict,
    };
  });
}

// ==================== 7. 跨流派共识与分歧研判 ====================

export interface SchoolDivergenceItem {
  topic: string;
  schools: string[];
  details: string;
  rootCause: string;
}

export interface SchoolConsensusSummary {
  consensus: string[];
  divergences: SchoolDivergenceItem[];
  formattedText: string;
}

function extractElementsFromText(text: string): string[] {
  const matched = text.match(/[木火土金水]/g);
  return matched ? [...new Set(matched)] : [];
}

export function buildSchoolConsensusSummary(
  evaluations: readonly SchoolAlgorithmEvaluation[],
): SchoolConsensusSummary {
  const withVerdict = evaluations.filter((e): e is SchoolAlgorithmEvaluation & { structuredVerdict: SchoolStructuredVerdict } =>
    Boolean(e.structuredVerdict),
  );
  if (withVerdict.length < 2) {
    return { consensus: [], divergences: [], formattedText: '' };
  }

  const bySchool = new Map(withVerdict.map((e) => [e.school, e]));
  const ziping = bySchool.get('ziping');
  const geju = bySchool.get('geju');
  const tiaohou = bySchool.get('tiaohou');
  const mangpai = bySchool.get('mangpai');
  const xinpai = bySchool.get('xinpai');

  const consensus: string[] = [];
  const divergences: SchoolDivergenceItem[] = [];

  const zipingFav = ziping ? extractElementsFromText(ziping.structuredVerdict.favorableSignals.find((s) => s.includes('喜用五行')) ?? ziping.structuredVerdict.stance) : [];
  const zipingAvoid = ziping ? extractElementsFromText(ziping.structuredVerdict.riskSignals.find((s) => s.includes('忌神五行')) ?? '') : [];
  const xinpaiFav = xinpai ? extractElementsFromText(xinpai.structuredVerdict.favorableSignals.find((s) => s.includes('喜用五行')) ?? xinpai.structuredVerdict.stance) : [];
  const tiaohouPref = tiaohou ? extractElementsFromText(tiaohou.structuredVerdict.favorableSignals.find((s) => s.includes('调候首选')) ?? tiaohou.structuredVerdict.stance) : [];

  // 1. 子平扶抑 vs 新派（旺衰与月令空亡反断）
  if (ziping && xinpai) {
    const zipingWeak = ziping.structuredVerdict.stance.includes('扶弱');
    const zipingStrong = ziping.structuredVerdict.stance.includes('抑强');
    const xinpaiWeak = xinpai.structuredVerdict.stance.includes('身弱');
    const xinpaiStrong = xinpai.structuredVerdict.stance.includes('身旺');
    const monthVoidChanged = xinpai.structuredVerdict.stance.includes('月空改看年支');

    if ((zipingStrong && xinpaiWeak) || (zipingWeak && xinpaiStrong)) {
      divergences.push({
        topic: '旺衰与喜用五行立场相反',
        schools: ['子平派', '新派'],
        details: `子平扶抑判「${ziping.structuredVerdict.stance}」，而新派判「${xinpai.structuredVerdict.stance}」`,
        rootCause: monthVoidChanged
          ? '月令空亡反断机制差异：子平仍以月令司权定旺衰，新派因月支落日空改以年支重算旺衰'
          : '旺衰权重算法差异：子平重全局月令根气，新派重紧贴三字与虚实空亡',
      });
    } else if (zipingFav.some((e) => xinpaiFav.includes(e))) {
      consensus.push(
        `子平与新派喜用方向一致（均偏向${zipingFav.filter((e) => xinpaiFav.includes(e)).join('、')}）`,
      );
    }
  }

  // 2. 子平扶抑 vs 《穷通》调候
  if (ziping && tiaohou) {
    const primaryClimate = tiaohouPref[0];
    const climateUrgent = tiaohou.structuredVerdict.stance.includes('极急');
    if (primaryClimate && zipingAvoid.includes(primaryClimate)) {
      divergences.push({
        topic: '调候主药与扶抑喜忌冲突',
        schools: ['子平派', '《穷通》调候派'],
        details: `子平扶抑忌「${primaryClimate}」（${ziping.structuredVerdict.stance}），而调候派因${tiaohou.structuredVerdict.stance}将「${primaryClimate}」列为首选`,
        rootCause: climateUrgent
          ? '冬夏极寒极燥下《穷通》以暖局/润燥为第一要义，优先于常规五行扶抑'
          : '寒暖湿燥调候取向与日主强弱扶抑取向的先后权重不同',
      });
    } else if (primaryClimate && zipingFav.includes(primaryClimate)) {
      consensus.push(`扶抑与调候同向协同：均喜用「${primaryClimate}」，用神清纯度高`);
    }
  }

  // 3. 子平扶抑 vs 《子平真诠》格局
  if (ziping && geju) {
    const gejuBroken = geju.structuredVerdict.stance.includes('破格待救');
    const gejuPure = geju.structuredVerdict.stance.includes('上格清纯');
    const gejuGrade = geju.structuredVerdict.stance;
    if (gejuBroken && (ziping.structuredVerdict.score ?? 50) >= 65) {
      divergences.push({
        topic: '扶抑平衡与格局破损评价分化',
        schools: ['子平派', '《子平真诠》格局派'],
        details: `子平扶抑平衡分较高（${ziping.structuredVerdict.score}/100），但格局派检出「${gejuGrade}」（${geju.structuredVerdict.riskSignals.join('、') || '格神受损'}）`,
        rootCause: '格局派以护持月令格神与相神为先，不因五行强弱平衡而忽略破格之病',
      });
    } else if (gejuPure) {
      consensus.push(`子平扶抑与格局派共振：${gejuGrade}，格局根基稳健`);
    } else {
      divergences.push({
        topic: '取用焦点差异（扶抑强弱 vs 护格相神）',
        schools: ['子平派', '《子平真诠》格局派'],
        details: `子平重「${ziping.structuredVerdict.stance}」，格局派重「${gejuGrade}」（${geju.structuredVerdict.favorableSignals[0] ?? '相神护格'}）`,
        rootCause: '子平从日主旺衰平衡切入，格局派从月令十神顺逆用与相神救应切入',
      });
    }
  }

  // 4. 盲派 vs 传统派（扶抑/格局）
  if (mangpai && (ziping || geju)) {
    const mScore = mangpai.structuredVerdict.score ?? 50;
    const tradRef = geju ?? ziping!;
    const tScore = tradRef.structuredVerdict.score ?? 50;
    const axis = mangpai.structuredVerdict.stance;
    if (mScore >= 68 && tScore >= 68) {
      consensus.push(`盲派做功（${mScore}/100，${axis}）与${tradRef.label.replace('口径', '')}（${tScore}/100）形成正向共振`);
    } else if (Math.abs(mScore - tScore) >= 18 || axis.includes('宾反制主') || axis.includes('开财官库')) {
      divergences.push({
        topic: '做功效率视角与传统旺衰/格局视角分化',
        schools: ['盲派', tradRef.label.replace('口径', '')],
        details: `盲派依「${axis}」评${mScore}/100，${tradRef.label.replace('口径', '')}依「${tradRef.structuredVerdict.stance}」评${tScore}/100`,
        rootCause: '盲派以宾主宫位与制化合穿开库做功论成败，不拘传统日主身强身弱与常规扶抑喜忌',
      });
    }
  }

  // 通用兜底（确保非八字或多流派任意子集也有清晰汇总）
  if (!consensus.length && !divergences.length) {
    const scores = withVerdict.map((e) => e.structuredVerdict.score).filter((s): s is number => typeof s === 'number');
    const spread = scores.length >= 2 ? Math.max(...scores) - Math.min(...scores) : 0;
    if (spread >= 15) {
      divergences.push({
        topic: '各流派量化评估存在明显分化',
        schools: withVerdict.map((e) => e.label.replace('口径', '')),
        details: withVerdict.map((e) => `${e.label.replace('口径', '')}(${e.structuredVerdict.score ?? '-'}分·${e.structuredVerdict.stance})`).join(' vs '),
        rootCause: '不同流派核心算法权重与取象口径侧重不同',
      });
    } else {
      consensus.push(
        `所选${withVerdict.length}个流派整体评估趋势相近（${withVerdict.map((e) => `${e.label.replace('口径', '')}${e.structuredVerdict.score ?? '-'}分`).join('／')}）`,
      );
    }
  }

  const lines: string[] = ['【跨流派共识与分歧研判】'];
  if (consensus.length) {
    lines.push(`共识项：${consensus.join('；')}。`);
  }
  if (divergences.length) {
    lines.push(
      `分歧项与根因：\n${divergences.map((d, idx) => `${idx + 1}. [${d.topic}]（${d.schools.join(' vs ')}）：${d.details}｜分歧根因：${d.rootCause}`).join('\n')}`,
    );
  }

  return {
    consensus,
    divergences,
    formattedText: lines.join('\n'),
  };
}
