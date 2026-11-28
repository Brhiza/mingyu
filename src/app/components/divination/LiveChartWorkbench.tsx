import * as React from 'react';
import type { Method } from '../../../method-meta';
import { preloadCalculateEngine, runCalculateInBackground } from '../../../workers/calc-runner';
import { applyGlobalRulesToPayload, loadGlobalRules } from '../../../web-settings';
import { clearVisualBoard, preloadVisualBoardAssets, renderVisualBoard } from '../../../web-boards';

export type LiveChartMethod = 'qimen' | 'liuren' | 'taiyi' | 'huangji-jingshi' | 'wuyun-liuqi';

const MAX_LIVE_CACHE_ENTRIES = 24;
const liveChartResultCache = new Map<string, unknown>();

function readLiveChartCache(key: string): unknown | undefined {
  if (!liveChartResultCache.has(key)) return undefined;
  const hit = liveChartResultCache.get(key);
  liveChartResultCache.delete(key);
  liveChartResultCache.set(key, hit);
  return hit;
}

function writeLiveChartCache(key: string, value: unknown): void {
  if (liveChartResultCache.has(key)) {
    liveChartResultCache.delete(key);
  }
  liveChartResultCache.set(key, value);
  if (liveChartResultCache.size > MAX_LIVE_CACHE_ENTRIES) {
    const oldest = liveChartResultCache.keys().next().value;
    if (oldest !== undefined) liveChartResultCache.delete(oldest);
  }
}

export function LiveChartWorkbench({
  method,
  title,
  subtitle,
  payload,
  controls,
  showSubmitButton = false,
}: {
  method: LiveChartMethod;
  title?: string;
  subtitle?: string;
  payload: Record<string, unknown>;
  controls: React.ReactNode;
  showSubmitButton?: boolean;
}) {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const reqIdRef = React.useRef(0);
  const hasRenderedRef = React.useRef(false);
  const [loading, setLoading] = React.useState(true);
  const [hasBoard, setHasBoard] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [retryCount, setRetryCount] = React.useState(0);

  const [rulesEpoch, setRulesEpoch] = React.useState(0);

  React.useEffect(() => {
    const onRulesChanged = () => setRulesEpoch((n) => n + 1);
    window.addEventListener('mingyu:global-rules-changed', onRulesChanged);
    return () => window.removeEventListener('mingyu:global-rules-changed', onRulesChanged);
  }, []);

  const payloadKey = React.useMemo(() => JSON.stringify(payload), [payload]);
  const rulesSig = React.useMemo(() => {
    const r = loadGlobalRules();
    return `${r.qimen.juMethod}:${r.qimen.centerPalace}:${r.qimen.feipanMode}:${r.liuren.guiRenTable}`;
  }, [payloadKey, retryCount, rulesEpoch]);
  const cacheKey = `${method}:${rulesSig}:${payloadKey}`;

  React.useEffect(() => {
    const container = hostRef.current;
    return () => {
      if (container) clearVisualBoard(container);
    };
  }, []);

  React.useEffect(() => {
    preloadCalculateEngine(method as Method);
    preloadVisualBoardAssets(method);
  }, [method]);

  React.useEffect(() => {
    const reqId = ++reqIdRef.current;
    let cancelled = false;

    const cached = retryCount === 0 ? readLiveChartCache(cacheKey) : undefined;
    if (cached !== undefined && hostRef.current) {
      setError(null);
      setLoading(false);
      void renderVisualBoard(hostRef.current, method, cached).then((ok) => {
        if (cancelled || reqId !== reqIdRef.current) return;
        hasRenderedRef.current = ok;
        setHasBoard(ok);
        if (!ok) setError('盘面渲染失败，请点击重试');
      });
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError(null);
    preloadVisualBoardAssets(method);

    const delayMs = hasRenderedRef.current ? 36 : 0;
    const timer = window.setTimeout(async () => {
      try {
        const parsedPayload = JSON.parse(payloadKey) as Record<string, unknown>;
        const result = await runCalculateInBackground(
          method as Method,
          applyGlobalRulesToPayload(method as Method, parsedPayload, true),
          { promptProfile: 'ultra-compact' },
        );
        if (cancelled || reqId !== reqIdRef.current || !hostRef.current) return;
        writeLiveChartCache(cacheKey, result);
        const ok = await renderVisualBoard(hostRef.current, method, result);
        if (cancelled || reqId !== reqIdRef.current) return;
        hasRenderedRef.current = ok;
        setHasBoard(ok);
        setLoading(false);
        if (!ok) {
          setError('盘面渲染失败，请点击重试');
        }
      } catch (err) {
        if (cancelled || reqId !== reqIdRef.current) return;
        setLoading(false);
        setError(err instanceof Error ? err.message : '排盘计算失败，请稍后重试');
      }
    }, delayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [cacheKey, method, payloadKey, retryCount]);

  return (
    <div className="live-chart-workbench">
      {title ? (
        <div className="ritual-sanctuary-head">
          <div className="ritual-brand-text">
            <strong>{title}</strong>
            {subtitle ? <span>{subtitle}</span> : null}
          </div>
        </div>
      ) : null}

      <div className="live-chart-toolbar">
        <div className="live-chart-controls">{controls}</div>
        {showSubmitButton ? (
          <div className="live-chart-actions is-mobile-action-dock">
            <button
              type="submit"
              className="workspace-ui-button is-primary live-chart-submit-btn"
            >
              深度解读
            </button>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="workspace-ui-form-error live-chart-error">
          <span>{error}</span>
          <button
            type="button"
            className="ritual-mini-btn"
            onClick={() => setRetryCount((c) => c + 1)}
          >
            重试
          </button>
        </div>
      ) : null}

      <div className={`live-chart-board-stage${loading ? ' is-loading' : ''}`}>
        {loading && !hasBoard ? (
          <div className="live-chart-loader" role="status" aria-live="polite" aria-label="排盘加载中">
            <div className="live-chart-loader-rings" aria-hidden="true">
              <span className="live-chart-ring-outer" />
              <span className="live-chart-ring-inner" />
              <span className="live-chart-ring-core" />
            </div>
          </div>
        ) : null}
        {loading && hasBoard ? (
          <span className="live-chart-refresh-badge" aria-hidden="true" />
        ) : null}
        <div ref={hostRef} className="live-chart-board-host" />
      </div>
    </div>
  );
}
