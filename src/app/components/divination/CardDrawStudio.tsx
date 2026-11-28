import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { createShuffledTarotDeck, drawNext, type ShuffledTarotCard } from '../../../interactive';
import tarotData from '../../../systems/tarot-data.json';
import lenormandData from '../../../systems/lenormand-data.json';
import type { TarotDeckId } from '../../../web-settings';
import {
  getActiveTarotDeck,
  getLenormandCardImageUrl,
  getSharedCardBackUrl,
  getTarotCardImageUrl,
} from '../../../web-boards/tarot-card-art';
import { UiSegmentedControl } from '../shared/UiSegmentedControl';
import { Select } from '../../../components/ui';
import { RitualStageShell } from './RitualStageShell';
import {
  LENORMAND_SPREAD_LIST,
  LabeledSelect,
  TAROT_SPREAD_CATEGORIES,
  TAROT_SPREAD_LIST,
  type DrawnCardItem,
} from './divination-shared';

export const INTERACTIVE_DECK_FAN_COUNT = 21;

export function CardBackTile({
  label,
  active,
  deckTheme = 'tarot',
  backUrl,
  onClick,
  fillHeight = false,
}: {
  label?: string;
  active?: boolean;
  deckTheme?: 'tarot' | 'lenormand' | 'oracle';
  backUrl?: string;
  onClick?: () => void;
  fillHeight?: boolean;
}) {
  const defaultBack = getSharedCardBackUrl();
  const [src, setSrc] = React.useState(backUrl || defaultBack);
  const [imgFailed, setImgFailed] = React.useState(false);

  React.useEffect(() => {
    setSrc(backUrl || getSharedCardBackUrl());
    setImgFailed(false);
  }, [backUrl]);

  const fallbackText =
    deckTheme === 'lenormand' ? '雷诺曼' : deckTheme === 'oracle' ? '神谕' : '塔罗';

  return (
    <div
      className={`tarot-art-card-back${active ? ' is-active' : ''}${onClick ? ' is-clickable' : ''}`}
      style={{
        width: '100%',
        maxWidth: fillHeight ? '100%' : '108px',
        height: fillHeight ? '100%' : undefined,
        aspectRatio: '2 / 3',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '11px',
        cursor: onClick ? 'pointer' : undefined,
        boxShadow: active
          ? '0 0 0 2px var(--accent-strong), 0 8px 20px color-mix(in srgb, var(--accent) 24%, transparent)'
          : undefined,
      }}
      onClick={onClick}
    >
      {imgFailed ? (
        <div className="flex h-full w-full items-center justify-center rounded-[11px] border border-[var(--border-strong)] bg-[var(--accent-surface)] text-xs font-bold text-[var(--accent-deep)]">
          {fallbackText}
        </div>
      ) : (
        <img
          className="tarot-back-deck-img"
          data-deck-theme={deckTheme}
          src={src}
          alt={label ? `${label}牌背` : `${fallbackText}牌背`}
          loading="eager"
          draggable={false}
          onError={() => {
            if (src !== defaultBack) {
              setSrc(defaultBack);
            } else {
              setImgFailed(true);
            }
          }}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
      )}
      {active ? <span className="card-back-active-pill">点选</span> : null}
    </div>
  );
}

export function ScrollableCardDeckPanel({
  fanCount = INTERACTIVE_DECK_FAN_COUNT,
  pickedIndices,
  isShuffling,
  isBusy,
  shuffleSeed,
  nextPositionName,
  deckTheme = 'tarot',
  backUrl,
  onPickCard,
  onShuffle,
}: {
  fanCount?: number;
  pickedIndices: readonly number[];
  isShuffling: boolean;
  isBusy: boolean;
  shuffleSeed: number;
  nextPositionName: string;
  deckTheme?: 'tarot' | 'lenormand' | 'oracle';
  backUrl?: string;
  onPickCard: (fanIndex: number) => void;
  onShuffle: () => void;
}) {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const mid = (fanCount - 1) / 2;

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el || isShuffling) return;
    const centerDeck = () => {
      const overflow = el.scrollWidth - el.clientWidth;
      if (overflow > 4) {
        el.scrollLeft = Math.round(overflow / 2);
      }
    };
    const raf = window.requestAnimationFrame(centerDeck);
    return () => window.cancelAnimationFrame(raf);
  }, [isShuffling, shuffleSeed, fanCount]);

  const nudgeScroll = (dir: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 180, behavior: 'smooth' });
  };

  return (
    <div className="tarot-arc-fan-panel">
      <div className="tarot-arc-fan-head">
        <div className="tarot-arc-fan-hint">
          {isShuffling ? '净心洗牌切牌中…' : `滑动牌堆抽取「${nextPositionName}」`}
        </div>
        <button
          type="button"
          disabled={isShuffling || isBusy}
          className="ritual-mini-btn card-shuffle-trigger"
          onClick={onShuffle}
        >
          {isShuffling ? '洗牌中…' : '洗牌切牌'}
        </button>
      </div>

      {isShuffling ? (
        <div className="card-shuffle-orbit" aria-label="洗牌切牌动画">
          {[0, 1, 2, 3, 4].map((idx) => (
            <span
              key={idx}
              className="card-shuffle-flying"
              style={{ '--shuffle-idx': idx } as React.CSSProperties}
            >
              <CardBackTile deckTheme={deckTheme} backUrl={backUrl} fillHeight />
            </span>
          ))}
        </div>
      ) : (
        <div className="card-deck-rail-wrap">
          <button
            type="button"
            className="card-deck-nudge is-prev"
            aria-label="向左浏览牌堆"
            onClick={() => nudgeScroll(-1)}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <div
            ref={scrollRef}
            className="tarot-arc-fan-scroll"
            onWheel={(e) => {
              const el = scrollRef.current;
              if (!el || el.scrollWidth <= el.clientWidth) return;
              if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                e.preventDefault();
                el.scrollLeft += e.deltaY;
              }
            }}
          >
            <div key={shuffleSeed} className="tarot-arc-fan-track is-blooming">
              {Array.from({ length: fanCount }, (_, f) => {
                const offset = (f - mid) / mid;
                const angle = offset * 18;
                const lift = offset * offset * 14;
                const isPicked = pickedIndices.includes(f);
                return (
                  <button
                    key={f}
                    type="button"
                    disabled={isPicked || isBusy}
                    className={`tarot-arc-fan-card${isPicked ? ' is-picked' : ''}`}
                    style={
                      {
                        '--fan-angle': `${angle.toFixed(1)}deg`,
                        '--fan-drop': `${lift.toFixed(1)}px`,
                        '--fan-delay': `${f * 12}ms`,
                        zIndex: 10 + Math.round((1 - Math.abs(offset)) * 10),
                      } as React.CSSProperties
                    }
                    aria-label={isPicked ? '此牌已抽取' : `抽取牌堆第 ${f + 1} 张牌`}
                    onClick={() => onPickCard(f)}
                  >
                    <CardBackTile deckTheme={deckTheme} backUrl={backUrl} fillHeight />
                  </button>
                );
              })}
            </div>
          </div>
          <button
            type="button"
            className="card-deck-nudge is-next"
            aria-label="向右浏览牌堆"
            onClick={() => nudgeScroll(1)}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
          <div className="card-deck-swipe-tip">左右滑动浏览整副牌堆 · 点选即翻开</div>
        </div>
      )}
    </div>
  );
}

function CardArtFrame({
  className,
  src,
  alt,
  title,
  subtitle,
  imgClassName,
  reversed = false,
}: {
  className: string;
  src: string;
  alt: string;
  title: string;
  subtitle?: string;
  imgClassName: string;
  reversed?: boolean;
}) {
  const [loaded, setLoaded] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src]);

  return (
    <div
      className={className}
      style={{
        width: '100%',
        maxWidth: '108px',
        aspectRatio: '2 / 3',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '11px',
        background: 'var(--surface-soft)',
        border: '1px solid var(--border-soft)',
      }}
    >
      {!loaded || failed ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center text-xs text-[var(--text-strong)]">
          <strong>{title}</strong>
          {subtitle ? <span className="text-[10px] text-[var(--text-muted)]">{subtitle}</span> : null}
        </div>
      ) : null}
      {!failed ? (
        <img
          className={imgClassName}
          src={src}
          alt={alt}
          loading="eager"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.18s ease',
            transform: reversed ? 'rotate(180deg)' : undefined,
          }}
        />
      ) : null}
    </div>
  );
}

function TarotCardFace({
  card,
  deckId,
}: {
  card: { id: number; name: string; reversed?: boolean };
  deckId: TarotDeckId;
}) {
  return (
    <CardArtFrame
      className="tarot-art-card"
      imgClassName="tarot-art-deck-img"
      src={getTarotCardImageUrl(card, deckId)}
      alt={card.name || '塔罗牌面'}
      title={card.name}
      subtitle={card.reversed ? '逆位' : '正位'}
      reversed={Boolean(card.reversed)}
    />
  );
}

function LenormandCardFace({ card }: { card: { id: number; name: string } }) {
  return (
    <CardArtFrame
      className="lenormand-art-card"
      imgClassName="lenormand-art-deck-img"
      src={getLenormandCardImageUrl(card)}
      alt={card.name || '雷诺曼牌面'}
      title={card.name}
      subtitle={`#${card.id}`}
    />
  );
}

export function CardDrawStudio({
  method,
  showSubmitButton = false,
  tarotSpreadId,
  tarotDeckScope,
  tarotDrawMode,
  tarotReversalMode,
  tarotDrawnCards,
  lenormandSpreadId,
  lenormandDrawMode,
  lenormandDrawnCards,
  onChangeTarotSpreadId,
  onChangeTarotDeckScope,
  onChangeTarotDrawMode,
  onChangeTarotReversalMode,
  onChangeTarotDrawnCards,
  onChangeLenormandSpreadId,
  onChangeLenormandDrawMode,
  onChangeLenormandDrawnCards,
}: {
  method: 'tarot' | 'lenormand';
  showSubmitButton?: boolean;
  tarotSpreadId: string;
  tarotDeckScope: 'all' | 'major';
  tarotDrawMode: 'interactive' | 'random' | 'manual';
  tarotReversalMode: 'realistic' | 'balanced' | 'upright-only';
  tarotDrawnCards: DrawnCardItem[];
  lenormandSpreadId: string;
  lenormandDrawMode: 'interactive' | 'random' | 'manual';
  lenormandDrawnCards: DrawnCardItem[];
  onChangeTarotSpreadId: (id: string) => void;
  onChangeTarotDeckScope: (scope: 'all' | 'major') => void;
  onChangeTarotDrawMode: (mode: 'interactive' | 'random' | 'manual') => void;
  onChangeTarotReversalMode: (mode: 'realistic' | 'balanced' | 'upright-only') => void;
  onChangeTarotDrawnCards: (cards: DrawnCardItem[]) => void;
  onChangeLenormandSpreadId: (id: string) => void;
  onChangeLenormandDrawMode: (mode: 'interactive' | 'random' | 'manual') => void;
  onChangeLenormandDrawnCards: (cards: DrawnCardItem[]) => void;
}) {
  const [activeTarotDeck, setActiveTarotDeck] = React.useState<TarotDeckId>(() =>
    getActiveTarotDeck(),
  );
  const [skinTick, setSkinTick] = React.useState(0);
  const [isBatchDrawing, setIsBatchDrawing] = React.useState(false);
  const [isShufflingCards, setIsShufflingCards] = React.useState(false);
  const [pickedFanIndices, setPickedFanIndices] = React.useState<number[]>([]);
  const [shuffleSeed, setShuffleSeed] = React.useState(0);
  const shuffledDeckRef = React.useRef<ShuffledTarotCard[] | null>(null);
  const drawingRef = React.useRef(false);
  const shuffleTimerRef = React.useRef<number | null>(null);
  const batchTimerRef = React.useRef<number | null>(null);

  const clearCardTimers = React.useCallback(() => {
    if (shuffleTimerRef.current !== null) {
      window.clearTimeout(shuffleTimerRef.current);
      shuffleTimerRef.current = null;
    }
    if (batchTimerRef.current !== null) {
      window.clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }
    setIsShufflingCards(false);
    setIsBatchDrawing(false);
  }, []);

  React.useEffect(() => clearCardTimers, [clearCardTimers]);

  React.useEffect(() => {
    const syncDeck = () => {
      setActiveTarotDeck(getActiveTarotDeck());
      setSkinTick((t) => t + 1);
    };
    window.addEventListener('mingyu:global-rules-changed', syncDeck);
    window.addEventListener('mingyu:theme-changed', syncDeck);
    window.addEventListener('mingyu:remote-skins-loaded', syncDeck);
    return () => {
      window.removeEventListener('mingyu:global-rules-changed', syncDeck);
      window.removeEventListener('mingyu:theme-changed', syncDeck);
      window.removeEventListener('mingyu:remote-skins-loaded', syncDeck);
    };
  }, []);

  const isTarot = method === 'tarot';
  const spreads = isTarot ? TAROT_SPREAD_LIST : LENORMAND_SPREAD_LIST;
  const currentSpreadId = isTarot ? tarotSpreadId : lenormandSpreadId;
  const currentSpread = spreads.find((s) => s.id === currentSpreadId) ?? spreads[0]!;
  const currentMode = isTarot ? tarotDrawMode : lenormandDrawMode;
  const drawn = isTarot ? tarotDrawnCards : lenormandDrawnCards;
  const backUrl = React.useMemo(() => getSharedCardBackUrl(), [skinTick]);

  React.useEffect(() => {
    if (drawn.length === 0) {
      setPickedFanIndices([]);
    }
  }, [drawn.length]);

  const deckForManual = React.useMemo(
    () =>
      isTarot
        ? (tarotDeckScope === 'major' ? tarotData.cards.slice(0, 22) : tarotData.cards).map(
            (c, idx) => ({ id: idx + 1, name: c.name }),
          )
        : lenormandData.cards.map((c) => ({ id: c.id, name: c.name })),
    [isTarot, tarotDeckScope],
  );

  // 手动录牌模式切换牌阵/范围时同步补齐默认牌面
  React.useEffect(() => {
    if (currentMode !== 'manual') return;
    if (drawn.length === currentSpread.cardCount) return;
    const initialCards: DrawnCardItem[] = currentSpread.positions.map((pos, idx) => ({
      id: deckForManual[idx % deckForManual.length]!.id,
      name: deckForManual[idx % deckForManual.length]!.name,
      position: pos,
      ...(isTarot ? { reversed: false } : {}),
    }));
    if (isTarot) onChangeTarotDrawnCards(initialCards);
    else onChangeLenormandDrawnCards(initialCards);
  }, [
    currentMode,
    currentSpread.cardCount,
    currentSpread.positions,
    deckForManual,
    drawn.length,
    isTarot,
    onChangeLenormandDrawnCards,
    onChangeTarotDrawnCards,
  ]);

  const drawSingleNext = async (currentCards: DrawnCardItem[]) => {
    if (isTarot && (!shuffledDeckRef.current || currentCards.length === 0)) {
      shuffledDeckRef.current = await createShuffledTarotDeck({
        majorOnly: tarotDeckScope === 'major',
        reversalMode: tarotReversalMode,
      });
    }
    const next = await drawNext(
      isTarot ? 'tarot' : 'lenormand',
      currentSpread.id,
      currentCards,
      undefined,
      isTarot
        ? {
            majorOnly: tarotDeckScope === 'major',
            reversalMode: tarotReversalMode,
            preShuffledDeck: shuffledDeckRef.current ?? undefined,
          }
        : undefined,
    );
    return [...currentCards, next.card];
  };

  const triggerDrawNext = async (fanIndex?: number) => {
    if (
      isShufflingCards ||
      isBatchDrawing ||
      drawingRef.current ||
      drawn.length >= currentSpread.cardCount
    ) {
      return;
    }
    drawingRef.current = true;
    try {
      const updated = await drawSingleNext(drawn);
      const chosenSlot =
        typeof fanIndex === 'number'
          ? fanIndex
          : Array.from({ length: INTERACTIVE_DECK_FAN_COUNT }, (_, i) => i).find(
              (idx) => !pickedFanIndices.includes(idx),
            );
      if (typeof chosenSlot === 'number') {
        setPickedFanIndices((prev) => (prev.includes(chosenSlot) ? prev : [...prev, chosenSlot]));
      }
      if (isTarot) onChangeTarotDrawnCards(updated);
      else onChangeLenormandDrawnCards(updated);
    } finally {
      drawingRef.current = false;
    }
  };

  const triggerShuffleCards = () => {
    if (isShufflingCards || isBatchDrawing) return;
    clearCardTimers();
    shuffledDeckRef.current = null;
    setPickedFanIndices([]);
    if (isTarot) onChangeTarotDrawnCards([]);
    else onChangeLenormandDrawnCards([]);
    setIsShufflingCards(true);
    shuffleTimerRef.current = window.setTimeout(() => {
      shuffleTimerRef.current = null;
      setIsShufflingCards(false);
      setShuffleSeed((s) => s + 1);
    }, 580);
  };

  const triggerDrawRemaining = async () => {
    if (isShufflingCards || drawingRef.current || drawn.length >= currentSpread.cardCount) return;
    drawingRef.current = true;
    setIsBatchDrawing(true);
    try {
      let acc = [...drawn];
      let picked = [...pickedFanIndices];
      while (acc.length < currentSpread.cardCount) {
        acc = await drawSingleNext(acc);
        const available = Array.from({ length: INTERACTIVE_DECK_FAN_COUNT }, (_, i) => i).filter(
          (i) => !picked.includes(i),
        );
        if (available.length > 0) {
          picked = [...picked, available[Math.floor(Math.random() * available.length)]!];
          setPickedFanIndices(picked);
        }
        if (isTarot) onChangeTarotDrawnCards(acc);
        else onChangeLenormandDrawnCards(acc);
        if (acc.length < currentSpread.cardCount) {
          await new Promise<void>((resolve) => {
            batchTimerRef.current = window.setTimeout(resolve, 110);
          });
        }
      }
    } finally {
      batchTimerRef.current = null;
      drawingRef.current = false;
      setIsBatchDrawing(false);
    }
  };

  const handleResetDrawn = () => {
    clearCardTimers();
    shuffledDeckRef.current = null;
    setPickedFanIndices([]);
    setShuffleSeed((s) => s + 1);
    if (isTarot) onChangeTarotDrawnCards([]);
    else onChangeLenormandDrawnCards([]);
  };

  const allInteractiveDrawn = currentMode === 'interactive' && drawn.length >= currentSpread.cardCount;
  const isComplete = currentMode !== 'interactive' || allInteractiveDrawn;
  const nextPositionName = currentSpread.positions[drawn.length] ?? `第 ${drawn.length + 1} 张`;

  const stepBar =
    currentMode === 'interactive' ? (
      <div className="ritual-step-bar card-studio-step-bar" aria-label="抽牌仪式进度">
        <span
          className={`ritual-step-pill${shuffleSeed > 0 || drawn.length > 0 ? ' is-done' : ''}${
            isShufflingCards ? ' is-current' : ''
          }`}
        >
          壹 洗牌
        </span>
        <span
          className={`ritual-step-pill${
            allInteractiveDrawn ? ' is-done' : !isShufflingCards ? ' is-current' : ''
          }`}
        >
          {`贰 抽牌 (${drawn.length}/${currentSpread.cardCount})`}
        </span>
        <span className={`ritual-step-pill${allInteractiveDrawn ? ' is-current is-done' : ''}`}>
          叁 启牌
        </span>
        <span className="card-studio-step-label">
          {isShufflingCards
            ? '净心洗牌中…'
            : allInteractiveDrawn
              ? '牌阵已成'
              : `待抽：${nextPositionName}`}
        </span>
      </div>
    ) : null;

  const actions =
    currentMode === 'interactive' && !allInteractiveDrawn ? (
      <>
        <button
          type="button"
          className="workspace-ui-button is-primary ritual-primary-btn"
          disabled={isBatchDrawing || isShufflingCards}
          onClick={() => void triggerDrawNext()}
        >
          {isShufflingCards ? '洗牌中…' : `抽第 ${drawn.length + 1} 张 · ${nextPositionName}`}
        </button>
        <button
          type="button"
          className="workspace-ui-button is-secondary"
          disabled={isBatchDrawing || isShufflingCards}
          onClick={() => void triggerDrawRemaining()}
        >
          {isBatchDrawing ? '补抽中…' : '一键补抽'}
        </button>
        {drawn.length > 0 ? (
          <button
            type="button"
            className="workspace-ui-button is-secondary manual-reset-inline-btn"
            disabled={isBatchDrawing || isShufflingCards}
            onClick={handleResetDrawn}
          >
            重洗
          </button>
        ) : null}
      </>
    ) : showSubmitButton ? (
      <>
        <button type="submit" className="workspace-ui-button is-primary ritual-primary-btn">
          开始占卜
        </button>
        {currentMode === 'interactive' && drawn.length > 0 ? (
          <button type="button" className="workspace-ui-button is-secondary" onClick={handleResetDrawn}>
            重新洗牌
          </button>
        ) : null}
      </>
    ) : null;

  const previewCount = Math.min(currentSpread.cardCount, 6);

  return (
    <RitualStageShell
      title={isTarot ? '塔罗占卜' : '雷诺曼牌'}
      subtitle={`${currentSpread.name} · ${currentSpread.cardCount} 张`}
      showSubmitButton={showSubmitButton}
      stepBar={stepBar}
      actions={actions}
      isComplete={isComplete}
      headerRight={
        <UiSegmentedControl<'random' | 'interactive' | 'manual'>
          value={currentMode}
          options={[
            { value: 'random', label: '随机抽牌' },
            { value: 'interactive', label: '逐张抽牌' },
            { value: 'manual', label: '手动录牌' },
          ]}
          onChange={(next) => {
            shuffledDeckRef.current = null;
            if (isTarot) {
              onChangeTarotDrawnCards([]);
              onChangeTarotDrawMode(next);
            } else {
              onChangeLenormandDrawnCards([]);
              onChangeLenormandDrawMode(next);
            }
          }}
        />
      }
      subHeader={
        <div className="card-studio-config-bar">
          <div className="card-studio-config-select">
            <Select
              size="sm"
              aria-label={`选择${isTarot ? '塔罗' : '雷诺曼'}牌阵`}
              value={currentSpreadId}
              onValueChange={(val) => {
                shuffledDeckRef.current = null;
                if (isTarot) {
                  onChangeTarotDrawnCards([]);
                  onChangeTarotSpreadId(val);
                } else {
                  onChangeLenormandDrawnCards([]);
                  onChangeLenormandSpreadId(val);
                }
              }}
            >
              {isTarot
                ? TAROT_SPREAD_CATEGORIES.map((cat) => (
                    <optgroup key={cat.id} label={cat.label}>
                      {cat.spreadIds.map((sid) => {
                        const sp = spreads.find((s) => s.id === sid);
                        if (!sp) return null;
                        return (
                          <option key={sp.id} value={sp.id}>
                            {`${sp.name}（${sp.cardCount} 张）`}
                          </option>
                        );
                      })}
                    </optgroup>
                  ))
                : spreads.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {`${sp.name}（${sp.cardCount} 张）`}
                    </option>
                  ))}
            </Select>
          </div>

          {isTarot ? (
            <div className="card-studio-config-pills">
              <UiSegmentedControl<'all' | 'major'>
                value={tarotDeckScope}
                options={[
                  { value: 'all', label: '78张' },
                  { value: 'major', label: '大阿22' },
                ]}
                onChange={(nextScope) => {
                  shuffledDeckRef.current = null;
                  onChangeTarotDrawnCards([]);
                  onChangeTarotDeckScope(nextScope);
                }}
              />
              {tarotDrawMode !== 'manual' ? (
                <UiSegmentedControl<'realistic' | 'balanced' | 'upright-only'>
                  value={tarotReversalMode}
                  options={[
                    { value: 'realistic', label: '30%逆' },
                    { value: 'balanced', label: '50%逆' },
                    { value: 'upright-only', label: '仅正位' },
                  ]}
                  onChange={(nextRev) => {
                    shuffledDeckRef.current = null;
                    onChangeTarotDrawnCards([]);
                    onChangeTarotReversalMode(nextRev);
                  }}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      }
    >
      {currentMode === 'random' ? (
        <div className="card-studio-table">
          <div className="tarot-preview-cards-row">
            {Array.from({ length: previewCount }, (_, i) => {
              const posName = currentSpread.positions[i] ?? `第 ${i + 1} 牌位`;
              return (
                <div key={i} className="card-studio-slot">
                  <small className="card-studio-slot-pos">{`${i + 1}. ${posName}`}</small>
                  <CardBackTile
                    label={posName}
                    deckTheme={isTarot ? 'tarot' : 'lenormand'}
                    backUrl={backUrl}
                  />
                </div>
              );
            })}
          </div>
          {currentSpread.cardCount > 6 ? (
            <div className="card-studio-overflow-note">
              {`＋ 其余 ${currentSpread.cardCount - 6} 个牌位将在起卦结果中完整展开`}
            </div>
          ) : null}
        </div>
      ) : currentMode === 'interactive' ? (
        <div className="interactive-draw-session card-studio-table">
          <div className="tarot-interactive-spread-row">
            {Array.from({ length: previewCount }, (_, idx) => {
              const posName = currentSpread.positions[idx] ?? `第 ${idx + 1} 张`;
              const drawnCard = drawn[idx];
              return (
                <div key={idx} className={`card-studio-slot${drawnCard ? ' is-revealed' : ''}`}>
                  <small className="card-studio-slot-pos">{`${idx + 1}. ${posName}`}</small>
                  {drawnCard ? (
                    <>
                      <div className="card-studio-reveal-face">
                        {isTarot ? (
                          <TarotCardFace card={drawnCard} deckId={activeTarotDeck} />
                        ) : (
                          <LenormandCardFace card={drawnCard} />
                        )}
                      </div>
                      <div className="tarot-slot-drawn-caption">
                        {`${drawnCard.name}${
                          drawnCard.reversed === undefined
                            ? ''
                            : drawnCard.reversed
                              ? ' · 逆位'
                              : ' · 正位'
                        }`}
                      </div>
                    </>
                  ) : (
                    <CardBackTile
                      label={posName}
                      active={idx === drawn.length}
                      deckTheme={isTarot ? 'tarot' : 'lenormand'}
                      backUrl={backUrl}
                      onClick={idx === drawn.length ? () => void triggerDrawNext() : undefined}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {drawn.length < currentSpread.cardCount ? (
            <ScrollableCardDeckPanel
              pickedIndices={pickedFanIndices}
              isShuffling={isShufflingCards}
              isBusy={isBatchDrawing}
              shuffleSeed={shuffleSeed}
              nextPositionName={nextPositionName}
              deckTheme={isTarot ? 'tarot' : 'lenormand'}
              backUrl={backUrl}
              onPickCard={(f) => void triggerDrawNext(f)}
              onShuffle={triggerShuffleCards}
            />
          ) : null}

          {drawn.length > 0 && currentSpread.cardCount > 6 ? (
            <div className="manual-record-list">
              {drawn.map((c, idx) => (
                <div key={idx} className="manual-record-item is-revealed">
                  <span>{currentSpread.positions[idx] ?? c.position}</span>
                  <strong>
                    {`${c.name}${
                      c.reversed === undefined ? '' : c.reversed ? ' · 逆位' : ' · 正位'
                    }`}
                  </strong>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="workspace-ui-form-body card-studio-manual-wrap">
          <div className="tarot-manual-preview-row">
            {drawn.slice(0, 6).map((c, idx) =>
              isTarot ? (
                <TarotCardFace key={idx} card={c} deckId={activeTarotDeck} />
              ) : (
                <LenormandCardFace key={idx} card={c} />
              ),
            )}
          </div>

          {drawn.slice(0, currentSpread.cardCount).map((item, i) => {
            const posName = currentSpread.positions[i] ?? `第 ${i + 1} 张`;
            return (
              <div
                key={i}
                className={`workspace-ui-form-row${isTarot ? ' is-two-column' : ''}`}
              >
                <LabeledSelect
                  label={`${i + 1}. ${posName}`}
                  options={deckForManual.map((d) => ({
                    value: String(d.id),
                    label: `${d.id}. ${d.name}`,
                  }))}
                  value={String(item.id)}
                  onChange={(val) => {
                    const picked =
                      deckForManual.find((d) => d.id === Number(val)) ?? deckForManual[0]!;
                    const next = [...drawn];
                    next[i] = { ...next[i]!, id: picked.id, name: picked.name };
                    if (isTarot) onChangeTarotDrawnCards(next);
                    else onChangeLenormandDrawnCards(next);
                  }}
                />
                {isTarot ? (
                  <LabeledSelect
                    label="正逆位"
                    options={[
                      { value: 'false', label: '正位' },
                      { value: 'true', label: '逆位' },
                    ]}
                    value={String(Boolean(item.reversed))}
                    onChange={(val) => {
                      const next = [...drawn];
                      next[i] = { ...next[i]!, reversed: val === 'true' };
                      onChangeTarotDrawnCards(next);
                    }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </RitualStageShell>
  );
}
