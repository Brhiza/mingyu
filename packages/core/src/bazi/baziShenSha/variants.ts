export type ShenShaKongWangBasis = 'day' | 'day-and-year';
export type ShenShaYangRenMode = 'yang-stems-only' | 'include-yin-ren';
export type ShenShaTongZiScope = 'day-hour' | 'all-pillars';

export interface ShenShaVariantConfig {
  /** 空亡默认按日柱旬空；兼容口径可同时参考年柱旬空。 */
  kongWangBasis: ShenShaKongWangBasis;
  /** 羊刃默认只取阳干帝旺；兼容口径可把阴干帝旺位作为阴刃并入。 */
  yangRenMode: ShenShaYangRenMode;
  /** 童子煞默认只落日柱、时柱；兼容部分系统对四柱同查。 */
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
