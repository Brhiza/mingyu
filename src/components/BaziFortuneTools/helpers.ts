import type { BaziFortuneScope } from '@/lib/query-state';
export {
  buildCurrentBaziFortuneSelection,
  buildRecentBaziFortuneSelection,
  getCurrentBaziLuckCycle as getCurrentLuckCycle,
} from 'mingyu-core/bazi';

export const baziFortuneScopeLabelMap: Record<BaziFortuneScope, string> = {
  natal: '本命',
  full: '完整输出',
  dayun: '大运',
  year: '流年',
  month: '流月',
  day: '流日',
};

const baziTenGodAbbreviationMap: Record<string, string> = {
  比肩: '比',
  劫财: '劫',
  食神: '食',
  伤官: '伤',
  正财: '财',
  偏财: '才',
  正官: '官',
  七杀: '杀',
  正印: '印',
  偏印: '枭',
};

export function formatBaziTenGodAbbreviation(value: string) {
  return baziTenGodAbbreviationMap[value] ?? value;
}

export function splitGanZhi(value: string) {
  return [value.charAt(0), value.charAt(1)];
}

export function formatBaziCycleDisplay(ganZhi: string, isXiaoyun: boolean) {
  if (isXiaoyun || ganZhi === '小运') {
    return '童运';
  }

  return `${ganZhi}运`;
}

export function getWuxingClass(character: string) {
  const wuxingMap: Record<string, string> = {
    甲: 'wuxing-mu',
    乙: 'wuxing-mu',
    寅: 'wuxing-mu',
    卯: 'wuxing-mu',
    木: 'wuxing-mu',
    丙: 'wuxing-huo',
    丁: 'wuxing-huo',
    巳: 'wuxing-huo',
    午: 'wuxing-huo',
    火: 'wuxing-huo',
    戊: 'wuxing-tu',
    己: 'wuxing-tu',
    辰: 'wuxing-tu',
    戌: 'wuxing-tu',
    丑: 'wuxing-tu',
    未: 'wuxing-tu',
    土: 'wuxing-tu',
    庚: 'wuxing-jin',
    辛: 'wuxing-jin',
    申: 'wuxing-jin',
    酉: 'wuxing-jin',
    金: 'wuxing-jin',
    壬: 'wuxing-shui',
    癸: 'wuxing-shui',
    子: 'wuxing-shui',
    亥: 'wuxing-shui',
    水: 'wuxing-shui',
  };

  return wuxingMap[character] || '';
}
