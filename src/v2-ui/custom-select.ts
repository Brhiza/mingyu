import { computeDropdownPosition } from '../components/ui/select-utils';

export interface CustomSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface CreateCustomSelectOptions {
  options: ReadonlyArray<CustomSelectOption>;
  value: string;
  ariaLabel?: string;
  variant?: 'compact' | 'inline';
  onChange: (value: string) => void;
}

let activeCloseCurrent: (() => void) | null = null;

function createSvgIcon(pathD: string, className: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', className);
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pathD);
  svg.appendChild(path);
  return svg;
}

export function createCustomSelect(opts: CreateCustomSelectOptions): HTMLElement {
  const { options, ariaLabel, variant = 'compact', onChange } = opts;
  let currentValue = opts.value;

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = `ui-custom-select-trigger ${variant === 'inline' ? 'is-inline' : 'is-sm is-compact'}`;
  trigger.setAttribute('role', 'combobox');
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  if (ariaLabel) trigger.setAttribute('aria-label', ariaLabel);

  const labelSpan = document.createElement('span');
  labelSpan.className = 'ui-custom-select-value';

  const chevron = createSvgIcon('m6 9 6 6 6-6', 'ui-custom-select-chevron');
  trigger.append(labelSpan, chevron);

  const syncLabel = () => {
    const matched = options.find((o) => o.value === currentValue);
    labelSpan.textContent = matched?.label ?? (currentValue || '请选择');
    labelSpan.classList.toggle('is-placeholder', !matched);
  };
  syncLabel();

  let menuEl: HTMLDivElement | null = null;
  let highlightedIdx = -1;
  let cleanupFns: Array<() => void> = [];

  const closeMenu = () => {
    if (!menuEl) return;
    cleanupFns.forEach((fn) => fn());
    cleanupFns = [];
    menuEl.remove();
    menuEl = null;
    trigger.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
    if (activeCloseCurrent === closeMenu) activeCloseCurrent = null;
  };

  const positionMenu = () => {
    if (!menuEl || !trigger.isConnected) {
      closeMenu();
      return;
    }
    const rect = trigger.getBoundingClientRect();
    const pos = computeDropdownPosition(
      { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width },
      { width: window.innerWidth, height: window.innerHeight },
      Math.min(320, Math.max(120, options.length * 34 + 14)),
    );
    menuEl.dataset.placement = pos.placement;
    menuEl.style.top = pos.top !== undefined ? `${pos.top}px` : '';
    menuEl.style.bottom = pos.bottom !== undefined ? `${pos.bottom}px` : '';
    menuEl.style.left = `${pos.left}px`;
    menuEl.style.minWidth = `${pos.minWidth}px`;
    menuEl.style.maxWidth = `${pos.maxWidth}px`;
    menuEl.style.maxHeight = `${pos.maxHeight}px`;
  };

  const syncOptionStates = () => {
    if (!menuEl) return;
    const btns = menuEl.querySelectorAll<HTMLButtonElement>('.ui-custom-select-option');
    btns.forEach((btn, idx) => {
      const opt = options[idx];
      const isSelected = opt?.value === currentValue;
      btn.setAttribute('aria-selected', String(isSelected));
      btn.classList.toggle('is-selected', isSelected);
      btn.classList.toggle('is-highlighted', idx === highlightedIdx && !isSelected);
    });
  };

  const openMenu = () => {
    if (options.length === 0 || !trigger.isConnected) return;
    if (activeCloseCurrent && activeCloseCurrent !== closeMenu) {
      activeCloseCurrent();
    }
    activeCloseCurrent = closeMenu;

    const menu = document.createElement('div');
    menu.className = 'ui-custom-select-menu';
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('data-ui-select-menu', 'true');
    if (ariaLabel) menu.setAttribute('aria-label', ariaLabel);
    menu.style.position = 'fixed';
    menu.style.pointerEvents = 'auto';

    menu.addEventListener('pointerdown', (e) => e.stopPropagation());
    menu.addEventListener('click', (e) => e.stopPropagation());

    highlightedIdx = options.findIndex((o) => o.value === currentValue && !o.disabled);
    if (highlightedIdx < 0) highlightedIdx = options.findIndex((o) => !o.disabled);

    options.forEach((opt, idx) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.setAttribute('role', 'option');
      item.disabled = Boolean(opt.disabled);
      const isSelected = opt.value === currentValue;
      item.setAttribute('aria-selected', String(isSelected));
      item.className = `ui-custom-select-option${isSelected ? ' is-selected' : ''}`;

      const textSpan = document.createElement('span');
      textSpan.className = 'ui-custom-select-option-label';
      textSpan.textContent = opt.label;
      item.appendChild(textSpan);

      if (isSelected) {
        item.appendChild(createSvgIcon('M20 6 9 17l-5-5', 'ui-custom-select-check'));
      }

      item.addEventListener('mouseenter', () => {
        if (!opt.disabled) {
          highlightedIdx = idx;
          syncOptionStates();
        }
      });

      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (opt.disabled) return;
        const prev = currentValue;
        currentValue = opt.value;
        syncLabel();
        closeMenu();
        trigger.focus();
        if (opt.value !== prev) {
          onChange(opt.value);
        }
      });

      menu.appendChild(item);
    });

    document.body.appendChild(menu);
    menuEl = menu;
    trigger.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    positionMenu();

    const activeBtn = menu.querySelector<HTMLElement>('.ui-custom-select-option.is-selected');
    if (activeBtn) {
      const top = activeBtn.offsetTop;
      const bottom = top + activeBtn.offsetHeight;
      if (top < menu.scrollTop) menu.scrollTop = Math.max(0, top - 6);
      else if (bottom > menu.scrollTop + menu.clientHeight) {
        menu.scrollTop = bottom - menu.clientHeight + 6;
      }
    }

    const onDocPointerDown = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if ((t && trigger.contains(t)) || (t && menu.contains(t))) return;
      closeMenu();
    };
    const onDocKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMenu();
        trigger.focus();
      }
    };
    const onWinResize = () => positionMenu();
    const onWinScroll = (e: Event) => {
      const t = e.target as Node | null;
      if (t && menu.contains(t)) return;
      positionMenu();
    };

    document.addEventListener('pointerdown', onDocPointerDown, true);
    document.addEventListener('keydown', onDocKeyDown);
    window.addEventListener('resize', onWinResize);
    window.addEventListener('scroll', onWinScroll, true);

    cleanupFns = [
      () => document.removeEventListener('pointerdown', onDocPointerDown, true),
      () => document.removeEventListener('keydown', onDocKeyDown),
      () => window.removeEventListener('resize', onWinResize),
      () => window.removeEventListener('scroll', onWinScroll, true),
    ];
  };

  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (menuEl) closeMenu();
    else openMenu();
  });

  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!menuEl) openMenu();
      else if (options.length > 0) {
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        for (let step = 0; step < options.length; step += 1) {
          highlightedIdx = (highlightedIdx + delta + options.length) % options.length;
          if (!options[highlightedIdx]?.disabled) break;
        }
        syncOptionStates();
      }
    } else if ((e.key === 'Enter' || e.key === ' ') && menuEl) {
      e.preventDefault();
      const opt = options[highlightedIdx];
      if (opt && !opt.disabled) {
        const prev = currentValue;
        currentValue = opt.value;
        syncLabel();
        closeMenu();
        if (opt.value !== prev) onChange(opt.value);
      }
    }
  });

  return trigger;
}
