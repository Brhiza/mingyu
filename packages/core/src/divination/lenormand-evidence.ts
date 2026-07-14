import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import {
  buildRandomTraceFact,
  formatLegacyRandomFacts,
  type RandomTraceFact,
} from '../shared/random';
import type { LenormandData } from '../types/divination';

export interface LenormandTraditionalFact {
  key: string;
  kind: '单牌牌义' | '固定组合' | '相邻合读';
  cardNames: string[];
  positions: string[];
  originalText: string;
  promptText: string;
  verificationTargets: string[];
  sources: string[];
  limitation: '牌名、关键词、单牌牌义与组合牌义只作为当前牌阵的象征解释材料，不证明现实事件、他人意图、隐私、感情承诺、怀孕生育、疾病、法律事实、财务结果或唯一未来';
}

export interface LenormandLayoutFact {
  key: string;
  kind: '九宫中心' | '九宫路径' | '大桌宫位' | '人物牌近身' | '归宫';
  cardNames: string[];
  positions: string[];
  houses: string[];
  factText: string;
  promptText: string;
  source: string;
  limitation: '布局位置是由牌阵顺序计算的事实；中心、路径、近身与归宫只定义传统读取范围，不自动证明吉凶、现实事件或时间';
}

export interface LenormandDrawFact {
  key: string;
  status: '可核验' | '来源链缺失';
  deckSize?: number;
  method?: string;
  order: NonNullable<LenormandData['draw']>['order'];
  expectedCardCount: number;
  recordedCardCount: number;
  promptText: string;
  sources: string[];
  limitation: '抽牌来源只记录洗牌、牌位顺序、宫位和行列落点；来源链完整不表示牌义可信度、预测有效性或现实结果';
}

export interface LenormandEvidenceAnalysis {
  cards: Array<LenormandData['cards'][number] & { index: number }>;
  sequence: string[];
  fixedCombinations: NonNullable<LenormandData['combinations']>;
  adjacentReadings: NonNullable<LenormandData['combinations']>;
  drawFact: LenormandDrawFact;
  drawFacts: string[];
  layoutFacts: string[];
  randomFact: RandomTraceFact;
  randomFacts: string[];
  counterEvidence: string[];
  limitations: string[];
  traditionalFacts: LenormandTraditionalFact[];
  structuredLayoutFacts: LenormandLayoutFact[];
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: string[];
}

const TRADITIONAL_FACT_LIMITATION =
  '牌名、关键词、单牌牌义与组合牌义只作为当前牌阵的象征解释材料，不证明现实事件、他人意图、隐私、感情承诺、怀孕生育、疾病、法律事实、财务结果或唯一未来' as const;
const LAYOUT_FACT_LIMITATION =
  '布局位置是由牌阵顺序计算的事实；中心、路径、近身与归宫只定义传统读取范围，不自动证明吉凶、现实事件或时间' as const;
const DRAW_FACT_LIMITATION =
  '抽牌来源只记录洗牌、牌位顺序、宫位和行列落点；来源链完整不表示牌义可信度、预测有效性或现实结果' as const;

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildDrawFact(data: LenormandData): LenormandDrawFact {
  const order = (data.draw?.order ?? []).map((item) => ({ ...item }));
  const status =
    data.draw && order.length === data.cards.length ? ('可核验' as const) : ('来源链缺失' as const);
  return {
    key: `draw:lenormand:${data.spreadType}`,
    status,
    deckSize: data.draw?.deckSize,
    method: data.draw?.method,
    order,
    expectedCardCount: data.cards.length,
    recordedCardCount: order.length,
    promptText: data.draw
      ? `牌组规模：${data.draw.deckSize}张；洗牌与取牌方法：${data.draw.method}；${order.map((item) => `第${item.index}张对应${item.position}：牌号${item.cardId} ${item.cardName}${item.house ? `，落${item.house}宫` : ''}${item.row && item.column ? `，第${item.row}排第${item.column}列` : ''}`).join('；')}${status === '来源链缺失' ? `；当前仅记录${order.length}/${data.cards.length}张抽取顺序，不能完整核验` : ''}`
      : `当前结果未附洗牌方法与抽取顺序，仅保留${data.cards.length}张已确定牌面，不能反推完整抽牌来源链`,
    sources: ['36张雷诺曼牌组与 Fisher-Yates 洗牌记录', '牌位顺序、宫位与行列落点记录'],
    limitation: DRAW_FACT_LIMITATION,
  };
}

export function conditionLenormandTraditionalText(
  text: string,
  options?: {
    kind?: LenormandTraditionalFact['kind'];
    cardNames?: string[];
    keywords?: string[];
  },
): string {
  const kind = options?.kind ?? '单牌牌义';
  const cardNames = unique(options?.cardNames ?? []);
  const keywords = unique(options?.keywords ?? []);
  const targetText = keywords.length ? keywords.join('、') : '相关象征主题';
  const cardsText = cardNames.length ? cardNames.join('+') : '当前牌面';
  const conditionedText = text
    .replace(/感情的承诺或婚约/g, '关系承诺、契约或婚约议题')
    .replace(/订婚或喜讯/g, '订婚或喜讯线索')
    .replace(/消息带来感情进展/g, '消息与情感互动可能同时出现进展线索')
    .replace(/被人喜欢或表白/g, '好感、邀请或表白线索')
    .replace(/成熟的感情关系/g, '关系成熟度与长期条件')
    .replace(/家庭契约\/购房/g, '家庭契约、居住或购房条件')
    .replace(/社交上受到欢迎/g, '社交反馈与公开认可线索')
    .replace(/稳定安家/g, '居住稳定与安家条件')
    .replace(/目标明确并趋于稳定/g, '目标清晰度与稳定进展线索')
    .replace(/家庭添丁/g, '家庭成员变化或生育议题')
    .replace(/通过网络\/远程获利/g, '网络或远程渠道中的收益机会')
    .replace(/跨国或远距离财运/g, '跨国或远距离场景中的财务与资源流动议题')
    .replace(/欺骗与策略/g, '信息可信度与策略风险')
    .replace(/隐藏在迷雾中的欺骗/g, '信息不透明情况下的可信度风险')
    .replace(/直觉准确的时期/g, '直觉判断与现实信息可能较一致的阶段')
    .replace(/从迷茫走向清晰/g, '信息由模糊转向清晰的线索')
    .replace(/沉重的结束与考验/g, '收尾压力与责任考验')
    .replace(/突然的结束\/切割/g, '突然收尾或切割风险')
    .replace(/消耗性的压力/g, '持续消耗与压力风险')
    .replace(/改善环境的搬迁/g, '搬迁与环境改善条件')
    .replace(/秘密文件或消息/g, '未公开文件、消息与信息核验议题')
    .replace(/朋友的善意/g, '朋友支持或善意线索')
    .replace(/关键的情感答案/g, '需要核实的关键情感线索')
    .replace(/制度性阻碍/g, '制度、规则或机构层面的限制')
    .replace(/两难选择/g, '取舍冲突与决策压力')
    .replace(/流言蜚语/g, '未经核实的传播与沟通风险')
    .replace(/争吵与焦虑/g, '冲突沟通与焦虑风险')
    .replace(/资源或资金充裕/g, '资源与资金可用性线索')
    .replace(/深厚的感情基础/g, '关系基础与长期稳定线索')
    .replace(/局势转明/g, '局势可能转明')
    .replace(/问题有解/g, '可能出现可验证的解决条件')
    .replace(/会提供支持/g, '可能提供支持')
    .replace(/会进入公开场域/g, '可能进入公开场域')
    .replace(/能带来结果/g, '可能形成可验证的结果')
    .replace(/不能强行续命/g, '不宜在缺少现实条件时强行延续')
    .replace(/避免被套路/g, '核实是否存在利益误导或策略风险')
    .replace(/不能两头都要/g, '需要明确优先级与取舍')
    .replace(/需要承担代价或接受现实/g, '需要核实现实责任、成本与可承受范围')
    .replace(/[。.]$/, '');
  if (kind === '固定组合') {
    return `传统固定组合${cardsText}提示关注${conditionedText || targetText}；只可检查这些主题是否同时出现现实证据，不得直接认定婚约、生育、收益、欺骗或其他现实结果`;
  }
  if (kind === '相邻合读') {
    return `相邻牌${cardsText}按抽牌顺序形成${targetText}的合读范围；这不是传统固定组合，须逐项核实前后牌主题是否与现实进展相符`;
  }
  return `传统单牌${cardsText}以${targetText}为解释范围；可在当前牌位检查这些主题的现实线索，但不把原始牌义直接当作已发生事实`;
}

function buildTraditionalFacts(
  cards: LenormandEvidenceAnalysis['cards'],
  combinations: NonNullable<LenormandData['combinations']>,
): LenormandTraditionalFact[] {
  const cardByName = new Map(cards.map((card) => [card.name, card]));
  const cardFacts = cards.map((card): LenormandTraditionalFact => ({
    key: `card:${card.index}:${card.name}`,
    kind: '单牌牌义',
    cardNames: [card.name],
    positions: [card.position],
    originalText: card.meaning,
    promptText: conditionLenormandTraditionalText(card.meaning, {
      kind: '单牌牌义',
      cardNames: [card.name],
      keywords: card.keywords,
    }),
    verificationTargets: card.keywords,
    sources: ['36张雷诺曼牌组', '当前单牌关键词与基础牌义资料'],
    limitation: TRADITIONAL_FACT_LIMITATION,
  }));
  const combinationFacts = combinations.map((combo, index): LenormandTraditionalFact => {
    const first = cardByName.get(combo.card1);
    const second = cardByName.get(combo.card2);
    const kind = combo.source === '固定组合' ? '固定组合' : '相邻合读';
    const verificationTargets = unique([...(first?.keywords ?? []), ...(second?.keywords ?? [])]);
    return {
      key: `combination:${index + 1}:${combo.card1}:${combo.card2}:${kind}`,
      kind,
      cardNames: [combo.card1, combo.card2],
      positions: unique([first?.position ?? '', second?.position ?? '']),
      originalText: combo.meaning,
      promptText: conditionLenormandTraditionalText(combo.meaning, {
        kind,
        cardNames: [combo.card1, combo.card2],
        keywords: verificationTargets,
      }),
      verificationTargets,
      sources:
        kind === '固定组合'
          ? ['当前雷诺曼固定牌对解释资料']
          : ['当前相邻牌位顺序与两张牌的关键词、基础牌义'],
      limitation: TRADITIONAL_FACT_LIMITATION,
    };
  });
  return [...cardFacts, ...combinationFacts];
}

function createLayoutFact(
  fact: Omit<LenormandLayoutFact, 'source' | 'limitation'>,
): LenormandLayoutFact {
  return {
    ...fact,
    source: '当前牌阵的牌位顺序、行列坐标、宫位与牌间距离计算',
    limitation: LAYOUT_FACT_LIMITATION,
  };
}

function buildStructuredLayoutFacts(
  data: LenormandData,
  cards: LenormandEvidenceAnalysis['cards'],
): LenormandLayoutFact[] {
  if (data.spreadType === 'nine' && cards.length === 9) {
    const center = cards[4];
    const paths = [
      ['上排', cards.slice(0, 3)],
      ['中排', cards.slice(3, 6)],
      ['下排', cards.slice(6, 9)],
      ['左列', [cards[0], cards[3], cards[6]]],
      ['中列', [cards[1], cards[4], cards[7]]],
      ['右列', [cards[2], cards[5], cards[8]]],
      ['左上至右下对角线', [cards[0], cards[4], cards[8]]],
      ['右上至左下对角线', [cards[2], cards[4], cards[6]]],
    ] as const;
    return [
      createLayoutFact({
        key: 'nine:center',
        kind: '九宫中心',
        cardNames: [center.name],
        positions: [center.position],
        houses: [],
        factText: `九宫第2排第2列的中心位置为${center.name}`,
        promptText: `九宫中心计算事实为${center.name}；传统上可先作为全阵主轴读取，但仍须与各行列、对角线和现实资料互证`,
      }),
      ...paths.map(([label, path]) =>
        createLayoutFact({
          key: `nine:path:${label}`,
          kind: '九宫路径',
          cardNames: path.map((card) => card.name),
          positions: path.map((card) => card.position),
          houses: [],
          factText: `${label}依次为${path.map((card) => card.name).join('→')}`,
          promptText: `${label}计算路径为${path.map((card) => card.name).join('→')}；只用于比较该路径内的牌序与主题衔接，不单独生成现实结论`,
        }),
      ),
    ];
  }
  if (data.spreadType !== 'grandTableau' || cards.length !== 36) return [];
  const placementFacts = cards.map((card) =>
    createLayoutFact({
      key: `grand-tableau:position:${card.index}`,
      kind: '大桌宫位',
      cardNames: [card.name],
      positions: [card.position],
      houses: card.house ? [card.house] : [],
      factText: `${card.name}落第${card.index}宫${card.house ? `（${card.house}宫）` : ''}${card.row && card.column ? `，第${card.row}排第${card.column}列` : ''}`,
      promptText: `${card.name}的计算落点为第${card.index}宫${card.house ? `（${card.house}宫）` : ''}；宫位只限定传统合读范围，不直接证明事件或吉凶`,
    }),
  );
  const personFacts = ['男士', '女士'].flatMap((name) => {
    const card = cards.find((item) => item.name === name);
    if (!card?.row || !card.column) return [];
    const personRow = card.row;
    const personColumn = card.column;
    const neighbors = cards.filter((candidate) => {
      if (!candidate.row || !candidate.column || candidate.index === card.index) return false;
      return (
        Math.abs(candidate.row - personRow) <= 1 && Math.abs(candidate.column - personColumn) <= 1
      );
    });
    return [
      createLayoutFact({
        key: `grand-tableau:person:${name}`,
        kind: '人物牌近身',
        cardNames: [name, ...neighbors.map((item) => item.name)],
        positions: [card.position, ...neighbors.map((item) => item.position)],
        houses: unique([card.house ?? '', ...neighbors.map((item) => item.house ?? '')]),
        factText: `${name}位于第${card.row}排第${card.column}列，八邻域近身牌为${neighbors.map((item) => item.name).join('、') || '无'}`,
        promptText: `${name}的八邻域近身牌计算结果为${neighbors.map((item) => item.name).join('、') || '无'}；只可用于限定人物牌周边合读范围，不证明人物意图、关系或事件`,
      }),
    ];
  });
  const houseMatches = cards.filter((card) => card.house === card.name);
  const homeFacts = houseMatches.length
    ? [
        createLayoutFact({
          key: 'grand-tableau:home-cards',
          kind: '归宫',
          cardNames: houseMatches.map((card) => card.name),
          positions: houseMatches.map((card) => card.position),
          houses: houseMatches.map((card) => card.house ?? ''),
          factText: `归宫牌为${houseMatches.map((card) => card.name).join('、')}`,
          promptText: `计算得到${houseMatches.map((card) => card.name).join('、')}回到同名宫位；归宫只表示牌与宫名重合，须结合整桌牌序与现实资料复核`,
        }),
      ]
    : [];
  return [...placementFacts, ...personFacts, ...homeFacts];
}

export function analyzeLenormandEvidence(data: LenormandData): LenormandEvidenceAnalysis {
  if (!data.cards.length) throw new Error('雷诺曼结构化证据至少需要一张牌。');
  const cards = data.cards.map((card, index) => ({ ...card, index: index + 1 }));
  const sequence = cards.slice(1).map((card, index) => {
    const previous = cards[index];
    return `${previous.position}${previous.name} → ${card.position}${card.name}`;
  });
  const fixedCombinations = (data.combinations ?? []).filter((item) => item.source === '固定组合');
  const adjacentReadings = (data.combinations ?? []).filter((item) => item.source !== '固定组合');
  const traditionalFacts = buildTraditionalFacts(cards, data.combinations ?? []);
  const structuredLayoutFacts = buildStructuredLayoutFacts(data, cards);
  const drawFact = buildDrawFact(data);
  const drawFacts = data.draw
    ? [
        `牌组规模：${data.draw.deckSize}张；洗牌与取牌方法：${data.draw.method}`,
        ...data.draw.order.map(
          (item) =>
            `第${item.index}张对应${item.position}：牌号${item.cardId} ${item.cardName}${item.house ? `，落${item.house}宫` : ''}${item.row && item.column ? `，第${item.row}排第${item.column}列` : ''}`,
        ),
      ]
    : ['当前结果未附洗牌方法与抽取顺序，仅保留已确定牌面，不能反推完整抽牌来源链'];
  const layoutFacts = data.layoutEvidence ?? [];
  const trace = data.meta?.random;
  const randomFact = buildRandomTraceFact({
    key: `random:lenormand:${data.spreadType}`,
    applicable: true,
    trace,
    processLabel: `${data.spreadName}的洗牌与抽牌生成过程`,
    sources: ['雷诺曼牌阵与抽牌顺序记录', '洗牌、抽牌随机样本与重放元数据'],
  });
  const randomFacts = formatLegacyRandomFacts(randomFact);
  const counterEvidence = [
    fixedCombinations.length
      ? ''
      : '本次未命中当前资料已登记的固定组合，不得把普通相邻合读冒充传统定式',
    structuredLayoutFacts.length || layoutFacts.length
      ? ''
      : '当前牌阵没有九宫或大桌布局证据，只按牌位与相邻顺序读取',
  ].filter(Boolean);
  const limitations = [
    '雷诺曼抽牌包含随机过程；seed或replay只能复现抽牌轨迹，不证明预测有效性',
    '固定组合仅指当前采用的固定牌对资料中明确登记的组合，相邻牌义合读是当前牌序解释，二者证据等级不同',
    '九宫中心、横纵对角线、大桌宫位、近身牌和归宫牌只描述布局关系，不自动产生吉凶结论',
    '牌名、关键词、组合和布局属于象征解释材料，不是事件发生概率或现代统计证据',
    '单牌或单一组合不能证明他人意图、隐私、医疗、法律、财务事实或必然结果',
    '未给现实期限时不得把牌号、宫位或距离换算为唯一日期',
  ];
  const items: PromptEvidenceItem[] = [
    {
      level: '辅证',
      title: `牌阵结构：${data.spreadName}`,
      detail: `牌阵类型${data.spreadType}；共${cards.length}张；牌位依次为${cards.map((card) => card.position).join('、')}`,
      source: '当前牌阵配置与牌阵位置定义',
      tags: ['牌阵结构', data.spreadType, `${cards.length}张`],
    },
    {
      level: drawFact.status === '可核验' ? '辅证' : '反证',
      title: drawFact.status === '可核验' ? '洗牌与抽取顺序事实' : '抽牌来源链缺失',
      detail: `${drawFact.promptText}；边界：${drawFact.limitation}`,
      source: drawFact.sources.join('、'),
      tags: ['抽牌来源', drawFact.status, drawFact.status === '可核验' ? '可重放' : '不可反推'],
    },
    ...cards.map((card, index): PromptEvidenceItem => {
      const fact = traditionalFacts.find(
        (item) => item.kind === '单牌牌义' && item.cardNames[0] === card.name,
      );
      return {
        level: index === Math.floor(cards.length / 2) || cards.length === 1 ? '主证' : '辅证',
        title: `${card.position}：${card.name}`,
        detail: `关键词${card.keywords.join('、') || '未列'}；条件化牌义${fact?.promptText ?? conditionLenormandTraditionalText(card.meaning, { cardNames: [card.name], keywords: card.keywords })}${card.house ? `；计算落${card.house}宫` : ''}${card.row && card.column ? `；第${card.row}排第${card.column}列` : ''}；边界${TRADITIONAL_FACT_LIMITATION}。`,
        source: '当前牌阵牌位、抽取牌面与36张牌解释资料',
        tags: [card.position, card.name, ...card.keywords.slice(0, 3)],
      };
    }),
    ...(sequence.length
      ? [
          {
            level: '辅证' as const,
            title: '牌位顺序推进',
            detail: sequence.join('；'),
            source: '当前牌阵的既定牌位顺序',
            tags: ['牌序', '相邻关系'],
          },
        ]
      : []),
    {
      level: randomFact.status === '可重放' ? '辅证' : '反证',
      title: randomFact.status === '可重放' ? '随机过程重放记录' : '随机轨迹缺失',
      detail: `${randomFact.promptText}；边界：${randomFact.limitation}`,
      source: randomFact.sources.join('、'),
      tags: ['随机轨迹', randomFact.status, '不代表预测有效性'],
    },
  ];
  items.push(
    ...traditionalFacts
      .filter((fact) => fact.kind !== '单牌牌义')
      .map((fact): PromptEvidenceItem => ({
        level: fact.kind === '固定组合' ? '主证' : '辅证',
        title: `${fact.kind}${fact.cardNames.join('+')}`,
        detail: `${fact.promptText}；现实核验项${fact.verificationTargets.join('、') || '未列'}；边界${fact.limitation}`,
        source: fact.sources.join('、'),
        tags: [fact.kind, ...fact.cardNames],
      })),
    ...structuredLayoutFacts
      .filter((fact) => fact.kind !== '大桌宫位')
      .map((fact): PromptEvidenceItem => ({
        level: '辅证',
        title: `${fact.kind}：${fact.cardNames.slice(0, 3).join('→')}${fact.cardNames.length > 3 ? '等' : ''}`,
        detail: `${fact.factText}；解释边界${fact.promptText}；${fact.limitation}`,
        source: fact.source,
        tags: ['布局证据', fact.kind],
      })),
    ...(structuredLayoutFacts.length
      ? []
      : layoutFacts.map((detail, index): PromptEvidenceItem => ({
          level: '辅证',
          title: `旧版布局资料${index + 1}`,
          detail: `${detail}；该字符串只作旧结果兼容，不能替代可核验的结构化行列与宫位事实`,
          source: '旧版牌阵布局资料',
          tags: ['布局证据', '旧版兼容'],
        }))),
    ...counterEvidence.map((detail): PromptEvidenceItem => ({
      level: '反证',
      title: '当前证据缺口',
      detail,
      source: '组合词典与牌阵布局逐项核验',
    })),
    {
      level: '限制',
      title: '雷诺曼牌面解释边界',
      detail: limitations.join('；'),
      source: '随机事实、象征材料与现实结论分离原则',
      tags: ['象征解释', '现实复核'],
    },
  );
  const evidence: PromptEvidenceBundle = { title: '雷诺曼牌序组合与布局结构化证据', items };
  const promptText = [
    '【雷诺曼牌序组合与布局结构化证据】',
    ...formatPromptEvidenceBundle(evidence),
    `牌序关系：${sequence.join('；') || '单牌牌阵，无相邻推进关系'}。`,
    `组合分层：固定组合${fixedCombinations.length}组，相邻合读${adjacentReadings.length}组；逐组条件化解释已列在证据条目中。`,
    `布局覆盖：${structuredLayoutFacts.length ? `${structuredLayoutFacts.length}条结构化布局事实已保存；自然语言证据只展开中心、路径、人物牌近身与归宫，逐牌宫位落点见对应牌面条目` : layoutFacts.length ? '仅有旧版布局字符串，已按兼容资料列出' : '当前牌阵无额外九宫或大桌布局事实'}。`,
    `反证限制：${counterEvidence.join('；') || '已列组合与布局仍须结合牌位和现实资料复核'}。`,
  ].join('\n');
  return {
    cards,
    sequence,
    fixedCombinations,
    adjacentReadings,
    drawFact,
    drawFacts,
    layoutFacts,
    randomFact,
    randomFacts,
    counterEvidence,
    limitations,
    traditionalFacts,
    structuredLayoutFacts,
    evidence,
    promptText,
    methodology: [
      '先按牌阵固定牌位和抽牌顺序，再逐张读取牌名、关键词与基础牌义。',
      '抽牌来源单独保存牌组规模、Fisher-Yates洗牌方法、抽取序号与牌位落点，供结构化核验。',
      '固定组合与普通相邻合读分层保存，未命中固定组合时明确保留证据缺口。',
      '九宫和大桌仅增加可复核的空间关系，不把位置直接换算成吉凶或日期。',
      '所有象征解释均须回到用户问题和现实资料复核。',
    ],
  };
}
