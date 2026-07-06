import type {
  IztroAstrolabe,
  IztroHoroscope,
  IztroPalace,
  IztroStar,
  IztroSurpalaces,
} from '../../../../types/iztro';
import type {
  ActiveScopeInfo,
  BasicInfo,
  FourPillars,
  HiddenPalaces,
  MutagedPlaceItem,
  MutagenName,
  PalaceFact,
  ScopeMutagenItem,
  ScopeType,
} from '../../../../types/analysis';
import { resolveScopeLabel, type HoroscopeScopeItem } from './scope';
import { LIU_HE_BRANCH, findPalaceByBranch, findPalaceByIndex } from './palace-lookup';
import { MUTAGEN_ORDER, mapScopeMutagenMap, mapStarFact } from './mappers';

function buildFourPillars(astrolabe: IztroAstrolabe): FourPillars | undefined {
  const chineseDate = astrolabe.rawDates?.chineseDate;
  if (!chineseDate) return undefined;

  const join = (pair?: readonly [string, string]) => (pair ? `${pair[0]}${pair[1]}` : '');

  const yearly = join(chineseDate.yearly);
  const monthly = join(chineseDate.monthly);
  const daily = join(chineseDate.daily);
  const hourly = join(chineseDate.hourly);

  if (!yearly && !monthly && !daily && !hourly) return undefined;

  return {
    year_pillar: yearly,
    month_pillar: monthly,
    day_pillar: daily,
    hour_pillar: hourly,
  };
}

function buildHiddenPalaces(astrolabe: IztroAstrolabe): HiddenPalaces | undefined {
  const palaces = astrolabe.palaces;
  if (!palaces?.length) return undefined;

  const bodyPalace = palaces.find((palace) => palace.isBodyPalace);
  const originalPalace = palaces.find((palace) => palace.isOriginalPalace);
  const soulPalace = findPalaceByBranch(palaces, astrolabe.earthlyBranchOfSoulPalace);
  const anheBranch = soulPalace ? LIU_HE_BRANCH[soulPalace.earthlyBranch] : undefined;
  const anhePalace = anheBranch ? findPalaceByBranch(palaces, anheBranch) : undefined;

  const result: HiddenPalaces = {
    body_palace_index: bodyPalace?.index,
    body_palace_name: bodyPalace?.name,
    original_palace_index: originalPalace?.index,
    original_palace_name: originalPalace?.name,
    anhe_palace_index: anhePalace?.index,
    anhe_palace_name: anhePalace?.name,
  };

  return result;
}

function normalizeSolarDateText(value: string) {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value.trim());
  if (!match) {
    return value;
  }

  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
}

const ZIWEI_PALACE_COUNT = 12;

function assertValidAstrolabePalaces(
  palaces: IztroPalace[] | undefined,
): asserts palaces is IztroPalace[] {
  if (!Array.isArray(palaces) || palaces.length !== ZIWEI_PALACE_COUNT) {
    throw new Error('紫微排盘必须包含完整 12 个宫位。');
  }

  const seenIndexes = new Set<number>();
  let mingPalaceCount = 0;

  palaces.forEach((palace, position) => {
    if (
      !Number.isInteger(palace?.index) ||
      palace.index < 0 ||
      palace.index >= ZIWEI_PALACE_COUNT
    ) {
      throw new Error(`紫微第 ${position + 1} 个宫位索引无效。`);
    }
    if (seenIndexes.has(palace.index)) {
      throw new Error(`紫微宫位索引 ${palace.index} 重复。`);
    }
    seenIndexes.add(palace.index);

    if (typeof palace.name !== 'string' || !palace.name.trim()) {
      throw new Error(`紫微第 ${position + 1} 个宫位名称缺失。`);
    }
    if (palace.name === '命宫') {
      mingPalaceCount += 1;
    }
    if (typeof palace.heavenlyStem !== 'string' || !palace.heavenlyStem.trim()) {
      throw new Error(`紫微${palace.name}天干缺失。`);
    }
    if (typeof palace.earthlyBranch !== 'string' || !palace.earthlyBranch.trim()) {
      throw new Error(`紫微${palace.name}地支缺失。`);
    }
    if (!Array.isArray(palace.majorStars)) {
      throw new Error(`紫微${palace.name}主星数据无效。`);
    }
    if (!Array.isArray(palace.minorStars)) {
      throw new Error(`紫微${palace.name}辅星数据无效。`);
    }
    if (!Array.isArray(palace.adjectiveStars)) {
      throw new Error(`紫微${palace.name}杂曜数据无效。`);
    }
    if (typeof palace.mutagedPlaces !== 'function') {
      throw new Error(`紫微${palace.name}四化飞宫数据无效。`);
    }
    if (typeof palace.selfMutaged !== 'function') {
      throw new Error(`紫微${palace.name}自化数据无效。`);
    }
  });

  if (mingPalaceCount !== 1) {
    throw new Error('紫微排盘必须且只能包含一个命宫。');
  }
}

export function buildBasicInfo(astrolabe: IztroAstrolabe): BasicInfo {
  assertValidAstrolabePalaces(astrolabe.palaces);

  return {
    gender: astrolabe.gender,
    solar_date: normalizeSolarDateText(astrolabe.solarDate),
    lunar_date: astrolabe.lunarDate,
    chinese_date: astrolabe.chineseDate,
    birth_time_label: astrolabe.time,
    birth_time_range: astrolabe.timeRange,
    zodiac: astrolabe.zodiac,
    sign: astrolabe.sign,
    five_elements_class: astrolabe.fiveElementsClass,
    soul: astrolabe.soul,
    body: astrolabe.body,
    soul_palace_branch: astrolabe.earthlyBranchOfSoulPalace,
    body_palace_branch: astrolabe.earthlyBranchOfBodyPalace,
    four_pillars: buildFourPillars(astrolabe),
    hidden_palaces: buildHiddenPalaces(astrolabe),
  };
}

export function buildActiveScope(params: {
  horoscope: IztroHoroscope;
  currentScope: ScopeType;
  currentScopeItem?: HoroscopeScopeItem;
  palaces: IztroPalace[];
}): ActiveScopeInfo {
  const { horoscope, currentScope, currentScopeItem, palaces } = params;

  return {
    scope: currentScope,
    label: resolveScopeLabel(currentScope, currentScopeItem),
    solar_date: normalizeSolarDateText(horoscope.solarDate),
    lunar_date: horoscope.lunarDate,
    nominal_age: horoscope.age.nominalAge,
    palace_index: currentScopeItem?.index,
    heavenly_stem: currentScopeItem?.heavenlyStem,
    earthly_branch: currentScopeItem?.earthlyBranch,
    mutagen_map: mapScopeMutagenMap(currentScopeItem?.mutagen ?? [], palaces),
  };
}

function buildScopeHits(horoscope: IztroHoroscope, palaceIndex: number): string[] {
  const hits: string[] = [];
  const decadalLabel = horoscope.decadal.name || '大限';

  if (horoscope.decadal.index === palaceIndex) hits.push(`${decadalLabel}落宫`);
  if (horoscope.age.index === palaceIndex) hits.push('小限落宫');
  if (horoscope.yearly.index === palaceIndex) hits.push('流年落宫');
  if (horoscope.monthly.index === palaceIndex) hits.push('流月落宫');
  if (horoscope.daily.index === palaceIndex) hits.push('流日落宫');
  if (horoscope.hourly.index === palaceIndex) hits.push('流时落宫');

  return hits;
}

function buildMutagedPlaces(palace: IztroPalace, allPalaces: IztroPalace[]): MutagedPlaceItem[] {
  const targets = palace.mutagedPlaces();

  return targets.map((target, index) => {
    if (!target) {
      return { mutagen: MUTAGEN_ORDER[index] };
    }
    const resolved = findPalaceByIndex(allPalaces, target.index) ?? target;
    return {
      mutagen: MUTAGEN_ORDER[index],
      palace_index: resolved.index,
      palace_name: resolved.name,
    };
  });
}

function buildSelfMutagens(palace: IztroPalace): MutagenName[] {
  return MUTAGEN_ORDER.filter((mutagen) => palace.selfMutaged(mutagen as never));
}

function buildSummaryTags(params: {
  palace: IztroPalace;
  horoscope: IztroHoroscope;
  activeScopeMutagenMap: ScopeMutagenItem[];
  surrounded: IztroSurpalaces;
  selfMutagens: MutagenName[];
  hiddenPalaces?: HiddenPalaces;
}): string[] {
  const { palace, horoscope, activeScopeMutagenMap, surrounded, selfMutagens, hiddenPalaces } =
    params;
  const tags: string[] = [];
  const decadalLabel = horoscope.decadal.name || '大限';

  if (palace.name === '命宫') tags.push('命宫');
  if (palace.isBodyPalace) tags.push('身宫');
  if (palace.isOriginalPalace) tags.push('来因宫');
  if (hiddenPalaces?.anhe_palace_index === palace.index) tags.push('暗合宫');
  if (palace.isEmpty()) tags.push('空宫');

  selfMutagens.forEach((mutagen) => tags.push(`自化${mutagen}`));

  MUTAGEN_ORDER.forEach((mutagen) => {
    if (surrounded.haveMutagen(mutagen as never)) {
      tags.push(`三方四正见化${mutagen}`);
    }
  });

  if (horoscope.decadal.index === palace.index) tags.push(`${decadalLabel}落宫`);
  if (horoscope.age.index === palace.index) tags.push('小限落宫');
  if (horoscope.yearly.index === palace.index) tags.push('流年落宫');
  if (horoscope.monthly.index === palace.index) tags.push('流月落宫');
  if (horoscope.daily.index === palace.index) tags.push('流日落宫');
  if (horoscope.hourly.index === palace.index) tags.push('流时落宫');

  const allStars: IztroStar[] = [
    ...palace.majorStars,
    ...palace.minorStars,
    ...palace.adjectiveStars,
  ];

  if (allStars.some((star) => !!star.mutagen)) {
    tags.push('有生年四化');
  }

  if (allStars.some((star) => activeScopeMutagenMap.some((item) => item.star === star.name))) {
    tags.push('有当前运限四化');
  }

  return tags;
}

export function buildPalaceFacts(params: {
  astrolabe: IztroAstrolabe;
  horoscope: IztroHoroscope;
  currentScope: ScopeType;
  currentScopeItem?: HoroscopeScopeItem;
  hiddenPalaces?: HiddenPalaces;
}): PalaceFact[] {
  const { astrolabe, horoscope, currentScopeItem, hiddenPalaces } = params;
  assertValidAstrolabePalaces(astrolabe.palaces);

  const activeScopeMutagenMap = mapScopeMutagenMap(
    currentScopeItem?.mutagen ?? [],
    astrolabe.palaces,
  );

  return astrolabe.palaces.map((palace) => {
    const surrounded = astrolabe.surroundedPalaces(palace.name);
    const scopeStarsRaw = currentScopeItem?.stars?.[palace.index] ?? [];
    const mutagedPlaces = buildMutagedPlaces(palace, astrolabe.palaces);
    const selfMutagens = buildSelfMutagens(palace);

    return {
      index: palace.index,
      name: palace.name,
      is_body_palace: palace.isBodyPalace,
      is_original_palace: palace.isOriginalPalace,
      heavenly_stem: palace.heavenlyStem,
      earthly_branch: palace.earthlyBranch,
      major_stars: palace.majorStars.map((star: IztroStar) =>
        mapStarFact(star, activeScopeMutagenMap, { isHoroscopeStar: false }),
      ),
      minor_stars: palace.minorStars.map((star: IztroStar) =>
        mapStarFact(star, activeScopeMutagenMap, { isHoroscopeStar: false }),
      ),
      other_stars: palace.adjectiveStars.map((star: IztroStar) =>
        mapStarFact(star, activeScopeMutagenMap, { isHoroscopeStar: false }),
      ),
      scope_stars: scopeStarsRaw.map((star: IztroStar) =>
        mapStarFact(star, activeScopeMutagenMap, { isHoroscopeStar: true }),
      ),
      changsheng12: palace.changsheng12,
      boshi12: palace.boshi12,
      base_jiangqian12: palace.jiangqian12,
      base_suiqian12: palace.suiqian12,
      yearly_jiangqian12: horoscope.yearly.yearlyDecStar.jiangqian12[palace.index],
      yearly_suiqian12: horoscope.yearly.yearlyDecStar.suiqian12[palace.index],
      decadal_range: palace.decadal.range,
      ages: palace.ages,
      dynamic_scope_name: currentScopeItem?.palaceNames?.[palace.index],
      scope_hits: buildScopeHits(horoscope, palace.index),
      empty_state: palace.isEmpty(),
      opposite_palace_index: surrounded.opposite.index,
      surrounded_palace_indexes: [
        surrounded.target.index,
        surrounded.opposite.index,
        surrounded.wealth.index,
        surrounded.career.index,
      ],
      summary_tags: buildSummaryTags({
        palace,
        horoscope,
        activeScopeMutagenMap,
        surrounded,
        selfMutagens,
        hiddenPalaces,
      }),
      mutaged_palaces: mutagedPlaces,
      self_mutagens: selfMutagens,
    };
  });
}

// 内部 helper 也对外暴露,便于测试或后续复用
export {
  buildFourPillars,
  buildHiddenPalaces,
  buildScopeHits,
  buildMutagedPlaces,
  buildSelfMutagens,
  buildSummaryTags,
  assertValidAstrolabePalaces,
};
