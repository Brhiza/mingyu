import * as React from 'react';
import { warnDev } from '../../lib/dev-log';
import type { PersonalCase } from '../../v2-ui/cases-store';
import {
  buildFortuneCacheKey,
  getCachedFortuneResult,
  loadFortuneDataOnly,
  readCachedHomeFortunePreview,
  type HomeFortunePreview,
} from './fortune-cache';

export type { HomeFortunePreview };

export function useHomeFortunePreview(activeCase: PersonalCase | null): HomeFortunePreview | null {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  const activePersonalizedCase = React.useMemo(
    () =>
      activeCase && (activeCase.reverseSource || (activeCase.year && activeCase.month && activeCase.day))
        ? activeCase
        : null,
    [activeCase],
  );

  const cacheKey = React.useMemo(
    () =>
      buildFortuneCacheKey({
        scope: 'daily',
        year,
        month,
        day,
        selectedCase: activePersonalizedCase,
      }),
    [year, month, day, activePersonalizedCase],
  );

  const [preview, setPreview] = React.useState<HomeFortunePreview | null>(() =>
    readCachedHomeFortunePreview(cacheKey),
  );

  React.useEffect(() => {
    const fullCached = getCachedFortuneResult(cacheKey);
    if (fullCached) {
      setPreview(fullCached.preview);
      return;
    }

    const sessionPreview = readCachedHomeFortunePreview(cacheKey);
    if (sessionPreview) {
      setPreview(sessionPreview);
      // 刷新页面后首页预览命中了 sessionStorage，但完整盘面尚未进内存；空闲时轻量直算补热。
      let cancelled = false;
      let timerId: number | undefined;
      let idleId: number | undefined;
      const win = window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        cancelIdleCallback?: (id: number) => void;
      };
      const warm = () => {
        if (cancelled) return;
        void loadFortuneDataOnly({
          scope: 'daily',
          year,
          month,
          day,
          selectedCase: activePersonalizedCase,
        })
          .then((entry) => {
            if (!cancelled) setPreview(entry.preview);
          })
          .catch((err) => {
            warnDev('useHomeFortunePreview', '后台补热今日运势数据失败', err);
          });
      };
      if (typeof win.requestIdleCallback === 'function') {
        idleId = win.requestIdleCallback(warm, { timeout: 1200 });
      } else {
        timerId = window.setTimeout(warm, 300);
      }
      return () => {
        cancelled = true;
        if (idleId !== undefined && typeof win.cancelIdleCallback === 'function') {
          win.cancelIdleCallback(idleId);
        }
        if (timerId !== undefined) {
          window.clearTimeout(timerId);
        }
      };
    }

    let cancelled = false;
    void loadFortuneDataOnly({
      scope: 'daily',
      year,
      month,
      day,
      selectedCase: activePersonalizedCase,
    })
      .then((entry) => {
        if (!cancelled) {
          setPreview(entry.preview);
        }
      })
      .catch((err) => {
        warnDev('useHomeFortunePreview', '计算首页运势预览失败', err);
      });

    return () => {
      cancelled = true;
    };
  }, [activePersonalizedCase, cacheKey, day, month, year]);

  return preview;
}
