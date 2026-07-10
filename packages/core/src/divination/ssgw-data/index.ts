import type { SsgwSign } from './types';
import { SIGNS_FULL } from './signs-full';
import { enrichSsgwSign } from './interpretation';

export { SSGW_INTERPRETATION_FIELDS } from './types';
export type { SsgwInterpretation, SsgwInterpretationField, SsgwSign } from './types';

// 三山国王灵签数据（共92签，源自官方版本）
export const SSGW_SIGNS: SsgwSign[] = SIGNS_FULL.map(enrichSsgwSign);
