import { el } from './dom';
import tarotData from '../systems/tarot-data.json';
import lenormandData from '../systems/lenormand-data.json';
import {
  getActiveSkinThemeFromDocument,
  getAssetOrigin,
  getSkinCardBackUrl,
  getSkinLenormandCardUrl,
  getSkinTarotCardUrl,
  resolveRemoteAssetUrl,
} from '../remote-assets';
import { loadGlobalRules, type TarotDeckId } from '../web-settings';

const TAROT_NAME_TO_INDEX = new Map<string, number>(
  tarotData.cards.map((card, index) => [card.name, index]),
);

const LENORMAND_NAME_TO_ID = new Map<string, number>(
  lenormandData.cards.map((card) => [card.name, card.id]),
);

export function getSharedCardBackUrl(): string {
  const skin = getActiveSkinThemeFromDocument();
  if (skin && getAssetOrigin()) {
    return getSkinCardBackUrl(skin) ?? SHARED_CARD_BACK_URL;
  }
  return SHARED_CARD_BACK_URL;
}
export const SHARED_CARD_BACK_URL = '/cards/lenormand/back.webp';

export function getActiveTarotDeck(): TarotDeckId {
  return loadGlobalRules().casting.tarotDeck;
}

export function getTarotCardImageUrl(
  card: Pick<TarotCardFaceInput, 'id' | 'name'>,
  deckId: TarotDeckId = getActiveTarotDeck(),
): string {
  return buildTarotImageUrl(deckId, resolveTarotAssetIndex(card));
}

export function getLenormandCardImageUrl(
  card: Pick<LenormandCardFaceInput, 'id' | 'name'>,
): string {
  return buildLenormandImageUrl(resolveLenormandAssetId(card));
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

function buildDefaultTarotImageUrl(assetIndex: number): string {
  return `/cards/tarot/${String(assetIndex).padStart(3, '0')}.webp`;
}

function buildDefaultLenormandImageUrl(id: number): string {
  return `/cards/lenormand/${String(id).padStart(3, '0')}.webp`;
}

function buildTarotImageUrl(deckId: TarotDeckId, assetIndex: number): string {
  if (deckId === 'skin') {
    const skin = getActiveSkinThemeFromDocument();
    if (skin) {
      const skinUrl = getSkinTarotCardUrl(skin, assetIndex);
      if (skinUrl) return skinUrl;
    }
    return buildDefaultTarotImageUrl(assetIndex);
  }
  if (deckId === 'danjie-leopard') {
    return buildDefaultTarotImageUrl(assetIndex);
  }
  return resolveRemoteAssetUrl(
    `/card-decks/tarot/${deckId}/${String(assetIndex).padStart(3, '0')}.webp`,
  );
}

function buildLenormandImageUrl(id: number): string {
  const skin = getActiveSkinThemeFromDocument();
  if (skin) {
    const skinUrl = getSkinLenormandCardUrl(skin, id);
    if (skinUrl) return skinUrl;
  }
  return buildDefaultLenormandImageUrl(id);
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
function syncRenderedDeckArtwork(): void {
  const nextDeck = getActiveTarotDeck();
  document
    .querySelectorAll<HTMLImageElement>('img.tarot-art-deck-img[data-tarot-index]')
    .forEach((img) => {
      const idx = Number(img.dataset.tarotIndex ?? '0');
      delete img.dataset.fallbackApplied;
      img.src = buildTarotImageUrl(nextDeck, Number.isInteger(idx) ? idx : 0);
    });
  document
    .querySelectorAll<HTMLImageElement>('img.lenormand-art-deck-img[data-lenormand-id]')
    .forEach((img) => {
      const id = Number(img.dataset.lenormandId ?? '1');
      delete img.dataset.fallbackApplied;
      img.src = buildLenormandImageUrl(Number.isInteger(id) ? id : 1);
    });
  const backUrl = getSharedCardBackUrl();
  document.querySelectorAll<HTMLImageElement>('img.tarot-back-deck-img').forEach((img) => {
    delete img.dataset.fallbackApplied;
    img.src = backUrl;
  });
}

function ensureDeckChangeListener(): void {
  if (deckChangeListenerAttached || typeof window === 'undefined') return;
  deckChangeListenerAttached = true;
  window.addEventListener('mingyu:global-rules-changed', syncRenderedDeckArtwork);
  window.addEventListener('mingyu:theme-changed', syncRenderedDeckArtwork);
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
  img.addEventListener('error', () => {
    const fallbackUrl = buildDefaultTarotImageUrl(assetIndex);
    if (!img.dataset.fallbackApplied && img.src !== fallbackUrl) {
      img.dataset.fallbackApplied = '1';
      img.src = fallbackUrl;
      return;
    }
    img.remove();
    const fallback = el('div', 'tarot-card-text-fallback');
    fallback.style.cssText =
      'width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px;text-align:center;border:1px solid var(--border-soft);border-radius:12px;background:var(--surface-soft);color:var(--text-strong);gap:6px;';
    fallback.appendChild(el('strong', '', card.name || '塔罗牌'));
    fallback.appendChild(el('span', '', reversed ? '逆位' : '正位'));
    root.appendChild(fallback);
  });

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
  img.src = getSharedCardBackUrl();
  img.alt = options?.label
    ? `${options.label}牌背`
    : deckTheme === 'lenormand'
      ? '雷诺曼牌背'
      : '塔罗牌背';
  img.loading = 'lazy';
  img.draggable = false;
  img.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;';
  img.addEventListener('error', () => {
    img.remove();
    const fallback = el('div', 'tarot-back-text-fallback');
    fallback.style.cssText =
      'width:100%;height:100%;display:flex;align-items:center;justify-content:center;border:1px solid var(--border-strong);border-radius:11px;background:var(--accent-surface);color:var(--accent-deep);font-size:12px;font-weight:700;';
    fallback.textContent = deckTheme === 'lenormand' ? '雷诺曼' : '塔罗';
    root.insertBefore(fallback, root.firstChild);
  });
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

  ensureDeckChangeListener();
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
  img.addEventListener('error', () => {
    const fallbackUrl = buildDefaultLenormandImageUrl(assetId);
    if (!img.dataset.fallbackApplied && img.src !== fallbackUrl) {
      img.dataset.fallbackApplied = '1';
      img.src = fallbackUrl;
      return;
    }
    img.remove();
    const fallback = el('div', 'lenormand-card-text-fallback');
    fallback.style.cssText =
      'width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px;text-align:center;border:1px solid var(--border-soft);border-radius:12px;background:var(--surface-soft);color:var(--text-strong);gap:4px;';
    fallback.appendChild(el('strong', '', card.name || '雷诺曼'));
    fallback.appendChild(el('span', '', `#${assetId}`));
    root.appendChild(fallback);
  });

  root.appendChild(img);
  return root;
}
