import type { ClimateRule } from '../../types';
import { BING_YIN_CLIMATE_RULES } from './yin';
import { BING_MAO_CLIMATE_RULES } from './mao';
import { BING_CHEN_CLIMATE_RULES } from './chen';
import { BING_SI_CLIMATE_RULES } from './si';
import { BING_WU_CLIMATE_RULES } from './wu';
import { BING_WEI_CLIMATE_RULES } from './wei';
import { BING_SHEN_CLIMATE_RULES } from './shen';
import { BING_YOU_CLIMATE_RULES } from './you';
import { BING_XU_CLIMATE_RULES } from './xu';
import { BING_ZI_CLIMATE_RULES } from './zi';
import { BING_CHOU_CLIMATE_RULES } from './chou';

export const BING_CLIMATE_RULES: ClimateRule[] = [
  ...BING_YIN_CLIMATE_RULES,
  ...BING_MAO_CLIMATE_RULES,
  ...BING_CHEN_CLIMATE_RULES,
  ...BING_SI_CLIMATE_RULES,
  ...BING_WU_CLIMATE_RULES,
  ...BING_WEI_CLIMATE_RULES,
  ...BING_SHEN_CLIMATE_RULES,
  ...BING_YOU_CLIMATE_RULES,
  ...BING_XU_CLIMATE_RULES,
  ...BING_ZI_CLIMATE_RULES,
  ...BING_CHOU_CLIMATE_RULES,
];
