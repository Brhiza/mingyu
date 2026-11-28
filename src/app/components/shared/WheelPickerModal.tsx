import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../../lib/utils';

export interface WheelPickerOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface WheelPickerColumn {
  key: string;
  label: string;
  options: ReadonlyArray<WheelPickerOption>;
  flex?: number;
}

export interface WheelPickerModalProps {
  open: boolean;
  title: string;
  columns: ReadonlyArray<WheelPickerColumn>;
  value: string[];
  cancelText?: string;
  confirmText?: string;
  headerExtra?: React.ReactNode;
  onChange?: (values: string[]) => void;
  onCancel: () => void;
  onConfirm: (values: string[]) => void;
}

const ROW_HEIGHT = 44;

function normalizeDraft(columns: ReadonlyArray<WheelPickerColumn>, raw: string[]): string[] {
  return columns.map((col, idx) => {
    const wanted = raw[idx];
    if (wanted !== undefined && col.options.some((o) => o.value === wanted && !o.disabled)) {
      return wanted;
    }
    return col.options.find((o) => !o.disabled)?.value ?? col.options[0]?.value ?? '';
  });
}

export function WheelPickerModal({
  open,
  title,
  columns,
  value,
  cancelText = '取消',
  confirmText = '确定',
  headerExtra,
  onChange,
  onCancel,
  onConfirm,
}: WheelPickerModalProps) {
  const [draft, setDraft] = React.useState<string[]>(() => normalizeDraft(columns, value));
  const draftRef = React.useRef(draft);
  draftRef.current = draft;

  const colRefs = React.useRef<Array<HTMLDivElement | null>>([]);
  const scrollTimers = React.useRef<Map<number, number>>(new Map());
  const programmaticScrollUntil = React.useRef<Map<number, number>>(new Map());

  const scrollColumnToValue = React.useCallback(
    (colIdx: number, val: string, behavior: ScrollBehavior = 'auto') => {
      const el = colRefs.current[colIdx];
      const col = columns[colIdx];
      if (!el || !col) return;
      const optIdx = Math.max(
        0,
        col.options.findIndex((o) => o.value === val),
      );
      programmaticScrollUntil.current.set(colIdx, Date.now() + 220);
      el.scrollTo({ top: optIdx * ROW_HEIGHT, behavior });
    },
    [columns],
  );

  React.useEffect(() => {
    if (!open) return;
    const next = normalizeDraft(columns, value);
    setDraft(next);
    draftRef.current = next;
    const raf = window.requestAnimationFrame(() => {
      next.forEach((val, idx) => scrollColumnToValue(idx, val, 'auto'));
    });
    return () => window.cancelAnimationFrame(raf);
  }, [open, columns, value, scrollColumnToValue]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  React.useEffect(() => {
    const timers = scrollTimers.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const chooseOption = (colIdx: number, nextVal: string, behavior: ScrollBehavior = 'smooth') => {
    const col = columns[colIdx];
    const opt = col?.options.find((o) => o.value === nextVal);
    if (!opt || opt.disabled) return;
    const next = normalizeDraft(columns, draftRef.current);
    next[colIdx] = nextVal;
    setDraft(next);
    draftRef.current = next;
    scrollColumnToValue(colIdx, nextVal, behavior);
    onChange?.(next);
  };

  const handleScroll = (colIdx: number, event: React.UIEvent<HTMLDivElement>) => {
    const now = Date.now();
    const lockUntil = programmaticScrollUntil.current.get(colIdx) ?? 0;
    if (now < lockUntil) return;

    const target = event.currentTarget;
    const prevTimer = scrollTimers.current.get(colIdx);
    if (prevTimer !== undefined) window.clearTimeout(prevTimer);

    const timer = window.setTimeout(() => {
      const col = columns[colIdx];
      if (!col?.options.length) return;
      const idx = Math.max(
        0,
        Math.min(col.options.length - 1, Math.round(target.scrollTop / ROW_HEIGHT)),
      );
      const picked = col.options[idx];
      if (picked && !picked.disabled) {
        const next = normalizeDraft(columns, draftRef.current);
        if (next[colIdx] !== picked.value) {
          next[colIdx] = picked.value;
          setDraft(next);
          draftRef.current = next;
          onChange?.(next);
        }
        target.scrollTo({ top: idx * ROW_HEIGHT, behavior: 'smooth' });
      }
    }, 90);
    scrollTimers.current.set(colIdx, timer);
  };

  const handleColKeyDown = (colIdx: number, event: React.KeyboardEvent<HTMLDivElement>) => {
    const col = columns[colIdx];
    if (!col?.options.length) return;
    const curIdx = Math.max(
      0,
      col.options.findIndex((o) => o.value === draftRef.current[colIdx]),
    );
    let nextIdx = curIdx;
    if (event.key === 'ArrowUp') nextIdx = Math.max(0, curIdx - 1);
    else if (event.key === 'ArrowDown') nextIdx = Math.min(col.options.length - 1, curIdx + 1);
    else return;
    event.preventDefault();
    const option = col.options[nextIdx];
    if (option && !option.disabled) chooseOption(colIdx, option.value);
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="ui-picker-layer"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <section className="ui-picker-dialog" role="dialog" aria-modal="true" aria-label={title}>
        <header className="ui-picker-header">
          <button type="button" className="ui-picker-action" onClick={onCancel}>
            {cancelText}
          </button>
          <h2>{title}</h2>
          <button
            type="button"
            className="ui-picker-action confirm"
            onClick={() => onConfirm(normalizeDraft(columns, draftRef.current))}
          >
            {confirmText}
          </button>
        </header>

        {headerExtra ? <div className="ui-picker-extra">{headerExtra}</div> : null}

        <div className="ui-picker-wheel">
          <div className="ui-picker-selection" aria-hidden="true" />
          {columns.map((column, colIdx) => (
            <div
              key={column.key}
              ref={(el) => {
                colRefs.current[colIdx] = el;
              }}
              className="ui-picker-column"
              style={{ flex: column.flex ?? 1 }}
              role="listbox"
              aria-label={column.label}
              tabIndex={0}
              onScroll={(e) => handleScroll(colIdx, e)}
              onKeyDown={(e) => handleColKeyDown(colIdx, e)}
            >
              <div className="ui-picker-spacer" aria-hidden="true" />
              {column.options.map((option) => {
                const isSelected = draft[colIdx] === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={option.disabled}
                    className={cn('ui-picker-option', isSelected && 'selected')}
                    onClick={() => chooseOption(colIdx, option.value)}
                  >
                    {option.label}
                  </button>
                );
              })}
              <div className="ui-picker-spacer" aria-hidden="true" />
            </div>
          ))}
        </div>
      </section>
    </div>,
    document.body,
  );
}
