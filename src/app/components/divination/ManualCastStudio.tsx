import * as React from 'react';

export type CoinThrow = {
  coins: [2 | 3, 2 | 3, 2 | 3];
  total: 6 | 7 | 8 | 9;
};

export type DayangChangeStep = {
  step: 1 | 2 | 3;
  before: number;
  left: number;
  right: number;
  removed: number;
  after: number;
};

export type DayangLineResult = {
  value: 6 | 7 | 8 | 9;
  changes: DayangChangeStep[];
};

export type LiuyaoLivePreview = {
  originalName: string;
  changedName?: string;
  palaceText?: string;
};

const YAO_POS_LABELS = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'] as const;

const YAO_PILL_CHOICES: ReadonlyArray<{
  value: 6 | 7 | 8 | 9;
  short: string;
  symbol: string;
}> = [
  { value: 7, short: '少阳', symbol: '⚊' },
  { value: 8, short: '少阴', symbol: '⚋' },
  { value: 9, short: '老阳 ○', symbol: '⚊○' },
  { value: 6, short: '老阴 ×', symbol: '⚋×' },
];

const YAO_NAME_MAP: Record<6 | 7 | 8 | 9, string> = {
  6: '老阴 · 动',
  7: '少阳',
  8: '少阴',
  9: '老阳 · 动',
};

export function rollThreeCoins(): CoinThrow {
  const c1: 2 | 3 = Math.random() < 0.5 ? 2 : 3;
  const c2: 2 | 3 = Math.random() < 0.5 ? 2 : 3;
  const c3: 2 | 3 = Math.random() < 0.5 ? 2 : 3;
  return {
    coins: [c1, c2, c3],
    total: (c1 + c2 + c3) as 6 | 7 | 8 | 9,
  };
}

/**
 * 传统大衍揲蓍法真实概率（6: 1/16, 7: 5/16, 8: 7/16, 9: 3/16）。
 */
export function rollYarrowSingleLine(): 6 | 7 | 8 | 9 {
  const r = Math.random() * 16;
  if (r < 1) return 6;
  if (r < 6) return 7;
  if (r < 13) return 8;
  return 9;
}

/**
 * 严格按「分二、挂一、揲四、归奇」推演大衍 49 策三变过程，返回三变余数记录与最终成爻（6/7/8/9）。
 */
export function computeDayangThreeChanges(initialLeftSplit?: number): DayangLineResult {
  let stalks = 49;
  const changes: DayangChangeStep[] = [];

  for (let i = 1 as 1 | 2 | 3; i <= 3; i = (i + 1) as 1 | 2 | 3) {
    const minLeft = i === 1 ? 6 : 3;
    const maxLeft = stalks - minLeft;
    const rawLeft =
      i === 1 && typeof initialLeftSplit === 'number' && Number.isFinite(initialLeftSplit)
        ? Math.round(initialLeftSplit)
        : minLeft + Math.floor(Math.random() * Math.max(1, maxLeft - minLeft + 1));
    const left = Math.max(minLeft, Math.min(maxLeft, rawLeft));
    const right = stalks - left;

    // 挂一于右策
    const rightRemainBase = right - 1;
    const remLeft = left % 4 || 4;
    const remRight = rightRemainBase % 4 || 4;
    const removed = 1 + remLeft + remRight;
    const after = stalks - removed;

    changes.push({ step: i, before: stalks, left, right, removed, after });
    stalks = after;
  }

  const value = Math.max(6, Math.min(9, Math.round(stalks / 4))) as 6 | 7 | 8 | 9;
  return { value, changes };
}

export type ShengbeiFace = 'yang' | 'yin';
export type ShengbeiKind = 'sacred' | 'laugh' | 'yin';

export type ShengbeiResult = {
  kind: ShengbeiKind;
  short: string;
  label: string;
  desc: string;
  ok: boolean;
  pair: readonly [ShengbeiFace, ShengbeiFace];
};

function randomUnit(source?: () => number): number {
  if (source) return source();
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    return buf[0]! / 0x100000000;
  }
  return Math.random();
}

/**
 * 模拟两枚圣杯独立抛掷（平=yang、凸=yin，各 50%）：
 * 一平一仰为圣杯（50%）、双平为笑杯（25%）、双凸为阴杯（25%）。
 */
export function rollShengbeiResult(source?: () => number): ShengbeiResult {
  const cupA: ShengbeiFace = randomUnit(source) < 0.5 ? 'yang' : 'yin';
  const cupB: ShengbeiFace = randomUnit(source) < 0.5 ? 'yang' : 'yin';
  if (cupA !== cupB) {
    return {
      kind: 'sacred',
      short: '圣杯',
      label: '圣杯 · 一平一仰',
      desc: '神明应允，签号确定',
      ok: true,
      pair: [cupA, cupB],
    };
  }
  if (cupA === 'yang') {
    return {
      kind: 'laugh',
      short: '笑杯',
      label: '笑杯 · 双平朝上',
      desc: '心意未明，可再掷或重摇',
      ok: false,
      pair: ['yang', 'yang'],
    };
  }
  return {
    kind: 'yin',
    short: '阴杯',
    label: '阴杯 · 双凸朝下',
    desc: '此签未契，请重摇签筒',
    ok: false,
    pair: ['yin', 'yin'],
  };
}

const COIN_ASSET_SRCS = {
  heads: '/divination-assets/ritual/coin-heads.webp',
  tails: '/divination-assets/ritual/coin-tails.webp',
} as const;

function CoinTrayVisual({
  coinThrows,
  animatingIndex,
  isShakingShell,
  isHoldingShell = false,
  canTap = false,
  onTapCast,
  onHoldStart,
  onHoldEnd,
}: {
  coinThrows: readonly CoinThrow[];
  animatingIndex: number;
  isShakingShell: boolean;
  isHoldingShell?: boolean;
  canTap?: boolean;
  onTapCast?: () => void;
  onHoldStart?: () => void;
  onHoldEnd?: () => void;
}) {
  const [shellImgFailed, setShellImgFailed] = React.useState(false);
  const [failedCoins, setFailedCoins] = React.useState<Record<string, boolean>>({});
  const [loadedSrcs, setLoadedSrcs] = React.useState<Record<string, boolean>>({});
  const pressingRef = React.useRef(false);
  const lastPointerEndRef = React.useRef(0);

  React.useEffect(() => {
    for (const src of [COIN_ASSET_SRCS.heads, COIN_ASSET_SRCS.tails]) {
      const img = new Image();
      img.onload = () => setLoadedSrcs((prev) => (prev[src] ? prev : { ...prev, [src]: true }));
      img.src = src;
      if (img.complete && img.naturalWidth > 0) {
        setLoadedSrcs((prev) => (prev[src] ? prev : { ...prev, [src]: true }));
      }
    }
  }, []);

  React.useEffect(() => {
    const finishGlobalHold = () => {
      if (!pressingRef.current) return;
      pressingRef.current = false;
      lastPointerEndRef.current = Date.now();
      onHoldEnd?.();
    };
    window.addEventListener('pointerup', finishGlobalHold);
    window.addEventListener('pointercancel', finishGlobalHold);
    return () => {
      window.removeEventListener('pointerup', finishGlobalHold);
      window.removeEventListener('pointercancel', finishGlobalHold);
    };
  }, [onHoldEnd]);

  const interactive = canTap && (Boolean(onHoldStart && onHoldEnd) || Boolean(onTapCast));

  const pointerHandlers = interactive
    ? {
        onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
          if (e.button !== 0 && e.pointerType === 'mouse') return;
          if (!onHoldStart || !onHoldEnd) return;
          pressingRef.current = true;
          onHoldStart();
        },
        onClick: () => {
          // 若刚刚通过真实指针完成按压松手，避免重复落爻
          if (Date.now() - lastPointerEndRef.current < 450) return;
          onTapCast?.();
        },
      }
    : {};

  if (isShakingShell || isHoldingShell || coinThrows.length === 0) {
    const nextPos = YAO_POS_LABELS[coinThrows.length] ?? '六爻';
    const content = (
      <div className={`manual-shell-stage${isShakingShell || isHoldingShell ? ' is-shaking' : ''}${isHoldingShell ? ' is-holding' : ''}`}>
        <div className="manual-shell-aura" aria-hidden="true" />
        {!shellImgFailed ? (
          <img
            className="manual-shell-img"
            src="/divination-assets/ritual/shell.webp"
            alt={isHoldingShell || isShakingShell ? '龟壳正在摇卦' : '按住或轻触龟壳起初爻'}
            loading="eager"
            decoding="async"
            draggable={false}
            onError={() => setShellImgFailed(true)}
          />
        ) : null}
        <span className="manual-shell-caption">
          {isHoldingShell
            ? `松手落钱 · ${nextPos}`
            : isShakingShell
              ? `正在摇${nextPos}…`
              : '按住或轻触龟壳起初爻'}
        </span>
      </div>
    );

    if (interactive) {
      return (
        <button
          type="button"
          className={`manual-coin-tray is-tappable${isHoldingShell ? ' is-holding' : ''}`}
          aria-label={`摇${nextPos}`}
          {...pointerHandlers}
        >
          {content}
        </button>
      );
    }

    return <div className="manual-coin-tray">{content}</div>;
  }

  const latest = coinThrows[coinThrows.length - 1]!;
  const yaoName = YAO_NAME_MAP[latest.total];
  const posName = YAO_POS_LABELS[coinThrows.length - 1] ?? '';

  const stageContent = (
    <div className="manual-coin-result-stage">
      <div className="manual-coin-result-grid">
        {latest.coins.map((val, idx) => {
          const isYang = val === 3;
          const imgKey = `${coinThrows.length}-${idx}-${val}`;
          const imgSrc = isYang ? COIN_ASSET_SRCS.heads : COIN_ASSET_SRCS.tails;
          const imgFailed = Boolean(failedCoins[imgKey]);
          const imgLoaded = Boolean(loadedSrcs[imgSrc]);
          const seed = (coinThrows.length * 7 + idx * 13 + val * 3) % 11;
          const tilt = (idx === 0 ? -9 : idx === 1 ? 4 : 10) + (seed - 5) * 1.3;
          const dy = idx === 1 ? -4 + (seed % 3) : 2 + ((seed + idx) % 4);
          return (
            <div
              key={imgKey}
              style={
                {
                  '--coin-rot': `${tilt.toFixed(1)}deg`,
                  '--coin-dy': `${dy}px`,
                  animationDelay: animatingIndex >= 0 ? `${idx * 60}ms` : undefined,
                } as React.CSSProperties
              }
              className={`manual-bronze-coin${imgFailed ? '' : ' is-photo'}${
                imgLoaded ? ' is-photo-loaded' : ''
              } ${isYang ? 'is-front' : 'is-back'}${animatingIndex >= 0 ? ' is-spinning' : ''}`}
              aria-label={`第${idx + 1}枚铜钱：${isYang ? '字面(阳3)' : '背面(阴2)'}`}
            >
              {!imgFailed ? (
                <img
                  className="manual-bronze-coin-img"
                  src={imgSrc}
                  alt={isYang ? '铜钱正面（阳·3）' : '铜钱背面（阴·2）'}
                  loading="eager"
                  decoding="async"
                  draggable={false}
                  onLoad={() => setLoadedSrcs((prev) => (prev[imgSrc] ? prev : { ...prev, [imgSrc]: true }))}
                  onError={() => setFailedCoins((prev) => ({ ...prev, [imgKey]: true }))}
                />
              ) : null}
              <div className="manual-coin-rim">
                <em className="manual-coin-label">{isYang ? '乾' : '阴'}</em>
                <span className="manual-coin-hole" />
                <small className="manual-coin-val">{isYang ? '阳 · 3' : '背 · 2'}</small>
              </div>
              <em className="manual-coin-face-chip">{isYang ? '阳' : '阴'}</em>
            </div>
          );
        })}
      </div>
      <div className="manual-coin-result-caption">
        <strong>{yaoName}</strong>
        <span>{`${latest.total} 点 · ${posName}`}</span>
        {interactive ? <small>· 续摇下一爻</small> : null}
      </div>
    </div>
  );

  if (interactive) {
    const nextPos = YAO_POS_LABELS[coinThrows.length] ?? '下一爻';
    return (
      <button
        type="button"
        className="manual-coin-tray is-tappable"
        aria-label={`摇${nextPos}`}
        {...pointerHandlers}
      >
        {stageContent}
      </button>
    );
  }

  return (
    <div className={`manual-coin-tray${coinThrows.length >= 6 ? ' is-complete' : ''}`}>
      {stageContent}
    </div>
  );
}

function YarrowTrayVisual({
  yarrowYaos,
  lastDayangDetail,
  activeSplitInfo,
  canTap = false,
  onSplitCast,
}: {
  yarrowYaos: readonly (6 | 7 | 8 | 9)[];
  lastDayangDetail?: DayangLineResult | null;
  activeSplitInfo?: { left: number; phase: 1 | 2 | 3 } | null;
  canTap?: boolean;
  onSplitCast?: (leftSplit: number) => void;
}) {
  const doneCount = yarrowYaos.length;
  const totalStalks = 49;
  const phaseLabels: Record<1 | 2 | 3, string> = {
    1: '一变 · 分二挂一',
    2: '二变 · 揲四归奇',
    3: '三变 · 定爻成策',
  };

  let captionText = '轻触竹策任意处 · 分二揲蓍';
  if (activeSplitInfo) {
    captionText = `${phaseLabels[activeSplitInfo.phase]}（左 ${activeSplitInfo.left} · 右 ${totalStalks - activeSplitInfo.left}）`;
  } else if (doneCount > 0 && doneCount < 6) {
    const latest = yarrowYaos[doneCount - 1]!;
    const pos = YAO_POS_LABELS[doneCount - 1] ?? '';
    const chain = lastDayangDetail
      ? `（49→${lastDayangDetail.changes.map((c) => c.after).join('→')}）`
      : '';
    captionText = `${pos}已得 ${YAO_NAME_MAP[latest]}${chain}`;
  } else if (doneCount >= 6) {
    captionText = '十八变圆满 · 六爻已成';
  }

  return (
    <div
      className={`manual-coin-tray manual-yarrow-tray${doneCount >= 6 ? ' is-complete' : ''}${
        activeSplitInfo ? ' is-splitting' : ''
      }`}
    >
      <div className="manual-yarrow-stage">
        <div className="manual-yarrow-bundles" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => {
            const val = yarrowYaos[i];
            return (
              <span
                key={i}
                className={`manual-yarrow-stalk${
                  val ? ' is-done' : i === doneCount ? ' is-next' : ''
                }`}
              >
                {val ? YAO_POS_LABELS[i]!.slice(0, 1) : String(i + 1)}
              </span>
            );
          })}
        </div>

        <div
          className={`yarrow-mat-stalks${activeSplitInfo ? ' is-split' : ''}${
            canTap && doneCount < 6 ? ' is-interactive' : ''
          }`}
          role="group"
          aria-label="四十九根大衍蓍草，点击任意位置分二起爻"
        >
          {Array.from({ length: totalStalks }, (_, idx) => {
            const splitPoint = activeSplitInfo?.left ?? 24;
            const isRight = Boolean(activeSplitInfo) && idx >= splitPoint;
            const isGap = Boolean(activeSplitInfo) && idx === splitPoint;
            return (
              <button
                key={idx}
                type="button"
                disabled={!canTap || doneCount >= 6 || Boolean(activeSplitInfo)}
                className={`yarrow-single-reed${isRight ? ' is-right-half' : ''}${
                  isGap ? ' is-split-gap' : ''
                }`}
                aria-label={`从第 ${idx + 1} 策处分二`}
                onClick={() => {
                  if (!canTap || doneCount >= 6 || activeSplitInfo) return;
                  const clamped = Math.max(6, Math.min(43, idx + 1));
                  onSplitCast?.(clamped);
                }}
              />
            );
          })}
        </div>

        <span className="manual-shell-caption">{captionText}</span>
      </div>
    </div>
  );
}

/**
 * 六爻摇卦/揲蓍/录爻分栏与阶段感知操作条。
 */
export function useInteractiveLiuyaoParts({
  mode,
  coinThrows,
  manualYaos,
  yarrowYaos,
  isShaking,
  isHoldingShell = false,
  isCascading = false,
  showSubmitButton = true,
  liuyaoPreview = null,
  onRequestShakeCoin,
  onHoldShakeStart,
  onHoldShakeRelease,
  onRequestCascadeCast,
  onUpdateCoins,
  onUpdateManual,
  onUpdateYarrow,
}: {
  mode: 'coins' | 'manual' | 'yarrow';
  coinThrows: readonly CoinThrow[];
  manualYaos: readonly (6 | 7 | 8 | 9)[];
  yarrowYaos: readonly (6 | 7 | 8 | 9)[];
  isShaking: boolean;
  isHoldingShell?: boolean;
  isCascading?: boolean;
  showSubmitButton?: boolean;
  liuyaoPreview?: LiuyaoLivePreview | null;
  onRequestShakeCoin: () => void;
  onHoldShakeStart?: () => void;
  onHoldShakeRelease?: () => void;
  onRequestCascadeCast?: () => void;
  onUpdateCoins: (next: CoinThrow[]) => void;
  onUpdateManual: (next: Array<6 | 7 | 8 | 9>) => void;
  onUpdateYarrow: (next: Array<6 | 7 | 8 | 9>) => void;
}): {
  stepBar: React.ReactNode;
  leftExtra: React.ReactNode;
  rightContent: React.ReactNode;
  actions: React.ReactNode;
  isComplete: boolean;
} {
  const [yarrowSplitInfo, setYarrowSplitInfo] = React.useState<{
    left: number;
    phase: 1 | 2 | 3;
  } | null>(null);
  const [lastDayangDetail, setLastDayangDetail] = React.useState<DayangLineResult | null>(null);
  const yarrowTimersRef = React.useRef<number[]>([]);

  const clearYarrowTimers = React.useCallback(() => {
    for (const id of yarrowTimersRef.current) window.clearTimeout(id);
    yarrowTimersRef.current = [];
    setYarrowSplitInfo(null);
  }, []);

  React.useEffect(() => clearYarrowTimers, [clearYarrowTimers]);

  React.useEffect(() => {
    if (yarrowYaos.length === 0) setLastDayangDetail(null);
  }, [yarrowYaos.length]);

  const visibleYaos =
    mode === 'coins' ? coinThrows.map((t) => t.total) : mode === 'manual' ? manualYaos : yarrowYaos;
  const isComplete = mode === 'manual' || visibleYaos.length >= 6;
  const isBusy = isShaking || isHoldingShell || isCascading || Boolean(yarrowSplitInfo);
  const canTapCast = !isBusy && visibleYaos.length < 6;

  let headTitle = '逐爻定阴阳动静';
  if (mode === 'coins') {
    headTitle = coinThrows.length < 6 ? `待摇${YAO_POS_LABELS[coinThrows.length]}` : '六爻已成';
  } else if (mode === 'yarrow') {
    headTitle =
      yarrowYaos.length < 6 ? `大衍揲蓍 · ${YAO_POS_LABELS[yarrowYaos.length]}` : '十八变成卦';
  }

  const runInteractiveDayangSplit = React.useCallback(
    (leftSplit?: number) => {
      if (isBusy || yarrowYaos.length >= 6) return;
      clearYarrowTimers();
      const splitPoint =
        typeof leftSplit === 'number' ? leftSplit : 14 + Math.floor(Math.random() * 21);
      setYarrowSplitInfo({ left: splitPoint, phase: 1 });
      const res = computeDayangThreeChanges(splitPoint);

      const t1 = window.setTimeout(() => {
        setYarrowSplitInfo({ left: splitPoint, phase: 2 });
      }, 210);
      const t2 = window.setTimeout(() => {
        setYarrowSplitInfo({ left: splitPoint, phase: 3 });
      }, 420);
      const t3 = window.setTimeout(() => {
        setYarrowSplitInfo(null);
        setLastDayangDetail(res);
        onUpdateYarrow([...yarrowYaos, res.value]);
      }, 640);
      yarrowTimersRef.current = [t1, t2, t3];
    },
    [clearYarrowTimers, isBusy, onUpdateYarrow, yarrowYaos],
  );

  const handleCastNext = () => {
    if (!canTapCast) return;
    if (mode === 'coins') {
      onRequestShakeCoin();
    } else if (mode === 'yarrow') {
      runInteractiveDayangSplit();
    }
  };

  const handleCascade = () => {
    if (isBusy || visibleYaos.length >= 6) return;
    if (onRequestCascadeCast) {
      onRequestCascadeCast();
      return;
    }
    if (mode === 'coins') {
      const rest = Array.from({ length: 6 - coinThrows.length }, () => rollThreeCoins());
      onUpdateCoins([...coinThrows, ...rest]);
    } else if (mode === 'yarrow') {
      const rest = Array.from({ length: 6 - yarrowYaos.length }, () => rollYarrowSingleLine());
      onUpdateYarrow([...yarrowYaos, ...rest]);
    }
  };

  const handleReset = () => {
    clearYarrowTimers();
    setLastDayangDetail(null);
    if (mode === 'coins') onUpdateCoins([]);
    else if (mode === 'yarrow') onUpdateYarrow([]);
  };

  const sealNode =
    isComplete && liuyaoPreview ? (
      <div className="liuyao-seal-banner" aria-live="polite">
        <span className="liuyao-seal-stamp">成卦</span>
        <strong className="liuyao-seal-name">
          {liuyaoPreview.changedName && liuyaoPreview.changedName !== liuyaoPreview.originalName
            ? `${liuyaoPreview.originalName} → ${liuyaoPreview.changedName}`
            : liuyaoPreview.originalName}
        </strong>
        {liuyaoPreview.palaceText ? (
          <small className="liuyao-seal-palace">{liuyaoPreview.palaceText}</small>
        ) : null}
      </div>
    ) : null;

  const stepBar =
    mode === 'coins' || mode === 'yarrow' ? (
      <div className="ritual-step-stack">
        <div className="ritual-step-bar" aria-label="六爻进度">
          {YAO_POS_LABELS.map((label, idx) => {
            const done = idx < visibleYaos.length;
            const current = !isComplete && idx === visibleYaos.length;
            return (
              <span
                key={label}
                className={`ritual-step-pill${done ? ' is-done' : ''}${current ? ' is-current' : ''}`}
              >
                {label}
              </span>
            );
          })}
        </div>
        {sealNode}
      </div>
    ) : (
      sealNode
    );

  const headNode = (
    <div className="manual-entry-head">
      <strong>{headTitle}</strong>
      <span className="manual-progress-pill">{`${visibleYaos.length} / 6`}</span>
    </div>
  );

  const actions =
    mode === 'coins' || mode === 'yarrow' ? (
      visibleYaos.length < 6 ? (
        <>
          <button
            type="button"
            className="workspace-ui-button is-primary ritual-primary-btn"
            disabled={isBusy}
            onClick={handleCastNext}
          >
            {isCascading
              ? '连摇成卦中…'
              : yarrowSplitInfo
                ? '三变演爻中…'
                : isShaking || isHoldingShell
                  ? '摇卦中…'
                  : mode === 'coins'
                    ? `摇${YAO_POS_LABELS[visibleYaos.length]} (${visibleYaos.length + 1}/6)`
                    : `演${YAO_POS_LABELS[visibleYaos.length]} (${visibleYaos.length + 1}/6)`}
          </button>
          <button
            type="button"
            className="workspace-ui-button is-secondary"
            disabled={isBusy}
            onClick={handleCascade}
          >
            {mode === 'coins' ? '一键连摇' : '连演六爻'}
          </button>
          {visibleYaos.length > 0 ? (
            <button
              type="button"
              className="workspace-ui-button is-secondary manual-reset-inline-btn"
              disabled={isBusy}
              onClick={handleReset}
            >
              重起
            </button>
          ) : null}
        </>
      ) : (
        <>
          {showSubmitButton ? (
            <button type="submit" className="workspace-ui-button is-primary ritual-primary-btn">
              开始占卜
            </button>
          ) : null}
          <button
            type="button"
            className="workspace-ui-button is-secondary"
            onClick={handleReset}
          >
            重起
          </button>
        </>
      )
    ) : showSubmitButton ? (
      <button type="submit" className="workspace-ui-button is-primary ritual-primary-btn">
        开始占卜
      </button>
    ) : null;

  const leftExtra =
    mode === 'coins' ? (
      <div className="liuyao-studio-left-group">
        {headNode}
        <CoinTrayVisual
          coinThrows={coinThrows}
          animatingIndex={coinThrows.length - 1}
          isShakingShell={isShaking}
          isHoldingShell={isHoldingShell}
          canTap={canTapCast}
          onTapCast={handleCastNext}
          onHoldStart={onHoldShakeStart}
          onHoldEnd={onHoldShakeRelease}
        />
      </div>
    ) : mode === 'yarrow' ? (
      <div className="liuyao-studio-left-group">
        {headNode}
        <YarrowTrayVisual
          yarrowYaos={yarrowYaos}
          lastDayangDetail={lastDayangDetail}
          activeSplitInfo={yarrowSplitInfo}
          canTap={canTapCast}
          onSplitCast={(leftSplit) => runInteractiveDayangSplit(leftSplit)}
        />
      </div>
    ) : null;

  const stackNode = (
    <div className="liuyao-reveal-stack" aria-label="逐爻显示六爻卦象">
      {[5, 4, 3, 2, 1, 0].map((i) => {
        const val = visibleYaos[i];
        const isYin = val === 6 || val === 8;
        const isMoving = val === 6 || val === 9;
        const yaoLabel = YAO_PILL_CHOICES.find((c) => c.value === val)?.short ?? '';

        return (
          <div
            key={i}
            className={`liuyao-reveal-row${val ? ' is-filled' : ''}${
              i === visibleYaos.length - 1 ? ' is-latest' : ''
            }`}
          >
            <span className="liuyao-reveal-label">{YAO_POS_LABELS[i]}</span>
            <span
              className={`liuyao-reveal-line${val ? ' is-filled' : ''}${
                isYin ? ' is-yin' : ' is-yang'
              }${isMoving ? ' is-moving' : ''}`}
            >
              {val ? isYin ? (
                <>
                  <i />
                  <i />
                </>
              ) : (
                <i />
              ) : null}
            </span>
            {mode === 'manual' ? (
              <div className="manual-yao-pill-group">
                {YAO_PILL_CHOICES.map((choice) => (
                  <button
                    key={choice.value}
                    type="button"
                    className={`manual-yao-pill${
                      manualYaos[i] === choice.value ? ' is-active' : ''
                    }${choice.value === 6 || choice.value === 9 ? ' is-moving' : ''}`}
                    title={`${YAO_POS_LABELS[i]}设为${choice.short} (${choice.value})`}
                    onClick={() => {
                      const next = [...manualYaos] as Array<6 | 7 | 8 | 9>;
                      next[i] = choice.value;
                      onUpdateManual(next);
                    }}
                  >
                    {choice.short}
                  </button>
                ))}
              </div>
            ) : (
              <span className="liuyao-reveal-value">
                {val ? yaoLabel : mode === 'coins' ? '待摇' : '待演'}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );

  const rightContent =
    mode === 'manual' ? (
      <>
        {headNode}
        {stackNode}
      </>
    ) : (
      stackNode
    );

  return { stepBar, leftExtra, rightContent, actions, isComplete };
}
