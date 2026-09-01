/**
 * TempoSoul·命律 — 八字排盘证据链构建器
 *
 * 为 calculateBazi 结果附加 v3.0 方案要求的四字段证据契约：
 *   计算链(computationChain) / 出处(source) / 边界(boundary) / 反证(counterEvidence)
 * + 置信度(confidence) + 深度(depth ≤4)
 *
 * 覆盖排盘五大环节：排盘基础 → 真太阳时校正 → 四柱推演 → 十神推导 → 大运起运
 */
import {
  buildEvidenceTrail,
  type EvidenceItem,
  type EvidenceTrail,
} from '../shared/evidence';
import type { Person, InternalBaziChartResult } from './baziTypes';

export function buildBaziEvidenceTrail(
  person: Person,
  result: InternalBaziChartResult,
): EvidenceTrail {
  const items: EvidenceItem[] = [];

  // 1. 排盘基础（depth 0 主证）
  items.push({
    title: '八字排盘基础',
    system: 'bazi',
    computationChain: [
      {
        name: '历法换算',
        formula: person.isLunar ? '农历 → 公历' : '公历直用',
        inputs: {
          year: person.year,
          month: person.month,
          day: person.day,
          timeIndex: person.timeIndex,
          isLunar: person.isLunar ?? false,
          useTrueSolarTime: person.useTrueSolarTime ?? false,
        },
      },
    ],
    source: { type: 'classical', name: '《三命通会》历法体系' },
    boundary: {
      applicableWhen: ['提供公历或农历出生时间'],
      cautionWhen: ['出生时刻接近 23:00 换日线', '子时口径（子初/子正）需确认'],
      precision: '时辰精度（2 小时）',
    },
    counterEvidence: [
      { description: '不同流派对换日线口径不同（子初换日 vs 子正换日）', severity: 'alternative' },
      { description: '真太阳时是否启用会改变时辰归属', severity: 'alternative' },
    ],
    confidence: 'high',
    depth: 0,
  });

  // 2. 真太阳时校正（depth 1 辅证）
  if (person.useTrueSolarTime) {
    items.push({
      title: '真太阳时校正',
      system: 'true-solar-time',
      computationChain: [
        {
          name: '经度时差',
          formula: '(出生经度 - 120°) × 4 分钟/°',
          inputs: { birthLongitude: person.birthLongitude ?? null },
        },
        { name: '均时差', reference: 'Meeus Equation of Time', formula: '真太阳时 - 平太阳时' },
        { name: '夏令时校正', formula: '1986-1991 中国夏令时 -60 分钟', reference: 'applyChinaDst' },
      ],
      source: { type: 'algorithm', name: 'Meeus Astronomical Algorithms', location: 'Ch.27-28' },
      boundary: {
        precision: '±1 分钟',
        applicableWhen: ['提供出生经度或城市坐标'],
        cautionWhen: ['出生时刻接近 23:00 换日线', '历史夏令时期间'],
      },
      counterEvidence: [
        { description: '跨时区出生需按实际时区重新校正', severity: 'alternative' },
        { description: '经度取整精度不足时校正值有偏差', severity: 'minor' },
      ],
      confidence: 'medium',
      depth: 1,
    });
  }

  // 3. 四柱推演（depth 0 主证）
  const p = result.pillars;
  if (p) {
    items.push({
      title: '四柱推演',
      system: 'bazi',
      computationChain: [
        { name: '年柱', formula: '立春为年界', output: `${p.year.gan}${p.year.zhi}` },
        { name: '月柱', formula: '节气分月 + 五虎遁', output: `${p.month.gan}${p.month.zhi}` },
        { name: '日柱', formula: '万年历/儒略日推算', output: `${p.day.gan}${p.day.zhi}` },
        { name: '时柱', formula: '五鼠遁', output: `${p.hour.gan}${p.hour.zhi}` },
      ],
      source: { type: 'classical', name: '《渊海子平》四柱体系' },
      boundary: {
        applicableWhen: ['立春换年、节气换月'],
        cautionWhen: ['出生时刻贴近节气交接点', '23:00-24:00 出生（换日线敏感）'],
        precision: '时辰精度（2 小时）',
      },
      counterEvidence: [
        { description: '年界存在立春/正月初一分歧', severity: 'alternative' },
        { description: '月柱存在平气/定气历法差异', severity: 'minor' },
      ],
      confidence: 'high',
      depth: 0,
    });
  }

  // 4. 十神推导（depth 1 辅证）
  if (result.tenGods) {
    items.push({
      title: '十神推导',
      system: 'bazi',
      computationChain: [
        {
          name: '十神矩阵',
          formula: '日主五行生克 + 阴阳关系',
          reference: 'getTenGod(gan, dayMaster)',
          output: result.tenGods,
        },
      ],
      source: { type: 'classical', name: '《滴天髓》十神体系' },
      boundary: {
        applicableWhen: ['以日主为基准'],
        cautionWhen: ['从格/特殊格局需特殊处理'],
      },
      counterEvidence: [
        { description: '从格旺衰判断不同可致十神意义反转', severity: 'overturn' },
        { description: '藏干取法（主气/全藏）影响支藏十神', severity: 'alternative' },
      ],
      confidence: 'high',
      depth: 1,
    });
  }

  // 5. 大运起运（depth 1 辅证）
  if (result.luckInfo) {
    items.push({
      title: '大运起运',
      system: 'bazi',
      computationChain: [
        {
          name: '起运岁数',
          formula: '阳男阴女顺排 / 阴男阳女逆排',
          reference: 'LuckCalculator',
          output: {
            startInfo: result.luckInfo.startInfo,
            handoverInfo: result.luckInfo.handoverInfo,
            cycleCount: result.luckInfo.cycles?.length,
          },
        },
      ],
      source: { type: 'classical', name: '《渊海子平》大运体系' },
      boundary: {
        applicableWhen: ['以出生日至最近节气的距离计算'],
        cautionWhen: ['出生日贴近节气时起运岁数敏感'],
      },
      counterEvidence: [
        { description: '起运算法存在多种流派（如 3 天折 1 岁等）', severity: 'alternative' },
      ],
      confidence: 'medium',
      depth: 1,
    });
  }

  const dateLabel = `${person.year}-${String(person.month).padStart(2, '0')}-${String(person.day).padStart(2, '0')}`;
  return buildEvidenceTrail(items, `八字排盘证据链（${dateLabel}，${person.gender || '性别未知'}）`);
}
