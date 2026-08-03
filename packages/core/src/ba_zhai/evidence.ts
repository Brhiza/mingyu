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
  status: '已计算';
  gua: string;
  mingGua: string;
  houseGua: string | null;
  calculationStepKeys: string[];
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
  dependsOnStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '计算步骤只记录出生年界、命卦、宅卦、八宫排布与逐方比较的形成过程；不得把步骤完整度解释为住宅适用度、现实效果或结论可信度';
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
  status: '候选';
  index: number;
  label: string;
  sitMountain: string;
  facingMountain: string;
  houseGua: string;
  houseGroup: '东四命' | '西四命';
  match: '相合' | '相冲';
  measurementFactKey: 'measurement:bazhai:door';
  calculationStepKeys: string[];
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
  candidateFactKeys: string[];
  calculationStepKeys: string[];
  warnings: string[];
  promptText: string;
  sources: string[];
  limitation: '入户测量只证明指定站位、北向基准、磁偏角和误差范围如何换算当前坐山朝向候选；未声明北向、受环境干扰或跨边界时不得把中心读数当作唯一真实坐向';
}

export interface BaZhaiCounterEvidenceFact {
  key: string;
  type:
    | '命卦年界'
    | '宅卦资料覆盖'
    | '命宅逐方一致性'
    | '山向边界稳定性'
    | '宅卦边界稳定性'
    | '北向基准';
  status:
    | '已覆盖'
    | '未提供'
    | '存在异判'
    | '边界敏感'
    | '不稳定'
    | '未声明'
    | '不适用'
    | '已核定'
    | '待复核'
    | '直接给定';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '反证事实只记录命卦年界、宅卦资料、逐方异判、测量边界和北向基准是否存在缺口；缺口不等于住宅必然不利，资料完整也不证明现实效果';
}

export interface BaZhaiCounterSummaryFact {
  key: 'bazhai:counter-summary';
  status: '存在需保留反证' | '未见额外反证';
  factKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '反证汇总只用于防止把缺失资料、异判或边界敏感静默忽略；不得据反证数量生成吉凶分、可信度或调整结论';
}

export interface BaZhaiLimitationFact {
  key: string;
  type:
    | '传统模型边界'
    | '测量方法边界'
    | '北向基准边界'
    | '建筑现实边界'
    | '命宅分层边界'
    | '高风险输出边界';
  status: '适用';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '限制事实用于约束八宅传统分类与现场测量可支持的解释范围，不得被反向当作住宅效果、健康变化、财富结果或调整有效性的证据';
}

export interface BaZhaiSummaryFact {
  key: 'bazhai:evidence-summary';
  status: '命卦链完整' | '命宅链完整' | '证据链有缺口';
  factKeys: string[];
  directionFactCount: number;
  alignedDirectionCount: number;
  conflictingDirectionCount: number;
  measurementCandidateCount: number;
  counterEvidenceCount: number;
  limitationFactCount: number;
  promptText: string;
  sources: string[];
  limitation: '八宅证据汇总只统计命卦年界、命卦宅卦、八宫逐方、测量候选、反证与限制覆盖；不得按数量生成住宅吉凶总分、可信度、健康概率、财富增幅或调整效果保证';
}

export interface BaZhaiEvidenceAnalysis {
  key: 'bazhai:evidence';
  status: '已计算';
  calculationFact: BaZhaiCalculationFact;
  calculationSteps: BaZhaiCalculationStep[];
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
  counterEvidenceFacts: BaZhaiCounterEvidenceFact[];
  counterSummaryFact: BaZhaiCounterSummaryFact;
  limitations: string[];
  limitationFacts: BaZhaiLimitationFact[];
  summaryFact: BaZhaiSummaryFact;
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
const CALCULATION_STEP_LIMITATION =
  '计算步骤只记录出生年界、命卦、宅卦、八宫排布与逐方比较的形成过程；不得把步骤完整度解释为住宅适用度、现实效果或结论可信度' as const;
const COUNTER_FACT_LIMITATION =
  '反证事实只记录命卦年界、宅卦资料、逐方异判、测量边界和北向基准是否存在缺口；缺口不等于住宅必然不利，资料完整也不证明现实效果' as const;
const COUNTER_SUMMARY_LIMITATION =
  '反证汇总只用于防止把缺失资料、异判或边界敏感静默忽略；不得据反证数量生成吉凶分、可信度或调整结论' as const;
const LIMITATION_FACT_LIMITATION =
  '限制事实用于约束八宅传统分类与现场测量可支持的解释范围，不得被反向当作住宅效果、健康变化、财富结果或调整有效性的证据' as const;
const SUMMARY_FACT_LIMITATION =
  '八宅证据汇总只统计命卦年界、命卦宅卦、八宫逐方、测量候选、反证与限制覆盖；不得按数量生成住宅吉凶总分、可信度、健康概率、财富增幅或调整效果保证' as const;

function buildCalculationFact(
  data: Omit<BaZhaiResult, 'prompt' | 'evidenceAnalysis'>,
): BaZhaiCalculationFact {
  const yearBoundaryStatus: BaZhaiCalculationFact['yearBoundaryStatus'] =
    data.effectiveBirthYear === null
      ? '直接命卦'
      : data.birthYearBoundaryNote.includes('未提供月日')
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
      dependsOnStepKeys: [],
      promptText:
        yearBoundaryStatus === '直接命卦'
          ? '直接采用明确给定的命卦'
          : yearBoundaryStatus === '待复核'
            ? `出生年份暂按${data.effectiveBirthYear}计算，立春前出生仍需按上一年复核`
            : `出生日期按立春年界取有效年份${data.effectiveBirthYear}`,
      sources: ['立春年界与干支年换算规则', '输入出生日期或明确给定的命卦资料'],
      limitation: CALCULATION_STEP_LIMITATION,
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
      dependsOnStepKeys: ['bazhai:calculation:year-boundary'],
      promptText: `计算命卦${data.mingGua}与${data.mingGroup}`,
      sources: ['命卦计算规则或明确给定的命卦', '东四命与西四命分组表'],
      limitation: CALCULATION_STEP_LIMITATION,
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
      dependsOnStepKeys: [],
      promptText: data.houseGua
        ? `坐山归属宅卦${data.houseGua}与${data.houseGroup}`
        : '未提供坐山，停止在命卦八宫层',
      sources: ['二十四山坐山与后天八卦宅卦映射'],
      limitation: CALCULATION_STEP_LIMITATION,
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
      dependsOnStepKeys: [
        'bazhai:calculation:ming-gua',
        ...(data.houseGua ? ['bazhai:calculation:house-gua'] : []),
      ],
      promptText: '按大游年表分别生成命卦八宫与可用的宅卦八宫',
      sources: ['《八宅明镜》《阳宅十书》大游年八宫表'],
      limitation: CALCULATION_STEP_LIMITATION,
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
      dependsOnStepKeys: ['bazhai:calculation:eight-directions'],
      promptText: data.houseGua
        ? '逐方比较命卦与宅卦的重合、同凶与异判关系'
        : '未提供宅卦，不执行命宅逐方比较',
      sources: ['当前命卦八宫与宅卦八宫逐宫对照'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
  ];
  return {
    key: 'calculation:bazhai:ming-house',
    status: data.houseGua ? '命宅完整' : '命卦完整',
    yearBoundaryStatus,
    steps,
    promptText: steps.map((item) => item.promptText).join(' → '),
    sources: [
      '立春年界与命卦计算规则',
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
      candidateFactKeys: [],
      calculationStepKeys: [],
      warnings: [],
      promptText: '本次未提供可分析的入户角度测量资料',
      sources: ['输入资料未提供入户度数、北向基准与测量误差'],
      limitation: MEASUREMENT_FACT_LIMITATION,
    };
  }
  const candidates = measurement.candidateDirections.map(
    (item, index): BaZhaiMeasurementCandidateFact => ({
      key: `measurement:bazhai:candidate:${index + 1}:${item.label}`,
      status: '候选',
      index: index + 1,
      label: item.label,
      sitMountain: item.sitMountain,
      facingMountain: item.facingMountain,
      houseGua: item.houseGua,
      houseGroup: item.houseGroup,
      match: item.match,
      measurementFactKey: 'measurement:bazhai:door',
      calculationStepKeys: ['bazhai:calculation:house-gua'],
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
    candidateFactKeys: candidates.map((item) => item.key),
    calculationStepKeys: ['bazhai:calculation:house-gua'],
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

function buildCounterEvidenceFacts(
  data: Omit<BaZhaiResult, 'prompt' | 'evidenceAnalysis'>,
  calculationFact: BaZhaiCalculationFact,
  directionFacts: BaZhaiDirectionFact[],
  conflictingDirections: BaZhaiDirectionComparison[],
  measurementFact: BaZhaiMeasurementFact,
): BaZhaiCounterEvidenceFact[] {
  const hasMeasurement = measurementFact.status !== '未提供';
  const hasBoundarySensitivity =
    hasMeasurement &&
    (measurementFact.status === '山向边界敏感' || measurementFact.status === '宅卦不稳定');
  return [
    {
      key: 'bazhai:counter:year-boundary',
      type: '命卦年界',
      status:
        calculationFact.yearBoundaryStatus === '直接命卦'
          ? '直接给定'
          : calculationFact.yearBoundaryStatus,
      ownerFactKeys: ['bazhai:calculation:year-boundary'],
      promptText:
        calculationFact.yearBoundaryStatus === '直接命卦'
          ? '命卦已明确给定，不再反推出生年界'
          : calculationFact.yearBoundaryStatus === '待复核'
            ? '只提供出生年份，立春前后的命卦年界仍需按完整出生日期复核'
            : `出生日期已按立春年界核定，有效命卦年份为${data.effectiveBirthYear}`,
      sources: ['出生日期、立春年界与命卦有效年份核验'],
      limitation: COUNTER_FACT_LIMITATION,
    },
    {
      key: 'bazhai:counter:house-data',
      type: '宅卦资料覆盖',
      status: data.houseGua ? '已覆盖' : '未提供',
      ownerFactKeys: ['bazhai:calculation:house-gua', ...directionFacts.map((item) => item.key)],
      promptText: data.houseGua
        ? `已取得宅卦${data.houseGua}与完整宅卦八宫，可执行命宅比较`
        : '未提供住宅坐山或门向，只能输出命卦个人方位，不能判断宅卦和命宅配合',
      sources: ['宅卦计算步骤与宅卦八宫资料覆盖核验'],
      limitation: COUNTER_FACT_LIMITATION,
    },
    {
      key: 'bazhai:counter:direction-consistency',
      type: '命宅逐方一致性',
      status: !data.houseGua ? '不适用' : conflictingDirections.length ? '存在异判' : '已覆盖',
      ownerFactKeys: directionFacts.map((item) => item.key),
      promptText: !data.houseGua
        ? '未提供宅卦，本次不执行命宅逐方一致性核验'
        : conflictingDirections.length
          ? `命卦与宅卦在${conflictingDirections.map((item) => item.direction).join('、')}存在异判，不得把其中一套八宫静默覆盖另一套`
          : '命卦与宅卦八宫已逐方核验，本次未见命宅异判',
      sources: ['命卦八宫与宅卦八宫逐宫对照'],
      limitation: COUNTER_FACT_LIMITATION,
    },
    {
      key: 'bazhai:counter:mountain-boundary',
      type: '山向边界稳定性',
      status: !hasMeasurement ? '不适用' : hasBoundarySensitivity ? '边界敏感' : '已覆盖',
      ownerFactKeys: [measurementFact.key, ...measurementFact.candidateFactKeys],
      promptText: !hasMeasurement
        ? '未使用角度测量，本次不评价二十四山测量边界稳定性'
        : hasBoundarySensitivity
          ? '测量误差跨越二十四山边界，应保留多个山向候选，不得只采用中心山向'
          : '测量误差未跨越二十四山边界，中心山向在给定误差范围内保持稳定',
      sources: ['真北角度、测量误差与二十四山边界覆盖核验'],
      limitation: COUNTER_FACT_LIMITATION,
    },
    {
      key: 'bazhai:counter:house-boundary',
      type: '宅卦边界稳定性',
      status: !hasMeasurement
        ? '不适用'
        : measurementFact.status === '宅卦不稳定'
          ? '不稳定'
          : '已覆盖',
      ownerFactKeys: [measurementFact.key, ...measurementFact.candidateFactKeys],
      promptText: !hasMeasurement
        ? '未使用角度测量，本次不评价测量误差是否跨越宅卦边界'
        : measurementFact.status === '宅卦不稳定'
          ? '测量误差跨越宅卦边界，中心读数不能作为唯一宅卦主证，必须并列候选盘'
          : '测量误差未跨越宅卦边界，候选山向仍归同一宅卦',
      sources: ['测量候选山向与宅卦归属逐项核验'],
      limitation: COUNTER_FACT_LIMITATION,
    },
    {
      key: 'bazhai:counter:north-reference',
      type: '北向基准',
      status: !hasMeasurement
        ? '不适用'
        : measurementFact.referenceStatus === '已声明'
          ? '已覆盖'
          : '未声明',
      ownerFactKeys: [measurementFact.key],
      promptText: !hasMeasurement
        ? '未使用角度测量，本次不要求声明磁北或真北基准'
        : measurementFact.referenceStatus === '已声明'
          ? '测量资料已声明磁北或真北基准，并按相应口径处理'
          : '未声明设备采用磁北还是真北，坐向仍有北向基准缺口',
      sources: ['入户测量北向基准与磁偏角资料核验'],
      limitation: COUNTER_FACT_LIMITATION,
    },
  ];
}

function isCounterIssue(item: BaZhaiCounterEvidenceFact) {
  return !['已覆盖', '不适用', '已核定', '直接给定'].includes(item.status);
}

function buildCounterSummaryFact(
  counterEvidenceFacts: BaZhaiCounterEvidenceFact[],
): BaZhaiCounterSummaryFact {
  const issueFacts = counterEvidenceFacts.filter(isCounterIssue);
  return {
    key: 'bazhai:counter-summary',
    status: issueFacts.length ? '存在需保留反证' : '未见额外反证',
    factKeys: issueFacts.map((item) => item.key),
    promptText: issueFacts.length
      ? `需保留${issueFacts.map((item) => `${item.type}${item.status}`).join('、')}；不得静默补齐或覆盖`
      : '命卦年界、宅卦资料、逐方比较、测量边界与北向基准未见额外缺口',
    sources: ['命卦年界、宅卦资料、逐方关系、测量边界与北向基准逐项汇总'],
    limitation: COUNTER_SUMMARY_LIMITATION,
  };
}

function buildLimitationFacts(
  calculationFact: BaZhaiCalculationFact,
  directionFacts: BaZhaiDirectionFact[],
  measurementFact: BaZhaiMeasurementFact,
): BaZhaiLimitationFact[] {
  const directionFactKeys = directionFacts.map((item) => item.key);
  const allFactKeys = [calculationFact.key, measurementFact.key, ...directionFactKeys];
  const definitions: Array<
    Pick<BaZhaiLimitationFact, 'key' | 'type' | 'ownerFactKeys' | 'promptText' | 'sources'>
  > = [
    {
      key: 'bazhai:limitation:traditional-model',
      type: '传统模型边界',
      ownerFactKeys: [calculationFact.key, ...directionFactKeys],
      promptText:
        '八宅大游年、东四命与西四命属于传统空间分类模型，不是现代建筑性能或健康效果的实证模型',
      sources: ['传统方位分类与现代建筑实证范围对照'],
    },
    {
      key: 'bazhai:limitation:measurement-method',
      type: '测量方法边界',
      ownerFactKeys: [measurementFact.key],
      promptText:
        '门向测量须固定“站在大门处面向屋内”的口径；不同站位、手机壳、金属门、电器和钢筋可能干扰指南针',
      sources: ['入户测量站位与现场指南针干扰条件'],
    },
    {
      key: 'bazhai:limitation:north-reference',
      type: '北向基准边界',
      ownerFactKeys: [measurementFact.key],
      promptText: '磁北读数必须结合当地磁偏角换算真北；未声明北向基准时不得宣称坐向精确',
      sources: ['磁北、真北与磁偏角换算条件'],
    },
    {
      key: 'bazhai:limitation:building-reality',
      type: '建筑现实边界',
      ownerFactKeys: allFactKeys,
      promptText:
        '户型中心、门的实际使用方式、房间功能、采光通风、消防、承重、动线和居住需求不会由八宅盘自动得出',
      sources: ['传统方位事实与现场建筑条件分离原则'],
    },
    {
      key: 'bazhai:limitation:ming-house-layers',
      type: '命宅分层边界',
      ownerFactKeys: ['bazhai:calculation:comparison', ...directionFactKeys],
      promptText:
        '命卦八宫与宅卦八宫必须分开陈述；同方重合可作传统主证，异判时需说明采用哪套口径及现实理由',
      sources: ['命卦八宫与宅卦八宫逐方对照'],
    },
    {
      key: 'bazhai:limitation:high-risk-output',
      type: '高风险输出边界',
      ownerFactKeys: allFactKeys,
      promptText: '不得输出住宅吉凶总分、健康概率、财富增幅或保证有效的调整方案',
      sources: ['传统分类、测量事实与现实结果分离原则'],
    },
  ];
  return definitions.map((definition) => ({
    ...definition,
    status: '适用',
    limitation: LIMITATION_FACT_LIMITATION,
  }));
}

function buildSummaryFact(args: {
  calculationFact: BaZhaiCalculationFact;
  directionFacts: BaZhaiDirectionFact[];
  alignedDirections: BaZhaiDirectionComparison[];
  conflictingDirections: BaZhaiDirectionComparison[];
  measurementFact: BaZhaiMeasurementFact;
  measurementCandidateFacts: BaZhaiMeasurementCandidateFact[];
  counterEvidenceFacts: BaZhaiCounterEvidenceFact[];
  counterSummaryFact: BaZhaiCounterSummaryFact;
  limitationFacts: BaZhaiLimitationFact[];
}): BaZhaiSummaryFact {
  const hasHouse = args.calculationFact.status === '命宅完整';
  const measurementComplete =
    args.measurementFact.status === '未提供' ||
    (args.measurementFact.referenceStatus === '已声明' &&
      args.measurementCandidateFacts.length > 0);
  const structurallyComplete =
    args.calculationFact.yearBoundaryStatus !== '待复核' &&
    args.calculationFact.steps.length === 5 &&
    args.directionFacts.length === 8 &&
    args.directionFacts.every((item) => item.status === '已计算') &&
    measurementComplete;
  const status = structurallyComplete ? (hasHouse ? '命宅链完整' : '命卦链完整') : '证据链有缺口';
  return {
    key: 'bazhai:evidence-summary',
    status,
    factKeys: Array.from(
      new Set([
        args.calculationFact.key,
        ...args.calculationFact.steps.map((item) => item.key),
        ...args.directionFacts.map((item) => item.key),
        args.measurementFact.key,
        ...args.measurementCandidateFacts.map((item) => item.key),
        ...args.counterEvidenceFacts.map((item) => item.key),
        args.counterSummaryFact.key,
        ...args.limitationFacts.map((item) => item.key),
      ]),
    ),
    directionFactCount: args.directionFacts.length,
    alignedDirectionCount: args.alignedDirections.length,
    conflictingDirectionCount: args.conflictingDirections.length,
    measurementCandidateCount: args.measurementCandidateFacts.length,
    counterEvidenceCount: args.counterEvidenceFacts.length,
    limitationFactCount: args.limitationFacts.length,
    promptText: `证据链状态：${status}；逐方事实${args.directionFacts.length}项、同类方向${args.alignedDirections.length}项、命宅异判${args.conflictingDirections.length}项、测量候选${args.measurementCandidateFacts.length}项、反证${args.counterEvidenceFacts.length}项、限制${args.limitationFacts.length}项`,
    sources: ['命卦年界、命卦宅卦、八宫逐方、测量候选、反证与限制事实逐项汇总'],
    limitation: SUMMARY_FACT_LIMITATION,
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
      status: '已计算',
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
      calculationStepKeys: [
        'bazhai:calculation:eight-directions',
        ...(data.houseGua ? ['bazhai:calculation:comparison'] : []),
      ],
      sources: ['《八宅明镜》《阳宅十书》命卦与宅卦大游年八宫表', '后天八卦方位与中心度数表'],
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
  const counterEvidenceFacts = buildCounterEvidenceFacts(
    data,
    calculationFact,
    directionFacts,
    conflictingDirections,
    measurementFact,
  );
  const counterSummaryFact = buildCounterSummaryFact(counterEvidenceFacts);
  const counterEvidence = counterEvidenceFacts
    .filter(isCounterIssue)
    .map((item) => item.promptText);
  const limitationFacts = buildLimitationFacts(calculationFact, directionFacts, measurementFact);
  const limitations = limitationFacts.map((item) => item.promptText);
  const summaryFact = buildSummaryFact({
    calculationFact,
    directionFacts,
    alignedDirections,
    conflictingDirections,
    measurementFact,
    measurementCandidateFacts,
    counterEvidenceFacts,
    counterSummaryFact,
    limitationFacts,
  });
  const sources: BaZhaiEvidenceAnalysis['sources'] = [
    {
      title: '《八宅明镜》《阳宅十书》传统规则',
      evidence: '命卦、宅卦、东四西四分组与大游年八宫表',
      role: '传统规则来源',
    },
    {
      title: '日历与方位公共规则',
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
    ...counterEvidenceFacts.filter(isCounterIssue).map((item): PromptEvidenceItem => ({
      level: '反证',
      title: `八宅${item.type}${item.status}`,
      detail: `${item.promptText}；边界：${item.limitation}`,
      source: item.sources.join('、'),
      tags: [item.type, item.status],
    })),
    {
      level: '反证',
      title: `八宅反证汇总：${counterSummaryFact.status}`,
      detail: `${counterSummaryFact.promptText}；边界：${counterSummaryFact.limitation}`,
      source: counterSummaryFact.sources.join('、'),
      tags: ['反证汇总', counterSummaryFact.status],
    },
    {
      level: summaryFact.status === '证据链有缺口' ? '反证' : '辅证',
      title: `八宅证据汇总：${summaryFact.status}`,
      detail: `${summaryFact.promptText}；边界：${summaryFact.limitation}`,
      source: summaryFact.sources.join('、'),
      tags: ['证据汇总', summaryFact.status],
    },
    {
      level: '限制',
      title: '八宅传统模型与现场使用边界',
      detail: `${limitations.join('；')}；边界：${LIMITATION_FACT_LIMITATION}`,
      source: Array.from(new Set(limitationFacts.flatMap((item) => item.sources))).join('、'),
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
    `反证汇总：${counterSummaryFact.promptText}。`,
    `证据汇总：${summaryFact.promptText}。`,
    `解释限制：${limitations.join('；')}。`,
    `规则来源：${sources.map((item) => `${item.title}（${item.role}：${item.evidence}）`).join('；')}。`,
  ].join('\n');
  return {
    key: 'bazhai:evidence',
    status: '已计算',
    calculationFact,
    calculationSteps: calculationFact.steps,
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
    counterEvidenceFacts,
    counterSummaryFact,
    limitations,
    limitationFacts,
    summaryFact,
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
