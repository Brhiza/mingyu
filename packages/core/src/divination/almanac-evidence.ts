import type { AlmanacData, AlmanacDayCandidate, AlmanacHourCandidate } from '../types/divination';
import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';

export type AlmanacCandidateStatus = '可用候选' | '条件候选' | '慎用候选';

export interface AlmanacHourEvidence {
  name: string;
  range: string;
  ganzhi: string;
  status: AlmanacCandidateStatus;
  support: string[];
  constraints: string[];
}

export interface AlmanacCandidateEvidence {
  date: string;
  status: AlmanacCandidateStatus;
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
  const constraints = unique([
    ...hour.cautions,
    ...hour.participantNotes.filter(isConflictNote),
    ...(hour.avoids.includes('诸事不宜') ? ['时辰明列诸事不宜'] : []),
  ]);
  const support = unique(hour.highlights);
  return {
    name: hour.name,
    range: hour.range,
    ganzhi: hour.ganzhi,
    status: constraints.some((item) => /诸事不宜|忌项触及|冲|刑|害|破/.test(item))
      ? '慎用候选'
      : constraints.length
        ? '条件候选'
        : '可用候选',
    support,
    constraints,
  };
}

function buildCandidateEvidence(day: AlmanacDayCandidate): AlmanacCandidateEvidence {
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
    ? item.usableHours.map((hour) => `${hour.name}${hour.range}`).join('、')
    : '未筛出无明显冲突时辰';
  return `${item.status}；支持${support.join('、') || '未见独立增强证据'}；限制${constraints.join('、') || '未见明确传统禁忌或参与人冲突'}；时段${hours}`;
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
      source: '事项宜忌、建除、神煞、参与人刑冲破害与时辰条件逐项核验',
      weight: 100 - index,
      tags: [item.status, data.topicLabel],
    })),
    {
      level: '限制',
      title: '择日证据边界',
      detail:
        '候选顺序只表示当前规则集下的比较结果。不得展示内部评分作为吉凶强度，不得把高分解释成成功率，也不得在现实硬约束未知时宣称某日必然适合。',
      source: '计算事实与解释结论分离原则',
      weight: 120,
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
      '明确忌项或直接冲突进入慎用组，其他限制进入条件组，不以总分覆盖反证。',
      '最后叠加现实刚性约束；不输出吉凶总分、成功率或必然结论。',
    ],
  };
}
