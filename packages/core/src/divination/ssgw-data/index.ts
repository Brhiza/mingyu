import type { SsgwSign } from './types';
import { getRawSsgwSigns } from './signs-full';
import { enrichSsgwSign } from './interpretation';

export { SSGW_INTERPRETATION_FIELDS } from './types';
export type { SsgwInterpretation, SsgwInterpretationField, SsgwSign } from './types';

const ssgwSigns: SsgwSign[] = getRawSsgwSigns().map(enrichSsgwSign);

/** 返回独立的三山国王签谱资料。 */
export function getSsgwSigns(): SsgwSign[] {
  return ssgwSigns.map((sign) => ({ ...sign, details: { ...sign.details } }));
}

// 三山国王灵签数据（共92签，源自官方版本）
export const SSGW_SIGNS: SsgwSign[] = getSsgwSigns();
