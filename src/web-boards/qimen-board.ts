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
import { createMobileDetailSheet, createTermTrigger } from './shared';

const LUOSHU_ORDER = [4, 9, 2, 3, 5, 7, 8, 1, 6] as const;

const QIMEN_DOOR_ELEMENTS: Record<string, string> = {
  休门: '水',
  生门: '土',
  伤门: '木',
  杜门: '木',
  景门: '火',
  死门: '土',
  惊门: '金',
  开门: '金',
};

const QIMEN_AUSPICIOUS_DOORS = new Set(['休门', '生门', '开门']);
const QIMEN_INAUSPICIOUS_DOORS = new Set(['伤门', '死门', '惊门']);

const QIMEN_PALACE_ELEMENTS: Record<number, string> = {
  1: '水',
  2: '土',
  3: '木',
  4: '木',
  5: '土',
  6: '金',
  7: '金',
  8: '土',
  9: '火',
};

const QIMEN_STEM_JIXING_PALACES: Record<string, number[]> = {
  戊: [3],
  己: [2],
  庚: [8],
  辛: [9],
  壬: [4],
  癸: [4],
};

const QIMEN_STEM_RUMU_PALACES: Record<string, number[]> = {
  乙: [2],
  丙: [6],
  丁: [8],
  戊: [6],
  己: [4],
  庚: [2],
  辛: [8],
  壬: [4],
  癸: [4],
};

function checkWuxingKe(a: string, b: string): boolean {
  return (
    (a === '木' && b === '土') ||
    (a === '土' && b === '水') ||
    (a === '水' && b === '火') ||
    (a === '火' && b === '金') ||
    (a === '金' && b === '木')
  );
}

function getStemPalaceStatus(stem: string, gong: number): 'is-xingmu' | 'is-jixing' | 'is-rumu' | '' {
  if (!stem) return '';
  const isXing = Boolean(QIMEN_STEM_JIXING_PALACES[stem]?.includes(gong));
  const isMu = Boolean(QIMEN_STEM_RUMU_PALACES[stem]?.includes(gong));
  if (isXing && isMu) return 'is-xingmu';
  if (isXing) return 'is-jixing';
  if (isMu) return 'is-rumu';
  return '';
}

function calculateAnGanMap(
  palaces: QimenPalaceView[],
  zhiShiDoor: string,
  hourGan: string,
  isYangDun: boolean,
): Map<number, string> {
  const map = new Map<number, string>();
  if (!zhiShiDoor || !hourGan) return map;
  const zhiShiPalace = palaces.find((p) => p.door === zhiShiDoor);
  if (!zhiShiPalace) return map;

  const stemOrder = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'];
  const actualStem = hourGan === '甲' ? '戊' : hourGan;
  const startStemIndex = stemOrder.indexOf(actualStem);
  if (startStemIndex === -1) return map;

  const luoShuSeq = isYangDun ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [9, 8, 7, 6, 5, 4, 3, 2, 1];
  const startGongPos = luoShuSeq.indexOf(zhiShiPalace.gong);
  if (startGongPos === -1) return map;

  for (let i = 0; i < 9; i++) {
    const gong = luoShuSeq[(startGongPos + i) % 9];
    const stem = stemOrder[(startStemIndex + i) % 9];
    map.set(gong, stem);
  }
  return map;
}

interface QimenPalaceView {
  gong: number;
  name: string;
  direction: string;
  element: string;
  god: string;
  star: string;
  companionStar: string;
  tianStem: string;
  companionStem: string;
  diStem: string;
  door: string;
  isVoid: boolean;
  hasHorse: boolean;
  isZhiFu: boolean;
  isZhiShi: boolean;
  isMenPo: boolean;
  stemStatus: 'is-xingmu' | 'is-jixing' | 'is-rumu' | '';
  companionStatus: 'is-xingmu' | 'is-jixing' | 'is-rumu' | '';
  anGan: string;
}

function parseQimenPalace(
  raw: UnknownRecord,
  voidSet: Set<number>,
  horseGong: number | undefined,
  zhiFu: string,
  zhiShi: string,
): QimenPalaceView | undefined {
  const gong = asNumber(raw.gong);
  if (!gong) return undefined;
  const tianPan = asRecord(raw.tianPan);
  const diPan = asRecord(raw.diPan);
  const renPan = asRecord(raw.renPan);
  const shenPan = asRecord(raw.shenPan);
  const star = asString(tianPan?.star) ?? '';
  const companionStar = asString(tianPan?.companionStar) ?? '';
  const tianStem = asString(tianPan?.stem) ?? '';
  const companionStem = asString(tianPan?.companionStem) ?? '';
  const door = asString(renPan?.door) ?? '';
  const god = asString(shenPan?.god) ?? '';
  const doorEl = QIMEN_DOOR_ELEMENTS[door] ?? '';
  const palaceEl = QIMEN_PALACE_ELEMENTS[gong] ?? '';

  return {
    gong,
    name: asString(raw.name) ?? `${gong}宫`,
    direction: asString(raw.direction) ?? '',
    element: asString(raw.element) ?? palaceEl,
    god,
    star,
    companionStar,
    tianStem,
    companionStem,
    diStem: asString(diPan?.stem) ?? '',
    door,
    isVoid: voidSet.has(gong),
    hasHorse: horseGong === gong,
    isZhiFu: Boolean(zhiFu && (star === zhiFu || companionStar === zhiFu || god === '值符')),
    isZhiShi: Boolean(zhiShi && door === zhiShi),
    isMenPo: Boolean(doorEl && palaceEl && checkWuxingKe(doorEl, palaceEl)),
    stemStatus: getStemPalaceStatus(tianStem, gong),
    companionStatus: getStemPalaceStatus(companionStem, gong),
    anGan: '',
  };
}

function getDoorToneClass(door: string): string {
  if (QIMEN_AUSPICIOUS_DOORS.has(door)) return 'is-auspicious';
  if (QIMEN_INAUSPICIOUS_DOORS.has(door)) return 'is-inauspicious';
  return 'is-neutral';
}

const LUOSHU_TRIGRAM_SYMBOL: Record<number, string> = {
  1: '☵',
  2: '☷',
  3: '☳',
  4: '☴',
  5: '☯',
  6: '☰',
  7: '☱',
  8: '☶',
  9: '☲',
};

function renderQimenDetail(
  detailBox: HTMLElement,
  palace: QimenPalaceView,
  insights: Array<{ gong: number; level: string; summary: string }>,
  stemRelations: UnknownRecord[],
  classicPatterns: UnknownRecord[],
  goodDirs: UnknownRecord[],
  avoidDirs: UnknownRecord[],
) {
  detailBox.replaceChildren();
  const head = el('div', 'qm-detail-head');
  const triSym = LUOSHU_TRIGRAM_SYMBOL[palace.gong] ?? '';
  head.append(
    el(
      'strong',
      'qm-detail-title',
      `${triSym ? `${triSym} ` : ''}${palace.name}（${palace.direction || '中央'} · 五行${palace.element || '土'}）`,
    ),
  );

  const flags = [
    palace.isZhiFu ? { text: '值符', cls: 'wb-badge-accent' } : null,
    palace.isZhiShi ? { text: '值使', cls: 'wb-badge-good' } : null,
    palace.isVoid ? { text: '空亡', cls: 'wb-badge-warn' } : null,
    palace.hasHorse ? { text: '驿马', cls: 'wb-badge-accent' } : null,
    palace.isMenPo ? { text: '门迫', cls: 'wb-badge-warn' } : null,
    palace.stemStatus === 'is-xingmu'
      ? { text: '刑墓', cls: 'wb-badge-warn' }
      : palace.stemStatus === 'is-jixing'
        ? { text: '击刑', cls: 'wb-badge-warn' }
        : palace.stemStatus === 'is-rumu'
          ? { text: '入墓', cls: 'wb-badge-warn' }
          : null,
  ].filter((x): x is { text: string; cls: string } => Boolean(x));

  if (flags.length > 0) {
    const flagWrap = el('div', 'wb-badges');
    for (const f of flags) {
      flagWrap.append(el('span', `wb-badge ${f.cls}`, f.text));
    }
    head.append(flagWrap);
  }
  detailBox.append(head);

  const starText = palace.companionStar ? `${palace.star}/${palace.companionStar}` : palace.star;
  const tianText = palace.companionStem ? `${palace.tianStem}/${palace.companionStem}` : palace.tianStem;
  const palaceStemRels = stemRelations.filter((sr) => asNumber(sr.gong) === palace.gong);
  const stemRelText = palaceStemRels
    .map((sr) => `${asString(sr.heavenStem) ?? ''}+${asString(sr.earthStem) ?? ''}：${asString(sr.pattern) ?? asString(sr.relation) ?? ''}`)
    .filter(Boolean)
    .join('；');
  const palaceGoodDir = goodDirs.find((d) => asNumber(d.gong) === palace.gong);
  const palaceAvoidDir = avoidDirs.find((d) => asNumber(d.gong) === palace.gong);
  const dirEval = palaceGoodDir
    ? `宜行（${asString(palaceGoodDir.use) ?? ''}：${asArray(palaceGoodDir.reasons).map(asString).filter(Boolean).join('、')}）`
    : palaceAvoidDir
      ? `宜避（${asArray(palaceAvoidDir.reasons).map(asString).filter(Boolean).join('、')}）`
      : undefined;

  const grid = createMetaGrid([
    ['八神', palace.god || (palace.gong === 5 ? '中五寄坤二' : '—')],
    ['九星', starText || '—'],
    ['八门', palace.door || '—'],
    ['天盘干', tianText || '—'],
    ['地盘干', palace.diStem || '—'],
    ['暗干', palace.anGan || undefined],
    ['十干克应', stemRelText || undefined],
    ['方位参考', dirEval],
  ]);
  if (grid) detailBox.append(grid);

  const palacePatterns = classicPatterns.filter((cp) =>
    asArray(cp.palaces).some((g) => asNumber(g) === palace.gong),
  );
  if (palacePatterns.length > 0) {
    const pWrap = el('div', 'wb-chip-wrap');
    pWrap.style.marginTop = '8px';
    for (const cp of palacePatterns) {
      const tp = asString(cp.type);
      pWrap.append(
        el(
          'span',
          `wb-badge ${tp === 'good' ? 'wb-badge-good' : tp === 'bad' ? 'wb-badge-warn' : 'wb-badge-neutral'}`,
          `${asString(cp.name) ?? '格局'}${asString(cp.summary) ? `：${asString(cp.summary)}` : ''}`,
        ),
      );
    }
    detailBox.append(pWrap);
  }

  const lookupCandidates = [
    palace.god,
    palace.star,
    palace.companionStar,
    palace.door,
    ...flags.map((f) => f.text),
  ].filter((x): x is string => Boolean(x && x !== '—'));
  if (lookupCandidates.length > 0) {
    const termRow = el('div', 'wb-chip-wrap');
    termRow.style.marginTop = '8px';
    for (const termName of new Set(lookupCandidates)) {
      termRow.append(createTermTrigger(termName, termName, 'wb-badge wb-badge-neutral'));
    }
    detailBox.append(termRow);
  }

  const palaceInsights = insights.filter((item) => item.gong === palace.gong);
  if (palaceInsights.length > 0) {
    const list = el('ul', 'qm-insight-list');
    for (const item of palaceInsights) {
      const li = el('li', 'qm-insight-item');
      li.append(el('span', `qm-insight-level qm-level-${item.level === '有利' ? 'good' : item.level === '风险' ? 'warn' : 'neutral'}`, item.level));
      li.append(el('span', 'qm-insight-text', item.summary));
      list.append(li);
    }
    detailBox.append(list);
  }
}

function renderQimen(container: HTMLElement, data: UnknownRecord): boolean {
  const jiuGongGe = asArray(data.jiuGongGe);
  if (jiuGongGe.length === 0) return false;

  const isYang = data.isYangDun === true;
  const juShu = asNumber(data.juShu);
  const zhiFu = asString(data.zhiFu) ?? '';
  const zhiShi = asString(data.zhiShi) ?? '';
  const timeInfo = asRecord(data.timeInfo);
  const ganzhi = asRecord(data.ganzhi);
  const horseStar = asRecord(data.horseStar);
  const horseGong = asNumber(horseStar?.palace);

  const voidSet = new Set<number>();
  for (const vp of asArray(data.voidPalaces)) {
    const g = asNumber(asRecord(vp)?.palace);
    if (g) voidSet.add(g);
  }
  const voidBranches = asArray(data.voidBranches).map(asString).filter((x): x is string => Boolean(x));

  const palaceMap = new Map<number, QimenPalaceView>();
  for (const item of jiuGongGe) {
    const rec = asRecord(item);
    if (!rec) continue;
    const parsed = parseQimenPalace(rec, voidSet, horseGong, zhiFu, zhiShi);
    if (parsed) palaceMap.set(parsed.gong, parsed);
  }
  if (palaceMap.size === 0) return false;

  const hourGan = (asString(ganzhi?.hour) ?? '').slice(0, 1);
  const anGanMap = calculateAnGanMap([...palaceMap.values()], zhiShi, hourGan, isYang);
  for (const [gong, anGan] of anGanMap) {
    const p = palaceMap.get(gong);
    if (p) p.anGan = anGan;
  }

  const insights = asArray(data.palaceInsights)
    .map((item) => {
      const rec = asRecord(item);
      const gong = asNumber(rec?.gong);
      const summary = asString(rec?.summary);
      if (!gong || !summary) return undefined;
      return { gong, level: asString(rec?.level) ?? '关注', summary };
    })
    .filter((x): x is { gong: number; level: string; summary: string } => Boolean(x));

  const stemRelations = asArray(data.stemRelations).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  const classicPatterns = asArray(data.classicPatterns).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  const dirs = asRecord(data.directions);
  const goodDirsList = asArray(dirs?.goodDirections).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  const avoidDirsList = asArray(dirs?.avoidDirections).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));

  const title = `${isYang ? '阳遁' : '阴遁'}${juShu ?? ''}局 · 奇门九宫`;
  const subtitleParts = [
    asString(timeInfo?.solarTerm),
    asString(timeInfo?.epoch),
    asString(timeInfo?.fuTou) ? `符头${asString(timeInfo?.fuTou)}` : undefined,
    ganzhi ? `${asString(ganzhi.year) ?? ''} ${asString(ganzhi.month) ?? ''} ${asString(ganzhi.day) ?? ''} ${asString(ganzhi.hour) ?? ''}`.trim() : undefined,
  ].filter(Boolean);

  container.append(
    createBoardHeader(title, subtitleParts.join(' · '), [
      zhiFu ? { text: `值符 ${zhiFu}`, tone: 'accent' } : { text: '' },
      zhiShi ? { text: `值使 ${zhiShi}`, tone: 'good' } : { text: '' },
      voidBranches.length > 0 ? { text: `空亡 ${voidBranches.join('')}`, tone: 'warn' } : { text: '' },
      horseStar && asString(horseStar.name) ? { text: `马星 ${asString(horseStar.name)}`, tone: 'neutral' } : { text: '' },
    ]),
  );

  const grid = el('div', 'qm-grid');
  grid.setAttribute('role', 'group');
  grid.setAttribute('aria-label', '奇门遁甲洛书九宫格');

  const detailBox = el('div', 'qm-detail-card');
  const detailSheet = createMobileDetailSheet(detailBox, { label: '奇门宫位详情' });
  const buttons = new Map<number, HTMLButtonElement>();
  const defaultGong =
    [...palaceMap.values()].find((p) => p.isZhiFu)?.gong ??
    [...palaceMap.values()][0]?.gong ??
    5;

  const selectPalace = (gong: number, openSheet = false) => {
    const target = palaceMap.get(gong);
    if (!target) return;
    for (const [g, btn] of buttons) {
      const active = g === gong;
      btn.classList.toggle('is-selected', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
    renderQimenDetail(detailBox, target, insights, stemRelations, classicPatterns, goodDirsList, avoidDirsList);
    if (openSheet) detailSheet.open();
  };

  for (const gong of LUOSHU_ORDER) {
    const p = palaceMap.get(gong);
    const btn = el('button', 'qm-palace');
    btn.type = 'button';
    if (!p) {
      btn.disabled = true;
      btn.append(el('span', 'qm-palace-name', `${gong}宫`));
      grid.append(btn);
      continue;
    }
    if (gong === 5) btn.classList.add('is-center');
    if (p.isVoid) btn.classList.add('is-void');
    if (p.hasHorse) btn.classList.add('is-horse');

    // 左上角八神（值符高亮） + 右上角暗干/空亡/驿马/值使标
    const topRow = el('div', 'qm-cell-top');
    const godEl = el('span', `qm-god${p.isZhiFu || p.god === '值符' ? ' is-zhifu' : ''}`, p.god || (gong === 5 ? '中宫' : '—'));
    topRow.append(godEl);

    const markers = el('span', 'qm-markers');
    if (p.anGan) markers.append(el('i', 'qm-tag is-angan', `暗${p.anGan}`));
    if (p.isZhiShi) markers.append(el('i', 'qm-tag is-shi', '使'));
    if (p.isVoid) markers.append(el('i', 'qm-tag is-void', '空'));
    if (p.hasHorse) markers.append(el('i', 'qm-tag is-horse', '马'));
    topRow.append(markers);

    // 中上：天盘星干（含寄星寄干与击刑/入墓）
    const midRow = el('div', 'qm-cell-mid');
    const starEl = el('span', `qm-star${p.isZhiFu ? ' is-zhifu' : ''}`);
    starEl.append(p.star || '—');
    if (p.companionStar) {
      starEl.append(el('em', 'qm-companion', `/${p.companionStar}`));
    }

    const tianEl = el('span', `qm-stem qm-tian-stem ${p.stemStatus}`.trim());
    tianEl.append(p.tianStem || '—');
    if (p.companionStem) {
      tianEl.append(el('em', `qm-companion ${p.companionStatus}`.trim(), `/${p.companionStem}`));
    }
    midRow.append(starEl, tianEl);

    // 下排：左下八门（吉门/凶门区分标色 + 值使/门迫） + 右下地盘干与宫位名（带八卦符）
    const botRow = el('div', 'qm-cell-bot');
    const doorCls = [
      'qm-door',
      p.door ? getDoorToneClass(p.door) : '',
      p.isZhiShi ? 'is-zhishi' : '',
      p.isMenPo ? 'is-menpo' : '',
    ]
      .filter(Boolean)
      .join(' ');
    botRow.append(el('span', doorCls, p.door || (gong === 5 ? '寄坤二' : '—')));

    const rightBottom = el('div', 'qm-di-palace');
    if (p.isMenPo || p.stemStatus) {
      const harm = p.isMenPo ? '迫' : p.stemStatus === 'is-xingmu' ? '刑墓' : p.stemStatus === 'is-jixing' ? '刑' : '墓';
      const harmCls = p.isMenPo ? 'is-menpo' : p.stemStatus;
      rightBottom.append(el('span', `qm-harm-pill ${harmCls}`, harm));
    }
    rightBottom.append(el('span', 'qm-stem qm-di-stem', p.diStem || '—'));
    const triSym = LUOSHU_TRIGRAM_SYMBOL[gong] ?? '';
    rightBottom.append(el('span', 'qm-palace-name', `${triSym}${p.name.replace('宫', '')}`));
    botRow.append(rightBottom);

    btn.append(topRow, midRow, botRow);
    btn.addEventListener('click', () => selectPalace(gong, true));
    buttons.set(gong, btn);
    grid.append(btn);
  }

  // 图例条
  const legend = el('div', 'qm-legend');
  legend.append(
    el('span', 'qm-legend-item is-auspicious', '吉门：开/休/生'),
    el('span', 'qm-legend-item is-inauspicious', '凶门：伤/死/惊'),
    el('span', 'qm-legend-item is-jixing', '紫：击刑'),
    el('span', 'qm-legend-item is-rumu', '橙：入墓'),
    el('span', 'qm-legend-item is-menpo', '红：门迫'),
  );

  container.append(grid, legend, detailSheet.element);
  selectPalace(defaultGong);

  // 展示引擎已计算出的局象特征与十干克应经典格局
  const patternDetails = asArray(data.patternDetails).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  const specialCond = asRecord(data.specialConditions);

  if (patternDetails.length > 0 || classicPatterns.length > 0 || asString(specialCond?.description)) {
    const patSec = el('div', 'lr-section qm-patterns-section');
    patSec.append(el('h4', 'lr-section-title', '局象特征与十干克应格局'));

    if (asString(specialCond?.description)) {
      patSec.append(el('p', 'wb-note-box', asString(specialCond?.description)));
    }

    if (patternDetails.length > 0 || classicPatterns.length > 0) {
      const list = el('div', 'wb-computed-list');
      for (const pd of patternDetails.slice(0, 6)) {
        const card = el('div', 'wb-computed-item');
        card.append(el('strong', 'wb-computed-title', asString(pd.tag) ?? '局象'));
        if (asString(pd.summary)) card.append(el('p', 'wb-computed-desc', asString(pd.summary)));
        list.append(card);
      }
      for (const cp of classicPatterns.slice(0, 8)) {
        const tp = asString(cp.type);
        const card = el('div', `wb-computed-item ${tp === 'good' ? 'is-good' : tp === 'bad' ? 'is-bad' : ''}`.trim());
        card.append(el('strong', 'wb-computed-title', asString(cp.name) ?? '十干格局'));
        if (asString(cp.summary)) card.append(el('p', 'wb-computed-desc', asString(cp.summary)));
        list.append(card);
      }
      patSec.append(list);
    }
    container.append(patSec);
  }

  // 补充展示应期、方位吉凶、月令旺相与星门组合
  const patternCombos = asArray(data.patternCombos).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  const yingQi = asRecord(data.yingQi);
  const seasonality = asRecord(data.seasonality);

  const extraPairs: Array<[string, string | undefined]> = [];
  if (yingQi) {
    const yqDesc = asString(yingQi.summary) ?? asString(yingQi.description) ?? asArray(yingQi.candidates).map(asString).filter(Boolean).join('、');
    if (yqDesc) extraPairs.push(['应期参考', yqDesc]);
  }
  if (seasonality) {
    const seasonStr = [
      asString(seasonality.currentJieQi) ? `节气${asString(seasonality.currentJieQi)}` : '',
      asString(seasonality.seasonalElement) ? `${asString(seasonality.seasonalElement)}旺令` : '',
      asString(seasonality.seasonRelationDescription),
      asString(seasonality.lunarPhase),
      asString(seasonality.dayOfficer) ? `${asString(seasonality.dayOfficer)}日` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    if (seasonStr) extraPairs.push(['月令节气', seasonStr]);
  }
  if (dirs) {
    const goodDirs = [
      ...asArray(dirs.auspicious).map(asString),
      ...goodDirsList.map((rec) => `${asString(rec.name) ?? ''}（${asString(rec.direction) ?? ''}·${asString(rec.use) ?? ''}）`),
    ]
      .filter(Boolean)
      .join('、');
    const badDirs = [
      ...asArray(dirs.inauspicious).map(asString),
      ...avoidDirsList.map((rec) => `${asString(rec.name) ?? ''}（${asString(rec.direction) ?? ''}）`),
      ...asArray(dirs.badDirections).map((d) => {
        const rec = asRecord(d);
        return rec ? `${asString(rec.name) ?? ''}（${asString(rec.direction) ?? ''}）` : asString(d);
      }),
    ]
      .filter(Boolean)
      .join('、');
    if (goodDirs) extraPairs.push(['吉利方位', goodDirs]);
    if (badDirs) extraPairs.push(['忌避方位', badDirs]);
  }
  if (patternCombos.length > 0) {
    extraPairs.push([
      '星门神仪组合',
      patternCombos
        .slice(0, 6)
        .map((c) => asString(c.name) ?? asString(c.summary))
        .filter(Boolean)
        .join('；'),
    ]);
  }
  const extraMeta = createMetaGrid(extraPairs);
  if (extraMeta) container.append(extraMeta);

  return true;
}

function getXkStarTimeliness(star: number | undefined, yun: number | undefined): { label: string; cls: string } | undefined {
  if (!star || !yun) return undefined;
  if (star === yun) return { label: '旺', cls: 'is-wang' };
  const next1 = (yun % 9) + 1;
  const next2 = ((yun + 1) % 9) + 1;
  if (star === next1 || star === next2) return { label: '生', cls: 'is-sheng' };
  if (star === 5) return { label: '煞', cls: 'is-sha' };
  if (star === 2) return { label: '病', cls: 'is-sha' };
  return { label: '退', cls: 'is-tui' };
}

function renderXuankong(container: HTMLElement, data: UnknownRecord): boolean {
  const charts = asArray(data.charts);
  const chart = asRecord(charts[0]);
  if (!chart) return false;
  const palaces = asArray(chart.palaces).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  if (palaces.length === 0) return false;

  const period = asRecord(chart.period);
  const yunNum = asNumber(period?.yun);
  const sit = asString(chart.sitMountain) ?? '';
  const facing = asString(chart.facingMountain) ?? '';
  const formation = asString(chart.formation) ?? '';
  const mode = asString(chart.mode) ?? '';
  const arrival = asRecord(chart.arrival);
  const combinations = asArray(chart.combinations).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));

  const combosByPalaceKey = new Map<string, UnknownRecord[]>();
  for (const c of combinations) {
    for (const pk of asArray(c.palaces).map(asString)) {
      if (!pk) continue;
      const list = combosByPalaceKey.get(pk) ?? [];
      list.push(c);
      combosByPalaceKey.set(pk, list);
    }
  }

  const byEarth = new Map<number, UnknownRecord>();
  for (const p of palaces) {
    const earth = asNumber(p.earth);
    if (earth) byEarth.set(earth, p);
  }

  const headerBadges: Array<{ text: string; tone?: 'accent' | 'neutral' | 'good' | 'warn' }> = [];
  if (formation) {
    headerBadges.push({
      text: formation,
      tone: formation.includes('旺山旺向') || formation.includes('双星') ? 'good' : 'accent',
    });
  }
  if (mode) headerBadges.push({ text: mode, tone: 'neutral' });
  if (chart.replacementApplied === true) headerBadges.push({ text: '已用替卦', tone: 'warn' });

  container.append(
    createBoardHeader(
      `玄空飞星盘 · ${sit ? `${sit}山${facing}向` : '九宫飞星'}`,
      [
        period ? `${asString(period.yuan) ?? ''}${yunNum ?? ''}运（${asNumber(period.startYear) ?? ''}-${asNumber(period.endYear) ?? ''}）` : '',
        asString(data.periodBoundary),
      ].filter(Boolean).join(' · '),
      headerBadges,
    ),
  );

  const grid = el('div', 'qm-grid xk-grid');
  const detailBox = el('div', 'qm-detail-card');
  const detailSheet = createMobileDetailSheet(detailBox, { label: '玄空宫位详情' });
  const buttons = new Map<number, HTMLButtonElement>();

  const selectEarth = (earth: number, openSheet = false) => {
    const p = byEarth.get(earth);
    if (!p) return;
    for (const [e, btn] of buttons) {
      const active = e === earth;
      btn.classList.toggle('is-selected', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
    detailBox.replaceChildren();
    const pKey = asString(p.key) ?? '';
    const mStarNum = asNumber(p.mountain);
    const wStarNum = asNumber(p.water);
    const mTime = getXkStarTimeliness(mStarNum, yunNum);
    const wTime = getXkStarTimeliness(wStarNum, yunNum);
    const pCombos = combosByPalaceKey.get(pKey) ?? [];

    const head = el('div', 'qm-detail-head');
    head.append(
      el(
        'strong',
        'qm-detail-title',
        `${LUOSHU_TRIGRAM_SYMBOL[earth] ?? ''} ${asString(p.name) ?? ''}宫（${asString(p.direction) ?? ''} · 地盘${earth}）`,
      ),
    );
    detailBox.append(head);

    const meta = createMetaGrid([
      ['山星（丁星）', mStarNum !== undefined ? `${mStarNum}${mTime ? `（${mTime.label}气）` : ''}` : '—'],
      ['向星（财星）', wStarNum !== undefined ? `${wStarNum}${wTime ? `（${wTime.label}气）` : ''}` : '—'],
      ['运星', String(asNumber(p.period) ?? '—')],
      ['流年飞星', asNumber(p.yearStar) !== undefined ? String(asNumber(p.yearStar)) : '—'],
      ['流月飞星', asNumber(p.monthStar) !== undefined ? String(asNumber(p.monthStar)) : '—'],
      ['流日飞星', asNumber(p.dayStar) !== undefined ? String(asNumber(p.dayStar)) : '—'],
      ...(asNumber(p.hourStar) !== undefined ? [['流时飞星', String(asNumber(p.hourStar))] as [string, string]] : []),
    ]);
    if (meta) detailBox.append(meta);

    if (pCombos.length > 0) {
      const cList = el('div', 'wb-computed-list');
      cList.style.marginTop = '8px';
      for (const c of pCombos) {
        const item = el('div', `wb-computed-item ${asString(c.kind) === 'auspicious' ? 'is-good' : 'is-bad'}`);
        item.append(el('strong', 'wb-computed-title', asString(c.name) ?? '挨星组合'));
        if (asString(c.note)) item.append(el('p', 'wb-computed-desc', asString(c.note)));
        cList.append(item);
      }
      detailBox.append(cList);
    }
    if (openSheet) detailSheet.open();
  };

  for (const earth of LUOSHU_ORDER) {
    const p = byEarth.get(earth);
    const btn = el('button', 'qm-palace xk-palace');
    btn.type = 'button';
    if (!p) {
      btn.disabled = true;
      grid.append(btn);
      continue;
    }
    if (earth === 5) btn.classList.add('is-center');

    const mStar = asNumber(p.mountain);
    const wStar = asNumber(p.water);
    const mT = getXkStarTimeliness(mStar, yunNum);
    const wT = getXkStarTimeliness(wStar, yunNum);

    // 传统玄空九宫位：左上山星 / 右上向星
    const top = el('div', 'qm-cell-top xk-top-stars');
    const shanEl = el('span', `xk-star-shan ${mT?.cls ?? ''}`.trim());
    shanEl.append(`山${mStar ?? '—'}`);
    if (mT) shanEl.append(el('sup', 'xk-star-sup', mT.label));
    const xiangEl = el('span', `xk-star-xiang ${wT?.cls ?? ''}`.trim());
    xiangEl.append(`向${wStar ?? '—'}`);
    if (wT) xiangEl.append(el('sup', 'xk-star-sup', wT.label));
    top.append(shanEl, xiangEl);

    // 中央：运星大字 + 组合徽标
    const mid = el('div', 'xk-cell-mid');
    mid.append(el('span', 'xk-star-yun', String(asNumber(p.period) ?? earth)));
    const pCombos = combosByPalaceKey.get(asString(p.key) ?? '') ?? [];
    if (pCombos.length > 0) {
      const firstC = pCombos[0];
      mid.append(
        el(
          'span',
          `xk-combo-pill ${asString(firstC.kind) === 'auspicious' ? 'is-good' : 'is-warn'}`,
          asString(firstC.name)?.replace(/（.*）/u, '') ?? '',
        ),
      );
    }

    // 底部：宫名卦象方位 + 流年流月飞星
    const foot = el('div', 'qm-cell-foot');
    foot.append(el('span', 'qm-palace-name', `${LUOSHU_TRIGRAM_SYMBOL[earth] ?? ''}${asString(p.name) ?? ''}·${earth}`));
    const yStar = asNumber(p.yearStar);
    const mFly = asNumber(p.monthStar);
    const dFly = asNumber(p.dayStar);
    const hFly = asNumber(p.hourStar);
    const ymText = [
      yStar !== undefined ? `年${yStar}` : '',
      mFly !== undefined ? `月${mFly}` : '',
      dFly !== undefined ? `日${dFly}` : '',
      hFly !== undefined ? `时${hFly}` : '',
    ]
      .filter(Boolean)
      .join(' ');
    if (ymText) {
      foot.append(el('span', 'qm-palace-dir', ymText));
    }

    btn.append(top, mid, foot);
    btn.addEventListener('click', () => selectEarth(earth, true));
    buttons.set(earth, btn);
    grid.append(btn);
  }

  container.append(grid, detailSheet.element);
  selectEarth(5);

  const castleGate = asRecord(chart.castleGate);
  const cgCandidates = asArray(castleGate?.candidates).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  const cgText = cgCandidates.length > 0
    ? cgCandidates
        .map(
          (c) =>
            `${asString(c.role) ?? ''}：${asString(c.mountain) ?? ''}（${asString(c.gongName) ?? ''}宫·运星${asNumber(c.yunStar) ?? ''}${asString(c.flyDirection) ?? ''}→到星${asNumber(c.arrivalStar) ?? ''}，${asString(c.status) ?? ''}）`,
        )
        .join('；')
    : undefined;

  const arrivalText = arrival
    ? `山星${arrival.shanToMountain ? '到山' : '未到山'} · 向星${arrival.xiangToFacing ? '到向' : '未到向'}`
    : undefined;
  const comboText = combinations
    .slice(0, 6)
    .map((c) => `${asString(c.name) ?? ''}${asString(c.note) ? `（${asString(c.note)}）` : ''}`)
    .filter(Boolean)
    .join('；');

  const xkMeta = createMetaGrid([
    ['宅局与替卦', [formation, mode, chart.replacementApplied ? '已用替卦' : '下卦顺逆'].filter(Boolean).join(' · ') || undefined],
    ['到山到向', arrivalText],
    ['城门诀推演', cgText],
    ['全盘挨星格局', comboText || '常规山向飞布（无单宫反伏吟或合十）'],
  ]);
  if (xkMeta) container.append(xkMeta);

  return true;
}

const LUOSHU_DIR_BY_EARTH: Record<number, string> = {
  4: '东南',
  9: '南',
  2: '西南',
  3: '东',
  5: '中',
  7: '西',
  8: '东北',
  1: '北',
  6: '西北',
};

/**
 * 渲染真正合参融合的「阳宅风水 · 八宅玄空合参九宫盘」：
 * 同一洛书九宫格内同步显示每宫的山星/向星/运星/流年流月与八宅命/宅游年吉凶，不再上下堆叠两张独立大盘。
 */
export function renderResidentialBoard(container: HTMLElement, data: UnknownRecord): boolean {
  const bazhaiRec = asRecord(data.bazhai);
  const xuankongRec = asRecord(data.xuankong);
  const agreements = asArray(data.agreements)
    .map(asRecord)
    .filter((x): x is UnknownRecord => Boolean(x));
  const advice = asArray(data.advice)
    .map(asString)
    .filter((x): x is string => Boolean(x));

  const xkCharts = asArray(xuankongRec?.charts);
  const xkChart = asRecord(xkCharts[0]);
  const xkPalaces = asArray(xkChart?.palaces)
    .map(asRecord)
    .filter((x): x is UnknownRecord => Boolean(x));

  const bzPersons = asArray(bazhaiRec?.persons)
    .map(asRecord)
    .filter((x): x is UnknownRecord => Boolean(x));
  const bzHouses = asArray(bazhaiRec?.houses)
    .map(asRecord)
    .filter((x): x is UnknownRecord => Boolean(x));
  const bzComparisons = asArray(bazhaiRec?.comparisons)
    .map(asRecord)
    .filter((x): x is UnknownRecord => Boolean(x));
  const bzMingPalaces = asArray(bazhaiRec?.mingPalaces)
    .map(asRecord)
    .filter((x): x is UnknownRecord => Boolean(x));

  if (xkPalaces.length === 0 && bzComparisons.length === 0 && bzPersons.length === 0) {
    return false;
  }

  const xkByEarth = new Map<number, UnknownRecord>();
  for (const p of xkPalaces) {
    const earth = asNumber(p.earth);
    if (earth) xkByEarth.set(earth, p);
  }

  const comp = bzComparisons[0];
  const person = bzPersons[0];
  const house = bzHouses[0];
  const mingGua = asString(comp?.mingGua) ?? asString(person?.gua) ?? '';
  const mingGroup = asString(comp?.mingGroup) ?? asString(person?.group) ?? '';
  const houseGua = asString(comp?.houseGua) ?? asString(house?.houseGua) ?? '';
  const houseGroup = asString(comp?.houseGroup) ?? '';
  const match = asString(comp?.match) ?? '';

  const bzDirMap = new Map<string, UnknownRecord>();
  for (const d of asArray(comp?.directions)
    .map(asRecord)
    .filter((x): x is UnknownRecord => Boolean(x))) {
    const k = asString(d.direction);
    if (k) bzDirMap.set(k, d);
  }
  const bzStarMap = new Map<string, UnknownRecord>();
  for (const s of asArray(bzMingPalaces[0]?.starPalaces)
    .map(asRecord)
    .filter((x): x is UnknownRecord => Boolean(x))) {
    const k = asString(s.direction);
    if (k) bzStarMap.set(k, s);
  }

  const period = asRecord(xkChart?.period);
  const sit = asString(xkChart?.sitMountain) ?? asString(house?.sitMountain) ?? '';
  const facing = asString(xkChart?.facingMountain) ?? asString(house?.facingMountain) ?? '';
  const formation = asString(xkChart?.formation) ?? '';
  const xkMode = asString(xkChart?.mode) ?? '';
  const personYear = asNumber(person?.year);
  const personGender = asString(person?.gender);

  const badges: Array<{ text: string; tone?: 'accent' | 'neutral' | 'good' | 'warn' }> = [];
  if (mingGua) badges.push({ text: `命卦 ${mingGua}${mingGroup ? `·${mingGroup}` : ''}`, tone: 'accent' });
  if (houseGua) badges.push({ text: `宅卦 ${houseGua}${houseGroup ? `·${houseGroup}` : ''}`, tone: 'neutral' });
  if (match) badges.push({ text: match, tone: match === '同组' ? 'good' : 'warn' });
  if (formation) badges.push({ text: formation, tone: 'accent' });

  const subParts = [
    sit && facing ? `坐${sit}向${facing}` : '',
    period
      ? `${asString(period.yuan) ?? ''}${asNumber(period.yun) ?? ''}运（${asNumber(period.startYear) ?? ''}-${asNumber(period.endYear) ?? ''}）`
      : '',
    xkMode,
    personYear !== undefined
      ? `宅主 ${personYear}年${personGender === 'female' ? '女' : personGender === 'male' ? '男' : ''}`
      : '',
  ].filter(Boolean);

  container.append(
    createBoardHeader('阳宅风水 · 八宅玄空合参九宫盘', subParts.join(' · ') || undefined, badges),
  );

  if (advice.length > 0 || agreements.length > 0) {
    const note = el('div', 'wb-note-box');
    const summaryText = advice.length > 0 ? advice.join(' ') : agreements.map((a) => `${asString(a.title) ?? ''}：${asString(a.detail) ?? ''}`).join(' ');
    note.append(summaryText);
    container.append(note);
  }

  const grid = el('div', 'qm-grid rs-merged-grid');
  const detailBox = el('div', 'qm-detail-card');
  const detailSheet = createMobileDetailSheet(detailBox, { label: '宫位八宅玄空合参详情' });
  const buttons = new Map<number, HTMLButtonElement>();

  const selectEarth = (earth: number, openSheet = false) => {
    const dir = LUOSHU_DIR_BY_EARTH[earth] ?? '';
    const xp = xkByEarth.get(earth);
    const bz = bzDirMap.get(dir);
    const st = bzStarMap.get(dir);
    if (!xp && !bz && earth !== 5) return;

    for (const [e, btn] of buttons) {
      const active = e === earth;
      btn.classList.toggle('is-selected', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    }

    detailBox.replaceChildren();
    const head = el('div', 'qm-detail-head');
    const palaceLabel = xp
      ? `${asString(xp.name) ?? ''}宫（${dir} · 地盘${earth}）`
      : `${dir === '中' ? '中宫' : `${dir}方`}（地盘${earth}${asString(bz?.gua) ? ` · ${asString(bz?.gua)}卦` : ''}）`;
    head.append(el('strong', 'qm-detail-title', palaceLabel));
    detailBox.append(head);

    const pairs: Array<[string, string | undefined]> = [];
    if (earth === 5) {
      if (mingGua || houseGua) pairs.push(['宅命合参', `命卦${mingGua || '—'} · 宅卦${houseGua || '—'}${match ? `（${match}）` : ''}`]);
    } else if (bz) {
      pairs.push(['八宅命卦游年', `${asString(bz.ming) ?? '—'}（${asString(bz.mingLuck) ?? '—'}）`]);
      pairs.push(['八宅宅卦游年', `${asString(bz.house) ?? '—'}（${asString(bz.houseLuck) ?? '—'}）`]);
      if (asString(st?.star) || asString(st?.relation)) {
        pairs.push(['星宫生克', [asString(st?.star), asString(st?.relation)].filter(Boolean).join(' · ')]);
      }
    }
    if (xp) {
      pairs.push(['玄空山向运星', `山星 ${asNumber(xp.mountain) ?? '—'} · 向星 ${asNumber(xp.water) ?? '—'} · 运星 ${asNumber(xp.period) ?? '—'}`]);
      const flowParts: string[] = [];
      if (asNumber(xp.yearStar) !== undefined) flowParts.push(`流年 ${asNumber(xp.yearStar)}`);
      if (asNumber(xp.monthStar) !== undefined) flowParts.push(`流月 ${asNumber(xp.monthStar)}`);
      if (asNumber(xp.dayStar) !== undefined) flowParts.push(`流日 ${asNumber(xp.dayStar)}`);
      if (asNumber(xp.hourStar) !== undefined) flowParts.push(`流时 ${asNumber(xp.hourStar)}`);
      if (flowParts.length > 0) {
        pairs.push([flowParts.length > 1 ? '流转飞星' : '流年飞星', flowParts.join(' · ')]);
      }
    }
    const meta = createMetaGrid(pairs);
    if (meta) detailBox.append(meta);
    const termCandidates = [
      asString(bz?.ming),
      asString(bz?.house),
      asString(st?.star),
    ].filter((x): x is string => Boolean(x));
    if (termCandidates.length > 0) {
      const termRow = el('div', 'wb-chip-wrap');
      termRow.style.marginTop = '8px';
      for (const termName of new Set(termCandidates)) {
        termRow.append(createTermTrigger(termName, termName, 'wb-badge wb-badge-neutral'));
      }
      detailBox.append(termRow);
    }
    if (openSheet) detailSheet.open();
  };

  for (const earth of LUOSHU_ORDER) {
    const dir = LUOSHU_DIR_BY_EARTH[earth] ?? '';
    const xp = xkByEarth.get(earth);
    const bz = bzDirMap.get(dir);
    const st = bzStarMap.get(dir);
    const mingLuck = asString(bz?.mingLuck) ?? '';
    const houseLuck = asString(bz?.houseLuck) ?? '';

    const btn = el('button', 'qm-palace xk-palace rs-palace');
    btn.type = 'button';
    if (earth === 5) {
      btn.classList.add('is-center');
    } else if (mingLuck === '吉') {
      btn.classList.add('is-good');
    } else if (mingLuck === '凶') {
      btn.classList.add('is-warn');
    }

    const top = el('div', 'qm-cell-top');
    const palaceGua = asString(bz?.gua) ?? asString(xp?.name) ?? '';
    top.append(el('span', 'qm-palace-name', earth === 5 ? `中宫·${earth}` : `${dir}·${palaceGua}${earth}`));
    if (xp) {
      top.append(
        el(
          'span',
          'rs-xk-Pair',
          `山${asNumber(xp.mountain) ?? '—'} 向${asNumber(xp.water) ?? '—'}`,
        ),
      );
    }

    const mid = el('div', 'rs-palace-mid');
    if (earth === 5) {
      const centerTag = el('strong', 'rs-center-summary', `命${mingGua || '—'} · 宅${houseGua || '—'}`);
      mid.append(centerTag);
      if (xp) {
        const starTail = [
          asNumber(xp.yearStar) !== undefined ? `年${asNumber(xp.yearStar)}` : '',
          asNumber(xp.monthStar) !== undefined ? `月${asNumber(xp.monthStar)}` : '',
          asNumber(xp.dayStar) !== undefined ? `日${asNumber(xp.dayStar)}` : '',
          asNumber(xp.hourStar) !== undefined ? `时${asNumber(xp.hourStar)}` : '',
        ]
          .filter(Boolean)
          .join(' ');
        mid.append(
          el(
            'span',
            'rs-yun-sub',
            `运${asNumber(xp.period) ?? earth}${starTail ? ` · ${starTail}` : ''}`,
          ),
        );
      }
    } else {
      if (xp) {
        const starLine = el('div', 'rs-xk-row');
        const starTail = [
          asNumber(xp.yearStar) !== undefined ? `年${asNumber(xp.yearStar)}` : '',
          asNumber(xp.monthStar) !== undefined ? `月${asNumber(xp.monthStar)}` : '',
          asNumber(xp.dayStar) !== undefined ? `日${asNumber(xp.dayStar)}` : '',
          asNumber(xp.hourStar) !== undefined ? `时${asNumber(xp.hourStar)}` : '',
        ]
          .filter(Boolean)
          .join(' ');
        starLine.append(el('span', 'xk-star-yun rs-yun-num', `运${asNumber(xp.period) ?? earth}`));
        if (starTail) {
          starLine.append(el('span', 'rs-flow-stars', starTail));
        }
        mid.append(starLine);
      }
      if (bz) {
        const bzRow = el('div', 'rs-bz-badges');
        if (asString(bz.ming)) {
          bzRow.append(
            el(
              'span',
              `wb-badge ${mingLuck === '吉' ? 'wb-badge-good' : 'wb-badge-warn'}`,
              `命 ${asString(bz.ming)}·${mingLuck}`,
            ),
          );
        }
        if (asString(bz.house)) {
          bzRow.append(
            el(
              'span',
              `wb-badge ${houseLuck === '吉' ? 'wb-badge-good' : 'wb-badge-warn'}`,
              `宅 ${asString(bz.house)}·${houseLuck}`,
            ),
          );
        }
        mid.append(bzRow);
      }
    }

    const foot = el('div', 'qm-cell-foot');
    const relText = asString(st?.relation) ?? (earth === 5 && match ? `宅命${match}` : '');
    if (relText) foot.append(el('span', 'qm-palace-dir', relText));

    btn.append(top, mid, foot);
    btn.addEventListener('click', () => selectEarth(earth, true));
    buttons.set(earth, btn);
    grid.append(btn);
  }

  container.append(grid, detailSheet.element);
  selectEarth(5);

  const castleGate = asRecord(xkChart?.castleGate);
  const cgCandidates = asArray(castleGate?.candidates).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  const cgText = cgCandidates.length > 0
    ? cgCandidates
        .map((c) => `${asString(c.role) ?? ''}：${asString(c.mountain) ?? ''}（${asString(c.gongName) ?? ''}宫·${asString(c.status) ?? ''}）`)
        .join('；')
    : undefined;
  const xkArrival = asRecord(xkChart?.arrival);
  const xkCombs = asArray(xkChart?.combinations).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  const agreeText = agreements
    .map((a) => `${asString(a.title) ?? asString(a.direction) ?? ''}：${asString(a.detail) ?? asString(a.summary) ?? ''}`)
    .filter((s) => s.length > 1)
    .join('；');
  const extraPairs: Array<[string, string | undefined]> = [
    ['玄空宅局', [formation, xkMode].filter(Boolean).join(' · ') || undefined],
    [
      '到山到向',
      xkArrival
        ? `山星${xkArrival.shanToMountain ? '到山' : '未到山'} · 向星${xkArrival.xiangToFacing ? '到向' : '未到向'}`
        : undefined,
    ],
    ['城门诀', cgText],
    ['挨星格局', xkCombs.length > 0 ? xkCombs.slice(0, 5).map((c) => asString(c.name)).filter(Boolean).join('、') : undefined],
    ['八宅玄空同参', agreeText || undefined],
  ];
  const extraMeta = createMetaGrid(extraPairs);
  if (extraMeta) container.append(extraMeta);

  return true;
}

export function renderQimenBoard(container: HTMLElement, method: string, data: unknown): boolean {
  const rec = asRecord(data);
  if (!rec) return false;
  if (method === 'xuankong') return renderXuankong(container, rec);
  if (method === 'residential') return renderResidentialBoard(container, rec);
  return renderQimen(container, rec);
}
