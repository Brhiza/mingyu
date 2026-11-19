/**
 * 拟真手动起卦 / 仪式感交互工作台组件（六爻铜钱/手动/大衍蓍草、观音灵签圣杯、小六壬掌诀、十二地支盘、八卦方位盘）。
 */

export type CoinThrow = {
  coins: [2 | 3, 2 | 3, 2 | 3];
  total: 6 | 7 | 8 | 9;
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

export function rollThreeCoins(): CoinThrow {
  const c1: 2 | 3 = Math.random() < 0.5 ? 2 : 3;
  const c2: 2 | 3 = Math.random() < 0.5 ? 2 : 3;
  const c3: 2 | 3 = Math.random() < 0.5 ? 2 : 3;
  return {
    coins: [c1, c2, c3],
    total: (c1 + c2 + c3) as 6 | 7 | 8 | 9,
  };
}

const YAO_NAME_MAP: Record<6 | 7 | 8 | 9, string> = {
  6: '老阴 · 动',
  7: '少阳',
  8: '少阴',
  9: '老阳 · 动',
};

function renderCoinTrayVisual(
  coinThrows: readonly CoinThrow[],
  animatingIndex: number,
  isShakingShell = false,
): HTMLElement {
  const tray = document.createElement('div');
  tray.className = 'manual-coin-tray';

  if (isShakingShell || coinThrows.length === 0) {
    const shellStage = document.createElement('div');
    shellStage.className = `manual-shell-stage${isShakingShell ? ' is-shaking' : ''}`;

    const shellImg = document.createElement('img');
    shellImg.className = 'manual-shell-img';
    shellImg.src = '/divination-assets/ritual/shell.webp';
    shellImg.alt = isShakingShell ? '龟壳正在摇卦' : '摇卦龟壳';
    shellImg.loading = 'lazy';
    shellImg.addEventListener('error', () => {
      shellImg.style.display = 'none';
    });

    const caption = document.createElement('span');
    caption.className = 'manual-shell-caption';
    const nextPos = YAO_POS_LABELS[coinThrows.length] ?? '六爻';
    caption.textContent = isShakingShell
      ? `正在摇${nextPos}…`
      : '龟壳蓄势 · 请点击下方摇出初爻';

    shellStage.append(shellImg, caption);
    tray.appendChild(shellStage);
    return tray;
  }

  const latest = coinThrows[coinThrows.length - 1]!;
  const resultWrap = document.createElement('div');
  resultWrap.className = 'manual-coin-result-stage';

  const row = document.createElement('div');
  row.className = 'manual-coin-result-grid';

  latest.coins.forEach((val, idx) => {
    const coin = document.createElement('div');
    const isYang = val === 3;
    coin.className = `manual-bronze-coin is-photo ${isYang ? 'is-front' : 'is-back'}${animatingIndex >= 0 ? ' is-spinning' : ''}`;
    coin.setAttribute('aria-label', `第${idx + 1}枚铜钱：${isYang ? '字面(阳3)' : '背面(阴2)'}`);

    const img = document.createElement('img');
    img.className = 'manual-bronze-coin-img';
    img.src = isYang ? '/divination-assets/ritual/coin-heads.webp' : '/divination-assets/ritual/coin-tails.webp';
    img.alt = isYang ? '铜钱正面（阳·3）' : '铜钱背面（阴·2）';
    img.loading = 'lazy';
    img.addEventListener('error', () => {
      img.remove();
      coin.classList.remove('is-photo');
    });

    const rim = document.createElement('div');
    rim.className = 'manual-coin-rim';
    const hole = document.createElement('span');
    hole.className = 'manual-coin-hole';
    const topChar = document.createElement('em');
    topChar.className = 'manual-coin-label';
    topChar.textContent = isYang ? '乾' : '阴';
    const botChar = document.createElement('small');
    botChar.className = 'manual-coin-val';
    botChar.textContent = isYang ? '阳 · 3' : '背 · 2';
    rim.append(topChar, hole, botChar);

    coin.append(img, rim);
    row.appendChild(coin);
  });

  const caption = document.createElement('div');
  caption.className = 'manual-coin-result-caption';
  const yaoName = YAO_NAME_MAP[latest.total];
  const posName = YAO_POS_LABELS[coinThrows.length - 1] ?? '';
  caption.innerHTML = `<strong>${yaoName}</strong><span>${latest.total} 点 · ${posName}</span>`;

  resultWrap.append(row, caption);
  tray.appendChild(resultWrap);
  return tray;
}

function renderYarrowTrayVisual(yarrowYaos: readonly (6 | 7 | 8 | 9)[]): HTMLElement {
  const tray = document.createElement('div');
  tray.className = 'manual-coin-tray manual-yarrow-tray';

  const doneCount = yarrowYaos.length;
  const stage = document.createElement('div');
  stage.className = 'manual-yarrow-stage';

  const bundleRow = document.createElement('div');
  bundleRow.className = 'manual-yarrow-bundles';
  bundleRow.setAttribute('aria-hidden', 'true');
  // 三变象喻：每组策束象征大衍分二、挂一、揲四，随已演爻数逐步点亮
  for (let i = 0; i < 6; i++) {
    const stick = document.createElement('span');
    const val = yarrowYaos[i];
    stick.className = `manual-yarrow-stalk${val ? ' is-done' : i === doneCount ? ' is-next' : ''}`;
    stick.textContent = val ? YAO_POS_LABELS[i]!.slice(0, 1) : String(i + 1);
    bundleRow.appendChild(stick);
  }

  const caption = document.createElement('span');
  caption.className = 'manual-shell-caption';
  if (doneCount === 0) {
    caption.textContent = '大衍四十九策 · 准备起第一爻';
  } else if (doneCount < 6) {
    const latest = yarrowYaos[doneCount - 1]!;
    const pos = YAO_POS_LABELS[doneCount - 1] ?? '';
    caption.textContent = `${pos}已得 ${YAO_NAME_MAP[latest]} · 余策待演下一爻`;
  } else {
    caption.textContent = '十八变圆满 · 六爻已成';
  }

  stage.append(bundleRow, caption);
  tray.appendChild(stage);
  return tray;
}

export function renderInteractiveLiuyaoStudio(options: {
  mode: 'coins' | 'manual' | 'yarrow';
  coinThrows: CoinThrow[];
  manualYaos: Array<6 | 7 | 8 | 9>;
  yarrowYaos: Array<6 | 7 | 8 | 9>;
  isShaking?: boolean;
  onRequestShakeCoin?: () => void;
  onUpdateCoins: (next: CoinThrow[]) => void;
  onUpdateManual: (next: Array<6 | 7 | 8 | 9>) => void;
  onUpdateYarrow: (next: Array<6 | 7 | 8 | 9>) => void;
  splitTargets?: { leftCol: HTMLElement; rightCol: HTMLElement };
}): HTMLElement {
  const panel = document.createElement('div');
  panel.className = 'divination-extra-panel manual-studio-panel liuyao-manual-panel';

  const visibleYaos =
    options.mode === 'coins'
      ? options.coinThrows.map((t) => t.total)
      : options.mode === 'manual'
        ? options.manualYaos
        : options.yarrowYaos;

  const head = document.createElement('div');
  head.className = 'manual-entry-head';
  const title = document.createElement('strong');
  if (options.mode === 'coins') {
    title.textContent =
      options.coinThrows.length < 6
        ? `待摇${YAO_POS_LABELS[options.coinThrows.length]}`
        : '六爻已成';
  } else if (options.mode === 'yarrow') {
    title.textContent =
      options.yarrowYaos.length < 6
        ? `大衍揲蓍 · ${YAO_POS_LABELS[options.yarrowYaos.length]}`
        : '六爻已成';
  } else {
    title.textContent = '逐爻设置阴阳动静';
  }
  const badge = document.createElement('span');
  badge.className = 'manual-progress-pill';
  badge.textContent = `${visibleYaos.length} / 6`;
  head.append(title, badge);

  const leftMount = options.splitTargets?.leftCol ?? panel;
  const rightMount = options.splitTargets?.rightCol ?? panel;

  if (options.mode === 'coins') {
    const coinWrap = document.createElement('div');
    coinWrap.className = 'liuyao-studio-left-group';
    coinWrap.appendChild(head);
    coinWrap.appendChild(
      renderCoinTrayVisual(
        options.coinThrows,
        options.coinThrows.length - 1,
        Boolean(options.isShaking),
      ),
    );
    leftMount.appendChild(coinWrap);
  } else if (options.mode === 'yarrow') {
    const yarrowWrap = document.createElement('div');
    yarrowWrap.className = 'liuyao-studio-left-group';
    yarrowWrap.appendChild(head);
    yarrowWrap.appendChild(renderYarrowTrayVisual(options.yarrowYaos));
    leftMount.appendChild(yarrowWrap);
  } else {
    rightMount.appendChild(head);
  }

  // 六爻自下而上（初爻在底部，上爻在顶部）
  const stack = document.createElement('div');
  stack.className = 'liuyao-reveal-stack';
  stack.setAttribute('aria-label', '逐爻显示六爻卦象');

  for (let i = 5; i >= 0; i--) {
    const val = visibleYaos[i];
    const isYin = val === 6 || val === 8;
    const isMoving = val === 6 || val === 9;

    const row = document.createElement('div');
    row.className = `liuyao-reveal-row${val ? ' is-filled' : ''}${
      i === visibleYaos.length - 1 ? ' is-latest' : ''
    }`;

    const labelSpan = document.createElement('span');
    labelSpan.className = 'liuyao-reveal-label';
    labelSpan.textContent = YAO_POS_LABELS[i]!;

    const lineSpan = document.createElement('span');
    lineSpan.className = `liuyao-reveal-line${val ? ' is-filled' : ''}${
      isYin ? ' is-yin' : ' is-yang'
    }${isMoving ? ' is-moving' : ''}`;
    if (val) {
      if (isYin) {
        lineSpan.append(document.createElement('i'), document.createElement('i'));
      } else {
        lineSpan.appendChild(document.createElement('i'));
      }
    }

    row.append(labelSpan, lineSpan);

    if (options.mode === 'manual') {
      const pillGroup = document.createElement('div');
      pillGroup.className = 'manual-yao-pill-group';
      for (const choice of YAO_PILL_CHOICES) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `manual-yao-pill${options.manualYaos[i] === choice.value ? ' is-active' : ''}${
          choice.value === 6 || choice.value === 9 ? ' is-moving' : ''
        }`;
        btn.textContent = choice.short;
        btn.title = `${YAO_POS_LABELS[i]}设为${choice.short} (${choice.value})`;
        btn.addEventListener('click', () => {
          const next = [...options.manualYaos];
          next[i] = choice.value;
          options.onUpdateManual(next);
        });
        pillGroup.appendChild(btn);
      }
      row.appendChild(pillGroup);
    } else {
      const valSpan = document.createElement('span');
      valSpan.className = 'liuyao-reveal-value';
      const yaoLabel = YAO_PILL_CHOICES.find((c) => c.value === val)?.short ?? '';
      if (options.mode === 'coins') {
        valSpan.textContent = val ? yaoLabel : '待摇';
      } else {
        valSpan.textContent = val ? yaoLabel : '待演';
      }
      row.appendChild(valSpan);
    }

    stack.appendChild(row);
  }
  rightMount.appendChild(stack);

  if (options.mode === 'coins' || options.mode === 'yarrow') {
    const actions = document.createElement('div');
    actions.className = 'manual-session-actions';

    if (visibleYaos.length < 6) {
      const oneBtn = document.createElement('button');
      oneBtn.type = 'button';
      oneBtn.className = 'workspace-ui-button is-secondary liuyao-shake-button';
      oneBtn.disabled = Boolean(options.isShaking);
      oneBtn.textContent =
        options.isShaking
          ? '摇卦中…'
          : options.mode === 'coins'
            ? `摇${YAO_POS_LABELS[visibleYaos.length]}`
            : `演${YAO_POS_LABELS[visibleYaos.length]}`;
      oneBtn.addEventListener('click', () => {
        if (options.mode === 'coins') {
          if (options.onRequestShakeCoin) {
            options.onRequestShakeCoin();
          } else if (options.coinThrows.length < 6) {
            options.onUpdateCoins([...options.coinThrows, rollThreeCoins()]);
          }
        } else if (options.yarrowYaos.length < 6) {
          options.onUpdateYarrow([...options.yarrowYaos, rollYarrowSingleLine()]);
        }
      });

      const allBtn = document.createElement('button');
      allBtn.type = 'button';
      allBtn.className = 'workspace-ui-button is-secondary liuyao-shake-button';
      allBtn.textContent = options.mode === 'coins' ? '一键连摇六爻' : '连演满六爻';
      allBtn.addEventListener('click', () => {
        if (options.mode === 'coins') {
          const rest = Array.from({ length: 6 - options.coinThrows.length }, () => rollThreeCoins());
          options.onUpdateCoins([...options.coinThrows, ...rest]);
        } else {
          const rest = Array.from({ length: 6 - options.yarrowYaos.length }, () => rollYarrowSingleLine());
          options.onUpdateYarrow([...options.yarrowYaos, ...rest]);
        }
      });
      actions.append(oneBtn, allBtn);
    }

    if (visibleYaos.length > 0) {
      const resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.className = 'workspace-ui-button is-secondary is-small manual-reset-button';
      resetBtn.textContent = '清空重起';
      resetBtn.addEventListener('click', () => {
        if (options.mode === 'coins') options.onUpdateCoins([]);
        else options.onUpdateYarrow([]);
      });
      actions.appendChild(resetBtn);
    }

    leftMount.appendChild(actions);
  }

  return panel;
}

/**
 * 传统大衍揲蓍法真实概率（6: 1/16, 7: 5/16, 8: 7/16, 9: 3/16）。
 */
function rollYarrowSingleLine(): 6 | 7 | 8 | 9 {
  const r = Math.random() * 16;
  if (r < 1) return 6;
  if (r < 6) return 7;
  if (r < 13) return 8;
  return 9;
}

const GUANYIN_BEI_STATES: ReadonlyArray<{
  short: string;
  label: string;
  desc: string;
  ok: boolean;
  pair: readonly ['yang' | 'yin', 'yang' | 'yin'];
}> = [
  { short: '圣杯', label: '圣杯 · 一平一仰', desc: '神明应允，签号确定！', ok: true, pair: ['yang', 'yin'] },
  { short: '笑杯', label: '笑杯 · 双平朝上', desc: '请重新晃动签筒再抽', ok: false, pair: ['yang', 'yang'] },
  { short: '阴杯', label: '阴杯 · 双凸朝下', desc: '机缘未契，请重抽一签', ok: false, pair: ['yin', 'yin'] },
];

export function rollShengbeiResult() {
  const roll = Math.random();
  const idx = roll < 0.72 ? 0 : roll < 0.88 ? 1 : 2;
  return GUANYIN_BEI_STATES[idx]!;
}

export function renderInteractiveLotRitual(options: {
  method: 'ssgw';
  candidateNumber: string;
  confirmed: boolean;
  beiMessage: string;
  beiPair?: readonly ['yang' | 'yin', 'yang' | 'yin'];
  beiHistory?: ReadonlyArray<{ short: string; ok: boolean }>;
  isShaking?: boolean;
  isThrowingCups?: boolean;
  onRequestShake?: () => void;
  onShakeComplete?: () => void;
  onRequestThrow?: () => void;
  onUpdate: (
    nextNumber: string,
    confirmed: boolean,
    beiMessage: string,
    beiPair?: readonly ['yang' | 'yin', 'yang' | 'yin'],
  ) => void;
}): HTMLElement {
  const maxNum = 92;
  const panel = document.createElement('div');
  panel.className = 'divination-extra-panel manual-studio-panel manual-lot-ritual';

  const head = document.createElement('div');
  head.className = 'manual-entry-head';
  head.innerHTML = `<strong>三山国王灵签签筒 · 掷圣杯定签</strong><span>1–${maxNum}号</span>`;
  panel.appendChild(head);

  const stage = document.createElement('div');
  stage.className = 'manual-lot-stage';

  if (!options.candidateNumber || options.isShaking) {
    const isShaking = Boolean(options.isShaking);
    const videoWrap = document.createElement('div');
    videoWrap.className = `manual-lot-video-wrap${isShaking ? ' is-shaking' : ''}`;
    const video = document.createElement('video');
    video.className = 'manual-lot-video';
    video.autoplay = isShaking;
    video.loop = false;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.setAttribute('aria-label', '灵签签筒动画');
    const source = document.createElement('source');
    source.src = '/divination-assets/ritual/fortune-shake.webm';
    source.type = 'video/webm';
    video.appendChild(source);
    if (isShaking) {
      let shakeSettled = false;
      let fallbackTimer = 0;
      const settleShake = () => {
        if (shakeSettled) return;
        shakeSettled = true;
        if (fallbackTimer) window.clearTimeout(fallbackTimer);
        options.onShakeComplete?.();
      };
      // 必须等签筒视频完整播完再落签；仅在解码异常或超时卡死时兜底结束
      video.addEventListener('ended', settleShake, { once: true });
      video.addEventListener(
        'canplay',
        () => {
          try {
            video.currentTime = 0;
          } catch {}
          void video.play().catch(() => {
            window.setTimeout(settleShake, 1200);
          });
        },
        { once: true },
      );
      video.addEventListener(
        'error',
        () => {
          video.style.display = 'none';
          window.setTimeout(settleShake, 800);
        },
        { once: true },
      );
      fallbackTimer = window.setTimeout(settleShake, 6500);
    } else {
      video.addEventListener(
        'loadeddata',
        () => {
          video.pause();
          try {
            video.currentTime = 0;
          } catch {}
        },
        { once: true },
      );
      video.addEventListener('error', () => {
        video.style.display = 'none';
      });
    }
    videoWrap.appendChild(video);

    const statusLine = document.createElement('div');
    statusLine.className = 'manual-lot-shake-caption';
    statusLine.innerHTML = isShaking
      ? '<strong>诚心摇签中</strong><small>请静心默念所问之事…</small>'
      : '<strong>签筒静候</strong><small>点击下方摇动签筒抽签</small>';
    stage.append(videoWrap, statusLine);
  } else {
    const drawnHero = document.createElement('div');
    drawnHero.className = `manual-lot-drawn-hero${options.confirmed ? ' is-confirmed' : ''}`;
    drawnHero.innerHTML = `
      <span class="manual-lot-kicker">所求灵签</span>
      <div class="manual-lot-big-num"><small>第</small><strong>${options.candidateNumber}</strong><small>签</small></div>
    `;
    stage.appendChild(drawnHero);

    const cupHead = document.createElement('div');
    cupHead.className = 'manual-cup-heading';
    cupHead.textContent = options.beiMessage || '请掷圣杯确认此签';
    stage.appendChild(cupHead);

    const pair = options.beiPair ?? (['yang', 'yin'] as const);
    const cupsRow = document.createElement('div');
    cupsRow.className = `manual-bei-stage${options.isThrowingCups ? ' is-throwing' : ''}${options.confirmed ? ' is-confirmed' : ''}`;
    cupsRow.setAttribute('aria-label', '一对圣杯');
    pair.forEach((face, idx) => {
      const fig = document.createElement('figure');
      fig.className = 'manual-bei-cup';
      const img = document.createElement('img');
      img.src = `/divination-assets/ritual/shengbei-${face}.webp`;
      img.alt = `第${idx + 1}枚圣杯：${face === 'yang' ? '阳面（平）' : '阴面（凸）'}`;
      img.loading = 'lazy';
      img.addEventListener('error', () => {
        fig.style.display = 'none';
      });
      fig.appendChild(img);
      cupsRow.appendChild(fig);
    });
    stage.appendChild(cupsRow);

    if (options.beiHistory && options.beiHistory.length > 0) {
      const hist = document.createElement('div');
      hist.className = 'manual-bei-history';
      options.beiHistory.forEach((item, idx) => {
        const chip = document.createElement('span');
        chip.className = item.ok ? 'is-sacred' : '';
        chip.textContent = `${idx + 1} · ${item.short}`;
        hist.appendChild(chip);
      });
      stage.appendChild(hist);
    }
  }

  const actions = document.createElement('div');
  actions.className = 'manual-session-actions';

  const shakeBtn = document.createElement('button');
  shakeBtn.type = 'button';
  shakeBtn.disabled = Boolean(options.isShaking || options.isThrowingCups);
  shakeBtn.className = 'workspace-ui-button is-secondary';
  shakeBtn.textContent = options.isShaking
    ? '摇签中…'
    : options.candidateNumber
      ? '重摇签筒'
      : '摇动签筒抽签';
  shakeBtn.addEventListener('click', () => {
    if (options.onRequestShake) {
      options.onRequestShake();
    } else {
      const n = String(Math.floor(Math.random() * maxNum) + 1);
      options.onUpdate(n, false, '签已落出，请掷圣杯核验。', ['yang', 'yin']);
    }
  });
  actions.appendChild(shakeBtn);

  if (options.candidateNumber && !options.isShaking && !options.confirmed && options.method === 'ssgw') {
    const beiBtn = document.createElement('button');
    beiBtn.type = 'button';
    beiBtn.disabled = Boolean(options.isThrowingCups);
    beiBtn.className = 'workspace-ui-button is-secondary';
    beiBtn.textContent = options.isThrowingCups ? '掷杯中…' : '掷圣杯确认';
    beiBtn.addEventListener('click', () => {
      if (options.onRequestThrow) {
        options.onRequestThrow();
      } else {
        const result = rollShengbeiResult();
        if (result.ok) {
          options.onUpdate(options.candidateNumber, true, `${result.label} — ${result.desc}`, result.pair);
        } else {
          options.onUpdate(options.candidateNumber, false, `${result.label} — ${result.desc}`, result.pair);
        }
      }
    });
    actions.appendChild(beiBtn);
  }

  stage.appendChild(actions);
  panel.appendChild(stage);
  return panel;
}
