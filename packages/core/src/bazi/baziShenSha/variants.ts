import type { ShenShaScope } from './scope';

export type ShenShaKongWangBasis = 'day' | 'day-and-year';
export type ShenShaYangRenMode = 'yang-stems-only' | 'include-yin-ren';
export type ShenShaTongZiScope = 'day-hour' | 'all-pillars';
export type ShenShaReferenceProfile = 'wenzhen' | 'classical';

export interface ShenShaVariantConfig {
  /** 常用神煞规则口径；默认采用问真整理的 55 项查法。 */
  referenceProfile: ShenShaReferenceProfile;
  kongWangBasis: ShenShaKongWangBasis;
  yangRenMode: ShenShaYangRenMode;
  tongZiScope: ShenShaTongZiScope;
}

export interface ShenShaCalculatorOptions {
  variants?: Partial<ShenShaVariantConfig>;
  /** 神煞输出范围；默认仅返回常用神煞，all 返回全部已计算项目。 */
  scope?: ShenShaScope;
}

export const DEFAULT_SHENSHA_VARIANT_CONFIG: ShenShaVariantConfig = {
  referenceProfile: 'wenzhen',
  kongWangBasis: 'day-and-year',
  yangRenMode: 'include-yin-ren',
  tongZiScope: 'day-hour',
};

const CLASSICAL_SHENSHA_VARIANT_CONFIG: ShenShaVariantConfig = {
  referenceProfile: 'classical',
  kongWangBasis: 'day',
  yangRenMode: 'yang-stems-only',
  tongZiScope: 'day-hour',
};

export function resolveShenShaVariantConfig(
  variants?: Partial<ShenShaVariantConfig>,
): ShenShaVariantConfig {
  const defaults =
    variants?.referenceProfile === 'classical'
      ? CLASSICAL_SHENSHA_VARIANT_CONFIG
      : DEFAULT_SHENSHA_VARIANT_CONFIG;
  return {
    ...defaults,
    ...variants,
  };
}
