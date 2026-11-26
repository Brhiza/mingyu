import type { EarthRule } from './ganzhi-foundation';
import type { BaziRules } from './bazi/pillars';
import type { ZiweiEngineRules } from './ziwei/types';

/**
 * 全系统统一通用默认配置：
 * 所有排盘与推算在用户不作任何额外选择时，自动按本表中的通行标准口径执行；
 * 仅在流派研究或高级调用显式传入覆盖参数时按需切换。
 */
export const UNIVERSAL_DEFAULTS = {
  time: {
    timezone: 8,
    timeStandard: 'civil' as const,
  },
  bazi: {
    yearBoundary: 'lichun' as const,
    ziHourMode: '23:00' as const,
    nightZiStemMode: 'next-day' as const,
    solarTermMode: 'exact-instant' as const,
    patternMode: 'standard' as const,
    includeExtraPalaces: true,
    mingGongMethod: 'traditional' as const,
    kongWangMode: 'day' as const,
    fortuneRule: 'exact-3days' as const,
    yangRenMode: 'all-stems' as const,
    shenshaBaseMode: 'year-and-day' as const,
    xueTangMode: 'nayin' as const,
    tianYiMode: 'standard' as const,
    tianGuanMode: 'standard' as const,
    hongYanMode: 'standard' as const,
    tongZiMode: 'standard' as const,
    commanderMode: 'standard' as const,
    earthRule: 'follow-fire' as EarthRule,
  },
  ziwei: {
    algorithm: 'default' as const,
    leapMonthMode: 'split-15' as const,
    mutagenSchool: 'default' as const,
    plateType: 'heaven' as const,
    tianmaMode: 'year' as const,
    yearDivide: 'normal' as const,
    horoscopeDivide: 'normal' as const,
    ageDivide: 'normal' as const,
    dayDivide: 'forward' as const,
  },
  xuankong: {
    mode: '下卦' as const,
  },
  almanac: {
    calendarBasis: 'beijing-noon' as const,
    godsScope: 'standard' as const,
  },
  qizheng: {
    mingGongMethod: 'mao-palace' as const,
    nodeModel: 'true' as const,
  },
  liuyao: {
    ziHourMode: '23:00' as const,
  },
  xiaoliuren: {
    ziHourMode: '00:00' as const,
  },
  tarot: {
    reversalMode: 'realistic' as const,
  },
} as const;

export type TarotReversalMode = 'realistic' | 'balanced' | 'upright-only';

/** 塔罗洗牌正逆位概率：realistic 贴近现实洗牌手感（约 30%），balanced 经典对半（50%），upright-only 仅看正位（0%）。 */
export const TAROT_REVERSAL_RATES: Record<TarotReversalMode, number> = {
  realistic: 0.3,
  balanced: 0.5,
  'upright-only': 0,
};

export function resolveBaziRules(rules?: BaziRules) {
  return {
    yearBoundary: rules?.yearBoundary ?? UNIVERSAL_DEFAULTS.bazi.yearBoundary,
    ziHourMode: rules?.ziHourMode ?? UNIVERSAL_DEFAULTS.bazi.ziHourMode,
    nightZiStemMode: rules?.nightZiStemMode ?? UNIVERSAL_DEFAULTS.bazi.nightZiStemMode,
    solarTermMode: rules?.solarTermMode ?? UNIVERSAL_DEFAULTS.bazi.solarTermMode,
    patternMode: rules?.patternMode ?? UNIVERSAL_DEFAULTS.bazi.patternMode,
    includeExtraPalaces: rules?.includeExtraPalaces ?? UNIVERSAL_DEFAULTS.bazi.includeExtraPalaces,
    mingGongMethod: rules?.mingGongMethod ?? UNIVERSAL_DEFAULTS.bazi.mingGongMethod,
    kongWangMode: rules?.kongWangMode ?? UNIVERSAL_DEFAULTS.bazi.kongWangMode,
    fortuneRule: rules?.fortuneRule ?? UNIVERSAL_DEFAULTS.bazi.fortuneRule,
    yangRenMode: rules?.yangRenMode ?? UNIVERSAL_DEFAULTS.bazi.yangRenMode,
    shenshaBaseMode: rules?.shenshaBaseMode ?? UNIVERSAL_DEFAULTS.bazi.shenshaBaseMode,
    xueTangMode: rules?.xueTangMode ?? UNIVERSAL_DEFAULTS.bazi.xueTangMode,
    tianYiMode: rules?.tianYiMode ?? UNIVERSAL_DEFAULTS.bazi.tianYiMode,
    tianGuanMode: rules?.tianGuanMode ?? UNIVERSAL_DEFAULTS.bazi.tianGuanMode,
    hongYanMode: rules?.hongYanMode ?? UNIVERSAL_DEFAULTS.bazi.hongYanMode,
    tongZiMode: rules?.tongZiMode ?? UNIVERSAL_DEFAULTS.bazi.tongZiMode,
    commanderMode: rules?.commanderMode ?? UNIVERSAL_DEFAULTS.bazi.commanderMode,
    earthRule: rules?.earthRule ?? UNIVERSAL_DEFAULTS.bazi.earthRule,
  };
}

export function resolveZiweiRules(rules?: Partial<ZiweiEngineRules>): ZiweiEngineRules {
  const leapMonthMode = rules?.leapMonthMode ?? (
    rules?.fixLeap === false ? 'same' : UNIVERSAL_DEFAULTS.ziwei.leapMonthMode
  );
  return {
    algorithm: rules?.algorithm ?? UNIVERSAL_DEFAULTS.ziwei.algorithm,
    fixLeap: leapMonthMode !== 'same',
    leapMonthMode,
    mutagenSchool: rules?.mutagenSchool ?? UNIVERSAL_DEFAULTS.ziwei.mutagenSchool,
    plateType: rules?.plateType ?? UNIVERSAL_DEFAULTS.ziwei.plateType,
    tianmaMode: rules?.tianmaMode ?? UNIVERSAL_DEFAULTS.ziwei.tianmaMode,
    yearDivide: rules?.yearDivide ?? UNIVERSAL_DEFAULTS.ziwei.yearDivide,
    horoscopeDivide: rules?.horoscopeDivide ?? UNIVERSAL_DEFAULTS.ziwei.horoscopeDivide,
    ageDivide: rules?.ageDivide ?? UNIVERSAL_DEFAULTS.ziwei.ageDivide,
    dayDivide: rules?.dayDivide ?? UNIVERSAL_DEFAULTS.ziwei.dayDivide,
  };
}

export function resolveXuankongMode(mode?: '下卦' | '替卦'): '下卦' | '替卦' {
  return mode ?? UNIVERSAL_DEFAULTS.xuankong.mode;
}

export function resolveQizhengOptions(options?: { mingGongMethod?: 'mao-palace' | 'ascendant'; nodeModel?: 'true' | 'mean' }) {
  return {
    mingGongMethod: options?.mingGongMethod ?? UNIVERSAL_DEFAULTS.qizheng.mingGongMethod,
    nodeModel: options?.nodeModel ?? UNIVERSAL_DEFAULTS.qizheng.nodeModel,
  };
}

export function resolveLiuyaoZiHourMode(mode?: '23:00' | '00:00'): '23:00' | '00:00' {
  return mode ?? UNIVERSAL_DEFAULTS.liuyao.ziHourMode;
}

export function resolveXiaoliurenZiHourMode(mode?: '00:00' | '23:00'): '00:00' | '23:00' {
  return mode ?? UNIVERSAL_DEFAULTS.xiaoliuren.ziHourMode;
}

export function resolveTarotReversalMode(mode?: TarotReversalMode): TarotReversalMode {
  return mode ?? UNIVERSAL_DEFAULTS.tarot.reversalMode;
}
