import type { LiurenData, LiurenLesson } from '../types/divination';
import { BRANCH_WUXING, STEM_WUXING, isSheng, isKe } from '../ganzhi';
import { getLiurenOrdinaryCandidateStatusLabel } from '../divination/liuren-ordinary-adjudication';

function formatRelation(source: string, target: string, sourceName: string, targetName: string) {
  const sourceElement = STEM_WUXING[source] || BRANCH_WUXING[source];
  const targetElement = STEM_WUXING[target] || BRANCH_WUXING[target];
  if (!sourceElement || !targetElement) return '';
  const from = `${sourceName}${source}${sourceElement}`;
  const to = `${targetName}${target}${targetElement}`;
  if (sourceElement === targetElement) return `${from}与${to}比和`;
  if (isSheng(sourceElement, targetElement)) return `${from}生${to}`;
  if (isSheng(targetElement, sourceElement)) return `${to}生${from}`;
  if (isKe(sourceElement, targetElement)) return `${from}克${to}`;
  if (isKe(targetElement, sourceElement)) return `${to}克${from}`;
  return '';
}

export function formatLiurenLesson(item: LiurenLesson): string {
  const relation = formatRelation(item.upper, item.lower, '上神', '下位');
  return `${item.name}${item.upper}临${item.lower}乘${item.god}，${item.relation}${relation ? `；${relation}` : ''}`;
}

export function formatLiurenTransmission(data: LiurenData, index: number): string {
  const item = data.threeTransmissions[index];
  const isVoid = data.xunKong ? data.xunKong.includes(item.branch) : item.isVoid;
  const previous =
    index === 0 ? data.fourLessons[0]?.lower : data.threeTransmissions[index - 1]?.branch;
  const previousName = index === 0 ? '一课下位' : data.threeTransmissions[index - 1].stage;
  const relation = previous ? formatRelation(item.branch, previous, item.stage, previousName) : '';
  return `${item.stage}${item.branch}乘${item.god}，${item.relation}${isVoid ? '（空）' : ''}${relation ? `；${relation}` : ''}`;
}

export function formatLiurenOrdinaryTransmissionAdjudication(data: LiurenData): string {
  const adjudication = data.ordinaryTransmissionAdjudication;
  if (!adjudication) return '';

  const stageReasons = Array.from(
    new Set(
      adjudication.stages
        .filter((stage) => stage.status !== 'notApplicable')
        .map((stage) => stage.reason)
        .filter(Boolean),
    ),
  );
  const candidateText = adjudication.candidates
    .map(
      (candidate) =>
        `${candidate.kind}${candidate.upper}（${getLiurenOrdinaryCandidateStatusLabel(candidate)}：${candidate.reasons.at(-1) || '按普通宗门次序核验'}）`,
    )
    .join('、');
  const selectionText =
    adjudication.status === 'selected'
      ? `最终按${adjudication.selectedRule}取${adjudication.selectedInitial}发用`
      : `普通宗门未取定，转入${data.transmissionRule || '特殊课'}取传`;

  return `普通宗门裁决：${stageReasons.join('；')}；${selectionText}${candidateText ? `；候选取舍：${candidateText}` : ''}`;
}
