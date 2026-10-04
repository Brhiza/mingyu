import type { PalaceFact, PatternFact } from '../../types/analysis';

/** 判断命中条件是否只是在复述已展示宫位中的同宫星曜。 */
export function isRepeatedZiweiCoLocationCondition(
  pattern: Pick<PatternFact, 'palace_indexes' | 'palace_names' | 'star_names'>,
  condition: string,
  displayedPalaces: readonly PalaceFact[],
) {
  const match = /^(.+?)(?:同守|同坐|同宫)(.+宫)?$/u.exec(condition);
  if (!match) return false;

  const starText = match[1];
  const conditionStars = [...new Set(pattern.star_names)]
    .filter((name) => starText.includes(name))
    .sort((left, right) => starText.indexOf(left) - starText.indexOf(right));
  if (
    conditionStars.length < 2 ||
    starText.replace(/[、，,与和及\s]/gu, '') !== conditionStars.join('')
  ) {
    return false;
  }

  const branchPalaceMatch = match[2]
    ? new RegExp(`^([${EARTHLY_BRANCHES}])宫(.+宫)$`, 'u').exec(match[2])
    : null;
  const requiredBranch = branchPalaceMatch?.[1];
  const palaceName = (branchPalaceMatch?.[2] ?? match[2])?.replace(/宫$/u, '');
  if (!palaceName && (pattern.palace_indexes.length !== 1 || pattern.palace_names.length !== 1)) {
    return false;
  }

  const targetPalaceName = palaceName ?? pattern.palace_names[0];
  if (!targetPalaceName) return false;
  const targetPalace = getPatternPalace(pattern, targetPalaceName, displayedPalaces);
  if (!targetPalace || (requiredBranch && targetPalace.earthly_branch !== requiredBranch)) {
    return false;
  }

  const palaceStars = new Set(
    [...targetPalace.major_stars, ...targetPalace.minor_stars, ...targetPalace.other_stars].map(
      (star) => star.name,
    ),
  );
  return conditionStars.every((name) => palaceStars.has(name));
}

const EARTHLY_BRANCHES = '子丑寅卯辰巳午未申酉戌亥';

function normalizePalaceName(name: string) {
  return name.replace(/宫$/u, '');
}

function getPatternPalace(
  pattern: Pick<PatternFact, 'palace_indexes' | 'palace_names'>,
  palaceName: string,
  displayedPalaces: readonly PalaceFact[],
) {
  const normalizedName = normalizePalaceName(palaceName);
  const matchingIndexes = pattern.palace_names.flatMap((name, index) =>
    normalizePalaceName(name) === normalizedName ||
    (normalizedName === '身' &&
      displayedPalaces.some(
        (palace) =>
          palace.index === pattern.palace_indexes[index] &&
          normalizePalaceName(palace.name) === normalizePalaceName(name) &&
          palace.is_body_palace,
      ))
      ? [pattern.palace_indexes[index]]
      : [],
  );
  if (matchingIndexes.length !== 1 || matchingIndexes[0] === undefined) return undefined;
  const patternPalaceName =
    pattern.palace_names[pattern.palace_indexes.indexOf(matchingIndexes[0])];
  if (!patternPalaceName) return undefined;

  return displayedPalaces.find(
    (palace) =>
      palace.index === matchingIndexes[0] &&
      (normalizedName === '身'
        ? palace.is_body_palace &&
          normalizePalaceName(palace.name) === normalizePalaceName(patternPalaceName)
        : normalizePalaceName(palace.name) === normalizedName),
  );
}

function getConditionStars(starText: string, patternStars: readonly string[]) {
  const stars = patternStars
    .filter((name) => starText.includes(name))
    .sort((left, right) => starText.indexOf(left) - starText.indexOf(right));
  if (!stars.length) return undefined;

  const remainder = [...stars]
    .sort((left, right) => right.length - left.length)
    .reduce((text, name) => text.replace(name, ''), starText)
    .replace(/[、，,与和及\s]/gu, '');
  return remainder ? undefined : stars;
}

function isRepeatedSinglePalacePositionCondition(
  pattern: Pick<PatternFact, 'palace_indexes' | 'palace_names' | 'star_names'>,
  condition: string,
  displayedPalaces: readonly PalaceFact[],
) {
  for (const palaceName of pattern.palace_names) {
    const normalizedName = normalizePalaceName(palaceName);
    const suffix = [
      `守${normalizedName}宫`,
      `守${normalizedName}`,
      `坐${normalizedName}宫`,
      `坐${normalizedName}`,
    ]
      .sort((left, right) => right.length - left.length)
      .find((value) => condition.endsWith(value));
    if (!suffix) continue;

    const palace = getPatternPalace(pattern, palaceName, displayedPalaces);
    if (!palace) continue;

    let prefix = condition.slice(0, -suffix.length);
    let requiredBranch: string | undefined;
    const branchMatch = new RegExp(`在([${EARTHLY_BRANCHES}])宫`, 'u').exec(prefix);
    if (branchMatch) {
      requiredBranch = branchMatch[1];
      prefix = prefix.replace(branchMatch[0], '');
    }
    if (requiredBranch && palace.earthly_branch !== requiredBranch) continue;

    let requiredBrightness: string | undefined;
    const brightnessMatch = /以[“「"]?([^”」"]+)[”」"]?亮度/u.exec(prefix);
    if (brightnessMatch) {
      requiredBrightness = brightnessMatch[1];
      prefix = prefix.replace(brightnessMatch[0], '');
    }

    const conditionStars = getConditionStars(prefix, pattern.star_names);
    if (!conditionStars) continue;

    const palaceStars = [...palace.major_stars, ...palace.minor_stars, ...palace.other_stars];
    if (
      conditionStars.every((name) => {
        const star = palaceStars.find((item) => item.name === name);
        return Boolean(star) && (!requiredBrightness || star?.brightness === requiredBrightness);
      })
    ) {
      return true;
    }
  }

  return false;
}

function isRepeatedNamedStarBrightnessCondition(
  pattern: Pick<PatternFact, 'palace_indexes' | 'palace_names' | 'star_names'>,
  condition: string,
  displayedPalaces: readonly PalaceFact[],
) {
  const match = /^(.+?)亮度均为庙或旺$/u.exec(condition);
  if (!match) return false;
  const conditionStars = getConditionStars(match[1], pattern.star_names);
  if (!conditionStars || new Set(conditionStars).size < 2) return false;

  const palaceStars = pattern.palace_names.flatMap((name) => {
    const palace = getPatternPalace(pattern, name, displayedPalaces);
    return palace ? [...palace.major_stars, ...palace.minor_stars, ...palace.other_stars] : [];
  });
  return conditionStars.every((name) =>
    palaceStars.some(
      (star) => star.name === name && (star.brightness === '庙' || star.brightness === '旺'),
    ),
  );
}

function isRepeatedSingleMajorStarCondition(
  pattern: Pick<PatternFact, 'palace_indexes' | 'palace_names' | 'star_names'>,
  condition: string,
  displayedPalaces: readonly PalaceFact[],
) {
  const match = new RegExp(`^(.+?)单守([${EARTHLY_BRANCHES}])宫(.+宫)$`, 'u').exec(condition);
  if (!match) return false;
  const stars = getConditionStars(match[1], pattern.star_names);
  if (stars?.length !== 1) return false;
  const palace = getPatternPalace(pattern, match[3], displayedPalaces);
  return Boolean(
    palace &&
    palace.earthly_branch === match[2] &&
    palace.major_stars.length === 1 &&
    palace.major_stars[0].name === stars[0],
  );
}

function isRepeatedSamePalacePresenceCondition(
  pattern: Pick<PatternFact, 'palace_indexes' | 'palace_names' | 'star_names'>,
  condition: string,
  displayedPalaces: readonly PalaceFact[],
) {
  const match = /^(.+?)守(.+?)并同见(.+)$/u.exec(condition);
  if (!match) return false;
  const guardingStars = getConditionStars(match[1], pattern.star_names);
  const accompanyingStars = getConditionStars(match[3], pattern.star_names);
  if (!guardingStars || !accompanyingStars) return false;
  const palace = getPatternPalace(pattern, match[2], displayedPalaces);
  if (!palace) return false;
  const stars = [...palace.major_stars, ...palace.minor_stars, ...palace.other_stars];
  return [...guardingStars, ...accompanyingStars].every((name) =>
    stars.some((star) => star.name === name),
  );
}

function isRepeatedPalaceStarPresenceCondition(
  pattern: Pick<PatternFact, 'palace_indexes' | 'palace_names' | 'star_names'>,
  condition: string,
  displayedPalaces: readonly PalaceFact[],
) {
  const match = /^(.+宫)见(.+)$/u.exec(condition);
  if (!match) return false;
  const conditionStars = getConditionStars(match[2], pattern.star_names);
  const palace = getPatternPalace(pattern, match[1], displayedPalaces);
  if (!conditionStars || !palace) return false;
  const stars = [...palace.major_stars, ...palace.minor_stars, ...palace.other_stars];
  return conditionStars.every((name) => stars.some((star) => star.name === name));
}

function isRepeatedNatalMutagenCoLocationCondition(
  pattern: Pick<PatternFact, 'palace_indexes' | 'palace_names' | 'star_names'>,
  condition: string,
  displayedPalaces: readonly PalaceFact[],
) {
  const match = /^(.+?)(?:同守|同坐)(.+宫)$/u.exec(condition);
  if (!match) return false;
  const members = match[1].split(/[、，,与和及\s]+/u);
  if (members.length < 2 || !members.some((member) => /^生年化[禄权科忌]$/u.test(member))) {
    return false;
  }
  const palace = getPatternPalace(pattern, match[2], displayedPalaces);
  if (!palace) return false;
  const stars = [...palace.major_stars, ...palace.minor_stars, ...palace.other_stars];
  return members.every((member) => {
    const natalMutagen = /^生年化([禄权科忌])$/u.exec(member)?.[1];
    return natalMutagen
      ? stars.some(
          (star) =>
            star.birth_mutagen === natalMutagen &&
            pattern.star_names.includes(`${star.name}化${natalMutagen}`),
        )
      : pattern.star_names.includes(member) && stars.some((star) => star.name === member);
  });
}

function isRepeatedPalaceBranchCondition(
  pattern: Pick<PatternFact, 'palace_indexes' | 'palace_names'>,
  condition: string,
  displayedPalaces: readonly PalaceFact[],
) {
  const match = new RegExp(`^(.+宫)在([${EARTHLY_BRANCHES}])宫$`, 'u').exec(condition);
  if (!match) return false;
  const palace = getPatternPalace(pattern, match[1], displayedPalaces);
  return palace?.earthly_branch === match[2];
}

/** 判断格局条件是否已由当前展示宫位中的星曜位置和明确属性完整表达。 */
export function isZiweiConditionRestatedByPalaces(
  pattern: Pick<PatternFact, 'palace_indexes' | 'palace_names' | 'star_names'>,
  condition: string,
  displayedPalaces: readonly PalaceFact[],
) {
  return (
    isRepeatedPalaceBranchCondition(pattern, condition, displayedPalaces) ||
    isRepeatedZiweiCoLocationCondition(pattern, condition, displayedPalaces) ||
    isRepeatedSinglePalacePositionCondition(pattern, condition, displayedPalaces) ||
    isRepeatedNamedStarBrightnessCondition(pattern, condition, displayedPalaces) ||
    isRepeatedSingleMajorStarCondition(pattern, condition, displayedPalaces) ||
    isRepeatedSamePalacePresenceCondition(pattern, condition, displayedPalaces) ||
    isRepeatedPalaceStarPresenceCondition(pattern, condition, displayedPalaces) ||
    isRepeatedNatalMutagenCoLocationCondition(pattern, condition, displayedPalaces)
  );
}
