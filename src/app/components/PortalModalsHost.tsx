import * as React from 'react';
import { getModalBusSnapshot, subscribeModalBus } from '../modal-bus';

const LazyPortalModals = React.lazy(() =>
  import('./PortalModals').then((m) => ({ default: m.PortalModals })),
);

/**
 * 按需挂载弹窗集合：只有当任一全局弹窗被打开过时，才异步加载
 * 省市区县词典、术语词典与周易全文等大型静态资源。
 */
export function PortalModalsHost() {
  const [everOpened, setEverOpened] = React.useState(() => {
    const snap = getModalBusSnapshot();
    return Boolean(snap.place || snap.inspiration || snap.term);
  });

  React.useEffect(() => {
    if (everOpened) return;
    return subscribeModalBus(() => {
      const snap = getModalBusSnapshot();
      if (snap.place || snap.inspiration || snap.term) {
        setEverOpened(true);
      }
    });
  }, [everOpened]);

  if (!everOpened) return null;
  return (
    <React.Suspense fallback={null}>
      <LazyPortalModals />
    </React.Suspense>
  );
}
