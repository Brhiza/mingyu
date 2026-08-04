import type { LiurenData, LiurenLesson, LiurenTransmission } from '../types/divination';
import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';

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
      : [
          {
            key: 'shensha:legacy:unavailable',
            kind: '神煞',
            name: '传统神煞',
            originalText: '传统神煞在盘面',
            promptText: '传统神煞在盘面；未保存起法输入，不能据此复算',
            sources: ['旧结果未保存逐项起法与来源'],
            branches: undefined,
            limitation: TRADITIONAL_FACT_LIMITATION,
          },
        ];

  return [
    ...classicalFacts,
    ...registeredPatternFacts,
    ...patternFacts,
    ...tianJiangFacts,
    ...shenShaFacts,
  ];
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
  initialBranch: string,
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
    isInitialSource: lesson.upper === initialBranch,
    constraints,
    relationFacts,
    promptText: `${lesson.name}${lesson.upper}临${lesson.lower}，乘${lesson.god}，关系${lesson.relation}；${lesson.note || '课注未列'}`,
    sources: ['日干寄宫、日支与天地盘逐课推导', '日柱旬空与上下神关系核验'],
    limitation: LESSON_FACT_LIMITATION,
  };
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
  const normalizedInput = Array.from(new Set(data.timingEvidence ?? [])).filter((item) => {
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
        : `一级发用：初传${initial.branch}不空，为当前起始信号`,
      sources: ['初传地支与日柱旬空核验'],
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
      computed: `三级日月：以日支${data.ganzhi.day.slice(-1)}、月支${data.ganzhi.month.slice(-1)}对初传和类神的同支、冲合与旺衰作为触发条件`,
      sources: ['月支、日支与初传及类神的同支冲合旺衰核验'],
    },
    {
      type: '期限边界',
      matcher: (text) => /未给出目标期限|未给期限/.test(text),
      computed: '未给出目标期限时，以盘面先后、快慢与触发条件为应期资料',
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
      promptText: rawText ?? definition.computed,
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

function buildCalculationFact(data: LiurenData, xunKong: string[]): LiurenCalculationFact {
  const dayStem = data.ganzhi.day.charAt(0);
  return {
    key: `liuren:calculation:${data.timestamp}`,
    ganzhi: { ...data.ganzhi },
    monthLeader: data.monthLeader,
    divinationBranch: data.divinationBranch,
    dayNight: data.dayNight ?? '未列',
    noblemanBranch: data.noblemanBranch,
    noblemanGroundBranch: data.noblemanGroundBranch,
    dayStem,
    dayStemResidence: data.dayStemResidence,
    xunKong: [...xunKong],
    promptText: `四柱干支为年${data.ganzhi.year}、月${data.ganzhi.month}、日${data.ganzhi.day}、时${data.ganzhi.hour}；月将${data.monthLeader}加占时${data.divinationBranch}；${data.dayNight ?? '昼夜未列'}，日干贵人${data.noblemanBranch ?? '未列'}${data.noblemanGroundBranch ? `临地盘${data.noblemanGroundBranch}` : ''}；日干${dayStem}寄${data.dayStemResidence ?? '未列'}；日柱旬空${xunKong.join('、') || '未列'}`,
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
    params.transitionFacts.length === 2 &&
    params.transmissionRuleFact.status === '已确定'
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
    promptText: `证据链状态：${status}；天地盘${params.platePositionFacts.length}/12位、四课${params.lessons.length}项、三传${params.transmissions.length}项、推进${params.transitionFacts.length}项、反证${params.counterEvidenceFacts.length}项、应期${params.timingFacts.length}项、类神焦点${params.focusFacts.length}项、传统资料${params.traditionalFacts.length}项`,
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
      status: params.transmissionRuleFact.status === '已确定' ? '已计算' : '资料不足',
      inputs: {
        lessonCount: params.lessons.length,
        initialSourceLessonKeys: params.transmissionRuleFact.initialSourceLessonKeys,
      },
      result: {
        ruleStatus: params.transmissionRuleFact.status,
        rule: params.transmissionRuleFact.rule ?? '未记录',
        pattern: params.transmissionRuleFact.pattern ?? '未记录',
        initialBranch: params.transmissionRuleFact.initialBranch,
        initialGod: params.transmissionRuleFact.initialGod,
      },
      dependsOnStepKeys: ['liuren:calculation:lessons'],
      promptText: params.transmissionRuleFact.promptText,
      sources: params.transmissionRuleFact.sources,
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
      ],
      promptText:
        '四课记录上下神、乘将、生克、旬空和初传来源，九宗门规则只说明如何发用取传；缺少规则名时不得按结果反推，已有规则也不单独证明现实成败',
      sources: ['四课关系事实、初传来源与九宗门取传结果'],
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

export function analyzeLiurenEvidence(data: LiurenData): LiurenEvidenceAnalysis {
  if (data.fourLessons.length !== 4 || data.threeTransmissions.length !== 3) {
    throw new Error('大六壬证据分析需要完整四课与三传。');
  }
  const initial = data.threeTransmissions[0];
  const xunKong = data.xunKong ?? [];
  const calculationFact = buildCalculationFact(data, xunKong);
  const calculationFacts = [
    `四柱干支：年${calculationFact.ganzhi.year}、月${calculationFact.ganzhi.month}、日${calculationFact.ganzhi.day}、时${calculationFact.ganzhi.hour}`,
    `月将加时：月将${calculationFact.monthLeader}加占时${calculationFact.divinationBranch}`,
    `贵人定位：${calculationFact.dayNight}，日干贵人${calculationFact.noblemanBranch ?? '未列'}${calculationFact.noblemanGroundBranch ? `临地盘${calculationFact.noblemanGroundBranch}` : ''}`,
    `日干寄宫：${calculationFact.dayStem}寄${calculationFact.dayStemResidence ?? '未列'}`,
    `日柱旬空：${calculationFact.xunKong.join('、') || '未列'}`,
  ];
  const platePositionFacts = buildPlatePositionFacts(data);
  const plateFact = buildPlateCoverageFact(platePositionFacts);
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
  const lessons = data.fourLessons.map((lesson, index) =>
    buildLessonEvidence(lesson, index, initial.branch, xunKong),
  );
  const initialSourceLessons = lessons
    .filter((item) => item.isInitialSource)
    .map((item) => item.name);
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
  const timingConditions = [
    transmissions[0].isVoid
      ? `初传${initial.branch}空亡，先等待填实、冲实或现实条件落实再验`
      : `初传${initial.branch}不空，可作为当前起始信号，但仍须现实事件验证`,
    `三传顺序${transmissions.map((item) => `${item.stage}${item.branch}`).join(' → ')}只表示阶段推进`,
    `月支${data.ganzhi.month.slice(-1)}与日支${data.ganzhi.day.slice(-1)}用于核验旺衰、同支、冲合及空亡触发`,
    '未给期限时不换算唯一日期，不以神煞或课体单项指定应期',
    ...timingEvidence,
  ];
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
    `取传规则事实：${transmissionRuleFact.promptText}；边界：${transmissionRuleFact.limitation}`,
    `推进关系：${transitionFacts.map((item) => item.promptText).join('；')}`,
    `反证限制：${counterSummaryFact.promptText}${counterEvidenceFacts.length ? `；明细${counterEvidenceFacts.map((item) => item.promptText).join('；')}` : ''}；边界：${counterSummaryFact.limitation}`,
    `触发条件：${timingFacts.map((item) => `${item.promptText}（${item.sourceStatus}）`).join('；')}`,
    `类神焦点状态：${focusSummaryFact.promptText}；边界：${focusSummaryFact.limitation}`,
    '应期边界：未给期限时不换算唯一日期，不以神煞、课体或单项关系指定应期。',
    `计算链：${calculationChain.join(' → ')}`,
    `证据汇总：${summaryFact.promptText}。`,
    `解释限制：${limitations.join('；')}。`,
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
      '先核验四课上下关系，再按已计算的九宗门规则确认初传发用。',
      '初传、中传、末传分别作为起点、过程、落点，逐传保留天将、旺衰、旬空和日支关系。',
      '月将加时、昼夜贵人、天地盘、日干寄宫、课体、神煞与天将属性均保留为结构化辅证。',
      '课体与神煞只作辅助标签，不覆盖发用和三传主线。',
      '未按问题选择类神时保留限制，不生成吉凶总分、成功率或绝对日期。',
    ],
  };
}
