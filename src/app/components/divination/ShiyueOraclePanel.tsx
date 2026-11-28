import * as React from 'react';
import '../../../styles/divination-studio.css';
import { Check, Copy } from 'lucide-react';
import { copyPromptText } from '../../../external-ai-share';
import {
  getActiveSkinThemeFromDocument,
  getSkinCardBackUrl,
  getSkinOracleCardUrl,
} from '../../../remote-assets';
import {
  SHIYUE_ORACLE_BACK_IMAGE_URL,
  SHIYUE_ORACLE_CARDS,
  SHIYUE_ORACLE_SPREADS,
  buildShiyueOraclePrompt,
  drawShiyueOracleCards,
  getShiyueOracleImageUrl,
  type DrawnShiyueOracleCard,
  type ShiyueOracleSpreadSpec,
} from '../../../systems/shiyue-oracle';
import { Button, Input } from '../../../components/ui';
import { ExternalAiShareButtons } from '../shared/ExternalAiShareButtons';
import { UiSegmentedControl } from '../shared/UiSegmentedControl';
import {
  CardBackTile,
  INTERACTIVE_DECK_FAN_COUNT,
  ScrollableCardDeckPanel,
} from './CardDrawStudio';
import { LabeledSelect } from './divination-shared';
import { RitualStageShell } from './RitualStageShell';

function OracleCardVisual({
  card,
  skinId,
  compact = false,
}: {
  card: DrawnShiyueOracleCard;
  skinId: string | null;
  compact?: boolean;
}) {
  const localUrl = getShiyueOracleImageUrl(card.id);
  const preferredUrl = (skinId && getSkinOracleCardUrl(skinId, card.id)) || localUrl;
  const [src, setSrc] = React.useState(preferredUrl);
  const [imgFailed, setImgFailed] = React.useState(false);

  React.useEffect(() => {
    setSrc(preferredUrl);
    setImgFailed(false);
  }, [preferredUrl]);

  return (
    <div
      className="tarot-art-card"
      style={{
        width: compact ? '100%' : undefined,
        maxWidth: compact ? '108px' : undefined,
        aspectRatio: '2 / 3',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {imgFailed ? (
        <div className="flex h-full w-full flex-col items-center justify-between rounded-xl border border-[var(--border-strong)] bg-[var(--surface-soft)] p-2 text-center">
          <span className="text-[10px] font-bold text-[var(--accent-strong)]">{card.ganzhi}</span>
          <strong className="text-xs text-[var(--text-strong)] sm:text-sm">{card.title}</strong>
          <span className="text-[10px] text-[var(--text-muted)]">{card.nayin}</span>
        </div>
      ) : (
        <img
          src={src}
          alt={`${card.ganzhi} · ${card.title}`}
          width={360}
          height={540}
          loading="eager"
          draggable={false}
          onError={() => {
            if (src !== localUrl) {
              setSrc(localUrl);
            } else {
              setImgFailed(true);
            }
          }}
          className={
            compact
              ? 'h-full w-full rounded-xl object-contain'
              : 'aspect-[2/3] h-auto w-24 shrink-0 rounded-xl border border-[var(--border-soft)] object-contain sm:w-32'
          }
        />
      )}
    </div>
  );
}

export function ShiyueOraclePanel() {
  const [question, setQuestion] = React.useState('');
  const [spreadId, setSpreadId] = React.useState<ShiyueOracleSpreadSpec['id']>('three');
  const [mode, setMode] = React.useState<'random' | 'interactive' | 'manual'>('random');
  const [manualIds, setManualIds] = React.useState<number[]>([1, 2, 3]);
  const [cards, setCards] = React.useState<DrawnShiyueOracleCard[]>([]);
  const [pickedFanIndices, setPickedFanIndices] = React.useState<number[]>([]);
  const [isShuffling, setIsShuffling] = React.useState(false);
  const [isBatchDrawing, setIsBatchDrawing] = React.useState(false);
  const [shuffleSeed, setShuffleSeed] = React.useState(0);
  const [copied, setCopied] = React.useState(false);
  const [skinId, setSkinId] = React.useState<string | null>(() =>
    getActiveSkinThemeFromDocument(),
  );

  const shuffleTimerRef = React.useRef<number | null>(null);
  const batchTimerRef = React.useRef<number | null>(null);
  const poolRef = React.useRef<typeof SHIYUE_ORACLE_CARDS | null>(null);

  const clearTimers = React.useCallback(() => {
    if (shuffleTimerRef.current !== null) {
      window.clearTimeout(shuffleTimerRef.current);
      shuffleTimerRef.current = null;
    }
    if (batchTimerRef.current !== null) {
      window.clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }
    setIsShuffling(false);
    setIsBatchDrawing(false);
  }, []);

  React.useEffect(() => clearTimers, [clearTimers]);

  React.useEffect(() => {
    const syncSkin = () => setSkinId(getActiveSkinThemeFromDocument());
    window.addEventListener('mingyu:theme-changed', syncSkin);
    window.addEventListener('mingyu:remote-skins-loaded', syncSkin);
    return () => {
      window.removeEventListener('mingyu:theme-changed', syncSkin);
      window.removeEventListener('mingyu:remote-skins-loaded', syncSkin);
    };
  }, []);

  const backUrl = (skinId && getSkinCardBackUrl(skinId)) || SHIYUE_ORACLE_BACK_IMAGE_URL;
  const spread = SHIYUE_ORACLE_SPREADS[spreadId];
  const cardCount = spread.positions.length;

  const manualDrawnCards = React.useMemo(
    () => drawShiyueOracleCards(spreadId, manualIds.slice(0, cardCount)),
    [cardCount, manualIds, spreadId],
  );

  const displayedResultCards = mode === 'manual' ? cards : cards;
  const promptText = React.useMemo(
    () =>
      displayedResultCards.length === cardCount
        ? buildShiyueOraclePrompt(question, spread.name, displayedResultCards)
        : '',
    [cardCount, displayedResultCards, question, spread.name],
  );

  const nextPositionName = spread.positions[cards.length] ?? `第 ${cards.length + 1} 张`;
  const allInteractiveDrawn = mode === 'interactive' && cards.length >= cardCount;

  const ensureShuffledPool = () => {
    if (!poolRef.current) {
      const next = [...SHIYUE_ORACLE_CARDS];
      for (let i = next.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = next[i]!;
        next[i] = next[j]!;
        next[j] = tmp;
      }
      poolRef.current = next;
    }
    return poolRef.current;
  };

  const handleDrawRandomOrManual = () => {
    const chosen =
      mode === 'manual'
        ? drawShiyueOracleCards(spreadId, manualIds.slice(0, cardCount))
        : drawShiyueOracleCards(spreadId);
    setCards(chosen);
    setCopied(false);
  };

  const handleDrawOne = (fanIndex?: number) => {
    if (isShuffling || isBatchDrawing || cards.length >= cardCount) return;
    if (cards.length === 0) poolRef.current = null;
    const pool = ensureShuffledPool();
    const usedIds = new Set(cards.map((c) => c.id));
    const nextCard = pool.find((c) => !usedIds.has(c.id)) ?? pool[cards.length % pool.length]!;
    const pos = spread.positions[cards.length] ?? `第 ${cards.length + 1} 张`;
    const slot =
      typeof fanIndex === 'number'
        ? fanIndex
        : Array.from({ length: INTERACTIVE_DECK_FAN_COUNT }, (_, i) => i).find(
            (i) => !pickedFanIndices.includes(i),
          );
    if (typeof slot === 'number') {
      setPickedFanIndices((prev) => (prev.includes(slot) ? prev : [...prev, slot]));
    }
    setCards((prev) => [...prev, { ...nextCard, position: pos }]);
    setCopied(false);
  };

  const handleDrawRemaining = async () => {
    if (isShuffling || isBatchDrawing || cards.length >= cardCount) return;
    setIsBatchDrawing(true);
    try {
      if (cards.length === 0) poolRef.current = null;
      const pool = ensureShuffledPool();
      let acc = [...cards];
      let picked = [...pickedFanIndices];
      while (acc.length < cardCount) {
        const usedIds = new Set(acc.map((c) => c.id));
        const nextCard = pool.find((c) => !usedIds.has(c.id)) ?? pool[acc.length % pool.length]!;
        const pos = spread.positions[acc.length] ?? `第 ${acc.length + 1} 张`;
        acc = [...acc, { ...nextCard, position: pos }];
        const avail = Array.from({ length: INTERACTIVE_DECK_FAN_COUNT }, (_, i) => i).filter(
          (i) => !picked.includes(i),
        );
        if (avail.length > 0) {
          picked = [...picked, avail[Math.floor(Math.random() * avail.length)]!];
          setPickedFanIndices(picked);
        }
        setCards(acc);
        if (acc.length < cardCount) {
          await new Promise<void>((resolve) => {
            batchTimerRef.current = window.setTimeout(resolve, 110);
          });
        }
      }
      setCopied(false);
    } finally {
      batchTimerRef.current = null;
      setIsBatchDrawing(false);
    }
  };

  const handleShuffle = () => {
    if (isShuffling || isBatchDrawing) return;
    clearTimers();
    poolRef.current = null;
    setCards([]);
    setPickedFanIndices([]);
    setCopied(false);
    setIsShuffling(true);
    shuffleTimerRef.current = window.setTimeout(() => {
      shuffleTimerRef.current = null;
      setIsShuffling(false);
      setShuffleSeed((s) => s + 1);
    }, 580);
  };

  const handleCopy = async () => {
    if (!promptText) return;
    if (await copyPromptText(promptText)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  const stepBar =
    mode === 'interactive' ? (
      <div className="ritual-step-bar card-studio-step-bar" aria-label="抽牌仪式进度">
        <span
          className={`ritual-step-pill${shuffleSeed > 0 || cards.length > 0 ? ' is-done' : ''}${
            isShuffling ? ' is-current' : ''
          }`}
        >
          壹 洗牌
        </span>
        <span
          className={`ritual-step-pill${
            allInteractiveDrawn ? ' is-done' : !isShuffling ? ' is-current' : ''
          }`}
        >
          {`贰 抽牌 (${cards.length}/${cardCount})`}
        </span>
        <span className={`ritual-step-pill${allInteractiveDrawn ? ' is-current is-done' : ''}`}>
          叁 启牌
        </span>
        <span className="card-studio-step-label">
          {isShuffling
            ? '净心洗牌中…'
            : allInteractiveDrawn
              ? '神谕已现'
              : `待抽：${nextPositionName}`}
        </span>
      </div>
    ) : null;

  const actions =
    mode === 'interactive' ? (
      !allInteractiveDrawn ? (
        <>
          <button
            type="button"
            className="workspace-ui-button is-primary ritual-primary-btn"
            disabled={isBatchDrawing || isShuffling}
            onClick={() => handleDrawOne()}
          >
            {isShuffling ? '洗牌中…' : `抽第 ${cards.length + 1} 张 · ${nextPositionName}`}
          </button>
          <button
            type="button"
            className="workspace-ui-button is-secondary"
            disabled={isBatchDrawing || isShuffling}
            onClick={() => void handleDrawRemaining()}
          >
            {isBatchDrawing ? '补抽中…' : '一键补抽'}
          </button>
          {cards.length > 0 ? (
            <button
              type="button"
              className="workspace-ui-button is-secondary manual-reset-inline-btn"
              disabled={isBatchDrawing || isShuffling}
              onClick={handleShuffle}
            >
              重洗
            </button>
          ) : null}
        </>
      ) : (
        <>
          {promptText ? (
            <button
              type="button"
              className="workspace-ui-button is-primary ritual-primary-btn"
              onClick={() => void handleCopy()}
            >
              {copied ? '已复制提示词' : '复制提示词'}
            </button>
          ) : null}
          <button type="button" className="workspace-ui-button is-secondary" onClick={handleShuffle}>
            重新洗牌
          </button>
        </>
      )
    ) : (
      <>
        <button
          type="button"
          className="workspace-ui-button is-primary ritual-primary-btn"
          onClick={handleDrawRandomOrManual}
        >
          {cards.length > 0 ? '重新抽取' : '抽取神谕'}
        </button>
        {cards.length > 0 ? (
          <button
            type="button"
            className="workspace-ui-button is-secondary"
            onClick={() => setCards([])}
          >
            清空
          </button>
        ) : null}
      </>
    );

  return (
    <div className="divination-flow-workbench mx-auto grid w-full max-w-[900px] gap-3">
      <RitualStageShell
        title="时月神谕"
        subtitle={`${spread.name} · ${cardCount} 张`}
        stepBar={stepBar}
        actions={actions}
        isComplete={mode === 'manual' || cards.length === cardCount}
        headerRight={
          <UiSegmentedControl<'random' | 'interactive' | 'manual'>
            value={mode}
            options={[
              { value: 'random', label: '随机抽牌' },
              { value: 'interactive', label: '逐张抽牌' },
              { value: 'manual', label: '手动录牌' },
            ]}
            onChange={(next) => {
              clearTimers();
              poolRef.current = null;
              setPickedFanIndices([]);
              setCards([]);
              setCopied(false);
              setMode(next);
            }}
          />
        }
        subHeader={
          <div className="card-studio-config-bar">
            <div className="shiyue-question-field">
              <Input
                type="text"
                value={question}
                aria-label="所问之事"
                placeholder="输入想问的事，例如：近期工作调整先守还是先冲？"
                onChange={(e) => setQuestion(e.target.value)}
              />
            </div>

            <div className="card-studio-config-pills">
              <UiSegmentedControl<ShiyueOracleSpreadSpec['id']>
                value={spreadId}
                onChange={(next) => {
                  clearTimers();
                  poolRef.current = null;
                  setPickedFanIndices([]);
                  setCards([]);
                  setSpreadId(next);
                  const len = SHIYUE_ORACLE_SPREADS[next].positions.length;
                  setManualIds((prev) =>
                    Array.from({ length: len }, (_, idx) => prev[idx] ?? idx + 1),
                  );
                }}
                options={[
                  { value: 'single', label: '单牌' },
                  { value: 'three', label: '三牌' },
                  { value: 'five', label: '五牌' },
                ]}
              />
            </div>
          </div>
        }
      >
        {mode === 'random' ? (
          <div className="card-studio-table">
            <div className="tarot-preview-cards-row">
              {spread.positions.map((posName, i) => {
                const drawnCard = cards[i];
                return (
                  <div key={posName} className={`card-studio-slot${drawnCard ? ' is-revealed' : ''}`}>
                    <small className="card-studio-slot-pos">{`${i + 1}. ${posName}`}</small>
                    {drawnCard ? (
                      <>
                        <div className="card-studio-reveal-face">
                          <OracleCardVisual card={drawnCard} skinId={skinId} compact />
                        </div>
                        <div className="tarot-slot-drawn-caption">
                          {`${drawnCard.title} · ${drawnCard.ganzhi}`}
                        </div>
                      </>
                    ) : (
                      <CardBackTile label={posName} deckTheme="oracle" backUrl={backUrl} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : mode === 'interactive' ? (
          <div className="interactive-draw-session card-studio-table">
            <div className="tarot-interactive-spread-row">
              {spread.positions.map((posName, idx) => {
                const drawnCard = cards[idx];
                return (
                  <div key={posName} className={`card-studio-slot${drawnCard ? ' is-revealed' : ''}`}>
                    <small className="card-studio-slot-pos">{`${idx + 1}. ${posName}`}</small>
                    {drawnCard ? (
                      <>
                        <div className="card-studio-reveal-face">
                          <OracleCardVisual card={drawnCard} skinId={skinId} compact />
                        </div>
                        <div className="tarot-slot-drawn-caption">
                          {`${drawnCard.title} · ${drawnCard.ganzhi}`}
                        </div>
                      </>
                    ) : (
                      <CardBackTile
                        label={posName}
                        active={idx === cards.length}
                        deckTheme="oracle"
                        backUrl={backUrl}
                        onClick={idx === cards.length ? () => handleDrawOne() : undefined}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {cards.length < cardCount ? (
              <ScrollableCardDeckPanel
                pickedIndices={pickedFanIndices}
                isShuffling={isShuffling}
                isBusy={isBatchDrawing}
                shuffleSeed={shuffleSeed}
                nextPositionName={nextPositionName}
                deckTheme="oracle"
                backUrl={backUrl}
                onPickCard={(f) => handleDrawOne(f)}
                onShuffle={handleShuffle}
              />
            ) : null}
          </div>
        ) : (
          <div className="workspace-ui-form-body card-studio-manual-wrap">
            <div className="tarot-manual-preview-row">
              {manualDrawnCards.map((c, idx) => (
                <div key={`${c.id}-${idx}`} className="card-studio-slot">
                  <small className="card-studio-slot-pos">{`${idx + 1}. ${c.position}`}</small>
                  <OracleCardVisual card={c} skinId={skinId} compact />
                </div>
              ))}
            </div>

            {spread.positions.map((pos, idx) => (
              <LabeledSelect
                key={pos}
                label={`${idx + 1}. ${pos}`}
                value={String(manualIds[idx] ?? idx + 1)}
                options={SHIYUE_ORACLE_CARDS.map((c) => ({
                  value: String(c.id),
                  label: `${c.id}. ${c.ganzhi} · ${c.title}`,
                }))}
                onChange={(raw) => {
                  const val = Number(raw);
                  setManualIds((prev) => prev.map((item, i) => (i === idx ? val : item)));
                }}
              />
            ))}
          </div>
        )}
      </RitualStageShell>

      {cards.length > 0 && cards.length === cardCount ? (
        <section className="shiyue-results-panel" aria-label="神谕牌义与指引">
          <div className="shiyue-results-head">
            <strong>{`${spread.name} · 牌义简释`}</strong>
            <div className="shiyue-results-actions">
              <Button type="button" variant="primary" size="sm" onClick={() => void handleCopy()}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? '已复制' : '复制提示词'}</span>
              </Button>
              <ExternalAiShareButtons promptText={promptText} size="sm" />
            </div>
          </div>

          <div className="shiyue-results-list">
            {cards.map((card, idx) => (
              <div key={`${card.id}-${idx}`} className="shiyue-result-item">
                <OracleCardVisual card={card} skinId={skinId} />
                <div className="grid min-w-0 flex-1 gap-1.5 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-[var(--accent-surface)] px-2 py-0.5 font-bold text-[var(--accent-deep)]">
                      {card.position}
                    </span>
                    <strong className="text-sm text-[var(--text-strong)]">
                      {`${card.title}（${card.ganzhi} · ${card.nayin}）`}
                    </strong>
                  </div>
                  <p className="m-0 leading-relaxed text-[var(--text-primary)]">{card.meaning}</p>
                  <p className="m-0 leading-relaxed text-[var(--text-secondary)]">{`建议：${card.guidance}`}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
