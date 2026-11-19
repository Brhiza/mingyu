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
  const dl = el('dl', 'wb-meta-grid');
  for (const [label, value] of valid) {
    const item = el('div', 'wb-meta-item');
    item.append(el('dt', 'wb-meta-label', label));
    item.append(el('dd', 'wb-meta-value', value));
    dl.append(item);
  }
  return dl;
}
