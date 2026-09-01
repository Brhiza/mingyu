/**
 * TempoSoul·命律 — 紫微斗数排盘证据链构建器
 *
 * 为 calculateZiweiChart 结果附加 v3.0 方案要求的四字段证据契约：
 *   计算链(computationChain) / 出处(source) / 边界(boundary) / 反证(counterEvidence)
 * + 置信度(confidence) + 深度(depth ≤4)
 *
 * 覆盖紫微排盘六大环节：排盘基础 → 真太阳时校正 → 命宫身宫定位 → 十二宫星曜安布 → 生年四化 → 大限运限
 */
import {
  buildEvidenceTrail,
  type EvidenceItem,
  type EvidenceTrail,
} from '../shared/evidence';
import type { ChartInput } from '../types/chart';
import type { ZiweiRuntime } from './runtime';

export function buildZiweiEvidenceTrail(
  input: ChartInput,
  result: ZiweiRuntime,
): EvidenceTrail {
  const items: EvidenceItem[] = [];

  // 1. 排盘基础（depth 0 主证）
  items.push({
    title: '紫微斗数排盘基础',
    system: 'ziwei',
    computationChain: [
      {
        name: '历法换算',
        formula: input.dateType === 'lunar' ? '农历 → 公历' : '公历直用',
        inputs: {
          birthDate: input.birthDate,
          birthTimeIndex: input.birthTimeIndex,
          gender: input.gender,
          dateType: input.dateType,
          algorithm: input.algorithm ?? 'default',
        },
      },
    ],
    source: { type: 'classical', name: '《紫微斗数全书》历法体系' },
    boundary: {
      applicableWhen: ['提供出生日期、时辰与性别'],
      cautionWhen: [
        '出生时刻接近 23:00 换日线',
        '农历闰月需确认 fixLeap 口径',
        'algorithm 切换 zhongzhou 会改变安星',
      ],
      precision: '时辰精度（2 小时）',
    },
    counterEvidence: [
      { description: '紫微斗数存在三合/飞星等流派，安星法细节有差异', severity: 'alternative' },
      { description: '闰月与换日线口径不同可改变命宫与十二宫分布', severity: 'alternative' },
    ],
    confidence: 'high',
    depth: 0,
  });

  // 2. 真太阳时校正（depth 1 辅证）
  if (input.trueSolarEvidence) {
    items.push({
      title: '真太阳时校正',
      system: 'true-solar-time',
      computationChain: [
        {
          name: '经度时差',
          formula: '(出生经度 - 120°) × 4 分钟/°',
          reference: 'trueSolarEvidence',
        },
        { name: '均时差', formula: '真太阳时 - 平太阳时', reference: 'Meeus Equation of Time' },
      ],
      source: { type: 'algorithm', name: 'Meeus Astronomical Algorithms', location: 'Ch.27-28' },
      boundary: {
        precision: '±1 分钟',
        applicableWhen: ['提供出生经度或城市坐标'],
        cautionWhen: ['出生时刻接近换日线', '历史夏令时期间'],
      },
      counterEvidence: [
        { description: '跨时区出生需按实际时区重新校正', severity: 'alternative' },
      ],
      confidence: 'medium',
      depth: 1,
    });
  }

  const palaces = result.payloadByScope?.['origin']?.palaces ?? [];

  // 3. 命宫身宫定位（depth 0 主证）
  const mingPalace = palaces.find((p) => p.name === '命宫');
  const bodyPalace = palaces.find((p) => p.is_body_palace);
  if (mingPalace) {
    items.push({
      title: '命宫身宫定位',
      system: 'ziwei',
      computationChain: [
        {
          name: '命宫安布',
          formula: '寅宫起正月顺数至生月，再逆数至生时',
          reference: 'iztro FunctionalAstrolabe',
          output: {
            palace: mingPalace.name,
            stemBranch: `${mingPalace.heavenly_stem}${mingPalace.earthly_branch}`,
            bodyPalace: bodyPalace?.name ?? null,
          },
        },
      ],
      source: { type: 'classical', name: '《紫微斗数全书》安星法' },
      boundary: {
        applicableWhen: ['以出生年月日时排盘'],
        cautionWhen: ['子时出生（23:00-01:00）安星口径敏感'],
      },
      counterEvidence: [
        {
          description: '身宫定位存在生年天干与地支双重取法，不同流派身宫可能不同',
          severity: 'alternative',
        },
      ],
      confidence: 'high',
      depth: 0,
    });
  }

  // 4. 十二宫与星曜安布（depth 1 辅证）
  if (palaces.length > 0) {
    const majorStarsByPalace = palaces
      .filter((p) => p.major_stars.length > 0)
      .map((p) => `${p.name}:${p.major_stars.map((s) => s.name).join('、')}`);
    items.push({
      title: '十二宫星曜安布',
      system: 'ziwei',
      computationChain: [
        {
          name: '十二宫',
          formula: '命宫起按地支逆时针布十二宫',
          reference: 'iztro FunctionalAstrolabe',
          output: {
            palaceCount: palaces.length,
            palaceNames: palaces.map((p) => p.name).join('、'),
          },
        },
        {
          name: '主星分布',
          reference: 'iztro 安星法',
          output: majorStarsByPalace,
        },
      ],
      source: { type: 'classical', name: '《紫微斗数全书》星曜体系' },
      boundary: {
        applicableWhen: ['紫微十四主星安布'],
        cautionWhen: ['空宫需借对宫星曜合参', '特殊格局需结合三方四正'],
      },
      counterEvidence: [
        { description: '辅星/煞星是否计入主星口径不同', severity: 'minor' },
      ],
      confidence: 'high',
      depth: 1,
    });
  }

  // 5. 生年四化（depth 1 辅证）
  const mutagenEntries: string[] = [];
  palaces.forEach((p) => {
    [...p.major_stars, ...p.minor_stars, ...p.other_stars].forEach((s) => {
      if (s.birth_mutagen) {
        mutagenEntries.push(`${s.name}化${s.birth_mutagen}于${p.name}`);
      }
    });
  });
  if (mutagenEntries.length > 0) {
    items.push({
      title: '生年四化',
      system: 'ziwei',
      computationChain: [
        {
          name: '四化飞星',
          formula: '生年天干定四化（禄权科忌）',
          reference: 'iztro FunctionalAstrolabe',
          output: mutagenEntries,
        },
      ],
      source: { type: 'classical', name: '《紫微斗数全书》四化体系' },
      boundary: {
        applicableWhen: ['生年天干四化表'],
        cautionWhen: ['四化口诀存在不同版本（不同天干四化表）'],
      },
      counterEvidence: [
        { description: '四化口诀不同版本（如庚干四化）可改变落点', severity: 'alternative' },
      ],
      confidence: 'high',
      depth: 1,
    });
  }

  // 6. 大限运限（depth 1 辅证）
  if (mingPalace?.decadal_range) {
    items.push({
      title: '大限起运',
      system: 'ziwei',
      computationChain: [
        {
          name: '大限排法',
          formula: '五行局定起限岁数，阳男阴女顺行 / 阴男阳女逆行',
          reference: 'iztro decadal',
          output: {
            decadalRange: mingPalace.decadal_range,
            ageRange: mingPalace.ages,
          },
        },
      ],
      source: { type: 'classical', name: '《紫微斗数全书》大限体系' },
      boundary: {
        applicableWhen: ['以五行局与出生年干定大限'],
        cautionWhen: ['流派对大限起点年龄口径不同'],
      },
      counterEvidence: [
        { description: '不同流派对大限起始与岁数换算口径不同', severity: 'alternative' },
      ],
      confidence: 'medium',
      depth: 1,
    });
  }

  return buildEvidenceTrail(
    items,
    `紫微斗数排盘证据链（${input.birthDate}，${input.gender}）`,
  );
}
