import * as React from 'react';
import { cn } from '../../../lib/utils';
import { renderMarkdownContent } from '../../../web-report';

export function toggleChipIntoText(current: string, chip: string): string {
  const trimmed = current.trim();
  if (!trimmed) return chip;
  const parts = trimmed.split(/[、，,]/).map((s) => s.trim()).filter(Boolean);
  if (parts.includes(chip)) {
    return parts.filter((p) => p !== chip).join('、');
  }
  return `${trimmed}、${chip}`;
}

export function MarkdownMessage({ content }: { content: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.replaceChildren();
    renderMarkdownContent(el, content);
  }, [content]);
  return <div ref={ref} className="ai-message-body markdown-body" />;
}

export interface ClozeBlankProps {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  widthClass?: string;
  ariaLabel: string;
  inputMode?: 'text' | 'numeric';
}

export function ClozeBlank({
  value,
  onChange,
  placeholder,
  widthClass = 'min-w-[140px] sm:min-w-[180px]',
  ariaLabel,
  inputMode = 'text',
}: ClozeBlankProps) {
  return (
    <input
      type="text"
      inputMode={inputMode}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={cn(
        'time-reverse-blank mx-1 my-0.5 inline-block h-8 max-w-full rounded-lg border border-dashed border-[var(--border-contrast)] bg-[var(--surface-elevated-strong)] px-2.5 text-[13.5px] font-semibold text-[var(--text-strong)] placeholder:font-normal placeholder:text-[var(--text-muted)] focus:border-solid focus:border-[var(--accent-strong)] focus:bg-[var(--surface-base)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-surface)] transition-colors',
        widthClass,
      )}
    />
  );
}

export function ChipSuggestions({
  chips,
  value,
  onSelect,
  mode = 'toggle',
}: {
  chips: readonly string[];
  value: string;
  onSelect: (nextValue: string) => void;
  mode?: 'toggle' | 'replace';
}) {
  const activeParts = React.useMemo(
    () =>
      value
        .split(/[、，,]/)
        .map((s) => s.trim())
        .filter(Boolean),
    [value],
  );

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-[11.5px] font-medium text-[var(--text-muted)]">快捷填入：</span>
      {chips.map((chip) => {
        const isActive =
          mode === 'replace' ? value.trim() === chip : activeParts.includes(chip);
        return (
          <button
            key={chip}
            type="button"
            onClick={() => {
              if (mode === 'replace') {
                onSelect(isActive ? '' : chip);
              } else {
                onSelect(toggleChipIntoText(value, chip));
              }
            }}
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-[12px] transition-colors cursor-pointer',
              isActive
                ? 'border-[var(--accent-strong)] bg-[var(--state-selected-surface)] font-bold text-[var(--state-selected-text)]'
                : 'border-[var(--border-soft)] bg-[var(--surface-soft)] font-medium text-[var(--text-secondary)] hover:border-[var(--border-contrast)] hover:text-[var(--text-strong)]',
            )}
          >
            {chip}
          </button>
        );
      })}
    </div>
  );
}
