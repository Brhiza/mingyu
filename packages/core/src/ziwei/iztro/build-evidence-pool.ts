import type { IFunctionalAstrolabe } from 'iztro/lib/astro/FunctionalAstrolabe';
import type { IFunctionalHoroscope } from 'iztro/lib/astro/FunctionalHoroscope';
import type { IFunctionalPalace } from 'iztro/lib/astro/FunctionalPalace';
import type { EvidenceFact, MutagenName, PalaceFact, ScopeType } from '../../types/analysis';

type EvidenceDraft = Omit<EvidenceFact, 'id'> & { priority: number };

const MUTAGEN_LIST: MutagenName[] = ['禄', '权', '科', '忌'];

const KEY_PALACE_NAMES = new Set([
  '命宫',
  '财帛',
  '官禄',
  '夫妻',
  '福德',
  '迁移',
  '子女',
  '田宅',
  '疾厄',
  '兄弟',
  '父母',
  '仆役',
]);

function buildStableKey(parts: Array<string | number | undefined>) {
  return parts.filter(Boolean).join(':');
}

function mapScopeLabel(scope: ScopeType): string {
  switch (scope) {
    case 'origin':
      return '本命';
    case 'decadal':
      return '大限';
    case 'yearly':
      return '流年';
    case 'monthly':
      return '流月';
    case 'daily':
      return '流日';
    case 'hourly':
      return '流时';
    case 'age':
      return '小限';
  }
}

function resolveCurrentScopeLabel(horoscope: IFunctionalHoroscope, currentScope: ScopeType) {
  switch (currentScope) {
    case 'decadal':
      return horoscope.decadal.name || '大限';
    case 'yearly':
      return horoscope.yearly.name || '流年';
    case 'monthly':
      return horoscope.monthly.name || '流月';
    case 'daily':
      return horoscope.daily.name || '流日';
    case 'hourly':
      return horoscope.hourly.name || '流时';
    case 'age':
      return horoscope.age?.name || '小限';
    case 'origin':
    default:
      return mapScopeLabel(currentScope);
  }
}

function getPalaceNamesByIndexes(palaces: PalaceFact[], indexes: number[]) {
  return indexes
    .map((index) => palaces.find((item) => item.index === index)?.name)
    .filter(Boolean) as string[];
}

function getAllPalaceStars(palace: PalaceFact) {
  return [
    ...palace.major_stars,
    ...palace.minor_stars,
    ...palace.other_stars,
    ...palace.scope_stars,
  ];
}

function findStarPalace(palaces: PalaceFact[], starName: string) {
  return palaces.find((palace) => getAllPalaceStars(palace).some((star) => star.name === starName));
}

function buildScopeTitle(scope: ScopeType, scopeName?: string) {
  const base = mapScopeLabel(scope);
  return scopeName && scopeName !== base ? `${base}（${scopeName}）` : base;
}

function getScopeItems(horoscope: IFunctionalHoroscope): Array<{
  scope: ScopeType;
  item: IFunctionalHoroscope['decadal'];
}> {
  return [
    { scope: 'decadal', item: horoscope.decadal },
    { scope: 'yearly', item: horoscope.yearly },
    { scope: 'monthly', item: horoscope.monthly },
    { scope: 'daily', item: horoscope.daily },
    { scope: 'hourly', item: horoscope.hourly },
    { scope: 'age', item: horoscope.age },
  ];
}

function collectScopeStructureEvidence(params: {
  horoscope: IFunctionalHoroscope;
  currentScope: ScopeType;
  palaces: PalaceFact[];
}): EvidenceDraft[] {
  const { horoscope, currentScope, palaces } = params;
  const drafts: EvidenceDraft[] = [];
  const landingPriority: Record<ScopeType, number> = {
    origin: 0,
    decadal: 94,
    yearly: 93,
    monthly: 89,
    daily: 88,
    hourly: 76,
    age: 78,
  };

  if (currentScope === 'origin') {
    return drafts;
  }

  getScopeItems(horoscope).forEach(({ scope, item }) => {
    const palace = palaces.find((candidate) => candidate.index === item.index);
    if (!palace) return;

    const scopeLabel = buildScopeTitle(scope, item.name);
    const stemBranch = [item.heavenlyStem, item.earthlyBranch].filter(Boolean).join('');

    drafts.push({
      stable_key: buildStableKey(['scope-landing', scope, item.index, item.name]),
      type: 'scope_landing',
      title: `${scopeLabel}落入${palace.name}`,
      scope,
      palace_indexes: [palace.index],
      palace_names: [palace.name],
      star_names: [],
      mutagens: [],
      description: `${scopeLabel}${stemBranch ? `干支为${stemBranch}，` : ''}当前落在本命${palace.name}，解读时应把该宫作为阶段触发点。`,
      priority: landingPriority[scope],
    });

    item.mutagen?.slice(0, MUTAGEN_LIST.length).forEach((starName, index) => {
      const mutagen = MUTAGEN_LIST[index];
      const targetPalace = findStarPalace(palaces, starName);
      const palaceIndexes = targetPalace
        ? Array.from(new Set([palace.index, targetPalace.index]))
        : [palace.index];
      const palaceNames = targetPalace
        ? Array.from(new Set([palace.name, targetPalace.name]))
        : [palace.name];

      drafts.push({
        stable_key: buildStableKey(['scope-mutagen-destination', scope, starName, mutagen]),
        type: 'scope_mutagen_destination',
        title: targetPalace
          ? `${scopeLabel}${starName}化${mutagen}入${targetPalace.name}`
          : `${scopeLabel}${starName}化${mutagen}`,
        scope,
        palace_indexes: palaceIndexes,
        palace_names: palaceNames,
        star_names: [starName],
        mutagens: [mutagen],
        description: targetPalace
          ? `${scopeLabel}四化中的${starName}化${mutagen}落到本命${targetPalace.name}，需结合${palace.name}的运限落宫一起判断触发路径。`
          : `${scopeLabel}四化中的${starName}化${mutagen}未能在本命宫位索引中定位，解读时只作为运限四化参考。`,
        priority: mutagen === '忌' ? 96 : mutagen === '禄' ? 94 : 91,
      });
    });
  });

  return drafts;
}

function collectPalaceEvidence(params: {
  astrolabe: IFunctionalAstrolabe;
  currentScope: ScopeType;
  currentScopeLabel: string;
  palace: PalaceFact;
  palaces: PalaceFact[];
}): EvidenceDraft[] {
  const { astrolabe, currentScope, currentScopeLabel, palace, palaces } = params;
  const drafts: EvidenceDraft[] = [];
  const palaceObj = astrolabe.palace(palace.name as never) as IFunctionalPalace | undefined;

  if (!palaceObj) return drafts;

  if (palace.major_stars.length > 0) {
    drafts.push({
      stable_key: buildStableKey([
        'major',
        palace.index,
        palace.major_stars.map((s) => s.name).join('|'),
      ]),
      type: 'palace_major_stars',
      title: `${palace.name}主星为${palace.major_stars.map((s) => s.name).join('、')}`,
      scope: 'origin',
      palace_indexes: [palace.index],
      palace_names: [palace.name],
      star_names: palace.major_stars.map((s) => s.name),
      mutagens: [],
      description: `${palace.name}的主星组合会直接影响该宫位主题的解读重点。`,
      priority: palace.name === '命宫' ? 100 : 60,
    });
  }

  if (palace.empty_state) {
    drafts.push({
      stable_key: buildStableKey(['empty', palace.index]),
      type: 'palace_empty',
      title: `${palace.name}为空宫`,
      scope: 'origin',
      palace_indexes: [palace.index],
      palace_names: [palace.name],
      star_names: [],
      mutagens: [],
      description: `${palace.name}没有主星，解读时要结合对宫和三方四正。`,
      priority: 50,
    });
  }

  const birthMutagenStars = [
    ...palace.major_stars,
    ...palace.minor_stars,
    ...palace.other_stars,
  ].filter((star) => !!star.birth_mutagen);

  birthMutagenStars.forEach((star) => {
    drafts.push({
      stable_key: buildStableKey(['birth-mutagen', palace.index, star.name, star.birth_mutagen]),
      type: 'palace_birth_mutagen',
      title: `${palace.name}见生年化${star.birth_mutagen}`,
      scope: 'origin',
      palace_indexes: [palace.index],
      palace_names: [palace.name],
      star_names: [star.name],
      mutagens: [star.birth_mutagen!],
      description: `${star.name}在${palace.name}带有生年化${star.birth_mutagen}。`,
      priority: 80,
    });
  });

  const activeScopeMutagenStars = [
    ...palace.major_stars,
    ...palace.minor_stars,
    ...palace.other_stars,
  ].filter((star) => !!star.active_scope_mutagen);

  activeScopeMutagenStars.forEach((star) => {
    drafts.push({
      stable_key: buildStableKey([
        'scope-mutagen',
        currentScope,
        palace.index,
        star.name,
        star.active_scope_mutagen,
      ]),
      type: 'palace_scope_mutagen',
      title: `${palace.name}见${currentScopeLabel}化${star.active_scope_mutagen}`,
      scope: currentScope,
      palace_indexes: [palace.index],
      palace_names: [palace.name],
      star_names: [star.name],
      mutagens: [star.active_scope_mutagen!],
      description: `${star.name}在当前运限下带有化${star.active_scope_mutagen}。`,
      priority: 85,
    });
  });

  if (currentScope !== 'origin' && palace.scope_hits.length > 0) {
    drafts.push({
      stable_key: buildStableKey(['scope-hit', palace.index, palace.scope_hits.join('|')]),
      type: 'palace_scope_hit',
      title: `${palace.scope_hits.join('、')}位于${palace.name}`,
      scope: currentScope,
      palace_indexes: [palace.index],
      palace_names: [palace.name],
      star_names: [],
      mutagens: [],
      description: `${palace.name}在当前参考时间下被一个或多个运限命中。`,
      priority: 70,
    });
  }

  const surrounded = astrolabe.surroundedPalaces(palace.name as never);

  MUTAGEN_LIST.forEach((mutagen) => {
    if (!surrounded.haveMutagen(mutagen as never)) return;
    const priority = mutagen === '忌' ? 90 : mutagen === '禄' ? 88 : 82;
    drafts.push({
      stable_key: buildStableKey(['surrounded-mutagen', mutagen, palace.index]),
      type: 'surrounded_mutagen',
      title: `${palace.name}三方四正见化${mutagen}`,
      scope: 'origin',
      palace_indexes: palace.surrounded_palace_indexes,
      palace_names: getPalaceNamesByIndexes(palaces, palace.surrounded_palace_indexes),
      star_names: [],
      mutagens: [mutagen],
      description: `${palace.name}及其三方四正宫位中可见化${mutagen}信息。`,
      priority,
    });
  });

  const selfMutagens = palace.self_mutagens ?? [];
  selfMutagens.forEach((mutagen) => {
    drafts.push({
      stable_key: buildStableKey(['self-mutaged', palace.index, mutagen]),
      type: 'palace_self_mutaged',
      title: `${palace.name}出现自化${mutagen}`,
      scope: 'origin',
      palace_indexes: [palace.index],
      palace_names: [palace.name],
      star_names: [],
      mutagens: [mutagen],
      description: `${palace.name}存在自化${mutagen}，会牵动该宫主题与对宫的能量流向。`,
      priority: mutagen === '忌' ? 82 : 75,
    });
  });

  if (KEY_PALACE_NAMES.has(palace.name) && palace.mutaged_palaces) {
    palace.mutaged_palaces.forEach((target) => {
      if (target.palace_index === undefined || !target.palace_name) return;
      const isToSelf = target.palace_index === palace.index;
      drafts.push({
        stable_key: buildStableKey([
          'mutaged-place',
          palace.index,
          target.mutagen,
          target.palace_index,
        ]),
        type: 'palace_mutaged_place',
        title: `${palace.name}化${target.mutagen}入${target.palace_name}`,
        scope: 'origin',
        palace_indexes: [palace.index, target.palace_index],
        palace_names: [palace.name, target.palace_name],
        star_names: [],
        mutagens: [target.mutagen],
        description: isToSelf
          ? `${palace.name}化${target.mutagen}回照自身，主该宫主题被自化${target.mutagen}牵动。`
          : `${palace.name}的化${target.mutagen}飞入${target.palace_name}，主该方向与该宫主题产生连动。`,
        priority: target.mutagen === '忌' ? 86 : target.mutagen === '禄' ? 84 : 78,
      });
    });
  }

  if (currentScope !== 'origin' && palace.dynamic_scope_name) {
    drafts.push({
      stable_key: buildStableKey([
        'dynamic-name',
        currentScope,
        palace.index,
        palace.dynamic_scope_name,
      ]),
      type: 'scope_dynamic_name',
      title: `${currentScopeLabel}视角下${palace.name}转为${palace.dynamic_scope_name}`,
      scope: currentScope,
      palace_indexes: [palace.index],
      palace_names: [palace.name],
      star_names: [],
      mutagens: [],
      description: `在${currentScopeLabel}视角下，${palace.name}对应的动态宫名为${palace.dynamic_scope_name}。`,
      priority: 45,
    });
  }

  return drafts;
}

function finalizeEvidence(drafts: EvidenceDraft[]): EvidenceFact[] {
  const map = new Map<string, EvidenceDraft>();

  drafts.forEach((item) => {
    if (!map.has(item.stable_key)) {
      map.set(item.stable_key, item);
    }
  });

  return Array.from(map.values())
    .sort((a, b) => b.priority - a.priority)
    .map(({ priority: _priority, ...item }, index) => ({
      id: `E${index + 1}`,
      ...item,
    }));
}

export function buildEvidencePool(params: {
  astrolabe: IFunctionalAstrolabe;
  horoscope: IFunctionalHoroscope;
  currentScope: ScopeType;
  palaces: PalaceFact[];
}): EvidenceFact[] {
  const { astrolabe, horoscope, currentScope, palaces } = params;
  const currentScopeLabel = resolveCurrentScopeLabel(horoscope, currentScope);

  const drafts = palaces.flatMap((palace) =>
    collectPalaceEvidence({
      astrolabe,
      currentScope,
      currentScopeLabel,
      palace,
      palaces,
    }),
  );

  return finalizeEvidence([
    ...collectScopeStructureEvidence({
      horoscope,
      currentScope,
      palaces,
    }),
    ...drafts,
  ]);
}
