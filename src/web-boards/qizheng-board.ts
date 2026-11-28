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

const SIGN_BRANCHES = ['戌', '酉', '申', '未', '午', '巳', '辰', '卯', '寅', '丑', '子', '亥'] as const;

const MANSION_QUADRANT: Record<string, 'east' | 'north' | 'west' | 'south'> = {
  角: 'east', 亢: 'east', 氐: 'east', 房: 'east', 心: 'east', 尾: 'east', 箕: 'east',
  斗: 'north', 牛: 'north', 女: 'north', 虚: 'north', 危: 'north', 室: 'north', 壁: 'north',
  奎: 'west', 娄: 'west', 胃: 'west', 昴: 'west', 毕: 'west', 觜: 'west', 参: 'west',
  井: 'south', 鬼: 'south', 柳: 'south', 星: 'south', 张: 'south', 翼: 'south', 轸: 'south',
};

function polarToXY(cx: number, cy: number, r: number, degFromTop: number): [number, number] {
  const rad = ((degFromTop - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

function buildQizhengWheel(
  stars: UnknownRecord[],
  twelvePalaces: UnknownRecord[],
  mansionBoundaries: UnknownRecord[],
  mingGong: number | undefined,
  shenGong: number | undefined,
  mingZhu: string | undefined,
  mingDu: UnknownRecord | undefined,
  sect: string | undefined,
  moonName: string | undefined,
  roleSets: { en: Set<string>; nan: Set<string>; yong: Set<string>; chou: Set<string> },
): SVGSVGElement {
  const svg = svgEl('svg', {
    viewBox: '0 0 440 440',
    class: 'qz-svg',
    role: 'img',
    'aria-label': '七政四余二十八宿十二宫星盘',
  });

  const cx = 220;
  const cy = 220;
  const rMansionOuter = 208;
  const rOuter = 178;
  const rMid = 142;
  const rInner = 104;
  const rCore = 52;

  // Concentric rings
  svg.append(
    svgEl('circle', { cx, cy, r: rMansionOuter, class: 'qz-ring-mansion' }),
    svgEl('circle', { cx, cy, r: rOuter, class: 'qz-ring-outer' }),
    svgEl('circle', { cx, cy, r: rMid, class: 'qz-ring-mid' }),
    svgEl('circle', { cx, cy, r: rInner, class: 'qz-ring-inner' }),
    svgEl('circle', { cx, cy, r: rCore, class: 'qz-ring-core' }),
  );

  // Outer Layer: 28 Mansions (二十八宿精确刻度环)
  const mansionEntries: Array<{ lon: number; width: number; name: string; labelLon: number }> = [];
  for (const m of mansionBoundaries) {
    const lon = asNumber(m.longitude);
    const width = asNumber(m.widthDegrees);
    const name = asString(m.mansion) ?? '';
    if (lon === undefined || width === undefined || !name) continue;
    const [x1, y1] = polarToXY(cx, cy, rOuter, lon);
    const [x2, y2] = polarToXY(cx, cy, rMansionOuter, lon);
    svg.append(svgEl('line', { x1: x1.toFixed(1), y1: y1.toFixed(1), x2: x2.toFixed(1), y2: y2.toFixed(1), class: 'qz-mansion-spoke' }));
    mansionEntries.push({ lon, width, name, labelLon: (lon + width / 2) % 360 });
  }

  mansionEntries.sort((a, b) => a.labelLon - b.labelLon);
  const minSep = 7.2;
  for (let pass = 0; pass < 3; pass += 1) {
    for (let i = 0; i < mansionEntries.length; i += 1) {
      const nextIdx = (i + 1) % mansionEntries.length;
      const cur = mansionEntries[i]!;
      const nxt = mansionEntries[nextIdx]!;
      const diff = (nxt.labelLon - cur.labelLon + 360) % 360;
      if (diff < minSep) {
        const push = (minSep - diff) / 2;
        cur.labelLon = (cur.labelLon - push + 360) % 360;
        nxt.labelLon = (nxt.labelLon + push) % 360;
      }
    }
  }

  for (const entry of mansionEntries) {
    const [mx, my] = polarToXY(cx, cy, (rOuter + rMansionOuter) / 2, entry.labelLon);
    const quad = MANSION_QUADRANT[entry.name] ?? 'east';
    const label = svgEl('text', {
      x: mx.toFixed(1),
      y: my.toFixed(1),
      class: `qz-mansion-text is-quad-${quad}`,
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
    });
    label.textContent = entry.name;
    svg.append(label);
  }

  // Middle Layer: 12 Branches & 12 Palaces
  const palaceBySign = new Map<number, UnknownRecord>();
  for (const p of twelvePalaces) {
    const idx = asNumber(p.signIndex);
    if (idx !== undefined) palaceBySign.set(idx, p);
  }

  for (let i = 0; i < 12; i += 1) {
    const startDeg = i * 30;
    const midDeg = startDeg + 15;
    const [x1, y1] = polarToXY(cx, cy, rInner, startDeg);
    const [x2, y2] = polarToXY(cx, cy, rOuter, startDeg);
    svg.append(svgEl('line', { x1: x1.toFixed(1), y1: y1.toFixed(1), x2: x2.toFixed(1), y2: y2.toFixed(1), class: 'qz-spoke' }));

    const pInfo = palaceBySign.get(i);
    const branch = asString(pInfo?.signBranch) ?? SIGN_BRANCHES[i];
    const palaceName = asString(pInfo?.palace) ?? '';
    const isMing = mingGong === i;
    const isShen = shenGong === i;

    const [bx, by] = polarToXY(cx, cy, (rOuter + rMid) / 2, midDeg);
    const branchLabel = svgEl('text', {
      x: bx.toFixed(1),
      y: by.toFixed(1),
      class: `qz-branch-text${isMing ? ' is-ming' : ''}`,
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
    });
    branchLabel.textContent = branch;
    svg.append(branchLabel);

    if (palaceName) {
      const [px, py] = polarToXY(cx, cy, (rMid + rInner) / 2, midDeg);
      const palLabel = svgEl('text', {
        x: px.toFixed(1),
        y: py.toFixed(1),
        class: `qz-palace-text${isMing ? ' is-ming' : isShen ? ' is-shen' : ''}`,
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
      });
      palLabel.textContent = palaceName;
      svg.append(palLabel);
    }
  }

  // 命度指针
  const mingDuLon = asNumber(mingDu?.longitude);
  if (mingDuLon !== undefined) {
    const [mx1, my1] = polarToXY(cx, cy, rCore, mingDuLon);
    const [mx2, my2] = polarToXY(cx, cy, rMansionOuter, mingDuLon);
    svg.append(
      svgEl('line', {
        x1: mx1.toFixed(1),
        y1: my1.toFixed(1),
        x2: mx2.toFixed(1),
        y2: my2.toFixed(1),
        class: 'qz-mingdu-ray',
      }),
    );
  }

  // Inner Layer: 11 Stars colored by 恩/难/用/仇
  const sortedStars = [...stars]
    .map((s) => ({ raw: s, lon: asNumber(s.longitude) ?? 0 }))
    .sort((a, b) => a.lon - b.lon);

  const placedAngles: number[] = [];
  for (const item of sortedStars) {
    let angle = item.lon;
    for (const prev of placedAngles) {
      if (Math.abs(angle - prev) < 14) {
        angle = prev + 14;
      }
    }
    placedAngles.push(angle);

    const fullName = asString(item.raw.name) ?? '';
    const key = asString(item.raw.key) ?? fullName.slice(0, 1) ?? '星';
    const retro = item.raw.retrograde === true;
    const [sx, sy] = polarToXY(cx, cy, 78, angle);
    const [dotX, dotY] = polarToXY(cx, cy, rInner - 3, item.lon);

    const roleClass = roleSets.en.has(fullName)
      ? 'is-en'
      : roleSets.nan.has(fullName)
        ? 'is-nan'
        : roleSets.yong.has(fullName)
          ? 'is-yong'
          : roleSets.chou.has(fullName)
            ? 'is-chou'
            : '';

    svg.append(
      svgEl('circle', {
        cx: dotX.toFixed(1),
        cy: dotY.toFixed(1),
        r: 2.8,
        class: `qz-star-dot ${roleClass}`.trim(),
      }),
    );

    const starText = svgEl('text', {
      x: sx.toFixed(1),
      y: sy.toFixed(1),
      class: `qz-star-text ${roleClass}${retro ? ' is-retro' : ''}`.trim(),
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
    });
    const titleEl = svgEl('title');
    titleEl.textContent = `${fullName}${retro ? ' 逆行' : ''} · ${asString(item.raw.signBranch) ?? ''} ${asString(item.raw.palace) ?? ''} · ${asString(item.raw.xiu) ?? ''}宿${asNumber(item.raw.xiuDegree)?.toFixed(1) ?? ''}°`;
    starText.append(titleEl);
    starText.append(document.createTextNode(retro ? `${key}℞` : key));
    svg.append(starText);
  }

  // Center core text
  const c1 = svgEl('text', { x: cx, y: cy - 12, class: 'qz-core-title', 'text-anchor': 'middle' });
  c1.textContent = mingZhu ? `命主 ${mingZhu}` : '七政四余';
  const c2 = svgEl('text', { x: cx, y: cy + 6, class: 'qz-core-sub', 'text-anchor': 'middle' });
  c2.textContent = sect ?? '';
  const c3 = svgEl('text', { x: cx, y: cy + 22, class: 'qz-core-sub', 'text-anchor': 'middle' });
  c3.textContent = mingDu && asString(mingDu.xiu) ? `命度 ${asString(mingDu.xiu)}宿` : moonName ?? '';
  svg.append(c1, c2, c3);

  return svg;
}

export function renderQizhengBoard(container: HTMLElement, _method: string, rawData: unknown): boolean {
  const data = asRecord(rawData);
  if (!data) return false;

  const stars = asArray(data.stars).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  const twelvePalaces = asArray(data.twelvePalaces).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  if (stars.length === 0 && twelvePalaces.length === 0) return false;

  const mansionBoundaries = asArray(data.mansionBoundaries).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  const mingGong = asNumber(data.mingGong);
  const shenGong = asNumber(data.shenGong);
  const mingZhu = asString(data.mingZhu);
  const mingDu = asRecord(data.mingDu);
  const enNan = asRecord(data.enNan);
  const moonPhase = asRecord(data.moonPhase);
  const illumination = asRecord(data.illumination);
  const sect = asString(enNan?.sect);
  const moonName = asString(moonPhase?.eightPhaseName);

  const mingPalaceObj = twelvePalaces.find((p) => asNumber(p.signIndex) === mingGong);
  const shenPalaceObj = twelvePalaces.find((p) => asNumber(p.signIndex) === shenGong);

  const enSet = new Set(asArray(enNan?.enStars).map(asString).filter((x): x is string => Boolean(x)));
  const nanSet = new Set(asArray(enNan?.nanStars).map(asString).filter((x): x is string => Boolean(x)));
  const chouSet = new Set(asArray(enNan?.chouStars).map(asString).filter((x): x is string => Boolean(x)));
  const yongSet = new Set(asArray(enNan?.yongStars).map(asString).filter((x): x is string => Boolean(x)));

  const badges: Array<{ text: string; tone?: 'accent' | 'neutral' | 'good' | 'warn' }> = [];
  if (sect) badges.push({ text: sect, tone: 'neutral' });
  if (mingZhu) badges.push({ text: `命主 ${mingZhu}`, tone: 'accent' });
  if (mingPalaceObj && asString(mingPalaceObj.signBranch)) {
    badges.push({ text: `命宫 ${asString(mingPalaceObj.signBranch)}`, tone: 'good' });
  }
  if (shenPalaceObj && asString(shenPalaceObj.signBranch)) {
    badges.push({ text: `身宫 ${asString(shenPalaceObj.signBranch)}`, tone: 'neutral' });
  }
  if (mingDu && asString(mingDu.xiu)) {
    badges.push({ text: `命度 ${asString(mingDu.xiu)}宿${asNumber(mingDu.xiuDegree)?.toFixed(1) ?? ''}°`, tone: 'accent' });
  }
  if (moonName) badges.push({ text: moonName, tone: 'neutral' });

  container.append(createBoardHeader('七政四余星盘', asString(enNan?.sectSummary), badges));

  // Main layout: 440x440 SVG wheel + Star Palace Table
  const mainGrid = el('div', 'qz-main-grid');
  const wheelBox = el('div', 'qz-wheel-box');
  wheelBox.append(
    buildQizhengWheel(stars, twelvePalaces, mansionBoundaries, mingGong, shenGong, mingZhu, mingDu, sect, moonName, {
      en: enSet,
      nan: nanSet,
      yong: yongSet,
      chou: chouSet,
    }),
  );
  mainGrid.append(wheelBox);

  const starTableWrap = el('div', 'qz-table-wrap');
  const table = el('table', 'qz-table');
  const thead = el('thead');
  const headRow = el('tr');
  for (const h of ['星曜', '宫位', '宿度', '庙旺', '恩难']) {
    headRow.append(el('th', undefined, h));
  }
  thead.append(headRow);
  table.append(thead);

  const tbody = el('tbody');
  for (const s of stars) {
    const name = asString(s.name) ?? '—';
    const branch = asString(s.signBranch) ?? '';
    const palace = asString(s.palace) ?? '';
    const xiu = asString(s.xiu) ?? '';
    const xiuDeg = asNumber(s.xiuDegree);
    const dignity = asString(s.dignity) ?? '平';
    const retro = s.retrograde === true;

    let role = '—';
    if (enSet.has(name)) role = '恩星';
    else if (nanSet.has(name)) role = '难星';
    else if (chouSet.has(name)) role = '仇星';
    else if (yongSet.has(name)) role = '用星';

    const tr = el('tr');
    tr.append(el('td', 'qz-td-star', `${name}${retro ? ' ℞' : ''}`));
    tr.append(el('td', undefined, `${branch} · ${palace}`));
    tr.append(el('td', 'qz-td-mono', xiu ? `${xiu}${xiuDeg !== undefined ? ` ${xiuDeg.toFixed(1)}°` : ''}` : '—'));
    tr.append(el('td', undefined, dignity));
    tr.append(el('td', role === '恩星' ? 'qz-role-good' : role === '难星' ? 'qz-role-warn' : undefined, role));
    tbody.append(tr);
  }
  table.append(tbody);
  starTableWrap.append(table);
  mainGrid.append(starTableWrap);
  container.append(mainGrid);

  // 恩难用仇 + 命度 + 昼夜天文基准
  const sunCrossings = asArray(asRecord(illumination?.sunriseSunset)?.crossings)
    .map(asRecord)
    .filter((x): x is UnknownRecord => Boolean(x));
  const sunriseText = sunCrossings
    .map((c) => {
      const dir = asString(c.direction);
      const label = dir === 'rise' || dir === '上行' ? '日出' : '日没';
      return `${label} ${asString(c.localDateTime)?.slice(11, 16) ?? ''}`;
    })
    .filter(Boolean)
    .join(' · ');

  const shensha = asRecord(data.shensha);
  const shenshaStars = asArray(shensha?.stars).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  const qzAspects = asArray(data.aspects).map(asRecord).filter((x): x is UnknownRecord => Boolean(x));
  const timeLords = asRecord(data.timeLords);
  const flowing = asRecord(data.flowing);
  const illumFrac = asNumber(moonPhase?.illuminationFraction);

  if (enNan || mingDu || timeLords || flowing) {
    const enNanMeta = createMetaGrid([
      ['恩用仇难', [
        Array.from(enSet).length ? `恩:${Array.from(enSet).join('、')}` : '',
        Array.from(yongSet).length ? `用:${Array.from(yongSet).join('、')}` : '',
        Array.from(chouSet).length ? `仇:${Array.from(chouSet).join('、')}` : '',
        Array.from(nanSet).length ? `难:${Array.from(nanSet).join('、')}` : '',
      ].filter(Boolean).join(' · ') || '无'],
      [
        '立命宿度',
        mingDu
          ? `${asString(mingDu.signBranch) ?? ''}宫 ${asString(mingDu.xiu) ?? ''}宿${asNumber(mingDu.xiuDegree)?.toFixed(2) ?? ''}°（度主 ${asString(mingDu.duZhu) ?? ''}）`
          : undefined,
      ],
      [
        '童限 / 主限',
        timeLords
          ? [
              asString(timeLords.currentStage) ?? asString(timeLords.summary),
              asString(timeLords.lord) ? `主星 ${asString(timeLords.lord)}` : '',
            ]
              .filter(Boolean)
              .join(' · ')
          : undefined,
      ],
      [
        '流年小限与太岁',
        flowing
          ? [
              asString(flowing.yearBranch) ? `太岁${asString(flowing.yearBranch)}` : '',
              asString(flowing.xiaoXian) ? `小限${asString(flowing.xiaoXian)}` : '',
              asString(flowing.summary),
            ]
              .filter(Boolean)
              .join(' · ')
          : undefined,
      ],
    ]);
    if (enNanMeta) {
      enNanMeta.classList.add('qz-meta-grid');
      container.append(enNanMeta);
    }
  }

  const shenshaAspectCount = shenshaStars.length + qzAspects.length;
  const shenshaAspectTrigger =
    shenshaAspectCount > 0
      ? createBoardModalTrigger(
          '神煞与天星相位',
          '七政神煞与天星相位明细',
          () => {
            const frag = document.createDocumentFragment();
            if (shenshaStars.length > 0) {
              const sec = el('div', 'lr-section');
              sec.append(el('h4', 'lr-section-title', `星盘神煞（共 ${shenshaStars.length} 项）`));
              const wrap = el('div', 'wb-chip-wrap');
              for (const st of shenshaStars) {
                const n = asString(st.name) ?? '';
                const v = asString(st.value) ?? '';
                if (n) wrap.append(el('span', 'wb-badge wb-badge-neutral', `${n}：${v}`));
              }
              sec.append(wrap);
              frag.append(sec);
            }
            if (qzAspects.length > 0) {
              const sec = el('div', 'lr-section');
              sec.append(el('h4', 'lr-section-title', `天星相位（共 ${qzAspects.length} 条）`));
              const wrap = el('div', 'wb-chip-wrap');
              for (const asp of qzAspects) {
                const s1 = asString(asp.star1) ?? '';
                const s2 = asString(asp.star2) ?? '';
                const tp = asString(asp.type) ?? '';
                const orb = asNumber(asp.orb);
                const cls = asString(asp.closeness);
                const txt = `${s1} ${tp} ${s2}${orb !== undefined ? ` (${orb.toFixed(1)}°` : ''}${cls ? ` · ${cls})` : orb !== undefined ? ')' : ''}`;
                wrap.append(el('span', `wb-badge ${cls === '紧密' ? 'wb-badge-accent' : 'wb-badge-neutral'}`, txt));
              }
              sec.append(wrap);
              frag.append(sec);
            }
            return frag;
          },
          `${shenshaAspectCount}项`,
        )
      : undefined;

  const astroBasisPairs: Array<[string, string | undefined]> = [
    ['恩星', Array.from(enSet).join('、') || '无'],
    ['难星', Array.from(nanSet).join('、') || '无'],
    ['用星', Array.from(yongSet).join('、') || '无'],
    ['仇星', Array.from(chouSet).join('、') || '无'],
    [
      '立命口径',
      mingDu
        ? `${asString(mingDu.method) ?? '命度'}：${asString(mingDu.signBranch) ?? ''}宫 ${asString(mingDu.xiu) ?? ''}宿${asNumber(mingDu.xiuDegree)?.toFixed(2) ?? ''}°`
        : undefined,
    ],
    [
      '天文昼夜',
      illumination
        ? `${illumination.daylight === true ? '昼生' : '夜生'}${sunriseText ? ` · ${sunriseText}` : ''}`
        : undefined,
    ],
    [
      '月相节律',
      moonPhase
        ? [
            moonName,
            illumFrac !== undefined ? `照度 ${Math.round(illumFrac * 100)}%` : '',
            asNumber(moonPhase.approximateMoonAgeDays) !== undefined
              ? `月龄 ${asNumber(moonPhase.approximateMoonAgeDays)?.toFixed(1)}日`
              : '',
          ]
            .filter(Boolean)
            .join(' · ')
        : undefined,
    ],
  ];
  const astroBasisTrigger = astroBasisPairs.some((p) => Boolean(p[1]))
    ? createBoardModalTrigger(
        '昼夜月相与宿度依据',
        '七政四余天文昼夜、月相与恩用仇难依据',
        () => createMetaGrid(astroBasisPairs) ?? el('div'),
      )
    : undefined;

  const qzBar = createBoardDetailBar([shenshaAspectTrigger, astroBasisTrigger]);
  if (qzBar) container.append(qzBar);

  return true;
}
