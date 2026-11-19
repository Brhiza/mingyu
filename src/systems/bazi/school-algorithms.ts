import type { PillarName } from './pillars';
import type { baziSchoolIds } from './prompt-options';
import type { SchoolAlgorithmEvaluation } from '../school-algorithms';

type BaziSchoolId = (typeof baziSchoolIds)[number];

const pillarLabels: Record<PillarName, string> = { year: '年', month: '月', day: '日', hour: '时' };
const hostPositions = new Set<PillarName>(['day', 'hour']);
const guestPositions = new Set<PillarName>(['year', 'month']);
const bodyTenGods = new Set(['日主', '比肩', '劫财', '正印', '偏印', '食神', '伤官']);
const targetTenGods = new Set(['正财', '偏财', '正官', '七杀']);
const tombBranches = new Set(['辰', '戌', '丑', '未']);

interface BaziChartForSchoolEval {
  pillars: Record<
    PillarName,
    {
      ganZhi: string;
      gan: string;
      zhi: string;
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
  strength: { status: string; month: { season: string; commanderStem: string; commanderEffect: string } };
  ordinaryPattern: { candidate: string; source: string; selectedStem: string };
  patternOverview: { pattern: string; source: string };
  climate: { currentJieqi?: string | null; candidates: Array<{ label: string; status: string; mode: string }> };
  usefulGod: { useful: string; favorableWuxing: string[]; unfavorableWuxing: string[]; incrementStatus: string };
}

function evaluateMangpaiWorkPaths(chart: BaziChartForSchoolEval): string[] {
  const hostItems: string[] = [];
  const guestItems: string[] = [];
  const tiList: string[] = [];
  const yongList: string[] = [];

  for (const pos of ['year', 'month', 'day', 'hour'] as const) {
    const p = chart.pillars[pos];
    const mainGod = p.hiddenStems[0]?.tenGod ?? '';
    const desc = `${pillarLabels[pos]}柱${p.ganZhi}(${p.tenGod}${mainGod ? `/支${mainGod}` : ''})`;
    if (hostPositions.has(pos)) hostItems.push(desc);
    else guestItems.push(desc);

    if (pos !== 'day' && bodyTenGods.has(p.tenGod)) tiList.push(`${pillarLabels[pos]}干${p.tenGod}`);
    if (pos !== 'day' && targetTenGods.has(p.tenGod)) yongList.push(`${pillarLabels[pos]}干${p.tenGod}`);
    if (bodyTenGods.has(mainGod)) tiList.push(`${pillarLabels[pos]}支${mainGod}`);
    if (targetTenGods.has(mainGod)) yongList.push(`${pillarLabels[pos]}支${mainGod}`);
  }

  const workRelations: string[] = [];
  for (const rel of chart.natalFacts.relations) {
    if (!['六合', '六冲', '六害', '相刑', '天干五合', '生地半合', '墓地半合', '三合局', '三会局'].includes(rel.name)) {
      continue;
    }
    const hasHost = rel.positions.some((p) => hostPositions.has(p));
    const hasGuest = rel.positions.some((p) => guestPositions.has(p));
    const scopeTag = hasHost && hasGuest ? '主宾联动' : hasHost ? '主位内做功' : '宾位互作用';
    const tombTag = rel.name === '六冲' && rel.values.some((v) => tombBranches.has(v)) ? '·冲开墓库' : '';
    const posText = rel.positions.map((p) => pillarLabels[p]).join('');
    workRelations.push(`${posText}${rel.values.join('')}${rel.name}(${scopeTag}${tombTag})`);
  }

  return [
    `宾位[年月]：${guestItems.join('、')}；主位[日时]：${hostItems.join('、')}`,
    `体用归属：体（日主/印/比/食伤）=${tiList.slice(0, 6).join('、') || '无显'}；用（财/官杀）=${yongList.slice(0, 6).join('、') || '无显'}`,
    `做功路径候选：${workRelations.slice(0, 8).join('；') || '未见典型合冲穿刑做功，宜察生克流通'}`,
  ];
}

function evaluateXinpaiFacts(chart: BaziChartForSchoolEval): string[] {
  const dayVoids = new Set(chart.pillars.day.voidBranches);
  const yearVoids = new Set(chart.pillars.year.voidBranches);
  const voidHits: string[] = [];
  for (const pos of ['year', 'month', 'day', 'hour'] as const) {
    const zhi = chart.pillars[pos].zhi;
    if (dayVoids.has(zhi)) voidHits.push(`${pillarLabels[pos]}支${zhi}(日空)`);
    else if (yearVoids.has(zhi)) voidHits.push(`${pillarLabels[pos]}支${zhi}(年空)`);
  }
  const floatingStems = chart.natalFacts.roots
    .filter((r) => r.status.includes('无根') || r.status.includes('虚浮'))
    .map((r) => `${pillarLabels[r.position]}干${r.stem}(${r.status})`);

  return [
    `紧贴作用链：月干${chart.pillars.month.gan}(${chart.pillars.month.tenGod})、日支${chart.pillars.day.zhi}(${chart.pillars.day.hiddenStems[0]?.tenGod ?? ''})、时干${chart.pillars.hour.gan}(${chart.pillars.hour.tenGod})直接紧贴日主`,
    `旬空落支：${voidHits.join('、') || '四柱地支未落入日/年旬空'}（新派重月支空亡及虚实反断）`,
    `天干虚实（百神论参考）：${floatingStems.join('、') || '所透天干均见同气藏干'}`,
  ];
}

export function evaluateBaziSchoolAlgorithms(
  chart: BaziChartForSchoolEval,
  schools: readonly BaziSchoolId[] | undefined,
): SchoolAlgorithmEvaluation[] {
  const unique = [...new Set(schools ?? [])];
  return unique.map((school) => {
    if (school === 'ziping') {
      return {
        school,
        label: '子平派口径',
        ruleFocus: '以月令司权、透干根气、格局成败与扶抑用神为本',
        findings: [
          `月支${chart.monthCommander.branch}司权${chart.monthCommander.stem}；日主旺衰模型为「${chart.strength.status}」`,
          `取格候选「${chart.ordinaryPattern.candidate}」（${chart.ordinaryPattern.source}）；用神主用「${chart.usefulGod.useful}」（喜${chart.usefulGod.favorableWuxing.join('、') || '待判'}）`,
        ],
      };
    }
    if (school === 'mangpai') {
      return {
        school,
        label: '盲派做功口径',
        ruleFocus: '分宾主宫位、定体用十神、察合冲穿破墓库之做功效率',
        findings: evaluateMangpaiWorkPaths(chart),
      };
    }
    if (school === 'xinpai') {
      return {
        school,
        label: '新派口径',
        ruleFocus: '重紧贴生克、月令空亡反断、天干虚实与百神论',
        findings: evaluateXinpaiFacts(chart),
      };
    }
    if (school === 'tiaohou') {
      const climateHits = chart.climate.candidates
        .slice(0, 4)
        .map((c) => `${c.label}(${c.status})`)
        .join('、');
      return {
        school,
        label: '《穷通》调候派口径',
        ruleFocus: '以节气寒暖燥湿为第一要义，先定调候再议格局扶抑',
        findings: [
          `节气${chart.climate.currentJieqi ?? '待核'}，月令${chart.strength.month.season}`,
          `调候候选：${climateHits || '未命中显性调候条目'}`,
        ],
      };
    }
    return {
      school,
      label: '《子平真诠》格局派口径',
      ruleFocus: '专重月令立格、相神辅格与顺用逆用破格救应',
      findings: [
        `月令取格：${chart.ordinaryPattern.candidate}（${chart.ordinaryPattern.source}·${chart.ordinaryPattern.selectedStem}）`,
        `路线总序：${chart.patternOverview.pattern}（${chart.patternOverview.source}）`,
      ],
    };
  });
}
