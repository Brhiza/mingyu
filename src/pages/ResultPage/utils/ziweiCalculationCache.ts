import { calculateFullZiweiChart } from '@/lib/full-chart-engine/ziwei';
import { createBoundedMemoryCache } from '@/lib/bounded-memory-cache';
import { createSecureId } from '@/lib/secure-id';
import type { AnalysisPayloadV1, ScopeType } from '@/types/analysis';
import type { ChartInput } from '@/types/chart';
import type { ReadingResource } from '@/lib/ai/reading-workflow';
import type { ZiweiPayloadByScopeState, ZiweiRuntimeState } from '../ResultPage.types';
import { createDisplayWorker } from './createDisplayWorker';
import { createPayloadWorker, createReadingResourceWorker } from './createPayloadWorker';

type ZiweiRuntime = NonNullable<ZiweiRuntimeState>;
type ZiweiPayloadByScope = NonNullable<ZiweiPayloadByScopeState>;

const chartInputCache = createBoundedMemoryCache<ChartInput>(12);
const runtimeCache = createBoundedMemoryCache<ZiweiRuntime>(8);
const payloadCache = createBoundedMemoryCache<ZiweiPayloadByScope>(8);
const displayPayloadCache = createBoundedMemoryCache<AnalysisPayloadV1>(24);
type ZiweiReadingResourceContent = Omit<ReadingResource, 'key' | 'title'>;
const readingContentCache = createBoundedMemoryCache<ZiweiReadingResourceContent>(8);
const readingResourceCache = createBoundedMemoryCache<ZiweiReadingResourceContent>(16);
const pendingRuntime = new Map<string, Promise<ZiweiRuntime>>();
const pendingPayload = new Map<string, Promise<ZiweiPayloadByScope>>();
const pendingDisplayPayload = new Map<string, Promise<AnalysisPayloadV1>>();
const pendingReadingContent = new Map<string, Promise<ZiweiReadingResourceContent>>();
const pendingReadingResource = new Map<string, Promise<ZiweiReadingResourceContent>>();

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

function getZiweiReadingRuntimeKey(inputKey: string, dateStr: string, hourIndex: number) {
  return `${inputKey}\u0000${dateStr}\u0000${hourIndex}`;
}

export function getZiweiReadingResourceKey(
  inputKey: string,
  dateStr: string,
  hourIndex: number,
  role: 'primary' | 'partner',
) {
  return `ziwei-reading-full\u0000${role}\u0000${getZiweiReadingRuntimeKey(inputKey, dateStr, hourIndex)}`;
}

function loadZiweiReadingContent(
  input: ChartInput,
  inputKey: string,
  dateStr: string,
  hourIndex: number,
): Promise<ZiweiReadingResourceContent> {
  const runtimeKey = getZiweiReadingRuntimeKey(inputKey, dateStr, hourIndex);
  const cached = readingContentCache.get(runtimeKey);
  if (cached) return Promise.resolve(cached);

  const pending = pendingReadingContent.get(runtimeKey);
  if (pending) return pending;

  const request = new Promise<ZiweiReadingResourceContent>((resolve, reject) => {
    createReadingResourceWorker(
      input,
      dateStr,
      hourIndex,
      `${createSecureId()}-reading-resource`,
      resolve,
      (message) => reject(new Error(message)),
    );
  })
    .then((content) => {
      readingContentCache.set(runtimeKey, content);
      return content;
    })
    .finally(() => pendingReadingContent.delete(runtimeKey));
  pendingReadingContent.set(runtimeKey, request);
  return request;
}

export function loadZiweiReadingResource(
  input: ChartInput,
  inputKey: string,
  dateStr: string,
  hourIndex: number,
  role: 'primary' | 'partner',
  subjectTitle: string,
): Promise<ReadingResource> {
  const resourceKey = getZiweiReadingResourceKey(inputKey, dateStr, hourIndex, role);
  const cached = readingResourceCache.get(resourceKey);
  if (cached)
    return Promise.resolve({
      key: resourceKey,
      title: `${subjectTitle}紫微完整运限资料`,
      ...cached,
    });

  const pending = pendingReadingResource.get(resourceKey);
  if (pending)
    return pending.then((content) => ({
      key: resourceKey,
      title: `${subjectTitle}紫微完整运限资料`,
      ...content,
    }));

  const request = loadZiweiReadingContent(input, inputKey, dateStr, hourIndex)
    .then((content) => {
      readingResourceCache.set(resourceKey, content);
      return content;
    })
    .finally(() => pendingReadingResource.delete(resourceKey));
  pendingReadingResource.set(resourceKey, request);
  return request.then((content) => ({
    key: resourceKey,
    title: `${subjectTitle}紫微完整运限资料`,
    ...content,
  }));
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

export async function loadZiweiPromptScopePayloads(
  input: ChartInput,
  inputKey: string,
  dateStr: string,
  hourIndex: number,
  scope: ScopeType,
): Promise<Partial<Record<ScopeType, AnalysisPayloadV1>>> {
  const order: ScopeType[] = ['decadal', 'yearly', 'monthly', 'daily', 'hourly'];
  const index = order.indexOf(scope);
  const scopes = index < 0 ? [scope] : order.slice(0, index + 1);
  const payloads: Partial<Record<ScopeType, AnalysisPayloadV1>> = {};
  for (const layer of scopes) {
    payloads[layer] = await loadZiweiDisplayPayload(input, inputKey, dateStr, hourIndex, layer);
  }
  return payloads;
}
