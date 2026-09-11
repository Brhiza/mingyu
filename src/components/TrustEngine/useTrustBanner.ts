import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { safeStorage } from '@/lib/safe-storage';
import { trackEvent } from '@/lib/analytics';
import {
  getTrustTier,
  shouldShowTrustBanner,
  TRUST_TIER_COPY,
  type TrustTier,
} from './trust-tier';

export const TRUST_T0_SEEN_KEY = 'ts_trust_t0_seen_v1';
export const TRUST_BANNER_DISMISSED_KEY = 'ts_trust_banner_dismissed_v1';
export const TRUST_BANNER_AUTO_DISMISS_MS = 6000;

/**
 * 信任漏斗判定 hook。
 * - 输入页（InputPage）传入 inputMode 与 inputHasContent，可精确到 T0/T3/T4/T5；
 * - 其他页面只传空对象，由路由决定层级（T1 教程 / T2 隐私 / T6 结果·记录）。
 *
 * T0 星空首屏话术只在首次到访时出现一次（localStorage 持久化标记），
 * 之后的访问进入排盘仪式话术（T3/T5）。T2 隐私页不显示横幅。
 */
export function useTrustBanner(
  extras?: { inputMode?: 'single' | 'compatibility' | 'divination' | 'almanac'; inputHasContent?: boolean },
) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [dismissed, setDismissed] = useState(() => safeStorage.get(TRUST_BANNER_DISMISSED_KEY) === '1');
  const [visible, setVisible] = useState(false);
  const [hasSeenT0, setHasSeenT0] = useState(() => safeStorage.get(TRUST_T0_SEEN_KEY) === '1');
  const shownRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const pathname = location.pathname;
  const inputMode = extras?.inputMode;
  const inputHasContent = extras?.inputHasContent;

  const tier: TrustTier | null = getTrustTier({
    pathname,
    inputMode,
    inputHasContent,
    hasSeenT0,
  });

  const shouldShow = shouldShowTrustBanner(tier);
  const copy = tier ? TRUST_TIER_COPY[tier] : '';

  useEffect(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!shouldShow || dismissed) {
      setVisible(false);
      return;
    }

    // 层级文案变化时重新显示（如输入页模式切换 T3 → T4）
    const showKey = `${tier}|${copy}`;
    if (shownRef.current !== showKey) {
      shownRef.current = showKey;
      setVisible(true);
      if (tier === 'T0') {
        safeStorage.set(TRUST_T0_SEEN_KEY, '1');
        setHasSeenT0(true);
      }
      trackEvent('trust_banner_shown', {
        tier,
        path: pathname,
        input_mode: inputMode ?? null,
      });
    } else {
      setVisible(true);
    }

    timerRef.current = window.setTimeout(() => {
      setVisible(false);
    }, TRUST_BANNER_AUTO_DISMISS_MS);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldShow, dismissed, tier, copy, pathname]);

  const dismiss = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    shownRef.current = null;
    setVisible(false);
    setDismissed(true);
    safeStorage.set(TRUST_BANNER_DISMISSED_KEY, '1');
    trackEvent('trust_banner_dismissed', { tier: tier ?? null, path: pathname });
  }, [pathname, tier]);

  // query 变化（如输入页 ?mode=divination 切换）时重置已显示标记，让层级可重新判定
  useEffect(() => {
    shownRef.current = null;
  }, [searchParams]);

  return { tier, visible, copy, dismiss };
}
