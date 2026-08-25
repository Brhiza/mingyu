import { calculateFullZiweiChart } from '@/lib/full-chart-engine/ziwei';
import { createBoundedMemoryCache } from '@/lib/bounded-memory-cache';
import { createSecureId } from '@/lib/secure-id';
import type { AnalysisPayloadV1, ScopeType } from '@/types/analysis';
import type { ChartInput } from '@/types/chart';
import type { ZiweiPayloadByScopeState, ZiweiRuntimeState } from '../ResultPage.types';
import { createDisplayWorker } from './createDisplayWorker';
import { createPayloadWorker } from './createPayloadWorker';

type ZiweiRuntime = NonNullable<ZiweiRuntimeState>;
type ZiweiPayloadByScope = NonNullable<ZiweiPayloadByScopeState>;

const chartInputCache = createBoundedMemoryCache<ChartInput>(12);
const runtimeCache = createBoundedMemoryCache<ZiweiRuntime>(8);
const payloadCache = createBoundedMemoryCache<ZiweiPayloadByScope>(8);
const displayPayloadCache = createBoundedMemoryCache<AnalysisPayloadV1>(24);
const pendingRuntime = new Map<string, Promise<ZiweiRuntime>>();
const pendingPayload = new Map<string, Promise<ZiweiPayloadByScope>>();
const pendingDisplayPayload = new Map<string, Promise<AnalysisPayloadV1>>();

export function getZiweiInputKey(input: ChartInput): string {
  return JSON.stringify(input);
}

/** 让相同命盘在路由参数变化时继续复用同一个输入对象，避免子组件误判为新盘。 */
export function stabilizeZiweiChartInput(input: ChartInput): ChartInput {
  const key = getZiweiInputKey(input);
  const cached = chartInputCache.get(key);
  if (cached) return cached;
  chartInputCache.set(key, input);
  return input;
}

export function getCachedZiweiRuntime(inputKey: string): ZiweiRuntime | null {
  return runtimeCache.get(inputKey) ?? null;
}

export function getCachedZiweiPayload(inputKey: string): ZiweiPayloadByScope | null {
  return payloadCache.get(inputKey) ?? null;
}

export function loadZiweiRuntime(input: ChartInput, inputKey: string): Promise<ZiweiRuntime> {
  const cached = runtimeCache.get(inputKey);
  if (cached) return Promise.resolve(cached);

  const pending = pendingRuntime.get(inputKey);
  if (pending) return pending;

  const request = calculateFullZiweiChart(input, true)
    .then((runtime) => {
      runtimeCache.set(inputKey, runtime);
      return runtime;
    })
    .finally(() => pendingRuntime.delete(inputKey));
  pendingRuntime.set(inputKey, request);
  return request;
}

export function loadZiweiPayload(
  input: ChartInput,
  inputKey: string,
  fallbackError = '紫微排盘失败。',
): Promise<ZiweiPayloadByScope> {
  const cached = payloadCache.get(inputKey);
  if (cached) return Promise.resolve(cached);

  const pending = pendingPayload.get(inputKey);
  if (pending) return pending;

  const request = new Promise<ZiweiPayloadByScope>((resolve, reject) => {
    createPayloadWorker(
      input,
      `${createSecureId()}-cached-payload`,
      resolve,
      (message) => reject(new Error(message)),
      fallbackError,
    );
  })
    .then((payloadByScope) => {
      payloadCache.set(inputKey, payloadByScope);
      return payloadByScope;
    })
    .finally(() => pendingPayload.delete(inputKey));
  pendingPayload.set(inputKey, request);
  return request;
}

export function getZiweiDisplayKey(
  inputKey: string,
  dateStr: string,
  hourIndex: number,
  scope: ScopeType,
): string {
  return `${inputKey}\u0000${scope}\u0000${dateStr}\u0000${hourIndex}`;
}

export function getCachedZiweiDisplayPayload(displayKey: string): AnalysisPayloadV1 | null {
  return displayPayloadCache.get(displayKey) ?? null;
}

export function loadZiweiDisplayPayload(
  input: ChartInput,
  inputKey: string,
  dateStr: string,
  hourIndex: number,
  scope: ScopeType,
): Promise<AnalysisPayloadV1> {
  const displayKey = getZiweiDisplayKey(inputKey, dateStr, hourIndex, scope);
  const cached = displayPayloadCache.get(displayKey);
  if (cached) return Promise.resolve(cached);

  const pending = pendingDisplayPayload.get(displayKey);
  if (pending) return pending;

  const request = new Promise<AnalysisPayloadV1>((resolve, reject) => {
    createDisplayWorker(
      {
        id: `${createSecureId()}-cached-display`,
        input,
        dateStr,
        hourIndex,
        scope,
      },
      resolve,
      () => reject(new Error('紫微运限盘生成失败。')),
    );
  })
    .then((payload) => {
      displayPayloadCache.set(displayKey, payload);
      return payload;
    })
    .finally(() => pendingDisplayPayload.delete(displayKey));
  pendingDisplayPayload.set(displayKey, request);
  return request;
}
