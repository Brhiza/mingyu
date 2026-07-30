import type { MeihuaData, MeihuaDivinationMethod } from '../types/divination';
import { trigramsByIndex } from './hexagram-data';
import { getSeasonState, isKe, isSheng } from '../ganzhi';
import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import {
  buildRandomTraceFact,
  formatLegacyRandomFacts,
  type RandomTraceFact,
} from '../shared/random';

export type MeihuaEvidenceStageKey = 'origin' | 'process' | 'result';

export interface MeihuaInterResponseEvidence {
  key: string;
  role: '体互' | '用互';
  response: { name: string; element: string; seasonState: string };
  originalTi: { name: string; element: string; seasonState: string };
  relation: string;
  support: string[];
  constraints: string[];
  basis: string;
  promptText: string;
  sources: string[];
  limitation: '互卦响应事实只描述体互、用互分别对原体的五行关系，并按生体宜旺、克体宜衰及非克体应卦乘旺核验响应卦月令旺衰；原体月令旺衰只由主卦体卦事实登记一次，不在每项响应中重复计证；不得把体互与用互重新组成一对体用，也不得直接解释为现实吉凶、成败或概率';
}

export type MeihuaResponseRole = '主卦用卦' | '体互' | '用互' | '变卦用卦';

export interface MeihuaResponseReference {
  key: string;
  ownerFactKey: string;
  stage: MeihuaEvidenceStageKey;
  role: MeihuaResponseRole;
  name: string;
  element: string;
  seasonState: string;
  relationToOriginalTi: '生体' | '克体' | '与体比和' | '体生应卦' | '体克应卦';
}

export interface MeihuaPartyFact {
  key: 'meihua:party';
  status: '已计算' | '资料不足';
  classification:
    | '仅见体党较多'
    | '仅见用党较多'
    | '体党与用党均较多'
    | '体用同五行，党类重合'
    | '体用党均未达多项'
    | '资料不足';
  originalTi: { name: string; element: string };
  originalYong: { name: string; element: string };
  expectedResponseRoles: Array<'体互' | '用互' | '变卦用卦'>;
  actualResponseRoles: Array<'体互' | '用互' | '变卦用卦'>;
  missingResponseRoles: Array<'体互' | '用互' | '变卦用卦'>;
  tiPartyMembers: MeihuaResponseReference[];
  yongPartyMembers: MeihuaResponseReference[];
  tiPartyCount: number;
  yongPartyCount: number;
  support: string[];
  constraints: string[];
  promptText: string;
  sources: string[];
  limitation: '体党、用党事实只比较体互、用互、变卦用卦与原体、原用是否同五行；两项及以上才登记“党多”方向，资料缺失或体用同五行时不作相反裁断，也不得按党数换算强弱分数、吉凶或成功率';
}

export interface MeihuaResponseInteractionFact {
  key: string;
  status: '路径成立';
  controller: MeihuaResponseReference;
  target: MeihuaResponseReference;
  relation: string;
  targetEffect: '生体' | '克体';
  effectDirection: '生体之助受制' | '克体之患受制';
  support: string[];
  constraints: string[];
  promptText: string;
  sources: string[];
  limitation: '应卦制化事实只登记用卦、互卦、变卦之间可复算的五行克制路径，以及其削弱生体之助或缓解克体之患的方向；月令旺衰与其他路径仍须并看，不得按路径数量、多数票或先后顺序裁定最终强弱、现实吉凶或成功率';
}

export type MeihuaInternalMotionRole = '原体' | MeihuaResponseRole;

export interface MeihuaInternalMotionReference {
  key: string;
  ownerFactKey: string;
  stage: MeihuaEvidenceStageKey;
  role: MeihuaInternalMotionRole;
  name: string;
  element: string;
  motion: '动' | '静';
  basis: '体卦为静' | '互卦为静' | '用卦为动' | '变卦为动';
}

export interface MeihuaInternalMotionFact {
  key: 'meihua:internal-motion';
  status: '已计算' | '资料不足';
  movingYaoPosition: number;
  expectedRoles: MeihuaInternalMotionRole[];
  actualRoles: MeihuaInternalMotionRole[];
  missingRoles: MeihuaInternalMotionRole[];
  references: MeihuaInternalMotionReference[];
  movingRoles: MeihuaInternalMotionRole[];
  stillRoles: MeihuaInternalMotionRole[];
  promptText: string;
  sources: string[];
  limitation: '内卦动静事实只按《体用动静之诀》登记原体与互卦为静、主卦用卦与变卦响应为动，并与唯一动爻位置交叉核验；这里的动静是卦内角色，不等同于现场物体实际动静，也不得单独换算应验快慢、吉凶或现实事件';
}

export interface MeihuaExternalMotionFact {
  key: 'meihua:external-motion';
  status: '资料不足';
  requiredObservationFields: string[];
  availableObservationFields: string[];
  missingObservationFields: string[];
  promptText: string;
  sources: string[];
  limitation: '外应动静必须来自起卦现场对人事、器物、天地地理及求测者行卧坐立的实际观察；当前时间、数字、随机方式、问题文本与卦内动爻均不能替代现场资料，不得据缺失资料补造外应、应验快慢或吉凶';
}

export interface MeihuaStageEvidence {
  key: string;
  status: '已计算' | '卦象资料缺失';
  stage: MeihuaEvidenceStageKey;
  kind: '体用关系' | '互卦响应关系';
  label: string;
  hexagram: string;
  hexagramFactKey: string | null;
  ti?: { name: string; element: string; seasonState: string };
  yong?: { name: string; element: string; seasonState: string };
  relation?: string;
  originalTi?: { name: string; element: string; seasonState: string };
  responses?: MeihuaInterResponseEvidence[];
  support: string[];
  constraints: string[];
  basis: string;
  promptText: string;
  sources: string[];
  limitation: '阶段关系事实只描述主卦与变卦体用，或互卦体互、用互分别对原体的五行关系，并按体宜旺、生体宜旺、克体宜衰及非克体应卦乘旺核验月令旺衰；同一原体的月令旺衰只由主卦体卦事实登记一次，不随阶段或响应数量重复计证；阶段标签、支持或限制不得直接解释为现实起因、过程、结果、吉凶或成功率';
}

export interface MeihuaHexagramFact {
  key: string;
  status: '已记录';
  stage: MeihuaEvidenceStageKey;
  label: '主卦' | '互卦' | '变卦';
  hexagram: string;
  symbol: string;
  upperTrigram: string;
  lowerTrigram: string;
  promptText: string;
  sources: string[];
  limitation: '主互变卦象事实只记录当前上下经卦、卦名与卦符；不得由卦名或阶段位置直接推断现实事件、人物、吉凶、成败或应期';
}

export interface MeihuaYaoFact {
  key: string;
  status: '已计算';
  position: number;
  yaoType: string;
  tiYong: '体' | '用';
  isChanging: boolean;
  promptText: string;
  sources: string[];
  limitation: '逐爻事实只记录主卦自下而上的阴阳、体用归属与动爻位置；不得按爻位、阴阳数量或体用数量换算吉凶、概率、人物身份或固定日期';
}

export interface MeihuaYaoCoverageFact {
  key: 'meihua:yao-coverage';
  status: '完整' | '缺少爻位' | '爻位异常' | '动爻异常';
  expectedPositions: number[];
  actualPositions: number[];
  missingPositions: number[];
  duplicatePositions: number[];
  invalidPositions: number[];
  changingPositions: number[];
  yaoFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '六爻覆盖状态只说明当前主卦是否完整保存初爻至上爻且仅有一个动爻；缺少、重复、越界或动爻异常时不得补造阴阳、体用归属、互卦或变卦';
}

export interface MeihuaStageCoverageFact {
  key: 'meihua:stage-coverage';
  status: '完整' | '阶段缺失' | '阶段资料不完整';
  expectedStages: MeihuaEvidenceStageKey[];
  actualStages: MeihuaEvidenceStageKey[];
  missingStages: MeihuaEvidenceStageKey[];
  incompleteStages: MeihuaEvidenceStageKey[];
  stageFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '阶段覆盖状态只说明主卦体用、互卦响应与变卦体用事实是否齐全；阶段缺失或卦象资料不完整时不得反推互卦过程、变卦结果、卦名或上下经卦';
}

export interface MeihuaTransitionFact {
  key: string;
  status: '连续' | '跨阶段缺口';
  fromStageKey: string;
  toStageKey: string;
  fromStage: MeihuaEvidenceStageKey;
  toStage: MeihuaEvidenceStageKey;
  /** 兼容旧消费者；多项关系以分号连接，正式结构请读取 fromRelations。 */
  fromRelation: string;
  /** 兼容旧消费者；多项关系以分号连接，正式结构请读取 toRelations。 */
  toRelation: string;
  fromRelations: string[];
  toRelations: string[];
  promptText: string;
  sources: string[];
  limitation: '阶段推进事实只比较相邻已记录阶段的主变体用或互卦响应关系变化；不得把卦内先后直接写成现实事件必然按同样顺序发生，跨阶段缺口时更不得补造中间过程';
}

export interface MeihuaCounterEvidenceFact {
  key: string;
  ownerStageKey: string;
  stage: MeihuaEvidenceStageKey;
  type:
    | '体用关系限制'
    | '体卦月令限制'
    | '用卦月令限制'
    | '互卦响应关系限制'
    | '互卦响应月令限制'
    | '用党限制'
    | '应卦制化限制'
    | '现实复核限制';
  status: '已触发';
  detail: string;
  promptText: string;
  sources: string[];
  limitation: '反证事实只表示某一阶段存在体卦衰弱、体卦泄耗、生体之卦无力、克体之卦有力或关系未定等限制；不得把单项反证直接写成现实失败、灾祸、伤病、损失或必然结果';
}

export interface MeihuaCounterSummaryFact {
  key: 'meihua:counter-summary';
  status: '有明确反证' | '未见明确反证';
  factKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '反证汇总只说明当前阶段核验是否发现明确限制；同一原体月令条件只登记一次，未见明确反证不代表现实风险为零，也不得按反证数量换算吉凶总分或成功率';
}

export interface MeihuaTimingFact {
  key: string;
  order: number;
  type:
    | '动爻层位'
    | '卦数资料'
    | '体用生克'
    | '月建旺衰'
    | '体卦状态'
    | '原应期条件'
    | '克应资料覆盖'
    | '期限边界';
  sourceStatus: '原结果提供' | '由盘面补齐' | '资料不足' | '统一边界';
  ownerFactKeys: string[];
  rawText?: string;
  promptText: string;
  sources: string[];
  limitation: '应期事实只登记动爻层位、卦数、体用生克、月令旺衰及传统克应所缺现实条件；不得把爻位、卦数、体用生克、阶段数量或旺衰单独换算唯一日期或统一快慢，也不证明事件必然发生';
}

export interface MeihuaTimingSummaryFact {
  key: 'meihua:timing-summary';
  status: '已提供触发条件' | '仅有期限边界' | '资料不足';
  factKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '应期汇总只说明当前保存了哪些盘面事实以及还缺哪些传统克应条件；必要条件未齐时不得按条件数量、动爻、卦数、体用生克或旺衰生成统一快慢、固定天数、绝对日期或事件概率';
}

export interface MeihuaTraditionalFact {
  key: string;
  status: '已映射';
  stage: '主卦' | '互卦' | '变卦';
  hexagram: string;
  kind: '卦辞' | '爻辞' | '用辞';
  yaoPosition?: number;
  applicability: '当前卦辞辅助' | '当前动爻辅助' | '未发动背景' | '特殊用辞背景';
  originalText: string;
  promptText: string;
  traditionalSignals: string[];
  topicTags: string[];
  sources: string[];
  limitation: '卦辞与爻辞是《周易》传统取象原文，只用于当前主互变结构和动爻层位的辅助解释，不证明现实吉凶、婚育、疾病、伤亡、诉讼、财物得失、人物意图或固定时间结果';
}

export interface MeihuaCalculationStep {
  key: string;
  target: '上卦' | '下卦' | '动爻';
  expression: string;
  modulus?: 6 | 8;
  result?: number;
  promptText: string;
}

export interface MeihuaCalculationFact {
  key: string;
  status: '完整' | '缺少中间参数';
  methodKey: MeihuaDivinationMethod | '未记录';
  methodLabel: string;
  inputs: Record<string, string | number>;
  steps: MeihuaCalculationStep[];
  resolvedResult: {
    upperTrigram: string;
    lowerTrigram: string;
    movingYao: number;
  };
  compatibilityNote?: string;
  promptText: string;
  sources: string[];
  limitation: '取数算式只证明当前上下卦与动爻索引如何由输入或随机取数得到，不证明卦象预测有效性、现实吉凶或固定应期';
}

export interface MeihuaEvidenceCalculationStep {
  key: string;
  stage:
    | '起卦取数核验'
    | '主互变卦象构造'
    | '六爻与动爻核验'
    | '阶段关系计算'
    | '阶段推进核验'
    | '反证与应期核验'
    | '证据汇总';
  status: '已计算' | '资料不足';
  inputs: Record<string, string | number | boolean | string[]>;
  result: Record<string, string | number | boolean | string[]>;
  dependsOnStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '计算步骤只证明起卦取数、主互变卦象、六爻动爻、主变体用、互卦响应、推进、反证与应期事实如何形成当前证据；不证明现实吉凶、预测有效性、事件概率或固定应期';
}

export interface MeihuaSummaryFact {
  key: 'meihua:evidence-summary';
  status: '证据链完整' | '部分资料缺失' | '阶段链不完整';
  factKeys: string[];
  hexagramFactCount: number;
  yaoFactCount: number;
  stageFactCount: number;
  interResponseFactCount: number;
  partyFactCount: number;
  responseInteractionFactCount: number;
  motionFactCount: number;
  transitionFactCount: number;
  traditionalFactCount: number;
  counterEvidenceCount: number;
  timingFactCount: number;
  promptText: string;
  sources: string[];
  limitation: '梅花证据汇总只统计起卦、主互变卦象、六爻动爻、主变体用、互卦响应、体用党、应卦制化、内外动静、推进、传统文本、反证与应期事实的覆盖情况；不得按数量生成吉凶总分、成功率、人物意图或唯一日期';
}

export interface MeihuaLimitationFact {
  key: string;
  type:
    | '起卦与随机来源边界'
    | '卦象与逐爻资料边界'
    | '阶段关系边界'
    | '体用动静边界'
    | '阶段推进与反证边界'
    | '应期边界'
    | '传统文本与高风险输出边界';
  status: '适用';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '限制事实用于约束梅花起卦、卦象、逐爻、体用、推进、传统卦爻辞与应期资料能够支持的解释范围，不得被反向当作现实吉凶、婚育疾病、伤亡诉讼、事件概率或固定应期的证据';
}

export interface MeihuaEvidenceAnalysis {
  key: 'meihua:evidence';
  status: '已计算';
  calculationFact: MeihuaCalculationFact;
  calculationFacts: string[];
  calculationSteps: MeihuaEvidenceCalculationStep[];
  calculationChain: string[];
  hexagramStructureFacts: MeihuaHexagramFact[];
  hexagramFacts: string[];
  yaoCoverageFact: MeihuaYaoCoverageFact;
  yaoStructureFacts: MeihuaYaoFact[];
  yaoFacts: string[];
  monthBranch: string;
  movingYao: number;
  stageCoverageFact: MeihuaStageCoverageFact;
  stages: MeihuaStageEvidence[];
  interResponseFacts: MeihuaInterResponseEvidence[];
  responseReferences: MeihuaResponseReference[];
  partyFact: MeihuaPartyFact;
  responseInteractionFacts: MeihuaResponseInteractionFact[];
  internalMotionFact: MeihuaInternalMotionFact;
  externalMotionFact: MeihuaExternalMotionFact;
  transitionFacts: MeihuaTransitionFact[];
  transitions: string[];
  timingFacts: MeihuaTimingFact[];
  timingSummaryFact: MeihuaTimingSummaryFact;
  timingConditions: string[];
  randomFact: RandomTraceFact;
  randomFacts: string[];
  counterEvidenceFacts: MeihuaCounterEvidenceFact[];
  counterSummaryFact: MeihuaCounterSummaryFact;
  counterEvidence: string[];
  traditionalFacts: MeihuaTraditionalFact[];
  summaryFact: MeihuaSummaryFact;
  limitations: string[];
  limitationFacts: MeihuaLimitationFact[];
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: string[];
}

const TRADITIONAL_FACT_LIMITATION =
  '卦辞与爻辞是《周易》传统取象原文，只用于当前主互变结构和动爻层位的辅助解释，不证明现实吉凶、婚育、疾病、伤亡、诉讼、财物得失、人物意图或固定时间结果' as const;
const CALCULATION_FACT_LIMITATION =
  '取数算式只证明当前上下卦与动爻索引如何由输入或随机取数得到，不证明卦象预测有效性、现实吉凶或固定应期' as const;
const STAGE_FACT_LIMITATION =
  '阶段关系事实只描述主卦与变卦体用，或互卦体互、用互分别对原体的五行关系，并按体宜旺、生体宜旺、克体宜衰及非克体应卦乘旺核验月令旺衰；同一原体的月令旺衰只由主卦体卦事实登记一次，不随阶段或响应数量重复计证；阶段标签、支持或限制不得直接解释为现实起因、过程、结果、吉凶或成功率' as const;
const INTER_RESPONSE_FACT_LIMITATION =
  '互卦响应事实只描述体互、用互分别对原体的五行关系，并按生体宜旺、克体宜衰及非克体应卦乘旺核验响应卦月令旺衰；原体月令旺衰只由主卦体卦事实登记一次，不在每项响应中重复计证；不得把体互与用互重新组成一对体用，也不得直接解释为现实吉凶、成败或概率' as const;
const PARTY_FACT_LIMITATION =
  '体党、用党事实只比较体互、用互、变卦用卦与原体、原用是否同五行；两项及以上才登记“党多”方向，资料缺失或体用同五行时不作相反裁断，也不得按党数换算强弱分数、吉凶或成功率' as const;
const RESPONSE_INTERACTION_FACT_LIMITATION =
  '应卦制化事实只登记用卦、互卦、变卦之间可复算的五行克制路径，以及其削弱生体之助或缓解克体之患的方向；月令旺衰与其他路径仍须并看，不得按路径数量、多数票或先后顺序裁定最终强弱、现实吉凶或成功率' as const;
const INTERNAL_MOTION_FACT_LIMITATION =
  '内卦动静事实只按《体用动静之诀》登记原体与互卦为静、主卦用卦与变卦响应为动，并与唯一动爻位置交叉核验；这里的动静是卦内角色，不等同于现场物体实际动静，也不得单独换算应验快慢、吉凶或现实事件' as const;
const EXTERNAL_MOTION_FACT_LIMITATION =
  '外应动静必须来自起卦现场对人事、器物、天地地理及求测者行卧坐立的实际观察；当前时间、数字、随机方式、问题文本与卦内动爻均不能替代现场资料，不得据缺失资料补造外应、应验快慢或吉凶' as const;
const HEXAGRAM_FACT_LIMITATION =
  '主互变卦象事实只记录当前上下经卦、卦名与卦符；不得由卦名或阶段位置直接推断现实事件、人物、吉凶、成败或应期' as const;
const YAO_FACT_LIMITATION =
  '逐爻事实只记录主卦自下而上的阴阳、体用归属与动爻位置；不得按爻位、阴阳数量或体用数量换算吉凶、概率、人物身份或固定日期' as const;
const YAO_COVERAGE_LIMITATION =
  '六爻覆盖状态只说明当前主卦是否完整保存初爻至上爻且仅有一个动爻；缺少、重复、越界或动爻异常时不得补造阴阳、体用归属、互卦或变卦' as const;
const STAGE_COVERAGE_LIMITATION =
  '阶段覆盖状态只说明主卦体用、互卦响应与变卦体用事实是否齐全；阶段缺失或卦象资料不完整时不得反推互卦过程、变卦结果、卦名或上下经卦' as const;
const TRANSITION_FACT_LIMITATION =
  '阶段推进事实只比较相邻已记录阶段的主变体用或互卦响应关系变化；不得把卦内先后直接写成现实事件必然按同样顺序发生，跨阶段缺口时更不得补造中间过程' as const;
const COUNTER_FACT_LIMITATION =
  '反证事实只表示某一阶段存在体卦衰弱、体卦泄耗、生体之卦无力、克体之卦有力或关系未定等限制；不得把单项反证直接写成现实失败、灾祸、伤病、损失或必然结果' as const;
const COUNTER_SUMMARY_LIMITATION =
  '反证汇总只说明当前阶段核验是否发现明确限制；同一原体月令条件只登记一次，未见明确反证不代表现实风险为零，也不得按反证数量换算吉凶总分或成功率' as const;
const TIMING_FACT_LIMITATION =
  '应期事实只登记动爻层位、卦数、体用生克、月令旺衰及传统克应所缺现实条件；不得把爻位、卦数、体用生克、阶段数量或旺衰单独换算唯一日期或统一快慢，也不证明事件必然发生' as const;
const TIMING_SUMMARY_LIMITATION =
  '应期汇总只说明当前保存了哪些盘面事实以及还缺哪些传统克应条件；必要条件未齐时不得按条件数量、动爻、卦数、体用生克或旺衰生成统一快慢、固定天数、绝对日期或事件概率' as const;
const CALCULATION_STEP_LIMITATION =
  '计算步骤只证明起卦取数、主互变卦象、六爻动爻、主变体用、互卦响应、推进、反证与应期事实如何形成当前证据；不证明现实吉凶、预测有效性、事件概率或固定应期' as const;
const SUMMARY_FACT_LIMITATION =
  '梅花证据汇总只统计起卦、主互变卦象、六爻动爻、主变体用、互卦响应、体用党、应卦制化、内外动静、推进、传统文本、反证与应期事实的覆盖情况；不得按数量生成吉凶总分、成功率、人物意图或唯一日期' as const;
const LIMITATION_FACT_LIMITATION =
  '限制事实用于约束梅花起卦、卦象、逐爻、体用、推进、传统卦爻辞与应期资料能够支持的解释范围，不得被反向当作现实吉凶、婚育疾病、伤亡诉讼、事件概率或固定应期的证据' as const;

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function classifyTraditionalSignals(text: string): string[] {
  const riskText = text.replace(/无咎|无悔|悔亡|无不利/g, '');
  const signals = unique([
    /吉|亨|利|无咎|悔亡|无悔|无不利/.test(text) ? '传统有利或通达标签' : '',
    /凶|厉|吝|悔|咎|灾|不利|无攸利/.test(riskText) ? '传统风险或受限标签' : '',
    /贞|永贞/.test(text) ? '守正与持续条件标签' : '',
    /往|征|涉|行|进|退|出|入/.test(text) ? '行动与进退标签' : '',
  ]);
  return signals.length ? signals : ['未见明确吉凶或进退标签'];
}

function classifyTraditionalTopics(text: string): string[] {
  const topics = unique([
    /女|妇|婚|归妹|孕|夫|妻/.test(text) ? '关系与婚育类象' : '',
    /死|疾|病|灾|伤|血|丧|亡/.test(text) ? '健康伤亡与损失类象' : '',
    /讼|狱|刑|伐|师|寇|攻/.test(text) ? '争议、刑罚与攻守类象' : '',
    /财|资|获|得|食|畜|货/.test(text) ? '资源与得失类象' : '',
    /年|月|日|岁|旬|三年|八月/.test(text) ? '传统时间措辞' : '',
    /王|君子|大人|小人|侯/.test(text) ? '身份与角色类象' : '',
  ]);
  return topics.length ? topics : ['通用处境类象'];
}

export function conditionMeihuaTraditionalText(
  text: string,
  context: {
    stage: MeihuaTraditionalFact['stage'];
    hexagram: string;
    kind: MeihuaTraditionalFact['kind'];
    yaoPosition?: number;
    isMoving?: boolean;
  },
): Pick<MeihuaTraditionalFact, 'promptText' | 'traditionalSignals' | 'topicTags'> {
  const traditionalSignals = classifyTraditionalSignals(text);
  const topicTags = classifyTraditionalTopics(text);
  const signalText = traditionalSignals.join('、') || '未见明确吉凶或进退标签';
  const topicText = topicTags.join('、') || '通用处境类象';
  const location =
    context.kind === '卦辞'
      ? `${context.stage}${context.hexagram}卦辞`
      : context.kind === '用辞'
        ? `${context.stage}${context.hexagram}特殊用辞`
        : `${context.stage}${context.hexagram}第${context.yaoPosition ?? '?'}爻爻辞`;
  const applicability =
    context.kind === '卦辞'
      ? '只作为该阶段卦象的传统分类辅助'
      : context.kind === '用辞'
        ? '本次采用单动爻起卦口径，不满足六爻皆变的特殊用辞条件，因此不作为本次判断依据'
        : context.stage === '主卦' && context.isMoving
          ? '当前爻位已发动，可作为动爻层位的传统辅助'
          : '当前爻位未发动，不作为独立判断依据';
  return {
    promptText: `${location}包含${signalText}，涉及${topicText}；${applicability}，须以体用生克、主互变推进和现实资料复核，不把古辞中的吉凶、人物、婚育、伤亡或时间措辞直接当作现实结论`,
    traditionalSignals,
    topicTags,
  };
}

function buildTraditionalFacts(data: MeihuaData): MeihuaTraditionalFact[] {
  const stages = [
    ['主卦', data.mainHexagram],
    ['互卦', data.interHexagram],
    ['变卦', data.changedHexagram],
  ] as const;
  return stages.flatMap(([stage, hexagram]) => {
    if (!hexagram) return [];
    const description = conditionMeihuaTraditionalText(hexagram.description, {
      stage,
      hexagram: hexagram.name,
      kind: '卦辞',
    });
    const guaFact: MeihuaTraditionalFact = {
      key: `${stage}:${hexagram.name}:卦辞`,
      status: '已映射',
      stage,
      hexagram: hexagram.name,
      kind: '卦辞',
      applicability: '当前卦辞辅助',
      originalText: hexagram.description,
      promptText: description.promptText,
      traditionalSignals: description.traditionalSignals,
      topicTags: description.topicTags,
      sources: ['《周易》卦辞', '当前六十四卦原文资料'],
      limitation: TRADITIONAL_FACT_LIMITATION,
    };
    const yaoFacts = (hexagram.yaoCi ?? []).map((originalText, index): MeihuaTraditionalFact => {
      const yaoPosition = index + 1;
      const isMoving = stage === '主卦' && yaoPosition === data.movingYao.position;
      const conditioned = conditionMeihuaTraditionalText(originalText, {
        stage,
        hexagram: hexagram.name,
        kind: '爻辞',
        yaoPosition,
        isMoving,
      });
      return {
        key: `${stage}:${hexagram.name}:爻辞:${yaoPosition}`,
        status: '已映射',
        stage,
        hexagram: hexagram.name,
        kind: '爻辞',
        yaoPosition,
        applicability: isMoving ? '当前动爻辅助' : '未发动背景',
        originalText,
        promptText: conditioned.promptText,
        traditionalSignals: conditioned.traditionalSignals,
        topicTags: conditioned.topicTags,
        sources: ['《周易》爻辞', '当前六十四卦逐爻原文资料'],
        limitation: TRADITIONAL_FACT_LIMITATION,
      };
    });
    const yongFact = hexagram.yongCi
      ? (() => {
          const conditioned = conditionMeihuaTraditionalText(hexagram.yongCi, {
            stage,
            hexagram: hexagram.name,
            kind: '用辞',
          });
          return {
            key: `${stage}:${hexagram.name}:用辞`,
            status: '已映射',
            stage,
            hexagram: hexagram.name,
            kind: '用辞',
            applicability: '特殊用辞背景',
            originalText: hexagram.yongCi,
            promptText: conditioned.promptText,
            traditionalSignals: conditioned.traditionalSignals,
            topicTags: conditioned.topicTags,
            sources: ['《周易》乾坤用九用六', '当前六十四卦特殊用辞资料'],
            limitation: TRADITIONAL_FACT_LIMITATION,
          } satisfies MeihuaTraditionalFact;
        })()
      : null;
    return [guaFact, ...yaoFacts, ...(yongFact ? [yongFact] : [])];
  });
}

const trigramByName = new Map(
  Object.values(trigramsByIndex)
    .filter(Boolean)
    .map((item) => [item.name, item]),
);

function relationOf(yong: string, ti: string) {
  if (yong === ti) return '比和';
  if (isSheng(yong, ti)) return '用生体';
  if (isSheng(ti, yong)) return '体生用';
  if (isKe(yong, ti)) return '用克体';
  if (isKe(ti, yong)) return '体克用';
  return '关系未定';
}

function relationEvidence(relation: string) {
  switch (relation) {
    case '用生体':
      return { support: ['用卦生扶体卦'], constraints: [] };
    case '比和':
      return { support: ['体用同五行，关系同气'], constraints: [] };
    case '体克用':
      return { support: ['体卦对用卦具有制约能力'], constraints: [] };
    case '体生用':
      return { support: [], constraints: ['体卦生用卦，体卦存在泄耗'] };
    case '用克体':
      return { support: [], constraints: ['用卦克体，克体关系成立'] };
    default:
      return { support: [], constraints: ['现有资料不足以确定五行关系'] };
  }
}

function bodyStateEvidence(label: '体卦' | '原体', state: string) {
  if (state === '旺' || state === '相')
    return { support: [`${label}得月令${state}`], constraints: [] };
  if (state === '休' || state === '囚' || state === '死') {
    return { support: [], constraints: [`${label}月令${state}`] };
  }
  return { support: [], constraints: [] };
}

function responseStateEvidence(params: {
  relation: '生体' | '克体' | '不克体';
  responseLabel: '用卦' | '体互' | '用互';
  bodyLabel: '体' | '原体';
  state: string;
}) {
  const relationText = `${params.responseLabel}${params.relation === '生体' ? '生' : '克'}${params.bodyLabel}`;
  if (params.state === '旺' || params.state === '相') {
    if (params.relation === '生体') {
      return { support: [`${relationText}且月令${params.state}，生体之气有力`], constraints: [] };
    }
    if (params.relation === '克体') {
      return { support: [], constraints: [`${relationText}且月令${params.state}，克体之气有力`] };
    }
    return {
      support: [
        `${params.responseLabel}月令${params.state}且不克${params.bodyLabel}，响应之气有力`,
      ],
      constraints: [],
    };
  }
  if (params.state === '休' || params.state === '囚' || params.state === '死') {
    if (params.relation === '生体') {
      return {
        support: [],
        constraints: [`${relationText}但月令${params.state}，生体之力受月令限制`],
      };
    }
    if (params.relation === '克体') {
      return {
        support: [`${relationText}但月令${params.state}，克体之气受月令限制`],
        constraints: [],
      };
    }
  }
  return { support: [], constraints: [] };
}

function createTiYongStage(params: {
  stage: 'origin' | 'result';
  label: string;
  hexagram: string;
  hexagramFactKey: string | null;
  ti: { name: string; element: string };
  yong: { name: string; element: string };
  monthBranch: string;
  basis: string;
}): MeihuaStageEvidence {
  const relation = relationOf(params.yong.element, params.ti.element);
  const relationItems = relationEvidence(relation);
  const tiState = getSeasonState(params.ti.element, params.monthBranch);
  const yongState = getSeasonState(params.yong.element, params.monthBranch);
  // 原体在主、互、变中始终不变，月令旺衰只归主卦登记一次；
  // 变卦仍保留体卦 seasonState 供核验，但不把同一条件再次计作支持或限制。
  const tiItems =
    params.stage === 'origin'
      ? bodyStateEvidence('体卦', tiState)
      : { support: [], constraints: [] };
  const yongRelation =
    relation === '用生体'
      ? '生体'
      : relation === '用克体'
        ? '克体'
        : relation === '比和' || relation === '体生用' || relation === '体克用'
          ? '不克体'
          : undefined;
  const yongItems = yongRelation
    ? responseStateEvidence({
        relation: yongRelation,
        responseLabel: '用卦',
        bodyLabel: '体',
        state: yongState,
      })
    : { support: [], constraints: [] };
  const stage: MeihuaStageEvidence = {
    key: `meihua:stage:${params.stage}`,
    status: params.hexagramFactKey ? '已计算' : '卦象资料缺失',
    stage: params.stage,
    kind: '体用关系',
    label: params.label,
    hexagram: params.hexagram,
    hexagramFactKey: params.hexagramFactKey,
    ti: { ...params.ti, seasonState: tiState },
    yong: { ...params.yong, seasonState: yongState },
    relation,
    support: [...relationItems.support, ...tiItems.support, ...yongItems.support],
    constraints: [...relationItems.constraints, ...tiItems.constraints, ...yongItems.constraints],
    basis: params.basis,
    promptText: '',
    sources: [
      '动爻所在经卦定体用规则',
      '主卦与变卦上下经卦五行',
      '《梅花易数》卷三《体用衰旺之诀》体宜旺、生体宜旺、克体宜衰及用互变非克体者乘旺',
      `月建${params.monthBranch}与五行旺相休囚死关系`,
    ],
    limitation: STAGE_FACT_LIMITATION,
  };
  stage.promptText = `${formatStage(stage)}；依据：${stage.basis}；支持：${stage.support.join('、') || '未见额外增强'}；限制：${stage.constraints.join('、') || '未见明确盘内限制'}${stage.status === '卦象资料缺失' ? '；对应卦象结构资料缺失，不得补造卦名、卦符或上下经卦' : ''}`;
  return stage;
}

function formatStage(stage: MeihuaStageEvidence) {
  if (stage.kind === '互卦响应关系') {
    return `${stage.label}${stage.hexagram}：原体${stage.originalTi?.name}${stage.originalTi?.element}（月令${stage.originalTi?.seasonState}）；${(stage.responses ?? []).map((item) => `${item.role}${item.response.name}${item.response.element}（月令${item.response.seasonState}），${item.relation}`).join('；')}`;
  }
  return `${stage.label}${stage.hexagram}：体卦${stage.ti?.name}${stage.ti?.element}（月令${stage.ti?.seasonState}），用卦${stage.yong?.name}${stage.yong?.element}（月令${stage.yong?.seasonState}），关系${stage.relation}`;
}

function relationToOriginalTi(
  role: MeihuaInterResponseEvidence['role'],
  responseElement: string,
  originalTiElement: string,
) {
  if (responseElement === originalTiElement) return `${role}与原体比和`;
  if (isSheng(responseElement, originalTiElement)) return `${role}生原体`;
  if (isSheng(originalTiElement, responseElement)) return `原体生${role}`;
  if (isKe(responseElement, originalTiElement)) return `${role}克原体`;
  if (isKe(originalTiElement, responseElement)) return `原体克${role}`;
  return `${role}与原体关系未定`;
}

function interResponseEvidence(relation: string, role: MeihuaInterResponseEvidence['role']) {
  if (relation === `${role}生原体`) return { support: [`${role}生扶原体`], constraints: [] };
  if (relation === `${role}与原体比和`) {
    return { support: [`${role}与原体同五行`], constraints: [] };
  }
  if (relation === `原体克${role}`) {
    return { support: [`原体对${role}具有制约能力`], constraints: [] };
  }
  if (relation === `原体生${role}`) {
    return { support: [], constraints: [`原体生${role}，原体存在泄耗`] };
  }
  if (relation === `${role}克原体`) {
    return { support: [], constraints: [`${role}克原体，克体关系成立`] };
  }
  return { support: [], constraints: [`${role}与原体的五行关系未定`] };
}

function createInterResponseFact(params: {
  role: MeihuaInterResponseEvidence['role'];
  response: { name: string; element: string };
  originalTi: { name: string; element: string };
  monthBranch: string;
  basis: string;
}): MeihuaInterResponseEvidence {
  const relation = relationToOriginalTi(
    params.role,
    params.response.element,
    params.originalTi.element,
  );
  const relationItems = interResponseEvidence(relation, params.role);
  const originalTiState = getSeasonState(params.originalTi.element, params.monthBranch);
  const responseState = getSeasonState(params.response.element, params.monthBranch);
  const responseRelation =
    relation === `${params.role}生原体`
      ? '生体'
      : relation === `${params.role}克原体`
        ? '克体'
        : relation === `${params.role}与原体比和` ||
            relation === `原体生${params.role}` ||
            relation === `原体克${params.role}`
          ? '不克体'
          : undefined;
  const responseItems = responseRelation
    ? responseStateEvidence({
        relation: responseRelation,
        responseLabel: params.role,
        bodyLabel: '原体',
        state: responseState,
      })
    : { support: [], constraints: [] };
  const fact: MeihuaInterResponseEvidence = {
    key: `meihua:inter-response:${params.role === '体互' ? 'ti' : 'yong'}`,
    role: params.role,
    response: { ...params.response, seasonState: responseState },
    originalTi: { ...params.originalTi, seasonState: originalTiState },
    relation,
    // 原体旺衰已由主卦体卦事实统一登记；每项互卦响应只登记自身关系与旺衰，
    // 避免同一原体条件随响应数量重复成为多条支持或反证。
    support: [...relationItems.support, ...responseItems.support],
    constraints: [...relationItems.constraints, ...responseItems.constraints],
    basis: params.basis,
    promptText: '',
    sources: [
      '《梅花易数》卷三《体用互变之诀》体互、用互方位规则',
      '《梅花易数》卷三《体用衰旺之诀》体宜旺、生体宜旺、克体宜衰及用互变非克体者乘旺',
      `月建${params.monthBranch}与五行旺相休囚死关系`,
    ],
    limitation: INTER_RESPONSE_FACT_LIMITATION,
  };
  fact.promptText = `${fact.role}${fact.response.name}${fact.response.element}（月令${fact.response.seasonState}）对原体${fact.originalTi.name}${fact.originalTi.element}（月令${fact.originalTi.seasonState}）：${fact.relation}；依据：${fact.basis}；支持：${fact.support.join('、') || '未见额外增强'}；限制：${fact.constraints.join('、') || '未见明确盘内限制'}`;
  return fact;
}

function createProcessStage(params: {
  hexagram: string;
  originalTi: { name: string; element: string };
  responses: MeihuaInterResponseEvidence[];
  basis: string;
}): MeihuaStageEvidence {
  const originalTi = params.responses[0]?.originalTi ?? {
    ...params.originalTi,
    seasonState: '未知',
  };
  const stage: MeihuaStageEvidence = {
    key: 'meihua:stage:process',
    status: '已计算',
    stage: 'process',
    kind: '互卦响应关系',
    label: '过程',
    hexagram: params.hexagram,
    hexagramFactKey: 'meihua:hexagram:process',
    originalTi,
    responses: params.responses,
    support: unique(params.responses.flatMap((item) => item.support)),
    constraints: unique(params.responses.flatMap((item) => item.constraints)),
    basis: params.basis,
    promptText: '',
    sources: unique(params.responses.flatMap((item) => item.sources)),
    limitation: STAGE_FACT_LIMITATION,
  };
  stage.promptText = `${formatStage(stage)}；依据：${stage.basis}；支持：${stage.support.join('、') || '未见额外增强'}；限制：${stage.constraints.join('、') || '未见明确盘内限制'}；体互与用互均为应，分别对原体核验，不在互卦内部重分体用`;
  return stage;
}

function relationToOriginalBody(
  responseElement: string,
  originalTiElement: string,
): MeihuaResponseReference['relationToOriginalTi'] {
  if (responseElement === originalTiElement) return '与体比和';
  if (isSheng(responseElement, originalTiElement)) return '生体';
  if (isSheng(originalTiElement, responseElement)) return '体生应卦';
  if (isKe(responseElement, originalTiElement)) return '克体';
  return '体克应卦';
}

function buildResponseReferences(
  stages: MeihuaStageEvidence[],
  interResponseFacts: MeihuaInterResponseEvidence[],
): MeihuaResponseReference[] {
  const origin = stages.find((item) => item.stage === 'origin');
  const result = stages.find((item) => item.stage === 'result');
  const originalTiElement = origin?.ti?.element;
  if (!origin?.yong || !originalTiElement) return [];

  const references: MeihuaResponseReference[] = [
    {
      key: 'meihua:response:origin-yong',
      ownerFactKey: origin.key,
      stage: 'origin',
      role: '主卦用卦',
      name: origin.yong.name,
      element: origin.yong.element,
      seasonState: origin.yong.seasonState,
      relationToOriginalTi: relationToOriginalBody(origin.yong.element, originalTiElement),
    },
    ...interResponseFacts.map((fact): MeihuaResponseReference => ({
      key: `meihua:response:${fact.role === '体互' ? 'inter-ti' : 'inter-yong'}`,
      ownerFactKey: fact.key,
      stage: 'process',
      role: fact.role,
      name: fact.response.name,
      element: fact.response.element,
      seasonState: fact.response.seasonState,
      relationToOriginalTi: relationToOriginalBody(fact.response.element, originalTiElement),
    })),
  ];
  if (result?.yong) {
    references.push({
      key: 'meihua:response:result-yong',
      ownerFactKey: result.key,
      stage: 'result',
      role: '变卦用卦',
      name: result.yong.name,
      element: result.yong.element,
      seasonState: result.yong.seasonState,
      relationToOriginalTi: relationToOriginalBody(result.yong.element, originalTiElement),
    });
  }
  return references;
}

function buildPartyFact(
  stages: MeihuaStageEvidence[],
  responseReferences: MeihuaResponseReference[],
): MeihuaPartyFact {
  const origin = stages.find((item) => item.stage === 'origin');
  if (!origin?.ti || !origin.yong) {
    throw new Error('梅花体党、用党事实缺少主卦原体或原用资料。');
  }
  const expectedResponseRoles = ['体互', '用互', '变卦用卦'] as const;
  const partyCandidates = responseReferences.filter(
    (item): item is MeihuaResponseReference & { role: (typeof expectedResponseRoles)[number] } =>
      item.role !== '主卦用卦',
  );
  const actualResponseRoles = expectedResponseRoles.filter((role) =>
    partyCandidates.some((item) => item.role === role),
  );
  const missingResponseRoles = expectedResponseRoles.filter(
    (role) => !actualResponseRoles.includes(role),
  );
  const tiPartyMembers = partyCandidates.filter((item) => item.element === origin.ti?.element);
  const yongPartyMembers = partyCandidates.filter((item) => item.element === origin.yong?.element);
  const status = missingResponseRoles.length ? '资料不足' : '已计算';
  const sameElement = origin.ti.element === origin.yong.element;
  const tiPartyIsMultiple = tiPartyMembers.length >= 2;
  const yongPartyIsMultiple = yongPartyMembers.length >= 2;
  const classification: MeihuaPartyFact['classification'] =
    status === '资料不足'
      ? '资料不足'
      : sameElement
        ? '体用同五行，党类重合'
        : tiPartyIsMultiple && yongPartyIsMultiple
          ? '体党与用党均较多'
          : tiPartyIsMultiple
            ? '仅见体党较多'
            : yongPartyIsMultiple
              ? '仅见用党较多'
              : '体用党均未达多项';
  const support =
    status === '已计算' && !sameElement && tiPartyIsMultiple
      ? [`体党${tiPartyMembers.length}项，原体同党较多`]
      : [];
  const constraints =
    status === '已计算' && !sameElement && yongPartyIsMultiple
      ? [`用党${yongPartyMembers.length}项，原用同党较多，体势受用党牵制`]
      : [];
  const fact: MeihuaPartyFact = {
    key: 'meihua:party',
    status,
    classification,
    originalTi: { name: origin.ti.name, element: origin.ti.element },
    originalYong: { name: origin.yong.name, element: origin.yong.element },
    expectedResponseRoles: [...expectedResponseRoles],
    actualResponseRoles,
    missingResponseRoles,
    tiPartyMembers,
    yongPartyMembers,
    tiPartyCount: tiPartyMembers.length,
    yongPartyCount: yongPartyMembers.length,
    support,
    constraints,
    promptText: '',
    sources: [
      '《梅花易数》卷二《体用总诀》体党多而体势盛、用党多则体势衰',
      '主卦原体、原用与体互、用互、变卦用卦五行逐项比较',
    ],
    limitation: PARTY_FACT_LIMITATION,
  };
  const tiMembers = fact.tiPartyMembers.map((item) => `${item.role}${item.name}${item.element}`);
  const yongMembers = fact.yongPartyMembers.map(
    (item) => `${item.role}${item.name}${item.element}`,
  );
  fact.promptText =
    status === '资料不足'
      ? `体用党资料不完整：缺少${missingResponseRoles.join('、')}，现有体党${tiMembers.join('、') || '未见'}、用党${yongMembers.join('、') || '未见'}，不得据缺失资料裁定党多`
      : `体党${fact.tiPartyCount}项（${tiMembers.join('、') || '未见'}），用党${fact.yongPartyCount}项（${yongMembers.join('、') || '未见'}），归类为${classification}；支持：${support.join('、') || '未形成体党多方向'}；限制：${constraints.join('、') || '未形成用党多方向'}`;
  return fact;
}

function buildResponseInteractionFacts(
  responseReferences: MeihuaResponseReference[],
): MeihuaResponseInteractionFact[] {
  const facts: MeihuaResponseInteractionFact[] = [];
  for (const target of responseReferences) {
    if (target.relationToOriginalTi !== '生体' && target.relationToOriginalTi !== '克体') {
      continue;
    }
    for (const controller of responseReferences) {
      if (controller.key === target.key || !isKe(controller.element, target.element)) continue;
      const easesConstraint = target.relationToOriginalTi === '克体';
      const direction = easesConstraint ? '克体之患受制' : '生体之助受制';
      const detail = `${direction}：${controller.role}${controller.name}${controller.element}克${target.role}${target.name}${target.element}`;
      const fact: MeihuaResponseInteractionFact = {
        key: `meihua:response-interaction:${controller.key.split(':').at(-1)}:${target.key.split(':').at(-1)}`,
        status: '路径成立',
        controller,
        target,
        relation: `${controller.role}克${target.role}`,
        targetEffect: target.relationToOriginalTi,
        effectDirection: direction,
        support: easesConstraint ? [detail] : [],
        constraints: easesConstraint ? [] : [detail],
        promptText: '',
        sources: [
          '《梅花易数》卷三《体用》生体之卦受克则其吉受制、克体之卦受克则其患稍解',
          '《梅花易数》卷三《衰旺论》生克仍须合看各卦月令盛衰',
        ],
        limitation: RESPONSE_INTERACTION_FACT_LIMITATION,
      };
      fact.promptText = `${detail}；制化方月令${controller.seasonState}，被制方月令${target.seasonState}；这里只登记制化方向，实际效力仍须合看旺衰与其他应卦路径`;
      facts.push(fact);
    }
  }
  return facts;
}

function buildInternalMotionFact(
  stages: MeihuaStageEvidence[],
  responseReferences: MeihuaResponseReference[],
  movingYaoPosition: number,
): MeihuaInternalMotionFact {
  const expectedRoles: MeihuaInternalMotionRole[] = [
    '原体',
    '主卦用卦',
    '体互',
    '用互',
    '变卦用卦',
  ];
  const origin = stages.find((item) => item.stage === 'origin');
  const references: MeihuaInternalMotionReference[] = [];
  if (origin?.ti) {
    references.push({
      key: 'meihua:internal-motion:original-ti',
      ownerFactKey: origin.key,
      stage: 'origin',
      role: '原体',
      name: origin.ti.name,
      element: origin.ti.element,
      motion: '静',
      basis: '体卦为静',
    });
  }
  for (const response of responseReferences) {
    const isInter = response.role === '体互' || response.role === '用互';
    references.push({
      key: `meihua:internal-motion:${response.key.split(':').at(-1)}`,
      ownerFactKey: response.ownerFactKey,
      stage: response.stage,
      role: response.role,
      name: response.name,
      element: response.element,
      motion: isInter ? '静' : '动',
      basis: isInter ? '互卦为静' : response.role === '主卦用卦' ? '用卦为动' : '变卦为动',
    });
  }
  const actualRoles = expectedRoles.filter((role) =>
    references.some((reference) => reference.role === role),
  );
  const missingRoles = expectedRoles.filter((role) => !actualRoles.includes(role));
  const status = missingRoles.length ? '资料不足' : '已计算';
  const movingRoles = references
    .filter((reference) => reference.motion === '动')
    .map((reference) => reference.role);
  const stillRoles = references
    .filter((reference) => reference.motion === '静')
    .map((reference) => reference.role);
  return {
    key: 'meihua:internal-motion',
    status,
    movingYaoPosition,
    expectedRoles,
    actualRoles,
    missingRoles,
    references,
    movingRoles,
    stillRoles,
    promptText:
      status === '已计算'
        ? `卦内动静分工：第${movingYaoPosition}爻所在主卦用卦与变卦响应为动，原体、体互、用互为静；这是体用角色层次，不是现场物体动静，也不单独裁定应验快慢`
        : `卦内动静资料不完整：缺少${missingRoles.join('、')}，只保留${references.map((reference) => `${reference.role}为${reference.motion}`).join('、') || '未见可复算角色'}，不得补造缺失角色或应验快慢`,
    sources: [
      '《梅花易数》卷三《体用动静之诀》体卦为静、互卦为静、用卦变卦则动',
      '主卦唯一动爻与原体、主用、体互、用互、变卦用卦结构逐项核验',
    ],
    limitation: INTERNAL_MOTION_FACT_LIMITATION,
  };
}

function buildExternalMotionFact(): MeihuaExternalMotionFact {
  const requiredObservationFields = [
    '外应对象或起卦触发物',
    '外应所属人事、器物或天地地理类别',
    '外应对象实际动静',
    '求测者行卧坐立姿态',
  ];
  return {
    key: 'meihua:external-motion',
    status: '资料不足',
    requiredObservationFields,
    availableObservationFields: [],
    missingObservationFields: [...requiredObservationFields],
    promptText:
      '当前输入未记录起卦现场的外应对象、对象类别、实际动静及求测者行卧坐立；不得把数字、时间、随机方式、问题文本或卦内动爻补写成外应，也不能据此裁定应验快慢',
    sources: [
      '《梅花易数》卷三《体用动静之诀》外应须区分人事、器物、天地地理及其实际动静',
      '当前梅花起卦输入字段与现场观察必要资料逐项对照',
    ],
    limitation: EXTERNAL_MOTION_FACT_LIMITATION,
  };
}

function stageRelations(stage: MeihuaStageEvidence) {
  return stage.kind === '互卦响应关系'
    ? (stage.responses ?? []).map((item) => item.relation)
    : stage.relation
      ? [stage.relation]
      : [];
}

function resolveTiYongFromHexagram(hexagram: { upper: string; lower: string }, movingYao: number) {
  const upper = trigramByName.get(hexagram.upper);
  const lower = trigramByName.get(hexagram.lower);
  if (!upper || !lower) return undefined;
  return movingYao <= 3 ? { ti: upper, yong: lower } : { ti: lower, yong: upper };
}

function hasFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function appendResolvedResultFacts(facts: string[], data: MeihuaData) {
  facts.push(
    `已确定起卦结果：上卦${data.mainHexagram.upper}、下卦${data.mainHexagram.lower}、动爻第${data.movingYao.position}爻`,
  );
}

function buildCalculationFacts(data: MeihuaData): string[] {
  const calculation = data.calculation;
  if (!calculation) return ['起卦计算过程未附，无法复核上下卦与动爻索引来源'];
  const facts = [`起卦方式：${calculation.method}`];
  if (calculation.methodKey === 'time' || calculation.methodKey === 'timeTrigram') {
    const hasCompleteTimeInputs =
      hasText(calculation.yearZhi) &&
      hasFiniteNumber(calculation.yearZhiIndex) &&
      hasFiniteNumber(calculation.month) &&
      hasFiniteNumber(calculation.day) &&
      hasText(calculation.timeZhi) &&
      hasFiniteNumber(calculation.timeZhiIndex) &&
      hasFiniteNumber(calculation.upperTrigramIndex) &&
      hasFiniteNumber(calculation.lowerTrigramIndex) &&
      hasFiniteNumber(calculation.movingYaoIndex);
    if (hasCompleteTimeInputs) {
      facts.push(
        `时间取数：农历年支${calculation.yearZhi}序${calculation.yearZhiIndex}、月数${calculation.month}、日数${calculation.day}、时支${calculation.timeZhi}序${calculation.timeZhiIndex}`,
        `上卦=(${calculation.yearZhiIndex}+${calculation.month}+${calculation.day})除8取余为${calculation.upperTrigramIndex}`,
        `下卦=(${calculation.yearZhiIndex}+${calculation.month}+${calculation.day}+${calculation.timeZhiIndex})除8取余为${calculation.lowerTrigramIndex}`,
        `动爻=(${calculation.yearZhiIndex}+${calculation.month}+${calculation.day}+${calculation.timeZhiIndex})除6取余为${calculation.movingYaoIndex}`,
      );
    } else {
      facts.push('现有资料未附完整时间取数中间参数，仅保留已确定卦象与动爻结果');
      appendResolvedResultFacts(facts, data);
    }
  } else if (calculation.methodKey === 'number') {
    if (hasFiniteNumber(calculation.number)) facts.push(`输入数字：${calculation.number}`);
    const hasCompleteNumberInputs =
      hasFiniteNumber(calculation.number) &&
      hasText(calculation.timeZhi) &&
      hasFiniteNumber(calculation.timeZhiIndex) &&
      hasFiniteNumber(calculation.totalWithTime) &&
      hasFiniteNumber(calculation.upperTrigramIndex) &&
      hasFiniteNumber(calculation.lowerTrigramIndex) &&
      hasFiniteNumber(calculation.movingYaoIndex);
    if (hasCompleteNumberInputs) {
      facts.push(
        `数字取数：输入${calculation.number}，时支${calculation.timeZhi}序${calculation.timeZhiIndex}，合计${calculation.totalWithTime}`,
        `上卦=${calculation.number}除8取余为${calculation.upperTrigramIndex}`,
        `下卦=${calculation.totalWithTime}除8取余为${calculation.lowerTrigramIndex}`,
        `动爻=${calculation.totalWithTime}除6取余为${calculation.movingYaoIndex}`,
      );
    } else {
      facts.push('现有资料未附完整数字取数中间参数，仅保留已确定卦象与动爻结果');
      appendResolvedResultFacts(facts, data);
    }
  } else if (calculation.methodKey === 'random') {
    if (
      hasFiniteNumber(calculation.upperTrigramIndex) &&
      hasFiniteNumber(calculation.lowerTrigramIndex) &&
      hasFiniteNumber(calculation.movingYaoIndex)
    ) {
      facts.push(
        `随机取数结果：上卦索引${calculation.upperTrigramIndex}、下卦索引${calculation.lowerTrigramIndex}、动爻${calculation.movingYaoIndex}`,
      );
    } else {
      facts.push('现有资料未附完整随机取数索引，仅保留已确定卦象与动爻结果');
      appendResolvedResultFacts(facts, data);
    }
  }
  if (hasText(calculation.compatibilityNote)) {
    facts.push(`兼容口径：${calculation.compatibilityNote}`);
  }
  return facts;
}

function buildMeihuaCalculationFact(data: MeihuaData): MeihuaCalculationFact {
  const calculation = data.calculation;
  const methodKey = calculation?.methodKey ?? '未记录';
  const inputs: Record<string, string | number> = {};
  const steps: MeihuaCalculationStep[] = [];
  if (calculation && (methodKey === 'time' || methodKey === 'timeTrigram')) {
    if (hasText(calculation.yearZhi)) inputs.yearZhi = calculation.yearZhi;
    if (hasFiniteNumber(calculation.yearZhiIndex)) inputs.yearZhiIndex = calculation.yearZhiIndex;
    if (hasFiniteNumber(calculation.month)) inputs.lunarMonth = calculation.month;
    if (hasFiniteNumber(calculation.day)) inputs.lunarDay = calculation.day;
    if (hasText(calculation.timeZhi)) inputs.timeZhi = calculation.timeZhi;
    if (hasFiniteNumber(calculation.timeZhiIndex)) inputs.timeZhiIndex = calculation.timeZhiIndex;
    if (
      hasFiniteNumber(calculation.yearZhiIndex) &&
      hasFiniteNumber(calculation.month) &&
      hasFiniteNumber(calculation.day) &&
      hasFiniteNumber(calculation.timeZhiIndex) &&
      hasFiniteNumber(calculation.upperTrigramIndex) &&
      hasFiniteNumber(calculation.lowerTrigramIndex) &&
      hasFiniteNumber(calculation.movingYaoIndex)
    ) {
      const upperExpression = `${calculation.yearZhiIndex}+${calculation.month}+${calculation.day}`;
      const totalExpression = `${upperExpression}+${calculation.timeZhiIndex}`;
      steps.push(
        {
          key: 'meihua:calculation:upper',
          target: '上卦',
          expression: upperExpression,
          modulus: 8,
          result: calculation.upperTrigramIndex,
          promptText: `上卦=(${upperExpression})除8取余为${calculation.upperTrigramIndex}`,
        },
        {
          key: 'meihua:calculation:lower',
          target: '下卦',
          expression: totalExpression,
          modulus: 8,
          result: calculation.lowerTrigramIndex,
          promptText: `下卦=(${totalExpression})除8取余为${calculation.lowerTrigramIndex}`,
        },
        {
          key: 'meihua:calculation:moving',
          target: '动爻',
          expression: totalExpression,
          modulus: 6,
          result: calculation.movingYaoIndex,
          promptText: `动爻=(${totalExpression})除6取余为${calculation.movingYaoIndex}`,
        },
      );
    }
  } else if (calculation && methodKey === 'number') {
    if (hasFiniteNumber(calculation.number)) inputs.number = calculation.number;
    if (hasText(calculation.timeZhi)) inputs.timeZhi = calculation.timeZhi;
    if (hasFiniteNumber(calculation.timeZhiIndex)) inputs.timeZhiIndex = calculation.timeZhiIndex;
    if (hasFiniteNumber(calculation.totalWithTime))
      inputs.totalWithTime = calculation.totalWithTime;
    if (
      hasFiniteNumber(calculation.number) &&
      hasFiniteNumber(calculation.totalWithTime) &&
      hasFiniteNumber(calculation.upperTrigramIndex) &&
      hasFiniteNumber(calculation.lowerTrigramIndex) &&
      hasFiniteNumber(calculation.movingYaoIndex)
    ) {
      steps.push(
        {
          key: 'meihua:calculation:upper',
          target: '上卦',
          expression: String(calculation.number),
          modulus: 8,
          result: calculation.upperTrigramIndex,
          promptText: `上卦=${calculation.number}除8取余为${calculation.upperTrigramIndex}`,
        },
        {
          key: 'meihua:calculation:lower',
          target: '下卦',
          expression: String(calculation.totalWithTime),
          modulus: 8,
          result: calculation.lowerTrigramIndex,
          promptText: `下卦=${calculation.totalWithTime}除8取余为${calculation.lowerTrigramIndex}`,
        },
        {
          key: 'meihua:calculation:moving',
          target: '动爻',
          expression: String(calculation.totalWithTime),
          modulus: 6,
          result: calculation.movingYaoIndex,
          promptText: `动爻=${calculation.totalWithTime}除6取余为${calculation.movingYaoIndex}`,
        },
      );
    }
  } else if (calculation && methodKey === 'random') {
    if (
      hasFiniteNumber(calculation.upperTrigramIndex) &&
      hasFiniteNumber(calculation.lowerTrigramIndex) &&
      hasFiniteNumber(calculation.movingYaoIndex)
    ) {
      steps.push(
        {
          key: 'meihua:calculation:upper',
          target: '上卦',
          expression: '随机整数1-8',
          result: calculation.upperTrigramIndex,
          promptText: `随机取上卦索引${calculation.upperTrigramIndex}`,
        },
        {
          key: 'meihua:calculation:lower',
          target: '下卦',
          expression: '随机整数1-8',
          result: calculation.lowerTrigramIndex,
          promptText: `随机取下卦索引${calculation.lowerTrigramIndex}`,
        },
        {
          key: 'meihua:calculation:moving',
          target: '动爻',
          expression: '随机整数1-6',
          result: calculation.movingYaoIndex,
          promptText: `随机取动爻索引${calculation.movingYaoIndex}`,
        },
      );
    }
  }
  const status = steps.length === 3 ? '完整' : '缺少中间参数';
  const calculationFacts = buildCalculationFacts(data);
  return {
    key: `calculation:meihua:${methodKey}`,
    status,
    methodKey,
    methodLabel: calculation?.method ?? '未记录起卦方式',
    inputs,
    steps,
    resolvedResult: {
      upperTrigram: data.mainHexagram.upper,
      lowerTrigram: data.mainHexagram.lower,
      movingYao: data.movingYao.position,
    },
    ...(hasText(calculation?.compatibilityNote)
      ? { compatibilityNote: calculation.compatibilityNote }
      : {}),
    promptText: calculationFacts.join('；'),
    sources: [
      methodKey === 'time' || methodKey === 'timeTrigram'
        ? '《梅花易数》年月日时取数与八卦、六爻取余规则'
        : methodKey === 'number'
          ? '输入数字、时支序与八卦、六爻取余规则'
          : methodKey === 'random'
            ? '随机上下卦与动爻索引记录'
            : '旧结果已确定的主卦与动爻资料',
      '当前主卦上下经卦与动爻结果',
    ],
    limitation: CALCULATION_FACT_LIMITATION,
  };
}

function buildHexagramStructureFacts(data: MeihuaData): MeihuaHexagramFact[] {
  const definitions = [
    { stage: 'origin', label: '主卦', hexagram: data.mainHexagram },
    { stage: 'process', label: '互卦', hexagram: data.interHexagram },
    { stage: 'result', label: '变卦', hexagram: data.changedHexagram },
  ] as const;
  return definitions.flatMap(({ stage, label, hexagram }) =>
    hexagram
      ? [
          {
            key: `meihua:hexagram:${stage}`,
            status: '已记录',
            stage,
            label,
            hexagram: hexagram.name,
            symbol: hexagram.symbol,
            upperTrigram: hexagram.upper,
            lowerTrigram: hexagram.lower,
            promptText: `${label}${hexagram.name}${hexagram.symbol}，上${hexagram.upper}下${hexagram.lower}`,
            sources: [
              stage === 'origin'
                ? '起卦上下经卦索引与六十四卦映射'
                : stage === 'process'
                  ? '主卦二三四爻为下互、三四五爻为上互'
                  : '主卦动爻阴阳翻转与六十四卦映射',
            ],
            limitation: HEXAGRAM_FACT_LIMITATION,
          } satisfies MeihuaHexagramFact,
        ]
      : [],
  );
}

function buildYaoStructureFacts(data: MeihuaData): MeihuaYaoFact[] {
  const occurrences = new Map<number, number>();
  const movingYao = data.movingYao.position;
  const canResolveTiYong = Number.isInteger(movingYao) && movingYao >= 1 && movingYao <= 6;
  const movingInLower = movingYao <= 3;
  return (data.yaosDetail ?? []).map((item) => {
    const occurrence = (occurrences.get(item.position) ?? 0) + 1;
    occurrences.set(item.position, occurrence);
    const tiYong =
      canResolveTiYong &&
      Number.isInteger(item.position) &&
      item.position >= 1 &&
      item.position <= 6
        ? movingInLower
          ? item.position <= 3
            ? '用'
            : '体'
          : item.position <= 3
            ? '体'
            : '用'
        : item.tiYong;
    return {
      key:
        occurrence === 1
          ? `meihua:yao:${item.position}`
          : `meihua:yao:${item.position}:occurrence:${occurrence}`,
      status: '已计算',
      position: item.position,
      yaoType: item.yaoType,
      tiYong,
      isChanging: item.isChanging,
      promptText: `第${item.position}爻为${item.yaoType}爻，属${tiYong}${item.isChanging ? '，本爻发动' : ''}`,
      sources: ['主卦六爻自下而上阴阳序列', '动爻所在上下经卦与体用归属'],
      limitation: YAO_FACT_LIMITATION,
    };
  });
}

function buildYaoCoverageFact(yaoFacts: MeihuaYaoFact[], movingYao: number): MeihuaYaoCoverageFact {
  const expectedPositions = [1, 2, 3, 4, 5, 6];
  const rawPositions = yaoFacts.map((item) => item.position);
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
  const changingPositions = yaoFacts
    .filter((item) => item.isChanging)
    .map((item) => item.position)
    .sort((left, right) => left - right);
  const status: MeihuaYaoCoverageFact['status'] =
    duplicatePositions.length || invalidPositions.length
      ? '爻位异常'
      : missingPositions.length
        ? '缺少爻位'
        : changingPositions.length !== 1 || changingPositions[0] !== movingYao
          ? '动爻异常'
          : '完整';
  const promptText =
    status === '完整'
      ? `六爻完整覆盖初爻至上爻，且仅第${movingYao}爻发动，可核验体用、互卦与变卦来源`
      : status === '缺少爻位'
        ? `六爻资料缺少第${missingPositions.join('、')}爻，不得补造缺失爻、互卦或变卦`
        : status === '爻位异常'
          ? `六爻位置异常：重复${duplicatePositions.join('、') || '无'}；越界${invalidPositions.join('、') || '无'}`
          : `动爻记录异常：逐爻标记为${changingPositions.join('、') || '无'}，排盘动爻为第${movingYao}爻，不得自行改写动爻`;
  return {
    key: 'meihua:yao-coverage',
    status,
    expectedPositions,
    actualPositions,
    missingPositions,
    duplicatePositions,
    invalidPositions,
    changingPositions,
    yaoFactKeys: yaoFacts.map((item) => item.key),
    promptText,
    sources: ['当前逐爻位置、唯一性与动爻标记完整性核验'],
    limitation: YAO_COVERAGE_LIMITATION,
  };
}

function buildStageCoverageFact(stages: MeihuaStageEvidence[]): MeihuaStageCoverageFact {
  const expectedStages: MeihuaEvidenceStageKey[] = ['origin', 'process', 'result'];
  const actualStages = stages.map((item) => item.stage);
  const missingStages = expectedStages.filter((stage) => !actualStages.includes(stage));
  const incompleteStages = stages
    .filter((item) => item.status === '卦象资料缺失')
    .map((item) => item.stage);
  const status: MeihuaStageCoverageFact['status'] = missingStages.length
    ? '阶段缺失'
    : incompleteStages.length
      ? '阶段资料不完整'
      : '完整';
  return {
    key: 'meihua:stage-coverage',
    status,
    expectedStages,
    actualStages,
    missingStages,
    incompleteStages,
    stageFactKeys: stages.map((item) => item.key),
    promptText:
      status === '阶段缺失'
        ? `主互变阶段资料缺少${missingStages.map((stage) => ({ origin: '主卦起因', process: '互卦过程', result: '变卦结果' })[stage]).join('、')}，不得反推缺失阶段关系`
        : status === '阶段资料不完整'
          ? `${incompleteStages.map((stage) => ({ origin: '主卦起因', process: '互卦过程', result: '变卦结果' })[stage]).join('、')}缺少对应卦象结构资料，不得补造卦名、卦符或上下经卦`
          : '主卦体用、互卦响应、变卦体用三阶段关系资料完整，可逐段核验',
    sources: ['主卦体用、互卦响应、变卦体用资料完整性核验'],
    limitation: STAGE_COVERAGE_LIMITATION,
  };
}

function buildTransitionFacts(stages: MeihuaStageEvidence[]): MeihuaTransitionFact[] {
  const order: Record<MeihuaEvidenceStageKey, number> = { origin: 0, process: 1, result: 2 };
  return stages.slice(1).map((stage, index) => {
    const previous = stages[index];
    const status = order[stage.stage] - order[previous.stage] === 1 ? '连续' : '跨阶段缺口';
    const fromRelations = stageRelations(previous);
    const toRelations = stageRelations(stage);
    const fromRelation = fromRelations.join('；');
    const toRelation = toRelations.join('；');
    return {
      key: `meihua:transition:${previous.stage}:${stage.stage}`,
      status,
      fromStageKey: previous.key,
      toStageKey: stage.key,
      fromStage: previous.stage,
      toStage: stage.stage,
      fromRelation,
      toRelation,
      fromRelations,
      toRelations,
      promptText: `${previous.label}${fromRelation || '关系资料缺失'} → ${stage.label}${toRelation || '关系资料缺失'}${status === '跨阶段缺口' ? '；中间阶段资料缺失，不补造过程' : ''}`,
      sources: ['已记录阶段顺序与主卦、变卦体用及互卦响应关系比较'],
      limitation: TRANSITION_FACT_LIMITATION,
    } satisfies MeihuaTransitionFact;
  });
}

function classifyCounterType(
  detail: string,
  stageKind: MeihuaStageEvidence['kind'],
): MeihuaCounterEvidenceFact['type'] {
  if (/^(体卦|原体)月令/.test(detail)) return '体卦月令限制';
  if (stageKind === '体用关系' && detail.startsWith('用卦') && detail.includes('月令')) {
    return '用卦月令限制';
  }
  if (/现实|仍须|核验/.test(detail)) return '现实复核限制';
  if (stageKind === '互卦响应关系') {
    return detail.includes('月令') ? '互卦响应月令限制' : '互卦响应关系限制';
  }
  return '体用关系限制';
}

function buildCounterEvidenceFacts(
  stages: MeihuaStageEvidence[],
  partyFact: MeihuaPartyFact,
  responseInteractionFacts: MeihuaResponseInteractionFact[],
): MeihuaCounterEvidenceFact[] {
  const stageFacts: MeihuaCounterEvidenceFact[] = stages.flatMap((stage) =>
    unique(stage.constraints).map((detail, index) => ({
      key: `meihua:counter:${stage.stage}:${index + 1}`,
      ownerStageKey: stage.key,
      stage: stage.stage,
      type: classifyCounterType(detail, stage.kind),
      status: '已触发',
      detail,
      promptText: `${stage.label}${stage.hexagram}：${detail}`,
      sources: ['对应阶段主变体用或互卦响应关系，并按体宜旺、生体宜旺、克体宜衰核验月令旺衰'],
      limitation: COUNTER_FACT_LIMITATION,
    })),
  );
  const originStage = stages.find((item) => item.stage === 'origin');
  const partyFacts: MeihuaCounterEvidenceFact[] = partyFact.constraints.map((detail, index) => ({
    key: `meihua:counter:party:${index + 1}`,
    ownerStageKey: originStage?.key ?? 'meihua:stage:origin',
    stage: 'origin',
    type: '用党限制',
    status: '已触发',
    detail,
    promptText: `体用党合看：${detail}`,
    sources: partyFact.sources,
    limitation: COUNTER_FACT_LIMITATION,
  }));
  const interactionFacts: MeihuaCounterEvidenceFact[] = responseInteractionFacts.flatMap((fact) =>
    fact.constraints.map((detail, index) => ({
      key: `meihua:counter:response-interaction:${responseInteractionFacts.indexOf(fact) + 1}:${index + 1}`,
      ownerStageKey: `meihua:stage:${fact.target.stage}`,
      stage: fact.target.stage,
      type: '应卦制化限制' as const,
      status: '已触发' as const,
      detail,
      promptText: fact.promptText,
      sources: fact.sources,
      limitation: COUNTER_FACT_LIMITATION,
    })),
  );
  return [...stageFacts, ...partyFacts, ...interactionFacts];
}

function buildTimingFacts(
  data: MeihuaData,
  stages: MeihuaStageEvidence[],
  monthBranch: string,
  calculationFact: MeihuaCalculationFact,
  yaoCoverageFact: MeihuaYaoCoverageFact,
  yaoFacts: MeihuaYaoFact[],
  internalMotionFact: MeihuaInternalMotionFact,
  externalMotionFact: MeihuaExternalMotionFact,
): MeihuaTimingFact[] {
  const facts: MeihuaTimingFact[] = [];
  const add = (fact: Omit<MeihuaTimingFact, 'order'>) => {
    if (facts.some((item) => item.promptText === fact.promptText)) return;
    facts.push({ ...fact, order: facts.length + 1 });
  };
  add({
    key: 'meihua:timing:moving-yao',
    type: '动爻层位',
    sourceStatus: '由盘面补齐',
    ownerFactKeys: [
      yaoCoverageFact.key,
      ...yaoFacts
        .filter((item) => item.position === data.movingYao.position && item.isChanging)
        .map((item) => item.key),
    ],
    promptText: `第${data.movingYao.position}爻为变化层位；爻位不固定对应现实事件的起步、内部、决策或结束阶段`,
    sources: ['当前动爻位置与六爻覆盖核验'],
    limitation: TIMING_FACT_LIMITATION,
  });
  const upperTrigramIndex = data.calculation?.upperTrigramIndex;
  const lowerTrigramIndex = data.calculation?.lowerTrigramIndex;
  if (typeof upperTrigramIndex === 'number' && typeof lowerTrigramIndex === 'number') {
    add({
      key: 'meihua:timing:gua-number',
      type: '卦数资料',
      sourceStatus: '由盘面补齐',
      ownerFactKeys: [calculationFact.key],
      promptText: `上下卦数和为${upperTrigramIndex + lowerTrigramIndex}，只登记取数结果；传统克应仍须先确定事件远近与年、月、日、时尺度`,
      sources: ['当前上下卦索引与起卦算式'],
      limitation: TIMING_FACT_LIMITATION,
    });
  }
  const originStage = stages.find((item) => item.stage === 'origin');
  add({
    key: 'meihua:timing:ti-yong',
    type: '体用生克',
    sourceStatus: '由盘面补齐',
    ownerFactKeys: originStage ? [originStage.key] : [calculationFact.key],
    promptText: `主卦体用关系为${data.analysis.tiYongRaw ?? data.analysis.tiYongRelation}，只作生克事实，不单独裁定应期快慢`,
    sources: ['当前主卦体用五行生克关系'],
    limitation: TIMING_FACT_LIMITATION,
  });
  add({
    key: 'meihua:timing:month-state',
    type: '月建旺衰',
    sourceStatus: '由盘面补齐',
    ownerFactKeys: originStage ? [originStage.key] : stages.map((item) => item.key),
    promptText: `月建${monthBranch}下体卦为${data.analysis.tiSeasonState}，只作盛衰事实，不单独裁定应期快慢`,
    sources: ['月支与主卦体卦五行旺相休囚死关系'],
    limitation: TIMING_FACT_LIMITATION,
  });
  add({
    key: 'meihua:timing:input-coverage',
    type: '克应资料覆盖',
    sourceStatus: '资料不足',
    ownerFactKeys: [externalMotionFact.key],
    promptText:
      '现有盘面未含求测者行卧坐立或外应动静、事件远近及年/月/日/时尺度，不能单独计算传统克应',
    sources: ['当前起卦输入与传统克应必要条件逐项对照'],
    limitation: TIMING_FACT_LIMITATION,
  });
  add({
    key: 'meihua:timing:deadline-boundary',
    type: '期限边界',
    sourceStatus: '统一边界',
    ownerFactKeys: [calculationFact.key, yaoCoverageFact.key, internalMotionFact.key],
    promptText:
      '克应资料补足前，只能保留动爻、卦数、体用和月令盘面事实，不能计算具体日期或统一快慢',
    sources: ['盘面事实与传统克应条件分离原则'],
    limitation: TIMING_FACT_LIMITATION,
  });
  return facts;
}

function buildSummaryFact(params: {
  calculationFact: MeihuaCalculationFact;
  randomFact: RandomTraceFact;
  hexagramStructureFacts: MeihuaHexagramFact[];
  yaoCoverageFact: MeihuaYaoCoverageFact;
  yaoStructureFacts: MeihuaYaoFact[];
  stageCoverageFact: MeihuaStageCoverageFact;
  stages: MeihuaStageEvidence[];
  interResponseFacts: MeihuaInterResponseEvidence[];
  partyFact: MeihuaPartyFact;
  responseInteractionFacts: MeihuaResponseInteractionFact[];
  internalMotionFact: MeihuaInternalMotionFact;
  externalMotionFact: MeihuaExternalMotionFact;
  transitionFacts: MeihuaTransitionFact[];
  traditionalFacts: MeihuaTraditionalFact[];
  counterEvidenceFacts: MeihuaCounterEvidenceFact[];
  counterSummaryFact: MeihuaCounterSummaryFact;
  timingFacts: MeihuaTimingFact[];
  timingSummaryFact: MeihuaTimingSummaryFact;
}): MeihuaSummaryFact {
  const factKeys = Array.from(
    new Set([
      params.calculationFact.key,
      params.randomFact.key,
      ...params.hexagramStructureFacts.map((item) => item.key),
      params.yaoCoverageFact.key,
      ...params.yaoStructureFacts.map((item) => item.key),
      params.stageCoverageFact.key,
      ...params.stages.map((item) => item.key),
      ...params.interResponseFacts.map((item) => item.key),
      params.partyFact.key,
      ...params.responseInteractionFacts.map((item) => item.key),
      params.internalMotionFact.key,
      params.externalMotionFact.key,
      ...params.transitionFacts.map((item) => item.key),
      ...params.traditionalFacts.map((item) => item.key),
      params.counterSummaryFact.key,
      ...params.counterEvidenceFacts.map((item) => item.key),
      params.timingSummaryFact.key,
      ...params.timingFacts.map((item) => item.key),
    ]),
  );
  const status =
    params.calculationFact.status !== '完整' || params.yaoCoverageFact.status !== '完整'
      ? '部分资料缺失'
      : params.stageCoverageFact.status !== '完整' ||
          params.transitionFacts.some((item) => item.status === '跨阶段缺口')
        ? '阶段链不完整'
        : '证据链完整';
  return {
    key: 'meihua:evidence-summary',
    status,
    factKeys,
    hexagramFactCount: params.hexagramStructureFacts.length,
    yaoFactCount: params.yaoStructureFacts.length,
    stageFactCount: params.stages.length,
    interResponseFactCount: params.interResponseFacts.length,
    partyFactCount: 1,
    responseInteractionFactCount: params.responseInteractionFacts.length,
    motionFactCount: 2,
    transitionFactCount: params.transitionFacts.length,
    traditionalFactCount: params.traditionalFacts.length,
    counterEvidenceCount: params.counterEvidenceFacts.length,
    timingFactCount: params.timingFacts.length,
    promptText: `证据状态${status}：主互变卦象${params.hexagramStructureFacts.length}项、逐爻${params.yaoStructureFacts.length}项、阶段关系${params.stages.length}项、互卦响应${params.interResponseFacts.length}项、体用党1项、应卦制化${params.responseInteractionFacts.length}项、内外动静2项、阶段推进${params.transitionFacts.length}项、传统卦爻辞${params.traditionalFacts.length}项、反证${params.counterEvidenceFacts.length}项、应期${params.timingFacts.length}项`,
    sources: [
      '全部起卦、主互变卦象、逐爻、主变体用、互卦响应、体用党、应卦制化、内外动静、推进、传统文本、反证与应期事实逐项汇总',
    ],
    limitation: SUMMARY_FACT_LIMITATION,
  };
}

function buildCalculationSteps(params: {
  calculationFact: MeihuaCalculationFact;
  randomFact: RandomTraceFact;
  hexagramStructureFacts: MeihuaHexagramFact[];
  yaoCoverageFact: MeihuaYaoCoverageFact;
  yaoStructureFacts: MeihuaYaoFact[];
  stageCoverageFact: MeihuaStageCoverageFact;
  stages: MeihuaStageEvidence[];
  partyFact: MeihuaPartyFact;
  responseInteractionFacts: MeihuaResponseInteractionFact[];
  internalMotionFact: MeihuaInternalMotionFact;
  externalMotionFact: MeihuaExternalMotionFact;
  transitionFacts: MeihuaTransitionFact[];
  counterEvidenceFacts: MeihuaCounterEvidenceFact[];
  timingFacts: MeihuaTimingFact[];
  summaryFact: MeihuaSummaryFact;
}): MeihuaEvidenceCalculationStep[] {
  return [
    {
      key: 'meihua:calculation:generation',
      stage: '起卦取数核验',
      status: params.calculationFact.status === '完整' ? '已计算' : '资料不足',
      inputs: {
        method: params.calculationFact.methodLabel,
        inputKeys: Object.keys(params.calculationFact.inputs),
      },
      result: {
        calculationStatus: params.calculationFact.status,
        upperTrigram: params.calculationFact.resolvedResult.upperTrigram,
        lowerTrigram: params.calculationFact.resolvedResult.lowerTrigram,
        movingYao: params.calculationFact.resolvedResult.movingYao,
        randomTraceStatus: params.randomFact.status,
      },
      dependsOnStepKeys: [],
      promptText: `${params.calculationFact.promptText}；随机轨迹${params.randomFact.status === '不适用' ? '不适用' : params.randomFact.status}`,
      sources: Array.from(
        new Set([...params.calculationFact.sources, ...params.randomFact.sources]),
      ),
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'meihua:calculation:hexagrams',
      stage: '主互变卦象构造',
      status: params.hexagramStructureFacts.length === 3 ? '已计算' : '资料不足',
      inputs: {
        upperTrigram: params.calculationFact.resolvedResult.upperTrigram,
        lowerTrigram: params.calculationFact.resolvedResult.lowerTrigram,
        movingYao: params.calculationFact.resolvedResult.movingYao,
      },
      result: {
        hexagramFactCount: params.hexagramStructureFacts.length,
        stages: params.hexagramStructureFacts.map((item) => item.label),
      },
      dependsOnStepKeys: ['meihua:calculation:generation'],
      promptText: `按上下卦、互卦构造与动爻翻转记录${params.hexagramStructureFacts.length}项主互变卦象事实`,
      sources: Array.from(new Set(params.hexagramStructureFacts.flatMap((item) => item.sources))),
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'meihua:calculation:yaos',
      stage: '六爻与动爻核验',
      status: params.yaoCoverageFact.status === '完整' ? '已计算' : '资料不足',
      inputs: {
        expectedPositions: params.yaoCoverageFact.expectedPositions.map(String),
        movingYao: params.calculationFact.resolvedResult.movingYao,
      },
      result: {
        coverageStatus: params.yaoCoverageFact.status,
        yaoFactCount: params.yaoStructureFacts.length,
        changingPositions: params.yaoCoverageFact.changingPositions.map(String),
      },
      dependsOnStepKeys: ['meihua:calculation:generation'],
      promptText: `${params.yaoCoverageFact.promptText}；已记录${params.yaoStructureFacts.length}项阴阳、体用归属与动爻事实`,
      sources: ['主卦六爻阴阳序列、动爻位置与体用归属规则'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'meihua:calculation:stages',
      stage: '阶段关系计算',
      status: params.stageCoverageFact.status === '完整' ? '已计算' : '资料不足',
      inputs: {
        hexagramFactCount: params.hexagramStructureFacts.length,
        stageKeys: params.stages.map((item) => item.stage),
      },
      result: {
        coverageStatus: params.stageCoverageFact.status,
        stageFactCount: params.stages.length,
        incompleteStages: params.stageCoverageFact.incompleteStages,
        partyStatus: params.partyFact.status,
        responseInteractionFactCount: params.responseInteractionFacts.length,
        internalMotionStatus: params.internalMotionFact.status,
        internalMotionReferenceCount: params.internalMotionFact.references.length,
        externalMotionStatus: params.externalMotionFact.status,
      },
      dependsOnStepKeys: ['meihua:calculation:hexagrams', 'meihua:calculation:yaos'],
      promptText: `${params.stageCoverageFact.promptText}；计算主变体用、体互与用互对原体的关系、体用党、应卦间制化路径及内卦动静分工；外应动静保持资料不足`,
      sources: [
        '主卦、互卦、变卦上下经卦与原动爻所在经卦的体用、体互、用互、体用党、应卦制化及体用动静规则',
      ],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'meihua:calculation:transitions',
      stage: '阶段推进核验',
      status:
        params.transitionFacts.length === 2 &&
        params.transitionFacts.every((item) => item.status === '连续')
          ? '已计算'
          : '资料不足',
      inputs: { stageFactCount: params.stages.length },
      result: {
        transitionFactCount: params.transitionFacts.length,
        transitionStatuses: params.transitionFacts.map((item) => item.status),
      },
      dependsOnStepKeys: ['meihua:calculation:stages'],
      promptText: params.transitionFacts.length
        ? params.transitionFacts.map((item) => item.promptText).join('；')
        : '当前只有主卦阶段，未形成可核验推进链',
      sources: ['相邻阶段主变体用、互卦响应关系与阶段完整性逐项比较'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'meihua:calculation:counter-timing',
      stage: '反证与应期核验',
      status: params.timingFacts.some((item) => item.sourceStatus === '资料不足')
        ? '资料不足'
        : '已计算',
      inputs: { stageFactCount: params.stages.length },
      result: {
        counterEvidenceCount: params.counterEvidenceFacts.length,
        timingFactCount: params.timingFacts.length,
      },
      dependsOnStepKeys: ['meihua:calculation:stages', 'meihua:calculation:transitions'],
      promptText: `逐项核验阶段限制${params.counterEvidenceFacts.length}项，并登记应期盘面事实、所缺克应条件与期限边界${params.timingFacts.length}项`,
      sources: ['阶段关系限制、月令旺衰、动爻层位与传统克应资料覆盖'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'meihua:calculation:summary',
      stage: '证据汇总',
      status: params.summaryFact.status === '证据链完整' ? '已计算' : '资料不足',
      inputs: { factCount: params.summaryFact.factKeys.length },
      result: {
        summaryStatus: params.summaryFact.status,
        hexagramFactCount: params.summaryFact.hexagramFactCount,
        stageFactCount: params.summaryFact.stageFactCount,
        interResponseFactCount: params.summaryFact.interResponseFactCount,
        partyFactCount: params.summaryFact.partyFactCount,
        responseInteractionFactCount: params.summaryFact.responseInteractionFactCount,
        motionFactCount: params.summaryFact.motionFactCount,
        transitionFactCount: params.summaryFact.transitionFactCount,
        counterEvidenceCount: params.summaryFact.counterEvidenceCount,
        timingFactCount: params.summaryFact.timingFactCount,
      },
      dependsOnStepKeys: [
        'meihua:calculation:generation',
        'meihua:calculation:hexagrams',
        'meihua:calculation:yaos',
        'meihua:calculation:stages',
        'meihua:calculation:transitions',
        'meihua:calculation:counter-timing',
      ],
      promptText: params.summaryFact.promptText,
      sources: params.summaryFact.sources,
      limitation: CALCULATION_STEP_LIMITATION,
    },
  ];
}

function buildLimitationFacts(params: {
  calculationFact: MeihuaCalculationFact;
  randomFact: RandomTraceFact;
  hexagramStructureFacts: MeihuaHexagramFact[];
  yaoCoverageFact: MeihuaYaoCoverageFact;
  yaoStructureFacts: MeihuaYaoFact[];
  stageCoverageFact: MeihuaStageCoverageFact;
  stages: MeihuaStageEvidence[];
  interResponseFacts: MeihuaInterResponseEvidence[];
  partyFact: MeihuaPartyFact;
  responseInteractionFacts: MeihuaResponseInteractionFact[];
  internalMotionFact: MeihuaInternalMotionFact;
  externalMotionFact: MeihuaExternalMotionFact;
  transitionFacts: MeihuaTransitionFact[];
  traditionalFacts: MeihuaTraditionalFact[];
  counterEvidenceFacts: MeihuaCounterEvidenceFact[];
  counterSummaryFact: MeihuaCounterSummaryFact;
  timingFacts: MeihuaTimingFact[];
  timingSummaryFact: MeihuaTimingSummaryFact;
  summaryFact: MeihuaSummaryFact;
}): MeihuaLimitationFact[] {
  const definitions: Array<
    Pick<MeihuaLimitationFact, 'key' | 'type' | 'ownerFactKeys' | 'promptText' | 'sources'>
  > = [
    {
      key: 'meihua:limitation:generation-random',
      type: '起卦与随机来源边界',
      ownerFactKeys: [params.calculationFact.key, params.randomFact.key],
      promptText:
        '取数算式与随机轨迹只用于核验上下卦和动爻如何由输入或抽样得到；随机重放只记录生成过程，不提高预测有效性，也不证明现实结果',
      sources: ['起卦输入、取余算式与随机轨迹'],
    },
    {
      key: 'meihua:limitation:hexagrams-yaos',
      type: '卦象与逐爻资料边界',
      ownerFactKeys: [
        ...params.hexagramStructureFacts.map((item) => item.key),
        params.yaoCoverageFact.key,
        ...params.yaoStructureFacts.map((item) => item.key),
      ],
      promptText:
        '主互变卦象与逐爻事实只记录卦名、卦符、上下经卦、阴阳、体用归属和动爻位置；资料缺失时不得补造，资料完整也不直接证明现实事件或吉凶',
      sources: ['主互变卦象构造、六爻覆盖与逐爻事实'],
    },
    {
      key: 'meihua:limitation:stages',
      type: '阶段关系边界',
      ownerFactKeys: [
        params.stageCoverageFact.key,
        ...params.stages.map((item) => item.key),
        ...params.interResponseFacts.map((item) => item.key),
        params.partyFact.key,
        ...params.responseInteractionFacts.map((item) => item.key),
      ],
      promptText:
        '体用生克、体用党与应卦制化只描述卦内关系和方向，不按同党数、制化路径数或阶段先后裁定最终强弱与现实吉凶；起因、过程和结果标签只表示分析层级，不证明现实必然按同样阶段发生',
      sources: ['主变体用、互卦响应、体用党、应卦制化与逐阶段月令事实'],
    },
    {
      key: 'meihua:limitation:motion',
      type: '体用动静边界',
      ownerFactKeys: [params.internalMotionFact.key, params.externalMotionFact.key],
      promptText:
        '卦内原体、主用、互卦与变卦响应的动静分工可以从盘面重算，但它不等同于起卦现场实际动静；外应对象、对象类别、实际动静及求测者行卧坐立均未输入时，只能明确资料不足，不得据卦内动爻补造外应或应验快慢',
      sources: ['《梅花易数》体用动静内外分层与当前现场观察资料覆盖'],
    },
    {
      key: 'meihua:limitation:transitions-counters',
      type: '阶段推进与反证边界',
      ownerFactKeys: [
        ...params.transitionFacts.map((item) => item.key),
        params.counterSummaryFact.key,
        ...params.counterEvidenceFacts.map((item) => item.key),
      ],
      promptText:
        '阶段推进只比较相邻主变体用或互卦响应关系变化，阶段缺口时不得补造中间过程；体卦衰弱、泄耗、生体之卦无力和克体之卦有力等反证须与支持条件并列，不得直接写成现实失败、灾祸或损失',
      sources: ['阶段推进事实与逐阶段反证汇总'],
    },
    {
      key: 'meihua:limitation:timing',
      type: '应期边界',
      ownerFactKeys: [params.timingSummaryFact.key, ...params.timingFacts.map((item) => item.key)],
      promptText:
        '动爻、卦数、体用生克与月令旺衰只是盘面事实；缺少行卧坐立或外应动静、事件远近和时间尺度时，不能形成完整传统克应判断，不得裁定统一快慢或换算唯一日期',
      sources: ['动爻层位、卦数、月令旺衰、体用关系、克应资料覆盖与期限边界'],
    },
    {
      key: 'meihua:limitation:tradition-risk',
      type: '传统文本与高风险输出边界',
      ownerFactKeys: [params.summaryFact.key, ...params.traditionalFacts.map((item) => item.key)],
      promptText:
        '互卦用于过程、变卦用于结果，卦名与卦爻辞只能结合问题作辅助取象；不得按阶段、旺衰、传统吉凶词或卦数生成总分、成功率，也不得直接输出婚育、疾病、伤亡、诉讼、财物得失或人物意图结论',
      sources: ['传统卦爻辞条件化事实、证据汇总与高风险解释约束'],
    },
  ];
  return definitions.map((item) => ({
    ...item,
    status: '适用',
    limitation: LIMITATION_FACT_LIMITATION,
  }));
}

export function analyzeMeihuaEvidence(data: MeihuaData): MeihuaEvidenceAnalysis {
  if (!data?.mainHexagram || !data?.movingYao || !data?.ganzhi?.month) {
    throw new Error('梅花关系推进证据缺少主卦、动爻或月建资料。');
  }
  const monthBranch = data.ganzhi.month.slice(-1);
  const calculationFact = buildMeihuaCalculationFact(data);
  const calculationFacts = buildCalculationFacts(data);
  const hexagramStructureFacts = buildHexagramStructureFacts(data);
  const hexagramFacts = hexagramStructureFacts.map((item) => item.promptText);
  const traditionalFacts = buildTraditionalFacts(data);
  const yaoStructureFacts = buildYaoStructureFacts(data);
  const yaoCoverageFact = buildYaoCoverageFact(yaoStructureFacts, data.movingYao.position);
  const yaoFacts = yaoStructureFacts.map((item) => item.promptText);
  const mainTiYong = resolveTiYongFromHexagram(data.mainHexagram, data.movingYao.position);
  if (!mainTiYong) {
    throw new Error('梅花关系推进证据无法从主卦上下经卦与动爻重算原体、原用。');
  }
  const stages: MeihuaStageEvidence[] = [
    createTiYongStage({
      stage: 'origin',
      label: '起因',
      hexagram: data.mainHexagram.name,
      hexagramFactKey: 'meihua:hexagram:origin',
      ti: mainTiYong.ti,
      yong: mainTiYong.yong,
      monthBranch,
      basis: '主卦以动爻所在经卦为用、另一经卦为体。',
    }),
  ];

  const interUpper = data.interHexagram?.upper
    ? trigramByName.get(data.interHexagram.upper)
    : undefined;
  const interLower = data.interHexagram?.lower
    ? trigramByName.get(data.interHexagram.lower)
    : undefined;
  const interResponseFacts: MeihuaInterResponseEvidence[] = [];
  if (interUpper && interLower) {
    const movingInLower = data.movingYao.position <= 3;
    const interTi = movingInLower ? interUpper : interLower;
    const interYong = movingInLower ? interLower : interUpper;
    const basis = movingInLower
      ? '原动爻在下卦、原体在上，依《梅花易数》卷三取上互为体互、下互为用互。'
      : '原动爻在上卦、原体在下，依《梅花易数》卷三取下互为体互、上互为用互。';
    interResponseFacts.push(
      createInterResponseFact({
        role: '体互',
        response: interTi,
        originalTi: mainTiYong.ti,
        monthBranch,
        basis,
      }),
      createInterResponseFact({
        role: '用互',
        response: interYong,
        originalTi: mainTiYong.ti,
        monthBranch,
        basis,
      }),
    );
    stages.push(
      createProcessStage({
        hexagram: data.interHexagram?.name || '互卦',
        originalTi: mainTiYong.ti,
        responses: interResponseFacts,
        basis,
      }),
    );
  }

  const changedTiYong = data.changedHexagram
    ? resolveTiYongFromHexagram(data.changedHexagram, data.movingYao.position)
    : undefined;
  if (data.changedHexagram && changedTiYong) {
    stages.push(
      createTiYongStage({
        stage: 'result',
        label: '结果',
        hexagram: data.changedHexagram.name,
        hexagramFactKey: 'meihua:hexagram:result',
        ti: changedTiYong.ti,
        yong: changedTiYong.yong,
        monthBranch,
        basis: '变卦沿用原动爻所在经卦为用、另一经卦为体；原体所在经卦不动，始终为主。',
      }),
    );
  }

  const responseReferences = buildResponseReferences(stages, interResponseFacts);
  const partyFact = buildPartyFact(stages, responseReferences);
  const responseInteractionFacts = buildResponseInteractionFacts(responseReferences);
  const internalMotionFact = buildInternalMotionFact(
    stages,
    responseReferences,
    data.movingYao.position,
  );
  const externalMotionFact = buildExternalMotionFact();
  const stageCoverageFact = buildStageCoverageFact(stages);
  const transitionFacts = buildTransitionFacts(stages);
  const transitions = transitionFacts.map((item) => item.promptText);
  const timingFacts = buildTimingFacts(
    data,
    stages,
    monthBranch,
    calculationFact,
    yaoCoverageFact,
    yaoStructureFacts,
    internalMotionFact,
    externalMotionFact,
  );
  const timingConditions = timingFacts.map((item) => item.promptText);
  const timingSummaryFact: MeihuaTimingSummaryFact = {
    key: 'meihua:timing-summary',
    status: '资料不足',
    factKeys: timingFacts.map((item) => item.key),
    promptText: `应期状态：待补充现实条件；已登记${timingFacts.length}项盘面、资料覆盖与期限边界事实，待结合行卧坐立或外应动静、事件远近和时间尺度再论传统克应`,
    sources: ['逐项动爻、卦数、月令、体用、克应资料覆盖与期限边界汇总'],
    limitation: TIMING_SUMMARY_LIMITATION,
  };
  const counterEvidenceFacts = buildCounterEvidenceFacts(
    stages,
    partyFact,
    responseInteractionFacts,
  );
  const counterEvidence = unique(counterEvidenceFacts.map((item) => item.detail));
  const counterSummaryFact: MeihuaCounterSummaryFact = {
    key: 'meihua:counter-summary',
    status: counterEvidenceFacts.length ? '有明确反证' : '未见明确反证',
    factKeys: counterEvidenceFacts.map((item) => item.key),
    promptText: counterEvidenceFacts.length
      ? `当前${stages.length}个阶段共记录${counterEvidenceFacts.length}项明确限制，须逐项与现实条件复核`
      : '当前阶段未见明确体用或月令限制，但仍须核实现实风险与外部条件',
    sources: ['主卦原体月令条件单次登记，以及各阶段主变体用、互卦响应、用党和应卦制化限制逐项汇总'],
    limitation: COUNTER_SUMMARY_LIMITATION,
  };
  const isRandomMethod = data.calculation?.methodKey === 'random';
  const trace = data.meta?.random;
  const randomFact = buildRandomTraceFact({
    key: `random:meihua:${data.calculation?.methodKey ?? 'unknown'}`,
    applicable: isRandomMethod,
    trace,
    processLabel: `${data.calculation?.method ?? '当前方式'}的上下卦与动爻生成过程`,
    sources: ['梅花起卦方式与取数记录', '随机上下卦、动爻样本与重放元数据'],
  });
  const randomFacts = formatLegacyRandomFacts(randomFact);
  const summaryFact = buildSummaryFact({
    calculationFact,
    randomFact,
    hexagramStructureFacts,
    yaoCoverageFact,
    yaoStructureFacts,
    stageCoverageFact,
    stages,
    interResponseFacts,
    partyFact,
    responseInteractionFacts,
    internalMotionFact,
    externalMotionFact,
    transitionFacts,
    traditionalFacts,
    counterEvidenceFacts,
    counterSummaryFact,
    timingFacts,
    timingSummaryFact,
  });
  const calculationSteps = buildCalculationSteps({
    calculationFact,
    randomFact,
    hexagramStructureFacts,
    yaoCoverageFact,
    yaoStructureFacts,
    stageCoverageFact,
    stages,
    partyFact,
    responseInteractionFacts,
    internalMotionFact,
    externalMotionFact,
    transitionFacts,
    counterEvidenceFacts,
    timingFacts,
    summaryFact,
  });
  summaryFact.factKeys = Array.from(
    new Set([...calculationSteps.map((item) => item.key), ...summaryFact.factKeys]),
  );
  const limitationFacts = buildLimitationFacts({
    calculationFact,
    randomFact,
    hexagramStructureFacts,
    yaoCoverageFact,
    yaoStructureFacts,
    stageCoverageFact,
    stages,
    interResponseFacts,
    partyFact,
    responseInteractionFacts,
    internalMotionFact,
    externalMotionFact,
    transitionFacts,
    traditionalFacts,
    counterEvidenceFacts,
    counterSummaryFact,
    timingFacts,
    timingSummaryFact,
    summaryFact,
  });
  const limitations = limitationFacts.map((item) => item.promptText);
  const items: PromptEvidenceItem[] = [
    {
      level: calculationSteps.some((item) => item.status === '资料不足') ? '反证' : '辅证',
      title: '梅花计算链',
      detail: `${calculationSteps.map((item) => item.promptText).join('；')}；统一边界：${CALCULATION_STEP_LIMITATION}`,
      source: Array.from(new Set(calculationSteps.flatMap((item) => item.sources))).join('、'),
      tags: ['计算链', summaryFact.status],
    },
    {
      level: calculationFact.status === '完整' ? '辅证' : '反证',
      title: '起卦方式与取数算式',
      detail: `${calculationFact.promptText}；边界：${calculationFact.limitation}`,
      source: calculationFact.sources.join('、'),
      tags: ['起卦算式', calculationFact.methodKey, calculationFact.status],
    },
    {
      level: '主证',
      title: '主互变卦象事实',
      detail: `${hexagramStructureFacts.map((item) => item.promptText).join('；')}；统一边界：${HEXAGRAM_FACT_LIMITATION}`,
      source: Array.from(new Set(hexagramStructureFacts.flatMap((item) => item.sources))).join(
        '、',
      ),
      tags: [
        '主卦',
        ...(data.interHexagram ? ['互卦'] : []),
        ...(data.changedHexagram ? ['变卦'] : []),
      ],
    },
    {
      level: stageCoverageFact.status === '完整' ? '辅证' : '反证',
      title: '主互变阶段覆盖状态',
      detail: `${stageCoverageFact.promptText}；边界：${stageCoverageFact.limitation}`,
      source: stageCoverageFact.sources.join('、'),
      tags: ['阶段覆盖', stageCoverageFact.status],
    },
    {
      level: yaoCoverageFact.status === '完整' ? '辅证' : '反证',
      title: '六爻资料覆盖状态',
      detail: `${yaoCoverageFact.promptText}；边界：${yaoCoverageFact.limitation}`,
      source: yaoCoverageFact.sources.join('、'),
      tags: ['六爻覆盖', yaoCoverageFact.status],
    },
    {
      level: yaoCoverageFact.status === '完整' ? '辅证' : '反证',
      title: '六爻阴阳与体用归属',
      detail: `${yaoStructureFacts.map((item) => item.promptText).join('；')}；统一边界：${YAO_FACT_LIMITATION}`,
      source: Array.from(new Set(yaoStructureFacts.flatMap((item) => item.sources))).join('、'),
      tags: ['六爻结构', '动爻', '体用'],
    },
    ...(traditionalFacts.some((fact) => fact.applicability === '当前动爻辅助')
      ? [
          {
            level: '辅证' as const,
            title: `${data.movingYao.yaoName}爻辞`,
            detail: traditionalFacts.find((fact) => fact.applicability === '当前动爻辅助')
              ?.promptText,
            source: '《周易》当前主卦动爻原文及条件化解释',
            tags: ['动爻爻辞', data.movingYao.yaoName],
          },
        ]
      : []),
    ...traditionalFacts
      .filter((fact) => fact.kind === '卦辞')
      .map((fact): PromptEvidenceItem => ({
        level: fact.stage === '主卦' ? '辅证' : '限制',
        title: `${fact.stage}${fact.hexagram}卦辞分类`,
        detail: `${fact.promptText}；边界${fact.limitation}`,
        source: fact.sources.join('、'),
        tags: [fact.stage, '卦辞', ...fact.traditionalSignals, ...fact.topicTags],
      })),
    ...stages.map((stage, index): PromptEvidenceItem => ({
      level: index === 0 ? '主证' : '辅证',
      title: `${stage.label}阶段`,
      detail: `${stage.promptText}；边界：${stage.limitation}`,
      source: stage.sources.join('、'),
      tags: [stage.stage, ...stageRelations(stage)],
    })),
    ...transitionFacts.map((fact): PromptEvidenceItem => ({
      level: fact.status === '连续' ? '辅证' : '反证',
      title: `${{ origin: '起因', process: '过程', result: '结果' }[fact.fromStage]}至${{ origin: '起因', process: '过程', result: '结果' }[fact.toStage]}关系推进`,
      detail: `${fact.promptText}；边界：${fact.limitation}`,
      source: fact.sources.join('、'),
      tags: ['阶段推进', fact.status, fact.toStage],
    })),
    ...interResponseFacts.map((fact): PromptEvidenceItem => ({
      level: '辅证',
      title: `${fact.role}对原体关系`,
      detail: `${fact.promptText}；${fact.role === '体互' ? '《梅花易数》卷三称“体互最紧”，仍须与主卦体用、用互和变卦并看' : '《梅花易数》卷三称“用互次之”，不得脱离体互与变卦单断'}；边界：${fact.limitation}`,
      source: fact.sources.join('、'),
      tags: [fact.role, '原体', fact.relation],
    })),
    {
      level: partyFact.constraints.length ? '限制' : '辅证',
      title: '体党与用党',
      detail: `${partyFact.promptText}；边界：${partyFact.limitation}`,
      source: partyFact.sources.join('、'),
      tags: ['体党', '用党', partyFact.status, partyFact.classification],
    },
    ...responseInteractionFacts.map((fact): PromptEvidenceItem => ({
      level: fact.effectDirection === '生体之助受制' ? '限制' : '辅证',
      title: `${fact.controller.role}制${fact.target.role}`,
      detail: `${fact.promptText}；边界：${fact.limitation}`,
      source: fact.sources.join('、'),
      tags: ['应卦制化', fact.effectDirection, fact.controller.role, fact.target.role],
    })),
    {
      level: internalMotionFact.status === '已计算' ? '辅证' : '限制',
      title: '内卦体用动静分工',
      detail: `${internalMotionFact.promptText}；边界：${internalMotionFact.limitation}`,
      source: internalMotionFact.sources.join('、'),
      tags: ['体用动静', '内卦动静', internalMotionFact.status],
    },
    {
      level: '限制',
      title: '外应动静资料覆盖',
      detail: `${externalMotionFact.promptText}；边界：${externalMotionFact.limitation}`,
      source: externalMotionFact.sources.join('、'),
      tags: ['体用动静', '外应动静', externalMotionFact.status],
    },
    {
      level: '应期',
      title: '应期资料覆盖与边界',
      detail: `${timingSummaryFact.promptText}；${timingFacts.map((item) => item.promptText).join('；')}；统一边界：${timingSummaryFact.limitation}`,
      source: Array.from(new Set(timingFacts.flatMap((item) => item.sources))).join('、'),
      tags: ['应期', timingSummaryFact.status, '不裁定统一快慢', '不换算绝对日期'],
    },
    {
      level: counterSummaryFact.status === '有明确反证' ? '反证' : '辅证',
      title: '阶段关系反证覆盖状态',
      detail: `${counterSummaryFact.promptText}；边界：${counterSummaryFact.limitation}`,
      source: counterSummaryFact.sources.join('、'),
      tags: ['反证汇总', counterSummaryFact.status],
    },
    ...counterEvidenceFacts.map((fact, index): PromptEvidenceItem => ({
      level: '反证',
      title: `阶段关系限制核验${index + 1}`,
      detail: `${fact.promptText}；边界：${fact.limitation}`,
      source: fact.sources.join('、'),
      tags: ['反证', fact.type, fact.stage],
    })),
  ];
  if (isRandomMethod) {
    items.push({
      level: randomFact.status === '可重放' ? '辅证' : '反证',
      title: randomFact.status === '可重放' ? '随机起卦重放记录' : '随机轨迹缺失',
      detail: `${randomFact.promptText}；边界：${randomFact.limitation}`,
      source: randomFact.sources.join('、'),
      tags: ['随机起卦', randomFact.status, '不代表预测有效性'],
    });
  }
  items.push(
    {
      level: '辅证',
      title: `梅花证据汇总：${summaryFact.status}`,
      detail: `${summaryFact.promptText}；边界：${summaryFact.limitation}`,
      source: summaryFact.sources.join('、'),
      tags: ['证据汇总', summaryFact.status],
    },
    {
      level: '限制',
      title: '梅花推进链解释边界',
      detail: `${limitationFacts.map((item) => item.promptText).join('；')}；统一边界：${LIMITATION_FACT_LIMITATION}`,
      source: Array.from(new Set(limitationFacts.flatMap((item) => item.sources))).join('、'),
    },
  );
  const evidence: PromptEvidenceBundle = { title: '梅花主互变关系推进结构化证据', items };
  const calculationChain = calculationSteps.map((item) => item.promptText);
  const promptText = [
    '【梅花主互变关系推进结构化证据】',
    ...formatPromptEvidenceBundle(evidence),
    `计算链：${calculationChain.join(' → ')}。`,
    `证据汇总：${summaryFact.promptText}。`,
    `体用党与应卦制化：${partyFact.promptText}；${responseInteractionFacts.map((item) => item.promptText).join('；') || '未见生体或克体应卦被其他应卦克制的路径'}。`,
    `体用动静：${internalMotionFact.promptText}；${externalMotionFact.promptText}。`,
    `推进关系：${transitionFacts.map((item) => item.promptText).join('；') || '只有主卦阶段，未形成可核验的互变推进链'}`,
    `应期资料：${timingFacts.map((item) => item.promptText).join('；')}`,
    `解释限制：${limitations.join('；')}。`,
  ].join('\n');
  return {
    key: 'meihua:evidence',
    status: '已计算',
    calculationFact,
    calculationFacts,
    calculationSteps,
    calculationChain,
    hexagramStructureFacts,
    hexagramFacts,
    yaoCoverageFact,
    yaoStructureFacts,
    yaoFacts,
    monthBranch,
    movingYao: data.movingYao.position,
    stageCoverageFact,
    stages,
    interResponseFacts,
    responseReferences,
    partyFact,
    responseInteractionFacts,
    internalMotionFact,
    externalMotionFact,
    transitionFacts,
    transitions,
    timingFacts,
    timingSummaryFact,
    timingConditions,
    randomFact,
    randomFacts,
    counterEvidenceFacts,
    counterSummaryFact,
    counterEvidence,
    traditionalFacts,
    summaryFact,
    limitations,
    limitationFacts,
    evidence,
    promptText,
    methodology: [
      '主卦定起因与当前体用，互卦以体互、用互分别响应原体表示过程，变卦定变化后的体用关系。',
      '起卦输入、取余算式、六爻阴阳、互卦构造和动爻翻转均作为可复核计算事实保留。',
      '主卦与变卦计算体用生克，互卦分别计算体互、用互对原体的关系与月建旺衰，不在互卦内部重分体用。',
      '体党、用党只比较体互、用互和变卦用卦与原体、原用的同五行聚集；应卦制化逐项登记其他应卦对生体、克体之卦的克制路径，并保留月令强弱待综合。',
      '内卦动静按原体、体互、用互为静，主卦用卦、变卦响应为动逐项登记；这不等同于现场物体实际动静。',
      '动爻只标记变化层位，卦数只保留原始计算资料；缺少外应对象及实际动静、行卧坐立、事件远近和时间尺度时，不裁定统一快慢或换算绝对日期。',
      '只输出支持、反证、盘面事实与资料边界，不生成吉凶总分、成功率或无依据应期。',
    ],
  };
}
