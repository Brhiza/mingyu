/**
 * @file 塔罗牌算法
 * @传统依据 Rider-Waite-Smith 体系及 A. E. Waite《The Pictorial Key to the Tarot》通行牌义。
 */
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
export { analyzeTarotEvidence } from './tarot-evidence';
export type {
  TarotCardEvidence,
  TarotCounterEvidenceFact,
  TarotCounterSummaryFact,
  TarotDrawFact,
  TarotDrawOrderFact,
  TarotElementInteractionFact,
  TarotElementInteractionRelation,
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
  /** 用户在前端逐张抽牌时产生的原始随机样本，每张牌依次使用抽牌与正逆位两个样本。 */
  interactiveSamples?: readonly number[];
}

export interface TarotInteractiveCard {
  id: number;
  name: string;
  reversed: boolean;
}

function buildDrawFacts(
  cards: Array<{ id: number; name: string; position: string; reversed: boolean }>,
  method: 'random' | 'manual' | 'interactive' = 'random',
): NonNullable<TarotData['draw']> {
  return {
    deckSize: tarotCards.length,
    method:
      method === 'manual'
        ? '用户按牌位手工录入'
        : method === 'interactive'
          ? '用户逐张触发前端随机抽取'
          : 'Fisher-Yates洗牌后依牌位顺序取顶牌',
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

function assertInteractiveSample(sample: number, index: number) {
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
    throw new Error(`第${index + 1}个塔罗抽牌随机样本无效`);
  }
}

/** 根据前端已产生的随机样本复算当前抽牌进度，允许传入未完成牌阵的样本。 */
export function resolveInteractiveTarotCards(
  spreadType: TarotSpreadType,
  samples: readonly number[],
): TarotInteractiveCard[] {
  const spread = tarotSpreads[spreadType];
  if (!spread) throw new Error(`未知的牌阵类型: ${spreadType}`);
  if (samples.length % 2 !== 0) throw new Error('塔罗手动抽取每张牌需要两个随机样本');
  if (samples.length > spread.cardCount * 2) {
    throw new Error(`${spread.name}最多抽取${spread.cardCount}张牌`);
  }
  samples.forEach(assertInteractiveSample);

  const remaining = [...tarotCards];
  const selected: TarotInteractiveCard[] = [];
  for (let index = 0; index < samples.length; index += 2) {
    const cardIndex = Math.floor(samples[index] * remaining.length);
    const [card] = remaining.splice(cardIndex, 1);
    selected.push({
      id: card.number,
      name: card.name,
      reversed: samples[index + 1] < 0.5,
    });
  }
  return selected;
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
  return {
    keywords,
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

  if (options?.interactiveSamples && options.manualCards) {
    throw new Error('塔罗手动抽取不能同时提供手工录入牌面');
  }
  if (options?.interactiveSamples && hasRandomOptions(options)) {
    throw new Error('塔罗手动抽取样本不能同时提供随机选项');
  }

  if (options?.interactiveSamples) {
    if (options.interactiveSamples.length !== spread.cardCount * 2) {
      throw new Error(`${spread.name}需要逐张抽取${spread.cardCount}张牌`);
    }
    const cards = resolveInteractiveTarotCards(spreadType, options.interactiveSamples).map(
      (card, index) => ({
        ...card,
        position: spread.positions[index],
        ...getCardEvidence(card.name),
      }),
    );
    const timestamp = Date.now();
    const data = attachResultMeta(
      {
        spreadType,
        spreadName: spread.name,
        cards,
        draw: buildDrawFacts(cards, 'interactive'),
        timestamp,
      } satisfies Omit<TarotData, 'meta' | 'evidenceAnalysis'>,
      {
        algorithm: 'tarot.spread.interactive',
        input: { spreadType },
        calculatedAt: timestamp,
        random: { mode: 'system', samples: [...options.interactiveSamples] },
      },
    );
    return { ...data, evidenceAnalysis: analyzeTarotEvidence(data) };
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
