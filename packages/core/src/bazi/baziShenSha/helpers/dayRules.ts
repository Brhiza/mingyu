import { BASIC_MAPPINGS } from '../../baziDefinitions';
import type { RuleContext, ShenShaRuleMap } from './types';

/**
 * 吉日凶煞神煞规则
 */
export function buildDayRules(ctx: RuleContext): ShenShaRuleMap {
  const { zhi, pillarIndex, yueZhi, riGan, riGZ, pillarGZ, ctg, variants } = ctx;

  return {
    天赦日: () => {
      if (pillarIndex !== 2) return false;
      const season: string = (
        {
          寅: '春',
          卯: '春',
          辰: '春',
          巳: '夏',
          午: '夏',
          未: '夏',
          申: '秋',
          酉: '秋',
          戌: '秋',
          亥: '冬',
          子: '冬',
          丑: '冬',
        } as Record<string, string>
      )[yueZhi];
      if (season === '春' && riGZ === '戊寅') return true;
      if (season === '夏' && riGZ === '甲午') return true;
      if (season === '秋' && riGZ === '戊申') return true;
      if (season === '冬' && riGZ === '甲子') return true;
      return false;
    },
    魁罡: () => pillarIndex === 2 && ['庚辰', '壬辰', '戊戌', '庚戌'].includes(riGZ),
    阴差阳错: () =>
      pillarIndex === 2 &&
      [
        '丙子',
        '丁丑',
        '戊寅',
        '辛卯',
        '壬辰',
        '癸巳',
        '丙午',
        '丁未',
        '戊申',
        '辛酉',
        '壬戌',
        '癸亥',
      ].includes(riGZ),
    孤鸾煞: () =>
      pillarIndex === 2 &&
      ['乙巳', '丁巳', '辛亥', '戊申', '甲寅', '壬子', '丙午', '戊午', '己未', '癸丑'].includes(
        riGZ,
      ),
    十灵日: () =>
      pillarIndex === 2 &&
      ['甲辰', '乙亥', '丙辰', '丁酉', '戊午', '庚寅', '庚戌', '辛亥', '壬寅', '癸未'].includes(
        riGZ,
      ),
    六秀日: () =>
      pillarIndex === 2 && ['丙午', '丁未', '戊子', '戊午', '己丑', '己未'].includes(riGZ),
    八专: () =>
      pillarIndex === 2 &&
      ['甲寅', '乙卯', '丁未', '戊戌', '己未', '庚申', '辛酉', '癸丑'].includes(riGZ),
    九丑: () =>
      pillarIndex === 2 &&
      ['戊子', '戊午', '壬子', '壬午', '丁酉', '丁卯', '己酉', '己卯', '辛卯'].includes(riGZ),
    四废日: () => {
      if (pillarIndex !== 2) return false;
      const seasonMap: Record<string, string> = {
        寅: '春',
        卯: '春',
        辰: '春',
        巳: '夏',
        午: '夏',
        未: '夏',
        申: '秋',
        酉: '秋',
        戌: '秋',
        亥: '冬',
        子: '冬',
        丑: '冬',
      };
      const rulesMap: Record<string, string[]> = {
        春: ['庚申', '辛酉'],
        夏: ['壬子', '癸亥'],
        秋: ['甲寅', '乙卯'],
        冬: ['丙午', '丁巳'],
      };
      const season = seasonMap[yueZhi];
      return !!season && rulesMap[season].includes(riGZ);
    },
    十恶大败: () => {
      // 十恶大败日：甲辰、乙巳、丙申、丁亥、戊戌、己丑、庚辰、辛巳、壬申、癸亥
      // 此十日禄入空亡（如甲辰旬空寅卯，甲禄在寅，故为空）
      if (pillarIndex !== 2) return false;
      const badDays = [
        '甲辰',
        '乙巳',
        '丙申',
        '丁亥',
        '戊戌',
        '己丑',
        '庚辰',
        '辛巳',
        '壬申',
        '癸亥',
      ];
      return badDays.includes(riGZ);
    },
    童子煞: () => {
      if (variants.tongZiScope === 'day-hour' && pillarIndex !== 2 && pillarIndex !== 3) {
        return false;
      }
      const seasonMap: Record<string, string> = {
        寅: '春',
        卯: '春',
        辰: '春',
        巳: '夏',
        午: '夏',
        未: '夏',
        申: '秋',
        酉: '秋',
        戌: '秋',
        亥: '冬',
        子: '冬',
        丑: '冬',
      };
      const season = seasonMap[yueZhi];
      if (!season) return false;
      // 春秋寅子贵
      if ((season === '春' || season === '秋') && (zhi === '寅' || zhi === '子')) return true;
      // 夏冬卯未辰
      if ((season === '夏' || season === '冬') && (zhi === '卯' || zhi === '未' || zhi === '辰'))
        return true;
      // 木火连牛角（木火命见丑/辰）
      const riGanWuxing = BASIC_MAPPINGS.STEM_WUXING[ctg.indexOf(riGan)];
      if ((riGanWuxing === '木' || riGanWuxing === '火') && (zhi === '丑' || zhi === '辰'))
        return true;
      // 金水马犬龙（金水命见午/戌/辰）
      if (
        (riGanWuxing === '金' || riGanWuxing === '水') &&
        (zhi === '午' || zhi === '戌' || zhi === '辰')
      )
        return true;
      // 土命逢辰巳（土命见辰/巳）
      if (riGanWuxing === '土' && (zhi === '辰' || zhi === '巳')) return true;
      return false;
    },
    天转: () =>
      (pillarIndex === 2 || pillarIndex === 3) &&
      ({ 春: '乙卯', 夏: '戊午', 秋: '辛酉', 冬: '癸子' } as Record<string, string>)[
        (
          {
            寅: '春',
            卯: '春',
            辰: '春',
            巳: '夏',
            午: '夏',
            未: '夏',
            申: '秋',
            酉: '秋',
            戌: '秋',
            亥: '冬',
            子: '冬',
            丑: '冬',
          } as Record<string, string>
        )[yueZhi]
      ] === pillarGZ,
    地转: () =>
      (pillarIndex === 2 || pillarIndex === 3) &&
      ({ 春: '甲寅', 夏: '丁巳', 秋: '庚申', 冬: '癸亥' } as Record<string, string>)[
        (
          {
            寅: '春',
            卯: '春',
            辰: '春',
            巳: '夏',
            午: '夏',
            未: '夏',
            申: '秋',
            酉: '秋',
            戌: '秋',
            亥: '冬',
            子: '冬',
            丑: '冬',
          } as Record<string, string>
        )[yueZhi]
      ] === pillarGZ,
  };
}
