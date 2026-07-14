import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import type { BaZhaiDoorMeasurement, BaZhaiMeasurementStability, BaZhaiResult } from './index';

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

export interface BaZhaiCalculationStep {
  key: string;
  stage: '命卦年界' | '命卦计算' | '宅卦计算' | '八宫排布' | '逐方比较';
  status: '完整' | '待复核' | '未提供';
  inputs: Record<string, string | number | boolean>;
  result: Record<string, string | number | boolean>;
  promptText: string;
  sources: string[];
}

export interface BaZhaiCalculationFact {
  key: 'calculation:bazhai:ming-house';
  status: '命卦完整' | '命宅完整';
  yearBoundaryStatus: '已核定' | '待复核' | '直接命卦';
  steps: BaZhaiCalculationStep[];
  promptText: string;
  sources: string[];
  limitation: '计算链只证明出生年界、命卦、宅卦和大游年八宫如何形成当前方位资料，不证明住宅适用性、健康效果、财富变化、事件结果或调整方案有效';
}

export interface BaZhaiMeasurementCandidateFact {
  key: string;
  index: number;
  label: string;
  sitMountain: string;
  facingMountain: string;
  houseGua: string;
  houseGroup: '东四命' | '西四命';
  match: '相合' | '相冲';
  promptText: string;
  sources: string[];
  limitation: '候选坐向只表示测量误差范围内可能落入的二十四山与宅卦，不代表现场真实坐向已经确定，也不得据候选数量生成可信度、吉凶分或调整结论';
}

export interface BaZhaiMeasurementFact {
  key: 'measurement:bazhai:door';
  status: '未提供' | BaZhaiMeasurementStability;
  referenceStatus: '未提供' | '已声明' | '未声明';
  method?: '站在大门处面向屋内测量';
  input?: {
    measuredDegree: number;
    northReference: 'unspecified' | 'magnetic' | 'true';
    magneticDeclinationDegrees: number | null;
    measurementUncertaintyDegrees: number;
  };
  result?: {
    trueNorthDegree: number;
    nearestBoundaryDistanceDegrees: number;
    sitDegree: number;
    sitMountain: string;
    facingDegree: number;
    facingMountain: string;
    label: string;
  };
  candidates: BaZhaiMeasurementCandidateFact[];
  warnings: string[];
  promptText: string;
  sources: string[];
  limitation: '入户测量只证明指定站位、北向基准、磁偏角和误差范围如何换算当前坐山朝向候选；未声明北向、受环境干扰或跨边界时不得把中心读数当作唯一真实坐向';
}

export interface BaZhaiEvidenceAnalysis {
  calculationFact: BaZhaiCalculationFact;
  calculationChain: string[];
  directionFacts: BaZhaiDirectionFact[];
  directionComparisons: BaZhaiDirectionComparison[];
  alignedDirections: BaZhaiDirectionComparison[];
  conflictingDirections: BaZhaiDirectionComparison[];
  measurementFact: BaZhaiMeasurementFact;
  measurementFacts: string[];
  measurementCandidateFacts: BaZhaiMeasurementCandidateFact[];
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
const CALCULATION_FACT_LIMITATION =
  '计算链只证明出生年界、命卦、宅卦和大游年八宫如何形成当前方位资料，不证明住宅适用性、健康效果、财富变化、事件结果或调整方案有效' as const;
const MEASUREMENT_FACT_LIMITATION =
  '入户测量只证明指定站位、北向基准、磁偏角和误差范围如何换算当前坐山朝向候选；未声明北向、受环境干扰或跨边界时不得把中心读数当作唯一真实坐向' as const;
const MEASUREMENT_CANDIDATE_LIMITATION =
  '候选坐向只表示测量误差范围内可能落入的二十四山与宅卦，不代表现场真实坐向已经确定，也不得据候选数量生成可信度、吉凶分或调整结论' as const;

function buildCalculationFact(
  data: Omit<BaZhaiResult, 'prompt' | 'evidenceAnalysis'>,
): BaZhaiCalculationFact {
  const yearBoundaryStatus: BaZhaiCalculationFact['yearBoundaryStatus'] =
    data.effectiveBirthYear === null
      ? '直接命卦'
      : data.birthYearBoundaryNote.includes('只提供了出生年份')
        ? '待复核'
        : '已核定';
  const steps: BaZhaiCalculationStep[] = [
    {
      key: 'bazhai:calculation:year-boundary',
      stage: '命卦年界',
      status: yearBoundaryStatus === '待复核' ? '待复核' : '完整',
      inputs: {
        mingGuaSource: data.calculationInput.mingGuaSource,
        ...(data.calculationInput.birthYear !== undefined
          ? { birthYear: data.calculationInput.birthYear }
          : {}),
        ...(data.calculationInput.birthMonth !== undefined
          ? { birthMonth: data.calculationInput.birthMonth }
          : {}),
        ...(data.calculationInput.birthDay !== undefined
          ? { birthDay: data.calculationInput.birthDay }
          : {}),
        ...(data.calculationInput.gender ? { gender: data.calculationInput.gender } : {}),
        boundaryNote: data.birthYearBoundaryNote,
        ...(data.effectiveBirthYear !== null
          ? { effectiveBirthYear: data.effectiveBirthYear }
          : { directMingGua: data.mingGua }),
      },
      result: { yearBoundaryStatus },
      promptText:
        yearBoundaryStatus === '直接命卦'
          ? '直接采用调用方给定命卦'
          : yearBoundaryStatus === '待复核'
            ? `出生年份暂按${data.effectiveBirthYear}计算，立春前出生仍需按上一年复核`
            : `出生日期按立春年界取有效年份${data.effectiveBirthYear}`,
      sources: ['命语立春年界与干支年换算', '当前出生日期或给定命卦资料'],
    },
    {
      key: 'bazhai:calculation:ming-gua',
      stage: '命卦计算',
      status: '完整',
      inputs: {
        mingGuaSource: data.calculationInput.mingGuaSource,
        ...(data.calculationInput.gender ? { gender: data.calculationInput.gender } : {}),
        ...(data.effectiveBirthYear !== null
          ? { effectiveBirthYear: data.effectiveBirthYear }
          : { directMingGua: data.mingGua }),
      },
      result: { mingGua: data.mingGua, mingGroup: data.mingGroup },
      promptText: `计算命卦${data.mingGua}与${data.mingGroup}`,
      sources: ['命语命卦计算或调用方给定命卦', '东四命与西四命分组表'],
    },
    {
      key: 'bazhai:calculation:house-gua',
      stage: '宅卦计算',
      status: data.houseGua ? '完整' : '未提供',
      inputs: data.calculationInput.sitMountain
        ? { sitMountain: data.calculationInput.sitMountain }
        : {},
      result: data.houseGua
        ? { houseGua: data.houseGua, houseGroup: data.houseGroup ?? '未列' }
        : { scope: '仅命卦八宫' },
      promptText: data.houseGua
        ? `坐山归属宅卦${data.houseGua}与${data.houseGroup}`
        : '未提供坐山，停止在命卦八宫层',
      sources: ['二十四山坐山与后天八卦宅卦映射'],
    },
    {
      key: 'bazhai:calculation:eight-directions',
      stage: '八宫排布',
      status: '完整',
      inputs: {
        mingGua: data.mingGua,
        ...(data.houseGua ? { houseGua: data.houseGua } : {}),
      },
      result: {
        mingDirectionCount: data.mingPalace.length,
        houseDirectionCount: data.housePalace?.length ?? 0,
      },
      promptText: '按大游年表分别生成命卦八宫与可用的宅卦八宫',
      sources: ['《八宅明镜》《阳宅十书》大游年八宫表'],
    },
    {
      key: 'bazhai:calculation:comparison',
      stage: '逐方比较',
      status: data.houseGua ? '完整' : '未提供',
      inputs: {
        mingDirectionCount: data.mingPalace.length,
        houseDirectionCount: data.housePalace?.length ?? 0,
      },
      result: {
        match: data.match,
        comparisonScope: data.houseGua ? '命卦与宅卦逐方比较' : '仅命卦资料',
      },
      promptText: data.houseGua
        ? '逐方比较命卦与宅卦的重合、同凶与异判关系'
        : '未提供宅卦，不执行命宅逐方比较',
      sources: ['当前命卦八宫与宅卦八宫逐宫对照'],
    },
  ];
  return {
    key: 'calculation:bazhai:ming-house',
    status: data.houseGua ? '命宅完整' : '命卦完整',
    yearBoundaryStatus,
    steps,
    promptText: steps.map((item) => item.promptText).join(' → '),
    sources: [
      '命语立春年界与命卦计算',
      '二十四山、后天八卦与宅卦映射',
      '《八宅明镜》《阳宅十书》大游年八宫表',
    ],
    limitation: CALCULATION_FACT_LIMITATION,
  };
}

function buildMeasurementFact(measurement?: BaZhaiDoorMeasurement): BaZhaiMeasurementFact {
  if (!measurement) {
    return {
      key: 'measurement:bazhai:door',
      status: '未提供',
      referenceStatus: '未提供',
      candidates: [],
      warnings: [],
      promptText: '本次未提供可分析的入户角度测量资料',
      sources: ['当前调用未提供入户度数、北向基准与测量误差'],
      limitation: MEASUREMENT_FACT_LIMITATION,
    };
  }
  const candidates = measurement.candidateDirections.map(
    (item, index): BaZhaiMeasurementCandidateFact => ({
      key: `measurement:bazhai:candidate:${index + 1}:${item.label}`,
      index: index + 1,
      label: item.label,
      sitMountain: item.sitMountain,
      facingMountain: item.facingMountain,
      houseGua: item.houseGua,
      houseGroup: item.houseGroup,
      match: item.match,
      promptText: `${item.label}：坐${item.sitMountain}山、向${item.facingMountain}向，归${item.houseGua}宅${item.houseGroup}，命宅${item.match}`,
      sources: ['真北入户角度、测量误差与二十四山覆盖范围', '坐山宅卦与命宅分组比较'],
      limitation: MEASUREMENT_CANDIDATE_LIMITATION,
    }),
  );
  return {
    key: 'measurement:bazhai:door',
    status: measurement.stability,
    referenceStatus: measurement.northReference === 'unspecified' ? '未声明' : '已声明',
    method: measurement.method,
    input: {
      measuredDegree: measurement.measuredDegree,
      northReference: measurement.northReference,
      magneticDeclinationDegrees: measurement.magneticDeclinationDegrees,
      measurementUncertaintyDegrees: measurement.measurementUncertaintyDegrees,
    },
    result: {
      trueNorthDegree: measurement.trueNorthDegree,
      nearestBoundaryDistanceDegrees: measurement.nearestBoundaryDistanceDegrees,
      sitDegree: measurement.sitDegree,
      sitMountain: measurement.sitMountain,
      facingDegree: measurement.facingDegree,
      facingMountain: measurement.facingMountain,
      label: measurement.label,
    },
    candidates,
    warnings: measurement.warnings,
    promptText: `${measurement.method}：实测${measurement.measuredDegree}°，真北口径${measurement.trueNorthDegree}°，误差±${measurement.measurementUncertaintyDegrees}°，中心结果${measurement.label}，稳定性${measurement.stability}，候选${candidates.map((item) => item.label).join('、') || '无'}`,
    sources: [
      '现场入户指南针读数与指定测量站位',
      measurement.northReference === 'magnetic'
        ? '当地磁偏角换算真北'
        : measurement.northReference === 'true'
          ? '真北读数直接归一化'
          : '北向基准未声明的原始读数',
      '二十四山边界、测量误差与坐向反转计算',
    ],
    limitation: MEASUREMENT_FACT_LIMITATION,
  };
}

export function analyzeBaZhaiEvidence(
  data: Omit<BaZhaiResult, 'prompt' | 'evidenceAnalysis'>,
  measurement?: BaZhaiDoorMeasurement,
): BaZhaiEvidenceAnalysis {
  const calculationFact = buildCalculationFact(data);
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
  const measurementFact = buildMeasurementFact(measurement);
  const measurementFacts = measurement
    ? [
        `从大门面向屋内实测${measurement.measuredDegree}°，换算真北口径为${measurement.trueNorthDegree}°`,
        `传统坐向为${measurement.label}，坐${measurement.sitMountain}山、向${measurement.facingMountain}向`,
        `测量误差±${measurement.measurementUncertaintyDegrees}°，距最近二十四山边界${measurement.nearestBoundaryDistanceDegrees.toFixed(2)}°`,
        `稳定性为${measurement.stability}，候选坐向${measurement.candidateDirections.map((item) => item.label).join('、')}`,
      ]
    : [];
  const measurementCandidateFacts = measurementFact.candidates;
  const measurementCandidates = measurementCandidateFacts.map((item) => ({
    label: item.label,
    sitMountain: item.sitMountain,
    facingMountain: item.facingMountain,
    houseGua: item.houseGua,
    houseGroup: item.houseGroup,
    match: item.match,
  }));
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
    {
      level: calculationFact.yearBoundaryStatus === '待复核' ? '反证' : '辅证',
      title: '八宅命卦宅卦计算链事实',
      detail: `${calculationFact.promptText}；边界：${calculationFact.limitation}`,
      source: calculationFact.sources.join('、'),
      tags: [calculationFact.status, calculationFact.yearBoundaryStatus],
    },
    ...(measurement
      ? [
          {
            level: measurement.stability === '稳定' ? ('主证' as const) : ('反证' as const),
            title: `入户坐向测量${measurement.stability}`,
            detail: `${measurementFacts.join('；')}；北向基准${measurement.northReference === 'true' ? '真北' : measurement.northReference === 'magnetic' ? `磁北，磁偏角${measurement.magneticDeclinationDegrees ?? 0}°` : '未声明'}；候选明细${measurementCandidateFacts.map((item) => `${item.promptText}；边界：${item.limitation}`).join('；')}；测量边界：${measurementFact.limitation}`,
            source: measurementFact.sources.join('、'),
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
  const calculationChain = calculationFact.steps.map((item) => item.promptText);
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
    calculationFact,
    calculationChain,
    directionFacts,
    directionComparisons,
    alignedDirections,
    conflictingDirections,
    measurementFact,
    measurementFacts,
    measurementCandidateFacts,
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
