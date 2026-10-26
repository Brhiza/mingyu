import { calculateZiweiChart } from '@/lib/full-chart-engine/ziwei';
import { createBoundedMemoryCache, type BoundedMemoryCache } from '@/lib/bounded-memory-cache';
import { createSecureId } from '@/lib/secure-id';
import type { AnalysisPayloadV1, ScopeType } from '@/types/analysis';
import type { ChartInput } from '@/types/chart';
import type { ReadingResource } from '@/lib/ai/reading-workflow';
import type { ZiweiRuntimeOptions } from 'mingyu-core/ziwei';
import type { ZiweiPayloadByScopeState, ZiweiRuntimeState } from '../ResultPage.types';
import { createDisplayWorker } from './createDisplayWorker';
import {
  createPayloadWorker,
  createReadingResourceWorker,
  type ZiweiPayloadOptions,
} from './createPayloadWorker';

type ZiweiRuntime = NonNullable<ZiweiRuntimeState>;
type ZiweiPayloadByScope = NonNullable<ZiweiPayloadByScopeState>;

const chartInputCache = createBoundedMemoryCache<ChartInput>(12);
const runtimeCache = createBoundedMemoryCache<ZiweiRuntime>(8);
const payloadCache = createBoundedMemoryCache<ZiweiPayloadByScope>(8);
const displayPayloadCache = createBoundedMemoryCache<AnalysisPayloadV1>(24);
type ZiweiReadingResourceContent = Omit<ReadingResource, 'key' | 'title'>;
const readingContentCache = createBoundedMemoryCache<ZiweiReadingResourceContent>(8);
const readingResourceCache = createBoundedMemoryCache<ZiweiReadingResourceContent>(16);
const pendingRuntime = new Map<string, SharedRequest<ZiweiRuntime>>();
const pendingPayload = new Map<string, SharedRequest<ZiweiPayloadByScope>>();
const pendingDisplayPayload = new Map<string, SharedRequest<AnalysisPayloadV1>>();
const pendingReadingContent = new Map<string, SharedRequest<ZiweiReadingResourceContent>>();
const pendingReadingResource = new Map<string, SharedRequest<ZiweiReadingResourceContent>>();

interface SharedRequest<T> {
  promise: Promise<T>;
  consumers: number;
  settled: boolean;
  cancel: () => void;
}

function abortError() {
  return new DOMException('已停止紫微计算。', 'AbortError');
}

/**
 * signal 仅撤销本次调用；最后一个消费者离开才取消底层任务。
 * 不带 signal 的调用持有任务直到结算，保留共享 Promise 身份用于预热复用。
 * 取消同步移除自己的 pending；延迟响应不得写缓存或删除同 key 的新任务。
 */
function loadShared<T>(
  cache: BoundedMemoryCache<T>,
  pending: Map<string, SharedRequest<T>>,
  key: string,
  start: (
    resolve: (value: T) => void,
    reject: (error: unknown) => void,
    signal: AbortSignal,
  ) => () => void,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) return Promise.reject(abortError());
  const cached = cache.get(key);
  if (cached) return Promise.resolve(cached);
  let request = pending.get(key);
  let launch: (() => void) | undefined;
  if (!request) {
    const controller = new AbortController();
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    let cancel = () => {};
    const entry: SharedRequest<T> = {
      promise: new Promise<T>((yes, no) => {
        resolve = yes;
        reject = no;
      }),
      consumers: 0,
      settled: false,
      cancel() {
        if (entry.settled) return;
        entry.settled = true;
        if (pending.get(key) === entry) pending.delete(key);
        controller.abort();
        cancel();
        reject(abortError());
      },
    };
    const finish = (error: unknown, value?: T) => {
      if (entry.settled) return;
      entry.settled = true;
      if (pending.get(key) === entry) pending.delete(key);
      if (error !== null) reject(error);
      else {
        cache.set(key, value!);
        resolve(value!);
      }
    };
    pending.set(key, entry);
    request = entry;
    launch = () => {
      if (entry.settled) return;
      try {
        cancel = start(
          (value) => finish(null, value),
          (error) => finish(error),
          controller.signal,
        );
        if (controller.signal.aborted) cancel();
      } catch (error) {
        finish(error);
      }
    };
  }
  const entry = request;
  entry.consumers += 1;
  const result = signal
    ? new Promise<T>((resolve, reject) => {
        let finished = false;
        const release = () => {
          finished = true;
          signal.removeEventListener('abort', onAbort);
          entry.consumers -= 1;
          if (!entry.consumers) entry.cancel();
        };
        const onAbort = () => {
          if (finished) return;
          release();
          reject(abortError());
        };
        signal.addEventListener('abort', onAbort, { once: true });
        entry.promise.then(
          (value) => {
            if (finished) return;
            release();
            resolve(value);
          },
          (error) => {
            if (finished) return;
            release();
            reject(error);
          },
        );
      })
    : entry.promise;
  launch?.();
  return result;
}

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

export function getCachedZiweiPayload(payloadKey: string): ZiweiPayloadByScope | null {
  return payloadCache.get(payloadKey) ?? null;
}

/** 紫微 payload 与运行时一样必须绑定运限上下文，避免逐页时读到动态当前时刻缓存。 */
export function getZiweiPayloadKey(inputKey: string, options: ZiweiPayloadOptions = {}): string {
  return `${inputKey}\u0000payload\u0000${JSON.stringify(options)}`;
}

/** 紫微运行时包含运限基准时刻，范围逐页计算必须把上下文纳入缓存键。 */
export function getZiweiRuntimeKey(inputKey: string, options: ZiweiRuntimeOptions = {}): string {
  return `${inputKey}\u0000runtime\u0000${JSON.stringify(options)}`;
}

export function loadZiweiRuntime(
  input: ChartInput,
  inputKey: string,
  options: ZiweiRuntimeOptions = {},
  signal?: AbortSignal,
): Promise<ZiweiRuntime> {
  const runtimeKey = getZiweiRuntimeKey(inputKey, options);
  return loadShared(
    runtimeCache,
    pendingRuntime,
    runtimeKey,
    (resolve, reject) => {
      void calculateZiweiChart(input, { ...options, skipAnalysis: true }).then(resolve, reject);
      // 轻量运行时含 astrolabe 方法，保留主线程路径；取消后不缓存也不再预热完整资料。
      return () => {};
    },
    signal,
  );
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
  signal?: AbortSignal,
): Promise<ZiweiReadingResourceContent> {
  const runtimeKey = getZiweiReadingRuntimeKey(inputKey, dateStr, hourIndex);
  return loadShared(
    readingContentCache,
    pendingReadingContent,
    runtimeKey,
    (resolve, reject) =>
      createReadingResourceWorker(
        input,
        dateStr,
        hourIndex,
        `${createSecureId()}-reading-resource`,
        resolve,
        (message) => reject(new Error(message)),
      ),
    signal,
  );
}

export function loadZiweiReadingResource(
  input: ChartInput,
  inputKey: string,
  dateStr: string,
  hourIndex: number,
  role: 'primary' | 'partner',
  subjectTitle: string,
  signal?: AbortSignal,
): Promise<ReadingResource> {
  const resourceKey = getZiweiReadingResourceKey(inputKey, dateStr, hourIndex, role);
  return loadShared(
    readingResourceCache,
    pendingReadingResource,
    resourceKey,
    (resolve, reject, taskSignal) => {
      void loadZiweiReadingContent(input, inputKey, dateStr, hourIndex, taskSignal).then(
        resolve,
        reject,
      );
      return () => {};
    },
    signal,
  ).then((content) => ({
    key: resourceKey,
    title: `${subjectTitle}紫微完整运限资料`,
    ...content,
  }));
}

export function loadZiweiPayload(
  input: ChartInput,
  inputKey: string,
  options: ZiweiPayloadOptions = {},
  fallbackError = '紫微排盘失败。',
  signal?: AbortSignal,
): Promise<ZiweiPayloadByScope> {
  const payloadKey = getZiweiPayloadKey(inputKey, options);
  return loadShared(
    payloadCache,
    pendingPayload,
    payloadKey,
    (resolve, reject) =>
      createPayloadWorker(
        input,
        options,
        `${createSecureId()}-cached-payload`,
        resolve,
        (message) => reject(new Error(message)),
        fallbackError,
      ),
    signal,
  );
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
  signal?: AbortSignal,
): Promise<AnalysisPayloadV1> {
  const displayKey = getZiweiDisplayKey(inputKey, dateStr, hourIndex, scope);
  return loadShared(
    displayPayloadCache,
    pendingDisplayPayload,
    displayKey,
    (resolve, reject) =>
      createDisplayWorker(
        { id: `${createSecureId()}-cached-display`, input, dateStr, hourIndex, scope },
        resolve,
        () => reject(new Error('紫微运限盘生成失败。')),
      ),
    signal,
  );
}

export async function loadZiweiPromptScopePayloads(
  input: ChartInput,
  inputKey: string,
  dateStr: string,
  hourIndex: number,
  scope: ScopeType,
  signal?: AbortSignal,
): Promise<Partial<Record<ScopeType, AnalysisPayloadV1>>> {
  const order: ScopeType[] = ['decadal', 'yearly', 'monthly', 'daily', 'hourly'];
  const index = order.indexOf(scope);
  const scopes = index < 0 ? [scope] : order.slice(0, index + 1);
  const payloads: Partial<Record<ScopeType, AnalysisPayloadV1>> = {};
  for (const layer of scopes) {
    if (signal?.aborted) throw abortError();
    payloads[layer] = await loadZiweiDisplayPayload(
      input,
      inputKey,
      dateStr,
      hourIndex,
      layer,
      signal,
    );
  }
  if (signal?.aborted) throw abortError();
  return payloads;
}
