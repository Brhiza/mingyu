/**
 * TempoSoul·命律 — 塔罗抽牌证据链构建器
 *
 * 为 drawTarotSpread 结果附加 v3.0 方案要求的四字段证据契约：
 *   计算链(computationChain) / 出处(source) / 边界(boundary) / 反证(counterEvidence)
 * + 置信度(confidence) + 深度(depth ≤4)
 *
 * 覆盖塔罗抽牌四大环节：抽牌基础 → 洗牌抽牌 → 牌面抽定 → 牌阵解读
 */
import {
  buildEvidenceTrail,
  type EvidenceItem,
  type EvidenceTrail,
} from '../shared/evidence';
import type { TarotData } from '../types/divination';

export function buildTarotEvidenceTrail(result: TarotData): EvidenceTrail {
  const items: EvidenceItem[] = [];

  // 1. 抽牌基础（depth 0 主证）
  items.push({
    title: '塔罗抽牌基础',
    system: 'tarot',
    computationChain: [
      {
        name: '牌阵',
        reference: 'spreadType',
        output: `${result.spreadName}（${result.spreadType}）`,
      },
      {
        name: '抽牌方式',
        reference: 'draw.method',
        output: result.draw?.method ?? null,
      },
    ],
    source: { type: 'modern', name: '韦特塔罗体系（Rider-Waite-Smith）' },
    boundary: {
      applicableWhen: ['78 张韦特塔罗牌'],
      cautionWhen: ['正逆位判定依赖随机数或用户录入', '牌阵位置含义因流派而异'],
    },
    counterEvidence: [
      { description: '不同塔罗体系（马赛/透特）牌义与牌阵有差异', severity: 'alternative' },
    ],
    confidence: 'medium',
    depth: 0,
  });

  // 2. 洗牌抽牌（depth 1 辅证）
  if (result.draw?.order) {
    items.push({
      title: '洗牌抽牌',
      system: 'tarot',
      computationChain: [
        {
          name: '洗牌',
          reference: 'Fisher-Yates 洗牌',
          inputs: { deckSize: result.draw.deckSize },
        },
        {
          name: '抽牌',
          reference: '依牌位顺序取顶牌',
          output: result.draw.order.map(
            (o) => `牌位${o.position}:${o.cardName}（${o.orientation}）`,
          ),
        },
        {
          name: '正逆位',
          reference: 'orientationRule',
          output: result.draw.orientationRule,
        },
      ],
      source: { type: 'modern', name: '塔罗洗牌抽牌流程（随机抽样）' },
      boundary: {
        applicableWhen: ['洗牌后依序抽取'],
        cautionWhen: ['模拟抽牌依赖随机种子，需保留随机轨迹'],
      },
      counterEvidence: [
        { description: '洗牌/切牌方式不影响随机公平性，但不同方式象征意义不同', severity: 'minor' },
      ],
      confidence: 'medium',
      depth: 1,
    });
  }

  // 3. 牌面抽定（depth 1 辅证）
  if (result.cards.length > 0) {
    items.push({
      title: '牌面抽定',
      system: 'tarot',
      computationChain: [
        {
          name: '抽定牌面',
          reference: 'cards',
          output: result.cards.map(
            (c) => `${c.position}:${c.name}${c.reversed ? '（逆位）' : '（正位）'}`,
          ),
        },
      ],
      source: { type: 'modern', name: '韦特塔罗牌义系统' },
      boundary: {
        applicableWhen: ['按牌阵位置解读'],
        cautionWhen: ['逆位含义依赖解读者体系'],
      },
      counterEvidence: [
        { description: '同一张牌在不同牌阵/位置含义不同', severity: 'alternative' },
      ],
      confidence: 'medium',
      depth: 1,
    });
  }

  // 4. 牌阵解读（depth 1 辅证）
  if (result.cards.length > 0) {
    items.push({
      title: '牌阵解读',
      system: 'tarot',
      computationChain: [
        {
          name: '关键词',
          reference: 'getCardKeywords',
          output: result.cards.map((c) => `${c.name}:${c.keywords.join('、')}`),
        },
      ],
      source: { type: 'modern', name: '塔罗牌义与牌阵解读' },
      boundary: {
        applicableWhen: ['结合牌位与牌义综合解读'],
        cautionWhen: ['牌义仅供参考，不构成现实预测'],
      },
      counterEvidence: [
        { description: '塔罗解读主观性强，不同解读者可得出不同结论', severity: 'alternative' },
      ],
      confidence: 'low',
      depth: 1,
    });
  }

  return buildEvidenceTrail(
    items,
    `塔罗抽牌证据链（${result.spreadName}，${result.cards.length}张）`,
  );
}
