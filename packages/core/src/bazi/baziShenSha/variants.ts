export type ShenShaKongWangBasis = 'day' | 'day-and-year';
export type ShenShaYangRenMode = 'yang-stems-only' | 'include-yin-ren';
export type ShenShaTongZiScope = 'day-hour' | 'all-pillars';

export interface ShenShaVariantConfig {
  kongWangBasis: ShenShaKongWangBasis;
  yangRenMode: ShenShaYangRenMode;
  tongZiScope: ShenShaTongZiScope;
}

export interface ShenShaCalculatorOptions {
  variants?: Partial<ShenShaVariantConfig>;
}

export const DEFAULT_SHENSHA_VARIANT_CONFIG: ShenShaVariantConfig = {
  kongWangBasis: 'day',
  yangRenMode: 'yang-stems-only',
  tongZiScope: 'day-hour',
};

export function resolveShenShaVariantConfig(
  variants?: Partial<ShenShaVariantConfig>,
): ShenShaVariantConfig {
  return {
    ...DEFAULT_SHENSHA_VARIANT_CONFIG,
    ...variants,
  };
}
