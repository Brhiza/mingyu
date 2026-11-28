import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { computeDropdownPosition, type SelectOptionItem } from './select-utils';

export type { SelectOptionItem };

export interface SelectChangeEvent {
  target: { value: string; name?: string };
  currentTarget: { value: string; name?: string };
}

export interface SelectProps {
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (event: SelectChangeEvent) => void;
  onValueChange?: (value: string) => void;
  options?: ReadonlyArray<SelectOptionItem>;
  children?: React.ReactNode;
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  size?: 'sm' | 'md';
  'aria-label'?: string;
  ariaLabel?: string;
  'data-testid'?: string;
  title?: string;
}

function getTextContent(node: React.ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getTextContent).join('');
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return getTextContent(node.props.children);
  }
  return '';
}

function parseChildrenOptions(children: React.ReactNode, currentGroup?: string): SelectOptionItem[] {
  const result: SelectOptionItem[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === React.Fragment) {
      const fragProps = child.props as { children?: React.ReactNode };
      result.push(...parseChildrenOptions(fragProps.children, currentGroup));
      return;
    }
    if (typeof child.type === 'string' && child.type === 'optgroup') {
      const groupProps = child.props as { label?: string; children?: React.ReactNode };
      result.push(...parseChildrenOptions(groupProps.children, groupProps.label));
      return;
    }
    if (typeof child.type === 'string' && child.type === 'option') {
      const optProps = child.props as {
        value?: string | number;
        disabled?: boolean;
        children?: React.ReactNode;
      };
      const label = getTextContent(optProps.children);
      const rawValue = optProps.value !== undefined ? String(optProps.value) : label;
      result.push({
        value: rawValue,
        label: label || rawValue,
        disabled: Boolean(optProps.disabled),
        group: currentGroup,
      });
    }
  });
  return result;
}

export const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      value,
      defaultValue,
      onChange,
      onValueChange,
      options: optionsProp,
      children,
      disabled = false,
      id,
      name,
      className,
      style,
      placeholder = '请选择',
      size = 'md',
      ariaLabel,
      'aria-label': ariaLabelProp,
      'data-testid': dataTestId,
      title,
    },
    forwardedRef,
  ) => {
    const parsedOptions = React.useMemo(
      () => (optionsProp ? [...optionsProp] : parseChildrenOptions(children)),
      [optionsProp, children],
    );

    const isControlled = value !== undefined;
    const [uncontrolledValue, setUncontrolledValue] = React.useState<string>(() => {
      if (defaultValue !== undefined) return String(defaultValue);
      return parsedOptions.find((o) => !o.disabled)?.value ?? '';
    });

    const currentValue = isControlled ? String(value) : uncontrolledValue;
    const selectedOption = parsedOptions.find((o) => o.value === currentValue);
    const displayLabel = selectedOption?.label ?? (currentValue || placeholder);

    const [open, setOpen] = React.useState(false);
    const [highlightedIdx, setHighlightedIdx] = React.useState<number>(-1);
    const [menuPos, setMenuPos] = React.useState<ReturnType<typeof computeDropdownPosition> | null>(null);

    const triggerRef = React.useRef<HTMLButtonElement | null>(null);
    const menuRef = React.useRef<HTMLDivElement | null>(null);
    const listboxId = React.useId();

    const setMergedRef = React.useCallback(
      (node: HTMLButtonElement | null) => {
        triggerRef.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [forwardedRef],
    );

    const updatePosition = React.useCallback(() => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const pos = computeDropdownPosition(
        { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width },
        { width: window.innerWidth, height: window.innerHeight },
        Math.min(320, Math.max(120, parsedOptions.length * 36 + 16)),
      );
      setMenuPos(pos);
    }, [parsedOptions.length]);

    const commitSelect = React.useCallback(
      (opt: SelectOptionItem) => {
        if (opt.disabled) return;
        if (!isControlled) setUncontrolledValue(opt.value);
        if (opt.value !== currentValue) {
          onChange?.({
            target: { value: opt.value, name },
            currentTarget: { value: opt.value, name },
          });
          onValueChange?.(opt.value);
        }
        setOpen(false);
        triggerRef.current?.focus();
      },
      [currentValue, isControlled, name, onChange, onValueChange],
    );

    const openMenu = React.useCallback(() => {
      if (disabled || parsedOptions.length === 0) return;
      updatePosition();
      const idx = parsedOptions.findIndex((o) => o.value === currentValue && !o.disabled);
      setHighlightedIdx(idx >= 0 ? idx : parsedOptions.findIndex((o) => !o.disabled));
      setOpen(true);
    }, [currentValue, disabled, parsedOptions, updatePosition]);

    React.useEffect(() => {
      if (!open) return;

      const handlePointerDown = (e: PointerEvent) => {
        const target = e.target as Node | null;
        if (
          (target && triggerRef.current?.contains(target)) ||
          (target && menuRef.current?.contains(target))
        ) {
          return;
        }
        setOpen(false);
      };

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          setOpen(false);
          triggerRef.current?.focus();
        }
      };

      const handleResize = () => updatePosition();
      const handleScroll = (e: Event) => {
        const target = e.target as Node | null;
        if (target && menuRef.current?.contains(target)) return;
        updatePosition();
      };

      document.addEventListener('pointerdown', handlePointerDown, true);
      document.addEventListener('keydown', handleKeyDown);
      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleScroll, true);

      return () => {
        document.removeEventListener('pointerdown', handlePointerDown, true);
        document.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleScroll, true);
      };
    }, [open, updatePosition]);

    React.useLayoutEffect(() => {
      if (!open || !menuRef.current) return;
      const menuEl = menuRef.current;
      const activeBtn = menuEl.querySelector<HTMLElement>('[aria-selected="true"]');
      if (activeBtn) {
        const top = activeBtn.offsetTop;
        const bottom = top + activeBtn.offsetHeight;
        if (top < menuEl.scrollTop) menuEl.scrollTop = Math.max(0, top - 6);
        else if (bottom > menuEl.scrollTop + menuEl.clientHeight) {
          menuEl.scrollTop = bottom - menuEl.clientHeight + 6;
        }
      }
    }, [open, menuPos]);

    const moveHighlight = (delta: number) => {
      if (parsedOptions.length === 0) return;
      let idx = highlightedIdx;
      for (let step = 0; step < parsedOptions.length; step += 1) {
        idx = (idx + delta + parsedOptions.length) % parsedOptions.length;
        if (!parsedOptions[idx]?.disabled) {
          setHighlightedIdx(idx);
          return;
        }
      }
    };

    const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!open) openMenu();
        else moveHighlight(e.key === 'ArrowDown' ? 1 : -1);
      } else if (e.key === 'Home' && open) {
        e.preventDefault();
        setHighlightedIdx(parsedOptions.findIndex((o) => !o.disabled));
      } else if (e.key === 'End' && open) {
        e.preventDefault();
        for (let i = parsedOptions.length - 1; i >= 0; i -= 1) {
          if (!parsedOptions[i]?.disabled) {
            setHighlightedIdx(i);
            break;
          }
        }
      } else if ((e.key === 'Enter' || e.key === ' ') && open) {
        e.preventDefault();
        const item = parsedOptions[highlightedIdx];
        if (item && !item.disabled) commitSelect(item);
      }
    };

    const groupedRender = React.useMemo(() => {
      const blocks: Array<{ group?: string; items: Array<{ option: SelectOptionItem; flatIdx: number }> }> = [];
      let lastGroup: string | undefined = undefined;
      parsedOptions.forEach((option, flatIdx) => {
        if (blocks.length === 0 || option.group !== lastGroup) {
          blocks.push({ group: option.group, items: [] });
          lastGroup = option.group;
        }
        blocks[blocks.length - 1]!.items.push({ option, flatIdx });
      });
      return blocks;
    }, [parsedOptions]);

    return (
      <>
        <button
          ref={setMergedRef}
          type="button"
          id={id}
          disabled={disabled}
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-label={ariaLabelProp ?? ariaLabel}
          data-testid={dataTestId}
          title={title}
          style={style}
          onClick={(e) => {
            e.stopPropagation();
            if (open) setOpen(false);
            else openMenu();
          }}
          onKeyDown={handleTriggerKeyDown}
          className={cn(
            'ui-custom-select-trigger',
            size === 'sm' && 'is-sm',
            open && 'is-open',
            className,
          )}
        >
          <span className={cn('ui-custom-select-value', !selectedOption && 'is-placeholder')}>
            {displayLabel}
          </span>
          <ChevronDown className="ui-custom-select-chevron" aria-hidden="true" />
        </button>

        {open && menuPos && typeof document !== 'undefined'
          ? ReactDOM.createPortal(
              <div
                ref={menuRef}
                id={listboxId}
                role="listbox"
                data-ui-select-menu="true"
                data-placement={menuPos.placement}
                aria-label={ariaLabelProp ?? ariaLabel}
                className="ui-custom-select-menu"
                style={{
                  position: 'fixed',
                  top: menuPos.top !== undefined ? `${menuPos.top}px` : undefined,
                  bottom: menuPos.bottom !== undefined ? `${menuPos.bottom}px` : undefined,
                  left: `${menuPos.left}px`,
                  minWidth: `${menuPos.minWidth}px`,
                  maxWidth: `${menuPos.maxWidth}px`,
                  maxHeight: `${menuPos.maxHeight}px`,
                  pointerEvents: 'auto',
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                {groupedRender.map((block, bIdx) => (
                  <React.Fragment key={`${block.group ?? '__default'}-${bIdx}`}>
                    {block.group ? (
                      <div className="ui-custom-select-group-label">{block.group}</div>
                    ) : null}
                    {block.items.map(({ option, flatIdx }) => {
                      const isSelected = option.value === currentValue;
                      const isHighlighted = flatIdx === highlightedIdx;
                      return (
                        <button
                          key={`${option.value}-${flatIdx}`}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          disabled={option.disabled}
                          className={cn(
                            'ui-custom-select-option',
                            isSelected && 'is-selected',
                            isHighlighted && !isSelected && 'is-highlighted',
                          )}
                          onMouseEnter={() => {
                            if (!option.disabled) setHighlightedIdx(flatIdx);
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            commitSelect(option);
                          }}
                        >
                          <span className="ui-custom-select-option-label">{option.label}</span>
                          {isSelected ? (
                            <Check className="ui-custom-select-check" aria-hidden="true" />
                          ) : null}
                        </button>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>,
              document.body,
            )
          : null}
      </>
    );
  },
);
Select.displayName = 'Select';
