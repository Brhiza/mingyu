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

export interface BaZhaiEvidenceAnalysis {
  calculationChain: string[];
  directionComparisons: BaZhaiDirectionComparison[];
  alignedDirections: BaZhaiDirectionComparison[];
  conflictingDirections: BaZhaiDirectionComparison[];
  measurementFacts: string[];
  counterEvidence: string[];
  limitations: string[];
  sources: Array<{ title: string; evidence: string; role: '传统规则来源' | '公共算法来源' }>;
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: string[];
}

export function analyzeBaZhaiEvidence(
  data: Omit<BaZhaiResult, 'prompt' | 'evidenceAnalysis'>,
  measurement?: BaZhaiDoorMeasurement,
): BaZhaiEvidenceAnalysis {
  const directionComparisons = data.mingPalace.map((mingPalace): BaZhaiDirectionComparison => {
    const housePalace = data.housePalace?.find((item) => item.gua === mingPalace.gua) ?? null;
    const relation = !housePalace
      ? '仅命卦资料'
      : housePalace.luck === mingPalace.luck
        ? mingPalace.luck === '吉'
          ? '同为吉方'
          : '同为凶方'
        : '命宅异判';
    return {
      direction: mingPalace.direction,
      degree: mingPalace.degree,
      mingLabel: mingPalace.label,
      mingLuck: mingPalace.luck,
      houseLabel: housePalace?.label ?? null,
      houseLuck: housePalace?.luck ?? null,
      relation,
    };
  });
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
    ...directionComparisons.map((item): PromptEvidenceItem => ({
      level: item.relation === '同为吉方' ? '主证' : item.relation === '命宅异判' ? '反证' : '辅证',
      title: `${item.direction}${item.relation}`,
      detail: `命卦为${item.mingLabel}（${item.mingLuck}）${item.houseLabel ? `；宅卦为${item.houseLabel}（${item.houseLuck}）` : '；未提供宅卦资料'}。`,
      source: '命卦与宅卦大游年八宫逐方比对',
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
      weight: 120,
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
    directionComparisons,
    alignedDirections,
    conflictingDirections,
    measurementFacts,
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
