import type { AstrolabeData, AstrolabeSynastryData } from 'mingyu-core/types';
import { rebuildAuditedAstrolabeData } from 'mingyu-core/divination/astrolabe';
import { rebuildAuditedAstrolabeSynastryData } from 'mingyu-core/divination/astrolabe-synastry';
import { formatAstrolabeInfo } from './divination/engine/formatters';
import { formatPromptCurrentTime } from './prompt-time';
import { buildPromptGuidanceSections } from './prompt-guidance';

export type AstrolabeSynastryPromptMode = 'framework' | 'custom';

function formatSynastryFacts(synastry: AstrolabeSynastryData) {
  const aspectLines = synastry.aspects.map(
    (aspect) =>
      `- ${aspect.person1}${aspect.point1}与${aspect.person2}${aspect.point2}：${aspect.type}，实际夹角${aspect.actualAngle.toFixed(2)}°，精确角${aspect.exactAngle.toFixed(2)}°，偏差${aspect.orb.toFixed(2)}°，采用容许度${aspect.allowedOrb.toFixed(2)}°。`,
  );
  const overlayLines = synastry.houseOverlays.map(
    (overlay) =>
      `- ${overlay.visitor}${overlay.point}落入${overlay.owner}本命盘第${overlay.house}宫。`,
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
  const synastry = rebuildAuditedAstrolabeSynastryData(params.synastry);
  const chart1 = rebuildAuditedAstrolabeData({ generation: synastry.generation.chart1 });
  const chart2 = rebuildAuditedAstrolabeData({ generation: synastry.generation.chart2 });
  const question =
    params.question?.trim() || '请核对双方本命盘、跨盘相位和跨盘落宫中的已计算事实。';
  const baseSections = [
    buildPromptGuidanceSections('astrolabe-synastry'),
    '',
    '【当前时间】',
    formatPromptCurrentTime(new Date(synastry.generation.timestamp)),
    '',
    '【第一人本命盘】',
    formatAstrolabeInfo(chart1),
    '',
    '【第二人本命盘】',
    formatAstrolabeInfo(chart2),
    '',
    formatSynastryFacts(synastry),
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
    '核对双方本命盘、跨盘相位、跨盘落宫与【问题】涉及的计算事实；问题文字只限定核对范围。',
    '',
    '【输出要求】',
    '按“双方出生与计算口径、各自天体与宫位、跨盘相位几何事实、跨盘落宫事实、解释资料缺口”的顺序核对；资料不足时不生成关系主轴、互补或张力结论、现实结果、概率、应期或相处建议。',
  ].join('\n');
}
