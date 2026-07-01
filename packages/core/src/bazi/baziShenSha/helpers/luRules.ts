import { REN_BRANCH_MAP, TWELVE_STAGES_MAP } from '../../baziDefinitions';
import type { RuleContext, ShenShaRuleMap } from './types';

function getYangRenMap(includeYinRen: boolean): Record<string, string> {
  if (!includeYinRen) return REN_BRANCH_MAP;

  return Object.fromEntries(
    Object.entries(TWELVE_STAGES_MAP).map(([stem, stages]) => {
      const wangBranch = Object.entries(stages).find(([, stage]) => stage === '帝旺');
      return [stem, wangBranch ? wangBranch[0] : ''];
    }),
  );
}

/**
 * 禄刃马星神煞规则
 */
export function buildLuRules(ctx: RuleContext): ShenShaRuleMap {
  const { zhi, pillarIndex, nianGan, nianZhi, riGan, riZhi, pillarGZ, variants } = ctx;
  const yangRenMap = getYangRenMap(variants.yangRenMode === 'include-yin-ren');

  return {
    禄神: () => {
      const map: Record<string, string> = {
        甲: '寅',
        乙: '卯',
        丙: '巳',
        丁: '午',
        戊: '巳',
        己: '午',
        庚: '申',
        辛: '酉',
        壬: '亥',
        癸: '子',
      };
      return map[riGan] === zhi;
    },
    羊刃: () => {
      return yangRenMap[riGan] === zhi;
    },
    飞刃: () => {
      const yangRenZhi = yangRenMap[riGan];
      if (!yangRenZhi) return false;
      const clashMap: Record<string, string> = {
        子: '午',
        丑: '未',
        寅: '申',
        卯: '酉',
        辰: '戌',
        巳: '亥',
        午: '子',
        未: '丑',
        申: '寅',
        酉: '卯',
        戌: '辰',
        亥: '巳',
      };
      return clashMap[yangRenZhi] === zhi;
    },
    驿马: () => {
      const map: Record<string, string> = {
        申: '寅',
        子: '寅',
        辰: '寅',
        亥: '巳',
        卯: '巳',
        未: '巳',
        寅: '申',
        午: '申',
        戌: '申',
        巳: '亥',
        酉: '亥',
        丑: '亥',
      };
      return map[nianZhi] === zhi || map[riZhi] === zhi;
    },
    将星: () => {
      const map: Record<string, string> = {
        申: '子',
        子: '子',
        辰: '子',
        亥: '卯',
        卯: '卯',
        未: '卯',
        寅: '午',
        午: '午',
        戌: '午',
        巳: '酉',
        酉: '酉',
        丑: '酉',
      };
      return map[nianZhi] === zhi || map[riZhi] === zhi;
    },
    华盖: () => {
      const map: Record<string, string> = {
        申: '辰',
        子: '辰',
        辰: '辰',
        亥: '未',
        卯: '未',
        未: '未',
        寅: '戌',
        午: '戌',
        戌: '戌',
        巳: '丑',
        酉: '丑',
        丑: '丑',
      };
      return map[nianZhi] === zhi || map[riZhi] === zhi;
    },
    金舆: () => {
      // 金舆：日干/年干禄神前两位的地支
      const map: Record<string, string> = {
        甲: '辰',
        乙: '巳',
        丙: '未',
        丁: '申',
        戊: '未',
        己: '申',
        庚: '戌',
        辛: '亥',
        壬: '丑',
        癸: '寅',
      };
      return map[riGan] === zhi || map[nianGan] === zhi;
    },
    金神: () =>
      ['乙丑', '己巳', '癸酉'].includes(pillarGZ) && (pillarIndex === 2 || pillarIndex === 3),
  };
}
