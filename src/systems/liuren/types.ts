export interface BaseGanZhi { year: string; month: string; day: string; hour: string }
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
  wuxing?: string;
  seasonState?: '旺' | '相' | '休' | '囚' | '死';
  isVoid?: boolean;
  dayRelation?: string;
}

export interface LiurenClassicalRule {
  source: string;
  rule: string;
  category: string;
  summary: string;
}

export type LiurenOrdinaryTransmissionStageId =
  'directKe' | 'directBiYong' | 'directSheHai' | 'remoteKe' | 'remoteBiYong' | 'remoteSheHai';

export interface LiurenOrdinaryTransmissionCandidate {
  key: string;
  family: 'directKe' | 'remoteKe';
  kind: '下贼上' | '上克下' | '蒿矢' | '弹射';
  upper: string;
  sourceLessons: Array<{
    position: number;
    name: LiurenLesson['name'];
    lower: string;
  }>;
  sameYinYangAsDayStem: boolean;
  harmAssessment?: {
    walkedBranches: string[];
    depth: number;
  };
  status: 'selected' | 'eligible' | 'excluded' | 'suppressedByPrior';
  reasons: string[];
}

export interface LiurenOrdinaryTransmissionStage {
  id: LiurenOrdinaryTransmissionStageId;
  order: number;
  status: 'selected' | 'matched' | 'notMatched' | 'notApplicable' | 'suppressedByPrior';
  conditions: string[];
  candidateKeys: string[];
  selectedCandidateKey?: string;
  reason: string;
  sources: string[];
}

export interface LiurenOrdinaryTransmissionAdjudication {
  key: 'liuren:ordinary-transmission-adjudication';
  status: 'selected' | 'deferredToSpecial';
  selectedRule: string | null;
  selectedInitial: string | null;
  selectedCandidateKey: string | null;
  candidates: LiurenOrdinaryTransmissionCandidate[];
  stages: LiurenOrdinaryTransmissionStage[];
  summary: string;
  sources: string[];
  limitation: string;
}

export interface LiurenGuaTiFact {
  id: string;
  stableKey: string;
  name: string;
  category:
    | '三传支类'
    | '三合成局'
    | '发用临地'
    | '岁将贵人'
    | '四课关系'
    | '贵人临地'
    | '三传冲合'
    | '传干生克'
    | '闭口发用';
  branches: string[];
  matchedConditions: string[];
  sourceTitle: string;
  sourceUrl: string;
  sourceQuote: string;
}

export interface LiurenShenShaFact {
  name: string;
  target: string;
  targetType: '天干' | '地支';
  category: '十天干神煞' | '十二地支神煞' | '逐月神煞' | '罗网神煞';
  basis: '日干' | '日支' | '月建';
  input: string;
  rule: string;
  sources: string[];
  limitations: string[];
}

export interface LiurenData {
  /** 四柱干支（年/月/日/时） */
  ganzhi: BaseGanZhi;
  /** Unix 时间戳（毫秒） */
  timestamp: number;
  /** 本次起课实际采用的钟表时区偏移（分钟）；旧记录可缺省。 */
  timezoneOffsetMinutes?: number;
  /** 真太阳时模式下用于节气、年/月柱与月将的实际占时戳（毫秒）。 */
  termReferenceTimestamp?: number;
  timeContext?: { standard: 'true-solar'; longitude: number; referenceTimestamp: number; longitudeCorrectionMinutes: number; equationOfTimeMinutes: number; totalCorrectionMinutes: number };
  /** 昼夜占：昼占或夜占 */
  dayNight?: '昼占' | '夜占';
  /** 月将（所用太阳过宫） */
  monthLeader: string;
  /** 占时地支（起课时辰） */
  divinationBranch: string;
  /** 贵人起例口诀：默认 jia-wu-geng-chou-wei（甲戊庚牛羊）；jia-yang-wu-geng-niu 为古本甲羊戊庚牛。 */
  guiRenTable?: 'jia-wu-geng-chou-wei' | 'jia-yang-wu-geng-niu';
  /** 贵人临支 */
  noblemanBranch?: string;
  /** 贵人所临地盘 */
  noblemanGroundBranch?: string;
  /** 旬空地支 */
  xunKong?: string[];
  /** 发用规则名称（如涉害、遥克、昴星等九宗门） */
  transmissionRule?: string;
  /** 普通宗门（贼克、比用、涉害、遥克）的候选与优先裁决轨迹 */
  ordinaryTransmissionAdjudication?: LiurenOrdinaryTransmissionAdjudication;
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
  /** 逐项登记、可复算且带固定古籍来源的课体事实 */
  guaTiFacts?: LiurenGuaTiFact[];
  /** 神煞汇总 */
  shenShaSummary?: string[];
  /** 可逐项复算的神煞定位事实 */
  shenShaFacts?: LiurenShenShaFact[];
  /** 天将属性详情 */
  tianJiangProps?: Record<
    string,
    {
      wuxing: string;
      yinYang: string;
      category: string;
      description?: string;
    }
  >;
  focusEvidence?: Array<{
    target: string;
    role: string;
    level: '主证' | '辅证';
    evidence: string[];
    limitations: string[];
  }>;
  timingEvidence?: string[];
}


export type LiurenTemplateType = 'general' | 'ganqing' | 'shiye' | 'caifu';
