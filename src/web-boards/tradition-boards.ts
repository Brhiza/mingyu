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
  type UnknownRecord,
} from './dom';

const BAZHAI_DIR_ORDER = ['东南', '南', '西南', '东', '中', '西', '东北', '北', '西北'] as const;

const GUA_SYMBOLS: Record<string, string> = {
  乾: '☰',
  兑: '☱',
  离: '☲',
  震: '☳',
  巽: '☴',
  坎: '☵',
  艮: '☶',
  坤: '☷',
};

function renderBazhaiComparisonBody(
  host: HTMLElement,
  comp: UnknownRecord | undefined,
  person: UnknownRecord | undefined,
  house: UnknownRecord | undefined,
  mingPalace: UnknownRecord | undefined,
) {
  host.replaceChildren();
  const mingGua = asString(comp?.mingGua) ?? asString(person?.gua) ?? '';
  const mingGroup = asString(comp?.mingGroup) ?? asString(person?.group) ?? '';
  const houseGua = asString(comp?.houseGua) ?? asString(house?.houseGua) ?? '';
  const match = asString(comp?.match) ?? '';

  const dirList = asArray(comp?.directions).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  const starList = asArray(mingPalace?.starPalaces).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  const dirMap = new Map<string, UnknownRecord>();
  for (const d of dirList) {
    const k = asString(d.direction);
    if (k) dirMap.set(k, d);
  }
  const starMap = new Map<string, UnknownRecord>();
  for (const s of starList) {
    const k = asString(s.direction);
    if (k) starMap.set(k, s);
  }

  if (dirMap.size > 0) {
    const grid = el('div', 'bz-eight-grid');
    for (const dir of BAZHAI_DIR_ORDER) {
      if (dir === '中') {
        const center = el('div', 'bz-cell is-center');
        center.append(el('strong', 'bz-center-title', `命 ${GUA_SYMBOLS[mingGua] ?? ''}${mingGua || '—'}`));
        center.append(el('span', 'bz-center-sub', `宅 ${GUA_SYMBOLS[houseGua] ?? ''}${houseGua || '—'}`));
        if (match) center.append(el('span', `wb-badge ${match === '同组' ? 'wb-badge-good' : 'wb-badge-warn'}`, match));
        grid.append(center);
        continue;
      }

      const d = dirMap.get(dir);
      const st = starMap.get(dir);
      const mingLuck = asString(d?.mingLuck) ?? '';
      const houseLuck = asString(d?.houseLuck) ?? '';
      const guaName = asString(d?.gua) ?? '';
      const cell = el('div', `bz-cell${mingLuck === '吉' ? ' is-good' : mingLuck === '凶' ? ' is-warn' : ''}`);

      const head = el('div', 'bz-cell-head');
      head.append(el('span', 'bz-dir', `${dir} · ${GUA_SYMBOLS[guaName] ?? ''}${guaName}`));
      if (asString(st?.star)) {
        head.append(el('span', 'bz-star', asString(st?.star)));
      }
      cell.append(head);

      const rows = el('div', 'bz-cell-rows');
      if (asString(d?.ming)) {
        const r = el('div', 'bz-row');
        r.append(el('span', 'bz-row-k', '命'));
        r.append(el('span', `wb-badge ${mingLuck === '吉' ? 'wb-badge-good' : 'wb-badge-warn'}`, `${asString(d?.ming)}·${mingLuck}`));
        rows.append(r);
      }
      if (asString(d?.house)) {
        const r = el('div', 'bz-row');
        r.append(el('span', 'bz-row-k', '宅'));
        r.append(el('span', `wb-badge ${houseLuck === '吉' ? 'wb-badge-good' : 'wb-badge-warn'}`, `${asString(d?.house)}·${houseLuck}`));
        rows.append(r);
      }
      cell.append(rows);

      if (asString(st?.relation)) {
        cell.append(el('div', 'bz-rel', asString(st?.relation)));
      }
      grid.append(cell);
    }
    host.append(grid);
  }
}

function renderBazhai(container: HTMLElement, data: UnknownRecord): boolean {
  const persons = asArray(data.persons).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  const houses = asArray(data.houses).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  const comparisons = asArray(data.comparisons).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  const mingPalaces = asArray(data.mingPalaces).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  const comp = comparisons[0];
  const person = persons[0];
  const house = houses[0];
  if (!comp && !person && !house) return false;

  const mingGua = asString(comp?.mingGua) ?? asString(person?.gua) ?? '';
  const mingGroup = asString(comp?.mingGroup) ?? asString(person?.group) ?? '';
  const houseGua = asString(comp?.houseGua) ?? asString(house?.houseGua) ?? '';
  const houseGroup = asString(comp?.houseGroup) ?? '';
  const match = asString(comp?.match) ?? '';

  const badges: Array<{ text: string; tone?: 'accent' | 'neutral' | 'good' | 'warn' }> = [];
  if (mingGua) badges.push({ text: `命卦 ${mingGua}${mingGroup ? `（${mingGroup}）` : ''}`, tone: 'accent' });
  if (houseGua) badges.push({ text: `宅卦 ${houseGua}${houseGroup ? `（${houseGroup}）` : ''}`, tone: 'neutral' });
  if (match) badges.push({ text: match, tone: match === '同组' ? 'good' : 'warn' });

  const year = asNumber(person?.year);
  const gender = asString(person?.gender);
  const subtitle = [
    year !== undefined ? `${year}年` : '',
    gender === 'female' ? '女命' : gender === 'male' ? '男命' : '',
    house ? `坐${asString(house.sitMountain) ?? ''}向${asString(house.facingMountain) ?? ''}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  container.append(createBoardHeader('八宅命卦与八方吉凶盘', subtitle || undefined, badges));

  const measurement = asRecord(data.measurement);
  const measWarnings = asArray(measurement?.warnings).map(asString).filter(Boolean);

  const bodyHost = el('div', 'bz-host');
  if (comparisons.length > 1) {
    const tabs = el('div', 'wb-tabs');
    const btns: HTMLButtonElement[] = [];
    comparisons.forEach((c, idx) => {
      const h = houses[idx];
      const label = h ? `坐${asString(h.sitMountain) ?? ''}向${asString(h.facingMountain) ?? ''}（${asString(c.houseGua) ?? ''}宅）` : `候选 ${idx + 1}`;
      const btn = el('button', `wb-tab${idx === 0 ? ' is-active' : ''}`, label);
      btn.type = 'button';
      btn.addEventListener('click', () => {
        btns.forEach((b, j) => b.classList.toggle('is-active', j === idx));
        renderBazhaiComparisonBody(bodyHost, c, person, h ?? house, mingPalaces[0]);
      });
      btns.push(btn);
      tabs.append(btn);
    });
    container.append(tabs);
  }
  renderBazhaiComparisonBody(bodyHost, comp, person, house, mingPalaces[0]);
  container.append(bodyHost);

  const measDeg = measurement ? asNumber(measurement.correctedDegree) : undefined;
  if (measDeg !== undefined || measWarnings.length > 0) {
    const bzBar = createBoardDetailBar([
      createBoardModalTrigger(
        '罗盘度数与校验',
        '八宅坐向测量度数与压线校验',
        () =>
          createMetaGrid([
            ['坐山向首', house ? `坐${asString(house.sitMountain) ?? ''}向${asString(house.facingMountain) ?? ''}` : undefined],
            ['测量度数', measDeg !== undefined ? `${measDeg}°（${asString(measurement?.stability) ?? ''}）` : undefined],
            ['命卦所属', mingGua ? `${mingGua}卦 · ${mingGroup}` : undefined],
            ['宅命关系', match || undefined],
            ['压线/罗盘提示', measWarnings.length > 0 ? measWarnings.join('；') : undefined],
          ]) ?? el('div'),
        measWarnings.length > 0 ? `${measWarnings.length}项` : undefined,
      ),
    ]);
    if (bzBar) container.append(bzBar);
  }

  return true;
}

function renderAlmanacDay(host: HTMLElement, day: UnknownRecord) {
  host.replaceChildren();
  const gz = asRecord(day.ganzhi);
  const trad = asRecord(day.traditionalFacts);
  const pengzu = asRecord(trad?.pengzu);
  const dailyDirs = asRecord(trad?.dailyDirections);
  const kongWang = asArray(trad?.kongWang).map(asString).filter(Boolean).join('');
  const screening = asRecord(day.screening);

  const meta = createMetaGrid([
    ['公历 / 农历', `${asString(day.date) ?? ''} ${asString(day.weekday) ?? ''} · ${asString(day.lunarDate) ?? ''}`],
    ['干支 / 纳音', gz ? `${asString(gz.year) ?? ''}年 ${asString(gz.month) ?? ''}月 ${asString(gz.day) ?? ''}日${asString(trad?.nayin) ? `（${asString(trad?.nayin)}${kongWang ? ` · 空${kongWang}` : ''}）` : ''}` : undefined],
    ['建除 / 黄黑道', [asString(day.dayOfficer) ? `${asString(day.dayOfficer)}日` : '', asString(day.twelveStar)].filter(Boolean).join(' · ') || undefined],
    ['星宿 / 九星', [asString(day.twentyEightStar) ? `${asString(day.twentyEightStar)}宿` : '', asString(day.nineStar) ? `${asString(day.nineStar)}星` : ''].filter(Boolean).join(' · ') || undefined],
    ['冲煞 / 胎神', [asString(trad?.zodiac) ? `属${asString(trad?.zodiac)}` : '', asString(day.clash), asString(trad?.fetusGod) ? `胎神${asString(trad?.fetusGod)}` : ''].filter(Boolean).join(' · ') || undefined],
    ['择日筛查', asString(screening?.status)],
  ]);
  if (meta) host.append(meta);

  if (dailyDirs) {
    const dirItems: Array<[string, string | undefined]> = [
      ['喜神方', asString(dailyDirs.joy)],
      ['财神方', asString(dailyDirs.wealth)],
      ['福神方', asString(dailyDirs.mascot)],
      ['阳贵方', asString(dailyDirs.yangGui)],
      ['阴贵方', asString(dailyDirs.yinGui)],
    ];
    const dirStrip = el('div', 'al-dirs-strip');
    for (const [k, v] of dirItems) {
      if (!v) continue;
      const pill = el('div', 'al-dir-pill');
      pill.append(el('span', 'al-dir-k', k), el('strong', 'al-dir-v', v));
      dirStrip.append(pill);
    }
    if (dirStrip.childElementCount > 0) host.append(dirStrip);
  }

  const recommends = asArray(day.recommends).map(asString).filter((x): x is string => Boolean(x));
  const avoids = asArray(day.avoids).map(asString).filter((x): x is string => Boolean(x));
  if (recommends.length > 0 || avoids.length > 0) {
    const yjGrid = el('div', 'al-yj-grid');
    const yiBox = el('div', 'al-yj-box is-yi');
    yiBox.append(el('div', 'al-yj-title', `宜（${recommends.length}）`));
    const yiWrap = el('div', 'wb-chip-wrap');
    for (const r of recommends.slice(0, 12)) {
      yiWrap.append(el('span', 'wb-badge wb-badge-good', r));
    }
    yiBox.append(yiWrap);

    const jiBox = el('div', 'al-yj-box is-ji');
    jiBox.append(el('div', 'al-yj-title', `忌（${avoids.length}）`));
    const jiWrap = el('div', 'wb-chip-wrap');
    for (const a of avoids.slice(0, 12)) {
      jiWrap.append(el('span', 'wb-badge wb-badge-warn', a));
    }
    jiBox.append(jiWrap);

    yjGrid.append(yiBox, jiBox);
    host.append(yjGrid);
  }

  const hours = asArray(day.hours).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  if (hours.length > 0) {
    const sec = el('div', 'lr-section');
    sec.append(el('h4', 'lr-section-title', `十三时段吉凶（${hours.length}）`));
    const hGrid = el('div', 'al-hours-grid');
    for (const h of hours) {
      const hScr = asRecord(h.screening);
      const status = asString(hScr?.status) ?? '';
      const isCaution = status.includes('忌') || status.includes('冲') || status.includes('限');
      const card = el('div', `al-hour-card${isCaution ? ' is-warn' : ''}`);
      const hTop = el('div', 'al-hour-top');
      hTop.append(el('strong', 'al-hour-name', asString(h.name) ?? '时辰'));
      hTop.append(el('span', 'al-hour-gz', asString(h.ganzhi) ?? ''));
      card.append(hTop);

      card.append(el('div', 'al-hour-range', `${asString(h.range) ?? ''} · ${asString(h.twelveStar) ?? ''}`));
      const hRecs = asArray(h.recommends).map(asString).filter((x): x is string => Boolean(x));
      if (hRecs.length > 0) {
        card.append(el('div', 'al-hour-yi', `宜：${hRecs.slice(0, 3).join('、')}`));
      }
      hGrid.append(card);
    }
    sec.append(hGrid);
    host.append(sec);
  }

  const hasPengzu = Boolean(pengzu && (asString(pengzu.stem) || asString(pengzu.branch)));
  if (hasPengzu || recommends.length > 12 || avoids.length > 12) {
    const alBar = createBoardDetailBar([
      createBoardModalTrigger(
        '彭祖百忌与完整宜忌',
        `${asString(day.date) ?? '当日'} 彭祖百忌与完整宜忌明细`,
        () => {
          const frag = document.createDocumentFragment();
          if (hasPengzu && pengzu) {
            const pz = el('div', 'wb-note-box');
            pz.append(el('strong', undefined, '彭祖百忌：'));
            pz.append([asString(pengzu.stem), asString(pengzu.branch)].filter(Boolean).join('；'));
            frag.append(pz);
          }
          if (recommends.length > 0) {
            const rSec = el('div', 'lr-section');
            rSec.append(el('h4', 'lr-section-title', `当日全部宜事（${recommends.length}）`));
            const wrap = el('div', 'wb-chip-wrap');
            for (const r of recommends) wrap.append(el('span', 'wb-badge wb-badge-good', r));
            rSec.append(wrap);
            frag.append(rSec);
          }
          if (avoids.length > 0) {
            const aSec = el('div', 'lr-section');
            aSec.append(el('h4', 'lr-section-title', `当日全部忌事（${avoids.length}）`));
            const wrap = el('div', 'wb-chip-wrap');
            for (const a of avoids) wrap.append(el('span', 'wb-badge wb-badge-warn', a));
            aSec.append(wrap);
            frag.append(aSec);
          }
          return frag;
        },
        `${recommends.length + avoids.length}项`,
      ),
    ]);
    if (alBar) host.append(alBar);
  }
}

function renderAlmanac(container: HTMLElement, data: UnknownRecord): boolean {
  const days = asArray(data.days).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  if (days.length === 0) return false;

  const input = asRecord(data.input);
  const topicLabel = asString(data.topicLabel);
  const recs = asRecord(data.recommendations);
  const preferredDays = asArray(recs?.preferredDays).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  const rankedDays = asArray(recs?.ranked).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  const rangeText = input
    ? `${asString(input.startDate) ?? ''} ~ ${asString(input.endDate) ?? ''}`
    : undefined;

  const badges: Array<{ text: string; tone?: 'accent' | 'neutral' | 'good' | 'warn' }> = [];
  if (topicLabel) badges.push({ text: topicLabel, tone: 'accent' });
  if (preferredDays.length > 0) badges.push({ text: `优选 ${preferredDays.length} 日`, tone: 'good' });
  badges.push({ text: `共 ${days.length} 日`, tone: 'neutral' });

  container.append(createBoardHeader('黄历择日看板', rangeText, badges));

  // 多日优选评分总览榜
  if (rankedDays.length > 1) {
    const rankSec = el('div', 'lr-section');
    rankSec.append(el('h4', 'lr-section-title', '择日优选总览排行'));
    const rankGrid = el('div', 'al-hours-grid');
    for (const r of rankedDays.slice(0, 6)) {
      const tier = asString(r.tier) ?? '';
      const isPref = tier === '优选';
      const isCaution = tier === '慎用';
      const card = el('div', `al-hour-card${isPref ? ' is-good' : isCaution ? ' is-warn' : ''}`);
      const top = el('div', 'al-hour-top');
      top.append(el('strong', 'al-hour-name', `${asString(r.date) ?? ''} ${asString(r.weekday) ?? ''}`));
      top.append(
        el(
          'span',
          `wb-badge ${isPref ? 'wb-badge-good' : isCaution ? 'wb-badge-warn' : 'wb-badge-neutral'}`,
          `${tier} ${asNumber(r.rankScore) ?? ''}分`,
        ),
      );
      card.append(top);
      card.append(
        el(
          'div',
          'al-hour-range',
          `${asString(r.lunarDate) ?? ''} · ${asString(r.dayOfficer) ?? ''}日${r.huangdao ? ' · 黄道' : ''}`,
        ),
      );
      const bestHours = asArray(r.bestHours)
        .map((h) => asString(asRecord(h)?.name))
        .filter(Boolean)
        .slice(0, 3)
        .join('、');
      if (bestHours) {
        card.append(el('div', 'al-hour-yi', `吉时：${bestHours}`));
      }
      rankGrid.append(card);
    }
    rankSec.append(rankGrid);
    container.append(rankSec);
  }

  const dayHost = el('div', 'al-day-host');
  if (days.length > 1) {
    const tabs = el('div', 'wb-tabs');
    const buttons: HTMLButtonElement[] = [];
    days.forEach((d, idx) => {
      const gz = asRecord(d.ganzhi);
      const label = `${asString(d.date) ?? `第${idx + 1}日`} ${asString(gz?.day) ?? ''}`;
      const btn = el('button', `wb-tab${idx === 0 ? ' is-active' : ''}`, label);
      btn.type = 'button';
      btn.addEventListener('click', () => {
        buttons.forEach((b, j) => b.classList.toggle('is-active', j === idx));
        renderAlmanacDay(dayHost, d);
      });
      buttons.push(btn);
      tabs.append(btn);
    });
    container.append(tabs);
  }

  renderAlmanacDay(dayHost, days[0]);
  container.append(dayHost);
  return true;
}

function renderNameAnalysisBody(host: HTMLElement, analysis: UnknownRecord) {
  host.replaceChildren();
  const sancai = asRecord(analysis.sancai);
  const sancaiEv = asRecord(analysis.sancaiEvidence);
  const grids = asRecord(analysis.grids);
  const gridDerivations = asArray(analysis.gridDerivations)
    .map(asRecord)
    .filter((x): x is UnknownRecord => Boolean(x));
  const derivByKey = new Map<string, UnknownRecord>();
  for (const gd of gridDerivations) {
    const k = asString(gd.key);
    if (k) derivByKey.set(k, gd);
  }
  const chars = asArray(analysis.chars).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  const tonePattern = asRecord(analysis.tonePattern);
  const successLuck = asString(analysis.successLuck);
  const foundationLuck = asString(analysis.foundationLuck);
  const preferredEls = asArray(analysis.preferredElements).map(asString).filter(Boolean);
  const elMatches = asArray(analysis.elementMatches).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));

  const scPos = asArray(sancaiEv?.positions)
    .map(asRecord)
    .filter((x): x is UnknownRecord => Boolean(x))
    .map((p) => asString(p.explanation))
    .filter(Boolean)
    .join('；');
  const scRels = asArray(sancaiEv?.relations)
    .map(asRecord)
    .filter((x): x is UnknownRecord => Boolean(x))
    .map((r) => asString(r.explanation))
    .filter(Boolean)
    .join('；');

  if (sancai) {
    const scCard = el('div', 'nm-sancai-card');
    const scHead = el('div', 'nm-sancai-head');
    scHead.append(el('strong', 'nm-sancai-combo', `三才配置：${asString(sancai.combo) ?? '—'}`));
    const lv = asString(sancai.level);
    if (lv) {
      scHead.append(el('span', `wb-badge ${lv.includes('吉') ? 'wb-badge-good' : 'wb-badge-warn'}`, lv));
    }
    scHead.append(
      el(
        'span',
        'nm-sancai-rel',
        `天人${asString(sancai.tian_ren) ?? '—'} · 人地${asString(sancai.ren_di) ?? '—'}`,
      ),
    );
    scCard.append(scHead);
    if (asString(sancai.text)) scCard.append(el('p', 'nm-sancai-text', asString(sancai.text)));

    const extraMeta = createMetaGrid([
      ['成功运 / 基础运', [successLuck, foundationLuck].filter(Boolean).join(' ｜ ') || undefined],
      ['音律平仄', tonePattern ? `${asString(tonePattern.pattern) ?? ''}（${asString(tonePattern.rhythm) ?? ''}）` : undefined],
      [
        '喜用五行补益',
        preferredEls.length > 0
          ? `喜${preferredEls.join('、')}${elMatches.length > 0 ? `（命中${elMatches.map((m) => asString(m.char) ?? asString(m.element)).filter(Boolean).join('、')}）` : ''}`
          : undefined,
      ],
    ]);
    if (extraMeta) scCard.append(extraMeta);
    host.append(scCard);
  }

  const gridNotes: Array<{ title: string; expr?: string; text: string }> = [];
  if (grids) {
    const gridDefs: Array<[string, string]> = [
      ['tian', '天格'],
      ['ren', '人格'],
      ['di', '地格'],
      ['wai', '外格'],
      ['zong', '总格'],
    ];
    const gWrap = el('div', 'nm-five-grid');
    for (const [key, title] of gridDefs) {
      const g = asRecord(grids[key]);
      if (!g) continue;
      const deriv = derivByKey.get(key);
      const lv = asString(g.level) ?? '';
      const wx = asString(g.wuxing);
      const card = el('div', 'nm-grid-card');
      const top = el('div', 'nm-grid-top');
      top.append(el('span', 'nm-grid-title', `${title} · ${asString(g.role) ?? ''}`));
      if (lv) top.append(el('span', `wb-badge ${lv.includes('凶') ? 'wb-badge-warn' : 'wb-badge-good'}`, lv));
      card.append(top);

      const mid = el('div', 'nm-grid-mid');
      mid.append(el('strong', 'nm-grid-num', String(asNumber(g.num) ?? '—')));
      const wxEl = el('span', 'nm-grid-wx', wx ?? '');
      if (wx) wxEl.dataset.wuxing = wx;
      mid.append(wxEl);
      card.append(mid);

      if (asString(g.poem)) card.append(el('div', 'nm-grid-poem', asString(g.poem)));
      if (asString(g.keywords)) card.append(el('div', 'nm-grid-kw', asString(g.keywords)));
      if (asString(g.text)) {
        gridNotes.push({
          title: `${title}（第${asNumber(g.num) ?? ''}数 · ${asString(g.role) ?? ''} · ${lv}）`,
          expr: asString(deriv?.expression),
          text: asString(g.text)!,
        });
      }
      gWrap.append(card);
    }
    if (gWrap.childElementCount > 0) host.append(gWrap);
  }

  if (chars.length > 0) {
    const cGrid = el('div', 'nm-chars-grid');
    for (const ch of chars) {
      const card = el('div', 'nm-char-card');
      const wx = asString(ch.wuxing);
      const head = el('div', 'nm-char-head');
      const glyph = el('strong', 'nm-char-glyph', asString(ch.char) ?? '');
      if (wx) glyph.dataset.wuxing = wx;
      head.append(glyph);

      const info = el('div', 'nm-char-meta');
      info.append(el('span', 'nm-char-py', asString(ch.pinyin) ?? ''));
      const strokes = asNumber(ch.kangxiStrokes);
      info.append(
        el(
          'span',
          'nm-char-sub',
          `${wx ? `${wx}行` : ''}${strokes !== undefined ? ` · 康熙${strokes}画` : ''}${asString(ch.radical) ? ` · ${asString(ch.radical)}部` : ''}${asString(ch.structure) ? ` · ${asString(ch.structure)}` : ''}`,
        ),
      );
      head.append(info);
      card.append(head);
      if (asString(ch.definition)) {
        card.append(el('p', 'nm-char-def', asString(ch.definition)));
      }
      cGrid.append(card);
    }
    host.append(cGrid);
  }

  if (scPos || scRels || gridNotes.length > 0) {
    const nmBar = createBoardDetailBar([
      createBoardModalTrigger(
        '五格数理推演与详注',
        '三才数理推演依据与 81 数理详注',
        () => {
          const frag = document.createDocumentFragment();
          const scMeta = createMetaGrid([
            ['三才数理推导', [scPos, scRels].filter(Boolean).join(' ｜ ') || undefined],
            ['成功运（天→人）', successLuck],
            ['基础运（人→地）', foundationLuck],
          ]);
          if (scMeta) frag.append(scMeta);
          if (gridNotes.length > 0) {
            const list = el('div', 'wb-computed-list');
            for (const item of gridNotes) {
              const card = el('div', 'wb-computed-item');
              card.append(el('strong', 'wb-computed-title', `${item.title}${item.expr ? ` · ${item.expr}` : ''}`));
              card.append(el('p', 'wb-computed-desc', item.text));
              list.append(card);
            }
            frag.append(list);
          }
          return frag;
        },
        gridNotes.length > 0 ? `${gridNotes.length}格` : undefined,
      ),
    ]);
    if (nmBar) host.append(nmBar);
  }
}

function renderChineseName(container: HTMLElement, method: string, data: UnknownRecord): boolean {
  if (method === 'chinese-naming') {
    const candidates = asArray(data.candidates).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
    if (candidates.length === 0) return false;
    const input = asRecord(data.input);
    container.append(
      createBoardHeader(
        '智能起名候选评估',
        input ? `姓氏 ${asString(input.surname) ?? ''} · 共 ${candidates.length} 组方案` : undefined,
        candidates.slice(0, 3).map((c) => ({ text: asString(c.fullName) ?? '', tone: 'accent' })),
      ),
    );

    const tabs = el('div', 'wb-tabs');
    const bodyHost = el('div', 'nm-host');
    const btns: HTMLButtonElement[] = [];
    candidates.forEach((cand, idx) => {
      const btn = el('button', `wb-tab${idx === 0 ? ' is-active' : ''}`, asString(cand.fullName) ?? `方案${idx + 1}`);
      btn.type = 'button';
      btn.addEventListener('click', () => {
        btns.forEach((b, j) => b.classList.toggle('is-active', j === idx));
        const ana = asRecord(cand.analysis);
        if (ana) renderNameAnalysisBody(bodyHost, ana);
      });
      btns.push(btn);
      tabs.append(btn);
    });
    container.append(tabs);
    const firstAna = asRecord(candidates[0].analysis);
    if (firstAna) renderNameAnalysisBody(bodyHost, firstAna);
    container.append(bodyHost);
    return true;
  }

  const analysis = asRecord(data.analysis);
  if (!analysis) return false;
  const fullName = `${asString(analysis.surname) ?? ''}${asString(analysis.given) ?? ''}`;
  const sancai = asRecord(analysis.sancai);
  const badges: Array<{ text: string; tone?: 'accent' | 'neutral' | 'good' | 'warn' }> = [];
  if (asString(sancai?.combo)) badges.push({ text: `三才 ${asString(sancai?.combo)}`, tone: 'accent' });
  if (asString(sancai?.level)) {
    badges.push({
      text: asString(sancai?.level)!,
      tone: asString(sancai?.level)!.includes('吉') ? 'good' : 'warn',
    });
  }

  container.append(createBoardHeader(`姓名五格解析 · ${fullName || '姓名'}`, undefined, badges));
  const bodyHost = el('div', 'nm-host');
  renderNameAnalysisBody(bodyHost, analysis);
  container.append(bodyHost);
  return true;
}

function renderCharacterQuery(container: HTMLElement, data: UnknownRecord): boolean {
  const result = asRecord(data.result) ?? data;
  const chars = asArray(result.characters).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  if (chars.length === 0) return false;

  const text = asString(result.text) ?? '';
  const totalStrokes = asNumber(result.totalKangxiStrokes);
  const badges: Array<{ text: string; tone?: 'accent' | 'neutral' | 'good' | 'warn' }> = [];
  if (totalStrokes !== undefined) badges.push({ text: `康熙总笔画 ${totalStrokes}`, tone: 'accent' });

  container.append(
    createBoardHeader(
      `汉字解析${text ? ` · ${text}` : ''}`,
      `共 ${chars.length} 字`,
      badges,
    ),
  );

  const kangxiList: Array<{ ch: string; volume: string; text: string }> = [];
  const list = el('div', 'cq-list');
  for (const item of chars) {
    const detail = asRecord(item.detail) ?? item;
    const ch = asString(detail.char) ?? asString(item.char) ?? '';
    const trad = asString(detail.traditional);
    const wx = asString(detail.wuxing);

    const card = el('div', 'cq-card');
    const head = el('div', 'cq-head');
    const glyph = el('strong', 'cq-glyph', ch);
    if (wx) glyph.dataset.wuxing = wx;
    head.append(glyph);

    const metaCol = el('div', 'cq-meta');
    const titleLine = el('div', 'cq-title-line');
    if (asString(detail.pinyin)) titleLine.append(el('span', 'cq-pinyin', asString(detail.pinyin)));
    if (trad && trad !== ch) titleLine.append(el('span', 'wb-badge wb-badge-neutral', `繁：${trad}`));
    if (wx) titleLine.append(el('span', 'wb-badge wb-badge-accent', `五行：${wx}`));
    metaCol.append(titleLine);

    const subItems = [
      asNumber(detail.kangxiStrokes) !== undefined ? `康熙 ${asNumber(detail.kangxiStrokes)} 画` : '',
      asNumber(detail.simplifiedStrokes) !== undefined ? `简体 ${asNumber(detail.simplifiedStrokes)} 画` : '',
      asString(detail.radical) ? `部首 ${asString(detail.radical)}` : '',
      asString(detail.structure) ? `${asString(detail.structure)}结构` : '',
      asString(detail.kangxiVolume) ? `${asString(detail.kangxiVolume)} ${asString(detail.kangxiSection) ?? ''}`.trim() : '',
    ].filter(Boolean);
    if (subItems.length > 0) metaCol.append(el('div', 'cq-sub', subItems.join(' · ')));
    head.append(metaCol);
    card.append(head);

    if (asString(detail.definition)) {
      card.append(el('p', 'cq-def', asString(detail.definition)));
    }

    if (asString(detail.kangxiText)) {
      kangxiList.push({
        ch,
        volume: asString(detail.kangxiVolume) ? `${asString(detail.kangxiVolume)} ${asString(detail.kangxiSection) ?? ''}`.trim() : '',
        text: asString(detail.kangxiText)!,
      });
    }
    list.append(card);
  }
  container.append(list);

  if (kangxiList.length > 0) {
    const cqBar = createBoardDetailBar([
      createBoardModalTrigger(
        '康熙字典原文',
        `康熙字典原典释义（${kangxiList.map((k) => k.ch).join('')}）`,
        () => {
          const frag = document.createDocumentFragment();
          const itemsWrap = el('div', 'wb-computed-list');
          for (const k of kangxiList) {
            const box = el('div', 'wb-computed-item');
            box.append(el('strong', 'wb-computed-title', `「${k.ch}」${k.volume ? ` · ${k.volume}` : ''}`));
            box.append(el('p', 'cq-kangxi-text wb-computed-desc', k.text));
            itemsWrap.append(box);
          }
          frag.append(itemsWrap);
          return frag;
        },
        `${kangxiList.length}字`,
      ),
    ]);
    if (cqBar) container.append(cqBar);
  }
  return true;
}

const XLR_PALACE_META: Record<
  string,
  { finger: string; deity: string; element: string; direction: string; gridOrder: number }
> = {
  留连: { finger: '食指尖', deity: '玄武/螣蛇', element: '土', direction: '西南', gridOrder: 1 },
  速喜: { finger: '中指尖', deity: '朱雀', element: '火', direction: '正南', gridOrder: 2 },
  赤口: { finger: '无名指尖', deity: '白虎', element: '金', direction: '正西', gridOrder: 3 },
  大安: { finger: '食指根', deity: '青龙', element: '木', direction: '正东', gridOrder: 4 },
  空亡: { finger: '中指根', deity: '勾陈', element: '土', direction: '中央', gridOrder: 5 },
  小吉: { finger: '无名指根', deity: '六合', element: '水', direction: '正北', gridOrder: 6 },
};

const XLR_PALM_DISPLAY_ORDER = ['留连', '速喜', '赤口', '大安', '空亡', '小吉'] as const;

function renderXiaoliuren(container: HTMLElement, data: UnknownRecord): boolean {
  const primary = asRecord(data.primary);
  const sequence = asRecord(data.sequence);
  if (!primary && !sequence) return false;

  const primaryName = asString(primary?.name) ?? '';
  const primaryVerse = asString(primary?.verse) ?? '';
  const ruleLabel = asString(data.ruleLabel) ?? '通行掌诀';
  const methodLabel = asString(data.methodLabel) ?? '时间起课';
  const isGoodPalace = ['大安', '速喜', '小吉'].includes(primaryName);

  const badges: Array<{ text: string; tone?: 'accent' | 'neutral' | 'good' | 'warn' }> = [];
  if (primaryName) {
    badges.push({ text: `占得：${primaryName}`, tone: isGoodPalace ? 'good' : 'warn' });
  }
  badges.push({ text: ruleLabel, tone: 'accent' });
  badges.push({ text: methodLabel, tone: 'neutral' });

  const gz = asRecord(data.ganzhi);
  const lunarMonth = asNumber(data.lunarMonth);
  const lunarDay = asNumber(data.lunarDay);
  const isLeap = Boolean(data.isLeapMonth);
  const hourLabel = asString(data.hourLabel) ?? '';
  const subtitle = [
    lunarMonth !== undefined && lunarDay !== undefined
      ? `农历${isLeap ? '闰' : ''}${lunarMonth}月${lunarDay}日`
      : '',
    hourLabel,
    gz ? `${asString(gz.year) ?? ''}年 ${asString(gz.month) ?? ''}月 ${asString(gz.day) ?? ''}日 ${asString(gz.hour) ?? ''}时` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  container.append(createBoardHeader('小六壬掌诀六宫盘', subtitle || undefined, badges));

  const monthP = asRecord(sequence?.month);
  const dayP = asRecord(sequence?.day);
  const hourP = asRecord(sequence?.hour);
  const calc = asRecord(data.calculation);
  const ev = asRecord(data.evidenceAnalysis);
  const palaceDetails = asRecord(ev?.palaceDetails);
  const hourDetail = asRecord(palaceDetails?.hour);
  const sanGong = asRecord(ev?.sanGongAnalysis) ?? asRecord(data.sanGongAnalysis);

  const detailByName = new Map<string, UnknownRecord>();
  for (const stageKey of ['month', 'day', 'hour'] as const) {
    const det = asRecord(palaceDetails?.[stageKey]);
    const nm = asString(det?.name);
    if (det && nm) detailByName.set(nm, det);
  }

  const meta = createMetaGrid([
    [
      '主宫神兽与方位',
      primaryName
        ? `${primaryName}（${XLR_PALACE_META[primaryName]?.finger ?? ''}${hourDetail ? ` · ${asString(hourDetail.deity) ?? ''} · ${asString(hourDetail.element) ?? ''} · ${asString(hourDetail.direction) ?? ''} · 数${asArray(hourDetail.numbers).join('/')}` : ''}）`
        : undefined,
    ],
    ['三宫递推生克', [asString(sanGong?.monthToDay), asString(sanGong?.dayToHour), asString(sanGong?.tiYongRelation)].filter(Boolean).join('；') || asString(sanGong?.combinationSummary)],
  ]);
  if (meta) container.append(meta);

  if (primaryVerse) {
    const verseBox = el('div', 'wb-note-box');
    verseBox.append(el('strong', undefined, `【${primaryName}宫诗诀】`));
    verseBox.append(primaryVerse);
    container.append(verseBox);
  }

  const palaceOrder = asArray(data.palaceOrder)
    .map(asRecord)
    .filter((x): x is UnknownRecord => Boolean(x));
  const byName = new Map<string, UnknownRecord>();
  for (const p of palaceOrder) {
    const n = asString(p.name);
    if (n) byName.set(n, p);
  }

  // 左手三指六宫掌诀定位图（上排：留连、速喜、赤口；下排：大安、空亡、小吉）
  const palmSec = el('div', 'lr-section');
  palmSec.append(el('h4', 'lr-section-title', '左手三指六宫掌诀定位（顺时针起大安）'));
  const grid = el('div', 'xlr-palm-grid');
  for (const name of XLR_PALM_DISPLAY_ORDER) {
    const item = byName.get(name);
    const verse = asString(item?.verse) ?? (name === primaryName ? primaryVerse : '');
    const pMeta = XLR_PALACE_META[name];
    const det = detailByName.get(name);
    const isPrimary = name === primaryName;
    const good = ['大安', '速喜', '小吉'].includes(name);
    const card = el('div', `xlr-palm-card${isPrimary ? (good ? ' is-primary is-good' : ' is-primary is-warn') : ''}`);

    const top = el('div', 'al-hour-top');
    const titleWrap = el('div', 'xlr-title-wrap');
    titleWrap.append(el('strong', 'al-hour-name', name));
    if (pMeta?.finger) titleWrap.append(el('span', 'xlr-finger-tag', pMeta.finger));
    top.append(titleWrap);

    const stepTags: string[] = [];
    if (asString(monthP?.name) === name) stepTags.push('月');
    if (asString(dayP?.name) === name) stepTags.push('日');
    if (asString(hourP?.name) === name || isPrimary) stepTags.push('时·主');
    if (stepTags.length > 0) {
      top.append(
        el(
          'span',
          `wb-badge ${isPrimary ? (good ? 'wb-badge-good' : 'wb-badge-warn') : 'wb-badge-accent'}`,
          stepTags.join(' / '),
        ),
      );
    } else {
      top.append(el('span', `wb-badge ${good ? 'wb-badge-good' : 'wb-badge-warn'}`, good ? '吉宫' : '凶宫'));
    }
    card.append(top);

    const attrText = det
      ? `${asString(det.deity) ?? ''} · ${asString(det.element) ?? ''}${asString(det.yinYang) ?? ''} · ${asString(det.direction) ?? ''} · 数${asArray(det.numbers).join('/')}`
      : `${pMeta?.deity ?? ''} · ${pMeta?.element ?? ''} · ${pMeta?.direction ?? ''}`;
    card.append(el('div', 'xlr-attr-line', attrText));

    if (verse) {
      card.append(el('div', 'al-hour-range', verse));
    }
    grid.append(card);
  }
  palmSec.append(grid);
  container.append(palmSec);

  const stepStr =
    monthP && dayP && hourP
      ? `月落「${asString(monthP.name) ?? ''}」(${asNumber(calc?.monthCount) ?? '—'}步) → 日落「${asString(dayP.name) ?? ''}」(${asNumber(calc?.dayCount) ?? '—'}步) → 时落「${asString(hourP.name) ?? ''}」(${asNumber(calc?.hourCount) ?? '—'}步)`
      : undefined;
  const ruleStr = [asString(calc?.dayBoundary), asString(calc?.leapMonthRule)].filter(Boolean).join(' · ') || undefined;
  if (stepStr || ruleStr) {
    const xlrBar = createBoardDetailBar([
      createBoardModalTrigger(
        '起课步数与历法口径',
        '小六壬起课步数推导与换日闰月口径',
        () =>
          createMetaGrid([
            ['三传起课步数', stepStr],
            ['换日与闰月口径', ruleStr],
          ]) ?? el('div'),
      ),
    ]);
    if (xlrBar) container.append(xlrBar);
  }

  return true;
}

function renderWuyunLiuqi(container: HTMLElement, data: UnknownRecord): boolean {
  const chart = asRecord(data.chart) ?? data;
  const annualMovement = asRecord(chart.annualMovement);
  const sitian = asRecord(chart.sitian);
  const zaiquan = asRecord(chart.zaiquan);
  if (!annualMovement && !sitian && !zaiquan) return false;

  const input = asRecord(chart.input) ?? asRecord(data.input);
  const year = asNumber(input?.year);
  const yearGanZhi = asString(input?.yearGanZhi) ?? '';
  const annualRelation = asRecord(chart.annualRelation);
  const annualClass = asRecord(chart.annualClassification);
  const conformities = asRecord(chart.annualConformities);
  const conformityNames = asArray(conformities?.names)
    .map(asString)
    .filter((x): x is string => Boolean(x));

  const badges: Array<{ text: string; tone?: 'accent' | 'neutral' | 'good' | 'warn' }> = [];
  if (annualMovement) {
    badges.push({
      text: `岁运：${asString(annualMovement.name) ?? ''}${asString(annualMovement.strength) ?? ''}（${asString(annualMovement.toneName) ?? ''}）`,
      tone: 'accent',
    });
  }
  if (sitian) {
    badges.push({ text: `司天：${asString(sitian.name) ?? ''}`, tone: 'good' });
  }
  if (zaiquan) {
    badges.push({ text: `在泉：${asString(zaiquan.name) ?? ''}`, tone: 'neutral' });
  }
  for (const cf of conformityNames) {
    badges.push({ text: cf, tone: 'warn' });
  }

  const subtitle = [year !== undefined ? `${year}年` : '', yearGanZhi ? `${yearGanZhi}岁` : '']
    .filter(Boolean)
    .join(' · ');

  container.append(createBoardHeader('五运六气岁运与主客步数盘', subtitle || undefined, badges));

  const meta = createMetaGrid([
    [
      '岁运（大运）',
      annualMovement
        ? `${asString(annualMovement.name) ?? ''}${asString(annualMovement.strength) ?? ''} · ${asString(annualMovement.toneName) ?? ''}（${asString(annualMovement.basis) ?? ''}）`
        : undefined,
    ],
    ['司天 / 在泉', `${asString(sitian?.name) ?? '—'}司天 · ${asString(zaiquan?.name) ?? '—'}在泉`],
    [
      '气运相临关系',
      annualRelation
        ? `${asString(annualRelation.kind) ?? ''}（${asString(annualRelation.basis) ?? ''}）`
        : undefined,
    ],
    [
      '正对化与南北政',
      annualClass
        ? `司天${asString(annualClass.sitianTransformation) ?? ''} · ${asString(annualClass.governance) ?? ''}`
        : undefined,
    ],
    ['运气同化格局', conformityNames.length > 0 ? conformityNames.join('、') : '普通岁纪（无同化格）'],
  ]);
  if (meta) container.append(meta);

  const movementSteps = asArray(chart.movementSteps)
    .map(asRecord)
    .filter((x): x is UnknownRecord => Boolean(x));
  if (movementSteps.length > 0) {
    const sec = el('div', 'lr-section');
    sec.append(el('h4', 'lr-section-title', `五运五步主客运（共 ${movementSteps.length} 步）`));
    const mGrid = el('div', 'nm-five-grid');
    for (const step of movementSteps) {
      const hostM = asRecord(step.hostMovement);
      const guestM = asRecord(step.guestMovement);
      const rel = asRecord(step.hostGuestRelation);
      const card = el('div', 'nm-grid-card');

      const top = el('div', 'nm-grid-top');
      top.append(el('span', 'nm-grid-title', asString(step.label) ?? '运步'));
      if (asString(rel?.kind)) {
        top.append(
          el(
            'span',
            `wb-badge ${asString(rel?.kind)?.includes('克') ? 'wb-badge-warn' : 'wb-badge-good'}`,
            asString(rel?.kind),
          ),
        );
      }
      card.append(top);

      card.append(
        el(
          'div',
          'nm-grid-poem',
          `主运：${asString(hostM?.toneName) ?? ''}${asString(hostM?.element) ?? ''} · 客运：${asString(guestM?.toneName) ?? ''}${asString(guestM?.element) ?? ''}`,
        ),
      );
      const dateSpan =
        asString(step.gregorianStart) && asString(step.gregorianEnd)
          ? `${asString(step.gregorianStart)} ~ ${asString(step.gregorianEnd)}`
          : asString(step.periodRule);
      if (dateSpan) {
        card.append(el('div', 'nm-grid-kw', dateSpan));
      }
      mGrid.append(card);
    }
    sec.append(mGrid);
    container.append(sec);
  }

  const qiSteps = asArray(chart.qiSteps)
    .map(asRecord)
    .filter((x): x is UnknownRecord => Boolean(x));
  if (qiSteps.length > 0) {
    const sec = el('div', 'lr-section');
    sec.append(el('h4', 'lr-section-title', `六气六步主客气（共 ${qiSteps.length} 步）`));
    const qGrid = el('div', 'al-hours-grid');
    for (const step of qiSteps) {
      const hostQ = asRecord(step.hostQi);
      const guestQ = asRecord(step.guestQi);
      const rel = asRecord(step.hostGuestRelation);
      const role = asString(step.guestRole);
      const terms = asArray(step.solarTerms).map(asString).filter((x): x is string => Boolean(x));

      const card = el('div', `al-hour-card${role ? ' is-good' : ''}`);
      const top = el('div', 'al-hour-top');
      top.append(
        el('strong', 'al-hour-name', `${asString(step.label) ?? ''}${role ? `（${role}）` : ''}`),
      );
      if (asString(rel?.kind)) {
        top.append(
          el(
            'span',
            `wb-badge ${asString(rel?.kind)?.includes('克') ? 'wb-badge-warn' : 'wb-badge-good'}`,
            asString(rel?.kind),
          ),
        );
      }
      card.append(top);

      card.append(
        el(
          'div',
          'al-hour-range',
          `主气：${asString(hostQ?.name) ?? '—'} ｜ 客气：${asString(guestQ?.name) ?? '—'}`,
        ),
      );
      const termText = [
        terms.join(' · '),
        asString(step.gregorianStart) && asString(step.gregorianEnd)
          ? `${asString(step.gregorianStart)} ~ ${asString(step.gregorianEnd)}`
          : '',
      ]
        .filter(Boolean)
        .join(' · ');
      if (termText) {
        card.append(el('div', 'al-hour-yi', termText));
      }
      qGrid.append(card);
    }
    sec.append(qGrid);
    container.append(sec);
  }

  const conformityFacts = asArray(conformities?.facts)
    .map(asRecord)
    .filter((x): x is UnknownRecord => Boolean(x))
    .filter((x) => x.matched === true);
  const patho = asRecord(chart.pathomechanism);
  if (conformityFacts.length > 0 || patho) {
    const wyBar = createBoardDetailBar([
      createBoardModalTrigger(
        '同化依据与病机文献',
        '五运六气同化依据与病机治则文献参考',
        () => {
          const frag = document.createDocumentFragment();
          if (conformityFacts.length > 0) {
            const cfWrap = el('div', 'wb-computed-list');
            for (const cf of conformityFacts) {
              const card = el('div', 'wb-computed-item is-good');
              card.append(el('strong', 'wb-computed-title', `运气同化 · ${asString(cf.name) ?? ''}`));
              if (asString(cf.rule)) card.append(el('p', 'wb-computed-desc', asString(cf.rule)));
              if (asString(cf.basis)) card.append(el('small', 'wb-computed-quote', asString(cf.basis)));
              cfWrap.append(card);
            }
            frag.append(cfWrap);
          }
          if (patho) {
            const classRef = asRecord(patho.classicalReference);
            const pBox = el('div', 'wb-note-box');
            pBox.append(
              el(
                'strong',
                undefined,
                `病机与治则文献参考（${asString(patho.movementRegime) ?? ''} · ${asString(patho.pingQiType) ?? ''}）：`,
              ),
            );
            const parts = [
              asString(patho.affectedZangFu),
              asString(patho.climaticPathology) ? `候象：${asString(patho.climaticPathology)}` : '',
              asString(patho.treatmentGuideline) ? `治则：${asString(patho.treatmentGuideline)}` : '',
              asString(patho.summary),
              classRef && asString(classRef.source) ? `典据：${asString(classRef.source)}` : '',
            ].filter(Boolean);
            pBox.append(parts.join('；'));
            frag.append(pBox);
          }
          return frag;
        },
        conformityFacts.length > 0 ? `${conformityFacts.length}项` : undefined,
      ),
    ]);
    if (wyBar) container.append(wyBar);
  }

  return true;
}

function renderNumberEnergy(container: HTMLElement, data: UnknownRecord): boolean {
  const normalized = asString(data.normalized) ?? '';
  const primaryNum = asRecord(data.primaryNumerology);
  const sumNum = asRecord(data.sumNumerology);
  if (!normalized && !primaryNum) return false;

  const input = asRecord(data.input);
  const purposeMap: Record<string, string> = {
    phone: '手机号码',
    plate: '车牌号码',
    general: '数字字母编号',
  };
  const purposeLabel = purposeMap[asString(input?.purpose) ?? 'general'] ?? '数字能量';
  const primaryIndex = asNumber(data.primaryIndex);
  const sumIndex = asNumber(data.sumIndex);
  const dominantFields = asArray(data.dominantFields)
    .map(asString)
    .filter((x): x is string => Boolean(x));
  const summary = asRecord(data.magneticSummary);
  const oddCount = asNumber(data.oddCount);
  const evenCount = asNumber(data.evenCount);
  const digitSum = asNumber(data.digitSum);
  const repeatedGroups = asArray(data.repeatedGroups)
    .map(asRecord)
    .filter((x): x is UnknownRecord => Boolean(x))
    .map((g) => asString(g.digits) ?? asString(g.value))
    .filter(Boolean);
  const modifiers = asArray(data.modifiers).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));

  const badges: Array<{ text: string; tone?: 'accent' | 'neutral' | 'good' | 'warn' }> = [
    { text: purposeLabel, tone: 'neutral' },
  ];
  if (primaryIndex !== undefined && primaryNum) {
    const lv = asString(primaryNum.level) ?? '';
    badges.push({
      text: `主数 ${primaryIndex}（${lv}）`,
      tone: lv.includes('吉') ? 'good' : 'warn',
    });
  }
  if (dominantFields.length > 0) {
    badges.push({ text: `主导磁场：${dominantFields.join('、')}`, tone: 'accent' });
  }
  if (oddCount !== undefined && evenCount !== undefined) {
    badges.push({ text: `奇${oddCount} 偶${evenCount}`, tone: 'neutral' });
  }

  container.append(
    createBoardHeader(
      `数字能量八星磁场盘 · ${normalized}`,
      asString(data.energySequence) ? `展开序列：${asString(data.energySequence)}` : undefined,
      badges,
    ),
  );

  const meta = createMetaGrid([
    ['归一号码', normalized],
    ['展开数字序列', asString(data.energySequence)],
    ['数位统计', [digitSum !== undefined ? `数字和 ${digitSum}` : '', oddCount !== undefined && evenCount !== undefined ? `阳奇${oddCount} · 阴偶${evenCount}` : '', repeatedGroups.length > 0 ? `伏位重号：${repeatedGroups.join('、')}` : ''].filter(Boolean).join(' · ') || undefined],
    [
      '81数理（主数）',
      primaryNum
        ? `第 ${primaryIndex ?? '—'} 数 · ${asString(primaryNum.poem) ?? ''}（${asString(primaryNum.level) ?? ''} · ${asString(primaryNum.keywords) ?? ''}）`
        : undefined,
    ],
    [
      '81数理（总和数）',
      sumNum
        ? `第 ${sumIndex ?? '—'} 数 · ${asString(sumNum.poem) ?? ''}（${asString(sumNum.level) ?? ''} · ${asString(sumNum.keywords) ?? ''}）`
        : undefined,
    ],
    ['主导八星磁场', dominantFields.length > 0 ? dominantFields.join('、') : '各星分布均衡'],
    [
      '八星性质分布',
      summary
        ? `共 ${asNumber(summary.pairCount) ?? 0} 组（助益 ${asNumber(summary.supportiveCount) ?? 0} · 守成 ${asNumber(summary.steadyCount) ?? 0} · 考验 ${asNumber(summary.challengingCount) ?? 0}）`
        : undefined,
    ],
  ]);
  if (meta) container.append(meta);

  const hasPrimaryText = Boolean(asString(primaryNum?.text));
  const hasSumText = Boolean(asString(sumNum?.text) && sumIndex !== primaryIndex);

  const dist = asArray(data.magneticDistribution)
    .map(asRecord)
    .filter((x): x is UnknownRecord => Boolean(x));
  if (dist.length > 0) {
    const wrap = el('div', 'wb-chip-wrap');
    for (const d of dist) {
      const nature = asString(d.nature) ?? '';
      const tone = nature === '助益' ? 'wb-badge-good' : nature === '考验' ? 'wb-badge-warn' : 'wb-badge-neutral';
      wrap.append(
        el(
          'span',
          `wb-badge ${tone}`,
          `${asString(d.name) ?? ''} ×${asNumber(d.count) ?? 0}（${nature}）`,
        ),
      );
    }
    container.append(wrap);
  }

  const pairs = asArray(data.energyPairs)
    .map(asRecord)
    .filter((x): x is UnknownRecord => Boolean(x));
  const segments = asArray(data.magneticSegments)
    .map(asRecord)
    .filter((x): x is UnknownRecord => Boolean(x));

  if (pairs.length > 0) {
    const sec = el('div', 'lr-section');
    sec.append(el('h4', 'lr-section-title', `逐段八星磁场解析（共 ${pairs.length} 组）`));
    const pGrid = el('div', 'al-hours-grid');
    for (const p of pairs) {
      const nature = asString(p.nature) ?? '';
      const isGood = nature === '助益';
      const isWarn = nature === '考验';
      const card = el('div', `al-hour-card${isGood ? ' is-good' : isWarn ? ' is-warn' : ''}`);
      const top = el('div', 'al-hour-top');
      top.append(el('strong', 'al-hour-name', `${asString(p.span) ?? asString(p.pair) ?? ''} · ${asString(p.name) ?? ''}`));
      top.append(
        el(
          'span',
          `wb-badge ${isGood ? 'wb-badge-good' : isWarn ? 'wb-badge-warn' : 'wb-badge-neutral'}`,
          nature || '磁场',
        ),
      );
      card.append(top);

      const trigram = asRecord(p.trigramEvidence);
      if (asString(trigram?.explanation)) {
        card.append(el('div', 'al-hour-range', asString(trigram?.explanation)));
      }
      if (asString(p.meaning)) {
        card.append(el('div', 'al-hour-yi', asString(p.meaning)));
      }
      pGrid.append(card);
    }
    sec.append(pGrid);
    container.append(sec);
  } else if (segments.length > 0) {
    const sec = el('div', 'lr-section');
    sec.append(el('h4', 'lr-section-title', `磁场分段（共 ${segments.length} 段）`));
    const sGrid = el('div', 'al-hours-grid');
    for (const s of segments) {
      const card = el('div', 'al-hour-card');
      card.append(
        el('strong', 'al-hour-name', `${asString(s.span) ?? ''} · ${asString(s.name) ?? ''}（${asString(s.nature) ?? ''}）`),
      );
      sGrid.append(card);
    }
    sec.append(sGrid);
    container.append(sec);
  }

  if (hasPrimaryText || hasSumText || modifiers.length > 0) {
    const neBar = createBoardDetailBar([
      createBoardModalTrigger(
        '数理详注与调节依据',
        '81数理详注与 0/5 夹杂显隐调节依据',
        () => {
          const frag = document.createDocumentFragment();
          if (hasPrimaryText || hasSumText) {
            const numNote = el('div', 'wb-note-box');
            if (hasPrimaryText) {
              numNote.append(el('strong', undefined, `主数${primaryIndex ?? ''}详注：`), document.createTextNode(asString(primaryNum?.text)!));
            }
            if (hasSumText) {
              if (hasPrimaryText) numNote.append(el('br'));
              numNote.append(el('strong', undefined, `总和数${sumIndex ?? ''}详注：`), document.createTextNode(asString(sumNum?.text)!));
            }
            frag.append(numNote);
          }
          if (modifiers.length > 0) {
            const modSec = el('div', 'lr-section');
            modSec.append(el('h4', 'lr-section-title', `0 / 5 夹杂与显隐调节（${modifiers.length} 处）`));
            const list = el('div', 'wb-computed-list');
            for (const m of modifiers) {
              const card = el('div', 'wb-computed-item');
              card.append(
                el(
                  'strong',
                  'wb-computed-title',
                  `数字 ${asNumber(m.digit) ?? ''}（第${asNumber(m.position) ?? ''}位 · ${asString(m.placement) ?? ''} · ${asString(m.effect) ?? ''}）`,
                ),
              );
              if (asString(m.meaning)) card.append(el('p', 'wb-computed-desc', asString(m.meaning)));
              list.append(card);
            }
            modSec.append(list);
            frag.append(modSec);
          }
          return frag;
        },
        modifiers.length > 0 ? `${modifiers.length}处` : undefined,
      ),
    ]);
    if (neBar) container.append(neBar);
  }

  return true;
}

export function renderTraditionBoard(container: HTMLElement, method: string, rawData: unknown): boolean {
  const data = asRecord(rawData);
  if (!data) return false;
  switch (method) {
    case 'bazhai':
      return renderBazhai(container, data);
    case 'almanac':
      return renderAlmanac(container, data);
    case 'chinese-name':
    case 'chinese-naming':
      return renderChineseName(container, method, data);
    case 'character-query':
      return renderCharacterQuery(container, data);
    case 'xiaoliuren':
      return renderXiaoliuren(container, data);
    case 'wuyun-liuqi':
      return renderWuyunLiuqi(container, data);
    case 'number-energy':
      return renderNumberEnergy(container, data);
    default:
      return false;
  }
}
