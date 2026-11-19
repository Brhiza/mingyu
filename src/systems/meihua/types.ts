import type { z } from 'zod';
import type { meihuaInput } from '../../schema';

export type MeihuaSettings = NonNullable<z.infer<typeof meihuaInput>['meihua']>;
export type MeihuaDirection = NonNullable<MeihuaSettings['direction']>;
export type MeihuaObjectType = NonNullable<MeihuaSettings['objectType']>;

export interface MeihuaCalculation {
  method: string;
  numbers?: number[];
  time?: string;
  number?: number;
  soundCount?: number;
  characterText?: string;
  characterCount?: number;
  characterTones?: number[];
  characterStrokeCounts?: number[];
  characterLeftStrokes?: number;
  characterRightStrokes?: number;
  characterUpperNumber?: number;
  characterLowerNumber?: number;
  characterRule?: string;
  direction?: MeihuaDirection;
  objectType?: MeihuaObjectType;
  objectTrigramIndex?: number;
  directionTrigramIndex?: number;
  totalWithTime?: number;
  month?: number;
  day?: number;
  yearZhi?: string;
  yearZhiIndex?: number;
  timeZhi?: string;
  timeZhiIndex?: number;
  /** 起卦时采用的民用时区偏移，用于从时间戳复核取数。 */
  timezoneOffsetMinutes?: number;
  upperTrigramIndex?: number;
  lowerTrigramIndex?: number;
  movingYaoIndex?: number;
  methodKey?: MeihuaSettings['method'];
  [key: string]: unknown;
}

