import { z } from 'zod';
import type { BaziChartResult } from '@core/bazi';
import {
  formatBaziFortuneBatch,
  selectBaziFortuneBatchResult,
  selectBaziNatalResult,
} from '@core/prompt/bazi-fortune';
import {
  COMBINED_BATCH_SECTIONS,
  getNextCombinedBatchCursor,
  getZiweiPromptCalculationScopes,
  type CombinedBatchCursor,
  type CombinedBatchMetadata,
  type ZiweiPromptScope,
} from '../../../src/lib/public-api/prompt-builders.js';
import { calculateZiweiFactsForScopes } from '../../../src/lib/full-chart-engine/ziwei.js';
import type { ChartInput } from '@core/types';

export const combinedBatchSchema = z
  .object({
    section: z.enum(COMBINED_BATCH_SECTIONS).optional(),
    startIndex: z.number().int().min(0).optional(),
  })
  .strict()
  .optional()
  .describe(
    '仅完整八字紫微合参使用；按八字本命、单个大运流年、六个紫微 scope、单个紫微年龄年续取，每页只计算当前体系。续取时把返回的 next 作为本参数，并将 scopeContext.dateStr/hourIndex 分别回传到顶层 scopeDate/scopeHourIndex',
  );

export function resolveMcpCombinedBatchCursor(params: {
  scope: ZiweiPromptScope;
  combinedBatch?: { section?: (typeof COMBINED_BATCH_SECTIONS)[number]; startIndex?: number };
  scopeBatch?: unknown;
  fortuneBatch?: unknown;
  supported: boolean;
}): CombinedBatchCursor | undefined {
  const value = params.combinedBatch;
  if (!value) return undefined;
  if (!params.supported) throw new Error('combinedBatch 仅适用于八字紫微合参。');
  if (params.scope !== 'full') throw new Error('combinedBatch 仅在 promptScope=full 时生效。');
  if (params.scopeBatch !== undefined || params.fortuneBatch !== undefined) {
    throw new Error('combinedBatch 与 scopeBatch、fortuneBatch 不能同时传入。');
  }
  const cursor: CombinedBatchCursor = {
    section: value.section ?? 'bazi-natal',
    startIndex: value.startIndex ?? 0,
  };
  if (cursor.section === 'bazi-natal' && cursor.startIndex !== 0) {
    throw new Error('bazi-natal 仅支持 startIndex=0。');
  }
  if (
    cursor.section === 'ziwei-scope' &&
    cursor.startIndex >= getZiweiPromptCalculationScopes('full').length
  ) {
    throw new Error('ziwei-scope 的 startIndex 已超出资料范围。');
  }
  return cursor;
}

export async function calculateMcpCombinedBatchPage(params: {
  cursor: CombinedBatchCursor;
  scopeContext: { dateStr: string; hourIndex: number };
  calculateBazi: () => BaziChartResult;
  ziweiInput: ChartInput;
}) {
  const { cursor, scopeContext } = params;
  if (cursor.section === 'bazi-natal' || cursor.section === 'bazi-fortune') {
    const fullBaziResult = params.calculateBazi();
    if (cursor.section === 'bazi-natal') {
      const baziResult = selectBaziNatalResult(fullBaziResult);
      const batch: CombinedBatchMetadata = {
        unit: 'combined-section',
        ...cursor,
        scopeContext,
        next: getNextCombinedBatchCursor(cursor),
      };
      return { section: cursor.section, baziResult, batch } as const;
    }
    const fortuneTextBatch = formatBaziFortuneBatch(fullBaziResult, cursor.startIndex);
    const baziResult = selectBaziFortuneBatchResult(fullBaziResult, fortuneTextBatch.batch);
    const batch: CombinedBatchMetadata = {
      unit: 'combined-section',
      ...cursor,
      scopeContext,
      next: getNextCombinedBatchCursor({
        ...cursor,
        innerNextIndex: fortuneTextBatch.batch.nextIndex,
      }),
    };
    return { section: cursor.section, baziResult, fortuneTextBatch, batch } as const;
  }

  const scopes = getZiweiPromptCalculationScopes('full');
  const ziweiResult = await calculateZiweiFactsForScopes(
    params.ziweiInput,
    cursor.section === 'ziwei-scope' ? [scopes[cursor.startIndex]!] : [],
    undefined,
    {
      horoscopeContext: scopeContext,
      ...(cursor.section === 'ziwei-scope'
        ? { independentBatch: 'scope' as const }
        : {
            independentBatch: 'fortune' as const,
            fortuneRange: {
              scope: 'all' as const,
              ...scopeContext,
              batch: { startIndex: cursor.startIndex, limit: 1 },
            },
          }),
    },
  );
  const batch: CombinedBatchMetadata = {
    unit: 'combined-section',
    ...cursor,
    scopeContext: ziweiResult.horoscopeContext,
    next: getNextCombinedBatchCursor({
      ...cursor,
      ...(cursor.section === 'ziwei-scope'
        ? { ziweiScopeCount: scopes.length }
        : { innerNextIndex: ziweiResult.fortuneTimeline?.batch?.nextIndex }),
    }),
  };
  return { section: cursor.section, ziweiResult, batch } as const;
}
