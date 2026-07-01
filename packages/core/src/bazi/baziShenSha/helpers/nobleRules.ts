import { TWELVE_STAGES_MAP } from '../../baziDefinitions';
import type { RuleContext, ShenShaRuleMap } from './types';

function getChangshengBranch(stem: string) {
  const stages = TWELVE_STAGES_MAP[stem];
  if (!stages) return '';
  return Object.entries(stages).find(([, stage]) => stage === '长生')?.[0] || '';
}

/**
 * 贵人神煞规则
 */
export function buildNobleRules(ctx: RuleContext): ShenShaRuleMap {
  const { gan, zhi, nianGan, yueZhi, riGan, pillarGZ, baziArray } = ctx;

  return {
    天乙贵人: () => {
      const map: Record<string, string[]> = {
        甲: ['丑', '未'],
        戊: ['丑', '未'],
        庚: ['丑', '未'],
        己: ['子', '申'],
        乙: ['子', '申'],
        丙: ['亥', '酉'],
        丁: ['亥', '酉'],
        壬: ['卯', '巳'],
        癸: ['卯', '巳'],
        辛: ['寅', '午'],
      };
      return (
        (map[nianGan] && map[nianGan].includes(zhi)) || (map[riGan] && map[riGan].includes(zhi))
      );
    },
    太极贵人: () => {
      const map: Record<string, string[]> = {
        甲: ['子', '午'],
        乙: ['子', '午'],
        丙: ['卯', '酉'],
        丁: ['卯', '酉'],
        戊: ['辰', '戌', '丑', '未'],
        己: ['辰', '戌', '丑', '未'],
        庚: ['寅', '亥'],
        辛: ['寅', '亥'],
        壬: ['巳', '申'],
        癸: ['巳', '申'],
      };
      return (
        (map[nianGan] && map[nianGan].includes(zhi)) || (map[riGan] && map[riGan].includes(zhi))
      );
    },
    天德贵人: () => {
      const monthMap: Record<string, number> = {
        寅: 1,
        卯: 2,
        辰: 3,
        巳: 4,
        午: 5,
        未: 6,
        申: 7,
        酉: 8,
        戌: 9,
        亥: 10,
        子: 11,
        丑: 12,
      };
      const monthNum = monthMap[yueZhi];
      if (!monthNum) return false;
      const tianDeTarget: string = (
        {
          1: '丁',
          2: '申',
          3: '壬',
          4: '辛',
          5: '亥',
          6: '甲',
          7: '癸',
          8: '寅',
          9: '丙',
          10: '乙',
          11: '巳',
          12: '庚',
        } as Record<number, string>
      )[monthNum];
      return tianDeTarget === gan || tianDeTarget === zhi;
    },
    天德合: () => {
      const monthMap: Record<string, number> = {
        寅: 1,
        卯: 2,
        辰: 3,
        巳: 4,
        午: 5,
        未: 6,
        申: 7,
        酉: 8,
        戌: 9,
        亥: 10,
        子: 11,
        丑: 12,
      };
      const monthNum = monthMap[yueZhi];
      if (!monthNum) return false;
      const tianDeHeTarget: string = (
        {
          1: '壬',
          2: '巳',
          3: '丁',
          4: '丙',
          5: '寅',
          6: '己',
          7: '戊',
          8: '亥',
          9: '辛',
          10: '庚',
          11: '申',
          12: '乙',
        } as Record<number, string>
      )[monthNum];
      return tianDeHeTarget === gan || tianDeHeTarget === zhi;
    },
    月德贵人: () => {
      const map: Record<string, string> = {
        寅: '丙',
        午: '丙',
        戌: '丙',
        申: '壬',
        子: '壬',
        辰: '壬',
        亥: '甲',
        卯: '甲',
        未: '甲',
        巳: '庚',
        酉: '庚',
        丑: '庚',
      };
      return map[yueZhi] === gan;
    },
    月德合: () => {
      const yueDeGan: string = (
        {
          寅: '丙',
          午: '丙',
          戌: '丙',
          申: '壬',
          子: '壬',
          辰: '壬',
          亥: '甲',
          卯: '甲',
          未: '甲',
          巳: '庚',
          酉: '庚',
          丑: '庚',
        } as Record<string, string>
      )[yueZhi];
      const heGanMap: Record<string, string> = {
        甲: '己',
        乙: '庚',
        丙: '辛',
        丁: '壬',
        戊: '癸',
        己: '甲',
        庚: '乙',
        辛: '丙',
        壬: '丁',
        癸: '戊',
      };
      return heGanMap[yueDeGan] === gan;
    },
    福星贵人: () => {
      const map: Record<string, string[]> = {
        甲: ['丙寅', '丙子'],
        乙: ['丁丑', '丁亥'],
        丙: ['戊子', '戊戌'],
        丁: ['己亥', '己酉'],
        戊: ['庚戌', '庚申'],
        己: ['辛酉', '辛未'],
        庚: ['壬申', '壬午'],
        辛: ['癸未', '癸巳'],
        壬: ['甲午', '甲辰'],
        癸: ['乙巳', '乙卯'],
      };
      return (
        (map[nianGan] && map[nianGan].includes(pillarGZ)) ||
        (map[riGan] && map[riGan].includes(pillarGZ))
      );
    },
    文昌贵人: () => {
      const map: Record<string, string> = {
        甲: '巳',
        乙: '午',
        丙: '申',
        丁: '酉',
        戊: '申',
        己: '酉',
        庚: '亥',
        辛: '子',
        壬: '寅',
        癸: '卯',
      };
      return map[nianGan] === zhi || map[riGan] === zhi;
    },
    国印贵人: () => {
      const map: Record<string, string> = {
        甲: '戌',
        乙: '亥',
        丙: '丑',
        丁: '寅',
        戊: '丑',
        己: '寅',
        庚: '辰',
        辛: '巳',
        壬: '未',
        癸: '申',
      };
      return map[nianGan] === zhi || map[riGan] === zhi;
    },
    学堂: () => {
      const riChangsheng = getChangshengBranch(riGan);
      const nianChangsheng = getChangshengBranch(nianGan);
      return riChangsheng === zhi || nianChangsheng === zhi;
    },
    词馆: () => {
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
    天厨贵人: () => {
      // 天厨贵人：食神临官禄位的天干在四柱中见对应地支
      // 食神：日干所生之同性天干
      const foodGodMap: Record<string, string> = {
        甲: '丙',
        乙: '丁',
        丙: '戊',
        丁: '己',
        戊: '庚',
        己: '辛',
        庚: '壬',
        辛: '癸',
        壬: '甲',
        癸: '乙',
      };
      // 食神临官禄位（食神的禄神地支）
      const luBranchMap: Record<string, string> = {
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
      // 按日干查
      const riFoodGod = foodGodMap[riGan];
      const riLuBranch = riFoodGod ? luBranchMap[riFoodGod] : undefined;
      // 按年干查
      const nianFoodGod = foodGodMap[nianGan];
      const nianLuBranch = nianFoodGod ? luBranchMap[nianFoodGod] : undefined;
      return riLuBranch === zhi || nianLuBranch === zhi;
    },
    德秀贵人: () => {
      // 德秀贵人：以月令三合局定德与秀
      // 德=三合局五行之阴干，秀=德之合化天干
      // 修正为按五行生克关系推算，并支持天干合化
      const deXiuMap: Record<string, { de: string[]; xiu: string[] }> = {
        // 寅午戌火局：火之德在丙丁，秀在丙丁所合之干（辛壬）化为戊癸水
        寅: { de: ['丙', '丁'], xiu: ['戊', '癸'] },
        午: { de: ['丙', '丁'], xiu: ['戊', '癸'] },
        戌: { de: ['丙', '丁'], xiu: ['戊', '癸'] },
        // 申子辰水局：水之德在壬癸，秀在丁壬化木（甲乙）
        申: { de: ['壬', '癸'], xiu: ['甲', '乙'] },
        子: { de: ['壬', '癸'], xiu: ['甲', '乙'] },
        辰: { de: ['壬', '癸'], xiu: ['甲', '乙'] },
        // 巳酉丑金局：金之德在庚辛，秀在乙庚化金
        巳: { de: ['庚', '辛'], xiu: ['乙', '庚'] },
        酉: { de: ['庚', '辛'], xiu: ['乙', '庚'] },
        丑: { de: ['庚', '辛'], xiu: ['乙', '庚'] },
        // 亥卯未木局：木之德在甲乙，秀在丁壬化木
        亥: { de: ['甲', '乙'], xiu: ['丁', '壬'] },
        卯: { de: ['甲', '乙'], xiu: ['丁', '壬'] },
        未: { de: ['甲', '乙'], xiu: ['丁', '壬'] },
      };
      const config = deXiuMap[yueZhi];
      if (!config) return false;
      // 天干五合映射
      const heGanMap: Record<string, string> = {
        甲: '己',
        乙: '庚',
        丙: '辛',
        丁: '壬',
        戊: '癸',
        己: '甲',
        庚: '乙',
        辛: '丙',
        壬: '丁',
        癸: '戊',
      };
      const allGans = baziArray.map(([currentGan]) => currentGan);
      // 德：四柱天干直接见德干，或见德干之合干（合化成德）
      const hasDe = config.de.some((d) => allGans.includes(d) || allGans.includes(heGanMap[d]));
      // 秀：四柱天干直接见秀干，或见秀干之合干
      const hasXiu = config.xiu.some((s) => allGans.includes(s) || allGans.includes(heGanMap[s]));
      // 当前柱天干需是德或秀（含合化）
      const isDeOrXiu =
        config.de.includes(gan) ||
        config.xiu.includes(gan) ||
        config.de.some((d) => heGanMap[d] === gan) ||
        config.xiu.some((s) => heGanMap[s] === gan);
      return hasDe && hasXiu && isDeOrXiu;
    },
  };
}
