import type { ClimateRule } from '../../types';
import { DING_YIN_CLIMATE_RULES } from './yin';
import { DING_MAO_CLIMATE_RULES } from './mao';
import { DING_CHEN_CLIMATE_RULES } from './chen';
import { DING_SI_CLIMATE_RULES } from './si';
import { DING_WU_CLIMATE_RULES } from './wu';
import { DING_WEI_CLIMATE_RULES } from './wei';
import { DING_SHEN_CLIMATE_RULES } from './shen';
import { DING_YOU_CLIMATE_RULES } from './you';
import { DING_XU_CLIMATE_RULES } from './xu';
import { DING_HAI_CLIMATE_RULES } from './hai';
import { DING_ZI_CLIMATE_RULES } from './zi';
import { DING_CHOU_CLIMATE_RULES } from './chou';

export const DING_CLIMATE_RULES: ClimateRule[] = [
  ...DING_YIN_CLIMATE_RULES,
  ...DING_MAO_CLIMATE_RULES,
  ...DING_CHEN_CLIMATE_RULES,
  ...DING_SI_CLIMATE_RULES,
  ...DING_WU_CLIMATE_RULES,
  ...DING_WEI_CLIMATE_RULES,
  ...DING_SHEN_CLIMATE_RULES,
  ...DING_YOU_CLIMATE_RULES,
  ...DING_XU_CLIMATE_RULES,
  ...DING_HAI_CLIMATE_RULES,
  ...DING_ZI_CLIMATE_RULES,
  ...DING_CHOU_CLIMATE_RULES,
];
