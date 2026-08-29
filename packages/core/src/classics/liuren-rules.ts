import type { LiurenLessonPatternClassic, LiurenTransmissionClassic } from './types';

/**
 * 《大六壬大全》《六壬指南》《毕法赋》九宗门取传与经典课体释义全录
 */
export const LIUREN_TRANSMISSION_CLASSICS: Record<string, LiurenTransmissionClassic> = {
  重审: {
    rule: '重审',
    category: '贼克法（下贼上）',
    sourceBook: '大六壬大全·九宗门',
    summary: '四课只有一处下贼上，以下贼上之上神为初传发用。',
    verse: '取课先从下贼呼，若无下贼上克图；下克名重审，顺理自然敷。',
    modernAdvice: '下克上为顺理成章、由内而外的革新与爆发。自身动机纯正，虽有震荡终能顺遂。',
  },
  元首: {
    rule: '元首',
    category: '贼克法（上克下）',
    sourceBook: '大六壬大全·九宗门',
    summary: '四课只有一处上克下，以上克下之上神为初传发用。',
    verse: '上克下兮名元首，尊长统领万民昌；发用端正无私曲，谋为顺畅出朝堂。',
    modernAdvice: '上级、制度或主管力量发号施令，利于管理、晋升、正道求谋，宜尊崇规则。',
  },
  '知一/比用': {
    rule: '知一/比用',
    category: '知一法（比用）',
    sourceBook: '大六壬大全·九宗门',
    summary: '四课见多处相克，取与日干阴阳同类的上神发用。',
    verse: '克贼俱多比日干，同阳同阴仔细观；若能知一分明晓，发用如神定吉安。',
    modernAdvice: '多项选择或竞争中，选择与自身性格、定位最契合的路径，志同道合者助益最大。',
  },
  涉害: {
    rule: '涉害',
    category: '涉害法',
    sourceBook: '六壬指南·涉害门',
    summary: '多处贼克且比用仍多，比较上神归本家途中涉克深浅取发用。',
    verse: '涉害深浅历万难，孟仲季位仔细攀；历尽艰险成大器，风雨过后见青天。',
    modernAdvice: '事态复杂，需经历多重考验与磨砺。唯有坚持不懈、踏实攻坚，方能最终破局。',
  },
  遥克: {
    rule: '遥克',
    category: '遥克法（蒿矢/弹射）',
    sourceBook: '大六壬大全·九宗门',
    summary: '四课无上下克，取上神与日干遥克者发用；神克干为蒿矢，干克神为弹射。',
    verse: '四课无克遥相指，蒿矢弹射两分明；神克干来防外侮，干克神去得财成。',
    modernAdvice: '外部远距离因素影响大局，应提高警惕，注意防范外部突发信息或远程收益。',
  },
  昴星: {
    rule: '昴星',
    category: '昴星法（虎视/掩目）',
    sourceBook: '大六壬大全·九宗门',
    summary: '四课无克亦无遥克，阳日取酉上神（虎视），阴日取干上神（掩目）。',
    verse: '无克无遥看昴星，刚日酉位虎视横；柔日干上掩目静，守株待兔莫轻行。',
    modernAdvice: '局势混沌不明，切忌轻举妄动。宜暗中观察蓄力，待机而动。',
  },
  别责: {
    rule: '别责',
    category: '别责法',
    sourceBook: '大六壬大全·九宗门',
    summary: '课象不全又无克，阳日取干合之上神，阴日取支前三合发用。',
    verse: '四课不全借外求，别责借力解千愁；阳干合上阴支合，另辟蹊径展鸿猷。',
    modernAdvice: '常规手段难以破局，宜另辟蹊径，借助外部跨界资源或贵人借力化解。',
  },
  八专: {
    rule: '八专',
    category: '八专法',
    sourceBook: '大六壬大全·九宗门',
    summary: '干支同位、四课只有两课，阳日顺数三位、阴日逆数三位发用。',
    verse: '八专同位事多迟，阳顺阴逆数三期；进退维谷宜自守，独断专行惹是非。',
    modernAdvice: '环境狭窄或资源集中，容易因个人独断而产生盲点，宜博采众长、谨慎决策。',
  },
  伏吟: {
    rule: '伏吟',
    category: '伏吟法',
    sourceBook: '大六壬大全·九宗门',
    summary: '天地盘逐位重合不移，不动之象；有克取克，无克刚日取干上、柔日取支上。',
    verse: '伏吟不动守门庭，忧患伏藏喜事停；闭户修身养心性，妄动必遭百事惊。',
    modernAdvice: '大局停滞固化，不宜主动开拓。宜整理内务、修养身心、巩固现有盘子。',
  },
  返吟: {
    rule: '返吟',
    category: '返吟法',
    sourceBook: '大六壬大全·九宗门',
    summary: '天盘十二位与地盘逐位相冲，极动之象；有克取克，无克按井栏射起传。',
    verse: '返吟对冲事翻腾，往来不定变如云；反复无常休怪叹，动中取胜利远程。',
    modernAdvice: '变动剧烈、反复无常，计划常需快速调整。宜顺应变化、灵活机动、防范突发反复。',
  },
};

export const LIUREN_LESSON_PATTERN_CLASSICS: Record<string, LiurenLessonPatternClassic> = {
  斩关: {
    pattern: '斩关课',
    sourceBook: '六壬指南·课体心印',
    verse: '斩关破塞任奔驰，远行出入最为宜；冲破网罗无阻碍，马到成功莫迟疑。',
    modernAdvice: '突破瓶颈、冲开束缚之象。非常适合出行远游、开拓新市场、打破旧体制。',
  },
  闭口: {
    pattern: '闭口课',
    sourceBook: '六壬指南·课体心印',
    verse: '闭口旬空隐晦深，口舌休张莫乱吟；静默安分能避祸，多言必见祸殃临。',
    modernAdvice: '守口如瓶、韬光养晦。不宜多嘴或公开争执，暗中推进更为安全。',
  },
  玄胎: {
    pattern: '玄胎课',
    sourceBook: '六壬指南·课体心印',
    verse: '玄胎发育成新局，旧事消除万物生；暗有生机逐步显，谋为始见渐光明。',
    modernAdvice: '新生事物正在孕育，虽尚未全面爆发，但潜力巨大，值得长期投资与培育。',
  },
  铸印: {
    pattern: '铸印课',
    sourceBook: '六壬指南·课体心印',
    verse: '铸印成形执政威，求官显赫佩金绯；文书权柄皆如意，仕宦逢之大有为。',
    modernAdvice: '官运与权威极盛，利于考公、升职、签约、获得资质认证与掌握实权。',
  },
  斫轮: {
    pattern: '斫轮课',
    sourceBook: '六壬指南·课体心印',
    verse: '斫轮成器费功夫，利斧雕琢良木粗；虽历艰辛方显贵，晚成大器莫畏途。',
    modernAdvice: '历经严格锤炼与磨砺，方能打造出精品成果。适合技术攻关与艰苦创业。',
  },
};

import type { LiurenGeneralClassic } from './types';

/**
 * 大六壬十二天将《大六壬大全》《六壬指南》精解
 */
export const LIUREN_GENERAL_CLASSICS: Record<string, LiurenGeneralClassic> = {
  贵人: {
    general: '贵人',
    wuxing: '土',
    polarity: '阳',
    auspice: '吉',
    sourceBook: '大六壬大全·天将篇',
    verse: '贵人尊贵至高明，百恶潜消福自增。求官拜见多逢合，万事呈祥得利名。',
    modernAdvice: '六壬第一吉将！逢之必得权威尊长、官方贵人大力提携扶持，凡事顺遂。',
  },
  螣蛇: {
    general: '螣蛇',
    wuxing: '火',
    polarity: '阴',
    auspice: '凶',
    sourceBook: '大六壬大全·天将篇',
    verse: '螣蛇怪异并惊疑，火烛虚惊梦寐迷。口舌缠绵心不定，守正防奸莫妄为。',
    modernAdvice: '主惊恐、虚假、怪梦、心理焦虑。防文书虚夸与突发变故，宜稳重冷静。',
  },
  朱雀: {
    general: '朱雀',
    wuxing: '火',
    polarity: '阳',
    auspice: '凶',
    sourceBook: '大六壬大全·天将篇',
    verse: '朱雀文书口舌喧，争端词讼起多端。求官得理文昌喜，音信飞传喜报繁。',
    modernAdvice: '注文书、信息、口舌是非。利于求职竞聘、发表文章、传播名声；防争辩纠纷。',
  },
  六合: {
    general: '六合',
    wuxing: '木',
    polarity: '阴',
    auspice: '吉',
    sourceBook: '大六壬大全·天将篇',
    verse: '六合和美吉庆多，婚姻求财笑呵呵。买卖交涉皆获利，中介调停化干戈。',
    modernAdvice: '主和合、团队合作、婚姻、中介。极利商业谈判、合伙签约与感情缔结。',
  },
  勾陈: {
    general: '勾陈',
    wuxing: '土',
    polarity: '阳',
    auspice: '凶',
    sourceBook: '大六壬大全·天将篇',
    verse: '勾陈留连争斗频，词讼迟延祸相仍。捕贼得手防内乱，修造争执事难伸。',
    modernAdvice: '主迟滞、争讼、牵连阻碍、田土纠纷。遇事容易拖延反复，需防官司与阻碍。',
  },
  青龙: {
    general: '青龙',
    wuxing: '木',
    polarity: '阳',
    auspice: '吉',
    sourceBook: '大六壬大全·天将篇',
    verse: '青龙财帛喜重重，求名求利显神通。经商嫁娶多顺畅，富贵吉祥乐亨通。',
    modernAdvice: '主财帛、喜庆、升迁、大吉之神。求财大利、官运亨通、婚嫁大吉。',
  },
  天空: {
    general: '天空',
    wuxing: '土',
    polarity: '阴',
    auspice: '中性',
    sourceBook: '大六壬大全·天将篇',
    verse: '天空虚无主不全，脱空诈伪事缠绵。修真参道超尘劫，世俗求谋多落空。',
    modernAdvice: '主虚无、空想、诈伪与精神追求。世俗名利多落空，利于学术研究、玄学与禅修。',
  },
  白虎: {
    general: '白虎',
    wuxing: '金',
    polarity: '阳',
    auspice: '凶',
    sourceBook: '大六壬大全·天将篇',
    verse: '白虎威严杀气深，伤残疾病并忧侵。行兵捕盗虽得力，百事逢之受苦辛。',
    modernAdvice: '主血光、伤病、死丧、道路凶险。需防健康意外与暴力冲突，利执法惩戒。',
  },
  太常: {
    general: '太常',
    wuxing: '土',
    polarity: '阴',
    auspice: '吉',
    sourceBook: '大六壬大全·天将篇',
    verse: '太常酒食衣帛昌，喜庆宴饮乐满堂。求官受职佩金印，福禄双全寿运长。',
    modernAdvice: '主酒食宴会、衣服财帛、职务受封。利于社交聚会、受领荣誉与生活享受。',
  },
  玄武: {
    general: '玄武',
    wuxing: '水',
    polarity: '阴',
    auspice: '凶',
    sourceBook: '大六壬大全·天将篇',
    verse: '玄武阴贼并欺瞒，小人盗窃事相牵。失物难寻防破耗，清心守己度安闲。',
    modernAdvice: '主暗昧、盗贼、隐私小人、被骗。需严防财务漏洞与私下陷阱，防患未然。',
  },
  太阴: {
    general: '太阴',
    wuxing: '金',
    polarity: '阴',
    auspice: '吉',
    sourceBook: '大六壬大全·天将篇',
    verse: '太阴密谋深致祥，阴庇护佑免灾殃。暗中相助多得力，行藏无阻保安康。',
    modernAdvice: '主阴庇、策划、幕后隐秘助力。利于暗中运筹、寻求女性贵人帮助与稳秘推进。',
  },
  天后: {
    general: '天后',
    wuxing: '水',
    polarity: '阴',
    auspice: '吉',
    sourceBook: '大六壬大全·天将篇',
    verse: '天后慈祥后土尊，婚姻妇女事皆成。恩泽普施消烦恼，和顺温良享泰宁。',
    modernAdvice: '主慈祥、女性长辈、婚姻感情。利于调和矛盾、婚恋求偶、家庭温情与善后。',
  },
};

export function getLiurenGeneralClassic(general: string): LiurenGeneralClassic | undefined {
  if (!general) return undefined;
  for (const [key, val] of Object.entries(LIUREN_GENERAL_CLASSICS)) {
    if (general.includes(key)) return val;
  }
  return undefined;
}

export function getLiurenTransmissionClassic(rule: string): LiurenTransmissionClassic | undefined {
  for (const [key, value] of Object.entries(LIUREN_TRANSMISSION_CLASSICS)) {
    if (rule.includes(key)) return value;
  }
  return undefined;
}

export function getLiurenLessonPatternClassic(
  pattern: string,
): LiurenLessonPatternClassic | undefined {
  for (const [key, value] of Object.entries(LIUREN_LESSON_PATTERN_CLASSICS)) {
    if (pattern.includes(key)) return value;
  }
  return undefined;
}

/**
 * 宋代凌福之《大六壬毕法赋》百法精义节选
 */
export const LIUREN_BIFA_CLASSICS: Array<{
  title: string;
  sourceBook: string;
  verse: string;
  explanation: string;
}> = [
  {
    title: '前后引从升迁吉',
    sourceBook: '毕法赋·第一法',
    verse: '前后引从升迁吉，初末引干尊贵客。',
    explanation: '行年或太岁干支，得初传末传前后相引夹拱，主官禄晋升、贵人提拔。',
  },
  {
    title: '首尾相见始始终',
    sourceBook: '毕法赋·第二法',
    verse: '首尾相见始终宜，事有循环吉凶随。',
    explanation: '初传见末传，或末传复归初传，主事情循环反复，有始有终。',
  },
  {
    title: '帘幕贵人高第喜',
    sourceBook: '毕法赋·第三法',
    verse: '帘幕贵人高第喜，秋闱夺魁名自启。',
    explanation: '贵人临日干长生或临学堂文星，专主考试夺魁、论文通过、金榜题名。',
  },
  {
    title: '鬼贼当时无畏忌',
    sourceBook: '毕法赋·第四法',
    verse: '鬼贼当时无畏忌，传中制伏反为奇。',
    explanation: '官鬼虽凶，若三传中有子孙或印绶化煞制伏，反而化凶为权，反成大功。',
  },
  {
    title: '干支乘墓各昏迷',
    sourceBook: '毕法赋·第五法',
    verse: '干支乘墓各昏迷，彼此相蒙事多疑。',
    explanation: '日干或日支临墓神，主自身或对方头脑不清、犹豫昏昧，不宜草率决断。',
  },
];

export function getLiurenBifaClassic(keyword: string) {
  if (!keyword) return undefined;
  return LIUREN_BIFA_CLASSICS.find((b) => b.title.includes(keyword) || b.verse.includes(keyword));
}

export function getAllLiurenBifaClassics() {
  return LIUREN_BIFA_CLASSICS;
}
