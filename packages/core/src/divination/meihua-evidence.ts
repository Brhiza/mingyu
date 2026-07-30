import type { MeihuaData, MeihuaDivinationMethod } from '../types/divination';
import { hexagramsData, trigramsByIndex } from './hexagram-data';
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

export interface MeihuaSpatialOmenFact {
  key: 'meihua:spatial-omen';
  status: '资料不足';
  requiredObservationFields: string[];
  availableObservationFields: string[];
  missingObservationFields: string[];
  promptText: string;
  sources: string[];
  limitation: '坐端应兆必须以求测者所在处为观察中心，记录现场实际方位及该方位真实出现的人事、器物或环境兆象；主卦、互卦、变卦、体用、数字、时间、问题文本、设备方位与行政地名均不能替代现场八方观察，也不得在资料缺失时套出父母子女、身体病位、吉凶或应期';
}

export interface MeihuaSensoryOmenFact {
  key: 'meihua:sensory-omen';
  status: '资料不足';
  requiredObservationFields: string[];
  availableObservationFields: string[];
  missingObservationFields: string[];
  promptText: string;
  sources: string[];
  limitation: '万物外应必须来自耳闻目见的现场原始记录，并先区分成卦前后、观察时序、对象类别与实际状态，再与原卦及所占事项合参；当前时间戳、问题文本、主互变卦、设备麦克风或摄像头、历史回忆与事后挑选均不能替代，不得据缺失资料套用喧闹笑语、人物、鸟兽、器物或饮食等例断，也不得自动把观察标为已发生之事、未来之机、吉凶或应期';
}

export interface MeihuaFoodContextFact {
  key: 'meihua:food-context';
  status: '资料不足';
  requiredContextFields: string[];
  availableContextFields: string[];
  missingContextFields: string[];
  availableChartFields: string[];
  promptText: string;
  sources: string[];
  limitation: '《饮食篇》只适用于明确的具体饮食、宴请、食物或能否得食之占，并须先校定己、人、客、酒、食物等专项角色及动静语义；普通体用、问题关键词、卦内动爻与通用盘面事实均不能自动替代专项资料。当前底本艮、坎段落及末段角色句读尚未完成版本校勘，不得据此生成具体食材、菜品、口味、烹法、器皿、宾客身份、食量、有无得食、疾病、谁请谁或来去先后等结论';
}

export interface MeihuaObjectContextFact {
  key: 'meihua:object-context';
  status: '资料不足';
  requiredContextFields: string[];
  availableContextFields: string[];
  missingContextFields: string[];
  availableChartFields: string[];
  selectionOrderFields: string[];
  relationRuleFields: string[];
  quantityRuleFields: string[];
  sourceLineFields: string[];
  unresolvedRuleFields: string[];
  promptText: string;
  sources: string[];
  limitation: '《观物玄妙歌诀》与《占物类例》只适用于明确的观物、射覆或具体物件辨识；《占物类例》可确认动爻爻辞、八卦所属象、体卦刚柔形体、用卦功用、体用生克以及用变互色数等资料层级，但当前输入没有专项情境，底本又存在艮离错题、“困于株林”、“体生方圆曲直”、“用变互卦”、先后天数取值及后续取主规则等未决问题。不得据规则目录或普通盘面生成物件种类、材质、形状、颜色、气味、软硬、动静、位置、完整缺损、价值、可用可食或精确数量等结论';
}

export interface MeihuaTopicResponseContextFact {
  key: 'meihua:topic-response-context';
  status: '资料不足';
  requiredContextFields: string[];
  availableContextFields: string[];
  missingContextFields: string[];
  availableChartFields: string[];
  topicScopes: string[];
  crossTopicConflictFields: string[];
  highRiskRuleFields: string[];
  unresolvedRuleFields: string[];
  promptText: string;
  sources: string[];
  limitation: '《诸事响应歌》按天气、人事、家宅、生产、婚姻、饮食、求谋、求名、求财、交易、出行、行人、谒人、疾病、公讼与墓穴等不同事项分别立意；同一体用关系跨事项可能含义相反，问题关键词和通用盘面不能自动确定事项、判断目标、现实状态或角色。当前入口没有结构化专项情境，且“比和凶则有救星”句义未完成独立版本互证，不得套用事项歌诀生成胎儿性别、疾病诊断、药物冷热温补处方、鬼神或自伤落水血刃原因、诉讼胜负、确定婚姻财务结果、吉凶评分、权重或概率';
}

export interface MeihuaHexagramDispositionFact {
  key: string;
  status: '已计算';
  stage: MeihuaEvidenceStageKey;
  label: '主卦' | '互卦' | '变卦';
  hexagram: string;
  binarySymbol: string;
  reversedHexagram: string;
  reversedRelation: '自身综卦' | '另卦相综';
  oppositeHexagram: string;
  dispositionGloss: string;
  promptText: string;
  sources: string[];
  limitation: '《诸卦反对性情》与《杂卦传》卦义只登记当前卦、综卦、错卦和传统抽象标签；综卦、错卦是卦画结构关系，刚柔、忧乐、灾困等词是古籍卦义，不等同于现实人物性格、动机、心理状态、事件、吉凶、成败或概率';
}

export interface MeihuaHexagramDispositionVersionFact {
  key: 'meihua:hexagram-disposition-version';
  status: '底本异文待校';
  canonicalGlossCount: 64;
  reversedGroupCount: 36;
  sourceLineFields: string[];
  unresolvedRuleFields: string[];
  promptText: string;
  sources: string[];
  limitation: '《诸卦反对性情》当前底本与通行《杂卦传》存在错名、漏名、重名和句义移位；未完成独立版本校勘的诗句不得覆盖可复算卦画或通行卦义，也不得据异文补造人物性格、动机、现实事件、确定吉凶、评分、权重或概率';
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
    | '全卦克应关系'
    | '月建旺衰'
    | '体卦状态'
    | '原应期条件'
    | '克应资料覆盖'
    | '期限边界';
  sourceStatus: '原结果提供' | '由盘面补齐' | '资料不足' | '统一边界';
  ownerFactKeys: string[];
  rawText?: string;
  expectedResponseRoles?: MeihuaResponseRole[];
  actualResponseRoles?: MeihuaResponseRole[];
  missingResponseRoles?: MeihuaResponseRole[];
  relationCandidates?: MeihuaTimingRelationCandidate[];
  requiredContextFields?: string[];
  availableContextFields?: string[];
  missingContextFields?: string[];
  promptText: string;
  sources: string[];
  limitation: '应期事实只登记动爻层位、卦数、体用互变全卦生克候选、月令旺衰及传统克应所缺事项情境；不得把爻位、卦数、生克候选、阶段数量或旺衰单独换算唯一日期或统一快慢，也不证明事件必然发生';
}

export interface MeihuaTimingRelationCandidate {
  responseKey: string;
  ownerFactKey: string;
  role: MeihuaResponseRole;
  name: string;
  element: string;
  seasonState: string;
  relationToOriginalTi: MeihuaResponseReference['relationToOriginalTi'];
  direction: '传统吉应方向候选' | '传统凶应方向候选' | '非本条直接刻期候选';
  interactionFactKeys: string[];
}

export interface MeihuaTimingSummaryFact {
  key: 'meihua:timing-summary';
  status: '已提供触发条件' | '仅有期限边界' | '资料不足';
  factKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '应期汇总只说明当前保存了哪些盘面事实、全卦生克候选以及还缺哪些传统克应事项情境；必要条件未齐时不得按条件数量、动爻、卦数、生克候选或旺衰生成统一快慢、固定天数、绝对日期或事件概率';
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
  spatialOmenFactCount: number;
  sensoryOmenFactCount: number;
  foodContextFactCount: number;
  objectContextFactCount: number;
  topicResponseContextFactCount: number;
  hexagramDispositionFactCount: number;
  hexagramDispositionVersionFactCount: number;
  transitionFactCount: number;
  traditionalFactCount: number;
  counterEvidenceCount: number;
  timingFactCount: number;
  promptText: string;
  sources: string[];
  limitation: '梅花证据汇总只统计起卦、主互变卦象、六爻动爻、主变体用、互卦响应、体用党、应卦制化、内外动静、坐端应兆、万物耳目外应、饮食专项、观物专项、事项响应情境、反对性情卦画与版本、推进、传统文本、反证与应期事实的覆盖情况；不得按数量或卦义标签生成吉凶总分、成功率、人物性格、动机、身体病位、具体物件、专项现实结论或唯一日期';
}

export interface MeihuaLimitationFact {
  key: string;
  type:
    | '起卦与随机来源边界'
    | '卦象与逐爻资料边界'
    | '阶段关系边界'
    | '体用动静边界'
    | '坐端应兆边界'
    | '万物外应边界'
    | '饮食专项边界'
    | '观物专项边界'
    | '事项响应情境边界'
    | '反对性情资料边界'
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
  spatialOmenFact: MeihuaSpatialOmenFact;
  sensoryOmenFact: MeihuaSensoryOmenFact;
  foodContextFact: MeihuaFoodContextFact;
  objectContextFact: MeihuaObjectContextFact;
  topicResponseContextFact: MeihuaTopicResponseContextFact;
  hexagramDispositionFacts: MeihuaHexagramDispositionFact[];
  hexagramDispositionVersionFact: MeihuaHexagramDispositionVersionFact;
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
const SPATIAL_OMEN_FACT_LIMITATION =
  '坐端应兆必须以求测者所在处为观察中心，记录现场实际方位及该方位真实出现的人事、器物或环境兆象；主卦、互卦、变卦、体用、数字、时间、问题文本、设备方位与行政地名均不能替代现场八方观察，也不得在资料缺失时套出父母子女、身体病位、吉凶或应期' as const;
const SENSORY_OMEN_FACT_LIMITATION =
  '万物外应必须来自耳闻目见的现场原始记录，并先区分成卦前后、观察时序、对象类别与实际状态，再与原卦及所占事项合参；当前时间戳、问题文本、主互变卦、设备麦克风或摄像头、历史回忆与事后挑选均不能替代，不得据缺失资料套用喧闹笑语、人物、鸟兽、器物或饮食等例断，也不得自动把观察标为已发生之事、未来之机、吉凶或应期' as const;
const FOOD_CONTEXT_FACT_LIMITATION =
  '《饮食篇》只适用于明确的具体饮食、宴请、食物或能否得食之占，并须先校定己、人、客、酒、食物等专项角色及动静语义；普通体用、问题关键词、卦内动爻与通用盘面事实均不能自动替代专项资料。当前底本艮、坎段落及末段角色句读尚未完成版本校勘，不得据此生成具体食材、菜品、口味、烹法、器皿、宾客身份、食量、有无得食、疾病、谁请谁或来去先后等结论' as const;
const OBJECT_CONTEXT_FACT_LIMITATION =
  '《观物玄妙歌诀》与《占物类例》只适用于明确的观物、射覆或具体物件辨识；《占物类例》可确认动爻爻辞、八卦所属象、体卦刚柔形体、用卦功用、体用生克以及用变互色数等资料层级，但当前输入没有专项情境，底本又存在艮离错题、“困于株林”、“体生方圆曲直”、“用变互卦”、先后天数取值及后续取主规则等未决问题。不得据规则目录或普通盘面生成物件种类、材质、形状、颜色、气味、软硬、动静、位置、完整缺损、价值、可用可食或精确数量等结论' as const;
const TOPIC_RESPONSE_CONTEXT_FACT_LIMITATION =
  '《诸事响应歌》按天气、人事、家宅、生产、婚姻、饮食、求谋、求名、求财、交易、出行、行人、谒人、疾病、公讼与墓穴等不同事项分别立意；同一体用关系跨事项可能含义相反，问题关键词和通用盘面不能自动确定事项、判断目标、现实状态或角色。当前入口没有结构化专项情境，且“比和凶则有救星”句义未完成独立版本互证，不得套用事项歌诀生成胎儿性别、疾病诊断、药物冷热温补处方、鬼神或自伤落水血刃原因、诉讼胜负、确定婚姻财务结果、吉凶评分、权重或概率' as const;
const HEXAGRAM_DISPOSITION_FACT_LIMITATION =
  '《诸卦反对性情》与《杂卦传》卦义只登记当前卦、综卦、错卦和传统抽象标签；综卦、错卦是卦画结构关系，刚柔、忧乐、灾困等词是古籍卦义，不等同于现实人物性格、动机、心理状态、事件、吉凶、成败或概率' as const;
const HEXAGRAM_DISPOSITION_VERSION_LIMITATION =
  '《诸卦反对性情》当前底本与通行《杂卦传》存在错名、漏名、重名和句义移位；未完成独立版本校勘的诗句不得覆盖可复算卦画或通行卦义，也不得据异文补造人物性格、动机、现实事件、确定吉凶、评分、权重或概率' as const;
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
  '应期事实只登记动爻层位、卦数、体用互变全卦生克候选、月令旺衰及传统克应所缺事项情境；不得把爻位、卦数、生克候选、阶段数量或旺衰单独换算唯一日期或统一快慢，也不证明事件必然发生' as const;
const TIMING_SUMMARY_LIMITATION =
  '应期汇总只说明当前保存了哪些盘面事实、全卦生克候选以及还缺哪些传统克应事项情境；必要条件未齐时不得按条件数量、动爻、卦数、生克候选或旺衰生成统一快慢、固定天数、绝对日期或事件概率' as const;
const TIMING_REQUIRED_CONTEXT_FIELDS = [
  '所占事项类型与具体对象',
  '此问只断吉凶成败还是确需刻定应期',
  '事项自然期限、远近及采用年/月/日/时时间尺度',
  '所求应验方向（吉应、凶应、成事、败事、归期等）',
  '数克或理克的采用口径；若数克，事物数是否入卦及原始数值',
  '对象材质或耐久性（屋宅、坟墓、器物等适用时）',
] as const;
const CALCULATION_STEP_LIMITATION =
  '计算步骤只证明起卦取数、主互变卦象、六爻动爻、主变体用、互卦响应、推进、反证与应期事实如何形成当前证据；不证明现实吉凶、预测有效性、事件概率或固定应期' as const;
const SUMMARY_FACT_LIMITATION =
  '梅花证据汇总只统计起卦、主互变卦象、六爻动爻、主变体用、互卦响应、体用党、应卦制化、内外动静、坐端应兆、万物耳目外应、饮食专项、观物专项、事项响应情境、反对性情卦画与版本、推进、传统文本、反证与应期事实的覆盖情况；不得按数量或卦义标签生成吉凶总分、成功率、人物性格、动机、身体病位、具体物件、专项现实结论或唯一日期' as const;
const LIMITATION_FACT_LIMITATION =
  '限制事实用于约束梅花起卦、卦象、逐爻、体用、推进、传统卦爻辞与应期资料能够支持的解释范围，不得被反向当作现实吉凶、婚育疾病、伤亡诉讼、事件概率或固定应期的证据' as const;

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

const HEXAGRAM_DISPOSITION_GLOSSES: Record<number, string> = {
  1: '刚',
  2: '柔',
  3: '见而不失其居',
  4: '杂而著',
  5: '不进',
  6: '不亲',
  7: '忧',
  8: '乐',
  9: '寡',
  10: '不处',
  11: '与否反其类',
  12: '与泰反其类',
  13: '亲',
  14: '众',
  15: '轻',
  16: '怠',
  17: '无故',
  18: '饬',
  19: '与观之义，或与或求',
  20: '与临之义，或与或求',
  21: '食',
  22: '无色',
  23: '烂',
  24: '反',
  25: '灾',
  26: '时',
  27: '养正',
  28: '颠',
  29: '下',
  30: '上',
  31: '速',
  32: '久',
  33: '退',
  34: '止',
  35: '昼',
  36: '诛',
  37: '内',
  38: '外',
  39: '难',
  40: '缓',
  41: '盛衰之始',
  42: '盛衰之始',
  43: '决，刚决柔',
  44: '遇，柔遇刚',
  45: '聚',
  46: '不来',
  47: '相遇',
  48: '通',
  49: '去故',
  50: '取新',
  51: '起',
  52: '止',
  53: '女归待男行',
  54: '女之终',
  55: '多故',
  56: '亲寡',
  57: '伏',
  58: '见',
  59: '离',
  60: '止',
  61: '信',
  62: '过',
  63: '定',
  64: '男之穷',
};

const HEXAGRAM_DISPOSITION_SOURCE_LINES = [
  '干刚坤柔反其义，比卦欢欣困忧虑。',
  '临逢百物观求之，蒙卦难明屯不失。',
  '大畜其卦福之生，无妄若遇祸之始。',
  '升者去而不复回，萃者聚而终不去。',
  '谦卦自尊豫怠人，震则动而艮则止。',
  '兑主外遇祸之藏，随前坎后偷安矣。',
  '剥体消烂复自生，蛊改前非而已矣。',
  '明夷内朗又逢伤，晋主外明并通理。',
  '益拟茂盛损象衰，咸速恒迟涣远遁。',
  '同人内亲睽外疏，解卦从容蹇难启。',
  '离文美丽艮光明，遁退回身姤相遇。',
  '大有曰众丰曰多，坎卦履险震卦起。',
  '需不进兮讼不宁，既济一定无后虑。',
  '未济之卦男之终，归妹之辞归之始。',
  '否遭大往而小来，泰卦大来而小去。',
  '革去旧故鼎从新，小畜曰寡噬嗑食。',
  '旅羁其外大过颠，夬卦分明曰快利。',
  '要将字字考精详，杂卦性情反对是。',
] as const;

const HEXAGRAM_DISPOSITION_VERSION_ISSUES = [
  '“比卦欢欣困忧虑”与通行《杂卦传》“比乐师忧”不合，师、困卦名不能互换',
  '“兑主外遇祸之藏，随前坎后偷安矣”未能稳定对应“兑见而巽伏、随无故、蛊则饬”',
  '“益拟茂盛损象衰，咸速恒迟涣远遁”混入遁而未清楚保留节，且恒迟与通行“恒久”不合',
  '“同人内亲睽外疏”把通行“同人亲、家人内、睽外”的卦名与句义合并移位',
  '“离文美丽艮光明”及后句“坎卦履险震卦起”重复艮震，未闭合通行“离上而坎下”',
  '“未济之卦男之终，归妹之辞归之始”与通行“未济男之穷、归妹女之终”不合',
  '当前诗句未完整、无歧义地覆盖师、巽、节、家人、履、中孚、小过、渐、颐等通行卦义',
  '通行《杂卦传》自大过以下的次序本有错简争议，当前底本改写不能作为唯一裁定依据',
] as const;

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
const hexagramByName = new Map(hexagramsData.map((item) => [item.name, item]));
const hexagramByBinary = new Map(hexagramsData.map((item) => [item.binarySymbol, item]));

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

function buildSpatialOmenFact(): MeihuaSpatialOmenFact {
  const requiredObservationFields = [
    '以求测者所在处为中心的现场观察基准',
    '现场应兆实际出现的八方方位',
    '该方位真实出现的人事、器物或环境兆象',
  ];
  return {
    key: 'meihua:spatial-omen',
    status: '资料不足',
    requiredObservationFields,
    availableObservationFields: [],
    missingObservationFields: [...requiredObservationFields],
    promptText:
      '当前输入未记录以求测者所在处为中心的观察基准、现场应兆实际方位及该方位真实兆象；不得把主卦、互卦、变卦、体用、数字、时间、问题文本、设备方位或行政地名补写成坐端八方应兆，也不能据此套出父母子女、身体病位、吉凶或应期',
    sources: [
      '《梅花易数》卷三《占卜坐端之诀》以所坐为中、察八方实际应兆再定所占关系',
      '当前梅花起卦输入字段与坐端现场观察必要资料逐项对照',
    ],
    limitation: SPATIAL_OMEN_FACT_LIMITATION,
  };
}

function buildSensoryOmenFact(): MeihuaSensoryOmenFact {
  const requiredObservationFields = [
    '耳闻目见的现场原始记录',
    '观察发生在成卦前或成卦后',
    '观察发生的准确时间或先后次序',
    '声音、言语、人物、器物、鸟兽、饮食或环境等对象类别',
    '对象实际内容、形态、完整缺损及来往动静',
    '求测者当时明确指向或关注的对象',
    '所占事项与该观察的现实关联',
  ];
  return {
    key: 'meihua:sensory-omen',
    status: '资料不足',
    requiredObservationFields,
    availableObservationFields: [],
    missingObservationFields: [...requiredObservationFields],
    promptText:
      '当前输入未记录耳闻目见的现场原始事实、成卦前后时点、观察先后、对象类别与实际状态、当时明确关注对象及事项关联；不得把问题文字、时间戳、主互变卦、设备麦克风或摄像头、历史回忆或事后挑选补写成《万物赋》外应，也不能套用笑语哭泣、人物鸟兽、器物饮食等例断或裁定已发生、未来、吉凶与应期',
    sources: [
      '《梅花易数》卷三《万物赋》成卦前后、耳闻目见与原卦合参之法',
      '当前梅花起卦输入字段与耳目现场观察必要资料逐项对照',
    ],
    limitation: SENSORY_OMEN_FACT_LIMITATION,
  };
}

function buildFoodContextFact(): MeihuaFoodContextFact {
  const requiredContextFields = [
    '所占明确为一场具体饮食、宴请、食物或能否得食',
    '具体判断对象与范围（食材、菜品、味道、烹法、赴宴、主客、能否得食等）',
    '饮食专项采用的己、人、客、酒、食物角色分工与版本口径',
    '“动则有、静则无”的所指及对应原始动静记录',
    '所问时点、宴食发生时间及主客参与关系',
  ];
  return {
    key: 'meihua:food-context',
    status: '资料不足',
    requiredContextFields,
    availableContextFields: [],
    missingContextFields: [...requiredContextFields],
    availableChartFields: [
      '起卦时点与干支',
      '主卦、互卦、变卦上下经卦',
      '动爻位置与卦内体用动静',
      '起卦月份与四时旺衰',
    ],
    promptText:
      '当前输入未明确饮食专项所需情境：现只保留起卦时点与干支、主互变上下经卦、动爻及卦内体用动静、月份与四时旺衰等盘面事实；尚未明确具体饮食或宴请之占、判断对象范围、己人客酒食物专项角色口径、“动则有、静则无”的所指与原始记录、宴食时间及主客关系。不得从问题关键词、普通体用或卦内动爻套出食材、菜品、味道、烹法、器皿、宾客身份、食量、有无得食、疾病、谁请谁或来去先后',
    sources: [
      '《梅花易数》卷三《饮食篇》饮食类象、四时、组合、动静与专项角色口径',
      '当前梅花起卦输入字段与饮食专项必要资料逐项对照',
    ],
    limitation: FOOD_CONTEXT_FACT_LIMITATION,
  };
}

function buildObjectContextFact(): MeihuaObjectContextFact {
  const requiredContextFields = [
    '所占明确为观物、射覆或辨识某一具体物件',
    '待辨物件的范围及可见、遮覆、手持等实际状态',
    '本次希望辨识的属性范围（种类、材质、形状、颜色、状态、数量等）',
  ];
  const selectionOrderFields = [
    '成卦后先观当前动爻爻辞，只把爻辞当作物类取象辅助',
    '爻辞不言物类或仍不能决时，再察八卦所属之象',
    '体卦为主看刚柔与形体，用卦看有用无用，再按体用生克比和登记属性候选',
    '原句另列用、变、互卦观察颜色与数目，但三者的句读、分工和合并顺序未定',
  ];
  const relationRuleFields = [
    '用生体：原文并列可食与贵物候选，不能据此二选一或直接确认可食',
    '用克体：原文并列近人秽物与贱物候选，不能直接确认污秽或价值',
    '体生用：原文并列不成之器与泄耗废物候选，且与下一行“体生方圆曲直，可作可用”存在底本冲突',
    '体克用：原文列破碎损折候选，不等于现实物件必已损坏',
    '体用比和：原文列有用成器候选，不等于现实物件必可使用',
  ];
  const quantityRuleFields = [
    '互见乾、兑只登记一、二数候选，原文没有说明两个互卦同时出现时如何选值',
    '互见艮、坤只登记七、八数候选，原文没有说明两个互卦同时出现时如何选值',
    '互卦重乾、艮、坤、坎、离时原文称“两件”，不能扩展到未列出的震、巽、兑',
    '物乘旺则数量多、乘衰则数量少，但原文没有给出由旺衰换算精确数量的公式',
    '离只登记中虚或空手无物候选，不能据离卦直接确认没有物件',
    '互艮同时提到先天七数与后天八数范围，未说明采用先天数、后天数或二者如何合并',
  ];
  const sourceLineFields = [
    '凡看物数，看其成卦，观其爻辞。如得干，曰“潜龙勿用”，乃曰不可用之物；“见龙在田”，乃曰田中之物；“或跃在渊”，乃曰水中之物；“亢龙有悔”，乃废物也。如得坤之“直、方、大”，乃曰直而方大之器物；“括囊无咎”，乃曰包裹之物；“黄裳元吉”，乃曰黄色衣服之物；“其血玄黄”，乃石物或逢石而破；“困于株林”，乃曰木物。又言爻辞，不言物类，而不能决者，须以八卦所属之象察之。',
    '又诀，体用断物之妙，生克制化之妙，于诸诀中此极为美验。其所以生体者，为可食之物；克体者，为可近人之秽物。体生者，为不成之器；体克者，为破碎损折之物；比和者，乃有用成器之物。又生体象者为贵物，克体象者为贱物，所泄为废物也。',
    '又诀，凡算此数，以体卦为主，看其刚柔。用卦看其有用无用。体生方圆曲直，可作可用，如用生体，乃可食。用变互卦，看其色与数目。此互卦决其物之数目也。如互见干、兑，决为一二之数。互见艮、坤，为七八之数也。但互卦重干、重艮、重坤、重坎、重离之属，皆是两件。物乘旺，物数多，衰而物少。离为中虚之物，或空手无物。又决物之数者，如互艮卦，先天七数，后天亦不出八数之外。',
  ];
  const unresolvedRuleFields = [
    '通行底本把山石、土瓦、门途等艮象正文题作“离”，同时缺少另一卦的完整独立段落',
    '第936行“困于株林”与通行《周易》困卦初六“臀困于株木，入于幽谷”不合，且当前句读容易误归入坤卦爻辞',
    '第938行“体生方圆曲直，可作可用”语法未闭合，并与前一行“体生者，为不成之器”方向冲突',
    '第938行“用变互卦，看其色与数目”没有可靠标点，不能确定用卦、变卦、互卦各自负责颜色还是数量',
    '互卦数例没有说明上下互同时取数的先后、合并方式，也没有给出旺衰增减与先后天数之间的确定换算式',
    '本节虽称体卦为主，但后续《物数为体诀》与《观物看变爻为主》另列多卦为体、变卦为主，三者适用范围尚待顺序复核',
  ];
  return {
    key: 'meihua:object-context',
    status: '资料不足',
    requiredContextFields,
    availableContextFields: [],
    missingContextFields: [...requiredContextFields],
    availableChartFields: [
      '起卦时点、方式与取数算式',
      '主卦、互卦、变卦上下经卦',
      '动爻位置、普通体用与卦内动静',
      '起卦月份与四时旺衰',
    ],
    selectionOrderFields,
    relationRuleFields,
    quantityRuleFields,
    sourceLineFields,
    unresolvedRuleFields,
    promptText:
      '当前输入未明确观物专项所需情境：现只保留起卦时点与取数、主互变上下经卦、动爻与普通体用、月份与四时旺衰等盘面事实；尚未确认所占确为观物或射覆、待辨物件范围与可见遮覆状态、所需辨识的属性范围。《占物类例》第935至938行已留档，可确认先看动爻爻辞、不决再察八卦象，以及体卦主刚柔形体、用卦主功用、体用生克和用变互色数等资料层级；但艮离错题、“困于株林”、“体生方圆曲直”、“用变互卦”、互卦数取值及后续取主规则仍未闭合。不得把规则目录套到普通问题，也不得输出具体物件、材质、形色、状态、价值、可用可食或精确数量',
    sources: [
      '《梅花易数》卷三《观物玄妙歌诀》物形、物色、物性、位置、体质、卦象组合与四时取象',
      '《梅花易数》卷三《占物类例》第935至938行爻辞、八卦象、体用生克与互卦数例',
      '通行《周易》乾、坤、困卦爻辞与当前底本逐句对照',
      '同卷后续《物数为体诀》《观物看变爻为主》等取主规则待顺序复核',
      '当前梅花起卦输入字段与观物专项必要情境逐项对照',
    ],
    limitation: OBJECT_CONTEXT_FACT_LIMITATION,
  };
}

function buildTopicResponseContextFact(): MeihuaTopicResponseContextFact {
  const requiredContextFields = [
    '明确的事项类别、具体对象与适用范围',
    '精确判断目标（如问晴或问雨、问出行或归来、问是否到达或何时到达）',
    '当前现实状态、所处阶段及体用对应的现实角色关系',
    '健康、生育、法律、安全等高风险事项所需的专业资料与现实核验边界',
  ];
  const topicScopes = [
    '天气晴雨',
    '一般人事与人物方位物品响应',
    '家宅',
    '生产与生育',
    '婚姻',
    '饮食',
    '求谋',
    '求名',
    '求财',
    '交易',
    '出行',
    '行人归期',
    '谒人',
    '疾病与用药',
    '公讼',
    '墓穴',
    '现场旁言与美物外应',
  ];
  const crossTopicConflictFields = [
    '一般人事称“体克用”可作顺利条件，行人归期却称“克用必来迟”',
    '求名、求财、出行、谒人、疾病、公讼与墓穴等事项各有不同“体克用”语义，不能共用一个现实吉凶结论',
    '天气判断还依赖所问为晴或雨、坎兑艮离等经卦出现或缺失及贲卦，不能由通用体用关系替代',
    '生产、婚姻、饮食等篇内规则使用各自对象和角色，不能由普通体用自动套用',
  ];
  const highRiskRuleFields = [
    '阴阳爻数量不得用于推定现实胎儿性别',
    '疾病段不得用于诊断、判断病因或裁定能否痊愈',
    '离热、坎冷、坤土温补等句不得生成药物冷热温补处方',
    '鬼神、自缢、落水、血刃等句不得生成超自然、自伤、事故或伤害原因事实',
    '公讼、求财、交易、婚姻等事项不得输出诉讼胜负或确定财务婚姻结果',
  ];
  const unresolvedRuleFields = [
    '“比和凶则有救星”在已核通行文本中句式一致，但同源转载不能构成独立版本互证，句义暂不闭合',
  ];
  return {
    key: 'meihua:topic-response-context',
    status: '资料不足',
    requiredContextFields,
    availableContextFields: [],
    missingContextFields: [...requiredContextFields],
    availableChartFields: [
      '起卦时点、方式与取数算式',
      '主卦、互卦、变卦上下经卦',
      '动爻位置、普通体用与卦内动静',
      '起卦月份与四时旺衰',
    ],
    topicScopes,
    crossTopicConflictFields,
    highRiskRuleFields,
    unresolvedRuleFields,
    promptText:
      '当前输入只有起卦方式、主互变卦、动爻、普通体用和月令旺衰等盘面事实，没有《诸事响应歌》所需的结构化事项类别、具体对象、精确判断目标、现实状态与角色关系，也没有健康、生育、法律、安全等高风险事项的专业资料。歌中同一“体克用”在一般人事与行人归期等事项含义不同，天气又须先区分问晴或问雨并核对特定经卦；“比和凶则有救星”句义尚未完成独立版本互证。不得从问题关键词或通用体用套用专项歌诀，也不得生成胎儿性别、疾病诊断或痊愈、药物冷热温补处方、鬼神或自伤落水血刃原因、诉讼胜负、确定婚姻财务结果、评分、权重或概率',
    sources: [
      '《梅花易数》卷三《诸事响应歌》天气、人事、家宅、生产、婚姻、饮食、求谋、求名、求财、交易、出行、行人、谒人、疾病、公讼与墓穴分项规则',
      '当前梅花起卦输入字段与事项响应必要情境逐项对照',
      '“比和凶则有救星”通行文本句义与版本互证状态',
    ],
    limitation: TOPIC_RESPONSE_CONTEXT_FACT_LIMITATION,
  };
}

function buildHexagramDispositionFacts(data: MeihuaData): MeihuaHexagramDispositionFact[] {
  const stages = [
    { stage: 'origin', label: '主卦', hexagram: data.mainHexagram },
    { stage: 'process', label: '互卦', hexagram: data.interHexagram },
    { stage: 'result', label: '变卦', hexagram: data.changedHexagram },
  ] as const;

  return stages.flatMap(({ stage, label, hexagram }) => {
    if (!hexagram) return [];
    const source = hexagramByName.get(hexagram.name);
    if (!source) {
      throw new Error(`梅花反对性情资料找不到当前${label}${hexagram.name}的六十四卦原始记录。`);
    }
    const reversed = hexagramByBinary.get([...source.binarySymbol].reverse().join(''));
    const opposite = hexagramByBinary.get(
      [...source.binarySymbol].map((line) => (line === '1' ? '0' : '1')).join(''),
    );
    const dispositionGloss = HEXAGRAM_DISPOSITION_GLOSSES[source.id];
    if (!reversed || !opposite || !dispositionGloss) {
      throw new Error(`梅花反对性情资料无法闭合${label}${hexagram.name}的综卦、错卦或卦义标签。`);
    }
    const reversedRelation = reversed.name === source.name ? '自身综卦' : '另卦相综';
    return [
      {
        key: `meihua:hexagram-disposition:${stage}`,
        status: '已计算',
        stage,
        label,
        hexagram: source.name,
        binarySymbol: source.binarySymbol,
        reversedHexagram: reversed.name,
        reversedRelation,
        oppositeHexagram: opposite.name,
        dispositionGloss,
        promptText: `${label}${source.name}的综卦为${reversed.name}（${reversedRelation}），错卦为${opposite.name}；通行《杂卦传》抽象卦义标签为“${dispositionGloss}”。这些只是不随问题变化的卦画和古籍标签，不描述现实人物性格、动机、心理、事件或吉凶`,
        sources: [
          '当前六十四卦阴阳卦画逐爻反转与逐爻取反计算',
          '通行《杂卦传》六十四卦抽象卦义',
          '《梅花易数》卷三《诸卦反对性情》底本异文对照',
        ],
        limitation: HEXAGRAM_DISPOSITION_FACT_LIMITATION,
      },
    ];
  });
}

function buildHexagramDispositionVersionFact(): MeihuaHexagramDispositionVersionFact {
  const canonicalGlossCount = Object.keys(HEXAGRAM_DISPOSITION_GLOSSES).length;
  const reversedGroupCount = new Set(
    hexagramsData.map((item) => {
      const reversed = hexagramByBinary.get([...item.binarySymbol].reverse().join(''));
      if (!reversed) throw new Error(`六十四卦资料无法找到${item.name}的综卦。`);
      return [item.id, reversed.id].sort((left, right) => left - right).join(':');
    }),
  ).size;
  if (canonicalGlossCount !== 64 || reversedGroupCount !== 36) {
    throw new Error(
      `梅花反对性情基础资料不完整：卦义${canonicalGlossCount}项、综卦组${reversedGroupCount}组。`,
    );
  }
  return {
    key: 'meihua:hexagram-disposition-version',
    status: '底本异文待校',
    canonicalGlossCount: 64,
    reversedGroupCount: 36,
    sourceLineFields: [...HEXAGRAM_DISPOSITION_SOURCE_LINES],
    unresolvedRuleFields: [...HEXAGRAM_DISPOSITION_VERSION_ISSUES],
    promptText:
      '《诸卦反对性情》当前底本第917至934行已完整留档，但与通行《杂卦传》相比存在师误作困、巽节家人等卦名缺漏、同人家人句义合并、离坎与未济归妹句义移位等问题。现以卦画复算综卦和错卦，以通行《杂卦传》保存64项抽象标签；底本诗句只登记版本差异，不覆盖可复算结构，也不用于推断人物性格、动机、现实事件或确定吉凶',
    sources: [
      '《梅花易数》卷三《诸卦反对性情》第917至934行',
      '《周易·杂卦传》六十四卦抽象卦义',
      '《周易浅述》卷八《杂卦传》反覆、错综与篇末错简说明',
    ],
    limitation: HEXAGRAM_DISPOSITION_VERSION_LIMITATION,
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
  responseReferences: MeihuaResponseReference[],
  responseInteractionFacts: MeihuaResponseInteractionFact[],
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
  const expectedResponseRoles: MeihuaResponseRole[] = ['主卦用卦', '体互', '用互', '变卦用卦'];
  const actualResponseRoles = expectedResponseRoles.filter((role) =>
    responseReferences.some((item) => item.role === role),
  );
  const missingResponseRoles = expectedResponseRoles.filter(
    (role) => !actualResponseRoles.includes(role),
  );
  const relationCandidates: MeihuaTimingRelationCandidate[] = responseReferences.map(
    (response) => ({
      responseKey: response.key,
      ownerFactKey: response.ownerFactKey,
      role: response.role,
      name: response.name,
      element: response.element,
      seasonState: response.seasonState,
      relationToOriginalTi: response.relationToOriginalTi,
      direction:
        response.relationToOriginalTi === '生体' || response.relationToOriginalTi === '与体比和'
          ? '传统吉应方向候选'
          : response.relationToOriginalTi === '克体'
            ? '传统凶应方向候选'
            : '非本条直接刻期候选',
      interactionFactKeys: responseInteractionFacts
        .filter((fact) => fact.target.key === response.key)
        .map((fact) => fact.key),
    }),
  );
  add({
    key: 'meihua:timing:whole-hexagram-relations',
    type: '全卦克应关系',
    sourceStatus: missingResponseRoles.length ? '资料不足' : '由盘面补齐',
    ownerFactKeys: Array.from(
      new Set([
        calculationFact.key,
        ...relationCandidates.map((item) => item.ownerFactKey),
        ...relationCandidates.flatMap((item) => item.interactionFactKeys),
      ]),
    ),
    expectedResponseRoles,
    actualResponseRoles,
    missingResponseRoles,
    relationCandidates,
    promptText: missingResponseRoles.length
      ? `全卦克应候选缺少${missingResponseRoles.join('、')}；现有关系只登记传统吉应、凶应或非本条直接刻期方向候选，不得补造缺失角色或直接生成日期`
      : `全卦克应候选：${relationCandidates.map((item) => `${item.role}${item.name}${item.element}（月令${item.seasonState}）${item.relationToOriginalTi}，列为${item.direction}${item.interactionFactKeys.length ? `，另有${item.interactionFactKeys.length}项制化事实须合看` : ''}`).join('；')}；仍须结合旺衰、制化、事项情境、远近和时间尺度，不直接生成日期`,
    sources: [
      '《梅花易数》卷三《占卜克应之诀》从体、用、互、变全卦寻找生体、比和与克体之应',
      '主卦用卦、体互、用互、变卦用卦对原体的五行关系及应卦制化事实',
    ],
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
    requiredContextFields: [...TIMING_REQUIRED_CONTEXT_FIELDS],
    availableContextFields: [],
    missingContextFields: [...TIMING_REQUIRED_CONTEXT_FIELDS],
    promptText:
      '现有排盘未结构化记录所占事项与对象、是否确需刻期、自然期限与远近、年/月/日/时时间尺度、应验方向、数克或理克口径以及适用时的材质耐久性；问题文字若明确提供，只可逐项核对，不得靠关键词猜测，资料未齐时不能计算传统克应',
    sources: ['当前起卦输入与传统克应必要条件逐项对照'],
    limitation: TIMING_FACT_LIMITATION,
  });
  add({
    key: 'meihua:timing:deadline-boundary',
    type: '期限边界',
    sourceStatus: '统一边界',
    ownerFactKeys: [calculationFact.key, yaoCoverageFact.key, internalMotionFact.key],
    promptText:
      '克应事项情境补足前，只能保留动爻、卦数、全卦生克候选、制化和月令盘面事实，不能裁定年/月/日/时单位、计算具体日期或统一快慢',
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
  spatialOmenFact: MeihuaSpatialOmenFact;
  sensoryOmenFact: MeihuaSensoryOmenFact;
  foodContextFact: MeihuaFoodContextFact;
  objectContextFact: MeihuaObjectContextFact;
  topicResponseContextFact: MeihuaTopicResponseContextFact;
  hexagramDispositionFacts: MeihuaHexagramDispositionFact[];
  hexagramDispositionVersionFact: MeihuaHexagramDispositionVersionFact;
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
      params.spatialOmenFact.key,
      params.sensoryOmenFact.key,
      params.foodContextFact.key,
      params.objectContextFact.key,
      params.topicResponseContextFact.key,
      ...params.hexagramDispositionFacts.map((item) => item.key),
      params.hexagramDispositionVersionFact.key,
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
    spatialOmenFactCount: 1,
    sensoryOmenFactCount: 1,
    foodContextFactCount: 1,
    objectContextFactCount: 1,
    topicResponseContextFactCount: 1,
    hexagramDispositionFactCount: params.hexagramDispositionFacts.length,
    hexagramDispositionVersionFactCount: 1,
    transitionFactCount: params.transitionFacts.length,
    traditionalFactCount: params.traditionalFacts.length,
    counterEvidenceCount: params.counterEvidenceFacts.length,
    timingFactCount: params.timingFacts.length,
    promptText: `证据状态${status}：主互变卦象${params.hexagramStructureFacts.length}项、逐爻${params.yaoStructureFacts.length}项、阶段关系${params.stages.length}项、互卦响应${params.interResponseFacts.length}项、体用党1项、应卦制化${params.responseInteractionFacts.length}项、内外动静2项、坐端应兆1项、万物耳目外应1项、饮食专项1项、观物专项1项、事项响应情境1项、反对性情卦画${params.hexagramDispositionFacts.length}项与版本1项、阶段推进${params.transitionFacts.length}项、传统卦爻辞${params.traditionalFacts.length}项、反证${params.counterEvidenceFacts.length}项、应期${params.timingFacts.length}项`,
    sources: [
      '全部起卦、主互变卦象、逐爻、主变体用、互卦响应、体用党、应卦制化、内外动静、坐端应兆、万物耳目外应、饮食专项、观物专项、事项响应情境、反对性情卦画与版本、推进、传统文本、反证与应期事实逐项汇总',
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
  spatialOmenFact: MeihuaSpatialOmenFact;
  sensoryOmenFact: MeihuaSensoryOmenFact;
  foodContextFact: MeihuaFoodContextFact;
  objectContextFact: MeihuaObjectContextFact;
  topicResponseContextFact: MeihuaTopicResponseContextFact;
  hexagramDispositionFacts: MeihuaHexagramDispositionFact[];
  hexagramDispositionVersionFact: MeihuaHexagramDispositionVersionFact;
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
        spatialOmenStatus: params.spatialOmenFact.status,
        sensoryOmenStatus: params.sensoryOmenFact.status,
        foodContextStatus: params.foodContextFact.status,
        objectContextStatus: params.objectContextFact.status,
        topicResponseContextStatus: params.topicResponseContextFact.status,
        hexagramDispositionFactCount: params.hexagramDispositionFacts.length,
        hexagramDispositionVersionStatus: params.hexagramDispositionVersionFact.status,
      },
      dependsOnStepKeys: ['meihua:calculation:hexagrams', 'meihua:calculation:yaos'],
      promptText: `${params.stageCoverageFact.promptText}；计算主变体用、体互与用互对原体的关系、体用党、应卦间制化路径、内卦动静分工及主互变综卦、错卦与抽象卦义；外应动静、坐端八方应兆、万物耳目外应、饮食专项、观物专项与事项响应情境保持资料不足，《诸卦反对性情》底本异文另行保留`,
      sources: [
        '主卦、互卦、变卦上下经卦、综卦、错卦、抽象卦义与原动爻所在经卦的体用、体互、用互、体用党、应卦制化、体用动静及现场坐端、耳目外应资料边界',
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
        spatialOmenFactCount: params.summaryFact.spatialOmenFactCount,
        sensoryOmenFactCount: params.summaryFact.sensoryOmenFactCount,
        foodContextFactCount: params.summaryFact.foodContextFactCount,
        objectContextFactCount: params.summaryFact.objectContextFactCount,
        topicResponseContextFactCount: params.summaryFact.topicResponseContextFactCount,
        hexagramDispositionFactCount: params.summaryFact.hexagramDispositionFactCount,
        hexagramDispositionVersionFactCount: params.summaryFact.hexagramDispositionVersionFactCount,
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
  spatialOmenFact: MeihuaSpatialOmenFact;
  sensoryOmenFact: MeihuaSensoryOmenFact;
  foodContextFact: MeihuaFoodContextFact;
  objectContextFact: MeihuaObjectContextFact;
  topicResponseContextFact: MeihuaTopicResponseContextFact;
  hexagramDispositionFacts: MeihuaHexagramDispositionFact[];
  hexagramDispositionVersionFact: MeihuaHexagramDispositionVersionFact;
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
      key: 'meihua:limitation:spatial-omen',
      type: '坐端应兆边界',
      ownerFactKeys: [params.spatialOmenFact.key],
      promptText:
        '坐端取应须以求测者所在处为中心，使用现场实际观察到的方位与兆象；当前没有这三项资料时，不得把主互变卦方位、体用、数字、时间、问题文字、设备朝向或行政地名替代现场八方观察，更不得套出父母子女、身体病位、吉凶或应期',
      sources: ['《梅花易数》卷三《占卜坐端之诀》与当前坐端资料覆盖'],
    },
    {
      key: 'meihua:limitation:sensory-omen',
      type: '万物外应边界',
      ownerFactKeys: [params.sensoryOmenFact.key],
      promptText:
        '《万物赋》取应先须保留耳闻目见的现场原始事实，区分成卦前后与观察先后，再核对对象类别、实际状态、当时关注对象及所占事项；当前七项资料均未输入时，不得从问题文字、时间戳、卦象、设备感知、历史回忆或事后挑选补造外应，也不得直接套用笑语哭泣、人物鸟兽、器物饮食等例断或标定已发生与未来',
      sources: ['《梅花易数》卷三《万物赋》与当前耳目现场资料覆盖'],
    },
    {
      key: 'meihua:limitation:food-context',
      type: '饮食专项边界',
      ownerFactKeys: [params.foodContextFact.key],
      promptText:
        '《饮食篇》须先确认所占确为具体饮食、宴请、食物或能否得食，并明确判断对象、己人客酒食物专项角色、动静所指与原始记录、宴食时间及主客关系；当前五项资料均未输入，且底本艮、坎段落及末段角色句读尚待校勘，不得以普通体用、问题关键词或卦内动爻套出具体饮食及宾主结论',
      sources: ['《梅花易数》卷三《饮食篇》与当前饮食专项资料覆盖'],
    },
    {
      key: 'meihua:limitation:object-context',
      type: '观物专项边界',
      ownerFactKeys: [params.objectContextFact.key],
      promptText:
        '《观物玄妙歌诀》与《占物类例》须先确认所占确为观物、射覆或具体物件辨识，并明确待辨对象范围、可见遮覆状态和所需属性范围；当前三项情境均未输入。《占物类例》虽列出动爻爻辞、八卦象、体用生克及用变互色数等资料层级，但底本仍有艮离错题、“困于株林”、“体生方圆曲直”、“用变互卦”、数量取值与后续取主规则六类缺口。不得以问题关键词、规则目录或通用盘面套出具体物件及其材质、形色、状态、价值、用途、可食性或精确数量',
      sources: [
        '《梅花易数》卷三《观物玄妙歌诀》《占物类例》、通行《周易》爻辞对照与当前观物专项资料覆盖',
      ],
    },
    {
      key: 'meihua:limitation:topic-response-context',
      type: '事项响应情境边界',
      ownerFactKeys: [params.topicResponseContextFact.key],
      promptText:
        '《诸事响应歌》须先明确事项类别与具体对象、精确判断目标、现实状态及角色关系；当前四项情境均未输入，同一“体克用”在一般人事和行人归期等事项又有不同语义，天气也须区分问晴或问雨并核对特定经卦，“比和凶则有救星”句义尚未独立互证。不得靠问题关键词或通用体用套用事项歌诀，更不得输出胎儿性别、疾病诊断或用药、鬼神或自伤事故原因、诉讼胜负、确定婚姻财务结果及任意量化结论',
      sources: ['《梅花易数》卷三《诸事响应歌》与当前事项响应情境资料覆盖'],
    },
    {
      key: 'meihua:limitation:hexagram-disposition',
      type: '反对性情资料边界',
      ownerFactKeys: [
        ...params.hexagramDispositionFacts.map((item) => item.key),
        params.hexagramDispositionVersionFact.key,
      ],
      promptText:
        '《诸卦反对性情》只把主卦、互卦、变卦的综卦、错卦与通行《杂卦传》抽象卦义作为可核资料；当前底本存在师困、兑巽、同人家人、离坎、未济归妹等错名、漏名和句义移位，异文不覆盖卦画计算。不得把“刚、柔、忧、灾、困”等卦义词直接写成人物性格、动机、心理状态、现实事件、确定吉凶或任意量化结论',
      sources: ['《梅花易数》卷三《诸卦反对性情》底本、通行《杂卦传》与六十四卦卦画复算'],
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
        '动爻、卦数、全卦生克候选、制化与月令旺衰只是盘面事实；事项类型、是否确需刻期、自然期限、材质、远近、时间尺度、数克或理克口径及应验方向未齐时，不能形成完整传统克应判断，不得裁定时间单位、统一快慢或换算唯一日期',
      sources: ['动爻层位、卦数、月令旺衰、全卦生克候选、克应资料覆盖与期限边界'],
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
  const spatialOmenFact = buildSpatialOmenFact();
  const sensoryOmenFact = buildSensoryOmenFact();
  const foodContextFact = buildFoodContextFact();
  const objectContextFact = buildObjectContextFact();
  const topicResponseContextFact = buildTopicResponseContextFact();
  const hexagramDispositionFacts = buildHexagramDispositionFacts(data);
  const hexagramDispositionVersionFact = buildHexagramDispositionVersionFact();
  const stageCoverageFact = buildStageCoverageFact(stages);
  const transitionFacts = buildTransitionFacts(stages);
  const transitions = transitionFacts.map((item) => item.promptText);
  const timingFacts = buildTimingFacts(
    data,
    stages,
    responseReferences,
    responseInteractionFacts,
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
    promptText: `应期状态：待补充事项情境；已登记${timingFacts.length}项盘面、全卦生克候选、资料覆盖与期限边界事实，待明确事项类型、是否确需刻期、自然期限、材质、远近、时间尺度、数克或理克口径及应验方向后再论传统克应`,
    sources: ['逐项动爻、卦数、月令、全卦生克候选、克应资料覆盖与期限边界汇总'],
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
    spatialOmenFact,
    sensoryOmenFact,
    foodContextFact,
    objectContextFact,
    topicResponseContextFact,
    hexagramDispositionFacts,
    hexagramDispositionVersionFact,
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
    spatialOmenFact,
    sensoryOmenFact,
    foodContextFact,
    objectContextFact,
    topicResponseContextFact,
    hexagramDispositionFacts,
    hexagramDispositionVersionFact,
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
    spatialOmenFact,
    sensoryOmenFact,
    foodContextFact,
    objectContextFact,
    topicResponseContextFact,
    hexagramDispositionFacts,
    hexagramDispositionVersionFact,
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
      level: '限制',
      title: '坐端八方应兆资料覆盖',
      detail: `${spatialOmenFact.promptText}；边界：${spatialOmenFact.limitation}`,
      source: spatialOmenFact.sources.join('、'),
      tags: ['坐端之诀', '八方应兆', spatialOmenFact.status],
    },
    {
      level: '限制',
      title: '万物耳目外应资料覆盖',
      detail: `${sensoryOmenFact.promptText}；边界：${sensoryOmenFact.limitation}`,
      source: sensoryOmenFact.sources.join('、'),
      tags: ['万物赋', '耳闻目见', '成卦前后', sensoryOmenFact.status],
    },
    {
      level: '限制',
      title: '饮食专项资料覆盖',
      detail: `${foodContextFact.promptText}；边界：${foodContextFact.limitation}`,
      source: foodContextFact.sources.join('、'),
      tags: ['饮食篇', '饮食专项', '版本校勘', foodContextFact.status],
    },
    {
      level: '限制',
      title: '观物专项、占物类例与版本覆盖',
      detail: `${objectContextFact.promptText}；边界：${objectContextFact.limitation}`,
      source: objectContextFact.sources.join('、'),
      tags: [
        '观物玄妙歌诀',
        '占物类例',
        '爻辞取物',
        '体用生克',
        '互卦数',
        '观物专项',
        '射覆',
        '版本校勘',
        objectContextFact.status,
      ],
    },
    {
      level: '限制',
      title: '诸事响应专项情境与风险边界',
      detail: `${topicResponseContextFact.promptText}；边界：${topicResponseContextFact.limitation}`,
      source: topicResponseContextFact.sources.join('、'),
      tags: [
        '诸事响应歌',
        '事项专项',
        '跨事项冲突',
        '高风险边界',
        '版本互证',
        topicResponseContextFact.status,
      ],
    },
    ...hexagramDispositionFacts.map((fact): PromptEvidenceItem => ({
      level: '辅证',
      title: `${fact.label}${fact.hexagram}反对性情卦画资料`,
      detail: `${fact.promptText}；边界：${fact.limitation}`,
      source: fact.sources.join('、'),
      tags: ['诸卦反对性情', fact.label, fact.reversedRelation, '综卦', '错卦', '抽象卦义'],
    })),
    {
      level: '限制',
      title: '诸卦反对性情底本异文边界',
      detail: `${hexagramDispositionVersionFact.promptText}；边界：${hexagramDispositionVersionFact.limitation}`,
      source: hexagramDispositionVersionFact.sources.join('、'),
      tags: [
        '诸卦反对性情',
        '杂卦传',
        '底本异文',
        '版本校勘',
        hexagramDispositionVersionFact.status,
      ],
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
    `坐端应兆：${spatialOmenFact.promptText}。`,
    `万物外应：${sensoryOmenFact.promptText}。`,
    `饮食专项：${foodContextFact.promptText}。`,
    `观物专项：${objectContextFact.promptText}。`,
    `诸事响应专项：${topicResponseContextFact.promptText}。`,
    `反对性情资料：${hexagramDispositionFacts.map((item) => item.promptText).join('；')}；${hexagramDispositionVersionFact.promptText}。`,
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
    spatialOmenFact,
    sensoryOmenFact,
    foodContextFact,
    objectContextFact,
    topicResponseContextFact,
    hexagramDispositionFacts,
    hexagramDispositionVersionFact,
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
      '坐端八方只接受以求测者所在处为中心的现场方位与真实兆象；缺少观察资料时，不以主互变卦方位、题目文字或设备位置补造人物、病位或吉凶。',
      '《万物赋》耳目外应须保留现场原始事实，区分成卦前后、观察先后、对象类别与实际状态，再与原卦及所占事项合参；资料缺失时不套用笑语哭泣、人物鸟兽、器物饮食等例断。',
      '《饮食篇》只用于明确的具体饮食、宴请、食物或能否得食之占；须另行明确判断对象、己人客酒食物专项角色、动静所指与原始记录、宴食时间及主客关系，且在艮、坎段落与末段句读完成版本校勘前不生成具体饮食或宾主结论。',
      '《观物玄妙歌诀》与《占物类例》只用于明确的观物、射覆或具体物件辨识；须另行明确待辨对象范围、可见遮覆状态和所需属性范围。《占物类例》只登记爻辞、八卦象、体用生克与用变互色数的传统规则目录；艮离错题、爻辞异文、句读冲突、数量取值和后续取主范围未闭合前，不生成具体物件、形色材质、状态、价值、用途、可食性或精确数量。',
      '《诸事响应歌》必须先明确事项类别、具体对象、精确判断目标、现实状态及角色；同一体用关系在不同事项可有不同含义，天气另须区分问晴或问雨并核对特定经卦。当前情境不足且“比和凶则有救星”句义未独立互证时，不套用专项歌诀，不生成胎儿性别、疾病与用药、鬼神或自伤事故原因、诉讼胜负、确定婚姻财务结果或任意量化结论。',
      '《诸卦反对性情》只保留主互变卦画可复算的综卦、错卦及通行《杂卦传》抽象卦义；当前底本错名、漏名、重名与句义移位单独登记，不覆盖卦画计算，也不把刚柔忧乐灾困等词解释成人物性格、动机、心理、现实事件、吉凶或概率。',
      '动爻只标记变化层位，卦数只保留原始计算资料；主卦用卦、体互、用互、变卦用卦的生克只作传统应验方向候选，并须合看旺衰与制化。',
      '事项类型、是否确需刻期、自然期限、材质、远近、时间尺度、数克或理克口径及应验方向未齐时，不从问题关键词猜测，不裁定时间单位、统一快慢或换算绝对日期。',
      '只输出支持、反证、盘面事实与资料边界，不生成吉凶总分、成功率或无依据应期。',
    ],
  };
}
