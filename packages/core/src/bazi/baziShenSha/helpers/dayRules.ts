import { BASIC_MAPPINGS } from '../../baziDefinitions';
import type { RuleContext, ShenShaRuleMap } from './types';

const JIE_LU_KONG_WANG_HOUR_BRANCHES: Record<string, string[]> = {
  甲: ['申', '酉'],
  己: ['申', '酉'],
  乙: ['午', '未'],
  庚: ['午', '未'],
  丙: ['辰', '巳'],
  辛: ['辰', '巳'],
  丁: ['寅', '卯'],
  壬: ['寅', '卯'],
  戊: ['戌', '亥'],
  癸: ['戌', '亥'],
};

const TIAN_TU_SHA_HOUR_BRANCH_BY_DAY_BRANCH: Record<string, string> = {
  丑: '亥',
  亥: '丑',
  寅: '戌',
  戌: '寅',
  卯: '酉',
  酉: '卯',
  辰: '申',
  申: '辰',
  巳: '未',
  未: '巳',
};

const DIAN_DAO_SHA_HOUR_BRANCH_BY_DAY_BRANCH: Record<string, string> = {
  寅: '丑',
  巳: '辰',
  申: '未',
  亥: '戌',
};

const ZI_REN_PILLARS = ['丙午', '丁未', '戊午', '己未', '壬子', '癸丑'];

const JI_FENG_SHA_STEMS_BY_MONTH_BRANCH: Record<string, string[]> = {
  寅: ['甲'],
  卯: ['乙'],
  辰: ['戊', '甲'],
  巳: ['丙'],
  午: ['丁'],
  未: ['己'],
  申: ['庚'],
  酉: ['甲', '辛'],
  戌: ['戊', '甲'],
  亥: ['壬'],
  子: ['癸'],
  丑: ['己'],
};

const SEASON_BY_MONTH_BRANCH: Record<string, string> = {
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

export function buildDayRules(ctx: RuleContext): ShenShaRuleMap {
  const {
    gan,
    zhi,
    pillarIndex,
    yueZhi,
    riGan,
    riZhi,
    riGZ,
    pillarGZ,
    baziArray,
    ctg,
    zhiIdx,
    variants,
  } = ctx;
  const [, , , [hourGan]] = baziArray;
  const jiFengStems = JI_FENG_SHA_STEMS_BY_MONTH_BRANCH[yueZhi] || [];
  const hasJiFengSha = jiFengStems.includes(riGan) && jiFengStems.includes(hourGan);
  const season = SEASON_BY_MONTH_BRANCH[yueZhi];

  return {
    截路空亡: () => pillarIndex === 3 && JIE_LU_KONG_WANG_HOUR_BRANCHES[riGan]?.includes(zhi),
    天屠煞: () => pillarIndex === 3 && TIAN_TU_SHA_HOUR_BRANCH_BY_DAY_BRANCH[riZhi] === zhi,
    颠倒杀: () => pillarIndex === 3 && DIAN_DAO_SHA_HOUR_BRANCH_BY_DAY_BRANCH[riZhi] === zhi,
    玄武受戮: () => (pillarIndex === 2 || pillarIndex === 3) && pillarGZ === '壬辰',
    青龙伏藏: () => (pillarIndex === 2 || pillarIndex === 3) && pillarGZ === '癸巳',
    玄武折足: () => (pillarIndex === 2 || pillarIndex === 3) && pillarGZ === '丁未',
    白虎丧目: () => pillarIndex === 3 && pillarGZ === '辛卯',
    戟锋煞: () =>
      (pillarIndex === 2 || pillarIndex === 3) && hasJiFengSha && jiFengStems.includes(gan),
    自刃: () => (pillarIndex === 2 || pillarIndex === 3) && ZI_REN_PILLARS.includes(pillarGZ),
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
      ['乙卯', '戊子', '戊午', '己卯', '己酉', '辛卯', '辛酉', '壬子', '壬午'].includes(riGZ),
    四废日: () => {
      if (pillarIndex !== 2) return false;
      const rulesMap: Record<string, string[]> = {
        春: ['庚申', '辛酉'],
        夏: ['壬子', '癸亥'],
        秋: ['甲寅', '乙卯'],
        冬: ['丙午', '丁巳'],
      };
      const bigRulesMap: Record<string, string[]> = {
        春: ['申', '酉'],
        夏: ['亥', '子'],
        秋: ['寅', '卯'],
        冬: ['巳', '午'],
      };
      return !!season && (rulesMap[season].includes(riGZ) || bigRulesMap[season].includes(riZhi));
    },
    十恶大败: () => {
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
      if ((season === '春' || season === '秋') && (zhi === '寅' || zhi === '子')) return true;
      if ((season === '夏' || season === '冬') && (zhi === '卯' || zhi === '未' || zhi === '辰'))
        return true;
      const riGanWuxing = BASIC_MAPPINGS.STEM_WUXING[ctg.indexOf(riGan)];
      if ((riGanWuxing === '木' || riGanWuxing === '火') && (zhi === '丑' || zhi === '辰'))
        return true;
      if (
        (riGanWuxing === '金' || riGanWuxing === '水') &&
        (zhi === '午' || zhi === '戌' || zhi === '辰')
      )
        return true;
      if (riGanWuxing === '土' && (zhi === '辰' || zhi === '巳')) return true;
      return false;
    },
    天转: () =>
      (pillarIndex === 2 || pillarIndex === 3) &&
      !!season &&
      ({ 春: '乙卯', 夏: '戊午', 秋: '辛酉', 冬: '癸子' } as Record<string, string>)[season] ===
        pillarGZ,
    地转: () =>
      (pillarIndex === 2 || pillarIndex === 3) &&
      !!season &&
      ({ 春: '甲寅', 夏: '丁巳', 秋: '庚申', 冬: '癸亥' } as Record<string, string>)[season] ===
        pillarGZ,
    隔角: () => {
      if (pillarIndex !== 3) return false;
      const diff = (zhiIdx(zhi) - zhiIdx(riZhi) + 12) % 12;
      return diff === 2 || diff === 10;
    },
  };
}
