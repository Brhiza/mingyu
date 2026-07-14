import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import type { BaZhaiDoorMeasurement, BaZhaiResult } from './index';

export interface BaZhaiDirectionComparison {
  direction: string;
  degree: number;
  mingLabel: string;
  mingLuck: '吉' | '凶';
  houseLabel: string | null;
  houseLuck: '吉' | '凶' | null;
  relation: '同为吉方' | '同为凶方' | '命宅异判' | '仅命卦资料';
}

export interface BaZhaiDirectionFact extends BaZhaiDirectionComparison {
  key: string;
  gua: string;
  mingGua: string;
  houseGua: string | null;
  sources: string[];
  calculation: string;
  promptText: string;
  limitation: '大游年吉凶只表示命卦或宅卦在目标宫位的传统空间分类；单一方位标签或命宅重合不证明房间适用性、健康效果、财富变化、事件结果或调整方案有效';
}

export interface BaZhaiEvidenceAnalysis {
  calculationChain: string[];
  directionFacts: BaZhaiDirectionFact[];
  directionComparisons: BaZhaiDirectionComparison[];
  alignedDirections: BaZhaiDirectionComparison[];
  conflictingDirections: BaZhaiDirectionComparison[];
  measurementFacts: string[];
  measurementCandidates: Array<{
    label: string;
    sitMountain: string;
    facingMountain: string;
    houseGua: string;
    houseGroup: '东四命' | '西四命';
    match: '相合' | '相冲';
  }>;
  counterEvidence: string[];
  limitations: string[];
  sources: Array<{ title: string; evidence: string; role: '传统规则来源' | '公共算法来源' }>;
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: string[];
}

const DIRECTION_FACT_LIMITATION =
  '大游年吉凶只表示命卦或宅卦在目标宫位的传统空间分类；单一方位标签或命宅重合不证明房间适用性、健康效果、财富变化、事件结果或调整方案有效' as const;

export function analyzeBaZhaiEvidence(
  data: Omit<BaZhaiResult, 'prompt' | 'evidenceAnalysis'>,
  measurement?: BaZhaiDoorMeasurement,
): BaZhaiEvidenceAnalysis {
  const directionFacts = data.mingPalace.map((mingPalace): BaZhaiDirectionFact => {
    const housePalace = data.housePalace?.find((item) => item.gua === mingPalace.gua) ?? null;
    const relation = !housePalace
      ? '仅命卦资料'
      : housePalace.luck === mingPalace.luck
        ? mingPalace.luck === '吉'
          ? '同为吉方'
          : '同为凶方'
        : '命宅异判';
    return {
      key: `方位:${mingPalace.gua}`,
      gua: mingPalace.gua,
      direction: mingPalace.direction,
      degree: mingPalace.degree,
      mingGua: data.mingGua,
      mingLabel: mingPalace.label,
      mingLuck: mingPalace.luck,
      houseGua: data.houseGua,
      houseLabel: housePalace?.label ?? null,
      houseLuck: housePalace?.luck ?? null,
      relation,
      sources: ['《八宅明镜》《阳宅十书》命卦与宅卦大游年八宫表', '命语后天八卦方位与中心度数表'],
      calculation: `以命卦${data.mingGua}查大游年表的${mingPalace.gua}宫得${mingPalace.label}${housePalace && data.houseGua ? `；以宅卦${data.houseGua}查同一${mingPalace.gua}宫得${housePalace.label}；比较两者传统吉凶分类得${relation}` : '；本次未提供宅卦，不执行命宅逐方比较'}`,
      promptText: `${mingPalace.direction}（${mingPalace.gua}宫，中心${mingPalace.degree}°）：命卦${data.mingGua}查表为${mingPalace.label}（传统${mingPalace.luck}方分类）${housePalace && data.houseGua ? `；宅卦${data.houseGua}查表为${housePalace.label}（传统${housePalace.luck}方分类）；逐方关系为${relation}` : '；未提供宅卦资料，仅保留命卦层事实'}`,
      limitation: DIRECTION_FACT_LIMITATION,
    };
  });
  const directionComparisons: BaZhaiDirectionComparison[] = directionFacts.map(
    ({ direction, degree, mingLabel, mingLuck, houseLabel, houseLuck, relation }) => ({
      direction,
      degree,
      mingLabel,
      mingLuck,
      houseLabel,
      houseLuck,
      relation,
    }),
  );
  const alignedDirections = directionComparisons.filter(
    (item) => item.relation === '同为吉方' || item.relation === '同为凶方',
  );
  const conflictingDirections = directionComparisons.filter((item) => item.relation === '命宅异判');
  const measurementFacts = measurement
    ? [
        `从大门面向屋内实测${measurement.measuredDegree}°，换算真北口径为${measurement.trueNorthDegree}°`,
        `传统坐向为${measurement.label}，坐${measurement.sitMountain}山、向${measurement.facingMountain}向`,
        `测量误差±${measurement.measurementUncertaintyDegrees}°，距最近二十四山边界${measurement.nearestBoundaryDistanceDegrees.toFixed(2)}°`,
        `稳定性为${measurement.stability}，候选坐向${measurement.candidateDirections.map((item) => item.label).join('、')}`,
      ]
    : [];
  const measurementCandidates =
    measurement?.candidateDirections.map((item) => ({
      label: item.label,
      sitMountain: item.sitMountain,
      facingMountain: item.facingMountain,
      houseGua: item.houseGua,
      houseGroup: item.houseGroup,
      match: item.match,
    })) ?? [];
  const counterEvidence = [
    ...(!data.houseGua
      ? ['未提供住宅坐山或门向，只能输出命卦个人方位，不能判断宅卦和命宅配合']
      : []),
    ...(conflictingDirections.length
      ? [
          `命卦与宅卦在${conflictingDirections.map((item) => item.direction).join('、')}存在异判，不得把其中一套八宫静默覆盖另一套`,
        ]
      : []),
    ...(measurement?.stability === '山向边界敏感'
      ? ['测量误差跨越二十四山边界，虽未改变宅卦，仍应保留多个山向候选']
      : []),
    ...(measurement?.stability === '宅卦不稳定'
      ? ['测量误差跨越宅卦边界，中心读数不能作为唯一宅卦主证，必须并列候选盘']
      : []),
    ...(measurement?.northReference === 'unspecified'
      ? ['未声明设备采用磁北还是真北，坐向仍有北向基准缺口']
      : []),
  ];
  const limitations = [
    '八宅大游年、东四命与西四命属于传统空间分类模型，不是现代建筑性能或健康效果的实证模型',
    '门向测量须固定“站在大门处面向屋内”的口径；不同站位、手机壳、金属门、电器和钢筋可能干扰指南针',
    '磁北读数必须结合当地磁偏角换算真北；未声明北向基准时不得宣称坐向精确',
    '户型中心、门的实际使用方式、房间功能、采光通风、消防、承重、动线和居住需求不会由八宅盘自动得出',
    '命卦八宫与宅卦八宫必须分开陈述；同方重合可作传统主证，异判时需说明采用哪套口径及现实理由',
    '不得输出住宅吉凶总分、健康概率、财富增幅或保证有效的调整方案',
  ];
  const sources: BaZhaiEvidenceAnalysis['sources'] = [
    {
      title: '《八宅明镜》《阳宅十书》传统规则',
      evidence: '命卦、宅卦、东四西四分组与大游年八宫表',
      role: '传统规则来源',
    },
    {
      title: '命语日历与方位公共模块',
      evidence: '立春年界、二十四山、角度归一化、坐向反转和磁北真北换算',
      role: '公共算法来源',
    },
  ];
  const items: PromptEvidenceItem[] = [
    ...(measurement
      ? [
          {
            level: measurement.stability === '稳定' ? ('主证' as const) : ('反证' as const),
            title: `入户坐向测量${measurement.stability}`,
            detail: `${measurementFacts.join('；')}；北向基准${measurement.northReference === 'true' ? '真北' : measurement.northReference === 'magnetic' ? `磁北，磁偏角${measurement.magneticDeclinationDegrees ?? 0}°` : '未声明'}；候选明细${measurementCandidates.map((item) => `${item.label}、${item.houseGua}${item.houseGroup}、命宅${item.match}`).join('；')}`,
            source: '入户实测角度、北向基准、磁偏角、测量误差与二十四山边界计算',
            tags: [
              '现场测量',
              measurement.stability,
              ...measurementCandidates.map((item) => item.label),
            ],
          },
        ]
      : []),
    ...directionFacts.map((item): PromptEvidenceItem => ({
      level: item.relation === '同为吉方' ? '主证' : item.relation === '命宅异判' ? '反证' : '辅证',
      title: `${item.direction}${item.relation}`,
      detail: `${item.promptText}；边界：${item.limitation}`,
      source: `${item.sources.join('；')}；计算：${item.calculation}`,
      tags: [item.direction, item.mingLabel, item.houseLabel ?? '无宅卦', item.relation],
    })),
    ...counterEvidence.map((detail): PromptEvidenceItem => ({
      level: '反证',
      title: '八宅资料缺口或边界',
      detail,
      source: '当前出生资料、坐向输入与测量误差逐项核验',
    })),
    {
      level: '限制',
      title: '八宅传统模型与现场使用边界',
      detail: limitations.join('；'),
      source: '传统方位事实、测量事实与现代居住条件分离原则',
      tags: ['现场复测', '现实条件优先'],
    },
  ];
  const evidence: PromptEvidenceBundle = { title: '八宅命宅方位与测量结构化证据', items };
  const calculationChain = [
    data.birthYearBoundaryNote.includes('只提供了出生年份')
      ? `出生年份暂按${data.effectiveBirthYear}计算，立春前出生仍需按上一年复核`
      : data.effectiveBirthYear
        ? `出生日期按立春年界取有效年份${data.effectiveBirthYear}`
        : '直接采用调用方给定命卦',
    `计算命卦${data.mingGua}与${data.mingGroup}`,
    data.houseGua
      ? `坐山归属宅卦${data.houseGua}与${data.houseGroup}`
      : '未提供坐山，停止在命卦八宫层',
    '按大游年表分别生成命卦八宫与宅卦八宫',
    '逐方比较重合、同凶与异判关系，并附加测量稳定性',
  ];
  const promptText = [
    '【八宅命宅方位与测量结构化证据】',
    ...formatPromptEvidenceBundle(evidence),
    `计算链：${calculationChain.join(' → ')}。`,
    `测量事实：${measurementFacts.join('；') || '本次未提供可分析的入户角度测量资料'}。`,
    `命宅同为吉方：${
      alignedDirections
        .filter((item) => item.relation === '同为吉方')
        .map((item) => `${item.direction}${item.mingLabel}/${item.houseLabel}`)
        .join('、') || '未见或未提供宅卦'
    }。`,
    `命宅异判：${conflictingDirections.map((item) => `${item.direction}命卦${item.mingLabel}${item.mingLuck}、宅卦${item.houseLabel}${item.houseLuck}`).join('；') || '未见或未提供宅卦'}。`,
    `规则来源：${sources.map((item) => `${item.title}（${item.role}：${item.evidence}）`).join('；')}。`,
  ].join('\n');
  return {
    calculationChain,
    directionFacts,
    directionComparisons,
    alignedDirections,
    conflictingDirections,
    measurementFacts,
    measurementCandidates,
    counterEvidence,
    limitations,
    sources,
    evidence,
    promptText,
    methodology: [
      '先固定命卦年界与门向测量口径，再分别生成命卦盘和宅卦盘。',
      '逐方保存命卦标签、宅卦标签与一致性，不用单一“命宅相合”覆盖八个方位的差异。',
      '测量误差跨界时并列候选坐向，现实安全、建筑条件和实际使用需求始终优先。',
    ],
  };
}
