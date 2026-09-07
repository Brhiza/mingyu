import type { BaziQiongtongEntry } from './types';

export const BAZI_QIONGTONG_TABLE: Record<string, BaziQiongtongEntry> = {
  // 甲木
  '甲+寅': {
    dayMaster: '甲',
    monthBranch: '寅',
    seasonSummary: '孟春甲木，初春余寒未尽，木性方萌。',
    primaryGods: ['丙', '癸'],
    classicVerse:
      '初春甲木，余寒犹存，得丙火以暄之，癸水以润之，水火相济，则根深叶茂。无丙则不发，无癸则枯槁。',
    modernExplanation:
      '初春之木，最喜火来暖局、水来滋养，忌金强克伐幼芽。事业上宜循序渐进，贵人多在南方与北方。',
    taboos: ['重金伤根', '过湿无阳'],
  },
  '甲+卯': {
    dayMaster: '甲',
    monthBranch: '卯',
    seasonSummary: '仲春甲木，阳刃当权，木气极盛。',
    primaryGods: ['庚', '丁'],
    classicVerse:
      '仲春甲木，乘权极旺，木盛则喜庚金修剪，无庚则不成梁栋。庚丁双显，木火通明，大贵之格。',
    modernExplanation:
      '羊刃月令，精力充沛、魄力过人，但需有明确目标（金来雕琢）与技术输出（火来泄秀），方成大器。',
    taboos: ['无制过刚', '刑冲羊刃'],
  },
  '甲+辰': {
    dayMaster: '甲',
    monthBranch: '辰',
    seasonSummary: '季春甲木，木气渐老，土旺当令。',
    // 依维基文库《穷通宝鉴》三月甲木"先取庚金，次用壬水……支成金局方可用丁"校正次序
    primaryGods: ['庚', '壬', '丁'],
    classicVerse: '三月甲木，木气相竭。先取庚金修剪，次用壬水润根；支成金局方可用丁。',
    modernExplanation: '根深叶茂，兼具才智与耐力，适合统筹规划与管理工作，兼修技术更具竞争力。',
    taboos: ['土重埋根', '木盛无金'],
  },
  '甲+巳': {
    dayMaster: '甲',
    monthBranch: '巳',
    seasonSummary: '孟夏甲木，天气渐热，火旺木焦。',
    primaryGods: ['癸', '庚'],
    classicVerse: '巳月火旺，木性枯焦，专用癸水调候滋润，次用庚金发水源。无水则木焚，无金则水涸。',
    modernExplanation:
      '夏季之木，首重降温滋养。事业与生活中宜保持冷静，多与智者交流，忌盲目扩张引发内耗。',
    taboos: ['火多木焚', '无水干枯'],
  },
  '甲+午': {
    dayMaster: '甲',
    monthBranch: '午',
    seasonSummary: '仲夏甲木，火炎土燥，木极虚弱。',
    primaryGods: ['癸', '庚'],
    classicVerse:
      '午月伤官秉令，木气虚竭，非癸水不能救命，非庚金不能源远流长。庚癸两全，富贵天然。',
    modernExplanation:
      '思维极度活跃，才华横溢，但易情绪大起大落或精力透支，需水相调候方能细水长流。',
    taboos: ['重火烈炎', '土燥金脆'],
  },
  '甲+未': {
    dayMaster: '甲',
    monthBranch: '未',
    seasonSummary: '季夏甲木，燥土当权，木气受困。',
    primaryGods: ['癸', '庚'],
    classicVerse: '六月甲木，三伏生寒，然燥土炙热，首用癸水润土培木，次取庚金以生癸水。',
    modernExplanation: '需润泽根基以抗暑热，稳扎稳打为上，忌冒进操盘大宗资金。',
    taboos: ['燥烈焦枯', '水气全无'],
  },
  '甲+申': {
    dayMaster: '甲',
    monthBranch: '申',
    seasonSummary: '孟秋甲木，绝地逢克，金气肃杀。',
    primaryGods: ['丁', '庚', '壬'],
    classicVerse:
      '七月甲木，木在绝地，庚金乘令。先取丁火制煞，次取庚金，见壬水化煞生身，富贵不凡。',
    modernExplanation:
      '抗压能力极强，置之死地而后生之象。遇逆境能爆发惊人战斗力，宜学一技之长或担任管理实权。',
    taboos: ['无制纯煞', '水多木漂'],
  },
  '甲+酉': {
    dayMaster: '甲',
    monthBranch: '酉',
    seasonSummary: '仲秋甲木，正官当权，金肃木凋。',
    primaryGods: ['丁', '丙', '癸'],
    classicVerse: '八月甲木，官星得令，木已成材。喜丁火以克金，用丙火以暖局，癸水以滋木。',
    modernExplanation: '为人正直守信，规矩方圆感强。适合从事体制内、法律、金融或规章制度管理。',
    taboos: ['金多折木', '无火抗金'],
  },
  '甲+戌': {
    dayMaster: '甲',
    monthBranch: '戌',
    seasonSummary: '季秋甲木，深秋木凋，土燥金坚。',
    primaryGods: ['癸', '丁'],
    classicVerse: '九月甲木，木性将枯，深秋霜降。专取水以润根，次用火以暖局。水火相济，生机盎然。',
    modernExplanation: '深思熟虑、老练稳健，适合总结复盘、知识沉淀与厚积薄发。',
    taboos: ['燥土无湿', '重金劈伐'],
  },
  '甲+亥': {
    dayMaster: '甲',
    monthBranch: '亥',
    seasonSummary: '孟冬甲木，长生得令，水旺初寒。',
    primaryGods: ['庚', '丁', '丙'],
    classicVerse: '十月甲木，小春之候，木气萌动。喜庚金以修剪，取丁火以暖局，水不宜过多。',
    modernExplanation: '根基得生，潜藏生机，宜以温暖明朗的心态开拓事业，忌过度消极等待。',
    taboos: ['水冷无阳', '土冻根折'],
  },
  '甲+子': {
    dayMaster: '甲',
    monthBranch: '子',
    seasonSummary: '仲冬甲木，严寒彻骨，水泛木浮。',
    primaryGods: ['丙', '丁', '戊'],
    classicVerse: '十一月甲木，严冬水盛，木根冻结。专用丙火解冻，配合戊土制水培根，大贵之局。',
    modernExplanation: '极喜火土温暖命局，为人智慧深邃，适宜在温暖的环境或热情的团队中发挥才华。',
    taboos: ['湿寒无阳', '水旺冲堤'],
  },
  '甲+丑': {
    dayMaster: '甲',
    monthBranch: '丑',
    seasonSummary: '季冬甲木，天寒地冻，冰封土冷。',
    primaryGods: ['丙', '丁', '甲'],
    classicVerse: '十二月甲木，严冬大雪，天地严凝。非丙火解冻不能发育，见丁火通根则生机勃勃。',
    modernExplanation: '韧性极强，善于在逆境中坚守，一旦春暖花开即可展翅高飞。',
    taboos: ['冰雪深寒', '无阳自枯'],
  },

  // 乙木
  '乙+寅': {
    dayMaster: '乙',
    monthBranch: '寅',
    seasonSummary: '孟春乙木，余寒犹存，向阳而生。',
    primaryGods: ['丙', '癸'],
    classicVerse: '正月乙木，初春得禄，喜丙火照暖，配癸水滋润。水火相济，花繁叶茂。',
    modernExplanation: '温润灵秀，学习与领悟力极强，得良师益友启发可迅速崭露头角。',
    taboos: ['强金折损', '水多泛滥'],
  },
  '乙+卯': {
    dayMaster: '乙',
    monthBranch: '卯',
    seasonSummary: '仲春乙木，得令得时，春深木茂。',
    primaryGods: ['癸', '丙'],
    classicVerse: '二月乙木，木旺之极。专用癸水滋木，取丙火泄秀。木火通明，文章显赫。',
    modernExplanation: '文采风流、悟性极高，善于表达与创作，宜走文化、艺术、传媒路线。',
    taboos: ['顽金硬伐', '埋没才华'],
  },
  '乙+午': {
    dayMaster: '乙',
    monthBranch: '午',
    seasonSummary: '仲夏乙木，草木焦枯，极需甘霖。',
    primaryGods: ['癸', '壬'],
    classicVerse: '五月乙木，火炎土燥，禾稼枯槁。专取癸水为上，壬水次之。无水必主夭折残疾。',
    modernExplanation: '思维敏捷但易劳心耗力，需多休息调养身心，事业宜依托稳定大平台。',
    taboos: ['重火烈焚', '水竭无救'],
  },
  '乙+酉': {
    dayMaster: '乙',
    monthBranch: '酉',
    seasonSummary: '仲秋乙木，金气肃杀，绝地受克。',
    primaryGods: ['癸', '丙', '丁'],
    classicVerse: '八月乙木，秋深木凋。先用癸水化金生身，次用丙火温润暖局，丁火制煞。',
    modernExplanation: '处事细腻谨慎，危机意识强，善于在复杂的职场关系中明哲保身。',
    taboos: ['金多木折', '无水化煞'],
  },
  '乙+子': {
    dayMaster: '乙',
    monthBranch: '子',
    seasonSummary: '仲冬乙木，冰封雪盖，寒木向阳。',
    primaryGods: ['丙'],
    classicVerse: '十一月乙木，天寒地冻，花木凋残。专取丙火解冻，无丙则生机全无，见丙则花繁叶茂。',
    modernExplanation:
      '极度渴求阳光与正能量，宜从事令人身心愉悦的行业，在积极环境中能绽放惊人魅力。',
    taboos: ['无火冻毙', '水多漂根'],
  },

  // 丙火
  '丙+寅': {
    dayMaster: '丙',
    monthBranch: '寅',
    seasonSummary: '孟春丙火，长生得令，三阳开泰。',
    primaryGods: ['壬', '庚'],
    classicVerse: '正月丙火，阳气渐升。专用壬水映照，次用庚金劈木发水源。壬丙双透，名魁天下。',
    modernExplanation: '气宇轩昂，领袖气质明显，喜壬水形成“水火既济”，格局宏大、威权在握。',
    taboos: ['土多晦火', '无水枯燥'],
  },
  '丙+午': {
    dayMaster: '丙',
    monthBranch: '午',
    seasonSummary: '仲夏丙火，日正中天，阳极之势。',
    primaryGods: ['壬', '庚'],
    classicVerse: '五月丙火，阳极火炎。专取壬水辅阳光，用庚金生壬水，无水则火炎自焚。',
    modernExplanation: '能量惊人、开拓力拉满，但极需制度（水）来规范与平衡，防刚愎自用。',
    taboos: ['火炎土燥', '无水制炎'],
  },
  '丙+申': {
    dayMaster: '丙',
    monthBranch: '申',
    seasonSummary: '孟秋丙火，阳气渐收，气势衰退。',
    primaryGods: ['壬', '丙', '戊'],
    classicVerse: '七月丙火，金旺火退。专取壬水辅映，次见比肩帮扶，名显四方。',
    modernExplanation: '善于整合资源，商业敏锐度高，利于拓展外部合作与金融投资。',
    taboos: ['金多耗气', '土多晦光'],
  },
  '丙+子': {
    dayMaster: '丙',
    monthBranch: '子',
    seasonSummary: '仲冬丙火，日照寒潭，水旺火衰。',
    primaryGods: ['壬', '戊', '甲'],
    classicVerse: '十一月丙火，冬至一阳生。专用壬水映日，用戊土制水培火，甲木引丁通关。',
    modernExplanation: '外柔内刚，善解人意，具有极高的情商与同理心，适合公关、管理与咨询。',
    taboos: ['水泛无制', '阴寒太盛'],
  },

  // 丁火
  '丁+卯': {
    dayMaster: '丁',
    monthBranch: '卯',
    seasonSummary: '仲春丁火，印旺生身，木火通明。',
    primaryGods: ['庚', '甲'],
    classicVerse: '二月丁火，木旺秉令。专取庚金劈甲以引丁，无庚则木旺火塞。庚甲双显，大富大贵。',
    modernExplanation: '才思敏捷，钻研能力极强，在专业领域有卓越造诣，适合深耕技术与学术。',
    taboos: ['木多火窒', '水多灭火'],
  },
  '丁+午': {
    dayMaster: '丁',
    monthBranch: '午',
    seasonSummary: '仲夏丁火，得禄建刃，火势极旺。',
    primaryGods: ['壬', '庚', '癸'],
    classicVerse: '五月丁火，火势极旺。专取壬水调候，庚金发水源，无水则烈火自焚。',
    modernExplanation: '行事雷厉风行，原则性强，需戒骄戒躁，以柔克刚能成大事。',
    taboos: ['火烈无水', '木多自焚'],
  },
  '丁+酉': {
    dayMaster: '丁',
    monthBranch: '酉',
    seasonSummary: '仲秋丁火，退气火衰，财旺身弱。',
    primaryGods: ['甲', '庚', '丙'],
    classicVerse: '八月丁火，金旺火死。专取甲木生火，庚金劈木，丙火暖局相助。',
    modernExplanation: '理财意识强，眼光精准，宜结伴创业或依托团队协同获取财富。',
    taboos: ['财多身弱', '无木引火'],
  },
  '丁+子': {
    dayMaster: '丁',
    monthBranch: '子',
    seasonSummary: '仲冬丁火，天寒水旺，绝地求生。',
    primaryGods: ['甲', '庚'],
    classicVerse: '十一月丁火，水旺冰封。专取甲木通关引火，庚金劈木以生丁，富贵天然。',
    modernExplanation: '有极强的逆境适应力与抗挫折力，重情重义，深受信赖。',
    taboos: ['水旺灭丁', '无木救助'],
  },

  // 戊土
  '戊+辰': {
    dayMaster: '戊',
    monthBranch: '辰',
    seasonSummary: '季春戊土，木余气在，水湿土润。',
    primaryGods: ['甲', '丙', '癸'],
    classicVerse: '三月戊土，渐有生发之机。先用甲木疏土，次用丙火照暖，癸水滋润。',
    modernExplanation: '为人忠厚稳健，包容度极高，适合从事大局管理、人力资源或资产运营。',
    taboos: ['土厚木折', '无火无生'],
  },
  '戊+午': {
    dayMaster: '戊',
    monthBranch: '午',
    seasonSummary: '仲夏戊土，阳刃得地，火炎土燥。',
    primaryGods: ['壬', '甲', '丙'],
    classicVerse: '五月戊土，火炎土燥。先取壬水调候滋润，次取甲木疏土，无水则焦脆不生。',
    modernExplanation: '魄力宏大、信念坚实，需注重团队沟通与倾听意见，以水润局方显温和。',
    taboos: ['火炎土焦', '水气全无'],
  },
  '戊+戌': {
    dayMaster: '戊',
    monthBranch: '戌',
    seasonSummary: '季秋戊土，土重当权，万物归藏。',
    primaryGods: ['甲', '丙', '癸'],
    classicVerse: '九月戊土，土重当权。专取甲木疏土，见丙癸配合，大富大贵。',
    modernExplanation: '做事严谨规矩，信誉卓著，适合做长线战略布局或专业技术沉淀。',
    taboos: ['厚土无疏', '土重埋金'],
  },
  '戊+子': {
    dayMaster: '戊',
    monthBranch: '子',
    seasonSummary: '仲冬戊土，冻土冰封，寒气凝结。',
    primaryGods: ['丙', '甲'],
    classicVerse: '十一月戊土，严寒水盛，冻土不生。专用丙火解冻，次取甲木疏土发荣。',
    modernExplanation: '极喜暖局火相生扶，在温馨包容的团队中能最大程度发挥领导潜能。',
    taboos: ['冰封千里', '湿寒无阳'],
  },

  // 己土
  '己+卯': {
    dayMaster: '己',
    monthBranch: '卯',
    seasonSummary: '仲春己土，官煞当权，木旺土虚。',
    // 依维基文库《穷通宝鉴》二月己土"先取甲木疏之……次取癸水润之……加以一丙出透"校正
    primaryGods: ['甲', '癸', '丙'],
    classicVerse:
      '二月己土，阳气渐升，木旺土虚。先取甲木疏土，次取癸水润泽；甲癸出干科甲，一丙出透尤佳。',
    modernExplanation: '心思细腻，善于协调各方利益，适合走策划、文职或咨询管理路线。',
    taboos: ['木多克破', '无火生身'],
  },
  '己+未': {
    dayMaster: '己',
    monthBranch: '未',
    seasonSummary: '季夏己土，燥气当令，田园干涸。',
    primaryGods: ['癸', '丙'],
    classicVerse: '六月己土，三伏生寒，然燥土需润。专取癸水润土，丙火相生，水火调和。',
    modernExplanation: '忍耐力强，富有奉献精神，注意防范过度劳累，合理调节身心节奏。',
    taboos: ['燥土无湿', '过烈自焚'],
  },
  '己+子': {
    dayMaster: '己',
    monthBranch: '子',
    seasonSummary: '仲冬己土，严寒冰封，土凝水冻。',
    primaryGods: ['丙', '甲'],
    classicVerse: '十一月己土，天寒地冻，非丙火不能化冻生土。丙透甲辅，官贵天然。',
    modernExplanation: '深谋远虑，善于守财与规避风险，得贵人温暖指引能成就大业。',
    taboos: ['冰雪深寒', '无阳枯灭'],
  },

  // 庚金
  '庚+寅': {
    dayMaster: '庚',
    monthBranch: '寅',
    seasonSummary: '孟春庚金，绝地逢春，木旺金绝。',
    primaryGods: ['丙', '甲', '丁'],
    classicVerse: '正月庚金，木旺金绝。先取丙火暖局，次取甲木通关，丁火熔炼。',
    modernExplanation: '具有极强的开拓意识与商业头脑，宜借助平台与贵人借力打力。',
    taboos: ['木多金缺', '过寒无暖'],
  },
  '庚+午': {
    dayMaster: '庚',
    monthBranch: '午',
    seasonSummary: '仲夏庚金，败地受克，火炎金熔。',
    primaryGods: ['壬', '癸'],
    classicVerse: '五月庚金，火炎土燥，金气消融。专取壬水癸水调候淬火，无水则金销。',
    modernExplanation: '经历过严格锻造与磨砺，人格魅力与职业能力突出，宜保持谦逊包容。',
    taboos: ['火炎金销', '水气全无'],
  },
  '庚+申': {
    dayMaster: '庚',
    monthBranch: '申',
    seasonSummary: '孟秋庚金，专禄得令，刚锐无比。',
    primaryGods: ['丁', '甲'],
    classicVerse: '七月庚金，刚锐极矣。专取丁火熔炼成材，配甲木引丁，庚丁甲三透，名登金榜。',
    modernExplanation:
      '意志坚如钢铁，执行力极强，需经过严格磨砺（丁火）方成国家栋梁，适合硬核技术与攻坚。',
    taboos: ['顽金无炼', '土重埋金'],
  },
  '庚+子': {
    dayMaster: '庚',
    monthBranch: '子',
    seasonSummary: '仲冬庚金，死地逢寒，金寒水冷。',
    primaryGods: ['丁', '甲', '丙'],
    classicVerse: '十一月庚金，水旺金冷。专取丁火解冻炼金，甲木引火生丁，丙火暖局。',
    modernExplanation: '冷峻睿智，分析判断力惊人，宜用热情与行动力温暖身心与事业。',
    taboos: ['金寒水冻', '无火无生'],
  },

  // 辛金
  '辛+卯': {
    dayMaster: '辛',
    monthBranch: '卯',
    seasonSummary: '仲春辛金，春深木旺，金气虚弱。',
    primaryGods: ['壬', '甲'],
    classicVerse: '二月辛金，阳和之气，木旺金绝。专取壬水淘洗，甲木疏土，温润显贵。',
    modernExplanation: '气质高雅，注重品质与细节，在艺术、设计、金融或法务领域得心应手。',
    taboos: ['火多熔金', '土重埋没'],
  },
  '辛+巳': {
    dayMaster: '辛',
    monthBranch: '巳',
    seasonSummary: '孟夏辛金，官星得令，火炎金脆。',
    primaryGods: ['壬', '癸'],
    classicVerse: '四月辛金，火旺金衰。专取壬水调候淬金，癸水润局，见水则珠玉发光。',
    modernExplanation: '责任心极强，善解人意，宜在成熟规范的体系中展现专业才华。',
    taboos: ['火烈熔金', '燥土脆金'],
  },
  '辛+酉': {
    dayMaster: '辛',
    monthBranch: '酉',
    seasonSummary: '仲秋辛金，专禄得令，润泽温清。',
    primaryGods: ['壬', '甲'],
    classicVerse: '八月辛金，专禄当权。专取壬水淘洗，金水双清，世称才子；见甲木疏土更妙。',
    modernExplanation: '金白水清，才智出众，口才与文笔俱佳，极富个人魅力与影响力。',
    taboos: ['厚土埋金', '火烈伤金'],
  },
  '辛+亥': {
    dayMaster: '辛',
    monthBranch: '亥',
    seasonSummary: '孟冬辛金，水旺伤官，金白水清。',
    primaryGods: ['丙', '壬'],
    classicVerse: '十月辛金，水旺金冷。专取丙火解冻照暖，壬水淘金泄秀，水火既济大贵。',
    modernExplanation: '聪明绝顶，悟性超群，具有极佳的创新能力与洞察力。',
    taboos: ['金寒水冻', '无丙照暖'],
  },

  // 壬水
  '壬+寅': {
    dayMaster: '壬',
    monthBranch: '寅',
    seasonSummary: '孟春壬水，春水生发，水木清华。',
    primaryGods: ['戊', '辛', '丙'],
    classicVerse: '正月壬水，水旺泄于木。专取戊土作堤防，辛金生水，丙火暖局。',
    modernExplanation: '思维开阔，具有极强的包容性与创造力，适合综合性战略统筹。',
    taboos: ['木多泄尽', '水寒无阳'],
  },
  '壬+午': {
    dayMaster: '壬',
    monthBranch: '午',
    seasonSummary: '仲夏壬水，财旺司权，水势休囚。',
    primaryGods: ['庚', '辛', '癸'],
    classicVerse: '五月壬水，火炎土燥，水极虚竭。专取庚金发水源，辛金相辅，癸水帮身。',
    modernExplanation: '商业天赋出众，适应能力强，宜建立稳固的财务防火墙与安全底线。',
    taboos: ['火土焦干', '水源断绝'],
  },
  '壬+申': {
    dayMaster: '壬',
    monthBranch: '申',
    seasonSummary: '孟秋壬水，长生得令，水源充沛。',
    primaryGods: ['戊', '丁'],
    classicVerse: '七月壬水，长生母旺，水势浩瀚。专取戊土为堤防，丁火暖局制金，大贵之格。',
    modernExplanation: '精力充沛，格局宏阔，有成为行业领军者之潜能，重在自我约束与规则建立。',
    taboos: ['金多水浊', '水泛无制'],
  },
  '壬+子': {
    dayMaster: '壬',
    monthBranch: '子',
    seasonSummary: '仲冬壬水，阳刃当权，汪洋大海。',
    primaryGods: ['戊', '丙'],
    classicVerse:
      '十一月壬水，乘权司令，汪洋大海。专取戊土作堤防，用丙火暖水解冻。水得戊制，方成大器。',
    modernExplanation:
      '才智浩瀚如海，志向极其远大，需要强大的规则与目标约束（戊土筑堤）方能成就惊天伟业。',
    taboos: ['冲破堤防', '冰封千里'],
  },

  // 癸水
  '癸+卯': {
    dayMaster: '癸',
    monthBranch: '卯',
    seasonSummary: '仲春癸水，木旺泄水，雨露滋润。',
    primaryGods: ['辛', '丙'],
    classicVerse: '二月癸水，雨露滋木。木旺则水虚，专取辛金生水，丙火照暖，水火既济。',
    modernExplanation: '温婉谦逊，善于默默付出与滋养他人，在教育、文艺、公益等领域广受赞誉。',
    taboos: ['木多水竭', '土多浊水'],
  },
  '癸+巳': {
    dayMaster: '癸',
    monthBranch: '巳',
    seasonSummary: '孟夏癸水，火旺水枯，极需发源。',
    primaryGods: ['辛', '壬', '癸'],
    classicVerse: '四月癸水，火土并旺，水将涸竭。专取辛金发水源，壬水帮身，无金则夭折。',
    modernExplanation: '处事机敏细腻，能感知细微变化，需依托强大后盾方能尽情施展才华。',
    taboos: ['火炎干涸', '燥土克灭'],
  },
  '癸+酉': {
    dayMaster: '癸',
    monthBranch: '酉',
    seasonSummary: '仲秋癸水，金旺水生，母旺子相。',
    primaryGods: ['辛', '丙'],
    classicVerse: '八月癸水，金白水清。专取辛金发源，丙火照暖。丙辛双透，名利兼全。',
    modernExplanation: '品行纯洁高尚，逻辑推理与审美鉴赏力极强，名望与威信日隆。',
    taboos: ['土多浊水', '水多泛滥'],
  },
  '癸+子': {
    dayMaster: '癸',
    monthBranch: '子',
    seasonSummary: '仲冬癸水，专禄当权，冰霜雨雪。',
    primaryGods: ['丙', '辛'],
    classicVerse:
      '十一月癸水，严冬冰雪，水凝成冰。专取丙火解冻，辛金生水源。见丙火解冻，富贵非凡。',
    modernExplanation: '内省内敛，智谋深藏不露，在热情关怀与阳光氛围中可爆发惊人成就。',
    taboos: ['无火冰封', '水旺冲天'],
  },
};

export function getBaziQiongtongAdvice(
  dayMaster: string,
  monthBranch: string,
): BaziQiongtongEntry | undefined {
  const direct = BAZI_QIONGTONG_TABLE[`${dayMaster}+${monthBranch}`];
  if (direct)
    return {
      ...direct,
      requestedMonth: monthBranch,
      matchedMonth: monthBranch,
      seasonFallback: false,
    };

  // 季节 fallback
  const seasonMonthMap: Record<string, string[]> = {
    寅: ['寅', '卯', '辰'],
    卯: ['卯', '寅', '辰'],
    辰: ['辰', '寅', '卯'],
    巳: ['巳', '午', '未'],
    午: ['午', '巳', '未'],
    未: ['未', '午', '巳'],
    申: ['申', '酉', '戌'],
    酉: ['酉', '申', '戌'],
    戌: ['戌', '申', '酉'],
    亥: ['亥', '子', '丑'],
    子: ['子', '亥', '丑'],
    丑: ['丑', '子', '亥'],
  };

  const candidates = seasonMonthMap[monthBranch] ?? [];
  for (const branch of candidates) {
    const entry = BAZI_QIONGTONG_TABLE[`${dayMaster}+${branch}`];
    if (entry) {
      // 同季借用：明确登记实际命中月份，避免跨月资料被当作本月专条展示
      return { ...entry, requestedMonth: monthBranch, matchedMonth: branch, seasonFallback: true };
    }
  }

  return undefined;
}
