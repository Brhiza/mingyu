import type { ClimateRule } from '../types';
import { GENERAL_CLIMATE_RULES } from './general';
import { JIA_CLIMATE_RULES } from './jia';
import { YI_CLIMATE_RULES } from './yi';
import { BING_CLIMATE_RULES } from './bing';
import { DING_CLIMATE_RULES } from './ding';
import { WU_CLIMATE_RULES } from './wu';
import { JI_CLIMATE_RULES } from './ji';
import { GENG_CLIMATE_RULES } from './geng';
import { XIN_CLIMATE_RULES } from './xin';
import { REN_CLIMATE_RULES } from './ren';
import { GUI_CLIMATE_RULES } from './gui';
import { VERIFIED_CLIMATE_RULES } from './verified';

export const CLIMATE_RULES: ClimateRule[] = [
  ...VERIFIED_CLIMATE_RULES,
  ...GENERAL_CLIMATE_RULES,
  ...JIA_CLIMATE_RULES,
  ...YI_CLIMATE_RULES,
  ...BING_CLIMATE_RULES,
  ...DING_CLIMATE_RULES,
  ...WU_CLIMATE_RULES,
  ...JI_CLIMATE_RULES,
  ...GENG_CLIMATE_RULES,
  ...XIN_CLIMATE_RULES,
  ...REN_CLIMATE_RULES,
  ...GUI_CLIMATE_RULES,
];
