import { tarotCards, tarotSpreads } from './tarot-data';

export { tarotSpreads } from './tarot-data';

function shuffleCards() {
  const shuffled = [...tarotCards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * 抽取单张塔罗牌
 *
 * 从 78 张塔罗牌中随机洗牌后抽取第一张，用于单牌指引类占卜。
 *
 * @returns 一张塔罗牌，含牌名、正逆位、位置（固定为"当前指引"）和时间戳。
 *
 * @example
 * ```ts
 * const result = drawSingleCard();
 * // => { card: { number: 1, name: '魔术师', ... }, isReversed: false, position: '当前指引', timestamp: 1700000000000 }
 * ```
 */
export function drawSingleCard() {
  const shuffled = shuffleCards();
  const card = shuffled[0];
  const isReversed = Math.random() < 0.5;

  return {
    card: card,
    isReversed: isReversed,
    position: '当前指引',
    timestamp: Date.now(),
  };
}

/**
 * 抽取指定牌阵的多张塔罗牌
 *
 * 根据 spreadType 从已定义牌阵中取对应数量和位置的牌。
 * 支持 single、three、love、career、celtic 等十余种牌阵。
 *
 * @param spreadType 牌阵类型，必须是 tarotSpreads 中定义的键名。
 * @returns 牌阵结果，含牌名、正逆位、位置名称和时间戳。
 *
 * @example
 * ```ts
 * const result = drawSpreadCards('three');
 * // => { spreadType: 'three', spreadName: '三张牌阵', cards: [...] }
 * ```
 */
export function drawSpreadCards(spreadType: keyof typeof tarotSpreads) {
  const spread = tarotSpreads[spreadType];
  if (!spread) {
    throw new Error(`未知的牌阵类型: ${spreadType}`);
  }

  const shuffled = shuffleCards();
  const cards = [];

  for (let i = 0; i < spread.cardCount; i++) {
    const card = shuffled[i];
    const isReversed = Math.random() < 0.5;

    cards.push({
      card: card,
      isReversed: isReversed,
      position: spread.positions[i],
    });
  }

  return {
    spreadType,
    spreadName: spread.name,
    cards: cards,
    timestamp: Date.now(),
  };
}

/**
 * 获取塔罗牌关键字描述
 *
 * @param cardName 塔罗牌名称，如 "愚者"、"魔术师"
 * @returns 逗号分隔的关键字字符串
 *
 * @example
 * ```ts
 * const keywords = getCardKeywords('愚者');
 * // => '开始,冒险,纯真,自由,新旅程'
 * ```
 */
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

  return keywordsMap[cardName] || '神秘,指引,启示';
}
