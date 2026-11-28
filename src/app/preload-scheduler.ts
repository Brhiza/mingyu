import { warnDev } from '../lib/dev-log';
import type { Method } from '../method-meta';
import type { DivinationFormMethod, PersonalChartTabId } from '../v2-ui/chart-tabs';
import { preloadCalculateEngine } from '../workers/calc-runner';
import type { TopDomainId } from './workspace-catalog';

export interface NetworkConnectionLike {
  saveData?: boolean;
  effectiveType?: string;
}

export type PreloadDomainTarget =
  | TopDomainId
  | 'settings'
  | 'cases'
  | 'history'
  | 'me'
  | 'connect'
  | 'chat';

export interface DomainPreloadOptions {
  defaultChart?: PersonalChartTabId;
  defaultDivination?: DivinationFormMethod;
}

export interface IdlePrefetchOptions {
  defaultChart: PersonalChartTabId;
  defaultDivination: DivinationFormMethod;
}

const startedPreloadKeys = new Set<string>();

/** 仅不含 518 kB 天文星历依赖（astronomy-engine / true-solar）的轻量术数才参与空闲/默认静默预热 */
const IDLE_LIGHT_CALCULATOR_METHODS = new Set<string>([
  'bazi',
  'ziwei',
  'bazi-synastry',
  'ziwei-synastry',
  'liuyao',
  'meihua',
  'xiaoliuren',
  'tarot',
  'lenormand',
  'liuren',
  'jinkoujue',
  'ssgw',
  'zhuge',
  'huangji-jingshi',
  'taiyi',
  'wuyun-liuqi',
  'almanac',
  'fortune',
]);

export function resetPreloadCacheForTest(): void {
  startedPreloadKeys.clear();
}

function runPreloadOnce(key: string, loader: () => Promise<unknown>): Promise<void> {
  if (startedPreloadKeys.has(key)) {
    return Promise.resolve();
  }
  startedPreloadKeys.add(key);
  return loader()
    .then(() => undefined)
    .catch((err) => {
      startedPreloadKeys.delete(key);
      warnDev('preload-scheduler', `预加载分片失败（${key}）`, err);
    });
}

function readNavigatorConnection(): NetworkConnectionLike | null {
  if (typeof navigator === 'undefined') return null;
  const nav = navigator as Navigator & { connection?: NetworkConnectionLike };
  return nav.connection ?? null;
}

/**
 * 省流量模式或 2G 弱网下跳过进站自动预热，避免抢占首屏与交互带宽；
 * 用户的悬停、按下抢跑及点击并行拉包仍不受限制。
 */
export function shouldAllowIdlePrefetch(conn?: NetworkConnectionLike | null): boolean {
  const effectiveConn = conn === undefined ? readNavigatorConnection() : conn;
  if (!effectiveConn) return true;
  if (effectiveConn.saveData) return false;
  if (effectiveConn.effectiveType === '2g' || effectiveConn.effectiveType === 'slow-2g') {
    return false;
  }
  return true;
}

function preloadResultController(
  method?: Method,
  opts?: { skipCalculator?: boolean },
): Promise<void> {
  return runPreloadOnce('v2-ui/result-page', () =>
    import('../v2-ui/result-page').then((m) => {
      void m.preloadResultWorkspace(method, opts);
      return m;
    }),
  ).then(() => {
    void import('../v2-ui/result-page')
      .then((m) => m.preloadResultWorkspace(method, opts))
      .catch((err) => {
        warnDev('preload-scheduler', '预热结果页样式与盘面资源失败', err);
      });
  });
}

/**
 * 点击“开始排盘 / 开始占卜 / 合盘”时并行拉取结果页、算盘引擎与盘面资源，
 * 消除串行等待瀑布。
 */
export function preloadChartExecution(method: Method): void {
  preloadCalculateEngine(method);
  void preloadResultController(method);
}

/**
 * 悬停、按下或聚焦导航入口时按目标域预加载视图与关联资源。
 */
export function preloadDomainAssets(
  domain: PreloadDomainTarget,
  opts: DomainPreloadOptions = {},
): void {
  const chartMethod = opts.defaultChart ?? 'bazi';
  const divinationMethod = opts.defaultDivination ?? 'liuyao';

  switch (domain) {
    case 'fortune':
      void runPreloadOnce('view/FortunePage', () => import('./components/FortunePage'));
      return;
    case 'personal-chart': {
      const safeChart: Method = IDLE_LIGHT_CALCULATOR_METHODS.has(chartMethod)
        ? chartMethod
        : 'bazi';
      void runPreloadOnce('view/ChartInputView', () => import('./views/ChartInputView'));
      void runPreloadOnce('view/PersonFormWorkspace', () =>
        import('./components/person/PersonFormWorkspace'),
      );
      void preloadResultController(safeChart);
      preloadCalculateEngine(safeChart);
      return;
    }
    case 'divination': {
      const canPreloadDivCalc = IDLE_LIGHT_CALCULATOR_METHODS.has(divinationMethod);
      void runPreloadOnce('view/DivinationInputView', () => import('./views/DivinationInputView'));
      void runPreloadOnce('view/DivinationFormPanel', () =>
        import('./components/divination/DivinationFormPanel'),
      );
      void preloadResultController(divinationMethod, { skipCalculator: !canPreloadDivCalc });
      if (canPreloadDivCalc) {
        preloadCalculateEngine(divinationMethod);
      } else {
        preloadCalculateEngine();
      }
      return;
    }
    case 'tools':
      void runPreloadOnce('view/ToolsHubPage', () => import('./components/ToolsHubPage'));
      void runPreloadOnce('view/UtilitiesView', () => import('./views/UtilitiesView'));
      return;
    case 'settings':
      void runPreloadOnce('modal/SettingsModal', () => import('./components/SettingsModal'));
      return;
    case 'cases':
      void runPreloadOnce('view/CasesDrawer', () => import('./components/CasesDrawer'));
      void runPreloadOnce('modal/CaseEditorModal', () => import('./components/CaseEditorModal'));
      return;
    case 'history':
      void runPreloadOnce('view/HistoryPanel', () => import('./components/HistoryPanel'));
      return;
    case 'me':
      void runPreloadOnce('view/MePage', () => import('./components/MePage'));
      return;
    case 'connect':
      void runPreloadOnce('view/ConnectPage', () => import('./components/ConnectPage'));
      return;
    case 'chat':
      void runPreloadOnce('view/ChatPage', () => import('./components/ChatPage'));
      return;
    case 'home':
    default:
      return;
  }
}

interface IdleHostLike {
  setTimeout: typeof globalThis.setTimeout;
  clearTimeout: typeof globalThis.clearTimeout;
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
}

/**
 * 首页挂载后分两级在浏览器空闲期静默预加载常用页面与轻算盘，
 * 绝不预加载大体积天文星历、字库分片、风水工作台或范围扫描。
 */
export function schedulePostMountIdlePrefetch(
  opts: IdlePrefetchOptions,
  host: IdleHostLike | undefined = typeof window !== 'undefined' ? window : undefined,
): () => void {
  if (!host || !shouldAllowIdlePrefetch()) {
    return () => {};
  }

  let cancelled = false;
  const timers: Array<ReturnType<typeof globalThis.setTimeout>> = [];
  const idleIds: number[] = [];

  const runInIdle = (delayMs: number, idleTimeoutMs: number, task: () => void) => {
    const t = host.setTimeout(() => {
      if (cancelled) return;
      if (typeof host.requestIdleCallback === 'function') {
        const id = host.requestIdleCallback(() => {
          if (!cancelled) task();
        }, { timeout: idleTimeoutMs });
        idleIds.push(id);
      } else {
        task();
      }
    }, delayMs);
    timers.push(t);
  };

  // Tier 1：首屏绘制稳定后优先加载高频主路径壳子
  runInIdle(400, 1500, () => {
    void runPreloadOnce('view/ChartInputView', () => import('./views/ChartInputView'));
    void runPreloadOnce('view/PersonFormWorkspace', () =>
      import('./components/person/PersonFormWorkspace'),
    );
    void runPreloadOnce('view/DivinationInputView', () => import('./views/DivinationInputView'));
    void runPreloadOnce('view/DivinationFormPanel', () =>
      import('./components/divination/DivinationFormPanel'),
    );
    void runPreloadOnce('view/FortunePage', () => import('./components/FortunePage'));
    void preloadResultController();
    preloadCalculateEngine();
  });

  // Tier 2：再下一轮空闲期预热轻量默认术数 + 次高频工具/配置页
  runInIdle(900, 2500, () => {
    const safeChart: Method = IDLE_LIGHT_CALCULATOR_METHODS.has(opts.defaultChart)
      ? opts.defaultChart
      : 'bazi';
    const safeDiv: Method = opts.defaultDivination;
    const divIsLight = IDLE_LIGHT_CALCULATOR_METHODS.has(safeDiv);

    preloadCalculateEngine(safeChart);
    if (divIsLight) {
      preloadCalculateEngine(safeDiv);
    }
    void preloadResultController(safeChart);
    void runPreloadOnce(`board-assets/${safeDiv}`, () =>
      import('../v2-ui/result-page').then((m) =>
        m.preloadResultWorkspace(safeDiv, { skipCalculator: !divIsLight }),
      ),
    );

    void runPreloadOnce('modal/SettingsModal', () => import('./components/SettingsModal'));
    void runPreloadOnce('view/CasesDrawer', () => import('./components/CasesDrawer'));
    void runPreloadOnce('view/ToolsHubPage', () => import('./components/ToolsHubPage'));
    void runPreloadOnce('view/MePage', () => import('./components/MePage'));
    void runPreloadOnce('view/HistoryPanel', () => import('./components/HistoryPanel'));
  });

  return () => {
    cancelled = true;
    for (const t of timers) host.clearTimeout(t);
    if (typeof host.cancelIdleCallback === 'function') {
      for (const id of idleIds) host.cancelIdleCallback(id);
    }
  };
}
