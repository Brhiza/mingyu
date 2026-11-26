import { el, svgEl, unwrapBoardData } from './shared';

interface AstrolabePoint {
  id: string;
  name: string;
  longitude: number;
  sign: string;
  signIndex?: number;
  degreeInSign: number;
  retrograde?: boolean;
  dignities?: string[];
  dignity?: string[];
  house: number;
}

interface AstrolabeHouse {
  house: number;
  longitude: number;
  sign: string;
  degreeInSign: number;
}

interface AstrolabeAngle {
  id: string;
  name: string;
  longitude: number;
  sign: string;
  degreeInSign: number;
  house?: number;
}

interface AstrolabeAspect {
  first: string;
  second: string;
  type: string;
  name: string;
  deviation?: number;
  strength?: number;
  applying?: boolean;
}

interface AstrolabePayload {
  basis?: {
    utcDateTime?: string;
    houseSystem?: string;
    dayChart?: boolean;
  };
  points: AstrolabePoint[];
  derived?: AstrolabePoint[];
  angles?: AstrolabeAngle[];
  houses: AstrolabeHouse[];
  aspects?: AstrolabeAspect[];
}

const ZODIAC_SIGNS = [
  { name: '白羊', symbol: '♈', element: 'fire' },
  { name: '金牛', symbol: '♉', element: 'earth' },
  { name: '双子', symbol: '♊', element: 'air' },
  { name: '巨蟹', symbol: '♋', element: 'water' },
  { name: '狮子', symbol: '♌', element: 'fire' },
  { name: '处女', symbol: '♍', element: 'earth' },
  { name: '天秤', symbol: '♎', element: 'air' },
  { name: '天蝎', symbol: '♏', element: 'water' },
  { name: '射手', symbol: '♐', element: 'fire' },
  { name: '摩羯', symbol: '♑', element: 'earth' },
  { name: '水瓶', symbol: '♒', element: 'air' },
  { name: '双鱼', symbol: '♓', element: 'water' },
] as const;

const ROMAN_HOUSES = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'] as const;

const PLANET_GLYPHS: Record<string, string> = {
  sun: '☉',
  moon: '☽',
  mercury: '☿',
  venus: '♀',
  mars: '♂',
  jupiter: '♃',
  saturn: '♄',
  uranus: '♅',
  neptune: '♆',
  pluto: '♇',
  chiron: '⚷',
  true_node: '☊',
  mean_node: '☊',
  south_node: '☋',
  fortune: '⊗',
  ceres: '⚳',
  pallas: '⚴',
  juno: '⚵',
  vesta: '⚶',
};

const HOUSE_SYSTEM_NAMES: Record<string, string> = {
  placidus: '普拉西德制',
  whole_sign: '整宫制',
  equal: '等宫制',
  koch: '科赫制',
  porphyry: '波菲利制',
  regiomontanus: '雷吉奥蒙塔努斯制',
  campanus: '坎帕努斯制',
  alcabitius: '阿尔卡比特制',
  morinus: '莫里努斯制',
  meridian: '子午线制',
  polich_page: '波利希-佩奇制',
  vehlow: '维洛制',
};

const TENSE_ASPECTS = new Set(['square', 'opposition', 'semi-square', 'sesquiquadrate']);
const HARMONIOUS_ASPECTS = new Set(['trine', 'sextile']);

function extractAstrolabePayload(value: unknown): AstrolabePayload | undefined {
  const data = unwrapBoardData(value);
  if (!data) return undefined;
  if (!Array.isArray(data.points) || !Array.isArray(data.houses)) return undefined;
  return data as unknown as AstrolabePayload;
}

/**
 * 传统西洋星盘坐标系：上升点 (ASC / 1宫头) 锚定左侧 9 点钟 (180°)，黄道与宫位逆时针排布
 */
function toWheelPoint(longitude: number, ascLongitude: number, radius: number, cx = 210, cy = 210) {
  const screenDeg = 180 - (longitude - ascLongitude);
  const rad = (screenDeg * Math.PI) / 180;
  return {
    x: cx + Math.cos(rad) * radius,
    y: cy + Math.sin(rad) * radius,
  };
}

function angularDiff(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function midpointLongitude(a: number, b: number): number {
  const span = (b - a + 360) % 360;
  return (a + span / 2) % 360;
}

export function renderAstrolabeBoard(container: HTMLElement, value: unknown): boolean {
  const data = extractAstrolabePayload(value);
  if (!data) {
    container.hidden = true;
    container.replaceChildren();
    return false;
  }

  const fortune = data.derived?.find((item) => item.id === 'fortune');
  const southNode = data.derived?.find((item) => item.id === 'south_node');
  const visiblePoints: AstrolabePoint[] = [
    ...data.points.filter((p) => p.id !== 'true_lilith'),
    ...(southNode ? [southNode] : []),
    ...(fortune ? [fortune] : []),
  ];
  const pointById = new Map<string, AstrolabePoint>(visiblePoints.map((p) => [p.id, p]));

  const sortedHouses = [...data.houses].sort((a, b) => a.house - b.house);
  const ascAngle = data.angles?.find((a) => a.id === 'ascendant' || a.name.includes('上升'));
  const mcAngle = data.angles?.find((a) => a.id === 'mc' || a.name.includes('中天'));
  const ascLongitude = ascAngle?.longitude ?? sortedHouses[0]?.longitude ?? 0;

  const shell = el('section', { className: 'board-card astrolabe-board-shell', ariaLabel: '西洋星盘图' });

  // 顶部栏
  const head = el('div', { className: 'board-head' });
  const titleGroup = el('div', { className: 'board-title-group' });
  titleGroup.append(el('h3', { className: 'board-title', text: '西洋占星星盘' }));
  if (data.basis?.houseSystem) {
    const houseLabel = HOUSE_SYSTEM_NAMES[data.basis.houseSystem] ?? data.basis.houseSystem;
    titleGroup.append(el('span', { className: 'board-chip', text: houseLabel }));
  }
  if (data.basis?.dayChart !== undefined) {
    titleGroup.append(
      el('span', { className: 'board-chip is-accent', text: data.basis.dayChart ? '日生盘' : '夜生盘' }),
    );
  }
  head.append(titleGroup);
  if (data.basis?.utcDateTime) {
    head.append(el('span', { className: 'board-subtitle', text: data.basis.utcDateTime.replace('T', ' ').replace('.000Z', ' 世界时') }));
  }
  shell.append(head);

  const layout = el('div', { className: 'astrolabe-layout' });

  // 420x420 传统西洋星盘 SVG（ASC在左9点钟，逆时针黄道）
  const CX = 210;
  const CY = 210;
  const R_OUTER = 186;
  const R_ZODIAC_IN = 152;
  const R_HOUSE_NUM = 140;
  const R_CORE = 80;

  const svg = svgEl('svg', {
    class: 'astrolabe-svg',
    viewBox: '0 0 420 420',
    role: 'img',
    'aria-label': fortune ? `西洋星盘图，福点位于${fortune.sign}${fortune.degreeInSign.toFixed(1)}度` : '西洋星盘图',
  });

  svg.append(
    svgEl('circle', { cx: CX, cy: CY, r: R_OUTER, class: 'astrolabe-ring-outer' }),
    svgEl('circle', { cx: CX, cy: CY, r: R_ZODIAC_IN, class: 'astrolabe-ring-inner' }),
    svgEl('circle', { cx: CX, cy: CY, r: R_CORE, class: 'astrolabe-ring-core' }),
  );

  // 黄道十二星座环 + 每 10° 刻度
  for (let i = 0; i < 12; i += 1) {
    const startLon = i * 30;
    const start = toWheelPoint(startLon, ascLongitude, R_ZODIAC_IN, CX, CY);
    const end = toWheelPoint(startLon, ascLongitude, R_OUTER, CX, CY);
    const labelPt = toWheelPoint(startLon + 15, ascLongitude, (R_ZODIAC_IN + R_OUTER) / 2, CX, CY);
    const signInfo = ZODIAC_SIGNS[i]!;

    svg.append(
      svgEl('line', {
        x1: start.x.toFixed(2),
        y1: start.y.toFixed(2),
        x2: end.x.toFixed(2),
        y2: end.y.toFixed(2),
        class: 'astrolabe-zodiac-line',
      }),
      svgEl(
        'text',
        {
          x: labelPt.x.toFixed(2),
          y: labelPt.y.toFixed(2),
          class: `astrolabe-zodiac-label is-el-${signInfo.element}`,
          'dominant-baseline': 'central',
        },
        signInfo.symbol,
      ),
    );

    // 10° / 20° 刻度
    for (const subDeg of [10, 20]) {
      const t1 = toWheelPoint(startLon + subDeg, ascLongitude, R_ZODIAC_IN, CX, CY);
      const t2 = toWheelPoint(startLon + subDeg, ascLongitude, R_ZODIAC_IN + 5, CX, CY);
      svg.append(
        svgEl('line', {
          x1: t1.x.toFixed(2),
          y1: t1.y.toFixed(2),
          x2: t2.x.toFixed(2),
          y2: t2.y.toFixed(2),
          class: 'astrolabe-degree-tick',
        }),
      );
    }
  }

  // 十二宫位分割线与罗马宫位号
  for (let i = 0; i < sortedHouses.length; i += 1) {
    const h = sortedHouses[i];
    const next = sortedHouses[(i + 1) % sortedHouses.length];
    const start = toWheelPoint(h.longitude, ascLongitude, R_CORE, CX, CY);
    const end = toWheelPoint(h.longitude, ascLongitude, R_ZODIAC_IN, CX, CY);
    const isAngleCusp = h.house === 1 || h.house === 4 || h.house === 7 || h.house === 10;
    svg.append(
      svgEl('line', {
        x1: start.x.toFixed(2),
        y1: start.y.toFixed(2),
        x2: end.x.toFixed(2),
        y2: end.y.toFixed(2),
        class: isAngleCusp ? 'astrolabe-house-line is-angle' : 'astrolabe-house-line',
      }),
    );

    const midLon = midpointLongitude(h.longitude, next.longitude);
    const numPt = toWheelPoint(midLon, ascLongitude, R_HOUSE_NUM, CX, CY);
    svg.append(
      svgEl(
        'text',
        {
          x: numPt.x.toFixed(2),
          y: numPt.y.toFixed(2),
          class: 'astrolabe-house-num',
          'dominant-baseline': 'central',
        },
        ROMAN_HOUSES[h.house - 1] ?? String(h.house),
      ),
    );
  }

  // ASC / DSC / MC / IC 四轴外标
  const axisBadges: Array<{ label: string; lon: number }> = [
    { label: 'ASC', lon: ascLongitude },
    { label: 'DSC', lon: (ascLongitude + 180) % 360 },
  ];
  if (mcAngle) {
    axisBadges.push({ label: 'MC', lon: mcAngle.longitude }, { label: 'IC', lon: (mcAngle.longitude + 180) % 360 });
  }
  for (const ax of axisBadges) {
    const pt = toWheelPoint(ax.lon, ascLongitude, R_OUTER + 12, CX, CY);
    svg.append(
      svgEl(
        'text',
        {
          x: pt.x.toFixed(2),
          y: pt.y.toFixed(2),
          class: 'astrolabe-axis-tag',
          'dominant-baseline': 'central',
        },
        ax.label,
      ),
    );
  }

  // 相位连线（前 16 条强相位，支持交互高亮）
  const aspectElements: Array<{ el: SVGLineElement; first: string; second: string }> = [];
  const aspects = (data.aspects ?? []).slice(0, 16);
  for (const asp of aspects) {
    const p1 = pointById.get(asp.first);
    const p2 = pointById.get(asp.second);
    if (!p1 || !p2) continue;
    const c1 = toWheelPoint(p1.longitude, ascLongitude, R_CORE - 2, CX, CY);
    const c2 = toWheelPoint(p2.longitude, ascLongitude, R_CORE - 2, CX, CY);
    const cls = TENSE_ASPECTS.has(asp.type)
      ? 'astrolabe-aspect-line is-tense'
      : HARMONIOUS_ASPECTS.has(asp.type)
        ? 'astrolabe-aspect-line is-harmonious'
        : 'astrolabe-aspect-line';
    const line = svgEl('line', {
      x1: c1.x.toFixed(2),
      y1: c1.y.toFixed(2),
      x2: c2.x.toFixed(2),
      y2: c2.y.toFixed(2),
      class: cls,
    });
    aspectElements.push({ el: line, first: asp.first, second: asp.second });
    svg.append(line);
  }

  // 星体落点（带角距分层避让 + 度数角标 + 交互）
  const placedPoints: Array<{ lon: number; tier: number }> = [];
  const markerById = new Map<string, SVGGElement>();
  const rowById = new Map<string, HTMLElement>();
  let activePointId: string | undefined;

  const setActivePoint = (pointId: string | undefined) => {
    activePointId = activePointId === pointId ? undefined : pointId;
    for (const [id, g] of markerById) {
      g.classList.toggle('is-active', id === activePointId);
    }
    for (const [id, r] of rowById) {
      r.classList.toggle('is-active', id === activePointId);
    }
    for (const item of aspectElements) {
      if (!activePointId) {
        item.el.classList.remove('is-highlighted', 'is-dimmed');
      } else if (item.first === activePointId || item.second === activePointId) {
        item.el.classList.add('is-highlighted');
        item.el.classList.remove('is-dimmed');
      } else {
        item.el.classList.remove('is-highlighted');
        item.el.classList.add('is-dimmed');
      }
    }
  };

  for (const point of visiblePoints) {
    const nearby = placedPoints.filter((p) => angularDiff(p.lon, point.longitude) < 10);
    const tier = nearby.length % 3;
    placedPoints.push({ lon: point.longitude, tier });
    const radius = tier === 0 ? 116 : tier === 1 ? 97 : 128;
    const pt = toWheelPoint(point.longitude, ascLongitude, radius, CX, CY);
    const rimPt = toWheelPoint(point.longitude, ascLongitude, R_ZODIAC_IN, CX, CY);
    const glyph = PLANET_GLYPHS[point.id] ?? point.name.slice(0, 1);
    const isFortune = point.id === 'fortune';

    const g = svgEl('g', {
      class: isFortune ? 'astrolabe-planet-marker is-fortune' : 'astrolabe-planet-marker',
    });
    g.append(
      svgEl(
        'title',
        undefined,
        `${point.name}：${point.sign} ${point.degreeInSign.toFixed(1)}° · 第${point.house}宫${point.retrograde ? ' (逆行)' : ''}`,
      ),
      svgEl('line', {
        x1: pt.x.toFixed(2),
        y1: pt.y.toFixed(2),
        x2: rimPt.x.toFixed(2),
        y2: rimPt.y.toFixed(2),
        class: 'astrolabe-planet-tick',
      }),
      svgEl('circle', {
        cx: pt.x.toFixed(2),
        cy: pt.y.toFixed(2),
        r: 9,
        class: 'astrolabe-planet-dot',
      }),
      svgEl(
        'text',
        {
          x: pt.x.toFixed(2),
          y: pt.y.toFixed(2),
          class: 'astrolabe-planet-label',
          'dominant-baseline': 'central',
        },
        `${glyph}${point.retrograde ? '℞' : ''}`,
      ),
    );
    g.addEventListener('click', () => setActivePoint(point.id));
    markerById.set(point.id, g);
    svg.append(g);
  }

  const svgWrap = el('div', { className: 'astrolabe-svg-wrap' });
  svgWrap.append(svg);

  // 右侧/下方行星落点摘要列表
  const sidebar = el('div', { className: 'astrolabe-sidebar' });

  if (data.angles?.length) {
    const angleStrip = el('div', { className: 'astrolabe-angles' });
    for (const ang of data.angles) {
      angleStrip.append(
        el(
          'div',
          { className: 'astrolabe-angle-chip' },
          el('span', { className: 'astrolabe-angle-name', text: ang.name }),
          el('strong', {
            className: 'astrolabe-angle-pos',
            text: `${ang.sign} ${ang.degreeInSign.toFixed(1)}°`,
          }),
        ),
      );
    }
    sidebar.append(angleStrip);
  }

  const DIGNITY_SHORT: Record<string, string> = {
    domicile: '庙',
    exaltation: '升',
    detriment: '失',
    fall: '陷',
  };
  const SIGN_CLASSICAL_RULER: Record<string, string> = {
    白羊: 'mars',
    金牛: 'venus',
    双子: 'mercury',
    巨蟹: 'moon',
    狮子: 'sun',
    处女: 'mercury',
    天秤: 'venus',
    天蝎: 'mars',
    射手: 'jupiter',
    摩羯: 'saturn',
    水瓶: 'saturn',
    双鱼: 'jupiter',
  };

  const planetList = el('div', { className: 'astrolabe-planet-list' });
  for (const point of visiblePoints) {
    const glyph = PLANET_GLYPHS[point.id] ?? '';
    const item = el('button', {
      type: 'button',
      className: point.id === 'fortune' ? 'astrolabe-planet-row is-fortune' : 'astrolabe-planet-row',
      onClick: () => setActivePoint(point.id),
    });
    const rawDig = Array.isArray(point.dignities)
      ? point.dignities
      : Array.isArray(point.dignity)
        ? point.dignity
        : [];
    const dignityTags = rawDig.map((d) => DIGNITY_SHORT[d] ?? d).filter(Boolean).join('');
    item.append(
      el('span', { className: 'astrolabe-row-glyph', text: glyph }),
      el('span', { className: 'astrolabe-row-name', text: `${point.name}${dignityTags ? `(${dignityTags})` : ''}` }),
      el('span', {
        className: 'astrolabe-row-pos',
        text: `${point.sign} ${point.degreeInSign.toFixed(1)}°`,
      }),
      el('span', { className: 'astrolabe-row-house', text: `${point.house}宫` }),
    );
    if (point.retrograde) {
      item.append(el('span', { className: 'astrolabe-row-rx', text: '逆' }));
    }
    rowById.set(point.id, item);
    planetList.append(item);
  }
  sidebar.append(planetList);

  layout.append(svgWrap, sidebar);
  shell.append(layout);

  // 补充展示四元素/三模式分布、星盘格局、十二宫头与核心相位表
  const rawAstro = data as unknown as Record<string, unknown>;
  const distributions = rawAstro.distributions as
    | {
        elements?: Array<{ label: string; members: Array<{ name: string }> }>;
        modalities?: Array<{ label: string; members: Array<{ name: string }> }>;
        retrograde?: Array<{ name: string }>;
      }
    | undefined;
  const patterns = rawAstro.patterns as
    | Array<{ label?: string; members?: Array<{ name: string }>; apex?: { name: string }; sign?: string; house?: number }>
    | undefined;

  if (distributions || patterns?.length) {
    const astroSummaryGrid = el('div', { className: 'astro-extra-grid' });

    if (distributions?.elements?.length) {
      const elCard = el('div', { className: 'astro-extra-card' });
      elCard.append(el('h4', { className: 'astro-extra-title', text: '元素与模式分布' }));
      const distRows = el('div', { className: 'astro-dist-list' });
      for (const item of distributions.elements) {
        const row = el('div', { className: 'astro-dist-row' });
        row.append(
          el('span', { className: 'astro-dist-k', text: `${item.label}象 (${item.members.length})` }),
          el('span', { className: 'astro-dist-v', text: item.members.map((m) => m.name).join('、') || '无' }),
        );
        distRows.append(row);
      }
      if (distributions.modalities?.length) {
        for (const item of distributions.modalities) {
          const row = el('div', { className: 'astro-dist-row' });
          row.append(
            el('span', { className: 'astro-dist-k', text: `${item.label} (${item.members.length})` }),
            el('span', { className: 'astro-dist-v', text: item.members.map((m) => m.name).join('、') || '无' }),
          );
          distRows.append(row);
        }
      }
      elCard.append(distRows);
      astroSummaryGrid.append(elCard);
    }

    if (patterns?.length || distributions?.retrograde?.length) {
      const patCard = el('div', { className: 'astro-extra-card' });
      patCard.append(el('h4', { className: 'astro-extra-title', text: '星盘格局与逆行星体' }));
      const patList = el('div', { className: 'astro-pat-list' });
      for (const p of patterns ?? []) {
        const mems = p.members?.map((m) => m.name).join(' · ') ?? '';
        const extra = p.apex?.name ? `顶点:${p.apex.name}` : p.sign ? `${p.sign}座` : p.house ? `第${p.house}宫` : '';
        const item = el('div', { className: 'astro-pat-item' });
        item.append(
          el('strong', { className: 'astro-pat-label', text: p.label ?? '格局' }),
          el('span', { className: 'astro-pat-detail', text: [mems, extra].filter(Boolean).join(' · ') }),
        );
        patList.append(item);
      }
      if (distributions?.retrograde?.length) {
        const rxRow = el('div', { className: 'astro-pat-item' });
        rxRow.append(
          el('strong', { className: 'astro-pat-label', text: '逆行星体' }),
          el('span', { className: 'astro-pat-detail', text: distributions.retrograde.map((r) => r.name).join('、') }),
        );
        patList.append(rxRow);
      }
      patCard.append(patList);
      astroSummaryGrid.append(patCard);
    }

    if (astroSummaryGrid.childElementCount > 0) shell.append(astroSummaryGrid);
  }

  // 十二宫宫头 & 相位详情
  const allAspects = (rawAstro.aspects as AstrolabeAspect[] | undefined) ?? [];
  const astroDetailGrid = el('div', { className: 'astro-extra-grid' });

  if (sortedHouses.length > 0) {
    const houseCard = el('div', { className: 'astro-extra-card' });
    houseCard.append(el('h4', { className: 'astro-extra-title', text: '十二宫宫头星座与宫主飞宫' }));
    const hGrid = el('div', { className: 'astro-house-grid' });
    for (const h of sortedHouses) {
      const signKey = h.sign.replace(/座$/u, '');
      const rulerId = SIGN_CLASSICAL_RULER[signKey];
      const rulerPt = rulerId ? pointById.get(rulerId) : undefined;
      const rulerHint = rulerPt ? ` · 主${rulerPt.name.slice(0, 1)}飞${rulerPt.house}宫` : '';
      const cell = el('div', { className: 'astro-house-cell' });
      cell.append(
        el('span', { className: 'astro-house-idx', text: `${ROMAN_HOUSES[h.house - 1] ?? h.house}宫` }),
        el('strong', { className: 'astro-house-sign', text: `${h.sign} ${h.degreeInSign.toFixed(1)}°${rulerHint}` }),
      );
      hGrid.append(cell);
    }
    houseCard.append(hGrid);
    astroDetailGrid.append(houseCard);
  }

  if (allAspects.length > 0) {
    const aspCard = el('div', { className: 'astro-extra-card' });
    aspCard.append(el('h4', { className: 'astro-extra-title', text: `主要相位表（共 ${allAspects.length} 条）` }));
    const aList = el('div', { className: 'astro-aspect-list' });
    for (const a of allAspects.slice(0, 16)) {
      const aRec = a as unknown as Record<string, unknown>;
      const firstId = a.first ?? (typeof aRec.point1 === 'string' ? aRec.point1 : '');
      const secondId = a.second ?? (typeof aRec.point2 === 'string' ? aRec.point2 : '');
      const p1Name =
        pointById.get(firstId)?.name ??
        (typeof aRec.point1Name === 'string' ? aRec.point1Name : firstId) ??
        '—';
      const p2Name =
        pointById.get(secondId)?.name ??
        (typeof aRec.point2Name === 'string' ? aRec.point2Name : secondId) ??
        '—';
      const aspLabel =
        a.name ?? (typeof aRec.label === 'string' ? aRec.label : '') ?? '相位';
      const isTense = TENSE_ASPECTS.has(a.type);
      const isHarm = HARMONIOUS_ASPECTS.has(a.type);
      const row = el('div', { className: `astro-aspect-row ${isTense ? 'is-tense' : isHarm ? 'is-harm' : ''}`.trim() });
      const devStr = a.deviation !== undefined ? `${a.deviation.toFixed(2)}°` : '';
      const strengthStr = a.strength !== undefined ? `${Math.round(a.strength)}%` : '';
      const phaseStr = a.applying === true ? '入相位' : a.applying === false ? '出相位' : '';
      row.append(
        el('span', { className: 'astro-aspect-pair', text: `${p1Name} · ${aspLabel} · ${p2Name}` }),
        el('small', { className: 'astro-aspect-orb', text: [devStr, strengthStr, phaseStr].filter(Boolean).join(' · ') }),
      );
      aList.append(row);
    }
    aspCard.append(aList);
    astroDetailGrid.append(aspCard);
  }

  if (astroDetailGrid.childElementCount > 0) shell.append(astroDetailGrid);

  // 虚点衍生与校验提示
  const extraDerived = data.derived ?? [];
  const warnings = (rawAstro.warnings as string[] | undefined) ?? [];
  if (extraDerived.length > 0 || warnings.length > 0) {
    const extrasCard = el('div', { className: 'astro-extra-card' });
    extrasCard.style.marginTop = '12px';
    extrasCard.append(el('h4', { className: 'astro-extra-title', text: '虚点交点与星盘校验提示' }));
    const list = el('div', { className: 'astro-pat-list' });
    for (const d of extraDerived) {
      const row = el('div', { className: 'astro-pat-item' });
      row.append(
        el('strong', { className: 'astro-pat-label', text: d.name }),
        el('span', {
          className: 'astro-pat-detail',
          text: `${d.sign} ${d.degreeInSign.toFixed(1)}°${d.house ? ` · 第${d.house}宫` : ''}`,
        }),
      );
      list.append(row);
    }
    for (const w of warnings.slice(0, 4)) {
      const row = el('div', { className: 'astro-pat-item' });
      row.append(
        el('strong', { className: 'astro-pat-label', text: '提示' }),
        el('span', { className: 'astro-pat-detail', text: w }),
      );
      list.append(row);
    }
    extrasCard.append(list);
    shell.append(extrasCard);
  }

  container.hidden = false;
  container.replaceChildren(shell);
  return true;
}
