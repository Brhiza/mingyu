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

const WU_XING_ZHEN_RI_SHI_BY_DAY_PILLAR: Record<string, string> = {
  乙酉: '庚辰',
  丁巳: '丙午',
  癸亥: '壬子',
  己丑: '戊辰',
  甲寅: '丁卯',
};

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

const SI_FEI_DAY_PILLARS_BY_SEASON: Record<string, string[]> = {
  春: ['庚申', '辛酉'],
  夏: ['壬子', '癸亥'],
  秋: ['甲寅', '乙卯'],
  冬: ['丙午', '丁巳'],
};

const TIAN_ZHUAN_DAY_PILLAR_BY_SEASON: Record<string, string> = {
  春: '乙卯',
  夏: '丙午',
  秋: '辛酉',
  冬: '壬子',
};

const DI_ZHUAN_DAY_PILLAR_BY_SEASON: Record<string, string> = {
  春: '辛卯',
  夏: '戊午',
  秋: '癸酉',
  冬: '丙子',
};

const TIAN_SHE_DAY_PILLAR_BY_SEASON: Record<string, string> = {
  春: '戊寅',
  夏: '甲午',
  秋: '戊申',
  冬: '甲子',
};

const KUI_GANG_DAY_PILLARS = ['庚辰', '壬辰', '戊戌', '庚戌'];

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
  const { gan, zhi, pillarIndex, yueZhi, riGan, riZhi, riGZ, pillarGZ, baziArray, zhiIdx } = ctx;
  const [, , , [hourGan]] = baziArray;
  const jiFengStems = JI_FENG_SHA_STEMS_BY_MONTH_BRANCH[yueZhi] || [];
  const hasJiFengSha = jiFengStems.includes(riGan) && jiFengStems.includes(hourGan);
  const season = SEASON_BY_MONTH_BRANCH[yueZhi];

  return {
    // 《三命通会》主表明确“只以日取时见之”；戊癸取戌亥。另有古籍异本取子丑，默认不混用。
    截路空亡: () => pillarIndex === 3 && JIE_LU_KONG_WANG_HOUR_BRANCHES[riGan]?.includes(zhi),
    天屠煞: () => pillarIndex === 3 && TIAN_TU_SHA_HOUR_BRANCH_BY_DAY_BRANCH[riZhi] === zhi,
    颠倒杀: () => pillarIndex === 3 && DIAN_DAO_SHA_HOUR_BRANCH_BY_DAY_BRANCH[riZhi] === zhi,
    玄武受戮: () => (pillarIndex === 2 || pillarIndex === 3) && pillarGZ === '壬辰',
    青龙伏藏: () => (pillarIndex === 2 || pillarIndex === 3) && pillarGZ === '癸巳',
    玄武折足: () => (pillarIndex === 2 || pillarIndex === 3) && pillarGZ === '丁未',
    白虎丧目: () => pillarIndex === 3 && pillarGZ === '辛卯',
    // 采用《五行精纪》逐月旺干表；辰、酉、戌月含甲，与《三命通会》省略甲的异本分开处理。
    戟锋煞: () =>
      (pillarIndex === 2 || pillarIndex === 3) && hasJiFengSha && jiFengStems.includes(gan),
    // 《五行精纪》列六柱，并明确日主、时主的柱位范围；《三命通会》把日刃另行分类后所列
    // “自刃”表不同，默认保留《五行精纪》本表，不把两种分类静默拼接。
    自刃: () => (pillarIndex === 2 || pillarIndex === 3) && ZI_REN_PILLARS.includes(pillarGZ),
    五行真日时: () => pillarIndex === 3 && WU_XING_ZHEN_RI_SHI_BY_DAY_PILLAR[riGZ] === pillarGZ,
    // 《五行精纪》《命理探源》均列“春戊寅、夏甲午、秋戊申、冬甲子”，并明确以日主取用。
    天赦日: () => pillarIndex === 2 && TIAN_SHE_DAY_PILLAR_BY_SEASON[season] === riGZ,
    // 《三命通会》“此格有四日”，只保留四个完整日柱，不把辰戌支或同柱月时扩写成魁罡。
    魁罡: () => pillarIndex === 2 && KUI_GANG_DAY_PILLARS.includes(riGZ),
    // 《三命通会》明确称月、日、时可两重或三重犯之，年柱不在此列。
    阴差阳错: () =>
      pillarIndex >= 1 &&
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
      ].includes(pillarGZ),
    // 《三命通会》只列乙巳、丁巳、辛亥、戊申、甲寅、丙午、戊午、壬子八日。
    // 旧表额外加入己未、癸丑，无可复核出处，故不再命中。
    孤鸾煞: () =>
      pillarIndex === 2 &&
      ['乙巳', '丁巳', '辛亥', '戊申', '甲寅', '丙午', '戊午', '壬子'].includes(riGZ),
    // 《五行精纪》《三命通会》均明言八专可见于日上、时上。
    八专: () =>
      (pillarIndex === 2 || pillarIndex === 3) &&
      ['甲寅', '乙卯', '丁未', '戊戌', '己未', '庚申', '辛酉', '癸丑'].includes(pillarGZ),
    // 《命理探源》明确“以日主为主，年月时不论”，这里只保留正四废的完整日柱。
    // 《五行精纪》另名“大四废”的季支表不并入同一规则。
    四废日: () =>
      pillarIndex === 2 && !!season && SI_FEI_DAY_PILLARS_BY_SEASON[season].includes(riGZ),
    // 《五行精纪》《三命通会》《命理探源》十日表一致，并明确“日上见之为是，其余不论”。
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
    // 《命理探源》逐季各列天转、地转一日，并明确“以日主为主”。
    天转: () => pillarIndex === 2 && !!season && TIAN_ZHUAN_DAY_PILLAR_BY_SEASON[season] === riGZ,
    地转: () => pillarIndex === 2 && !!season && DI_ZHUAN_DAY_PILLAR_BY_SEASON[season] === riGZ,
    隔角: () => {
      if (pillarIndex !== 3) return false;
      const diff = (zhiIdx(zhi) - zhiIdx(riZhi) + 12) % 12;
      // 《神峰通考》“日与时隔一字”的直接示例均为从日支顺行两位，未据此反推逆行口径。
      return diff === 2;
    },
  };
}
