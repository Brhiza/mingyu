import * as React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ToastTone = 'info' | 'success' | 'error';

interface ToastPayload {
  id: string;
  message: string;
  tone: ToastTone;
  durationMs: number;
}

const TOAST_EVENT_NAME = 'mingyu:toast';

function dispatchToast(message: string, tone: ToastTone = 'info', durationMs = 2400) {
  if (typeof window === 'undefined' || !message.trim()) return;
  const payload: ToastPayload = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    message: message.trim(),
    tone,
    durationMs,
  };
  window.dispatchEvent(new CustomEvent<ToastPayload>(TOAST_EVENT_NAME, { detail: payload }));
}

export const toast = {
  info: (message: string, durationMs = 2400) => dispatchToast(message, 'info', durationMs),
  success: (message: string, durationMs = 2200) => dispatchToast(message, 'success', durationMs),
  error: (message: string, durationMs = 3200) => dispatchToast(message, 'error', durationMs),
};

export function Toaster() {
  const [items, setItems] = React.useState<ToastPayload[]>([]);
  const timersRef = React.useRef<Map<string, number>>(new Map());

  const dismiss = React.useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  React.useEffect(() => {
    const timers = timersRef.current;
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<ToastPayload>).detail;
      if (!detail) return;
      setItems((prev) => [...prev.slice(-2), detail]);
      const timer = window.setTimeout(() => {
        timers.delete(detail.id);
        setItems((prev) => prev.filter((item) => item.id !== detail.id));
      }, detail.durationMs);
      timers.set(detail.id, timer);
    };

    window.addEventListener(TOAST_EVENT_NAME, onToast);
    return () => {
      window.removeEventListener(TOAST_EVENT_NAME, onToast);
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="ui-toast-stack" role="region" aria-label="系统提示">
      {items.map((item) => (
        <div
          key={item.id}
          role="status"
          aria-live={item.tone === 'error' ? 'assertive' : 'polite'}
          className={cn('ui-toast-item', `is-${item.tone}`)}
        >
          {item.tone === 'success' ? (
            <CheckCircle2 className="size-4 shrink-0 text-[var(--success-text)]" aria-hidden="true" />
          ) : item.tone === 'error' ? (
            <AlertCircle className="size-4 shrink-0 text-[var(--danger-text)]" aria-hidden="true" />
          ) : (
            <Info className="size-4 shrink-0 text-[var(--accent-strong)]" aria-hidden="true" />
          )}
          <span className="min-w-0 flex-1 leading-snug">{item.message}</span>
          <button
            type="button"
            aria-label="关闭提示"
            onClick={() => dismiss(item.id)}
            className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded border-0 bg-transparent text-[var(--text-muted)] hover:text-[var(--text-strong)]"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
