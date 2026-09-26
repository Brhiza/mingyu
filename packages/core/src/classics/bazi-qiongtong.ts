import type { BaziQiongtongEntry } from './types';

// 校勘底本：https://zh.wikisource.org/w/index.php?title=穷通宝鉴&oldid=2294674
// classicVerse 为该修订版逐字摘录；primaryGods 只列条文取用候选，具体先后以原文条件为准。

export const BAZI_QIONGTONG_TABLE: Record<string, BaziQiongtongEntry> = {
  // 甲木
  // 出处：三春甲木·正月。
  '甲+寅': {
    dayMaster: '甲',
    monthBranch: '寅',
    seasonSummary: '初春余寒，原文以丙癸相济。',
    primaryGods: ['丙', '癸'],
    classicVerse: '正月甲木，初春尚有余寒，得丙癸逢，富贵双全。',
    modernExplanation: '丙火温木，癸水滋养春木。',
    taboos: [],
  },
  // 出处：三春甲木·二月。
  '甲+卯': {
    dayMaster: '甲',
    monthBranch: '卯',
    seasonSummary: '仲春甲木，庚金得所另须财资。',
    primaryGods: ['庚', '戊', '丁'],
    classicVerse: '二月甲木，庚金得所，名阳刃驾杀，可云小贵，异途显达，或主武职，但要财资之。',
    modernExplanation: '庚金制旺木，戊土资庚；丁火透出时另论。',
    taboos: [],
  },
  // 出处：三春甲木·三月。
  '甲+辰': {
    dayMaster: '甲',
    monthBranch: '辰',
    seasonSummary: '三月木气相竭，先庚后壬。',
    primaryGods: ['庚', '壬'],
    classicVerse: '三月甲木，木气相竭。先取庚金，次用壬水。',
    modernExplanation: '庚金修木、壬水滋扶；支成金局时再论丁火。',
    taboos: [],
  },
  // 出处：三夏甲木·四月。
  '甲+巳': {
    dayMaster: '甲',
    monthBranch: '巳',
    seasonSummary: '四月甲木退气，丙火司权，先癸后丁。',
    primaryGods: ['癸', '丁'],
    classicVerse: '四月甲木退气，丙火司权，先癸后丁。',
    modernExplanation: '癸水润木，丁火与庚金的配合依原局另论。',
    taboos: [],
  },
  // 出处：三夏甲木·五月。
  '甲+午': {
    dayMaster: '甲',
    monthBranch: '午',
    seasonSummary: '五月木性虚焦，癸先、丁次、庚再次。',
    primaryGods: ['癸', '丁', '庚'],
    classicVerse: '五月先癸后丁庚金次之。',
    modernExplanation: '癸水滋木；木盛先庚、庚盛先丁是同篇另列的条件。',
    taboos: [],
  },
  // 出处：三夏甲木·六月。
  '甲+未': {
    dayMaster: '甲',
    monthBranch: '未',
    seasonSummary: '六月三伏生寒，先丁后庚。',
    primaryGods: ['丁', '庚'],
    classicVerse: '六月三伏生寒，丁火退气。先丁后庚，无癸亦可。',
    modernExplanation: '木盛改先庚、庚盛改先丁；原文说无癸亦可。',
    taboos: [],
  },
  // 出处：三秋甲木·七月。
  '甲+申': {
    dayMaster: '甲',
    monthBranch: '申',
    seasonSummary: '七月金旺，丁为尊、庚次之。',
    primaryGods: ['丁', '庚'],
    classicVerse: '七月甲木，丁火为尊，庚金次之，庚金不可少。',
    modernExplanation: '丁火镕庚，庚金造甲；癸水阻隔丁火时须另看制水。',
    taboos: [],
  },
  // 出处：三秋甲木·八月。
  '甲+酉': {
    dayMaster: '甲',
    monthBranch: '酉',
    seasonSummary: '八月木囚金旺，丁先、丙次、庚再次。',
    primaryGods: ['丁', '丙', '庚'],
    classicVerse: '八月甲木，木囚金旺。丁火为先，次用丙火，庚金再次。',
    modernExplanation: '丁火应对旺金；丙火与庚金仍须依原局配合。',
    taboos: [],
  },
  // 出处：三秋甲木·九月。
  '甲+戌': {
    dayMaster: '甲',
    monthBranch: '戌',
    seasonSummary: '九月木星凋零，重丁火与壬癸滋扶。',
    primaryGods: ['丁', '壬', '癸'],
    classicVerse:
      '九月甲木，木星凋零，独爱丁火，壬癸滋扶，丁壬癸透，戊己亦透，此命配得中和，可许一榜。',
    modernExplanation: '壬癸滋扶甲木，丁火与戊己同时透出时另论中和。',
    taboos: [],
  },
  // 出处：三冬甲木·十月。
  '甲+亥': {
    dayMaster: '甲',
    monthBranch: '亥',
    seasonSummary: '十月庚丁为要，丙火次之。',
    primaryGods: ['庚', '丁', '丙'],
    classicVerse: '十月甲木，庚丁为要，丙火次之。忌壬水泛身，须戊土制之。',
    modernExplanation: '壬水泛身时，原文另取戊土制水。',
    taboos: ['壬水泛身'],
  },
  // 出处：三冬甲木·十一月。
  '甲+子': {
    dayMaster: '甲',
    monthBranch: '子',
    seasonSummary: '十一月木性生寒，丁先庚后，丙火佐之。',
    primaryGods: ['丁', '庚', '丙'],
    classicVerse: '十一月甲木，木性生寒，丁先庚后，丙火佐之。癸水司权，为火金之病。',
    modernExplanation: '丁暖寒木，庚丁配合；癸水透出会伤丁。',
    taboos: ['癸水伤丁'],
  },
  // 出处：三冬甲木·十二月。
  '甲+丑': {
    dayMaster: '甲',
    monthBranch: '丑',
    seasonSummary: '十二月天寒木冻，先庚后丁。',
    primaryGods: ['庚', '丁'],
    classicVerse:
      '十二月甲木，天寒气冻，木性极寒，无生发之象，先用庚噼甲，方引丁火始得木火有通明之象，故丁次之。',
    modernExplanation: '庚噼甲以引丁，原文将二者写作连续作用。',
    taboos: [],
  },

  // 乙木
  // 出处：三春乙木·正月。
  '乙+寅': {
    dayMaster: '乙',
    monthBranch: '寅',
    seasonSummary: '正月乙木余寒，丙先癸后。',
    primaryGods: ['丙', '癸'],
    classicVerse:
      '正月乙木，必须用丙，因天气尤有余寒，非丙不暖，虽有癸水，恐凝寒气，故以丙火为先，癸水次之。',
    modernExplanation: '丙火先暖乙木；癸水过多会增寒并困丙。',
    taboos: [],
  },
  // 出处：三春乙木·二月。
  '乙+卯': {
    dayMaster: '乙',
    monthBranch: '卯',
    seasonSummary: '二月阳气渐升，以丙为君、癸为臣。',
    primaryGods: ['丙', '癸'],
    classicVerse: '二月乙木，阳气渐升，木不寒矣，以丙为君，癸为臣，丙癸两透，不透庚金，大富大贵。',
    modernExplanation: '丙火泄旺木，癸水滋根；庚金透出时另核对原文分支。',
    taboos: ['水多困丙'],
  },
  // 出处：三夏乙木·五月。
  '乙+午': {
    dayMaster: '乙',
    monthBranch: '午',
    seasonSummary: '五月丁火司权，取用随月内时段与金水多少而变。',
    primaryGods: ['癸', '丙'],
    classicVerse:
      '五月乙木，丁火司权，禾稼俱旱。上半月属阳，仍用癸水。下半月属阴，三伏生寒，丙癸齐用。柱多金水，丙火为先，余皆用癸水为先。',
    modernExplanation: '上半月仍用癸；下半月丙癸齐用；金水偏多时丙先，其余癸先。',
    taboos: [],
  },
  // 出处：三秋乙木·八月。
  '乙+酉': {
    dayMaster: '乙',
    monthBranch: '酉',
    seasonSummary: '八月乙木，白露后至秋分前用癸，秋分后丙先癸后。',
    primaryGods: ['癸', '丙'],
    classicVerse:
      '八月乙木，芝兰禾稼均退。以丹桂为乙木。在白露之后，桂蕊未开，耑用癸水以滋桂萼。若秋分后，桂花已开，却喜向阳，又宜用丙，癸水次之，丙癸两透，科甲名臣。',
    modernExplanation: '白露后桂蕊未开，癸水滋养；秋分后桂花已开，转取丙火向阳。',
    taboos: [],
  },
  // 出处：三冬乙木·十一月。
  '乙+子': {
    dayMaster: '乙',
    monthBranch: '子',
    seasonSummary: '十一月花木寒冻，专用丙火。',
    primaryGods: ['丙'],
    classicVerse:
      '十一月乙木，花木寒冻，一阳来复，喜用丙火解冻，则花木有向阳之意，不宜用癸以冻花木，故耑用丙火。',
    modernExplanation: '丙火解冻，癸水会加重花木寒冻。',
    taboos: ['癸水冻木'],
  },

  // 丙火
  // 出处：三春丙火·正月。
  '丙+寅': {
    dayMaster: '丙',
    monthBranch: '寅',
    seasonSummary: '正月三阳开泰，壬水为尊、庚金佐之。',
    primaryGods: ['壬', '庚'],
    classicVerse: '正月丙火，三阳开泰，火气渐炎，取壬为尊，庚金佐之。',
    modernExplanation: '壬水辅映丙火，庚金为壬水之源。',
    taboos: ['戊土晦光'],
  },
  // 出处：三夏丙火·五月。
  '丙+午': {
    dayMaster: '丙',
    monthBranch: '午',
    seasonSummary: '五月火炎，原文专用壬水。',
    primaryGods: ['壬', '庚'],
    classicVerse: '四月耑用壬水，金为佐。五月亦耑用壬。',
    modernExplanation: '壬水辅映丙火，庚金可发水源；炎上格须按其条件另论。',
    taboos: [],
  },
  // 出处：三秋丙火·七月。
  '丙+申': {
    dayMaster: '丙',
    monthBranch: '申',
    seasonSummary: '七月阳气渐衰，仍以壬水辅映。',
    primaryGods: ['壬', '戊'],
    classicVerse:
      '七月丙火，太阳转西，阳气衰矣。日近西山，见土皆晦，惟日照湖海，暮夜光天，故仍用壬水，辅映光辉。',
    modernExplanation: '壬水偏多时，原文另取戊土制水。',
    taboos: ['土多晦光'],
  },
  // 出处：三冬丙火·十一月。
  '丙+子': {
    dayMaster: '丙',
    monthBranch: '子',
    seasonSummary: '十一月冬至阳生，壬水为最、戊土佐之。',
    primaryGods: ['壬', '戊'],
    classicVerse: '十一月丙火，冬至一阳生，弱中复强，壬水为最，戊土佐之。',
    modernExplanation: '戊土佐壬水，原文将壬戊配合作为本月提纲。',
    taboos: [],
  },

  // 丁火
  // 出处：三春丁火·二月。
  '丁+卯': {
    dayMaster: '丁',
    monthBranch: '卯',
    seasonSummary: '二月湿乙伤丁，先庚后甲。',
    primaryGods: ['庚', '甲'],
    classicVerse: '二月丁火，溼乙伤丁，先庚后甲，非庚不能去乙，非甲不能引丁。',
    modernExplanation: '庚金去乙，甲木引丁，二者作用相接。',
    taboos: [],
  },
  // 出处：三夏丁火·五月。
  '丁+午': {
    dayMaster: '丁',
    monthBranch: '午',
    seasonSummary: '五月丁火建禄，庚壬两透为一分支。',
    primaryGods: ['壬', '庚'],
    classicVerse: '五月丁火，时归建禄，不宜乱用甲木。',
    modernExplanation: '庚金发水源、壬水解炎；癸透及无火局而水透另有分支。',
    taboos: ['乱用甲木'],
  },
  // 出处：三秋丁火·八月。
  '丁+酉': {
    dayMaster: '丁',
    monthBranch: '酉',
    seasonSummary: '三秋丁火退气，甲木为主、庚金劈甲。',
    primaryGods: ['甲', '庚', '丙'],
    classicVerse:
      '三秋丁火，退气柔弱，耑用甲木，金虽乘旺司权，无伤丁之理，仍取庚噼甲，为引火之物，或借丙暖金晒木，不虑丙夺丁火。',
    modernExplanation: '甲木引丁，庚金劈甲；丙火可暖金晒木。',
    taboos: [],
  },
  // 出处：三冬丁火·十一月。
  '丁+子': {
    dayMaster: '丁',
    monthBranch: '子',
    seasonSummary: '三冬丁火微寒，甲木为尊、庚金佐之。',
    primaryGods: ['甲', '庚'],
    classicVerse: '三冬丁火，甲木为尊，庚金佐之，癸戊权宜酌用可也。',
    modernExplanation: '甲木引丁，庚金劈甲；十一月水多癸旺且无比印时另论从杀。',
    taboos: [],
  },

  // 戊土
  // 出处：三春戊土·三月。
  '戊+辰': {
    dayMaster: '戊',
    monthBranch: '辰',
    seasonSummary: '三月戊土司权，甲先、丙次、癸再次。',
    primaryGods: ['甲', '丙', '癸'],
    classicVerse: '三月先甲后丙，癸又次之，因戊土司权故也。',
    modernExplanation: '甲木疏土，丙火照暖，癸水滋润。',
    taboos: [],
  },
  // 出处：三夏戊土·五月。
  '戊+午': {
    dayMaster: '戊',
    monthBranch: '午',
    seasonSummary: '五月火炎，先壬后甲，丙火酌用。',
    primaryGods: ['壬', '甲', '丙'],
    classicVerse: '五月戊土，仲夏火炎，先看壬水，次取甲木，丙火酌用，用癸力微。',
    modernExplanation: '壬水润燥，甲木疏土；丙火按原局酌用。',
    taboos: [],
  },
  // 出处：三秋戊土·九月。
  '戊+戌': {
    dayMaster: '戊',
    monthBranch: '戌',
    seasonSummary: '九月戊土当权，先甲后癸。',
    primaryGods: ['甲', '癸', '丙'],
    classicVerse: '九月戊土当权，不可专用丙，先看甲木，次取癸水，却忌化合。',
    modernExplanation: '甲木疏土、癸水润土；见金时原文另论丙火。',
    taboos: ['戊癸化合'],
  },
  // 出处：三冬戊土·十一月。
  '戊+子': {
    dayMaster: '戊',
    monthBranch: '子',
    seasonSummary: '十一月严寒冰冻，丙火为专、甲木为佐。',
    primaryGods: ['丙', '甲'],
    classicVerse: '十一二月严寒冰冻，丙火为专，甲木为佐。',
    modernExplanation: '丙火解冻，甲木疏土以助生发。',
    taboos: [],
  },

  // 己土
  // 出处：三春己土·二月。
  '己+卯': {
    dayMaster: '己',
    monthBranch: '卯',
    seasonSummary: '二月阳气渐升，甲木先疏、癸水次润。',
    primaryGods: ['甲', '癸', '丙'],
    classicVerse:
      '二月己土，阳气渐升，虽禾稼未成，万物出土，田园未展，先取甲木疏之，忌合。次取癸水润之。',
    modernExplanation: '甲木疏田园，癸水润土；丙火透出时原文另论。',
    taboos: ['甲木被合'],
  },
  // 出处：三夏己土·六月。
  '己+未': {
    dayMaster: '己',
    monthBranch: '未',
    seasonSummary: '三夏己土，癸水为要、丙火次之。',
    primaryGods: ['癸', '丙'],
    classicVerse: '三夏己土，杂气才官，禾稼在田，最喜甘沛，取癸为要，次用丙火。',
    modernExplanation: '癸水润禾稼，丙火照暖；原文忌戊癸化合。',
    taboos: ['戊癸化合'],
  },
  // 出处：三冬己土·十一月。
  '己+子': {
    dayMaster: '己',
    monthBranch: '子',
    seasonSummary: '三冬湿泥寒冻，丙火为尊、甲木参酌。',
    primaryGods: ['丙', '甲'],
    classicVerse: '三冬己土，溼泥寒冻，非丙暖不生，取丙为尊，甲木参酌。',
    modernExplanation: '丙火暖土；戊己土偏多时，原文另取甲木制之。',
    taboos: [],
  },

  // 庚金
  // 出处：三春庚金·正月。
  '庚+寅': {
    dayMaster: '庚',
    monthBranch: '寅',
    seasonSummary: '正月木旺余寒，先丙暖庚、再甲疏土。',
    primaryGods: ['丙', '甲', '丁'],
    classicVerse:
      '正月庚金，木旺之际，有土皆死，不能生金，且金之寒气未除，先用丙暖庚性，又虑土厚埋金，须甲疏洩。',
    modernExplanation: '土厚埋金时以甲木疏土；丁火为同篇列出的次选。',
    taboos: ['春金多火'],
  },
  // 出处：三夏庚金·五月。
  '庚+午': {
    dayMaster: '庚',
    monthBranch: '午',
    seasonSummary: '五月丁火旺烈，庚金败地，壬先癸后。',
    primaryGods: ['壬', '癸'],
    classicVerse: '五月庚金，丁火旺烈，庚金败地，专用壬水，癸又次之。',
    modernExplanation: '壬水应旺火，癸水为次；戊己透干会制水。',
    taboos: ['戊己制水'],
  },
  // 出处：三秋庚金·七月。
  '庚+申': {
    dayMaster: '庚',
    monthBranch: '申',
    seasonSummary: '七月庚金刚锐，丁火煅炼、甲木引丁。',
    primaryGods: ['丁', '甲'],
    classicVerse:
      '七月庚金，刚锐极矣。专用丁火煅炼，次取甲木引丁，故曰：秋金锐锐最为奇，壬癸相逢总不宜，如逢木火来成局，试看福寿与天齐。',
    modernExplanation: '丁火煅庚，甲木为丁火之引。',
    taboos: [],
  },
  // 出处：三冬庚金·十一月。
  '庚+子': {
    dayMaster: '庚',
    monthBranch: '子',
    seasonSummary: '十一月天气严寒，丁甲并取、丙火次之。',
    primaryGods: ['丁', '甲', '丙'],
    classicVerse: '十一月庚金，天气严寒，仍取丁甲，次取丙火照暖。',
    modernExplanation: '丁火炼庚，甲木引丁，丙火照暖。',
    taboos: [],
  },

  // 辛金
  // 出处：三春辛金·二月。
  '辛+卯': {
    dayMaster: '辛',
    monthBranch: '卯',
    seasonSummary: '二月阳和，壬水为尊，戊己为病。',
    primaryGods: ['壬', '甲'],
    classicVerse:
      '二月辛金，阳和之际，壬水为尊，见戊己为病。得甲制伏，则辛金不致埋没，壬水不致混浊，合此者必身入玉堂。',
    modernExplanation: '壬水淘洗辛金；见戊己埋金时取甲木制土。',
    taboos: ['戊己埋金'],
  },
  // 出处：三夏辛金·四月。
  '辛+巳': {
    dayMaster: '辛',
    monthBranch: '巳',
    seasonSummary: '四月首夏，喜壬水洗淘辛金。',
    primaryGods: ['壬', '癸'],
    classicVerse: '四月辛金，时逢首夏，忌丙火之燥烈，喜壬水之洗淘。',
    modernExplanation: '壬水洗金；癸水透出而壬水藏支时另论。',
    taboos: ['丙火燥烈'],
  },
  // 出处：三秋辛金·八月。
  '辛+酉': {
    dayMaster: '辛',
    monthBranch: '酉',
    seasonSummary: '八月辛金当权，专用壬水淘洗。',
    primaryGods: ['壬', '甲'],
    classicVerse:
      '八月辛金，当权得令，旺之极矣，专用壬水淘洗火，故云：金见水以流通。如见戊己，则生扶太过，故以土为病，见甲制土、方妙。无戊、不宜用甲。',
    modernExplanation: '戊己土偏多时取甲木制土；原文说无戊不宜用甲。',
    taboos: ['戊己土重'],
  },
  // 出处：三冬辛金·十月。
  '辛+亥': {
    dayMaster: '辛',
    monthBranch: '亥',
    seasonSummary: '十月小阳而寒气渐降，壬先丙后。',
    primaryGods: ['壬', '丙'],
    classicVerse:
      '十月辛金，时值小阳，阳气渐升，寒气将降，先用壬水，次取丙火，壬丙两透，金榜题名，何也？盖辛金有壬水丙火，名金白水清，又在亥月故发。',
    modernExplanation: '壬水洗金，丙火暖金水。',
    taboos: [],
  },

  // 壬水
  // 出处：三春壬水·正月。
  '壬+寅': {
    dayMaster: '壬',
    monthBranch: '寅',
    seasonSummary: '正月壬水汪洋，重庚金发源。',
    primaryGods: ['庚', '丙', '戊'],
    classicVerse:
      '正月壬水，汪洋之象，能并百川之流，然水性柔弱，宜用庚金之源，庶不致汪洋无度。有庚丙戊三者齐透，科甲功名。',
    modernExplanation: '庚金为源，丙火与戊土同透是原文另列的配合。',
    taboos: [],
  },
  // 出处：三夏壬水·五月。
  '壬+午': {
    dayMaster: '壬',
    monthBranch: '午',
    seasonSummary: '五月丁旺壬弱，癸水为用、庚金为佐。',
    primaryGods: ['癸', '庚'],
    classicVerse: '五月壬水，丁旺壬弱，取癸为用，取庚为佐。无庚不能发水，无癸不能伤丁。',
    modernExplanation: '癸水伤丁，庚金发水源；辛癸亦可参用。',
    taboos: [],
  },
  // 出处：三秋壬水·七月。
  '壬+申': {
    dayMaster: '壬',
    monthBranch: '申',
    seasonSummary: '七月壬水长生，专戊土、丁火佐之。',
    primaryGods: ['戊', '丁'],
    classicVerse:
      '七月壬水，庚金司令，壬得申之长生，源流自远，转弱为强，专用戊土，次取丁火佐戊制庚。',
    modernExplanation: '戊土取辰戌之戊，丁火佐戊制庚；申中之戊受病。',
    taboos: ['戊癸化合'],
  },
  // 出处：三冬壬水·十一月。
  '壬+子': {
    dayMaster: '壬',
    monthBranch: '子',
    seasonSummary: '十一月壬水羊刃帮身，先戊后丙。',
    primaryGods: ['戊', '丙'],
    classicVerse: '十一月壬水，阳刃帮身，较前更旺，先取戊土，次用丙火，丙戊两透，富贵荣华。',
    modernExplanation: '戊土制旺水，丙火暖冬水。',
    taboos: [],
  },

  // 癸水
  // 出处：三春癸水·二月。
  '癸+卯': {
    dayMaster: '癸',
    monthBranch: '卯',
    seasonSummary: '二月乙木司令泄水，庚金为用、辛金次之。',
    primaryGods: ['庚', '辛'],
    classicVerse: '二月癸水，不刚不柔，乙木司令，洩弱元神，专以庚金为用，辛金次之。',
    modernExplanation: '庚辛发癸水之源，原文以庚金为先。',
    taboos: [],
  },
  // 出处：三夏癸水·四月。
  '癸+巳': {
    dayMaster: '癸',
    monthBranch: '巳',
    seasonSummary: '四月癸水，喜辛金，无辛用庚。',
    primaryGods: ['辛', '庚'],
    classicVerse: '四月癸水，喜辛金为用，无辛用庚。',
    modernExplanation: '辛金发水源；庚金为替代，壬透须按原文条件分看。',
    taboos: ['丁火破辛'],
  },
  // 出处：三秋癸水·八月。
  '癸+酉': {
    dayMaster: '癸',
    monthBranch: '酉',
    seasonSummary: '八月金白水清，辛金为用、丙火佐之。',
    primaryGods: ['辛', '丙'],
    classicVerse: '八月癸水，辛金虚灵，非顽金可比，正金白水清，故取辛金为用，丙火佐之。',
    modernExplanation: '辛金生癸水，丙火暖金水。',
    taboos: [],
  },
  // 出处：三冬癸水·十一月。
  '癸+子': {
    dayMaster: '癸',
    monthBranch: '子',
    seasonSummary: '十一月水凝成冰，丙火解冻、辛金滋扶。',
    primaryGods: ['丙', '辛'],
    classicVerse:
      '十一月癸水，值冰冻之时，金水无交欢之象，专用丙火解冻，庶不致成冰，又要辛金滋扶，无丙有辛，不妙。',
    modernExplanation: '丙火解冻，辛金滋扶癸水。',
    taboos: [],
  },
};

export function getBaziQiongtongAdvice(
  dayMaster: string,
  monthBranch: string,
): BaziQiongtongEntry | undefined {
  return BAZI_QIONGTONG_TABLE[`${dayMaster}+${monthBranch}`];
}
