import { dedupeExcerpts, type ClassicExcerpt } from './types';
import { selectYilinClassic } from './yilin';
import { selectZhouyiWingClassics } from '../zhouyi-text';

interface LiuyaoCategoryEntry {
  category:
    | 'wealth'
    | 'career'
    | 'marriage'
    | 'health'
    | 'travel'
    | 'lost'
    | 'litigation'
    | 'house';
  title: string;
  book: string;
  chapter: string;
  verse: string;
  explanation: string;
}

interface LiuyaoMovementEntry {
  key: string;
  trigger: string;
  book: string;
  chapter?: string;
  originalVerse: string;
  generalMeaning: string;
}

/**
 * 六爻分类占断《黄金策·分类篇》经典古训
 */
const CANONICAL_LIUYAO_CATEGORIES: LiuyaoCategoryEntry[] = [
  {
    category: 'wealth',
    title: '黄金策 · 求财篇',
    book: '黄金策',
    chapter: '分类篇',
    verse: '财福同旺，何须卜筮；财衰鬼旺，买卖多乖。兄爻发动，破耗难免；子孙持世，日进斗金。',
    explanation:
      '以妻财为用神，子孙为原神，兄弟为忌神，官鬼为泄神。财旺子兴为大吉，兄鬼持世动发为破败之兆。',
  },
  {
    category: 'career',
    title: '黄金策 · 求官篇',
    book: '黄金策',
    chapter: '分类篇',
    verse: '官星克世，显贵之兆；鬼旺身衰，反成灾祸。父母持世文书稳，子孙发动罢官归。',
    explanation:
      '以官鬼为用神，父母为原神（主文书权柄），子孙为忌神（克官），兄弟为竞争。官旺印成必得晋升。',
  },
  {
    category: 'marriage',
    title: '黄金策 · 婚姻篇',
    book: '黄金策',
    chapter: '分类篇',
    verse:
      '男占财为妇，女占鬼为夫；应世相生相合者，百年琴瑟喜和谐。世克应爻妻听从，应克世爻夫受屈。',
    explanation:
      '男测以妻财为用，女测以官鬼为用，兼看应爻（对方）与世爻（自己）之生克比和。六合大吉，六冲主散。',
  },
  {
    category: 'health',
    title: '黄金策 · 疾病篇',
    book: '黄金策',
    chapter: '分类篇',
    verse: '官鬼为病子为药，世爻受克病沉疴。鬼爻入墓缠绵久，子孙持世霍然愈。',
    explanation: '以官鬼为病症，子孙为医药，世爻为患者本身。官弱子旺则疾自消，鬼旺世衰则危殆。',
  },
  {
    category: 'travel',
    title: '黄金策 · 出行篇',
    book: '黄金策',
    chapter: '分类篇',
    verse: '世动身摇心欲往，应爻受阻迟不发。子孙临世平安路，官鬼当头盗贼惊。',
    explanation:
      '以世爻为自身，应爻为目的地，子孙为平安福神，官鬼兄弟为险阻破耗。世动子旺一路顺风。',
  },
  {
    category: 'lost',
    title: '黄金策 · 失物篇',
    book: '黄金策',
    chapter: '分类篇',
    verse: '鬼临玄武贼人盗，财落空亡寻不见。用神旺相在内卦，不出家门自可寻。',
    explanation:
      '以所失之物之六亲为用神（金银钱物看财，书画文书看父，车船看父，牲畜小宠看子）。内卦在家中，外卦在远方。',
  },
  {
    category: 'litigation',
    title: '黄金策 · 词讼篇',
    book: '黄金策',
    chapter: '分类篇',
    verse:
      '官鬼为官府，世应判输赢。世克应爻我必胜，应克世爻彼占优。子孙发动争端息，父母文书理分明。',
    explanation: '世为我方，应为对方，官鬼为法官裁判，父母为诉状案卷。世旺克应或得官生者胜诉。',
  },
  {
    category: 'house',
    title: '黄金策 · 家宅篇',
    book: '黄金策',
    chapter: '分类篇',
    verse:
      '父母为堂屋，官鬼为门庭。子孙兴隆家道泰，兄弟争克耗资财。六爻安谧人口吉，四野清宁福禄来。',
    explanation:
      '以初爻为宅基地，二爻为房屋，三爻为门，四爻为户，五爻为人，六爻为栋梁栋宇。六亲各有所主。',
  },
];

const CATEGORY_ALIASES: Record<string, LiuyaoCategoryEntry['category']> = {
  wealth: 'wealth',
  求财: 'wealth',
  财运: 'wealth',
  caifu: 'wealth',
  career: 'career',
  求官: 'career',
  事业: 'career',
  shiye: 'career',
  marriage: 'marriage',
  婚姻: 'marriage',
  感情: 'marriage',
  ganqing: 'marriage',
  health: 'health',
  疾病: 'health',
  健康: 'health',
  travel: 'travel',
  出行: 'travel',
  lost: 'lost',
  失物: 'lost',
  litigation: 'litigation',
  词讼: 'litigation',
  官司: 'litigation',
  house: 'house',
  家宅: 'house',
};

/**
 * 六爻动变进退与生克核心规则（节录自《增删卜易》《黄金策》）
 */
const CANONICAL_LIUYAO_MOVEMENT_CHANGES: LiuyaoMovementEntry[] = [
  {
    key: 'change_advance',
    trigger: '动化进神',
    book: '增删卜易',
    originalVerse: '化进神者，如日方升，如春发木；吉事增吉，凶事增凶，后劲绵长。',
    generalMeaning:
      '爻由弱变强、由退变进（如寅化卯、申化酉、丑化辰）。代表势头不可阻挡，蓬勃发展。',
  },
  {
    key: 'change_retreat',
    trigger: '动化退神',
    book: '增删卜易',
    originalVerse: '化退神者，如日西斜，如秋凋叶；吉事渐消，凶事渐退，虎头蛇尾。',
    generalMeaning: '爻由盛转衰（如卯化寅、酉化申、未化辰）。代表动力不足、渐渐萎缩。',
  },
  {
    key: 'change_birth',
    trigger: '动化回头生',
    book: '黄金策',
    originalVerse: '化回头生者，如旱苗得雨，如枯木逢春；自强不息，源源不竭。',
    generalMeaning: '变出之爻反过来生助本爻（如木爻化子水、火爻化卯木）。绝处生机，后劲极大。',
  },
  {
    key: 'change_clash',
    trigger: '动化回头克',
    book: '黄金策',
    originalVerse: '化回头克者，如草遭霜，如树遭斧；始勤终怠，反受其戕。',
    generalMeaning: '变出之爻反过来克伐本爻（如木爻化申金、金爻化午火）。自己作茧自缚，后果反噬。',
  },
];

const CANONICAL_LIUYAO_STRUCTURE_RULES: Record<string, LiuyaoMovementEntry> = {
  伏神: {
    key: 'hidden_spirit',
    trigger: '飞伏神藏透',
    book: '增删卜易',
    chapter: '飞伏神章',
    originalVerse: '伏神虽隐，透出亦能成用；最喜飞来生伏、日月生扶，最忌伏神空破、飞神克害。',
    generalMeaning: '本卦缺失某个六亲时，由本宫首卦借出伏神作线索；待冲开飞神、出空或得月日帮扶时事情可现形。',
  },
  六冲卦: {
    key: 'six_clash',
    trigger: '六冲卦象',
    book: '黄金策',
    chapter: '千金赋',
    originalVerse: '六冲主散，近病逢冲即愈，久病逢冲则危；新谋多生波折，旧怨易见拆离。',
    generalMeaning: '六爻上下皆冲，代表事情节奏急促、聚散分明。利清障解纷、短平快处理，不利图谋久远安稳。',
  },
  六合卦: {
    key: 'six_harmony',
    trigger: '六合卦象',
    book: '黄金策',
    chapter: '千金赋',
    originalVerse: '六合主和，谋事易成，婚姻美满，合作缠绵；若占脱身解纷，反恐牵连难断。',
    generalMeaning: '六爻两两相合，利于缔结关系、谈判撮合、稳步推进，但遇到想快速抽身止损之事反主拖延纠缠。',
  },
  反吟: {
    key: 'fan_yin',
    trigger: '卦遇反吟',
    book: '增删卜易',
    chapter: '反吟伏吟章',
    originalVerse: '反吟主事反复难定，去而复来、成而复败，须防半途生变。',
    generalMeaning: '本卦与变卦干支冲克反复，代表推进中易有来回拉扯或二次折腾，宜留足备选方案。',
  },
  伏吟: {
    key: 'fu_yin',
    trigger: '卦遇伏吟',
    book: '增删卜易',
    chapter: '反吟伏吟章',
    originalVerse: '伏吟之象，事多停滞难伸，欲进不得，宜忍耐静待冲开动象。',
    generalMeaning: '本变卦爻支重逢不动或同支相吟，说明局势闷局卡顿，强攻收效微，需待外因或时节打破僵局。',
  },
};

export function selectLiuyaoClassics({
  movingCount,
  hasFuShen,
  category,
  changeTypes,
  isSixClash,
  isSixHarmony,
  fanFuYin,
  originalHexagram,
  changedHexagram,
}: {
  movingCount?: number;
  hasFuShen?: boolean;
  category?: string;
  changeTypes?: readonly string[];
  isSixClash?: boolean;
  isSixHarmony?: boolean;
  fanFuYin?: string;
  originalHexagram?: string;
  changedHexagram?: string;
} = {}): ClassicExcerpt[] {
  const results: ClassicExcerpt[] = [];

  if (category) {
    const normalized = CATEGORY_ALIASES[category.trim()];
    const matched = CANONICAL_LIUYAO_CATEGORIES.find(
      (c) => c.category === (normalized ?? category.trim()),
    );
    if (matched) {
      results.push({
        book: matched.book,
        chapter: matched.chapter,
        title: matched.title,
        quote: matched.verse,
        explanation: matched.explanation,
        condition: matched.title.replace('黄金策 · ', ''),
      });
    }
  }

  // 若调用方传入了实际动变列表，则精确只匹配本卦真正出现的动变规则（避免张冠李戴）
  if (changeTypes !== undefined) {
    const joined = changeTypes.join(' ');
    for (const rule of CANONICAL_LIUYAO_MOVEMENT_CHANGES) {
      const token = rule.trigger.replace(/^动化/, '');
      if (joined.includes(token)) {
        results.push({
          book: rule.book,
          chapter: rule.chapter,
          title: rule.trigger,
          quote: rule.originalVerse,
          explanation: rule.generalMeaning,
          condition: `本卦命中${rule.trigger}`,
        });
      }
    }
  } else if (typeof movingCount === 'number' && movingCount > 0) {
    for (const rule of CANONICAL_LIUYAO_MOVEMENT_CHANGES) {
      results.push({
        book: rule.book,
        chapter: rule.chapter,
        title: rule.trigger,
        quote: rule.originalVerse,
        explanation: rule.generalMeaning,
        condition: `共 ${movingCount} 爻发动`,
      });
    }
  }

  if (isSixClash) {
    const r = CANONICAL_LIUYAO_STRUCTURE_RULES['六冲卦']!;
    results.push({ book: r.book, chapter: r.chapter, title: r.trigger, quote: r.originalVerse, explanation: r.generalMeaning, condition: '主卦六冲' });
  }
  if (isSixHarmony) {
    const r = CANONICAL_LIUYAO_STRUCTURE_RULES['六合卦']!;
    results.push({ book: r.book, chapter: r.chapter, title: r.trigger, quote: r.originalVerse, explanation: r.generalMeaning, condition: '主卦六合' });
  }
  if (fanFuYin?.includes('反吟')) {
    const r = CANONICAL_LIUYAO_STRUCTURE_RULES['反吟']!;
    results.push({ book: r.book, chapter: r.chapter, title: r.trigger, quote: r.originalVerse, explanation: r.generalMeaning, condition: '卦象反吟' });
  }
  if (fanFuYin?.includes('伏吟')) {
    const r = CANONICAL_LIUYAO_STRUCTURE_RULES['伏吟']!;
    results.push({ book: r.book, chapter: r.chapter, title: r.trigger, quote: r.originalVerse, explanation: r.generalMeaning, condition: '卦象伏吟' });
  }
  if (hasFuShen) {
    const r = CANONICAL_LIUYAO_STRUCTURE_RULES['伏神']!;
    results.push({ book: r.book, chapter: r.chapter, title: r.trigger, quote: r.originalVerse, explanation: r.generalMeaning, condition: '本卦带伏神' });
  }

  const yilinExcerpt = selectYilinClassic({
    baseHexagram: originalHexagram,
    targetHexagram: changedHexagram,
  });
  if (yilinExcerpt) {
    results.push(yilinExcerpt);
  }

  results.push(
    ...selectZhouyiWingClassics({
      originalHexagram,
      changedHexagram,
      movingCount,
    }),
  );

  return dedupeExcerpts(results);
}
