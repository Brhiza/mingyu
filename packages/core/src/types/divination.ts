export type SixGod = '青龙' | '朱雀' | '勾陈' | '腾蛇' | '白虎' | '玄武';

export type DivinationType =
  | 'liuyao'
  | 'meihua'
  | 'xiaoliuren'
  | 'qimen'
  | 'liuren'
  | 'tarot'
  | 'tarot_single'
  | 'ssgw'
  | 'almanac'
  | 'lenormand'
  | 'astrolabe';

export type MeihuaDivinationMethod = 'time' | 'number' | 'random' | 'external' | 'timeTrigram';

export type XiaoliurenDivinationMethod = 'time' | 'number' | 'random';

export type MeihuaExternalDirection = '东' | '东南' | '南' | '西南' | '西' | '西北' | '北' | '东北';

export type MeihuaExternalPerson =
  | '老父'
  | '老妇'
  | '长男'
  | '长女'
  | '中男'
  | '中女'
  | '少男'
  | '少女';

export type MeihuaExternalAnimal = '马' | '牛' | '龙' | '鸡' | '猪' | '雉' | '狗' | '羊';

export type MeihuaExternalObject =
  | '金玉圆器'
  | '布帛陶器'
  | '竹木乐器'
  | '绳索长木'
  | '水器液体'
  | '火电文书'
  | '石块门板'
  | '刀剪口器';

export type MeihuaExternalSound =
  | '洪亮金石'
  | '沉厚低缓'
  | '雷鸣震动'
  | '风声呼啸'
  | '流水滴答'
  | '爆裂鸣叫'
  | '闷阻叩击'
  | '清脆笑语';

export type MeihuaExternalColor =
  | '金白'
  | '土黄'
  | '青碧'
  | '青绿'
  | '黑蓝'
  | '赤紫'
  | '棕黄'
  | '银白';

export interface MeihuaExternalOmens {
  direction?: MeihuaExternalDirection;
  count?: number;
  person?: MeihuaExternalPerson;
  animal?: MeihuaExternalAnimal;
  object?: MeihuaExternalObject;
  sound?: MeihuaExternalSound;
  color?: MeihuaExternalColor;
}

export interface MeihuaSettings {
  method?: MeihuaDivinationMethod;
  number?: number;
  externalOmens?: MeihuaExternalOmens;
}

export interface XiaoliurenPalaceDetail {
  name: '大安' | '留连' | '速喜' | '赤口' | '小吉' | '空亡';
  index: number;
  element: '木' | '火' | '金' | '水';
  meaning: string;
  keywords: string[];
  tendency: '宜推进' | '宜等待' | '易反复' | '易争执' | '有助力' | '易落空';
  advice: string;
  direction?: string;
  shenSha?: string;
  yinYang?: '阳' | '阴';
  number?: string;
  seasonProsper?: string;
  bodyPart?: string;
  fortune?: string;
  timing?: string;
}

export interface XiaoliurenData {
  method: XiaoliurenDivinationMethod;
  methodLabel: string;
  timestamp: number;
  lunarMonth: number;
  lunarDay: number;
  hourIndex: number;
  hourLabel: string;
  sequence: {
    start: XiaoliurenPalaceDetail;
    process: XiaoliurenPalaceDetail;
    result: XiaoliurenPalaceDetail;
  };
  wuxingRelations: {
    startToProcess: string;
    processToResult: string;
    description: string;
  };
  primary: XiaoliurenPalaceDetail;
  tendency: XiaoliurenPalaceDetail['tendency'];
  questionHint: string;
  seasonStates?: {
    start: string;
    process: string;
    result: string;
  };
  yingQi?: string;
  direction?: string;
  shenSha?: string;
  fortune?: string;
  timing?: string;
  bodyPart?: string;
}

export interface BaseGanZhi {
  year: string;
  month: string;
  day: string;
  hour: string;
}

export interface BaseYaoDetail {
  position: number;
  yaoType: '阳' | '阴';
  isChanging: boolean;
}

export interface LiuyaoYaoDetail extends BaseYaoDetail {
  rawValue: number;
  changeType: string;
  sixGod: string;
  sixRelative: string;
  najiaDizhi: string;
  wuxing: string;
  isWorld: boolean;
  isResponse: boolean;
  isVoid: boolean;
  isDayBreak?: boolean;
  isMonthBreak?: boolean;
  isHiddenMove?: boolean;
  seasonState?: '旺' | '相' | '休' | '囚' | '死' | '平';
  changeDirection?: '化进神' | '化退神' | null;
  changeRelation?: '回头生' | '回头克' | '回头冲' | '化空' | '比和' | null;
  changedYao?: {
    dizhi: string;
    wuxing: string;
    liuqin: string;
    isVoid: boolean;
  } | null;
  isSanxing?: boolean;
  sanxingType?: string;
  isLiuhe?: boolean;
  liuhePartner?: string;
  isLiuhai?: boolean;
  isRuMu?: boolean;
  shiErGong?: string;
  isYueMu?: boolean;
  isRiMu?: boolean;
}

export interface LiuyaoHiddenSpirit {
  sixRelative: string;
  position: number;
  najiaDizhi: string;
  wuxing: string;
  isVoid: boolean;
  underYao: {
    position: number;
    sixRelative: string;
    najiaDizhi: string;
    wuxing: string;
  };
}

export interface MeihuaYaoDetail extends BaseYaoDetail {
  tiYong: '体' | '用';
}

export interface BaseHexagramData {
  originalName: string;
  changedName?: string;
  interName?: string;
  ganzhi: BaseGanZhi;
  timestamp: number;
}

export interface LiuyaoData extends BaseHexagramData {
  /** 原始摇卦数字数组（6/7/8/9 分别代表老阴/少阳/少阴/老阳） */
  yaoArray: number[];
  /** 动爻详情：位置、是否变化、变化类型 */
  changingYaos: Array<{
    position: number;
    isChanging: boolean;
    type: string;
  }>;
  /** 六神排列（青龙、朱雀、勾陈…），基于起卦日干起 */
  sixGods: string[];
  /** 六亲排列（父母、兄弟、官鬼…），基于宫位五行定 */
  sixRelatives: string[];
  /** 纳甲地支：各爻对应的十二地支 */
  najiaDizhi: string[];
  /** 各爻的五行属性 */
  wuxing: string[];
  /** 世应位置：[世爻位置, 应爻位置] */
  worldAndResponse: string[];
  /** 旬空地支（日柱旬空） */
  voidBranches: string[];
  /** 所属卦宫（八宫之一） */
  palace: {
    name: string;
    wuxing: string;
  };
  /** 各爻的完整详情 */
  yaosDetail: LiuyaoYaoDetail[];
  /** 伏神（伏藏之爻） */
  hiddenSpirits?: LiuyaoHiddenSpirit[];
  /** 特殊卦象标记：静卦、独静卦、全动卦、乾卦用九、坤卦用六 */
  specialPattern?: '静卦' | '独静卦' | '全动卦' | '乾卦用九' | '坤卦用六';
  specialAdvice?: string;
  isChaotic?: boolean;
  chaoticReason?: string;
  /** 与日支的三合局 */
  sanheWithDay?: {
    group: string;
    members: string[];
    description: string;
  } | null;
  /** 与月建的三合局 */
  sanheWithMonth?: {
    group: string;
    members: string[];
    description: string;
  } | null;
  /** 爻中的三刑 */
  sanxingInYaos?: Array<{
    branches: string[];
    type: string;
  }>;
  /** 卦神（卦身）信息 */
  guaShen?: {
    branch: string;
    sixRelative: string;
    position: number;
  } | null;
}

export interface MeihuaCalculation {
  method: string;
  numbers?: number[];
  time?: string;
  number?: number;
  month?: number;
  day?: number;
  yearZhi?: string;
  yearZhiIndex?: number;
  timeZhi?: string;
  timeZhiIndex?: number;
  upperTrigramIndex?: number;
  lowerTrigramIndex?: number;
  movingYaoIndex?: number;
  methodKey?: MeihuaDivinationMethod;
  externalOmens?: MeihuaExternalOmens;
  externalSummary?: string;
  externalMappedOmens?: Array<{
    source: string;
    label: string;
    trigram: string;
    trigramIndex: number;
  }>;
  [key: string]: unknown;
}

export interface MeihuaData extends BaseHexagramData {
  /** 体卦（代表问卦者） */
  tiGua: {
    name: string;
    element: string;
    nature: string;
  };
  /** 用卦（代表所问之事） */
  yongGua: {
    name: string;
    element: string;
    nature: string;
  };
  /** 变后的体卦（动爻变化导致） */
  changedTiGua?: {
    name: string;
    element: string;
    nature: string;
  } | null;
  /** 变后的用卦 */
  changedYongGua?: {
    name: string;
    element: string;
    nature: string;
  } | null;
  /** 动爻位置与描述 */
  movingYao: {
    position: number;
    description: string;
    yaoName: string;
  };
  /** 体用生克综合分析 */
  analysis: {
    season: '春' | '夏' | '秋' | '冬';
    tiYongRelation: string;
    tiSeasonState: string;
    yongSeasonState: string;
    inter1Relation: string;
    inter2Relation: string;
    changedRelation: string;
    changedTiYongRelation: string;
    tiYongRaw?: string;
    yingQi?: string[];
  };
  /** 主卦信息 */
  mainHexagram: {
    name: string;
    symbol: string;
    upper: string;
    lower: string;
    description: string;
    yaoCi?: string[];
    movingYaoCi?: string;
  };
  /** 互卦（代表过程） */
  interHexagram?: {
    name: string;
    symbol: string;
    upper: string;
    lower: string;
    description: string;
    yaoCi?: string[];
  } | null;
  /** 变卦（代表结果） */
  changedHexagram?: {
    name: string;
    symbol: string;
    upper: string;
    lower: string;
    description: string;
    yaoCi?: string[];
  } | null;
  /** 各爻详情 */
  yaosDetail: MeihuaYaoDetail[];
  /** 起卦计算过程 */
  calculation?: MeihuaCalculation;
}

export interface QimenJiuGongGe {
  gong: number;
  name: string;
  direction: string;
  element: string;
  tianPan: {
    star: string;
    stem: string;
  };
  diPan: {
    stem: string;
  };
  renPan: {
    door: string;
  };
  shenPan: {
    god: string;
  };
}

export interface QimenSpecialConditions {
  isLiuJiaHour: boolean;
  isLiuGuiHour: boolean;
  isShiGanRuMu: boolean;
  isWuBuYuShi: boolean;
  description: string;
}

export interface QimenTimeInfo {
  solarTerm: string;
  epoch: string;
  [key: string]: string;
}

export interface QimenBranchPalace {
  branch: string;
  palace: number;
  name: string;
}

/**
 * 奇门遁甲排盘级别
 * - hour: 时家奇门（精确到时辰，默认）
 * - day:  日家奇门（一日大势）
 * - month: 月家奇门（一月运势）
 * - year:  年家奇门（一年大势）
 */
export type QimenScope = 'hour' | 'day' | 'month' | 'year';

export interface QimenData {
  /** 排盘级别：hour=时家, day=日家, month=月家, year=年家 */
  scope?: QimenScope;
  /** 九宫格完整数据（1-9宫） */
  jiuGongGe: QimenJiuGongGe[];
  /** 四柱干支（年/月/日/时） */
  ganzhi: BaseGanZhi;
  /** 是否为阳遁 */
  isYangDun: boolean;
  /** 局数（1-9） */
  juShu: number;
  /** 值符星名 */
  zhiFu: string;
  /** 值使门名 */
  zhiShi: string;
  /** 基础格局标签列表（如星伏吟、门迫、三奇得等） */
  patternTags?: string[];
  /** 格局标签的详细解释 */
  patternDetails?: Array<{
    tag: string;
    summary: string;
  }>;
  /** 各宫位综合洞察评估 */
  palaceInsights?: Array<{
    gong: number;
    name: string;
    level: '有利' | '风险' | '关注';
    summary: string;
  }>;
  /** 空亡地支 */
  voidBranches?: string[];
  /** 空亡对应的宫位 */
  voidPalaces?: QimenBranchPalace[];
  /** 驿马（马星）信息 */
  horseStar?: QimenBranchPalace & {
    sourceBranch: string;
  };
  /** 排盘时间信息（节气、三元等） */
  timeInfo: QimenTimeInfo;
  /** 特殊时辰检查（六甲时、六癸时、时干入墓、五不遇时） */
  specialConditions?: QimenSpecialConditions;
  /** 经典格局（九遁、三奇得使、天乙等） */
  classicPatterns?: Array<{
    name: string;
    type: 'good' | 'bad' | 'neutral';
    score: number;
    summary: string;
    palaces: number[];
  }>;
  /** 各宫天地盘干关系（生克/合/墓/刑） */
  stemRelations?: Array<{
    gong: number;
    heavenStem: string;
    earthStem: string;
    relation: string;
    pattern?: string;
  }>;
  /** 方位吉凶建议 */
  directions?: {
    goodDirections: Array<{
      gong: number;
      name: string;
      direction: string;
      score: number;
      use: string;
      reasons: string[];
    }>;
    avoidDirections: Array<{
      gong: number;
      name: string;
      direction: string;
      score: number;
      use: string;
      reasons: string[];
    }>;
  };
  /** 应期估算（最快/最慢天数、节奏） */
  yingQi?: {
    minDays: number;
    maxDays: number;
    rhythm: '快' | '中' | '慢';
    sources: string[];
    description: string;
  };
  /** Unix 时间戳（毫秒） */
  timestamp: number;
}

export interface LiurenPlateItem {
  branch: string;
  under: string;
  god: string;
}

export interface LiurenLesson {
  name: '一课' | '二课' | '三课' | '四课';
  upper: string;
  lower: string;
  god: string;
  relation: string;
  note: string;
}

export interface LiurenTransmission {
  stage: '初传' | '中传' | '末传';
  branch: string;
  god: string;
  relation: string;
  note: string;
}

export interface LiurenClassicalRule {
  source: string;
  rule: string;
  category: string;
  summary: string;
}

export interface LiurenData {
  /** 四柱干支（年/月/日/时） */
  ganzhi: BaseGanZhi;
  /** Unix 时间戳（毫秒） */
  timestamp: number;
  /** 昼夜占：昼占或夜占 */
  dayNight?: '昼占' | '夜占';
  /** 月将（所用太阳过宫） */
  monthLeader: string;
  /** 占时地支（起课时辰） */
  divinationBranch: string;
  /** 日上官贵（日干对应贵人） */
  dayOfficer: string;
  /** 贵人临支 */
  noblemanBranch?: string;
  /** 贵人所临地盘 */
  noblemanGroundBranch?: string;
  /** 旬空地支 */
  xunKong?: string[];
  /** 发用规则名称（如涉害、遥克、昴星等九宗门） */
  transmissionRule?: string;
  /** 三传特殊模式：伏吟/反吟/回环/递传 */
  transmissionPattern?: '伏吟' | '反吟' | '回环' | '递传';
  /** 三传详细说明 */
  transmissionDetail?: string;
  /** 地盘十二支 */
  earthlyPlate?: string[];
  /** 日干寄宫 */
  dayStemResidence?: string;
  /** 天盘（十二支加十二天将） */
  heavenlyPlate: LiurenPlateItem[];
  /** 四课 */
  fourLessons: LiurenLesson[];
  /** 三传（初传/中传/末传） */
  threeTransmissions: LiurenTransmission[];
  /** 课体标签 */
  patternTags?: string[];
  /** 经典课体 */
  classicalRules?: LiurenClassicalRule[];
  /** 四课概要总结 */
  lessonSummary?: string;
  /** 三传概要总结 */
  transmissionSummary?: string;
  /** 课体名称列表 */
  guaTi?: string[];
  /** 神煞汇总 */
  shenShaSummary?: string[];
  /** 天将属性详情 */
  tianJiangProps?: Record<
    string,
    {
      wuxing: string;
      yinYang: string;
      category: string;
      color?: string;
      flavor?: string;
      number?: number;
      terrain?: string;
      description?: string;
      bodyPart?: string;
    }
  >;
}

export interface TarotData {
  spreadType: string;
  spreadName: string;
  cards: {
    id: number;
    name: string;
    position: string;
    reversed: boolean;
    keywords: string[];
  }[];
  timestamp: number;
}

export type TarotSpreadType =
  | 'single'
  | 'three'
  | 'love'
  | 'career'
  | 'decision'
  | 'celtic'
  | 'chakra'
  | 'year'
  | 'mindBodySpirit'
  | 'horseshoe';

export type LiuyaoTemplateType = 'general' | 'ganqing' | 'shiye' | 'caifu' | 'guaishen';

export type LiurenTemplateType = 'general' | 'ganqing' | 'shiye' | 'caifu';

export type AlmanacTopic =
  | 'marriage'
  | 'move'
  | 'opening'
  | 'contract'
  | 'travel'
  | 'medical'
  | 'study'
  | 'burial'
  | 'renovation'
  | 'custom';

export type AlmanacParticipantGender = '男' | '女' | '';

export interface AlmanacParticipantInput {
  id: string;
  name: string;
  gender: AlmanacParticipantGender;
  year: string;
  month: string;
  day: string;
  timeIndex: string;
  dateType: 'solar' | 'lunar';
  isLeapMonth?: boolean;
}

export interface AlmanacParticipantProfile {
  id: string;
  name: string;
  gender: AlmanacParticipantGender;
  solarDate: string;
  lunarDate: string;
  zodiac: string;
  constellation: string;
  dayMaster: string;
  dayMasterElement: string;
  pillars: BaseGanZhi;
  usefulGods: string[];
  avoidGods: string[];
}

export interface AlmanacDayCandidate {
  date: string;
  weekday: string;
  lunarDate: string;
  ganzhi: {
    year: string;
    month: string;
    day: string;
  };
  zodiac: string;
  dayOfficer: string;
  twelveStar: string;
  twentyEightStar: string;
  twentyEightStarDetail?: {
    wuxing: string;
    fortune: string;
    meaning: string;
  } | null;
  nineStar: string;
  nineStarDetail?: {
    wuxing: string;
    fortune: string;
    meaning: string;
  } | null;
  gods: string[];
  recommends: string[];
  avoids: string[];
  pengZu: string;
  pengZuGan?: string;
  pengZuZhi?: string;
  clash: string;
  score: number;
  highlights: string[];
  cautions: string[];
  participantNotes: string[];
}

export interface AlmanacData {
  topic: AlmanacTopic;
  topicLabel: string;
  startDate: string;
  endDate: string;
  days: AlmanacDayCandidate[];
  participants: AlmanacParticipantProfile[];
  timestamp: number;
}

export type LenormandSpreadType =
  | 'single'
  | 'three'
  | 'five'
  | 'relationship'
  | 'decision'
  | 'nine'
  | 'element'
  | 'grandTableau';

export interface LenormandData {
  spreadType: LenormandSpreadType;
  spreadName: string;
  cards: {
    id: number;
    name: string;
    position: string;
    keywords: string[];
    meaning: string;
  }[];
  combinations?: Array<{
    card1: string;
    card2: string;
    meaning: string;
  }>;
  timestamp: number;
}

export interface AstrolabeBirthInput {
  name: string;
  gender: AlmanacParticipantGender;
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  latitude: string;
  longitude: string;
  timezone: string;
  locationName?: string;
  useTrueSolarTime?: boolean;
}

export interface AstrolabePoint {
  name: string;
  label: string;
  longitude: number;
  sign: string;
  degree: number;
  minute: number;
  house: number;
  formatted: string;
  retrograde?: boolean;
}

export interface AstrolabeAspect {
  body1: string;
  body2: string;
  type: string;
  symbol: string;
  orb: number;
  strength: number;
  applying: boolean | null;
}

export interface AstrolabeData {
  birth: {
    name: string;
    gender: AlmanacParticipantGender;
    dateTime: string;
    location: string;
    timezone: number;
    standardDateTime?: string;
    trueSolarDateTime?: string;
    isTrueSolarTime?: boolean;
  };
  planets: AstrolabePoint[];
  angles: AstrolabePoint[];
  houses: AstrolabePoint[];
  aspects: AstrolabeAspect[];
  summary: {
    elements: Record<string, string[]>;
    modalities: Record<string, string[]>;
    retrograde: string[];
    patterns: string[];
  };
  timestamp: number;
}

export interface SsgwRitualThrow {
  result: '圣杯' | '笑杯' | '阴杯';
}

export interface SsgwRitual {
  throws: SsgwRitualThrow[];
  rejected?: boolean;
  reason?: string;
}

export interface SsgwData {
  number: number;
  title: string;
  poem: string;
  story?: string;
  details?: { [key: string]: string };
  timestamp: number;
  ganzhi: BaseGanZhi;
  ritual?: SsgwRitual;
}

export type DivinationData =
  | LiuyaoData
  | MeihuaData
  | XiaoliurenData
  | QimenData
  | LiurenData
  | TarotData
  | SsgwData
  | AlmanacData
  | LenormandData
  | AstrolabeData;

export interface SupplementaryInfo {
  gender?: '男' | '女';
  birthYear?: number;
  userSupplement?: string;
  interpretationStyle?: '入门' | '专业';
  outputLength?: '精简' | '详细' | '超详细';
  dayPillar?: {
    heavenlyStem: string;
    earthlyBranch: string;
  };
  meihuaSettings?: MeihuaSettings;
}
