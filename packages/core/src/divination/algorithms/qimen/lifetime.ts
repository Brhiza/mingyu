/**
 * @file 奇门遁甲终身局主计算入口
 * @description 整合时间标准化、本命基础局、个人年命标记、六亲主题宫、
 * 阶段运限引擎（Stage Engine）、动态事件扫描与自包含提示词生成。
 */

import type {
  QimenLifetimeData,
  QimenLifetimeEvidence,
  QimenLifetimeInput,
} from '../../../types/divination';
import { generateQimen } from './index';
import { normalizeQimenLifetimeTime } from './helpers/lifetime-time';
import { extractPersonalMarkers, buildTopicCandidates } from './helpers/lifetime-markers';
import { buildLifetimeStages } from './helpers/lifetime-stages';
import { scanLifetimeDynamicEvents } from './helpers/lifetime-dynamic';
import { buildLifetimePrompt } from './helpers/lifetime-prompt';

export { buildLifetimePrompt } from './helpers/lifetime-prompt';
export { normalizeQimenLifetimeTime } from './helpers/lifetime-time';
export { extractPersonalMarkers, buildTopicCandidates } from './helpers/lifetime-markers';
export { buildLifetimeStages } from './helpers/lifetime-stages';
export { scanLifetimeDynamicEvents } from './helpers/lifetime-dynamic';

/**
 * 计算奇门终身局完整结构
 */
export function calculateQimenLifetime(input: QimenLifetimeInput): QimenLifetimeData {
  // 1. P0: 时间标准化与历法依据
  const timeResult = normalizeQimenLifetimeTime(input);
  const method = input.method ?? 'zhuanpan';
  const juMethod = input.juMethod ?? 'chaibu';

  // 2. P1: 生成本命基础局（体）
  const baseChart = generateQimen(timeResult.normalizedDate, method, 'hour', juMethod);

  // 3. P1: 提取个人标记与六亲主题宫（枢）
  const personalMarkers = extractPersonalMarkers(baseChart);
  const topicCandidates = buildTopicCandidates(baseChart, input.gender, input.topics);

  // 4. P2: 阶段引擎推算人生运限卡（变）
  const stages = buildLifetimeStages(
    baseChart,
    personalMarkers,
    topicCandidates,
    timeResult.basis.stagePolicy,
    timeResult.normalizedDate,
    input.gender,
  );

  // 5. P3: 动态事件扫描与事件聚类（用，仅在指定 periodRange 时触发）
  let eventClusters: import('../../../types/divination').QimenEventCluster[] | undefined;
  if (input.periodRange && input.periodRange.startDate && input.periodRange.endDate) {
    eventClusters = scanLifetimeDynamicEvents(
      baseChart,
      stages,
      input.periodRange,
      method,
      juMethod,
    );
  }

  // 6. P4: 汇编分层结构化证据链
  const evidenceAnalysis: QimenLifetimeEvidence = {
    baseEvidenceAnalysis: baseChart.evidenceAnalysis,
    personalMarkerFacts: personalMarkers.map((m) => ({
      markerType: m.markerType,
      value: m.value,
      palace: m.palace,
      meaning: m.traditionalSignificance,
    })),
    stageFacts: stages.map((s) => ({
      stageIndex: s.stageIndex,
      title: s.title,
      ageRange: `${s.ageStart}-${s.ageEnd}岁`,
      dominantPalaceNames: s.dominantPalaces.map((d) => d.name),
      summary: s.stageTheme,
    })),
    dynamicClusterFacts: eventClusters?.map((c) => ({
      key: c.key,
      timeSpan: c.timeSpan,
      triggerFact: c.triggerFact,
      rhythm: c.rhythm,
    })),
    limitations: [
      '奇门终身局反映人生命运之宏观时空场域气机起伏，不作为封闭宿命论必然发生之担保。',
      '阶段卡与流年动态属于时间节律提示，现实重大事项应结合具体当事人之实际行动与现实条件综合决策。',
    ],
  };

  const lifetimeData: QimenLifetimeData = {
    schemaVersion: '1.0.0',
    input,
    basis: timeResult.basis,
    baseChart,
    personalMarkers,
    topicCandidates,
    stages,
    eventClusters,
    evidenceAnalysis,
  };

  return lifetimeData;
}

/**
 * 计算终身局并生成自包含提示词
 */
export function generateQimenLifetimePrompt(
  input: QimenLifetimeInput,
  question?: string,
): { data: QimenLifetimeData; prompt: string } {
  const data = calculateQimenLifetime(input);
  const prompt = buildLifetimePrompt(data, question);
  data.prompt = prompt;
  return { data, prompt };
}
