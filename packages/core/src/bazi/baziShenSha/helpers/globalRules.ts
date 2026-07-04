import type { BaziArray } from './types';

export function analyzeGlobalShenSha(shenShaList: string[]): string[] {
  const analysis: string[] = [];

  if (shenShaList.includes('三奇贵人')) {
    analysis.push('整局天干顺布三奇，传统多视为悟性、机缘与贵人助力较易形成合力。');
  }

  return analysis;
}

export function calculateGlobalShenSha(baziArray: BaziArray): string[] {
  const globalShenSha: string[] = [];
  const gans = baziArray.map(([gan]) => gan);
  const zhis = baziArray.map(([, zhi]) => zhi);
  const allCharacters = [...gans, ...zhis];
  const countCharacters = (targets: string[]) =>
    allCharacters.filter((character) => targets.includes(character)).length;
  const sequences: string[][] = [
    ['甲', '戊', '庚'],
    ['乙', '丙', '丁'],
    ['辛', '壬', '癸'],
  ];
  const hasOrderedStems = (sequence: string[]) => {
    let index = 0;
    for (const gan of gans) {
      if (gan === sequence[index]) {
        index += 1;
      }
      if (index === sequence.length) {
        return true;
      }
    }
    return false;
  };
  for (const seq of sequences) {
    if (hasOrderedStems(seq)) {
      globalShenSha.push('三奇贵人');
      break;
    }
  }

  if (
    ['寅', '午', '戌'].every((zhi) => zhis.includes(zhi)) &&
    gans.some((gan) => gan === '丙' || gan === '丁') &&
    !gans.some((gan) => gan === '壬' || gan === '癸')
  ) {
    globalShenSha.push('天火煞');
  }

  if (['巳', '酉', '丑', '申'].every((zhi) => zhis.includes(zhi))) {
    globalShenSha.push('挂剑煞');
  }

  if (countCharacters(['甲', '丙', '丁', '壬', '辰']) >= 3) {
    globalShenSha.push('平头杀');
  }

  if (countCharacters(['甲', '辛', '卯', '午', '申']) >= 3) {
    globalShenSha.push('悬针杀');
  }

  if (countCharacters(['甲', '癸', '未', '申', '酉']) >= 3) {
    globalShenSha.push('破字');
  }

  if (countCharacters(['戊', '庚', '戌']) >= 3) {
    globalShenSha.push('杖刑');
  }

  if (countCharacters(['乙', '己', '丑', '巳']) >= 3) {
    globalShenSha.push('阙字');
  }

  if (['乙', '己', '巳'].every((character) => allCharacters.includes(character))) {
    globalShenSha.push('曲脚杀');
  }

  if (countCharacters(['丙', '壬', '寅', '酉']) >= 3) {
    globalShenSha.push('聋哑字');
  }

  return globalShenSha;
}
