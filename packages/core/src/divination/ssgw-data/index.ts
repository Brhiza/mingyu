import type { RawSsgwSign } from './types';
import { SIGNS_FULL } from './signs-full';

export type { RawSsgwSign } from './types';

// 三山国王灵签数据（共92签，只保留签号、签题与签诗）
export const SSGW_SIGNS: RawSsgwSign[] = SIGNS_FULL;
