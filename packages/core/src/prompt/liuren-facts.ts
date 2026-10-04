import type { LiurenData, LiurenLesson, LiurenTransmission } from '../types/divination';
import { STEM_WUXING, isSheng, isKe } from '../ganzhi';
import { getLiurenOrdinaryCandidateStatusLabel } from '../divination/liuren-ordinary-adjudication';
import { getGanZhiRelationTables } from '../ganzhi/relations';

const GANZHI_RELATION_TABLES = getGanZhiRelationTables();

function isTransmissionMonthStateInTiming(
  timingEvidence: readonly string[],
  transmission: Pick<LiurenTransmission, 'stage' | 'branch' | 'seasonState'> | undefined,
) {
  if (!transmission?.seasonState) return false;
  const marker = `${transmission.stage}${transmission.branch}（月令${transmission.seasonState}`;
  return timingEvidence.some((fact) => fact.includes(marker));
}

export function omitRepeatedLiurenFocusMonthState(
  evidence: readonly string[],
  timingEvidence: readonly string[],
  transmission: Pick<LiurenTransmission, 'stage' | 'branch' | 'seasonState'> | undefined,
) {
  if (
    !transmission?.seasonState ||
    !isTransmissionMonthStateInTiming(timingEvidence, transmission)
  ) {
    return [...evidence];
  }
  return evidence.filter((fact) => fact !== `月令${transmission.seasonState}`);
}

export function omitRepeatedLiurenRidingMonthState(
  promptText: string,
  timingEvidence: readonly string[],
  transmission: Pick<LiurenTransmission, 'stage' | 'branch' | 'seasonState'> | undefined,
) {
  if (
    !transmission?.seasonState ||
    !isTransmissionMonthStateInTiming(timingEvidence, transmission)
  ) {
    return promptText;
  }
  return promptText.replace(`，月令${transmission.seasonState}`, '');
}

export function formatLiurenRoleRelation(
  source: string,
  target: string,
  sourceName: string,
  targetName: string,
) {
  const sourceElement = STEM_WUXING[source] || GANZHI_RELATION_TABLES.BRANCH_WUXING[source];
  const targetElement = STEM_WUXING[target] || GANZHI_RELATION_TABLES.BRANCH_WUXING[target];
  if (!sourceElement || !targetElement) return undefined;
  const from = `${sourceName}${source}${sourceElement}`;
  const to = `${targetName}${target}${targetElement}`;
  if (sourceElement === targetElement) return { summary: '比和', detail: `${from}与${to}比和` };
  if (isSheng(sourceElement, targetElement))
    return { summary: `${sourceElement}生${targetElement}`, detail: `${from}生${to}` };
  if (isSheng(targetElement, sourceElement))
    return { summary: `${targetElement}生${sourceElement}`, detail: `${to}生${from}` };
  if (isKe(sourceElement, targetElement))
    return { summary: `${sourceElement}克${targetElement}`, detail: `${from}克${to}` };
  if (isKe(targetElement, sourceElement))
    return { summary: `${targetElement}克${sourceElement}`, detail: `${to}克${from}` };
  return undefined;
}

export function formatLiurenLesson(item: LiurenLesson): string {
  const relation = formatLiurenRoleRelation(item.upper, item.lower, '上神', '下位');
  const extraRelation = item.relation === relation?.summary ? '' : `，${item.relation}`;
  return `${item.name}${item.upper}临${item.lower}乘${item.god}${extraRelation}${relation ? `；${relation.detail}` : ''}`;
}

export function formatLiurenTransmission(data: LiurenData, index: number): string {
  const item = data.threeTransmissions[index];
  const isVoid = data.xunKong ? data.xunKong.includes(item.branch) : item.isVoid;
  const previous =
    index === 0 ? data.fourLessons[0]?.lower : data.threeTransmissions[index - 1]?.branch;
  const previousName = index === 0 ? '一课下位' : data.threeTransmissions[index - 1].stage;
  const relation = previous
    ? formatLiurenRoleRelation(item.branch, previous, item.stage, previousName)
    : undefined;
  const extraRelation = item.relation === relation?.summary ? '' : `，${item.relation}`;
  return `${item.stage}${item.branch}乘${item.god}${extraRelation}${isVoid ? '（空）' : ''}${relation ? `；${relation.detail}` : ''}`;
}

export function formatLiurenOrdinaryTransmissionAdjudication(data: LiurenData): string {
  const adjudication = data.ordinaryTransmissionAdjudication;
  if (!adjudication) return '';

  const priorityReasons = Array.from(
    new Set(
      adjudication.candidates
        .filter((candidate) => candidate.status === 'suppressedByPrior')
        .map((candidate) => candidate.reasons.at(-1))
        .filter((reason): reason is string => Boolean(reason)),
    ),
  );
  const stageReasons = Array.from(
    new Set(
      adjudication.stages
        .filter(
          (stage) =>
            stage.status !== 'notApplicable' &&
            (stage.status !== 'suppressedByPrior' || priorityReasons.length === 0),
        )
        .map((stage) => stage.reason)
        .filter(Boolean),
    ),
  );
  const candidateText = adjudication.candidates
    .filter((candidate) => candidate.status !== 'suppressedByPrior')
    .map(
      (candidate) =>
        `${candidate.kind}${candidate.upper}（${getLiurenOrdinaryCandidateStatusLabel(candidate)}：${candidate.reasons.at(-1) || '按普通宗门次序核验'}）`,
    )
    .join('、');
  const selectionText =
    adjudication.status === 'selected'
      ? `最终按${adjudication.selectedRule}取${adjudication.selectedInitial}发用`
      : data.transmissionRule
        ? `按${data.transmissionRule}${data.threeTransmissions[0]?.branch ? `取${data.threeTransmissions[0].branch}发用` : '取传'}`
        : '常用取传规则待核';

  return `初传取法：${[
    ...new Set([...stageReasons, ...priorityReasons]),
    selectionText,
    candidateText ? `候选取舍：${candidateText}` : '',
  ]
    .filter(Boolean)
    .join('；')}`;
}
