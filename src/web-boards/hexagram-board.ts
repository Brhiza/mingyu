import {
  asArray,
  asNumber,
  asRecord,
  asString,
  createBoardHeader,
  createMetaGrid,
  el,
  svgEl,
  type UnknownRecord,
} from './dom';
import { createMobileDetailSheet, createTermTrigger } from './shared';

const TRIGRAM_LINES: Record<string, readonly [boolean, boolean, boolean]> = {
  // Bottom to top: true = Yang (solid), false = Yin (broken)
  乾: [true, true, true],
  兑: [true, true, false],
  离: [true, false, true],
  震: [true, false, false],
  巽: [false, true, true],
  坎: [false, true, false],
  艮: [false, false, true],
  坤: [false, false, false],
};

const LINES_TO_TRIGRAM: Record<string, string> = {
  '111': '乾',
  '110': '兑',
  '101': '离',
  '100': '震',
  '011': '巽',
  '010': '坎',
  '001': '艮',
  '000': '坤',
};

const TRIGRAM_STEMS: Record<string, { inner: string; outer: string }> = {
  乾: { inner: '甲', outer: '壬' },
  坤: { inner: '乙', outer: '癸' },
  震: { inner: '庚', outer: '庚' },
  巽: { inner: '辛', outer: '辛' },
  坎: { inner: '戊', outer: '戊' },
  离: { inner: '己', outer: '己' },
  艮: { inner: '丙', outer: '丙' },
  兑: { inner: '丁', outer: '丁' },
};

const BRANCH_CLASH: Record<string, string> = {
  子: '午',
  午: '子',
  丑: '未',
  未: '丑',
  寅: '申',
  申: '寅',
  卯: '酉',
  酉: '卯',
  辰: '戌',
  戌: '辰',
  巳: '亥',
  亥: '巳',
};

const YAO_POS_NAMES = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'] as const;

function getStemsFromLines(lines: readonly boolean[]): string[] {
  if (lines.length < 6) return ['', '', '', '', '', ''];
  const lowerKey = `${lines[0] ? '1' : '0'}${lines[1] ? '1' : '0'}${lines[2] ? '1' : '0'}`;
  const upperKey = `${lines[3] ? '1' : '0'}${lines[4] ? '1' : '0'}${lines[5] ? '1' : '0'}`;
  const lower = LINES_TO_TRIGRAM[lowerKey] ?? '乾';
  const upper = LINES_TO_TRIGRAM[upperKey] ?? '乾';
  const innerStem = TRIGRAM_STEMS[lower]?.inner ?? '';
  const outerStem = TRIGRAM_STEMS[upper]?.outer ?? '';
  return [innerStem, innerStem, innerStem, outerStem, outerStem, outerStem];
}

function getTrigramsFromLines(lines: readonly boolean[]): { lower: string; upper: string } {
  const lowerKey = `${lines[0] ? '1' : '0'}${lines[1] ? '1' : '0'}${lines[2] ? '1' : '0'}`;
  const upperKey = `${lines[3] ? '1' : '0'}${lines[4] ? '1' : '0'}${lines[5] ? '1' : '0'}`;
  return {
    lower: LINES_TO_TRIGRAM[lowerKey] ?? '',
    upper: LINES_TO_TRIGRAM[upperKey] ?? '',
  };
}

function createYaoSvg(isYang: boolean, isChanging = false, compact = false): SVGSVGElement {
  const svg = svgEl('svg', {
    class: `hx-yao-svg ${isYang ? 'is-yang' : 'is-yin'}${isChanging ? ' is-changing' : ''}${compact ? ' is-compact' : ''}`,
    viewBox: '0 0 120 14',
    width: compact ? '60' : '120',
    height: compact ? '10' : '14',
    'aria-hidden': 'true',
  });
  if (isYang) {
    svg.append(svgEl('rect', { x: 2, y: 2, width: 116, height: 10, rx: 2, class: 'hx-yao-bar' }));
  } else {
    svg.append(svgEl('rect', { x: 2, y: 2, width: 50, height: 10, rx: 2, class: 'hx-yao-bar' }));
    svg.append(svgEl('rect', { x: 68, y: 2, width: 50, height: 10, rx: 2, class: 'hx-yao-bar' }));
  }
  return svg;
}

function getTrigramHexLines(upper?: string, lower?: string): boolean[] {
  const low = (lower && TRIGRAM_LINES[lower]) || TRIGRAM_LINES['乾'];
  const up = (upper && TRIGRAM_LINES[upper]) || TRIGRAM_LINES['乾'];
  return [...low, ...up];
}

function shortRelative(name?: string): string {
  if (!name) return '—';
  if (name === '妻财') return '财';
  if (name === '子孙') return '孙';
  if (name === '官鬼') return '官';
  if (name === '父母') return '父';
  if (name === '兄弟') return '兄';
  return name.slice(0, 1);
}

function renderLiuyao(container: HTMLElement, data: UnknownRecord): boolean {
  const yaosRaw = asArray(data.yaosDetail).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  if (yaosRaw.length === 0) return false;

  const originalName = asString(data.originalName) ?? '本卦';
  const changedName = asString(data.changedName);
  const interName = asString(data.interName);
  const hasChanged = Boolean(changedName && changedName !== originalName);

  const palace = asRecord(data.palace);
  const palaceName = asString(palace?.name) ?? '';
  const palaceText = palace ? `${palaceName}宫${asString(palace.wuxing) ?? ''}` : '';
  const palaceStage = asString(data.palaceStage) ?? '';
  const ganzhi = asRecord(data.ganzhi);
  const monthGz = asString(ganzhi?.month) ?? '';
  const dayGz = asString(ganzhi?.day) ?? '';
  const monthBranch = monthGz.slice(1, 2);
  const dayBranch = dayGz.slice(1, 2);
  const monthBreakBranch = monthBranch ? BRANCH_CLASH[monthBranch] : undefined;
  const voidBranches = asArray(data.voidBranches).map(asString).filter((x): x is string => Boolean(x));
  const guaShen = asRecord(data.guaShen);
  const guaShenPos = asNumber(guaShen?.position);
  const guaShenBranch = asString(guaShen?.branch);
  const guaShenRel = asString(guaShen?.sixRelative);

  const ev = asRecord(data.evidenceAnalysis);
  const genFact = asRecord(ev?.generationFact);
  const genMethod = asString(genFact?.methodLabel) ?? asString(asRecord(data.generation)?.method);

  const hiddenByPos = new Map<number, UnknownRecord>();
  for (const h of asArray(data.hiddenSpirits)) {
    const rec = asRecord(h);
    const pos = asNumber(rec?.position);
    if (rec && pos) hiddenByPos.set(pos, rec);
  }

  const lineFactByPos = new Map<number, UnknownRecord>();
  for (const lf of asArray(ev?.lineFacts)) {
    const rec = asRecord(lf);
    const pos = asNumber(rec?.position);
    if (rec && pos) lineFactByPos.set(pos, rec);
  }

  const symbolByRel = new Map<string, UnknownRecord>();
  for (const sym of asArray(ev?.traditionalSymbols)) {
    const rec = asRecord(sym);
    const rel = asString(rec?.relative);
    if (rec && rel) symbolByRel.set(rel, rec);
  }

  const ascOrdered = [...yaosRaw].sort((a, b) => (asNumber(a.position) ?? 0) - (asNumber(b.position) ?? 0));
  const mainLines = ascOrdered.map((y) => asString(y.yaoType) === '阳');
  const changedLines = ascOrdered.map((y) => {
    const isY = asString(y.yaoType) === '阳';
    return y.isChanging === true ? !isY : isY;
  });
  const mainStems = getStemsFromLines(mainLines);
  const changedStems = hasChanged ? getStemsFromLines(changedLines) : [];
  const mainTrigrams = getTrigramsFromLines(mainLines);
  const changedTrigrams = hasChanged ? getTrigramsFromLines(changedLines) : undefined;

  const subtitle = [
    palaceText && palaceStage ? `${palaceText} · ${palaceStage}` : palaceText || palaceStage,
    genMethod,
    ganzhi ? `${asString(ganzhi.year) ?? ''} ${monthGz} ${dayGz} ${asString(ganzhi.hour) ?? ''}`.trim() : '',
  ]
    .filter(Boolean)
    .join(' · ');

  container.append(
    createBoardHeader(
      hasChanged ? `${originalName} → ${changedName}` : originalName,
      subtitle,
      [
        palaceText ? { text: `${palaceText}${palaceStage ? `·${palaceStage}` : ''}`, tone: 'accent' } : { text: '' },
        interName ? { text: `互卦 ${interName}`, tone: 'neutral' } : { text: '' },
        voidBranches.length > 0 ? { text: `旬空 ${voidBranches.join('')}`, tone: 'warn' } : { text: '' },
        guaShenBranch ? { text: `卦身 ${guaShenBranch}${guaShenRel ? `(${shortRelative(guaShenRel)})` : ''}`, tone: 'good' } : { text: '' },
      ],
    ),
  );

  // 传统占卜四柱月破旬空顶条
  if (ganzhi) {
    const calendarStrip = el('div', 'hx-cal-strip');
    const items: Array<[string, string | undefined, string?]> = [
      ['四柱', `${asString(ganzhi.year) ?? ''}年 ${monthGz}月 ${dayGz}日 ${asString(ganzhi.hour) ?? ''}时`],
      ['月建 / 月破', monthBranch ? `${monthBranch}月${monthBreakBranch ? `（破${monthBreakBranch}）` : ''}` : undefined],
      ['日辰 / 旬空', dayBranch ? `${dayGz}日${voidBranches.length ? `（空${voidBranches.join('')}）` : ''}` : undefined],
      ['卦身', guaShenBranch ? `${guaShenBranch}${guaShenPos ? `（第${guaShenPos}爻）` : ''}` : '无卦身'],
    ];
    for (const [k, v] of items) {
      if (!v) continue;
      const pill = el('div', 'hx-cal-item');
      pill.append(el('span', 'hx-cal-k', k), el('strong', 'hx-cal-v', v));
      calendarStrip.append(pill);
    }
    container.append(calendarStrip);
  }

  const dualBox = el('div', 'hx-dual-box');

  // 卦名双栏标题
  const titleBar = el('div', 'hx-dual-titles');
  const mainTitleCol = el('div', 'hx-dual-title-col');
  mainTitleCol.append(
    createTermTrigger(originalName, originalName, 'hx-hex-name', { preferHexagram: true }),
  );
  if (mainTrigrams.upper || mainTrigrams.lower) {
    mainTitleCol.append(el('span', 'hx-hex-palace', `上${mainTrigrams.upper}下${mainTrigrams.lower}`));
  }
  if (palaceName) mainTitleCol.append(el('span', 'hx-hex-palace', `(${palaceName}宫${palaceStage ? `·${palaceStage}` : ''})`));
  titleBar.append(mainTitleCol);

  const changedTitleCol = el('div', 'hx-dual-title-col');
  if (hasChanged && changedName) {
    changedTitleCol.append(
      createTermTrigger(changedName, changedName, 'hx-hex-name', { preferHexagram: true }),
    );
    if (changedTrigrams?.upper || changedTrigrams?.lower) {
      changedTitleCol.append(el('span', 'hx-hex-palace', `上${changedTrigrams.upper}下${changedTrigrams.lower}`));
    }
    changedTitleCol.append(el('span', 'hx-hex-palace', '之卦'));
  } else {
    changedTitleCol.append(el('span', 'hx-hex-muted', '静卦无变'));
  }
  titleBar.append(changedTitleCol);
  dualBox.append(titleBar);

  // 装卦全表列头
  const colHead = el('div', `hx-table-head${hasChanged ? ' has-changed' : ''}`);
  colHead.append(
    el('span', '', '六神'),
    el('span', '', '伏神'),
    el('span', '', '本卦六亲·干支'),
    el('span', '', '旺衰/神态'),
    el('span', 'hx-th-center', '本卦爻象'),
    el('span', 'hx-th-center', '动'),
  );
  if (hasChanged) {
    colHead.append(el('span', 'hx-th-center', '变卦爻象 · 动变关系'));
  }
  dualBox.append(colHead);

  const detailBox = el('div', 'hx-detail-card');
  const detailSheet = createMobileDetailSheet(detailBox, { label: '逐爻详参' });
  const rowButtons = new Map<number, HTMLButtonElement>();

  const selectYao = (pos: number, openSheet = false) => {
    const yao = yaosRaw.find((y) => asNumber(y.position) === pos);
    if (!yao) return;
    for (const [p, btn] of rowButtons) {
      const active = p === pos;
      btn.classList.toggle('is-selected', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    }

    const lf = lineFactByPos.get(pos);
    const relName = asString(yao.sixRelative) ?? '';
    const sym = symbolByRel.get(relName);
    const dz = asString(yao.najiaDizhi) ?? '';
    const wx = asString(yao.wuxing) ?? '';
    const stem = mainStems[pos - 1] ?? '';
    const changedObj = asRecord(yao.changedYao);
    const support = asArray(lf?.support).map(asString).filter((x): x is string => Boolean(x));
    const constraints = asArray(lf?.constraints).map(asString).filter((x): x is string => Boolean(x));
    const movingStages = asArray(yao.movingLifeStages)
      .map(asRecord)
      .filter((x): x is UnknownRecord => Boolean(x))
      .map((m) => `第${asNumber(m.position) ?? '?'}爻${asString(m.branch) ?? ''}${asString(m.stage) ?? ''}`)
      .join(' · ');

    detailBox.replaceChildren();
    const head = el('div', 'qm-detail-head');
    head.append(
      el(
        'strong',
        'qm-detail-title',
        `${YAO_POS_NAMES[pos - 1] ?? `第${pos}爻`} · ${relName} ${stem}${dz}${wx}（${asString(yao.sixGod) ?? ''}）`,
      ),
    );
    const flags = el('div', 'wb-badges');
    if (yao.isWorld === true) flags.append(el('span', 'wb-badge wb-badge-accent', '世爻'));
    if (yao.isResponse === true) flags.append(el('span', 'wb-badge wb-badge-neutral', '应爻'));
    if (yao.isChanging === true) flags.append(el('span', 'wb-badge wb-badge-warn', asString(yao.changeType) ?? '动爻'));
    if (yao.isHiddenMove === true) flags.append(el('span', 'wb-badge wb-badge-accent', '暗动'));
    if (yao.isVoid === true) flags.append(el('span', 'wb-badge wb-badge-warn', '旬空'));
    if (yao.isMonthBreak === true) flags.append(el('span', 'wb-badge wb-badge-warn', '月破'));
    if (yao.isDayBreak === true) flags.append(el('span', 'wb-badge wb-badge-warn', '日破'));
    head.append(flags);
    detailBox.append(head);

    const changeRelText = [
      asString(yao.changeDirection),
      ...asArray(yao.changeRelations).map(asString),
    ]
      .filter(Boolean)
      .join(' · ');
    const changedText = changedObj
      ? `${asString(changedObj.liuqin) ?? ''} ${changedStems[pos - 1] ?? ''}${asString(changedObj.dizhi) ?? ''}${asString(changedObj.wuxing) ?? ''}${changeRelText ? `（${changeRelText}）` : ''}`
      : undefined;

    const pairs: Array<[string, string | undefined]> = [
      ['月令旺衰', asString(yao.seasonState)],
      [
        '十二长生',
        [
          asString(yao.shiErGong) ? `本卦${asString(yao.shiErGong)}` : '',
          asString(yao.dayLifeStage) ? `日辰${asString(yao.dayLifeStage)}` : '',
          asString(yao.changedLifeStage) ? `变爻${asString(yao.changedLifeStage)}` : '',
        ]
          .filter(Boolean)
          .join(' · ') || undefined,
      ],
      ['化出之爻', changedText],
      ['动爻墓绝', movingStages || undefined],
      ['合冲刑害', [
        yao.isLiuhe === true ? `六合(${asString(yao.liuhePartner) ?? ''})` : '',
        yao.isDayClash === true ? '日冲' : '',
        yao.isLiuhai === true ? '六害' : '',
        yao.isSanxing === true ? `三刑(${asString(yao.sanxingType) ?? ''})` : '',
        yao.isRuMu === true ? '入墓' : '',
      ].filter(Boolean).join(' · ') || undefined],
      ['六亲传统取象', asString(sym?.originalText)],
    ];
    const meta = createMetaGrid(pairs);
    if (meta) detailBox.append(meta);

    if (support.length > 0 || constraints.length > 0) {
      const chipWrap = el('div', 'wb-chip-wrap');
      chipWrap.style.marginTop = '8px';
      for (const s of support) chipWrap.append(el('span', 'wb-badge wb-badge-good', `助：${s}`));
      for (const c of constraints) chipWrap.append(el('span', 'wb-badge wb-badge-warn', `制：${c}`));
      detailBox.append(chipWrap);
    }

    if (openSheet) detailSheet.open();
  };

  const rowsWrap = el('div', 'hx-liuyao-rows');
  const sorted = [...yaosRaw].sort((a, b) => (asNumber(b.position) ?? 0) - (asNumber(a.position) ?? 0));

  for (const yao of sorted) {
    const pos = asNumber(yao.position) ?? 0;
    const isYang = asString(yao.yaoType) === '阳';
    const isChanging = yao.isChanging === true;
    const isWorld = yao.isWorld === true;
    const isResponse = yao.isResponse === true;
    const isVoid = yao.isVoid === true;
    const changeType = asString(yao.changeType) ?? '';
    const hidden = hiddenByPos.get(pos);
    const wuxing = asString(yao.wuxing) ?? '';
    const stem = mainStems[pos - 1] ?? '';
    const seasonState = asString(yao.seasonState) ?? '';
    const shiErGong = asString(yao.shiErGong) ?? asString(yao.dayLifeStage) ?? '';

    const row = el(
      'button',
      `hx-liuyao-row${hasChanged ? ' has-changed' : ''}${isChanging ? ' is-changing' : ''}`,
    );
    row.type = 'button';

    // 1. 六神
    const godText = asString(yao.sixGod);
    row.append(
      godText
        ? createTermTrigger(godText.slice(0, 2), godText, 'hx-col-god')
        : el('span', 'hx-col-god', '—'),
    );

    // 2. 伏神
    const hiddenCell = el('span', 'hx-col-hidden');
    if (hidden) {
      const hRel = shortRelative(asString(hidden.sixRelative));
      const hDz = asString(hidden.najiaDizhi) ?? '';
      const hWx = asString(hidden.wuxing) ?? '';
      const hTag = el('span', 'hx-hidden-tag', `伏${hRel}${hDz}${hWx}`);
      hTag.title = `伏神：${asString(hidden.sixRelative) ?? ''} ${hDz}${hWx}`;
      hiddenCell.append(hTag);
    } else {
      hiddenCell.textContent = '—';
    }
    row.append(hiddenCell);

    // 3. 本卦六亲 · 干支 · 五行
    const mainInfo = el('div', 'hx-col-main-info');
    const relName = asString(yao.sixRelative);
    mainInfo.append(
      relName ? createTermTrigger(relName, relName, 'hx-six-rel') : el('span', 'hx-six-rel', '—'),
    );
    const gzSpan = el('span', 'hx-najia', `${stem}${asString(yao.najiaDizhi) ?? ''}${wuxing}`);
    if (wuxing) gzSpan.dataset.wuxing = wuxing;
    mainInfo.append(gzSpan);
    row.append(mainInfo);

    // 4. 旺衰 / 世应 / 破 / 暗动 / 旬空 / 墓 / 卦身
    const marks = el('div', 'hx-col-marks');
    if (seasonState) marks.append(el('span', `hx-tag is-season is-s-${seasonState}`, seasonState));
    if (shiErGong) marks.append(el('span', 'hx-tag is-stage', shiErGong));
    if (isWorld) marks.append(el('span', 'hx-tag is-shi', '世'));
    if (isResponse) marks.append(el('span', 'hx-tag is-ying', '应'));
    if (isVoid) marks.append(el('span', 'hx-tag is-void', '空'));
    if (yao.isMonthBreak === true) marks.append(el('span', 'hx-tag is-break', '月破'));
    if (yao.isDayBreak === true) marks.append(el('span', 'hx-tag is-break', '日破'));
    if (yao.isHiddenMove === true) marks.append(el('span', 'hx-tag is-hidden-move', '暗动'));
    if (yao.isDayClash === true && yao.isDayBreak !== true && yao.isHiddenMove !== true) {
      marks.append(el('span', 'hx-tag is-clash', '日冲'));
    }
    if (yao.isLiuhe === true) marks.append(el('span', 'hx-tag is-he', '合'));
    if (yao.isRiMu === true) marks.append(el('span', 'hx-tag is-mu', '日墓'));
    else if (yao.isDongMu === true) marks.append(el('span', 'hx-tag is-mu', '动墓'));
    if (guaShenPos === pos && guaShenBranch) {
      marks.append(el('span', 'hx-tag is-guashen', '身'));
    }
    row.append(marks);

    // 5. 本卦阴阳爻线
    const mainBar = el('div', 'hx-yao-bar-wrap');
    mainBar.append(createYaoSvg(isYang, isChanging));
    row.append(mainBar);

    // 6. 动爻标识 ○ / ×
    const moveCol = el('div', 'hx-col-move');
    if (isChanging) {
      const symbol = changeType.includes('阳') || isYang ? '○' : '×';
      moveCol.append(el('span', 'hx-change-mark', symbol));
    } else {
      moveCol.append(el('span', 'hx-static-dot', '·'));
    }
    row.append(moveCol);

    // 7. 变卦区（变爻线 + 变出六亲·干支·五行 + 进退神/回头生克）
    if (hasChanged) {
      const changedObj = asRecord(yao.changedYao);
      const changedIsYang = isChanging ? !isYang : isYang;
      const changedCell = el('div', 'hx-yao-changed');
      changedCell.append(createYaoSvg(changedIsYang, isChanging, true));
      if (changedObj) {
        const cRel = asString(changedObj.liuqin) ?? asString(yao.sixRelative) ?? '';
        const cDz = asString(changedObj.dizhi) ?? '';
        const cWx = asString(changedObj.wuxing) ?? '';
        const cStem = changedStems[pos - 1] ?? '';
        const cText = el('span', 'hx-changed-text', `${shortRelative(cRel)} ${cStem}${cDz}${cWx}`.trim());
        if (cWx) cText.dataset.wuxing = cWx;
        changedCell.append(cText);
        const dir = asString(yao.changeDirection);
        if (dir) changedCell.append(el('span', 'hx-tag is-dir', dir.replace('神', '')));
        for (const cr of asArray(yao.changeRelations).map(asString).slice(0, 2)) {
          if (!cr) continue;
          const isGoodRel = cr.includes('生') || cr.includes('合');
          changedCell.append(el('span', `hx-tag ${isGoodRel ? 'is-he' : 'is-mu'}`, cr));
        }
        if (changedObj.isVoid === true && !asArray(yao.changeRelations).includes('化空')) {
          changedCell.append(el('span', 'hx-tag is-void', '空'));
        }
        if (yao.isHuaMu === true && !asArray(yao.changeRelations).includes('化墓')) {
          changedCell.append(el('span', 'hx-tag is-mu', '化墓'));
        }
      }
      row.append(changedCell);
    }

    row.addEventListener('click', () => selectYao(pos, true));
    rowButtons.set(pos, row);
    rowsWrap.append(row);
  }

  dualBox.append(rowsWrap);
  container.append(dualBox, detailSheet.element);

  const defaultWorldPos = yaosRaw.find((y) => y.isWorld === true)?.position;
  selectYao(asNumber(defaultWorldPos) ?? 1);

  // 用神候选主辅轴（evidenceAnalysis.candidates）
  const candidates = asArray(ev?.candidates).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  if (candidates.length > 0) {
    const candSec = el('div', 'lr-section');
    candSec.append(el('h4', 'lr-section-title', '用神取用与世应线索'));
    const list = el('div', 'wb-computed-list');
    for (const c of candidates.slice(0, 4)) {
      const card = el('div', 'wb-computed-item');
      card.append(el('strong', 'wb-computed-title', `${asString(c.label) ?? '候选'}${asNumber(c.position) ? `（第${asNumber(c.position)}爻）` : ''}`));
      if (asString(c.promptText)) card.append(el('p', 'wb-computed-desc', asString(c.promptText)));
      else if (asString(c.reason)) card.append(el('p', 'wb-computed-desc', asString(c.reason)));
      list.append(card);
    }
    candSec.append(list);
    container.append(candSec);
  }

  // 显示发动机已算出的六爻合冲刑害、特殊格局与用神线索
  const extraPairs: Array<[string, string | undefined]> = [];
  if (data.isChaotic === true && asString(data.chaoticReason)) {
    extraPairs.push(['乱动提示', asString(data.chaoticReason)]);
  }
  const specialPattern = asString(data.specialPattern);
  const specialAdvice = asString(data.specialAdvice);
  if (specialPattern || specialAdvice) {
    extraPairs.push(['卦象特征', [specialPattern, specialAdvice].filter(Boolean).join(' · ')]);
  }
  const sanheDay = asRecord(data.sanheWithDay);
  const sanheMonth = asRecord(data.sanheWithMonth);
  const formatSanheText = (rec: UnknownRecord): string | undefined => {
    const desc = asString(rec.description) ?? asString(rec.summary);
    if (desc) return desc;
    const group = asString(rec.group) ?? asString(rec.element) ?? '';
    const members = asArray(rec.members).map(asString).filter(Boolean).join('');
    if (!group && !members) return undefined;
    return members && group ? `${members}（${group}）` : group || members;
  };
  const sanxings = asArray(data.sanxingInYaos).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  if (sanheDay) {
    extraPairs.push(['与日辰三合', formatSanheText(sanheDay)]);
  }
  if (sanheMonth) {
    extraPairs.push(['与月建三合', formatSanheText(sanheMonth)]);
  }
  if (sanxings.length > 0) {
    extraPairs.push([
      '爻位三刑',
      sanxings
        .map((sx) => `${asArray(sx.branches).map(asString).filter(Boolean).join('')}（${asString(sx.type) ?? '刑'}）`)
        .join('、'),
    ]);
  }
  const hexRel = asRecord(data.hexagramRelations);
  const fanfu = asRecord(data.fanfuRelations);
  const structLabels = [
    asString(hexRel?.transition) ?? asString(hexRel?.original),
    ...asArray(fanfu?.labels).map(asString),
  ].filter(Boolean);
  if (structLabels.length > 0) {
    extraPairs.push(['整卦与反伏结构', structLabels.join(' · ')]);
  }
  const selFact = asString(asRecord(ev?.selectionFact)?.promptText) ?? asString(ev?.selectionFact);
  const timingSummary = asString(asRecord(ev?.timingSummaryFact)?.promptText) ?? asString(ev?.timingSummaryFact);
  const counterFacts = asArray(ev?.counterEvidenceFacts)
    .map((x) => asString(asRecord(x)?.promptText) ?? asString(x))
    .filter(Boolean)
    .join('；');
  const timingFacts = asArray(ev?.timingFacts)
    .map((x) => asString(asRecord(x)?.promptText) ?? asString(x))
    .filter(Boolean)
    .join('；');
  if (selFact) extraPairs.push(['用神取法线索', selFact]);
  if (timingSummary) extraPairs.push(['月日衰旺线索', timingSummary]);
  if (timingFacts) extraPairs.push(['旺相休囚详察', timingFacts]);
  if (counterFacts) extraPairs.push(['反证与牵制因素', counterFacts]);

  const extraMeta = createMetaGrid(extraPairs);
  if (extraMeta) container.append(extraMeta);

  return true;
}

function renderMeihuaCard(
  roleLabel: string,
  hex: UnknownRecord | undefined,
  tiGua: UnknownRecord | undefined,
  yongGua: UnknownRecord | undefined,
  movingPos?: number,
  isPrimary = false,
  yaosDetail?: UnknownRecord[],
  stageRel?: string,
): HTMLElement | undefined {
  if (!hex) return undefined;
  const name = asString(hex.name);
  if (!name) return undefined;
  const upper = asString(hex.upper);
  const lower = asString(hex.lower);
  const lines = getTrigramHexLines(upper, lower);

  const tiName = asString(tiGua?.name);
  const tiEl = asString(tiGua?.element);
  const yongName = asString(yongGua?.name);
  const yongEl = asString(yongGua?.element);

  // Determine which half (upper or lower) is 体/用
  let upperRole: '体' | '用' | undefined;
  let lowerRole: '体' | '用' | undefined;
  if (yaosDetail && yaosDetail.length >= 6) {
    lowerRole = asString(yaosDetail[0]?.tiYong) === '体' ? '体' : '用';
    upperRole = lowerRole === '体' ? '用' : '体';
  } else if (tiName && yongName) {
    if (upper === tiName && lower === yongName) {
      upperRole = '体';
      lowerRole = '用';
    } else if (lower === tiName && upper === yongName) {
      lowerRole = '体';
      upperRole = '用';
    }
  }

  const card = el('article', `hx-mh-card${isPrimary ? ' is-primary' : ''}`);
  const head = el('div', 'hx-mh-card-head');
  head.append(el('span', 'hx-mh-role', roleLabel));
  head.append(createTermTrigger(name, name, 'hx-mh-name', { preferHexagram: true }));
  card.append(head);

  // 上下经卦与体用标识
  const triInfo = el('div', 'hx-mh-trigrams');
  if (upper || lower) {
    triInfo.append(el('span', 'hx-mh-tri-text', `上${upper ?? ''}下${lower ?? ''}${stageRel ? ` · ${stageRel}` : ''}`));
  }
  if (tiName && yongName) {
    const tiYongRow = el('div', 'hx-mh-tiyong-badges');
    const tiBadge = el('span', 'hx-mh-badge is-ti', `体:${tiName}${tiEl ? `(${tiEl})` : ''}`);
    const yongBadge = el('span', 'hx-mh-badge is-yong', `用:${yongName}${yongEl ? `(${yongEl})` : ''}`);
    tiYongRow.append(tiBadge, yongBadge);
    triInfo.append(tiYongRow);
  }
  card.append(triInfo);

  // 六爻爻象（6爻到1爻，标出上卦/下卦体用 + 初二三四五上 + 动爻高亮）
  const linesWrap = el('div', 'hx-mh-lines');
  for (let pos = 6; pos >= 1; pos--) {
    const isYang = lines[pos - 1];
    const isMoving = movingPos === pos;
    const roleTag = pos >= 4 ? upperRole : lowerRole;
    const lineRow = el('div', `hx-mh-line${isMoving ? ' is-changing' : ''}${pos === 3 ? ' is-trigram-split' : ''}`);
    lineRow.append(el('span', 'hx-mh-pos-label', ['初', '二', '三', '四', '五', '上'][pos - 1]!));
    lineRow.append(createYaoSvg(isYang, isMoving));
    if (pos === 5 && upperRole) {
      lineRow.append(el('span', `hx-mh-half-tag ${upperRole === '体' ? 'is-ti' : 'is-yong'}`, upperRole));
    } else if (pos === 2 && lowerRole) {
      lineRow.append(el('span', `hx-mh-half-tag ${lowerRole === '体' ? 'is-ti' : 'is-yong'}`, lowerRole));
    } else if (roleTag) {
      lineRow.append(el('span', 'hx-mh-half-spacer', ''));
    }
    if (isMoving) {
      lineRow.append(el('span', 'hx-change-mark', isYang ? '○' : '×'));
    }
    linesWrap.append(lineRow);
  }
  card.append(linesWrap);

  const desc = asString(hex.description);
  if (desc) {
    card.append(el('p', 'hx-mh-desc', desc));
  }
  return card;
}

function renderMeihua(container: HTMLElement, data: UnknownRecord): boolean {
  const mainHex = asRecord(data.mainHexagram);
  if (!mainHex) return false;

  const moving = asRecord(data.movingYao);
  const movingPos = asNumber(moving?.position);
  const analysis = asRecord(data.analysis);
  const tiYongRel = asString(analysis?.tiYongRelation) ?? '';
  const inter1Rel = asString(analysis?.inter1Relation) ?? '';
  const inter2Rel = asString(analysis?.inter2Relation) ?? '';
  const changedRel = asString(analysis?.changedTiYongRelation) ?? asString(analysis?.changedRelation) ?? '';
  const tiSeason = asString(analysis?.tiSeasonState) ?? '';
  const yongSeason = asString(analysis?.yongSeasonState) ?? '';
  const seasonEval = asString(analysis?.tiYongSeasonEvaluation);
  const trend = asRecord(analysis?.timelineTrend);
  const trendLabel = asString(trend?.trend);
  const ganzhi = asRecord(data.ganzhi);
  const yaosDetail = asArray(data.yaosDetail).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));

  const subtitle = [
    asString(moving?.description),
    analysis ? `${asString(analysis.season) ?? ''}令 ${asString(analysis.monthBranch) ?? ''}月(${asString(analysis.monthElement) ?? ''})` : '',
    ganzhi ? `${asString(ganzhi.year) ?? ''} ${asString(ganzhi.month) ?? ''} ${asString(ganzhi.day) ?? ''} ${asString(ganzhi.hour) ?? ''}`.trim() : '',
  ]
    .filter(Boolean)
    .join(' · ');

  container.append(
    createBoardHeader(
      `${asString(data.originalName) ?? asString(mainHex.name) ?? '梅花易数'}${asString(data.changedName) ? ` → ${asString(data.changedName)}` : ''}`,
      subtitle,
      [
        tiYongRel ? { text: `体用：${tiYongRel}`, tone: 'accent' } : { text: '' },
        movingPos ? { text: `第${movingPos}爻动`, tone: 'warn' } : { text: '' },
        trendLabel ? { text: trendLabel, tone: trendLabel.includes('顺') ? 'good' : 'neutral' } : { text: '' },
        changedRel ? { text: `变卦：${changedRel}`, tone: 'good' } : { text: '' },
      ],
    ),
  );

  // 本卦 / 互卦 / 变卦三卦并列
  const grid = el('div', 'hx-mh-grid');
  const cards = [
    renderMeihuaCard('本卦 · 主', mainHex, asRecord(data.tiGua), asRecord(data.yongGua), movingPos, true, yaosDetail, tiYongRel),
    renderMeihuaCard('互卦 · 中', asRecord(data.interHexagram), asRecord(data.interTiGua), asRecord(data.interYongGua), undefined, false, undefined, inter1Rel),
    renderMeihuaCard('变卦 · 变', asRecord(data.changedHexagram), asRecord(data.changedTiGua), asRecord(data.changedYongGua), movingPos, false, undefined, changedRel),
  ];
  for (const card of cards) {
    if (card) grid.append(card);
  }
  container.append(grid);

  // 体用生克关系三格
  const relBox = el('div', 'hx-mh-rel-grid');
  const relItems: Array<[string, string, string?]> = [
    ['主卦体用（起始）', tiYongRel || '—', tiSeason && yongSeason ? `体${tiSeason} · 用${yongSeason}` : undefined],
    ['互卦体用（过程）', [inter1Rel, inter2Rel].filter(Boolean).join(' · ') || '—'],
    ['变卦体用（归宿）', changedRel || '—', seasonEval],
  ];
  for (const [label, value, sub] of relItems) {
    const cell = el('div', 'hx-mh-rel-card');
    cell.append(el('span', 'hx-mh-rel-label', label));
    cell.append(el('strong', 'hx-mh-rel-val', value));
    if (sub) cell.append(el('small', 'hx-mh-rel-sub', sub));
    relBox.append(cell);
  }
  container.append(relBox);

  const tradFacts = asRecord(data.traditionalFacts);
  const ev = asRecord(data.evidenceAnalysis);
  const calcFact = asRecord(ev?.calculationFact);
  const calcSteps = asArray(calcFact?.steps)
    .map((s) => asString(asRecord(s)?.promptText))
    .filter(Boolean)
    .join('；');
  const yingQiList = asArray(analysis?.yingQi).map(asString).filter(Boolean).join('；');
  const mainYaoCi = asArray(mainHex.yaoCi).map(asString);
  const movingYaoCi =
    asString(moving?.yaoCi) ??
    asString(mainHex.movingYaoCi) ??
    (movingPos && movingPos >= 1 && movingPos <= 6 ? mainYaoCi[movingPos - 1] : undefined);
  const evStages = asArray(ev?.stages)
    .map((s) => asString(asRecord(s)?.promptText) ?? asString(s))
    .filter(Boolean)
    .join(' → ');
  const meta = createMetaGrid([
    ['动爻辞', movingYaoCi],
    ['起卦算式', calcSteps || asString(calcFact?.promptText)],
    ['趋势研判', asString(trend?.summary)],
    ['梅花三段演进', evStages || (tradFacts ? [asString(tradFacts.beginSummary), asString(tradFacts.middleSummary), asString(tradFacts.endSummary)].filter(Boolean).join(' → ') : undefined)],
    ['应期推衍线索', yingQiList || undefined],
  ]);
  if (meta) container.append(meta);
  return true;
}

export function renderHexagramBoard(container: HTMLElement, method: string, data: unknown): boolean {
  const rec = asRecord(data);
  if (!rec) return false;
  if (method === 'meihua') return renderMeihua(container, rec);
  return renderLiuyao(container, rec);
}
