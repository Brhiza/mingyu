/**
 * TempoSoul·命律 — 玄空飞星证据链构建器
 *
 * 为 generateXuanKong 结果附加 v3.0 四字段证据契约：
 *   计算链(computationChain) / 出处(source) / 边界(boundary) / 反证(counterEvidence)
 * + 置信度(confidence) + 深度(depth ≤4)
 *
 * 覆盖玄空飞星五大环节：排盘基础 → 坐向定盘 → 飞星布局 → 格局组合 → 到山到向
 */
import {
  buildEvidenceTrail,
  type EvidenceItem,
  type EvidenceTrail,
} from '../shared/evidence';
import type { XuanKongResult } from './index';

export function buildXuanKongEvidenceTrail(result: XuanKongResult): EvidenceTrail {
  const items: EvidenceItem[] = [];

  // 1. 排盘基础（depth 0 主证）
  items.push({
    title: '玄空飞星排盘基础',
    system: 'xuan-kong',
    computationChain: [
      {
        name: '当运元运',
        reference: 'period',
        output: `${result.period.yun}运（${result.period.year}年）`,
      },
      {
        name: '排盘模式',
        reference: 'engine.mode',
        output: result.engine.mode,
      },
      {
        name: '引擎',
        reference: 'engine.name',
        output: result.engine.name,
      },
    ],
    source: { type: 'classical', name: '玄空飞星（沈氏玄空/中州派）' },
    boundary: {
      applicableWhen: ['提供住宅建造年/起运年与坐向'],
      cautionWhen: ['元运以二十年为一运', '不同流派对零正神取用有差异'],
    },
    counterEvidence: [
      { description: '玄空派别（沈氏/中州/大玄空）盘法有差异', severity: 'alternative' },
    ],
    confidence: 'medium',
    depth: 0,
  });

  // 2. 坐向定盘（depth 1 辅证）
  items.push({
    title: '坐向定盘',
    system: 'xuan-kong',
    computationChain: [
      {
        name: '坐山',
        reference: 'sitMountain',
        output: result.sitMountain,
      },
      {
        name: '向首',
        reference: 'facingMountain',
        output: result.facingMountain,
      },
    ],
    source: { type: 'classical', name: '二十四山坐向' },
    boundary: {
      applicableWhen: ['按罗盘山向定盘'],
      cautionWhen: ['山向度数误差影响飞星'],
    },
    counterEvidence: [
      { description: '坐向测量精度影响排盘结果', severity: 'minor' },
    ],
    confidence: 'high',
    depth: 1,
  });

  // 3. 飞星布局（depth 1 辅证）
  if (result.palaces.length > 0) {
    items.push({
      title: '飞星布局',
      system: 'xuan-kong',
      computationChain: [
        {
          name: '九宫飞星',
          reference: 'palaces',
          output: result.palaces.map((p) => `${p.name}:${p.yunStar}/${p.shanStar}/${p.xiangStar}`).slice(0, 9),
        },
      ],
      source: { type: 'classical', name: '洛书九宫飞布（运盘/山盘/向盘）' },
      boundary: {
        applicableWhen: ['按运盘入中顺逆飞布'],
        cautionWhen: ['山向星顺逆飞依阴阳'],
      },
      counterEvidence: [
        { description: '阴阳顺逆判定不同流派有差异', severity: 'alternative' },
      ],
      confidence: 'high',
      depth: 1,
    });
  }

  // 4. 格局组合（depth 1 辅证）
  items.push({
    title: '格局组合',
    system: 'xuan-kong',
    computationChain: [
      {
        name: '格局',
        reference: 'formation',
        output: result.formation,
      },
      {
        name: '组合',
        reference: 'combinations',
        output: result.combinations.map((c) => `${c.name}:${c.note}`).slice(0, 12),
      },
    ],
    source: { type: 'classical', name: '玄空格局与星曜组合断' },
    boundary: {
      applicableWhen: ['按山向双星断格局'],
      cautionWhen: ['组合吉凶依峦头配合'],
    },
    counterEvidence: [
      { description: '格局断法主观性强，不同流派结论不同', severity: 'alternative' },
    ],
    confidence: 'low',
    depth: 1,
  });

  // 5. 到山到向（depth 1 辅证）
  if (result.daoShanXiang) {
    items.push({
      title: '到山到向',
      system: 'xuan-kong',
      computationChain: [
        {
          name: '山盘是否到山',
          reference: 'daoShanXiang.shanToMountain',
          output: result.daoShanXiang.shanToMountain,
        },
        {
          name: '向盘是否到向',
          reference: 'daoShanXiang.xiangToFacing',
          output: result.daoShanXiang.xiangToFacing,
        },
        {
          name: '结语',
          reference: 'daoShanXiang.summary',
          output: result.daoShanXiang.summary,
        },
      ],
      source: { type: 'classical', name: '到山到向/上山下水断' },
      boundary: {
        applicableWhen: ['判断山向星是否得位'],
        cautionWhen: ['旺山旺向需兼看峦头'],
      },
      counterEvidence: [
        { description: '到山到向吉凶断存在流派差异', severity: 'alternative' },
      ],
      confidence: 'medium',
      depth: 1,
    });
  }

  return buildEvidenceTrail(
    items,
    `玄空飞星证据链（${result.period.yun}运·${result.sitMountain}坐${result.facingMountain}向）`,
  );
}
