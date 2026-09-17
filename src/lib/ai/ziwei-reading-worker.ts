import type {
  ZiweiCalculationIdentity,
  ZiweiReadingChunk,
  ZiweiReadingCalculationResult,
  ZiweiReadingProgress,
} from './ziwei-reading-calculation';
import type { SerializableZiweiResult } from 'mingyu-core/ziwei';

type ZiweiFortuneTimeline = Extract<ZiweiReadingChunk, { kind: 'fortune' }>['timeline'];

type ZiweiReadingWorkerResponse =
  | { id: string; type: 'progress'; completed: number; total: number }
  | { id: string; type: 'chunk'; chunk: ZiweiReadingChunk }
  | { id: string; type: 'complete' }
  | { id: string; type: 'error'; error?: string };

type ChunkAccumulator = {
  result?: SerializableZiweiResult;
  calculationIdentity?: ZiweiCalculationIdentity;
  fortuneTimeline?: ZiweiFortuneTimeline;
  promptParts: Map<number, string>;
  promptTotal?: number;
};

function cloneFortuneTimeline(timeline: ZiweiFortuneTimeline): ZiweiFortuneTimeline {
  return {
    ...timeline,
    periods: timeline.periods.map((period) => ({
      ...period,
      years: [...period.years],
    })),
  };
}

function mergeFortuneTimelineChunks(
  base: ZiweiFortuneTimeline | undefined,
  next: ZiweiFortuneTimeline,
): ZiweiFortuneTimeline {
  if (!base) return cloneFortuneTimeline(next);
  if (
    base.scope !== next.scope ||
    base.targetDateStr !== next.targetDateStr ||
    base.targetHourIndex !== next.targetHourIndex ||
    base.targetAge !== next.targetAge ||
    base.targetYear !== next.targetYear ||
    base.selectedPeriodIndex !== next.selectedPeriodIndex
  ) {
    throw new Error('紫微分块运限的固定目标上下文不一致。');
  }
  if (base.batch && next.batch) {
    if (
      base.batch.totalYears !== next.batch.totalYears ||
      base.batch.nextIndex !== next.batch.startIndex
    ) {
      throw new Error('紫微分块运限缺少连续年龄年。');
    }
  }
  const periods = base.periods.map((period) => ({ ...period, years: [...period.years] }));
  for (const nextPeriod of next.periods) {
    const periodKey = `${nextPeriod.startAge}:${nextPeriod.endAge}:${nextPeriod.dateStr}`;
    const current = periods.find(
      (period) => `${period.startAge}:${period.endAge}:${period.dateStr}` === periodKey,
    );
    if (!current) {
      periods.push({ ...nextPeriod, years: [...nextPeriod.years] });
      continue;
    }
    for (const nextYear of nextPeriod.years) {
      const yearIndex = current.years.findIndex(
        (year) => year.age === nextYear.age && year.dateStr === nextYear.dateStr,
      );
      if (yearIndex < 0) current.years.push(nextYear);
      else current.years[yearIndex] = { ...current.years[yearIndex], ...nextYear };
    }
    current.years.sort((left, right) => left.dateStr.localeCompare(right.dateStr));
  }
  periods.sort((left, right) => left.startAge - right.startAge);
  return {
    ...next,
    periods,
  };
}

function acceptChunk(accumulator: ChunkAccumulator, chunk: ZiweiReadingChunk) {
  if (chunk.kind === 'base') {
    if (accumulator.result) throw new Error('紫微本地资料重复发送本命分块。');
    accumulator.result = {
      ...chunk.result,
      scopeNames: [...chunk.result.scopeNames],
      payloadByScope: { ...chunk.result.payloadByScope },
    };
    return;
  }
  if (chunk.kind === 'scope') {
    if (!accumulator.result) throw new Error('紫微动态范围分块早于本命分块。');
    accumulator.result.payloadByScope[chunk.scope] = chunk.payload;
    accumulator.result.scopeNames = Object.keys(accumulator.result.payloadByScope);
    return;
  }
  if (chunk.kind === 'fortune') {
    accumulator.fortuneTimeline = mergeFortuneTimelineChunks(
      accumulator.fortuneTimeline,
      chunk.timeline,
    );
    return;
  }
  if (chunk.kind === 'prompt') {
    if (chunk.index < 0 || chunk.index >= chunk.total || !Number.isInteger(chunk.index)) {
      throw new Error('紫微提示词分块索引无效。');
    }
    if (accumulator.promptTotal !== undefined && accumulator.promptTotal !== chunk.total) {
      throw new Error('紫微提示词分块总数不一致。');
    }
    if (accumulator.promptParts.has(chunk.index)) {
      throw new Error('紫微提示词分块重复。');
    }
    accumulator.promptTotal = chunk.total;
    accumulator.promptParts.set(chunk.index, chunk.text);
    return;
  }
  accumulator.calculationIdentity = chunk.calculationIdentity;
  if (accumulator.promptTotal !== undefined && accumulator.promptTotal !== chunk.promptChunkCount) {
    throw new Error('紫微提示词完成分块总数不一致。');
  }
  accumulator.promptTotal = chunk.promptChunkCount;
}

function completeChunkedResult(accumulator: ChunkAccumulator): ZiweiReadingCalculationResult {
  if (!accumulator.result || !accumulator.calculationIdentity) {
    throw new Error('紫微本地分块结果缺少本命资料或身份。');
  }
  const promptTotal = accumulator.promptTotal ?? 0;
  if (accumulator.promptParts.size !== promptTotal) {
    throw new Error('紫微本地分块结果缺少提示词片段。');
  }
  const prompt = Array.from({ length: promptTotal }, (_, index) => {
    const part = accumulator.promptParts.get(index);
    if (part === undefined) throw new Error('紫微提示词分块顺序不完整。');
    return part;
  }).join('');
  return {
    prompt,
    result: {
      ...accumulator.result,
      ...(accumulator.fortuneTimeline
        ? { fortuneTimeline: finalizeFortuneTimeline(accumulator.fortuneTimeline) }
        : {}),
      calculationIdentity: accumulator.calculationIdentity,
    },
  };
}

function finalizeFortuneTimeline(timeline: ZiweiFortuneTimeline): ZiweiFortuneTimeline {
  const firstPeriod = timeline.periods[0];
  const lastPeriod = timeline.periods.at(-1);
  const result = {
    ...timeline,
    actualStartDateStr: firstPeriod?.dateStr ?? timeline.actualStartDateStr,
    actualEndDateStr: lastPeriod?.endDateStr ?? lastPeriod?.dateStr ?? timeline.actualEndDateStr,
  };
  delete result.batch;
  return result;
}

let requestCounter = 0;

function createWorkerId() {
  requestCounter += 1;
  return `ziwei-reading-${requestCounter}`;
}

function createAbortError() {
  return new DOMException('已停止解读', 'AbortError');
}

/** 通过独立 Worker 分块生成并聚合完整紫微补算资料；失败直接抛出，不回退公开接口。 */
export function executeZiweiReadingWorker(
  calculationRequest: Record<string, unknown>,
  signal?: AbortSignal,
  onProgress?: ZiweiReadingProgress,
): Promise<ZiweiReadingCalculationResult> {
  if (signal?.aborted) return Promise.reject(createAbortError());

  let worker: Worker;
  try {
    worker = new Worker(new URL('../../workers/ziwei-reading.worker.ts', import.meta.url), {
      type: 'module',
    });
  } catch (error) {
    return Promise.reject(error);
  }

  const requestId = createWorkerId();
  return new Promise<ZiweiReadingCalculationResult>((resolve, reject) => {
    let settled = false;
    const accumulator: ChunkAccumulator = { promptParts: new Map() };

    const cleanup = () => {
      signal?.removeEventListener('abort', handleAbort);
      try {
        worker.terminate();
      } catch {
        // Worker 已结束时无需重复处理终止错误。
      }
    };

    const finishWithError = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error instanceof Error ? error : new Error('紫微本地计算失败。'));
    };

    const handleAbort = () => finishWithError(createAbortError());
    signal?.addEventListener('abort', handleAbort, { once: true });

    worker.onmessage = (event: MessageEvent<ZiweiReadingWorkerResponse>) => {
      if (settled || event.data.id !== requestId) return;
      if (event.data.type === 'progress') {
        try {
          onProgress?.(event.data.completed, event.data.total);
        } catch (error) {
          finishWithError(error);
        }
      } else if (event.data.type === 'chunk') {
        try {
          acceptChunk(accumulator, event.data.chunk);
        } catch (error) {
          finishWithError(error);
        }
      } else if (event.data.type === 'complete') {
        try {
          const result = completeChunkedResult(accumulator);
          settled = true;
          cleanup();
          resolve(result);
        } catch (error) {
          finishWithError(error);
        }
      } else {
        finishWithError(new Error(event.data.error || '紫微本地计算失败。'));
      }
    };
    worker.onerror = (event) => finishWithError(new Error(event.message || '紫微本地计算失败。'));
    worker.onmessageerror = () => finishWithError(new Error('紫微本地结果解析失败。'));

    try {
      worker.postMessage({ id: requestId, type: 'calculate', calculationRequest });
    } catch (error) {
      finishWithError(error);
    }
  });
}
