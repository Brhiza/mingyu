import { tarotCards, tarotSpreads } from './tarot-data';
import type { RandomOptions } from '../shared/random';
import {
  createRandomContext,
  hasRandomOptions,
  randomFloat,
  randomInt,
  type RandomSource,
} from '../shared/random';
import { attachResultMeta } from '../shared/result';
import type { TarotData, TarotSpreadType } from '../types/divination';
import { analyzeTarotEvidence } from './tarot-evidence';

export { tarotCards, tarotSpreads } from './tarot-data';
export { analyzeTarotEvidence, conditionTarotTraditionalText } from './tarot-evidence';
export type {
  TarotCardEvidence,
  TarotCounterEvidenceFact,
  TarotCounterSummaryFact,
  TarotDrawFact,
  TarotDrawOrderFact,
  TarotEvidenceAnalysis,
  TarotLimitationFact,
  TarotSequenceFact,
  TarotSpreadCoverageFact,
  TarotThemeFact,
  TarotTraditionalFact,
} from './tarot-evidence';

export interface TarotManualCardInput {
  id: number;
  reversed: boolean;
}

export interface TarotDrawOptions extends RandomOptions {
  manualCards?: readonly TarotManualCardInput[];
}

function buildDrawFacts(
  cards: Array<{ id: number; name: string; position: string; reversed: boolean }>,
  method: 'random' | 'manual' = 'random',
): NonNullable<TarotData['draw']> {
  return {
    deckSize: tarotCards.length,
    method: method === 'manual' ? '用户按牌位手工录入' : 'Fisher-Yates洗牌后依牌位顺序取顶牌',
    orientationRule:
      method === 'manual'
        ? '正逆位由用户逐张录入'
        : '每张牌独立取随机数，小于0.5为逆位，否则为正位',
    order: cards.map((card, index) => ({
      index: index + 1,
      position: card.position,
      cardId: card.id,
      cardName: card.name,
      orientation: card.reversed ? '逆位' : '正位',
    })),
  };
}

function shuffleCards(rng: RandomSource) {
  const shuffled = [...tarotCards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = randomInt(i + 1, rng);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function drawSingleCard(options?: RandomOptions) {
  const context = createRandomContext(options);
  const rng = context.random;
  const shuffled = shuffleCards(rng);
  const card = shuffled[0];
  const isReversed = randomFloat(rng) < 0.5;
  const timestamp = Date.now();

  return attachResultMeta(
    {
      card,
      isReversed,
      position: '当前指引',
      timestamp,
    },
    {
      algorithm: 'tarot.single',
      input: { spreadType: 'single' },
      calculatedAt: timestamp,
      random: context.getTrace(),
    },
  );
}

export function drawSpreadCards(spreadType: keyof typeof tarotSpreads, options?: RandomOptions) {
  const spread = tarotSpreads[spreadType];
  if (!spread) {
    throw new Error(`未知的牌阵类型: ${spreadType}`);
  }

  const context = createRandomContext(options);
  const rng = context.random;
  const shuffled = shuffleCards(rng);
  const cards = [];

  for (let i = 0; i < spread.cardCount; i++) {
    const card = shuffled[i];
    const isReversed = randomFloat(rng) < 0.5;

    cards.push({
      card: card,
      isReversed: isReversed,
      position: spread.positions[i],
    });
  }

  const timestamp = Date.now();
  return attachResultMeta(
    {
      spreadType,
      spreadName: spread.name,
      cards,
      timestamp,
    },
    {
      algorithm: 'tarot.spread',
      input: { spreadType },
      calculatedAt: timestamp,
      random: context.getTrace(),
    },
  );
}

export function getCardKeywords(cardName: string): string {
  const keywordsMap: Record<string, string> = {
    愚者: '新开始,冒险,纯真',
    魔术师: '意志力,创造,技能',
    女祭司: '直觉,神秘,内在智慧',
    女皇: '丰饶,母性,创造力',
    皇帝: '权威,稳定,父性',
    教皇: '传统,精神指导,宗教',
    恋人: '爱情,选择,和谐',
    战车: '胜利,意志力,控制',
    力量: '勇气,耐心,内在力量',
    隐士: '内省,寻找,智慧',
    命运之轮: '命运,变化,循环',
    正义: '公正,平衡,真理',
    倒吊人: '牺牲,等待,新视角',
    死神: '转变,结束,重生',
    节制: '平衡,耐心,调和',
    恶魔: '诱惑,束缚,物质',
    塔: '突变,破坏,启示',
    星星: '希望,灵感,指引',
    月亮: '幻象,恐惧,潜意识',
    太阳: '成功,喜悦,活力',
    审判: '重生,觉醒,宽恕',
    世界: '完成,成就,圆满',
    权杖王牌: '新机会,创造力,灵感',
    权杖二: '计划,未来,个人力量',
    权杖三: '扩张,远见,领导力',
    权杖四: '庆祝,和谐,家庭',
    权杖五: '冲突,竞争,分歧',
    权杖六: '胜利,公众认可,进步',
    权杖七: '挑战,坚持,防御',
    权杖八: '快速行动,急速,消息',
    权杖九: '坚韧,毅力,最后防线',
    权杖十: '负担,责任,努力',
    权杖侍者: '热情,探索,信使',
    权杖骑士: '能量,激情,行动',
    权杖王后: '自信,魅力,独立',
    权杖国王: '领导力,远见,权威',
    圣杯王牌: '新感情,爱,创造力',
    圣杯二: '结合,伙伴,吸引',
    圣杯三: '庆祝,友谊,社群',
    圣杯四: '冷漠,沉思,重评',
    圣杯五: '失落,悲伤,失望',
    圣杯六: '怀旧,童年,重逢',
    圣杯七: '幻想,选择,白日梦',
    圣杯八: '放弃,前行,寻找',
    圣杯九: '满足,愿望成真,舒适',
    圣杯十: '和谐,家庭,幸福',
    圣杯侍者: '创意,直觉,信使',
    圣杯骑士: '浪漫,魅力,想象',
    圣杯王后: '同情,平静,直觉',
    圣杯国王: '情绪成熟,控制,慈悲',
    宝剑王牌: '清晰,真理,新想法',
    宝剑二: '僵局,逃避,艰难选择',
    宝剑三: '心碎,悲伤,真相',
    宝剑四: '休息,休战,沉思',
    宝剑五: '冲突,失败,不光彩的胜利',
    宝剑六: '过渡,前行,解脱',
    宝剑七: '欺骗,策略,不诚实',
    宝剑八: '限制,孤立,自我束缚',
    宝剑九: '焦虑,噩梦,恐惧',
    宝剑十: '终结,背叛,谷底',
    宝剑侍者: '好奇,警惕,信使',
    宝剑骑士: '野心,仓促,行动',
    宝剑王后: '独立,清晰,智慧',
    宝剑国王: '权威,真理,智力',
    钱币王牌: '机会,繁荣,新事业',
    钱币二: '平衡,适应,变化',
    钱币三: '团队合作,技艺,品质',
    钱币四: '占有,控制,稳定',
    钱币五: '贫困,逆境,孤立',
    钱币六: '慷慨,慈善,分享',
    钱币七: '耐心,投资,回报',
    钱币八: '技能,勤奋,精通',
    钱币九: '富足,独立,享受',
    钱币十: '财富,传承,家庭',
    钱币侍者: '新机会,学习,梦想',
    钱币骑士: '勤奋,可靠,责任',
    钱币王后: '务实,母性,滋养',
    钱币国王: '富裕,成功,安全',
  };

  const keywords = keywordsMap[cardName];
  if (!keywords) {
    throw new Error(`未知的塔罗牌名: ${cardName}`);
  }
  return keywords;
}

const MAJOR_REVERSED_MEANINGS: Record<string, string> = {
  愚者: '冲动冒险、准备不足，或因害怕未知而不敢开始',
  魔术师: '能力没有用在正确方向，或存在夸大、操控和执行不足',
  女祭司: '忽略直觉、信息被隐藏，或过度封闭在内心',
  女皇: '给予过度、依赖照顾，或创造和成长暂时受阻',
  皇帝: '控制过度、规则僵化，或缺少稳定边界',
  教皇: '盲从传统、权威失效，或需要找到自己的价值标准',
  恋人: '价值观不一、关系失衡，或在重要选择上摇摆',
  战车: '方向不一、控制失灵，或因过度用力而失去节奏',
  力量: '自信不足、情绪失控，或把勇气变成硬撑',
  隐士: '过度孤立、回避现实，或还没找到真正答案',
  命运之轮: '转机延迟、反复踩入旧循环，或抗拒必要变化',
  正义: '判断失衡、回避责任，或公平结果尚未落定',
  倒吊人: '无意义拖延、拒绝换角度，或付出与收获不对等',
  死神: '不愿结束、卡在过渡期，或转变进行得不彻底',
  节制: '节奏失衡、过度折中，或双方暂时无法调和',
  恶魔: '看见束缚却难以脱身，或开始意识到需要戒断依赖',
  塔: '危机被拖延、内部结构已不稳，或仍在回避必要的打破',
  星星: '信心不足、期望脱离现实，或需要重建长期希望',
  月亮: '恐惧和猜疑加重，或隐藏信息正在慢慢显现',
  太阳: '快乐被遮挡、过度乐观，或成功比预期更晚到来',
  审判: '回避复盘、自我怀疑，或重要决定还没有做出',
  世界: '临门一步尚未完成，或需要补齐遗漏才能收尾',
};

function getTarotElement(cardName: string): string {
  if (cardName.startsWith('权杖')) return '火（行动、动力、创造）';
  if (cardName.startsWith('圣杯')) return '水（感受、关系、直觉）';
  if (cardName.startsWith('宝剑')) return '风（思考、沟通、决断）';
  if (cardName.startsWith('钱币')) return '土（资源、工作、现实）';
  return '大阿卡纳（核心课题与阶段转折）';
}

function getTarotArchetype(cardName: string): string {
  if (cardName.endsWith('王牌')) return '起点、种子与新机会';
  if (cardName.endsWith('侍者')) return '学习、消息与初步尝试';
  if (cardName.endsWith('骑士')) return '推进方式、行动节奏与过程';
  if (cardName.endsWith('王后')) return '内在掌握、成熟表达与照顾';
  if (cardName.endsWith('国王')) return '外在掌握、责任与决策';
  const numberMatch = cardName.match(/[二三四五六七八九十]$/);
  return numberMatch ? `数字${numberMatch[0]}的发展阶段` : '大阿卡纳的人生主轴';
}

export function getCardEvidence(cardName: string) {
  const keywords = getCardKeywords(cardName).split(',');
  const uprightMeaning = `正位强调${keywords.join('、')}，表示这些能量正在直接发挥作用。`;
  const reversedMeaning = MAJOR_REVERSED_MEANINGS[cardName]
    ? `逆位重点：${MAJOR_REVERSED_MEANINGS[cardName]}。`
    : `逆位表示${keywords.join('、')}相关能量可能受阻、过度、内化或方向偏离，需结合当前牌位判断。`;
  return {
    keywords,
    uprightMeaning,
    reversedMeaning,
    element: getTarotElement(cardName),
    archetype: getTarotArchetype(cardName),
  };
}

export function drawTarotSpread(
  spreadType: TarotSpreadType = 'single',
  options?: TarotDrawOptions,
): TarotData {
  const spread = tarotSpreads[spreadType];
  if (!spread) {
    throw new Error(`未知的牌阵类型: ${spreadType}`);
  }

  if (options?.manualCards) {
    if (hasRandomOptions(options)) {
      throw new Error('手工录入塔罗牌时不能同时提供随机选项');
    }
    if (options.manualCards.length !== spread.cardCount) {
      throw new Error(`${spread.name}需要按牌位录入${spread.cardCount}张牌`);
    }
    const ids = options.manualCards.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      throw new Error('同一次塔罗牌阵不能重复录入同一张牌');
    }
    const cards = options.manualCards.map((input, index) => {
      const card = tarotCards.find((item) => item.number === input.id);
      if (!card || typeof input.reversed !== 'boolean') {
        throw new Error(`第${index + 1}张塔罗牌录入无效`);
      }
      return {
        id: card.number,
        name: card.name,
        position: spread.positions[index],
        reversed: input.reversed,
        ...getCardEvidence(card.name),
      };
    });
    const timestamp = Date.now();
    const data = attachResultMeta(
      {
        spreadType,
        spreadName: spread.name,
        cards,
        draw: buildDrawFacts(cards, 'manual'),
        timestamp,
      } satisfies Omit<TarotData, 'meta' | 'evidenceAnalysis'>,
      {
        algorithm: 'tarot.spread.manual',
        input: { spreadType, manualCards: options.manualCards },
        calculatedAt: timestamp,
      },
    );
    return { ...data, evidenceAnalysis: analyzeTarotEvidence(data) };
  }

  if (spreadType === 'single') {
    const draw = drawSingleCard(options);
    const data: TarotData = {
      spreadType,
      spreadName: '单牌指引',
      cards: [
        {
          id: draw.card.number,
          name: draw.card.name,
          position: draw.position,
          reversed: draw.isReversed,
          ...getCardEvidence(draw.card.name),
        },
      ],
      timestamp: draw.timestamp,
      meta: draw.meta,
    };
    data.draw = buildDrawFacts(data.cards);
    data.evidenceAnalysis = analyzeTarotEvidence(data);
    return data;
  }

  const draw = drawSpreadCards(spreadType, options);
  const data: TarotData = {
    spreadType,
    spreadName: draw.spreadName,
    cards: draw.cards.map((item) => ({
      id: item.card.number,
      name: item.card.name,
      position: item.position,
      reversed: item.isReversed,
      ...getCardEvidence(item.card.name),
    })),
    timestamp: draw.timestamp,
    meta: draw.meta,
  };
  data.draw = buildDrawFacts(data.cards);
  data.evidenceAnalysis = analyzeTarotEvidence(data);
  return data;
}
