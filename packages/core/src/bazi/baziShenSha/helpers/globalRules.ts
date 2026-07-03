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
  const sequences: string[][] = [
    ['甲', '戊', '庚'],
    ['乙', '丙', '丁'],
    ['辛', '壬', '癸'],
  ];
  const checks = [
    [gans[0], gans[1], gans[2]],
    [gans[1], gans[2], gans[3]],
  ];
  for (const seq of sequences) {
    if (checks.some(([a, b, c]) => a === seq[0] && b === seq[1] && c === seq[2])) {
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

  return globalShenSha;
}
