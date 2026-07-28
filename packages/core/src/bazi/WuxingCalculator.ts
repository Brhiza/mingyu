import { HIDDEN_STEMS, SEASON_STATUS } from './baziDefinitions';
import { assertHeavenlyStem, assertPillars, getWuxing as getWuxingUtil } from './baziUtils';
import { WUXING, type Pillars, type Wuxing, type WuxingStrengthDetails } from './baziTypes';

interface ElementPresence {
  direct: number;
  hidden: number;
}

const SEASON_STATUS_RANK: Record<string, number> = {
  旺: 5,
  相: 4,
  休: 3,
  囚: 2,
  死: 1,
};

/**
 * 专注于五行结构出现情况比较的工具类
 */
export class WuxingCalculator {
  /**
   * 计算五行结构分布
   * @param pillars - 四柱
   * @param monthCommander - 月令司权天干（可选），仅单列为月令事实，不换算成比例加成
   * @returns 包含出现项、缺失项、结构比较优先项与逐条依据的详细对象
   */
  public calculateWuxingStrength(pillars: Pillars, monthCommander?: string): WuxingStrengthDetails {
    assertPillars(pillars);
    if (monthCommander) assertHeavenlyStem(monthCommander, '月令司权天干');

    const presence = this._calculatePresence(pillars);
    const missingElements = WUXING.filter(
      (element) => presence[element].direct === 0 && presence[element].hidden === 0,
    );
    const present = WUXING.filter((element) => !missingElements.includes(element));
    const monthSeason = SEASON_STATUS[pillars.month.zhi] ?? {};
    const maxDirect = Math.max(0, ...present.map((element) => presence[element].direct));
    const directLeaders = present.filter((element) => presence[element].direct === maxDirect);
    const maxHidden = Math.max(0, ...directLeaders.map((element) => presence[element].hidden));
    const structureLeaders = directLeaders.filter(
      (element) => presence[element].hidden === maxHidden,
    );
    const maxSeasonRank = Math.max(
      0,
      ...structureLeaders.map((element) => SEASON_STATUS_RANK[monthSeason[element] ?? ''] ?? 0),
    );
    const dominantByRule = structureLeaders.filter(
      (element) => (SEASON_STATUS_RANK[monthSeason[element] ?? ''] ?? 0) === maxSeasonRank,
    );
    const commanderElement = monthCommander ? getWuxingUtil(monthCommander) : undefined;

    return {
      missing: missingElements,
      present,
      dominantByRule,
      commanderElement: commanderElement === '未知' ? undefined : commanderElement,
      ruleBasis: [
        '先比较四柱天干与地支本气的直接出现次数，再以中余气出现次数校验',
        '结构出现次数相同时，按月令旺相休囚死次序区分，不换算小数倍数或百分比',
        monthCommander
          ? '司令天干只单列为月令事实，不额外增加五行比例'
          : '未提供司令天干，仅按四柱结构与月令状态比较',
      ],
    };
  }

  private _calculatePresence(pillars: Pillars): Record<Wuxing, ElementPresence> {
    const presence = Object.fromEntries(
      WUXING.map((element) => [element, { direct: 0, hidden: 0 }]),
    ) as Record<Wuxing, ElementPresence>;

    for (const pillar of Object.values(pillars)) {
      const ganWuxing = getWuxingUtil(pillar.gan);
      if (ganWuxing !== '未知') {
        presence[ganWuxing].direct += 1;
      }

      const zhiStems = HIDDEN_STEMS[pillar.zhi] || [];
      zhiStems.forEach((stem, index) => {
        const stemWuxing = getWuxingUtil(stem);
        if (stemWuxing !== '未知') {
          if (index === 0) presence[stemWuxing].direct += 1;
          else presence[stemWuxing].hidden += 1;
        }
      });
    }
    return presence;
  }
}
