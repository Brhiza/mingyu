/**
 * TempoSoul·命律 — 六爻起卦排盘证据链构建器
 *
 * 为 generateLiuyao 结果附加 v3.0 方案要求的四字段证据契约：
 *   计算链(computationChain) / 出处(source) / 边界(boundary) / 反证(counterEvidence)
 * + 置信度(confidence) + 深度(depth ≤4)
 *
 * 覆盖六爻起卦六大环节：起卦基础 → 摇卦过程 → 卦象构建 → 纳甲装卦 → 世应定位 → 动变分析
 */
import {
  buildEvidenceTrail,
  type EvidenceItem,
  type EvidenceTrail,
} from '../shared/evidence';
import type { LiuyaoData } from '../types/divination';

export function buildLiuyaoEvidenceTrail(result: LiuyaoData): EvidenceTrail {
  const items: EvidenceItem[] = [];

  // 1. 起卦基础（depth 0 主证）
  items.push({
    title: '六爻起卦基础',
    system: 'liuyao',
    computationChain: [
      {
        name: '占卜时间',
        reference: 'getDivinationTime',
        output: result.ganzhi,
      },
      {
        name: '起卦方式',
        formula:
          result.generation?.method === 'manual'
            ? '手工定爻（6/7/8/9）'
            : result.generation?.method === 'coins'
              ? '三钱摇卦'
              : '时间起卦',
        inputs: { method: result.generation?.method ?? 'time' },
      },
    ],
    source: { type: 'classical', name: '《增删卜易》起卦法' },
    boundary: {
      applicableWhen: ['提供占卜时刻或手工爻值'],
      cautionWhen: ['时间起卦以占卜当下时刻为准', '手工爻值必须为 6/7/8/9 且恰好 6 爻'],
      precision: '时辰精度（2 小时）',
    },
    counterEvidence: [
      { description: '起卦方式不同（时间/手摇/模拟）可产生不同卦象', severity: 'alternative' },
    ],
    confidence: 'high',
    depth: 0,
  });

  // 2. 摇卦过程（depth 1 辅证）
  if (result.generation?.coinThrows) {
    items.push({
      title: '摇卦过程',
      system: 'liuyao',
      computationChain: [
        {
          name: '三钱投掷',
          formula: '三枚铜钱每爻一掷：字背组合定 6/7/8/9（老阴/少阳/少阴/老阳）',
          reference: 'generateCoinYaos',
          output: result.generation.coinThrows.map(
            (t) => `${t.total}（${t.coins.join(',')}）`,
          ),
        },
      ],
      source: { type: 'classical', name: '三钱起卦法（《易冒》钱筮法）' },
      boundary: {
        applicableWhen: ['逐爻记录三枚铜钱正反'],
        cautionWhen: ['模拟投掷依赖随机种子，需保留随机轨迹以便复现'],
      },
      counterEvidence: [
        { description: '不同随机种子会产生不同爻值，属于占卜本身的随机性', severity: 'minor' },
      ],
      confidence: 'high',
      depth: 1,
    });
  }

  // 3. 卦象构建（depth 0 主证）
  items.push({
    title: '卦象构建',
    system: 'liuyao',
    computationChain: [
      {
        name: '本卦',
        reference: 'hexagram lookup',
        output: result.originalName,
      },
      {
        name: '变卦',
        formula: '老阳(9)变阴、老阴(6)变阳',
        output: result.changedName ?? null,
      },
      {
        name: '互卦',
        formula: '二三四爻为下互、三四五爻为上互',
        output: result.interName ?? null,
      },
    ],
    source: { type: 'classical', name: '《周易》六十四卦体系' },
    boundary: {
      applicableWhen: ['六爻成卦'],
      cautionWhen: ['卦象查表需二进制符号精确匹配'],
    },
    counterEvidence: [
      { description: '动爻多少决定变卦是否启用', severity: 'alternative' },
    ],
    confidence: 'high',
    depth: 0,
  });

  // 4. 纳甲装卦（depth 1 辅证）
  if (result.najiaDizhi.length > 0) {
    items.push({
      title: '纳甲装卦',
      system: 'liuyao',
      computationChain: [
        {
          name: '纳甲地支',
          reference: 'getNaJiaAndLiuQin',
          output: result.najiaDizhi,
        },
        {
          name: '五行属性',
          reference: 'getNaJiaAndLiuQin',
          output: result.wuxing,
        },
        {
          name: '六亲',
          formula: '以卦宫五行为我，生克定父母/兄弟/官鬼/妻财/子孙',
          output: result.sixRelatives,
        },
        {
          name: '六神',
          formula: '起卦日干定青龙/朱雀/勾陈/螣蛇/白虎/玄武',
          output: result.sixGods,
        },
      ],
      source: { type: 'classical', name: '纳甲筮法（《火珠林》）' },
      boundary: {
        applicableWhen: ['纳甲装卦标准流程'],
        cautionWhen: ['变卦六亲以主卦宫位五行为我'],
      },
      counterEvidence: [
        { description: '六神起法以日干定，存在个别口诀差异', severity: 'minor' },
      ],
      confidence: 'high',
      depth: 1,
    });
  }

  // 5. 世应定位（depth 1 辅证）
  if (result.worldAndResponse.length >= 2) {
    items.push({
      title: '世应定位',
      system: 'liuyao',
      computationChain: [
        {
          name: '世应安布',
          formula: '八宫卦序定世爻，世隔两位为应',
          reference: 'getShiYing',
          output: {
            world: result.worldAndResponse[0],
            response: result.worldAndResponse[1],
            palace: `${result.palace.name}（${result.palace.wuxing}）`,
            palaceStage: result.palaceStage ?? null,
          },
        },
      ],
      source: { type: 'classical', name: '八宫卦序（京房纳甲体系）' },
      boundary: {
        applicableWhen: ['八宫卦世应定位'],
        cautionWhen: ['世应位置由卦宫卦序唯一确定'],
      },
      counterEvidence: [
        { description: '游魂/归魂卦世爻定位易误，需按卦序核对', severity: 'minor' },
      ],
      confidence: 'high',
      depth: 1,
    });
  }

  // 6. 动变分析（depth 1 辅证）
  if (result.changingYaos.length > 0 || result.hexagramRelations || result.fanfuRelations) {
    items.push({
      title: '动变分析',
      system: 'liuyao',
      computationChain: [
        {
          name: '动爻识别',
          reference: 'rawYaos',
          output: result.changingYaos.map((y) => `第${y.position}爻${y.type}`),
        },
        {
          name: '卦变关系',
          reference: 'getLiuyaoHexagramRelations',
          output: result.hexagramRelations ?? null,
        },
        {
          name: '反吟伏吟',
          reference: 'getLiuyaoFanFuRelations',
          output: result.fanfuRelations ?? null,
        },
        {
          name: '特殊卦象',
          output: result.specialPattern ?? null,
        },
      ],
      source: { type: 'classical', name: '《卜筮正宗》动变章' },
      boundary: {
        applicableWhen: ['以动爻为断卦枢纽'],
        cautionWhen: ['静卦独静卦与全动卦解读不同', '六合/六冲需结合卦变判断'],
      },
      counterEvidence: [
        { description: '动变吉凶解释流派差异较大，证据仅记录卦象结构', severity: 'alternative' },
      ],
      confidence: 'medium',
      depth: 1,
    });
  }

  return buildEvidenceTrail(
    items,
    `六爻起卦证据链（${result.originalName}${result.changedName ? `→${result.changedName}` : ''}，${result.ganzhi.day}日）`,
  );
}
