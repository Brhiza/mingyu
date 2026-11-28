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
import { warnDev } from '../lib/dev-log';
import { formatClockLike } from '../systems/prompt-format';

const renderTokens = new WeakMap<HTMLElement, number>();
type BoardCssDomain = 'natal' | 'cards' | 'traditional';
let boardsCommonCssPromise: Promise<unknown> | null = null;
const boardDomainCssCache = new Map<BoardCssDomain, Promise<unknown>>();

function domainsForBoard(effectiveMethod: string, dataRec?: UnknownRecord): BoardCssDomain[] {
  switch (effectiveMethod) {
    case 'bazi':
    case 'ziwei':
    case 'minglu':
    case 'bazi-synastry':
    case 'ziwei-synastry':
    case 'astrolabe':
    case 'astrolabe-synastry':
    case 'qizheng':
    case 'instant':
      return ['natal'];
    case 'bazi-ziwei': {
      const domains: BoardCssDomain[] = ['natal'];
      if (dataRec?.kind === 'multi-hecan') {
        const computed = asArray(dataRec.computedSystems).map(asString).filter(Boolean);
        const charts = asRecord(dataRec.charts);
        if (computed.includes('qimen-lifetime') || Boolean(charts?.['qimen-lifetime'])) {
          domains.push('traditional');
        }
      }
      return domains;
    }
    case 'tarot':
    case 'lenormand':
    case 'ssgw':
    case 'zhuge':
      return ['cards'];
    case 'fortune':
      return [];
    default:
      return ['traditional'];
  }
}

function loadBoardDomainCss(domain: BoardCssDomain): Promise<unknown> {
  let pending = boardDomainCssCache.get(domain);
  if (!pending) {
    pending =
      domain === 'natal'
        ? import('./boards-natal.css')
        : domain === 'cards'
          ? import('./boards-cards.css')
          : import('./boards-traditional.css');
    boardDomainCssCache.set(domain, pending);
  }
  return pending;
}

function ensureBoardsCssLoaded(effectiveMethod: string, dataRec?: UnknownRecord): Promise<unknown> {
  if (typeof document === 'undefined') return Promise.resolve();
  if (!boardsCommonCssPromise) {
    boardsCommonCssPromise = import('./boards-common.css');
  }
  const domains = domainsForBoard(effectiveMethod, dataRec);
  return Promise.all([boardsCommonCssPromise, ...domains.map(loadBoardDomainCss)]);
}

function loadBoardModulesForMethod(method: string): Promise<unknown> {
  switch (method) {
    case 'bazi':
    case 'bazi-synastry':
      return import('./bazi-board');
    case 'ziwei':
    case 'ziwei-synastry':
      return import('./ziwei-board');
    case 'bazi-ziwei':
      return Promise.all([import('./bazi-board'), import('./ziwei-board')]);
    case 'minglu':
      return Promise.all([import('./minglu-wiki-board'), import('./bazi-board')]);
    case 'astrolabe':
    case 'astrolabe-synastry':
      return import('./astrolabe-board');
    case 'qimen':
    case 'qimen-lifetime':
      return import('./qimen-board');
    case 'liuyao':
    case 'meihua':
      return import('./hexagram-board');
    case 'tarot':
    case 'lenormand':
    case 'ssgw':
    case 'zhuge':
      return import('./cards-board');
    case 'liuren':
    case 'jinkoujue':
      return import('./liuren-board');
    case 'taiyi':
    case 'huangji-jingshi':
      return import('./taiyi-board');
    case 'qizheng':
      return import('./qizheng-board');
    case 'fortune':
      return import('./fortune-board');
    case 'instant':
      return Promise.all([
        import('./bazi-board'),
        import('./ziwei-board'),
        import('./astrolabe-board'),
        import('./qizheng-board'),
      ]);
    case 'almanac':
    case 'bazhai':
    case 'xuankong':
    case 'residential':
    case 'calendar':
    case 'zhouyi':
    case 'character-query':
    case 'xiaoliuren':
    case 'wuyun-liuqi':
    case 'number-energy':
      return import('./tradition-boards');
    default:
      return Promise.resolve();
  }
}

export function preloadBoardCommonCss(): void {
  if (typeof document === 'undefined') return;
  if (!boardsCommonCssPromise) {
    boardsCommonCssPromise = import('./boards-common.css');
  }
  void boardsCommonCssPromise.catch((err) => {
    warnDev('web-boards', '预加载盘面公共样式失败', err);
  });
}

export function preloadVisualBoardAssets(method: string): void {
  if (typeof document === 'undefined') return;
  void Promise.all([
    ensureBoardsCssLoaded(method),
    loadBoardModulesForMethod(method),
    method !== 'minglu' ? import('./classics-card') : Promise.resolve(),
  ]).catch((err) => {
    warnDev('web-boards', `预加载盘面资源失败（${method}）`, err);
  });
}

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
    const clockText = formatClockLike(rec.calculationClock);
    return {
      chart: {
        basis: rec.basis ?? (clockText ? { localDateTime: clockText } : undefined),
        pillars: rec.pillars,
        shensha: rec.shensha,
      },
      ...(rec.fortune ? { fortune: rec.fortune } : {}),
      ...(rec.located ? { located: rec.located } : {}),
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

const CANONICAL_BZ_THEMES: ReadonlyArray<{ label: string; pillars: string[]; palaces: string[] }> = [
  { label: '命局总纲', pillars: ['year', 'month', 'day', 'hour'], palaces: ['命宫', '福德', '迁移'] },
  { label: '性情与能力', pillars: ['month', 'day', 'hour'], palaces: ['命宫', '福德'] },
  { label: '事业与发展', pillars: ['month', 'day', 'hour'], palaces: ['官禄', '命宫', '迁移', '财帛'] },
  { label: '财帛与资源', pillars: ['month', 'day', 'hour'], palaces: ['财帛', '田宅', '官禄'] },
  { label: '感情与关系', pillars: ['day', 'hour'], palaces: ['夫妻', '福德', '命宫'] },
  { label: '家庭与六亲', pillars: ['year', 'month', 'day', 'hour'], palaces: ['父母', '兄弟', '子女', '田宅'] },
  { label: '身心与健康', pillars: ['month', 'day', 'hour'], palaces: ['疾厄', '福德', '命宫'] },
  { label: '迁移与环境', pillars: ['year', 'month', 'day'], palaces: ['迁移', '田宅', '官禄'] },
  { label: '内在状态', pillars: ['month', 'day', 'hour'], palaces: ['福德', '命宫'] },
  { label: '大运与流年', pillars: ['year', 'month', 'day', 'hour'], palaces: ['命宫', '官禄', '财帛'] },
];

function renderBaziZiweiCorroborationCard(dataRec: UnknownRecord): HTMLElement | null {
  const corr = asRecord(dataRec.corroboration);
  const rawThemes = asArray(dataRec.themes).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  if (!corr && rawThemes.length === 0) return null;

  const themes = rawThemes.length > 0 ? rawThemes : CANONICAL_BZ_THEMES;
  const shaYao = asRecord(corr?.shaYao);
  const guiRen = asRecord(corr?.guiRen);
  const crossBal = asRecord(corr?.crossSystemBalance);
  const resonances = asArray(crossBal?.resonances).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  const tensions = asArray(crossBal?.tensions).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));

  const shell = el('section', 'wb-shell');
  shell.setAttribute('aria-label', '八字与紫微斗数合参互证摘要');

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
      asString(corr?.summary) || undefined,
      badges,
    ),
  );

  const meta = createMetaGrid([
    ['煞曜与羊刃互证', asString(shaYao?.judgment)],
    ['贵人与吉辅互证', asString(guiRen?.judgment)],
  ]);
  if (meta) shell.append(meta);

  const shownJudgments = new Set(
    [asString(shaYao?.judgment), asString(guiRen?.judgment)].filter((v): v is string => Boolean(v)),
  );
  const points = asArray(corr?.corroborationPoints)
    .map(asString)
    .filter((x): x is string => typeof x === 'string' && x.length > 0 && !shownJudgments.has(x));

  if (themes.length > 0 || points.length > 0 || resonances.length > 0 || tensions.length > 0) {
    const pillarNames: Record<string, string> = { year: '年', month: '月', day: '日', hour: '时' };
    const trigger = createBoardModalTrigger(
      '十维主题对照与互证要点',
      '八字紫微十维生命主题与互证要点',
      () => {
        const frag = document.createDocumentFragment();
        if (points.length > 0) {
          const note = el('div', 'wb-note-box');
          note.append(el('strong', undefined, '跨体系互证要点：'));
          note.append(points.join('；'));
          frag.append(note);
        }
        if (resonances.length > 0 || tensions.length > 0) {
          const rSec = el('div', 'lr-section');
          rSec.append(el('h4', 'lr-section-title', `同向共振与制衡张力（${resonances.length + tensions.length} 项）`));
          const list = el('div', 'wb-computed-list');
          for (const res of resonances) {
            const card = el('div', 'wb-computed-item is-good');
            card.append(el('strong', 'wb-computed-title', `同向 · ${asString(res.topic) ?? ''}`));
            card.append(el('p', 'wb-computed-desc', `八字：${asString(res.baziSignal) ?? '—'} ｜ 紫微：${asString(res.ziweiSignal) ?? '—'}`));
            if (asString(res.condition)) card.append(el('small', 'wb-computed-quote', asString(res.condition)));
            list.append(card);
          }
          for (const ten of tensions) {
            const card = el('div', 'wb-computed-item is-bad');
            card.append(el('strong', 'wb-computed-title', `张力 · ${asString(ten.topic) ?? ''}`));
            card.append(el('p', 'wb-computed-desc', `八字：${asString(ten.baziSignal) ?? '—'} ｜ 紫微：${asString(ten.ziweiSignal) ?? '—'}`));
            if (asString(ten.condition)) card.append(el('small', 'wb-computed-quote', asString(ten.condition)));
            list.append(card);
          }
          rSec.append(list);
          frag.append(rSec);
        }
        if (themes.length > 0) {
          const tSec = el('div', 'lr-section');
          tSec.append(el('h4', 'lr-section-title', `十维生命主题对照（${themes.length} 维）`));
          const tGrid = el('div', 'al-hours-grid');
          for (const th of themes) {
            const card = el('div', 'al-hour-card');
            const pillars = ('pillars' in th ? asArray(th.pillars) : [])
              .map((p) => pillarNames[asString(p) ?? ''] ?? asString(p))
              .filter(Boolean)
              .join('/');
            const palaces = ('palaces' in th ? asArray(th.palaces) : []).map(asString).filter(Boolean).join('·');
            const labelText = 'label' in th ? asString(th.label) : undefined;
            card.append(el('strong', 'al-hour-name', labelText ?? '主题'));
            card.append(el('div', 'al-hour-range', `八字：${pillars || '全盘'} ｜ 紫微：${palaces || '—'}`));
            tGrid.append(card);
          }
          tSec.append(tGrid);
          frag.append(tSec);
        }
        return frag;
      },
      `${themes.length}维`,
    );
    const bar = createBoardDetailBar([trigger]);
    if (bar) shell.append(bar);
  }

  return shell;
}

function appendBoardTriggerButton(host: HTMLElement, btn: HTMLElement | undefined | null) {
  if (!btn) return;
  const bars = host.querySelectorAll<HTMLElement>('.wb-detail-actions-bar');
  const lastBar = bars.length > 0 ? bars[bars.length - 1] : undefined;
  if (lastBar) {
    lastBar.append(btn);
    return;
  }
  const bar = createBoardDetailBar([btn]);
  if (!bar) return;
  const singleChild =
    host.childElementCount === 1 && host.firstElementChild instanceof HTMLElement
      ? host.firstElementChild
      : undefined;
  if (singleChild && !singleChild.classList.contains('wb-classics-card')) {
    singleChild.append(bar);
  } else {
    host.append(bar);
  }
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
    const rawDir = asString(decadalLuck.direction);
    const dirLabel = rawDir === 'forward' ? '顺行大运' : rawDir === 'backward' ? '逆行大运' : rawDir;
    const rawStartDt = asString(decadalLuck.startDateTime);
    const startDtLabel =
      rawStartDt && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(rawStartDt)
        ? rawStartDt.replace('T', ' ').slice(0, 16)
        : rawStartDt;
    const luckMeta = createMetaGrid([
      ['终身大限顺逆', dirLabel],
      ['起运岁数 / 时间', [ageStr, startDtLabel].filter(Boolean).join(' · ') || undefined],
    ]);
    if (luckMeta) shell.append(luckMeta);
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

  const ruleText = [asString(decadalLuck?.rule), asString(decadalLuck?.mapping)].filter(Boolean).join(' · ');
  if (markers.length > 0 || topicCands.length > 0 || ruleText) {
    const layerLabelMap: Record<string, string> = {
      tianPan: '天盘干',
      diPan: '地盘干',
      renPan: '人盘门',
      baseGong: '本命落宫',
      anGan: '暗干',
      zhiFu: '值符',
      zhiShi: '值使',
    };
    const topicLabelMap: Record<string, string> = {
      career: '事业官禄',
      wealth: '资产财帛',
      marriage: '婚恋配偶',
      health: '身体疾厄',
      academic: '学业进修',
      relocation: '居所差旅',
      family: '原生家庭',
      children: '晚辈后嗣',
      partnership: '合伙合作',
    };
    const trigger = createBoardModalTrigger(
      '个人标记与用神落宫',
      '终身局个人标记、用神落宫与行限口径',
      () => {
        const frag = document.createDocumentFragment();
        if (ruleText) {
          frag.append(el('p', 'wb-note-box', `行限口径：${ruleText}`));
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
              top.append(el('span', 'wb-badge wb-badge-accent', layerLabelMap[layerRaw] ?? layerRaw));
            }
            card.append(top);
            if (asString(m.traditionalSignificance)) {
              card.append(el('div', 'al-hour-range', asString(m.traditionalSignificance)));
            }
            mGrid.append(card);
          }
          sec.append(mGrid);
          frag.append(sec);
        }
        if (topicCands.length > 0) {
          const tSec = el('div', 'lr-section');
          tSec.append(el('h4', 'lr-section-title', `事项用神落宫（${topicCands.length} 类）`));
          const tWrap = el('div', 'wb-chip-wrap');
          for (const tc of topicCands) {
            const topicKey = asString(tc.topic) ?? '';
            const label = asString(tc.topicName) ?? asString(tc.label) ?? (topicLabelMap[topicKey] ?? topicKey);
            const palaces = asArray(tc.palaces)
              .map((p) => asString(asRecord(p)?.name) ?? asString(p))
              .filter(Boolean)
              .join('·');
            const txt = [label, palaces, asString(tc.basis)].filter(Boolean).join('：');
            if (txt) tWrap.append(el('span', 'wb-badge wb-badge-neutral', txt));
          }
          tSec.append(tWrap);
          frag.append(tSec);
        }
        return frag;
      },
      markers.length + topicCands.length > 0 ? `${markers.length + topicCands.length}项` : undefined,
    );
    appendBoardTriggerButton(shell, trigger);
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
  const [cssResult, , classicsModule] = await Promise.all([
    ensureBoardsCssLoaded(effectiveMethod, dataRec),
    loadBoardModulesForMethod(effectiveMethod),
    effectiveMethod !== 'minglu' ? import('./classics-card') : Promise.resolve(null),
  ]);
  void cssResult;
  if (renderTokens.get(container) !== token) return false;
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

      const fc = asRecord(compat?.fortuneComparison);
      if (fc) {
        const fcP1 = asRecord(fc.person1);
        const fcP2 = asRecord(fc.person2);
        const p1Dy = asRecord(fcP1?.dayun);
        const p2Dy = asRecord(fcP2?.dayun);
        const p1Yr = asRecord(fcP1?.yearTendency);
        const p2Yr = asRecord(fcP2?.yearTendency);
        const crossDy = asArray(fc.crossDayunRelations)
          .map((r) => asString(asRecord(r)?.name))
          .filter(Boolean)
          .join('、');
        const fcMeta = createMetaGrid([
          ['参考岁运流年', [asString(fc.sharedYear) ? `${asString(fc.sharedYear)}年` : '', asString(fc.sharedMonth) ? `${asString(fc.sharedMonth)}月` : ''].filter(Boolean).join(' · ') || undefined],
          [
            `${p1Name}大运/流年`,
            `${p1Dy ? `${asString(p1Dy.ganZhi) ?? ''}（${asString(p1Dy.stemTendency) ?? ''}）` : asString(fcP1?.stage) ?? '—'} · 流年${asString(p1Yr?.stemTendency) ?? '—'}`,
          ],
          [
            `${p2Name}大运/流年`,
            `${p2Dy ? `${asString(p2Dy.ganZhi) ?? ''}（${asString(p2Dy.stemTendency) ?? ''}）` : asString(fcP2?.stage) ?? '—'} · 流年${asString(p2Yr?.stemTendency) ?? '—'}`,
          ],
          ['双方大运交互', crossDy || '大运干支无明显刑冲合害'],
        ]);
        if (fcMeta) headerShell.append(fcMeta);
      }

      const annualSync = asRecord(compat?.annualSync);
      const syncYearsList = asArray(annualSync?.years)
        .map(asRecord)
        .filter((x): x is UnknownRecord => Boolean(x));
      if (activeComps.length > 0 || syncYearsList.length > 0) {
        const bzSynTrigger = createBoardModalTrigger(
          '跨盘引动与多年同步',
          '八字双人跨盘干支引动与多年同步',
          () => {
            const frag = document.createDocumentFragment();
            if (activeComps.length > 0) {
              const cSec = el('div', 'lr-section');
              cSec.append(el('h4', 'lr-section-title', `跨盘干支引动（${activeComps.length} 处）`));
              const wrap = el('div', 'wb-chip-wrap');
              for (const cp of activeComps) {
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
              cSec.append(wrap);
              frag.append(cSec);
            }
            if (syncYearsList.length > 0) {
              const syncSec = el('div', 'lr-section');
              syncSec.append(
                el(
                  'h4',
                  'lr-section-title',
                  `多年大运流年同步（${asNumber(annualSync?.startYear) ?? ''}–${asNumber(annualSync?.endYear) ?? ''}）`,
                ),
              );
              const syncGrid = el('div', 'al-hours-grid');
              for (const yr of syncYearsList) {
                const yP1 = asRecord(yr.person1);
                const yP2 = asRecord(yr.person2);
                const card = el('div', 'al-hour-card');
                const top = el('div', 'al-hour-top');
                top.append(
                  el('strong', 'al-hour-name', `${asNumber(yr.year) ?? ''} ${asString(yr.yearGanZhi) ?? ''}年`),
                  el('span', 'wb-badge wb-badge-neutral', asString(yr.syncAssessment) ?? ''),
                );
                card.append(top);
                const p1Spouse = asArray(yP1?.spousePalaceRelations).map(asString).filter(Boolean).join('、');
                const p2Spouse = asArray(yP2?.spousePalaceRelations).map(asString).filter(Boolean).join('、');
                card.append(
                  el(
                    'div',
                    'al-hour-range',
                    `${p1Name}：运${asString(yP1?.dayun) ?? '—'}(${asString(yP1?.yearTendency) ?? '—'}${p1Spouse ? `·日支${p1Spouse}` : ''}) ｜ ${p2Name}：运${asString(yP2?.dayun) ?? '—'}(${asString(yP2?.yearTendency) ?? '—'}${p2Spouse ? `·日支${p2Spouse}` : ''})`,
                  ),
                );
                syncGrid.append(card);
              }
              syncSec.append(syncGrid);
              frag.append(syncSec);
            }
            return frag;
          },
          activeComps.length > 0 ? `${activeComps.length}处` : `${syncYearsList.length}年`,
        );
        const bar = createBoardDetailBar([bzSynTrigger]);
        if (bar) headerShell.append(bar);
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

      const p1Overlays = overlays.filter((ov) => asString(ov.sourcePerson) === 'person1');
      const hc = asRecord(dataRec?.horoscopeComparison);
      if (hc) {
        const hcP1 = asRecord(hc.person1);
        const hcP2 = asRecord(hc.person2);
        const formatHoroscope = (h: UnknownRecord | undefined): string => {
          const dec = asRecord(h?.decadal);
          const yr = asRecord(h?.yearly);
          const decStr = dec
            ? `大限 ${asString(dec.heavenlyStem) ?? ''}${asString(dec.earthlyBranch) ?? ''}(${asString(dec.natalPalace) ?? ''})`
            : '';
          const yrStr = yr
            ? `流年 ${asString(yr.heavenlyStem) ?? ''}${asString(yr.earthlyBranch) ?? ''}(${asString(yr.natalPalace) ?? ''})`
            : '';
          return [decStr, yrStr].filter(Boolean).join(' · ') || '—';
        };
        const hcMeta = createMetaGrid([
          [`${p1Name}大限流年`, formatHoroscope(hcP1)],
          [`${p2Name}大限流年`, formatHoroscope(hcP2)],
        ]);
        if (hcMeta) headerShell.append(hcMeta);
      }

      const zwAnnualSync = asRecord(dataRec?.annualSync);
      const zwSyncYears = asArray(zwAnnualSync?.years)
        .map(asRecord)
        .filter((x): x is UnknownRecord => Boolean(x));
      if (p1Overlays.length > 0 || zwSyncYears.length > 0) {
        const zwSynTrigger = createBoardModalTrigger(
          '同支叠宫与流年同步',
          '紫微合盘同支叠宫对照与流年同步',
          () => {
            const frag = document.createDocumentFragment();
            if (p1Overlays.length > 0) {
              const ovSec = el('div', 'lr-section');
              ovSec.append(el('h4', 'lr-section-title', `同支叠宫对照（共 ${p1Overlays.length} 宫）`));
              const ovGrid = el('div', 'al-hours-grid');
              for (const ov of p1Overlays) {
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
              frag.append(ovSec);
            }
            if (zwSyncYears.length > 0) {
              const syncSec = el('div', 'lr-section');
              syncSec.append(
                el(
                  'h4',
                  'lr-section-title',
                  `多年大限与流年同步（${asNumber(zwAnnualSync?.startYear) ?? ''}–${asNumber(zwAnnualSync?.endYear) ?? ''}）`,
                ),
              );
              const syncGrid = el('div', 'al-hours-grid');
              for (const yr of zwSyncYears) {
                const yP1 = asRecord(yr.person1);
                const yP2 = asRecord(yr.person2);
                const overlap = asRecord(yr.yearlyOverlap);
                const card = el('div', 'al-hour-card');
                const top = el('div', 'al-hour-top');
                top.append(
                  el('strong', 'al-hour-name', `${asNumber(yr.year) ?? ''} 年`),
                  ...(overlap?.sameBranch ? [el('span', 'wb-badge wb-badge-accent', '流年同支')] : []),
                );
                card.append(top);
                card.append(
                  el(
                    'div',
                    'al-hour-range',
                    `${p1Name}：限${asString(yP1?.decadal) ?? '—'} · 年${asString(yP1?.yearly) ?? '—'} ｜ ${p2Name}：限${asString(yP2?.decadal) ?? '—'} · 年${asString(yP2?.yearly) ?? '—'}`,
                  ),
                );
                syncGrid.append(card);
              }
              syncSec.append(syncGrid);
              frag.append(syncSec);
            }
            return frag;
          },
          p1Overlays.length > 0 ? `${p1Overlays.length}宫` : undefined,
        );
        const bar = createBoardDetailBar([zwSynTrigger]);
        if (bar) headerShell.append(bar);
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
        for (const asp of aspects.slice(0, 6)) {
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

      const transits = asRecord(dataRec?.transits);
      if (transits) {
        const formatTransits = (arr: unknown): string =>
          asArray(arr)
            .map(asRecord)
            .filter((x): x is UnknownRecord => Boolean(x))
            .slice(0, 5)
            .map((t) => `${asString(t.transitName) ?? ''}${asString(t.label) ?? ''}${asString(t.natalName) ?? ''}`)
            .join(' · ') || '暂无显著外行星行运相位';
        const trMeta = createMetaGrid([
          [`${p1Name}行运引动`, formatTransits(transits.toPerson1)],
          [`${p2Name}行运引动`, formatTransits(transits.toPerson2)],
        ]);
        if (trMeta) headerShell.append(trMeta);
      }

      const astroAnnualSync = asRecord(dataRec?.annualSync);
      const astroSyncYears = asArray(astroAnnualSync?.years)
        .map(asRecord)
        .filter((x): x is UnknownRecord => Boolean(x));
      if (aspects.length > 6 || overlays.length > 8 || astroSyncYears.length > 0) {
        const astroSynTrigger = createBoardModalTrigger(
          '完整相位、落宫与多年同步',
          '星盘合盘全量相位、叠宫与多年行运同步',
          () => {
            const frag = document.createDocumentFragment();
            if (aspects.length > 0) {
              const aSec = el('div', 'lr-section');
              aSec.append(el('h4', 'lr-section-title', `全部跨盘相位（共 ${aspects.length} 条）`));
              const wrap = el('div', 'wb-chip-wrap');
              for (const asp of aspects) {
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
              aSec.append(wrap);
              frag.append(aSec);
            }
            if (overlays.length > 0) {
              const oSec = el('div', 'lr-section');
              oSec.append(el('h4', 'lr-section-title', `全部落宫叠入（共 ${overlays.length} 条）`));
              const wrap = el('div', 'wb-chip-wrap');
              for (const o of overlays) {
                wrap.append(
                  el(
                    'span',
                    'wb-badge wb-badge-neutral',
                    `${asString(o.visitor) === 'person1' ? p1Name : p2Name}${asString(o.pointName) ?? ''} → ${asString(o.owner) === 'person1' ? p1Name : p2Name}第${asNumber(o.house) ?? ''}宫`,
                  ),
                );
              }
              oSec.append(wrap);
              frag.append(oSec);
            }
            if (astroSyncYears.length > 0) {
              const syncSec = el('div', 'lr-section');
              syncSec.append(
                el(
                  'h4',
                  'lr-section-title',
                  `多年外行星行运同步（${asNumber(astroAnnualSync?.startYear) ?? ''}–${asNumber(astroAnnualSync?.endYear) ?? ''}）`,
                ),
              );
              const syncGrid = el('div', 'al-hours-grid');
              for (const yr of astroSyncYears) {
                const shared = asArray(yr.sharedBodies).map(asString).filter(Boolean).join('、');
                const t1 = asArray(yr.toPerson1)
                  .map(asRecord)
                  .filter((x): x is UnknownRecord => Boolean(x))
                  .slice(0, 3)
                  .map((t) => `${asString(t.transitName) ?? ''}${asString(t.label) ?? ''}${asString(t.natalName) ?? ''}`)
                  .join('、');
                const t2 = asArray(yr.toPerson2)
                  .map(asRecord)
                  .filter((x): x is UnknownRecord => Boolean(x))
                  .slice(0, 3)
                  .map((t) => `${asString(t.transitName) ?? ''}${asString(t.label) ?? ''}${asString(t.natalName) ?? ''}`)
                  .join('、');
                const card = el('div', 'al-hour-card');
                const top = el('div', 'al-hour-top');
                top.append(
                  el('strong', 'al-hour-name', `${asNumber(yr.year) ?? ''} 年`),
                  ...(shared ? [el('span', 'wb-badge wb-badge-accent', `共引：${shared}`)] : []),
                );
                card.append(top);
                card.append(
                  el('div', 'al-hour-range', `${p1Name}：${t1 || '无'} ｜ ${p2Name}：${t2 || '无'}`),
                );
                syncGrid.append(card);
              }
              syncSec.append(syncGrid);
              frag.append(syncSec);
            }
            return frag;
          },
          `${aspects.length}相`,
        );
        const bar = createBoardDetailBar([astroSynTrigger]);
        if (bar) headerShell.append(bar);
      }
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

  // 将经典古籍参断收拢至统一底部弹窗按钮栏（非命录页）
  if (effectiveMethod !== 'minglu') {
    const { buildBoardClassicsTrigger } = await import('./classics-card');
    if (renderTokens.get(container) !== token) return false;
    const classicsBtn = await buildBoardClassicsTrigger(effectiveMethod, data);
    if (renderTokens.get(container) !== token) return false;
    if (classicsBtn) {
      appendBoardTriggerButton(tempHost, classicsBtn);
    }
  }

  container.replaceChildren(...Array.from(tempHost.childNodes));
  container.hidden = false;
  return true;
}
