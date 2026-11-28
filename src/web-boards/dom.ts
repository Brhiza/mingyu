export type UnknownRecord = Record<string, unknown>;

export function asRecord(value: unknown): UnknownRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      node.setAttribute(k, String(v));
    }
  }
  return node;
}

export function createBoardSvgIcon(
  pathD: string,
  size = 14,
  strokeWidth = 2,
): SVGSVGElement {
  const svg = svgEl('svg', {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': strokeWidth,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'aria-hidden': 'true',
  });
  svg.append(svgEl('path', { d: pathD }));
  return svg;
}

export function createBoardHeader(
  title: string,
  subtitle?: string,
  badges?: Array<{ text: string; tone?: 'accent' | 'neutral' | 'good' | 'warn' }>,
): HTMLElement {
  const header = el('div', 'wb-header');
  const titleWrap = el('div', 'wb-header-main');
  titleWrap.append(el('h3', 'wb-title', title));
  if (subtitle) {
    titleWrap.append(el('p', 'wb-subtitle', subtitle));
  }
  header.append(titleWrap);

  if (badges && badges.length > 0) {
    const badgeRow = el('div', 'wb-badges');
    for (const badge of badges) {
      if (!badge.text) continue;
      const tone = badge.tone ?? 'neutral';
      badgeRow.append(el('span', `wb-badge wb-badge-${tone}`, badge.text));
    }
    if (badgeRow.childElementCount > 0) header.append(badgeRow);
  }
  return header;
}

export function createMetaGrid(items: Array<[string, string | undefined]>): HTMLElement | undefined {
  const valid = items.filter((item): item is [string, string] => Boolean(item[1]));
  if (valid.length === 0) return undefined;
  const dl = el('dl', valid.length === 1 ? 'wb-meta-grid is-single' : 'wb-meta-grid');
  for (const [label, value] of valid) {
    const isWide = value.length > 22 || value.includes('\n');
    const item = el('div', isWide ? 'wb-meta-item is-wide' : 'wb-meta-item');
    item.append(el('dt', 'wb-meta-label', label));
    item.append(el('dd', 'wb-meta-value', value));
    dl.append(item);
  }
  return dl;
}

export function openBoardInfoModal(
  title: string,
  buildContent: () => HTMLElement | DocumentFragment,
): void {
  if (typeof document === 'undefined') return;
  document.querySelector('.wb-info-modal-overlay')?.remove();

  const overlay = el('div', 'wb-info-modal-overlay');
  const dialog = el('div', 'wb-info-modal-dialog');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', title);

  const head = el('div', 'wb-info-modal-head');
  head.append(el('h4', 'wb-info-modal-title', title));
  const closeBtn = el('button', 'wb-info-modal-close');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', '关闭弹窗');
  closeBtn.append(createBoardSvgIcon('M18 6 6 18M6 6l12 12', 14));
  head.append(closeBtn);

  const body = el('div', 'wb-info-modal-body');
  body.append(buildContent());

  dialog.append(head, body);
  overlay.append(dialog);

  const close = () => {
    document.removeEventListener('keydown', onKeyDown);
    overlay.remove();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      close();
    }
  };

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', onKeyDown);
  document.body.append(overlay);
}

export function createBoardModalTrigger(
  label: string,
  title: string,
  buildContent: () => HTMLElement | DocumentFragment,
  badge?: string,
): HTMLButtonElement {
  const btn = el('button', 'wb-detail-trigger-btn');
  btn.type = 'button';
  btn.append(el('span', 'wb-detail-trigger-label', label));
  if (badge) {
    btn.append(el('span', 'wb-detail-trigger-badge', badge));
  }
  const arrow = el('span', 'wb-detail-trigger-arrow');
  arrow.append(createBoardSvgIcon('m9 18 6-6-6-6', 14));
  btn.append(arrow);
  btn.addEventListener('click', () => openBoardInfoModal(title, buildContent));
  return btn;
}

export function createBoardDetailBar(
  triggers: Array<HTMLElement | undefined | null>,
): HTMLElement | undefined {
  const valid = triggers.filter((node): node is HTMLElement => Boolean(node));
  if (valid.length === 0) return undefined;
  const bar = el('div', 'wb-detail-actions-bar');
  bar.append(...valid);
  return bar;
}
