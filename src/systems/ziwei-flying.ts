type FlyingPalace = {
  index?: number;
  name: string;
  heavenlyStem: string;
  majorStars?: readonly { name: string; mutagen?: string }[];
  minorStars?: readonly { name: string; mutagen?: string }[];
  flyingTransformations: readonly { mutagen: string; star: string; targetIndex?: number; targetName: string; targetBranch: string; relation: string }[];
};

type NatalPalace = { index: number; name: string; earthlyBranch: string; majorStars: readonly { name: string }[]; minorStars: readonly { name: string }[] };
type ScopeLayer = { name: string; heavenlyStem: string; mutagen: readonly string[]; palaceNames: readonly string[] };
type ScopeFlyingPalace = Omit<FlyingPalace, 'flyingTransformations'> & { index: number; earthlyBranch: string; flyingTransformations: readonly { mutagen: string; star: string; targetIndex: number; targetName: string; targetBranch: string; relation: string }[] };

/** 按当前运限四化星名定位本命物理宫位及该层动态宫名。 */
export function locateScopeMutagens(palaces: readonly NatalPalace[], layer: ScopeLayer) {
  if (layer.mutagen.length !== 4 || layer.palaceNames.length !== 12) throw new Error(`紫微${layer.name}四化或宫序数据不完整。`);
  return (['禄', '权', '科', '忌'] as const).map((mutagen, index) => {
    const star = layer.mutagen[index];
    const matches = palaces.filter((palace) => [...palace.majorStars, ...palace.minorStars].some((item) => item.name === star));
    if (matches.length !== 1) throw new Error(`紫微${layer.name}化${mutagen}${star}落宫无法确认。`);
    const target = matches[0], scopePalace = layer.palaceNames[target.index];
    if (!scopePalace) throw new Error(`紫微${layer.name}化${mutagen}的运限宫名缺失。`);
    return { mutagen, star, targetIndex: target.index, natalPalace: target.name, targetBranch: target.earthlyBranch, scopePalace };
  });
}

export function formatScopeMutagens(items: ReturnType<typeof locateScopeMutagens>) {
  return items.map((item) => `化${item.mutagen}${item.star}→本命${item.natalPalace}（${item.targetBranch}），该运限${item.scopePalace}`).join('；');
}

/** 构建指定运限十二宫的逐宫飞化结构（每宫以所在宫干飞禄权科忌，同时标注本命宫名与运限动态宫名）。 */
export function buildScopePalaceFlying(palaces: readonly ScopeFlyingPalace[], palaceNames: readonly string[]) {
  if (palaces.length !== 12 || palaceNames.length !== 12 || new Set(palaceNames).size !== 12) throw new Error('紫微运限宫序数据不完整。');
  return palaces.map((palace) => {
    const scopePalace = palaceNames[palace.index];
    if (!scopePalace || palace.flyingTransformations.length !== 4) throw new Error('紫微运限来源宫位资料不完整。');
    const transformations = palace.flyingTransformations.map((item) => {
      const targetScopePalace = palaceNames[item.targetIndex];
      if (!targetScopePalace) throw new Error('紫微运限飞化目标宫位缺失。');
      return {
        mutagen: item.mutagen,
        star: item.star,
        targetIndex: item.targetIndex,
        targetNatalPalace: item.targetName,
        targetScopePalace,
        targetBranch: item.targetBranch,
        relation: item.relation,
      };
    });
    return {
      index: palace.index,
      scopePalace,
      natalPalace: palace.name,
      heavenlyStem: palace.heavenlyStem,
      earthlyBranch: palace.earthlyBranch,
      transformations,
    };
  });
}

/** 同一本命宫干飞化按运限宫序重新标注，不另起宫干或计算流曜飞化。 */
export function formatScopeFlying(palaces: readonly ScopeFlyingPalace[], palaceNames: readonly string[]) {
  if (palaces.length !== 12 || palaceNames.length !== 12 || new Set(palaceNames).size !== 12) throw new Error('紫微运限宫序数据不完整。');
  return palaces.map((palace) => {
    const source = palaceNames[palace.index];
    if (!source || palace.flyingTransformations.length !== 4) throw new Error('紫微运限来源宫位资料不完整。');
    const targets = palace.flyingTransformations.map((item) => {
      const target = palaceNames[item.targetIndex];
      if (!target) throw new Error('紫微运限飞化目标宫位缺失。');
      return `化${item.mutagen}${item.star}→${target}（本命${item.targetName}·${item.targetBranch}${item.relation === 'self' ? '，自化' : item.relation === 'opposite' ? '，对宫' : ''}）`;
    });
    return `${source}（本命${palace.name}·${palace.earthlyBranch}，${palace.heavenlyStem}干）：${targets.join('；')}`;
  }).join('\n');
}

/** 格式化已计算的本命宫干四化；不补充跨盘或运限飞化。 */
export function formatNatalFlying(palaces: readonly FlyingPalace[]) {
  return palaces.map((palace) => `${palace.name}${palace.heavenlyStem}干：${palace.flyingTransformations.map((item) =>
    `化${item.mutagen}${item.star}→${item.targetName}${item.targetBranch}宫${item.relation === 'self' ? '（自化）' : item.relation === 'opposite' ? '（对宫）' : ''}`).join('；')}`).join('\n');
}

/** 提炼本命十二宫的离心自化、对宫飞入（冲照）、生年四化与自化同宫交汇及多宫集禄/集忌焦点，辅助飞星派快速定位。 */
export function formatFeixingHighlights(palaces: readonly FlyingPalace[]): string {
  const selfItems: string[] = [];
  const oppositeItems: string[] = [];
  const natalSelfLinks: string[] = [];
  const luTargets = new Map<string, string[]>();
  const jiTargets = new Map<string, string[]>();

  for (const palace of palaces) {
    const natalMutagens = new Map<string, string>();
    for (const star of [...(palace.majorStars ?? []), ...(palace.minorStars ?? [])]) {
      if (star.mutagen) natalMutagens.set(star.name, star.mutagen);
    }
    for (const item of palace.flyingTransformations) {
      if (item.relation === 'self') {
        selfItems.push(`${palace.name}自化${item.mutagen}（${item.star}）`);
        const natalMut = natalMutagens.get(item.star);
        if (natalMut) {
          natalSelfLinks.push(`${palace.name}${item.star}生年化${natalMut}兼自化${item.mutagen}`);
        }
      } else if (item.relation === 'opposite') {
        oppositeItems.push(`${palace.name}化${item.mutagen}${item.star}→对宫${item.targetName}`);
      }
      if (item.mutagen === '禄') {
        const list = luTargets.get(item.targetName) ?? [];
        list.push(`${palace.name}化禄${item.star}`);
        luTargets.set(item.targetName, list);
      } else if (item.mutagen === '忌') {
        const list = jiTargets.get(item.targetName) ?? [];
        list.push(`${palace.name}化忌${item.star}`);
        jiTargets.set(item.targetName, list);
      }
    }
  }

  const multiLu = [...luTargets.entries()]
    .filter(([, sources]) => sources.length >= 2)
    .map(([target, sources]) => `${target}（${sources.join('、')}）`);
  const multiJi = [...jiTargets.entries()]
    .filter(([, sources]) => sources.length >= 2)
    .map(([target, sources]) => `${target}（${sources.join('、')}）`);

  return [
    `离心自化：${selfItems.join('；') || '无'}`,
    `生年四化叠自化：${natalSelfLinks.join('；') || '无'}`,
    `对宫射入（向心/相冲）：${oppositeItems.join('；') || '无'}`,
    `多宫集禄焦点（>=2宫化禄入）：${multiLu.join('；') || '无'}`,
    `多宫集忌焦点（>=2宫化忌入）：${multiJi.join('；') || '无'}`,
  ].join('\n');
}

const KEY_NATAL_TARGETS = new Set(['命宫', '夫妻', '财帛', '官禄', '福德', '田宅']);

/** 提炼运限命宫及三方四正在所选运限内以所在宫干飞化冲照本命核心宫位的重点脉络。 */
export function formatScopeFlyingHighlights(
  palaces: readonly ScopeFlyingPalace[],
  scopeLabel: string,
  palaceNames: readonly string[],
): string {
  const focusPalaces = new Set(['命宫', '财帛', '官禄', '迁移']);
  const hits: string[] = [];
  for (const palace of palaces) {
    const scopePalace = palaceNames[palace.index];
    if (!scopePalace || !focusPalaces.has(scopePalace)) continue;
    for (const item of palace.flyingTransformations) {
      if ((item.mutagen === '禄' || item.mutagen === '忌') && KEY_NATAL_TARGETS.has(item.targetName)) {
        const targetScope = palaceNames[item.targetIndex];
        hits.push(
          `${scopeLabel}${scopePalace}（本命${palace.name}·${palace.heavenlyStem}干）化${item.mutagen}${item.star}→本命${item.targetName}（${scopeLabel}${targetScope}）`,
        );
      }
    }
  }
  return hits.length ? hits.join('；') : '未命中重点宫位禄忌引动';
}

export interface ThreeTierMutagenHit {
  tier: '生年' | '大限' | '流年';
  mutagen: '禄' | '权' | '科' | '忌';
  star: string;
  scopePalace?: string;
}

export interface ThreeTierOverlayItem {
  palaceIndex: number;
  natalPalace: string;
  earthlyBranch: string;
  oppositeNatalPalace: string;
  kind: 'multi-lu' | 'multi-ji' | 'lu-ji-clash' | 'quan-ke-boost';
  label: string;
  hits: ThreeTierMutagenHit[];
  detail: string;
}

/**
 * A2 · 紫微斗数「三代四化叠宫引擎」（本命生年 × 大限 × 流年）：
 * 按 12 物理宫聚合三层四化，精准检出双禄/三禄聚焦、双忌/叠忌冲对宫、禄忌交战与权科加持。
 */
export function buildThreeTierMutagenOverlay(
  palaces: readonly (NatalPalace & {
    majorStars: readonly { name: string; mutagen?: string }[];
    minorStars: readonly { name: string; mutagen?: string }[];
  })[],
  decadalPlacements?: ReturnType<typeof locateScopeMutagens>,
  yearlyPlacements?: ReturnType<typeof locateScopeMutagens>,
): ThreeTierOverlayItem[] {
  if (palaces.length !== 12) return [];
  const buckets = new Map<number, ThreeTierMutagenHit[]>();
  const addHit = (idx: number, hit: ThreeTierMutagenHit) => {
    const arr = buckets.get(idx) ?? [];
    arr.push(hit);
    buckets.set(idx, arr);
  };

  for (const p of palaces) {
    for (const s of [...p.majorStars, ...p.minorStars]) {
      if (s.mutagen === '禄' || s.mutagen === '权' || s.mutagen === '科' || s.mutagen === '忌') {
        addHit(p.index, { tier: '生年', mutagen: s.mutagen, star: s.name });
      }
    }
  }
  for (const item of decadalPlacements ?? []) {
    addHit(item.targetIndex, {
      tier: '大限',
      mutagen: item.mutagen,
      star: item.star,
      scopePalace: item.scopePalace,
    });
  }
  for (const item of yearlyPlacements ?? []) {
    addHit(item.targetIndex, {
      tier: '流年',
      mutagen: item.mutagen,
      star: item.star,
      scopePalace: item.scopePalace,
    });
  }

  const results: ThreeTierOverlayItem[] = [];
  const fmtHit = (h: ThreeTierMutagenHit) =>
    `${h.tier}化${h.mutagen}${h.star}${h.scopePalace ? `(${h.tier}${h.scopePalace})` : ''}`;

  for (const p of palaces) {
    const hits = buckets.get(p.index) ?? [];
    if (hits.length < 2) continue;
    const distinctTiers = new Set(hits.map((h) => h.tier));
    if (distinctTiers.size < 2) continue;
    const opp = palaces[(p.index + 6) % 12]!;
    const luHits = hits.filter((h) => h.mutagen === '禄');
    const jiHits = hits.filter((h) => h.mutagen === '忌');
    const qkHits = hits.filter((h) => h.mutagen === '权' || h.mutagen === '科');

    if (jiHits.length >= 2) {
      results.push({
        palaceIndex: p.index,
        natalPalace: p.name,
        earthlyBranch: p.earthlyBranch,
        oppositeNatalPalace: opp.name,
        kind: 'multi-ji',
        label: jiHits.length >= 3 ? '三忌叠冲' : '双忌叠冲',
        hits: jiHits,
        detail: `本命${p.name}（${p.earthlyBranch}）叠见${jiHits.map(fmtHit).join('＋')}，直冲对宫本命${opp.name}`,
      });
    }
    if (luHits.length >= 2) {
      results.push({
        palaceIndex: p.index,
        natalPalace: p.name,
        earthlyBranch: p.earthlyBranch,
        oppositeNatalPalace: opp.name,
        kind: 'multi-lu',
        label: luHits.length >= 3 ? '三禄聚焦' : '双禄叠加',
        hits: luHits,
        detail: `本命${p.name}（${p.earthlyBranch}）叠见${luHits.map(fmtHit).join('＋')}，照耀对宫本命${opp.name}`,
      });
    }
    if (luHits.length >= 1 && jiHits.length >= 1) {
      const both = [...luHits, ...jiHits];
      results.push({
        palaceIndex: p.index,
        natalPalace: p.name,
        earthlyBranch: p.earthlyBranch,
        oppositeNatalPalace: opp.name,
        kind: 'lu-ji-clash',
        label: '禄忌交战',
        hits: both,
        detail: `本命${p.name}（${p.earthlyBranch}）同宫见${both.map(fmtHit).join('＋')}（先得后耗/得失并存，波及对宫${opp.name}）`,
      });
    }
    if (qkHits.length >= 2 && new Set(qkHits.map((h) => h.tier)).size >= 2) {
      results.push({
        palaceIndex: p.index,
        natalPalace: p.name,
        earthlyBranch: p.earthlyBranch,
        oppositeNatalPalace: opp.name,
        kind: 'quan-ke-boost',
        label: '权科叠加',
        hits: qkHits,
        detail: `本命${p.name}（${p.earthlyBranch}）叠见${qkHits.map(fmtHit).join('＋')}（职权/声望/执行力加持）`,
      });
    }
  }

  return results;
}

export function formatThreeTierMutagenOverlay(items: readonly ThreeTierOverlayItem[]): string {
  if (!items.length) return '';
  return items.map((item) => `- 【${item.label}】${item.detail}`).join('\n');
}

const CORE_ZIWEI_PALACES = new Set(['命宫', '财帛', '官禄', '夫妻', '福德', '迁移', '田宅']);

/**
 * 紫微斗数确定性结构核验：空宫借星衰减 + 核心宫夹宫（吉夹/凶夹）+ 核心宫自化与向心冲照。
 * 不限流派默认输出，保证下游大模型零幻觉抓住借星、夹忌与自化核心。
 */
export function buildZiweiStructureHighlights(
  palaces: readonly (Omit<NatalPalace, 'majorStars' | 'minorStars'> & {
    isBodyPalace?: boolean;
    majorStars: readonly { name: string; brightness?: string; mutagen?: string }[];
    minorStars: readonly { name: string; brightness?: string; mutagen?: string }[];
    adjectiveStars?: readonly { name: string }[];
    flyingTransformations: readonly { mutagen: string; star: string; targetName: string; relation: string }[];
  })[],
): string {
  if (palaces.length !== 12) return '';
  const allStarNames = (p: (typeof palaces)[number]) =>
    new Set([
      ...p.majorStars.map((s) => s.name),
      ...p.minorStars.map((s) => s.name),
      ...(p.adjectiveStars ?? []).map((s) => s.name),
    ]);
  const hasMutagen = (p: (typeof palaces)[number], mut: string) =>
    [...p.majorStars, ...p.minorStars].some((s) => s.mutagen === mut);

  // 1. 空宫借星（尤其命/身/财/官/夫/福/迁）
  const emptyBorrows: string[] = [];
  for (const p of palaces) {
    if (p.majorStars.length > 0) continue;
    const opp = palaces[(p.index + 6) % 12]!;
    const tag = p.isBodyPalace ? `${p.name}(身)` : p.name;
    const borrowed = opp.majorStars.map((s) => `${s.name}${s.brightness === '不' ? '不得' : (s.brightness ?? '')}${s.mutagen ? `·化${s.mutagen}` : ''}`).join('、') || '无主星';
    const hasLocalSha = ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫'].some((sha) => allStarNames(p).has(sha));
    if (CORE_ZIWEI_PALACES.has(p.name) || p.isBodyPalace) {
      emptyBorrows.push(`${tag}空宫借对宫${opp.name}[${borrowed}]（借星力约七八折${hasLocalSha ? '，本宫见煞防破' : ''}）`);
    }
  }

  // 2. 夹宫核验（针对核心宫与身宫）
  const flankingSpecs: ReadonlyArray<{ a: string; b: string; label: string }> = [
    { a: '擎羊', b: '陀罗', label: '羊陀夹' },
    { a: '火星', b: '铃星', label: '火铃夹' },
    { a: '地空', b: '地劫', label: '空劫夹' },
    { a: '太阳', b: '太阴', label: '日月夹' },
    { a: '文昌', b: '文曲', label: '昌曲夹' },
    { a: '左辅', b: '右弼', label: '左右夹' },
    { a: '天魁', b: '天钺', label: '魁钺夹' },
  ];
  const flankingHits: string[] = [];
  for (const p of palaces) {
    if (!CORE_ZIWEI_PALACES.has(p.name) && !p.isBodyPalace) continue;
    const prev = palaces[(p.index + 11) % 12]!;
    const next = palaces[(p.index + 1) % 12]!;
    const prevSet = allStarNames(prev);
    const nextSet = allStarNames(next);
    const tag = p.isBodyPalace ? `${p.name}(身)` : p.name;
    for (const spec of flankingSpecs) {
      const hit =
        (prevSet.has(spec.a) && nextSet.has(spec.b)) ||
        (prevSet.has(spec.b) && nextSet.has(spec.a));
      if (!hit) continue;
      if (spec.label === '羊陀夹' && hasMutagen(p, '忌')) {
        flankingHits.push(`羊陀夹忌（${tag}坐生年化忌受邻宫羊陀夹制）`);
      } else {
        flankingHits.push(`${spec.label}${tag}`);
      }
    }
    const prevHasLuQuanKe = hasMutagen(prev, '禄') || hasMutagen(prev, '权') || hasMutagen(prev, '科');
    const nextHasLuQuanKe = hasMutagen(next, '禄') || hasMutagen(next, '权') || hasMutagen(next, '科');
    if (prevHasLuQuanKe && nextHasLuQuanKe) {
      flankingHits.push(`科权禄夹${tag}`);
    }
  }

  // 3. 核心宫离心自化与对宫冲忌/照禄精要
  const selfMutagens: string[] = [];
  const oppMutagens: string[] = [];
  for (const p of palaces) {
    if (!CORE_ZIWEI_PALACES.has(p.name) && !p.isBodyPalace) continue;
    for (const ft of p.flyingTransformations) {
      if (ft.relation === 'self' && (ft.mutagen === '禄' || ft.mutagen === '忌')) {
        selfMutagens.push(`${p.name}自化${ft.mutagen}(${ft.star})`);
      } else if (ft.relation === 'opposite' && (ft.mutagen === '禄' || ft.mutagen === '忌')) {
        oppMutagens.push(`${p.name}化${ft.mutagen}${ft.star}→对宫${ft.targetName}`);
      }
    }
  }

  const lines: string[] = [];
  if (emptyBorrows.length) lines.push(`- 空宫借星：${emptyBorrows.join('；')}。`);
  if (flankingHits.length) lines.push(`- 夹宫格局：${flankingHits.join('、')}。`);
  if (selfMutagens.length || oppMutagens.length) {
    const parts = [
      selfMutagens.length ? `核心离心自化：${selfMutagens.join('、')}` : '',
      oppMutagens.length ? `对宫射入：${oppMutagens.slice(0, 4).join('、')}` : '',
    ].filter(Boolean);
    lines.push(`- 核心飞化闭环：${parts.join('；')}。`);
  }
  return lines.join('\n');
}
