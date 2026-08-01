import type {
  LiuyaoActivityPatternKind,
  LiuyaoChangeRelation,
  LiuyaoData,
  LiuyaoHiddenSpirit,
  LiuyaoHiddenSpiritConditionAnalysis,
  LiuyaoLineStrengthAnalysis,
  LiuyaoMonthGuaShenStatus,
  LiuyaoSanhePattern,
  LiuyaoSanheStatus,
  LiuyaoYaoDetail,
} from '../types/divination';
import {
  getBranchWuxing,
  getSanxingType,
  isKe,
  isLiuchong,
  isLiuhai,
  isLiuhe,
  isSanxing,
  isSheng,
} from '../ganzhi';
import { liuqinRelations } from './divination-data';
import {
  analyzeLiuyaoActivityPattern,
  analyzeLiuyaoFanFuRelations,
  analyzeLiuyaoHiddenSpiritConditions,
  analyzeLiuyaoLineStrength,
  analyzeLiuyaoMonthGuaShen,
  analyzeLiuyaoSanheFormations,
  analyzeLiuyaoSanxingFormations,
  getLiuyaoChangeDirection,
} from './liuyao-rules';
import { getSixAnimals } from '../calendar/lunar';
import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import {
  buildRandomTraceFact,
  formatLegacyRandomFacts,
  type RandomTraceFact,
} from '../shared/random';

export type LiuyaoEvidenceTopic = 'general' | 'ganqing' | 'shiye' | 'caifu' | 'guaishen';
export type LiuyaoGodRole = '用神' | '原神' | '忌神' | '仇神';
export type LiuyaoGodEffectStatus =
  '仅见有力条件' | '仅见无力条件' | '有力无力条件并见' | '资料不足';
export type LiuyaoGodReferenceActivity =
  '月日直接作用' | '明动' | '暗动' | '静爻' | '伏藏待透' | '本位变爻待验';
export type LiuyaoGodInteractionKind =
  | '月日直接入用'
  | '直接生扶用神'
  | '直接克制用神'
  | '忌原接续相生'
  | '生扶原神'
  | '克制原神'
  | '生扶忌神'
  | '克制忌神';
export type LiuyaoGodInteractionRole = LiuyaoGodRole | '用神所生' | '其他作用爻';
export type LiuyaoGodInteractionRelation = '生' | '克' | '比扶';
export type LiuyaoGodInteractionBalanceStatus =
  '用神未定' | '月日直接入用' | '未见生克路径' | '仅见生扶路径' | '仅见克制路径' | '生扶克制并见';
export type LiuyaoSanheGodRole =
  '用神局' | '原神局' | '忌神局' | '仇神局' | '用神所生' | '用神未定';
export type LiuyaoUsefulGodMatchingTier = '本卦明现' | '变爻显出' | '月日入用' | '伏神检索';

export interface LiuyaoEvidenceOptions {
  topic?: LiuyaoEvidenceTopic;
  /** 用户或上层明确指定的用神六亲；优先于主题默认候选。 */
  usefulGodRelative?: string;
}

export interface LiuyaoYaoReference {
  key: string;
  factKey: string;
  source: '本卦' | '变爻' | '月建' | '日辰' | '伏神';
  status: '已匹配';
  position?: number;
  sixRelative: string;
  stem?: string;
  branch: string;
  wuxing: string;
  isWorld?: boolean;
  isResponse?: boolean;
  isChanging?: boolean;
  isVoid: boolean;
  strengthAnalysis?: LiuyaoLineStrengthAnalysis;
  support: string[];
  constraints: string[];
  changedYao?: {
    sixRelative: string;
    stem?: string;
    branch: string;
    wuxing: string;
    isVoid: boolean;
    relation: LiuyaoYaoDetail['changeRelation'];
    relations: LiuyaoChangeRelation[];
    direction: LiuyaoYaoDetail['changeDirection'];
  };
}

export interface LiuyaoUsefulGodCandidate {
  key: string;
  status: '已匹配' | '未匹配';
  sourceStatus: '用户指定' | '主题默认' | '盘面补齐';
  candidateRole: '用神候选' | '辅助观察';
  matchingTier: LiuyaoUsefulGodMatchingTier | null;
  label: string;
  relative?: string;
  position?: number;
  reason: string;
  references: LiuyaoYaoReference[];
  referenceKeys: string[];
  support: string[];
  constraints: string[];
  promptText: string;
  sources: string[];
  limitation: '用神候选区分真正的六亲取用与世应、动爻等辅助观察，并按本卦明现、变爻显出、月日入用、伏神检索的层级匹配；候选不等于已证明现实事项，也不得按候选顺序、数量或匹配数量换算吉凶分与成功率';
}

export interface LiuyaoGodReferenceEffectFact {
  key: string;
  role: LiuyaoGodRole;
  referenceKey: string;
  activity: LiuyaoGodReferenceActivity;
  status: LiuyaoGodEffectStatus;
  supportingConditions: string[];
  blockingConditions: string[];
  promptText: string;
  sources: string[];
  limitation: '原神、忌神效力与用神有气条件只逐项登记原典中能由当前月日、动静、空破墓绝、动变及原忌仇同动闭合的事实；条件可以并见，静爻有得力条件不等于已经作用，也不得按条件数量裁定有效无效、吉凶或结果';
}

export interface LiuyaoGodChainItem {
  key: string;
  role: LiuyaoGodRole;
  status: '当前资料有对应' | '当前资料未见';
  wuxing: string;
  relation: string;
  references: LiuyaoYaoReference[];
  referenceKeys: string[];
  effectStatus: LiuyaoGodEffectStatus;
  effectFacts: LiuyaoGodReferenceEffectFact[];
  promptText: string;
  sources: string[];
  limitation: '原神、忌神与仇神只按已明确的用神六亲五行建立生克链，并记录本卦、月日与伏神中能直接参与作用的对应；变爻只通过本位动爻形成回头生克冲、进退空墓等条件，不跨位充当独立原忌仇神；资料有无对应不直接证明现实助力、阻碍、吉凶或结果';
}

export interface LiuyaoGodInteractionPathStep {
  referenceKey: string;
  role: LiuyaoGodInteractionRole;
  activity: LiuyaoGodReferenceActivity;
  wuxing: string;
  relationToNext: LiuyaoGodInteractionRelation | null;
}

export interface LiuyaoGodInteractionFact {
  key: string;
  kind: LiuyaoGodInteractionKind;
  status: '关系路径已闭合';
  targetReferenceKey: string;
  referenceKeys: string[];
  path: LiuyaoGodInteractionPathStep[];
  conditions: string[];
  promptText: string;
  sources: string[];
  limitation: '生克制化路径只按当前月日、真实明暗动、符合条件的旺相静爻、本位动变及伏神飞伏事实重算；路径可以并见且可能互相制化，不得按路径数量、多数票或顺序裁定最终强弱、用神有效性、吉凶或结果';
}

export interface LiuyaoGodInteractionAssessmentFact {
  key: 'liuyao:god-interaction-assessment';
  status: '待综合判断' | '资料不足';
  balanceStatus: LiuyaoGodInteractionBalanceStatus;
  usefulGodEffectStatus: LiuyaoGodEffectStatus;
  supportingFactKeys: string[];
  restrainingFactKeys: string[];
  transformationFactKeys: string[];
  unresolvedFactKeys: string[];
  conditions: string[];
  promptText: string;
  sources: string[];
  limitation: '全局生克作用态只把已闭合路径按生扶侧、克制侧与制化侧归组，并保留用神本身的有气无根条件；不得按路径条数、多数票或数组顺序裁定生多克少、最终可用性、吉凶或现实结果';
}

export interface LiuyaoTraditionalSymbolFact {
  key: string;
  status: '已映射';
  relative: string;
  positions: number[];
  originalText: string;
  promptText: string;
  source: '传统六亲类象表与当前六亲排布';
  sources: string[];
  limitation: '六亲只提供随问题变化的事项候选，不证明现实身份、疾病、官非、财运或关系结果';
}

export interface LiuyaoLineFact {
  key: string;
  status: '已计算';
  position: number;
  rawValue: number;
  yaoType: LiuyaoYaoDetail['yaoType'];
  changeType: string;
  sixGod: string;
  sixRelative: string;
  najia: {
    stem?: string;
    branch: string;
    wuxing: string;
  };
  roles: Array<'世爻' | '应爻'>;
  activity: '静爻' | '明动' | '暗动';
  monthState: {
    branch: string;
    seasonState?: LiuyaoYaoDetail['seasonState'];
    relations: string[];
  };
  dayState: {
    branch: string;
    relations: string[];
  };
  traditionalRelations: {
    sanxingType?: string;
    liuhePartner?: string;
    isLiuhai: boolean;
    isRuMu: boolean;
  };
  isVoid: boolean;
  strengthAnalysis: LiuyaoLineStrengthAnalysis;
  support: string[];
  constraints: string[];
  changedYao?: {
    sixRelative: string;
    stem?: string;
    branch: string;
    wuxing: string;
    isVoid: boolean;
    relation: LiuyaoYaoDetail['changeRelation'];
    relations: LiuyaoChangeRelation[];
    direction: LiuyaoYaoDetail['changeDirection'];
  };
  promptText: string;
  sources: string[];
  limitation: '逐爻字段只登记纳甲、世应、月日、其他爻与本位动变的支持和限制条件；条件可以并见且不得按数量打分，不据此裁定最终强弱或用神有无效，也不单独证明现实吉凶、应期或结果';
}

export interface LiuyaoHiddenSpiritFact {
  key: string;
  status: '已计算';
  position: number;
  sixRelative: string;
  najia: {
    stem?: string;
    branch: string;
    wuxing: string;
  };
  isVoid: boolean;
  coveringLine: LiuyaoHiddenSpirit['underYao'];
  conditionAnalysis: LiuyaoHiddenSpiritConditionAnalysis;
  support: string[];
  constraints: string[];
  promptText: string;
  sources: string[];
  limitation: '伏神事实只记录伏藏位置、飞伏生克及月日动爻空破墓绝条件；支持与限制可以并见，不得按条件数量直接宣布出伏、有用无用、吉凶或现实结果';
}

export interface LiuyaoGenerationFact {
  key: string;
  status: '可核验' | '来源链缺失';
  method: NonNullable<LiuyaoData['generation']>['method'] | '未记录';
  methodLabel: string;
  yaoValues: number[];
  coinThrows: NonNullable<NonNullable<LiuyaoData['generation']>['coinThrows']>;
  expectedLineCount: 6;
  recordedLineCount: number;
  promptText: string;
  sources: string[];
  limitation: '起卦来源只说明卦象如何生成以及六个爻值如何录入或生成，不提高卦象证据等级，也不证明预测有效性或现实结果';
}

export interface LiuyaoLineCoverageFact {
  key: 'liuyao:line-coverage';
  status: '完整' | '缺少爻位' | '爻位异常';
  expectedPositions: number[];
  actualPositions: number[];
  missingPositions: number[];
  duplicatePositions: number[];
  invalidPositions: number[];
  lineFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '六爻覆盖状态只说明当前结果能否完整核验初爻至上爻；缺少、重复或越界爻位时不得反推纳甲、六亲、六神、世应、空破墓或动变内容';
}

export interface LiuyaoHiddenSpiritCoverageFact {
  key: 'liuyao:hidden-spirit-coverage';
  status: '有伏神' | '无伏神' | '字段缺失';
  hiddenSpiritFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '伏神覆盖状态只说明当前结果是否明确保存伏神数组以及是否检出伏神；字段缺失时不得把无记录解释为无伏神，也不得反推伏神位置与六亲';
}

export interface LiuyaoUsefulGodSelectionFact {
  key: 'liuyao:useful-god-selection';
  status: '已选定候选' | '用神爻位待择' | '取用范围待定' | '缺少可用候选';
  topic: LiuyaoEvidenceTopic;
  requestedRelative: string | null;
  targetRelative: string | null;
  matchingTier: LiuyaoUsefulGodMatchingTier | null;
  selectedCandidateKey: string | null;
  selectedReferenceKey: string | null;
  candidateKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '用神选择状态按本卦明现、变爻显出、月日入用、伏神检索的层级记录当前取用；问题关系不足、多现未能闭合或各层均无匹配时不得硬取，也不得把世应、动爻或数组顺序冒充唯一用神';
}

export interface LiuyaoCounterEvidenceFact {
  key: string;
  ownerCandidateKey: string;
  candidateLabel: string;
  status: '已触发';
  detail: string;
  referenceKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '反证事实只表示候选用神命中空亡、月破、日破、休囚死、入墓、回头克冲、化空、化退或未匹配等限制；不得把单项反证直接写成现实失败、灾祸或必然结果';
}

export interface LiuyaoCounterSummaryFact {
  key: 'liuyao:counter-summary';
  status: '有明确反证' | '未见明确反证';
  factKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '反证汇总只说明当前候选核验是否发现明确限制；未见明确反证不代表现实风险为零，也不得按反证数量换算吉凶分或成功率';
}

export interface LiuyaoTimingFact {
  key: string;
  type:
    | '动爻触发'
    | '空亡填实'
    | '用神病药'
    | '原神病药'
    | '忌神制化'
    | '伏神透出'
    | '反吟伏吟节奏'
    | '取用边界'
    | '静卦边界'
    | '期限边界';
  sourceStatus: '由盘面生成' | '统一边界';
  role: LiuyaoGodRole | '未定' | '整卦';
  effect: '变化点待回扣' | '助用待验' | '受制待解' | '制忌待辨' | '节奏边界' | '解释边界';
  ownerFactKeys: string[];
  referenceKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '六爻应期事实只围绕已定用神、原神、忌神的病药关系及卦内节奏提供条件；同一空破合冲须按角色辨向，未给期限时不得把爻位、支序或卦数换算唯一日期，也不证明事件必然发生';
}

export interface LiuyaoHexagramStructureFact {
  key: string;
  kind:
    | '整卦六合六冲'
    | '反吟伏吟'
    | '动静结构'
    | '月卦身'
    | '卦内三合'
    | '日辰三合'
    | '月建三合'
    | '虚一待用'
    | '卦内三刑';
  status: '已计算';
  sanheFormationKey?: string;
  sanhePattern?: LiuyaoSanhePattern;
  sanheStatus?: LiuyaoSanheStatus;
  sanheRole?: LiuyaoSanheGodRole;
  activityPattern?: LiuyaoActivityPatternKind;
  movingCount?: number;
  movingPositions?: number[];
  stillPositions?: number[];
  scriptureReference?: '乾卦用九' | '坤卦用六';
  guaShenBranch?: string;
  guaShenStatus?: LiuyaoMonthGuaShenStatus;
  guaShenPositions?: number[];
  referenceKeys?: string[];
  missingBranch?: string;
  originalText: string;
  promptText: string;
  sources: string[];
  limitation: '整卦六合六冲、反吟伏吟、动静结构、月卦身、三合与三刑只描述已计算的结构及成立条件；必须结合用忌、世爻、旺衰、空破墓与制化辨向，不得直接写成现实和合、冲散、纠纷、成败或固定应期';
}

export interface LiuyaoTimingSummaryFact {
  key: 'liuyao:timing-summary';
  status: '已提供触发条件' | '仅有边界';
  factKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '应期汇总只说明当前盘面保存了哪些触发与边界条件；不得按条件数量、爻位或地支序换算固定天数、绝对日期或事件概率';
}

export interface LiuyaoCalculationStep {
  key: string;
  stage:
    | '起卦来源核验'
    | '六爻逐爻计算'
    | '伏神资料核验'
    | '用神候选筛选'
    | '原忌仇神作用链'
    | '反证与应期核验'
    | '证据汇总';
  status: '已计算' | '资料不足';
  inputs: Record<string, string | number | boolean | string[]>;
  result: Record<string, string | number | boolean | string[]>;
  dependsOnStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '计算步骤只证明起卦来源、逐爻、伏神、用神候选、五行作用链、反证与应期事实如何形成当前证据；不证明现实吉凶、预测有效性、事件概率或固定应期';
}

export interface LiuyaoSummaryFact {
  key: 'liuyao:evidence-summary';
  status: '证据链完整' | '部分资料缺失' | '用神取用待定' | '缺少可用候选';
  factKeys: string[];
  lineFactCount: number;
  hiddenSpiritFactCount: number;
  candidateCount: number;
  matchedCandidateCount: number;
  godChainFactCount: number;
  godInteractionFactCount: number;
  structureFactCount: number;
  counterEvidenceCount: number;
  timingFactCount: number;
  promptText: string;
  sources: string[];
  limitation: '六爻证据汇总只统计起卦、逐爻、伏神、候选、五行作用链、卦内结构、反证与应期事实的覆盖情况；不得按数量生成吉凶总分、成功率、超自然判断或唯一日期';
}

export interface LiuyaoLimitationFact {
  key: string;
  type:
    | '起卦与随机来源边界'
    | '逐爻与伏神资料边界'
    | '用神候选与五行链边界'
    | '卦内结构与传统类象边界'
    | '反证与应期边界'
    | '高风险输出边界';
  status: '适用';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '限制事实用于约束六爻起卦、逐爻、伏神、用神、传统类象与应期资料能够支持的解释范围，不得被反向当作现实吉凶、疾病灾祸、超自然原因、事件概率或固定应期的证据';
}

export interface LiuyaoEvidenceAnalysis {
  key: 'liuyao:evidence';
  status: '已计算';
  topic: LiuyaoEvidenceTopic;
  monthBranch: string;
  dayBranch: string;
  candidates: LiuyaoUsefulGodCandidate[];
  selectedCandidate: LiuyaoUsefulGodCandidate | null;
  godChain: LiuyaoGodChainItem[];
  godInteractionFacts: LiuyaoGodInteractionFact[];
  godInteractionAssessmentFact: LiuyaoGodInteractionAssessmentFact;
  traditionalSymbols: LiuyaoTraditionalSymbolFact[];
  structureFacts: LiuyaoHexagramStructureFact[];
  lineCoverageFact: LiuyaoLineCoverageFact;
  lineFacts: LiuyaoLineFact[];
  hiddenSpiritCoverageFact: LiuyaoHiddenSpiritCoverageFact;
  hiddenSpiritFacts: LiuyaoHiddenSpiritFact[];
  selectionFact: LiuyaoUsefulGodSelectionFact;
  generationFact: LiuyaoGenerationFact;
  generationFacts: string[];
  randomFact: RandomTraceFact;
  randomFacts: string[];
  timingFacts: LiuyaoTimingFact[];
  timingSummaryFact: LiuyaoTimingSummaryFact;
  timingConditions: string[];
  counterEvidenceFacts: LiuyaoCounterEvidenceFact[];
  counterSummaryFact: LiuyaoCounterSummaryFact;
  counterEvidence: string[];
  calculationSteps: LiuyaoCalculationStep[];
  calculationChain: string[];
  summaryFact: LiuyaoSummaryFact;
  limitations: string[];
  limitationFacts: LiuyaoLimitationFact[];
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: string[];
}

const ELEMENTS = ['木', '火', '土', '金', '水'];

const LINE_FACT_LIMITATION =
  '逐爻字段只登记纳甲、世应、月日、其他爻与本位动变的支持和限制条件；条件可以并见且不得按数量打分，不据此裁定最终强弱或用神有无效，也不单独证明现实吉凶、应期或结果' as const;

const HIDDEN_SPIRIT_FACT_LIMITATION =
  '伏神事实只记录伏藏位置、飞伏生克及月日动爻空破墓绝条件；支持与限制可以并见，不得按条件数量直接宣布出伏、有用无用、吉凶或现实结果' as const;
const GENERATION_FACT_LIMITATION =
  '起卦来源只说明卦象如何生成以及六个爻值如何录入或生成，不提高卦象证据等级，也不证明预测有效性或现实结果' as const;
const CANDIDATE_FACT_LIMITATION =
  '用神候选区分真正的六亲取用与世应、动爻等辅助观察，并按本卦明现、变爻显出、月日入用、伏神检索的层级匹配；候选不等于已证明现实事项，也不得按候选顺序、数量或匹配数量换算吉凶分与成功率' as const;
const GOD_CHAIN_FACT_LIMITATION =
  '原神、忌神与仇神只按已明确的用神六亲五行建立生克链，并记录本卦、月日与伏神中能直接参与作用的对应；变爻只通过本位动爻形成回头生克冲、进退空墓等条件，不跨位充当独立原忌仇神；资料有无对应不直接证明现实助力、阻碍、吉凶或结果' as const;
const GOD_INTERACTION_FACT_LIMITATION =
  '生克制化路径只按当前月日、真实明暗动、符合条件的旺相静爻、本位动变及伏神飞伏事实重算；路径可以并见且可能互相制化，不得按路径数量、多数票或顺序裁定最终强弱、用神有效性、吉凶或结果' as const;
const GOD_INTERACTION_ASSESSMENT_FACT_LIMITATION =
  '全局生克作用态只把已闭合路径按生扶侧、克制侧与制化侧归组，并保留用神本身的有气无根条件；不得按路径条数、多数票或数组顺序裁定生多克少、最终可用性、吉凶或现实结果' as const;
const LINE_COVERAGE_FACT_LIMITATION =
  '六爻覆盖状态只说明当前结果能否完整核验初爻至上爻；缺少、重复或越界爻位时不得反推纳甲、六亲、六神、世应、空破墓或动变内容' as const;
const HIDDEN_SPIRIT_COVERAGE_FACT_LIMITATION =
  '伏神覆盖状态只说明当前结果是否明确保存伏神数组以及是否检出伏神；字段缺失时不得把无记录解释为无伏神，也不得反推伏神位置与六亲' as const;
const SELECTION_FACT_LIMITATION =
  '用神选择状态按本卦明现、变爻显出、月日入用、伏神检索的层级记录当前取用；问题关系不足、多现未能闭合或各层均无匹配时不得硬取，也不得把世应、动爻或数组顺序冒充唯一用神' as const;
const COUNTER_FACT_LIMITATION =
  '反证事实只表示候选用神命中空亡、月破、日破、休囚死、入墓、回头克冲、化空、化退或未匹配等限制；不得把单项反证直接写成现实失败、灾祸或必然结果' as const;
const COUNTER_SUMMARY_LIMITATION =
  '反证汇总只说明当前候选核验是否发现明确限制；未见明确反证不代表现实风险为零，也不得按反证数量换算吉凶分或成功率' as const;
const TIMING_FACT_LIMITATION =
  '六爻应期事实只围绕已定用神、原神、忌神的病药关系及卦内节奏提供条件；同一空破合冲须按角色辨向，未给期限时不得把爻位、支序或卦数换算唯一日期，也不证明事件必然发生' as const;
const TIMING_SUMMARY_LIMITATION =
  '应期汇总只说明当前盘面保存了哪些触发与边界条件；不得按条件数量、爻位或地支序换算固定天数、绝对日期或事件概率' as const;
const HEXAGRAM_STRUCTURE_FACT_LIMITATION =
  '整卦六合六冲、反吟伏吟、动静结构、月卦身、三合与三刑只描述已计算的结构及成立条件；必须结合用忌、世爻、旺衰、空破墓与制化辨向，不得直接写成现实和合、冲散、纠纷、成败或固定应期' as const;
const CALCULATION_STEP_LIMITATION =
  '计算步骤只证明起卦来源、逐爻、伏神、用神候选、五行作用链、反证与应期事实如何形成当前证据；不证明现实吉凶、预测有效性、事件概率或固定应期' as const;
const SUMMARY_FACT_LIMITATION =
  '六爻证据汇总只统计起卦、逐爻、伏神、候选、五行作用链、卦内结构、反证与应期事实的覆盖情况；不得按数量生成吉凶总分、成功率、超自然判断或唯一日期' as const;
const LIMITATION_FACT_LIMITATION =
  '限制事实用于约束六爻起卦、逐爻、伏神、用神、传统类象与应期资料能够支持的解释范围，不得被反向当作现实吉凶、疾病灾祸、超自然原因、事件概率或固定应期的证据' as const;

const TRADITIONAL_RELATIVE_IMAGES: Record<string, string> = {
  父母: '传统常取文书、消息、单位、房屋、长辈、辛劳等类象',
  兄弟: '传统常取同辈、竞争、合作分配、朋友、资源消耗等类象',
  官鬼: '传统常取职责、职位、压力、忧虑、疾病、官非等类象',
  妻财: '传统常取财物、交易、资源、伴侣或关系对象等类象',
  子孙: '传统常取产出、子女、放松、解忧、医药、财源等类象',
};
const LIUYAO_RELATIVES = new Set(Object.keys(TRADITIONAL_RELATIVE_IMAGES));

export function conditionLiuyaoTraditionalText(text: string): string {
  return text
    .replace(/事势增强/g, '传统上视为合局条件较集中')
    .replace(/事体不虚/g, '传统上可作为事项线索')
    .replace(/主(?!(?:卦|轴|证|判|要|动|客))/g, '传统类象提示')
    .replace(/必然/g, '可能')
    .replace(/必定/g, '较可能');
}

function branchOf(ganzhi: string) {
  return ganzhi.slice(1, 2);
}

function getChangeRelations(yao: LiuyaoYaoDetail): LiuyaoChangeRelation[] {
  if (!yao.isChanging || !yao.changedYao) return [];
  const wuxingRelation: LiuyaoChangeRelation = isSheng(yao.changedYao.wuxing, yao.wuxing)
    ? '回头生'
    : isKe(yao.changedYao.wuxing, yao.wuxing)
      ? '回头克'
      : yao.changedYao.wuxing === yao.wuxing
        ? '比和'
        : isSheng(yao.wuxing, yao.changedYao.wuxing)
          ? '化泄'
          : '化耗';
  return [
    ...(isLiuchong(yao.najiaDizhi, yao.changedYao.dizhi)
      ? (['回头冲', wuxingRelation] as const)
      : [wuxingRelation]),
    ...(isLiuhe(yao.najiaDizhi, yao.changedYao.dizhi) ? (['化扶'] as const) : []),
    ...(yao.changedYao.isVoid ? (['化空'] as const) : []),
  ];
}

function formatNaJia(stem: string | undefined, branch: string) {
  return `${stem ?? ''}${branch}`;
}

function formatYao(reference: LiuyaoYaoReference) {
  if (reference.source === '月建' || reference.source === '日辰') {
    return `${reference.source}${formatNaJia(reference.stem, reference.branch)}${reference.sixRelative}${reference.wuxing}`;
  }
  const changed = reference.changedYao
    ? `→${reference.changedYao.sixRelative}${formatNaJia(reference.changedYao.stem, reference.changedYao.branch)}${reference.changedYao.wuxing}${reference.changedYao.relations.length ? `（${reference.changedYao.relations.join('、')}）` : reference.changedYao.isVoid ? '（变爻空亡）' : ''}${reference.changedYao.direction ? `（${reference.changedYao.direction}）` : ''}`
    : '';
  return `${reference.source}第${reference.position}爻${reference.sixRelative}${formatNaJia(reference.stem, reference.branch)}${reference.wuxing}${changed}`;
}

function uniqueStrings(items: string[]) {
  return Array.from(new Set(items));
}

function getGodReferenceActivity(reference: LiuyaoYaoReference): LiuyaoGodReferenceActivity {
  if (reference.source === '月建' || reference.source === '日辰') return '月日直接作用';
  if (reference.source === '伏神') return '伏藏待透';
  if (reference.source === '变爻') return '本位变爻待验';
  if (reference.isChanging) return '明动';
  if (reference.strengthAnalysis?.selfSupport.includes('暗动')) return '暗动';
  return '静爻';
}

function isGodReferenceMoving(reference: LiuyaoYaoReference) {
  const activity = getGodReferenceActivity(reference);
  return activity === '明动' || activity === '暗动';
}

function getGodEffectStatus(
  supportingConditions: string[],
  blockingConditions: string[],
): LiuyaoGodEffectStatus {
  if (supportingConditions.length && blockingConditions.length) return '有力无力条件并见';
  if (supportingConditions.length) return '仅见有力条件';
  if (blockingConditions.length) return '仅见无力条件';
  return '资料不足';
}

function buildGodReferenceEffectFact(params: {
  role: LiuyaoGodRole;
  reference: LiuyaoYaoReference;
  sourceReferences: LiuyaoYaoReference[];
  tabooReferences: LiuyaoYaoReference[];
  enemyReferences: LiuyaoYaoReference[];
}): LiuyaoGodReferenceEffectFact {
  const { role, reference, sourceReferences, tabooReferences, enemyReferences } = params;
  const activity = getGodReferenceActivity(reference);
  const supportingConditions: string[] = [];
  const blockingConditions: string[] = [];
  const strength = reference.strengthAnalysis;
  const label = formatYao(reference);

  if (reference.source === '月建' || reference.source === '日辰') {
    supportingConditions.push(`${reference.source}直接充当${role}五行`);
  } else if (reference.source === '伏神') {
    supportingConditions.push(
      ...reference.support.filter((item) =>
        /伏神月令[旺相]|(?:月建|日辰|明动|暗动).*生伏神|飞来生伏/.test(item),
      ),
    );
    blockingConditions.push(
      '伏藏待透',
      ...reference.constraints.filter((item) =>
        /伏神月令[休囚死]|伏神旬空|伏神月破|克伏|伏神.*(?:墓|绝)/.test(item),
      ),
    );
  } else if (strength) {
    const strongSeason = strength.seasonState === '旺' || strength.seasonState === '相';
    const weakSeason = ['休', '囚', '死'].includes(strength.seasonState);
    const moving = isGodReferenceMoving(reference);
    const calendarSupport = strength.calendarSupport.filter((item) =>
      /^(?:值月建|值日辰|月建生本爻|月建比扶本爻|日辰生本爻|日辰比扶本爻|日辰为长生|日辰为帝旺)$/.test(
        item,
      ),
    );
    const movingLineSupport = strength.lineSupport.filter((item) =>
      /第\d+爻(?:明动|暗动).*(?:生本爻|比扶本爻)$/.test(item),
    );
    const materialHarm = [
      ...strength.calendarConstraints,
      ...strength.lineConstraints,
      ...strength.changeConstraints,
    ].filter((item) => /克本爻|回头克/.test(item));
    const voidOrBreak = [...strength.selfConstraints, ...strength.calendarConstraints].filter(
      (item) => /空亡|月破/.test(item),
    );
    const tombConditions = [...strength.calendarConstraints, ...strength.changeConstraints].filter(
      (item) => /墓/.test(item),
    );
    const absoluteConditions = [
      ...strength.calendarConstraints,
      ...strength.changeConstraints,
    ].filter((item) => /绝/.test(item));

    if (strongSeason) supportingConditions.push(`月令${strength.seasonState}`);
    supportingConditions.push(...calendarSupport, ...movingLineSupport);
    if (moving) {
      supportingConditions.push(
        ...strength.changeSupport.filter((item) => /^(?:回头生|化进神)$/.test(item)),
      );
    }

    if (role === '用神') {
      if (weakSeason) blockingConditions.push(`月令${strength.seasonState}`);
      blockingConditions.push(
        ...strength.selfConstraints.filter((item) => /空亡/.test(item)),
        ...strength.calendarConstraints.filter((item) => /月破|日破|克本爻|墓|绝/.test(item)),
        ...strength.lineConstraints.filter((item) => /克本爻/.test(item)),
        ...strength.changeConstraints.filter((item) =>
          /回头克|回头冲|化退神|化泄|化耗|化破|化绝|化墓/.test(item),
        ),
      );
      if (
        strength.calendarConstraints.includes('月破') &&
        strength.calendarConstraints.includes('日辰克本爻')
      ) {
        blockingConditions.push('月破且受日辰克，见原典“用神无根”同类条件');
      }
    } else if (role === '原神' || role === '忌神') {
      if (weakSeason && !moving) blockingConditions.push(`月令${strength.seasonState}且安静`);
      if (weakSeason && moving && materialHarm.length) {
        blockingConditions.push(
          `月令${strength.seasonState}且发动受克：${materialHarm.join('、')}`,
        );
      }
      if (weakSeason && voidOrBreak.length) {
        blockingConditions.push(`月令${strength.seasonState}且见${voidOrBreak.join('、')}`);
      }
      if (weakSeason && moving && strength.changeConstraints.includes('化退神')) {
        blockingConditions.push(`月令${strength.seasonState}且化退神`);
      }
      if (weakSeason && absoluteConditions.length) {
        blockingConditions.push(`月令${strength.seasonState}且见${absoluteConditions.join('、')}`);
      }
      blockingConditions.push(...tombConditions.map((item) => `见入墓条件：${item}`));
      if (moving) {
        blockingConditions.push(
          ...strength.changeConstraints.filter((item) => /^(?:回头克|化破|化绝)$/.test(item)),
        );
      }

      const calendarRestraints = strength.calendarConstraints.filter((item) =>
        /^(?:月建克本爻|日辰克本爻|月破|日破|日辰冲本爻)$/.test(item),
      );
      const movingLineRestraints = strength.lineConstraints.filter((item) =>
        /第\d+爻(?:明动|暗动).*克本爻$/.test(item),
      );
      if (role === '原神') {
        blockingConditions.push(
          ...calendarRestraints,
          ...movingLineRestraints,
          ...strength.changeConstraints.filter((item) =>
            /^(?:回头克|化退神|化破|化绝)$/.test(item),
          ),
        );
      } else {
        if (!moving) {
          blockingConditions.push(
            ...strength.selfConstraints.filter((item) => /空亡/.test(item)),
            ...strength.calendarConstraints.filter((item) => /月破|日破/.test(item)),
          );
        }
        blockingConditions.push(
          ...calendarRestraints,
          ...movingLineRestraints,
          ...strength.changeConstraints.filter((item) =>
            /^(?:回头克|化退神|化破|化绝)$/.test(item),
          ),
        );
      }

      if (
        moving &&
        strongSeason &&
        (reference.isVoid || strength.changeConstraints.includes('化空'))
      ) {
        supportingConditions.push(
          reference.isVoid
            ? '旺相发动而临空，保留出空冲实后作用条件'
            : '旺相发动而化空，保留变爻出空后作用条件',
        );
      }
      if (role === '原神' && moving && tabooReferences.some(isGodReferenceMoving)) {
        supportingConditions.push('原神与忌神同动，忌神贪生原神');
      }
      if (role === '忌神' && moving && sourceReferences.some(isGodReferenceMoving)) {
        blockingConditions.push('忌神与原神同动，须辨贪生忘克');
      }
      if (role === '忌神' && moving && enemyReferences.some(isGodReferenceMoving)) {
        supportingConditions.push('忌神与仇神同动，得仇神生扶');
      }
      if (role === '原神' && enemyReferences.some(isGodReferenceMoving)) {
        blockingConditions.push('仇神发动克原神');
      }
    }
  }

  const normalizedSupporting = uniqueStrings(supportingConditions);
  const normalizedBlocking = uniqueStrings(blockingConditions);
  const status = getGodEffectStatus(normalizedSupporting, normalizedBlocking);
  const roleTerms = role === '用神' ? ['有气', '无根'] : ['有力', '无力'];
  return {
    key: `liuyao:god-effect:${role}:${reference.key}`,
    role,
    referenceKey: reference.key,
    activity,
    status,
    supportingConditions: normalizedSupporting,
    blockingConditions: normalizedBlocking,
    promptText: `${label}活动状态${activity}；${roleTerms[0]}条件${normalizedSupporting.join('、') || '当前资料未闭合'}；${roleTerms[1]}条件${normalizedBlocking.join('、') || '当前资料未闭合'}；条件只并列复核，不按数量裁定${role === '用神' ? '最终是否可用' : '能否实际作用'}`,
    sources: [
      '《增删卜易·元神忌神衰旺章》',
      '《卜筮正宗·原忌仇神论》',
      '当前月日、动静、空破墓绝、动变及原忌仇同动事实',
    ],
    limitation:
      '原神、忌神效力与用神有气条件只逐项登记原典中能由当前月日、动静、空破墓绝、动变及原忌仇同动闭合的事实；条件可以并见，静爻有得力条件不等于已经作用，也不得按条件数量裁定有效无效、吉凶或结果',
  };
}

interface LiuyaoDirectInfluenceEdge {
  actor: LiuyaoYaoReference;
  recipient: LiuyaoYaoReference;
  relation: LiuyaoGodInteractionRelation;
  condition: string;
}

function findInfluenceActorReference(
  condition: string,
  recipient: LiuyaoYaoReference,
  groups: LiuyaoReferenceGroups,
) {
  if (condition.startsWith('月建')) {
    return groups.calendar.find((item) => item.source === '月建') ?? null;
  }
  if (condition.startsWith('日辰')) {
    return groups.calendar.find((item) => item.source === '日辰') ?? null;
  }
  const lineMatch = condition.match(/第(\d+)爻/);
  if (lineMatch) {
    const position = Number(lineMatch[1]);
    return groups.visible.find((item) => item.position === position) ?? null;
  }
  if (/^(?:回头生|回头克|比和)$/.test(condition)) {
    return groups.changed.find((item) => item.position === recipient.position) ?? null;
  }
  if (/飞来|飞神克伏/.test(condition)) {
    return groups.visible.find((item) => item.position === recipient.position) ?? null;
  }
  return null;
}

function buildDirectInfluenceEdges(recipient: LiuyaoYaoReference, groups: LiuyaoReferenceGroups) {
  const edges: LiuyaoDirectInfluenceEdge[] = [];
  const addEdge = (condition: string, relation: LiuyaoGodInteractionRelation) => {
    const actor = findInfluenceActorReference(condition, recipient, groups);
    if (!actor || actor.key === recipient.key) return;
    edges.push({ actor, recipient, relation, condition });
  };

  if (recipient.source === '本卦' && recipient.strengthAnalysis) {
    const strength = recipient.strengthAnalysis;
    for (const condition of [
      ...strength.calendarSupport,
      ...strength.lineSupport,
      ...strength.changeSupport,
    ]) {
      if (/生本爻$|^回头生$/.test(condition)) addEdge(condition, '生');
      if (/比扶本爻$|^比和$/.test(condition)) addEdge(condition, '比扶');
    }
    for (const condition of [
      ...strength.calendarConstraints,
      ...strength.lineConstraints,
      ...strength.changeConstraints,
    ]) {
      if (/克本爻$|^回头克$/.test(condition)) addEdge(condition, '克');
    }
  } else if (recipient.source === '伏神') {
    for (const condition of recipient.support) {
      if (/生伏神$|^飞来生伏$/.test(condition)) addEdge(condition, '生');
    }
    for (const condition of recipient.constraints) {
      if (/克伏神|飞神克伏/.test(condition)) addEdge(condition, '克');
    }
    for (const actor of groups.visible.filter(isGodReferenceMoving)) {
      const activity = getGodReferenceActivity(actor);
      if (isSheng(actor.wuxing, recipient.wuxing)) {
        addEdge(`第${actor.position}爻${activity}生伏神`, '生');
      } else if (isKe(actor.wuxing, recipient.wuxing)) {
        addEdge(`第${actor.position}爻${activity}克伏神`, '克');
      }
    }
  } else if (recipient.source === '变爻') {
    for (const actor of groups.calendar) {
      if (isSheng(actor.wuxing, recipient.wuxing)) {
        edges.push({
          actor,
          recipient,
          relation: '生',
          condition: `${actor.source}生变爻`,
        });
      } else if (actor.wuxing === recipient.wuxing) {
        edges.push({
          actor,
          recipient,
          relation: '比扶',
          condition: `${actor.source}比扶变爻`,
        });
      } else if (isKe(actor.wuxing, recipient.wuxing)) {
        edges.push({
          actor,
          recipient,
          relation: '克',
          condition: `${actor.source}克变爻`,
        });
      }
    }
  }

  return Array.from(
    new Map(
      edges.map((edge) => [
        `${edge.actor.key}|${edge.recipient.key}|${edge.relation}|${edge.condition}`,
        edge,
      ]),
    ).values(),
  );
}

function getGodInteractionRole(params: {
  wuxing: string;
  usefulElement: string;
  sourceElement: string;
  tabooElement: string;
  enemyElement: string;
}): LiuyaoGodInteractionRole {
  const { wuxing, usefulElement, sourceElement, tabooElement, enemyElement } = params;
  if (wuxing === usefulElement) return '用神';
  if (wuxing === sourceElement) return '原神';
  if (wuxing === tabooElement) return '忌神';
  if (wuxing === enemyElement) return '仇神';
  if (isSheng(usefulElement, wuxing)) return '用神所生';
  return '其他作用爻';
}

function buildGodInteractionFacts(params: {
  selectionFact: LiuyaoUsefulGodSelectionFact;
  targetReferences: LiuyaoYaoReference[];
  referenceGroups: LiuyaoReferenceGroups;
  usefulElement: string;
  sourceElement: string;
  tabooElement: string;
  enemyElement: string;
}): LiuyaoGodInteractionFact[] {
  const {
    selectionFact,
    targetReferences,
    referenceGroups,
    usefulElement,
    sourceElement,
    tabooElement,
    enemyElement,
  } = params;
  if (selectionFact.status !== '已选定候选' || !targetReferences.length) return [];

  const facts = new Map<string, LiuyaoGodInteractionFact>();
  const roleOf = (reference: LiuyaoYaoReference) =>
    getGodInteractionRole({
      wuxing: reference.wuxing,
      usefulElement,
      sourceElement,
      tabooElement,
      enemyElement,
    });
  const addFact = (
    kind: LiuyaoGodInteractionKind,
    target: LiuyaoYaoReference,
    pathEntries: Array<{
      reference: LiuyaoYaoReference;
      relationToNext: LiuyaoGodInteractionRelation | null;
    }>,
    conditions: string[],
  ) => {
    const normalizedConditions = uniqueStrings(conditions);
    const referenceKeys = pathEntries.map((item) => item.reference.key);
    const identity = `${kind}|${referenceKeys.join('>')}|${normalizedConditions.join('|')}`;
    if (facts.has(identity)) return;
    const path = pathEntries.map(({ reference, relationToNext }): LiuyaoGodInteractionPathStep => ({
      referenceKey: reference.key,
      role: roleOf(reference),
      activity: getGodReferenceActivity(reference),
      wuxing: reference.wuxing,
      relationToNext,
    }));
    const pathText = pathEntries
      .map(
        ({ reference, relationToNext }) =>
          `${formatYao(reference)}（${getGodReferenceActivity(reference)}）${relationToNext ? `${relationToNext}→` : ''}`,
      )
      .join('');
    facts.set(identity, {
      key: `liuyao:god-interaction:${facts.size + 1}`,
      kind,
      status: '关系路径已闭合',
      targetReferenceKey: target.key,
      referenceKeys,
      path,
      conditions: normalizedConditions,
      promptText: `${kind}：${pathText}；依据${normalizedConditions.join('、')}；只登记可复核路径，不按路径数量裁定最终强弱或吉凶`,
      sources: [
        '《增删卜易·五行相生章、五行相克章、克处逢生章、动静生克章、月将章、日辰章》',
        '《卜筮正宗·碎金赋生克制化注、原忌仇神论》',
        '当前月日、真实明暗动、旺相静爻、本位动变及飞伏生克重算',
      ],
      limitation: GOD_INTERACTION_FACT_LIMITATION,
    });
  };

  for (const target of targetReferences) {
    if (target.source === '月建' || target.source === '日辰') {
      addFact(
        '月日直接入用',
        target,
        [{ reference: target, relationToNext: null }],
        [`${target.source}直接充当用神五行`],
      );
      continue;
    }

    const directEdges = buildDirectInfluenceEdges(target, referenceGroups);
    for (const edge of directEdges) {
      addFact(
        edge.relation === '克' ? '直接克制用神' : '直接生扶用神',
        target,
        [
          { reference: edge.actor, relationToNext: edge.relation },
          { reference: target, relationToNext: null },
        ],
        [edge.condition],
      );
    }

    for (const directEdge of directEdges) {
      const directActorRole = roleOf(directEdge.actor);
      if (directActorRole === '原神' && directEdge.relation === '生') {
        for (const incomingEdge of buildDirectInfluenceEdges(directEdge.actor, referenceGroups)) {
          const incomingRole = roleOf(incomingEdge.actor);
          const isContinuousGeneration =
            incomingEdge.relation === '生' &&
            incomingRole === '忌神' &&
            isGodReferenceMoving(incomingEdge.actor) &&
            isGodReferenceMoving(directEdge.actor);
          addFact(
            isContinuousGeneration
              ? '忌原接续相生'
              : incomingEdge.relation === '克'
                ? '克制原神'
                : '生扶原神',
            target,
            [
              { reference: incomingEdge.actor, relationToNext: incomingEdge.relation },
              { reference: directEdge.actor, relationToNext: '生' },
              { reference: target, relationToNext: null },
            ],
            [incomingEdge.condition, directEdge.condition],
          );
        }
      }

      if (directActorRole === '忌神' && directEdge.relation === '克') {
        for (const incomingEdge of buildDirectInfluenceEdges(directEdge.actor, referenceGroups)) {
          addFact(
            incomingEdge.relation === '克' ? '克制忌神' : '生扶忌神',
            target,
            [
              { reference: incomingEdge.actor, relationToNext: incomingEdge.relation },
              { reference: directEdge.actor, relationToNext: '克' },
              { reference: target, relationToNext: null },
            ],
            [incomingEdge.condition, directEdge.condition],
          );
        }
      }
    }
  }

  return Array.from(facts.values());
}

function buildGodInteractionAssessmentFact(params: {
  selectionFact: LiuyaoUsefulGodSelectionFact;
  godChain: LiuyaoGodChainItem[];
  godInteractionFacts: LiuyaoGodInteractionFact[];
}): LiuyaoGodInteractionAssessmentFact {
  const { selectionFact, godChain, godInteractionFacts } = params;
  const supportingKinds = new Set<LiuyaoGodInteractionKind>([
    '直接生扶用神',
    '忌原接续相生',
    '生扶原神',
    '克制忌神',
  ]);
  const restrainingKinds = new Set<LiuyaoGodInteractionKind>([
    '直接克制用神',
    '克制原神',
    '生扶忌神',
  ]);
  const transformationKinds = new Set<LiuyaoGodInteractionKind>([
    '忌原接续相生',
    '生扶原神',
    '克制原神',
    '生扶忌神',
    '克制忌神',
  ]);
  const supportingFacts = godInteractionFacts.filter((item) => supportingKinds.has(item.kind));
  const restrainingFacts = godInteractionFacts.filter((item) => restrainingKinds.has(item.kind));
  const transformationFacts = godInteractionFacts.filter((item) =>
    transformationKinds.has(item.kind),
  );
  const calendarIngressFacts = godInteractionFacts.filter((item) => item.kind === '月日直接入用');
  const usefulGod = godChain.find((item) => item.role === '用神');
  const usefulGodEffectStatus = usefulGod?.effectStatus ?? '资料不足';
  const selected = selectionFact.status === '已选定候选';
  const balanceStatus: LiuyaoGodInteractionBalanceStatus = !selected
    ? '用神未定'
    : supportingFacts.length && restrainingFacts.length
      ? '生扶克制并见'
      : supportingFacts.length
        ? '仅见生扶路径'
        : restrainingFacts.length
          ? '仅见克制路径'
          : calendarIngressFacts.length
            ? '月日直接入用'
            : '未见生克路径';
  const status: LiuyaoGodInteractionAssessmentFact['status'] = selected ? '待综合判断' : '资料不足';
  const supportingFactKeys = supportingFacts.map((item) => item.key);
  const restrainingFactKeys = restrainingFacts.map((item) => item.key);
  const transformationFactKeys = transformationFacts.map((item) => item.key);
  const unresolvedFactKeys = uniqueStrings([
    ...transformationFactKeys,
    ...(supportingFacts.length && restrainingFacts.length
      ? [...supportingFactKeys, ...restrainingFactKeys]
      : []),
    ...(usefulGodEffectStatus === '有力无力条件并见'
      ? (usefulGod?.effectFacts.map((item) => item.key) ?? [])
      : []),
  ]);
  const conditions = selected
    ? [
        `全局作用态：${balanceStatus}`,
        `用神有气无根条件状态：${usefulGodEffectStatus}`,
        supportingFacts.length
          ? `生扶侧见${uniqueStrings(supportingFacts.map((item) => item.kind)).join('、')}`
          : '生扶侧未见已闭合路径',
        restrainingFacts.length
          ? `克制侧见${uniqueStrings(restrainingFacts.map((item) => item.kind)).join('、')}`
          : '克制侧未见已闭合路径',
        transformationFacts.length
          ? `制化侧见${uniqueStrings(transformationFacts.map((item) => item.kind)).join('、')}，须先逐项消解`
          : '制化侧未见已闭合路径',
      ]
    : [`用神选择状态：${selectionFact.status}`];

  return {
    key: 'liuyao:god-interaction-assessment',
    status,
    balanceStatus,
    usefulGodEffectStatus,
    supportingFactKeys,
    restrainingFactKeys,
    transformationFactKeys,
    unresolvedFactKeys,
    conditions,
    promptText: `全局生克作用态${balanceStatus}；用神条件状态${usefulGodEffectStatus}；可用性${status}；${conditions.slice(2).join('；') || conditions[0]}；不按路径条数或多数票裁定最终可用性与现实吉凶`,
    sources: [
      '《增删卜易·用神章、月将章、日辰章》四处生克、旺衰与寡不敌众规则',
      '《增删卜易·黄金策总断千金赋》贪生贪合规则',
      '《卜筮正宗·碎金赋生克制化注、原忌仇神论》',
      '当前用神有气无根条件与生克制化路径分类汇总',
    ],
    limitation: GOD_INTERACTION_ASSESSMENT_FACT_LIMITATION,
  };
}

function formatTimingReference(reference: LiuyaoYaoReference) {
  if (reference.source === '月建' || reference.source === '日辰') {
    return `${reference.source}${formatNaJia(reference.stem, reference.branch)}${reference.sixRelative}${reference.wuxing}`;
  }
  return `${reference.source}第${reference.position}爻${reference.sixRelative}${formatNaJia(reference.stem, reference.branch)}${reference.wuxing}`;
}

function hasTimingCondition(reference: LiuyaoYaoReference, pattern: RegExp) {
  return [...reference.support, ...reference.constraints].some((item) => pattern.test(item));
}

function isTimingReferenceActive(reference: LiuyaoYaoReference) {
  return Boolean(
    reference.source === '本卦' &&
    (reference.isChanging || reference.strengthAnalysis?.selfSupport.includes('暗动')),
  );
}

function hasMaterialTimingConstraint(reference: LiuyaoYaoReference) {
  return (
    reference.isVoid ||
    hasTimingCondition(
      reference,
      /空|月破|日破|日辰冲本爻|墓|绝|回头克|回头冲|化退|伏藏待透|飞来克伏/,
    )
  );
}

function hasTabooWeakeningCondition(reference: LiuyaoYaoReference) {
  return (
    reference.isVoid ||
    hasTimingCondition(reference, /空|月破|日破|墓|绝|回头克|化退|化泄|化耗|飞来克伏/)
  );
}

function buildUsefulOrSourceTimingConditions(
  role: '用神' | '原神',
  references: LiuyaoYaoReference[],
) {
  const conditions: string[] = [];
  for (const reference of references) {
    const label = formatTimingReference(reference);
    const roleCondition = role === '原神' ? '能实际生到用神' : '本爻有气或得生扶';
    const active = isTimingReferenceActive(reference);
    if (reference.source === '月建' || reference.source === '日辰') {
      conditions.push(
        `${label}仅是${role}由月日入用的时令事实，不能冒充卦内爻位，也不直接拿当前月日机械定期`,
      );
      continue;
    }
    if (reference.source === '变爻') {
      conditions.push(
        `${label}只在变爻显出，须由本位原爻发动及变爻状态共同验证，不直接套原爻或变爻地支为日期`,
      );
    }
    if (reference.source === '伏神') {
      conditions.push(
        `${label}伏藏；仅在伏神有用、飞神确实松动时，才候透出、飞神受冲克或伏神得生，不能见伏神便固定取透出日`,
      );
    }
    if (active) {
      conditions.push(
        `${label}发动；传统可候值、合或变爻触发，但须先排除合住、空破与回头克等当前之病，不直接按动爻位置定期`,
      );
    } else if (role === '用神' && reference.source === '本卦') {
      conditions.push(
        `${label}安静；${roleCondition}时才可把逢值或日冲视为候选触发，衰静受日冲可能成日破，不能见冲即定期`,
      );
    }
    if (reference.isVoid || hasTimingCondition(reference, /本爻空亡|伏神旬空/)) {
      conditions.push(
        `${label}见空；仅在${roleCondition}、空亡确为当前之病时，才候出空或受日辰冲实；若填实后反受克，不作有利应期`,
      );
    }
    if (hasTimingCondition(reference, /化空|变爻空亡/)) {
      conditions.push(
        `${label}本位变爻见空；化空须与回头生克冲、进退等基础动变并看，只有它确为当前之病时才候变爻出空或冲实`,
      );
    }
    if (hasTimingCondition(reference, /月破/)) {
      conditions.push(
        `${label}见月破；动而有用或得生扶者可候出破、填实或合破，静衰且受克者不能只凭填实硬断`,
      );
    }
    if (hasTimingCondition(reference, /日破|日辰冲本爻/)) {
      conditions.push(
        `${label}受日冲；须先分旺相静爻暗动、衰静日破或动爻受冲，不把日冲统一解释成冲实或冲散`,
      );
    }
    if (hasTimingCondition(reference, /墓/)) {
      conditions.push(
        `${label}见墓；只有墓确成${role}当前之病时才候冲墓，仍须并看旺衰、生克与是否随墓`,
      );
    }
    if (hasTimingCondition(reference, /绝/)) {
      conditions.push(
        `${label}见绝；须先核验是否得生扶及${roleCondition}，不能只按长生支序补出唯一日期`,
      );
    }
    if (hasTimingCondition(reference, /回头克/)) {
      conditions.push(
        `${label}受回头克；若这是${role}当前关键受制，可候冲去克神或其他动爻制化克神，并确认其确能解除`,
      );
    }
    if (hasTimingCondition(reference, /回头冲/)) {
      conditions.push(
        `${label}见回头冲；须结合五行生克以及冲中逢合、合处逢冲再辨，不单凭相冲定吉凶或日期`,
      );
    }
    if (hasTimingCondition(reference, /化退神/)) {
      conditions.push(
        `${label}化退神；近事得旺相生扶可能暂不退，衰时或空破填实后才可能应退，不按地支先后固定取期`,
      );
    }
    if (hasTimingCondition(reference, /化进神/)) {
      conditions.push(`${label}化进神；须辨旺相即进、待旺而进或空破填实后进，不固定套逢值逢合`);
    }
    if (
      active &&
      (reference.strengthAnalysis?.calendarConstraints.some((item) =>
        /^(?:月建|日辰)合绊本爻$/.test(item),
      ) ??
        false)
    ) {
      conditions.push(
        `${label}发动而被月日合绊；若合绊确为当前之病，可候冲开，仍须结合用神有气、冲中逢合与其他生克，不把冲开一律写成有利`,
      );
    }
  }
  return Array.from(new Set(conditions));
}

function buildTabooTimingConditions(references: LiuyaoYaoReference[]) {
  const conditions: string[] = [];
  for (const reference of references) {
    const label = formatTimingReference(reference);
    const active = isTimingReferenceActive(reference);
    const restrained = hasTabooWeakeningCondition(reference);
    if (reference.source === '月建' || reference.source === '日辰') {
      conditions.push(
        `${label}临月日只说明忌神五行得时，仍须确认其能否实际克到用神，不能按当前月日直接断凶或定期`,
      );
      continue;
    }
    if (active) {
      conditions.push(
        `${label}发动；仅在其确能克到用神时才构成当前之病，可候制忌、冲去克神或扶起用神，不能把忌神发动日直接当应期`,
      );
    }
    if (restrained) {
      conditions.push(
        `${label}自身见空破墓绝、回头克、化泄耗或化退等削弱条件；这可能减轻其克用，出空填实、冲墓或得生反可能恢复为忌，不得把解除忌神限制一律当有利应期`,
      );
    }
    if (hasTimingCondition(reference, /回头冲|日辰冲本爻/)) {
      conditions.push(
        `${label}受冲；须结合旺衰、动静、五行生克及冲中逢合辨明是冲动、冲实还是受损，不能先把相冲当作制住忌神`,
      );
    }
    if (
      active &&
      (reference.strengthAnalysis?.calendarConstraints.some((item) =>
        /^(?:月建|日辰)合绊本爻$/.test(item),
      ) ??
        false)
    ) {
      conditions.push(
        `${label}发动而被月日合住；合住可能暂缓克用，后逢冲开反可能成病，不能把冲开一律当作有利触发`,
      );
    }
    if (hasTimingCondition(reference, /月令旺|月建生本爻|日辰生本爻|回头生|化进神/) && !active) {
      conditions.push(
        `${label}见旺相、生扶或化进条件；只有忌神实际被引动并克用时才作为病，不因单项得力直接补造日期`,
      );
    }
  }
  return Array.from(new Set(conditions));
}

function buildRoleTimingFact(
  role: '用神' | '原神' | '忌神',
  chainItem: LiuyaoGodChainItem | undefined,
  selectionFact: LiuyaoUsefulGodSelectionFact,
): LiuyaoTimingFact | null {
  if (!chainItem?.references.length) return null;
  const conditions =
    role === '忌神'
      ? buildTabooTimingConditions(chainItem.references)
      : buildUsefulOrSourceTimingConditions(role, chainItem.references);
  if (!conditions.length) return null;
  const hasConstraint = chainItem.references.some(hasMaterialTimingConstraint);
  const type: LiuyaoTimingFact['type'] =
    role === '忌神'
      ? '忌神制化'
      : role === '原神'
        ? '原神病药'
        : chainItem.references.some((item) => item.source === '伏神')
          ? '伏神透出'
          : '用神病药';
  const effect: LiuyaoTimingFact['effect'] =
    role === '忌神' ? '制忌待辨' : hasConstraint ? '受制待解' : '助用待验';
  return {
    key: `liuyao:timing:role:${role}`,
    type,
    sourceStatus: '由盘面生成',
    role,
    effect,
    ownerFactKeys: Array.from(
      new Set([
        selectionFact.key,
        chainItem.key,
        ...chainItem.references
          .filter((item) => item.source !== '月建' && item.source !== '日辰')
          .map((item) => item.factKey),
      ]),
    ),
    referenceKeys: chainItem.referenceKeys,
    promptText: `${role}${role === '忌神' ? '制化辨向' : '病药条件'}：${conditions.join('；')}`,
    sources: [
      '《增删卜易·元神忌神衰旺章、日辰章、进神退神章、各门类应期总注》',
      `当前${role}作用链对应爻、月日与动变条件`,
    ],
    limitation: TIMING_FACT_LIMITATION,
  };
}

function buildMovingTimingFact(
  lineFacts: LiuyaoLineFact[],
  godChain: LiuyaoGodChainItem[],
  selectionFact: LiuyaoUsefulGodSelectionFact,
): LiuyaoTimingFact | null {
  const moving = lineFacts.filter((item) => item.activity === '明动');
  if (!moving.length) return null;
  const detail = moving.map((item) => {
    const referenceKey = `liuyao:reference:line:${item.position}`;
    const roles = godChain
      .filter((chainItem) => chainItem.referenceKeys.includes(referenceKey))
      .map((chainItem) => chainItem.role);
    const roleText =
      selectionFact.status === '已选定候选'
        ? roles.length
          ? `，作用链角色${roles.join('、')}`
          : '，作用链外仅作变化点'
        : '，用神爻位尚未闭合，仅作变化点';
    return `第${item.position}爻${item.sixRelative}${formatNaJia(item.najia.stem, item.najia.branch)}发动${item.changedYao ? `化${item.changedYao.sixRelative}${formatNaJia(item.changedYao.stem, item.changedYao.branch)}` : ''}${roleText}`;
  });
  return {
    key: 'liuyao:timing:changing-lines',
    type: '动爻触发',
    sourceStatus: '由盘面生成',
    role: selectionFact.status === '已选定候选' ? '整卦' : '未定',
    effect: '变化点待回扣',
    ownerFactKeys: moving.map((item) => item.key),
    referenceKeys: moving.map((item) => `liuyao:reference:line:${item.position}`),
    promptText: `动爻作用：${detail.join('；')}；动爻只表示变化来源，须按用神、原神、忌神角色及实际生克回扣，不凭爻位或动爻数量定应期`,
    sources: ['当前逐爻明动、本位变爻与用原忌作用链对应关系'],
    limitation: TIMING_FACT_LIMITATION,
  };
}

function buildGenerationFact(data: LiuyaoData): LiuyaoGenerationFact {
  const method = data.generation?.method ?? '未记录';
  const generationSource = data.generation?.source;
  const hasRandomTrace = data.meta?.random !== undefined;
  const methodLabel =
    method === 'coins'
      ? generationSource === 'provided-coin-throws' || (!generationSource && !hasRandomTrace)
        ? '逐爻三钱记录'
        : '模拟三钱起卦'
      : method === 'manual'
        ? '手工录入六爻值'
        : method === 'time'
          ? '时间种子模拟三钱'
          : '旧结果未记录起卦方式';
  const coinThrows = (data.generation?.coinThrows ?? []).map((item) => ({
    coins: [...item.coins] as [2 | 3, 2 | 3, 2 | 3],
    total: item.total,
  }));
  const recordedLineCount = method === 'manual' ? data.yaoArray.length : coinThrows.length;
  const status =
    method !== '未记录' && recordedLineCount === 6 ? ('可核验' as const) : ('来源链缺失' as const);
  const detail =
    method === 'manual'
      ? `手工爻值为${data.yaoArray.join('、') || '未列'}`
      : coinThrows.length
        ? coinThrows
            .map(
              (item, index) =>
                `第${index + 1}爻计算样本${item.coins.join('+')}=${item.total}（${item.total === 6 ? '老阴' : item.total === 7 ? '少阳' : item.total === 8 ? '少阴' : '老阳'}）`,
            )
            .join('；')
        : '未附逐爻生成记录';
  return {
    key: `generation:liuyao:${method}`,
    status,
    method,
    methodLabel,
    yaoValues: [...data.yaoArray],
    coinThrows,
    expectedLineCount: 6,
    recordedLineCount,
    promptText: `起卦方式为${methodLabel}；${detail}${status === '来源链缺失' ? `；当前仅记录${recordedLineCount}/6爻来源，不能完整核验起卦链` : ''}`,
    sources: [
      method === 'manual'
        ? '调用方手工录入的六个爻值'
        : generationSource === 'provided-coin-throws'
          ? '调用方提供的逐爻三钱记录'
          : generationSource === 'time-seeded-coin-simulation' || method === 'time'
            ? '以起卦时间戳固定随机种子的逐爻三钱模拟记录'
            : '程序逐爻模拟的三钱记录',
      '六爻起卦方式与原始爻值结果',
    ],
    limitation: GENERATION_FACT_LIMITATION,
  };
}

function buildVisibleReference(
  yao: LiuyaoYaoDetail,
  monthBranch: string,
  dayBranch: string,
  yaosDetail: LiuyaoYaoDetail[],
): LiuyaoYaoReference {
  const changeRelations = getChangeRelations(yao);
  const strengthAnalysis = analyzeLiuyaoLineStrength(yao, monthBranch, dayBranch, yaosDetail);
  return {
    key: `liuyao:reference:line:${yao.position}`,
    factKey: `本卦:第${yao.position}爻`,
    source: '本卦',
    status: '已匹配',
    position: yao.position,
    sixRelative: yao.sixRelative,
    stem: yao.najiaTiangan,
    branch: yao.najiaDizhi,
    wuxing: yao.wuxing,
    isWorld: yao.isWorld,
    isResponse: yao.isResponse,
    isChanging: yao.isChanging,
    isVoid: yao.isVoid,
    strengthAnalysis,
    support: strengthAnalysis.support,
    constraints: strengthAnalysis.constraints,
    ...(yao.changedYao
      ? {
          changedYao: {
            sixRelative: yao.changedYao.liuqin,
            stem: yao.changedYao.tiangan,
            branch: yao.changedYao.dizhi,
            wuxing: yao.changedYao.wuxing,
            isVoid: yao.changedYao.isVoid,
            relation: yao.changedYao.isVoid ? '化空' : (changeRelations[0] ?? null),
            relations: changeRelations,
            direction: getLiuyaoChangeDirection(yao.najiaDizhi, yao.changedYao.dizhi),
          },
        }
      : {}),
  };
}

function buildHiddenReference(
  spirit: LiuyaoHiddenSpirit,
  conditionAnalysis: LiuyaoHiddenSpiritConditionAnalysis,
): LiuyaoYaoReference {
  return {
    key: `liuyao:reference:hidden:${spirit.position}:${spirit.sixRelative}`,
    factKey: `伏神:第${spirit.position}爻:${spirit.sixRelative}`,
    source: '伏神',
    status: '已匹配',
    position: spirit.position,
    sixRelative: spirit.sixRelative,
    stem: spirit.najiaTiangan,
    branch: spirit.najiaDizhi,
    wuxing: spirit.wuxing,
    isVoid: spirit.isVoid,
    support: conditionAnalysis.support,
    constraints: ['伏藏待透', ...conditionAnalysis.constraints],
  };
}

function buildChangedReference(yao: LiuyaoYaoDetail): LiuyaoYaoReference | null {
  if (!yao.isChanging || !yao.changedYao) return null;
  return {
    key: `liuyao:reference:changed:${yao.position}`,
    factKey: `本卦:第${yao.position}爻`,
    source: '变爻',
    status: '已匹配',
    position: yao.position,
    sixRelative: yao.changedYao.liuqin,
    stem: yao.changedYao.tiangan,
    branch: yao.changedYao.dizhi,
    wuxing: yao.changedYao.wuxing,
    isChanging: true,
    isVoid: yao.changedYao.isVoid,
    support: ['变爻显出'],
    constraints: yao.changedYao.isVoid ? ['变爻空亡'] : [],
  };
}

function buildCalendarReference(
  data: LiuyaoData,
  source: '月建' | '日辰',
  ganzhi: string,
): LiuyaoYaoReference {
  const branch = branchOf(ganzhi);
  const wuxing = getBranchWuxing(branch);
  const relationMap = liuqinRelations[data.palace.wuxing as keyof typeof liuqinRelations] as
    Record<string, string> | undefined;
  const relative = relationMap?.[wuxing];
  if (!relative) {
    throw new Error(`${source}${ganzhi}无法按${data.palace?.name ?? '未知'}宫五行确定六亲。`);
  }
  return {
    key: `liuyao:reference:calendar:${source}`,
    factKey: `liuyao:calendar:${source}`,
    source,
    status: '已匹配',
    sixRelative: relative,
    stem: ganzhi.slice(0, 1),
    branch,
    wuxing,
    isVoid: false,
    support: [`${source}入用`],
    constraints: [],
  };
}

interface LiuyaoReferenceGroups {
  visible: LiuyaoYaoReference[];
  changed: LiuyaoYaoReference[];
  calendar: LiuyaoYaoReference[];
  hidden: LiuyaoYaoReference[];
}

function buildReferenceGroups(
  data: LiuyaoData,
  monthBranch: string,
  dayBranch: string,
): LiuyaoReferenceGroups {
  const visible = data.yaosDetail.map((yao) =>
    buildVisibleReference(yao, monthBranch, dayBranch, data.yaosDetail),
  );
  const changed = data.yaosDetail
    .map(buildChangedReference)
    .filter((item): item is LiuyaoYaoReference => Boolean(item));
  const calendar = [
    buildCalendarReference(data, '月建', data.ganzhi.month),
    buildCalendarReference(data, '日辰', data.ganzhi.day),
  ];
  const hidden = (data.hiddenSpirits ?? []).map((spirit) =>
    buildHiddenReference(
      spirit,
      analyzeLiuyaoHiddenSpiritConditions(spirit, monthBranch, dayBranch, data.yaosDetail),
    ),
  );
  return {
    visible,
    changed,
    calendar,
    hidden,
  };
}

function buildLineFacts(
  data: LiuyaoData,
  monthBranch: string,
  dayBranch: string,
): LiuyaoLineFact[] {
  const sixGods = getSixAnimals(data.ganzhi.day.slice(0, 1));
  return data.yaosDetail.map((yao) => {
    const sixGod = sixGods[yao.position - 1];
    if (!sixGod) {
      throw new Error(`六爻第${yao.position}爻六神重算失败。`);
    }
    const reference = buildVisibleReference(yao, monthBranch, dayBranch, data.yaosDetail);
    const strengthAnalysis = reference.strengthAnalysis;
    if (!strengthAnalysis) {
      throw new Error(`六爻第${yao.position}爻综合旺衰条件重算失败。`);
    }
    const roles: LiuyaoLineFact['roles'] = [
      ...(yao.isWorld ? (['世爻'] as const) : []),
      ...(yao.isResponse ? (['应爻'] as const) : []),
    ];
    const activity: LiuyaoLineFact['activity'] = yao.isChanging
      ? '明动'
      : strengthAnalysis.selfSupport.includes('暗动')
        ? '暗动'
        : '静爻';
    const monthRelations = [
      yao.najiaDizhi === monthBranch ? '值月建' : '',
      isLiuhe(yao.najiaDizhi, monthBranch)
        ? activity === '静爻'
          ? '静爻逢月建合起'
          : '月建合绊'
        : '',
      isLiuchong(yao.najiaDizhi, monthBranch) ? '月破' : '',
      strengthAnalysis.monthStage === '墓' ? '入月墓' : '',
      isLiuhai(yao.najiaDizhi, monthBranch) ? '与月建相害' : '',
      isSanxing(yao.najiaDizhi, monthBranch) ? '与月建有三刑支关系' : '',
    ].filter(Boolean);
    const dayRelations = [
      yao.najiaDizhi === dayBranch ? '值日辰' : '',
      isLiuhe(yao.najiaDizhi, dayBranch)
        ? activity === '静爻'
          ? '静爻逢日辰合起'
          : '日辰合绊'
        : '',
      strengthAnalysis.selfSupport.includes('暗动')
        ? '日冲暗动'
        : strengthAnalysis.calendarConstraints.includes('日破')
          ? '日冲成破'
          : isLiuchong(yao.najiaDizhi, dayBranch)
            ? '与日辰相冲'
            : '',
      strengthAnalysis.dayStage === '墓' ? '入日墓' : '',
      isLiuhai(yao.najiaDizhi, dayBranch) ? '与日辰相害' : '',
      isSanxing(yao.najiaDizhi, dayBranch) ? '与日辰有三刑支关系' : '',
    ].filter(Boolean);
    const changeRelations = getChangeRelations(yao);
    const changedYao = yao.changedYao
      ? {
          sixRelative: yao.changedYao.liuqin,
          stem: yao.changedYao.tiangan,
          branch: yao.changedYao.dizhi,
          wuxing: yao.changedYao.wuxing,
          isVoid: yao.changedYao.isVoid,
          relation: yao.changedYao.isVoid ? '化空' : (changeRelations[0] ?? null),
          relations: changeRelations,
          direction: getLiuyaoChangeDirection(yao.najiaDizhi, yao.changedYao.dizhi),
        }
      : undefined;
    const promptText = [
      `第${yao.position}爻${yao.sixRelative}${formatNaJia(yao.najiaTiangan, yao.najiaDizhi)}${yao.wuxing}`,
      `六神${sixGod}`,
      roles.length ? roles.join('、') : '',
      activity,
      `月令${strengthAnalysis.seasonState}`,
      monthRelations.join('、'),
      dayRelations.join('、'),
      yao.isVoid ? '本爻空亡' : '',
      changedYao
        ? `化${changedYao.sixRelative}${formatNaJia(changedYao.stem, changedYao.branch)}${changedYao.wuxing}${changedYao.direction ? `、${changedYao.direction}` : ''}${changedYao.relations.length ? `、${changedYao.relations.join('、')}` : changedYao.isVoid ? '、变爻空亡' : ''}`
        : '',
      `综合旺衰条件${strengthAnalysis.status}`,
      `支持${strengthAnalysis.support.join('、') || '未见'}`,
      `限制${strengthAnalysis.constraints.join('、') || '未见'}`,
    ]
      .filter(Boolean)
      .join('；');
    return {
      key: `本卦:第${yao.position}爻`,
      status: '已计算',
      position: yao.position,
      rawValue: yao.rawValue,
      yaoType: yao.yaoType,
      changeType: yao.changeType,
      sixGod,
      sixRelative: yao.sixRelative,
      najia: { stem: yao.najiaTiangan, branch: yao.najiaDizhi, wuxing: yao.wuxing },
      roles,
      activity,
      monthState: {
        branch: monthBranch,
        seasonState: strengthAnalysis.seasonState,
        relations: monthRelations,
      },
      dayState: { branch: dayBranch, relations: dayRelations },
      traditionalRelations: {
        sanxingType:
          isSanxing(yao.najiaDizhi, monthBranch) || isSanxing(yao.najiaDizhi, dayBranch)
            ? (getSanxingType(yao.najiaDizhi) ?? undefined)
            : undefined,
        liuhePartner: isLiuhe(yao.najiaDizhi, dayBranch)
          ? dayBranch
          : isLiuhe(yao.najiaDizhi, monthBranch)
            ? monthBranch
            : undefined,
        isLiuhai: isLiuhai(yao.najiaDizhi, monthBranch) || isLiuhai(yao.najiaDizhi, dayBranch),
        isRuMu: Boolean(yao.isRuMu),
      },
      isVoid: yao.isVoid,
      strengthAnalysis,
      support: reference.support,
      constraints: reference.constraints,
      ...(changedYao ? { changedYao } : {}),
      promptText,
      sources: [
        '京房八宫纳甲与六亲排布',
        '日干起六神与八宫安世应',
        '起卦月建、日辰、旬空、其他爻作用与本位动变计算',
      ],
      limitation: LINE_FACT_LIMITATION,
    };
  });
}

function buildHiddenSpiritFacts(data: LiuyaoData): LiuyaoHiddenSpiritFact[] {
  const monthBranch = data.ganzhi.month.slice(1);
  const dayBranch = data.ganzhi.day.slice(1);
  return (data.hiddenSpirits ?? []).map((spirit) => {
    const conditionAnalysis = analyzeLiuyaoHiddenSpiritConditions(
      spirit,
      monthBranch,
      dayBranch,
      data.yaosDetail,
    );
    const reference = buildHiddenReference(spirit, conditionAnalysis);
    return {
      key: `伏神:第${spirit.position}爻:${spirit.sixRelative}`,
      status: '已计算',
      position: spirit.position,
      sixRelative: spirit.sixRelative,
      najia: {
        stem: spirit.najiaTiangan,
        branch: spirit.najiaDizhi,
        wuxing: spirit.wuxing,
      },
      isVoid: spirit.isVoid,
      coveringLine: spirit.underYao,
      conditionAnalysis,
      support: reference.support,
      constraints: reference.constraints,
      promptText: `第${spirit.position}爻伏神${spirit.sixRelative}${formatNaJia(spirit.najiaTiangan, spirit.najiaDizhi)}${spirit.wuxing}，飞神${spirit.underYao.sixRelative}${formatNaJia(spirit.underYao.najiaTiangan, spirit.underYao.najiaDizhi)}${spirit.underYao.wuxing}；飞伏关系${conditionAnalysis.flyingRelation}；支持${conditionAnalysis.support.join('、') || '未见明确得助或飞神松动条件'}；限制${conditionAnalysis.constraints.join('、') || '未见明确衰空破墓绝或飞克条件'}`,
      sources: [
        '本宫首卦六亲全集与当前本卦六亲差集',
        '《增删卜易·飞伏神章》飞伏生克与有用无用条件',
        '当前月建、日辰、动爻、旬空、月破、旺衰、墓绝逐项计算',
      ],
      limitation: HIDDEN_SPIRIT_FACT_LIMITATION,
    };
  });
}

function buildLineCoverageFact(lineFacts: LiuyaoLineFact[]): LiuyaoLineCoverageFact {
  const expectedPositions = [1, 2, 3, 4, 5, 6];
  const rawPositions = lineFacts.map((item) => item.position);
  const actualPositions = [...new Set(rawPositions)].sort((left, right) => left - right);
  const missingPositions = expectedPositions.filter(
    (position) => !actualPositions.includes(position),
  );
  const duplicatePositions = actualPositions.filter(
    (position) => rawPositions.filter((item) => item === position).length > 1,
  );
  const invalidPositions = actualPositions.filter(
    (position) => !Number.isInteger(position) || position < 1 || position > 6,
  );
  const status: LiuyaoLineCoverageFact['status'] =
    duplicatePositions.length || invalidPositions.length
      ? '爻位异常'
      : missingPositions.length
        ? '缺少爻位'
        : '完整';
  return {
    key: 'liuyao:line-coverage',
    status,
    expectedPositions,
    actualPositions,
    missingPositions,
    duplicatePositions,
    invalidPositions,
    lineFactKeys: lineFacts.map((item) => item.key),
    promptText:
      status === '完整'
        ? '六爻资料完整覆盖初爻至上爻，可逐爻核验'
        : status === '缺少爻位'
          ? `六爻资料缺少第${missingPositions.join('、')}爻，不得补造缺失爻内容`
          : `六爻位置异常：重复${duplicatePositions.join('、') || '无'}；越界${invalidPositions.join('、') || '无'}`,
    sources: ['当前逐爻详情的位置、数量与唯一性核验'],
    limitation: LINE_COVERAGE_FACT_LIMITATION,
  };
}

function buildHiddenSpiritCoverageFact(
  data: LiuyaoData,
  hiddenSpiritFacts: LiuyaoHiddenSpiritFact[],
): LiuyaoHiddenSpiritCoverageFact {
  const status: LiuyaoHiddenSpiritCoverageFact['status'] = Array.isArray(data.hiddenSpirits)
    ? hiddenSpiritFacts.length
      ? '有伏神'
      : '无伏神'
    : '字段缺失';
  return {
    key: 'liuyao:hidden-spirit-coverage',
    status,
    hiddenSpiritFactKeys: hiddenSpiritFacts.map((item) => item.key),
    promptText:
      status === '有伏神'
        ? `当前记录${hiddenSpiritFacts.length}条伏神与飞神配对事实`
        : status === '无伏神'
          ? '当前结果明确记录伏神数组为空，不补造伏神'
          : '旧结果未提供伏神字段，不能据此断定无伏神，也不得反推伏神位置',
    sources: ['当前伏神字段存在性与伏神事实数量核验'],
    limitation: HIDDEN_SPIRIT_COVERAGE_FACT_LIMITATION,
  };
}

function getSanheGodRole(
  element: string,
  usefulElement: string,
): { role: LiuyaoSanheGodRole; description: string } {
  if (!usefulElement) {
    return {
      role: '用神未定',
      description: '当前用神五行未定，不判原神、用神、忌神或仇神方向',
    };
  }
  if (element === usefulElement) {
    return { role: '用神局', description: `局五行${element}与当前用神同类，列为用神局结构` };
  }
  if (isSheng(element, usefulElement)) {
    return { role: '原神局', description: `局五行${element}生当前用神，列为原神局结构` };
  }
  if (isKe(element, usefulElement)) {
    return { role: '忌神局', description: `局五行${element}克当前用神，列为忌神局结构` };
  }
  const tabooElement = findControllingElement(usefulElement);
  const sourceElement = findGeneratingElement(usefulElement);
  if (isSheng(element, tabooElement) && isKe(element, sourceElement)) {
    return {
      role: '仇神局',
      description: `局五行${element}生忌神并克原神，列为仇神局结构`,
    };
  }
  return {
    role: '用神所生',
    description: `局五行${element}由当前用神所生，不硬归入原用忌仇四类`,
  };
}

function buildHexagramStructureFacts(
  data: LiuyaoData,
  usefulElement: string,
  monthBranch: string,
  dayBranch: string,
  selectedReferenceKey: string | null,
): LiuyaoHexagramStructureFact[] {
  const facts: LiuyaoHexagramStructureFact[] = [];
  const add = (
    key: string,
    kind: LiuyaoHexagramStructureFact['kind'],
    originalText: string,
    sources: string[],
    structureDetails: Pick<
      LiuyaoHexagramStructureFact,
      | 'sanheFormationKey'
      | 'sanhePattern'
      | 'sanheStatus'
      | 'sanheRole'
      | 'referenceKeys'
      | 'missingBranch'
      | 'activityPattern'
      | 'movingCount'
      | 'movingPositions'
      | 'stillPositions'
      | 'scriptureReference'
      | 'guaShenBranch'
      | 'guaShenStatus'
      | 'guaShenPositions'
    > = {},
  ) => {
    if (!originalText.trim()) return;
    facts.push({
      key,
      kind,
      status: '已计算',
      ...structureDetails,
      originalText,
      promptText: conditionLiuyaoTraditionalText(originalText),
      sources,
      limitation: HEXAGRAM_STRUCTURE_FACT_LIMITATION,
    });
  };
  if (data.hexagramRelations) {
    add(
      'liuyao:structure:hexagram-relation',
      '整卦六合六冲',
      [
        data.hexagramRelations.original ? `主卦${data.hexagramRelations.original}` : '',
        data.hexagramRelations.changed ? `变卦${data.hexagramRelations.changed}` : '',
        data.hexagramRelations.transition ?? '',
        '整卦冲合只定卦体结构，须结合所问事项、用忌神与旺衰辨向',
      ]
        .filter(Boolean)
        .join('；'),
      ['主卦与变卦六支六合、六冲完整性核验'],
    );
  }
  const fanfuRelations = analyzeLiuyaoFanFuRelations(data);
  [...fanfuRelations.fanyin, ...fanfuRelations.fuyin].forEach((item, index) =>
    add(
      `liuyao:structure:fanfu:${index + 1}:${item.kind}:${item.scope}`,
      '反吟伏吟',
      `${item.label}：${item.description}`,
      ['主卦与变卦内外卦纳甲地支反吟伏吟核验'],
    ),
  );
  const activityPattern = analyzeLiuyaoActivityPattern(data.yaoArray, data.originalName);
  add(
    `liuyao:structure:activity:${activityPattern.kind}:${activityPattern.movingCount}`,
    '动静结构',
    `${activityPattern.kind}：${activityPattern.guidance}`,
    [
      '《增删卜易·独发章》独发、独静定义及不得舍用神执结构断事',
      activityPattern.kind === '静卦'
        ? '《卜筮正宗·六爻安静诀》用神、日辰与世应核验'
        : activityPattern.kind === '全动卦'
          ? '《断易天机·六爻俱动类》六爻俱动仍须看用神'
          : activityPattern.kind === '多爻发动'
            ? '《火珠林》与《增删卜易》乱动描述边界核验'
            : '当前原始六爻明动数量与爻位重算',
    ],
    {
      activityPattern: activityPattern.kind,
      movingCount: activityPattern.movingCount,
      movingPositions: activityPattern.movingPositions,
      stillPositions: activityPattern.stillPositions,
      scriptureReference: activityPattern.scriptureReference,
    },
  );
  if (data.yaosDetail.length === 6) {
    const guaShen = analyzeLiuyaoMonthGuaShen(data.yaosDetail);
    const guaShenPositions = guaShen.matches.map((item) => item.position);
    add(
      `liuyao:structure:month-gua-shen:${guaShen.branch}:${guaShen.status}`,
      '月卦身',
      guaShen.status === '入卦'
        ? `月卦身为${guaShen.branch}，入卦于第${guaShenPositions.join('、')}爻；同支多现时保留全部爻位，不按数组顺序只取一爻`
        : `月卦身为${guaShen.branch}，当前六爻无${guaShen.branch}支，登记为不入卦；不入卦不等于没有月卦身，也不直接裁定吉凶`,
      [
        '《卜筮全书·起月卦身诀》阳世从子、阴世从午，自初爻数至世爻',
        '《卜筮全书》六十四卦例中月卦身入卦、不入卦及同支多现记录',
        '当前世爻阴阳、世爻位置与本卦六支重算',
      ],
      {
        guaShenBranch: guaShen.branch,
        guaShenStatus: guaShen.status,
        guaShenPositions,
        referenceKeys: guaShenPositions.map((position) => `liuyao:reference:line:${position}`),
      },
    );
  }
  const sanheFormations =
    data.yaosDetail.length === 6
      ? analyzeLiuyaoSanheFormations(data.yaosDetail, monthBranch, dayBranch)
      : [];
  sanheFormations.forEach((formation, index) => {
    const kind: LiuyaoHexagramStructureFact['kind'] =
      formation.pattern === '日辰补局'
        ? '日辰三合'
        : formation.pattern === '月建补局'
          ? '月建三合'
          : formation.pattern === '虚一待用'
            ? '虚一待用'
            : '卦内三合';
    const godRole = getSanheGodRole(formation.element, usefulElement);
    add(
      `liuyao:structure:sanhe:${index + 1}:${formation.key}`,
      kind,
      `${formation.description}；${godRole.description}；仍须核验世爻是否在局及局对世用的生克`,
      [
        '《增删卜易·六合章》三爻齐动、两动一静、初三四六动变成局与虚一待用',
        '当前本卦、变爻、明动暗动、月日及空破墓逐项核验',
      ],
      {
        sanheFormationKey: formation.key,
        sanhePattern: formation.pattern,
        sanheStatus: formation.status,
        sanheRole: godRole.role,
        referenceKeys: Array.from(
          new Set(
            formation.participants.map(
              (participant) =>
                `liuyao:reference:${participant.source === '本卦' ? 'line' : 'changed'}:${participant.position}`,
            ),
          ),
        ),
        ...(formation.missingBranch ? { missingBranch: formation.missingBranch } : {}),
      },
    );
  });
  const sanxingFormations =
    data.yaosDetail.length === 6
      ? analyzeLiuyaoSanxingFormations(data.yaosDetail, monthBranch, dayBranch)
      : [];
  sanxingFormations.forEach((formation) => {
    const referenceKeys = formation.participants.map(
      (item) => `liuyao:reference:line:${item.position}`,
    );
    const roles = uniqueStrings([
      ...(selectedReferenceKey && referenceKeys.includes(selectedReferenceKey) ? ['当前用神'] : []),
      ...(formation.participants.some((item) => item.isWorld) ? ['世爻'] : []),
      ...(formation.participants.some((item) => item.isResponse) ? ['应爻'] : []),
    ]);
    add(
      `liuyao:structure:sanxing:${formation.key}`,
      '卦内三刑',
      `${formation.description}；${roles.length ? `关系涉及${roles.join('、')}` : '当前未直接落到已定用神或世应'}；静爻仅同盘、三支不全或发动条件不足时不立三刑事实`,
      [
        '《卜筮全书·天玄赋》三刑须全、两爻动刑起一静与动静刑冲边界',
        '《断易天机》刑我刑他、旺衰与旁爻制化边界',
        '当前六爻地支、明动暗动、世应与已定用神逐项重算',
      ],
      { referenceKeys },
    );
  });
  return facts;
}

function findGeneratingElement(target: string) {
  return ELEMENTS.find((element) => isSheng(element, target)) ?? '';
}

function findControllingElement(target: string) {
  return ELEMENTS.find((element) => isKe(element, target)) ?? '';
}

interface LiuyaoCandidateSpec {
  label: string;
  relative?: string;
  position?: number;
  candidateRole: LiuyaoUsefulGodCandidate['candidateRole'];
  reason: string;
}

function candidateSpecs(data: LiuyaoData, options: LiuyaoEvidenceOptions): LiuyaoCandidateSpec[] {
  const topic = options.topic ?? 'general';
  const world = data.yaosDetail.find((item) => item.isWorld);
  const response = data.yaosDetail.find((item) => item.isResponse);
  if (options.usefulGodRelative) {
    return [
      {
        label: '指定用神',
        relative: options.usefulGodRelative,
        candidateRole: '用神候选' as const,
        reason: '按明确指定的六亲取用，并以盘面检索结果裁定。',
      },
    ];
  }
  if (topic === 'shiye') {
    return [
      {
        label: '事业用神',
        relative: '官鬼',
        candidateRole: '用神候选' as const,
        reason: '事业职位与工作事项按官鬼取用。',
      },
      {
        label: '文书辅证',
        relative: '父母',
        candidateRole: '辅助观察' as const,
        reason: '父母爻只作为文书、单位与消息的辅助观察。',
      },
    ];
  }
  if (topic === 'caifu') {
    return [
      {
        label: '财运用神',
        relative: '妻财',
        candidateRole: '用神候选' as const,
        reason: '钱财与交易事项按妻财取用。',
      },
      {
        label: '财源辅证',
        relative: '子孙',
        candidateRole: '辅助观察' as const,
        reason: '子孙爻只作为财源与产出的辅助观察。',
      },
    ];
  }
  if (topic === 'guaishen') {
    return [
      {
        label: '怪异事项候选',
        relative: '官鬼',
        candidateRole: '用神候选' as const,
        reason: '仅按传统取官鬼为候选，不能据此证明超自然原因。',
      },
      ...(world
        ? [
            {
              label: '求测者主轴',
              position: world.position,
              candidateRole: '辅助观察' as const,
              reason: '仍须先检查世爻状态与现实因素。',
            },
          ]
        : []),
    ];
  }
  if (topic === 'ganqing') {
    return [
      {
        label: '关系对象候选（妻财）',
        relative: '妻财',
        candidateRole: '用神候选' as const,
        reason: '传统关系取用可能落在妻财，须结合求测者身份与所问对象确认。',
      },
      {
        label: '关系对象候选（官鬼）',
        relative: '官鬼',
        candidateRole: '用神候选' as const,
        reason: '传统关系取用可能落在官鬼，须结合求测者身份与所问对象确认。',
      },
      ...(world
        ? [
            {
              label: '关系我方',
              position: world.position,
              candidateRole: '辅助观察' as const,
              reason: '感情关系以世爻为我方。',
            },
          ]
        : []),
      ...(response
        ? [
            {
              label: '关系对方',
              position: response.position,
              candidateRole: '辅助观察' as const,
              reason: '感情关系以应爻为对方。',
            },
          ]
        : []),
    ];
  }
  return [
    ...(world
      ? [
          {
            label: '通用主轴',
            position: world.position,
            candidateRole: '辅助观察' as const,
            reason: '未按具体事项确定用神时，世爻只作为求测者主轴。',
          },
        ]
      : []),
    ...(response
      ? [
          {
            label: '应爻辅轴',
            position: response.position,
            candidateRole: '辅助观察' as const,
            reason: '应爻只用于观察对方与外部条件。',
          },
        ]
      : []),
    ...data.yaosDetail
      .filter((item) => item.isChanging)
      .map((item) => ({
        label: `动爻触发第${item.position}爻`,
        position: item.position,
        candidateRole: '辅助观察' as const,
        reason: '动爻只作为事件变化触发点，并回扣世应与已定用神。',
      })),
  ];
}

function matchCandidateSpec(
  spec: LiuyaoCandidateSpec,
  groups: LiuyaoReferenceGroups,
): { references: LiuyaoYaoReference[]; matchingTier: LiuyaoUsefulGodMatchingTier | null } {
  if (spec.candidateRole === '辅助观察') {
    const references = spec.position
      ? groups.visible.filter((reference) => reference.position === spec.position)
      : groups.visible
          .concat(groups.hidden)
          .filter((reference) => reference.sixRelative === spec.relative);
    return { references, matchingTier: null };
  }

  const tiers: Array<[LiuyaoUsefulGodMatchingTier, LiuyaoYaoReference[]]> = [
    ['本卦明现', groups.visible],
    ['变爻显出', groups.changed],
    ['月日入用', groups.calendar],
    ['伏神检索', groups.hidden],
  ];
  for (const [matchingTier, references] of tiers) {
    const matched = references.filter((reference) => reference.sixRelative === spec.relative);
    if (matched.length) return { references: matched, matchingTier };
  }
  return { references: [], matchingTier: null };
}

function buildSummaryFact(params: {
  generationFact: LiuyaoGenerationFact;
  randomFact: RandomTraceFact;
  lineCoverageFact: LiuyaoLineCoverageFact;
  lineFacts: LiuyaoLineFact[];
  hiddenSpiritCoverageFact: LiuyaoHiddenSpiritCoverageFact;
  hiddenSpiritFacts: LiuyaoHiddenSpiritFact[];
  candidates: LiuyaoUsefulGodCandidate[];
  selectionFact: LiuyaoUsefulGodSelectionFact;
  godChain: LiuyaoGodChainItem[];
  godInteractionFacts: LiuyaoGodInteractionFact[];
  godInteractionAssessmentFact: LiuyaoGodInteractionAssessmentFact;
  traditionalSymbols: LiuyaoTraditionalSymbolFact[];
  structureFacts: LiuyaoHexagramStructureFact[];
  counterEvidenceFacts: LiuyaoCounterEvidenceFact[];
  counterSummaryFact: LiuyaoCounterSummaryFact;
  timingFacts: LiuyaoTimingFact[];
  timingSummaryFact: LiuyaoTimingSummaryFact;
}): LiuyaoSummaryFact {
  const factKeys = Array.from(
    new Set([
      params.generationFact.key,
      params.randomFact.key,
      params.lineCoverageFact.key,
      ...params.lineFacts.map((item) => item.key),
      params.hiddenSpiritCoverageFact.key,
      ...params.hiddenSpiritFacts.map((item) => item.key),
      params.selectionFact.key,
      ...params.candidates.flatMap((item) => [item.key, ...item.referenceKeys]),
      ...params.godChain.flatMap((item) => [item.key, ...item.referenceKeys]),
      ...params.godInteractionFacts.flatMap((item) => [item.key, ...item.referenceKeys]),
      params.godInteractionAssessmentFact.key,
      ...params.traditionalSymbols.map((item) => item.key),
      ...params.structureFacts.map((item) => item.key),
      params.counterSummaryFact.key,
      ...params.counterEvidenceFacts.map((item) => item.key),
      params.timingSummaryFact.key,
      ...params.timingFacts.map((item) => item.key),
    ]),
  );
  const status =
    params.generationFact.status === '来源链缺失' ||
    params.lineCoverageFact.status !== '完整' ||
    params.hiddenSpiritCoverageFact.status === '字段缺失'
      ? '部分资料缺失'
      : params.selectionFact.status === '缺少可用候选'
        ? '缺少可用候选'
        : params.selectionFact.status === '已选定候选'
          ? '证据链完整'
          : '用神取用待定';
  const matchedCandidateCount = params.candidates.filter((item) => item.status === '已匹配').length;
  return {
    key: 'liuyao:evidence-summary',
    status,
    factKeys,
    lineFactCount: params.lineFacts.length,
    hiddenSpiritFactCount: params.hiddenSpiritFacts.length,
    candidateCount: params.candidates.length,
    matchedCandidateCount,
    godChainFactCount: params.godChain.length,
    godInteractionFactCount: params.godInteractionFacts.length,
    structureFactCount: params.structureFacts.length,
    counterEvidenceCount: params.counterEvidenceFacts.length,
    timingFactCount: params.timingFacts.length,
    promptText: `证据状态${status}：逐爻${params.lineFacts.length}项、伏神${params.hiddenSpiritFacts.length}项、用神候选${params.candidates.length}项（匹配${matchedCandidateCount}项）、五行作用链${params.godChain.length}项、生克制化路径${params.godInteractionFacts.length}项、全局作用态${params.godInteractionAssessmentFact.balanceStatus}（可用性${params.godInteractionAssessmentFact.status}）、卦内结构${params.structureFacts.length}项、反证${params.counterEvidenceFacts.length}项、应期${params.timingFacts.length}项`,
    sources: [
      '全部起卦、逐爻、伏神、候选、五行作用链、生克制化路径、全局作用态、卦内结构、反证与应期事实逐项汇总',
    ],
    limitation: SUMMARY_FACT_LIMITATION,
  };
}

function buildCalculationSteps(params: {
  generationFact: LiuyaoGenerationFact;
  randomFact: RandomTraceFact;
  lineCoverageFact: LiuyaoLineCoverageFact;
  lineFacts: LiuyaoLineFact[];
  hiddenSpiritCoverageFact: LiuyaoHiddenSpiritCoverageFact;
  hiddenSpiritFacts: LiuyaoHiddenSpiritFact[];
  candidates: LiuyaoUsefulGodCandidate[];
  selectionFact: LiuyaoUsefulGodSelectionFact;
  godChain: LiuyaoGodChainItem[];
  godInteractionFacts: LiuyaoGodInteractionFact[];
  godInteractionAssessmentFact: LiuyaoGodInteractionAssessmentFact;
  counterEvidenceFacts: LiuyaoCounterEvidenceFact[];
  timingFacts: LiuyaoTimingFact[];
  summaryFact: LiuyaoSummaryFact;
}): LiuyaoCalculationStep[] {
  return [
    {
      key: 'liuyao:calculation:generation',
      stage: '起卦来源核验',
      status: params.generationFact.status === '可核验' ? '已计算' : '资料不足',
      inputs: {
        method: params.generationFact.method,
        expectedLineCount: params.generationFact.expectedLineCount,
      },
      result: {
        generationStatus: params.generationFact.status,
        recordedLineCount: params.generationFact.recordedLineCount,
        randomTraceStatus: params.randomFact.status,
        randomSampleCount: params.randomFact.sampleCount,
      },
      dependsOnStepKeys: [],
      promptText: `${params.generationFact.promptText}；随机轨迹${params.randomFact.status === '不适用' ? '不适用' : params.randomFact.status}`,
      sources: Array.from(
        new Set([...params.generationFact.sources, ...params.randomFact.sources]),
      ),
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'liuyao:calculation:lines',
      stage: '六爻逐爻计算',
      status: params.lineCoverageFact.status === '完整' ? '已计算' : '资料不足',
      inputs: {
        expectedPositions: params.lineCoverageFact.expectedPositions.map(String),
        recordedLineCount: params.lineFacts.length,
      },
      result: {
        coverageStatus: params.lineCoverageFact.status,
        actualPositions: params.lineCoverageFact.actualPositions.map(String),
        missingPositions: params.lineCoverageFact.missingPositions.map(String),
      },
      dependsOnStepKeys: ['liuyao:calculation:generation'],
      promptText: `${params.lineCoverageFact.promptText}；已形成${params.lineFacts.length}项逐爻纳甲、世应、月日与动变事实`,
      sources: ['起卦六个爻值', ...params.lineCoverageFact.sources, '逐爻纳甲与动变计算'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'liuyao:calculation:hidden-spirits',
      stage: '伏神资料核验',
      status: params.hiddenSpiritCoverageFact.status === '字段缺失' ? '资料不足' : '已计算',
      inputs: { lineFactCount: params.lineFacts.length },
      result: {
        coverageStatus: params.hiddenSpiritCoverageFact.status,
        hiddenSpiritFactCount: params.hiddenSpiritFacts.length,
      },
      dependsOnStepKeys: ['liuyao:calculation:lines'],
      promptText: params.hiddenSpiritCoverageFact.promptText,
      sources: params.hiddenSpiritCoverageFact.sources,
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'liuyao:calculation:candidates',
      stage: '用神候选筛选',
      status: params.selectionFact.status === '已选定候选' ? '已计算' : '资料不足',
      inputs: {
        candidateCount: params.candidates.length,
        candidateKeys: params.candidates.map((item) => item.key),
      },
      result: {
        selectionStatus: params.selectionFact.status,
        matchedCandidateCount: params.candidates.filter((item) => item.status === '已匹配').length,
        selectedCandidateKey: params.selectionFact.selectedCandidateKey ?? '无',
        selectedReferenceKey: params.selectionFact.selectedReferenceKey ?? '无',
      },
      dependsOnStepKeys: ['liuyao:calculation:lines', 'liuyao:calculation:hidden-spirits'],
      promptText: params.selectionFact.promptText,
      sources: params.selectionFact.sources,
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'liuyao:calculation:god-chain',
      stage: '原忌仇神作用链',
      status: params.godChain.length ? '已计算' : '资料不足',
      inputs: { selectionStatus: params.selectionFact.status },
      result: {
        godChainFactCount: params.godChain.length,
        godInteractionFactCount: params.godInteractionFacts.length,
        godInteractionBalanceStatus: params.godInteractionAssessmentFact.balanceStatus,
        usefulGodUsabilityStatus: params.godInteractionAssessmentFact.status,
        roles: params.godChain.map((item) => item.role),
      },
      dependsOnStepKeys: ['liuyao:calculation:candidates'],
      promptText: params.godChain.length
        ? `按已明确的用神六亲五行建立${params.godChain.map((item) => item.role).join('、')}作用链，并重算${params.godInteractionFacts.length}条生克制化路径；${params.godInteractionAssessmentFact.promptText}`
        : '当前用神六亲尚未明确或各层均无匹配，未强定原神、忌神与仇神',
      sources: [
        '已明确的用神六亲五行与五行生克关系',
        '本卦、月日与伏神逐项五行匹配；变爻仅回头作用本位动爻',
        '当前月日、真实明暗动、旺相静爻、本位动变与飞伏生克路径重算',
      ],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'liuyao:calculation:counter-timing',
      stage: '反证与应期核验',
      status: '已计算',
      inputs: {
        candidateCount: params.candidates.length,
        lineFactCount: params.lineFacts.length,
      },
      result: {
        counterEvidenceCount: params.counterEvidenceFacts.length,
        timingFactCount: params.timingFacts.length,
      },
      dependsOnStepKeys: [
        'liuyao:calculation:lines',
        'liuyao:calculation:candidates',
        'liuyao:calculation:god-chain',
      ],
      promptText: `逐项核验候选限制${params.counterEvidenceFacts.length}项，并记录应期触发与边界${params.timingFacts.length}项`,
      sources: ['候选空破墓退等限制', '动爻、旬空、伏神与反吟伏吟触发条件'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'liuyao:calculation:summary',
      stage: '证据汇总',
      status: params.summaryFact.status === '证据链完整' ? '已计算' : '资料不足',
      inputs: { factCount: params.summaryFact.factKeys.length },
      result: {
        summaryStatus: params.summaryFact.status,
        lineFactCount: params.summaryFact.lineFactCount,
        candidateCount: params.summaryFact.candidateCount,
        godInteractionFactCount: params.summaryFact.godInteractionFactCount,
        counterEvidenceCount: params.summaryFact.counterEvidenceCount,
        timingFactCount: params.summaryFact.timingFactCount,
      },
      dependsOnStepKeys: [
        'liuyao:calculation:generation',
        'liuyao:calculation:lines',
        'liuyao:calculation:hidden-spirits',
        'liuyao:calculation:candidates',
        'liuyao:calculation:god-chain',
        'liuyao:calculation:counter-timing',
      ],
      promptText: params.summaryFact.promptText,
      sources: params.summaryFact.sources,
      limitation: CALCULATION_STEP_LIMITATION,
    },
  ];
}

function buildLimitationFacts(params: {
  generationFact: LiuyaoGenerationFact;
  randomFact: RandomTraceFact;
  lineCoverageFact: LiuyaoLineCoverageFact;
  lineFacts: LiuyaoLineFact[];
  hiddenSpiritCoverageFact: LiuyaoHiddenSpiritCoverageFact;
  hiddenSpiritFacts: LiuyaoHiddenSpiritFact[];
  candidates: LiuyaoUsefulGodCandidate[];
  selectionFact: LiuyaoUsefulGodSelectionFact;
  godChain: LiuyaoGodChainItem[];
  godInteractionFacts: LiuyaoGodInteractionFact[];
  godInteractionAssessmentFact: LiuyaoGodInteractionAssessmentFact;
  traditionalSymbols: LiuyaoTraditionalSymbolFact[];
  structureFacts: LiuyaoHexagramStructureFact[];
  counterEvidenceFacts: LiuyaoCounterEvidenceFact[];
  counterSummaryFact: LiuyaoCounterSummaryFact;
  timingFacts: LiuyaoTimingFact[];
  timingSummaryFact: LiuyaoTimingSummaryFact;
  summaryFact: LiuyaoSummaryFact;
}): LiuyaoLimitationFact[] {
  const definitions: Array<
    Pick<LiuyaoLimitationFact, 'key' | 'type' | 'ownerFactKeys' | 'promptText' | 'sources'>
  > = [
    {
      key: 'liuyao:limitation:generation-random',
      type: '起卦与随机来源边界',
      ownerFactKeys: [params.generationFact.key, params.randomFact.key],
      promptText:
        '起卦来源与随机轨迹只用于核验六个爻值如何录入、生成或重放；模拟三钱和随机重放只记录生成过程，不等同于现实投掷，也不提高预测有效性',
      sources: ['起卦方式、原始爻值、三钱记录与随机轨迹'],
    },
    {
      key: 'liuyao:limitation:lines-hidden-spirits',
      type: '逐爻与伏神资料边界',
      ownerFactKeys: [
        params.lineCoverageFact.key,
        ...params.lineFacts.map((item) => item.key),
        params.hiddenSpiritCoverageFact.key,
        ...params.hiddenSpiritFacts.map((item) => item.key),
      ],
      promptText:
        '逐爻与伏神事实只记录纳甲、六亲、六神、世应、月日、空破墓及动变条件；资料缺失时不得补造爻位或伏神，资料完整也不单独证明现实吉凶',
      sources: ['六爻覆盖、逐爻计算与伏神飞神配对事实'],
    },
    {
      key: 'liuyao:limitation:candidates-god-chain',
      type: '用神候选与五行链边界',
      ownerFactKeys: [
        params.selectionFact.key,
        ...params.candidates.map((item) => item.key),
        ...params.godChain.map((item) => item.key),
        ...params.godInteractionFacts.map((item) => item.key),
        params.godInteractionAssessmentFact.key,
      ],
      promptText:
        '先按具体问题与求测关系确定六亲用神，再依本卦明现、变爻显出、月日入用、伏神检索逐层查找；世应和动爻本身不是通用用神。多现未能闭合时保留待择，不按数组顺序强选；原神、忌神和仇神只按已明确的用神五行建立关系。全局作用态先区分生扶侧、克制侧与制化侧并保留用神有气无根条件，不按路径数量、多数票或顺序证明最终强弱、用神有效性、现实助力、阻碍或结果',
      sources: ['六亲取用、世应分工、用神层级匹配、多现边界、五行生克作用链与生克制化路径'],
    },
    {
      key: 'liuyao:limitation:structure-tradition',
      type: '卦内结构与传统类象边界',
      ownerFactKeys: [
        ...params.structureFacts.map((item) => item.key),
        ...params.traditionalSymbols.map((item) => item.key),
      ],
      promptText:
        '整卦六合六冲、反吟伏吟、三合、动静结构与六亲类象只提供盘内结构和传统事项候选；不得直接写成现实和合冲散、疾病官非、财运关系或固定应期',
      sources: ['卦内结构事实与传统六亲类象条件化映射'],
    },
    {
      key: 'liuyao:limitation:counter-timing',
      type: '反证与应期边界',
      ownerFactKeys: [
        params.counterSummaryFact.key,
        ...params.counterEvidenceFacts.map((item) => item.key),
        params.timingSummaryFact.key,
        ...params.timingFacts.map((item) => item.key),
      ],
      promptText:
        '空亡、月破、日破、休囚死、入墓、回头克冲、化空化退等条件须与支持证据并列；应期先按用神、原神、忌神辨明病药方向，同一出空、填实、冲开不得无条件套用，未给期限时不得换算唯一日期或事件概率',
      sources: ['候选反证汇总、用原忌病药触发与期限边界'],
    },
    {
      key: 'liuyao:limitation:high-risk',
      type: '高风险输出边界',
      ownerFactKeys: [params.summaryFact.key],
      promptText:
        '不得按候选、支持、反证或动爻数量生成吉凶总分与成功率；不得仅凭官鬼、白虎、螣蛇等单项证明疾病、灾祸或超自然原因，也不得替代医疗、法律、财务与安全核验',
      sources: ['六爻证据汇总与高风险解释约束'],
    },
  ];
  return definitions.map((item) => ({
    ...item,
    status: '适用',
    limitation: LIMITATION_FACT_LIMITATION,
  }));
}

export function analyzeRebuiltLiuyaoEvidence(
  data: LiuyaoData,
  options: LiuyaoEvidenceOptions = {},
): LiuyaoEvidenceAnalysis {
  if (!data?.yaosDetail?.length) throw new Error('六爻证据分析缺少完整爻位资料。');
  if (options.usefulGodRelative && !LIUYAO_RELATIVES.has(options.usefulGodRelative)) {
    throw new Error('六爻指定用神六亲只能是父母、兄弟、官鬼、妻财或子孙。');
  }
  const topic = options.topic ?? 'general';
  const monthBranch = branchOf(data.ganzhi.month);
  const dayBranch = branchOf(data.ganzhi.day);
  const referenceGroups = buildReferenceGroups(data, monthBranch, dayBranch);
  const directlyActingReferences = [
    ...referenceGroups.visible,
    ...referenceGroups.calendar,
    ...referenceGroups.hidden,
  ];
  const lineFacts = buildLineFacts(data, monthBranch, dayBranch);
  const hiddenSpiritFacts = buildHiddenSpiritFacts(data);
  const lineCoverageFact = buildLineCoverageFact(lineFacts);
  const hiddenSpiritCoverageFact = buildHiddenSpiritCoverageFact(data, hiddenSpiritFacts);
  const candidateSourceStatus: LiuyaoUsefulGodCandidate['sourceStatus'] = options.usefulGodRelative
    ? '用户指定'
    : topic === 'general'
      ? '盘面补齐'
      : '主题默认';
  const candidates = candidateSpecs(data, options).map((spec, index): LiuyaoUsefulGodCandidate => {
    const { references: matched, matchingTier } = matchCandidateSpec(spec, referenceGroups);
    const constraints = matched.length
      ? Array.from(new Set(matched.flatMap((item) => item.constraints)))
      : [
          spec.candidateRole === '用神候选'
            ? `${spec.relative ?? '指定六亲'}在本卦、变爻、月日与伏神中均未找到，不能硬取用神`
            : `${spec.relative ?? `第${spec.position}爻`}未在当前辅助观察范围中找到`,
        ];
    const support = Array.from(new Set(matched.flatMap((item) => item.support)));
    return {
      key: `liuyao:candidate:${index + 1}:${spec.label}`,
      status: matched.length ? '已匹配' : '未匹配',
      sourceStatus: candidateSourceStatus,
      ...spec,
      matchingTier,
      references: matched,
      referenceKeys: matched.map((item) => item.key),
      support,
      constraints,
      promptText: matched.length
        ? `${spec.label}由${candidateSourceStatus}提出，性质为${spec.candidateRole}${matchingTier ? `，按${matchingTier}匹配` : ''}：${spec.reason}；匹配${matched.map(formatYao).join('、')}；支持${support.join('、') || '未见额外增强'}；限制${constraints.join('、') || '未见明显空破墓退'}`
        : `${spec.label}由${candidateSourceStatus}提出：${spec.reason}；${constraints.join('、')}`,
      sources: [
        '《增删卜易》《卜筮正宗》六亲取用与世应分工',
        '本卦明现、变爻显出、月日入用、伏神检索逐层核验',
      ],
      limitation: CANDIDATE_FACT_LIMITATION,
    };
  });
  const usefulGodCandidates = candidates.filter((item) => item.candidateRole === '用神候选');
  const soleUsefulGodCandidate = usefulGodCandidates.length === 1 ? usefulGodCandidates[0] : null;
  let selectedCandidate: LiuyaoUsefulGodCandidate | null = null;
  let selectedReference: LiuyaoYaoReference | null = null;
  let selectionStatus: LiuyaoUsefulGodSelectionFact['status'];
  if (!usefulGodCandidates.length || usefulGodCandidates.length > 1) {
    selectionStatus = '取用范围待定';
  } else if (!soleUsefulGodCandidate?.references.length) {
    selectionStatus = '缺少可用候选';
  } else if (
    soleUsefulGodCandidate.matchingTier === '本卦明现' &&
    soleUsefulGodCandidate.references.length > 1
  ) {
    const movingReferences = soleUsefulGodCandidate.references.filter(
      (reference) => reference.source === '本卦' && reference.isChanging,
    );
    if (movingReferences.length === 1) {
      selectionStatus = '已选定候选';
      selectedCandidate = soleUsefulGodCandidate;
      selectedReference = movingReferences[0];
    } else {
      selectionStatus = '用神爻位待择';
    }
  } else if (
    (soleUsefulGodCandidate.matchingTier === '变爻显出' ||
      soleUsefulGodCandidate.matchingTier === '伏神检索') &&
    soleUsefulGodCandidate.references.length > 1
  ) {
    selectionStatus = '用神爻位待择';
  } else {
    selectionStatus = '已选定候选';
    selectedCandidate = soleUsefulGodCandidate;
    selectedReference =
      soleUsefulGodCandidate.references.length === 1 ? soleUsefulGodCandidate.references[0] : null;
  }
  const targetRelative = soleUsefulGodCandidate?.relative ?? null;
  const selectionPrompt =
    selectionStatus === '已选定候选' && selectedCandidate
      ? selectedReference
        ? `本次用神取${selectedCandidate.label}（${targetRelative}），按${selectedCandidate.matchingTier}确定为${formatYao(selectedReference)}`
        : `本次用神取${selectedCandidate.label}（${targetRelative}），按${selectedCandidate.matchingTier}以${selectedCandidate.references.map(formatYao).join('、')}入用`
      : selectionStatus === '用神爻位待择' && soleUsefulGodCandidate
        ? `本次用神六亲已确定为${targetRelative}，按${soleUsefulGodCandidate.matchingTier}见${soleUsefulGodCandidate.references.map(formatYao).join('、')}；同层多现且现有条件不能闭合唯一爻位，不按数组顺序强选`
        : selectionStatus === '取用范围待定'
          ? topic === 'ganqing'
            ? '感情主题尚缺求测者身份与所问对象关系；妻财、官鬼只列取用范围，世应只列双方位置，当前不硬定唯一用神'
            : '通用主题尚未按具体问题与求测关系确定六亲用神；世爻、应爻和动爻只作辅助观察，当前不冒充唯一用神'
          : `本次用神六亲取${targetRelative ?? '未定'}，但本卦、变爻、月日与伏神各层均未见匹配，不改以世应或动爻硬取`;
  const selectionFact: LiuyaoUsefulGodSelectionFact = {
    key: 'liuyao:useful-god-selection',
    status: selectionStatus,
    topic,
    requestedRelative: options.usefulGodRelative ?? null,
    targetRelative,
    matchingTier: soleUsefulGodCandidate?.matchingTier ?? null,
    selectedCandidateKey: selectedCandidate?.key ?? null,
    selectedReferenceKey: selectedReference?.key ?? null,
    candidateKeys: candidates.map((item) => item.key),
    promptText: selectionPrompt,
    sources: [
      '《增删卜易·用神章、两现章、飞伏神章》',
      '《卜筮正宗·用神分类定例、世应论用神、伏神正传》',
      '当前取用主题与本卦、变爻、月日、伏神逐层匹配',
    ],
    limitation: SELECTION_FACT_LIMITATION,
  };
  const usefulElement = soleUsefulGodCandidate?.references[0]?.wuxing ?? '';
  const sourceElement = usefulElement ? findGeneratingElement(usefulElement) : '';
  const tabooElement = usefulElement ? findControllingElement(usefulElement) : '';
  const enemyElement = tabooElement ? findGeneratingElement(tabooElement) : '';
  const chainSpecs: Array<[LiuyaoGodRole, string, string]> = usefulElement
    ? [
        ['用神', usefulElement, '本次用神五行'],
        ['原神', sourceElement, `${sourceElement}生${usefulElement}`],
        ['忌神', tabooElement, `${tabooElement}克${usefulElement}`],
        ['仇神', enemyElement, `${enemyElement}生${tabooElement}并克${sourceElement}`],
      ]
    : [];
  const chainMatches = new Map<LiuyaoGodRole, LiuyaoYaoReference[]>(
    chainSpecs.map(([role, wuxing]) => {
      const matched =
        role === '用神' && selectedReference
          ? [selectedReference]
          : role === '用神' && soleUsefulGodCandidate
            ? soleUsefulGodCandidate.references
            : directlyActingReferences.filter((item) => item.wuxing === wuxing);
      return [role, matched];
    }),
  );
  const godChain = chainSpecs.map(([role, wuxing, relation]): LiuyaoGodChainItem => {
    const matched = chainMatches.get(role) ?? [];
    const effectFacts =
      role === '仇神'
        ? []
        : matched.map((reference) =>
            buildGodReferenceEffectFact({
              role,
              reference,
              sourceReferences: chainMatches.get('原神') ?? [],
              tabooReferences: chainMatches.get('忌神') ?? [],
              enemyReferences: chainMatches.get('仇神') ?? [],
            }),
          );
    const effectStatus = getGodEffectStatus(
      effectFacts.flatMap((item) => item.supportingConditions),
      effectFacts.flatMap((item) => item.blockingConditions),
    );
    return {
      key: `liuyao:god-chain:${role}`,
      role,
      status: matched.length ? '当前资料有对应' : '当前资料未见',
      wuxing,
      relation,
      references: matched,
      referenceKeys: matched.map((item) => item.key),
      effectStatus,
      effectFacts,
      promptText: `${role}${wuxing}：${relation}；${matched.length ? `当前资料对应${matched.map(formatYao).join('、')}；效力条件状态${effectStatus}；${effectFacts.map((item) => item.promptText).join('；')}` : '当前资料未见对应；效力条件状态资料不足'}`,
      sources: [
        '当前已明确的用神六亲五行',
        '五行生克公共关系',
        '本卦、月日与伏神五行逐项匹配；变爻仅回头作用本位动爻',
      ],
      limitation: GOD_CHAIN_FACT_LIMITATION,
    };
  });
  const godInteractionTargets =
    selectionFact.status !== '已选定候选' || !selectedCandidate
      ? []
      : selectedReference
        ? [selectedReference]
        : selectedCandidate.references.filter(
            (reference) => reference.source === '月建' || reference.source === '日辰',
          );
  const godInteractionFacts = buildGodInteractionFacts({
    selectionFact,
    targetReferences: godInteractionTargets,
    referenceGroups,
    usefulElement,
    sourceElement,
    tabooElement,
    enemyElement,
  });
  const godInteractionAssessmentFact = buildGodInteractionAssessmentFact({
    selectionFact,
    godChain,
    godInteractionFacts,
  });
  const symbolReferences = [...referenceGroups.visible, ...referenceGroups.hidden];
  const traditionalSymbols = Array.from(
    new Set(symbolReferences.map((item) => item.sixRelative)),
  ).map((relative): LiuyaoTraditionalSymbolFact => {
    const originalText = TRADITIONAL_RELATIVE_IMAGES[relative] ?? '传统类象未单列';
    return {
      key: `liuyao:traditional-symbol:${relative}`,
      status: '已映射',
      relative,
      positions: symbolReferences
        .filter((item) => item.sixRelative === relative)
        .flatMap((item) => (item.position ? [item.position] : [])),
      originalText,
      promptText: `${originalText}；须先结合问题主题、求测者身份、世应、动变、月日旺衰与空破墓判断`,
      source: '传统六亲类象表与当前六亲排布',
      sources: ['传统六亲类象表', '当前本卦与伏神六亲排布'],
      limitation: '六亲只提供随问题变化的事项候选，不证明现实身份、疾病、官非、财运或关系结果',
    };
  });
  const structureFacts = buildHexagramStructureFacts(
    data,
    usefulElement,
    monthBranch,
    dayBranch,
    selectionFact.selectedReferenceKey,
  );
  const generationFact = buildGenerationFact(data);
  const generationMethod = data.generation?.method;
  const generationSource = data.generation?.source;
  const methodLabel = generationFact.methodLabel;
  const generationFacts = [
    `起卦方式：${methodLabel}`,
    ...generationFact.coinThrows.map(
      (item, index) =>
        `第${index + 1}爻计算样本：${item.coins.join('+')}=${item.total}（${item.total === 6 ? '老阴' : item.total === 7 ? '少阳' : item.total === 8 ? '少阴' : '老阳'}）`,
    ),
    generationMethod === 'manual' ? `手工爻值：${data.yaoArray.join('、')}` : '',
  ].filter(Boolean);
  const trace = data.meta?.random;
  const expectsRandomTrace =
    generationSource === 'time-seeded-coin-simulation' ||
    generationSource === 'random-coin-simulation' ||
    (!generationSource && (generationMethod === 'time' || trace !== undefined));
  const randomFact = buildRandomTraceFact({
    key: `random:liuyao:${generationMethod ?? 'unknown'}`,
    applicable: expectsRandomTrace,
    trace,
    processLabel: `${methodLabel}的六爻生成过程`,
    sources: ['六爻起卦方式记录', '逐次随机投币样本与重放元数据'],
  });
  const randomFacts = formatLegacyRandomFacts(randomFact);
  const timingFacts: LiuyaoTimingFact[] = [];
  const movingTimingFact = buildMovingTimingFact(lineFacts, godChain, selectionFact);
  if (movingTimingFact) timingFacts.push(movingTimingFact);
  if (selectionFact.status === '已选定候选') {
    for (const role of ['用神', '原神', '忌神'] as const) {
      const fact = buildRoleTimingFact(
        role,
        godChain.find((item) => item.role === role),
        selectionFact,
      );
      if (fact) timingFacts.push(fact);
    }
  } else {
    timingFacts.push({
      key: 'liuyao:timing:selection-boundary',
      type: '取用边界',
      sourceStatus: '统一边界',
      role: '未定',
      effect: '解释边界',
      ownerFactKeys: [selectionFact.key, ...selectionFact.candidateKeys],
      referenceKeys: candidates.flatMap((item) => item.referenceKeys),
      promptText:
        selectionFact.status === '用神爻位待择'
          ? `用神六亲虽已确定为${selectionFact.targetRelative ?? '未定'}，但同层多现且爻位待择；未闭合唯一用神前，不把任一候选的空破合冲单独换成应期`
          : selectionFact.status === '缺少可用候选'
            ? `当前盘面各层未找到${selectionFact.targetRelative ?? '所问事项'}用神；缺少用神时不以世应、动爻、空亡或伏神替代并补造应期`
            : '当前问题关系不足，尚未确定用神六亲；动爻、空亡、月破、伏神与反吟伏吟只能保留为盘面事实，不能先套应期公式',
      sources: ['当前用神选择状态与候选层级核验'],
      limitation: TIMING_FACT_LIMITATION,
    });
  }
  const fanfuFacts = structureFacts.filter((item) => item.kind === '反吟伏吟');
  if (fanfuFacts.length) {
    timingFacts.push({
      key: 'liuyao:timing:fanfu',
      type: '反吟伏吟节奏',
      sourceStatus: '由盘面生成',
      role: '整卦',
      effect: '节奏边界',
      ownerFactKeys: fanfuFacts.map((item) => item.key),
      referenceKeys: [],
      promptText:
        '反吟伏吟只保留反复、往返或停滞的传统节奏；实际应期仍回到已定用神的病药，不能把反吟伏吟本身换算日期',
      sources: ['当前反吟伏吟结构事实', '《增删卜易·反伏章、各门类应期总注》'],
      limitation: TIMING_FACT_LIMITATION,
    });
  }
  if (!lineFacts.some((item) => item.activity === '明动')) {
    timingFacts.push({
      key: 'liuyao:timing:static',
      type: '静卦边界',
      sourceStatus: '由盘面生成',
      role: selectionFact.status === '已选定候选' ? '整卦' : '未定',
      effect: '节奏边界',
      ownerFactKeys: lineFacts.map((item) => item.key),
      referenceKeys: lineFacts.map((item) => `liuyao:reference:line:${item.position}`),
      promptText:
        '静卦不补造动爻触发；只有已定用神有气且无关键受制时，才把逢值或日冲列为候选，衰静日冲可能成破',
      sources: ['当前六爻动静状态', '《增删卜易·日辰章、各门类应期总注》'],
      limitation: TIMING_FACT_LIMITATION,
    });
  }
  timingFacts.push({
    key: 'liuyao:timing:deadline-boundary',
    type: '期限边界',
    sourceStatus: '统一边界',
    role: '整卦',
    effect: '解释边界',
    ownerFactKeys: [],
    referenceKeys: [],
    promptText: '未给现实期限时，不把爻位、地支序、卦数或旬空机械换算成唯一日期',
    sources: ['盘内触发条件与现实日期分离原则'],
    limitation: TIMING_FACT_LIMITATION,
  });
  const timingConditions = timingFacts.map((item) => item.promptText);
  const timingSummaryFact: LiuyaoTimingSummaryFact = {
    key: 'liuyao:timing-summary',
    status: timingFacts.some((item) =>
      ['用神病药', '原神病药', '忌神制化', '伏神透出', '空亡填实'].includes(item.type),
    )
      ? '已提供触发条件'
      : '仅有边界',
    factKeys: timingFacts.map((item) => item.key),
    promptText: `应期状态：已记录${timingFacts.length}项触发与边界条件，未给期限时不换算唯一日期`,
    sources: ['逐项应期事实汇总'],
    limitation: TIMING_SUMMARY_LIMITATION,
  };
  const counterEvidenceFacts: LiuyaoCounterEvidenceFact[] = candidates
    .filter((candidate) => candidate.candidateRole === '用神候选')
    .flatMap((candidate, candidateIndex) =>
      candidate.constraints.map((detail, index) => ({
        key: `liuyao:counter:${candidateIndex + 1}:${index + 1}`,
        ownerCandidateKey: candidate.key,
        candidateLabel: candidate.label,
        status: '已触发' as const,
        detail,
        referenceKeys: candidate.referenceKeys,
        promptText: `${candidate.label}限制：${detail}`,
        sources: ['当前用神候选匹配结果', '对应本卦、变爻、月日或伏神支持与限制字段'],
        limitation: COUNTER_FACT_LIMITATION,
      })),
    );
  const counterEvidence = Array.from(new Set(counterEvidenceFacts.map((item) => item.detail)));
  const counterSummaryFact: LiuyaoCounterSummaryFact = {
    key: 'liuyao:counter-summary',
    status: counterEvidenceFacts.length ? '有明确反证' : '未见明确反证',
    factKeys: counterEvidenceFacts.map((item) => item.key),
    promptText: counterEvidenceFacts.length
      ? `当前${counterEvidenceFacts.length}项候选限制已逐项记录，须与支持证据同时核验`
      : '当前候选未见明确空破墓退限制，但仍须核实现实风险',
    sources: ['候选 constraints 字段逐项汇总'],
    limitation: COUNTER_SUMMARY_LIMITATION,
  };
  const summaryFact = buildSummaryFact({
    generationFact,
    randomFact,
    lineCoverageFact,
    lineFacts,
    hiddenSpiritCoverageFact,
    hiddenSpiritFacts,
    candidates,
    selectionFact,
    godChain,
    godInteractionFacts,
    godInteractionAssessmentFact,
    traditionalSymbols,
    structureFacts,
    counterEvidenceFacts,
    counterSummaryFact,
    timingFacts,
    timingSummaryFact,
  });
  const calculationSteps = buildCalculationSteps({
    generationFact,
    randomFact,
    lineCoverageFact,
    lineFacts,
    hiddenSpiritCoverageFact,
    hiddenSpiritFacts,
    candidates,
    selectionFact,
    godChain,
    godInteractionFacts,
    godInteractionAssessmentFact,
    counterEvidenceFacts,
    timingFacts,
    summaryFact,
  });
  summaryFact.factKeys = Array.from(
    new Set([...calculationSteps.map((item) => item.key), ...summaryFact.factKeys]),
  );
  const limitationFacts = buildLimitationFacts({
    generationFact,
    randomFact,
    lineCoverageFact,
    lineFacts,
    hiddenSpiritCoverageFact,
    hiddenSpiritFacts,
    candidates,
    selectionFact,
    godChain,
    godInteractionFacts,
    godInteractionAssessmentFact,
    traditionalSymbols,
    structureFacts,
    counterEvidenceFacts,
    counterSummaryFact,
    timingFacts,
    timingSummaryFact,
    summaryFact,
  });
  const limitations = limitationFacts.map((item) => item.promptText);
  const items: PromptEvidenceItem[] = candidates.map((candidate) => ({
    level:
      candidate.key === selectedCandidate?.key
        ? '主证'
        : candidate.references.length
          ? '辅证'
          : '限制',
    title: candidate.label,
    detail: `${candidate.promptText}；边界：${candidate.limitation}`,
    source: candidate.sources.join('、'),
    tags: [
      candidate.relative ?? '爻位候选',
      candidate.candidateRole,
      candidate.matchingTier ?? '辅助观察',
      candidate.status,
      candidate.sourceStatus,
    ],
  }));
  items.push(
    {
      level: calculationSteps.some((item) => item.status === '资料不足') ? '反证' : '辅证',
      title: '六爻计算链',
      detail: `${calculationSteps.map((item) => item.promptText).join('；')}；统一边界：${CALCULATION_STEP_LIMITATION}`,
      source: Array.from(new Set(calculationSteps.flatMap((item) => item.sources))).join('、'),
      tags: ['计算链', summaryFact.status],
    },
    {
      level: selectionFact.status === '已选定候选' ? '主证' : '反证',
      title: '用神候选选择状态',
      detail: `${selectionFact.promptText}；边界：${selectionFact.limitation}`,
      source: selectionFact.sources.join('、'),
      tags: ['用神选择', selectionFact.status, topic],
    },
    {
      level: lineCoverageFact.status === '完整' ? '辅证' : '反证',
      title: '六爻资料覆盖状态',
      detail: `${lineCoverageFact.promptText}；边界：${lineCoverageFact.limitation}`,
      source: lineCoverageFact.sources.join('、'),
      tags: ['六爻覆盖', lineCoverageFact.status],
    },
    {
      level: lineCoverageFact.status === '完整' ? '主证' : '反证',
      title: '六爻逐爻计算事实',
      detail: `${lineFacts.map((item) => item.promptText).join('；')}；统一边界：${LINE_FACT_LIMITATION}`,
      source: '京房八宫纳甲、安世应、月日旺衰、旬空与动变规则逐爻计算',
      tags: ['逐爻事实', '纳甲', '世应', '月日', '动变'],
    },
    {
      level:
        hiddenSpiritCoverageFact.status === '字段缺失'
          ? '反证'
          : hiddenSpiritCoverageFact.status === '有伏神'
            ? '辅证'
            : '限制',
      title: '伏神资料覆盖状态',
      detail: `${hiddenSpiritCoverageFact.promptText}；边界：${hiddenSpiritCoverageFact.limitation}`,
      source: hiddenSpiritCoverageFact.sources.join('、'),
      tags: ['伏神覆盖', hiddenSpiritCoverageFact.status],
    },
    ...(hiddenSpiritFacts.length
      ? [
          {
            level: '辅证' as const,
            title: '伏神与飞神配对事实',
            detail: `${hiddenSpiritFacts.map((item) => item.promptText).join('；')}；统一边界：${HIDDEN_SPIRIT_FACT_LIMITATION}`,
            source: '本宫首卦六亲全集、当前六亲差集与飞伏配对',
            tags: ['伏神', '飞神', '伏藏条件'],
          },
        ]
      : []),
    {
      level: '辅证',
      title: '六亲传统类象映射（非事实结论）',
      detail: traditionalSymbols
        .map(
          (item) =>
            `${item.relative}见于第${item.positions.join('、')}爻：${item.promptText}；边界：${item.limitation}`,
        )
        .join('；'),
      source: '传统六亲类象表与当前六亲排布逐项映射',
      tags: ['六亲类象', '条件化表达', '非事实结论'],
    },
    ...structureFacts.map((fact): PromptEvidenceItem => ({
      level: ['卦内三合', '日辰三合', '月建三合', '虚一待用'].includes(fact.kind) ? '辅证' : '限制',
      title: `${fact.kind}结构事实`,
      detail: `${fact.promptText}；边界：${fact.limitation}`,
      source: fact.sources.join('、'),
      tags: ['卦内结构', fact.kind],
    })),
    ...(godChain.length
      ? [
          {
            level: '辅证' as const,
            title: '用神原神忌神仇神五行作用链',
            detail: `${godChain.map((item) => item.promptText).join('；')}；统一边界：${GOD_CHAIN_FACT_LIMITATION}`,
            source: '当前选定候选五行、五行生克关系与逐爻五行匹配',
            tags: ['五行作用链', ...godChain.map((item) => item.role)],
          },
        ]
      : []),
    ...(godInteractionFacts.length
      ? [
          {
            level: '辅证' as const,
            title: '用神生克制化可追踪路径',
            detail: `${godInteractionFacts.map((item) => item.promptText).join('；')}；统一边界：${GOD_INTERACTION_FACT_LIMITATION}`,
            source: Array.from(new Set(godInteractionFacts.flatMap((item) => item.sources))).join(
              '、',
            ),
            tags: [
              '生克制化路径',
              ...Array.from(new Set(godInteractionFacts.map((item) => item.kind))),
            ],
          },
        ]
      : []),
    {
      level: godInteractionAssessmentFact.status === '资料不足' ? '反证' : '辅证',
      title: '用神全局生克作用态',
      detail: `${godInteractionAssessmentFact.promptText}；边界：${godInteractionAssessmentFact.limitation}`,
      source: godInteractionAssessmentFact.sources.join('、'),
      tags: [
        '全局生克作用态',
        godInteractionAssessmentFact.balanceStatus,
        godInteractionAssessmentFact.status,
      ],
    },
    {
      level: generationFact.status === '可核验' ? '辅证' : '反证',
      title: generationFact.status === '可核验' ? `起卦来源：${methodLabel}` : '起卦来源缺失',
      detail: `${generationFact.promptText}；边界：${generationFact.limitation}`,
      source: generationFact.sources.join('、'),
      tags: ['起卦来源', generationFact.method, generationFact.status],
    },
    ...(expectsRandomTrace
      ? [
          {
            level: randomFact.status === '可重放' ? ('辅证' as const) : ('反证' as const),
            title: randomFact.status === '可重放' ? '六爻随机重放记录' : '随机轨迹缺失',
            detail: `${randomFact.promptText}；边界：${randomFact.limitation}`,
            source: randomFact.sources.join('、'),
            tags: ['随机轨迹', randomFact.status, '不代表预测有效性'],
          },
        ]
      : []),
    {
      level: counterSummaryFact.status === '有明确反证' ? '反证' : '辅证',
      title: '候选反证覆盖状态',
      detail: `${counterSummaryFact.promptText}；边界：${counterSummaryFact.limitation}`,
      source: counterSummaryFact.sources.join('、'),
      tags: ['反证汇总', counterSummaryFact.status],
    },
    {
      level: '应期',
      title: '六爻触发与应期边界',
      detail: `${timingSummaryFact.promptText}；${timingFacts.map((item) => item.promptText).join('；')}；统一边界：${timingSummaryFact.limitation}`,
      source: Array.from(new Set(timingFacts.flatMap((item) => item.sources))).join('、'),
      tags: ['应期', '触发条件', '不换算固定日期'],
    },
    {
      level: '辅证',
      title: `六爻证据汇总：${summaryFact.status}`,
      detail: `${summaryFact.promptText}；边界：${summaryFact.limitation}`,
      source: summaryFact.sources.join('、'),
      tags: ['证据汇总', summaryFact.status],
    },
    {
      level: '限制',
      title: '六爻取用与作用链解释边界',
      detail: `${limitationFacts.map((item) => item.promptText).join('；')}；统一边界：${LIMITATION_FACT_LIMITATION}`,
      source: Array.from(new Set(limitationFacts.flatMap((item) => item.sources))).join('、'),
    },
  );
  const evidence: PromptEvidenceBundle = { title: '六爻用神作用链结构化证据', items };
  const calculationChain = calculationSteps.map((item) => item.promptText);
  const promptText = [
    '【六爻用神作用链结构化证据】',
    ...formatPromptEvidenceBundle(evidence),
    `计算链：${calculationChain.join(' → ')}。`,
    `证据汇总：${summaryFact.promptText}。`,
    godChain.length
      ? `作用链：${godChain.map((item) => item.promptText).join('；')}`
      : '作用链：当前用神六亲尚未明确或各层均无匹配，不以世应、动爻或数组顺序硬定原神、忌神与仇神。',
    godInteractionFacts.length
      ? `生克制化路径：${godInteractionFacts.map((item) => item.promptText).join('；')}`
      : '生克制化路径：当前用神尚未选定，或月日直接入用外未见可闭合路径，不补造作用关系。',
    `全局生克作用态：${godInteractionAssessmentFact.promptText}`,
    `触发条件：${timingConditions.join('；')}`,
    `解释限制：${limitations.join('；')}。`,
  ].join('\n');
  return {
    key: 'liuyao:evidence',
    status: '已计算',
    topic,
    monthBranch,
    dayBranch,
    candidates,
    selectedCandidate,
    godChain,
    godInteractionFacts,
    godInteractionAssessmentFact,
    traditionalSymbols,
    structureFacts,
    lineCoverageFact,
    lineFacts,
    hiddenSpiritCoverageFact,
    hiddenSpiritFacts,
    selectionFact,
    generationFact,
    generationFacts,
    randomFact,
    randomFacts,
    timingFacts,
    timingSummaryFact,
    timingConditions,
    counterEvidenceFacts,
    counterSummaryFact,
    counterEvidence,
    calculationSteps,
    calculationChain,
    summaryFact,
    limitations,
    limitationFacts,
    evidence,
    promptText,
    methodology: [
      '先按具体问题与求测关系确定六亲用神；通用或关系语义不足时保留待定，世应与动爻只作辅助观察。',
      '用神六亲明确后依次核验本卦明现、变爻显出、月日入用与伏神检索，不跨层混取；同层多现未能闭合时不按数组顺序强选。',
      '逐爻保留世应、发动、暗动、月令、月日同支合冲刑害、空破墓、回头生克和进退神证据；卦内三刑须按完整支组与发动条件另行成立。',
      '原神取生用神者，忌神取克用神者，仇神取生忌神并克原神者。',
      '按月日、真实明暗动、符合条件的旺相静爻、本位动变与飞伏生克重算直接及接续路径；路径允许并见，不按条数裁定最终强弱或吉凶。',
      '全局作用态只按生扶侧、克制侧与制化侧归组，并结合用神有气无根条件明确返回待综合判断或资料不足，不用多数票冒充最终可用性。',
      '六亲类象保留传统原始范围，提示词只把它作为随问题变化的候选，不把单一持世六亲写成现实事件。',
      '只输出支持、反证、限制和触发条件，不生成吉凶总分或成功率。',
    ],
  };
}
