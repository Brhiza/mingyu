import {
  asArray,
  asRecord,
  asString,
  createBoardHeader,
  createMetaGrid,
  el,
  type UnknownRecord,
} from './dom';
import { createTermTrigger, getWuxing, type Wuxing } from './shared';

const RING_BRANCHES: Array<{ branch: string; col: number; row: number }> = [
  { branch: '巳', col: 1, row: 1 },
  { branch: '午', col: 2, row: 1 },
  { branch: '未', col: 3, row: 1 },
  { branch: '申', col: 4, row: 1 },
  { branch: '酉', col: 4, row: 2 },
  { branch: '戌', col: 4, row: 3 },
  { branch: '亥', col: 4, row: 4 },
  { branch: '子', col: 3, row: 4 },
  { branch: '丑', col: 2, row: 4 },
  { branch: '寅', col: 1, row: 4 },
  { branch: '卯', col: 1, row: 3 },
  { branch: '辰', col: 1, row: 2 },
];

const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;

const GEN_MAP: Record<Wuxing, Wuxing> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const KE_MAP: Record<Wuxing, Wuxing> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

function getSixRelativeFromElements(dayEl: Wuxing | undefined, targetEl: Wuxing | undefined): string {
  if (!dayEl || !targetEl) return '';
  if (dayEl === targetEl) return '兄弟';
  if (GEN_MAP[dayEl] === targetEl) return '子孙';
  if (GEN_MAP[targetEl] === dayEl) return '父母';
  if (KE_MAP[dayEl] === targetEl) return '妻财';
  if (KE_MAP[targetEl] === dayEl) return '官鬼';
  return '';
}

function getXunDunStem(dayGanZhi: string | undefined, branch: string): string {
  if (!dayGanZhi || dayGanZhi.length < 2) return '';
  const sIdx = STEMS.indexOf(dayGanZhi[0] as (typeof STEMS)[number]);
  const bIdx = BRANCHES.indexOf(dayGanZhi[1] as (typeof BRANCHES)[number]);
  const targetBIdx = BRANCHES.indexOf(branch as (typeof BRANCHES)[number]);
  if (sIdx < 0 || bIdx < 0 || targetBIdx < 0) return '';
  const xunHeadBranchIdx = (bIdx - sIdx + 12) % 12;
  const offset = (targetBIdx - xunHeadBranchIdx + 12) % 12;
  if (offset >= 10) return ''; // 旬空两支无遁干
  return STEMS[offset] ?? '';
}

function formatGanzhiSubtitle(gz: UnknownRecord | undefined): string | undefined {
  if (!gz) return undefined;
  const parts = [
    asString(gz.year) ? `${asString(gz.year)}年` : '',
    asString(gz.month) ? `${asString(gz.month)}月` : '',
    asString(gz.day) ? `${asString(gz.day)}日` : '',
    asString(gz.hour) ? `${asString(gz.hour)}时` : '',
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : undefined;
}

function renderDaLiuren(container: HTMLElement, data: UnknownRecord): boolean {
  const gz = asRecord(data.ganzhi);
  const heavenlyPlate = asArray(data.heavenlyPlate).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  const fourLessons = asArray(data.fourLessons).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  const threeTrans = asArray(data.threeTransmissions).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  if (heavenlyPlate.length === 0 && fourLessons.length === 0 && threeTrans.length === 0) return false;

  const dayGz = asString(gz?.day);
  const dayStem = dayGz?.slice(0, 1);
  const dayElement = getWuxing(dayStem);

  const dayNight = asString(data.dayNight);
  const rule = asString(data.transmissionRule);
  const pattern = asString(data.transmissionPattern);
  const monthLeader = asString(data.monthLeader);
  const divBranch = asString(data.divinationBranch);
  const nobleman = asString(data.noblemanBranch);
  const noblemanGround = asString(data.noblemanGroundBranch);
  const xunKong = asArray(data.xunKong).map(asString).filter((x): x is string => Boolean(x));
  const guaTi = asArray(data.guaTi).map(asString).filter((x): x is string => Boolean(x));
  const patternTags = asArray(data.patternTags).map(asString).filter((x): x is string => Boolean(x));
  const ev = asRecord(data.evidenceAnalysis);
  const evLessons = asArray(ev?.lessons).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  const initialLessonNames = new Set(
    evLessons.filter((l) => l.isInitialSource === true).map((l) => asString(l.name)).filter(Boolean),
  );

  const badges: Array<{ text: string; tone?: 'accent' | 'neutral' | 'good' | 'warn' }> = [];
  if (dayNight) badges.push({ text: dayNight, tone: 'neutral' });
  if (rule) badges.push({ text: rule, tone: 'accent' });
  if (pattern) badges.push({ text: pattern, tone: 'good' });
  if (monthLeader && divBranch) badges.push({ text: `月将${monthLeader}加${divBranch}`, tone: 'neutral' });

  container.append(createBoardHeader('大六壬课式', formatGanzhiSubtitle(gz), badges));

  const meta = createMetaGrid([
    ['日干寄宫', asString(data.dayStemResidence)],
    ['贵人', nobleman ? (noblemanGround ? `${nobleman}（临地盘${noblemanGround}）` : nobleman) : undefined],
    ['旬空', xunKong.length > 0 ? xunKong.join('、') : '无'],
    ['课体', guaTi.length > 0 ? guaTi.join('、') : patternTags.slice(0, 4).join('、') || undefined],
  ]);
  if (meta) container.append(meta);

  const scriptPanel = el('div', 'lr-script-panel');

  // 1. 天地盘十二宫方位格（4×4 环形布局）
  if (heavenlyPlate.length > 0) {
    const byUnder = new Map<string, UnknownRecord>();
    for (const item of heavenlyPlate) {
      const under = asString(item.under);
      if (under) byUnder.set(under, item);
    }
    const transByBranch = new Map<string, string>();
    for (const t of threeTrans) {
      const br = asString(t.branch);
      const st = asString(t.stage);
      if (br && st && !transByBranch.has(br)) {
        transByBranch.set(br, st.replace('传', ''));
      }
    }
    const voidSet = new Set(xunKong);

    const plate = el('div', 'lr-script-plate');
    plate.setAttribute('aria-label', '大六壬天地盘十二宫');

    for (const pos of RING_BRANCHES) {
      const item = byUnder.get(pos.branch);
      const tian = asString(item?.branch) ?? '—';
      const god = asString(item?.god) ?? '';
      const transMark = transByBranch.get(tian);
      const isVoid = voidSet.has(pos.branch);
      const dunGan = getXunDunStem(dayGz, tian);

      const cls = [
        'lr-script-cell',
        divBranch && pos.branch === divBranch ? 'is-hour' : '',
        monthLeader && tian === monthLeader ? 'is-month-leader' : '',
        nobleman && tian === nobleman ? 'is-nobleman' : '',
        isVoid ? 'is-empty' : '',
        transMark ? 'is-transmission' : '',
      ]
        .filter(Boolean)
        .join(' ');

      const cell = el('div', cls);
      cell.style.gridColumn = String(pos.col);
      cell.style.gridRow = String(pos.row);
      cell.append(
        god
          ? createTermTrigger(god, god, 'lr-script-god')
          : el('span', 'lr-script-god', '·'),
      );
      const branchLabel = dunGan ? `${dunGan}${tian}` : tian;
      const bEl = el('strong', 'lr-script-branch', branchLabel);
      const wx = getWuxing(tian);
      if (wx) bEl.dataset.wuxing = wx;
      cell.append(bEl);
      cell.append(el('small', 'lr-script-di', pos.branch));
      if (transMark) cell.append(el('em', 'lr-script-trans-mark', transMark));
      plate.append(cell);
    }

    const center = el('div', 'lr-script-center');
    center.append(el('span', 'lr-center-kicker', '天地盘'));
    center.append(el('strong', 'lr-center-title', `${dayGz ?? ''}日 ${asString(gz?.hour) ?? ''}时`));
    if (monthLeader && divBranch) {
      center.append(el('p', 'lr-center-line', `月将${monthLeader}加${divBranch} · ${dayNight || '时段未知'}`));
    }
    center.append(
      el(
        'p',
        'lr-center-line',
        `${nobleman ? `贵人${nobleman}` : '贵人未标'}${noblemanGround ? `临${noblemanGround}` : ''} · ${xunKong.length > 0 ? `空${xunKong.join('')}` : '无空'}`,
      ),
    );
    plate.append(center);
    scriptPanel.append(plate);
  }

  // 2. 四课四竖栏 + 三传竖栏（含发用课源高亮、六亲与遁干）
  const matrix = el('div', 'lr-compact-matrix');

  if (fourLessons.length > 0) {
    const lessonSec = el('section', 'lr-matrix-sec');
    lessonSec.append(el('span', 'lr-matrix-title', '四课（一课干阳 · 三课支阳）'));
    const cols = el('div', 'lr-matrix-cols lr-lessons-cols');
    for (const lesson of fourLessons) {
      const lName = asString(lesson.name) ?? '课';
      const isSource = initialLessonNames.has(lName);
      const col = el('div', `lr-matrix-col${isSource ? ' is-source' : ''}`);
      col.append(el('span', 'lr-col-god', asString(lesson.god) ?? '—'));
      col.append(el('strong', 'lr-col-main', asString(lesson.upper) ?? '—'));
      col.append(el('b', 'lr-col-sub', asString(lesson.lower) ?? '—'));
      col.append(el('small', 'lr-col-name', isSource ? `${lName}·源` : lName));
      const detail = [asString(lesson.relation), asString(lesson.note)].filter(Boolean).join(' · ');
      if (detail) col.append(el('small', 'lr-matrix-detail', detail));
      cols.append(col);
    }
    lessonSec.append(cols);
    matrix.append(lessonSec);
  }

  if (threeTrans.length > 0) {
    const transSec = el('section', 'lr-matrix-sec');
    transSec.append(el('span', 'lr-matrix-title', '三传（遁干 · 六亲 · 天将 · 旺衰）'));
    const cols = el('div', 'lr-matrix-cols lr-trans-cols');
    for (const item of threeTrans) {
      const br = asString(item.branch) ?? '—';
      const wx = asString(item.wuxing) as Wuxing | undefined;
      const dun = getXunDunStem(dayGz, br);
      const sixRel = getSixRelativeFromElements(dayElement, wx ?? getWuxing(br));
      const col = el('div', `lr-matrix-col${item.isVoid === true ? ' is-void' : ''}`);
      col.append(el('span', 'lr-col-god', asString(item.god) ?? '—'));
      const branchEl = el('strong', 'lr-col-main', dun ? `${dun}${br}` : br);
      if (wx) branchEl.dataset.wuxing = wx;
      col.append(branchEl);

      const stageRow = el('div', 'lr-col-stage-row');
      stageRow.append(el('small', 'lr-col-name', `${asString(item.stage) ?? '传'}${sixRel ? `·${sixRel}` : ''}`));
      if (item.isVoid === true) stageRow.append(el('span', 'lr-void-dot', '空'));
      col.append(stageRow);

      const detail = [
        asString(item.relation),
        wx,
        asString(item.seasonState),
        asString(item.dayRelation),
      ]
        .filter(Boolean)
        .join(' · ');
      if (detail) col.append(el('small', 'lr-matrix-detail', detail));
      cols.append(col);
    }
    transSec.append(cols);
    matrix.append(transSec);
  }

  if (matrix.childElementCount > 0) scriptPanel.append(matrix);
  container.append(scriptPanel);

  if (asString(data.transmissionSummary)) {
    container.append(el('p', 'wb-note-box', asString(data.transmissionSummary)));
  }

  // 主辅证焦点（focusEvidence）与天将属性（tianJiangProps）
  const focusEv = asArray(data.focusEvidence).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  if (focusEv.length > 0) {
    const fSec = el('div', 'lr-section');
    fSec.append(el('h4', 'lr-section-title', '主辅传课焦距线索'));
    const list = el('div', 'wb-computed-list');
    for (const f of focusEv) {
      const card = el('div', `wb-computed-item ${asString(f.level) === '主证' ? 'is-good' : ''}`.trim());
      card.append(
        el('strong', 'wb-computed-title', `${asString(f.level) ?? ''} · ${asString(f.target) ?? ''}（${asString(f.role) ?? ''}）`),
      );
      const evLines = asArray(f.evidence).map(asString).filter(Boolean).join('；');
      if (evLines) card.append(el('p', 'wb-computed-desc', evLines));
      list.append(card);
    }
    fSec.append(list);
    container.append(fSec);
  }

  const tjProps = asRecord(data.tianJiangProps);
  if (tjProps && Object.keys(tjProps).length > 0) {
    const tjSec = el('div', 'lr-section');
    tjSec.append(el('h4', 'lr-section-title', '三传乘将神性'));
    const list = el('div', 'wb-computed-list');
    for (const [name, val] of Object.entries(tjProps)) {
      const rec = asRecord(val);
      if (!rec) continue;
      const card = el('div', 'wb-computed-item');
      card.append(
        el(
          'strong',
          'wb-computed-title',
          `${name}（${asString(rec.wuxing) ?? ''}${asString(rec.yinYang) ?? ''} · ${asString(rec.category) ?? ''}）`,
        ),
      );
      if (asString(rec.description)) card.append(el('p', 'wb-computed-desc', asString(rec.description)));
      list.append(card);
    }
    tjSec.append(list);
    container.append(tjSec);
  }

  // 课体与典籍依据
  const guaTiFacts = asArray(data.guaTiFacts).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  if (guaTiFacts.length > 0) {
    const gtSec = el('div', 'lr-section');
    gtSec.append(el('h4', 'lr-section-title', `课体与典籍依据（${guaTiFacts.length}）`));
    const gtList = el('div', 'wb-computed-list');
    for (const gt of guaTiFacts.slice(0, 6)) {
      const card = el('div', 'wb-computed-item');
      const conds = asArray(gt.matchedConditions).map(asString).filter(Boolean).join('；');
      const quote = asString(gt.sourceQuote);
      const srcTitle = asString(gt.sourceTitle);
      const gtName = asString(gt.name) ?? '课体';
      const gtTitle = `${gtName}${asString(gt.category) ? ` · ${asString(gt.category)}` : ''}`;
      card.append(
        createTermTrigger(gtTitle, gtName, 'wb-computed-title', {
          title: gtTitle,
          category: '大六壬课体',
          subtitle: asString(gt.category),
          detail: conds || undefined,
          classicRef: srcTitle || quote ? `${srcTitle ? `《${srcTitle.replace(/[《》]/g, '')}》：` : ''}${quote ?? ''}` : undefined,
        }),
      );
      if (conds) card.append(el('p', 'wb-computed-desc', conds));
      if (quote || srcTitle) {
        card.append(el('small', 'wb-computed-quote', `${srcTitle ? `《${srcTitle.replace(/[《》]/g, '')}》：` : ''}${quote ?? ''}`));
      }
      gtList.append(card);
    }
    gtSec.append(gtList);
    container.append(gtSec);
  }

  const shenSha = asArray(data.shenShaSummary).map(asString).filter((x): x is string => Boolean(x));
  if (shenSha.length > 0) {
    const ssSec = el('div', 'lr-section');
    ssSec.append(el('h4', 'lr-section-title', `神煞摘要（${shenSha.length}项）`));
    const chipWrap = el('div', 'wb-chip-wrap');
    for (const s of shenSha) {
      const termKey = s.split(/[：:（(]/u)[0]?.trim() || s;
      chipWrap.append(
        createTermTrigger(s, termKey, 'wb-badge wb-badge-neutral', {
          title: s,
          category: '大六壬神煞',
        }),
      );
    }
    ssSec.append(chipWrap);
    container.append(ssSec);
  }

  const classicalRules = asArray(data.classicalRules).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  const timingEvidence = asArray(data.timingEvidence).map(asString).filter(Boolean);
  const adj = asRecord(data.ordinaryTransmissionAdjudication);
  const lrExtraPairs: Array<[string, string | undefined]> = [];
  if (timingEvidence.length > 0) {
    lrExtraPairs.push(['应期与旺衰线索', timingEvidence.slice(0, 3).join(' · ')]);
  }
  if (adj) {
    const adjStr = asString(adj.summary) ?? [asString(adj.verdict), asString(adj.reason)].filter(Boolean).join(' · ');
    if (adjStr) lrExtraPairs.push(['宗门取传裁决', adjStr]);
  }
  if (classicalRules.length > 0) {
    lrExtraPairs.push([
      '传统法则提示',
      classicalRules
        .slice(0, 4)
        .map((r) => asString(r.summary) ?? asString(r.title) ?? asString(r.name))
        .filter(Boolean)
        .join('；'),
    ]);
  }
  const lrExtraMeta = createMetaGrid(lrExtraPairs);
  if (lrExtraMeta) container.append(lrExtraMeta);

  return true;
}

function renderJinkoujue(container: HTMLElement, data: UnknownRecord): boolean {
  const gz = asRecord(data.ganzhi);
  const positions = asRecord(data.positions);
  if (!positions) return false;

  const yinYangUse = asRecord(data.yinYangUse);
  const usePos = asString(yinYangUse?.usePosition);
  const xunKong = asArray(data.xunKong).map(asString).filter((x): x is string => Boolean(x));

  const badges: Array<{ text: string; tone?: 'accent' | 'neutral' | 'good' | 'warn' }> = [];
  if (asString(data.methodLabel)) badges.push({ text: asString(data.methodLabel)!, tone: 'neutral' });
  if (asString(data.dayNight)) badges.push({ text: asString(data.dayNight)!, tone: 'neutral' });
  if (asString(yinYangUse?.pattern)) badges.push({ text: asString(yinYangUse?.pattern)!, tone: 'accent' });
  if (usePos) {
    badges.push({
      text: `用${usePos}${yinYangUse?.isVoid === true ? '（空）' : ''}`,
      tone: yinYangUse?.isVoid === true ? 'warn' : 'good',
    });
  }

  container.append(createBoardHeader('金口诀四位盘', formatGanzhiSubtitle(gz), badges));

  const monthLeader = asString(data.monthLeader);
  const divBranch = asString(data.divinationBranch);
  const calc = asRecord(data.calculation);
  const meta = createMetaGrid([
    ['月将', monthLeader && divBranch ? `${monthLeader}加${divBranch}` : monthLeader],
    ['贵人', asString(data.noblemanBranch)],
    ['地分', asString(data.diFenBranch)],
    ['旬空', xunKong.length > 0 ? xunKong.join('、') : '无'],
    ['遁干 / 贵神规则', [asString(calc?.yuanDunRule), asString(calc?.noblemanDirection)].filter(Boolean).join(' · ') || undefined],
  ]);
  if (meta) container.append(meta);

  // V1 经典四位竖排矩阵（人元 / 贵神 / 将神 / 地分）
  const table = el('div', 'jk-matrix');
  table.setAttribute('role', 'table');
  table.setAttribute('aria-label', '金口诀四位盘');

  const keys: Array<[string, 'renYuan' | 'guiShen' | 'jiangShen' | 'diFen']> = [
    ['人元', 'renYuan'],
    ['贵神', 'guiShen'],
    ['将神', 'jiangShen'],
    ['地分', 'diFen'],
  ];

  for (const [label, k] of keys) {
    const pos = asRecord(positions[k]);
    if (!pos) continue;
    const posName = asString(pos.name) ?? label;
    const isUsed = Boolean(usePos && posName === usePos);
    const isVoid = pos.isVoid === true;
    const stem = asString(pos.stem) ?? '';
    const branch = asString(pos.branch) ?? '';
    const god = asString(pos.god);
    const wx = asString(pos.element) ?? '';
    const yy = asString(pos.yinYang) ?? '';
    const season = asString(pos.seasonState) ?? '';
    const support = asArray(pos.support).map(asString).filter(Boolean);
    const constraints = asArray(pos.constraints).map(asString).filter(Boolean);

    const row = el('div', `jk-matrix-row${isUsed ? ' is-used' : ''}${isVoid ? ' is-void' : ''}`);
    row.setAttribute('role', 'row');

    const roleCell = el('div', 'jk-matrix-role-cell');
    roleCell.append(el('span', 'jk-pos-name', posName));
    if (isUsed) roleCell.append(el('span', 'wb-badge wb-badge-accent', '用'));
    if (isVoid) roleCell.append(el('span', 'wb-badge wb-badge-warn', '空'));
    row.append(roleCell);

    const gzEl = el('strong', 'jk-matrix-gz', `${stem}${branch}` || '—');
    if (wx) gzEl.dataset.wuxing = wx;
    row.append(gzEl);

    row.append(el('span', 'jk-matrix-god', god ? `乘${god}` : asString(pos.role) ?? '—'));
    row.append(el('span', 'jk-matrix-wx', [wx, yy].filter(Boolean).join(' · ') || '—'));
    const stateText = [
      `${season || '—'}${isVoid ? ' · 旬空' : ''}`,
      support.length > 0 ? `助:${support.join('/')}` : '',
      constraints.length > 0 ? `制:${constraints.join('/')}` : '',
    ]
      .filter(Boolean)
      .join(' · ');
    row.append(el('small', 'jk-matrix-state', stateText));

    table.append(row);
  }
  container.append(table);

  const movements = asArray(data.movements).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  if (movements.length > 0) {
    const movBox = el('div', 'lr-section');
    movBox.append(el('h4', 'lr-section-title', '五动三动'));
    const chipWrap = el('div', 'wb-chip-wrap');
    for (const m of movements) {
      const cat = asString(m.category) ?? '';
      const name = asString(m.name) ?? '';
      const from = asString(m.from) ?? '';
      const rel = asString(m.relation) ?? '';
      const to = asString(m.to) ?? '';
      const text = `${cat ? `${cat}·` : ''}${name}（${from}${rel}${to}）`;
      chipWrap.append(el('span', 'wb-badge wb-badge-accent', text));
    }
    movBox.append(chipWrap);
    container.append(movBox);
  }

  const relations = asRecord(data.relations);
  if (relations) {
    const relItems: Array<[string, string | undefined]> = [
      ['贵→将', asString(relations.guiToJiang)],
      ['贵→人', asString(relations.guiToRen)],
      ['人→将', asString(relations.renToJiang)],
      ['将→地', asString(relations.jiangToDi)],
      ['人→地', asString(relations.renToDi)],
      ['贵→地', asString(relations.guiToDi)],
    ];
    const relGrid = createMetaGrid(relItems);
    if (relGrid) container.append(relGrid);
  }

  if (asString(data.mainLine)) {
    container.append(el('p', 'wb-note-box', asString(data.mainLine)));
  }

  const focusList = asArray(data.focusEvidence).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  if (focusList.length > 0) {
    const fSec = el('div', 'lr-section');
    fSec.append(el('h4', 'lr-section-title', '四位用爻与象意脉络'));
    const list = el('div', 'wb-computed-list');
    for (const f of focusList) {
      const card = el('div', `wb-computed-item ${asString(f.level) === '主证' ? 'is-good' : ''}`.trim());
      card.append(
        el('strong', 'wb-computed-title', `${asString(f.level) ?? ''} · ${asString(f.target) ?? ''}`),
      );
      const desc = [asString(f.role), ...asArray(f.evidence).map(asString)].filter(Boolean).join('；');
      if (desc) card.append(el('p', 'wb-computed-desc', desc));
      list.append(card);
    }
    fSec.append(list);
    container.append(fSec);
  }

  const jkExtra = createMetaGrid([
    ['比和合断诗诀', asString(data.bihePoem)],
    ['排课口径', asString(yinYangUse?.rule)],
  ]);
  if (jkExtra) container.append(jkExtra);

  return true;
}

export function renderLiurenBoard(container: HTMLElement, method: string, rawData: unknown): boolean {
  const data = asRecord(rawData);
  if (!data) return false;
  if (method === 'jinkoujue') return renderJinkoujue(container, data);
  return renderDaLiuren(container, data);
}
