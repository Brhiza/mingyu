import type { BranchPillarPairRule, HiddenStemBranchPairRule, HiddenStemSource } from './types';

function hasHiddenStemBranchPair(
  pairRule: HiddenStemBranchPairRule,
  hiddenStemSources: HiddenStemSource[] | undefined,
): boolean {
  if (!hiddenStemSources || hiddenStemSources.length === 0) {
    return false;
  }

  return hiddenStemSources.some((source) => {
    if (source.branch !== pairRule.branch) {
      return false;
    }

    if (
      pairRule.pillars &&
      pairRule.pillars.length > 0 &&
      !pairRule.pillars.includes(source.pillar)
    ) {
      return false;
    }

    return source.stems.includes(pairRule.stem);
  });
}

function hasBranchPillarPair(
  pairRule: BranchPillarPairRule,
  hiddenStemSources: HiddenStemSource[] | undefined,
): boolean {
  if (!hiddenStemSources || hiddenStemSources.length === 0) {
    return false;
  }

  return hiddenStemSources.some((source) => {
    if (source.branch !== pairRule.branch) {
      return false;
    }

    if (
      pairRule.pillars &&
      pairRule.pillars.length > 0 &&
      !pairRule.pillars.includes(source.pillar)
    ) {
      return false;
    }

    return true;
  });
}

export function matchRequiredBranchPillarPairs(
  pairRules: BranchPillarPairRule[] | undefined,
  hiddenStemSources: HiddenStemSource[] | undefined,
): boolean {
  if (!pairRules || pairRules.length === 0) {
    return true;
  }

  return pairRules.every((pairRule) => hasBranchPillarPair(pairRule, hiddenStemSources));
}

export function matchOptionalBranchPillarPairs(
  pairRules: BranchPillarPairRule[] | undefined,
  hiddenStemSources: HiddenStemSource[] | undefined,
): boolean {
  if (!pairRules || pairRules.length === 0) {
    return true;
  }

  return pairRules.some((pairRule) => hasBranchPillarPair(pairRule, hiddenStemSources));
}

export function matchForbiddenBranchPillarPairs(
  pairRules: BranchPillarPairRule[] | undefined,
  hiddenStemSources: HiddenStemSource[] | undefined,
): boolean {
  if (!pairRules || pairRules.length === 0) {
    return true;
  }

  if (!hiddenStemSources) {
    return false;
  }

  return pairRules.every((pairRule) => !hasBranchPillarPair(pairRule, hiddenStemSources));
}

export function matchRequiredHiddenStemBranchPairs(
  pairRules: HiddenStemBranchPairRule[] | undefined,
  hiddenStemSources: HiddenStemSource[] | undefined,
): boolean {
  if (!pairRules || pairRules.length === 0) {
    return true;
  }

  return pairRules.every((pairRule) => hasHiddenStemBranchPair(pairRule, hiddenStemSources));
}

export function matchOptionalHiddenStemBranchPairs(
  pairRules: HiddenStemBranchPairRule[] | undefined,
  hiddenStemSources: HiddenStemSource[] | undefined,
): boolean {
  if (!pairRules || pairRules.length === 0) {
    return true;
  }

  return pairRules.some((pairRule) => hasHiddenStemBranchPair(pairRule, hiddenStemSources));
}

export function matchForbiddenHiddenStemBranchPairs(
  pairRules: HiddenStemBranchPairRule[] | undefined,
  hiddenStemSources: HiddenStemSource[] | undefined,
): boolean {
  if (!pairRules || pairRules.length === 0) {
    return true;
  }

  if (!hiddenStemSources) {
    return false;
  }

  return pairRules.every((pairRule) => !hasHiddenStemBranchPair(pairRule, hiddenStemSources));
}
