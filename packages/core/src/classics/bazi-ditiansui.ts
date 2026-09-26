import type { BaziDitiansuiEntry } from './types';

/**
 * 《滴天髓·天干论》十干体象原文短摘与释义。
 * 底本：https://zh.wikisource.org/w/index.php?title=滴天髓/02&oldid=3211656
 */
export const BAZI_DITIANSUI_TABLE: Record<string, BaziDitiansuiEntry> = {
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
 * 查询八字日主《滴天髓》十干体象
 */
export function getBaziDitiansuiAdvice(dayMaster: string): BaziDitiansuiEntry | undefined {
  return BAZI_DITIANSUI_TABLE[dayMaster];
}
