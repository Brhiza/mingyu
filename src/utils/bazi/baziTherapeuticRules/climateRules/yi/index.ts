import type { ClimateRule } from '../../types';
import { YI_YIN_CLIMATE_RULES } from './yin';
import { YI_MAO_CLIMATE_RULES } from './mao';
import { YI_CHEN_CLIMATE_RULES } from './chen';
import { YI_SI_CLIMATE_RULES } from './si';
import { YI_WU_CLIMATE_RULES } from './wu';
import { YI_WEI_CLIMATE_RULES } from './wei';
import { YI_SHEN_CLIMATE_RULES } from './shen';
import { YI_YOU_CLIMATE_RULES } from './you';
import { YI_XU_CLIMATE_RULES } from './xu';
import { YI_HAI_CLIMATE_RULES } from './hai';
import { YI_ZI_CLIMATE_RULES } from './zi';
import { YI_CHOU_CLIMATE_RULES } from './chou';

export const YI_CLIMATE_RULES: ClimateRule[] = [
  ...YI_YIN_CLIMATE_RULES,
  ...YI_MAO_CLIMATE_RULES,
  ...YI_CHEN_CLIMATE_RULES,
  ...YI_SI_CLIMATE_RULES,
  ...YI_WU_CLIMATE_RULES,
  ...YI_WEI_CLIMATE_RULES,
  ...YI_SHEN_CLIMATE_RULES,
  ...YI_YOU_CLIMATE_RULES,
  ...YI_XU_CLIMATE_RULES,
  ...YI_HAI_CLIMATE_RULES,
  ...YI_ZI_CLIMATE_RULES,
  ...YI_CHOU_CLIMATE_RULES,
];
