import type { ShenShaVariantConfig } from '../variants';

export type BaziArray = [string, string][];
export type PillarKey = 'year' | 'month' | 'day' | 'hour';

export interface RuleContext {
  gan: string;
  zhi: string;
  pillarIndex: number;
  baziArray: BaziArray;
  gender: string;
  nianGan: string;
  nianZhi: string;
  yueZhi: string;
  riGan: string;
  riZhi: string;
  riGZ: string;
  pillarGZ: string;
  isMan: boolean;
  ctg: readonly string[];
  cdz: readonly string[];
  zhiIdx: (zhi: string) => number;
  variants: ShenShaVariantConfig;
}

export type ShenShaRule = () => boolean;
export type ShenShaRuleMap = Record<string, ShenShaRule>;
