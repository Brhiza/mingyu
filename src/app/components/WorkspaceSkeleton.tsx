import * as React from 'react';
import { RefreshCw } from 'lucide-react';
import { Button, Card } from '../../components/ui';
import { cn } from '../../lib/utils';

export type WorkspaceSkeletonVariant = 'page' | 'form' | 'almanac' | 'calendar';

function ShimmerBar({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('ws-skeleton-block', className)} />;
}

/**
 * 现代东方素宣骨架屏（自适应全部五套主题与明暗模式），替代生硬的“正在加载…”纯文字。
 */
export function WorkspaceSkeleton({
  variant = 'page',
  className,
}: {
  variant?: WorkspaceSkeletonVariant;
  className?: string;
}) {
  if (variant === 'almanac') {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="正在推演黄历与运势"
        className={cn('grid gap-4', className)}
      >
        <div className="almanac-folio rounded-2xl bg-[var(--surface-base)] overflow-hidden p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border-soft)] pb-3.5">
            <div className="flex items-center gap-2">
              <ShimmerBar className="h-8 w-8 rounded-lg" />
              <ShimmerBar className="h-8 w-36 rounded-lg" />
              <ShimmerBar className="h-8 w-8 rounded-lg" />
            </div>
            <ShimmerBar className="h-8 w-24 rounded-full" />
          </div>

          <div className="grid grid-cols-1 gap-5 py-6 md:grid-cols-12 md:items-center">
            <div className="grid gap-2.5 md:col-span-4">
              <ShimmerBar className="h-6 w-28" />
              <ShimmerBar className="h-4 w-40" />
              <ShimmerBar className="h-4 w-36" />
              <ShimmerBar className="h-4 w-32" />
            </div>
            <div className="flex flex-col items-center gap-3 md:col-span-4">
              <ShimmerBar className="h-4 w-32" />
              <ShimmerBar className="h-24 w-28 rounded-xl" />
              <ShimmerBar className="h-5 w-48" />
            </div>
            <div className="grid gap-2.5 md:col-span-4">
              <ShimmerBar className="h-4 w-36" />
              <ShimmerBar className="h-4 w-40" />
              <ShimmerBar className="h-4 w-32" />
              <ShimmerBar className="h-4 w-38" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 border-t border-[var(--border-soft)] pt-4 sm:grid-cols-2">
            <ShimmerBar className="h-20 w-full rounded-xl" />
            <ShimmerBar className="h-20 w-full rounded-xl" />
          </div>
        </div>

        <Card className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <ShimmerBar key={i} className="h-16 w-full rounded-xl" />
          ))}
        </Card>
      </div>
    );
  }

  if (variant === 'calendar') {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="正在载入历法"
        className={cn(
          'grid gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-4 sm:p-5',
          className,
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <ShimmerBar className="h-7 w-40" />
          <ShimmerBar className="h-7 w-28 rounded-full" />
        </div>
        <div className="grid grid-cols-7 gap-2 pt-1">
          {Array.from({ length: 14 }, (_, i) => (
            <ShimmerBar key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'form') {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="正在载入表单"
        className={cn(
          'workspace-ui-form-surface grid gap-3.5 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-4 sm:p-5',
          className,
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <ShimmerBar className="h-6 w-36" />
          <ShimmerBar className="h-7 w-24 rounded-full" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ShimmerBar className="h-10 w-full rounded-xl" />
          <ShimmerBar className="h-10 w-full rounded-xl" />
          <ShimmerBar className="h-10 w-full rounded-xl" />
          <ShimmerBar className="h-10 w-full rounded-xl" />
        </div>
        <ShimmerBar className="mt-1 h-11 w-full rounded-xl sm:mx-auto sm:max-w-[320px]" />
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="正在载入页面"
      className={cn('mx-auto grid w-full max-w-[var(--ws-canvas,1120px)] gap-4', className)}
    >
      <div className="flex items-center justify-between gap-3">
        <ShimmerBar className="h-7 w-32" />
        <ShimmerBar className="h-8 w-44 rounded-full" />
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
        <div className="grid gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-4 md:col-span-7">
          <ShimmerBar className="h-5 w-28" />
          <ShimmerBar className="h-24 w-full rounded-xl" />
          <ShimmerBar className="h-16 w-full rounded-xl" />
        </div>
        <div className="grid gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-4 md:col-span-5">
          <ShimmerBar className="h-5 w-24" />
          <ShimmerBar className="h-20 w-full rounded-xl" />
          <ShimmerBar className="h-20 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

const CHUNK_RELOAD_STORAGE_KEY = 'mingyu.chunk.reloadAt';
const CHUNK_RELOAD_COOLDOWN_MS = 15_000;

export function isChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError|dynamically imported module/i.test(
    msg,
  );
}

export function triggerSafeChunkReload(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const now = Date.now();
    const last = Number(window.sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY) || '0');
    if (last > 0 && now - last < CHUNK_RELOAD_COOLDOWN_MS) {
      return false;
    }
    window.sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(now));
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}

interface ChunkErrorBoundaryProps {
  resetKey: string;
  children: React.ReactNode;
}

interface ChunkErrorBoundaryState {
  hasError: boolean;
}

/**
 * 捕获懒加载页面模块在版本发布或弱网瞬断时的加载异常，避免页面永久卡在加载态。
 */
export class ChunkErrorBoundary extends React.Component<
  ChunkErrorBoundaryProps,
  ChunkErrorBoundaryState
> {
  state: ChunkErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ChunkErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    if (isChunkLoadError(error)) {
      triggerSafeChunkReload();
    }
  }

  componentDidUpdate(prevProps: ChunkErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <Card className="mx-auto my-6 flex w-full max-w-[520px] flex-col items-center gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-6 py-8 text-center">
        <strong className="text-[15px] font-extrabold text-[var(--text-strong)]">
          页面模块未能顺利载入
        </strong>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => this.setState({ hasError: false })}
          >
            <span>重试</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>刷新页面</span>
          </Button>
        </div>
      </Card>
    );
  }
}
