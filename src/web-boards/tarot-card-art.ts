import { el } from './dom';
import tarotData from '../systems/tarot-data.json';
import lenormandData from '../systems/lenormand-data.json';
import { loadGlobalRules, type TarotDeckId } from '../web-settings';

const TAROT_NAME_TO_INDEX = new Map<string, number>(
  tarotData.cards.map((card, index) => [card.name, index]),
);

const LENORMAND_NAME_TO_ID = new Map<string, number>(
  lenormandData.cards.map((card) => [card.name, card.id]),
);

const SHARED_CARD_BACK_URL = '/card-decks/lenormand/danjie-leopard/back.webp';

function getActiveTarotDeck(): TarotDeckId {
  return loadGlobalRules().casting.tarotDeck;
}

function resolveTarotAssetIndex(card: TarotCardFaceInput): number {
  if (typeof card.id === 'number' && Number.isInteger(card.id) && card.id >= 1 && card.id <= 78) {
    return card.id - 1;
  }
  const byName = TAROT_NAME_TO_INDEX.get(card.name.trim());
  return typeof byName === 'number' ? byName : 0;
}

function resolveLenormandAssetId(card: LenormandCardFaceInput): number {
  if (typeof card.id === 'number' && Number.isInteger(card.id) && card.id >= 1 && card.id <= 36) {
    return card.id;
  }
  const byName = LENORMAND_NAME_TO_ID.get(card.name.trim());
  return typeof byName === 'number' ? byName : 1;
}

function buildTarotImageUrl(deckId: TarotDeckId, assetIndex: number): string {
  return `/card-decks/tarot/${deckId}/${String(assetIndex).padStart(3, '0')}.webp`;
}

function buildLenormandImageUrl(id: number): string {
  return `/card-decks/lenormand/danjie-leopard/${String(id).padStart(3, '0')}.webp`;
}

function resolveCardMaxWidth(size: 'sm' | 'md' | 'lg' = 'md'): string {
  return size === 'sm' ? '124px' : size === 'lg' ? '196px' : '156px';
}

function createCardFaceRoot(className: string, maxW: string): HTMLElement {
  const root = el('div', className);
  root.style.cssText = [
    'width: 100%',
    `max-width: ${maxW}`,
    'aspect-ratio: 2 / 3',
    'margin: 0 auto',
    'padding: 0',
    'border: 0',
    'border-radius: 12px',
    'background: transparent',
    'overflow: hidden',
    'position: relative',
    'user-select: none',
    'filter: drop-shadow(0 10px 16px rgba(41, 33, 52, 0.16))',
  ].join('; ');
  return root;
}

let deckChangeListenerAttached = false;
function ensureDeckChangeListener(): void {
  if (deckChangeListenerAttached || typeof window === 'undefined') return;
  deckChangeListenerAttached = true;
  window.addEventListener('mingyu:global-rules-changed', () => {
    const nextDeck = getActiveTarotDeck();
    document
      .querySelectorAll<HTMLImageElement>('img.tarot-art-deck-img[data-tarot-index]')
      .forEach((img) => {
        const idx = Number(img.dataset.tarotIndex ?? '0');
        img.src = buildTarotImageUrl(nextDeck, Number.isInteger(idx) ? idx : 0);
      });
  });
}

export interface TarotCardFaceInput {
  id?: number;
  name: string;
  reversed?: boolean;
  position?: string;
  element?: string;
  keywords?: readonly string[];
}

export interface TarotCardFaceOptions {
  size?: 'sm' | 'md' | 'lg';
}

export interface TarotCardBackOptions {
  label?: string;
  sublabel?: string;
  active?: boolean;
  size?: 'sm' | 'md';
  deckTheme?: 'tarot' | 'lenormand';
  onClick?: () => void;
}

export interface LenormandCardFaceInput {
  id?: number;
  name: string;
  position?: string;
  meaning?: string;
  keywords?: readonly string[];
  isHomeHouse?: boolean;
}

/**
 * 渲染纯净满幅 2:3 实景塔罗牌面（无内置边框与叠加文字，逆位时图像完整倒转 180°）
 */
export function createTarotCardFace(
  card: TarotCardFaceInput,
  options?: TarotCardFaceOptions,
): HTMLElement {
  const reversed = Boolean(card.reversed);
  const size = options?.size ?? 'md';
  const maxW = resolveCardMaxWidth(size);

  ensureDeckChangeListener();
  const deckId = getActiveTarotDeck();
  const assetIndex = resolveTarotAssetIndex(card);

  const root = createCardFaceRoot(
    `tarot-art-card is-size-${size}${reversed ? ' is-reversed' : ''}`,
    maxW,
  );

  const img = document.createElement('img');
  img.className = 'tarot-art-deck-img';
  img.dataset.tarotIndex = String(assetIndex);
  img.src = buildTarotImageUrl(deckId, assetIndex);
  img.alt = card.name || '塔罗牌面';
  img.loading = 'lazy';
  img.draggable = false;
  img.style.cssText = [
    'width: 100%',
    'height: 100%',
    'object-fit: contain',
    'display: block',
    `transform: ${reversed ? 'rotate(180deg)' : 'none'}`,
    'transition: transform 0.3s ease',
  ].join('; ');

  root.appendChild(img);
  return root;
}

/**
 * 渲染塔罗实景牌背 / 雷诺曼牌背（无外框，纯净 2:3 图样展示）
 */
export function createTarotCardBack(options?: TarotCardBackOptions): HTMLElement {
  const active = Boolean(options?.active);
  const size = options?.size ?? 'sm';
  const maxW = size === 'sm' ? '106px' : '136px';
  const deckTheme = options?.deckTheme ?? 'tarot';
  const tag = options?.onClick ? 'button' : 'div';
  const root = document.createElement(tag);
  if (root instanceof HTMLButtonElement) {
    root.type = 'button';
  }

  ensureDeckChangeListener();
  root.className = `tarot-art-card-back${active ? ' is-active' : ''}${options?.onClick ? ' is-clickable' : ''}`;
  root.style.cssText = [
    'width: 100%',
    `max-width: ${maxW}`,
    'aspect-ratio: 2 / 3',
    'padding: 0',
    'border: 0',
    'border-radius: 11px',
    'background: transparent',
    'overflow: hidden',
    'position: relative',
    'display: block',
    `cursor: ${options?.onClick ? 'pointer' : 'default'}`,
    `filter: ${
      active
        ? 'drop-shadow(0 0 8px rgba(180, 83, 9, 0.35)) drop-shadow(0 8px 16px rgba(41, 33, 52, 0.24))'
        : 'drop-shadow(0 8px 14px rgba(41, 33, 52, 0.18))'
    }`,
    'transition: transform 0.2s ease, filter 0.2s ease',
  ].join('; ');

  const img = document.createElement('img');
  img.className = 'tarot-back-deck-img';
  img.dataset.deckTheme = deckTheme;
  img.src = SHARED_CARD_BACK_URL;
  img.alt = options?.label
    ? `${options.label}牌背`
    : deckTheme === 'lenormand'
      ? '雷诺曼牌背'
      : '塔罗牌背';
  img.loading = 'lazy';
  img.draggable = false;
  img.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;';
  root.appendChild(img);

  if (options?.label || options?.sublabel) {
    const caption = el('div', 'tarot-back-caption');
    caption.style.cssText =
      'position:absolute;left:0;right:0;bottom:0;text-align:center;padding:12px 6px 5px;background:linear-gradient(180deg, transparent 0%, rgba(16, 12, 24, 0.8) 55%);line-height:1.25;';
    if (options.label) {
      const l = el('div', 'tarot-back-label', options.label);
      l.style.cssText =
        'font-size:11px;font-weight:700;color:#fef3c7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      caption.appendChild(l);
    }
    if (options.sublabel) {
      const s = el('div', 'tarot-back-sublabel', options.sublabel);
      s.style.cssText = 'font-size:9.5px;color:#e2e8f0;';
      caption.appendChild(s);
    }
    root.appendChild(caption);
  }

  if (options?.onClick) {
    root.addEventListener('click', options.onClick);
  }
  return root;
}

/**
 * 渲染纯净满幅 2:3 实景雷诺曼牌面（无内置边框与叠加文字，对齐塔罗牌面风格）
 */
export function createLenormandCardFace(
  card: LenormandCardFaceInput,
  options?: TarotCardFaceOptions,
): HTMLElement {
  const size = options?.size ?? 'md';
  const maxW = resolveCardMaxWidth(size);
  const assetId = resolveLenormandAssetId(card);

  const root = createCardFaceRoot(
    `lenormand-art-card is-size-${size}${card.isHomeHouse ? ' is-home-house' : ''}`,
    maxW,
  );

  const img = document.createElement('img');
  img.className = 'lenormand-art-deck-img';
  img.dataset.lenormandId = String(assetId);
  img.src = buildLenormandImageUrl(assetId);
  img.alt = card.name || '雷诺曼牌面';
  img.loading = 'lazy';
  img.draggable = false;
  img.style.cssText = [
    'width: 100%',
    'height: 100%',
    'object-fit: contain',
    'display: block',
  ].join('; ');

  root.appendChild(img);
  return root;
}
