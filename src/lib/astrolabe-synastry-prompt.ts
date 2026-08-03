import type { AstrolabeData, AstrolabeSynastryData } from 'mingyu-core/types';
import { formatAstrolabeInfo } from './divination/engine/formatters';
import { formatPromptCurrentTime } from './prompt-time';
import { buildPromptGuidanceSections } from './prompt-guidance';

export type AstrolabeSynastryPromptMode = 'framework' | 'custom';

function formatSynastryFacts(synastry: AstrolabeSynastryData) {
  const aspectLines = synastry.aspects.map(
    (aspect) =>
      `- ${aspect.person1}${aspect.point1Name}与${aspect.person2}${aspect.point2Name}：${aspect.type}，实际夹角${aspect.actualAngle.toFixed(2)}°，容许度${aspect.orb.toFixed(2)}°，${aspect.closeness}。`,
  );
  const overlayLines = synastry.houseOverlays.map(
    (overlay) =>
      `- ${overlay.visitor}${overlay.pointName}落入${overlay.owner}本命盘第${overlay.house}宫。`,
  );

  return [
    '【跨盘相位】',
    ...(aspectLines.length ? aspectLines : ['- 本次未见主要跨盘相位。']),
    '',
    '【跨盘落宫】',
    ...(overlayLines.length ? overlayLines : ['- 本次未见可用跨盘落宫资料。']),
  ].join('\n');
}

export function buildAstrolabeSynastryPrompt(params: {
  chart1: AstrolabeData;
  chart2: AstrolabeData;
  synastry: AstrolabeSynastryData;
  question?: string;
  promptMode?: AstrolabeSynastryPromptMode;
  currentTime?: Date;
}) {
  const question = params.question?.trim() || '请先整体判断双方关系中的互动主轴。';
  const baseSections = [
    buildPromptGuidanceSections('astrolabe-synastry'),
    '',
    '【当前时间】',
    formatPromptCurrentTime(params.currentTime),
    '',
    '【第一人本命盘】',
    formatAstrolabeInfo(params.chart1),
    '',
    '【第二人本命盘】',
    formatAstrolabeInfo(params.chart2),
    '',
    formatSynastryFacts(params.synastry),
    '',
    '【问题】',
    question,
  ];

  if (params.promptMode === 'custom') {
    return baseSections.join('\n');
  }

  return [
    ...baseSections,
    '',
    '【任务】',
    '结合双方本命盘、跨盘相位、跨盘落宫和【问题】，分析互动主轴、互补点与张力点。',
  ].join('\n');
}
