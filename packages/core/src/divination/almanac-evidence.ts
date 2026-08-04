import type {
  AlmanacData,
  AlmanacDayCandidate,
  AlmanacGodFact,
  AlmanacHourCandidate,
  AlmanacParticipantRelationFact,
  AlmanacTopic,
  AlmanacTopicMatchFact,
} from '../types/divination';
import {
  calculateMoonPhaseEvidence,
  type MoonPhaseEvidence,
} from '../calendar/moon-phase-evidence';
import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';

export type AlmanacCandidateStatus = '可用候选' | '条件候选' | '慎用候选';

export interface AlmanacRawTabooFact {
  key: string;
  scope: '候选日';
  status: '宜忌均列' | '仅列宜项' | '仅列忌项' | '均未列';
  recommends: string[];
  avoids: string[];
  promptText: string;
  sources: string[];
  limitation: '原始宜忌只保留历书列项及其是否命中当前事项；未列不等于适宜，列出也不等于现实事项必然成功或失败';
}

export interface AlmanacDecisionStep {
  key: string;
  stage: '原始宜忌' | '事项命中' | '值日神煞' | '参与人关系' | '传统限制' | '可用时辰' | '候选分组';
  status: '通过' | '有支持' | '有限制' | '触发慎用' | '未提供';
  factKeys: string[];
  inputs: string[];
  result: string;
  promptText: string;
  sources: string[];
}

export interface AlmanacCandidateDecisionFact {
  key: string;
  date: string;
  status: AlmanacCandidateStatus;
  steps: AlmanacDecisionStep[];
  supportingFactKeys: string[];
  limitingFactKeys: string[];
  strongConstraintTexts: string[];
  promptText: string;
  sources: string[];
  limitation: '候选状态只按明确事项忌项、参与人直接关系和可用时辰分组；算法不设置吉凶总分，不把候选等级解释为成功率或现实吉凶保证';
}

export interface AlmanacTraditionalFact {
  key: string;
  date: string;
  kind: '二十八宿' | '九星' | '全年方位神' | '彭祖百忌';
  name: string;
  originalText: string;
  promptText: string;
  sources: string[];
  fortune?: string;
  branch?: string;
  direction?: string;
  limitation: '传统择日资料只用于当前事项的候选比较，不证明现实中的疾病、死亡、灾祸、官非、财损、婚姻或生育结果';
}

export interface AlmanacHourEvidence {
  key: string;
  name: string;
  range: string;
  ganzhi: string;
  branch: string;
  twelveStar: string;
  status: AlmanacCandidateStatus;
  support: string[];
  constraints: string[];
  participantSupport: string[];
  participantRelationFacts: AlmanacParticipantRelationFact[];
  promptText: string;
  sources: string[];
  limitation: '逐时时课只保留时柱、十二神与参与人刑冲破害，不证明该时辰必然成功、吉利或适合所有人';
}

export interface AlmanacCalendarFact {
  key: string;
  date: string;
  weekday: string;
  lunarDate: string;
  ganzhi: AlmanacDayCandidate['ganzhi'];
  zodiac: string;
  dayOfficer: string;
  twelveStar: string;
  clash: string;
  promptText: string;
  sources: string[];
  limitation: '公历、农历、干支、建除、十二神与冲煞是当前候选日的历法和规则字段，只用于确定比较条件，不单独证明现实吉凶或事项结果';
}

export interface AlmanacCandidateEvidence {
  date: string;
  status: AlmanacCandidateStatus;
  calendarFact: AlmanacCalendarFact;
  rawTabooFact: AlmanacRawTabooFact;
  godFacts: AlmanacGodFact[];
  topicMatchFacts: AlmanacTopicMatchFact[];
  participantRelationFacts: AlmanacParticipantRelationFact[];
  decisionFact: AlmanacCandidateDecisionFact;
  moonPhaseFact: MoonPhaseEvidence;
  astronomicalFacts: string[];
  calendarFacts: string[];
  traditionalRuleFacts: string[];
  directionFacts: string[];
  topicMatches: string[];
  traditionalSupport: string[];
  traditionalConstraints: string[];
  participantSupport: string[];
  participantConflicts: string[];
  directionConstraints: string[];
  usableHours: AlmanacHourEvidence[];
  traditionalFacts: AlmanacTraditionalFact[];
  limitations: string[];
}

export interface AlmanacEvidenceCalculationStep {
  key: string;
  stage:
    | '候选范围核验'
    | '逐日历法核验'
    | '事项与神煞核验'
    | '参与人与现实约束核验'
    | '逐时时课核验'
    | '候选分组核验'
    | '证据汇总';
  status: '已计算' | '资料不足';
  inputs: Record<string, string | number | boolean | string[]>;
  result: Record<string, string | number | boolean | string[]>;
  dependsOnStepKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '计算步骤只证明候选范围、历法字段、事项宜忌、神煞、参与人关系、逐时时课与候选分组如何形成当前证据；不证明现实吉凶、成功率、个人结果或必然适宜';
}

export interface AlmanacCounterEvidenceFact {
  key: string;
  date: string;
  type: '候选限制' | '强限制' | '无可用时辰';
  status: '已触发';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '反证事实只表示当前候选存在事项忌项、传统限制、参与人冲突或无可用时辰；不得把单项反证直接写成现实失败、灾祸或必然不宜';
}

export interface AlmanacCounterSummaryFact {
  key: 'almanac:counter-summary';
  status: '有明确反证' | '未见明确反证';
  factKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '反证汇总只说明候选范围内是否记录明确限制，不代表未见反证的日期现实风险为零，也不得按反证数量生成吉凶总分或失败概率';
}

export interface AlmanacSummaryFact {
  key: 'almanac:evidence-summary';
  status: '证据链完整' | '候选资料缺失';
  factKeys: string[];
  candidateCount: number;
  visibleCandidateCount: number;
  preferredDateCount: number;
  conditionalDateCount: number;
  cautionDateCount: number;
  usableHourFactCount: number;
  traditionalFactCount: number;
  counterEvidenceCount: number;
  promptText: string;
  sources: string[];
  limitation: '黄历择日证据汇总只统计候选日、分组、逐时时课、传统资料与反证的覆盖情况；不得按数量或候选等级生成吉凶总分、成功率、个人保证或唯一最佳日期';
}

export interface AlmanacLimitationFact {
  key: string;
  type:
    | '候选范围与历法边界'
    | '事项宜忌与神煞边界'
    | '参与人适配边界'
    | '逐时时课与分组边界'
    | '天文与传统资料边界'
    | '现实与高风险输出边界';
  status: '适用';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '限制事实用于约束候选范围、历法、事项宜忌、神煞、参与人、逐时时课、月相与传统资料能够支持的解释范围，不得被反向当作现实吉凶、成功率、个人结果或必然适宜的证据';
}

export interface AlmanacEvidenceAnalysis {
  key: 'almanac:evidence';
  status: '已计算';
  calculationSteps: AlmanacEvidenceCalculationStep[];
  calculationChain: string[];
  candidates: AlmanacCandidateEvidence[];
  preferredDates: string[];
  conditionalDates: string[];
  cautionDates: string[];
  hardConstraints: string[];
  realityConstraints: string[];
  traditionalFacts: AlmanacTraditionalFact[];
  counterEvidenceFacts: AlmanacCounterEvidenceFact[];
  counterSummaryFact: AlmanacCounterSummaryFact;
  limitations: string[];
  limitationFacts: AlmanacLimitationFact[];
  summaryFact: AlmanacSummaryFact;
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: string[];
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

const TRADITIONAL_FACT_LIMITATION =
  '传统择日资料只用于当前事项的候选比较，不证明现实中的疾病、死亡、灾祸、官非、财损、婚姻或生育结果' as const;
const CALENDAR_FACT_LIMITATION =
  '公历、农历、干支、建除、十二神与冲煞是当前候选日的历法和规则字段，只用于确定比较条件，不单独证明现实吉凶或事项结果' as const;
const HOUR_FACT_LIMITATION =
  '逐时时课只保留时柱、十二神与参与人刑冲破害，不证明该时辰必然成功、吉利或适合所有人' as const;
const RAW_TABOO_FACT_LIMITATION =
  '原始宜忌只保留历书列项及其是否命中当前事项；未列不等于适宜，列出也不等于现实事项必然成功或失败' as const;
const DECISION_FACT_LIMITATION =
  '候选状态只按明确事项忌项、参与人直接关系和可用时辰分组；算法不设置吉凶总分，不把候选等级解释为成功率或现实吉凶保证' as const;
const CALCULATION_STEP_LIMITATION =
  '计算步骤只证明候选范围、历法字段、事项宜忌、神煞、参与人关系、逐时时课与候选分组如何形成当前证据；不证明现实吉凶、成功率、个人结果或必然适宜' as const;
const COUNTER_FACT_LIMITATION =
  '反证事实只表示当前候选存在事项忌项、传统限制、参与人冲突或无可用时辰；不得把单项反证直接写成现实失败、灾祸或必然不宜' as const;
const COUNTER_SUMMARY_LIMITATION =
  '反证汇总只说明候选范围内是否记录明确限制，不代表未见反证的日期现实风险为零，也不得按反证数量生成吉凶总分或失败概率' as const;
const SUMMARY_FACT_LIMITATION =
  '黄历择日证据汇总只统计候选日、分组、逐时时课、传统资料与反证的覆盖情况；不得按数量或候选等级生成吉凶总分、成功率、个人保证或唯一最佳日期' as const;
const LIMITATION_FACT_LIMITATION =
  '限制事实用于约束候选范围、历法、事项宜忌、神煞、参与人、逐时时课、月相与传统资料能够支持的解释范围，不得被反向当作现实吉凶、成功率、个人结果或必然适宜的证据' as const;

const PENGZU_PROMPT_PREFIXES: Array<[RegExp, string]> = [
  [/^甲不开仓/, '甲日传统上避开仓'],
  [/^乙不栽植/, '乙日传统上避栽植'],
  [/^丙不修灶/, '丙日传统上避修灶'],
  [/^丁不剃头/, '丁日传统上避剃头'],
  [/^戊不受田/, '戊日传统上避受田'],
  [/^己不破券/, '己日传统上避破券'],
  [/^庚不经络/, '庚日传统上避经络织作'],
  [/^辛不合酱/, '辛日传统上避合酱'],
  [/^壬不[汲泱]水/, '壬日传统上避汲水'],
  [/^癸不词讼/, '癸日传统上避词讼'],
  [/^子不问卜/, '子日传统上避问卜'],
  [/^丑不冠带/, '丑日传统上避冠带'],
  [/^寅不祭祀/, '寅日传统上避祭祀'],
  [/^卯不穿井/, '卯日传统上避穿井'],
  [/^辰不哭泣/, '辰日传统上避哭泣'],
  [/^巳不远行/, '巳日传统上避远行'],
  [/^午不苫盖/, '午日传统上避苫盖'],
  [/^未不服药/, '未日传统上避服药'],
  [/^申不安床/, '申日传统上避安床'],
  [/^酉不宴客/, '酉日传统上避宴客'],
  [/^戌不吃狗/, '戌日传统上避食犬'],
  [/^亥不嫁娶/, '亥日传统上避嫁娶'],
];

export function conditionAlmanacTraditionalText(text: string): string {
  const pengZuPrompt = PENGZU_PROMPT_PREFIXES.find(([pattern]) => pattern.test(text))?.[1];
  if (pengZuPrompt) {
    return `${pengZuPrompt}；后半句属于传统警语，不作为现实后果保证`;
  }

  return text
    .replace(/犯太岁防宅长大凶/g, '传统方位规则将太岁方列为修造等事项的回避条件')
    .replace(/修太阳能制诸煞(?:，移床此方主添丁)?/g, '传统方位规则将太阳方列为修造、移床的参考方位')
    .replace(/犯丧门主死丧哭泣/g, '传统方位规则将丧门方列为涉及丧葬类象的回避条件')
    .replace(/修太阴主生女，散病患/g, '传统方位规则将太阴方列为修造参考，不据此判断生育或健康结果')
    .replace(/犯官符主口舌官讼/g, '传统方位规则将官符方列为涉及争议与法律事项的回避条件')
    .replace(/犯死符主灾病死亡/g, '传统方位规则将死符方列为涉及健康与安全类象的回避条件')
    .replace(/犯岁破忧宅母/g, '传统方位规则将岁破方列为修造等事项的回避条件')
    .replace(/修龙德能散瘟疫官讼/g, '传统方位规则将龙德方列为修造参考，不据此判断健康或法律结果')
    .replace(/犯白虎主哭泣死亡及小儿凶/g, '传统方位规则将白虎方列为涉及健康与安全类象的回避条件')
    .replace(/修福德主添丁生子/g, '传统方位规则将福德方列为修造参考，不据此判断生育结果')
    .replace(/犯吊客主丧服/g, '传统方位规则将吊客方列为涉及丧葬类象的回避条件')
    .replace(/犯病符主疾病/g, '传统方位规则将病符方列为涉及健康类象的回避条件')
    .replace(/百事不宜，诸事不吉/g, '传统分类列为广泛避忌，仍须按当前事项逐项核验')
    .replace(/百事吉/g, '传统分类偏有利')
    .replace(/诸事吉/g, '传统分类偏有利')
    .replace(/诸事可为/g, '传统分类提示可作为候选')
    .replace(/大凶/g, '传统高风险分类')
    .replace(/主疾病、破财、是非/g, '传统类象涉及健康、财物与争议议题')
    .replace(/主是非、争斗、官非/g, '传统类象涉及争议、冲突与法律议题')
    .replace(/主凶灾、病患/g, '传统类象涉及健康与安全风险议题')
    .replace(/主破财、口舌、盗贼/g, '传统类象涉及财物、沟通与安全议题')
    .replace(/主官贵、文运、财禄/g, '传统类象涉及职位、学业与财务议题')
    .replace(/主文昌、考试、名声/g, '传统类象涉及学业、考试与声誉议题')
    .replace(/主财禄、武职、贵气/g, '传统类象涉及财务、职务与助力议题')
    .replace(/主财运、田宅、吉庆/g, '传统类象涉及财务、房产与喜庆议题')
    .replace(/主喜事、婚姻、文书/g, '传统类象涉及喜庆、婚恋与文书议题')
    .replace(/必然/g, '可能')
    .replace(/必定/g, '较可能');
}

function buildTraditionalFacts(day: AlmanacDayCandidate): AlmanacTraditionalFact[] {
  const facts: AlmanacTraditionalFact[] = [];
  if (day.twentyEightStarDetail) {
    const detail = day.twentyEightStarDetail;
    const originalText = `${detail.fullName}，${detail.zone}方七宿，${detail.fortune}`;
    facts.push({
      key: `${day.date}:twenty-eight-star:${day.twentyEightStar}`,
      date: day.date,
      kind: '二十八宿',
      name: day.twentyEightStar,
      originalText,
      promptText: originalText,
      sources: [detail.source],
      fortune: detail.fortune,
      limitation: TRADITIONAL_FACT_LIMITATION,
    });
  }
  if (day.nineStarDetail) {
    const detail = day.nineStarDetail;
    const originalText = `${detail.fullName}，北斗${detail.dipper}，方位${detail.direction}`;
    facts.push({
      key: `${day.date}:nine-star:${day.nineStar}`,
      date: day.date,
      kind: '九星',
      name: day.nineStar,
      originalText,
      promptText: originalText,
      sources: [detail.source],
      limitation: TRADITIONAL_FACT_LIMITATION,
    });
  }
  (day.annualDirectionGods ?? []).forEach((item) => {
    facts.push({
      key: `${day.date}:direction-god:${item.god}:${item.branch}`,
      date: day.date,
      kind: '全年方位神',
      name: item.god,
      originalText: `${item.god}在${item.branch}${item.direction}`,
      promptText: `${item.god}在${item.branch}${item.direction}；当前只保留方位，不附未经逐条校勘的吉凶断语`,
      sources: ['岁支起太岁顺排十二神方位表'],
      branch: item.branch,
      direction: item.direction,
      limitation: TRADITIONAL_FACT_LIMITATION,
    });
  });
  const separatedPengZu = unique([day.pengZuGan ?? '', day.pengZuZhi ?? '']);
  const pengZuTexts = separatedPengZu.length
    ? separatedPengZu
    : unique(
        day.pengZu
          .split(/\s+/)
          .filter((text) => /^[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]不/.test(text)),
      );
  pengZuTexts.forEach((text, index) => {
    if (!text) return;
    facts.push({
      key: `${day.date}:pengzu:${index}:${text.slice(0, 1)}`,
      date: day.date,
      kind: '彭祖百忌',
      name: text.slice(0, 1),
      originalText: text,
      promptText: conditionAlmanacTraditionalText(text),
      sources: ['彭祖百忌日干日支表'],
      limitation: TRADITIONAL_FACT_LIMITATION,
    });
  });
  return facts;
}

function isDirectConflictNote(note: string): boolean {
  return (
    /(?:候选日地支|时支).*(?:冲|刑|害|破)(?:生肖|年支|日支)/.test(note) ||
    /(?:冲|刑|害|破)(?:生肖|年支|日支)/.test(note)
  );
}

function isDirectParticipantConstraint(fact: AlmanacParticipantRelationFact): boolean {
  return (
    fact.status === '限制' &&
    (fact.basis === '年支' ||
      fact.basis === '日支' ||
      (fact.basis === '整体' && isDirectConflictNote(fact.promptText))) &&
    (fact.relation === '冲' ||
      fact.relation === '刑' ||
      fact.relation === '害' ||
      fact.relation === '破')
  );
}

function getParticipantConstraintTexts(
  facts: AlmanacParticipantRelationFact[] | undefined,
  notes: string[],
): string[] {
  if (facts?.length) {
    return unique(facts.filter((item) => item.status === '限制').map((item) => item.promptText));
  }
  return unique(notes.filter(isDirectConflictNote));
}

function getDirectParticipantConflictTexts(
  facts: AlmanacParticipantRelationFact[] | undefined,
  notes: string[],
): string[] {
  if (facts?.length) {
    return unique(facts.filter(isDirectParticipantConstraint).map((item) => item.promptText));
  }
  return unique(notes.filter(isDirectConflictNote));
}

function getParticipantSupportTexts(
  facts: AlmanacParticipantRelationFact[] | undefined,
  notes: string[],
): string[] {
  if (facts?.length) {
    return unique(facts.filter((item) => item.status === '支持').map((item) => item.promptText));
  }
  return unique(
    notes.filter((item) => /辅助支持|未见.*刑冲破害/.test(item) && !isDirectConflictNote(item)),
  );
}

function isStrongTopicConstraint(fact: AlmanacTopicMatchFact): boolean {
  return (
    fact.status === '限制' &&
    /:topic:(?:day-avoids|rule-day-officer|rule-gods-constraint|day-officer-constraint)$/.test(
      fact.key,
    )
  );
}

function classifyAlmanacHourCandidate(hour: AlmanacHourCandidate): {
  status: AlmanacCandidateStatus;
  strongConstraintTexts: string[];
  constraintTexts: string[];
} {
  const participantConstraints = getParticipantConstraintTexts(
    hour.participantRelationFacts,
    hour.participantNotes,
  );
  const directParticipantConflicts = getDirectParticipantConflictTexts(
    hour.participantRelationFacts,
    hour.participantNotes,
  );
  const strongConstraintTexts = unique([...directParticipantConflicts]);
  const constraintTexts = unique([...hour.cautions, ...participantConstraints]);
  return {
    status: strongConstraintTexts.length
      ? '慎用候选'
      : constraintTexts.length
        ? '条件候选'
        : '可用候选',
    strongConstraintTexts,
    constraintTexts,
  };
}

export function classifyAlmanacCandidate(day: AlmanacDayCandidate): {
  status: AlmanacCandidateStatus;
  strongConstraintTexts: string[];
  constraintTexts: string[];
} {
  const topicConstraints = (day.topicMatchFacts ?? []).filter((item) => item.status === '限制');
  const participantConstraints = getParticipantConstraintTexts(
    day.participantRelationFacts,
    day.participantNotes,
  );
  const directParticipantConflicts = getDirectParticipantConflictTexts(
    day.participantRelationFacts,
    day.participantNotes,
  );
  const strongConstraintTexts = unique([
    ...topicConstraints.filter(isStrongTopicConstraint).map((item) => item.promptText),
    ...directParticipantConflicts,
    ...(day.avoids.includes('诸事不宜') ? ['候选日明列诸事不宜'] : []),
    ...day.cautions.filter((item) =>
      /黄历忌项触及|事项规则限制执日|事项规则触及忌神|执日.*(?:不宜|忌)|诸事不宜/.test(item),
    ),
  ]);
  const hasHourData = Array.isArray(day.hours) && day.hours.length > 0;
  const usableHourCount = hasHourData
    ? day.hours!.filter((hour) => classifyAlmanacHourCandidate(hour).status !== '慎用候选').length
    : 0;
  const constraintTexts = unique([
    ...day.cautions,
    ...topicConstraints.map((item) => item.promptText),
    ...participantConstraints,
    ...(hasHourData && usableHourCount === 0 ? ['未筛出无强冲突时辰'] : []),
  ]);
  return {
    status: strongConstraintTexts.length
      ? '慎用候选'
      : constraintTexts.length
        ? '条件候选'
        : '可用候选',
    strongConstraintTexts,
    constraintTexts,
  };
}

function buildCalendarFact(day: AlmanacDayCandidate): AlmanacCalendarFact {
  const promptText = `${day.weekday}，${day.lunarDate}；年柱${day.ganzhi.year}、月柱${day.ganzhi.month}、日柱${day.ganzhi.day}，生肖${day.zodiac}；建除值日${day.dayOfficer}，十二神${day.twelveStar}，冲煞${day.clash}`;
  return {
    key: `${day.date}:calendar`,
    date: day.date,
    weekday: day.weekday,
    lunarDate: day.lunarDate,
    ganzhi: { ...day.ganzhi },
    zodiac: day.zodiac,
    dayOfficer: day.dayOfficer,
    twelveStar: day.twelveStar,
    clash: day.clash,
    promptText,
    sources: ['tyme4ts 公历、农历与干支历换算', '建除值日、十二神、生肖与冲煞公共规则'],
    limitation: CALENDAR_FACT_LIMITATION,
  };
}

function buildRawTabooFact(params: {
  keyPrefix: string;
  scope: AlmanacRawTabooFact['scope'];
  recommends: string[];
  avoids: string[];
  sources: string[];
}): AlmanacRawTabooFact {
  const recommends = unique(params.recommends);
  const avoids = unique(params.avoids);
  const status = recommends.length
    ? avoids.length
      ? '宜忌均列'
      : '仅列宜项'
    : avoids.length
      ? '仅列忌项'
      : '均未列';
  return {
    key: `${params.keyPrefix}:raw-taboo`,
    scope: params.scope,
    status,
    recommends,
    avoids,
    promptText: `原始宜项${recommends.join('、') || '未列'}；原始忌项${avoids.join('、') || '未列'}`,
    sources: params.sources,
    limitation: RAW_TABOO_FACT_LIMITATION,
  };
}

function buildCompatibleTopicMatchFacts(params: {
  keyPrefix: string;
  scope: AlmanacTopicMatchFact['scope'];
  topic: AlmanacTopic;
  topicLabel: string;
  highlights: string[];
  cautions: string[];
}): AlmanacTopicMatchFact[] {
  const support = params.highlights.filter((item) => /宜项命中|执日.*宜/.test(item));
  const limits = params.cautions.filter((item) => /忌项触及|执日/.test(item));
  return [
    ...support.map((text, index): AlmanacTopicMatchFact => ({
      key: `${params.keyPrefix}:legacy-topic:support:${index}`,
      scope: params.scope,
      topic: params.topic,
      topicLabel: params.topicLabel,
      sourceType: text.includes('执日') ? '建除值日' : '原始宜项',
      status: '支持',
      inputItems: [text],
      keywords: [],
      matchedItems: [text],
      promptText: text,
      sources: ['兼容旧结果中的支持说明；未保存原始关键词匹配参数'],
      limitation:
        '事项命中事实只说明旧结果已记录的支持说明；缺少原始关键词时不反推具体命中项，不证明事项必然成功',
    })),
    ...limits.map((text, index): AlmanacTopicMatchFact => ({
      key: `${params.keyPrefix}:legacy-topic:limit:${index}`,
      scope: params.scope,
      topic: params.topic,
      topicLabel: params.topicLabel,
      sourceType: text.includes('执日') ? '建除值日' : '原始忌项',
      status: '限制',
      inputItems: [text],
      keywords: [],
      matchedItems: [text],
      promptText: text,
      sources: ['兼容旧结果中的限制说明；未保存原始关键词匹配参数'],
      limitation:
        '事项命中事实只说明旧结果已记录的限制说明；缺少原始关键词时不反推具体命中项，不证明事项必然失败',
    })),
  ];
}

function buildCompatibleGodFacts(day: AlmanacDayCandidate): AlmanacGodFact[] {
  return day.gods.map((name, index) => {
    const support = day.highlights.some((item) => item.includes(name));
    const constraint = day.cautions.some((item) => item.includes(name));
    const classification = support ? '吉神' : constraint ? '凶神' : '未分级';
    return {
      key: `${day.date}:legacy-god:${index}:${name}`,
      name,
      classification,
      status: '已读取',
      promptText: `${name}列为${classification}`,
      sources: ['兼容旧结果中的值日神煞与支持、限制说明'],
      limitation:
        '旧结果未保存独立神煞分类参数时，只按已有支持或限制说明归类；未分级不等于吉凶中性，也不证明现实结果',
    };
  });
}

function buildCompatibleParticipantFacts(params: {
  keyPrefix: string;
  scope: AlmanacParticipantRelationFact['scope'];
  candidateValue: string;
  notes: string[];
}): AlmanacParticipantRelationFact[] {
  return params.notes.map((note, index) => {
    const participantName = note.split('：')[0] || `参与人${index + 1}`;
    const isUnused = /不用|未采用/.test(note);
    const isLimit = isDirectConflictNote(note) || /触及忌神|要求喜用.*未命中/.test(note);
    const relationMatch = note.match(/[冲刑害破]/)?.[0] as '冲' | '刑' | '害' | '破' | undefined;
    const relation = isUnused
      ? '未采用'
      : (relationMatch ??
        (isLimit ? '命中' : /未见.*刑冲破害/.test(note) ? '未见直接冲突' : '命中'));
    return {
      key: `${params.keyPrefix}:legacy-participant:${index}`,
      participantId: `legacy:${participantName}`,
      participantName,
      scope: params.scope,
      basis: '整体',
      candidateValue: params.candidateValue,
      participantValues: [],
      relation,
      status: isUnused ? '未采用' : isLimit ? '限制' : /支持/.test(note) ? '支持' : '中性',
      detail: note,
      promptText: note,
      sources: ['兼容旧结果中的参与人说明；未保存逐项关系参数'],
      limitation:
        '旧结果缺少参与人逐项关系参数时只保留原说明，不反推年支、日支或喜忌五行命中细节，也不证明个人结果',
    };
  });
}

function buildHourEvidence(date: string, hour: AlmanacHourCandidate): AlmanacHourEvidence {
  const keyPrefix = `${date}:hour:${hour.ganzhi}:${hour.name}`;
  const participantRelationFacts =
    hour.participantRelationFacts?.map((item) => ({ ...item })) ??
    buildCompatibleParticipantFacts({
      keyPrefix,
      scope: '时辰',
      candidateValue: hour.branch,
      notes: hour.participantNotes,
    });
  const participantSupport = getParticipantSupportTexts(
    participantRelationFacts,
    hour.participantNotes,
  );
  const participantConstraints = getParticipantConstraintTexts(
    participantRelationFacts,
    hour.participantNotes,
  );
  const classification = classifyAlmanacHourCandidate({
    ...hour,
    participantRelationFacts,
  });
  const constraints = unique([...classification.constraintTexts, ...participantConstraints]);
  const support = unique([...hour.highlights, ...participantSupport]);
  const status = classification.status;
  const promptText = `${hour.name}${hour.range}，${hour.ganzhi}（${hour.branch}支）、${hour.twelveStar}；${status}；支持${support.join('、') || '未见额外支持'}；限制${constraints.join('、') || '未见明确冲突'}`;
  return {
    key: keyPrefix,
    name: hour.name,
    range: hour.range,
    ganzhi: hour.ganzhi,
    branch: hour.branch,
    twelveStar: hour.twelveStar,
    status,
    support,
    constraints,
    participantSupport,
    participantRelationFacts,
    promptText,
    sources: ['逐时时柱与十二神计算', '参与人刑冲破害核验'],
    limitation: HOUR_FACT_LIMITATION,
  };
}

function buildCandidateDecisionFact(params: {
  date: string;
  status: AlmanacCandidateStatus;
  rawTabooFact: AlmanacRawTabooFact;
  godFacts: AlmanacGodFact[];
  topicMatchFacts: AlmanacTopicMatchFact[];
  participantRelationFacts: AlmanacParticipantRelationFact[];
  traditionalConstraints: string[];
  strongConstraintTexts: string[];
  usableHours: AlmanacHourEvidence[];
}): AlmanacCandidateDecisionFact {
  const supportingFactKeys = [
    ...params.topicMatchFacts.filter((item) => item.status === '支持').map((item) => item.key),
    ...params.godFacts.filter((item) => item.classification === '吉神').map((item) => item.key),
    ...params.participantRelationFacts
      .filter((item) => item.status === '支持')
      .map((item) => item.key),
  ];
  const limitingFactKeys = [
    ...params.topicMatchFacts.filter((item) => item.status === '限制').map((item) => item.key),
    ...params.godFacts.filter((item) => item.classification === '凶神').map((item) => item.key),
    ...params.participantRelationFacts
      .filter((item) => item.status === '限制')
      .map((item) => item.key),
  ];
  const topicLimitCount = params.topicMatchFacts.filter((item) => item.status === '限制').length;
  const topicSupportCount = params.topicMatchFacts.filter((item) => item.status === '支持').length;
  const participantLimitCount = params.participantRelationFacts.filter(
    (item) => item.status === '限制',
  ).length;
  const strongParticipantFacts = params.participantRelationFacts.filter(
    (item) =>
      item.status === '限制' &&
      (item.relation === '冲' ||
        item.relation === '刑' ||
        item.relation === '害' ||
        item.relation === '破'),
  );
  const steps: AlmanacDecisionStep[] = [
    {
      key: `${params.date}:decision:raw-taboo`,
      stage: '原始宜忌',
      status: params.rawTabooFact.status === '均未列' ? '未提供' : '通过',
      factKeys: [params.rawTabooFact.key],
      inputs: [...params.rawTabooFact.recommends, ...params.rawTabooFact.avoids],
      result: params.rawTabooFact.status,
      promptText: params.rawTabooFact.promptText,
      sources: [...params.rawTabooFact.sources],
    },
    {
      key: `${params.date}:decision:topic`,
      stage: '事项命中',
      status: topicLimitCount
        ? params.strongConstraintTexts.some((item) => /黄历忌项触及|诸事不宜/.test(item))
          ? '触发慎用'
          : '有限制'
        : topicSupportCount
          ? '有支持'
          : params.topicMatchFacts.length
            ? '通过'
            : '未提供',
      factKeys: params.topicMatchFacts.map((item) => item.key),
      inputs: params.topicMatchFacts.flatMap((item) => item.matchedItems),
      result: `支持${topicSupportCount}项，限制${topicLimitCount}项`,
      promptText:
        params.topicMatchFacts.map((item) => item.promptText).join('；') || '未保存事项命中事实',
      sources: unique(params.topicMatchFacts.flatMap((item) => item.sources)),
    },
    {
      key: `${params.date}:decision:gods`,
      stage: '值日神煞',
      status: params.godFacts.some((item) => item.classification === '凶神')
        ? '有限制'
        : params.godFacts.some((item) => item.classification === '吉神')
          ? '有支持'
          : params.godFacts.length
            ? '通过'
            : '未提供',
      factKeys: params.godFacts.map((item) => item.key),
      inputs: params.godFacts.map((item) => item.name),
      result: `吉神${params.godFacts.filter((item) => item.classification === '吉神').length}项，凶神${params.godFacts.filter((item) => item.classification === '凶神').length}项，未分级${params.godFacts.filter((item) => item.classification === '未分级').length}项`,
      promptText: params.godFacts.map((item) => item.promptText).join('；') || '未列值日神煞',
      sources: unique(params.godFacts.flatMap((item) => item.sources)),
    },
    {
      key: `${params.date}:decision:participants`,
      stage: '参与人关系',
      status: participantLimitCount
        ? strongParticipantFacts.length
          ? '触发慎用'
          : '有限制'
        : params.participantRelationFacts.some((item) => item.status === '支持')
          ? '有支持'
          : params.participantRelationFacts.length
            ? '通过'
            : '未提供',
      factKeys: params.participantRelationFacts.map((item) => item.key),
      inputs: params.participantRelationFacts.map((item) => item.candidateValue),
      result: `支持${params.participantRelationFacts.filter((item) => item.status === '支持').length}项，限制${participantLimitCount}项，未采用${params.participantRelationFacts.filter((item) => item.status === '未采用').length}项`,
      promptText:
        params.participantRelationFacts.map((item) => item.promptText).join('；') ||
        '未提供参与人资料，不生成个人适配结论',
      sources: unique(params.participantRelationFacts.flatMap((item) => item.sources)),
    },
    {
      key: `${params.date}:decision:traditional-constraints`,
      stage: '传统限制',
      status: params.strongConstraintTexts.length
        ? '触发慎用'
        : params.traditionalConstraints.length
          ? '有限制'
          : '通过',
      factKeys: [],
      inputs: [...params.traditionalConstraints],
      result: params.strongConstraintTexts.length
        ? `强限制${params.strongConstraintTexts.length}项`
        : params.traditionalConstraints.length
          ? `一般限制${params.traditionalConstraints.length}项`
          : '未见明确传统限制',
      promptText:
        params.traditionalConstraints.join('；') || '未见明确传统限制，不据此保证现实适宜',
      sources: ['当日原始事项忌项与参与人直接关系核验'],
    },
    {
      key: `${params.date}:decision:hours`,
      stage: '可用时辰',
      status: params.usableHours.length ? '通过' : '有限制',
      factKeys: params.usableHours.map((item) => item.key),
      inputs: params.usableHours.map((item) => `${item.name}${item.range}`),
      result: params.usableHours.length
        ? `保留${params.usableHours.length}个无强冲突时辰`
        : '未筛出无强冲突时辰',
      promptText: params.usableHours.length
        ? `可用时辰：${params.usableHours.map((item) => `${item.name}${item.range}`).join('、')}`
        : '未筛出无明显冲突的时辰，不硬指定吉时',
      sources: ['逐时时柱、十二神与参与人关系核验'],
    },
    {
      key: `${params.date}:decision:status`,
      stage: '候选分组',
      status:
        params.status === '慎用候选'
          ? '触发慎用'
          : params.status === '条件候选'
            ? '有限制'
            : supportingFactKeys.length
              ? '有支持'
              : '通过',
      factKeys: [...supportingFactKeys, ...limitingFactKeys],
      inputs: [...params.strongConstraintTexts, ...params.traditionalConstraints],
      result: params.status,
      promptText: params.strongConstraintTexts.length
        ? `存在强限制，归入${params.status}`
        : limitingFactKeys.length || params.traditionalConstraints.length
          ? `存在一般限制，归入${params.status}`
          : `未见明确限制，归入${params.status}`,
      sources: ['黄历候选分组规则'],
    },
  ];
  return {
    key: `${params.date}:decision`,
    date: params.date,
    status: params.status,
    steps,
    supportingFactKeys: unique(supportingFactKeys),
    limitingFactKeys: unique(limitingFactKeys),
    strongConstraintTexts: unique(params.strongConstraintTexts),
    promptText: steps
      .map((item) => `${item.stage === '候选分组' ? '最终状态' : item.stage}：${item.result}`)
      .join(' → '),
    sources: unique(steps.flatMap((item) => item.sources)),
    limitation: DECISION_FACT_LIMITATION,
  };
}

function buildCandidateEvidence(
  day: AlmanacDayCandidate,
  topic: AlmanacTopic,
  topicLabel: string,
): AlmanacCandidateEvidence {
  const moonPhaseEvidence =
    day.moonPhaseEvidence ?? calculateMoonPhaseEvidence(Date.parse(`${day.date}T04:00:00Z`));
  const calendarFact = buildCalendarFact(day);
  const rawTabooFact = buildRawTabooFact({
    keyPrefix: day.date,
    scope: '候选日',
    recommends: day.recommends,
    avoids: day.avoids,
    sources: ['tyme4ts 当日宜忌'],
  });
  const godFacts = day.godFacts?.map((item) => ({ ...item })) ?? buildCompatibleGodFacts(day);
  const topicMatchFacts =
    day.topicMatchFacts?.map((item) => ({ ...item })) ??
    buildCompatibleTopicMatchFacts({
      keyPrefix: day.date,
      scope: '候选日',
      topic,
      topicLabel,
      highlights: day.highlights,
      cautions: day.cautions,
    });
  const participantRelationFacts =
    day.participantRelationFacts?.map((item) => ({ ...item })) ??
    buildCompatibleParticipantFacts({
      keyPrefix: day.date,
      scope: '候选日',
      candidateValue: day.ganzhi.day.slice(-1),
      notes: day.participantNotes,
    });
  const participantConflicts = getDirectParticipantConflictTexts(
    participantRelationFacts,
    day.participantNotes,
  );
  const participantSupport = getParticipantSupportTexts(
    participantRelationFacts,
    day.participantNotes,
  );
  const traditionalConstraints = unique(day.cautions);
  const topicMatches = unique(day.highlights.filter((item) => /宜项命中|执日.*宜/.test(item)));
  const traditionalSupport = unique(day.highlights.filter((item) => !topicMatches.includes(item)));
  const traditionalFacts = buildTraditionalFacts(day);
  const directionConstraints = traditionalFacts
    .filter((item) => item.kind === '全年方位神' && item.fortune === '凶')
    .map((item) => item.promptText);
  const directionFacts = traditionalFacts
    .filter((item) => item.kind === '全年方位神')
    .map((item) => item.promptText);
  const usableHours = (day.hours ?? [])
    .map((hour) => buildHourEvidence(day.date, hour))
    .filter((item) => item.status !== '慎用候选')
    .slice(0, 4);
  const classification = classifyAlmanacCandidate({
    ...day,
    topicMatchFacts,
    participantRelationFacts,
  });
  const strongConstraintTexts = classification.strongConstraintTexts;
  const status = classification.status;
  const decisionFact = buildCandidateDecisionFact({
    date: day.date,
    status,
    rawTabooFact,
    godFacts,
    topicMatchFacts,
    participantRelationFacts,
    traditionalConstraints,
    strongConstraintTexts,
    usableHours,
  });
  return {
    date: day.date,
    status,
    calendarFact,
    rawTabooFact,
    godFacts,
    topicMatchFacts,
    participantRelationFacts,
    decisionFact,
    moonPhaseFact: moonPhaseEvidence,
    astronomicalFacts: [
      `中国标准时间12:00参照月相为${moonPhaseEvidence.eightPhaseName}（${moonPhaseEvidence.waxing ? '盈' : '亏'}），日月黄经差${moonPhaseEvidence.phaseAngleDegrees.toFixed(2)}°，照明约${moonPhaseEvidence.illuminationPercent.toFixed(1)}%`,
      `前一四正相位${moonPhaseEvidence.previousPrincipalPhase.name} ${moonPhaseEvidence.previousPrincipalPhase.utcDateTime}，下一四正相位${moonPhaseEvidence.nextPrincipalPhase.name} ${moonPhaseEvidence.nextPrincipalPhase.utcDateTime}`,
    ],
    calendarFacts: [
      `${day.weekday}，${day.lunarDate}`,
      `年柱${calendarFact.ganzhi.year}、月柱${calendarFact.ganzhi.month}、日柱${calendarFact.ganzhi.day}，生肖${calendarFact.zodiac}`,
      `建除值日${calendarFact.dayOfficer}，十二神${calendarFact.twelveStar}，冲煞${calendarFact.clash}`,
    ],
    traditionalRuleFacts: [
      traditionalFacts.find((item) => item.kind === '二十八宿')
        ? `二十八宿：${traditionalFacts.find((item) => item.kind === '二十八宿')?.promptText}`
        : `二十八宿${day.twentyEightStar}（未附详情）`,
      traditionalFacts.find((item) => item.kind === '九星')
        ? `九星：${traditionalFacts.find((item) => item.kind === '九星')?.promptText}`
        : `九星${day.nineStar}（未附详情）`,
      `值日神煞：${day.gods.join('、') || '未列'}`,
      `原始宜项：${day.recommends.join('、') || '未列'}；原始忌项：${day.avoids.join('、') || '未列'}`,
      `彭祖百忌：${
        traditionalFacts
          .filter((item) => item.kind === '彭祖百忌')
          .map((item) => item.promptText)
          .join('；') || '未列'
      }`,
    ],
    directionFacts,
    topicMatches,
    traditionalSupport,
    traditionalConstraints,
    participantSupport,
    participantConflicts,
    directionConstraints,
    usableHours,
    traditionalFacts,
    limitations: [
      '黄历规则只用于候选范围内的传统择日比较，不替代场地、证件、人员、交通、天气与安全条件',
      ...(usableHours.length ? [] : ['未筛出无明显冲突的时辰，不硬指定吉时']),
    ],
  };
}

function formatMoonPhaseFact(fact: MoonPhaseEvidence) {
  return `中国标准时间12:00参照月相为${fact.eightPhaseName}（${fact.waxing ? '盈' : '亏'}），日月黄经差${fact.phaseAngleDegrees.toFixed(2)}°，照明约${fact.illuminationPercent.toFixed(1)}%；前一四正相位${fact.previousPrincipalPhase.name} ${fact.previousPrincipalPhase.utcDateTime}，下一四正相位${fact.nextPrincipalPhase.name} ${fact.nextPrincipalPhase.utcDateTime}；来源${fact.source}；限制${fact.limitations.join('；')}`;
}

function formatCandidate(item: AlmanacCandidateEvidence) {
  const support = unique([
    ...item.topicMatches,
    ...item.traditionalSupport,
    ...item.participantSupport,
  ]);
  const constraints = unique([
    ...item.traditionalConstraints,
    ...item.participantConflicts,
    ...item.directionConstraints,
  ]);
  const hours = item.usableHours.length
    ? item.usableHours.map((hour) => `${hour.promptText}；边界${hour.limitation}`).join('、')
    : '未筛出无明显冲突时辰';
  const topicFacts = item.topicMatchFacts
    .filter((fact) => fact.status === '支持' || fact.status === '限制')
    .map((fact) => fact.promptText)
    .join('；');
  const godFacts = item.godFacts
    .filter((fact) => fact.classification !== '未分级')
    .map((fact) => fact.promptText)
    .join('；');
  const participantFacts = item.participantRelationFacts
    .filter((fact) => fact.status === '支持' || fact.status === '限制' || fact.status === '未采用')
    .map((fact) => fact.promptText)
    .join('；');
  return `${item.status}；历法事实${item.calendarFact.promptText}；历法边界${item.calendarFact.limitation}；${item.rawTabooFact.promptText}；事项命中${topicFacts || '未见明确支持或限制'}；值日神煞${godFacts || '未见已分级神煞'}；参与人关系${participantFacts || '未提供或未见额外关系'}；状态形成链${item.decisionFact.promptText}；传统规则${item.traditionalRuleFacts.join('；')}；全年方位神${item.directionFacts.join('；') || '未列'}；支持${support.join('、') || '未见独立增强证据'}；限制${constraints.join('、') || '未见明确传统禁忌或参与人冲突'}；天文背景${formatMoonPhaseFact(item.moonPhaseFact)}；时段${hours}`;
}

function collectCandidateFactKeys(candidate: AlmanacCandidateEvidence): string[] {
  return unique([
    candidate.calendarFact.key,
    candidate.rawTabooFact.key,
    ...candidate.godFacts.map((item) => item.key),
    ...candidate.topicMatchFacts.map((item) => item.key),
    ...candidate.participantRelationFacts.map((item) => item.key),
    candidate.decisionFact.key,
    ...candidate.decisionFact.steps.map((item) => item.key),
    candidate.moonPhaseFact.key,
    ...candidate.moonPhaseFact.calculationSteps.map((item) => item.key),
    candidate.moonPhaseFact.eventSummaryFact.key,
    candidate.moonPhaseFact.previousPrincipalPhase.key,
    candidate.moonPhaseFact.nextPrincipalPhase.key,
    ...candidate.usableHours.flatMap((hour) => [
      hour.key,
      ...hour.participantRelationFacts.map((item) => item.key),
    ]),
    ...candidate.traditionalFacts.map((item) => item.key),
  ]);
}

function buildCounterEvidenceFacts(
  candidates: AlmanacCandidateEvidence[],
): AlmanacCounterEvidenceFact[] {
  return candidates.flatMap((candidate) => {
    const facts: AlmanacCounterEvidenceFact[] = [];
    const limitingTexts = unique([
      ...candidate.traditionalConstraints,
      ...candidate.participantConflicts,
      ...candidate.topicMatchFacts
        .filter((item) => item.status === '限制')
        .map((item) => item.promptText),
    ]);
    if (candidate.decisionFact.strongConstraintTexts.length) {
      facts.push({
        key: `almanac:counter:${candidate.date}:strong`,
        date: candidate.date,
        type: '强限制',
        status: '已触发',
        ownerFactKeys: unique([
          candidate.decisionFact.key,
          ...candidate.decisionFact.limitingFactKeys,
        ]),
        promptText: `${candidate.date}存在强限制：${candidate.decisionFact.strongConstraintTexts.join('、')}，已归入${candidate.status}`,
        sources: candidate.decisionFact.sources,
        limitation: COUNTER_FACT_LIMITATION,
      });
    } else if (limitingTexts.length || candidate.decisionFact.limitingFactKeys.length) {
      facts.push({
        key: `almanac:counter:${candidate.date}:limits`,
        date: candidate.date,
        type: '候选限制',
        status: '已触发',
        ownerFactKeys: unique([
          candidate.decisionFact.key,
          ...candidate.decisionFact.limitingFactKeys,
        ]),
        promptText: `${candidate.date}存在一般限制：${limitingTexts.join('、') || '已记录限制事实'}，已归入${candidate.status}`,
        sources: candidate.decisionFact.sources,
        limitation: COUNTER_FACT_LIMITATION,
      });
    }
    if (!candidate.usableHours.length) {
      const hourStep = candidate.decisionFact.steps.find((item) => item.stage === '可用时辰');
      facts.push({
        key: `almanac:counter:${candidate.date}:hours`,
        date: candidate.date,
        type: '无可用时辰',
        status: '已触发',
        ownerFactKeys: unique([candidate.decisionFact.key, hourStep?.key ?? '']),
        promptText: `${candidate.date}未筛出无明显冲突的时辰，不硬指定吉时`,
        sources: hourStep?.sources ?? ['逐时时课筛选结果'],
        limitation: COUNTER_FACT_LIMITATION,
      });
    }
    return facts;
  });
}

function buildSummaryFact(params: {
  candidates: AlmanacCandidateEvidence[];
  preferredDates: string[];
  conditionalDates: string[];
  cautionDates: string[];
  traditionalFacts: AlmanacTraditionalFact[];
  counterSummaryFact: AlmanacCounterSummaryFact;
  counterEvidenceFacts: AlmanacCounterEvidenceFact[];
}): AlmanacSummaryFact {
  const candidateFactKeys = params.candidates.flatMap(collectCandidateFactKeys);
  const status =
    params.candidates.length &&
    params.candidates.every((item) => item.decisionFact.steps.length === 7)
      ? '证据链完整'
      : '候选资料缺失';
  return {
    key: 'almanac:evidence-summary',
    status,
    factKeys: unique([
      ...candidateFactKeys,
      params.counterSummaryFact.key,
      ...params.counterEvidenceFacts.map((item) => item.key),
    ]),
    candidateCount: params.candidates.length,
    visibleCandidateCount: Math.min(params.candidates.length, 8),
    preferredDateCount: params.preferredDates.length,
    conditionalDateCount: params.conditionalDates.length,
    cautionDateCount: params.cautionDates.length,
    usableHourFactCount: params.candidates.reduce(
      (total, item) => total + item.usableHours.length,
      0,
    ),
    traditionalFactCount: params.traditionalFacts.length,
    counterEvidenceCount: params.counterEvidenceFacts.length,
    promptText: `证据链状态：${status}；候选日${params.candidates.length}项，其中可用${params.preferredDates.length}项、有条件${params.conditionalDates.length}项、慎用${params.cautionDates.length}项；保留可用时辰${params.candidates.reduce((total, item) => total + item.usableHours.length, 0)}项、传统资料${params.traditionalFacts.length}项、反证${params.counterEvidenceFacts.length}项`,
    sources: ['全部候选日、历法、事项、神煞、参与人、逐时时课、传统资料与反证逐项汇总'],
    limitation: SUMMARY_FACT_LIMITATION,
  };
}

function buildCalculationSteps(params: {
  data: AlmanacData;
  candidates: AlmanacCandidateEvidence[];
  preferredDates: string[];
  conditionalDates: string[];
  cautionDates: string[];
  hardConstraints: string[];
  realityConstraints: string[];
  summaryFact: AlmanacSummaryFact;
}): AlmanacEvidenceCalculationStep[] {
  const candidateCount = params.candidates.length;
  const topicFactCount = params.candidates.reduce(
    (total, item) => total + item.topicMatchFacts.length,
    0,
  );
  const godFactCount = params.candidates.reduce((total, item) => total + item.godFacts.length, 0);
  const participantFactCount = params.candidates.reduce(
    (total, item) => total + item.participantRelationFacts.length,
    0,
  );
  const usableHourFactCount = params.candidates.reduce(
    (total, item) => total + item.usableHours.length,
    0,
  );
  return [
    {
      key: 'almanac:calculation:scope',
      stage: '候选范围核验',
      status: candidateCount ? '已计算' : '资料不足',
      inputs: {
        startDate: params.data.startDate,
        endDate: params.data.endDate,
        topic: params.data.topic,
        topicLabel: params.data.topicLabel,
      },
      result: { candidateCount },
      dependsOnStepKeys: [],
      promptText: `限定${params.data.startDate}至${params.data.endDate}，按${params.data.topicLabel}建立${candidateCount}个候选日`,
      sources: ['用户日期范围与事项类型', '黄历候选日生成结果'],
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'almanac:calculation:calendar',
      stage: '逐日历法核验',
      status:
        candidateCount && params.candidates.every((item) => item.calendarFact && item.moonPhaseFact)
          ? '已计算'
          : '资料不足',
      inputs: { candidateCount },
      result: {
        calendarFactCount: params.candidates.length,
        moonPhaseFactCount: params.candidates.length,
      },
      dependsOnStepKeys: ['almanac:calculation:scope'],
      promptText: `逐日保存公农历、干支、建除、十二神、冲煞与中国标准时间正午月相，共${candidateCount}日`,
      sources: unique([
        '逐日历法与月相资料完整性检查',
        ...params.candidates.flatMap((item) => [
          ...item.calendarFact.sources,
          item.moonPhaseFact.source,
        ]),
      ]),
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'almanac:calculation:topic-gods',
      stage: '事项与神煞核验',
      status: candidateCount ? '已计算' : '资料不足',
      inputs: { candidateCount, topicLabel: params.data.topicLabel },
      result: { topicFactCount, godFactCount },
      dependsOnStepKeys: ['almanac:calculation:calendar'],
      promptText: `逐日核验原始宜忌、当前事项命中与值日神煞，形成事项事实${topicFactCount}项、神煞事实${godFactCount}项`,
      sources: unique([
        '当前事项宜忌与值日神煞完整性检查',
        ...params.candidates.flatMap((item) => [
          ...item.rawTabooFact.sources,
          ...item.topicMatchFacts.flatMap((fact) => fact.sources),
          ...item.godFacts.flatMap((fact) => fact.sources),
        ]),
      ]),
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'almanac:calculation:participants-reality',
      stage: '参与人与现实约束核验',
      status: candidateCount ? '已计算' : '资料不足',
      inputs: { candidateCount, hardConstraints: params.hardConstraints },
      result: {
        participantFactCount,
        realityConstraintCount: params.realityConstraints.length,
      },
      dependsOnStepKeys: ['almanac:calculation:topic-gods'],
      promptText: participantFactCount
        ? `已记录参与人逐项关系${participantFactCount}项，并保留${params.realityConstraints.length}项现实约束`
        : `未提供参与人资料，不生成个人适配结论；保留${params.realityConstraints.length}项现实约束待核验`,
      sources: unique([
        ...params.candidates.flatMap((item) =>
          item.participantRelationFacts.flatMap((fact) => fact.sources),
        ),
        '用户参与人资料与现实条件边界',
      ]),
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'almanac:calculation:hours',
      stage: '逐时时课核验',
      status: candidateCount ? '已计算' : '资料不足',
      inputs: { candidateCount },
      result: { usableHourFactCount },
      dependsOnStepKeys: ['almanac:calculation:participants-reality'],
      promptText: `逐日比较时柱、十二神与参与人关系，保留${usableHourFactCount}个无强冲突时辰；未筛出时不硬指定吉时`,
      sources: unique([
        '逐时时柱、十二神与参与人关系完整性检查',
        ...params.candidates.flatMap((item) => item.usableHours.flatMap((hour) => hour.sources)),
      ]),
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'almanac:calculation:grouping',
      stage: '候选分组核验',
      status:
        candidateCount && params.candidates.every((item) => item.decisionFact.steps.length === 7)
          ? '已计算'
          : '资料不足',
      inputs: { candidateCount },
      result: {
        preferredDateCount: params.preferredDates.length,
        conditionalDateCount: params.conditionalDates.length,
        cautionDateCount: params.cautionDates.length,
      },
      dependsOnStepKeys: ['almanac:calculation:hours'],
      promptText: `按明确忌项、传统限制、参与人冲突与可用时辰分组：可用${params.preferredDates.length}项、有条件${params.conditionalDates.length}项、慎用${params.cautionDates.length}项`,
      sources: unique([
        '候选日七步状态形成链完整性检查',
        ...params.candidates.flatMap((item) => item.decisionFact.sources),
      ]),
      limitation: CALCULATION_STEP_LIMITATION,
    },
    {
      key: 'almanac:calculation:summary',
      stage: '证据汇总',
      status: params.summaryFact.status === '证据链完整' ? '已计算' : '资料不足',
      inputs: { factCount: params.summaryFact.factKeys.length },
      result: {
        summaryStatus: params.summaryFact.status,
        candidateCount: params.summaryFact.candidateCount,
        usableHourFactCount: params.summaryFact.usableHourFactCount,
        traditionalFactCount: params.summaryFact.traditionalFactCount,
        counterEvidenceCount: params.summaryFact.counterEvidenceCount,
      },
      dependsOnStepKeys: [
        'almanac:calculation:scope',
        'almanac:calculation:calendar',
        'almanac:calculation:topic-gods',
        'almanac:calculation:participants-reality',
        'almanac:calculation:hours',
        'almanac:calculation:grouping',
      ],
      promptText: params.summaryFact.promptText,
      sources: params.summaryFact.sources,
      limitation: CALCULATION_STEP_LIMITATION,
    },
  ];
}

function buildLimitationFacts(params: {
  candidates: AlmanacCandidateEvidence[];
  counterSummaryFact: AlmanacCounterSummaryFact;
  counterEvidenceFacts: AlmanacCounterEvidenceFact[];
  summaryFact: AlmanacSummaryFact;
}): AlmanacLimitationFact[] {
  const candidateDecisionKeys = params.candidates.map((item) => item.decisionFact.key);
  const definitions: Array<
    Pick<AlmanacLimitationFact, 'key' | 'type' | 'ownerFactKeys' | 'promptText' | 'sources'>
  > = [
    {
      key: 'almanac:limitation:scope-calendar',
      type: '候选范围与历法边界',
      ownerFactKeys: unique([
        params.summaryFact.key,
        ...params.candidates.flatMap((item) => [item.calendarFact.key, item.moonPhaseFact.key]),
      ]),
      promptText:
        '只比较用户给定日期范围和事项；公农历、干支、建除、十二神、冲煞与月相只确定候选的历法和天文背景，不单独证明现实吉凶或事项结果',
      sources: ['候选范围、逐日历法事实与月相背景'],
    },
    {
      key: 'almanac:limitation:topic-gods',
      type: '事项宜忌与神煞边界',
      ownerFactKeys: unique([
        ...candidateDecisionKeys,
        ...params.candidates.flatMap((item) => [
          item.rawTabooFact.key,
          ...item.topicMatchFacts.map((fact) => fact.key),
          ...item.godFacts.map((fact) => fact.key),
        ]),
      ]),
      promptText:
        '原始宜忌只保留历书列项，事项命中和神煞分类只用于当前事项比较；未列不等于适宜，命中也不等于现实必然成功或失败',
      sources: ['原始宜忌、事项关键词命中与值日神煞事实'],
    },
    {
      key: 'almanac:limitation:participants',
      type: '参与人适配边界',
      ownerFactKeys: unique([
        ...candidateDecisionKeys,
        ...params.candidates.flatMap((item) =>
          item.participantRelationFacts.map((fact) => fact.key),
        ),
      ]),
      promptText:
        '参与人关系只核验已提供资料中的年支、日支、喜用五行与候选日时关系；没有参与人资料时不得编造个人适配结论，已有关系也不证明个人现实结果',
      sources: ['参与人出生资料与逐日逐时关系事实'],
    },
    {
      key: 'almanac:limitation:hours-grouping',
      type: '逐时时课与分组边界',
      ownerFactKeys: unique([
        ...candidateDecisionKeys,
        ...params.candidates.flatMap((item) => [
          ...item.decisionFact.steps.map((step) => step.key),
          ...item.usableHours.flatMap((hour) => [
            hour.key,
            ...hour.participantRelationFacts.map((fact) => fact.key),
          ]),
        ]),
      ]),
      promptText:
        '逐时时课只用于候选日内比较，候选状态只按明确忌项、参与人直接关系和可用时辰分组；算法不设置吉凶总分，不把候选等级解释为成功率、现实吉凶保证或唯一最佳日期',
      sources: ['逐时时课事实与七步候选状态形成链'],
    },
    {
      key: 'almanac:limitation:astronomy-tradition',
      type: '天文与传统资料边界',
      ownerFactKeys: unique([
        ...params.candidates.flatMap((item) => [
          item.moonPhaseFact.key,
          ...item.traditionalFacts.map((fact) => fact.key),
        ]),
      ]),
      promptText:
        '月相只作为中国标准时间正午的天文背景，不参与候选排序；二十八宿、九星、全年方位神和彭祖百忌属于传统比较资料，不证明疾病、死亡、灾祸、官非、财损、婚姻或生育结果',
      sources: ['逐日月相、二十八宿、九星、全年方位神与彭祖百忌事实'],
    },
    {
      key: 'almanac:limitation:reality-high-risk',
      type: '现实与高风险输出边界',
      ownerFactKeys: unique([
        params.summaryFact.key,
        params.counterSummaryFact.key,
        ...params.counterEvidenceFacts.map((item) => item.key),
      ]),
      promptText:
        '候选顺序只表示当前规则集下的比较结果；现实条件未提供时只列待核验项，场地、证件、人员、交通、预算、天气、办理窗口与安全要求优先；传统冲突不合成为成功率或吉凶总分，也不得宣称某日必然适合',
      sources: ['证据汇总、反证汇总与现实刚性约束'],
    },
  ];
  return definitions.map((item) => ({
    ...item,
    ownerFactKeys: item.ownerFactKeys.length ? item.ownerFactKeys : [params.summaryFact.key],
    status: '适用',
    limitation: LIMITATION_FACT_LIMITATION,
  }));
}

export function analyzeAlmanacEvidence(data: AlmanacData): AlmanacEvidenceAnalysis {
  const candidates = data.days.map((day) =>
    buildCandidateEvidence(day, data.topic, data.topicLabel),
  );
  const traditionalFacts = candidates.flatMap((item) => item.traditionalFacts);
  const preferredDates = candidates
    .filter((item) => item.status === '可用候选')
    .map((item) => item.date);
  const conditionalDates = candidates
    .filter((item) => item.status === '条件候选')
    .map((item) => item.date);
  const cautionDates = candidates
    .filter((item) => item.status === '慎用候选')
    .map((item) => item.date);
  const hardConstraints = unique([
    `只比较${data.startDate}至${data.endDate}范围内的候选日期`,
    `事项限定为${data.topicLabel}，不得把其他事项宜忌直接替代当前事项规则`,
    '命中当前事项明确忌项、诸事不宜或参与人直接刑冲破害时列为慎用候选；同组仅按明确宜项数量和日期稳定排列',
    '没有参与人资料时不得编造个人适配结论',
  ]);
  const realityConstraints = [
    '场地、证件、人员到场、交通、预算、天气、办理窗口与安全要求优先于传统排序',
    '现实条件未提供时只列待核验项，不假设其已经满足',
    '传统规则互相冲突时并列展示支持与限制，不合成为成功率或吉凶总分',
    '月相只作为中国标准时间正午的天文背景，不参与候选排序；其他时区或临近朔弦望时刻应按实际地点时间另算',
  ];
  const counterEvidenceFacts = buildCounterEvidenceFacts(candidates);
  const counterSummaryFact: AlmanacCounterSummaryFact = {
    key: 'almanac:counter-summary',
    status: counterEvidenceFacts.length ? '有明确反证' : '未见明确反证',
    factKeys: counterEvidenceFacts.map((item) => item.key),
    promptText: counterEvidenceFacts.length
      ? `候选范围内共记录${counterEvidenceFacts.length}项明确限制，须与可用条件并列展示`
      : '候选范围内未见明确事项忌项、参与人冲突或无可用时辰记录；不代表现实风险为零',
    sources: ['各候选日七步状态形成链与逐时时课筛选结果'],
    limitation: COUNTER_SUMMARY_LIMITATION,
  };
  const summaryFact = buildSummaryFact({
    candidates,
    preferredDates,
    conditionalDates,
    cautionDates,
    traditionalFacts,
    counterSummaryFact,
    counterEvidenceFacts,
  });
  const calculationSteps = buildCalculationSteps({
    data,
    candidates,
    preferredDates,
    conditionalDates,
    cautionDates,
    hardConstraints,
    realityConstraints,
    summaryFact,
  });
  summaryFact.factKeys = unique([
    ...calculationSteps.map((item) => item.key),
    ...summaryFact.factKeys,
  ]);
  const calculationChain = calculationSteps.map((item) => item.promptText);
  const limitationFacts = buildLimitationFacts({
    candidates,
    counterSummaryFact,
    counterEvidenceFacts,
    summaryFact,
  });
  const limitations = limitationFacts.map((item) => item.promptText);
  const visibleCandidates = candidates.slice(0, 8);
  const items: PromptEvidenceItem[] = [
    {
      level: calculationSteps.some((item) => item.status === '资料不足') ? '反证' : '辅证',
      title: '黄历择日计算链',
      detail: `${calculationChain.join('；')}；统一边界：${CALCULATION_STEP_LIMITATION}`,
      source: unique(calculationSteps.flatMap((item) => item.sources)).join('、'),
      tags: ['计算链', summaryFact.status, data.topicLabel],
    },
    ...visibleCandidates.map((item, index): PromptEvidenceItem => ({
      level:
        item.status === '慎用候选'
          ? '反证'
          : index === 0 && item.status === '可用候选'
            ? '主证'
            : '辅证',
      title: `${item.date}${item.status}`,
      detail: formatCandidate(item),
      source: `${item.calendarFact.sources.join('、')}；二十八宿、九星、彭祖百忌、全年方位神、事项宜忌、参与人刑冲破害；${item.usableHours[0]?.sources.join('、') ?? '逐时时课'}；月相取中国标准时间正午的celestine日月黄经`,
      tags: [item.status, data.topicLabel],
    })),
    {
      level: counterSummaryFact.status === '有明确反证' ? '反证' : '辅证',
      title: '黄历候选反证汇总',
      detail: `${counterSummaryFact.promptText}；边界：${counterSummaryFact.limitation}`,
      source: counterSummaryFact.sources.join('、'),
      tags: ['反证汇总', counterSummaryFact.status],
    },
    {
      level: '辅证',
      title: `黄历择日证据汇总：${summaryFact.status}`,
      detail: `${summaryFact.promptText}；边界：${summaryFact.limitation}`,
      source: summaryFact.sources.join('、'),
      tags: ['证据汇总', summaryFact.status],
    },
    {
      level: '限制',
      title: '择日证据边界',
      detail: `${limitations.join('；')}；统一边界：${LIMITATION_FACT_LIMITATION}`,
      source: unique(limitationFacts.flatMap((item) => item.sources)).join('、'),
    },
  ];
  const evidence: PromptEvidenceBundle = { title: '黄历择日透明约束与候选证据', items };
  const promptText = [
    '【黄历择日透明约束与候选证据】',
    ...formatPromptEvidenceBundle(evidence),
    `传统硬限制：${hardConstraints.join('；')}`,
    `现实约束：${realityConstraints.join('；')}`,
    `候选分组：可用${preferredDates.join('、') || '暂无'}；有条件${conditionalDates.join('、') || '暂无'}；慎用${cautionDates.join('、') || '暂无'}`,
    `计算链：${calculationChain.join(' → ')}`,
    `反证汇总：${counterSummaryFact.promptText}；边界：${counterSummaryFact.limitation}`,
    `证据汇总：${summaryFact.promptText}。`,
    `解释限制：${limitations.join('；')}。`,
  ].join('\n');
  return {
    key: 'almanac:evidence',
    status: '已计算',
    calculationSteps,
    calculationChain,
    candidates,
    preferredDates,
    conditionalDates,
    cautionDates,
    hardConstraints,
    realityConstraints,
    traditionalFacts,
    counterEvidenceFacts,
    counterSummaryFact,
    limitations,
    limitationFacts,
    summaryFact,
    evidence,
    promptText,
    methodology: [
      '先按日期范围和事项限定建立候选集。',
      '再逐日核验事项宜忌、建除神煞、参与人刑冲破害和可用时辰。',
      '同时附加中国标准时间正午的日月黄经月相事实，但不据此自动增减传统候选等级。',
      '明确忌项或直接冲突进入慎用组，其他限制进入条件组，不以总分覆盖反证。',
      '最后叠加现实刚性约束；不输出吉凶总分、成功率或必然结论。',
    ],
  };
}
