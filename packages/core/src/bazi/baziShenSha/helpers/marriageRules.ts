import type { RuleContext, ShenShaRuleMap } from './types';

export function buildMarriageRules(ctx: RuleContext): ShenShaRuleMap {
  const { zhi, pillarIndex, nianZhi, riZhi, pillarGZ, isMan, cdz, zhiIdx } = ctx;

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
      // 默认采用《命理探源》“以日主为主”的日支口径，不与《五行精纪》年命异法混算。
      return map[riZhi] === zhi;
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
      return pillarIndex >= 1 && map[nianZhi] === zhi;
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
      return pillarIndex >= 1 && map[nianZhi] === zhi;
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
      // 《三命通会》以本命所属三方起例，目标在其余月、日、时柱横取；
      // 年柱只提供本命基准，不把基准柱自身再次当作目标柱。
      return pillarIndex >= 1 && map[nianZhi] === zhi;
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
      return pillarIndex >= 1 && map[nianZhi] === zhi;
    },
    // 《三命通会》先称男命得丙子、女命得戊午，继而另说“日上遇之”的婚配含义；
    // 因此完整柱可在四柱命中，不能把日柱的附加解释误作唯一柱位限制。
    阴阳煞: () => (isMan ? pillarGZ === '丙子' : pillarGZ === '戊午'),
    勾绞煞: () => {
      const gouIdx = (zhiIdx(nianZhi) + 3) % 12;
      const jiaoIdx = (zhiIdx(nianZhi) - 3 + 12) % 12;
      return zhi === cdz[gouIdx] || zhi === cdz[jiaoIdx];
    },
  };
}
