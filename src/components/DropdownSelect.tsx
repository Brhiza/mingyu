import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export type DropdownSelectOption<T extends string = string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

type DropdownPosition = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  placement: 'above' | 'below';
};

type DropdownSelectProps<T extends string> = {
  id?: string;
  value: T;
  options: readonly DropdownSelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel?: string;
  disabled?: boolean;
  variant?: 'compact' | 'field';
};

function findEnabledOption<T extends string>(
  options: readonly DropdownSelectOption<T>[],
  startIndex: number,
  direction: 1 | -1,
) {
  if (options.length === 0) return -1;

  for (let offset = 0; offset < options.length; offset += 1) {
    const index = (startIndex + offset * direction + options.length) % options.length;
    if (!options[index]?.disabled) return index;
  }

  return -1;
}

export function DropdownSelect<T extends string>({
  id,
  value,
  options,
  onChange,
  ariaLabel,
  disabled = false,
  variant = 'compact',
}: DropdownSelectProps<T>) {
  const generatedId = useId();
  const triggerId = id ?? `dropdown-select-${generatedId}`;
  const menuId = `${triggerId}-menu`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(selectedIndex);
  const [position, setPosition] = useState<DropdownPosition | null>(null);
  const selectedOption = options[selectedIndex] ?? options[0];
  const longestLabelLength = useMemo(
    () => options.reduce((length, option) => Math.max(length, option.label.length), 0),
    [options],
  );

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight;
    const maxViewportWidth = Math.max(160, viewportWidth - 16);
    const width = Math.min(
      Math.max(rect.width, 160, longestLabelLength * 14 + 48),
      Math.min(280, maxViewportWidth),
    );
    const maxHeight = Math.min(320, Math.max(160, Math.floor(viewportHeight * 0.5)));
    const estimatedHeight = Math.min(maxHeight, options.length * 40 + 12);
    const spaceBelow = viewportHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const placement =
      spaceBelow < Math.min(estimatedHeight, 160) && spaceAbove > spaceBelow ? 'above' : 'below';
    const left = Math.min(Math.max(8, rect.left), Math.max(8, viewportWidth - width - 8));

    setPosition({
      left,
      top: placement === 'above' ? rect.top - 6 : rect.bottom + 6,
      width,
      maxHeight: Math.min(maxHeight, placement === 'above' ? spaceAbove : spaceBelow),
      placement,
    });
  }, [longestLabelLength, options.length]);

  const openMenu = useCallback(() => {
    if (disabled || options.length === 0) return;
    setActiveIndex(findEnabledOption(options, selectedIndex, 1));
    updatePosition();
    setIsOpen(true);
  }, [disabled, options, selectedIndex, updatePosition]);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  const selectOption = useCallback(
    (index: number) => {
      const option = options[index];
      if (!option || option.disabled) return;
      onChange(option.value);
      setActiveIndex(index);
      closeMenu();
      triggerRef.current?.focus();
    },
    [closeMenu, onChange, options],
  );

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      closeMenu();
    };
    const handleViewportChange = () => updatePosition();

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [closeMenu, isOpen, updatePosition]);

  useEffect(() => {
    if (isOpen) setActiveIndex(selectedIndex);
  }, [isOpen, selectedIndex]);

  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;

    menuRef.current
      ?.querySelectorAll<HTMLElement>('[role="option"]')
      [activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, isOpen]);

  function moveActiveIndex(direction: 1 | -1) {
    const nextIndex = findEnabledOption(options, activeIndex + direction, direction);
    if (nextIndex >= 0) setActiveIndex(nextIndex);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) {
        openMenu();
      } else {
        moveActiveIndex(event.key === 'ArrowDown' ? 1 : -1);
      }
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (isOpen) selectOption(activeIndex);
      else openMenu();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
      return;
    }

    if (event.key === 'Tab') closeMenu();
  }

  return (
    <>
      <button
        id={triggerId}
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-activedescendant={isOpen ? `${menuId}-option-${activeIndex}` : undefined}
        className={`dropdown-select-trigger ${variant === 'field' ? 'form-input dropdown-select-field' : ''}`}
        disabled={disabled}
        onClick={() => (isOpen ? closeMenu() : openMenu())}
        onKeyDown={handleKeyDown}
      >
        {selectedOption?.label ?? ''}
      </button>

      {isOpen && position
        ? createPortal(
            <div
              id={menuId}
              ref={menuRef}
              role="listbox"
              aria-label={ariaLabel}
              className={`dropdown-select-menu is-${position.placement}`}
              style={{
                left: position.left,
                top: position.top,
                width: position.width,
                maxHeight: position.maxHeight,
              }}
            >
              {options.map((option, index) => (
                <button
                  id={`${menuId}-option-${index}`}
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  className={`dropdown-select-option ${index === activeIndex ? 'is-active' : ''}`}
                  disabled={option.disabled}
                  onPointerDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectOption(index)}
                >
                  <span>{option.label}</span>
                  {option.value === value ? <span aria-hidden="true">✓</span> : null}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
