import type {
  LiurenData,
  LiurenGuaTiFact,
  LiurenLesson,
  LiurenOrdinaryTransmissionCandidate,
  LiurenOrdinaryTransmissionStage,
  LiurenTransmission,
} from '../types/divination';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';
import { stableStringify } from '../shared/result';
import { getBranchWuxing, getSeasonState, getStemWuxing, isKe, isSheng } from '../ganzhi';
import { getVoidBranches } from '../calendar/lunar';
import { getDivinationTime } from '../calendar/timeManager';
import {
  buildHeavenlyPlate,
  DAYTIME_BRANCHES,
  DIZHI,
  describeRelation,
  getDayStemResidence,
  getGanZhiWuxing,
  getNoblemanBranch,
  getPlateItemByBranch,
  getUpperByUnder,
  TIANJIANG,
  TIANJIANG_ATTRIBUTES,
  TIANGAN,
} from './algorithms/liuren/helpers/plate';
import { buildFourLessons, resolveInitialTransmission } from './algorithms/liuren/helpers/lessons';
import { buildShenShaFacts } from './algorithms/liuren/helpers/shensha';
import { getMonthLeaderByZhongqi } from './algorithms/liuren/helpers/month-leader';
import { resolveLiurenClassicalRules } from './algorithms/liuren/helpers/classical-rules';
import {
  buildLiurenFocusEvidence,
  buildLiurenTimingEvidence,
  buildTransmissionDetail,
  getLiurenGuaTiFacts,
  getPatternTag,
  getTransmissionPattern,
} from './algorithms/liuren/helpers/transmission';
import {
  formatLiurenOrdinaryStage,
  getLiurenOrdinaryCandidateStatusLabel,
} from './liuren-ordinary-adjudication';

export interface LiurenRelationEvidenceFact {
  key: string;
  scope: '四课' | '三传';
  ownerKey: string;
  basis: '上下神关系' | '旬空' | '月令旺衰' | '日支关系' | '相邻传关系';
  status: '支持' | '限制' | '中性';
  value: string;
  promptText: string;
  sources: string[];
  limitation: '课传关系事实只说明上下神、月令、旬空、日支或相邻传之间的盘内关系；支持或限制不得直接解释为现实吉凶、成功率或必然结果';
}

export interface LiurenLessonEvidence extends LiurenLesson {
  key: string;
  index: number;
  isInitialSource: boolean;
  constraints: string[];
  relationFacts: LiurenRelationEvidenceFact[];
  promptText: string;
  sources: string[];
  limitation: '四课事实只记录上下神、乘将、关系、课注及其是否参与初传来源；不单独证明现实事件、人物、吉凶或结果';
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
  limitation: '三传事实只记录初中末传的地支、天将、月令、旬空、日支关系与相邻推进；阶段顺序不证明现实事件必然按同样方式发生';
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
  status: '已确定' | '缺少规则名';
  rule: string | null;
  pattern: LiurenData['transmissionPattern'] | null;
  initialBranch: string;
  initialGod: string;
  initialSourceLessonKeys: string[];
  detail: string | null;
  classicalRuleKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '取传规则事实只说明当前四课如何形成初传及三传模式；缺少规则名时不得按结果反推九宗门名称，也不单独证明现实吉凶或应期';
}

export interface LiurenOrdinaryTransmissionCandidateFact extends LiurenOrdinaryTransmissionCandidate {
  sourceLessonKeys: string[];
  promptText: string;
}

export interface LiurenOrdinaryTransmissionStageFact extends LiurenOrdinaryTransmissionStage {
  promptText: string;
}

export interface LiurenOrdinaryTransmissionAdjudicationFact {
  key: 'liuren:ordinary-transmission-adjudication';
  status: '已裁决' | '转特殊课' | '缺少轨迹';
  selectedRule: string | null;
  selectedInitial: string | null;
  selectedCandidateKey: string | null;
  candidateFacts: LiurenOrdinaryTransmissionCandidateFact[];
  stageFacts: LiurenOrdinaryTransmissionStageFact[];
  promptText: string;
  sources: string[];
  limitation: string;
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
  limitation: '反证事实只表示盘内存在空亡、休囚、冲克或其他限制条件；不得把单项反证直接写成现实失败、灾祸或必然结果';
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
  limitation: '应期事实只提供先后、快慢、空亡填实、冲合与旺衰等触发条件；未给期限时不得换算唯一日期，也不证明事件必然发生';
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
  limitation: '类神焦点事实只记录当前结果已选出的关注对象、角色、依据与限制；未选定具体问题类神时不得把日支、天将或神煞固定当作用神';
}

export interface LiurenFocusSummaryFact {
  key: 'liuren:focus-summary';
  status: '已提供焦点' | '缺少焦点';
  factKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '焦点覆盖状态只说明当前结果是否保存关注对象；缺少焦点时不得自行把日支、天将或神煞固定当作用神，仍须按具体问题选择类神';
}

export interface LiurenTraditionalFact {
  key: string;
  kind: '经典取传规则' | '课体' | '天将属性' | '天将乘神' | '神煞';
  name: string;
  originalText: string;
  promptText: string;
  sources: string[];
  stages?: string[];
  branches?: string[];
  riding?: {
    branch: string;
    element: string;
    dayStem: string;
    dayElement: string;
    relation: '乘神生日' | '乘神克日' | '日生乘神' | '日克乘神' | '乘神日干比和';
  };
  limitation: '传统规则或类象只用于限定解释方向，不证明现实事件、身份、疾病、死亡、犯罪、婚姻、法律责任或财务结果';
}

export interface LiurenCalculationFact {
  key: string;
  ganzhi: LiurenData['ganzhi'];
  monthLeader: string;
  divinationBranch: string;
  dayNight: LiurenData['dayNight'] | '未列';
  noblemanBranch?: string;
  noblemanGroundBranch?: string;
  dayStem: string;
  dayStemResidence?: string;
  xunKong: string[];
  promptText: string;
  sources: string[];
  limitation: '起盘参数只记录占时四柱、月将加时、昼夜贵人、日干寄宫与旬空的计算输入和结果，不单独证明现实事件、吉凶或应期';
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
  promptText: string;
  sources: string[];
  limitation: '大六壬证据汇总只统计起盘、天地盘、四课取传、三传推进、反证、类神、应期与传统资料的覆盖情况；不得按数量生成吉凶总分、成功率、人物身份、事件保证或唯一日期';
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
  ordinaryTransmissionAdjudicationFact: LiurenOrdinaryTransmissionAdjudicationFact;
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
const PLATE_FACT_LIMITATION =
  '天地盘逐位字段只证明月将加时与十二天将排布后的对应关系，不单独证明现实吉凶、人物身份、事件或方位结果' as const;
const PLATE_COVERAGE_LIMITATION =
  '天地盘覆盖状态只说明当前结果能否完整核验十二位对应；缺少逐位资料时不得反推或补造天盘支、地盘支与天将' as const;
const RELATION_FACT_LIMITATION =
  '课传关系事实只说明上下神、月令、旬空、日支或相邻传之间的盘内关系；支持或限制不得直接解释为现实吉凶、成功率或必然结果' as const;
const LESSON_FACT_LIMITATION =
  '四课事实只记录上下神、乘将、关系、课注及其是否参与初传来源；不单独证明现实事件、人物、吉凶或结果' as const;
const TRANSMISSION_FACT_LIMITATION =
  '三传事实只记录初中末传的地支、天将、月令、旬空、日支关系与相邻推进；阶段顺序不证明现实事件必然按同样方式发生' as const;
const TRANSITION_FACT_LIMITATION =
  '相邻传推进事实只描述三传先后与地支关系，不证明现实事件必然推进、停滞、成功或失败' as const;
const RULE_FACT_LIMITATION =
  '取传规则事实只说明当前四课如何形成初传及三传模式；缺少规则名时不得按结果反推九宗门名称，也不单独证明现实吉凶或应期' as const;
const COUNTER_FACT_LIMITATION =
  '反证事实只表示盘内存在空亡、休囚、冲克或其他限制条件；不得把单项反证直接写成现实失败、灾祸或必然结果' as const;
const COUNTER_SUMMARY_LIMITATION =
  '反证汇总只说明当前结构化核验是否发现盘内限制，不代表现实风险为零，也不表示证据数量可换算为吉凶总分' as const;
const TIMING_FACT_LIMITATION =
  '应期事实只提供先后、快慢、空亡填实、冲合与旺衰等触发条件；未给期限时不得换算唯一日期，也不证明事件必然发生' as const;
const FOCUS_FACT_LIMITATION =
  '类神焦点事实只记录当前结果已选出的关注对象、角色、依据与限制；未选定具体问题类神时不得把日支、天将或神煞固定当作用神' as const;
const FOCUS_SUMMARY_LIMITATION =
  '焦点覆盖状态只说明当前结果是否保存关注对象；缺少焦点时不得自行把日支、天将或神煞固定当作用神，仍须按具体问题选择类神' as const;
const CALCULATION_STEP_LIMITATION =
  '计算步骤只证明占时参数、天地盘、四课、取传、三传、反证、类神与应期条件如何形成当前证据；不证明现实吉凶、事件概率、人物身份或固定应期' as const;
const SUMMARY_FACT_LIMITATION =
  '大六壬证据汇总只统计起盘、天地盘、四课取传、三传推进、反证、类神、应期与传统资料的覆盖情况；不得按数量生成吉凶总分、成功率、人物身份、事件保证或唯一日期' as const;
const LIMITATION_FACT_LIMITATION =
  '限制事实用于约束大六壬占时、天地盘、四课取传、三传、类神、课体、天将、神煞与应期资料能够支持的解释范围，不得被反向当作现实吉凶、人物身份、疾病灾祸、事件概率或固定应期的证据' as const;

export function getLiurenRidingRelation(dayStem: string, branch: string) {
  const dayElement = getStemWuxing(dayStem);
  const element = getBranchWuxing(branch);
  const relation: NonNullable<LiurenTraditionalFact['riding']>['relation'] =
    element === dayElement
      ? '乘神日干比和'
      : isSheng(element, dayElement)
        ? '乘神生日'
        : isKe(element, dayElement)
          ? '乘神克日'
          : isSheng(dayElement, element)
            ? '日生乘神'
            : '日克乘神';
  return { branch, element, dayStem, dayElement, relation };
}

function buildTraditionalFacts(
  data: LiurenData,
  patternEvidence: string[],
): LiurenTraditionalFact[] {
  const classicalFacts = (data.classicalRules ?? []).map((item, index): LiurenTraditionalFact => ({
    key: `classical:${index}:${item.rule}`,
    kind: '经典取传规则',
    name: item.rule,
    originalText: item.summary,
    promptText: item.summary,
    sources: [item.source],
    limitation: TRADITIONAL_FACT_LIMITATION,
  }));
  const registeredNames = new Set((data.guaTiFacts ?? []).map((fact) => fact.name));
  const registeredPatternFacts = (data.guaTiFacts ?? []).map((fact): LiurenTraditionalFact => ({
    key: fact.stableKey,
    kind: '课体',
    name: fact.name,
    originalText: fact.sourceQuote,
    promptText: `盘面命中“${fact.name}”：${fact.matchedConditions.join('；')}。`,
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
      promptText: `盘面命中“${name}”结构标签。`,
      sources: ['发用、三传结构、空亡与课体规则逐项命中'],
      limitation: TRADITIONAL_FACT_LIMITATION,
    }));
  const tianJiangFacts = Array.from(
    data.threeTransmissions
      .reduce((facts, transmission) => {
        const props = data.tianJiangProps?.[transmission.god];
        if (!props) return facts;
        const previous = facts.get(transmission.god);
        const originalText = props.description || `${props.category}类`;
        facts.set(transmission.god, {
          key: `tianjiang:${transmission.god}`,
          kind: '天将属性',
          name: transmission.god,
          originalText,
          promptText: `${props.wuxing}${props.yinYang}，传统分类为${props.category}；${originalText}`,
          sources: ['《六壬大全》卷二《天将总论》《十二将释》'],
          stages: [...(previous?.stages ?? []), transmission.stage],
          branches: [...(previous?.branches ?? []), transmission.branch],
          limitation: TRADITIONAL_FACT_LIMITATION,
        });
        return facts;
      }, new Map<string, LiurenTraditionalFact>())
      .values(),
  );
  const dayStem = data.ganzhi.day.charAt(0);
  const ridingFacts = data.threeTransmissions.map((transmission): LiurenTraditionalFact => {
    const isVoid = data.xunKong?.includes(transmission.branch);
    const riding = getLiurenRidingRelation(dayStem, transmission.branch);
    return {
      key: `riding:${transmission.stage}:${transmission.god}:${transmission.branch}`,
      kind: '天将乘神',
      name: `${transmission.god}乘${transmission.branch}`,
      originalText: '而用者专取天盘乘神决之',
      promptText: `${transmission.stage}${transmission.god}乘天盘${transmission.branch}${riding.element}，与日干${dayStem}${riding.dayElement}为${riding.relation}${transmission.seasonState ? `，月令${transmission.seasonState}` : ''}${typeof isVoid === 'boolean' ? `，${isVoid ? '旬空' : '不逢旬空'}` : ''}`,
      sources: [
        '《六壬大全》卷二·天将总论',
        'https://www.shidianguji.com/zh/book/SK1599/chapter/1k1lqkhebd2cy',
      ],
      stages: [transmission.stage],
      branches: [transmission.branch],
      riding,
      limitation: TRADITIONAL_FACT_LIMITATION,
    };
  });
  const shenShaFacts: LiurenTraditionalFact[] = data.shenShaFacts?.length
    ? data.shenShaFacts.map((fact, index): LiurenTraditionalFact => {
        const text = `${fact.name}在${fact.target}`;
        return {
          key: `shensha:${index}:${fact.name}:${fact.target}`,
          kind: '神煞',
          name: fact.name,
          originalText: text,
          promptText: `${fact.basis}${fact.input}，按“${fact.rule}”定位${fact.name}在${fact.target}`,
          sources: [...fact.sources],
          branches: fact.targetType === '地支' ? [fact.target] : undefined,
          limitation: TRADITIONAL_FACT_LIMITATION,
        };
      })
    : data.shenShaSummary?.length
      ? data.shenShaSummary.map((summary, index): LiurenTraditionalFact => {
          const match = /^(.+)在(.+)$/.exec(summary);
          const name = match?.[1] ?? `神煞${index + 1}`;
          const target = match?.[2] ?? '盘面';
          return {
            key: `shensha:legacy:${index}:${name}`,
            kind: '神煞',
            name,
            originalText: `${name}在${target}`,
            promptText: `${name}在${target}；未保存起法输入，不能据此复算`,
            sources: ['旧结果未保存逐项起法与来源'],
            branches: undefined,
            limitation: TRADITIONAL_FACT_LIMITATION,
          };
        })
      : [];

  return [
    ...classicalFacts,
    ...registeredPatternFacts,
    ...patternFacts,
    ...tianJiangFacts,
    ...ridingFacts,
    ...shenShaFacts,
  ];
}

function getGuaTiFactSignatures(facts: LiurenGuaTiFact[]) {
  return facts
    .map((fact) =>
      JSON.stringify({
        id: fact.id,
        stableKey: fact.stableKey,
        name: fact.name,
        category: fact.category,
        branches: fact.branches,
        matchedConditions: fact.matchedConditions,
        sourceTitle: fact.sourceTitle,
        sourceUrl: fact.sourceUrl,
        sourceQuote: fact.sourceQuote,
      }),
    )
    .sort();
}

function hasSameStrings(actual: string[], expected: string[]) {
  return (
    actual.length === expected.length && actual.every((item, index) => item === expected[index])
  );
}

function lessonConstraints(lesson: LiurenLesson, xunKong: string[]) {
  return [
    xunKong.includes(lesson.upper) ? `上神${lesson.upper}空亡` : '',
    xunKong.includes(lesson.lower) ? `下位${lesson.lower}空亡` : '',
    lesson.relation.includes('克') ? `${lesson.relation}形成牵制` : '',
  ].filter(Boolean);
}

function transmissionSupport(item: LiurenTransmission) {
  return [
    item.seasonState === '旺' || item.seasonState === '相' ? `月令${item.seasonState}` : '',
    item.dayRelation === '比和' || item.dayRelation?.includes('生')
      ? `与日支${item.dayRelation}`
      : '',
    item.relation === '比和' || item.relation.includes('生') ? item.relation : '',
  ].filter(Boolean);
}

function transmissionConstraints(item: LiurenTransmission) {
  return [
    item.isVoid ? `${item.stage}${item.branch}空亡` : '',
    item.seasonState === '休' || item.seasonState === '囚' || item.seasonState === '死'
      ? `月令${item.seasonState}`
      : '',
    item.dayRelation?.includes('克') || item.dayRelation?.includes('冲')
      ? `与日支${item.dayRelation}`
      : '',
    item.relation.includes('克') || item.relation.includes('冲') ? item.relation : '',
  ].filter(Boolean);
}

function classifyRelationStatus(value: string): LiurenRelationEvidenceFact['status'] {
  if (/克|冲|刑|害|破|空亡|休|囚|死/.test(value)) return '限制';
  if (/生|比和|合|旺|相|不空/.test(value)) return '支持';
  return '中性';
}

function buildLessonEvidence(
  lesson: LiurenLesson,
  index: number,
  isInitialSource: boolean,
  xunKong: string[],
): LiurenLessonEvidence {
  const key = `liuren:lesson:${index + 1}:${lesson.name}`;
  const relationFacts: LiurenRelationEvidenceFact[] = [
    {
      key: `${key}:relation`,
      scope: '四课',
      ownerKey: key,
      basis: '上下神关系',
      status: classifyRelationStatus(lesson.relation),
      value: lesson.relation,
      promptText: `${lesson.name}${lesson.upper}临${lesson.lower}，上下神关系${lesson.relation}`,
      sources: ['日干寄宫、日支与天地盘逐课推导', '五行生克与地支关系'],
      limitation: RELATION_FACT_LIMITATION,
    },
    ...(xunKong.includes(lesson.upper)
      ? [
          {
            key: `${key}:void:upper`,
            scope: '四课' as const,
            ownerKey: key,
            basis: '旬空' as const,
            status: '限制' as const,
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
            status: '限制' as const,
            value: `下位${lesson.lower}空亡`,
            promptText: `${lesson.name}下位${lesson.lower}落日柱旬空`,
            sources: ['日柱旬空与四课下位核验'],
            limitation: RELATION_FACT_LIMITATION,
          },
        ]
      : []),
  ];
  const constraints = lessonConstraints(lesson, xunKong);
  return {
    ...lesson,
    key,
    index: index + 1,
    isInitialSource,
    constraints,
    relationFacts,
    promptText: `${lesson.name}${lesson.upper}临${lesson.lower}，乘${lesson.god}，关系${lesson.relation}；${lesson.note || '课注未列'}`,
    sources: ['日干寄宫、日支与天地盘逐课推导', '日柱旬空与上下神关系核验'],
    limitation: LESSON_FACT_LIMITATION,
  };
}

function getInitialSourceLessonPositions(data: LiurenData): Set<number> {
  const adjudication = data.ordinaryTransmissionAdjudication;
  if (adjudication?.status === 'selected' && adjudication.selectedCandidateKey) {
    const selected = adjudication.candidates.find(
      (candidate) => candidate.key === adjudication.selectedCandidateKey,
    );
    return new Set(selected?.sourceLessons.map((lesson) => lesson.position) ?? []);
  }

  const rule = data.transmissionRule ?? '';
  if (rule === '伏吟法') {
    return new Set([['甲', '丙', '戊', '庚', '壬'].includes(data.ganzhi.day.charAt(0)) ? 1 : 3]);
  }
  if (rule.startsWith('伏吟') || rule.startsWith('返吟')) {
    const isLowerKeUpper = rule.includes('重审');
    const isUpperKeLower = rule.includes('元首');
    if (isLowerKeUpper || isUpperKeLower) {
      return new Set(
        data.fourLessons.flatMap((lesson, index) => {
          const matches = isLowerKeUpper
            ? isKe(getGanZhiWuxing(lesson.lower), getGanZhiWuxing(lesson.upper))
            : isKe(getGanZhiWuxing(lesson.upper), getGanZhiWuxing(lesson.lower));
          return lesson.upper === data.threeTransmissions[0].branch && matches ? [index + 1] : [];
        }),
      );
    }
  }
  return new Set();
}

function buildTransmissionEvidence(
  item: LiurenTransmission,
  index: number,
  xunKong: string[],
): LiurenTransmissionEvidence {
  const stageLabels = ['起点', '过程', '落点'] as const;
  const normalized = { ...item, isVoid: xunKong.includes(item.branch) };
  const key = `liuren:transmission:${item.stage}:${item.branch}`;
  const formattedTransmission = `${normalized.stage}${normalized.branch}乘${normalized.god}（${normalized.wuxing || '五行未列'}、月令${normalized.seasonState || '未定'}${normalized.isVoid ? '、空亡' : ''}）`;
  const relationFacts: LiurenRelationEvidenceFact[] = [
    {
      key: `${key}:adjacent-relation`,
      scope: '三传',
      ownerKey: key,
      basis: '相邻传关系',
      status: classifyRelationStatus(item.relation),
      value: item.relation,
      promptText: `${item.stage}${item.branch}与前位关系${item.relation}`,
      sources: ['三传先后次序与相邻地支关系'],
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
      key: `${key}:day-relation`,
      scope: '三传',
      ownerKey: key,
      basis: '日支关系',
      status: classifyRelationStatus(item.dayRelation ?? '未列'),
      value: item.dayRelation ?? '未列',
      promptText: `${item.stage}${item.branch}与日支关系${item.dayRelation ?? '未列'}`,
      sources: ['三传地支与日支生克冲合关系'],
      limitation: RELATION_FACT_LIMITATION,
    },
    {
      key: `${key}:void`,
      scope: '三传',
      ownerKey: key,
      basis: '旬空',
      status: normalized.isVoid ? '限制' : '支持',
      value: normalized.isVoid ? '空亡' : '不空',
      promptText: `${item.stage}${item.branch}${normalized.isVoid ? '落日柱旬空' : '不在日柱旬空内'}`,
      sources: ['日柱旬空与三传地支逐项核验'],
      limitation: RELATION_FACT_LIMITATION,
    },
  ];
  return {
    ...normalized,
    key,
    index: index + 1,
    label: stageLabels[index],
    support: transmissionSupport(normalized),
    constraints: transmissionConstraints(normalized),
    relationFacts,
    promptText: `${formattedTransmission}；与前位关系${item.relation}；与日支关系${item.dayRelation || '未列'}；${item.note || '传注未列'}`,
    sources: ['三传、天将、月令旺衰、旬空与日支关系核验'],
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
      relation: item.relation,
      status: classifyRelationStatus(item.relation),
      promptText: `${previous.stage}${previous.branch} → ${item.stage}${item.branch}：${item.relation}`,
      sources: ['三传先后次序与相邻地支关系'],
      limitation: TRANSITION_FACT_LIMITATION,
    };
  });
}

function buildTimingFacts(
  data: LiurenData,
  transmissions: LiurenTransmissionEvidence[],
): { timingFacts: LiurenTimingFact[]; normalizedInput: string[] } {
  const initial = transmissions[0];
  const transmissionSequence = transmissions
    .map(
      (item) =>
        `${item.stage}${item.branch}（月令${item.seasonState ?? '未定'}${item.isVoid ? '、空' : ''}）`,
    )
    .join('→');
  const normalizedInput = Array.from(new Set(data.timingEvidence ?? [])).filter((item) => {
    if (item.startsWith('一级发用：')) {
      return item.includes(`初传${initial.branch}${initial.isVoid ? '空亡' : '不空'}`);
    }
    if (item.startsWith('二级三传：')) {
      return item === `二级三传：${transmissionSequence}`;
    }
    if (!item.includes(`初传${initial.branch}`)) return true;
    return initial.isVoid ? !item.includes('不空') : !item.includes('空亡');
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
      computed: initial.isVoid
        ? `一级发用：初传${initial.branch}空亡，以出空、填实、冲实或条件落实为应期触发`
        : `一级发用：先看初传${initial.branch}不空，按月令旺衰、日支关系和事项类神核对发端条件`,
      sources: ['初传地支与日柱旬空核验'],
    },
    {
      type: '三传顺序',
      matcher: (text) => text.startsWith('二级三传：'),
      computed: `二级三传：${transmissionSequence}`,
      sources: ['初中末传顺序、月令旺衰与旬空状态'],
    },
    {
      type: '月日触发',
      matcher: (text) => text.startsWith('三级日月：'),
      computed: `三级日月：以日支${data.ganzhi.day.slice(-1)}、月支${data.ganzhi.month.slice(-1)}对初传和类神的同支、冲合与旺衰作为触发条件`,
      sources: ['月支、日支与初传及类神的同支冲合旺衰核验'],
    },
    {
      type: '期限边界',
      matcher: (text) =>
        text.startsWith('以问题期限、三传先后和现实触发条件核对应期') ||
        /未给出目标期限|未给期限/.test(text),
      computed: '以问题期限、三传先后和现实触发条件核对应期',
      sources: ['当前问题是否给出目标期限、盘面先后快慢与触发条件'],
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
      promptText:
        definition.type === '期限边界' || (definition.type === '初传状态' && !initial.isVoid)
          ? definition.computed
          : (rawText ?? definition.computed),
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
  return { timingFacts, normalizedInput };
}

function buildFocusFacts(data: LiurenData): LiurenFocusFact[] {
  return (data.focusEvidence ?? []).map((item, index) => ({
    key: `liuren:focus:${index + 1}:${item.target}:${item.role}`,
    target: item.target,
    role: item.role,
    level: item.level,
    evidence: [...item.evidence],
    limitations: [...item.limitations],
    sourceStatus: '原结果提供',
    promptText: `${item.target}${item.role}：依据${item.evidence.join('、') || '未列独立证据'}；限制${item.limitations.join('、') || '仍须结合实际问题选择类神'}`,
    sources: ['当前结果已保存的盘面焦点对象、类神角色与课传依据'],
    limitation: FOCUS_FACT_LIMITATION,
  }));
}

function buildCalculationFact(
  data: LiurenData,
  xunKong: string[],
  plateVerified: boolean,
): LiurenCalculationFact {
  const dayStem = data.ganzhi.day.charAt(0);
  const hourBranch = data.ganzhi.hour.charAt(1);
  const expectedDayNight =
    hourBranch === data.divinationBranch
      ? DAYTIME_BRANCHES.has(data.divinationBranch)
        ? '昼占'
        : '夜占'
      : undefined;
  const dayNight =
    expectedDayNight && data.dayNight === expectedDayNight ? expectedDayNight : '未列';
  const expectedNoblemanBranch =
    dayNight !== '未列' ? getNoblemanBranch(dayStem, dayNight) : undefined;
  const noblemanBranch =
    expectedNoblemanBranch && data.noblemanBranch === expectedNoblemanBranch
      ? expectedNoblemanBranch
      : undefined;
  const expectedDayStemResidence = getDayStemResidence(dayStem);
  const dayStemResidence =
    data.dayStemResidence === expectedDayStemResidence ? expectedDayStemResidence : undefined;
  const noblemanGroundBranch = plateVerified ? data.noblemanGroundBranch : undefined;
  return {
    key: `liuren:calculation:${data.timestamp}`,
    ganzhi: { ...data.ganzhi },
    monthLeader: data.monthLeader,
    divinationBranch: data.divinationBranch,
    dayNight,
    noblemanBranch,
    noblemanGroundBranch,
    dayStem,
    dayStemResidence,
    xunKong: [...xunKong],
    promptText: `四柱干支为年${data.ganzhi.year}、月${data.ganzhi.month}、日${data.ganzhi.day}、时${data.ganzhi.hour}；月将${data.monthLeader}加占时${data.divinationBranch}；${dayNight}，日干贵人${noblemanBranch ?? '未列'}${noblemanGroundBranch ? `临地盘${noblemanGroundBranch}` : ''}；日干${dayStem}寄${dayStemResidence ?? '未列'}；日柱旬空${xunKong.join('、') || '未列'}`,
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

function buildPlateCoverageFact(
  data: LiurenData,
  positions: LiurenPlateFact[],
): LiurenPlateCoverageFact {
  const earthBranches = new Set(positions.map((item) => item.earthBranch));
  const heavenBranches = new Set(positions.map((item) => item.heavenBranch));
  const gods = new Set(positions.map((item) => item.god));
  const completeBranches =
    positions.length === 12 &&
    DIZHI.every((branch) => earthBranches.has(branch) && heavenBranches.has(branch)) &&
    TIANJIANG.every((god) => gods.has(god));
  const noblemanBranch = data.noblemanBranch;
  const dayStem = data.ganzhi.day.charAt(0);
  const dayNightFromHour = DAYTIME_BRANCHES.has(data.divinationBranch) ? '昼占' : '夜占';
  const timeAligned =
    data.ganzhi.hour.charAt(1) === data.divinationBranch && data.dayNight === dayNightFromHour;
  const expectedGanzhi =
    data.timezoneOffsetMinutes === undefined
      ? undefined
      : getDivinationTime(
          new Date(data.timestamp),
          data.timezoneOffsetMinutes,
          data.termReferenceTimestamp === undefined
            ? undefined
            : new Date(data.termReferenceTimestamp),
        ).ganzhi;
  const pillarsAligned =
    expectedGanzhi === undefined ||
    (data.ganzhi.year === expectedGanzhi.year &&
      data.ganzhi.month === expectedGanzhi.month &&
      data.ganzhi.day === expectedGanzhi.day &&
      data.ganzhi.hour === expectedGanzhi.hour);
  const noblemanMatchesDayStem =
    TIANGAN.includes(dayStem as (typeof TIANGAN)[number]) &&
    (data.dayNight === '昼占' || data.dayNight === '夜占') &&
    noblemanBranch === getNoblemanBranch(dayStem, data.dayNight);
  const expectedPlate =
    completeBranches &&
    DIZHI.includes(data.monthLeader as (typeof DIZHI)[number]) &&
    DIZHI.includes(data.divinationBranch as (typeof DIZHI)[number]) &&
    noblemanBranch &&
    DIZHI.includes(noblemanBranch as (typeof DIZHI)[number]) &&
    noblemanMatchesDayStem &&
    (data.dayNight === '昼占' || data.dayNight === '夜占')
      ? buildHeavenlyPlate({
          monthLeader: data.monthLeader,
          divinationBranch: data.divinationBranch,
          noblemanBranch,
          dayNight: data.dayNight,
        })
      : [];
  const byEarthBranch = new Map(positions.map((item) => [item.earthBranch, item]));
  const positionsAligned =
    timeAligned &&
    pillarsAligned &&
    expectedPlate.length === 12 &&
    expectedPlate.find((item) => item.branch === noblemanBranch)?.under ===
      data.noblemanGroundBranch &&
    expectedPlate.every((item) => {
      const actual = byEarthBranch.get(item.under);
      return actual?.heavenBranch === item.branch && actual.god === item.god;
    });
  const status = completeBranches && positionsAligned ? '完整' : '缺少';
  return {
    key: 'liuren:plate:coverage',
    status,
    expectedCount: 12,
    actualCount: positions.length,
    positionKeys: positions.map((item) => item.key),
    promptText:
      status === '完整'
        ? '天地盘十二位与十二天将资料完整，可逐位核验月将加时和贵人顺逆排布。'
        : `${positions.length < 12 ? `当前结果仅保留${positions.length}/12位天地盘资料` : !completeBranches ? `当前结果保留${positions.length}/12位天地盘资料，地盘、天盘或天将有缺漏或重复` : !timeAligned ? '占时支、时柱或昼夜占记录不一致' : !pillarsAligned ? '占时四柱与保存的起课时刻不一致' : '当前结果的月将加时或贵人布将与逐位记录不一致'}；月将加时和十二天将排布待复核。`,
    sources: ['当前大六壬结果的天地盘逐位记录', '十二地支与十二天将完整性检查'],
    limitation: PLATE_COVERAGE_LIMITATION,
  };
}

function buildSummaryFact(params: {
  calculationFact: LiurenCalculationFact;
  plateFact: LiurenPlateCoverageFact;
  platePositionFacts: LiurenPlateFact[];
  transmissionRuleFact: LiurenTransmissionRuleFact;
  ordinaryTransmissionAdjudicationFact: LiurenOrdinaryTransmissionAdjudicationFact;
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
      params.plateFact.key,
      ...params.platePositionFacts.map((item) => item.key),
      params.transmissionRuleFact.key,
      params.ordinaryTransmissionAdjudicationFact.key,
      ...params.ordinaryTransmissionAdjudicationFact.candidateFacts.map((item) => item.key),
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
    params.transitionFacts.length === 2 &&
    params.transmissionRuleFact.status === '已确定' &&
    params.ordinaryTransmissionAdjudicationFact.status !== '缺少轨迹'
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
    promptText: `证据链状态：${status}；天地盘${params.platePositionFacts.length}/12位、四课${params.lessons.length}项、普通宗门裁决${params.ordinaryTransmissionAdjudicationFact.status}、三传${params.transmissions.length}项、推进${params.transitionFacts.length}项、反证${params.counterEvidenceFacts.length}项、应期${params.timingFacts.length}项、类神焦点${params.focusFacts.length}项、传统资料${params.traditionalFacts.length}项`,
    sources: ['全部起盘、天地盘、四课取传、三传、反证、类神、应期与传统事实逐项汇总'],
    limitation: SUMMARY_FACT_LIMITATION,
  };
}

function buildCalculationSteps(params: {
  calculationFact: LiurenCalculationFact;
  plateFact: LiurenPlateCoverageFact;
  platePositionFacts: LiurenPlateFact[];
  lessons: LiurenLessonEvidence[];
  transmissionRuleFact: LiurenTransmissionRuleFact;
  ordinaryTransmissionAdjudicationFact: LiurenOrdinaryTransmissionAdjudicationFact;
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
        dayNight: params.calculationFact.dayNight ?? '未列',
        noblemanBranch: params.calculationFact.noblemanBranch ?? '未列',
        noblemanGroundBranch: params.calculationFact.noblemanGroundBranch ?? '未列',
        dayStemResidence: params.calculationFact.dayStemResidence ?? '未列',
        xunKong: params.calculationFact.xunKong,
      },
      dependsOnStepKeys: [],
      promptText: params.calculationFact.promptText,
      sources: params.calculationFact.sources,
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'liuren:calculation:plate',
      stage: '天地盘覆盖核验',
      status: params.plateFact.status === '完整' ? '已计算' : '资料不足',
      inputs: {
        monthLeader: params.calculationFact.monthLeader,
        divinationBranch: params.calculationFact.divinationBranch,
        noblemanGroundBranch: params.calculationFact.noblemanGroundBranch ?? '未列',
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
      status:
        params.transmissionRuleFact.status === '已确定' &&
        params.ordinaryTransmissionAdjudicationFact.status !== '缺少轨迹'
          ? '已计算'
          : '资料不足',
      inputs: {
        lessonCount: params.lessons.length,
        initialSourceLessonKeys: params.transmissionRuleFact.initialSourceLessonKeys,
        ordinaryCandidateKeys: params.ordinaryTransmissionAdjudicationFact.candidateFacts.map(
          (item) => item.key,
        ),
      },
      result: {
        ruleStatus: params.transmissionRuleFact.status,
        rule: params.transmissionRuleFact.rule ?? '未记录',
        pattern: params.transmissionRuleFact.pattern ?? '未记录',
        initialBranch: params.transmissionRuleFact.initialBranch,
        initialGod: params.transmissionRuleFact.initialGod,
        ordinaryAdjudicationStatus: params.ordinaryTransmissionAdjudicationFact.status,
        selectedCandidateKey:
          params.ordinaryTransmissionAdjudicationFact.selectedCandidateKey ?? '未记录',
      },
      dependsOnStepKeys: ['liuren:calculation:lessons'],
      promptText: `${params.transmissionRuleFact.promptText}；${params.ordinaryTransmissionAdjudicationFact.promptText}`,
      sources: Array.from(
        new Set([
          ...params.transmissionRuleFact.sources,
          ...params.ordinaryTransmissionAdjudicationFact.sources,
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
  plateFact: LiurenPlateCoverageFact;
  platePositionFacts: LiurenPlateFact[];
  lessons: LiurenLessonEvidence[];
  transmissionRuleFact: LiurenTransmissionRuleFact;
  ordinaryTransmissionAdjudicationFact: LiurenOrdinaryTransmissionAdjudicationFact;
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
        params.plateFact.key,
        ...params.platePositionFacts.map((item) => item.key),
      ],
      promptText:
        '占时四柱、月将加时、昼夜贵人、日干寄宫、旬空和天地盘逐位资料只证明起盘计算与排布结果；不得由单一位置、天将或方位直接推出人物、事件与现实吉凶',
      sources: ['起盘参数、天地盘覆盖与十二位逐项事实'],
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
        params.ordinaryTransmissionAdjudicationFact.key,
        ...params.ordinaryTransmissionAdjudicationFact.candidateFacts.map((item) => item.key),
      ],
      promptText:
        '四课记录上下神、乘将、生克、旬空和初传来源，普通宗门裁决记录候选、优先级与排除理由；缺少裁决轨迹时不得从最终规则名反推候选全集，已有规则也不单独证明现实成败',
      sources: ['四课关系事实、普通宗门裁决、初传来源与九宗门取传结果'],
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
        '初传、中传、末传及相邻关系只描述盘内发用、过程与落点结构；三传顺序、旺衰、旬空与生克不得直接写成现实事件必然按同样顺序推进、停滞、成功或失败',
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
        '空亡、休囚、冲克等反证必须与主证并列；未按具体问题选定类神时，不得把日支或任一神煞固定当作用神，天将也只能结合课传与问题使用；应期只保留先后、快慢、填实、冲合、旺衰与现实触发条件，不换算唯一日期或事件概率',
      sources: ['课传反证、类神焦点覆盖与应期触发事实'],
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

function buildOrdinaryTransmissionAdjudicationFact(
  data: LiurenData,
  lessons: LiurenLessonEvidence[],
): LiurenOrdinaryTransmissionAdjudicationFact {
  const adjudication = data.ordinaryTransmissionAdjudication;
  if (!adjudication) {
    return {
      key: 'liuren:ordinary-transmission-adjudication',
      status: '缺少轨迹',
      selectedRule: null,
      selectedInitial: null,
      selectedCandidateKey: null,
      candidateFacts: [],
      stageFacts: [],
      promptText:
        '当前结果只保存最终取传规则，缺少普通宗门候选、优先级与排除理由，不得声称取传竞争可重建。',
      sources: ['当前大六壬结果的普通宗门裁决轨迹完整性检查'],
      limitation:
        '普通宗门裁决只证明四课直接克、比用、涉害与遥克如何竞争形成初传；缺少轨迹时不得从最终规则名反推候选全集，也不单独证明现实吉凶或应期。',
    };
  }

  const candidateFacts: LiurenOrdinaryTransmissionCandidateFact[] = adjudication.candidates.map(
    (candidate) => {
      const sourceLessonKeys = candidate.sourceLessons
        .map((source) => lessons[source.position - 1]?.key)
        .filter((key): key is string => Boolean(key));
      const harmText = candidate.harmAssessment
        ? `；涉害行程${candidate.harmAssessment.walkedBranches.join('、') || '无中间支'}，深度${candidate.harmAssessment.depth}`
        : '';
      return {
        ...candidate,
        sourceLessonKeys,
        promptText: `${candidate.kind}候选${candidate.upper}，来源${candidate.sourceLessons.map((source) => source.name).join('、') || '未记录'}，状态${getLiurenOrdinaryCandidateStatusLabel(candidate)}；${candidate.reasons.join('；')}${harmText}`,
      };
    },
  );
  const stageFacts: LiurenOrdinaryTransmissionStageFact[] = adjudication.stages.map((stage) => ({
    ...stage,
    promptText: formatLiurenOrdinaryStage(stage),
  }));
  const status = adjudication.status === 'selected' ? '已裁决' : '转特殊课';
  return {
    key: adjudication.key,
    status,
    selectedRule: adjudication.selectedRule,
    selectedInitial: adjudication.selectedInitial,
    selectedCandidateKey: adjudication.selectedCandidateKey,
    candidateFacts,
    stageFacts,
    promptText:
      status === '已裁决'
        ? `普通宗门按${stageFacts.map(formatLiurenOrdinaryStage).join('、')}完成取舍，最终${adjudication.selectedRule}取${adjudication.selectedInitial}发用。`
        : adjudication.summary,
    sources: adjudication.sources,
    limitation: adjudication.limitation,
  };
}

export function analyzeLiurenEvidence(data: LiurenData): LiurenEvidenceAnalysis {
  if (
    data.timezoneOffsetMinutes !== undefined &&
    (!Number.isInteger(data.timezoneOffsetMinutes) ||
      data.timezoneOffsetMinutes < -720 ||
      data.timezoneOffsetMinutes > 840)
  ) {
    throw new Error('大六壬四柱时区偏移无效，无法生成证据。');
  }
  if (data.fourLessons.length !== 4 || data.threeTransmissions.length !== 3) {
    throw new Error('大六壬证据分析需要完整四课与三传。');
  }
  const expectedMonthLeader = getMonthLeaderByZhongqi(
    data.termReferenceTimestamp ?? data.timestamp,
  );
  if (data.monthLeader !== expectedMonthLeader) {
    throw new Error('大六壬月将与实际占时中气不一致，无法生成证据。');
  }
  const expectedXunKong = getVoidBranches(data.ganzhi.day);
  if (data.xunKong !== undefined && !hasSameStrings(data.xunKong, expectedXunKong)) {
    throw new Error('大六壬旬空与日柱不一致，无法生成证据。');
  }
  const monthBranch = data.ganzhi.month.charAt(1);
  const threeTransmissions = data.threeTransmissions.map((item) => {
    const wuxing = getBranchWuxing(item.branch);
    const seasonState = getSeasonState(wuxing, monthBranch);
    if (
      (item.wuxing !== undefined && item.wuxing !== wuxing) ||
      (item.seasonState !== undefined && item.seasonState !== seasonState)
    ) {
      throw new Error('大六壬三传五行或月令旺衰与地支、月建不一致，无法生成证据。');
    }
    return { ...item, wuxing, seasonState, isVoid: expectedXunKong.includes(item.branch) };
  });
  data = { ...data, xunKong: expectedXunKong, threeTransmissions };
  const expectedShenShaFacts = buildShenShaFacts(
    data.ganzhi.month.charAt(1),
    data.ganzhi.day.charAt(1),
    data.ganzhi.day.charAt(0),
  );
  if (
    (data.shenShaFacts !== undefined &&
      stableStringify(data.shenShaFacts) !== stableStringify(expectedShenShaFacts)) ||
    (data.shenShaSummary !== undefined &&
      !hasSameStrings(
        data.shenShaSummary,
        expectedShenShaFacts.map((fact) => `${fact.name}在${fact.target}`),
      ))
  ) {
    throw new Error('大六壬神煞与日月干支不一致，无法生成证据。');
  }
  const initial = data.threeTransmissions[0];
  const xunKong = expectedXunKong;
  const platePositionFacts = buildPlatePositionFacts(data);
  const plateFact = buildPlateCoverageFact(data, platePositionFacts);
  const calculationFact = buildCalculationFact(data, xunKong, plateFact.status === '完整');
  const calculationFacts = [
    `四柱干支：年${calculationFact.ganzhi.year}、月${calculationFact.ganzhi.month}、日${calculationFact.ganzhi.day}、时${calculationFact.ganzhi.hour}`,
    `月将加时：月将${calculationFact.monthLeader}加占时${calculationFact.divinationBranch}`,
    `贵人定位：${calculationFact.dayNight}，日干贵人${calculationFact.noblemanBranch ?? '未列'}${calculationFact.noblemanGroundBranch ? `临地盘${calculationFact.noblemanGroundBranch}` : ''}`,
    `日干寄宫：${calculationFact.dayStem}寄${calculationFact.dayStemResidence ?? '未列'}`,
    `日柱旬空：${calculationFact.xunKong.join('、') || '未列'}`,
  ];
  if (plateFact.status !== '完整') {
    data = {
      ...data,
      transmissionRule: undefined,
      ordinaryTransmissionAdjudication: undefined,
      transmissionPattern: undefined,
      transmissionDetail: undefined,
      classicalRules: undefined,
      patternTags: undefined,
      guaTi: undefined,
      guaTiFacts: undefined,
      focusEvidence: undefined,
      timingEvidence: undefined,
    };
  }
  if (plateFact.status === '完整') {
    const dayStem = data.ganzhi.day.charAt(0);
    const dayBranch = data.ganzhi.day.charAt(1);
    const dayStemResidence = getDayStemResidence(dayStem);
    const expectedLessons = buildFourLessons({
      heavenlyPlate: data.heavenlyPlate,
      dayStem,
      dayBranch,
      dayStemResidence,
      xunKong,
    });
    if (
      data.dayStemResidence !== dayStemResidence ||
      data.fourLessons.some((lesson, index) => {
        const expected = expectedLessons[index];
        return (
          lesson.name !== expected.name ||
          lesson.upper !== expected.upper ||
          lesson.lower !== expected.lower ||
          lesson.god !== expected.god ||
          lesson.relation !== expected.relation
        );
      })
    ) {
      throw new Error('大六壬四课与天地盘不一致，无法生成证据。');
    }
    if (
      data.threeTransmissions.some((transmission, index) => {
        const plateItem = getPlateItemByBranch(data.heavenlyPlate, transmission.branch);
        const previous = index === 0 ? dayStem : data.threeTransmissions[index - 1].branch;
        return (
          transmission.god !== plateItem.god ||
          transmission.relation !== describeRelation(transmission.branch, previous) ||
          transmission.dayRelation !== describeRelation(transmission.branch, dayBranch)
        );
      })
    ) {
      throw new Error('大六壬三传与天地盘不一致，无法生成证据。');
    }
    const expected = resolveInitialTransmission(data.fourLessons, {
      dayStem,
      dayBranch,
      dayStemResidence,
      hourStem: data.ganzhi.hour.charAt(0),
      hourBranch: data.divinationBranch,
      heavenlyPlate: data.heavenlyPlate,
    });
    const middle = expected.branches?.[1] ?? getUpperByUnder(data.heavenlyPlate, expected.initial);
    const expectedBranches = expected.branches ?? [
      expected.initial,
      middle,
      getUpperByUnder(data.heavenlyPlate, middle),
    ];
    if (
      (data.transmissionRule && data.transmissionRule !== expected.rule) ||
      data.threeTransmissions.some((item, index) => item.branch !== expectedBranches[index])
    ) {
      throw new Error('大六壬取传规则或三传与四课、天地盘不一致，无法生成证据。');
    }
    if (
      data.ordinaryTransmissionAdjudication &&
      stableStringify(data.ordinaryTransmissionAdjudication) !==
        stableStringify(expected.ordinaryAdjudication)
    ) {
      throw new Error('大六壬普通宗门裁决与四课、三传、天地盘不一致，无法生成证据。');
    }
    const expectedPattern = getTransmissionPattern(
      expectedBranches[0],
      expectedBranches[1],
      expectedBranches[2],
      expected.rule,
    );
    const expectedClassicalRules = resolveLiurenClassicalRules(expected.rule);
    if (
      (data.transmissionPattern !== undefined && data.transmissionPattern !== expectedPattern) ||
      (data.transmissionDetail !== undefined &&
        data.transmissionDetail !==
          buildTransmissionDetail(
            expected.rule,
            expectedPattern,
            data.threeTransmissions,
            expectedClassicalRules,
          )) ||
      (data.classicalRules !== undefined &&
        stableStringify(data.classicalRules) !== stableStringify(expectedClassicalRules)) ||
      (data.focusEvidence !== undefined &&
        stableStringify(data.focusEvidence) !==
          stableStringify(
            buildLiurenFocusEvidence({
              rule: expected.rule,
              transmissions: data.threeTransmissions,
              dayStem,
              dayStemResidence,
              dayBranch,
              fourLessons: data.fourLessons,
            }),
          )) ||
      (data.timingEvidence !== undefined &&
        data.timingEvidence.length > 0 &&
        !hasSameStrings(
          data.timingEvidence.map((text, index) => {
            if (
              index === 0 &&
              text ===
                `一级发用：先看初传${data.threeTransmissions[0].branch}不空，可直接作为起始信号`
            ) {
              return `一级发用：先看初传${data.threeTransmissions[0].branch}不空，按月令旺衰、日支关系和事项类神核对发端条件`;
            }
            if (
              index === 3 &&
              text === '未给出目标期限时，只判断先后、快慢和触发条件，不硬换成唯一日期'
            ) {
              return '以问题期限、三传先后和现实触发条件核对应期';
            }
            return text;
          }),
          buildLiurenTimingEvidence({
            transmissions: data.threeTransmissions,
            dayBranch,
            monthBranch: data.ganzhi.month.charAt(1),
          }),
        ))
    ) {
      throw new Error('大六壬取传派生资料与四课、三传不一致，无法生成证据。');
    }
    if (
      data.guaTiFacts !== undefined ||
      data.guaTi !== undefined ||
      data.patternTags !== undefined
    ) {
      const initialGroundBranch = getPlateItemByBranch(
        data.heavenlyPlate,
        data.threeTransmissions[0].branch,
      ).under;
      const noblemanGroundBranch = data.noblemanBranch
        ? getPlateItemByBranch(data.heavenlyPlate, data.noblemanBranch).under
        : undefined;
      const expectedGuaTiFacts = getLiurenGuaTiFacts({
        transmissionBranches: data.threeTransmissions.map((item) => item.branch),
        initialGroundBranch,
        initialGod: data.threeTransmissions[0].god,
        yearBranch: data.ganzhi.year.charAt(1),
        monthBranch: data.ganzhi.month.charAt(1),
        monthLeader: data.monthLeader,
        noblemanBranch: data.noblemanBranch,
        noblemanGroundBranch,
        fourLessons: data.fourLessons,
        dayStem,
        dayBranch,
      });
      if (
        (data.guaTiFacts !== undefined &&
          JSON.stringify(getGuaTiFactSignatures(data.guaTiFacts)) !==
            JSON.stringify(getGuaTiFactSignatures(expectedGuaTiFacts))) ||
        (data.guaTi !== undefined &&
          !hasSameStrings(
            data.guaTi,
            expectedGuaTiFacts.map((fact) => fact.name),
          ))
      ) {
        throw new Error('大六壬课体与四课、三传、天地盘不一致，无法生成证据。');
      }
      if (
        data.patternTags !== undefined &&
        !hasSameStrings(data.patternTags, [
          `${data.threeTransmissions[0].god}发用`,
          expected.tag,
          data.threeTransmissions.some((item) => xunKong.includes(item.branch))
            ? '空亡入传'
            : '传不逢空',
          getPatternTag(expectedPattern),
          ...expectedGuaTiFacts.map((fact) => fact.name),
        ])
      ) {
        throw new Error('大六壬取传标签与四课、三传、天地盘不一致，无法生成证据。');
      }
    }
  }
  if (data.tianJiangProps !== undefined) {
    const expectedProps = Object.fromEntries(
      [...new Set(data.threeTransmissions.map((item) => item.god))].flatMap((god) => {
        const attributes = TIANJIANG_ATTRIBUTES[god as keyof typeof TIANJIANG_ATTRIBUTES];
        return attributes ? [[god, { ...attributes }]] : [];
      }),
    );
    if (stableStringify(data.tianJiangProps) !== stableStringify(expectedProps)) {
      throw new Error('大六壬天将属性与三传不一致，无法生成证据。');
    }
  }
  const plateFacts = platePositionFacts.map(
    (item) => `地盘${item.earthBranch}上见天盘${item.heavenBranch}乘${item.god}`,
  );
  const patternEvidence = Array.from(
    new Set([...(data.patternTags ?? []), ...(data.guaTi ?? [])].filter(Boolean)),
  );
  const shenShaEvidence = Array.from(
    new Set(
      (data.shenShaSummary?.length
        ? data.shenShaSummary
        : (data.shenShaFacts ?? []).map((item) => `${item.name}在${item.target}`)
      ).filter(Boolean),
    ),
  );
  const traditionalFacts = buildTraditionalFacts(data, patternEvidence);
  const initialSourceLessonPositions = getInitialSourceLessonPositions(data);
  const lessons = data.fourLessons.map((lesson, index) =>
    buildLessonEvidence(lesson, index, initialSourceLessonPositions.has(index + 1), xunKong),
  );
  const initialSourceLessons = lessons
    .filter((item) => item.isInitialSource)
    .map((item) => item.name);
  const ordinaryTransmissionAdjudicationFact = buildOrdinaryTransmissionAdjudicationFact(
    data,
    lessons,
  );
  const transmissions = data.threeTransmissions.map((item, index) =>
    buildTransmissionEvidence(item, index, xunKong),
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
      : '当前结构化核验未见明确空亡、休囚或冲克限制；不代表现实风险为零',
    sources: ['四课与三传关系事实逐项筛选'],
    limitation: COUNTER_SUMMARY_LIMITATION,
  };
  const focusEvidence = data.focusEvidence ?? [];
  const focusFacts = buildFocusFacts(data);
  const focusSummaryFact: LiurenFocusSummaryFact = {
    key: 'liuren:focus-summary',
    status: focusFacts.length ? '已提供焦点' : '缺少焦点',
    factKeys: focusFacts.map((item) => item.key),
    promptText: focusFacts.length
      ? `当前结果保存${focusFacts.length}个盘面焦点对象，须按主证、辅证和各自限制使用`
      : '当前结果未保存盘面焦点对象，不得自行把日支、天将或神煞固定当作用神',
    sources: ['当前大六壬结果的焦点对象完整性检查'],
    limitation: FOCUS_SUMMARY_LIMITATION,
  };
  const { timingFacts, normalizedInput: timingEvidence } = buildTimingFacts(data, transmissions);
  const timingConditions = timingFacts.map((item) => item.promptText);
  const classicalRuleKeys = traditionalFacts
    .filter((item) => item.kind === '经典取传规则')
    .map((item) => item.key);
  const transmissionRuleFact: LiurenTransmissionRuleFact = {
    key: 'liuren:transmission-rule',
    status: data.transmissionRule ? '已确定' : '缺少规则名',
    rule: data.transmissionRule || null,
    pattern: data.transmissionPattern ?? null,
    initialBranch: initial.branch,
    initialGod: initial.god,
    initialSourceLessonKeys: lessons.filter((item) => item.isInitialSource).map((item) => item.key),
    detail: data.transmissionDetail?.trim() || null,
    classicalRuleKeys,
    promptText: data.transmissionRule
      ? `按${data.transmissionRule}取初传${initial.branch}乘${initial.god}${data.transmissionPattern ? `，三传模式${data.transmissionPattern}` : ''}${initialSourceLessons.length ? `，初传上神见于${initialSourceLessons.join('、')}` : '，特殊取传未直接对应单一课上神'}`
      : `当前结果未保存取传规则名，仅保留初传${initial.branch}乘${initial.god}；不得按三传结果反推九宗门名称`,
    sources: [
      '当前结果保存的四课、初传与三传结构',
      ...(data.transmissionRule ? ['已确定的九宗门取传结果'] : []),
      ...traditionalFacts
        .filter((item) => item.kind === '经典取传规则')
        .flatMap((item) => item.sources),
    ],
    limitation: RULE_FACT_LIMITATION,
  };
  const summaryFact = buildSummaryFact({
    calculationFact,
    plateFact,
    platePositionFacts,
    transmissionRuleFact,
    ordinaryTransmissionAdjudicationFact,
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
    plateFact,
    platePositionFacts,
    lessons,
    transmissionRuleFact,
    ordinaryTransmissionAdjudicationFact,
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
    plateFact,
    platePositionFacts,
    lessons,
    transmissionRuleFact,
    ordinaryTransmissionAdjudicationFact,
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

  const classicalText = data.classicalRules?.length
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
      title: '月将加时与贵人起盘事实',
      detail: `${calculationFact.promptText}；边界：${calculationFact.limitation}`,
      source: calculationFact.sources.join('、'),
      tags: ['月将', '占时', '贵人', '日干寄宫', '旬空'],
    },
    {
      level: plateFact.status === '完整' ? '辅证' : '反证',
      title: plateFact.status === '完整' ? '天地盘十二支与天将定位' : '天地盘定位待复核',
      detail: `${plateFact.promptText}${platePositionFacts.length ? `；已保存位置：${platePositionFacts.map((item) => item.promptText).join('；')}` : ''}；逐位边界：${PLATE_FACT_LIMITATION}；覆盖边界：${plateFact.limitation}`,
      source: Array.from(
        new Set([...plateFact.sources, ...platePositionFacts.flatMap((item) => item.sources)]),
      ).join('、'),
      tags: ['天地盘', '十二天将', plateFact.status],
    },
    {
      level: '主证',
      title: '四课取传与初传发用',
      detail: `四课${lessons.map((item) => `${item.name}${item.upper}临${item.lower}（${item.relation}）`).join('；')}；${transmissionRuleFact.promptText}；${ordinaryTransmissionAdjudicationFact.promptText}；候选${ordinaryTransmissionAdjudicationFact.candidateFacts.map((item) => item.promptText).join('；') || '无普通宗门候选'}；规则边界：${transmissionRuleFact.limitation}；裁决边界：${ordinaryTransmissionAdjudicationFact.limitation}；古籍依据：${classicalText}`,
      source: transmissionRuleFact.sources.join('、'),
      tags: ['四课', transmissionRuleFact.rule || '取传规则缺失'],
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
    ...(data.transmissionDetail
      ? [
          {
            level: '辅证' as const,
            title: '取传规则与三传模式说明',
            detail: data.transmissionDetail,
            source: '九宗门取传结果、三传结构与经典规则合并说明',
            tags: [
              '取传规则',
              data.transmissionRule || '未命名',
              data.transmissionPattern || '未分类',
            ],
          },
        ]
      : []),
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
            source: '年支、月支、日支与日干神煞规则逐项定位',
            tags: ['神煞', '辅助证据'],
          },
        ]
      : []),
    ...traditionalFacts
      .filter((item) => item.kind === '天将属性' || item.kind === '天将乘神')
      .map((item): PromptEvidenceItem => ({
        level: '辅证',
        title: `${item.stages?.join('、') || ''}${item.name}${item.kind}`,
        detail: `${item.promptText}；入传位置${item.stages?.join('、') || '未列'}，地支${item.branches?.join('、') || '未列'}；边界：${item.limitation}`,
        source: `${item.sources.join('、')}；原始传统文义仅供资料核对，解读采用条件化表述`,
        tags: ['天将属性', ...(item.stages ?? []), item.name],
      })),
    ...focusFacts.map((item): PromptEvidenceItem => ({
      level: item.level,
      title: `${item.target}${item.role}`,
      detail: `${item.promptText}；边界：${item.limitation}`,
      source: item.sources.join('、'),
      tags: ['类神焦点', item.target, item.role],
    })),
    ...(focusFacts.length
      ? []
      : [
          {
            level: '限制' as const,
            title: '类神焦点资料缺失',
            detail: `${focusSummaryFact.promptText}；边界：${focusSummaryFact.limitation}`,
            source: focusSummaryFact.sources.join('、'),
            tags: ['类神焦点', '缺少焦点'],
          },
        ]),
    ...(timingFacts.length
      ? [
          {
            level: '应期' as const,
            title: '应期触发证据',
            detail: timingFacts.map((fact) => fact.promptText).join('；'),
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
    `起盘事实：${calculationFacts.join('；')}`,
    `天地盘：${plateFact.status === '完整' ? plateFacts.join('；') : '逐位资料待核'}`,
    `四课取传与初传发用：${lessons.map((item) => item.promptText).join('；')}`,
    `取传规则事实：${transmissionRuleFact.rule ? transmissionRuleFact.promptText : `初传${initial.branch}乘${initial.god}，取传规则名待核`}`,
    `普通宗门裁决：${ordinaryTransmissionAdjudicationFact.status === '缺少轨迹' ? '普通宗门候选与裁决轨迹待核' : ordinaryTransmissionAdjudicationFact.promptText}`,
    `三传：${transmissions.map((item) => item.promptText).join('；')}`,
    `推进关系：${transitionFacts.map((item) => item.promptText).join('；')}`,
    ...(counterEvidenceFacts.length
      ? [`盘内限制：${counterEvidenceFacts.map((item) => item.promptText).join('；')}`]
      : []),
    `应期触发证据：${timingConditions.join('；')}`,
    `类神焦点状态：${focusFacts.length ? focusFacts.map((item) => `${item.target}${item.role}：${item.evidence.join('、')}`).join('；') : '事项类神按所问事项核对'}`,
    '【任务】结合所问事项核对四课取传、三传推进、类神位置与应期触发条件，给出有盘面依据的条件化判断。',
  ].join('\n');
  return {
    key: 'liuren:evidence',
    status: '已计算',
    calculationFact,
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
    ordinaryTransmissionAdjudicationFact,
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
      '先核验四课直接上下克；有直接克时在候选内依比用、涉害取舍，无直接克时才进入遥克，保留全部候选和排除理由。',
      '初传、中传、末传分别作为起点、过程、落点，逐传保留天将、旺衰、旬空和日支关系。',
      '月将加时、昼夜贵人、天地盘、日干寄宫、课体、神煞与天将属性均保留为结构化辅证。',
      '课体与神煞只作辅助标签，不覆盖发用和三传主线。',
      '未按问题选择类神时保留限制，不生成吉凶总分、成功率或绝对日期。',
    ],
  };
}
