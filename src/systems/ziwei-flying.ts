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
