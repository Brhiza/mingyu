import assert from 'node:assert/strict';
import test from 'node:test';
import { getEventListeners } from 'node:events';
import { createElement } from 'react';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getDefaultHoroscopeContext } from 'mingyu-core/ziwei';
import { birthProfileToZiweiChartInput } from 'mingyu-core/profile';
import { buildZiweiChartInput } from '../src/lib/full-chart-engine/ziwei';
import { buildFrontendBirthProfile } from '../src/lib/full-chart-engine/birth-profile';
import { defaultInputState, defaultPromptState } from '../src/lib/query-state';
import { useZiweiCalculations } from '../src/pages/ResultPage/hooks/useZiweiCalculations';
import type { BaziRangePage } from '../src/lib/full-chart-engine/bazi-range';
import type { ChartInput } from '../src/types/chart';
import {
  loadZiweiPayload,
  getCachedZiweiPayload,
  getZiweiPayloadKey,
  loadZiweiReadingResource,
  loadZiweiPromptScopePayloads,
  loadZiweiDisplayPayload,
  getCachedZiweiDisplayPayload,
  getZiweiDisplayKey,
  loadZiweiRuntime,
  getZiweiInputKey,
  getZiweiRuntimeKey,
  getCachedZiweiRuntime,
} from '../src/pages/ResultPage/utils/ziweiCalculationCache';
import type { AnalysisPayloadV1 } from '../src/types/analysis';
import type { ZiweiReadingResourceContent } from '../src/pages/ResultPage/utils/createPayloadWorker';

test('取消紫微预热后立即读取同一出生页应启动新计算并保留新缓存', async () => {
  const originalWorker = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const workers: FakeWorker[] = [];
  class FakeWorker extends EventTarget {
    onmessage: ((event: MessageEvent) => void) | null = null;
    id = '';
    terminated = false;
    constructor() {
      super();
      workers.push(this);
    }
    postMessage(message: { id: string }) {
      this.id = message.id;
    }
    terminate() {
      this.terminated = true;
    }
    complete() {
      this.onmessage?.({
        data: { id: this.id, ok: true, payloadByScope: { origin: { marker: this.id } } },
      } as MessageEvent);
    }
  }
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: FakeWorker });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { setTimeout, clearTimeout },
  });
  const input = {} as ChartInput;
  const key = '公开合成取消重启样本';
  const controller = new AbortController();
  try {
    const first = loadZiweiPayload(input, key, {}, undefined, controller.signal);
    const firstRejected = assert.rejects(first, { name: 'AbortError' });
    controller.abort();
    const second = loadZiweiPayload(input, key);
    assert.equal(workers.length, 2, '相同出生页不能复用已取消的预热请求');
    assert.equal(workers[0].terminated, true);
    await firstRejected;
    const samePending = loadZiweiPayload(input, key);
    assert.equal(samePending, second, '旧请求清理不能删除新请求的缓存');
    workers[1].complete();
    const result = await second;
    assert.equal(await loadZiweiPayload(input, key), result);
    assert.equal(workers.length, 2);
  } finally {
    for (const worker of workers) worker.complete();
    if (originalWorker) Object.defineProperty(globalThis, 'Worker', originalWorker);
    else Reflect.deleteProperty(globalThis, 'Worker');
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

async function withWorkers(run: (workers: ControlledWorker[]) => Promise<void>) {
  const descriptors = new Map(
    ['Worker', 'window'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  const workers: ControlledWorker[] = [];
  const timers = new Set<ReturnType<typeof setTimeout>>();
  class WorkerHost extends ControlledWorker {
    constructor() {
      super();
      workers.push(this);
    }
  }
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: WorkerHost });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      setTimeout(callback: () => void, ms: number) {
        const timer = setTimeout(() => {
          timers.delete(timer);
          callback();
        }, ms);
        timers.add(timer);
        return timer;
      },
      clearTimeout(timer: ReturnType<typeof setTimeout>) {
        timers.delete(timer);
        clearTimeout(timer);
      },
    },
  });
  try {
    await run(workers);
    assert.equal(timers.size, 0, '所有 Worker 完成/取消后应解除计时器');
    assert.ok(workers.every((worker) => worker.terminated));
  } finally {
    for (const timer of timers) clearTimeout(timer);
    for (const worker of workers) worker.terminate();
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}

class ControlledWorker extends EventTarget {
  onmessage: ((event: MessageEvent) => void) | null = null;
  posted!: { id: string; kind?: string; scope?: string };
  terminated = false;
  postMessage(message: ControlledWorker['posted']) {
    this.posted = message;
  }
  terminate() {
    this.terminated = true;
  }
  complete(fields: Record<string, unknown> = {}) {
    this.onmessage?.({ data: { id: this.posted.id, ok: true, ...fields } } as MessageEvent);
  }
  payload() {
    this.complete({ payloadByScope: { origin: { marker: this.posted.id } } });
  }
}

const input = {} as ChartInput;
const content: ZiweiReadingResourceContent = {
  text: '完整资料',
  usable: true,
  structured: { marker: '完整盘面' },
};
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

for (const abortFirst of [false, true]) {
  test(`共享 payload ${abortFirst ? '首' : '后'}消费者取消只拒绝自身，仍需结果的消费者继续`, async () => {
    await withWorkers(async (workers) => {
      const key = `独立取消-${abortFirst}`;
      const a = new AbortController();
      const b = new AbortController();
      const first = loadZiweiPayload(input, key, {}, undefined, a.signal);
      const second = loadZiweiPayload(input, key, {}, undefined, b.signal);
      const rejected = assert.rejects(abortFirst ? first : second, { name: 'AbortError' });
      (abortFirst ? a : b).abort();
      await rejected;
      assert.equal(workers.length, 1);
      assert.equal(workers[0].terminated, false);
      workers[0].payload();
      const value = await (abortFirst ? second : first);
      assert.equal(getCachedZiweiPayload(getZiweiPayloadKey(key)), value);
      assert.equal(getEventListeners(a.signal, 'abort').length, 0);
      assert.equal(getEventListeners(b.signal, 'abort').length, 0);
    });
  });
}

test('全部消费者取消才终止，取消后迟到响应不写缓存且立即重启 pending 不受旧结算影响', async () => {
  await withWorkers(async (workers) => {
    const key = '全部取消与迟到响应';
    const a = new AbortController();
    const b = new AbortController();
    const first = loadZiweiPayload(input, key, {}, undefined, a.signal);
    const second = loadZiweiPayload(input, key, {}, undefined, b.signal);
    const rejected = Promise.all([
      assert.rejects(first, { name: 'AbortError' }),
      assert.rejects(second, { name: 'AbortError' }),
    ]);
    const staleCallback = workers[0].onmessage!;
    a.abort();
    assert.equal(workers[0].terminated, false);
    b.abort();
    assert.equal(workers[0].terminated, true);
    const replacement = loadZiweiPayload(input, key);
    assert.equal(workers.length, 2);
    staleCallback({
      data: { id: workers[0].posted.id, ok: true, payloadByScope: { origin: { stale: true } } },
    } as MessageEvent);
    await rejected;
    assert.equal(getCachedZiweiPayload(getZiweiPayloadKey(key)), null);
    assert.equal(loadZiweiPayload(input, key), replacement);
    workers[1].payload();
    const result = await replacement;
    assert.equal(await loadZiweiPayload(input, key), result);
  });
});

for (const unownedFirst of [false, true]) {
  test(`无 signal 消费者${unownedFirst ? '先' : '后'}加入都持有任务直到完成`, async () => {
    await withWorkers(async (workers) => {
      const key = `无 signal 所有权-${unownedFirst}`;
      const controller = new AbortController();
      const plain = unownedFirst ? loadZiweiPayload(input, key) : null;
      const cancellable = loadZiweiPayload(input, key, {}, undefined, controller.signal);
      const owner = plain ?? loadZiweiPayload(input, key);
      const rejected = assert.rejects(cancellable, { name: 'AbortError' });
      controller.abort();
      await rejected;
      assert.equal(workers[0].terminated, false);
      workers[0].payload();
      const result = await owner;
      await assert.rejects(loadZiweiPayload(input, key, {}, undefined, controller.signal), {
        name: 'AbortError',
      });
      assert.equal(await loadZiweiPayload(input, key), result);
    });
  });
}

test('预取消 signal 不启动 payload、完整阅读或 custom Worker', async () => {
  await withWorkers(async (workers) => {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(loadZiweiPayload(input, '预取消', {}, undefined, controller.signal), {
      name: 'AbortError',
    });
    await assert.rejects(
      loadZiweiReadingResource(
        input,
        '预取消',
        '2028-01-01',
        4,
        'primary',
        '甲',
        controller.signal,
      ),
      { name: 'AbortError' },
    );
    await assert.rejects(
      loadZiweiPromptScopePayloads(input, '预取消', '2028-01-01', 4, 'yearly', controller.signal),
      { name: 'AbortError' },
    );
    assert.equal(workers.length, 0);
  });
});

test('完整阅读跨角色共享内容，取消只移除一个角色消费者，key/title 保持各自身份', async () => {
  await withWorkers(async (workers) => {
    const key = '完整阅读跨角色';
    const a = new AbortController();
    const b = new AbortController();
    const primary = loadZiweiReadingResource(
      input,
      key,
      '2028-01-01',
      4,
      'primary',
      '甲',
      a.signal,
    );
    const partner = loadZiweiReadingResource(
      input,
      key,
      '2028-01-01',
      4,
      'partner',
      '乙',
      b.signal,
    );
    assert.equal(workers.length, 1);
    const rejected = assert.rejects(primary, { name: 'AbortError' });
    a.abort();
    await rejected;
    assert.equal(workers[0].terminated, false);
    workers[0].complete({ kind: 'reading-resource', resource: content });
    const other = await partner;
    const retried = await loadZiweiReadingResource(input, key, '2028-01-01', 4, 'primary', '新甲');
    assert.equal(workers.length, 1);
    assert.equal(retried.structured, other.structured);
    assert.notEqual(retried.key, other.key);
    assert.equal(retried.title, '新甲紫微完整运限资料');
    assert.equal(other.title, '乙紫微完整运限资料');
    assert.equal(getEventListeners(b.signal, 'abort').length, 0);
  });
});

test('完整阅读全部取消后立即重启，原内容和角色 pending 都不能污染新任务', async () => {
  await withWorkers(async (workers) => {
    const key = '完整阅读全部取消';
    const controller = new AbortController();
    const old = loadZiweiReadingResource(
      input,
      key,
      '2028-01-01',
      4,
      'primary',
      '旧',
      controller.signal,
    );
    const rejected = assert.rejects(old, { name: 'AbortError' });
    controller.abort();
    assert.equal(workers[0].terminated, true);
    const replacement = loadZiweiReadingResource(input, key, '2028-01-01', 4, 'primary', '新');
    await rejected;
    assert.equal(workers.length, 2);
    const joined = loadZiweiReadingResource(input, key, '2028-01-01', 4, 'partner', '乙');
    assert.equal(workers.length, 2);
    workers[1].complete({ kind: 'reading-resource', resource: content });
    assert.equal((await replacement).text, '完整资料');
    assert.equal((await joined).text, '完整资料');
  });
});

test('custom 逐层计算在第一层完成与下一层之间取消，不继续启动下一层', async () => {
  await withWorkers(async (workers) => {
    const key = 'custom 逐层取消';
    const controller = new AbortController();
    const pending = loadZiweiPromptScopePayloads(
      input,
      key,
      '2028-01-01',
      4,
      'yearly',
      controller.signal,
    );
    const rejected = assert.rejects(pending, { name: 'AbortError' });
    assert.equal(workers[0].posted.scope, 'decadal');
    const payload = { marker: 'decadal' } as unknown as AnalysisPayloadV1;
    workers[0].complete({ payload });
    controller.abort();
    await rejected;
    await flush();
    assert.equal(workers.length, 1);
    assert.equal(
      getCachedZiweiDisplayPayload(getZiweiDisplayKey(key, '2028-01-01', 4, 'decadal')),
      payload,
      '已完成的有效层仍可缓存',
    );
    assert.equal(
      getCachedZiweiDisplayPayload(getZiweiDisplayKey(key, '2028-01-01', 4, 'yearly')),
      null,
    );
  });
});

test('共享 custom 层仍有消费者时继续，取消链不能启动其下一层', async () => {
  await withWorkers(async (workers) => {
    const key = 'custom 共享层取消';
    const controller = new AbortController();
    const chain = loadZiweiPromptScopePayloads(
      input,
      key,
      '2028-01-01',
      4,
      'monthly',
      controller.signal,
    );
    const standalone = loadZiweiDisplayPayload(input, key, '2028-01-01', 4, 'decadal');
    const rejected = assert.rejects(chain, { name: 'AbortError' });
    controller.abort();
    await rejected;
    assert.equal(workers[0].terminated, false);
    workers[0].complete({ payload: { marker: '继续' } });
    await standalone;
    await flush();
    assert.equal(workers.length, 1);
  });
});

test('同角色多个完整阅读消费者独立取消，完成后使用调用方姓名包装资源', async () => {
  await withWorkers(async (workers) => {
    const controller = new AbortController();
    const first = loadZiweiReadingResource(
      input,
      '同角色共享',
      '2028-01-01',
      4,
      'primary',
      '旧称呼',
      controller.signal,
    );
    const second = loadZiweiReadingResource(
      input,
      '同角色共享',
      '2028-01-01',
      4,
      'primary',
      '当前称呼',
    );
    const rejected = assert.rejects(first, { name: 'AbortError' });
    controller.abort();
    await rejected;
    assert.equal(workers.length, 1);
    assert.equal(workers[0].terminated, false);
    workers[0].complete({ kind: 'reading-resource', resource: content });
    assert.equal((await second).title, '当前称呼紫微完整运限资料');
  });
});

const chartDraft = {
  ...defaultInputState,
  chartType: 'ziwei' as const,
  name: '公开合成取消行为样本',
  year: '1990',
  month: '6',
  day: '14',
  timeIndex: 6,
  birthHour: '12',
  birthMinute: '34',
  birthSecond: '56',
};

test('轻量运行时取消后丢弃缓存，旧计算结束不能删除立即重启的任务', async () => {
  const chartInput = buildZiweiChartInput(chartDraft);
  const key = '轻量取消重启';
  const context = getDefaultHoroscopeContext();
  const options = { scopes: ['origin' as const], horoscopeContext: context };
  const controller = new AbortController();
  const first = loadZiweiRuntime(chartInput, key, options, controller.signal);
  const rejected = assert.rejects(first, { name: 'AbortError' });
  controller.abort();
  const second = loadZiweiRuntime(chartInput, key, options);
  await rejected;
  assert.equal(getCachedZiweiRuntime(getZiweiRuntimeKey(key, options)), null);
  assert.equal(loadZiweiRuntime(chartInput, key, options), second);
  const runtime = await second;
  assert.equal(await loadZiweiRuntime(chartInput, key, options), runtime);
  assert.deepEqual(runtime.payloadByScope.origin.evidence_pool, []);
  assert.deepEqual(runtime.payloadByScope.origin.patterns, []);
});

test('真实 React SSR 下完整/custom 独立工作保持 loading，rangePaused 门控且单点不误暂停', async () => {
  await withWorkers(async (workers) => {
    const draft = { ...chartDraft, name: '公开合成 loading 样本' };
    const chartInput = buildZiweiChartInput(draft);
    const inputKey = getZiweiInputKey(chartInput);
    const context = getDefaultHoroscopeContext();
    const payloadOptions = { horoscopeContext: context };
    const runtimeOptions = {
      scopes: ['origin', 'decadal', 'yearly', 'monthly', 'daily'] as const,
      horoscopeContext: context,
    };
    await loadZiweiRuntime(chartInput, inputKey, {
      ...runtimeOptions,
      scopes: [...runtimeOptions.scopes],
    });
    const payload = loadZiweiPayload(chartInput, inputKey, payloadOptions);
    workers[0].payload();
    await payload;
    const page = {
      primary: { profile: buildFrontendBirthProfile(draft, 'primary') },
    } as BaziRangePage;
    function render(scope: 'origin' | 'full' | 'yearly', requested: boolean, paused: boolean) {
      let loading = false;
      function Harness() {
        const state = useZiweiCalculations(
          draft,
          {
            ...defaultPromptState,
            promptSource: 'ziwei',
            ziweiScope: scope,
            ziweiScopeDate: scope === 'yearly' ? '2028-06-01' : '',
          },
          false,
          true,
          false,
          { requested, page, paused },
        );
        loading = state.ziweiLoading;
        return createElement('span', null, String(loading));
      }
      renderToStaticMarkup(createElement(Harness));
      return loading;
    }
    assert.equal(render('origin', false, false), false, '轻量及普通 payload 已完成');
    assert.equal(render('full', false, false), true, '只剩完整阅读/fortune 也保持 loading');
    assert.equal(render('yearly', false, false), true, 'custom 资料保持 loading');
    assert.equal(render('full', true, true), false, '范围暂停时完整链不再进入 loading');
    assert.equal(render('yearly', true, true), false, '范围暂停时 custom 链不再进入 loading');
    assert.equal(render('full', false, true), true, '单点不会被范围暂停参数误关闭');
    assert.equal(workers.length, 1, 'SSR 不运行 effect，不冒充页面取消点击验收');
  });
});

// 受限 hook/effect 宿主只用于以下失败结算回归，运行实际 effect 与依赖 cleanup。
// 共享取消/工厂行为由上面的正式服务测试覆盖；这里不声称模拟 React DOM 调度。
function calculationHookHost(...args: Parameters<typeof useZiweiCalculations>) {
  type Slot = { value?: unknown; deps?: unknown[]; cleanup?: () => void };
  const slots: Slot[] = [];
  let index = 0;
  let effects: Array<() => void> = [];
  const internals = (
    React as unknown as {
      __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown };
    }
  ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const changed = (a?: unknown[], b?: unknown[]) =>
    !a || !b || a.length !== b.length || a.some((value, i) => !Object.is(value, b[i]));
  const memo = (create: () => unknown, deps: unknown[]) => {
    const i = index++;
    if (!slots[i] || changed(slots[i].deps, deps)) slots[i] = { value: create(), deps };
    return slots[i].value;
  };
  const dispatcher = {
    useMemo: memo,
    useCallback: (callback: unknown, deps: unknown[]) => memo(() => callback, deps),
    useRef: (initial: unknown) => {
      const i = index++;
      if (!slots[i]) slots[i] = { value: { current: initial } };
      return slots[i].value;
    },
    useState: (initial: unknown) => {
      const i = index++;
      if (!slots[i]) slots[i] = { value: typeof initial === 'function' ? initial() : initial };
      return [
        slots[i].value,
        (value: unknown) => {
          slots[i].value = typeof value === 'function' ? value(slots[i].value) : value;
        },
      ];
    },
    useEffect: (create: () => void | (() => void), deps: unknown[]) => {
      const i = index++;
      if (!slots[i] || changed(slots[i].deps, deps)) {
        const old = slots[i];
        const slot: Slot = { deps };
        slots[i] = slot;
        effects.push(() => {
          old?.cleanup?.();
          slot.cleanup = create() || undefined;
        });
      }
    },
  };
  return {
    render() {
      index = 0;
      effects = [];
      const previous = internals.H;
      internals.H = dispatcher;
      let result: ReturnType<typeof useZiweiCalculations>;
      try {
        result = useZiweiCalculations(...args);
      } finally {
        internals.H = previous;
      }
      for (const effect of effects) effect();
      return result;
    },
    cleanup() {
      for (const slot of slots) slot.cleanup?.();
    },
  };
}

test('第二人 custom Worker 失败/error/timeout 后 loading 结算且可重试，第一人晚成功不覆盖错误', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  for (const mode of ['response', 'error', 'timeout'] as const) {
    await withWorkers(async (workers) => {
      const draft = {
        ...chartDraft,
        analysisMode: 'compatibility' as const,
        name: `甲-${mode}`,
        partnerName: `乙-${mode}`,
        partnerYear: '1992',
        partnerMonth: '5',
        partnerDay: '10',
        partnerTimeIndex: 4,
        partnerBirthHour: '8',
        partnerBirthMinute: '12',
        partnerBirthSecond: '34',
      };
      const page = {
        primary: { profile: buildFrontendBirthProfile(draft, 'primary') },
        partner: { profile: buildFrontendBirthProfile(draft, 'partner') },
      } as BaziRangePage;
      const primaryInput = birthProfileToZiweiChartInput(page.primary.profile);
      const partnerInput = birthProfileToZiweiChartInput(page.partner!.profile);
      const fixed = getDefaultHoroscopeContext();
      const options = {
        scopes: ['origin', 'decadal', 'yearly', 'monthly', 'daily'] as const,
        horoscopeContext: fixed,
      };
      for (const chart of [primaryInput, partnerInput]) {
        await loadZiweiRuntime(chart, getZiweiInputKey(chart), {
          ...options,
          scopes: [...options.scopes],
        });
        const ready = loadZiweiPayload(chart, getZiweiInputKey(chart), { horoscopeContext: fixed });
        workers.at(-1)!.payload();
        await ready;
      }
      const firstCustom = loadZiweiDisplayPayload(
        primaryInput,
        getZiweiInputKey(primaryInput),
        '2028-06-01',
        fixed.hourIndex,
        'decadal',
      );
      workers.at(-1)!.complete({ payload: { marker: '甲大限' } });
      await firstCustom;
      const host = calculationHookHost(
        draft,
        {
          ...defaultPromptState,
          promptSource: 'ziwei',
          ziweiScope: 'yearly',
          ziweiScopeDate: '2028-06-01',
        },
        false,
        true,
        false,
        { requested: true, page },
      );
      try {
        host.render();
        await flush();
        const primaryWorker = workers.at(-1)!;
        const partnerWorker = workers.at(-2)!;
        assert.equal(primaryWorker.posted.scope, 'yearly');
        assert.equal(partnerWorker.posted.scope, 'yearly');
        if (mode === 'response') partnerWorker.complete({ ok: false });
        else if (mode === 'error')
          partnerWorker.dispatchEvent(
            Object.assign(new Event('error'), { message: '公开合成 Worker 失败' }),
          );
        else {
          primaryWorker.complete({ payload: { marker: '甲流年' } });
          context.mock.timers.tick(30000);
        }
        await flush();
        if (mode !== 'timeout') primaryWorker.complete({ payload: { marker: '甲流年' } });
        await flush();
        let result = host.render();
        assert.equal(result.ziweiLoading, false, `${mode} 应结算导航 loading`);
        assert.match(result.ziweiError, /失败/);
        assert.equal(partnerWorker.terminated, true);
        result.retryZiwei();
        host.render();
        const replacement = workers.at(-1)!;
        assert.notEqual(replacement, partnerWorker);
        replacement.complete({ payload: { marker: '乙重试成功' } });
        await flush();
        result = host.render();
        assert.equal(result.ziweiLoading, false);
        assert.equal(result.ziweiError, '');
        assert.equal(
          (result.promptPartnerZiweiPayload as unknown as { marker: string }).marker,
          '乙重试成功',
        );
      } finally {
        host.cleanup();
      }
    });
  }
});
