import { lookupMetaphysicsTerm, type MetaphysicsTerm } from '../systems/terms';
import {
  closeTermModalSession,
  openTermModalSession,
  type TermModalFallback,
} from '../app/modal-bus';
import { createBoardSvgIcon } from './dom';

export type Wuxing = '木' | '火' | '土' | '金' | '水';

const WUXING_MAP: Record<string, Wuxing> = {
  甲: '木',
  乙: '木',
  寅: '木',
  卯: '木',
  木: '木',
  丙: '火',
  丁: '火',
  巳: '火',
  午: '火',
  火: '火',
  戊: '土',
  己: '土',
  辰: '土',
  戌: '土',
  丑: '土',
  未: '土',
  土: '土',
  庚: '金',
  辛: '金',
  申: '金',
  酉: '金',
  金: '金',
  壬: '水',
  癸: '水',
  亥: '水',
  子: '水',
  水: '水',
};

export function getWuxing(value: string | undefined): Wuxing | undefined {
  if (!value) return undefined;
  return WUXING_MAP[value.trim()];
}

export type DomChild = Node | string | number | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: {
    className?: string;
    text?: string;
    title?: string;
    role?: string;
    type?: 'button' | 'submit' | 'reset';
    dataset?: Record<string, string | undefined>;
    ariaLabel?: string;
    ariaPressed?: string;
    onClick?: (event: MouseEvent) => void;
  },
  ...children: DomChild[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (attrs) {
    if (attrs.className) node.className = attrs.className;
    if (attrs.text !== undefined) node.textContent = attrs.text;
    if (attrs.title) node.title = attrs.title;
    if (attrs.role) node.setAttribute('role', attrs.role);
    if (attrs.type && node instanceof HTMLButtonElement) node.type = attrs.type;
    if (attrs.ariaLabel) node.setAttribute('aria-label', attrs.ariaLabel);
    if (attrs.ariaPressed) node.setAttribute('aria-pressed', attrs.ariaPressed);
    if (attrs.dataset) {
      for (const [key, val] of Object.entries(attrs.dataset)) {
        if (val !== undefined) node.dataset[key] = val;
      }
    }
    if (attrs.onClick) {
      const handler = attrs.onClick;
      node.addEventListener('click', (event) => handler(event as MouseEvent));
    }
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === 'number' ? String(child) : child);
  }
  return node;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string | number | undefined>,
  ...children: (SVGElement | string | null | undefined | false)[]
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  if (attrs) {
    for (const [key, val] of Object.entries(attrs)) {
      if (val !== undefined) node.setAttribute(key, String(val));
    }
  }
  for (const child of children) {
    if (!child) continue;
    if (typeof child === 'string') {
      node.append(document.createTextNode(child));
    } else {
      node.append(child);
    }
  }
  return node;
}

export function unwrapBoardData(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  if ('data' in record && record.data && typeof record.data === 'object') {
    return record.data as Record<string, unknown>;
  }
  return record;
}

function renderTermContent(panel: HTMLElement, query: string, term: MetaphysicsTerm | undefined) {
  panel.replaceChildren();

  const header = el('div', { className: 'board-term-head' });
  const titleWrap = el('div', { className: 'board-term-title-wrap' });
  titleWrap.append(
    el('strong', { className: 'board-term-title', text: term ? term.term : query }),
  );
  if (term?.category) {
    titleWrap.append(el('span', { className: 'board-term-badge', text: term.category }));
  }
  if (term?.pinyin) {
    titleWrap.append(el('span', { className: 'board-term-pinyin', text: term.pinyin }));
  }

  const closeBtn = el('button', {
    type: 'button',
    className: 'board-term-close',
    text: '关闭',
    ariaLabel: '关闭术语解释',
    onClick: () => {
      panel.hidden = true;
      panel.replaceChildren();
    },
  });

  header.append(titleWrap, closeBtn);
  panel.append(header);

  if (!term) {
    panel.append(
      el('p', {
        className: 'board-term-detail',
        text: `暂未收录「${query}」的术语词条，可前往术语百科检索相近概念。`,
      }),
    );
    return;
  }

  if (term.summary) {
    panel.append(el('p', { className: 'board-term-summary', text: term.summary }));
  }
  if (term.detail) {
    panel.append(el('p', { className: 'board-term-detail', text: term.detail }));
  }
  if (term.classicRef) {
    panel.append(el('p', { className: 'board-term-ref', text: `典籍出处：${term.classicRef}` }));
  }
}

export interface TermPanelController {
  element: HTMLElement;
  open: (query: string) => void;
  close: () => void;
}

export function openTermModal(query: string, fallback?: TermModalFallback): void {
  openTermModalSession(query, fallback);
}

/** 创建带统一点击弹窗行为的术数术语按钮。 */
export function createTermTrigger(
  label: string,
  query: string,
  extraClass?: string,
  fallback?: TermModalFallback,
): HTMLButtonElement {
  return el('button', {
    type: 'button',
    className: extraClass ? `board-term-trigger ${extraClass}` : 'board-term-trigger',
    text: label,
    title: `点击查看「${label}」详情与经文/百科释义`,
    onClick: (event) => {
      event.stopPropagation();
      openTermModal(query, fallback);
    },
  });
}

export function createTermPanel(): TermPanelController {
  const element = el('aside', {
    className: 'board-term-panel',
    ariaLabel: '术语解释',
  });
  element.hidden = true;

  return {
    element,
    open(query: string) {
      const cleaned = query.trim();
      if (!cleaned) return;
      openTermModal(cleaned);
    },
    close() {
      element.hidden = true;
      element.replaceChildren();
      closeTermModalSession();
    },
  };
}

export interface MobileDetailSheetController {
  element: HTMLElement;
  open: () => void;
  close: () => void;
}

/**
 * 移动端 (< 900px) 宫位详情底部抽屉包装器：桌面端保持原地静态展示，移动端点击宫位后以 Bottom Sheet 滑出。
 */
export function createMobileDetailSheet(
  detailCard: HTMLElement,
  options?: { label?: string; closeLabel?: string },
): MobileDetailSheetController {
  const sheet = el('div', { className: 'wb-detail-sheet' });
  const backdrop = el('div', {
    className: 'wb-detail-backdrop',
    onClick: () => close(),
  });
  backdrop.setAttribute('aria-hidden', 'true');

  const closeBtn = el('button', {
    type: 'button',
    className: 'wb-detail-close',
    ariaLabel: options?.closeLabel ?? '关闭宫位详情',
    onClick: () => close(),
  });
  closeBtn.append(createBoardSvgIcon('M18 6 6 18M6 6l12 12', 16));

  const bar = el(
    'div',
    { className: 'wb-detail-sheet-bar' },
    el('span', { className: 'wb-detail-sheet-spacer' }),
    el('span', { className: 'wb-detail-handle' }),
    closeBtn,
  );

  const panel = el(
    'div',
    {
      className: 'wb-detail-sheet-panel',
      role: 'dialog',
      ariaLabel: options?.label ?? '宫位详情',
    },
    bar,
    detailCard,
  );

  sheet.append(backdrop, panel);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      close();
    }
  };

  const close = () => {
    sheet.classList.remove('is-open');
    document.removeEventListener('keydown', onKeyDown);
  };

  const open = () => {
    if (typeof window !== 'undefined' && window.innerWidth >= 900) return;
    sheet.classList.add('is-open');
    panel.scrollTop = 0;
    document.addEventListener('keydown', onKeyDown);
  };

  return { element: sheet, open, close };
}
