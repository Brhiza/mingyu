import * as React from 'react';

export interface MobileKeyboardMetricsInput {
  layoutHeight: number;
  visualHeight: number;
  visualOffsetTop: number;
  baselineHeight: number;
  isInputFocused: boolean;
}

export interface MobileKeyboardMetrics {
  /** Exact Y coordinate of the visual viewport bottom edge relative to position:fixed top:0 */
  visualBottomY: number;
  /** Layout viewport bottom vs visual viewport bottom (px) */
  visualBottomInset: number;
  /** True when the keyboard is open via visual shrink, layout shrink (resizes-content), or focused input */
  keyboardOpen: boolean;
  /** Current usable visible height (px) */
  visibleHeight: number;
}

export function computeMobileKeyboardMetrics(
  input: MobileKeyboardMetricsInput,
): MobileKeyboardMetrics {
  const visualBottomY = Math.max(200, Math.round(input.visualOffsetTop + input.visualHeight));
  const rawBottomInset = Math.max(
    0,
    Math.round(input.layoutHeight - (input.visualOffsetTop + input.visualHeight)),
  );
  // Ignore tiny browser toolbar / fractional zoom jitter (<= 40px)
  const visualBottomInset = rawBottomInset > 40 ? rawBottomInset : 0;
  const heightDelta = Math.max(0, Math.round(input.baselineHeight - input.visualHeight));
  const keyboardOpen =
    visualBottomInset > 60 || heightDelta > 100 || Boolean(input.isInputFocused);

  return {
    visualBottomY,
    visualBottomInset,
    keyboardOpen,
    visibleHeight: Math.max(200, Math.round(input.visualHeight)),
  };
}

function readViewportMetrics(
  baselineHeightRef: React.MutableRefObject<number>,
  lastWidthRef: React.MutableRefObject<number>,
  isInputFocused: boolean,
): MobileKeyboardMetrics {
  if (typeof window === 'undefined') {
    return { visualBottomY: 800, visualBottomInset: 0, keyboardOpen: false, visibleHeight: 800 };
  }
  const vv = window.visualViewport;
  const width = Math.round(vv?.width ?? window.innerWidth);
  const layoutHeight = window.innerHeight;
  const visualHeight = vv?.height ?? window.innerHeight;
  const visualOffsetTop = vv?.offsetTop ?? 0;

  if (Math.abs(width - lastWidthRef.current) > 20) {
    lastWidthRef.current = width;
    baselineHeightRef.current = Math.max(layoutHeight, visualHeight);
  } else if (!isInputFocused) {
    baselineHeightRef.current = Math.max(baselineHeightRef.current, layoutHeight, visualHeight);
  }

  return computeMobileKeyboardMetrics({
    layoutHeight,
    visualHeight,
    visualOffsetTop,
    baselineHeight: baselineHeightRef.current || layoutHeight,
    isInputFocused,
  });
}

/**
 * 监听移动端软键盘弹出高度变化（兼容 iOS Safari visualViewport 缩窄与 Android resizes-content 视口压缩），
 * 提供基于视觉视口底沿的精确定位坐标 visualBottomY，并同步 html.is-mobile-keyboard-open 与 --mobile-visual-height。
 */
export function useMobileViewportKeyboard(isInputFocused: boolean): {
  isMobileViewport: boolean;
  visualBottomY: number;
  visualBottomInset: number;
  keyboardOpen: boolean;
  visibleHeight: number;
} {
  const [isMobileViewport, setIsMobileViewport] = React.useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 679px)').matches
      : false,
  );

  const baselineHeightRef = React.useRef<number>(
    typeof window !== 'undefined' ? window.innerHeight : 800,
  );
  const lastWidthRef = React.useRef<number>(
    typeof window !== 'undefined' ? window.innerWidth : 390,
  );

  const [metrics, setMetrics] = React.useState<MobileKeyboardMetrics>(() =>
    readViewportMetrics(baselineHeightRef, lastWidthRef, isInputFocused),
  );

  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(max-width: 679px)');
    const syncViewport = () => setIsMobileViewport(mq.matches);
    syncViewport();
    mq.addEventListener('change', syncViewport);
    return () => mq.removeEventListener('change', syncViewport);
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    let rafId = 0;

    const syncNow = () => {
      setMetrics(readViewportMetrics(baselineHeightRef, lastWidthRef, isInputFocused));
    };

    const scheduleSync = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        syncNow();
      });
    };

    syncNow();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', scheduleSync);
    vv?.addEventListener('scroll', scheduleSync);
    window.addEventListener('resize', scheduleSync);
    window.addEventListener('scroll', scheduleSync, { passive: true });

    // 捕获 iOS / 微信内置浏览器延迟弹出键盘动画后的高度终态
    const timers: number[] = [];
    if (isInputFocused) {
      for (const delay of [60, 180, 360]) {
        timers.push(window.setTimeout(syncNow, delay));
      }
    }

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      for (const id of timers) window.clearTimeout(id);
      vv?.removeEventListener('resize', scheduleSync);
      vv?.removeEventListener('scroll', scheduleSync);
      window.removeEventListener('resize', scheduleSync);
      window.removeEventListener('scroll', scheduleSync);
    };
  }, [isInputFocused]);

  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const active = isMobileViewport && metrics.keyboardOpen;
    root.classList.toggle('is-mobile-keyboard-open', active);
    if (active) {
      root.style.setProperty('--mobile-visual-height', `${metrics.visibleHeight}px`);
    } else {
      root.style.removeProperty('--mobile-visual-height');
    }
    return () => {
      root.classList.remove('is-mobile-keyboard-open');
      root.style.removeProperty('--mobile-visual-height');
    };
  }, [isMobileViewport, metrics.keyboardOpen, metrics.visibleHeight]);

  return {
    isMobileViewport,
    visualBottomY: metrics.visualBottomY,
    visualBottomInset: metrics.visualBottomInset,
    keyboardOpen: metrics.keyboardOpen,
    visibleHeight: metrics.visibleHeight,
  };
}
