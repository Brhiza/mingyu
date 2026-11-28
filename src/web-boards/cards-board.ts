import {
  asArray,
  asNumber,
  asRecord,
  asString,
  createBoardDetailBar,
  createBoardHeader,
  createBoardModalTrigger,
  createMetaGrid,
  el,
  svgEl,
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

interface SpatialPose {
  x: number;
  y: number;
  rotation?: number;
  layer?: number;
}

const YEAR_TWELVE_POSES: readonly SpatialPose[] = [
  { x: 50, y: 17 },
  { x: 69, y: 21 },
  { x: 82, y: 33 },
  { x: 87, y: 50 },
  { x: 82, y: 67 },
  { x: 69, y: 79 },
  { x: 50, y: 83 },
  { x: 31, y: 79 },
  { x: 18, y: 67 },
  { x: 13, y: 50 },
  { x: 18, y: 33 },
  { x: 31, y: 21 },
];

const SPATIAL_TAROT_LAYOUTS: Record<string, readonly SpatialPose[]> = {
  single: [{ x: 50, y: 50 }],
  three: [{ x: 18, y: 50 }, { x: 50, y: 50 }, { x: 82, y: 50 }],
  mindBodySpirit: [{ x: 18, y: 50 }, { x: 50, y: 50 }, { x: 82, y: 50 }],
  holyTriangle: [{ x: 50, y: 24 }, { x: 24, y: 72 }, { x: 76, y: 72 }],
  love: [
    { x: 20, y: 50 },
    { x: 80, y: 50 },
    { x: 50, y: 50 },
    { x: 50, y: 80 },
    { x: 50, y: 20 },
  ],
  fourElements: [
    { x: 50, y: 50 },
    { x: 50, y: 17 },
    { x: 50, y: 83 },
    { x: 18, y: 50 },
    { x: 82, y: 50 },
  ],
  decision: [
    { x: 50, y: 78 },
    { x: 26, y: 76 },
    { x: 19, y: 45 },
    { x: 74, y: 76 },
    { x: 81, y: 45 },
    { x: 50, y: 20 },
  ],
  relationship: [
    { x: 20, y: 24 },
    { x: 80, y: 24 },
    { x: 20, y: 70 },
    { x: 80, y: 70 },
    { x: 50, y: 34 },
    { x: 50, y: 76 },
  ],
  career: [
    { x: 20, y: 24 },
    { x: 50, y: 24 },
    { x: 80, y: 24 },
    { x: 34, y: 66 },
    { x: 66, y: 66 },
    { x: 50, y: 80 },
  ],
  universal: [
    { x: 50, y: 20 },
    { x: 22, y: 50 },
    { x: 78, y: 50 },
    { x: 33, y: 80 },
    { x: 67, y: 80 },
  ],
  wealth: [
    { x: 50, y: 20 },
    { x: 22, y: 50 },
    { x: 78, y: 50 },
    { x: 33, y: 80 },
    { x: 67, y: 80 },
  ],
  problemSolving: [
    { x: 50, y: 20 },
    { x: 22, y: 50 },
    { x: 78, y: 50 },
    { x: 33, y: 80 },
    { x: 67, y: 80 },
  ],
  chakra: [
    { x: 14, y: 28 },
    { x: 38, y: 28 },
    { x: 62, y: 28 },
    { x: 86, y: 28 },
    { x: 22, y: 74 },
    { x: 50, y: 74 },
    { x: 78, y: 74 },
  ],
  horseshoe: [
    { x: 10, y: 76 },
    { x: 21, y: 48 },
    { x: 35, y: 26 },
    { x: 50, y: 18 },
    { x: 65, y: 26 },
    { x: 79, y: 48 },
    { x: 90, y: 76 },
  ],
  celtic: [
    { x: 38, y: 50, layer: 2 },
    { x: 38, y: 50, rotation: 90, layer: 3 },
    { x: 38, y: 18 },
    { x: 38, y: 82 },
    { x: 17, y: 50 },
    { x: 59, y: 50 },
    { x: 84, y: 82 },
    { x: 84, y: 61 },
    { x: 84, y: 39 },
    { x: 84, y: 18 },
  ],
  hexagram: [
    { x: 50, y: 15 },
    { x: 78, y: 34 },
    { x: 78, y: 66 },
    { x: 50, y: 85 },
    { x: 22, y: 66 },
    { x: 22, y: 34 },
    { x: 50, y: 50 },
  ],
  year: YEAR_TWELVE_POSES,
  twelveHouses: YEAR_TWELVE_POSES,
};

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

  // 四元素与大阿卡纳分布条（多牌阵展示）+ 牌桌视图/卡片明细切换
  const toolbar = el('div', 'cb-tarot-view-toolbar');
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
    if (bar.childElementCount > 0) toolbar.append(bar);
  }

  const viewPills = el('div', 'cb-tarot-view-pills');
  const btnSpatial = el('button', 'cb-tarot-view-btn is-active', '牌桌视图');
  btnSpatial.type = 'button';
  btnSpatial.setAttribute('aria-pressed', 'true');
  const btnGrid = el('button', 'cb-tarot-view-btn', '卡片明细');
  btnGrid.type = 'button';
  btnGrid.setAttribute('aria-pressed', 'false');
  viewPills.append(btnSpatial, btnGrid);
  toolbar.append(viewPills);
  container.append(toolbar);

  const detailTriggers: HTMLElement[] = [];

  // 空间牌桌视图
  const spatialPoses = SPATIAL_TAROT_LAYOUTS[spreadType];
  const densityClass =
    cards.length <= 3 ? 'is-small-spread' : cards.length <= 6 ? 'is-medium-spread' : 'is-dense';
  const spatialWrap = el('div', `cb-tarot-spatial-wrap spread-${spreadType}`);
  const spatialBoard = el(
    'div',
    `cb-tarot-spatial-board spread-${spreadType} ${densityClass} is-dealing`,
  );
  spatialBoard.setAttribute('aria-label', `${spreadName}空间牌阵`);

  for (const [idx, card] of cards.entries()) {
    const reversed = card.reversed === true;
    const cardName = asString(card.name) ?? '未知牌';
    const position = asString(card.position) ?? `第 ${idx + 1} 牌位`;
    const element = asString(card.element);
    const keywords = asArray(card.keywords).map(asString).filter((x): x is string => Boolean(x));
    const pose = spatialPoses?.[idx] ?? {
      x: 50,
      y: 50,
    };

    const slot = el(
      'button',
      `cb-spatial-card${reversed ? ' is-reversed' : ''}${spreadType === 'celtic' && idx === 1 ? ' is-crossing' : ''}`,
    );
    slot.type = 'button';
    slot.setAttribute('aria-label', `${position}，${cardName}，${reversed ? '逆位' : '正位'}`);
    slot.style.setProperty('--spread-x', `${pose.x}%`);
    slot.style.setProperty('--spread-y', `${pose.y}%`);
    slot.style.setProperty('--spread-rotation', `${pose.rotation ?? 0}deg`);
    slot.style.setProperty('--deal-index', String(idx));
    if (pose.layer !== undefined) slot.style.zIndex = String(pose.layer);

    const posTag = el('span', 'cb-spatial-pos');
    posTag.append(el('i', '', String(idx + 1)), document.createTextNode(position));
    slot.append(posTag);

    const faceWrap = el('div', 'cb-spatial-face-frame');
    faceWrap.append(
      createTarotCardFace(
        {
          id: asNumber(card.id),
          name: cardName,
          reversed,
          position,
          element,
          keywords,
        },
        { size: cards.length <= 3 ? 'md' : 'sm' },
      ),
    );
    slot.append(faceWrap);

    const nameLine = el('strong', 'cb-spatial-name', cardName);
    const oriBadge = el(
      'span',
      `cb-spatial-ori ${reversed ? 'is-reversed' : 'is-upright'}`,
      reversed ? '逆位' : '正位',
    );
    slot.append(nameLine, oriBadge);

    slot.addEventListener('click', () => {
      detailTriggers[idx]?.click();
    });
    spatialBoard.append(slot);
  }
  spatialWrap.append(spatialBoard);

  if (cards.length >= 7) {
    const legend = el('div', 'cb-spatial-legend');
    for (const [idx, card] of cards.entries()) {
      const reversed = card.reversed === true;
      const cardName = asString(card.name) ?? '未知牌';
      const position = asString(card.position) ?? `第 ${idx + 1} 牌位`;
      const pill = el('button', 'cb-spatial-legend-item');
      pill.type = 'button';
      pill.append(
        el('span', 'cb-slot-index', String(idx + 1)),
        el('span', 'cb-spatial-legend-pos', position),
        el('strong', 'cb-spatial-legend-name', cardName),
        el('span', `wb-badge ${reversed ? 'wb-badge-warn' : 'wb-badge-good'}`, reversed ? '逆位' : '正位'),
      );
      pill.addEventListener('click', () => {
        detailTriggers[idx]?.click();
      });
      legend.append(pill);
    }
    spatialWrap.append(legend);
  }
  container.append(spatialWrap);

  const grid = el(
    'div',
    `cb-tarot-spread-table cb-card-grid cb-spread-${spreadType} cb-count-${cards.length}`,
  );
  grid.dataset.spread = spreadType;
  grid.hidden = true;

  btnSpatial.addEventListener('click', () => {
    spatialWrap.hidden = false;
    grid.hidden = true;
    btnSpatial.classList.add('is-active');
    btnSpatial.setAttribute('aria-pressed', 'true');
    btnGrid.classList.remove('is-active');
    btnGrid.setAttribute('aria-pressed', 'false');
  });
  btnGrid.addEventListener('click', () => {
    spatialWrap.hidden = true;
    grid.hidden = false;
    btnGrid.classList.add('is-active');
    btnGrid.setAttribute('aria-pressed', 'true');
    btnSpatial.classList.remove('is-active');
    btnSpatial.setAttribute('aria-pressed', 'false');
  });

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
    const triggerEl = createTermTrigger(cardName, cardName, 'cb-card-name', {
      title: `${cardName}（${reversed ? '逆位' : '正位'}）`,
      category: '塔罗牌义',
      subtitle: [position, element, archetype].filter(Boolean).join(' · ') || undefined,
      summary: keywords.length > 0 ? `核心关键词：${keywords.join('、')}` : archetype,
      detail: element ? `牌组属性：${element}${archetype ? `；牌阶：${archetype}` : ''}` : archetype,
      keywords,
    });
    detailTriggers.push(triggerEl);
    titleRow.append(triggerEl);
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

  // 读取真实 evidenceAnalysis 结构（相邻元素互动 / 重复主题 / 逆位提示）并收拢至弹窗
  const ev = asRecord(data.evidenceAnalysis);
  const adjacent = asArray(ev?.adjacent).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  const recurring = asArray(ev?.recurringThemes).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  const reversalNotes = asArray(ev?.reversalConstraints).map(asString).filter((x): x is string => Boolean(x));

  const extraPairs: Array<[string, string | undefined]> = [
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
            .map(
              (a) =>
                `${asString(a.first) ?? ''}→${asString(a.second) ?? ''}：${asString(a.relation) ?? ''}`,
            )
            .join('；')
        : undefined,
    ],
    [
      '逆位留意要点',
      reversalNotes.length > 0 ? reversalNotes.join(' ') : undefined,
    ],
  ];
  const validCount = extraPairs.filter((p) => Boolean(p[1])).length;
  if (validCount > 0) {
    const tarotBar = createBoardDetailBar([
      createBoardModalTrigger(
        '牌阵呼应与逆位线索',
        '塔罗牌阵元素呼应与逆位要点',
        () => createMetaGrid(extraPairs) ?? el('div'),
      ),
    ]);
    if (tarotBar) container.append(tarotBar);
  }

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
  const combos = asArray(data.combinations).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  if (layoutEvidence.length > 0 || combos.length > 0) {
    const fixedCombos = combos.filter((c) => asString(c.source) === '固定组合');
    const adjCombos = combos.filter((c) => asString(c.source) !== '固定组合');
    const ordered = [...fixedCombos, ...adjCombos];

    const lmBar = createBoardDetailBar([
      createBoardModalTrigger(
        '布局线索与组合详析',
        '雷诺曼牌阵布局路径与牌面组合详析',
        () => {
          const frag = document.createDocumentFragment();
          if (layoutEvidence.length > 0) {
            const sec = el('div', 'lr-section');
            sec.append(el('h4', 'lr-section-title', '牌阵布局路径与宫位线索'));
            const chipWrap = el('div', 'wb-chip-wrap');
            for (const line of layoutEvidence) {
              chipWrap.append(el('span', 'wb-badge wb-badge-neutral', line));
            }
            sec.append(chipWrap);
            frag.append(sec);
          }
          if (ordered.length > 0) {
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
              frag.append(sec);
            }
          }
          return frag;
        },
        combos.length > 0 ? `${combos.length}组` : undefined,
      ),
    ]);
    if (lmBar) container.append(lmBar);
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
      [`${cards.length}张牌`, formatDrawMethodLabel(asString(draw?.method))].filter(Boolean).join(' · '),
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

const SSGW_CN_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'] as const;

function formatSsgwChineseLot(num?: number): string | undefined {
  if (num === undefined || !Number.isInteger(num) || num < 1 || num > 99) return undefined;
  if (num < 10) return `第${SSGW_CN_DIGITS[num]}签`;
  const tens = Math.floor(num / 10);
  const ones = num % 10;
  return `第${tens === 1 ? '十' : `${SSGW_CN_DIGITS[tens]}十`}${ones === 0 ? '' : SSGW_CN_DIGITS[ones]}签`;
}

function parseSsgwTitle(
  rawTitle?: string,
  num?: number,
): { lotNo: string; poeticTitle: string; shortLuck?: string } {
  const fallbackLot = formatSsgwChineseLot(num) ?? (num !== undefined ? `第${num}签` : '灵签');
  if (!rawTitle) {
    return { lotNo: fallbackLot, poeticTitle: '三山国王灵签' };
  }
  const match = rawTitle.match(/^(第[^·\s]+签)\s*·\s*(.+?)(?:[（(]([^）)]+)[）)])?$/u);
  if (match) {
    return {
      lotNo: match[1]!.trim(),
      poeticTitle: match[2]!.trim().replace(/[，,]/gu, ' · '),
      shortLuck: match[3]?.trim(),
    };
  }
  return { lotNo: fallbackLot, poeticTitle: rawTitle.trim() };
}

function resolveSsgwSeal(
  luck?: string,
  shortLuck?: string,
): { tone: 'great' | 'mid' | 'low' | 'peace'; top: string; bottom: string } {
  const text = `${luck ?? ''} ${shortLuck ?? ''}`;
  if (text.includes('上签') || text.includes('大吉')) {
    return { tone: 'great', top: '上签', bottom: '大吉' };
  }
  if (text.includes('无事') || text.includes('平安')) {
    return { tone: 'peace', top: '无事', bottom: '平安' };
  }
  if (text.includes('下签') || text.includes('凶')) {
    return { tone: 'low', top: '下签', bottom: '慎行' };
  }
  return { tone: 'mid', top: '中签', bottom: shortLuck || '中平' };
}

function splitSsgwPoemClauses(poem: string): string[] {
  return poem
    .split(/[\n，。！？；]+/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseSsgwOverview(raw: string): {
  summary: string;
  verses: Array<{ line: string; gloss: string }>;
} {
  const chunks = raw
    .split(/\s+-\s+/u)
    .map((part) => part.trim())
    .filter(Boolean);
  const summary = chunks[0] ?? '';
  const verses: Array<{ line: string; gloss: string }> = [];
  for (const item of chunks.slice(1)) {
    const parts = item.split(/\s*——\s*/u);
    if (parts.length >= 2) {
      verses.push({ line: parts[0]!.trim(), gloss: parts.slice(1).join('——').trim() });
    } else {
      verses.push({ line: item, gloss: '' });
    }
  }
  return { summary, verses };
}

function createSsgwEmblemSvg(): SVGSVGElement {
  const svg = svgEl('svg', {
    class: 'ssgw-slip-emblem',
    viewBox: '0 0 36 24',
    fill: 'none',
    'aria-hidden': 'true',
  });
  svg.append(
    svgEl('path', {
      d: 'M3 20.5L10.5 9.5L15 16L18 4.5L21 16L25.5 9.5L33 20.5',
      stroke: 'currentColor',
      'stroke-width': '1.65',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }),
    svgEl('path', {
      d: 'M1.5 21.5H34.5',
      stroke: 'currentColor',
      'stroke-width': '1.2',
      'stroke-linecap': 'round',
      opacity: '0.55',
    }),
    svgEl('circle', {
      cx: 18,
      cy: 2.6,
      r: 1.2,
      fill: 'currentColor',
      opacity: '0.85',
    }),
  );
  return svg;
}

function createSsgwCornerSvg(pos: 'tl' | 'tr' | 'bl' | 'br'): SVGSVGElement {
  const svg = svgEl('svg', {
    class: `ssgw-slip-corner is-${pos}`,
    viewBox: '0 0 22 22',
    fill: 'none',
    'aria-hidden': 'true',
  });
  svg.append(
    svgEl('path', {
      d: 'M2 20V5C2 3.343 3.343 2 5 2H20M6 16V7.5C6 6.672 6.672 6 7.5 6H16M6 10.5H10.5V6',
      stroke: 'currentColor',
      'stroke-width': '1.25',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }),
  );
  return svg;
}

function renderSsgw(container: HTMLElement, data: UnknownRecord): boolean {
  const rawTitle = asString(data.title);
  const poem = asString(data.poem);
  if (!rawTitle && !poem) return false;

  const details = asRecord(data.details);
  const luck = asString(details?.['吉凶']);
  const core = asString(details?.['此签核心']) ?? asString(details?.['核心寓意']);
  const num = asNumber(data.number);
  const ganzhi = asRecord(data.ganzhi);
  const draw = asRecord(data.draw);

  const parsed = parseSsgwTitle(rawTitle, num);
  const seal = resolveSsgwSeal(luck, parsed.shortLuck);
  const drawMethodText = formatDrawMethodLabel(asString(draw?.method), 'ssgw');
  const ganzhiText = ganzhi
    ? [
        asString(ganzhi.year),
        asString(ganzhi.month),
        asString(ganzhi.day),
        asString(ganzhi.hour),
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  const signCard = el('article', 'cb-sign-card ssgw-slip-board');
  const slipPaper = el('section', `ssgw-slip-paper is-tone-${seal.tone}`);
  slipPaper.append(
    createSsgwCornerSvg('tl'),
    createSsgwCornerSvg('tr'),
    createSsgwCornerSvg('bl'),
    createSsgwCornerSvg('br'),
  );

  const plaque = el('header', 'ssgw-slip-plaque');
  const plaqueBrand = el('div', 'ssgw-slip-brand');
  plaqueBrand.append(createSsgwEmblemSvg());
  const brandMeta = el('div', 'ssgw-slip-brand-meta');
  brandMeta.append(el('span', 'ssgw-slip-temple', '三山国王灵签'));
  if (luck) {
    brandMeta.append(el('small', 'ssgw-slip-luck-label', luck));
  }
  plaqueBrand.append(brandMeta);
  plaque.append(plaqueBrand);

  const sealNode = el('div', `ssgw-grade-seal is-tone-${seal.tone}`);
  sealNode.setAttribute('aria-label', luck ?? `${seal.top}${seal.bottom}`);
  sealNode.append(el('span', undefined, seal.top), el('span', undefined, seal.bottom));
  plaque.append(sealNode);
  slipPaper.append(plaque);

  const slipBody = el('div', 'ssgw-slip-body');

  const slipScroll = el('div', 'ssgw-slip-scroll');
  const heading = el('div', 'ssgw-slip-heading');
  heading.append(el('span', 'ssgw-slip-lot-badge', parsed.lotNo));
  heading.append(el('h3', 'ssgw-slip-poetic-title', parsed.poeticTitle));
  slipScroll.append(heading);

  if (poem) {
    const clauses = splitSsgwPoemClauses(poem);
    if (clauses.length === 4) {
      const poemGrid = el('div', 'ssgw-poem-vertical');
      poemGrid.setAttribute('aria-label', '木刻灵签签诗');
      for (const clause of clauses) {
        poemGrid.append(el('p', 'ssgw-poem-col', clause));
      }
      slipScroll.append(poemGrid);
    } else {
      const poemBox = el('div', 'cb-sign-poem ssgw-poem-horizontal');
      for (const line of poem.split('\n')) {
        const trimmed = line.trim();
        if (trimmed) poemBox.append(el('p', 'cb-sign-poem-line', trimmed));
      }
      slipScroll.append(poemBox);
    }
  }

  slipBody.append(slipScroll);
  slipPaper.append(slipBody);

  if (ganzhiText || drawMethodText) {
    const colophon = el('footer', 'ssgw-slip-colophon');
    if (ganzhiText) {
      colophon.append(el('span', 'ssgw-colophon-ganzhi', ganzhiText));
    }
    if (drawMethodText) {
      colophon.append(el('span', 'ssgw-colophon-method', drawMethodText));
    }
    slipPaper.append(colophon);
  }

  signCard.append(slipPaper);

  if (core) {
    const coreStrip = el('div', 'ssgw-core-strip');
    coreStrip.append(el('span', 'ssgw-core-tag', '签眼'));
    coreStrip.append(el('p', 'ssgw-core-text', core));
    signCard.append(coreStrip);
  }

  const careerVal = asString(details?.['事业']);
  const wealthVal = asString(details?.['财运']) ?? asString(details?.['求财']);
  const loveVal =
    [asString(details?.['感情']), asString(details?.['婚姻'])]
      .filter((item, idx, arr) => Boolean(item) && arr.indexOf(item) === idx)
      .join(' ') || undefined;
  const studyVal = asString(details?.['学业']);
  const healthVal = asString(details?.['健康']);

  const ledgerRows: Array<[string, string | undefined]> = [
    ['事业', careerVal],
    ['财运', wealthVal],
    ['感情', loveVal],
    ['学业', studyVal],
    ['健康', healthVal],
  ].filter((item): item is [string, string] => Boolean(item[1]));

  if (ledgerRows.length > 0) {
    const ledger = el('div', 'ssgw-ledger');
    for (const [label, text] of ledgerRows) {
      const row = el('div', 'ssgw-ledger-row');
      row.append(el('span', 'ssgw-ledger-key', label));
      row.append(el('p', 'ssgw-ledger-val', text));
      ledger.append(row);
    }
    signCard.append(ledger);
  }

  const adviceVal = asString(details?.['行动建议']);
  const riskVal = asString(details?.['风险提醒']);
  if (adviceVal || riskVal) {
    const yijiRow = el('div', 'ssgw-yiji-row');
    if (adviceVal) {
      const yiItem = el('div', 'ssgw-yiji-item is-yi');
      yiItem.append(el('span', 'ssgw-yiji-badge', '宜'));
      yiItem.append(el('p', 'ssgw-yiji-text', adviceVal));
      yijiRow.append(yiItem);
    }
    if (riskVal) {
      const jiItem = el('div', 'ssgw-yiji-item is-ji');
      jiItem.append(el('span', 'ssgw-yiji-badge', '忌'));
      jiItem.append(el('p', 'ssgw-yiji-text', riskVal));
      yijiRow.append(jiItem);
    }
    signCard.append(yijiRow);
  }

  container.append(signCard);

  const overviewRaw = asString(details?.['解签总论']) ?? asString(details?.['解曰']);
  const xianjiRaw = asString(details?.['仙机']);
  const reminderRaw = asString(details?.['提醒']);
  const storyRaw = asString(data.story) ?? asString(details?.['故事']);
  const poetryRaw = asString(details?.['诗意']) ?? asString(details?.['圣意']);

  const modalCount = [overviewRaw, poetryRaw, xianjiRaw, reminderRaw, storyRaw].filter(Boolean).length;
  if (modalCount > 0) {
    const ssgwBar = createBoardDetailBar([
      createBoardModalTrigger(
        '古本解曰与典故出处',
        `${parsed.lotNo} · ${parsed.poeticTitle}`,
        () => {
          const frag = document.createDocumentFragment();
          if (overviewRaw) {
            const { summary, verses } = parseSsgwOverview(overviewRaw);
            if (summary) {
              const box = el('div', 'wb-note-box');
              box.append(el('strong', undefined, '解签总论：'), document.createTextNode(summary));
              frag.append(box);
            }
            if (verses.length > 0) {
              const verseList = el('div', 'ssgw-modal-verse-list');
              for (const v of verses) {
                const row = el('div', 'ssgw-modal-verse-item');
                row.append(el('strong', 'ssgw-modal-verse-line', v.line));
                if (v.gloss) {
                  row.append(el('p', 'ssgw-modal-verse-gloss', v.gloss));
                }
                verseList.append(row);
              }
              frag.append(verseList);
            }
          }
          if (poetryRaw) {
            const box = el('div', 'wb-note-box');
            box.append(el('strong', undefined, '圣意诗诀：'), document.createTextNode(poetryRaw));
            frag.append(box);
          }
          if (xianjiRaw) {
            const box = el('div', 'wb-note-box');
            box.append(el('strong', undefined, '仙机指迷：'), document.createTextNode(xianjiRaw));
            frag.append(box);
          }
          if (reminderRaw) {
            const box = el('div', 'wb-note-box');
            box.append(el('strong', undefined, '签语提醒：'), document.createTextNode(reminderRaw));
            frag.append(box);
          }
          if (storyRaw) {
            const box = el('div', 'wb-note-box');
            box.append(el('strong', undefined, '典故出处：'), document.createTextNode(storyRaw));
            frag.append(box);
          }
          return frag;
        },
        `${modalCount}项`,
      ),
    ]);
    if (ssgwBar) container.append(ssgwBar);
  }
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
    const symbolText = asString(data.symbol);
    const interp = asRecord(data.interpretation);
    const sealTone = grade && (grade.includes('吉') || grade.includes('上')) ? 'great' : 'mid';

    const signCard = el('article', 'cb-sign-card ssgw-slip-board');
    const slipPaper = el('section', `ssgw-slip-paper is-tone-${sealTone}`);
    slipPaper.append(
      createSsgwCornerSvg('tl'),
      createSsgwCornerSvg('tr'),
      createSsgwCornerSvg('bl'),
      createSsgwCornerSvg('br'),
    );

    const plaque = el('header', 'ssgw-slip-plaque');
    const plaqueBrand = el('div', 'ssgw-slip-brand');
    const brandMeta = el('div', 'ssgw-slip-brand-meta');
    brandMeta.append(el('span', 'ssgw-slip-temple', '诸葛神数'));
    if (symbolText) {
      brandMeta.append(el('small', 'ssgw-slip-luck-label', symbolText));
    }
    plaqueBrand.append(brandMeta);
    plaque.append(plaqueBrand);

    const sealNode = el('div', `ssgw-grade-seal is-tone-${sealTone}`);
    sealNode.setAttribute('aria-label', grade ?? '三十二课');
    if (grade && [...grade].length >= 2) {
      const chars = [...grade];
      sealNode.append(el('span', undefined, chars.slice(0, 2).join('')), el('span', undefined, chars.slice(2).join('') || '神课'));
    } else {
      sealNode.append(el('span', undefined, grade || '神课'), el('span', undefined, '武侯'));
    }
    plaque.append(sealNode);
    slipPaper.append(plaque);

    const slipBody = el('div', 'ssgw-slip-body');
    const slipScroll = el('div', 'ssgw-slip-scroll');
    const heading = el('div', 'ssgw-slip-heading');
    heading.append(el('span', 'ssgw-slip-lot-badge', `第${num ?? ''}卦`));
    if (name) {
      heading.append(el('h3', 'ssgw-slip-poetic-title', name));
    }
    slipScroll.append(heading);

    if (draws.length > 0) {
      const coinRow = el('div', 'zg-slip-coins');
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
      slipScroll.append(coinRow);
    }

    if (poem) {
      const poemBox = el('div', 'cb-sign-poem zg-slip-poem');
      poemBox.append(el('p', 'cb-sign-poem-line', poem));
      slipScroll.append(poemBox);
    }
    slipBody.append(slipScroll);
    slipPaper.append(slipBody);
    signCard.append(slipPaper);

    const quote = asString(interp?.quote);
    if (quote) {
      const coreStrip = el('div', 'ssgw-core-strip');
      coreStrip.append(el('span', 'ssgw-core-tag', '卦辞'));
      coreStrip.append(el('p', 'ssgw-core-text', quote));
      signCard.append(coreStrip);
    }
    container.append(signCard);

    const extraPairs: Array<[string, string | undefined]> = [
      ['象意取喻', asString(interp?.imageMeaning)],
      ['象意解读', asString(interp?.interpretation)],
      ['应验条件', asString(interp?.condition)],
    ];
    if (extraPairs.some((p) => Boolean(p[1]))) {
      const zgBar = createBoardDetailBar([
        createBoardModalTrigger(
          '象意详析与应验条件',
          '诸葛神数象意详析与应验条件',
          () => createMetaGrid(extraPairs) ?? el('div'),
        ),
      ]);
      if (zgBar) container.append(zgBar);
    }
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

  const signCard = el('article', 'cb-sign-card ssgw-slip-board');
  const slipPaper = el('section', 'ssgw-slip-paper is-tone-mid');
  slipPaper.append(
    createSsgwCornerSvg('tl'),
    createSsgwCornerSvg('tr'),
    createSsgwCornerSvg('bl'),
    createSsgwCornerSvg('br'),
  );

  const plaque = el('header', 'ssgw-slip-plaque');
  const plaqueBrand = el('div', 'ssgw-slip-brand');
  const brandMeta = el('div', 'ssgw-slip-brand-meta');
  brandMeta.append(el('span', 'ssgw-slip-temple', '诸葛神数'));
  if (subtitleParts.length > 0) {
    brandMeta.append(el('small', 'ssgw-slip-luck-label', subtitleParts.join(' · ')));
  }
  plaqueBrand.append(brandMeta);
  plaque.append(plaqueBrand);

  const sealNode = el('div', 'ssgw-grade-seal is-tone-mid');
  sealNode.setAttribute('aria-label', '三百八十四签');
  sealNode.append(el('span', undefined, '神数'), el('span', undefined, '灵签'));
  plaque.append(sealNode);
  slipPaper.append(plaque);

  const slipBody = el('div', 'ssgw-slip-body');
  const slipScroll = el('div', 'ssgw-slip-scroll');
  const heading = el('div', 'ssgw-slip-heading');
  heading.append(el('span', 'ssgw-slip-lot-badge', `第${num ?? ''}签`));
  slipScroll.append(heading);

  const chars = asArray(data.chars).map(asString);
  const strokes = asArray(data.strokes).map(asNumber);
  const digits = asArray(data.digits).map(asNumber);
  if (chars.length > 0) {
    const charRow = el('div', 'zg-slip-tiles');
    chars.forEach((ch, idx) => {
      if (!ch) return;
      const box = el('div', 'zg-slip-tile');
      box.append(el('strong', 'zg-slip-glyph', ch));
      box.append(el('span', 'zg-slip-sub', `${strokes[idx] ?? '?'}画 → ${digits[idx] ?? '?'}`));
      charRow.append(box);
    });
    slipScroll.append(charRow);
  } else if (numbers.length === 3) {
    const numRow = el('div', 'zg-slip-tiles');
    numbers.forEach((n, idx) => {
      const box = el('div', 'zg-slip-tile');
      box.append(el('strong', 'zg-slip-glyph', String(n)));
      box.append(el('span', 'zg-slip-sub', `个位 → ${digits[idx] ?? n % 10}`));
      numRow.append(box);
    });
    slipScroll.append(numRow);
  }

  if (poem) {
    const poemBox = el('div', 'cb-sign-poem zg-slip-poem');
    for (const line of poem.split('\n')) {
      const trimmed = line.trim();
      if (trimmed) poemBox.append(el('p', 'cb-sign-poem-line', trimmed));
    }
    slipScroll.append(poemBox);
  }

  slipBody.append(slipScroll);
  slipPaper.append(slipBody);
  signCard.append(slipPaper);

  const summary = asString(sign?.summary);
  if (summary) {
    const coreStrip = el('div', 'ssgw-core-strip');
    coreStrip.append(el('span', 'ssgw-core-tag', '签意'));
    coreStrip.append(el('p', 'ssgw-core-text', summary));
    signCard.append(coreStrip);
  }
  container.append(signCard);

  const extraPairs: Array<[string, string | undefined]> = [
    ['典籍点睛', asString(interp?.quote)],
    ['象意取喻', asString(interp?.imageMeaning)],
    ['解曰', asString(interp?.interpretation)],
    ['应验条件', asString(interp?.condition)],
  ];
  if (extraPairs.some((p) => Boolean(p[1]))) {
    const zgBar = createBoardDetailBar([
      createBoardModalTrigger(
        '象意详析与应验条件',
        '诸葛神数象意详析与应验条件',
        () => createMetaGrid(extraPairs) ?? el('div'),
      ),
    ]);
    if (zgBar) container.append(zgBar);
  }
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
