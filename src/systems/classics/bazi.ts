import { selectQiongtongExcerpt } from './bazi-qiongtong';
import type { ClassicExcerpt } from './types';

export type BaziDitiansuiEntry = {
  stem: string;
  wuxing: string;
  sourceBook: string;
  verse: string;
  nature: string;
  modernAdvice: string;
};

export type BaziZipingPatternEntry = {
  pattern: string;
  category: '正格' | '变格';
  sourceBook: string;
  rule: string;
  verse: string;
  modernAdvice: string;
  taboos: string[];
};

/**
 * 《滴天髓·天干论》十干体象原文短摘与释义。
 * 底本：https://zh.wikisource.org/w/index.php?title=滴天髓/02&oldid=3211656
 */
const CANONICAL_BAZI_DITIANSUI_TABLE: Record<string, BaziDitiansuiEntry> = {
  甲: {
    stem: '甲',
    wuxing: '木',
    sourceBook: '滴天髓·论天干',
    verse: '甲木参天，脱胎要火。',
    nature: '甲为阳木，原注以根干之木为象。',
    modernAdvice: '旺木得火可敷荣；春秋木气不同，金土及水火的作用须按原局配合分辨。',
  },
  乙: {
    stem: '乙',
    wuxing: '木',
    sourceBook: '滴天髓·论天干',
    verse: '乙木虽柔，刲羊解牛。',
    nature: '乙为阴木，原注以枝叶花卉为象。',
    modernAdvice: '丙丁火、甲木与寅根各有作用；虚湿寒重时须结合水火多少考察。',
  },
  丙: {
    stem: '丙',
    wuxing: '火',
    sourceBook: '滴天髓·论天干',
    verse: '丙火猛烈，欺霜侮雪。',
    nature: '丙为阳火，原注以焚烈之火为象。',
    modernAdvice: '丙火能煆庚金，逢辛合而反弱；寅午戌再见甲木，须察火燥之势。',
  },
  丁: {
    stem: '丁',
    wuxing: '火',
    sourceBook: '滴天髓·论天干',
    verse: '丁火柔中，内性昭融。',
    nature: '丁为阴火，原注以温暖而柔中的火为象。',
    modernAdvice: '乙木、壬水的配合与丁火旺衰分别考察；秋冬得甲木时可扶丁火。',
  },
  戊: {
    stem: '戊',
    wuxing: '土',
    sourceBook: '滴天髓·论天干',
    verse: '戊土固重，既中且正。',
    nature: '戊为阳土，原注以山冈厚土为象。',
    modernAdvice: '戊土喜润而忌燥；坐寅或申再逢冲时，须察根气是否动摇。',
  },
  己: {
    stem: '己',
    wuxing: '土',
    sourceBook: '滴天髓·论天干',
    verse: '己土卑湿，中正蓄藏。',
    nature: '己为阴土，原注以田园卑湿之土为象。',
    modernAdvice: '火少则难生湿土，湿土可润金；木水旺衰与己土根气、助力同看。',
  },
  庚: {
    stem: '庚',
    wuxing: '金',
    sourceBook: '滴天髓·论天干',
    verse: '庚金带煞，刚强为最。',
    nature: '庚为阳金，原文以带煞刚强为象。',
    modernAdvice: '得水而清、得火而锐；润土可生金，干土则易使庚金脆。',
  },
  辛: {
    stem: '辛',
    wuxing: '金',
    sourceBook: '滴天髓·论天干',
    verse: '辛金软弱，温润而清。',
    nature: '辛为阴金，原注以温柔清润为象，并明言非珠玉之谓。',
    modernAdvice: '厚土重叠可埋辛金，水多可显其清；热时喜己土，寒时喜丁火。',
  },
  壬: {
    stem: '壬',
    wuxing: '水',
    sourceBook: '滴天髓·论天干',
    verse: '壬水汪洋，能泄金气。',
    nature: '壬为阳水，原文以汪洋、周流不滞为象。',
    modernAdvice: '申子辰并透癸可使水势增强；合丁或从火土，须结合全局成势条件。',
  },
  癸: {
    stem: '癸',
    wuxing: '水',
    sourceBook: '滴天髓·论天干',
    verse: '癸水至弱，达于天津。',
    nature: '癸为阴水，原文以至弱而能运水气为象。',
    modernAdvice: '甲乙寅卯可运水气；癸合戊化火，须有火根方能论化。',
  },
};

/**
 * 《子平真诠》格局原文节录与释义。原文仅转为简体并调整标点。
 * 底本：《子平真诠评注》沈孝瞻原著部分，第三十一至四十五章：
 * https://www.ncc.com.tw/fate/paleo/bg/bg_034.htm
 * https://www.ncc.com.tw/fate/paleo/bg/bg_035.htm
 */
const CANONICAL_BAZI_ZIPING_PATTERNS: Record<string, BaziZipingPatternEntry> = {
  正官格: {
    pattern: '正官格',
    category: '正格',
    sourceBook: '子平真诠·论正官',
    rule: '以月令正官立格，察财生官、印护官及刑冲合化对官星的影响。',
    verse: '然而遇伤在于佩印，混煞贵乎取清。',
    modernAdvice:
      '财生官与印护官分别考察；官遇伤或混煞时，结合印星制伤、合制取清等救应判断成败。财印同见还需核对位置及彼此是否相碍。',
    taboos: ['官逢伤而无救应', '官杀混杂未取清', '刑冲损官而无解'],
  },
  偏官格: {
    pattern: '偏官格',
    category: '正格',
    sourceBook: '子平真诠·论偏官',
    rule: '偏官即七杀，以月令立格，结合身杀强弱与食制、印化的实际作用取用。',
    verse: '煞用食制者，上也，煞旺食强而身健，极为贵格。',
    modernAdvice:
      '食神制杀须兼顾日主承受克泄的能力，杀重身轻可考察印化。财印的作用随位置与强弱变化：财可能党杀，也可能去印存食；印可能化杀，也可能夺食护杀。',
    taboos: ['杀重身轻无化助', '用食制杀而财转食生杀', '制杀所需食神被印夺'],
  },
  七杀格: {
    pattern: '七杀格',
    category: '正格',
    sourceBook: '子平真诠·论偏官',
    rule: '七杀与偏官为同一十神，食制或印化的选择取决于全局强弱及配置。',
    verse: '亦有煞重身轻，用食则身不能当，不若转而就印，虽不通根月令，亦为无情而有情。',
    modernAdvice:
      '身健而杀旺可察食神制杀，杀重身轻则察印星承接杀气。制杀太过另看财印能否救应；官杀并透时结合月令、根气及合制结果判断取清。',
    taboos: ['杀重身轻无化助', '用食制杀而财转食生杀', '制杀所需食神被印夺'],
  },
  正财格: {
    pattern: '正财格',
    category: '正格',
    sourceBook: '子平真诠·论财',
    rule: '以月令正财立格，结合根气、日主承载及生官、食生、佩印等配置判断。',
    verse: '有财用食生者，身强而不露官，略带一位比劫，益觉有情。',
    modernAdvice:
      '财旺生官、财用食生与财格佩印各有条件。比劫可夺财，也可经食伤转而生财；财印并用须结合距离与作用关系，核对印能否有效扶身。',
    taboos: ['财受劫而无生护', '财重身轻无扶助', '财印相战而无解'],
  },
  偏财格: {
    pattern: '偏财格',
    category: '正格',
    sourceBook: '子平真诠·论财',
    rule: '以月令偏财立格，与正财同依财格考察根气、透藏及全局配合。',
    verse: '财喜根深，不宜太露，然透一位以清用，格所最喜，不为之露。',
    modernAdvice:
      '《论财》共同讨论正偏财的成格配置。财有根且透清、生官有护、食伤生财或佩印扶身，均须结合具体位置与强弱分别判断。',
    taboos: ['财受劫而无生护', '财重身轻无扶助', '财印相战而无解'],
  },
  正印格: {
    pattern: '正印格',
    category: '正格',
    sourceBook: '子平真诠·论印绶',
    rule: '以月令印绶立格，结合身印强弱，考察官生、食伤泄秀或财损太过。',
    verse: '印绶喜其生身，正偏同为美格，故财与印不分偏正，同为一格而论之。',
    modernAdvice:
      '身强印旺可察食伤泄秀，印重根深可用财抑其太过；印轻财重而无救应时才论财破印。官杀生印的效用同样取决于身、印与官杀的配合。',
    taboos: ['印轻财重无救应', '印浅身轻而食伤重', '身印并重而杀再生印'],
  },
  偏印格: {
    pattern: '偏印格',
    category: '正格',
    sourceBook: '子平真诠·论印绶',
    rule: '偏印与正印同归印绶格，考察印的生身作用及其与财、官杀、食伤的配合。',
    verse: '有印而用伤食者，身强印旺，恐其太过，泄身以为秀气。',
    modernAdvice:
      '偏印的喜忌取决于其在本局中的作用。用食伤泄秀时须看印是否夺食；用印扶身时须看财是否破印；印重身强又可考察财损印的条件。',
    taboos: ['印轻财重无救应', '印浅身轻而食伤重', '用食泄秀而枭印夺食'],
  },
  食神格: {
    pattern: '食神格',
    category: '正格',
    sourceBook: '子平真诠·论食神',
    rule: '以月令食神立格，结合日主根气，察生财、制杀及印星对食神的影响。',
    verse: '食神本属泄气，以其能生正财，所以喜之。故食神生财，美格也。',
    modernAdvice:
      '食神生财须看财的根气及日主承载。食神制杀须兼看克泄轻重，印来夺食可察财星解救；夏木、金水等气候条件另有取用。',
    taboos: ['用食生财而印来夺食无救', '制杀太过且身不旺而无印化扶身等救应', '身弱泄气太甚'],
  },
  伤官格: {
    pattern: '伤官格',
    category: '正格',
    sourceBook: '子平真诠·论伤官',
    rule: '以月令伤官立格，按气候与身伤强弱分别考察生财、佩印及用官条件。',
    verse: '在查其气候，量其强弱，审其喜忌，观其纯杂，微之又微，不可执也。',
    modernAdvice:
      '伤旺身弱可察佩印制伤扶身，身强有根可察伤官生财。金水伤官等调候条件可用官，并需财印相辅；财印同用须核对彼此是否相碍。',
    taboos: ['伤旺身弱无扶助', '用官而伤官损官无救', '财印相碍而失去救应'],
  },
  阳刃格: {
    pattern: '阳刃格',
    category: '变格',
    sourceBook: '子平真诠·论阳刃',
    rule: '以月令阳刃立格，察官杀制刃；用财时考察食伤能否转刃生财。',
    verse: '刃宜伏制，官煞皆宜，财印相随，尤为贵显。',
    modernAdvice:
      '官杀制刃须核对根气与轻重，制刃所需七杀被合也会影响作用。财根深而食伤通关可转刃生财，具体取用随全局配置判断。',
    taboos: ['制刃所需官杀受损', '七杀被合而失去制刃作用', '刃财相搏而无食伤通关'],
  },
  建禄月劫格: {
    pattern: '建禄月劫格',
    category: '变格',
    sourceBook: '子平真诠·论建禄月劫',
    rule: '月令建禄或月劫，依全局透藏另取财、官、杀、食为用。',
    verse: '故建禄与月劫，可同一格，不必加分，皆以透干支，别取财官煞食为用。',
    modernAdvice:
      '用官察财生或印护，用财察食伤通关，用杀察制伏。食伤也可泄身成局，各条路线分别结合根气、强弱和救应判断。',
    taboos: ['用官而孤官无辅', '用财而受劫无化', '官杀太重而无制化'],
  },
  从财格: {
    pattern: '从财格',
    category: '变格',
    sourceBook: '滴天髓·顺逆篇',
    rule: '日主全无印比根助，满盘财星成势而顺从财势。',
    verse: '真从之象有几人，假从亦可发其身。财星极旺身无气，顺财生发喜食伤。',
    modernAdvice:
      '从财最喜食伤生财及财旺之运，最忌比劫助身夺财、印星生身反战。须严谨核验四柱确无强根印绶方论成格。',
    taboos: ['岁运遇强比劫破从', '原局暗藏强根未净'],
  },
  从杀格: {
    pattern: '从杀格',
    category: '变格',
    sourceBook: '滴天髓·顺逆篇',
    rule: '满盘官杀强旺，日主无气无印，弃命顺从官杀威权。',
    verse: '弃命从煞，专论财官；印绶一至，反见倾危。',
    modernAdvice:
      '从杀喜财星党杀、官杀当权，忌食伤逆制官杀与印星强力化杀助身（易转战局）。',
    taboos: ['岁运食伤猛制破格', '强印比生扶反与官杀相抗'],
  },
  从儿格: {
    pattern: '从儿格',
    category: '变格',
    sourceBook: '滴天髓·顺逆篇',
    rule: '食伤极其强旺，日主泄尽转而顺从食伤吐秀生财。',
    verse: '一出门来只见儿，吾儿成气构樊篱；从儿不管身强弱，只要吾儿又得儿。',
    modernAdvice:
      '顺从食伤最喜再见财星流通成秀（“吾儿又得儿”），最忌重官重印克制食伤阻塞秀气。',
    taboos: ['枭印夺食破格', '重官杀与食伤猛战'],
  },
  从势格: {
    pattern: '从势格',
    category: '变格',
    sourceBook: '子平真诠·论外格',
    rule: '财官食伤并旺而日主毫无依倚，随大势中力最强者为用。',
    verse: '弱极无依随势走，财官食伤互为凭。',
    modernAdvice:
      '原局既无强比亦无正印，全盘财官食伤停匀或偏向一势，行运喜助顺原局最旺主势之五行。',
    taboos: ['强比劫印绶破其清顺'],
  },
  专旺格: {
    pattern: '专旺格',
    category: '变格',
    sourceBook: '子平真诠·论专旺',
    rule: '四柱气聚一党成方成局，日主独旺顺泄生发而不逆克。',
    verse: '一行得气成专旺，顺泄为佳最怕冲。',
    modernAdvice:
      '木曲直、火炎上、土稼穑、金从革、水润下皆属此类。喜顺行比劫与食伤泄秀，最忌强官杀逆局犯旺。',
    taboos: ['官杀犯旺激起群怒', '岁运冲破旺局月令'],
  },
};

const PATTERN_ALIAS_MAP: Record<string, string> = {
  建禄格: '建禄月劫格',
  劫财格: '建禄月劫格',
  月刃格: '阳刃格',
  弃命从财格: '从财格',
  弃命从杀格: '从杀格',
  曲直格: '专旺格',
  曲直仁寿格: '专旺格',
  炎上格: '专旺格',
  稼穑格: '专旺格',
  从革格: '专旺格',
  润下格: '专旺格',
};

export const BAZI_DITIANSUI_TABLE = structuredClone(CANONICAL_BAZI_DITIANSUI_TABLE);
export const BAZI_ZIPING_PATTERNS = structuredClone(CANONICAL_BAZI_ZIPING_PATTERNS);

function splitSourceBook(sourceBook: string): { book: string; chapter?: string } {
  const [book, chapter] = sourceBook.split('·');
  return chapter ? { book, chapter } : { book };
}

/**
 * 查询八字日主《滴天髓》十干体象。
 */
export function getBaziDitiansuiAdvice(dayMaster: string): BaziDitiansuiEntry | undefined {
  const key = dayMaster.trim();
  return Object.hasOwn(CANONICAL_BAZI_DITIANSUI_TABLE, key)
    ? structuredClone(CANONICAL_BAZI_DITIANSUI_TABLE[key])
    : undefined;
}

/**
 * 查询八字子平格局经典释义。
 */
export function getBaziZipingPatternAdvice(
  pattern: string,
): BaziZipingPatternEntry | undefined {
  if (!pattern) return undefined;
  const patternName = pattern.trim().replace(/（[^（）]*）$/, '');
  if (Object.hasOwn(CANONICAL_BAZI_ZIPING_PATTERNS, patternName)) {
    return structuredClone(CANONICAL_BAZI_ZIPING_PATTERNS[patternName]);
  }
  const aliasKey = Object.hasOwn(PATTERN_ALIAS_MAP, patternName)
    ? PATTERN_ALIAS_MAP[patternName]
    : undefined;
  if (aliasKey && Object.hasOwn(CANONICAL_BAZI_ZIPING_PATTERNS, aliasKey)) {
    return structuredClone(CANONICAL_BAZI_ZIPING_PATTERNS[aliasKey]);
  }
  return undefined;
}

function toDitiansuiExcerpt(entry: BaziDitiansuiEntry): ClassicExcerpt {
  const { book, chapter } = splitSourceBook(entry.sourceBook);
  return {
    book,
    chapter,
    title: `${entry.stem}${entry.wuxing}`,
    quote: entry.verse,
    explanation: `${entry.nature} ${entry.modernAdvice}`,
    condition: `日主为${entry.stem}`,
  };
}

function toZipingExcerpt(
  entry: BaziZipingPatternEntry,
  requestedPattern: string,
): ClassicExcerpt {
  const { book, chapter } = splitSourceBook(entry.sourceBook);
  const normalized = requestedPattern.trim();
  const condition =
    normalized && normalized !== entry.pattern
      ? `格局为${normalized}（归入${entry.pattern}）`
      : `格局为${entry.pattern}`;
  return {
    book,
    chapter,
    title: entry.pattern,
    quote: entry.verse,
    explanation: `${entry.rule} ${entry.modernAdvice} 忌：${entry.taboos.join('、')}。`,
    condition,
  };
}

/**
 * 按八字日主、格局与月令筛选匹配的《滴天髓》《子平真诠》《穷通宝鉴》典籍片段。
 */
export function selectBaziClassics(
  dayMaster: string,
  patternName?: string,
  monthBranch?: string,
): ClassicExcerpt[] {
  const excerpts: ClassicExcerpt[] = [];

  const stemEntry = getBaziDitiansuiAdvice(dayMaster);
  if (stemEntry) {
    excerpts.push(toDitiansuiExcerpt(stemEntry));
  }

  if (monthBranch) {
    const qiongtong = selectQiongtongExcerpt(dayMaster, monthBranch);
    if (qiongtong) {
      excerpts.push(qiongtong);
    }
  }

  if (patternName) {
    const patternEntry = getBaziZipingPatternAdvice(patternName);
    if (patternEntry) {
      excerpts.push(toZipingExcerpt(patternEntry, patternName));
    }
  }

  return excerpts;
}
