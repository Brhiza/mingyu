import type { AstrolabeData, AstrolabeSynastryData } from 'mingyu-core/types';
import { formatAstrolabeInfo } from './divination/engine/formatters';
import { formatPromptCurrentTime } from './prompt-time';

export type AstrolabeSynastryPromptMode = 'framework' | 'custom';

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
    '【当前时间】',
    formatPromptCurrentTime(params.currentTime),
    '',
    '【第一人本命盘】',
    formatAstrolabeInfo(params.chart1),
    '',
    '【第二人本命盘】',
    formatAstrolabeInfo(params.chart2),
    '',
    params.synastry.promptText,
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
    '只依据双方本命盘、跨盘相位、跨盘落宫和【问题】作答。先分别确认双方本命结构，再判断互动主轴、互补点、张力点与现实触发条件。',
    '相位角距、容许度和落宫属于盘面事实；关系倾向必须由多条证据共同支持，不得把单一相位直接改写成关系结果。',
    '和谐相位不等于必然适合，紧张相位也不等于必然分离；证据矛盾时应分别列出支持、反证和适用条件。',
    '',
    '【输出要求】',
    '先直接回答【问题】，再按“互动主轴、互补证据、张力证据、反证限制、现实建议”展开。',
    '每个关键判断都要紧跟双方具体星体、宫位、相位类型、容许度或落宫依据，不得编造上方没有出现的新盘面事实。',
    '不得输出缺乏统一依据的关系匹配总分；涉及婚姻、健康、财务、法律或安全问题时，只给趋势与核验建议。',
    '使用简体中文。',
  ].join('\n');
}
