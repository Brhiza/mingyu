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
import { createMobileDetailSheet } from './shared';
import { formatHuangjiTableLabel } from '../systems/prompt-format';

const TAIYI_NINE_GRID: Array<{ palace: number; gua: string; sym: string; dir: string }> = [
  { palace: 9, gua: '巽', sym: '☴', dir: '东南' },
  { palace: 2, gua: '离', sym: '☲', dir: '南' },
  { palace: 7, gua: '坤', sym: '☷', dir: '西南' },
  { palace: 4, gua: '震', sym: '☳', dir: '东' },
  { palace: 5, gua: '中', sym: '☯', dir: '中宫' },
  { palace: 6, gua: '兑', sym: '☱', dir: '西' },
  { palace: 3, gua: '艮', sym: '☶', dir: '东北' },
  { palace: 8, gua: '坎', sym: '☵', dir: '北' },
  { palace: 1, gua: '乾', sym: '☰', dir: '西北' },
];

const TRIGRAM_LINES: Record<string, readonly [boolean, boolean, boolean]> = {
  乾: [true, true, true],
  兑: [true, true, false],
  离: [true, false, true],
  震: [true, false, false],
  巽: [false, true, true],
  坎: [false, true, false],
  艮: [false, false, true],
  坤: [false, false, false],
};

function createMiniHexagramSvg(upper?: string, lower?: string, changedLine?: number): SVGSVGElement | undefined {
  const low = lower ? TRIGRAM_LINES[lower] : undefined;
  const up = upper ? TRIGRAM_LINES[upper] : undefined;
  if (!low || !up) return undefined;
  const lines = [...low, ...up];
  const svg = svgEl('svg', {
    class: 'hj-hex-svg',
    viewBox: '0 0 64 46',
    width: '56',
    height: '40',
    'aria-hidden': 'true',
  });
  for (let pos = 1; pos <= 6; pos++) {
    const isYang = lines[pos - 1];
    const y = 40 - (pos - 1) * 7;
    const cls = changedLine === pos ? 'hj-yao-bar is-changed' : 'hj-yao-bar';
    if (isYang) {
      svg.append(svgEl('rect', { x: 4, y, width: 56, height: 4, rx: 1, class: cls }));
    } else {
      svg.append(svgEl('rect', { x: 4, y, width: 24, height: 4, rx: 1, class: cls }));
      svg.append(svgEl('rect', { x: 36, y, width: 24, height: 4, rx: 1, class: cls }));
    }
  }
  return svg;
}

function renderTaiyi(container: HTMLElement, data: UnknownRecord): boolean {
  const chart = asRecord(data.chart) ?? data;
  const taiyiPalace = asNumber(chart.taiyiPalace);
  const lordCount = asNumber(chart.lordCount);
  if (taiyiPalace === undefined && lordCount === undefined) return false;

  const yinYang = asString(chart.yinYang);
  const bureau = asNumber(chart.bureau);
  const ganZhi = asString(chart.ganZhi);
  const dateTime = asString(chart.dateTime);
  const conditions = asRecord(chart.conditions);
  const threeGates = asRecord(conditions?.threeGates);
  const fiveGenerals = asRecord(conditions?.fiveGenerals);
  const harmony = asRecord(conditions?.yinYangHarmony);

  const badges: Array<{ text: string; tone?: 'accent' | 'neutral' | 'good' | 'warn' }> = [];
  if (yinYang) badges.push({ text: yinYang, tone: 'neutral' });
  if (bureau !== undefined) badges.push({ text: `${bureau}局`, tone: 'accent' });
  if (taiyiPalace !== undefined) {
    badges.push({ text: `太乙${taiyiPalace}宫(${asString(chart.taiyiPosition) ?? ''})`, tone: 'accent' });
  }
  if (asString(threeGates?.status)) {
    badges.push({
      text: asString(threeGates?.status)!,
      tone: threeGates?.complete === true ? 'good' : 'warn',
    });
  }
  if (fiveGenerals) {
    badges.push({
      text: fiveGenerals.launched === true ? '五将发' : '五将不发',
      tone: fiveGenerals.launched === true ? 'good' : 'warn',
    });
  }

  container.append(
    createBoardHeader(
      '太乙神数九宫盘',
      [ganZhi, dateTime].filter(Boolean).join(' · ') || undefined,
      badges,
    ),
  );

  const countNatures = asRecord(chart.countNatures);
  const accVal = asNumber(chart.accumulatedValue);
  const accLabel = asString(chart.accumulatedLabel) ?? '积数';
  const entryYears = asNumber(chart.entryYears);
  const threeGateRoles = asArray(threeGates?.roles)
    .map(asRecord)
    .filter((x): x is UnknownRecord => Boolean(x))
    .map((r) => `${asString(r.role) ?? ''}(${asString(r.position) ?? ''}·${asString(r.gate) ?? ''})`)
    .join(' · ');

  const meta = createMetaGrid([
    [
      '主算 / 客算 / 定算',
      [
        lordCount !== undefined ? `主${lordCount}${asString(countNatures?.lord) ? `(${asString(countNatures?.lord)})` : ''}` : '',
        asNumber(chart.guestCount) !== undefined
          ? `客${asNumber(chart.guestCount)}${asString(countNatures?.guest) ? `(${asString(countNatures?.guest)})` : ''}`
          : '',
        asNumber(chart.setCount) !== undefined
          ? `定${asNumber(chart.setCount)}${asString(countNatures?.set) ? `(${asString(countNatures?.set)})` : ''}`
          : '',
      ]
        .filter(Boolean)
        .join(' · ') || undefined,
    ],
    [
      '门将条件',
      (() => {
        const hostGuest = asRecord(fiveGenerals?.hostGuestElementRelation);
        const rel = asString(hostGuest?.relation);
        const nayin = asString(hostGuest?.dayNayin);
        const relSummary = rel && rel !== '未判定' ? `${rel}${nayin ? `(${nayin})` : ''}` : '';
        return [
          asString(threeGates?.status) ?? '',
          fiveGenerals ? (fiveGenerals.launched === true ? '五将发' : '五将不发') : '',
          harmony ? (harmony.matched === true ? '阴阳和' : '阴阳不和') : '',
          relSummary,
        ]
          .filter(Boolean)
          .join(' · ') || undefined;
      })(),
    ],
    ['天目直门', threeGateRoles || undefined],
  ]);
  if (meta) container.append(meta);

  // 九宫内盘格局
  const gateByPalace = asRecord(threeGates?.gateByPalace);
  const directGate = asString(threeGates?.directGate);

  const roleMarkers = new Map<number, Array<{ label: string; tone: 'accent' | 'good' | 'warn' | 'neutral' }>>();
  const addMarker = (palace: number | undefined, label: string, tone: 'accent' | 'good' | 'warn' | 'neutral') => {
    if (palace === undefined) return;
    const list = roleMarkers.get(palace) ?? [];
    list.push({ label, tone });
    roleMarkers.set(palace, list);
  };

  addMarker(taiyiPalace, `太乙(${asString(chart.taiyiPosition) ?? ''})`, 'accent');
  addMarker(asNumber(chart.wenChangPalace), `文昌(${asString(chart.wenChangPosition) ?? ''})`, 'good');
  addMarker(asNumber(chart.shiJiPalace), `始击(${asString(chart.shiJiPosition) ?? ''})`, 'warn');
  addMarker(asNumber(chart.jiShenPalace), `计神(${asString(chart.jiShenPosition) ?? ''})`, 'neutral');
  addMarker(asNumber(chart.lordGeneral), '主大将', 'good');
  addMarker(asNumber(chart.lordAssistant), '主参将', 'neutral');
  addMarker(asNumber(chart.guestGeneral), '客大将', 'warn');
  addMarker(asNumber(chart.guestAssistant), '客参将', 'neutral');
  addMarker(asNumber(chart.setGeneral), '定大将', 'neutral');
  addMarker(asNumber(chart.setAssistant), '定参将', 'neutral');

  const grid = el('div', 'ty-nine-grid');
  grid.setAttribute('role', 'group');
  grid.setAttribute('aria-label', '太乙神数九宫格');

  const detailBox = el('div', 'ty-detail-card');
  const detailSheet = createMobileDetailSheet(detailBox, { label: '太乙宫位详情' });
  const buttons = new Map<number, HTMLButtonElement>();
  const relations = asArray(fiveGenerals?.relations).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  const tacticGuidance = asString(chart.tacticGuidance);

  const selectPalace = (palaceNum: number, openSheet = false) => {
    const slot = TAIYI_NINE_GRID.find((s) => s.palace === palaceNum) ?? TAIYI_NINE_GRID[4];
    for (const [p, btn] of buttons) {
      const active = p === slot.palace;
      btn.classList.toggle('is-selected', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    }

    detailBox.replaceChildren();
    const isTaiyi = slot.palace === taiyiPalace;
    const gate = gateByPalace ? asString(gateByPalace[String(slot.palace)]) : undefined;
    const isDirect = Boolean(gate && gate === directGate);
    const markers = roleMarkers.get(slot.palace) ?? [];

    const head = el('div', 'qm-detail-head');
    head.append(el('strong', 'qm-detail-title', `${slot.sym} ${slot.palace}宫 · ${slot.gua}（${slot.dir}）`));
    if (isTaiyi || isDirect) {
      const tagRow = el('div', 'wb-badges');
      if (isTaiyi) tagRow.append(el('span', 'wb-badge wb-badge-accent', '太乙所在'));
      if (isDirect && gate) tagRow.append(el('span', 'wb-badge wb-badge-good', `${gate}直门`));
      head.append(tagRow);
    }
    detailBox.append(head);

    const meta = createMetaGrid([
      ['八门', gate ? `${gate}${isDirect ? '（直门）' : ''}` : slot.palace === 5 ? '中宫寄位' : '—'],
      ['宫位卦象', `${slot.gua}宫 · ${slot.dir}`],
      ['驻守神将', markers.length > 0 ? markers.map((m) => m.label).join('、') : '无主客神将驻守'],
    ]);
    if (meta) detailBox.append(meta);

    if (markers.length > 0) {
      const wrap = el('div', 'ty-markers');
      for (const m of markers) {
        wrap.append(el('span', `wb-badge wb-badge-${m.tone}`, m.label));
      }
      detailBox.append(wrap);
    }

    const palaceRelations = relations.filter(
      (rel) => asNumber(rel.leftPalace) === slot.palace || asNumber(rel.rightPalace) === slot.palace,
    );
    if (palaceRelations.length > 0) {
      const relWrap = el('div', 'wb-chip-wrap');
      for (const rel of palaceRelations) {
        const text = `${asString(rel.kind) ?? asString(rel.relation) ?? ''}：${asString(rel.left) ?? ''}(${asNumber(rel.leftPalace) ?? ''}宫) ${asString(rel.relation) ?? ''} ${asString(rel.right) ?? ''}(${asNumber(rel.rightPalace) ?? ''}宫)`;
        relWrap.append(el('span', 'wb-badge wb-badge-warn', text));
      }
      detailBox.append(relWrap);
    }

    if (tacticGuidance && isTaiyi) {
      detailBox.append(el('p', 'wb-note-box', tacticGuidance));
    }

    if (openSheet) detailSheet.open();
  };

  for (const slot of TAIYI_NINE_GRID) {
    const isTaiyi = slot.palace === taiyiPalace;
    const cell = el('button', `ty-palace${isTaiyi ? ' is-taiyi' : ''}${slot.palace === 5 ? ' is-center' : ''}`);
    cell.type = 'button';
    const head = el('div', 'ty-palace-head');
    head.append(el('span', 'ty-palace-name', `${slot.sym}${slot.palace}宫·${slot.gua}${slot.dir}`));
    const gate = gateByPalace ? asString(gateByPalace[String(slot.palace)]) : undefined;
    if (gate) {
      const isDirect = gate === directGate;
      head.append(el('span', `ty-gate${isDirect ? ' is-direct' : ''}`, isDirect ? `${gate}(直)` : gate));
    }
    cell.append(head);

    const markers = roleMarkers.get(slot.palace) ?? [];
    if (markers.length > 0) {
      const wrap = el('div', 'ty-markers');
      for (const m of markers) {
        wrap.append(el('span', `wb-badge wb-badge-${m.tone}`, m.label));
      }
      cell.append(wrap);
    } else if (slot.palace === 5) {
      cell.append(el('div', 'ty-center-note', '太乙中宫'));
    }
    cell.addEventListener('click', () => selectPalace(slot.palace, true));
    buttons.set(slot.palace, cell);
    grid.append(cell);
  }
  container.append(grid, detailSheet.element);
  selectPalace(taiyiPalace ?? 5);

  // 十六神方位条
  const sixteenGods = asArray(chart.sixteenGods).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  if (sixteenGods.length > 0) {
    const posHighlights = new Map<string, string[]>();
    const markPos = (pos: string | undefined, tag: string) => {
      if (!pos) return;
      const arr = posHighlights.get(pos) ?? [];
      arr.push(tag);
      posHighlights.set(pos, arr);
    };
    markPos(asString(chart.taiyiPosition), '太乙');
    markPos(asString(chart.wenChangPosition), '文昌');
    markPos(asString(chart.shiJiPosition), '始击');
    markPos(asString(chart.jiShenPosition), '计神');

    const sec = el('div', 'lr-section');
    sec.append(el('h4', 'lr-section-title', '十六神方位'));
    const strip = el('div', 'ty-gods-grid');
    for (const item of sixteenGods) {
      const branch = asString(item.branch) ?? '';
      const god = asString(item.god) ?? '';
      const hits = posHighlights.get(branch) ?? [];
      const chip = el('div', `ty-god-chip${hits.length > 0 ? ' is-active' : ''}`);
      chip.append(el('span', 'ty-god-branch', branch));
      chip.append(el('span', 'ty-god-name', god));
      if (hits.length > 0) {
        chip.append(el('span', 'ty-god-hit', hits.join('/')));
      }
      strip.append(chip);
    }
    sec.append(strip);
    container.append(sec);
  }

  // 门将关系与战术提示
  if (relations.length > 0) {
    const relWrap = el('div', 'wb-chip-wrap');
    for (const rel of relations) {
      const text = `${asString(rel.kind) ?? asString(rel.relation) ?? ''}：${asString(rel.left) ?? ''}(${asNumber(rel.leftPalace) ?? ''}宫) ${asString(rel.relation) ?? ''} ${asString(rel.right) ?? ''}(${asNumber(rel.rightPalace) ?? ''}宫)`;
      relWrap.append(el('span', 'wb-badge wb-badge-warn', text));
    }
    container.append(relWrap);
  }

  const ev = asRecord(chart.evidenceAnalysis);
  const primaryFacts = asArray(ev?.primaryFacts).map(asString).filter((x): x is string => Boolean(x));
  const counterEv = asArray(ev?.counterEvidence).map(asString).filter((x): x is string => Boolean(x));
  const judgments = asArray(chart.judgments ?? data.judgments)
    .map((j) => (typeof j === 'string' ? j : asString(asRecord(j)?.summary) ?? asString(asRecord(j)?.text)))
    .filter((x): x is string => Boolean(x));

  if (accVal !== undefined || entryYears !== undefined || tacticGuidance || judgments.length > 0 || primaryFacts.length > 0 || counterEv.length > 0) {
    const tyCount = judgments.length + primaryFacts.length + counterEv.length;
    const tyBar = createBoardDetailBar([
      createBoardModalTrigger(
        '积数推演与断语核验',
        '太乙积数推演与格局断语',
        () => {
          const frag = document.createDocumentFragment();
          const calcMeta = createMetaGrid([
            [accLabel, accVal !== undefined ? String(accVal) : undefined],
            ['入纪元', entryYears !== undefined ? `${entryYears}年` : undefined],
          ]);
          if (calcMeta) frag.append(calcMeta);
          if (tacticGuidance) {
            frag.append(el('p', 'wb-note-box', tacticGuidance));
          }
          if (tyCount > 0) {
            const list = el('div', 'wb-computed-list');
            for (const txt of judgments) {
              const card = el('div', 'wb-computed-item');
              card.append(el('p', 'wb-computed-desc', txt));
              list.append(card);
            }
            for (const pf of primaryFacts) {
              const card = el('div', 'wb-computed-item is-good');
              card.append(el('p', 'wb-computed-desc', pf));
              list.append(card);
            }
            for (const ce of counterEv) {
              const card = el('div', 'wb-computed-item is-bad');
              card.append(el('p', 'wb-computed-desc', `限制：${ce}`));
              list.append(card);
            }
            frag.append(list);
          }
          return frag;
        },
        tyCount > 0 ? `${tyCount}项` : undefined,
      ),
    ]);
    if (tyBar) container.append(tyBar);
  }

  return true;
}

function appendHexCard(
  parent: HTMLElement,
  label: string,
  hex: UnknownRecord | undefined,
  extra?: { range?: string; derived?: string; highlight?: boolean; changedLine?: number },
) {
  if (!hex) return;
  const card = el('div', `hj-hex-card${extra?.highlight ? ' is-highlight' : ''}`);
  const head = el('div', 'hj-hex-head');
  head.append(el('span', 'hj-hex-role', label));
  if (extra?.range) head.append(el('span', 'hj-hex-range', extra.range));
  card.append(head);

  const main = el('div', 'hj-hex-main');
  const hexSvg = createMiniHexagramSvg(asString(hex.upper), asString(hex.lower), extra?.changedLine);
  if (hexSvg) {
    main.append(hexSvg);
  } else if (asString(hex.symbol)) {
    main.append(el('span', 'hj-hex-symbol', asString(hex.symbol)));
  }
  const titleCol = el('div', 'hj-hex-title-col');
  titleCol.append(el('strong', 'hj-hex-name', asString(hex.name) ?? asString(hex.shortName) ?? '—'));
  if (asString(hex.upper) && asString(hex.lower)) {
    titleCol.append(el('small', 'hj-hex-trigram-sub', `${asString(hex.upper)}上${asString(hex.lower)}下`));
  }
  main.append(titleCol);
  card.append(main);

  if (extra?.derived) {
    card.append(el('div', 'hj-hex-derived', extra.derived));
  } else if (asString(hex.judgment)) {
    card.append(el('div', 'hj-hex-derived', asString(hex.judgment)));
  }
  parent.append(card);
}

function renderHuangjiReference(container: HTMLElement, ref: UnknownRecord): boolean {
  const title = asString(ref.title) ?? '皇极经世参考表';
  const tableKey = asString(ref.table) ?? '';
  const tableLabel = formatHuangjiTableLabel(tableKey) || '参考表';
  const shiIdx = asNumber(ref.shiIndex);
  const branch = asString(ref.branch);
  container.append(
    createBoardHeader(
      title,
      shiIdx !== undefined ? `经辰 ${shiIdx} · ${branch ?? ''}` : undefined,
      [{ text: tableLabel, tone: 'accent' }],
    ),
  );
  const rows = asArray(ref.rows).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  if (rows.length > 0) {
    const list = el('div', 'wb-computed-list');
    for (const r of rows.slice(0, 12)) {
      const card = el('div', 'wb-computed-item');
      card.append(
        el(
          'strong',
          'wb-computed-title',
          `第${asNumber(r.rowIndex) ?? ''} · ${asString(r.ganzhi) ?? ''}${asString(r.historicalLabel) ? `（${asString(r.historicalLabel)}）` : ''}`,
        ),
      );
      if (asString(r.sourceText)) card.append(el('p', 'wb-computed-desc', asString(r.sourceText)));
      list.append(card);
    }
    container.append(list);
    return true;
  }

  if (tableKey === 'sound-rhythm') {
    const bodyCounts = asRecord(ref.bodyCounts);
    const soundCats = asArray(ref.soundCategories).map(asString).filter(Boolean);
    const toneCats = asArray(ref.toneCategories).map(asString).filter(Boolean);
    const meta = createMetaGrid([
      [
        '体用总目',
        bodyCounts
          ? `天体 ${asNumber(bodyCounts.heavenlyBody) ?? '—'} · 地体 ${asNumber(bodyCounts.earthlyBody) ?? '—'} · 天用声 ${asNumber(bodyCounts.heavenlyUseSound) ?? '—'} · 地用音 ${asNumber(bodyCounts.earthlyUseTone) ?? '—'}`
          : undefined,
      ],
      ['四声分类', soundCats.join(' · ') || undefined],
      ['四音分类', toneCats.join(' · ') || undefined],
    ]);
    if (meta) container.append(meta);

    const diagrams = asArray(ref.diagramCounts).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
    const rules = asArray(ref.rules).map(asString).filter((x): x is string => Boolean(x));
    const list = el('div', 'wb-computed-list');
    for (const d of diagrams) {
      const card = el('div', 'wb-computed-item');
      card.append(el('strong', 'wb-computed-title', `${asString(d.name) ?? ''}：${asNumber(d.value) ?? ''}`));
      if (asString(d.formula)) card.append(el('p', 'wb-computed-desc', `推算：${asString(d.formula)}`));
      list.append(card);
    }
    for (const rule of rules) {
      const card = el('div', 'wb-computed-item');
      card.append(el('p', 'wb-computed-desc', rule));
      list.append(card);
    }
    if (list.childElementCount > 0 || meta) {
      if (list.childElementCount > 0) container.append(list);
      return true;
    }
  }

  if (tableKey === 'animal-plant') {
    const counts = asArray(ref.counts).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
    if (counts.length > 0) {
      const list = el('div', 'wb-computed-list');
      for (const c of counts) {
        const card = el('div', 'wb-computed-item');
        card.append(el('strong', 'wb-computed-title', `${asString(c.name) ?? ''}：${asNumber(c.value) ?? ''}`));
        if (asString(c.formula)) card.append(el('p', 'wb-computed-desc', `推算：${asString(c.formula)}`));
        list.append(card);
      }
      container.append(list);
      return true;
    }
  }

  return false;
}

function renderHuangji(container: HTMLElement, data: UnknownRecord): boolean {
  const ref = asRecord(data.reference);
  if (ref) return renderHuangjiReference(container, ref);

  const chart = asRecord(data.chart) ?? data;
  const coords = asRecord(chart.position) ?? asRecord(chart.coordinates) ?? asRecord(data.coordinates);
  const forecast = asRecord(chart.forecast) ?? asRecord(data.forecast);
  if (!coords && !forecast) return false;

  const progress = asRecord(chart.progress);
  const reading = asRecord(forecast?.reading);
  const eraTrend = asRecord(chart.eraTrend) ?? asRecord(data.eraTrend);
  const hui = asRecord(forecast?.hui) ?? asRecord(coords?.hui);

  const badges: Array<{ text: string; tone?: 'accent' | 'neutral' | 'good' | 'warn' }> = [];
  if (asString(hui?.branch)) badges.push({ text: `${asString(hui?.branch)}会`, tone: 'neutral' });
  if (asString(eraTrend?.phase)) badges.push({ text: asString(eraTrend?.phase)!, tone: 'accent' });
  if (asString(eraTrend?.trendNature)) badges.push({ text: asString(eraTrend?.trendNature)!, tone: 'good' });
  const yangCount = asNumber(eraTrend?.yangLineCount);
  const yinCount = asNumber(eraTrend?.yinLineCount);
  if (yangCount !== undefined && yinCount !== undefined) {
    badges.push({ text: `${yangCount}阳${yinCount}阴`, tone: 'neutral' });
  }

  container.append(
    createBoardHeader(
      '皇极经世运势盘',
      asString(reading?.headline) ?? asString(reading?.cycleContext),
      badges,
    ),
  );

  // 元会运世层级条 + 周期进度条
  if (coords) {
    const cycleGrid = el('div', 'hj-cycle-grid');
    const levels: Array<[string, 'yuan' | 'hui' | 'yun' | 'shi', UnknownRecord | undefined]> = [
      ['元', 'yuan', asRecord(coords.yuan)],
      ['会', 'hui', asRecord(coords.hui)],
      ['运', 'yun', asRecord(coords.yun)],
      ['世', 'shi', asRecord(coords.shi)],
    ];
    for (const [label, key, item] of levels) {
      if (!item) continue;
      const box = el('div', 'hj-cycle-box');
      const idx = asNumber(item.indexFromEpoch) ?? asNumber(item.indexInYuan) ?? asNumber(item.indexInHui) ?? asNumber(item.indexInYun);
      const branch = key === 'hui' ? asString(hui?.branch) : asString(item.branch);
      box.append(el('span', 'hj-cycle-label', `${label}${branch ? ` · ${branch}` : ''}`));
      box.append(el('strong', 'hj-cycle-val', idx !== undefined ? `第${idx}${label}` : '—'));
      const start = asNumber(item.startYear);
      const end = asNumber(item.endYear);
      if (start !== undefined && end !== undefined) {
        box.append(el('span', 'hj-cycle-range', `${start} ~ ${end}`));
      }
      const prog = asRecord(progress?.[key]);
      const curIdx = asNumber(prog?.currentYearIndex);
      const rem = asNumber(prog?.remainingYearsAfterCurrent);
      if (curIdx !== undefined && rem !== undefined && curIdx + rem > 0) {
        const pct = Math.round((curIdx / (curIdx + rem)) * 100);
        const barWrap = el('div', 'hj-prog-wrap');
        const track = el('div', 'hj-prog-track');
        const fill = el('div', 'hj-prog-fill');
        fill.style.width = `${Math.max(4, pct)}%`;
        track.append(fill);
        barWrap.append(track, el('span', 'hj-prog-txt', `已行 ${curIdx}年 (${pct}%)`));
        box.append(barWrap);
      }
      cycleGrid.append(box);
    }
    if (cycleGrid.childElementCount > 0) container.append(cycleGrid);
  }

  // 值卦演化链
  const hexagrams = asRecord(forecast?.hexagrams);
  if (hexagrams) {
    const sec = el('div', 'lr-section');
    sec.append(el('h4', 'lr-section-title', '值卦层级与卦变'));
    const hexGrid = el('div', 'hj-hex-grid');

    const chainKeys: Array<[string, string, boolean]> = [
      ['governing', '统卦', false],
      ['yun', '运卦', false],
      ['sixtyYear', '六十年卦', false],
      ['decade', '十年卦', false],
    ];
    for (const [key, label, highlight] of chainKeys) {
      const node = asRecord(hexagrams[key]);
      if (!node) continue;
      const hex = asRecord(node.hexagram) ?? node;
      const start = asNumber(node.startYear);
      const end = asNumber(node.endYear);
      const range = start !== undefined && end !== undefined ? `${start}~${end}` : undefined;
      const derivedFrom = asString(node.derivedFrom);
      const changedLine = asNumber(node.changedLine);
      const derived = derivedFrom && changedLine !== undefined ? `自${derivedFrom}第${changedLine}爻变` : undefined;
      appendHexCard(hexGrid, label, hex, { range, derived, highlight, changedLine });
    }

    const annual = asRecord(hexagrams.annual);
    if (annual) {
      const yr = asNumber(annual.year);
      const gz = asString(annual.ganzhi);
      appendHexCard(hexGrid, '值年卦', annual, {
        range: yr !== undefined ? `${yr}${gz ? ` ${gz}` : ''}` : undefined,
        highlight: true,
      });
    }

    sec.append(hexGrid);
    container.append(sec);
  }

  // 互错综关联卦
  const related = asRecord(forecast?.relatedHexagrams) ?? asRecord(chart.relatedHexagrams) ?? asRecord(data.relatedHexagrams);
  if (related) {
    const relGrid = el('div', 'hj-rel-grid');
    appendHexCard(relGrid, '互卦', asRecord(related.mutual));
    appendHexCard(relGrid, '错卦', asRecord(related.opposite));
    appendHexCard(relGrid, '综卦', asRecord(related.reversed));
    if (relGrid.childElementCount > 0) container.append(relGrid);
  }

  const interpOrder = asArray(reading?.interpretationOrder).map(asString).filter(Boolean).join(' → ');
  const hjMeta = createMetaGrid([
    ['值年重点', asString(reading?.annualFocus)],
  ]);
  if (hjMeta) container.append(hjMeta);

  const cycleCtx = asString(reading?.cycleContext);
  const eraSummary = asString(eraTrend?.summary);
  if (cycleCtx || interpOrder || eraSummary) {
    const hjBar = createBoardDetailBar([
      createBoardModalTrigger(
        '世运脉络与参断次序',
        '皇极经世世运背景与参断次序',
        () => {
          const frag = document.createDocumentFragment();
          if (eraSummary) frag.append(el('p', 'wb-note-box', eraSummary));
          const detailMeta = createMetaGrid([
            ['世运背景', cycleCtx],
            ['参断次序', interpOrder || undefined],
          ]);
          if (detailMeta) frag.append(detailMeta);
          return frag;
        },
      ),
    ]);
    if (hjBar) container.append(hjBar);
  }

  return true;
}

export function renderTaiyiBoard(container: HTMLElement, method: string, rawData: unknown): boolean {
  const data = asRecord(rawData);
  if (!data) return false;
  if (method === 'huangji' || method === 'huangji-jingshi') {
    return renderHuangji(container, data);
  }
  return renderTaiyi(container, data);
}
