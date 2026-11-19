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

const renderTokens = new WeakMap<HTMLElement, number>();

export function clearVisualBoard(container: HTMLElement): void {
  renderTokens.set(container, (renderTokens.get(container) ?? 0) + 1);
  container.replaceChildren();
  container.hidden = true;
}

function resolvePayload(method: string, value: unknown): { effectiveMethod: string; data: unknown } {
  const rec = asRecord(value);
  const rawData = rec && 'data' in rec ? rec.data : value;
  const dataRec = asRecord(rawData);

  if (method === 'random-divination' && dataRec) {
    const selected = asString(dataRec.selectedMethod);
    if (selected && 'result' in dataRec) {
      return { effectiveMethod: selected, data: dataRec.result };
    }
    if (selected) {
      return { effectiveMethod: selected, data: rawData };
    }
  }
  return { effectiveMethod: method, data: rawData };
}

function normalizeBaziPayload(raw: unknown): unknown {
  const rec = asRecord(raw);
  if (!rec) return raw;
  if ('chart' in rec && rec.chart) return rec;
  if ('pillars' in rec && rec.pillars) {
    return {
      chart: {
        basis: rec.basis ?? (rec.calculationClock ? { localDateTime: String(rec.calculationClock) } : undefined),
        pillars: rec.pillars,
        shensha: rec.shensha,
      },
    };
  }
  return raw;
}

function prefixBoardTitle(host: HTMLElement, personLabel: string | undefined) {
  if (!personLabel) return;
  const titleEl = host.querySelector<HTMLElement>('.board-title, .wb-title');
  if (titleEl && titleEl.textContent && !titleEl.textContent.includes(personLabel)) {
    titleEl.textContent = `${personLabel} · ${titleEl.textContent}`;
  }
}

function extractSummaryInfo(value: unknown): { title?: string; tags: string[]; lines: string[] } {
  const rec = asRecord(value);
  const summary = asRecord(rec?.summary);
  return {
    title: asString(summary?.title),
    tags: asArray(summary?.tags).map(asString).filter((x): x is string => Boolean(x)),
    lines: asArray(summary?.lines).map(asString).filter((x): x is string => Boolean(x)),
  };
}

function renderBaziZiweiCorroborationCard(dataRec: UnknownRecord): HTMLElement | null {
  const corr = asRecord(dataRec.corroboration);
  const themes = asArray(dataRec.themes).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  if (!corr && themes.length === 0) return null;

  const shell = el('section', 'wb-shell');
  shell.setAttribute('aria-label', '八字与紫微斗数合参互证摘要');

  const shaYao = asRecord(corr?.shaYao);
  const guiRen = asRecord(corr?.guiRen);
  const badges: Array<{ text: string; tone?: 'accent' | 'neutral' | 'good' | 'warn' }> = [
    { text: '星平合参', tone: 'accent' },
  ];
  if (shaYao) {
    badges.push({
      text: Boolean(shaYao.isHarmonized) ? '煞刃相济' : '刚柔观察',
      tone: Boolean(shaYao.isHarmonized) ? 'good' : 'neutral',
    });
  }
  if (guiRen) {
    badges.push({
      text: Boolean(guiRen.isDoubleBlessed) ? '贵星并见' : '贵人观察',
      tone: Boolean(guiRen.isDoubleBlessed) ? 'good' : 'neutral',
    });
  }

  shell.append(
    createBoardHeader(
      '八字 · 紫微斗数双盘合参互证',
      asString(corr?.summary) ?? '双盘星神交会、煞刃相济与十维生命主题合参',
      badges,
    ),
  );

  const meta = createMetaGrid([
    ['煞曜与羊刃互证', asString(shaYao?.judgment)],
    ['贵人与吉辅互证', asString(guiRen?.judgment)],
  ]);
  if (meta) shell.append(meta);

  if (themes.length > 0) {
    const tSec = el('div', 'lr-section');
    tSec.append(el('h4', 'lr-section-title', `十维生命主题合参对照（${themes.length} 维）`));
    const tGrid = el('div', 'al-hours-grid');
    const pillarNames: Record<string, string> = { year: '年', month: '月', day: '日', hour: '时' };
    for (const th of themes) {
      const card = el('div', 'al-hour-card');
      const pillars = asArray(th.pillars).map((p) => pillarNames[asString(p) ?? ''] ?? asString(p)).filter(Boolean).join('/');
      const palaces = asArray(th.palaces).map(asString).filter(Boolean).join('·');
      card.append(el('strong', 'al-hour-name', asString(th.label) ?? '主题'));
      card.append(el('div', 'al-hour-range', `八字：${pillars || '全盘'} ｜ 紫微：${palaces || '—'}`));
      tGrid.append(card);
    }
    tSec.append(tGrid);
    shell.append(tSec);
  }

  const shownJudgments = new Set(
    [asString(shaYao?.judgment), asString(guiRen?.judgment)].filter((v): v is string => Boolean(v)),
  );
  const points = asArray(corr?.corroborationPoints)
    .map(asString)
    .filter((x): x is string => typeof x === 'string' && x.length > 0 && !shownJudgments.has(x));
  if (points.length > 0) {
    const note = el('div', 'wb-note-box');
    note.append(el('strong', undefined, '跨体系互证要点：'));
    note.append(points.join('；'));
    shell.append(note);
  }

  return shell;
}

function appendQimenLifetimeExtras(shell: HTMLElement, dataRec: UnknownRecord) {
  const basis = asRecord(dataRec.basis);
  const decadalLuck = asRecord(basis?.decadalLuck);
  const markers = asArray(dataRec.personalMarkers)
    .map(asRecord)
    .filter((x): x is UnknownRecord => Boolean(x));
  const topicCands = asArray(dataRec.topicCandidates)
    .map(asRecord)
    .filter((x): x is UnknownRecord => Boolean(x));
  const stages = asArray(dataRec.stages)
    .map(asRecord)
    .filter((x): x is UnknownRecord => Boolean(x));

  if (decadalLuck) {
    const startAge = asRecord(decadalLuck.startAge);
    const ageStr = startAge
      ? `${asNumber(startAge.years) ?? 0}岁${asNumber(startAge.months) ? `${asNumber(startAge.months)}月` : ''}${asNumber(startAge.days) ? `${asNumber(startAge.days)}天` : ''}`
      : undefined;
    const luckMeta = createMetaGrid([
      ['终身大限顺逆', asString(decadalLuck.direction)],
      ['起运岁数 / 时间', [ageStr, asString(decadalLuck.startDateTime)].filter(Boolean).join(' · ') || undefined],
      ['行限口径', [asString(decadalLuck.rule), asString(decadalLuck.mapping)].filter(Boolean).join(' · ') || undefined],
    ]);
    if (luckMeta) shell.append(luckMeta);
  }

  if (markers.length > 0) {
    const sec = el('div', 'lr-section');
    sec.append(el('h4', 'lr-section-title', `终身局个人标记（共 ${markers.length} 项）`));
    const mGrid = el('div', 'al-hours-grid');
    for (const m of markers) {
      const card = el('div', 'al-hour-card is-good');
      const top = el('div', 'al-hour-top');
      top.append(el('strong', 'al-hour-name', `${asString(m.value) ?? ''} · ${asString(m.palaceName) ?? ''}`));
      const layerRaw = asString(m.layer);
      if (layerRaw) {
        const layerLabelMap: Record<string, string> = {
          tianPan: '天盘干',
          diPan: '地盘干',
          baseGong: '本命落宫',
          anGan: '暗干',
          zhiFu: '值符',
          zhiShi: '值使',
        };
        top.append(el('span', 'wb-badge wb-badge-accent', layerLabelMap[layerRaw] ?? layerRaw));
      }
      card.append(top);
      if (asString(m.traditionalSignificance)) {
        card.append(el('div', 'al-hour-range', asString(m.traditionalSignificance)));
      }
      mGrid.append(card);
    }
    sec.append(mGrid);
    shell.append(sec);
  }

  if (topicCands.length > 0) {
    const tSec = el('div', 'lr-section');
    tSec.append(el('h4', 'lr-section-title', `事项用神落宫（${topicCands.length} 类）`));
    const tWrap = el('div', 'wb-chip-wrap');
    for (const tc of topicCands) {
      const label = asString(tc.label) ?? asString(tc.topic) ?? '';
      const palaces = asArray(tc.palaces)
        .map((p) => asString(asRecord(p)?.name) ?? asString(p))
        .filter(Boolean)
        .join('·');
      const txt = [label, palaces, asString(tc.basis)].filter(Boolean).join('：');
      if (txt) tWrap.append(el('span', 'wb-badge wb-badge-neutral', txt));
    }
    tSec.append(tWrap);
    shell.append(tSec);
  }

  if (stages.length > 0) {
    const sec = el('div', 'lr-section');
    sec.append(el('h4', 'lr-section-title', `终身局大限阶段（共 ${stages.length} 阶）`));
    const sGrid = el('div', 'al-hours-grid');
    for (const st of stages) {
      const card = el('div', 'al-hour-card');
      const top = el('div', 'al-hour-top');
      const ageStart = asNumber(st.ageStart);
      const ageEnd = asNumber(st.ageEnd);
      top.append(
        el(
          'strong',
          'al-hour-name',
          `${asString(st.title) ?? `第${(asNumber(st.stageIndex) ?? 0) + 1}阶`}${
            ageStart !== undefined && ageEnd !== undefined ? `（${ageStart}–${ageEnd}岁）` : ''
          }`,
        ),
      );
      const domPalaces = asArray(st.dominantPalaces)
        .map((p) => asString(asRecord(p)?.name))
        .filter((x): x is string => Boolean(x));
      if (domPalaces.length > 0) {
        top.append(el('span', 'wb-badge wb-badge-good', domPalaces.join('·')));
      }
      card.append(top);
      if (asString(st.stageTheme)) {
        card.append(el('div', 'al-hour-range', asString(st.stageTheme)));
      }
      const spanText =
        asString(st.calendarStart) && asString(st.calendarEnd)
          ? `${asString(st.calendarStart)} ~ ${asString(st.calendarEnd)}`
          : undefined;
      if (spanText) {
        card.append(el('div', 'al-hour-yi', spanText));
      }
      sGrid.append(card);
    }
    sec.append(sGrid);
    shell.append(sec);
  }
}

export async function renderVisualBoard(
  container: HTMLElement,
  method: string,
  value: unknown,
): Promise<boolean> {
  const token = (renderTokens.get(container) ?? 0) + 1;
  renderTokens.set(container, token);

  const { effectiveMethod, data } = resolvePayload(method, value);
  if (!data) {
    clearVisualBoard(container);
    return false;
  }

  const dataRec = asRecord(data);
  let rendered = false;
  const tempHost = document.createElement('div');

  switch (effectiveMethod) {
    case 'bazi': {
      const { renderBaziBoard } = await import('./bazi-board');
      if (renderTokens.get(container) !== token) return false;
      rendered = renderBaziBoard(tempHost, value);
      break;
    }
    case 'ziwei': {
      const { renderZiweiBoard } = await import('./ziwei-board');
      if (renderTokens.get(container) !== token) return false;
      rendered = renderZiweiBoard(tempHost, value);
      break;
    }
    case 'bazi-ziwei': {
      const [{ renderBaziBoard }, { renderZiweiBoard }] = await Promise.all([
        import('./bazi-board'),
        import('./ziwei-board'),
      ]);
      if (renderTokens.get(container) !== token) return false;
      const charts = asRecord(dataRec?.charts);
      if (dataRec) {
        const corrCard = renderBaziZiweiCorroborationCard(dataRec);
        if (corrCard) tempHost.append(corrCard);
      }
      const baziHost = document.createElement('div');
      const ziweiHost = document.createElement('div');
      const okBazi = renderBaziBoard(baziHost, normalizeBaziPayload(charts?.bazi ?? value));
      const okZiwei = renderZiweiBoard(ziweiHost, charts?.ziwei ?? value);
      if (okBazi) tempHost.append(...Array.from(baziHost.childNodes));
      if (okZiwei) tempHost.append(...Array.from(ziweiHost.childNodes));
      rendered = okBazi || okZiwei;
      break;
    }
    case 'minglu': {
      const { renderMingluWikiBoard } = await import('./minglu-wiki-board');
      if (renderTokens.get(container) !== token) return false;
      rendered = renderMingluWikiBoard(tempHost, value);
      break;
    }
    case 'bazi-synastry': {
      const { renderBaziBoard } = await import('./bazi-board');
      if (renderTokens.get(container) !== token) return false;
      const charts = asRecord(dataRec?.charts);
      const input = asRecord(dataRec?.input);
      const p1Name = asString(asRecord(input?.person1)?.name) ?? '命主一';
      const p2Name = asString(asRecord(input?.person2)?.name) ?? '命主二';
      const compat = asRecord(dataRec?.compatibility);
      const dmRel = asRecord(compat?.dayMasterRelation);
      const finalCov = asRecord(compat?.finalUsefulGodCoverage);
      const p1Cov = asRecord(finalCov?.person1FromPerson2);
      const p2Cov = asRecord(finalCov?.person2FromPerson1);
      const sumInfo = extractSummaryInfo(value);

      const headerShell = el('section', 'wb-shell');
      headerShell.setAttribute('aria-label', '八字合盘关系摘要');
      const badges: Array<{ text: string; tone?: 'accent' | 'neutral' | 'good' | 'warn' }> = [
        { text: `${p1Name} × ${p2Name}`, tone: 'accent' },
      ];
      for (const tag of sumInfo.tags) {
        badges.push({ text: tag, tone: 'neutral' });
      }
      if (dmRel) {
        badges.push({
          text: `日主：${asString(dmRel.person1Stem) ?? ''}${asString(dmRel.person1Element) ?? ''} ↔ ${asString(dmRel.person2Stem) ?? ''}${asString(dmRel.person2Element) ?? ''}`,
          tone: 'good',
        });
      }
      headerShell.append(
        createBoardHeader('八字双人合盘对照', sumInfo.lines.join(' · ') || undefined, badges),
      );

      const formatUsefulCov = (cov: UnknownRecord | undefined): string | undefined => {
        if (!cov) return undefined;
        const favs = asArray(cov.favorable)
          .map(asRecord)
          .filter((x): x is UnknownRecord => Boolean(x))
          .filter((x) => asArray(x.sources).length > 0)
          .map((x) => `${asString(x.element) ?? ''}(${asArray(x.sources).length}处)`)
          .join('、');
        const unfavs = asArray(cov.unfavorable)
          .map(asRecord)
          .filter((x): x is UnknownRecord => Boolean(x))
          .filter((x) => asArray(x.sources).length > 0)
          .map((x) => `${asString(x.element) ?? ''}(${asArray(x.sources).length}处)`)
          .join('、');
        return [
          asString(cov.useful) ? `喜${asString(cov.useful)}` : '',
          favs ? `得对方${favs}` : '无明显喜用补益',
          unfavs ? `忌星见${unfavs}` : '',
        ]
          .filter(Boolean)
          .join(' · ');
      };

      const combos = asArray(compat?.combinations)
        .map(asRecord)
        .filter((x): x is UnknownRecord => Boolean(x));
      const activeComps = asArray(compat?.comparisons)
        .map(asRecord)
        .filter((x): x is UnknownRecord => Boolean(x))
        .filter((x) => asArray(x.relations).length > 0);
      const pillarShort: Record<string, string> = { year: '年', month: '月', day: '日', hour: '时' };

      const meta = createMetaGrid([
        dmRel
          ? [
              `${p1Name}视角`,
              `${p2Name}日主为「${asString(dmRel.person2AsPerson1TenGod) ?? '—'}」（${asString(dmRel.person1ToPerson2) ?? ''}）`,
            ]
          : ['命主一', p1Name],
        dmRel
          ? [
              `${p2Name}视角`,
              `${p1Name}日主为「${asString(dmRel.person1AsPerson2TenGod) ?? '—'}」（${asString(dmRel.person2ToPerson1) ?? ''}）`,
            ]
          : ['命主二', p2Name],
        [`${p1Name}得${p2Name}用神补益`, formatUsefulCov(p1Cov)],
        [`${p2Name}得${p1Name}用神补益`, formatUsefulCov(p2Cov)],
        [
          '跨盘合会成局',
          combos.length > 0
            ? combos.map((c) => `${asString(c.name) ?? ''}${asString(c.element) ?? ''}`).join('、')
            : '无跨盘三合三会成局',
        ],
      ]);
      if (meta) headerShell.append(meta);

      if (activeComps.length > 0) {
        const wrap = el('div', 'wb-chip-wrap');
        for (const cp of activeComps.slice(0, 10)) {
          const p1p = pillarShort[asString(cp.person1Pillar) ?? ''] ?? asString(cp.person1Pillar) ?? '';
          const p2p = pillarShort[asString(cp.person2Pillar) ?? ''] ?? asString(cp.person2Pillar) ?? '';
          const rels = asArray(cp.relations)
            .map((r) => asString(asRecord(r)?.name))
            .filter(Boolean)
            .join('·');
          wrap.append(
            el(
              'span',
              'wb-badge wb-badge-neutral',
              `${p1Name}${p1p}(${asString(cp.person1GanZhi) ?? ''}) ↔ ${p2Name}${p2p}(${asString(cp.person2GanZhi) ?? ''})：${rels}`,
            ),
          );
        }
        headerShell.append(wrap);
      }
      tempHost.append(headerShell);

      const p1Host = document.createElement('div');
      const p2Host = document.createElement('div');
      const ok1 = charts?.person1 ? renderBaziBoard(p1Host, normalizeBaziPayload(charts.person1)) : false;
      const ok2 = charts?.person2 ? renderBaziBoard(p2Host, normalizeBaziPayload(charts.person2)) : false;
      if (ok1) {
        prefixBoardTitle(p1Host, p1Name);
        tempHost.append(...Array.from(p1Host.childNodes));
      }
      if (ok2) {
        prefixBoardTitle(p2Host, p2Name);
        tempHost.append(...Array.from(p2Host.childNodes));
      }
      rendered = ok1 || ok2 || Boolean(compat);
      break;
    }
    case 'ziwei-synastry': {
      const { renderZiweiBoard } = await import('./ziwei-board');
      if (renderTokens.get(container) !== token) return false;
      const charts = asRecord(dataRec?.charts);
      const selected = asRecord(dataRec?.selected);
      const selectedNatal = asRecord(selected?.natal);
      const evidence = asRecord(selected?.evidence);
      const input = asRecord(dataRec?.input);
      const p1Name = asString(asRecord(input?.person1)?.name) ?? '命主一';
      const p2Name = asString(asRecord(input?.person2)?.name) ?? '命主二';
      const sumInfo = extractSummaryInfo(value);

      const headerShell = el('section', 'wb-shell');
      headerShell.setAttribute('aria-label', '紫微合盘叠宫与四化摘要');
      const overlays = asArray(evidence?.overlays)
        .map(asRecord)
        .filter((x): x is UnknownRecord => Boolean(x));
      const crossMutagens = asArray(evidence?.crossMutagens)
        .map(asRecord)
        .filter((x): x is UnknownRecord => Boolean(x));

      headerShell.append(
        createBoardHeader(
          '紫微斗数双盘合参',
          sumInfo.lines.join(' · ') || undefined,
          [
            { text: `${p1Name} × ${p2Name}`, tone: 'accent' },
            { text: `同支叠宫 ${overlays.length} 组`, tone: 'good' },
            { text: `跨盘四化 ${crossMutagens.length} 项`, tone: 'neutral' },
          ],
        ),
      );

      if (crossMutagens.length > 0) {
        const wrap = el('div', 'wb-chip-wrap');
        for (const cm of crossMutagens.slice(0, 8)) {
          const fromLabel = asString(cm.sourcePerson) === 'person1' ? p1Name : p2Name;
          const toLabel = asString(cm.targetPerson) === 'person1' ? p1Name : p2Name;
          wrap.append(
            el(
              'span',
              'wb-badge wb-badge-accent',
              `${fromLabel}${asString(cm.star) ?? ''}化${asString(cm.mutagen) ?? ''} → 入${toLabel}${asString(cm.targetPalace) ?? ''}`,
            ),
          );
        }
        headerShell.append(wrap);
      }

      const keyPalaces = new Set(['命宫', '夫妻', '财帛', '官禄', '福德']);
      const keyOverlays = overlays.filter(
        (ov) =>
          asString(ov.sourcePerson) === 'person1' &&
          (keyPalaces.has(asString(ov.sourcePalace) ?? '') || keyPalaces.has(asString(ov.targetPalace) ?? '')),
      );
      if (keyOverlays.length > 0) {
        const ovSec = el('div', 'lr-section');
        ovSec.append(el('h4', 'lr-section-title', '核心宫位同支叠宫对照'));
        const ovGrid = el('div', 'al-hours-grid is-wide');
        for (const ov of keyOverlays.slice(0, 6)) {
          const card = el('div', 'al-hour-card');
          const top = el('div', 'al-hour-top');
          top.append(
            el(
              'strong',
              'al-hour-name',
              `${asString(ov.earthlyBranch) ?? ''}宫：${p1Name}${asString(ov.sourcePalace) ?? ''} ↔ ${p2Name}${asString(ov.targetPalace) ?? ''}`,
            ),
          );
          card.append(top);
          const sStars = asArray(ov.sourceMajorStars).map(asString).filter(Boolean).join('·') || '无主星';
          const tStars = asArray(ov.targetMajorStars).map(asString).filter(Boolean).join('·') || '无主星';
          card.append(el('div', 'al-hour-range', `${p1Name}：${sStars} ｜ ${p2Name}：${tStars}`));
          ovGrid.append(card);
        }
        ovSec.append(ovGrid);
        headerShell.append(ovSec);
      }
      tempHost.append(headerShell);

      const p1Data = charts?.person1 ?? selectedNatal?.person1;
      const p2Data = charts?.person2 ?? selectedNatal?.person2;
      const p1Host = document.createElement('div');
      const p2Host = document.createElement('div');
      const ok1 = p1Data ? renderZiweiBoard(p1Host, p1Data) : false;
      const ok2 = p2Data ? renderZiweiBoard(p2Host, p2Data) : false;
      if (ok1) {
        prefixBoardTitle(p1Host, p1Name);
        tempHost.append(...Array.from(p1Host.childNodes));
      }
      if (ok2) {
        prefixBoardTitle(p2Host, p2Name);
        tempHost.append(...Array.from(p2Host.childNodes));
      }
      rendered = ok1 || ok2 || overlays.length > 0;
      break;
    }
    case 'astrolabe-synastry': {
      const { renderAstrolabeBoard } = await import('./astrolabe-board');
      if (renderTokens.get(container) !== token) return false;
      const charts = asRecord(dataRec?.charts);
      const composite = asRecord(dataRec?.composite);
      const input = asRecord(dataRec?.input);
      const p1Name = asString(asRecord(input?.person1)?.name) ?? '命主一';
      const p2Name = asString(asRecord(input?.person2)?.name) ?? '命主二';
      const counts = asRecord(dataRec?.counts);
      const aspects = asArray(dataRec?.aspects)
        .map(asRecord)
        .filter((x): x is UnknownRecord => Boolean(x));
      const receptions = asArray(dataRec?.receptions)
        .map(asRecord)
        .filter((x): x is UnknownRecord => Boolean(x));
      const overlays = asArray(dataRec?.overlays)
        .map(asRecord)
        .filter((x): x is UnknownRecord => Boolean(x));
      const sumInfo = extractSummaryInfo(value);

      const headerShell = el('section', 'wb-shell');
      headerShell.setAttribute('aria-label', '星盘合盘跨盘相位摘要');
      headerShell.append(
        createBoardHeader(
          '西洋星盘双人合盘',
          sumInfo.lines.join(' · ') || undefined,
          [
            { text: `${p1Name} × ${p2Name}`, tone: 'accent' },
            { text: `跨盘相位 ${asNumber(counts?.matchedAspects) ?? aspects.length} 条`, tone: 'good' },
            { text: `互溶与接纳 ${receptions.length} 条`, tone: 'neutral' },
            ...(composite ? [{ text: '含中点组合盘', tone: 'accent' as const }] : []),
          ],
        ),
      );

      if (aspects.length > 0) {
        const wrap = el('div', 'wb-chip-wrap');
        for (const asp of aspects.slice(0, 10)) {
          const label = asString(asp.label) ?? '';
          const isHarmony = label === '拱相' || label === '六合' || label === '合相';
          wrap.append(
            el(
              'span',
              `wb-badge ${isHarmony ? 'wb-badge-good' : 'wb-badge-warn'}`,
              `${p1Name}${asString(asp.person1Name) ?? ''} ${label} ${p2Name}${asString(asp.person2Name) ?? ''}`,
            ),
          );
        }
        headerShell.append(wrap);
      }

      const recText = receptions
        .slice(0, 5)
        .map((r) =>
          asString(r.type) === 'mutual'
            ? `${asString(r.person1Name) ?? ''}(${asString(r.sign1) ?? ''}) ⇄ ${asString(r.person2Name) ?? ''}(${asString(r.sign2) ?? ''}) 互溶`
            : `${asString(r.person1Name) ?? ''} ${asString(r.aspect) ?? ''} ${asString(r.person2Name) ?? ''}（接纳）`,
        )
        .join('；');
      const keyOverlayPlanets = new Set(['sun', 'moon', 'venus', 'mars']);
      const ovText = overlays
        .filter((o) => keyOverlayPlanets.has(asString(o.point) ?? ''))
        .slice(0, 8)
        .map(
          (o) =>
            `${asString(o.visitor) === 'person1' ? p1Name : p2Name}${asString(o.pointName) ?? ''}→入${asString(o.owner) === 'person1' ? p1Name : p2Name}第${asNumber(o.house) ?? ''}宫`,
        )
        .join(' · ');
      const synMeta = createMetaGrid([
        ['互溶与接纳', recText || undefined],
        ['主要落宫叠入', ovText || undefined],
      ]);
      if (synMeta) headerShell.append(synMeta);
      tempHost.append(headerShell);

      if (composite && asArray(composite.points).length > 0 && asArray(composite.houses).length > 0) {
        const compHost = document.createElement('div');
        if (renderAstrolabeBoard(compHost, { ...composite, basis: { houseSystem: 'placidus' } })) {
          prefixBoardTitle(compHost, '中点组合盘');
          tempHost.append(...Array.from(compHost.childNodes));
        }
      }

      const p1Host = document.createElement('div');
      const p2Host = document.createElement('div');
      const ok1 = charts?.person1 ? renderAstrolabeBoard(p1Host, charts.person1) : false;
      const ok2 = charts?.person2 ? renderAstrolabeBoard(p2Host, charts.person2) : false;
      if (ok1) {
        prefixBoardTitle(p1Host, p1Name);
        tempHost.append(...Array.from(p1Host.childNodes));
      }
      if (ok2) {
        prefixBoardTitle(p2Host, p2Name);
        tempHost.append(...Array.from(p2Host.childNodes));
      }
      rendered = ok1 || ok2 || aspects.length > 0;
      break;
    }
    case 'astrolabe': {
      const { renderAstrolabeBoard } = await import('./astrolabe-board');
      if (renderTokens.get(container) !== token) return false;
      rendered = renderAstrolabeBoard(tempHost, value);
      break;
    }
    case 'qimen':
    case 'xuankong': {
      const { renderQimenBoard } = await import('./qimen-board');
      if (renderTokens.get(container) !== token) return false;
      const shell = el('section', 'wb-shell');
      shell.setAttribute('aria-label', effectiveMethod === 'xuankong' ? '玄空飞星盘' : '奇门遁甲九宫盘');
      rendered = renderQimenBoard(shell, effectiveMethod, data);
      if (rendered) tempHost.append(shell);
      break;
    }
    case 'qimen-lifetime': {
      const { renderQimenBoard } = await import('./qimen-board');
      if (renderTokens.get(container) !== token) return false;
      const shell = el('section', 'wb-shell');
      shell.setAttribute('aria-label', '奇门终身局九宫与运限盘');
      const baseChart = asRecord(dataRec?.baseChart) ?? data;
      rendered = renderQimenBoard(shell, 'qimen', baseChart);
      if (rendered && dataRec) {
        appendQimenLifetimeExtras(shell, dataRec);
      }
      if (rendered) tempHost.append(shell);
      break;
    }
    case 'instant': {
      const [{ renderBaziBoard }, { renderZiweiBoard }, { renderAstrolabeBoard }, { renderQizhengBoard }] =
        await Promise.all([
          import('./bazi-board'),
          import('./ziwei-board'),
          import('./astrolabe-board'),
          import('./qizheng-board'),
        ]);
      if (renderTokens.get(container) !== token) return false;
      let anyOk = false;
      if (dataRec?.bazi) {
        const baziHost = document.createElement('div');
        if (renderBaziBoard(baziHost, normalizeBaziPayload(dataRec.bazi))) {
          tempHost.append(...Array.from(baziHost.childNodes));
          anyOk = true;
        }
      }
      if (dataRec?.ziwei) {
        const ziweiHost = document.createElement('div');
        if (renderZiweiBoard(ziweiHost, dataRec.ziwei)) {
          tempHost.append(...Array.from(ziweiHost.childNodes));
          anyOk = true;
        }
      }
      if (dataRec?.astrolabe) {
        const astroHost = document.createElement('div');
        if (renderAstrolabeBoard(astroHost, dataRec.astrolabe)) {
          tempHost.append(...Array.from(astroHost.childNodes));
          anyOk = true;
        }
      }
      if (dataRec?.qizheng) {
        const qzShell = el('section', 'wb-shell');
        qzShell.setAttribute('aria-label', '七政四余星盘');
        if (renderQizhengBoard(qzShell, 'qizheng', dataRec.qizheng)) {
          tempHost.append(qzShell);
          anyOk = true;
        }
      }
      rendered = anyOk;
      break;
    }
    case 'residential': {
      const { renderQimenBoard } = await import('./qimen-board');
      if (renderTokens.get(container) !== token) return false;
      const shell = el('section', 'wb-shell');
      shell.setAttribute('aria-label', '阳宅风水八宅玄空合参九宫盘');
      rendered = renderQimenBoard(shell, 'residential', dataRec ?? data);
      if (rendered) tempHost.append(shell);
      break;
    }
    case 'liuyao':
    case 'meihua': {
      const { renderHexagramBoard } = await import('./hexagram-board');
      if (renderTokens.get(container) !== token) return false;
      const shell = el('section', 'wb-shell');
      shell.setAttribute('aria-label', effectiveMethod === 'meihua' ? '梅花易数卦象' : '六爻卦象');
      rendered = renderHexagramBoard(shell, effectiveMethod, data);
      if (rendered) tempHost.append(shell);
      break;
    }
    case 'tarot':
    case 'lenormand':
    case 'ssgw':
    case 'zhuge': {
      const { renderCardsBoard } = await import('./cards-board');
      if (renderTokens.get(container) !== token) return false;
      const shell = el('section', 'wb-shell');
      shell.setAttribute('aria-label', '牌阵与灵签卡片');
      rendered = renderCardsBoard(shell, effectiveMethod, data);
      if (rendered) tempHost.append(shell);
      break;
    }
    case 'liuren':
    case 'jinkoujue': {
      const { renderLiurenBoard } = await import('./liuren-board');
      if (renderTokens.get(container) !== token) return false;
      const shell = el('section', 'wb-shell');
      shell.setAttribute('aria-label', effectiveMethod === 'jinkoujue' ? '金口诀四位盘' : '大六壬课式');
      rendered = renderLiurenBoard(shell, effectiveMethod, data);
      if (rendered) tempHost.append(shell);
      break;
    }
    case 'taiyi':
    case 'huangji':
    case 'huangji-jingshi': {
      const { renderTaiyiBoard } = await import('./taiyi-board');
      if (renderTokens.get(container) !== token) return false;
      const shell = el('section', 'wb-shell');
      shell.setAttribute('aria-label', effectiveMethod === 'taiyi' ? '太乙神数九宫盘' : '皇极经世运势盘');
      rendered = renderTaiyiBoard(shell, effectiveMethod, data);
      if (rendered) tempHost.append(shell);
      break;
    }
    case 'qizheng': {
      const { renderQizhengBoard } = await import('./qizheng-board');
      if (renderTokens.get(container) !== token) return false;
      const shell = el('section', 'wb-shell');
      shell.setAttribute('aria-label', '七政四余星盘');
      rendered = renderQizhengBoard(shell, effectiveMethod, data);
      if (rendered) tempHost.append(shell);
      break;
    }
    case 'fortune': {
      const { renderFortuneBoard } = await import('./fortune-board');
      if (renderTokens.get(container) !== token) return false;
      const shell = el('section', 'wb-shell');
      shell.setAttribute('aria-label', '流运运势盘面');
      rendered = renderFortuneBoard(shell, data);
      if (rendered) tempHost.append(shell);
      break;
    }
    case 'bazhai':
    case 'almanac':
    case 'chinese-name':
    case 'chinese-naming':
    case 'character-query':
    case 'xiaoliuren':
    case 'wuyun-liuqi':
    case 'number-energy': {
      const { renderTraditionBoard } = await import('./tradition-boards');
      if (renderTokens.get(container) !== token) return false;
      const shell = el('section', 'wb-shell');
      shell.setAttribute('aria-label', '传统术数可视化盘面');
      rendered = renderTraditionBoard(shell, effectiveMethod, data);
      if (rendered) tempHost.append(shell);
      break;
    }
    default:
      rendered = false;
  }

  if (renderTokens.get(container) !== token) return false;

  if (!rendered) {
    container.replaceChildren();
    container.hidden = true;
    return false;
  }

  // 直接在盘面下方按需附加匹配古籍经典参断卡（非命录页、无网络耗时）
  if (effectiveMethod !== 'minglu') {
    const { buildBoardClassicsCard } = await import('./classics-card');
    if (renderTokens.get(container) !== token) return false;
    const classicsCard = await buildBoardClassicsCard(effectiveMethod, data);
    if (renderTokens.get(container) !== token) return false;
    if (classicsCard) {
      tempHost.append(classicsCard);
    }
  }

  container.replaceChildren(...Array.from(tempHost.childNodes));
  container.hidden = false;
  return true;
}
