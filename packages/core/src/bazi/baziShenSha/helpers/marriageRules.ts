import type { RuleContext, ShenShaRuleMap } from './types';

export function buildMarriageRules(ctx: RuleContext): ShenShaRuleMap {
  const { zhi, nianZhi, riGan, riZhi, cdz, zhiIdx } = ctx;

  return {
    桃花: () => {
      const map: Record<string, string> = {
        寅: '卯',
        午: '卯',
        戌: '卯',
        亥: '子',
        卯: '子',
        未: '子',
        申: '酉',
        子: '酉',
        辰: '酉',
        巳: '午',
        酉: '午',
        丑: '午',
      };
      return map[nianZhi] === zhi || map[riZhi] === zhi;
    },
    红鸾: () => {
      const map: Record<string, string> = {
        子: '卯',
        丑: '寅',
        寅: '丑',
        卯: '子',
        辰: '亥',
        巳: '戌',
        午: '酉',
        未: '申',
        申: '未',
        酉: '午',
        戌: '巳',
        亥: '辰',
      };
      return map[nianZhi] === zhi || map[riZhi] === zhi;
    },
    天喜: () => {
      const map: Record<string, string> = {
        子: '酉',
        丑: '申',
        寅: '未',
        卯: '午',
        辰: '巳',
        巳: '辰',
        午: '卯',
        未: '寅',
        申: '丑',
        酉: '子',
        戌: '亥',
        亥: '戌',
      };
      return map[nianZhi] === zhi || map[riZhi] === zhi;
    },
    孤辰: () => {
      const map: Record<string, string> = {
        亥: '寅',
        子: '寅',
        丑: '寅',
        寅: '巳',
        卯: '巳',
        辰: '巳',
        巳: '申',
        午: '申',
        未: '申',
        申: '亥',
        酉: '亥',
        戌: '亥',
      };
      return map[nianZhi] === zhi;
    },
    寡宿: () => {
      const map: Record<string, string> = {
        亥: '戌',
        子: '戌',
        丑: '戌',
        寅: '丑',
        卯: '丑',
        辰: '丑',
        巳: '辰',
        午: '辰',
        未: '辰',
        申: '未',
        酉: '未',
        戌: '未',
      };
      return map[nianZhi] === zhi;
    },
    红艳煞: () => {
      const map: Record<string, string> = {
        甲: '午',
        乙: '午',
        丙: '寅',
        丁: '未',
        戊: '子',
        己: '辰',
        庚: '戌',
        辛: '酉',
        壬: '巳',
        癸: '申',
      };
      return map[riGan] === zhi;
    },
    勾绞煞: () => {
      const gouIdx = (zhiIdx(nianZhi) + 3) % 12;
      const jiaoIdx = (zhiIdx(nianZhi) - 3 + 12) % 12;
      return zhi === cdz[gouIdx] || zhi === cdz[jiaoIdx];
    },
  };
}
