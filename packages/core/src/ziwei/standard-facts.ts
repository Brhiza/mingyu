import type { EvidenceFact, MutagenName, PalaceFact, ScopeType } from '../types/analysis';

type StandardFactText = Pick<EvidenceFact, 'title' | 'description'>;

function palaceName(name: string): string {
  return name.endsWith('宫') ? name : `${name}宫`;
}

// 紫微标准事实的生产与覆盖核验共用此处；扩展正文仍须完整保留。
export const ziweiStandardFactText = {
  majorStars(palace: PalaceFact): StandardFactText {
    const names = palace.major_stars.map((star) => star.name).join('、');
    return {
      title: `${palace.name}主星为${names}`,
      description: `${palace.name}登记主星${names}。`,
    };
  },
  empty(palace: PalaceFact): StandardFactText {
    return {
      title: `${palace.name}为空宫`,
      description: `${palace.name}的主星列表为空；对宫及三方四正索引另行保留，供传统空宫合参。`,
    };
  },
  birthMutagen(name: string, star: string, mutagen: MutagenName): StandardFactText {
    return {
      title: `${name}见生年化${mutagen}`,
      description: `${star}在${name}带有生年化${mutagen}。`,
    };
  },
  scopeMutagen(
    name: string,
    star: string,
    mutagen: MutagenName,
    scopeLabel: string,
  ): StandardFactText {
    return {
      title: `${name}见${scopeLabel}化${mutagen}`,
      description: `${star}在当前运限下带有化${mutagen}。`,
    };
  },
  surroundedMutagen(name: string, mutagen: MutagenName): StandardFactText {
    return {
      title: `${name}三方四正见化${mutagen}`,
      description: `${name}及其三方四正宫位中可见化${mutagen}信息。`,
    };
  },
  selfMutagen(name: string, mutagen: MutagenName): StandardFactText {
    return {
      title: `${name}出现自化${mutagen}`,
      description: `${name}的自化列表包含化${mutagen}。`,
    };
  },
  flyingMutagen(
    palace: PalaceFact,
    target: NonNullable<PalaceFact['mutaged_palaces']>[number],
  ): StandardFactText {
    return {
      title: `${palace.name}化${target.mutagen}入${target.palace_name}`,
      description:
        target.palace_index === palace.index
          ? `${palace.name}化${target.mutagen}回入本宫。`
          : `${palace.name}化${target.mutagen}落${target.palace_name}宫。`,
    };
  },
  scopeHit(palace: PalaceFact, hit: string): StandardFactText {
    return {
      title: `${hit}位于${palace.name}`,
      description: `本命${palaceName(palace.name)}的宫干支为${palace.heavenly_stem}${palace.earthly_branch}。`,
    };
  },
  dynamicName(palace: PalaceFact, scopeLabel: string): StandardFactText {
    return {
      title: `${scopeLabel}视角下${palace.name}转为${palace.dynamic_scope_name}`,
      description: `在${scopeLabel}视角下，${palace.name}对应的动态宫名为${palace.dynamic_scope_name}。`,
    };
  },
};

export interface ZiweiScopeMutagenContext {
  scope: ScopeType;
  scopeLabel: string;
  star: string;
  mutagen: MutagenName;
  landing: Pick<PalaceFact, 'index' | 'name'>;
  target?: Pick<PalaceFact, 'index' | 'name'>;
  dynamicPalaceName?: string;
}

export function buildZiweiScopeMutagenFactText(
  context: ZiweiScopeMutagenContext,
): StandardFactText {
  const { scopeLabel, star, mutagen, target, landing, dynamicPalaceName } = context;
  return {
    title: target
      ? `${scopeLabel}${star}化${mutagen}入本命${palaceName(target.name)}${dynamicPalaceName ? `（当前${scopeLabel}${palaceName(dynamicPalaceName)}）` : ''}`
      : `${scopeLabel}${star}化${mutagen}`,
    description: target
      ? `${scopeLabel}四化序列中的${star}对应化${mutagen}；该星的本命物理落宫为${palaceName(target.name)}${dynamicPalaceName ? `，当前对应${scopeLabel}${palaceName(dynamicPalaceName)}` : ''}，运限命宫落于本命${palaceName(landing.name)}。`
      : `${scopeLabel}四化序列中的${star}对应化${mutagen}，但该星未能通过本命星曜对象定位宫位。`,
  };
}

export function isStandardZiweiFactText(
  fact: Pick<EvidenceFact, 'title' | 'description' | 'promptText'>,
  expected: StandardFactText,
): boolean {
  return (
    fact.title === expected.title &&
    fact.description === expected.description &&
    (!fact.promptText || fact.promptText === `${expected.title}：${expected.description}`)
  );
}

export function isStandardZiweiScopeMutagenFact(
  fact: EvidenceFact,
  context: ZiweiScopeMutagenContext,
  options: { requirePromptText?: boolean } = {},
): boolean {
  return (
    (!options.requirePromptText || Boolean(fact.promptText)) &&
    Boolean(context.target) &&
    fact.type === 'scope_mutagen_destination' &&
    fact.scope === context.scope &&
    fact.star_names.length === 1 &&
    fact.star_names[0] === context.star &&
    fact.mutagens.length === 1 &&
    fact.mutagens[0] === context.mutagen &&
    fact.palace_indexes.includes(context.landing.index) &&
    fact.palace_indexes.includes(context.target!.index) &&
    isStandardZiweiFactText(fact, buildZiweiScopeMutagenFactText(context))
  );
}
