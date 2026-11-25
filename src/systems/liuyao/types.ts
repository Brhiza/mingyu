import type { castYarrow } from './cast';

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

export type LiuyaoChangeRelation =
  '回头生' | '回头克' | '回头冲' | '化空' | '比和' | '化泄' | '化耗';

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
  /** 是否与日辰相冲；结合动静、月破、月令旺相和旬空冲起区分暗动、日破或动爻受冲。 */
  isDayClash?: boolean;
  /** 静爻受日冲而未具暗动资格；暗动需综合月破、月令旺相或旬空冲起判定，动爻受冲读取 isDayClash。 */
  isDayBreak?: boolean;
  isMonthBreak?: boolean;
  /** 非月破静爻受日冲，且月令旺相或旬空冲起；旬空身份仍保留。 */
  isHiddenMove?: boolean;
  seasonState?: '旺' | '相' | '休' | '囚' | '死' | '平';
  changeDirection?: '化进神' | '化退神' | null;
  /** 旧版单值字段：变爻空亡时仍优先返回“化空”，新代码应读取 changeRelations。 */
  changeRelation?: LiuyaoChangeRelation | null;
  /** 动变五行/冲关系与化空可以并见，按原关系在前、化空在后保存。 */
  changeRelations?: LiuyaoChangeRelation[];
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
  /** 本爻五行对日辰所处的十二长生阶段。 */
  dayLifeStage?: string;
  /** 本爻五行对卦中明动爻地支所处的十二长生阶段。 */
  movingLifeStages?: Array<{
    position: number;
    branch: string;
    stage: string;
  }>;
  /** 本爻五行对自身变爻地支所处的十二长生阶段。 */
  changedLifeStage?: string;
  /** 本爻是否入卦中明动墓库。 */
  isDongMu?: boolean;
  /** 本爻发动后是否变入自身五行墓库。 */
  isHuaMu?: boolean;
  shiErGong?: string;
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
  /** 飞伏生克实效断语（依据《增删卜易·伏神章》与《卜筮正宗》） */
  interactionEffect?: string;
}

export type LiuyaoHexagramRelation = '六合卦' | '六冲卦';

export interface LiuyaoHexagramRelations {
  /** 主卦是否为整卦六合或六冲 */
  original: LiuyaoHexagramRelation | null;
  /** 有动爻时，变卦是否为整卦六合或六冲 */
  changed: LiuyaoHexagramRelation | null;
  /** 如“六冲变六合”“六合变六冲” */
  transition: string | null;
}

export type LiuyaoFanFuScope = '内卦' | '外卦' | '内外';
export type LiuyaoFanFuKind = '卦反吟' | '爻反吟' | '伏吟';

export interface LiuyaoFanFuRelationItem {
  /** 反吟/伏吟类型 */
  kind: LiuyaoFanFuKind;
  /** 触发在内卦、外卦或内外皆见 */
  scope: LiuyaoFanFuScope;
  /** 面向用户展示的简短标签 */
  label: string;
  /** 触发依据说明 */
  description: string;
}

export interface LiuyaoFanFuRelations {
  /** 反吟结构，可能同时存在内卦、外卦不同类型 */
  fanyin: LiuyaoFanFuRelationItem[];
  /** 伏吟结构，按动变后纳甲地支不变识别 */
  fuyin: LiuyaoFanFuRelationItem[];
  /** 便于前端与提示词直接展示的标签 */
  labels: string[];
}

export type LiuyaoPalaceStage =
  '首卦' | '一世' | '二世' | '三世' | '四世' | '五世' | '游魂' | '归魂';

export interface BaseHexagramData {
  originalName: string;
  changedName?: string;
  interName?: string;
  ganzhi: BaseGanZhi;
  timestamp: number;
}

export interface LiuyaoData extends BaseHexagramData {
  /** 起卦时实际采用的民用时区偏移；旧盘未记录时保持原有结构核验。 */
  timezoneOffsetMinutes?: number;
  /** 早晚子时换日口径：默认 23:00（23点换日柱）；00:00 为0点换日柱。 */
  ziHourMode?: '23:00' | '00:00';
  /** 真太阳时模式下用于节气与月建的实际占时戳（毫秒）。 */
  termReferenceTimestamp?: number;
  /** 起卦方式；三钱保留各次结果，并标明由用户提供或由程序模拟。 */
  generation?: {
    method: 'time' | 'manual' | 'coins' | 'yarrow';
    coinSource?: 'user-record' | 'simulated';
    yarrow?: ReturnType<typeof castYarrow>;
    coinThrows?: Array<{
      coins: [2 | 3, 2 | 3, 2 | 3];
      total: 6 | 7 | 8 | 9;
    }>;
  };
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
  /** 八宫卦序位置：首卦、一世至五世、游魂、归魂 */
  palaceStage?: LiuyaoPalaceStage;
  /** 各爻的完整详情 */
  yaosDetail: LiuyaoYaoDetail[];
  /** 伏神（伏藏之爻） */
  hiddenSpirits?: LiuyaoHiddenSpirit[];
  /** 整卦六合/六冲及卦变关系 */
  hexagramRelations?: LiuyaoHexagramRelations;
  /** 六爻卦变反吟/伏吟结构 */
  fanfuRelations?: LiuyaoFanFuRelations;
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

