import type { LiurenData, LiurenLesson, LiurenTransmission } from '../types/divination';
import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import { getVoidBranches } from '../calendar/lunar';
import { getMonthGeneralByZhongqi } from '../calendar/month-general';
import { getDivinationTime } from '../calendar/timeManager';
import { getBranchWuxing, getSeasonState, isValidGanZhi } from '../ganzhi';
import {
  buildHeavenlyPlate,
  DAY_STEM_RESIDENCE_MAP,
  DIZHI,
  FORWARD_GENERAL_GROUND_BRANCHES,
  getDayStemResidence,
  getNoblemanBranch,
  getPlateItemByBranch,
  getUnderByUpper,
  getUpperByUnder,
  GUIREN_BRANCH_BY_STEM,
  LIUREN_DAYTIME_BRANCHES,
  LIUREN_MONTH_LEADER_BY_ZHONGQI,
  LIUREN_NIGHTTIME_BRANCHES,
  REVERSE_GENERAL_GROUND_BRANCHES,
  TIANJIANG,
  TIANJIANG_ATTRIBUTES,
  TIANGAN,
  type TianJiangName,
} from './algorithms/liuren/helpers/plate';
import { buildFourLessons, resolveInitialTransmission } from './algorithms/liuren/helpers/lessons';
import { resolveLiurenClassicalRules } from './algorithms/liuren/helpers/classical-rules';
import {
  buildTransmissionDetail,
  buildTransmissionNote,
  describeLessonDayStemRelation,
  describeTransmissionDayBranchRelation,
  describeTransmissionDayStemRelation,
  describeTransmissionTransition,
  getLiurenBranchPairRelations,
  getLiurenGuaTiFacts,
  getLiurenKinship,
  getPatternTag,
  getTransmissionPattern,
} from './algorithms/liuren/helpers/transmission';
import { buildShenShaFacts } from './algorithms/liuren/helpers/shensha';

export interface LiurenRelationEvidenceFact {
  key: string;
  scope: '四课' | '三传';
  ownerKey: string;
  basis:
    | '上下神关系'
    | '旬空'
    | '月令旺衰'
    | '日干六亲'
    | '日干五行关系'
    | '日支五行关系'
    | '日支地支关系'
    | '相邻传五行关系'
    | '相邻传地支关系';
  status: '支持' | '限制' | '中性';
  value: string;
  promptText: string;
  sources: string[];
  limitation: '课传关系事实只说明六亲、五行方向、月令、旬空、日支或相邻传之间的盘内关系；空亡和固定地支关系须结合类神与事项辨用，不得直接解释为现实吉凶、成功率或必然结果';
}

export interface LiurenLessonEvidence extends LiurenLesson {
  key: string;
  index: number;
  isInitialSource: boolean;
  constraints: string[];
  relationFacts: LiurenRelationEvidenceFact[];
  promptText: string;
  sources: string[];
  limitation: '四课事实只记录上下神、乘将、相对日干六亲与五行方向、课注及其是否参与初传来源；不单独证明现实事件、人物、吉凶或结果';
}

export interface LiurenTransmissionEvidence extends LiurenTransmission {
  key: string;
  index: number;
  label: '起点' | '过程' | '落点';
  support: string[];
  constraints: string[];
  relationFacts: LiurenRelationEvidenceFact[];
  promptText: string;
  sources: string[];
  limitation: '三传事实只记录各传相对日干的六亲与五行方向，以及地支、天将、月令、旬空、日支关系与相邻推进；阶段顺序不证明现实事件必然按同样方式发生';
}

export interface LiurenTransitionFact {
  key: string;
  fromTransmissionKey: string;
  toTransmissionKey: string;
  fromStage: LiurenTransmission['stage'];
  toStage: LiurenTransmission['stage'];
  fromBranch: string;
  toBranch: string;
  relation: string;
  status: '支持' | '限制' | '中性';
  promptText: string;
  sources: string[];
  limitation: '相邻传推进事实只描述三传先后与地支关系，不证明现实事件必然推进、停滞、成功或失败';
}

export interface LiurenTransmissionRuleFact {
  key: 'liuren:transmission-rule';
  status: '已确定';
  rule: string;
  pattern: LiurenData['transmissionPattern'];
  initialBranch: string;
  initialGod: string;
  initialSourceLessonKeys: string[];
  detail: string;
  classicalRuleKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '取传规则事实只说明当前四课如何形成初传及三传模式，不单独证明现实吉凶或应期';
}

export interface LiurenCounterEvidenceFact {
  key: string;
  ownerKey: string;
  scope: '四课' | '三传';
  basis: LiurenRelationEvidenceFact['basis'];
  detail: string;
  status: '已触发';
  promptText: string;
  sources: string[];
  limitation: '反证事实只表示盘内存在经当前口径确认的限制条件；旬空、生克及固定地支关系不得脱离类神、事项和作用方向自动列为反证，也不得把单项反证直接写成现实失败、灾祸或必然结果';
}

export interface LiurenCounterSummaryFact {
  key: 'liuren:counter-summary';
  status: '有明确反证' | '未见明确反证';
  factKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '反证汇总只说明当前结构化核验是否发现盘内限制，不代表现实风险为零，也不表示证据数量可换算为吉凶总分';
}

export interface LiurenTimingFact {
  key: string;
  order: number;
  type: '初传状态' | '三传顺序' | '月日触发' | '期限边界' | '补充条件';
  sourceStatus: '原结果提供' | '由盘面补齐';
  rawText?: string;
  promptText: string;
  sources: string[];
  limitation: '应期事实只登记三传阶段、旺衰及出空、填实、冲实、冲合等候选触发；未同时明确具体类神底本版本、事项类别与参与者角色、完整类神取用规则、已指定类神对象和目标期限时，不得判断确定快慢或换算唯一日期，也不证明事件必然发生';
}

export interface LiurenFocusFact {
  key: string;
  target: string;
  role: string;
  level: '主证' | '辅证';
  evidence: string[];
  limitations: string[];
  sourceStatus: '原结果提供';
  promptText: string;
  sources: string[];
  limitation: '焦点事实只记录初传、日干和日支等盘面位置索引、依据与限制，不等于已按具体事项选定类神；不得把问题文字、范围标签、日干、日支、初传、天将或神煞固定当作类神';
}

export interface LiurenFocusSummaryFact {
  key: 'liuren:focus-summary';
  status: '已提供位置焦点' | '缺少位置焦点';
  factKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '焦点覆盖状态只说明当前结果是否保存盘面位置索引，不表示已经选定类神；只有具体类神底本版本、事项类别与参与者角色、完整类神取用规则和已指定类神对象同时明确后，才可继续类神推算';
}

export interface LiurenTraditionalFact {
  key: string;
  kind: '经典取传规则' | '课体' | '天将属性' | '神煞';
  name: string;
  originalText: string;
  promptText: string;
  sources: string[];
  stages?: string[];
  branches?: string[];
  limitation: '传统规则或类象只用于限定解释方向，不证明现实事件、身份、疾病、死亡、犯罪、婚姻、法律责任或财务结果';
}

export interface LiurenCalculationFact {
  key: string;
  ganzhi: LiurenData['ganzhi'];
  monthLeader: string;
  divinationBranch: string;
  dayNight: LiurenData['dayNight'];
  noblemanBranch: string;
  noblemanGroundBranch: string;
  dayStem: string;
  dayStemResidence: string;
  xunKong: string[];
  promptText: string;
  sources: string[];
  limitation: '起盘参数只记录占时四柱、月将加时、昼夜贵人、日干寄宫与旬空的计算输入和结果，不单独证明现实事件、吉凶或应期';
}

export interface LiurenFoundationConventionFact {
  key: 'liuren:foundation-convention';
  status: '已登记版本边界';
  adoptedVersion: string;
  monthLeaderSwitchRule: '按十二中气的实际交节时刻换将';
  monthLeaderRules: Array<{ zhongqi: string; monthLeader: string }>;
  dayBranches: string[];
  nightBranches: string[];
  noblemanRules: Array<{ dayStems: string[]; dayBranch: string; nightBranch: string }>;
  generalOrder: string[];
  forwardGroundBranches: string[];
  reverseGroundBranches: string[];
  stemResidenceRules: Array<{ dayStems: string[]; branch: string }>;
  alternativeVersionFields: string[];
  textualVariantFields: string[];
  promptText: string;
  sources: string[];
  limitation: '起盘口径事实只声明本结果采用的月将、昼夜贵人、天将顺逆与十干寄宫版本；异说不得与主版本拼接使用，若改用其他贵人表或换将口径，必须从贵人定位、十二天将、四课到三传整体重排，不得只替换单项结论';
}

export interface LiurenTransmissionConventionFact {
  key: 'liuren:transmission-convention';
  status: '已登记版本边界';
  adoptedVersion: string;
  lessonRules: Array<{ lesson: LiurenLesson['name']; lowerRule: string; upperRule: string }>;
  methodOrder: string[];
  directKeRule: string;
  repeatedUpperRule: string;
  biYongRule: string;
  sheHaiRule: {
    depthRule: string;
    tieBreakRule: string;
    useZeBi: false;
  };
  remoteKeRule: string;
  specialMethodRules: Array<{ method: string; rule: string }>;
  alternativeVersionFields: string[];
  promptText: string;
  sources: string[];
  limitation: '四课与取传口径事实只声明本结果采用的四课递取、贼克比用、涉害古法及九宗门特殊取法版本；异说不得与主版本拼接使用，若改用直接取孟仲或择比等其他版本，必须从初传发用到中末传整体重排，不得只替换课名或单支';
}

export interface LiurenPlateFact {
  key: string;
  index: number;
  earthBranch: string;
  heavenBranch: string;
  god: string;
  isNobleman: boolean;
  isNoblemanGround: boolean;
  promptText: string;
  sources: string[];
  limitation: '天地盘逐位字段只证明月将加时与十二天将排布后的对应关系，不单独证明现实吉凶、人物身份、事件或方位结果';
}

export interface LiurenPlateCoverageFact {
  key: string;
  status: '完整' | '缺少';
  expectedCount: 12;
  actualCount: number;
  positionKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '天地盘覆盖状态只说明当前结果能否完整核验十二位对应；缺少逐位资料时不得反推或补造天盘支、地盘支与天将';
}

export interface LiurenEvidenceCalculationStep {
  key: string;
  stage:
    | '起盘参数核验'
    | '天地盘覆盖核验'
    | '四课结构核验'
    | '取传规则核验'
    | '三传推进核验'
    | '反证类神应期核验'
    | '证据汇总';
  status: '已计算' | '资料不足';
  inputs: Record<string, string | number | boolean | string[]>;
  result: Record<string, string | number | boolean | string[]>;
  dependsOnStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '计算步骤只证明占时参数、天地盘、四课、取传、三传、反证、类神与应期条件如何形成当前证据；不证明现实吉凶、事件概率、人物身份或固定应期';
}

export interface LiurenSummaryFact {
  key: 'liuren:evidence-summary';
  status: '证据链完整' | '证据链有缺口';
  factKeys: string[];
  platePositionFactCount: number;
  lessonFactCount: number;
  transmissionFactCount: number;
  transitionFactCount: number;
  counterEvidenceCount: number;
  timingFactCount: number;
  focusFactCount: number;
  traditionalFactCount: number;
  foundationConventionFactCount: 1;
  transmissionConventionFactCount: 1;
  promptText: string;
  sources: string[];
  limitation: '大六壬证据汇总只统计起盘口径与版本、四课取传口径与版本、天地盘、四课取传、三传推进、反证、类神、应期与传统资料的覆盖情况；不得按数量生成吉凶总分、成功率、人物身份、事件保证或唯一日期';
}

export interface LiurenLimitationFact {
  key: string;
  type:
    | '起盘天地盘边界'
    | '四课取传边界'
    | '三传推进边界'
    | '反证类神应期边界'
    | '传统规则类象边界'
    | '高风险输出边界';
  status: '适用';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '限制事实用于约束大六壬占时、天地盘、四课取传、三传、类神、课体、天将、神煞与应期资料能够支持的解释范围，不得被反向当作现实吉凶、人物身份、疾病灾祸、事件概率或固定应期的证据';
}

export interface LiurenEvidenceAnalysis {
  key: 'liuren:evidence';
  status: '已计算';
  calculationFact: LiurenCalculationFact;
  foundationConventionFact: LiurenFoundationConventionFact;
  transmissionConventionFact: LiurenTransmissionConventionFact;
  calculationFacts: string[];
  calculationSteps: LiurenEvidenceCalculationStep[];
  calculationChain: string[];
  plateFact: LiurenPlateCoverageFact;
  platePositionFacts: LiurenPlateFact[];
  plateFacts: string[];
  patternEvidence: string[];
  shenShaEvidence: string[];
  rule: string;
  initialBranch: string;
  initialSourceLessons: string[];
  transmissionRuleFact: LiurenTransmissionRuleFact;
  lessons: LiurenLessonEvidence[];
  transmissions: LiurenTransmissionEvidence[];
  transitionFacts: LiurenTransitionFact[];
  transitions: string[];
  counterEvidenceFacts: LiurenCounterEvidenceFact[];
  counterSummaryFact: LiurenCounterSummaryFact;
  counterEvidence: string[];
  timingFacts: LiurenTimingFact[];
  timingConditions: string[];
  focusFacts: LiurenFocusFact[];
  focusSummaryFact: LiurenFocusSummaryFact;
  focusEvidence: NonNullable<LiurenData['focusEvidence']>;
  timingEvidence: string[];
  traditionalFacts: LiurenTraditionalFact[];
  limitations: string[];
  limitationFacts: LiurenLimitationFact[];
  summaryFact: LiurenSummaryFact;
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: string[];
}

const TRADITIONAL_FACT_LIMITATION =
  '传统规则或类象只用于限定解释方向，不证明现实事件、身份、疾病、死亡、犯罪、婚姻、法律责任或财务结果' as const;
const CALCULATION_FACT_LIMITATION =
  '起盘参数只记录占时四柱、月将加时、昼夜贵人、日干寄宫与旬空的计算输入和结果，不单独证明现实事件、吉凶或应期' as const;
const FOUNDATION_CONVENTION_FACT_LIMITATION =
  '起盘口径事实只声明本结果采用的月将、昼夜贵人、天将顺逆与十干寄宫版本；异说不得与主版本拼接使用，若改用其他贵人表或换将口径，必须从贵人定位、十二天将、四课到三传整体重排，不得只替换单项结论' as const;
const TRANSMISSION_CONVENTION_FACT_LIMITATION =
  '四课与取传口径事实只声明本结果采用的四课递取、贼克比用、涉害古法及九宗门特殊取法版本；异说不得与主版本拼接使用，若改用直接取孟仲或择比等其他版本，必须从初传发用到中末传整体重排，不得只替换课名或单支' as const;
const PLATE_FACT_LIMITATION =
  '天地盘逐位字段只证明月将加时与十二天将排布后的对应关系，不单独证明现实吉凶、人物身份、事件或方位结果' as const;
const PLATE_COVERAGE_LIMITATION =
  '天地盘覆盖状态只说明当前结果能否完整核验十二位对应；缺少逐位资料时不得反推或补造天盘支、地盘支与天将' as const;
const RELATION_FACT_LIMITATION =
  '课传关系事实只说明六亲、五行方向、月令、旬空、日支或相邻传之间的盘内关系；空亡和固定地支关系须结合类神与事项辨用，不得直接解释为现实吉凶、成功率或必然结果' as const;
const LESSON_FACT_LIMITATION =
  '四课事实只记录上下神、乘将、相对日干六亲与五行方向、课注及其是否参与初传来源；不单独证明现实事件、人物、吉凶或结果' as const;
const TRANSMISSION_FACT_LIMITATION =
  '三传事实只记录各传相对日干的六亲与五行方向，以及地支、天将、月令、旬空、日支关系与相邻推进；阶段顺序不证明现实事件必然按同样方式发生' as const;
const TRANSITION_FACT_LIMITATION =
  '相邻传推进事实只描述三传先后与地支关系，不证明现实事件必然推进、停滞、成功或失败' as const;
const RULE_FACT_LIMITATION =
  '取传规则事实只说明当前四课如何形成初传及三传模式，不单独证明现实吉凶或应期' as const;
const COUNTER_FACT_LIMITATION =
  '反证事实只表示盘内存在经当前口径确认的限制条件；旬空、生克及固定地支关系不得脱离类神、事项和作用方向自动列为反证，也不得把单项反证直接写成现实失败、灾祸或必然结果' as const;
const COUNTER_SUMMARY_LIMITATION =
  '反证汇总只说明当前结构化核验是否发现盘内限制，不代表现实风险为零，也不表示证据数量可换算为吉凶总分' as const;
const TIMING_FACT_LIMITATION =
  '应期事实只登记三传阶段、旺衰及出空、填实、冲实、冲合等候选触发；未同时明确具体类神底本版本、事项类别与参与者角色、完整类神取用规则、已指定类神对象和目标期限时，不得判断确定快慢或换算唯一日期，也不证明事件必然发生' as const;
const FOCUS_FACT_LIMITATION =
  '焦点事实只记录初传、日干和日支等盘面位置索引、依据与限制，不等于已按具体事项选定类神；不得把问题文字、范围标签、日干、日支、初传、天将或神煞固定当作类神' as const;
const FOCUS_SUMMARY_LIMITATION =
  '焦点覆盖状态只说明当前结果是否保存盘面位置索引，不表示已经选定类神；只有具体类神底本版本、事项类别与参与者角色、完整类神取用规则和已指定类神对象同时明确后，才可继续类神推算' as const;
const CALCULATION_STEP_LIMITATION =
  '计算步骤只证明占时参数、天地盘、四课、取传、三传、反证、类神与应期条件如何形成当前证据；不证明现实吉凶、事件概率、人物身份或固定应期' as const;
const SUMMARY_FACT_LIMITATION =
  '大六壬证据汇总只统计起盘口径与版本、四课取传口径与版本、天地盘、四课取传、三传推进、反证、类神、应期与传统资料的覆盖情况；不得按数量生成吉凶总分、成功率、人物身份、事件保证或唯一日期' as const;
const LIMITATION_FACT_LIMITATION =
  '限制事实用于约束大六壬占时、天地盘、四课取传、三传、类神、课体、天将、神煞与应期资料能够支持的解释范围，不得被反向当作现实吉凶、人物身份、疾病灾祸、事件概率或固定应期的证据' as const;

export function conditionLiurenTraditionalText(text: string): string {
  if (
    /传统类象|传统类神|凶丧之神|争斗纠纷之神|盗贼隐秘之神|和合之神|恩泽之神|财喜之神|虚诈孤独之神|主反复动荡|主伏而不动|事情会逐步推进|结果更利于|必然|必定|主(?:婚姻|官非|疾病|死丧|失窃|欺骗)/.test(
      text,
    )
  ) {
    return '未采用传统解释；当前只保留可复算盘面事实';
  }
  return text;
}

function buildTraditionalFacts(
  data: LiurenData,
  patternEvidence: string[],
): LiurenTraditionalFact[] {
  const classicalFacts = data.classicalRules.map((item, index): LiurenTraditionalFact => ({
    key: `classical:${index}:${item.rule}`,
    kind: '经典取传规则',
    name: item.rule,
    originalText: item.summary,
    promptText: conditionLiurenTraditionalText(item.summary),
    sources: [item.source],
    limitation: TRADITIONAL_FACT_LIMITATION,
  }));
  const registeredNames = new Set(data.guaTiFacts.map((fact) => fact.name));
  const registeredPatternFacts = data.guaTiFacts.map((fact): LiurenTraditionalFact => ({
    key: fact.stableKey,
    kind: '课体',
    name: fact.name,
    originalText: fact.sourceQuote,
    promptText: `盘面命中“${fact.name}”：${fact.matchedConditions.join('；')}；只登记课体结构，不据此单断现实吉凶`,
    sources: [`${fact.sourceTitle}：“${fact.sourceQuote}”`, fact.sourceUrl],
    branches: [...fact.branches],
    limitation: TRADITIONAL_FACT_LIMITATION,
  }));
  const patternFacts = patternEvidence
    .filter((name) => !registeredNames.has(name))
    .map((name, index): LiurenTraditionalFact => ({
      key: `pattern:${index}:${name}`,
      kind: '课体',
      name,
      originalText: name,
      promptText: `盘面命中“${name}”结构标签；该标签须与四课取传、三传、旺衰和空亡互证`,
      sources: ['发用、三传结构、空亡与课体规则逐项命中'],
      limitation: TRADITIONAL_FACT_LIMITATION,
    }));
  const tianJiangFacts = Array.from(
    data.threeTransmissions
      .reduce((facts, transmission) => {
        const props = data.tianJiangProps[transmission.god];
        if (!props) return facts;
        const previous = facts.get(transmission.god);
        const originalText = `${props.stem}${props.branch}${props.wuxing}${props.yinYang}`;
        facts.set(transmission.god, {
          key: `tianjiang:${transmission.god}`,
          kind: '天将属性',
          name: transmission.god,
          originalText,
          promptText: `配干${props.stem}、配支${props.branch}、五行${props.wuxing}、阴阳${props.yinYang}；未闭合适用条件的类象字段未保存，只保留三传天将落点与基础属性事实`,
          sources: [
            '《六壬大全》卷二《天将总论》《十二将释》',
            '《六壬神将释》十二天将配干支',
            '《六壬粹言》卷一十二天将配干支',
          ],
          stages: [...(previous?.stages ?? []), transmission.stage],
          branches: [...(previous?.branches ?? []), transmission.branch],
          limitation: TRADITIONAL_FACT_LIMITATION,
        });
        return facts;
      }, new Map<string, LiurenTraditionalFact>())
      .values(),
  );
  const shenShaFacts = data.shenShaFacts.map((fact, index): LiurenTraditionalFact => {
    const text = `${fact.name}在${fact.target}`;
    return {
      key: `shensha:${index}:${fact.name}:${fact.target}`,
      kind: '神煞',
      name: fact.name,
      originalText: text,
      promptText: `${fact.basis}${fact.input}，按“${fact.rule}”定位${fact.name}在${fact.target}`,
      sources: [...fact.sources],
      branches:
        fact.targetType === '地支'
          ? [fact.target]
          : fact.targetType === '地支集合'
            ? fact.target.split('、')
            : undefined,
      limitation: TRADITIONAL_FACT_LIMITATION,
    };
  });

  return [
    ...classicalFacts,
    ...registeredPatternFacts,
    ...patternFacts,
    ...tianJiangFacts,
    ...shenShaFacts,
  ];
}

function lessonConstraints() {
  return [];
}

function transmissionSupport(item: LiurenTransmission) {
  return item.seasonState === '旺' || item.seasonState === '相' ? [`月令${item.seasonState}`] : [];
}

function transmissionConstraints(item: LiurenTransmission) {
  return item.seasonState === '休' || item.seasonState === '囚' || item.seasonState === '死'
    ? [`月令${item.seasonState}`]
    : [];
}

function classifyRelationStatus(value: string): LiurenRelationEvidenceFact['status'] {
  if (/克|冲|刑|害|破|空亡|休|囚|死/.test(value)) return '限制';
  if (/生|比和|合|旺|相|不空/.test(value)) return '支持';
  return '中性';
}

function buildLessonEvidence(
  lesson: LiurenLesson,
  index: number,
  initialBranch: string,
  xunKong: string[],
  dayStem: string,
): LiurenLessonEvidence {
  const key = `liuren:lesson:${index + 1}:${lesson.name}`;
  const normalized: LiurenLesson = {
    ...lesson,
    kinship: getLiurenKinship(dayStem, lesson.upper),
    dayStemRelation: describeLessonDayStemRelation(lesson.name, lesson.upper, dayStem),
  };
  const relationFacts: LiurenRelationEvidenceFact[] = [
    {
      key: `${key}:relation`,
      scope: '四课',
      ownerKey: key,
      basis: '上下神关系',
      status: '中性',
      value: lesson.relation,
      promptText: `${lesson.name}${lesson.upper}临${lesson.lower}，上下神关系${lesson.relation}`,
      sources: ['日干寄宫、日支与天地盘逐课推导', '五行生克与地支关系'],
      limitation: RELATION_FACT_LIMITATION,
    },
    {
      key: `${key}:kinship`,
      scope: '四课',
      ownerKey: key,
      basis: '日干六亲',
      status: '中性',
      value: normalized.kinship!,
      promptText: `${lesson.name}上神${lesson.upper}以日干${dayStem}为中心取六亲${normalized.kinship}`,
      sources: [
        '《六壬经纬》干支三传占时本命等处取印盗鬼财劫',
        '《六壬大全》生我、我生、克我、我克、同类五亲口径',
        '《壬归》四课日上神与日干生克口径',
      ],
      limitation: RELATION_FACT_LIMITATION,
    },
    {
      key: `${key}:day-stem-relation`,
      scope: '四课',
      ownerKey: key,
      basis: '日干五行关系',
      status: '中性',
      value: normalized.dayStemRelation!,
      promptText: normalized.dayStemRelation!,
      sources: ['《壬归》四课日上神与日干生克口径', '《六壬经纬》干支三传等处取印盗鬼财劫口径'],
      limitation: RELATION_FACT_LIMITATION,
    },
    ...(xunKong.includes(lesson.upper)
      ? [
          {
            key: `${key}:void:upper`,
            scope: '四课' as const,
            ownerKey: key,
            basis: '旬空' as const,
            status: '中性' as const,
            value: `上神${lesson.upper}空亡`,
            promptText: `${lesson.name}上神${lesson.upper}落日柱旬空`,
            sources: ['日柱旬空与四课上神核验'],
            limitation: RELATION_FACT_LIMITATION,
          },
        ]
      : []),
    ...(xunKong.includes(lesson.lower)
      ? [
          {
            key: `${key}:void:lower`,
            scope: '四课' as const,
            ownerKey: key,
            basis: '旬空' as const,
            status: '中性' as const,
            value: `下位${lesson.lower}空亡`,
            promptText: `${lesson.name}下位${lesson.lower}落日柱旬空`,
            sources: ['日柱旬空与四课下位核验'],
            limitation: RELATION_FACT_LIMITATION,
          },
        ]
      : []),
  ];
  const constraints = lessonConstraints();
  return {
    ...normalized,
    key,
    index: index + 1,
    isInitialSource: lesson.upper === initialBranch,
    constraints,
    relationFacts,
    promptText: `${lesson.name}${lesson.upper}临${lesson.lower}，乘${lesson.god}，相对日干为${normalized.kinship}，${normalized.dayStemRelation}，上下神关系${lesson.relation}；${conditionLiurenTraditionalText(lesson.note || '课注未列')}`,
    sources: [
      '日干寄宫、日支与天地盘逐课推导',
      '日柱旬空与上下神关系核验',
      '《六壬经纬》《六壬大全》《壬归》四课上神六亲口径',
    ],
    limitation: LESSON_FACT_LIMITATION,
  };
}

function buildTransmissionEvidence(
  item: LiurenTransmission,
  index: number,
  xunKong: string[],
  dayStem: string,
  dayBranch: string,
  previousTransmission?: LiurenTransmission,
): LiurenTransmissionEvidence {
  const stageLabels = ['起点', '过程', '落点'] as const;
  const normalized: LiurenTransmission = {
    ...item,
    kinship: getLiurenKinship(dayStem, item.branch),
    dayStemRelation: describeTransmissionDayStemRelation(item.stage, item.branch, dayStem),
    previousRelation: previousTransmission
      ? describeTransmissionTransition(
          previousTransmission.stage,
          previousTransmission.branch,
          item.stage,
          item.branch,
        )
      : undefined,
    previousBranchRelations: previousTransmission
      ? getLiurenBranchPairRelations(previousTransmission.branch, item.branch)
      : [],
    dayRelation: describeTransmissionDayBranchRelation(item.stage, item.branch, dayBranch),
    dayBranchRelations: getLiurenBranchPairRelations(item.branch, dayBranch),
    isVoid: xunKong.includes(item.branch),
    relation: describeTransmissionDayStemRelation(item.stage, item.branch, dayStem),
  };
  normalized.note = buildTransmissionNote(normalized);
  const key = `liuren:transmission:${item.stage}:${item.branch}`;
  const formattedTransmission = `${normalized.stage}${normalized.branch}乘${normalized.god}（${normalized.wuxing || '五行未列'}、月令${normalized.seasonState || '未定'}${normalized.isVoid ? '、空亡' : ''}）`;
  const relationFacts: LiurenRelationEvidenceFact[] = [
    {
      key: `${key}:kinship`,
      scope: '三传',
      ownerKey: key,
      basis: '日干六亲',
      status: '中性',
      value: normalized.kinship!,
      promptText: `${normalized.stage}${normalized.branch}以日干${dayStem}为中心取六亲${normalized.kinship}`,
      sources: ['三传逐传与日干五行生克核验', '《六壬指南》三传六亲口径'],
      limitation: RELATION_FACT_LIMITATION,
    },
    {
      key: `${key}:day-stem-relation`,
      scope: '三传',
      ownerKey: key,
      basis: '日干五行关系',
      status: '中性',
      value: normalized.dayStemRelation!,
      promptText: `${normalized.stage}${normalized.branch}与日干的有方向五行关系为${normalized.dayStemRelation}`,
      sources: ['三传地支与日干五行生克方向核验'],
      limitation: RELATION_FACT_LIMITATION,
    },
    {
      key: `${key}:season-state`,
      scope: '三传',
      ownerKey: key,
      basis: '月令旺衰',
      status: classifyRelationStatus(item.seasonState ?? '未定'),
      value: item.seasonState ?? '未定',
      promptText: `${item.stage}${item.branch}月令状态${item.seasonState ?? '未定'}`,
      sources: ['月支五行与三传地支五行旺相休囚死关系'],
      limitation: RELATION_FACT_LIMITATION,
    },
    {
      key: `${key}:day-element-relation`,
      scope: '三传',
      ownerKey: key,
      basis: '日支五行关系',
      status: '中性',
      value: normalized.dayRelation!,
      promptText: `${normalized.stage}${normalized.branch}与日支的有方向五行关系为${normalized.dayRelation}`,
      sources: ['三传地支与日支五行生克方向核验'],
      limitation: RELATION_FACT_LIMITATION,
    },
    {
      key: `${key}:day-branch-relations`,
      scope: '三传',
      ownerKey: key,
      basis: '日支地支关系',
      status: '中性',
      value: normalized.dayBranchRelations!.join('、') || '无固定关系',
      promptText: `${normalized.stage}${normalized.branch}与日支${dayBranch}的固定地支关系为${normalized.dayBranchRelations!.join('、') || '无'}`,
      sources: ['同支、六合、六冲、六害、六破与相刑固定表逐项核验'],
      limitation: RELATION_FACT_LIMITATION,
    },
    {
      key: `${key}:void`,
      scope: '三传',
      ownerKey: key,
      basis: '旬空',
      status: '中性',
      value: normalized.isVoid ? '空亡' : '不空',
      promptText: `${item.stage}${item.branch}${normalized.isVoid ? '落日柱旬空' : '不在日柱旬空内'}；空亡有宜有忌，须结合类神与事项辨用`,
      sources: ['日柱旬空与三传地支逐项核验', '《六壬大全》喜惧空亡口径'],
      limitation: RELATION_FACT_LIMITATION,
    },
    ...(previousTransmission
      ? [
          {
            key: `${key}:previous-element-relation`,
            scope: '三传' as const,
            ownerKey: key,
            basis: '相邻传五行关系' as const,
            status: '中性' as const,
            value: normalized.previousRelation!,
            promptText: `${previousTransmission.stage}${previousTransmission.branch}至${normalized.stage}${normalized.branch}的有方向五行关系为${normalized.previousRelation}`,
            sources: ['三传先后次序与相邻地支五行生克方向核验'],
            limitation: RELATION_FACT_LIMITATION,
          },
          {
            key: `${key}:previous-branch-relations`,
            scope: '三传' as const,
            ownerKey: key,
            basis: '相邻传地支关系' as const,
            status: '中性' as const,
            value: normalized.previousBranchRelations!.join('、') || '无固定关系',
            promptText: `${previousTransmission.stage}${previousTransmission.branch}至${normalized.stage}${normalized.branch}的固定地支关系为${normalized.previousBranchRelations!.join('、') || '无'}`,
            sources: ['同支、六合、六冲、六害、六破与相刑固定表逐项核验'],
            limitation: RELATION_FACT_LIMITATION,
          },
        ]
      : []),
  ];
  return {
    ...normalized,
    key,
    index: index + 1,
    label: stageLabels[index],
    support: transmissionSupport(normalized),
    constraints: transmissionConstraints(normalized),
    relationFacts,
    promptText: `${formattedTransmission}；相对日干为${normalized.kinship}，${normalized.dayStemRelation}；${normalized.previousRelation ? `相邻推进${normalized.previousRelation}；` : ''}与日支关系${normalized.dayRelation}，固定地支关系${normalized.dayBranchRelations!.join('、') || '无'}；${conditionLiurenTraditionalText(normalized.note || '传注未列')}`,
    sources: ['三传六亲、五行方向、天将、月令旺衰、旬空、日支与相邻关系核验'],
    limitation: TRANSMISSION_FACT_LIMITATION,
  };
}

function buildTransitionFacts(transmissions: LiurenTransmissionEvidence[]): LiurenTransitionFact[] {
  return transmissions.slice(1).map((item, index) => {
    const previous = transmissions[index];
    return {
      key: `liuren:transition:${previous.stage}:${item.stage}`,
      fromTransmissionKey: previous.key,
      toTransmissionKey: item.key,
      fromStage: previous.stage,
      toStage: item.stage,
      fromBranch: previous.branch,
      toBranch: item.branch,
      relation: item.previousRelation!,
      status: '中性',
      promptText: `${previous.stage}${previous.branch} → ${item.stage}${item.branch}：${item.previousRelation}；固定地支关系${item.previousBranchRelations?.join('、') || '无'}；前后两传六亲分别为${previous.kinship}、${item.kinship}`,
      sources: ['三传先后次序、逐传日干六亲、相邻五行方向与固定地支关系'],
      limitation: TRANSITION_FACT_LIMITATION,
    };
  });
}

function buildTimingFacts(
  data: LiurenData,
  transmissions: LiurenTransmissionEvidence[],
): { timingFacts: LiurenTimingFact[]; normalizedInput: string[] } {
  const initial = transmissions[0];
  const normalizedInput = Array.from(new Set(data.timingEvidence)).filter((item) => {
    if (!item.includes(`初传${initial.branch}`)) return true;
    return initial.isVoid
      ? !new RegExp(`初传${initial.branch}不空`).test(item)
      : !new RegExp(`初传${initial.branch}(?:空亡|落旬空)`).test(item);
  });
  const definitions: Array<{
    type: Exclude<LiurenTimingFact['type'], '补充条件'>;
    matcher: (text: string) => boolean;
    computed: string;
    sources: string[];
  }> = [
    {
      type: '初传状态',
      matcher: (text) => text.startsWith('一级发用：'),
      computed: `一级发用：初传${initial.branch}${initial.isVoid ? '落旬空' : '不空'}；空亡有宜有忌，须结合类神与事项判断，出空、填实、冲实仅作候选触发`,
      sources: ['初传地支与日柱旬空核验', '《六壬大全》喜惧空亡口径'],
    },
    {
      type: '三传顺序',
      matcher: (text) => text.startsWith('二级三传：'),
      computed: `二级三传：${transmissions.map((item) => `${item.stage}${item.branch}（月令${item.seasonState ?? '未定'}${item.isVoid ? '、空' : ''}）`).join('→')}`,
      sources: ['初中末传顺序、月令旺衰与旬空状态'],
    },
    {
      type: '月日触发',
      matcher: (text) => text.startsWith('三级日月：'),
      computed: `三级日月：只登记日支${data.ganzhi.day.slice(-1)}、月支${data.ganzhi.month.slice(-1)}与初传的同支、冲合及旺衰事实；类神未由通用盘选定`,
      sources: ['月支、日支与初传的同支冲合旺衰核验', '类神取用资料缺失边界'],
    },
    {
      type: '期限边界',
      matcher: (text) => /未给.*期限|未选定类神|类神底本版本|不硬换成唯一日期/.test(text),
      computed:
        '未同时明确具体类神底本版本、事项类别与参与者角色、完整类神取用规则、已指定类神对象和目标期限时，只登记三传阶段、旺衰及候选触发，不判断确定快慢，也不换算唯一日期',
      sources: ['应期解释边界'],
    },
  ];
  const consumed = new Set<string>();
  const timingFacts = definitions.map((definition, index): LiurenTimingFact => {
    const rawText = normalizedInput.find((text) => !consumed.has(text) && definition.matcher(text));
    if (rawText) consumed.add(rawText);
    return {
      key: `liuren:timing:${index + 1}:${definition.type}`,
      order: index + 1,
      type: definition.type,
      sourceStatus: rawText ? '原结果提供' : '由盘面补齐',
      ...(rawText ? { rawText } : {}),
      promptText: definition.computed,
      sources: rawText
        ? ['当前大六壬结果已保存的应期条件', ...definition.sources]
        : definition.sources,
      limitation: TIMING_FACT_LIMITATION,
    };
  });
  normalizedInput
    .filter((text) => !consumed.has(text))
    .forEach((text, index) => {
      timingFacts.push({
        key: `liuren:timing:supplement:${index + 1}`,
        order: timingFacts.length + 1,
        type: '补充条件',
        sourceStatus: '原结果提供',
        rawText: text,
        promptText: text,
        sources: ['当前大六壬结果已保存的补充应期条件'],
        limitation: TIMING_FACT_LIMITATION,
      });
    });
  return {
    timingFacts,
    normalizedInput: normalizedInput.map(
      (text) => definitions.find((definition) => definition.matcher(text))?.computed ?? text,
    ),
  };
}

function buildFocusFacts(
  data: LiurenData,
  transmissions: LiurenTransmissionEvidence[],
): LiurenFocusFact[] {
  const initial = transmissions[0];
  return data.focusEvidence.map((item, index) => {
    const isInitialFocus = item.target.startsWith(`初传${initial.branch}`);
    const evidence = isInitialFocus
      ? [
          data.transmissionRule
            ? `${data.transmissionRule}取为初传`
            : `初传${initial.branch}为发用`,
          `月令${initial.seasonState ?? '未定'}`,
          `六亲${initial.kinship}`,
          initial.dayRelation!,
        ]
      : [...item.evidence];
    const limitations = isInitialFocus
      ? [
          initial.isVoid
            ? '初传落旬空；这里只记录位置条件，不等于已选类神，也不生成现实吉凶或应期'
            : '初传不空只表示位置事实，不等于已选类神或现实事件已经发动',
        ]
      : [...item.limitations];
    return {
      key: `liuren:focus:${index + 1}:${item.target}:${item.role}`,
      target: item.target,
      role: item.role,
      level: item.level,
      evidence,
      limitations,
      sourceStatus: '原结果提供',
      promptText: `${item.target}${item.role}：依据${evidence.join('、') || '未列独立证据'}；限制${limitations.join('、') || '只作盘面位置索引，不等于已按具体事项选定类神'}`,
      sources: ['当前结果已保存的初传、日干与日支盘面位置索引及课传依据'],
      limitation: FOCUS_FACT_LIMITATION,
    };
  });
}

function buildFoundationConventionFact(): LiurenFoundationConventionFact {
  const noblemanGroups = new Map<
    string,
    { dayStems: string[]; dayBranch: string; nightBranch: string }
  >();
  for (const dayStem of TIANGAN) {
    const rule = GUIREN_BRANCH_BY_STEM[dayStem];
    const groupKey = `${rule.day}:${rule.night}`;
    const current = noblemanGroups.get(groupKey);
    if (current) {
      current.dayStems.push(dayStem);
    } else {
      noblemanGroups.set(groupKey, {
        dayStems: [dayStem],
        dayBranch: rule.day,
        nightBranch: rule.night,
      });
    }
  }

  const residenceGroups = new Map<string, { dayStems: string[]; branch: string }>();
  for (const dayStem of TIANGAN) {
    const branch = DAY_STEM_RESIDENCE_MAP[dayStem];
    const current = residenceGroups.get(branch);
    if (current) {
      current.dayStems.push(dayStem);
    } else {
      residenceGroups.set(branch, { dayStems: [dayStem], branch });
    }
  }

  return {
    key: 'liuren:foundation-convention',
    status: '已登记版本边界',
    adoptedVersion:
      '月将采用《六壬粹言》《六壬指南》互证的十二中气口径，贵人采用《六壬粹言》与《大六壬大全》正文通行表',
    monthLeaderSwitchRule: '按十二中气的实际交节时刻换将',
    monthLeaderRules: Object.entries(LIUREN_MONTH_LEADER_BY_ZHONGQI).map(
      ([zhongqi, monthLeader]) => ({ zhongqi, monthLeader }),
    ),
    dayBranches: [...LIUREN_DAYTIME_BRANCHES],
    nightBranches: [...LIUREN_NIGHTTIME_BRANCHES],
    noblemanRules: [...noblemanGroups.values()],
    generalOrder: [...TIANJIANG],
    forwardGroundBranches: [...FORWARD_GENERAL_GROUND_BRANCHES],
    reverseGroundBranches: [...REVERSE_GENERAL_GROUND_BRANCHES],
    stemResidenceRules: [...residenceGroups.values()],
    alternativeVersionFields: [
      '《六壬寻源》卷一采用先天阳贵、后天阴贵表，例如甲日阳贵未、阴贵丑，与本结果甲日昼贵丑、夜贵未相反',
      '《大六壬大全》卷首明确指出正文贵人法“尚沿俗例”，另推先后天贵人；本结果保留该异说，但不与正文通行表混排',
      '昼夜也有按日出日入划分的异说；本结果依《六壬粹言》固定以卯至申为昼、酉至寅为夜',
    ],
    textualVariantFields: [
      '《六壬粹言》《六壬指南》及《六壬指南注解》均作小雪后功曹寅将，本结果采用小雪交节换寅将',
      '《大六壬大全》当前电子底本功曹条作“大雪后日躔析木”，登记为底本或转录异文，不据此把换将延后至大雪',
      '《大六壬大全》当前电子底本贵人歌“六壬逢马虎”与上下文不合；以《六壬粹言》明确的“六辛日昼贵午、夜贵寅”互证，不把转录字面当作新规则',
    ],
    promptText:
      '本结果按十二中气实际交节换月将，以月将加占时；昼夜按卯至申、酉至寅分界，贵人采用《六壬粹言》与《大六壬大全》正文通行表，贵人临亥至辰顺布、临巳至戌逆布十二天将，十干寄宫采用通行表；《六壬寻源》先后天贵人异说及《大六壬大全》“大雪”文本异文仅登记边界，不与当前课盘混用',
    sources: [
      '《六壬粹言》卷首起课法、十干贵神辨异与贵人总论',
      '《六壬指南》卷一月将加正时条',
      '《六壬指南注解》卷一月将加正时条',
      '《大六壬大全》卷首贵人辨异、卷一十干寄宫、十二月将与天将总论，卷四《括囊赋》及贵人歌',
      '《六壬寻源》卷一贵人起例（日贵人歌、夜贵人歌）',
    ],
    limitation: FOUNDATION_CONVENTION_FACT_LIMITATION,
  };
}

function buildTransmissionConventionFact(): LiurenTransmissionConventionFact {
  return {
    key: 'liuren:transmission-convention',
    status: '已登记版本边界',
    adoptedVersion:
      '四课、贼克比用、遥克及特殊取法采用《六壬粹言》《大六壬大全》正文及《六壬指南》可互证口径；涉害单独采用《六壬粹言》《大六壬大全》所载先计实际深浅古法，不采用《六壬指南》直接依孟仲或《大六壬大全》择比异说',
    lessonRules: [
      { lesson: '一课', lowerRule: '日干', upperRule: '日干寄宫上神' },
      { lesson: '二课', lowerRule: '一课上神', upperRule: '一课上神再取上神' },
      { lesson: '三课', lowerRule: '日支', upperRule: '日支上神' },
      { lesson: '四课', lowerRule: '三课上神', upperRule: '三课上神再取上神' },
    ],
    methodOrder: ['贼克', '比用', '涉害', '遥克', '昴星', '别责', '八专', '伏吟', '返吟'],
    directKeRule:
      '四课先取下贼上，后取上克下；只有一处时分别为重审、元首，多处再依比用与涉害定发用',
    repeatedUpperRule: '同一上神在重复课中只按一处克候选计算',
    biYongRule: '多处候选先取上神与日干阴阳相同者；仍不唯一再进入涉害',
    sheHaiRule: {
      depthRule:
        '从候选上神所临地盘之后起数，行至该上神本家前停止，起点与本家均不计，比较沿途实际受克深浅',
      tieBreakRule: '同深先孟、无孟取仲，复等时阳日取干上、阴日取支上',
      useZeBi: false,
    },
    remoteKeRule:
      '四课无直接克时只检查二、三、四课；先取上神克日为蒿矢，再取日克上神为弹射，多候选仍依比用、涉害',
    specialMethodRules: [
      {
        method: '昴星',
        rule: '无克无遥克且四课俱备时，阳日取地盘酉上神为初、支上为中、干上为末；阴日取天盘酉下神为初、干上为中、支上为末',
      },
      {
        method: '别责',
        rule: '四课不备而三课异时，阳日取合干寄宫上神，阴日直接取日支三合前一支，中末均取干上神',
      },
      {
        method: '八专',
        rule: '甲寅、庚申、丁未、己未、癸丑五日有克仍从克法；无克不取遥克，阳日从干阳神顺数第三位、阴日从支阴神逆数第三位发用，中末均取干上神',
      },
      {
        method: '伏吟',
        rule: '六乙、六癸虽有课内克仍分别从辰、丑发用，六乙按杜传推进；其余无克阳日自任取干上、阴日自信取支上，再依三刑及自刑杜传口径推进',
      },
      {
        method: '返吟',
        rule: '有克仍从贼克；无克取日支驿马发用，中取支上、末取干上，主标签无亲，井栏射为同法名，无依兼见作返吟总称',
      },
    ],
    alternativeVersionFields: [
      '《六壬指南》涉害正文更接近不先计实际深浅、直接依孟仲选择；本结果不与深浅古法拼接',
      '《大六壬大全》另载涉害后避开被日干所克者的“择比”法；《六壬粹言》明确谓不可从，本结果不采用',
      '返吟无克又称井栏射；《六壬粹言》《大六壬大全》可称无亲，《大六壬大全》《六壬指南》又以无依概括返吟，名称边界不改变三传数值',
    ],
    promptText:
      '四课依日干寄宫、日支各取上下二课；取传先下贼上、后上克下，多克先比用再涉害，重复上神只计一处。涉害先比实际深浅，再依孟仲与阳干阴支复等，不采用择比；遥克只看二三四课；昴星、别责、五个八专日、伏吟与返吟均按已登记主版本整体取三传',
    sources: [
      '《六壬粹言》卷首四课与九宗门、辨非涉害别责八专条',
      '《大六壬大全》卷一九宗门、涉害课、八专课、伏吟课与返吟课',
      '《六壬指南》卷一四课与九宗门',
      '《六壬指南注解》卷一四课与九宗门注解',
      '《六壬寻源》卷一九宗门取传次序参校',
    ],
    limitation: TRANSMISSION_CONVENTION_FACT_LIMITATION,
  };
}

function buildCalculationFact(data: LiurenData, xunKong: string[]): LiurenCalculationFact {
  const dayStem = data.ganzhi.day.charAt(0);
  return {
    key: `liuren:calculation:${data.timestamp}`,
    ganzhi: { ...data.ganzhi },
    monthLeader: data.monthLeader,
    divinationBranch: data.divinationBranch,
    dayNight: data.dayNight,
    noblemanBranch: data.noblemanBranch,
    noblemanGroundBranch: data.noblemanGroundBranch,
    dayStem,
    dayStemResidence: data.dayStemResidence,
    xunKong: [...xunKong],
    promptText: `四柱干支为年${data.ganzhi.year}、月${data.ganzhi.month}、日${data.ganzhi.day}、时${data.ganzhi.hour}；月将${data.monthLeader}加占时${data.divinationBranch}；${data.dayNight}，日干贵人${data.noblemanBranch}临地盘${data.noblemanGroundBranch}；日干${dayStem}寄${data.dayStemResidence}；日柱旬空${xunKong.join('、')}`,
    sources: [
      '占时四柱与月将中气切换计算',
      '月将加时天地盘规则',
      '昼夜贵人、日干寄宫与日柱旬空规则',
    ],
    limitation: CALCULATION_FACT_LIMITATION,
  };
}

function buildPlatePositionFacts(data: LiurenData): LiurenPlateFact[] {
  return data.heavenlyPlate.map((item, index) => ({
    key: `liuren:plate:${item.under}:${item.branch}:${item.god}`,
    index: index + 1,
    earthBranch: item.under,
    heavenBranch: item.branch,
    god: item.god,
    isNobleman: item.branch === data.noblemanBranch,
    isNoblemanGround: item.under === data.noblemanGroundBranch,
    promptText: `第${index + 1}位地盘${item.under}上见天盘${item.branch}乘${item.god}${item.branch === data.noblemanBranch ? '，此天盘支为日干贵人' : ''}${item.under === data.noblemanGroundBranch ? '，贵人临此地盘' : ''}`,
    sources: ['月将加占时生成天地盘十二支对应', '贵人临地盘定天将顺逆并布十二天将'],
    limitation: PLATE_FACT_LIMITATION,
  }));
}

function buildPlateCoverageFact(positions: LiurenPlateFact[]): LiurenPlateCoverageFact {
  const status = positions.length === 12 ? '完整' : '缺少';
  return {
    key: 'liuren:plate:coverage',
    status,
    expectedCount: 12,
    actualCount: positions.length,
    positionKeys: positions.map((item) => item.key),
    promptText:
      status === '完整'
        ? '天地盘十二位与十二天将资料完整，可逐位核验月将加时和贵人顺逆排布。'
        : `当前结果仅保留${positions.length}/12位天地盘资料，无法完整核验月将加时和十二天将排布；不得反推或补造缺失位置。`,
    sources: ['当前大六壬结果的天地盘逐位记录', '十二地支与十二天将完整性检查'],
    limitation: PLATE_COVERAGE_LIMITATION,
  };
}

function buildSummaryFact(params: {
  calculationFact: LiurenCalculationFact;
  foundationConventionFact: LiurenFoundationConventionFact;
  transmissionConventionFact: LiurenTransmissionConventionFact;
  plateFact: LiurenPlateCoverageFact;
  platePositionFacts: LiurenPlateFact[];
  transmissionRuleFact: LiurenTransmissionRuleFact;
  lessons: LiurenLessonEvidence[];
  transmissions: LiurenTransmissionEvidence[];
  transitionFacts: LiurenTransitionFact[];
  counterSummaryFact: LiurenCounterSummaryFact;
  counterEvidenceFacts: LiurenCounterEvidenceFact[];
  timingFacts: LiurenTimingFact[];
  focusSummaryFact: LiurenFocusSummaryFact;
  focusFacts: LiurenFocusFact[];
  traditionalFacts: LiurenTraditionalFact[];
}): LiurenSummaryFact {
  const factKeys = Array.from(
    new Set([
      params.calculationFact.key,
      params.foundationConventionFact.key,
      params.transmissionConventionFact.key,
      params.plateFact.key,
      ...params.platePositionFacts.map((item) => item.key),
      params.transmissionRuleFact.key,
      ...params.lessons.flatMap((item) => [
        item.key,
        ...item.relationFacts.map((fact) => fact.key),
      ]),
      ...params.transmissions.flatMap((item) => [
        item.key,
        ...item.relationFacts.map((fact) => fact.key),
      ]),
      ...params.transitionFacts.map((item) => item.key),
      params.counterSummaryFact.key,
      ...params.counterEvidenceFacts.map((item) => item.key),
      ...params.timingFacts.map((item) => item.key),
      params.focusSummaryFact.key,
      ...params.focusFacts.map((item) => item.key),
      ...params.traditionalFacts.map((item) => item.key),
    ]),
  );
  const status =
    params.plateFact.status === '完整' &&
    params.lessons.length === 4 &&
    params.transmissions.length === 3 &&
    params.transitionFacts.length === 2
      ? '证据链完整'
      : '证据链有缺口';
  return {
    key: 'liuren:evidence-summary',
    status,
    factKeys,
    platePositionFactCount: params.platePositionFacts.length,
    lessonFactCount: params.lessons.length,
    transmissionFactCount: params.transmissions.length,
    transitionFactCount: params.transitionFacts.length,
    counterEvidenceCount: params.counterEvidenceFacts.length,
    timingFactCount: params.timingFacts.length,
    focusFactCount: params.focusFacts.length,
    traditionalFactCount: params.traditionalFacts.length,
    foundationConventionFactCount: 1,
    transmissionConventionFactCount: 1,
    promptText: `证据链状态：${status}；起盘口径与版本边界1项、四课取传口径与版本边界1项、天地盘${params.platePositionFacts.length}/12位、四课${params.lessons.length}项、三传${params.transmissions.length}项、推进${params.transitionFacts.length}项、反证${params.counterEvidenceFacts.length}项、应期${params.timingFacts.length}项、盘面位置焦点${params.focusFacts.length}项、传统资料${params.traditionalFacts.length}项`,
    sources: [
      '全部起盘口径与版本、四课取传口径与版本、天地盘、四课取传、三传、反证、盘面位置焦点、应期与传统事实逐项汇总',
    ],
    limitation: SUMMARY_FACT_LIMITATION,
  };
}

function buildCalculationSteps(params: {
  calculationFact: LiurenCalculationFact;
  foundationConventionFact: LiurenFoundationConventionFact;
  transmissionConventionFact: LiurenTransmissionConventionFact;
  plateFact: LiurenPlateCoverageFact;
  platePositionFacts: LiurenPlateFact[];
  lessons: LiurenLessonEvidence[];
  transmissionRuleFact: LiurenTransmissionRuleFact;
  transmissions: LiurenTransmissionEvidence[];
  transitionFacts: LiurenTransitionFact[];
  counterEvidenceFacts: LiurenCounterEvidenceFact[];
  counterSummaryFact: LiurenCounterSummaryFact;
  focusFacts: LiurenFocusFact[];
  focusSummaryFact: LiurenFocusSummaryFact;
  timingFacts: LiurenTimingFact[];
  summaryFact: LiurenSummaryFact;
}): LiurenEvidenceCalculationStep[] {
  return [
    {
      key: 'liuren:calculation:chart-input',
      stage: '起盘参数核验',
      status: '已计算',
      inputs: {
        ganzhi: [
          params.calculationFact.ganzhi.year,
          params.calculationFact.ganzhi.month,
          params.calculationFact.ganzhi.day,
          params.calculationFact.ganzhi.hour,
        ],
        monthLeader: params.calculationFact.monthLeader,
        divinationBranch: params.calculationFact.divinationBranch,
      },
      result: {
        dayNight: params.calculationFact.dayNight,
        noblemanBranch: params.calculationFact.noblemanBranch,
        noblemanGroundBranch: params.calculationFact.noblemanGroundBranch,
        dayStemResidence: params.calculationFact.dayStemResidence,
        xunKong: params.calculationFact.xunKong,
      },
      dependsOnStepKeys: [],
      promptText: `${params.foundationConventionFact.promptText}；${params.calculationFact.promptText}`,
      sources: Array.from(
        new Set([...params.foundationConventionFact.sources, ...params.calculationFact.sources]),
      ),
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'liuren:calculation:plate',
      stage: '天地盘覆盖核验',
      status: params.plateFact.status === '完整' ? '已计算' : '资料不足',
      inputs: {
        monthLeader: params.calculationFact.monthLeader,
        divinationBranch: params.calculationFact.divinationBranch,
        noblemanGroundBranch: params.calculationFact.noblemanGroundBranch,
      },
      result: {
        coverageStatus: params.plateFact.status,
        expectedCount: params.plateFact.expectedCount,
        actualCount: params.platePositionFacts.length,
      },
      dependsOnStepKeys: ['liuren:calculation:chart-input'],
      promptText: params.plateFact.promptText,
      sources: Array.from(
        new Set([
          ...params.plateFact.sources,
          ...params.platePositionFacts.flatMap((item) => item.sources),
        ]),
      ),
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'liuren:calculation:lessons',
      stage: '四课结构核验',
      status: params.lessons.length === 4 ? '已计算' : '资料不足',
      inputs: { platePositionCount: params.platePositionFacts.length },
      result: {
        lessonCount: params.lessons.length,
        initialSourceLessons: params.lessons
          .filter((item) => item.isInitialSource)
          .map((item) => item.name),
      },
      dependsOnStepKeys: ['liuren:calculation:plate'],
      promptText: `四课共${params.lessons.length}项，逐课记录上下神、乘将、关系、旬空与初传来源状态`,
      sources: Array.from(new Set(params.lessons.flatMap((item) => item.sources))),
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'liuren:calculation:transmission-rule',
      stage: '取传规则核验',
      status: '已计算',
      inputs: {
        lessonCount: params.lessons.length,
        initialSourceLessonKeys: params.transmissionRuleFact.initialSourceLessonKeys,
      },
      result: {
        ruleStatus: params.transmissionRuleFact.status,
        rule: params.transmissionRuleFact.rule,
        pattern: params.transmissionRuleFact.pattern,
        initialBranch: params.transmissionRuleFact.initialBranch,
        initialGod: params.transmissionRuleFact.initialGod,
      },
      dependsOnStepKeys: ['liuren:calculation:lessons'],
      promptText: `${params.transmissionConventionFact.promptText}；${params.transmissionRuleFact.promptText}`,
      sources: Array.from(
        new Set([
          ...params.transmissionConventionFact.sources,
          ...params.transmissionRuleFact.sources,
        ]),
      ),
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'liuren:calculation:transmissions',
      stage: '三传推进核验',
      status:
        params.transmissions.length === 3 && params.transitionFacts.length === 2
          ? '已计算'
          : '资料不足',
      inputs: { initialBranch: params.transmissionRuleFact.initialBranch },
      result: {
        transmissionCount: params.transmissions.length,
        transitionCount: params.transitionFacts.length,
        stages: params.transmissions.map((item) => `${item.stage}${item.branch}`),
      },
      dependsOnStepKeys: ['liuren:calculation:transmission-rule'],
      promptText: `三传为${params.transmissions.map((item) => `${item.stage}${item.branch}乘${item.god}`).join('、')}；相邻推进${params.transitionFacts.map((item) => item.promptText).join('；')}`,
      sources: Array.from(
        new Set([
          ...params.transmissions.flatMap((item) => item.sources),
          ...params.transitionFacts.flatMap((item) => item.sources),
        ]),
      ),
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'liuren:calculation:counter-focus-timing',
      stage: '反证类神应期核验',
      status: params.timingFacts.length ? '已计算' : '资料不足',
      inputs: { transmissionCount: params.transmissions.length },
      result: {
        counterStatus: params.counterSummaryFact.status,
        counterEvidenceCount: params.counterEvidenceFacts.length,
        focusStatus: params.focusSummaryFact.status,
        focusFactCount: params.focusFacts.length,
        timingFactCount: params.timingFacts.length,
      },
      dependsOnStepKeys: ['liuren:calculation:transmissions'],
      promptText: `${params.counterSummaryFact.promptText}；${params.focusSummaryFact.promptText}；已记录${params.timingFacts.length}项应期触发与期限事实`,
      sources: Array.from(
        new Set([
          ...params.counterSummaryFact.sources,
          ...params.focusSummaryFact.sources,
          ...params.timingFacts.flatMap((item) => item.sources),
        ]),
      ),
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'liuren:calculation:summary',
      stage: '证据汇总',
      status: params.summaryFact.status === '证据链完整' ? '已计算' : '资料不足',
      inputs: { factCount: params.summaryFact.factKeys.length },
      result: {
        summaryStatus: params.summaryFact.status,
        platePositionFactCount: params.summaryFact.platePositionFactCount,
        lessonFactCount: params.summaryFact.lessonFactCount,
        transmissionFactCount: params.summaryFact.transmissionFactCount,
        counterEvidenceCount: params.summaryFact.counterEvidenceCount,
        timingFactCount: params.summaryFact.timingFactCount,
      },
      dependsOnStepKeys: [
        'liuren:calculation:chart-input',
        'liuren:calculation:plate',
        'liuren:calculation:lessons',
        'liuren:calculation:transmission-rule',
        'liuren:calculation:transmissions',
        'liuren:calculation:counter-focus-timing',
      ],
      promptText: params.summaryFact.promptText,
      sources: params.summaryFact.sources,
      limitation: CALCULATION_STEP_LIMITATION,
    },
  ];
}

function buildLimitationFacts(params: {
  calculationFact: LiurenCalculationFact;
  foundationConventionFact: LiurenFoundationConventionFact;
  transmissionConventionFact: LiurenTransmissionConventionFact;
  plateFact: LiurenPlateCoverageFact;
  platePositionFacts: LiurenPlateFact[];
  lessons: LiurenLessonEvidence[];
  transmissionRuleFact: LiurenTransmissionRuleFact;
  transmissions: LiurenTransmissionEvidence[];
  transitionFacts: LiurenTransitionFact[];
  counterSummaryFact: LiurenCounterSummaryFact;
  counterEvidenceFacts: LiurenCounterEvidenceFact[];
  timingFacts: LiurenTimingFact[];
  focusSummaryFact: LiurenFocusSummaryFact;
  focusFacts: LiurenFocusFact[];
  traditionalFacts: LiurenTraditionalFact[];
  summaryFact: LiurenSummaryFact;
}): LiurenLimitationFact[] {
  const definitions: Array<
    Pick<LiurenLimitationFact, 'key' | 'type' | 'ownerFactKeys' | 'promptText' | 'sources'>
  > = [
    {
      key: 'liuren:limitation:chart-plate',
      type: '起盘天地盘边界',
      ownerFactKeys: [
        params.calculationFact.key,
        params.foundationConventionFact.key,
        params.plateFact.key,
        ...params.platePositionFacts.map((item) => item.key),
      ],
      promptText:
        '当前月将、昼夜贵人、天将顺逆与十干寄宫采用已登记的主版本，异说不得与主版本拼接；若改用其他贵人表或换将口径，须从贵人定位、十二天将、四课到三传整体重排。占时四柱、旬空和天地盘逐位资料只证明起盘计算与排布结果，不得由单一位置、天将或方位直接推出人物、事件与现实吉凶',
      sources: ['起盘口径版本事实、起盘参数、天地盘覆盖与十二位逐项事实'],
    },
    {
      key: 'liuren:limitation:lessons-rule',
      type: '四课取传边界',
      ownerFactKeys: [
        ...params.lessons.flatMap((item) => [
          item.key,
          ...item.relationFacts.map((fact) => fact.key),
        ]),
        params.transmissionRuleFact.key,
        params.transmissionConventionFact.key,
      ],
      promptText:
        '四课与九宗门采用已登记的递取、贼克比用、涉害古法及特殊取法主版本；直接取孟仲、择比与返吟名称异说不得拼接，换版本须从初传到中末传整体重排。四课记录上下神、乘将、生克、旬空和初传来源，取传规则只说明如何发用，不单独证明现实成败',
      sources: ['四课取传口径版本事实、四课关系事实、初传来源与九宗门取传结果'],
    },
    {
      key: 'liuren:limitation:transmissions',
      type: '三传推进边界',
      ownerFactKeys: [
        ...params.transmissions.flatMap((item) => [
          item.key,
          ...item.relationFacts.map((fact) => fact.key),
        ]),
        ...params.transitionFacts.map((item) => item.key),
      ],
      promptText:
        '初传、中传、末传的六亲均以日干为中心逐传计算，日干、日支及相邻传的五行关系须保留作用方向，固定地支关系另列；这些关系只描述盘内发用、过程与落点结构，不得直接写成现实事件必然推进、停滞、成功或失败',
      sources: ['三传阶段、逐传关系与相邻推进事实'],
    },
    {
      key: 'liuren:limitation:counter-focus-timing',
      type: '反证类神应期边界',
      ownerFactKeys: [
        params.counterSummaryFact.key,
        ...params.counterEvidenceFacts.map((item) => item.key),
        params.focusSummaryFact.key,
        ...params.focusFacts.map((item) => item.key),
        ...params.timingFacts.map((item) => item.key),
      ],
      promptText:
        '月令休囚死、空亡、生克、冲合刑害破只保留可复算位置与作用方向，不得脱离已指定类神自动列为现实支持或反证。未同时明确具体类神底本版本、事项类别与参与者角色、完整类神取用规则、已指定类神对象和目标期限时，应期只登记阶段、旺衰及出空、填实、冲实等候选触发，不判断确定快慢、唯一日期、事件概率、现实结果或行动建议',
      sources: ['课传反证、盘面位置焦点覆盖、类神资料缺口与应期触发事实'],
    },
    {
      key: 'liuren:limitation:tradition',
      type: '传统规则类象边界',
      ownerFactKeys: params.traditionalFacts.map((item) => item.key),
      promptText:
        '经典取传规则、课体、天将属性和神煞属于传统规则与类象资料，只能辅助限定解释方向；不得直接证明人物身份、疾病死亡、犯罪官非、婚姻、法律责任、财务或安全结果',
      sources: ['经典规则、课体、天将属性与神煞条件化事实'],
    },
    {
      key: 'liuren:limitation:high-risk',
      type: '高风险输出边界',
      ownerFactKeys: [params.summaryFact.key],
      promptText:
        '不得按课传关系、支持、反证、旺衰、天将、神煞或传统标签生成吉凶总分与成功率；不得输出医疗、法律、财务、安全保证、人物定性、必然事件或唯一日期',
      sources: ['大六壬证据汇总与高风险解释约束'],
    },
  ];
  return definitions.map((item) => ({
    ...item,
    status: '适用',
    limitation: LIMITATION_FACT_LIMITATION,
  }));
}

/**
 * 大六壬的完整课盘可由时间戳唯一重放。
 * 证据层只保留重放结果，旧缓存或外部输入中的月将、天地盘、四课、三传、
 * 课体、神煞、天将属性与说明字段均不得旁路进入提示词。
 */
export function rebuildAuditedLiurenData(input: LiurenData): LiurenData {
  if (!input || typeof input !== 'object') {
    throw new Error('大六壬证据重建缺少课盘数据。');
  }
  if (typeof input.timestamp !== 'number' || !Number.isFinite(input.timestamp)) {
    throw new Error('大六壬证据重建需要有效的毫秒时间戳。');
  }
  const sourceDate = new Date(input.timestamp);
  if (Number.isNaN(sourceDate.getTime())) {
    throw new Error('大六壬证据重建的时间戳无法转换为有效日期。');
  }
  if (!input.ganzhi || typeof input.ganzhi !== 'object') {
    throw new Error('大六壬证据重建缺少完整四柱干支。');
  }
  const { ganzhi, timeInfo, timestamp } = getDivinationTime(sourceDate);
  const pillarLabels = {
    year: '年柱',
    month: '月柱',
    day: '日柱',
    hour: '时柱',
  } as const;
  for (const key of ['year', 'month', 'day', 'hour'] as const) {
    if (!isValidGanZhi(input.ganzhi[key])) {
      throw new Error(
        `大六壬证据重建的${pillarLabels[key]}必须是有效六十甲子，当前为“${String(input.ganzhi[key])}”。`,
      );
    }
    if (input.ganzhi[key] !== ganzhi[key]) {
      throw new Error(
        `大六壬${pillarLabels[key]}“${input.ganzhi[key]}”与时间戳重算结果“${ganzhi[key]}”不一致。`,
      );
    }
  }

  const dayStem = ganzhi.day.charAt(0);
  const dayBranch = ganzhi.day.charAt(1);
  const hourStem = ganzhi.hour.charAt(0);
  const hourBranch = ganzhi.hour.charAt(1);
  const dayNight: '昼占' | '夜占' = LIUREN_DAYTIME_BRANCHES.has(hourBranch) ? '昼占' : '夜占';
  const monthLeader = getMonthGeneralByZhongqi(timeInfo.solar).monthGeneral;
  const noblemanBranch = getNoblemanBranch(dayStem, dayNight);
  const xunKong = getVoidBranches(ganzhi.day);
  if (xunKong.length !== 2 || new Set(xunKong).size !== 2) {
    throw new Error(`大六壬日柱“${ganzhi.day}”未取得两个唯一旬空地支。`);
  }
  const heavenlyPlate = buildHeavenlyPlate({
    monthLeader,
    divinationBranch: hourBranch,
    noblemanBranch,
    dayNight,
  });
  const noblemanGroundBranch = getUnderByUpper(heavenlyPlate, noblemanBranch);
  const dayStemResidence = getDayStemResidence(dayStem);
  const fourLessons = buildFourLessons({
    heavenlyPlate,
    dayStem,
    dayBranch,
    dayStemResidence,
    xunKong,
  });
  const initialResult = resolveInitialTransmission(fourLessons, {
    dayStem,
    dayBranch,
    dayStemResidence,
    hourStem,
    hourBranch,
    heavenlyPlate,
  });
  const initialBranch = initialResult.initial;
  let middleBranch: string;
  let finalBranch: string;
  if (initialResult.branches) {
    if (
      initialResult.branches.length !== 3 ||
      initialResult.branches[0] !== initialResult.initial
    ) {
      throw new Error(`${initialResult.rule}返回的三传结构不完整或与初传不一致。`);
    }
    [, middleBranch, finalBranch] = initialResult.branches;
  } else {
    middleBranch = getUpperByUnder(heavenlyPlate, initialBranch);
    finalBranch = getUpperByUnder(heavenlyPlate, middleBranch);
  }
  const transmissionBranches = [initialBranch, middleBranch, finalBranch];
  const transmissionStages: LiurenTransmission['stage'][] = ['初传', '中传', '末传'];
  const threeTransmissions = transmissionBranches.map((branch, index) => {
    const plateItem = getPlateItemByBranch(heavenlyPlate, branch);
    const previousBranch = index > 0 ? transmissionBranches[index - 1] : undefined;
    const wuxing = getBranchWuxing(branch);
    const transmission: LiurenTransmission = {
      stage: transmissionStages[index],
      branch,
      god: plateItem.god,
      kinship: getLiurenKinship(dayStem, branch),
      dayStemRelation: describeTransmissionDayStemRelation(
        transmissionStages[index],
        branch,
        dayStem,
      ),
      previousRelation: previousBranch
        ? describeTransmissionTransition(
            transmissionStages[index - 1],
            previousBranch,
            transmissionStages[index],
            branch,
          )
        : undefined,
      previousBranchRelations: previousBranch
        ? getLiurenBranchPairRelations(previousBranch, branch)
        : [],
      relation: describeTransmissionDayStemRelation(transmissionStages[index], branch, dayStem),
      note: '',
      wuxing,
      seasonState: getSeasonState(wuxing, ganzhi.month.charAt(1)),
      isVoid: xunKong.includes(branch),
      dayRelation: describeTransmissionDayBranchRelation(
        transmissionStages[index],
        branch,
        dayBranch,
      ),
      dayBranchRelations: getLiurenBranchPairRelations(branch, dayBranch),
    };
    transmission.note = buildTransmissionNote(transmission);
    return transmission;
  });
  const transmissionPattern = getTransmissionPattern(
    initialBranch,
    middleBranch,
    finalBranch,
    initialResult.rule,
  );
  const classicalRules = resolveLiurenClassicalRules(initialResult.rule);
  const transmissionDetail = buildTransmissionDetail(
    initialResult.rule,
    transmissionPattern,
    threeTransmissions,
    classicalRules,
  );
  const initialGroundBranch = getPlateItemByBranch(heavenlyPlate, initialBranch).under;
  const guaTiFacts = getLiurenGuaTiFacts({
    transmissionBranches,
    initialGroundBranch,
    yearBranch: ganzhi.year.charAt(1),
    monthBranch: ganzhi.month.charAt(1),
    monthLeader,
    noblemanBranch,
    noblemanGroundBranch,
    fourLessons,
  });
  const guaTi = guaTiFacts.map((fact) => fact.name);
  const patternTags = [
    `${threeTransmissions[0].god}发用`,
    initialResult.tag,
    threeTransmissions.some((item) => item.isVoid) ? '空亡入传' : '传不逢空',
    getPatternTag(transmissionPattern),
    ...guaTi,
  ];
  const shenShaFacts = buildShenShaFacts(
    ganzhi.year.charAt(0),
    ganzhi.year.charAt(1),
    ganzhi.month.charAt(1),
    dayBranch,
    dayStem,
  );
  const shenShaSummary = shenShaFacts.map((item) => `${item.name}在${item.target}`);
  const tianJiangProps = threeTransmissions.reduce<NonNullable<LiurenData['tianJiangProps']>>(
    (result, transmission) => {
      const attributes = TIANJIANG_ATTRIBUTES[transmission.god as TianJiangName];
      if (attributes) {
        result[transmission.god] = { ...attributes };
      }
      return result;
    },
    {},
  );
  const firstTransmission = threeTransmissions[0];
  const focusEvidence: NonNullable<LiurenData['focusEvidence']> = [
    {
      target: `初传${firstTransmission.branch}乘${firstTransmission.god}`,
      role: '发用主轴',
      level: '主证',
      evidence: [
        `${initialResult.rule}取为初传`,
        `月令${firstTransmission.seasonState}`,
        `六亲${firstTransmission.kinship}`,
        firstTransmission.dayRelation!,
      ],
      limitations: firstTransmission.isVoid
        ? ['初传落旬空；这里只记录位置条件，不等于已选类神，也不生成现实吉凶或应期']
        : ['初传不空只表示位置事实，不等于已选类神或现实事件已经发动'],
    },
    {
      target: `日干${dayStem}寄${dayStemResidence}`,
      role: '日干寄宫位置索引',
      level: '辅证',
      evidence: ['日干寄宫位置', `一课${fourLessons[0].upper}临${fourLessons[0].lower}`],
      limitations: ['不自动解释为我方、求测者或具体事项类神'],
    },
    {
      target: `日支${dayBranch}`,
      role: '日支位置索引',
      level: '辅证',
      evidence: [`三课${fourLessons[2].upper}临${fourLessons[2].lower}`, '需与发用和三传同看'],
      limitations: ['不自动解释为所占之事、对方、环境或具体事项类神'],
    },
  ];
  const timingEvidence = [
    `一级发用：初传${firstTransmission.branch}${firstTransmission.isVoid ? '落旬空' : '不空'}；空亡有宜有忌，须结合类神与事项判断，出空、填实、冲实仅作候选触发`,
    `二级三传：${threeTransmissions.map((item) => `${item.stage}${item.branch}（月令${item.seasonState}${item.isVoid ? '、空' : ''}）`).join('→')}`,
    `三级日月：以日支${dayBranch}、月支${ganzhi.month.charAt(1)}对初传和类神的同支、冲合与旺衰作为触发条件`,
    '未同时明确具体类神底本版本、事项类别与参与者角色、完整类神取用规则、已指定类神对象和目标期限时，只登记三传阶段、旺衰及候选触发，不判断确定快慢，也不换算唯一日期',
  ];

  return {
    ganzhi,
    timestamp,
    dayNight,
    monthLeader,
    divinationBranch: hourBranch,
    noblemanBranch,
    noblemanGroundBranch,
    xunKong,
    transmissionRule: initialResult.rule,
    transmissionPattern,
    transmissionDetail,
    earthlyPlate: [...DIZHI],
    dayStemResidence,
    heavenlyPlate,
    fourLessons,
    threeTransmissions,
    patternTags,
    classicalRules,
    lessonSummary: `四课源于日干寄宫${dayStemResidence}与日支${dayBranch}，关系呈${fourLessons.map((item) => item.relation).join('、')}，重点先看${initialResult.tag}落点。 当前节气为${timeInfo.jieQi}。`,
    transmissionSummary: `三传${transmissionPattern}，主线依次为${threeTransmissions.map((item) => `${item.stage}${item.branch}`).join(' → ')}。`,
    guaTi,
    guaTiFacts,
    shenShaSummary,
    shenShaFacts,
    tianJiangProps,
    focusEvidence,
    timingEvidence,
  };
}

export function analyzeLiurenEvidence(input: LiurenData): LiurenEvidenceAnalysis {
  const data = rebuildAuditedLiurenData(input);
  const initial = data.threeTransmissions[0];
  const xunKong = data.xunKong;
  const calculationFact = buildCalculationFact(data, xunKong);
  const foundationConventionFact = buildFoundationConventionFact();
  const transmissionConventionFact = buildTransmissionConventionFact();
  const calculationFacts = [
    `起盘口径：${foundationConventionFact.promptText}`,
    `四课取传口径：${transmissionConventionFact.promptText}`,
    `四柱干支：年${calculationFact.ganzhi.year}、月${calculationFact.ganzhi.month}、日${calculationFact.ganzhi.day}、时${calculationFact.ganzhi.hour}`,
    `月将加时：月将${calculationFact.monthLeader}加占时${calculationFact.divinationBranch}`,
    `贵人定位：${calculationFact.dayNight}，日干贵人${calculationFact.noblemanBranch}临地盘${calculationFact.noblemanGroundBranch}`,
    `日干寄宫：${calculationFact.dayStem}寄${calculationFact.dayStemResidence}`,
    `日柱旬空：${calculationFact.xunKong.join('、')}`,
  ];
  const platePositionFacts = buildPlatePositionFacts(data);
  const plateFact = buildPlateCoverageFact(platePositionFacts);
  const plateFacts = platePositionFacts.map(
    (item) => `地盘${item.earthBranch}上见天盘${item.heavenBranch}乘${item.god}`,
  );
  const patternEvidence = Array.from(new Set([...data.patternTags, ...data.guaTi].filter(Boolean)));
  const shenShaEvidence = Array.from(
    new Set(data.shenShaFacts.map((item) => `${item.name}在${item.target}`).filter(Boolean)),
  );
  const traditionalFacts = buildTraditionalFacts(data, patternEvidence);
  const dayStem = data.ganzhi.day.charAt(0);
  const dayBranch = data.ganzhi.day.charAt(1);
  const lessons = data.fourLessons.map((lesson, index) =>
    buildLessonEvidence(lesson, index, initial.branch, xunKong, dayStem),
  );
  const initialSourceLessons = lessons
    .filter((item) => item.isInitialSource)
    .map((item) => item.name);
  const transmissions = data.threeTransmissions.map((item, index) =>
    buildTransmissionEvidence(
      item,
      index,
      xunKong,
      dayStem,
      dayBranch,
      data.threeTransmissions[index - 1],
    ),
  );
  const transitionFacts = buildTransitionFacts(transmissions);
  const transitions = transitionFacts.map((item) => item.promptText);
  const counterEvidence = Array.from(
    new Set([
      ...lessons.flatMap((item) => item.constraints),
      ...transmissions.flatMap((item) => item.constraints),
    ]),
  );
  const counterEvidenceFacts: LiurenCounterEvidenceFact[] = [
    ...lessons.flatMap((item) =>
      item.relationFacts
        .filter((fact) => fact.status === '限制')
        .map((fact) => ({
          key: `liuren:counter:${fact.key}`,
          ownerKey: item.key,
          scope: '四课' as const,
          basis: fact.basis,
          detail: fact.value,
          status: '已触发' as const,
          promptText: fact.promptText,
          sources: [...fact.sources],
          limitation: COUNTER_FACT_LIMITATION,
        })),
    ),
    ...transmissions.flatMap((item) =>
      item.relationFacts
        .filter((fact) => fact.status === '限制')
        .map((fact) => ({
          key: `liuren:counter:${fact.key}`,
          ownerKey: item.key,
          scope: '三传' as const,
          basis: fact.basis,
          detail: fact.value,
          status: '已触发' as const,
          promptText: fact.promptText,
          sources: [...fact.sources],
          limitation: COUNTER_FACT_LIMITATION,
        })),
    ),
  ];
  const counterSummaryFact: LiurenCounterSummaryFact = {
    key: 'liuren:counter-summary',
    status: counterEvidenceFacts.length ? '有明确反证' : '未见明确反证',
    factKeys: counterEvidenceFacts.map((item) => item.key),
    promptText: counterEvidenceFacts.length
      ? `共核验到${counterEvidenceFacts.length}项盘内限制，须与主证并列使用`
      : '当前结构化核验未见按既定口径成立的月令休囚死限制；旬空、生克及固定地支关系均保留为中性条件，不代表现实风险为零',
    sources: ['四课与三传关系事实逐项筛选'],
    limitation: COUNTER_SUMMARY_LIMITATION,
  };
  const focusEvidence = data.focusEvidence;
  const focusFacts = buildFocusFacts(data, transmissions);
  const focusSummaryFact: LiurenFocusSummaryFact = {
    key: 'liuren:focus-summary',
    status: focusFacts.length ? '已提供位置焦点' : '缺少位置焦点',
    factKeys: focusFacts.map((item) => item.key),
    promptText: focusFacts.length
      ? `当前结果保存${focusFacts.length}个盘面位置焦点，只作初传、日干和日支等结构索引，不等于已按具体事项选定类神`
      : '当前结果未保存盘面位置焦点，也不得自行把问题文字、日支、天将或神煞固定当作类神',
    sources: ['当前大六壬结果的盘面位置焦点完整性检查'],
    limitation: FOCUS_SUMMARY_LIMITATION,
  };
  const { timingFacts, normalizedInput: timingEvidence } = buildTimingFacts(data, transmissions);
  const timingConditions = [
    `初传${initial.branch}${transmissions[0].isVoid ? '落旬空' : '不空'}；空亡有宜有忌，须结合类神与事项判断，出空、填实、冲实只作候选触发`,
    `三传顺序${transmissions.map((item) => `${item.stage}${item.branch}`).join(' → ')}只表示阶段推进`,
    `月支${data.ganzhi.month.slice(-1)}与日支${data.ganzhi.day.slice(-1)}用于核验旺衰、同支、冲合及空亡触发`,
    '四项类神资料和期限未全部明确时不判断确定快慢、不换算唯一日期，也不以问题文字、神煞或课体单项指定应期',
    ...timingEvidence,
  ];
  const classicalRuleKeys = traditionalFacts
    .filter((item) => item.kind === '经典取传规则')
    .map((item) => item.key);
  const transmissionRuleFact: LiurenTransmissionRuleFact = {
    key: 'liuren:transmission-rule',
    status: '已确定',
    rule: data.transmissionRule,
    pattern: data.transmissionPattern,
    initialBranch: initial.branch,
    initialGod: initial.god,
    initialSourceLessonKeys: lessons.filter((item) => item.isInitialSource).map((item) => item.key),
    detail: data.transmissionDetail.trim(),
    classicalRuleKeys,
    promptText: `按${data.transmissionRule}取初传${initial.branch}乘${initial.god}，三传模式${data.transmissionPattern}${initialSourceLessons.length ? `，初传上神见于${initialSourceLessons.join('、')}` : '，特殊取传未直接对应单一课上神'}`,
    sources: [
      '当前结果保存的四课、初传与三传结构',
      '已确定的九宗门取传结果',
      ...traditionalFacts
        .filter((item) => item.kind === '经典取传规则')
        .flatMap((item) => item.sources),
    ],
    limitation: RULE_FACT_LIMITATION,
  };
  const summaryFact = buildSummaryFact({
    calculationFact,
    foundationConventionFact,
    transmissionConventionFact,
    plateFact,
    platePositionFacts,
    transmissionRuleFact,
    lessons,
    transmissions,
    transitionFacts,
    counterSummaryFact,
    counterEvidenceFacts,
    timingFacts,
    focusSummaryFact,
    focusFacts,
    traditionalFacts,
  });
  const calculationSteps = buildCalculationSteps({
    calculationFact,
    foundationConventionFact,
    transmissionConventionFact,
    plateFact,
    platePositionFacts,
    lessons,
    transmissionRuleFact,
    transmissions,
    transitionFacts,
    counterEvidenceFacts,
    counterSummaryFact,
    focusFacts,
    focusSummaryFact,
    timingFacts,
    summaryFact,
  });
  summaryFact.factKeys = Array.from(
    new Set([...calculationSteps.map((item) => item.key), ...summaryFact.factKeys]),
  );
  const calculationChain = calculationSteps.map((item) => item.promptText);
  const limitationFacts = buildLimitationFacts({
    calculationFact,
    foundationConventionFact,
    transmissionConventionFact,
    plateFact,
    platePositionFacts,
    lessons,
    transmissionRuleFact,
    transmissions,
    transitionFacts,
    counterSummaryFact,
    counterEvidenceFacts,
    timingFacts,
    focusSummaryFact,
    focusFacts,
    traditionalFacts,
    summaryFact,
  });
  const limitations = limitationFacts.map((item) => item.promptText);

  const classicalText = data.classicalRules.length
    ? traditionalFacts
        .filter((item) => item.kind === '经典取传规则')
        .map((item) => `${item.sources.join('、')}《${item.name}》：${item.promptText}`)
        .join('；')
    : '未附经典规则说明';
  const items: PromptEvidenceItem[] = [
    {
      level: calculationSteps.some((item) => item.status === '资料不足') ? '反证' : '辅证',
      title: '大六壬计算链',
      detail: `${calculationChain.join('；')}；统一边界：${CALCULATION_STEP_LIMITATION}`,
      source: Array.from(new Set(calculationSteps.flatMap((item) => item.sources))).join('、'),
      tags: ['计算链', summaryFact.status],
    },
    {
      level: '辅证',
      title: '大六壬起盘口径与版本边界',
      detail: `${foundationConventionFact.promptText}；主版本：${foundationConventionFact.adoptedVersion}；异说：${foundationConventionFact.alternativeVersionFields.join('；')}；底本文字差异：${foundationConventionFact.textualVariantFields.join('；')}；边界：${foundationConventionFact.limitation}`,
      source: foundationConventionFact.sources.join('、'),
      tags: ['起盘口径', '月将', '昼夜贵人', '天将顺逆', '十干寄宫', '版本边界'],
    },
    {
      level: '辅证',
      title: '大六壬四课与取传口径版本边界',
      detail: `${transmissionConventionFact.promptText}；主版本：${transmissionConventionFact.adoptedVersion}；异说：${transmissionConventionFact.alternativeVersionFields.join('；')}；边界：${transmissionConventionFact.limitation}`,
      source: transmissionConventionFact.sources.join('、'),
      tags: ['四课', '九宗门', '涉害', '八专', '伏吟', '返吟', '版本边界'],
    },
    {
      level: '辅证',
      title: '月将加时与贵人起盘事实',
      detail: `${calculationFact.promptText}；边界：${calculationFact.limitation}`,
      source: calculationFact.sources.join('、'),
      tags: ['月将', '占时', '贵人', '日干寄宫', '旬空'],
    },
    {
      level: plateFact.status === '完整' ? '辅证' : '反证',
      title: plateFact.status === '完整' ? '天地盘十二支与天将定位' : '天地盘定位资料缺失',
      detail: `${plateFact.promptText}${platePositionFacts.length ? `；已保存位置：${platePositionFacts.map((item) => item.promptText).join('；')}` : ''}；逐位边界：${PLATE_FACT_LIMITATION}；覆盖边界：${plateFact.limitation}`,
      source: Array.from(
        new Set([...plateFact.sources, ...platePositionFacts.flatMap((item) => item.sources)]),
      ).join('、'),
      tags: ['天地盘', '十二天将', plateFact.status],
    },
    {
      level: '主证',
      title: '四课取传与初传发用',
      detail: `四课${lessons.map((item) => `${item.name}${item.upper}临${item.lower}（${item.relation}）`).join('；')}；${transmissionRuleFact.promptText}；规则边界：${transmissionRuleFact.limitation}；古籍依据：${classicalText}`,
      source: transmissionRuleFact.sources.join('、'),
      tags: ['四课', transmissionRuleFact.rule],
    },
    ...lessons.map((item): PromptEvidenceItem => ({
      level: item.isInitialSource ? '主证' : '辅证',
      title: `${item.name}上下神关系`,
      detail: `${item.promptText}；逐项关系${item.relationFacts.map((fact) => `${fact.promptText}（${fact.status}）`).join('；')}；事实边界：${item.limitation}`,
      source: item.sources.join('、'),
      tags: ['四课', item.name, ...(item.isInitialSource ? ['初传来源'] : [])],
    })),
    ...transmissions.map((item, index): PromptEvidenceItem => ({
      level: index === 0 ? '主证' : '辅证',
      title: `${item.stage}${item.label}`,
      detail: `${item.promptText}；逐项关系${item.relationFacts.map((fact) => `${fact.promptText}（${fact.status}）`).join('；')}；事实边界：${item.limitation}`,
      source: item.sources.join('、'),
      tags: [item.stage, item.branch],
    })),
    ...transitionFacts.map((fact, index): PromptEvidenceItem => ({
      level: '辅证',
      title: `${index === 0 ? '初传至中传' : '中传至末传'}推进关系`,
      detail: `${fact.promptText}；关系状态${fact.status}；边界：${fact.limitation}`,
      source: fact.sources.join('、'),
      tags: ['三传推进', index === 0 ? '过程' : '落点', fact.status],
    })),
    {
      level: '辅证' as const,
      title: '取传规则与三传模式说明',
      detail: conditionLiurenTraditionalText(data.transmissionDetail),
      source: '九宗门取传结果、三传结构与经典规则合并说明',
      tags: ['取传规则', data.transmissionRule, data.transmissionPattern],
    },
    ...(patternEvidence.length
      ? [
          {
            level: '辅证' as const,
            title: '课体与三传结构标签',
            detail: traditionalFacts
              .filter((item) => item.kind === '课体')
              .map((item) => `${item.promptText}；边界：${item.limitation}`)
              .join('；'),
            source: '发用、三传结构、空亡与经典课体规则逐项命中',
            tags: ['课体', '结构标签'],
          },
        ]
      : []),
    ...traditionalFacts
      .filter((item) => item.kind === '经典取传规则')
      .map((item): PromptEvidenceItem => ({
        level: '辅证',
        title: `经典规则：${item.name}`,
        detail: `${item.promptText}；边界：${item.limitation}`,
        source: `${item.sources.join('、')}；原始传统文义仅供资料核对，解读采用条件化表述`,
        tags: ['经典规则', item.name],
      })),
    ...(shenShaEvidence.length
      ? [
          {
            level: '辅证' as const,
            title: '神煞定位事实',
            detail: `${traditionalFacts
              .filter((item) => item.kind === '神煞')
              .map((item) => `${item.promptText}；边界：${item.limitation}`)
              .join('；')}。神煞仅作辅助定位，不覆盖四课取传与三传主线。`,
            source: '年干、年支、月建、日柱、日支与日干神煞规则逐项定位',
            tags: ['神煞', '辅助证据'],
          },
        ]
      : []),
    ...traditionalFacts
      .filter((item) => item.kind === '天将属性')
      .map((item): PromptEvidenceItem => ({
        level: '辅证',
        title: `${item.stages?.join('、') || ''}${item.name}天将属性`,
        detail: `${item.promptText}；入传位置${item.stages?.join('、') || '未列'}，地支${item.branches?.join('、') || '未列'}；边界：${item.limitation}`,
        source: `${item.sources.join('、')}；原始传统文义仅供资料核对，解读采用条件化表述`,
        tags: ['天将属性', ...(item.stages ?? []), item.name],
      })),
    ...focusFacts.map((item): PromptEvidenceItem => ({
      level: item.level,
      title: `${item.target}${item.role}`,
      detail: `${item.promptText}；边界：${item.limitation}`,
      source: item.sources.join('、'),
      tags: ['盘面位置焦点', item.target, item.role],
    })),
    ...(focusFacts.length
      ? []
      : [
          {
            level: '限制' as const,
            title: '盘面位置焦点资料缺失',
            detail: `${focusSummaryFact.promptText}；边界：${focusSummaryFact.limitation}`,
            source: focusSummaryFact.sources.join('、'),
            tags: ['盘面位置焦点', '缺少位置焦点'],
          },
        ]),
    ...(timingFacts.length
      ? [
          {
            level: '应期' as const,
            title: '应期触发证据',
            detail: timingFacts
              .map((fact) => `${fact.promptText}（${fact.sourceStatus}；边界：${fact.limitation}）`)
              .join('；'),
            source: Array.from(new Set(timingFacts.flatMap((fact) => fact.sources))).join('、'),
            tags: ['应期', '触发条件'],
          },
        ]
      : []),
    ...counterEvidenceFacts.map((fact, index): PromptEvidenceItem => ({
      level: '反证',
      title: `课传限制核验${index + 1}`,
      detail: `${fact.promptText}；边界：${fact.limitation}`,
      source: fact.sources.join('、'),
      tags: ['反证', '课传限制', fact.scope, fact.basis],
    })),
    {
      level: '辅证',
      title: `大六壬证据汇总：${summaryFact.status}`,
      detail: `${summaryFact.promptText}；边界：${summaryFact.limitation}`,
      source: summaryFact.sources.join('、'),
      tags: ['证据汇总', summaryFact.status],
    },
    {
      level: '限制',
      title: '大六壬课传解释边界',
      detail: `${limitations.join('；')}；统一边界：${LIMITATION_FACT_LIMITATION}`,
      source: Array.from(new Set(limitationFacts.flatMap((item) => item.sources))).join('、'),
    },
  ];
  const evidence: PromptEvidenceBundle = { title: '大六壬四课取传与三传推进结构化证据', items };
  const promptText = [
    '【大六壬四课取传与三传推进结构化证据】',
    ...formatPromptEvidenceBundle(evidence),
    `起盘口径与版本边界：${foundationConventionFact.promptText}；主版本：${foundationConventionFact.adoptedVersion}；异说不得混用，换用其他版本须整盘重排；边界：${foundationConventionFact.limitation}`,
    `四课与取传口径版本边界：${transmissionConventionFact.promptText}；主版本：${transmissionConventionFact.adoptedVersion}；异说不得混用，换用其他版本须从初传到中末传整体重排；边界：${transmissionConventionFact.limitation}`,
    `取传规则事实：${transmissionRuleFact.promptText}；边界：${transmissionRuleFact.limitation}`,
    `推进关系：${transitionFacts.map((item) => item.promptText).join('；')}`,
    `反证限制：${counterSummaryFact.promptText}${counterEvidenceFacts.length ? `；明细${counterEvidenceFacts.map((item) => item.promptText).join('；')}` : ''}；边界：${counterSummaryFact.limitation}`,
    `触发条件：${timingFacts.map((item) => `${item.promptText}（${item.sourceStatus}）`).join('；')}`,
    `盘面位置焦点状态：${focusSummaryFact.promptText}；边界：${focusSummaryFact.limitation}`,
    '应期边界：四项类神资料与目标期限未全部明确时不换算唯一日期，不以问题文字、神煞、课体或单项关系指定应期。',
    `计算链：${calculationChain.join(' → ')}`,
    `证据汇总：${summaryFact.promptText}。`,
    `解释限制：${limitations.join('；')}。`,
  ].join('\n');
  return {
    key: 'liuren:evidence',
    status: '已计算',
    calculationFact,
    foundationConventionFact,
    transmissionConventionFact,
    calculationFacts,
    calculationSteps,
    calculationChain,
    plateFact,
    platePositionFacts,
    plateFacts,
    patternEvidence,
    shenShaEvidence,
    rule: data.transmissionRule || '',
    initialBranch: initial.branch,
    initialSourceLessons,
    transmissionRuleFact,
    lessons,
    transmissions,
    transitionFacts,
    transitions,
    counterEvidenceFacts,
    counterSummaryFact,
    counterEvidence,
    timingFacts,
    timingConditions,
    focusFacts,
    focusSummaryFact,
    focusEvidence,
    timingEvidence,
    traditionalFacts,
    limitations,
    limitationFacts,
    summaryFact,
    evidence,
    promptText,
    methodology: [
      '先确认当前课盘采用十二中气实际交节换将、固定地支分昼夜、通行贵人表和贵人临地顺逆布将的主版本；《六壬寻源》先后天贵人等异说只登记边界，不与当前课盘混用，换版本须整盘重排。',
      '再按日干寄宫与日支递取四课，依贼克、比用、涉害古法及九宗门特殊取法确认初传；直接取孟仲、择比等异说不得拼接，换版本须从初传到中末传整体重排。',
      '初传、中传、末传分别作为起点、过程、落点，六亲均以日干为中心逐传计算；日干、日支和相邻传的五行关系保留作用方向，固定地支关系另列。',
      '旬空只登记是否命中；出空、填实、冲实仅作候选触发，四项类神资料和期限未全部明确时不判断确定快慢或唯一日期。',
      '月将加时、昼夜贵人、天地盘、日干寄宫、课体、神煞与天将属性均保留为结构化辅证。',
      '课体与神煞只作辅助标签，不覆盖发用和三传主线。',
      '具体类神底本版本、事项类别与参与者角色、完整类神取用规则和已指定类神对象缺少任一项时，不生成现实演变、吉凶总分、成功率、时机、行动建议或绝对日期。',
    ],
  };
}
