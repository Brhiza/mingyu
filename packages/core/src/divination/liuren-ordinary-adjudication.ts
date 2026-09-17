import type {
  LiurenOrdinaryTransmissionCandidate,
  LiurenOrdinaryTransmissionStage,
} from '../types/divination';

const STAGE_LABELS: Record<LiurenOrdinaryTransmissionStage['id'], string> = {
  directKe: '四课直接克',
  directBiYong: '直接克比用',
  directSheHai: '直接克涉害',
  remoteKe: '遥克',
  remoteBiYong: '遥克比用',
  remoteSheHai: '遥克涉害',
};

const STAGE_STATUS_LABELS: Record<LiurenOrdinaryTransmissionStage['status'], string> = {
  selected: '已取定',
  matched: '已命中，继续取舍',
  notMatched: '未命中',
  notApplicable: '无需进入',
  suppressedByPrior: '被前置宗门压制',
};

const CANDIDATE_STATUS_LABELS: Record<LiurenOrdinaryTransmissionCandidate['status'], string> = {
  selected: '采用',
  eligible: '候选',
  excluded: '排除',
  suppressedByPrior: '被前置宗门压制',
};

export function getLiurenOrdinaryStageLabel(stage: LiurenOrdinaryTransmissionStage) {
  return STAGE_LABELS[stage.id];
}

export function getLiurenOrdinaryStageStatusLabel(stage: LiurenOrdinaryTransmissionStage) {
  return STAGE_STATUS_LABELS[stage.status];
}

export function getLiurenOrdinaryCandidateStatusLabel(
  candidate: LiurenOrdinaryTransmissionCandidate,
) {
  return CANDIDATE_STATUS_LABELS[candidate.status];
}

export function formatLiurenOrdinaryStage(stage: LiurenOrdinaryTransmissionStage) {
  return `${getLiurenOrdinaryStageLabel(stage)}：${getLiurenOrdinaryStageStatusLabel(stage)}；${stage.reason}`;
}
