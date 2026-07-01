/**
 * 八字神煞计算模块
 * 默认采用主流口径，争议算法通过 options.variants 保留可切换分支。
 */

import { BASIC_MAPPINGS } from '../baziDefinitions';
import type { ShenShaResult } from '../baziTypes';
import { buildNobleRules } from './helpers/nobleRules';
import { buildLuRules } from './helpers/luRules';
import { buildDayRules } from './helpers/dayRules';
import { buildMarriageRules } from './helpers/marriageRules';
import { buildDisasterRules } from './helpers/disasterRules';
import { analyzeGlobalShenSha, calculateGlobalShenSha } from './helpers/globalRules';
import { analyzeShenShaWithTenGod } from './helpers/tenGodAnalysis';
import type { BaziArray, PillarKey, RuleContext } from './helpers/types';
import {
  resolveShenShaVariantConfig,
  type ShenShaCalculatorOptions,
  type ShenShaVariantConfig,
} from './variants';

export {
  DEFAULT_SHENSHA_VARIANT_CONFIG,
  resolveShenShaVariantConfig,
} from './variants';
export type {
  ShenShaCalculatorOptions,
  ShenShaKongWangBasis,
  ShenShaTongZiScope,
  ShenShaVariantConfig,
  ShenShaYangRenMode,
} from './variants';

/**
 * 神煞计算器
 */
export class ShenShaCalculator {
  private ctg: readonly string[];
  private cdz: readonly string[];
  private variants: ShenShaVariantConfig;

  constructor(options: ShenShaCalculatorOptions = {}) {
    this.ctg = BASIC_MAPPINGS.HEAVENLY_STEMS;
    this.cdz = BASIC_MAPPINGS.EARTHLY_BRANCHES;
    this.variants = resolveShenShaVariantConfig(options.variants);
  }

  /**
   * 获取地支索引
   */
  private zhiIdx(zhi: string): number {
    return this.cdz.indexOf(zhi);
  }

  /**
   * 计算所有神煞
   */
  public calculateAllShenSha(baziArray: BaziArray, gender: string): ShenShaResult {
    const result: ShenShaResult = {
      year: [],
      month: [],
      day: [],
      hour: [],
    };
    const pillars: PillarKey[] = ['year', 'month', 'day', 'hour'];

    baziArray.forEach((pillar, index) => {
      const [gan, zhi] = pillar;
      const shenShaList = this.calculatePillarShenSha(gan, zhi, index, baziArray, gender);
      result[pillars[index]] = shenShaList;
    });

    const globalShenSha = calculateGlobalShenSha(baziArray);
    if (globalShenSha.length > 0) {
      result.global = globalShenSha;
    }

    return result;
  }

  public analyzeGlobalShenSha(shenShaList: string[]): string[] {
    return analyzeGlobalShenSha(shenShaList);
  }

  /**
   * 结合十神的神煞分析 (高级分析)
   * 例如：驿马+偏财 = 动中求财；桃花+七杀 = 桃花劫
   */
  public analyzeShenShaWithTenGod(shenShaList: string[], tenGod: string): string[] {
    return analyzeShenShaWithTenGod(shenShaList, tenGod);
  }

  /**
   * 计算单柱神煞
   */
  private calculatePillarShenSha(
    gan: string,
    zhi: string,
    pillarIndex: number,
    baziArray: BaziArray,
    gender: string,
  ): string[] {
    const results: string[] = [];
    const [nianGan, nianZhi] = baziArray[0];
    const [, yueZhi] = baziArray[1];
    const [riGan, riZhi] = baziArray[2];
    const riGZ = riGan + riZhi;
    const pillarGZ = gan + zhi;
    const isMan = gender === 'male';

    const ctx: RuleContext = {
      gan,
      zhi,
      pillarIndex,
      baziArray,
      gender,
      nianGan,
      nianZhi,
      yueZhi,
      riGan,
      riZhi,
      riGZ,
      pillarGZ,
      isMan,
      ctg: this.ctg,
      cdz: this.cdz,
      zhiIdx: (z: string) => this.zhiIdx(z),
      variants: this.variants,
    };

    const rules = {
      ...buildNobleRules(ctx),
      ...buildLuRules(ctx),
      ...buildDayRules(ctx),
      ...buildMarriageRules(ctx),
      ...buildDisasterRules(ctx),
    };

    for (const name in rules) {
      if (rules[name]()) {
        results.push(name);
      }
    }

    return results;
  }
}
