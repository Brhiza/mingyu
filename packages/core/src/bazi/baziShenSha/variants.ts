export type ShenShaKongWangBasis = 'day' | 'day-and-year';
export type ShenShaYangRenMode = 'yang-stems-only' | 'include-yin-ren';

export interface ShenShaVariantConfig {
  kongWangBasis: ShenShaKongWangBasis;
  yangRenMode: ShenShaYangRenMode;
}

export interface ShenShaCalculatorOptions {
  variants?: Partial<ShenShaVariantConfig>;
}

export const DEFAULT_SHENSHA_VARIANT_CONFIG: ShenShaVariantConfig = {
  kongWangBasis: 'day',
  yangRenMode: 'yang-stems-only',
};

export function resolveShenShaVariantConfig(
  variants?: Partial<ShenShaVariantConfig>,
): ShenShaVariantConfig {
  return {
    ...DEFAULT_SHENSHA_VARIANT_CONFIG,
    ...variants,
  };
}
