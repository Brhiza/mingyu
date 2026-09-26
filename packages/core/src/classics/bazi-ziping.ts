import type { BaziZipingPatternEntry } from './types';

/**
 * 《子平真诠》格局原文节录与释义。原文仅转为简体并调整标点。
 * 底本：《子平真诠评注》沈孝瞻原著部分，第三十一至四十五章：
 * https://www.ncc.com.tw/fate/paleo/bg/bg_034.htm
 * https://www.ncc.com.tw/fate/paleo/bg/bg_035.htm
 */
export const BAZI_ZIPING_PATTERNS: Record<string, BaziZipingPatternEntry> = {
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
};

/**
 * 查询八字子平格局经典释义
 */
export function getBaziZipingPatternAdvice(pattern: string): BaziZipingPatternEntry | undefined {
  if (!pattern) return undefined;
  const exact = BAZI_ZIPING_PATTERNS[pattern];
  if (exact) return exact;
  // 主格局名与典籍表键的显式映射：建禄格／劫财格同属“建禄月劫格”，月刃格对应“阳刃格”；
  // 建禄与月劫、阳刃之间的差异以条目原文为准，不做子串猜测
  const aliasMap: Record<string, string> = {
    建禄格: '建禄月劫格',
    劫财格: '建禄月劫格',
    月刃格: '阳刃格',
  };
  const aliasKey = aliasMap[pattern];
  if (aliasKey && BAZI_ZIPING_PATTERNS[aliasKey]) {
    return BAZI_ZIPING_PATTERNS[aliasKey];
  }
  // 支持模糊匹配：如从 "正官格（用财）" 匹配到 "正官格"
  const key = Object.keys(BAZI_ZIPING_PATTERNS).find((k) => pattern.includes(k));
  return key ? BAZI_ZIPING_PATTERNS[key] : undefined;
}
