import {
  LIUCHONG_MAP,
  LIUHAI_MAP,
  LIUHE_MAP,
  LIUPO_MAP,
  SANHE_GROUPS,
  SANHUI_GROUPS,
  TIAN_GAN_CHONG,
  TIAN_GAN_HE,
  isKe,
  isSanxing,
  isSheng,
} from '../ganzhi/relations';
import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import type { BaziChartResult, Pillar, Wuxing } from './baziTypes';
import { assertPillars, getTenGod, getTenGodForBranch, getWuxing } from './baziUtils';

const PILLAR_KEYS = ['year', 'month', 'day', 'hour'] as const;
const PILLAR_LABELS: Record<PillarKey, string> = {
  year: '年柱',
  month: '月柱',
  day: '日柱',
  hour: '时柱',
};

type PillarKey = (typeof PILLAR_KEYS)[number];
type ElementRelation = '同类' | '生对方' | '受对方生' | '克对方' | '受对方克';
type StemRelationType = '五合候选' | '天干冲';
type BranchRelationType = '同支' | '六合' | '六冲' | '三刑' | '六害' | '六破';

export interface BaziCompatibilityOptions {
  person1Name?: string;
  person2Name?: string;
}

export interface BaziDayMasterRelation {
  person1Gan: string;
  person1Wuxing: Wuxing;
  person2Gan: string;
  person2Wuxing: Wuxing;
  person1ToPerson2: ElementRelation;
  person2ToPerson1: ElementRelation;
  person2GanAsPerson1TenGod: string;
  person1GanAsPerson2TenGod: string;
}

export interface BaziCrossPillarRelation {
  layer: '天干' | '地支';
  type: StemRelationType | BranchRelationType;
  person1Pillar: PillarKey;
  person2Pillar: PillarKey;
  person1Value: string;
  person2Value: string;
  transformWuxing?: string;
  note?: string;
}

export interface BaziCrossBranchCombination {
  type: '三合' | '三会';
  name: string;
  members: Array<{
    branch: string;
    sources: Array<{ person: 'person1' | 'person2'; pillar: PillarKey }>;
  }>;
  note: string;
}

export interface BaziTenGodMapping {
  observer: 'person1' | 'person2';
  source: 'person1' | 'person2';
  pillar: PillarKey;
  stem: string;
  stemTenGod: string;
  branch: string;
  branchMainQiTenGod: string;
}

export interface BaziUsefulGodCoverage {
  beneficiary: 'person1' | 'person2';
  provider: 'person1' | 'person2';
  favorable: Array<{ wuxing: string }>;
  unfavorable: Array<{ wuxing: string }>;
  unavailableReason?: string;
}

export interface BaziCompatibilityEvidenceResult {
  people: { person1: string; person2: string };
  dayMasterRelation: BaziDayMasterRelation;
  spousePalaceRelations: BaziCrossPillarRelation[];
  crossPillarRelations: BaziCrossPillarRelation[];
  crossBranchCombinations: BaziCrossBranchCombination[];
  tenGodMappings: BaziTenGodMapping[];
  usefulGodCoverage: BaziUsefulGodCoverage[];
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: { notes: string[] };
}

function asWuxing(value: string): Wuxing {
  const result = getWuxing(value);
  if (result === '未知') throw new Error(`无法识别五行：${value}`);
  return result;
}

function getElementRelation(source: Wuxing, target: Wuxing): ElementRelation {
  if (source === target) return '同类';
  if (isSheng(source, target)) return '生对方';
  if (isSheng(target, source)) return '受对方生';
  if (isKe(source, target)) return '克对方';
  return '受对方克';
}

function collectStemRelations(left: Pillar, right: Pillar): BaziCrossPillarRelation[] {
  const result: BaziCrossPillarRelation[] = [];
  if (TIAN_GAN_HE[left.gan]?.partner === right.gan) {
    result.push({
      layer: '天干',
      type: '五合候选',
      person1Pillar: 'year',
      person2Pillar: 'year',
      person1Value: left.gan,
      person2Value: right.gan,
      transformWuxing: TIAN_GAN_HE[left.gan].wuxing,
      note: '只确认天干五合关系；是否合化需另看月令、透干、根气和制化条件。',
    });
  }
  if (TIAN_GAN_CHONG[left.gan] === right.gan) {
    result.push({
      layer: '天干',
      type: '天干冲',
      person1Pillar: 'year',
      person2Pillar: 'year',
      person1Value: left.gan,
      person2Value: right.gan,
    });
  }
  return result;
}

function collectBranchRelations(left: Pillar, right: Pillar): BaziCrossPillarRelation[] {
  const relations: BranchRelationType[] = [];
  if (left.zhi === right.zhi) relations.push('同支');
  if (LIUHE_MAP[left.zhi] === right.zhi) relations.push('六合');
  if (LIUCHONG_MAP[left.zhi] === right.zhi) relations.push('六冲');
  if (isSanxing(left.zhi, right.zhi)) relations.push('三刑');
  if (LIUHAI_MAP[left.zhi] === right.zhi) relations.push('六害');
  if (LIUPO_MAP[left.zhi] === right.zhi) relations.push('六破');
  return relations.map((type) => ({
    layer: '地支',
    type,
    person1Pillar: 'year',
    person2Pillar: 'year',
    person1Value: left.zhi,
    person2Value: right.zhi,
  }));
}

function calculateCrossRelations(chart1: BaziChartResult, chart2: BaziChartResult) {
  const result: BaziCrossPillarRelation[] = [];
  for (const person1Pillar of PILLAR_KEYS) {
    for (const person2Pillar of PILLAR_KEYS) {
      const left = chart1.pillars[person1Pillar];
      const right = chart2.pillars[person2Pillar];
      const relations = [
        ...collectStemRelations(left, right),
        ...collectBranchRelations(left, right),
      ];
      for (const relation of relations) {
        result.push({ ...relation, person1Pillar, person2Pillar });
      }
    }
  }
  return result;
}

function calculateCombinations(chart1: BaziChartResult, chart2: BaziChartResult) {
  const sources = new Map<string, Array<{ person: 'person1' | 'person2'; pillar: PillarKey }>>();
  for (const [person, chart] of [
    ['person1', chart1],
    ['person2', chart2],
  ] as const) {
    for (const pillar of PILLAR_KEYS) {
      const branch = chart.pillars[pillar].zhi;
      sources.set(branch, [...(sources.get(branch) ?? []), { person, pillar }]);
    }
  }
  const combinations: BaziCrossBranchCombination[] = [];
  for (const [type, groups] of [
    ['三合', SANHE_GROUPS],
    ['三会', SANHUI_GROUPS],
  ] as const) {
    for (const [name, branches] of Object.entries(groups)) {
      if (!branches.every((branch) => sources.has(branch))) continue;
      const members = branches.map((branch) => ({ branch, sources: sources.get(branch) ?? [] }));
      const people = new Set(
        members.flatMap((member) => member.sources.map((source) => source.person)),
      );
      if (people.size < 2) continue;
      combinations.push({
        type,
        name,
        members,
        note: `两盘地支共同构成${type}组合；只记录组合齐备，不直接判定成局或成化。`,
      });
    }
  }
  return combinations;
}

function calculateTenGodMappings(
  observer: 'person1' | 'person2',
  source: 'person1' | 'person2',
  observerChart: BaziChartResult,
  sourceChart: BaziChartResult,
) {
  return PILLAR_KEYS.map((pillar): BaziTenGodMapping => {
    const value = sourceChart.pillars[pillar];
    return {
      observer,
      source,
      pillar,
      stem: value.gan,
      stemTenGod: getTenGod(value.gan, observerChart.dayMaster.gan),
      branch: value.zhi,
      branchMainQiTenGod: getTenGodForBranch(value.zhi, observerChart.dayMaster.gan),
    };
  });
}

function calculateUsefulGodCoverage(
  beneficiary: 'person1' | 'person2',
  provider: 'person1' | 'person2',
  beneficiaryChart: BaziChartResult,
  providerChart: BaziChartResult,
): BaziUsefulGodCoverage {
  const favorable = beneficiaryChart.analysis?.usefulGod?.favorableWuxing;
  const unfavorable = beneficiaryChart.analysis?.usefulGod?.unfavorableWuxing;
  if (!favorable?.length && !unfavorable?.length) {
    return {
      beneficiary,
      provider,
      favorable: [],
      unfavorable: [],
      unavailableReason: '命盘未提供结构化喜忌五行。',
    };
  }
  const present = new Set(providerChart.wuxingStrength?.present ?? []);
  const match = (elements: string[] | undefined) =>
    [...new Set(elements ?? [])]
      .filter((wuxing) => present.has(wuxing))
      .map((wuxing) => ({ wuxing }));
  return { beneficiary, provider, favorable: match(favorable), unfavorable: match(unfavorable) };
}

function sourceLabel(person: string, pillar: PillarKey) {
  return `${person}${PILLAR_LABELS[pillar]}`;
}

function createEvidence(
  people: BaziCompatibilityEvidenceResult['people'],
  dayMaster: BaziDayMasterRelation,
  relations: BaziCrossPillarRelation[],
  combinations: BaziCrossBranchCombination[],
  coverage: BaziUsefulGodCoverage[],
): PromptEvidenceBundle {
  const dayBranchRelations = relations.filter(
    (item) => item.layer === '地支' && item.person1Pillar === 'day' && item.person2Pillar === 'day',
  );
  const items: PromptEvidenceItem[] = [
    {
      level: '主证',
      title: `双方日主为${dayMaster.person1Gan}${dayMaster.person1Wuxing}与${dayMaster.person2Gan}${dayMaster.person2Wuxing}`,
      detail: `${people.person1}对${people.person2}为“${dayMaster.person1ToPerson2}”，${people.person2}对${people.person1}为“${dayMaster.person2ToPerson1}”；对方日干分别映射为${dayMaster.person2GanAsPerson1TenGod}与${dayMaster.person1GanAsPerson2TenGod}。这是五行和十神关系事实，不单独决定关系结果。`,
      source: '双方日干五行生克与双向十神计算',
      weight: 90,
      tags: ['八字合盘', '日主关系', '双向十神'],
    },
    ...dayBranchRelations.map((relation): PromptEvidenceItem => ({
      level: '主证',
      title: `双方日支${relation.person1Value}${relation.type}${relation.person2Value}`,
      detail:
        '日支关系可作为双方互动结构的重要盘面证据，但不能脱离全局强弱、喜忌和现实关系直接断吉凶。',
      source: '双方日柱地支关系计算',
      weight: 88,
      tags: ['八字合盘', '日支', '夫妻宫', relation.type],
    })),
    ...relations
      .filter((item) => !dayBranchRelations.includes(item))
      .slice(0, 24)
      .map((relation): PromptEvidenceItem => ({
        level:
          relation.person1Pillar === 'day' || relation.person2Pillar === 'day' ? '主证' : '辅证',
        title: `${sourceLabel(people.person1, relation.person1Pillar)}${relation.person1Value}与${sourceLabel(people.person2, relation.person2Pillar)}${relation.person2Value}构成${relation.type}`,
        detail: relation.note ?? '该条只记录跨盘干支关系，需结合柱位、命局强弱、喜忌和岁运解释。',
        source: '双方四柱逐项交叉计算',
        weight: relation.person1Pillar === 'day' || relation.person2Pillar === 'day' ? 72 : 48,
        tags: ['八字合盘', '跨盘关系', relation.layer, relation.type],
      })),
    ...combinations.map((combination): PromptEvidenceItem => ({
      level: '辅证',
      title: `两盘共同构成${combination.name}${combination.type}`,
      detail: `${combination.members.map((member) => `${member.branch}来自${member.sources.map((source) => sourceLabel(source.person === 'person1' ? people.person1 : people.person2, source.pillar)).join('、')}`).join('；')}。${combination.note}`,
      source: '双方八个地支联合枚举',
      weight: 55,
      tags: ['八字合盘', combination.type, '组合候选'],
    })),
    ...coverage.flatMap((item): PromptEvidenceItem[] => {
      const beneficiary = people[item.beneficiary];
      const provider = people[item.provider];
      const evidenceItems: PromptEvidenceItem[] = [];
      if (item.favorable.length) {
        evidenceItems.push({
          level: '辅证',
          title: `${provider}盘面包含${beneficiary}的喜用五行`,
          detail:
            item.favorable.map((entry) => entry.wuxing).join('、') +
            '；这里只确认盘面出现该五行，不比较伪精确强度，也不等同于必然互补。',
          source: '受益方喜用五行与提供方五行出现结构交叉',
          weight: 52,
          tags: ['八字合盘', '喜用覆盖'],
        });
      }
      if (item.unfavorable.length) {
        evidenceItems.push({
          level: '反证',
          title: `${provider}盘面也包含${beneficiary}的忌神五行`,
          detail:
            item.unfavorable.map((entry) => entry.wuxing).join('、') +
            '；这里只确认盘面出现该五行，需结合双方原局结构判断实际影响。',
          source: '受益方忌神五行与提供方五行出现结构交叉',
          weight: 50,
          tags: ['八字合盘', '忌神覆盖'],
        });
      }
      return evidenceItems;
    }),
    {
      level: '限制',
      title: '八字合盘证据边界',
      detail:
        '合、冲、刑、害、破、十神映射与喜忌覆盖均为可复核盘面关系，不等于现实关系结果；神煞不得作为主证，不输出匹配总分或必然断语。',
      source: '结构化证据解释规则',
      weight: -100,
      tags: ['解释边界'],
    },
  ];
  return { title: '八字双盘结构化证据', items, emptyText: '当前两盘未发现已纳入规则的跨盘关系。' };
}

export function analyzeBaziCompatibility(
  chart1: BaziChartResult,
  chart2: BaziChartResult,
  options: BaziCompatibilityOptions = {},
): BaziCompatibilityEvidenceResult {
  if (!chart1?.pillars || !chart2?.pillars) throw new Error('八字合盘需要两份完整命盘。');
  assertPillars(chart1.pillars);
  assertPillars(chart2.pillars);
  const people = {
    person1: options.person1Name?.trim() || '第一人',
    person2: options.person2Name?.trim() || '第二人',
  };
  const person1Wuxing = asWuxing(chart1.dayMaster.gan);
  const person2Wuxing = asWuxing(chart2.dayMaster.gan);
  const dayMasterRelation: BaziDayMasterRelation = {
    person1Gan: chart1.dayMaster.gan,
    person1Wuxing,
    person2Gan: chart2.dayMaster.gan,
    person2Wuxing,
    person1ToPerson2: getElementRelation(person1Wuxing, person2Wuxing),
    person2ToPerson1: getElementRelation(person2Wuxing, person1Wuxing),
    person2GanAsPerson1TenGod: getTenGod(chart2.dayMaster.gan, chart1.dayMaster.gan),
    person1GanAsPerson2TenGod: getTenGod(chart1.dayMaster.gan, chart2.dayMaster.gan),
  };
  const crossPillarRelations = calculateCrossRelations(chart1, chart2);
  const crossBranchCombinations = calculateCombinations(chart1, chart2);
  const tenGodMappings = [
    ...calculateTenGodMappings('person1', 'person2', chart1, chart2),
    ...calculateTenGodMappings('person2', 'person1', chart2, chart1),
  ];
  const usefulGodCoverage = [
    calculateUsefulGodCoverage('person1', 'person2', chart1, chart2),
    calculateUsefulGodCoverage('person2', 'person1', chart2, chart1),
  ];
  const evidence = createEvidence(
    people,
    dayMasterRelation,
    crossPillarRelations,
    crossBranchCombinations,
    usefulGodCoverage,
  );
  return {
    people,
    dayMasterRelation,
    spousePalaceRelations: crossPillarRelations.filter(
      (item) => item.person1Pillar === 'day' && item.person2Pillar === 'day',
    ),
    crossPillarRelations,
    crossBranchCombinations,
    tenGodMappings,
    usefulGodCoverage,
    evidence,
    promptText: ['【八字双盘结构化证据】', ...formatPromptEvidenceBundle(evidence)].join('\n'),
    methodology: {
      notes: [
        '逐项比较双方年、月、日、时四柱，记录天干五合与冲、地支同支及合冲刑害破。',
        '三合、三会仅在三个成员齐备且来源跨越双方时记录，不直接判定成局或合化。',
        '双向十神按各自日干分别映射对方四柱天干及地支本气。',
        '喜忌覆盖沿用命盘已有喜忌五行与五行强度百分比，不另造权重或匹配总分。',
      ],
    },
  };
}
