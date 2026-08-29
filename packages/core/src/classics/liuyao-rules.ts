import type { LiuyaoMovementRule } from './types';

export interface LiuyaoCategoryChapter {
  category:
    'wealth' | 'career' | 'marriage' | 'health' | 'travel' | 'lost' | 'litigation' | 'house';
  title: string;
  sourceBook: string;
  verse: string;
  explanation: string;
}

/**
 * 六爻《黄金策》《增删卜易》《卜筮正宗》《断易天机》经典动爻与神煞断语全库
 */
export const LIUYAO_MOVEMENT_RULES: Record<string, LiuyaoMovementRule> = {
  // 六亲发动
  parent_active: {
    key: 'parent_active',
    trigger: '父母爻发动',
    sourceBook: '黄金策',
    originalVerse: '父母发动伤子孙，求名求官大吉昌；占病见伤防小口，买卖文书利万箱。',
    generalMeaning: '父母爻生兄弟、克子孙、泄官鬼。主文书契约、长辈房屋、劳碌辛苦。',
    topicSpecificAdvice: {
      career: '利求名、文书、考试、论文答辩、签约盖章，大吉之兆。',
      wealth: '不利投资生财，劳心劳力，适合固定资产或版权文书收益。',
      relationship: '多得长辈撮合，但易因现实琐事或家庭观念产生波折。',
      health: '问长辈病吉，问晚辈小儿病重危，需防劳累过度。',
    },
  },
  child_active: {
    key: 'child_active',
    trigger: '子孙爻发动',
    sourceBook: '黄金策',
    originalVerse: '子孙发动伤官鬼，占病求医得安康；买卖求财千倍利，求官求名反遭殃。',
    generalMeaning: '子孙爻生妻财、克官鬼、泄兄弟。为福德之神，主快乐、解灾、生财、医药。',
    topicSpecificAdvice: {
      career: '不利求官晋升、考公面试或见上级，容易有违规或辞职变动。',
      wealth: '求财第一吉神！源远流长，商机大发，投资回报丰厚。',
      relationship: '利男性占感情，温馨浪漫；女性占婚主挑剔不满或克夫。',
      health: '大吉之兆！良医有救，药到病除，忧患尽消。',
    },
  },
  officer_active: {
    key: 'officer_active',
    trigger: '官鬼爻发动',
    sourceBook: '黄金策',
    originalVerse: '官鬼发动克兄弟，求名求官上云霄；占病多凶忧患重，买卖防盗祸难逃。',
    generalMeaning: '官鬼爻生父母、克兄弟、泄妻财。为主管、名望、疾病、是非、压力。',
    topicSpecificAdvice: {
      career: '大吉之兆！权柄在握，名望提升，升职在即。',
      wealth: '容易被官府、机构或盗贼抽成破财，不宜投机。',
      relationship: '女性占婚大吉，夫星得位；男性占防情敌与烦恼。',
      health: '病势沉重，惊恐不安，需防旧疾复发或外部感染。',
    },
  },
  wealth_active: {
    key: 'wealth_active',
    trigger: '妻财爻发动',
    sourceBook: '黄金策',
    originalVerse: '妻财发动克父母，求财经商得万全；占文不利防破印，占婚和顺福连绵。',
    generalMeaning: '妻财爻生官鬼、克父母、泄子孙。主资财、商业、妻子、饮食、现实利益。',
    topicSpecificAdvice: {
      career: '不利文书考试、职称评审，但利于商业管理与职场创收。',
      wealth: '财源广进，现钱到手，大吉大利。',
      relationship: '男性占婚极其吉美，情深意浓；家庭和睦。',
      health: '父母长辈身体欠安，自身防因饮食不节生病。',
    },
  },
  brother_active: {
    key: 'brother_active',
    trigger: '兄弟爻发动',
    sourceBook: '黄金策',
    originalVerse: '兄弟发动克妻财，求谋万事阻多灾；占财破耗防侵夺，同伴同心事可猜。',
    generalMeaning: '兄弟爻生子孙、克妻财、泄父母。主同伴、竞争、分流、破耗、争夺。',
    topicSpecificAdvice: {
      career: '竞争对手激烈，易遭同僚分功或抢夺成果。',
      wealth: '大忌求财！必有破耗、被骗、合伙散伙或高额垫资。',
      relationship: '婚恋受阻，多有竞争者插足或经济纠纷。',
      health: '问自身吉，问妻子、财物与下属欠安。',
    },
  },

  // 六神发动
  dragon_active: {
    key: 'dragon_active',
    trigger: '青龙发动',
    sourceBook: '卜筮正宗',
    originalVerse: '青龙发动喜气生，求谋万事得亨通；买卖添财人益寿，求官进爵福重重。',
    generalMeaning: '青龙为吉庆之神，主喜事、宴饮、升迁、财喜、贵人相助。',
    topicSpecificAdvice: {
      career: '得贵人提拔，名利双收，喜气盈门。',
      wealth: '利于正道经营，财源茂盛，合作愉快。',
      relationship: '喜结良缘，添丁进口，和合欢欣。',
      health: '身体安康，精神焕发，吉星高照。',
    },
  },
  bird_active: {
    key: 'bird_active',
    trigger: '朱雀发动',
    sourceBook: '卜筮正宗',
    originalVerse: '朱雀发动文书动，是非口舌也相从；求官问信皆有望，占病防生热闷烘。',
    generalMeaning: '朱雀为主管文书、信息、言语之神，动则主口舌官非、文书信息、争辩喧哗。',
    topicSpecificAdvice: {
      career: '利考试签约、宣发演讲，防同行言语非议。',
      wealth: '因文书协议生财，但防合同纠纷与口舌。',
      relationship: '沟通频繁，易生口角争执，需温和包容。',
      health: '心火上炎，咽喉发炎，高热或失眠心烦。',
    },
  },
  gouchen_active: {
    key: 'gouchen_active',
    trigger: '勾陈发动',
    sourceBook: '卜筮正宗',
    originalVerse: '勾陈发动主迟延，谋事牵连难向前；争田夺地争家业，占病沉沉伏枕边。',
    generalMeaning: '勾陈为田土羁绊之神，动则主迟缓、拖延、田土房产、旧事牵连。',
    topicSpecificAdvice: {
      career: '进度拖延，受体制或旧规则羁绊，难以速决。',
      wealth: '利不动产、土地农业，不宜短期快速周转。',
      relationship: '藕断丝连，旧情纠缠，缺乏决断力。',
      health: '脾胃湿热，慢性旧疾缠绵不愈。',
    },
  },
  snake_active: {
    key: 'snake_active',
    trigger: '螣蛇发动',
    sourceBook: '卜筮正宗',
    originalVerse: '螣蛇怪异虚惊多，占梦占病鬼魅扰；惊恐怪异防盗贼，出门行路遇风波。',
    generalMeaning: '螣蛇为惊恐虚妄之神，动则主虚惊、噩梦、怪异、疑心暗鬼。',
    topicSpecificAdvice: {
      career: '心神不定，疑虑重重，防小人背后捣鬼。',
      wealth: '防虚假骗局、空头支票、虚浮项目。',
      relationship: '多猜忌不信任，神经敏感，易生误会。',
      health: '失眠多梦，神经衰弱，惊恐不安。',
    },
  },
  tiger_active: {
    key: 'tiger_active',
    trigger: '白虎发动',
    sourceBook: '卜筮正宗',
    originalVerse: '白虎发动主凶丧，横祸伤残血光殃；官事临身灾难免，占病沉重命难防。',
    generalMeaning: '白虎为肃杀威严之神，动则主血光、刑伤、争斗、疾病、威权。',
    topicSpecificAdvice: {
      career: '利军警执法、外科医药、强势竞争，防官非硬碰硬。',
      wealth: '求偏财防伤身破损，严防意外事故赔偿。',
      relationship: '性格刚烈暴躁，易起激烈争执甚至动手。',
      health: '防外伤出血、急症重症、跌打损伤。',
    },
  },
  turtle_active: {
    key: 'turtle_active',
    trigger: '玄武发动',
    sourceBook: '卜筮正宗',
    originalVerse: '玄武发动主阴私，盗贼潜形暗昧期；防骗破财生暧昧，求谋诡诈要防持。',
    generalMeaning: '玄武为暗昧隐私之神，动则主盗贼、隐瞒、欺瞒、暧昧、暗财。',
    topicSpecificAdvice: {
      career: '宜低调暗中谋划，严防商业泄密或暗箱操作。',
      wealth: '有暗财横财之机，但防被骗、遗失、盗窃。',
      relationship: '易生暗恋、隐瞒不公开或第三方地下情。',
      health: '肾水泌尿系统亏损，隐秘暗疾，精神萎靡。',
    },
  },

  // 动变进退与生克绝墓
  change_advance: {
    key: 'change_advance',
    trigger: '动化进神',
    sourceBook: '增删卜易',
    originalVerse: '化进神者，如日方升，如春发木；吉事增吉，凶事增凶，后劲绵长。',
    generalMeaning:
      '爻由弱变强、由退变进（如寅化卯、申化酉、丑化辰）。代表势头不可阻挡，蓬勃发展。',
    topicSpecificAdvice: {
      career: '事业步步高升，地位稳固，长期利好。',
      wealth: '财运持续增长，规模不断扩大。',
      relationship: '感情日益加深，水到渠成。',
      health: '用神化进吉利，忌神化进病情加重。',
    },
  },
  change_retreat: {
    key: 'change_retreat',
    trigger: '动化退神',
    sourceBook: '增删卜易',
    originalVerse: '化退神者，如日西斜，如秋凋叶；吉事渐消，凶事渐退，虎头蛇尾。',
    generalMeaning: '爻由盛转衰（如卯化寅、酉化申、未化辰）。代表动力不足、渐渐萎缩。',
    topicSpecificAdvice: {
      career: '进展逐渐乏力，有退缩、降职或热情消退之象。',
      wealth: '收益递减，需及时收手、见好就收。',
      relationship: '关系转冷，逐渐疏远。',
      health: '忌神官鬼化退则病渐愈，用神化退需防元气亏虚。',
    },
  },
  change_birth: {
    key: 'change_birth',
    trigger: '动化回头生',
    sourceBook: '黄金策',
    originalVerse: '化回头生者，如旱苗得雨，如枯木逢春；自强不息，源源不竭。',
    generalMeaning: '变出之爻反过来生助本爻（如木爻化子水、火爻化卯木）。绝处生机，后劲极大。',
    topicSpecificAdvice: {
      career: '不仅眼前得力，后续更有源源不断的资源支持。',
      wealth: '越做越大，资金流源源不断。',
      relationship: '对方主动示好，感情持续升温。',
      health: '转危为安，精力逐渐充沛。',
    },
  },
  change_clash: {
    key: 'change_clash',
    trigger: '动化回头克',
    sourceBook: '黄金策',
    originalVerse: '化回头克者，如草遭霜，如树遭斧；始勤终怠，反受其戕。',
    generalMeaning: '变出之爻反过来克伐本爻（如木爻化申金、金爻化午火）。自己作茧自缚，后果反噬。',
    topicSpecificAdvice: {
      career: '自己的决策或行为导致后期败局，反受惩戒。',
      wealth: '贪多嚼不烂，因激进投资导致本金遭吞噬。',
      relationship: '好意变怨恨，反目成仇。',
      health: '服药不当或自身生活习惯恶化致病。',
    },
  },
  change_grave: {
    key: 'change_grave',
    trigger: '动化入墓',
    sourceBook: '增删卜易',
    originalVerse: '动而入墓，如人入地，神昏志乱；吉凶虽有，暂难施展。',
    generalMeaning:
      '爻动变出自身五行之墓库（如木化未、金化丑、火化戌、水土化辰）。主受困、迷茫、休眠。',
    topicSpecificAdvice: {
      career: '受环境限制或被雪藏，才能无法发挥。',
      wealth: '资金被套牢，周转不灵。',
      relationship: '被家庭或对方死死管束，透不过气。',
      health: '神识昏迷，卧床不起，需冲开墓库之日方醒。',
    },
  },
  change_extinct: {
    key: 'change_extinct',
    trigger: '动化绝地',
    sourceBook: '卜筮正宗',
    originalVerse: '化绝者，如薪尽火灭，气数已尽；绝处逢生，方有转机。',
    generalMeaning: '爻动变出绝地（如木化申、火化亥、金化寅、水化巳）。代表希望断绝，气数消亡。',
    topicSpecificAdvice: {
      career: '此路不通，前景断绝，宜早作转型打算。',
      wealth: '财源枯竭，不可强求。',
      relationship: '缘分已尽，勉强无益。',
      health: '病势极其危险，需有生扶日月方可解救。',
    },
  },
  change_void: {
    key: 'change_void',
    trigger: '动化旬空',
    sourceBook: '增删卜易',
    originalVerse: '化空者，动而无力，事成画饼；待出空填实，方定成败。',
    generalMeaning: '变爻落入当日旬空。代表当前变动尚未落实，虚妄不实，须待出空方应。',
    topicSpecificAdvice: {
      career: '承诺未能兑现，空头支票，需等出空之期。',
      wealth: '看似有利可图，实则未见真金白银。',
      relationship: '对方心意飘忽，言而无信。',
      health: '虚惊一场，或病未找准根源。',
    },
  },
};

/**
 * 六爻分类占断《黄金策·分类篇》经典古训
 */
export const LIUYAO_CATEGORY_CHAPTERS: LiuyaoCategoryChapter[] = [
  {
    category: 'wealth',
    title: '黄金策 · 求财篇',
    sourceBook: '黄金策',
    verse: '财福同旺，何须卜筮；财衰鬼旺，买卖多乖。兄爻发动，破耗难免；子孙持世，日进斗金。',
    explanation:
      '以妻财为用神，子孙为原神，兄弟为忌神，官鬼为泄神。财旺子兴为大吉，兄鬼持世动发为破败之兆。',
  },
  {
    category: 'career',
    title: '黄金策 · 求官篇',
    sourceBook: '黄金策',
    verse: '官星克世，显贵之兆；鬼旺身衰，反成灾祸。父母持世文书稳，子孙发动罢官归。',
    explanation:
      '以官鬼为用神，父母为原神（主文书权柄），子孙为忌神（克官），兄弟为竞争。官旺印成必得晋升。',
  },
  {
    category: 'marriage',
    title: '黄金策 · 婚姻篇',
    sourceBook: '黄金策',
    verse:
      '男占财为妇，女占鬼为夫；应世相生相合者，百年琴瑟喜和谐。世克应爻妻听从，应克世爻夫受屈。',
    explanation:
      '男测以妻财为用，女测以官鬼为用，兼看应爻（对方）与世爻（自己）之生克比和。六合大吉，六冲主散。',
  },
  {
    category: 'health',
    title: '黄金策 · 疾病篇',
    sourceBook: '黄金策',
    verse: '官鬼为病子为药，世爻受克病沉疴。鬼爻入墓缠绵久，子孙持世霍然愈。',
    explanation: '以官鬼为病症，子孙为医药，世爻为患者本身。官弱子旺则疾自消，鬼旺世衰则危殆。',
  },
  {
    category: 'travel',
    title: '黄金策 · 出行篇',
    sourceBook: '黄金策',
    verse: '世动身摇心欲往，应爻受阻迟不发。子孙临世平安路，官鬼当头盗贼惊。',
    explanation:
      '以世爻为自身，应爻为目的地，子孙为平安福神，官鬼兄弟为险阻破耗。世动子旺一路顺风。',
  },
  {
    category: 'lost',
    title: '黄金策 · 失物篇',
    sourceBook: '黄金策',
    verse: '鬼临玄武贼人盗，财落空亡寻不见。用神旺相在内卦，不出家门自可寻。',
    explanation:
      '以所失之物之六亲为用神（金银钱物看财，书画文书看父，车船看父，牲畜小宠看子）。内卦在家中，外卦在远方。',
  },
  {
    category: 'litigation',
    title: '黄金策 · 词讼篇',
    sourceBook: '黄金策',
    verse:
      '官鬼为官府，世应判输赢。世克应爻我必胜，应克世爻彼占优。子孙发动争端息，父母文书理分明。',
    explanation: '世为我方，应为对方，官鬼为法官裁判，父母为诉状案卷。世旺克应或得官生者胜诉。',
  },
  {
    category: 'house',
    title: '黄金策 · 家宅篇',
    sourceBook: '黄金策',
    verse:
      '父母为堂屋，官鬼为门庭。子孙兴隆家道泰，兄弟争克耗资财。六爻安谧人口吉，四野清宁福禄来。',
    explanation:
      '以初爻为宅基地，二爻为房屋，三爻为门，四爻为户，五爻为人，六爻为栋梁栋宇。六亲各有所主。',
  },
];

import type { LiuyaoChishiClassic } from './types';

/**
 * 《卜筮正宗》《增删卜易》六亲持世歌诀全解
 */
export const LIUYAO_CHISHI_TABLE: Record<string, LiuyaoChishiClassic> = {
  父母: {
    relation: '父母',
    sourceBook: '卜筮正宗·持世篇',
    verse: '父母持世主身劳，求官应举名位高。买卖求财休妄想，若占疾病鬼难逃。',
    modernAdvice:
      '世持父母主劳心劳力、长辈助力、文书得位。利于考公、求职、评职称、签约合同；不利投机求财；测疾病小口多凶、长辈可安。',
  },
  子孙: {
    relation: '子孙',
    sourceBook: '卜筮正宗·持世篇',
    verse: '世持子孙万事平，求财买卖遂心行。占病药到凶星散，求官应举未成名。',
    modernAdvice:
      '世持子孙为福神持世，百无禁忌。求财大获利，测病必得良医；不利求名晋升、考公见官（伤官克官）。',
  },
  官鬼: {
    relation: '官鬼',
    sourceBook: '卜筮正宗·持世篇',
    verse: '世持官鬼事难安，求名求官上金銮。买卖求财多阻隔，占病沉重不安然。',
    modernAdvice:
      '世持官鬼主忧虑挂心、压力责任与官职权柄。利于求职、晋升、竞聘上岗；测财易遭扣押分刮，测病惊恐不安。',
  },
  妻财: {
    relation: '妻财',
    sourceBook: '卜筮正宗·持世篇',
    verse: '世持妻财福禄多，求财买卖好经过。占文难成防破印，占婚和美笑呵呵。',
    modernAdvice:
      '世持妻财主财源丰茂、生活优渥、婚姻美满。经商求财大顺；不利考学评级（财多坏印）；男占婚大吉。',
  },
  兄弟: {
    relation: '兄弟',
    sourceBook: '卜筮正宗·持世篇',
    verse: '世持兄弟克妻财，求谋求聚多破灾。占婚难成防口舌，买卖无利损资财。',
    modernAdvice:
      '世持兄弟主破耗、合作争夺、朋友往来。不利求财投资（防被骗被分）；占婚多口舌情敌；利于合伙社交与打抱不平。',
  },
};

export function getLiuyaoChishiClassic(sixRelation: string): LiuyaoChishiClassic | undefined {
  if (!sixRelation) return undefined;
  const clean = sixRelation.replace(/爻$/, '').slice(0, 2);
  return LIUYAO_CHISHI_TABLE[clean] || LIUYAO_CHISHI_TABLE[sixRelation];
}

export function getLiuyaoMovementRule(key: string): LiuyaoMovementRule | undefined {
  return LIUYAO_MOVEMENT_RULES[key];
}

export function getAllLiuyaoMovementRules(): LiuyaoMovementRule[] {
  return Object.values(LIUYAO_MOVEMENT_RULES);
}

export function getLiuyaoCategoryChapter(category: string): LiuyaoCategoryChapter | undefined {
  return LIUYAO_CATEGORY_CHAPTERS.find((c) => c.category === category);
}

export function getAllLiuyaoCategoryChapters(): LiuyaoCategoryChapter[] {
  return LIUYAO_CATEGORY_CHAPTERS;
}
