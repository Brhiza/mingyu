import * as React from 'react';

export interface DomSlotProps {
  className?: string;
  deps: readonly unknown[];
  mount: (container: HTMLElement) => void | (() => void);
}

/**
 * 在 React 壳层内安全挂载传统计算器 / 盘面 DOM 节点的桥接插槽。
 */
export function DomSlot({ className, deps, mount }: DomSlotProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const cleanup = mount(el);
    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return <div ref={ref} className={className} />;
}
