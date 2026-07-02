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

  return globalShenSha;
}
