import type {
  IztroAstrolabe,
  IztroHoroscope,
  IztroPalace,
  IztroStar,
} from '../../../../types/iztro';
import type {
  ActiveScopeInfo,
  BasicInfo,
  FourPillars,
  HiddenPalaces,
  MutagedPlaceItem,
  MutagenName,
  PalaceFact,
  ScopeType,
} from '../../../../types/analysis';
import { resolveScopeLabel, type HoroscopeScopeItem } from './scope';
import { MUTAGEN_ORDER, mapScopeMutagenMap, mapStarFact } from './mappers';
import { SHICHEN_PERIODS, getTimeIndexFromClock } from '../../../../calendar/dateUtils';
import { getGanZhiFromDate } from '../../../../ganzhi';
import type { ChartInput } from '../../../../types/chart';
import {
  buildBirthMutagensByPalaceIndex,
  collectSelfMutagensFromPlaces,
  collectSurroundedMutagens,
} from './palace-relations';

function buildFourPillars(
  astrolabe: IztroAstrolabe,
  birthTime?: ChartInput['birthTime'],
): FourPillars | undefined {
  const parts = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(astrolabe.solarDate);
  const period = SHICHEN_PERIODS.find((item) => item.name === astrolabe.time);
  if (!parts || !period) return undefined;
  const time = birthTime ?? period;
  if (time.hour > 23 || getTimeIndexFromClock(time.hour, time.minute) !== period.index) {
    throw new Error('紫微四柱展示时分与出生时辰不一致。');
  }
  const second = birthTime?.second ?? 0;
  if (!Number.isInteger(second) || second < 0 || second > 59) {
    throw new Error('紫微四柱展示秒数必须在 0-59 之间。');
  }
  const date = new Date(0);
  date.setFullYear(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  date.setHours(time.hour, time.minute, second, 0);
  const pillars = getGanZhiFromDate(date);
  return {
    year_pillar: pillars.year,
    month_pillar: pillars.month,
    day_pillar: pillars.day,
    hour_pillar: pillars.hour,
  };
}

function buildHiddenPalaces(astrolabe: IztroAstrolabe): HiddenPalaces | undefined {
  const bodyPalace = astrolabe.palace('身宫');
  const originalPalace = astrolabe.palace('来因');

  const result: HiddenPalaces = {
    body_palace_index: bodyPalace?.index,
    body_palace_name: bodyPalace?.name,
    original_palace_index: originalPalace?.index,
    original_palace_name: originalPalace?.name,
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

export function buildBasicInfo(
  astrolabe: IztroAstrolabe,
  birthTime?: ChartInput['birthTime'],
): BasicInfo {
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
    four_pillars: buildFourPillars(astrolabe, birthTime),
    hidden_palaces: buildHiddenPalaces(astrolabe),
  };
}

export function buildActiveScope(params: {
  astrolabe: IztroAstrolabe;
  horoscope: IztroHoroscope;
  currentScope: ScopeType;
  currentScopeItem?: HoroscopeScopeItem;
}): ActiveScopeInfo {
  const { astrolabe, horoscope, currentScope, currentScopeItem } = params;
  const landingPalace =
    currentScope === 'origin'
      ? astrolabe.palace('命宫' as never)
      : currentScope === 'age'
        ? horoscope.agePalace()
        : horoscope.palace('命宫' as never, currentScope);

  return {
    scope: currentScope,
    label: resolveScopeLabel(currentScope, currentScopeItem),
    solar_date: normalizeSolarDateText(horoscope.solarDate),
    lunar_date: horoscope.lunarDate,
    nominal_age: horoscope.age.nominalAge,
    palace_index: landingPalace?.index,
    palace_name: landingPalace?.name,
    heavenly_stem: currentScopeItem?.heavenlyStem,
    earthly_branch: currentScopeItem?.earthlyBranch,
    mutagen_map: mapScopeMutagenMap(
      currentScopeItem?.mutagen ?? [],
      astrolabe,
      currentScopeItem?.palaceNames ?? [],
    ),
  };
}

function buildScopeHitEntries(horoscope: IztroHoroscope): Array<[number | undefined, string]> {
  const decadalLabel = horoscope.decadal.name || '大限';
  return [
    [horoscope.palace('命宫' as never, 'decadal')?.index, `${decadalLabel}落宫`],
    [horoscope.agePalace()?.index, '小限落宫'],
    [horoscope.palace('命宫' as never, 'yearly')?.index, '流年落宫'],
    [horoscope.palace('命宫' as never, 'monthly')?.index, '流月落宫'],
    [horoscope.palace('命宫' as never, 'daily')?.index, '流日落宫'],
    [horoscope.palace('命宫' as never, 'hourly')?.index, '流时落宫'],
  ];
}

function selectScopeHits(entries: Array<[number | undefined, string]>, palaceIndex: number) {
  return entries.filter(([index]) => index === palaceIndex).map(([, label]) => label);
}

function buildScopeHits(horoscope: IztroHoroscope, palaceIndex: number): string[] {
  return selectScopeHits(buildScopeHitEntries(horoscope), palaceIndex);
}

function buildMutagedPlaces(palace: IztroPalace): MutagedPlaceItem[] {
  const targets = palace.mutagedPlaces();

  return targets.map((target, index) => {
    if (!target) {
      return { mutagen: MUTAGEN_ORDER[index] };
    }
    return {
      mutagen: MUTAGEN_ORDER[index],
      palace_index: target.index,
      palace_name: target.name,
    };
  });
}

function buildSelfMutagens(palace: IztroPalace): MutagenName[] {
  return MUTAGEN_ORDER.filter((mutagen) => palace.selfMutaged(mutagen as never));
}

function buildSummaryTags(params: {
  palace: IztroPalace;
  currentScope: ScopeType;
  scopeHits: string[];
  selfMutagens: MutagenName[];
  surroundedMutagens: MutagenName[];
  emptyState: boolean;
  hasBirthMutagen: boolean;
  hasScopeMutagen: boolean;
}): string[] {
  const {
    palace,
    currentScope,
    scopeHits,
    selfMutagens,
    surroundedMutagens,
    emptyState,
    hasBirthMutagen,
    hasScopeMutagen,
  } = params;
  const tags: string[] = [];

  if (palace.name === '命宫') tags.push('命宫');
  if (palace.isBodyPalace) tags.push('身宫');
  if (palace.isOriginalPalace) tags.push('来因宫');
  if (emptyState) tags.push('空宫');

  selfMutagens.forEach((mutagen) => tags.push(`自化${mutagen}`));

  surroundedMutagens.forEach((mutagen) => tags.push(`三方四正见化${mutagen}`));

  tags.push(...scopeHits);

  if (hasBirthMutagen) {
    tags.push('有生年四化');
  }

  if (currentScope !== 'origin' && currentScope !== 'age' && hasScopeMutagen) {
    tags.push('有当前运限四化');
  }

  return tags;
}

/** 直接投影本命宫位事实，不读取或构造任何运限字段。 */
export function buildNatalPalaceFacts(astrolabe: IztroAstrolabe): PalaceFact[] {
  assertValidAstrolabePalaces(astrolabe.palaces);
  const drafts = astrolabe.palaces.map((palace) => {
    const surrounded = astrolabe.surroundedPalaces(palace.index);
    const mutagedPlaces = buildMutagedPlaces(palace);
    const selfMutagens = collectSelfMutagensFromPlaces(palace.index, mutagedPlaces);
    const emptyState = palace.isEmpty();
    const fact: PalaceFact = {
      index: palace.index,
      name: palace.name,
      is_body_palace: palace.isBodyPalace,
      is_original_palace: palace.isOriginalPalace,
      heavenly_stem: palace.heavenlyStem,
      earthly_branch: palace.earthlyBranch,
      major_stars: palace.majorStars.map((star: IztroStar) =>
        mapStarFact(star, [], { isHoroscopeStar: false }),
      ),
      minor_stars: palace.minorStars.map((star: IztroStar) =>
        mapStarFact(star, [], { isHoroscopeStar: false }),
      ),
      other_stars: palace.adjectiveStars.map((star: IztroStar) =>
        mapStarFact(star, [], { isHoroscopeStar: false }),
      ),
      scope_stars: [],
      changsheng12: palace.changsheng12,
      boshi12: palace.boshi12,
      base_jiangqian12: palace.jiangqian12,
      base_suiqian12: palace.suiqian12,
      decadal_range: palace.decadal.range,
      ages: palace.ages,
      scope_hits: [],
      empty_state: emptyState,
      opposite_palace_index: surrounded.opposite.index,
      surrounded_palace_indexes: [
        surrounded.target.index,
        surrounded.opposite.index,
        surrounded.wealth.index,
        surrounded.career.index,
      ],
      summary_tags: [],
      mutaged_palaces: mutagedPlaces,
      self_mutagens: selfMutagens,
    };
    return { palace, fact, selfMutagens };
  });

  const facts = drafts.map((draft) => draft.fact);
  const birthMutagensByPalaceIndex = buildBirthMutagensByPalaceIndex(facts);
  return drafts.map(({ palace, fact, selfMutagens }) => ({
    ...fact,
    summary_tags: buildSummaryTags({
      palace,
      currentScope: 'origin',
      scopeHits: [],
      selfMutagens,
      surroundedMutagens: collectSurroundedMutagens(fact, birthMutagensByPalaceIndex),
      emptyState: fact.empty_state,
      hasBirthMutagen: (birthMutagensByPalaceIndex.get(fact.index)?.size ?? 0) > 0,
      hasScopeMutagen: false,
    }),
  }));
}

export function buildPalaceFacts(params: {
  astrolabe: IztroAstrolabe;
  horoscope: IztroHoroscope;
  currentScope: ScopeType;
  currentScopeItem?: HoroscopeScopeItem;
}): PalaceFact[] {
  const { astrolabe, horoscope, currentScopeItem } = params;
  assertValidAstrolabePalaces(astrolabe.palaces);

  const activeScopeMutagenMap = mapScopeMutagenMap(
    currentScopeItem?.mutagen ?? [],
    astrolabe,
    currentScopeItem?.palaceNames ?? [],
  );
  // 同一运限对象的六个落宫固定，整盘只查询一次，再分配到十二宫。
  const scopeHitEntries = buildScopeHitEntries(horoscope);

  const drafts = astrolabe.palaces.map((palace) => {
    const surrounded = astrolabe.surroundedPalaces(palace.index);
    const scopeStarsRaw = currentScopeItem?.stars?.[palace.index] ?? [];
    const mutagedPlaces = buildMutagedPlaces(palace);
    const selfMutagens = collectSelfMutagensFromPlaces(palace.index, mutagedPlaces);
    const scopeHits = selectScopeHits(scopeHitEntries, palace.index);
    const majorStars = palace.majorStars.map((star: IztroStar) =>
      mapStarFact(star, activeScopeMutagenMap, { isHoroscopeStar: false }),
    );
    const minorStars = palace.minorStars.map((star: IztroStar) =>
      mapStarFact(star, activeScopeMutagenMap, { isHoroscopeStar: false }),
    );
    const otherStars = palace.adjectiveStars.map((star: IztroStar) =>
      mapStarFact(star, activeScopeMutagenMap, { isHoroscopeStar: false }),
    );
    const scopeStars = scopeStarsRaw.map((star: IztroStar) =>
      mapStarFact(star, activeScopeMutagenMap, { isHoroscopeStar: true }),
    );
    const emptyState = palace.isEmpty();

    const fact: PalaceFact = {
      index: palace.index,
      name: palace.name,
      is_body_palace: palace.isBodyPalace,
      is_original_palace: palace.isOriginalPalace,
      heavenly_stem: palace.heavenlyStem,
      earthly_branch: palace.earthlyBranch,
      major_stars: majorStars,
      minor_stars: minorStars,
      other_stars: otherStars,
      scope_stars: scopeStars,
      changsheng12: palace.changsheng12,
      boshi12: palace.boshi12,
      base_jiangqian12: palace.jiangqian12,
      base_suiqian12: palace.suiqian12,
      yearly_jiangqian12: horoscope.yearly.yearlyDecStar.jiangqian12[palace.index],
      yearly_suiqian12: horoscope.yearly.yearlyDecStar.suiqian12[palace.index],
      decadal_range: palace.decadal.range,
      ages: palace.ages,
      dynamic_scope_name: currentScopeItem?.palaceNames?.[palace.index],
      scope_hits: scopeHits,
      empty_state: emptyState,
      opposite_palace_index: surrounded.opposite.index,
      surrounded_palace_indexes: [
        surrounded.target.index,
        surrounded.opposite.index,
        surrounded.wealth.index,
        surrounded.career.index,
      ],
      summary_tags: [],
      mutaged_palaces: mutagedPlaces,
      self_mutagens: selfMutagens,
    };
    return { palace, fact, selfMutagens };
  });

  const facts = drafts.map((draft) => draft.fact);
  const birthMutagensByPalaceIndex = buildBirthMutagensByPalaceIndex(facts);
  return drafts.map(({ palace, fact, selfMutagens }) => ({
    ...fact,
    summary_tags: buildSummaryTags({
      palace,
      currentScope: params.currentScope,
      scopeHits: fact.scope_hits,
      selfMutagens,
      surroundedMutagens: collectSurroundedMutagens(fact, birthMutagensByPalaceIndex),
      emptyState: fact.empty_state,
      hasBirthMutagen: (birthMutagensByPalaceIndex.get(fact.index)?.size ?? 0) > 0,
      hasScopeMutagen: [...fact.major_stars, ...fact.minor_stars].some(
        (star) => star.active_scope_mutagen !== undefined,
      ),
    }),
  }));
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
