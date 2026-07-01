import { useEffect, useState } from 'react';

export type ViewportSize = {
  width: number;
  height: number;
};

export function useViewportSize(defaultSize: ViewportSize): ViewportSize {
  const [size, setSize] = useState<ViewportSize>(() =>
    typeof window === 'undefined'
      ? defaultSize
      : { width: window.innerWidth, height: window.innerHeight },
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    function handleResize() {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return size;
}

export function useViewportWidth(defaultWidth: number): number {
  return useViewportSize({ width: defaultWidth, height: 0 }).width;
}
