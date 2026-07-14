import type { AlmanacData, AlmanacDayCandidate, AlmanacHourCandidate } from '../types/divination';
import { calculateMoonPhaseEvidence } from '../calendar/moon-phase-evidence';
import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';

export type AlmanacCandidateStatus = '可用候选' | '条件候选' | '慎用候选';

export interface AlmanacHourEvidence {
  name: string;
  range: string;
  ganzhi: string;
  twelveStar: string;
  status: AlmanacCandidateStatus;
  recommends: string[];
  avoids: string[];
  support: string[];
  constraints: string[];
  participantSupport: string[];
}

export interface AlmanacCandidateEvidence {
  date: string;
  status: AlmanacCandidateStatus;
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
  limitations: string[];
}

export interface AlmanacEvidenceAnalysis {
  candidates: AlmanacCandidateEvidence[];
  preferredDates: string[];
  conditionalDates: string[];
  cautionDates: string[];
  hardConstraints: string[];
  realityConstraints: string[];
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: string[];
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function isConflictNote(note: string) {
  return /冲|刑|害|破|忌|不宜|避/.test(note) && !/未见|未冲|不冲|无明显/.test(note);
}

function buildHourEvidence(hour: AlmanacHourCandidate): AlmanacHourEvidence {
  const participantSupport = unique(hour.participantNotes.filter((item) => !isConflictNote(item)));
  const constraints = unique([
    ...hour.cautions,
    ...hour.participantNotes.filter(isConflictNote),
    ...(hour.avoids.includes('诸事不宜') ? ['时辰明列诸事不宜'] : []),
  ]);
  const support = unique([...hour.highlights, ...participantSupport]);
  return {
    name: hour.name,
    range: hour.range,
    ganzhi: hour.ganzhi,
    twelveStar: hour.twelveStar,
    status: constraints.some((item) => /诸事不宜|忌项触及|冲|刑|害|破/.test(item))
      ? '慎用候选'
      : constraints.length
        ? '条件候选'
        : '可用候选',
    recommends: unique(hour.recommends),
    avoids: unique(hour.avoids),
    support,
    constraints,
    participantSupport,
  };
}

function buildCandidateEvidence(day: AlmanacDayCandidate): AlmanacCandidateEvidence {
  const moonPhaseEvidence =
    day.moonPhaseEvidence ?? calculateMoonPhaseEvidence(Date.parse(`${day.date}T04:00:00Z`));
  const participantConflicts = unique(day.participantNotes.filter(isConflictNote));
  const participantSupport = unique(day.participantNotes.filter((item) => !isConflictNote(item)));
  const traditionalConstraints = unique(day.cautions);
  const topicMatches = unique(day.highlights.filter((item) => /宜项命中|执日.*宜/.test(item)));
  const traditionalSupport = unique(day.highlights.filter((item) => !topicMatches.includes(item)));
  const directionConstraints = unique(
    (day.annualDirectionGods ?? [])
      .filter((item) => item.fortune === '凶')
      .map((item) => `${item.god}在${item.branch}${item.direction}：${item.meaning}`),
  );
  const directionFacts = unique(
    (day.annualDirectionGods ?? []).map(
      (item) => `${item.god}在${item.branch}${item.direction}（${item.fortune}）：${item.meaning}`,
    ),
  );
  const strongConstraint = [...traditionalConstraints, ...participantConflicts].some((item) =>
    /黄历忌项触及|诸事不宜|六冲|相刑|相害|相破|岁破/.test(item),
  );
  const status: AlmanacCandidateStatus = strongConstraint
    ? '慎用候选'
    : traditionalConstraints.length || participantConflicts.length
      ? '条件候选'
      : '可用候选';
  const usableHours = (day.hours ?? [])
    .map(buildHourEvidence)
    .filter((item) => item.status !== '慎用候选')
    .slice(0, 4);
  return {
    date: day.date,
    status,
    astronomicalFacts: [
      `中国标准时间12:00参照月相为${moonPhaseEvidence.eightPhaseName}（${moonPhaseEvidence.waxing ? '盈' : '亏'}），日月黄经差${moonPhaseEvidence.phaseAngleDegrees.toFixed(2)}°，照明约${moonPhaseEvidence.illuminationPercent.toFixed(1)}%`,
      `前一四正相位${moonPhaseEvidence.previousPrincipalPhase.name} ${moonPhaseEvidence.previousPrincipalPhase.utcDateTime}，下一四正相位${moonPhaseEvidence.nextPrincipalPhase.name} ${moonPhaseEvidence.nextPrincipalPhase.utcDateTime}`,
    ],
    calendarFacts: [
      `${day.weekday}，${day.lunarDate}`,
      `年柱${day.ganzhi.year}、月柱${day.ganzhi.month}、日柱${day.ganzhi.day}，生肖${day.zodiac}`,
      `建除值日${day.dayOfficer}，十二神${day.twelveStar}，冲煞${day.clash}`,
    ],
    traditionalRuleFacts: [
      `二十八宿${day.twentyEightStar}${day.twentyEightStarDetail ? `（五行${day.twentyEightStarDetail.wuxing}、传统属性${day.twentyEightStarDetail.fortune}：${day.twentyEightStarDetail.meaning}）` : '（未附详情）'}`,
      `九星${day.nineStar}${day.nineStarDetail ? `（五行${day.nineStarDetail.wuxing}、传统属性${day.nineStarDetail.fortune}：${day.nineStarDetail.meaning}）` : '（未附详情）'}`,
      `值日神煞：${day.gods.join('、') || '未列'}`,
      `原始宜项：${day.recommends.join('、') || '未列'}；原始忌项：${day.avoids.join('、') || '未列'}`,
      `彭祖百忌：${unique([day.pengZu, day.pengZuGan ?? '', day.pengZuZhi ?? '']).join('；') || '未列'}`,
    ],
    directionFacts,
    topicMatches,
    traditionalSupport,
    traditionalConstraints,
    participantSupport,
    participantConflicts,
    directionConstraints,
    usableHours,
    limitations: [
      '黄历规则只用于候选范围内的传统择日比较，不替代场地、证件、人员、交通、天气与安全条件',
      ...(usableHours.length ? [] : ['未筛出无明显冲突的时辰，不硬指定吉时']),
    ],
  };
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
    ? item.usableHours
        .map(
          (hour) =>
            `${hour.name}${hour.range}（${hour.ganzhi}、${hour.twelveStar}；宜${hour.recommends.join('、') || '未列'}；忌${hour.avoids.join('、') || '未列'}；支持${hour.support.join('、') || '未见额外支持'}；限制${hour.constraints.join('、') || '未见明确冲突'}）`,
        )
        .join('、')
    : '未筛出无明显冲突时辰';
  return `${item.status}；历法事实${item.calendarFacts.join('；')}；传统规则${item.traditionalRuleFacts.join('；')}；全年方位神${item.directionFacts.join('；') || '未列'}；支持${support.join('、') || '未见独立增强证据'}；限制${constraints.join('、') || '未见明确传统禁忌或参与人冲突'}；天文背景${item.astronomicalFacts.join('；')}；时段${hours}`;
}

export function analyzeAlmanacEvidence(data: AlmanacData): AlmanacEvidenceAnalysis {
  const candidates = data.days.map(buildCandidateEvidence);
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
      source:
        '干支历、建除、十二神、二十八宿、九星、彭祖百忌、冲煞、全年方位神、事项宜忌、参与人刑冲破害与逐时时课；月相取中国标准时间正午的celestine日月黄经',
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
