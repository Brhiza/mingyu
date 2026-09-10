import {
  calculateZiweiChart,
  formatZiweiFortuneTimeline,
  type ZiweiFortuneRangeScope,
} from 'mingyu-core/ziwei';
import type { ChartInput } from '@/types/chart';

export interface ZiweiFortunePromptRequest {
  input: ChartInput;
  dateStr: string;
  hourIndex: number;
  /** 兼容旧 worker 的全部开关；指定 scope 时优先使用 scope。 */
  all: boolean;
  scope?: ZiweiFortuneRangeScope;
  key: string;
}

/** 网页端任务书与 API/MCP 共用同一份紫微阶段、逐年及下层资料。 */
export async function buildZiweiFortunePrompt(request: ZiweiFortunePromptRequest): Promise<string> {
  const scope = request.scope ?? (request.all ? 'all' : 'current');
  const runtime = await calculateZiweiChart(request.input, {
    scopes: ['origin'],
    skipAnalysis: true,
    horoscopeContext: { dateStr: request.dateStr, hourIndex: request.hourIndex },
    fortuneRange: {
      scope,
      dateStr: request.dateStr,
      hourIndex: request.hourIndex,
    },
  });
  if (!runtime.fortuneTimeline) throw new Error('紫微未生成可用的阶段运限资料。');
  return formatZiweiFortuneTimeline(runtime.fortuneTimeline);
}
