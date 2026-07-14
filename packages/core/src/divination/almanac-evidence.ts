import type { AlmanacData, AlmanacDayCandidate, AlmanacHourCandidate } from '../types/divination';
import {
  calculateMoonPhaseEvidence,
  type MoonPhaseEvidence,
} from '../calendar/moon-phase-evidence';
import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';

export type AlmanacCandidateStatus = '可用候选' | '条件候选' | '慎用候选';

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
  recommends: string[];
  avoids: string[];
  support: string[];
  constraints: string[];
  participantSupport: string[];
  promptText: string;
  sources: string[];
  limitation: '逐时时课只用于当前候选日内比较事项宜忌、十二神与参与人冲突，不证明该时辰必然成功、吉利或适合所有人';
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

export interface AlmanacEvidenceAnalysis {
  candidates: AlmanacCandidateEvidence[];
  preferredDates: string[];
  conditionalDates: string[];
  cautionDates: string[];
  hardConstraints: string[];
  realityConstraints: string[];
  traditionalFacts: AlmanacTraditionalFact[];
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
  '逐时时课只用于当前候选日内比较事项宜忌、十二神与参与人冲突，不证明该时辰必然成功、吉利或适合所有人' as const;

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
    facts.push({
      key: `${day.date}:twenty-eight-star:${day.twentyEightStar}`,
      date: day.date,
      kind: '二十八宿',
      name: day.twentyEightStar,
      originalText: day.twentyEightStarDetail.meaning,
      promptText: `${day.twentyEightStar}宿五行${day.twentyEightStarDetail.wuxing}，传统属性${day.twentyEightStarDetail.fortune}；${conditionAlmanacTraditionalText(day.twentyEightStarDetail.meaning)}`,
      sources: ['《象吉通书》卷一二十八宿值日、清代《择日全纪》'],
      fortune: day.twentyEightStarDetail.fortune,
      limitation: TRADITIONAL_FACT_LIMITATION,
    });
  }
  if (day.nineStarDetail) {
    facts.push({
      key: `${day.date}:nine-star:${day.nineStar}`,
      date: day.date,
      kind: '九星',
      name: day.nineStar,
      originalText: day.nineStarDetail.meaning,
      promptText: `${day.nineStar}五行${day.nineStarDetail.wuxing}，传统属性${day.nineStarDetail.fortune}；${conditionAlmanacTraditionalText(day.nineStarDetail.meaning)}`,
      sources: ['传统紫白九星值日表'],
      fortune: day.nineStarDetail.fortune,
      limitation: TRADITIONAL_FACT_LIMITATION,
    });
  }
  (day.annualDirectionGods ?? []).forEach((item) => {
    facts.push({
      key: `${day.date}:direction-god:${item.god}:${item.branch}`,
      date: day.date,
      kind: '全年方位神',
      name: item.god,
      originalText: item.meaning,
      promptText: `${item.god}在${item.branch}${item.direction}，传统属性${item.fortune}；${conditionAlmanacTraditionalText(item.meaning)}`,
      sources: ['岁支起太岁顺排十二神方位表'],
      fortune: item.fortune,
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

function isConflictNote(note: string) {
  return /冲|刑|害|破|忌|不宜|避/.test(note) && !/未见|未冲|不冲|无明显/.test(note);
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

function buildHourEvidence(date: string, hour: AlmanacHourCandidate): AlmanacHourEvidence {
  const participantSupport = unique(hour.participantNotes.filter((item) => !isConflictNote(item)));
  const constraints = unique([
    ...hour.cautions,
    ...hour.participantNotes.filter(isConflictNote),
    ...(hour.avoids.includes('诸事不宜') ? ['时辰明列诸事不宜'] : []),
  ]);
  const support = unique([...hour.highlights, ...participantSupport]);
  const status: AlmanacCandidateStatus = constraints.some((item) =>
    /诸事不宜|忌项触及|冲|刑|害|破/.test(item),
  )
    ? '慎用候选'
    : constraints.length
      ? '条件候选'
      : '可用候选';
  const recommends = unique(hour.recommends);
  const avoids = unique(hour.avoids);
  const promptText = `${hour.name}${hour.range}，${hour.ganzhi}（${hour.branch}支）、${hour.twelveStar}；${status}；宜${recommends.join('、') || '未列'}；忌${avoids.join('、') || '未列'}；支持${support.join('、') || '未见额外支持'}；限制${constraints.join('、') || '未见明确冲突'}`;
  return {
    key: `${date}:hour:${hour.ganzhi}:${hour.name}`,
    name: hour.name,
    range: hour.range,
    ganzhi: hour.ganzhi,
    branch: hour.branch,
    twelveStar: hour.twelveStar,
    status,
    recommends,
    avoids,
    support,
    constraints,
    participantSupport,
    promptText,
    sources: ['逐时时柱与十二神计算', '当前事项时辰宜忌与参与人刑冲破害核验'],
    limitation: HOUR_FACT_LIMITATION,
  };
}

function buildCandidateEvidence(day: AlmanacDayCandidate): AlmanacCandidateEvidence {
  const moonPhaseEvidence =
    day.moonPhaseEvidence ?? calculateMoonPhaseEvidence(Date.parse(`${day.date}T04:00:00Z`));
  const participantConflicts = unique(day.participantNotes.filter(isConflictNote));
  const participantSupport = unique(day.participantNotes.filter((item) => !isConflictNote(item)));
  const calendarFact = buildCalendarFact(day);
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
  const strongConstraint = [...traditionalConstraints, ...participantConflicts].some((item) =>
    /黄历忌项触及|诸事不宜|六冲|相刑|相害|相破|岁破/.test(item),
  );
  const status: AlmanacCandidateStatus = strongConstraint
    ? '慎用候选'
    : traditionalConstraints.length || participantConflicts.length
      ? '条件候选'
      : '可用候选';
  const usableHours = (day.hours ?? [])
    .map((hour) => buildHourEvidence(day.date, hour))
    .filter((item) => item.status !== '慎用候选')
    .slice(0, 4);
  return {
    date: day.date,
    status,
    calendarFact,
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
  return `${item.status}；历法事实${item.calendarFact.promptText}；历法边界${item.calendarFact.limitation}；传统规则${item.traditionalRuleFacts.join('；')}；全年方位神${item.directionFacts.join('；') || '未列'}；支持${support.join('、') || '未见独立增强证据'}；限制${constraints.join('、') || '未见明确传统禁忌或参与人冲突'}；天文背景${formatMoonPhaseFact(item.moonPhaseFact)}；时段${hours}`;
}

export function analyzeAlmanacEvidence(data: AlmanacData): AlmanacEvidenceAnalysis {
  const candidates = data.days.map(buildCandidateEvidence);
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
    '命中当前事项明确忌项、诸事不宜或参与人直接刑冲破害时列为慎用候选，不因内部排序靠前而覆盖',
    '没有参与人资料时不得编造个人适配结论',
  ]);
  const realityConstraints = [
    '场地、证件、人员到场、交通、预算、天气、办理窗口与安全要求优先于传统排序',
    '现实条件未提供时只列待核验项，不假设其已经满足',
    '传统规则互相冲突时并列展示支持与限制，不合成为成功率或吉凶总分',
    '月相只作为中国标准时间正午的天文背景，不参与候选排序；其他时区或临近朔弦望时刻应按实际地点时间另算',
  ];
  const visibleCandidates = candidates.slice(0, 8);
  const items: PromptEvidenceItem[] = [
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
      level: '限制',
      title: '择日证据边界',
      detail:
        '候选顺序只表示当前规则集下的比较结果。不得展示内部评分作为吉凶强度，不得把高分解释成成功率，也不得在现实硬约束未知时宣称某日必然适合。',
      source: '计算事实与解释结论分离原则',
    },
  ];
  const evidence: PromptEvidenceBundle = { title: '黄历择日透明约束与候选证据', items };
  const promptText = [
    '【黄历择日透明约束与候选证据】',
    ...formatPromptEvidenceBundle(evidence),
    `传统硬限制：${hardConstraints.join('；')}`,
    `现实约束：${realityConstraints.join('；')}`,
    `候选分组：可用${preferredDates.join('、') || '暂无'}；有条件${conditionalDates.join('、') || '暂无'}；慎用${cautionDates.join('、') || '暂无'}`,
  ].join('\n');
  return {
    candidates,
    preferredDates,
    conditionalDates,
    cautionDates,
    hardConstraints,
    realityConstraints,
    traditionalFacts,
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
