/**
 * TempoSoul·命律 — 雷诺曼抽牌证据链构建器
 *
 * 为 drawLenormandSpread 结果附加 v3.0 方案要求的四字段证据契约：
 *   计算链(computationChain) / 出处(source) / 边界(boundary) / 反证(counterEvidence)
 * + 置信度(confidence) + 深度(depth ≤4)
 *
 * 覆盖雷诺曼抽牌四大环节：抽牌基础 → 洗牌抽牌 → 牌面抽定 → 组合合读
 */
import {
  buildEvidenceTrail,
  type EvidenceItem,
  type EvidenceTrail,
} from '../shared/evidence';
import type { LenormandData } from '../types/divination';

export function buildLenormandEvidenceTrail(result: LenormandData): EvidenceTrail {
  const items: EvidenceItem[] = [];

  // 1. 抽牌基础（depth 0 主证）
  items.push({
    title: '雷诺曼抽牌基础',
    system: 'lenormand',
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
    source: { type: 'modern', name: '雷诺曼 36 张牌体系（Lenormand）' },
    boundary: {
      applicableWhen: ['36 张雷诺曼牌'],
      cautionWhen: ['牌阵位置（大桌/三张/方阵）含义不同'],
    },
    counterEvidence: [
      { description: '不同雷诺曼流派对牌义与牌阵解读有差异', severity: 'alternative' },
    ],
    confidence: 'medium',
    depth: 0,
  });

  // 2. 洗牌抽牌（depth 1 辅证）
  if (result.draw?.order) {
    items.push({
      title: '洗牌抽牌',
      system: 'lenormand',
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
            (o) => `牌位${o.position}:${o.cardName}${o.house ? `（${o.house}）` : ''}`,
          ),
        },
      ],
      source: { type: 'modern', name: '雷诺曼洗牌抽牌流程（随机抽样）' },
      boundary: {
        applicableWhen: ['洗牌后依序抽取'],
        cautionWhen: ['模拟抽牌依赖随机种子'],
      },
      counterEvidence: [
        { description: '洗牌/切牌方式象征意义不同，随机公平性不变', severity: 'minor' },
      ],
      confidence: 'medium',
      depth: 1,
    });
  }

  // 3. 牌面抽定（depth 1 辅证）
  if (result.cards.length > 0) {
    items.push({
      title: '牌面抽定',
      system: 'lenormand',
      computationChain: [
        {
          name: '抽定牌面',
          reference: 'cards',
          output: result.cards.map((c) => `${c.position}:${c.name}`),
        },
      ],
      source: { type: 'modern', name: '雷诺曼牌义系统' },
      boundary: {
        applicableWhen: ['按牌阵位置解读'],
        cautionWhen: ['邻近牌会影响单牌含义'],
      },
      counterEvidence: [
        { description: '同一张牌与不同邻牌组合含义不同', severity: 'alternative' },
      ],
      confidence: 'medium',
      depth: 1,
    });
  }

  // 4. 组合合读（depth 1 辅证）
  if ((result.combinations?.length ?? 0) > 0) {
    items.push({
      title: '组合合读',
      system: 'lenormand',
      computationChain: [
        {
          name: '相邻组合',
          reference: '固定组合/相邻牌义合读',
          output: result.combinations!.map(
            (c) => `${c.card1}+${c.card2}:${c.meaning}`,
          ),
        },
      ],
      source: { type: 'modern', name: '雷诺曼组合牌义（固定搭配与位置合读）' },
      boundary: {
        applicableWhen: ['相邻牌组合解读'],
        cautionWhen: ['组合含义依赖牌位距离与方向'],
      },
      counterEvidence: [
        { description: '组合合读主观性强，不同流派结论不同', severity: 'alternative' },
      ],
      confidence: 'low',
      depth: 1,
    });
  }

  return buildEvidenceTrail(
    items,
    `雷诺曼抽牌证据链（${result.spreadName}，${result.cards.length}张）`,
  );
}
