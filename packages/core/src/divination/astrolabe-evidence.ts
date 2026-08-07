import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import type { AstrolabeData } from '../types/divination';
import type { HistoricalTimezoneEvidence } from '../calendar/historical-timezone';
import type { TrueSolarTimeEvidenceFields } from '../calendar/true-solar-time';

export interface AstrolabePositionFact {
  key: string;
  status: '已计算';
  kind: '星体与计算点' | '四轴' | '宫头';
  name: string;
  label: string;
  longitude: number;
  sign: string;
  degree: number;
  minute: number;
  house?: number;
  retrograde: boolean;
  formatted: string;
  promptText: string;
  sources: string[];
  limitation: '位置字段是黄经、星座、宫位与四轴的计算事实，只限定占星解释所依据的盘面位置，不单独证明人格、心理状态、现实事件或命运结果';
}

export interface AstrolabeAspectFact {
  key: string;
  status: '几何完整' | '旧记录缺几何量';
  body1PositionFactKey: string | null;
  body2PositionFactKey: string | null;
  positionFactKeys: string[];
  body1: string;
  body2: string;
  type: string;
  symbol: string;
  exactAngle?: number;
  actualAngle?: number;
  orb: number;
  allowedOrb?: number;
  normalizedOrbRatio: number;
  closeness: '紧密' | '中等' | '宽松';
  phase: '入相' | '出相' | '未判定';
  isOutOfSign?: boolean;
  promptText: string;
  source: string;
  sources: string[];
  limitation: '相位字段只描述两计算点在设定容许度内的几何关系；紧密等级、入相出相和跨星座状态不代表事件概率、匹配率、吉凶比例或必然结果';
}

export interface AstrolabeCalculationStep {
  key: string;
  stage: '输入固定' | '时间处理' | '盘面计算' | '相位筛选' | '分布汇总';
  status: '完整' | '缺少记录';
  inputs: Record<string, string | number | boolean>;
  outputs: Record<string, string | number | boolean>;
  dependsOnStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '单个计算步骤只记录该阶段已知输入、输出和依赖关系；步骤完整不证明底层天文模型无误，也不证明占星解释、人格诊断或现实结果';
}

export interface AstrolabePrimaryFact {
  key: string;
  role: '太阳' | '月亮' | '上升' | '天顶';
  status: '已定位';
  positionFactKey: string;
  label: string;
  promptText: string;
  sources: string[];
  limitation: '太阳、月亮、上升和天顶只作为本命盘核心位置主证；核心位置完整不代表人格诊断、事件概率、吉凶等级或命运结果';
}

export interface AstrolabePrimaryCoverageFact {
  key: 'astrolabe:primary-coverage';
  status: '完整' | '部分';
  expectedRoles: Array<'太阳' | '月亮' | '上升' | '天顶'>;
  actualRoles: Array<'太阳' | '月亮' | '上升' | '天顶'>;
  missingRoles: Array<'太阳' | '月亮' | '上升' | '天顶'>;
  primaryFactKeys: string[];
  positionFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '核心位置覆盖只说明太阳、月亮、上升和天顶是否有对应位置事实；缺失时不得补造星座、宫位、黄经或解释';
}

export interface AstrolabeCalculationFact {
  key: 'calculation:astrolabe:natal';
  status: '完整' | '部分';
  input: {
    dateTime: string;
    standardDateTime?: string;
    effectiveDateTime: string;
    location: string;
    timezone: number;
    timeZoneId?: string;
    isTrueSolarTime: boolean;
    trueSolarDateTime?: string;
  };
  models: {
    ephemeris: 'celestine';
    houseSystem: 'Placidus';
    aspectSelection: '主要相位按相位角与容许度筛选';
  };
  steps: AstrolabeCalculationStep[];
  missing: string[];
  promptText: string;
  sources: string[];
  limitation: '计算链只证明出生输入、时间处理、天文位置、宫位与相位筛选如何形成当前盘面，不证明占星解释有效性、人格诊断、现实事件或命运结果';
}

export interface AstrolabeDistributionFact {
  key: string;
  kind: '元素' | '模式' | '逆行' | '盘面格局';
  label: string;
  members: string[];
  memberPositionFactKeys: string[];
  count: number;
  status: '有成员' | '无成员';
  promptText: string;
  sources: string[];
  limitation: '分布字段只统计当前盘面的元素、模式、逆行与依赖库格局成员，不代表能量分数、人格强度、事件概率、吉凶等级或现实结果';
}

export interface AstrolabeIlluminationFact {
  key: 'astrolabe:illumination';
  status: '可用' | '缺失';
  referenceLocalDateTime?: string;
  latitude?: number;
  longitude?: number;
  solarAltitudeDegrees?: number;
  solarAzimuthDegrees?: number;
  solarDeclinationDegrees?: number;
  equationOfTimeMinutes?: number;
  apparentSolarNoonLocalDateTime?: string;
  method?: string;
  source?: string;
  assumptionTexts: string[];
  limitationTexts: string[];
  crossingFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '太阳高度、方位、赤纬、均时差与曙暮光只作为出生地点和时刻的天文背景；不直接证明人格、心理状态、现实事件、健康或吉凶结果';
}

export interface AstrolabeCounterEvidenceFact {
  key: string;
  type: '主要相位' | '逆行' | '盘面格局';
  status: '有可用证据' | '未见';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '反证事实只记录筛选范围内是否有主要相位、逆行点或依赖库盘面格局；未见不代表不存在其他角度关系或现实不利，有记录也不证明事件结果';
}

export interface AstrolabeCounterSummaryFact {
  key: 'astrolabe:counter-summary';
  status: '有未见项' | '全部有可列资料';
  factKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '反证汇总只说明当前筛选范围和依赖库输出的资料覆盖情况；不得据数量生成概率、匹配率、吉凶比例或强度分';
}

export interface AstrolabeLimitationFact {
  key: string;
  type:
    | '时区诊断'
    | '几何解释边界'
    | '相位强度边界'
    | '相位筛选边界'
    | '分布边界'
    | '宫位输入边界'
    | '光照边界';
  status: '适用';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '限制事实用于约束星盘位置、相位、分布、输入和光照资料可以支持的解释范围，不得被反向当作人格、事件或命运证据';
}

export interface AstrolabeSummaryFact {
  key: 'astrolabe:evidence-summary';
  status: '证据链完整' | '证据链有缺口';
  factKeys: string[];
  primaryFactCount: number;
  positionFactCount: number;
  aspectFactCount: number;
  distributionFactCount: number;
  counterEvidenceCount: number;
  limitationFactCount: number;
  promptText: string;
  sources: string[];
  limitation: '星盘证据汇总只统计输入、时间、位置、相位、核心点、分布、光照、反证与限制覆盖；不得按数量生成性格强度、吉凶等级、匹配率、事件概率、时间保证或命运结论';
}

export interface AstrolabeEvidenceAnalysis {
  key: 'astrolabe:evidence';
  status: '已计算';
  calculationFact: AstrolabeCalculationFact;
  calculationSteps: AstrolabeCalculationStep[];
  calculationChain: string[];
  timezoneFact?: HistoricalTimezoneEvidence;
  trueSolarTimeFact?: TrueSolarTimeEvidenceFields;
  primaryCoverageFact: AstrolabePrimaryCoverageFact;
  primaryPointFacts: AstrolabePrimaryFact[];
  primaryFacts: string[];
  positionFacts: AstrolabePositionFact[];
  aspectFacts: AstrolabeAspectFact[];
  planetFacts: string[];
  angleFacts: string[];
  houseFacts: string[];
  distributionEvidenceFacts: AstrolabeDistributionFact[];
  distributionFacts: string[];
  illuminationFact: AstrolabeIlluminationFact;
  illuminationFacts: string[];
  supportingFacts: string[];
  counterEvidence: string[];
  counterEvidenceFacts: AstrolabeCounterEvidenceFact[];
  counterSummaryFact: AstrolabeCounterSummaryFact;
  limitations: string[];
  limitationFacts: AstrolabeLimitationFact[];
  summaryFact: AstrolabeSummaryFact;
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: string[];
}

const POSITION_FACT_LIMITATION =
  '位置字段是黄经、星座、宫位与四轴的计算事实，只限定占星解释所依据的盘面位置，不单独证明人格、心理状态、现实事件或命运结果' as const;

const ASPECT_FACT_LIMITATION =
  '相位字段只描述两计算点在设定容许度内的几何关系；紧密等级、入相出相和跨星座状态不代表事件概率、匹配率、吉凶比例或必然结果' as const;
const CALCULATION_FACT_LIMITATION =
  '计算链只证明出生输入、时间处理、天文位置、宫位与相位筛选如何形成当前盘面，不证明占星解释有效性、人格诊断、现实事件或命运结果' as const;
const DISTRIBUTION_FACT_LIMITATION =
  '分布字段只统计当前盘面的元素、模式、逆行与依赖库格局成员，不代表能量分数、人格强度、事件概率、吉凶等级或现实结果' as const;
const STEP_FACT_LIMITATION =
  '单个计算步骤只记录该阶段已知输入、输出和依赖关系；步骤完整不证明底层天文模型无误，也不证明占星解释、人格诊断或现实结果' as const;
const PRIMARY_FACT_LIMITATION =
  '太阳、月亮、上升和天顶只作为本命盘核心位置主证；核心位置完整不代表人格诊断、事件概率、吉凶等级或命运结果' as const;
const PRIMARY_COVERAGE_LIMITATION =
  '核心位置覆盖只说明太阳、月亮、上升和天顶是否有对应位置事实；缺失时不得补造星座、宫位、黄经或解释' as const;
const ILLUMINATION_FACT_LIMITATION =
  '太阳高度、方位、赤纬、均时差与曙暮光只作为出生地点和时刻的天文背景；不直接证明人格、心理状态、现实事件、健康或吉凶结果' as const;
const COUNTER_FACT_LIMITATION =
  '反证事实只记录筛选范围内是否有主要相位、逆行点或依赖库盘面格局；未见不代表不存在其他角度关系或现实不利，有记录也不证明事件结果' as const;
const COUNTER_SUMMARY_LIMITATION =
  '反证汇总只说明当前筛选范围和依赖库输出的资料覆盖情况；不得据数量生成概率、匹配率、吉凶比例或强度分' as const;
const LIMITATION_FACT_LIMITATION =
  '限制事实用于约束星盘位置、相位、分布、输入和光照资料可以支持的解释范围，不得被反向当作人格、事件或命运证据' as const;
const SUMMARY_FACT_LIMITATION =
  '星盘证据汇总只统计输入、时间、位置、相位、核心点、分布、光照、反证与限制覆盖；不得按数量生成性格强度、吉凶等级、匹配率、事件概率、时间保证或命运结论' as const;
const ASPECT_BODY_ALIASES: Record<string, string> = {
  'True North Node': '北交点',
  'Mean North Node': '北交点',
  'True South Node': '南交点',
  'Mean South Node': '南交点',
};

function classifyCloseness(ratio: number): AstrolabeAspectFact['closeness'] {
  if (ratio <= 1 / 3) return '紧密';
  if (ratio <= 2 / 3) return '中等';
  return '宽松';
}

function buildPositionFact(
  item: AstrolabeData['planets'][number],
  kind: AstrolabePositionFact['kind'],
): AstrolabePositionFact {
  const house = kind === '四轴' ? undefined : item.house || undefined;
  const promptText = `${item.label}${item.formatted}，黄经${item.longitude.toFixed(3)}°${house ? `，第${house}宫` : kind === '四轴' ? '，四轴点' : ''}${item.retrograde ? '，逆行' : ''}`;
  return {
    key: `${kind}:${item.name}`,
    status: '已计算',
    kind,
    name: item.name,
    label: item.label,
    longitude: item.longitude,
    sign: item.sign,
    degree: item.degree,
    minute: item.minute,
    ...(house ? { house } : {}),
    retrograde: Boolean(item.retrograde),
    formatted: item.formatted,
    promptText,
    sources: [
      kind === '宫头' ? 'celestine Placidus 十二宫宫头计算' : 'celestine 黄道位置计算',
      kind === '四轴' ? '出生地点、时间与地平子午圈四轴计算' : '出生时间、地点与黄经落宫计算',
    ],
    limitation: POSITION_FACT_LIMITATION,
  };
}

function buildAspectFact(
  item: AstrolabeData['aspects'][number],
  positionFacts: AstrolabePositionFact[],
): AstrolabeAspectFact {
  const normalizedOrbRatio =
    item.normalizedOrbRatio ??
    (item.allowedOrb && item.allowedOrb > 0 ? Number((item.orb / item.allowedOrb).toFixed(4)) : 1);
  const closeness = item.closeness ?? classifyCloseness(normalizedOrbRatio);
  const phase = item.applying === null ? '未判定' : item.applying ? '入相' : '出相';
  const body1Lookup = ASPECT_BODY_ALIASES[item.body1] ?? item.body1;
  const body2Lookup = ASPECT_BODY_ALIASES[item.body2] ?? item.body2;
  const body1PositionFacts = positionFacts.filter(
    (fact) => fact.label === body1Lookup || fact.name === body1Lookup,
  );
  const body2PositionFacts = positionFacts.filter(
    (fact) => fact.label === body2Lookup || fact.name === body2Lookup,
  );
  const body1PositionFactKey = body1PositionFacts[0]?.key ?? null;
  const body2PositionFactKey = body2PositionFacts[0]?.key ?? null;
  const positionFactKeys = [...body1PositionFacts, ...body2PositionFacts]
    .map((fact) => fact.key)
    .filter((key, index, values) => values.indexOf(key) === index);
  const geometry =
    item.actualAngle !== undefined && item.exactAngle !== undefined && item.allowedOrb !== undefined
      ? `实际夹角${item.actualAngle.toFixed(2)}°，精确角${item.exactAngle.toFixed(2)}°，允许容许度${item.allowedOrb.toFixed(2)}°，距精确角偏差${item.orb.toFixed(2)}°`
      : `旧结果未记录实际夹角、精确角或允许容许度，仅保留距精确角偏差${item.orb.toFixed(2)}°`;
  return {
    key: `${item.body1}:${item.type}:${item.body2}`,
    status:
      item.actualAngle !== undefined &&
      item.exactAngle !== undefined &&
      item.allowedOrb !== undefined
        ? '几何完整'
        : '旧记录缺几何量',
    body1PositionFactKey,
    body2PositionFactKey,
    positionFactKeys,
    body1: item.body1,
    body2: item.body2,
    type: item.type,
    symbol: item.symbol,
    exactAngle: item.exactAngle,
    actualAngle: item.actualAngle,
    orb: item.orb,
    allowedOrb: item.allowedOrb,
    normalizedOrbRatio,
    closeness,
    phase,
    isOutOfSign: item.isOutOfSign,
    promptText: `${item.body1}${item.symbol}${item.body2}（${item.type}）：${geometry}，${closeness}等级，归一化容许度位置${normalizedOrbRatio.toFixed(2)}，${phase}${item.isOutOfSign ? '，跨星座相位' : ''}`,
    source: item.source ?? 'celestine 本命相位计算',
    sources: [item.source ?? 'celestine 本命相位计算', '两计算点位置事实与相位几何量核验'],
    limitation: ASPECT_FACT_LIMITATION,
  };
}

function buildCalculationFact(
  data: Omit<AstrolabeData, 'evidenceAnalysis'>,
): AstrolabeCalculationFact {
  const isTrueSolarTime = Boolean(data.birth.isTrueSolarTime);
  const geometricRecordCount = data.aspects.filter(
    (item) =>
      item.actualAngle !== undefined &&
      item.exactAngle !== undefined &&
      item.allowedOrb !== undefined,
  ).length;
  const effectiveDateTime = data.birth.standardDateTime ?? data.birth.dateTime;
  const missing = [
    !data.birth.dateTime ? '出生民用时间' : '',
    !data.birth.location ? '出生地点' : '',
    !Number.isFinite(data.birth.timezone) ? '出生时区' : '',
    isTrueSolarTime && !data.birth.trueSolarDateTime ? '真太阳时校正结果' : '',
    data.planets.length === 0 ? '星体与计算点位置' : '',
    data.angles.length < 4 ? '完整四轴位置' : '',
    data.houses.length < 12 ? '完整十二宫宫头' : '',
    data.aspects.length > 0 && geometricRecordCount < data.aspects.length ? '完整相位几何量' : '',
  ].filter(Boolean);
  const steps: AstrolabeCalculationStep[] = [
    {
      key: 'astrolabe:calculation:input',
      stage: '输入固定',
      status:
        data.birth.dateTime && data.birth.location && Number.isFinite(data.birth.timezone)
          ? '完整'
          : '缺少记录',
      inputs: {
        dateTime: data.birth.dateTime,
        location: data.birth.location,
        timezone: data.birth.timezone,
        ...(data.birth.timeZoneId ? { timeZoneId: data.birth.timeZoneId } : {}),
      },
      outputs: {
        standardDateTime: data.birth.standardDateTime ?? data.birth.dateTime,
      },
      dependsOnStepKeys: [],
      promptText: `固定出生民用时间${data.birth.standardDateTime ?? data.birth.dateTime}、地点${data.birth.location}与UTC${data.birth.timezone >= 0 ? '+' : ''}${data.birth.timezone}`,
      sources: ['出生时间与地点输入', '历史时区或固定 UTC 偏移解析'],
      limitation: STEP_FACT_LIMITATION,
    },
    {
      key: 'astrolabe:calculation:time',
      stage: '时间处理',
      status: !isTrueSolarTime || data.birth.trueSolarDateTime ? '完整' : '缺少记录',
      inputs: {
        standardDateTime: data.birth.standardDateTime ?? data.birth.dateTime,
        isTrueSolarTime,
      },
      outputs: {
        effectiveDateTime,
        ...(data.birth.trueSolarDateTime
          ? { trueSolarReferenceDateTime: data.birth.trueSolarDateTime }
          : {}),
      },
      dependsOnStepKeys: ['astrolabe:calculation:input'],
      promptText: isTrueSolarTime
        ? data.birth.trueSolarDateTime
          ? `采用民用出生时间${effectiveDateTime}进入现代星历计算；真太阳时${data.birth.trueSolarDateTime}仅作为传统时间参考，不改写实际出生瞬间`
          : `已标记附带真太阳时参考，但旧结果未记录参考时刻；现代星历仍采用民用出生时间${effectiveDateTime}`
        : '采用输入民用时间进入星盘计算',
      sources: isTrueSolarTime
        ? ['统一出生真太阳时换算资料', '当前星盘出生时间记录']
        : ['当前星盘出生民用时间记录'],
      limitation: STEP_FACT_LIMITATION,
    },
    {
      key: 'astrolabe:calculation:chart',
      stage: '盘面计算',
      status:
        data.planets.length > 0 && data.angles.length >= 4 && data.houses.length >= 12
          ? '完整'
          : '缺少记录',
      inputs: { effectiveDateTime, location: data.birth.location },
      outputs: {
        positionCount: data.planets.length,
        angleCount: data.angles.length,
        houseCuspCount: data.houses.length,
      },
      dependsOnStepKeys: ['astrolabe:calculation:time'],
      promptText: `由 celestine 计算${data.planets.length}个星体与计算点、${data.angles.length}个四轴点和${data.houses.length}个 Placidus 宫头`,
      sources: ['celestine 黄道位置计算', 'celestine Placidus 宫位与四轴计算'],
      limitation: STEP_FACT_LIMITATION,
    },
    {
      key: 'astrolabe:calculation:aspects',
      stage: '相位筛选',
      status:
        data.aspects.length === 0 || geometricRecordCount === data.aspects.length
          ? '完整'
          : '缺少记录',
      inputs: { positionCount: data.planets.length + data.angles.length },
      outputs: {
        selectedAspectCount: data.aspects.length,
        geometricRecordCount,
      },
      dependsOnStepKeys: ['astrolabe:calculation:chart'],
      promptText: `按相位角与容许度筛选${data.aspects.length}组主要相位，并保留可用的角度偏差、紧密等级和入相出相状态`,
      sources: ['celestine 本命相位计算', '相位几何量与容许度核验'],
      limitation: STEP_FACT_LIMITATION,
    },
    {
      key: 'astrolabe:calculation:distribution',
      stage: '分布汇总',
      status: '完整',
      inputs: {
        planetCount: data.planets.length,
        angleCount: data.angles.length,
      },
      outputs: {
        elementCategoryCount: Object.keys(data.summary.elements).length,
        modalityCategoryCount: Object.keys(data.summary.modalities).length,
        retrogradeCount: data.summary.retrograde.length,
        patternCount: data.summary.patterns.length,
      },
      dependsOnStepKeys: ['astrolabe:calculation:chart'],
      promptText: '汇总元素、模式、逆行与依赖库盘面格局，作为盘面构成辅证',
      sources: ['celestine 盘面元素、模式、逆行与格局汇总'],
      limitation: STEP_FACT_LIMITATION,
    },
  ];
  return {
    key: 'calculation:astrolabe:natal',
    status: missing.length === 0 ? '完整' : '部分',
    input: {
      dateTime: data.birth.dateTime,
      standardDateTime: data.birth.standardDateTime,
      effectiveDateTime,
      location: data.birth.location,
      timezone: data.birth.timezone,
      timeZoneId: data.birth.timeZoneId,
      isTrueSolarTime,
      trueSolarDateTime: data.birth.trueSolarDateTime,
    },
    models: {
      ephemeris: 'celestine',
      houseSystem: 'Placidus',
      aspectSelection: '主要相位按相位角与容许度筛选',
    },
    steps,
    missing,
    promptText: steps.map((item) => item.promptText).join(' → '),
    sources: [
      '出生时间、地点与时区输入记录',
      '历史时区与真太阳时换算资料',
      'celestine 黄道位置、Placidus 宫位、四轴与相位计算',
    ],
    limitation: CALCULATION_FACT_LIMITATION,
  };
}

function buildDistributionFacts(
  data: Omit<AstrolabeData, 'evidenceAnalysis'>,
  positionFacts: AstrolabePositionFact[],
): AstrolabeDistributionFact[] {
  const build = (
    key: string,
    kind: AstrolabeDistributionFact['kind'],
    label: string,
    members: string[],
    source: string,
  ): AstrolabeDistributionFact => ({
    key,
    kind,
    label,
    members,
    memberPositionFactKeys: members
      .map(
        (member) =>
          positionFacts.find((fact) => fact.label === member || fact.name === member)?.key ?? '',
      )
      .filter(Boolean),
    count: members.length,
    status: members.length ? '有成员' : '无成员',
    promptText: `${label}：${members.join('、') || '无'}`,
    sources: [source],
    limitation: DISTRIBUTION_FACT_LIMITATION,
  });
  return [
    ...Object.entries(data.summary.elements).map(([element, members]) =>
      build(
        `distribution:element:${element}`,
        '元素',
        `${element}元素`,
        members,
        'celestine 盘面元素归类',
      ),
    ),
    ...Object.entries(data.summary.modalities).map(([modality, members]) =>
      build(
        `distribution:modality:${modality}`,
        '模式',
        `${modality}模式`,
        members,
        'celestine 盘面模式归类',
      ),
    ),
    build(
      'distribution:retrograde',
      '逆行',
      '逆行点',
      data.summary.retrograde,
      'celestine 星体视运动状态汇总',
    ),
    build(
      'distribution:patterns',
      '盘面格局',
      '依赖库盘面格局',
      data.summary.patterns,
      'celestine 盘面格局汇总',
    ),
  ];
}

function buildPrimaryPointFacts(positionFacts: AstrolabePositionFact[]): {
  facts: AstrolabePrimaryFact[];
  coverage: AstrolabePrimaryCoverageFact;
} {
  const specs: Array<{ role: AstrolabePrimaryFact['role']; name: string }> = [
    { role: '太阳', name: 'Sun' },
    { role: '月亮', name: 'Moon' },
    { role: '上升', name: 'Ascendant' },
    { role: '天顶', name: 'Midheaven' },
  ];
  const facts = specs.flatMap(({ role, name }) => {
    const positionFact = positionFacts.find((fact) => fact.name === name);
    if (!positionFact) return [];
    return [
      {
        key: `astrolabe:primary:${name}`,
        role,
        status: '已定位' as const,
        positionFactKey: positionFact.key,
        label: positionFact.label,
        promptText: positionFact.promptText,
        sources: ['太阳、月亮、上升和天顶核心位置选择规则', ...positionFact.sources],
        limitation: PRIMARY_FACT_LIMITATION,
      },
    ];
  });
  const actualRoles = facts.map((fact) => fact.role);
  const expectedRoles = specs.map((spec) => spec.role);
  const missingRoles = expectedRoles.filter((role) => !actualRoles.includes(role));
  return {
    facts,
    coverage: {
      key: 'astrolabe:primary-coverage',
      status: missingRoles.length ? '部分' : '完整',
      expectedRoles,
      actualRoles,
      missingRoles,
      primaryFactKeys: facts.map((fact) => fact.key),
      positionFactKeys: facts.map((fact) => fact.positionFactKey),
      promptText: missingRoles.length
        ? `核心位置已定位${actualRoles.join('、') || '无'}，缺少${missingRoles.join('、')}，不得补造缺失位置`
        : '太阳、月亮、上升和天顶四项核心位置均已定位',
      sources: ['本命盘核心位置选择规则', '逐项星体与四轴位置事实'],
      limitation: PRIMARY_COVERAGE_LIMITATION,
    },
  };
}

function buildIlluminationFact(
  data: Omit<AstrolabeData, 'evidenceAnalysis'>,
): AstrolabeIlluminationFact {
  const illumination = data.solarIllumination;
  if (!illumination) {
    return {
      key: 'astrolabe:illumination',
      status: '缺失',
      assumptionTexts: [],
      limitationTexts: [],
      crossingFactKeys: [],
      promptText:
        '现有资料未附出生地点太阳光照背景，不能补造太阳高度、方位、赤纬、均时差或日照时刻',
      sources: ['出生地点太阳光照资料核验'],
      limitation: ILLUMINATION_FACT_LIMITATION,
    };
  }
  const crossingFacts = [
    illumination.sunriseSunset,
    illumination.civilTwilight,
    illumination.nauticalTwilight,
    illumination.astronomicalTwilight,
  ];
  return {
    key: 'astrolabe:illumination',
    status: '可用',
    referenceLocalDateTime: illumination.referenceLocalDateTime,
    latitude: illumination.latitude,
    longitude: illumination.longitude,
    solarAltitudeDegrees: illumination.solarAltitudeDegrees,
    solarAzimuthDegrees: illumination.solarAzimuthDegrees,
    solarDeclinationDegrees: illumination.solarDeclinationDegrees,
    equationOfTimeMinutes: illumination.equationOfTimeMinutes,
    apparentSolarNoonLocalDateTime: illumination.apparentSolarNoonLocalDateTime,
    method: illumination.method,
    source: illumination.source,
    assumptionTexts: [...illumination.assumptions],
    limitationTexts: [...illumination.limitations],
    crossingFactKeys: crossingFacts.map((fact) => fact.key),
    promptText: [
      `出生时刻太阳高度${illumination.solarAltitudeDegrees.toFixed(3)}°、方位角${illumination.solarAzimuthDegrees.toFixed(3)}°、赤纬${illumination.solarDeclinationDegrees.toFixed(3)}°`,
      `均时差${illumination.equationOfTimeMinutes.toFixed(3)}分钟，视太阳正午${illumination.apparentSolarNoonLocalDateTime}`,
      `光照计算方法：${illumination.method}；来源：${illumination.source}`,
    ].join('；'),
    sources: [illumination.source, '出生地点与时刻太阳光照计算资料'],
    limitation: ILLUMINATION_FACT_LIMITATION,
  };
}

function buildCounterEvidenceFacts(
  aspectFacts: AstrolabeAspectFact[],
  distributionFacts: AstrolabeDistributionFact[],
): AstrolabeCounterEvidenceFact[] {
  const retrogradeFact = distributionFacts.find((fact) => fact.key === 'distribution:retrograde');
  const patternFact = distributionFacts.find((fact) => fact.key === 'distribution:patterns');
  return [
    {
      key: 'astrolabe:counter:aspects',
      type: '主要相位',
      status: aspectFacts.length ? '有可用证据' : '未见',
      ownerFactKeys: aspectFacts.length
        ? aspectFacts.map((fact) => fact.key)
        : ['astrolabe:calculation:aspects'],
      promptText: aspectFacts.length
        ? `当前筛选范围内列出${aspectFacts.length}组主要相位`
        : '当前筛选范围内未见主要相位',
      sources: ['主要相位筛选结果', '相位几何量与容许度记录'],
      limitation: COUNTER_FACT_LIMITATION,
    },
    {
      key: 'astrolabe:counter:retrograde',
      type: '逆行',
      status: retrogradeFact?.count ? '有可用证据' : '未见',
      ownerFactKeys: retrogradeFact
        ? [retrogradeFact.key, ...retrogradeFact.memberPositionFactKeys]
        : ['distribution:retrograde'],
      promptText: retrogradeFact?.count
        ? `盘面列出${retrogradeFact.count}个逆行点`
        : '未见逆行星体',
      sources: ['盘面逆行状态汇总', '逐项位置事实'],
      limitation: COUNTER_FACT_LIMITATION,
    },
    {
      key: 'astrolabe:counter:patterns',
      type: '盘面格局',
      status: patternFact?.count ? '有可用证据' : '未见',
      ownerFactKeys: patternFact ? [patternFact.key] : ['distribution:patterns'],
      promptText: patternFact?.count
        ? `依赖库列出${patternFact.count}项盘面格局`
        : '未见依赖库标记的主要盘面格局',
      sources: ['依赖库盘面格局汇总'],
      limitation: COUNTER_FACT_LIMITATION,
    },
  ];
}

function buildCounterSummaryFact(
  counterEvidenceFacts: AstrolabeCounterEvidenceFact[],
): AstrolabeCounterSummaryFact {
  const missing = counterEvidenceFacts.filter((fact) => fact.status === '未见');
  return {
    key: 'astrolabe:counter-summary',
    status: missing.length ? '有未见项' : '全部有可列资料',
    factKeys: missing.map((fact) => fact.key),
    promptText: missing.length
      ? `当前筛选范围内未见${missing.map((fact) => fact.type).join('、')}；未见不等于不存在其他关系，也不直接代表现实不利`
      : '主要相位、逆行或盘面格局均有可列资料；不得据数量直接定性',
    sources: ['主要相位、逆行与盘面格局逐项汇总'],
    limitation: COUNTER_SUMMARY_LIMITATION,
  };
}

function buildLimitationFacts(
  data: Omit<AstrolabeData, 'evidenceAnalysis'>,
  calculationFact: AstrolabeCalculationFact,
  positionFacts: AstrolabePositionFact[],
  aspectFacts: AstrolabeAspectFact[],
  distributionFacts: AstrolabeDistributionFact[],
  illuminationFact: AstrolabeIlluminationFact,
): AstrolabeLimitationFact[] {
  const facts: AstrolabeLimitationFact[] = [];
  (data.birth.timezoneDiagnostics ?? []).forEach((diagnostic, index) => {
    facts.push({
      key: `astrolabe:limitation:timezone:${index + 1}`,
      type: '时区诊断',
      status: '适用',
      ownerFactKeys: ['astrolabe:calculation:input', 'astrolabe:calculation:time'],
      promptText: diagnostic,
      sources: ['历史时区与固定 UTC 偏移诊断'],
      limitation: LIMITATION_FACT_LIMITATION,
    });
  });
  const push = (
    key: string,
    type: AstrolabeLimitationFact['type'],
    promptText: string,
    ownerFactKeys: string[],
    sources: string[],
  ) =>
    facts.push({
      key,
      type,
      status: '适用',
      ownerFactKeys: Array.from(
        new Set(ownerFactKeys.length ? ownerFactKeys : [calculationFact.key]),
      ),
      promptText,
      sources,
      limitation: LIMITATION_FACT_LIMITATION,
    });
  push(
    'astrolabe:limitation:geometry',
    '几何解释边界',
    '星体、宫位与相位是几何和规则计算结果，不等于现实事件、人格诊断或命运必然性',
    [
      calculationFact.key,
      ...positionFacts.map((fact) => fact.key),
      ...aspectFacts.map((fact) => fact.key),
    ],
    ['位置、宫位与相位几何事实'],
  );
  push(
    'astrolabe:limitation:aspect-closeness',
    '相位强度边界',
    '相位紧密等级只描述容许度内的位置，不代表事件概率、匹配率、吉凶比例或作用强度百分比',
    aspectFacts.map((fact) => fact.key),
    ['相位容许度与紧密等级计算'],
  );
  push(
    'astrolabe:limitation:aspect-ratio',
    '相位强度边界',
    '归一化容许度位置不代表事件概率、匹配率、吉凶比例或必然结果',
    aspectFacts.map((fact) => fact.key),
    ['相位归一化容许度记录'],
  );
  push(
    'astrolabe:limitation:aspect-selection',
    '相位筛选边界',
    '结果只保留筛选后排序靠前的十二组相位；未列出不等于两点之间不存在其他角度关系',
    ['astrolabe:calculation:aspects', ...aspectFacts.map((fact) => fact.key)],
    ['主要相位筛选范围与排序记录'],
  );
  push(
    'astrolabe:limitation:distribution',
    '分布边界',
    '元素、模式、逆行数量只描述盘面构成，不生成能量分数或综合吉凶等级',
    distributionFacts.map((fact) => fact.key),
    ['元素、模式、逆行与盘面格局汇总'],
  );
  push(
    'astrolabe:limitation:houses',
    '宫位输入边界',
    'Placidus 宫位和出生时刻高度相关，地点、时区或时间输入错误会直接改变四轴与落宫',
    [
      calculationFact.key,
      ...positionFacts
        .filter((fact) => fact.kind === '四轴' || fact.kind === '宫头')
        .map((fact) => fact.key),
    ],
    ['出生地点、时间、时区与 Placidus 宫位计算'],
  );
  push(
    'astrolabe:limitation:illumination',
    '光照边界',
    '太阳光照资料只作地点相关的天文背景，不直接推出性格或吉凶结论',
    [illuminationFact.key, ...illuminationFact.crossingFactKeys],
    ['地点相关太阳光照计算资料'],
  );
  return facts;
}

function buildSummaryFact(args: {
  calculationFact: AstrolabeCalculationFact;
  timezoneFact?: HistoricalTimezoneEvidence;
  trueSolarTimeFact?: TrueSolarTimeEvidenceFields;
  primaryCoverageFact: AstrolabePrimaryCoverageFact;
  primaryPointFacts: AstrolabePrimaryFact[];
  positionFacts: AstrolabePositionFact[];
  aspectFacts: AstrolabeAspectFact[];
  distributionFacts: AstrolabeDistributionFact[];
  illuminationFact: AstrolabeIlluminationFact;
  counterEvidenceFacts: AstrolabeCounterEvidenceFact[];
  counterSummaryFact: AstrolabeCounterSummaryFact;
  limitationFacts: AstrolabeLimitationFact[];
}): AstrolabeSummaryFact {
  const status =
    args.calculationFact.status === '完整' &&
    (!args.timezoneFact ||
      (!args.timezoneFact.offsetConflict &&
        (args.timezoneFact.status === 'unique' ||
          args.timezoneFact.ambiguityResolvedByFixedOffset))) &&
    (!args.trueSolarTimeFact || args.trueSolarTimeFact.status === '已计算') &&
    args.primaryCoverageFact.status === '完整' &&
    args.positionFacts.length > 0 &&
    args.aspectFacts.every((item) => item.status === '几何完整') &&
    args.illuminationFact.status === '可用'
      ? '证据链完整'
      : '证据链有缺口';
  return {
    key: 'astrolabe:evidence-summary',
    status,
    factKeys: Array.from(
      new Set([
        args.calculationFact.key,
        ...args.calculationFact.steps.map((item) => item.key),
        ...(args.timezoneFact
          ? [
              args.timezoneFact.key,
              ...args.timezoneFact.calculationSteps.map((item) => item.key),
              ...args.timezoneFact.diagnosticFacts.map((item) => item.key),
              args.timezoneFact.diagnosticSummaryFact.key,
              args.timezoneFact.summaryFact.key,
              ...args.timezoneFact.limitationFacts.map((item) => item.key),
            ]
          : []),
        ...(args.trueSolarTimeFact
          ? [
              args.trueSolarTimeFact.key,
              ...args.trueSolarTimeFact.calculationSteps.map((item) => item.key),
              ...args.trueSolarTimeFact.correctionFacts.map((item) => item.key),
              args.trueSolarTimeFact.summaryFact.key,
              ...args.trueSolarTimeFact.limitationFacts.map((item) => item.key),
            ]
          : []),
        args.primaryCoverageFact.key,
        ...args.primaryPointFacts.map((item) => item.key),
        ...args.positionFacts.map((item) => item.key),
        ...args.aspectFacts.map((item) => item.key),
        ...args.distributionFacts.map((item) => item.key),
        args.illuminationFact.key,
        ...args.illuminationFact.crossingFactKeys,
        ...args.counterEvidenceFacts.map((item) => item.key),
        args.counterSummaryFact.key,
        ...args.limitationFacts.map((item) => item.key),
      ]),
    ),
    primaryFactCount: args.primaryPointFacts.length,
    positionFactCount: args.positionFacts.length,
    aspectFactCount: args.aspectFacts.length,
    distributionFactCount: args.distributionFacts.length,
    counterEvidenceCount: args.counterEvidenceFacts.length,
    limitationFactCount: args.limitationFacts.length,
    promptText: `证据链状态：${status}；核心位置${args.primaryPointFacts.length}项、位置${args.positionFacts.length}项、相位${args.aspectFacts.length}项、分布${args.distributionFacts.length}项、反证${args.counterEvidenceFacts.length}项、限制${args.limitationFacts.length}项`,
    sources: ['星盘输入、时间、位置、相位、核心点、分布、光照、反证与限制事实逐项汇总'],
    limitation: SUMMARY_FACT_LIMITATION,
  };
}

export function analyzeAstrolabeEvidence(
  data: Omit<AstrolabeData, 'evidenceAnalysis'>,
): AstrolabeEvidenceAnalysis {
  const positionFacts = [
    ...data.planets.map((item) => buildPositionFact(item, '星体与计算点')),
    ...data.angles.map((item) => buildPositionFact(item, '四轴')),
    ...data.houses.map((item) => buildPositionFact(item, '宫头')),
  ];
  const aspectFacts = data.aspects.map((item) => buildAspectFact(item, positionFacts));
  const { facts: primaryPointFacts, coverage: primaryCoverageFact } =
    buildPrimaryPointFacts(positionFacts);
  const calculationFact = buildCalculationFact(data);
  const calculationChain = calculationFact.steps.map((item) => item.promptText);
  const primaryFacts = primaryPointFacts.map((fact) => {
    const positionFact = positionFacts.find((item) => item.key === fact.positionFactKey)!;
    return `${positionFact.label}${positionFact.formatted}${positionFact.house ? `，落第${positionFact.house}宫` : ''}`;
  });
  const planetFacts = positionFacts
    .filter((item) => item.kind === '星体与计算点')
    .map((item) => item.promptText);
  const angleFacts = positionFacts
    .filter((item) => item.kind === '四轴')
    .map((item) => item.promptText);
  const houseFacts = positionFacts
    .filter((item) => item.kind === '宫头')
    .map((item) => item.promptText);
  const distributionEvidenceFacts = buildDistributionFacts(data, positionFacts);
  const distributionFacts = distributionEvidenceFacts.map((item) => item.promptText);
  const illuminationFact = buildIlluminationFact(data);
  const illuminationFacts =
    illuminationFact.status === '可用'
      ? [
          `出生时刻太阳高度${illuminationFact.solarAltitudeDegrees!.toFixed(3)}°、方位角${illuminationFact.solarAzimuthDegrees!.toFixed(3)}°、赤纬${illuminationFact.solarDeclinationDegrees!.toFixed(3)}°`,
          `均时差${illuminationFact.equationOfTimeMinutes!.toFixed(3)}分钟，视太阳正午${illuminationFact.apparentSolarNoonLocalDateTime}`,
          `光照算法：${illuminationFact.method}；来源：${illuminationFact.source}`,
        ]
      : [];
  const supportingFacts = aspectFacts.map((item) => item.promptText);
  const timezoneFact = data.birth.timezoneEvidence;
  const trueSolarTimeFact = data.birth.trueSolarEvidence;
  const counterEvidenceFacts = buildCounterEvidenceFacts(aspectFacts, distributionEvidenceFacts);
  const counterSummaryFact = buildCounterSummaryFact(counterEvidenceFacts);
  const counterEvidence = counterEvidenceFacts
    .filter((fact) => fact.status === '未见')
    .map((fact) => fact.promptText);
  const limitationFacts = buildLimitationFacts(
    data,
    calculationFact,
    positionFacts,
    aspectFacts,
    distributionEvidenceFacts,
    illuminationFact,
  );
  const limitations = limitationFacts.map((fact) => fact.promptText);
  const summaryFact = buildSummaryFact({
    calculationFact,
    timezoneFact,
    trueSolarTimeFact,
    primaryCoverageFact,
    primaryPointFacts,
    positionFacts,
    aspectFacts,
    distributionFacts: distributionEvidenceFacts,
    illuminationFact,
    counterEvidenceFacts,
    counterSummaryFact,
    limitationFacts,
  });
  const items: PromptEvidenceItem[] = [
    {
      level: calculationFact.status === '完整' ? '辅证' : '反证',
      title: '星盘输入与计算链事实',
      detail: `${calculationFact.promptText}；${calculationFact.missing.length ? `缺少记录：${calculationFact.missing.join('、')}；` : ''}边界：${calculationFact.limitation}`,
      source: calculationFact.sources.join('、'),
      tags: ['计算链', calculationFact.status, calculationFact.models.houseSystem],
    },
    ...(timezoneFact
      ? [
          {
            level:
              timezoneFact.offsetConflict ||
              (timezoneFact.status === 'ambiguous' && !timezoneFact.ambiguityResolvedByFixedOffset)
                ? ('反证' as const)
                : ('辅证' as const),
            title: '历史时区映射与诊断',
            detail: `${timezoneFact.promptText}；诊断边界：${timezoneFact.diagnosticSummaryFact.limitation}`,
            source: timezoneFact.source,
            tags: ['历史时区', timezoneFact.status, timezoneFact.diagnosticSummaryFact.status],
          },
        ]
      : []),
    ...(trueSolarTimeFact
      ? [
          {
            level: trueSolarTimeFact.status === '已计算' ? ('辅证' as const) : ('反证' as const),
            title: '真太阳时校正证据',
            detail: `${trueSolarTimeFact.promptText}；边界：${trueSolarTimeFact.summaryFact.limitation}`,
            source: trueSolarTimeFact.source,
            tags: ['真太阳时', trueSolarTimeFact.status, trueSolarTimeFact.summaryFact.status],
          },
        ]
      : []),
    {
      level: primaryCoverageFact.status === '完整' ? '辅证' : '反证',
      title: '太阳月亮上升天顶覆盖',
      detail: `${primaryCoverageFact.promptText}；边界：${primaryCoverageFact.limitation}`,
      source: primaryCoverageFact.sources.join('、'),
      tags: ['核心位置', primaryCoverageFact.status],
    },
    ...primaryPointFacts.map((fact): PromptEvidenceItem => ({
      level: '主证',
      title: `${fact.role}位置`,
      detail: `${fact.promptText}；边界：${fact.limitation}`,
      source: fact.sources.join('、'),
      tags: [fact.role, fact.status],
    })),
    {
      level: '辅证',
      title: '完整星体与计算点位置',
      detail: planetFacts.join('；'),
      source: 'celestine 星体、交点、小行星、莉莉丝与阿拉伯点黄经及落宫计算',
      tags: ['完整位置', '黄经', '落宫', '逆行'],
    },
    {
      level: '辅证',
      title: '四轴位置',
      detail: angleFacts.join('；'),
      source: 'celestine 地平与子午圈四轴计算',
      tags: ['上升', '天顶', '下降', '天底'],
    },
    {
      level: '辅证',
      title: '十二宫宫头',
      detail: houseFacts.join('；'),
      source: 'celestine Placidus 十二宫宫头计算',
      tags: ['Placidus', '十二宫', '宫头'],
    },
    ...aspectFacts.map((item): PromptEvidenceItem => ({
      level: '辅证',
      title: `${item.body1}与${item.body2}${item.type}`,
      detail: `${item.promptText}；边界：${item.limitation}`,
      source: item.sources.join('、'),
      tags: [item.type, item.closeness, item.phase, item.isOutOfSign ? '跨星座' : '同星座条件'],
    })),
    {
      level: '辅证',
      title: '元素模式与逆行分布',
      detail: `${distributionEvidenceFacts.map((item) => item.promptText).join('；')}；统一边界：${DISTRIBUTION_FACT_LIMITATION}`,
      source: Array.from(new Set(distributionEvidenceFacts.flatMap((item) => item.sources))).join(
        '、',
      ),
      tags: ['元素', '模式', '逆行', '盘面格局'],
    },
    {
      level: illuminationFact.status === '可用' ? '辅证' : '反证',
      title:
        illuminationFact.status === '可用' ? '出生地点太阳光照背景' : '出生地点太阳光照背景缺失',
      detail: `${illuminationFact.promptText}；边界：${illuminationFact.limitation}`,
      source: illuminationFact.sources.join('、'),
      tags: ['天文背景', illuminationFact.status],
    },
    ...counterEvidenceFacts
      .filter((fact) => fact.status === '未见')
      .map((fact): PromptEvidenceItem => ({
        level: '反证',
        title: fact.promptText,
        detail: `${fact.promptText}；边界：${fact.limitation}`,
        source: fact.sources.join('、'),
        tags: ['反证', fact.type],
      })),
    {
      level: '反证',
      title: `反证汇总：${counterSummaryFact.status}`,
      detail: `${counterSummaryFact.promptText}；边界：${counterSummaryFact.limitation}`,
      source: counterSummaryFact.sources.join('、'),
      tags: ['反证汇总', counterSummaryFact.status],
    },
    {
      level: summaryFact.status === '证据链完整' ? '辅证' : '反证',
      title: `星盘证据汇总：${summaryFact.status}`,
      detail: `${summaryFact.promptText}；边界：${summaryFact.limitation}`,
      source: summaryFact.sources.join('、'),
      tags: ['证据汇总', summaryFact.status],
    },
    {
      level: '限制',
      title: '星盘输入、模型与解释边界',
      detail: `${limitationFacts.map((fact) => fact.promptText).join('；')}；边界：${LIMITATION_FACT_LIMITATION}`,
      source: Array.from(new Set(limitationFacts.flatMap((fact) => fact.sources))).join('、'),
    },
  ];
  const evidence: PromptEvidenceBundle = { title: '西方星盘位置与相位结构化证据', items };
  const promptText = [
    '【西方星盘位置与相位结构化证据】',
    ...formatPromptEvidenceBundle(evidence),
    `计算链：${calculationChain.join(' → ')}。`,
    `反证核验：${counterSummaryFact.promptText}。`,
    `证据汇总：${summaryFact.promptText}。`,
    `解释限制（方法限制）：${limitations.join('；')}。`,
  ].join('\n');

  return {
    key: 'astrolabe:evidence',
    status: '已计算',
    calculationFact,
    calculationSteps: calculationFact.steps,
    calculationChain,
    timezoneFact,
    trueSolarTimeFact,
    primaryCoverageFact,
    primaryPointFacts,
    primaryFacts,
    positionFacts,
    aspectFacts,
    planetFacts,
    angleFacts,
    houseFacts,
    distributionEvidenceFacts,
    distributionFacts,
    illuminationFact,
    illuminationFacts,
    supportingFacts,
    counterEvidence,
    counterEvidenceFacts,
    counterSummaryFact,
    limitations,
    limitationFacts,
    summaryFact,
    evidence,
    promptText,
    methodology: [
      '先固定出生时间、地点、时区及是否采用真太阳时。',
      '以太阳、月亮、上升和天顶作为位置主证。',
      '相位逐项保留角度偏差、紧密等级与入相出相，不换算概率或强度分。',
      '元素、模式、逆行和光照资料只作盘面构成辅证。',
      '强制输出筛选范围、输入精度边界与现代实证边界，不生成候选出生时间或敏感性结果。',
    ],
  };
}
