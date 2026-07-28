import { HIDDEN_STEMS } from './baziDefinitions';
import { assertHeavenlyStem, assertPillars, getWuxing as getWuxingUtil } from './baziUtils';
import { WUXING, type Pillars, type Wuxing, type WuxingStrengthDetails } from './baziTypes';

interface ElementPresence {
  direct: number;
  hidden: number;
}

/**
 * 专注于五行结构出现情况登记的工具类
 */
export class WuxingCalculator {
  /**
   * 计算五行结构分布
   * @param pillars - 四柱
   * @param monthCommander - 月令司权天干（可选），仅单列为月令事实，不换算成比例加成
   * @returns 包含出现项、缺失项、月令司权五行与逐条依据的详细对象
   */
  public calculateWuxingStrength(pillars: Pillars, monthCommander?: string): WuxingStrengthDetails {
    assertPillars(pillars);
    if (monthCommander) assertHeavenlyStem(monthCommander, '月令司权天干');

    const presence = this._calculatePresence(pillars);
    const missingElements = WUXING.filter(
      (element) => presence[element].direct === 0 && presence[element].hidden === 0,
    );
    const present = WUXING.filter((element) => !missingElements.includes(element));
    const commanderElement = monthCommander ? getWuxingUtil(monthCommander) : undefined;

    return {
      missing: missingElements,
      present,
      commanderElement: commanderElement === '未知' ? undefined : commanderElement,
      ruleBasis: [
        '出现与缺失按四柱天干及四支全部藏干是否见到对应五行登记，不据出现次数比较强弱',
        monthCommander
          ? '司令天干只单列为月令事实，不额外增加五行比例'
          : '未提供司令天干，不额外推定月令司权五行',
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
