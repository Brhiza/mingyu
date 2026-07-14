import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import type { AstrolabeData } from '../types/divination';

export interface AstrolabeEvidenceAnalysis {
  calculationChain: string[];
  primaryFacts: string[];
  planetFacts: string[];
  angleFacts: string[];
  houseFacts: string[];
  distributionFacts: string[];
  illuminationFacts: string[];
  supportingFacts: string[];
  counterEvidence: string[];
  limitations: string[];
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: string[];
}

function formatPointFact(item: AstrolabeData['planets'][number]) {
  return `${item.label}${item.formatted}，黄经${item.longitude.toFixed(3)}°${item.house ? `，第${item.house}宫` : ''}${item.retrograde ? '，逆行' : ''}`;
}

export function analyzeAstrolabeEvidence(
  data: Omit<AstrolabeData, 'evidenceAnalysis'>,
): AstrolabeEvidenceAnalysis {
  const sun = data.planets.find((item) => item.name === 'Sun');
  const moon = data.planets.find((item) => item.name === 'Moon');
  const ascendant = data.angles.find((item) => item.name === 'Ascendant');
  const midheaven = data.angles.find((item) => item.name === 'Midheaven');
  const primaryPoints = [sun, moon, ascendant, midheaven].filter(
    (item): item is NonNullable<typeof item> => Boolean(item),
  );
  const calculationChain = [
    `固定出生民用时间${data.birth.standardDateTime ?? data.birth.dateTime}、地点${data.birth.location}与UTC${data.birth.timezone >= 0 ? '+' : ''}${data.birth.timezone}`,
    data.birth.isTrueSolarTime
      ? `执行真太阳时校正，采用${data.birth.trueSolarDateTime ?? data.birth.dateTime}进入星盘计算`
      : '采用输入民用时间进入星盘计算',
    '由 celestine 计算黄道位置、Placidus 宫位、四轴与宫头',
    '按相位角与容许度筛选主要相位，并记录角度偏差、紧密等级和入相/出相状态',
    '汇总元素、模式与逆行分布，作为盘面构成辅证',
  ];
  const primaryFacts = primaryPoints.map(
    (item) => `${item.label}${item.formatted}${item.house ? `，落第${item.house}宫` : ''}`,
  );
  const planetFacts = data.planets.map(formatPointFact);
  const angleFacts = data.angles.map(formatPointFact);
  const houseFacts = data.houses.map(
    (item) => `${item.label}宫头${item.formatted}，黄经${item.longitude.toFixed(3)}°`,
  );
  const distributionFacts = [
    ...Object.entries(data.summary.elements).map(
      ([element, points]) => `${element}元素：${points.join('、') || '无'}`,
    ),
    ...Object.entries(data.summary.modalities).map(
      ([modality, points]) => `${modality}模式：${points.join('、') || '无'}`,
    ),
    `逆行点：${data.summary.retrograde.join('、') || '无'}`,
    `依赖库盘面格局：${data.summary.patterns.join('、') || '无'}`,
  ];
  const illuminationFacts = data.solarIllumination
    ? [
        `出生时刻太阳高度${data.solarIllumination.solarAltitudeDegrees.toFixed(3)}°、方位角${data.solarIllumination.solarAzimuthDegrees.toFixed(3)}°、赤纬${data.solarIllumination.solarDeclinationDegrees.toFixed(3)}°`,
        `均时差${data.solarIllumination.equationOfTimeMinutes.toFixed(3)}分钟，视太阳正午${data.solarIllumination.apparentSolarNoonLocalDateTime}`,
        `光照算法：${data.solarIllumination.method}；来源：${data.solarIllumination.source}`,
      ]
    : [];
  const supportingFacts = data.aspects.map(
    (item) =>
      `${item.body1}${item.symbol}${item.body2}（${item.type}），偏差${item.orb}°，${item.closeness ?? '未分级'}${item.applying === null ? '' : item.applying ? '，入相' : '，出相'}`,
  );
  const counterEvidence = [
    data.aspects.length === 0 ? '当前筛选范围内未见主要相位' : '',
    data.summary.retrograde.length === 0 ? '未见逆行星体' : '',
    data.summary.patterns.length === 0 ? '未见依赖库标记的主要盘面格局' : '',
  ].filter(Boolean);
  const limitations = [
    ...(data.birth.timezoneDiagnostics ?? []),
    '星体、宫位与相位是几何和规则计算结果，不等于现实事件、人格诊断或命运必然性',
    '相位紧密等级只描述容许度内的位置，不代表事件概率、匹配率、吉凶比例或作用强度百分比',
    '结果只保留筛选后排序靠前的十二组相位；未列出不等于两点之间不存在其他角度关系',
    '元素、模式、逆行数量只描述盘面构成，不生成能量分数或综合吉凶等级',
    'Placidus 宫位和出生时刻高度相关，地点、时区或时间输入错误会直接改变四轴与落宫',
    '太阳光照资料只作地点相关的天文背景，不直接推出性格或吉凶结论',
  ];
  const items: PromptEvidenceItem[] = [
    ...primaryPoints.map((item): PromptEvidenceItem => ({
      level: '主证',
      title: `${item.label}位置`,
      detail: `${item.formatted}${item.house ? `，第${item.house}宫` : '，四轴点'}，黄经${item.longitude.toFixed(3)}°${item.retrograde ? '，逆行' : ''}`,
      source: 'celestine 黄道位置、四轴与 Placidus 宫位计算',
      tags: [item.label, item.sign, item.house ? `第${item.house}宫` : '四轴'],
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
    ...data.aspects.map((item): PromptEvidenceItem => ({
      level: '辅证',
      title: `${item.body1}与${item.body2}${item.type}`,
      detail: `距精确角偏差${item.orb}°，${item.closeness ?? '未分级'}${item.applying === null ? '' : item.applying ? '，入相' : '，出相'}`,
      source: item.source ?? 'celestine 本命相位计算',
      tags: [item.type, item.closeness ?? '未分级'],
    })),
    {
      level: '辅证',
      title: '元素模式与逆行分布',
      detail: distributionFacts.join('；'),
      source: 'celestine 盘面元素、模式、逆行与格局汇总',
      tags: ['元素', '模式', '逆行', '盘面格局'],
    },
    ...(illuminationFacts.length
      ? [
          {
            level: '辅证' as const,
            title: '出生地点太阳光照背景',
            detail: illuminationFacts.join('；'),
            source: '命语太阳高度、方位、赤纬与均时差公共算法',
            tags: ['天文背景', '太阳高度', '均时差'],
          },
        ]
      : []),
    ...counterEvidence.map((detail): PromptEvidenceItem => ({
      level: '反证',
      title: detail,
      detail,
      source: '当前星盘结果逐项核验',
    })),
    {
      level: '限制',
      title: '星盘输入、模型与解释边界',
      detail: limitations.join('；'),
      source: '输入完整性、计算模型与公开结果范围审计',
    },
  ];
  const evidence: PromptEvidenceBundle = { title: '西方星盘位置与相位结构化证据', items };
  const promptText = [
    '【西方星盘位置与相位结构化证据】',
    ...formatPromptEvidenceBundle(evidence),
    `计算链：${calculationChain.join(' → ')}。`,
    `反证核验：${counterEvidence.join('；') || '主要相位、逆行或盘面格局均有可列资料，仍不得据数量直接定性'}。`,
    `方法限制：${limitations.join('；')}。`,
  ].join('\n');

  return {
    calculationChain,
    primaryFacts,
    planetFacts,
    angleFacts,
    houseFacts,
    distributionFacts,
    illuminationFacts,
    supportingFacts,
    counterEvidence,
    limitations,
    evidence,
    promptText,
    methodology: [
      '先固定出生时间、地点、时区及是否采用真太阳时。',
      '以太阳、月亮、上升和天顶作为位置主证。',
      '相位逐项保留角度偏差、紧密等级与入相出相，不换算概率或强度分。',
      '元素、模式、逆行和光照资料只作盘面构成辅证。',
      '强制输出筛选范围、输入敏感性与现代实证边界。',
    ],
  };
}
