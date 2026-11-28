import * as React from 'react';

export interface UiSegmentedOption<T extends string | number | boolean> {
  label: string;
  value: T;
}

/**
 * 复用 `.workspace-ui-segmented` 视觉滑动样式的轻量纯 React 分段选择器。
 */
export function UiSegmentedControl<T extends string | number | boolean>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: readonly UiSegmentedOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}) {
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const count = Math.max(1, options.length);
  const fallbackWidth = `${100 / count}%`;
  const fallbackLeft = `${(100 / count) * activeIndex}%`;

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const itemRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const [indicatorRect, setIndicatorRect] = React.useState<{
    left: number;
    width: number;
  } | null>(null);

  const labelsKey = options.map((option) => option.label).join('\u0000');

  React.useLayoutEffect(() => {
    const measure = () => {
      const activeBtn = itemRefs.current[activeIndex];
      if (!activeBtn || activeBtn.offsetWidth <= 0) return;
      const nextLeft = activeBtn.offsetLeft;
      const nextWidth = activeBtn.offsetWidth;
      setIndicatorRect((prev) =>
        prev && prev.left === nextLeft && prev.width === nextWidth
          ? prev
          : { left: nextLeft, width: nextWidth },
      );
    };

    measure();

    const container = containerRef.current;
    let observer: ResizeObserver | null = null;
    if (container && typeof ResizeObserver === 'function') {
      observer = new ResizeObserver(measure);
      observer.observe(container);
    }

    let cancelled = false;
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      void document.fonts.ready.then(() => {
        if (!cancelled) measure();
      });
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [activeIndex, count, labelsKey]);

  const indicatorStyle: React.CSSProperties = indicatorRect
    ? { left: `${indicatorRect.left}px`, width: `${indicatorRect.width}px` }
    : { width: fallbackWidth, left: fallbackLeft };

  return (
    <div
      ref={containerRef}
      className={className ? `workspace-ui-segmented ${className}` : 'workspace-ui-segmented'}
    >
      <div className="workspace-ui-segmented-indicator" style={indicatorStyle} />
      {options.map((option, idx) => {
        const isActive = option.value === value;
        return (
          <button
            key={String(option.value)}
            ref={(el) => {
              itemRefs.current[idx] = el;
            }}
            type="button"
            className={`workspace-ui-segmented-item workspace-ui-segmented-option${isActive ? ' is-active' : ''}`}
            onClick={() => {
              if (!isActive) onChange(option.value);
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
