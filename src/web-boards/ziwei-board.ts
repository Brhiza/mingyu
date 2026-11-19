import './boards.css';
import { createMobileDetailSheet, createTermPanel, el, svgEl, unwrapBoardData } from './shared';

interface ZiweiStar {
  name: string;
  type?: string;
  scope?: string;
  brightness?: string;
  mutagen?: string;
}

interface ZiweiFlyingTransformation {
  mutagen: string;
  star: string;
  targetIndex: number;
  targetName: string;
  targetBranch: string;
  relation: string;
}

interface ZiweiPalace {
  index: number;
  name: string;
  isBodyPalace?: boolean;
  isOriginalPalace?: boolean;
  heavenlyStem: string;
  earthlyBranch: string;
  majorStars?: ZiweiStar[];
  minorStars?: ZiweiStar[];
  adjectiveStars?: ZiweiStar[];
  changsheng12?: string;
  boshi12?: string;
  jiangqian12?: string;
  suiqian12?: string;
  ages?: number[];
  decadal?: {
    range?: [number, number];
    heavenlyStem?: string;
    earthlyBranch?: string;
  };
  flyingTransformations?: ZiweiFlyingTransformation[];
}

interface ZiweiMutagenPlacement {
  mutagen: string;
  star: string;
  targetIndex: number;
  natalPalace: string;
  targetBranch: string;
  scopePalace: string;
}

interface ZiweiScopeLayer {
  index?: number;
  name?: string;
  heavenlyStem?: string;
  earthlyBranch?: string;
  palaceNames?: string[];
  mutagen?: string[];
  mutagenPlacements?: ZiweiMutagenPlacement[];
  stars?: ZiweiStar[][];
  nominalAge?: number;
}

interface ZiweiNatal {
  solarDate?: string;
  lunarDate?: string;
  chineseDate?: string;
  time?: string;
  timeRange?: string;
  sign?: string;
  zodiac?: string;
  soulBranch?: string;
  bodyBranch?: string;
  soul?: string;
  body?: string;
  fiveElementsClass?: string;
  palaces: ZiweiPalace[];
  patterns?: Array<{
    name?: string;
    kind?: string;
    description?: string;
    source?: string;
    quote?: string;
  }>;
}

type LayerKey = 'natal' | 'decadal' | 'yearly' | 'age' | 'monthly';

const LAYER_LABELS: Record<LayerKey, { title: string; prefix: string }> = {
  natal: { title: '本命盘', prefix: '本' },
  decadal: { title: '大限盘', prefix: '限' },
  yearly: { title: '流年盘', prefix: '年' },
  age: { title: '小限盘', prefix: '岁' },
  monthly: { title: '流月盘', prefix: '月' },
};

const ZIWEI_GRID_ORDER: ReadonlyArray<number | 'center' | 'center-skip'> = [
  3,
  4,
  5,
  6,
  2,
  'center',
  'center-skip',
  7,
  1,
  'center-skip',
  'center-skip',
  8,
  0,
  11,
  10,
  9,
];

const ZIWEI_PALACE_CENTER: Record<number, readonly [number, number]> = {
  0: [12.5, 87.5],
  1: [12.5, 62.5],
  2: [12.5, 37.5],
  3: [12.5, 12.5],
  4: [37.5, 12.5],
  5: [62.5, 12.5],
  6: [87.5, 12.5],
  7: [87.5, 37.5],
  8: [87.5, 62.5],
  9: [87.5, 87.5],
  10: [62.5, 87.5],
  11: [37.5, 87.5],
};

interface ZiweiBoardRules {
  algorithm?: string;
  mutagenSchool?: string;
  plateType?: string;
  tianmaMode?: string;
  leapMonthMode?: string;
}

function extractZiweiBundle(value: unknown): {
  natal: ZiweiNatal;
  layers?: Partial<Record<Exclude<LayerKey, 'natal'>, ZiweiScopeLayer>>;
  referenceLunar?: string;
  rules?: ZiweiBoardRules;
} | undefined {
  const data = unwrapBoardData(value);
  if (!data) return undefined;
  const natal = ('natal' in data && data.natal && typeof data.natal === 'object' ? data.natal : data) as Record<
    string,
    unknown
  >;
  if (!Array.isArray(natal.palaces) || natal.palaces.length < 12) return undefined;
  const ref = ('reference' in data && data.reference && typeof data.reference === 'object' ? data.reference : undefined) as
    | { layers?: Partial<Record<Exclude<LayerKey, 'natal'>, ZiweiScopeLayer>>; lunarDate?: string }
    | undefined;
  const basis = ('basis' in data && data.basis && typeof data.basis === 'object' ? data.basis : undefined) as
    | { rules?: ZiweiBoardRules }
    | undefined;
  return {
    natal: natal as unknown as ZiweiNatal,
    layers: ref?.layers,
    referenceLunar: ref?.lunarDate,
    rules: basis?.rules,
  };
}

function getSanfangIndices(index: number) {
  const opposite = (index + 6) % 12;
  const trine1 = (index + 4) % 12;
  const trine2 = (index + 8) % 12;
  return {
    opposite,
    trines: [trine1, trine2] as const,
    all: new Set([index, opposite, trine1, trine2]),
  };
}

function collectSelfMutagens(palace: ZiweiPalace): Map<string, string> {
  const map = new Map<string, string>();
  for (const ft of palace.flyingTransformations ?? []) {
    if (ft.targetIndex === palace.index || ft.relation === 'self') {
      map.set(ft.star, ft.mutagen);
    }
  }
  return map;
}

function getBrightnessClass(b?: string): string {
  if (!b) return '';
  if (b === '庙' || b === '旺') return 'is-high';
  if (b === '得' || b === '利') return 'is-mid';
  if (b === '陷' || b === '不') return 'is-low';
  return '';
}

function createStarTag(
  star: ZiweiStar,
  kind: 'major' | 'minor' | 'adj',
  options?: {
    selfMutagen?: string;
    scopeMutagen?: { prefix: string; mutagen: string };
    onOpenTerm?: (term: string) => void;
  },
): HTMLElement {
  const isClickable = Boolean(options?.onOpenTerm);
  const tag = el(isClickable ? 'button' : 'span', {
    ...(isClickable ? { type: 'button' as const } : {}),
    className: `ziwei-star is-${kind} ${isClickable ? 'is-clickable' : ''}`.trim(),
    ...(isClickable
      ? {
          title: `点击查看「${star.name}」释义`,
          onClick: () => options?.onOpenTerm?.(star.name),
        }
      : {}),
  });

  tag.append(el('span', { className: 'ziwei-star-name', text: star.name }));

  if (star.brightness) {
    tag.append(
      el('span', {
        className: `ziwei-star-bright ${getBrightnessClass(star.brightness)}`.trim(),
        text: star.brightness,
      }),
    );
  }

  if (star.mutagen) {
    tag.append(
      el('span', {
        className: 'ziwei-mutagen-badge',
        text: star.mutagen,
        title: `生年化${star.mutagen}`,
        dataset: { mutagen: star.mutagen },
      }),
    );
  }

  if (options?.selfMutagen) {
    tag.append(
      el('span', {
        className: 'ziwei-mutagen-badge is-self',
        text: `自${options.selfMutagen}`,
        title: `宫干自化${options.selfMutagen}`,
        dataset: { mutagen: options.selfMutagen },
      }),
    );
  }

  if (options?.scopeMutagen) {
    tag.append(
      el('span', {
        className: 'ziwei-mutagen-badge is-scope',
        text: `${options.scopeMutagen.prefix}${options.scopeMutagen.mutagen}`,
        title: `${options.scopeMutagen.prefix}化${options.scopeMutagen.mutagen}`,
        dataset: { mutagen: options.scopeMutagen.mutagen },
      }),
    );
  }

  return tag;
}

export function renderZiweiBoard(container: HTMLElement, value: unknown): boolean {
  const bundle = extractZiweiBundle(value);
  if (!bundle) {
    container.hidden = true;
    container.replaceChildren();
    return false;
  }

  const { natal, layers, rules } = bundle;
  const palaceByIndex = new Map<number, ZiweiPalace>();
  for (const palace of natal.palaces) {
    palaceByIndex.set(palace.index, palace);
  }

  const defaultSelected =
    natal.palaces.find((p) => p.name === '命宫' || p.earthlyBranch === natal.soulBranch)?.index ??
    natal.palaces[0].index;
  let selectedIndex = defaultSelected;
  let activeLayer: LayerKey = 'natal';

  const originPalace = natal.palaces.find((p) => p.isOriginalPalace);
  const termPanel = createTermPanel();
  const openTerm = (query: string) => termPanel.open(query);

  const shell = el('section', { className: 'board-card ziwei-board-shell', ariaLabel: '紫微斗数十二宫盘' });

  // 顶部栏
  const head = el('div', { className: 'board-head' });
  const titleGroup = el('div', { className: 'board-title-group' });
  titleGroup.append(el('h3', { className: 'board-title', text: '紫微十二宫方盘' }));
  if (natal.fiveElementsClass) {
    titleGroup.append(el('span', { className: 'board-chip is-accent', text: natal.fiveElementsClass }));
  }
  if (rules?.plateType === 'earth' || rules?.plateType === 'human') {
    titleGroup.append(el('span', { className: 'board-chip', text: rules.plateType === 'earth' ? '地盘·身宫立极' : '人盘·福德立极' }));
  }
  if (rules?.mutagenSchool && rules.mutagenSchool !== 'default') {
    const label = ({ zhongzhou: '中州四化', quanshu: '全书四化', tianfu: '天府科四化' } as Record<string, string>)[rules.mutagenSchool];
    if (label) titleGroup.append(el('span', { className: 'board-chip', text: label }));
  }
  if (originPalace) {
    titleGroup.append(
      el('span', { className: 'board-chip', text: `来因 ${originPalace.name}(${originPalace.heavenlyStem}${originPalace.earthlyBranch})` }),
    );
  }
  head.append(titleGroup);
  head.append(el('span', { className: 'board-hint', text: '点击任意宫位查看三方四正、星曜与飞星四化' }));
  shell.append(head);

  // 运限盘层切换条（仅当存在 reference.layers 时展示）
  const availableLayers: Array<{ key: LayerKey; label: string }> = [{ key: 'natal', label: '本命盘' }];
  if (layers) {
    for (const k of ['decadal', 'yearly', 'age', 'monthly'] as const) {
      const layer = layers[k];
      if (!layer) continue;
      const gz = `${layer.heavenlyStem ?? ''}${layer.earthlyBranch ?? ''}`;
      const ageTxt = k === 'age' && layer.nominalAge ? `${layer.nominalAge}岁` : '';
      availableLayers.push({
        key: k,
        label: `${LAYER_LABELS[k].title}${gz ? `·${gz}` : ''}${ageTxt ? `(${ageTxt})` : ''}`,
      });
    }
  }

  const layerButtons = new Map<LayerKey, HTMLButtonElement>();
  if (availableLayers.length > 1) {
    const tabBar = el('div', { className: 'wb-tabs ziwei-layer-tabs' });
    for (const item of availableLayers) {
      const btn = el('button', {
        type: 'button',
        className: `wb-tab${item.key === activeLayer ? ' is-active' : ''}`,
        text: item.label,
        onClick: () => {
          activeLayer = item.key;
          for (const [k, b] of layerButtons) {
            b.classList.toggle('is-active', k === activeLayer);
          }
          rebuildGridPalaces();
          renderSelectedState();
        },
      });
      layerButtons.set(item.key, btn);
      tabBar.append(btn);
    }
    shell.append(tabBar);
  }

  // 4x4 传统宣纸方盘容器
  const boardWrap = el('div', { className: 'ziwei-board-wrap' });
  const svgOverlay = svgEl('svg', {
    class: 'ziwei-relation-svg',
    viewBox: '0 0 100 100',
    preserveAspectRatio: 'none',
    'aria-hidden': 'true',
  });
  const grid = el('div', { className: 'ziwei-grid' });
  const centerNode = el('div', { className: 'ziwei-center' });
  const detailCard = el('div', { className: 'ziwei-detail-card', ariaLabel: '当前选中宫位详情' });
  const detailSheet = createMobileDetailSheet(detailCard, { label: '紫微宫位详情' });

  const palaceButtons = new Map<number, HTMLButtonElement>();

  const getActiveLayerData = (): ZiweiScopeLayer | undefined =>
    activeLayer === 'natal' ? undefined : layers?.[activeLayer];

  const getScopeMutagenMap = (): Map<string, { prefix: string; mutagen: string }> => {
    const map = new Map<string, { prefix: string; mutagen: string }>();
    const layer = getActiveLayerData();
    if (!layer?.mutagenPlacements) return map;
    const prefix = LAYER_LABELS[activeLayer].prefix;
    for (const mp of layer.mutagenPlacements) {
      if (mp.star && mp.mutagen) {
        map.set(mp.star, { prefix, mutagen: mp.mutagen });
      }
    }
    return map;
  };

  const renderSelectedState = () => {
    const selected = palaceByIndex.get(selectedIndex) ?? natal.palaces[0];
    const sanfang = getSanfangIndices(selected.index);
    const oppositePalace = palaceByIndex.get(sanfang.opposite);
    const trineNames = sanfang.trines
      .map((idx) => palaceByIndex.get(idx)?.name)
      .filter(Boolean)
      .join('、');
    const layer = getActiveLayerData();
    const scopeMutagens = getScopeMutagenMap();
    const scopePalaceName = layer?.palaceNames?.[selected.index];

    for (const [idx, btn] of palaceButtons) {
      btn.classList.toggle('is-selected', idx === selected.index);
      btn.classList.toggle('is-opposite', idx === sanfang.opposite);
      btn.classList.toggle('is-sanfang', idx !== selected.index && idx !== sanfang.opposite && sanfang.all.has(idx));
      btn.setAttribute('aria-pressed', idx === selected.index ? 'true' : 'false');
    }

    // SVG 三方四正实线三角形 + 对宫虚线连线
    svgOverlay.replaceChildren();
    const pSel = ZIWEI_PALACE_CENTER[selected.index];
    const pOpp = ZIWEI_PALACE_CENTER[sanfang.opposite];
    const pT1 = ZIWEI_PALACE_CENTER[sanfang.trines[0]];
    const pT2 = ZIWEI_PALACE_CENTER[sanfang.trines[1]];
    if (pSel && pOpp && pT1 && pT2) {
      svgOverlay.append(
        svgEl('polygon', {
          class: 'ziwei-relation-triangle',
          points: `${pSel[0]},${pSel[1]} ${pT1[0]},${pT1[1]} ${pT2[0]},${pT2[1]}`,
        }),
        svgEl('line', {
          class: 'ziwei-relation-opposite',
          x1: pSel[0],
          y1: pSel[1],
          x2: pOpp[0],
          y2: pOpp[1],
        }),
      );
      for (const pt of [pSel, pOpp, pT1, pT2]) {
        svgOverlay.append(
          svgEl('circle', {
            class: 'ziwei-relation-dot',
            cx: pt[0],
            cy: pt[1],
            r: 0.7,
          }),
        );
      }
    }

    // 中宫区域：命盘核心摘要 + 当前选中宫位详情
    centerNode.replaceChildren();
    const centerHead = el('div', { className: 'ziwei-center-head' });
    centerHead.append(
      el('span', {
        className: 'ziwei-center-title',
        text: layer ? `${LAYER_LABELS[activeLayer].title}摘要` : '本命盘摘要',
      }),
    );
    if (natal.fiveElementsClass) {
      centerHead.append(el('span', { className: 'ziwei-center-class', text: natal.fiveElementsClass }));
    }

    const centerMeta = el('div', { className: 'ziwei-center-meta' });
    const metaItems: Array<[string, string | undefined]> = [
      ['阳历', natal.solarDate],
      ['农历', natal.lunarDate],
      ['四柱', natal.chineseDate],
      ['时辰', natal.time ? `${natal.time}${natal.timeRange ? ` (${natal.timeRange})` : ''}` : undefined],
    ];
    for (const [label, val] of metaItems) {
      if (!val) continue;
      const row = el('div', { className: 'ziwei-center-row' });
      row.append(
        el('span', { className: 'ziwei-center-label', text: label }),
        el('strong', { className: 'ziwei-center-val', text: val }),
      );
      centerMeta.append(row);
    }

    const chipRow = el('div', { className: 'ziwei-center-chips' });
    if (natal.soul) {
      chipRow.append(
        el('button', {
          type: 'button',
          className: 'board-term-trigger ziwei-center-chip',
          text: `命主 ${natal.soul}`,
          onClick: () => openTerm('命宫'),
        }),
      );
    }
    if (natal.body) {
      chipRow.append(
        el('button', {
          type: 'button',
          className: 'board-term-trigger ziwei-center-chip',
          text: `身主 ${natal.body}`,
          onClick: () => openTerm('身宫'),
        }),
      );
    }
    if (natal.soulBranch) {
      chipRow.append(el('span', { className: 'ziwei-center-chip', text: `命宫 ${natal.soulBranch}` }));
    }
    if (natal.bodyBranch) {
      chipRow.append(el('span', { className: 'ziwei-center-chip', text: `身宫 ${natal.bodyBranch}` }));
    }
    if (originPalace) {
      chipRow.append(el('span', { className: 'ziwei-center-chip', text: `来因 ${originPalace.name}` }));
    }

    if (layer?.mutagenPlacements?.length) {
      const scopeRow = el('div', { className: 'ziwei-center-scope-mutagens' });
      const prefix = LAYER_LABELS[activeLayer].prefix;
      for (const mp of layer.mutagenPlacements) {
        scopeRow.append(
          el('span', {
            className: 'ziwei-mutagen-badge is-scope',
            text: `${prefix}${mp.mutagen}:${mp.star}→${mp.natalPalace}`,
            dataset: { mutagen: mp.mutagen },
          }),
        );
      }
      centerMeta.append(scopeRow);
    }

    const focusBox = el('div', { className: 'ziwei-center-focus' });
    const focusTitle = el('div', { className: 'ziwei-center-focus-head' });
    focusTitle.append(
      el('strong', {
        className: 'ziwei-center-focus-name',
        text: `${selected.name}${scopePalaceName ? ` / ${LAYER_LABELS[activeLayer].prefix}·${scopePalaceName}` : ''}（${selected.heavenlyStem}${selected.earthlyBranch}）`,
      }),
    );
    if (selected.decadal?.range?.length === 2) {
      focusTitle.append(
        el('span', {
          className: 'board-chip',
          text: `大限 ${selected.decadal.range[0]}–${selected.decadal.range[1]}岁`,
        }),
      );
    }
    focusBox.append(focusTitle);

    const majorText = selected.majorStars?.length
      ? selected.majorStars
          .map((s) => `${s.name}${s.brightness ?? ''}${s.mutagen ? `[化${s.mutagen}]` : ''}`)
          .join('、')
      : '无主星（借对宫）';
    focusBox.append(el('div', { className: 'ziwei-center-focus-stars', text: `主星：${majorText}` }));

    const relRow = el('div', { className: 'ziwei-center-relations' });
    relRow.append(
      el('button', {
        type: 'button',
        className: 'board-term-trigger ziwei-rel-chip',
        text: `对宫：${oppositePalace?.name ?? '—'}`,
        onClick: () => openTerm('对宫'),
      }),
      el('button', {
        type: 'button',
        className: 'board-term-trigger ziwei-rel-chip',
        text: `三方：${trineNames || '—'}`,
        onClick: () => openTerm('三方四正'),
      }),
    );
    focusBox.append(relRow);
    centerNode.append(centerHead, centerMeta, chipRow, focusBox);

    // 下方独立详情卡（桌面端常驻 + 移动端底部抽屉）
    detailCard.replaceChildren();
    const detailHead = el('div', { className: 'ziwei-detail-head' });
    detailHead.append(
      el('strong', {
        className: 'ziwei-detail-title',
        text: `${selected.name}${scopePalaceName ? `（${LAYER_LABELS[activeLayer].title}·${scopePalaceName}）` : ''} · ${selected.heavenlyStem}${selected.earthlyBranch}${
          selected.decadal?.range?.length === 2
            ? `（大限 ${selected.decadal.range[0]}–${selected.decadal.range[1]}岁）`
            : ''
        }`,
      }),
      el('span', {
        className: 'ziwei-detail-sub',
        text: `对宫 ${oppositePalace?.name ?? '—'} · 三方 ${trineNames || '—'}`,
      }),
    );
    detailCard.append(detailHead);

    const selfMutagens = collectSelfMutagens(selected);
    const scopeStars = layer?.stars?.[selected.index] ?? [];
    const starGroups = el('div', { className: 'ziwei-detail-groups' });
    const appendStarGroup = (label: string, stars: ZiweiStar[] | undefined, kind: 'major' | 'minor' | 'adj') => {
      const group = el('div', { className: 'ziwei-detail-group' });
      group.append(el('span', { className: 'ziwei-detail-label', text: label }));
      const list = el('div', { className: 'ziwei-detail-stars' });
      if (!stars?.length) {
        list.append(el('span', { className: 'ziwei-detail-empty', text: '无' }));
      } else {
        for (const s of stars) {
          list.append(
            createStarTag(s, kind, {
              selfMutagen: selfMutagens.get(s.name),
              scopeMutagen: scopeMutagens.get(s.name),
              onOpenTerm: openTerm,
            }),
          );
        }
      }
      group.append(list);
      starGroups.append(group);
    };

    appendStarGroup('主星', selected.majorStars, 'major');
    appendStarGroup('辅星', selected.minorStars, 'minor');
    appendStarGroup('杂曜', selected.adjectiveStars, 'adj');
    if (scopeStars.length > 0) {
      appendStarGroup(`${LAYER_LABELS[activeLayer].prefix}曜`, scopeStars, 'minor');
    }
    detailCard.append(starGroups);

    const shenshaList = [
      selected.changsheng12 ? `长生·${selected.changsheng12}` : '',
      selected.boshi12 ? `博士·${selected.boshi12}` : '',
      selected.jiangqian12 ? `将前·${selected.jiangqian12}` : '',
      selected.suiqian12 ? `岁前·${selected.suiqian12}` : '',
    ].filter(Boolean);

    if (shenshaList.length || selected.ages?.length) {
      const metaFoot = el('div', { className: 'ziwei-detail-meta-strip' });
      for (const badge of shenshaList) {
        metaFoot.append(el('span', { className: 'ziwei-detail-badge', text: badge }));
      }
      if (selected.ages?.length) {
        metaFoot.append(
          el('span', {
            className: 'ziwei-detail-badge is-ages',
            text: `流年虚岁：${selected.ages.slice(0, 8).join(' · ')}`,
          }),
        );
      }
      detailCard.append(metaFoot);
    }

    if (selected.flyingTransformations?.length) {
      const flyRow = el('div', { className: 'ziwei-detail-fly' });
      flyRow.append(
        el('button', {
          type: 'button',
          className: 'board-term-trigger ziwei-detail-label',
          text: '宫干四化飞星',
          onClick: () => openTerm('四化'),
        }),
      );
      const flyList = el('div', { className: 'ziwei-fly-list' });
      for (const ft of selected.flyingTransformations) {
        const isSelf = ft.targetIndex === selected.index || ft.relation === 'self';
        flyList.append(
          el('button', {
            type: 'button',
            className: `ziwei-fly-item ${isSelf ? 'is-self' : ''}`.trim(),
            text: `${ft.star}化${ft.mutagen} → ${isSelf ? '自化' : `${ft.targetName}(${ft.targetBranch})`}`,
            title: isSelf ? '本宫自化' : `点击跳至${ft.targetName}查看三方四正`,
            dataset: { mutagen: ft.mutagen },
            onClick: () => {
              if (!isSelf && palaceByIndex.has(ft.targetIndex)) {
                selectedIndex = ft.targetIndex;
                renderSelectedState();
              }
            },
          }),
        );
      }
      flyRow.append(flyList);
      detailCard.append(flyRow);
    }
  };

  function rebuildGridPalaces() {
    grid.replaceChildren();
    palaceButtons.clear();
    const layer = getActiveLayerData();
    const scopeMutagens = getScopeMutagenMap();
    const prefix = LAYER_LABELS[activeLayer].prefix;

    for (const item of ZIWEI_GRID_ORDER) {
      if (item === 'center') {
        grid.append(centerNode);
        continue;
      }
      if (item === 'center-skip') {
        continue;
      }

      const palace = palaceByIndex.get(item);
      if (!palace) continue;

      const isMing = palace.name === '命宫' || palace.earthlyBranch === natal.soulBranch;
      const isShen = Boolean(palace.isBodyPalace);
      const selfMutagens = collectSelfMutagens(palace);
      const scopePalaceName = layer?.palaceNames?.[palace.index];
      const scopeStars = layer?.stars?.[palace.index] ?? [];
      const isScopeMing = scopePalaceName === '命宫';

      const btn = el('button', {
        type: 'button',
        className: `ziwei-palace ${isMing ? 'is-ming-palace' : ''} ${isShen ? 'is-body-palace' : ''} ${isScopeMing ? 'is-scope-ming' : ''}`.trim(),
        ariaLabel: `${palace.name} ${palace.heavenlyStem}${palace.earthlyBranch}`,
        onClick: () => {
          selectedIndex = palace.index;
          renderSelectedState();
          detailSheet.open();
        },
      });

      // 1. 顶部：横向排布主星（带亮度标 + 生年四化 + 宫干自化 + 运限四化）
      const pTop = el('div', { className: 'ziwei-palace-top' });
      if (palace.majorStars?.length) {
        const majors = el('div', { className: 'ziwei-star-row is-major-row' });
        for (const s of palace.majorStars) {
          majors.append(
            createStarTag(s, 'major', {
              selfMutagen: selfMutagens.get(s.name),
              scopeMutagen: scopeMutagens.get(s.name),
            }),
          );
        }
        pTop.append(majors);
      } else {
        pTop.append(el('span', { className: 'ziwei-empty-major', text: '无主星' }));
      }

      // 2. 中间：整齐排布辅星、流曜与杂曜
      const pMid = el('div', { className: 'ziwei-palace-mid' });
      if (palace.minorStars?.length) {
        const minors = el('div', { className: 'ziwei-star-row is-minor' });
        for (const s of palace.minorStars) {
          minors.append(
            createStarTag(s, 'minor', {
              selfMutagen: selfMutagens.get(s.name),
              scopeMutagen: scopeMutagens.get(s.name),
            }),
          );
        }
        pMid.append(minors);
      }
      if (scopeStars.length > 0) {
        const scopeRow = el('div', { className: 'ziwei-star-row is-scope-stars' });
        for (const s of scopeStars) {
          scopeRow.append(createStarTag(s, 'minor'));
        }
        pMid.append(scopeRow);
      }
      if (palace.adjectiveStars?.length) {
        const adjs = el('div', { className: 'ziwei-star-row is-adj' });
        for (const s of palace.adjectiveStars.slice(0, 5)) {
          adjs.append(createStarTag(s, 'adj'));
        }
        pMid.append(adjs);
      }

      // 3. 底部：左侧宫干支 + 长生/博士 + 大限，右侧宫名（含运限重排宫名）
      const pFoot = el('div', { className: 'ziwei-palace-foot' });
      const footLeft = el('div', { className: 'ziwei-palace-foot-left' });
      const gzRow = el('div', { className: 'ziwei-palace-foot-gzrow' });
      gzRow.append(
        el('span', {
          className: 'ziwei-palace-gz',
          text: `${palace.heavenlyStem}${palace.earthlyBranch}`,
        }),
      );
      if (palace.changsheng12) {
        gzRow.append(el('span', { className: 'ziwei-palace-changsheng', text: palace.changsheng12 }));
      }
      if (palace.boshi12) {
        gzRow.append(el('span', { className: 'ziwei-palace-boshi', text: palace.boshi12 }));
      }
      footLeft.append(gzRow);
      if (palace.decadal?.range?.length === 2) {
        footLeft.append(
          el('span', {
            className: 'ziwei-palace-decadal',
            text: `${palace.decadal.range[0]}-${palace.decadal.range[1]}`,
          }),
        );
      }

      const footRight = el('div', { className: 'ziwei-palace-foot-right' });
      if (scopePalaceName) {
        footRight.append(
          el('span', {
            className: `ziwei-scope-palace-badge${isScopeMing ? ' is-scope-ming' : ''}`,
            text: `${prefix}·${scopePalaceName}`,
          }),
        );
      }
      if (isMing || isShen) {
        const seal = el('span', { className: 'ziwei-palace-seal' });
        seal.append(el('strong', { className: 'ziwei-palace-name', text: palace.name }));
        if (isShen) {
          seal.append(el('span', { className: 'ziwei-seal-tag', text: '身' }));
        }
        footRight.append(seal);
      } else {
        footRight.append(el('strong', { className: 'ziwei-palace-name', text: palace.name }));
        if (palace.isOriginalPalace) {
          footRight.append(el('span', { className: 'ziwei-palace-origin-tag', text: '因' }));
        }
      }

      pFoot.append(footLeft, footRight);

      btn.append(pTop, pMid, pFoot);
      palaceButtons.set(palace.index, btn);
      grid.append(btn);
    }
  }

  rebuildGridPalaces();
  boardWrap.append(svgOverlay, grid);
  shell.append(boardWrap, detailSheet.element);

  // 展现本命四化总览 & 经典格局
  const siHuaEntries: string[] = [];
  for (const pal of natal.palaces) {
    for (const s of [...(pal.majorStars ?? []), ...(pal.minorStars ?? [])]) {
      if (s.mutagen) {
        siHuaEntries.push(`${s.name}化${s.mutagen}（${pal.name}）`);
      }
    }
  }
  if (siHuaEntries.length > 0) {
    const refSec = el('div', { className: 'ziwei-patterns-card' });
    refSec.append(el('h4', { className: 'ziwei-patterns-title', text: '本命四化总览' }));
    const chips = el('div', { className: 'wb-chip-wrap' });
    for (const sh of siHuaEntries) {
      chips.append(el('span', { className: 'wb-badge wb-badge-warn', text: sh }));
    }
    refSec.append(chips);
    shell.append(refSec);
  }
  if (natal.patterns?.length) {
    const patSec = el('div', { className: 'ziwei-patterns-card' });
    patSec.append(el('h4', { className: 'ziwei-patterns-title', text: `命盘经典格局（${natal.patterns.length}项）` }));
    const patList = el('div', { className: 'ziwei-patterns-list' });
    for (const pat of natal.patterns) {
      const card = el('div', { className: 'ziwei-pattern-item' });
      card.append(
        el('strong', {
          className: `ziwei-pattern-name ${pat.kind === 'auspicious' ? 'is-good' : ''}`.trim(),
          text: pat.name ?? '格局',
        }),
      );
      if (pat.description) card.append(el('p', { className: 'ziwei-pattern-desc', text: pat.description }));
      if (pat.source || pat.quote) {
        card.append(el('small', { className: 'ziwei-pattern-quote', text: `${pat.source ? `${pat.source}：` : ''}${pat.quote ?? ''}` }));
      }
      patList.append(card);
    }
    patSec.append(patList);
    shell.append(patSec);
  }

  shell.append(termPanel.element);

  renderSelectedState();

  container.hidden = false;
  container.replaceChildren(shell);
  return true;
}
