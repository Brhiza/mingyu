import type { AstrolabeData, AstrolabeSynastryData } from '@temposoul/core/types';
import { buildAstrolabeSynastryPrompt as buildCoreAstrolabeSynastryPrompt } from '@temposoul/core/prompt';

export type AstrolabeSynastryPromptMode = 'framework' | 'custom';

/** 页面兼容入口；实际提示词编排统一由 @temposoul/core 提供。 */
export function buildAstrolabeSynastryPrompt(params: {
  chart1: AstrolabeData;
  chart2: AstrolabeData;
  synastry: AstrolabeSynastryData;
  question?: string;
  promptMode?: AstrolabeSynastryPromptMode;
  currentTime?: Date;
}) {
  return buildCoreAstrolabeSynastryPrompt({
    chart1: params.chart1,
    chart2: params.chart2,
    synastry: params.synastry,
    question: params.question,
    currentTime: params.currentTime,
  });
}
