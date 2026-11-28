import * as React from 'react';
import { UiSegmentedControl } from '../shared/UiSegmentedControl';
import type { ShengbeiFace, ShengbeiKind } from './ManualCastStudio';
import { RitualStageShell } from './RitualStageShell';

const CN_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'] as const;

/**
 * 将 1–92 签号转为传统中文签序（如 1 -> 第一签，10 -> 第十签，42 -> 第四十二签）。
 */
export function toChineseLotNumber(num: number): string {
  if (!Number.isInteger(num) || num < 1 || num > 99) return `第${num}签`;
  if (num < 10) return `第${CN_DIGITS[num]}签`;
  const tens = Math.floor(num / 10);
  const ones = num % 10;
  const tensPart = tens === 1 ? '十' : `${CN_DIGITS[tens]}十`;
  const onesPart = ones === 0 ? '' : CN_DIGITS[ones];
  return `第${tensPart}${onesPart}签`;
}

function FallbackLotCylinderSvg({ isShaking }: { isShaking: boolean }) {
  return (
    <svg
      className={`ssgw-fallback-cylinder${isShaking ? ' is-shaking' : ''}`}
      viewBox="0 0 140 180"
      fill="none"
      aria-label="三山国王灵签竹签筒"
    >
      <g stroke="currentColor" strokeWidth="4.2" strokeLinecap="round">
        <line x1="52" y1="64" x2="46" y2="24" opacity="0.65" />
        <line x1="60" y1="62" x2="57" y2="18" opacity="0.82" />
        <line x1="69" y1="60" x2="70" y2="14" className="ssgw-svg-lot-tip" />
        <line x1="78" y1="62" x2="82" y2="19" opacity="0.78" />
        <line x1="86" y1="64" x2="93" y2="26" opacity="0.6" />
      </g>
      <g className="ssgw-svg-lot-heads">
        <circle cx="46" cy="24" r="2.2" />
        <circle cx="57" cy="18" r="2.2" />
        <circle cx="70" cy="14" r="2.6" />
        <circle cx="82" cy="19" r="2.2" />
        <circle cx="93" cy="26" r="2.2" />
      </g>
      <path
        d="M42 64C42 60 98 60 98 64L94 152C94 158 46 158 46 152L42 64Z"
        className="ssgw-svg-cylinder-body"
        strokeWidth="2"
      />
      <ellipse cx="70" cy="64" rx="28" ry="6.5" className="ssgw-svg-cylinder-rim" strokeWidth="1.8" />
      <path d="M44 96C56 100 84 100 96 96" stroke="currentColor" strokeWidth="1.5" opacity="0.55" />
      <path d="M45 128C57 132 83 132 95 128" stroke="currentColor" strokeWidth="1.5" opacity="0.55" />
      <rect
        x="59"
        y="100"
        width="22"
        height="26"
        rx="3"
        className="ssgw-svg-cylinder-plaque"
        strokeWidth="1.2"
      />
      <text
        x="70"
        y="117"
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        className="ssgw-svg-cylinder-char"
      >
        签
      </text>
    </svg>
  );
}

function FallbackCupSvg({ face }: { face: 'yang' | 'yin' }) {
  return (
    <svg
      className={`ssgw-fallback-cup is-${face}`}
      viewBox="0 0 88 52"
      fill="none"
      aria-label={face === 'yang' ? '圣杯阳面（平）' : '圣杯阴面（凸）'}
    >
      <path
        d="M10 35C18 11 46 6 78 21C67 34 45 43 10 35Z"
        className="ssgw-fallback-cup-shape"
        strokeWidth="2"
      />
      {face === 'yang' ? (
        <path
          d="M18 32C34 26 52 24 69 22"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeDasharray="3 3"
          opacity="0.55"
        />
      ) : (
        <path
          d="M22 25C38 14 55 15 69 21"
          stroke="currentColor"
          strokeWidth="1.4"
          opacity="0.55"
        />
      )}
    </svg>
  );
}

export interface SsgwRitualStudioProps {
  mode: 'interactive' | 'random' | 'manual';
  candidateNumber: string;
  confirmed: boolean;
  beiMessage: string;
  beiPair?: readonly [ShengbeiFace, ShengbeiFace];
  beiHistory: ReadonlyArray<{ short: string; ok: boolean; kind?: ShengbeiKind }>;
  isShaking: boolean;
  isThrowingCups: boolean;
  showSubmitButton?: boolean;
  onChangeMode: (next: 'interactive' | 'random' | 'manual') => void;
  onChangeManualNumber: (next: string) => void;
  onRequestShake: () => void;
  onShakeComplete: () => void;
  onRequestThrow: () => void;
}

export function SsgwRitualStudio({
  mode,
  candidateNumber,
  confirmed,
  beiMessage,
  beiPair,
  beiHistory,
  isShaking,
  isThrowingCups,
  showSubmitButton = false,
  onChangeMode,
  onChangeManualNumber,
  onRequestShake,
  onShakeComplete,
  onRequestThrow,
}: SsgwRitualStudioProps) {
  const maxNum = 92;
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const onShakeCompleteRef = React.useRef(onShakeComplete);
  onShakeCompleteRef.current = onShakeComplete;
  const [shrineImgFailed, setShrineImgFailed] = React.useState(false);
  const [videoFailed, setVideoFailed] = React.useState(false);
  const [failedCups, setFailedCups] = React.useState<Record<number, boolean>>({});

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video || !isShaking) {
      if (video && !candidateNumber && !isShaking) {
        try {
          video.pause();
          video.currentTime = 0;
        } catch {}
      }
      return;
    }

    let settled = false;
    const fallbackTimer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        onShakeCompleteRef.current();
      }
    }, 6500);

    const settleShake = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(fallbackTimer);
      onShakeCompleteRef.current();
    };

    const handleEnded = () => settleShake();
    const handleCanPlay = () => {
      try {
        video.currentTime = 0;
      } catch {}
      void video.play().catch(() => {
        window.setTimeout(settleShake, 1200);
      });
    };
    const handleError = () => {
      setVideoFailed(true);
      window.setTimeout(settleShake, 800);
    };

    video.addEventListener('ended', handleEnded, { once: true });
    video.addEventListener('canplay', handleCanPlay, { once: true });
    video.addEventListener('error', handleError, { once: true });

    if (video.readyState >= 2) {
      handleCanPlay();
    }

    return () => {
      settled = true;
      window.clearTimeout(fallbackTimer);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
    };
  }, [isShaking, candidateNumber]);

  const parsedNum = Number.parseInt(candidateNumber, 10);
  const validLotNum =
    Number.isInteger(parsedNum) && parsedNum >= 1 && parsedNum <= maxNum ? parsedNum : undefined;

  const hasLotOut = Boolean(validLotNum) && !isShaking;
  const hasThrownAtLeastOnce = beiHistory.length > 0;
  const latestBei = hasThrownAtLeastOnce ? beiHistory[beiHistory.length - 1] : undefined;
  const latestKind: ShengbeiKind | undefined = latestBei
    ? latestBei.kind ?? (latestBei.ok ? 'sacred' : 'laugh')
    : undefined;
  const isYinLocked = !isThrowingCups && !confirmed && latestKind === 'yin';

  const currentStep = !hasLotOut ? 1 : confirmed ? 3 : 2;
  const cupStatusText = isThrowingCups
    ? '圣杯起落中…'
    : !hasThrownAtLeastOnce
      ? '请掷圣杯'
      : beiMessage ||
        (latestKind === 'sacred'
          ? '圣杯已定'
          : latestKind === 'yin'
            ? '阴杯 · 此签未契，请重摇签筒'
            : '笑杯 · 可再掷或重摇');

  const displayPair: readonly [ShengbeiFace, ShengbeiFace] = beiPair ?? ['yang', 'yin'];

  const stepBar =
    mode === 'interactive' ? (
      <ol className="ssgw-ritual-steps" aria-label="求签仪式进度">
        <li className={currentStep === 1 ? 'is-current' : 'is-done'}>
          <i>壹</i>
          <span>摇签</span>
        </li>
        <li className={currentStep === 2 ? 'is-current' : currentStep > 2 ? 'is-done' : ''}>
          <i>贰</i>
          <span>掷杯</span>
        </li>
        <li className={currentStep === 3 ? 'is-current is-done' : ''}>
          <i>叁</i>
          <span>启签</span>
        </li>
      </ol>
    ) : null;

  const actions =
    mode === 'interactive' ? (
      !hasLotOut ? (
        <button
          type="button"
          disabled={isShaking || isThrowingCups}
          className="workspace-ui-button is-primary ritual-primary-btn"
          onClick={onRequestShake}
        >
          {isShaking ? '摇签中…' : '摇动签筒'}
        </button>
      ) : confirmed ? (
        <>
          {showSubmitButton ? (
            <button type="submit" className="workspace-ui-button is-primary ritual-primary-btn">
              启签解运
            </button>
          ) : null}
          <button
            type="button"
            disabled={isShaking || isThrowingCups}
            className="workspace-ui-button is-secondary"
            onClick={onRequestShake}
          >
            重摇签筒
          </button>
        </>
      ) : isYinLocked ? (
        <button
          type="button"
          disabled={isShaking || isThrowingCups}
          className="workspace-ui-button is-primary ritual-primary-btn"
          onClick={onRequestShake}
        >
          重摇签筒
        </button>
      ) : hasThrownAtLeastOnce ? (
        <>
          <button
            type="button"
            disabled={isThrowingCups}
            className="workspace-ui-button is-primary ritual-primary-btn"
            onClick={onRequestThrow}
          >
            {isThrowingCups ? '掷杯中…' : '再掷圣杯'}
          </button>
          <button
            type="button"
            disabled={isShaking || isThrowingCups}
            className="workspace-ui-button is-secondary"
            onClick={onRequestShake}
          >
            重摇签筒
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            disabled={isThrowingCups}
            className="workspace-ui-button is-primary ritual-primary-btn"
            onClick={onRequestThrow}
          >
            {isThrowingCups ? '掷杯中…' : '掷圣杯'}
          </button>
          <button
            type="button"
            disabled={isShaking || isThrowingCups}
            className="workspace-ui-button is-secondary"
            onClick={onRequestShake}
          >
            重摇签筒
          </button>
        </>
      )
    ) : mode === 'random' ? (
      showSubmitButton ? (
        <button type="submit" className="workspace-ui-button is-primary ritual-primary-btn">
          诚心求签
        </button>
      ) : null
    ) : showSubmitButton ? (
      <button type="submit" className="workspace-ui-button is-primary ritual-primary-btn">
        启签解运
      </button>
    ) : null;

  return (
    <RitualStageShell
      title="三山国王灵签"
      subtitle="九十二签"
      className={`ssgw-sanctuary${confirmed ? ' is-confirmed' : ''}`}
      stepBar={stepBar}
      actions={actions}
      isComplete={mode === 'random' || (mode === 'interactive' ? confirmed : Boolean(validLotNum))}
      headerRight={
        <UiSegmentedControl<'interactive' | 'random' | 'manual'>
          value={mode}
          options={[
            { value: 'interactive', label: '摇筒求签' },
            { value: 'random', label: '静心机选' },
            { value: 'manual', label: '自录签号' },
          ]}
          onChange={onChangeMode}
        />
      }
    >
      {!shrineImgFailed ? (
        <div className="ssgw-shrine-banner">
          <img
            className="ssgw-shrine-img"
            src="/divination-assets/ritual/ssgw.webp"
            alt="三山国王神龛圣像"
            loading="eager"
            decoding="async"
            draggable={false}
            onError={() => setShrineImgFailed(true)}
          />
        </div>
      ) : null}

      <div className="ssgw-altar-body">
        {mode === 'interactive' ? (
          !hasLotOut ? (
            <div className="ssgw-cylinder-stage">
              <button
                type="button"
                className={`ssgw-cylinder-trigger${isShaking ? ' is-shaking' : ''}`}
                disabled={isShaking || isThrowingCups}
                onClick={onRequestShake}
                aria-label={isShaking ? '正在摇签' : '点击签筒摇签'}
              >
                <span
                  className="ssgw-cylinder-idle-wrap"
                  style={{ opacity: isShaking && !videoFailed ? 0 : 1 }}
                  aria-hidden={isShaking && !videoFailed}
                >
                  <FallbackLotCylinderSvg isShaking={isShaking} />
                </span>
                {!videoFailed ? (
                  <video
                    ref={videoRef}
                    className="ssgw-cylinder-video"
                    style={{ opacity: isShaking ? 1 : 0 }}
                    autoPlay={isShaking}
                    loop={false}
                    muted
                    playsInline
                    preload="auto"
                    aria-label="三山国王灵签抽签动画"
                    onLoadedData={() => {
                      if (!isShaking && videoRef.current) {
                        videoRef.current.pause();
                        try {
                          videoRef.current.currentTime = 0;
                        } catch {}
                      }
                    }}
                    onError={() => setVideoFailed(true)}
                  >
                    <source src="/divination-assets/ritual/fortune-shake.webm" type="video/webm" />
                  </video>
                ) : null}
              </button>

              <div className="ssgw-stage-caption">
                <strong>{isShaking ? '诚心摇签中…' : '点击签筒摇签'}</strong>
              </div>
            </div>
          ) : (
            <div className="ssgw-drawn-stage">
              <div className="ssgw-lot-plaque-row">
                <div className={`ssgw-lot-plaque${confirmed ? ' is-confirmed' : ''}`}>
                  <span className="ssgw-lot-plaque-kicker">所求灵签</span>
                  <strong className="ssgw-lot-plaque-cn">
                    {validLotNum ? toChineseLotNumber(validLotNum) : ''}
                  </strong>
                  {validLotNum ? (
                    <span className="ssgw-lot-plaque-num">{`No.${String(validLotNum).padStart(2, '0')}`}</span>
                  ) : null}
                  {confirmed ? (
                    <div className="ssgw-confirmed-stamp" aria-label="圣杯应允">
                      <span>圣杯</span>
                      <span>应允</span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div
                className={`ssgw-cup-altar${
                  !hasThrownAtLeastOnce && !isThrowingCups ? ' is-awaiting' : ''
                }${isThrowingCups ? ' is-throwing' : ''}${
                  confirmed ? ' is-confirmed' : ''
                }${isYinLocked ? ' is-yin' : !confirmed && hasThrownAtLeastOnce && !isThrowingCups ? ' is-laugh' : ''}`}
              >
                <button
                  type="button"
                  className="ssgw-cup-cushion"
                  disabled={isThrowingCups || confirmed || isYinLocked}
                  onClick={onRequestThrow}
                  aria-label={
                    confirmed
                      ? '圣杯已定'
                      : isYinLocked
                        ? '阴杯未契，请重摇签筒'
                        : '点击供垫掷圣杯'
                  }
                >
                  <div className="ssgw-cup-pair">
                    {displayPair.map((face, idx) => {
                      const cupCls = `ssgw-bei-cup is-${face} ${idx === 0 ? 'is-left' : 'is-right'}`;
                      return failedCups[idx] ? (
                        <figure key={idx} className={cupCls}>
                          <FallbackCupSvg face={face} />
                        </figure>
                      ) : (
                        <figure key={idx} className={cupCls}>
                          <img
                            src={`/divination-assets/ritual/shengbei-${face}.webp`}
                            alt={`第${idx + 1}枚圣杯：${face === 'yang' ? '阳面（平）' : '阴面（凸）'}`}
                            loading="lazy"
                            onError={() => setFailedCups((prev) => ({ ...prev, [idx]: true }))}
                          />
                        </figure>
                      );
                    })}
                  </div>
                </button>

                <div
                  className={`ssgw-cup-status${
                    confirmed
                      ? ' is-sacred'
                      : isYinLocked
                        ? ' is-yin'
                        : hasThrownAtLeastOnce && !isThrowingCups
                          ? ' is-laugh'
                          : ''
                  }`}
                >
                  {cupStatusText}
                </div>

                {beiHistory.length > 0 ? (
                  <div className="ssgw-bei-records" aria-label="掷杯记录">
                    {beiHistory.map((item, idx) => {
                      const kind = item.kind ?? (item.ok ? 'sacred' : 'laugh');
                      return (
                        <span key={idx} className={`is-${kind}`}>
                          {`${idx + 1} · ${item.short}`}
                        </span>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
          )
        ) : null}

        {mode === 'random' ? (
          <div className="ssgw-random-stage">
            <div className="ssgw-cylinder-trigger is-still" aria-hidden="true">
              <FallbackLotCylinderSvg isShaking={false} />
            </div>
            <div className="ssgw-stage-caption">
              <strong>九十二签 · 诚心机选</strong>
            </div>
          </div>
        ) : null}

        {mode === 'manual' ? (
          <div className="ssgw-manual-box">
            <div className="ssgw-manual-lot-preview">
              <strong className={validLotNum ? 'is-filled' : ''}>
                {validLotNum ? toChineseLotNumber(validLotNum) : '请输入 1–92 签号'}
              </strong>
              {validLotNum ? (
                <span>{`No.${String(validLotNum).padStart(2, '0')}`}</span>
              ) : null}
            </div>

            <label className="workspace-ui-field ssgw-manual-input-wrap">
              <span>签号（1–92）</span>
              <input
                type="text"
                inputMode="numeric"
                className="workspace-ui-control ssgw-manual-number-input"
                value={candidateNumber}
                placeholder="1–92"
                onChange={(e) => onChangeManualNumber(e.target.value.replace(/[^\d]/g, '').slice(0, 2))}
              />
            </label>

            <div className="ssgw-manual-quick-row">
              <button
                type="button"
                className="ritual-mini-btn"
                onClick={() => {
                  const base = validLotNum ?? 2;
                  const next = base <= 1 ? maxNum : base - 1;
                  onChangeManualNumber(String(next));
                }}
              >
                -1
              </button>
              <button
                type="button"
                className="ritual-mini-btn"
                onClick={() => {
                  const base = validLotNum ?? 0;
                  const next = base >= maxNum ? 1 : base + 1;
                  onChangeManualNumber(String(next));
                }}
              >
                +1
              </button>
              <button
                type="button"
                className="ritual-mini-btn"
                onClick={() => {
                  const next = Math.floor(Math.random() * maxNum) + 1;
                  onChangeManualNumber(String(next));
                }}
              >
                机选一签
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </RitualStageShell>
  );
}
