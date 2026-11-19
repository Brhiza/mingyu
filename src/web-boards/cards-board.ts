import {
  asArray,
  asNumber,
  asRecord,
  asString,
  createBoardHeader,
  createMetaGrid,
  el,
  type UnknownRecord,
} from './dom';
import { createTermTrigger } from './shared';
import { createLenormandCardFace, createTarotCardFace } from './tarot-card-art';

function shortElementLabel(raw?: string): string {
  if (!raw) return '';
  return raw.split('（')[0]?.trim() ?? raw;
}

function formatDrawMethodLabel(raw?: string, context: 'cards' | 'ssgw' = 'cards'): string | undefined {
  if (!raw) return undefined;
  const normalized = raw.trim();
  if (!normalized) return undefined;
  const lower = normalized.toLowerCase();
  if (lower === 'random') return context === 'ssgw' ? '随机摇签' : '随机抽牌';
  if (lower === 'manual') return context === 'ssgw' ? '直录签号' : '手工录牌';
  if (lower === 'interactive') return context === 'ssgw' ? '摇筒亲抽' : '逐张亲手抽牌';
  return normalized.replace(/^Fisher-Yates\s+/i, '随机');
}

function getTarotSlotStyle(spreadType: string, idx: number): { gridArea?: string; chakraColor?: string; roleHint?: string } {
  switch (spreadType) {
    case 'holyTriangle': {
      const areas = ['top', 'left', 'right'];
      return { gridArea: areas[idx] };
    }
    case 'love': {
      const areas = ['left', 'right', 'center', 'bottom', 'top'];
      return { gridArea: areas[idx] };
    }
    case 'fourElements': {
      const areas = ['center', 'top', 'bottom', 'left', 'right'];
      return { gridArea: areas[idx] };
    }
    case 'decision': {
      const areas = ['base', 'a1', 'a2', 'b1', 'b2', 'advice'];
      return { gridArea: areas[idx] };
    }
    case 'relationship': {
      const areas = ['you1', 'other1', 'you2', 'other2', 'core', 'outcome'];
      return { gridArea: areas[idx] };
    }
    case 'celtic': {
      const areas = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10'];
      const hints = [
        '十字核心',
        '横跨阻碍',
        '上方目标',
        '下方根基',
        '左方过去',
        '右方未来',
        '权杖一·态度',
        '权杖二·环境',
        '权杖三·心绪',
        '权杖四·结局',
      ];
      return { gridArea: areas[idx], roleHint: hints[idx] };
    }
    case 'chakra': {
      const colors = ['#b91c1c', '#ea580c', '#ca8a04', '#15803d', '#0284c7', '#4338ca', '#7e22ce'];
      return { chakraColor: colors[idx] };
    }
    case 'horseshoe': {
      const areas = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7'];
      return { gridArea: areas[idx] };
    }
    case 'hexagram': {
      const areas = ['s1', 's2', 's3', 's4', 's5', 's6', 'core'];
      return { gridArea: areas[idx] };
    }
    default:
      return {};
  }
}

function renderTarot(container: HTMLElement, data: UnknownRecord): boolean {
  const cards = asArray(data.cards).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  if (cards.length === 0) return false;

  const spreadType = asString(data.spreadType) ?? 'single';
  const spreadName = asString(data.spreadName) ?? '塔罗牌阵';
  const draw = asRecord(data.draw);
  const drawMethod = asString(draw?.method);
  const isMajorOnly = asNumber(draw?.deckSize) === 22;
  const reversedCount = cards.filter((c) => c.reversed === true).length;
  const uprightCount = cards.length - reversedCount;
  const majorCount = cards.filter((c) => {
    const id = asNumber(c.id);
    return id !== undefined && id <= 22;
  }).length;
  const courtCount = cards.filter((c) => /侍从|骑士|王后|国王/u.test(asString(c.name) ?? '')).length;

  const badges: Array<{ text: string; tone?: 'accent' | 'neutral' | 'good' | 'warn' }> = [
    ...(isMajorOnly ? [{ text: '22张大阿卡纳', tone: 'accent' as const }] : [{ text: `大阿卡纳 ${majorCount}/${cards.length}`, tone: 'accent' as const }]),
    ...(courtCount > 0 ? [{ text: `宫廷牌 ${courtCount}`, tone: 'neutral' as const }] : []),
    { text: `正位 ${uprightCount}`, tone: 'good' },
    { text: `逆位 ${reversedCount}`, tone: reversedCount > 0 ? 'warn' : 'neutral' },
  ];

  container.append(
    createBoardHeader(
      isMajorOnly ? `大阿卡纳 · ${spreadName}` : spreadName,
      [isMajorOnly ? '22张大牌组' : '78张完整牌组', `${cards.length}张牌`, formatDrawMethodLabel(drawMethod)].filter(Boolean).join(' · '),
      badges,
    ),
  );

  // 四元素与大阿卡纳分布条（多牌阵展示）
  const elemCounts = new Map<string, number>();
  for (const c of cards) {
    const elKey = shortElementLabel(asString(c.element));
    if (elKey) elemCounts.set(elKey, (elemCounts.get(elKey) ?? 0) + 1);
  }
  if (cards.length > 1 && elemCounts.size > 0) {
    const bar = el('div', 'cb-elem-strip');
    const order = ['大阿卡纳', '火', '水', '风', '土'];
    for (const key of order) {
      const cnt = elemCounts.get(key);
      if (!cnt) continue;
      bar.append(el('span', `cb-elem-pill is-el-${key === '大阿卡纳' ? 'major' : key}`, `${key} ×${cnt}`));
    }
    if (bar.childElementCount > 0) container.append(bar);
  }

  const grid = el(
    'div',
    `cb-tarot-spread-table cb-card-grid cb-spread-${spreadType} cb-count-${cards.length}`,
  );
  grid.dataset.spread = spreadType;

  for (const [idx, card] of cards.entries()) {
    const reversed = card.reversed === true;
    const cardName = asString(card.name) ?? '未知牌';
    const position = asString(card.position) ?? `第 ${idx + 1} 牌位`;
    const element = asString(card.element);
    const shortEl = shortElementLabel(element);
    const archetype = asString(card.archetype);
    const keywords = asArray(card.keywords).map(asString).filter((x): x is string => Boolean(x));
    const slotStyle = getTarotSlotStyle(spreadType, idx);

    const item = el(
      'article',
      `cb-tarot-slot-card cb-card${reversed ? ' is-reversed' : ''}${spreadType === 'celtic' && idx === 1 ? ' is-crossing' : ''}`,
    );
    if (slotStyle.gridArea) {
      item.style.gridArea = slotStyle.gridArea;
    }
    if (slotStyle.chakraColor) {
      item.style.setProperty('--chakra-accent', slotStyle.chakraColor);
      item.classList.add('is-chakra-slot');
    }

    const posBadge = el('div', 'cb-slot-pos-badge cb-card-top');
    const posLeft = el('div', 'cb-slot-pos-left');
    posLeft.append(el('span', 'cb-slot-index', String(idx + 1)));
    posLeft.append(el('strong', 'cb-card-pos', position));
    posBadge.append(posLeft);
    if (slotStyle.roleHint) {
      posBadge.append(el('span', 'cb-slot-hint', slotStyle.roleHint));
    } else if (shortEl) {
      posBadge.append(el('span', 'cb-slot-el', shortEl));
    }
    item.append(posBadge);

    item.append(
      createTarotCardFace(
        {
          id: asNumber(card.id),
          name: cardName,
          reversed,
          position,
          element,
          keywords,
        },
        { size: cards.length === 1 ? 'lg' : cards.length >= 10 ? 'sm' : 'md' },
      ),
    );

    const metaBox = el('div', 'cb-slot-meta');
    const titleRow = el('div', 'cb-card-title-row');
    titleRow.append(
      createTermTrigger(cardName, cardName, 'cb-card-name', {
        title: `${cardName}（${reversed ? '逆位' : '正位'}）`,
        category: '塔罗牌义',
        subtitle: [position, element, archetype].filter(Boolean).join(' · ') || undefined,
        summary: keywords.length > 0 ? `核心关键词：${keywords.join('、')}` : archetype,
        detail: element ? `牌组属性：${element}${archetype ? `；牌阶：${archetype}` : ''}` : archetype,
        keywords,
      }),
    );
    titleRow.append(
      el('span', `wb-badge ${reversed ? 'wb-badge-warn' : 'wb-badge-good'}`, reversed ? '逆位' : '正位'),
    );
    metaBox.append(titleRow);

    if (archetype || element) {
      const subText = [shortEl, archetype].filter(Boolean).join(' · ');
      metaBox.append(el('p', 'cb-card-sub', subText));
    }

    if (keywords.length > 0) {
      const kwWrap = el('div', 'cb-keywords');
      for (const kw of keywords) {
        kwWrap.append(el('span', 'cb-kw-pill', kw));
      }
      metaBox.append(kwWrap);
    }

    item.append(metaBox);
    grid.append(item);
  }
  container.append(grid);

  // 读取真实 evidenceAnalysis 结构（相邻元素互动 / 重复主题 / 逆位提示）
  const ev = asRecord(data.evidenceAnalysis);
  const adjacent = asArray(ev?.adjacent).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  const recurring = asArray(ev?.recurringThemes).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  const reversalNotes = asArray(ev?.reversalConstraints).map(asString).filter((x): x is string => Boolean(x));

  const metaExtra = createMetaGrid([
    [
      '牌阵主元素主题',
      recurring.length > 0
        ? recurring.map((t) => `${asString(t.element) ?? ''} ${asNumber(t.count) ?? 0}张`).join(' · ')
        : undefined,
    ],
    [
      '相邻牌位元素呼应',
      adjacent.length > 0
        ? adjacent
            .slice(0, 6)
            .map(
              (a) =>
                `${asString(a.first) ?? ''}→${asString(a.second) ?? ''}：${asString(a.relation) ?? ''}`,
            )
            .join('；')
        : undefined,
    ],
    [
      '逆位留意要点',
      reversalNotes.length > 0 ? reversalNotes.slice(0, 4).join(' ') : undefined,
    ],
  ]);
  if (metaExtra) container.append(metaExtra);

  return true;
}

function getLenormandSlotArea(spreadType: string, idx: number): string | undefined {
  if (spreadType === 'five') return ['l1', 'l2', 'l3', 'l4', 'l5'][idx];
  if (spreadType === 'relationship') return ['you', 'other', 'bond', 'hidden', 'outcome'][idx];
  if (spreadType === 'decision') return ['base', 'a1', 'a2', 'b1', 'b2', 'advice'][idx];
  return undefined;
}

function renderLenormandGrandTableau(container: HTMLElement, data: UnknownRecord, cards: UnknownRecord[]): boolean {
  const spreadName = asString(data.spreadName) ?? '大桌牌阵';
  const draw = asRecord(data.draw);
  const homeCards = cards.filter((c) => asString(c.name) && asString(c.name) === asString(c.house));
  const peopleCards = cards.filter((c) => ['男士', '女士'].includes(asString(c.name) ?? ''));

  container.append(
    createBoardHeader(
      spreadName,
      ['雷诺曼 36 宫大桌全阵（9列 × 4排）', formatDrawMethodLabel(asString(draw?.method))].filter(Boolean).join(' · '),
      [
        { text: '36张全桌', tone: 'accent' },
        homeCards.length > 0 ? { text: `归宫 ${homeCards.length} 张`, tone: 'good' } : { text: '无归宫牌', tone: 'neutral' },
        peopleCards.length > 0 ? { text: `人物坐标已定`, tone: 'neutral' } : { text: '' },
      ],
    ),
  );

  // 找出男士/女士的近身格（8邻格）
  const nearPersonSet = new Set<number>();
  for (const p of peopleCards) {
    const pr = asNumber(p.row) ?? 0;
    const pc = asNumber(p.column) ?? 0;
    for (const c of cards) {
      const cr = asNumber(c.row) ?? 0;
      const cc = asNumber(c.column) ?? 0;
      if (Math.abs(cr - pr) <= 1 && Math.abs(cc - pc) <= 1 && !(cr === pr && cc === pc)) {
        const cid = asNumber(c.id);
        if (cid !== undefined) nearPersonSet.add(cid);
      }
    }
  }

  const gtGrid = el('div', 'cb-lenormand-gt-grid');
  gtGrid.setAttribute('role', 'group');
  gtGrid.setAttribute('aria-label', '雷诺曼三十六宫大桌');

  const detailCard = el('div', 'cb-gt-detail');
  const cellButtons: HTMLButtonElement[] = [];

  const selectIndex = (selectedIdx: number) => {
    cellButtons.forEach((btn, i) => {
      const active = i === selectedIdx;
      btn.classList.toggle('is-selected', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    const c = cards[selectedIdx];
    if (!c) return;
    const cid = asNumber(c.id);
    const cName = asString(c.name) ?? '未知牌';
    const cPos = asString(c.position) ?? '';
    const cHouse = asString(c.house);
    const cRow = asNumber(c.row);
    const cCol = asNumber(c.column);
    const isHome = Boolean(cHouse && cName === cHouse);
    const kws = asArray(c.keywords).map(asString).filter((x): x is string => Boolean(x));

    const neighbors = cards
      .filter((other) => {
        const or = asNumber(other.row);
        const oc = asNumber(other.column);
        if (or === undefined || oc === undefined || cRow === undefined || cCol === undefined) return false;
        const dr = Math.abs(or - cRow);
        const dc = Math.abs(oc - cCol);
        return dr <= 1 && dc <= 1 && dr + dc > 0;
      })
      .map((other) => `${asString(other.name) ?? ''}(#${asNumber(other.id) ?? ''})`)
      .join('、');

    detailCard.replaceChildren();
    const head = el('div', 'qm-detail-head');
    head.append(
      el(
        'strong',
        'qm-detail-title',
        `#${cid ?? '?'} ${cName}${cHouse ? ` · 落${cHouse}宫` : ''}${isHome ? '（归宫）' : ''}`,
      ),
    );
    const badges = el('div', 'wb-badges');
    if (cRow && cCol) badges.append(el('span', 'wb-badge wb-badge-neutral', `第${cRow}排 · 第${cCol}列`));
    if (isHome) badges.append(el('span', 'wb-badge wb-badge-good', '牌宫合一·归宫'));
    if (cid !== undefined && nearPersonSet.has(cid)) badges.append(el('span', 'wb-badge wb-badge-accent', '人物近身牌'));
    head.append(badges);
    detailCard.append(head);

    detailCard.append(createLenormandCardFace({
      id: cid,
      name: cName,
      isHomeHouse: isHome,
    }));

    const meta = createMetaGrid([
      ['所在宫位', cPos],
      ['核心牌义', asString(c.meaning)],
      ['关键词', kws.join(' · ') || undefined],
      ['九宫四邻', neighbors || undefined],
    ]);
    if (meta) detailCard.append(meta);
  };

  cards.forEach((c, idx) => {
    const cid = asNumber(c.id);
    const cName = asString(c.name) ?? '';
    const cHouse = asString(c.house) ?? '';
    const isHome = Boolean(cHouse && cName === cHouse);
    const isPerson = cName === '男士' || cName === '女士';
    const isNearPerson = cid !== undefined && nearPersonSet.has(cid);

    const cell = el(
      'button',
      `cb-gt-cell${isHome ? ' is-home' : ''}${isPerson ? ' is-person' : ''}${isNearPerson ? ' is-near-person' : ''}`,
    );
    cell.type = 'button';
    cell.append(el('span', 'cb-gt-house', `${idx + 1}·${cHouse || '宫'}`));
    cell.append(el('strong', 'cb-gt-card-name', cName));
    cell.append(el('span', 'cb-gt-card-id', `#${cid ?? '?'}`));
    cell.addEventListener('click', () => selectIndex(idx));
    cellButtons.push(cell);
    gtGrid.append(cell);
  });

  container.append(gtGrid, detailCard);
  const firstFocus = cards.findIndex((c) => ['男士', '女士'].includes(asString(c.name) ?? ''));
  selectIndex(firstFocus >= 0 ? firstFocus : 0);

  return true;
}

function appendLenormandSummaries(container: HTMLElement, data: UnknownRecord, cards: UnknownRecord[]) {
  const spreadType = asString(data.spreadType) ?? '';
  if (spreadType === 'three' && cards.length === 3) {
    const note = el('div', 'wb-note-box');
    note.append(
      el('strong', undefined, '镜像与焦点脉络：'),
      `中心焦点牌「${asString(cards[1]?.position) ?? ''}·${asString(cards[1]?.name) ?? ''}」；首尾镜像「${asString(cards[0]?.name) ?? ''} ↔ ${asString(cards[2]?.name) ?? ''}」。`,
    );
    container.append(note);
  } else if ((spreadType === 'five' || spreadType === 'relationship') && cards.length === 5) {
    const note = el('div', 'wb-note-box');
    note.append(
      el('strong', undefined, '中心与双层镜像：'),
      `中心焦点牌「${asString(cards[2]?.position) ?? ''}·${asString(cards[2]?.name) ?? ''}」；外层镜像「${asString(cards[0]?.name) ?? ''} ↔ ${asString(cards[4]?.name) ?? ''}」；内层镜像「${asString(cards[1]?.name) ?? ''} ↔ ${asString(cards[3]?.name) ?? ''}」。`,
    );
    container.append(note);
  }

  const layoutEvidence = asArray(data.layoutEvidence).map(asString).filter((x): x is string => Boolean(x));
  if (layoutEvidence.length > 0) {
    const sec = el('div', 'lr-section');
    sec.append(el('h4', 'lr-section-title', '牌阵布局路径与宫位线索'));
    const chipWrap = el('div', 'wb-chip-wrap');
    for (const line of layoutEvidence) {
      chipWrap.append(el('span', 'wb-badge wb-badge-neutral', line));
    }
    sec.append(chipWrap);
    container.append(sec);
  }

  const combos = asArray(data.combinations).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  if (combos.length > 0) {
    const fixedCombos = combos.filter((c) => asString(c.source) === '固定组合');
    const adjCombos = combos.filter((c) => asString(c.source) !== '固定组合');
    const ordered = [...fixedCombos, ...adjCombos.slice(0, fixedCombos.length > 0 ? 6 : 8)];

    const sec = el('div', 'lr-section');
    sec.append(
      el(
        'h4',
        'lr-section-title',
        `牌面联动与固定组合（固定 ${fixedCombos.length} 组 · 相邻 ${adjCombos.length} 组）`,
      ),
    );
    const comboList = el('div', 'cb-combo-list');
    for (const combo of ordered) {
      const isFixed = asString(combo.source) === '固定组合';
      const meaning = asString(combo.meaning);
      const conditioned = asString(combo.conditioned);
      if (!meaning && !conditioned) continue;
      const row = el('p', `cb-combo-item${isFixed ? ' is-fixed' : ''}`);
      row.append(
        el(
          'span',
          `wb-badge ${isFixed ? 'wb-badge-accent' : 'wb-badge-neutral'}`,
          isFixed ? '固定组合' : asString(combo.relation) ?? '相邻合读',
        ),
      );
      row.append(
        el(
          'strong',
          'cb-combo-pair',
          ` ${asString(combo.card1) ?? ''} + ${asString(combo.card2) ?? ''}：`,
        ),
      );
      row.append(document.createTextNode(meaning ?? ''));
      if (conditioned) {
        row.append(el('small', 'cb-combo-cond', `（传统条件：${conditioned}）`));
      }
      comboList.append(row);
    }
    if (comboList.childElementCount > 0) {
      sec.append(comboList);
      container.append(sec);
    }
  }
}

function renderLenormand(container: HTMLElement, data: UnknownRecord): boolean {
  const cards = asArray(data.cards).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  if (cards.length === 0) return false;

  const spreadType = asString(data.spreadType) ?? 'single';
  const spreadName = asString(data.spreadName) ?? '雷诺曼牌阵';

  if (spreadType === 'grandTableau' && cards.length === 36) {
    const ok = renderLenormandGrandTableau(container, data, cards);
    appendLenormandSummaries(container, data, cards);
    return ok;
  }

  const draw = asRecord(data.draw);
  const fixedCount = asArray(data.combinations).filter((c) => asString(asRecord(c)?.source) === '固定组合').length;
  container.append(
    createBoardHeader(
      spreadName,
      ['传统雷诺曼 · 36张牌组', `${cards.length}张牌`, formatDrawMethodLabel(asString(draw?.method))].filter(Boolean).join(' · '),
      [
        ...(fixedCount > 0 ? [{ text: `固定组合 ${fixedCount} 组`, tone: 'accent' as const }] : []),
        ...(spreadType === 'nine' ? [{ text: '3×3 九宫格', tone: 'good' as const }] : []),
      ],
    ),
  );

  const grid = el('div', `cb-tarot-spread-table cb-card-grid cb-lenormand-spread-${spreadType}`);

  for (const [idx, card] of cards.entries()) {
    const cardName = asString(card.name) ?? '未知牌';
    const position = asString(card.position) ?? `第 ${idx + 1} 牌位`;
    const cardId = asNumber(card.id);
    const meaning = asString(card.meaning);
    const house = asString(card.house);
    const rowNum = asNumber(card.row);
    const colNum = asNumber(card.column);
    const isHomeHouse = Boolean(house && house === cardName);
    const isCenter = (spreadType === 'nine' && idx === 4) || (spreadType === 'five' && idx === 2) || (spreadType === 'three' && idx === 1);
    const keywords = asArray(card.keywords).map(asString).filter((x): x is string => Boolean(x));

    const item = el(
      'article',
      `cb-tarot-slot-card cb-card cb-lenormand-card${isCenter ? ' is-center-focus' : ''}${isHomeHouse ? ' is-home-house' : ''}`,
    );
    const area = getLenormandSlotArea(spreadType, idx);
    if (area) item.style.gridArea = area;

    const top = el('div', 'cb-slot-pos-badge cb-card-top');
    const leftBadge = el('div', 'cb-slot-pos-left');
    leftBadge.append(el('span', 'cb-slot-index', String(idx + 1)));
    leftBadge.append(el('strong', 'cb-card-pos', position));
    top.append(leftBadge);

    const rightTags = el('div', 'cb-slot-right-tags');
    if (rowNum !== undefined && colNum !== undefined) {
      rightTags.append(el('span', 'cb-card-coord', `${rowNum}-${colNum}`));
    }
    if (cardId !== undefined) {
      rightTags.append(el('span', 'cb-card-num', `#${cardId}`));
    }
    top.append(rightTags);
    item.append(top);

    item.append(
      createLenormandCardFace(
        {
          id: cardId,
          name: cardName,
          position,
          meaning,
          keywords,
          isHomeHouse,
        },
        { size: cards.length === 1 ? 'lg' : cards.length >= 10 ? 'sm' : 'md' },
      ),
    );

    const metaBox = el('div', 'cb-slot-meta');
    const titleRow = el('div', 'cb-card-title-row');
    titleRow.append(
      createTermTrigger(cardName, cardName, 'cb-card-name', {
        title: cardId !== undefined ? `#${cardId} ${cardName}` : cardName,
        category: '雷诺曼牌义',
        subtitle: [position, house ? `落${house}宫` : ''].filter(Boolean).join(' · '),
        summary: meaning,
        keywords,
      }),
    );
    if (isCenter) {
      titleRow.append(el('span', 'wb-badge wb-badge-accent', '中心焦点'));
    } else if (isHomeHouse) {
      titleRow.append(el('span', 'wb-badge wb-badge-good', '归宫'));
    }
    metaBox.append(titleRow);

    if (meaning) {
      metaBox.append(el('p', 'cb-card-meaning', meaning));
    }

    if (keywords.length > 0) {
      const kwWrap = el('div', 'cb-keywords');
      for (const kw of keywords) {
        kwWrap.append(el('span', 'cb-kw-pill', kw));
      }
      metaBox.append(kwWrap);
    }

    item.append(metaBox);
    grid.append(item);
  }
  container.append(grid);
  appendLenormandSummaries(container, data, cards);
  return true;
}

function renderSsgw(container: HTMLElement, data: UnknownRecord): boolean {
  const title = asString(data.title);
  const poem = asString(data.poem);
  if (!title && !poem) return false;

  const details = asRecord(data.details);
  const luck = asString(details?.['吉凶']);
  const core = asString(details?.['核心寓意']) ?? asString(details?.['此签核心']);
  const num = asNumber(data.number);
  const ganzhi = asRecord(data.ganzhi);
  const draw = asRecord(data.draw);

  const subtitle = [
    '三山国王灵签',
    formatDrawMethodLabel(asString(draw?.method), 'ssgw'),
    ganzhi ? `${asString(ganzhi.year) ?? ''} ${asString(ganzhi.month) ?? ''} ${asString(ganzhi.day) ?? ''} ${asString(ganzhi.hour) ?? ''}`.trim() : '',
  ]
    .filter(Boolean)
    .join(' · ');

  container.append(
    createBoardHeader(
      title ?? `三山国王灵签 · 第${num ?? ''}签`,
      subtitle,
      luck ? [{ text: luck, tone: luck.includes('吉') ? 'good' : 'warn' }] : undefined,
    ),
  );

  const signCard = el('article', 'cb-sign-card');
  if (poem) {
    const poemBox = el('div', 'cb-sign-poem');
    for (const line of poem.split('\n')) {
      const trimmed = line.trim();
      if (trimmed) poemBox.append(el('p', 'cb-sign-poem-line', trimmed));
    }
    signCard.append(poemBox);
  }

  const shortPairs: Array<[string, string | undefined]> = [
    ['此签核心', core],
    ['圣意诗诀', asString(details?.['诗意']) ?? asString(details?.['圣意'])],
    ['事业', asString(details?.['事业'])],
    ['财运', asString(details?.['财运']) ?? asString(details?.['求财'])],
    ['感情婚姻', [asString(details?.['感情']), asString(details?.['婚姻'])].filter(Boolean).join(' ') || undefined],
    ['学业健康', [asString(details?.['学业']), asString(details?.['健康'])].filter(Boolean).join(' ') || undefined],
    ['行动建议', asString(details?.['行动建议'])],
    ['风险提醒', asString(details?.['风险提醒'])],
  ];
  const meta = createMetaGrid(shortPairs);
  if (meta) signCard.append(meta);

  const proseBlocks: Array<[string, string | undefined]> = [
    ['古本解曰', asString(details?.['解曰']) ?? asString(details?.['解签总论'])],
    ['仙机指迷', asString(details?.['仙机'])],
    ['典故出处', asString(data.story) ?? asString(details?.['故事'])],
  ];
  for (const [label, body] of proseBlocks) {
    if (!body) continue;
    const box = el('div', 'wb-note-box');
    box.append(el('strong', undefined, `${label}：`), document.createTextNode(body));
    signCard.append(box);
  }
  container.append(signCard);
  return true;
}

function renderZhuge(container: HTMLElement, data: UnknownRecord): boolean {
  const draws = asArray(data.draws).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  if (draws.length > 0 || asString(data.symbol)) {
    const name = asString(data.name);
    const poem = asString(data.poem);
    if (!name && !poem) return false;

    const num = asNumber(data.number);
    const grade = asString(data.grade);
    const interp = asRecord(data.interpretation);

    container.append(
      createBoardHeader(
        `诸葛神数 · 第${num ?? ''}卦 ${name ?? ''}`,
        asString(data.symbol),
        grade
          ? [{ text: grade, tone: grade.includes('吉') || grade.includes('上') ? 'good' : 'neutral' }]
          : undefined,
      ),
    );

    const signCard = el('article', 'cb-sign-card');
    if (draws.length > 0) {
      const coinRow = el('div', 'cb-coin-row');
      for (const d of draws) {
        const polarity = asString(d.polarity) ?? '';
        const isYang = polarity === '阳' || asString(d.symbol) === '●';
        const coin = el('span', `cb-coin ${isYang ? 'is-yang' : 'is-yin'}`);
        const img = document.createElement('img');
        img.className = 'cb-coin-img';
        img.src = isYang
          ? '/divination-assets/ritual/coin-heads.webp'
          : '/divination-assets/ritual/coin-tails.webp';
        img.alt = isYang ? '阳（正面）' : '阴（反面）';
        img.loading = 'lazy';
        img.addEventListener('error', () => {
          coin.textContent = asString(d.symbol) ?? (isYang ? '●' : '○');
        });
        coin.appendChild(img);
        coinRow.append(coin);
      }
      signCard.append(coinRow);
    }
    if (poem) {
      const poemBox = el('div', 'cb-sign-poem');
      poemBox.append(el('p', 'cb-sign-poem-line', poem));
      signCard.append(poemBox);
    }
    const meta = createMetaGrid([
      ['卦辞点睛', asString(interp?.quote)],
      ['象意取喻', asString(interp?.imageMeaning)],
      ['象意解读', asString(interp?.interpretation)],
      ['应验条件', asString(interp?.condition)],
    ]);
    if (meta) signCard.append(meta);
    container.append(signCard);
    return true;
  }

  const sign = asRecord(data.sign);
  const poem = asString(sign?.poem);
  if (!sign && !poem) return false;

  const num = asNumber(data.number);
  const rawNumber = asNumber(data.rawNumber);
  const text = asString(data.text);
  const numbers = asArray(data.numbers).map(asNumber).filter((x): x is number => x !== undefined);
  const interp = asRecord(data.interpretation);
  const subtitleParts = [
    text ? `测字「${text}」` : numbers.length === 3 ? `报数「${numbers.join(' · ')}」` : '',
    rawNumber !== undefined ? `合数 ${rawNumber}` : '',
    asString(data.sourceSummary),
  ].filter(Boolean);

  container.append(
    createBoardHeader(`诸葛神数 · 第${num ?? ''}签`, subtitleParts.join(' · ')),
  );

  const signCard = el('article', 'cb-sign-card');
  const chars = asArray(data.chars).map(asString);
  const strokes = asArray(data.strokes).map(asNumber);
  const digits = asArray(data.digits).map(asNumber);
  if (chars.length > 0) {
    const charRow = el('div', 'cb-zhuge-chars');
    chars.forEach((ch, idx) => {
      if (!ch) return;
      const box = el('div', 'cb-zhuge-char');
      box.append(el('strong', 'cb-zhuge-glyph', ch));
      box.append(el('span', 'cb-zhuge-stroke', `${strokes[idx] ?? '?'}画 → ${digits[idx] ?? '?'}`));
      charRow.append(box);
    });
    signCard.append(charRow);
  } else if (numbers.length === 3) {
    const numRow = el('div', 'cb-zhuge-chars');
    numbers.forEach((n, idx) => {
      const box = el('div', 'cb-zhuge-char');
      box.append(el('strong', 'cb-zhuge-glyph', String(n)));
      box.append(el('span', 'cb-zhuge-stroke', `取个位 → ${digits[idx] ?? n % 10}`));
      numRow.append(box);
    });
    signCard.append(numRow);
  }

  if (poem) {
    const poemBox = el('div', 'cb-sign-poem');
    poemBox.append(el('p', 'cb-sign-poem-line', poem));
    signCard.append(poemBox);
  }
  const meta = createMetaGrid([
    ['签意概要', asString(sign?.summary)],
    ['典籍点睛', asString(interp?.quote)],
    ['象意取喻', asString(interp?.imageMeaning)],
    ['解曰', asString(interp?.interpretation)],
    ['应验条件', asString(interp?.condition)],
  ]);
  if (meta) signCard.append(meta);
  container.append(signCard);
  return true;
}

export function renderCardsBoard(container: HTMLElement, method: string, data: unknown): boolean {
  const rec = asRecord(data);
  if (!rec) return false;
  switch (method) {
    case 'tarot':
      return renderTarot(container, rec);
    case 'lenormand':
      return renderLenormand(container, rec);
    case 'ssgw':
      return renderSsgw(container, rec);
    case 'zhuge':
      return renderZhuge(container, rec);
    default:
      return false;
  }
}
