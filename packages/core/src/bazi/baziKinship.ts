import type { BaziChartResult } from './baziTypes';

type PillarKey = 'year' | 'month' | 'day' | 'hour';

export type BaziKinshipFactStatus =
  '已记录' | '未见对应十神' | '需另按女命口径复核' | '需另按性别口径复核';

export type BaziKinshipInput = Pick<
  BaziChartResult,
  'gender' | 'pillars' | 'tenGods' | 'hiddenStems' | 'hiddenTenGods'
>;

export interface BaziKinshipFact {
  key: string;
  kind: '宫位' | '十神';
  subject: '祖辈' | '父母' | '配偶' | '子息' | '母亲' | '父亲' | '兄弟';
  status: BaziKinshipFactStatus;
  locations: string[];
  promptText: string;
  sources: string[];
  limitation: typeof KINSHIP_FACT_LIMITATION;
}

const PILLAR_KEYS: PillarKey[] = ['year', 'month', 'day', 'hour'];
const PILLAR_LABELS: Record<PillarKey, '年柱' | '月柱' | '日柱' | '时柱'> = {
  year: '年柱',
  month: '月柱',
  day: '日柱',
  hour: '时柱',
};

export const KINSHIP_FACT_LIMITATION =
  '六亲宫位与十神只提供传统取象位置；必须结合月令格局、喜忌、宫星配合及刑冲会合复核，不得由单柱、单一十神或缺位直接断定亲属有无、吉凶、健康、数量、关系或现实事件' as const;

function collectTenGodLocations(
  data: BaziKinshipInput,
  targetTenGods: Set<string>,
  visiblePillarKeys: PillarKey[] = PILLAR_KEYS,
) {
  const visible: string[] = [];
  const hidden: string[] = [];

  PILLAR_KEYS.forEach((key) => {
    const visibleTenGod = data.tenGods[key];
    if (visiblePillarKeys.includes(key) && targetTenGods.has(visibleTenGod)) {
      visible.push(`${PILLAR_LABELS[key]}天干${data.pillars[key].gan}（${visibleTenGod}）`);
    }

    (data.hiddenTenGods[key] ?? []).forEach((tenGod, index) => {
      if (!targetTenGods.has(tenGod)) return;
      const stem = data.hiddenStems[key]?.[index] ?? '未记录藏干';
      hidden.push(`${PILLAR_LABELS[key]}藏干${stem}（${tenGod}）`);
    });
  });

  return { visible, hidden, all: [...visible, ...hidden] };
}

function createTenGodFact(args: {
  data: BaziKinshipInput;
  key: string;
  subject: BaziKinshipFact['subject'];
  label: string;
  tenGods: string[];
  visibleOnly?: boolean;
  visiblePillarKeys?: PillarKey[];
}): BaziKinshipFact {
  const locations = collectTenGodLocations(
    args.data,
    new Set(args.tenGods),
    args.visiblePillarKeys,
  );
  const selectedLocations = args.visibleOnly ? locations.visible : locations.all;
  const status = selectedLocations.length ? '已记录' : '未见对应十神';
  const locationText = selectedLocations.length
    ? selectedLocations.join('、')
    : `${args.visibleOnly ? '年、月、时干' : '四柱明透与藏干'}未见${args.tenGods.join('、')}`;

  return {
    key: args.key,
    kind: '十神',
    subject: args.subject,
    status,
    locations: selectedLocations,
    promptText: `${args.label}：${locationText}；${status === '未见对应十神' ? '十神缺位不等于现实中没有该亲属' : '只记录星位，不单独判断六亲结果'}`,
    sources: ['《子平真诠评注》“论宫分用神配六亲”与当前四柱十神、藏干十神'],
    limitation: KINSHIP_FACT_LIMITATION,
  };
}

export function analyzeBaziKinship(data: BaziKinshipInput): BaziKinshipFact[] {
  const palaceFacts: BaziKinshipFact[] = [
    {
      key: 'bazi:kinship:palace:ancestor',
      kind: '宫位',
      subject: '祖辈',
      status: '已记录',
      locations: [`年柱${data.pillars.year.ganZhi}`],
      promptText: `年柱祖辈宫：${data.pillars.year.ganZhi}`,
      sources: ['《子平真诠评注》“年月日时，自上而下，祖父妻子”'],
      limitation: KINSHIP_FACT_LIMITATION,
    },
    {
      key: 'bazi:kinship:palace:parents',
      kind: '宫位',
      subject: '父母',
      status: '已记录',
      locations: [`月柱${data.pillars.month.ganZhi}`],
      promptText: `月柱父母宫：${data.pillars.month.ganZhi}`,
      sources: ['《子平真诠评注》“年月日时，自上而下，祖父妻子”'],
      limitation: KINSHIP_FACT_LIMITATION,
    },
    {
      key: 'bazi:kinship:palace:spouse',
      kind: '宫位',
      subject: '配偶',
      status: '已记录',
      locations: [`日支${data.pillars.day.zhi}`],
      promptText: `日支妻宫（原典男命表述，通称配偶宫）：${data.pillars.day.zhi}`,
      sources: ['《子平真诠评注》“妻以配身”及“坐下”论妻宫'],
      limitation: KINSHIP_FACT_LIMITATION,
    },
    {
      key: 'bazi:kinship:palace:children',
      kind: '宫位',
      subject: '子息',
      status: '已记录',
      locations: [`时支${data.pillars.hour.zhi}`],
      promptText: `时支子息宫：${data.pillars.hour.zhi}`,
      sources: ['《子平真诠评注》“先看时支”论子息'],
      limitation: KINSHIP_FACT_LIMITATION,
    },
  ];

  const tenGodFacts = [
    createTenGodFact({
      data,
      key: 'bazi:kinship:ten-god:mother',
      subject: '母亲',
      label: '正印母亲星',
      tenGods: ['正印'],
    }),
    createTenGodFact({
      data,
      key: 'bazi:kinship:ten-god:father',
      subject: '父亲',
      label: '偏财父亲星',
      tenGods: ['偏财'],
    }),
    createTenGodFact({
      data,
      key: 'bazi:kinship:ten-god:brother',
      subject: '兄弟',
      label: '比肩兄弟星',
      tenGods: ['比肩'],
    }),
    createTenGodFact({
      data,
      key: 'bazi:kinship:ten-god:children',
      subject: '子息',
      label: '官杀子女星',
      tenGods: ['正官', '七杀'],
    }),
  ];

  let wifeFact: BaziKinshipFact;
  if (data.gender === 'male') {
    wifeFact = createTenGodFact({
      data,
      key: 'bazi:kinship:ten-god:wife',
      subject: '配偶',
      label: '男命干头财星（妻星）',
      tenGods: ['正财', '偏财'],
      visibleOnly: true,
      visiblePillarKeys: ['year', 'month', 'hour'],
    });
  } else if (data.gender === 'female') {
    wifeFact = {
      key: 'bazi:kinship:ten-god:wife',
      kind: '十神',
      subject: '配偶',
      status: '需另按女命口径复核',
      locations: [],
      promptText:
        '原典本段以男命“正财为妻、干头之财为妻星”立论；当前为坤造，不把财星直接改写成丈夫星，须另按女命配偶取象口径复核',
      sources: ['《子平真诠评注》“正财为妻”与“妻星者，干头之财也”'],
      limitation: KINSHIP_FACT_LIMITATION,
    };
  } else {
    wifeFact = {
      key: 'bazi:kinship:ten-god:wife',
      kind: '十神',
      subject: '配偶',
      status: '需另按性别口径复核',
      locations: [],
      promptText:
        '原典本段以男命“正财为妻、干头之财为妻星”立论；当前性别未记录，不套用男命妻星或女命配偶取象，须先确认性别口径',
      sources: ['《子平真诠评注》“正财为妻”与“妻星者，干头之财也”'],
      limitation: KINSHIP_FACT_LIMITATION,
    };
  }

  return [...palaceFacts, ...tenGodFacts, wifeFact];
}
