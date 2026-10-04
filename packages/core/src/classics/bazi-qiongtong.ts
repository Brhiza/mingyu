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
  // 出处：三春乙木·三月。
  '乙+辰': {
    dayMaster: '乙',
    monthBranch: '辰',
    seasonSummary: '三月阳气愈炽，先癸水，后丙火。',
    primaryGods: ['癸', '丙'],
    classicVerse: '三月乙木，阳气愈炽，先癸后丙。',
    modernExplanation: '癸水先滋乙木，丙火次之；水局等原局条件另依本月条文核对。',
    taboos: [],
  },
  // 出处：三夏乙木·四月。
  '乙+巳': {
    dayMaster: '乙',
    monthBranch: '巳',
    seasonSummary: '四月自有丙火，专用癸水，丙火酌用。',
    primaryGods: ['癸', '丙', '辛', '庚'],
    classicVerse:
      '四月乙木，自有丙火，耑取癸水为尊。四月乙木专用癸水，丙火酌用，虽以庚辛佐癸，须辛透为清。',
    modernExplanation: '癸水为主，丙火酌用；庚辛佐癸须辨透藏，原文以辛透为清。',
    taboos: ['土多困癸'],
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
  // 出处：三夏乙木·六月及五六月合论。
  '乙+未': {
    dayMaster: '乙',
    monthBranch: '未',
    seasonSummary: '六月乙木，金水偏多时丙火为尊；五六月合论癸水滋养。',
    primaryGods: ['癸', '丙', '甲'],
    classicVerse:
      '六月乙木，木性且寒，柱多金水，丙火为尊。支成水局，乙得无伤。癸水透干，大富大贵。无癸定作常人，运不行北，困苦一生。凡五六月乙木，气退枯焦，用癸水切忌戊己杂乱，则为下格。',
    modernExplanation: '五六月合论取癸滋木；六月金水多时丙为先，土杂困癸时原文另取甲制土。',
    taboos: ['戊己杂乱'],
  },
  // 出处：三秋乙木·七月及三秋总论。
  '乙+申': {
    dayMaster: '乙',
    monthBranch: '申',
    seasonSummary: '三秋先丙后癸；七月庚金乘令，又强调己土。',
    primaryGods: ['丙', '癸', '己'],
    classicVerse: '七月喜己土为用，或不见丙癸。己土必不可少，此则以火为妻，土为子。',
    modernExplanation: '三秋总论先丙后癸；七月原文另强调己土，仍须按庚金与丙癸情况分支取用。',
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
  // 出处：三秋乙木·九月。
  '乙+戌': {
    dayMaster: '乙',
    monthBranch: '戌',
    seasonSummary: '九月根枯叶落，专用癸水，辛金发源。',
    primaryGods: ['癸', '辛'],
    classicVerse: '九月乙木，根枯叶落，必赖癸水滋养。',
    modernExplanation: '癸水滋养为主；癸水与辛金并见时，原文另取辛金发水源。',
    taboos: [],
  },
  // 出处：三冬乙木·十月。
  '乙+亥': {
    dayMaster: '乙',
    monthBranch: '亥',
    seasonSummary: '十月壬水司令，丙火为用，戊土次之。',
    primaryGods: ['丙', '戊'],
    classicVerse: '十月乙木，木不受气，而壬水司令，取丙为用，戊土次之。',
    modernExplanation: '丙火解寒为主，戊土制旺水为次；木局另有条件分支。',
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
  // 出处：三冬乙木·冬月之木通论（十二月），无十二月单列条文。
  '乙+丑': {
    dayMaster: '乙',
    monthBranch: '丑',
    seasonSummary: '冬月乙木寒冻，专取丙火。',
    primaryGods: ['丙'],
    classicVerse: '冬月之木，虽取戊制水，不可作用，耑取丙火则可。',
    modernExplanation: '冬月乙木专取丙火解冻；水旺取戊制水只属条件处置。',
    taboos: [],
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
  // 出处：三春丙火·二月。
  '丙+卯': {
    dayMaster: '丙',
    monthBranch: '卯',
    seasonSummary: '二月阳气舒升，专用壬水。',
    primaryGods: ['壬'],
    classicVerse: '二月丙火，阳气舒升，耑用壬水。',
    modernExplanation: '壬水为本月主用；无壬时原文另以己土姑用，不等同壬水正用。',
    taboos: [],
  },
  // 出处：三春丙火·三月。
  '丙+辰': {
    dayMaster: '丙',
    monthBranch: '辰',
    seasonSummary: '三月气渐炎升，以壬水为主；成土局时取甲木为辅。',
    primaryGods: ['壬', '甲'],
    classicVerse: '三月丙火，气渐炎升，用壬水。或成土局，取甲为辅，壬不可离。',
    modernExplanation: '壬水为本月主用；支成土局才取甲木为辅，庚金助壬另有条件。',
    taboos: [],
  },
  // 出处：三夏丙火·四月。
  '丙+巳': {
    dayMaster: '丙',
    monthBranch: '巳',
    seasonSummary: '四月火势炎炎，专用壬水，庚金发水源。',
    primaryGods: ['壬', '庚'],
    classicVerse:
      '四月丙火，建禄于巳，火势炎炎，宜专用壬水，解炎威之力，成既济之功。如无壬水，孤阳失辅，难透清光。得庚发水源，方为有根之水。',
    modernExplanation: '壬水为主用，庚金助其有源；无壬时原文另以癸水姑用。',
    taboos: [],
  },
  // 出处：三夏丙火·五月。
  '丙+午': {
    dayMaster: '丙',
    monthBranch: '午',
    seasonSummary: '五月火炎，原文专用壬水。',
    primaryGods: ['壬'],
    classicVerse: '五月亦耑用壬。',
    modernExplanation:
      '本月专用壬水；庚金可发水源，原文亦有无庚而壬透的分支；炎上格须按其条件另论。',
    taboos: [],
  },
  // 出处：三夏丙火·六月。
  '丙+未': {
    dayMaster: '丙',
    monthBranch: '未',
    seasonSummary: '六月丙火退气，以壬水为用，庚金辅佐。',
    primaryGods: ['壬', '庚'],
    classicVerse: '六月丙火退气，三伏生寒，壬水为用，取庚辅佐。',
    modernExplanation: '壬水为本月主用，庚金为辅；原文另列无庚有壬、不见戊出的分支。',
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
  // 出处：三秋丙火·八月。
  '丙+酉': {
    dayMaster: '丙',
    monthBranch: '酉',
    seasonSummary: '八月日近黄昏，仍用壬水辅映。',
    primaryGods: ['壬', '癸'],
    classicVerse:
      '八月丙火，日近黄昏，丙火之余光，存于光湖，仍用壬水辅映。四柱多丙，一壬高透为奇，定主登科及第。富贵双全。一壬藏支，亦主秀才。或戊多困水则假作斯文。若无壬水，癸亦可用，但功名不久。',
    modernExplanation: '壬水为本月主用；无壬时癸水才是原文另列的替用。',
    taboos: ['戊多困水'],
  },
  // 出处：三秋丙火·九月。
  '丙+戌': {
    dayMaster: '丙',
    monthBranch: '戌',
    seasonSummary: '九月火气愈退，先甲木、次壬水。',
    primaryGods: ['甲', '壬', '癸'],
    classicVerse:
      '九月丙火，火气愈退，所忌土晦光火，必须先用甲木，次取壬水。甲壬两透，富贵非凡。若无壬水，得癸透干，亦可，虽不科甲，异路功名。',
    modernExplanation: '甲木先用、壬水次取；无壬且癸透干时，原文才以癸替用。',
    taboos: ['土晦光火'],
  },
  // 出处：三冬丙火·十月。
  '丙+亥': {
    dayMaster: '丙',
    monthBranch: '亥',
    seasonSummary: '十月太阳失令，随木、水、火偏旺的情况分支取用。',
    primaryGods: ['庚', '戊', '壬'],
    classicVerse: '总之十月丙火，木旺宜庚，水旺宜戊，火旺用壬，随宜酌用可也。',
    modernExplanation:
      '木旺时宜庚，水旺时宜戊，火旺时用壬；这是随原局分别取用的条件，不能将三者并作通用组合。',
    taboos: [],
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
  // 出处：三冬丙火·十二月。
  '丙+丑': {
    dayMaster: '丙',
    monthBranch: '丑',
    seasonSummary: '十二月气进二阳，以壬水为用；土多时还需甲木。',
    primaryGods: ['壬', '甲'],
    classicVerse:
      '十二月丙火，气进二阳，侮雪欺霜，喜壬为用。己土司令，土多又不可少甲。壬甲两透，科甲堪宜，甲藏则秀才而已。或无甲得一壬透，富中取贵。',
    modernExplanation: '壬水为本月主用；己土司令而土多时才需甲木，原文亦有无甲而壬透的分支。',
    taboos: [],
  },

  // 丁火
  // 出处：三春丁火·正月。
  '丁+寅': {
    dayMaster: '丁',
    monthBranch: '寅',
    seasonSummary: '正月甲木当权，姑用庚金劈甲引丁。',
    primaryGods: ['庚'],
    classicVerse: '正月丁火，甲木当权，乃为母旺，非庚不能噼甲，何以引丁，姑用庚金。',
    modernExplanation: '甲木当权而偏旺，原文用庚金劈甲以引丁，并非再以甲为通用增补。',
    taboos: [],
  },
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
  // 出处：三春丁火·三月。
  '丁+辰': {
    dayMaster: '丁',
    monthBranch: '辰',
    seasonSummary: '三月戊土司令，先甲木制土引丁，次看庚金。',
    primaryGods: ['甲', '庚'],
    classicVerse: '三月丁火，戊土司令，洩弱丁气，先用甲木引丁制土，次看庚金。',
    modernExplanation: '甲木为先、庚金为次；若支成木局，原文另改取庚为先。',
    taboos: [],
  },
  // 出处：三夏丁火·四月。
  '丁+巳': {
    dayMaster: '丁',
    monthBranch: '巳',
    seasonSummary: '四月丁火乘旺，取甲引丁，以庚劈甲。',
    primaryGods: ['甲', '庚', '戊'],
    classicVerse:
      '四月丁火乘旺，虽取甲引丁，必用庚噼甲。伐甲、方云木火通明。甲多、又取庚为先。但四柱忌见癸水。',
    modernExplanation: '甲木引丁、庚金劈甲；甲多时庚为先，无甲而庚、戊透时原文另取戊。',
    taboos: ['癸水'],
  },
  // 出处：三夏丁火·五月。
  '丁+午': {
    dayMaster: '丁',
    monthBranch: '午',
    seasonSummary: '五月丁火建禄，取用随火局与透水条件而变。',
    primaryGods: [],
    classicVerse:
      '五月丁火，时归建禄，不宜乱用甲木。\n若干支无火局，有水透干，须用甲木，又要庚噼甲方明。',
    modernExplanation:
      '支成火局且火透时，原文论庚壬两透；干支无火局而水透时，另用甲木并取庚劈甲；癸透亦另有分支。',
    taboos: ['乱用甲木'],
  },
  // 出处：三夏丁火·六月。
  '丁+未': {
    dayMaster: '丁',
    monthBranch: '未',
    seasonSummary: '六月丁火退气，专取甲木，壬水次之。',
    primaryGods: ['甲', '壬'],
    classicVerse: '六月之丁，阴柔退气，但值三伏生寒，丁弱极矣，专取甲木，壬水次之。',
    modernExplanation: '甲木为本月主用、壬水次之；庚金的作用另依原局配合核对。',
    taboos: [],
  },
  // 出处：三秋丁火·七月。
  '丁+申': {
    dayMaster: '丁',
    monthBranch: '申',
    seasonSummary: '七月丁火退气，专用甲木，庚金劈甲，丙火可借。',
    primaryGods: ['甲', '庚', '丙'],
    classicVerse:
      '七月丁火，退气柔弱，端用甲木，金虽乘旺司权，无伤丁之理，仍取庚劈甲，为引火之物，或借丙暖金晒甲，不虑丙夺丁光，凡两丙夹丁者，夏月忌之，余月不忌，但此格少年困苦刑克中年富贵，必要地支见水制丙，方妙。',
    modernExplanation: '甲木为主，庚金劈甲引丁；原文仅将丙火列作可借的暖金晒甲之助。',
    taboos: [],
  },
  // 出处：三秋丁火·八月。
  '丁+酉': {
    dayMaster: '丁',
    monthBranch: '酉',
    seasonSummary: '三秋丁火退气，甲木为主、庚金劈甲。',
    primaryGods: ['甲', '庚', '丙'],
    classicVerse: '八月甲丙庚皆用，七八月或无甲木，乙亦可用',
    modernExplanation: '甲木引丁，庚金劈甲；丙火可暖金晒木。',
    taboos: [],
  },
  // 出处：三秋丁火·九月。
  '丁+戌': {
    dayMaster: '丁',
    monthBranch: '戌',
    seasonSummary: '九月专用甲木、庚金。',
    primaryGods: ['甲', '庚'],
    classicVerse: '九月耑用甲庚。',
    modernExplanation: '甲木引丁，庚金劈甲；一派戊土时，原文另按甲木透出与否分别论述。',
    taboos: [],
  },
  // 出处：三冬丁火·三冬总论（十月）。
  '丁+亥': {
    dayMaster: '丁',
    monthBranch: '亥',
    seasonSummary: '三冬丁火微寒，甲木为尊、庚金佐之。',
    primaryGods: ['甲', '庚'],
    classicVerse: '三冬丁火，甲木为尊，庚金佐之，癸戊权宜酌用可也。',
    modernExplanation: '此为适用于亥月的三冬总论：甲木引丁、庚金佐之，癸戊仍须随原局酌用。',
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
  // 出处：三冬丁火·三冬总论（十二月）。
  '丁+丑': {
    dayMaster: '丁',
    monthBranch: '丑',
    seasonSummary: '三冬丁火微寒，甲木为尊、庚金佐之。',
    primaryGods: ['甲', '庚'],
    classicVerse: '三冬丁火，甲木为尊，庚金佐之，癸戊权宜酌用可也。',
    modernExplanation: '此为适用于丑月的三冬总论：甲木引丁、庚金佐之，癸戊仍须随原局酌用。',
    taboos: [],
  },

  // 戊土
  // 出处：三春戊土·正二月合论（正月）。
  '戊+寅': {
    dayMaster: '戊',
    monthBranch: '寅',
    seasonSummary: '正二月戊土，先丙火照暖，后甲木疏土，癸水再次。',
    primaryGods: ['丙', '甲', '癸'],
    classicVerse: '正二月先丙后甲，癸又次之。',
    modernExplanation: '原文合论正二月：丙火先除寒，甲木疏土，癸水滋润为次。',
    taboos: [],
  },
  // 出处：三春戊土·正二月合论（二月）。
  '戊+卯': {
    dayMaster: '戊',
    monthBranch: '卯',
    seasonSummary: '正二月戊土，先丙火照暖，后甲木疏土，癸水再次。',
    primaryGods: ['丙', '甲', '癸'],
    classicVerse: '正二月先丙后甲，癸又次之。',
    modernExplanation: '原文合论正二月：丙火先除寒，甲木疏土，癸水滋润为次。',
    taboos: [],
  },
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
  // 出处：三夏戊土·四月。
  '戊+巳': {
    dayMaster: '戊',
    monthBranch: '巳',
    seasonSummary: '四月戊土外实内虚，先甲木疏劈，丙癸为佐。',
    primaryGods: ['甲', '丙', '癸'],
    classicVerse:
      '四月戊土，阳气发升，寒气内藏，外实内虚，不畏火炎，无阳气相催，万物不长，故先用甲疏噼，次取丙癸为佐。',
    modernExplanation: '甲木为先，丙火与癸水为辅；原文按丙火偏多等局另有分支。',
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
  // 出处：三夏戊土·六月。
  '戊+未': {
    dayMaster: '戊',
    monthBranch: '未',
    seasonSummary: '六月夏土干枯，先癸水，次丙火、甲木。',
    primaryGods: ['癸', '丙', '甲'],
    classicVerse: '六月戊土，遇夏干枯，先看癸水，次用丙火甲木。',
    modernExplanation: '癸水为先，丙火与甲木次之；原文另按有癸无丙等组合分支论述。',
    taboos: [],
  },
  // 出处：三秋戊土·七月。
  '戊+申': {
    dayMaster: '戊',
    monthBranch: '申',
    seasonSummary: '七月阳气渐入、寒气渐出，先丙后癸，甲木次之。',
    primaryGods: ['丙', '癸', '甲'],
    classicVerse: '七月戊土，阳气渐入，寒气渐出，先丙后癸，甲木次之。',
    modernExplanation: '丙火照暖为先，癸水滋润为次，甲木再次；支成水局时原文另取甲泄水。',
    taboos: [],
  },
  // 出处：三秋戊土·八月。
  '戊+酉': {
    dayMaster: '戊',
    monthBranch: '酉',
    seasonSummary: '八月金泄身寒，先丙火照暖，后癸水滋润。',
    primaryGods: ['丙', '癸'],
    classicVerse: '八月戊土，金洩身寒，赖丙照暖，喜水滋润，先丙后癸，不必木疏。',
    modernExplanation: '丙火为先、癸水为次；原文明说本月不必再以木疏土。',
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
  // 出处：三冬戊土·十月。
  '戊+亥': {
    dayMaster: '戊',
    monthBranch: '亥',
    seasonSummary: '十月阳气略出，先甲木，次丙火。',
    primaryGods: ['甲', '丙'],
    classicVerse: '十月戊土，时值小阳，阳气略出，先用甲木，次取丙火。',
    modernExplanation: '甲木疏土为先，丙火照暖为次；两者配合仍需核对原局。',
    taboos: [],
  },
  // 出处：三冬戊土·十一二月合论（十一月）。
  '戊+子': {
    dayMaster: '戊',
    monthBranch: '子',
    seasonSummary: '十一月严寒冰冻，丙火为专、甲木为佐。',
    primaryGods: ['丙', '甲'],
    classicVerse: '十一二月严寒冰冻，丙火为专，甲木为佐。',
    modernExplanation: '丙火解冻，甲木疏土以助生发。',
    taboos: [],
  },
  // 出处：三冬戊土·十一二月合论（十二月）。
  '戊+丑': {
    dayMaster: '戊',
    monthBranch: '丑',
    seasonSummary: '十一二月严寒冰冻，丙火为专、甲木为佐。',
    primaryGods: ['丙', '甲'],
    classicVerse: '十一二月严寒冰冻，丙火为专，甲木为佐。',
    modernExplanation: '原文合论十一、十二月：丙火解冻为主，甲木疏土为佐。',
    taboos: [],
  },

  // 己土
  // 出处：三春己土·正月。
  '己+寅': {
    dayMaster: '己',
    monthBranch: '寅',
    seasonSummary: '正月田园犹冻，以丙火照暖为尊。',
    primaryGods: ['丙', '戊'],
    classicVerse: '正月己土，田园犹冻，盖因腊气未除，余寒未退，故丙为尊。',
    modernExplanation: '丙火为本月主用；壬水偏多时，原文另取戊土为堤。',
    taboos: ['壬水泛滥'],
  },
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
  // 出处：三春己土·三月。
  '己+辰': {
    dayMaster: '己',
    monthBranch: '辰',
    seasonSummary: '三月栽培禾稼，先丙后癸，随用甲疏。',
    primaryGods: ['丙', '癸', '甲'],
    classicVerse:
      '三月己土，正栽培禾稼之时，先丙后癸，土暖而润，随用甲疏，三者俱透天干，必官居黄阁。',
    modernExplanation: '丙火照暖为先，癸水润土为次，甲木按原局疏土。',
    taboos: ['庚金'],
  },
  // 出处：三夏己土·三夏总论（四月）。
  '己+巳': {
    dayMaster: '己',
    monthBranch: '巳',
    seasonSummary: '三夏禾稼喜甘沛，癸水为要，丙火次之。',
    primaryGods: ['癸', '丙'],
    classicVerse: '三夏己土，杂气才官，禾稼在田，最喜甘沛，取癸为要，次用丙火。',
    modernExplanation: '三夏总论适用于巳月：癸水润土为要，丙火次之；无癸有壬另论。',
    taboos: ['戊癸化合'],
  },
  // 出处：三夏己土·三夏总论（五月）。
  '己+午': {
    dayMaster: '己',
    monthBranch: '午',
    seasonSummary: '三夏禾稼喜甘沛，癸水为要，丙火次之。',
    primaryGods: ['癸', '丙'],
    classicVerse: '三夏己土，杂气才官，禾稼在田，最喜甘沛，取癸为要，次用丙火。',
    modernExplanation: '三夏总论适用于午月：癸水润土为要，丙火次之；无癸有壬另论。',
    taboos: ['戊癸化合'],
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
  // 出处：三秋己土·三秋总论（七月）。
  '己+申': {
    dayMaster: '己',
    monthBranch: '申',
    seasonSummary: '三秋己土外虚内实，癸先丙后，辛金辅癸。',
    primaryGods: ['癸', '丙', '辛'],
    classicVerse: '总之，三秋己土，先癸后丙，取辛辅癸。',
    modernExplanation: '三秋总论适用于申月：癸水先、丙火后，辛金辅癸。',
    taboos: [],
  },
  // 出处：三秋己土·三秋总论（八月）。
  '己+酉': {
    dayMaster: '己',
    monthBranch: '酉',
    seasonSummary: '三秋己土外虚内实，癸先丙后，辛金辅癸。',
    primaryGods: ['癸', '丙', '辛'],
    classicVerse: '总之，三秋己土，先癸后丙，取辛辅癸。',
    modernExplanation: '三秋总论适用于酉月：癸水先、丙火后，辛金辅癸。',
    taboos: [],
  },
  // 出处：三秋己土·三秋总论（九月）。
  '己+戌': {
    dayMaster: '己',
    monthBranch: '戌',
    seasonSummary: '三秋癸先丙后，九月土盛时另宜甲木疏土。',
    primaryGods: ['癸', '丙', '辛', '甲'],
    classicVerse: '总之，三秋己土，先癸后丙，取辛辅癸。九月土盛，宜甲木疏之，余皆酌用。',
    modernExplanation: '九月仍取三秋癸先丙后、辛辅癸；土盛时另以甲木疏土。',
    taboos: [],
  },
  // 出处：三冬己土·三冬总论及初冬分支（十月）。
  '己+亥': {
    dayMaster: '己',
    monthBranch: '亥',
    seasonSummary: '初冬湿泥寒冻，丙火为尊，甲木参酌。',
    primaryGods: ['丙', '甲', '戊'],
    classicVerse:
      '三冬己土，溼泥寒冻，非丙暖不生，取丙为尊，甲木参酌。戊土癸水不用。惟初冬壬旺，取戊制之。',
    modernExplanation: '三冬总论适用于亥月：丙火为尊、甲木参酌；只有初冬壬旺时取戊制水。',
    taboos: [],
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
  // 出处：三冬己土·三冬总论（十二月）。
  '己+丑': {
    dayMaster: '己',
    monthBranch: '丑',
    seasonSummary: '三冬湿泥寒冻，丙火为尊，甲木参酌。',
    primaryGods: ['丙', '甲'],
    classicVerse: '三冬己土，溼泥寒冻，非丙暖不生，取丙为尊，甲木参酌。',
    modernExplanation: '三冬总论适用于丑月：丙火解冻为尊，甲木随原局参酌。',
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
  // 出处：三春庚金·二月。
  '庚+卯': {
    dayMaster: '庚',
    monthBranch: '卯',
    seasonSummary: '二月乙木当令，专用丁火，甲木引丁。',
    primaryGods: ['丁', '甲', '丙'],
    classicVerse:
      '二月庚金，柱中自然有乙，当令之乙，见庚必输情于乙，此金有暗强之势，如秋金一理，故二月庚金，专用丁火，借甲引丁，借庚噼甲。无丁用丙者，富贵多出于勉强。',
    modernExplanation: '丁火为本月主用，甲木引丁；无丁时原文才另用丙火。',
    taboos: [],
  },
  // 出处：三春庚金·三月。
  '庚+辰': {
    dayMaster: '庚',
    monthBranch: '辰',
    seasonSummary: '三月戊土司令，先甲木疏土，后丁火炼庚。',
    primaryGods: ['甲', '丁'],
    classicVerse: '三月庚金，戊土司令，无生金之理，有埋金之忧，故先甲后丁，不用庚噼甲。',
    modernExplanation: '甲木先疏旺土，丁火再炼庚；原文明说本月不用庚劈甲。',
    taboos: ['戊土埋金'],
  },
  // 出处：三夏庚金·四月。
  '庚+巳': {
    dayMaster: '庚',
    monthBranch: '巳',
    seasonSummary: '四月庚金长生，先壬水调和，再戊土、丙火相佐。',
    primaryGods: ['壬', '戊', '丙'],
    classicVerse:
      '四月庚金，长生于巳，巳内有戊。丙不镕金，故不畏火炎，丙亦可作用，但先壬水，方得中和，故曰群金生夏，喜用勾陈。次取戊土，丙火佐之。',
    modernExplanation: '壬水为先，戊土次之，丙火为佐；原文又说须按原局病药，不拘死板先后。',
    taboos: [],
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
  // 出处：三夏庚金·六月。
  '庚+未': {
    dayMaster: '庚',
    monthBranch: '未',
    seasonSummary: '六月三伏生寒，先丁火、次甲木；土局改甲先。',
    primaryGods: ['丁', '甲'],
    classicVerse: '六月庚金，三伏生寒，顽钝极矣，先用丁火，次取甲木。',
    modernExplanation: '通常丁先甲后；若支会土局，原文改为甲先丁后。',
    taboos: ['癸水伤丁'],
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
  // 出处：三秋庚金·八月。
  '庚+酉': {
    dayMaster: '庚',
    monthBranch: '酉',
    seasonSummary: '八月庚金刚锐未退，丁甲并用，丙火亦不可少。',
    primaryGods: ['丁', '甲', '丙'],
    classicVerse: '八月庚金，刚锐未退，用丁用甲，丙不可少。',
    modernExplanation: '丁火炼庚、甲木引丁，丙火为原文明确要求的配合。',
    taboos: [],
  },
  // 出处：三秋庚金·九月。
  '庚+戌': {
    dayMaster: '庚',
    monthBranch: '戌',
    seasonSummary: '九月戊土司令，先甲木疏土，后壬水洗金。',
    primaryGods: ['甲', '壬'],
    classicVerse: '九月庚金，戊土司令，最怕土厚埋金，宜先用甲疏，后用壬洗，则金自出矣。',
    modernExplanation: '甲木先疏厚土，壬水随后洗金；己土浊壬为原文所忌。',
    taboos: ['己土浊壬'],
  },
  // 出处：三冬庚金·十月。
  '庚+亥': {
    dayMaster: '庚',
    monthBranch: '亥',
    seasonSummary: '十月水冷金寒，丁火炼金、丙火照暖。',
    primaryGods: ['丁', '丙', '甲'],
    classicVerse: '十月庚金，水冷性寒，非丁莫造，非丙不暖。',
    modernExplanation: '丁火炼庚、丙火温金；丁甲两透且无水局是原文另列的组合条件。',
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
  // 出处：三冬庚金·十二月。
  '庚+丑': {
    dayMaster: '庚',
    monthBranch: '丑',
    seasonSummary: '十二月寒湿，先丙解冻、次丁炼金，甲亦不可少。',
    primaryGods: ['丙', '丁', '甲'],
    classicVerse:
      '十二月庚金，寒气太重，且多湿泥，愈寒愈冻，先取丙火解冻，次取丁火炼金，甲亦不可少。',
    modernExplanation: '丙火先解冻，丁火次炼庚，甲木引火也列在本月条文中。',
    taboos: [],
  },

  // 辛金
  // 出处：三春辛金·正月。
  '辛+寅': {
    dayMaster: '辛',
    monthBranch: '寅',
    seasonSummary: '正月寒气未除，先己土生辛，后壬水淘洗。',
    primaryGods: ['己', '壬', '庚', '丙'],
    classicVerse: '故正月辛金，先己后壬。己为君，庚为佐。如用丙火须参看。',
    modernExplanation: '己土为先、壬水为次；庚金为佐，丙火另依原局参看。',
    taboos: [],
  },
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
  // 出处：三春辛金·三月。
  '辛+辰': {
    dayMaster: '辛',
    monthBranch: '辰',
    seasonSummary: '三月戊土司令，先壬水泄旺金，后甲木疏土。',
    primaryGods: ['壬', '甲'],
    classicVerse: '三月辛金，戊土司令，辛承正气，母旺子相，先壬后甲。',
    modernExplanation: '壬水为先、甲木为次；甲木兼制过旺之土。',
    taboos: ['戊土埋金'],
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
  // 出处：三夏辛金·五月。
  '辛+午': {
    dayMaster: '辛',
    monthBranch: '午',
    seasonSummary: '五月丁火司权，己土、壬水兼用。',
    primaryGods: ['己', '壬', '癸'],
    classicVerse:
      '五月辛金，丁火司权，辛金失令，阴柔之极，不宜煅炼，须己壬兼用，何也？己为泥沙，壬为湖海，己无壬不湿，辛无己不生，故壬己并用。无壬、癸亦可用。但癸力小。',
    modernExplanation: '己土与壬水并用；无壬时癸水才是原文列出的替用。',
    taboos: [],
  },
  // 出处：三夏辛金·六月。
  '辛+未': {
    dayMaster: '辛',
    monthBranch: '未',
    seasonSummary: '六月己土当权，先壬水，庚金为佐。',
    primaryGods: ['壬', '庚', '甲'],
    classicVerse: '六月辛金，己土当权，辅助太多，恐掩金光，先用壬水，取庚佐之。',
    modernExplanation: '壬水为先、庚金为佐；戊土出干时另以甲木制戊，甲还须避开与己合。',
    taboos: ['戊土困壬'],
  },
  // 出处：三秋辛金·七月。
  '辛+申': {
    dayMaster: '辛',
    monthBranch: '申',
    seasonSummary: '七月庚金司令，壬水为尊，甲戊酌用。',
    primaryGods: ['壬', '甲', '戊'],
    classicVerse:
      '七月辛金，壬不在多，故书云：水浅金多，号曰体全之象，壬水为尊，甲戊酌用可也，癸水不可为用。',
    modernExplanation: '壬水为本月主用；甲木、戊土依金水与土的实际情况酌用，原文排除癸水。',
    taboos: ['癸水不可为用'],
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
  // 出处：三秋辛金·九月。
  '辛+戌': {
    dayMaster: '辛',
    monthBranch: '戌',
    seasonSummary: '九月戊土司令，先壬水，后甲木。',
    primaryGods: ['壬', '甲'],
    classicVerse: '九月辛金，戊土司令，母旺子相，须甲疏土，壬洩旺金，先壬后甲。',
    modernExplanation: '壬水泄旺金为先，甲木疏戊土为次。',
    taboos: ['火土为病'],
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
  // 出处：三冬辛金·十一月。
  '辛+子': {
    dayMaster: '辛',
    monthBranch: '子',
    seasonSummary: '十一月癸水司令，壬丙配合且忌癸出冻金。',
    primaryGods: ['壬', '丙', '戊'],
    classicVerse:
      '十一月辛金，癸水司令，为寒冬雨露，切忌癸出冻金，而困丙火，壬丙两透，不见戊癸，衣锦腰金。',
    modernExplanation: '壬丙配合须不见戊癸；壬多时另有戊与丙甲出干的分支，戊并非通用。',
    taboos: ['癸水冻金'],
  },
  // 出处：三冬辛金·十二月。
  '辛+丑': {
    dayMaster: '辛',
    monthBranch: '丑',
    seasonSummary: '十二月寒冻，先丙火解冻，后壬水洗淘。',
    primaryGods: ['丙', '壬', '戊', '己'],
    classicVerse: '十二月辛金，寒冻之极，先丙后壬，无丙不能解冻，无壬不能洗淘。',
    modernExplanation: '丙火先解冻、壬水后洗金；戊己仅在原文条件下次第参用。',
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
  // 出处：三春壬水·二月。
  '壬+卯': {
    dayMaster: '壬',
    monthBranch: '卯',
    seasonSummary: '二月寒气初除，先戊土，后辛金，庚金再次。',
    primaryGods: ['戊', '辛', '庚'],
    classicVerse: '二月壬水，先戊后辛，庚金次之。',
    modernExplanation: '戊土为先、辛金为次，庚金再次；本月原文明说不用丙火照暖。',
    taboos: [],
  },
  // 出处：三春壬水·三月。
  '壬+辰': {
    dayMaster: '壬',
    monthBranch: '辰',
    seasonSummary: '三月戊土司权，先甲木疏土，后庚金发源。',
    primaryGods: ['甲', '庚'],
    classicVerse: '三月壬水，戊土司权，恐有推山填海之患，先用甲疏季土，次取庚金。',
    modernExplanation: '甲木先疏旺土，庚金随后发壬水之源。',
    taboos: ['戊土壅水'],
  },
  // 出处：三夏壬水·四月。
  '壬+巳': {
    dayMaster: '壬',
    monthBranch: '巳',
    seasonSummary: '四月丙火司权，壬水比肩为助，辛金发源，庚金为佐。',
    primaryGods: ['壬', '辛', '庚'],
    classicVerse:
      '四月壬水，丙火司权，水弱极矣，专取壬水比肩为助，次取辛金发源，且暗合丙火，庚金为佐。',
    modernExplanation: '先取壬水比肩，次取辛金发源，庚金为佐；多金得地时原文另论戊土。',
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
  // 出处：三夏壬水·六月。
  '壬+未': {
    dayMaster: '壬',
    monthBranch: '未',
    seasonSummary: '六月己土当权，辛金为先，甲木疏土，癸水参用。',
    primaryGods: ['辛', '甲', '癸'],
    classicVerse: '六月壬水，先辛后甲，次取癸水。',
    modernExplanation: '辛金为先，甲木劈土，癸水参用；土火重与木局时另按原文分支。',
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
  // 出处：三秋壬水·八月。
  '壬+酉': {
    dayMaster: '壬',
    monthBranch: '酉',
    seasonSummary: '八月辛金司权，专用甲木制戊；无甲时另用金。',
    primaryGods: ['甲', '庚'],
    classicVerse: '八月壬水，专用甲木，庚金次之。',
    modernExplanation: '有戊病时专取甲木制土；无甲才按原文另用金，庚若破甲反成其病。',
    taboos: ['庚金破甲'],
  },
  // 出处：三秋壬水·九月。
  '壬+戌': {
    dayMaster: '壬',
    monthBranch: '戌',
    seasonSummary: '九月壬水进气，甲木为主，丙火次之。',
    primaryGods: ['甲', '丙'],
    classicVerse: '九月壬水，专用甲木，次用丙火。',
    modernExplanation: '甲木为本月主用；一派壬水而戊土出干等条件下，原文再论丙火。',
    taboos: [],
  },
  // 出处：三冬壬水·十月。
  '壬+亥': {
    dayMaster: '壬',
    monthBranch: '亥',
    seasonSummary: '十月壬水司权，戊丙并取，庚金再次。',
    primaryGods: ['戊', '丙', '庚'],
    classicVerse: '十月壬水、专用戊丙，次取庚金。',
    modernExplanation: '戊土制旺水、丙火照暖，庚金按原局佐戊；甲木制戊时须另核对庚的救应。',
    taboos: ['甲木制戊无庚救'],
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
  // 出处：三冬壬水·十二月。
  '壬+丑': {
    dayMaster: '壬',
    monthBranch: '丑',
    seasonSummary: '十二月壬水上半月旺、下半月衰，丙火为先。',
    primaryGods: ['丙', '丁', '甲'],
    classicVerse: '腊月壬水，先取丙火，丁甲为佐，故水冷金寒爱丙丁。',
    modernExplanation: '上半月癸辛主事、下半月己土主事，原文两段均用丙火，丁甲为佐。',
    taboos: [],
  },

  // 癸水
  // 出处：三春癸水·正月。
  '癸+寅': {
    dayMaster: '癸',
    monthBranch: '寅',
    seasonSummary: '正月癸水柔弱，辛金为主，庚金次之，丙火照暖。',
    primaryGods: ['辛', '庚', '丙'],
    classicVerse: '正月癸水，辛金为主，庚金次之，丙亦不可少。',
    modernExplanation: '辛金发源为主，庚金次之；丙火照暖是本月另需的配合。',
    taboos: [],
  },
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
  // 出处：三春癸水·三月。
  '癸+辰': {
    dayMaster: '癸',
    monthBranch: '辰',
    seasonSummary: '三月须分清明后与谷雨后，丙火主用，后段辛甲佐之。',
    primaryGods: ['丙', '辛', '甲'],
    classicVerse:
      '三月癸水，要分清明谷雨。清明后、火气未炽，专用丙火，为阴阳合谐。谷雨后，虽用丙火，尚宜辛甲佐之。',
    modernExplanation: '清明后先取丙火；谷雨后仍用丙，另以辛金、甲木相佐。',
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
  // 出处：三夏癸水·五月。
  '癸+午': {
    dayMaster: '癸',
    monthBranch: '午',
    seasonSummary: '五月癸水至弱，庚辛发源，壬水与比劫参酌。',
    primaryGods: ['庚', '辛', '壬'],
    classicVerse: '五月癸水，庚辛壬参酌并用可也。',
    modernExplanation: '庚辛为生水之源；火旺金弱时还需比劫，壬水按原局参酌。',
    taboos: [],
  },
  // 出处：三夏癸水·六月。
  '癸+未': {
    dayMaster: '癸',
    monthBranch: '未',
    seasonSummary: '六月癸水专用庚辛，上半月金弱另需比劫助身。',
    primaryGods: ['庚', '辛'],
    classicVerse:
      '六月癸水，有上下月之分。下半月庚辛有气，上半月庚辛休囚。凡六癸日、多不验者，何也？俗士不知此理。因未中有乙己同宫，破而不破，故癸水不能从杀，所以专用庚辛。',
    modernExplanation: '上半月庚辛衰弱时另取比劫助身；下半月庚辛有气则不必同取。',
    taboos: ['丁火伤金'],
  },
  // 出处：三秋癸水·七月。
  '癸+申': {
    dayMaster: '癸',
    monthBranch: '申',
    seasonSummary: '七月庚金司令过锐，取丁火制金。',
    primaryGods: ['丁', '甲'],
    classicVerse:
      '七月癸水，正母旺子相之时，癸虽死申，殊不知申中有庚生之，名死处逢生，弱中复强，即运行西北，亦不死也。但庚司令刚锐极矣，必取丁火为用。',
    modernExplanation: '丁火为本月主用；丁透而有甲木时，原文另论甲引丁的组合。',
    taboos: [],
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
  // 出处：三秋癸水·九月。
  '癸+戌': {
    dayMaster: '癸',
    monthBranch: '戌',
    seasonSummary: '九月戊土司权，辛金发源，甲木制戊。',
    primaryGods: ['辛', '甲'],
    classicVerse: '九月癸水，辛甲并用。',
    modernExplanation: '辛金发水源、甲木制过旺之戊土；比肩滋甲另须依原局核对。',
    taboos: ['戊土克癸'],
  },
  // 出处：三冬癸水·十月。
  '癸+亥': {
    dayMaster: '癸',
    monthBranch: '亥',
    seasonSummary: '十月亥中木泄癸水，宜庚辛金生扶。',
    primaryGods: ['庚', '辛'],
    classicVerse: '十月癸水，旺中有弱，何也？因亥摇木，洩散元神，宜用庚辛为妙。',
    modernExplanation: '庚辛金发癸水之源；原文另以丁火伤庚辛为条件核对。',
    taboos: ['丁火伤庚辛'],
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
  // 出处：三冬癸水·十二月。
  '癸+丑': {
    dayMaster: '癸',
    monthBranch: '丑',
    seasonSummary: '十二月寒极成冰，丙火解冻为先。',
    primaryGods: ['丙', '壬'],
    classicVerse: '十二月癸水，寒极成冰，万物不能舒泰，宜丙火解冻。',
    modernExplanation: '丙火为本月主用；丙透年时且支中多戊时，原文另以壬透相辅。',
    taboos: [],
  },
};

export function getBaziQiongtongAdvice(
  dayMaster: string,
  monthBranch: string,
): BaziQiongtongEntry | undefined {
  const key = `${dayMaster}+${monthBranch}`;
  return Object.hasOwn(BAZI_QIONGTONG_TABLE, key)
    ? structuredClone(BAZI_QIONGTONG_TABLE[key])
    : undefined;
}
