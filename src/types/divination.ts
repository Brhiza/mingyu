export type SixGod = '青龙' | '朱雀' | '勾陈' | '腾蛇' | '白虎' | '玄武';

export type DivinationType =
  | 'liuyao'
  | 'meihua'
  | 'qimen'
  | 'liuren'
  | 'tarot'
  | 'tarot_single'
  | 'ssgw';

export type MeihuaDivinationMethod = 'time' | 'number' | 'random' | 'external';

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
  changedYao?: {
    dizhi: string;
    wuxing: string;
    liuqin: string;
    isVoid: boolean;
  } | null;
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
  yaoArray: number[];
  changingYaos: Array<{
    position: number;
    isChanging: boolean;
    type: string;
  }>;
  sixGods: string[];
  sixRelatives: string[];
  najiaDizhi: string[];
  wuxing: string[];
  worldAndResponse: string[];
  voidBranches: string[];
  palace: {
    name: string;
    wuxing: string;
  };
  yaosDetail: LiuyaoYaoDetail[];
  specialPattern?: '静卦' | '独静卦' | '全动卦' | '乾卦用九' | '坤卦用六';
  specialAdvice?: string;
  isChaotic?: boolean;
  chaoticReason?: string;
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
  tiGua: {
    name: string;
    element: string;
    nature: string;
  };
  yongGua: {
    name: string;
    element: string;
    nature: string;
  };
  changedTiGua?: {
    name: string;
    element: string;
    nature: string;
  } | null;
  changedYongGua?: {
    name: string;
    element: string;
    nature: string;
  } | null;
  movingYao: {
    position: number;
    description: string;
    yaoName: string;
  };
  analysis: {
    season: '春' | '夏' | '秋' | '冬';
    tiYongRelation: string;
    tiSeasonState: string;
    yongSeasonState: string;
    inter1Relation: string;
    inter2Relation: string;
    changedRelation: string;
    changedTiYongRelation: string;
  };
  mainHexagram: {
    name: string;
    symbol: string;
    upper: string;
    lower: string;
    description: string;
  };
  interHexagram?: {
    name: string;
    symbol: string;
    upper: string;
    lower: string;
    description: string;
  } | null;
  changedHexagram?: {
    name: string;
    symbol: string;
    upper: string;
    lower: string;
    description: string;
  } | null;
  yaosDetail: MeihuaYaoDetail[];
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

export interface QimenData {
  jiuGongGe: QimenJiuGongGe[];
  ganzhi: BaseGanZhi;
  isYangDun: boolean;
  juShu: number;
  zhiFu: string;
  zhiShi: string;
  patternTags?: string[];
  patternDetails?: Array<{
    tag: string;
    summary: string;
  }>;
  palaceInsights?: Array<{
    gong: number;
    name: string;
    level: '有利' | '风险' | '关注';
    summary: string;
  }>;
  timeInfo: QimenTimeInfo;
  specialConditions?: QimenSpecialConditions;
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

export interface LiurenData {
  ganzhi: BaseGanZhi;
  timestamp: number;
  dayNight?: '昼占' | '夜占';
  monthLeader: string;
  divinationBranch: string;
  dayOfficer: string;
  noblemanBranch?: string;
  xunKong?: string[];
  transmissionRule?: string;
  transmissionPattern?: '伏吟' | '反吟' | '回环' | '递传';
  transmissionDetail?: string;
  heavenlyPlate: LiurenPlateItem[];
  fourLessons: LiurenLesson[];
  threeTransmissions: LiurenTransmission[];
  patternTags?: string[];
  lessonSummary?: string;
  transmissionSummary?: string;
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

export type LiurenTemplateType = 'general' | 'ganqing' | 'shiye' | 'caifu';

export interface SsgwData {
  number: number;
  title: string;
  poem: string;
  story?: string;
  details?: { [key: string]: string };
  timestamp: number;
  ganzhi: BaseGanZhi;
}

export type DivinationData = LiuyaoData | MeihuaData | QimenData | LiurenData | TarotData | SsgwData;

export interface SupplementaryInfo {
  gender?: '男' | '女';
  birthYear?: number;
  interpretationStyle?: '入门' | '专业';
  outputLength?: '精简' | '详细' | '超详细';
  dayPillar?: {
    heavenlyStem: string;
    earthlyBranch: string;
  };
  meihuaSettings?: MeihuaSettings;
}
