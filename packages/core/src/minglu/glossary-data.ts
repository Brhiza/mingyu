/**
 * @file 命录百科全书词典库 (Minglu Glossary & Metaphysics Encyclopedia)
 * @description 汇集传统命理（八字、紫微、占星、风水、干支五行神煞）核心概念的标准释义与典籍考据。
 */

import type { MingluGlossaryEntry } from './types';

export const MINGLU_GLOSSARY_DATABASE: MingluGlossaryEntry[] = [
  // 一、天干地支
  {
    term: '甲木',
    category: '干支',
    pinyin: 'jiǎ mù',
    shortDesc: '阳木，位居十干之首，象征参天大木、栋梁之才。',
    fullDesc:
      '甲木为纯阳之木，体本坚固，参天雄壮。在天为雷雨之气，在地为大树栋梁。春生得令则条达生发，秋生借庚金劈斫而成栋梁，冬生喜丙火照暖以解寒冻。性情仁慈刚直、自尊心强、进取向上。',
    classicSource:
      '《滴天髓》：“甲木参天，脱胎要火。春不容金，秋不容土。火炽乘龙，水宕骑虎。地润天和，植立千古。”',
    anchorId: 'glossary-jia-mu',
    relatedTerms: ['乙木', '阳木', '天干五合', '仁'],
  },
  {
    term: '乙木',
    category: '干支',
    pinyin: 'yǐ mù',
    shortDesc: '阴木，象征花草藤萝、枝叶柔木。',
    fullDesc:
      '乙木为柔纯之阴木，其性柔韧通达，善于借势攀附。生于春喜火照，生于夏喜水润，生于秋喜火制金，生于冬喜土培火暖。为人温和圆通、柔中带刚、适应力极强。',
    classicSource:
      '《滴天髓》：“乙木虽柔，刲羊解牛。怀丁抱丙，跨凤乘猴。虚湿之地，骑马亦忧。藤萝系甲，可春可秋。”',
    anchorId: 'glossary-yi-mu',
    relatedTerms: ['甲木', '藤萝系甲', '阴木'],
  },
  {
    term: '丙火',
    category: '干支',
    pinyin: 'bǐng huǒ',
    shortDesc: '阳火，太阳之火，光明普照，至阳至烈。',
    fullDesc:
      '丙火为纯阳之火，如丽日中天，普照万物。能熔金锻铁，能暖水解冻。性情光明磊落、热情开朗、急躁而无城府。喜壬水相济以成“日照江河”之象。',
    classicSource:
      '《滴天髓》：“丙火猛烈，欺霜傲雪。能煅庚金，从辛反怯。土众成慈，水猖显节。虎马犬乡，甲来成灭。”',
    anchorId: 'glossary-bing-huo',
    relatedTerms: ['丁火', '壬水', '水火既济', '礼'],
  },
  {
    term: '丁火',
    category: '干支',
    pinyin: 'dīng huǒ',
    shortDesc: '阴火，灯烛之火、文明之象、内敛灵动。',
    fullDesc:
      '丁火为昭融之火，柔中蕴明，如星烛万家、文明显化。性情细腻温和、重礼守信、内秀深思。生于秋冬喜甲木引生、庚金劈引。',
    classicSource:
      '《滴天髓》：“丁火柔中，内性昭融。抱乙而孝，合壬而忠。旺而不烈，衰而不穷。如有嫡母，可秋可冬。”',
    anchorId: 'glossary-ding-huo',
    relatedTerms: ['丙火', '阴火', '文明'],
  },
  {
    term: '戊土',
    category: '干支',
    pinyin: 'wù tǔ',
    shortDesc: '阳土，高山厚土、城墙砥柱、沉静重厚。',
    fullDesc:
      '戊土为泰山之土，坚固浑厚，能蓄水挡风。为人诚实守信、包容博大、稳健厚重但略显固执。生于春夏喜水润金泄，生于秋冬喜火暖木梳。',
    classicSource:
      '《滴天髓》：“戊土固重，既中且正。静翕动辟，万物司命。水润物生，土燥物病。若在艮坤，怕冲宜静。”',
    anchorId: 'glossary-wu-tu',
    relatedTerms: ['己土', '厚德载物', '信'],
  },
  {
    term: '己土',
    category: '干支',
    pinyin: 'jǐ tǔ',
    shortDesc: '阴土，田园润土、滋生万物、温润包容。',
    fullDesc:
      '己土为田园稼穑之土，卑湿柔顺，能培木纳水。为人细腻多思、隐忍包容、善于谋划。喜丙火普照、癸水滋润以长万物。',
    classicSource:
      '《滴天髓》：“己土卑湿，中正蓄藏。不愁木盛，不畏水狂。火少火晦，金多金光。若要物旺，宜助宜帮。”',
    anchorId: 'glossary-ji-tu',
    relatedTerms: ['戊土', '田园之土'],
  },
  {
    term: '庚金',
    category: '干支',
    pinyin: 'gēng jīn',
    shortDesc: '阳金，顽钝矿石、刀剑金戈、刚健肃杀。',
    fullDesc:
      '庚金为纯阳之金，刚强猛烈，非丁火炉冶不能成器。为人果敢坚决、仗义执言、威武不屈。喜丁火锻炼、甲木引燃、壬水淬厉。',
    classicSource:
      '《滴天髓》：“庚金带杀，刚健为最。得水而清，得火而锐。土润则生，土干则脆。能赢甲兄，输于乙妹。”',
    anchorId: 'glossary-geng-jin',
    relatedTerms: ['辛金', '丁火', '义'],
  },
  {
    term: '辛金',
    category: '干支',
    pinyin: 'xīn jīn',
    shortDesc: '阴金，珠玉首饰、清秀温润、自尊华贵。',
    fullDesc:
      '辛金为清润之阴金，如珠玑宝石，质极温润。畏厚土埋没，喜壬水淘洗以显光华。为人聪慧自尊、讲究格调、心思细腻。',
    classicSource:
      '《滴天髓》：“辛金软弱，温润而清。畏土之多，乐水之盈。能扶社稷，能救生灵。热则喜母，寒则喜丁。”',
    anchorId: 'glossary-xin-jin',
    relatedTerms: ['庚金', '壬水淘洗'],
  },
  {
    term: '壬水',
    category: '干支',
    pinyin: 'rén shuǐ',
    shortDesc: '阳水，江河奔流、汪洋大海、智谋恢弘。',
    fullDesc:
      '壬水为汪洋之水，势不可遏，周流不息。为人智慧通达、善应万变、胸襟广阔但易放浪不羁。喜戊土为堤岸成江河奔腾，喜庚金发源。',
    classicSource:
      '《滴天髓》：“壬水通河，能泄金气。刚中之德，周流不滞。通根透癸，冲天奔地。化则有情，从则相济。”',
    anchorId: 'glossary-ren-shui',
    relatedTerms: ['癸水', '戊土防洪', '智'],
  },
  {
    term: '癸水',
    category: '干支',
    pinyin: 'guǐ shuǐ',
    shortDesc: '阴水，雨露甘霖、深潭潜流、静水流深。',
    fullDesc:
      '癸水为纯阴之水，润泽万物，至静至柔。为人聪明深沉、敏感洞察、善于隐忍。喜辛金发源、丙火化气、乙木引通。',
    classicSource:
      '《滴天髓》：“癸水至弱，达于天津。得龙而运，功化斯神。不愁火土，不论庚辛。合戊见火，化象斯真。”',
    anchorId: 'glossary-gui-shui',
    relatedTerms: ['壬水', '雨露之水'],
  },

  // 二、十神体系
  {
    term: '正官',
    category: '十神',
    pinyin: 'zhèng guān',
    shortDesc: '克我而阴阳相配者，代表规矩、官位、责任、信誉、正统秩序。',
    fullDesc:
      '正官为立身之本，代表正统规矩、自律修养、社会名望、公职贵气与责任担当。女命亦代表正夫正缘。喜印星护卫成“官印相生”，忌伤官克害及官杀混杂。',
    classicSource: '《子平真诠》：“官由天命，非贵不居。有官先看印，无印看财，官喜身旺，忌行绝地。”',
    anchorId: 'glossary-zheng-guan',
    relatedTerms: ['七杀', '官印相生', '伤官见官'],
  },
  {
    term: '七杀',
    category: '十神',
    pinyin: 'qī shā',
    shortDesc: '克我而阴阳同性者，代表魄力、权威、决断、挑战与变革力。',
    fullDesc:
      '七杀如猛虎利剑，性情刚烈果敢、具有强烈的竞争心、开拓力与危机应对意识。七杀有制化（如食神制杀、印星化杀、羊刃合杀）则化权显贵；无制则易受挫折困扰。',
    classicSource:
      '《渊海子平》：“七杀有制化为权，顶天立地做高官。杀无制化终为鬼，身弱逢之命难安。”',
    anchorId: 'glossary-qi-sha',
    relatedTerms: ['食神制杀', '杀印相生', '羊刃驾杀'],
  },
  {
    term: '正印',
    category: '十神',
    pinyin: 'zhèng yìn',
    shortDesc: '生我而阴阳相配者，代表母亲、学识、慈悲、庇护、文化名望。',
    fullDesc:
      '正印如母之慈爱、书香庇护，主福寿康宁、慈悲仁爱、学术文凭与权威资质。为人重道义、喜安稳、心态平和。忌财星破印，喜官星生助。',
    classicSource: '《三命通会》：“印绶者，生我之本也。凡命中得正印，多主清高仁慈，名播天下。”',
    anchorId: 'glossary-zheng-yin',
    relatedTerms: ['偏印', '财星破印', '官印相生'],
  },
  {
    term: '偏印',
    category: '十神',
    pinyin: 'piān yìn',
    shortDesc: '生我而阴阳同性者，代表直觉、偏门智慧、专业技术、哲思玄学。',
    fullDesc:
      '偏印主领悟力极强、心思深刻、特立独行，善于冷门技术、艺术、学术与玄思探究。若见食神而无财星制约则称为“枭神夺食”，需要注意心胸调节与养生。',
    classicSource: '《渊海子平》：“偏印者，又名倒食。若见食神，反为祸端；若见正财，反显其贵。”',
    anchorId: 'glossary-pian-yin',
    relatedTerms: ['枭神夺食', '直觉与偏门智慧'],
  },
  {
    term: '正财',
    category: '十神',
    pinyin: 'zhèng cái',
    shortDesc: '我克而阴阳相配者，代表固定薪俸、勤俭积聚、正妻产业、踏实务实。',
    fullDesc:
      '正财代表按步就班之财富、薪金收入、实干务实、勤俭持家与契约精神。男命亦代表正妻与主要家庭责任。喜身旺任财、官星护卫，忌劫财克夺。',
    classicSource: '《子平真诠》：“财者，人所爱也。正财以实劳致富，不取投机之利。”',
    anchorId: 'glossary-zheng-cai',
    relatedTerms: ['偏财', '比劫夺财', '食伤生财'],
  },
  {
    term: '偏财',
    category: '十神',
    pinyin: 'piān cái',
    shortDesc: '我克而阴阳同性者，代表流动之财、商业投资、慷慨机缘、社交人脉。',
    fullDesc:
      '偏财主意外之财、商业机缘、资本运作、慷慨重义与八面玲珑。对机遇敏锐，敢于开拓。男命亦代表异性机缘。喜食神生助、官星化解比劫。',
    classicSource: '《渊海子平》：“偏财天资豪爽，散财聚人，善于权变与商道。”',
    anchorId: 'glossary-pian-cai',
    relatedTerms: ['正财', '偏财格', '商机运作'],
  },
  {
    term: '食神',
    category: '十神',
    pinyin: 'shí shén',
    shortDesc: '我生而阴阳相配者，代表才华温秀、口福寿禄、宽厚从容、生财之源。',
    fullDesc:
      '食神为寿星与福星，代表才华自然流露、艺术审美、温文尔雅、享受生活。能生财星成“食神生财”，能制七杀成“食神制杀”。为人乐观大度、重情致。',
    classicSource: '《三命通会》：“食神一位胜财官。为人宽厚寿元长，才华如水润无声。”',
    anchorId: 'glossary-shi-shen',
    relatedTerms: ['食神生财', '食神制杀', '寿星'],
  },
  {
    term: '伤官',
    category: '十神',
    pinyin: 'shāng guān',
    shortDesc: '我生而阴阳同性者，代表惊世才华、叛逆创新、辩才机变、开拓进取。',
    fullDesc:
      '伤官为才华纵横之星，主极高灵性、创新打破、口才雄辩、不拘陈规。若见官星无财通关则易成“伤官见官”；若配印成“伤官配印”，或生财成“伤官生财”，皆为主富主贵之大才。',
    classicSource: '《渊海子平》：“伤官虽克官，有财反作权。配印多清贵，生财福绵绵。”',
    anchorId: 'glossary-shang-guan',
    relatedTerms: ['伤官见官', '伤官配印', '伤官生财'],
  },
  {
    term: '比肩',
    category: '十神',
    pinyin: 'bǐ jiān',
    shortDesc: '同我而阴阳同性者，代表兄弟同侪、平等协作、自立自强、意志坚毅。',
    fullDesc:
      '比肩如肩并肩之兄弟同道，主自尊自信、坚韧不拔、自食其力。身弱喜比肩帮身任财官，身强财弱则防竞争破耗。',
    classicSource: '《子平真诠》：“同我者为比劫。强则分夺，弱则扶持。”',
    anchorId: 'glossary-bi-jian',
    relatedTerms: ['劫财', '比劫帮身', '同侪竞争'],
  },
  {
    term: '劫财',
    category: '十神',
    pinyin: 'jié cái',
    shortDesc: '同我而阴阳相配者，代表热忱魄力、冒险拼搏、执着进取、竞争张力。',
    fullDesc:
      '劫财性情刚毅热烈、善于社交应酬、敢于冒险拼搏。身弱借此得力抗压，身强见之易生争强好胜或开销破耗之兆。配羊刃则成英豪权柄。',
    classicSource: '《三命通会》：“劫财主进取果敢，能任重致远，须官杀以制之。”',
    anchorId: 'glossary-jie-cai',
    relatedTerms: ['比肩', '羊刃', '比劫夺财'],
  },

  // 三、神煞与吉凶
  {
    term: '天乙贵人',
    category: '神煞',
    pinyin: 'tiān yǐ guì rén',
    shortDesc: '百神之首，至尊吉星，主遇难呈祥、逢凶化吉、贵人提携。',
    fullDesc:
      '天乙贵人为命理最尊崇之吉星，主遇险化夷、出入平安、贵人相助、功名早遂。以日干或年干查地支。命中带之多仪态端庄、德望清高。',
    classicSource: '《渊海子平》：“天乙贵人者，天上至尊之神。若人遇之，百恶不侵，逢凶化吉。”',
    anchorId: 'glossary-tian-yi-gui-ren',
    relatedTerms: ['太极贵人', '天德贵人', '吉神'],
  },
  {
    term: '文昌贵人',
    category: '神煞',
    pinyin: 'wén chāng guì rén',
    shortDesc: '掌管文章学识、智慧科名、文思敏捷之吉神。',
    fullDesc:
      '文昌为食神之禄位，主聪明好学、文采飞扬、考试名列前茅、著作等身。命带文昌且不逢冲破者，多在学术、文职、策划或专业领域成名。',
    classicSource: '《紫微斗数全书》：“文昌守命兼吉曜，皇殿朝班定富贵。”',
    anchorId: 'glossary-wen-chang-gui-ren',
    relatedTerms: ['学堂词馆', '食神', '科名'],
  },
  {
    term: '驿马',
    category: '神煞',
    pinyin: 'yì mǎ',
    shortDesc: '奔波迁变、远行开拓、升迁调动之动星。',
    fullDesc:
      '驿马主走动奔波、出国留学、经商迁移、职业变动。以三合局对冲之支查取。吉神乘马主升迁腾达、驰骋四海；凶煞乘马多劳碌奔波。',
    classicSource: '《三命通会》：“马为动态之极，得禄马交驰者，富贵超群。”',
    anchorId: 'glossary-yi-ma',
    relatedTerms: ['禄马交驰', '财禄夹马', '迁移'],
  },
  {
    term: '华盖',
    category: '神煞',
    pinyin: 'huá gài',
    shortDesc: '艺术星、哲思星、清高孤傲、超凡脱俗。',
    fullDesc:
      '华盖为三合墓库之星，如皇帝出巡之宝盖。主智慧过人、清高脱俗、喜哲学玄学、艺术宗教。命带华盖多才华卓绝，但易有孤独感。',
    classicSource: '《渊海子平》：“华盖星通神佛道，聪明性喜静中修。”',
    anchorId: 'glossary-hua-gai',
    relatedTerms: ['孤辰寡宿', '艺术灵性'],
  },
  {
    term: '羊刃',
    category: '神煞',
    pinyin: 'yáng rèn',
    shortDesc: '极刚极烈之煞，司掌权柄威武，亦主急躁刚决。',
    fullDesc:
      '羊刃为帝旺之所，刚烈至极。有官杀制约或驾杀成格，则为将帅权臣、大开大合之英杰；无制而身极旺则防急躁冲动与刑伤。',
    classicSource: '《滴天髓》：“羊刃重逢，非制伏不能显其威；驾杀并用，乃大将之才。”',
    anchorId: 'glossary-yang-ren',
    relatedTerms: ['七杀', '羊刃驾杀', '帝旺'],
  },
  {
    term: '咸池（桃花）',
    category: '神煞',
    pinyin: 'xián chí',
    shortDesc: '沐浴之所，主容貌秀丽、情思浪漫、异性人缘、艺术风采。',
    fullDesc:
      '咸池又称桃花，主容貌清俊、多情重意、审美与艺术感知力强。配贵人正印主风度翩翩、大得人缘；若见冲刑或忌神多情则需修持定力。',
    classicSource: '《三命通会》：“咸池沐浴之乡，容华照人，风雅多情。”',
    anchorId: 'glossary-xian-chi',
    relatedTerms: ['红鸾天喜', '沐浴', '艺术人缘'],
  },

  // 四、紫微斗数核心
  {
    term: '紫微星',
    category: '星曜',
    pinyin: 'zǐ wēi xīng',
    shortDesc: '北斗帝王星，己土，司尊贵、统领、威望与气度。',
    fullDesc:
      '紫微星为中天北斗帝星，五行属土。主尊贵仁厚、领袖气质、权威威信。喜左辅右弼为辅佐，天魁天钺为机缘，文昌文曲为文华。若无吉星辅佐则为孤君。',
    classicSource: '《紫微斗数全书》：“紫微天府全依辅弼之功。帝坐命宫，威加四海。”',
    anchorId: 'glossary-zi-wei-xing',
    relatedTerms: ['天府星', '君臣庆会', '北斗星系'],
  },
  {
    term: '天府星',
    category: '星曜',
    pinyin: 'tiān fǔ xīng',
    shortDesc: '南斗令星，戊土，司财帛、田产、稳重与库藏。',
    fullDesc:
      '天府星为南斗主星，号称“天库”，五行属阳土。主稳重大度、保守善藏、重视信用、擅理财与持家。与天相为对星，互为府相朝垣。',
    classicSource: '《紫微斗数全书》：“天府尊星也，在命财帛田宅，皆主富贵厚重。”',
    anchorId: 'glossary-tian-fu-xing',
    relatedTerms: ['紫微星', '府相朝垣', '南斗星系'],
  },
  {
    term: '生年四化',
    category: '格局',
    pinyin: 'shēng nián sì huà',
    shortDesc: '由出生年天干所化出的化禄、化权、化科、化忌四种能量变异。',
    fullDesc:
      '生年四化为紫微斗数之灵魂。化禄主缘起、收获与财禄；化权主掌控、权威与魄力；化科主名声、文采与化解；化忌主执念、困阻、关注点与考验。四化落入不同宫位星曜，构成一生命局之重心。',
    classicSource: '《紫微斗数全书》：“科权禄主吉相迎，化忌来冲起波澜。”',
    anchorId: 'glossary-sheng-nian-si-hua',
    relatedTerms: ['化禄', '化权', '化科', '化忌'],
  },
  {
    term: '三方四正',
    category: '宫位',
    pinyin: 'sān fāng sì zhèng',
    shortDesc: '本宫的三合宫（三方）与对冲宫（正对），构成判定宫位吉凶的立体网络。',
    fullDesc:
      '任何宫位均与其相隔四宫的两个三合宫构成“三方”，再加上正对面的对宫，合称“三方四正”。看任何宫位之成就与吉凶，必将三方四正之星曜吉煞合盘推求。',
    classicSource: '《紫微斗数骨髓赋》：“看命须详三方四正，吉凶皆在照会之间。”',
    anchorId: 'glossary-san-fang-si-zheng',
    relatedTerms: ['对宫', '三合宫', '宫位会照'],
  },

  // 五、占星与风水
  {
    term: '上升星座',
    category: '占星',
    pinyin: 'shàng shēng xīng zuò',
    shortDesc: '出生瞬间东方地平线升起的黄道星座，代表外在人格、面貌与第一印象。',
    fullDesc:
      '上升点（Ascendant）为西方占星本命盘第一宫的起点，代表个体的外在投射、行为模式、生命起点以及身体面相。是本命盘四轴点之首。',
    classicSource: '现代西方占星本命全书：“上升点是个体向世界呈现的面具与自我实现的最初载体。”',
    anchorId: 'glossary-ascendant',
    relatedTerms: ['天顶MC', '太阳星座', '月亮星座'],
  },
  {
    term: '天顶',
    category: '占星',
    pinyin: 'tiān dǐng',
    shortDesc: '本命盘最高点（第十宫宫头），代表社会成就、事业抱负与人生巅峰。',
    fullDesc:
      '天顶（Midheaven / Medium Coeli）为出生时刻太阳运动的最高点，象征社会地位、职业成就、公众形象、荣誉追求与人生终极目标。',
    classicSource:
      '现代西方占星职业指南：“天顶所在星座与落入第十宫的星体，揭示了你注定要攀登的人生高峰。”',
    anchorId: 'glossary-midheaven',
    relatedTerms: ['上升点ASC', '第十宫', '职业成就'],
  },
  {
    term: '八宅游年',
    category: '风水',
    pinyin: 'bā zhái yóu nián',
    shortDesc: '八宅风水核心方位理论，分为四吉方（生气、延年、天医、伏位）与四凶方。',
    fullDesc:
      '根据后天八卦与大游年歌诀，将八方划分为四吉（生气大吉、延年中吉、天医次吉、伏位小吉）与四凶（绝命大凶、五鬼次凶、六煞中凶、祸害小凶）。东四命宜居东四宅，西四命宜居西四宅。',
    classicSource: '《八宅明镜》：“乾坤艮兑西四宅，坎离震巽东四家。命宅相合，富贵延绵。”',
    anchorId: 'glossary-ba-zhai-you-nian',
    relatedTerms: ['本命卦', '生气', '延年', '天医', '伏位'],
  },
];
